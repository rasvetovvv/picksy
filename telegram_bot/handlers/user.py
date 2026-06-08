"""User-facing handlers: /start, settings, subscriptions, daily pick view, about."""
from __future__ import annotations

import logging
from typing import Optional

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from .. import config, db
from ..i18n import t
from ..keyboards import (
    lang_inline_kb,
    main_reply_kb,
    settings_inline_kb,
    subs_inline_kb,
    support_intro_kb,
)

log = logging.getLogger("picksy_bot.user")


def _track(update: Update) -> None:
    user = update.effective_user
    if not user:
        return
    try:
        db.upsert_subscriber(user.id, user.username, user.first_name)
    except Exception as e:
        log.warning("upsert_subscriber failed: %s", e)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _track(update)
    user = update.effective_user
    is_admin = db.is_admin(user.id) if user else False

    # Deep link: /start ai → open AI menu directly
    if context.args and context.args[0] == "ai":
        from .ai import cmd_ai
        await update.message.reply_text(
            t("welcome"),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=main_reply_kb(is_admin=is_admin),
        )
        await cmd_ai(update, context)
        return

    # Deep link: /start analyze_movie_12345 or analyze_tv_67890
    # Auto-analyze movie/tv from website button click
    if context.args and context.args[0].startswith("analyze_"):
        from .ai import auto_analyze_by_id
        await update.message.reply_text(
            t("welcome"),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=main_reply_kb(is_admin=is_admin),
        )
        await auto_analyze_by_id(update, context, context.args[0])
        return

    await update.message.reply_text(
        t("welcome"),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=main_reply_kb(is_admin=is_admin),
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _track(update)
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    text = (
        "📖 *Що вміє Picksy Bot*\n\n"
        "🤖 *Picksy AI* — розумний кіно-асистент:\n"
        "   • Аналіз фільмів та серіалів по архетипах\n"
        "   • Підбір за настроєм\n"
        "   • Кіно-гороскоп\n"
        "   • Поради, факти, челенджі\n"
        "   • Вечірня розсилка о 20:00\n\n"
        "🎯 Daily Pick — щодня о 12:00 (Київ) надсилаємо тобі добірку дня з сайту: "
        "фільм, серіал і книгу.\n"
        "📰 Новини — анонси нових фіч, подій і свят.\n"
        "🎫 Підтримка — пиши нам сюди, і команда відповість якнайшвидше.\n"
        "🔔 Підписки — обери, що саме хочеш отримувати.\n\n"
        "💡 *Аналіз фільму:* просто надішли посилання з picksy.my/descmovie/... "
        "або picksy.my/desctv/... і отримай AI-аналіз!\n\n"
        "Все керується кнопками внизу екрану. Жодних команд знати не треба 💛\n\n"
        f"🌐 *Сайт:* {config.SITE_URL}\n"
        f"📣 *Телеграм-канал:* {config.TG_CHANNEL_USERNAME} — {config.TG_CHANNEL_URL}\n\n"
        f"Заходь на {config.SITE_URL} — там підбираєш собі ідеальне кіно, серіал і книгу, "
        f"а на {config.TG_CHANNEL_USERNAME} — щоденні підбірки, анонси та розіграші."
    )
    markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("🌐 Відкрити picksy.my", url=config.SITE_URL)],
        [InlineKeyboardButton(f"📣 Канал {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
    ])
    await update.message.reply_text(
        text, parse_mode=ParseMode.MARKDOWN,
        disable_web_page_preview=True, reply_markup=markup,
    )


async def cmd_about(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _track(update)
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("🌐 Відкрити picksy.my", url=config.SITE_URL)],
        [InlineKeyboardButton(f"📣 Канал {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
    ])
    await update.message.reply_text(
        t("about"),
        parse_mode=ParseMode.MARKDOWN,
        disable_web_page_preview=True,
        reply_markup=markup,
    )


