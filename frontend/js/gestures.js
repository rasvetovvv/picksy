// Picksy — Enhanced Animated Swipe Gestures
// Tinder-style card swipe with spring physics, mouse + touch support,
// visual stamps, card stack effect, smooth transitions
const Gestures = {
    SWIPE_THRESHOLD: 80,
    SWIPE_VELOCITY: 0.25,
    LONG_PRESS_DURATION: 600,
    PULL_DISTANCE: 80,
    MAX_ROTATION: 15,
    SPRING_BACK_DURATION: 500,
    FLY_OUT_DURATION: 400,
    init() {
        this.initCardSwipe();
        this.initTabSwipe();
        this.initPullToRefresh();
        this.initLongPress();
        this._injectSwipeStyles();
    },
    _injectSwipeStyles() {
        if (document.getElementById('picksy-swipe-styles'))
            return;
        const style = document.createElement('style');
        style.id = 'picksy-swipe-styles';
        style.textContent = `
            .swipe-overlay {
                position: absolute;
                inset: 0;
                border-radius: inherit;
                pointer-events: none;
                z-index: 20;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: opacity 0.15s ease;
                opacity: 0;
            }
            .swipe-overlay.active { opacity: 1; }

            .swipe-stamp {
                padding: 14px 32px;
                border-radius: 16px;
                font-size: 1.6rem;
                font-weight: 900;
                letter-spacing: 3px;
                text-transform: uppercase;
                border: 4px solid;
                pointer-events: none;
                text-shadow: 0 2px 12px rgba(0,0,0,0.4);
                box-shadow: 0 6px 32px rgba(0,0,0,0.3);
            }
            .swipe-stamp-like {
                color: #06d6a0;
                border-color: #06d6a0;
                background: rgba(6, 214, 160, 0.18);
                transform: rotate(-12deg) scale(0.5);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease;
            }
            .swipe-stamp-like.visible {
                transform: rotate(-12deg) scale(1.1);
                animation: stampPulse 0.6s ease-in-out;
            }
            .swipe-stamp-skip {
                color: #f97316;
                border-color: #f97316;
                background: rgba(249, 115, 22, 0.18);
                transform: rotate(12deg) scale(0.5);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease;
            }
            .swipe-stamp-skip.visible {
                transform: rotate(12deg) scale(1.1);
                animation: stampPulse 0.6s ease-in-out;
            }
            @keyframes stampPulse {
                0% { transform: rotate(var(--stamp-rotate, -12deg)) scale(0.5); }
                50% { transform: rotate(var(--stamp-rotate, -12deg)) scale(1.2); }
                100% { transform: rotate(var(--stamp-rotate, -12deg)) scale(1.1); }
            }

            .swipe-glow {
                position: absolute;
                inset: 0;
                border-radius: inherit;
                pointer-events: none;
                z-index: 19;
                opacity: 0;
                transition: opacity 0.2s ease;
            }
            .swipe-glow-like {
                box-shadow: inset 0 0 60px rgba(6, 214, 160, 0.4), 0 0 50px rgba(6, 214, 160, 0.25);
                border: 3px solid rgba(6, 214, 160, 0.5);
            }
            .swipe-glow-skip {
                box-shadow: inset 0 0 60px rgba(249, 115, 22, 0.4), 0 0 50px rgba(249, 115, 22, 0.25);
                border: 3px solid rgba(249, 115, 22, 0.5);
            }

            .card-shadow-stack {
                position: absolute;
                inset: 8px 8px -4px 8px;
                border-radius: 22px;
                background: rgba(139, 92, 246, 0.08);
                border: 1px solid rgba(255,255,255,0.04);
                z-index: -1;
                transform: scale(0.96) translateY(8px);
                filter: blur(2px);
                opacity: 0;
                transition: opacity 0.4s ease;
            }
            .card-shadow-stack.visible {
                opacity: 1;
            }

            .swipe-instruction {
                position: absolute;
                bottom: -36px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 16px;
                font-size: 0.72rem;
                color: rgba(240, 240, 248, 0.3);
                white-space: nowrap;
                pointer-events: none;
                z-index: 5;
                animation: swipeInstructionFade 4s ease-in-out infinite;
            }
            .swipe-instruction-arrow {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .swipe-instruction-arrow svg {
                width: 14px;
                height: 14px;
                opacity: 0.5;
            }
            @keyframes swipeInstructionFade {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 1; }
            }

            @keyframes cardFlyOutLeft {
                0% { transform: var(--fly-start-transform); opacity: 1; }
                100% { transform: translateX(-120vw) rotate(-30deg); opacity: 0; }
            }
            @keyframes cardFlyOutRight {
                0% { transform: var(--fly-start-transform); opacity: 1; }
                100% { transform: translateX(120vw) rotate(30deg); opacity: 0; }
            }
            @keyframes pickyTinderDealCenter {
                0%   { opacity: 0; transform: translateY(70px) scale(0.86) rotateZ(-2deg); filter: blur(6px); }
                55%  { opacity: 1; transform: translateY(-8px) scale(1.02) rotateZ(0.5deg); filter: blur(0); }
                100% { opacity: 1; transform: translateY(0) scale(1) rotateZ(0); filter: blur(0); }
            }
            @keyframes pickyTinderDealLeft {
                0%   { opacity: 0; transform: translateX(-110vw) translateY(20px) rotateZ(-22deg) scale(0.85); filter: blur(4px); }
                55%  { opacity: 1; transform: translateX(14px) translateY(-4px) rotateZ(2deg) scale(1.02); filter: blur(0); }
                100% { opacity: 1; transform: translateX(0) translateY(0) rotateZ(0) scale(1); filter: blur(0); }
            }
            @keyframes pickyTinderDealRight {
                0%   { opacity: 0; transform: translateX(110vw) translateY(20px) rotateZ(22deg) scale(0.85); filter: blur(4px); }
                55%  { opacity: 1; transform: translateX(-14px) translateY(-4px) rotateZ(-2deg) scale(1.02); filter: blur(0); }
                100% { opacity: 1; transform: translateX(0) translateY(0) rotateZ(0) scale(1); filter: blur(0); }
            }
            @keyframes pickyTinderShine {
                0%   { opacity: 0; transform: translateX(-130%) skewX(-18deg); }
                30%  { opacity: 0.55; }
                100% { opacity: 0; transform: translateX(130%) skewX(-18deg); }
            }

            .result-card.swiping {
                cursor: grabbing !important;
                user-select: none !important;
            }
            .result-card.swipe-enter {
                animation: pickyTinderDealCenter 0.62s cubic-bezier(0.22, 1.2, 0.36, 1) both !important;
                will-change: transform, opacity, filter;
            }
            .result-card.swipe-enter-from-left {
                animation: pickyTinderDealLeft 0.7s cubic-bezier(0.22, 1.2, 0.36, 1) both !important;
                will-change: transform, opacity, filter;
            }
            .result-card.swipe-enter-from-right {
                animation: pickyTinderDealRight 0.7s cubic-bezier(0.22, 1.2, 0.36, 1) both !important;
                will-change: transform, opacity, filter;
            }
            .result-card.swipe-enter::after,
            .result-card.swipe-enter-from-left::after,
            .result-card.swipe-enter-from-right::after {
                content: "";
                position: absolute;
                inset: 0;
                pointer-events: none;
                background: linear-gradient(
                    100deg,
                    transparent 0%,
                    rgba(255, 255, 255, 0.18) 50%,
                    transparent 100%
                );
                animation: pickyTinderShine 0.8s ease-out 0.15s both;
                z-index: 8;
                border-radius: inherit;
                mix-blend-mode: screen;
            }

            .swipe-particles {
                position: absolute;
                inset: 0;
                pointer-events: none;
                z-index: 25;
                overflow: hidden;
                border-radius: inherit;
            }
            .swipe-particle {
                position: absolute;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                pointer-events: none;
                animation: particleBurst 0.6s ease-out forwards;
            }
            @keyframes particleBurst {
                0% { transform: translate(0, 0) scale(1); opacity: 1; }
                100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    },
    // ─── 1. Enhanced Card Swipe (Touch + Mouse) ───
    _cardBusy: false,
    _hasShownInstruction: false,
    _swipeOccurred: false,
    initCardSwipe() {
        const self = this;
        const card = document.getElementById('result-card');
        if (!card)
            return;
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let deltaX = 0;
        let swiping = false;
        let isDragging = false;
        const resetCard = () => {
            card.style.transition = '';
            card.style.transform = '';
            card.style.opacity = '';
            card.classList.remove('swiping');
        };
        const onStart = (e) => {
            if (self._cardBusy)
                return;
            if ('button' in e && e.button !== 0)
                return;
            const target = e.target;
            if (target.closest('button') || target.closest('a') || target.closest('.result-actions'))
                return;
            self._swipeOccurred = false;
            const pos = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
            startX = pos.x;
            startY = pos.y;
            startTime = Date.now();
            deltaX = 0;
            swiping = false;
            isDragging = true;
            card.style.transition = 'none';
            card.classList.add('swiping');
            self._ensureSwipeOverlays(card);
            self._showShadowStack(card, true);
        };
        const onMove = (e) => {
            if (self._cardBusy || !isDragging)
                return;
            const pos = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
            deltaX = pos.x - startX;
            const deltaY = pos.y - startY;
            if (!swiping && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                swiping = true;
            }
            if (swiping) {
                e.preventDefault();
                const progress = Math.min(1, Math.abs(deltaX) / 250);
                const rotate = deltaX * 0.04 * (1 - progress * 0.3);
                const scale = 1 - progress * 0.03;
                const opacity = Math.max(0.4, 1 - progress * 0.5);
                card.style.transform = `translateX(${deltaX}px) rotate(${rotate}deg) scale(${scale})`;
                card.style.opacity = String(opacity);
                self._updateSwipeOverlays(card, deltaX);
            }
        };
        const onEnd = (e) => {
            if (self._cardBusy || !isDragging)
                return;
            isDragging = false;
            if (swiping) {
                self._swipeOccurred = true;
                if ('stopPropagation' in e)
                    e.stopPropagation();
            }
            const elapsed = Date.now() - startTime;
            const velocity = Math.abs(deltaX) / elapsed;
            const progress = Math.abs(deltaX) / 250;
            if ((Math.abs(deltaX) > self.SWIPE_THRESHOLD && velocity > self.SWIPE_VELOCITY) || progress > 0.5) {
                const direction = deltaX > 0 ? 'right' : 'left';
                self._cardBusy = true;
                self._hideSwipeOverlays(card);
                const flyX = deltaX > 0 ? window.innerWidth * 1.5 : -window.innerWidth * 1.5;
                const flyRotate = deltaX > 0 ? 30 : -30;
                card.style.transition = `transform ${self.FLY_OUT_DURATION}ms cubic-bezier(0.32, 0, 0.67, 0), opacity ${self.FLY_OUT_DURATION * 0.8}ms ease`;
                card.style.transform = `translateX(${flyX}px) rotate(${flyRotate}deg) scale(0.8)`;
                card.style.opacity = '0';
                self._emitSwipeParticles(card, direction);
                setTimeout(() => {
                    if (direction === 'right') {
                        if (typeof App !== 'undefined' && App.currentItem) {
                            App.toggleSave();
                            UI.showToast(I18N.t('saved') || 'Збережено!');
                        }
                    }
                    resetCard();
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(40px) scale(0.92)';
                    const doAction = () => {
                        return direction === 'left' && typeof App !== 'undefined'
                            ? App.pick()
                            : Promise.resolve();
                    };
                    doAction().finally(() => {
                        requestAnimationFrame(() => {
                            const enterClass = direction === 'right'
                                ? 'swipe-enter-from-left'
                                : 'swipe-enter-from-right';
                            card.classList.add('swipe-enter', enterClass);
                            card.style.transition = '';
                            card.style.transform = '';
                            card.style.opacity = '';
                            const onAnimEnd = () => {
                                card.classList.remove('swipe-enter', 'swipe-enter-from-left', 'swipe-enter-from-right');
                                resetCard();
                                self._cardBusy = false;
                                self._showShadowStack(card, false);
                            };
                            card.addEventListener('animationend', onAnimEnd, { once: true });
                            setTimeout(onAnimEnd, 700);
                        });
                    });
                }, self.FLY_OUT_DURATION);
            }
            else {
                card.style.transition = `transform ${self.SPRING_BACK_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${self.SPRING_BACK_DURATION}ms ease`;
                card.style.transform = '';
                card.style.opacity = '';
                self._hideSwipeOverlays(card);
                self._showShadowStack(card, false);
                setTimeout(() => {
                    card.style.transition = '';
                    card.classList.remove('swiping');
                }, self.SPRING_BACK_DURATION);
            }
            swiping = false;
        };
        // Touch events
        card.addEventListener('touchstart', onStart, { passive: true });
        card.addEventListener('touchmove', onMove, { passive: false });
        card.addEventListener('touchend', onEnd);
        // Mouse events for desktop
        card.addEventListener('mousedown', onStart);
        document.addEventListener('mousemove', (e) => {
            if (isDragging)
                onMove(e);
        });
        document.addEventListener('mouseup', (e) => {
            if (isDragging)
                onEnd(e);
        });
        // Prevent click events after swipe (captures before app.ts click handler)
        card.addEventListener('click', (e) => {
            if (self._swipeOccurred) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                self._swipeOccurred = false;
            }
        }, true);
        // Show swipe instruction on first result
        const observer = new MutationObserver(() => {
            const section = document.getElementById('result-section');
            if (section && !section.classList.contains('hidden') && !self._hasShownInstruction) {
                self._hasShownInstruction = true;
                self._showSwipeInstruction(card);
            }
        });
        const resultSection = document.getElementById('result-section');
        if (resultSection) {
            observer.observe(resultSection, { attributes: true, attributeFilter: ['class'] });
        }
    },
    _ensureSwipeOverlays(card) {
        if (card.querySelector('.swipe-overlay-like'))
            return;
        const likeOverlay = document.createElement('div');
        likeOverlay.className = 'swipe-overlay swipe-overlay-like';
        likeOverlay.innerHTML = '<div class="swipe-stamp swipe-stamp-like">\u2764\uFE0F ' + (I18N.t('save') || '\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438') + '</div>';
        card.appendChild(likeOverlay);
        const skipOverlay = document.createElement('div');
        skipOverlay.className = 'swipe-overlay swipe-overlay-skip';
        skipOverlay.innerHTML = '<div class="swipe-stamp swipe-stamp-skip">\u23ED ' + (I18N.t('more') || '\u0414\u0430\u043B\u0456') + '</div>';
        card.appendChild(skipOverlay);
        const glowLike = document.createElement('div');
        glowLike.className = 'swipe-glow swipe-glow-like';
        card.appendChild(glowLike);
        const glowSkip = document.createElement('div');
        glowSkip.className = 'swipe-glow swipe-glow-skip';
        card.appendChild(glowSkip);
        if (!card.parentElement?.querySelector('.card-shadow-stack')) {
            const shadow = document.createElement('div');
            shadow.className = 'card-shadow-stack';
            card.parentElement?.insertBefore(shadow, card);
        }
    },
    _updateSwipeOverlays(card, dx) {
        const absDelta = Math.abs(dx);
        const progress = Math.min(1, absDelta / 150);
        const likeOverlay = card.querySelector('.swipe-overlay-like');
        const skipOverlay = card.querySelector('.swipe-overlay-skip');
        const likeStamp = card.querySelector('.swipe-stamp-like');
        const skipStamp = card.querySelector('.swipe-stamp-skip');
        const glowLike = card.querySelector('.swipe-glow-like');
        const glowSkip = card.querySelector('.swipe-glow-skip');
        if (dx > 30) {
            if (likeOverlay) {
                likeOverlay.classList.add('active');
                likeOverlay.style.opacity = String(progress);
            }
            if (skipOverlay) {
                skipOverlay.classList.remove('active');
                skipOverlay.style.opacity = '0';
            }
            if (likeStamp)
                likeStamp.classList.toggle('visible', progress > 0.3);
            if (skipStamp)
                skipStamp.classList.remove('visible');
            if (glowLike)
                glowLike.style.opacity = String(progress * 0.6);
            if (glowSkip)
                glowSkip.style.opacity = '0';
        }
        else if (dx < -30) {
            if (skipOverlay) {
                skipOverlay.classList.add('active');
                skipOverlay.style.opacity = String(progress);
            }
            if (likeOverlay) {
                likeOverlay.classList.remove('active');
                likeOverlay.style.opacity = '0';
            }
            if (skipStamp)
                skipStamp.classList.toggle('visible', progress > 0.3);
            if (likeStamp)
                likeStamp.classList.remove('visible');
            if (glowSkip)
                glowSkip.style.opacity = String(progress * 0.6);
            if (glowLike)
                glowLike.style.opacity = '0';
        }
        else {
            if (likeOverlay) {
                likeOverlay.classList.remove('active');
                likeOverlay.style.opacity = '0';
            }
            if (skipOverlay) {
                skipOverlay.classList.remove('active');
                skipOverlay.style.opacity = '0';
            }
            if (likeStamp)
                likeStamp.classList.remove('visible');
            if (skipStamp)
                skipStamp.classList.remove('visible');
            if (glowLike)
                glowLike.style.opacity = '0';
            if (glowSkip)
                glowSkip.style.opacity = '0';
        }
    },
    _hideSwipeOverlays(card) {
        const overlays = card.querySelectorAll('.swipe-overlay');
        overlays.forEach((o) => {
            o.classList.remove('active');
            o.style.opacity = '0';
        });
        const stamps = card.querySelectorAll('.swipe-stamp');
        stamps.forEach((s) => s.classList.remove('visible'));
        const glows = card.querySelectorAll('.swipe-glow');
        glows.forEach((g) => g.style.opacity = '0');
    },
    _showShadowStack(card, show) {
        const shadow = card.parentElement?.querySelector('.card-shadow-stack');
        if (shadow)
            shadow.classList.toggle('visible', show);
    },
    _showSwipeInstruction(card) {
        if (card.querySelector('.swipe-instruction'))
            return;
        const instr = document.createElement('div');
        instr.className = 'swipe-instruction';
        instr.innerHTML = `
            <span class="swipe-instruction-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M5 12L12 19M5 12L12 5"/></svg>
                ${I18N.t('more') || '\u0414\u0430\u043B\u0456'}
            </span>
            <span style="opacity:0.4">\u27F7</span>
            <span class="swipe-instruction-arrow">
                ${I18N.t('save') || '\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12H19M19 12L12 5M19 12L12 19"/></svg>
            </span>
        `;
        card.parentElement?.appendChild(instr);
        setTimeout(() => instr.remove(), 6000);
    },
    _emitSwipeParticles(card, direction) {
        const container = document.createElement('div');
        container.className = 'swipe-particles';
        card.appendChild(container);
        const color = direction === 'right' ? '#06d6a0' : '#f97316';
        const centerX = direction === 'right' ? card.offsetWidth - 40 : 40;
        const centerY = card.offsetHeight / 2;
        for (let i = 0; i < 18; i++) {
            const p = document.createElement('div');
            p.className = 'swipe-particle';
            p.style.left = centerX + 'px';
            p.style.top = centerY + 'px';
            p.style.background = color;
            p.style.width = (4 + Math.random() * 6) + 'px';
            p.style.height = p.style.width;
            const angle = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.5;
            const dist = 50 + Math.random() * 80;
            p.style.setProperty('--px', Math.cos(angle) * dist + 'px');
            p.style.setProperty('--py', Math.sin(angle) * dist + 'px');
            p.style.animationDelay = Math.random() * 0.1 + 's';
            container.appendChild(p);
        }
        setTimeout(() => container.remove(), 700);
    },
    // ─── 2. Swipe Between Tabs ───
    initTabSwipe() {
        const header = document.querySelector('.header');
        if (!header)
            return;
        const tabs = ['movies', 'tv', 'books'];
        let startX = 0, startY = 0, swiping = false;
        header.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            swiping = false;
        }, { passive: true });
        header.addEventListener('touchmove', (e) => {
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            if (!swiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
                swiping = true;
            }
        }, { passive: true });
        header.addEventListener('touchend', (e) => {
            if (!swiping)
                return;
            const currentIdx = tabs.indexOf(typeof App !== 'undefined' ? App.currentTab : 'movies');
            const endDx = e.changedTouches ? e.changedTouches[0].clientX - startX : 0;
            if (Math.abs(endDx) < 50)
                return;
            let newIdx = currentIdx;
            if (endDx < -50 && currentIdx < tabs.length - 1)
                newIdx = currentIdx + 1;
            else if (endDx > 50 && currentIdx > 0)
                newIdx = currentIdx - 1;
            if (newIdx !== currentIdx && typeof App !== 'undefined') {
                App.switchTab(tabs[newIdx]);
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.tab === tabs[newIdx]);
                });
            }
        });
    },
    // ─── 3. Pull-to-Refresh ───
    initPullToRefresh() {
        if (!('ontouchstart' in window))
            return;
        let indicator = null;
        const createIndicator = () => {
            if (indicator)
                return indicator;
            indicator = document.createElement('div');
            indicator.className = 'pull-refresh-indicator';
            indicator.innerHTML = '<span class="pull-refresh-icon">\u2193</span><span class="pull-refresh-text">' +
                (I18N.t('pullToRefresh') || '\u041f\u043e\u0442\u044f\u0433\u043d\u0456\u0442\u044c \u0434\u043b\u044f \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f') + '</span>';
            document.body.prepend(indicator);
            return indicator;
        };
        let startY = 0;
        let pulling = false;
        let pullDistance = 0;
        const _isScrollableTarget = (el) => {
            let node = el;
            while (node && node !== document.body) {
                const style = window.getComputedStyle(node);
                const overflowY = style.overflowY;
                if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
                    return true;
                }
                if (node.classList.contains('modal') || node.classList.contains('profile-modal-content') ||
                    node.classList.contains('saved-section') || node.classList.contains('upgrade-modal-card') ||
                    node.classList.contains('receipt-content') || node.classList.contains('book-reader-content') ||
                    node.classList.contains('detail-modal-content') || node.classList.contains('game-modal-card')) {
                    return true;
                }
                node = node.parentElement;
            }
            return false;
        };
        let _skipPull = false;
        document.addEventListener('touchstart', (e) => {
            _skipPull = false;
            if (window.scrollY > 5)
                return;
            const target = e.target;
            if (_isScrollableTarget(target)) {
                _skipPull = true;
                return;
            }
            startY = e.touches[0].clientY;
            pulling = false;
            pullDistance = 0;
        }, { passive: true });
        document.addEventListener('touchmove', (e) => {
            if (_skipPull)
                return;
            if (window.scrollY > 5)
                return;
            const dy = e.touches[0].clientY - startY;
            if (dy > 20 && !pulling) {
                pulling = true;
                createIndicator();
            }
            if (pulling && dy > 0) {
                pullDistance = Math.min(dy, this.PULL_DISTANCE * 2);
                const ind = createIndicator();
                const progress = Math.min(1, pullDistance / this.PULL_DISTANCE);
                ind.style.transform = `translateY(${pullDistance * 0.5}px)`;
                ind.style.opacity = String(progress);
                if (pullDistance >= this.PULL_DISTANCE) {
                    ind.classList.add('pull-ready');
                    const text = ind.querySelector('.pull-refresh-text');
                    if (text)
                        text.textContent = I18N.t('releaseToRefresh') || '\u0412\u0456\u0434\u043f\u0443\u0441\u0442\u0456\u0442\u044c \u0434\u043b\u044f \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f';
                    const icon = ind.querySelector('.pull-refresh-icon');
                    if (icon)
                        icon.textContent = '\u2191';
                }
                else {
                    ind.classList.remove('pull-ready');
                    const text = ind.querySelector('.pull-refresh-text');
                    if (text)
                        text.textContent = I18N.t('pullToRefresh') || '\u041f\u043e\u0442\u044f\u0433\u043d\u0456\u0442\u044c \u0434\u043b\u044f \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f';
                    const icon = ind.querySelector('.pull-refresh-icon');
                    if (icon)
                        icon.textContent = '\u2193';
                }
                e.preventDefault();
            }
        }, { passive: false });
        document.addEventListener('touchend', () => {
            if (!pulling || !indicator)
                return;
            if (pullDistance >= this.PULL_DISTANCE) {
                indicator.classList.add('pull-refreshing');
                const text = indicator.querySelector('.pull-refresh-text');
                if (text)
                    text.textContent = I18N.t('refreshing') || '\u041e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f...';
                const icon = indicator.querySelector('.pull-refresh-icon');
                if (icon) {
                    icon.textContent = '\u27F3';
                    icon.style.animation = 'spin 0.8s linear infinite';
                }
                App.pick().finally(() => {
                    if (indicator) {
                        indicator.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                        indicator.style.transform = 'translateY(-60px)';
                        indicator.style.opacity = '0';
                        setTimeout(() => {
                            indicator?.remove();
                            indicator = null;
                        }, 300);
                    }
                });
            }
            else {
                indicator.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                indicator.style.transform = 'translateY(-60px)';
                indicator.style.opacity = '0';
                setTimeout(() => {
                    indicator?.remove();
                    indicator = null;
                }, 300);
            }
            pulling = false;
            pullDistance = 0;
        });
    },
    // ─── 4. Long Press Context Menu ───
    initLongPress() {
        if (!('ontouchstart' in window))
            return;
        const card = document.getElementById('result-card');
        if (!card)
            return;
        let pressTimer = null;
        let startX = 0;
        let startY = 0;
        card.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            pressTimer = setTimeout(() => {
                this._showContextMenu(e.touches[0].clientX, e.touches[0].clientY);
            }, this.LONG_PRESS_DURATION);
        }, { passive: true });
        card.addEventListener('touchmove', (e) => {
            const dx = Math.abs(e.touches[0].clientX - startX);
            const dy = Math.abs(e.touches[0].clientY - startY);
            if (dx > 10 || dy > 10) {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            }
        }, { passive: true });
        card.addEventListener('touchend', () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        });
        document.addEventListener('touchstart', (e) => {
            const menu = document.querySelector('.context-menu');
            if (menu && !e.target.closest('.context-menu')) {
                menu.remove();
            }
        });
    },
    _showContextMenu(x, y) {
        document.querySelector('.context-menu')?.remove();
        if (!App.currentItem)
            return;
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        const items = [
            { icon: '\u2764\uFE0F', text: I18N.t('save') || '\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438', action: 'save' },
            { icon: '\uD83D\uDCE4', text: I18N.t('share') || '\u041f\u043e\u0434\u0456\u043b\u0438\u0442\u0438\u0441\u044f', action: 'share' },
            { icon: '\u25B6\uFE0F', text: I18N.t('trailer') || '\u0422\u0440\u0435\u0439\u043b\u0435\u0440', action: 'trailer' },
            { icon: '\uD83D\uDD17', text: I18N.t('link') || '\u041f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f', action: 'link' },
            { icon: '\uD83D\uDD01', text: I18N.t('more') || '\u0429\u0435', action: 'more' },
        ];
        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'context-menu-item';
            btn.innerHTML = `<span class="context-menu-icon">${item.icon}</span><span>${item.text}</span>`;
            btn.addEventListener('click', () => {
                menu.remove();
                this._handleContextAction(item.action);
            });
            menu.appendChild(btn);
        });
        const menuWidth = 200;
        const menuHeight = items.length * 44;
        let menuX = x - menuWidth / 2;
        let menuY = y - menuHeight - 10;
        if (menuX < 10)
            menuX = 10;
        if (menuX + menuWidth > window.innerWidth - 10)
            menuX = window.innerWidth - menuWidth - 10;
        if (menuY < 10)
            menuY = y + 20;
        menu.style.left = menuX + 'px';
        menu.style.top = menuY + 'px';
        document.body.appendChild(menu);
        requestAnimationFrame(() => menu.classList.add('context-menu-visible'));
    },
    _handleContextAction(action) {
        switch (action) {
            case 'save':
                App.toggleSave();
                break;
            case 'share':
                if (App.currentItem) {
                    const title = App.currentItem.title || App.currentItem.name || '';
                    const url = App.getItemUrl(App.currentItem, App.currentType);
                    App.shareResult(title, url);
                }
                break;
            case 'trailer':
                document.getElementById('trailer-btn')?.click();
                break;
            case 'link':
                document.getElementById('link-btn')?.click();
                break;
            case 'more':
                App.pick();
                break;
        }
    },
};
document.addEventListener('DOMContentLoaded', () => {
    Gestures.init();
});
//# sourceMappingURL=gestures.js.map