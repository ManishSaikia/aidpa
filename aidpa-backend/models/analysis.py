from pydantic import BaseModel, Field
from typing import List, Dict, Annotated

class UploadAnalysisResponse(BaseModel):
    dataset_id: Annotated[str, Field(description="Unique identifier for this upload. Use for all subsequent calls.")]
    message: Annotated[str, Field(description="The message to be returned.")]
    filename: Annotated[str, Field(description="The filename of the uploaded file.")]
    columns: Annotated[List[str], Field(description="The columns of the uploaded file.")]
    rows: Annotated[int, Field(description="The number of rows in the uploaded file.")]
    dtype: Annotated[Dict[str, str], Field(description="The data types of the columns in the uploaded file.")]
    nulls: Annotated[Dict[str, int], Field(description="The number of nulls in the columns of the uploaded file.")]
    schema: Annotated[Dict[str, str], Field(description="Inferred semantic type per column: numeric, categorical, datetime, or free-text.")]
