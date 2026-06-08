"""Freemium tier resolution + daily pick / save quota enforcement.

Quotas are checked against the in-DB `site_settings` overrides (not the
.env file) so admins can tighten or loosen limits without redeploying.
"""
import datetime
import json

from fastapi import HTTPException

from backend.core.config import STAFF_PRO_ROLES
from backend.core.db import get_db
from backend.core.settings import get_site_settings
from backend.core.time import today_kyiv


def get_user_tier(user_id: int) -> str:
    settings = get_site_settings()
    if not settings.get("freemium_enabled", False):
        return "pro"
    try:
        conn = get_db()
        with conn.cursor() as cur:
            # Staff roles + perk roles (e.g. media partners) get auto Pro
            cur.execute("SELECT role FROM users WHERE id=%s", (user_id,))
            urow = cur.fetchone()
            urow_role = (urow or {}).get("role")
            if urow_role and (urow_role in STAFF_PRO_ROLES or urow_role == "media"):
                conn.close()
                return "pro"
            cur.execute(
                "SELECT tier, expires_at FROM user_subscriptions WHERE user_id=%s",
                (user_id,),
            )
            row = cur.fetchone()
        conn.close()
        if not row:
            return "free"
        if row["expires_at"] and row["expires_at"].replace(tzinfo=None) < datetime.datetime.utcnow():
            return "free"
        return row["tier"]
    except Exception:
        return "free"


def check_pick_limit(user_id: int):
    settings = get_site_settings()
    if not settings.get("freemium_enabled", False):
        return
    tier = get_user_tier(user_id)
    if tier in ("premium", "pro"):
        return
    limit = int(settings.get("freemium_free_picks_per_day", "6"))
    try:
        conn = get_db()
        with conn.cursor() as cur:
            today = today_kyiv().isoformat()
            cur.execute(
                "SELECT pick_count FROM daily_pick_counts WHERE user_id=%s AND pick_date=%s",
                (user_id, today),
            )
            row = cur.fetchone()
            count = row["pick_count"] if row else 0
        conn.close()
        if count >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Ліміт {limit} підборів на день вичерпано. Оформіть Premium для необмеженого підбору!",
            )
    except HTTPException:
        raise
    except Exception:
        pass


def increment_pick_count(user_id: int):
    settings = get_site_settings()
    if not settings.get("freemium_enabled", False):
        return
    try:
        conn = get_db()
        with conn.cursor() as cur:
            today = today_kyiv().isoformat()
            cur.execute(
                "INSERT INTO daily_pick_counts (user_id, pick_date, pick_count) VALUES (%s, %s, 1) "
                "ON DUPLICATE KEY UPDATE pick_count = pick_count + 1",
                (user_id, today),
            )
        conn.close()
    except Exception:
        pass


def check_save_limit(user_id: int):
    settings = get_site_settings()
    if not settings.get("freemium_enabled", False):
        return
    tier = get_user_tier(user_id)
    if tier in ("premium", "pro"):
        return
    limit = int(settings.get("freemium_free_save_limit", "20"))
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM saved_movies WHERE user_id=%s", (user_id,))
            movies = (cur.fetchone() or {}).get("c", 0)
            cur.execute("SELECT COUNT(*) AS c FROM saved_tv WHERE user_id=%s", (user_id,))
            tv = (cur.fetchone() or {}).get("c", 0)
            cur.execute("SELECT COUNT(*) AS c FROM saved_books WHERE user_id=%s", (user_id,))
            books = (cur.fetchone() or {}).get("c", 0)
        conn.close()
        total = movies + tv + books
        if total >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Ліміт збережень ({limit}) вичерпано. Оформіть Premium для необмежених збережень!",
            )
    except HTTPException:
        raise
    except Exception:
        pass


def _log_analytics_event(session_id: str, user_id, event_type: str, event_data: dict = None,
                         page_url: str = None, referrer: str = None, ip: str = None, user_agent: str = None):
    settings = get_site_settings()
    if not settings.get("analytics_enabled", False):
        return
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO analytics_events (session_id, user_id, event_type, event_data, page_url, referrer, ip, user_agent)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (session_id, user_id, event_type,
                 json.dumps(event_data, ensure_ascii=False) if event_data else None,
                 page_url, referrer, ip, user_agent),
            )
            cur.execute(
                """INSERT INTO analytics_sessions (id, user_id, ip, user_agent, referrer)
                   VALUES (%s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE last_activity=NOW(), events_count=events_count+1""",
                (session_id, user_id, ip, user_agent, referrer),
            )
        conn.close()
    except Exception:
        pass
