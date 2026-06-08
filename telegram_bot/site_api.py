"""HTTP client for fetching data from the Picksy website API.

The bot does NOT store its own daily pick — it reads whatever is currently
on the site (via existing /api/daily-pick endpoint). This keeps Telegram
in sync with the website automatically.
"""
from __future__ import annotations

import logging
import os
import random
from typing import List, Optional

import httpx

from . import config

log = logging.getLogger("picksy_bot.site_api")

DEFAULT_TIMEOUT = 20.0


async def fetch_daily_pick(item_type: str = "movie", lang: str = "uk") -> Optional[dict]:
    """Fetch today's daily pick of given type from the website.

    Returns the raw API payload or None on error.
    """
    url = config.API_URL.rstrip("/") + "/api/daily-pick"
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            r = await client.get(url, params={"type": item_type, "lang": lang})
            if r.status_code != 200:
                log.warning("daily-pick %s -> HTTP %s", item_type, r.status_code)
                return None
            return r.json()
    except httpx.HTTPError as e:
        log.warning("daily-pick %s fetch error: %s", item_type, e)
        return None


async def fetch_site_stats() -> Optional[dict]:
    """Fetch a short snapshot of site activity for the admin dashboard.

    Tries `/api/picks/stats` (live activity bar counters). Returns a flat
    dict of human-readable {label: value} pairs, or None on error.
    """
    url = config.API_URL.rstrip("/") + "/api/picks/stats"
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            r = await client.get(url)
            if r.status_code != 200:
                log.warning("site stats -> HTTP %s", r.status_code)
                return None
            data = r.json() or {}
    except httpx.HTTPError as e:
        log.warning("site stats fetch error: %s", e)
        return None
    # Flatten/labelize whatever the endpoint returns. We're defensive about
    # field names because the site API has evolved over time.
    out: dict = {}
    label_map = {
        "online_now": "Онлайн зараз",
        "online": "Онлайн зараз",
        "picks_today": "Підборів за сьогодні",
        "picks_total": "Підборів всього",
        "picks_24h": "Підборів за 24г",
        "total_picks": "Підборів всього",
        "movies": "Фільмів",
        "tv": "Серіалів",
        "books": "Книг",
        "users_today": "Юзерів сьогодні",
    }
    for k, v in data.items():
        if isinstance(v, (int, float, str)):
            out[label_map.get(k, k)] = v
    return out or None


async def fetch_all_daily_picks(lang: str = "uk") -> dict:
    """Fetch movie + tv + book daily picks. Returns a dict with each type's data
    (or None for types that failed to load).
    """
    out = {}
    for kind in ("movie", "tv", "book"):
        out[kind] = await fetch_daily_pick(kind, lang)
    return out


def _poster_url(payload: dict) -> Optional[str]:
    """Best-effort poster URL extraction from /api/daily-pick payload."""
    if not payload:
        return None
    # Site sometimes returns full URLs, sometimes TMDB paths
    for key in ("poster", "poster_url", "image", "poster_path"):
        v = payload.get(key)
        if v:
            if v.startswith("http"):
                return v
            if v.startswith("/"):
                return "https://image.tmdb.org/t/p/w780" + v
            return v
    return None


def _title(payload: dict) -> str:
    if not payload:
        return ""
    return (
        payload.get("title")
        or payload.get("name")
        or payload.get("original_name")
        or payload.get("original_title")
        or ""
    )


def _year(payload: dict) -> str:
    if not payload:
        return ""
    for key in ("release_date", "first_air_date", "year"):
        v = payload.get(key)
        if v:
            s = str(v)
            if len(s) >= 4 and s[:4].isdigit():
                return s[:4]
    return ""


def _detail_url(item_type: str, payload: dict) -> str:
    if not payload:
        return config.SITE_URL
    iid = payload.get("id") or payload.get("tmdb_id") or ""
    prefix = {
        "movie": "/descmovie/",
        "tv": "/desctv/",
        "book": "/descbook/",
    }.get(item_type, "/")
    if not iid:
        return config.SITE_URL
    return f"{config.SITE_URL}{prefix}{iid}"


