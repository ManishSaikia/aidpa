from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    dataset_id: str = Field(description="UUID of the uploaded dataset.")
    question: str = Field(description="The user's question about the dataset.")
    null_threshold: float = Field(
        default=20.0,
        ge=0.0,
        le=100.0,
        description="Null % threshold used when building the analysis digest.",
    )


class NarrateRequest(BaseModel):
    dataset_id: str = Field(description="UUID of the uploaded dataset.")
    null_threshold: float = Field(
        default=20.0,
        ge=0.0,
        le=100.0,
        description="Null % threshold used when building the analysis digest.",
    )


class ExplainAnomaliesRequest(BaseModel):
    dataset_id: str = Field(description="UUID of the uploaded dataset.")
    method: str = Field(
        default="zscore",
        description="Detection method: 'zscore' or 'iqr'.",
    )
    max_columns: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Max anomalous columns to explain (cost control).",
    )
    context_rows: int = Field(
        default=2,
        ge=0,
        le=5,
        description="Rows before/after each flagged row to include as context.",
    )
    null_threshold: float = Field(
        default=20.0,
        ge=0.0,
        le=100.0,
        description="Null % threshold for the analysis digest.",
    )
