import asyncio
import uuid
from enum import Enum
from typing import Any, Dict, Optional


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE    = "done"
    FAILED  = "failed"


class Job:
    def __init__(self, job_id: str) -> None:
        self.job_id  = job_id
        self.status  = JobStatus.PENDING
        self.result: Optional[Any]  = None
        self.error:  Optional[str]  = None


# In-memory job store. Replace with Redis / DB for multi-process deployments.
_jobs: Dict[str, Job] = {}


def create_job() -> Job:
    job = Job(str(uuid.uuid4()))
    _jobs[job.job_id] = job
    return job


def get_job(job_id: str) -> Optional[Job]:
    return _jobs.get(job_id)


async def run_in_background(job: Job, fn, *args, **kwargs) -> None:
    job.status = JobStatus.RUNNING
    try:
        result = await asyncio.to_thread(fn, *args, **kwargs)
        job.status = JobStatus.DONE
        job.result = result.model_dump() if hasattr(result, "model_dump") else result
    except Exception as exc:
        job.status = JobStatus.FAILED
        job.error  = str(exc)
