"""
Converts an AnalysisResult into a compact plain-text digest suitable for embedding.

The digest is designed to be dense with signal:
  - Dataset shape (rows, columns, types)
  - Quality issues (duplicates, high-null columns)
  - Per numeric column: mean, std, min, max, outlier rates
  - Per categorical column: cardinality, top values
  - Columns flagged for quality issues

This text is what gets embedded — its quality directly determines how well
semantic similarity search works.
"""

from models.analysis_result import AnalysisResult


def build_text_digest(analysis: AnalysisResult) -> str:
    lines = []

    # ── Dataset overview ────────────────────────────────────────────────────
    lines.append(
        f"Dataset: {analysis.filename} | "
        f"Rows: {analysis.total_rows:,} | "
        f"Columns: {analysis.total_columns} | "
        f"Numeric: {analysis.numeric_columns} | "
        f"Categorical: {analysis.categorical_columns}"
    )

    if analysis.duplicate_rows > 0:
        pct = round(analysis.duplicate_rows / analysis.total_rows * 100, 1)
        lines.append(f"Duplicate rows: {analysis.duplicate_rows:,} ({pct}%)")

    if analysis.high_null_columns:
        lines.append(
            f"High-null columns (>{analysis.null_threshold_pct}% missing): "
            + ", ".join(analysis.high_null_columns)
        )

    # ── Numeric columns ─────────────────────────────────────────────────────
    numeric_lines = []
    for col_name, col in analysis.columns.items():
        if col.inferred_type != "numeric":
            continue

        parts = [f"{col_name} [numeric]"]

        if col.mean is not None:
            parts.append(
                f"mean={round(col.mean, 2)} std={round(col.std or 0, 2)} "
                f"min={round(col.min or 0, 2)} max={round(col.max or 0, 2)}"
            )
        if col.null_pct and col.null_pct > 0:
            parts.append(f"nulls={col.null_pct}%")
        if col.zscore_outlier_count:
            parts.append(f"zscore_outliers={col.zscore_outlier_count}({col.zscore_outlier_pct}%)")
        if col.iqr_outlier_count:
            parts.append(f"iqr_outliers={col.iqr_outlier_count}({col.iqr_outlier_pct}%)")

        numeric_lines.append(" | ".join(parts))

    if numeric_lines:
        lines.append("Numeric columns:")
        lines.extend(f"  {l}" for l in numeric_lines)

    # ── Categorical columns ─────────────────────────────────────────────────
    cat_lines = []
    for col_name, col in analysis.columns.items():
        if col.inferred_type != "categorical":
            continue

        parts = [f"{col_name} [categorical] cardinality={col.cardinality}"]

        if col.null_pct and col.null_pct > 0:
            parts.append(f"nulls={col.null_pct}%")
        if col.top_values:
            top = ", ".join(
                f"{v['value']}({v['count']})" for v in col.top_values[:3]
            )
            parts.append(f"top_values=[{top}]")

        cat_lines.append(" | ".join(parts))

    if cat_lines:
        lines.append("Categorical columns:")
        lines.extend(f"  {l}" for l in cat_lines)

    return "\n".join(lines)
