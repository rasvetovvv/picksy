#!/usr/bin/env python3
"""Generate Picksy OG images.

This script renders:
- frontend/og/feed.png — OG image for /feed (the community feed page)
- frontend/og/archetype-<slug>.png — refreshed archetype OG images

It uses Pillow with the system DejaVu Sans font (Cyrillic-capable) and the
NotoColorEmoji font (for the hero emoji). Layout mirrors the established
Picksy OG style used by /match, /profile, /explore, /archetype/all.

Run from the repo root:

    python3 scripts/generate_og_images.py
"""
from __future__ import annotations

import json
import math
import os
from typing import Iterable, Optional, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont


REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
OG_DIR = os.path.join(REPO_ROOT, "frontend", "og")
ARCHETYPES_PATH = os.path.join(REPO_ROOT, "frontend", "data", "archetypes.json")

W, H = 1200, 630

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_EMOJI = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"


# ───────────────────────── primitives ─────────────────────────

def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def _emoji_font(size: int) -> Optional[ImageFont.FreeTypeFont]:
    """NotoColorEmoji is a fixed-bitmap font; only certain sizes load. We use
    the supported bitmap size (109) and downscale via render-then-resize."""
    if not os.path.exists(FONT_EMOJI):
        return None
    try:
        return ImageFont.truetype(FONT_EMOJI, size=109)
    except Exception:
        return None


def hex_to_rgb(s: str) -> Tuple[int, int, int]:
    s = s.lstrip("#")
    if len(s) == 3:
        s = "".join(ch * 2 for ch in s)
    return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)


