// @ts-nocheck
const Subscription = {
    tier: 'pro',
    freemiumEnabled: false,
    picksToday: 0,
    picksLimit: 6,
    savedTotal: 0,
    saveLimit: 20,
    plans: [],
    trialEnabled: false,
    trialDays: 7,
    trialUsed: false,
    paymentUrl: '',
    expiresAt: null,

    init() {
        const prevTier = this.tier;
        this.freemiumEnabled = API.siteSettings?.freemium_enabled || false;
        if (!this.freemiumEnabled) {
            this.tier = 'pro';
            // Tear down any UI that was previously gated/locked: every feature
            // should be available when the subscription system is admin-disabled.
            this.applyTierGates();
            this.hideBannersForPro();
            const banner = document.getElementById('sub-plans-banner');
            if (banner) banner.classList.add('hidden');
            const tierBadge = document.getElementById('sub-tier-badge');
            if (tierBadge) tierBadge.remove();
            const limitsBar = document.getElementById('freemium-limits-bar');
            if (limitsBar) limitsBar.remove();
            if (prevTier !== this.tier) this._fireTierChanged();
            return;
        }
        if (Auth.user) {
            this.tier = Auth.user.tier || 'free';
            this.picksToday = Auth.user.picks_today || 0;
            this.picksLimit = Auth.user.picks_limit || 6;
            this.savedTotal = Auth.user.saved_total || 0;
            this.saveLimit = Auth.user.save_limit || 20;
        } else {
            this.tier = 'free';
        }
        this.renderBadge();
        this.showPlansBanner();
        this.loadPlans();
        this.hideBannersForPro();
        this.applyTierGates();
        if (prevTier !== this.tier) this._fireTierChanged();
        // Pull expires_at + fresh tier so the mini-profile can show
        // remaining-days even on the first profile open.
        this.refresh();
    },

    async refresh() {
        if (!this.freemiumEnabled || !Auth.token) return;
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/subscription`, {
                headers: Auth.getAuthHeaders(),
            });
            if (res.ok) {
                const d = await res.json();
                const prevTier = this.tier;
                this.tier = d.tier || 'free';
                this.picksToday = d.picks_today || 0;
                this.picksLimit = d.picks_limit || 6;
                this.savedTotal = d.saved_total || 0;
                this.saveLimit = d.save_limit || 20;
                this.trialUsed = d.trial_used || false;
                this.expiresAt = d.expires_at || null;
                this.renderBadge();
                this.hideBannersForPro();
                this.applyTierGates();
                if (prevTier !== this.tier) this._fireTierChanged();
            }
        } catch {}
    },

    _fireTierChanged() {
        try {
            document.dispatchEvent(new CustomEvent('picksy:tier-changed', {
                detail: { tier: this.tier, freemiumEnabled: this.freemiumEnabled },
            }));
        } catch (e) { /* ignore */ }
    },

    async loadPlans() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/subscription/plans`);
            if (res.ok) {
                const d = await res.json();
                this.plans = d.plans || [];
                this.trialEnabled = d.trial_enabled || false;
                this.trialDays = d.trial_days || 7;
                this.paymentUrl = d.payment_url || '';
            }
        } catch {}
    },

    getTier() {
        return this.freemiumEnabled ? this.tier : 'pro';
    },

    getExpiresAt() {
        if (!this.expiresAt) return null;
        const d = new Date(String(this.expiresAt).replace(' ', 'T') + (String(this.expiresAt).endsWith('Z') ? '' : 'Z'));
        return isNaN(d.getTime()) ? null : d;
    },

    getRemainingDays() {
        const d = this.getExpiresAt();
        if (!d) return null;
        const ms = d.getTime() - Date.now();
        if (ms <= 0) return 0;
        return Math.ceil(ms / (1000 * 60 * 60 * 24));
    },

    formatExpiryHTML() {
        const days = this.getRemainingDays();
        const d = this.getExpiresAt();
        if (days === null || !d) return '';
        const dateStr = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
        if (days === 0) return `<span style="color:#fbbf24;font-weight:700">⏰ Закінчується сьогодні</span>`;
        if (days <= 3) return `<span style="color:#f87171;font-weight:700">⏰ Залишилось ${days} ${days === 1 ? 'день' : days < 5 ? 'дні' : 'днів'}</span> · до ${dateStr}`;
        return `<span style="color:rgba(255,255,255,.6)">Активна ще ${days} ${days === 1 ? 'день' : days < 5 ? 'дні' : 'днів'}</span> · до ${dateStr}`;
    },

    canPick() {
        if (!this.freemiumEnabled) return true;
        if (this.tier !== 'free') return true;
        return this.picksToday < this.picksLimit;
    },

    canSave() {
        if (!this.freemiumEnabled) return true;
        if (this.tier !== 'free') return true;
        return this.savedTotal < this.saveLimit;
    },

    canUseAI() {
        if (!this.freemiumEnabled) return true;
        return this.tier === 'premium' || this.tier === 'pro';
    },

    hasNoAds() {
        if (!this.freemiumEnabled) return true;
        return this.tier === 'premium' || this.tier === 'pro';
    },

    hasApiAccess() {
        if (!this.freemiumEnabled) return true;
        return this.tier === 'pro';
    },

    hasCollections() {
        if (!this.freemiumEnabled) return true;
        return this.tier === 'premium' || this.tier === 'pro';
    },

    hasMovieGifts() {
        if (!this.freemiumEnabled) return true;
        return this.tier === 'premium' || this.tier === 'pro';
    },

    hasMovieDna() {
        if (!this.freemiumEnabled) return true;
        return this.tier === 'premium' || this.tier === 'pro';
    },

    hasPsychoanalysis() {
        if (!this.freemiumEnabled) return true;
        return this.tier === 'premium' || this.tier === 'pro';
    },

    hasZodiac() {
        if (!this.freemiumEnabled) return true;
        return true; // available on all tiers per backend defaults
    },

    hasCustomBanner() {
        if (!this.freemiumEnabled) return true;
        return this.tier === 'premium' || this.tier === 'pro';
    },

    hasAdvancedBadges() {
        if (!this.freemiumEnabled) return true;
        return this.tier === 'premium' || this.tier === 'pro';
    },

    /* Number of profile-color presets the current tier may pick from.
     *   Free → 3   (the first 3 chips)
     *   Premium / Pro → all 12
     *   Freemium admin-disabled → all 12 */
    getProfileColorLimit() {
        if (!this.freemiumEnabled) return 12;
        if (this.tier === 'premium' || this.tier === 'pro') return 12;
        return 3;
    },

    /* Number of badges a user may showcase on their profile.
     *   Free → 1
     *   Premium / Pro → 5
     *   Freemium admin-disabled → 5 */
    getShowcaseBadgeLimit() {
        if (!this.freemiumEnabled) return 5;
        if (this.tier === 'premium' || this.tier === 'pro') return 5;
        return 1;
    },

    /* Walk every element with data-tier-required="premium" (or "pro")
     * and apply a tier gate. By default the element stays visible but is
     * "locked": dimmed, non-interactive, with a clickable "Upgrade" banner
     * over it. Set data-tier-mode="hide" on the element to keep the legacy
     * hide-completely behaviour. */
    applyTierGates() {
        try {
            const els = document.querySelectorAll('[data-tier-required]');
            const tier = this.tier;
            const freemium = !!this.freemiumEnabled;
            const isEn = this._isEn();
            els.forEach(el => {
                const node = el as HTMLElement;
                const need = (node.dataset.tierRequired || '').toLowerCase();
                const mode = (node.dataset.tierMode || 'lock').toLowerCase();
                let allowed = true;
                if (freemium) {
                    if (need === 'premium') allowed = (tier === 'premium' || tier === 'pro');
                    else if (need === 'pro') allowed = (tier === 'pro');
                }
                if (allowed) {
                    this._unlockTierEl(node);
                    if (mode === 'hide') node.style.display = '';
                    return;
                }
                if (mode === 'hide') {
                    this._unlockTierEl(node);
                    node.style.display = 'none';
                    return;
                }
                node.style.display = '';
                this._lockTierEl(node, need, isEn);
            });
        } catch (e) { /* ignore */ }
    },

    _isEn() {
        try {
            return (typeof I18N !== 'undefined' && I18N && I18N.current === 'en');
        } catch (e) { return false; }
    },

    _lockTierEl(node, need, isEn) {
        node.classList.add('tier-locked');
        node.dataset.tierLocked = '1';
        node.setAttribute('aria-disabled', 'true');
        // Disable any form fields inside so clicks/key presses can't change them
        // while locked. We remember which were already disabled so unlocking
        // can restore the original state.
        try {
            const fields = node.querySelectorAll('input, select, textarea, button');
            fields.forEach((f) => {
                const el = f as HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement;
                if (el.classList.contains('tier-locked-banner')) return;
                if ((el as any).dataset && !(el as any).dataset.tierLockedFromDisabled) {
                    (el as any).dataset.tierLockedFromDisabled = el.disabled ? '1' : '0';
                }
                el.disabled = true;
            });
        } catch (e) { /* ignore */ }
        const tierLabel = need === 'pro' ? 'Pro' : 'Premium';
        const rich = node.dataset && node.dataset.tierRich === '1';
        const title = isEn
            ? `${tierLabel}-only feature`
            : `Доступно з ${tierLabel}`;
        const cta = isEn ? 'Get subscription →' : 'Купити підписку →';
        let banner = node.querySelector(':scope > .tier-locked-banner') as HTMLElement | null;
        if (!banner) {
            banner = document.createElement('button');
            banner.type = 'button';
            banner.className = rich ? 'tier-locked-banner tier-locked-banner-rich' : 'tier-locked-banner';
            banner.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                try { this.showUpgradeModal(); } catch (e) { /* ignore */ }
            });
            node.appendChild(banner);
        } else if (rich) {
            banner.classList.add('tier-locked-banner-rich');
        }
        if (rich) {
            // Larger, more cinematic Premium overlay used for headline
            // sections (e.g. AI search). Content + animation is wired up in
            // CSS via .tier-locked-banner-rich.
            const richTitle = isEn
                ? `Unlock AI search with ${tierLabel}`
                : `Розблокуй AI-пошук з ${tierLabel}`;
            const richSub = isEn
                ? 'Describe a mood or vibe — Picksy AI finds the perfect movie, show or book.'
                : 'Опиши настрій чи ідею — Picksy AI підбере ідеальний фільм, серіал або книгу.';
            const richCta = isEn ? `Upgrade to ${tierLabel}` : `Купити ${tierLabel}`;
            banner.innerHTML = `
                <span class="tier-locked-banner-glow" aria-hidden="true"></span>
                <span class="tier-locked-banner-sparkles" aria-hidden="true">
                    <span class="tier-spark tier-spark-1">✦</span>
                    <span class="tier-spark tier-spark-2">✧</span>
                    <span class="tier-spark tier-spark-3">✦</span>
                    <span class="tier-spark tier-spark-4">✧</span>
                </span>
                <span class="tier-locked-banner-icon tier-locked-banner-icon-rich" aria-hidden="true">🔒</span>
                <span class="tier-locked-banner-text">
                    <strong class="tier-locked-banner-title tier-locked-banner-title-rich">${richTitle}</strong>
                    <span class="tier-locked-banner-sub">${richSub}</span>
                </span>
                <span class="tier-locked-banner-cta tier-locked-banner-cta-rich">${richCta} →</span>
            `;
        } else {
            banner.innerHTML = `
                <span class="tier-locked-banner-icon" aria-hidden="true">🔒</span>
                <span class="tier-locked-banner-text">
                    <strong class="tier-locked-banner-title">${title}</strong>
                    <span class="tier-locked-banner-cta">${cta}</span>
                </span>
            `;
        }
    },

    _unlockTierEl(node) {
        if (!node.dataset.tierLocked) return;
        node.classList.remove('tier-locked');
        delete node.dataset.tierLocked;
        node.removeAttribute('aria-disabled');
        try {
            const fields = node.querySelectorAll('input, select, textarea, button');
            fields.forEach((f) => {
                const el = f as HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement;
                if (el.classList.contains('tier-locked-banner')) return;
                const wasDisabled = (el as any).dataset && (el as any).dataset.tierLockedFromDisabled === '1';
                if ((el as any).dataset && (el as any).dataset.tierLockedFromDisabled !== undefined) {
                    delete (el as any).dataset.tierLockedFromDisabled;
                }
                el.disabled = !!wasDisabled;
            });
        } catch (e) { /* ignore */ }
        const banner = node.querySelector(':scope > .tier-locked-banner');
        if (banner && banner.parentNode === node) banner.parentNode.removeChild(banner);
    },

    hideBannersForPro() {
        if (!this.freemiumEnabled) return;
        if (this.tier === 'pro') {
            const bannerIds = ['promo-banner', 'top-banner-bar', 'bottom-ad-box', 'sub-plans-banner'];
            bannerIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            document.querySelectorAll('.promo-banner, .top-banner-bar, .bottom-ad-box').forEach(el => {
                (el as HTMLElement).style.display = 'none';
            });
        }
    },

    showPlansBanner() {
        const banner = document.getElementById('sub-plans-banner');
        if (!banner) return;
        if (!this.freemiumEnabled) {
            banner.classList.add('hidden');
            return;
        }
        if (this.tier === 'pro') {
            banner.classList.add('hidden');
            return;
        }
        if (!Auth.user || this.tier === 'free') {
            banner.classList.remove('hidden');
            const limitsBar = document.getElementById('freemium-limits-bar');
            if (limitsBar) {
                const bannerDesc = banner.querySelector('.sub-plans-banner-desc');
                if (bannerDesc && this.tier === 'free') {
                    const picksLeft = Math.max(0, this.picksLimit - this.picksToday);
                    const savesLeft = Math.max(0, this.saveLimit - this.savedTotal);
                    bannerDesc.textContent = `🎬 ${picksLeft}/${this.picksLimit} підборів · 💾 ${savesLeft}/${this.saveLimit} збережень · Оновіть для необмеженого доступу`;
                }
                limitsBar.remove();
            }
        } else {
            banner.classList.add('hidden');
        }
    },

    renderBadge() {
        const existing = document.getElementById('sub-tier-badge');
        if (existing) existing.remove();

        if (!this.freemiumEnabled || !Auth.user) return;

        const badge = document.createElement('span');
        badge.id = 'sub-tier-badge';
        badge.className = `tier-badge tier-${this.tier}`;

        const labels = { free: 'Free', premium: 'Premium', pro: 'Pro' };
        badge.textContent = labels[this.tier] || 'Free';
        badge.addEventListener('click', () => this.showUpgradeModal());

        const gameBtn = document.getElementById('game-open-btn');
        const headerLeft = document.querySelector('.header-left');
        if (gameBtn && gameBtn.parentNode) {
            gameBtn.parentNode.insertBefore(badge, gameBtn.nextSibling);
        } else if (headerLeft) {
            headerLeft.appendChild(badge);
        }

        if (this.tier === 'free') {
            this.renderLimitsBar();
        } else {
            const limitsBar = document.getElementById('freemium-limits-bar');
            if (limitsBar) limitsBar.remove();
        }
    },

    renderLimitsBar() {
        let bar = document.getElementById('freemium-limits-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'freemium-limits-bar';
            bar.className = 'freemium-limits-bar';
            const subBanner = document.getElementById('sub-plans-banner');
            if (subBanner && !subBanner.classList.contains('hidden')) {
                const bannerDesc = subBanner.querySelector('.sub-plans-banner-desc');
                if (bannerDesc) {
                    const picksLeft = Math.max(0, this.picksLimit - this.picksToday);
                    const savesLeft = Math.max(0, this.saveLimit - this.savedTotal);
                    bannerDesc.textContent = `🎬 ${picksLeft}/${this.picksLimit} підборів · 💾 ${savesLeft}/${this.saveLimit} збережень · Оновіть для необмеженого доступу`;
                }
                return;
            }
            const main = document.querySelector('main');
            if (main) main.prepend(bar);
        }
        const picksLeft = Math.max(0, this.picksLimit - this.picksToday);
        const savesLeft = Math.max(0, this.saveLimit - this.savedTotal);
        bar.innerHTML = `
            <div class="freemium-limits-inner">
                <span class="freemium-limit-item">🎬 ${picksLeft}/${this.picksLimit} підборів</span>
                <span class="freemium-limit-item">💾 ${savesLeft}/${this.saveLimit} збережень</span>
                <button class="freemium-upgrade-btn" onclick="Subscription.showUpgradeModal()">⬆ Upgrade</button>
            </div>
        `;
    },

    _t(uk, en) {
        try {
            if (typeof I18N !== 'undefined' && I18N && I18N.current === 'en') return en;
        } catch (e) { }
        return uk;
    },

    showUpgradeModal() {
        if (!this.freemiumEnabled) return;
        let modal = document.getElementById('upgrade-modal');
        if (modal) { modal.classList.remove('hidden'); this.renderPlans(); return; }

        const t = (uk, en) => this._t(uk, en);
        const expiryHtml = (this.tier === 'premium' || this.tier === 'pro') ? this.formatExpiryHTML() : '';

        modal = document.createElement('div');
        modal.id = 'upgrade-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('upgrade-modal').classList.add('hidden')"></div>
            <div class="modal-card glass-deep upgrade-modal-card">
                <button class="modal-close" onclick="document.getElementById('upgrade-modal').classList.add('hidden')">&times;</button>
                <div class="upgrade-hero">
                    <div class="upgrade-hero-icon">✨</div>
                    <h2 class="upgrade-title">${t('Обери свій Picksy', 'Choose your Picksy')}</h2>
                    <p class="upgrade-subtitle">${t('Більше підборів, AI-пошук, колекції, без реклами.', 'More picks, AI search, collections, no ads.')}</p>
                    ${expiryHtml ? `<div class="upgrade-current-expiry">${expiryHtml}</div>` : ''}
                </div>
                ${this.trialEnabled && this.tier === 'free' && !this.trialUsed ? `
                    <div class="trial-banner" onclick="Subscription.startTrial()">
                        <span class="trial-banner-icon">🎁</span>
                        <div class="trial-banner-text">
                            <strong>${t(`Спробуй Premium безкоштовно ${this.trialDays} днів!`, `Try Premium free for ${this.trialDays} days!`)}</strong>
                            <small>${t('Без оплати. Одноразово на акаунт.', 'No payment. One-time per account.')}</small>
                        </div>
                        <button class="trial-banner-btn">${t('Активувати', 'Activate')}</button>
                    </div>
                ` : ''}
                ${this.trialUsed && this.tier === 'free' ? `
                    <div class="trial-banner trial-used">
                        <span class="trial-banner-icon">✅</span>
                        <div class="trial-banner-text">
                            <strong>${t('Пробний період вже використано', 'Trial already used')}</strong>
                            <small>${t('Безкоштовний trial доступний лише один раз на акаунт.', 'Free trial is available only once per account.')}</small>
                        </div>
                    </div>
                ` : ''}
                <div class="plans-grid" id="plans-grid"></div>
                <div class="upgrade-footnote">
                    <span>🔒 ${t('Безпечні платежі', 'Secure payments')}</span>
                    <span>·</span>
                    <span>↻ ${t('Скасувати в будь-який момент', 'Cancel anytime')}</span>
                    <span>·</span>
                    <span>🇺🇦 ${t('Підтримка українських розробників', 'Support Ukrainian developers')}</span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.renderPlans();
    },

    renderPlans() {
        const grid = document.getElementById('plans-grid');
        if (!grid) return;

        const t = (uk, en) => this._t(uk, en);
        const premiumPlan = this.plans.find(p => p.tier === 'premium');
        const proPlan = this.plans.find(p => p.tier === 'pro');

        const planConfigs = [
            {
                tier: 'free',
                name: 'Free',
                price: '$0',
                priceSub: t('назавжди', 'forever'),
                icon: '🆓',
                features: [
                    t(`${this.picksLimit} підборів на день`, `${this.picksLimit} picks per day`),
                    t('Базові фільтри', 'Basic filters'),
                    t(`До ${this.saveLimit} збережень`, `Up to ${this.saveLimit} saves`),
                    t('Кінозодіак', 'Cinema Zodiac'),
                ],
                missing: [
                    t('AI-пошук', 'AI search'),
                    t('Колекції', 'Collections'),
                    t('🎁 Movie Gifts', '🎁 Movie Gifts'),
                    t('🧬 Movie DNA', '🧬 Movie DNA'),
                    t('Без реклами', 'No ads'),
                ],
            },
            {
                tier: 'premium',
                name: 'Premium',
                icon: '⭐',
                pricing: premiumPlan?.pricing || { '7': 0.99, '14': 1.99, '30': 2.99 },
                features: [
                    t('Необмежений підбір', 'Unlimited picks'),
                    t('AI-пошук', 'AI search'),
                    t('Колекції + спільне редагування', 'Collections + collab editing'),
                    t('🎁 Movie Gifts', '🎁 Movie Gifts'),
                    t('🧬 Movie DNA + 🧠 Психоаналіз', '🧬 Movie DNA + 🧠 Psychoanalysis'),
                    t('Кастомний аватар і банер', 'Custom avatar & banner'),
                    t('До 5 бейджів у вітрині', 'Up to 5 badges showcase'),
                    t('Необмежені збереження', 'Unlimited saves'),
                ],
                missing: [
                    t('API-доступ', 'API access'),
                    t('Пріоритетна підтримка', 'Priority support'),
                ],
                popular: true,
            },
            {
                tier: 'pro',
                name: 'Pro',
                icon: '🚀',
                pricing: proPlan?.pricing || { '7': 1.99, '14': 3.49, '30': 4.99 },
                features: [
                    t('Усе з Premium', 'Everything in Premium'),
                    t('Без банерів та реклами', 'No banners or ads'),
                    t('API-доступ', 'API access'),
                    t('Статистика переглядів', 'View statistics'),
                    t('Пріоритет AI', 'Priority AI'),
                    t('Пріоритетна підтримка', 'Priority support'),
                ],
                missing: [],
                bestValue: true,
            },
        ];

        const fmtPrice = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
        const calcSave = (pricing) => {
            // Compare per-day cost of 30d vs 7d. Round to nearest 5%.
            const p7 = pricing['7'];
            const p30 = pricing['30'];
            if (!p7 || !p30) return 0;
            const perDay7 = p7 / 7;
            const perDay30 = p30 / 30;
            const saved = (1 - perDay30 / perDay7) * 100;
            if (saved < 1) return 0;
            return Math.round(saved);
        };

        grid.innerHTML = planConfigs.map(p => {
            const isCurrent = this.tier === p.tier;
            const hasPricing = p.pricing;
            const savePct = hasPricing ? calcSave(p.pricing) : 0;
            const priceHtml = hasPricing ?
                `<div class="plan-price-display">
                    <span class="plan-price-amount" id="plan-price-${p.tier}">${fmtPrice(p.pricing['30'])}</span>
                    <span class="plan-price-period">${t('за 30 днів', 'for 30 days')}</span>
                </div>
                <div class="plan-pricing-selector">
                    <button class="plan-day-btn" data-tier="${p.tier}" data-days="7" data-price="${p.pricing['7']}" onclick="Subscription.selectDays(this,'${p.tier}',7)">${t('7 днів', '7 days')} · ${fmtPrice(p.pricing['7'])}</button>
                    <button class="plan-day-btn" data-tier="${p.tier}" data-days="14" data-price="${p.pricing['14']}" onclick="Subscription.selectDays(this,'${p.tier}',14)">${t('14 днів', '14 days')} · ${fmtPrice(p.pricing['14'])}</button>
                    <button class="plan-day-btn plan-day-active" data-tier="${p.tier}" data-days="30" data-price="${p.pricing['30']}" onclick="Subscription.selectDays(this,'${p.tier}',30)">${t('30 днів', '30 days')} · ${fmtPrice(p.pricing['30'])}${savePct > 0 ? ` · −${savePct}%` : ''}</button>
                </div>` :
                `<div class="plan-price-display">
                    <span class="plan-price-amount">${p.price}</span>
                    <span class="plan-price-period">${p.priceSub || ''}</span>
                </div>`;

            const ribbonClass = p.popular ? 'plan-popular' : (p.bestValue ? 'plan-bestvalue' : '');
            const ribbon = p.popular
                ? `<div class="plan-badge plan-badge-popular">⭐ ${t('Популярний', 'Popular')}</div>`
                : (p.bestValue ? `<div class="plan-badge plan-badge-bestvalue">💎 ${t('Найкраща ціна', 'Best value')}</div>` : '');

            const ctaLabel = isCurrent
                ? t('Поточний план', 'Current plan')
                : (p.tier === 'free' ? t('Безкоштовно', 'Free') : t('Обрати', 'Choose'));

            // Trial-Premium secondary CTA — only on the Premium card, only
            // when the user is currently Free and freemium-trial is enabled.
            // If the trial was already consumed we still render a disabled
            // chip so the user understands why it's gone.
            let trialCta = '';
            if (p.tier === 'premium' && this.tier === 'free' && this.trialEnabled) {
                if (!this.trialUsed) {
                    trialCta = `<button class="plan-trial-btn"
                            onclick="event.stopPropagation();Subscription.startTrial()">
                            🎁 ${t(`Активувати пробний ${this.trialDays} дн.`, `Activate ${this.trialDays}-day trial`)}
                        </button>`;
                } else {
                    trialCta = `<div class="plan-trial-used">
                            ✓ ${t('Пробний вже використаний', 'Trial already used')}
                        </div>`;
                }
            }

            return `
            <div class="plan-card ${ribbonClass} ${isCurrent ? 'plan-current' : ''}">
                ${ribbon}
                ${isCurrent ? `<div class="plan-current-pill">${t('✓ Активний', '✓ Active')}</div>` : ''}
                <div class="plan-icon">${p.icon}</div>
                <div class="plan-name">${p.name}</div>
                ${priceHtml}
                <ul class="plan-features">
                    ${p.features.map(f => `<li class="plan-feature-yes">✓ ${f}</li>`).join('')}
                    ${p.missing.map(f => `<li class="plan-feature-no">✗ ${f}</li>`).join('')}
                </ul>
                <div class="plan-cta-stack">
                    <button class="plan-btn ${isCurrent ? 'plan-btn-current' : ''}"
                            ${isCurrent ? 'disabled' : ''}
                            onclick="Subscription.selectPlan('${p.tier}', this)"
                            data-selected-days="30">
                        ${ctaLabel}
                    </button>
                    ${trialCta}
                </div>
            </div>`;
        }).join('');
    },

    selectDays(btn, tier, days) {
        const card = btn.closest('.plan-card');
        if (!card) return;
        card.querySelectorAll('.plan-day-btn').forEach(b => b.classList.remove('plan-day-active'));
        btn.classList.add('plan-day-active');
        const planBtn = card.querySelector('.plan-btn');
        if (planBtn) planBtn.dataset.selectedDays = days;
        // Live-update headline price + period text
        const priceEl = document.getElementById(`plan-price-${tier}`);
        const periodEl = card.querySelector('.plan-price-period');
        const price = parseFloat(btn.dataset.price || '0');
        if (priceEl && !Number.isNaN(price)) {
            priceEl.textContent = `$${price.toFixed(2)}`;
        }
        if (periodEl) {
            const isEn = (typeof I18N !== 'undefined' && I18N && I18N.current === 'en');
            periodEl.textContent = isEn ? `for ${days} days` : `за ${days} днів`;
        }
    },

    selectPlan(tier, btn) {
        if (tier === 'free') return;
        const days = btn?.dataset?.selectedDays || '30';
        window.open(`${CONFIG.API_URL}/pay?plan=${tier}&days=${days}`, '_blank');
    },

    async startTrial() {
        if (!Auth.token) {
            UI.showToast('Увійдіть щоб активувати пробний період');
            return;
        }
        if (this.trialUsed) {
            UI.showToast('Пробний період вже використано на цьому акаунті');
            return;
        }
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/subscription/start-trial`, {
                method: 'POST',
                headers: Auth.getAuthHeaders(),
            });
            if (res.ok) {
                const d = await res.json();
                UI.showToast(`Пробний Premium активовано на ${d.trial_days} днів!`);
                this.tier = 'premium';
                this.trialUsed = true;
                this.renderBadge();
                this.hideBannersForPro();
                this.applyTierGates();
                this._fireTierChanged();
                const modal = document.getElementById('upgrade-modal');
                if (modal) modal.classList.add('hidden');
                await Auth.loadProfile();
            } else {
                const err = await res.json().catch(() => ({}));
                UI.showToast(err.detail || 'Не вдалося активувати пробний період');
            }
        } catch {
            UI.showToast('Помилка мережі');
        }
    },
};
