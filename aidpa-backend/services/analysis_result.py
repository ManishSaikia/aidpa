from typing import Dict

from models.analysis_result import AnalysisResult, ColumnSummary
from services.anomaly import detect_anomalies
from services.stats import compute_column_stats, compute_quality_report
from services.storage import get_upload


def build_analysis_result(
    dataset_id: str,
    null_threshold_pct: float = 20.0,
) -> AnalysisResult:
    meta = get_upload(dataset_id)
    if meta is None:
        raise ValueError(f"Dataset '{dataset_id}' not found.")

    # ── Gather raw outputs from each service ─────────────────────────────
    stats = compute_column_stats(dataset_id)
    quality = compute_quality_report(dataset_id, null_threshold_pct=null_threshold_pct)
    anomalies = detect_anomalies(dataset_id)  # runs both zscore + iqr

    total_rows: int = stats["rows"]
    col_names = stats["columns"]
    column_stats = stats["column_stats"]
    nulls_map = stats["nulls"]
    quality_col_map = quality["columns"]
    zscore_results = anomalies["results"].get("zscore", {})
    iqr_results = anomalies["results"].get("iqr", {})

    # ── Build per-column summaries ────────────────────────────────────────
    columns: Dict[str, ColumnSummary] = {}
    numeric_count = 0
    categorical_count = 0

    for col in col_names:
        cs = column_stats[col]
        col_type: str = cs["type"]
        null_count: int = nulls_map[col]
        null_pct = round(
            (null_count / total_rows * 100) if total_rows > 0 else 0.0, 4
        )
        flagged: bool = quality_col_map[col]["flagged"]

        if col_type == "numeric":
            numeric_count += 1
            zs_count: int = zscore_results.get(col, {}).get("count", 0)
            iq_count: int = iqr_results.get(col, {}).get("count", 0)

            columns[col] = ColumnSummary(
                inferred_type="numeric",
                null_count=null_count,
                null_pct=null_pct,
                flagged_quality=flagged,
                mean=cs["mean"],
                std=cs["std"],
                min=cs["min"],
                max=cs["max"],
                zscore_outlier_count=zs_count,
                zscore_outlier_pct=round(
                    zs_count / total_rows * 100 if total_rows > 0 else 0.0, 4
                ),
                iqr_outlier_count=iq_count,
                iqr_outlier_pct=round(
                    iq_count / total_rows * 100 if total_rows > 0 else 0.0, 4
                ),
            )
        else:
            categorical_count += 1
            columns[col] = ColumnSummary(
                inferred_type="categorical",
                null_count=null_count,
                null_pct=null_pct,
                flagged_quality=flagged,
                cardinality=cs["cardinality"],
                top_values=cs["top_values"],
            )

    return AnalysisResult(
        dataset_id=dataset_id,
        filename=meta["filename"],
        total_rows=total_rows,
        total_columns=len(col_names),
        numeric_columns=numeric_count,
        categorical_columns=categorical_count,
        duplicate_rows=quality["duplicate_rows"],
        null_threshold_pct=null_threshold_pct,
        high_null_columns=quality["flagged_columns"],
        columns=columns,
    )
