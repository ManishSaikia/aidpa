import logging
import os
from typing import Any, Optional

from db.pg_connection import get_supabase_client
from services.ingestion import ingest_dataset

log = logging.getLogger("aidpa.storage")

_BASIC_FIELDS = "dataset_id,filename,path,size_bytes,row_count,column_count,columns,sample_rows,date_columns_corrected,ingested_at,user_id"

# ── Quota ─────────────────────────────────────────────────────────────────────

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


def dataset_table_name(dataset_id: str) -> str:
    return "ds_" + dataset_id.replace("-", "_")


# ── Write ─────────────────────────────────────────────────────────────────────

def save_upload(contents: bytes, filename: str, user_id: str | None = None) -> str:
    return ingest_dataset(contents, filename, user_id=user_id)


# ── Read ──────────────────────────────────────────────────────────────────────

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
