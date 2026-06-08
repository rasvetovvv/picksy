"""Broadcast wizard for admins.

Flow (all via inline buttons):
1. Open via "📢 Розсилка" in admin menu OR /broadcast
2. Pick topic: news / _all / events / tip
3. Send next message → text saved
4. Options: add photo, add button (text|url), preview, send
5. Confirm → progress → done

State keys in context.user_data:
- bcast_state: pick_topic | await_text | options | await_photo | await_button | sending
- bcast_topic: topic slug
- bcast_text: message text
- bcast_button_text, bcast_button_url
- bcast_photo_file_id
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.error import RetryAfter, TelegramError, Forbidden, BadRequest
from telegram.ext import ContextTypes

from .. import config, db
from ..i18n import t
from ..keyboards import admin_menu_kb, bcast_confirm_kb, bcast_options_kb, bcast_topic_kb

log = logging.getLogger("picksy_bot.broadcast")


async def cmd_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not db.is_admin(user.id):
        await update.message.reply_text(t("admin_only"))
        return
    context.user_data["bcast_state"] = "pick_topic"
    context.user_data.pop("bcast_topic", None)
    context.user_data.pop("bcast_text", None)
    context.user_data.pop("bcast_button_text", None)
    context.user_data.pop("bcast_button_url", None)
    context.user_data.pop("bcast_photo_file_id", None)
    await update.message.reply_text(
        "📢 *Розсилка — крок 1*\n\nКуди надсилати?",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=bcast_topic_kb(),
    )


async def on_open_wizard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    context.user_data["bcast_state"] = "pick_topic"
    context.user_data.pop("bcast_topic", None)
    context.user_data.pop("bcast_text", None)
    context.user_data.pop("bcast_button_text", None)
    context.user_data.pop("bcast_button_url", None)
    context.user_data.pop("bcast_photo_file_id", None)
    await q.answer()
    await q.edit_message_text(
        "📢 *Розсилка — крок 1*\n\nКуди надсилати?",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=bcast_topic_kb(),
    )


async def on_topic_selected(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    topic = parts[2]
    context.user_data["bcast_topic"] = topic
    context.user_data["bcast_state"] = "await_text"
    await q.answer()
    target = "_all" if topic == "_all" else topic
    label = {
        "news": "Новини (підписники news)",
        "_all": "УСІМ юзерам бота",
        "events": "Свята та події",
        "tip_of_the_day": "Підказки",
    }.get(topic, topic)
    await q.edit_message_text(
        f"📢 *Розсилка — крок 2*\n\nТопік: *{label}*\n\n"
        "Тепер надішліть *текст повідомлення* (до 4000 символів).\n"
        "Markdown: *bold*, _italic_, `code`, [link](https://...)",
        parse_mode=ParseMode.MARKDOWN,
    )


async def on_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    for k in ("bcast_state", "bcast_topic", "bcast_text", "bcast_button_text",
              "bcast_button_url", "bcast_photo_file_id"):
        context.user_data.pop(k, None)
    await q.answer("Скасовано")
    await q.edit_message_text(
        "❌ Розсилку скасовано.",
        reply_markup=admin_menu_kb(),
    )


async def handle_text_or_media(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """Consume admin's bcast text / photo / button while wizard is active.

    Returns True if message was consumed.
    """
    user = update.effective_user
    msg = update.message
    if not user or not msg:
        return False
    if not db.is_admin(user.id):
        return False
    state = context.user_data.get("bcast_state")
    if not state:
        return False

    if state == "await_text":
        text = (msg.text or msg.caption or "").strip()
        if not text:
            await msg.reply_text("Текст не може бути порожнім. Надішліть ще раз або /cancel.")
            return True
        context.user_data["bcast_text"] = text
        # If photo attached at the same time
        if msg.photo:
            context.user_data["bcast_photo_file_id"] = msg.photo[-1].file_id
        context.user_data["bcast_state"] = "options"
        await msg.reply_text(
            "✅ Текст збережено.\n\nНалаштуйте додатково або надішліть:",
            reply_markup=bcast_options_kb(),
        )
        return True

    if state == "await_photo":
        if msg.photo:
            context.user_data["bcast_photo_file_id"] = msg.photo[-1].file_id
            context.user_data["bcast_state"] = "options"
            await msg.reply_text("✅ Фото збережено.", reply_markup=bcast_options_kb())
            return True
        await msg.reply_text("Це не фото. Надішліть фото або /cancel.")
        return True

    if state == "await_button":
        text = (msg.text or "").strip()
        if "|" not in text:
            await msg.reply_text("Формат: `Текст кнопки | https://url.com`", parse_mode=ParseMode.MARKDOWN)
            return True
        btn_text, btn_url = [p.strip() for p in text.split("|", 1)]
        if not (btn_url.startswith("http://") or btn_url.startswith("https://")):
            await msg.reply_text("URL має починатись з http:// або https://")
            return True
        context.user_data["bcast_button_text"] = btn_text[:120]
        context.user_data["bcast_button_url"] = btn_url[:500]
        context.user_data["bcast_state"] = "options"
        await msg.reply_text("✅ Кнопку збережено.", reply_markup=bcast_options_kb())
        return True

    if state == "await_edit":
        text = (msg.text or msg.caption or "").strip()
        if not text:
            await msg.reply_text("Порожньо. /cancel або надішліть ще раз.")
            return True
        context.user_data["bcast_text"] = text
        context.user_data["bcast_state"] = "options"
        await msg.reply_text("✅ Текст оновлено.", reply_markup=bcast_options_kb())
        return True

    return False


async def on_add_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    context.user_data["bcast_state"] = "await_photo"
    await q.answer()
    await q.edit_message_text("📸 Надішліть фото для розсилки (одне зображення).")


async def on_add_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    context.user_data["bcast_state"] = "await_button"
    await q.answer()
    await q.edit_message_text(
        "🔘 Надішліть кнопку у форматі:\n"
        "`Текст кнопки | https://example.com`",
        parse_mode=ParseMode.MARKDOWN,
    )


async def on_edit_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    context.user_data["bcast_state"] = "await_edit"
    await q.answer()
    await q.edit_message_text("✏️ Надішліть новий текст.")


async def on_back_to_options(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    context.user_data["bcast_state"] = "options"
    await q.answer()
    await q.edit_message_text(
        "Налаштуйте додатково або надішліть:",
        reply_markup=bcast_options_kb(),
    )


def _build_target_list(topic: str) -> List[int]:
    if topic == "_all":
        return db.list_all_subscribers()
    return db.list_subscribers_for_topic(topic)


def _make_button_markup(button_text: Optional[str], button_url: Optional[str]):
    if button_text and button_url:
        return InlineKeyboardMarkup([[InlineKeyboardButton(button_text, url=button_url)]])
    return None


async def on_preview(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    text = context.user_data.get("bcast_text")
    if not text:
        await q.answer("Спершу надішліть текст.")
        return
    photo = context.user_data.get("bcast_photo_file_id")
    btn_text = context.user_data.get("bcast_button_text")
    btn_url = context.user_data.get("bcast_button_url")
    markup = _make_button_markup(btn_text, btn_url)
    await q.answer()
    await q.message.reply_text("👁 *Прев'ю — як це побачить юзер:*", parse_mode=ParseMode.MARKDOWN)
    try:
        if photo:
            await context.bot.send_photo(
                q.message.chat_id, photo=photo, caption=text[:1024],
                parse_mode=ParseMode.MARKDOWN, reply_markup=markup,
            )
        else:
            await context.bot.send_message(
                q.message.chat_id, text, parse_mode=ParseMode.MARKDOWN, reply_markup=markup,
            )
    except TelegramError as e:
        await q.message.reply_text(f"⚠️ Помилка прев'ю: {e}")
    await q.message.reply_text(
        "Готово до відправки?",
        reply_markup=bcast_options_kb(),
    )


async def on_send(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    text = context.user_data.get("bcast_text")
    topic = context.user_data.get("bcast_topic")
    if not text or not topic:
        await q.answer("Заповніть всі поля")
        return
    targets = _build_target_list(topic)
    await q.answer()
    if not targets:
        await q.edit_message_text(
            f"⚠️ Немає юзерів у цьому топіку. Розсилку не виконано.",
            reply_markup=admin_menu_kb(),
        )
        return
    await q.edit_message_text(
        f"📋 *Підтвердіть розсилку*\n\n"
        f"Топік: *{topic}*\n"
        f"Юзерів: *{len(targets)}*\n"
        f"Текст: {text[:200]}{'…' if len(text)>200 else ''}\n",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=bcast_confirm_kb(len(targets)),
    )


async def on_confirm_send(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    text = context.user_data.get("bcast_text")
    topic = context.user_data.get("bcast_topic")
    photo = context.user_data.get("bcast_photo_file_id")
    btn_text = context.user_data.get("bcast_button_text")
    btn_url = context.user_data.get("bcast_button_url")
    if not text or not topic:
        await q.answer()
        return
    targets = _build_target_list(topic)
    bid = db.create_broadcast(
        topic=topic, text=text, button_text=btn_text, button_url=btn_url,
        photo_file_id=photo, target_count=len(targets), created_by_tg_id=user.id,
    )
    await q.answer("Стартую…")
    progress_msg = await q.edit_message_text(
        f"📢 Надсилаю розсилку #{bid} (0/{len(targets)})…"
    )

    markup = _make_button_markup(btn_text, btn_url)
    sent = 0
    failed = 0
    rate = max(0.5, config.BROADCAST_RATE_PER_SEC)
    delay = 1.0 / rate
    last_progress_update = 0

    for tg_id in targets:
        try:
            if photo:
                await context.bot.send_photo(
                    tg_id, photo=photo, caption=text[:1024],
                    parse_mode=ParseMode.MARKDOWN, reply_markup=markup,
                )
            else:
                await context.bot.send_message(
                    tg_id, text, parse_mode=ParseMode.MARKDOWN, reply_markup=markup,
                    disable_web_page_preview=False,
                )
            sent += 1
        except RetryAfter as e:
            log.warning("RetryAfter: sleeping %ss", e.retry_after)
            await asyncio.sleep(float(e.retry_after) + 1)
            try:
                if photo:
                    await context.bot.send_photo(tg_id, photo=photo, caption=text[:1024], parse_mode=ParseMode.MARKDOWN, reply_markup=markup)
                else:
                    await context.bot.send_message(tg_id, text, parse_mode=ParseMode.MARKDOWN, reply_markup=markup)
                sent += 1
            except TelegramError:
                failed += 1
        except Forbidden:
            # User blocked the bot — mark as banned
            failed += 1
            try:
                db.ban_user(tg_id, reason="bot_blocked")
            except Exception:
                pass
        except (BadRequest, TelegramError) as e:
            failed += 1
            log.info("send to %s failed: %s", tg_id, e)
        # Progress update every 25 messages
        if (sent + failed) - last_progress_update >= 25:
            last_progress_update = sent + failed
            try:
                await progress_msg.edit_text(
                    f"📢 Розсилка #{bid}: ✅ {sent} · ❌ {failed} / {len(targets)}"
                )
                db.update_broadcast_progress(bid, sent, failed, finished=False)
            except TelegramError:
                pass
        await asyncio.sleep(delay)

    db.update_broadcast_progress(bid, sent, failed, finished=True)
    for k in ("bcast_state", "bcast_topic", "bcast_text", "bcast_button_text",
              "bcast_button_url", "bcast_photo_file_id"):
        context.user_data.pop(k, None)
    try:
        await progress_msg.edit_text(
            t("broadcast_done", sent=sent, failed=failed, total=len(targets)),
            reply_markup=admin_menu_kb(),
        )
    except TelegramError:
        await q.message.reply_text(
            t("broadcast_done", sent=sent, failed=failed, total=len(targets)),
            reply_markup=admin_menu_kb(),
        )
