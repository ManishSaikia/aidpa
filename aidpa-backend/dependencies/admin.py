import os
from fastapi import Depends, HTTPException
from dependencies.auth import get_current_user, AuthUser


def get_admin_user(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
    admin_ids = [uid.strip() for uid in os.getenv("ADMIN_USER_IDS", "").split(",") if uid.strip()]
    if not admin_ids:
        raise HTTPException(status_code=503, detail="Admin access is not configured.")
    if current_user.user_id not in admin_ids:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user
