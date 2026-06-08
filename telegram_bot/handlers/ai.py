"""Picksy AI handlers: movie analysis, mood picks, tips, horoscope, fun facts,
random suggestion, and deep link from the website descmovie/desctv pages."""
from __future__ import annotations

import datetime
import json
import logging
import random
import re
from pathlib import Path
from typing import Optional

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from .. import config, db
from ..keyboards import ai_menu_kb, ai_mood_kb, main_reply_kb

log = logging.getLogger("picksy_bot.ai")

# ─── Archetypes data (loaded once) ───
_ARCHETYPES: list[dict] = []


def _load_archetypes() -> list[dict]:
    """Load archetype definitions from the first available bundled location.

    The bot may be deployed standalone (without the `frontend/` tree), so we
    try several paths in order: bundled copy next to the package, repo root
    `frontend/data/`, then a few common Docker layouts. This makes the
    "Кому підходить (за архетипами Picksy)" section reliably render in the
    AI analysis output instead of being silently empty.
    """
    global _ARCHETYPES
    if _ARCHETYPES:
        return _ARCHETYPES
    here = Path(__file__).resolve()
    candidates = [
        # 1) bundled next to telegram_bot package (preferred, ships in Docker)
        here.parent.parent / "data" / "archetypes.json",
        # 2) repo-root layout (dev / monorepo)
        here.parent.parent.parent / "frontend" / "data" / "archetypes.json",
        # 3) common Docker layouts
        Path("/app/telegram_bot/data/archetypes.json"),
        Path("/app/frontend/data/archetypes.json"),
        Path("/app/data/archetypes.json"),
    ]
    for p in candidates:
        try:
            if p.exists():
                data = json.loads(p.read_text(encoding="utf-8"))
                _ARCHETYPES = data.get("archetypes", [])
                if _ARCHETYPES:
                    log.info("Loaded %d archetypes from %s", len(_ARCHETYPES), p)
                    return _ARCHETYPES
        except Exception as e:
            log.warning("Failed to load archetypes from %s: %s", p, e)
    log.warning("No archetype data file found in any of: %s", candidates)
    return _ARCHETYPES


# ─── AI phrases pools ───

GREETING_PHRASES = [
    "Привіт! Я *Picksy AI* -- твій персональний кіно-асистент.",
    "Радий тебе бачити! Я *Picksy AI*, і я знаю про кіно все.",
    "Йоу! *Picksy AI* на зв'язку. Що тебе цікавить?",
    "Вітаю! Я *Picksy AI* -- допоможу знайти ідеальне кіно.",
    "Привіт, кіноман! *Picksy AI* готовий до роботи.",
]

MOVIE_FACTS = [
    "🎬 *Факт дня:* Фільм «Шоушенк» провалився у прокаті, але став #1 на IMDb завдяки DVD.",
    "🎬 *Факт дня:* У «Зоряних війнах» звук лазера -- це удар по розтяжці антени.",
    "🎬 *Факт дня:* Хічкок знімав «Психо» на ч/б, бо кров у кольорі виглядала надто реалістично.",
    "🎬 *Факт дня:* Хіт Леджер замкнувся в готелі на 6 тижнів, щоб створити Джокера.",
    "🎬 *Факт дня:* Стенлі Кубрик зробив 127 дублів однієї сцени у «Сяйві».",
    "🎬 *Факт дня:* У «Матриці» зелений фільтр символізує віртуальний світ.",
    "🎬 *Факт дня:* Ріплі з «Чужого» спочатку мав бути чоловічим персонажем.",
    "🎬 *Факт дня:* Тарантіно працював у відеопрокаті -- там він вивчив кіно.",
    "🎬 *Факт дня:* «Титанік» коштував більше, ніж сам Титанік (з поправкою на інфляцію).",
    "🎬 *Факт дня:* Вільям Мейсі нижчий за себе у фільмах -- знімається в траншеях для камери.",
    "🎬 *Факт дня:* Ганнібал Лектер з'являється на екрані лише 16 хвилин у «Мовчанні ягнят».",
    "🎬 *Факт дня:* «Начало» Нолана від ідеї до фільму зайняло 10 років.",
    "🎬 *Факт дня:* У «Бійцівському клубі» стаканчик Starbucks є в кожній сцені.",
    "🎬 *Факт дня:* Леонардо ДіКапріо порізав руку в «Джанго», але продовжив грати.",
    "🎬 *Факт дня:* Першим повнометражним анімаційним фільмом був «Білосніжка» (1937).",
    "🎬 *Факт дня:* Тім Бартон тримає кота на зйомках -- для натхнення.",
    "🎬 *Факт дня:* «Зоряні війни: Нова надія» озвучувались без діалогів на майданчику.",
    "🎬 *Факт дня:* Вуді Аллен пише сценарії на одній і тій самій друкарській машинці з 1960-х.",
    "🎬 *Факт дня:* Роль Джеймса Бонда пропонували Шону Коннері, коли йому було 32.",
    "🎬 *Факт дня:* «Паразити» -- перший неангломовний фільм, що отримав «Оскар» за найкращий фільм.",
]

