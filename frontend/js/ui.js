function _escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}
const UI = {
    els: {},
    init() {
        this.els = {
            moodGrid: document.getElementById('mood-grid'),
            filtersToggle: document.getElementById('filters-toggle'),
            filtersSection: document.getElementById('filters-section'),
            filtersBody: document.getElementById('filters-body'),
            movieFilters: document.getElementById('movie-filters'),
            tvFilters: document.getElementById('tv-filters'),
            bookFilters: document.getElementById('book-filters'),
            // Movie filters
            movieGenre: document.getElementById('movie-genre'),
            movieYearFrom: document.getElementById('movie-year-from'),
            movieYearTo: document.getElementById('movie-year-to'),
            movieRating: document.getElementById('movie-rating'),
            movieRatingVal: document.getElementById('movie-rating-val'),
            movieCountry: document.getElementById('movie-country'),
            // TV filters
            tvGenre: document.getElementById('tv-genre'),
            tvYearFrom: document.getElementById('tv-year-from'),
            tvYearTo: document.getElementById('tv-year-to'),
            tvRating: document.getElementById('tv-rating'),
            tvRatingVal: document.getElementById('tv-rating-val'),
            tvCountry: document.getElementById('tv-country'),
            // Book filters
            bookSubject: document.getElementById('book-subject'),
            bookQuery: document.getElementById('book-query'),
            bookLanguage: document.getElementById('book-language'),
            // Buttons
            pickBtn: document.getElementById('pick-btn'),
            luckyBtn: document.getElementById('lucky-btn'),
            resultSection: document.getElementById('result-section'),
            resultCard: document.getElementById('result-card'),
            resultPoster: document.getElementById('result-poster'),
            resultRatingBadge: document.getElementById('result-rating-badge'),
            resultTitle: document.getElementById('result-title'),
            resultMeta: document.getElementById('result-meta'),
            resultDesc: document.getElementById('result-desc'),
            saveBtn: document.getElementById('save-btn'),
            shareBtn: document.getElementById('share-btn'),
            trailerBtn: document.getElementById('trailer-btn'),
            moreBtn: document.getElementById('more-btn'),
            savedToggle: document.getElementById('saved-toggle'),
            savedBody: document.getElementById('saved-body'),
            savedCount: document.getElementById('saved-count'),
            savedList: document.getElementById('saved-list'),
            trailerModal: document.getElementById('trailer-modal'),
            modalOverlay: document.getElementById('modal-overlay'),
            modalClose: document.getElementById('modal-close'),
            trailerWrap: document.getElementById('trailer-wrap'),
            watchedBtn: document.getElementById('watched-btn'),
            loading: document.getElementById('loading'),
            toast: document.getElementById('toast'),
        };
    },
    populateYears() {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= 1950; y--) {
            const ys = String(y);
            const opt1 = document.createElement('option');
            opt1.value = ys;
            opt1.textContent = ys;
            this.els.movieYearFrom.appendChild(opt1);
            const opt2 = document.createElement('option');
            opt2.value = ys;
            opt2.textContent = ys;
            this.els.movieYearTo.appendChild(opt2);
            if (this.els.tvYearFrom) {
                const opt3 = document.createElement('option');
                opt3.value = ys;
                opt3.textContent = ys;
                this.els.tvYearFrom.appendChild(opt3);
                const opt4 = document.createElement('option');
                opt4.value = ys;
                opt4.textContent = ys;
                this.els.tvYearTo.appendChild(opt4);
            }
        }
    },
    renderMoods(moods) {
        this.els.moodGrid.innerHTML = '';
        moods.forEach((mood, i) => {
            const btn = document.createElement('button');
            btn.className = 'mood-btn';
            btn.dataset.index = i;
            btn.innerHTML = `${mood.emoji} ${mood.label}`;
            this.els.moodGrid.appendChild(btn);
        });
    },
    setActiveMood(index) {
        this.els.moodGrid.querySelectorAll('.mood-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.index) === index);
        });
    },
    clearMood() {
        this.els.moodGrid.querySelectorAll('.mood-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    },
    switchFilters(tab) {
        const sets = [
            ['movies', this.els.movieFilters],
            ['tv', this.els.tvFilters],
            ['books', this.els.bookFilters],
        ];
        sets.forEach(([name, el]) => {
            if (!el)
                return;
            el.classList.toggle('hidden', name !== tab);
        });
    },
    toggleFilters() {
        this.els.filtersSection.classList.toggle('open');
    },
    showLoading(text) {
        if (text) {
            const lt = document.getElementById('loading-text');
            if (lt)
                lt.textContent = text;
        }
        if (this.els.loading)
            this.els.loading.classList.remove('hidden');
        const resultCard = this.els.resultCard;
        if (resultCard) {
            // Hide original content instead of replacing it
            const cardInner = resultCard.querySelector('.result-card-inner');
            if (cardInner)
                cardInner.style.display = 'none';
            // Add skeleton overlay if not already present
            if (!resultCard.querySelector('.skeleton-card')) {
                const skeleton = document.createElement('div');
                skeleton.className = 'skeleton-card';
                skeleton.innerHTML =
                    '<div class="skeleton skeleton-poster"></div>' +
                        '<div class="skeleton-info">' +
                        '<div class="skeleton skeleton-title"></div>' +
                        '<div class="skeleton skeleton-text"></div>' +
                        '<div class="skeleton skeleton-text"></div>' +
                        '<div class="skeleton skeleton-text-short"></div>' +
                        '</div>';
                resultCard.appendChild(skeleton);
            }
            if (this.els.resultSection)
                this.els.resultSection.classList.remove('hidden');
        }
    },
    hideLoading() {
        if (this.els.loading)
            this.els.loading.classList.add('hidden');
        const resultCard = this.els.resultCard;
        if (resultCard) {
            // Remove skeleton overlay
            const skeleton = resultCard.querySelector('.skeleton-card');
            if (skeleton)
                skeleton.remove();
            // Show original content
            const cardInner = resultCard.querySelector('.result-card-inner');
            if (cardInner)
                cardInner.style.display = '';
        }
    },
    showError(title, desc, retryFn) {
        this.els.resultSection.classList.remove('hidden');
        const resultCard = this.els.resultCard;
        if (resultCard) {
            const retryBtnHtml = retryFn ? '<button class="error-state-btn" id="error-retry-btn">Спробувати ще</button>' : '';
            resultCard.innerHTML = '<div class="error-state">' +
                '<div class="error-state-icon">😔</div>' +
                '<div class="error-state-title">' + _escHtml(title || 'Щось пішло не так') + '</div>' +
                '<div class="error-state-desc">' + _escHtml(desc || 'Спробуйте ще раз пізніше') + '</div>' +
                retryBtnHtml +
                '</div>';
            if (retryFn) {
                const btn = document.getElementById('error-retry-btn');
                if (btn)
                    btn.addEventListener('click', retryFn);
            }
        }
    },
    showResult(item, type) {
        if (!this.els.resultSection || !this.els.resultCard)
            return;
        // Remove skeleton and show original content
        this.hideLoading();
        this.els.resultSection.classList.remove('hidden');
        const cardInner = this.els.resultCard.querySelector('.result-card-inner');
        if (cardInner) {
            cardInner.style.animation = 'none';
            void cardInner.offsetHeight;
            cardInner.style.animation = 'cardReveal 0.6s var(--ease, cubic-bezier(0.4, 0, 0.2, 1))';
        }
        const cardBg = document.getElementById('result-card-bg');
        let posterUrl;
        if (type === 'movie') {
            posterUrl = item.poster_path ? CONFIG.TMDB_IMG + item.poster_path : (item.poster || null);
            this.els.resultPoster.src = posterUrl || CONFIG.FALLBACK_POSTER;
            this.els.resultPoster.alt = item.title ? `Постер: ${item.title}` : '';
            this.els.resultTitle.textContent = item.title || item.original_title;
            const ratingVal = item.vote_average || item.rating || 0;
            const ratingNumEl = document.getElementById('result-rating-num');
            if (ratingNumEl)
                ratingNumEl.textContent = Number(ratingVal).toFixed(1);
            this.els.resultDesc.textContent = item.overview || item.description || (typeof I18N !== 'undefined' ? I18N.t('noDesc') : '');
            const year = item.release_date ? item.release_date.split('-')[0] : (item.year || '—');
            const genres = (item.genre_ids || [])
                .map(id => {
                const name = typeof I18N !== 'undefined' ? I18N.getGenreName(id, 'movie') : '';
                return name ? `<span class="meta-tag">${_escHtml(name)}</span>` : null;
            })
                .filter(Boolean)
                .slice(0, 3)
                .join('');
            const runtimeTag = item.runtime ? `<span class="meta-tag">🕐 ${item.runtime} хв</span>` : '';
            const uaTag = item.original_language === 'uk' ? `<span class="meta-tag meta-ua" title="Український оригінал">🇺🇦 UA</span>` : '';
            this.els.resultMeta.innerHTML = `<span class="meta-tag">${_escHtml(year)}</span>${runtimeTag}${uaTag}${genres}`;
            this.els.trailerBtn.classList.remove('hidden');
            this.els.watchedBtn.classList.remove('hidden');
        }
        else if (type === 'tv') {
            posterUrl = item.poster_path ? CONFIG.TMDB_IMG + item.poster_path : (item.poster || null);
            this.els.resultPoster.src = posterUrl || CONFIG.FALLBACK_TV_POSTER;
            this.els.resultPoster.alt = (item.name || item.original_name) ? `Постер: ${item.name || item.original_name}` : '';
            this.els.resultTitle.textContent = item.name || item.original_name || item.title || '';
            const tvRatingVal = item.vote_average || item.rating || 0;
            const tvRatingNumEl = document.getElementById('result-rating-num');
            if (tvRatingNumEl)
                tvRatingNumEl.textContent = Number(tvRatingVal).toFixed(1);
            this.els.resultDesc.textContent = item.overview || item.description || (typeof I18N !== 'undefined' ? I18N.t('noDesc') : '');
            const year = item.first_air_date ? item.first_air_date.split('-')[0] : (item.year || '—');
            const genres = (item.genre_ids || [])
                .map(id => {
                const name = typeof I18N !== 'undefined' ? I18N.getGenreName(id, 'tv') : '';
                return name ? `<span class="meta-tag">${_escHtml(name)}</span>` : null;
            })
                .filter(Boolean)
                .slice(0, 3)
                .join('');
            const epRuntime = item.episode_run_time && item.episode_run_time.length > 0 ? item.episode_run_time[0] : (item.episode_run_time || 0);
            const epTag = epRuntime ? `<span class="meta-tag">🕐 ${epRuntime} хв/серія</span>` : '';
            const seasonsTag = item.number_of_seasons ? `<span class="meta-tag">📺 ${item.number_of_seasons} сез.</span>` : '';
            const episodesTag = item.number_of_episodes ? `<span class="meta-tag">${item.number_of_episodes} серій</span>` : '';
            const uaTag = item.original_language === 'uk' ? `<span class="meta-tag meta-ua" title="Український оригінал">🇺🇦 UA</span>` : '';
            this.els.resultMeta.innerHTML = `<span class="meta-tag">${_escHtml(year)}</span>${epTag}${seasonsTag}${episodesTag}${uaTag}${genres}`;
            this.els.trailerBtn.classList.remove('hidden');
            this.els.watchedBtn.classList.remove('hidden');
        }
        else if (type === 'book') {
            posterUrl = item.poster || null;
            this.els.resultPoster.src = posterUrl || CONFIG.FALLBACK_BOOK_POSTER;
            this.els.resultPoster.alt = item.title ? `Постер: ${item.title}` : '';
            this.els.resultTitle.textContent = item.title || '';
            const rating = item.average_rating ? Number(item.average_rating).toFixed(1) : '—';
            const bookRatingNumEl = document.getElementById('result-rating-num');
            if (bookRatingNumEl)
                bookRatingNumEl.textContent = rating;
            const desc = item.description
                ? item.description.replace(/<[^>]*>/g, '')
                : (typeof I18N !== 'undefined' ? I18N.t('noDesc') : '');
            this.els.resultDesc.textContent = desc;
            const year = item.year || (item.published_date ? item.published_date.split('-')[0] : '—');
            const authors = (item.authors || []).slice(0, 2).join(', ');
            const categories = (item.categories || [])
                .slice(0, 2)
                .map(c => `<span class="meta-tag">${_escHtml(c)}</span>`)
                .join('');
            const authorTag = authors ? `<span class="meta-tag">${_escHtml(authors)}</span>` : '';
            this.els.resultMeta.innerHTML = `<span class="meta-tag">${_escHtml(year || '—')}</span>${authorTag}${categories}`;
            this.els.trailerBtn.classList.add('hidden');
            this.els.watchedBtn.classList.add('hidden');
        }
        if (cardBg && posterUrl) {
            cardBg.style.backgroundImage = `url(${posterUrl})`;
        }
        else if (cardBg) {
            cardBg.style.backgroundImage = 'none';
        }
        // AI-analysis deep-link: shows for movie/tv (Telegram bot doesn't
        // analyse books). Click opens t.me/PicksySupportBot?start=analyze_…
        // which the bot maps to an auto_analyze_by_id flow.
        const aiBtn = document.getElementById('ai-analyze-btn');
        if (aiBtn) {
            if ((type === 'movie' || type === 'tv') && item && item.id) {
                aiBtn.href = `https://t.me/PicksySupportBot?start=analyze_${type}_${item.id}`;
                aiBtn.classList.remove('hidden');
            }
            else {
                aiBtn.removeAttribute('href');
                aiBtn.classList.add('hidden');
            }
        }
        this.els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    updateSaveBtn(isSaved) {
        if (this.els.saveBtn)
            this.els.saveBtn.classList.toggle('saved', isSaved);
    },
    updateLinkBtn(url) {
        const linkBtn = document.getElementById('link-btn');
        if (!linkBtn)
            return;
        if (url) {
            linkBtn.classList.remove('hidden');
            linkBtn.dataset.url = url;
        }
        else {
            linkBtn.classList.add('hidden');
            linkBtn.dataset.url = '';
        }
    },
    showTrailerModal(videoKey) {
        this.els.trailerWrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoKey}?autoplay=1" allowfullscreen allow="autoplay"></iframe>`;
        this.els.trailerModal.classList.remove('hidden');
    },
    hideTrailerModal() {
        this.els.trailerWrap.innerHTML = '';
        this.els.trailerModal.classList.add('hidden');
    },
    renderSavedList(items, type, isWatched = false) {
        if (items.length === 0) {
            const emptyKey = isWatched ? 'emptyWatched' : 'emptyList';
            this.els.savedList.innerHTML = `<p class="empty-msg">${typeof I18N !== 'undefined' ? I18N.t(emptyKey) : 'Nothing here'}</p>`;
            return;
        }
        let fallback = CONFIG.FALLBACK_POSTER;
        if (type === 'tv')
            fallback = CONFIG.FALLBACK_TV_POSTER;
        else if (type === 'books')
            fallback = CONFIG.FALLBACK_BOOK_POSTER;
        const safeAttr = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const savedType = type === 'tv' ? 'tv' : (type === 'books' || type === 'book') ? 'book' : 'movie';
        const detailPrefix = savedType === 'tv' ? 'desctv' : savedType === 'book' ? 'descbook' : 'descmovie';
        this.els.savedList.innerHTML = items.map((item, i) => {
            const ratingDisplay = item.userRating ? `<span class="user-rating-badge">★ ${item.userRating}/10</span>` : '';
            const watchedDate = item.watchedAt ? new Date(item.watchedAt).toLocaleDateString() : '';
            const itemId = item.id || item.tmdb_id || item.item_id || item.media_id || item.volume_id || item.book_id || '';
            const detailUrl = itemId ? `/${detailPrefix}/${encodeURIComponent(String(itemId))}` : (item.url || '');
            const linkHtml = detailUrl ? `<a class="saved-item-link" data-url="${safeAttr(detailUrl)}" title="Link">🔗</a>` : '';
            if (isWatched) {
                return `
                    <div class="saved-item watched-item" data-index="${i}">
                        <img class="saved-item-poster" src="${item.poster}" alt="" loading="lazy"
                             decoding="async" onerror="this.src='${fallback}'">
                        <div class="saved-item-info">
                            <div class="saved-item-title">${item.title}</div>
                            <div class="saved-item-sub">${item.year || '—'} · ${item.rating || '—'} ${ratingDisplay}</div>
                            ${watchedDate ? `<div class="saved-item-date">${watchedDate}</div>` : ''}
                        </div>
                        <button class="saved-item-note" data-index="${i}" title="${typeof I18N !== 'undefined' ? I18N.t('notesAddFromItem') : 'To note'}">📝</button>
                        <button class="saved-item-rate" data-index="${i}" title="${typeof I18N !== 'undefined' ? I18N.t('rate') : 'Rate'}">★</button>
                        ${item.url ? `<a class="saved-item-link" data-url="${item.url}" title="Link">🔗</a>` : ''}
                        <button class="saved-item-remove" data-index="${i}" title="Remove">&times;</button>
                    </div>
                `;
            }
            return `
                <div class="saved-item" data-index="${i}" draggable="true">
                    <span class="drag-handle" title="Drag to reorder">⠿</span>
                    <img class="saved-item-poster" src="${item.poster}" alt="" loading="lazy"
                         decoding="async" onerror="this.src='${fallback}'">
                    <div class="saved-item-info">
                        <div class="saved-item-title">${item.title}</div>
                        <div class="saved-item-sub">${item.year || '—'} · ${item.rating || '—'}</div>
                    </div>
                    <button class="saved-item-note" data-index="${i}" title="${typeof I18N !== 'undefined' ? I18N.t('notesAddFromItem') : 'To note'}">📝</button>
                    <button class="saved-item-move" data-index="${i}" title="${typeof I18N !== 'undefined' ? I18N.t('markWatched') : 'Mark watched'}">👁</button>
                    ${item.url ? `<a class="saved-item-link" data-url="${item.url}" title="Link">🔗</a>` : ''}
                    <button class="saved-item-remove" data-index="${i}" title="Remove">&times;</button>
                </div>
            `;
        }).join('');
        if (!isWatched)
            this._initDragAndDrop();
    },
    _initDragAndDrop() {
        let dragSrcIndex = null;
        const list = this.els.savedList;
        list.querySelectorAll('.saved-item[draggable]').forEach((item) => {
            item.addEventListener('dragstart', (e) => {
                dragSrcIndex = parseInt(item.dataset.index);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(dragSrcIndex));
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                list.querySelectorAll('.saved-item').forEach(el => el.classList.remove('drag-over'));
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const targetIndex = parseInt(item.dataset.index);
                if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
                    App.reorderSaved(dragSrcIndex, targetIndex);
                }
                dragSrcIndex = null;
            });
            // Touch support for mobile reorder
            let touchStartY = 0;
            let touchSrcIndex = null;
            const handle = item.querySelector('.drag-handle');
            if (handle) {
                handle.addEventListener('touchstart', (e) => {
                    touchStartY = e.touches[0].clientY;
                    touchSrcIndex = parseInt(item.dataset.index);
                    item.classList.add('dragging');
                }, { passive: true });
                handle.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const target = document.elementFromPoint(touch.clientX, touch.clientY);
                    list.querySelectorAll('.saved-item').forEach(el => el.classList.remove('drag-over'));
                    const overItem = target?.closest('.saved-item');
                    if (overItem && overItem !== item) {
                        overItem.classList.add('drag-over');
                    }
                }, { passive: false });
                handle.addEventListener('touchend', (e) => {
                    item.classList.remove('dragging');
                    const touch = e.changedTouches[0];
                    const target = document.elementFromPoint(touch.clientX, touch.clientY);
                    const overItem = target?.closest('.saved-item');
                    list.querySelectorAll('.saved-item').forEach(el => el.classList.remove('drag-over'));
                    if (overItem && touchSrcIndex !== null) {
                        const targetIndex = parseInt(overItem.dataset.index);
                        if (touchSrcIndex !== targetIndex) {
                            App.reorderSaved(touchSrcIndex, targetIndex);
                        }
                    }
                    touchSrcIndex = null;
                }, { passive: true });
            }
        });
    },
    updateSavedCount(count) {
        this.els.savedCount.textContent = count;
    },
    toggleSaved() {
        this.els.savedBody.classList.toggle('hidden');
    },
    showToast(text) {
        this.els.toast.textContent = text;
        this.els.toast.classList.remove('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this.els.toast.classList.add('hidden');
        }, 2500);
        const island = document.getElementById('mobile-dynamic-island');
        if (island) {
            const lower = String(text || '').toLowerCase();
            const tone = lower.includes('помил') || lower.includes('error') || lower.includes('не вдалося')
                ? 'error'
                : lower.includes('видал') || lower.includes('removed') || lower.includes('очищ')
                    ? 'neutral'
                    : 'success';
            const icon = tone === 'error' ? '!' : tone === 'neutral' ? 'i' : '✓';
            island.classList.remove('success', 'error', 'neutral');
            island.classList.add(tone);
            island.innerHTML = '';
            const iconEl = document.createElement('span');
            iconEl.className = 'mobile-dynamic-island-icon';
            iconEl.textContent = icon;
            const textEl = document.createElement('span');
            textEl.className = 'mobile-dynamic-island-text';
            textEl.textContent = text;
            const barEl = document.createElement('span');
            barEl.className = 'mobile-dynamic-island-bar';
            island.append(iconEl, textEl, barEl);
            island.classList.remove('hidden');
            requestAnimationFrame(() => island.classList.add('show'));
            clearTimeout(this._islandTimer);
            this._islandTimer = setTimeout(() => {
                island.classList.remove('show');
                setTimeout(() => island.classList.add('hidden'), 240);
            }, 2300);
        }
    },
};
// Modern saved/tracker renderer. Kept as an override to avoid touching the
// legacy mojibake-heavy block above while still replacing its UI output.
UI.renderSavedList = function (items, type, isWatched = false) {
    if (!this.els.savedList)
        return;
    const esc = (value) => typeof _escHtml === 'function'
        ? _escHtml(String(value ?? ''))
        : String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '\'' }[c]));
    if (!items || items.length === 0) {
        const emptyKey = isWatched ? 'emptyWatched' : 'emptyList';
        this.els.savedList.innerHTML = `<p class="empty-msg">${typeof I18N !== 'undefined' ? I18N.t(emptyKey) : 'Nothing here'}</p>`;
        return;
    }
    let fallback = CONFIG.FALLBACK_POSTER;
    if (type === 'tv')
        fallback = CONFIG.FALLBACK_TV_POSTER;
    else if (type === 'books' || type === 'book')
        fallback = CONFIG.FALLBACK_BOOK_POSTER;
    const savedType = type === 'tv' ? 'tv' : (type === 'books' || type === 'book') ? 'book' : 'movie';
    const detailPrefix = savedType === 'tv' ? 'desctv' : savedType === 'book' ? 'descbook' : 'descmovie';
    const isEn = typeof I18N !== 'undefined' && I18N.current === 'en';
    const labels = {
        note: isEn ? 'Note' : 'Нотатка',
        rate: isEn ? 'Rate' : 'Оцінка',
        watched: isEn ? 'Watched' : 'Вже бачив',
        complete: isEn ? 'Completed' : 'Повністю',
        season: isEn ? 'Season' : 'Сезон',
        episode: isEn ? 'Episode' : 'Серія',
        minute: isEn ? 'Minute' : 'Хвилина',
        page: isEn ? 'Page' : 'Стор.',
    };
    const icon = {
        note: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
        rate: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2 7.5 14 3 9.6l6.2-.9z"/></svg>',
        watched: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/></svg>',
        link: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 14 20 4M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></svg>',
        remove: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    };
    this.els.savedList.innerHTML = items.map((item, i) => {
        const itemId = item.id || item.tmdb_id || item.item_id || item.media_id || item.volume_id || item.book_id || '';
        const detailUrl = itemId ? `/${detailPrefix}/${encodeURIComponent(String(itemId))}` : (item.url || '');
        const watchedDate = item.watchedAt ? new Date(item.watchedAt).toLocaleDateString(isEn ? 'en-US' : 'uk-UA') : '';
        const ratingDisplay = item.userRating ? `<span class="user-rating-badge">★ ${esc(item.userRating)}/10</span>` : '';
        const completed = !!item.completed;
        const season = Math.max(1, parseInt(item.progressSeason || item.season || '1') || 1);
        const episode = Math.max(1, parseInt(item.progressEpisode || item.episode || '1') || 1);
        const minute = Math.max(0, parseInt(item.progressMinute || '0') || 0);
        const page = Math.max(0, parseInt(item.progressPage || '0') || 0);
        const noteBtn = `<button class="saved-item-action saved-item-note" data-index="${i}" title="${labels.note}" aria-label="${labels.note}" type="button">${icon.note}</button>`;
        const rateBtn = `<button class="saved-item-action saved-item-rate" data-index="${i}" title="${labels.rate}" aria-label="${labels.rate}" type="button">${icon.rate}</button>`;
        const watchedBtn = `<button class="saved-item-action saved-item-move" data-index="${i}" title="${labels.watched}" aria-label="${labels.watched}" type="button">${icon.watched}</button>`;
        const linkBtn = detailUrl ? `<a class="saved-item-action saved-item-link" data-url="${esc(detailUrl)}" href="${esc(detailUrl)}" title="Open details" aria-label="Open details">${icon.link}</a>` : '';
        const removeBtn = `<button class="saved-item-action saved-item-remove" data-index="${i}" title="Remove" aria-label="Remove" type="button">${icon.remove}</button>`;
        const completeBtn = `<button class="saved-complete-btn ${completed ? 'active' : ''}" data-index="${i}" type="button">${labels.complete}</button>`;
        let progressHtml = '';
        let progressMeta = '';
        if (isWatched && savedType === 'tv') {
            progressMeta = completed ? labels.complete : `${labels.season} ${season} · ${labels.episode} ${episode}`;
            progressHtml = `<div class="saved-progress-row">
                <label>${labels.season}<input class="saved-progress-input" data-index="${i}" data-field="progressSeason" type="number" min="1" max="99" value="${season}"></label>
                <label>${labels.episode}<input class="saved-progress-input" data-index="${i}" data-field="progressEpisode" type="number" min="1" max="999" value="${episode}"></label>
                ${completeBtn}
            </div>`;
        }
        else if (isWatched && savedType === 'movie') {
            progressMeta = completed ? labels.complete : (minute ? `${minute} ${isEn ? 'min' : 'хв'}` : (isEn ? 'Progress not set' : 'Прогрес не вказано'));
            progressHtml = `<div class="saved-progress-row">
                <label>${labels.minute}<input class="saved-progress-input" data-index="${i}" data-field="progressMinute" type="number" min="0" max="999" value="${minute}"></label>
                ${completeBtn}
            </div>`;
        }
        else if (isWatched && savedType === 'book') {
            progressMeta = completed ? labels.complete : (page ? `${page} ${labels.page}` : (isEn ? 'Progress not set' : 'Прогрес не вказано'));
            progressHtml = `<div class="saved-progress-row">
                <label>${labels.page}<input class="saved-progress-input" data-index="${i}" data-field="progressPage" type="number" min="0" max="9999" value="${page}"></label>
                ${completeBtn}
            </div>`;
        }
        const progressChip = progressMeta ? `<span class="saved-progress-chip">${esc(progressMeta)}</span>` : '';
        const sub = [item.year || '—', item.rating || '—'].filter(Boolean).join(' · ');
        return `
            <div class="saved-item ${isWatched ? 'watched-item' : ''}" data-index="${i}" ${!isWatched ? 'draggable="true"' : ''}>
                ${!isWatched ? '<span class="drag-handle" title="Drag to reorder">::</span>' : ''}
                <img class="saved-item-poster" src="${esc(item.poster || fallback)}" alt="" loading="lazy" decoding="async" onerror="this.src='${fallback}'">
                <div class="saved-item-info">
                    <div class="saved-item-title">${esc(item.title)}</div>
                    <div class="saved-item-sub">${esc(sub)} ${ratingDisplay}</div>
                    ${watchedDate ? `<div class="saved-item-date">${esc(watchedDate)}</div>` : ''}
                    ${progressChip}
                    ${progressHtml}
                </div>
                <div class="saved-item-actions">
                    ${noteBtn}
                    ${isWatched ? rateBtn : watchedBtn}
                    ${linkBtn}
                    ${removeBtn}
                </div>
            </div>
        `;
    }).join('');
    if (!isWatched)
        this._initDragAndDrop();
};
//# sourceMappingURL=ui.js.map