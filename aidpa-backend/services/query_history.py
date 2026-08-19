import logging
from typing import Any, Dict, List, Optional

from db.pg_connection import get_supabase_client

_TABLE = "query_history"
log = logging.getLogger("aidpa.query_history")


def save_query(
    dataset_id: str,
    question: str,
    sql: str,
    explanation: Optional[str],
    total_count: int,
    total_pages: int,
    page_size: int,
    user_id: Optional[str] = None,
) -> str:
    """Persist a successful Ask query. Returns the new UUID."""
    sb = get_supabase_client()
    row: Dict[str, Any] = {
        "dataset_id":  dataset_id,
        "question":    question,
        "sql_query":   sql,
        "explanation": explanation,
        "total_count": total_count,
        "total_pages": total_pages,
        "page_size":   page_size,
        "is_error":    False,
    }
    if user_id:
        row["user_id"] = user_id
    resp = sb.table(_TABLE).insert(row).execute()
    new_id = resp.data[0]["id"] if resp.data else None
    log.info("Query history saved | dataset=%s id=%s", dataset_id, new_id)
    return new_id


def save_failed_query(
    dataset_id: str,
    question: str,
    error_message: str,
    user_id: Optional[str] = None,
) -> str:
    """Persist a failed Ask query so it appears in history with an error badge."""
    sb = get_supabase_client()
    row: Dict[str, Any] = {
        "dataset_id":    dataset_id,
        "question":      question,
        "is_error":      True,
        "error_message": error_message,
    }
    if user_id:
        row["user_id"] = user_id
    resp = sb.table(_TABLE).insert(row).execute()
    new_id = resp.data[0]["id"] if resp.data else None
    log.info("Failed query saved | dataset=%s id=%s", dataset_id, new_id)
    return new_id


def list_queries(dataset_id: str, user_id: str | None = None) -> List[Dict[str, Any]]:
    """
    Return all queries for a dataset ordered newest-first.
    When user_id is provided, only that user's records are returned.
    """
    sb = get_supabase_client()
    q = (
        sb.table(_TABLE)
        .select(
            "id, question, sql_query, explanation, "
            "total_count, total_pages, page_size, "
            "is_error, error_message, created_at"
        )
        .eq("dataset_id", dataset_id)
        .order("created_at", desc=True)
    )
    if user_id:
        q = q.eq("user_id", user_id)
    resp = q.execute()
    return resp.data or []
