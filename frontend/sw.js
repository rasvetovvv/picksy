// Bump this on every release that ships changed assets. The activate
// handler below uses it to evict every old picksy-v* and picksy-api-v*
// cache so users never get pinned to a stale build.
const CACHE_VERSION = 202;
const CACHE_NAME = 'picksy-v' + CACHE_VERSION;
const CACHE_NAME_PREFIX = 'picksy-v';
// Offline page is precached BOTH with and without the version query so it can
// be matched no matter how the browser requests it (direct nav, SW fallback,
// or query-stripped navigation).
const OFFLINE_URL_VERSIONED = '/offline.html?v=picksy-' + CACHE_VERSION;
const OFFLINE_URL_PLAIN = '/offline.html';
const OFFLINE_URL = OFFLINE_URL_VERSIONED;
const STATIC_ASSETS = [
    '/',
    OFFLINE_URL_VERSIONED,
    OFFLINE_URL_PLAIN,
    '/css/style.css?v=picksy-' + CACHE_VERSION,
    '/css/quiz.css?v=picksy-' + CACHE_VERSION,
    '/css/mascot.css?v=picksy-' + CACHE_VERSION,
    '/js/config.js?v=picksy-' + CACHE_VERSION,
    '/js/i18n.js?v=picksy-' + CACHE_VERSION,
    '/js/demo.js?v=picksy-' + CACHE_VERSION,
    '/js/api.js?v=picksy-' + CACHE_VERSION,
    '/js/ui.js?v=picksy-' + CACHE_VERSION,
    '/js/auth.js?v=picksy-' + CACHE_VERSION,
    '/js/mascot.js?v=picksy-' + CACHE_VERSION,
    '/js/app.js?v=picksy-' + CACHE_VERSION,
    '/js/particles.js?v=picksy-' + CACHE_VERSION,
    '/js/subscription.js?v=picksy-' + CACHE_VERSION,
    '/js/analytics.js?v=picksy-' + CACHE_VERSION,
    '/js/game.js?v=picksy-' + CACHE_VERSION,
    '/js/gestures.js?v=picksy-' + CACHE_VERSION,
    '/js/collections.js?v=picksy-' + CACHE_VERSION,
    '/js/gift.js?v=picksy-' + CACHE_VERSION,
    '/js/enhancements.js?v=picksy-' + CACHE_VERSION,
    '/js/extras.js?v=picksy-' + CACHE_VERSION,
    '/js/quiz.js?v=picksy-' + CACHE_VERSION,
    '/js/match.js?v=picksy-' + CACHE_VERSION,
    '/css/match.css?v=picksy-' + CACHE_VERSION,
    '/data/archetypes.json?v=picksy-' + CACHE_VERSION,
    '/data/quiz_questions.json?v=picksy-' + CACHE_VERSION,
    '/og-image.png',
    '/og/quiz.png',
    '/og/wordle.png',
    '/og/faq.png',
    '/og/explore.png',
    '/og/profile.png',
    '/og/gift.png',
    '/og/archetype-all.png',
    '/og/match.png',
    '/og/blog.png',
    '/og/default-blog.png',
    '/manifest.json',
    // Mascot SVGs — used by the auth modal (idle / thinking / happy / sad)
    // and the global mascot bubble. Precaching keeps the avatar usable
    // offline and avoids a flash of empty space on the first auth open.
    '/img/mascot/pix-default.svg',
    '/img/mascot/pix-thinking.svg',
    '/img/mascot/pix-happy.svg',
    '/img/mascot/pix-sad.svg',
    '/img/mascot/pix-surprised.svg',
];

