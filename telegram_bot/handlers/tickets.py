"""Support ticket flow.

User side: create / append / view / close / rate.
Admin side: list, view, reply, note, close, etc. — see admin.py for menu wiring.

Conversation state lives in `context.user_data`:
- `ticket_state`: one of None | 'choose_priority' | 'await_first_msg' | 'append'
- `ticket_category`: chosen category slug
- `ticket_priority`: chosen priority slug

Admin reply state in `context.user_data`:
- `admin_reply_for`: ticket_id we're replying to (next admin message → user)
- `admin_note_for`: ticket_id we're writing internal note for
"""
from __future__ import annotations

import logging
from typing import Optional

from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.error import TelegramError
from telegram.ext import ContextTypes

from .. import config, db
from ..i18n import t
from ..keyboards import (
    admin_canned_kb,
    admin_ticket_kb,
    admin_tickets_list_kb,
    my_tickets_kb,
    support_intro_kb,
    ticket_categories_kb,
    ticket_csat_kb,
    ticket_priority_kb,
    ticket_user_actions_kb,
)

log = logging.getLogger("picksy_bot.tickets")


# ─── Helpers ───

def _category_label(slug: str) -> str:
    return dict(config.TICKET_CATEGORIES).get(slug, slug)


def _priority_label(slug: str) -> str:
    return dict(config.TICKET_PRIORITIES).get(slug, slug)


def _admin_dm_targets() -> list[int]:
    """All admin tg_ids that should receive a DM copy of ticket events.
    Combines bootstrap env-IDs + bot_admins table. Excludes the configured
    ADMIN_CHAT_ID (to avoid double-send when it's already an admin's DM)."""
    ids: set[int] = set(config.BOOTSTRAP_ADMIN_IDS or [])
    try:
        for row in db.list_admins():
            tg = row.get("tg_id")
            if tg:
                ids.add(int(tg))
    except Exception as e:
        log.warning("could not load bot_admins: %s", e)
    # Don't double-send if ADMIN_CHAT_ID is itself an admin's personal DM
    if config.ADMIN_CHAT_ID and config.ADMIN_CHAT_ID > 0:
        ids.discard(int(config.ADMIN_CHAT_ID))
    return sorted(ids)


async def _send_ticket_card(
    context: ContextTypes.DEFAULT_TYPE,
    chat_id: int,
    ticket: dict,
    full_text: str,
    file_id: Optional[str],
    file_kind: Optional[str],
):
    """Send the ticket card to a single chat (group or DM). Returns the sent
    Message that should be used as the reply-anchor (or None on failure)."""
    kb = admin_ticket_kb(ticket["id"], ticket.get("status", "open"))
    if file_id and file_kind == "photo":
        return await context.bot.send_photo(chat_id, photo=file_id, caption=full_text[:1024], reply_markup=kb)
    if file_id and file_kind == "voice":
        sent = await context.bot.send_message(chat_id, full_text, reply_markup=kb)
        await context.bot.send_voice(chat_id, voice=file_id)
        return sent
    if file_id and file_kind == "document":
        sent = await context.bot.send_message(chat_id, full_text, reply_markup=kb)
        await context.bot.send_document(chat_id, document=file_id)
        return sent
    return await context.bot.send_message(chat_id, full_text, reply_markup=kb)


