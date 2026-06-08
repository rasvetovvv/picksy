# 🎬 PickForMe — Pick a movie, TV show, or book

> Don't know what to watch or read? Let AI pick for you in 5 seconds.

## Features

- 🤖 **AI search** — describe what you want and AI picks a movie, TV show, or book
- 🎬 **Movies** — TMDB API (full catalog, translations, posters, trailers)
- 📺 **TV shows** — TMDB TV API (same catalog, just for series)
- 📚 **Books** — free Google Books API (works without a key)
- 🧠 **Mood-based picks** — "light", "scary", "cozy", etc.
- 🎛 **Filters** — genre, year, rating, language, category
- 🎯 **"I don't know — pick for me"** — one button, no filters
- 🔁 **"More" button** — endless picks
- ❤ **Save** — three tabs (Movies / TV / Books)
- 🔐 **Sign-up** — optional, only for saving (email + password)
- 🌍 **Two languages** — Ukrainian and English with a toggle
- ✨ **Liquid Glass UI** — animated particles, glassmorphism, gradients
- 🐳 **Docker** — ready to run on any VPS

## Tech stack

| Component | Tech |
|-----------|------|
| Frontend | Vanilla JS, CSS3 (Liquid Glass) |
| Backend  | Python FastAPI |
| AI       | Groq (default) / OpenAI / any OpenAI-compatible provider |
| Movies + TV | TMDB API (free) |
| Books    | Google Books API (free, no key required) |
| Database | MySQL 8.0 |
| Deploy   | Docker + docker-compose |

## Quick start

### 1. Clone the repo

```bash
git clone https://github.com/rasvetovvv/pick-for-me.git
cd pick-for-me
```

### 2. Configure API keys

```bash
cp .env.example .env
nano .env    # or vim .env
```

**Where to put the keys** — in the `.env` file at the project root:

```env
# 🎬 + 📺 Movies and TV shows (TMDB)
TMDB_API_KEY=your_tmdb_key

# 📚 Books (Google Books) — optional, works without a key
GOOGLE_BOOKS_API_KEY=

# 🤖 AI search (Groq — fast and free)
AI_PROVIDER=groq
AI_API_KEY=your_groq_key
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.1-8b-instant
```

### Where to get the keys

| Key | Where | Free? |
|------|-------------|:---:|
| `TMDB_API_KEY` | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | ✅ yes, fully |
| `GOOGLE_BOOKS_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) | ✅ yes (optional — the API works without a key at a lower quota) |
| `AI_API_KEY` (Groq) | [console.groq.com/keys](https://console.groq.com/keys) | ✅ yes, very generous limit |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | ⚡ pay-as-you-go |

> ⚠ If you want OpenAI instead of Groq — set
> `AI_PROVIDER=openai`, `AI_BASE_URL=https://api.openai.com/v1`,
> `AI_MODEL=gpt-4o-mini` and put your key in `AI_API_KEY=sk-...`.

### Why Google Books?

- 📖 ~40 million books from all over the world
- 🖼 Covers, descriptions, authors, ratings
- 🌍 Support for almost every language (including Ukrainian)
- 💰 Fully free (with a key — higher quota)

### 3. Run it

```bash
docker compose up -d
```

Done! Open `http://localhost:7888`

### Without Docker

```bash
# Requires a separately running MySQL
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 7888
```

## Deploy to a VPS

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Clone and run
git clone https://github.com/rasvetovvv/pick-for-me.git
cd pick-for-me
cp .env.example .env
nano .env   # add your keys
docker compose up -d
```

Admin sanity-check command:
```bash
docker compose exec db mysql -u pickforme -ppickforme_pass pickforme \
  -e "SELECT * FROM user_stats; SELECT COUNT(*) FROM saved_movies; SELECT COUNT(*) FROM saved_tv; SELECT COUNT(*) FROM saved_books;"
