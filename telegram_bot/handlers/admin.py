"""Admin menu, stats, daily-pick wiring, admins management."""
from __future__ import annotations

import logging

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from .. import config, db
from ..i18n import t
from ..keyboards import admin_menu_kb, admin_pick_menu_kb

log = logging.getLogger("picksy_bot.admin")


def _md_escape(s: str) -> str:
    """Escape Telegram Markdown V1 special chars so dynamic content (broadcast
    text, ticket subjects, usernames) cannot break entity parsing."""
    if not s:
        return ""
    # Markdown V1: _ * ` [
    return (str(s)
            .replace("\\", "\\\\")
            .replace("_", "\\_")
            .replace("*", "\\*")
            .replace("`", "\\`")
            .replace("[", "\\["))


async def cmd_admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not db.is_admin(user.id):
        await update.message.reply_text(t("admin_only"))
        return
    await update.message.reply_text(
        "🛠 *Адмін-меню*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=admin_menu_kb(),
    )


async def open_admin_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Called from reply-keyboard tap; not from callback."""
    user = update.effective_user
    if not db.is_admin(user.id):
        await update.message.reply_text(t("admin_only"))
        return
    await update.message.reply_text(
        "🛠 *Адмін-меню*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=admin_menu_kb(),
    )


async def on_admin_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    await q.answer()
    await q.edit_message_text(
        "🛠 *Адмін-меню*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=admin_menu_kb(),
    )


async def on_admin_close(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    try:
        await q.delete_message()
    except Exception:
        await q.edit_message_text("Закрито.")


def _stats_keyboard():
    """Stats screen has its own keyboard: refresh, top users, health, back."""
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    rows = [
        [InlineKeyboardButton("🔄 Оновити", callback_data="a:stats"),
         InlineKeyboardButton("🏆 Топ юзерів", callback_data="a:top_users")],
        [InlineKeyboardButton("🩺 Health DB", callback_data="a:health"),
         InlineKeyboardButton("🌐 Сайт", callback_data="a:site_stats")],
        [InlineKeyboardButton("« Меню", callback_data="a:menu")],
    ]
    return InlineKeyboardMarkup(rows)


async def on_admin_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    await q.answer()
    try:
        s = db.stats_summary()
    except Exception as e:
        log.exception("stats_summary failed")
        await q.edit_message_text(
            f"❌ Не вдалось зчитати статистику.\n\n`{_md_escape(str(e))[:200]}`",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=admin_menu_kb(),
        )
        return

    topic_lines = "\n".join(
        f"  • {_md_escape(k)}: {v}" for k, v in (s.get("topic_counts") or {}).items()
    )

    text = (
        "📊 *Статистика бота*\n\n"
        "👥 *Аудиторія*\n"
        f"  • Підписників: *{s.get('subscribers', 0)}* (бан: {s.get('banned', 0)})\n"
        f"  • Нові за 24г / 7д: *{s.get('new_users_24h', 0)}* / *{s.get('new_users_7d', 0)}*\n"
        f"  • DAU / WAU / MAU: *{s.get('dau', 0)}* / *{s.get('wau', 0)}* / *{s.get('mau', 0)}*\n"
        f"  • Адмінів: {s.get('admins_count', 0)}\n\n"
        "💬 *Повідомлення*\n"
        f"  • Всього: *{s.get('messages_total', 0)}*\n"
        f"  • За 24 год: *{s.get('messages_24h', 0)}*\n\n"
        "🎫 *Тікети*\n"
        f"  • Open: {s.get('tickets_open', 0)}  •  Awaiting: {s.get('tickets_awaiting_user', 0)}\n"
        f"  • Answered: {s.get('tickets_answered', 0)}  •  Closed: {s.get('tickets_closed', 0)}  •  Spam: {s.get('tickets_spam', 0)}\n"
        f"  • Всього: {s.get('tickets_total', 0)}\n\n"
        f"📢 Розсилок за 7 днів: *{s.get('broadcasts_7d', 0)}*\n\n"
        "🔔 *Активні підписки по топіках:*\n"
        f"{topic_lines or '  _(немає)_'}\n\n"
        "💡 `🏆 Топ юзерів` — найактивніші за 30 днів.\n"
        "💡 `🩺 Health DB` — перевірка таблиць.\n"
        "💡 `/logsuser <tg_id>` — історія повідомлень юзера."
    )
    try:
        await q.edit_message_text(
            text[:4000], parse_mode=ParseMode.MARKDOWN, reply_markup=_stats_keyboard()
        )
    except Exception as e:
        log.warning("stats markdown failed: %s — sending plain", e)
        plain = (
            text.replace("*", "").replace("_", "").replace("`", "")
        )
        try:
            await q.edit_message_text(plain[:4000], reply_markup=_stats_keyboard())
        except Exception:
            # Last resort: send a new message so the admin still sees data.
            await context.bot.send_message(
                update.effective_chat.id, plain[:4000], reply_markup=_stats_keyboard()
            )


async def on_admin_top_users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """🏆 Top users tab — most active by message volume in the last 30 days."""
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    await q.answer()
    try:
        rows = db.list_top_message_users(limit=10)
    except Exception as e:
        log.warning("top users failed: %s", e)
        rows = []
    if not rows:
        body = (
            "🏆 *Топ юзерів (30 днів)*\n\n"
            "_(поки немає даних — лог повідомлень ще порожній)_"
        )
    else:
        lines = ["🏆 *Топ юзерів за 30 днів*", ""]
        for i, r in enumerate(rows, 1):
            tg_id = r.get("tg_id")
            uname = r.get("tg_username") or ""
            who = f"@{uname}" if uname else (r.get("first_name") or f"id={tg_id}")
            last = r.get("last_msg_at")
            last_str = last.strftime("%d.%m %H:%M") if hasattr(last, "strftime") else "?"
            lines.append(
                f"{i}. {_md_escape(who)} · *{r.get('msg_count', 0)}* msg · `{last_str}` · /u\\_{tg_id}"
            )
        lines.append("")
        lines.append("💡 Натисни на /u\\_<id>, щоб відкрити деталі юзера.")
        body = "\n".join(lines)
    try:
        await q.edit_message_text(
            body[:4000], parse_mode=ParseMode.MARKDOWN, reply_markup=_stats_keyboard()
        )
    except Exception:
        await q.edit_message_text(
            body[:4000].replace("*", "").replace("_", "").replace("`", ""),
            reply_markup=_stats_keyboard(),
        )


async def on_admin_health(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """🩺 Quick DB health check — connectivity + row counts for core tables."""
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    await q.answer("Перевіряю…")
    try:
        h = db.db_health()
    except Exception as e:
        await q.edit_message_text(
            f"❌ Health check впав: `{_md_escape(str(e))[:200]}`",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=_stats_keyboard(),
        )
        return
    ok = h.get("ok")
    status_emoji = "✅" if ok else "❌"
    lines = [
        f"{status_emoji} *Health check бази*",
        "",
        f"Підключення: {'OK' if ok else 'FAIL'}",
    ]
    if h.get("error"):
        lines.append(f"Помилка: `{_md_escape(h['error'])[:200]}`")
    lines.append("")
    lines.append("*Таблиці:*")
    for tbl, count in (h.get("tables") or {}).items():
        if count is None:
            lines.append(f"  • `{tbl}` — ❌ не існує / помилка")
        else:
            lines.append(f"  • `{tbl}` — *{count}* рядків")
    try:
        await q.edit_message_text(
            "\n".join(lines)[:4000],
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=_stats_keyboard(),
        )
    except Exception:
        await q.edit_message_text(
            "\n".join(lines)[:4000].replace("*", "").replace("`", ""),
            reply_markup=_stats_keyboard(),
        )


async def on_admin_site_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """🌐 Quick snapshot of site-side activity (best-effort via /api/picks/stats)."""
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    await q.answer("Тягну сайт…")
    from .. import site_api
    try:
        snapshot = await site_api.fetch_site_stats()
    except Exception as e:
        log.warning("site stats fetch failed: %s", e)
        snapshot = None
    if not snapshot:
        body = (
            "🌐 *Статистика сайту*\n\n"
            "_(не вдалось отримати дані з сайту — можливо `/api/picks/stats` недоступний)_"
        )
    else:
        body_lines = ["🌐 *Статистика сайту*", ""]
        for k, v in snapshot.items():
            body_lines.append(f"  • {_md_escape(str(k))}: *{_md_escape(str(v))}*")
        body = "\n".join(body_lines)
    try:
        await q.edit_message_text(
            body[:4000], parse_mode=ParseMode.MARKDOWN, reply_markup=_stats_keyboard()
        )
    except Exception:
        await q.edit_message_text(
            body[:4000].replace("*", "").replace("_", "").replace("`", ""),
            reply_markup=_stats_keyboard(),
        )


async def on_admin_pick_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    await q.answer()
    body = (
        "🎯 *Daily Pick*\n\n"
        "Daily Pick автоматично береться з сайту: бот тягне його через "
        "`/api/daily-pick` (movie / tv / book) і о *12:00 (Київ)* "
        "розсилає підписникам.\n\n"
        "Тут можна попередньо переглянути сьогоднішню добірку або "
        "примусово запустити розсилку зараз."
    )
    await q.edit_message_text(
        body,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=admin_pick_menu_kb(),
        disable_web_page_preview=True,
    )


async def on_admin_pick_view(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    await q.answer()
    from ..scheduler import build_daily_pick_message
    msg = await build_daily_pick_message()
    if not msg:
        await q.edit_message_text(
            "🎯 Сайт ще не встановив Daily Pick на сьогодні (API повернув порожньо).",
            reply_markup=admin_pick_menu_kb(),
        )
        return
    caption, poster, _markup = msg
    chat = update.effective_chat
    try:
        if poster:
            await context.bot.send_photo(
                chat.id, photo=poster, caption=caption[:1024],
                parse_mode=ParseMode.MARKDOWN,
            )
        else:
            await context.bot.send_message(
                chat.id, caption, parse_mode=ParseMode.MARKDOWN,
            )
    except Exception as e:
        log.warning("pick preview send: %s", e)


async def on_admin_pick_send_now(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Trigger the daily-pick broadcast immediately."""
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    await q.answer("Запускаю розсилку…")
    from ..scheduler import job_daily_pick
    try:
        await job_daily_pick(context)
        await context.bot.send_message(
            update.effective_chat.id,
            "✅ Розсилку запущено. Перевір лог `📜 Логи розсилок`.",
            parse_mode=ParseMode.MARKDOWN,
        )
    except Exception as e:
        await context.bot.send_message(
            update.effective_chat.id,
            f"❌ Помилка: {e}",
        )