async def _notify_admin_chat(context: ContextTypes.DEFAULT_TYPE, ticket: dict, message_text: str = "", file_id: Optional[str] = None, file_kind: Optional[str] = None) -> None:
    """Forward a new ticket message to the admin chat (= group) AND to every
    admin's DM. The reply-anchor `admin_chat_msg_id` is taken from the group
    send (so reply-detection in the group keeps working)."""
    cat = _category_label(ticket.get("category", "other"))
    prio = _priority_label(ticket.get("priority", "normal"))
    username = ticket.get("tg_username") or "(no_username)"
    header = (
        f"🎫 Тікет #{ticket['id']}  ·  {cat}  ·  {prio}\n"
        f"👤 @{username} (id: {ticket['tg_id']})\n"
        f"📅 {ticket.get('created_at')}\n"
    )
    body = message_text or "(порожнє повідомлення)"
    full_text = header + "\n" + body[:3500]

    # 1) Send to the configured admin chat (group / channel). This is the
    #    primary destination — its message_id becomes the reply-anchor.
    if config.ADMIN_CHAT_ID:
        log.info("forwarding ticket #%s to admin chat %s", ticket["id"], config.ADMIN_CHAT_ID)
        try:
            sent = await _send_ticket_card(
                context, config.ADMIN_CHAT_ID, ticket, full_text, file_id, file_kind
            )
            if sent and not ticket.get("admin_chat_msg_id"):
                db.update_ticket(ticket["id"], admin_chat_msg_id=sent.message_id)
            log.info("forwarded ticket #%s to admin chat OK", ticket["id"])
        except TelegramError as e:
            log.error(
                "notify_admin_chat FAILED for ticket #%s → %s: %s. "
                "Causes: bot not in chat / wrong chat_id (supergroup needs -100) "
                "/ blocked. Use /chatid in your group to verify.",
                ticket["id"], config.ADMIN_CHAT_ID, e,
            )
    else:
        log.warning("ADMIN_CHAT_ID not set; ticket #%s not forwarded to group", ticket["id"])

    # 2) Also DM each admin individually.
    for admin_tg in _admin_dm_targets():
        try:
            await _send_ticket_card(context, admin_tg, ticket, full_text, file_id, file_kind)
            log.info("forwarded ticket #%s DM → admin %s OK", ticket["id"], admin_tg)
        except TelegramError as e:
            # Most common: admin never typed /start to the bot → "chat not found"
            # or "Forbidden: bot can't initiate conversation with a user".
            log.warning(
                "DM ticket #%s → admin %s failed: %s (admin must /start the bot first)",
                ticket["id"], admin_tg, e,
            )


async def _notify_admin_user_event(
    context: ContextTypes.DEFAULT_TYPE,
    ticket: dict,
    event: str,
    extra: str = "",
) -> None:
    """Notify admin chat about user-initiated actions on the ticket
    (close, reopen, CSAT, etc.). Lightweight text-only message that links
    back to the original ticket card via Telegram-reply when possible.
    Also DMs every admin individually.
    """
    username = ticket.get("tg_username") or "(no_username)"
    # Plain text — usernames may contain underscores which break Markdown V1.
    text = (
        f"📌 Тікет #{ticket['id']} — {event}\n"
        f"👤 @{username} (id: {ticket['tg_id']})"
    )
    if extra:
        text += f"\n\n{extra}"
    reply_to = ticket.get("admin_chat_msg_id")
    kb = admin_ticket_kb(ticket["id"], ticket.get("status", "open"))

    # 1) Group / channel
    if config.ADMIN_CHAT_ID:
        try:
            await context.bot.send_message(
                config.ADMIN_CHAT_ID,
                text,
                reply_to_message_id=reply_to if reply_to else None,
                allow_sending_without_reply=True,
                reply_markup=kb,
            )
        except TelegramError as e:
            log.error(
                "notify_admin_user_event FAILED ticket #%s → admin chat %s: %s",
                ticket.get("id"), config.ADMIN_CHAT_ID, e,
            )

    # 2) DM each admin
    for admin_tg in _admin_dm_targets():
        try:
            await context.bot.send_message(admin_tg, text, reply_markup=kb)
        except TelegramError as e:
            log.warning(
                "DM event ticket #%s → admin %s failed: %s",
                ticket.get("id"), admin_tg, e,
            )


# ─── User: new ticket flow ───

