"""Google Books request helpers + volume normalization.

Shared between the /api/books/* router and the AI search flow (which also
hits Google Books to materialize AI-suggested titles into picksy cards).
"""
from backend.core.config import GOOGLE_BOOKS_API_KEY


def _google_books_params(extra: dict = None):
    params = {"maxResults": "20", "printType": "books"}
    if GOOGLE_BOOKS_API_KEY:
        params["key"] = GOOGLE_BOOKS_API_KEY
    if extra:
        params.update(extra)
    return params


def _normalize_book(item: dict) -> dict:
    """Convert Google Books volume to a flat shape similar to movies/tv."""
    volume_id = item.get("id") or ""
    info = item.get("volumeInfo") or {}
    image_links = info.get("imageLinks") or {}
    poster = (
        image_links.get("extraLarge")
        or image_links.get("large")
        or image_links.get("medium")
        or image_links.get("thumbnail")
        or image_links.get("smallThumbnail")
        or ""
    )
    if poster.startswith("http://"):
        poster = "https://" + poster[len("http://"):]

    published = info.get("publishedDate") or ""
    year = published.split("-")[0] if published else ""

    return {
        "id": volume_id,
        "title": info.get("title") or "",
        "subtitle": info.get("subtitle") or "",
        "authors": info.get("authors") or [],
        "description": info.get("description") or "",
        "categories": info.get("categories") or [],
        "average_rating": info.get("averageRating") or 0,
        "ratings_count": info.get("ratingsCount") or 0,
        "page_count": info.get("pageCount") or 0,
        "language": info.get("language") or "",
        "published_date": published,
        "year": year,
        "poster": poster,
        "info_link": info.get("infoLink") or info.get("canonicalVolumeLink") or "",
        "preview_link": info.get("previewLink") or "",
    }