AI_TIPS = [
    "💡 *Picksy AI радить:* Дивись фільми під настрій -- це підвищує задоволення на 40%.",
    "💡 *Picksy AI радить:* Не бійся субтитрів -- так ти відкриєш світове кіно.",
    "💡 *Picksy AI радить:* Один фільм на тиждень з жанру, який зазвичай не дивишся -- це розширює горизонти.",
    "💡 *Picksy AI радить:* Перш ніж обрати фільм, запитай себе: чого я хочу від цього вечора?",
    "💡 *Picksy AI радить:* Короткометражки -- недооцінений жанр. Спробуй подивитися одну сьогодні.",
    "💡 *Picksy AI радить:* Після важкого дня -- анімація. Серйозно. Навіть дорослим.",
    "💡 *Picksy AI радить:* Ведення списку переглянутого допомагає відстежити свій смак.",
    "💡 *Picksy AI радить:* Класика не застаріває. Спробуй щомісяця один фільм до 1980 року.",
    "💡 *Picksy AI радить:* Документальне кіно змінить твій погляд на реальний світ.",
    "💡 *Picksy AI радить:* Подивись фільм режисера, чиї інші роботи тобі вже сподобалися.",
    "💡 *Picksy AI радить:* Фільми найкраще дивитись у темряві -- мозок занурюється глибше.",
    "💡 *Picksy AI радить:* Пауза між серіями серіалу дає мозку осмислити сюжет.",
    "💡 *Picksy AI радить:* Серіал до 8 серій -- ідеальний формат для зайнятих.",
    "💡 *Picksy AI радить:* Фільм іноземною мовою = подорож без квитка.",
    "💡 *Picksy AI радить:* Перегляд фільму вдруге відкриває деталі, які ти пропустив.",
]

EVENING_MESSAGES = [
    "🌙 *Picksy AI:* Вечір -- ідеальний час для кіно. Я вже підготував для тебе добірку на picksy.my. Чекаю — і не забувай підписатися на @itspicksy!",
    "🌙 *Picksy AI:* Гей, як щодо фільму на ніч? Заходь на picksy.my — у мене є дещо цікаве. А на @itspicksy я кинув підбірку вечора.",
    "🌟 *Picksy AI:* Робочий день позаду — час для хорошого кіно! Чекаю тебе на picksy.my, а всі анонси — на @itspicksy.",
    "🎬 *Picksy AI:* Сьогодні чудовий вечір для перегляду. Нова підбірка вже на picksy.my — і в нашому каналі @itspicksy!",
    "🌜 *Picksy AI:* Плед, чай, фільм — формула ідеального вечора. Заходь на picksy.my! П.С. На @itspicksy сьогодні особливий пост.",
    "🍿 *Picksy AI:* Привіт! Я підібрав кілька фільмів, які тобі сподобаються. Чекаю на picksy.my! Підпишися на @itspicksy — там я пишу щодня.",
    "🌌 *Picksy AI:* Вечірній кіносеанс починається! Нові рекомендації — на picksy.my, а живі обговорення — у @itspicksy.",
    "🎥 *Picksy AI:* Не знаєш, що подивитися? Я знаю. Заходь на picksy.my — підкажу. Або глянь в канал @itspicksy — там вже є підбірка.",
    "✨ *Picksy AI:* Сьогодні я знайшов щось особливе для тебе на picksy.my! Для щоденних порад — @itspicksy.",
    "🌃 *Picksy AI:* Ніч молода, а хороших фільмів — безліч. Чекаю тебе на picksy.my і в каналі @itspicksy!",
]

