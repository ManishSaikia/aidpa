import asyncio
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from dependencies.auth import get_current_user, AuthUser
from models.query import PaginateRequest, QueryHistoryRecord, QueryRequest, QueryResponse
from services.audit import log_event
from services.query_history import list_queries, save_failed_query, save_query
from services.text_to_sql import execute_raw_sql, generate_and_execute

router = APIRouter(prefix="/query", tags=["query"])
log = logging.getLogger("aidpa.query")

_PIPELINE_TIMEOUT_SECONDS = 60


@router.post("", response_model=QueryResponse)
async def run_text_to_sql(
    request: QueryRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                generate_and_execute,
                request.dataset_id,
                request.question,
                request.page,
                request.page_size,
            ),
            timeout=_PIPELINE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        msg = (
            f"Request timed out after {_PIPELINE_TIMEOUT_SECONDS}s. "
            "Try a simpler question or add more specific filters."
        )
        asyncio.create_task(
            asyncio.to_thread(
                save_failed_query,
                request.dataset_id, request.question, msg,
                current_user.user_id,
            )
        )
        asyncio.create_task(
            asyncio.to_thread(
                log_event,
                current_user.user_id, "query.failed",
                request.dataset_id, "dataset",
                {"question": request.question, "reason": "timeout"},
            )
        )
        raise HTTPException(status_code=408, detail=msg)
    except TimeoutError as exc:
        asyncio.create_task(
            asyncio.to_thread(
                save_failed_query,
                request.dataset_id, request.question, str(exc),
                current_user.user_id,
            )
        )
        asyncio.create_task(
            asyncio.to_thread(
                log_event,
                current_user.user_id, "query.failed",
                request.dataset_id, "dataset",
                {"question": request.question, "reason": str(exc)},
            )
        )
        raise HTTPException(status_code=408, detail=str(exc))
    except ValueError as exc:
        asyncio.create_task(
            asyncio.to_thread(
                save_failed_query,
                request.dataset_id, request.question, str(exc),
                current_user.user_id,
            )
        )
        asyncio.create_task(
            asyncio.to_thread(
                log_event,
                current_user.user_id, "query.failed",
                request.dataset_id, "dataset",
                {"question": request.question, "reason": str(exc)},
            )
        )
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Success — persist history + audit (both fire-and-forget)
    asyncio.create_task(
        asyncio.to_thread(
            save_query,
            request.dataset_id,
            request.question,
            result["sql"],
            result.get("explanation"),
            result["total_count"],
            result["total_pages"],
            result["page_size"],
            current_user.user_id,
        )
    )
    asyncio.create_task(
        asyncio.to_thread(
            log_event,
            current_user.user_id, "query.execute",
            request.dataset_id, "dataset",
            {"question": request.question, "row_count": result["total_count"]},
        )
    )

    return QueryResponse(**result)


@router.post("/execute", response_model=QueryResponse)
async def paginate_query(
    request: PaginateRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                execute_raw_sql,
                request.dataset_id,
                request.sql,
                request.page,
                request.page_size,
            ),
            timeout=_PIPELINE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=408,
            detail=(
                f"Query timed out after {_PIPELINE_TIMEOUT_SECONDS}s. "
                "Try a simpler question or add more specific filters."
            ),
        )
    except TimeoutError as exc:
        raise HTTPException(status_code=408, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return QueryResponse(**result)


@router.get("/history", response_model=List[QueryHistoryRecord])
async def get_query_history(
    dataset_id: str = Query(..., description="Filter history by dataset UUID."),
    current_user: AuthUser = Depends(get_current_user),
):
    """Return past Ask queries for a dataset belonging to the calling user, newest first."""
    records = await asyncio.to_thread(list_queries, dataset_id, current_user.user_id)
    return [QueryHistoryRecord(**r) for r in records]
