# Picksy Telegram Bot

Загальний бот для спільноти Picksy. **Не підбирає** контент (це на сайті);
надає лише загальну функціональність:

- 🎫 повна тікет-система підтримки (категорії, пріоритети, фото/войс/документ,
  multi-admin, canned responses, internal notes, CSAT, auto-close)
- 🎯 щоденний *Daily Pick* о 12:00 (Київ)
- 📰 розсилки: новини, тижневий дайджест, свята, підказки
- 📢 wizard для адміна: розсилка з фото та inline-кнопкою, прогрес у реалтаймі
- 🔔 топіки підписок, можна вмикати/вимикати по одному
- 👑 бутстрап-адміни з env + динамічне додавання `/addadmin`
- 🌐 UA / EN (наразі лише UA з фолбеком)

Все керується **inline-кнопками** — командою `/start` і reply-keyboard внизу.
Юзеру не треба знати жодних слеш-команд.

## Структура

```
telegram_bot/
├── bot.py                  # entry point + handler wiring
├── config.py               # env config
├── db.py                   # MySQL DAO (shared with backend)
├── i18n.py                 # UA/EN strings
├── keyboards.py            # all inline + reply keyboards
├── scheduler.py            # APScheduler jobs (daily pick, weekly, holidays, auto-close)
├── handlers/
│   ├── user.py             # /start, settings, subscriptions, daily pick view
│   ├── tickets.py          # full ticket lifecycle (user + admin)
│   ├── admin.py            # admin menu, stats, daily-pick set, admins mgmt
│   └── broadcast.py        # admin broadcast wizard
├── requirements.txt
└── README.md
```

## Env vars

Required:

| Var | Що це |
|-----|-------|
| `TELEGRAM_BOT_TOKEN` | токен з @BotFather |
| `PICKSY_BOT_ADMIN_IDS` | tg_id адмінів через кому, напр. `123456789,987654321` |
| `PICKSY_ADMIN_CHAT_ID` | id чату/групи, куди приходять нотифікації по тікетах |
| `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` | спільна БД з backend |

Optional:

| Var | Default | Опис |
|-----|---------|------|
| `SITE_URL` | `https://picksy.my` | публічний URL для лінків |
| `PICKSY_API_URL` | `http://app:7888` | внутрішній URL backend (для опц. виклику API) |
| `BOT_INTERNAL_TOKEN` | _(порожньо)_ | спільний секрет для виклику `/api/admin/daily-pick` без admin-логіну |
| `DAILY_PICK_HOUR` | `9` | UTC година для daily-pick (9 ≈ 12:00 Київ) |
| `DAILY_PICK_MINUTE` | `0` | UTC хвилина |
| `WEEKLY_DIGEST_HOUR` | `16` | UTC година неділі (≈ 19:00 Київ) |
| `TIP_HOUR` | `18` | UTC година для tip-of-day |
| `TICKET_AUTO_CLOSE_DAYS` | `7` | через скільки днів неактивний тікет закривається |
| `TICKET_RATE_LIMIT_PER_HOUR` | `3` | макс. нових тікетів на год від одного юзера |
| `TICKET_MAX_MESSAGES` | `30` | макс. повідомлень у одному тікеті |
| `BROADCAST_RATE_PER_SEC` | `25` | швидкість розсилки (Telegram-ліміт ~30/сек) |

## Запуск (Docker — рекомендовано)

Бот піднімається разом з backend через `docker-compose.yml`:

```bash
docker compose up -d --build
```

Сервіс `bot` чекає поки `db` буде healthy і backend стартує.

## Запуск локально (без Docker)

```bash
cd telegram_bot
pip install -r requirements.txt
# Переконайся що MySQL з backend піднятий і доступний
python -m telegram_bot.bot
```

Запускати треба з кореня репо: `python -m telegram_bot.bot`.

## Команди

### Юзер (всі через кнопки, але можна й командами)

| Команда | Що робить |
|---------|-----------|
| `/start` | головне меню + reply-keyboard |
| `/help` | довідка |
| `/support` | відкрити меню підтримки |
| `/mytickets` | список своїх тікетів |
| `/subscribe`, `/settings` | налаштування підписок |
| `/daily` | подивитись Daily Pick на сьогодні |
| `/about` | про Picksy |
| `/site` | посилання на picksy.my |
| `/cancel` | скасувати поточну дію (написання тікета, броадкаст і т.д.) |

