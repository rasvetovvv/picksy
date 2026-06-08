"""Scheduled broadcasts: daily pick (12:00 Kyiv), weekly digest, tip-of-day,
auto-close idle tickets, holiday greetings.

Uses python-telegram-bot's built-in JobQueue (which wraps APScheduler).
"""
from __future__ import annotations

import asyncio
import datetime
import logging
import random
from typing import List, Optional

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.constants import ParseMode
from telegram.error import Forbidden, RetryAfter, TelegramError
from telegram.ext import Application, ContextTypes

from . import config, db, site_api

log = logging.getLogger("picksy_bot.scheduler")

# All broadcasts are scheduled in Europe/Kyiv local time so they shift with
# DST automatically. python-telegram-bot's JobQueue accepts a tz-aware
# `datetime.time(...)` and APScheduler handles the rest.
try:
    from zoneinfo import ZoneInfo
    KYIV_TZ = ZoneInfo("Europe/Kyiv")
except Exception:  # pragma: no cover — fallback for very old Pythons
    KYIV_TZ = datetime.timezone(datetime.timedelta(hours=2))


from .handlers.ai import EVENING_MESSAGES

TIPS: List[str] = [
    "💡 *Підказка:* у Picksy є квіз-архетип з 16 типами — пройди /quiz, щоб отримати персональні рекомендації на picksy.my.",
    "💡 *Підказка:* збережи фільм у колекцію — кнопка ⭐ на сторінці фільму. Колекція ділиться посиланням.",
    "💡 *Підказка:* подаруй другу фільм через Picksy Gifts (picksy.my) — гарне посилання-картка з постером.",
    "💡 *Підказка:* щодня на головній picksy.my — *Daily Pick*: одна точна рекомендація.",
    "💡 *Підказка:* спробуй *Wordle*-стиль гру: вгадай фільм за 5 кадрами/цитатами на picksy.my.",
    "💡 *Підказка:* твій профіль показує статистику переглядів і середній рейтинг — заглянь у /profile.",
    "💡 *Підказка:* в нашому каналі @itspicksy ми пишемо анонси нових фіч, підбірки та розіграші — підпишися, щоб нічого не пропустити.",
    "💡 *Підказка:* щодня о 12:00 ми публікуємо Daily Pick і в боті, і в каналі @itspicksy — роби скріншоти, ділися з друзями!",
]


HOLIDAYS = {
    (1, 1): ("🎉 *З Новим Роком!*", "Команда Picksy бажає тобі року, повного чудових фільмів, серіалів і книг. Святкова підбірка — на picksy.my і в каналі @itspicksy."),
    (3, 8): ("🌷 *З 8 березня!*", "Бажаємо натхнення, теплих стрічок і ще теплішого настрою. Наша підбірка до свята — на picksy.my і в @itspicksy."),
    (8, 24): ("🇺🇦 *З Днем Незалежності!*", "Слава Україні! Сьогодні особливий день — і особливий Daily Pick на picksy.my. Дивись також @itspicksy."),
    (10, 31): ("🎃 *Гелловін!*", "Підборка горрорів чекає на тебе на picksy.my. Найстрашніші пости — в @itspicksy."),
    (12, 25): ("🎄 *Веселого Різдва!*", "Затишок, плед, гаряча кава й гарне кіно — ось і весь рецепт ідеального вечора. Різдвяна підбірка — на picksy.my і в @itspicksy."),
    (12, 31): ("🥂 *З наступаючим!*", "Picksy дякує, що був з нами цей рік. Попереду — ще багато прекрасних історій на picksy.my і в каналі @itspicksy."),
}


# ─── Job: daily pick at 12:00 Kyiv ───

