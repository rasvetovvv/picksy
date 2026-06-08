"""Pydantic request/response models used across multiple routers.

Domain-local models (mascot, match, blog, …) live next to their endpoints
inside `backend.routers.*` — only the central, reused ones land here.
"""
from typing import Optional

from pydantic import BaseModel


class AuthRequest(BaseModel):
    email: str
    password: str
    accepted_privacy: Optional[bool] = None


class GoogleAuthRequest(BaseModel):
    credential: str


class AISearchRequest(BaseModel):
    query: str
    type: str = "movie"  # "movie" | "tv" | "book"
    lang: str = "uk"
    exclude_titles: list[str] = []
    liked_titles: list[str] = []
    mood: str = ""


class SaveMovieRequest(BaseModel):
    tmdb_id: int
    title: str
    poster: Optional[str] = None
    year: Optional[str] = None
    rating: Optional[str] = None
    tmdb_url: Optional[str] = None
    genres: Optional[str] = None


class SaveTvRequest(BaseModel):
    tmdb_id: int
    title: str
    poster: Optional[str] = None
    year: Optional[str] = None
    rating: Optional[str] = None
    tmdb_url: Optional[str] = None
    genres: Optional[str] = None


class SaveBookRequest(BaseModel):
    volume_id: str
    title: str
    poster: Optional[str] = None
    year: Optional[str] = None
    rating: Optional[str] = None
    book_url: Optional[str] = None
    genres: Optional[str] = None


class DuoCreateRequest(BaseModel):
    name: str
    genres: list[str] = []
    mood: str = ""
    lang: str = "uk"


class DuoJoinRequest(BaseModel):
    code: str
    name: str


class DuoPreferencesRequest(BaseModel):
    code: str
    slot: str  # "creator" | "joiner"
    genres: list[str] = []
    mood: str = ""


class StatsEventRequest(BaseModel):
    event: str


class HistoryItemRequest(BaseModel):
    type: str  # "movie" | "tv" | "book"
    item_id: str
    title: str
    poster: Optional[str] = None
    year: Optional[str] = None
    rating: Optional[str] = None
    item_url: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_emoji: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    accent_color: Optional[str] = None
    fav_film_id: Optional[str] = None
    fav_film_title: Optional[str] = None
    fav_film_poster: Optional[str] = None
    fav_film_type: Optional[str] = None
    fav_film_comment: Optional[str] = None
    social_telegram: Optional[str] = None
    social_instagram: Optional[str] = None
    social_letterboxd: Optional[str] = None
    social_website: Optional[str] = None
    show_dna: Optional[bool] = None
    show_psycho: Optional[bool] = None
    show_zodiac: Optional[bool] = None
    show_recs: Optional[bool] = None
    show_top: Optional[bool] = None
    show_showcase: Optional[bool] = None


class FeedbackRequest(BaseModel):
    message: str
    email: Optional[str] = None
    category: str = "general"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    # Password-based users must send `password`. Google-only users (no real
    # password to type) must send confirm="DELETE" to acknowledge the action.
    password: Optional[str] = None
    confirm: Optional[str] = None
