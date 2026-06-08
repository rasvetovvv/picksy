"""Liveness / readiness endpoint. Exposes which integrations are wired up."""
from fastapi import APIRouter

from backend.core.config import (
    AI_API_KEY,
    AI_MODEL,
    AI_PROVIDER,
    GOOGLE_BOOKS_API_KEY,
    TMDB_API_KEY,
)
from backend.core.db import get_db


router = APIRouter()


@router.get("/api/health")
async def health():
    db_ok = False
    try:
        conn = get_db()
        conn.close()
        db_ok = True
    except Exception:
        pass
    return {
        "status": "ok",
        "tmdb": bool(TMDB_API_KEY),
        "books": True,  # Google Books works without a key (key only extends quota)
        "books_keyed": bool(GOOGLE_BOOKS_API_KEY),
        "openai": bool(AI_API_KEY),
        "ai": bool(AI_API_KEY),
        "ai_provider": AI_PROVIDER,
        "ai_model": AI_MODEL,
        "database": db_ok,
    }
