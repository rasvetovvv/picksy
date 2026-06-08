"""Picksy Telegram Bot — entry point.

General bot (no movie-picking — that lives on the website).
Provides:
- Support ticket system (full lifecycle, multi-admin, canned responses, CSAT)
- Daily Pick broadcast at 12:00 Kyiv
- News / events / weekly-digest / tip-of-day topical broadcasts
- Admin-driven broadcasts via inline wizard

Run:
    python -m telegram_bot.bot

Required env:
    TELEGRAM_BOT_TOKEN  — bot token from @BotFather
    PICKSY_ADMIN_CHAT_ID — chat where ticket notifications go
    PICKSY_BOT_ADMIN_IDS — comma-sep list of admin tg_ids
    MYSQL_*               — same DB as backend
    SITE_URL              — https://picksy.my
"""
from __future__ import annotations

import logging
import sys

from telegram import Update
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from . import config, db
from .handlers import admin as admin_h
from .handlers import ai as ai_h
from .handlers import broadcast as bcast_h
from .handlers import tickets as tk_h
from .handlers import user as user_h
from .scheduler import install_jobs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("picksy_bot")


async def on_error(update, context: ContextTypes.DEFAULT_TYPE):
    err = context.error
    err_str = str(err) if err else ""
    # Silently swallow harmless "Message is not modified" — happens when admin
    # double-clicks the same toggle button. Cosmetic, no user impact.
    if "message is not modified" in err_str.lower():
        return
    log.exception("Unhandled error: %s", err)
    # Best-effort fallback for Markdown parse failures: notify the user
    try:
        from telegram.error import BadRequest
        if (
            isinstance(err, BadRequest)
            and "parse entities" in err_str.lower()
            and getattr(update, "effective_chat", None)
        ):
            await context.bot.send_message(
                update.effective_chat.id,
                "⚠️ Сталась тимчасова помилка обробки повідомлення. "
                "Спробуйте ще раз або /start.",
            )
    except Exception:
        pass


async def post_init(app: Application) -> None:
    """Runs once after build, before polling."""
    log.info("=" * 60)
    log.info("Picksy bot configuration:")
    log.info("  ADMIN_CHAT_ID = %r", config.ADMIN_CHAT_ID)
    log.info("  BOOTSTRAP ADMINS = %r", config.BOOTSTRAP_ADMIN_IDS)
    log.info("  SITE_URL = %s", config.SITE_URL)
    if not config.ADMIN_CHAT_ID:
        log.warning("⚠️  PICKSY_ADMIN_CHAT_ID is NOT set — tickets will NOT "
                    "be forwarded anywhere. Set this env var in .env.")
    log.info("=" * 60)
    try:
        db.bootstrap_admins()
        db.seed_canned_if_empty()
    except Exception as e:
        log.warning("post_init: %s", e)
    try:
        db.init_bot_log_table()
    except Exception as e:
        log.warning("init_bot_log_table: %s", e)
    try:
        await app.bot.set_my_commands([
            ("start", "Привітання та головне меню"),
            ("ai", "🤖 Picksy AI — кіно-асистент"),
            ("help", "Довідка"),
            ("support", "🎫 Створити тікет підтримки"),
            ("mytickets", "Мої тікети"),
            ("subscribe", "🔔 Налаштувати підписки"),
            ("daily", "🎯 Daily Pick на сьогодні"),
            ("about", "ℹ️ Про Picksy"),
            ("site", "🌐 Перейти на сайт"),
            ("channel", "📣 Наш Telegram-канал"),
            ("cancel", "Скасувати поточну дію"),
        ])
    except Exception as e:
        log.warning("set_my_commands: %s", e)


# ─── Combined message router ───

