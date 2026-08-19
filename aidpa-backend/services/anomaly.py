from typing import Any, Dict, List, Optional

from db.connection import get_ro_connection
from services.storage import dataset_table_name, get_upload

# DuckDB type substrings that indicate a numeric column.
_NUMERIC_TYPE_MARKERS = ("INT", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL", "HUGEINT")


def _is_numeric_type(duckdb_type: str) -> bool:
    return any(marker in duckdb_type.upper() for marker in _NUMERIC_TYPE_MARKERS)


def _cols_expr(numeric_cols: List[str]) -> str:
    """Comma-separated quoted column names for use in SQL."""
    return ", ".join(f'"{c}"' for c in numeric_cols)


def _zscore_all_cols(conn, table: str, numeric_cols: List[str]) -> Dict[str, List[int]]:
    """
    Per-column Z-score detection using window functions and CROSS JOIN stats.
    Flags rows where |z| > 3. Skips columns with std = 0.

    Replaces the UNPIVOT-based approach which caused a DuckDB parser error
    when UNPIVOT referenced another CTE as its source inside a CTE chain.
    """
    result: Dict[str, List[int]] = {c: [] for c in numeric_cols}

    for col in numeric_cols:
        rows = conn.execute(f"""
            WITH stats AS (
                SELECT avg("{col}") AS mean, stddev("{col}") AS std
                FROM "{table}"
            )
            SELECT row_idx
            FROM (
                SELECT row_number() OVER () - 1 AS row_idx, "{col}" AS val
                FROM "{table}"
            ) t
            CROSS JOIN stats
            WHERE val IS NOT NULL
              AND std > 0
              AND abs((val - mean) / std) > 3
            ORDER BY row_idx
        """).fetchall()
        result[col] = [int(r[0]) for r in rows]

    return result


def _iqr_all_cols(conn, table: str, numeric_cols: List[str]) -> Dict[str, List[int]]:
    """
    Per-column IQR detection using percentile aggregation and CROSS JOIN.
    Flags rows outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]. Skips columns with IQR = 0.

    Same replacement rationale as _zscore_all_cols above.
    """
    result: Dict[str, List[int]] = {c: [] for c in numeric_cols}

    for col in numeric_cols:
        rows = conn.execute(f"""
            WITH stats AS (
                SELECT
                    percentile_cont(0.25) WITHIN GROUP (ORDER BY "{col}") AS q1,
                    percentile_cont(0.75) WITHIN GROUP (ORDER BY "{col}") AS q3
                FROM "{table}"
                WHERE "{col}" IS NOT NULL
            )
            SELECT row_idx
            FROM (
                SELECT row_number() OVER () - 1 AS row_idx, "{col}" AS val
                FROM "{table}"
            ) t
            CROSS JOIN stats
            WHERE val IS NOT NULL
              AND (q3 - q1) > 0
              AND (val < q1 - 1.5 * (q3 - q1) OR val > q3 + 1.5 * (q3 - q1))
            ORDER BY row_idx
        """).fetchall()
        result[col] = [int(r[0]) for r in rows]

    return result


def detect_anomalies(
    dataset_id: str,
    method: Optional[str] = None,
) -> Dict[str, Any]:

    if get_upload(dataset_id) is None:
        raise ValueError(f"Dataset '{dataset_id}' not found.")

    allowed_methods = {"zscore", "iqr"}
    if method is not None and method not in allowed_methods:
        raise ValueError(
            f"Unknown method '{method}'. Choose from: {', '.join(sorted(allowed_methods))}"
        )

    methods_to_run = allowed_methods if method is None else {method}
    table = dataset_table_name(dataset_id)
    results: Dict[str, Any] = {}

    with get_ro_connection() as conn:
        describe = conn.execute(f'DESCRIBE "{table}"').fetchall()
        numeric_cols = [
            col_name
            for col_name, col_type, *_ in describe
            if _is_numeric_type(col_type)
        ]

        for m in sorted(methods_to_run):
            if m == "zscore":
                flagged_map = _zscore_all_cols(conn, table, numeric_cols)
            else:
                flagged_map = _iqr_all_cols(conn, table, numeric_cols)

            results[m] = {
                col: {"flagged_rows": indices, "count": len(indices)}
                for col, indices in flagged_map.items()
            }

    return {
        "dataset_id": dataset_id,
        "numeric_columns_checked": numeric_cols,
        "methods_applied": sorted(methods_to_run),
        "results": results,
    }