async def cmd_site(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _track(update)
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    text = (
        f"🌐 *Picksy*\n\n"
        f"Сайт: {config.SITE_URL}\n"
        f"Телеграм-канал: {config.TG_CHANNEL_USERNAME} — {config.TG_CHANNEL_URL}\n\n"
        f"Підписуйся на {config.TG_CHANNEL_USERNAME}, щоб першим бачити новини та підбірки 💛"
    )
    markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("🌐 Відкрити picksy.my", url=config.SITE_URL)],
        [InlineKeyboardButton(f"📣 Канал {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
    ])
    await update.message.reply_text(
        text, parse_mode=ParseMode.MARKDOWN,
        disable_web_page_preview=True, reply_markup=markup,
    )


async def cmd_channel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Quick command that points the user to the public Telegram channel."""
    _track(update)
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    text = (
        f"📣 *Наш Телеграм-канал: {config.TG_CHANNEL_USERNAME}*\n\n"
        f"{config.TG_CHANNEL_URL}\n\n"
        "Там ми публікуємо:\n"
        "• щоденні підбірки фільмів, серіалів і книг\n"
        "• анонси нових фіч на picksy.my\n"
        "• розіграші та спецпроєкти\n"
        "• цікавий кіно-контент від команди Picksy\n\n"
        f"А весь архів фільмів, серіалів і книг — на сайті {config.SITE_URL}."
    )
    markup = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"📣 Підписатися на {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
        [InlineKeyboardButton("🌐 Відкрити picksy.my", url=config.SITE_URL)],
    ])
    await update.message.reply_text(
        text, parse_mode=ParseMode.MARKDOWN,
        disable_web_page_preview=True, reply_markup=markup,
    )


async def cmd_settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _track(update)
    await update.message.reply_text(
        t("settings_intro"),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=settings_inline_kb(),
    )


async def cmd_daily_pick(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show today's daily pick (movie + tv + book) — fetched from the site."""
    _track(update)
    from ..scheduler import build_daily_pick_message
    msg = await build_daily_pick_message()
    if not msg:
        await update.message.reply_text(t("daily_pick_none"))
        return
    caption, poster, markup = msg
    chat = update.effective_chat
    try:
        if poster:
            await context.bot.send_photo(
                chat.id,
                photo=poster,
                caption=caption[:1024],
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=markup,
            )
            return
    except Exception as e:
        log.info("send_photo failed: %s; falling back to text", e)
    await context.bot.send_message(
        chat.id,
        caption,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=markup,
        disable_web_page_preview=False,
    )


async def cmd_news(update: Update, context: ContextTypes.DEFAULT_TYPE):
    _track(update)
    bcasts = db.list_recent_broadcasts(5)
    bcasts = [b for b in bcasts if b.get("topic") in ("news", "_all", "events")]
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    markup = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"📣 Підписатися на {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
        [InlineKeyboardButton("🌐 Відкрити picksy.my", url=config.SITE_URL)],
    ])
    if not bcasts:
        await update.message.reply_text(
            "📭 Поки що жодних новин. Коли щось з'явиться — повідомимо тут.\n\n"
            f"А поки що — підпишися на {config.TG_CHANNEL_USERNAME} ({config.TG_CHANNEL_URL}), "
            f"або заходь на {config.SITE_URL} — там оновлення виходять першими.",
            disable_web_page_preview=True,
            reply_markup=markup,
        )
        return
    parts = ["📰 *Останні новини:*\n"]
    for b in bcasts:
        ts = b.get("created_at")
        date = ts.strftime("%d.%m %H:%M") if hasattr(ts, "strftime") else ""
        text = (b.get("text") or "")[:300]
        parts.append(f"\n*{date}*\n{text}\n")
    parts.append(
        f"\n———\n📣 Більше новин та підбірок — на {config.TG_CHANNEL_USERNAME} ({config.TG_CHANNEL_URL})\n"
        f"🌐 Сайт: {config.SITE_URL}"
    )
    await update.message.reply_text(
        "".join(parts),
        parse_mode=ParseMode.MARKDOWN,
        disable_web_page_preview=True,
        reply_markup=markup,
    )


# ─── Reply-keyboard text router ───