### Адмін

| Команда | Що робить |
|---------|-----------|
| `/admin` | головне адмін-меню (всі функції на кнопках) |
| `/stats` | повний text-дамп статистики |
| `/broadcast` | wizard для розсилки |
| `/addadmin <tg_id> [name]` | додати адміна |
| `/deladmin <tg_id>` | видалити адміна (бутстрап-адмінів з env видалити не можна) |

## Тікет-система — як працює

1. Юзер тисне «🎫 Підтримка» → «📩 Новий тікет»
2. Обирає категорію (🐛 Баг / 💡 Ідея / 💰 Оплата / 🎁 Подарунки / 👤 Акаунт / ❓ Інше)
3. Обирає пріоритет (🟢 Звичайний / 🔥 Терміново)
4. Надсилає опис (текст + опц. фото/войс/документ)
5. Тікет створюється у БД, юзеру повідомляється номер
6. У `PICKSY_ADMIN_CHAT_ID` приходить картка з кнопками:
   `[💬 Відповісти] [📝 Нотатка] [✅ Закрити] [⏸ Очікую юзера] [🔥 Пріо] [👤 Призначити мені] [📞 Швидка відп.] [🚫 Спам] [⛔ Бан] [📜 Історія]`
7. Адмін тисне «Відповісти» → наступне його повідомлення в чаті адмінів іде юзеру
8. Або адмін робить Telegram-reply на картку — теж піде юзеру
9. Юзер може дописувати — все в той самий тікет
10. Адмін закриває → юзер отримує запит CSAT (1-5 ⭐)
11. Через `TICKET_AUTO_CLOSE_DAYS` неактивний тікет авто-закривається

## Розсилки

- **Daily Pick (12:00 Київ)** — топік `daily_pick`, з постером і кнопкою на сайт
- **Тижневий дайджест (нд 19:00)** — топік `weekly_digest`
- **Свята / події** — топік `events`, спрацьовує по даті (1 січня, 24 серпня, 25 грудня тощо)
- **Tip of the day** — топік `tip_of_the_day`, раз на 3 дні
- **News** — спрацьовує тільки при ручному `/broadcast`
- **Усім важливе** (`_all`) — кнопка в wizard «⚠ Усім»; ігнорує підписки

Daily Pick встановлюється через адмін-меню → «🎯 Daily Pick» → «🎬/📺/📚», або
через web-API:

```bash
curl -X POST https://picksy.my/api/admin/daily-pick \
  -H "X-Bot-Token: $BOT_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"item_type":"movie","item_id":"27205","item_title":"Inception","item_year":"2010"}'
```

## Backend endpoints (тільки що додано в v64)

| Метод | Шлях | Auth | Опис |
|-------|------|------|------|
| GET | `/api/daily-pick` | _(public)_ | поточний Daily Pick |
| POST | `/api/admin/daily-pick` | admin Bearer **або** `X-Bot-Token` | встановити Daily Pick |
| GET | `/api/admin/bot/stats` | admin Bearer | загальна статистика бота |
| GET | `/api/admin/bot/tickets?status=open` | admin Bearer | список тікетів |
| GET | `/api/admin/bot/tickets/{id}` | admin Bearer | деталі тікета з повідомленнями |

> Веб-UI відповідей на тікети у v64 поки немає — адмін відповідає виключно
> через бот. Це найпростіший і найшвидший флоу. Додамо у наступних версіях.

## Архітектура

- python-telegram-bot 21.7 (async)
- APScheduler через built-in JobQueue
- MySQL — спільна з backend, схема створюється `backend/main.py:init_db()`
  на старті backend
- Контекст stateful-діалогів — у `application.user_data` (per-user dict)
- Розсилки виконуються асинхронно з rate-limit `BROADCAST_RATE_PER_SEC` і
  обробкою `RetryAfter` / `Forbidden` (юзер заблокував — авто-бан у нашій
  табл. `bot_subscribers`)

## Безпека

- Усі adminʼські кнопки перевіряють `db.is_admin(user_id)` (через
  `bot_admins` + bootstrap env-список)
- Anti-spam: `TICKET_RATE_LIMIT_PER_HOUR`, `TICKET_MAX_MESSAGES`
- Юзер може видалити *усі* свої дані: ⚙️ Налаштування → ❌ Видалити мої дані
  → підтвердити повторно
- Жодних секретів у логах
