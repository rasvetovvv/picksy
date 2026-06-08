"""Password hashing, bearer-token lifecycle, profile-image validation,
HIBP check and the in-process rate limiter.

These helpers don't talk to FastAPI directly — they take cursors / raw
inputs and return strings or raise HTTPException. Auth dependencies that
sit on top of these live in `core/auth.py`.
"""
import datetime
import hashlib
import re
import secrets
import time as _time
from typing import Optional

import bcrypt as _bcrypt
import httpx
from fastapi import HTTPException, Request

from backend.core.config import (
    BCRYPT_ROUNDS,
    HIBP_CHECK_ENABLED,
    MAX_PROFILE_IMAGE_CHARS,
    SESSION_TTL_SECONDS,
    TRUST_PROXY,
)


# ─── Password hashing ─────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    """Hash a password with bcrypt.

    bcrypt silently truncates inputs past 72 bytes, so we pre-hash long
    passwords through SHA-256 (binary, not the hex digest) — the resulting
    32-byte string fits safely under the limit while preserving entropy.
    """
    pw_bytes = (password or "").encode("utf-8")
    if len(pw_bytes) > 72:
        pw_bytes = hashlib.sha256(pw_bytes).digest()
    return _bcrypt.hashpw(pw_bytes, _bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(password: str, stored: str) -> bool:
    """Verify a password against a stored hash.

    Accepts both bcrypt (`$2a$`/`$2b$`/`$2y$` prefix) and the legacy
    salt:sha256_hex format so existing accounts keep working. After a
    successful verify on a legacy hash, callers should call
    needs_password_rehash() and upgrade the stored value.
    """
    if not stored:
        return False
    pw_bytes = (password or "").encode("utf-8")
    if stored.startswith("$2"):
        if len(pw_bytes) > 72:
            pw_bytes = hashlib.sha256(pw_bytes).digest()
        try:
            return _bcrypt.checkpw(pw_bytes, stored.encode("utf-8"))
        except Exception:
            return False
    # Legacy: salt_hex:sha256_hex
    try:
        salt, hashed = stored.split(":", 1)
        return hashlib.sha256((salt + (password or "")).encode()).hexdigest() == hashed
    except Exception:
        return False


def needs_password_rehash(stored: str) -> bool:
    """True if `stored` is in the legacy salt:sha256 format and should be
    upgraded to bcrypt on the next successful verify."""
    return bool(stored) and not stored.startswith("$2")


# ─── Have-I-Been-Pwned k-anonymity check ──────────────────────────────────
async def _is_password_pwned(password: str) -> bool:
    """Check the password against Have I Been Pwned's k-anonymity range API.

    Only the first 5 chars of the SHA-1 hex digest leave the server. Returns
    False on any error or when HIBP_CHECK_ENABLED is off so the registration
    flow never breaks because of an upstream outage.
    """
    if not HIBP_CHECK_ENABLED or not password:
        return False
    try:
        digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
        prefix, suffix = digest[:5], digest[5:]
        async with httpx.AsyncClient(timeout=2.5) as client:
            resp = await client.get(
                f"https://api.pwnedpasswords.com/range/{prefix}",
                headers={"Add-Padding": "true", "User-Agent": "Picksy-Security/1.0"},
            )
        if resp.status_code != 200:
            return False
        for line in resp.text.splitlines():
            h, _, count = line.partition(":")
            if h.strip() == suffix:
                try:
                    return int(count.strip() or 0) > 0
                except ValueError:
                    return True
    except Exception:
        return False
    return False


# ─── Profile image validation (avatar / banner) ───────────────────────────
_DATA_IMAGE_RE = re.compile(
    r'^data:image/(?P<mime>png|jpe?g|webp|gif);base64,(?P<b64>[A-Za-z0-9+/=]+)\s*$',
    re.IGNORECASE,
)


def _validate_profile_image(value, label: str):
    """Return a cleaned avatar / banner string or raise HTTPException.

    Accepts:
    - http(s):// URLs (validated, length-capped)
    - data:image/(png|jpeg|webp|gif);base64,... up to MAX_PROFILE_IMAGE_CHARS

    Rejects: SVG (script vector), other data URIs, javascript: / file: schemes,
    plain text, oversized payloads.
    Returns None when input is empty.
    """
    if not value:
        return None
    v = value.strip() if isinstance(value, str) else ""
    if not v:
        return None
    if len(v) > MAX_PROFILE_IMAGE_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"{label} too large (max {MAX_PROFILE_IMAGE_CHARS // 1024} KB encoded)",
        )
    if v.startswith("http://") or v.startswith("https://"):
        if len(v) > 2048:
            raise HTTPException(status_code=400, detail=f"{label} URL too long")
        return v
    if _DATA_IMAGE_RE.match(v):
        return v
    raise HTTPException(
        status_code=400,
        detail=f"{label} must be an http(s) URL or a png/jpeg/webp/gif data: URL",
    )


# ─── Bearer tokens ────────────────────────────────────────────────────────
def generate_token() -> str:
    return secrets.token_urlsafe(48)


# Sessions: we hand out a raw bearer token to the client but only store its
# SHA-256 hash in `users.token`. The hex digest is 64 chars, which still fits
# the existing VARCHAR(255). A leaked DB row can no longer be replayed as a
# bearer token directly. Tokens older than SESSION_TTL_SECONDS are rejected.
def _hash_token(raw: str) -> str:
    return hashlib.sha256((raw or "").encode("utf-8")).hexdigest()


def _store_token_for_user(cur, user_id: int, raw_token: str) -> None:
    """Persist the hashed form of a freshly minted bearer token.

    Writes `token_issued_at` when the column exists (added by the migration in
    init_db). Falls back to updating only `token` if the column hasn't been
    added yet, so a partial deploy doesn't 500 on login."""
    digest = _hash_token(raw_token)
    try:
        cur.execute(
            "UPDATE users SET token = %s, token_issued_at = CURRENT_TIMESTAMP WHERE id = %s",
            (digest, user_id),
        )
    except Exception:
        cur.execute("UPDATE users SET token = %s WHERE id = %s", (digest, user_id))


