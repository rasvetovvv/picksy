"""Account lifecycle: register / login / Google sign-in / get-me /
change-password / delete-account.

Notes preserved from the original main.py:
- /register and /login share a generic error message and a 250 ms response
  floor to mitigate timing-based user enumeration.
- Tokens are minted by `generate_token()` and only the SHA-256 digest is
  written to the DB (see backend.core.security).
- /change-password rotates the bearer token so other devices are logged out.
"""
import asyncio
import re
import secrets
import time as _time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from backend.core.auth import get_current_user
from backend.core.config import GOOGLE_CLIENT_ID, MIN_PASSWORD_LENGTH
from backend.core.db import get_db
from backend.core.freemium import get_user_tier
from backend.core.security import (
    _client_ip,
    _hash_token,
    _is_password_pwned,
    _rate_limit,
    _store_token_for_user,
    generate_token,
    hash_password,
    needs_password_rehash,
    verify_password,
)
from backend.core.settings import get_site_settings
from backend.core.time import today_kyiv
from backend.models import (
    AuthRequest,
    ChangePasswordRequest,
    DeleteAccountRequest,
    GoogleAuthRequest,
)


router = APIRouter()


# Generic error used both for "email already taken" and for "registration
# could not be completed" cases so the response body alone doesn't let an
# attacker enumerate which emails exist on the platform.
_REGISTER_GENERIC_ERROR = (
    "Registration could not be completed. If you already have an account, please log in."
)


@router.post("/api/auth/register")
async def register(req: AuthRequest, request: Request):
    _rate_limit(f"auth:{_client_ip(request)}", max_requests=20, window_seconds=900)
    if not get_site_settings().get("registrations_enabled", True):
        raise HTTPException(status_code=403, detail="Registrations are currently disabled")
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password required")
    if not re.match(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", req.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(req.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters",
        )
    if len(req.password) > 256:
        raise HTTPException(status_code=400, detail="Password is too long")
    if not req.accepted_privacy:
        raise HTTPException(
            status_code=400,
            detail="Потрібно прийняти Політику конфіденційності щоб створити акаунт",
        )
    if await _is_password_pwned(req.password):
        raise HTTPException(
            status_code=400,
            detail="This password has appeared in a public data breach. Please choose a different one.",
        )

    # Hash the password BEFORE the existence check so the hash cost is paid on
    # both branches — keeps the response time near-constant whether the email
    # exists or not (mitigates timing-based user enumeration).
    password_hash = hash_password(req.password)
    token = generate_token()
    token_digest = _hash_token(token)
    start = _time.monotonic()

    duplicate = False
    user_id = None
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
            if cur.fetchone():
                duplicate = True
            else:
                try:
                    cur.execute(
                        "INSERT INTO users (email, password_hash, token, token_issued_at, accepted_privacy, privacy_accepted_at) VALUES (%s, %s, %s, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)",
                        (req.email, password_hash, token_digest),
                    )
                except Exception:
                    cur.execute(
                        "INSERT INTO users (email, password_hash, token) VALUES (%s, %s, %s)",
                        (req.email, password_hash, token_digest),
                    )
                user_id = cur.lastrowid
        conn.close()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Pad to a floor of ~250 ms so the duplicate path and the insert path
    # complete in similar wall-clock time even on a fast DB.
    elapsed = _time.monotonic() - start
    if elapsed < 0.25:
        await asyncio.sleep(0.25 - elapsed)

    if duplicate:
        raise HTTPException(status_code=400, detail=_REGISTER_GENERIC_ERROR)

    return {"token": token, "user": {"id": user_id, "email": req.email}}


