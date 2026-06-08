// @ts-nocheck
const Auth = {
    user: null,
    token: null,
    init() {
        this.token = localStorage.getItem('pfm_token');
        if (this.token) {
            this.loadProfile();
        }
        this.bindEvents();
    },
    bindEvents() {
        const userBtn = document.getElementById('user-btn');
        const authModal = document.getElementById('auth-modal');
        const authOverlay = document.getElementById('auth-overlay');
        const authClose = document.getElementById('auth-close');
        const authForm = document.getElementById('auth-form');
        const switchBtn = document.getElementById('auth-switch-btn');
        userBtn.addEventListener('click', () => {
            if (this.user) {
                this.showUserMenu();
            }
            else {
                this.showModal('register');
            }
        });
        authOverlay.addEventListener('click', () => this.hideModal());
        authClose.addEventListener('click', () => this.hideModal());
        authForm.addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });
        switchBtn.addEventListener('click', () => {
            this.mode = this.mode === 'login' ? 'register' : 'login';
            this.updateModalMode();
        });
        const googleBtn = document.getElementById('auth-google-btn');
        if (googleBtn)
            googleBtn.addEventListener('click', () => this.googleSignIn());
        const profileModal = document.getElementById('profile-modal');
        const profileOverlay = document.getElementById('profile-overlay');
        const profileClose = document.getElementById('profile-close');
        const profileLogout = document.getElementById('profile-logout-btn');
        if (profileOverlay)
            profileOverlay.addEventListener('click', () => profileModal.classList.add('hidden'));
        if (profileClose)
            profileClose.addEventListener('click', () => profileModal.classList.add('hidden'));
        if (profileLogout)
            profileLogout.addEventListener('click', () => this.logout());
    },
    mode: 'login',
    showModal(mode) {
        this.mode = mode || 'login';
        this.updateModalMode();
        document.getElementById('auth-modal').classList.remove('hidden');
        document.body.classList.add('modal-open');
        document.getElementById('auth-error').classList.add('hidden');
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
        this._setMascot('idle');
        // Render official Google button now that modal is visible
        setTimeout(() => this._renderGoogleButton(), 50);
    },
    hideModal() {
        document.getElementById('auth-modal').classList.add('hidden');
        document.body.classList.remove('modal-open');
        this._setMascot('idle');
    },
    updateModalMode() {
        const isLogin = this.mode === 'login';
        document.getElementById('auth-title').textContent = I18N.t(isLogin ? 'loginTitle' : 'registerTitle');
        document.getElementById('auth-submit').textContent = I18N.t(isLogin ? 'loginBtn' : 'registerBtn');
        document.getElementById('auth-switch-text').textContent = I18N.t(isLogin ? 'noAccount' : 'hasAccount');
        document.getElementById('auth-switch-btn').textContent = I18N.t(isLogin ? 'register' : 'login');
        const privacyRow = document.getElementById('auth-privacy-row');
        const privacyCheck = document.getElementById('auth-privacy-check');
        if (privacyRow)
            privacyRow.classList.toggle('hidden', isLogin);
        if (privacyCheck && isLogin)
            privacyCheck.checked = false;
        this._setMascot('idle');
    },
    // ─── Picksy mascot helper (auth modal) ───
    // States: 'idle' | 'typing' | 'success' | 'error'. The mascot face is the
    // same Picksy SVG character used on the home page — rendered via
    // mascot.js (window.Picksy.render) and its mood swapped via Picksy.setMood
    // so the auth helper visually matches the rest of the site.
    _mascotMood(state) {
        switch (state) {
            case 'typing': return 'thinking';
            case 'success': return 'excited';
            case 'error': return 'sad';
            case 'idle':
            default: return 'happy';
        }
    },
    _ensureMascot() {
        const faceEl = document.getElementById('auth-mascot-face');
        const P = window.Picksy;
        if (!faceEl || !P || !P.render)
            return null;
        let mascotEl = faceEl.querySelector('.picksy-mascot');
        if (!mascotEl) {
            faceEl.innerHTML = '';
            mascotEl = P.render(faceEl, {
                size: 'sm',
                mood: 'happy',
                label: 'Picksy mascot',
            });
        }
        return mascotEl;
    },
    _setMascot(state, payload) {
        const box = document.getElementById('auth-mascot');
        const faceEl = document.getElementById('auth-mascot-face');
        const textEl = document.getElementById('auth-mascot-text');
        if (!box || !faceEl || !textEl)
            return;
        box.classList.remove('is-idle', 'is-typing', 'is-success', 'is-error');
        const isLogin = this.mode === 'login';
        let text = '';
        switch (state) {
            case 'typing':
                box.classList.add('is-typing');
                text = I18N.t(isLogin ? 'authMascotTypingLogin' : 'authMascotTypingRegister');
                break;
            case 'success':
                box.classList.add('is-success');
                text = I18N.t(isLogin ? 'authMascotSuccessLogin' : 'authMascotSuccessRegister');
                break;
            case 'error': {
                box.classList.add('is-error');
                const hintKey = (payload && payload.hintKey) || 'authMascotHintGeneric';
                const prefix = I18N.t('authMascotErrorPrefix') || '';
                const reason = (payload && payload.reason) || '';
                const hint = I18N.t(hintKey) || '';
                text = [prefix, reason].filter(Boolean).join(' ');
                if (hint)
                    text = text ? `${text}\n${hint}` : hint;
                break;
            }
            case 'idle':
            default:
                box.classList.add('is-idle');
                text = I18N.t(isLogin ? 'authMascotIdleLogin' : 'authMascotIdleRegister');
                break;
        }
        const mascotEl = this._ensureMascot();
        const mood = this._mascotMood(state);
        const P = window.Picksy;
        if (mascotEl && P && P.setMood) {
            P.setMood(mascotEl, mood);
        }
        else if (faceEl && !faceEl.querySelector('.picksy-mascot')) {
            // mascot.js not yet loaded — fall back to a single character glyph
            // so the box never renders empty during the brief boot window.
            faceEl.textContent = state === 'success' ? '✨' : state === 'error' ? '…' : '🎬';
        }
        textEl.textContent = text;
    },
    _mapAuthError(detail, httpStatus) {
        const d = (detail || '').toString().toLowerCase();
        if (httpStatus === 429 || d.includes('too many requests'))
            return { hintKey: 'authMascotHintRateLimit', reasonI18n: 'errorTooManyRequests' };
        if (d.includes('account suspended'))
            return { hintKey: 'authMascotHintBanned', reasonI18n: 'errorAccountSuspended' };
        if (d.includes('registrations are currently disabled') || d.includes('registrations are temporarily'))
            return { hintKey: 'authMascotHintRegDisabled', reasonI18n: 'errorRegistrationsDisabled' };
        if (d.includes('email and password required'))
            return { hintKey: 'authMascotHintEmptyFields', reasonI18n: 'errorEmailAndPasswordRequired' };
        if (d.includes('invalid email format'))
            return { hintKey: 'authMascotHintInvalidEmail', reasonI18n: 'errorInvalidEmailFormat' };
        if (d.includes('password must be at least'))
            return { hintKey: 'authMascotHintPasswordShort', reasonI18n: 'errorPasswordTooShort' };
        if (d.includes('email already registered') || d.includes('already registered'))
            return { hintKey: 'authMascotHintEmailExists', reasonI18n: 'errorEmailAlreadyRegistered' };
        if (d.includes('invalid email or password'))
            return { hintKey: 'authMascotHintWrongCreds', reasonI18n: 'errorInvalidEmailOrPassword' };
        if (d.includes('privacy') && d.includes('accept'))
            return { hintKey: 'authMascotHintPrivacy', reasonI18n: 'privacyRequired' };
        if (d.includes('database unavailable'))
            return { hintKey: 'authMascotHintNetwork', reasonI18n: 'errorDatabaseUnavailable' };
        if (d.includes('google auth') || d.includes('google token') || d.includes('verify google'))
            return { hintKey: 'authMascotHintGoogleFail', reasonI18n: 'errorGoogleVerifyFailed' };
        if (d.includes('token audience mismatch'))
            return { hintKey: 'authMascotHintGoogleFail', reasonI18n: 'errorTokenAudienceMismatch' };
        return { hintKey: 'authMascotHintGeneric', reasonI18n: this.mode === 'login' ? 'loginError' : 'registerError' };
    },
    async submit() {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorEl = document.getElementById('auth-error');
        errorEl.classList.add('hidden');
        const isRegister = this.mode === 'register';
        if (!email || !password) {
            this._setMascot('error', { hintKey: 'authMascotHintEmptyFields', reason: I18N.t('errorEmailAndPasswordRequired') || '' });
            return;
        }
        if (password.length < 6) {
            this._setMascot('error', { hintKey: 'authMascotHintPasswordShort', reason: I18N.t('errorPasswordTooShort') || '' });
            return;
        }
        const privacyCheck = document.getElementById('auth-privacy-check');
        const acceptedPrivacy = !!(privacyCheck && privacyCheck.checked);
        if (isRegister && !acceptedPrivacy) {
            this._setMascot('error', { hintKey: 'authMascotHintPrivacy', reason: I18N.t('privacyRequired') || '' });
            return;
        }
        this._setMascot('typing');
        const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
        const body = { email, password };
        if (isRegister)
            body.accepted_privacy = true;
        try {
            const res = await fetch(`${CONFIG.API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const mapped = this._mapAuthError(data && data.detail, res.status);
                this._setMascot('error', {
                    hintKey: mapped.hintKey,
                    reason: I18N.t(mapped.reasonI18n) || (data && data.detail) || '',
                });
                return;
            }
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('pfm_token', this.token);
            this.updateUI();
            this._setMascot('success');
            UI.showToast(I18N.t(this.mode === 'login' ? 'loginSuccess' : 'registerSuccess'));
            if (typeof App !== 'undefined')
                App.syncFavorites();
            if (typeof Collections !== 'undefined')
                Collections.onAuthChange();
            if (typeof Subscription !== 'undefined')
                Subscription.init();
            if (typeof Analytics !== 'undefined') {
                if (this.mode === 'register')
                    Analytics.onRegister();
            }
            setTimeout(() => this.hideModal(), 1200);
        }
        catch (err) {
            this._setMascot('error', { hintKey: 'authMascotHintNetwork', reason: I18N.t('errorNetwork') || '' });
        }
    },
    async loadProfile() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${this.token}` },
            });
            if (res.ok) {
                this.user = await res.json();
                this.isAdmin = !!this.user.is_admin;
                this.updateUI();
                this.updateAdminUI();
                this.renderStaffLink();
                if (typeof App !== 'undefined')
                    await App.syncFavorites();
                if (typeof Subscription !== 'undefined')
                    Subscription.init();
                if (typeof Collections !== 'undefined')
                    Collections.onAuthChange();
            }
            else {
                this.logout();
            }
        }
        catch {
            // Backend not available, keep token for later
        }
    },
    isStaff() {
        const user = this.user;
        if (!user)
            return false;
        if (user.is_admin)
            return true;
        const role = user.role || 'user';
        return ['content-manager', 'editor', 'support', 'moderator', 'admin', 'superadmin'].includes(role);
    },
    updateAdminUI() {
        const fabAdmin = document.getElementById('fab-admin');
        if (fabAdmin)
            fabAdmin.classList.toggle('hidden', !this.isStaff());
        const staffFab = document.getElementById('staff-fab');
        if (staffFab)
            staffFab.classList.toggle('hidden', !this.isStaff());
    },
    updateUI() {
        const nameEl = document.getElementById('user-name');
        if (this.user) {
            const name = this.user.email.split('@')[0];
            nameEl.textContent = name;
            nameEl.removeAttribute('data-i18n');
        }
        else {
            nameEl.textContent = I18N.t('guest');
            nameEl.setAttribute('data-i18n', 'guest');
        }
        // Refresh the guest pick badge — when the user logs in or registers
        // it should disappear immediately (no full page reload required).
        // When they log out, it should reappear.
        if (typeof App !== 'undefined') {
            if (this.user) {
                const badge = document.getElementById('guest-picks-badge');
                if (badge)
                    badge.remove();
            }
            else if (typeof App.initGuestPicksBadge === 'function') {
                if (!document.getElementById('guest-picks-badge'))
                    App.initGuestPicksBadge();
                else if (typeof App._updateGuestBadge === 'function')
                    App._updateGuestBadge();
            }
        }
    },
    async showUserMenu() {
        const modal = document.getElementById('profile-modal');
        if (!modal)
            return;
        modal.classList.remove('hidden');
        this._wireProfileTabs();
        this._wireHistoryControls();
        // Re-fetch user data to reflect any role changes
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/auth/me`, {
                headers: this.getAuthHeaders(),
            });
            if (res.ok) {
                this.user = await res.json();
                this.isAdmin = !!this.user.is_admin;
            }
        }
        catch { }
        if (typeof Subscription !== 'undefined' && Subscription.refresh) {
            try {
                await Subscription.refresh();
            }
            catch { }
        }
        await Promise.all([this.loadMiniProfile(), this.loadLevel()]);
        // Refresh achievements + showcase grid every time the profile modal opens.
        try {
            if (typeof App !== 'undefined' && typeof App.loadAchievements === 'function') {
                App.loadAchievements();
            }
        }
        catch { }
        this._switchProfileTab('stats');
    },
    _wireProfileTabs() {
        if (this._profileTabsWired)
            return;
        this._profileTabsWired = true;
        document.querySelectorAll('.profile-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this._switchProfileTab(btn.dataset.pmtab));
        });
    },
    _switchProfileTab(tab) {
        document.querySelectorAll('.profile-tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.pmtab === tab);
        });
        const stats = document.getElementById('profile-panel-stats');
        const hist = document.getElementById('profile-panel-history');
        const receipts = document.getElementById('profile-panel-receipts');
        if (stats)
            stats.classList.toggle('hidden', tab !== 'stats');
        if (hist)
            hist.classList.toggle('hidden', tab !== 'history');
        if (receipts)
            receipts.classList.toggle('hidden', tab !== 'receipts');
        if (tab === 'history' && !this._historyLoadedOnce) {
            this._historyLoadedOnce = true;
            this._historyType = '';
            this._historyOffset = 0;
            this._loadHistoryPage(true);
        }
        if (tab === 'receipts') {
            this._loadReceipts();
        }
    },
    _loadReceipts() {
        const list = document.getElementById('profile-receipts-list');
        const empty = document.getElementById('profile-receipts-empty');
        if (!list)
            return;
        const receipts = JSON.parse(localStorage.getItem('picksy_receipts') || '[]');
        list.innerHTML = '';
        if (receipts.length === 0) {
            if (empty)
                empty.classList.remove('hidden');
            return;
        }
        if (empty)
            empty.classList.add('hidden');
        const planNames = { free: 'Free', premium: 'Premium', pro: 'Pro' };
        receipts.slice().reverse().forEach(r => {
            const el = document.createElement('div');
            el.className = 'profile-receipt-item';
            const statusClass = r.confirmed ? 'receipt-item-confirmed' : 'receipt-item-pending';
            const statusText = r.confirmed ? '✓ Підтверджено' : '⏳ Очікує';
            el.innerHTML = `
                <div class="receipt-item-header">
                    <span class="receipt-item-plan">${planNames[r.plan] || r.plan}</span>
                    <span class="receipt-item-price">$${r.price}</span>
                </div>
                <div class="receipt-item-meta">
                    <span>${r.days} днів</span>
                    <span>${new Date(r.date).toLocaleDateString('uk-UA')}</span>
                    <span class="${statusClass}">${statusText}</span>
                </div>
            `;
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                if (typeof Enhancements !== 'undefined') {
                    Enhancements.showReceiptModal(r);
                }
            });
            list.appendChild(el);
        });
    },
    _wireHistoryControls() {
        if (this._historyWired)
            return;
        this._historyWired = true;
        document.querySelectorAll('.profile-hf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.profile-hf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._historyType = btn.dataset.htype || '';
                this._historyOffset = 0;
                this._loadHistoryPage(true);
            });
        });
        const more = document.getElementById('profile-history-more');
        if (more)
            more.addEventListener('click', () => this._loadHistoryPage(false));
        const clear = document.getElementById('profile-history-clear');
        if (clear)
            clear.addEventListener('click', async () => {
                if (!confirm(I18N.t('historyConfirmClear')))
                    return;
                await API.clearHistory();
                this._historyOffset = 0;
                await this._loadHistoryPage(true);
                this.loadLevel();
            });
    },
    async _loadHistoryPage(replace) {
        const list = document.getElementById('profile-history-list');
        const empty = document.getElementById('profile-history-empty');
        const more = document.getElementById('profile-history-more');
        if (!list)
            return;
        if (replace)
            list.innerHTML = '';
        const limit = 20;
        const data = await API.getHistory({
            type: this._historyType || '',
            limit,
            offset: this._historyOffset || 0,
        });
        const items = data.items || [];
        if (replace && items.length === 0) {
            empty.classList.remove('hidden');
            more.classList.add('hidden');
            return;
        }
        else {
            empty.classList.add('hidden');
        }
        items.forEach(it => {
            const el = document.createElement('div');
            el.className = 'profile-history-item is-clickable';
            // Use it.item_id (the external TMDB / Google Books id stored
            // in pick_history.item_id), NOT it.id which is the database
            // row primary key and would cause /descmovie/<wrong> or 404.
            const itemId = it.item_id || it.tmdb_id || it.id || '';
            const itemType = it.type || it.media_type || 'movie';
            if (itemId) {
                el.dataset.itemid = String(itemId);
                el.dataset.itemtype = String(itemType);
                el.style.cursor = 'pointer';
                el.title = (typeof I18N !== 'undefined' && I18N.current === 'en')
                    ? 'Click to open details' : 'Клікни щоб відкрити деталі';
            }
            const fallback = it.type === 'tv' ? CONFIG.FALLBACK_TV_POSTER
                : it.type === 'book' ? CONFIG.FALLBACK_BOOK_POSTER
                    : CONFIG.FALLBACK_POSTER;
            const poster = it.poster || fallback;
            const ico = it.type === 'tv' ? '📺' : it.type === 'book' ? '📚' : '🎬';
            const meta = [it.year, it.rating ? '⭐ ' + it.rating : null].filter(Boolean).join(' · ');
            const dt = it.picked_at ? new Date(it.picked_at) : null;
            const when = dt ? dt.toLocaleDateString(I18N.current === 'en' ? 'en-GB' : 'uk-UA', { day: '2-digit', month: 'short' }) : '';
            el.innerHTML = `
                <img class="phi-poster" src="${poster}" alt="" loading="lazy" decoding="async"
                     onerror="this.src='${fallback}'">
                <div class="phi-info">
                    <div class="phi-title">${ico} ${this._esc(it.title || '')}</div>
                    <div class="phi-meta">${this._esc(meta)}</div>
                </div>
                <div class="phi-when">${when}</div>
                ${it.url ? `<a class="phi-link" href="${it.url}" target="_blank" rel="noopener">↗</a>` : ''}
            `;
            if (itemId) {
                el.addEventListener('click', (ev) => {
                    if (ev.target.closest && ev.target.closest('.phi-link'))
                        return;
                    const lang = (typeof I18N !== 'undefined' && I18N.current) || 'uk';
                    const prefix = itemType === 'tv' ? 'desctv' : (itemType === 'book' ? 'descbook' : 'descmovie');
                    const modal = document.getElementById('profile-modal');
                    if (modal) {
                        modal.classList.add('hidden');
                        document.body.style.overflow = '';
                    }
                    window.location.href = `/${prefix}/${encodeURIComponent(itemId)}?lang=${lang}`;
                });
            }
            list.appendChild(el);
        });
        this._historyOffset = (this._historyOffset || 0) + items.length;
        const total = data.total || 0;
        if (this._historyOffset < total) {
            more.classList.remove('hidden');
        }
        else {
            more.classList.add('hidden');
        }
    },
    _esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    },
    async loadLevel() {
        const stats = await API.getMyStats();
        if (!stats || !stats.level)
            return;
        const lv = stats.level;
        const set = (id, val) => { const el = document.getElementById(id); if (el !== null && el !== undefined)
            el.textContent = val; };
        set('profile-level-num', lv.level);
        const lang = (typeof I18N !== 'undefined' && I18N.current === 'en') ? 'name_en' : 'name_uk';
        set('profile-level-name', lv[lang]);
        const total = stats.total_picks || 0;
        const next = lv.next_threshold;
        set('profile-level-progress', next ? `${total} / ${next}` : `${total}`);
        const toNext = lv.to_next || 0;
        const tn = document.getElementById('profile-level-tonext');
        if (tn)
            tn.textContent = next ? '· ' + I18N.t('toNext').replace('{n}', toNext) : '· ' + I18N.t('maxLevel');
        const fill = document.getElementById('profile-progress-fill');
        if (fill)
            fill.style.width = (Math.max(0, Math.min(1, lv.progress)) * 100).toFixed(1) + '%';
        // Streak
        if (stats.streak) {
            const streak = stats.streak.current_streak || 0;
            set('profile-streak-count', streak);
            if (typeof App !== 'undefined' && App.getStreakClass) {
                const container = document.getElementById('profile-streak');
                if (container) {
                    container.classList.remove('streak-warm', 'streak-hot', 'streak-fire-100', 'streak-epic', 'streak-legendary');
                    const cls = App.getStreakClass(streak);
                    if (cls)
                        container.classList.add(cls);
                }
                const fireEl = document.querySelector('.streak-fire');
                if (fireEl) {
                    const color = App.getStreakColor(streak);
                    if (color)
                        fireEl.style.filter = `drop-shadow(0 0 6px ${color})`;
                    else
                        fireEl.style.filter = '';
                }
            }
        }
    },
    async loadMiniProfile() {
        if (!this.token)
            return;
        // Show email immediately from cached user (no flicker)
        const set = (id, val) => { const el = document.getElementById(id); if (el)
            el.textContent = val; };
        if (this.user && this.user.email)
            set('profile-email', this.user.email);
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/profile`, {
                headers: this.getAuthHeaders(),
            });
            if (!res.ok) {
                // Backend unavailable — show what we know from the token
                if (this.user && this.user.email)
                    set('profile-email', this.user.email);
                return;
            }
            const data = await res.json();
            set('profile-email', data.user?.email || this.user?.email || '');
            const displayInput = document.getElementById('profile-display-name-input');
            const bioInput = document.getElementById('profile-bio-input');
            const avatarInput = document.getElementById('profile-avatar-input');
            if (displayInput)
                displayInput.value = data.profile?.display_name || data.user?.display_name || '';
            if (bioInput)
                bioInput.value = data.profile?.bio || data.user?.bio || '';
            if (avatarInput)
                avatarInput.value = data.profile?.avatar_emoji || data.user?.avatar_emoji || '';
            const avatar = document.querySelector('.profile-avatar');
            if (avatar && (data.profile?.avatar_emoji || data.user?.avatar_emoji))
                avatar.textContent = data.profile?.avatar_emoji || data.user?.avatar_emoji;
            // Hydrate v53 profile fields (banner, accent, fav_film, social) from server.
            const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null)
                el.value = String(v); };
            const p = data.profile || data.user || {};
            const ff = p.fav_film || {};
            const sc = p.social || {};
            setVal('profile-banner-input', p.banner_url || '');
            setVal('profile-avatar-url-input', p.avatar_url || '');
            setVal('profile-avatar-input', p.avatar_emoji || '');
            setVal('profile-color-input', p.accent_color || '');
            setVal('profile-fav-film-id', ff.id || p.fav_film_id || '');
            setVal('profile-fav-film-title', ff.title || p.fav_film_title || '');
            setVal('profile-fav-film-poster', ff.poster || p.fav_film_poster || '');
            setVal('profile-fav-film-type', ff.type || p.fav_film_type || '');
            setVal('profile-fav-film-comment', ff.comment || p.fav_film_comment || '');
            // Re-hydrate the visible "selected favourite" strip so users
            // see their saved fav on reopen (only hidden inputs were
            // restored before, which felt like "not saved").
            try {
                const favId = ff.id || p.fav_film_id || '';
                const favTitle = ff.title || p.fav_film_title || '';
                const favPoster = ff.poster || p.fav_film_poster || '';
                const favSelected = document.getElementById('profile-fav-selected');
                const favPosterEl = document.getElementById('profile-fav-poster');
                const favTitleEl = document.getElementById('profile-fav-title-text');
                if (favSelected) {
                    if (favId && favTitle) {
                        if (favPosterEl) {
                            let src = String(favPoster || '');
                            if (src && !/^https?:\/\//.test(src)) {
                                src = src.startsWith('/')
                                    ? 'https://image.tmdb.org/t/p/w154' + src
                                    : src;
                            }
                            favPosterEl.src = src;
                            favPosterEl.alt = favTitle;
                        }
                        if (favTitleEl)
                            favTitleEl.textContent = favTitle;
                        favSelected.classList.remove('hidden');
                    }
                    else {
                        favSelected.classList.add('hidden');
                    }
                }
            }
            catch (e) { /* non-fatal */ }
            setVal('profile-social-telegram', sc.telegram || p.social_telegram || '');
            setVal('profile-social-instagram', sc.instagram || p.social_instagram || '');
            setVal('profile-social-letterboxd', sc.letterboxd || p.social_letterboxd || '');
            setVal('profile-social-website', sc.website || p.social_website || '');
            // Mirror banner/avatar previews to localStorage so the device-upload
            // helpers in extras.js stay in sync with whatever the server has.
            try {
                if (p.banner_url) {
                    localStorage.setItem('profile_banner_data', String(p.banner_url));
                }
                else {
                    localStorage.removeItem('profile_banner_data');
                }
                if (p.avatar_url) {
                    localStorage.setItem('profile_avatar_data', String(p.avatar_url));
                }
                else {
                    localStorage.removeItem('profile_avatar_data');
                }
            }
            catch { }
            // Update the avatar/banner preview <img>s and the avatar
            // displayed at the top of the profile card immediately. The
            // device-upload helper in extras.js only re-reads localStorage
            // when initDeviceUpload runs, which fires from a MutationObserver
            // BEFORE this fetch completes, so we have to push the new image
            // into the DOM ourselves.
            try {
                const bannerPreview = document.getElementById('profile-banner-preview');
                if (bannerPreview) {
                    if (p.banner_url) {
                        bannerPreview.src = String(p.banner_url);
                        bannerPreview.classList.remove('hidden');
                    }
                    else {
                        bannerPreview.src = '';
                        bannerPreview.classList.add('hidden');
                    }
                }
                const avPreview = document.getElementById('profile-avatar-preview');
                if (avPreview) {
                    if (p.avatar_url) {
                        avPreview.src = String(p.avatar_url);
                        avPreview.classList.remove('hidden');
                    }
                    else {
                        avPreview.src = '';
                        avPreview.classList.add('hidden');
                    }
                }
                // Apply the avatar to the round avatar at the top of the
                // profile modal (the device-upload helper does this via
                // _applyAvatarToProfile).
                if (typeof Extras !== 'undefined') {
                    if (typeof Extras._applyAvatarToProfile === 'function') {
                        Extras._applyAvatarToProfile(p.avatar_url || '');
                    }
                    if (typeof Extras._applyBannerToProfile === 'function') {
                        Extras._applyBannerToProfile(p.banner_url || '');
                    }
                }
            }
            catch { }
            // Hydrate visibility toggles from the API (DB is source of truth);
            // fall back to localStorage for older builds that didn't persist
            // visibility yet.
            const setChk = (id, val) => {
                const el = document.getElementById(id);
                if (el)
                    el.checked = val !== false;
            };
            const apiVis = (p && p.visibility) || null;
            if (apiVis) {
                setChk('toggle-show-dna', apiVis.dna);
                setChk('toggle-show-psycho', apiVis.psycho);
                setChk('toggle-show-zodiac', apiVis.zodiac);
                setChk('toggle-show-recs', apiVis.recs);
                setChk('toggle-show-top', apiVis.top);
                setChk('toggle-show-showcase', apiVis.showcase);
                try {
                    localStorage.setItem('picksy_profile_visibility', JSON.stringify(apiVis));
                    localStorage.setItem('show_dna', String(apiVis.dna !== false));
                    localStorage.setItem('show_psycho', String(apiVis.psycho !== false));
                    localStorage.setItem('show_zodiac', String(apiVis.zodiac !== false));
                    localStorage.setItem('show_recs', String(apiVis.recs !== false));
                    localStorage.setItem('show_top', String(apiVis.top !== false));
                    localStorage.setItem('show_showcase', String(apiVis.showcase !== false));
                }
                catch { }
            }
            else {
                try {
                    const raw = localStorage.getItem('picksy_profile_visibility');
                    if (raw) {
                        const v = JSON.parse(raw) || {};
                        setChk('toggle-show-dna', v.dna);
                        setChk('toggle-show-psycho', v.psycho);
                        setChk('toggle-show-zodiac', v.zodiac);
                        setChk('toggle-show-recs', v.recs);
                        setChk('toggle-show-top', v.top);
                        setChk('toggle-show-showcase', v.showcase);
                    }
                }
                catch { }
            }
            set('profile-search-count', data.stats?.search_count || 0);
            set('profile-random-count', data.stats?.random_count || 0);
            set('profile-ai-count', data.stats?.ai_search_count || 0);
            set('profile-saved-count', data.saved?.total || 0);
            set('profile-movies-count', data.saved?.movies || 0);
            set('profile-tv-count', data.saved?.tv || 0);
            set('profile-books-count', data.saved?.books || 0);
            // Tier badge in profile (hidden when freemium disabled)
            const tierBadge = document.getElementById('profile-tier-badge');
            const freemiumOn = (typeof API !== 'undefined' && API.siteSettings?.freemium_enabled) || false;
            if (tierBadge && typeof Subscription !== 'undefined') {
                if (!freemiumOn) {
                    tierBadge.classList.add('hidden');
                    tierBadge.textContent = '';
                    tierBadge.onclick = null;
                }
                else {
                    const tier = Subscription.getTier();
                    const labels = { free: 'Free', premium: 'Premium', pro: 'Pro' };
                    tierBadge.textContent = labels[tier] || 'Free';
                    tierBadge.className = `tier-badge tier-${tier}`;
                    tierBadge.classList.remove('hidden');
                    tierBadge.style.cursor = 'pointer';
                    tierBadge.onclick = () => Subscription.showUpgradeModal();
                }
            }
            // Receipts tab+panel: hide when freemium/subscriptions disabled
            const receiptsTabBtn = document.querySelector('.profile-tab-btn[data-pmtab="receipts"]');
            const receiptsPanel = document.getElementById('profile-panel-receipts');
            if (receiptsTabBtn)
                receiptsTabBtn.classList.toggle('hidden', !freemiumOn);
            if (receiptsPanel && !freemiumOn)
                receiptsPanel.classList.add('hidden');
            if (!freemiumOn && receiptsTabBtn?.classList.contains('active')) {
                this._switchProfileTab('stats');
            }
            // Subscription info in profile
            this.renderSubscriptionInfo();
            // Verification & admin badges in profile
            this.renderProfileBadges(data);
            // Staff link if role level >= 1
            this.renderStaffLink();
            // Profile tools
            this.bindProfileTools();
            // Load username into profile input
            const uname = data.user?.username;
            const unameInput = document.getElementById('profile-username-input');
            if (unameInput && uname) {
                unameInput.value = uname;
                if (typeof App !== 'undefined')
                    App.showPublicLink(uname);
            }
        }
        catch (err) {
            console.log('Profile unavailable:', err);
            if (this.user && this.user.email)
                set('profile-email', this.user.email);
        }
    },
    renderProfileBadges(data) {
        // Place all badges (verified, admin/role, tier) inside the same
        // .profile-badges-row container so they render on a single row.
        const row = document.querySelector('.profile-head .profile-badges-row');
        if (!row)
            return;
        // Drop any stale badges previously injected by this function so we
        // don't duplicate on re-render. Keep the tier badge (id=profile-tier-badge).
        row.querySelectorAll('.profile-verified-badge, .profile-admin-badge, .profile-role-badge').forEach(el => el.remove());
        // Clean up the legacy standalone #profile-badges container if it
        // exists from a previous render (older builds inserted it after the email).
        const legacy = document.getElementById('profile-badges');
        if (legacy && legacy !== row)
            legacy.remove();
        const tierBadge = document.getElementById('profile-tier-badge');
        const insertBadge = (badge) => {
            if (tierBadge && tierBadge.parentNode === row) {
                row.insertBefore(badge, tierBadge);
            }
            else {
                row.appendChild(badge);
            }
        };
        const user = this.user;
        if (!user)
            return;
        if (user.is_verified) {
            const badge = document.createElement('span');
            badge.className = 'profile-verified-badge';
            // Simple white check on the refreshed circular blue badge.
            badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            badge.title = 'Верифікований';
            insertBadge(badge);
        }
        if (user.is_admin || user.role === 'superadmin') {
            const badge = document.createElement('span');
            const isSuper = user.role === 'superadmin';
            badge.className = 'profile-admin-badge' + (isSuper ? ' profile-admin-badge-super' : '');
            if (isSuper) {
                badge.innerHTML = '👑 Суперадмін';
            }
            else {
                badge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Адмін';
            }
            insertBadge(badge);
        }
        else if (user.role && user.role !== 'user') {
            const roleLabels = {
                'media': '📺 Media',
                'moderator': '🛡 Модератор',
                'content-manager': '📝 Контент-менеджер',
                'editor': '✏️ Редактор',
                'support': '🎧 Підтримка',
            };
            const badge = document.createElement('span');
            badge.className = 'profile-role-badge role-badge role-' + user.role;
            badge.textContent = roleLabels[user.role] || user.role;
            insertBadge(badge);
        }
    },
    renderSubscriptionInfo() {
        const el = document.getElementById('profile-sub-info');
        const section = document.getElementById('profile-subscription-section');
        if (!el)
            return;
        const user = this.user;
        if (!user)
            return;
        // Hide entire subscription block if freemium is disabled in admin settings.
        const freemiumOn = (typeof API !== 'undefined' && API.siteSettings?.freemium_enabled) || false;
        if (!freemiumOn) {
            if (section)
                section.classList.add('hidden');
            el.innerHTML = '';
            return;
        }
        if (section)
            section.classList.remove('hidden');
        const role = user.role || 'user';
        const staffRoles = ['content-manager', 'editor', 'support', 'moderator', 'admin', 'superadmin'];
        if (staffRoles.includes(role)) {
            el.innerHTML = '✨ <b>Pro підписка</b> — активна автоматично для стаф-ролей<br><span style="color:rgba(255,255,255,.4);font-size:.78rem">Роль: ' + role + '</span>';
            return;
        }
        if (role === 'media') {
            el.innerHTML = '📺 <b>Pro підписка</b> — безкоштовна для media-партнерів<br><span style="color:rgba(255,255,255,.4);font-size:.78rem">Роль: media</span>';
            return;
        }
        if (typeof Subscription !== 'undefined') {
            const tier = Subscription.getTier();
            const expiry = Subscription.formatExpiryHTML?.() || '';
            const expiryRow = expiry ? `<div class="profile-sub-expiry" style="margin-top:6px;font-size:.82rem">${expiry}</div>` : '';
            if (tier === 'pro') {
                el.innerHTML = `💎 <b>Pro</b> — активна${expiryRow}`;
            }
            else if (tier === 'premium') {
                el.innerHTML = `⭐ <b>Premium</b> — активна${expiryRow}<br><a href="#" onclick="Subscription.showUpgradeModal();return false" style="color:#a78bfa;font-weight:700">Покращити до Pro →</a>`;
            }
            else {
                el.innerHTML = '🆓 <b>Free</b> — безкоштовна<br><a href="#" onclick="Subscription.showUpgradeModal();return false" style="color:#a78bfa;font-weight:700">Покращити підписку →</a>';
            }
        }
    },
    renderStaffLink() {
        const section = document.getElementById('profile-staff-link-section');
        if (!section)
            return;
        const user = this.user;
        if (!user)
            return;
        const role = user.role || 'user';
        const staffRoles = ['content-manager', 'editor', 'support', 'moderator', 'admin', 'superadmin'];
        if (staffRoles.includes(role) || user.is_admin) {
            section.classList.remove('hidden');
        }
        else {
            section.classList.add('hidden');
        }
    },
    bindProfileTools() {
        if (this._profileToolsBound)
            return;
        this._profileToolsBound = true;
        const user = this.user;
        const username = user?.username;
        document.getElementById('tool-year-recap')?.addEventListener('click', () => {
            if (username) {
                window.open(`${CONFIG.API_URL}/share/year/${username}`, '_blank');
            }
            else {
                UI.showToast('Спочатку встанови username');
            }
        });
        document.getElementById('tool-embed')?.addEventListener('click', () => {
            if (username) {
                const code = `<div id="picksy-widget" data-user="${username}"></div>\n<script src="${location.origin}/embed.js"><\/script>`;
                navigator.clipboard.writeText(code).then(() => {
                    UI.showToast('Embed код скопійовано!');
                }).catch(() => { });
            }
            else {
                UI.showToast('Спочатку встанови username');
            }
        });
        document.getElementById('tool-export')?.addEventListener('click', async () => {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/me/export`, {
                    headers: this.getAuthHeaders(),
                });
                if (!res.ok)
                    throw new Error();
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'picksy-export.json';
                a.click();
                URL.revokeObjectURL(url);
                UI.showToast('Дані завантажено!');
            }
            catch {
                UI.showToast('Помилка експорту');
            }
        });
        document.getElementById('tool-qr-profile')?.addEventListener('click', () => {
            if (username) {
                window.open(`${CONFIG.API_URL}/qr/profile/${username}`, '_blank');
            }
            else {
                UI.showToast('Спочатку встанови username');
            }
        });
    },
    logout() {
        this.user = null;
        this.token = null;
        localStorage.removeItem('pfm_token');
        const profileModal = document.getElementById('profile-modal');
        if (profileModal)
            profileModal.classList.add('hidden');
        this.updateUI();
        if (typeof App !== 'undefined') {
            App.savedMovies = [];
            App.savedTv = [];
            App.savedBooks = [];
            App.updateSavedUI();
        }
        if (typeof Collections !== 'undefined')
            Collections.onAuthChange();
    },
    getAuthHeaders() {
        if (!this.token)
            return {};
        return { 'Authorization': `Bearer ${this.token}` };
    },
    _googleClientId: null,
    _googleScriptLoaded: false,
    _googleInitialized: false,
    _googlePromptActive: false,
    _googleButtonRendered: false,
    initGoogle(clientId) {
        if (!clientId)
            return;
        this._googleClientId = clientId;
        // Show only one designed Google button; the official Google iframe is an invisible click layer.
        const divider = document.getElementById('auth-google-divider');
        if (divider)
            divider.style.display = '';
        const wrap = document.getElementById('google-login-wrap');
        if (wrap)
            wrap.style.display = 'flex';
        // Initialize SDK when ready
        this._initGoogleSdk();
    },
    _initGoogleSdk() {
        const tryInit = () => {
            // @ts-ignore
            if (typeof google === 'undefined' || !google.accounts)
                return false;
            if (this._googleInitialized)
                return true;
            this._googleInitialized = true;
            // @ts-ignore
            google.accounts.id.initialize({
                client_id: this._googleClientId,
                callback: (response) => this._handleGoogleResponse(response),
                auto_select: false,
                use_fedcm_for_prompt: false,
            });
            setTimeout(() => this._renderGoogleButton(), 50);
            return true;
        };
        if (tryInit())
            return;
        const start = Date.now();
        const iv = setInterval(() => {
            if (tryInit()) {
                clearInterval(iv);
            }
            else if (Date.now() - start > 10000) {
                clearInterval(iv);
            }
        }, 200);
    },
    _renderGoogleButton() {
        if (this._googleButtonRendered)
            return;
        // @ts-ignore
        if (typeof google === 'undefined' || !google.accounts || !this._googleClientId)
            return;
        if (!this._googleInitialized)
            return;
        const container = document.getElementById('google-btn-container');
        if (!container)
            return;
        const wrap = document.getElementById('google-login-wrap');
        if (wrap)
            wrap.style.display = 'flex';
        container.style.display = 'block';
        container.style.justifyContent = 'center';
        container.innerHTML = '';
        // @ts-ignore
        google.accounts.id.renderButton(container, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            width: Math.min(container.offsetWidth || 360, 400),
            locale: (typeof I18N !== 'undefined' && I18N.current === 'en') ? 'en' : 'uk',
        });
        this._googleButtonRendered = true;
        const fallbackBtn = document.getElementById('auth-google-btn');
        if (fallbackBtn)
            fallbackBtn.style.display = 'flex';
    },
    async googleSignIn() {
        // Фолбек для старої кастомної кнопки: якщо config ще не встиг завантажитись — забираємо його напряму.
        if (!this._googleClientId) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/config`);
                const data = await res.json();
                if (data.google_client_id)
                    this.initGoogle(data.google_client_id);
            }
            catch (e) { }
        }
        if (!this._googleClientId) {
            this._setMascot('error', { hintKey: 'authMascotHintGoogleFail', reason: I18N.t('errorGoogleAuthNotConfigured') || '' });
            return;
        }
        // @ts-ignore
        if (typeof google === 'undefined' || !google.accounts) {
            UI.showToast(I18N.t('authMascotTypingLogin') || 'Loading…');
            return;
        }
        if (!this._googleInitialized)
            this._initGoogleSdk();
        this._renderGoogleButton();
    },
    async _handleGoogleResponse(response) {
        if (!response.credential)
            return;
        this._setMascot('typing');
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const mapped = this._mapAuthError(data && data.detail, res.status);
                this._setMascot('error', {
                    hintKey: mapped.hintKey || 'authMascotHintGoogleFail',
                    reason: I18N.t(mapped.reasonI18n) || (data && data.detail) || '',
                });
                return;
            }
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('pfm_token', this.token);
            this.updateUI();
            this._setMascot('success');
            UI.showToast(I18N.t('loginSuccess'));
            if (typeof App !== 'undefined')
                App.syncFavorites();
            if (typeof Collections !== 'undefined')
                Collections.onAuthChange();
            if (typeof Subscription !== 'undefined')
                Subscription.init();
            if (typeof Analytics !== 'undefined')
                Analytics.onRegister();
            setTimeout(() => this.hideModal(), 1200);
        }
        catch (err) {
            this._setMascot('error', { hintKey: 'authMascotHintNetwork', reason: I18N.t('errorNetwork') || '' });
        }
    },
};
//# sourceMappingURL=auth.js.map