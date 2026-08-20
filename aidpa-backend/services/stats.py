from typing import Any, Dict, List, Optional

from db.connection import get_ro_connection
from services.storage import dataset_table_name, ensure_dataset_loaded, get_upload

# DuckDB type substrings that indicate a numeric column.
_NUMERIC_TYPE_MARKERS = ("INT", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL", "HUGEINT")


def _is_numeric_type(duckdb_type: str) -> bool:
    return any(marker in duckdb_type.upper() for marker in _NUMERIC_TYPE_MARKERS)


def _round(value: Optional[float], decimals: int = 4) -> Optional[float]:
    return round(value, decimals) if value is not None else None


def compute_column_stats(dataset_id: str) -> Dict[str, Any]:
    if get_upload(dataset_id) is None:
        raise ValueError(f"Dataset '{dataset_id}' not found.")

    ensure_dataset_loaded(dataset_id)
    table = dataset_table_name(dataset_id)
    column_stats: Dict[str, Any] = {}

    with get_ro_connection() as conn:
        # DESCRIBE returns: (column_name, column_type, null, key, default, extra)
        describe = conn.execute(f'DESCRIBE "{table}"').fetchall()

        total_rows: int = conn.execute(
            f'SELECT count(*) FROM "{table}"'
        ).fetchone()[0]

        col_names = [row[0] for row in describe]
        dtype_map = {row[0]: row[1] for row in describe}

        # Null counts for every column in one pass.
        null_exprs = ", ".join(
            f'count(*) FILTER (WHERE "{r[0]}" IS NULL) AS "{r[0]}"'
            for r in describe
        )
        null_row = conn.execute(f'SELECT {null_exprs} FROM "{table}"').fetchone()
        nulls_map = {col_names[i]: null_row[i] for i in range(len(col_names))}

        for col_name, col_type, *_ in describe:
            if _is_numeric_type(col_type):
                row = conn.execute(f"""
                    SELECT
                        avg("{col_name}"),
                        median("{col_name}"),
                        stddev("{col_name}"),
                        min("{col_name}"),
                        max("{col_name}"),
                        percentile_cont(0.25) WITHIN GROUP (ORDER BY "{col_name}"),
                        percentile_cont(0.75) WITHIN GROUP (ORDER BY "{col_name}"),
                        percentile_cont(0.99) WITHIN GROUP (ORDER BY "{col_name}")
                    FROM "{table}"
                """).fetchone()

                column_stats[col_name] = {
                    "type": "numeric",
                    "mean":   _round(row[0]),
                    "median": _round(row[1]),
                    "std":    _round(row[2]),
                    "min":    _round(row[3]),
                    "max":    _round(row[4]),
                    "p25":    _round(row[5]),
                    "p75":    _round(row[6]),
                    "p99":    _round(row[7]),
                }

            else:
                cardinality: int = conn.execute(
                    f'SELECT count(DISTINCT "{col_name}") FROM "{table}"'
                ).fetchone()[0]

                top_rows = conn.execute(f"""
                    SELECT "{col_name}", count(*) AS cnt
                    FROM "{table}"
                    GROUP BY "{col_name}"
                    ORDER BY cnt DESC
                    LIMIT 5
                """).fetchall()

                top_values: List[Dict[str, Any]] = [
                    {"value": str(r[0]) if r[0] is not None else None, "count": r[1]}
                    for r in top_rows
                ]

                column_stats[col_name] = {
                    "type": "categorical",
                    "cardinality": cardinality,
                    "top_values": top_values,
                }

    return {
        "rows": total_rows,
        "columns": col_names,
        "dtype": dtype_map,
        "nulls": nulls_map,
        "column_stats": column_stats,
    }


def compute_quality_report(
    dataset_id: str,
    null_threshold_pct: float = 20.0,
) -> Dict[str, Any]:

    if get_upload(dataset_id) is None:
        raise ValueError(f"Dataset '{dataset_id}' not found.")

    ensure_dataset_loaded(dataset_id)
    table = dataset_table_name(dataset_id)
    column_report: Dict[str, Any] = {}
    flagged: List[str] = []

    with get_ro_connection() as conn:
        total_rows: int = conn.execute(
            f'SELECT count(*) FROM "{table}"'
        ).fetchone()[0]

        # Count duplicate rows: total rows minus distinct rows.
        duplicate_rows: int = total_rows - conn.execute(
            f'SELECT count(*) FROM (SELECT DISTINCT * FROM "{table}")'
        ).fetchone()[0]

        # DESCRIBE gives us column names.
        columns = conn.execute(f'DESCRIBE "{table}"').fetchall()

        for col_name, *_ in columns:
            null_count: int = conn.execute(
                f'SELECT count(*) FROM "{table}" WHERE "{col_name}" IS NULL'
            ).fetchone()[0]

            null_pct = _round(
                (null_count / total_rows * 100) if total_rows > 0 else 0.0
            )
            is_flagged = null_pct is not None and null_pct > null_threshold_pct

            column_report[col_name] = {
                "null_count": null_count,
                "null_pct": null_pct,
                "flagged": is_flagged,
            }

            if is_flagged:
                flagged.append(col_name)

    return {
        "total_rows": total_rows,
        "duplicate_rows": duplicate_rows,
        "null_threshold_pct": null_threshold_pct,
        "flagged_columns": flagged,
        "columns": column_report,
    }
