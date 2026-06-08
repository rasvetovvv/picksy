"""Bot configuration loaded from environment variables.

Loads .env from the project root if present so the bot can run standalone
or alongside the backend (which already shares the same .env).
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List

try:
    from dotenv import load_dotenv

    _root_env = Path(__file__).resolve().parent.parent / ".env"
    if _root_env.exists():
        load_dotenv(dotenv_path=_root_env)
except Exception:
    pass


def _csv_int(value: str) -> List[int]:
    out: List[int] = []
    for part in (value or "").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            out.append(int(part))
        except ValueError:
            pass
    return out


# ── Telegram ──
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

# Single chat where ticket notifications appear (group/channel/dm with admin).
ADMIN_CHAT_ID = int(os.getenv("PICKSY_ADMIN_CHAT_ID", "0") or 0)

# Bootstrap list of admin tg_ids (comma-separated). After first run they are
# upserted into bot_admins table. Additional admins can be added via /addadmin.
BOOTSTRAP_ADMIN_IDS = _csv_int(os.getenv("PICKSY_BOT_ADMIN_IDS", ""))

# Public site URL used in messages (links).
SITE_URL = os.getenv("SITE_URL", "https://picksy.my").rstrip("/")

# Public Telegram channel for news/announcements (linked from bot menus and
# many user-facing texts). Override via env if it ever changes.
TG_CHANNEL_USERNAME = os.getenv("TG_CHANNEL_USERNAME", "@itspicksy").strip()
TG_CHANNEL_URL = os.getenv(
    "TG_CHANNEL_URL",
    "https://t.me/" + TG_CHANNEL_USERNAME.lstrip("@"),
).rstrip("/")

# Backend internal API base (typically the same backend, called over docker
# network or http://localhost:7888 if both are on the same host).
API_URL = os.getenv("PICKSY_API_URL", "http://app:7888").rstrip("/")
BOT_INTERNAL_TOKEN = os.getenv("BOT_INTERNAL_TOKEN", "").strip()

# Schedule (Europe/Kyiv local time) — DST handled automatically by the
# scheduler. Daily pick is pushed at 12:00 Kyiv every day.
DAILY_PICK_HOUR = int(os.getenv("DAILY_PICK_HOUR", "12"))
DAILY_PICK_MINUTE = int(os.getenv("DAILY_PICK_MINUTE", "0"))

# Weekly digest — Sunday 19:00 Kyiv
WEEKLY_DIGEST_HOUR = int(os.getenv("WEEKLY_DIGEST_HOUR", "19"))
WEEKLY_DIGEST_MINUTE = int(os.getenv("WEEKLY_DIGEST_MINUTE", "0"))

# Tip-of-the-day every N days at 21:00 Kyiv
TIP_HOUR = int(os.getenv("TIP_HOUR", "21"))
TIP_MINUTE = int(os.getenv("TIP_MINUTE", "0"))

# Picksy AI evening broadcast — 20:00 Kyiv
AI_EVENING_HOUR = int(os.getenv("AI_EVENING_HOUR", "20"))
AI_EVENING_MINUTE = int(os.getenv("AI_EVENING_MINUTE", "0"))

# Вечір п'ятниці — Friday 18:00 Kyiv (personal weekend picks)
FRIDAY_PICKS_HOUR = int(os.getenv("FRIDAY_PICKS_HOUR", "18"))
FRIDAY_PICKS_MINUTE = int(os.getenv("FRIDAY_PICKS_MINUTE", "0"))

# Auto-close idle open tickets after N days
TICKET_AUTO_CLOSE_DAYS = int(os.getenv("TICKET_AUTO_CLOSE_DAYS", "7"))

# Anti-spam: max new tickets per hour per user
TICKET_RATE_LIMIT_PER_HOUR = int(os.getenv("TICKET_RATE_LIMIT_PER_HOUR", "5"))

# Max messages per ticket
TICKET_MAX_MESSAGES = int(os.getenv("TICKET_MAX_MESSAGES", "30"))

# Broadcast send rate: messages per second (Telegram global limit ≈ 30/s)
BROADCAST_RATE_PER_SEC = float(os.getenv("BROADCAST_RATE_PER_SEC", "25"))

# DB connection (re-uses backend's settings)
MYSQL_HOST = os.getenv("MYSQL_HOST", "db")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "pickforme")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "pickforme_pass")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "pickforme")

# Topics user can subscribe to.
# Third element = default ON for new users.
# By design every notification is ON by default — there are only ~6 topics
# total and they're not noisy. User can disable individually or all at once.
TOPICS = [
    ("daily_pick", "🎯 Daily Pick (12:00)", True),
    ("weekly_digest", "📰 Тижневий дайджест (нд 19:00)", True),
    ("news", "🆕 Новини та оновлення", True),
    ("events", "🎉 Свята та події", True),
    ("tip_of_the_day", "💡 Підказки по сайту", True),
    ("gift_received", "🎁 Сповіщення про подарунки", True),
    ("ai_evening", "🤖 Вечірній Picksy AI (20:00)", True),
    ("friday_picks", "🌟 Вечір п'ятниці (пт 18:00)", True),
]

# Ticket categories
TICKET_CATEGORIES = [
    ("bug", "🐛 Баг / помилка"),
    ("idea", "💡 Ідея / пропозиція"),
    ("payment", "💰 Оплата / підписка"),
    ("gift", "🎁 Подарунки"),
    ("account", "👤 Акаунт"),
    ("other", "❓ Інше"),
]

# Ticket priorities
TICKET_PRIORITIES = [
    ("normal", "🟢 Звичайний"),
    ("urgent", "🔥 Терміново"),
]


def is_configured() -> bool:
    return bool(BOT_TOKEN)
