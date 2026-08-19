from typing import Any, Dict, List

from db.connection import get_ro_connection
from services.anomaly import detect_anomalies
from services.storage import dataset_table_name, get_upload

_DEFAULT_MAX_FLAGGED_PER_COL = 3
_DEFAULT_CONTEXT_WINDOW = 2


def fetch_anomaly_context(
    dataset_id: str,
    method: str = "zscore",
    max_columns: int = 5,
    context_rows: int = _DEFAULT_CONTEXT_WINDOW,
    max_flagged_per_col: int = _DEFAULT_MAX_FLAGGED_PER_COL,
) -> Dict[str, Any]:
    """
    Runs anomaly detection, then fetches the actual row values for the top
    flagged columns so an LLM can reason about causes.

    For each of the top `max_columns` columns (ranked by outlier count):
      - Takes up to `max_flagged_per_col` flagged row indices.
      - Fetches `context_rows` rows before and after each flagged row.
      - Returns all column values per row so the LLM can spot cross-column patterns.

    All fetching is done in a single DuckDB query per column (not one per row).
    """
    if get_upload(dataset_id) is None:
        raise ValueError(f"Dataset '{dataset_id}' not found.")

    anomaly_result = detect_anomalies(dataset_id, method=method)
    per_col = anomaly_result["results"].get(method, {})

    sorted_cols: List[tuple] = sorted(
        [(col, data) for col, data in per_col.items() if data["count"] > 0],
        key=lambda x: x[1]["count"],
        reverse=True,
    )[:max_columns]

    if not sorted_cols:
        return {
            "dataset_id": dataset_id,
            "method": method,
            "columns_analyzed": [],
            "message": "No anomalies detected for any numeric column.",
        }

    table = dataset_table_name(dataset_id)
    columns_analyzed = []

    with get_ro_connection() as conn:
        all_col_names = [row[0] for row in conn.execute(f'DESCRIBE "{table}"').fetchall()]
        result_headers = ["row_idx"] + all_col_names

        for col_name, col_data in sorted_cols:
            sample_indices: List[int] = col_data["flagged_rows"][:max_flagged_per_col]
            total_flagged: int = col_data["count"]

            needed: set = set()
            for fi in sample_indices:
                for offset in range(-context_rows, context_rows + 1):
                    idx = fi + offset
                    if idx >= 0:
                        needed.add(idx)

            if not needed:
                continue

            indices_sql = ", ".join(str(i) for i in sorted(needed))

            rows = conn.execute(f"""
                WITH numbered AS (
                    SELECT row_number() OVER () - 1 AS row_idx, *
                    FROM "{table}"
                )
                SELECT * FROM numbered
                WHERE row_idx IN ({indices_sql})
                ORDER BY row_idx
            """).fetchall()

            flagged_set = set(sample_indices)
            row_lookup: Dict[int, dict] = {
                int(row[0]): dict(zip(result_headers, row))
                for row in rows
            }

            outlier_groups = []
            for fi in sample_indices:
                group: List[dict] = []
                for offset in range(-context_rows, context_rows + 1):
                    idx = fi + offset
                    if idx in row_lookup:
                        entry = row_lookup[idx]
                        group.append({
                            "row_idx":   idx,
                            "is_flagged": idx in flagged_set,
                            "values":    {k: v for k, v in entry.items() if k != "row_idx"},
                        })
                if group:
                    outlier_groups.append({"flagged_row": fi, "rows": group})

            columns_analyzed.append({
                "column":        col_name,
                "total_flagged": total_flagged,
                "showing":       len(sample_indices),
                "outlier_groups": outlier_groups,
            })

    return {
        "dataset_id":       dataset_id,
        "method":           method,
        "columns_analyzed": columns_analyzed,
    }
