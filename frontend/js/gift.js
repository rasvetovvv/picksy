// @ts-nocheck
/* Picksy — 🎁 Gift to a friend  v2
 * Full-featured gift system: single/multi-use, group gifts, 12 themes,
 * voice note, schedule, QR code, gift history, recipient reactions,
 * gift opening page with unwrap animation, and more.
 */
const Gift = {
    _modal: null,
    _state: {
        item: null,
        type: 'movie',
        theme: 'classic',
        giftMode: 'single',   // 'single' | 'multi' | 'group'
        maxOpens: 1,
        recipientName: '',
        scheduledAt: '',
        voiceBlob: null,
        voiceB64: null,
        token: null,
        hideUntilOpen: false,
        allowReaction: true,
        anonymous: false,
    },
    _media: { rec: null, chunks: [], stream: null, timer: null, started: 0 },
    _historyCache: null,

    /* ─── Themes ──────────────────────────────────────────── */
    _themes() {
        const t = this._t.bind(this);
        return [
            { id: 'classic',     name: t('🎬 Класична', '🎬 Classic') },
            { id: 'halloween',   name: t('🎃 Хелловін', '🎃 Halloween') },
            { id: 'christmas',   name: t('🎄 Різдво', '🎄 Christmas') },
            { id: 'birthday',    name: t('🎂 День народження', '🎂 Birthday') },
            { id: 'valentines',  name: t('💖 Закоханим', '💖 Love') },
            { id: 'newyear',     name: t('✨ Новий рік', '✨ New Year') },
            { id: 'summer',      name: t('☀️ Літо', '☀️ Summer') },
            { id: 'movienight',  name: t('🍿 Кіновечір', '🍿 Movie Night') },
            { id: 'graduation',  name: t('🎓 Випускний', '🎓 Graduation') },
            { id: 'thankyou',    name: t('🙏 Подяка', '🙏 Thank You') },
            { id: 'anniversary', name: t('💍 Річниця', '💍 Anniversary') },
            { id: 'horror',      name: t('👻 Страшна ніч', '👻 Horror Night') },
        ];
    },

    /* ─── Suggestions ─────────────────────────────────────── */
    _getSuggestions() {
        const isEn = (typeof I18N !== 'undefined' && I18N.current === 'en');
        return isEn ? [
            'Watch this tonight, you\'ll love it 🍿',
            'A perfect movie for our next date 💕',
            'Trust me on this one',
            'Thinking of you — enjoy this one! ✨',
            'You NEED to see this ASAP 🔥',
            'For your cozy evening at home 🛋️',
        ] : [
            'Дивись це сьогодні ввечері, тобі зайде 🍿',
            'Ідеальне для нашого вечора разом 💕',
            'Просто повір мені на слово',
            'Думаю про тебе — насолоджуйся! ✨',
            'Тобі ПОТРІБНО це побачити 🔥',
            'Для затишного вечора вдома 🛋️',
        ];
    },

    /* ─── Picksy AI Tips ─────────────────────────────────────── */
    _aiTips() {
        const t = this._t.bind(this);
        return {
            greeting: [
                t('Привіт! Я допоможу створити ідеальний подарунок. Обери тему та напиши записку — це зробить подарунок особливим! ✨', 'Hi! I\'ll help create the perfect gift. Pick a theme and write a note — it\'ll make your gift special! ✨'),
                t('Готовий створити крутий подарунок? Я тут щоб допомогти! 🎁', 'Ready to create an awesome gift? I\'m here to help! 🎁'),
            ],
            theme_classic: [
                t('Класика — завжди працює! Простий та елегантний подарунок 🎬', 'Classic — always works! Simple and elegant gift 🎬'),
            ],
            theme_halloween: [
                t('Бу-у-у! 🎃 Ідеально для страшних фільмів чи хоррор-серіалів!', 'Boo! 🎃 Perfect for horror movies or thriller series!'),
            ],
            theme_christmas: [
                t('Хо-хо-хо! 🎄 Новорічний настрій для подарунку!', 'Ho-ho-ho! 🎄 Christmas vibes for your gift!'),
            ],
            theme_birthday: [
                t('З днем народження! 🎂 Подарунок стане чудовим сюрпризом!', 'Happy birthday! 🎂 This gift will be a wonderful surprise!'),
            ],
            theme_valentines: [
                t('Любов у повітрі! 💖 Ідеальний подарунок для коханої людини', 'Love is in the air! 💖 Perfect gift for someone special'),
            ],
            theme_newyear: [
                t('Новий рік — новий фільм! ✨ Чудовий подарунок для свята', 'New year — new movie! ✨ Great gift for the holidays'),
            ],
            theme_summer: [
                t('Літній вайб! ☀️ Легкий подарунок для теплого вечора', 'Summer vibes! ☀️ A light gift for a warm evening'),
            ],
            theme_movienight: [
                t('Попкорн готовий? 🍿 Ідеальний подарунок для кіновечора!', 'Popcorn ready? 🍿 Perfect gift for a movie night!'),
            ],
            theme_graduation: [
                t('Вітаю з випускним! 🎓 Фільм — найкращий подарунок для відпочинку', 'Congrats on graduating! 🎓 A movie is the best way to relax'),
            ],
            theme_thankyou: [
                t('Подяка — це завжди красиво 🙏 Нехай цей подарунок скаже все', 'Gratitude is always beautiful 🙏 Let this gift say it all'),
            ],
            theme_anniversary: [
                t('Річниця — особлива подія! 💍 Зроби цей подарунок незабутнім', 'Anniversary — a special event! 💍 Make this gift unforgettable'),
            ],
            theme_horror: [
                t('Готуйся лякатися! 👻 Страшний подарунок для сміливих', 'Get ready to be scared! 👻 A spooky gift for the brave'),
            ],
            mode_single: [
                t('Одноразовий — подарунок відкриється тільки раз. Ексклюзивно! 🔒', 'Single use — the gift opens only once. Exclusive! 🔒'),
                t('Як справжній подарунок — один раз розпакував і все! 🎁', 'Like a real gift — unwrap once and that\'s it! 🎁'),
            ],
            mode_multi: [
                t('Багаторазовий — друг зможе відкривати подарунок кілька разів! 🔄', 'Multi-use — your friend can open the gift multiple times! 🔄'),
                t('Чудовий варіант, якщо хочеш поділитися з кількома людьми! 👥', 'Great option if you want to share with several people! 👥'),
            ],
            mode_group: [
                t('Груповий подарунок — зберіть побажання від усіх друзів! 👥✨', 'Group gift — collect wishes from all your friends! 👥✨'),
                t('Кожен зможе додати своє побажання. Крутий сюрприз! 🎉', 'Everyone can add their wish. Awesome surprise! 🎉'),
            ],
            note_focus: [
                t('Записка зробить подарунок особливим! Напиши щось від серця 💌', 'A note makes the gift special! Write something heartfelt 💌'),
                t('Порада: коротка та щира записка завжди краще за довгу! ✍️', 'Tip: a short and sincere note is always better than a long one! ✍️'),
                t('Можеш обрати готову фразу або написати свою! 💬', 'Pick a ready phrase or write your own! 💬'),
            ],
            voice_record: [
                t('Голосова записка — це вау! Друг почує твій голос 🎤✨', 'A voice note — that\'s wow! Your friend will hear your voice 🎤✨'),
                t('До 30 секунд голосового привітання. Зроби подарунок живим! 🗣️', 'Up to 30 seconds of a voice greeting. Make the gift alive! 🗣️'),
            ],
            schedule: [
                t('Можеш запланувати відкриття — наприклад, на день народження! ⏰', 'You can schedule opening — for example, on a birthday! ⏰'),
                t('Відклади відкриття і зроби сюрприз ще крутішим! 🎯', 'Delay the opening and make the surprise even better! 🎯'),
            ],
            options: [
                t('Приховати назву — друг побачить її тільки після відкриття! 🙈', 'Hide the title — your friend sees it only after opening! 🙈'),
                t('Анонімний подарунок — нехай друг гадає хто надіслав! 🕵️', 'Anonymous gift — let your friend guess who sent it! 🕵️'),
            ],
            recipient: [
                t('Додай ім\'я — подарунок стане персональним! 💝', 'Add a name — the gift becomes personal! 💝'),
                t('Ім\'я отримувача з\'явиться на сторінці подарунку ✨', 'The recipient name will appear on the gift page ✨'),
            ],
        };
    },

    _showAiTip(category) {
        const tips = this._aiTips();
        const pool = tips[category];
        if (!pool || !pool.length) return;
        const tip = pool[Math.floor(Math.random() * pool.length)];
        const el = document.getElementById('gift-ai-text');
        if (!el) return;
        el.classList.add('gift-ai-typing');
        setTimeout(() => {
            el.textContent = tip;
            el.classList.remove('gift-ai-typing');
        }, 150);
        this._bumpMascot('happy');
    },

    _bumpMascot(mood) {
        try {
            const m = document.getElementById('gift-ai-mascot');
            if (!m) return;
            const moods = ['happy', 'excited', 'wink', 'thinking', 'shocked', 'smirk'];
            const next = mood || moods[Math.floor(Math.random() * moods.length)];
            m.setAttribute('data-mood', next);
            m.classList.remove('gift-ai-mascot-bump');
            void m.offsetWidth;
            m.classList.add('gift-ai-mascot-bump');
        } catch (e) {}
    },

    _aiIdeas() {
        // High-signal grab-bag of ideas / brainstorm prompts shown when the
        // user clicks the Picksy box itself (not the Help button). Bigger
        // pool than _aiTips so it always feels fresh.
        const t = this._t.bind(this);
        return [
            t('Порада: обери тему під подію друга — ДР / річниця / випускний. Маленька деталь робить колосальну різницю ✨', 'Tip: pick a theme matching the occasion — birthday / anniversary / graduation. Tiny detail, huge difference ✨'),
            t('Порада: коротка жива записка краще за довгий трактат. 1–2 речення, і вже крипово 💌', 'Tip: a short living note beats a long monologue. 1–2 sentences and it\'s magic 💌'),
            t('Груповий режим — саме те, якщо хочеш зібрати побажання від всієї компанії 👥', 'Group mode is exactly what you want for a wishlist from a whole crew 👥'),
            t('Голосова записка = клас 🎙️ Навіть просте «Привіт!» звучить в 100 разів тепліше', 'Voice note = chef\'s kiss 🎙️ Even a plain "Hi!" sounds 100x warmer'),
            t('Заплануй відкриття на потрібну дату — вийде живий сюрприз в правильний момент ⏰', 'Schedule the opening for the right date — you get a perfectly timed surprise ⏰'),
            t('Приховай назву до моменту відкриття — враження в 100 разів сильніше 🙈', 'Hide the title until opening — the reveal hits 100x harder 🙈'),
            t('Якщо сумніваєшся — натисни «Допомога». Я все підберу випадково — вийде свіже і живе ✨', 'Stuck? Hit "Help" and I\'ll roll the dice — fresh and lively every time ✨'),
            t('Не бійся анонімності — «від таємного друга» звучить як роман 🕵️', 'Don\'t shy from anonymous — "from a secret friend" sounds straight out of a romance 🕵️'),
            t('Порада: багаторазовий — якщо хочеш, щоб друг повернувся до подарунка ще раз. 1× = вибух, N× = ворожба 🎁', 'Tip: multi-use if you want your friend to revisit. 1× = sharp surprise, N× = lingering magic 🎁'),
            t('Додай ім’я отримувача — сторінка подарунку відразу стане персональною 💝', 'Add the recipient\'s name — the gift page instantly feels personal 💝'),
            t('Якщо це любимий фільм — бери класичну тему, вона не відволікає від самого враження 🎬', 'If it\'s their favourite movie — go classic, it lets the film itself shine 🎬'),
        ];
    },

    _showAiIdea() {
        const ideas = this._aiIdeas();
        const el = document.getElementById('gift-ai-text');
        if (!el || !ideas.length) return;
        const last = el.dataset.lastIdea || '';
        let idea = ideas[Math.floor(Math.random() * ideas.length)];
        if (idea === last && ideas.length > 1) {
            idea = ideas[(ideas.indexOf(idea) + 1) % ideas.length];
        }
        el.dataset.lastIdea = idea;
        el.classList.add('gift-ai-typing');
        setTimeout(() => {
            el.textContent = idea;
            el.classList.remove('gift-ai-typing');
        }, 150);
        this._bumpMascot();
    },

    _autoFillFromAi() {
        // "Допомога" button: roll a fresh random configuration so the user
        // can ship a gift with one click and tweak from a strong baseline.
        // Every roll picks different theme/mode/phrase/options so the result
        // never feels canned.
        if (!this._modal) return;
        const host = this._modal;
        const t = this._t.bind(this);
        const themes = this._themes();
        const themeChoice = themes[Math.floor(Math.random() * themes.length)];
        const modes = ['single', 'multi', 'group'];
        // Bias toward single/multi (group is heavier coordination).
        const modeChoice = (Math.random() < 0.55) ? 'single' : (Math.random() < 0.7 ? 'multi' : 'group');
        const phrases = this._getSuggestions();
        const phraseChoice = phrases[Math.floor(Math.random() * phrases.length)];
        const flipHide = Math.random() < 0.35;
        const flipAnon = Math.random() < 0.2;
        const scheduleOff = (Math.random() < 0.45)
            ? [60, 120, 360, 1440, 2880, 4320][Math.floor(Math.random() * 6)]
            : 0;

        // — Apply theme
        host.querySelectorAll('.gift-theme').forEach(b => {
            const on = b.dataset.theme === themeChoice.id;
            b.classList.toggle('active', on);
        });
        this._state.theme = themeChoice.id;

        // — Apply mode (also toggles maxRow / groupInfo visibility)
        host.querySelectorAll('.gift-mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === modeChoice);
        });
        this._state.giftMode = modeChoice;
        const maxRow = host.querySelector('.gift-max-opens-row');
        if (maxRow) maxRow.style.display = (modeChoice === 'multi') ? 'flex' : 'none';
        const groupInfo = host.querySelector('.gift-group-info');
        if (groupInfo) groupInfo.style.display = (modeChoice === 'group') ? 'block' : 'none';
        if (modeChoice === 'multi') {
            const maxSlider = host.querySelector('#gift-max-opens');
            const maxVal = host.querySelector('.gift-max-val');
            const v = [2, 3, 5, 10][Math.floor(Math.random() * 4)];
            if (maxSlider) maxSlider.value = String(v);
            this._state.maxOpens = v;
            if (maxVal) maxVal.textContent = v >= 100 ? '∞' : String(v);
        }

        // — Apply note
        const noteEl = host.querySelector('#gift-note');
        if (noteEl) {
            noteEl.value = phraseChoice;
            noteEl.dispatchEvent(new Event('input'));
        }

        // — Apply options
        const hideToggle = host.querySelector('#gift-hide-until-open');
        if (hideToggle) { hideToggle.checked = flipHide; this._state.hideUntilOpen = flipHide; }
        const anonToggle = host.querySelector('#gift-anonymous');
        if (anonToggle) { anonToggle.checked = flipAnon; this._state.anonymous = flipAnon; }

        // — Apply schedule (sometimes)
        if (scheduleOff > 0) {
            const sched = host.querySelector('#gift-sched');
            if (sched) {
                const dt = new Date(Date.now() + scheduleOff * 60 * 1000);
                const pad = n => String(n).padStart(2, '0');
                const v = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate())
                    + 'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
                sched.value = v;
                this._state.scheduledAt = v;
            }
        }

        this._refreshPreview();

        // Announce what we did so the user knows AI did something.
        const announce = t(
            `✨ Готово! Підібрав ${themeChoice.name} + «${phraseChoice}». Можеш правити або натисни «Створити»`,
            `✨ Done! Rolled ${themeChoice.name} + “${phraseChoice}”. Tweak it or hit “Create”`
        );
        const el = document.getElementById('gift-ai-text');
        if (el) {
            el.classList.add('gift-ai-typing');
            setTimeout(() => {
                el.textContent = announce;
                el.classList.remove('gift-ai-typing');
            }, 150);
        }
        this._bumpMascot('excited');
    },

    /* ─── Public API ──────────────────────────────────────── */
    open(item, type) {
        this._state.item = item;
        this._state.type = type || 'movie';
        this._state.theme = 'classic';
        this._state.giftMode = 'single';
        this._state.maxOpens = 1;
        this._state.recipientName = '';
        this._state.scheduledAt = '';
        this._state.voiceBlob = null;
        this._state.voiceB64 = null;
        this._state.token = null;
        this._state.hideUntilOpen = false;
        this._state.allowReaction = true;
        this._state.anonymous = false;
        this._render();
    },

    openHistory() {
        this._renderHistory();
    },

    /* ─── i18n helper ─────────────────────────────────────── */
    _t(uk, en) {
        try { return (I18N.current === 'en') ? en : uk; } catch (e) { return uk; }
    },

    /* ─── Toast helper (handles UI.showToast / UI.toast / fallback) ─── */
    _toast(msg) {
        try { if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') { UI.showToast(msg); return; } } catch (e) {}
        try { if (typeof UI !== 'undefined' && typeof UI.toast === 'function') { UI.toast(msg); return; } } catch (e) {}
        // Last-resort inline toast so users actually see the feedback.
        try {
            let el = document.getElementById('gift-inline-toast');
            if (!el) {
                el = document.createElement('div');
                el.id = 'gift-inline-toast';
                el.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);' +
                    'background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;padding:12px 22px;' +
                    'border-radius:14px;font:600 14px/1.3 Inter,system-ui,sans-serif;' +
                    'box-shadow:0 18px 40px -8px rgba(139,92,246,.5);z-index:99999;' +
                    'opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;max-width:90vw;text-align:center';
                document.body.appendChild(el);
            }
            el.textContent = msg;
            requestAnimationFrame(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateX(-50%) translateY(0)';
            });
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => {
                if (el) { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(10px)'; }
            }, 2400);
        } catch (e) {}
    },

    _isLogged() {
        return !!localStorage.getItem('pfm_token') || !!localStorage.getItem('picksy_token');
    },

    _itemTitle() {
        const it = this._state.item; if (!it) return '';
        if (this._state.type === 'tv') return it.name || it.original_name || '';
        return it.title || it.original_title || '';
    },
    _itemPoster() {
        const it = this._state.item; if (!it) return '';
        if (it.poster_path) return 'https://image.tmdb.org/t/p/w500' + it.poster_path;
        if (it.poster) return it.poster;
        if (it.image_url) return it.image_url;
        return '';
    },
    _itemYear() {
        const it = this._state.item; if (!it) return '';
        const d = it.release_date || it.first_air_date || it.published_date || '';
        return (d || '').slice(0, 4);
    },
    _itemOverview() {
        const it = this._state.item; if (!it) return '';
        return (it.overview || it.description || '').slice(0, 800);
    },

    /* ─── Main Render ─────────────────────────────────────── */
    _render() {
        if (!this._isLogged()) {
            this._toast(this._t('Увійди щоб надіслати подарунок', 'Please log in to gift a movie'));
            return;
        }
        let host = document.getElementById('gift-modal');
        if (host) host.remove();
        host = document.createElement('div');
        host.id = 'gift-modal';
        host.className = 'gift-modal';
        host.innerHTML = this._modalHtml();
        document.body.appendChild(host);
        this._modal = host;
        document.body.style.overflow = 'hidden';
        // Hide FAB menu when gift modal opens
        const fabContainer = document.getElementById('fab-container');
        if (fabContainer) fabContainer.style.display = 'none';
        this._bindEvents(host);
    },

    _bindEvents(host) {
        host.querySelector('.gift-close').addEventListener('click', () => this.close());
        host.addEventListener('click', (e) => { if (e.target === host) this.close(); });

        // Picksy AI helper: "Допомога" button auto-fills a fresh random
        // gift configuration; clicking the box itself rolls a random idea.
        const helper = host.querySelector('#gift-ai-helper');
        const helpBtn = host.querySelector('#gift-ai-help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._autoFillFromAi();
            });
        }
        if (helper) {
            helper.addEventListener('click', (e) => {
                // Ignore clicks on the help button (handled above).
                if (e.target.closest('.gift-ai-help-btn')) return;
                this._showAiIdea();
            });
            helper.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._showAiIdea();
                }
            });
        }

        // Theme picker
        host.querySelectorAll('.gift-theme').forEach(b => b.addEventListener('click', () => {
            this._state.theme = b.dataset.theme;
            host.querySelectorAll('.gift-theme').forEach(x => x.classList.toggle('active', x === b));
            this._refreshPreview();
            this._showAiTip('theme_' + b.dataset.theme);
        }));

        // Gift mode tabs
        host.querySelectorAll('.gift-mode-btn').forEach(b => b.addEventListener('click', () => {
            this._state.giftMode = b.dataset.mode;
            host.querySelectorAll('.gift-mode-btn').forEach(x => x.classList.toggle('active', x === b));
            const maxRow = host.querySelector('.gift-max-opens-row');
            if (maxRow) maxRow.style.display = (this._state.giftMode === 'multi') ? 'flex' : 'none';
            const groupInfo = host.querySelector('.gift-group-info');
            if (groupInfo) groupInfo.style.display = (this._state.giftMode === 'group') ? 'block' : 'none';
            this._showAiTip('mode_' + b.dataset.mode);
        }));

        // Max opens slider
        const maxSlider = host.querySelector('#gift-max-opens');
        const maxVal = host.querySelector('.gift-max-val');
        if (maxSlider) {
            maxSlider.addEventListener('input', () => {
                const v = parseInt(maxSlider.value, 10);
                this._state.maxOpens = v;
                if (maxVal) maxVal.textContent = v >= 100 ? '∞' : String(v);
            });
        }

        // Note
        const noteEl = host.querySelector('#gift-note');
        const noteCount = host.querySelector('.gift-note-count');
        if (noteEl) {
            noteEl.addEventListener('input', () => {
                const n = (noteEl.value || '').length;
                noteCount.textContent = n + '/280';
                this._refreshPreview();
            });
            noteEl.addEventListener('focus', () => this._showAiTip('note_focus'), { once: true });
        }
        host.querySelectorAll('.gift-note-suggest').forEach(s => s.addEventListener('click', () => {
            noteEl.value = s.textContent;
            noteEl.dispatchEvent(new Event('input'));
        }));

        // Recipient name
        const recipientEl = host.querySelector('#gift-recipient-name');
        if (recipientEl) {
            recipientEl.addEventListener('input', () => {
                this._state.recipientName = recipientEl.value.trim();
            });
            recipientEl.addEventListener('focus', () => this._showAiTip('recipient'), { once: true });
        }

        // Schedule
        const sched = host.querySelector('#gift-sched');
        if (sched) {
            sched.addEventListener('change', () => { this._state.scheduledAt = sched.value || ''; });
            sched.addEventListener('focus', () => this._showAiTip('schedule'), { once: true });
        }
        const schedClear = host.querySelector('.gift-sched-clear');
        if (schedClear) schedClear.addEventListener('click', () => { sched.value = ''; this._state.scheduledAt = ''; });
        host.querySelectorAll('.gift-sched-quick').forEach(b => b.addEventListener('click', () => {
            const offset = parseInt(b.dataset.min, 10) || 0;
            const dt = new Date(Date.now() + offset * 60 * 1000);
            const pad = n => String(n).padStart(2, '0');
            const v = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate())
                + 'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
            sched.value = v;
            this._state.scheduledAt = v;
        }));

        // Options toggles
        const hideToggle = host.querySelector('#gift-hide-until-open');
        if (hideToggle) hideToggle.addEventListener('change', () => { this._state.hideUntilOpen = hideToggle.checked; this._showAiTip('options'); });
        const reactToggle = host.querySelector('#gift-allow-reaction');
        if (reactToggle) reactToggle.addEventListener('change', () => { this._state.allowReaction = reactToggle.checked; this._showAiTip('options'); });
        const anonToggle = host.querySelector('#gift-anonymous');
        if (anonToggle) anonToggle.addEventListener('change', () => { this._state.anonymous = anonToggle.checked; this._showAiTip('options'); });

        // Voice
        const voiceRec = host.querySelector('.gift-voice-rec');
        if (voiceRec) voiceRec.addEventListener('click', () => { this._toggleRecord(); this._showAiTip('voice_record'); });
        const voiceClear = host.querySelector('.gift-voice-clear');
        if (voiceClear) voiceClear.addEventListener('click', () => this._clearVoice());

        // Submit
        host.querySelector('.gift-create-btn').addEventListener('click', () => this._submit());

        // Share buttons (after creation)
        host.querySelectorAll('.gift-share-btn').forEach(b => b.addEventListener('click', () => this._share(b.dataset.via)));
        const copyQr = host.querySelector('.gift-copy-qr');
        if (copyQr) copyQr.addEventListener('click', () => this._downloadQR());
        host.querySelector('.gift-restart').addEventListener('click', () => this._renderAgain());

        // History tab
        const histBtn = host.querySelector('.gift-tab-history');
        if (histBtn) histBtn.addEventListener('click', () => this._switchToHistory());
        const compBtn = host.querySelector('.gift-tab-compose');
        if (compBtn) compBtn.addEventListener('click', () => this._switchToCompose());

        // ESC
        this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._escHandler);
    },

    _renderAgain() {
        this.close();
        if (this._state.item) this.open(this._state.item, this._state.type);
    },

    /* ─── Modal HTML ──────────────────────────────────────── */
    _modalHtml() {
        const t = this._t.bind(this);
        const title = this._itemTitle() || '🎁';
        const poster = this._itemPoster();
        const year = this._itemYear();
        const themes = this._themes();
        const suggestions = this._getSuggestions();

        return `
        <div class="gift-modal-card">
            <!-- Tabs: Compose / History + Close -->
            <div class="gift-tabs">
                <button class="gift-tab gift-tab-compose active">${t('🎁 Створити', '🎁 Create')}</button>
                <button class="gift-tab gift-tab-history">${t('📦 Історія', '📦 History')}</button>
                <button class="gift-close" aria-label="${t('Закрити', 'Close')}"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button>
            </div>

            <!-- ═══ COMPOSE STEP ═══ -->
            <div class="gift-step gift-step-compose" id="gift-step-compose">
              <div class="gift-head">
                <div class="gift-head-emoji">🎁</div>
                <div>
                  <div class="gift-head-title">${t('Подарувати другу', 'Gift to a friend')}</div>
                  <div class="gift-head-sub">${title}${year ? ' · ' + year : ''}</div>
                </div>
              </div>

              <div class="gift-body">
                <!-- Preview (no more spinning blurred orbit — replaced with a soft static glow). -->
                <div class="gift-preview" id="gift-preview" data-theme="classic">
                  <div class="gift-preview-glow"></div>
                  <div class="gift-preview-shimmer" aria-hidden="true"></div>
                  <div class="gift-preview-box">
                    <div class="gift-preview-base"></div>
                    <div class="gift-preview-ribbon-h"></div>
                    <div class="gift-preview-lid"><div class="gift-preview-ribbon-v"></div></div>
                    <div class="gift-preview-bow">🎀</div>
                    <div class="gift-preview-sparkle gift-preview-sparkle-1" aria-hidden="true">✦</div>
                    <div class="gift-preview-sparkle gift-preview-sparkle-2" aria-hidden="true">✧</div>
                  </div>
                  ${poster ? `<img class="gift-preview-poster" src="${poster}" alt="">` : ''}
                </div>

                <!-- Gift mode: single / multi / group -->
                <div class="gift-section">
                  <div class="gift-label">${t('Тип подарунка', 'Gift type')}</div>
                  <div class="gift-mode-row">
                    <button type="button" class="gift-mode-btn active" data-mode="single">
                      <span class="gift-mode-icon">🔒</span>
                      <span class="gift-mode-label">${t('Одноразовий', 'Single use')}</span>
                      <span class="gift-mode-desc">${t('Тільки 1 перегляд', 'Opens once')}</span>
                    </button>
                    <button type="button" class="gift-mode-btn" data-mode="multi">
                      <span class="gift-mode-icon">🔄</span>
                      <span class="gift-mode-label">${t('Багаторазовий', 'Multi-use')}</span>
                      <span class="gift-mode-desc">${t('Можна відкрити N разів', 'N times to open')}</span>
                    </button>
                    <button type="button" class="gift-mode-btn" data-mode="group">
                      <span class="gift-mode-icon">👥</span>
                      <span class="gift-mode-label">${t('Груповий', 'Group')}</span>
                      <span class="gift-mode-desc">${t('Подарунок від компанії', 'Gift from a group')}</span>
                    </button>
                  </div>
                  <!-- Max opens slider (for multi mode) -->
                  <div class="gift-max-opens-row" style="display:none">
                    <label>${t('Кількість відкриттів', 'Max opens')}:</label>
                    <input type="range" id="gift-max-opens" min="2" max="100" value="5" />
                    <span class="gift-max-val">5</span>
                  </div>
                  <!-- Group info (for group mode) -->
                  <div class="gift-group-info" style="display:none">
                    <p class="gift-group-text">${t('Поділіться посиланням з друзями — кожен зможе додати своє побажання до подарунка.', 'Share the link with friends — everyone can add their wish to the gift.')}</p>
                  </div>
                </div>

                <!-- Recipient name -->
                <div class="gift-section">
                  <div class="gift-label">${t('Для кого?', 'For whom?')} <span class="gift-meta">${t('опційно', 'optional')}</span></div>
                  <input type="text" id="gift-recipient-name" class="gift-input" maxlength="60" placeholder="${t('Ім\'я отримувача', 'Recipient name')}" />
                </div>

                <!-- Theme picker -->
                <div class="gift-section">
                  <div class="gift-label">${t('Обгортка', 'Wrapping')}</div>
                  <div class="gift-themes">
                    ${themes.map(th => `<button type="button" class="gift-theme${th.id === 'classic' ? ' active' : ''}" data-theme="${th.id}">${th.name}</button>`).join('')}
                  </div>
                </div>

                <!-- Note -->
                <div class="gift-section">
                  <div class="gift-label">
                    <span>${t('Записка', 'Personal note')}</span>
                    <span class="gift-note-count">0/280</span>
                  </div>
                  <textarea id="gift-note" maxlength="280" rows="3" placeholder="${t('Напиши кілька слів другу…', 'Write a few words…')}"></textarea>
                  <div class="gift-suggest-row">
                    ${suggestions.map(s => `<button type="button" class="gift-note-suggest">${s}</button>`).join('')}
                  </div>
                </div>

                <!-- Voice note -->
                <div class="gift-section">
                  <div class="gift-label">${t('Голосова записка', 'Voice note')} <span class="gift-meta">${t('до 30с', 'up to 30s')}</span></div>
                  <div class="gift-voice-row">
                    <button type="button" class="gift-voice-rec" id="gift-voice-rec">🎤 <span>${t('Записати', 'Record')}</span></button>
                    <button type="button" class="gift-voice-clear" id="gift-voice-clear" hidden>🗑 ${t('Видалити', 'Clear')}</button>
                    <span class="gift-voice-status" id="gift-voice-status"></span>
                  </div>
                  <audio id="gift-voice-preview" controls hidden style="width:100%;margin-top:8px;border-radius:10px"></audio>
                </div>

                <!-- Schedule -->
                <div class="gift-section">
                  <div class="gift-label">${t('Відкласти відкриття', 'Schedule opening')} <span class="gift-meta">${t('опційно', 'optional')}</span></div>
                  <div class="gift-sched-row">
                    <input type="datetime-local" id="gift-sched" />
                    <button type="button" class="gift-sched-quick" data-min="60">+1${t('г', 'h')}</button>
                    <button type="button" class="gift-sched-quick" data-min="180">+3${t('г', 'h')}</button>
                    <button type="button" class="gift-sched-quick" data-min="1440">+1${t('д', 'd')}</button>
                    <button type="button" class="gift-sched-clear">&times;</button>
                  </div>
                </div>

                <!-- Extra options -->
                <div class="gift-section gift-options-section">
                  <div class="gift-label">${t('Додаткові опції', 'Extra options')}</div>
                  <div class="gift-option-row">
                    <label class="gift-toggle-label">
                      <input type="checkbox" id="gift-hide-until-open" />
                      <span class="gift-toggle-slider"></span>
                      <span>${t('Приховати назву до відкриття', 'Hide title until opened')}</span>
                    </label>
                  </div>
                  <div class="gift-option-row">
                    <label class="gift-toggle-label">
                      <input type="checkbox" id="gift-allow-reaction" checked />
                      <span class="gift-toggle-slider"></span>
                      <span>${t('Дозволити реакцію отримувача', 'Allow recipient reaction')}</span>
                    </label>
                  </div>
                  <div class="gift-option-row">
                    <label class="gift-toggle-label">
                      <input type="checkbox" id="gift-anonymous" />
                      <span class="gift-toggle-slider"></span>
                      <span>${t('Анонімний подарунок', 'Anonymous gift')}</span>
                    </label>
                  </div>
                </div>

                <!-- Picksy AI Helper -->
                <div class="gift-ai-helper" id="gift-ai-helper" role="button" tabindex="0"
                     title="${t('Натисни для ідеї', 'Click for ideas')}">
                  <div class="gift-ai-avatar">
                    ${(typeof Picksy !== 'undefined' && Picksy.svg)
                        ? '<div class="picksy-mascot" data-mood="happy" id="gift-ai-mascot" aria-hidden="true"><div class="picksy-figure picksy-figure-gift">' + Picksy.svg({ label: 'Picksy' }) + '</div></div>'
                        : '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="100" cy="100" r="84" fill="#8b5cf6"/></svg>'}
                  </div>
                  <div class="gift-ai-content">
                    <div class="gift-ai-name">Picksy</div>
                    <div class="gift-ai-text" id="gift-ai-text">${t('Привіт! Я допоможу створити ідеальний подарунок. Обери тему та напиши записку — це зробить подарунок особливим! ✨', 'Hi! I\'ll help you create the perfect gift. Pick a theme and write a note — it\'ll make your gift special! ✨')}</div>
                  </div>
                  <button type="button" class="gift-ai-help-btn" id="gift-ai-help-btn"
                          title="${t('Настроїти подарунок автоматично', 'Auto-configure the gift')}">
                    <span aria-hidden="true">✨</span>
                    <span class="gift-ai-help-btn-label">${t('Допомога', 'Help')}</span>
                  </button>
                </div>

                <button type="button" class="gift-create-btn" id="gift-create-btn">
                  <span>🎁</span> ${t('Створити подарунок', 'Create gift')}
                </button>
              </div>
            </div>

            <!-- ═══ SHARE STEP ═══ -->
            <div class="gift-step gift-step-share" id="gift-step-share" hidden>
              <div class="gift-success">
                <div class="gift-success-icon">✨</div>
                <div class="gift-success-title">${t('Подарунок готовий!', 'Your gift is ready!')}</div>
                <div class="gift-success-sub">${t('Поділись посиланням з другом', 'Share the link with your friend')}</div>
              </div>

              <!-- Gift stats badge -->
              <div class="gift-stats-badge" id="gift-stats-badge">
                <span class="gift-stat-item">🎁 <span id="gift-stat-mode">${t('Одноразовий', 'Single')}</span></span>
                <span class="gift-stat-sep">·</span>
                <span class="gift-stat-item">🎨 <span id="gift-stat-theme">${t('Класична', 'Classic')}</span></span>
              </div>

              <div class="gift-link-box">
                <input type="text" id="gift-link" readonly />
                <button type="button" class="gift-share-btn" data-via="copy">📋 ${t('Копіювати', 'Copy')}</button>
              </div>

              <!-- QR Code -->
              <div class="gift-qr-section">
                <div class="gift-qr-frame">
                    <canvas id="gift-qr-canvas" width="260" height="260"></canvas>
                    <div class="gift-qr-brand">🎬</div>
                </div>
                <div class="gift-qr-caption">${t('Скануй щоб відкрити подарунок', 'Scan to open the gift')}</div>
                <button type="button" class="gift-copy-qr">${t('📥 Завантажити QR', '📥 Download QR')}</button>
              </div>

              <div class="gift-share-grid">
                <button type="button" class="gift-share-btn gift-share-tg" data-via="telegram">✈️ Telegram</button>
                <button type="button" class="gift-share-btn gift-share-wa" data-via="whatsapp">💬 WhatsApp</button>
                <button type="button" class="gift-share-btn gift-share-vb" data-via="viber">📱 Viber</button>
                <button type="button" class="gift-share-btn gift-share-em" data-via="email">📧 Email</button>
                <button type="button" class="gift-share-btn gift-share-ig" data-via="instagram">📷 Instagram</button>
                <button type="button" class="gift-share-btn gift-share-fb" data-via="facebook">📘 Facebook</button>
                <button type="button" class="gift-share-btn gift-share-tw" data-via="twitter">🐦 X / Twitter</button>
                <button type="button" class="gift-share-btn gift-share-link" data-via="native">${t('📤 Поділитись', '📤 Share')}</button>
              </div>
              <button type="button" class="gift-restart">${t('🎁 Створити ще один', '🎁 Create another')}</button>
            </div>

            <!-- ═══ HISTORY TAB ═══ -->
            <div class="gift-step gift-step-history" id="gift-step-history" hidden>
              <div class="gift-history-head">
                <div class="gift-head-emoji">📜</div>
                <div>
                  <div class="gift-head-title">${t('Історія подарунків', 'Gift History')}</div>
                  <div class="gift-head-sub">${t('Твої надіслані та отримані', 'Your sent and received')}</div>
                </div>
              </div>
              <div class="gift-history-tabs">
                <button class="gift-htab active" data-htab="sent">${t('📤 Надіслані', '📤 Sent')}</button>
                <button class="gift-htab" data-htab="received">${t('📥 Отримані', '📥 Received')}</button>
              </div>
              <div class="gift-history-list" id="gift-history-list">
                <div class="gift-history-loading">${t('Завантаження…', 'Loading…')}</div>
              </div>
            </div>
        </div>`;
    },

    /* ─── Preview ─────────────────────────────────────────── */
    _refreshPreview() {
        const p = document.getElementById('gift-preview');
        if (p) p.dataset.theme = this._state.theme;
    },

    /* ─── Tab switching ───────────────────────────────────── */
    _switchToHistory() {
        if (!this._modal) return;
        this._modal.querySelector('#gift-step-compose').hidden = true;
        this._modal.querySelector('#gift-step-share').hidden = true;
        this._modal.querySelector('#gift-step-history').hidden = false;
        this._modal.querySelectorAll('.gift-tab').forEach(t => t.classList.remove('active'));
        this._modal.querySelector('.gift-tab-history').classList.add('active');
        this._loadHistory();
        this._bindHistoryTabs();
    },
    _switchToCompose() {
        if (!this._modal) return;
        this._modal.querySelector('#gift-step-compose').hidden = false;
        this._modal.querySelector('#gift-step-share').hidden = true;
        this._modal.querySelector('#gift-step-history').hidden = true;
        this._modal.querySelectorAll('.gift-tab').forEach(t => t.classList.remove('active'));
        this._modal.querySelector('.gift-tab-compose').classList.add('active');
    },

    /* ─── History ─────────────────────────────────────────── */
    _bindHistoryTabs() {
        if (!this._modal) return;
        this._modal.querySelectorAll('.gift-htab').forEach(b => {
            b.onclick = () => {
                this._modal.querySelectorAll('.gift-htab').forEach(x => x.classList.toggle('active', x === b));
                this._loadHistory(b.dataset.htab);
            };
        });
    },
    async _loadHistory(tab) {
        tab = tab || 'sent';
        const list = this._modal.querySelector('#gift-history-list');
        if (!list) return;
        list.innerHTML = `<div class="gift-history-loading">${this._t('Завантаження…', 'Loading…')}</div>`;
        const token = localStorage.getItem('pfm_token');
        if (!token) {
            list.innerHTML = `<div class="gift-history-empty">${this._t('Увійди щоб побачити історію', 'Log in to see history')}</div>`;
            return;
        }
        try {
            const res = await fetch(`/api/gifts/history?tab=${tab}`, {
                headers: { 'Authorization': 'Bearer ' + token },
            });
            if (!res.ok) throw new Error('fail');
            const data = await res.json();
            const items = data.items || [];
            if (!items.length) {
                list.innerHTML = `<div class="gift-history-empty">${
                    tab === 'sent'
                        ? this._t('Ти ще не надсилав подарунків', 'No gifts sent yet')
                        : this._t('Ти ще не отримував подарунків', 'No gifts received yet')
                }</div>`;
                return;
            }
            list.innerHTML = items.map(it => this._historyItemHtml(it, tab)).join('');
            list.querySelectorAll('.gift-history-item').forEach(el => {
                // copy link button (does not bubble to row click)
                const copyBtn = el.querySelector('.gift-hist-copy');
                if (copyBtn) {
                    copyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const link = el.dataset.link;
                        if (!link) return;
                        navigator.clipboard.writeText(link).then(() => {
                            this._toast('🔗 ' + this._t('Посилання на подарунок скопійовано', 'Gift link copied'));
                        }).catch(() => {
                            this._toast(this._t('Не вдалось скопіювати', 'Copy failed'));
                        });
                    });
                }
                // row click → open desc page if we know the item
                el.addEventListener('click', () => {
                    const id = el.dataset.itemid;
                    const type = el.dataset.itemtype;
                    if (id && type) {
                        // Close gift modal first
                        if (this._modal) this._modal.remove(); this._modal = null;
                        const lang = (typeof I18N !== 'undefined' && I18N.current) || 'uk';
                        const prefix = type === 'tv' ? 'desctv' : (type === 'book' ? 'descbook' : 'descmovie');
                        window.location.href = `/${prefix}/${encodeURIComponent(id)}?lang=${lang}`;
                        return;
                    }
                    const link = el.dataset.link;
                    if (link) {
                        navigator.clipboard.writeText(link).then(() => {
                            this._toast('🔗 ' + this._t('Посилання на подарунок скопійовано', 'Gift link copied'));
                        });
                    }
                });
            });
        } catch (e) {
            list.innerHTML = `<div class="gift-history-empty">${this._t('Помилка завантаження', 'Failed to load')}</div>`;
        }
    },
    _historyItemHtml(it, tab) {
        const t = this._t.bind(this);
        const poster = it.item_poster || '';
        const title = it.item_title || t('Без назви', 'Untitled');
        const date = it.created_at ? new Date(it.created_at).toLocaleDateString() : '';
        const opens = it.open_count !== undefined ? it.open_count : '?';
        const maxO = it.max_opens || 1;
        const mode = it.gift_mode === 'multi' ? t('Багаторазовий', 'Multi-use')
                   : it.gift_mode === 'group' ? t('Груповий', 'Group')
                   : t('Одноразовий', 'Single');
        const link = window.location.origin + '/gift/' + (it.token || '');
        const reactions = it.reactions || [];
        const reactHtml = reactions.length
            ? `<div class="gift-hist-reactions">${reactions.map(r => `<span class="gift-hist-react">${r.emoji}</span>`).join('')}</div>`
            : '';
        const statusIcon = it.opened ? '📭' : '📬';
        const itemId = it.item_id || '';
        const itemType = it.item_type || 'movie';
        return `
        <div class="gift-history-item" data-link="${link}" data-itemid="${itemId}" data-itemtype="${itemType}" title="${t('Клікни щоб відкрити деталі', 'Click to open details')}">
            ${poster ? `<img class="gift-hist-poster" src="${poster}" alt="" />` : '<div class="gift-hist-poster-empty">🎁</div>'}
            <div class="gift-hist-info">
                <div class="gift-hist-title">${statusIcon} ${title}</div>
                <div class="gift-hist-meta">${date} · ${mode} · ${opens}/${maxO} ${t('відкриттів', 'opens')}</div>
                ${tab === 'sent' && it.recipient_name ? `<div class="gift-hist-to">${t('Для', 'For')}: ${it.recipient_name}</div>` : ''}
                ${reactHtml}
            </div>
            <button class="gift-hist-copy" data-link-btn title="${t('Скопіювати посилання', 'Copy link')}">🔗</button>
            <div class="gift-hist-arrow">→</div>
        </div>`;
    },

    /* ─── Voice Recording ─────────────────────────────────── */
    async _toggleRecord() {
        const btn = this._modal.querySelector('.gift-voice-rec');
        const stat = this._modal.querySelector('#gift-voice-status');
        if (this._media.rec && this._media.rec.state === 'recording') {
            this._media.rec.stop();
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this._media.stream = stream;
            const rec = new MediaRecorder(stream, { mimeType: this._pickMime() });
            this._media.rec = rec;
            this._media.chunks = [];
            this._media.started = Date.now();
            rec.ondataavailable = (e) => { if (e.data && e.data.size) this._media.chunks.push(e.data); };
            rec.onstop = () => this._onRecStopped();
            rec.start();
            btn.innerHTML = '⏹ <span>' + this._t('Зупинити', 'Stop') + '</span>';
            btn.classList.add('recording');
            this._media.timer = setInterval(() => {
                const sec = Math.floor((Date.now() - this._media.started) / 1000);
                stat.textContent = '● ' + sec + 's';
                if (sec >= 30) { try { rec.stop(); } catch (e) {} }
            }, 250);
        } catch (e) {
            this._toast(this._t('Доступ до мікрофона відхилено', 'Microphone permission denied'));
        }
    },
    _pickMime() {
        const opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        for (const m of opts) {
            try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
        }
        return '';
    },
    async _onRecStopped() {
        const btn = this._modal.querySelector('.gift-voice-rec');
        const stat = this._modal.querySelector('#gift-voice-status');
        const clearBtn = this._modal.querySelector('.gift-voice-clear');
        const prev = this._modal.querySelector('#gift-voice-preview');
        if (this._media.timer) { clearInterval(this._media.timer); this._media.timer = null; }
        const blob = new Blob(this._media.chunks, { type: (this._media.rec && this._media.rec.mimeType) || 'audio/webm' });
        this._state.voiceBlob = blob;
        try { this._state.voiceB64 = await this._blobToDataUrl(blob); } catch (e) {}
        if (this._media.stream) {
            try { this._media.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
        }
        this._media.rec = null;
        btn.innerHTML = '🎤 <span>' + this._t('Перезаписати', 'Re-record') + '</span>';
        btn.classList.remove('recording');
        clearBtn.hidden = false;
        prev.hidden = false;
        prev.src = URL.createObjectURL(blob);
        const sec = Math.round(blob.size / 4000);
        stat.textContent = '✓ ' + this._t('Записано', 'Recorded') + ' (~' + sec + 's)';
    },
    _blobToDataUrl(blob) {
        return new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.onerror = () => rej(fr.error);
            fr.readAsDataURL(blob);
        });
    },
    _clearVoice() {
        const btn = this._modal.querySelector('.gift-voice-rec');
        const stat = this._modal.querySelector('#gift-voice-status');
        const clearBtn = this._modal.querySelector('.gift-voice-clear');
        const prev = this._modal.querySelector('#gift-voice-preview');
        this._state.voiceBlob = null; this._state.voiceB64 = null;
        prev.removeAttribute('src'); prev.hidden = true;
        clearBtn.hidden = true; stat.textContent = '';
        btn.innerHTML = '🎤 <span>' + this._t('Записати', 'Record') + '</span>';
    },

    /* ─── Submit ──────────────────────────────────────────── */
    async _submit() {
        const note = (this._modal.querySelector('#gift-note').value || '').trim();
        const sched = this._state.scheduledAt;
        const sendBtn = this._modal.querySelector('.gift-create-btn');
        sendBtn.disabled = true;
        sendBtn.innerHTML = '⏳ ' + this._t('Загортаю…', 'Wrapping…');
        const payload = {
            item_type: this._state.type,
            item_id: String(this._state.item.id || this._state.item.book_id || ''),
            item_title: this._itemTitle(),
            item_poster: this._itemPoster(),
            item_year: this._itemYear(),
            item_overview: this._itemOverview(),
            note: note || null,
            voice_data: this._state.voiceB64 || null,
            theme: this._state.theme || 'classic',
            gift_mode: this._state.giftMode,
            max_opens: this._state.giftMode === 'multi' ? this._state.maxOpens : (this._state.giftMode === 'group' ? 999 : 1),
            recipient_name: this._state.recipientName || null,
            hide_until_open: this._state.hideUntilOpen,
            allow_reaction: this._state.allowReaction,
            anonymous: this._state.anonymous,
            scheduled_at: sched ? new Date(sched).toISOString() : null,
        };
        try {
            const token = localStorage.getItem('pfm_token');
            const res = await fetch('/api/gifts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('failed');
            const data = await res.json();
            this._state.token = data.token;
            this._showShare();
        } catch (e) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '🎁 ' + this._t('Створити подарунок', 'Create gift');
            this._toast(this._t('Не вдалось створити. Спробуй ще раз.', 'Failed. Try again.'));
        }
    },

    /* ─── Show Share / QR ─────────────────────────────────── */
    _showShare() {
        this._modal.querySelector('#gift-step-compose').hidden = true;
        this._modal.querySelector('#gift-step-share').hidden = false;
        const link = window.location.origin + '/gift/' + this._state.token;
        this._modal.querySelector('#gift-link').value = link;

        // Update stats badge
        const modeNames = { single: this._t('Одноразовий', 'Single'), multi: this._t('Багаторазовий', 'Multi-use'), group: this._t('Груповий', 'Group') };
        const themeObj = this._themes().find(t => t.id === this._state.theme);
        const modeEl = this._modal.querySelector('#gift-stat-mode');
        const themeEl = this._modal.querySelector('#gift-stat-theme');
        if (modeEl) modeEl.textContent = modeNames[this._state.giftMode] || 'Single';
        if (themeEl) themeEl.textContent = themeObj ? themeObj.name : 'Classic';

        this._generateQR(link);
    },

    /* ─── QR Code (self-contained canvas renderer) ─────────── */
    _generateQR(text) {
        const canvas = this._modal.querySelector('#gift-qr-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const size = 260;
        canvas.width = size; canvas.height = size;
        // Light "paper" background for max contrast (better than dark for cameras)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        try {
            const modules = this._qrEncode(text);
            const n = modules.length;
            const pad = 12;
            const cellSize = (size - pad * 2) / n;
            // Read accent colors from CSS variables (set by Extras profile theme)
            const root = getComputedStyle(document.documentElement);
            const accent = (root.getPropertyValue('--profile-accent').trim() || '#181830');
            const accent2 = (root.getPropertyValue('--profile-accent-2').trim() || accent);
            // Reserve a logo "hole" in the center (~16% of dim) — ECC-L still scannable here
            const holeRadius = (n * cellSize) * 0.11;
            const cxg = pad + (n * cellSize) / 2;
            const cyg = pad + (n * cellSize) / 2;
            for (let r = 0; r < n; r++) {
                for (let c = 0; c < n; c++) {
                    const x = pad + c * cellSize;
                    const y = pad + r * cellSize;
                    // Skip module if inside logo circle (we'll draw white + brand)
                    const dx = x + cellSize / 2 - cxg, dy = y + cellSize / 2 - cyg;
                    if (Math.sqrt(dx * dx + dy * dy) < holeRadius) continue;
                    if (!modules[r][c]) continue;
                    // Detect finder pattern (3 corners) — paint accent2, others accent
                    const inFinder =
                        (r < 7 && c < 7) ||
                        (r < 7 && c >= n - 7) ||
                        (r >= n - 7 && c < 7);
                    ctx.fillStyle = inFinder ? accent2 : accent;
                    // Rounded square module for a softer brand look
                    const rad = Math.max(0.8, cellSize * 0.18);
                    if (typeof ctx.roundRect === 'function') {
                        ctx.beginPath();
                        ctx.roundRect(x, y, cellSize + 0.6, cellSize + 0.6, rad);
                        ctx.fill();
                    } else {
                        ctx.fillRect(x, y, cellSize + 0.6, cellSize + 0.6);
                    }
                }
            }
            // Brand circle in the middle
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cxg, cyg, holeRadius + 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(cxg, cyg, holeRadius, 0, Math.PI * 2);
            ctx.fill();
        } catch(e) {
            ctx.fillStyle = '#181830';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this._t('QR недоступний', 'QR unavailable'), size / 2, size / 2);
        }
    },
    /* Minimal QR encoder (byte mode, ECC-L, versions 1-10) */
    _qrEncode(text) {
        const data = new TextEncoder().encode(text);
        const len = data.length;
        const caps = [0,17,32,53,78,106,134,154,192,230,271];
        let ver = 1;
        for (let v = 1; v <= 10; v++) { if (caps[v] >= len) { ver = v; break; } if (v === 10) ver = 10; }
        const n = 17 + ver * 4;
        const grid = Array.from({ length: n }, () => new Uint8Array(n));
        const rsv = Array.from({ length: n }, () => new Uint8Array(n));
        const setMod = (r, c, v) => { grid[r][c] = v ? 1 : 0; rsv[r][c] = 1; };
        const addFinder = (r, c) => {
            for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
                const rr = r + dr, cc = c + dc;
                if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
                const v = (Math.max(Math.abs(dr), Math.abs(dc)) !== 2) ? 1 : 0;
                setMod(rr, cc, v);
            }
            for (let i = -4; i <= 4; i++) {
                for (const [dr, dc] of [[i, -4], [i, 4], [-4, i], [4, i]]) {
                    const rr = r + dr, cc = c + dc;
                    if (rr >= 0 && rr < n && cc >= 0 && cc < n) { setMod(rr, cc, 0); }
                }
            }
        };
        addFinder(3, 3); addFinder(3, n - 4); addFinder(n - 4, 3);
        for (let i = 8; i < n - 8; i++) { setMod(6, i, i % 2 === 0); setMod(i, 6, i % 2 === 0); }
        setMod(n - 8, 8, 1);
        if (ver >= 2) {
            const positions = [6, n - 7];
            for (const ar of positions) for (const ac of positions) {
                if (rsv[ar] && rsv[ar][ac]) continue;
                for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
                    const rr = ar + dr, cc = ac + dc;
                    if (rr >= 0 && rr < n && cc >= 0 && cc < n)
                        setMod(rr, cc, (Math.max(Math.abs(dr), Math.abs(dc)) !== 1) ? 1 : 0);
                }
            }
        }
        // Format info (mask 0, ECC L)
        const fmtBits = [1,1,1,0,1,1,1,1,1,0,0,0,1,0,0];
        for (let i = 0; i < 15; i++) {
            const v = fmtBits[i];
            if (i < 6) setMod(8, i, v); else if (i < 8) setMod(8, i + 1, v); else setMod(8, n - 15 + i, v);
            if (i < 8) setMod(n - 1 - i, 8, v); else if (i < 9) setMod(15 - i, 8, v); else setMod(14 - i, 8, v);
        }
        // Build data codewords
        const totalCW = [0,26,44,70,100,134,172,196,242,292,346][ver];
        const eccCW = [0,7,10,15,20,26,18,20,24,30,18][ver];
        const dataCW = totalCW - eccCW;
        const bits = [];
        const pushBits = (val, cnt) => { for (let i = cnt - 1; i >= 0; i--) bits.push((val >> i) & 1); };
        pushBits(4, 4); // byte mode
        pushBits(len, ver <= 9 ? 8 : 16);
        for (const b of data) pushBits(b, 8);
        pushBits(0, Math.min(4, dataCW * 8 - bits.length));
        while (bits.length % 8) bits.push(0);
        while (bits.length < dataCW * 8) { bits.push(1,1,1,0,1,1,0,0); if (bits.length < dataCW * 8) bits.push(0,0,0,1,0,0,0,1); }
        bits.length = dataCW * 8;
        const codewords = [];
        for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((a, b, j) => a | (b << (7 - j)), 0));
        // Reed-Solomon
        const gfExp = new Uint8Array(512), gfLog = new Uint8Array(256);
        let x = 1;
        for (let i = 0; i < 255; i++) { gfExp[i] = x; gfLog[x] = i; x = (x << 1) ^ (x & 128 ? 0x11d : 0); }
        for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];
        const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : gfExp[gfLog[a] + gfLog[b]];
        const genPoly = [1];
        for (let i = 0; i < eccCW; i++) {
            const next = new Array(genPoly.length + 1).fill(0);
            const factor = gfExp[i];
            for (let j = 0; j < genPoly.length; j++) { next[j] ^= genPoly[j]; next[j + 1] ^= gfMul(genPoly[j], factor); }
            genPoly.length = 0; genPoly.push(...next);
        }
        const remainder = new Array(eccCW).fill(0);
        for (const cw of codewords) {
            const fb = cw ^ remainder.shift(); remainder.push(0);
            for (let j = 0; j < remainder.length; j++) remainder[j] ^= gfMul(genPoly[j + 1], fb);
        }
        const allCW = [...codewords, ...remainder];
        // Place data bits
        let bitIdx = 0;
        const allBits = [];
        for (const cw of allCW) for (let i = 7; i >= 0; i--) allBits.push((cw >> i) & 1);
        let upward = true;
        for (let col = n - 1; col >= 1; col -= 2) {
            if (col === 6) col = 5;
            const rows = upward ? [...Array(n).keys()].reverse() : [...Array(n).keys()];
            for (const row of rows) {
                for (const dc of [0, -1]) {
                    const c = col + dc;
                    if (c < 0 || c >= n || rsv[row][c]) continue;
                    if (bitIdx < allBits.length) {
                        let bit = allBits[bitIdx++];
                        // Mask 0: (row + col) % 2 === 0
                        if ((row + c) % 2 === 0) bit ^= 1;
                        grid[row][c] = bit;
                    }
                }
            }
            upward = !upward;
        }
        return grid;
    },
    _downloadQR() {
        const canvas = this._modal.querySelector('#gift-qr-canvas');
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = 'picksy-gift-qr.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        this._toast('📥 ' + this._t('QR-код збережено', 'QR code saved'));
    },

    /* ─── Share ───────────────────────────────────────────── */
    _share(via) {
        const link = window.location.origin + '/gift/' + this._state.token;
        const title = this._itemTitle();
        const recipient = this._state.recipientName;
        const forText = recipient ? (' ' + this._t('для', 'for') + ' ' + recipient) : '';
        const msgUk = '🎁 Тобі подарунок-фільм' + forText + ': ' + title + '\n' + link;
        const msgEn = '🎁 A movie gift' + forText + ' for you: ' + title + '\n' + link;
        const msg = (typeof I18N !== 'undefined' && I18N.current === 'en') ? msgEn : msgUk;

        if (via === 'copy') {
            navigator.clipboard.writeText(link).then(() => {
                this._toast('🔗 ' + this._t('Посилання на подарунок скопійовано', 'Gift link copied'));
                // Pulse the copy button so the action feels affirmed.
                try {
                    const btn = this._modal && this._modal.querySelector('.gift-share-btn[data-via="copy"]');
                    if (btn) {
                        btn.classList.add('copied');
                        const originalHtml = btn.dataset.originalHtml || btn.innerHTML;
                        btn.dataset.originalHtml = originalHtml;
                        btn.innerHTML = '✅ ' + this._t('Скопійовано', 'Copied');
                        clearTimeout(this._copyResetTimer);
                        this._copyResetTimer = setTimeout(() => {
                            btn.classList.remove('copied');
                            btn.innerHTML = originalHtml;
                        }, 1800);
                    }
                } catch (e) {}
            }).catch(() => {
                this._toast(this._t('Не вдалось скопіювати', 'Copy failed'));
            });
            return;
        }
        if (via === 'native') {
            if (navigator.share) {
                navigator.share({ title: '🎁 Picksy Gift', text: msg, url: link }).catch(() => {});
            } else {
                navigator.clipboard.writeText(msg).then(() => {
                    this._toast('🔗 ' + this._t('Скопійовано', 'Copied'));
                });
            }
            return;
        }
        let url = '';
        if (via === 'telegram') url = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('🎁 ' + title);
        else if (via === 'whatsapp') url = 'https://wa.me/?text=' + encodeURIComponent(msg);
        else if (via === 'viber') url = 'viber://forward?text=' + encodeURIComponent(msg);
        else if (via === 'email') url = 'mailto:?subject=' + encodeURIComponent('🎁 Picksy gift' + forText) + '&body=' + encodeURIComponent(msg);
        else if (via === 'facebook') url = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link);
        else if (via === 'twitter') url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(msg);
        else if (via === 'instagram') {
            navigator.clipboard.writeText(msg).then(() => {
                this._toast('📋 ' + this._t('Текст скопійовано — встав у Instagram', 'Text copied — paste into Instagram'));
            });
            return;
        }
        if (url) {
            window.open(url, '_blank', 'noopener,width=720,height=620');
        }
    },

    /* ─── Close / Cleanup ─────────────────────────────────── */
    close() {
        if (this._modal) {
            this._modal.remove();
            this._modal = null;
        }
        document.body.style.overflow = '';
        // Show FAB menu again when gift modal closes
        const fabContainer = document.getElementById('fab-container');
        if (fabContainer) fabContainer.style.display = '';
        if (this._media.stream) {
            try { this._media.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
            this._media.stream = null;
        }
        if (this._media.timer) { clearInterval(this._media.timer); this._media.timer = null; }
        this._media.rec = null; this._media.chunks = [];
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    },
};

