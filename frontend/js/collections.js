// @ts-nocheck
// Collections / Lists feature for Picksy
// Only available for logged-in users
const STORAGE_KEY = 'picksy_collections';
const SAVED_COLLECTIONS_KEY = 'picksy_saved_collections';
const COLLAPSE_KEY = 'picksy_collections_collapsed';
const Collections = {
    data: [],
    savedCollections: [],
    _currentCollectionId: null,
    _activeTab: 'mine',
    _initialized: false,
    init() {
        if (this._initialized)
            return;
        this._initialized = true;
        this.sharedCollections = [];
        this.load();
        this._loadSaved();
        this._bindEvents();
        this._updateVisibility();
        this._applyCollapsedState();
        this.renderCollectionsList();
        this._updateSavedCount();
        this._loadSharedFromServer();
        this._loadSavedFromServer();
        this._loadPublishedFromServer();
        try {
            document.addEventListener('picksy:tier-changed', () => {
                this._updateVisibility();
                this.renderCollectionsList();
            });
        }
        catch (e) { }
    },
    _applyCollapsedState() {
        const body = document.getElementById('collections-body');
        const header = document.getElementById('collections-toggle');
        if (!body)
            return;
        let collapsed;
        try {
            const stored = localStorage.getItem(COLLAPSE_KEY);
            collapsed = stored === null ? true : stored === '1';
        }
        catch (e) {
            collapsed = true;
        }
        if (collapsed)
            body.classList.add('hidden');
        else
            body.classList.remove('hidden');
        if (header)
            header.classList.toggle('is-collapsed', collapsed);
    },
    _saveCollapsedState(collapsed) {
        try {
            localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
        }
        catch (e) { }
    },
    _canUseCollections() {
        try {
            if (typeof Subscription !== 'undefined' && typeof Subscription.hasCollections === 'function') {
                return !!Subscription.hasCollections();
            }
        }
        catch (e) { }
        return true;
    },
    _updateVisibility() {
        const section = document.getElementById('collections-section');
        const addBtn = document.getElementById('add-to-collection-btn');
        const hasToken = !!localStorage.getItem('pfm_token') || !!localStorage.getItem('picksy_token');
        const isLoggedIn = (typeof Auth !== 'undefined' && Auth.user) || hasToken;
        const allowed = this._canUseCollections();
        if (section) {
            section.style.display = (isLoggedIn && allowed) ? '' : 'none';
        }
        if (addBtn) {
            addBtn.style.display = (isLoggedIn && allowed) ? '' : 'none';
        }
    },
    onAuthChange() {
        this._updateVisibility();
        if (typeof Auth !== 'undefined' && Auth.user && this._canUseCollections()) {
            this.loadFromServer();
            this._loadSharedFromServer();
            this._loadSavedFromServer();
            this._loadPublishedFromServer();
        }
        else {
            // Logged out (or downgraded out of collections) — wipe per-user
            // data so a different account on the same browser doesn't see it.
            this.data = [];
            this.savedCollections = [];
            this.sharedCollections = [];
            try {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(SAVED_COLLECTIONS_KEY);
            }
            catch (e) { }
            this._updateSavedCount();
        }
        this.renderCollectionsList();
    },
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            this.data = raw ? JSON.parse(raw) : [];
        }
        catch {
            this.data = [];
        }
    },
    _loadSaved() {
        try {
            const raw = localStorage.getItem(SAVED_COLLECTIONS_KEY);
            this.savedCollections = raw ? JSON.parse(raw) : [];
        }
        catch {
            this.savedCollections = [];
        }
    },
    _saveSavedCollections() {
        localStorage.setItem(SAVED_COLLECTIONS_KEY, JSON.stringify(this.savedCollections));
        this._updateSavedCount();
    },
    saveCollection(col) {
        if (this.savedCollections.some(c => c.id === col.id))
            return;
        this.savedCollections.push({
            id: col.id,
            name: col.name,
            emoji: col.emoji,
            items: col.items || [],
            savedAt: Date.now(),
            ownerName: col.ownerName || (col.owner && col.owner.username) || '',
            slug: col.slug || col._publishedSlug || '',
        });
        this._saveSavedCollections();
        this.renderSavedList();
        UI.showToast(this._t('collectionsSaved'));
    },
    unsaveCollection(colId) {
        this.savedCollections = this.savedCollections.filter(c => c.id !== colId);
        this._saveSavedCollections();
        this.renderSavedList();
        UI.showToast(this._t('collectionsUnsaved'));
    },
    isCollectionSaved(colId) {
        return this.savedCollections.some(c => c.id === colId);
    },
    _updateSavedCount() {
        const countEl = document.getElementById('col-saved-count');
        if (countEl)
            countEl.textContent = String(this.savedCollections.length);
    },
    save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this._syncToServer();
    },
    async _syncToServer() {
        if (typeof Auth === 'undefined' || !Auth.user)
            return;
        try {
            const token = Auth.token || localStorage.getItem('picksy_token');
            if (!token)
                return;
            await fetch(`${CONFIG.API_URL}/api/collections/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ collections: this.data }),
            });
        }
        catch { /* silent */ }
    },
    async loadFromServer() {
        if (typeof Auth === 'undefined' || !Auth.user)
            return;
        try {
            const token = Auth.token || localStorage.getItem('picksy_token');
            if (!token)
                return;
            const res = await fetch(`${CONFIG.API_URL}/api/collections`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                // Always replace local cache with server-of-record so that
                // switching accounts on the same browser doesn't leak the
                // previous user's collections in.
                this.data = Array.isArray(data.collections) ? data.collections : [];
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
                }
                catch (e) { }
                this.renderCollectionsList();
            }
        }
        catch { /* silent */ }
    },
    _isOwner(col) {
        if (!col)
            return false;
        // Collections in this.data (picksy_collections) are always the user's own
        if (this.data.some(c => c.id === col.id))
            return true;
        // For server-side collections, check ownerId/owner_id
        if (typeof Auth !== 'undefined' && Auth.user) {
            const uid = String(Auth.user.id);
            if (col.ownerId)
                return String(col.ownerId) === uid;
            if (col.owner_id)
                return String(col.owner_id) === uid;
            if (col.owner && col.owner.id)
                return String(col.owner.id) === uid;
        }
        return false;
    },
    _isInvited(col) {
        if (!col)
            return false;
        if (col.collaborators && typeof Auth !== 'undefined' && Auth.user) {
            return col.collaborators.includes(Auth.user.id) || col.collaborators.includes(Auth.user.email);
        }
        return false;
    },
    _canEdit(col) {
        return this._isOwner(col);
    },
    _canAddItems(col) {
        return this._isOwner(col) || this._isInvited(col);
    },
    createCollection(name, emoji = '') {
        const userId = (typeof Auth !== 'undefined' && Auth.user) ? Auth.user.id : null;
        const col = {
            id: 'col_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            name: name.trim(),
            emoji: emoji || this._pickEmoji(),
            items: [],
            ownerId: userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.data.push(col);
        this.save();
        this.renderCollectionsList();
        return col;
    },
    deleteCollection(id) {
        const col = this.getCollection(id);
        if (col && !this._isOwner(col)) {
            UI.showToast(this._t('collectionsNoPermission'));
            return;
        }
        this.data = this.data.filter(c => c.id !== id);
        this.save();
        if (this._currentCollectionId === id) {
            this._currentCollectionId = null;
        }
        this.renderCollectionsList();
    },
    renameCollection(id, name, emoji) {
        const col = this.data.find(c => c.id === id);
        if (!col)
            return;
        if (!this._isOwner(col)) {
            UI.showToast(this._t('collectionsNoPermission'));
            return;
        }
        col.name = name.trim();
        if (emoji !== undefined)
            col.emoji = emoji;
        col.updatedAt = Date.now();
        this.save();
        this.renderCollectionsList();
    },
    addItem(collectionId, item) {
        const col = this.data.find(c => c.id === collectionId);
        if (!col)
            return;
        if (!this._canAddItems(col)) {
            UI.showToast(this._t('collectionsNoPermission'));
            return;
        }
        if (col.items.some(i => String(i.id) === String(item.id) && i.type === item.type))
            return;
        col.items.push({ ...item, addedAt: Date.now() });
        col.updatedAt = Date.now();
        this.save();
        this._mirrorAddToPublished(col, item);
    },
    removeItem(collectionId, itemId, itemType) {
        const col = this.data.find(c => c.id === collectionId);
        if (!col)
            return;
        if (!this._canAddItems(col)) {
            UI.showToast(this._t('collectionsNoPermission'));
            return;
        }
        col.items = col.items.filter(i => !(String(i.id) === String(itemId) && i.type === itemType));
        col.updatedAt = Date.now();
        this.save();
        this._mirrorRemoveFromPublished(col, itemId, itemType);
    },
    async _mirrorAddToPublished(col, item) {
        if (!col || !col._publishedId)
            return;
        try {
            const token = (typeof Auth !== 'undefined' && Auth.token) || localStorage.getItem('picksy_token');
            if (!token)
                return;
            await fetch(`${CONFIG.API_URL}/api/collections/${col._publishedId}/items/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ item }),
            });
        }
        catch { /* silent */ }
    },
    async _mirrorRemoveFromPublished(col, itemId, itemType) {
        if (!col || !col._publishedId)
            return;
        try {
            const token = (typeof Auth !== 'undefined' && Auth.token) || localStorage.getItem('picksy_token');
            if (!token)
                return;
            await fetch(`${CONFIG.API_URL}/api/collections/${col._publishedId}/items/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ id: itemId, type: itemType }),
            });
        }
        catch { /* silent */ }
    },
    async _loadPublishedFromServer() {
        if (typeof Auth === 'undefined' || !Auth.user)
            return;
        try {
            const token = Auth.token || localStorage.getItem('picksy_token');
            if (!token)
                return;
            const res = await fetch(`${CONFIG.API_URL}/api/collections/published`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok)
                return;
            const data = await res.json();
            const pubs = data.collections || [];
            // Index by local_id, with name fallback for legacy entries.
            const byLocal = {};
            const byName = {};
            pubs.forEach(p => {
                if (p.local_id)
                    byLocal[p.local_id] = p;
                if (p.name)
                    byName[p.name] = p;
            });
            this.data.forEach(col => {
                const pub = byLocal[col.id] || byName[col.name];
                if (pub) {
                    col._publishedId = pub.id;
                    col._publishedSlug = pub.slug;
                    col._publishedVisibility = pub.visibility;
                }
            });
        }
        catch { /* silent */ }
    },
    getCollection(id) {
        return this.data.find(c => c.id === id);
    },
    _pickEmoji() {
        const emojis = ['🎬', '🍿', '🎭', '🌟', '💫', '🎪', '🎯', '🔥', '💜', '🎉', '🌙', '❄️', '☀️', '🎵', '📖', '🏆', '🎸', '🌈', '🦋', '🍷'];
        return emojis[Math.floor(Math.random() * emojis.length)];
    },
    buildItemFromCurrent() {
        if (!App.currentItem)
            return null;
        const item = App.currentItem;
        const type = App.currentType;
        const record = App.buildSavedRecord(item, type);
        const desc = item.overview || item.description || '';
        const runtime = (typeof item.runtime === 'number' && item.runtime > 0) ? item.runtime : undefined;
        const seasons = (typeof item.number_of_seasons === 'number' && item.number_of_seasons > 0) ? item.number_of_seasons : undefined;
        const episodes = (typeof item.number_of_episodes === 'number' && item.number_of_episodes > 0) ? item.number_of_episodes : undefined;
        let epRuntime = undefined;
        if (Array.isArray(item.episode_run_time) && item.episode_run_time.length > 0) {
            epRuntime = item.episode_run_time[0];
        }
        else if (typeof item.episode_run_time === 'number' && item.episode_run_time > 0) {
            epRuntime = item.episode_run_time;
        }
        const pageCount = (typeof item.page_count === 'number' && item.page_count > 0) ? item.page_count : undefined;
        return {
            id: record.id,
            title: record.title,
            poster: record.poster,
            year: record.year,
            rating: record.rating,
            description: typeof desc === 'string' ? desc.replace(/<[^>]*>/g, '').slice(0, 300) : '',
            url: record.url,
            type: record.type,
            addedAt: Date.now(),
            runtime,
            number_of_seasons: seasons,
            number_of_episodes: episodes,
            episode_run_time: epRuntime,
            page_count: pageCount,
        };
    },
    // ─── UI ───
    _bindEvents() {
        // Toggle collections section
        const toggle = document.getElementById('collections-toggle');
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                // Don't toggle when clicking the create button inside header
                const target = e.target;
                if (target && target.closest && target.closest('#collections-create-btn'))
                    return;
                const body = document.getElementById('collections-body');
                if (!body)
                    return;
                const willCollapse = !body.classList.contains('hidden');
                body.classList.toggle('hidden', willCollapse);
                toggle.classList.toggle('is-collapsed', willCollapse);
                this._saveCollapsedState(willCollapse);
            });
        }
        // Create new collection button
        const createBtn = document.getElementById('collections-create-btn');
        if (createBtn) {
            createBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this._canUseCollections()) {
                    this._showCollectionsUpgrade();
                    return;
                }
                this.showCreateModal();
            });
        }
        const addBtn = document.getElementById('add-to-collection-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                if (!App.currentItem)
                    return;
                if (typeof Auth === 'undefined' || !Auth.user) {
                    UI.showToast(this._t('collectionsLoginRequired'));
                    return;
                }
                if (!this._canUseCollections()) {
                    this._showCollectionsUpgrade();
                    return;
                }
                this.showPickerModal();
            });
        }
        // Tab switching
        const tabMine = document.getElementById('col-tab-mine');
        const tabShared = document.getElementById('col-tab-shared');
        const tabSaved = document.getElementById('col-tab-saved');
        if (tabMine)
            tabMine.addEventListener('click', () => this._switchTab('mine'));
        if (tabShared)
            tabShared.addEventListener('click', () => this._switchTab('shared'));
        if (tabSaved)
            tabSaved.addEventListener('click', () => this._switchTab('saved'));
        // Modal close buttons
        const pickerClose = document.getElementById('col-picker-close');
        const pickerOverlay = document.getElementById('col-picker-overlay');
        if (pickerClose)
            pickerClose.addEventListener('click', () => this.closePickerModal());
        if (pickerOverlay)
            pickerOverlay.addEventListener('click', () => this.closePickerModal());
        const editClose = document.getElementById('col-edit-close');
        const editOverlay = document.getElementById('col-edit-overlay');
        const editCancel = document.getElementById('col-edit-cancel');
        if (editClose)
            editClose.addEventListener('click', () => this.closeEditModal());
        if (editOverlay)
            editOverlay.addEventListener('click', () => this.closeEditModal());
        if (editCancel)
            editCancel.addEventListener('click', () => this.closeEditModal());
        const detailClose = document.getElementById('col-detail-close');
        const detailOverlay = document.getElementById('col-detail-overlay');
        if (detailClose)
            detailClose.addEventListener('click', () => this.closeCollectionDetail());
        if (detailOverlay)
            detailOverlay.addEventListener('click', () => this.closeCollectionDetail());
        // Emoji picker button
        const emojiPickerBtn = document.getElementById('col-edit-emoji-picker-btn');
        if (emojiPickerBtn) {
            emojiPickerBtn.addEventListener('click', () => {
                const input = document.getElementById('col-edit-emoji');
                if (input)
                    this.showEmojiPicker(input);
            });
        }
    },
    _switchTab(tab) {
        this._activeTab = tab;
        const tabs = document.querySelectorAll('#collections-tabs .col-tab');
        tabs.forEach(t => t.classList.remove('active'));
        const mineList = document.getElementById('collections-list');
        const sharedList = document.getElementById('shared-collections-list');
        const savedList = document.getElementById('saved-collections-list');
        if (mineList)
            mineList.classList.add('hidden');
        if (sharedList)
            sharedList.classList.add('hidden');
        if (savedList)
            savedList.classList.add('hidden');
        if (tab === 'mine') {
            document.getElementById('col-tab-mine')?.classList.add('active');
            if (mineList)
                mineList.classList.remove('hidden');
        }
        else if (tab === 'shared') {
            document.getElementById('col-tab-shared')?.classList.add('active');
            if (sharedList)
                sharedList.classList.remove('hidden');
            this.renderSharedList();
            this._loadSharedFromServer();
        }
        else if (tab === 'saved') {
            document.getElementById('col-tab-saved')?.classList.add('active');
            if (savedList)
                savedList.classList.remove('hidden');
            this.renderSavedList();
            this._loadSavedFromServer();
        }
    },
    renderCollectionsList() {
        const list = document.getElementById('collections-list');
        if (!list)
            return;
        const count = document.getElementById('collections-count');
        if (count)
            count.textContent = String(this.data.length + (this.sharedCollections || []).length);
        if (this.data.length === 0) {
            list.innerHTML = `<p class="empty-msg">${this._t('collectionsEmpty')}</p>`;
            return;
        }
        list.innerHTML = this.data.map((col, i) => {
            const previewItems = col.items.slice(0, 4);
            const previewHtml = previewItems.length > 0
                ? `<div class="col-preview">${previewItems.map(item => `<img class="col-preview-img" src="${item.poster}" alt="" loading="lazy" onerror="this.style.display='none'">`).join('')}${col.items.length > 4 ? `<span class="col-preview-more">+${col.items.length - 4}</span>` : ''}</div>`
                : '';
            const isOwner = this._isOwner(col);
            const actionsHtml = isOwner ? `
                        <div class="collection-actions-row">
                            <button class="col-action-btn col-open-btn" data-col-id="${col.id}" title="${this._t('collectionsOpen')}">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                            </button>
                            <button class="col-action-btn col-edit-btn" data-col-id="${col.id}" title="Edit">✏️</button>
                            <button class="col-action-btn col-delete-btn" data-col-id="${col.id}" title="Delete">🗑️</button>
                        </div>` : `
                        <div class="collection-actions-row">
                            <button class="col-action-btn col-open-btn" data-col-id="${col.id}" title="${this._t('collectionsOpen')}">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                            </button>
                            <button class="col-action-btn col-save-btn" data-col-id="${col.id}" title="${this._t('collectionsSaveBtn')}">
                                ${this.isCollectionSaved(col.id) ? '💾' : '📥'}
                            </button>
                        </div>`;
            return `
                <div class="collection-card${!isOwner ? ' shared-card' : ''}" data-col-id="${col.id}" data-index="${i}">
                    <div class="collection-card-main">
                        <span class="collection-emoji">${col.emoji}</span>
                        <div class="collection-info">
                            <div class="collection-name">${this._escHtml(col.name)}</div>
                            <div class="collection-count">${col.items.length} ${this._t('collectionsItems')}</div>
                        </div>
                        ${actionsHtml}
                    </div>
                    ${previewHtml}
                </div>
            `;
        }).join('');
        // Bind open buttons — navigate to /c/slug if published, else open detail modal
        list.querySelectorAll('.col-open-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const colId = btn.dataset.colId;
                if (colId)
                    this._navigateToCollection(colId);
            });
        });
        // Bind card clicks — opens detail modal (not full page)
        list.querySelectorAll('.collection-card').forEach((card) => {
            const el = card;
            el.addEventListener('click', (e) => {
                const target = e.target;
                if (target.closest('.col-action-btn'))
                    return;
                const colId = el.dataset.colId;
                if (colId)
                    this.openCollectionDetail(colId);
            });
        });
        // Bind edit buttons
        list.querySelectorAll('.col-edit-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const colId = btn.dataset.colId;
                if (colId)
                    this.showEditModal(colId);
            });
        });
        // Bind delete buttons
        list.querySelectorAll('.col-delete-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const colId = btn.dataset.colId;
                if (colId)
                    this._confirmDelete(colId);
            });
        });
        // Bind save buttons (for shared collections)
        list.querySelectorAll('.col-save-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const colId = btn.dataset.colId;
                if (!colId)
                    return;
                const col = this.getCollection(colId);
                if (!col)
                    return;
                if (this.isCollectionSaved(colId)) {
                    this.unsaveCollection(colId);
                }
                else {
                    this.saveCollection(col);
                }
                this.renderCollectionsList();
            });
        });
    },
    renderSavedList() {
        const list = document.getElementById('saved-collections-list');
        if (!list)
            return;
        this._updateSavedCount();
        if (this.savedCollections.length === 0) {
            list.innerHTML = `<p class="empty-msg">${this._t('collectionsSavedEmpty')}</p>`;
            return;
        }
        list.innerHTML = this.savedCollections.map((col, i) => {
            const previewItems = (col.items || []).slice(0, 4);
            const previewHtml = previewItems.length > 0
                ? `<div class="col-preview">${previewItems.map(item => `<img class="col-preview-img" src="${item.poster}" alt="" loading="lazy" onerror="this.style.display='none'">`).join('')}${(col.items || []).length > 4 ? `<span class="col-preview-more">+${(col.items || []).length - 4}</span>` : ''}</div>`
                : '';
            return `
                <div class="collection-card saved-card" data-col-id="${col.id}" data-index="${i}">
                    <div class="collection-card-main">
                        <span class="collection-emoji">${col.emoji}</span>
                        <div class="collection-info">
                            <div class="collection-name">${this._escHtml(col.name)}</div>
                            <div class="collection-count">${(col.items || []).length} ${this._t('collectionsItems')}</div>
                            ${col.ownerName ? `<div class="col-shared-by">${this._escHtml(col.ownerName)}</div>` : ''}
                        </div>
                        <div class="collection-actions-row">
                            <button class="col-action-btn col-open-btn" data-col-id="${col.id}" title="${this._t('collectionsOpen')}">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                            </button>
                            <button class="col-action-btn col-unsave-btn" data-col-id="${col.id}" title="${this._t('collectionsUnsave')}">🗑️</button>
                        </div>
                    </div>
                    ${previewHtml}
                </div>
            `;
        }).join('');
        // Bind open buttons
        list.querySelectorAll('.col-open-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const colId = btn.dataset.colId;
                if (colId)
                    this._openSavedCollectionDetail(colId);
            });
        });
        // Bind card clicks
        list.querySelectorAll('.collection-card').forEach((card) => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.col-action-btn'))
                    return;
                const colId = card.dataset.colId;
                if (colId)
                    this._openSavedCollectionDetail(colId);
            });
        });
        // Bind unsave buttons
        list.querySelectorAll('.col-unsave-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const colId = btn.dataset.colId;
                if (colId)
                    this.unsaveCollection(colId);
            });
        });
    },
    _openSavedCollectionDetail(colId) {
        const col = this.savedCollections.find(c => c.id === colId || String(c.id) === String(colId));
        if (!col)
            return;
        // If has slug, navigate to full page
        if (col.slug) {
            window.location.href = `/c/${col.slug}`;
            return;
        }
        this._currentCollectionId = colId;
        const modal = document.getElementById('collection-detail-modal');
        if (!modal)
            return;
        modal.classList.remove('hidden');
        const title = modal.querySelector('.col-detail-title');
        if (title)
            title.textContent = `${col.emoji} ${col.name}`;
        const countEl = modal.querySelector('.col-detail-count');
        if (countEl)
            countEl.textContent = `${(col.items || []).length} ${this._t('collectionsItems')}`;
        this._renderSavedDetailItems(col);
    },
    _renderSavedDetailItems(col) {
        const container = document.getElementById('col-detail-list');
        if (!container)
            return;
        if (!col.items || col.items.length === 0) {
            container.innerHTML = `<p class="empty-msg">${this._t('collectionsEmpty')}</p>`;
            return;
        }
        container.innerHTML = col.items.map((item, i) => {
            const fallback = item.type === 'tv' ? CONFIG.FALLBACK_TV_POSTER
                : item.type === 'book' ? CONFIG.FALLBACK_BOOK_POSTER
                    : CONFIG.FALLBACK_POSTER;
            const typeIcon = item.type === 'tv' ? '📺' : item.type === 'book' ? '📚' : '🎬';
            return `
                <div class="col-detail-item" data-item-index="${i}" data-item-id="${item.id || item.item_id || item.tmdb_id || item.volume_id || ''}" data-item-type="${item.type}" role="button" tabindex="0">
                    <img class="col-detail-poster" src="${item.poster}" alt="" loading="lazy"
                         onerror="this.src='${fallback}'">
                    <div class="col-detail-info">
                        <div class="col-detail-item-title">${this._escHtml(item.title)}</div>
                        <div class="col-detail-item-sub">${typeIcon} ${item.year || '—'} · ⭐ ${item.rating || '—'}</div>
                    </div>
                    <button class="col-detail-note" data-item-index="${i}" title="${this._escHtml(this._t('notesAddFromItem') || 'To note')}">📝</button>
                </div>
            `;
        }).join('');
        container.querySelectorAll('.col-detail-note').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.itemIndex || '-1');
                const item = col.items[idx];
                if (item && typeof App !== 'undefined' && typeof App.addNoteFromItem === 'function') {
                    App.addNoteFromItem(item, item.type || 'movie', 'collection', col.name || '');
                }
            });
        });
        container.querySelectorAll('.col-detail-item').forEach((row) => {
            row.addEventListener('click', (e) => {
                const el = row;
                const itemId = el.dataset.itemId;
                const itemType = el.dataset.itemType;
                if (!itemId || !itemType)
                    return;
                if (typeof App === 'undefined' || typeof App.goToDetailPage !== 'function')
                    return;
                this.closeCollectionDetail();
                const idx = parseInt(el.dataset.itemIndex || '-1');
                App.goToDetailPage(col.items[idx] || itemId, itemType);
            });
        });
    },
    async _loadSharedFromServer() {
        if (typeof Auth === 'undefined' || !Auth.user)
            return;
        try {
            const token = Auth.token || localStorage.getItem('picksy_token');
            if (!token)
                return;
            const res = await fetch(`${CONFIG.API_URL}/api/collections/shared`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                this.sharedCollections = data.collections || [];
                this._updateSharedCount();
                if (this._activeTab === 'shared')
                    this.renderSharedList();
            }
        }
        catch { /* silent */ }
    },
    async _loadSavedFromServer() {
        if (typeof Auth === 'undefined' || !Auth.user)
            return;
        try {
            const token = Auth.token || localStorage.getItem('picksy_token');
            if (!token)
                return;
            const res = await fetch(`${CONFIG.API_URL}/api/collections/feed`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                const liked = (data.collections || []).filter(c => c.is_liked);
                // Merge server liked collections with local saved
                liked.forEach(sc => {
                    if (!this.savedCollections.some(c => String(c.id) === String(sc.id))) {
                        this.savedCollections.push({
                            id: sc.id,
                            name: sc.name,
                            emoji: sc.emoji,
                            items: sc.items || [],
                            savedAt: Date.now(),
                            ownerName: sc.owner?.username || '',
                            slug: sc.slug,
                        });
                    }
                });
                this._updateSavedCount();
                if (this._activeTab === 'saved')
                    this.renderSavedList();
            }
        }
        catch { /* silent */ }
    },
    _updateSharedCount() {
        const el = document.getElementById('col-shared-count');
        if (el)
            el.textContent = String(this.sharedCollections.length);
    },
    renderSharedList() {
        const list = document.getElementById('shared-collections-list');
        if (!list)
            return;
        this._updateSharedCount();
        if (this.sharedCollections.length === 0) {
            list.innerHTML = `<p class="empty-msg">${this._t('collectionsSharedEmpty')}</p>`;
            return;
        }
        list.innerHTML = this.sharedCollections.map((col, i) => {
            const previewItems = (col.items || []).slice(0, 4);
            const previewHtml = previewItems.length > 0
                ? `<div class="col-preview">${previewItems.map(item => `<img class="col-preview-img" src="${item.poster}" alt="" loading="lazy" onerror="this.style.display='none'">`).join('')}${(col.items || []).length > 4 ? `<span class="col-preview-more">+${(col.items || []).length - 4}</span>` : ''}</div>`
                : '';
            const roleLabel = col.my_role === 'editor' ? '✏️' : '👁️';
            return `
                <div class="collection-card shared-card" data-col-slug="${col.slug}" data-index="${i}">
                    <div class="collection-card-main">
                        <span class="collection-emoji">${col.emoji}</span>
                        <div class="collection-info">
                            <div class="collection-name">${this._escHtml(col.name)}</div>
                            <div class="collection-count">${(col.items || []).length} ${this._t('collectionsItems')}</div>
                            <div class="col-shared-by">${roleLabel} ${this._escHtml(col.owner?.username || '')}</div>
                        </div>
                        <div class="collection-actions-row">
                            <button class="col-action-btn col-open-btn" data-col-slug="${col.slug}" title="${this._t('collectionsOpen')}">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                            </button>
                        </div>
                    </div>
                    ${previewHtml}
                </div>
            `;
        }).join('');
        // Bind open/card clicks — navigate to /c/slug
        list.querySelectorAll('.col-open-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const slug = btn.dataset.colSlug;
                if (slug)
                    window.location.href = `/c/${slug}`;
            });
        });
        list.querySelectorAll('.collection-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.col-action-btn'))
                    return;
                const slug = card.dataset.colSlug;
                if (slug)
                    window.location.href = `/c/${slug}`;
            });
        });
    },
    openCollectionDetail(colId) {
        const col = this.getCollection(colId);
        if (!col)
            return;
        this._currentCollectionId = colId;
        const modal = document.getElementById('collection-detail-modal');
        if (!modal)
            return;
        modal.classList.remove('hidden');
        const title = modal.querySelector('.col-detail-title');
        if (title)
            title.textContent = `${col.emoji} ${col.name}`;
        const countEl = modal.querySelector('.col-detail-count');
        if (countEl)
            countEl.textContent = `${col.items.length} ${this._t('collectionsItems')}`;
        // Settings menu for owners
        const actionsContainer = document.getElementById('col-detail-header-actions');
        if (actionsContainer) {
            if (this._isOwner(col)) {
                actionsContainer.innerHTML = `
                    <button class="col-detail-settings-btn" id="col-detail-settings-toggle" title="${this._t('collectionsSettings')}">⚙️</button>
                    <div class="col-settings-dropdown hidden" id="col-settings-dropdown"></div>
                `;
                this._settingsCol = col;
                this._settingsColId = colId;
                this._settingsVisExpanded = false;
                this._bindSettingsToggle();
                this._checkPublishStatus(col, colId);
            }
            else {
                actionsContainer.innerHTML = '';
            }
        }
        // Show save button for non-owned collections
        const shareRow = document.getElementById('col-detail-share-row');
        if (shareRow) {
            if (!this._isOwner(col)) {
                const isSaved = this.isCollectionSaved(colId);
                shareRow.innerHTML = `
                    <button class="col-detail-save-btn" id="col-detail-save-action">
                        ${isSaved ? '💾 ' + this._t('collectionsSaved') : '📥 ' + this._t('collectionsSaveBtn')}
                    </button>
                `;
                const saveBtn = document.getElementById('col-detail-save-action');
                if (saveBtn) {
                    saveBtn.addEventListener('click', () => {
                        if (this.isCollectionSaved(colId)) {
                            this.unsaveCollection(colId);
                        }
                        else {
                            this.saveCollection(col);
                        }
                        const updated = this.isCollectionSaved(colId);
                        saveBtn.innerHTML = updated ? '💾 ' + this._t('collectionsSaved') : '📥 ' + this._t('collectionsSaveBtn');
                    });
                }
            }
            else {
                shareRow.innerHTML = '';
            }
        }
        this._renderDetailItems(col);
    },
    _bindSettingsToggle() {
        const toggleBtn = document.getElementById('col-detail-settings-toggle');
        const dropdown = document.getElementById('col-settings-dropdown');
        if (!toggleBtn || !dropdown)
            return;
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdown.classList.contains('hidden')) {
                this._renderSettingsDropdown();
                dropdown.classList.remove('hidden');
            }
            else {
                dropdown.classList.add('hidden');
            }
        });
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target) && e.target !== toggleBtn) {
                dropdown.classList.add('hidden');
                this._settingsVisExpanded = false;
            }
        };
        document.addEventListener('click', closeDropdown);
        const modalCloseBtn = document.getElementById('col-detail-close');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => document.removeEventListener('click', closeDropdown), { once: true });
        }
    },
    _renderSettingsDropdown() {
        const dropdown = document.getElementById('col-settings-dropdown');
        if (!dropdown)
            return;
        const col = this._settingsCol;
        const colId = this._settingsColId;
        const isPublished = !!col._publishedSlug;
        const visExpanded = this._settingsVisExpanded;
        let html = '';
        // Publish / Unpublish
        if (isPublished) {
            html += `<button class="col-settings-item" data-action="unpublish">
                <span class="col-set-icon">📴</span><span>${this._t('collectionsUnpublish')}</span>
            </button>`;
        }
        else {
            html += `<button class="col-settings-item" data-action="publish">
                <span class="col-set-icon">🌐</span><span>${this._t('collectionsPublish')}</span>
            </button>`;
        }
        // Visibility (only when published)
        if (isPublished) {
            const curVis = col._publishedVisibility || 'public';
            const visLabels = { public: this._t('collectionsVisPublic'), unlisted: this._t('collectionsVisUnlisted'), private: this._t('collectionsVisPrivate') };
            html += `<button class="col-settings-item" data-action="toggle-vis">
                <span class="col-set-icon">👁️</span><span>${this._t('collectionsSetVisibility')}: ${visLabels[curVis] || curVis}</span>
                <span style="margin-left:auto;font-size:.7rem">${visExpanded ? '▲' : '▼'}</span>
            </button>`;
            if (visExpanded) {
                const visIcons = { public: '🌐', unlisted: '🔗', private: '🔒' };
                ['public', 'unlisted', 'private'].forEach(opt => {
                    html += `<button class="col-settings-item" data-action="set-vis" data-vis="${opt}" style="padding-left:36px">
                        <span class="col-set-icon">${visIcons[opt]}</span>
                        <span>${visLabels[opt]}${opt === curVis ? ' ✓' : ''}</span>
                    </button>`;
                });
            }
        }
        html += '<div class="col-settings-divider"></div>';
        // Share
        html += `<button class="col-settings-item" data-action="share">
            <span class="col-set-icon">🔗</span><span>${this._t('collectionsShare')}</span>
        </button>`;
        // Invite editor (published collections only)
        if (isPublished) {
            html += `<button class="col-settings-item" data-action="invite">
                <span class="col-set-icon">👥</span><span>${this._t('collectionsInviteEditor')}</span>
            </button>`;
        }
        // Rename
        html += `<button class="col-settings-item" data-action="rename">
            <span class="col-set-icon">✏️</span><span>${this._t('collectionsRename')}</span>
        </button>`;
        html += '<div class="col-settings-divider"></div>';
        // Delete
        html += `<button class="col-settings-item danger" data-action="delete">
            <span class="col-set-icon">🗑️</span><span>${this._t('collectionsDelete')}</span>
        </button>`;
        dropdown.innerHTML = html;
        // Bind actions
        dropdown.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                switch (action) {
                    case 'publish':
                        dropdown.classList.add('hidden');
                        this._publishCollection(col, colId, 'public');
                        break;
                    case 'unpublish':
                        dropdown.classList.add('hidden');
                        this._unpublishCollection(col, colId);
                        break;
                    case 'toggle-vis':
                        this._settingsVisExpanded = !this._settingsVisExpanded;
                        this._renderSettingsDropdown();
                        break;
                    case 'set-vis':
                        dropdown.classList.add('hidden');
                        this._settingsVisExpanded = false;
                        this._changeVisibility(col, colId, btn.dataset.vis);
                        break;
                    case 'share':
                        dropdown.classList.add('hidden');
                        this._shareCollection(col, colId);
                        break;
                    case 'invite':
                        dropdown.classList.add('hidden');
                        this._inviteEditor(col, colId);
                        break;
                    case 'rename':
                        dropdown.classList.add('hidden');
                        this.closeCollectionDetail();
                        this.showEditModal(colId);
                        break;
                    case 'delete':
                        dropdown.classList.add('hidden');
                        this.closeCollectionDetail();
                        this._confirmDelete(colId);
                        break;
                }
            });
        });
    },
    async _checkPublishStatus(col, colId) {
        try {
            const token = (typeof Auth !== 'undefined' && Auth.token) || localStorage.getItem('picksy_token');
            if (!token)
                return;
            const res = await fetch(`${CONFIG.API_URL}/api/collections/published`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok)
                return;
            const data = await res.json();
            // Match strictly by local_id; fall back to exact name only if local_id is empty (legacy rows).
            const list = data.collections || [];
            let published = list.find(c => c.slug && c.local_id && c.local_id === colId);
            if (!published) {
                published = list.find(c => c.slug && (!c.local_id) && c.name === col.name);
            }
            if (published) {
                col._publishedSlug = published.slug;
                col._publishedId = published.id;
                col._publishedVisibility = published.visibility;
                if (this._settingsCol === col) {
                    this._renderSettingsDropdown();
                }
            }
        }
        catch { /* silent */ }
    },
    async _publishCollection(col, colId, visibility) {
        try {
            const token = (typeof Auth !== 'undefined' && Auth.token) || localStorage.getItem('picksy_token');
            if (!token) {
                UI.showToast(this._t('collectionsLoginRequired'));
                return;
            }
            const res = await fetch(`${CONFIG.API_URL}/api/collections/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    local_id: colId,
                    name: col.name,
                    emoji: col.emoji,
                    description: '',
                    items: col.items,
                    visibility: visibility || 'public',
                }),
            });
            if (res.ok) {
                const data = await res.json();
                UI.showToast(this._t('collectionsPublished'));
                if (data.collection && data.collection.slug) {
                    col._publishedSlug = data.collection.slug;
                    col._publishedId = data.collection.id;
                    col._publishedVisibility = data.collection.visibility;
                }
                if (this._settingsCol === col) {
                    this._renderSettingsDropdown();
                }
            }
            else {
                const err = await res.json().catch(() => ({}));
                UI.showToast(err.detail || 'Error');
            }
        }
        catch {
            UI.showToast('Error');
        }
    },
    async _unpublishCollection(col, colId) {
        try {
            const token = (typeof Auth !== 'undefined' && Auth.token) || localStorage.getItem('picksy_token');
            if (!token)
                return;
            const res = await fetch(`${CONFIG.API_URL}/api/collections/published/${encodeURIComponent(colId)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                UI.showToast(this._t('collectionsUnpublished'));
                col._publishedSlug = null;
                col._publishedId = null;
                col._publishedVisibility = null;
                if (this._settingsCol === col) {
                    this._renderSettingsDropdown();
                }
            }
        }
        catch { /* silent */ }
    },
    async _changeVisibility(col, colId, vis) {
        try {
            const token = (typeof Auth !== 'undefined' && Auth.token) || localStorage.getItem('picksy_token');
            if (!token)
                return;
            const pubId = col._publishedId;
            if (!pubId) {
                await this._publishCollection(col, colId, vis);
                return;
            }
            const res = await fetch(`${CONFIG.API_URL}/api/collections/${pubId}/visibility`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ visibility: vis }),
            });
            if (res.ok) {
                col._publishedVisibility = vis;
                UI.showToast(this._t('collectionsSaved'));
            }
        }
        catch { /* silent */ }
    },
    async _navigateToCollection(colId) {
        const col = this.getCollection(colId);
        if (!col)
            return;
        const token = (typeof Auth !== 'undefined' && Auth.token) || localStorage.getItem('picksy_token');
        // If collection has a known published slug, push the latest items to the
        // server before navigating so /c/<slug> reflects what the user just edited.
        if (col._publishedSlug) {
            await this._syncPublishedItems(col, colId, token);
            window.location.href = `/c/${col._publishedSlug}`;
            return;
        }
        // Try to find the published slug from server (match strictly by local_id;
        // fall back to name only when local_id is missing on a legacy row).
        try {
            if (token) {
                const res = await fetch(`${CONFIG.API_URL}/api/collections/published`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    const list = data.collections || [];
                    const pub = list.find(c => c.local_id && c.local_id === colId)
                        || list.find(c => !c.local_id && c.name === col.name);
                    if (pub && pub.slug) {
                        col._publishedSlug = pub.slug;
                        col._publishedId = pub.id;
                        col._publishedVisibility = pub.visibility;
                        await this._syncPublishedItems(col, colId, token);
                        window.location.href = `/c/${pub.slug}`;
                        return;
                    }
                }
            }
        }
        catch { /* silent */ }
        // Not published — open detail modal
        this.openCollectionDetail(colId);
    },
    async _syncPublishedItems(col, colId, token) {
        if (!col || !col._publishedId || !token)
            return;
        try {
            await fetch(`${CONFIG.API_URL}/api/collections/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    local_id: colId,
                    name: col.name,
                    emoji: col.emoji,
                    description: '',
                    items: col.items || [],
                    visibility: col._publishedVisibility || 'public',
                }),
            });
        }
        catch { /* silent */ }
    },
    async _inviteEditor(col, colId) {
        try {
            if (!col || !col._publishedId) {
                UI.showToast(this._t('collectionsPublishFirst'));
                return;
            }
            const token = (typeof Auth !== 'undefined' && Auth.token) || localStorage.getItem('picksy_token');
            if (!token) {
                UI.showToast(this._t('collectionsLoginRequired'));
                return;
            }
            const res = await fetch(`${CONFIG.API_URL}/api/collections/${col._publishedId}/invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ role: 'editor' }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                UI.showToast(err.detail || 'Error');
                return;
            }
            const data = await res.json();
            if (!data || !data.token) {
                UI.showToast('Error');
                return;
            }
            const url = `${location.origin}/invite/${data.token}`;
            this._showInviteModal(url, col);
        }
        catch (e) {
            UI.showToast('Error');
        }
    },
    _showInviteModal(url, col) {
        const existing = document.getElementById('col-invite-modal');
        if (existing)
            existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'col-invite-modal';
        overlay.className = 'modal';
        overlay.style.cssText = 'display:flex;position:fixed;inset:0;z-index:10000;align-items:center;justify-content:center;padding:16px;';
        overlay.innerHTML = `
            <div class="modal-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);"></div>
            <div class="modal-content glass-deep" style="position:relative;max-width:480px;width:100%;padding:22px 22px 18px;border-radius:18px;">
                <button class="modal-close" id="col-invite-close" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#fff;font-size:1.6rem;cursor:pointer;">&times;</button>
                <h2 style="margin:0 0 8px;font-size:1.2rem;">${this._escHtml(col.emoji || '')} ${this._escHtml(this._t('collectionsInviteTitle'))}</h2>
                <p style="margin:0 0 14px;color:rgba(255,255,255,0.75);font-size:.9rem;line-height:1.45">${this._escHtml(this._t('collectionsInviteDesc'))}</p>
                <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
                    <input type="text" id="col-invite-url" readonly value="${url}" style="flex:1;min-width:200px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.25);color:#fff;font-size:.85rem;"/>
                    <button id="col-invite-copy" class="col-detail-save-btn" style="padding:10px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;cursor:pointer;font-weight:700;">${this._escHtml(this._t('collectionsCopyLink'))}</button>
                </div>
                <p style="margin:0;color:rgba(255,255,255,0.55);font-size:.78rem">${this._escHtml(this._t('collectionsInviteHint'))}</p>
            </div>
        `;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        const closeBtn = document.getElementById('col-invite-close');
        if (closeBtn)
            closeBtn.addEventListener('click', close);
        const overlayBg = overlay.querySelector('.modal-overlay');
        if (overlayBg)
            overlayBg.addEventListener('click', close);
        const copyBtn = document.getElementById('col-invite-copy');
        const inp = document.getElementById('col-invite-url');
        if (copyBtn && inp) {
            copyBtn.addEventListener('click', () => {
                try {
                    inp.select();
                    inp.setSelectionRange(0, 99999);
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(url).then(() => UI.showToast(this._t('collectionsLinkCopied')));
                    }
                    else {
                        document.execCommand('copy');
                        UI.showToast(this._t('collectionsLinkCopied'));
                    }
                }
                catch (e) { /* silent */ }
            });
        }
        setTimeout(() => inp?.focus(), 50);
    },
    _shareCollection(col, colId) {
        if (col._publishedSlug) {
            const url = `${location.origin}/c/${col._publishedSlug}`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                    UI.showToast(this._t('collectionsLinkCopied'));
                }).catch(() => {
                    prompt(this._t('collectionsCopyLink'), url);
                });
            }
            else {
                prompt(this._t('collectionsCopyLink'), url);
            }
        }
        else {
            UI.showToast(this._t('collectionsPublish'));
        }
    },
    _renderDetailItems(col) {
        const container = document.getElementById('col-detail-list');
        if (!container)
            return;
        if (col.items.length === 0) {
            container.innerHTML = `<p class="empty-msg">${this._t('collectionsEmpty')}</p>`;
            return;
        }
        const canModify = this._canAddItems(col);
        container.innerHTML = col.items.map((item, i) => {
            const fallback = item.type === 'tv' ? CONFIG.FALLBACK_TV_POSTER
                : item.type === 'book' ? CONFIG.FALLBACK_BOOK_POSTER
                    : CONFIG.FALLBACK_POSTER;
            const typeIcon = item.type === 'tv' ? '📺' : item.type === 'book' ? '📚' : '🎬';
            const descHtml = item.description
                ? `<div class="col-detail-item-desc">${this._escHtml(item.description.slice(0, 150))}${item.description.length > 150 ? '…' : ''}</div>`
                : '';
            const chips = [];
            if (item.type === 'movie' && item.runtime) {
                chips.push(`<span class="col-chip col-chip-runtime">⏱️ ${item.runtime} хв</span>`);
            }
            else if (item.type === 'tv') {
                if (item.number_of_seasons) {
                    chips.push(`<span class="col-chip col-chip-seasons">📺 ${item.number_of_seasons} сез.</span>`);
                }
                if (item.number_of_episodes) {
                    chips.push(`<span class="col-chip col-chip-seasons">🎞️ ${item.number_of_episodes} еп.</span>`);
                }
                if (item.episode_run_time) {
                    chips.push(`<span class="col-chip col-chip-runtime">⏱️ ${item.episode_run_time} хв/сер.</span>`);
                }
            }
            else if (item.type === 'book' && item.page_count) {
                chips.push(`<span class="col-chip col-chip-pages">📄 ${item.page_count} стор.</span>`);
            }
            const chipsHtml = chips.length
                ? `<div class="col-detail-item-chips">${chips.join('')}</div>`
                : '';
            const removeBtn = canModify ? `
                    <button class="col-detail-remove" data-item-id="${item.id || item.item_id || item.tmdb_id || item.volume_id || ''}" data-item-type="${item.type}" title="${this._t('collectionsRemoveItem')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>` : '';
            const noteBtn = `
                    <button class="col-detail-note" data-item-index="${i}" title="${this._escHtml(this._t('notesAddFromItem') || 'To note')}">📝</button>`;
            return `
                <div class="col-detail-item" data-item-index="${i}" data-item-id="${item.id || item.item_id || item.tmdb_id || item.volume_id || ''}" data-item-type="${item.type}" role="button" tabindex="0">
                    <img class="col-detail-poster" src="${item.poster}" alt="" loading="lazy"
                         onerror="this.src='${fallback}'">
                    <div class="col-detail-info">
                        <div class="col-detail-item-title">${this._escHtml(item.title)}</div>
                        <div class="col-detail-item-sub">${typeIcon} ${item.year || '—'} · ⭐ ${item.rating || '—'}</div>
                        ${chipsHtml}
                        ${descHtml}
                    </div>
                    ${noteBtn}
                    ${removeBtn}
                </div>
            `;
        }).join('');
        // Make rows open the same full detail deck that picked items use.
        container.querySelectorAll('.col-detail-item').forEach((row) => {
            const open = (e) => {
                if (e.target.closest('.col-detail-remove') || e.target.closest('.col-detail-note'))
                    return;
                const el = row;
                const itemId = el.dataset.itemId;
                const itemType = el.dataset.itemType;
                if (!itemId || !itemType)
                    return;
                if (typeof App === 'undefined' || typeof App.goToDetailPage !== 'function')
                    return;
                this.closeCollectionDetail();
                const idx = parseInt(el.dataset.itemIndex || '-1');
                App.goToDetailPage(col.items[idx] || itemId, itemType);
            };
            row.addEventListener('click', open);
            row.addEventListener('keydown', (e) => {
                const ke = e;
                if (ke.key === 'Enter' || ke.key === ' ') {
                    ke.preventDefault();
                    open(e);
                }
            });
        });
        container.querySelectorAll('.col-detail-note').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.itemIndex || '-1');
                const item = col.items[idx];
                if (item && typeof App !== 'undefined' && typeof App.addNoteFromItem === 'function') {
                    App.addNoteFromItem(item, item.type || 'movie', 'collection', col.name || '');
                }
            });
        });
        if (canModify) {
            container.querySelectorAll('.col-detail-remove').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const itemId = btn.dataset.itemId;
                    const itemType = btn.dataset.itemType;
                    if (itemId && itemType && this._currentCollectionId) {
                        const row = btn.closest('.col-detail-item');
                        if (row) {
                            row.style.transition = 'all 0.3s ease';
                            row.style.opacity = '0';
                            row.style.transform = 'translateX(60px)';
                            row.style.maxHeight = row.offsetHeight + 'px';
                            setTimeout(() => {
                                row.style.maxHeight = '0';
                                row.style.padding = '0';
                                row.style.margin = '0';
                            }, 150);
                        }
                        setTimeout(() => {
                            this.removeItem(this._currentCollectionId, itemId, itemType);
                            const updated = this.getCollection(this._currentCollectionId);
                            if (updated) {
                                this._renderDetailItems(updated);
                                const countEl = document.querySelector('.col-detail-count');
                                if (countEl)
                                    countEl.textContent = `${updated.items.length} ${this._t('collectionsItems')}`;
                            }
                            this.renderCollectionsList();
                            UI.showToast(this._t('collectionsRemoved'));
                        }, 350);
                    }
                });
            });
        }
    },
    closeCollectionDetail() {
        const modal = document.getElementById('collection-detail-modal');
        if (modal)
            modal.classList.add('hidden');
        this._currentCollectionId = null;
    },
    // ─── Picker Modal (choose collection to add item to) ───
    showPickerModal() {
        if (!App.currentItem)
            return;
        if (typeof Auth === 'undefined' || !Auth.user)
            return;
        const modal = document.getElementById('collection-picker-modal');
        if (!modal)
            return;
        modal.classList.remove('hidden');
        const item = App.currentItem;
        const title = item.title || item.name || item.original_title || '';
        const pickerTitle = modal.querySelector('.col-picker-title');
        if (pickerTitle)
            pickerTitle.textContent = this._t('collectionsAddTo');
        const itemInfo = modal.querySelector('.col-picker-item-info');
        if (itemInfo)
            itemInfo.textContent = title;
        this._renderPickerList();
    },
    _renderPickerList() {
        const list = document.getElementById('col-picker-list');
        if (!list)
            return;
        const currentItem = this.buildItemFromCurrent();
        let html = `
            <button class="col-picker-new" id="col-picker-new-btn">
                <span class="col-picker-new-icon">+</span>
                <span>${this._t('collectionsCreate')}</span>
            </button>
        `;
        // Own collections
        const ownCollections = this.data.filter(col => this._isOwner(col));
        html += ownCollections.map(col => {
            const isInCol = currentItem && col.items.some(i => String(i.id) === String(currentItem.id) && i.type === currentItem.type);
            return `
                <button class="col-picker-item ${isInCol ? 'col-picker-item-active' : ''}" data-col-id="${col.id}" data-local="1">
                    <span class="col-picker-emoji">${col.emoji}</span>
                    <span class="col-picker-name">${this._escHtml(col.name)}</span>
                    <span class="col-picker-badge">${col.items.length}</span>
                    ${isInCol ? '<span class="col-picker-check">✓</span>' : ''}
                </button>
            `;
        }).join('');
        // Shared collections (where user is editor)
        const sharedEditable = (this.sharedCollections || []).filter(c => c.my_role === 'editor' || c.my_role === 'owner');
        if (sharedEditable.length > 0) {
            html += sharedEditable.map(col => {
                const isInCol = currentItem && (col.items || []).some(i => String(i.id) === String(currentItem.id) && i.type === currentItem.type);
                return `
                    <button class="col-picker-item ${isInCol ? 'col-picker-item-active' : ''}" data-shared-id="${col.id}" data-local="0">
                        <span class="col-picker-emoji">${col.emoji}</span>
                        <span class="col-picker-name">${this._escHtml(col.name)}</span>
                        <span class="col-picker-badge">${(col.items || []).length}</span>
                        <span style="font-size:.65rem;color:rgba(255,255,255,0.4)">👥</span>
                        ${isInCol ? '<span class="col-picker-check">✓</span>' : ''}
                    </button>
                `;
            }).join('');
        }
        list.innerHTML = html;
        const newBtn = document.getElementById('col-picker-new-btn');
        if (newBtn) {
            newBtn.addEventListener('click', () => {
                this.closePickerModal();
                this.showCreateModal(true);
            });
        }
        // Bind local collection items
        list.querySelectorAll('.col-picker-item[data-col-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const colId = btn.dataset.colId;
                if (!colId)
                    return;
                const item = this.buildItemFromCurrent();
                if (!item)
                    return;
                const col = this.getCollection(colId);
                if (!col)
                    return;
                const isInCol = col.items.some(i => String(i.id) === String(item.id) && i.type === item.type);
                if (isInCol) {
                    this.removeItem(colId, item.id, item.type);
                    UI.showToast(this._t('collectionsRemoved'));
                }
                else {
                    this.addItem(colId, item);
                    UI.showToast(`${this._t('collectionsAdded')} "${col.name}"`);
                }
                this._renderPickerList();
                this.renderCollectionsList();
            });
        });
        // Bind shared collection items (use API)
        list.querySelectorAll('.col-picker-item[data-shared-id]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const cid = btn.dataset.sharedId;
                if (!cid)
                    return;
                const item = this.buildItemFromCurrent();
                if (!item)
                    return;
                try {
                    const token = (typeof Auth !== 'undefined' && Auth.token) || localStorage.getItem('picksy_token');
                    if (!token)
                        return;
                    const res = await fetch(`${CONFIG.API_URL}/api/collections/${cid}/items/add`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ item }),
                    });
                    if (res.ok) {
                        const sc = this.sharedCollections.find(c => String(c.id) === String(cid));
                        if (sc) {
                            sc.items = sc.items || [];
                            sc.items.push(item);
                        }
                        UI.showToast(`${this._t('collectionsAdded')} "${sc?.name || ''}"`);
                    }
                    else {
                        const err = await res.json().catch(() => ({}));
                        UI.showToast(err.detail || 'Error');
                    }
                }
                catch {
                    UI.showToast('Error');
                }
                this._renderPickerList();
            });
        });
    },
    closePickerModal() {
        const modal = document.getElementById('collection-picker-modal');
        if (modal)
            modal.classList.add('hidden');
    },
    // ─── Create / Edit Modals ───
    showCreateModal(addCurrentAfter = false) {
        const modal = document.getElementById('collection-edit-modal');
        if (!modal)
            return;
        modal.classList.remove('hidden');
        const titleEl = modal.querySelector('.col-edit-title');
        if (titleEl)
            titleEl.textContent = this._t('collectionsCreate');
        const nameInput = document.getElementById('col-edit-name');
        const emojiInput = document.getElementById('col-edit-emoji');
        if (nameInput)
            nameInput.value = '';
        if (emojiInput)
            emojiInput.value = this._pickEmoji();
        const saveBtn = document.getElementById('col-edit-save');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const name = nameInput?.value?.trim();
                if (!name) {
                    nameInput?.focus();
                    return;
                }
                const emoji = emojiInput?.value?.trim() || this._pickEmoji();
                const col = this.createCollection(name, emoji);
                if (addCurrentAfter && App.currentItem) {
                    const item = this.buildItemFromCurrent();
                    if (item) {
                        this.addItem(col.id, item);
                        UI.showToast(`${this._t('collectionsAdded')} "${col.name}"`);
                    }
                }
                this.closeEditModal();
                if (addCurrentAfter) {
                    this.showPickerModal();
                }
            };
        }
        setTimeout(() => nameInput?.focus(), 100);
    },
    showEditModal(colId) {
        const col = this.getCollection(colId);
        if (!col)
            return;
        if (!this._isOwner(col)) {
            UI.showToast(this._t('collectionsNoPermission'));
            return;
        }
        const modal = document.getElementById('collection-edit-modal');
        if (!modal)
            return;
        modal.classList.remove('hidden');
        const titleEl = modal.querySelector('.col-edit-title');
        if (titleEl)
            titleEl.textContent = this._t('collectionsEdit');
        const nameInput = document.getElementById('col-edit-name');
        const emojiInput = document.getElementById('col-edit-emoji');
        if (nameInput)
            nameInput.value = col.name;
        if (emojiInput)
            emojiInput.value = col.emoji;
        const saveBtn = document.getElementById('col-edit-save');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const name = nameInput?.value?.trim();
                if (!name) {
                    nameInput?.focus();
                    return;
                }
                const emoji = emojiInput?.value?.trim() || col.emoji;
                this.renameCollection(colId, name, emoji);
                this.closeEditModal();
            };
        }
        setTimeout(() => nameInput?.focus(), 100);
    },
    closeEditModal() {
        const modal = document.getElementById('collection-edit-modal');
        if (modal)
            modal.classList.add('hidden');
    },
    _confirmDelete(colId) {
        const col = this.getCollection(colId);
        if (!col)
            return;
        if (!this._isOwner(col)) {
            UI.showToast(this._t('collectionsNoPermission'));
            return;
        }
        const msg = this._t('collectionsDeleteConfirm').replace('{name}', col.name);
        if (confirm(msg)) {
            this.deleteCollection(colId);
            UI.showToast(this._t('collectionsDeleted'));
        }
    },
    // ─── Emoji Picker ───
    showEmojiPicker(targetInput) {
        const existing = document.querySelector('.emoji-quick-picker');
        if (existing) {
            existing.remove();
            return;
        }
        const emojis = ['🎬', '🍿', '🎭', '🌟', '💫', '🎪', '🎯', '🔥', '💜', '🎉', '🌙', '❄️', '☀️', '🎵', '📖', '🏆', '🎸', '🌈', '🦋', '🍷', '💕', '🎄', '🎂', '🏠', '✈️', '🌊', '🍕', '🎮', '👻', '🤖'];
        const picker = document.createElement('div');
        picker.className = 'emoji-quick-picker';
        picker.innerHTML = emojis.map(e => `<button class="emoji-pick-btn" type="button">${e}</button>`).join('');
        targetInput.parentElement?.appendChild(picker);
        picker.querySelectorAll('.emoji-pick-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                targetInput.value = btn.textContent || '';
                picker.remove();
            });
        });
        setTimeout(() => {
            const close = (e) => {
                if (!e.target.closest('.emoji-quick-picker') && e.target !== targetInput) {
                    picker.remove();
                    document.removeEventListener('click', close);
                }
            };
            document.addEventListener('click', close);
        }, 10);
    },
    // ─── Helpers ───
    _t(key) {
        if (typeof I18N !== 'undefined' && I18N.t)
            return I18N.t(key);
        const fallbacks = {
            collectionsTitle: 'Collections',
            collectionsEmpty: 'No collections yet. Create your first!',
            collectionsItems: 'items',
            collectionsCreate: 'New collection',
            collectionsEdit: 'Edit collection',
            collectionsDelete: 'Delete',
            collectionsDeleteConfirm: 'Delete collection "{name}"?',
            collectionsDeleted: 'Collection deleted',
            collectionsAddTo: 'Add to collection',
            collectionsAdded: 'Added to',
            collectionsRemoved: 'Removed from collection',
            collectionsRemoveItem: 'Remove from collection',
            collectionsLoginRequired: 'Log in to use collections',
            collectionsName: 'Name',
            collectionsEmoji: 'Icon',
            collectionsSave: 'Save',
            collectionsCancel: 'Cancel',
            collectionsOpen: 'Open',
            collectionsSaveBtn: 'Save',
            collectionsSaved: 'Saved',
            collectionsUnsaved: 'Removed from saved',
            collectionsUnsave: 'Remove from saved',
            collectionsSavedEmpty: 'No saved collections yet',
            collectionsTabSaved: 'Saved',
            collectionsNoPermission: 'No permission',
            collectionsSettings: 'Settings',
            collectionsPublish: 'Make public',
            collectionsUnpublish: 'Unpublish',
            collectionsPublished: 'Collection published!',
            collectionsUnpublished: 'Collection unpublished',
            collectionsVisPublic: 'Public',
            collectionsVisUnlisted: 'Unlisted',
            collectionsVisPrivate: 'Private',
            collectionsSetVisibility: 'Visibility',
            collectionsShare: 'Share',
            collectionsRename: 'Rename',
            collectionsCopyLink: 'Copy link',
            collectionsLinkCopied: 'Link copied!',
            collectionsInviteEditor: 'Invite editor',
            collectionsInviteTitle: 'Invite an editor',
            collectionsInviteDesc: 'Send this link to a friend. Whoever opens it can add or remove titles together with you.',
            collectionsInviteHint: 'Link can be used up to 5 times.',
            collectionsPublishFirst: 'Publish the collection first',
        };
        return fallbacks[key] || key;
    },
    _escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
    _showCollectionsUpgrade() {
        try {
            const msg = (typeof I18N !== 'undefined' && I18N.current === 'en')
                ? '📁 Collections — Premium and Pro only. Upgrade your subscription!'
                : '📁 Колекції — на Premium та Pro. Оновіть підписку!';
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast(msg);
            }
        }
        catch (e) { }
        try {
            if (typeof Subscription !== 'undefined' && typeof Subscription.showUpgradeModal === 'function') {
                Subscription.showUpgradeModal();
            }
        }
        catch (e) { }
    },
};
// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Collections.init());
}
else {
    Collections.init();
}
//# sourceMappingURL=collections.js.map