const API_CACHE = 'picksy-api-v' + CACHE_VERSION;
const API_CACHE_PREFIX = 'picksy-api-v';
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => Promise.all(
                STATIC_ASSETS.map(url =>
                    cache.add(url).catch(err => console.warn('SW cache fail', url, err))
                )
            ))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    // Evict every prior versioned cache. The prefix check
                    // catches both static (picksy-vN) and API (picksy-api-vN)
                    // caches from older releases. Anything outside our two
                    // prefixes belongs to another origin's SW or a different
                    // app on the same scope — leave it alone.
                    .filter(key => (key.startsWith(CACHE_NAME_PREFIX) || key.startsWith(API_CACHE_PREFIX)) && key !== CACHE_NAME && key !== API_CACHE)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Allow the page to ask the SW to bump immediately (used by the in-app
// "new version available" toast and by analytics.js after a hard error).
self.addEventListener('message', (event) => {
    if (event && event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip cross-origin requests (fonts, images, external APIs)
    if (url.origin !== self.location.origin) return;

    // Helper: resolve the offline page from cache, regardless of how the URL
    // was originally cached (with or without the ?v=... query). If nothing is
    // cached at all (very early after install, or precache failure), return a
    // small synthetic HTML so the user always sees a Picksy-branded screen
    // instead of the native "no internet" page.
    const synthOffline = () => new Response(
        '<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Picksy — offline</title>' +
        '<style>html,body{margin:0;height:100%;background:#0a0a14;color:#fff;' +
        'font-family:system-ui,sans-serif;display:flex;align-items:center;' +
        'justify-content:center;text-align:center;padding:24px}' +
        '.b{background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;color:transparent;font-weight:900;font-size:1.2rem}' +
        'h1{font-size:1.4rem;margin:14px 0 6px}' +
        'p{opacity:.7;margin:0 0 18px;max-width:340px}' +
        'a{display:inline-block;padding:11px 22px;border-radius:12px;' +
        'background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;' +
        'text-decoration:none;font-weight:700}</style></head><body>' +
        '<div><div class="b">Picksy</div><h1>Немає інтернету</h1>' +
        '<p>Перевір з’єднання та спробуй ще раз.</p>' +
        '<a href="javascript:location.reload()">↻ Спробувати знову</a>' +
        '</div></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
    const matchOffline = () =>
        caches.match(OFFLINE_URL_VERSIONED)
            .then(o => o || caches.match(OFFLINE_URL_PLAIN, { ignoreSearch: true }))
            .then(o => o || caches.match('/offline.html', { ignoreSearch: true }))
            // Note: we deliberately do NOT fall back to caches.match('/') here.
            // The cached home page would render but is non-functional offline
            // (no API, no login, no picks) and confuses users. The synthetic
            // last-resort response below is preferable to a broken-looking
            // home page.
            .then(o => o || synthOffline());

    // Gift pages — always go to network, because the server renders a
    // dedicated, branded inline-CSS gift page at /gift/<token> (not the SPA
    // shell). Serving the cached `/` here used to render the homepage HTML
    // at the /gift/<token> URL, which broke the layout because the homepage
    // CSS/JS were referenced with relative paths that resolved to
    // /gift/css/... and 404'd. We keep a short timeout + offline fallback
    // so slow networks still show *something* instead of hanging.
    if (url.pathname.startsWith('/gift/')) {
        if (event.request.mode === 'navigate') {
            event.respondWith(
                Promise.race([
                    fetch(event.request),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
                ]).catch(() => matchOffline())
            );
        } else {
            event.respondWith(
                fetch(event.request).catch(() => caches.match(event.request))
            );
        }
        return;
    }

    // Description pages — always network-first (dynamic content per id)
    if (url.pathname.startsWith('/descmovie/') || url.pathname.startsWith('/desctv/') || url.pathname.startsWith('/descbook/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => response)
                .catch(() => matchOffline())
        );
        return;
    }

    // Workspace pages reuse the home app shell and then switch UI mode in JS.
    if (['/tracker', '/tracker/', '/notes', '/notes/', '/watchlist', '/watchlist/', '/saved', '/saved/', '/collections', '/collections/'].includes(url.pathname)) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request).then(cached => cached || caches.match('/').then(home => home || matchOffline())))
        );
        return;
    }

    // Compatibility match pages (/match/<token>) — always network-first (dynamic)
    if (url.pathname.startsWith('/match/') || url.pathname === '/match') {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then(response => response)
                .catch(() => matchOffline())
        );
        return;
    }

    // Public profile pages (/u/<username>) and dedicated DNA share pages
    // (/dna/<username>) — always network-first, no cache, so DNA/stats/badges
    // show changes immediately after the user updates them.
    if (url.pathname.startsWith('/u/') || url.pathname.startsWith('/dna/')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then(response => response)
                .catch(() => matchOffline())
        );
        return;
    }

    // Direct navigation to /offline.html should always work, even if the
    // browser doesn't include the version query.
    if (url.pathname === '/offline.html' || url.pathname === '/offline') {
        event.respondWith(
            fetch(event.request)
                .then(response => response)
                .catch(() => matchOffline())
        );
        return;
    }

    // Quiz funnel pages (/quiz, /archetype/*) — network-first with cache fallback.
    // The quiz can run offline because all questions and archetype data are
    // precached, so we keep the cached HTML as the offline experience here.
    if (url.pathname === '/quiz' || url.pathname === '/quiz/' || url.pathname.startsWith('/archetype/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request).then(cached => {
                    if (cached) return cached;
                    return caches.match('/quiz').then(q => q || matchOffline());
                }))
        );
        return;
    }

    // Quiz data (JSON) — stale-while-revalidate
    if (url.pathname.startsWith('/data/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                cache.match(event.request).then(cached => {
                    const fetchPromise = fetch(event.request).then(response => {
                        if (response.ok) cache.put(event.request, response.clone());
                        return response;
                    }).catch(() => cached);
                    return cached || fetchPromise;
                })
            )
        );
        return;
    }

    // API requests: network-first with cache fallback
    if (url.pathname.startsWith('/api/')) {
        // Don't cache auth, mutation, or gift-specific endpoints
        if (url.pathname.includes('/auth/') || url.pathname.includes('/admin/')) return;
        // NEVER intercept Server-Sent Events. The response body is an
        // infinite stream; piping the clone into Cache.put() never settles,
        // which holds the connection open and can stall page reloads (the
        // browser then appears "stuck" until a hard reload or incognito).
        if (url.pathname.startsWith('/api/live/stream')) return;

        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(API_CACHE).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Static assets / navigations: network-first with offline fallback.
    //
    // For NAVIGATIONS: when the network fetch fails (truly offline), we ALWAYS
    // show offline.html. We deliberately do NOT serve a stale cached HTML page
    // (e.g. cached '/'), because Picksy is API-driven — a cached home page
    // without working API/login/picks is misleading and confusing. Showing a
    // clear, branded "Немає інтернету" screen is better UX. (Quiz, profiles
    // and a few other branches above keep their own cached fallbacks where it
    // makes sense.)
    //
    // For SUB-RESOURCES (css/js/fonts/images): we still fall back to cache so
    // the offline page itself can render with full Picksy styling.
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                if (event.request.mode === 'navigate') {
                    return matchOffline();
                }
                return caches.match(event.request).then(cached => {
                    if (cached) return cached;
                    if (event.request.mode === 'navigate') {
                        return matchOffline();
                    }
                });
            })
    );
});
