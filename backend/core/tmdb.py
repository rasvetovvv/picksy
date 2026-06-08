"""TMDB request helpers shared by every router that hits api.themoviedb.org.

We support BOTH key shapes in `TMDB_API_KEY`:
- v3 API key — passed as ?api_key=… query string
- v4 Bearer token (starts with `eyJ`) — sent as Authorization: Bearer …

`TMDB_IS_BEARER` is detected once at startup (backend.core.config).
"""
from typing import Optional

import httpx

from backend.core.config import TMDB_API_KEY, TMDB_IS_BEARER


def _tmdb_headers():
    if TMDB_IS_BEARER:
        return {"Authorization": f"Bearer {TMDB_API_KEY}", "accept": "application/json"}
    return {}


def _tmdb_params(extra: dict = None):
    params = {}
    if not TMDB_IS_BEARER:
        params["api_key"] = TMDB_API_KEY
    if extra:
        params.update(extra)
    return params


# In-memory cache for TMDB genre lookups to avoid repeated API calls.
_TMDB_GENRE_CACHE: dict[tuple, str] = {}


async def _fetch_tmdb_genres(media_type: str, tmdb_id: int) -> Optional[str]:
    """Fetch genre names for a TMDB id and return them as a comma-separated string.

    Returns None if TMDB is not configured or the request fails. Result is
    cached in-memory per process.
    """
    if not TMDB_API_KEY or not tmdb_id:
        return None
    if media_type not in ("movie", "tv"):
        return None
    cache_key = (media_type, int(tmdb_id))
    cached = _TMDB_GENRE_CACHE.get(cache_key)
    if cached is not None:
        return cached or None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"https://api.themoviedb.org/3/{media_type}/{tmdb_id}",
                params=_tmdb_params({"language": "en-US"}),
                headers=_tmdb_headers(),
            )
            if resp.status_code != 200:
                _TMDB_GENRE_CACHE[cache_key] = ""
                return None
            data = resp.json()
            names = [g.get("name", "").strip() for g in (data.get("genres") or []) if g.get("name")]
            joined = ", ".join(names)[:500]
            _TMDB_GENRE_CACHE[cache_key] = joined
            return joined or None
    except Exception:
        _TMDB_GENRE_CACHE[cache_key] = ""
        return None