async def build_daily_pick_message() -> Optional[tuple[str, Optional[str], InlineKeyboardMarkup]]:
    """Fetch daily pick (movie + tv + book) from the website API and build
    a beautiful caption + poster + CTA buttons.

    Returns (caption, poster_url_or_None, markup) or None if nothing fetched.
    """
    picks = await site_api.fetch_all_daily_picks()
    cards = {
        kind: site_api.extract_card(kind, payload)
        for kind, payload in picks.items()
    }

    if not any(cards.values()):
        return None

    today = datetime.datetime.now(KYIV_TZ).strftime("%d.%m.%Y")
    parts = [f"🎯 *Daily Pick · {today}*", ""]

    if cards["movie"]:
        c = cards["movie"]
        year = f" ({c['year']})" if c.get("year") else ""
        parts.append(f"🎬 *Фільм дня:* [{c['title']}]({c['url']}){year}")
    if cards["tv"]:
        c = cards["tv"]
        year = f" ({c['year']})" if c.get("year") else ""
        parts.append(f"📺 *Серіал дня:* [{c['title']}]({c['url']}){year}")
    if cards["book"]:
        c = cards["book"]
        authors = ""
        if c.get("authors"):
            authors_str = ", ".join(c["authors"][:2])
            authors = f" — _{authors_str}_"
        parts.append(f"📚 *Книга дня:* [{c['title']}]({c['url']}){authors}")

    parts.append("")
    parts.append("Гарного перегляду 💛  Чекаємо на тебе на Picksy!")
    parts.append(
        f"🌐 {config.SITE_URL}  ·  📣 підпишись на {config.TG_CHANNEL_USERNAME}"
    )
    caption = "\n".join(parts)

    # Pick a poster: prefer movie, then tv, then book
    poster = None
    for kind in ("movie", "tv", "book"):
        c = cards.get(kind)
        if c and c.get("poster"):
            poster = c["poster"]
            break

    # Buttons: one CTA per type (visible only if it exists)
    buttons = []
    row = []
    for kind, label in (("movie", "🎬 Фільм"), ("tv", "📺 Серіал"), ("book", "📚 Книга")):
        c = cards.get(kind)
        if c and c.get("url"):
            row.append(InlineKeyboardButton(label, url=c["url"]))
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton("🌐 Відкрити picksy.my", url=config.SITE_URL)])
    buttons.append([InlineKeyboardButton(
        f"📣 Підписатися на {config.TG_CHANNEL_USERNAME}",
        url=config.TG_CHANNEL_URL,
    )])
    markup = InlineKeyboardMarkup(buttons)

    return caption, poster, markup


async def job_daily_pick(context: ContextTypes.DEFAULT_TYPE) -> None:
    targets = db.list_subscribers_for_topic("daily_pick")
    if not targets:
        log.info("daily-pick: no subscribers")
        return

    msg = await build_daily_pick_message()
    if not msg:
        log.info("daily-pick: API returned nothing, skipping")
        return
    caption, poster, markup = msg

    bid = db.create_broadcast(
        topic="daily_pick", text=caption, photo_file_id=poster,
        target_count=len(targets), created_by_tg_id=None,
    )
    sent, failed = 0, 0
    rate = max(0.5, config.BROADCAST_RATE_PER_SEC)
    delay = 1.0 / rate
    for tg_id in targets:
        try:
            if poster:
                await context.bot.send_photo(
                    tg_id, photo=poster, caption=caption[:1024],
                    parse_mode=ParseMode.MARKDOWN, reply_markup=markup,
                )
            else:
                await context.bot.send_message(
                    tg_id, caption, parse_mode=ParseMode.MARKDOWN,
                    reply_markup=markup, disable_web_page_preview=False,
                )
            sent += 1
        except RetryAfter as e:
            await asyncio.sleep(float(e.retry_after) + 1)
            failed += 1
        except Forbidden:
            failed += 1
            try:
                db.ban_user(tg_id, reason="bot_blocked")
            except Exception:
                pass
        except TelegramError:
            failed += 1
        await asyncio.sleep(delay)
    db.update_broadcast_progress(bid, sent, failed, finished=True)
    log.info("daily-pick sent: %s/%s (%s failed)", sent, len(targets), failed)


# ─── Job: weekly digest (Sunday 19:00 Kyiv) ───

async def job_weekly_digest(context: ContextTypes.DEFAULT_TYPE) -> None:
    targets = db.list_subscribers_for_topic("weekly_digest")
    if not targets:
        return
    text = (
        "📰 *Тижневий дайджест Picksy*\n\n"
        "Цього тижня:\n"
        "• Нові фільми у Daily Pick\n"
        "• Топ-3 архетипи нових юзерів\n"
        "• Найпопулярніші подарунки\n\n"
        f"Подивись усі оновлення на {config.SITE_URL}\n"
        f"📣 Підпишись на {config.TG_CHANNEL_USERNAME} — там ми пишемо про все нове першими: {config.TG_CHANNEL_URL}"
    )
    digest_markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("🌐 picksy.my", url=config.SITE_URL)],
        [InlineKeyboardButton(
            f"📣 Канал {config.TG_CHANNEL_USERNAME}",
            url=config.TG_CHANNEL_URL,
        )],
    ])
    bid = db.create_broadcast(
        topic="weekly_digest", text=text,
        target_count=len(targets), created_by_tg_id=None,
    )
    sent = failed = 0
    for tg_id in targets:
        try:
            await context.bot.send_message(
                tg_id, text, parse_mode=ParseMode.MARKDOWN,
                disable_web_page_preview=True,
                reply_markup=digest_markup,
            )
            sent += 1
        except Forbidden:
            failed += 1
            db.ban_user(tg_id, reason="bot_blocked")
        except TelegramError:
            failed += 1
        await asyncio.sleep(1.0 / max(0.5, config.BROADCAST_RATE_PER_SEC))
    db.update_broadcast_progress(bid, sent, failed, finished=True)


