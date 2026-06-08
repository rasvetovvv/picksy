"""FastAPI auth dependencies — sit on top of core.security and core.db."""
from fastapi import Header, HTTPException

from backend.core.db import get_db
from backend.core.security import _lookup_user_by_token


_USER_AUTH_COLS = (
    "id, email, username, display_name, bio, avatar_emoji, is_admin, is_banned, is_verified, role"
)


async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    try:
        conn = get_db()
        with conn.cursor() as cur:
            user = _lookup_user_by_token(cur, token, _USER_AUTH_COLS)
        conn.close()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="Account suspended")
    return user


async def get_current_user_optional(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    try:
        conn = get_db()
        with conn.cursor() as cur:
            user = _lookup_user_by_token(cur, token, _USER_AUTH_COLS)
        conn.close()
        return user
    except Exception:
        return None
