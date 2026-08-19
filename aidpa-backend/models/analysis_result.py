from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ColumnSummary(BaseModel):

    inferred_type: str = Field(
        description="Semantic type: 'numeric' or 'categorical'."
    )
    null_count: int = Field(description="Number of null values in this column.")
    null_pct: float = Field(description="Percentage of null values (0–100).")
    flagged_quality: bool = Field(
        description="True if null_pct exceeds the dataset's null threshold."
    )

    # ── Numeric columns only ──────────────────────────────────────────────
    mean: Optional[float] = None
    std: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    zscore_outlier_count: Optional[int] = Field(
        default=None,
        description="Rows where |z-score| > 3.",
    )
    zscore_outlier_pct: Optional[float] = Field(
        default=None,
        description="Percentage of rows flagged by Z-score.",
    )
    iqr_outlier_count: Optional[int] = Field(
        default=None,
        description="Rows outside IQR fences.",
    )
    iqr_outlier_pct: Optional[float] = Field(
        default=None,
        description="Percentage of rows flagged by IQR.",
    )

    # ── Categorical columns only ──────────────────────────────────────────
    cardinality: Optional[int] = Field(
        default=None,
        description="Number of distinct values.",
    )
    top_values: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Top 5 most frequent values with counts.",
    )


class AnalysisResult(BaseModel):
    dataset_id: str
    filename: str

    # ── Dataset overview ─────────────────────────────────────────────────
    total_rows: int
    total_columns: int
    numeric_columns: int
    categorical_columns: int

    # ── Quality summary ──────────────────────────────────────────────────
    duplicate_rows: int
    null_threshold_pct: float = Field(
        description="Threshold used to flag high-null columns."
    )
    high_null_columns: List[str] = Field(
        description="Column names whose null % exceeds null_threshold_pct."
    )

    # ── Per-column digest ─────────────────────────────────────────────────
    columns: Dict[str, ColumnSummary]
