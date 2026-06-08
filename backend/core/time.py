"""Time helpers anchored on Europe/Kyiv local midnight.

Picksy users are mostly in Kyiv, so all "daily" resets (daily pick, pick
counts, duo limits, gift-cooldown windows, "today" labels …) anchor on
Europe/Kyiv local midnight rather than server-UTC midnight. Before this,
daily counters reset at 02–03 AM Kyiv time depending on DST, which felt
broken to users who expected a fresh day at 00:00.
"""
import datetime

try:
    from zoneinfo import ZoneInfo  # py3.9+
    KYIV_TZ = ZoneInfo("Europe/Kyiv")
except Exception:  # pragma: no cover — fallback for very old Pythons
    KYIV_TZ = datetime.timezone(datetime.timedelta(hours=2))  # EET (no DST)


def now_kyiv() -> datetime.datetime:
    """Current wall-clock datetime in Europe/Kyiv (tz-aware)."""
    return datetime.datetime.now(KYIV_TZ)


def today_kyiv() -> datetime.date:
    """Today's date in Europe/Kyiv. Use this anywhere daily resets matter."""
    return now_kyiv().date()


def today_kyiv_str() -> str:
    """ISO date string (YYYY-MM-DD) for today in Europe/Kyiv."""
    return today_kyiv().isoformat()
