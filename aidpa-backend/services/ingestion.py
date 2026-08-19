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


def _table_name(dataset_id: str) -> str:
    return "ds_" + dataset_id.replace("-", "_")


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
                    "Corrected column '%s' → DATE in table '%s'",
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
        "Metadata extracted for dataset '%s': %d rows × %d cols",
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
