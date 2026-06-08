"""MySQL connection factory + datetime serialization helpers."""
from typing import Optional

import pymysql

from backend.core.config import (
    MYSQL_DATABASE,
    MYSQL_HOST,
    MYSQL_PASSWORD,
    MYSQL_PORT,
    MYSQL_USER,
)


def get_db():
    # init_command pins the session timezone to UTC. All TIMESTAMP/DATETIME
    # values written by `CURRENT_TIMESTAMP` and read back are UTC, so the
    # _iso_utc() helper below can safely tag them with a 'Z' suffix.
    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
        init_command="SET time_zone = '+00:00'",
    )


def _iso_utc(dt) -> Optional[str]:
    """Render a datetime as an ISO-8601 string tagged with a UTC offset so
    the browser parses it correctly.

    MySQL hands us naive datetimes; since the session timezone is pinned to
    UTC (see get_db()), every naive datetime read from the DB is UTC. We
    append '+00:00' so JS `new Date(...)` parses it as UTC instead of local
    time. Aware datetimes are passed through unchanged.
    """
    if not dt:
        return None
    if not hasattr(dt, "isoformat"):
        try:
            return str(dt)
        except Exception:
            return None
    try:
        if getattr(dt, "tzinfo", None) is None:
            return dt.isoformat() + "+00:00"
        return dt.isoformat()
    except Exception:
        return None
