"""Mutable site-wide settings stored in the `site_settings` table.

Defaults live here; admin UI overrides land in the DB. Booleans are stored
as the strings "true"/"false"; everything else is stored as text (length
clamped to 1000 chars in save_site_settings).
"""
from backend.core.db import get_db


DEFAULT_SITE_SETTINGS = {
    "maintenance_mode": False,
    "maintenance_text": "Picksy тимчасово оновлюється. Поверніться трохи пізніше ✨",
    "registrations_enabled": True,
    "ai_enabled": True,
    "public_profiles_enabled": True,
    "trending_enabled": True,
    "daily_pick_enabled": True,
    "achievements_enabled": True,
    "top_banner_enabled": False,
    "top_banner_text": "🔥 Нове на Picksy: персональні рекомендації вже доступні!",
    "top_banner_url": "",
    "top_banner_button": "Детальніше",
    "bottom_ad_enabled": False,
    "bottom_ad_text": "Підпишись на оновлення Picksy та отримуй добірки щотижня.",
    "bottom_ad_url": "",
    "bottom_ad_button": "Перейти",
    "popup_enabled": False,
    "popup_force": False,
    "popup_title": "Спеціальна пропозиція",
    "popup_text": "Тут може бути ваша реклама або важливе оголошення.",
    "popup_url": "",
    "popup_button": "Відкрити",
    "profile_share_enabled": True,
    "feedback_enabled": True,
    "promo_banner_enabled": False,
    "promo_banner_text": "Picksy — твій персональний AI-помічник для підбору фільмів!",
    "promo_banner_icon": "🎯",
    "promo_banner_url": "",
    "promo_banner_button": "Дізнатися",
    "promo_banner_gradient": "purple",
    "game_enabled": True,
    "popup_version": "1",
    "freemium_enabled": False,
    "freemium_free_picks_per_day": "6",
    "freemium_free_save_limit": "20",
    "freemium_premium_price": "2.99",
    "freemium_pro_price": "4.99",
    "freemium_premium_price_7d": "0.99",
    "freemium_premium_price_14d": "1.99",
    "freemium_premium_price_30d": "2.99",
    "freemium_pro_price_7d": "1.99",
    "freemium_pro_price_14d": "3.49",
    "freemium_pro_price_30d": "4.99",
    "freemium_trial_enabled": True,
    "freemium_trial_days": "7",
    "freemium_payment_url": "",
    "freemium_bank_info": "",
    "analytics_enabled": False,
    "analytics_heatmap_enabled": False,
    "analytics_session_recording_enabled": False,
    "analytics_funnel_enabled": False,
}


def _parse_setting_value(value):
    if value is None:
        return None
    if value in ("true", "false"):
        return value == "true"
    return value


def _serialize_setting_value(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value)


def get_site_settings():
    settings = dict(DEFAULT_SITE_SETTINGS)
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT name, value FROM site_settings")
            for row in cur.fetchall() or []:
                if row["name"] in settings:
                    settings[row["name"]] = _parse_setting_value(row["value"])
        conn.close()
    except Exception:
        pass
    return settings


def save_site_settings(updates: dict):
    allowed = set(DEFAULT_SITE_SETTINGS.keys())
    clean = {}
    for key, value in (updates or {}).items():
        if key not in allowed:
            continue
        default = DEFAULT_SITE_SETTINGS[key]
        if isinstance(default, bool):
            clean[key] = bool(value)
        else:
            clean[key] = str(value or "")[:1000]
    if not clean:
        return get_site_settings()
    # Auto-increment popup_version when any popup setting changes
    popup_keys = {"popup_enabled", "popup_force", "popup_title", "popup_text", "popup_url", "popup_button"}
    if clean.keys() & popup_keys:
        current = get_site_settings()
        ver = int(current.get("popup_version") or "1")
        clean["popup_version"] = str(ver + 1)
    conn = get_db()
    with conn.cursor() as cur:
        for key, value in clean.items():
            cur.execute(
                "INSERT INTO site_settings (name, value) VALUES (%s, %s) ON DUPLICATE KEY UPDATE value = VALUES(value)",
                (key, _serialize_setting_value(value)),
            )
    conn.close()
    return get_site_settings()