HOROSCOPE_GENRES = {
    "Овен": ("бойовик", "Твоя вогняна натура жадає екшену. Сьогодні -- день для адреналіну."),
    "Телець": ("драма", "Ти цінуєш глибину і сенс. Сьогодні -- час для вдумливої драми."),
    "Близнюки": ("комедія", "Твоя подвійна натура хоче сміху. Комедія -- те що треба."),
    "Рак": ("сімейний", "Домашній затишок і теплий фільм -- ось твій вечір."),
    "Лев": ("епік", "Масштабне кіно для короля. Сьогодні -- епічні історії."),
    "Діва": ("детектив", "Увага до деталей? Детектив -- саме для тебе."),
    "Терези": ("мелодрама", "Гармонія і краса. Романтичне кіно у тебе в крові."),
    "Скорпіон": ("трилер", "Тебе приваблює темрява. Трилер -- твоя стихія."),
    "Стрілець": ("пригоди", "Подорожі й відкриття. Пригодницьке кіно чекає."),
    "Козеріг": ("біографія", "Амбіції і стратегія. Біографії великих людей -- твоє натхнення."),
    "Водолій": ("фантастика", "Майбутнє і технології. Фантастика -- твій жанр."),
    "Риби": ("фентезі", "Мрії і уява. Зануррся у фентезійний світ."),
}

MOOD_OPTIONS = {
    "happy": ("😊 Веселий", "Чудово! Коли ти в гарному настрої -- комедія або легкий пригодницький фільм підсилять його."),
    "sad": ("😢 Сумний", "Іноді потрібно пережити сум через кіно. Подивись щось теплу драму або анімацію -- допоможе."),
    "anxious": ("😰 Тривожний", "Щоб зняти тривогу, раджу щось спокійне: документалку про природу або затишний серіал."),
    "romantic": ("💕 Романтичний", "О, любов у повітрі! Романтична комедія або класична мелодрама -- ідеальний вибір."),
    "adventurous": ("🗺 Авантюрний", "Тебе кличе пригода! Екшен, фантастика або подорожній документальний фільм."),
    "nostalgic": ("🕰 Ностальгічний", "Час для класики! Подивись щось з 80-90-х або перегляни улюблене."),
    "tired": ("😴 Втомлений", "Після важкого дня -- короткий фільм або один епізод серіалу. Нічого складного."),
    "creative": ("🎨 Натхненний", "Творчий настрій! Артхаус або незалежне кіно підживить твою уяву."),
}

# ─── Archetype-based movie analysis ───

ARCHETYPE_MATCH_KEYWORDS: dict[str, list[str]] = {
    "arthaus-visionary": ["артхаус", "авторськ", "драма", "мистецтв", "тарковськ", "бергман", "меланхол"],
    "nineties-romantic": ["романтик", "любов", "комед", "rom-com", "сердц", "стосунк"],
    "quiet-cryptic-child": ["кримінал", "тарантін", "лінч", "нелінійн", "культов", "чорний гумор"],
    "adrenaline-bro": ["екшен", "бойовик", "action", "вибух", "адреналін", "трюк"],
    "horror-psycho": ["жах", "горрор", "horror", "psycho", "моторошн", "страш", "паранорм"],
    "anime-otaku": ["аніме", "anime", "манга", "японськ", "анімац", "ghibli"],
    "ghibli-dreamer": ["ghibli", "міядзакі", "казк", "магічн", "фентезі", "мрійн"],
    "dark-philosopher": ["філософ", "екзистенц", "нуар", "глибок", "сенс", "смерт"],
    "doc-skeptic": ["документ", "doc", "реальн", "правд", "факт", "журналіст"],
    "neo-noir-detective": ["нуар", "детектив", "розслідуван", "злочин", "noir", "таємниц"],
    "golden-age-classicist": ["класик", "золот", "ретро", "стар", "голлівуд", "винтаж"],
    "indie-mumblecore": ["інді", "незалежн", "indie", "mumblecore", "малобюджет", "авторськ"],
    "absurd-comedian": ["абсурд", "комед", "сатир", "пароді", "гумор", "смішн"],
    "crime-epic": ["мафія", "гангстер", "кримінал", "epic", "скорсезе", "корлеоне"],
    "sci-fi-futurist": ["фантастик", "sci-fi", "космос", "майбутн", "кіберпанк", "робот"],
    "war-poet": ["війн", "воєн", "солдат", "батальн", "мілітар", "героїзм"],
}