def extract_card(item_type: str, payload: Optional[dict]) -> Optional[dict]:
    """Normalise a /api/daily-pick payload into a card dict the bot can render."""
    if not payload:
        return None
    title = _title(payload)
    if not title:
        return None
    return {
        "type": item_type,
        "id": payload.get("id"),
        "title": title,
        "year": _year(payload),
        "poster": _poster_url(payload),
        "url": _detail_url(item_type, payload),
        "overview": (payload.get("overview") or payload.get("description") or "")[:500],
        "authors": payload.get("authors") or [],
    }


# ─── TMDB helpers for Friday Picks ─────────────────────────────────────────

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
_TMDB_IS_BEARER = TMDB_API_KEY.startswith("eyJ") if TMDB_API_KEY else False


def _tmdb_headers() -> dict:
    if _TMDB_IS_BEARER:
        return {"Authorization": f"Bearer {TMDB_API_KEY}", "accept": "application/json"}
    return {"accept": "application/json"}


def _tmdb_params(extra: dict) -> dict:
    if _TMDB_IS_BEARER:
        return extra
    params = dict(extra)
    params["api_key"] = TMDB_API_KEY
    return params


def _weighted_score(vote_avg: float, vote_count: int,
                    mean: float = 6.5, min_votes: int = 300) -> float:
    """Bayesian weighted rating — films with few votes don't dominate."""
    v, m, R, C = vote_count, min_votes, vote_avg, mean
    return round((v / (v + m)) * R + (m / (v + m)) * C, 3)


async def fetch_friday_movies(count: int = 3) -> List[dict]:
    """Fetch a curated set of quality movies for the Friday evening broadcast.

    Uses TMDB discover with multiple strategies, deduplicates, and ranks by
    weighted Bayesian score so that obscure 9.9-rated films with 2 votes
    never appear.  Returns ``count`` movies as card dicts.
    """
    if not TMDB_API_KEY:
        return []
    import datetime
    year = datetime.datetime.utcnow().year
    all_results: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Strategy 1: high-rated + many votes (current year)
            r1 = await client.get(
                "https://api.themoviedb.org/3/discover/movie",
                params=_tmdb_params({
                    "language": "uk-UA",
                    "include_adult": "false",
                    "sort_by": "vote_average.desc",
                    "vote_count.gte": "500",
                    "primary_release_year": str(year),
                    "with_runtime.gte": "60",
                    "page": "1",
                }),
                headers=_tmdb_headers(),
            )
            if r1.status_code == 200:
                all_results.extend((r1.json() or {}).get("results") or [])

            # Strategy 2: popular movies (current year)
            r2 = await client.get(
                "https://api.themoviedb.org/3/discover/movie",
                params=_tmdb_params({
                    "language": "uk-UA",
                    "include_adult": "false",
                    "sort_by": "popularity.desc",
                    "vote_count.gte": "200",
                    "primary_release_year": str(year),
                    "with_runtime.gte": "60",
                    "page": "1",
                }),
                headers=_tmdb_headers(),
            )
            if r2.status_code == 200:
                all_results.extend((r2.json() or {}).get("results") or [])

            # Strategy 3: recent top-rated (any year, last 2 years)
            r3 = await client.get(
                "https://api.themoviedb.org/3/discover/movie",
                params=_tmdb_params({
                    "language": "uk-UA",
                    "include_adult": "false",
                    "sort_by": "vote_average.desc",
                    "vote_count.gte": "1000",
                    "primary_release_date.gte": f"{year - 2}-01-01",
                    "with_runtime.gte": "60",
                    "page": "1",
                }),
                headers=_tmdb_headers(),
            )
            if r3.status_code == 200:
                all_results.extend((r3.json() or {}).get("results") or [])
    except Exception as e:
        log.warning("friday TMDB fetch error: %s", e)
        return []

    # Deduplicate
    seen: set[int] = set()
    unique: list[dict] = []
    for m in all_results:
        mid = m.get("id")
        if not mid or mid in seen:
            continue
        if not m.get("title"):
            continue
        seen.add(mid)
        unique.append(m)

    # Score and sort
    scored = []
    for m in unique:
        va = float(m.get("vote_average") or 0)
        vc = int(m.get("vote_count") or 0)
        if vc < 50:
            continue
        score = _weighted_score(va, vc)
        scored.append((score, m))
    scored.sort(key=lambda x: x[0], reverse=True)

    # Pick top candidates with some randomness for variety
    top_pool = scored[:max(count * 4, 15)]
    if len(top_pool) > count:
        picked = random.sample(top_pool, count)
    else:
        picked = top_pool[:count]
    picked.sort(key=lambda x: x[0], reverse=True)

    cards: list[dict] = []
    for _score, m in picked:
        mid = m.get("id")
        poster_path = m.get("poster_path")
        poster = f"https://image.tmdb.org/t/p/w342{poster_path}" if poster_path else None
        rel_year = (m.get("release_date") or "")[:4]
        cards.append({
            "type": "movie",
            "id": mid,
            "title": m.get("title") or "",
            "original_title": m.get("original_title") or "",
            "year": rel_year,
            "rating": round(float(m.get("vote_average") or 0), 1),
            "vote_count": int(m.get("vote_count") or 0),
            "poster": poster,
            "url": f"{config.SITE_URL}/descmovie/{mid}",
            "overview": (m.get("overview") or "")[:300],
        })
    return cards