# ─── Job: tip of the day ───

async def job_tip_of_the_day(context: ContextTypes.DEFAULT_TYPE) -> None:
    targets = db.list_subscribers_for_topic("tip_of_the_day")
    if not targets:
        return
    tip = random.choice(TIPS)
    tip_markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("🌐 picksy.my", url=config.SITE_URL),
         InlineKeyboardButton(
             f"📣 {config.TG_CHANNEL_USERNAME}",
             url=config.TG_CHANNEL_URL,
         )],
    ])
    bid = db.create_broadcast(
        topic="tip_of_the_day", text=tip,
        target_count=len(targets), created_by_tg_id=None,
    )
    sent = failed = 0
    for tg_id in targets:
        try:
            await context.bot.send_message(
                tg_id, tip,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=tip_markup,
                disable_web_page_preview=True,
            )
            sent += 1
        except Forbidden:
            failed += 1
            db.ban_user(tg_id, reason="bot_blocked")
        except TelegramError:
            failed += 1
        await asyncio.sleep(1.0 / max(0.5, config.BROADCAST_RATE_PER_SEC))
    db.update_broadcast_progress(bid, sent, failed, finished=True)


# ─── Job: holiday greetings (runs daily; sends only on holiday days) ───

async def job_holiday(context: ContextTypes.DEFAULT_TYPE) -> None:
    today = datetime.datetime.now(KYIV_TZ).date()
    key = (today.month, today.day)
    if key not in HOLIDAYS:
        return
    title, body = HOLIDAYS[key]
    text = (
        f"{title}\n\n{body}\n\n"
        f"🌐 {config.SITE_URL}\n"
        f"📣 {config.TG_CHANNEL_USERNAME} — {config.TG_CHANNEL_URL}"
    )
    holiday_markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("🌐 picksy.my", url=config.SITE_URL)],
        [InlineKeyboardButton(
            f"📣 Канал {config.TG_CHANNEL_USERNAME}",
            url=config.TG_CHANNEL_URL,
        )],
    ])
    targets = db.list_subscribers_for_topic("events")
    if not targets:
        return
    bid = db.create_broadcast(
        topic="events", text=text,
        target_count=len(targets), created_by_tg_id=None,
    )
    sent = failed = 0
    for tg_id in targets:
        try:
            await context.bot.send_message(
                tg_id, text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=holiday_markup,
                disable_web_page_preview=True,
            )
            sent += 1
        except Forbidden:
            failed += 1
            db.ban_user(tg_id, reason="bot_blocked")
        except TelegramError:
            failed += 1
        await asyncio.sleep(1.0 / max(0.5, config.BROADCAST_RATE_PER_SEC))
    db.update_broadcast_progress(bid, sent, failed, finished=True)


# ─── Job: Вечір п'ятниці (Friday 18:00 Kyiv) ───

FRIDAY_GREETINGS = [
    "🌟 *Вечір п'ятниці з Picksy!*",
    "🍿 *П'ятниця! Час для кіно!*",
    "🎬 *Твій кіновечір починається!*",
    "🌙 *Picksy підготував тобі підбірку на вихідні!*",
    "🎥 *П'ятничний кіносеанс від Picksy!*",
]

FRIDAY_CLOSINGS = [
    "Гарного перегляду і чудових вихідних! 💛",
    "Плед, кава, кіно — ідеальний вечір! ☕",
    "Занурюйся у світ кіно цими вихідними! 🌟",
    "Вихідні створені для гарного кіно! 🎬",
    "Нехай ці вихідні будуть кіномагічними! ✨",
]


