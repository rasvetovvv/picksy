const API = {
    seenMovieIds: new Set(),
    seenTvIds: new Set(),
    seenBookIds: new Set(),
    movieCache: [],
    tvCache: [],
    bookCache: [],
    moviePage: 1,
    tvPage: 1,
    bookPage: 1,
    backendAvailable: null,
    hasApi: { tmdb: false, books: true },
    siteSettings: {},
    async checkBackend() {
        if (this.backendAvailable !== null)
            return this.backendAvailable;
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/config`);
            if (res.ok) {
                const data = await res.json();
                this.hasApi.tmdb = !!data.tmdb;
                this.hasApi.books = data.books !== false;
                this.siteSettings = data;
                this.backendAvailable = true;
                if (data.google_client_id && typeof Auth !== 'undefined') {
                    Auth.initGoogle(data.google_client_id);
                }
                return true;
            }
        }
        catch { }
        this.backendAvailable = false;
        return false;
    },
    get isDemo() {
        return !this.backendAvailable || (!this.hasApi.tmdb && !this.hasApi.books);
    },
    reset() {
        this.seenMovieIds.clear();
        this.seenTvIds.clear();
        this.seenBookIds.clear();
        this.movieCache = [];
        this.tvCache = [];
        this.bookCache = [];
        this.moviePage = 1;
        this.tvPage = 1;
        this.bookPage = 1;
    },
    // ─── Demo filters ───
    filterDemoMovies(filters) {
        let movies = [...(typeof DEMO_DATA !== 'undefined' ? DEMO_DATA.movies : [])];
        if (filters.genre) {
            const gids = String(filters.genre).split(',').map(Number);
            movies = movies.filter(m => m.genre_ids.some(g => gids.includes(g)));
        }
        if (filters.rating) {
            movies = movies.filter(m => m.vote_average >= parseFloat(filters.rating));
        }
        if (filters.yearFrom) {
            movies = movies.filter(m => {
                const y = m.release_date ? parseInt(m.release_date.split('-')[0]) : 0;
                return y >= parseInt(filters.yearFrom);
            });
        }
        if (filters.yearTo) {
            movies = movies.filter(m => {
                const y = m.release_date ? parseInt(m.release_date.split('-')[0]) : 9999;
                return y <= parseInt(filters.yearTo);
            });
        }
        return movies;
    },
    filterDemoTv(filters) {
        let shows = [...(typeof DEMO_DATA !== 'undefined' ? DEMO_DATA.tv : [])];
        if (filters.genre) {
            const gids = String(filters.genre).split(',').map(Number);
            shows = shows.filter(s => (s.genre_ids || []).some(g => gids.includes(g)));
        }
        if (filters.rating) {
            shows = shows.filter(s => s.vote_average >= parseFloat(filters.rating));
        }
        return shows;
    },
    filterDemoBooks(filters) {
        let books = [...(typeof DEMO_DATA !== 'undefined' ? DEMO_DATA.books : [])];
        if (filters.subject) {
            const sub = filters.subject.toLowerCase();
            books = books.filter(b => (b.categories || []).some(c => c.toLowerCase().includes(sub)));
        }
        if (filters.query) {
            const q = filters.query.toLowerCase();
            books = books.filter(b => (b.title || '').toLowerCase().includes(q) ||
                (b.authors || []).some(a => a.toLowerCase().includes(q)));
        }
        return books;
    },
    // ─── Movies ───
    async fetchMovies(filters = {}) {
        const params = new URLSearchParams({
            page: String(this.moviePage),
            lang: typeof I18N !== 'undefined' ? I18N.current : 'uk',
        });
        if (filters.genre)
            params.set('genre', filters.genre);
        if (filters.yearFrom)
            params.set('year_from', filters.yearFrom);
        if (filters.yearTo)
            params.set('year_to', filters.yearTo);
        if (filters.rating)
            params.set('rating', filters.rating);
        if (filters.country)
            params.set('country', filters.country);
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/movies/discover?${params}`);
            if (!res.ok)
                throw new Error(`API error: ${res.status}`);
            const data = await res.json();
            return data.results || [];
        }
        catch (err) {
            console.error('fetchMovies error:', err);
            return [];
        }
    },
    async getMovieVideos(movieId) {
        const lang = typeof I18N !== 'undefined' ? I18N.current : 'uk';
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/movies/${movieId}/videos?lang=${lang}`);
            if (!res.ok)
                return [];
            const data = await res.json();
            return data.results || [];
        }
        catch {
            return [];
        }
    },
    async pickMovie(filters = {}) {
        await this.checkBackend();
        if (!this.hasApi.tmdb) {
            const movies = this.filterDemoMovies(filters);
            if (movies.length === 0)
                return null;
            const unseen = movies.filter(m => !this.seenMovieIds.has(m.id));
            const pool = unseen.length > 0 ? unseen : movies;
            if (unseen.length === 0)
                this.seenMovieIds.clear();
            const pick = pool[Math.floor(Math.random() * pool.length)];
            this.seenMovieIds.add(pick.id);
            return pick;
        }
        if (this.movieCache.length === 0) {
            if (this.moviePage === 1)
                this.moviePage = Math.floor(Math.random() * 15) + 1;
            this.movieCache = await this.fetchMovies(filters);
            if (this.movieCache.length === 0) {
                this.moviePage = 1;
                this.movieCache = await this.fetchMovies(filters);
            }
            if (this.movieCache.length === 0)
                return null;
        }
        const unseen = this.movieCache.filter(m => !this.seenMovieIds.has(m.id));
        if (unseen.length === 0) {
            this.moviePage++;
            const oldCache = this.movieCache;
            this.movieCache = await this.fetchMovies(filters);
            if (this.movieCache.length === 0)
                this.movieCache = oldCache;
            const fresh = this.movieCache.filter(m => !this.seenMovieIds.has(m.id));
            if (fresh.length === 0) {
                this.seenMovieIds.clear();
            }
            const pool = this.movieCache.filter(m => !this.seenMovieIds.has(m.id));
            if (pool.length === 0)
                return this.movieCache.length > 0
                    ? this.movieCache[Math.floor(Math.random() * this.movieCache.length)]
                    : null;
            const pick = pool[Math.floor(Math.random() * pool.length)];
            this.seenMovieIds.add(pick.id);
            return pick;
        }
        const pick = unseen[Math.floor(Math.random() * unseen.length)];
        this.seenMovieIds.add(pick.id);
        return pick;
    },
    // ─── TV Series ───
    async fetchTv(filters = {}) {
        const params = new URLSearchParams({
            page: String(this.tvPage),
            lang: typeof I18N !== 'undefined' ? I18N.current : 'uk',
        });
        if (filters.genre)
            params.set('genre', filters.genre);
        if (filters.yearFrom)
            params.set('year_from', filters.yearFrom);
        if (filters.yearTo)
            params.set('year_to', filters.yearTo);
        if (filters.rating)
            params.set('rating', filters.rating);
        if (filters.country)
            params.set('country', filters.country);
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/tv/discover?${params}`);
            if (!res.ok)
                throw new Error(`API error: ${res.status}`);
            const data = await res.json();
            return data.results || [];
        }
        catch (err) {
            console.error('fetchTv error:', err);
            return [];
        }
    },
    async getTvVideos(tvId) {
        const lang = typeof I18N !== 'undefined' ? I18N.current : 'uk';
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/tv/${tvId}/videos?lang=${lang}`);
            if (!res.ok)
                return [];
            const data = await res.json();
            return data.results || [];
        }
        catch {
            return [];
        }
    },
    async pickTv(filters = {}) {
        await this.checkBackend();
        if (!this.hasApi.tmdb) {
            const shows = this.filterDemoTv(filters);
            if (shows.length === 0)
                return null;
            const unseen = shows.filter(s => !this.seenTvIds.has(s.id));
            const pool = unseen.length > 0 ? unseen : shows;
            if (unseen.length === 0)
                this.seenTvIds.clear();
            const pick = pool[Math.floor(Math.random() * pool.length)];
            this.seenTvIds.add(pick.id);
            return pick;
        }
        if (this.tvCache.length === 0) {
            if (this.tvPage === 1)
                this.tvPage = Math.floor(Math.random() * 12) + 1;
            this.tvCache = await this.fetchTv(filters);
            if (this.tvCache.length === 0) {
                this.tvPage = 1;
                this.tvCache = await this.fetchTv(filters);
            }
            if (this.tvCache.length === 0)
                return null;
        }
        const unseen = this.tvCache.filter(s => !this.seenTvIds.has(s.id));
        if (unseen.length === 0) {
            this.tvPage++;
            const oldCache = this.tvCache;
            this.tvCache = await this.fetchTv(filters);
            if (this.tvCache.length === 0)
                this.tvCache = oldCache;
            const fresh = this.tvCache.filter(s => !this.seenTvIds.has(s.id));
            if (fresh.length === 0) {
                this.seenTvIds.clear();
            }
            const pool = this.tvCache.filter(s => !this.seenTvIds.has(s.id));
            if (pool.length === 0)
                return this.tvCache.length > 0
                    ? this.tvCache[Math.floor(Math.random() * this.tvCache.length)]
                    : null;
            const pick = pool[Math.floor(Math.random() * pool.length)];
            this.seenTvIds.add(pick.id);
            return pick;
        }
        const pick = unseen[Math.floor(Math.random() * unseen.length)];
        this.seenTvIds.add(pick.id);
        return pick;
    },
    // ─── Books ───
    async fetchBooks(filters = {}) {
        const params = new URLSearchParams({ page: String(this.bookPage) });
        if (filters.subject)
            params.set('subject', filters.subject);
        if (filters.query)
            params.set('query', filters.query);
        if (filters.language)
            params.set('lang', filters.language);
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/books/discover?${params}`);
            if (!res.ok)
                throw new Error(`API error: ${res.status}`);
            const data = await res.json();
            return data.results || [];
        }
        catch (err) {
            console.error('fetchBooks error:', err);
            return [];
        }
    },
    async pickBook(filters = {}) {
        await this.checkBackend();
        if (!this.hasApi.books) {
            const books = this.filterDemoBooks(filters);
            if (books.length === 0)
                return null;
            const unseen = books.filter(b => !this.seenBookIds.has(b.id));
            const pool = unseen.length > 0 ? unseen : books;
            if (unseen.length === 0)
                this.seenBookIds.clear();
            const pick = pool[Math.floor(Math.random() * pool.length)];
            this.seenBookIds.add(pick.id);
            return pick;
        }
        if (this.bookCache.length === 0) {
            if (this.bookPage === 1)
                this.bookPage = Math.floor(Math.random() * 6) + 1;
            this.bookCache = await this.fetchBooks(filters);
            if (this.bookCache.length === 0) {
                this.bookPage = 1;
                this.bookCache = await this.fetchBooks(filters);
            }
            if (this.bookCache.length === 0)
                return null;
        }
        const unseen = this.bookCache.filter(b => !this.seenBookIds.has(b.id));
        if (unseen.length === 0) {
            this.bookPage++;
            const oldCache = this.bookCache;
            this.bookCache = await this.fetchBooks(filters);
            if (this.bookCache.length === 0)
                this.bookCache = oldCache;
            const fresh = this.bookCache.filter(b => !this.seenBookIds.has(b.id));
            if (fresh.length === 0) {
                this.seenBookIds.clear();
            }
            const pool = this.bookCache.filter(b => !this.seenBookIds.has(b.id));
            if (pool.length === 0)
                return this.bookCache.length > 0
                    ? this.bookCache[Math.floor(Math.random() * this.bookCache.length)]
                    : null;
            const pick = pool[Math.floor(Math.random() * pool.length)];
            this.seenBookIds.add(pick.id);
            return pick;
        }
        const pick = unseen[Math.floor(Math.random() * unseen.length)];
        this.seenBookIds.add(pick.id);
        return pick;
    },
    // ─── User: history & level stats (auth-only) ───
    _authHeaders() {
        const token = localStorage.getItem('pfm_token');
        return token ? { 'Authorization': `Bearer ${token}` } : null;
    },
    async logHistory(type, item) {
        if (!item)
            return;
        const auth = this._authHeaders();
        let payload;
        if (type === 'movie' || type === 'tv') {
            payload = {
                type,
                item_id: String(item.id),
                title: item.title || item.name || item.original_title || item.original_name || '—',
                poster: item.poster_path ? CONFIG.TMDB_IMG + item.poster_path : null,
                year: ((item.release_date || item.first_air_date) || '').split('-')[0] || null,
                rating: item.vote_average ? item.vote_average.toFixed(1) : null,
                item_url: type === 'movie'
                    ? `${window.location.origin}/descmovie/${item.id}`
                    : `${window.location.origin}/desctv/${item.id}`,
            };
        }
        else if (type === 'book') {
            payload = {
                type: 'book',
                item_id: String(item.id),
                title: item.title || '—',
                poster: item.poster || null,
                year: item.year || null,
                rating: item.rating || null,
                item_url: item.url || null,
            };
        }
        else {
            return;
        }
        // Always notify the live bar (anonymous & logged-in) so the
        // "last pick" chip updates instantly for every visitor, even guests.
        try {
            fetch(`${CONFIG.API_URL}/api/live/pick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: payload.title, type: payload.type }),
                keepalive: true,
            }).catch(() => { });
        }
        catch { }
        if (!auth)
            return;
        try {
            await fetch(`${CONFIG.API_URL}/api/me/history`, {
                method: 'POST',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }
        catch { }
    },
    async getHistory({ type = '', limit = 30, offset = 0 } = {}) {
        const auth = this._authHeaders();
        if (!auth)
            return { items: [], total: 0, limit, offset };
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        if (type)
            params.set('type', type);
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/me/history?${params}`, { headers: auth });
            if (!res.ok)
                return { items: [], total: 0, limit, offset };
            return await res.json();
        }
        catch {
            return { items: [], total: 0, limit, offset };
        }
    },
    async clearHistory() {
        const auth = this._authHeaders();
        if (!auth)
            return;
        try {
            await fetch(`${CONFIG.API_URL}/api/me/history`, { method: 'DELETE', headers: auth });
        }
        catch { }
    },
    async getMyStats() {
        const auth = this._authHeaders();
        if (!auth)
            return null;
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/me/stats`, { headers: auth });
            if (!res.ok)
                return null;
            return await res.json();
        }
        catch {
            return null;
        }
    },
    // ─── Detail Pages ───
    async getMovieDetails(movieId) {
        const lang = typeof I18N !== 'undefined' ? I18N.current : 'uk';
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/movies/${movieId}/details?lang=${lang}`);
            if (!res.ok)
                return null;
            return await res.json();
        }
        catch {
            return null;
        }
    },
    async getTvDetails(tvId) {
        const lang = typeof I18N !== 'undefined' ? I18N.current : 'uk';
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/tv/${tvId}/details?lang=${lang}`);
            if (!res.ok)
                return null;
            return await res.json();
        }
        catch {
            return null;
        }
    },
    async getBookDetails(volumeId) {
        const lang = typeof I18N !== 'undefined' ? I18N.current : 'uk';
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/books/${encodeURIComponent(volumeId)}/details?lang=${lang}`);
            if (!res.ok)
                return null;
            return await res.json();
        }
        catch {
            return null;
        }
    },
    async getCommunityRating(contentType, contentId) {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/community-rating/${contentType}/${contentId}`);
            if (!res.ok)
                return { average: 0, count: 0 };
            return await res.json();
        }
        catch {
            return { average: 0, count: 0 };
        }
    },
    async submitCommunityRating(contentType, contentId, rating) {
        const auth = this._authHeaders();
        if (!auth)
            return null;
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/community-rating`, {
                method: 'POST',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content_type: contentType, content_id: contentId, rating }),
            });
            if (!res.ok)
                return null;
            return await res.json();
        }
        catch {
            return null;
        }
    },
    async getReviews(contentType, contentId, limit = 20, offset = 0) {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/reviews/${contentType}/${contentId}?limit=${limit}&offset=${offset}`);
            if (!res.ok)
                return { reviews: [], total: 0 };
            return await res.json();
        }
        catch {
            return { reviews: [], total: 0 };
        }
    },
    async submitReview(contentType, contentId, reviewText, rating) {
        const auth = this._authHeaders();
        if (!auth)
            return null;
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/reviews`, {
                method: 'POST',
                headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content_type: contentType, content_id: contentId, review_text: reviewText, rating }),
            });
            if (!res.ok)
                return null;
            return await res.json();
        }
        catch {
            return null;
        }
    },
    async analyzeMood(text, contentType, lang) {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/ai-mood`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, type: contentType, lang }),
            });
            if (!res.ok)
                return null;
            return await res.json();
        }
        catch {
            return null;
        }
    },
};
//# sourceMappingURL=api.js.map