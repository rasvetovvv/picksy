// Global type declarations for Picksy frontend

interface PickItem {
    id?: number | string;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    overview?: string;
    description?: string;
    release_date?: string;
    first_air_date?: string;
    vote_average?: number;
    rating?: string | number;
    genre_ids?: number[];
    poster_path?: string;
    poster?: string;
    year?: string | number;
    url?: string;
    author?: string;
    reason?: string;
    [key: string]: any;
}

interface SavedItem {
    poster: string;
    title: string;
    year: string | number;
    rating: string | number;
    url?: string;
    savedAt?: number;
    id?: number | string;
    [key: string]: any;
}

interface AuthUser {
    id: number;
    email: string;
    is_admin?: boolean;
    username?: string;
    display_name?: string;
    bio?: string;
    avatar_emoji?: string;
}

interface SiteSettings {
    [key: string]: any;
}

interface DonateProgress {
    goal: number;
    current: number;
    mono_url: string;
    coffee_url: string;
    patreon_url: string;
}

interface MoodItem {
    emoji: string;
    label: string;
    genres?: number[];
    subject?: string;
}

interface PickFilters {
    genre?: string;
    yearFrom?: string;
    yearTo?: string;
    rating?: string;
    country?: string;
    category?: string;
    keyword?: string;
    language?: string;
    subject?: string;
    query?: string;
    [key: string]: any;
}

interface GenreItem {
    id: number | string;
    name: string;
}
