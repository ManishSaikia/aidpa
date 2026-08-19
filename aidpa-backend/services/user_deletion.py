import logging
import os
from pathlib import Path

from supabase import create_client
from db.pg_connection import get_supabase_client
from services.agent import clear_session

log = logging.getLogger("aidpa.user_deletion")

def _get_session_ids_for_user(user_id: str) -> list[str]:
    sb = get_supabase_client()
    resp = (
        sb.table("chat_sessions")
        .select("session_id")
        .eq("user_id", user_id)
        .execute()
    )
    return [row["session_id"] for row in (resp.data or [])]


def delete_all_user_data(user_id: str) -> dict:
    sb = get_supabase_client()
    summary: dict = {}

    # 1. LangGraph checkpoints
    session_ids = _get_session_ids_for_user(user_id)
    for sid in session_ids:
        try:
            clear_session(sid)
        except Exception as exc:
            log.warning("clear_session(%s) failed: %s", sid, exc)
    summary["checkpoints_cleared"] = len(session_ids)
    log.info("user_deletion | user=%s | checkpoints cleared: %d", user_id, len(session_ids))

    # 2. Query history
    resp = sb.table("query_history").delete().eq("user_id", user_id).execute()
    summary["query_history"] = len(resp.data or [])

    # 3. Chat sessions 
    resp = sb.table("chat_sessions").delete().eq("user_id", user_id).execute()
    summary["sessions"] = len(resp.data or [])

    # 4. Analysis embeddings
    resp = sb.table("analysis_embeddings").delete().eq("user_id", user_id).execute()
    summary["embeddings"] = len(resp.data or [])

    # 5. Audit log 
    resp = sb.table("audit_log").update({"user_id": None}).eq("user_id", user_id).execute()
    summary["audit_anonymized"] = len(resp.data or [])

    # 6. Datasets
    datasets = (
        sb.table("datasets")
        .select("dataset_id, path")
        .eq("user_id", user_id)
        .execute()
        .data or []
    )
    files_deleted = 0
    for ds in datasets:
        try:
            p = Path(ds["path"])
            if p.exists():
                p.unlink()
                files_deleted += 1
        except Exception as exc:
            log.warning("File delete failed for dataset %s: %s", ds["dataset_id"], exc)
    resp = sb.table("datasets").delete().eq("user_id", user_id).execute()
    summary["datasets"] = len(resp.data or [])
    summary["files_deleted"] = files_deleted

    log.info("user_deletion | user=%s | summary=%s", user_id, summary)
    return summary


def delete_auth_user(user_id: str) -> None:
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not service_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not set. "
            "Cannot delete auth user without the service role key."
        )
    url = os.environ["SUPABASE_URL"]
    admin_client = create_client(url, service_key)
    admin_client.auth.admin.delete_user(user_id)
    log.info("user_deletion | user=%s | Supabase Auth user deleted", user_id)
