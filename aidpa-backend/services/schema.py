import logging
from typing import Any

from db.connection import get_ro_connection
from db.pg_connection import get_supabase_client
from services.storage import dataset_table_name, get_upload

log = logging.getLogger("aidpa.schema")


def fetch_table_schema(
    dataset_id: str,
    sample_rows: int = 5,
) -> dict[str, Any]:
    if get_upload(dataset_id) is None:
        raise ValueError(f"Dataset '{dataset_id}' not found.")

    table = dataset_table_name(dataset_id)

    try:
        sb = get_supabase_client()
        resp = (
            sb.table("datasets")
            .select("columns,sample_rows")
            .eq("dataset_id", dataset_id)
            .maybe_single()
            .execute()
        )
        if resp.data and resp.data.get("columns"):
            log.debug("Schema for '%s' served from Supabase cache.", dataset_id)
            return {
                "table_name":  table,
                "columns":     resp.data["columns"],
                "sample_rows": resp.data.get("sample_rows", [])[:sample_rows],
            }
    except Exception as exc:
        log.warning(
            "Supabase schema cache miss for '%s', falling back to DuckDB: %s",
            dataset_id, exc,
        )

    log.info("Schema for '%s' fetched live from DuckDB.", dataset_id)
    with get_ro_connection() as conn:
        describe_rows = conn.execute(f'DESCRIBE "{table}"').fetchall()
        columns: list[dict[str, str]] = [
            {"name": row[0], "type": row[1]} for row in describe_rows
        ]
        col_names = [c["name"] for c in columns]

        raw_rows = conn.execute(
            f'SELECT * FROM "{table}" LIMIT {sample_rows}'
        ).fetchall()
        sample: list[dict[str, Any]] = [
            dict(zip(col_names, row)) for row in raw_rows
        ]

    return {
        "table_name":  table,
        "columns":     columns,
        "sample_rows": sample,
    }
