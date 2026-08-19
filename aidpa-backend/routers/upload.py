import asyncio

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
import pandas as pd

from dependencies.auth import get_current_user, AuthUser
from models.analysis import UploadAnalysisResponse
from models.base import APIResponse
from services.analysis import analyze_csv_data
from services.audit import log_event
from services.storage import QuotaExceededError, check_user_quota, save_upload

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"text/csv", "application/octet-stream"}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB per file


@router.post("/upload", response_model=APIResponse[UploadAnalysisResponse])
async def upload_csv(
    file: UploadFile = File(..., description="The CSV file to upload."),
    current_user: AuthUser = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid content type '{file.content_type}'. Must be text/csv or application/octet-stream.",
        )

    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    # ── Quota gate ────────────────────────────────────────────────────────────
    try:
        await asyncio.to_thread(check_user_quota, current_user.user_id, len(contents))
    except QuotaExceededError as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    # ── Ingest ────────────────────────────────────────────────────────────────
    try:
        analysis_result = analyze_csv_data(contents, file.filename)
        dataset_id = save_upload(contents, file.filename, user_id=current_user.user_id)
    except (ValueError, UnicodeDecodeError, pd.errors.ParserError, pd.errors.EmptyDataError) as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(exc)}")

    # ── Audit log (fire-and-forget) ───────────────────────────────────────────
    asyncio.create_task(
        asyncio.to_thread(
            log_event,
            current_user.user_id,
            "dataset.upload",
            dataset_id,
            "dataset",
            {"filename": file.filename, "size_bytes": len(contents)},
        )
    )

    return APIResponse(
        success=True,
        data=UploadAnalysisResponse(dataset_id=dataset_id, **analysis_result),
        error=None,
    )
