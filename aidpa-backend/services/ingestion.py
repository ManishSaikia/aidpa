import logging
import tempfile
import uuid
from datetime import date
from pathlib import Path
from typing import Any

import duckdb

from db.connection import get_db_connection
from db.pg_connection import get_supabase_client

log = logging.getLogger("aidpa.ingestion")

_UPLOAD_DIR = Path(tempfile.gettempdir()) / "aidpa_uploads"
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
_STORAGE_BUCKET = "datasets"


def _table_name(dataset_id: str) -> str:
    return "ds_" + dataset_id.replace("-", "_")


def _ensure_storage_bucket() -> None:
    sb = get_supabase_client()
    try:
        sb.storage.get_bucket(_STORAGE_BUCKET)
    except Exception:
        try:
            sb.storage.create_bucket(_STORAGE_BUCKET, options={"public": False})
            log.info("Created Supabase Storage bucket '%s'", _STORAGE_BUCKET)
        except Exception as exc:
            log.debug("Bucket '%s' check/create note: %s", _STORAGE_BUCKET, exc)


def _upload_to_storage(dataset_id: str, contents: bytes) -> None:
    sb = get_supabase_client()
    _ensure_storage_bucket()
    storage_path = f"{dataset_id}.csv"
    try:
        sb.storage.from_(_STORAGE_BUCKET).upload(
            path=storage_path,
            file=contents,
            file_options={"content-type": "text/csv", "upsert": "true"},
        )
        log.info("Uploaded dataset '%s' to Supabase Storage bucket '%s'", dataset_id, _STORAGE_BUCKET)
    except Exception as exc:
        log.warning("Supabase Storage upload failed for dataset %s: %s", dataset_id, exc)


def _load_csv(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
    file_path: Path,
) -> None:
    conn.execute(
        f'CREATE TABLE IF NOT EXISTS "{table_name}" AS SELECT * FROM read_csv_auto(?)',
        [str(file_path)],
    )
    log.info("Loaded CSV into DuckDB table '%s'", table_name)


def _correct_date_columns(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
) -> list[str]:
    describe = conn.execute(f'DESCRIBE "{table_name}"').fetchall()
    # row: (name, type, null, key, default, extra)
    varchar_cols: list[str] = [
        row[0] for row in describe if "VARCHAR" in row[1].upper()
    ]

    if not varchar_cols:
        return []

    corrected: list[str] = []
    failed: list[str] = []

    for col in varchar_cols:
        try:
            fail_count: int = conn.execute(
                f"""
                SELECT COUNT(*)
                FROM   "{table_name}"
                WHERE  "{col}" IS NOT NULL
                  AND  TRY_CAST("{col}" AS DATE) IS NULL
                """,
            ).fetchone()[0]

            if fail_count == 0:
                conn.execute(
                    f'ALTER TABLE "{table_name}" '
                    f'ALTER COLUMN "{col}" SET TYPE DATE '
                    f'USING TRY_CAST("{col}" AS DATE)',
                )
                corrected.append(col)
                log.info(
                    "Corrected column '%s' -> DATE in table '%s'",
                    col, table_name,
                )
            else:
                log.debug(
                    "Column '%s' kept as VARCHAR (%d values failed DATE cast)",
                    col, fail_count,
                )

        except Exception as exc:
            failed.append(col)
            log.warning(
                "Could not test DATE cast for column '%s' in '%s': %s",
                col, table_name, exc,
            )

    if failed:
        log.warning(
            "Columns that could not be inspected for date correction: %s",
            failed,
        )

    return corrected


def _json_safe(value: Any) -> Any:
    if isinstance(value, date):
        return value.isoformat()
    return value


def _extract_metadata(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
    dataset_id: str,
    filename: str,
    path: str,
    size_bytes: int,
    date_cols_corrected: list[str],
) -> dict[str, Any]:
    row_count: int = conn.execute(
        f'SELECT COUNT(*) FROM "{table_name}"'
    ).fetchone()[0]

    describe = conn.execute(f'DESCRIBE "{table_name}"').fetchall()
    columns = [{"name": row[0], "type": row[1]} for row in describe]
    col_names = [c["name"] for c in columns]

    raw_rows = conn.execute(
        f'SELECT * FROM "{table_name}" LIMIT 5'
    ).fetchall()
    sample_rows = [
        {col: _json_safe(val) for col, val in zip(col_names, row)}
        for row in raw_rows
    ]

    log.info(
        "Metadata extracted for dataset '%s': %d rows | %d cols",
        dataset_id, row_count, len(columns),
    )

    return {
        "dataset_id":             dataset_id,
        "filename":               filename,
        "path":                   path,
        "size_bytes":             size_bytes,
        "row_count":              row_count,
        "column_count":           len(columns),
        "columns":                columns,
        "sample_rows":            sample_rows,
        "date_columns_corrected": date_cols_corrected,
    }


def _store_metadata(metadata: dict[str, Any]) -> None:
    sb = get_supabase_client()
    sb.table("datasets").upsert(metadata, on_conflict="dataset_id").execute()
    log.info("Metadata for dataset '%s' stored in Supabase.", metadata["dataset_id"])


def ingest_dataset(contents: bytes, filename: str, user_id: str | None = None) -> str:
    dataset_id = str(uuid.uuid4())
    file_path  = _UPLOAD_DIR / f"{dataset_id}.csv"
    file_path.write_bytes(contents)

    # Backup raw CSV to Supabase Storage for container rehydration resilience
    _upload_to_storage(dataset_id, contents)

    table_name = _table_name(dataset_id)

    with get_db_connection() as conn:
        _load_csv(conn, table_name, file_path)
        corrected = _correct_date_columns(conn, table_name)
        metadata = _extract_metadata(
            conn,
            table_name,
            dataset_id,
            filename,
            str(file_path),
            len(contents),
            corrected,
        )

    if user_id:
        metadata["user_id"] = user_id

    _store_metadata(metadata)

    return dataset_id


def ensure_dataset_loaded(dataset_id: str) -> None:
    table_name = _table_name(dataset_id)

    with get_db_connection() as conn:
        tables = [row[0] for row in conn.execute("SELECT table_name FROM information_schema.tables").fetchall()]
        if table_name in tables:
            return

        log.info("DuckDB table '%s' not present. Rehydrating from storage...", table_name)
        file_path = _UPLOAD_DIR / f"{dataset_id}.csv"

        if not file_path.exists() or file_path.stat().st_size == 0:
            sb = get_supabase_client()
            try:
                data = sb.storage.from_(_STORAGE_BUCKET).download(f"{dataset_id}.csv")
                file_path.write_bytes(data)
                log.info("Downloaded %d bytes for dataset '%s' from Supabase Storage", len(data), dataset_id)
            except Exception as exc:
                log.error("Failed to download dataset '%s' from Supabase Storage: %s", dataset_id, exc)
                raise ValueError(f"Dataset '{dataset_id}' could not be rehydrated from storage.") from exc

        _load_csv(conn, table_name, file_path)
        _correct_date_columns(conn, table_name)
        log.info("Successfully rehydrated table '%s' in DuckDB.", table_name)