WHEN_TO_WATCH = [
    "увечері, коли хочеться зануритися у щось глибоке",
    "на вихідних, коли є час для довгого перегляду",
    "після важкого дня -- для перезавантаження",
    "у компанії друзів, якщо хочете обговорити",
    "у дощовий день під пледом",
    "коли хочеться побути наодинці з думками",
    "у п'ятницю ввечері -- як нагорода за тиждень",
    "коли шукаєш натхнення для чогось нового",
]

AFTER_EVENTS = [
    "після розмови, яка змусила задуматися",
    "після завершення великого проекту",
    "після тривалої подорожі",
    "після прочитання книги -- для зміни формату",
    "після приємної вечері",
    "після прогулянки на свіжому повітрі",
    "після медитації або відпочинку",
    "після зустрічі зі старими друзями",
]


def _match_archetypes(title: str, overview: str) -> list[dict]:
    """Match movie/show to archetypes based on keyword heuristics."""
    archetypes = _load_archetypes()
    if not archetypes:
        return []

    text = (title + " " + overview).lower()
    scores: list[tuple[float, dict]] = []

    for arch in archetypes:
        slug = arch.get("slug", "")
        keywords = ARCHETYPE_MATCH_KEYWORDS.get(slug, [])
        score = 0.0
        for kw in keywords:
            if kw.lower() in text:
                score += 1.0
        # Bonus for trait matches
        for trait in arch.get("traits", []):
            if trait.lower() in text:
                score += 0.5
        if score > 0:
            scores.append((score, arch))

    scores.sort(key=lambda x: x[0], reverse=True)

    if not scores:
        return random.sample(archetypes, min(3, len(archetypes)))

    return [s[1] for s in scores[:3]]


def _build_movie_analysis(title: str, year: str, overview: str, item_type: str, item_url: str) -> str:
    """Build a rich AI analysis of a movie/show."""
    matched = _match_archetypes(title, overview)
    type_label = "Фільм" if item_type == "movie" else "Серіал"

    parts = [
        f"🤖 *Picksy AI -- Аналіз*\n",
        f"🎬 *{title}*" + (f" ({year})" if year else ""),
        f"📋 Тип: {type_label}\n",
    ]

    if overview:
        parts.append(f"📝 _{overview[:200]}{'...' if len(overview) > 200 else ''}_\n")

    # Only render the archetypes block when we actually have matches — avoids
    # the empty "Кому підходить" header bug when archetypes.json isn't bundled.
    if matched:
        parts.append("🎭 *Кому підходить (за архетипами Picksy):*\n")
        for i, arch in enumerate(matched, 1):
            emoji = arch.get("emoji", "")
            name = arch.get("name", "")
            tagline = arch.get("tagline", "")
            parts.append(f"{i}. {emoji} *{name}*")
            if tagline:
                parts.append(f"   _{tagline}_")
        parts.append("")
    else:
        log.warning("Analysis: no archetypes matched for %r — section skipped", title)
        parts.append("")
    parts.append(f"⏰ *Коли дивитися:*\n{random.choice(WHEN_TO_WATCH)}")
    parts.append(f"\n📅 *Після яких подій:*\n{random.choice(AFTER_EVENTS)}")

    # Fun AI-generated recommendation
    recs = [
        f"\n🍿 *Порада Picksy AI:*\nЦей {type_label.lower()} ідеальний для тих, хто цінує ",
        f"глибокі сюжети та неочікувані повороти. " if "drama" in overview.lower() or len(overview) > 100 else "яскраві емоції та динамічний сюжет. ",
        f"Рекомендую дивитися з повною увагою -- деталі тут важливі.",
    ]
    parts.append("".join(recs))

    parts.append(f"\n🔗 [Переглянути на Picksy]({item_url})")

    return "\n".join(parts)


# ─── Link parser ───

_LINK_RE = re.compile(
    r"(?:https?://)?(?:www\.)?picksy\.my/(descmovie|desctv|descbook)/(\d+)",
    re.IGNORECASE,
)


