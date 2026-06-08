"""Public donation progress endpoint. Backed by admin-editable settings."""
from fastapi import APIRouter

from backend.core.settings import get_site_settings


router = APIRouter()


DONATE_CONFIG = {
    "goal": 100,
    "current": 0,
    "mono_url": "",
    "coffee_url": "",
    "patreon_url": "",
}


@router.get("/api/donate-progress")
async def donate_progress():
    settings = get_site_settings()
    return {
        "goal": settings.get("donate_goal", DONATE_CONFIG["goal"]),
        "current": settings.get("donate_current", DONATE_CONFIG["current"]),
        "mono_url": settings.get("donate_mono_url", DONATE_CONFIG["mono_url"]),
        "coffee_url": settings.get("donate_coffee_url", DONATE_CONFIG["coffee_url"]),
        "patreon_url": settings.get("donate_patreon_url", DONATE_CONFIG["patreon_url"]),
    }
