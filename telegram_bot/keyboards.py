"""All inline + reply keyboards used by the bot.

Callback data is namespaced as `<area>:<action>:<args>` to avoid collisions.
Areas: u (user), t (ticket), a (admin), b (broadcast), s (subscriptions),
       l (lang).
"""
from __future__ import annotations

from typing import Iterable, List, Optional, Tuple

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove

from . import config


# ─── Reply keyboards ───

def main_reply_kb(is_admin: bool = False) -> ReplyKeyboardMarkup:
    rows: List[List[KeyboardButton]] = [
        [KeyboardButton("🤖 Picksy AI"), KeyboardButton("🎯 Daily Pick")],
        [KeyboardButton("🎫 Підтримка"), KeyboardButton("📰 Новини")],
        [KeyboardButton("🔔 Підписки"), KeyboardButton("⚙️ Налаштування")],
        [KeyboardButton("ℹ️ Про Picksy")],
    ]
    if is_admin:
        rows.append([KeyboardButton("🛠 Адмін-меню")])
    return ReplyKeyboardMarkup(rows, resize_keyboard=True)


def remove_kb() -> ReplyKeyboardRemove:
    return ReplyKeyboardRemove()


# ─── Helpers ───

def _channel_button(label: Optional[str] = None) -> InlineKeyboardButton:
    """Inline button that opens the public Telegram channel."""
    text = label or f"📣 Канал {config.TG_CHANNEL_USERNAME}"
    return InlineKeyboardButton(text, url=config.TG_CHANNEL_URL)


def _site_button(label: str = "🌐 Відкрити Picksy") -> InlineKeyboardButton:
    return InlineKeyboardButton(label, url=config.SITE_URL)


# ─── User: settings / subscriptions ───

def settings_inline_kb() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton("🔔 Підписки", callback_data="s:open")],
        [InlineKeyboardButton("🌐 Мова", callback_data="l:open")],
        [_site_button("🌐 Відкрити сайт picksy.my")],
        [_channel_button()],
        [InlineKeyboardButton("📋 Правила", callback_data="u:rules"),
         InlineKeyboardButton("🛡 Приватність", callback_data="u:privacy")],
        [InlineKeyboardButton("❌ Видалити мої дані", callback_data="u:delete")],
    ]
    return InlineKeyboardMarkup(rows)


def subs_inline_kb(state: dict) -> InlineKeyboardMarkup:
    rows = []
    for slug, label, _default in config.TOPICS:
        on = state.get(slug, False)
        prefix = "✅" if on else "⬜"
        rows.append([InlineKeyboardButton(f"{prefix} {label}", callback_data=f"s:toggle:{slug}")])
    rows.append([InlineKeyboardButton("⛔ Вимкнути всі", callback_data="s:disable_all")])
    rows.append([InlineKeyboardButton("« Назад", callback_data="u:settings")])
    return InlineKeyboardMarkup(rows)


def lang_inline_kb(current: str = "uk") -> InlineKeyboardMarkup:
    def _btn(code: str, label: str):
        prefix = "✅ " if code == current else ""
        return InlineKeyboardButton(f"{prefix}{label}", callback_data=f"l:set:{code}")

    rows = [
        [_btn("uk", "🇺🇦 Українська")],
        [_btn("en", "🇬🇧 English")],
        [InlineKeyboardButton("« Назад", callback_data="u:settings")],
    ]
    return InlineKeyboardMarkup(rows)


# ─── Tickets (user) ───

def ticket_categories_kb() -> InlineKeyboardMarkup:
    rows = []
    for slug, label in config.TICKET_CATEGORIES:
        rows.append([InlineKeyboardButton(label, callback_data=f"t:cat:{slug}")])
    rows.append([InlineKeyboardButton("❌ Скасувати", callback_data="t:cancel")])
    return InlineKeyboardMarkup(rows)


def ticket_priority_kb() -> InlineKeyboardMarkup:
    rows = []
    for slug, label in config.TICKET_PRIORITIES:
        rows.append([InlineKeyboardButton(label, callback_data=f"t:prio:{slug}")])
    rows.append([InlineKeyboardButton("❌ Скасувати", callback_data="t:cancel")])
    return InlineKeyboardMarkup(rows)