async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Order matters:
    1. Reply-keyboard buttons (always handled first if it's a known button text).
    2. Admin reply / note mode.
    3. Admin daily-pick setup wizard.
    4. Admin broadcast wizard.
    5. User ticket flow (new ticket / append).
    6. Fallback: gentle nudge (DM only — silent in groups).
    """
    if not update.message:
        return
    user = update.effective_user
    if not user:
        return
    chat = update.effective_chat
    is_group = bool(chat and chat.type in ("group", "supergroup"))

    # In groups: only admins can interact, and only via reply-to-bot, the
    # active admin-reply / note / broadcast wizard mode. Non-admins and any
    # unrelated chatter → silently ignored.
    if is_group:
        if not db.is_admin(user.id):
            return
        replied_to_bot = (
            update.message.reply_to_message is not None
            and update.message.reply_to_message.from_user is not None
            and update.message.reply_to_message.from_user.id == context.bot.id
        )
        in_reply_mode = bool(
            context.user_data.get("admin_reply_for")
            or context.user_data.get("admin_note_for")
            or context.user_data.get("broadcast_state")
            or context.user_data.get("admin_dailypick_state")
            or context.user_data.get("news_del_state")
        )
        if not (replied_to_bot or in_reply_mode):
            return
        if await admin_h.handle_news_del_byid_message(update, context):
            return
        if await tk_h.handle_admin_reply_message(update, context):
            return
        if await bcast_h.handle_text_or_media(update, context):
            return
        return  # never nag in groups

    # Track every message author (DMs only, not group chatter)
    try:
        db.upsert_subscriber(user.id, user.username, user.first_name)
    except Exception:
        pass

    # 1. Reply keyboard
    if update.message.text:
        handled = await user_h.reply_button_router(update, context)
        if handled:
            return

    # 2. Admin reply/note mode (only if admin in admin chat or DM)
    if db.is_admin(user.id):
        if await admin_h.handle_news_del_byid_message(update, context):
            return
        if await tk_h.handle_admin_reply_message(update, context):
            return
        # 3. Broadcast wizard
        if await bcast_h.handle_text_or_media(update, context):
            return

    # 4.5. Picksy AI link detection (picksy.my/descmovie/... or /desctv/...)
    if update.message.text and await ai_h.handle_movie_link(update, context):
        return

    # 5. User ticket flow
    if await tk_h.handle_user_ticket_message(update, context):
        return

    # 6. Fallback (DM only)
    if update.message.text:
        await update.message.reply_text(
            "Скористайтесь кнопками внизу або /help, щоб побачити що я вмію 🤖\n"
            "Спробуй /ai — Picksy AI допоможе підібрати фільм!"
        )


def build_app() -> Application:
    if not config.is_configured():
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set")

    app = (
        ApplicationBuilder()
        .token(config.BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    # ─── Commands (user) ───
    app.add_handler(CommandHandler("start", user_h.cmd_start))
    app.add_handler(CommandHandler("help", user_h.cmd_help))
    app.add_handler(CommandHandler("about", user_h.cmd_about))
    app.add_handler(CommandHandler("site", user_h.cmd_site))
    app.add_handler(CommandHandler("channel", user_h.cmd_channel))
    app.add_handler(CommandHandler("tg", user_h.cmd_channel))
    app.add_handler(CommandHandler("telegram", user_h.cmd_channel))
    app.add_handler(CommandHandler("daily", user_h.cmd_daily_pick))
    app.add_handler(CommandHandler("dailypick", user_h.cmd_daily_pick))
    app.add_handler(CommandHandler("settings", user_h.cmd_settings))
    app.add_handler(CommandHandler("subscribe", user_h.cmd_settings))
    app.add_handler(CommandHandler("news", user_h.cmd_news))
    app.add_handler(CommandHandler("ai", ai_h.cmd_ai))

    # ─── Tickets ───
    async def cmd_support(update: Update, context: ContextTypes.DEFAULT_TYPE):
        from .keyboards import support_intro_kb
        from .i18n import t
        from telegram.constants import ParseMode
        await update.message.reply_text(
            t("support_intro"),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=support_intro_kb(),
        )

    async def cmd_mytickets(update: Update, context: ContextTypes.DEFAULT_TYPE):
        from .keyboards import my_tickets_kb, support_intro_kb
        from .i18n import t
        from telegram.constants import ParseMode
        u = update.effective_user
        tickets = db.list_tickets_for_user(u.id, 10)
        if not tickets:
            await update.message.reply_text(t("ticket_no_open"), reply_markup=support_intro_kb())
            return
        parts = ["📋 *Мої тікети:*\n"]
        for tk in tickets:
            cat = dict(config.TICKET_CATEGORIES).get(tk.get("category"), "❓")
            status = tk.get("status")
            sub = (tk.get("subject") or "")[:60]
            parts.append(f"• #{tk['id']} {cat} — _{status}_ — {sub}")
        await update.message.reply_text(
            "\n".join(parts), parse_mode=ParseMode.MARKDOWN,
            reply_markup=my_tickets_kb(tickets),
        )

    app.add_handler(CommandHandler("support", cmd_support))
    app.add_handler(CommandHandler("ticket", cmd_support))
    app.add_handler(CommandHandler("mytickets", cmd_mytickets))
    app.add_handler(CommandHandler("cancel", tk_h.cmd_cancel))

    # ─── Admin commands ───
    app.add_handler(CommandHandler("admin", admin_h.cmd_admin))
    app.add_handler(CommandHandler("stats", admin_h.cmd_stats))
    app.add_handler(CommandHandler("logsuser", admin_h.cmd_logsuser))
    app.add_handler(CommandHandler("userlogs", admin_h.cmd_logsuser))
    app.add_handler(CommandHandler("broadcast", bcast_h.cmd_broadcast))
    app.add_handler(CommandHandler("addadmin", admin_h.cmd_addadmin))
    app.add_handler(CommandHandler("deladmin", admin_h.cmd_deladmin))

    # ─── Diagnostic command: /chatid (works in groups + DMs) ───
    async def cmd_chatid(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat = update.effective_chat
        msg_chat_id = chat.id if chat else "?"
        msg_chat_type = chat.type if chat else "?"
        from_id = update.effective_user.id if update.effective_user else "?"
        match = "✅ збігається" if str(msg_chat_id) == str(config.ADMIN_CHAT_ID) \
            else "⚠️ НЕ збігається — бот не слатиме тікети сюди"
        await update.effective_chat.send_message(
            f"🆔 chat_id: {msg_chat_id}\n"
            f"📂 chat_type: {msg_chat_type}\n"
            f"👤 your tg_id: {from_id}\n\n"
            f"⚙️ ADMIN_CHAT_ID у боті: {config.ADMIN_CHAT_ID}\n"
            f"{match}"
        )

    app.add_handler(CommandHandler("chatid", cmd_chatid))
    app.add_handler(CommandHandler("id", cmd_chatid))

    # ─── Callbacks: settings / lang / subs ───
    app.add_handler(CallbackQueryHandler(user_h.on_settings_open, pattern=r"^u:settings$"))
    app.add_handler(CallbackQueryHandler(user_h.on_user_rules, pattern=r"^u:rules$"))
    app.add_handler(CallbackQueryHandler(user_h.on_user_privacy, pattern=r"^u:privacy$"))
    app.add_handler(CallbackQueryHandler(user_h.on_user_delete, pattern=r"^u:delete$"))
    app.add_handler(CallbackQueryHandler(user_h.on_subs_open, pattern=r"^s:open$"))
    app.add_handler(CallbackQueryHandler(user_h.on_subs_toggle, pattern=r"^s:toggle:"))
    app.add_handler(CallbackQueryHandler(user_h.on_subs_disable_all, pattern=r"^s:disable_all$"))
    app.add_handler(CallbackQueryHandler(user_h.on_lang_open, pattern=r"^l:open$"))
    app.add_handler(CallbackQueryHandler(user_h.on_lang_set, pattern=r"^l:set:"))

    # ─── Callbacks: tickets (user) ───
    app.add_handler(CallbackQueryHandler(tk_h.on_ticket_new_button, pattern=r"^t:new$"))
    app.add_handler(CallbackQueryHandler(tk_h.on_ticket_category, pattern=r"^t:cat:"))
    app.add_handler(CallbackQueryHandler(tk_h.on_ticket_priority, pattern=r"^t:prio:"))
    app.add_handler(CallbackQueryHandler(tk_h.on_ticket_cancel, pattern=r"^t:cancel$"))
    app.add_handler(CallbackQueryHandler(tk_h.on_my_tickets, pattern=r"^t:my_list$"))
    app.add_handler(CallbackQueryHandler(tk_h.on_ticket_view, pattern=r"^t:view:"))
    app.add_handler(CallbackQueryHandler(tk_h.on_user_close, pattern=r"^t:user_close:"))
    app.add_handler(CallbackQueryHandler(tk_h.on_user_reopen, pattern=r"^t:user_reopen:"))
    app.add_handler(CallbackQueryHandler(tk_h.on_user_csat, pattern=r"^t:csat:"))
    app.add_handler(CallbackQueryHandler(tk_h.on_user_csat_set, pattern=r"^t:csat_set:"))
    app.add_handler(CallbackQueryHandler(tk_h.on_ticket_rules, pattern=r"^t:rules$"))

    # ─── Callbacks: tickets (admin) ───
    app.add_handler(CallbackQueryHandler(tk_h.admin_open_list, pattern=r"^a:t_list:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_view_ticket, pattern=r"^a:t_view:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_reply_start, pattern=r"^a:t_reply:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_note_start, pattern=r"^a:t_note:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_close_ticket, pattern=r"^a:t_close:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_set_wait, pattern=r"^a:t_wait:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_set_priority, pattern=r"^a:t_prio:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_assign_self, pattern=r"^a:t_assign:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_canned_show, pattern=r"^a:t_canned:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_canned_send, pattern=r"^a:t_canned_send:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_spam, pattern=r"^a:t_spam:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_ban, pattern=r"^a:t_ban:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_reopen, pattern=r"^a:t_reopen:"))
    app.add_handler(CallbackQueryHandler(tk_h.admin_user_history, pattern=r"^a:t_user_history:"))

    # ─── Callbacks: admin menu ───
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_menu, pattern=r"^a:menu$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_close, pattern=r"^a:close$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_stats, pattern=r"^a:stats$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_top_users, pattern=r"^a:top_users$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_health, pattern=r"^a:health$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_site_stats, pattern=r"^a:site_stats$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_pick_menu, pattern=r"^a:pick_menu$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_pick_view, pattern=r"^a:pick_view$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_pick_send_now, pattern=r"^a:pick_send_now$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_admins, pattern=r"^a:admins$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_bcasts, pattern=r"^a:bcasts$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_logs, pattern=r"^a:logs$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_users, pattern=r"^a:users:\d+$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_user_ban, pattern=r"^a:user_ban:\d+$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_user_unban, pattern=r"^a:user_unban:\d+$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_news_clean, pattern=r"^a:news_clean$"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_news_del, pattern=r"^a:news_del:"))
    app.add_handler(CallbackQueryHandler(admin_h.on_admin_news_confirm, pattern=r"^a:news_confirm:"))
    # /u_<tg_id> command — opens user detail card
    from telegram.ext import MessageHandler, filters as tg_filters
    app.add_handler(MessageHandler(
        tg_filters.Regex(r"^/u_\d+(?:@\w+)?$"),
        admin_h.cmd_user_detail,
    ))

    # ─── Callbacks: Picksy AI ───
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_menu, pattern=r"^ai:menu$"))
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_analyze_prompt, pattern=r"^ai:analyze$"))
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_tip, pattern=r"^ai:tip$"))
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_fact, pattern=r"^ai:fact$"))
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_mood, pattern=r"^ai:mood$"))
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_mood_pick, pattern=r"^ai:mood_pick:"))
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_horoscope, pattern=r"^ai:horoscope$"))
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_horoscope_pick, pattern=r"^ai:horo:"))
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_random, pattern=r"^ai:random$"))
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_archetype_info, pattern=r"^ai:archetypes$"))
    app.add_handler(CallbackQueryHandler(ai_h.on_ai_weekly_challenge, pattern=r"^ai:challenge$"))

    # ─── Callbacks: broadcast wizard ───
    app.add_handler(CallbackQueryHandler(bcast_h.on_open_wizard, pattern=r"^b:wizard$"))
    app.add_handler(CallbackQueryHandler(bcast_h.on_topic_selected, pattern=r"^b:topic:"))
    app.add_handler(CallbackQueryHandler(bcast_h.on_cancel, pattern=r"^b:cancel$"))
    app.add_handler(CallbackQueryHandler(bcast_h.on_add_photo, pattern=r"^b:add_photo$"))
    app.add_handler(CallbackQueryHandler(bcast_h.on_add_button, pattern=r"^b:add_button$"))
    app.add_handler(CallbackQueryHandler(bcast_h.on_edit_text, pattern=r"^b:edit_text$"))
    app.add_handler(CallbackQueryHandler(bcast_h.on_back_to_options, pattern=r"^b:back_to_options$"))
    app.add_handler(CallbackQueryHandler(bcast_h.on_preview, pattern=r"^b:preview$"))
    app.add_handler(CallbackQueryHandler(bcast_h.on_send, pattern=r"^b:send$"))
    app.add_handler(CallbackQueryHandler(bcast_h.on_confirm_send, pattern=r"^b:confirm_send$"))

    # ─── Log every incoming message (DM only) BEFORE any other routing so
    #     /logsuser & the admin "logs" view can show what users wrote. ───
    async def _log_incoming(update: Update, context: ContextTypes.DEFAULT_TYPE):
        try:
            msg = update.effective_message
            user = update.effective_user
            chat = update.effective_chat
            if not msg or not user:
                return
            # Skip group chatter — only DMs to the bot are interesting.
            if chat and chat.type in ("group", "supergroup", "channel"):
                return
            # Figure out the kind + file_id
            kind = "text"
            file_id = None
            text = msg.text or msg.caption or ""
            if msg.photo:
                kind = "photo"
                file_id = msg.photo[-1].file_id
            elif msg.video:
                kind = "video"
                file_id = msg.video.file_id
            elif msg.document:
                kind = "document"
                file_id = msg.document.file_id
            elif msg.voice:
                kind = "voice"
                file_id = msg.voice.file_id
            elif msg.sticker:
                kind = "sticker"
                file_id = msg.sticker.file_id
            elif msg.animation:
                kind = "animation"
                file_id = msg.animation.file_id
            elif msg.audio:
                kind = "audio"
                file_id = msg.audio.file_id
            elif msg.location:
                kind = "location"
                text = f"{msg.location.latitude},{msg.location.longitude}"
            elif msg.contact:
                kind = "contact"
                text = msg.contact.phone_number or ""
            elif text and text.startswith("/"):
                kind = "command"
            db.log_user_message(
                tg_id=user.id,
                tg_username=user.username,
                chat_type=(chat.type if chat else None),
                kind=kind,
                text=text or None,
                file_id=file_id,
            )
        except Exception as e:
            log.debug("_log_incoming: %s", e)
    # Group -1 runs BEFORE the default group 0 handlers and does not consume
    # the update (we never return inside it).
    app.add_handler(MessageHandler(filters.ALL, _log_incoming), group=-1)

    # ─── Catch-all message handler ───
    app.add_handler(MessageHandler(filters.ALL & ~filters.COMMAND, on_message))

    app.add_error_handler(on_error)

    install_jobs(app)

    return app


def main() -> None:
    if not config.is_configured():
        log.error("TELEGRAM_BOT_TOKEN is not set in environment. Bot will not start.")
        sys.exit(1)
    app = build_app()
    log.info("Picksy bot starting (long polling)…")
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)


if __name__ == "__main__":
    main()
