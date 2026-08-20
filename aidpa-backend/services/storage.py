import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Optional

from db.connection import get_db_connection
from db.pg_connection import get_supabase_client
from services.audit import log_event
from services.ingestion import (
    _STORAGE_BUCKET,
    ensure_dataset_loaded,
    ingest_dataset,
)

log = logging.getLogger("aidpa.storage")

_UPLOAD_DIR = Path(tempfile.gettempdir()) / "aidpa_uploads"

_BASIC_FIELDS = "dataset_id,filename,path,size_bytes,row_count,column_count,columns,sample_rows,date_columns_corrected,ingested_at,user_id"


def dataset_table_name(dataset_id: str) -> str:
    return "ds_" + dataset_id.replace("-", "_")


# -- Quota --

_QUOTA_MB = int(os.getenv("USER_STORAGE_QUOTA_MB", "500"))
USER_QUOTA_BYTES = _QUOTA_MB * 1024 * 1024


class QuotaExceededError(Exception):
    def __init__(self, used_bytes: int, quota_bytes: int, file_bytes: int):
        self.used_bytes = used_bytes
        self.quota_bytes = quota_bytes
        self.file_bytes = file_bytes
        super().__init__(self._build_message())

    def _fmt(self, b: int) -> str:
        return f"{b / (1024 * 1024):.1f} MB"

    def _build_message(self) -> str:
        return (
            f"Storage quota exceeded. "
            f"You have used {self._fmt(self.used_bytes)} of your {self._fmt(self.quota_bytes)} limit. "
            f"This file ({self._fmt(self.file_bytes)}) would bring your total to "
            f"{self._fmt(self.used_bytes + self.file_bytes)}. "
            f"Delete some datasets to free up space."
        )


def get_user_storage_used(user_id: str) -> int:
    """Return the total bytes stored across all datasets owned by user_id."""
    sb = get_supabase_client()
    resp = (
        sb.table("datasets")
        .select("size_bytes")
        .eq("user_id", user_id)
        .execute()
    )
    return sum((row.get("size_bytes") or 0) for row in (resp.data or []))


def check_user_quota(user_id: str, new_file_bytes: int) -> None:
    used = get_user_storage_used(user_id)
    if used + new_file_bytes > USER_QUOTA_BYTES:
        raise QuotaExceededError(used, USER_QUOTA_BYTES, new_file_bytes)


# -- Write --

def save_upload(contents: bytes, filename: str, user_id: str | None = None) -> str:
    return ingest_dataset(contents, filename, user_id=user_id)


# -- Read --

def get_upload(dataset_id: str, user_id: str | None = None) -> Optional[dict[str, Any]]:
    sb = get_supabase_client()
    q = (
        sb.table("datasets")
        .select(_BASIC_FIELDS)
        .eq("dataset_id", dataset_id)
    )
    if user_id:
        q = q.eq("user_id", user_id)
    resp = q.maybe_single().execute()
    if resp.data is None:
        log.debug("Dataset '%s' not found (user=%s).", dataset_id, user_id)
        return None
    return resp.data


def get_all_uploads(user_id: str | None = None) -> list[dict[str, Any]]:
    sb = get_supabase_client()
    q = sb.table("datasets").select(_BASIC_FIELDS).order("ingested_at", desc=True)
    if user_id:
        q = q.eq("user_id", user_id)
    resp = q.execute()
    return resp.data or []


# -- Delete --

def delete_dataset(dataset_id: str, user_id: str | None = None) -> dict[str, Any]:
    from services.agent import clear_session

    dataset = get_upload(dataset_id, user_id=user_id)
    if dataset is None:
        raise ValueError(f"Dataset '{dataset_id}' not found.")

    sb = get_supabase_client()
    summary: dict[str, Any] = {"dataset_id": dataset_id}

    # Drop DuckDB table
    table_name = dataset_table_name(dataset_id)
    try:
        with get_db_connection() as conn:
            conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
        summary["duckdb_table_dropped"] = True
    except Exception as exc:
        log.warning("Failed to drop DuckDB table '%s': %s", table_name, exc)
        summary["duckdb_table_dropped"] = False

    # Delete local temp CSV
    local_file = _UPLOAD_DIR / f"{dataset_id}.csv"
    if local_file.exists():
        try:
            local_file.unlink()
            summary["local_file_deleted"] = True
        except Exception as exc:
            log.warning("Failed to delete local file %s: %s", local_file, exc)
            summary["local_file_deleted"] = False

    # Delete from Supabase Storage
    try:
        sb.storage.from_(_STORAGE_BUCKET).remove([f"{dataset_id}.csv"])
        summary["storage_file_deleted"] = True
    except Exception as exc:
        log.warning("Failed to remove dataset '%s' from Supabase Storage: %s", dataset_id, exc)
        summary["storage_file_deleted"] = False

    # Clear chat sessions & LangGraph checkpoints
    try:
        sessions_resp = sb.table("chat_sessions").select("session_id").eq("dataset_id", dataset_id).execute()
        session_ids = [row["session_id"] for row in (sessions_resp.data or [])]
        for sid in session_ids:
            try:
                clear_session(sid)
            except Exception as exc:
                log.warning("Failed to clear LangGraph session %s: %s", sid, exc)
        sb.table("chat_sessions").delete().eq("dataset_id", dataset_id).execute()
        summary["sessions_deleted"] = len(session_ids)
    except Exception as exc:
        log.warning("Failed to delete chat sessions for dataset %s: %s", dataset_id, exc)

    # Delete query history
    try:
        qh_resp = sb.table("query_history").delete().eq("dataset_id", dataset_id).execute()
        summary["query_history_deleted"] = len(qh_resp.data or [])
    except Exception as exc:
        log.warning("Failed to delete query history for dataset %s: %s", dataset_id, exc)

    # Delete analysis embeddings
    try:
        emb_resp = sb.table("analysis_embeddings").delete().eq("dataset_id", dataset_id).execute()
        summary["embeddings_deleted"] = len(emb_resp.data or [])
    except Exception as exc:
        log.warning("Failed to delete embeddings for dataset %s: %s", dataset_id, exc)

    # Delete dataset record
    sb.table("datasets").delete().eq("dataset_id", dataset_id).execute()
    summary["deleted"] = True

    # Audit log
    if user_id:
        log_event(user_id=user_id, action='dataset.delete', resource_id=dataset_id, resource_type='dataset', metadata={'filename': dataset.get('filename')})

    log.info("Dataset '%s' deleted successfully | user=%s | summary=%s", dataset_id, user_id, summary)
    return summary