def _lookup_user_by_token(cur, raw_token: str, columns: str):
    """Look up a user by bearer token. Accepts both the new sha256 digest and
    legacy plaintext tokens during the transition window — once the migration
    in init_db wipes plaintext rows the second branch is a no-op.

    Also enforces SESSION_TTL_SECONDS when token_issued_at is present.
    Returns the user row or None."""
    digest = _hash_token(raw_token)
    # Newer hashed form (with optional issued_at check)
    try:
        cur.execute(
            f"SELECT {columns}, token_issued_at FROM users WHERE token = %s",
            (digest,),
        )
        row = cur.fetchone()
    except Exception:
        cur.execute(f"SELECT {columns} FROM users WHERE token = %s", (digest,))
        row = cur.fetchone()
    if row:
        issued = row.get("token_issued_at") if isinstance(row, dict) else None
        if issued is not None:
            try:
                if hasattr(issued, "replace") and getattr(issued, "tzinfo", None) is None:
                    issued = issued.replace(tzinfo=datetime.timezone.utc)
                age = (datetime.datetime.now(datetime.timezone.utc) - issued).total_seconds()
                if age > SESSION_TTL_SECONDS:
                    return None
            except Exception:
                pass
        if isinstance(row, dict):
            row.pop("token_issued_at", None)
        return row
    return None


# ─── Rate limiter (in-process; per worker) ────────────────────────────────
# NOTE: per process — when running uvicorn with --workers > 1, limits
# effectively multiply by N. For real multi-instance deployments switch
# to a Redis-backed limiter.
_rate_limit_store: dict[str, list[float]] = {}
_rate_limit_last_cleanup: float = 0.0
_RATE_LIMIT_CLEANUP_INTERVAL = 60   # full store sweep at most once per minute
_RATE_LIMIT_RETAIN_SECONDS = 3600   # drop timestamps older than 1 hour


def _client_ip(request: Request) -> str:
    if TRUST_PROXY:
        xff = request.headers.get("x-forwarded-for", "")
        if xff:
            return xff.split(",")[0].strip() or "unknown"
        real = request.headers.get("x-real-ip", "")
        if real:
            return real.strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _rate_limit(key: str, max_requests: int = 5, window_seconds: int = 60):
    global _rate_limit_last_cleanup
    now = _time.time()
    # Periodic full-store sweep so abandoned keys don't accumulate forever.
    if now - _rate_limit_last_cleanup > _RATE_LIMIT_CLEANUP_INTERVAL:
        cutoff = now - _RATE_LIMIT_RETAIN_SECONDS
        for k in list(_rate_limit_store.keys()):
            kept = [t for t in _rate_limit_store[k] if t > cutoff]
            if kept:
                _rate_limit_store[k] = kept
            else:
                _rate_limit_store.pop(k, None)
        _rate_limit_last_cleanup = now

    bucket = _rate_limit_store.get(key)
    if bucket is None:
        bucket = []
        _rate_limit_store[key] = bucket
    cutoff = now - window_seconds
    if bucket and bucket[0] < cutoff:
        bucket[:] = [t for t in bucket if t >= cutoff]
    if len(bucket) >= max_requests:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment.")
    bucket.append(now)