def parse_picksy_link(text: str) -> Optional[tuple[str, str]]:
    """Extract (item_type, item_id) from a picksy.my link.

    Returns ('movie', '123') or ('tv', '456') etc., or None.
    """
    m = _LINK_RE.search(text)
    if not m:
        return None
    page = m.group(1).lower()
    item_id = m.group(2)
    type_map = {"descmovie": "movie", "desctv": "tv", "descbook": "book"}
    return type_map.get(page, "movie"), item_id


# ─── Handlers ───

def _track(update: Update) -> None:
    user = update.effective_user
    if not user:
        return
    try:
        db.upsert_subscriber(user.id, user.username, user.first_name)
    except Exception:
        pass


def _ai_footer() -> str:
    """Reusable footer block linking to site + channel."""
    return (
        f"\n\n🌐 {config.SITE_URL}  ·  📣 {config.TG_CHANNEL_USERNAME} ({config.TG_CHANNEL_URL})"
    )


async def cmd_ai(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Open the Picksy AI menu."""
    _track(update)
    greeting = random.choice(GREETING_PHRASES)
    text = (
        f"{greeting}\n\n"
        "Обирай, що тебе цікавить:"
        + _ai_footer()
    )
    await update.message.reply_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ai_menu_kb(),
        disable_web_page_preview=True,
    )


async def on_ai_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: open AI menu."""
    q = update.callback_query
    await q.answer()
    greeting = random.choice(GREETING_PHRASES)
    text = (
        f"{greeting}\n\nОбирай, що тебе цікавить:"
        + _ai_footer()
    )
    await q.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ai_menu_kb(),
        disable_web_page_preview=True,
    )


