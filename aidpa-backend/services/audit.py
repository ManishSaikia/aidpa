import logging
from typing import Any

from db.pg_connection import get_supabase_client

log = logging.getLogger("aidpa.audit")

_TABLE = "audit_log"


def log_event(
    user_id: str,
    action: str,
    resource_id: str | None = None,
    resource_type: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    try:
        sb = get_supabase_client()
        sb.table(_TABLE).insert({
            "user_id": user_id,
            "action": action,
            "resource_id": resource_id,
            "resource_type": resource_type,
            "metadata": metadata or {},
        }).execute()
        log.debug("audit: user=%s action=%s resource=%s", user_id, action, resource_id)
    except Exception as exc:
        log.warning("Audit log write failed (action=%s): %s", action, exc)