def ticket_user_actions_kb(ticket_id: int, status: str) -> InlineKeyboardMarkup:
    rows = []
    if status in ("open", "answered", "awaiting_user"):
        rows.append([InlineKeyboardButton("💬 Дописати у тікет", callback_data=f"t:user_reply:{ticket_id}")])
        rows.append([InlineKeyboardButton("✅ Закрити (проблема вирішена)", callback_data=f"t:user_close:{ticket_id}")])
    elif status == "closed":
        rows.append([InlineKeyboardButton("⭐ Оцінити підтримку", callback_data=f"t:csat:{ticket_id}")])
        rows.append([InlineKeyboardButton("🔄 Знову відкрити", callback_data=f"t:user_reopen:{ticket_id}")])
    rows.append([InlineKeyboardButton("📋 Усі мої тікети", callback_data="t:my_list")])
    return InlineKeyboardMarkup(rows)


def ticket_csat_kb(ticket_id: int) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton("⭐", callback_data=f"t:csat_set:{ticket_id}:1"),
            InlineKeyboardButton("⭐⭐", callback_data=f"t:csat_set:{ticket_id}:2"),
            InlineKeyboardButton("⭐⭐⭐", callback_data=f"t:csat_set:{ticket_id}:3"),
        ],
        [
            InlineKeyboardButton("⭐⭐⭐⭐", callback_data=f"t:csat_set:{ticket_id}:4"),
            InlineKeyboardButton("⭐⭐⭐⭐⭐", callback_data=f"t:csat_set:{ticket_id}:5"),
        ],
    ]
    return InlineKeyboardMarkup(rows)


def my_tickets_kb(tickets: List[dict]) -> InlineKeyboardMarkup:
    rows = []
    for t in tickets[:10]:
        status_emoji = {
            "open": "🟢",
            "answered": "💬",
            "awaiting_user": "⏳",
            "closed": "✅",
            "spam": "🚫",
        }.get(t.get("status"), "•")
        cat = dict(config.TICKET_CATEGORIES).get(t.get("category"), "❓")
        label = f"{status_emoji} #{t['id']} {cat[:1]} · {(t.get('subject') or '')[:30]}"
        rows.append([InlineKeyboardButton(label, callback_data=f"t:view:{t['id']}")])
    rows.append([InlineKeyboardButton("📩 Новий тікет", callback_data="t:new")])
    return InlineKeyboardMarkup(rows)


# ─── Tickets (admin) ───

def admin_ticket_kb(ticket_id: int, status: str = "open") -> InlineKeyboardMarkup:
    rows = []
    if status in ("open", "answered", "awaiting_user"):
        rows.append([
            InlineKeyboardButton("💬 Відповісти", callback_data=f"a:t_reply:{ticket_id}"),
            InlineKeyboardButton("📝 Нотатка", callback_data=f"a:t_note:{ticket_id}"),
        ])
        rows.append([
            InlineKeyboardButton("✅ Закрити", callback_data=f"a:t_close:{ticket_id}"),
            InlineKeyboardButton("⏸ Очікую юзера", callback_data=f"a:t_wait:{ticket_id}"),
        ])
        rows.append([
            InlineKeyboardButton("🔥 Терміново", callback_data=f"a:t_prio:{ticket_id}:urgent"),
            InlineKeyboardButton("🟢 Звичайний", callback_data=f"a:t_prio:{ticket_id}:normal"),
        ])
        rows.append([
            InlineKeyboardButton("👤 Призначити мені", callback_data=f"a:t_assign:{ticket_id}"),
            InlineKeyboardButton("📞 Швидка відп.", callback_data=f"a:t_canned:{ticket_id}"),
        ])
        rows.append([
            InlineKeyboardButton("🚫 Спам", callback_data=f"a:t_spam:{ticket_id}"),
            InlineKeyboardButton("⛔ Бан юзера", callback_data=f"a:t_ban:{ticket_id}"),
        ])
        rows.append([InlineKeyboardButton("📜 Історія юзера", callback_data=f"a:t_user_history:{ticket_id}")])
    elif status == "closed":
        rows.append([InlineKeyboardButton("🔄 Reopen", callback_data=f"a:t_reopen:{ticket_id}")])
    elif status == "spam":
        rows.append([InlineKeyboardButton("🔄 Reopen", callback_data=f"a:t_reopen:{ticket_id}")])
    rows.append([InlineKeyboardButton("📋 Список відкритих", callback_data="a:t_list:open")])
    return InlineKeyboardMarkup(rows)