async def on_ai_analyze_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: prompt user to send a link for analysis."""
    q = update.callback_query
    await q.answer()
    context.user_data["awaiting_movie_link"] = True
    text = (
        "🔍 *Аналіз фільму/серіалу*\n\n"
        "Надішли мені посилання на фільм або серіал з Picksy:\n"
        f"`{config.SITE_URL}/descmovie/12345`\n"
        f"`{config.SITE_URL}/desctv/67890`\n\n"
        "Або просто скопіюй посилання зі сторінки фільму на сайті."
    )
    await q.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🌐 Відкрити сайт", url=config.SITE_URL)],
            [InlineKeyboardButton("« Назад", callback_data="ai:menu")],
        ]),
    )


async def handle_movie_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """Try to handle a picksy.my link in user's message. Returns True if handled."""
    if not update.message or not update.message.text:
        return False

    text = update.message.text.strip()
    parsed = parse_picksy_link(text)

    # Also handle if user is in "awaiting link" mode
    if not parsed and not context.user_data.get("awaiting_movie_link"):
        return False

    if not parsed:
        if context.user_data.get("awaiting_movie_link"):
            context.user_data.pop("awaiting_movie_link", None)
            await update.message.reply_text(
                "❌ Не вдалося розпізнати посилання. Надішли посилання формату:\n"
                f"`{config.SITE_URL}/descmovie/12345`",
                parse_mode=ParseMode.MARKDOWN,
            )
            return True
        return False

    context.user_data.pop("awaiting_movie_link", None)
    item_type, item_id = parsed

    await update.message.reply_text("🔄 Аналізую... Зачекай хвильку.")

    from .. import site_api

    # Fetch movie/tv info from Picksy backend API
    # Correct endpoints: /api/movies/{id}/details, /api/tv/{id}/details
    payload = None
    try:
        import httpx
        if item_type == "movie":
            api_path = f"/api/movies/{item_id}/details"
        elif item_type == "tv":
            api_path = f"/api/tv/{item_id}/details"
        else:
            api_path = f"/api/books/{item_id}/details"
        url = config.API_URL.rstrip("/") + api_path
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, params={"lang": "uk"})
            if r.status_code == 200:
                payload = r.json()
            else:
                log.warning("movie detail fetch %s -> HTTP %s", api_path, r.status_code)
    except Exception as e:
        log.warning("movie fetch for analysis: %s", e)

    # Fallback: try to scrape from the public descmovie page via site URL
    if not payload:
        try:
            import httpx
            if item_type == "movie":
                api_path2 = f"/api/movies/{item_id}/details"
            else:
                api_path2 = f"/api/tv/{item_id}/details"
            url2 = config.SITE_URL.rstrip("/") + api_path2
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                r = await client.get(url2, params={"lang": "uk"})
                if r.status_code == 200:
                    payload = r.json()
        except Exception:
            pass

    title = ""
    year_str = ""
    overview = ""
    if payload:
        title = site_api._title(payload)
        year_str = site_api._year(payload)
        overview = payload.get("overview") or payload.get("description") or ""

    if not title:
        title = f"{'Фільм' if item_type == 'movie' else 'Серіал'} #{item_id}"

    item_url = f"{config.SITE_URL}/{'descmovie' if item_type == 'movie' else 'desctv'}/{item_id}"
    analysis = _build_movie_analysis(title, year_str, overview, item_type, item_url)

    btn_rows = [
        [InlineKeyboardButton("🌐 Переглянути на Picksy", url=item_url)],
        [InlineKeyboardButton(f"📣 Канал {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
        [InlineKeyboardButton("🤖 Ще аналіз", callback_data="ai:analyze"),
         InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
    ]

    await update.message.reply_text(
        analysis,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(btn_rows),
        disable_web_page_preview=True,
    )
    return True


async def auto_analyze_by_id(update: Update, context: ContextTypes.DEFAULT_TYPE, deep_link: str):
    """Auto-analyze a movie/tv by ID from deep link (e.g. 'analyze_movie_12345')."""
    import re as _re
    m = _re.match(r"analyze_(movie|tv)_(\d+)", deep_link)
    if not m:
        await update.message.reply_text(
            "❌ Невірний формат посилання. Спробуй /ai",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    item_type = m.group(1)
    item_id = m.group(2)

    await update.message.reply_text("🔄 Аналізую... Зачекай хвильку.")

    from .. import site_api

    payload = None
    try:
        import httpx
        if item_type == "movie":
            api_path = f"/api/movies/{item_id}/details"
        else:
            api_path = f"/api/tv/{item_id}/details"
        url = config.API_URL.rstrip("/") + api_path
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, params={"lang": "uk"})
            if r.status_code == 200:
                payload = r.json()
    except Exception as e:
        log.warning("auto_analyze fetch: %s", e)

    if not payload:
        try:
            import httpx
            if item_type == "movie":
                api_path2 = f"/api/movies/{item_id}/details"
            else:
                api_path2 = f"/api/tv/{item_id}/details"
            url2 = config.SITE_URL.rstrip("/") + api_path2
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                r = await client.get(url2, params={"lang": "uk"})
                if r.status_code == 200:
                    payload = r.json()
        except Exception:
            pass

    title = ""
    year_str = ""
    overview = ""
    if payload:
        title = site_api._title(payload)
        year_str = site_api._year(payload)
        overview = payload.get("overview") or payload.get("description") or ""

    if not title:
        title = f"{'Фільм' if item_type == 'movie' else 'Серіал'} #{item_id}"

    prefix = "descmovie" if item_type == "movie" else "desctv"
    item_url = f"{config.SITE_URL}/{prefix}/{item_id}"
    analysis = _build_movie_analysis(title, year_str, overview, item_type, item_url)

    btn_rows = [
        [InlineKeyboardButton("🌐 Переглянути на Picksy", url=item_url)],
        [InlineKeyboardButton(f"📣 Канал {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
        [InlineKeyboardButton("🤖 Ще аналіз", callback_data="ai:analyze"),
         InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
    ]

    await update.message.reply_text(
        analysis,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(btn_rows),
        disable_web_page_preview=True,
    )


async def on_ai_tip(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: show random AI tip."""
    q = update.callback_query
    await q.answer()
    tip = random.choice(AI_TIPS)
    await q.edit_message_text(
        tip + "\n\n_Натисни для ще однієї поради:_" + _ai_footer(),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("💡 Ще порада", callback_data="ai:tip")],
            [InlineKeyboardButton("🌐 picksy.my", url=config.SITE_URL),
             InlineKeyboardButton(f"📣 {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
            [InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
        ]),
        disable_web_page_preview=True,
    )


async def on_ai_fact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: show random movie fact."""
    q = update.callback_query
    await q.answer()
    fact = random.choice(MOVIE_FACTS)
    await q.edit_message_text(
        fact + _ai_footer(),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🏆 Ще факт", callback_data="ai:fact")],
            [InlineKeyboardButton("🌐 picksy.my", url=config.SITE_URL),
             InlineKeyboardButton(f"📣 {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
            [InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
        ]),
        disable_web_page_preview=True,
    )


async def on_ai_mood(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: open mood picker."""
    q = update.callback_query
    await q.answer()
    await q.edit_message_text(
        "🎭 *Який у тебе зараз настрій?*\n\n"
        "Обери свій поточний стан, і Picksy AI підкаже, що подивитися:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ai_mood_kb(),
    )


async def on_ai_mood_pick(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: show recommendation based on chosen mood."""
    q = update.callback_query
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    mood_key = parts[2]
    mood_info = MOOD_OPTIONS.get(mood_key)
    if not mood_info:
        await q.answer("Невідомий настрій")
        return
    await q.answer()
    label, advice = mood_info
    archetypes = _load_archetypes()

    # Pick 2-3 random archetypes for recommendation
    recs = random.sample(archetypes, min(3, len(archetypes))) if archetypes else []
    rec_text = ""
    if recs:
        rec_text = "\n\n🎭 *Рекомендовані архетипи для тебе:*\n"
        for arch in recs:
            rec_text += f"• {arch.get('emoji', '')} *{arch.get('name', '')}* -- {arch.get('tagline', '')}\n"

    text = (
        f"*{label}*\n\n"
        f"🤖 *Picksy AI:* {advice}"
        f"{rec_text}\n"
        f"🔗 [Знайти фільм під настрій на Picksy]({config.SITE_URL})\n"
        f"📣 Щоденні підбірки в каналі {config.TG_CHANNEL_USERNAME} — {config.TG_CHANNEL_URL}"
    )
    await q.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🌐 Підібрати на picksy.my", url=config.SITE_URL)],
            [InlineKeyboardButton(f"📣 Канал {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
            [InlineKeyboardButton("🎭 Інший настрій", callback_data="ai:mood")],
            [InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
        ]),
        disable_web_page_preview=True,
    )


async def on_ai_horoscope(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: show zodiac selector."""
    q = update.callback_query
    await q.answer()
    signs = list(HOROSCOPE_GENRES.keys())
    rows = []
    row = []
    for i, sign in enumerate(signs):
        row.append(InlineKeyboardButton(sign, callback_data=f"ai:horo:{sign}"))
        if len(row) == 3:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton("« AI меню", callback_data="ai:menu")])
    await q.edit_message_text(
        "🔮 *Кіно-гороскоп від Picksy AI*\n\n"
        "Обери свій знак зодіаку:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(rows),
    )


async def on_ai_horoscope_pick(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: show horoscope for chosen zodiac sign."""
    q = update.callback_query
    parts = (q.data or "").split(":")
    if len(parts) < 3:
        await q.answer()
        return
    sign = parts[2]
    info = HOROSCOPE_GENRES.get(sign)
    if not info:
        await q.answer("Невідомий знак")
        return
    await q.answer()
    genre, description = info
    today = datetime.date.today().strftime("%d.%m.%Y")

    # Pick a matching archetype
    archetypes = _load_archetypes()
    arch_rec = ""
    if archetypes:
        arch = random.choice(archetypes)
        arch_rec = (
            f"\n\n🎭 *Твій архетип сьогодні:* {arch.get('emoji', '')} {arch.get('name', '')}\n"
            f"_{arch.get('tagline', '')}_"
        )

    text = (
        f"🔮 *Кіно-гороскоп на {today}*\n\n"
        f"♈ *{sign}*\n\n"
        f"🎬 Жанр дня: *{genre}*\n"
        f"🤖 {description}"
        f"{arch_rec}\n\n"
        f"🔗 [Знайти {genre} на Picksy]({config.SITE_URL})\n"
        f"📣 Щоденний гороскоп і підбірки — {config.TG_CHANNEL_USERNAME} ({config.TG_CHANNEL_URL})"
    )
    await q.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🌐 Підібрати на picksy.my", url=config.SITE_URL)],
            [InlineKeyboardButton(f"📣 Канал {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
            [InlineKeyboardButton("🔮 Інший знак", callback_data="ai:horoscope")],
            [InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
        ]),
        disable_web_page_preview=True,
    )


async def on_ai_random(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: random movie suggestion from archetypes."""
    q = update.callback_query
    await q.answer()
    archetypes = _load_archetypes()
    if not archetypes:
        await q.edit_message_text(
            "🤖 Не вдалося завантажити дані. Спробуй пізніше.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
            ]),
        )
        return

    arch = random.choice(archetypes)
    films = arch.get("films", [])
    if films:
        film = random.choice(films)
        film_text = (
            f"🎬 *{film.get('title', '')}*"
            + (f" ({film.get('year', '')})" if film.get("year") else "")
            + (f"\n_{film.get('note', '')}_" if film.get("note") else "")
        )
    else:
        film_text = "🎬 Переглянь добірку на сайті!"

    text = (
        f"🎲 *Що подивитися?*\n\n"
        f"Архетип: {arch.get('emoji', '')} *{arch.get('name', '')}*\n"
        f"_{arch.get('tagline', '')}_\n\n"
        f"{film_text}\n\n"
        f"⏰ *Коли:* {random.choice(WHEN_TO_WATCH)}\n\n"
        f"🔗 [Більше на Picksy]({config.SITE_URL})\n"
        f"📣 Щоденні підбірки — {config.TG_CHANNEL_USERNAME} ({config.TG_CHANNEL_URL})"
    )
    await q.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🌐 Відкрити picksy.my", url=config.SITE_URL)],
            [InlineKeyboardButton(f"📣 Канал {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
            [InlineKeyboardButton("🎲 Ще рекомендація", callback_data="ai:random")],
            [InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
        ]),
        disable_web_page_preview=True,
    )


async def on_ai_archetype_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: show all archetypes overview."""
    q = update.callback_query
    await q.answer()
    archetypes = _load_archetypes()
    if not archetypes:
        await q.edit_message_text(
            "🤖 Не вдалося завантажити архетипи.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
            ]),
        )
        return

    parts = [
        "🎭 *Архетипи Picksy*\n\nПройди квіз на picksy.my, щоб дізнатися свій!\n",
    ]
    for arch in archetypes[:16]:
        parts.append(f"{arch.get('emoji', '')} *{arch.get('name', '')}*")
    parts.append(f"\n🔗 [Пройти квіз]({config.SITE_URL}/quiz)")
    parts.append(
        f"📣 Результатами квізу поділись у коментарях {config.TG_CHANNEL_USERNAME} ({config.TG_CHANNEL_URL})"
    )

    await q.edit_message_text(
        "\n".join(parts),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("📝 Пройти квіз", url=f"{config.SITE_URL}/quiz")],
            [InlineKeyboardButton("🌐 picksy.my", url=config.SITE_URL),
             InlineKeyboardButton(f"📣 {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
            [InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
        ]),
        disable_web_page_preview=True,
    )


async def on_ai_weekly_challenge(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback: weekly movie challenge."""
    q = update.callback_query
    await q.answer()
    archetypes = _load_archetypes()
    challenges = [
        "Подивись фільм жанру, який зазвичай не дивишся",
        "Подивись фільм знятий до 1990 року",
        "Подивись короткометражку (до 30 хв)",
        "Подивись фільм з іншої країни (не англомовний)",
        "Подивись документальний фільм",
        "Переглянь фільм, який бачив 5+ років тому",
        "Подивись фільм за рекомендацією друга",
        "Подивись фільм режисера, чиї роботи ще не бачив",
        "Подивись анімаційний фільм (не для дітей)",
        "Подивись фільм, який отримав Оскар за найкращий фільм",
    ]
    challenge = random.choice(challenges)

    arch_hint = ""
    if archetypes:
        arch = random.choice(archetypes)
        arch_hint = f"\n\n🎭 Підказка від архетипу {arch.get('emoji', '')} *{arch.get('name', '')}*:\n_{arch.get('tagline', '')}_"

    text = (
        f"🏆 *Кіно-челендж тижня*\n\n"
        f"📋 Завдання:\n*{challenge}*"
        f"{arch_hint}\n\n"
        f"Поділись результатом з друзями на {config.SITE_URL} або в коментарях "
        f"{config.TG_CHANNEL_USERNAME} ({config.TG_CHANNEL_URL})!"
    )
    await q.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🌐 Знайти фільм на picksy.my", url=config.SITE_URL)],
            [InlineKeyboardButton(f"📣 Канал {config.TG_CHANNEL_USERNAME}", url=config.TG_CHANNEL_URL)],
            [InlineKeyboardButton("🏆 Інший челендж", callback_data="ai:challenge")],
            [InlineKeyboardButton("« AI меню", callback_data="ai:menu")],
        ]),
        disable_web_page_preview=True,
    )
