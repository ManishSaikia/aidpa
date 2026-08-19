from fastapi import APIRouter, HTTPException
from models.base import APIResponse
from services.jobs import get_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=APIResponse[dict])
async def get_job_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    return APIResponse(
        success=True,
        data={
            "job_id": job.job_id,
            "status": job.status,
            "result": job.result,
            "error":  job.error,
        },
        error=None,
    )
