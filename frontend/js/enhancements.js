// @ts-nocheck
// Picksy — Enhancements Module
// Receipt system, haptic feedback, combined moods, book features,
// page transitions, parallax, micro-animations, confetti,
// prefers-reduced-motion, skeleton loaders, onboarding
const Enhancements = {
    // ─── Haptic Feedback ───
    haptic(pattern) {
        if (Enhancements.prefersReducedMotion())
            return;
        try {
            if ('vibrate' in navigator) {
                navigator.vibrate(pattern);
            }
        }
        catch { }
    },
    hapticLight() { Enhancements.haptic(10); },
    hapticMedium() { Enhancements.haptic(25); },
    hapticHeavy() { Enhancements.haptic([30, 20, 40]); },
    hapticSuccess() { Enhancements.haptic([15, 50, 30]); },
    hapticError() { Enhancements.haptic([50, 30, 50, 30, 50]); },
    hapticTick() { Enhancements.haptic(5); },
    // ─── Prefers Reduced Motion ───
    _reducedMotion: null,
    prefersReducedMotion() {
        if (Enhancements._reducedMotion === null) {
            Enhancements._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
                Enhancements._reducedMotion = e.matches;
                document.documentElement.classList.toggle('reduced-motion', e.matches);
            });
            document.documentElement.classList.toggle('reduced-motion', Enhancements._reducedMotion);
        }
        return Enhancements._reducedMotion;
    },
    // ─── Receipt / Checkout System ───
    _receipts: [],
    _receiptPollTimer: null,
    initReceipts() {
        Enhancements._receipts = JSON.parse(localStorage.getItem('picksy_receipts') || '[]');
        Enhancements._handleReceiptRoute();
        Enhancements._listenReceiptMessages();
        Enhancements._startReceiptPolling();
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden)
                Enhancements._pollReceiptStatus();
        });
    },
    _handleReceiptRoute() {
        const path = window.location.pathname;
        const hashMatch = window.location.hash.match(/^#\/receipt\/(.+)$/);
        const pathMatch = path.match(/^\/receipt\/(.+)$/);
        const receiptId = hashMatch ? hashMatch[1] : pathMatch ? pathMatch[1] : null;
        if (!receiptId)
            return;
        const receipt = Enhancements._receipts.find((r) => r.id === receiptId);
        if (receipt) {
            setTimeout(() => Enhancements.showReceiptModal(receipt), 300);
        }
        else {
            setTimeout(() => {
                if (typeof UI !== 'undefined')
                    UI.showToast('Квитанцію не знайдено');
            }, 300);
        }
        if (pathMatch) {
            window.history.replaceState(null, '', '/');
        }
    },
    // Listen to postMessage from /pay popup so the receipt is stored
    // in the main site's localStorage and openable via the receipt link.
    _listenReceiptMessages() {
        window.addEventListener('message', (ev) => {
            const data = ev.data;
            if (!data || typeof data !== 'object')
                return;
            if (data.type !== 'picksy-receipt' || !data.receipt || !data.receipt.id)
                return;
            const r = data.receipt;
            if (Enhancements._receipts.some((x) => x.id === r.id))
                return;
            Enhancements._receipts.push(r);
            localStorage.setItem('picksy_receipts', JSON.stringify(Enhancements._receipts));
        });
    },
    createReceipt(plan, days, price, forcedId) {
        // If a receipt with this id already exists (e.g. created via postMessage),
        // do not duplicate it — just return the existing one.
        if (forcedId) {
            const existing = Enhancements._receipts.find((r) => r.id === forcedId);
            if (existing) {
                Enhancements.hapticSuccess();
                Enhancements.showReceiptModal(existing);
                return existing;
            }
        }
        const receipt = {
            id: forcedId || ('RCP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase()),
            plan,
            days,
            price,
            date: new Date().toISOString(),
            confirmed: false,
            confirmedAt: null,
            user: typeof Auth !== 'undefined' && Auth.user ? Auth.user.email : 'guest',
        };
        Enhancements._receipts.push(receipt);
        localStorage.setItem('picksy_receipts', JSON.stringify(Enhancements._receipts));
        Enhancements.hapticSuccess();
        Enhancements.showReceiptModal(receipt);
        return receipt;
    },
    confirmReceipt(receiptId) {
        const receipt = Enhancements._receipts.find(r => r.id === receiptId);
        if (receipt && !receipt.confirmed) {
            receipt.confirmed = true;
            receipt.rejected = false;
            receipt.confirmedAt = new Date().toISOString();
            localStorage.setItem('picksy_receipts', JSON.stringify(Enhancements._receipts));
            Enhancements._refreshOpenReceiptModal(receipt);
            try {
                Enhancements.hapticSuccess();
            }
            catch { }
            if (typeof UI !== 'undefined') {
                try {
                    UI.showToast('Чек ' + receipt.id + ' підтверджено!');
                }
                catch { }
            }
        }
        return receipt;
    },
    rejectReceipt(receiptId) {
        const receipt = Enhancements._receipts.find(r => r.id === receiptId);
        if (receipt && !receipt.rejected && !receipt.confirmed) {
            receipt.rejected = true;
            receipt.rejectedAt = new Date().toISOString();
            localStorage.setItem('picksy_receipts', JSON.stringify(Enhancements._receipts));
            Enhancements._refreshOpenReceiptModal(receipt);
            try {
                Enhancements.hapticError();
            }
            catch { }
            if (typeof UI !== 'undefined') {
                try {
                    UI.showToast('Чек ' + receipt.id + ' відхилено');
                }
                catch { }
            }
        }
        return receipt;
    },
    _refreshOpenReceiptModal(receipt) {
        const open = document.getElementById('receipt-modal');
        if (open && open.dataset && open.dataset.receiptId === receipt.id) {
            open.remove();
            Enhancements.showReceiptModal(receipt);
        }
    },
    _startReceiptPolling() {
        if (Enhancements._receiptPollTimer)
            return;
        Enhancements._pollReceiptStatus();
        Enhancements._receiptPollTimer = setInterval(() => {
            Enhancements._pollReceiptStatus();
        }, 20000);
    },
    async _pollReceiptStatus() {
        const pending = Enhancements._receipts.filter((r) => !r.confirmed && !r.rejected);
        if (pending.length === 0)
            return;
        const ids = pending.map((r) => r.id).slice(0, 50);
        try {
            const res = await fetch('/api/payment/status/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receipt_ids: ids })
            });
            if (!res.ok)
                return;
            const data = await res.json();
            const results = (data && data.results) || {};
            let changed = false;
            for (const r of pending) {
                const info = results[r.id];
                if (!info)
                    continue;
                if (info.confirmed && !r.confirmed) {
                    r.confirmed = true;
                    r.rejected = false;
                    r.confirmedAt = info.processed_at || new Date().toISOString();
                    changed = true;
                    Enhancements._refreshOpenReceiptModal(r);
                    try {
                        Enhancements.hapticSuccess();
                    }
                    catch { }
                    if (typeof UI !== 'undefined') {
                        try {
                            UI.showToast('Чек ' + r.id + ' підтверджено!');
                        }
                        catch { }
                    }
                }
                else if (info.rejected && !r.rejected) {
                    r.rejected = true;
                    r.rejectedAt = info.processed_at || new Date().toISOString();
                    changed = true;
                    Enhancements._refreshOpenReceiptModal(r);
                    if (typeof UI !== 'undefined') {
                        try {
                            UI.showToast('Чек ' + r.id + ' відхилено');
                        }
                        catch { }
                    }
                }
            }
            if (changed) {
                localStorage.setItem('picksy_receipts', JSON.stringify(Enhancements._receipts));
            }
        }
        catch { }
    },
    showReceiptModal(receipt) {
        let modal = document.getElementById('receipt-modal');
        if (modal)
            modal.remove();
        const confirmed = receipt.confirmed;
        const rejected = receipt.rejected;
        let confirmBadge;
        if (confirmed) {
            confirmBadge = `<div class="receipt-status receipt-confirmed"><span class="receipt-status-icon">&#10003;</span> Підтверджено адміністратором<br><small>${receipt.confirmedAt ? new Date(receipt.confirmedAt).toLocaleString('uk-UA') : ''}</small></div>`;
        }
        else if (rejected) {
            confirmBadge = `<div class="receipt-status receipt-rejected"><span class="receipt-status-icon">&#10007;</span> Відхилено адміністратором<br><small>${receipt.rejectedAt ? new Date(receipt.rejectedAt).toLocaleString('uk-UA') : ''}</small></div>`;
        }
        else {
            confirmBadge = `<div class="receipt-status receipt-pending"><span class="receipt-status-icon">&#8987;</span> Очікує підтвердження</div>`;
        }
        const planNames = { free: 'Free', premium: 'Premium', pro: 'Pro' };
        modal = document.createElement('div');
        modal.id = 'receipt-modal';
        modal.className = 'modal receipt-modal';
        modal.dataset.receiptId = receipt.id;
        modal.innerHTML = `
            <div class="modal-overlay receipt-overlay"></div>
            <div class="modal-content glass-deep receipt-content">
                <button class="modal-close receipt-close">&times;</button>
                <div class="receipt-paper">
                    <div class="receipt-header">
                        <div class="receipt-logo">🍿 Picksy</div>
                        <div class="receipt-title">Квитанція / Receipt</div>
                    </div>
                    <div class="receipt-divider">- - - - - - - - - - - - - - - - - - -</div>
                    <div class="receipt-body">
                        <div class="receipt-row"><span>ID:</span><span class="receipt-val">${receipt.id}</span></div>
                        <div class="receipt-row"><span>План:</span><span class="receipt-val">${planNames[receipt.plan] || receipt.plan}</span></div>
                        <div class="receipt-row"><span>Термін:</span><span class="receipt-val">${receipt.days} днів</span></div>
                        <div class="receipt-row"><span>Вартість:</span><span class="receipt-val receipt-price">$${receipt.price}</span></div>
                        <div class="receipt-row"><span>Дата:</span><span class="receipt-val">${new Date(receipt.date).toLocaleString('uk-UA')}</span></div>
                        <div class="receipt-row"><span>Користувач:</span><span class="receipt-val">${receipt.user}</span></div>
                    </div>
                    <div class="receipt-divider">- - - - - - - - - - - - - - - - - - -</div>
                    ${confirmBadge}
                    <div class="receipt-divider">- - - - - - - - - - - - - - - - - - -</div>
                    <div class="receipt-footer">
                        <div class="receipt-link-row">
                            <span>Посилання:</span>
                            <a class="receipt-link" href="${window.location.origin}/#/receipt/${receipt.id}" target="_blank">${window.location.origin}/#/receipt/${receipt.id}</a>
                        </div>
                        <button class="receipt-copy-btn" id="receipt-copy-link">📋 Копіювати посилання</button>
                        <div class="receipt-barcode">${'|'.repeat(30) + ' ' + receipt.id}</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const closeReceipt = () => {
            modal.remove();
            // After closing receipt, redirect to the main site
            if (window.location.hash.includes('/receipt/')) {
                window.location.hash = '';
            }
            if (window.location.pathname.startsWith('/receipt/')) {
                window.location.href = window.location.origin;
            }
        };
        modal.querySelector('.receipt-overlay')?.addEventListener('click', closeReceipt);
        modal.querySelector('.receipt-close')?.addEventListener('click', closeReceipt);
        document.getElementById('receipt-copy-link')?.addEventListener('click', () => {
            const link = `${window.location.origin}/#/receipt/${receipt.id}`;
            navigator.clipboard.writeText(link).then(() => {
                if (typeof UI !== 'undefined')
                    UI.showToast('Посилання скопійовано!');
                Enhancements.hapticLight();
            });
        });
    },
    showReceiptsList() {
        let modal = document.getElementById('receipts-list-modal');
        if (modal)
            modal.remove();
        modal = document.createElement('div');
        modal.id = 'receipts-list-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content glass-deep receipt-list-content">
                <button class="modal-close">&times;</button>
                <h2 class="receipt-list-title">🧾 Мої квитанції</h2>
                <div class="receipt-list-items">
                    ${Enhancements._receipts.length === 0
            ? '<p class="empty-msg">Немає квитанцій</p>'
            : Enhancements._receipts.slice().reverse().map(r => `
                            <div class="receipt-list-item" data-id="${r.id}">
                                <div class="receipt-list-info">
                                    <span class="receipt-list-id">${r.id}</span>
                                    <span class="receipt-list-plan">${r.plan} · ${r.days}д · $${r.price}</span>
                                    <span class="receipt-list-date">${new Date(r.date).toLocaleDateString('uk-UA')}</span>
                                </div>
                                <span class="receipt-list-badge ${r.confirmed ? 'confirmed' : (r.rejected ? 'rejected' : 'pending')}">${r.confirmed ? '&#10003; Підтверджено' : (r.rejected ? '&#10007; Відхилено' : '&#8987; Очікує')}</span>
                            </div>
                        `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.modal-overlay')?.addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
        modal.querySelectorAll('.receipt-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const receipt = Enhancements._receipts.find(r => r.id === id);
                if (receipt)
                    Enhancements.showReceiptModal(receipt);
            });
        });
    },
    // ─── Combined Moods (multi-select 2-3) ───
    _selectedMoods: [],
    MAX_MOODS: 3,
    initCombinedMoods() {
        const moodGrid = document.getElementById('mood-grid');
        if (!moodGrid)
            return;
        moodGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.mood-btn');
            if (!btn)
                return;
            e.stopPropagation();
            e.preventDefault();
            const index = parseInt(btn.dataset.index);
            if (isNaN(index))
                return;
            const pos = Enhancements._selectedMoods.indexOf(index);
            if (pos >= 0) {
                Enhancements._selectedMoods.splice(pos, 1);
                btn.classList.remove('active');
                Enhancements.hapticLight();
            }
            else {
                if (Enhancements._selectedMoods.length >= Enhancements.MAX_MOODS) {
                    const oldest = Enhancements._selectedMoods.shift();
                    moodGrid.querySelectorAll('.mood-btn').forEach(b => {
                        if (parseInt(b.dataset.index) === oldest)
                            b.classList.remove('active');
                    });
                }
                Enhancements._selectedMoods.push(index);
                btn.classList.add('active');
                Enhancements.hapticMedium();
            }
            Enhancements._applyCombinedMoods();
        }, true);
    },
    _applyCombinedMoods() {
        if (typeof App === 'undefined')
            return;
        const moods = Enhancements._selectedMoods;
        if (moods.length === 0) {
            App.currentMood = null;
            return;
        }
        App.currentMood = moods[0];
        const tab = App.currentTab;
        if (tab === 'books') {
            const bookMoods = CONFIG.BOOK_MOODS;
            const subjects = moods.map(i => bookMoods[i]?.subject).filter(Boolean);
            App._combinedSubjects = subjects;
        }
        else {
            const moodList = tab === 'tv' ? CONFIG.TV_MOODS : CONFIG.MOVIE_MOODS;
            const allGenres = [];
            moods.forEach(i => {
                if (moodList[i]?.genres)
                    allGenres.push(...moodList[i].genres);
            });
            App._combinedGenres = [...new Set(allGenres)];
        }
    },
    // ─── Book Reading Time + Reader ───
    estimateReadingTime(pageCount) {
        if (!pageCount || pageCount <= 0)
            return '—';
        const avgMinPerPage = 1.5;
        const totalMin = Math.round(pageCount * avgMinPerPage);
        if (totalMin < 60)
            return `~${totalMin} хв`;
        const hours = Math.floor(totalMin / 60);
        const mins = totalMin % 60;
        return mins > 0 ? `~${hours} год ${mins} хв` : `~${hours} год`;
    },
    showBookReader(item) {
        let modal = document.getElementById('book-reader-modal');
        if (modal)
            modal.remove();
        const description = item.description
            ? item.description.replace(/<[^>]*>/g, '')
            : 'Уривок недоступний для цієї книги.';
        const pageCount = item.page_count || item.pageCount || 0;
        const readTime = Enhancements.estimateReadingTime(pageCount);
        modal = document.createElement('div');
        modal.id = 'book-reader-modal';
        modal.className = 'modal book-reader-modal';
        modal.innerHTML = `
            <div class="modal-overlay book-reader-overlay"></div>
            <div class="modal-content glass-deep book-reader-content">
                <button class="modal-close book-reader-close">&times;</button>
                <div class="book-reader-header">
                    <h2 class="book-reader-title">📖 ${item.title || 'Книга'}</h2>
                    <div class="book-reader-meta">
                        ${item.authors ? `<span class="book-reader-author">✍️ ${item.authors.slice(0, 2).join(', ')}</span>` : ''}
                        ${pageCount ? `<span class="book-reader-pages">📄 ${pageCount} стор.</span>` : ''}
                        <span class="book-reader-time">⏱ ${readTime}</span>
                    </div>
                </div>
                <div class="book-reader-body">
                    <div class="book-reader-text" data-book-text>${description}</div>
                </div>
                ${item.preview_link ? `<a class="book-reader-fulllink" href="${item.preview_link}" target="_blank" rel="noopener">📚 Читати повністю на Google Books →</a>` : ''}
            </div>
        `;
        document.body.appendChild(modal);
        Enhancements.hapticLight();
        modal.querySelector('.book-reader-overlay')?.addEventListener('click', () => modal.remove());
        modal.querySelector('.book-reader-close')?.addEventListener('click', () => modal.remove());
        // Live-translate the excerpt to the active locale (uk).
        Enhancements._translateBookText(modal.querySelector('.book-reader-text'), description);
    },
    // Translate a book description/excerpt block into the current UI locale.
    // Falls back gracefully if the translation backend is unavailable.
    async _translateBookText(el, original) {
        if (!el || !original)
            return;
        if (typeof I18N === 'undefined' || typeof I18N.translateText !== 'function')
            return;
        const lang = I18N.current || 'uk';
        // Only translate when target lang differs from source detection.
        if (lang === 'uk' && /[\u0400-\u04FF]/.test(original))
            return;
        if (lang === 'en' && !/[\u0400-\u04FF]/.test(original))
            return;
        try {
            const translated = await I18N.translateText(original, lang);
            if (translated && translated !== original && el.isConnected) {
                el.textContent = translated;
                el.dataset.translated = '1';
            }
        }
        catch { }
    },
    // ─── Page Transitions ───
    initPageTransitions() {
        if (Enhancements.prefersReducedMotion())
            return;
        const sections = document.querySelectorAll('section, .pick-section, .brand-footer');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('section-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05, rootMargin: '50px 0px 0px 0px' });
        sections.forEach((s, i) => {
            const el = s;
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight) {
                el.classList.add('section-visible');
            }
            else {
                el.classList.add('section-animate');
                el.style.transitionDelay = `${i * 0.05}s`;
                observer.observe(el);
            }
        });
    },
    // ─── Parallax Scrolling (optimized) ───
    initParallax() {
        if (Enhancements.prefersReducedMotion())
            return;
        const blobs = document.querySelectorAll('.blob');
        const hero = document.querySelector('.hero-section');
        blobs.forEach((blob) => {
            blob.style.willChange = 'transform';
        });
        if (hero)
            hero.style.willChange = 'transform, opacity';
        let ticking = false;
        let lastScrollY = -1;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    if (Math.abs(scrollY - lastScrollY) < 2) {
                        ticking = false;
                        return;
                    }
                    lastScrollY = scrollY;
                    if (scrollY < window.innerHeight * 1.5) {
                        blobs.forEach((blob, i) => {
                            const speed = 0.15 + i * 0.05;
                            blob.style.transform = `translate3d(0,${scrollY * speed}px,0)`;
                        });
                        if (hero) {
                            const heroEl = hero;
                            heroEl.style.transform = `translate3d(0,${scrollY * 0.08}px,0)`;
                            heroEl.style.opacity = String(Math.max(0.3, 1 - scrollY / 600));
                        }
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    },
    // ─── Micro-animations (hover effects) ───
    initMicroAnimations() {
        if (Enhancements.prefersReducedMotion())
            return;
        Enhancements._injectMicroStyles();
    },
    _injectMicroStyles() {
        if (document.getElementById('picksy-micro-styles'))
            return;
        const style = document.createElement('style');
        style.id = 'picksy-micro-styles';
        style.textContent = `
            .action-btn {
                transition: transform 0.2s var(--spring), box-shadow 0.2s var(--ease), background 0.2s var(--ease) !important;
            }
            .action-btn:hover {
                transform: translateY(-2px) scale(1.08) !important;
                box-shadow: 0 6px 20px rgba(139,92,246,0.25) !important;
            }
            .action-btn:active {
                transform: translateY(0) scale(0.95) !important;
            }

            .pick-btn {
                transition: transform 0.25s var(--spring), box-shadow 0.25s var(--ease) !important;
            }
            .pick-btn:hover {
                transform: translateY(-3px) scale(1.04) !important;
                box-shadow: 0 8px 30px var(--accent-glow) !important;
            }
            .pick-btn:active {
                transform: translateY(1px) scale(0.97) !important;
            }

            .lucky-btn {
                transition: transform 0.25s var(--spring), box-shadow 0.2s var(--ease), border-color 0.2s var(--ease) !important;
            }
            .lucky-btn:hover {
                transform: translateY(-2px) scale(1.03) !important;
                box-shadow: 0 6px 20px rgba(236,72,153,0.2) !important;
            }
            .lucky-btn:active {
                transform: translateY(0) scale(0.97) !important;
            }

            .saved-item {
                transition: transform 0.2s var(--ease), background 0.2s var(--ease), box-shadow 0.2s var(--ease) !important;
            }
            .saved-item:hover {
                transform: translateX(4px) !important;
                background: rgba(139,92,246,0.06) !important;
                box-shadow: -3px 0 0 var(--accent) !important;
            }

            .trending-card {
                transition: transform 0.25s var(--spring), box-shadow 0.2s var(--ease) !important;
            }
            .trending-card:hover {
                transform: translateY(-6px) scale(1.04) !important;
                box-shadow: 0 12px 32px rgba(0,0,0,0.4) !important;
            }

            .tab-btn {
                transition: all 0.25s var(--spring) !important;
            }
            .tab-btn:hover:not(.active) {
                transform: translateY(-1px) scale(1.05) !important;
            }
            .tab-btn:active {
                transform: scale(0.95) !important;
            }

            .more-btn {
                transition: transform 0.2s var(--spring), box-shadow 0.2s var(--ease) !important;
            }
            .more-btn:hover {
                transform: translateY(-2px) scale(1.03) !important;
                box-shadow: 0 6px 20px rgba(139,92,246,0.2) !important;
            }

            .footer-link, .footer-faq-btn {
                transition: transform 0.2s var(--ease), color 0.2s var(--ease) !important;
            }
            .footer-link:hover, .footer-faq-btn:hover {
                transform: translateY(-1px) !important;
            }

            .duo-btn {
                transition: transform 0.25s var(--spring), box-shadow 0.25s var(--ease) !important;
            }
            .duo-btn:hover {
                transform: translateY(-3px) scale(1.02) !important;
                box-shadow: 0 8px 28px rgba(139,92,246,0.2) !important;
            }

            .ai-chip:active, .mood-btn:active {
                transform: scale(0.92) !important;
            }

            .result-poster-wrap {
                transition: transform 0.3s var(--spring) !important;
            }
            .result-card:hover .result-poster-wrap {
                transform: scale(1.03) rotate(-1deg) !important;
            }

            .profile-tool-btn {
                transition: transform 0.2s var(--spring), background 0.2s var(--ease), box-shadow 0.2s var(--ease) !important;
            }
            .profile-tool-btn:hover {
                transform: translateY(-3px) scale(1.06) !important;
                box-shadow: 0 6px 16px rgba(139,92,246,0.2) !important;
            }
        `;
        document.head.appendChild(style);
    },
    // ─── Confetti Effect (100th save milestone) ───
    _saveCount: 0,
    CONFETTI_MILESTONE: 100,
    initConfettiTracker() {
        const movies = JSON.parse(localStorage.getItem('pfm_movies') || '[]');
        const tv = JSON.parse(localStorage.getItem('pfm_tv') || '[]');
        const books = JSON.parse(localStorage.getItem('pfm_books') || '[]');
        Enhancements._saveCount = movies.length + tv.length + books.length;
    },
    checkConfettiMilestone() {
        const movies = JSON.parse(localStorage.getItem('pfm_movies') || '[]');
        const tv = JSON.parse(localStorage.getItem('pfm_tv') || '[]');
        const books = JSON.parse(localStorage.getItem('pfm_books') || '[]');
        const newCount = movies.length + tv.length + books.length;
        if (newCount >= Enhancements.CONFETTI_MILESTONE && Enhancements._saveCount < Enhancements.CONFETTI_MILESTONE) {
            Enhancements.fireEnhancedConfetti();
            Enhancements.hapticHeavy();
            if (typeof UI !== 'undefined') {
                UI.showToast(`🎉 ${Enhancements.CONFETTI_MILESTONE} збережень! Ви — справжній кіноман!`);
            }
        }
        if (newCount > 0 && newCount % 50 === 0 && newCount !== Enhancements._saveCount) {
            Enhancements.fireEnhancedConfetti();
            Enhancements.hapticSuccess();
        }
        Enhancements._saveCount = newCount;
    },
    fireEnhancedConfetti() {
        if (Enhancements.prefersReducedMotion())
            return;
        const container = document.createElement('div');
        container.className = 'confetti-container enhanced-confetti';
        document.body.appendChild(container);
        const colors = ['#8b5cf6', '#ec4899', '#06d6a0', '#f97316', '#3b82f6', '#fbbf24', '#ef4444', '#14b8a6'];
        const shapes = ['circle', 'square', 'triangle'];
        for (let i = 0; i < 120; i++) {
            const piece = document.createElement('div');
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            piece.className = `confetti-piece confetti-${shape}`;
            piece.style.left = Math.random() * 100 + '%';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 1.2 + 's';
            piece.style.animationDuration = (2 + Math.random() * 2) + 's';
            piece.style.setProperty('--confetti-x', (Math.random() * 200 - 100) + 'px');
            piece.style.setProperty('--confetti-rot', Math.floor(Math.random() * 720 - 360) + 'deg');
            if (shape === 'circle') {
                piece.style.width = (6 + Math.random() * 10) + 'px';
                piece.style.height = piece.style.width;
                piece.style.borderRadius = '50%';
            }
            else if (shape === 'square') {
                const size = (5 + Math.random() * 8) + 'px';
                piece.style.width = size;
                piece.style.height = size;
                piece.style.borderRadius = '2px';
            }
            else {
                piece.style.width = '0';
                piece.style.height = '0';
                piece.style.background = 'transparent';
                const color = colors[Math.floor(Math.random() * colors.length)];
                piece.style.borderLeft = `${5 + Math.random() * 5}px solid transparent`;
                piece.style.borderRight = `${5 + Math.random() * 5}px solid transparent`;
                piece.style.borderBottom = `${10 + Math.random() * 8}px solid ${color}`;
            }
            container.appendChild(piece);
        }
        setTimeout(() => container.remove(), 5000);
    },
    // ─── Animated Loading Skeletons ───
    initSkeletonStyles() {
        if (document.getElementById('picksy-skeleton-styles'))
            return;
        const style = document.createElement('style');
        style.id = 'picksy-skeleton-styles';
        style.textContent = `
            .skeleton-card {
                display: flex;
                gap: 16px;
                padding: 20px;
                animation: skeletonFadeIn 0.3s var(--ease);
            }
            .skeleton {
                background: linear-gradient(
                    110deg,
                    rgba(255,255,255,0.04) 30%,
                    rgba(255,255,255,0.1) 50%,
                    rgba(255,255,255,0.04) 70%
                );
                background-size: 300% 100%;
                animation: skeletonShimmer 1.8s ease-in-out infinite;
                border-radius: var(--radius-sm);
            }
            .skeleton-poster {
                width: 120px;
                min-height: 180px;
                border-radius: var(--radius-md);
                flex-shrink: 0;
            }
            .skeleton-info {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding-top: 8px;
            }
            .skeleton-title {
                height: 24px;
                width: 70%;
                border-radius: 8px;
            }
            .skeleton-text {
                height: 14px;
                width: 90%;
                border-radius: 6px;
            }
            .skeleton-text-short {
                height: 14px;
                width: 50%;
                border-radius: 6px;
            }
            .skeleton-actions {
                display: flex;
                gap: 8px;
                margin-top: auto;
            }
            .skeleton-btn {
                height: 36px;
                width: 80px;
                border-radius: 10px;
            }

            @keyframes skeletonShimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            @keyframes skeletonFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    },
    // ─── Onboarding Animation ───
    _onboardingShown: false,
    initOnboarding() {
        // Onboarding is now triggered AFTER the user makes their first pick
        // (so they see value before we show a tour). The trigger lives in
        // App.pick() / pickLucky() / aiSearch() via maybeShowAfterFirstPick().
        // This stays as a no-op for backwards compatibility.
        return;
    },
    /**
     * Called once from App after the first successful pick. Shows a short
     * 4-slide tour the first time, then sets a flag so it never appears
     * again. Safe to call repeatedly.
     */
    maybeShowAfterFirstPick() {
        try {
            if (localStorage.getItem('picksy_onboarding_done'))
                return;
            if (Enhancements._onboardingShown)
                return;
            Enhancements._onboardingShown = true;
            // Small delay so the result card animation finishes first.
            setTimeout(() => Enhancements._showOnboarding(), 1200);
        }
        catch (e) { /* ignore */ }
    },
    _showOnboarding() {
        // Reduced from 8 → 4 slides. After the first pick the user already
        // understands the core flow, so we focus on the next-best actions:
        // refining the pick, saving, multiplayer, and one closing CTA.
        const steps = [
            {
                icon: '🎭',
                title: 'Уточнюй настрій',
                desc: 'Поєднуй настрої та AI-опис, щоб отримати ще точніший підбір.',
            },
            {
                icon: '❤️',
                title: 'Зберігай улюблене',
                desc: 'Зареєструйся одним кліком — і всі знахідки залишатимуться з тобою на будь-якому пристрої.',
            },
            {
                icon: '👯',
                title: 'Підбір разом (Duo)',
                desc: 'Створи кімнату, поділись кодом з другом — і отримай фільм, який сподобається вам обом.',
            },
            {
                icon: '🍿',
                title: 'Гарного перегляду!',
                desc: 'Натисни «Ще» для нової рекомендації або спробуй вкладки Серіали / Книги.',
            },
        ];
        let currentStep = 0;
        const overlay = document.createElement('div');
        overlay.className = 'onboarding-overlay';
        overlay.innerHTML = `
            <div class="onboarding-card">
                <div class="onboarding-progress">
                    ${steps.map((_, i) => `<div class="onboarding-dot ${i === 0 ? 'active' : ''}" data-step="${i}"></div>`).join('')}
                </div>
                <div class="onboarding-icon">${steps[0].icon}</div>
                <h2 class="onboarding-title">${steps[0].title}</h2>
                <p class="onboarding-desc">${steps[0].desc}</p>
                <div class="onboarding-actions">
                    <button class="onboarding-skip">Пропустити</button>
                    <button class="onboarding-next">Далі →</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('onboarding-visible'));
        const card = overlay.querySelector('.onboarding-card');
        const iconEl = overlay.querySelector('.onboarding-icon');
        const titleEl = overlay.querySelector('.onboarding-title');
        const descEl = overlay.querySelector('.onboarding-desc');
        const dots = overlay.querySelectorAll('.onboarding-dot');
        const nextBtn = overlay.querySelector('.onboarding-next');
        const skipBtn = overlay.querySelector('.onboarding-skip');
        const goToStep = (step) => {
            if (step >= steps.length) {
                Enhancements._closeOnboarding(overlay);
                return;
            }
            currentStep = step;
            card.classList.add('onboarding-card-exit');
            setTimeout(() => {
                iconEl.textContent = steps[step].icon;
                titleEl.textContent = steps[step].title;
                descEl.textContent = steps[step].desc;
                dots.forEach((d, i) => d.classList.toggle('active', i <= step));
                if (step === steps.length - 1)
                    nextBtn.textContent = 'Почати! 🎬';
                card.classList.remove('onboarding-card-exit');
                card.classList.add('onboarding-card-enter');
                setTimeout(() => card.classList.remove('onboarding-card-enter'), 400);
                Enhancements.hapticLight();
            }, 200);
        };
        nextBtn.addEventListener('click', () => goToStep(currentStep + 1));
        skipBtn.addEventListener('click', () => Enhancements._closeOnboarding(overlay));
    },
    _closeOnboarding(overlay) {
        overlay.classList.remove('onboarding-visible');
        overlay.classList.add('onboarding-hidden');
        setTimeout(() => overlay.remove(), 400);
        localStorage.setItem('picksy_onboarding_done', '1');
        Enhancements.hapticSuccess();
    },
    // ─── Hook into existing payment flow ───
    hookPayment() {
        const origSelectPlan = typeof Subscription !== 'undefined' ? Subscription.selectPlan : null;
        if (!origSelectPlan)
            return;
        Subscription.selectPlan = function (tier, btn) {
            if (tier === 'free')
                return;
            const days = btn?.dataset?.selectedDays || '30';
            // Do NOT create receipt here — receipt is created only after
            // the user confirms payment on the /pay page.
            window.open(`${CONFIG.API_URL}/pay?plan=${tier}&days=${days}`, '_blank');
        };
    },
    // ─── Hook into save for confetti tracking ───
    hookSave() {
        if (typeof App === 'undefined')
            return;
        const origToggleSave = App.toggleSave.bind(App);
        App.toggleSave = async function () {
            await origToggleSave();
            Enhancements.checkConfettiMilestone();
            Enhancements.hapticMedium();
        };
    },
    // ─── Hook into mood selection to add haptic ───
    hookMoodHaptic() {
        document.getElementById('mood-grid')?.addEventListener('click', () => {
            Enhancements.hapticLight();
        });
    },
    // ─── Hook into pick for haptic ───
    hookPickHaptic() {
        if (typeof App === 'undefined')
            return;
        const origPick = App.pick.bind(App);
        App.pick = async function () {
            Enhancements.hapticTick();
            await origPick();
            Enhancements.hapticMedium();
        };
    },
    // ─── Tinder-style swipe animation when picking a new item ───
    // Wraps App.pick so the existing card flies out (left, like Tinder skip)
    // before the loading state shows up; then UI.showResult triggers a
    // matching deal-in animation. Swipes already animate via Gestures, but
    // tapping the Pick / "Більше" buttons used to just swap text in place.
    _animateBusy: false,
    _isCardVisible() {
        const section = document.getElementById('result-section');
        const card = document.getElementById('result-card');
        if (!section || !card)
            return false;
        if (section.classList.contains('hidden'))
            return false;
        const inner = card.querySelector('.result-card-inner');
        if (!inner)
            return true;
        return inner.style.display !== 'none' && inner.offsetParent !== null;
    },
    _flyOutCard() {
        return new Promise((resolve) => {
            const card = document.getElementById('result-card');
            if (!card) {
                resolve();
                return;
            }
            card.classList.remove('swipe-enter', 'swipe-enter-from-left', 'swipe-enter-from-right', 'pick-fly-out-left', 'pick-fly-out-right');
            // Pick a random horizontal direction for variety
            const goLeft = Math.random() < 0.5;
            const cls = goLeft ? 'pick-fly-out-left' : 'pick-fly-out-right';
            void card.offsetWidth;
            card.classList.add(cls);
            const cleanup = () => {
                card.classList.remove(cls);
                resolve();
            };
            card.addEventListener('animationend', cleanup, { once: true });
            // Safety timeout in case animationend doesn't fire
            setTimeout(cleanup, 360);
        });
    },
    _flyInCard() {
        const card = document.getElementById('result-card');
        if (!card)
            return;
        card.classList.remove('swipe-enter', 'swipe-enter-from-left', 'swipe-enter-from-right', 'pick-fly-out-left', 'pick-fly-out-right');
        void card.offsetWidth;
        card.classList.add('swipe-enter');
        const cleanup = () => {
            card.classList.remove('swipe-enter');
        };
        card.addEventListener('animationend', cleanup, { once: true });
        setTimeout(cleanup, 800);
    },
    hookPickAnimation() {
        if (typeof App === 'undefined' || typeof UI === 'undefined')
            return;
        // Inject the fly-out keyframes (deal-in keyframes already live in gestures.ts).
        if (!document.getElementById('picksy-pick-anim-styles')) {
            const style = document.createElement('style');
            style.id = 'picksy-pick-anim-styles';
            style.textContent = `
                @keyframes pickyPickFlyOutLeft {
                    0%   { opacity: 1; transform: translateX(0) rotate(0) scale(1); }
                    100% { opacity: 0; transform: translateX(-110vw) rotate(-18deg) scale(0.82); }
                }
                @keyframes pickyPickFlyOutRight {
                    0%   { opacity: 1; transform: translateX(0) rotate(0) scale(1); }
                    100% { opacity: 0; transform: translateX(110vw) rotate(18deg) scale(0.82); }
                }
                .result-card.pick-fly-out-left {
                    animation: pickyPickFlyOutLeft 0.32s cubic-bezier(0.32, 0, 0.67, 0) both !important;
                    pointer-events: none;
                    will-change: transform, opacity;
                }
                .result-card.pick-fly-out-right {
                    animation: pickyPickFlyOutRight 0.32s cubic-bezier(0.32, 0, 0.67, 0) both !important;
                    pointer-events: none;
                    will-change: transform, opacity;
                }
            `;
            document.head.appendChild(style);
        }
        const origPick = App.pick.bind(App);
        App.pick = async function () {
            // If a programmatic swipe is currently animating, let Gestures own it.
            if (Enhancements._animateBusy) {
                return origPick();
            }
            const cardVisible = Enhancements._isCardVisible();
            if (cardVisible) {
                Enhancements._animateBusy = true;
                await Enhancements._flyOutCard();
                Enhancements._animateBusy = false;
            }
            return origPick();
        };
        const origShowResult = UI.showResult.bind(UI);
        UI.showResult = function (item, type) {
            origShowResult(item, type);
            // Trigger deal-in on the next frame so layout / poster swap settle first.
            requestAnimationFrame(() => Enhancements._flyInCard());
        };
    },
    // ─── Hook into tab switch for haptic + transition ───
    hookTabHaptic() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Enhancements.hapticLight();
            });
        });
    },
    // ─── Add Book Reading Time to result card ───
    hookBookDisplay() {
        if (typeof UI === 'undefined')
            return;
        const origShowResult = UI.showResult.bind(UI);
        UI.showResult = function (item, type) {
            origShowResult(item, type);
            // Always strip book-only chrome before maybe re-adding it for books.
            // Otherwise the green "Читати" reader button — and any reading-time
            // chip — sticks around when switching from a book pick to a movie/TV pick.
            const actionsDiv = document.querySelector('.result-actions');
            actionsDiv?.querySelectorAll('.reader-btn').forEach(el => el.remove());
            const meta = document.getElementById('result-meta');
            meta?.querySelectorAll('.meta-tag-time').forEach(el => el.remove());
            if (type === 'book') {
                if (meta && item) {
                    const pageCount = item.page_count || item.pageCount || 0;
                    if (pageCount > 0) {
                        const readTime = Enhancements.estimateReadingTime(pageCount);
                        meta.innerHTML += `<span class="meta-tag meta-tag-time">⏱ ${readTime}</span>`;
                    }
                    const readerBtn = document.createElement('button');
                    readerBtn.className = 'action-btn reader-btn';
                    readerBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><span>Читати</span>';
                    readerBtn.addEventListener('click', () => {
                        Enhancements.showBookReader(item);
                    });
                    if (actionsDiv)
                        actionsDiv.appendChild(readerBtn);
                }
                // Translate the book description in the result card to UA when needed.
                const descEl = document.getElementById('result-desc');
                const rawDesc = item && item.description
                    ? String(item.description).replace(/<[^>]*>/g, '')
                    : '';
                if (descEl && rawDesc) {
                    Enhancements._translateBookText(descEl, rawDesc);
                }
            }
        };
    },
    // ─── Add haptic to various buttons ───
    hookButtonHaptics() {
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target.closest('.save-btn'))
                Enhancements.hapticMedium();
            else if (target.closest('.share-btn'))
                Enhancements.hapticLight();
            else if (target.closest('.more-btn'))
                Enhancements.hapticTick();
            else if (target.closest('.lucky-btn'))
                Enhancements.hapticMedium();
            else if (target.closest('.duo-btn'))
                Enhancements.hapticMedium();
            else if (target.closest('.modal-close'))
                Enhancements.hapticLight();
            else if (target.closest('.auth-submit'))
                Enhancements.hapticMedium();
        });
    },
    // ─── Patch getFilters for combined moods ───
    hookCombinedFilters() {
        if (typeof App === 'undefined')
            return;
        const origGetFilters = App.getFilters.bind(App);
        App.getFilters = function () {
            const base = origGetFilters();
            if (Enhancements._selectedMoods.length > 1) {
                const tab = App.currentTab;
                if (tab === 'books' && App._combinedSubjects) {
                    // OpenLibrary subject is a single string; pick the first
                    // because comma-separating it returns nothing useful.
                    base.subject = App._combinedSubjects[0];
                }
                else if (App._combinedGenres) {
                    // OR-join: a "Horror + Action" combo should return Horror
                    // OR Action movies — comma would mean both genres at once
                    // and produces near-empty results from TMDB.
                    base.genre = App._combinedGenres.join('|');
                }
            }
            return base;
        };
    },
    // ─── Init Everything ───
    init() {
        Enhancements.prefersReducedMotion();
        Enhancements.initReceipts();
        Enhancements.initSkeletonStyles();
        Enhancements.initConfettiTracker();
        Enhancements.initMicroAnimations();
        Enhancements.initPageTransitions();
        Enhancements.initParallax();
        Enhancements.initCombinedMoods();
        Enhancements.initOnboarding();
        Enhancements.hookPayment();
        Enhancements.hookSave();
        Enhancements.hookPickHaptic();
        Enhancements.hookPickAnimation();
        Enhancements.hookTabHaptic();
        Enhancements.hookBookDisplay();
        Enhancements.hookButtonHaptics();
        Enhancements.hookCombinedFilters();
    },
};
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Enhancements.init(), 100);
});
//# sourceMappingURL=enhancements.js.map