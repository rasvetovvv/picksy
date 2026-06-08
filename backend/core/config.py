"""Environment-driven configuration. Read once at import time.

Keeping every getenv() call here means the rest of the codebase imports
plain constants and there is exactly one place to look when a knob is
unclear or needs a new default.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# .env can live either at the repo root or next to backend/ — load both so
# `python -m backend.main` and `uvicorn backend.main:app` both pick it up.
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)
load_dotenv()


# ─── AI providers ─────────────────────────────────────────────────────────
AI_PROVIDER = os.getenv("AI_PROVIDER", "groq")
AI_API_KEY = os.getenv("AI_API_KEY", os.getenv("OPENAI_API_KEY", ""))
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.groq.com/openai/v1")
AI_MODEL = os.getenv("AI_MODEL", "llama-3.1-8b-instant")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


# ─── Content APIs ─────────────────────────────────────────────────────────
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
# Detect TMDB key type: v4 Bearer token (starts with eyJ) vs v3 API key
TMDB_IS_BEARER = TMDB_API_KEY.startswith("eyJ")
GOOGLE_BOOKS_API_KEY = os.getenv("GOOGLE_BOOKS_API_KEY", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


# ─── MySQL ────────────────────────────────────────────────────────────────
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "pickforme")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "pickforme_pass")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "pickforme")


# ─── Auth / sessions ──────────────────────────────────────────────────────
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", str(60 * 60 * 24 * 30)))
# bcrypt work factor. 12 ≈ 200ms on modern CPUs. Adjust via env if needed.
BCRYPT_ROUNDS = max(10, min(15, int(os.getenv("BCRYPT_ROUNDS", "12"))))
MIN_PASSWORD_LENGTH = max(8, int(os.getenv("MIN_PASSWORD_LENGTH", "10")))
HIBP_CHECK_ENABLED = (os.getenv("HIBP_CHECK_ENABLED", "1") or "").strip().lower() in (
    "1", "true", "yes", "on",
)


# ─── Profile-image limits ─────────────────────────────────────────────────
# Cap encoded length at ~256 KB. After base64 expansion that's ≈ 190 KB of
# actual image bytes — plenty for an avatar / banner, and small enough that
# 1000 abusive accounts add ~256 MB rather than ~8 GB to the DB.
MAX_PROFILE_IMAGE_CHARS = 256 * 1024


# ─── Reverse-proxy trust ──────────────────────────────────────────────────
# Trust X-Forwarded-For when explicitly enabled — set TRUST_PROXY=1 once the
# app sits behind a known reverse proxy (nginx, Cloudflare, etc.). Without
# this, _rate_limit() would key on the proxy IP and turn into a global limit.
TRUST_PROXY = (os.getenv("TRUST_PROXY", "") or "").strip().lower() in (
    "1", "true", "yes", "on",
)


# ─── Role tuples used across modules ──────────────────────────────────────
# Staff roles that automatically get the "pro" tier regardless of freemium
# state. Also referenced by the RBAC layer for admin-area access.
STAFF_PRO_ROLES = ("content-manager", "editor", "support", "moderator", "admin", "superadmin")
