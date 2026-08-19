from math import ceil
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    dataset_id: str = Field(description="UUID of the uploaded dataset.")
    question:   str = Field(description="Plain-English question to answer with SQL.")
    page:       int = Field(default=1,   ge=1,    description="Page number (1-indexed).")
    page_size:  int = Field(default=10, ge=1, le=500, description="Rows per page.")


class PaginateRequest(BaseModel):
    dataset_id: str = Field(description="UUID of the dataset (used for table-name guard).")
    sql:        str = Field(description="SQL cached from the initial page-1 response.")
    page:       int = Field(default=1,   ge=1,    description="Page number (1-indexed).")
    page_size:  int = Field(default=10, ge=1, le=500, description="Rows per page.")


class QueryResponse(BaseModel):
    sql:         str                      = Field(description="The generated DuckDB SELECT query.")
    columns:     List[str]                = Field(description="Column names in the result set.")
    rows:        List[dict[str, Any]]     = Field(description="Query result rows for this page.")
    row_count:   int                      = Field(description="Number of rows on this page.")
    total_count: int                      = Field(description="Total rows matching the full query.")
    page:        int                      = Field(description="Current page number.")
    page_size:   int                      = Field(description="Rows per page.")
    total_pages: int                      = Field(description="ceil(total_count / page_size).")
    explanation: Optional[str]            = Field(
        default=None,
        description=(
            "Plain-English explanation of the results. "
            "Populated on page 1 only; null on subsequent pages."
        ),
    )


class QueryHistoryRecord(BaseModel):
    id: str
    question: str
    sql_query: Optional[str]   = None
    explanation: Optional[str] = None
    total_count: Optional[int] = None
    total_pages: Optional[int] = None
    page_size:   Optional[int] = None
    is_error:    bool          = False
    error_message: Optional[str] = None
    created_at: str