@router.post("/api/auth/login")
async def login(req: AuthRequest, request: Request):
    _rate_limit(f"auth:{_client_ip(request)}", max_requests=20, window_seconds=900)
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE email = %s", (req.email,))
            user = cur.fetchone()

            if not user or not verify_password(req.password, user["password_hash"]):
                conn.close()
                raise HTTPException(status_code=401, detail="Invalid email or password")

            # Transparent upgrade from legacy salt:sha256 → bcrypt on first
            # successful login. Best-effort: if the update fails the login
            # still succeeds.
            if needs_password_rehash(user["password_hash"]):
                try:
                    new_hash = hash_password(req.password)
                    cur.execute(
                        "UPDATE users SET password_hash = %s WHERE id = %s",
                        (new_hash, user["id"]),
                    )
                except Exception:
                    pass

            token = generate_token()
            _store_token_for_user(cur, user["id"], token)
        conn.close()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    return {"token": token, "user": {"id": user["id"], "email": user["email"]}}


@router.post("/api/auth/google")
async def google_auth(req: GoogleAuthRequest, request: Request):
    """Authenticate or register a user via Google One Tap / Sign-In."""
    _rate_limit(f"auth:{_client_ip(request)}", max_requests=30, window_seconds=900)
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google auth is not configured")

    # Verify the Google ID token
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": req.credential},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        payload = resp.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to verify Google token")

    # Validate audience matches our client ID
    if payload.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Token audience mismatch")

    google_id = payload.get("sub")
    email = payload.get("email")
    if not google_id or not email:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    display_name = payload.get("name", "")

    try:
        conn = get_db()
        with conn.cursor() as cur:
            # Check if user already exists by google_id
            cur.execute("SELECT id, email FROM users WHERE google_id = %s", (google_id,))
            user = cur.fetchone()

            if user:
                # Existing Google user — refresh token
                token = generate_token()
                _store_token_for_user(cur, user["id"], token)
                conn.close()
                return {"token": token, "user": {"id": user["id"], "email": user["email"]}}

            # Check if user exists by email (registered with password before)
            cur.execute("SELECT id, email FROM users WHERE email = %s", (email,))
            user = cur.fetchone()

            if user:
                # Link Google account to existing user
                token = generate_token()
                token_digest = _hash_token(token)
                try:
                    cur.execute(
                        "UPDATE users SET google_id = %s, token = %s, token_issued_at = CURRENT_TIMESTAMP WHERE id = %s",
                        (google_id, token_digest, user["id"]),
                    )
                except Exception:
                    cur.execute(
                        "UPDATE users SET google_id = %s, token = %s WHERE id = %s",
                        (google_id, token_digest, user["id"]),
                    )
                conn.close()
                return {"token": token, "user": {"id": user["id"], "email": user["email"]}}

            # New user — register via Google
            if not get_site_settings().get("registrations_enabled", True):
                conn.close()
                raise HTTPException(status_code=403, detail="Registrations are currently disabled")

            token = generate_token()
            token_digest = _hash_token(token)
            # Google users get a random password hash (they never use it)
            dummy_hash = hash_password(secrets.token_urlsafe(32))
            try:
                cur.execute(
                    "INSERT INTO users (email, password_hash, token, token_issued_at, google_id, display_name, accepted_privacy, privacy_accepted_at) VALUES (%s, %s, %s, CURRENT_TIMESTAMP, %s, %s, 1, CURRENT_TIMESTAMP)",
                    (email, dummy_hash, token_digest, google_id, display_name or None),
                )
            except Exception:
                cur.execute(
                    "INSERT INTO users (email, password_hash, token, google_id) VALUES (%s, %s, %s, %s)",
                    (email, dummy_hash, token_digest, google_id),
                )
            user_id = cur.lastrowid
        conn.close()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    return {"token": token, "user": {"id": user_id, "email": email}}