REPLY_BUTTONS = {
    "🤖 Picksy AI": "picksy_ai",
    "🎯 Daily Pick": "daily_pick",
    "🎫 Підтримка": "support_intro",
    "📰 Новини": "news",
    "🔔 Підписки": "subs",
    "⚙️ Налаштування": "settings",
    "ℹ️ Про Picksy": "about",
    "🛠 Адмін-меню": "admin_menu",
}


async def reply_button_router(update: Update, context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
    """Map reply-keyboard taps to actions. Returns the action key handled, or None."""
    text = (update.message.text or "").strip()
    action = REPLY_BUTTONS.get(text)
    if not action:
        return None
    _track(update)
    user = update.effective_user

    if action == "picksy_ai":
        from .ai import cmd_ai
        await cmd_ai(update, context)
    elif action == "daily_pick":
        await cmd_daily_pick(update, context)
    elif action == "support_intro":
        await update.message.reply_text(
            t("support_intro"),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=support_intro_kb(),
        )
    elif action == "news":
        await cmd_news(update, context)
    elif action == "subs":
        state = db.get_subscriptions(user.id)
        await update.message.reply_text(
            t("subs_intro"),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=subs_inline_kb(state),
        )
    elif action == "settings":
        await cmd_settings(update, context)
    elif action == "about":
        await cmd_about(update, context)
    elif action == "admin_menu":
        if not db.is_admin(user.id):
            await update.message.reply_text(t("admin_only"))
            return action
        from .admin import open_admin_menu
        await open_admin_menu(update, context)
    return action


# ─── Inline callback handlers (settings/subs/lang/user) ───

async def on_settings_open(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    await q.edit_message_text(
        t("settings_intro"),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=settings_inline_kb(),
    )


async def on_subs_open(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    await q.answer()
    state = db.get_subscriptions(user.id)
    await q.edit_message_text(
        t("subs_intro"),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=subs_inline_kb(state),
    )


async def on_subs_toggle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    topic = parts[2]
    state = db.get_subscriptions(user.id)
    new_val = not state.get(topic, False)
    db.set_subscription(user.id, topic, new_val)
    await q.answer("✅ Увімкнено" if new_val else "🔕 Вимкнено")
    state[topic] = new_val
    await q.edit_message_reply_markup(reply_markup=subs_inline_kb(state))


async def on_subs_disable_all(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    db.disable_all_subscriptions(user.id)
    await q.answer(t("all_subs_disabled"))
    state = db.get_subscriptions(user.id)
    await q.edit_message_reply_markup(reply_markup=subs_inline_kb(state))


async def on_lang_open(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    sub = db.get_subscriber(user.id) or {}
    await q.answer()
    await q.edit_message_text(
        t("lang_intro"),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=lang_inline_kb(sub.get("lang") or "uk"),
    )


async def on_lang_set(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    lang = parts[2]
    if lang not in ("uk", "en"):
        await q.answer()
        return
    db.set_lang(user.id, lang)
    await q.answer(t("lang_set", lang=lang))
    await q.edit_message_text(
        t("lang_intro"),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=lang_inline_kb(lang),
    )


async def on_user_rules(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    await q.edit_message_text(
        t("rules", days=config.TICKET_AUTO_CLOSE_DAYS),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=settings_inline_kb(),
    )


async def on_user_privacy(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    await q.edit_message_text(
        t("privacy"),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=settings_inline_kb(),
    )


async def on_user_delete(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    confirmed = context.user_data.get("confirm_delete", False)
    if not confirmed:
        context.user_data["confirm_delete"] = True
        await q.answer()
        await q.edit_message_text(
            t("data_delete_confirm"),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=settings_inline_kb(),
        )
        return
    # Confirmed: delete data
    db.execute("DELETE FROM bot_subscriptions WHERE tg_id=%s", (user.id,))
    db.execute("DELETE FROM ticket_messages WHERE tg_id=%s", (user.id,))
    db.execute("DELETE FROM support_tickets WHERE tg_id=%s", (user.id,))
    db.execute("DELETE FROM bot_subscribers WHERE tg_id=%s", (user.id,))
    context.user_data.pop("confirm_delete", None)
    await q.answer("Видалено")
    await q.edit_message_text(t("data_deleted"))