async def fetch_friday_tv(count: int = 2) -> List[dict]:
    """Fetch quality TV series for Friday picks, same weighted approach."""
    if not TMDB_API_KEY:
        return []
    import datetime
    year = datetime.datetime.utcnow().year
    all_results: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r1 = await client.get(
                "https://api.themoviedb.org/3/discover/tv",
                params=_tmdb_params({
                    "language": "uk-UA",
                    "include_adult": "false",
                    "sort_by": "vote_average.desc",
                    "vote_count.gte": "300",
                    "first_air_date_year": str(year),
                    "page": "1",
                }),
                headers=_tmdb_headers(),
            )
            if r1.status_code == 200:
                all_results.extend((r1.json() or {}).get("results") or [])
            r2 = await client.get(
                "https://api.themoviedb.org/3/discover/tv",
                params=_tmdb_params({
                    "language": "uk-UA",
                    "include_adult": "false",
                    "sort_by": "popularity.desc",
                    "vote_count.gte": "100",
                    "first_air_date_year": str(year),
                    "page": "1",
                }),
                headers=_tmdb_headers(),
            )
            if r2.status_code == 200:
                all_results.extend((r2.json() or {}).get("results") or [])
    except Exception as e:
        log.warning("friday TV TMDB error: %s", e)
        return []

    seen: set[int] = set()
    unique: list[dict] = []
    for m in all_results:
        mid = m.get("id")
        if not mid or mid in seen or not m.get("name"):
            continue
        seen.add(mid)
        unique.append(m)

    scored = []
    for m in unique:
        va = float(m.get("vote_average") or 0)
        vc = int(m.get("vote_count") or 0)
        if vc < 30:
            continue
        scored.append((_weighted_score(va, vc), m))
    scored.sort(key=lambda x: x[0], reverse=True)

    top_pool = scored[:max(count * 4, 10)]
    if len(top_pool) > count:
        picked = random.sample(top_pool, count)
    else:
        picked = top_pool[:count]
    picked.sort(key=lambda x: x[0], reverse=True)

    cards: list[dict] = []
    for _score, m in picked:
        mid = m.get("id")
        poster_path = m.get("poster_path")
        poster = f"https://image.tmdb.org/t/p/w342{poster_path}" if poster_path else None
        cards.append({
            "type": "tv",
            "id": mid,
            "title": m.get("name") or "",
            "original_title": m.get("original_name") or "",
            "year": (m.get("first_air_date") or "")[:4],
            "rating": round(float(m.get("vote_average") or 0), 1),
            "vote_count": int(m.get("vote_count") or 0),
            "poster": poster,
            "url": f"{config.SITE_URL}/desctv/{mid}",
            "overview": (m.get("overview") or "")[:300],
        })
    return cards