def admin_canned_kb(ticket_id: int, items: List[dict]) -> InlineKeyboardMarkup:
    rows = []
    for c in items:
        rows.append([InlineKeyboardButton(c["label"][:60], callback_data=f"a:t_canned_send:{ticket_id}:{c['slug']}")])
    rows.append([InlineKeyboardButton("« Назад", callback_data=f"a:t_view:{ticket_id}")])
    return InlineKeyboardMarkup(rows)


def admin_tickets_list_kb(tickets: List[dict], status: str, page: int = 0) -> InlineKeyboardMarkup:
    rows = []
    for t in tickets:
        cat = dict(config.TICKET_CATEGORIES).get(t.get("category"), "❓")
        prio = "🔥" if t.get("priority") == "urgent" else "🟢"
        sub = (t.get("subject") or "(no subject)")[:32]
        username = (t.get("tg_username") or "").strip() or str(t.get("tg_id"))
        label = f"{prio} #{t['id']} {cat[:2]} @{username[:14]} · {sub}"
        rows.append([InlineKeyboardButton(label, callback_data=f"a:t_view:{t['id']}")])
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("«", callback_data=f"a:t_list:{status}:{page-1}"))
    nav.append(InlineKeyboardButton("🔄", callback_data=f"a:t_list:{status}:{page}"))
    if len(tickets) >= 10:
        nav.append(InlineKeyboardButton("»", callback_data=f"a:t_list:{status}:{page+1}"))
    rows.append(nav)
    # Status filter
    rows.append([
        InlineKeyboardButton("🟢 Open", callback_data="a:t_list:open:0"),
        InlineKeyboardButton("⏳ Wait", callback_data="a:t_list:awaiting_user:0"),
        InlineKeyboardButton("✅ Closed", callback_data="a:t_list:closed:0"),
        InlineKeyboardButton("🚫 Spam", callback_data="a:t_list:spam:0"),
    ])
    rows.append([InlineKeyboardButton("« Адмін-меню", callback_data="a:menu")])
    return InlineKeyboardMarkup(rows)


# ─── Admin menu ───

def admin_menu_kb() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton("🎫 Тікети", callback_data="a:t_list:open:0"),
         InlineKeyboardButton("📢 Розсилка", callback_data="b:wizard")],
        [InlineKeyboardButton("📊 Статистика", callback_data="a:stats"),
         InlineKeyboardButton("🎯 Daily Pick", callback_data="a:pick_menu")],
        [InlineKeyboardButton("🏆 Топ юзерів", callback_data="a:top_users"),
         InlineKeyboardButton("🩺 Health DB", callback_data="a:health")],
        [InlineKeyboardButton("🌐 Сайт-стата", callback_data="a:site_stats"),
         InlineKeyboardButton("👤 Юзери", callback_data="a:users:0")],
        [InlineKeyboardButton("👥 Адміни", callback_data="a:admins"),
         InlineKeyboardButton("📜 Логи юзерів", callback_data="a:logs")],
        [InlineKeyboardButton("📜 Логи розсилок", callback_data="a:bcasts"),
         InlineKeyboardButton("🗑 Очистити новини", callback_data="a:news_clean")],
        [InlineKeyboardButton("« Закрити", callback_data="a:close")],
    ]
    return InlineKeyboardMarkup(rows)


def admin_pick_menu_kb() -> InlineKeyboardMarkup:
    """Daily Pick is fetched automatically from the website. Admins can only
    preview it and trigger an immediate broadcast for testing."""
    rows = [
        [InlineKeyboardButton("👁 Подивитись поточний", callback_data="a:pick_view")],
        [InlineKeyboardButton("📤 Надіслати зараз усім", callback_data="a:pick_send_now")],
        [InlineKeyboardButton("🌐 Керувати на сайті", url=config.SITE_URL + "/admin.html")],
        [InlineKeyboardButton("« Назад", callback_data="a:menu")],
    ]
    return InlineKeyboardMarkup(rows)


