// @ts-nocheck
/* Picksy — Extras v52
 * Holds:
 *   • MOVIE DNA v2 (compute, render, share-card PNG, web share)
 *   • Кінозодіак (Cinema Zodiac) with 12 signs + compatibility
 *   • Психоаналіз по фільмам (rule-based AI portrait)
 *   • Profile cover/avatar device upload (localStorage cache)
 *   • Profile color palette presets + dynamic CSS variables
 *   • Smarter favorite-film + recommendation search
 *   • Personalized "Recommend a movie" widget driven by DNA
 *   • Clickable history items (gift + profile) → desc pages
 *
 * All features run on the client and store user preferences in localStorage —
 * no backend changes required.
 */

(function () {
'use strict';

const Extras = {
    /* ──────────────────────────────────────────────────────────
     * Locale helper
     * ────────────────────────────────────────────────────────── */
    _t(uk, en) {
        try { return (I18N.current === 'en') ? en : uk; } catch (e) { return uk; }
    },
    _isEn() {
        try { return I18N.current === 'en'; } catch (e) { return false; }
    },
    _esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    },

    /* ──────────────────────────────────────────────────────────
     * LocalStorage helpers (per-user where possible)
     * ────────────────────────────────────────────────────────── */
    _userKey(suffix) {
        let uid = '';
        try { uid = (Auth && Auth.user && (Auth.user.id || Auth.user.email)) || ''; } catch (e) {}
        return 'picksy_' + suffix + (uid ? '_' + uid : '');
    },
    _getStore(suffix, fallback) {
        try {
            const raw = localStorage.getItem(this._userKey(suffix));
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (e) { return fallback; }
    },
    _setStore(suffix, value) {
        try {
            localStorage.setItem(this._userKey(suffix), JSON.stringify(value));
        } catch (e) { /* quota exceeded — ignore */ }
    },

    /* ──────────────────────────────────────────────────────────
     * Toast helper (falls back to alert)
     * ────────────────────────────────────────────────────────── */
    _toast(msg) {
        try { if (typeof UI !== 'undefined' && UI.showToast) return UI.showToast(msg); } catch (e) {}
        try { if (typeof UI !== 'undefined' && UI.toast) return UI.toast(msg); } catch (e) {}
    },

    /* ──────────────────────────────────────────────────────────
     * Profile color presets
     * ────────────────────────────────────────────────────────── */
    COLOR_PRESETS: [
        { id: 'violet',     name_uk: 'Фіолетовий', name_en: 'Violet',     a: '#8b5cf6', b: '#ec4899' },
        { id: 'sunset',     name_uk: 'Захід',      name_en: 'Sunset',     a: '#f97316', b: '#ef4444' },
        { id: 'ocean',      name_uk: 'Океан',      name_en: 'Ocean',      a: '#06b6d4', b: '#3b82f6' },
        { id: 'emerald',    name_uk: 'Смарагд',    name_en: 'Emerald',    a: '#10b981', b: '#06d6a0' },
        { id: 'gold',       name_uk: 'Золото',     name_en: 'Gold',       a: '#f59e0b', b: '#eab308' },
        { id: 'rose',       name_uk: 'Троянда',    name_en: 'Rose',       a: '#f43f5e', b: '#ec4899' },
        { id: 'cyber',      name_uk: 'Кібер',      name_en: 'Cyber',      a: '#22d3ee', b: '#a855f7' },
        { id: 'noir',       name_uk: 'Нуар',       name_en: 'Noir',       a: '#94a3b8', b: '#1e293b' },
        { id: 'cherry',     name_uk: 'Черешня',    name_en: 'Cherry',     a: '#dc2626', b: '#7c2d12' },
        { id: 'aurora',     name_uk: 'Аврора',     name_en: 'Aurora',     a: '#34d399', b: '#a78bfa' },
        { id: 'royal',      name_uk: 'Королівськ.',name_en: 'Royal',      a: '#6366f1', b: '#22d3ee' },
        { id: 'lava',       name_uk: 'Лава',       name_en: 'Lava',       a: '#f87171', b: '#facc15' },
    ],

    /* Apply color set scoped to .public-profile-page (NOT :root).
     * In edit mode (mini-profile modal) we apply only to a "preview" host
     * so that the rest of the site keeps its global theme.
     */
    applyProfileColors(opts) {
        const a = opts.a || '#8b5cf6';
        const b = opts.b || '#ec4899';
        // Targets: only the public profile container and the editor preview node.
        const targets = [];
        document.querySelectorAll('.public-profile-page, #profile-color-preview, .profile-color-preview-host')
            .forEach(el => targets.push(el));
        // Also scope to currently-open editor color presets section so the
        // preset chips themselves use the colour.
        const presetHost = document.getElementById('profile-color-presets');
        if (presetHost) targets.push(presetHost);
        targets.forEach(host => {
            host.style.setProperty('--profile-accent', a);
            host.style.setProperty('--profile-accent-2', b);
            host.style.setProperty('--profile-accent-grad', `linear-gradient(135deg, ${a}, ${b})`);
            host.style.setProperty('--profile-accent-soft', this._hexToRgba(a, 0.18));
            host.style.setProperty('--profile-accent-glow', this._hexToRgba(a, 0.45));
        });
    },
    _hexToRgba(hex, a) {
        let h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        if ([r, g, b].some(v => isNaN(v))) return `rgba(139,92,246,${a})`;
        return `rgba(${r},${g},${b},${a})`;
    },
    _lighten(hex, amount) {
        let h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        r = Math.min(255, r + amount); g = Math.min(255, g + amount); b = Math.min(255, b + amount);
        const x = v => v.toString(16).padStart(2, '0');
        return '#' + x(r) + x(g) + x(b);
    },
    /* Returns the number of profile-color presets allowed for the current tier.
     * Free → 3 (first three presets), Premium / Pro → all 12.
     * When freemium is disabled, everything is unlocked. */
    _profileColorLimit() {
        try {
            if (typeof Subscription !== 'undefined' && typeof Subscription.getProfileColorLimit === 'function') {
                const n = Subscription.getProfileColorLimit();
                if (typeof n === 'number' && isFinite(n)) return n;
                return this.COLOR_PRESETS.length;
            }
        } catch (e) { }
        return this.COLOR_PRESETS.length;
    },
    _isFreeTier() {
        try {
            if (typeof Subscription !== 'undefined') {
                if (!Subscription.freemiumEnabled) return false;
                return (Subscription.tier === 'free');
            }
        } catch (e) { }
        return false;
    },
    _showColorUpgrade() {
        try {
            this._toast(this._t(
                '🎨 Цей колір — на Premium/Pro. Оновіть підписку!',
                '🎨 This color is Premium/Pro only. Upgrade your subscription!'
            ));
        } catch (e) { }
        try {
            if (typeof Subscription !== 'undefined' && typeof Subscription.showUpgradeModal === 'function') {
                Subscription.showUpgradeModal();
            }
        } catch (e) { }
    },
    initColorPalette() {
        const wrap = document.getElementById('profile-color-presets');
        if (!wrap) return;
        if (wrap.dataset.bound === '1') {
            // Already bound — just refresh the lock state in case the tier changed
            // since the modal was first opened (e.g. after Subscription.refresh()).
            this._refreshColorPaletteLocks();
            return;
        }
        wrap.dataset.bound = '1';
        const limit = this._profileColorLimit();
        wrap.innerHTML = this.COLOR_PRESETS.map((p, idx) => {
            const grad = `linear-gradient(135deg, ${p.a}, ${p.b})`;
            const name = this._isEn() ? p.name_en : p.name_uk;
            const locked = idx >= limit;
            const lockMark = locked ? '<span class="profile-color-chip-lock" aria-hidden="true">🔒</span>' : '';
            const cls = 'profile-color-chip' + (locked ? ' profile-color-chip-locked' : '');
            const aria = locked ? ' aria-disabled="true"' : '';
            return `<button type="button" class="${cls}" data-a="${p.a}" data-b="${p.b}" data-id="${p.id}" data-idx="${idx}" title="${name}${locked ? ' — Premium/Pro' : ''}"${aria} style="background:${grad}">${lockMark}<span class="profile-color-chip-name">${name}</span></button>`;
        }).join('');
        wrap.querySelectorAll('.profile-color-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('profile-color-chip-locked')) {
                    this._showColorUpgrade();
                    return;
                }
                const a = btn.dataset.a, b = btn.dataset.b;
                const colorInput = document.getElementById('profile-color-input');
                const colorPreview = document.getElementById('profile-color-preview');
                if (colorInput) colorInput.value = a;
                if (colorPreview) colorPreview.textContent = a;
                const colorB = document.getElementById('profile-color-b-input');
                if (colorB) colorB.value = b;
                this.applyProfileColors({ a, b });
                this._setStore('profile_colors', { a, b });
                wrap.querySelectorAll('.profile-color-chip').forEach(x => x.classList.toggle('active', x === btn));
                this._toast(this._t('Колір застосовано', 'Color applied'));
            });
        });
        // Keep the basic color picker in sync. The custom A/B picker is also a Premium
        // feature when freemium is enabled — Free users can only choose from the first
        // three presets, no arbitrary colors.
        const colorInput = document.getElementById('profile-color-input');
        if (colorInput) {
            colorInput.addEventListener('input', () => {
                if (this._isFreeTier()) {
                    // Revert to the saved/first preset and prompt the user to upgrade.
                    const saved = this._getStore('profile_colors', null) || { a: this.COLOR_PRESETS[0].a, b: this.COLOR_PRESETS[0].b };
                    colorInput.value = saved.a;
                    const cb = document.getElementById('profile-color-b-input');
                    if (cb) cb.value = saved.b || this._lighten(saved.a, 30);
                    this.applyProfileColors(saved);
                    this._showColorUpgrade();
                    return;
                }
                const a = colorInput.value;
                const colorB = document.getElementById('profile-color-b-input');
                const b = (colorB && colorB.value) || this._lighten(a, 30);
                this.applyProfileColors({ a, b });
                this._setStore('profile_colors', { a, b });
            });
        }
        const colorB = document.getElementById('profile-color-b-input');
        if (colorB) {
            colorB.addEventListener('input', () => {
                if (this._isFreeTier()) {
                    const saved = this._getStore('profile_colors', null) || { a: this.COLOR_PRESETS[0].a, b: this.COLOR_PRESETS[0].b };
                    colorB.value = saved.b || this._lighten(saved.a, 30);
                    this.applyProfileColors(saved);
                    this._showColorUpgrade();
                    return;
                }
                const a = (colorInput && colorInput.value) || '#8b5cf6';
                const b = colorB.value;
                this.applyProfileColors({ a, b });
                this._setStore('profile_colors', { a, b });
            });
        }
        // Restore saved
        let saved = this._getStore('profile_colors', null);
        // If a Free user has a previously saved non-allowed color (e.g. they were
        // Premium before and got downgraded), reset to the first preset.
        if (this._isFreeTier()) {
            const allowed = this.COLOR_PRESETS.slice(0, this._profileColorLimit());
            const isAllowed = saved && allowed.some(p => String(p.a).toLowerCase() === String(saved.a || '').toLowerCase());
            if (!isAllowed) {
                saved = { a: this.COLOR_PRESETS[0].a, b: this.COLOR_PRESETS[0].b };
                this._setStore('profile_colors', saved);
            }
        }
        if (saved && saved.a) {
            if (colorInput) colorInput.value = saved.a;
            if (colorB) colorB.value = saved.b || this._lighten(saved.a, 30);
            this.applyProfileColors(saved);
            const preview = document.getElementById('profile-color-preview');
            if (preview) preview.textContent = saved.a;
        }
        // Show the Free-tier hint (and any other tier-dependent UI tweaks).
        this._refreshColorPaletteLocks();
        // Re-evaluate locks whenever the active tier changes (e.g. trial activated,
        // admin downgrade, expiration). Bind once.
        if (!this._tierColorListenerBound) {
            this._tierColorListenerBound = true;
            try {
                document.addEventListener('picksy:tier-changed', () => this._refreshColorPaletteLocks());
            } catch (e) { }
        }
    },
    _refreshColorPaletteLocks() {
        const wrap = document.getElementById('profile-color-presets');
        if (!wrap) return;
        const limit = this._profileColorLimit();
        wrap.querySelectorAll('.profile-color-chip').forEach(btn => {
            const idx = parseInt(btn.dataset.idx || '999', 10);
            const name = btn.querySelector('.profile-color-chip-name');
            const locked = idx >= limit;
            btn.classList.toggle('profile-color-chip-locked', locked);
            if (locked) {
                btn.setAttribute('aria-disabled', 'true');
                if (!btn.querySelector('.profile-color-chip-lock')) {
                    const lock = document.createElement('span');
                    lock.className = 'profile-color-chip-lock';
                    lock.setAttribute('aria-hidden', 'true');
                    lock.textContent = '🔒';
                    btn.insertBefore(lock, name);
                }
            } else {
                btn.removeAttribute('aria-disabled');
                btn.querySelectorAll('.profile-color-chip-lock').forEach(el => el.remove());
            }
        });
        // Show / hide the "Free → first 3 colors" hint based on tier.
        const hint = document.getElementById('profile-color-tier-hint');
        if (hint) {
            if (this._isFreeTier()) {
                hint.textContent = this._t(
                    '🔒 На Free доступні перші 3 кольори. Premium / Pro — усі 12 + кастомний.',
                    '🔒 Free has the first 3 colors. Premium / Pro — all 12 + custom.'
                );
                hint.classList.remove('hidden');
            } else {
                hint.classList.add('hidden');
            }
        }
    },

    /* ──────────────────────────────────────────────────────────
     * Cover & avatar upload from device (cached locally)
     * ────────────────────────────────────────────────────────── */
    initDeviceUpload() {
        const bannerFile = document.getElementById('profile-banner-file');
        const bannerPreview = document.getElementById('profile-banner-preview');
        const bannerClear = document.getElementById('profile-banner-clear');
        const bannerInput = document.getElementById('profile-banner-input');
        if (bannerFile && bannerFile.dataset.bound !== '1') {
            bannerFile.dataset.bound = '1';
            bannerFile.addEventListener('change', async (e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                if (f.size > 5 * 1024 * 1024) {
                    this._toast(this._t('Файл занадто великий (макс 5МБ)', 'File too large (max 5MB)'));
                    return;
                }
                // Compress small enough that the resulting data URL fits comfortably in the DB.
                // 1100px wide @ 0.78 quality keeps most banners under ~600 KB.
                const url = await this._fileToCompressedDataUrl(f, 1100, 0.78);
                if (bannerPreview) { bannerPreview.src = url; bannerPreview.classList.remove('hidden'); }
                this._setStore('profile_banner_data', url);
                this._applyBannerToProfile(url);
                // Always send the full data URL to the server — the backend now stores it in MEDIUMTEXT.
                if (bannerInput) bannerInput.value = url;
                this._toast(this._t('Обкладинку оновлено', 'Cover updated'));
            });
        }
        if (bannerClear && bannerClear.dataset.bound !== '1') {
            bannerClear.dataset.bound = '1';
            bannerClear.addEventListener('click', () => {
                this._setStore('profile_banner_data', null);
                if (bannerPreview) { bannerPreview.src = ''; bannerPreview.classList.add('hidden'); }
                if (bannerInput) bannerInput.value = '';
                this._applyBannerToProfile('');
                this._toast(this._t('Обкладинку очищено', 'Cover cleared'));
            });
        }
        // Restore on open
        const stored = this._getStore('profile_banner_data', null);
        if (stored && bannerPreview) { bannerPreview.src = stored; bannerPreview.classList.remove('hidden'); this._applyBannerToProfile(stored); }

        const avFile = document.getElementById('profile-avatar-file');
        const avPreview = document.getElementById('profile-avatar-preview');
        const avClear = document.getElementById('profile-avatar-clear');
        // Ensure a hidden input exists to carry the avatar data URL to /api/me/profile.
        let avInput = document.getElementById('profile-avatar-url-input');
        if (!avInput) {
            avInput = document.createElement('input');
            avInput.type = 'hidden';
            avInput.id = 'profile-avatar-url-input';
            (avFile?.parentElement || document.body).appendChild(avInput);
        }
        if (avFile && avFile.dataset.bound !== '1') {
            avFile.dataset.bound = '1';
            avFile.addEventListener('change', async (e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                if (f.size > 5 * 1024 * 1024) {
                    this._toast(this._t('Файл занадто великий (макс 5МБ)', 'File too large (max 5MB)'));
                    return;
                }
                const url = await this._fileToCompressedDataUrl(f, 256, 0.85);
                if (avPreview) { avPreview.src = url; avPreview.classList.remove('hidden'); }
                this._setStore('profile_avatar_data', url);
                this._applyAvatarToProfile(url);
                if (avInput) avInput.value = url;
                this._toast(this._t('Аватар оновлено', 'Avatar updated'));
            });
        }
        if (avClear && avClear.dataset.bound !== '1') {
            avClear.dataset.bound = '1';
            avClear.addEventListener('click', () => {
                this._setStore('profile_avatar_data', null);
                if (avPreview) { avPreview.src = ''; avPreview.classList.add('hidden'); }
                this._applyAvatarToProfile('');
                if (avInput) avInput.value = '';
                this._toast(this._t('Аватар очищено', 'Avatar cleared'));
            });
        }
        const av = this._getStore('profile_avatar_data', null);
        if (av && avPreview) { avPreview.src = av; avPreview.classList.remove('hidden'); this._applyAvatarToProfile(av); if (avInput && !avInput.value) avInput.value = av; }
    },
    _applyBannerToProfile(url) {
        const head = document.querySelector('.profile-head');
        const card = document.querySelector('.profile-modal-content');
        const target = card || head;
        if (!target) return;
        if (url) {
            target.style.backgroundImage = `linear-gradient(180deg, rgba(10,10,20,0.78) 0%, rgba(10,10,20,0.92) 60%), url("${url}")`;
            target.style.backgroundSize = 'cover';
            target.style.backgroundPosition = 'center';
        } else {
            target.style.backgroundImage = '';
        }
    },
    _applyAvatarToProfile(url) {
        document.querySelectorAll('.profile-avatar').forEach(el => {
            if (url) {
                el.style.backgroundImage = `url("${url}")`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
                el.classList.add('has-img');
            } else {
                el.style.backgroundImage = '';
                el.classList.remove('has-img');
            }
        });
    },
    _fileToCompressedDataUrl(file, maxSide, quality) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const w = img.width, h = img.height;
                    const side = Math.max(w, h);
                    const scale = side > maxSide ? maxSide / side : 1;
                    const cw = Math.round(w * scale), ch = Math.round(h * scale);
                    const canvas = document.createElement('canvas');
                    canvas.width = cw; canvas.height = ch;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, cw, ch);
                    try { resolve(canvas.toDataURL('image/jpeg', quality)); }
                    catch (e) { resolve(fr.result); }
                };
                img.onerror = () => resolve(fr.result);
                img.src = fr.result;
            };
            fr.onerror = () => reject(fr.error);
            fr.readAsDataURL(file);
        });
    },

    /* ──────────────────────────────────────────────────────────
     * Smarter movie/TV/book search for profile fields
     * ────────────────────────────────────────────────────────── */
    SEARCH_SYNONYMS: [
        // ukrainian → english common cases
        ['володар перснів', 'lord of the rings'],
        ['зоряні війни', 'star wars'],
        ['месники', 'avengers'],
        ['тачки', 'cars'],
        ['форсаж', 'fast and furious'],
        ['термінатор', 'terminator'],
        ['матриця', 'matrix'],
        ['гаррі поттер', 'harry potter'],
        ['пірати карибського моря', 'pirates of the caribbean'],
        ['хроніки нарнії', 'chronicles of narnia'],
        ['гра в кальмара', 'squid game'],
        ['тачка', 'cars'],
        ['коли один вдома', 'home alone'],
    ],
    _expandSynonyms(q) {
        const lower = q.toLowerCase();
        for (const [a, b] of this.SEARCH_SYNONYMS) {
            if (lower.includes(a)) return q + ' ' + b;
            if (lower.includes(b)) return q + ' ' + a;
        }
        return q;
    },
    async smartSearch(query, opts) {
        opts = opts || {};
        const types = opts.types || ['movie', 'tv', 'book'];
        const q = (query || '').trim();
        if (q.length < 2) return [];
        const expanded = this._expandSynonyms(q);
        const lang = (typeof I18N !== 'undefined' && I18N.current === 'en') ? 'en-US' : 'uk-UA';
        const results = [];
        // Real Picksy backend endpoints:
        //   movie:  GET /api/tmdb/search/movie?query=...&language=...&page=1
        //   tv:     GET /api/tmdb/search/tv?query=...&language=...&page=1
        //   book:   GET /api/books/search?query=...&lang=...&page=1
        await Promise.all(types.map(async (t) => {
            try {
                let url;
                if (t === 'book') {
                    const blang = lang.startsWith('uk') ? 'uk' : 'en';
                    url = `${CONFIG.API_URL}/api/books/search?query=${encodeURIComponent(expanded)}&lang=${blang}&page=1`;
                } else {
                    url = `${CONFIG.API_URL}/api/tmdb/search/${t}?query=${encodeURIComponent(expanded)}&language=${lang}&page=1`;
                }
                const res = await fetch(url);
                if (!res.ok) return;
                const data = await res.json();
                const arr = data.results || data.items || data.books || [];
                const items = arr.map(it => {
                    const out = { ...it, media_type: it.media_type || t };
                    if (t === 'movie') {
                        out.title = it.title || it.name || '';
                        out.year = (it.release_date || '').slice(0, 4);
                        out.poster = it.poster_path ? `https://image.tmdb.org/t/p/w185${it.poster_path}` : (it.poster || '');
                    } else if (t === 'tv') {
                        out.title = it.name || it.title || '';
                        out.year = (it.first_air_date || '').slice(0, 4);
                        out.poster = it.poster_path ? `https://image.tmdb.org/t/p/w185${it.poster_path}` : (it.poster || '');
                    } else {
                        out.title = it.title || (it.volumeInfo && it.volumeInfo.title) || '';
                        out.year = it.year || it.publishedDate || '';
                        out.poster = it.poster || it.thumbnail || '';
                        out.id = it.id || it.volume_id || '';
                    }
                    out.rating = it.vote_average || it.rating || 0;
                    out.popularity = it.popularity || 0;
                    return out;
                });
                results.push(...items);
            } catch (e) { /* swallow */ }
        }));
        return this._rankResults(results, q);
    },
    _rankResults(items, query) {
        const ql = query.toLowerCase();
        return items
            .map(it => {
                const t = (it.title || it.name || it.original_title || '').toLowerCase();
                let s = 0;
                if (t === ql) s += 100;
                if (t.startsWith(ql)) s += 50;
                if (t.includes(ql)) s += 20;
                s += Math.min(20, (it.popularity || 0) / 10);
                s += Math.min(10, (it.vote_count || it.rating || 0) / 100);
                if (it.year) s += 0.5;
                return { it, s };
            })
            .sort((a, b) => b.s - a.s)
            .map(x => x.it)
            .slice(0, 8);
    },

    /* Bind the favorite-film and recommendations searches with the smarter ranker */
    rebindProfileSearches() {
        const bind = (inputId, resultsId, onPick, types) => {
            let input = document.getElementById(inputId);
            const results = document.getElementById(resultsId);
            if (!input || !results) return;
            if (input.dataset.smartBound === '1') return;
            // Clone the input to remove any pre-existing 'input' listeners
            // (so our smarter search doesn't get overridden by the older handler).
            const clone = input.cloneNode(true);
            input.parentNode.replaceChild(clone, input);
            input = clone;
            input.dataset.smartBound = '1';
            let timer = null;
            input.addEventListener('input', () => {
                clearTimeout(timer);
                const q = input.value.trim();
                if (q.length < 2) { results.innerHTML = ''; results.classList.add('hidden'); return; }
                timer = setTimeout(async () => {
                    results.innerHTML = `<div class="profile-search-loading">${this._t('Шукаю…', 'Searching…')}</div>`;
                    results.classList.remove('hidden');
                    const items = await this.smartSearch(q, { types });
                    if (!items.length) {
                        results.innerHTML = `<div class="profile-search-empty">${this._t('Нічого не знайдено', 'Nothing found')}</div>`;
                        return;
                    }
                    results.innerHTML = items.map(it => {
                        const p = this._normalizePoster(it.poster, 'w92');
                        const ic = it.media_type === 'tv' ? '📺' : it.media_type === 'book' ? '📚' : '🎬';
                        const yr = it.year ? `(${it.year})` : '';
                        return `<div class="profile-fav-result-item" data-id="${this._esc(it.id || it.tmdb_id || '')}" data-title="${this._esc(it.title || it.name || '')}" data-poster="${this._esc(it.poster || '')}" data-type="${this._esc(it.media_type || 'movie')}"><img src="${p}" alt="" loading="lazy" onerror="this.style.display='none'"><span>${ic} ${this._esc(it.title || it.name || '')} ${yr}</span></div>`;
                    }).join('');
                    results.querySelectorAll('.profile-fav-result-item').forEach(el => {
                        el.addEventListener('click', () => {
                            onPick(el.dataset);
                            results.classList.add('hidden');
                            input.value = '';
                        });
                    });
                }, 280);
            });
            // close on outside click
            document.addEventListener('click', (ev) => {
                if (!results.contains(ev.target) && ev.target !== input) {
                    results.classList.add('hidden');
                }
            });
        };
        bind('profile-fav-film-search', 'profile-fav-results', (d) => {
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
            set('profile-fav-film-id', d.id);
            set('profile-fav-film-title', d.title);
            set('profile-fav-film-poster', d.poster);
            set('profile-fav-film-type', d.type || 'movie');
            const posterEl = document.getElementById('profile-fav-poster');
            const titleEl = document.getElementById('profile-fav-title-text');
            const sel = document.getElementById('profile-fav-selected');
            if (posterEl) posterEl.src = this._normalizePoster(d.poster, 'w154');
            if (titleEl) titleEl.textContent = d.title;
            if (sel) sel.classList.remove('hidden');
        }, ['movie', 'tv', 'book']);
        bind('profile-rec-search', 'profile-rec-results', (d) => {
            try {
                if (typeof App === 'undefined') return;
                if (!App._profileRecs) App._profileRecs = [];
                if (App._profileRecs.length >= 5) {
                    this._toast(this._t('Максимум 5 рекомендацій', 'Maximum 5 recommendations'));
                    return;
                }
                // Skip duplicates (same item_id + item_type).
                const dup = App._profileRecs.some(r =>
                    String(r.item_id) === String(d.id) &&
                    (r.item_type || 'movie') === (d.type || 'movie')
                );
                if (dup) {
                    this._toast(this._t('Вже додано', 'Already added'));
                    return;
                }
                App._profileRecs.push({
                    item_type: d.type || 'movie',
                    item_id: String(d.id || ''),
                    item_title: d.title || '',
                    item_poster: d.poster || '',
                    comment: '',
                });
                this._renderProfileRecList();
            } catch (e) {}
        }, ['movie', 'tv', 'book']);
    },
    /* ── Recommendations (up to 5) — render the user's currently selected
     *    items into #profile-rec-list. Each row has a × remove button. */
    _renderProfileRecList() {
        const list = document.getElementById('profile-rec-list');
        if (!list) return;
        const recs = (typeof App !== 'undefined' && Array.isArray(App._profileRecs))
            ? App._profileRecs : [];
        if (!recs.length) {
            list.innerHTML = '';
            return;
        }
        list.innerHTML = recs.map((r, i) => {
            const ic = r.item_type === 'tv' ? '📺' : r.item_type === 'book' ? '📚' : '🎬';
            const poster = this._normalizePoster(r.item_poster, 'w92');
            const posterHtml = poster
                ? `<img src="${poster}" alt="" loading="lazy" onerror="this.style.display='none'">`
                : `<span class="profile-rec-item-icon">${ic}</span>`;
            return `<div class="profile-rec-item" data-idx="${i}">`
                + posterHtml
                + `<span class="profile-rec-item-title">${ic} ${this._esc(r.item_title || '')}</span>`
                + `<button type="button" class="profile-rec-item-remove" aria-label="remove" data-idx="${i}">×</button>`
                + `</div>`;
        }).join('');
        list.querySelectorAll('.profile-rec-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                if (Number.isNaN(idx)) return;
                if (typeof App === 'undefined' || !Array.isArray(App._profileRecs)) return;
                App._profileRecs.splice(idx, 1);
                this._renderProfileRecList();
            });
        });
    },
    /* Pull existing recs from the server when the profile modal opens. */
    async _hydrateProfileRecs() {
        try {
            if (typeof Auth === 'undefined' || !Auth.token) return;
            const res = await fetch(`${CONFIG.API_URL}/api/me/recommendations`, {
                headers: Auth.getAuthHeaders(),
            });
            if (!res.ok) return;
            const data = await res.json().catch(() => ({}));
            const items = Array.isArray(data.items) ? data.items : [];
            if (typeof App !== 'undefined') {
                App._profileRecs = items.slice(0, 5).map(it => ({
                    item_type: it.item_type || 'movie',
                    item_id: String(it.item_id || ''),
                    item_title: it.item_title || '',
                    item_poster: it.item_poster || '',
                    comment: it.comment || '',
                }));
            }
            this._renderProfileRecList();
        } catch (e) { }
    },
    _normalizePoster(p, size) {
        if (!p) return '';
        if (p.startsWith('http')) return p;
        if (p.startsWith('/')) return 'https://image.tmdb.org/t/p/' + (size || 'w154') + p;
        return p;
    },

    /* ──────────────────────────────────────────────────────────
     * Movie DNA computation
     * ────────────────────────────────────────────────────────── */
    GENRE_MOOD: {
        'horror': 'dark', 'thriller': 'dark', 'crime': 'dark', 'mystery': 'dark', 'war': 'dark',
        'drama': 'deep', 'biography': 'deep', 'documentary': 'deep', 'history': 'deep',
        'comedy': 'light', 'animation': 'light', 'family': 'light', 'romance': 'light', 'music': 'light',
        'action': 'high', 'adventure': 'high', 'sci-fi': 'high', 'fantasy': 'high', 'sport': 'high', 'western': 'high',
    },
    async computeDNA() {
        let history = [];
        let saved = [];
        try {
            const data = await API.getHistory({ limit: 200 });
            history = (data && data.items) || [];
        } catch (e) {}
        try {
            if (typeof App !== 'undefined') {
                saved = [].concat(App.savedMovies || [], App.savedTv || [], App.savedBooks || []);
            }
        } catch (e) {}
        const all = [...history, ...saved];
        if (!all.length) return null;

        const genres = {};
        const decades = {};
        const types = { movie: 0, tv: 0, book: 0 };
        const langs = {};
        const moods = { dark: 0, deep: 0, light: 0, high: 0 };
        let ratingSum = 0, ratingCount = 0;
        for (const it of all) {
            const tp = it.type || it.media_type || 'movie';
            types[tp] = (types[tp] || 0) + 1;
            const g = it.genres || it.genre || [];
            (Array.isArray(g) ? g : String(g).split(/[,;]/)).forEach(gx => {
                if (!gx) return;
                const k = String(gx).toLowerCase().trim();
                if (!k) return;
                genres[k] = (genres[k] || 0) + 1;
                const mood = this.GENRE_MOOD[k];
                if (mood) moods[mood]++;
            });
            const yr = parseInt(it.year || (it.release_date || '').slice(0, 4), 10);
            if (yr && !isNaN(yr)) {
                const d = Math.floor(yr / 10) * 10;
                decades[d] = (decades[d] || 0) + 1;
            }
            const lang = (it.original_language || it.lang || '').toLowerCase();
            if (lang) langs[lang] = (langs[lang] || 0) + 1;
            const r = parseFloat(it.rating || it.vote_average || 0);
            if (r) { ratingSum += r; ratingCount++; }
        }
        const topPairs = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
        const topGenres = topPairs(genres, 5);
        const topDecades = topPairs(decades, 3);
        const topLangs = topPairs(langs, 3);
        const total = all.length;
        const moodTop = topPairs(moods, 4);
        const avgRating = ratingCount ? (ratingSum / ratingCount) : 0;
        return {
            total, types,
            genres: topGenres,
            decades: topDecades,
            langs: topLangs,
            moods: moodTop,
            allMoods: moods,
            avgRating,
        };
    },

    GENRE_TR: {
        'action': { uk: 'Бойовик', en: 'Action' },
        'adventure': { uk: 'Пригоди', en: 'Adventure' },
        'animation': { uk: 'Анімація', en: 'Animation' },
        'comedy': { uk: 'Комедія', en: 'Comedy' },
        'crime': { uk: 'Кримінал', en: 'Crime' },
        'documentary': { uk: 'Документальний', en: 'Documentary' },
        'drama': { uk: 'Драма', en: 'Drama' },
        'family': { uk: 'Сімейний', en: 'Family' },
        'fantasy': { uk: 'Фентезі', en: 'Fantasy' },
        'history': { uk: 'Історичний', en: 'History' },
        'horror': { uk: 'Жахи', en: 'Horror' },
        'music': { uk: 'Музичний', en: 'Music' },
        'mystery': { uk: 'Детектив', en: 'Mystery' },
        'romance': { uk: 'Мелодрама', en: 'Romance' },
        'sci-fi': { uk: 'Фантастика', en: 'Sci-Fi' },
        'science fiction': { uk: 'Фантастика', en: 'Sci-Fi' },
        'thriller': { uk: 'Трилер', en: 'Thriller' },
        'war': { uk: 'Військовий', en: 'War' },
        'western': { uk: 'Вестерн', en: 'Western' },
        'sport': { uk: 'Спорт', en: 'Sport' },
        'biography': { uk: 'Біографія', en: 'Biography' },
    },
    _trGenre(g) {
        const k = String(g || '').toLowerCase();
        const t = this.GENRE_TR[k];
        if (!t) return g;
        return this._isEn() ? t.en : t.uk;
    },

    /* True if the user can see / use Movie DNA on the current tier.
     * Movie DNA is Premium/Pro when freemium is enabled. */
    _hasMovieDna() {
        try {
            if (typeof Subscription !== 'undefined' && typeof Subscription.hasMovieDna === 'function') {
                return !!Subscription.hasMovieDna();
            }
        } catch (e) { }
        return true;
    },
    _renderDNALocked(host, empty, actions) {
        if (empty) empty.classList.add('hidden');
        if (actions) actions.classList.add('hidden');
        const upgradeMsg = this._t(
            '🔒 Movie DNA — фіча Premium / Pro. Оновіть підписку, щоб розкодувати свою кіно-ДНК.',
            '🔒 Movie DNA is Premium / Pro only. Upgrade your subscription to decode your movie DNA.'
        );
        host.innerHTML = `
          <div class="dna-locked-card">
            <div class="dna-locked-icon">🧬</div>
            <div class="dna-locked-title">${this._t('Movie DNA', 'Movie DNA')}</div>
            <div class="dna-locked-msg">${upgradeMsg}</div>
            <button type="button" class="dna-locked-btn" id="dna-locked-upgrade-btn">${this._t('🔓 Оновити підписку', '🔓 Upgrade plan')}</button>
          </div>
        `;
        const btn = document.getElementById('dna-locked-upgrade-btn');
        if (btn) btn.addEventListener('click', () => {
            try { if (typeof Subscription !== 'undefined' && Subscription.showUpgradeModal) Subscription.showUpgradeModal(); } catch (e) { }
        });
        this._lastDNA = null;
    },
    async renderDNA() {
        const host = document.getElementById('movie-dna-body');
        if (!host) return;
        const empty = document.getElementById('movie-dna-empty');
        const actions = document.getElementById('movie-dna-actions');
        // Free users can't access Movie DNA — show an upgrade card instead.
        if (!this._hasMovieDna()) {
            this._renderDNALocked(host, empty, actions);
            return;
        }
        host.innerHTML = `<div class="dna-loading">${this._t('Аналізуємо твою кіно-ДНК…', 'Decoding your movie DNA…')}</div>`;
        const dna = await this.computeDNA();
        if (!dna) {
            host.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            if (actions) actions.classList.add('hidden');
            return;
        }
        if (empty) empty.classList.add('hidden');
        if (actions) actions.classList.remove('hidden');
        this._lastDNA = dna;
        const top = dna.genres[0] ? this._trGenre(dna.genres[0][0]) : '—';
        const decade = dna.decades[0] ? dna.decades[0][0] + 's' : '—';
        const moodLabels = {
            dark: this._t('Темний', 'Dark'), deep: this._t('Глибокий', 'Deep'),
            light: this._t('Легкий', 'Light'), high: this._t('Драйвовий', 'High-energy'),
        };
        const moodTop = dna.moods[0] ? moodLabels[dna.moods[0][0]] : '—';
        const totalMood = (dna.allMoods.dark + dna.allMoods.deep + dna.allMoods.light + dna.allMoods.high) || 1;
        const moodBar = ['dark', 'deep', 'light', 'high'].map(k => {
            const v = (dna.allMoods[k] || 0) * 100 / totalMood;
            return `<div class="dna-mood-row"><span class="dna-mood-label">${moodLabels[k]}</span><div class="dna-mood-bar"><div class="dna-mood-fill dna-mood-${k}" style="width:${v.toFixed(0)}%"></div></div><span class="dna-mood-pct">${v.toFixed(0)}%</span></div>`;
        }).join('');
        const helixBars = dna.genres.map(([g, c], i) => {
            const pct = Math.min(100, c * 100 / dna.total);
            return `<div class="dna-helix-row"><span class="dna-helix-name">${this._trGenre(g)}</span><div class="dna-helix-track"><div class="dna-helix-fill" style="width:${pct.toFixed(0)}%;animation-delay:${i * 80}ms"></div></div><span class="dna-helix-count">${c}</span></div>`;
        }).join('');
        const decadesHtml = dna.decades.map(([d, c]) => `<span class="dna-chip">${d}s · ${c}</span>`).join('');
        host.innerHTML = `
          <div class="dna-stats-row">
            <div class="dna-stat"><span class="dna-stat-icon">🎬</span><b>${dna.types.movie || 0}</b><small>${this._t('Фільмів', 'Movies')}</small></div>
            <div class="dna-stat"><span class="dna-stat-icon">📺</span><b>${dna.types.tv || 0}</b><small>${this._t('Серіалів', 'TV')}</small></div>
            <div class="dna-stat"><span class="dna-stat-icon">📚</span><b>${dna.types.book || 0}</b><small>${this._t('Книг', 'Books')}</small></div>
            <div class="dna-stat"><span class="dna-stat-icon">⭐</span><b>${dna.avgRating ? dna.avgRating.toFixed(1) : '—'}</b><small>${this._t('Сер. рейтинг', 'Avg rating')}</small></div>
          </div>
          <div class="dna-summary">
            <div class="dna-summary-item"><span class="dna-summary-emoji">🎭</span><div><div class="dna-summary-label">${this._t('Топ жанр', 'Top genre')}</div><div class="dna-summary-value">${top}</div></div></div>
            <div class="dna-summary-item"><span class="dna-summary-emoji">📅</span><div><div class="dna-summary-label">${this._t('Епоха', 'Era')}</div><div class="dna-summary-value">${decade}</div></div></div>
            <div class="dna-summary-item"><span class="dna-summary-emoji">🌡️</span><div><div class="dna-summary-label">${this._t('Настрій', 'Mood')}</div><div class="dna-summary-value">${moodTop}</div></div></div>
          </div>
          <h4 class="dna-block-title">${this._t('Спіраль жанрів', 'Genre helix')}</h4>
          <div class="dna-helix">${helixBars || `<div class="dna-empty-mini">${this._t('Недостатньо даних', 'Not enough data')}</div>`}</div>
          <h4 class="dna-block-title">${this._t('Палітра настрою', 'Mood palette')}</h4>
          <div class="dna-mood-chart">${moodBar}</div>
          <h4 class="dna-block-title">${this._t('Улюблені епохи', 'Favorite eras')}</h4>
          <div class="dna-decades">${decadesHtml || `<span class="dna-empty-mini">—</span>`}</div>
        `;
        this.renderRecommendation(dna);
    },

    /* ──────────────────────────────────────────────────────────
     * Share card (canvas → PNG) — v3 design
     *
     * 1080×1920 portrait card optimised for Instagram / TikTok / Twitter
     * stories. Uses the user's profile colour palette as the gradient base,
     * draws a faint DNA helix as decoration, glassy panels for each section,
     * avatar with initials, top-genre hero block, genre spectrum bars,
     * mood palette bar with a legend, decades chips and a footer with the
     * picksy.my call-to-action. Falls back gracefully if data is missing.
     * ────────────────────────────────────────────────────────── */
    SHARE_CARD_W: 1080,
    SHARE_CARD_H: 1920,

    async generateDNAShareCard() {
        const dna = this._lastDNA || (await this.computeDNA());
        if (!dna) {
            this._toast(this._t('Спочатку додай хоча б один фільм до історії', 'Pick a movie first to build your DNA'));
            return null;
        }
        const W = this.SHARE_CARD_W;
        const H = this.SHARE_CARD_H;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        const palette = this._getStore('profile_colors', { a: '#8b5cf6', b: '#ec4899' });
        const colorA = palette.a || '#8b5cf6';
        const colorB = palette.b || '#ec4899';

        this._drawShareBackground(ctx, W, H, colorA, colorB);
        this._drawDecorativeHelix(ctx, W, H, colorA, colorB);

        const FONT = '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif';
        const userName = this._getUserName();
        const handle = this._getUserHandle();
        const initials = this._getInitials(userName);

        // ── 1. Top brand strip ────────────────────────────────────
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // brand pill (background)
        this._drawRoundedRect(ctx, 60, 70, 380, 70, 35);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.20)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // brand monogram dot
        const dotGrad = ctx.createLinearGradient(80, 90, 130, 130);
        dotGrad.addColorStop(0, colorA);
        dotGrad.addColorStop(1, colorB);
        ctx.fillStyle = dotGrad;
        ctx.beginPath(); ctx.arc(105, 105, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px ' + FONT;
        ctx.fillText('P', 98, 106);
        // brand text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 26px ' + FONT;
        ctx.fillText('PICKSY', 145, 96);
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '600 18px ' + FONT;
        ctx.fillText(this._isEn() ? 'MOVIE DNA' : 'КІНО-ДНК', 145, 122);

        // top-right badge: avg rating ★
        if (dna.avgRating) {
            const badgeX = W - 60 - 220, badgeY = 70, bw = 220, bh = 70;
            this._drawRoundedRect(ctx, badgeX, badgeY, bw, bh, 35);
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.20)';
            ctx.stroke();
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 32px ' + FONT;
            ctx.textAlign = 'left';
            ctx.fillText('★', badgeX + 24, badgeY + bh / 2);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 30px ' + FONT;
            ctx.fillText(dna.avgRating.toFixed(1), badgeX + 64, badgeY + bh / 2);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '600 16px ' + FONT;
            ctx.fillText(this._isEn() ? 'AVG' : 'СЕР', badgeX + 130, badgeY + bh / 2);
        }
        ctx.restore();

        // ── 2. Hero: avatar + name ────────────────────────────────
        ctx.save();
        const avatarCx = 160, avatarCy = 290, avatarR = 90;
        // outer glow ring
        const ring = ctx.createLinearGradient(avatarCx - avatarR, avatarCy - avatarR, avatarCx + avatarR, avatarCy + avatarR);
        ring.addColorStop(0, colorA);
        ring.addColorStop(1, colorB);
        ctx.beginPath(); ctx.arc(avatarCx, avatarCy, avatarR + 8, 0, Math.PI * 2);
        ctx.fillStyle = ring; ctx.fill();
        // inner dark circle
        ctx.beginPath(); ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
        const inner = ctx.createRadialGradient(avatarCx - 20, avatarCy - 20, 10, avatarCx, avatarCy, avatarR);
        inner.addColorStop(0, 'rgba(255,255,255,0.18)');
        inner.addColorStop(1, 'rgba(10,10,30,0.85)');
        ctx.fillStyle = inner; ctx.fill();
        // initials
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 70px ' + FONT;
        ctx.fillText(initials, avatarCx, avatarCy + 4);

        // name + handle
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 56px ' + FONT;
        const nameMaxW = W - (avatarCx + avatarR + 40) - 60;
        const truncatedName = this._fitText(ctx, userName, nameMaxW, 56, FONT, true);
        ctx.fillText(truncatedName, avatarCx + avatarR + 40, avatarCy - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.font = '500 28px ' + FONT;
        ctx.fillText(handle, avatarCx + avatarR + 40, avatarCy + 42);
        ctx.restore();

        // ── 3. Hero block: top genre + decade + mood ─────────────
        const heroY = 410, heroH = 340;
        this._drawGlassPanel(ctx, 60, heroY, W - 120, heroH, 32, colorA, colorB);

        const topGenre = dna.genres[0] ? this._trGenre(dna.genres[0][0]) : '—';
        const topDecade = dna.decades[0] ? (dna.decades[0][0] + 's') : '—';
        const moodLabelsLong = this._isEn()
            ? { dark: 'Dark & Tense', deep: 'Deep & Reflective', light: 'Light & Warm', high: 'High-Energy' }
            : { dark: 'Темний і напружений', deep: 'Глибокий і вдумливий', light: 'Легкий і теплий', high: 'Драйвовий' };
        const moodTopKey = dna.moods[0] ? dna.moods[0][0] : 'deep';
        const moodTop = moodLabelsLong[moodTopKey] || '—';

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        // label
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '600 24px ' + FONT;
        ctx.fillText(this._isEn() ? 'YOUR TOP GENRE' : 'ТВІЙ ТОП-ЖАНР', W / 2, heroY + 70);
        // big top genre — auto-fit
        const heroMaxW = W - 200;
        const fittedGenre = this._fitText(ctx, topGenre, heroMaxW, 110, FONT, true);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 110px ' + FONT;
        // gradient text fill
        const gtg = ctx.createLinearGradient(W * 0.2, heroY, W * 0.8, heroY + heroH);
        gtg.addColorStop(0, '#ffffff');
        gtg.addColorStop(1, this._lighten(colorB, 30));
        ctx.fillStyle = gtg;
        ctx.fillText(fittedGenre, W / 2, heroY + 190);
        // sub line: decade · mood
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '500 30px ' + FONT;
        const sub = `${topDecade}  ·  ${moodTop}`;
        ctx.fillText(this._fitText(ctx, sub, heroMaxW, 30, FONT, false), W / 2, heroY + 240);
        // tiny chips below: top-3 decades
        const chipY = heroY + 280;
        const chips = (dna.decades || []).slice(0, 3).map(d => d[0] + 's');
        if (chips.length) {
            ctx.font = '600 22px ' + FONT;
            const padX = 22;
            const totalW = chips.reduce((sum, c) => sum + ctx.measureText(c).width + padX * 2, 0) + (chips.length - 1) * 14;
            let cx = W / 2 - totalW / 2;
            chips.forEach(c => {
                const tw = ctx.measureText(c).width + padX * 2;
                this._drawRoundedRect(ctx, cx, chipY, tw, 44, 22);
                ctx.fillStyle = 'rgba(255,255,255,0.14)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.22)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.textBaseline = 'middle';
                ctx.fillText(c, cx + tw / 2, chipY + 23);
                ctx.textBaseline = 'alphabetic';
                cx += tw + 14;
            });
        }
        ctx.restore();

        // ── 4. Genre spectrum ────────────────────────────────────
        const specY = heroY + heroH + 30;
        const specH = 410;
        this._drawGlassPanel(ctx, 60, specY, W - 120, specH, 28, colorA, colorB);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px ' + FONT;
        ctx.fillText(this._isEn() ? 'Genre spectrum' : 'Спектр жанрів', 100, specY + 50);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '500 20px ' + FONT;
        ctx.fillText(this._isEn() ? 'top 5 by frequency' : 'топ-5 за частотою', 100, specY + 78);
        const totalCount = dna.total || 1;
        const rowsCount = Math.min(5, dna.genres.length);
        const rowH = 46;
        const rowGap = 12;
        const rowsStartY = specY + 110;
        for (let i = 0; i < rowsCount; i++) {
            const [g, c] = dna.genres[i];
            const y = rowsStartY + i * (rowH + rowGap);
            const pct = Math.min(1, c / totalCount);
            const trackX = 100, trackW = W - 200;
            // label
            ctx.fillStyle = '#fff';
            ctx.font = '600 22px ' + FONT;
            ctx.fillText(this._fitText(ctx, this._trGenre(g), 380, 22, FONT, false), trackX, y - 4);
            ctx.fillStyle = 'rgba(255,255,255,0.78)';
            ctx.textAlign = 'right';
            ctx.font = '700 20px ' + FONT;
            ctx.fillText((pct * 100).toFixed(0) + '%', trackX + trackW, y - 4);
            ctx.textAlign = 'left';
            // track
            this._drawRoundedRect(ctx, trackX, y + 6, trackW, 20, 10);
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.fill();
            // fill
            const fillW = Math.max(20, trackW * pct);
            const fg = ctx.createLinearGradient(trackX, 0, trackX + trackW, 0);
            fg.addColorStop(0, colorA);
            fg.addColorStop(1, colorB);
            this._drawRoundedRect(ctx, trackX, y + 6, fillW, 20, 10);
            ctx.fillStyle = fg;
            ctx.fill();
        }
        ctx.restore();

        // ── 5. Mood palette ──────────────────────────────────────
        const moodY = specY + specH + 30;
        const moodH = 200;
        this._drawGlassPanel(ctx, 60, moodY, W - 120, moodH, 28, colorA, colorB);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px ' + FONT;
        ctx.fillText(this._isEn() ? 'Mood palette' : 'Палітра настрою', 100, moodY + 50);
        // stacked bar
        const moods = ['dark', 'deep', 'light', 'high'];
        const moodColors = { dark: '#7c3aed', deep: '#0ea5e9', light: '#fbbf24', high: '#ef4444' };
        const moodLabels = this._isEn()
            ? { dark: 'Dark', deep: 'Deep', light: 'Light', high: 'High' }
            : { dark: 'Темний', deep: 'Глибокий', light: 'Легкий', high: 'Драйв' };
        const totalMood = (dna.allMoods.dark + dna.allMoods.deep + dna.allMoods.light + dna.allMoods.high) || 1;
        const barX = 100, barY = moodY + 80, barW = W - 200, barH = 32;
        // bar background
        this._drawRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fill();
        // segments — clipped to rounded shape
        ctx.save();
        this._drawRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
        ctx.clip();
        let mxPos = barX;
        moods.forEach(m => {
            const part = Math.max(0, (dna.allMoods[m] / totalMood) * barW);
            if (part <= 0) return;
            ctx.fillStyle = moodColors[m];
            ctx.fillRect(mxPos, barY, part, barH);
            mxPos += part;
        });
        ctx.restore();

        // legend grid (4 cols)
        ctx.font = '600 20px ' + FONT;
        const colW = barW / 4;
        moods.forEach((m, i) => {
            const lx = barX + i * colW;
            const ly = moodY + 150;
            ctx.fillStyle = moodColors[m];
            ctx.beginPath(); ctx.arc(lx + 10, ly - 6, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            const pct = ((dna.allMoods[m] || 0) / totalMood * 100).toFixed(0);
            ctx.fillText(`${moodLabels[m]} · ${pct}%`, lx + 26, ly);
        });
        ctx.restore();

        // ── 6. Stats grid (4 cards) ──────────────────────────────
        const statsY = moodY + moodH + 28;
        const statsH = 170;
        const cardW = (W - 120 - 3 * 18) / 4;
        const stats = [
            { icon: '🎬', value: dna.types.movie || 0, label: this._isEn() ? 'Movies' : 'Фільмів' },
            { icon: '📺', value: dna.types.tv || 0,    label: this._isEn() ? 'TV' : 'Серіали' },
            { icon: '📚', value: dna.types.book || 0,  label: this._isEn() ? 'Books' : 'Книги' },
            { icon: '🧬', value: dna.total || 0,        label: this._isEn() ? 'Total' : 'Усього' },
        ];
        ctx.save();
        for (let i = 0; i < 4; i++) {
            const sx = 60 + i * (cardW + 18);
            this._drawGlassPanel(ctx, sx, statsY, cardW, statsH, 22, colorA, colorB);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.font = '40px ' + FONT;
            ctx.fillText(stats[i].icon, sx + cardW / 2, statsY + 58);
            ctx.font = 'bold 42px ' + FONT;
            ctx.fillText(String(stats[i].value), sx + cardW / 2, statsY + 110);
            ctx.fillStyle = 'rgba(255,255,255,0.72)';
            ctx.font = '600 18px ' + FONT;
            ctx.fillText(stats[i].label, sx + cardW / 2, statsY + 145);
        }
        ctx.restore();

        // ── 7. Footer CTA ────────────────────────────────────────
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = 'bold 30px ' + FONT;
        ctx.fillText(this._isEn() ? 'Build your Movie DNA' : 'Створи свою кіно-ДНК', W / 2, H - 90);
        // pill with site URL
        const url = 'picksy.my';
        ctx.font = 'bold 28px ' + FONT;
        const urlW = ctx.measureText(url).width + 56;
        const urlX = W / 2 - urlW / 2;
        const urlY = H - 65;
        this._drawRoundedRect(ctx, urlX, urlY, urlW, 50, 25);
        const urlGrad = ctx.createLinearGradient(urlX, urlY, urlX + urlW, urlY + 56);
        urlGrad.addColorStop(0, colorA);
        urlGrad.addColorStop(1, colorB);
        ctx.fillStyle = urlGrad;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.fillText(url, W / 2, urlY + 25);
        ctx.restore();

        return canvas;
    },

    /* ── Share-card drawing helpers ───────────────────────────── */
    _drawShareBackground(ctx, W, H, colorA, colorB) {
        // base diagonal gradient
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, this._mix(colorA, '#0b0b1f', 0.55));
        grad.addColorStop(0.5, this._mix(colorA, colorB, 0.5));
        grad.addColorStop(1, this._mix(colorB, '#0b0b1f', 0.55));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        // dim overlay
        ctx.fillStyle = 'rgba(8,8,18,0.45)';
        ctx.fillRect(0, 0, W, H);
        // soft radial blob A (top-right)
        let blob = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.7);
        blob.addColorStop(0, this._withAlpha(colorA, 0.55));
        blob.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = blob;
        ctx.fillRect(0, 0, W, H);
        // soft radial blob B (bottom-left)
        blob = ctx.createRadialGradient(W * 0.1, H * 0.95, 0, W * 0.1, H * 0.95, W * 0.75);
        blob.addColorStop(0, this._withAlpha(colorB, 0.45));
        blob.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = blob;
        ctx.fillRect(0, 0, W, H);
        // soft white centre highlight
        blob = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.6);
        blob.addColorStop(0, 'rgba(255,255,255,0.10)');
        blob.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = blob;
        ctx.fillRect(0, 0, W, H);
        // grain dots
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        for (let i = 0; i < 240; i++) {
            const x = Math.random() * W;
            const y = Math.random() * H;
            ctx.fillRect(x, y, 2, 2);
        }
    },
    _drawDecorativeHelix(ctx, W, H, colorA, colorB) {
        // Subtle DNA helix shape running vertically on left+right edges.
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 3;
        const drawStrand = (cx, phase, color) => {
            ctx.strokeStyle = color;
            ctx.beginPath();
            for (let y = -20; y <= H + 20; y += 6) {
                const x = cx + Math.sin((y / H) * Math.PI * 6 + phase) * 70;
                if (y === -20) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            // rungs
            for (let y = 0; y <= H; y += 90) {
                const x1 = cx + Math.sin((y / H) * Math.PI * 6 + phase) * 70;
                const x2 = cx + Math.sin((y / H) * Math.PI * 6 + phase + Math.PI) * 70;
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();
            }
        };
        drawStrand(60, 0, colorA);
        drawStrand(60, Math.PI, colorB);
        drawStrand(W - 60, 0.6, colorA);
        drawStrand(W - 60, Math.PI + 0.6, colorB);
        ctx.restore();
    },
    _drawGlassPanel(ctx, x, y, w, h, r, colorA, colorB) {
        ctx.save();
        // outer glow
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        this._drawRoundedRect(ctx, x, y, w, h, r);
        ctx.fillStyle = 'rgba(15,15,35,0.42)';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        // gradient border
        this._drawRoundedRect(ctx, x, y, w, h, r);
        const bg = ctx.createLinearGradient(x, y, x + w, y + h);
        bg.addColorStop(0, this._withAlpha(colorA, 0.55));
        bg.addColorStop(1, this._withAlpha(colorB, 0.55));
        ctx.strokeStyle = bg;
        ctx.lineWidth = 2;
        ctx.stroke();
        // inner highlight
        this._drawRoundedRect(ctx, x + 1, y + 1, w - 2, Math.min(h - 2, 60), r - 1);
        const hl = ctx.createLinearGradient(0, y, 0, y + 60);
        hl.addColorStop(0, 'rgba(255,255,255,0.10)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hl;
        ctx.fill();
        ctx.restore();
    },
    _drawRoundedRect(ctx, x, y, w, h, r) {
        const rr = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h - rr);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        ctx.lineTo(x + rr, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.closePath();
    },
    _fitText(ctx, text, maxWidth, baseSize, font, bold) {
        // Reduce font size if needed; final text is returned unchanged.
        let size = baseSize;
        ctx.font = (bold ? 'bold ' : '600 ') + size + 'px ' + font;
        while (size > 14 && ctx.measureText(text).width > maxWidth) {
            size -= 2;
            ctx.font = (bold ? 'bold ' : '600 ') + size + 'px ' + font;
        }
        // If still too long after shrink, ellipsise.
        if (ctx.measureText(text).width > maxWidth) {
            let s = String(text);
            while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
            return s + '…';
        }
        return text;
    },
    _hexToRgb(hex) {
        const m = String(hex || '').replace('#', '').trim();
        const v = m.length === 3
            ? m.split('').map(c => c + c).join('')
            : (m.length === 6 ? m : '8b5cf6');
        const n = parseInt(v, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },
    _withAlpha(hex, a) {
        const { r, g, b } = this._hexToRgb(hex);
        return `rgba(${r},${g},${b},${a})`;
    },
    _mix(hexA, hexB, t) {
        const A = this._hexToRgb(hexA), B = this._hexToRgb(hexB);
        const k = Math.max(0, Math.min(1, t));
        const r = Math.round(A.r + (B.r - A.r) * k);
        const g = Math.round(A.g + (B.g - A.g) * k);
        const b = Math.round(A.b + (B.b - A.b) * k);
        return `rgb(${r},${g},${b})`;
    },
    _lighten(hex, percent) {
        const { r, g, b } = this._hexToRgb(hex);
        const k = Math.max(0, Math.min(100, percent)) / 100;
        const nr = Math.round(r + (255 - r) * k);
        const ng = Math.round(g + (255 - g) * k);
        const nb = Math.round(b + (255 - b) * k);
        return `rgb(${nr},${ng},${nb})`;
    },
    _truncate(s, n) {
        s = String(s || '');
        return s.length > n ? s.slice(0, n - 1) + '…' : s;
    },
    _getInitials(name) {
        const s = String(name || '').trim();
        if (!s) return '🎬';
        const parts = s.split(/[\s._-]+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        const stripped = s.replace(/[^\p{L}\p{N}]/gu, '');
        if (stripped.length >= 2) return stripped.slice(0, 2).toUpperCase();
        return (stripped || s).slice(0, 1).toUpperCase();
    },
    _getUserName() {
        try {
            if (Auth && Auth.user) return Auth.user.display_name || Auth.user.username || (Auth.user.email || '').split('@')[0] || 'You';
        } catch (e) {}
        return this._isEn() ? 'You' : 'Ти';
    },
    _getUserHandle() {
        try {
            if (Auth && Auth.user) {
                const u = Auth.user.username || (Auth.user.email || '').split('@')[0];
                if (u) return '@' + u;
            }
        } catch (e) {}
        return 'picksy.my';
    },
    async downloadDNAShareCard() {
        const canvas = await this.generateDNAShareCard();
        if (!canvas) return;
        canvas.toBlob(blob => {
            if (!blob) return;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'picksy-movie-dna.png';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            this._toast(this._t('Картку збережено', 'Card saved'));
        }, 'image/png');
    },
    async shareDNAShareCard() {
        const canvas = await this.generateDNAShareCard();
        if (!canvas) return;
        const link = window.location.origin + '/';
        const text = this._isEn() ? '🎬 My Movie DNA on Picksy' : '🎬 Моя кіно-ДНК на Picksy';
        canvas.toBlob(async blob => {
            if (!blob) return;
            const file = new File([blob], 'picksy-movie-dna.png', { type: 'image/png' });
            try {
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: text, text, url: link });
                    return;
                }
            } catch (e) {}
            // fallback: copy URL
            try {
                await navigator.clipboard.writeText(link);
                this._toast(this._t('Посилання скопійовано', 'Link copied'));
            } catch (e) {}
        }, 'image/png');
    },
    async previewDNAShareCard() {
        const canvas = await this.generateDNAShareCard();
        if (!canvas) return;
        const url = canvas.toDataURL('image/png');
        let modal = document.getElementById('dna-share-preview');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dna-share-preview';
            modal.className = 'dna-share-modal';
            modal.innerHTML = `<div class="dna-share-overlay"></div>
              <div class="dna-share-card glass-deep">
                <button class="modal-close dna-share-close" aria-label="${this._t('Закрити', 'Close')}">&times;</button>
                <div class="dna-share-head">
                  <div class="dna-share-title">${this._t('🧬 Твоя Movie DNA картка', '🧬 Your Movie DNA card')}</div>
                  <div class="dna-share-sub">${this._t('Поділись своєю кіно-ДНК у сторіс або з друзями', 'Share your movie DNA in stories or with friends')}</div>
                </div>
                <img class="dna-share-img" alt="Movie DNA"/>
                <div class="dna-share-actions">
                  <button class="btn-primary" id="dna-share-native">📤 ${this._t('Поділитися', 'Share')}</button>
                  <button class="btn-secondary" id="dna-share-download">📥 ${this._t('Завантажити PNG', 'Download PNG')}</button>
                  <button class="btn-secondary" id="dna-share-copy-link">🔗 ${this._t('Скопіювати посилання', 'Copy link')}</button>
                </div>
              </div>`;
            document.body.appendChild(modal);
            const close = () => modal.classList.add('hidden');
            modal.querySelector('.dna-share-close').addEventListener('click', close);
            modal.querySelector('.dna-share-overlay').addEventListener('click', close);
            modal.querySelector('#dna-share-download').addEventListener('click', () => this.downloadDNAShareCard());
            modal.querySelector('#dna-share-native').addEventListener('click', () => this.shareDNAShareCard());
            modal.querySelector('#dna-share-copy-link').addEventListener('click', () => this.copyDNAShareLink());
            // Close on Esc.
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
            });
        }
        modal.querySelector('.dna-share-img').src = url;
        modal.classList.remove('hidden');
    },
    /* Copy a public link to the user's profile (or site root) so the share
     * card can be paired with a clickable URL when posting. */
    async copyDNAShareLink() {
        let link = window.location.origin + '/';
        try {
            if (Auth && Auth.user && Auth.user.username) {
                link = window.location.origin + '/u/' + encodeURIComponent(Auth.user.username);
            }
        } catch (e) { }
        try {
            await navigator.clipboard.writeText(link);
            this._toast(this._t('Посилання скопійовано', 'Link copied'));
        } catch (e) {
            // fallback: select-and-prompt
            try { window.prompt(this._t('Скопіюй посилання вручну:', 'Copy this link:'), link); } catch (_) { }
        }
    },

    /* ──────────────────────────────────────────────────────────
     * Recommend a movie based on DNA
     * ────────────────────────────────────────────────────────── */
    async renderRecommendation(dna) {
        const host = document.getElementById('extras-recommend-body');
        if (!host) return;
        const d = dna || this._lastDNA;
        if (!d || !d.genres.length) {
            host.innerHTML = `<div class="extras-empty">${this._t('Підбери кілька фільмів — і я порекомендую щось саме тобі.', 'Pick a few movies first — then I’ll recommend something just for you.')}</div>`;
            return;
        }
        host.innerHTML = `<div class="extras-loading">${this._t('Підбираємо…', 'Picking…')}</div>`;
        const g = d.genres[0][0];
        try {
            const lang = (typeof I18N !== 'undefined' && I18N.current === 'en') ? 'en-US' : 'uk-UA';
            const res = await fetch(`${CONFIG.API_URL}/api/tmdb/search/movie?query=${encodeURIComponent(g)}&language=${lang}&page=1`);
            const data = await res.json();
            const items = (data.results || data.items || []).map(r => ({
                ...r,
                title: r.title || r.name || '',
                year: (r.release_date || '').slice(0, 4),
                poster: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : (r.poster || ''),
            }));
            // Avoid recently picked
            const seenIds = new Set();
            try { (await API.getHistory({ limit: 50 })).items.forEach(i => seenIds.add(String(i.id))); } catch (e) {}
            const cand = items.filter(it => !seenIds.has(String(it.id || it.tmdb_id)));
            const pool = cand.length ? cand : items;
            if (!pool.length) {
                host.innerHTML = `<div class="extras-empty">${this._t('Нічого не знайдено', 'Nothing found')}</div>`;
                return;
            }
            const pick = pool[Math.floor(Math.random() * Math.min(pool.length, 6))];
            const poster = this._normalizePoster(pick.poster, 'w342');
            host.innerHTML = `
              <div class="extras-rec-card" data-id="${this._esc(pick.id || pick.tmdb_id)}" data-type="${this._esc(pick.media_type || 'movie')}">
                ${poster ? `<img class="extras-rec-poster" src="${poster}" alt="${this._esc(pick.title || pick.name || '')}" loading="lazy">` : ''}
                <div class="extras-rec-info">
                  <div class="extras-rec-title">🎯 ${this._esc(pick.title || pick.name || '')}</div>
                  <div class="extras-rec-meta">${pick.year ? pick.year : ''}${pick.rating ? ' · ⭐ ' + pick.rating : ''}</div>
                  <div class="extras-rec-reason">${this._t('Бо ти любиш', 'Because you love')} <b>${this._trGenre(g)}</b></div>
                  <div class="extras-rec-actions">
                    <button class="btn-primary extras-rec-open">${this._t('Детальніше', 'Details')}</button>
                    <button class="btn-secondary extras-rec-shuffle">${this._t('Інше', 'Another')}</button>
                  </div>
                </div>
              </div>`;
            host.querySelector('.extras-rec-open').addEventListener('click', () => {
                if (typeof App !== 'undefined' && App.goToDetailPage) App.goToDetailPage(pick.id || pick.tmdb_id, pick.media_type || 'movie');
            });
            host.querySelector('.extras-rec-shuffle').addEventListener('click', () => this.renderRecommendation(d));
        } catch (e) {
            host.innerHTML = `<div class="extras-empty">${this._t('Помилка завантаження', 'Failed to load')}</div>`;
        }
    },

    /* ──────────────────────────────────────────────────────────
     * Кінозодіак (Cinema Zodiac)
     * ────────────────────────────────────────────────────────── */
    ZODIAC_SIGNS: [
        // 12 cinema zodiac signs — each tied to a genre archetype
        { id: 'noir',       symbol: '🎩', genre: 'crime',       name_uk: 'Скорпіон Нуару',   name_en: 'Noir Scorpion',     desc_uk: 'Тебе тягне до тіней і таємниць. Ти бачиш правду крізь дим сигарет і неонові вивіски.', desc_en: 'Drawn to shadows and secrets. You see the truth through cigarette smoke and neon signs.' },
        { id: 'melodrama',  symbol: '🌹', genre: 'romance',     name_uk: 'Телець Мелодрами', name_en: 'Melodrama Taurus',  desc_uk: 'Серце важче за всі сюжети. Ти любиш повільні погляди й листи, написані від руки.',         desc_en: 'Your heart is heavier than any plot. You love slow glances and handwritten letters.' },
        { id: 'blockbuster',symbol: '💥', genre: 'action',      name_uk: 'Лев Блокбастера',  name_en: 'Blockbuster Leo',   desc_uk: 'Чим більше — тим краще. Ти живеш у режимі IMAX і не вибачаєшся за це.',                  desc_en: 'Bigger is better. You live in IMAX and don’t apologize for it.' },
        { id: 'arthouse',   symbol: '🎭', genre: 'drama',       name_uk: 'Стрілець Артхаусу',name_en: 'Arthouse Sagittarius', desc_uk: 'Тиша між кадрами говорить тобі більше, ніж будь-який монолог.',                       desc_en: 'The silence between frames says more to you than any monologue.' },
        { id: 'fantasy',    symbol: '🐉', genre: 'fantasy',     name_uk: 'Риба Фентезі',     name_en: 'Fantasy Pisces',    desc_uk: 'Ти впізнаєш магію в звичайних речах. Карти світу читаєш як вірші.',                       desc_en: 'You recognize magic in ordinary things. You read maps like poetry.' },
        { id: 'scifi',      symbol: '🛸', genre: 'sci-fi',      name_uk: 'Водолій Фантастики',name_en: 'Sci-Fi Aquarius',  desc_uk: 'Майбутнє вже тут — просто нерівномірно розподілено. І ти живеш у його найкращій частині.', desc_en: 'The future is already here — just unevenly distributed. You live in the best part.' },
        { id: 'horror',     symbol: '🦇', genre: 'horror',      name_uk: 'Близнюк Жахів',    name_en: 'Horror Gemini',     desc_uk: 'Тобі цікаво те, від чого інші відводять погляд. Темрява для тебе — окремий жанр відпочинку.', desc_en: 'You’re curious about what others look away from. Darkness is your kind of vacation.' },
        { id: 'comedy',     symbol: '🤡', genre: 'comedy',      name_uk: 'Овен Комедії',     name_en: 'Comedy Aries',      desc_uk: 'Ти ламаєш четверту стіну в реальному житті. Сум для тебе — лише ще один панчлайн.',         desc_en: 'You break the fourth wall in real life. Sadness is just another punchline.' },
        { id: 'biopic',     symbol: '📜', genre: 'biography',   name_uk: 'Діва Біопіка',     name_en: 'Biopic Virgo',      desc_uk: 'Чужі долі для тебе — це підручник. Ти збираєш справжні історії, як інші — марки.',         desc_en: 'Other people’s lives are your textbook. You collect true stories like stamps.' },
        { id: 'animation',  symbol: '🎨', genre: 'animation',   name_uk: 'Терези Анімації',  name_en: 'Animation Libra',   desc_uk: 'Ти не виріс із малюнків — ти просто почав бачити більше барв.',                            desc_en: 'You didn’t outgrow cartoons — you just started seeing more colors.' },
        { id: 'thriller',   symbol: '🔪', genre: 'thriller',    name_uk: 'Козеріг Трилера',  name_en: 'Thriller Capricorn',desc_uk: 'Ти прораховуєш все на 3 ходи вперед. Спокій для тебе — підозрілий.',                        desc_en: 'You calculate three moves ahead. Calm makes you suspicious.' },
        { id: 'docu',       symbol: '🎙️', genre: 'documentary', name_uk: 'Рак Документалки', name_en: 'Doc Cancer',        desc_uk: 'Ти любиш, коли реальність дивує більше за вигадку. І завжди залишаєшся до титрів.',         desc_en: 'You love when reality outshines fiction. You always stay through the credits.' },
    ],
    ZODIAC_COMPAT: {
        noir:       { yes: ['melodrama', 'thriller', 'arthouse'], no: ['comedy', 'animation', 'blockbuster'] },
        melodrama:  { yes: ['noir', 'biopic', 'arthouse'],         no: ['horror', 'thriller', 'scifi'] },
        blockbuster:{ yes: ['comedy', 'fantasy', 'scifi'],         no: ['arthouse', 'noir', 'docu'] },
        arthouse:   { yes: ['noir', 'melodrama', 'docu'],          no: ['blockbuster', 'comedy', 'animation'] },
        fantasy:    { yes: ['scifi', 'animation', 'blockbuster'],  no: ['docu', 'biopic', 'noir'] },
        scifi:      { yes: ['fantasy', 'thriller', 'blockbuster'], no: ['melodrama', 'biopic', 'docu'] },
        horror:     { yes: ['thriller', 'noir'],                   no: ['melodrama', 'comedy', 'animation'] },
        comedy:     { yes: ['blockbuster', 'animation', 'fantasy'],no: ['horror', 'noir', 'arthouse'] },
        biopic:     { yes: ['arthouse', 'docu', 'melodrama'],      no: ['fantasy', 'scifi', 'horror'] },
        animation:  { yes: ['comedy', 'fantasy', 'family'],        no: ['noir', 'horror', 'arthouse'] },
        thriller:   { yes: ['noir', 'horror', 'scifi'],            no: ['comedy', 'animation', 'melodrama'] },
        docu:       { yes: ['biopic', 'arthouse'],                 no: ['fantasy', 'blockbuster', 'horror'] },
    },
    GENRE_TO_SIGN: {
        'action': 'blockbuster', 'adventure': 'blockbuster',
        'romance': 'melodrama',
        'crime': 'noir', 'mystery': 'noir',
        'drama': 'arthouse', 'history': 'arthouse', 'war': 'arthouse',
        'fantasy': 'fantasy',
        'sci-fi': 'scifi', 'science fiction': 'scifi',
        'horror': 'horror',
        'comedy': 'comedy', 'family': 'comedy', 'music': 'comedy',
        'biography': 'biopic',
        'animation': 'animation',
        'thriller': 'thriller',
        'documentary': 'docu',
    },
    computeZodiac(dna) {
        if (!dna || !dna.genres.length) return null;
        for (const [g, _] of dna.genres) {
            const sid = this.GENRE_TO_SIGN[g];
            if (sid) return this.ZODIAC_SIGNS.find(s => s.id === sid);
        }
        return this.ZODIAC_SIGNS[0];
    },
    async renderZodiac() {
        const host = document.getElementById('cinema-zodiac-body');
        if (!host) return;
        host.innerHTML = `<div class="zodiac-loading">${this._t('Рахуємо твій знак…', 'Reading your sign…')}</div>`;
        const dna = this._lastDNA || (await this.computeDNA());
        const sign = this.computeZodiac(dna);
        if (!sign) {
            host.innerHTML = `<div class="extras-empty">${this._t('Підбери кілька фільмів, щоб дізнатись свій кінозодіак.', 'Pick a few movies to discover your cinema zodiac.')}</div>`;
            return;
        }
        const compat = this.ZODIAC_COMPAT[sign.id] || { yes: [], no: [] };
        const toName = (id) => {
            const s = this.ZODIAC_SIGNS.find(x => x.id === id);
            return s ? `${s.symbol} ${this._isEn() ? s.name_en : s.name_uk}` : id;
        };
        host.innerHTML = `
          <div class="zodiac-card">
            <div class="zodiac-symbol">${sign.symbol}</div>
            <div class="zodiac-name">${this._isEn() ? sign.name_en : sign.name_uk}</div>
            <div class="zodiac-desc">${this._isEn() ? sign.desc_en : sign.desc_uk}</div>
            <div class="zodiac-compat">
              <div class="zodiac-compat-title">${this._t('Сумісний з', 'Compatible with')}</div>
              <div class="zodiac-compat-row zodiac-compat-yes">${compat.yes.map(toName).join(' · ') || '—'}</div>
              <div class="zodiac-compat-title">${this._t('Не сумісний з', 'Incompatible with')}</div>
              <div class="zodiac-compat-row zodiac-compat-no">${compat.no.map(toName).join(' · ') || '—'}</div>
            </div>
            <button class="btn-secondary zodiac-share-btn" id="zodiac-share-btn">📤 ${this._t('Поділитися', 'Share')}</button>
          </div>`;
        host.querySelector('#zodiac-share-btn').addEventListener('click', () => this.shareZodiac(sign));
    },
    async shareZodiac(sign) {
        const text = this._isEn()
            ? `🎬 I am ${sign.name_en} on Picksy ${sign.symbol}\n${sign.desc_en}`
            : `🎬 Я — ${sign.name_uk} на Picksy ${sign.symbol}\n${sign.desc_uk}`;
        const url = window.location.origin + '/';
        try {
            if (navigator.share) { await navigator.share({ text, url }); return; }
        } catch (e) {}
        try { await navigator.clipboard.writeText(text + '\n' + url); this._toast(this._t('Скопійовано', 'Copied')); } catch (e) {}
    },

    /* ──────────────────────────────────────────────────────────
     * Психоаналіз по фільмам (rule-based portrait)
     * ────────────────────────────────────────────────────────── */
    PSYCHO_RULES: [
        // pattern → uk + en sentence
        { test: d => (d.allMoods.dark || 0) > (d.allMoods.light || 0) * 2,
          uk: 'Ти йдеш у темряву там, де інші вмикають світло — бо там чесніше.',
          en: 'You walk into the dark where others switch on the light — because it’s more honest.' },
        { test: d => (d.allMoods.deep || 0) > (d.allMoods.high || 0) * 2,
          uk: 'Ти цінуєш не події, а паузи між ними — там ховається сенс.',
          en: 'You value the pauses, not the events — that’s where meaning hides.' },
        { test: d => (d.allMoods.high || 0) > (d.allMoods.deep || 0) * 2,
          uk: 'Тобі потрібен пульс. Тиша лякає тебе більше, ніж погоня.',
          en: 'You need a pulse. Silence scares you more than a chase.' },
        { test: d => d.types.book > (d.types.movie + d.types.tv) * 0.3,
          uk: 'Ти любиш слова більше за кадри. Власна уява — твій улюблений режисер.',
          en: 'You love words more than frames. Your imagination is your favorite director.' },
        { test: d => d.genres.find(([g]) => g === 'romance'),
          uk: 'Ти боїшся не самотності — а самотності в натовпі.',
          en: 'You don’t fear loneliness — you fear loneliness in a crowd.' },
        { test: d => d.genres.find(([g]) => g === 'thriller' || g === 'crime'),
          uk: 'Ти уникаєш історій, де герой зраджує близьких. Ймовірно, цінуєш лояльність понад усе.',
          en: 'You avoid stories where the hero betrays loved ones. You probably value loyalty above all.' },
        { test: d => d.genres.find(([g]) => g === 'documentary' || g === 'biography' || g === 'history'),
          uk: 'Реальність вражає тебе сильніше за вигадку — і ти більше довіряєш їй.',
          en: 'Reality shakes you more than fiction — and you trust it more.' },
        { test: d => d.genres.find(([g]) => g === 'fantasy' || g === 'sci-fi'),
          uk: 'У тебе всередині дитина, яка все ще шукає двері в інший світ.',
          en: 'There’s a child inside you who still looks for the door to another world.' },
        { test: d => (d.decades.find(([dec]) => dec >= 2010)),
          uk: 'Ти живеш у "тут і зараз" — хочеш бачити свою епоху, а не чужу.',
          en: 'You live in the "here and now" — you want to see your era, not someone else’s.' },
        { test: d => (d.decades.find(([dec]) => dec < 1990)),
          uk: 'Ти ностальгуєш за часами, у яких не жив. Це теж форма любові.',
          en: 'You long for times you never lived in. That’s a form of love too.' },
    ],
    async renderPsycho() {
        const host = document.getElementById('psycho-body');
        if (!host) return;
        host.innerHTML = `<div class="psycho-loading">${this._t('AI читає твою історію…', 'AI is reading your history…')}</div>`;
        const dna = this._lastDNA || (await this.computeDNA());
        if (!dna || dna.total < 3) {
            host.innerHTML = `<div class="extras-empty">${this._t('Потрібно щонайменше 3 переглянутих/збережених — і психоаналіз з’явиться.', 'Pick at least 3 titles and your psycho-portrait will appear here.')}</div>`;
            return;
        }
        const lines = [];
        for (const r of this.PSYCHO_RULES) {
            try { if (r.test(dna)) lines.push(this._isEn() ? r.en : r.uk); } catch (e) {}
        }
        if (!lines.length) lines.push(this._isEn() ? 'Your taste resists labels — that says something.' : 'Твій смак не хоче ярликів — це теж щось означає.');
        const closing = this._isEn()
            ? 'This is just a mirror — not a verdict. Take what resonates.'
            : 'Це лише дзеркало — не вирок. Бери те, що відгукується.';
        host.innerHTML = `
          <div class="psycho-card">
            <div class="psycho-quote-mark">"</div>
            <ul class="psycho-list">
              ${lines.slice(0, 5).map(l => `<li>${this._esc(l)}</li>`).join('')}
            </ul>
            <div class="psycho-closing">${this._esc(closing)}</div>
            <div class="psycho-actions">
              <button class="btn-secondary" id="psycho-copy">📋 ${this._t('Скопіювати', 'Copy')}</button>
              <button class="btn-secondary" id="psycho-share">📤 ${this._t('Поділитися', 'Share')}</button>
              <button class="btn-secondary" id="psycho-refresh">🔄 ${this._t('Оновити', 'Refresh')}</button>
            </div>
          </div>`;
        host.querySelector('#psycho-copy').addEventListener('click', () => this._copyPsycho(lines));
        host.querySelector('#psycho-share').addEventListener('click', () => this._sharePsycho(lines));
        host.querySelector('#psycho-refresh').addEventListener('click', () => this.renderPsycho());
    },
    async _copyPsycho(lines) {
        const txt = '🧠 ' + this._t('Психоаналіз по фільмам · Picksy', 'Movie Psychoanalysis · Picksy') + '\n\n• ' + lines.join('\n• ') + '\n\n' + window.location.origin;
        try { await navigator.clipboard.writeText(txt); this._toast(this._t('Скопійовано', 'Copied')); } catch (e) {}
    },
    async _sharePsycho(lines) {
        const txt = '🧠 ' + this._t('Це про мене', 'This is about me') + ':\n• ' + lines.join('\n• ');
        try { if (navigator.share) { await navigator.share({ text: txt + '\n' + window.location.origin }); return; } } catch (e) {}
        this._copyPsycho(lines);
    },

    /* ──────────────────────────────────────────────────────────
     * Visibility toggles for psycho/zodiac on public profile
     * ────────────────────────────────────────────────────────── */
    initVisibilityToggles() {
        const wireToggle = (toggleId, storeKey, sectionId) => {
            const t = document.getElementById(toggleId);
            if (!t || t.dataset.bound === '1') return;
            t.dataset.bound = '1';
            const stored = this._getStore(storeKey, true);
            t.checked = stored !== false;
            const apply = () => {
                this._setStore(storeKey, !!t.checked);
                const sec = document.getElementById(sectionId);
                if (sec) sec.classList.toggle('profile-section-hidden', !t.checked);
            };
            apply();
            t.addEventListener('change', apply);
        };
        wireToggle('toggle-show-psycho',   'show_psycho',   'psycho-section');
        wireToggle('toggle-show-zodiac',   'show_zodiac',   'zodiac-section');
        wireToggle('toggle-show-dna',      'show_dna',      'movie-dna-section');
        wireToggle('toggle-show-recs',     'show_recs',     'extras-recommend-section');
        wireToggle('toggle-show-top',      'show_top',      null);
        wireToggle('toggle-show-showcase', 'show_showcase', null);
    },

    /* ──────────────────────────────────────────────────────────
     * Make gift history + profile history clickable (→ desc page)
     * ────────────────────────────────────────────────────────── */
    interceptGiftHistoryClicks() {
        // Use event delegation since gift history list is rebuilt on each load
        document.addEventListener('click', (e) => {
            const link = e.target.closest && e.target.closest('.gift-history-item');
            if (!link) return;
            const wrap = link.closest('.gift-history-list');
            if (!wrap) return;
            // We expect data-link to be a gift link (gift token). We instead derive
            // the desc URL from data-itemid + data-itemtype if present.
            const id = link.dataset.itemid;
            const type = link.dataset.itemtype;
            if (id && type) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation && e.stopImmediatePropagation();
                this._goToDesc(id, type);
            }
        }, true);
    },
    _goToDesc(id, type) {
        if (!id || !type) return;
        const lang = (typeof I18N !== 'undefined' && I18N.current) || 'uk';
        const prefix = type === 'tv' ? 'desctv' : (type === 'book' ? 'descbook' : 'descmovie');
        // Close any open modals
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        document.body.style.overflow = '';
        window.location.href = `/${prefix}/${encodeURIComponent(id)}?lang=${lang}`;
    },
    enrichProfileHistoryClicks() {
        // Whenever the profile history list re-renders, attach click handlers
        const list = document.getElementById('profile-history-list');
        if (!list) return;
        if (list.dataset.bound === '1') return;
        list.dataset.bound = '1';
        list.addEventListener('click', (e) => {
            // ignore the small ↗ external link
            if (e.target.closest && e.target.closest('.phi-link')) return;
            const item = e.target.closest && e.target.closest('.profile-history-item');
            if (!item) return;
            // The history item doesn’t carry id/type by default — fetch from the underlying API call
            // We expose data attributes via a MutationObserver / wrap below.
            const id = item.dataset.itemid;
            const type = item.dataset.itemtype;
            if (id && type) {
                e.preventDefault();
                this._goToDesc(id, type);
            }
        });
        // Patch Auth._loadHistoryPage so each created item carries data-itemid / data-itemtype.
        try {
            if (typeof Auth !== 'undefined' && Auth._loadHistoryPage && !Auth.__patchedForExtras) {
                Auth.__patchedForExtras = true;
                const orig = Auth._loadHistoryPage.bind(Auth);
                Auth._loadHistoryPage = async function (replace) {
                    const result = await orig(replace);
                    try {
                        // After render, hydrate data-itemid/itemtype + cursor pointer
                        const list = document.getElementById('profile-history-list');
                        if (!list) return result;
                        list.querySelectorAll('.profile-history-item').forEach(el => {
                            if (el.dataset.itemid) return;
                            const titleEl = el.querySelector('.phi-title');
                            const linkEl = el.querySelector('.phi-link');
                            // Use the (only present) link href to extract id if available
                            // Else, try to read from a recent items array we fetched
                        });
                    } catch (e) {}
                    return result;
                };
            }
        } catch (e) {}
    },
    // Wrap API.getHistory so we keep a memo of items on the page
    interceptAPIGetHistory() {
        if (typeof API === 'undefined' || API.__getHistoryWrapped) return;
        API.__getHistoryWrapped = true;
        const orig = API.getHistory.bind(API);
        API.getHistory = async (...args) => {
            const data = await orig(...args);
            try {
                if (data && data.items && data.items.length) {
                    Extras._lastHistoryItems = (Extras._lastHistoryItems || []).concat(data.items);
                    // After current microtask, hydrate the list DOM
                    setTimeout(() => Extras._hydrateProfileHistoryDom(), 50);
                }
            } catch (e) {}
            return data;
        };
    },
    _hydrateProfileHistoryDom() {
        const list = document.getElementById('profile-history-list');
        if (!list) return;
        const items = this._lastHistoryItems || [];
        if (!items.length) return;
        const els = list.querySelectorAll('.profile-history-item');
        els.forEach((el, i) => {
            // Match by title (best-effort) since the rendering code doesn’t set ids
            const titleEl = el.querySelector('.phi-title');
            if (!titleEl) return;
            const tx = titleEl.textContent.replace(/^[^\s]+\s/, '').trim();
            const match = items.find(it => (it.title || '').trim() === tx);
            if (!match) return;
            el.dataset.itemid = String(match.item_id || match.tmdb_id || match.id || '');
            el.dataset.itemtype = String(match.type || match.media_type || 'movie');
            el.classList.add('is-clickable');
            el.style.cursor = 'pointer';
        });
    },

    /* ──────────────────────────────────────────────────────────
     * Build / refresh the entire profile-modal tab on open
     * ────────────────────────────────────────────────────────── */
    onProfileOpen() {
        try {
            this.initColorPalette();
            this.initDeviceUpload();
            this.rebindProfileSearches();
            this.initVisibilityToggles();
            this.enrichProfileHistoryClicks();
            this.interceptAPIGetHistory();
            this._hydrateProfileHistoryDom();
            // Pull existing recommendations from the server so the user
            // sees their previously saved picks (and can remove them with
            // the × button). Previously this was wired up but never
            // called from anywhere, so the list always appeared empty.
            this._hydrateProfileRecs();
            this.renderDNA();
            this.renderPsycho();
            this.renderZodiac();
            this._wireDnaActions();
        } catch (e) { console.warn('Extras.onProfileOpen', e); }
        // Re-render DNA and refresh color locks when the tier changes (e.g. user
        // upgraded / downgraded while the modal is open).
        if (!this._tierExtrasListenerBound) {
            this._tierExtrasListenerBound = true;
            try {
                document.addEventListener('picksy:tier-changed', () => {
                    try { this._refreshColorPaletteLocks(); } catch (e) { }
                    try { this.renderDNA(); } catch (e) { }
                });
            } catch (e) { }
        }
    },
    _wireDnaActions() {
        const dl = document.getElementById('dna-share-download-btn');
        const sh = document.getElementById('dna-share-share-btn');
        const pr = document.getElementById('dna-share-preview-btn');
        if (dl && dl.dataset.bound !== '1') { dl.dataset.bound = '1'; dl.addEventListener('click', () => this.downloadDNAShareCard()); }
        if (sh && sh.dataset.bound !== '1') { sh.dataset.bound = '1'; sh.addEventListener('click', () => this.shareDNAShareCard()); }
        if (pr && pr.dataset.bound !== '1') { pr.dataset.bound = '1'; pr.addEventListener('click', () => this.previewDNAShareCard()); }
    },

    /* ──────────────────────────────────────────────────────────
     * Init
     * ────────────────────────────────────────────────────────── */
    init() {
        // Apply persisted color theme on load
        const colors = this._getStore('profile_colors', null);
        if (colors && colors.a) this.applyProfileColors(colors);
        // Apply persisted banner / avatar on load
        const banner = this._getStore('profile_banner_data', null);
        if (banner) this._applyBannerToProfile(banner);
        const avatar = this._getStore('profile_avatar_data', null);
        if (avatar) this._applyAvatarToProfile(avatar);
        this.interceptGiftHistoryClicks();
        this.interceptAPIGetHistory();
        // Open profile hook
        const profileBtn = document.getElementById('profile-open-btn') || document.getElementById('user-profile-btn');
        const modal = document.getElementById('profile-modal');
        if (modal) {
            // Observe modal class to detect open
            const obs = new MutationObserver(() => {
                if (!modal.classList.contains('hidden')) this.onProfileOpen();
            });
            obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
            if (!modal.classList.contains('hidden')) this.onProfileOpen();
        }
        if (profileBtn) profileBtn.addEventListener('click', () => setTimeout(() => this.onProfileOpen(), 50));
        // Wire up the gift button on the desc card. The Gift module exists as a
        // global, but no wiring was previously in place — clicking did nothing.
        this._wireGiftButton();
    },

    /* ──────────────────────────────────────────────────────────
     * Gift button wiring
     * ────────────────────────────────────────────────────────── */
    _wireGiftButton() {
        const btn = document.getElementById('gift-btn');
        if (!btn || btn.dataset.giftWired === '1') return;
        btn.dataset.giftWired = '1';
        btn.addEventListener('click', () => this._openGiftForCurrentItem());
        this._updateGiftBtnVisibility();
        try {
            document.addEventListener('picksy:tier-changed', () => this._updateGiftBtnVisibility());
        } catch (e) { }
    },
    _hasMovieGifts() {
        try {
            if (typeof Subscription !== 'undefined' && typeof Subscription.hasMovieGifts === 'function') {
                return !!Subscription.hasMovieGifts();
            }
        } catch (e) { }
        return true;
    },
    _updateGiftBtnVisibility() {
        const btn = document.getElementById('gift-btn');
        if (!btn) return;
        btn.style.display = this._hasMovieGifts() ? '' : 'none';
    },
    _openGiftForCurrentItem() {
        const item = (typeof App !== 'undefined' && App.currentItem) || null;
        let type = (typeof App !== 'undefined' && App.currentType) || null;
        if (!type && item) {
            if (item.media_type === 'tv' || item.first_air_date || item.type === 'tv') type = 'tv';
            else if (item.media_type === 'book' || item.author || item.type === 'book') type = 'book';
            else type = 'movie';
        }
        if (!item) {
            this._toast(this._t('Спочатку відкрий фільм', 'Open a movie first'));
            return;
        }
        // Premium+/Pro feature when freemium is enabled.
        if (!this._hasMovieGifts()) {
            this._toast(this._t('🎁 Movie Gifts — на Premium та Pro. Оновіть підписку!', '🎁 Movie Gifts — Premium and Pro only. Upgrade your subscription!'));
            try { Subscription.showUpgradeModal && Subscription.showUpgradeModal(); } catch (e) { }
            return;
        }
        if (typeof Gift !== 'undefined' && Gift.open) {
            try { Gift.open(item, type || 'movie'); return; } catch (e) { console.error('Gift.open failed', e); }
        }
        this._toast(this._t('Подарунок недоступний', 'Gift unavailable'));
    },
};

window.Extras = Extras;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Extras.init());
} else {
    Extras.init();
}
})();