window.Gift = Gift;

/* ─── Shared toast helper (used by GiftOpen + gift-opened poller) ─── */
function _giftToast(msg) {
    try { if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') { UI.showToast(msg); return; } } catch (e) {}
    try { if (typeof UI !== 'undefined' && typeof UI.toast === 'function') { UI.toast(msg); return; } } catch (e) {}
    try {
        let el = document.getElementById('gift-inline-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'gift-inline-toast';
            el.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);' +
                'background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;padding:12px 22px;' +
                'border-radius:14px;font:600 14px/1.3 Inter,system-ui,sans-serif;' +
                'box-shadow:0 18px 40px -8px rgba(139,92,246,.5);z-index:99999;' +
                'opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;max-width:90vw;text-align:center';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
        clearTimeout(window._giftToastTimer);
        window._giftToastTimer = setTimeout(() => { if (el) { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(10px)'; } }, 2400);
    } catch (e) {}
}

/* ─── Gift Opening Page ──────────────────────────────────────────────── */
const GiftOpen = {
    _data: null,
    _container: null,

    async init() {
        const path = window.location.pathname;
        const match = path.match(/^\/gift\/([a-zA-Z0-9_-]+)$/);
        if (!match) return;
        const token = match[1];
        document.title = 'Picksy — 🎁';

        // Hide main app content and show a lightweight loading screen immediately
        this._showGiftLoading();

        // Try fetching with a short timeout, then retry once if it fails
        const fetchGift = async (timeoutMs) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            const res = await fetch('/api/gifts/' + token, {
                signal: controller.signal,
                headers: { 'Cache-Control': 'no-cache' }
            });
            clearTimeout(timer);
            if (!res.ok) throw new Error('not found');
            return res.json();
        };

        try {
            this._data = await fetchGift(6000);
            this._render(token);
        } catch (e1) {
            // Retry once with a longer timeout
            try {
                this._data = await fetchGift(10000);
                this._render(token);
            } catch (e2) {
                this._renderNotFound();
            }
        }
    },

    _showGiftLoading() {
        // Hide the main app UI so it doesn't flash behind the gift page
        const mainContent = document.querySelector('.container');
        if (mainContent) mainContent.style.display = 'none';
        const fabContainer = document.getElementById('fab-container');
        if (fabContainer) fabContainer.style.display = 'none';

        // Beautifully animated splash: a softly-bouncing, slightly-ajar gift
        // box on the left with Picksy peeking out and a speech bubble saying
        // "wait, I'm unpacking it for you". The lid wiggle + ribbon shimmer
        // give the user instant feedback so they don't think the page is
        // stuck while the gift data loads on slow mobile connections.
        const t = this._t.bind(this);
        const loadingPhrase = t('Хвилинку, зараз розпакую і віддам тобі!', 'One moment, I\'m unpacking it for you!');
        const loadingSub = t('Готую сюрприз…', 'Preparing your surprise…');

        let host = document.getElementById('gift-open-page');
        if (host) host.remove();
        host = document.createElement('div');
        host.id = 'gift-open-page';
        host.className = 'gift-open-page gift-open-theme-classic gift-open-loading';
        host.innerHTML = `
            <div class="gift-open-bg"><div class="gift-open-particles"></div></div>
            <div class="gift-loading-card">
                <div class="gift-loading-stage">
                    <div class="gift-loading-box" aria-hidden="true">
                        <div class="gift-loading-box-base"></div>
                        <div class="gift-loading-box-ribbon-h"></div>
                        <div class="gift-loading-box-lid">
                            <div class="gift-loading-box-ribbon-v"></div>
                        </div>
                        <div class="gift-loading-box-bow">🎀</div>
                        <div class="gift-loading-sparkles" aria-hidden="true">
                            <span></span><span></span><span></span><span></span><span></span>
                        </div>
                    </div>
                    <div class="gift-loading-mascot" id="gift-loading-mascot" aria-hidden="true">
                        <div class="gift-loading-mascot-face" id="gift-loading-mascot-face">🎬</div>
                    </div>
                </div>
                <div class="gift-loading-bubble">
                    <span class="gift-loading-bubble-brand">Picksy<span class="gift-loading-bubble-ai">AI</span></span>
                    <span class="gift-loading-bubble-text" id="gift-loading-text">${loadingPhrase}</span>
                </div>
                <div class="gift-loading-dots" aria-hidden="true">
                    <span></span><span></span><span></span>
                </div>
                <div class="gift-loading-sub">${loadingSub}</div>
            </div>`;
        document.body.appendChild(host);

        // Try to inject the real Picksy SVG mascot inside the loading face.
        try {
            const faceEl = document.getElementById('gift-loading-mascot-face');
            if (faceEl && window.Picksy && typeof window.Picksy.svg === 'function') {
                const wrap = document.createElement('div');
                wrap.className = 'picksy-mascot';
                wrap.setAttribute('data-mood', 'excited');
                wrap.setAttribute('aria-hidden', 'true');
                const figure = document.createElement('div');
                figure.className = 'picksy-figure';
                figure.innerHTML = window.Picksy.svg({ label: 'Picksy' });
                wrap.appendChild(figure);
                faceEl.textContent = '';
                faceEl.appendChild(wrap);
            }
        } catch (_) { /* fallback emoji already in place */ }
    },

    _t(uk, en) {
        try { return (I18N.current === 'en') ? en : uk; } catch (e) { return uk; }
    },

    /* Returns a theme-specific [uk, en] mascot phrase tuple used during the
     * unwrap animation. Each theme has 2 phrases so repeat opens feel fresh.
     * We pick deterministically by token-hash so the same recipient sees the
     * same phrase across reloads. */
    _themePhrase(theme, token) {
        const phrases = {
            classic:     [
                ['Зараз розпаковую — обіцяю, тобі сподобається! 🎁', 'Unwrapping it now — you\'re gonna love this! 🎁'],
                ['Один момент, тримай свій кіно-сюрприз! 🎬',     'One sec, here comes your movie surprise! 🎬'],
            ],
            birthday:    [
                ['З Днем народження! 🎂 Дивись, що тобі підібрали!', 'Happy birthday! 🎂 Look what they picked for you!'],
                ['Святковий подарунок — спеціально для іменинника! 🎉', 'A birthday treat — especially for you! 🎉'],
            ],
            christmas:   [
                ['Хо-хо-хо! 🎄 Тримай свій новорічний подарунок!', 'Ho-ho-ho! 🎄 Here\'s your Christmas gift!'],
                ['Чарівна ніч — і чарівний фільм у подарунок! ❄️', 'Magical night, magical movie for you! ❄️'],
            ],
            newyear:     [
                ['Новий рік — новий фільм! ✨ Розпаковую…',         'New year, new movie! ✨ Unwrapping…'],
                ['Бажаю тобі казкових серій у цьому році! 🎆',     'Wishing you a year of great stories! 🎆'],
            ],
            valentines:  [
                ['З любов\'ю до тебе 💖 Дивись, що приготували!', 'With love just for you 💖 Look inside!'],
                ['Романтичний сюрприз — обережно, можна закохатись 💘', 'A romantic surprise — careful, you might fall for it 💘'],
            ],
            summer:      [
                ['Літній вайб у дорозі! ☀️ Зачекай секунду…',     'Summer vibes incoming! ☀️ One sec…'],
                ['Розпаковую щось легке і сонячне — для тебе ☀️🌊', 'Unwrapping something light and sunny for you ☀️🌊'],
            ],
            halloween:   [
                ['Шшшш… 👻 Готую щось моторошне і смачне!',         'Shhh… 👻 Cooking up something spooky for you!'],
                ['Обережно — зараз вистрибне сюрприз! 🎃',          'Watch out — surprise jumping out! 🎃'],
            ],
            movienight:  [
                ['Попкорн готовий? 🍿 Зараз буде фільм!',           'Popcorn ready? 🍿 Movie incoming!'],
                ['Світло гасимо, плед і… твій кіновечір 🎬',         'Lights off, blanket on… your movie night 🎬'],
            ],
            gratitude:   [
                ['Тобі дякують — і подарунок цьому свідок 🙏',     'Someone\'s thanking you — and this gift is proof 🙏'],
                ['Маленька подяка з великою турботою 💛',           'A small thank-you wrapped with great care 💛'],
            ],
            anniversary: [
                ['Особливий день — особливий подарунок 💍',         'A special day calls for a special gift 💍'],
                ['Чарівна річниця — і чарівне кіно у подарунок ✨', 'A magical anniversary — magical movie inside ✨'],
            ],
        };
        const list = phrases[theme] || phrases.classic;
        // Stable per-token index — same phrase every time the same recipient
        // opens the same gift.
        let h = 0;
        const tk = (token || '').toString();
        for (let i = 0; i < tk.length; i++) h = (h * 31 + tk.charCodeAt(i)) | 0;
        const idx = Math.abs(h) % list.length;
        const pair = list[idx];
        try { return (I18N.current === 'en') ? pair[1] : pair[0]; } catch (e) { return pair[0]; }
    },

    _render(token) {
        const d = this._data;
        const t = this._t.bind(this);
        const theme = d.theme || 'classic';
        const title = d.hide_until_open && !d.opened ? t('Таємний подарунок 🎁', 'Secret Gift 🎁') : (d.item_title || 'Gift');
        const poster = d.hide_until_open && !d.opened ? '' : (d.item_poster || '');
        const year = d.item_year || '';
        const overview = d.hide_until_open && !d.opened ? '' : (d.item_overview || '');
        const note = d.note || '';
        const recipientName = d.recipient_name || '';
        const senderName = d.anonymous ? t('Анонім', 'Anonymous') : (d.sender_name || t('Друг', 'A friend'));
        const isScheduled = d.scheduled_at && new Date(d.scheduled_at) > new Date();

        let host = document.getElementById('gift-open-page');
        if (host) host.remove();
        host = document.createElement('div');
        host.id = 'gift-open-page';
        host.className = 'gift-open-page gift-open-theme-' + theme;

        const greetTo = recipientName ? `<div class="gift-open-greeting">${t('Для', 'For')} ${recipientName} 💝</div>` : '';
        const fromLine = `<div class="gift-open-from">${t('Від', 'From')}: ${senderName}</div>`;
        const schedHtml = isScheduled
            ? `<div class="gift-open-sched">
                <span>⏳</span>
                <span>${t('Подарунок можна відкрити', 'Gift can be opened')}: <strong>${new Date(d.scheduled_at).toLocaleString()}</strong></span>
               </div>`
            : '';

        // Theme metadata is reused for the on-page label, the CTA label and
        // an alt mascot phrase. The label list mirrors `Gift._themes()` but
        // is kept local so GiftOpen doesn't need to reach into Gift.
        const themeNames = {
            classic:     t('🎬 Класична',        '🎬 Classic'),
            halloween:   t('🎃 Хелловін',        '🎃 Halloween'),
            christmas:   t('🎄 Різдво',          '🎄 Christmas'),
            birthday:    t('🎂 День народження', '🎂 Birthday'),
            valentines:  t('💖 Закоханим',       '💖 Love'),
            newyear:     t('✨ Новий рік',       '✨ New Year'),
            summer:      t('☀️ Літо',           '☀️ Summer'),
            movienight:  t('🍿 Кіновечір',       '🍿 Movie Night'),
            graduation:  t('🎓 Випускний',       '🎓 Graduation'),
            thankyou:    t('🙏 Подяка',          '🙏 Thank You'),
            anniversary: t('💍 Річниця',         '💍 Anniversary'),
            horror:      t('👻 Страшна ніч',     '👻 Horror Night'),
        };
        const themeMeta = { id: theme, name: themeNames[theme] || t('🎬 Picksy подарунок', '🎬 Picksy gift') };
        const itemTypeLabel = (() => {
            if (d.item_type === 'movie') return t('фільм', 'movie');
            if (d.item_type === 'tv')    return t('серіал', 'series');
            if (d.item_type === 'book')  return t('книгу', 'book');
            return t('подарунок', 'gift');
        })();
        const itemTypeCapital = (() => {
            if (d.item_type === 'movie') return t('Відкрити фільм', 'Open movie');
            if (d.item_type === 'tv')    return t('Відкрити серіал', 'Open series');
            if (d.item_type === 'book')  return t('Відкрити книгу', 'Open book');
            return t('Відкрити сторінку', 'Open page');
        })();
        const itemTypeIcon = (() => {
            if (d.item_type === 'movie') return '🎬';
            if (d.item_type === 'tv')    return '📺';
            if (d.item_type === 'book')  return '📚';
            return '✨';
        })();

        host.innerHTML = `
        <div class="gift-open-bg">
            <div class="gift-open-particles"></div>
        </div>
        <div class="gift-open-card" data-theme="${theme}">
            <a class="gift-open-brand" href="/" aria-label="Picksy">
                <span class="gift-open-brand-mark" aria-hidden="true">🎬</span>
                <span class="gift-open-brand-name">Picksy<span class="gift-open-brand-ai">AI</span></span>
                <span class="gift-open-brand-tagline">${t('кіно-подарунок', 'movie gift')}</span>
            </a>
            <div class="gift-open-theme-badge" aria-label="${t('Тема подарунку', 'Gift theme')}">${themeMeta.name}</div>
            ${greetTo}
            ${fromLine}
            ${schedHtml}

            <div class="gift-open-unwrap ${d.opened ? 'opened' : ''}" id="gift-open-unwrap">
                <div class="gift-open-box">
                    <div class="gift-open-box-base"></div>
                    <div class="gift-open-box-ribbon-h"></div>
                    <div class="gift-open-box-lid">
                        <div class="gift-open-box-ribbon-v"></div>
                    </div>
                    <div class="gift-open-box-bow">🎀</div>
                </div>
                <div class="gift-open-unwrap-mascot" id="gift-open-unwrap-mascot" aria-hidden="true">
                    <div class="gift-open-unwrap-mascot-avatar" id="gift-open-unwrap-mascot-avatar">🎬</div>
                    <div class="gift-open-unwrap-mascot-bubble" id="gift-open-unwrap-mascot-bubble"></div>
                </div>
                ${!d.opened && !isScheduled ? `<button class="gift-open-btn" id="gift-open-btn"><span class="gift-open-btn-icon">🎁</span><span>${t('Відкрити подарунок', 'Open gift')}</span></button>` : ''}
                ${!d.opened && isScheduled ? `<button class="gift-open-btn is-disabled" disabled><span class="gift-open-btn-icon">🔒</span><span>${t('Ще рано', 'Too early')}</span></button>` : ''}
            </div>

            <div class="gift-open-content ${d.opened ? '' : 'hidden'}" id="gift-open-content">
                ${poster ? `<div class="gift-open-poster-wrap"><img class="gift-open-poster" src="${poster}" alt="${title.replace(/"/g, '&quot;')}" /></div>` : ''}
                <div class="gift-open-meta">
                    <span class="gift-open-meta-type">${itemTypeIcon} ${itemTypeLabel}</span>
                    <span class="gift-open-meta-by">${t('обрано через', 'curated via')} <strong>Picksy</strong> AI</span>
                </div>
                <h2 class="gift-open-title">${title}${year ? ` <span class="gift-open-year">(${year})</span>` : ''}</h2>
                ${overview ? `<p class="gift-open-overview">${overview}</p>` : ''}
                ${note ? `<div class="gift-open-note"><span class="gift-open-note-icon">💌</span><span class="gift-open-note-text">${note}</span></div>` : ''}
                ${d.voice_url ? `<div class="gift-open-voice"><div class="gift-open-voice-label">🎤 ${t('Голосова записка від', 'Voice note from')} ${senderName}</div><audio controls src="${d.voice_url}" style="width:100%;border-radius:10px"></audio></div>` : ''}

                <div class="gift-open-actions">
                    <a class="gift-open-action-btn gift-open-action-primary" href="${this._buildItemLink(d)}">
                        <span class="gift-open-action-icon">${itemTypeIcon}</span>
                        <span class="gift-open-action-label">${itemTypeCapital}</span>
                        <span class="gift-open-action-sub">${t('детально на Picksy', 'details on Picksy')}</span>
                    </a>
                    <a class="gift-open-action-btn gift-open-action-secondary" href="/">
                        <span class="gift-open-action-icon">✨</span>
                        <span class="gift-open-action-label">${t('Підібрати ще на Picksy', 'Pick more on Picksy')}</span>
                        <span class="gift-open-action-sub">${t('AI підбір фільмів за 5 секунд', 'AI movie picks in 5 seconds')}</span>
                    </a>
                </div>

                ${d.gift_mode === 'group' && d.group_wishes && d.group_wishes.length ? `
                <div class="gift-open-group-wishes">
                    <div class="gift-open-group-title">${t('Побажання від друзів', 'Wishes from friends')}</div>
                    ${d.group_wishes.map(w => `<div class="gift-open-wish"><span class="gift-wish-author">${w.name || t('Друг', 'Friend')}:</span> ${w.text}</div>`).join('')}
                </div>` : ''}

                <div class="gift-open-promo">
                    <div class="gift-open-promo-mascot" id="gift-open-promo-mascot" aria-hidden="true">🎬</div>
                    <div class="gift-open-promo-body">
                        <div class="gift-open-promo-title">${t('Сподобався цей подарунок?', 'Liked this gift?')}</div>
                        <div class="gift-open-promo-text">${t('Picksy — безкоштовний AI-куратор фільмів, серіалів і книг. Знайди свій ідеальний кіновечір за 5 секунд або подаруй кіно другу.', 'Picksy is a free AI curator for movies, TV and books. Find your perfect movie night in 5 seconds — or wrap one as a gift for a friend.')}</div>
                        <div class="gift-open-promo-cta">
                            <a class="gift-open-promo-btn gift-open-promo-btn-primary" href="/">${t('Спробувати Picksy', 'Try Picksy')} →</a>
                            <a class="gift-open-promo-btn gift-open-promo-btn-ghost" href="/?action=create-gift">${t('Подарувати другу', 'Send a gift')} 🎁</a>
                        </div>
                    </div>
                </div>

                <div class="gift-open-footer">
                    <span class="gift-open-footer-mark">🎬</span>
                    <span>${t('Створено з ❤️ через', 'Made with ❤️ via')} <a href="/" class="gift-open-footer-link">picksy.my</a></span>
                </div>
            </div>
        </div>`;

        document.body.appendChild(host);
        this._container = host;

        // Bind open button
        const openBtn = host.querySelector('#gift-open-btn');
        if (openBtn) {
            openBtn.addEventListener('click', () => this._openGift(token));
        }

        // Bind reactions
        host.querySelectorAll('.gift-react-btn').forEach(btn => {
            btn.addEventListener('click', () => this._sendReaction(token, btn.dataset.emoji, btn));
        });

        // Animate particles
        this._animateParticles(host.querySelector('.gift-open-particles'), theme);
    },

    _buildItemLink(d) {
        if (d.item_type === 'movie') return '/descmovie/' + d.item_id;
        if (d.item_type === 'tv') return '/desctv/' + d.item_id;
        if (d.item_type === 'book') return '/descbook/' + d.item_id;
        return '/';
    },

    async _openGift(token) {
        // Open flow is optimised for mobile — we want zero perceived wait:
        //   1. Kick off the unwrap animation **immediately** (before the
        //      network response) so the user gets instant feedback.
        //   2. Stop the bobbing/wobble loops so the box doesn't look like
        //      it's "spinning" while the network resolves.
        //   3. Reveal the content as soon as the lid finishes rotating —
        //      no extra padding-delay on top of the CSS transition.
        //   4. If the request fails after we already started the animation,
        //      gracefully roll back.
        const t = this._t.bind(this);
        const btn = this._container.querySelector('#gift-open-btn');
        const unwrap = this._container.querySelector('#gift-open-unwrap');
        const content = this._container.querySelector('#gift-open-content');
        const box = this._container.querySelector('.gift-open-box');
        const bow = this._container.querySelector('.gift-open-box-bow');

        if (btn) btn.disabled = true;
        // Kill the idle animations right away so the box doesn't keep
        // bobbing while the user is waiting for the open animation.
        if (box) box.style.animation = 'none';
        if (bow) bow.style.animation = 'none';

        const isMobile = window.matchMedia && window.matchMedia('(max-width:640px)').matches;
        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // CSS lid-rotation transitions: 0.32s mobile / 0.6s desktop / 0.18s reduced.
        const revealDelay = reduced ? 60 : (isMobile ? 200 : 500);

        // Pop in the Picksy mascot with a theme-specific encouragement so the
        // moment between "tap" and "content reveal" feels alive instead of
        // empty. Bubble auto-hides shortly after the reveal animation.
        const mascotWrap = this._container.querySelector('#gift-open-unwrap-mascot');
        const mascotBubble = this._container.querySelector('#gift-open-unwrap-mascot-bubble');
        const mascotAvatar = this._container.querySelector('#gift-open-unwrap-mascot-avatar');
        if (mascotBubble && this._data) {
            mascotBubble.textContent = this._themePhrase(this._data.theme || 'classic', token);
        }
        try {
            if (mascotAvatar && window.Picksy && typeof window.Picksy.svg === 'function'
                && !mascotAvatar.querySelector('.picksy-mascot')) {
                const wrap = document.createElement('div');
                wrap.className = 'picksy-mascot';
                wrap.setAttribute('data-mood', 'excited');
                wrap.setAttribute('aria-hidden', 'true');
                const figure = document.createElement('div');
                figure.className = 'picksy-figure';
                figure.innerHTML = window.Picksy.svg({ label: 'Picksy' });
                wrap.appendChild(figure);
                mascotAvatar.textContent = '';
                mascotAvatar.appendChild(wrap);
            }
        } catch (_) {}
        if (mascotWrap) mascotWrap.classList.add('is-active');

        // Start the animation optimistically — pre-network — so users see
        // motion the instant they tap.
        if (unwrap) unwrap.classList.add('opened');

        // Network call runs in parallel with the animation.
        let res = null;
        const netPromise = (async () => {
            try {
                const resp = await fetch('/api/gifts/' + token + '/open', { method: 'POST' });
                return await resp.json();
            } catch (e) { return { _error: true }; }
        })();

        // Reveal content as soon as the lid is open — don't wait for the
        // server. If the call later returns an error we'll re-render.
        const reveal = () => {
            if (btn) btn.style.display = 'none';
            if (content) {
                content.classList.remove('hidden');
                content.style.animation = reduced
                    ? 'none'
                    : (isMobile ? 'giftContentReveal .25s ease both' : 'giftContentReveal .45s ease both');
            }
            // Once the content fades in, let the mascot bubble linger for a
            // moment before fading out — it's already done its job.
            const fadeMascot = reduced ? 600 : 2200;
            setTimeout(() => {
                if (mascotWrap) mascotWrap.classList.add('is-fading');
            }, fadeMascot);
        };
        const revealTimer = setTimeout(reveal, revealDelay);

        res = await netPromise;

        // Handle error/locked/expired *after* the animation has started so
        // the user always sees instant feedback first.
        const rollback = () => {
            clearTimeout(revealTimer);
            if (unwrap) unwrap.classList.remove('opened');
            if (box) box.style.animation = '';
            if (bow) bow.style.animation = '';
            if (content) content.classList.add('hidden');
            if (mascotWrap) mascotWrap.classList.remove('is-active', 'is-fading');
        };

        if (res && res._error) {
            rollback();
            if (btn) { btn.disabled = false; btn.innerHTML = '🎁 ' + t('Відкрити подарунок', 'Open gift'); }
            _giftToast(t('Помилка з\'єднання', 'Connection error'));
            return;
        }
        if (res && res.locked) {
            rollback();
            if (btn) { btn.disabled = false; btn.innerHTML = '🔒 ' + t('Ще рано', 'Too early'); }
            const schedDate = res.scheduled_at ? new Date(res.scheduled_at).toLocaleString() : '';
            _giftToast(t('Подарунок можна відкрити: ', 'Gift opens at: ') + schedDate);
            return;
        }
        if (res && res.expired) {
            rollback();
            if (btn) { btn.disabled = true; btn.innerHTML = '⛔'; }
            if (res.reason === 'single_use_exhausted') {
                _giftToast(t('Цей подарунок вже було відкрито (одноразовий)', 'This gift was already opened (single-use)'));
            } else {
                _giftToast(t('Ліміт відкриттів вичерпано', 'Open limit reached'));
            }
            return;
        }
        if (res && res.ok === false) {
            rollback();
            if (btn) { btn.disabled = false; btn.innerHTML = '🎁 ' + t('Відкрити подарунок', 'Open gift'); }
            return;
        }

        // Successful open. If hide_until_open, the API response should
        // include the unlocked item — use it directly instead of doing
        // another round-trip.
        if (this._data && this._data.hide_until_open && !this._data.opened && res) {
            const d = {
                ...this._data,
                item_title: res.item_title || this._data.item_title || '',
                item_poster: res.item_poster || this._data.item_poster || '',
                item_year: res.item_year || this._data.item_year || '',
                item_overview: res.item_overview || this._data.item_overview || '',
                opened: true,
            };
            this._data = d;
            const posterEl = content && content.querySelector('.gift-open-poster');
            const titleEl = content && content.querySelector('.gift-open-title');
            const overviewEl = content && content.querySelector('.gift-open-overview');
            if (posterEl && d.item_poster) { posterEl.src = d.item_poster; posterEl.style.display = ''; }
            if (titleEl) titleEl.innerHTML = (d.item_title || '') + (d.item_year ? ` <span class="gift-open-year">(${d.item_year})</span>` : '');
            if (overviewEl && d.item_overview) { overviewEl.textContent = d.item_overview; overviewEl.style.display = ''; }
            // Fall back to a refetch only if the open response didn't carry
            // the unlocked metadata.
            if (!res.item_title && !res.item_poster) {
                fetch('/api/gifts/' + token).then(r => r.json()).then(dd => {
                    if (!dd) return;
                    this._data = dd;
                    if (posterEl && dd.item_poster) { posterEl.src = dd.item_poster; posterEl.style.display = ''; }
                    if (titleEl) titleEl.innerHTML = (dd.item_title || '') + (dd.item_year ? ` <span class="gift-open-year">(${dd.item_year})</span>` : '');
                    if (overviewEl && dd.item_overview) { overviewEl.textContent = dd.item_overview; overviewEl.style.display = ''; }
                }).catch(() => {});
            }
        }
    },

    async _sendReaction(token, emoji, btn) {
        btn.classList.add('reacted');
        const reactSection = this._container.querySelector('#gift-open-reaction');
        if (reactSection) {
            reactSection.querySelectorAll('.gift-react-btn').forEach(b => b.classList.remove('reacted'));
            btn.classList.add('reacted');
        }
        try {
            await fetch('/api/gifts/' + token + '/react', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emoji }),
            });
            _giftToast(this._t('Реакцію надіслано!', 'Reaction sent!'));
        } catch(e) {}
    },

    _animateParticles(container, theme) {
        if (!container) return;
        // Respect reduced-motion + skip the (expensive) particle layer on
        // narrow viewports — mobile painted ~25 blurred dots was a big part
        // of the "spins forever" complaint.
        try {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        } catch (e) {}
        const isMobile = window.matchMedia && window.matchMedia('(max-width:640px)').matches;
        const colors = {
            classic: ['#8b5cf6', '#ec4899', '#fbbf24'],
            halloween: ['#f97316', '#000', '#7c2d12'],
            christmas: ['#16a34a', '#dc2626', '#fde047'],
            birthday: ['#ec4899', '#06b6d4', '#fbbf24'],
            valentines: ['#e11d48', '#fb7185', '#fda4af'],
            newyear: ['#3b82f6', '#a78bfa', '#fde047'],
            summer: ['#f59e0b', '#06b6d4', '#10b981'],
            movienight: ['#8b5cf6', '#1e1b4b', '#fbbf24'],
            graduation: ['#1e3a5f', '#fbbf24', '#ffffff'],
            thankyou: ['#10b981', '#a78bfa', '#fbbf24'],
            anniversary: ['#e11d48', '#fbbf24', '#a78bfa'],
            horror: ['#7c2d12', '#dc2626', '#000'],
        };
        const cols = colors[theme] || colors.classic;
        // Mobile gets a tiny particle layer — too many DOM nodes here was
        // a real perf hit on low-end Android and contributed to the
        // "opens forever" feeling.
        const count = isMobile ? 6 : 25;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'gift-open-particle';
            p.style.cssText = `
                left:${Math.random()*100}%;
                top:${Math.random()*100}%;
                width:${4+Math.random()*8}px;
                height:${4+Math.random()*8}px;
                background:${cols[Math.floor(Math.random()*cols.length)]};
                animation-delay:${Math.random()*5}s;
                animation-duration:${3+Math.random()*4}s;
            `;
            container.appendChild(p);
        }
    },

    _renderNotFound() {
        let host = document.getElementById('gift-open-page');
        if (host) host.remove();
        host = document.createElement('div');
        host.id = 'gift-open-page';
        host.className = 'gift-open-page';
        const t = this._t.bind(this);
        host.innerHTML = `
        <div class="gift-open-card gift-open-notfound">
            <div class="gift-open-404-icon">🎁</div>
            <h2>${t('Подарунок не знайдено', 'Gift not found')}</h2>
            <p>${t('Можливо, посилання вже недійсне або подарунок був одноразовим і вже відкритий.', 'This link may have expired or the gift was single-use and already opened.')}</p>
            <a href="/" class="gift-open-action-btn">${t('🏠 На головну', '🏠 Go Home')}</a>
        </div>`;
        document.body.appendChild(host);
    },
};

window.GiftOpen = GiftOpen;

/* ─── Auto-init gift opening page ─────────────────────────── */
(function () {
    if (typeof document !== 'undefined') {
        const run = () => {
            if (window.location.pathname.startsWith('/gift/')) {
                GiftOpen.init();
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
    }
})();

/* ─── Poll for gift-opened notifications ──────────────────── */
(function () {
    const KEY = 'picksy_gift_seen_id';
    let timer = null;
    async function poll() {
        const t = localStorage.getItem('pfm_token');
        if (!t) return;
        try {
            const res = await fetch('/api/gifts/notifications/recent', {
                headers: { 'Authorization': 'Bearer ' + t },
            });
            if (!res.ok) return;
            const data = await res.json();
            const items = (data && data.items) || [];
            if (!items.length) return;
            const lastSeen = parseInt(localStorage.getItem(KEY) || '0', 10);
            const newOnes = items.filter(it => Number(it.id) > lastSeen);
            if (!newOnes.length) return;
            const maxId = Math.max(...items.map(it => Number(it.id) || 0));
            localStorage.setItem(KEY, String(maxId));
            if (lastSeen === 0) return;
            newOnes.slice(0, 3).forEach(it => {
                const reaction = it.reaction ? ` ${it.reaction}` : '';
                const msgUk = '🎁 Твій подарунок «' + (it.title || '') + '» відкрили!' + reaction;
                const msgEn = '🎁 Your gift "' + (it.title || '') + '" was opened!' + reaction;
                const msg = (typeof I18N !== 'undefined' && I18N.current === 'en') ? msgEn : msgUk;
                _giftToast(msg);
            });
        } catch (e) { /* silent */ }
    }
    function start() {
        if (timer) return;
        poll();
        timer = setInterval(poll, 60_000);
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(start, 4000));
        } else {
            setTimeout(start, 4000);
        }
    }
})();
