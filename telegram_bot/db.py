"""Thin DB layer over the backend's MySQL database.

The bot uses the same database as the backend so that the admin web UI and
the bot stay in sync. Tables are created by `backend.main.init_db()` on
backend startup; this module assumes they exist.
"""
from __future__ import annotations

import datetime
import logging
from contextlib import contextmanager
from typing import Any, Dict, Iterable, List, Optional

import pymysql
from pymysql.cursors import DictCursor

from . import config

log = logging.getLogger("picksy_bot.db")


def _connect():
    return pymysql.connect(
        host=config.MYSQL_HOST,
        port=config.MYSQL_PORT,
        user=config.MYSQL_USER,
        password=config.MYSQL_PASSWORD,
        database=config.MYSQL_DATABASE,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=True,
        connect_timeout=10,
    )


@contextmanager
def cursor():
    conn = None
    try:
        conn = _connect()
        with conn.cursor() as cur:
            yield cur
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def fetch_one(sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    with cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def fetch_all(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall() or [])


def execute(sql: str, params: tuple = (), returning: str = "lastrowid") -> int:
    """Execute a write. returning='lastrowid' (default) or 'rowcount'."""
    with cursor() as cur:
        cur.execute(sql, params)
        if returning == "rowcount":
            return cur.rowcount or 0
        return cur.lastrowid or 0


# ─── Subscribers ───

def upsert_subscriber(tg_id: int, username: Optional[str], first_name: Optional[str]) -> None:
    execute(
        """INSERT INTO bot_subscribers (tg_id, tg_username, first_name)
           VALUES (%s,%s,%s)
           ON DUPLICATE KEY UPDATE
             tg_username=VALUES(tg_username),
             first_name=VALUES(first_name),
             last_seen_at=CURRENT_TIMESTAMP""",
        (tg_id, username, first_name),
    )
    # Default subscription state for new users (only enable defaults once on first insert)
    for slug, _label, default_on in config.TOPICS:
        execute(
            "INSERT IGNORE INTO bot_subscriptions (tg_id, topic, enabled) VALUES (%s,%s,%s)",
            (tg_id, slug, 1 if default_on else 0),
        )


def get_subscriber(tg_id: int) -> Optional[Dict[str, Any]]:
    return fetch_one("SELECT * FROM bot_subscribers WHERE tg_id=%s", (tg_id,))


def set_lang(tg_id: int, lang: str) -> None:
    execute("UPDATE bot_subscribers SET lang=%s WHERE tg_id=%s", (lang, tg_id))


def set_subscription(tg_id: int, topic: str, enabled: bool) -> None:
    execute(
        """INSERT INTO bot_subscriptions (tg_id, topic, enabled) VALUES (%s,%s,%s)
           ON DUPLICATE KEY UPDATE enabled=VALUES(enabled)""",
        (tg_id, topic, 1 if enabled else 0),
    )


def get_subscriptions(tg_id: int) -> Dict[str, bool]:
    rows = fetch_all("SELECT topic, enabled FROM bot_subscriptions WHERE tg_id=%s", (tg_id,))
    return {r["topic"]: bool(r["enabled"]) for r in rows}


def disable_all_subscriptions(tg_id: int) -> None:
    execute("UPDATE bot_subscriptions SET enabled=0 WHERE tg_id=%s", (tg_id,))


def list_subscribers_for_topic(topic: str) -> List[int]:
    rows = fetch_all(
        """SELECT s.tg_id FROM bot_subscribers s
           JOIN bot_subscriptions sub ON sub.tg_id = s.tg_id
           WHERE sub.topic=%s AND sub.enabled=1 AND s.is_banned=0""",
        (topic,),
    )
    return [r["tg_id"] for r in rows]


def list_all_subscribers() -> List[int]:
    rows = fetch_all("SELECT tg_id FROM bot_subscribers WHERE is_banned=0")
    return [r["tg_id"] for r in rows]


def ban_user(tg_id: int, reason: str = "") -> None:
    execute(
        "UPDATE bot_subscribers SET is_banned=1, banned_reason=%s WHERE tg_id=%s",
        (reason or None, tg_id),
    )


def unban_user(tg_id: int) -> None:
    execute("UPDATE bot_subscribers SET is_banned=0, banned_reason=NULL WHERE tg_id=%s", (tg_id,))


def list_all_subscribers(limit: int = 10, offset: int = 0) -> List[Dict[str, Any]]:
    """Paginated list of bot subscribers, newest first."""
    return fetch_all(
        """SELECT tg_id, tg_username, first_name, lang, is_banned, joined_at, last_seen_at
           FROM bot_subscribers ORDER BY joined_at DESC LIMIT %s OFFSET %s""",
        (limit, offset),
    )


def count_all_subscribers() -> int:
    row = fetch_one("SELECT COUNT(*) AS c FROM bot_subscribers")
    return int((row or {}).get("c") or 0)


def count_open_tickets_for_user(tg_id: int) -> int:
    row = fetch_one(
        "SELECT COUNT(*) AS c FROM support_tickets "
        "WHERE tg_id=%s AND status IN ('open','answered','awaiting_user')",
        (tg_id,),
    )
    return int((row or {}).get("c") or 0)


# ─── Admins ───

def is_admin(tg_id: int) -> bool:
    if tg_id in config.BOOTSTRAP_ADMIN_IDS:
        return True
    row = fetch_one("SELECT 1 FROM bot_admins WHERE tg_id=%s", (tg_id,))
    return bool(row)


def list_admins() -> List[Dict[str, Any]]:
    return fetch_all("SELECT tg_id, display_name, role FROM bot_admins ORDER BY added_at")


def add_admin(tg_id: int, display_name: str = "", role: str = "support", added_by: int = 0) -> None:
    execute(
        """INSERT INTO bot_admins (tg_id, display_name, role, added_by) VALUES (%s,%s,%s,%s)
           ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), role=VALUES(role)""",
        (tg_id, display_name or None, role, added_by or None),
    )


def remove_admin(tg_id: int) -> None:
    execute("DELETE FROM bot_admins WHERE tg_id=%s", (tg_id,))


def bootstrap_admins() -> None:
    """Sync bootstrap admins from env into the DB."""
    for tg_id in config.BOOTSTRAP_ADMIN_IDS:
        try:
            add_admin(tg_id, display_name=f"bootstrap:{tg_id}", role="superadmin", added_by=0)
        except Exception as e:
            log.warning("bootstrap admin %s: %s", tg_id, e)


# ─── Tickets ───

def create_ticket(
    *, tg_id: int, tg_username: Optional[str], category: str, priority: str = "normal",
    subject: Optional[str] = None,
) -> int:
    auto_close = datetime.datetime.utcnow() + datetime.timedelta(days=config.TICKET_AUTO_CLOSE_DAYS)
    return execute(
        """INSERT INTO support_tickets
             (tg_id, tg_username, category, priority, subject, status, auto_close_at)
           VALUES (%s,%s,%s,%s,%s,'open',%s)""",
        (tg_id, tg_username, category, priority, subject, auto_close),
    )


def get_ticket(ticket_id: int) -> Optional[Dict[str, Any]]:
    return fetch_one("SELECT * FROM support_tickets WHERE id=%s", (ticket_id,))


def get_open_ticket_for_user(tg_id: int) -> Optional[Dict[str, Any]]:
    return fetch_one(
        "SELECT * FROM support_tickets WHERE tg_id=%s AND status IN ('open','answered','awaiting_user') "
        "ORDER BY id DESC LIMIT 1",
        (tg_id,),
    )


def list_tickets_for_user(tg_id: int, limit: int = 20) -> List[Dict[str, Any]]:
    return fetch_all(
        "SELECT * FROM support_tickets WHERE tg_id=%s ORDER BY updated_at DESC LIMIT %s",
        (tg_id, limit),
    )


def list_tickets_by_status(status: str, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
    return fetch_all(
        "SELECT * FROM support_tickets WHERE status=%s ORDER BY updated_at DESC LIMIT %s OFFSET %s",
        (status, limit, offset),
    )


def count_tickets_by_status(status: str) -> int:
    row = fetch_one("SELECT COUNT(*) AS c FROM support_tickets WHERE status=%s", (status,))
    return int((row or {}).get("c") or 0)


def update_ticket(ticket_id: int, **fields) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k}=%s" for k in fields)
    params = tuple(fields.values()) + (ticket_id,)
    execute(f"UPDATE support_tickets SET {cols} WHERE id=%s", params)


def add_ticket_message(
    *, ticket_id: int, author: str, tg_id: Optional[int], text: Optional[str] = None,
    file_id: Optional[str] = None, file_kind: Optional[str] = None, is_internal: bool = False,
) -> int:
    msg_id = execute(
        """INSERT INTO ticket_messages
             (ticket_id, author, tg_id, text, file_id, file_kind, is_internal_note)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (ticket_id, author, tg_id, text, file_id, file_kind, 1 if is_internal else 0),
    )
    # Update ticket updated_at and status
    execute(
        "UPDATE support_tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=%s",
        (ticket_id,),
    )
    return msg_id


def list_ticket_messages(ticket_id: int, include_internal: bool = True) -> List[Dict[str, Any]]:
    if include_internal:
        return fetch_all(
            "SELECT * FROM ticket_messages WHERE ticket_id=%s ORDER BY id ASC",
            (ticket_id,),
        )
    return fetch_all(
        "SELECT * FROM ticket_messages WHERE ticket_id=%s AND is_internal_note=0 ORDER BY id ASC",
        (ticket_id,),
    )


def count_ticket_messages(ticket_id: int) -> int:
    row = fetch_one("SELECT COUNT(*) AS c FROM ticket_messages WHERE ticket_id=%s", (ticket_id,))
    return int((row or {}).get("c") or 0)


def count_recent_tickets(tg_id: int, hours: int = 1) -> int:
    row = fetch_one(
        "SELECT COUNT(*) AS c FROM support_tickets WHERE tg_id=%s AND created_at >= NOW() - INTERVAL %s HOUR",
        (tg_id, hours),
    )
    return int((row or {}).get("c") or 0)


def find_idle_open_tickets() -> List[Dict[str, Any]]:
    return fetch_all(
        "SELECT * FROM support_tickets "
        "WHERE status IN ('open','answered','awaiting_user') AND auto_close_at IS NOT NULL "
        "AND auto_close_at <= NOW()",
    )


# ─── Canned responses ───

def list_canned() -> List[Dict[str, Any]]:
    return fetch_all("SELECT * FROM bot_canned_responses ORDER BY sort_order, id")


def add_canned(slug: str, label: str, text: str, sort_order: int = 0) -> None:
    execute(
        """INSERT INTO bot_canned_responses (slug, label, text, sort_order)
           VALUES (%s,%s,%s,%s)
           ON DUPLICATE KEY UPDATE label=VALUES(label), text=VALUES(text), sort_order=VALUES(sort_order)""",
        (slug, label, text, sort_order),
    )


def get_canned(slug: str) -> Optional[Dict[str, Any]]:
    return fetch_one("SELECT * FROM bot_canned_responses WHERE slug=%s", (slug,))


def seed_canned_if_empty() -> None:
    row = fetch_one("SELECT COUNT(*) AS c FROM bot_canned_responses")
    if int((row or {}).get("c") or 0) > 0:
        return
    defaults = [
        ("ack", "Дякуємо, перевіримо", "Дякуємо за повідомлення! Ми перевіримо це й повернемось.", 10),
        ("more_info", "Уточніть будь ласка", "Будь ласка, поділіться деталями: на якій сторінці виникла проблема, що саме сталось і скріншот, якщо можливо.", 20),
        ("fixed_next", "Виправлено в наступному релізі", "Дякуємо! Ми це виправили й виправлення буде у найближчому оновленні. Закриваю тікет — пишіть знову, якщо щось не так.", 30),
        ("not_a_bug", "Це задумано так", "Дякуємо за повідомлення. Це поточна задумана поведінка. Якщо у вас є пропозиція, як її покращити — створіть тікет з категорією 'Ідея'.", 40),
        ("payment", "Оплата — стандартна обробка", "Оплата зазвичай обробляється протягом 5-10 хвилин. Якщо за годину статус не змінився — надішліть нам ID транзакції.", 50),
    ]
    for slug, label, text, order in defaults:
        add_canned(slug, label, text, order)


# ─── Broadcasts ───

def create_broadcast(
    *, topic: str, text: str, button_text: Optional[str] = None,
    button_url: Optional[str] = None, photo_file_id: Optional[str] = None,
    target_count: int = 0, created_by_tg_id: Optional[int] = None,
) -> int:
    return execute(
        """INSERT INTO bot_broadcasts
             (topic, text, button_text, button_url, photo_file_id, target_count, created_by_tg_id)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (topic, text, button_text, button_url, photo_file_id, target_count, created_by_tg_id),
    )


def update_broadcast_progress(bid: int, sent: int, failed: int, finished: bool = False) -> None:
    if finished:
        execute(
            "UPDATE bot_broadcasts SET sent_count=%s, failed_count=%s, finished_at=CURRENT_TIMESTAMP WHERE id=%s",
            (sent, failed, bid),
        )
    else:
        execute(
            "UPDATE bot_broadcasts SET sent_count=%s, failed_count=%s WHERE id=%s",
            (sent, failed, bid),
        )


def list_recent_broadcasts(limit: int = 10) -> List[Dict[str, Any]]:
    return fetch_all(
        "SELECT * FROM bot_broadcasts ORDER BY created_at DESC LIMIT %s",
        (limit,),
    )


NEWS_TOPICS = ("news", "_all", "events")


def delete_news_broadcasts(older_than_days: Optional[int] = None) -> int:
    """Delete broadcasts shown in the user-facing news feed.
    older_than_days=None → delete all. Returns rows deleted."""
    placeholders = ", ".join(["%s"] * len(NEWS_TOPICS))
    if older_than_days is not None:
        sql = (
            f"DELETE FROM bot_broadcasts WHERE topic IN ({placeholders}) "
            f"AND created_at < NOW() - INTERVAL %s DAY"
        )
        params = (*NEWS_TOPICS, int(older_than_days))
    else:
        sql = f"DELETE FROM bot_broadcasts WHERE topic IN ({placeholders})"
        params = NEWS_TOPICS
    return execute(sql, params, returning="rowcount")


def delete_broadcast_by_id(broadcast_id: int) -> int:
    return execute(
        "DELETE FROM bot_broadcasts WHERE id=%s",
        (broadcast_id,),
        returning="rowcount",
    )


# ─── Rate-log (for tip-of-the-day, captcha, etc.) ───

def log_rate(tg_id: int, kind: str) -> None:
    execute("INSERT INTO bot_rate_log (tg_id, kind) VALUES (%s,%s)", (tg_id, kind))


def count_rate(tg_id: int, kind: str, hours: int = 1) -> int:
    row = fetch_one(
        "SELECT COUNT(*) AS c FROM bot_rate_log WHERE tg_id=%s AND kind=%s AND created_at >= NOW() - INTERVAL %s HOUR",
        (tg_id, kind, hours),
    )
    return int((row or {}).get("c") or 0)


# ─── User message log (for admin visibility) ───

def init_bot_log_table() -> None:
    """Create the user-message log table if it does not exist. Called from
    bot post_init so the admin /logsuser command always has somewhere to read
    from, even when the backend has not yet provisioned the schema."""
    try:
        execute(
            """CREATE TABLE IF NOT EXISTS bot_user_messages (
                 id BIGINT AUTO_INCREMENT PRIMARY KEY,
                 tg_id BIGINT NOT NULL,
                 tg_username VARCHAR(64) DEFAULT NULL,
                 chat_type VARCHAR(16) DEFAULT NULL,
                 kind VARCHAR(24) NOT NULL DEFAULT 'text',
                 text TEXT,
                 file_id VARCHAR(255) DEFAULT NULL,
                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 INDEX idx_user_time (tg_id, created_at),
                 INDEX idx_time (created_at)
               ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"""
        )
    except Exception as e:
        log.warning("init_bot_log_table: %s", e)


def log_user_message(
    *,
    tg_id: int,
    tg_username: Optional[str] = None,
    chat_type: Optional[str] = None,
    kind: str = "text",
    text: Optional[str] = None,
    file_id: Optional[str] = None,
) -> None:
    """Insert a single row into bot_user_messages. Best-effort: any error
    (table missing, DB down, oversize blob) is swallowed so logging never
    breaks the actual chat flow."""
    try:
        # Trim very long messages so a single huge paste cannot bloat the
        # table.  4 KB is plenty for a Telegram text message.
        if text and len(text) > 4000:
            text = text[:4000] + " …(truncated)"
        execute(
            """INSERT INTO bot_user_messages
                 (tg_id, tg_username, chat_type, kind, text, file_id)
               VALUES (%s,%s,%s,%s,%s,%s)""",
            (tg_id, (tg_username or None), (chat_type or None),
             kind or "text", text, file_id),
        )
    except Exception as e:
        log.debug("log_user_message skipped: %s", e)


def list_user_messages(tg_id: int, limit: int = 30) -> List[Dict[str, Any]]:
    """Return the newest `limit` rows the user has sent the bot."""
    try:
        return fetch_all(
            """SELECT id, kind, text, file_id, chat_type, created_at
               FROM bot_user_messages WHERE tg_id=%s
               ORDER BY id DESC LIMIT %s""",
            (tg_id, limit),
        )
    except Exception as e:
        log.warning("list_user_messages: %s", e)
        return []


def count_user_messages(tg_id: int) -> int:
    try:
        row = fetch_one(
            "SELECT COUNT(*) AS c FROM bot_user_messages WHERE tg_id=%s",
            (tg_id,),
        )
        return int((row or {}).get("c") or 0)
    except Exception:
        return 0


def list_recent_user_messages(limit: int = 30) -> List[Dict[str, Any]]:
    """Return the newest `limit` rows globally — used by the admin "live log"
    view to see who is writing to the bot right now."""
    try:
        return fetch_all(
            """SELECT m.id, m.tg_id, m.tg_username, m.kind, m.text, m.created_at,
                      s.first_name
               FROM bot_user_messages m
               LEFT JOIN bot_subscribers s ON s.tg_id = m.tg_id
               ORDER BY m.id DESC LIMIT %s""",
            (limit,),
        )
    except Exception as e:
        log.warning("list_recent_user_messages: %s", e)
        return []


# ─── Stats ───

def _safe_count(sql: str, params: tuple = ()) -> int:
    """fetch_one wrapped in try/except so a single missing table can't break
    the whole stats page."""
    try:
        row = fetch_one(sql, params)
        return int((row or {}).get("c") or 0)
    except Exception as e:
        log.warning("stats count failed (%s): %s", sql[:60], e)
        return 0


def stats_summary() -> Dict[str, Any]:
    """Collect a snapshot of bot health/usage metrics.

    Every individual query is wrapped in try/except so a missing table or
    transient DB error fails open (returns 0) instead of breaking the whole
    admin /stats page. Caller can rely on every key in the returned dict
    existing with a sensible default."""
    out: Dict[str, Any] = {
        "subscribers": 0,
        "banned": 0,
        "tickets_open": 0,
        "tickets_answered": 0,
        "tickets_awaiting_user": 0,
        "tickets_closed": 0,
        "tickets_spam": 0,
        "broadcasts_7d": 0,
        "topic_counts": {},
        "messages_total": 0,
        "messages_24h": 0,
        "dau": 0,
        "wau": 0,
        "mau": 0,
        "new_users_24h": 0,
        "new_users_7d": 0,
        "tickets_total": 0,
        "admins_count": 0,
    }
    out["subscribers"] = _safe_count("SELECT COUNT(*) AS c FROM bot_subscribers WHERE is_banned=0")
    out["banned"] = _safe_count("SELECT COUNT(*) AS c FROM bot_subscribers WHERE is_banned=1")
    for status in ("open", "answered", "awaiting_user", "closed", "spam"):
        try:
            out[f"tickets_{status}"] = count_tickets_by_status(status)
        except Exception as e:
            log.warning("stats tickets_%s failed: %s", status, e)
            out[f"tickets_{status}"] = 0
    out["tickets_total"] = sum(
        out.get(f"tickets_{s}", 0)
        for s in ("open", "answered", "awaiting_user", "closed", "spam")
    )
    out["broadcasts_7d"] = _safe_count(
        "SELECT COUNT(*) AS c FROM bot_broadcasts WHERE created_at >= NOW() - INTERVAL 7 DAY"
    )
    try:
        out["topic_counts"] = {
            (r.get("topic") or ""): int(r.get("c") or 0)
            for r in fetch_all(
                "SELECT topic, COUNT(*) AS c FROM bot_subscriptions WHERE enabled=1 GROUP BY topic"
            )
        }
    except Exception as e:
        log.warning("stats topic_counts: %s", e)
        out["topic_counts"] = {}
    # Messages volume
    out["messages_total"] = _safe_count("SELECT COUNT(*) AS c FROM bot_user_messages")
    out["messages_24h"] = _safe_count(
        "SELECT COUNT(*) AS c FROM bot_user_messages WHERE created_at >= NOW() - INTERVAL 1 DAY"
    )
    # Active users (DAU / WAU / MAU) — distinct users with last_seen_at activity.
    out["dau"] = _safe_count(
        "SELECT COUNT(*) AS c FROM bot_subscribers WHERE last_seen_at >= NOW() - INTERVAL 1 DAY"
    )
    out["wau"] = _safe_count(
        "SELECT COUNT(*) AS c FROM bot_subscribers WHERE last_seen_at >= NOW() - INTERVAL 7 DAY"
    )
    out["mau"] = _safe_count(
        "SELECT COUNT(*) AS c FROM bot_subscribers WHERE last_seen_at >= NOW() - INTERVAL 30 DAY"
    )
    out["new_users_24h"] = _safe_count(
        "SELECT COUNT(*) AS c FROM bot_subscribers WHERE joined_at >= NOW() - INTERVAL 1 DAY"
    )
    out["new_users_7d"] = _safe_count(
        "SELECT COUNT(*) AS c FROM bot_subscribers WHERE joined_at >= NOW() - INTERVAL 7 DAY"
    )
    out["admins_count"] = _safe_count("SELECT COUNT(*) AS c FROM bot_admins")
    return out


def list_top_message_users(limit: int = 10) -> List[Dict[str, Any]]:
    """Top N most-active users by message count in the last 30 days."""
    try:
        return fetch_all(
            """SELECT m.tg_id,
                      MAX(m.tg_username) AS tg_username,
                      MAX(s.first_name)  AS first_name,
                      COUNT(*)           AS msg_count,
                      MAX(m.created_at)  AS last_msg_at
               FROM bot_user_messages m
               LEFT JOIN bot_subscribers s ON s.tg_id = m.tg_id
               WHERE m.created_at >= NOW() - INTERVAL 30 DAY
               GROUP BY m.tg_id
               ORDER BY msg_count DESC
               LIMIT %s""",
            (limit,),
        )
    except Exception as e:
        log.warning("list_top_message_users: %s", e)
        return []


def db_health() -> Dict[str, Any]:
    """Quick connectivity + row-count check across the critical bot tables.

    Returns a dict shaped like {ok: bool, tables: {name: count|None}}.
    A `None` count means the query raised — the table is missing or the
    connection is broken."""
    out: Dict[str, Any] = {"ok": False, "tables": {}, "error": None}
    tables = [
        "bot_subscribers",
        "bot_admins",
        "bot_subscriptions",
        "bot_broadcasts",
        "bot_user_messages",
        "support_tickets",
    ]
    try:
        # Trivial round-trip to fail fast if the DB is unreachable.
        fetch_one("SELECT 1 AS c")
        out["ok"] = True
    except Exception as e:
        out["error"] = str(e)
        return out
    for tbl in tables:
        try:
            row = fetch_one(f"SELECT COUNT(*) AS c FROM {tbl}")
            out["tables"][tbl] = int((row or {}).get("c") or 0)
        except Exception:
            out["tables"][tbl] = None
    return out
