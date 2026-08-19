import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from db.pg_connection import get_supabase_client

_TABLE = "chat_sessions"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Existing session CRUD ─────────────────────────────────────────────────────

def create_session(dataset_id: str, user_id: str | None = None) -> str:
    session_id = str(uuid.uuid4())
    sb = get_supabase_client()
    row: Dict[str, Any] = {
        "session_id":    session_id,
        "dataset_id":    dataset_id,
        "created_at":    _now_iso(),
        "last_used_at":  _now_iso(),
        "messages_json": [],
    }
    if user_id:
        row["user_id"] = user_id
    sb.table(_TABLE).insert(row).execute()
    return session_id


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    sb = get_supabase_client()
    resp = (
        sb.table(_TABLE)
        .select("session_id, dataset_id, title, created_at, last_used_at, user_id")
        .eq("session_id", session_id)
        .maybe_single()
        .execute()
    )
    return resp.data or None


def touch_session(session_id: str) -> None:
    sb = get_supabase_client()
    sb.table(_TABLE).update({"last_used_at": _now_iso()}).eq("session_id", session_id).execute()


def delete_session(session_id: str) -> bool:
    sb = get_supabase_client()
    resp = sb.table(_TABLE).delete().eq("session_id", session_id).execute()
    return len(resp.data) > 0


# ── Message persistence ───────────────────────────────────────────────────────

def set_session_title(session_id: str, title: str) -> None:
    """Set the human-readable session name from the first user message."""
    sb = get_supabase_client()
    sb.table(_TABLE).update({"title": title}).eq("session_id", session_id).execute()


def append_message_pair(session_id: str, user_question: str, assistant_answer: str) -> None:
    """
    Fetch the current messages_json, append the new user/assistant pair,
    and write it back. Also bumps last_used_at.

    PostgREST doesn't support array-append natively, so we fetch + extend + update.
    """
    sb = get_supabase_client()
    resp = (
        sb.table(_TABLE)
        .select("messages_json")
        .eq("session_id", session_id)
        .maybe_single()
        .execute()
    )
    existing: List[Dict] = (resp.data or {}).get("messages_json") or []

    now = _now_iso()
    existing.append({"role": "user",      "content": user_question,    "ts": now})
    existing.append({"role": "assistant", "content": assistant_answer, "ts": now})

    sb.table(_TABLE).update({
        "messages_json": existing,
        "last_used_at":  now,
    }).eq("session_id", session_id).execute()


def get_session_messages(session_id: str) -> List[Dict[str, Any]]:
    """Return the persisted messages_json array for a session."""
    sb = get_supabase_client()
    resp = (
        sb.table(_TABLE)
        .select("messages_json")
        .eq("session_id", session_id)
        .maybe_single()
        .execute()
    )
    return (resp.data or {}).get("messages_json") or []


# ── Session list ──────────────────────────────────────────────────────────────

def list_sessions(dataset_id: str, user_id: str | None = None) -> List[Dict[str, Any]]:
    """
    Return sessions for a dataset, ordered newest-first.
    Filtered by user_id when provided.
    """
    sb = get_supabase_client()
    q = (
        sb.table(_TABLE)
        .select("session_id, title, created_at, last_used_at, messages_json")
        .eq("dataset_id", dataset_id)
        .order("last_used_at", desc=True)
    )
    if user_id:
        q = q.eq("user_id", user_id)
    resp = q.execute()

    rows = resp.data or []
    return [
        {
            "session_id":    row["session_id"],
            "title":         row.get("title") or "Untitled session",
            "created_at":    row["created_at"],
            "last_used_at":  row["last_used_at"],
            "message_count": len(row.get("messages_json") or []) // 2,
        }
        for row in rows
    ]