async def on_admin_admins(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    rows = db.list_admins()
    body = ["👑 *Адміни бота:*\n"]
    if not rows:
        body.append("_(пусто; бутстрап-адміни лише з env)_")
    for r in rows:
        body.append(f"• `{r['tg_id']}` — {r.get('display_name') or '?'} ({r.get('role')})")
    body.append("\nДодати: `/addadmin <tg_id> [ім'я]`")
    body.append("Видалити: `/deladmin <tg_id>`")
    await q.answer()
    await q.edit_message_text(
        "\n".join(body),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=admin_menu_kb(),
    )


async def cmd_addadmin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not db.is_admin(user.id):
        await update.message.reply_text(t("admin_only"))
        return
    args = context.args or []
    if not args:
        await update.message.reply_text("Usage: /addadmin <tg_id> [name]")
        return
    try:
        tid = int(args[0])
    except ValueError:
        await update.message.reply_text("tg_id має бути числом.")
        return
    name = " ".join(args[1:]) if len(args) > 1 else ""
    db.add_admin(tid, display_name=name, role="support", added_by=user.id)
    await update.message.reply_text(f"✅ Адміна {tid} додано.")


async def cmd_deladmin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not db.is_admin(user.id):
        await update.message.reply_text(t("admin_only"))
        return
    args = context.args or []
    if not args:
        await update.message.reply_text("Usage: /deladmin <tg_id>")
        return
    try:
        tid = int(args[0])
    except ValueError:
        await update.message.reply_text("tg_id має бути числом.")
        return
    if tid in config.BOOTSTRAP_ADMIN_IDS:
        await update.message.reply_text("Не можна видалити bootstrap-адміна (з env).")
        return
    db.remove_admin(tid)
    await update.message.reply_text(f"✅ Адміна {tid} видалено.")


async def on_admin_bcasts(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    bcasts = db.list_recent_broadcasts(10)
    body = ["📜 *Останні розсилки:*\n"]
    if not bcasts:
        body.append("_(порожньо)_")
    for b in bcasts:
        ts = b.get("created_at")
        date = ts.strftime("%d.%m %H:%M") if hasattr(ts, "strftime") else "?"
        topic = _md_escape(b.get("topic") or "")
        text = _md_escape((b.get("text") or "")[:60].replace("\n", " "))
        body.append(
            f"• {_md_escape(date)} · {topic} · ✅{b.get('sent_count')}/"
            f"❌{b.get('failed_count')}\n  _{text}_"
        )
    await q.answer()
    try:
        await q.edit_message_text(
            "\n".join(body)[:4000],
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=admin_menu_kb(),
        )
    except Exception as e:
        # Fall back to plain text if some payload still trips the parser.
        log.warning("on_admin_bcasts markdown failed: %s — sending plain", e)
        plain = "\n".join(s.replace("*", "").replace("_", "").replace("`", "") for s in body)
        await q.edit_message_text(plain[:4000], reply_markup=admin_menu_kb())


USERS_PAGE_SIZE = 10


def _users_page_kb(page: int, total_pages: int):
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("« Попередня", callback_data=f"a:users:{page - 1}"))
    if page + 1 < total_pages:
        nav.append(InlineKeyboardButton("Наступна »", callback_data=f"a:users:{page + 1}"))
    rows = []
    if nav:
        rows.append(nav)
    rows.append([InlineKeyboardButton("« Меню", callback_data="a:menu")])
    return InlineKeyboardMarkup(rows)


def _user_detail_kb(tg_id: int, is_banned: bool):
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    rows = []
    if is_banned:
        rows.append([InlineKeyboardButton("✅ Розбанити", callback_data=f"a:user_unban:{tg_id}")])
    else:
        rows.append([InlineKeyboardButton("🚫 Забанити", callback_data=f"a:user_ban:{tg_id}")])
    rows.append([InlineKeyboardButton("« Назад до списку", callback_data="a:users:0")])
    return InlineKeyboardMarkup(rows)


async def on_admin_users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    page = int(parts[2]) if len(parts) >= 3 else 0
    total = db.count_all_subscribers()
    total_pages = max(1, (total + USERS_PAGE_SIZE - 1) // USERS_PAGE_SIZE)
    page = max(0, min(page, total_pages - 1))
    rows = db.list_all_subscribers(USERS_PAGE_SIZE, page * USERS_PAGE_SIZE)

    body = [f"👤 Юзери бота — {total} всього (стор. {page + 1}/{total_pages})\n"]
    if not rows:
        body.append("(порожньо)")
    for r in rows:
        uname = r.get("tg_username") or ""
        uname_str = f"@{uname}" if uname else (r.get("first_name") or "(no name)")
        joined = r.get("joined_at")
        joined_str = joined.strftime("%d.%m.%Y") if hasattr(joined, "strftime") else "?"
        flag = "🚫" if r.get("is_banned") else "✅"
        body.append(f"{flag} /u_{r['tg_id']} {uname_str} · {joined_str}")

    body.append("\n💡 Натисни на /u_<id> щоб відкрити деталі.")
    await q.answer()
    try:
        await q.edit_message_text(
            "\n".join(body)[:4000],
            reply_markup=_users_page_kb(page, total_pages),
        )
    except Exception as e:
        log.warning("on_admin_users edit failed: %s", e)
        await q.message.reply_text(
            "\n".join(body)[:4000],
            reply_markup=_users_page_kb(page, total_pages),
        )


async def cmd_user_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Triggered by /u_<tg_id> commands posted in the user list."""
    user = update.effective_user
    if not db.is_admin(user.id):
        return
    msg = update.message
    if not msg or not msg.text:
        return
    text = msg.text.strip()
    # extract tg_id from /u_123456789
    if not text.startswith("/u_"):
        return
    try:
        tg_id = int(text[3:].split()[0].split("@")[0])
    except (ValueError, IndexError):
        await msg.reply_text("Невірний формат. Очікую /u_<tg_id>")
        return
    sub = db.get_subscriber(tg_id) if hasattr(db, "get_subscriber") else db.fetch_one(
        "SELECT * FROM bot_subscribers WHERE tg_id=%s", (tg_id,)
    )
    if not sub:
        await msg.reply_text(f"Юзер {tg_id} не знайдений у базі.")
        return
    open_tickets = db.count_open_tickets_for_user(tg_id)
    msg_count = db.count_user_messages(tg_id)
    uname = sub.get("tg_username") or ""
    uname_str = f"@{uname}" if uname else (sub.get("first_name") or "(no name)")
    joined = sub.get("joined_at")
    joined_str = joined.strftime("%d.%m.%Y %H:%M") if hasattr(joined, "strftime") else "?"
    last_seen = sub.get("last_seen_at")
    last_seen_str = last_seen.strftime("%d.%m.%Y %H:%M") if hasattr(last_seen, "strftime") else "?"
    flag = "🚫 ЗАБАНЕНИЙ" if sub.get("is_banned") else "✅ активний"
    body = (
        f"👤 {uname_str}\n"
        f"🆔 tg_id: {tg_id}\n"
        f"🌐 lang: {sub.get('lang') or 'uk'}\n"
        f"📅 приєднався: {joined_str}\n"
        f"👁 був у боті: {last_seen_str}\n"
        f"🎫 відкритих тікетів: {open_tickets}\n"
        f"💬 повідомлень боту: {msg_count}\n"
        f"📌 статус: {flag}\n\n"
        f"💡 /logsuser {tg_id} — переглянути останні повідомлення."
    )
    if sub.get("banned_reason"):
        body += f"\n💬 причина бану: {sub['banned_reason']}"
    await msg.reply_text(body, reply_markup=_user_detail_kb(tg_id, bool(sub.get("is_banned"))))


async def on_user_ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    try:
        tg_id = int(parts[2])
    except ValueError:
        await q.answer("Невірний id")
        return
    db.ban_user(tg_id, reason=f"banned by admin {user.id}")
    await q.answer("Забанено", show_alert=True)
    await q.edit_message_reply_markup(reply_markup=_user_detail_kb(tg_id, True))


async def on_user_unban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    try:
        tg_id = int(parts[2])
    except ValueError:
        await q.answer("Невірний id")
        return
    db.unban_user(tg_id)
    await q.answer("Розбанено", show_alert=True)
    await q.edit_message_reply_markup(reply_markup=_user_detail_kb(tg_id, False))


# ─── Clear news ───

def _news_clean_menu_kb():
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    rows = [
        [InlineKeyboardButton("🗑 Видалити всі", callback_data="a:news_del:all")],
        [InlineKeyboardButton("📅 Старші 30 днів", callback_data="a:news_del:30")],
        [InlineKeyboardButton("📅 Старші 7 днів", callback_data="a:news_del:7")],
        [InlineKeyboardButton("🔢 За id", callback_data="a:news_del:byid")],
        [InlineKeyboardButton("« Меню", callback_data="a:menu")],
    ]
    return InlineKeyboardMarkup(rows)


def _news_confirm_kb(action: str):
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ Підтвердити", callback_data=f"a:news_confirm:{action}")],
        [InlineKeyboardButton("« Скасувати", callback_data="a:news_clean")],
    ])


async def on_admin_news_clean(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    # Show counts so admin sees what they're about to delete
    bcasts = db.list_recent_broadcasts(1000)
    news_total = sum(1 for b in bcasts if b.get("topic") in db.NEWS_TOPICS)
    body = (
        f"🗑 Очистити новини\n\n"
        f"Всього у фіді «📰 Новини» ({', '.join(db.NEWS_TOPICS)}): {news_total}\n\n"
        f"Виберіть що видалити:"
    )
    await q.answer()
    await q.edit_message_text(body, reply_markup=_news_clean_menu_kb())


async def on_admin_news_del(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    action = parts[2]
    await q.answer()
    if action == "byid":
        context.user_data["news_del_state"] = "wait_id"
        await q.edit_message_text(
            "🔢 Введіть id розсилки одним повідомленням.\n\n"
            "Список id видно у «📜 Логи розсилок».\n\n"
            "Скасувати: /cancel",
        )
        return
    label = {
        "all": "ВСІ новини",
        "30": "новини старші 30 днів",
        "7": "новини старші 7 днів",
    }.get(action, "")
    if not label:
        await q.answer("Невірна дія")
        return
    await q.edit_message_text(
        f"⚠️ Підтвердити видалення: {label}?\n\nЦю дію не можна відмінити.",
        reply_markup=_news_confirm_kb(action),
    )


async def on_admin_news_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    action = parts[2]
    if action == "all":
        n = db.delete_news_broadcasts(older_than_days=None)
    elif action == "30":
        n = db.delete_news_broadcasts(older_than_days=30)
    elif action == "7":
        n = db.delete_news_broadcasts(older_than_days=7)
    else:
        await q.answer("Невірна дія")
        return
    log.info("admin %s deleted %s news broadcasts (action=%s)", user.id, n, action)
    await q.answer(f"Видалено: {n}", show_alert=True)
    await q.edit_message_text(
        f"✅ Видалено: {n} розсилок.",
        reply_markup=admin_menu_kb(),
    )


async def handle_news_del_byid_message(update, context) -> bool:
    """If admin is in 'wait_id' state, consume the next message as broadcast id."""
    user = update.effective_user
    msg = update.message
    if not user or not msg or not db.is_admin(user.id):
        return False
    if context.user_data.get("news_del_state") != "wait_id":
        return False
    text = (msg.text or "").strip()
    try:
        bid = int(text)
    except ValueError:
        await msg.reply_text("Очікую число (id розсилки). Або /cancel.")
        return True
    n = db.delete_broadcast_by_id(bid)
    context.user_data.pop("news_del_state", None)
    if n:
        log.info("admin %s deleted broadcast id=%s", user.id, bid)
        await msg.reply_text(f"✅ Розсилку #{bid} видалено.", reply_markup=admin_menu_kb())
    else:
        await msg.reply_text(f"❌ Розсилку #{bid} не знайдено.", reply_markup=admin_menu_kb())
    return True


# ─── User message log (admin) ───

def _format_log_rows(rows, header: str) -> str:
    """Render a list of bot_user_messages rows as a Telegram-Markdown block.

    Rows are expected newest-first; we render them in chronological order
    (oldest at top) so reading them feels like a chat transcript."""
    if not rows:
        return header + "\n\n_(порожньо — користувач ще нічого не писав боту)_"
    parts = [header, ""]
    for r in reversed(rows):
        ts = r.get("created_at")
        ts_str = ts.strftime("%d.%m %H:%M") if hasattr(ts, "strftime") else "?"
        kind = r.get("kind") or "text"
        body = (r.get("text") or "").strip()
        if not body and kind != "text":
            body = f"[{kind}]"
        if len(body) > 220:
            body = body[:220] + " …"
        body = _md_escape(body) or "_(порожнє повідомлення)_"
        parts.append(f"`{ts_str}` · _{kind}_ · {body}")
    return "\n".join(parts)


async def cmd_logsuser(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/logsuser <tg_id> — show the last N messages a given user has sent
    the bot.  Admin-only.  Accepts a numeric tg_id or a leading @username
    (resolved via bot_subscribers)."""
    user = update.effective_user
    if not user or not db.is_admin(user.id):
        if update.message:
            await update.message.reply_text(t("admin_only"))
        return
    msg = update.message
    if not msg:
        return
    args = context.args or []
    if not args:
        await msg.reply_text(
            "Використання: `/logsuser <tg_id>` або `/logsuser @username`.\n"
            "Покажу останні 30 повідомлень користувача боту.",
            parse_mode=ParseMode.MARKDOWN,
        )
        return
    target = args[0].strip()
    tg_id: int | None = None
    if target.startswith("@"):
        uname = target[1:]
        row = db.fetch_one(
            "SELECT tg_id FROM bot_subscribers WHERE tg_username=%s LIMIT 1",
            (uname,),
        )
        if row:
            tg_id = int(row["tg_id"])
    else:
        try:
            tg_id = int(target)
        except ValueError:
            tg_id = None
    if tg_id is None:
        await msg.reply_text(
            f"❌ Не зміг визначити tg_id з `{_md_escape(target)}`.\n"
            "Спробуй `/logsuser 123456789` або `/logsuser @username`.",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    sub = db.get_subscriber(tg_id)
    rows = db.list_user_messages(tg_id, limit=30)
    total = db.count_user_messages(tg_id)
    uname = (sub or {}).get("tg_username") or ""
    name_str = f"@{uname}" if uname else ((sub or {}).get("first_name") or f"id={tg_id}")
    header = (
        f"📜 *Логи користувача* `{tg_id}` ({_md_escape(name_str)})\n"
        f"Усього записів: *{total}* · показую {len(rows)} останніх"
    )
    body = _format_log_rows(rows, header)
    # Telegram limit ~4096; truncate just in case.
    await msg.reply_text(
        body[:4000],
        parse_mode=ParseMode.MARKDOWN,
        disable_web_page_preview=True,
    )


async def on_admin_logs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin-menu button: show the last 25 messages across ALL users so the
    admin can quickly see what people are writing to the bot right now."""
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    rows = db.list_recent_user_messages(limit=25)
    if not rows:
        body = (
            "📜 *Логи повідомлень користувачів*\n\n"
            "_(поки порожньо — щойно увімкнено, дочекайтесь нових повідомлень)_\n\n"
            "💡 Для логів конкретного юзера: `/logsuser <tg_id>` або `/logsuser @username`."
        )
    else:
        parts = ["📜 *Останні повідомлення користувачів боту*", ""]
        for r in reversed(rows):
            ts = r.get("created_at")
            ts_str = ts.strftime("%d.%m %H:%M") if hasattr(ts, "strftime") else "?"
            uname = r.get("tg_username") or ""
            uname_str = f"@{uname}" if uname else (r.get("first_name") or f"id={r.get('tg_id')}")
            kind = r.get("kind") or "text"
            body_text = (r.get("text") or "").strip()
            if not body_text and kind != "text":
                body_text = f"[{kind}]"
            if len(body_text) > 120:
                body_text = body_text[:120] + " …"
            body_text = _md_escape(body_text) or "_(порожньо)_"
            parts.append(
                f"`{ts_str}` · {_md_escape(uname_str)} (/u\\_{r.get('tg_id')}): {body_text}"
            )
        parts.append("")
        parts.append("💡 `/logsuser <tg_id>` — повна історія конкретного юзера.")
        body = "\n".join(parts)
    await q.answer()
    try:
        await q.edit_message_text(
            body[:4000],
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=admin_menu_kb(),
            disable_web_page_preview=True,
        )
    except Exception as e:
        log.warning("on_admin_logs edit failed: %s", e)
        await q.message.reply_text(
            body[:4000],
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=admin_menu_kb(),
            disable_web_page_preview=True,
        )


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/stats — full text dump for terminal-style admins."""
    user = update.effective_user
    if not db.is_admin(user.id):
        await update.message.reply_text(t("admin_only"))
        return
    s = db.stats_summary()
    topic_lines = "\n".join(f"  • {k}: {v}" for k, v in (s.get("topic_counts") or {}).items())
    text = (
        "📊 *Статистика бота*\n\n"
        f"👥 Підписників: *{s['subscribers']}* (бан: {s['banned']})\n"
        f"🎫 Open/Wait/Answered/Closed/Spam: "
        f"{s.get('tickets_open',0)}/{s.get('tickets_awaiting_user',0)}/"
        f"{s.get('tickets_answered',0)}/{s.get('tickets_closed',0)}/"
        f"{s.get('tickets_spam',0)}\n"
        f"📢 Broadcasts(7d): {s.get('broadcasts_7d',0)}\n\n"
        f"🔔 Topics:\n{topic_lines or '  -'}"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)