@router.get("/api/auth/me")
async def get_me(user=Depends(get_current_user)):
    tier = get_user_tier(user["id"])
    settings = get_site_settings()
    freemium_on = settings.get("freemium_enabled", False)
    result = {**user, "tier": tier, "freemium_enabled": freemium_on,
              "is_verified": bool(user.get("is_verified")),
              "role": user.get("role", "user")}
    if freemium_on and tier == "free":
        try:
            conn = get_db()
            with conn.cursor() as cur:
                today = today_kyiv().isoformat()
                cur.execute("SELECT pick_count FROM daily_pick_counts WHERE user_id=%s AND pick_date=%s", (user["id"], today))
                row = cur.fetchone()
                result["picks_today"] = row["pick_count"] if row else 0
                result["picks_limit"] = int(settings.get("freemium_free_picks_per_day", "6"))
                cur.execute("SELECT COUNT(*) AS c FROM saved_movies WHERE user_id=%s", (user["id"],))
                sm = (cur.fetchone() or {}).get("c", 0)
                cur.execute("SELECT COUNT(*) AS c FROM saved_tv WHERE user_id=%s", (user["id"],))
                st = (cur.fetchone() or {}).get("c", 0)
                cur.execute("SELECT COUNT(*) AS c FROM saved_books WHERE user_id=%s", (user["id"],))
                sb = (cur.fetchone() or {}).get("c", 0)
                result["saved_total"] = sm + st + sb
                result["save_limit"] = int(settings.get("freemium_free_save_limit", "20"))
            conn.close()
        except Exception:
            pass
    return result


@router.post("/api/auth/change-password")
async def change_password(req: ChangePasswordRequest, request: Request, user=Depends(get_current_user)):
    # Keyed on the user, not the IP — a thief with a valid token shouldn't be
    # able to rotate IPs and brute-force the current password.
    _rate_limit(f"pwd-change:{user['id']}", max_requests=5, window_seconds=900)
    _rate_limit(f"pwd-change-ip:{_client_ip(request)}", max_requests=20, window_seconds=900)
    if len(req.new_password) < 10:
        raise HTTPException(status_code=400, detail="New password must be at least 10 characters")
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id = %s", (user["id"],))
            row = cur.fetchone()
            if not row or not verify_password(req.current_password, row["password_hash"]):
                conn.close()
                raise HTTPException(status_code=401, detail="Current password is incorrect")
            new_hash = hash_password(req.new_password)
            new_token = generate_token()
            new_digest = _hash_token(new_token)
            try:
                cur.execute(
                    "UPDATE users SET password_hash = %s, token = %s, token_issued_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (new_hash, new_digest, user["id"]),
                )
            except Exception:
                cur.execute(
                    "UPDATE users SET password_hash = %s, token = %s WHERE id = %s",
                    (new_hash, new_digest, user["id"]),
                )
        conn.close()
        return {"token": new_token, "message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")


@router.delete("/api/auth/account")
async def delete_own_account(req: DeleteAccountRequest, request: Request, user=Depends(get_current_user)):
    # Rate-limit deletion attempts per IP so a stolen token can't just be
    # used to grind through password guesses.
    _rate_limit(f"delete-account:{_client_ip(request)}", max_requests=5, window_seconds=600)
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash, google_id FROM users WHERE id = %s", (user["id"],))
            row = cur.fetchone()
            if not row:
                conn.close()
                raise HTTPException(status_code=404, detail="User not found")
            # Google-only users may never have set a real password — they get
            # to confirm with an explicit string instead.
            google_only = bool(row.get("google_id")) and not req.password
            if google_only:
                if (req.confirm or "").strip() != "DELETE":
                    conn.close()
                    raise HTTPException(
                        status_code=400,
                        detail='Send {"confirm":"DELETE"} to confirm account deletion',
                    )
            else:
                if not req.password:
                    conn.close()
                    raise HTTPException(status_code=400, detail="Password required to delete account")
                if not verify_password(req.password, row["password_hash"]):
                    conn.close()
                    raise HTTPException(status_code=401, detail="Password incorrect")
            cur.execute("DELETE FROM users WHERE id = %s", (user["id"],))
        conn.close()
        return {"message": "Account deleted successfully"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