# ─── Broadcast wizard ───

def bcast_topic_kb() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton("📰 Новини (підписники news)", callback_data="b:topic:news")],
        [InlineKeyboardButton("⚠️ Усім (важливо)", callback_data="b:topic:_all")],
        [InlineKeyboardButton("🎉 Свята / події", callback_data="b:topic:events")],
        [InlineKeyboardButton("💡 Підказки (tip)", callback_data="b:topic:tip_of_the_day")],
        [InlineKeyboardButton("❌ Скасувати", callback_data="b:cancel")],
    ]
    return InlineKeyboardMarkup(rows)


def bcast_options_kb() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton("➕ Додати фото", callback_data="b:add_photo"),
         InlineKeyboardButton("➕ Додати кнопку", callback_data="b:add_button")],
        [InlineKeyboardButton("👁 Прев'ю", callback_data="b:preview"),
         InlineKeyboardButton("✅ Надіслати", callback_data="b:send")],
        [InlineKeyboardButton("✏️ Редагувати текст", callback_data="b:edit_text"),
         InlineKeyboardButton("❌ Скасувати", callback_data="b:cancel")],
    ]
    return InlineKeyboardMarkup(rows)


def bcast_confirm_kb(target_count: int) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(f"✅ Надіслати {target_count} юзерам", callback_data="b:confirm_send")],
        [InlineKeyboardButton("« Назад", callback_data="b:back_to_options")],
        [InlineKeyboardButton("❌ Скасувати", callback_data="b:cancel")],
    ]
    return InlineKeyboardMarkup(rows)


# ─── Daily pick CTA (used in 12:00 push) ───

def daily_pick_cta_kb(url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("👀 Відкрити на Picksy", url=url)],
        [_site_button("🌐 picksy.my"), _channel_button()],
    ])


def support_intro_kb() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton("📩 Новий тікет", callback_data="t:new")],
        [InlineKeyboardButton("📋 Мої тікети", callback_data="t:my_list")],
        [InlineKeyboardButton("⚖ Правила підтримки", callback_data="t:rules")],
        [_site_button("🌐 picksy.my"), _channel_button()],
    ]
    return InlineKeyboardMarkup(rows)


# ─── Picksy AI ───

def ai_menu_kb() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton("🔍 Аналіз фільму/серіалу", callback_data="ai:analyze")],
        [InlineKeyboardButton("🎭 Підбір за настроєм", callback_data="ai:mood"),
         InlineKeyboardButton("🔮 Кіно-гороскоп", callback_data="ai:horoscope")],
        [InlineKeyboardButton("💡 Порада від AI", callback_data="ai:tip"),
         InlineKeyboardButton("🏆 Факт дня", callback_data="ai:fact")],
        [InlineKeyboardButton("🎲 Що подивитися?", callback_data="ai:random")],
        [InlineKeyboardButton("🎭 Архетипи", callback_data="ai:archetypes"),
         InlineKeyboardButton("🏆 Челендж", callback_data="ai:challenge")],
        [_site_button("🌐 Відкрити picksy.my")],
        [_channel_button()],
    ]
    return InlineKeyboardMarkup(rows)


def ai_mood_kb() -> InlineKeyboardMarkup:
    moods = [
        ("😊 Веселий", "happy"), ("😢 Сумний", "sad"),
        ("😰 Тривожний", "anxious"), ("💕 Романтичний", "romantic"),
        ("🗺 Авантюрний", "adventurous"), ("🕰 Ностальгічний", "nostalgic"),
        ("😴 Втомлений", "tired"), ("🎨 Натхненний", "creative"),
    ]
    rows = []
    row = []
    for label, key in moods:
        row.append(InlineKeyboardButton(label, callback_data=f"ai:mood_pick:{key}"))
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton("« AI меню", callback_data="ai:menu")])
    return InlineKeyboardMarkup(rows)
