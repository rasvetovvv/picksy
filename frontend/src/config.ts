const CONFIG = {
    // Backend API URL — change this to your VPS address
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:7888'
        : window.location.origin,

    TMDB_IMG: 'https://image.tmdb.org/t/p/w500',

    MOVIE_GENRES: [
        { id: 28, name: 'Бойовик' },
        { id: 12, name: 'Пригоди' },
        { id: 16, name: 'Мультфільм' },
        { id: 35, name: 'Комедія' },
        { id: 80, name: 'Кримінал' },
        { id: 99, name: 'Документальний' },
        { id: 18, name: 'Драма' },
        { id: 10751, name: 'Сімейний' },
        { id: 14, name: 'Фентезі' },
        { id: 36, name: 'Історія' },
        { id: 27, name: 'Жахи' },
        { id: 10402, name: 'Музика' },
        { id: 9648, name: 'Детектив' },
        { id: 10749, name: 'Мелодрама' },
        { id: 878, name: 'Фантастика' },
        { id: 53, name: 'Трилер' },
        { id: 10752, name: 'Військовий' },
        { id: 37, name: 'Вестерн' },
    ],

    // TMDB TV genre IDs
    TV_GENRES: [
        { id: 10759, name: 'Бойовик і пригоди' },
        { id: 16,    name: 'Мультфільм' },
        { id: 35,    name: 'Комедія' },
        { id: 80,    name: 'Кримінал' },
        { id: 99,    name: 'Документальний' },
        { id: 18,    name: 'Драма' },
        { id: 10751, name: 'Сімейний' },
        { id: 10762, name: 'Дитячий' },
        { id: 9648,  name: 'Детектив' },
        { id: 10764, name: 'Реаліті' },
        { id: 10765, name: 'Фантастика' },
        { id: 10766, name: 'Мелодрама' },
        { id: 10767, name: 'Ток-шоу' },
        { id: 10768, name: 'Військовий' },
        { id: 37,    name: 'Вестерн' },
    ],

    // Google Books "subject" filters
    BOOK_SUBJECTS: [
        { id: 'fiction',          name: 'Художня література' },
        { id: 'mystery',          name: 'Детектив' },
        { id: 'thriller',         name: 'Трилер' },
        { id: 'romance',          name: 'Романтика' },
        { id: 'science fiction',  name: 'Наукова фантастика' },
        { id: 'fantasy',          name: 'Фентезі' },
        { id: 'horror',           name: 'Жахи' },
        { id: 'biography',        name: 'Біографія' },
        { id: 'history',          name: 'Історія' },
        { id: 'self-help',        name: 'Саморозвиток' },
        { id: 'business',         name: 'Бізнес' },
        { id: 'science',          name: 'Наука' },
        { id: 'philosophy',       name: 'Філософія' },
        { id: 'psychology',       name: 'Психологія' },
        { id: 'travel',           name: 'Подорожі' },
        { id: 'cooking',          name: 'Кулінарія' },
        { id: 'poetry',           name: 'Поезія' },
        { id: 'comics',           name: 'Комікси' },
        { id: 'young adult',      name: 'Для підлітків' },
        { id: 'children',         name: 'Дитячі' },
    ],

    MOVIE_MOODS: [
        { emoji: '😂', label: 'Посміятися', genres: [35] },
        { emoji: '😱', label: 'Страшне', genres: [27] },
        { emoji: '🤯', label: 'Вибух мозку', genres: [878, 9648] },
        { emoji: '💕', label: 'Романтика', genres: [10749] },
        { emoji: '🔥', label: 'Екшн', genres: [28] },
        { emoji: '😢', label: 'Поплакати', genres: [18] },
        { emoji: '🧘', label: 'Легке', genres: [35, 10751] },
        { emoji: '🌙', label: 'На вечір', genres: [53, 18] },
        { emoji: '👨‍👩‍👧‍👦', label: 'З родиною', genres: [10751, 16] },
        { emoji: '🎭', label: 'Класика', genres: [18, 36] },
        { emoji: '😭', label: 'Хочу поплакати', genres: [18, 10749] },
        { emoji: '💑', label: 'Для побачення', genres: [10749, 35] },
        { emoji: '😴', label: 'Не можу заснути', genres: [99, 18, 10751] },
        { emoji: '⚡', label: 'Адреналін', genres: [28, 53] },
    ],

    TV_MOODS: [
        { emoji: '😂', label: 'Комедія',         genres: [35] },
        { emoji: '🔥', label: 'Екшн',            genres: [10759] },
        { emoji: '🕵️', label: 'Детектив',        genres: [9648, 80] },
        { emoji: '🚀', label: 'Фантастика',      genres: [10765] },
        { emoji: '🎭', label: 'Драма',           genres: [18] },
        { emoji: '👨‍👩‍👧‍👦', label: 'Сімейний',  genres: [10751] },
        { emoji: '📰', label: 'Документальний',  genres: [99] },
        { emoji: '🎬', label: 'Мультфільм',     genres: [16] },
        { emoji: '🤠', label: 'Вестерн',         genres: [37] },
        { emoji: '🎤', label: 'Реаліті',         genres: [10764] },
        { emoji: '😭', label: 'Хочу поплакати', genres: [18] },
        { emoji: '💑', label: 'Для побачення', genres: [35, 18] },
        { emoji: '😴', label: 'Не можу заснути', genres: [99, 10751] },
        { emoji: '⚡', label: 'Адреналін', genres: [10759] },
    ],

    BOOK_MOODS: [
        { emoji: '🕵️', label: 'Детектив',     subject: 'mystery' },
        { emoji: '💕', label: 'Романтика',    subject: 'romance' },
        { emoji: '🚀', label: 'Фантастика',   subject: 'science fiction' },
        { emoji: '🐉', label: 'Фентезі',      subject: 'fantasy' },
        { emoji: '😱', label: 'Жахи',          subject: 'horror' },
        { emoji: '🏛️', label: 'Історія',      subject: 'history' },
        { emoji: '🧠', label: 'Саморозвиток', subject: 'self-help' },
        { emoji: '💼', label: 'Бізнес',       subject: 'business' },
        { emoji: '📜', label: 'Біографія',    subject: 'biography' },
        { emoji: '🎓', label: 'Наука',        subject: 'science' },
        { emoji: '😭', label: 'Хочу поплакати', subject: 'drama' },
        { emoji: '💑', label: 'Для побачення', subject: 'romance' },
        { emoji: '😴', label: 'Не можу заснути', subject: 'meditation' },
        { emoji: '⚡', label: 'Адреналін', subject: 'thriller' },
    ],

    FALLBACK_POSTER: 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" fill="%230a0a1a">' +
        '<rect width="300" height="450"/>' +
        '<text x="150" y="215" fill="%23333" font-family="sans-serif" font-size="60" text-anchor="middle">🎬</text>' +
        '<text x="150" y="260" fill="%23444" font-family="sans-serif" font-size="14" text-anchor="middle">No Poster</text>' +
        '</svg>'
    ),

    FALLBACK_TV_POSTER: 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" fill="%230a0a1a">' +
        '<rect width="300" height="450"/>' +
        '<text x="150" y="215" fill="%23333" font-family="sans-serif" font-size="60" text-anchor="middle">📺</text>' +
        '<text x="150" y="260" fill="%23444" font-family="sans-serif" font-size="14" text-anchor="middle">No Poster</text>' +
        '</svg>'
    ),

    FALLBACK_BOOK_POSTER: 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" fill="%230a0a1a">' +
        '<rect width="300" height="450"/>' +
        '<text x="150" y="215" fill="%23333" font-family="sans-serif" font-size="60" text-anchor="middle">📚</text>' +
        '<text x="150" y="260" fill="%23444" font-family="sans-serif" font-size="14" text-anchor="middle">No Cover</text>' +
        '</svg>'
    ),
};