```

## Project structure

```
.
├── backend/
│   ├── main.py            # FastAPI: TMDB (movies+TV), Google Books, AI, Auth
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js         # main tab logic (movies/tv/books)
│       ├── api.js         # backend requests
│       ├── auth.js        # login / sign-up / mini-profile
│       ├── config.js      # genres, moods, fallback posters
│       ├── demo.js        # demo data so it runs without a TMDB key
│       ├── i18n.js        # UA/EN translations
│       ├── particles.js   # background particles
│       └── ui.js          # UI rendering
├── database/
│   └── schema.sql         # MySQL schema (users, saved_movies, saved_tv, saved_books, user_stats)
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

## API endpoints

### Core
- `GET /api/health` — status, including whether keys are configured
- `GET /api/config` — public config + feature flags (trending, daily_pick, profiles, etc.)
- `GET /api/settings` — all public site settings

### Content
- `GET /api/movies/discover` — movie search (TMDB)
- `GET /api/movies/{id}/videos` — movie trailers
- `GET /api/tv/discover` — TV show search (TMDB)
- `GET /api/tv/{id}/videos` — TV show trailers
- `GET /api/books/discover` — book search (Google Books)
- `GET /api/books/search?q=...` — full-text book search
- `POST /api/ai-search` — AI pick (`type`: `movie` | `tv` | `book`)
- `GET /api/trending` — trending movies/TV (respects `trending_enabled`)
- `GET /api/daily-pick` — pick of the day (respects `daily_pick_enabled`)

### Auth
- `POST /api/auth/register` — sign-up (rate limited, email validation)
- `POST /api/auth/login` — login (rate limited)
- `GET /api/auth/me` — current user
- `POST /api/auth/change-password` — change password
- `DELETE /api/auth/account` — delete your own account

### Profile and saves
- `GET /api/profile` — stats and saved counters
- `POST /api/me/profile` — update profile
- `POST /api/me/username` — set username
- `GET /api/me/achievements` — achievements (respects `achievements_enabled`)
- `GET /api/me/streak` — pick streak
- `POST /api/stats/event` — increment `search` / `random` / `ai_search`
- `GET /api/favorites` — returns `{ movies, tv, books }`
- `POST /api/favorites/movie` / `DELETE /api/favorites/movie/{tmdb_id}`
- `POST /api/favorites/tv` / `DELETE /api/favorites/tv/{tmdb_id}`
- `POST /api/favorites/book` / `DELETE /api/favorites/book/{volume_id}`
- `POST /api/feedback` — feedback (respects `feedback_enabled`)

### Public pages
- `GET /u/{username}` — public profile (respects `public_profiles_enabled` and bans)
- `GET /movie/{id}` — movie share page
- `GET /tv/{id}` — TV share page
- `GET /book/{id}` — book share page

## Share links (`SITE_HOST`)

The "Share" button copies a personal link to the card:

```
https://picksy.my/movie/<tmdb_id>
https://picksy.my/tv/<tmdb_id>
https://picksy.my/book/<google_volume_id>
```

The backend serves a lightweight standalone HTML page with the poster,
rating, description, genres, and proper `og:image` / `twitter:card` so
previews render in Telegram, Discord, and elsewhere.

The domain is set via `SITE_HOST` in `.env`. Defaults to `picksy.my`.

## What's new in this version

- Fixed: turning off trending and daily picks in the admin panel now works correctly
- Fixed: disabling profiles shows a styled page instead of a 403 error
- Fixed: visiting a banned profile shows a proper message
- Fixed: AI search, achievements, and feedback now respect their feature flags
- Added: styled error pages (404, 403, 500, 429)
- Added: rate limiting for login/register endpoints
- Added: email validation on sign-up
- Added: password change (`POST /api/auth/change-password`)
- Added: self-service account deletion (`DELETE /api/auth/account`)
- Added: `/api/config` now returns feature flags for the frontend
- Improved: frontend hides trending/daily pick when disabled in settings
- Improved: movie/TV/book share pages use the styled error pages
- Cleaned up: removed duplicate files, improved `.gitignore`

## License

MIT
