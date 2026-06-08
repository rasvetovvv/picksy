// @ts-nocheck
const App = {
    currentTab: 'movies',
    currentMood: null,
    currentItem: null,
    currentType: null, // 'movie' | 'tv' | 'book'
    savedMovies: [],
    savedTv: [],
    savedBooks: [],
    watchedMovies: JSON.parse(localStorage.getItem('picksy_watched_movies') || '[]'),
    watchedTv: JSON.parse(localStorage.getItem('picksy_watched_tv') || '[]'),
    watchedBooks: JSON.parse(localStorage.getItem('picksy_watched_books') || '[]'),
    savedTab: 'movies',
    savedCategory: 'watchlist',
    hideSeen: JSON.parse(localStorage.getItem('picksy_hide_seen') || 'false'),
    guestPickCount: parseInt(localStorage.getItem('picksy_guest_picks') || '0'),
    GUEST_PICK_LIMIT: 6,
    trackerGoal: parseInt(localStorage.getItem('picksy_tracker_goal') || '8'),
    notes: JSON.parse(localStorage.getItem('picksy_notes') || '[]'),
    pageMode: 'home',

    async init() {
        UI.init();
        Particles.init();
        this.bindEvents();
        Auth.init();

        I18N.applyAll();
        UI.renderMoods(I18N.getMovieMoods());
        UI.populateYears();
        this.sortWatchedNewestFirst();
        this.updateSavedUI();
        this.initTracker();
        this.initNotes();
        this.initTheme();
        this.initMobileNav();
        this.initWorkspaceRouting();
        this.initHomeExperience();
        this.handleUrlRoute();

        await API.checkBackend();
        if (typeof Subscription !== 'undefined') Subscription.init();
        if (typeof Analytics !== 'undefined') Analytics.init();
        this.updateAiSuggestions();
        this.initScrollTop();
        this.initGuestPicksBadge();
        this.initScrollProgress();
        this.initDoubleClickSave();
        if (typeof Game !== 'undefined') Game.init();
        if (typeof Collections !== 'undefined') Collections.init();
        this.initCookieConsent();
        this.initLiveBar();
        this.initBrandQuoteRotation();
    },

    initHomeExperience() {
        if ((this as any)._homeExperienceInitialized) return;
        const main = document.querySelector('.main-content');
        const liveBar = document.getElementById('live-bar');
        if (!main || !liveBar) return;
        (this as any)._homeExperienceInitialized = true;

        const pickerShell = document.createElement('section');
        pickerShell.id = 'home-picker-shell';
        pickerShell.className = 'home-picker-shell';
        pickerShell.innerHTML = `
            <div class="home-picker-intro">
                <div>
                    <span class="home-section-kicker" data-i18n="homePickerKicker">${I18N.t('homePickerKicker')}</span>
                    <h2 data-i18n="homePickerTitle">${I18N.t('homePickerTitle')}</h2>
                    <p data-i18n="homePickerDesc">${I18N.t('homePickerDesc')}</p>
                </div>
                <button class="home-live-open" type="button" title="${I18N.t('liveBarOpenTitle')}" data-i18n-title="liveBarOpenTitle">
                    <span class="home-live-open-signal" aria-hidden="true"></span>
                    <span class="home-live-open-copy">
                        <strong data-i18n="homeLiveOpen">${I18N.t('homeLiveOpen')}</strong>
                        <small id="home-live-open-status">LIVE</small>
                    </span>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </button>
            </div>
            <div class="home-picker-grid"></div>
        `;
        const pickerGrid = pickerShell.querySelector('.home-picker-grid');
        const methodStep = document.createElement('div');
        methodStep.className = 'home-picker-step-row home-picker-method-step';
        methodStep.innerHTML = `
            <span class="home-picker-step-number">1</span>
            <span>
                <small data-i18n="homeMethodStep">${I18N.t('homeMethodStep')}</small>
                <strong data-i18n="homeMethodTitle">${I18N.t('homeMethodTitle')}</strong>
                <em data-i18n="homeMethodDesc">${I18N.t('homeMethodDesc')}</em>
            </span>
        `;
        pickerGrid?.appendChild(methodStep);
        [
            document.getElementById('ai-section'),
            document.getElementById('mood-section'),
        ].forEach(node => {
            if (node) pickerGrid?.appendChild(node);
        });
        const actionStep = document.createElement('div');
        actionStep.className = 'home-picker-step-row home-picker-action-step';
        actionStep.innerHTML = `
            <span class="home-picker-step-number">2</span>
            <span>
                <small data-i18n="homeActionStep">${I18N.t('homeActionStep')}</small>
                <strong data-i18n="homeActionTitle">${I18N.t('homeActionTitle')}</strong>
                <em data-i18n="homeActionDesc">${I18N.t('homeActionDesc')}</em>
            </span>
        `;
        pickerGrid?.appendChild(actionStep);
        [
            document.getElementById('filters-section'),
            document.querySelector('.pick-section'),
            document.querySelector('.hide-seen-toggle'),
            document.getElementById('result-section'),
        ].forEach(node => {
            if (node) pickerGrid?.appendChild(node);
        });
        const dailyPick = document.getElementById('daily-pick-section');
        if (dailyPick) {
            dailyPick.classList.add('home-daily-feature');
            liveBar.insertAdjacentElement('beforebegin', dailyPick);
        }
        liveBar.insertAdjacentElement('afterend', pickerShell);

        pickerShell.querySelector('.home-live-open')?.addEventListener('click', () => {
            this.openRecentPicksModal('all');
        });
        const homeLiveStatus = pickerShell.querySelector('#home-live-open-status');
        const liveOnline = document.getElementById('live-online');
        const syncHomeLiveStatus = () => {
            if (homeLiveStatus && liveOnline?.textContent?.trim()) {
                homeLiveStatus.textContent = liveOnline.textContent.trim();
            }
        };
        syncHomeLiveStatus();
        if (liveOnline) {
            new MutationObserver(syncHomeLiveStatus).observe(liveOnline, {
                childList: true,
                characterData: true,
                subtree: true,
            });
        }

        const nowShell = document.createElement('section');
        nowShell.id = 'home-now-shell';
        nowShell.className = 'home-now-shell';
        nowShell.innerHTML = `<div class="home-now-grid"></div>`;
        const nowGrid = nowShell.querySelector('.home-now-grid');
        [document.getElementById('trending-section')].forEach(node => {
            if (node) nowGrid?.appendChild(node);
        });
        pickerShell.insertAdjacentElement('afterend', nowShell);

        const workspace = document.getElementById('workspace-nav-section');
        if (workspace) nowShell.insertAdjacentElement('afterend', workspace);

        const playShell = document.createElement('section');
        playShell.id = 'home-play-shell';
        playShell.className = 'home-play-shell';
        playShell.innerHTML = `
            <div class="home-section-heading">
                <div>
                    <span class="home-section-kicker" data-i18n="homePlayKicker">${I18N.t('homePlayKicker')}</span>
                    <h2 data-i18n="homePlayTitle">${I18N.t('homePlayTitle')}</h2>
                </div>
                <a href="/quizzes" data-workspace-link="quizzes" data-i18n="homePlayAll">${I18N.t('homePlayAll')}</a>
            </div>
            <div class="home-play-grid"></div>
        `;
        const playGrid = playShell.querySelector('.home-play-grid');
        [
            document.getElementById('quiz-cta-banner'),
            document.getElementById('match-cta-banner'),
            document.getElementById('wordle-cta-banner'),
        ].forEach(node => {
            if (node) playGrid?.appendChild(node);
        });
        workspace?.insertAdjacentElement('afterend', playShell);
    },

    // Rotate the footer brand quote every ~9 seconds with a soft fade.
    // Pulls quotes from I18N.brandQuotes for the active language.
    initBrandQuoteRotation() {
        const el = document.getElementById('brand-quote');
        if (!el || el.dataset.rotateInit === '1') return;
        el.dataset.rotateInit = '1';
        const getQuotes = () => {
            try {
                const lang = (I18N && I18N.current) || 'uk';
                const arr = (I18N as any)?.translations?.[lang]?.brandQuotes;
                if (Array.isArray(arr) && arr.length > 0) return arr;
            } catch (_) {}
            return null;
        };
        let idx = 0;
        try {
            const initial = getQuotes();
            if (initial && initial.length > 1) {
                idx = Math.floor(Math.random() * initial.length);
                el.textContent = initial[idx];
            }
        } catch (_) {}
        setInterval(() => {
            const quotes = getQuotes();
            if (!quotes || quotes.length < 2) return;
            if (document.hidden) return;
            idx = (idx + 1) % quotes.length;
            el.classList.add('is-fading');
            setTimeout(() => {
                el.textContent = quotes[idx];
                el.classList.remove('is-fading');
            }, 350);
        }, 9000);
    },

    handleUrlRoute() {
        // Detail pages are now served at /descmovie/:id, /desctv/:id, /descbook/:id
        // as full server-rendered pages, so no client-side routing needed for them.
        this.applyPageMode();
    },

    getPageMode() {
        const rawPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
        const path = rawPath.toLowerCase();
        const queryMode = new URLSearchParams(window.location.search).get('page');
        const mode = (queryMode || '').toLowerCase();
        if (['tracker', 'notes', 'watchlist', 'saved', 'collections', 'quizzes'].includes(mode)) {
            return mode === 'saved' ? 'watchlist' : mode;
        }
        if (path === '/tracker') return 'tracker';
        if (path === '/notes') return 'notes';
        if (path === '/watchlist' || path === '/saved') return 'watchlist';
        if (path === '/collections') return 'collections';
        if (path === '/quizzes') return 'quizzes';
        return 'home';
    },

    applyPageMode() {
        const mode = this.getPageMode();
        this.pageMode = mode;
        document.body.dataset.pageMode = mode;

        const pageHero = document.getElementById('app-page-hero');
        const pageTitle = document.getElementById('app-page-title');
        const pageDesc = document.getElementById('app-page-desc');

        const meta = {
            tracker: { title: 'workspaceTrackerTitle', desc: 'workspaceTrackerDesc', nav: 'tracker' },
            notes: { title: 'workspaceNotesTitle', desc: 'workspaceNotesDesc', nav: 'notes' },
            watchlist: { title: 'workspaceWatchlistTitle', desc: 'workspaceWatchlistDesc', nav: 'saved' },
            collections: { title: 'workspaceCollectionsTitle', desc: 'workspaceCollectionsDesc', nav: 'saved' },
            quizzes: { title: 'workspaceQuizzesTitle', desc: 'workspaceQuizzesDesc', nav: 'pick' },
        }[mode];

        if (!meta) {
            pageHero?.classList.add('hidden');
            this._setMobileNavActive('pick');
            this.updateDesktopWorkspaceNav('home');
            this.updateMobileNavForMode('home');
            return;
        }

        pageHero?.classList.remove('hidden');
        if (pageTitle) pageTitle.textContent = I18N.t(meta.title);
        if (pageDesc) pageDesc.textContent = I18N.t(meta.desc);
        document.title = `${I18N.t(meta.title)} — Picksy`;
        this._setMobileNavActive(meta.nav);
        this.updateDesktopWorkspaceNav(mode);
        this.updateMobileNavForMode(mode);

        if (mode === 'watchlist') {
            this.savedCategory = 'watchlist';
            document.querySelectorAll('.saved-cat-tab').forEach(tab => {
                (tab as HTMLElement).classList.toggle('active', (tab as HTMLElement).dataset.cat === 'watchlist');
            });
            const statsEl = document.getElementById('watched-stats');
            if (statsEl) statsEl.classList.add('hidden');
            const body = document.getElementById('saved-body');
            if (body) body.classList.remove('hidden');
            this.renderSaved();
        }

        if (mode === 'tracker' || mode === 'notes') {
            this.updateTrackerUI();
        }

        if (mode === 'collections') {
            const collBody = document.getElementById('collections-body');
            if (collBody) collBody.classList.remove('hidden');
            const collSection = document.getElementById('collections-section');
            if (collSection) collSection.style.removeProperty('display');
            try {
                if (typeof Collections !== 'undefined') {
                    if (!Collections._initialized) Collections.init();
                    if (typeof Collections.render === 'function') Collections.render();
                }
            } catch (e) { /* ignore */ }
        }

        if (mode === 'notes') {
            setTimeout(() => (document.getElementById('tracker-note') as HTMLTextAreaElement | null)?.focus(), 250);
            this.renderNotes();
        }

        if (mode !== 'home') {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }
    },

    WORKSPACE_ROUTES: {
        home: '/',
        tracker: '/tracker',
        notes: '/notes',
        watchlist: '/watchlist',
        collections: '/collections',
        quizzes: '/quizzes',
    } as Record<string, string>,

    navigateWorkspace(mode: string) {
        const path = this.WORKSPACE_ROUTES[mode] || '/';
        if (this.getPageMode() === mode) return false;
        history.pushState({ picksyPage: mode }, '', path);
        this.applyPageMode();
        return true;
    },

    initWorkspaceRouting() {
        if ((this as any)._workspaceRoutingBound) return;
        (this as any)._workspaceRoutingBound = true;

        window.addEventListener('popstate', () => {
            this.applyPageMode();
        });

        window.addEventListener('pageshow', (e) => {
            if ((e as PageTransitionEvent).persisted) this.applyPageMode();
        });

        document.querySelectorAll('a.workspace-nav-card[href], a[data-workspace-link][href]').forEach((link) => {
            link.addEventListener('click', (e) => {
                const href = ((link as HTMLAnchorElement).getAttribute('href') || '').replace(/\/+$/, '') || '/';
                const modeMap: Record<string, string> = {
                    '/': 'home',
                    '/tracker': 'tracker',
                    '/notes': 'notes',
                    '/watchlist': 'watchlist',
                    '/saved': 'watchlist',
                    '/collections': 'collections',
                    '/quizzes': 'quizzes',
                };
                const mode = modeMap[href];
                if (!mode) return;
                e.preventDefault();
                this.navigateWorkspace(mode);
            });
        });

        document.querySelector('.app-page-back')?.addEventListener('click', (e) => {
            if (this.getPageMode() === 'home') return;
            e.preventDefault();
            this.navigateWorkspace('home');
        });
    },

    updateDesktopWorkspaceNav(mode: string) {
        const normalized = mode === 'saved' ? 'watchlist' : mode;
        document.querySelectorAll('[data-workspace-link]').forEach((link) => {
            const key = (link as HTMLElement).dataset.workspaceLink || '';
            (link as HTMLElement).classList.toggle('active', key === normalized);
        });
    },

    initTheme() {
        const saved = localStorage.getItem('picksy_theme') || 'black';
        this.applyTheme(saved === 'dark' ? 'black' : saved);
        document.querySelectorAll('.theme-btn[data-theme]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.applyTheme((btn as HTMLElement).dataset.theme || 'black');
            });
        });
    },

    applyTheme(theme: string) {
        const safe = ['black', 'light', 'purple'].includes(theme) ? theme : 'black';
        document.body.dataset.theme = safe;
        document.documentElement.dataset.theme = safe;
        localStorage.setItem('picksy_theme', safe);
        document.querySelectorAll('.theme-btn[data-theme]').forEach((btn) => {
            (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.theme === safe);
        });
    },

    // ─── AI prompt + mood pools (shuffled per page-load) ───
    AI_PROMPT_POOLS: {
        uk: {
            movies: {
                placeholder: 'Наприклад: фільм про подорожі у часі з неочікуваним фіналом',
                chips: [
                    { text: '😂 Легке на вечір', query: 'легкий смішний фільм на вечір без напруги' },
                    { text: '🤯 Крутий сюжет', query: 'фільм з сильним сюжетом і несподіваним фіналом' },
                    { text: '😱 Не спати вночі', query: 'страшний напружений фільм щоб не спати вночі' },
                    { text: '💕 Романтика', query: 'романтичний фільм з красивою історією кохання' },
                    { text: '🚀 Сай-фай', query: 'розумний науково-фантастичний фільм з ідеями' },
                    { text: '🕵️ Детектив', query: 'затишний детектив з розслідуванням і харизматичним героєм' },
                    { text: '🎬 Шедевр', query: 'визнаний шедевр який варто подивитись хоча б раз у житті' },
                    { text: '🥷 Бойовик', query: 'крутий бойовик з постановочними бійками і трюками' },
                    { text: '🎩 Біографія', query: 'надихаюча біографія реальної людини' },
                    { text: '🍿 Сімейне', query: 'тепле сімейне кіно для перегляду усією сім\'єю' },
                    { text: '🧠 Думати', query: 'інтелектуальний фільм що змушує думати про сенс життя' },
                    { text: '🎨 Артхаус', query: 'красивий артхаусний фільм з нестандартним візуальним стилем' },
                    { text: '🌌 Космос', query: 'фільм про космос великі відкриття і експедиції' },
                    { text: '⏳ Епоха', query: 'історична драма з духом своєї епохи' },
                    { text: '🎵 Музика', query: 'фільм про музикантів з потужним саундтреком' },
                ],
            },
            tv: {
                placeholder: 'Наприклад: серіал про детективів у похмурому місті',
                chips: [
                    { text: '😂 Комедія', query: 'легкий смішний серіал на вечір з гарними діалогами' },
                    { text: '🕵️ Детектив', query: 'напружений детективний серіал з заплутаним розслідуванням' },
                    { text: '🚀 Фантастика', query: 'фантастичний серіал з глибоким сюжетом і ідеями' },
                    { text: '🎭 Драма', query: 'якісний драматичний серіал з сильними персонажами' },
                    { text: '👑 Костюмний', query: 'епічний історичний серіал у дусі Шогуна або Корони' },
                    { text: '😱 Хорор', query: 'містичний серіал з містичною атмосферою й моторошним сюжетом' },
                    { text: '🤖 Кіберпанк', query: 'технологічний серіал у стилі кіберпанку чи Black Mirror' },
                    { text: '⚖️ Юристи', query: 'серіал про адвокатів і складні судові справи' },
                    { text: '🏥 Медичний', query: 'медичний серіал про лікарів і складні випадки' },
                    { text: '🐉 Фентезі', query: 'епічне фентезі з власним світом і магією' },
                    { text: '👮 Кримінал', query: 'кримінальний серіал про мафію або картелі' },
                    { text: '🍿 Без напруги', query: 'легкий комфортний серіал щоб дивитись фоном' },
                    { text: '👨‍👩‍👧 Сімейка', query: 'сімейний серіал з душевною атмосферою' },
                    { text: '⚽ Спорт', query: 'мотивуючий серіал про спорт і командний дух' },
                    { text: '🌎 Подорожі', query: 'документальний серіал про подорожі та відкриття' },
                ],
            },
            books: {
                placeholder: 'Наприклад: фантастика з філософським підтекстом або затишний детектив',
                chips: [
                    { text: '🕵️ Детектив', query: 'захопливий детектив із заплутаною загадкою' },
                    { text: '🚀 Фантастика', query: 'розумна наукова фантастика повна ідей' },
                    { text: '🐉 Фентезі', query: 'епічне фентезі з власним повноцінним світом' },
                    { text: '🧠 Саморозвиток', query: 'мотивуюча книга про саморозвиток і звички' },
                    { text: '💼 Бізнес', query: 'практична книга про бізнес стартапи й управління' },
                    { text: '💕 Романтика', query: 'романтична книга з красивою історією кохання' },
                    { text: '📜 Історія', query: 'захоплива нон-фікшн книга про історію' },
                    { text: '🧘 Психологія', query: 'книга про психологію і розуміння себе' },
                    { text: '🥲 Драма', query: 'життєва драма з глибокими емоціями' },
                    { text: '😱 Трилер', query: 'напружений трилер з твістом у фіналі' },
                    { text: '🪐 Космос', query: 'наукова книга про космос і Всесвіт' },
                    { text: '🍳 Кулінарія', query: 'надихаюча книга про їжу і кулінарію' },
                    { text: '🎨 Мистецтво', query: 'книга про мистецтво або біографія художника' },
                    { text: '🌱 Філософія', query: 'філософська книга що змінює погляд на життя' },
                    { text: '🦄 Молодіжна', query: 'молодіжна YA книга з яскравими героями' },
                ],
            },
        },
        en: {
            movies: {
                placeholder: 'Example: a time travel movie with an unexpected ending',
                chips: [
                    { text: '😂 Light evening', query: 'a light funny movie for the evening with no stress' },
                    { text: '🤯 Great plot', query: 'a movie with a strong plot and unexpected ending' },
                    { text: '😱 Sleepless night', query: 'a scary tense movie to keep me awake at night' },
                    { text: '💕 Romance', query: 'a romantic movie with a beautiful love story' },
                    { text: '🚀 Sci-fi', query: 'a smart science fiction movie full of ideas' },
                    { text: '🕵️ Mystery', query: 'a cozy detective film with a charming sleuth' },
                    { text: '🎬 Masterpiece', query: 'a recognized masterpiece worth watching at least once' },
                    { text: '🥷 Action', query: 'an action movie with great fight choreography and stunts' },
                    { text: '🎩 Biopic', query: 'an inspiring biography of a real person' },
                    { text: '🍿 Family', query: 'a warm family movie for the whole family to watch together' },
                    { text: '🧠 Thoughtful', query: 'an intellectual movie that makes me think about life' },
                    { text: '🎨 Arthouse', query: 'a beautiful arthouse film with unusual visual style' },
                    { text: '🌌 Space', query: 'a movie about space exploration and big discoveries' },
                    { text: '⏳ Period piece', query: 'a historical drama with the feel of its era' },
                    { text: '🎵 Music', query: 'a movie about musicians with a powerful soundtrack' },
                ],
            },
            tv: {
                placeholder: 'Example: a detective TV series set in a gritty city',
                chips: [
                    { text: '😂 Comedy', query: 'a light funny TV comedy for the evening with great dialogue' },
                    { text: '🕵️ Mystery', query: 'a tense detective series with a tangled investigation' },
                    { text: '🚀 Sci-Fi', query: 'a sci-fi series with a deep plot and big ideas' },
                    { text: '🎭 Drama', query: 'a high-quality drama series with strong characters' },
                    { text: '👑 Period', query: 'an epic historical series in the spirit of Shogun or The Crown' },
                    { text: '😱 Horror', query: 'a mystical series with eerie atmosphere and a creepy story' },
                    { text: '🤖 Cyberpunk', query: 'a tech-heavy series in the spirit of Black Mirror or cyberpunk' },
                    { text: '⚖️ Legal', query: 'a series about lawyers and complex courtroom cases' },
                    { text: '🏥 Medical', query: 'a medical series about doctors and tough cases' },
                    { text: '🐉 Fantasy', query: 'an epic fantasy with its own world and magic system' },
                    { text: '👮 Crime', query: 'a crime series about the mafia or cartels' },
                    { text: '🍿 Easy watch', query: 'a light comfortable series to watch as background' },
                    { text: '👨‍👩‍👧 Family', query: 'a family series with a heartfelt atmosphere' },
                    { text: '⚽ Sports', query: 'a motivating series about sports and team spirit' },
                    { text: '🌎 Travel', query: 'a documentary series about travel and discovery' },
                ],
            },
            books: {
                placeholder: 'Example: thoughtful sci-fi with philosophy, or a cozy mystery',
                chips: [
                    { text: '🕵️ Mystery', query: 'a gripping mystery novel with a tangled puzzle' },
                    { text: '🚀 Sci-Fi', query: 'smart science fiction full of ideas' },
                    { text: '🐉 Fantasy', query: 'epic fantasy with a fully realized world' },
                    { text: '🧠 Self-Help', query: 'a motivating book about self-improvement and habits' },
                    { text: '💼 Business', query: 'a practical book about business startups and management' },
                    { text: '💕 Romance', query: 'a romance novel with a beautiful love story' },
                    { text: '📜 History', query: 'a captivating non-fiction book about history' },
                    { text: '🧘 Psychology', query: 'a book about psychology and understanding yourself' },
                    { text: '🥲 Drama', query: 'a literary drama full of deep emotion' },
                    { text: '😱 Thriller', query: 'a tense thriller with a final twist' },
                    { text: '🪐 Space', query: 'a popular science book about space and the universe' },
                    { text: '🍳 Cooking', query: 'an inspiring book about food and cooking' },
                    { text: '🎨 Art', query: 'a book about art or a biography of an artist' },
                    { text: '🌱 Philosophy', query: 'a philosophy book that changes how you see life' },
                    { text: '🦄 YA', query: 'a young-adult novel with vibrant characters' },
                ],
            },
        },
    } as any,
    AI_MOOD_POOLS: {
        uk: [
            { id: 'chill',      text: '😌 Чілл',        query: 'розслаблено й спокійно для відпочинку' },
            { id: 'adrenaline', text: '⚡ Адреналін',   query: 'динамічно з адреналіном і екшном' },
            { id: 'think',      text: '🧠 Подумати',    query: 'що змушує думати з глибоким сенсом' },
            { id: 'cry',        text: '😢 Поплакати',   query: 'емоційне зворушливе до сліз' },
            { id: 'nostalgia',  text: '🕰️ Ностальгія',  query: 'класичне для теплої ностальгії' },
            { id: 'cozy',       text: '☕ Затишно',     query: 'затишне домашнє щоб закутатись у плед' },
            { id: 'epic',       text: '🏔️ Епічно',      query: 'епічне масштабне з великими ставками' },
            { id: 'weird',      text: '🌀 Дивне',       query: 'дивне сюрреалістичне нестандартне' },
            { id: 'feelgood',   text: '🌞 Підняти настрій', query: 'позитивне щоб підняти настрій' },
            { id: 'dark',       text: '🌑 Похмуре',     query: 'похмуре серйозне з темною атмосферою' },
            { id: 'romantic',   text: '💞 Закоханий',   query: 'романтичне з історією кохання' },
            { id: 'mind',       text: '🤯 Зірвати дах', query: 'з твістом який зірве дах у фіналі' },
            { id: 'feelyoung',  text: '🛹 Молодіжне',   query: 'молодіжне з яскравими емоціями' },
            { id: 'comfort',    text: '🧸 Перегляд №2', query: 'перевірене щоб передивитись з задоволенням' },
        ],
        en: [
            { id: 'chill',      text: '😌 Chill',        query: 'relaxing and calm for resting' },
            { id: 'adrenaline', text: '⚡ Adrenaline',   query: 'dynamic adrenaline-fueled action' },
            { id: 'think',      text: '🧠 Think',        query: 'thought-provoking with deep meaning' },
            { id: 'cry',        text: '😢 Cry it out',   query: 'emotional touching tear-jerker' },
            { id: 'nostalgia',  text: '🕰️ Nostalgia',    query: 'a classic for warm nostalgia' },
            { id: 'cozy',       text: '☕ Cozy',         query: 'cozy and homely something to curl up with' },
            { id: 'epic',       text: '🏔️ Epic',         query: 'epic large-scale with huge stakes' },
            { id: 'weird',      text: '🌀 Weird',        query: 'weird surreal off-the-wall' },
            { id: 'feelgood',   text: '🌞 Feel-good',    query: 'positive feel-good mood booster' },
            { id: 'dark',       text: '🌑 Dark',         query: 'dark serious with grim atmosphere' },
            { id: 'romantic',   text: '💞 In love',      query: 'romantic with a love story' },
            { id: 'mind',       text: '🤯 Mind-blowing', query: 'with a twist that blows your mind in the finale' },
            { id: 'feelyoung',  text: '🛹 Youthful',     query: 'youthful with vivid emotions' },
            { id: 'comfort',    text: '🧸 Rewatch',      query: 'a tried-and-true comfort rewatch' },
        ],
    } as any,
    _aiChipIndices: null as number[] | null,
    _aiMoodIndices: null as number[] | null,
    _initAiPoolIndices() {
        const shuffle = (n: number) => {
            const arr = Array.from({ length: n }, (_, i) => i);
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        };
        if (!this._aiChipIndices) this._aiChipIndices = shuffle(30);
        if (!this._aiMoodIndices) this._aiMoodIndices = shuffle(30);
    },
    _pickFromPool(pool: any[], indices: number[], count: number) {
        const out: any[] = [];
        const seen = new Set<string>();
        for (const i of indices) {
            const idx = i % pool.length;
            const item = pool[idx];
            if (!item) continue;
            const key = String(item.text || item.id || idx);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(item);
            if (out.length >= count) break;
        }
        return out;
    },
    updateAiSuggestions() {
        this._initAiPoolIndices();
        const input = document.getElementById('ai-input') as HTMLTextAreaElement | null;
        const chips = document.querySelectorAll('.ai-chip');
        const lang = (typeof I18N !== 'undefined' && I18N.current) ? I18N.current : 'uk';
        const pools = this.AI_PROMPT_POOLS;
        const locale = pools[lang] ? lang : 'uk';
        const tab = pools[locale][this.currentTab] ? this.currentTab : 'movies';
        const data = pools[locale][tab];
        if (input) input.placeholder = data.placeholder;
        const selected = this._pickFromPool(data.chips, this._aiChipIndices!, chips.length || 4);
        chips.forEach((chip: any, index: number) => {
            const item = selected[index];
            if (!item) return;
            chip.textContent = item.text;
            chip.dataset.q = item.query;
        });
        this.updateAiMoods();
    },
    updateAiMoods() {
        this._initAiPoolIndices();
        const container = document.getElementById('ai-mood-options');
        if (!container) return;
        const lang = (typeof I18N !== 'undefined' && I18N.current) ? I18N.current : 'uk';
        const pool = this.AI_MOOD_POOLS[lang] || this.AI_MOOD_POOLS.uk;
        const selected = this._pickFromPool(pool, this._aiMoodIndices!, 5);
        container.innerHTML = selected.map((m: any) => (
            `<button class="ai-mood-option" data-mood="${m.id}" data-q="${m.query.replace(/"/g, '"')}">${m.text}</button>`
        )).join('');
    },

    async addStatsEvent(event) {
        if (!Auth.token) return;
        try {
            await fetch(`${CONFIG.API_URL}/api/stats/event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
                body: JSON.stringify({ event }),
            });
        } catch {
            // stats are best-effort
        }
    },

    async syncFavorites() {
        if (!Auth.token) return;
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/favorites`, {
                headers: Auth.getAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.movies) this.savedMovies = data.movies;
                if (data.tv) this.savedTv = data.tv;
                if (data.books) this.savedBooks = data.books;
                this.updateSavedUI();
            }
        } catch {
            // server sync optional
        }
    },

    async saveMovieToServer(movie) {
        if (!Auth.token) return;
        try {
            await fetch(`${CONFIG.API_URL}/api/favorites/movie`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
                body: JSON.stringify({
                    tmdb_id: movie.id,
                    title: movie.title,
                    poster: movie.poster,
                    year: movie.year,
                    rating: movie.rating,
                    tmdb_url: movie.url || null,
                }),
            });
        } catch {}
    },

    async removeMovieFromServer(tmdbId) {
        if (!Auth.token) return;
        try {
            await fetch(`${CONFIG.API_URL}/api/favorites/movie/${tmdbId}`, {
                method: 'DELETE', headers: Auth.getAuthHeaders(),
            });
        } catch {}
    },

    async saveTvToServer(tv) {
        if (!Auth.token) return;
        try {
            await fetch(`${CONFIG.API_URL}/api/favorites/tv`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
                body: JSON.stringify({
                    tmdb_id: tv.id,
                    title: tv.title,
                    poster: tv.poster,
                    year: tv.year,
                    rating: tv.rating,
                    tmdb_url: tv.url || null,
                }),
            });
        } catch {}
    },

    async removeTvFromServer(tmdbId) {
        if (!Auth.token) return;
        try {
            await fetch(`${CONFIG.API_URL}/api/favorites/tv/${tmdbId}`, {
                method: 'DELETE', headers: Auth.getAuthHeaders(),
            });
        } catch {}
    },

    async saveBookToServer(book) {
        if (!Auth.token) return;
        try {
            await fetch(`${CONFIG.API_URL}/api/favorites/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
                body: JSON.stringify({
                    volume_id: book.id,
                    title: book.title,
                    poster: book.poster,
                    year: book.year,
                    rating: book.rating,
                    book_url: book.url || null,
                }),
            });
        } catch {}
    },

    async removeBookFromServer(volumeId) {
        if (!Auth.token) return;
        try {
            await fetch(`${CONFIG.API_URL}/api/favorites/book/${encodeURIComponent(volumeId)}`, {
                method: 'DELETE', headers: Auth.getAuthHeaders(),
            });
        } catch {}
    },

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openPickerTab(btn.dataset.tab));
        });

        UI.els.moodGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.mood-btn');
            if (!btn) return;
            const idx = parseInt(btn.dataset.index);
            if (this.currentMood === idx) {
                this.currentMood = null;
                UI.clearMood();
            } else {
                this.currentMood = idx;
                UI.setActiveMood(idx);
            }
            API.reset();
        });

        UI.els.filtersToggle.addEventListener('click', () => UI.toggleFilters());

        document.getElementById('reset-filters').addEventListener('click', (e) => {
            e.stopPropagation();
            this.resetFilters();
        });

        UI.els.movieRating.addEventListener('input', (e) => {
            UI.els.movieRatingVal.textContent = e.target.value;
        });
        if (UI.els.tvRating) {
            UI.els.tvRating.addEventListener('input', (e) => {
                UI.els.tvRatingVal.textContent = e.target.value;
            });
        }

        const filterEls = [
            UI.els.movieGenre, UI.els.movieYearFrom, UI.els.movieYearTo,
            UI.els.movieRating, UI.els.movieCountry,
            UI.els.tvGenre, UI.els.tvYearFrom, UI.els.tvYearTo,
            UI.els.tvRating, UI.els.tvCountry,
            UI.els.bookSubject, UI.els.bookLanguage,
        ].filter(Boolean);
        filterEls.forEach(el => el.addEventListener('change', () => API.reset()));

        if (UI.els.bookQuery) {
            UI.els.bookQuery.addEventListener('input', () => API.reset());
        }

        UI.els.pickBtn.addEventListener('click', () => this.pick());
        UI.els.luckyBtn.addEventListener('click', () => this.pickLucky());
        UI.els.moreBtn.addEventListener('click', () => this.pick());
        UI.els.saveBtn.addEventListener('click', async () => await this.toggleSave());
        UI.els.shareBtn.addEventListener('click', () => this.share());
        UI.els.trailerBtn.addEventListener('click', () => this.showTrailer());
        document.getElementById('watched-btn').addEventListener('click', () => this.markAsWatched());
        document.getElementById('result-note-btn')?.addEventListener('click', () => this.focusResultNote());
        document.getElementById('result-note-save')?.addEventListener('click', () => this.addNoteFromCurrentResult());
        document.getElementById('result-note-clear')?.addEventListener('click', () => {
            const input = document.getElementById('result-note-input') as HTMLTextAreaElement | null;
            if (input) input.value = '';
        });

        document.getElementById('link-btn').addEventListener('click', () => this.openLink());
        document.getElementById('detail-btn')?.addEventListener('click', () => {
            if (this.currentItem) this.goToDetailPage(this.currentItem, this.currentType);
        });
        // Make poster clickable to open detail page
        document.getElementById('result-poster')?.addEventListener('click', () => {
            if (this.currentItem) this.goToDetailPage(this.currentItem, this.currentType);
        });
        document.getElementById('result-poster')?.addEventListener('mouseenter', function() { this.style.cursor = 'pointer'; });
        document.getElementById('result-title')?.addEventListener('click', () => {
            if (this.currentItem) this.goToDetailPage(this.currentItem, this.currentType);
        });
        document.getElementById('result-title')?.addEventListener('mouseenter', function() { this.style.cursor = 'pointer'; });
        // Make entire result card clickable (except buttons)
        document.getElementById('result-card')?.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.result-actions')) return;
            if (this.currentItem) this.goToDetailPage(this.currentItem, this.currentType);
        });
        // Detail modal close
        document.getElementById('detail-overlay')?.addEventListener('click', () => this.closeDetailPage());
        document.getElementById('detail-close')?.addEventListener('click', () => this.closeDetailPage());

        UI.els.savedToggle.addEventListener('click', () => UI.toggleSaved());

        document.querySelectorAll('.saved-cat-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.saved-cat-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.activateSavedCategory(tab.dataset.cat);
                this.renderSaved();
            });
        });

        document.querySelectorAll('.saved-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.saved-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.savedTab = tab.dataset.saved;
                this.renderSaved();
            });
        });

        UI.els.savedList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.saved-item-remove');
            if (removeBtn) {
                this.removeSaved(parseInt(removeBtn.dataset.index));
                return;
            }
            const moveBtn = e.target.closest('.saved-item-move');
            if (moveBtn) {
                this.moveToWatched(parseInt(moveBtn.dataset.index));
                return;
            }
            const rateBtn = e.target.closest('.saved-item-rate');
            if (rateBtn) {
                this.showRatingModal(parseInt(rateBtn.dataset.index));
                return;
            }
            const completeBtn = e.target.closest('.saved-complete-btn');
            if (completeBtn) {
                this.toggleWatchedComplete(parseInt(completeBtn.dataset.index));
                return;
            }
            const linkBtn = e.target.closest('.saved-item-link');
            if (linkBtn) {
                e.preventDefault();
                const itemEl = e.target.closest('.saved-item');
                if (itemEl) {
                    const idx = parseInt(itemEl.dataset.index);
                    const items = this.getActiveSavedList();
                    const item = items[idx];
                    const type = this.getSavedTabType();
                    if (item) {
                        this.goToDetailPage(item, type);
                        return;
                    }
                }
                if (linkBtn.dataset.url) window.location.href = linkBtn.dataset.url;
                return;
            }
            const noteBtn = e.target.closest('.saved-item-note');
            if (noteBtn) {
                this.addNoteFromSavedIndex(parseInt(noteBtn.dataset.index));
                return;
            }
            // Click on poster or title to open detail page
            const posterEl = e.target.closest('.saved-item-poster');
            const titleEl = e.target.closest('.saved-item-title');
            if (posterEl || titleEl) {
                const itemEl = e.target.closest('.saved-item');
                if (itemEl) {
                    const idx = parseInt(itemEl.dataset.index);
                    const items = this.getActiveSavedList();
                    const item = items[idx];
                    if (item) {
                        const type = this.getSavedTabType();
                        this.goToDetailPage(item, type);
                    }
                }
            }
        });

        UI.els.savedList.addEventListener('change', (e) => {
            const input = e.target.closest('.saved-progress-input');
            if (!input) return;
            this.updateWatchedProgress(
                parseInt(input.dataset.index),
                input.dataset.field || '',
                parseInt(input.value || '0') || 0
            );
        });

        // Rating modal
        document.getElementById('rating-overlay').addEventListener('click', () => this.hideRatingModal());
        document.getElementById('rating-close').addEventListener('click', () => this.hideRatingModal());
        document.getElementById('rating-save-btn').addEventListener('click', () => this.saveRating());

        // Movie Night
        document.getElementById('movie-night-btn').addEventListener('click', () => this.openMovieNight());
        document.getElementById('movie-night-overlay').addEventListener('click', () => this.closeMovieNight());
        document.getElementById('movie-night-close').addEventListener('click', () => this.closeMovieNight());

        document.getElementById('duo-btn')?.addEventListener('click', () => this.openDuo());
        document.getElementById('duo-overlay')?.addEventListener('click', () => this.closeDuo());
        document.getElementById('duo-close')?.addEventListener('click', () => this.closeDuo());

        UI.els.modalOverlay.addEventListener('click', () => UI.hideTrailerModal());
        UI.els.modalClose.addEventListener('click', () => UI.hideTrailerModal());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                UI.hideTrailerModal();
                this.hideRatingModal();
                this.closeMovieNight();
                this.closeDuo();
                this.closeDetailPage();
                document.getElementById('auth-modal').classList.add('hidden');
                document.body.classList.remove('modal-open');
            }
        });

        document.getElementById('ai-search-btn').addEventListener('click', () => this.aiSearch());
        document.getElementById('ai-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.aiSearch();
            }
        });

        document.querySelectorAll('.ai-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.getElementById('ai-input').value = chip.dataset.q;
                this.aiSearch();
            });
        });

        // Mood AI text analysis
        document.getElementById('mood-ai-btn')?.addEventListener('click', () => this.analyzeMoodText());
        document.getElementById('mood-ai-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.analyzeMoodText();
            }
        });

        const hideSeenCb = document.getElementById('hide-seen-checkbox');
        if (hideSeenCb) {
            hideSeenCb.checked = this.hideSeen;
            hideSeenCb.addEventListener('change', () => {
                this.hideSeen = hideSeenCb.checked;
                localStorage.setItem('picksy_hide_seen', JSON.stringify(this.hideSeen));
            });
        }

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                I18N.setLang(btn.dataset.lang);
            });
        });

        // Whenever the language changes (from the lang-btn handler above OR
        // from anywhere else that calls I18N.setLang), re-render every piece
        // of dynamic UI that builds its text in JS rather than via
        // [data-i18n] attributes. This avoids the "translation only kicks in
        // after a full page reload" bug.
        document.addEventListener('picksy:langchange', () => {
            try {
                UI.renderMoods(this.getMoodsForTab(this.currentTab));
                if (this.currentMood !== null) UI.setActiveMood(this.currentMood);
            } catch (e) { /* ignore */ }
            try { this.updateAiSuggestions(); } catch (e) { /* ignore */ }
            try { this.renderSaved(); } catch (e) { /* ignore */ }
            try { this.updateWatchedStats(); } catch (e) { /* ignore */ }
            try { this.updateTrackerUI(); } catch (e) { /* ignore */ }
            try { this.applyPageMode(); } catch (e) { /* ignore */ }
            // Re-apply tier gates (re-renders the locked-banner copy in the
            // current language).
            try {
                if (typeof Subscription !== 'undefined' && typeof Subscription.applyTierGates === 'function') {
                    Subscription.applyTierGates();
                }
            } catch (e) { /* ignore */ }
            // Re-render any extras already built (DNA, Psycho, Zodiac, recs).
            try {
                if (typeof Extras !== 'undefined') {
                    if (typeof Extras.renderDNA === 'function' && document.getElementById('dna-host')) Extras.renderDNA();
                    if (typeof Extras.renderPsycho === 'function' && document.getElementById('psycho-host')) Extras.renderPsycho();
                    if (typeof Extras.renderZodiac === 'function' && document.getElementById('zodiac-host')) Extras.renderZodiac();
                }
            } catch (e) { /* ignore */ }
            // Collections list (cards + tabs build text in JS).
            try {
                if (typeof Collections !== 'undefined' && typeof Collections.render === 'function') {
                    Collections.render();
                }
            } catch (e) { /* ignore */ }
            // Trending strip (titles use raw API data, but the empty/loading
            // states are localized in JS).
            try {
                if (typeof this.loadTrending === 'function') {
                    this.loadTrending(this.currentTab || 'movies');
                }
            } catch (e) { /* ignore */ }
            // Public-link CTA / username block use I18N.t() at render time.
            try {
                const uname = (Auth?.user?.username) || '';
                if (uname && typeof this.showPublicLink === 'function') {
                    this.showPublicLink(uname);
                }
            } catch (e) { /* ignore */ }
            // Profile achievements (icons/labels translated in JS).
            try {
                if (typeof Auth !== 'undefined' && typeof (Auth as any).renderProfileBadges === 'function') {
                    (Auth as any).renderProfileBadges({ user: Auth.user });
                }
            } catch (e) { /* ignore */ }
        });

        // Hero CTA
        const heroCta = document.getElementById('hero-cta-btn');
        if (heroCta) {
            heroCta.addEventListener('click', () => {
                document.getElementById('pick-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => this.pick(), 400);
            });
        }

        // AI Mood Picker
        const aiMoodOptions = document.getElementById('ai-mood-options');
        if (aiMoodOptions) {
            aiMoodOptions.addEventListener('click', (e) => {
                const btn = (e.target as HTMLElement).closest('.ai-mood-option');
                if (!btn) return;
                aiMoodOptions.querySelectorAll('.ai-mood-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const q = (btn as HTMLElement).dataset.q;
                if (q) {
                    (document.getElementById('ai-input') as HTMLTextAreaElement).value = q;
                    this.aiSearch();
                }
            });
        }
    },

    getMoodsForTab(tab) {
        if (tab === 'tv') return I18N.getTvMoods();
        if (tab === 'books') return I18N.getBookMoods();
        return I18N.getMovieMoods();
    },

    resetFilters() {
        UI.els.movieGenre.value = '';
        UI.els.movieYearFrom.value = '';
        UI.els.movieYearTo.value = '';
        UI.els.movieRating.value = '0';
        UI.els.movieRatingVal.textContent = '0';
        UI.els.movieCountry.value = '';

        if (UI.els.tvGenre) UI.els.tvGenre.value = '';
        if (UI.els.tvYearFrom) UI.els.tvYearFrom.value = '';
        if (UI.els.tvYearTo) UI.els.tvYearTo.value = '';
        if (UI.els.tvRating) {
            UI.els.tvRating.value = '0';
            UI.els.tvRatingVal.textContent = '0';
        }
        if (UI.els.tvCountry) UI.els.tvCountry.value = '';

        if (UI.els.bookSubject) UI.els.bookSubject.value = '';
        if (UI.els.bookQuery) UI.els.bookQuery.value = '';
        if (UI.els.bookLanguage) UI.els.bookLanguage.value = '';

        this.currentMood = null;
        UI.clearMood();
        API.reset();
        UI.showToast(I18N.t('filtersReset'));
    },

    openPickerTab(tab) {
        if (!tab) return;
        if (this.getPageMode() !== 'home') {
            history.pushState({ picksyPage: 'home' }, '', '/');
            this.applyPageMode();
            setTimeout(() => {
                this.switchTab(tab);
                document.getElementById('ai-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 40);
            return;
        }
        this.switchTab(tab);
    },

    switchTab(tab) {
        if (this.currentTab === tab) return;

        const animSections = [
            document.getElementById('ai-section'),
            document.getElementById('mood-section'),
            document.getElementById('filters-section'),
            document.getElementById('result-section'),
        ].filter(Boolean);

        animSections.forEach(s => {
            s.classList.remove('tab-pane');
            s.classList.add('tab-pane-exit');
        });

        setTimeout(() => {
            this.currentTab = tab;
            this.currentMood = null;
            API.reset();

            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tab);
            });

            UI.switchFilters(tab);
            UI.clearMood();
            UI.renderMoods(this.getMoodsForTab(tab));
            UI.els.resultSection.classList.add('hidden');
            UI.els.trailerBtn.classList.toggle('hidden', tab === 'books');
            this.updateAiSuggestions();
            this.loadDailyPick(tab);
            this.loadTrending(tab);

            animSections.forEach(s => {
                s.classList.remove('tab-pane-exit');
                s.classList.add('tab-pane');
            });
        }, 80);
    },

    getFilters() {
        if (this.currentTab === 'movies') {
            const moods = CONFIG.MOVIE_MOODS;
            let genre = UI.els.movieGenre.value;
            if (this.currentMood !== null && moods[this.currentMood]) {
                // Use OR (pipe) so multi-genre moods match movies in ANY of
                // the genres — not the intersection. TMDB treats `,` as AND
                // and `|` as OR; e.g. Адреналін [Action, Thriller] should
                // return Action OR Thriller, not movies that are both.
                genre = moods[this.currentMood].genres.join('|');
            }
            return {
                genre,
                yearFrom: UI.els.movieYearFrom.value,
                yearTo: UI.els.movieYearTo.value,
                rating: parseFloat(UI.els.movieRating.value) || undefined,
                country: UI.els.movieCountry.value,
            };
        }
        if (this.currentTab === 'tv') {
            const moods = CONFIG.TV_MOODS;
            let genre = UI.els.tvGenre ? UI.els.tvGenre.value : '';
            if (this.currentMood !== null && moods[this.currentMood]) {
                genre = moods[this.currentMood].genres.join('|');
            }
            return {
                genre,
                yearFrom: UI.els.tvYearFrom ? UI.els.tvYearFrom.value : '',
                yearTo: UI.els.tvYearTo ? UI.els.tvYearTo.value : '',
                rating: UI.els.tvRating ? (parseFloat(UI.els.tvRating.value) || undefined) : undefined,
                country: UI.els.tvCountry ? UI.els.tvCountry.value : '',
            };
        }
        // books
        const moods = CONFIG.BOOK_MOODS;
        let subject = UI.els.bookSubject ? UI.els.bookSubject.value : '';
        if (this.currentMood !== null && moods[this.currentMood]) {
            subject = moods[this.currentMood].subject;
        }
        let safeUrl = '';
        try {
            if (item.url) {
                const parsed = new URL(item.url, window.location.origin);
                safeUrl = `${parsed.pathname}${parsed.search || ''}`;
            }
        } catch (_) {}
        return {
            subject,
            query: UI.els.bookQuery ? UI.els.bookQuery.value.trim() : '',
            language: UI.els.bookLanguage ? UI.els.bookLanguage.value : '',
        };
    },

    getItemUrl(item, type) {
        const url = this._getDetailUrl(item, type);
        return url ? `${window.location.origin}${url}` : null;
    },

    getShareUrl(item, type) {
        const base = window.location.origin;
        if (type === 'movie' && item.id) return `${base}/movie/${item.id}`;
        if (type === 'tv' && item.id) return `${base}/tv/${item.id}`;
        if (type === 'book' && item.id) return `${base}/book/${encodeURIComponent(item.id)}`;
        return this.getItemUrl(item, type) || base;
    },

    _checkGuestLimit() {
        if (Auth.user) return true;
        if (this.guestPickCount >= this.GUEST_PICK_LIMIT) {
            UI.showToast(I18N.t('guestLimitReached'));
            Auth.showModal('register');
            return false;
        }
        return true;
    },

    _incrementGuestPick() {
        if (Auth.user) return;
        this.guestPickCount++;
        localStorage.setItem('picksy_guest_picks', String(this.guestPickCount));
        this._updateGuestBadge();
        if (this.guestPickCount >= this.GUEST_PICK_LIMIT - 1 && this.guestPickCount < this.GUEST_PICK_LIMIT) {
            UI.showToast(I18N.t('guestLimitWarning'));
        }
    },

    async _enrichPickWithDetails(item: any, type: string) {
        if (!item || !item.id) return;
        try {
            if (type === 'movie' && (item.runtime === undefined || item.runtime === null || item.runtime === 0)) {
                const details = await API.getMovieDetails(item.id);
                if (details) {
                    if (details.runtime) item.runtime = details.runtime;
                }
            } else if (type === 'tv' && (!item.number_of_seasons && !item.number_of_episodes && !(item.episode_run_time && item.episode_run_time.length))) {
                const details = await API.getTvDetails(item.id);
                if (details) {
                    if (details.number_of_seasons) item.number_of_seasons = details.number_of_seasons;
                    if (details.number_of_episodes) item.number_of_episodes = details.number_of_episodes;
                    if (details.episode_run_time && details.episode_run_time.length) item.episode_run_time = details.episode_run_time;
                }
            } else if (type === 'book' && !item.page_count) {
                const details = await API.getBookDetails(item.id);
                if (details && details.page_count) item.page_count = details.page_count;
            }
        } catch { /* keep going even if enrichment fails */ }
    },

    async pick() {
        if (!this._checkGuestLimit()) return;
        if (typeof Subscription !== 'undefined' && !Subscription.canPick()) {
            UI.showToast('Ви вичерпали ліміт підборів. Оновіть план для необмежених підборів!');
            Subscription.showUpgradeModal();
            return;
        }
        this.addStatsEvent('search');
        const filters = this.getFilters();
        // Pass the active tab so the mascot picks a context-aware loading
        // line — "Читаю синопсиси…" for movies vs "Розгортаю сезони…" for
        // series, etc. The mascot normalizes movies/tv/books internally.
        UI.showLoading(I18N.t('loading'), this.currentTab);

        const maxRetries = this.hideSeen ? 5 : 1;
        try {
            let item = null;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                if (this.currentTab === 'movies') {
                    item = await API.pickMovie(filters);
                    this.currentType = 'movie';
                } else if (this.currentTab === 'tv') {
                    item = await API.pickTv(filters);
                    this.currentType = 'tv';
                } else {
                    item = await API.pickBook(filters);
                    this.currentType = 'book';
                }

                if (!item) break;
                if (!this.hideSeen || !this.isItemSaved(item, this.currentType)) break;
                item = null;
            }

            if (!item) {
                UI.showToast(I18N.t('notFound'));
                UI.hideLoading();
                return;
            }

            // Enrich with runtime / seasons / episodes data so the small pick
            // card matches the detailed page. Discover endpoints don't return
            // these fields, so we fetch them from the details endpoint.
            await this._enrichPickWithDetails(item, this.currentType);

            this.currentItem = item;
            UI.showResult(item, this.currentType);
            this.syncResultNotePanel();
            UI.updateSaveBtn(this.isItemSaved(item, this.currentType));
            UI.updateLinkBtn(this.getItemUrl(item, this.currentType));
            API.logHistory(this.currentType, item);
            this._incrementGuestPick();
            if (typeof Subscription !== 'undefined') {
                Subscription.picksToday++;
                Subscription.renderBadge();
            }
            if (typeof Analytics !== 'undefined') Analytics.trackPick(this.currentType, item.title || '');
            // Show the (now 4-slide) onboarding once, AFTER the first successful pick.
            if (typeof Enhancements !== 'undefined' && Enhancements.maybeShowAfterFirstPick)
                Enhancements.maybeShowAfterFirstPick();
        } catch (err) {
            console.error('Pick error:', err);
            UI.showToast(I18N.t('loadError'));
        }

        UI.hideLoading();
    },

    async pickLucky() {
        if (!this._checkGuestLimit()) return;
        this.addStatsEvent('random');
        this.resetFilters();
        API.reset();
        if (this.currentTab === 'movies') {
            API.moviePage = Math.floor(Math.random() * 20) + 1;
        } else if (this.currentTab === 'tv') {
            API.tvPage = Math.floor(Math.random() * 12) + 1;
        } else {
            API.bookPage = Math.floor(Math.random() * 6) + 1;
        }
        await this.pick();
    },

    _aiRetryCount: 0,
    async aiSearch() {
        if (!this._checkGuestLimit()) return;
        if (typeof Subscription !== 'undefined' && !Subscription.canUseAI()) {
            UI.showToast('AI пошук доступний для Premium та Pro. Оновіть план!');
            Subscription.showUpgradeModal();
            return;
        }
        const query = document.getElementById('ai-input').value.trim();
        if (!query) {
            UI.showToast(I18N.t('aiEmpty'));
            return;
        }

        this.addStatsEvent('ai_search');

        const aiType = this.currentTab === 'tv' ? 'tv' : (this.currentTab === 'books' ? 'book' : 'movie');
        UI.showLoading(I18N.t('aiLoading'), aiType);

        // Personalization: send last 10 saved titles so AI can match user taste
        const savedList = this.listForType(aiType);
        const likedTitles = savedList.slice(-10).map(s => s.title).filter(Boolean);
        const excludeTitles = savedList.map(s => s.title).filter(Boolean);

        // Mood context: read from mood input if available
        const moodInput = document.getElementById('mood-ai-input') as HTMLInputElement | null;
        const moodText = (moodInput && moodInput.value) ? moodInput.value.trim() : '';

        // Auth headers for personalized recommendations
        const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('pfm_token');
        if (token) {
            authHeaders['Authorization'] = `Bearer ${token}`;
        }

        const maxRetries = 2;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/ai-search`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                        query,
                        type: aiType,
                        lang: I18N.current,
                        liked_titles: likedTitles,
                        exclude_titles: excludeTitles,
                        mood: moodText,
                    }),
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    if (res.status === 429) {
                        UI.showToast(I18N.t('aiUnavail'));
                        UI.hideLoading();
                        return;
                    }
                    if (res.status === 502 || res.status === 503 || res.status === 404) {
                        if (attempt < maxRetries) {
                            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                            continue;
                        }
                        UI.showToast(I18N.t('aiFail'));
                        UI.hideLoading();
                        return;
                    }
                    throw new Error(err.detail || 'AI search failed');
                }

                const data = await res.json();
                if (data && (data.title || data.name)) {
                    this.currentItem = data;
                    this.currentType = aiType;
                    UI.showResult(data, this.currentType);
                    this.syncResultNotePanel();
                    UI.updateSaveBtn(this.isItemSaved(data, this.currentType));
                    UI.updateLinkBtn(this.getItemUrl(data, this.currentType));
                    API.logHistory(this.currentType, data);
                    this._incrementGuestPick();
                    if (typeof Enhancements !== 'undefined' && Enhancements.maybeShowAfterFirstPick)
                        Enhancements.maybeShowAfterFirstPick();
                    UI.hideLoading();
                    return;
                } else {
                    if (attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 1000));
                        continue;
                    }
                    UI.showToast(I18N.t('aiFail'));
                }
            } catch (err) {
                console.error('AI search error (attempt ' + (attempt + 1) + '):', err);
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                    continue;
                }
                UI.showToast(I18N.t('aiUnavail'));
            }
        }

        UI.hideLoading();
    },

    listForType(type) {
        if (type === 'tv') return this.savedTv;
        if (type === 'book') return this.savedBooks;
        return this.savedMovies;
    },

    isItemSaved(item, type) {
        const list = this.listForType(type);
        return list.some(s => String(s.id) === String(item.id));
    },

    buildSavedRecord(item, type) {
        const url = this.getItemUrl(item, type);
        if (type === 'movie') {
            return {
                id: item.id,
                title: item.title || item.original_title || '',
                poster: item.poster_path ? CONFIG.TMDB_IMG + item.poster_path : CONFIG.FALLBACK_POSTER,
                year: item.release_date ? item.release_date.split('-')[0] : '—',
                rating: (item.vote_average || 0).toFixed(1),
                url, type,
            };
        }
        if (type === 'tv') {
            return {
                id: item.id,
                title: item.name || item.original_name || '',
                poster: item.poster_path ? CONFIG.TMDB_IMG + item.poster_path : CONFIG.FALLBACK_TV_POSTER,
                year: item.first_air_date ? item.first_air_date.split('-')[0] : '—',
                rating: (item.vote_average || 0).toFixed(1),
                url, type,
            };
        }
        // book
        return {
            id: item.id,
            title: item.title || '',
            poster: item.poster || CONFIG.FALLBACK_BOOK_POSTER,
            year: item.year || (item.published_date ? item.published_date.split('-')[0] : '—'),
            rating: item.average_rating ? Number(item.average_rating).toFixed(1) : '—',
            url, type,
        };
    },

    async toggleSave() {
        if (!this.currentItem) return;

        if (!Auth.user) {
            UI.showToast(I18N.t('saveHint'));
            Auth.showModal('login');
            return;
        }

        const type = this.normalizeMediaType(this.currentType);
        const item = this.currentItem;
        const list = this.listForType(type);
        const idx = list.findIndex(s => String(s.id) === String(item.id));

        if (idx >= 0) {
            const removed = list.splice(idx, 1)[0];
            UI.updateSaveBtn(false);
            UI.showToast(I18N.t('removedToast'));
            if (type === 'movie') await this.removeMovieFromServer(removed.id);
            else if (type === 'tv') await this.removeTvFromServer(removed.id);
            else await this.removeBookFromServer(removed.id);
        } else {
            if (typeof Subscription !== 'undefined' && !Subscription.canSave()) {
                UI.showToast('Ви досягли ліміту збережень. Оновіть план для необмежених збережень!');
                Subscription.showUpgradeModal();
                return;
            }
            const saved = this.buildSavedRecord(item, type);
            list.unshift(saved);
            UI.updateSaveBtn(true);
            UI.showToast(I18N.t('savedToast'));
            if (type === 'movie') await this.saveMovieToServer(saved);
            else if (type === 'tv') await this.saveTvToServer(saved);
            else await this.saveBookToServer(saved);
            if (typeof Subscription !== 'undefined') { Subscription.savedTotal++; Subscription.renderBadge(); }
            if (typeof Analytics !== 'undefined') Analytics.trackSave(type, item.title || '');
        }

        this.updateSavedUI();
    },

    openLink() {
        if (!this.currentItem) return;
        const url = this.getItemUrl(this.currentItem, this.currentType);
        if (url) window.open(url, '_blank');
    },

    share() {
        if (!this.currentItem) return;
        const menu = document.getElementById('share-menu');
        if (!menu) return;
        menu.classList.remove('hidden');

        const item = this.currentItem;
        let title = '';
        if (this.currentType === 'movie') title = item.title || item.original_title || '';
        else if (this.currentType === 'tv') title = item.name || item.original_name || '';
        else title = item.title || '';
        const url = this.getShareUrl(item, this.currentType);
        const text = I18N.t('shareText').replace('{title}', title);
        const itemId = item.id;
        const contentType = this.currentType === 'tv' ? 'tv' : this.currentType === 'book' ? 'book' : 'movie';

        const closeMenu = () => menu.classList.add('hidden');
        document.getElementById('share-menu-overlay')!.onclick = closeMenu;

        document.getElementById('share-copy')!.onclick = () => {
            navigator.clipboard.writeText(text + '\n' + url)
                .then(() => UI.showToast(I18N.t('copiedToast')))
                .catch(() => {});
            closeMenu();
        };
        document.getElementById('share-card-btn')!.onclick = () => {
            window.open(`${CONFIG.API_URL}/share/card/${contentType}/${itemId}`, '_blank');
            closeMenu();
        };
        document.getElementById('share-qr-btn')!.onclick = () => {
            window.open(`${CONFIG.API_URL}/qr/${contentType}/${itemId}`, '_blank');
            closeMenu();
        };
        document.getElementById('share-story-btn')!.onclick = () => {
            window.open(`${CONFIG.API_URL}/api/story/${contentType}/${itemId}`, '_blank');
            closeMenu();
        };
        document.getElementById('share-native-btn')!.onclick = () => {
            if (navigator.share) {
                navigator.share({ title: 'Picksy', text, url }).catch(() => {});
            } else {
                navigator.clipboard.writeText(text + '\n' + url)
                    .then(() => UI.showToast(I18N.t('copiedToast')))
                    .catch(() => {});
            }
            closeMenu();
        };
    },

    async showTrailer() {
        if (!this.currentItem) return;
        if (this.currentType === 'book') return;

        UI.showLoading(I18N.t('trailerLoading'));
        const videos = this.currentType === 'tv'
            ? await API.getTvVideos(this.currentItem.id)
            : await API.getMovieVideos(this.currentItem.id);
        UI.hideLoading();

        if (!videos.length) {
            UI.showToast(I18N.t('trailerNotFound'));
            return;
        }
        const trailer = videos.find(v => v.type === 'Trailer') || videos[0];
        UI.showTrailerModal(trailer.key);
    },

    // ── FIXED: auth guard added ──
    markAsWatched() {
        if (!this.currentItem) return;
        // Require login — same pattern as toggleSave()
        if (!Auth.user) {
            UI.showToast(I18N.t('saveHint'));
            Auth.showModal('login');
            return;
        }
        const type = this.normalizeMediaType(this.currentType);
        const item = this.currentItem;
        const record = this.buildSavedRecord(item, type);
        this.applyTrackerDefaults(record, item, type, true);
        record.watchedAt = new Date().toISOString();
        record.userRating = null;

        const watchedList = this.getWatchedList(type);
        if (!watchedList.some(w => String(w.id) === String(record.id))) {
            watchedList.unshift(record);
            this.saveWatchedToStorage();
            UI.showToast(I18N.t('markedWatched'));
        }

        // Remove from watchlist if present
        const savedList = this.listForType(type);
        const idx = savedList.findIndex(s => String(s.id) === String(item.id));
        if (idx >= 0) {
            savedList.splice(idx, 1);
            UI.updateSaveBtn(false);
            if (type === 'movie') this.removeMovieFromServer(item.id);
            else if (type === 'tv') this.removeTvFromServer(item.id);
            else this.removeBookFromServer(item.id);
        }

        this.updateSavedUI();
    },

    getWatchedList(type) {
        if (type === 'tv') return this.watchedTv;
        if (type === 'book') return this.watchedBooks;
        return this.watchedMovies;
    },

    saveWatchedToStorage() {
        localStorage.setItem('picksy_watched_movies', JSON.stringify(this.watchedMovies));
        localStorage.setItem('picksy_watched_tv', JSON.stringify(this.watchedTv));
        localStorage.setItem('picksy_watched_books', JSON.stringify(this.watchedBooks));
    },

    sortWatchedNewestFirst() {
        const newestFirst = (a, b) =>
            new Date(b?.watchedAt || 0).getTime() - new Date(a?.watchedAt || 0).getTime();
        this.watchedMovies.sort(newestFirst);
        this.watchedTv.sort(newestFirst);
        this.watchedBooks.sort(newestFirst);
        this.saveWatchedToStorage();
    },

    // ── FIXED: auth guard added ──
    moveToWatched(index) {
        // Require login — moving to watched is a persistent action
        if (!Auth.user) {
            UI.showToast(I18N.t('saveHint'));
            Auth.showModal('login');
            return;
        }
        const list = this.getActiveSavedList();
        if (this.savedCategory === 'watchlist') {
            const item = list.splice(index, 1)[0];
            if (item) {
                item.watchedAt = new Date().toISOString();
                item.userRating = null;
                const type = this.normalizeMediaType(item.type || this.typeForSavedTab(this.savedTab));
                item.type = type;
                this.applyTrackerDefaults(item, item, type, true);
                const watchedList = this.getWatchedList(type);
                if (!watchedList.some(w => String(w.id) === String(item.id))) {
                    watchedList.unshift(item);
                }
                this.saveWatchedToStorage();
                const t = this.typeForSavedTab(this.savedTab);
                if (t === 'movie') this.removeMovieFromServer(item.id);
                else if (t === 'tv') this.removeTvFromServer(item.id);
                else this.removeBookFromServer(item.id);
            }
            this.activateSavedCategory('watched');
            this.updateSavedUI();
            UI.showToast(I18N.t('markedWatched'));
        }
    },

    getWatchedListForTab(tab) {
        if (tab === 'tv') return this.watchedTv;
        if (tab === 'books') return this.watchedBooks;
        return this.watchedMovies;
    },

    _ratingIndex: -1,
    _ratingValue: 0,

    // ── FIXED: auth guard added ──
    showRatingModal(index) {
        // Require login — ratings are user-specific persistent data
        if (!Auth.user) {
            UI.showToast(I18N.t('saveHint'));
            Auth.showModal('login');
            return;
        }
        this._ratingIndex = index;
        this._ratingValue = 0;
        const list = this.getWatchedListForTab(this.savedTab);
        const item = list[index];
        if (!item) return;
        if (item.userRating) this._ratingValue = item.userRating;

        const title = document.querySelector('.rating-modal-title');
        if (title) title.textContent = item.title || I18N.t('rateTitle');

        this.renderRatingStars();
        document.getElementById('rating-modal').classList.remove('hidden');
    },

    hideRatingModal() {
        document.getElementById('rating-modal').classList.add('hidden');
    },

    renderRatingStars() {
        const container = document.getElementById('rating-stars');
        if (!container) return;
        let html = '';
        for (let i = 1; i <= 10; i++) {
            const active = i <= this._ratingValue ? 'active' : '';
            html += `<button class="rating-star ${active}" data-val="${i}">★</button>`;
        }
        container.innerHTML = html;
        container.querySelectorAll('.rating-star').forEach(btn => {
            btn.addEventListener('click', () => {
                this._ratingValue = parseInt(btn.dataset.val);
                this.renderRatingStars();
            });
        });
    },

    saveRating() {
        const list = this.getWatchedListForTab(this.savedTab);
        if (this._ratingIndex >= 0 && this._ratingIndex < list.length) {
            list[this._ratingIndex].userRating = this._ratingValue;
            this.saveWatchedToStorage();
            this.renderSaved();
            UI.showToast(I18N.t('ratingSaved'));
        }
        this.hideRatingModal();
    },

    applyTrackerDefaults(record, source, type, completed = false) {
        if (!record) return record;
        record.type = type || record.type || 'movie';
        record.completed = completed || !!record.completed;
        if (record.type === 'tv') {
            record.progressSeason = Math.max(1, parseInt(record.progressSeason || '1') || 1);
            record.progressEpisode = Math.max(1, parseInt(record.progressEpisode || '1') || 1);
            record.episode_run_time = record.episode_run_time || (Array.isArray(source?.episode_run_time) ? source.episode_run_time[0] : source?.episode_run_time) || null;
            record.number_of_seasons = record.number_of_seasons || source?.number_of_seasons || null;
            record.number_of_episodes = record.number_of_episodes || source?.number_of_episodes || null;
        } else if (record.type === 'movie') {
            record.progressMinute = Math.max(0, parseInt(record.progressMinute || '0') || 0);
            record.runtime = record.runtime || source?.runtime || null;
        } else if (record.type === 'book') {
            record.progressPage = Math.max(0, parseInt(record.progressPage || '0') || 0);
            record.page_count = record.page_count || source?.page_count || null;
        }
        return record;
    },

    updateWatchedProgress(index, field, value) {
        if (this.savedCategory !== 'watched') return;
        const list = this.getWatchedListForTab(this.savedTab);
        const item = list[index];
        if (!item || !field) return;
        const safeValue = Math.max(field === 'progressMinute' || field === 'progressPage' ? 0 : 1, Math.round(Number(value) || 0));
        item[field] = safeValue;
        item.completed = false;
        item.watchedAt = item.watchedAt || new Date().toISOString();
        this.saveWatchedToStorage();
        this.renderSaved();
        this.updateTrackerUI();
        UI.showToast(I18N.current === 'en' ? 'Progress updated' : 'Прогрес оновлено');
    },

    toggleWatchedComplete(index) {
        if (this.savedCategory !== 'watched') return;
        const list = this.getWatchedListForTab(this.savedTab);
        const item = list[index];
        if (!item) return;
        item.completed = !item.completed;
        if (item.completed) {
            if ((item.type || this.typeForSavedTab(this.savedTab)) === 'movie' && item.runtime) {
                item.progressMinute = parseInt(item.runtime) || item.progressMinute || 0;
            }
            item.completedAt = new Date().toISOString();
        } else {
            item.completedAt = null;
        }
        this.saveWatchedToStorage();
        this.renderSaved();
        this.updateTrackerUI();
        UI.showToast(item.completed
            ? (I18N.current === 'en' ? 'Marked completed' : 'Позначено повністю')
            : (I18N.current === 'en' ? 'Completion removed' : 'Позначку знято'));
    },

    _trackerProgressLabel(item) {
        const type = item.type || 'movie';
        if (item.completed) return I18N.current === 'en' ? 'completed' : 'повністю';
        if (type === 'tv') {
            const season = Math.max(1, parseInt(item.progressSeason || '1') || 1);
            const episode = Math.max(1, parseInt(item.progressEpisode || '1') || 1);
            return I18N.current === 'en' ? `S${season} E${episode}` : `сезон ${season}, серія ${episode}`;
        }
        if (type === 'movie') {
            const minute = Math.max(0, parseInt(item.progressMinute || '0') || 0);
            return minute ? (I18N.current === 'en' ? `${minute} min` : `${minute} хв`) : '';
        }
        if (type === 'book') {
            const page = Math.max(0, parseInt(item.progressPage || '0') || 0);
            return page ? (I18N.current === 'en' ? `page ${page}` : `${page} стор.`) : '';
        }
        return '';
    },

    getWatchedStats() {
        const all = [...this.watchedMovies, ...this.watchedTv, ...this.watchedBooks];
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
        return {
            month: all.filter(w => w.watchedAt && w.watchedAt >= monthStart).length,
            year: all.filter(w => w.watchedAt && w.watchedAt >= yearStart).length,
            total: all.length,
        };
    },

    updateWatchedStats() {
        const stats = this.getWatchedStats();
        const mc = document.getElementById('stat-month-count');
        const yc = document.getElementById('stat-year-count');
        const tc = document.getElementById('stat-total-count');
        if (mc) mc.textContent = String(stats.month);
        if (yc) yc.textContent = String(stats.year);
        if (tc) tc.textContent = String(stats.total);
        this.updateTrackerUI();
    },

    initTracker() {
        const goalInput = document.getElementById('tracker-goal-input') as HTMLInputElement | null;
        const noteInput = document.getElementById('tracker-note') as HTMLTextAreaElement | null;
        const openListBtn = document.getElementById('tracker-open-list');

        this.trackerGoal = this._normalizeTrackerGoal(this.trackerGoal);
        if (goalInput) {
            goalInput.value = String(this.trackerGoal);
            goalInput.addEventListener('input', () => {
                this.trackerGoal = this._normalizeTrackerGoal(parseInt(goalInput.value || '8'));
                localStorage.setItem('picksy_tracker_goal', String(this.trackerGoal));
                this.updateTrackerUI();
            });
        }

        if (noteInput) {
            noteInput.value = localStorage.getItem('picksy_tracker_note') || '';
            noteInput.addEventListener('input', () => {
                localStorage.setItem('picksy_tracker_note', noteInput.value);
            });
        }

        openListBtn?.addEventListener('click', () => this.openWatchedListFromTracker());
        this.updateTrackerUI();
    },

    initNotes() {
        const saveBtn = document.getElementById('notes-save-btn');
        const clearBtn = document.getElementById('notes-clear-btn');
        const list = document.getElementById('notes-list');

        saveBtn?.addEventListener('click', () => {
            const input = document.getElementById('tracker-note') as HTMLTextAreaElement | null;
            const text = (input?.value || '').trim();
            if (!text) {
                UI.showToast(I18N.current === 'en' ? 'Write a note first' : 'Спочатку напиши нотатку');
                input?.focus();
                return;
            }
            this.addNote({
                text,
                title: I18N.current === 'en' ? 'Personal note' : 'Особиста нотатка',
            });
            if (input) {
                input.value = '';
                localStorage.setItem('picksy_tracker_note', '');
            }
        });

        clearBtn?.addEventListener('click', () => {
            const input = document.getElementById('tracker-note') as HTMLTextAreaElement | null;
            if (input) {
                input.value = '';
                localStorage.setItem('picksy_tracker_note', '');
                input.focus();
            }
        });

        list?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const saveEditBtn = target.closest('.note-edit-save') as HTMLElement | null;
            if (saveEditBtn) {
                this.saveEditedNote(saveEditBtn.dataset.id || '');
                return;
            }
            const cancelEditBtn = target.closest('.note-edit-cancel') as HTMLElement | null;
            if (cancelEditBtn) {
                this.cancelNoteEdit();
                return;
            }
            const deleteBtn = target.closest('.note-delete') as HTMLElement | null;
            if (deleteBtn) {
                this.deleteNote(deleteBtn.dataset.id || '');
                return;
            }
            const editBtn = target.closest('.note-edit') as HTMLElement | null;
            if (editBtn) {
                this.editNote(editBtn.dataset.id || '');
                return;
            }
            const detailBtn = target.closest('.note-detail') as HTMLElement | null;
            if (detailBtn && detailBtn.dataset.itemId && detailBtn.dataset.itemType) {
                this.goToDetailPage(detailBtn.dataset.itemId, detailBtn.dataset.itemType);
                return;
            }
            const noteOpen = target.closest('.note-poster, .note-top h3') as HTMLElement | null;
            if (noteOpen) {
                const card = target.closest('.note-card') as HTMLElement | null;
                if (card?.dataset.itemId && card?.dataset.itemType) {
                    this.goToDetailPage(card.dataset.itemId, card.dataset.itemType);
                }
            }
        });

        this.renderNotes();
    },

    saveNotes() {
        localStorage.setItem('picksy_notes', JSON.stringify(this.notes || []));
    },

    _escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    addNote(payload) {
        const note = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: (payload.text || '').trim(),
            title: payload.title || '',
            itemId: payload.itemId || null,
            itemType: payload.itemType || null,
            itemTitle: payload.itemTitle || null,
            itemPoster: payload.itemPoster || null,
            itemYear: payload.itemYear || '',
            itemRating: payload.itemRating || '',
            itemOverview: payload.itemOverview || '',
            createdAt: new Date().toISOString(),
        };
        if (!note.text) return null;
        this.notes.unshift(note);
        this.saveNotes();
        this.renderNotes();
        UI.showToast(I18N.current === 'en' ? 'Added to notes' : 'Додано в нотатки');
        return note;
    },

    deleteNote(id) {
        this.notes = (this.notes || []).filter(note => note.id !== id);
        this.saveNotes();
        this.renderNotes();
        UI.showToast(I18N.current === 'en' ? 'Note deleted' : 'Нотатку видалено');
    },

    editNote(id) {
        const note = (this.notes || []).find(item => item.id === id);
        if (!note) return;
        this.editingNoteId = id;
        this.renderNotes();
        setTimeout(() => {
            const input = Array.from(document.querySelectorAll('.note-edit-input')).find((el: any) => el.dataset.id === id) as HTMLTextAreaElement | undefined;
            input?.focus();
            input?.setSelectionRange(input.value.length, input.value.length);
        }, 40);
    },

    saveEditedNote(id) {
        const note = (this.notes || []).find(item => item.id === id);
        const input = Array.from(document.querySelectorAll('.note-edit-input')).find((el: any) => el.dataset.id === id) as HTMLTextAreaElement | undefined;
        if (!note || !input) return;
        const text = String(input.value || '').trim();
        if (!text) {
            UI.showToast(I18N.current === 'en' ? 'Note cannot be empty' : 'Нотатка не може бути порожньою');
            input.focus();
            return;
        }
        note.text = text;
        note.updatedAt = new Date().toISOString();
        this.editingNoteId = '';
        this.saveNotes();
        this.renderNotes();
        UI.showToast(I18N.current === 'en' ? 'Note updated' : 'Нотатку оновлено');
    },

    cancelNoteEdit() {
        this.editingNoteId = '';
        this.renderNotes();
    },

    _noteItemFromCurrent() {
        const item = this.currentItem;
        if (!item) return null;
        return {
            itemId: this._getItemId(item, this.currentType),
            itemType: this.currentType,
            itemTitle: item.title || item.name || '',
            itemPoster: item.poster || item.poster_path || '',
            itemYear: item.year || item.release_date?.slice?.(0, 4) || item.first_air_date?.slice?.(0, 4) || '',
            itemRating: item.rating || item.vote_average || '',
            itemOverview: item.overview || item.description || '',
        };
    },

    syncResultNotePanel() {
        const panel = document.getElementById('result-note-panel');
        const meta = document.getElementById('result-note-meta');
        const input = document.getElementById('result-note-input') as HTMLTextAreaElement | null;
        if (!panel) return;
        if (!this.currentItem) {
            panel.classList.add('hidden');
            return;
        }
        const title = this.currentItem.title || this.currentItem.name || '';
        const typeLabel = this._trackerTypeLabel(this.currentType);
        panel.classList.remove('hidden');
        if (meta) meta.textContent = `${title} · ${typeLabel}`;
        if (input) input.value = '';
    },

    focusResultNote() {
        const panel = document.getElementById('result-note-panel');
        const input = document.getElementById('result-note-input') as HTMLTextAreaElement | null;
        panel?.classList.remove('hidden');
        panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => input?.focus(), 180);
    },

    addNoteFromCurrentResult() {
        const input = document.getElementById('result-note-input') as HTMLTextAreaElement | null;
        const text = (input?.value || '').trim();
        if (!this.currentItem) return UI.showToast(I18N.t('saveHint'));
        if (!text) {
            UI.showToast(I18N.current === 'en' ? 'Write a note first' : 'Спочатку напиши нотатку');
            input?.focus();
            return;
        }
        const itemMeta = this._noteItemFromCurrent();
        this.addNote({
            ...itemMeta,
            text,
            title: itemMeta?.itemTitle || '',
        });
        if (input) input.value = '';
    },

    addNoteFromSavedIndex(index) {
        const list = this.getActiveSavedList();
        const item = list[index];
        if (!item) return;
        const type = this.getSavedTabType();
        const itemId = this._getItemId(item, type);
        this.addNote({
            text: I18N.current === 'en' ? 'Saved from my list.' : 'Додано зі списку.',
            title: item.title || item.name || '',
            itemId,
            itemType: type,
            itemTitle: item.title || item.name || '',
            itemPoster: item.poster || '',
            itemYear: item.year || '',
            itemRating: item.rating || '',
            itemOverview: item.overview || item.description || '',
        });
    },

    addNoteFromItem(item, type = 'movie', source = '', sourceName = '') {
        if (!item) return;
        const itemId = this._getItemId(item, type);
        const sourceText = source === 'collection' && sourceName
            ? (I18N.current === 'en' ? `Added from collection: ${sourceName}` : `Додано з колекції: ${sourceName}`)
            : (I18N.current === 'en' ? 'Added from Picksy.' : 'Додано з Picksy.');
        this.addNote({
            text: sourceText,
            title: item.title || item.name || '',
            itemId,
            itemType: type,
            itemTitle: item.title || item.name || '',
            itemPoster: item.poster || item.poster_path || '',
            itemYear: item.year || '',
            itemRating: item.rating || item.vote_average || '',
            itemOverview: item.overview || item.description || '',
        });
    },

    async hydrateNotesDetails() {
        if (this._notesHydrating || !Array.isArray(this.notes) || !this.notes.length) return;
        const needs = this.notes.filter(note => note.itemId && note.itemType && (!note.itemPoster || !note.itemYear || !note.itemRating || !note.itemOverview || String(note.itemPoster).startsWith('/')));
        if (!needs.length) return;
        this._notesHydrating = true;
        let changed = false;
        for (const note of needs.slice(0, 8)) {
            try {
                let data = null;
                if (note.itemType === 'tv') data = await API.getTvDetails(note.itemId);
                else if (note.itemType === 'book') data = await API.getBookDetails(note.itemId);
                else data = await API.getMovieDetails(note.itemId);
                if (!data) continue;
                note.itemTitle = note.itemTitle || data.title || data.name || data.volumeInfo?.title || '';
                if (note.itemType === 'book') {
                    const info = data.volumeInfo || data;
                    note.itemPoster = note.itemPoster || info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || CONFIG.FALLBACK_BOOK_POSTER;
                    note.itemYear = note.itemYear || (info.publishedDate || '').slice(0, 4);
                    note.itemRating = note.itemRating || info.averageRating || '';
                    note.itemOverview = note.itemOverview || info.description || '';
                } else {
                    note.itemPoster = data.poster_path ? `${CONFIG.TMDB_IMG}${data.poster_path}` : (note.itemPoster || CONFIG.FALLBACK_POSTER);
                    note.itemYear = note.itemYear || (data.release_date || data.first_air_date || '').slice(0, 4);
                    note.itemRating = note.itemRating || (data.vote_average ? Number(data.vote_average).toFixed(1) : '');
                    note.itemOverview = note.itemOverview || data.overview || '';
                }
                changed = true;
            } catch (_) {}
        }
        this._notesHydrating = false;
        if (changed) {
            this.saveNotes();
            this.renderNotes();
        }
    },

    renderNotes() {
        const list = document.getElementById('notes-list');
        const count = document.getElementById('notes-count');
        if (count) count.textContent = String((this.notes || []).length);
        if (!list) return;
        if (!this.notes || !this.notes.length) {
            list.innerHTML = `<div class="notes-empty">${I18N.current === 'en' ? 'No notes yet' : 'Поки немає нотаток'}</div>`;
            return;
        }
        list.innerHTML = this.notes.map((note) => {
            const title = note.itemTitle || note.title || (I18N.current === 'en' ? 'Personal note' : 'Особиста нотатка');
            const date = this._formatTrackerDate(note.createdAt);
            const updatedDate = note.updatedAt ? this._formatTrackerDate(note.updatedAt) : '';
            const poster = note.itemPoster || CONFIG.FALLBACK_POSTER;
            const meta = [this._trackerTypeLabel(note.itemType), note.itemYear, note.itemRating ? `★ ${note.itemRating}` : ''].filter(Boolean).join(' · ');
            const overview = note.itemOverview ? `<p class="note-overview">${this._escapeHtml(note.itemOverview)}</p>` : '';
            const isEditing = this.editingNoteId === note.id;
            const noteText = isEditing
                ? `<textarea class="note-edit-input" data-id="${this._escapeHtml(note.id)}" rows="5" maxlength="700">${this._escapeHtml(note.text)}</textarea>`
                : `<p class="note-text">${this._escapeHtml(note.text)}</p>`;
            const editControls = isEditing
                ? `<button class="note-edit-save" data-id="${this._escapeHtml(note.id)}" type="button">${I18N.current === 'en' ? 'Save' : 'Зберегти'}</button>
                   <button class="note-edit-cancel" data-id="${this._escapeHtml(note.id)}" type="button">${I18N.current === 'en' ? 'Cancel' : 'Скасувати'}</button>`
                : `<button class="note-edit" data-id="${this._escapeHtml(note.id)}" type="button">${I18N.current === 'en' ? 'Edit' : 'Змінити'}</button>`;
            const detailBtn = note.itemId && note.itemType
                ? `<button class="note-detail" data-item-id="${this._escapeHtml(note.itemId)}" data-item-type="${this._escapeHtml(note.itemType)}" type="button">${I18N.current === 'en' ? 'Details' : 'Опис'}</button>`
                : '';
            return `
                <article class="note-card" data-id="${this._escapeHtml(note.id)}" data-item-id="${this._escapeHtml(note.itemId || '')}" data-item-type="${this._escapeHtml(note.itemType || '')}">
                    <img class="note-poster" src="${this._escapeHtml(poster)}" alt="" loading="lazy" onerror="this.src='${CONFIG.FALLBACK_POSTER}'">
                    <div class="note-body">
                        <div class="note-top">
                            <div>
                                <h3>${this._escapeHtml(title)}</h3>
                                <p>${this._escapeHtml(meta || date)}</p>
                            </div>
                            <button class="note-delete" data-id="${this._escapeHtml(note.id)}" type="button" aria-label="Delete">×</button>
                        </div>
                        ${noteText}
                        ${overview}
                        <div class="note-actions">
                            <span>${this._escapeHtml(updatedDate ? `${date} · ${I18N.current === 'en' ? 'edited' : 'змінено'} ${updatedDate}` : date)}</span>
                            <button class="note-edit" data-id="${this._escapeHtml(note.id)}" type="button">${I18N.current === 'en' ? 'Edit' : 'Змінити'}</button>
                            ${isEditing ? editControls : ''}
                            ${detailBtn}
                        </div>
                    </div>
                </article>
            `;
        }).join('');
        setTimeout(() => this.hydrateNotesDetails(), 0);
    },

    _normalizeTrackerGoal(goal) {
        const n = Number.isFinite(goal) ? goal : 8;
        return Math.max(1, Math.min(99, Math.round(n || 8)));
    },

    initMobileNav() {
        const nav = document.getElementById('mobile-nav');
        if (!nav || nav.dataset.bound === '1') return;
        nav.dataset.bound = '1';
        nav.querySelectorAll('.mobile-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const action = (btn as HTMLElement).dataset.nav || 'pick';
                this.handleMobileNav(action);
            });
        });
        this.updateMobileNavForMode(this.getPageMode());
    },

    updateMobileNavForMode(mode = this.getPageMode()) {
        const nav = document.getElementById('mobile-nav');
        if (!nav) return;
        const configs: Record<string, Array<{ action: string; label: string; icon: string }>> = {
            home: [
                { action: 'pick', label: I18N.t('mobilePick') || 'Підбір', icon: 'mascot' },
                { action: 'live', label: 'Live', icon: 'pulse' },
                { action: 'quizzes', label: 'Квізи', icon: 'target' },
                { action: 'saved', label: I18N.t('mobileSaved') || 'Список', icon: 'bookmark' },
                { action: 'profile', label: I18N.t('mobileProfile') || 'Профіль', icon: 'user' },
            ],
            tracker: [
                { action: 'pick', label: I18N.t('mobilePick') || 'Підбір', icon: 'mascot' },
                { action: 'watched', label: 'Перегляди', icon: 'chart' },
                { action: 'notes', label: I18N.t('mobileNotes') || 'Нотатки', icon: 'note' },
                { action: 'saved', label: I18N.t('mobileSaved') || 'Список', icon: 'bookmark' },
                { action: 'profile', label: I18N.t('mobileProfile') || 'Профіль', icon: 'user' },
            ],
            notes: [
                { action: 'pick', label: I18N.t('mobilePick') || 'Підбір', icon: 'mascot' },
                { action: 'new-note', label: 'Нова', icon: 'plus' },
                { action: 'tracker', label: I18N.t('mobileTracker') || 'Трекер', icon: 'chart' },
                { action: 'saved', label: I18N.t('mobileSaved') || 'Список', icon: 'bookmark' },
                { action: 'profile', label: I18N.t('mobileProfile') || 'Профіль', icon: 'user' },
            ],
            watchlist: [
                { action: 'pick', label: I18N.t('mobilePick') || 'Підбір', icon: 'mascot' },
                { action: 'notes', label: I18N.t('mobileNotes') || 'Нотатки', icon: 'note' },
                { action: 'tracker', label: I18N.t('mobileTracker') || 'Трекер', icon: 'chart' },
                { action: 'collections', label: 'Колекції', icon: 'folder' },
                { action: 'profile', label: I18N.t('mobileProfile') || 'Профіль', icon: 'user' },
            ],
            collections: [
                { action: 'pick', label: I18N.t('mobilePick') || 'Підбір', icon: 'mascot' },
                { action: 'saved', label: I18N.t('mobileSaved') || 'Список', icon: 'bookmark' },
                { action: 'notes', label: I18N.t('mobileNotes') || 'Нотатки', icon: 'note' },
                { action: 'tracker', label: I18N.t('mobileTracker') || 'Трекер', icon: 'chart' },
                { action: 'profile', label: I18N.t('mobileProfile') || 'Профіль', icon: 'user' },
            ],
            quizzes: [
                { action: 'pick', label: I18N.t('mobilePick') || 'Підбір', icon: 'mascot' },
                { action: 'quiz-archetype', label: 'Архетип', icon: 'target' },
                { action: 'quiz-match', label: 'Матч', icon: 'heart' },
                { action: 'wordle', label: 'Wordle', icon: 'grid' },
                { action: 'profile', label: I18N.t('mobileProfile') || 'Профіль', icon: 'user' },
            ],
        };
        const activeMode = mode === 'saved' ? 'watchlist' : mode;
        const items = configs[activeMode] || configs.home;
        const buttons = Array.from(nav.querySelectorAll('.mobile-nav-item')) as HTMLElement[];
        buttons.forEach((btn, index) => {
            const item = items[index];
            if (!item) {
                btn.classList.add('hidden');
                return;
            }
            btn.classList.remove('hidden');
            btn.dataset.nav = item.action;
            btn.dataset.icon = item.icon;
            btn.innerHTML = `<span class="mobile-nav-icon" aria-hidden="true">${this._mobileNavIcon(item.icon)}</span><span>${this._escapeHtml(item.label)}</span>`;
        });
        const activeAction = activeMode === 'home' ? 'pick' : activeMode === 'watchlist' ? 'saved' : activeMode;
        this._setMobileNavActive(activeAction);
    },

    _mobileNavIcon(icon: string) {
        const icons = {
            mascot: '',
            pulse: '<svg viewBox="0 0 24 24"><path d="M4 13h4l2-7 4 14 2-7h4"/></svg>',
            target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"/></svg>',
            bookmark: '<svg viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',
            user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
            chart: '<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3"/></svg>',
            note: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
            plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
            folder: '<svg viewBox="0 0 24 24"><path d="M3 7h7l2 3h9v9H3z"/></svg>',
            heart: '<svg viewBox="0 0 24 24"><path d="M20 7c0 6-8 11-8 11S4 13 4 7a4 4 0 0 1 7-2 4 4 0 0 1 9 2z"/></svg>',
            grid: '<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>',
        };
        return icons[icon] || icons.bookmark;
    },

    _setMobileNavActive(action) {
        document.querySelectorAll('.mobile-nav-item').forEach(btn => {
            (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.nav === action);
        });
    },

    handleMobileNav(action: string) {
        if (action === 'pick') {
            const goPick = () => {
                document.getElementById('ai-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                UI.showToast(I18N.current === 'en' ? 'Pick area opened' : 'Підбір відкрито');
            };
            if (this.getPageMode() !== 'home') {
                history.pushState({ picksyPage: 'home' }, '', '/');
                this.applyPageMode();
                setTimeout(goPick, 80);
            } else {
                goPick();
            }
            return;
        }

        if (action === 'profile') {
            if (typeof Auth !== 'undefined' && Auth.user) Auth.showUserMenu();
            else if (typeof Auth !== 'undefined') Auth.showModal('login');
            return;
        }

        if (action === 'live') return this.openRecentPicksModal('all');
        if (action === 'new-note') {
            this.navigateWorkspace('notes');
            setTimeout(() => (document.getElementById('tracker-note') as HTMLTextAreaElement | null)?.focus(), 150);
            return;
        }
        if (action === 'watched') return this.openWatchedListFromTracker();
        if (action === 'quiz-archetype') { window.location.href = '/quiz'; return; }
        if (action === 'quiz-match') { window.location.href = '/match'; return; }
        if (action === 'wordle') { window.location.href = '/wordle'; return; }

        const modeMap: Record<string, string> = {
            tracker: 'tracker',
            notes: 'notes',
            saved: 'watchlist',
            collections: 'collections',
            quizzes: 'quizzes',
        };
        const mode = modeMap[action];
        if (!mode) return;

        const navigated = this.navigateWorkspace(mode);
        if (navigated) {
            if (mode === 'notes') {
                setTimeout(() => (document.getElementById('tracker-note') as HTMLTextAreaElement | null)?.focus(), 300);
            }
            return;
        }

        if (action === 'tracker' || action === 'notes') {
            document.getElementById('tracker-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (action === 'notes') {
                setTimeout(() => (document.getElementById('tracker-note') as HTMLTextAreaElement | null)?.focus(), 350);
            }
            return;
        }

        if (action === 'saved') {
            this.openSavedPanel();
            return;
        }
    },

    openSavedPanel() {
        const body = document.getElementById('saved-body');
        if (body) body.classList.remove('hidden');
        document.getElementById('saved-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    openWatchedListFromTracker() {
        this.savedCategory = 'watched';
        document.querySelectorAll('.saved-cat-tab').forEach(tab => {
            (tab as HTMLElement).classList.toggle('active', (tab as HTMLElement).dataset.cat === 'watched');
        });
        const statsEl = document.getElementById('watched-stats');
        if (statsEl) statsEl.classList.remove('hidden');
        if (this.getPageMode() !== 'watchlist') {
            this.navigateWorkspace('watchlist');
        }
        this.openSavedPanel();
        this.renderSaved();
    },

    getRecentWatchedItems(limit = 5) {
        const withType = [
            ...this.watchedMovies.map(item => ({ ...item, type: item.type || 'movie' })),
            ...this.watchedTv.map(item => ({ ...item, type: item.type || 'tv' })),
            ...this.watchedBooks.map(item => ({ ...item, type: item.type || 'book' })),
        ];
        return withType
            .sort((a, b) => new Date(b.watchedAt || 0).getTime() - new Date(a.watchedAt || 0).getTime())
            .slice(0, limit);
    },

    updateTrackerUI() {
        const root = document.getElementById('tracker-section');
        if (!root) return;
        const stats = this.getWatchedStats();
        const goal = this._normalizeTrackerGoal(this.trackerGoal || parseInt(localStorage.getItem('picksy_tracker_goal') || '8'));
        const progress = Math.min(100, Math.round((stats.month / goal) * 100));

        const monthEl = document.getElementById('tracker-month-count');
        const yearEl = document.getElementById('tracker-year-count');
        const totalEl = document.getElementById('tracker-total-count');
        const fillEl = document.getElementById('tracker-progress-fill');
        const recentCountEl = document.getElementById('tracker-recent-count');
        const listEl = document.getElementById('tracker-recent-list');

        if (monthEl) monthEl.textContent = String(stats.month);
        if (yearEl) yearEl.textContent = String(stats.year);
        if (totalEl) totalEl.textContent = String(stats.total);
        if (fillEl) fillEl.style.width = `${progress}%`;
        if (recentCountEl) recentCountEl.textContent = String(stats.total);
        if (!listEl) return;

        const safe = (s) => (typeof _escHtml === 'function' ? _escHtml(String(s || '')) : String(s || ''));
        const allWatched = [
            ...(this.watchedMovies || []).map(item => ({ ...item, type: item.type || 'movie' })),
            ...(this.watchedTv || []).map(item => ({ ...item, type: item.type || 'tv' })),
            ...(this.watchedBooks || []).map(item => ({ ...item, type: item.type || 'book' })),
        ];
        const activeItems = allWatched.filter(item => !item.completed && (
            item.progressMinute || item.progressSeason || item.progressEpisode || item.progressPage
        ));
        const completedItems = allWatched.filter(item => item.completed);
        const activeSeries = activeItems.filter(item => item.type === 'tv').length;
        const movieMinutes = allWatched.reduce((sum, item) => sum + (item.type === 'movie' ? (parseInt(item.progressMinute || '0') || 0) : 0), 0);
        const trackerGrid = root.querySelector('.tracker-grid');
        let insightsEl = root.querySelector('.tracker-insights') as HTMLElement | null;
        if (!insightsEl && trackerGrid) {
            insightsEl = document.createElement('div');
            insightsEl.className = 'tracker-insights';
            trackerGrid.insertAdjacentElement('afterend', insightsEl);
        }
        if (insightsEl) {
            const activeLabel = I18N.current === 'en' ? 'In progress' : 'В процесі';
            const completedLabel = I18N.current === 'en' ? 'Completed' : 'Завершено';
            const seriesLabel = I18N.current === 'en' ? 'Active series' : 'Активні серіали';
            const minutesLabel = I18N.current === 'en' ? 'Movie minutes' : 'Хвилини у фільмах';
            insightsEl.innerHTML = `
                <div class="tracker-insight-card"><span>${safe(activeLabel)}</span><strong>${activeItems.length}</strong></div>
                <div class="tracker-insight-card"><span>${safe(completedLabel)}</span><strong>${completedItems.length}</strong></div>
                <div class="tracker-insight-card"><span>${safe(seriesLabel)}</span><strong>${activeSeries}</strong></div>
                <div class="tracker-insight-card"><span>${safe(minutesLabel)}</span><strong>${movieMinutes}</strong></div>
            `;
        }
        const recent = this.getRecentWatchedItems(5);
        if (!recent.length) {
            listEl.innerHTML = `<div class="tracker-empty">${safe(I18N.t('trackerEmpty'))}</div>`;
            return;
        }

        listEl.innerHTML = recent.map(item => {
            const typeLabel = this._trackerTypeLabel(item.type);
            const date = this._formatTrackerDate(item.watchedAt);
            const rating = item.userRating ? `<span>${safe(I18N.t('rate'))}: ${item.userRating}/10</span>` : '';
            const itemId = this._getItemId(item, item.type);
            const progressLabel = this._trackerProgressLabel(item);
            const progressBadge = progressLabel ? `<span class="tracker-recent-progress">${safe(progressLabel)}</span>` : '';
            return `
                <button class="tracker-recent-item" type="button" data-id="${safe(itemId)}" data-type="${safe(item.type)}">
                    <img src="${safe(item.poster)}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">
                    <span class="tracker-recent-body">
                        <strong>${safe(item.title)}</strong>
                        ${progressBadge}
                        <span>${safe(typeLabel)}${date ? ` · ${safe(date)}` : ''}${rating ? ` · ${rating}` : ''}</span>
                    </span>
                </button>
            `;
        }).join('');

        listEl.querySelectorAll('.tracker-recent-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = (btn as HTMLElement).dataset.id;
                const type = (btn as HTMLElement).dataset.type;
                if (id && type) this.goToDetailPage(id, type);
            });
        });
    },

    _trackerTypeLabel(type) {
        if (type === 'tv') return I18N.t('tv');
        if (type === 'book') return I18N.t('books');
        return I18N.t('movies');
    },

    _formatTrackerDate(iso) {
        if (!iso) return '';
        const date = new Date(iso);
        if (isNaN(date.getTime())) return '';
        const locale = I18N.current === 'en' ? 'en-US' : 'uk-UA';
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    },

    _normalizeDetailType(type) {
        const raw = String(type || '').toLowerCase();
        if (raw === 'movies' || raw === 'movie') return 'movie';
        if (raw === 'tv' || raw === 'series' || raw === 'serial' || raw === 'shows') return 'tv';
        if (raw === 'books' || raw === 'book') return 'book';
        return raw || 'movie';
    },

    _getItemId(itemOrId, type = '') {
        if (itemOrId == null) return '';
        if (typeof itemOrId === 'string' || typeof itemOrId === 'number') return String(itemOrId);
        const normalizedType = this._normalizeDetailType(type || itemOrId.type || itemOrId.media_type);
        if (normalizedType === 'book') {
            return String(itemOrId.id || itemOrId.volume_id || itemOrId.item_id || itemOrId.book_id || '').trim();
        }
        return String(itemOrId.id || itemOrId.tmdb_id || itemOrId.item_id || itemOrId.media_id || itemOrId.volume_id || '').trim();
    },

    _getDetailUrl(itemOrId, type = '') {
        if (itemOrId && typeof itemOrId === 'object' && itemOrId.url) {
            try {
                const parsed = new URL(itemOrId.url, window.location.origin);
                if (/^\/desc(movie|tv|book)\//.test(parsed.pathname)) return parsed.pathname + (parsed.search || '');
            } catch (_) {}
        }
        const normalizedType = this._normalizeDetailType(type || (itemOrId && typeof itemOrId === 'object' ? itemOrId.type || itemOrId.media_type : ''));
        const itemId = this._getItemId(itemOrId, normalizedType);
        if (!itemId) return '';
        const lang = I18N.current || 'uk';
        const prefix = normalizedType === 'movie' ? 'descmovie' : normalizedType === 'tv' ? 'desctv' : 'descbook';
        return '/' + prefix + '/' + encodeURIComponent(itemId) + '?lang=' + encodeURIComponent(lang);
    },

    goToDetailPage(itemId, type) {
        const url = this._getDetailUrl(itemId, type);
        if (!url) {
            UI.showToast(I18N.current === 'en' ? 'Could not open details' : '?? ??????? ???????? ????');
            return;
        }
        window.location.href = url;
    },

    // ─── Detail Page (modal fallback) ───
    async openDetailPage(itemId, type) {
        // Normalize type: 'movies' -> 'movie', 'books' -> 'book'
        if (type === 'movies') type = 'movie';
        if (type === 'books') type = 'book';

        const modal = document.getElementById('detail-modal');
        const page = document.getElementById('detail-page');
        if (!modal || !page) return;

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        page.innerHTML = '<div class="detail-loading"><div class="skeleton skeleton-poster-detail"></div><div class="skeleton skeleton-title" style="width:60%;height:24px;margin-top:20px"></div><div class="skeleton skeleton-text" style="width:100%;height:80px;margin-top:12px"></div></div>';

        let data;
        if (type === 'movie') {
            data = await API.getMovieDetails(itemId);
        } else if (type === 'tv') {
            data = await API.getTvDetails(itemId);
        } else {
            data = await API.getBookDetails(itemId);
        }

        if (!data) {
            page.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8">'+_escHtml(I18N.t('loadError'))+'</div>';
            return;
        }

        if (type === 'book') {
            this._renderBookDetailPage(page, data);
        } else {
            this._renderTmdbDetailPage(page, data, type);
        }
    },

    _renderTmdbDetailPage(container, data, type) {
        const posterUrl = data.poster_path ? CONFIG.TMDB_IMG + data.poster_path : CONFIG.FALLBACK_POSTER;
        const backdropUrl = data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : '';
        const title = data.title || data.name || '';
        const year = (data.release_date || data.first_air_date || '').split('-')[0] || '—';
        const rating = (data.vote_average || 0).toFixed(1);
        const runtime = data.runtime ? `${data.runtime} ${I18N.current === 'uk' ? 'хв' : 'min'}` : '';
        const budget = data.budget ? `$${(data.budget / 1000000).toFixed(1)}M` : '';
        const revenue = data.revenue ? `$${(data.revenue / 1000000).toFixed(1)}M` : '';
        const seasons = data.number_of_seasons ? `${data.number_of_seasons} ${I18N.current === 'uk' ? 'сезонів' : 'seasons'}` : '';
        const episodes = data.number_of_episodes ? `${data.number_of_episodes} ${I18N.current === 'uk' ? 'епізодів' : 'episodes'}` : '';
        const contentId = data.id;
        const contentType = type;

        let html = '';

        // Backdrop
        if (backdropUrl) {
            html += `<img class="detail-backdrop" src="${_escHtml(backdropUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`;
        } else {
            html += '<div class="detail-backdrop-placeholder"></div>';
        }

        // Main: poster + header
        html += `<div class="detail-main">`;
        html += `<img class="detail-poster" src="${_escHtml(posterUrl)}" alt="${_escHtml(title)}" loading="lazy" onerror="this.src='${CONFIG.FALLBACK_POSTER}'">`;
        html += `<div class="detail-header">`;
        html += `<h1 class="detail-title">${_escHtml(title)}</h1>`;
        if (data.tagline) html += `<div class="detail-tagline">${_escHtml(data.tagline)}</div>`;
        html += `<div class="detail-badges">`;
        html += `<span class="detail-badge detail-badge-rating">⭐ ${_escHtml(rating)}</span>`;
        html += `<span class="detail-badge detail-badge-year">📅 ${_escHtml(year)}</span>`;
        if (runtime) html += `<span class="detail-badge detail-badge-runtime">⏱️ ${_escHtml(runtime)}</span>`;
        if (seasons) html += `<span class="detail-badge detail-badge-runtime">📺 ${_escHtml(seasons)}</span>`;
        html += `</div>`;
        html += `</div></div>`;

        // Genres
        if (data.genres && data.genres.length) {
            html += '<div class="detail-genres">';
            data.genres.forEach(g => { html += `<span class="detail-genre-tag">${_escHtml(g.name)}</span>`; });
            html += '</div>';
        }

        // Actions
        html += '<div class="detail-actions">';
        html += `<button class="detail-action-btn detail-action-primary" onclick="App.saveFromDetail('${contentType}', ${contentId})">❤️ ${_escHtml(I18N.t('save'))}</button>`;
        if (type !== 'book') {
            html += `<button class="detail-action-btn detail-action-secondary" onclick="App.playTrailerFromDetail('${contentType}', ${contentId})">▶ ${_escHtml(I18N.t('trailer'))}</button>`;
        }
        html += `<a class="detail-action-btn detail-action-secondary" href="https://www.themoviedb.org/${type}/${contentId}" target="_blank" rel="noopener">TMDB</a>`;
        html += '</div>';

        // Overview
        if (data.overview) {
            html += `<div class="detail-overview"><p>${_escHtml(data.overview)}</p></div>`;
        }

        // Meta grid
        html += '<div class="detail-meta-grid">';
        if (budget) html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Бюджет' : 'Budget'}</div><div class="detail-meta-value">${_escHtml(budget)}</div></div>`;
        if (revenue) html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Касові збори' : 'Revenue'}</div><div class="detail-meta-value">${_escHtml(revenue)}</div></div>`;
        if (episodes) html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Епізоди' : 'Episodes'}</div><div class="detail-meta-value">${_escHtml(episodes)}</div></div>`;
        if (data.status) html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Статус' : 'Status'}</div><div class="detail-meta-value">${_escHtml(data.status)}</div></div>`;
        if (data.production_countries && data.production_countries.length) {
            html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Країна' : 'Country'}</div><div class="detail-meta-value">${_escHtml(data.production_countries.join(', '))}</div></div>`;
        }
        if (data.spoken_languages && data.spoken_languages.length) {
            html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Мови' : 'Languages'}</div><div class="detail-meta-value">${_escHtml(data.spoken_languages.join(', '))}</div></div>`;
        }
        if (data.networks && data.networks.length) {
            html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Мережа' : 'Network'}</div><div class="detail-meta-value">${_escHtml(data.networks.map(n => n.name).join(', '))}</div></div>`;
        }
        if (data.created_by && data.created_by.length) {
            html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Автор' : 'Created by'}</div><div class="detail-meta-value">${_escHtml(data.created_by.map(c => c.name).join(', '))}</div></div>`;
        }
        html += '</div>';

        // TV Show: status badge + seasons progress bar
        if (type === 'tv' && data.status) {
            const isUk = I18N.current === 'uk';
            const statusMap = {
                'Returning Series': isUk ? 'Продовжується' : 'Returning',
                'Ended': isUk ? 'Завершено' : 'Ended',
                'Canceled': isUk ? 'Скасовано' : 'Canceled',
                'In Production': isUk ? 'У виробництві' : 'In Production',
                'Planned': isUk ? 'Заплановано' : 'Planned',
                'Pilot': isUk ? 'Пілот' : 'Pilot',
            };
            const statusLabel = statusMap[data.status] || data.status;
            const isEnded = data.status === 'Ended' || data.status === 'Canceled';
            const statusClass = isEnded ? 'detail-status-ended' : 'detail-status-ongoing';
            html += `<div class="detail-tv-status-section">`;
            html += `<div class="detail-tv-status-header">`;
            html += `<span class="detail-tv-status-badge ${statusClass}">${isEnded ? '🏁' : '📡'} ${_escHtml(statusLabel)}</span>`;
            if (data.number_of_seasons) html += `<span class="detail-tv-stat">${data.number_of_seasons} ${isUk ? 'сезонів' : 'seasons'}</span>`;
            if (data.number_of_episodes) html += `<span class="detail-tv-stat">${data.number_of_episodes} ${isUk ? 'епізодів' : 'episodes'}</span>`;
            html += `</div>`;

            // Seasons progress bar
            if (data.seasons && data.seasons.length) {
                const regularSeasons = data.seasons.filter(s => s.season_number > 0);
                if (regularSeasons.length) {
                    const totalEpisodes = regularSeasons.reduce((sum, s) => sum + (s.episode_count || 0), 0);
                    html += `<div class="detail-seasons-progress">`;
                    html += `<div class="detail-seasons-title">${isUk ? 'Сезони' : 'Seasons'}</div>`;
                    html += `<div class="detail-seasons-bar-wrap">`;
                    regularSeasons.forEach(s => {
                        const pct = totalEpisodes > 0 ? ((s.episode_count / totalEpisodes) * 100).toFixed(1) : 0;
                        const aired = s.air_date ? (new Date(s.air_date) <= new Date()) : false;
                        const segClass = aired ? 'detail-season-seg-aired' : 'detail-season-seg-upcoming';
                        html += `<div class="detail-season-seg ${segClass}" style="width:${pct}%" title="S${s.season_number}: ${s.episode_count} ${isUk ? 'еп.' : 'ep.'}${s.air_date ? ' (' + s.air_date.split('-')[0] + ')' : ''}">`;
                        html += `<span class="detail-season-seg-label">S${s.season_number}</span>`;
                        html += `</div>`;
                    });
                    html += `</div>`;
                    html += `<div class="detail-seasons-legend">`;
                    regularSeasons.forEach(s => {
                        html += `<div class="detail-season-legend-item">`;
                        html += `<strong>S${s.season_number}</strong>: ${s.episode_count} ${isUk ? 'еп.' : 'ep.'}`;
                        if (s.air_date) html += ` (${s.air_date.split('-')[0]})`;
                        html += `</div>`;
                    });
                    html += `</div></div>`;
                }
            }
            html += `</div>`;
        }

        // Directors
        if (data.directors && data.directors.length) {
            html += `<div class="detail-directors">`;
            data.directors.forEach(d => {
                html += `<span class="detail-director-tag">🎬 ${_escHtml(d.name)}</span>`;
            });
            html += `</div>`;
        }

        // Cast
        if (data.cast && data.cast.length) {
            html += `<div class="detail-section">`;
            html += `<div class="detail-section-title">🎭 ${I18N.current === 'uk' ? 'Актори' : 'Cast'}</div>`;
            html += `<div class="detail-cast-scroll">`;
            data.cast.forEach(person => {
                const photo = person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : '';
                const photoTag = photo
                    ? `<img class="detail-cast-photo" src="${_escHtml(photo)}" alt="${_escHtml(person.name)}" loading="lazy">`
                    : `<div class="detail-cast-photo" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem">👤</div>`;
                html += `<div class="detail-cast-card">${photoTag}<div class="detail-cast-name">${_escHtml(person.name)}</div><div class="detail-cast-character">${_escHtml(person.character || '')}</div></div>`;
            });
            html += `</div></div>`;
        }

        // Trailers
        if (data.videos && data.videos.length) {
            const trailer = data.videos.find(v => v.type === 'Trailer') || data.videos[0];
            html += `<div class="detail-section">`;
            html += `<div class="detail-section-title">▶ ${I18N.current === 'uk' ? 'Трейлер' : 'Trailer'}</div>`;
            html += `<div class="detail-trailer-wrap"><iframe src="https://www.youtube.com/embed/${_escHtml(trailer.key)}" allowfullscreen allow="autoplay" loading="lazy"></iframe></div>`;
            html += `</div>`;
        }

        // Community Rating
        html += `<div class="detail-community-section">`;
        html += `<div class="detail-section-title">💜 ${I18N.current === 'uk' ? 'Рейтинг Picksy' : 'Picksy Rating'}</div>`;
        const community = data.community_rating || { average: 0, count: 0 };
        html += `<div class="detail-community-rating">`;
        html += `<div class="detail-community-score" id="detail-community-score">${community.average || '—'}</div>`;
        html += `<div class="detail-community-info">`;
        html += `<div class="detail-community-label">${I18N.current === 'uk' ? 'Оцінка спільноти Picksy' : 'Picksy community rating'}</div>`;
        html += `<div class="detail-community-count" id="detail-community-count">${community.count} ${I18N.current === 'uk' ? 'оцінок' : 'votes'}</div>`;
        html += `<div class="detail-community-stars" id="detail-community-stars">`;
        for (let i = 1; i <= 10; i++) {
            html += `<button class="detail-community-star" data-val="${i}" onclick="App.submitDetailRating('${contentType}', '${contentId}', ${i})">${i}</button>`;
        }
        html += `</div></div></div></div>`;

        // Similar
        if (data.similar && data.similar.length) {
            html += `<div class="detail-section">`;
            html += `<div class="detail-section-title">🎯 ${I18N.current === 'uk' ? 'Схожі на це' : 'Similar'}</div>`;
            html += `<div class="detail-similar-scroll">`;
            data.similar.forEach(item => {
                const simPoster = item.poster_path ? CONFIG.TMDB_IMG + item.poster_path : CONFIG.FALLBACK_POSTER;
                const simRating = (item.vote_average || 0).toFixed(1);
                html += `<div class="detail-similar-card" onclick="App.goToDetailPage(${item.id}, '${contentType}')">`;
                html += `<img class="detail-similar-poster" src="${_escHtml(simPoster)}" alt="${_escHtml(item.title)}" loading="lazy">`;
                html += `<div class="detail-similar-title">${_escHtml(item.title)}</div>`;
                html += `<div class="detail-similar-rating">⭐ ${simRating}</div>`;
                html += `</div>`;
            });
            html += `</div></div>`;
        }

        // TMDB Reviews
        if (data.tmdb_reviews && data.tmdb_reviews.length) {
            html += `<div class="detail-section">`;
            html += `<div class="detail-section-title">💬 ${I18N.current === 'uk' ? 'Відгуки TMDB' : 'TMDB Reviews'}</div>`;
            html += `<div class="detail-reviews-list">`;
            data.tmdb_reviews.forEach(r => {
                const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : '';
                html += `<div class="detail-review-card">`;
                html += `<div class="detail-review-header">`;
                html += `<span class="detail-review-avatar">👤</span>`;
                html += `<span class="detail-review-author">${_escHtml(r.author)}</span>`;
                if (r.rating) html += `<span class="detail-review-rating">⭐ ${r.rating}/10</span>`;
                html += `<span class="detail-review-date">${_escHtml(date)}</span>`;
                html += `</div>`;
                html += `<div class="detail-review-text">${_escHtml(r.content)}</div>`;
                if (r.content && r.content.length > 200) {
                    html += `<button class="detail-review-expand" onclick="this.previousElementSibling.classList.toggle('expanded');this.textContent=this.previousElementSibling.classList.contains('expanded')?'${I18N.current === 'uk' ? 'Згорнути' : 'Collapse'}':'${I18N.current === 'uk' ? 'Читати далі' : 'Read more'}';">${I18N.current === 'uk' ? 'Читати далі' : 'Read more'}</button>`;
                }
                html += `</div>`;
            });
            html += `</div></div>`;
        }

        // Picksy User Reviews
        html += `<div class="detail-section">`;
        html += `<div class="detail-section-title">📝 ${I18N.current === 'uk' ? 'Відгуки користувачів Picksy' : 'Picksy User Reviews'}</div>`;
        html += `<div class="detail-reviews-list" id="detail-user-reviews"></div>`;
        if (Auth.user) {
            html += `<div class="detail-review-form">`;
            html += `<textarea class="detail-review-textarea" id="detail-review-text" placeholder="${I18N.current === 'uk' ? 'Напишіть ваш відгук...' : 'Write your review...'}" maxlength="2000"></textarea>`;
            html += `<button class="detail-review-submit" onclick="App.submitDetailReview('${contentType}', '${contentId}')">${I18N.current === 'uk' ? 'Надіслати відгук' : 'Submit review'}</button>`;
            html += `</div>`;
        }
        html += `</div>`;

        container.innerHTML = html;

        // Load user reviews async
        this._loadDetailReviews(contentType, String(contentId));
    },

    _renderBookDetailPage(container, data) {
        const posterUrl = data.poster || CONFIG.FALLBACK_BOOK_POSTER;
        const title = data.title || '';
        const year = data.year || '—';
        const rating = data.average_rating ? Number(data.average_rating).toFixed(1) : '—';
        const contentId = data.id;

        let html = '<div class="detail-backdrop-placeholder" style="height:80px"></div>';

        html += `<div class="detail-main">`;
        html += `<img class="detail-poster" src="${_escHtml(posterUrl)}" alt="${_escHtml(title)}" loading="lazy" style="aspect-ratio:auto">`;
        html += `<div class="detail-header">`;
        html += `<h1 class="detail-title">${_escHtml(title)}</h1>`;
        if (data.subtitle) html += `<div class="detail-tagline">${_escHtml(data.subtitle)}</div>`;
        html += `<div class="detail-badges">`;
        if (rating !== '—') html += `<span class="detail-badge detail-badge-rating">⭐ ${_escHtml(rating)}</span>`;
        html += `<span class="detail-badge detail-badge-year">📅 ${_escHtml(year)}</span>`;
        if (data.page_count) html += `<span class="detail-badge detail-badge-runtime">📄 ${data.page_count} ${I18N.current === 'uk' ? 'стор.' : 'pages'}</span>`;
        html += `</div>`;
        html += `</div></div>`;

        // Categories
        if (data.categories && data.categories.length) {
            html += '<div class="detail-genres">';
            data.categories.forEach(c => { html += `<span class="detail-genre-tag">${_escHtml(c)}</span>`; });
            html += '</div>';
        }

        // Actions
        html += '<div class="detail-actions">';
        html += `<button class="detail-action-btn detail-action-primary" onclick="App.saveFromDetail('book', '${_escHtml(contentId)}')">❤️ ${_escHtml(I18N.t('save'))}</button>`;
        if (data.preview_link) {
            html += `<a class="detail-action-btn detail-action-secondary" href="${_escHtml(data.preview_link)}" target="_blank" rel="noopener">📖 ${I18N.current === 'uk' ? 'Переглянути' : 'Preview'}</a>`;
        }
        if (data.info_link) {
            html += `<a class="detail-action-btn detail-action-secondary" href="${_escHtml(data.info_link)}" target="_blank" rel="noopener">Google Books</a>`;
        }
        html += '</div>';

        // Description
        if (data.description) {
            const desc = data.description.replace(/<[^>]*>/g, '');
            html += `<div class="detail-overview"><p>${_escHtml(desc)}</p></div>`;
        }

        // Meta
        html += '<div class="detail-meta-grid">';
        if (data.authors && data.authors.length) html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Автори' : 'Authors'}</div><div class="detail-meta-value">${_escHtml(data.authors.join(', '))}</div></div>`;
        if (data.publisher) html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Видавництво' : 'Publisher'}</div><div class="detail-meta-value">${_escHtml(data.publisher)}</div></div>`;
        if (data.isbn) html += `<div class="detail-meta-item"><div class="detail-meta-label">ISBN</div><div class="detail-meta-value">${_escHtml(data.isbn)}</div></div>`;
        if (data.language) html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Мова' : 'Language'}</div><div class="detail-meta-value">${_escHtml(data.language.toUpperCase())}</div></div>`;
        if (data.ratings_count) html += `<div class="detail-meta-item"><div class="detail-meta-label">${I18N.current === 'uk' ? 'Кількість оцінок' : 'Ratings'}</div><div class="detail-meta-value">${data.ratings_count}</div></div>`;
        html += '</div>';

        // Community Rating
        html += `<div class="detail-community-section">`;
        html += `<div class="detail-section-title">💜 ${I18N.current === 'uk' ? 'Рейтинг Picksy' : 'Picksy Rating'}</div>`;
        html += `<div class="detail-community-rating">`;
        html += `<div class="detail-community-score" id="detail-community-score">—</div>`;
        html += `<div class="detail-community-info">`;
        html += `<div class="detail-community-label">${I18N.current === 'uk' ? 'Оцінка спільноти Picksy' : 'Picksy community rating'}</div>`;
        html += `<div class="detail-community-count" id="detail-community-count">0 ${I18N.current === 'uk' ? 'оцінок' : 'votes'}</div>`;
        html += `<div class="detail-community-stars" id="detail-community-stars">`;
        for (let i = 1; i <= 10; i++) {
            html += `<button class="detail-community-star" data-val="${i}" onclick="App.submitDetailRating('book', '${_escHtml(contentId)}', ${i})">${i}</button>`;
        }
        html += `</div></div></div></div>`;

        // User Reviews
        html += `<div class="detail-section">`;
        html += `<div class="detail-section-title">📝 ${I18N.current === 'uk' ? 'Відгуки користувачів Picksy' : 'Picksy User Reviews'}</div>`;
        html += `<div class="detail-reviews-list" id="detail-user-reviews"></div>`;
        if (Auth.user) {
            html += `<div class="detail-review-form">`;
            html += `<textarea class="detail-review-textarea" id="detail-review-text" placeholder="${I18N.current === 'uk' ? 'Напишіть ваш відгук...' : 'Write your review...'}" maxlength="2000"></textarea>`;
            html += `<button class="detail-review-submit" onclick="App.submitDetailReview('book', '${_escHtml(contentId)}')">${I18N.current === 'uk' ? 'Надіслати відгук' : 'Submit review'}</button>`;
            html += `</div>`;
        }
        html += `</div>`;

        container.innerHTML = html;
        this._loadDetailReviews('book', String(contentId));
    },

    async _loadDetailReviews(contentType, contentId) {
        const container = document.getElementById('detail-user-reviews');
        if (!container) return;
        const data = await API.getReviews(contentType, contentId);
        if (!data.reviews || data.reviews.length === 0) {
            container.innerHTML = `<p style="color:#64748b;font-size:.85rem">${I18N.current === 'uk' ? 'Поки немає відгуків. Будьте першим!' : 'No reviews yet. Be the first!'}</p>`;
            return;
        }
        container.innerHTML = data.reviews.map(r => `
            <div class="detail-review-card">
                <div class="detail-review-header">
                    <span class="detail-review-avatar">${r.avatar || '👤'}</span>
                    <span class="detail-review-author">${_escHtml(r.username)}</span>
                    ${r.rating ? `<span class="detail-review-rating">⭐ ${r.rating}/10</span>` : ''}
                    <span class="detail-review-date">${_escHtml(r.created_at ? new Date(r.created_at).toLocaleDateString() : '')}</span>
                </div>
                <div class="detail-review-text">${_escHtml(r.text)}</div>
            </div>
        `).join('');
    },

    async submitDetailRating(contentType, contentId, rating) {
        if (!Auth.user) {
            UI.showToast(I18N.t('saveHint'));
            Auth.showModal('login');
            return;
        }
        const result = await API.submitCommunityRating(contentType, contentId, rating);
        if (result) {
            UI.showToast(I18N.t('ratingSaved'));
            // Update display
            const scoreEl = document.getElementById('detail-community-score');
            const stars = document.querySelectorAll('.detail-community-star');
            stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.val) <= rating);
            });
            // Refresh community rating
            const updated = await API.getCommunityRating(contentType, contentId);
            if (scoreEl && updated) {
                scoreEl.textContent = updated.average || '—';
                const countEl = document.getElementById('detail-community-count');
                if (countEl) countEl.textContent = `${updated.count} ${I18N.current === 'uk' ? 'оцінок' : 'votes'}`;
            }
        }
    },

    async submitDetailReview(contentType, contentId) {
        if (!Auth.user) {
            UI.showToast(I18N.t('saveHint'));
            Auth.showModal('login');
            return;
        }
        const textarea = document.getElementById('detail-review-text') as HTMLTextAreaElement;
        if (!textarea || !textarea.value.trim()) return;
        const result = await API.submitReview(contentType, contentId, textarea.value.trim(), null);
        if (result) {
            UI.showToast(I18N.current === 'uk' ? 'Відгук надіслано!' : 'Review submitted!');
            textarea.value = '';
            this._loadDetailReviews(contentType, contentId);
        }
    },

    saveFromDetail(type, itemId) {
        if (!Auth.user) {
            UI.showToast(I18N.t('saveHint'));
            Auth.showModal('login');
            return;
        }
        if (this.currentItem && String(this.currentItem.id) === String(itemId)) {
            this.toggleSave();
        } else {
            UI.showToast(I18N.current === 'uk' ? 'Спочатку підберіть цей фільм' : 'Pick this item first');
        }
    },

    async playTrailerFromDetail(type, itemId) {
        const videos = type === 'tv'
            ? await API.getTvVideos(itemId)
            : await API.getMovieVideos(itemId);
        if (!videos.length) {
            UI.showToast(I18N.t('trailerNotFound'));
            return;
        }
        const trailer = videos.find(v => v.type === 'Trailer') || videos[0];
        UI.showTrailerModal(trailer.key);
    },

    closeDetailPage() {
        const modal = document.getElementById('detail-modal');
        if (modal) {
            const iframes = modal.querySelectorAll('iframe');
            iframes.forEach(iframe => iframe.src = '');
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    },

    // ─── AI Mood Analysis ───
    async analyzeMoodText() {
        const input = document.getElementById('mood-ai-input') as HTMLInputElement;
        if (!input || !input.value.trim()) return;

        const text = input.value.trim();
        const aiType = this.currentTab === 'tv' ? 'tv' : (this.currentTab === 'books' ? 'book' : 'movie');
        const lang = I18N.current;

        UI.showLoading(I18N.current === 'uk' ? 'AI аналізує настрій...' : 'AI analyzing mood...');

        const result = await API.analyzeMood(text, aiType, lang);
        UI.hideLoading();

        if (!result || (!result.genres.length && !result.subject)) {
            UI.showToast(I18N.current === 'uk' ? 'Не вдалося визначити настрій' : 'Could not determine mood');
            return;
        }

        // Apply mood filters
        if (aiType === 'book' && result.subject) {
            if (UI.els.bookSubject) UI.els.bookSubject.value = result.subject;
        } else if (result.genres.length) {
            const genreStr = result.genres.join(',');
            if (aiType === 'movie') {
                UI.els.movieGenre.value = result.genres[0] || '';
            } else if (aiType === 'tv' && UI.els.tvGenre) {
                UI.els.tvGenre.value = result.genres[0] || '';
            }
        }

        if (result.rating_min > 0) {
            if (aiType === 'movie') {
                UI.els.movieRating.value = String(result.rating_min);
                UI.els.movieRatingVal.textContent = String(result.rating_min);
            } else if (aiType === 'tv' && UI.els.tvRating) {
                UI.els.tvRating.value = String(result.rating_min);
                UI.els.tvRatingVal.textContent = String(result.rating_min);
            }
        }

        API.reset();

        // Show result description
        UI.showToast(`${result.mood_emoji} ${result.mood_name}: ${result.description}`.slice(0, 120));

        // Auto-pick with new filters
        await this.pick();
    },

    // ─── Movie Night ───
    _movieNight: {
        participants: [],
        currentParticipant: 0,
        selections: {},
        phase: 'setup', // setup | picking | voting | result | countdown
        winner: null,
        votes: {},
        countdownEnd: null,
        countdownInterval: null,
    },

    openMovieNight() {
        this._movieNight = {
            participants: [],
            currentParticipant: 0,
            selections: {},
            phase: 'setup',
            winner: null,
            votes: {},
            countdownEnd: null,
            countdownInterval: null,
        };
        document.getElementById('movie-night-modal').classList.remove('hidden');
        this.renderMovieNight();
    },

    closeMovieNight() {
        if (this._movieNight.countdownInterval) {
            clearInterval(this._movieNight.countdownInterval);
        }
        document.getElementById('movie-night-modal').classList.add('hidden');
    },

    renderMovieNight() {
        const container = document.getElementById('movie-night-app');
        if (!container) return;
        const mn = this._movieNight;

        if (mn.phase === 'setup') {
            container.innerHTML = `
                <h2 class="mn-title">🍿 ${I18N.t('movieNight')}</h2>
                <p class="mn-desc">${I18N.t('movieNightDesc')}</p>
                <div class="mn-participants">
                    <input type="text" class="mn-input" id="mn-name-input" placeholder="${I18N.t('participantName')}" maxlength="20">
                    <button class="mn-add-btn" id="mn-add-participant">+</button>
                </div>
                <div class="mn-names" id="mn-names-list">
                    ${mn.participants.map((p, i) => `<span class="mn-name-tag">${p} <button class="mn-remove-p" data-idx="${i}">&times;</button></span>`).join('')}
                </div>
                <p class="mn-hint">${I18N.t('movieNightMin')}</p>
                <button class="btn-primary mn-start-btn ${mn.participants.length < 2 ? 'disabled' : ''}" id="mn-start-picking" ${mn.participants.length < 2 ? 'disabled' : ''}>${I18N.t('startPicking')}</button>
            `;
            document.getElementById('mn-add-participant').addEventListener('click', () => {
                const input = document.getElementById('mn-name-input') as HTMLInputElement;
                const name = input.value.trim();
                if (name && mn.participants.length < 8) {
                    mn.participants.push(name);
                    this.renderMovieNight();
                }
            });
            document.getElementById('mn-name-input').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') document.getElementById('mn-add-participant').click();
            });
            container.querySelectorAll('.mn-remove-p').forEach(btn => {
                btn.addEventListener('click', () => {
                    mn.participants.splice(parseInt(btn.dataset.idx), 1);
                    this.renderMovieNight();
                });
            });
            const startBtn = document.getElementById('mn-start-picking');
            if (startBtn) startBtn.addEventListener('click', () => {
                if (mn.participants.length >= 2) {
                    mn.phase = 'picking';
                    mn.currentParticipant = 0;
                    mn.participants.forEach(p => { mn.selections[p] = []; });
                    this.renderMovieNight();
                }
            });
        } else if (mn.phase === 'picking') {
            const person = mn.participants[mn.currentParticipant];
            const picks = mn.selections[person] || [];
            container.innerHTML = `
                <h2 class="mn-title">🎬 ${person}</h2>
                <p class="mn-desc">${I18N.t('pickMovies').replace('{n}', String(3 - picks.length))}</p>
                <div class="mn-picks">
                    ${picks.map((p, i) => `
                        <div class="mn-pick-card">
                            <img src="${p.poster}" alt="" class="mn-pick-poster">
                            <span class="mn-pick-title">${p.title}</span>
                            <button class="mn-pick-remove" data-idx="${i}">&times;</button>
                        </div>
                    `).join('')}
                </div>
                <div class="mn-search">
                    <input type="text" class="mn-input mn-search-input" id="mn-search-input" placeholder="${I18N.t('searchMovie')}">
                    <button class="mn-search-btn" id="mn-search-btn">🔍</button>
                </div>
                <div class="mn-search-results" id="mn-search-results"></div>
                ${picks.length >= 3 ? `<button class="btn-primary mn-next-btn" id="mn-next-person">${mn.currentParticipant < mn.participants.length - 1 ? I18N.t('nextPerson') : I18N.t('startVoting')}</button>` : ''}
            `;
            const searchBtn = document.getElementById('mn-search-btn');
            const searchInput = document.getElementById('mn-search-input');
            const doSearch = async () => {
                const q = (searchInput as HTMLInputElement).value.trim();
                if (!q) return;
                const results = document.getElementById('mn-search-results');
                results.innerHTML = '<p class="mn-loading">' + I18N.t('loading') + '</p>';
                try {
                    const lang = I18N.current || 'uk';
                    const res = await fetch(`${CONFIG.API_URL}/api/tmdb/search/movie?query=${encodeURIComponent(q)}&language=${lang}&page=1`);
                    const data = await res.json();
                    const movies = (data.results || []).slice(0, 6);
                    results.innerHTML = movies.map(m => `
                        <div class="mn-result" data-id="${m.id}">
                            <img src="${m.poster_path ? CONFIG.TMDB_IMG + m.poster_path : CONFIG.FALLBACK_POSTER}" alt="" class="mn-result-poster">
                            <div class="mn-result-info">
                                <div class="mn-result-title">${m.title || m.name || ''}</div>
                                <div class="mn-result-year">${(m.release_date || '').split('-')[0]}</div>
                            </div>
                        </div>
                    `).join('') || `<p class="mn-no-results">${I18N.t('notFound')}</p>`;
                    results.querySelectorAll('.mn-result').forEach(el => {
                        el.addEventListener('click', () => {
                            const movie = movies.find(m => String(m.id) === el.dataset.id);
                            if (movie && picks.length < 3) {
                                picks.push({
                                    id: movie.id,
                                    title: movie.title || movie.name || '',
                                    poster: movie.poster_path ? CONFIG.TMDB_IMG + movie.poster_path : CONFIG.FALLBACK_POSTER,
                                    year: (movie.release_date || '').split('-')[0],
                                });
                                mn.selections[person] = picks;
                                this.renderMovieNight();
                            }
                        });
                    });
                } catch {
                    results.innerHTML = `<p class="mn-no-results">${I18N.t('loadError')}</p>`;
                }
            };
            searchBtn.addEventListener('click', doSearch);
            searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
            container.querySelectorAll('.mn-pick-remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    picks.splice(parseInt(btn.dataset.idx), 1);
                    mn.selections[person] = picks;
                    this.renderMovieNight();
                });
            });
            const nextBtn = document.getElementById('mn-next-person');
            if (nextBtn) nextBtn.addEventListener('click', () => {
                if (mn.currentParticipant < mn.participants.length - 1) {
                    mn.currentParticipant++;
                    this.renderMovieNight();
                } else {
                    mn.phase = 'voting';
                    mn.votes = {};
                    this.renderMovieNight();
                }
            });
        } else if (mn.phase === 'voting') {
            const allMovies = [];
            mn.participants.forEach(p => {
                (mn.selections[p] || []).forEach(m => {
                    if (!allMovies.some(x => x.id === m.id)) allMovies.push({ ...m, nominatedBy: p });
                });
            });
            const voteCounts = {};
            allMovies.forEach(m => { voteCounts[m.id] = 0; });
            Object.values(mn.votes).forEach(movieId => { if (voteCounts[movieId] !== undefined) voteCounts[movieId]++; });
            const totalVotes = Object.keys(mn.votes).length;
            const allVoted = totalVotes >= mn.participants.length;

            container.innerHTML = `
                <h2 class="mn-title">🗳️ ${I18N.t('voteTitle')}</h2>
                <p class="mn-desc">${I18N.t('voteDesc')}</p>
                <div class="mn-vote-list">
                    ${allMovies.map(m => `
                        <div class="mn-vote-card ${mn.votes[mn.participants[0]] === m.id ? 'voted' : ''}" data-id="${m.id}">
                            <img src="${m.poster}" alt="" class="mn-vote-poster">
                            <div class="mn-vote-info">
                                <div class="mn-vote-title">${m.title}</div>
                                <div class="mn-vote-by">${I18N.t('nominatedBy')} ${m.nominatedBy}</div>
                                <div class="mn-vote-count">${voteCounts[m.id]} ${I18N.t('votes')}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="mn-voter-select">
                    <label>${I18N.t('votingAs')}:</label>
                    <select id="mn-voter-select">
                        ${mn.participants.map(p => `<option value="${p}" ${mn.votes[p] !== undefined ? 'disabled' : ''}>${p} ${mn.votes[p] !== undefined ? '✓' : ''}</option>`).join('')}
                    </select>
                </div>
                ${allVoted ? `<button class="btn-primary mn-result-btn" id="mn-show-result">${I18N.t('showResult')}</button>` : `<p class="mn-hint">${I18N.t('waitingVotes').replace('{n}', String(mn.participants.length - totalVotes))}</p>`}
            `;
            container.querySelectorAll('.mn-vote-card').forEach(card => {
                card.addEventListener('click', () => {
                    const voter = (document.getElementById('mn-voter-select') as HTMLSelectElement).value;
                    if (mn.votes[voter] !== undefined) return;
                    mn.votes[voter] = parseInt(card.dataset.id);
                    this.renderMovieNight();
                });
            });
            const resultBtn = document.getElementById('mn-show-result');
            if (resultBtn) resultBtn.addEventListener('click', () => {
                // Find winner by most votes, or random if tie
                let maxVotes = 0;
                const voteCounts2 = {};
                allMovies.forEach(m => { voteCounts2[m.id] = 0; });
                Object.values(mn.votes).forEach(movieId => { voteCounts2[movieId]++; });
                allMovies.forEach(m => { if (voteCounts2[m.id] > maxVotes) maxVotes = voteCounts2[m.id]; });
                const winners = allMovies.filter(m => voteCounts2[m.id] === maxVotes);
                mn.winner = winners[Math.floor(Math.random() * winners.length)];
                mn.phase = 'result';
                this.renderMovieNight();
            });
        } else if (mn.phase === 'result') {
            container.innerHTML = `
                <h2 class="mn-title">🎉 ${I18N.t('movieNightWinner')}</h2>
                <div class="mn-winner-card">
                    <img src="${mn.winner.poster}" alt="" class="mn-winner-poster">
                    <div class="mn-winner-info">
                        <h3 class="mn-winner-title">${mn.winner.title}</h3>
                        <p class="mn-winner-year">${mn.winner.year || ''}</p>
                    </div>
                </div>
                <button class="btn-primary mn-countdown-btn" id="mn-start-countdown">${I18N.t('startCountdown')}</button>
                <button class="mn-again-btn" id="mn-start-over">${I18N.t('startOver')}</button>
            `;
            document.getElementById('mn-start-countdown').addEventListener('click', () => {
                mn.phase = 'countdown';
                mn.countdownEnd = Date.now() + 10 * 60 * 1000; // 10 minutes
                this.renderMovieNight();
            });
            document.getElementById('mn-start-over').addEventListener('click', () => {
                this.openMovieNight();
            });
        } else if (mn.phase === 'countdown') {
            const remaining = Math.max(0, mn.countdownEnd - Date.now());
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            container.innerHTML = `
                <h2 class="mn-title">⏳ ${I18N.t('countdownTitle')}</h2>
                <p class="mn-desc">${I18N.t('countdownDesc')}</p>
                <div class="mn-countdown-display">
                    <span class="mn-countdown-time">${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}</span>
                </div>
                <div class="mn-winner-mini">
                    <img src="${mn.winner.poster}" alt="" class="mn-mini-poster">
                    <span class="mn-mini-title">${mn.winner.title}</span>
                </div>
                <div class="mn-countdown-btns">
                    <button class="mn-again-btn" id="mn-stop-countdown">${I18N.t('stopTimer')}</button>
                </div>
            `;
            if (mn.countdownInterval) clearInterval(mn.countdownInterval);
            mn.countdownInterval = setInterval(() => {
                const rem = Math.max(0, mn.countdownEnd - Date.now());
                const m = Math.floor(rem / 60000);
                const s = Math.floor((rem % 60000) / 1000);
                const timeEl = container.querySelector('.mn-countdown-time');
                if (timeEl) timeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                if (rem <= 0) {
                    clearInterval(mn.countdownInterval);
                    if (timeEl) timeEl.textContent = '🎬 ' + I18N.t('timeToWatch') + '!';
                }
            }, 1000);
            document.getElementById('mn-stop-countdown').addEventListener('click', () => {
                clearInterval(mn.countdownInterval);
                mn.phase = 'result';
                this.renderMovieNight();
            });
        }
    },

    // ─── Film for Two (Duo Room) ───
    _duo: {
        code: '',
        slot: '' as '' | 'creator' | 'joiner',
        phase: 'lobby' as 'lobby' | 'waiting' | 'prefs' | 'waitingMatch' | 'finding' | 'result',
        name: '',
        partnerName: '',
        selectedGenres: [] as string[],
        mood: '',
        result: null as any,
        pollTimer: null as any,
        history: null as any,
        historyLoading: false,
    },

    _duoGenres: [
        { id: '28', uk: 'Бойовик', en: 'Action' },
        { id: '12', uk: 'Пригоди', en: 'Adventure' },
        { id: '16', uk: 'Анімація', en: 'Animation' },
        { id: '35', uk: 'Комедія', en: 'Comedy' },
        { id: '80', uk: 'Кримінал', en: 'Crime' },
        { id: '18', uk: 'Драма', en: 'Drama' },
        { id: '14', uk: 'Фентезі', en: 'Fantasy' },
        { id: '27', uk: 'Жахи', en: 'Horror' },
        { id: '9648', uk: 'Детектив', en: 'Mystery' },
        { id: '10749', uk: 'Романтика', en: 'Romance' },
        { id: '878', uk: 'Фантастика', en: 'Sci-Fi' },
        { id: '53', uk: 'Трилер', en: 'Thriller' },
        { id: '10752', uk: 'Воєнний', en: 'War' },
        { id: '37', uk: 'Вестерн', en: 'Western' },
        { id: '99', uk: 'Документальний', en: 'Documentary' },
        { id: '10402', uk: 'Музичний', en: 'Music' },
        { id: '36', uk: 'Історичний', en: 'History' },
        { id: '10751', uk: 'Сімейний', en: 'Family' },
    ],

    openDuo() {
        if (!Auth.user || !Auth.token) {
            UI.showToast(I18N.t('duoLoginRequired'));
            Auth.showModal('login');
            return;
        }
        const userName = Auth.user.display_name || Auth.user.username || Auth.user.email?.split('@')[0] || 'User';
        this._duo = {
            code: '',
            slot: '',
            phase: 'lobby',
            name: userName,
            partnerName: '',
            selectedGenres: [],
            mood: '',
            result: null,
            pollTimer: null,
            history: null,
            historyLoading: false,
        };
        document.getElementById('duo-modal')!.classList.remove('hidden');
        this.renderDuo();
        this._duoLoadHistory();
    },

    async _duoLoadHistory() {
        if (!Auth || !Auth.token) { this._duo.history = []; return; }
        if (this._duo.historyLoading) return;
        this._duo.historyLoading = true;
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/duo/history?limit=12`, {
                headers: { 'Authorization': `Bearer ${Auth.token}` },
            });
            if (!res.ok) {
                this._duo.history = [];
            } else {
                const data = await res.json();
                this._duo.history = Array.isArray(data.items) ? data.items : [];
            }
        } catch (e) {
            this._duo.history = [];
        }
        this._duo.historyLoading = false;
        if (this._duo.phase === 'lobby') this.renderDuo();
    },

    _duoRenderHistory() {
        const t = (k: string) => I18N.t(k);
        const items = this._duo.history;
        if (items === null) {
            return `<div class="duo-history"><div class="duo-history-title">✨ ${t('duoHistoryTitle')}</div><div class="duo-history-empty"><span class="duo-spinner"></span> ${t('duoLoading') || '...'}</div></div>`;
        }
        if (!items.length) {
            return `<div class="duo-history"><div class="duo-history-title">✨ ${t('duoHistoryTitle')}</div><div class="duo-history-empty">${t('duoHistoryEmpty')}</div></div>`;
        }
        const cards = items.map((it: any) => {
            const id = it.item_id || it.tmdb_id || it.id;
            if (!id) return '';
            const mediaType = it.media_type === 'tv' ? 'tv' : 'movie';
            const href = this._getDetailUrl({ id, type: mediaType }, mediaType) || (mediaType === 'tv' ? `/desctv/${id}` : `/descmovie/${id}`);
            const poster = it.poster_path
                ? `https://image.tmdb.org/t/p/w185${it.poster_path}`
                : ((CONFIG && (CONFIG as any).FALLBACK_POSTER) || '');
            const title = (it.title || '').replace(/"/g, '&quot;');
            const rating = (it.vote_average !== null && it.vote_average !== undefined)
                ? Number(it.vote_average).toFixed(1) : null;
            const year = it.year || '';
            const partner = it.partner_name ? `<span class="duo-history-partner">❤ ${it.partner_name}</span>` : '';
            const ratingHtml = rating ? `<span class="duo-history-rating">⭐ ${rating}</span>` : '';
            return `<a class="duo-history-card" href="${href}" data-id="${id}" data-type="${mediaType}">
                <div class="duo-history-poster-wrap">
                    <img class="duo-history-poster" src="${poster}" alt="${title}" loading="lazy">
                    ${it.match_score ? `<span class="duo-history-score">${it.match_score}%</span>` : ''}
                </div>
                <div class="duo-history-info">
                    <div class="duo-history-name">${title}</div>
                    <div class="duo-history-meta">${year}${year && ratingHtml ? ' · ' : ''}${ratingHtml}</div>
                    ${partner}
                </div>
            </a>`;
        }).filter(Boolean).join('');
        return `<div class="duo-history">
            <div class="duo-history-title">✨ ${t('duoHistoryTitle')}</div>
            <div class="duo-history-scroll">${cards}</div>
        </div>`;
    },

    closeDuo() {
        if (this._duo.pollTimer) clearInterval(this._duo.pollTimer);
        document.getElementById('duo-modal')!.classList.add('hidden');
    },

    renderDuo() {
        const container = document.getElementById('duo-app');
        if (!container) return;
        const d = this._duo;
        const t = (k: string) => I18N.t(k);
        const lang = I18N.current === 'uk' ? 'uk' : 'en';

        if (d.phase === 'lobby') {
            const stepsHtml = `
                <div class="duo-steps">
                    <div class="duo-step"><span class="duo-step-num">1</span><span class="duo-step-label">${t('duoStepCreate')}</span></div>
                    <div class="duo-step-arrow">→</div>
                    <div class="duo-step"><span class="duo-step-num">2</span><span class="duo-step-label">${t('duoStepShare')}</span></div>
                    <div class="duo-step-arrow">→</div>
                    <div class="duo-step"><span class="duo-step-num">3</span><span class="duo-step-label">${t('duoStepGenres')}</span></div>
                    <div class="duo-step-arrow">→</div>
                    <div class="duo-step duo-step-final"><span class="duo-step-num">4</span><span class="duo-step-label">${t('duoStepWatch')}</span></div>
                </div>`;
            container.innerHTML = `
                <div class="duo-header duo-header-hero">
                    <div class="duo-hero-icon">🍿<span class="duo-hero-spark">✨</span></div>
                    <h2>${t('duoTitle')}</h2>
                    <p>${t('duoDesc')}</p>
                </div>
                ${stepsHtml}
                <div class="duo-lobby duo-lobby-v2">
                    <div class="duo-user-info"><span class="duo-user-avatar">${(d.name || 'U').slice(0,1).toUpperCase()}</span><span class="duo-user-name">${d.name}</span></div>
                    <button class="duo-action-btn primary duo-action-create" id="duo-create-btn">
                        <span class="duo-btn-icon">🎬</span>
                        <span class="duo-btn-label">
                            <span class="duo-btn-title">${t('duoCreateRoom')}</span>
                            <span class="duo-btn-sub">${t('duoCreateHint')}</span>
                        </span>
                    </button>
                    <div class="duo-or duo-or-lined"><span>${t('duoOr')}</span></div>
                    <div class="duo-join-row duo-join-row-v2">
                        <input type="text" class="duo-input duo-input-code" id="duo-code-input" placeholder="${t('duoEnterCode')}" maxlength="6" autocomplete="off" inputmode="latin" spellcheck="false">
                        <button class="duo-action-btn secondary duo-action-join" id="duo-join-btn">→ ${t('duoJoinRoom')}</button>
                    </div>
                </div>
                ${this._duoRenderHistory()}
            `;
            document.getElementById('duo-create-btn')!.addEventListener('click', () => this._duoCreate());
            document.getElementById('duo-join-btn')!.addEventListener('click', () => this._duoJoin());
            const codeInput = document.getElementById('duo-code-input') as HTMLInputElement;
            codeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._duoJoin();
            });
            codeInput.addEventListener('input', (e: any) => {
                const v = ((e.target.value || '') as string).toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (v !== e.target.value) e.target.value = v;
            });
            container.querySelectorAll('.duo-history-card').forEach(el => {
                el.addEventListener('click', () => { try { this.closeDuo(); } catch (_) {} });
            });
            return;
        }

        if (d.phase === 'waiting') {
            container.innerHTML = `
                <div class="duo-header">
                    <h2>🎯 ${t('duoTitle')}</h2>
                </div>
                <div class="duo-code-display">
                    <p>${t('duoShareCode')}</p>
                    <div class="duo-code-value" id="duo-code-copy">${d.code}</div>
                </div>
                <div class="duo-status">
                    <p class="duo-status-text"><span class="duo-spinner"></span> ${t('duoWaiting')}</p>
                </div>
            `;
            document.getElementById('duo-code-copy')!.addEventListener('click', () => {
                navigator.clipboard.writeText(d.code).then(() => {
                    const el = document.getElementById('duo-code-copy');
                    if (el) { el.textContent = '✓ ' + t('duoCopied'); setTimeout(() => { el.textContent = d.code; }, 1500); }
                });
            });
            this._duoPoll();
            return;
        }

        if (d.phase === 'prefs') {
            const genreChips = this._duoGenres.map(g => {
                const name = lang === 'uk' ? g.uk : g.en;
                const sel = d.selectedGenres.includes(g.id) ? 'selected' : '';
                return `<button class="duo-genre-chip ${sel}" data-gid="${g.id}">${name}</button>`;
            }).join('');

            const partnerHtml = d.partnerName
                ? `<div class="duo-partner-info">✅ ${d.partnerName} ${t('duoPartnerJoined')}</div>`
                : '';

            container.innerHTML = `
                <div class="duo-header">
                    <h2>🎯 ${t('duoSelectPrefs')}</h2>
                    <p>${t('duoRoomCode')}: <strong>${d.code}</strong></p>
                </div>
                ${partnerHtml}
                <div class="duo-prefs">
                    <div>
                        <p class="duo-prefs-title">${t('duoSelectGenres')}</p>
                        <div class="duo-genre-grid" id="duo-genre-grid">${genreChips}</div>
                    </div>
                    <div>
                        <p class="duo-prefs-title">${t('duoYourMood')}</p>
                        <input type="text" class="duo-input" id="duo-mood-input" placeholder="${t('duoMoodPlaceholder')}" value="${d.mood}" maxlength="100">
                    </div>
                    <button class="duo-action-btn primary" id="duo-submit-prefs">✓ ${t('duoReady')}</button>
                </div>
            `;

            document.getElementById('duo-genre-grid')!.addEventListener('click', (e) => {
                const chip = (e.target as HTMLElement).closest('.duo-genre-chip') as HTMLElement;
                if (!chip) return;
                const gid = chip.dataset.gid!;
                if (d.selectedGenres.includes(gid)) {
                    d.selectedGenres = d.selectedGenres.filter(id => id !== gid);
                    chip.classList.remove('selected');
                } else if (d.selectedGenres.length < 5) {
                    d.selectedGenres.push(gid);
                    chip.classList.add('selected');
                }
            });

            document.getElementById('duo-submit-prefs')!.addEventListener('click', () => this._duoSubmitPrefs());
            return;
        }

        if (d.phase === 'waitingMatch') {
            container.innerHTML = `
                <div class="duo-header">
                    <h2>🎯 ${t('duoTitle')}</h2>
                </div>
                <div class="duo-status">
                    <p class="duo-status-text"><span class="duo-spinner"></span> ${t('duoWaitingPartner')}</p>
                </div>
            `;
            this._duoPollReady();
            return;
        }

        if (d.phase === 'finding') {
            container.innerHTML = `
                <div class="duo-header">
                    <h2>🎯 ${t('duoFinding')}</h2>
                </div>
                <div class="duo-status">
                    <p class="duo-status-text"><span class="duo-spinner"></span></p>
                </div>
            `;
            return;
        }

        if (d.phase === 'result' && d.result) {
            const r = d.result;
            const posterUrl = r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : '';
            const safeTitle = (r.title || '').replace(/"/g, '&quot;');
            const posterImg = posterUrl ? `<img class="duo-movie-poster" src="${posterUrl}" alt="${safeTitle}">` : '';
            const year = r.release_date ? r.release_date.slice(0, 4) : '';
            const score = r.match_score || 0;
            const isTv = r.media_type === 'tv';
            const detailHref = r.id ? (this._getDetailUrl(r, isTv ? 'tv' : 'movie') || '') : '';
            const tgHref = r.id
                ? `https://t.me/PicksySupportBot?start=analyze_${isTv ? 'tv' : 'movie'}_${r.id}`
                : '';

            // Build meta chips: type, rating, runtime/seasons, genres
            const chips: string[] = [];
            const typeLabel = isTv
                ? ((I18N.current === 'uk') ? '📺 Серіал' : '📺 TV')
                : ((I18N.current === 'uk') ? '🎬 Фільм' : '🎬 Movie');
            chips.push(`<span class="duo-meta-chip type">${typeLabel}</span>`);
            if (isTv) {
                if (r.number_of_seasons) {
                    const sLabel = (I18N.current === 'uk') ? 'сез.' : 'sn';
                    chips.push(`<span class="duo-meta-chip">📺 ${r.number_of_seasons} ${sLabel}</span>`);
                }
                if (r.episode_run_time) {
                    chips.push(`<span class="duo-meta-chip">⏱ ${r.episode_run_time} ${(I18N.current === 'uk') ? 'хв/еп' : 'min/ep'}</span>`);
                }
            } else if (r.runtime) {
                const h = Math.floor(r.runtime / 60);
                const m = r.runtime % 60;
                const runtimeStr = h > 0 ? `${h}${(I18N.current === 'uk') ? 'г' : 'h'} ${m}${(I18N.current === 'uk') ? 'хв' : 'm'}` : `${m} ${(I18N.current === 'uk') ? 'хв' : 'min'}`;
                chips.push(`<span class="duo-meta-chip">⏱ ${runtimeStr}</span>`);
            }
            const genres = (r.genres || []).slice(0, 4);
            const genreChips = genres.map((g: string) => `<span class="duo-meta-chip genre">${g}</span>`).join('');
            const metaHtml = `<div class="duo-movie-chips">${chips.join('')}${genreChips}</div>`;

            const openHint = detailHref
                ? `<div class="duo-movie-open-hint">➜ ${t('duoOpenDetail')}</div>`
                : '';

            const cardAttrs = detailHref
                ? ` data-href="${detailHref}" data-id="${r.id}" data-type="${r.media_type || 'movie'}" role="link" tabindex="0"`
                : '';
            const cardClass = detailHref ? 'duo-movie-card duo-movie-card-clickable' : 'duo-movie-card';

            container.innerHTML = `
                <div class="duo-header">
                    <h2>🎉 ${t('duoPerfectMatch')}</h2>
                </div>
                <div class="duo-result">
                    <div class="${cardClass}" id="duo-result-card"${cardAttrs}>
                        ${posterImg}
                        <div class="duo-movie-name">${r.title}</div>
                        <div class="duo-movie-year">${year}${r.vote_average ? ' ⭐ ' + r.vote_average.toFixed(1) : ''}</div>
                        ${metaHtml}
                        <div class="duo-match-bar">
                            <div class="duo-match-label">
                                <span>${t('duoMatchScore')}</span>
                                <span>${score}%</span>
                            </div>
                            <div class="duo-match-track">
                                <div class="duo-match-fill" id="duo-match-fill" style="width:0%"></div>
                            </div>
                        </div>
                        <div class="duo-movie-overview-wrap">
                            <p class="duo-movie-overview">${r.overview || ''}</p>
                        </div>
                        ${r.reasoning ? `<div class="duo-reasoning"><strong>AI:</strong> <p>${r.reasoning}</p></div>` : ''}
                        ${openHint}
                    </div>
                    <div class="duo-result-actions">
                        ${detailHref ? `<a class="duo-action-btn primary" href="${detailHref}" id="duo-open-detail">🎬 ${t('duoOpenDetail')}</a>` : ''}
                        ${tgHref ? `<a class="duo-action-btn tg" href="${tgHref}" target="_blank" rel="noopener" id="duo-tg-analyze"><span class="duo-tg-icon">✈️</span> ${(I18N.current === 'uk') ? 'AI-аналіз у Telegram' : 'AI analysis in Telegram'}</a>` : ''}
                        <button class="duo-action-btn secondary" id="duo-new-room">🔄 ${t('duoNewRoom')}</button>
                    </div>
                </div>
            `;
            setTimeout(() => {
                const fill = document.getElementById('duo-match-fill');
                if (fill) fill.style.width = score + '%';
            }, 100);
            const newRoomBtn = document.getElementById('duo-new-room');
            if (newRoomBtn) newRoomBtn.addEventListener('click', () => { this.openDuo(); });

            // Make the whole result card clickable -> navigate to detail page.
            const card = document.getElementById('duo-result-card');
            if (card && detailHref) {
                const go = () => {
                    try { this.closeDuo(); } catch (_) {}
                    window.location.href = detailHref;
                };
                card.addEventListener('click', (ev) => {
                    const tgt = ev.target as HTMLElement;
                    if (!tgt) return;
                    // Don't navigate when the click came from an action button area.
                    if (tgt.closest('.duo-result-actions')) return;
                    // Don't hijack text selection inside the overview.
                    const sel = window.getSelection && window.getSelection();
                    if (sel && sel.toString() && tgt.closest('.duo-movie-overview-wrap')) return;
                    go();
                });
                card.addEventListener('keydown', (ev) => {
                    const ke = ev as KeyboardEvent;
                    if (ke.key === 'Enter' || ke.key === ' ') {
                        ev.preventDefault();
                        go();
                    }
                });
            }

            // Close modal when user explicitly opens detail / Telegram via action buttons.
            container.querySelectorAll('a.duo-action-btn').forEach(el => {
                el.addEventListener('click', () => { try { this.closeDuo(); } catch (_) {} });
            });
            return;
        }
    },

    _duoAuthHeaders() {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        const token = (typeof Auth !== 'undefined' && Auth.token)
            ? Auth.token
            : localStorage.getItem('pfm_token');
        if (token) h['Authorization'] = `Bearer ${token}`;
        return h;
    },

    _duoHandleAuthError() {
        if (this._duo && this._duo.pollTimer) clearInterval(this._duo.pollTimer);
        try { UI.showToast(I18N.t('duoLoginRequired')); } catch (e) {}
        try { this.closeDuo(); } catch (e) {}
        try { Auth.showModal('login'); } catch (e) {}
    },

    async _duoCreate() {
        const name = this._duo.name || 'User';

        const lang = I18N.current === 'uk' ? 'uk' : 'en';
        const genreNames = this._duo.selectedGenres.map(id => {
            const g = this._duoGenres.find(x => x.id === id);
            return g ? (lang === 'uk' ? g.uk : g.en) : '';
        }).filter(Boolean);

        try {
            const res = await fetch(`${CONFIG.API_URL}/api/duo/create`, {
                method: 'POST',
                headers: this._duoAuthHeaders(),
                body: JSON.stringify({ name, genres: genreNames, mood: '', lang }),
            });
            if (res.status === 401) { this._duoHandleAuthError(); return; }
            const data = await res.json();
            if (data.code) {
                this._duo.code = data.code;
                this._duo.slot = 'creator';
                this._duo.phase = 'waiting';
                this.renderDuo();
            }
        } catch (e) {
            console.error('Duo create error:', e);
        }
    },

    async _duoJoin() {
        const codeInput = document.getElementById('duo-code-input') as HTMLInputElement;
        const name = this._duo.name || 'User';
        const code = codeInput?.value.trim().toUpperCase();
        if (!code || code.length < 4) return;

        try {
            const res = await fetch(`${CONFIG.API_URL}/api/duo/join`, {
                method: 'POST',
                headers: this._duoAuthHeaders(),
                body: JSON.stringify({ code, name }),
            });
            if (res.status === 401) { this._duoHandleAuthError(); return; }
            const data = await res.json();
            if (res.ok) {
                this._duo.code = code;
                this._duo.slot = 'joiner';
                this._duo.phase = 'prefs';
                this._duo.partnerName = data.creator_name || '';
                this.renderDuo();
            } else {
                const t = (k: string) => I18N.t(k);
                UI.showToast(data.detail === 'Room is full' ? t('duoRoomFull') : t('duoRoomNotFound'));
            }
        } catch (e) {
            console.error('Duo join error:', e);
        }
    },

    _duoPoll() {
        if (this._duo.pollTimer) clearInterval(this._duo.pollTimer);
        this._duo.pollTimer = setInterval(async () => {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/duo/status/${this._duo.code}`);
                const data = await res.json();
                if (data.joiner && (data.status === 'joined' || data.status === 'ready' || data.status === 'matched')) {
                    clearInterval(this._duo.pollTimer);
                    this._duo.partnerName = data.joiner?.name || '';
                    this._duo.phase = 'prefs';
                    this.renderDuo();
                }
            } catch (e) { /* ignore */ }
        }, 2000);
    },

    async _duoSubmitPrefs() {
        const moodInput = document.getElementById('duo-mood-input') as HTMLInputElement;
        this._duo.mood = moodInput?.value.trim() || '';
        const lang = I18N.current === 'uk' ? 'uk' : 'en';
        const genreNames = this._duo.selectedGenres.map(id => {
            const g = this._duoGenres.find(x => x.id === id);
            return g ? (lang === 'uk' ? g.uk : g.en) : '';
        }).filter(Boolean);

        try {
            await fetch(`${CONFIG.API_URL}/api/duo/preferences`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: this._duo.code,
                    slot: this._duo.slot,
                    genres: genreNames,
                    mood: this._duo.mood,
                }),
            });
            this._duo.phase = 'waitingMatch';
            this.renderDuo();
        } catch (e) {
            console.error('Duo prefs error:', e);
        }
    },

    _duoPollReady() {
        if (this._duo.pollTimer) clearInterval(this._duo.pollTimer);
        this._duo.pollTimer = setInterval(async () => {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/duo/status/${this._duo.code}`);
                const data = await res.json();
                if (data.status === 'ready' && this._duo.slot === 'creator') {
                    clearInterval(this._duo.pollTimer);
                    this._duoFindMatch();
                } else if (data.status === 'ready' && this._duo.slot === 'joiner') {
                    // joiner waits for creator to trigger match
                } else if ((data.status === 'matched' || data.status === 'matching') && data.result) {
                    clearInterval(this._duo.pollTimer);
                    const r = data.result;
                    const movie = r.movie || r;
                    const mediaType = (r.media_type || movie.media_type || (movie.first_air_date ? 'tv' : 'movie'));
                    this._duo.result = {
                        id: movie.id || r.id || null,
                        media_type: mediaType,
                        title: movie.title || movie.name || '',
                        poster_path: movie.poster_path,
                        release_date: movie.release_date || movie.first_air_date,
                        vote_average: movie.vote_average,
                        overview: movie.overview,
                        genres: movie.genres || [],
                        runtime: movie.runtime || null,
                        episode_run_time: movie.episode_run_time || null,
                        number_of_seasons: movie.number_of_seasons || null,
                        number_of_episodes: movie.number_of_episodes || null,
                        match_score: r.match_score || 75,
                        reasoning: r.reasoning || '',
                    };
                    this._duo.phase = 'result';
                    this.renderDuo();
                }
            } catch (e) { /* ignore */ }
        }, 2000);
    },

    async _duoFindMatch() {
        this._duo.phase = 'finding';
        this.renderDuo();
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/duo/match/${this._duo.code}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (res.ok && data) {
                const movie = data.movie || data;
                const mediaType = (data.media_type || movie.media_type || (movie.first_air_date ? 'tv' : 'movie'));
                this._duo.result = {
                    id: movie.id || data.id || null,
                    media_type: mediaType,
                    title: movie.title || movie.name || '',
                    poster_path: movie.poster_path,
                    release_date: movie.release_date || movie.first_air_date,
                    vote_average: movie.vote_average,
                    overview: movie.overview,
                    genres: movie.genres || [],
                    runtime: movie.runtime || null,
                    episode_run_time: movie.episode_run_time || null,
                    number_of_seasons: movie.number_of_seasons || null,
                    number_of_episodes: movie.number_of_episodes || null,
                    match_score: data.match_score || 75,
                    reasoning: data.reasoning || '',
                };
                this._duo.phase = 'result';
                this.renderDuo();
            }
        } catch (e) {
            console.error('Duo match error:', e);
        }
    },

    listForSavedTab(tab) {
        if (tab === 'tv') return this.savedTv;
        if (tab === 'books') return this.savedBooks;
        return this.savedMovies;
    },

    typeForSavedTab(tab) {
        if (tab === 'tv') return 'tv';
        if (tab === 'books') return 'book';
        return 'movie';
    },

    getSavedTabType() {
        return this.typeForSavedTab(this.savedTab);
    },

    getActiveSavedList() {
        return this.savedCategory === 'watched'
            ? this.getWatchedListForTab(this.savedTab)
            : this.listForSavedTab(this.savedTab);
    },

    normalizeMediaType(type) {
        const value = String(type || '').toLowerCase();
        if (value === 'tv' || value === 'series' || value === 'serial' || value === 'shows') return 'tv';
        if (value === 'book' || value === 'books' || value === 'volume') return 'book';
        return 'movie';
    },

    activateSavedCategory(category) {
        this.savedCategory = category === 'watched' ? 'watched' : 'watchlist';
        document.querySelectorAll('.saved-cat-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.cat === this.savedCategory);
        });
        const statsEl = document.getElementById('watched-stats');
        if (statsEl) statsEl.classList.toggle('hidden', this.savedCategory !== 'watched');
    },

    removeSaved(index) {
        if (this.savedCategory === 'watched') {
            this.removeSavedFromWatched(index);
            return;
        }
        const list = this.listForSavedTab(this.savedTab);
        const removed = list.splice(index, 1)[0];
        if (removed) {
            const t = this.typeForSavedTab(this.savedTab);
            if (t === 'movie') this.removeMovieFromServer(removed.id);
            else if (t === 'tv') this.removeTvFromServer(removed.id);
            else this.removeBookFromServer(removed.id);
        }
        this.updateSavedUI();
        this.renderSaved();
        if (this.currentItem) UI.updateSaveBtn(this.isItemSaved(this.currentItem, this.currentType));
    },

    reorderSaved(fromIndex, toIndex) {
        const list = this.listForSavedTab(this.savedTab);
        if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
        const [moved] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, moved);
        this.renderSaved();
    },

    renderSaved() {
        if (this.savedCategory === 'watched') {
            UI.renderSavedList(this.getWatchedListForTab(this.savedTab), this.savedTab, true);
        } else {
            UI.renderSavedList(this.listForSavedTab(this.savedTab), this.savedTab, false);
        }
        this.updateWatchedStats();
    },

    removeSavedFromWatched(index) {
        const list = this.getWatchedListForTab(this.savedTab);
        list.splice(index, 1);
        this.saveWatchedToStorage();
        this.updateSavedUI();
    },

    updateSavedUI() {
        const total = this.savedMovies.length + this.savedTv.length + this.savedBooks.length +
                      this.watchedMovies.length + this.watchedTv.length + this.watchedBooks.length;
        UI.updateSavedCount(total);
        this.renderSaved();
    },

    // ─── Daily Pick ───
    _dailyPickCache: {},

    async loadDailyPick(tabType) {
        if (API.siteSettings.daily_pick_enabled === false) {
            const section = document.getElementById('daily-pick-section');
            if (section) section.classList.add('hidden');
            return;
        }
        const type = tabType === 'tv' ? 'tv' : (tabType === 'books' ? 'book' : 'movie');
        try {
            const lang = (typeof I18N !== 'undefined') ? I18N.current : 'uk';

            if (!this._dailyPickCache[type]) {
                const res = await fetch(`${CONFIG.API_URL}/api/daily-pick?type=${type}&lang=${lang}`);
                if (!res.ok) {
                    const section = document.getElementById('daily-pick-section');
                    if (section) section.classList.add('hidden');
                    return;
                }
                this._dailyPickCache[type] = await res.json();
            }
            const data = this._dailyPickCache[type];
            const section = document.getElementById('daily-pick-section');
            if (!section) return;

            let title, poster, year, rating, desc, fallback;

            if (type === 'book') {
                title = data.title || '';
                fallback = CONFIG.FALLBACK_BOOK_POSTER;
                poster = data.poster || fallback;
                if (poster.startsWith('http://')) poster = poster.replace('http://', 'https://');
                year = data.year || '';
                rating = data.rating ? Number(data.rating).toFixed(1) : '';
                desc = data.description || '';
            } else if (type === 'tv') {
                title = data.name || data.title || data.original_name || '';
                fallback = CONFIG.FALLBACK_TV_POSTER;
                poster = data.poster_path
                    ? CONFIG.TMDB_IMG + data.poster_path
                    : (data.poster || fallback);
                year = (data.first_air_date || '').split('-')[0] || data.year || '';
                rating = data.vote_average ? Number(data.vote_average).toFixed(1) : '';
                desc = data.overview || '';
            } else {
                title = data.title || data.original_title || '';
                fallback = CONFIG.FALLBACK_POSTER;
                poster = data.poster_path
                    ? CONFIG.TMDB_IMG + data.poster_path
                    : (data.poster || fallback);
                year = (data.release_date || '').split('-')[0] || data.year || '';
                rating = data.vote_average ? Number(data.vote_average).toFixed(1) : '';
                desc = data.overview || '';
            }

            const dpBadge = section.querySelector('.daily-pick-badge');
            const icons = { movie: '🎬', tv: '📺', book: '📚' };
            if (dpBadge) {
                const span = dpBadge.querySelector('[data-i18n]');
                dpBadge.childNodes[0].textContent = icons[type] + ' ';
            }

            document.getElementById('daily-pick-title').textContent = title;
            // Original title
            const origEl = document.getElementById('daily-pick-orig');
            if (origEl) {
                const origTitle = data.original_title || data.original_name || '';
                origEl.textContent = (origTitle && origTitle !== title) ? origTitle : '';
            }
            const posterEl = document.getElementById('daily-pick-poster') as HTMLImageElement;
            posterEl.src = poster;
            posterEl.alt = title ? `Постер: ${title}` : '';
            posterEl.onerror = function() { this.src = fallback; };
            // Runtime
            const runtime = data.runtime || data.episode_run_time || 0;
            const runtimeStr = runtime ? `<span>🕐 ${runtime} ${(typeof I18N !== 'undefined' && I18N.current === 'uk') ? 'хв' : 'min'}</span>` : '';
            // Director / Creator
            const directorName = data.director || data.creator || '';
            const directorStr = directorName ? `<span>🎬 ${directorName}</span>` : '';
            // Seasons for TV
            const seasonsStr = data.number_of_seasons ? `<span>📺 ${data.number_of_seasons} сез.</span>` : '';
            document.getElementById('daily-pick-meta').innerHTML =
                (year ? `<span>${year}</span>` : '') +
                (rating ? `<span>⭐ ${rating}</span>` : '') +
                runtimeStr + directorStr + seasonsStr +
                (data.authors ? `<span>${data.authors.slice(0,2).join(', ')}</span>` : '');
            // Genre chips
            const genresEl = document.getElementById('daily-pick-genres');
            if (genresEl) {
                const genres = data.genre_names || [];
                genresEl.innerHTML = genres.slice(0, 4).map(function(g) {
                    return '<span class="dp-genre-chip">' + g.replace(/</g, '&lt;') + '</span>';
                }).join('');
            }
            document.getElementById('daily-pick-desc').textContent = desc;
            // Extra info (cast)
            const extraEl = document.getElementById('daily-pick-extra');
            if (extraEl) {
                let extraHtml = '';
                if (data.cast && data.cast.length) {
                    extraHtml += '<span class="dp-cast">' + data.cast.join(', ').replace(/</g, '&lt;') + '</span>';
                }
                extraEl.innerHTML = extraHtml;
            }

            // Countdown timer
            this._startDailyPickTimer();
            section.classList.remove('hidden');

            const card = document.getElementById('daily-pick-card');
            if (card) {
                card.style.cursor = 'pointer';
                const newCard = card.cloneNode(true) as HTMLElement;
                card.parentNode!.replaceChild(newCard, card);
                newCard.addEventListener('click', () => {
                    this.currentItem = data;
                    this.currentType = type;
                    UI.showResult(data, type);
                    this.syncResultNotePanel();
                    UI.updateSaveBtn(this.isItemSaved(data, type));
                    UI.updateLinkBtn(this.getItemUrl(data, type));
                    UI.els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
            }
        } catch (err) {
            console.log('Daily pick unavailable:', err);
        }
    },

    _dailyPickTimerInterval: null as any,
    _startDailyPickTimer() {
        if (this._dailyPickTimerInterval) clearInterval(this._dailyPickTimerInterval);
        const timerEl = document.getElementById('daily-pick-timer');
        if (!timerEl) return;
        const update = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setHours(24, 0, 0, 0);
            const diff = tomorrow.getTime() - now.getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            const isUk = (typeof I18N !== 'undefined' && I18N.current === 'uk');
            const label = isUk ? 'Наступний через' : 'Next in';
            const value = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
            timerEl.innerHTML = `<span class="daily-pick-timer-label">${label}</span><strong class="daily-pick-timer-value">${value}</strong>`;
        };
        update();
        this._dailyPickTimerInterval = setInterval(update, 1000);
    },

    // ─── Floating Action Button ───
    initFab() {
        const btn = document.getElementById('fab-btn');
        const menu = document.getElementById('fab-menu');
        if (!btn || !menu) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !menu.classList.contains('hidden');
            menu.classList.toggle('hidden', isOpen);
            btn.classList.toggle('active', !isOpen);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.fab-container')) {
                menu.classList.add('hidden');
                btn.classList.remove('active');
            }
        });

        const closeFab = () => { menu.classList.add('hidden'); btn.classList.remove('active'); };

        document.getElementById('fab-pick')?.addEventListener('click', () => {
            closeFab();
            this.pick();
        });
        document.getElementById('fab-lucky')?.addEventListener('click', () => {
            closeFab();
            this.pickLucky();
        });
        document.getElementById('fab-ai')?.addEventListener('click', () => {
            closeFab();
            const aiInput = document.getElementById('ai-input');
            if (aiInput) { aiInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); aiInput.focus(); }
        });
        document.getElementById('fab-saved')?.addEventListener('click', () => {
            closeFab();
            const savedBody = document.getElementById('saved-body');
            if (savedBody && savedBody.classList.contains('hidden')) {
                document.getElementById('saved-toggle')?.click();
            }
            document.getElementById('saved-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        document.getElementById('fab-game')?.addEventListener('click', () => {
            closeFab();
            if (typeof Game !== 'undefined') Game.open();
        });
        document.getElementById('fab-top')?.addEventListener('click', () => {
            closeFab();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.getElementById('fab-upgrade')?.addEventListener('click', () => {
            closeFab();
            if (typeof Subscription !== 'undefined') Subscription.showUpgradeModal();
        });
        document.getElementById('fab-admin')?.addEventListener('click', () => {
            closeFab();
            // Superadmin gets /admin, other staff roles go to /staff
            const role = (Auth as any)?.user?.role || '';
            const isSuper = role === 'superadmin' || (Auth as any)?.user?.is_admin;
            window.open(isSuper ? '/admin' : '/staff', '_blank');
        });

        // Show/hide upgrade FAB based on freemium
        const fabUpgrade = document.getElementById('fab-upgrade');
        if (fabUpgrade) {
            const freemiumOn = API.siteSettings?.freemium_enabled || false;
            const tier = typeof Subscription !== 'undefined' ? Subscription.getTier() : 'pro';
            if (freemiumOn && tier !== 'pro') {
                fabUpgrade.classList.remove('hidden');
            } else {
                fabUpgrade.classList.add('hidden');
            }
        }

        // Hide FAB container when any modal / overlay menu is open
        const fabContainer = document.getElementById('fab-container');
        if (fabContainer) {
            const modalIds = [
                'auth-modal', 'profile-modal', 'trailer-modal', 'rating-modal',
                'movie-night-modal', 'duo-modal', 'game-modal', 'donate-modal',
                'collection-picker-modal', 'collection-edit-modal',
                'collection-detail-modal', 'share-menu', 'detail-modal',
                'feedback-modal', 'site-popup-wrap',
            ];
            const modals = modalIds.map(id => document.getElementById(id)).filter(Boolean);

            const syncFab = () => {
                const anyOpen = modals.some(m => !m.classList.contains('hidden'));
                fabContainer.classList.toggle('hidden', anyOpen);
                if (anyOpen) { menu.classList.add('hidden'); btn.classList.remove('active'); }
            };

            const observer = new MutationObserver(syncFab);
            modals.forEach(m => observer.observe(m, { attributes: true, attributeFilter: ['class'] }));
        }
    },

    // ─── Username ───
    initUsername() {
        const saveBtn = document.getElementById('profile-username-save');
        const input = document.getElementById('profile-username-input');
        if (!saveBtn || !input) return;

        saveBtn.addEventListener('click', async () => {
            const val = input.value.trim().toLowerCase();
            if (!val) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/me/username`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
                    body: JSON.stringify({ username: val }),
                });
                const data = await res.json();
                if (!res.ok) {
                    const hint = document.getElementById('profile-username-hint');
                    if (hint) hint.textContent = data.detail || 'Error';
                    return;
                }
                const hint = document.getElementById('profile-username-hint');
                if (hint) hint.textContent = '';
                UI.showToast(I18N.t('savedToast'));
                this.showPublicLink(data.username);
            } catch {
                UI.showToast(I18N.t('loadError'));
            }
        });
    },

    initProfileEditor() {
        const save = document.getElementById('profile-info-save');
        const copy = document.getElementById('profile-copy-link');
        const getVal = (id) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() || '';

        // Favorite film remove button
        const favRemoveBtn = document.getElementById('profile-fav-remove');
        if (favRemoveBtn) {
            favRemoveBtn.addEventListener('click', () => {
                const setVal = (id: string, v: string) => {
                    const el = document.getElementById(id) as HTMLInputElement | null;
                    if (el) el.value = v;
                };
                setVal('profile-fav-film-id', '');
                setVal('profile-fav-film-title', '');
                setVal('profile-fav-film-poster', '');
                setVal('profile-fav-film-type', '');
                const commentEl = document.getElementById('profile-fav-film-comment') as HTMLTextAreaElement | null;
                if (commentEl) commentEl.value = '';
                const sel = document.getElementById('profile-fav-selected');
                if (sel) sel.classList.add('hidden');
            });
        }

        if (save) {
            save.addEventListener('click', async () => {
                if (!Auth.token) return UI.showToast(I18N.t('saveHint'));
                const chk = (id: string): boolean | undefined => {
                    const el = document.getElementById(id) as HTMLInputElement | null;
                    return el ? !!el.checked : undefined;
                };
                const payload: any = {
                    display_name: getVal('profile-display-name-input'),
                    bio: getVal('profile-bio-input'),
                    avatar_emoji: getVal('profile-avatar-input'),
                    avatar_url: getVal('profile-avatar-url-input'),
                    banner_url: getVal('profile-banner-input'),
                    accent_color: getVal('profile-color-input'),
                    fav_film_id: getVal('profile-fav-film-id'),
                    fav_film_title: getVal('profile-fav-film-title'),
                    fav_film_poster: getVal('profile-fav-film-poster'),
                    fav_film_type: getVal('profile-fav-film-type'),
                    fav_film_comment: getVal('profile-fav-film-comment'),
                    social_telegram: getVal('profile-social-telegram'),
                    social_instagram: getVal('profile-social-instagram'),
                    social_letterboxd: getVal('profile-social-letterboxd'),
                    social_website: getVal('profile-social-website'),
                    show_dna: chk('toggle-show-dna'),
                    show_psycho: chk('toggle-show-psycho'),
                    show_zodiac: chk('toggle-show-zodiac'),
                    show_recs: chk('toggle-show-recs'),
                    show_top: chk('toggle-show-top'),
                    show_showcase: chk('toggle-show-showcase'),
                };
                try {
                    const res = await fetch(`${CONFIG.API_URL}/api/me/profile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
                        body: JSON.stringify(payload),
                    });
                    if (!res.ok) {
                        // Surface backend errors (e.g. 403 Premium-only banner/avatar)
                        let detail = '';
                        try { const j = await res.json(); detail = (j && j.detail) ? String(j.detail) : ''; } catch {}
                        UI.showToast(detail || (I18N.current === 'en' ? 'Save failed' : 'Помилка збереження'));
                        return;
                    }
                    const avatar = document.querySelector('.profile-avatar');
                    if (avatar && payload.avatar_emoji) avatar.textContent = payload.avatar_emoji;
                    // Persist visibility toggles to localStorage as a fallback for
                    // older builds; the source of truth now lives in the DB.
                    try {
                        const vis = {
                            dna: payload.show_dna !== false,
                            psycho: payload.show_psycho !== false,
                            zodiac: payload.show_zodiac !== false,
                            recs: payload.show_recs !== false,
                            top: payload.show_top !== false,
                            showcase: payload.show_showcase !== false,
                        };
                        localStorage.setItem('picksy_profile_visibility', JSON.stringify(vis));
                    } catch {}
                    // Save recommendations to backend alongside the profile
                    try {
                        const recs = (typeof (window as any).App !== 'undefined' && Array.isArray((window as any).App._profileRecs))
                            ? (window as any).App._profileRecs : [];
                        await fetch(`${CONFIG.API_URL}/api/me/recommendations`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
                            body: JSON.stringify(recs),
                        });
                    } catch {}
                    UI.showToast(I18N.current === 'en' ? 'Profile saved!' : 'Профіль збережено!');
                } catch {
                    UI.showToast(I18N.t('loadError'));
                }
            });
        }
        if (copy) {
            copy.addEventListener('click', async () => {
                const link = document.getElementById('profile-public-link');
                if (!link || !link.href) return UI.showToast('Спочатку збережи username');
                try {
                    await navigator.clipboard.writeText(link.href);
                    UI.showToast('Посилання скопійовано!');
                } catch {
                    UI.showToast(link.href);
                }
            });
        }
    },

    showPublicLink(username) {
        const link = document.getElementById('profile-public-link');
        if (!link || !username) return;
        const host = CONFIG.API_URL.replace(/^https?:\/\//, '').replace(/:\d+$/, '') || window.location.host;
        const url = `${window.location.origin}/u/${username}`;
        link.href = url;
        link.textContent = url;
        link.classList.remove('hidden');
    },

    // ─── Site Settings / Banners / Popup ───
    async loadSiteSettings() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/settings`);
            if (!res.ok) return;
            const settings = await res.json();
            this.siteSettings = settings;
            this.applySiteSettings(settings);
        } catch (e) {
            console.log('Site settings unavailable:', e);
        }
    },

    applySiteSettings(settings) {
        if (!settings) return;
        this.renderTopBanner(settings);
        this.renderPromoBanner(settings);
        this.renderBottomAd(settings);
        this.renderPopupAd(settings);

        const aiBox = document.querySelector('.ai-section') || document.getElementById('ai-search-btn')?.closest('section');
        if (aiBox && settings.ai_enabled === false) aiBox.classList.add('hidden');

        // Achievements visibility (section in profile modal)
        const achievementsSection = document.getElementById('achievements-section') || document.getElementById('profile-achievements-section');
        if (achievementsSection) achievementsSection.classList.toggle('hidden', settings.achievements_enabled === false);

        // Feedback visibility
        const feedbackEnabled = settings.feedback_enabled !== false;
        const feedbackSection = document.getElementById('feedback-section') || document.getElementById('feedback-btn');
        if (feedbackSection) feedbackSection.classList.toggle('hidden', !feedbackEnabled);
        const feedbackMiniBtn = document.getElementById('feedback-mini-btn');
        if (feedbackMiniBtn) feedbackMiniBtn.classList.toggle('hidden', !feedbackEnabled);
        const feedbackFab = document.getElementById('feedback-fab');
        if (feedbackFab) feedbackFab.classList.toggle('hidden', !feedbackEnabled);

        // Game visibility (button, FAB, profile section + rating)
        const gameEnabled = settings.game_enabled !== false;
        const gameBtn = document.getElementById('game-open-btn');
        const fabGame = document.getElementById('fab-game');
        const gameProfileSection = document.getElementById('game-profile-section');
        if (gameBtn) gameBtn.classList.toggle('hidden', !gameEnabled);
        if (fabGame) fabGame.classList.toggle('hidden', !gameEnabled);
        if (gameProfileSection) gameProfileSection.classList.toggle('hidden', !gameEnabled);

        // Load game rating in profile when game enabled
        if (gameEnabled && Auth.token) {
            this.loadGameRatingForProfile();
        }
    },

    renderPromoBanner(settings) {
        const el = document.getElementById('promo-banner');
        if (!el) return;
        if (!settings.promo_banner_enabled) {
            el.classList.add('hidden');
            return;
        }
        const text = settings.promo_banner_text || '';
        const icon = settings.promo_banner_icon || '🎯';
        const url = settings.promo_banner_url || '';
        const btn = settings.promo_banner_button || '';
        const gradient = settings.promo_banner_gradient || 'purple';

        el.dataset.gradient = gradient;
        document.getElementById('promo-banner-icon').textContent = icon;
        document.getElementById('promo-banner-text').textContent = text;

        const btnEl = document.getElementById('promo-banner-btn');
        if (url && btn) {
            btnEl.href = url;
            btnEl.textContent = btn;
            btnEl.classList.remove('hidden');
        } else {
            btnEl.classList.add('hidden');
        }
        el.classList.remove('hidden');
    },

    renderTopBanner(settings) {
        let el = document.getElementById('site-top-banner');
        if (!settings.top_banner_enabled) {
            if (el) el.remove();
            return;
        }
        if (!el) {
            el = document.createElement('div');
            el.id = 'site-top-banner';
            el.className = 'site-top-banner';
            document.body.prepend(el);
        }
        const text = settings.top_banner_text || '';
        const url = settings.top_banner_url || '';
        const btn = settings.top_banner_button || 'OK';
        el.innerHTML = `<span>${this.escapeHtml(text)}</span>${url ? `<a href="${this.escapeAttr(url)}" target="_blank" rel="noopener">${this.escapeHtml(btn)}</a>` : ''}`;
    },

    renderBottomAd(settings) {
        const banner = document.getElementById('ad-banner');
        const content = document.getElementById('ad-banner-content');
        const closeBtn = document.getElementById('ad-banner-close');
        if (!banner || !content) return;
        if (!settings.bottom_ad_enabled) {
            banner.classList.add('hidden');
            return;
        }
        const text = settings.bottom_ad_text || '';
        const url = settings.bottom_ad_url || '';
        const btn = settings.bottom_ad_button || 'Відкрити';
        content.innerHTML = `<strong>📢 Реклама</strong><p>${this.escapeHtml(text)}</p>${url ? `<a class="ad-action" href="${this.escapeAttr(url)}" target="_blank" rel="noopener">${this.escapeHtml(btn)}</a>` : ''}`;
        if (closeBtn) closeBtn.style.display = 'block';
        banner.classList.remove('hidden');
    },

    renderPopupAd(settings) {
        let wrap = document.getElementById('site-popup-ad');
        if (!settings.popup_enabled) {
            if (wrap) wrap.remove();
            return;
        }
        // Include popup_version from server so any admin change resets "seen"
        const raw = (settings.popup_version || '1') + '|' + (settings.popup_title || '') + '|' + (settings.popup_text || '');
        const contentHash = btoa(unescape(encodeURIComponent(raw))).slice(0, 20);
        const seenKey = 'picksy_popup_seen_' + contentHash;
        // Clean up old popup seen keys when content changes
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith('picksy_popup_seen_') && k !== seenKey) localStorage.removeItem(k);
        }
        if (!settings.popup_force && localStorage.getItem(seenKey) === '1') return;
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'site-popup-ad';
            wrap.className = 'site-popup-ad';
            document.body.appendChild(wrap);
        }
        const title = settings.popup_title || 'Picksy';
        const text = settings.popup_text || '';
        const url = settings.popup_url || '';
        const btn = settings.popup_button || 'Відкрити';
        const closeable = !settings.popup_force;
        wrap.innerHTML = `<div class="site-popup-card">${closeable ? '<button class="site-popup-close" id="site-popup-close">&times;</button>' : ''}<div class="site-popup-icon">✨</div><h3>${this.escapeHtml(title)}</h3><p>${this.escapeHtml(text)}</p>${url ? `<a class="site-popup-button" href="${this.escapeAttr(url)}" target="_blank" rel="noopener">${this.escapeHtml(btn)}</a>` : ''}${!closeable ? '<small>Це повідомлення закриється адміністратором.</small>' : ''}</div>`;
        wrap.classList.remove('hidden');
        const close = document.getElementById('site-popup-close');
        if (close) close.addEventListener('click', () => { localStorage.setItem(seenKey, '1'); wrap.remove(); });
    },

    renderPopupAdSeenKey: null,

    escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    },

    escapeAttr(str) {
        return this.escapeHtml(str).replace(/`/g, '&#96;');
    },

    // ─── Game Rating for Profile ───
    async loadGameRatingForProfile() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/game/rating`, {
                headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
            });
            if (!res.ok) return;
            const d = await res.json();
            const ratingEl = document.getElementById('profile-game-rating');
            const recordEl = document.getElementById('profile-game-record');
            if (ratingEl) ratingEl.textContent = d.rating;
            if (recordEl) recordEl.textContent = `${d.wins}W / ${d.losses}L / ${d.draws}D`;
        } catch {}
    },

    // ─── Scroll to Top ───
    initScrollTop() {
        const btn = document.getElementById('scroll-top-btn');
        if (!btn) return;
        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        }, { passive: true });
        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    },

    // ─── Mini Feedback ───
    initFeedbackMini() {
        const btn = document.getElementById('feedback-mini-btn');
        const fab = document.getElementById('feedback-fab');
        const dialog = document.getElementById('feedback-dialog');
        const closeBtn = document.getElementById('feedback-dialog-close');
        const sendBtn = document.getElementById('feedback-dialog-send');
        const input = document.getElementById('feedback-dialog-input');
        const categorySelect = document.getElementById('feedback-dialog-category');
        if (!dialog) return;

        const openDialog = () => {
            if (!Auth.token) {
                UI.showToast(I18N.t('saveHint'));
                return;
            }
            dialog.classList.remove('hidden');
            if (input) input.focus();
        };

        if (btn) btn.addEventListener('click', openDialog);
        if (fab) fab.addEventListener('click', openDialog);
        if (closeBtn) closeBtn.addEventListener('click', () => dialog.classList.add('hidden'));
        dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.classList.add('hidden'); });
        if (sendBtn && input) {
            sendBtn.addEventListener('click', async () => {
                const msg = input.value.trim();
                if (!msg) return;
                const category = categorySelect ? categorySelect.value : 'general';
                const ok = await this.sendFeedback(msg, category);
                if (ok) {
                    input.value = '';
                    if (categorySelect) categorySelect.value = 'general';
                    dialog.classList.add('hidden');
                }
            });
        }
    },

    // ─── Ad Banner ───
    initAdBanner() {
        const closeBtn = document.getElementById('ad-banner-close');
        const banner = document.getElementById('ad-banner');
        if (closeBtn && banner) {
            closeBtn.addEventListener('click', () => banner.classList.add('hidden'));
        }
        this.loadSiteSettings();
    },

    // ─── Streak display ───
    getStreakColor(streak) {
        if (streak >= 300) return '#ff0000';
        if (streak >= 200) return '#ff4500';
        if (streak >= 100) return '#ffa500';
        if (streak >= 30) return '#ffd700';
        if (streak >= 10) return '#ff6347';
        return '';
    },

    getStreakClass(streak) {
        if (streak >= 300) return 'streak-legendary';
        if (streak >= 200) return 'streak-epic';
        if (streak >= 100) return 'streak-fire-100';
        if (streak >= 30) return 'streak-hot';
        if (streak >= 10) return 'streak-warm';
        return '';
    },

    async loadStreak() {
        if (!Auth.token) return;
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/me/streak`, {
                headers: Auth.getAuthHeaders(),
            });
            if (!res.ok) return;
            const data = await res.json();
            const streak = data.current_streak || 0;
            const el = document.getElementById('profile-streak-count');
            if (el) el.textContent = streak;

            const fireEl = document.querySelector('.streak-fire');
            const streakContainer = document.getElementById('profile-streak');
            if (streakContainer) {
                streakContainer.classList.remove('streak-warm', 'streak-hot', 'streak-fire-100', 'streak-epic', 'streak-legendary');
                const cls = this.getStreakClass(streak);
                if (cls) streakContainer.classList.add(cls);
            }
            if (fireEl) {
                const color = this.getStreakColor(streak);
                if (color) {
                    fireEl.style.filter = `drop-shadow(0 0 6px ${color})`;
                }
            }
        } catch {}
    },

    // ─── Trending ───
    async loadTrending(tabType) {
        if (API.siteSettings.trending_enabled === false) {
            const sec = document.getElementById('trending-section');
            if (sec) sec.classList.add('hidden');
            return;
        }
        const type = tabType === 'tv' ? 'tv' : 'movie';
        if (tabType === 'books') {
            const sec = document.getElementById('trending-section');
            if (sec) sec.classList.add('hidden');
            return;
        }
        try {
            const lang = (typeof I18N !== 'undefined') ? I18N.current : 'uk';
            const res = await fetch(`${CONFIG.API_URL}/api/trending?type=${type}&lang=${lang}`);
            if (!res.ok) return;
            const items = await res.json();
            const sec = document.getElementById('trending-section');
            const scroll = document.getElementById('trending-scroll');
            if (!sec || !scroll || !items.length) return;
            const itemType = type === 'tv' ? 'tv' : 'movie';
            scroll.innerHTML = items.map(i => {
                const isUa = (i.original_language || '') === 'uk';
                const uaBadge = isUa ? `<span class="trending-ua-badge" title="Український оригінал">🇺🇦 UA</span>` : '';
                const releaseDate = i.release_date || '';
                const dateLabel = releaseDate ? releaseDate.split('-').reverse().join('.') : (i.year || '');
                return `<div class="trending-card" data-id="${i.id || ''}" data-type="${itemType}" data-title="${(i.title || '').replace(/"/g, '"')}" data-poster="${i.poster || CONFIG.FALLBACK_POSTER}" data-year="${i.year || ''}" data-date="${releaseDate}" data-rating="${i.rating || ''}" data-desc="${(i.description || i.overview || '').replace(/"/g, '\"')}" data-url="${i.url || ''}" data-lang="${i.original_language || ''}" style="cursor:pointer;">` +
                    `<div class="trending-poster-wrap">` +
                    `<img class="trending-poster" src="${i.poster || CONFIG.FALLBACK_POSTER}" alt="${i.title}" loading="lazy" decoding="async" onerror="this.src='${CONFIG.FALLBACK_POSTER}'">` +
                    `${uaBadge}` +
                    `</div>` +
                    `<div class="trending-name">${i.title}</div>` +
                    `<div class="trending-meta"><span class="trending-release-date">${dateLabel}</span>${i.rating ? `<span class="trending-rating">★ ${i.rating}</span>` : ''}</div>` +
                    `</div>`;
            }).join('');
            sec.classList.remove('hidden');

            const newScroll = scroll.cloneNode(true) as HTMLElement;
            scroll.parentNode!.replaceChild(newScroll, scroll);
            newScroll.addEventListener('click', async (e) => {
                const card = (e.target as HTMLElement).closest('.trending-card') as HTMLElement;
                if (!card) return;
                const cardType = card.dataset.type || 'movie';
                const item: any = {
                    id: Number(card.dataset.id) || card.dataset.id,
                    title: card.dataset.title,
                    poster: card.dataset.poster,
                    year: card.dataset.year,
                    release_date: card.dataset.date,
                    rating: card.dataset.rating,
                    description: card.dataset.desc,
                    overview: card.dataset.desc,
                    url: card.dataset.url,
                    original_language: card.dataset.lang || '',
                };
                // Fetch full details if description is missing
                if (!item.description && item.id) {
                    try {
                        const lang = typeof I18N !== 'undefined' ? I18N.currentLang || 'uk' : 'uk';
                        const detailRes = await fetch(`${CONFIG.API_URL}/api/trending/detail?id=${item.id}&type=${cardType}&lang=${lang}`);
                        if (detailRes.ok) {
                            const detail = await detailRes.json();
                            if (detail.overview) {
                                item.description = detail.overview;
                                item.overview = detail.overview;
                            }
                            if (detail.genre_ids) item.genre_ids = detail.genre_ids;
                            if (detail.vote_average) item.vote_average = detail.vote_average;
                            if (detail.original_language) item.original_language = detail.original_language;
                        }
                    } catch {}
                }
                this.currentItem = item;
                this.currentType = cardType;
                UI.showResult(item, cardType);
                this.syncResultNotePanel();
                UI.updateSaveBtn(this.isItemSaved(item, cardType));
                UI.updateLinkBtn(this.getItemUrl(item, cardType));
            });
        } catch (e) {
            console.log('Trending unavailable:', e);
        }
    },

    // ─── Announcements ───
    async loadAnnouncements() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/announcements`);
            if (!res.ok) return;
            const list = await res.json();
            if (!list.length) return;
            const bar = document.getElementById('announcement-bar');
            const txt = document.getElementById('announcement-text');
            const closeBtn = document.getElementById('announcement-close');
            if (!bar || !txt) return;
            const dismissed = JSON.parse(localStorage.getItem('picksy_dismissed_ann') || '[]');
            const active = list.find(a => a.closeable === false || !dismissed.includes(a.id));
            if (!active) return;
            txt.textContent = active.message;
            bar.classList.remove('hidden');
            if (closeBtn) {
                if (active.closeable === false) {
                    closeBtn.style.display = 'none';
                } else {
                    closeBtn.style.display = '';
                    closeBtn.onclick = () => {
                        dismissed.push(active.id);
                        localStorage.setItem('picksy_dismissed_ann', JSON.stringify(dismissed));
                        bar.classList.add('hidden');
                    };
                }
            }
        } catch {}
    },

    // ─── Achievements ───
    async loadAchievements() {
        if (!Auth.token) return;
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/me/achievements`, {
                headers: Auth.getAuthHeaders(),
            });
            if (!res.ok) return;
            const list = await res.json();
            this._achievementsCache = list;
            const grid = document.getElementById('achievements-grid');
            if (grid) {
                const lang = (typeof I18N !== 'undefined') ? I18N.current : 'uk';
                grid.innerHTML = list.map(a =>
                    `<div class="achievement-item ${a.earned ? 'earned' : 'locked'}" title="${lang === 'en' ? a.desc_en : a.desc_uk}">` +
                    `<span class="achievement-icon">${a.icon}</span>` +
                    `<span class="achievement-name">${lang === 'en' ? a.name_en : a.name_uk}</span>` +
                    `</div>`
                ).join('');
            }
            // Also render the editable showcase picker (mini-profile modal).
            this.loadShowcaseBadges(list);
        } catch {}
    },

    _achievementsCache: null,
    _showcaseSelected: [],
    _showcaseInflight: null,

    /* Render the editable badge showcase grid (#profile-showcase-grid) used
     * inside the mini-profile editor. The user can click earned badges to
     * pin them to their public profile. */
    async loadShowcaseBadges(list) {
        const grid = document.getElementById('profile-showcase-grid');
        if (!grid) return;
        if (!Auth.token) {
            grid.innerHTML = '';
            return;
        }
        // Reuse cached achievements if available; otherwise fetch them.
        let achievements = list || this._achievementsCache;
        if (!achievements) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/me/achievements`, {
                    headers: Auth.getAuthHeaders(),
                });
                if (!res.ok) return;
                achievements = await res.json();
                this._achievementsCache = achievements;
            } catch { return; }
        }
        // Fetch current selection (only once on first render or after a save).
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/me/showcase-badges`, {
                headers: Auth.getAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                this._showcaseSelected = Array.isArray(data?.badges) ? data.badges.slice(0, 5) : [];
            }
        } catch {}
        this._renderShowcaseGrid();
    },

    _renderShowcaseGrid() {
        const grid = document.getElementById('profile-showcase-grid');
        if (!grid) return;
        const achievements = this._achievementsCache || [];
        const lang = (typeof I18N !== 'undefined') ? I18N.current : 'uk';
        const isEn = lang === 'en';
        const selected = new Set(this._showcaseSelected || []);
        const limit = (typeof Subscription !== 'undefined' && typeof Subscription.getShowcaseBadgeLimit === 'function')
            ? Subscription.getShowcaseBadgeLimit() : 5;
        const lockedNotEarnedTitle = isEn ? 'Earn this achievement first' : 'Спершу здобудь це досягнення';
        const tierLockTitle = isEn
            ? `Pick up to ${limit} on your tier — upgrade to pin more`
            : `На твоєму тарифі — до ${limit} бейджів. Купи підписку для ще`;
        // Render every achievement: earned ones are clickable, locked ones are dimmed.
        grid.innerHTML = achievements.map(a => {
            const isEarned = !!a.earned;
            const isSelected = selected.has(a.id);
            const name = isEn ? a.name_en : a.name_uk;
            const desc = isEn ? a.desc_en : a.desc_uk;
            const cls = ['profile-showcase-badge'];
            if (!isEarned) cls.push('not-earned');
            if (isSelected) cls.push('selected');
            const aria = isEarned ? '' : ' aria-disabled="true"';
            const title = !isEarned ? lockedNotEarnedTitle : (desc || '');
            const lockIcon = !isEarned ? '<span class="profile-showcase-lock" aria-hidden="true">🔒</span>' : '';
            return `<button type="button" class="${cls.join(' ')}" data-badge-id="${a.id}"${aria} title="${title}">`
                 + `${lockIcon}<span class="profile-showcase-icon">${a.icon}</span>`
                 + `<span class="profile-showcase-name">${name}</span></button>`;
        }).join('');
        grid.querySelectorAll('.profile-showcase-badge').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const el = btn as HTMLButtonElement;
                if (el.classList.contains('not-earned')) {
                    if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(lockedNotEarnedTitle);
                    return;
                }
                const id = el.dataset.badgeId;
                if (!id) return;
                const sel = this._showcaseSelected || [];
                const idx = sel.indexOf(id);
                if (idx >= 0) {
                    sel.splice(idx, 1);
                } else {
                    if (sel.length >= limit) {
                        if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(tierLockTitle);
                        if (limit < 5 && typeof Subscription !== 'undefined' && typeof Subscription.showUpgradeModal === 'function') {
                            try { Subscription.showUpgradeModal(); } catch {}
                        }
                        return;
                    }
                    sel.push(id);
                }
                this._showcaseSelected = sel;
                this._renderShowcaseGrid();
                this._saveShowcaseBadges(sel);
            });
        });
        // Hint update — surface the per-tier max.
        const hintEl = document.querySelector('.profile-showcase-hint') as HTMLElement | null;
        if (hintEl) {
            const tierTxt = limit < 5
                ? (isEn ? `🔒 Free shows ${limit} badge. Premium / Pro — up to 5.`
                        : `🔒 На Free показуємо ${limit} бейдж. Premium / Pro — до 5.`)
                : '';
            const baseTxt = isEn ? 'Tap to pick/remove.' : 'Натисни, щоб обрати/прибрати.';
            hintEl.textContent = tierTxt ? `${baseTxt} ${tierTxt}` : `${baseTxt} ${isEn ? 'Up to 5 badges.' : 'Можна вибрати до 5 бейджів.'}`;
        }
    },

    async _saveShowcaseBadges(badge_ids) {
        if (!Auth.token) return;
        // Debounce: clobber any in-flight request.
        const payload = { badge_ids };
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/me/showcase-badges`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(I18N.t('saveError') || 'Помилка збереження');
                return;
            }
            const data = await res.json();
            if (Array.isArray(data?.badges)) {
                this._showcaseSelected = data.badges.slice(0, 5);
                this._renderShowcaseGrid();
            }
        } catch {}
    },

    async sendFeedback(message, category = 'general') {
        if (!Auth.token) {
            UI.showToast(I18N.t('saveHint'));
            return false;
        }
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() },
                body: JSON.stringify({ message, category }),
            });
            if (!res.ok) throw new Error('feedback failed');
            UI.showToast(I18N.t('feedbackThanks'));
            return true;
        } catch {
            UI.showToast(I18N.t('loadError'));
            return false;
        }
    },

    // ─── Share ───
    shareResult(title, url) {
        const text = I18N.t('shareText').replace('{title}', title);
        if (navigator.share) {
            navigator.share({ title, text, url }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text + ' ' + (url || location.href)).then(() => {
                UI.showToast(I18N.t('copiedToast'));
            }).catch(() => {});
        }
    },

    // ─── Confetti ───
    fireConfetti() {
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);
        const colors = ['#8b5cf6', '#ec4899', '#06d6a0', '#f97316', '#3b82f6', '#fbbf24'];
        for (let i = 0; i < 60; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 0.8 + 's';
            piece.style.animationDuration = (2 + Math.random()) + 's';
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            container.appendChild(piece);
        }
        setTimeout(() => container.remove(), 3500);
    },

    // ─── Guest Picks Badge ───
    initGuestPicksBadge() {
        if (Auth.user) return;
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'guest-picks-badge';
        badge.id = 'guest-picks-badge';
        // The guest limit is also a direct registration entry point.
        badge.addEventListener('click', () => {
            if (typeof Auth !== 'undefined') {
                Auth.showModal('register');
            }
        });
        this._updateGuestBadge(badge);
        const pickBtns = document.querySelector('.pick-buttons');
        if (pickBtns) pickBtns.appendChild(badge);
    },

    _updateGuestBadge(badge) {
        if (!badge) badge = document.getElementById('guest-picks-badge');
        if (!badge || Auth.user) {
            if (badge) badge.remove();
            return;
        }
        const remaining = Math.max(0, this.GUEST_PICK_LIMIT - this.guestPickCount);
        const guestLabel = (typeof I18N !== 'undefined' && I18N.t('guest')) || 'Гість';
        if (remaining <= 0) {
            const ctaText = (typeof I18N !== 'undefined' && I18N.current === 'en')
                ? 'Sign up to keep picking'
                : 'Зареєструйся, щоб продовжити';
            badge.textContent = `0 / ${this.GUEST_PICK_LIMIT} · ${ctaText}`;
            badge.title = (typeof I18N !== 'undefined' && I18N.current === 'en')
                ? 'You have used your 6 free guest picks. Click to register and keep going.'
                : 'Ти використав 6 безкоштовних спроб. Натисни, щоб зареєструватись і продовжити.';
        } else {
            badge.textContent = `${guestLabel}: ${remaining} / ${this.GUEST_PICK_LIMIT}`;
            badge.title = (typeof I18N !== 'undefined' && I18N.current === 'en')
                ? `${remaining} of ${this.GUEST_PICK_LIMIT} free guest picks left. Register to remove the limit.`
                : `Залишилось ${remaining} з ${this.GUEST_PICK_LIMIT} безкоштовних підборів. Зареєструйся, щоб прибрати ліміт.`;
        }
        badge.setAttribute('aria-label', badge.title);
        badge.classList.remove('warning', 'exhausted');
        if (remaining <= 0) badge.classList.add('exhausted');
        else if (remaining <= 2) badge.classList.add('warning');
    },

    // ─── Scroll Progress Bar ───
    initScrollProgress() {
        const bar = document.createElement('div');
        bar.className = 'scroll-progress';
        bar.id = 'scroll-progress';
        document.body.appendChild(bar);
        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            bar.style.width = pct + '%';
        }, { passive: true });
    },

    // ─── Double-Click to Save ───
    initDoubleClickSave() {
        const card = document.getElementById('result-card');
        if (!card) return;
        card.addEventListener('dblclick', (e) => {
            if (e.target.closest('button') || e.target.closest('a')) return;
            if (!this.currentItem) return;
            this.toggleSave();
            const heart = document.createElement('div');
            heart.className = 'double-click-hint';
            heart.textContent = this.isItemSaved(this.currentItem, this.currentType) ? '❤️' : '💔';
            card.style.position = 'relative';
            card.appendChild(heart);
            setTimeout(() => heart.remove(), 900);
        });
    },

    // ─── Donate Modal ───
    initDonate() {
        const btn = document.getElementById('footer-donate-btn');
        const supportBtn = document.getElementById('support-donate-btn');
        const modal = document.getElementById('donate-modal');
        const overlay = document.getElementById('donate-overlay');
        const close = document.getElementById('donate-close');
        if (!modal) return;

        if (btn) btn.addEventListener('click', () => modal.classList.remove('hidden'));
        if (supportBtn) supportBtn.addEventListener('click', () => modal.classList.remove('hidden'));
        if (overlay) overlay.addEventListener('click', () => modal.classList.add('hidden'));
        if (close) close.addEventListener('click', () => modal.classList.add('hidden'));

        this.loadDonateProgress();
    },

    async loadDonateProgress() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/donate-progress`);
            if (!res.ok) return;
            const data = await res.json();
            const fill = document.getElementById('donate-progress-fill');
            const amount = document.getElementById('donate-progress-amount');
            if (fill && data.current != null && data.goal) {
                const pct = Math.min(100, (data.current / data.goal) * 100);
                fill.style.width = pct + '%';
                if (amount) amount.textContent = `$${data.current} / $${data.goal}`;
            }
            if (data.mono_url) {
                const el = document.getElementById('donate-mono-link');
                if (el) el.href = data.mono_url;
            }
            if (data.coffee_url) {
                const el = document.getElementById('donate-coffee-link');
                if (el) el.href = data.coffee_url;
            }
            if (data.patreon_url) {
                const el = document.getElementById('donate-patreon-link');
                if (el) el.href = data.patreon_url;
            }
        } catch {}
    },

    // ─── Keyboard Shortcuts ───
    initKeyboardShortcuts() {
        let hintTimeout: any = null;
        const showKbdHint = () => {
            let hint = document.getElementById('kbd-hint');
            if (!hint) {
                hint = document.createElement('div');
                hint.id = 'kbd-hint';
                hint.className = 'kbd-hint';
                hint.innerHTML =
                    '<span><kbd>N</kbd> Наступний</span>' +
                    '<span><kbd>S</kbd> Зберегти</span>' +
                    '<span><kbd>F</kbd> Фільтри</span>' +
                    '<span><kbd>1-3</kbd> Табу</span>' +
                    '<span><kbd>?</kbd> Допомога</span>';
                document.body.appendChild(hint);
            }
            hint.style.opacity = '1';
            clearTimeout(hintTimeout);
            hintTimeout = setTimeout(() => { hint!.style.opacity = '0'; }, 3000);
        };
        document.addEventListener('keydown', (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
                const fabMenu = document.getElementById('fab-menu');
                if (fabMenu && !fabMenu.classList.contains('hidden')) fabMenu.classList.add('hidden');
                const shareMenu = document.getElementById('share-menu');
                if (shareMenu && !shareMenu.classList.contains('hidden')) shareMenu.classList.add('hidden');
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            switch (e.key.toLowerCase()) {
                case 'n':
                case ' ':
                    e.preventDefault();
                    this.pick();
                    break;
                case 's':
                    e.preventDefault();
                    if (this.currentItem) {
                        const saved = this.isItemSaved(this.currentItem, this.currentType);
                        if (!saved) this.saveItem(this.currentItem, this.currentType);
                        else this.removeItem(this.currentItem, this.currentType);
                    }
                    break;
                case 'f':
                    e.preventDefault();
                    UI.toggleFilters();
                    break;
                case '1':
                    e.preventDefault();
                    this.switchTab('movies');
                    document.querySelectorAll('.tab-btn').forEach(b => {
                        (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.tab === 'movies');
                    });
                    break;
                case '2':
                    e.preventDefault();
                    this.switchTab('tv');
                    document.querySelectorAll('.tab-btn').forEach(b => {
                        (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.tab === 'tv');
                    });
                    break;
                case '3':
                    e.preventDefault();
                    this.switchTab('books');
                    document.querySelectorAll('.tab-btn').forEach(b => {
                        (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.tab === 'books');
                    });
                    break;
                case '?':
                    showKbdHint();
                    break;
            }
        });
    },

    initCookieConsent() {
        if (localStorage.getItem('picksy_cookies_accepted')) return;
        const banner = document.getElementById('cookie-consent');
        if (!banner) return;
        banner.classList.remove('hidden');
        document.getElementById('cookie-accept')?.addEventListener('click', () => {
            localStorage.setItem('picksy_cookies_accepted', '1');
            banner.classList.add('hidden');
        });
    },

    _liveOnline: 0,
    _livePopular: '',
    _livePopularSetAt: 0,
    _liveFallbackTitles: ['Dune 2', 'Oppenheimer', 'The Bear', 'Shogun', 'Fallout', 'Wednesday', 'Interstellar', 'Breaking Bad'],
    _liveTimer: null as any,
    _livePopularTimer: null as any,
    _liveSSE: null as any,
    _liveLastPickAt: null as number | null,
    _liveRecentTickTimer: null as any,
    _liveTeardownBound: false,
    _liveRecentItems: null as any,

    async _fetchLiveSnapshot(): Promise<{ online: number; last_pick_at: number | null }> {
        // "Popular" intentionally lives in its own fetcher (_fetchPopularTitle)
        // because it must come from TMDB trending, not from recent user picks.
        const out: { online: number; last_pick_at: number | null } = { online: 0, last_pick_at: null };
        try {
            const [statsRes, picksRes] = await Promise.all([
                fetch(`${CONFIG.API_URL}/api/picks/stats`, { cache: 'no-store' }).catch(() => null),
                fetch(`${CONFIG.API_URL}/api/picks/global?limit=10`, { cache: 'no-store' }).catch(() => null),
            ]);
            if (statsRes && statsRes.ok) {
                const s = await statsRes.json();
                out.online = Math.max(Number(s.active_now) || 0, 0);
            }
            if (picksRes && picksRes.ok) {
                const j = await picksRes.json();
                const items = (j && j.items) || [];
                if (items.length) {
                    const latest = items[0];
                    if (latest.picked_at) {
                        const dt = new Date(latest.picked_at).getTime();
                        if (!isNaN(dt)) out.last_pick_at = dt;
                    }
                    this._liveRecentItems = items;
                }
            }
        } catch (e) {}
        return out;
    },
    async _fetchPopularTitle(): Promise<string> {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/trending?type=movie&lang=uk`, { cache: 'no-store' });
            if (res && res.ok) {
                const arr = await res.json();
                if (Array.isArray(arr) && arr.length) {
                    const idx = Math.floor(Math.random() * Math.min(arr.length, 5));
                    const title = (arr[idx] && (arr[idx].title || arr[idx].name)) || '';
                    if (title) return title;
                }
            }
        } catch (e) {}
        return this._liveFallbackTitles[Math.floor(Math.random() * this._liveFallbackTitles.length)];
    },
    async _updatePopular() {
        const popularEl = document.getElementById('live-popular');
        if (!popularEl) return;
        const title = await this._fetchPopularTitle();
        if (!title) return;
        const t = typeof I18N !== 'undefined' ? (k: string) => I18N.t(k) : (k: string) => k;
        this._livePopular = title;
        this._livePopularSetAt = Date.now();
        popularEl.textContent = `${t('livePopular')}: ${title}`;
        popularEl.closest('.live-bar-chip')?.classList.add('live-bar-chip-flash');
        setTimeout(() => popularEl.closest('.live-bar-chip')?.classList.remove('live-bar-chip-flash'), 600);
    },
    _formatLastPick(sec: number | null): string {
        if (sec == null) return '';
        const t = typeof I18N !== 'undefined' ? (k: string) => I18N.t(k) : (k: string) => k;
        const isEn = (typeof I18N !== 'undefined' && (I18N as any).current === 'en');
        if (sec < 60) return `${sec} ${t('liveLastPickSec')}`;
        if (sec < 3600) {
            const m = Math.floor(sec / 60);
            return isEn ? `${m} min ago` : `${m} хв тому`;
        }
        const h = Math.floor(sec / 3600);
        return isEn ? `${h} h ago` : `${h} год тому`;
    },
    _tickLastPick(recentEl?: HTMLElement | null) {
        if (!recentEl) recentEl = document.getElementById('live-recent');
        if (!recentEl || !this._liveLastPickAt) return;
        const t = typeof I18N !== 'undefined' ? (k: string) => I18N.t(k) : (k: string) => k;
        const sec = Math.max(1, Math.floor((Date.now() - this._liveLastPickAt) / 1000));
        recentEl.textContent = `${t('liveLastPick')}: ${this._formatLastPick(sec)}`;
    },
    _applyLiveData(data: { online?: number; last_pick?: { picked_at?: string; title?: string } | null }) {
        const onlineEl = document.getElementById('live-online');
        const recentEl = document.getElementById('live-recent');
        const t = typeof I18N !== 'undefined' ? (k: string) => I18N.t(k) : (k: string) => k;

        if (data.online != null) {
            this._liveOnline = Math.max(1, Number(data.online) || 0);
            if (onlineEl) {
                onlineEl.textContent = `${this._liveOnline} ${t('liveOnline')}`;
                onlineEl.closest('.live-bar-chip')?.classList.add('live-bar-chip-flash');
                setTimeout(() => onlineEl.closest('.live-bar-chip')?.classList.remove('live-bar-chip-flash'), 600);
            }
        }
        if (data.last_pick && data.last_pick.picked_at) {
            const ts = new Date(data.last_pick.picked_at).getTime();
            if (!isNaN(ts)) {
                this._liveLastPickAt = ts;
                this._tickLastPick(recentEl);
                recentEl?.closest('.live-bar-chip')?.classList.add('live-bar-chip-flash');
                setTimeout(() => recentEl?.closest('.live-bar-chip')?.classList.remove('live-bar-chip-flash'), 600);
            }
        } else {
            this._tickLastPick(recentEl);
        }
    },
    _connectSSE() {
        if (this._liveSSE) { try { (this._liveSSE as EventSource).close(); } catch(e){} }
        const url = `${CONFIG.API_URL}/api/live/stream`;
        const es = new EventSource(url);
        this._liveSSE = es;

        es.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                this._applyLiveData(data);
            } catch(e) {}
        };

        es.onerror = () => {
            es.close();
            this._liveSSE = null;
            this._startPollingFallback();
            setTimeout(() => {
                clearInterval(this._liveTimer);
                this._connectSSE();
            }, 30000);
        };
    },
    _startPollingFallback() {
        clearInterval(this._liveTimer);
        const update = async () => {
            const snap = await this._fetchLiveSnapshot();
            this._applyLiveData({
                online: snap.online,
                last_pick: snap.last_pick_at ? { picked_at: new Date(snap.last_pick_at).toISOString() } : null,
            });
        };
        update();
        this._liveTimer = setInterval(update, 25000);
    },

    _normalizeRecentPick(item) {
        const rawType = item.type || item.media_type || item.kind || 'movie';
        const type = rawType === 'tv' || rawType === 'series' ? 'tv' : rawType === 'book' || rawType === 'books' ? 'book' : 'movie';
        const id = item.id || item.tmdb_id || item.volume_id || item.item_id || item.media_id;
        const title = item.title || item.name || item.item_title || '';
        const posterPath = item.poster_path || item.poster;
        const poster = posterPath && String(posterPath).startsWith('/')
            ? `${CONFIG.TMDB_IMG}${posterPath}`
            : (posterPath || (type === 'book' ? CONFIG.FALLBACK_BOOK_POSTER : type === 'tv' ? CONFIG.FALLBACK_TV_POSTER : CONFIG.FALLBACK_POSTER));
        const year = item.year || item.release_date?.slice?.(0, 4) || item.first_air_date?.slice?.(0, 4) || '';
        let safeUrl = '';
        try {
            if (item.url) {
                const parsed = new URL(item.url, window.location.origin);
                safeUrl = `${parsed.pathname}${parsed.search || ''}`;
            }
        } catch (_) {}
        return {
            id,
            type,
            title,
            poster,
            year,
            rating: item.rating || item.vote_average || '',
            overview: item.overview || item.description || '',
            pickedAt: item.picked_at || item.created_at || '',
            picks: item.picks || item.pick_count || item.count || 1,
            url: safeUrl,
        };
    },

    openRecentPicksModal(type = 'all') {
        const modal = document.getElementById('recent-picks-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        this.renderRecentPicks(type);
    },

    closeRecentPicksModal() {
        const modal = document.getElementById('recent-picks-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    },

    renderRecentPicks(type = 'all') {
        const list = document.getElementById('recent-picks-list');
        const empty = document.getElementById('recent-picks-empty');
        if (!list) return;

        document.querySelectorAll('.recent-picks-filter').forEach((btn) => {
            (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.rptype === type);
        });

        const items = ((this._liveRecentItems || []) as any[])
            .map(item => this._normalizeRecentPick(item))
            .filter(item => item.id && item.title)
            .filter(item => type === 'all' || item.type === type)
            .slice(0, 10);

        if (!items.length) {
            list.innerHTML = '';
            empty?.classList.remove('hidden');
            return;
        }
        empty?.classList.add('hidden');
        list.innerHTML = items.map((item) => {
            const label = item.type === 'tv' ? (I18N.current === 'en' ? 'Series' : 'Серіал') : item.type === 'book' ? (I18N.current === 'en' ? 'Book' : 'Книга') : (I18N.current === 'en' ? 'Movie' : 'Фільм');
            const desc = item.overview ? `<p class="recent-pick-overview">${this._escapeHtml(item.overview)}</p>` : '';
            const rating = item.rating ? `<span class="recent-pick-chip rating">★ ${this._escapeHtml(Number(item.rating).toFixed ? Number(item.rating).toFixed(1) : item.rating)}</span>` : '';
            const pickedDate = item.pickedAt ? this._formatTrackerDate(item.pickedAt) : '';
            const pickText = item.picks > 1
                ? (I18N.current === 'en' ? `${item.picks} picks` : `${item.picks} підбори`)
                : (I18N.current === 'en' ? 'fresh pick' : 'свіжий підбір');
            return `
                <button class="recent-pick-item" type="button" data-id="${this._escapeHtml(item.id)}" data-type="${this._escapeHtml(item.type)}" data-url="${this._escapeHtml(item.url)}">
                    <img class="recent-pick-poster" src="${this._escapeHtml(item.poster)}" alt="" loading="lazy" onerror="this.src='${item.type === 'book' ? CONFIG.FALLBACK_BOOK_POSTER : item.type === 'tv' ? CONFIG.FALLBACK_TV_POSTER : CONFIG.FALLBACK_POSTER}'">
                    <span class="recent-pick-info">
                        <span class="recent-pick-title-row">
                            <strong class="recent-pick-title">${this._escapeHtml(item.title)}</strong>
                            ${item.year ? `<span class="recent-pick-year">${this._escapeHtml(item.year)}</span>` : ''}
                        </span>
                        <span class="recent-pick-meta">
                            <span class="recent-pick-chip type">${label}</span>
                            ${rating}
                            <span class="recent-pick-chip">${this._escapeHtml(pickText)}</span>
                            ${pickedDate ? `<span class="recent-pick-chip duration">${this._escapeHtml(pickedDate)}</span>` : ''}
                        </span>
                        ${desc}
                        <span class="recent-pick-open">${I18N.current === 'en' ? 'Open details' : 'Відкрити опис'}</span>
                    </span>
                </button>
            `;
        }).join('');
    },

    initLiveBar() {
        const onlineEl = document.getElementById('live-online');

        if (!this._recentPicksBound) {
            this._recentPicksBound = true;
            document.getElementById('live-bar')?.addEventListener('click', () => this.openRecentPicksModal('all'));
            document.getElementById('recent-picks-overlay')?.addEventListener('click', () => this.closeRecentPicksModal());
            document.getElementById('recent-picks-close')?.addEventListener('click', () => this.closeRecentPicksModal());
            document.querySelectorAll('.recent-picks-filter').forEach((btn) => {
                btn.addEventListener('click', () => this.renderRecentPicks((btn as HTMLElement).dataset.rptype || 'all'));
            });
            document.getElementById('recent-picks-list')?.addEventListener('click', (e) => {
                const card = (e.target as HTMLElement).closest('.recent-pick-item') as HTMLElement | null;
                if (!card) return;
                this.closeRecentPicksModal();
                if (card.dataset.url) {
                    window.location.href = card.dataset.url;
                    return;
                }
                this.goToDetailPage(card.dataset.id, card.dataset.type);
            });
        }

        if (!onlineEl) return;

        clearInterval(this._liveRecentTickTimer);
        this._liveRecentTickTimer = setInterval(() => this._tickLastPick(), 1000);

        const doFetch = async () => {
            try {
                const snap = await this._fetchLiveSnapshot();
                this._applyLiveData({
                    online: snap.online,
                    last_pick: snap.last_pick_at ? { picked_at: new Date(snap.last_pick_at).toISOString() } : null,
                });
            } catch(e) {}
        };
        doFetch();
        clearInterval(this._liveTimer);
        this._liveTimer = setInterval(doFetch, 30000);

        this._updatePopular();
        clearInterval(this._livePopularTimer);
        this._livePopularTimer = setInterval(() => this._updatePopular(), 5 * 60 * 1000);

        if (typeof EventSource !== 'undefined') {
            this._connectSSE();
        }

        if (!this._liveTeardownBound) {
            this._liveTeardownBound = true;
            const teardown = () => {
                try { (this._liveSSE as EventSource | null)?.close(); } catch(e){}
                this._liveSSE = null;
                clearInterval(this._liveTimer);
                clearInterval(this._livePopularTimer);
                clearInterval(this._liveRecentTickTimer);
            };
            window.addEventListener('pagehide', teardown);
            window.addEventListener('beforeunload', teardown);
        }
    },
};

// Expose App globally so other scripts (e.g. mascot.js) can introspect
// the current tab/content type without a manual hand-off. This lets the
// mascot pick context-aware loading lines (movie / tv / book) without
// changing every showLoading() call site.
(window as any).App = App;

document.addEventListener('DOMContentLoaded', () => {
    App.init();
    App.loadDailyPick(App.currentTab || 'movies');
    App.loadTrending(App.currentTab || 'movies');
    App.loadAnnouncements();
    App.initFab();
    App.initUsername();
    App.initProfileEditor();
    App.initFeedbackMini();
    App.initAdBanner();
    App.initKeyboardShortcuts();
    App.initDonate();
    if (typeof Auth !== 'undefined' && Auth.token) {
        App.loadAchievements();
    }
    // Re-render the showcase grid when the active subscription tier changes
    // (admin disables freemium / trial activates / user upgrades).
    try {
        document.addEventListener('picksy:tier-changed', () => {
            App.loadShowcaseBadges();
        });
    } catch {}
    // Re-render badge labels when the user switches UI language.
    try {
        const langButtons = document.querySelectorAll('.lang-btn');
        langButtons.forEach(b => b.addEventListener('click', () => {
            // Defer until I18N.applyAll has run.
            setTimeout(() => App._renderShowcaseGrid && App._renderShowcaseGrid(), 50);
        }));
    } catch {}
});
