"""UTF-8 JSON response (preserve emoji as-is instead of \\uXXXX escapes)."""
import json

from fastapi.responses import JSONResponse


class UTF8JSONResponse(JSONResponse):
    """FastAPI's default JSONResponse uses ensure_ascii=True which turns every
    emoji/Cyrillic character into \\uXXXX escape sequences.  Those sequences
    are technically valid JSON, but some downstream paths (double-decoded
    strings, innerHTML assignment, copy-paste from DevTools) can surface them
    as literal backslash-u sequences or garbled characters.  Using
    ensure_ascii=False encodes the response body directly in UTF-8 so emojis
    and Cyrillic letters travel as real characters."""

    def render(self, content) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")
