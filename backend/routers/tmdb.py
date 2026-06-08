"""TMDB discover / videos proxies for movies and TV series.

Frontend hits these instead of TMDB directly so we don't expose the API
key to the browser, can enforce language/locale defaults, and can apply
the "exclude Animation by default" rule consistently across both lists.
"""
import httpx
from fastapi import APIRouter, HTTPException

from backend.core.config import TMDB_API_KEY
from backend.core.tmdb import _tmdb_headers, _tmdb_params


router = APIRouter()


# ─── Movies ───────────────────────────────────────────────────────────────
@router.get("/api/movies/discover")
async def proxy_discover_movies(
    page: int = 1,
    genre: str = "",
    year_from: str = "",
    year_to: str = "",
    rating: str = "",
    country: str = "",
    lang: str = "uk",
):
    if not TMDB_API_KEY:
        raise HTTPException(status_code=503, detail="TMDB API key not configured")

    language = "uk-UA" if lang == "uk" else "en-US"
    params = _tmdb_params({
        "language": language,
        "sort_by": "popularity.desc",
        "vote_count.gte": "50",
        "page": str(page),
    })
    if genre == "anime":
        # Special "Anime" filter — Animation genre + Japan origin
        params["with_genres"] = "16"
        params["with_origin_country"] = "JP"
    elif genre:
        params["with_genres"] = genre
    else:
        # Exclude Animation (16) by default — users can still pick it explicitly
        params["without_genres"] = "16"
    if year_from:
        params["primary_release_date.gte"] = f"{year_from}-01-01"
    if year_to:
        params["primary_release_date.lte"] = f"{year_to}-12-31"
    if rating:
        params["vote_average.gte"] = rating
    if country and genre != "anime":
        params["with_origin_country"] = country

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.themoviedb.org/3/discover/movie",
                params=params,
                headers=_tmdb_headers(),
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"TMDB error: {resp.text[:200]}")
            return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/movies/{movie_id}/videos")
async def proxy_movie_videos(movie_id: int, lang: str = "uk"):
    if not TMDB_API_KEY:
        raise HTTPException(status_code=503, detail="TMDB API key not configured")

    language = "uk-UA" if lang == "uk" else "en-US"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://api.themoviedb.org/3/movie/{movie_id}/videos",
                params=_tmdb_params({"language": language}),
                headers=_tmdb_headers(),
            )
            if resp.status_code == 200:
                data = resp.json()
                videos = data.get("results", [])
                if not videos:
                    resp2 = await client.get(
                        f"https://api.themoviedb.org/3/movie/{movie_id}/videos",
                        params=_tmdb_params({"language": "en-US"}),
                        headers=_tmdb_headers(),
                    )
                    if resp2.status_code == 200:
                        videos = resp2.json().get("results", [])
                return {"results": [v for v in videos if v.get("site") == "YouTube"]}
            return {"results": []}
    except Exception:
        return {"results": []}


# ─── TV Series ────────────────────────────────────────────────────────────
@router.get("/api/tv/discover")
async def proxy_discover_tv(
    page: int = 1,
    genre: str = "",
    year_from: str = "",
    year_to: str = "",
    rating: str = "",
    country: str = "",
    lang: str = "uk",
):
    if not TMDB_API_KEY:
        raise HTTPException(status_code=503, detail="TMDB API key not configured")

    language = "uk-UA" if lang == "uk" else "en-US"
    params = _tmdb_params({
        "language": language,
        "sort_by": "popularity.desc",
        "vote_count.gte": "50",
        "page": str(page),
    })
    if genre == "anime":
        # Special "Anime" filter — Animation genre + Japan origin
        params["with_genres"] = "16"
        params["with_origin_country"] = "JP"
    elif genre:
        params["with_genres"] = genre
    else:
        # Exclude Animation (16) by default — users can still pick it explicitly
        params["without_genres"] = "16"
    if year_from:
        params["first_air_date.gte"] = f"{year_from}-01-01"
    if year_to:
        params["first_air_date.lte"] = f"{year_to}-12-31"
    if rating:
        params["vote_average.gte"] = rating
    if country and genre != "anime":
        params["with_origin_country"] = country

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.themoviedb.org/3/discover/tv",
                params=params,
                headers=_tmdb_headers(),
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"TMDB error: {resp.text[:200]}")
            return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/tv/{tv_id}/videos")
async def proxy_tv_videos(tv_id: int, lang: str = "uk"):
    if not TMDB_API_KEY:
        raise HTTPException(status_code=503, detail="TMDB API key not configured")

    language = "uk-UA" if lang == "uk" else "en-US"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://api.themoviedb.org/3/tv/{tv_id}/videos",
                params=_tmdb_params({"language": language}),
                headers=_tmdb_headers(),
            )
            if resp.status_code == 200:
                data = resp.json()
                videos = data.get("results", [])
                if not videos:
                    resp2 = await client.get(
                        f"https://api.themoviedb.org/3/tv/{tv_id}/videos",
                        params=_tmdb_params({"language": "en-US"}),
                        headers=_tmdb_headers(),
                    )
                    if resp2.status_code == 200:
                        videos = resp2.json().get("results", [])
                return {"results": [v for v in videos if v.get("site") == "YouTube"]}
            return {"results": []}
    except Exception:
        return {"results": []}