def lerp(a: Tuple[int, int, int], b: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def linear_gradient(size: Tuple[int, int],
                    stops: Iterable[Tuple[float, Tuple[int, int, int]]],
                    angle_deg: float = 135.0) -> Image.Image:
    """Rasterise a linear gradient with named stops. `angle_deg` follows CSS
    convention (0deg = upwards, 90deg = right, 135deg = down-right)."""
    w, h = size
    img = Image.new("RGB", size, stops[0][1])
    pixels = img.load()
    rad = math.radians(angle_deg - 90.0)
    dx, dy = math.cos(rad), math.sin(rad)
    # project corners onto the axis to determine extents
    proj = [
        0 * dx + 0 * dy,
        w * dx + 0 * dy,
        0 * dx + h * dy,
        w * dx + h * dy,
    ]
    p_min, p_max = min(proj), max(proj)
    span = max(p_max - p_min, 1.0)
    sorted_stops = sorted(stops, key=lambda s: s[0])
    for y in range(h):
        for x in range(w):
            t = (x * dx + y * dy - p_min) / span
            t = max(0.0, min(1.0, t))
            # find segment
            for i in range(len(sorted_stops) - 1):
                t0, c0 = sorted_stops[i]
                t1, c1 = sorted_stops[i + 1]
                if t0 <= t <= t1:
                    seg = (t - t0) / max(t1 - t0, 1e-6)
                    pixels[x, y] = lerp(c0, c1, seg)
                    break
            else:
                pixels[x, y] = sorted_stops[-1][1]
    return img


def radial_blob(size: Tuple[int, int],
                center: Tuple[int, int],
                radius: int,
                color: Tuple[int, int, int],
                alpha: int = 180) -> Image.Image:
    """Soft radial light source on a transparent canvas."""
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx, cy = center
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=(color[0], color[1], color[2], alpha),
    )
    return layer.filter(ImageFilter.GaussianBlur(radius=int(radius * 0.55)))


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def render_emoji_image(emoji: str, target_size: int) -> Optional[Image.Image]:
    """Return an RGBA image of `emoji` at approximately `target_size`px.

    NotoColorEmoji is a bitmap font fixed at 109px, so we render at 109 then
    resize. Returns None when the glyph is not in the font (e.g. obscure
    alchemical/symbol codepoints) so callers can pick a fallback.
    """
    if not emoji:
        return None
    font = _emoji_font(target_size)
    if font is None:
        return None
    bitmap_size = 109
    tmp = Image.new("RGBA", (bitmap_size * 2, bitmap_size * 2), (0, 0, 0, 0))
    tdraw = ImageDraw.Draw(tmp)
    try:
        tdraw.text((bitmap_size // 2, bitmap_size // 2), emoji, font=font,
                   embedded_color=True, anchor="mm")
    except TypeError:
        tdraw.text((bitmap_size // 2, bitmap_size // 2), emoji, font=font, anchor="mm")
    bbox = tmp.getbbox()
    if not bbox:
        return None  # glyph missing
    tmp = tmp.crop(bbox)
    if tmp.size[0] == 0 or tmp.size[1] == 0:
        return None
    scale = target_size / max(tmp.size)
    new_size = (max(1, int(tmp.size[0] * scale)), max(1, int(tmp.size[1] * scale)))
    return tmp.resize(new_size, Image.LANCZOS)


def draw_emoji(canvas: Image.Image, emoji: str, target_size: int,
               position: Tuple[int, int],
               fallback: Optional[str] = None) -> None:
    img = render_emoji_image(emoji, target_size)
    if img is None and fallback:
        img = render_emoji_image(fallback, target_size)
    if img is None:
        return
    cx, cy = position
    canvas.paste(img, (cx - img.size[0] // 2, cy - img.size[1] // 2), img)


# ───────────────────────── shared widgets ─────────────────────────

def draw_picksy_logo(canvas: Image.Image, x: int, y: int, label: str) -> None:
    """The familiar Picksy logo lockup used in every OG image."""
    draw = ImageDraw.Draw(canvas)
    # Rounded gradient square with white "P".
    sq_size = 56
    sq = Image.new("RGB", (sq_size, sq_size), (0, 0, 0))
    sq_draw = ImageDraw.Draw(sq)
    # diagonal gradient inside the logo square
    for i in range(sq_size):
        t = i / (sq_size - 1)
        c = lerp((255, 138, 76), (244, 63, 94), t)
        sq_draw.line([(0, i), (sq_size, i)], fill=c)
    # Round the corners by masking
    mask = Image.new("L", (sq_size, sq_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sq_size, sq_size], 14, fill=255)
    canvas.paste(sq, (x, y), mask)
    # Letter P
    font = _font(FONT_BOLD, 38)
    draw.text((x + sq_size // 2, y + sq_size // 2 + 1), "P", fill="white",
              font=font, anchor="mm")
    # Wordmark + label
    draw.text((x + sq_size + 14, y + 6), "Picksy", fill="white",
              font=_font(FONT_BOLD, 32))
    draw.text((x + sq_size + 14 + 122, y + 14), label, fill=(203, 213, 225),
              font=_font(FONT_REGULAR, 24))


def draw_chip(canvas: Image.Image, text: str, x: int, y: int) -> int:
    """Draw a pill-shaped chip and return its width.

    The chip text may begin with an emoji — we split that off and render it
    via NotoColorEmoji because the body font (DejaVu Sans) lacks emoji glyphs.
    """
    draw = ImageDraw.Draw(canvas)
    font = _font(FONT_BOLD, 22)
    pad_x = 18
    h = 44
    icon_size = 24
    icon_img: Optional[Image.Image] = None
    body = text
    if text and ord(text[0]) > 127:
        first_space = text.find(" ")
        emoji_part = text[:first_space] if first_space != -1 else text
        body = text[first_space + 1:] if first_space != -1 else ""
        icon_img = render_emoji_image(emoji_part.strip(), icon_size)
    bbox = draw.textbbox((0, 0), body, font=font)
    tw = bbox[2] - bbox[0]
    inner = tw + (icon_size + 8 if icon_img is not None else 0)
    w = inner + pad_x * 2
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([0, 0, w, h], radius=22, fill=(15, 23, 42, 170),
                         outline=(148, 163, 184, 220), width=1)
    canvas.alpha_composite(overlay, (x, y))
    cx = x + pad_x
    if icon_img is not None:
        canvas.paste(icon_img, (cx, y + (h - icon_img.size[1]) // 2), icon_img)
        cx += icon_size + 8
    draw.text((cx, y + h // 2), body, fill="white", font=font, anchor="lm")
    return w


def draw_url_footer(canvas: Image.Image, url: str) -> None:
    draw = ImageDraw.Draw(canvas)
    font = _font(FONT_REGULAR, 24)
    bbox = draw.textbbox((0, 0), url, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((W - 60 - tw, H - 60), url, fill=(203, 213, 225), font=font)


# ───────────────────────── feed.png ─────────────────────────

def render_feed_card(width: int, height: int,
                     accent: Tuple[int, int, int],
                     poster_color: Tuple[int, int, int]) -> Image.Image:
    """A small fake feed-post card used as decoration on the right side."""
    card = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    # Card bg
    rounded_rect(draw, [0, 0, width, height], radius=22, fill=(30, 27, 60, 235),
                 outline=(148, 163, 184, 90), width=1)
    # Avatar circle
    pad = 18
    av_r = 22
    draw.ellipse([pad, pad, pad + av_r * 2, pad + av_r * 2], fill=accent)
    # Name + handle
    draw.rounded_rectangle([pad + av_r * 2 + 12, pad + 4,
                             pad + av_r * 2 + 12 + 130, pad + 18],
                            radius=4, fill=(255, 255, 255, 230))
    draw.rounded_rectangle([pad + av_r * 2 + 12, pad + 26,
                             pad + av_r * 2 + 12 + 90, pad + 36],
                            radius=4, fill=(148, 163, 184, 180))
    # Mini poster
    pos_x0 = pad
    pos_y0 = pad + av_r * 2 + 16
    pw, ph = 64, 90
    draw.rounded_rectangle([pos_x0, pos_y0, pos_x0 + pw, pos_y0 + ph],
                            radius=8, fill=poster_color)
    # Stars row beneath poster (5 stars)
    sx = pos_x0 + pw + 16
    sy = pos_y0 + 6
    for i in range(5):
        draw.ellipse([sx + i * 18, sy, sx + i * 18 + 12, sy + 12],
                     fill=(245, 158, 11, 255))
    # Two text lines
    draw.rounded_rectangle([sx, sy + 26, sx + 180, sy + 36],
                            radius=4, fill=(226, 232, 240, 220))
    draw.rounded_rectangle([sx, sy + 46, sx + 140, sy + 56],
                            radius=4, fill=(148, 163, 184, 200))
    # Action row
    ay = height - 38
    for i, color in enumerate([(244, 63, 94), (56, 189, 248), (245, 158, 11)]):
        draw.ellipse([pad + i * 36, ay, pad + i * 36 + 22, ay + 22],
                     fill=(color[0], color[1], color[2], 220))
    return card


def make_feed_og() -> str:
    # Background gradient — Picksy purple-to-pink.
    base = linear_gradient(
        (W, H),
        stops=[(0.0, hex_to_rgb("#0b0820")),
               (0.45, hex_to_rgb("#3b1d6e")),
               (0.9, hex_to_rgb("#7c1d6f"))],
        angle_deg=135.0,
    ).convert("RGBA")

    # Two glow blobs reminiscent of match.png
    base.alpha_composite(radial_blob((W, H), (220, 180), 280,
                                      hex_to_rgb("#7c3aed"), alpha=200))
    base.alpha_composite(radial_blob((W, H), (980, 460), 320,
                                      hex_to_rgb("#ec4899"), alpha=180))

    draw = ImageDraw.Draw(base)
    draw_picksy_logo(base, 60, 56, "feed")

    # Big title — two lines
    title_font = _font(FONT_BOLD, 96)
    draw.text((60, 160), "Кіно-стрічка", fill="white", font=title_font)

    # Second line gradient text — render gradient by drawing word in white
    # then masking onto the gradient layer.
    word = "спільноти"
    word_font = _font(FONT_BOLD, 96)
    word_bbox = draw.textbbox((0, 0), word, font=word_font)
    word_w = word_bbox[2] - word_bbox[0]
    word_h = word_bbox[3] - word_bbox[1] + 20
    grad = linear_gradient(
        (word_w + 4, word_h + 4),
        stops=[(0.0, hex_to_rgb("#a78bfa")),
               (0.5, hex_to_rgb("#f472b6")),
               (1.0, hex_to_rgb("#fbbf24"))],
        angle_deg=90.0,
    ).convert("RGBA")
    mask = Image.new("L", grad.size, 0)
    ImageDraw.Draw(mask).text((2, 2), word, fill=255, font=word_font)
    base.paste(grad, (60, 270), mask)

    # Subtitle
    subtitle = "Думки про фільми, гарячі тейки, реакції"
    sub_font = _font(FONT_REGULAR, 28)
    draw.text((60, 410), subtitle, fill=(226, 232, 240), font=sub_font)
    draw.text((60, 450), "та оцінки — все в одному місці.",
              fill=(226, 232, 240), font=sub_font)

    # Chips row
    chips = ["✍️ Пости", "💬 Коментарі", "🌶️ Hot Takes", "⭐ Оцінки"]
    cx = 60
    for c in chips:
        cw = draw_chip(base, c, cx, 510)
        cx += cw + 12

    # Decorative feed cards on the right
    card1 = render_feed_card(360, 220, accent=hex_to_rgb("#a78bfa"),
                              poster_color=hex_to_rgb("#1e293b"))
    card2 = render_feed_card(360, 220, accent=hex_to_rgb("#f472b6"),
                              poster_color=hex_to_rgb("#7c3aed"))
    base.alpha_composite(card1, (790, 130))
    base.alpha_composite(card2, (760, 320))

    # Footer URL
    draw_url_footer(base, "picksy.my/feed")

    out_path = os.path.join(OG_DIR, "feed.png")
    base.convert("RGB").save(out_path, optimize=True)
    return out_path


# ───────────────────────── archetype-*.png ─────────────────────────

# Minimal palette dictionary — we keep accent colors close to the existing
# JSON `accent` field but ensure good contrast for the OG image background.
_DEFAULT_BG = "#1e1b4b"


def parse_gradient_colors(grad: str) -> Tuple[Tuple[int, int, int], Tuple[int, int, int]]:
    """Best-effort hex parser for the `linear-gradient(...)` strings stored in
    archetypes.json. Falls back to a sensible default when parsing fails."""
    try:
        # find every #xxxxxx token
        toks = [t for t in grad.replace(",", " ").split() if t.startswith("#")]
        # Strip trailing punctuation like commas
        toks = [t.strip(" ,);") for t in toks]
        if len(toks) >= 2:
            return hex_to_rgb(toks[0]), hex_to_rgb(toks[-1])
        if len(toks) == 1:
            return hex_to_rgb(toks[0]), hex_to_rgb(toks[0])
    except Exception:
        pass
    return hex_to_rgb("#1e1b4b"), hex_to_rgb("#4c1d95")


def make_archetype_og(arch: dict, idx: int, total: int) -> str:
    slug = arch["slug"]
    name = arch.get("name") or arch.get("name_en") or slug
    emoji = arch.get("emoji") or "🎬"
    tagline = arch.get("tagline") or ""
    accent = arch.get("accent") or "#a78bfa"
    grad = arch.get("gradient") or ""
    c0, c1 = parse_gradient_colors(grad)
    accent_rgb = hex_to_rgb(accent)

    # Background
    base = linear_gradient(
        (W, H),
        stops=[(0.0, c0), (1.0, c1)],
        angle_deg=135.0,
    ).convert("RGBA")
    # Slight darkening at the top-left so the wordmark contrasts.
    base.alpha_composite(radial_blob((W, H), (-100, -120), 600, (0, 0, 0), alpha=140))
    # Accent glow on the right where the hero icon will sit.
    base.alpha_composite(radial_blob((W, H), (900, 320), 320, accent_rgb, alpha=140))

    draw = ImageDraw.Draw(base)
    draw_picksy_logo(base, 60, 56, "archetype")

    # "Кіноархетип · N з 16" pill
    pill_text = f"КІНОАРХЕТИП · {idx} З {total}"
    pill_font = _font(FONT_BOLD, 18)
    pbb = draw.textbbox((0, 0), pill_text, font=pill_font)
    pw = (pbb[2] - pbb[0]) + 36
    ph = 36
    overlay = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([0, 0, pw, ph], radius=18, fill=(15, 23, 42, 200))
    base.alpha_composite(overlay, (60, 130))
    draw.text((60 + 18, 130 + ph // 2), pill_text, fill="white", font=pill_font, anchor="lm")

    # Title — wrap on multiple lines if it would overlap the hero panel.
    title_font = _font(FONT_BOLD, 72)
    max_title_width = 700
    words = name.split(" ")
    lines: list = []
    cur = ""
    for w in words:
        candidate = (cur + " " + w).strip()
        bbox = draw.textbbox((0, 0), candidate, font=title_font)
        if bbox[2] - bbox[0] > max_title_width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = candidate
    if cur:
        lines.append(cur)
    if not lines:
        lines = [name]
    title_y = 200
    for ln in lines[:2]:
        draw.text((60, title_y), ln, fill="white", font=title_font)
        title_y += 80
    title_bottom = title_y

    # Tagline (subtitle)
    if tagline:
        sub_font = _font(FONT_REGULAR, 26)
        # Wrap ~52 chars per line.
        max_line = 52
        cur = ""
        lines = []
        for w in tagline.split():
            if len(cur) + len(w) + 1 > max_line:
                lines.append(cur)
                cur = w
            else:
                cur = (cur + " " + w).strip()
        if cur:
            lines.append(cur)
        for i, ln in enumerate(lines[:2]):
            draw.text((60, title_bottom + 24 + i * 36), ln,
                      fill=(226, 232, 240), font=sub_font)

    # Hero panel on the right — rounded rect with subtle gradient + emoji.
    hero_w, hero_h = 300, 300
    hero_x, hero_y = W - hero_w - 70, (H - hero_h) // 2 + 10
    hero_grad = linear_gradient(
        (hero_w, hero_h),
        stops=[(0.0, lerp(c0, accent_rgb, 0.5)),
               (1.0, lerp(c1, accent_rgb, 0.7))],
        angle_deg=135.0,
    ).convert("RGBA")
    mask = Image.new("L", (hero_w, hero_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, hero_w, hero_h], radius=42, fill=255)
    base.paste(hero_grad, (hero_x, hero_y), mask)
    draw.rounded_rectangle(
        [hero_x, hero_y, hero_x + hero_w, hero_y + hero_h],
        radius=42, outline=(255, 255, 255, 60), width=2,
    )
    # Big emoji centred in the hero — with a sensible fallback for archetypes
    # whose `emoji` field is an obscure symbol NotoColorEmoji doesn't ship.
    fallback_emoji = {
        "dark-philosopher": "🌑",
        "quiet-cryptic-child": "🍒",
        "arthaus-visionary": "🎥",
    }.get(slug, "🎬")
    draw_emoji(base, emoji, target_size=200,
               position=(hero_x + hero_w // 2, hero_y + hero_h // 2),
               fallback=fallback_emoji)

    # Footer URL
    draw_url_footer(base, f"picksy.my/archetype/{slug}")

    out_path = os.path.join(OG_DIR, f"archetype-{slug}.png")
    base.convert("RGB").save(out_path, optimize=True)
    return out_path


def main() -> None:
    os.makedirs(OG_DIR, exist_ok=True)

    feed_path = make_feed_og()
    print(f"wrote {feed_path}")

    if os.path.exists(ARCHETYPES_PATH):
        with open(ARCHETYPES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        archs = data.get("archetypes", []) or []
        for i, arch in enumerate(archs, start=1):
            try:
                p = make_archetype_og(arch, i, len(archs))
                print(f"wrote {p}")
            except Exception as exc:
                print(f"FAILED for {arch.get('slug')}: {exc}")
    else:
        print(f"archetypes.json not found at {ARCHETYPES_PATH}; skipping archetypes")


if __name__ == "__main__":
    main()
