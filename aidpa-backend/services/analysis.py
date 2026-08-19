import io
import pandas as pd
from typing import Dict, Any

# Encodings to try in order when reading the CSV bytes.
_ENCODINGS = ("utf-8", "utf-8-sig", "latin-1", "cp1252")

# Columns with fewer unique values than this threshold are labelled categorical.
_CATEGORICAL_CARDINALITY_THRESHOLD = 20


def infer_schema(df: pd.DataFrame) -> Dict[str, str]:
    """
    Classifies each column into one of four semantic types:
      - "numeric"     : integer or float columns.
      - "datetime"    : columns pandas parsed as datetime, or object columns
                        whose values can be coerced to dates.
      - "categorical" : object columns whose unique-value count is below
                        _CATEGORICAL_CARDINALITY_THRESHOLD.
      - "free-text"   : object columns with high cardinality (open-ended strings).
    """
    schema: Dict[str, str] = {}

    for col in df.columns:
        dtype = df[col].dtype

        if pd.api.types.is_numeric_dtype(dtype):
            schema[col] = "numeric"

        elif pd.api.types.is_datetime64_any_dtype(dtype):
            schema[col] = "datetime"

        else:
            # dtype is object (string) — apply heuristics.
            sample = df[col].dropna()

            # Try coercing to datetime before checking cardinality.
            try:
                pd.to_datetime(sample, infer_datetime_format=True)
                schema[col] = "datetime"
                continue
            except (ValueError, TypeError):
                pass

            unique_count = df[col].nunique(dropna=True)
            if unique_count < _CATEGORICAL_CARDINALITY_THRESHOLD:
                schema[col] = "categorical"
            else:
                schema[col] = "free-text"

    return schema


def analyze_csv_data(contents: bytes, filename: str) -> Dict[str, Any]:

    df = None
    last_error: Exception = UnicodeDecodeError("unknown", b"", 0, 1, "no encoding succeeded")

    for encoding in _ENCODINGS:
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding=encoding)
            break
        except UnicodeDecodeError as exc:
            last_error = exc
            continue

    if df is None:
        raise last_error

    return {
        "message": "CSV upload successful.",
        "filename": filename,
        "columns": df.columns.tolist(),
        "rows": len(df),
        "dtype": df.dtypes.astype(str).to_dict(),
        "nulls": df.isnull().sum().to_dict(),
        "schema": infer_schema(df),
    }
