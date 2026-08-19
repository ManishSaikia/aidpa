import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from dependencies.auth import get_current_user, AuthUser
from models.analysis_result import AnalysisResult
from models.base import APIResponse
from services.analysis_result import build_analysis_result
from services.anomaly import detect_anomalies
from services.jobs import create_job, run_in_background
from services.stats import compute_column_stats, compute_quality_report
from services.storage import get_upload, get_all_uploads

router = APIRouter(prefix="/datasets", tags=["datasets"])


def _require_ownership(dataset_id: str, user_id: str) -> None:
    """Raises 404 if dataset_id does not belong to user_id."""
    if get_upload(dataset_id, user_id=user_id) is None:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/stats", response_model=APIResponse[dict])
async def get_dataset_stats(
    dataset_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    _require_ownership(dataset_id, current_user.user_id)
    try:
        stats = await asyncio.to_thread(compute_column_stats, dataset_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return APIResponse(success=True, data=stats, error=None)


# ── Quality ───────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/quality", response_model=APIResponse[dict])
async def get_dataset_quality(
    dataset_id: str,
    null_threshold: float = Query(
        default=20.0,
        ge=0.0,
        le=100.0,
        description="Flag columns whose null % exceeds this value (0–100).",
    ),
    current_user: AuthUser = Depends(get_current_user),
):
    _require_ownership(dataset_id, current_user.user_id)
    try:
        report = await asyncio.to_thread(
            compute_quality_report, dataset_id, null_threshold
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return APIResponse(success=True, data=report, error=None)


# ── Anomalies ─────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/anomalies", response_model=APIResponse[dict])
async def get_dataset_anomalies(
    dataset_id: str,
    method: Optional[str] = Query(
        default=None,
        description="Detection method: 'zscore', 'iqr', or omit to run both.",
    ),
    current_user: AuthUser = Depends(get_current_user),
):
    _require_ownership(dataset_id, current_user.user_id)
    try:
        report = await asyncio.to_thread(detect_anomalies, dataset_id, method)
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc))

    return APIResponse(success=True, data=report, error=None)


# ── Analysis (sync — waits for result) ───────────────────────────────────────

@router.get("/{dataset_id}/analysis", response_model=APIResponse[AnalysisResult])
async def get_dataset_analysis(
    dataset_id: str,
    null_threshold: float = Query(
        default=20.0,
        ge=0.0,
        le=100.0,
        description="Null % threshold for flagging columns (0–100).",
    ),
    current_user: AuthUser = Depends(get_current_user),
):
    _require_ownership(dataset_id, current_user.user_id)
    try:
        result = await asyncio.to_thread(
            build_analysis_result, dataset_id, null_threshold
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return APIResponse(success=True, data=result, error=None)


# ── Analysis (async — returns job_id immediately) ─────────────────────────────

@router.post("/{dataset_id}/analysis/run", response_model=APIResponse[dict])
async def run_dataset_analysis(
    dataset_id: str,
    null_threshold: float = Query(
        default=20.0,
        ge=0.0,
        le=100.0,
        description="Null % threshold for flagging columns (0–100).",
    ),
    current_user: AuthUser = Depends(get_current_user),
):
    """Fire-and-forget analysis. Returns a job_id immediately."""
    _require_ownership(dataset_id, current_user.user_id)

    job = create_job()
    asyncio.create_task(
        run_in_background(job, build_analysis_result, dataset_id, null_threshold)
    )

    return APIResponse(
        success=True,
        data={"job_id": job.job_id, "status": job.status},
        error=None,
    )


# ── Dataset metadata (user-scoped) ────────────────────────────────────────────

@router.get("/", response_model=APIResponse[list])
async def list_datasets(current_user: AuthUser = Depends(get_current_user)):
    """Return datasets belonging to the calling user, newest first."""
    datasets = get_all_uploads(user_id=current_user.user_id)
    return APIResponse(success=True, data=datasets, error=None)


@router.get("/{dataset_id}", response_model=APIResponse[dict])
async def get_dataset(
    dataset_id: str,
    current_user: AuthUser = Depends(get_current_user),
):
    """Return metadata for a single dataset. Returns 404 if not owned by the caller."""
    dataset = get_upload(dataset_id, user_id=current_user.user_id)

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' not found.",
        )

    return APIResponse(success=True, data=dataset, error=None)
