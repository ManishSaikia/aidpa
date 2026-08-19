import asyncio
import logging
import os

from fastapi import APIRouter, Depends, HTTPException

from dependencies.admin import get_admin_user
from dependencies.auth import get_current_user, AuthUser
from services.audit import log_event
from services.user_deletion import delete_all_user_data, delete_auth_user

log = logging.getLogger("aidpa.routers.user")

router = APIRouter(prefix="/user", tags=["user"])


@router.delete("/me", summary="Delete own account and all associated data")
async def delete_own_account(current_user: AuthUser = Depends(get_current_user)):
    user_id = current_user.user_id
    log.warning("Account deletion initiated | user=%s", user_id)

    try:
        summary = await asyncio.to_thread(delete_all_user_data, user_id)
    except Exception as exc:
        log.error("delete_all_user_data failed for user=%s: %s", user_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete user data. Please contact support.")

    try:
        await asyncio.to_thread(delete_auth_user, user_id)
    except Exception as exc:
        log.error("delete_auth_user failed for user=%s: %s", user_id, exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Data deleted but failed to remove auth identity. Please contact support.",
        )

    log.warning("Account deletion complete | user=%s | summary=%s", user_id, summary)
    return {"message": "Account permanently deleted.", "deleted": summary}


@router.delete(
    "/admin/users/{user_id}",
    summary="[Admin] Delete any user account by ID",
)
async def admin_delete_user(
    user_id: str,
    admin: AuthUser = Depends(get_admin_user),
):
    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="Admins cannot delete their own account via the admin endpoint. Use DELETE /user/me.")

    log.warning("Admin account deletion initiated | admin=%s | target_user=%s", admin.user_id, user_id)

    try:
        summary = await asyncio.to_thread(delete_all_user_data, user_id)
    except Exception as exc:
        log.error("Admin delete_all_user_data failed for user=%s: %s", user_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete user data: {exc}")

    try:
        await asyncio.to_thread(delete_auth_user, user_id)
    except Exception as exc:
        log.error("Admin delete_auth_user failed for user=%s: %s", user_id, exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Data deleted but failed to remove auth identity.",
        )

    asyncio.create_task(
        asyncio.to_thread(
            log_event,
            admin.user_id, "admin.user_delete",
            user_id, "user",
            {"deleted_by": admin.user_id, "summary": summary},
        )
    )

    log.warning("Admin deletion complete | admin=%s | target=%s | summary=%s", admin.user_id, user_id, summary)
    return {"message": f"User {user_id} permanently deleted.", "deleted": summary}


# ── GET /user/me/stats ────────────────────────────────────────────────────────

@router.get("/me/stats", summary="Get the authenticated user's profile, storage and activity stats")
async def get_my_stats(current_user: AuthUser = Depends(get_current_user)):
    from db.pg_connection import get_supabase_client
    from services.storage import get_user_storage_used, USER_QUOTA_BYTES

    user_id = current_user.user_id

    # Admin check
    admin_ids = [uid.strip() for uid in os.environ.get("ADMIN_USER_IDS", "").split(",") if uid.strip()]
    is_admin = user_id in admin_ids

    sb = get_supabase_client()
    used_bytes = await asyncio.to_thread(get_user_storage_used, user_id)
    quota_bytes = USER_QUOTA_BYTES

    datasets_resp  = sb.table("datasets").select("dataset_id").eq("user_id", user_id).execute()
    sessions_resp  = sb.table("chat_sessions").select("session_id").eq("user_id", user_id).execute()
    queries_resp   = sb.table("query_history").select("id").eq("user_id", user_id).execute()

    datasets_count = len(datasets_resp.data or [])
    sessions_count = len(sessions_resp.data or [])
    queries_count  = len(queries_resp.data or [])

    return {
        "user_id":             user_id,
        "email":               current_user.email,
        "is_admin":            is_admin,
        "storage_used_bytes":  used_bytes,
        "storage_quota_bytes": quota_bytes,
        "storage_used_mb":     round(used_bytes / (1024 * 1024), 1),
        "storage_quota_mb":    round(quota_bytes / (1024 * 1024), 1),
        "storage_percent":     round((used_bytes / quota_bytes) * 100, 1) if quota_bytes > 0 else 0,
        "datasets_count":      datasets_count,
        "sessions_count":      sessions_count,
        "queries_count":       queries_count,
    }


# ── GET /user/admin/users ────────────────────────────────────────────────────

@router.get("/admin/users", summary="[Admin] List all users with their storage stats")
async def admin_list_users(admin: AuthUser = Depends(get_admin_user)):
    from supabase import create_client
    from db.pg_connection import get_supabase_client
    from services.storage import USER_QUOTA_BYTES

    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not service_key:
        raise HTTPException(status_code=503, detail="SUPABASE_SERVICE_ROLE_KEY is not configured.")

    supabase_url = os.environ["SUPABASE_URL"]
    admin_client = create_client(supabase_url, service_key)

    all_auth_users = []
    page = 1
    while True:
        try:
            batch = admin_client.auth.admin.list_users(page=page, per_page=1000)
        except Exception as exc:
            log.error("admin.list_users failed: %s", exc)
            raise HTTPException(status_code=500, detail=f"Failed to list auth users: {exc}")

        if isinstance(batch, list):
            users_batch = batch
        elif hasattr(batch, "users"):
            users_batch = batch.users or []
        else:
            users_batch = []

        if not users_batch:
            break
        all_auth_users.extend(users_batch)
        if len(users_batch) < 1000:
            break
        page += 1

    sb = get_supabase_client()
    all_datasets = (sb.table("datasets").select("user_id, size_bytes, dataset_id").execute().data or [])
    storage_by_user: dict[str, int] = {}
    count_by_user:   dict[str, int] = {}
    for ds in all_datasets:
        uid = str(ds.get("user_id") or "")
        if uid:
            storage_by_user[uid] = storage_by_user.get(uid, 0) + (ds.get("size_bytes") or 0)
            count_by_user[uid]   = count_by_user.get(uid, 0) + 1

    admin_ids = {uid.strip() for uid in os.environ.get("ADMIN_USER_IDS", "").split(",") if uid.strip()}
    quota_bytes = USER_QUOTA_BYTES

    result = []
    for u in all_auth_users:
        uid = str(u.id)
        used = storage_by_user.get(uid, 0)
        result.append({
            "user_id":            uid,
            "email":              u.email or "",
            "display_name":       (u.user_metadata or {}).get("display_name") or (u.user_metadata or {}).get("full_name") or "",
            "created_at":         str(u.created_at or ""),
            "last_sign_in":       str(u.last_sign_in_at or ""),
            "is_admin":           uid in admin_ids,
            "storage_used_bytes": used,
            "storage_used_mb":    round(used / (1024 * 1024), 1),
            "storage_quota_mb":   round(quota_bytes / (1024 * 1024), 1),
            "storage_percent":    round((used / quota_bytes) * 100, 1) if quota_bytes > 0 else 0,
            "datasets_count":     count_by_user.get(uid, 0),
        })

    result.sort(key=lambda x: (-int(x["is_admin"]), -x["storage_used_bytes"]))
    return result