async def on_ticket_new_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    await q.answer()

    # Anti-spam check
    recent = db.count_recent_tickets(user.id, hours=1)
    if recent >= config.TICKET_RATE_LIMIT_PER_HOUR:
        await q.edit_message_text(
            t("ticket_rate_limit", limit=config.TICKET_RATE_LIMIT_PER_HOUR),
            reply_markup=support_intro_kb(),
        )
        return

    context.user_data["ticket_state"] = "choose_category"
    context.user_data.pop("ticket_category", None)
    context.user_data.pop("ticket_priority", None)
    await q.edit_message_text(
        t("ticket_choose_category"),
        reply_markup=ticket_categories_kb(),
    )


async def on_ticket_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    slug = parts[2]
    context.user_data["ticket_category"] = slug
    context.user_data["ticket_state"] = "choose_priority"
    await q.answer()
    await q.edit_message_text(
        t("ticket_choose_priority") + f"\n\nКатегорія: *{_category_label(slug)}*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ticket_priority_kb(),
    )


async def on_ticket_priority(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    slug = parts[2]
    context.user_data["ticket_priority"] = slug
    context.user_data["ticket_state"] = "await_first_msg"
    await q.answer()
    cat = _category_label(context.user_data.get("ticket_category", "other"))
    prio = _priority_label(slug)
    await q.edit_message_text(
        f"Категорія: *{cat}*\nПріоритет: *{prio}*\n\n" + t("ticket_describe"),
        parse_mode=ParseMode.MARKDOWN,
    )


async def on_ticket_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    context.user_data.pop("ticket_state", None)
    context.user_data.pop("ticket_category", None)
    context.user_data.pop("ticket_priority", None)
    await q.answer("Скасовано")
    await q.edit_message_text(
        t("support_intro"),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=support_intro_kb(),
    )


async def handle_user_ticket_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """If user is mid-ticket flow OR has open ticket, treat their message as ticket content.

    Returns True if message was consumed.
    """
    user = update.effective_user
    msg = update.message
    if not user or not msg:
        return False

    state = context.user_data.get("ticket_state")
    text = (msg.text or msg.caption or "").strip()
    file_id, file_kind = None, None
    if msg.photo:
        file_id = msg.photo[-1].file_id
        file_kind = "photo"
    elif msg.voice:
        file_id = msg.voice.file_id
        file_kind = "voice"
    elif msg.document:
        file_id = msg.document.file_id
        file_kind = "document"
    elif msg.video:
        file_id = msg.video.file_id
        file_kind = "video"
    elif msg.audio:
        file_id = msg.audio.file_id
        file_kind = "audio"

    # Case 1: user is in "first message" state -> create ticket
    if state == "await_first_msg":
        cat = context.user_data.get("ticket_category", "other")
        prio = context.user_data.get("ticket_priority", "normal")

        recent = db.count_recent_tickets(user.id, hours=1)
        if recent >= config.TICKET_RATE_LIMIT_PER_HOUR:
            await msg.reply_text(t("ticket_rate_limit", limit=config.TICKET_RATE_LIMIT_PER_HOUR))
            context.user_data.pop("ticket_state", None)
            return True

        subject = (text or f"[{file_kind}]")[:120]
        ticket_id = db.create_ticket(
            tg_id=user.id, tg_username=user.username, category=cat,
            priority=prio, subject=subject,
        )
        db.add_ticket_message(
            ticket_id=ticket_id, author="user", tg_id=user.id,
            text=text or None, file_id=file_id, file_kind=file_kind,
        )

        ticket = db.get_ticket(ticket_id)
        await msg.reply_text(
            t("ticket_created", id=ticket_id, cat=_category_label(cat), prio=_priority_label(prio)),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=ticket_user_actions_kb(ticket_id, "open"),
        )
        await _notify_admin_chat(context, ticket, message_text=text, file_id=file_id, file_kind=file_kind)
        context.user_data.pop("ticket_state", None)
        context.user_data.pop("ticket_category", None)
        context.user_data.pop("ticket_priority", None)
        return True

    # Case 2: user has an open ticket -> append to it (unless user is replying to bot menu)
    open_t = db.get_open_ticket_for_user(user.id)
    if state == "append" or (open_t and not state):
        if not open_t:
            return False
        msgs = db.count_ticket_messages(open_t["id"])
        if msgs >= config.TICKET_MAX_MESSAGES:
            await msg.reply_text(t("ticket_too_many_msgs", limit=config.TICKET_MAX_MESSAGES))
            return True
        db.add_ticket_message(
            ticket_id=open_t["id"], author="user", tg_id=user.id,
            text=text or None, file_id=file_id, file_kind=file_kind,
        )
        # Status flow: if it was answered/awaiting_user, set back to open (admin needs to answer)
        if open_t.get("status") in ("answered", "awaiting_user"):
            db.update_ticket(open_t["id"], status="open")
            open_t["status"] = "open"
        await msg.reply_text(t("ticket_appended", id=open_t["id"]))
        await _notify_admin_chat(context, open_t, message_text=text, file_id=file_id, file_kind=file_kind)
        return True

    return False


# ─── User: my tickets ───

async def on_my_tickets(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    tickets = db.list_tickets_for_user(user.id, 10)
    await q.answer()
    if not tickets:
        await q.edit_message_text(t("ticket_no_open"), reply_markup=support_intro_kb())
        return
    parts = ["📋 *Мої тікети:*\n"]
    for tk in tickets:
        cat = _category_label(tk.get("category", "other"))
        status = tk.get("status")
        sub = (tk.get("subject") or "")[:60]
        parts.append(f"• #{tk['id']} {cat} — {_status_label(status)} — {sub}")
    await q.edit_message_text(
        "\n".join(parts),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=my_tickets_kb(tickets),
    )


async def on_ticket_view(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    ticket = db.get_ticket(tid)
    if not ticket or ticket.get("tg_id") != user.id:
        await q.answer("Не знайдено")
        return
    msgs = db.list_ticket_messages(tid, include_internal=False)
    body = []
    cat = _category_label(ticket.get("category", "other"))
    body.append(f"🎫 *Тікет #{tid}* — {_status_label(ticket.get('status',''))}")
    body.append(f"Категорія: {cat}")
    body.append("")
    for m in msgs[-20:]:
        who = "👤 Ви" if m["author"] == "user" else "🛎 Підтримка"
        text = (m.get("text") or "")[:300]
        if m.get("file_kind") and not text:
            text = f"[{m['file_kind']}]"
        body.append(f"{who}: {text}")
    await q.answer()
    await q.edit_message_text(
        "\n".join(body),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ticket_user_actions_kb(tid, ticket.get("status", "open")),
    )


async def on_user_close(update: Update, context: ContextTypes.DEFAULT_TYPE):
    import datetime as _dt
    q = update.callback_query
    user = update.effective_user
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    ticket = db.get_ticket(tid)
    if not ticket or ticket.get("tg_id") != user.id:
        await q.answer("Не знайдено")
        return
    db.update_ticket(tid, status="closed", closed_at=_dt.datetime.utcnow(), close_reason="closed_by_user")
    await q.answer()
    await q.edit_message_text(
        t("ticket_user_closed", id=tid),
        reply_markup=ticket_csat_kb(tid),
    )
    # Notify admin chat about user-initiated close
    fresh = db.get_ticket(tid) or ticket
    await _notify_admin_user_event(
        context, fresh,
        event="✅ Юзер закрив тікет самостійно",
    )


async def on_user_reopen(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    ticket = db.get_ticket(tid)
    if not ticket or ticket.get("tg_id") != user.id:
        await q.answer("Не знайдено")
        return
    db.update_ticket(tid, status="open", closed_at=None, close_reason=None)
    await q.answer()
    await q.edit_message_text(
        t("ticket_user_reopened", id=tid),
        reply_markup=ticket_user_actions_kb(tid, "open"),
    )
    fresh = db.get_ticket(tid) or ticket
    await _notify_admin_user_event(
        context, fresh,
        event="🔄 Юзер відкрив тікет знову",
    )


async def on_user_csat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    await q.answer()
    await q.edit_message_text(
        f"Як оціните підтримку у тікеті #{tid}?",
        reply_markup=ticket_csat_kb(tid),
    )


async def on_user_csat_set(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    parts = (q.data or "").split(":")
    if len(parts) < 4:
        await q.answer()
        return
    tid = int(parts[2])
    rating = int(parts[3])
    ticket = db.get_ticket(tid)
    if not ticket or ticket.get("tg_id") != user.id:
        await q.answer("Не знайдено")
        return
    db.update_ticket(tid, csat_rating=rating)
    await q.answer(t("ticket_csat_thanks"))
    await q.edit_message_text(t("ticket_csat_thanks"))
    fresh = db.get_ticket(tid) or ticket
    stars = "⭐" * rating + "☆" * (5 - rating)
    await _notify_admin_user_event(
        context, fresh,
        event=f"⭐ Юзер оцінив підтримку: {rating}/5",
        extra=stars,
    )


async def on_ticket_rules(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    await q.edit_message_text(
        t("rules", days=config.TICKET_AUTO_CLOSE_DAYS),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=support_intro_kb(),
    )


# ─── Admin: ticket actions ───

def _status_label(status: str) -> str:
    return {"open": "🟢 Open", "answered": "💬 Answered",
            "awaiting_user": "⏳ Awaiting", "closed": "✅ Closed",
            "spam": "🚫 Spam"}.get(status, status)


async def admin_open_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    status = parts[2] if len(parts) > 2 else "open"
    page = int(parts[3]) if len(parts) > 3 else 0
    limit = 10
    try:
        tickets = db.list_tickets_by_status(status, limit=limit, offset=page * limit)
    except Exception as e:
        log.error("admin_open_list DB error: %s", e)
        await q.answer()
        await q.edit_message_text(
            f"⚠️ Помилка БД при завантаженні тікетів: {e}",
            reply_markup=admin_tickets_list_kb([], status, page),
        )
        return
    await q.answer()
    label = _status_label(status)
    if not tickets:
        await q.edit_message_text(
            f"Немає тікетів у статусі {label}.",
            reply_markup=admin_tickets_list_kb([], status, page),
        )
        return
    counts_open = db.count_tickets_by_status("open")
    counts_wait = db.count_tickets_by_status("awaiting_user")
    header = (
        f"🎫 Тікети — {label}  (стор. {page+1})\n"
        f"Open: {counts_open} · Awaiting: {counts_wait}"
    )
    await q.edit_message_text(
        header,
        reply_markup=admin_tickets_list_kb(tickets, status, page),
    )


async def admin_view_ticket(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    ticket = db.get_ticket(tid)
    if not ticket:
        await q.answer("Не знайдено")
        return
    msgs = db.list_ticket_messages(tid, include_internal=True)
    cat = _category_label(ticket.get("category", "other"))
    prio = _priority_label(ticket.get("priority", "normal"))
    # Plain text — usernames / message bodies often contain markdown specials.
    body = [
        f"🎫 Тікет #{tid} — {ticket.get('status')}",
        f"👤 @{ticket.get('tg_username') or '(no_username)'} (id: {ticket.get('tg_id')})",
        f"{cat} · {prio}",
        f"Створено: {ticket.get('created_at')}",
        "",
    ]
    for m in msgs[-20:]:
        who = {"user": "👤", "admin": "🛎", "system": "⚙️"}.get(m["author"], "•")
        if m.get("is_internal_note"):
            who = "📝"
        text = (m.get("text") or "")[:300]
        if m.get("file_kind") and not text:
            text = f"[{m['file_kind']}]"
        body.append(f"{who} {text}")
    await q.answer()
    try:
        await q.edit_message_text(
            "\n".join(body)[:4000],
            reply_markup=admin_ticket_kb(tid, ticket.get("status", "open")),
        )
    except TelegramError:
        # If message had a photo, edit_message_text fails — send new message
        await context.bot.send_message(
            q.message.chat_id,
            "\n".join(body)[:4000],
            reply_markup=admin_ticket_kb(tid, ticket.get("status", "open")),
        )


async def admin_reply_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    context.user_data["admin_reply_for"] = tid
    context.user_data.pop("admin_note_for", None)
    await q.answer()
    await q.message.reply_text(
        f"💬 Наступне ваше повідомлення піде юзеру в тікет #{tid}.\n"
        "Можна текст / фото / документ / голосове.\n\n"
        "Скасувати: /cancel"
    )


async def admin_note_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    context.user_data["admin_note_for"] = tid
    context.user_data.pop("admin_reply_for", None)
    await q.answer()
    await q.message.reply_text(
        f"📝 Наступне повідомлення збережеться як внутрішня нотатка до тікета #{tid}.\n"
        "Юзер її НЕ побачить.\n\n"
        "Скасувати: /cancel"
    )


async def handle_admin_reply_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """If admin is in reply-mode or note-mode, consume the next message accordingly."""
    user = update.effective_user
    msg = update.message
    if not user or not msg:
        return False
    if not db.is_admin(user.id):
        log.debug("handle_admin_reply: user %s is not admin, skip", user.id)
        return False
    log.info(
        "handle_admin_reply: admin=%s, chat=%s, has_reply_to=%s, "
        "user_data.admin_reply_for=%s, user_data.admin_note_for=%s",
        user.id,
        update.effective_chat.id if update.effective_chat else None,
        bool(msg.reply_to_message),
        context.user_data.get("admin_reply_for"),
        context.user_data.get("admin_note_for"),
    )

    reply_tid = context.user_data.get("admin_reply_for")
    note_tid = context.user_data.get("admin_note_for")
    if not reply_tid and not note_tid:
        # Try to detect Telegram-reply to a forwarded ticket card
        if msg.reply_to_message and msg.reply_to_message.message_id:
            replied_msg_id = msg.reply_to_message.message_id
            ticket = db.fetch_one(
                "SELECT * FROM support_tickets WHERE admin_chat_msg_id=%s",
                (replied_msg_id,),
            )
            log.info(
                "admin reply detect: replied_to msg_id=%s, ticket=%s, status=%s",
                replied_msg_id,
                ticket.get("id") if ticket else None,
                ticket.get("status") if ticket else None,
            )
            if ticket and ticket.get("status") in ("open", "answered", "awaiting_user"):
                reply_tid = ticket["id"]
            elif ticket:
                # Closed ticket — let admin reply anyway by reopening it
                log.info("ticket #%s is %s, reopening for admin reply",
                         ticket.get("id"), ticket.get("status"))
                db.update_ticket(ticket["id"], status="open", closed_at=None)
                reply_tid = ticket["id"]
        if not reply_tid:
            return False

    text = (msg.text or msg.caption or "").strip()
    file_id, file_kind = None, None
    if msg.photo:
        file_id, file_kind = msg.photo[-1].file_id, "photo"
    elif msg.voice:
        file_id, file_kind = msg.voice.file_id, "voice"
    elif msg.document:
        file_id, file_kind = msg.document.file_id, "document"
    elif msg.video:
        file_id, file_kind = msg.video.file_id, "video"

    if note_tid:
        db.add_ticket_message(
            ticket_id=note_tid, author="admin", tg_id=user.id,
            text=text or None, file_id=file_id, file_kind=file_kind,
            is_internal=True,
        )
        await msg.reply_text(f"📝 Нотатку додано до тікета #{note_tid}.")
        context.user_data.pop("admin_note_for", None)
        return True

    if reply_tid:
        ticket = db.get_ticket(reply_tid)
        if not ticket:
            await msg.reply_text("Тікет не знайдено.")
            context.user_data.pop("admin_reply_for", None)
            return True
        # Save admin message
        db.add_ticket_message(
            ticket_id=reply_tid, author="admin", tg_id=user.id,
            text=text or None, file_id=file_id, file_kind=file_kind,
        )
        # Mark first_reply_at
        if not ticket.get("first_reply_at"):
            db.update_ticket(reply_tid, first_reply_at=__import__("datetime").datetime.utcnow())
        # Update status to 'answered' / 'awaiting_user'
        if ticket.get("status") == "open":
            db.update_ticket(reply_tid, status="answered", assigned_admin_tg_id=user.id)
        # Forward to user
        try:
            await context.bot.send_chat_action(ticket["tg_id"], ChatAction.TYPING)
        except TelegramError:
            pass
        # Plain text — admin's reply may contain markdown specials.
        prefix = f"🛎 Підтримка по тікету #{reply_tid}:\n\n"
        log.info(
            "admin %s replying to ticket #%s → user tg_id=%s (chars=%d, file=%s)",
            user.id, reply_tid, ticket["tg_id"], len(text or ""), file_kind,
        )
        try:
            if file_id and file_kind == "photo":
                await context.bot.send_photo(ticket["tg_id"], photo=file_id, caption=(prefix + (text or ""))[:1024])
            elif file_id and file_kind == "voice":
                if text:
                    await context.bot.send_message(ticket["tg_id"], prefix + text)
                await context.bot.send_voice(ticket["tg_id"], voice=file_id)
            elif file_id and file_kind == "document":
                if text:
                    await context.bot.send_message(ticket["tg_id"], prefix + text)
                await context.bot.send_document(ticket["tg_id"], document=file_id)
            elif file_id and file_kind == "video":
                if text:
                    await context.bot.send_message(ticket["tg_id"], prefix + text)
                await context.bot.send_video(ticket["tg_id"], video=file_id)
            else:
                await context.bot.send_message(
                    ticket["tg_id"],
                    prefix + (text or ""),
                    reply_markup=ticket_user_actions_kb(reply_tid, "answered"),
                )
            log.info("admin reply to ticket #%s → user OK", reply_tid)
            await msg.reply_text(f"✅ Відповідь надіслано юзеру (тікет #{reply_tid}).")
        except TelegramError as e:
            log.error(
                "admin reply to ticket #%s FAILED → user tg_id=%s: %s",
                reply_tid, ticket["tg_id"], e,
            )
            await msg.reply_text(
                f"❌ Не вдалося надіслати юзеру (#{reply_tid}): {e}\n\n"
                "Можливі причини: юзер заблокував бота / видалив акаунт / "
                "ніколи не писав боту /start."
            )
        context.user_data.pop("admin_reply_for", None)
        return True

    return False


async def admin_close_ticket(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    ticket = db.get_ticket(tid)
    if not ticket:
        await q.answer("Не знайдено")
        return
    db.update_ticket(
        tid, status="closed",
        closed_at=__import__("datetime").datetime.utcnow(),
        close_reason="closed_by_admin", assigned_admin_tg_id=user.id,
    )
    await q.answer("Закрито")
    # Notify user
    try:
        await context.bot.send_message(
            ticket["tg_id"],
            f"✅ Тікет #{tid} закрито підтримкою. Якщо проблема повернеться — надішліть нове повідомлення або «🔄 Знову відкрити».\n\n"
            f"🌐 {config.SITE_URL}  ·  📣 {config.TG_CHANNEL_USERNAME} ({config.TG_CHANNEL_URL})\n"
            f"Підписуйся на {config.TG_CHANNEL_USERNAME}, щоб першим бачити новини, підбірки та анонси 💛",
            reply_markup=ticket_csat_kb(tid),
            disable_web_page_preview=True,
        )
    except TelegramError:
        pass
    try:
        await q.edit_message_reply_markup(reply_markup=admin_ticket_kb(tid, "closed"))
    except TelegramError:
        pass


async def admin_set_wait(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    db.update_ticket(tid, status="awaiting_user")
    await q.answer("Очікую юзера")


async def admin_set_priority(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 4:
        await q.answer()
        return
    tid = int(parts[2])
    prio = parts[3]
    if prio not in ("normal", "urgent"):
        await q.answer()
        return
    db.update_ticket(tid, priority=prio)
    await q.answer(f"Пріоритет: {prio}")


async def admin_assign_self(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    db.update_ticket(tid, assigned_admin_tg_id=user.id)
    await q.answer("✅ Призначено вам")


async def admin_canned_show(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    items = db.list_canned()
    await q.answer()
    if not items:
        await q.edit_message_text("Немає швидких відповідей. /canned_add для створення.")
        return
    await q.edit_message_text(
        f"📞 Швидкі відповіді для тікета #{tid}:",
        reply_markup=admin_canned_kb(tid, items),
    )


async def admin_canned_send(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 4:
        await q.answer()
        return
    tid = int(parts[2])
    slug = parts[3]
    canned = db.get_canned(slug)
    ticket = db.get_ticket(tid)
    if not canned or not ticket:
        await q.answer("Не знайдено")
        return
    text = canned["text"]
    db.add_ticket_message(ticket_id=tid, author="admin", tg_id=user.id, text=text)
    if not ticket.get("first_reply_at"):
        db.update_ticket(tid, first_reply_at=__import__("datetime").datetime.utcnow())
    if ticket.get("status") == "open":
        db.update_ticket(tid, status="answered", assigned_admin_tg_id=user.id)
    try:
        await context.bot.send_message(
            ticket["tg_id"],
            f"🛎 *Підтримка по тікету #{tid}:*\n\n{text}",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=ticket_user_actions_kb(tid, "answered"),
        )
    except TelegramError as e:
        log.warning("canned send: %s", e)
    await q.answer("Надіслано")
    await q.edit_message_text(f"✅ Швидку відповідь '{canned['label']}' надіслано юзеру.")


async def admin_spam(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    db.update_ticket(tid, status="spam", closed_at=__import__("datetime").datetime.utcnow())
    await q.answer("🚫 Помічено як спам")
    try:
        await q.edit_message_reply_markup(reply_markup=admin_ticket_kb(tid, "spam"))
    except TelegramError:
        pass


async def admin_ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    ticket = db.get_ticket(tid)
    if not ticket:
        await q.answer("Не знайдено")
        return
    db.ban_user(ticket["tg_id"], reason=f"banned_via_ticket_{tid}")
    db.update_ticket(tid, status="spam", closed_at=__import__("datetime").datetime.utcnow())
    await q.answer("⛔ Юзера забанено")


async def admin_reopen(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    db.update_ticket(tid, status="open", closed_at=None, close_reason=None)
    await q.answer("🔄 Reopened")


async def admin_user_history(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    user = update.effective_user
    if not db.is_admin(user.id):
        await q.answer(t("admin_only"))
        return
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    tid = int(parts[2])
    ticket = db.get_ticket(tid)
    if not ticket:
        await q.answer("Не знайдено")
        return
    history = db.list_tickets_for_user(ticket["tg_id"], 20)
    parts_out = [f"📜 *Історія тікетів @{ticket.get('tg_username') or ticket['tg_id']}:*"]
    for h in history:
        parts_out.append(f"#{h['id']} ({_status_label(h.get('status',''))}) {(h.get('subject') or '')[:50]}")
    await q.answer()
    await q.message.reply_text("\n".join(parts_out)[:4000], parse_mode=ParseMode.MARKDOWN)


async def cmd_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User /cancel — clears any in-flight ticket / admin reply state."""
    cleared = []
    for k in ("ticket_state", "ticket_category", "ticket_priority",
              "admin_reply_for", "admin_note_for", "news_del_state",
              "bcast_state", "bcast_topic", "bcast_text", "bcast_button_text",
              "bcast_button_url", "bcast_photo_file_id"):
        if k in context.user_data:
            cleared.append(k)
            context.user_data.pop(k, None)
    if cleared:
        await update.message.reply_text("❌ Скасовано.")
    else:
        await update.message.reply_text("Нема активних дій для скасування.")
