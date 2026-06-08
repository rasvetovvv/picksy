"""Google Books proxies — discover (filtered browse) and free-text search.

Google Books does not require an API key for low-volume use; the key in
`GOOGLE_BOOKS_API_KEY` only extends the daily quota and isn't enforced
here.
"""
import asyncio

import httpx
from fastapi import APIRouter, HTTPException

from backend.core.books import _google_books_params, _normalize_book


router = APIRouter()


@router.get("/api/books/discover")
async def proxy_discover_books(
    page: int = 1,
    subject: str = "",
    query: str = "",
    lang: str = "",
):
    """Discover books via Google Books API.

    `subject` follows the Google Books convention (e.g. "fiction", "mystery").
    `query` adds free-text search terms. `lang` filters by language code (en, uk, ru, ...).
    """
    q_parts = []
    if query:
        q_parts.append(query.strip())
    if subject:
        q_parts.append(f"subject:{subject.strip()}")
    if not q_parts:
        # Default browse query — popular fiction
        q_parts.append("subject:fiction")

    page_size = 20
    start_index = max(0, (int(page) - 1) * page_size)

    extra = {"q": " ".join(q_parts), "startIndex": str(start_index), "orderBy": "relevance"}
    if lang:
        extra["langRestrict"] = lang
    params = _google_books_params(extra)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = None
            for _attempt in range(2):
                resp = await client.get(
                    "https://www.googleapis.com/books/v1/volumes",
                    params=params,
                )
                if resp.status_code == 503:
                    await asyncio.sleep(1)
                    continue
                break
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"Google Books error: {resp.text[:200]}")
            data = resp.json()
            items = data.get("items") or []
            results = [_normalize_book(it) for it in items if (it.get("volumeInfo") or {}).get("title")]
            return {
                "page": int(page),
                "total_results": data.get("totalItems", len(results)),
                "results": results,
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/books/search")
async def proxy_search_books(q: str = "", query: str = "", lang: str = ""):
    """Free-text book search. Accepts ?q= or ?query= for compatibility."""
    q = (q or query or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Query string `q` is required")
    extra = {"q": q.strip(), "orderBy": "relevance"}
    if lang:
        extra["langRestrict"] = lang
    params = _google_books_params(extra)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://www.googleapis.com/books/v1/volumes",
                params=params,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"Google Books error: {resp.text[:200]}")
            data = resp.json()
            items = data.get("items") or []
            return {
                "results": [_normalize_book(it) for it in items if (it.get("volumeInfo") or {}).get("title")],
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
