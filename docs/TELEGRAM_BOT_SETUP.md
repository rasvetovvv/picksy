# Picksy — Налаштування Telegram бота та API

## 📱 Telegram Bot — крок за кроком

### 1. Створення бота

1. Відкрийте Telegram і знайдіть [@BotFather](https://t.me/BotFather)
2. Надішліть `/newbot`
3. Введіть назву бота: `Picksy Bot`
4. Введіть username бота: `picksy_recommend_bot` (має закінчуватись на `bot`)
5. BotFather видасть вам **API Token** — збережіть його!

```
Приклад токена: 7123456789:AAH1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q
```

### 2. Налаштування вебхука

```bash
# Встановіть вебхук на ваш сервер
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/api/telegram/webhook"}'
```

### 3. Змінні середовища

Додайте в `.env` файл:

```env
TELEGRAM_BOT_TOKEN=7123456789:AAH1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q
TELEGRAM_WEBHOOK_SECRET=your-random-secret-string
```

### 4. Команди бота

Налаштуйте команди через BotFather → `/setcommands`:

```
pick - Отримати рекомендацію фільму
tv - Отримати рекомендацію серіалу
book - Отримати рекомендацію книги
mood - Вибрати настрій для підбору
saved - Мої збережені
profile - Мій профіль
help - Допомога
```

---

## 🔗 API — документація

### Базовий URL

```
https://yourdomain.com/api
```

### Аутентифікація

Всі захищені ендпоінти потребують заголовок:

```
Authorization: Bearer <token>
```

Токен отримується при логіні/реєстрації.

### Основні ендпоінти

#### Аутентифікація

| Метод | URL | Опис |
|-------|-----|------|
| `POST` | `/api/auth/register` | Реєстрація `{email, password}` |
| `POST` | `/api/auth/login` | Логін `{email, password}` |
| `GET` | `/api/auth/me` | Поточний користувач |
| `POST` | `/api/auth/change-password` | Змінити пароль `{old_password, new_password}` |

#### Підбір контенту

| Метод | URL | Опис |
|-------|-----|------|
| `POST` | `/api/pick` | Підібрати контент `{type, mood, filters}` |
| `POST` | `/api/ai-search` | AI пошук `{query}` |
| `GET` | `/api/trending` | Популярне цього тижня |
| `GET` | `/api/daily-pick` | Добірка дня |

#### Збережене

| Метод | URL | Опис |
|-------|-----|------|
| `GET` | `/api/saved/movies` | Збережені фільми |
| `GET` | `/api/saved/tv` | Збережені серіали |
| `GET` | `/api/saved/books` | Збережені книги |
| `POST` | `/api/save/movie` | Зберегти фільм |
| `POST` | `/api/save/tv` | Зберегти серіал |
| `POST` | `/api/save/book` | Зберегти книгу |
| `DELETE` | `/api/saved/movie/{id}` | Видалити фільм |
| `DELETE` | `/api/saved/tv/{id}` | Видалити серіал |
| `DELETE` | `/api/saved/book/{id}` | Видалити книгу |

#### Підписки

| Метод | URL | Опис |
|-------|-----|------|
| `GET` | `/api/subscription` | Поточна підписка |
| `GET` | `/api/subscription/plans` | Доступні плани (з цінами на 7/14/30 днів) |
| `POST` | `/api/subscription/start-trial` | Активувати 7-денний тест Premium |

#### Гра «Вгадай фільм»

| Метод | URL | Опис |
|-------|-----|------|
| `POST` | `/api/game/find` | Знайти суперника (випадковий) |
| `POST` | `/api/game/create-lobby` | Створити приватне лобі |
| `POST` | `/api/game/join-lobby` | Приєднатись до лобі `{lobby_code}` |
| `GET` | `/api/game/match/{id}` | Стан матчу |
| `POST` | `/api/game/guess/{id}` | Зробити спробу `{rating, year}` |
| `GET` | `/api/game/leaderboard` | Таблиця лідерів |
| `GET` | `/api/game/my-rating` | Мій рейтинг |

#### Профіль

| Метод | URL | Опис |
|-------|-----|------|
| `GET` | `/api/profile` | Мій профіль (статистика, збережене) |
| `POST` | `/api/me/profile` | Оновити профіль `{display_name, bio, avatar_emoji}` |
| `GET` | `/u/{username}` | Публічний профіль (HTML) |

### Коди помилок

| Код | Опис |
|-----|------|
| `400` | Невірний запит |
| `401` | Не авторизовано |
| `403` | Доступ заборонено (бан, maintenance, функція вимкнена) |
| `404` | Не знайдено |
| `429` | Занадто багато запитів (rate limit) |
| `500` | Помилка сервера |
| `503` | База даних недоступна |

### Приклад використання (Python)

```python
import requests

API = "https://yourdomain.com"

# Логін
r = requests.post(f"{API}/api/auth/login", json={
    "email": "user@example.com",
    "password": "password123"
})
token = r.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

# Підбір фільму
r = requests.post(f"{API}/api/pick", json={
    "type": "movie",
    "mood": "happy"
}, headers=headers)
print(r.json())

# Створити лобі для гри
r = requests.post(f"{API}/api/game/create-lobby", headers=headers)
lobby = r.json()
print(f"Код лобі: {lobby['lobby_code']}")
```

### Приклад використання (JavaScript)

```javascript
const API = 'https://yourdomain.com';
const token = 'your-token';
const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

// Підбір серіалу
const res = await fetch(`${API}/api/pick`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'tv', mood: 'excited' })
});
const data = await res.json();
console.log(data);
```

---

## ⚙️ Налаштування API ключів

### TMDB (фільми та серіали)

1. Зареєструйтесь на [themoviedb.org](https://www.themoviedb.org/signup)
2. Перейдіть в Settings → API → Request an API Key
3. Оберіть "Developer" → заповніть форму
4. Скопіюйте API Key (v3 auth)
5. Додайте в `.env`:

```env
TMDB_API_KEY=your_tmdb_api_key_here
```

### Google Books API

1. Перейдіть на [Google Cloud Console](https://console.cloud.google.com/)
2. Створіть проект або виберіть існуючий
3. Увімкніть Books API: APIs & Services → Library → Google Books API
4. Створіть API Key: APIs & Services → Credentials → Create Credentials → API Key
5. Додайте в `.env`:

```env
GOOGLE_BOOKS_API_KEY=your_google_books_api_key_here
```

### AI (Groq / OpenAI)

#### Groq (безкоштовний)
1. Зареєструйтесь на [console.groq.com](https://console.groq.com/)
2. Перейдіть в API Keys → Create API Key
3. Додайте в `.env`:

```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```

#### OpenAI (платний)
1. Зареєструйтесь на [platform.openai.com](https://platform.openai.com/)
2. Перейдіть в API Keys → Create new secret key
3. Додайте в `.env`:

```env
OPENAI_API_KEY=sk-your_openai_api_key_here
```
