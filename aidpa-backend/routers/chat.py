import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from dependencies.auth import get_current_user, AuthUser
from models.chat import ChatRequest, ExplainAnomaliesRequest, NarrateRequest
from services.analysis_result import build_analysis_result
from services.anomaly_explain import fetch_anomaly_context
from services.claude import (
    stream_analysis_response,
    stream_anomaly_explanation_response,
    stream_narration_response,
)
from services.storage import get_upload

router = APIRouter(prefix="/chat", tags=["chat"])


def _require_dataset_ownership(dataset_id: str, user_id: str) -> None:
    """Raises 404 if dataset_id does not belong to user_id."""
    if get_upload(dataset_id, user_id=user_id) is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")


@router.post("/stream")
async def stream_chat(
    request: ChatRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    _require_dataset_ownership(request.dataset_id, current_user.user_id)
    try:
        analysis = await asyncio.to_thread(
            build_analysis_result,
            request.dataset_id,
            request.null_threshold,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return StreamingResponse(
        stream_analysis_response(analysis, request.question),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/narrate")
async def narrate_dataset(
    request: NarrateRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    _require_dataset_ownership(request.dataset_id, current_user.user_id)
    try:
        analysis = await asyncio.to_thread(
            build_analysis_result,
            request.dataset_id,
            request.null_threshold,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return StreamingResponse(
        stream_narration_response(analysis),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/explain-anomalies")
async def explain_anomalies(
    request: ExplainAnomaliesRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    if request.method not in ("zscore", "iqr"):
        raise HTTPException(
            status_code=400,
            detail="method must be 'zscore' or 'iqr'.",
        )
    _require_dataset_ownership(request.dataset_id, current_user.user_id)

    try:
        analysis, anomaly_context = await asyncio.gather(
            asyncio.to_thread(
                build_analysis_result,
                request.dataset_id,
                request.null_threshold,
            ),
            asyncio.to_thread(
                fetch_anomaly_context,
                request.dataset_id,
                request.method,
                request.max_columns,
                request.context_rows,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return StreamingResponse(
        stream_anomaly_explanation_response(analysis, anomaly_context),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
