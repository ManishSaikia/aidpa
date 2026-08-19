from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class EmbedResponse(BaseModel):
    dataset_id: str
    filename: str
    digest_preview: str = Field(
        description="First 300 characters of the text that was embedded."
    )
    embedding_dims: int = Field(description="Number of dimensions in the embedding vector.")
    message: str


class SimilarDataset(BaseModel):
    dataset_id: str
    filename: str
    similarity: float = Field(description="Cosine similarity (0–1). Higher = more similar.")
    text_digest: str


class SimilarDatasetsResponse(BaseModel):
    query_dataset_id: str
    results: List[SimilarDataset]


class PruneResponse(BaseModel):
    deleted_count: int
    older_than_days: int
    message: str