async def job_friday_evening(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Вечір п'ятниці — personal weekend picks broadcast.

    Fetches quality movies and TV series from TMDB (weighted by rating AND
    vote count), builds a beautiful message, and sends it to all subscribers
    of the `friday_picks` topic. No ads, just great cinema.
    """
    targets = db.list_subscribers_for_topic("friday_picks")
    if not targets:
        log.info("friday-picks: no subscribers")
        return

    movies = await site_api.fetch_friday_movies(count=3)
    tv_shows = await site_api.fetch_friday_tv(count=2)

    if not movies and not tv_shows:
        log.info("friday-picks: TMDB returned nothing, skipping")
        return

    today = datetime.datetime.now(KYIV_TZ).strftime("%d.%m.%Y")
    greeting = random.choice(FRIDAY_GREETINGS)
    closing = random.choice(FRIDAY_CLOSINGS)

    parts = [f"{greeting}", f"_Підбірка на вихідні · {today}_", ""]

    if movies:
        parts.append("🎬 *Фільми на вихідні:*")
        for i, m in enumerate(movies, 1):
            year = f" ({m['year']})" if m.get('year') else ""
            rating = f" — ★{m['rating']}" if m.get('rating') else ""
            title_link = f"[{m['title']}]({m['url']})"
            parts.append(f"{i}. {title_link}{year}{rating}")
            if m.get('overview'):
                short = m['overview'][:120]
                if len(m['overview']) > 120:
                    short += '...'
                parts.append(f"   _{short}_")
        parts.append("")

    if tv_shows:
        parts.append("📺 *Серіали на вихідні:*")
        for i, s in enumerate(tv_shows, 1):
            year = f" ({s['year']})" if s.get('year') else ""
            rating = f" — ★{s['rating']}" if s.get('rating') else ""
            title_link = f"[{s['title']}]({s['url']})"
            parts.append(f"{i}. {title_link}{year}{rating}")
            if s.get('overview'):
                short = s['overview'][:120]
                if len(s['overview']) > 120:
                    short += '...'
                parts.append(f"   _{short}_")
        parts.append("")

    parts.append(closing)
    parts.append(f"🌐 {config.SITE_URL}  ·  📣 {config.TG_CHANNEL_USERNAME}")
    caption = "\n".join(parts)

    # Pick a poster from the first movie
    poster = None
    for m in movies:
        if m.get("poster"):
            poster = m["poster"]
            break
    if not poster:
        for s in tv_shows:
            if s.get("poster"):
                poster = s["poster"]
                break

    # Buttons
    buttons = []
    movie_btns = []
    for m in movies[:2]:
        movie_btns.append(InlineKeyboardButton(f"🎬 {m['title'][:20]}", url=m['url']))
    if movie_btns:
        buttons.append(movie_btns)
    tv_btns = []
    for s in tv_shows[:2]:
        tv_btns.append(InlineKeyboardButton(f"📺 {s['title'][:20]}", url=s['url']))
    if tv_btns:
        buttons.append(tv_btns)
    buttons.append([InlineKeyboardButton("🌐 Відкрити picksy.my", url=config.SITE_URL)])
    buttons.append([InlineKeyboardButton(
        f"📣 {config.TG_CHANNEL_USERNAME}",
        url=config.TG_CHANNEL_URL,
    )])
    markup = InlineKeyboardMarkup(buttons)

    bid = db.create_broadcast(
        topic="friday_picks", text=caption, photo_file_id=poster,
        target_count=len(targets), created_by_tg_id=None,
    )
    sent, failed = 0, 0
    rate = max(0.5, config.BROADCAST_RATE_PER_SEC)
    delay = 1.0 / rate
    for tg_id in targets:
        try:
            if poster:
                await context.bot.send_photo(
                    tg_id, photo=poster, caption=caption[:1024],
                    parse_mode=ParseMode.MARKDOWN, reply_markup=markup,
                )
            else:
                await context.bot.send_message(
                    tg_id, caption,
                    parse_mode=ParseMode.MARKDOWN,
                    reply_markup=markup,
                    disable_web_page_preview=False,
                )
            sent += 1
        except RetryAfter as e:
            await asyncio.sleep(float(e.retry_after) + 1)
            failed += 1
        except Forbidden:
            failed += 1
            try:
                db.ban_user(tg_id, reason="bot_blocked")
            except Exception:
                pass
        except TelegramError:
            failed += 1
        await asyncio.sleep(delay)
    db.update_broadcast_progress(bid, sent, failed, finished=True)
    log.info("friday-picks sent: %s/%s (%s failed)", sent, len(targets), failed)


# ─── Job: auto-close idle tickets ───

async def job_auto_close(context: ContextTypes.DEFAULT_TYPE) -> None:
    rows = db.find_idle_open_tickets()
    for ticket in rows:
        try:
            db.update_ticket(
                ticket["id"],
                status="closed",
                closed_at=datetime.datetime.utcnow(),
                close_reason="auto_closed_idle",
            )
            await context.bot.send_message(
                ticket["tg_id"],
                f"⏱ Тікет #{ticket['id']} автоматично закрито через тривалу неактивність. "
                "Якщо проблема повернеться — створи новий тікет.\n\n"
                f"🌐 {config.SITE_URL}  ·  📣 {config.TG_CHANNEL_USERNAME}",
                disable_web_page_preview=True,
            )
        except TelegramError as e:
            log.info("auto_close notify failed for %s: %s", ticket["tg_id"], e)
        except Exception as e:
            log.warning("auto_close: %s", e)


# ─── Job: Picksy AI evening broadcast (20:00 Kyiv) ───

async def job_ai_evening(context: ContextTypes.DEFAULT_TYPE) -> None:
    targets = db.list_subscribers_for_topic("ai_evening")
    if not targets:
        log.info("ai-evening: no subscribers")
        return
    msg = random.choice(EVENING_MESSAGES)
    markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("🌐 Відкрити picksy.my", url=config.SITE_URL)],
        [InlineKeyboardButton(
            f"📣 Канал {config.TG_CHANNEL_USERNAME}",
            url=config.TG_CHANNEL_URL,
        )],
        [InlineKeyboardButton("🤖 Picksy AI", url="https://t.me/PicksySupportBot?start=ai")],
    ])
    bid = db.create_broadcast(
        topic="ai_evening", text=msg,
        target_count=len(targets), created_by_tg_id=None,
    )
    sent = failed = 0
    rate = max(0.5, config.BROADCAST_RATE_PER_SEC)
    delay = 1.0 / rate
    for tg_id in targets:
        try:
            await context.bot.send_message(
                tg_id, msg,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=markup,
                disable_web_page_preview=True,
            )
            sent += 1
        except Forbidden:
            failed += 1
            try:
                db.ban_user(tg_id, reason="bot_blocked")
            except Exception:
                pass
        except TelegramError:
            failed += 1
        await asyncio.sleep(delay)
    db.update_broadcast_progress(bid, sent, failed, finished=True)
    log.info("ai-evening sent: %s/%s (%s failed)", sent, len(targets), failed)


def install_jobs(app: Application) -> None:
    """Register all schedules with the bot's job queue."""
    jq = app.job_queue
    if not jq:
        log.warning("Job queue is not available; install python-telegram-bot[job-queue]")
        return

    # All schedules are in Europe/Kyiv local time. APScheduler / JobQueue
    # picks up the tzinfo on the time object and reschedules across DST
    # transitions automatically.
    # Daily pick — 12:00 Kyiv
    jq.run_daily(
        job_daily_pick,
        time=datetime.time(hour=config.DAILY_PICK_HOUR, minute=config.DAILY_PICK_MINUTE, tzinfo=KYIV_TZ),
        name="daily_pick",
    )
    # Weekly digest — Sunday 19:00 Kyiv
    jq.run_daily(
        job_weekly_digest,
        time=datetime.time(hour=config.WEEKLY_DIGEST_HOUR, minute=config.WEEKLY_DIGEST_MINUTE, tzinfo=KYIV_TZ),
        days=(6,),  # Sunday
        name="weekly_digest",
    )
    # Tip of the day — every 3 days at TIP_HOUR Kyiv
    jq.run_repeating(
        job_tip_of_the_day,
        interval=datetime.timedelta(days=3),
        first=datetime.time(hour=config.TIP_HOUR, minute=config.TIP_MINUTE, tzinfo=KYIV_TZ),
        name="tip_of_day",
    )
    # Holidays — 5 minutes after daily pick Kyiv
    jq.run_daily(
        job_holiday,
        time=datetime.time(hour=config.DAILY_PICK_HOUR, minute=config.DAILY_PICK_MINUTE + 5, tzinfo=KYIV_TZ),
        name="holiday",
    )
    # Picksy AI evening broadcast — 20:00 Kyiv
    jq.run_daily(
        job_ai_evening,
        time=datetime.time(hour=config.AI_EVENING_HOUR, minute=config.AI_EVENING_MINUTE, tzinfo=KYIV_TZ),
        name="ai_evening",
    )
    # Вечір п'ятниці — Friday 18:00 Kyiv
    jq.run_daily(
        job_friday_evening,
        time=datetime.time(hour=config.FRIDAY_PICKS_HOUR, minute=config.FRIDAY_PICKS_MINUTE, tzinfo=KYIV_TZ),
        days=(4,),  # Friday (Monday=0)
        name="friday_picks",
    )
    # Auto-close idle tickets — hourly
    jq.run_repeating(
        job_auto_close,
        interval=datetime.timedelta(hours=1),
        first=datetime.timedelta(minutes=5),
        name="auto_close",
    )

    log.info("scheduler jobs installed")
