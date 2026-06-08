/**
 * Picksy — Вгадай Фільм (Movie Guess Game)
 * Two players guess the rating and release year of a random movie.
 * Closest guess wins and earns rating points.
 */
const Game = {
    matchId: null,
    pollTimer: null,
    countdownTimer: null,
    timeLeft: 60,
    state: null, // 'idle' | 'searching' | 'playing' | 'guessing' | 'waiting_opponent' | 'finished'
    get API() { return CONFIG.API_URL; },
    get headers() { return { 'Content-Type': 'application/json', ...Auth.getAuthHeaders() }; },
    init() {
        this.cacheElements();
        this.bindEvents();
        window.addEventListener('beforeunload', (e) => {
            if (this.matchId && (this.state === 'playing' || this.state === 'guessing' || this.state === 'waiting_opponent')) {
                // Use sendBeacon for reliable delivery on page close
                const url = `${this.API}/api/game/forfeit/${this.matchId}`;
                const token = localStorage.getItem('pfm_token') || '';
                navigator.sendBeacon(url, new Blob([JSON.stringify({ token })], { type: 'application/json' }));
                e.preventDefault();
                e.returnValue = '';
            }
        });
    },
    cacheElements() {
        this.modal = document.getElementById('game-modal');
        this.btnOpen = document.getElementById('game-open-btn');
        this.screenMenu = document.getElementById('game-screen-menu');
        this.screenSearch = document.getElementById('game-screen-search');
        this.screenPlay = document.getElementById('game-screen-play');
        this.screenResult = document.getElementById('game-screen-result');
        this.leaderboardBody = document.getElementById('game-leaderboard-body');
        this.myRating = document.getElementById('game-my-rating');
        this.myRecord = document.getElementById('game-my-record');
    },
    lobbyCode: null,
    bindEvents() {
        if (this.btnOpen)
            this.btnOpen.addEventListener('click', () => this.open());
        document.getElementById('game-close-btn')?.addEventListener('click', () => this.close());
        document.getElementById('game-find-btn')?.addEventListener('click', () => this.findMatch());
        document.getElementById('game-cancel-btn')?.addEventListener('click', () => this.cancelSearch());
        document.getElementById('game-guess-btn')?.addEventListener('click', () => this.submitGuess());
        document.getElementById('game-play-again-btn')?.addEventListener('click', () => this.findMatch());
        document.getElementById('game-rematch-btn')?.addEventListener('click', () => this.findMatch());
        document.getElementById('game-back-btn')?.addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('game-history-btn')?.addEventListener('click', () => this.loadGameHistory());
        // Close on overlay click
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal)
                this.close();
        });
        this.initLobbyUI();
    },
    initLobbyUI() {
        const menuScreen = this.screenMenu;
        if (!menuScreen || document.getElementById('game-lobby-section'))
            return;
        const section = document.createElement('div');
        section.id = 'game-lobby-section';
        section.className = 'game-lobby-section';
        const t = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k;
        section.innerHTML = `
            <div style="text-align:center;font-size:.75rem;color:rgba(255,255,255,.3);margin:4px 0">${t('gamePlayWithFriend')}</div>
            <button class="game-lobby-btn" id="game-create-lobby-btn">🏠 ${t('gameCreateLobby')}</button>
            <div class="game-join-lobby-row" style="flex-direction:column;align-items:stretch">
                <input class="game-join-input" id="game-join-code-input" placeholder="КОД" maxlength="6" style="width:100%;text-align:center">
                <button class="game-join-btn" id="game-join-lobby-btn" style="width:100%;margin-top:6px">${t('gameJoin')}</button>
            </div>
            <div class="game-lobby-code-box hidden" id="game-lobby-code-box">
                <div style="font-size:.85rem;color:rgba(255,255,255,.6)">${t('gameLobbyCode')}</div>
                <div class="game-lobby-code" id="game-lobby-code-display"></div>
                <button class="game-lobby-copy-btn" id="game-lobby-copy-btn">📋 ${t('gameCopyCode')}</button>
                <div style="font-size:.78rem;color:rgba(255,255,255,.4)">${t('gameWaitingOpponent')}</div>
            </div>
        `;
        menuScreen.appendChild(section);
        document.getElementById('game-create-lobby-btn')?.addEventListener('click', () => this.createLobby());
        document.getElementById('game-join-lobby-btn')?.addEventListener('click', () => this.joinLobby());
        document.getElementById('game-lobby-copy-btn')?.addEventListener('click', () => this.copyLobbyCode());
    },
    async createLobby() {
        try {
            const res = await fetch(`${this.API}/api/game/create-lobby`, {
                method: 'POST', headers: this.headers,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                UI.showToast(err.detail || 'Помилка створення лобі');
                return;
            }
            const d = await res.json();
            this.matchId = d.match_id;
            this.lobbyCode = d.lobby_code;
            const codeBox = document.getElementById('game-lobby-code-box');
            const codeDisplay = document.getElementById('game-lobby-code-display');
            if (codeBox)
                codeBox.classList.remove('hidden');
            if (codeDisplay)
                codeDisplay.textContent = d.lobby_code;
            this.state = 'searching';
            this.startPolling();
        }
        catch (e) {
            UI.showToast('Помилка створення лобі');
        }
    },
    async joinLobby() {
        const input = document.getElementById('game-join-code-input');
        const code = (input?.value || '').trim().toUpperCase();
        if (!code || code.length < 4) {
            UI.showToast('Введіть код лобі');
            return;
        }
        try {
            const res = await fetch(`${this.API}/api/game/join-lobby`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ lobby_code: code }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                UI.showToast(err.detail || 'Лобі не знайдено');
                return;
            }
            const d = await res.json();
            this.matchId = d.match_id;
            this.onMatchReady();
        }
        catch (e) {
            UI.showToast('Помилка підключення до лобі');
        }
    },
    copyLobbyCode() {
        if (!this.lobbyCode)
            return;
        navigator.clipboard.writeText(this.lobbyCode).then(() => {
            UI.showToast('Код скопійовано: ' + this.lobbyCode);
        }).catch(() => {
            UI.showToast(this.lobbyCode);
        });
    },
    async open() {
        if (!Auth.token) {
            UI.showToast(I18N.t('saveHint'));
            return;
        }
        this.modal?.classList.remove('hidden');
        const fab = document.getElementById('fab-container');
        if (fab)
            fab.style.display = 'none';
        this.showScreen('menu');
        await this.loadMyRating();
        await this.loadLeaderboard();
    },
    close() {
        this.modal?.classList.add('hidden');
        const fab = document.getElementById('fab-container');
        if (fab)
            fab.style.display = '';
        this.stopPolling();
        this.stopCountdown();
        if (this.state === 'searching' && this.matchId) {
            this.cancelSearch();
        }
        if ((this.state === 'playing' || this.state === 'guessing' || this.state === 'waiting_opponent') && this.matchId) {
            this.forfeitMatch();
        }
    },
    async forfeitMatch() {
        if (!this.matchId)
            return;
        try {
            await fetch(`${this.API}/api/game/forfeit/${this.matchId}`, {
                method: 'POST',
                headers: this.headers,
            });
        }
        catch { }
        this.matchId = null;
        this.state = 'idle';
    },
    showScreen(name) {
        ['menu', 'search', 'play', 'result', 'history'].forEach(s => {
            const el = document.getElementById('game-screen-' + s);
            if (el)
                el.classList.toggle('hidden', s !== name);
        });
    },
    async loadMyRating() {
        try {
            const res = await fetch(`${this.API}/api/game/rating`, { headers: this.headers });
            if (!res.ok)
                return;
            const d = await res.json();
            if (this.myRating)
                this.myRating.textContent = d.rating;
            if (this.myRecord)
                this.myRecord.textContent = `${d.wins}W / ${d.losses}L / ${d.draws}D`;
            // Show rank badge
            let rankEl = document.getElementById('game-my-rank');
            if (!rankEl) {
                rankEl = document.createElement('div');
                rankEl.id = 'game-my-rank';
                rankEl.className = 'game-my-rank';
                const ratingEl = this.myRating;
                if (ratingEl && ratingEl.parentNode) {
                    ratingEl.parentNode.insertBefore(rankEl, ratingEl.nextSibling);
                }
            }
            if (d.rank) {
                rankEl.innerHTML = `<span style="color:${d.rank.color}">${d.rank.icon} ${d.rank.name}</span>`;
                if (d.next_rank) {
                    const progress = d.next_rank.min_rating > 0 ? Math.min(100, ((d.rating - (d.rank.min_rating || 0)) / (d.next_rank.min_rating - (d.rank.min_rating || 0))) * 100) : 100;
                    rankEl.innerHTML += `<div class="game-rank-progress"><div class="game-rank-progress-fill" style="width:${progress}%;background:${d.rank.color}"></div></div>
                    <small style="color:rgba(255,255,255,.4)">До ${d.next_rank.icon} ${d.next_rank.name}: ${d.next_rank.min_rating - d.rating} рейтингу</small>`;
                }
            }
            // Show win streak
            const streakEl = document.getElementById('game-my-streak');
            if (streakEl && d.win_streak > 0) {
                streakEl.textContent = `🔥 ${d.win_streak}`;
                streakEl.classList.remove('hidden');
            }
            else if (streakEl) {
                streakEl.classList.add('hidden');
            }
            // Show total games
            const totalEl = document.getElementById('game-my-total');
            if (totalEl)
                totalEl.textContent = `${d.wins + d.losses + d.draws} ігор`;
            const findBtn = document.getElementById('game-find-btn');
            if (d.game_banned) {
                if (findBtn) {
                    findBtn.disabled = true;
                    findBtn.textContent = '🚫 Вас забанено в грі';
                    findBtn.style.opacity = '0.5';
                }
            }
            else {
                if (findBtn) {
                    findBtn.disabled = false;
                    findBtn.textContent = '⚔️ Знайти суперника';
                    findBtn.style.opacity = '1';
                }
            }
        }
        catch { }
    },
    async loadLeaderboard() {
        try {
            const res = await fetch(`${this.API}/api/game/leaderboard`, { headers: this.headers });
            if (!res.ok)
                return;
            const rows = await res.json();
            if (!this.leaderboardBody)
                return;
            if (!rows.length) {
                this.leaderboardBody.innerHTML = '<div class="game-empty">Поки ніхто не грав</div>';
                return;
            }
            this.leaderboardBody.innerHTML = rows.map((r, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                const emoji = r.avatar_emoji || '👤';
                const streak = r.win_streak ? `<span class="game-lb-streak">🔥${r.win_streak}</span>` : '';
                const rankIcon = r.rank ? `<span style="color:${r.rank.color}" title="${r.rank.name}">${r.rank.icon}</span>` : '';
                return `<div class="game-lb-row">
                    <span class="game-lb-pos">${medal}</span>
                    <span class="game-lb-avatar">${emoji}</span>
                    <span class="game-lb-name">${r.username || 'Гравець'} ${rankIcon}</span>
                    <span class="game-lb-rating">${r.rating}</span>
                    <span class="game-lb-stats">${r.wins}W ${r.losses}L ${streak}</span>
                </div>`;
            }).join('');
        }
        catch { }
    },
    async findMatch() {
        this.showScreen('search');
        this.state = 'searching';
        try {
            const res = await fetch(`${this.API}/api/game/find`, {
                method: 'POST', headers: this.headers,
            });
            if (!res.ok)
                throw new Error('find failed');
            const d = await res.json();
            this.matchId = d.match_id;
            if (d.status === 'waiting') {
                this.startPolling();
            }
            else {
                this.onMatchReady();
            }
        }
        catch (e) {
            UI.showToast('Помилка пошуку гри');
            this.showScreen('menu');
        }
    },
    async cancelSearch() {
        this.stopPolling();
        if (this.matchId) {
            try {
                await fetch(`${this.API}/api/game/cancel/${this.matchId}`, {
                    method: 'POST', headers: this.headers,
                });
            }
            catch { }
        }
        this.matchId = null;
        this.state = 'idle';
        this.showScreen('menu');
    },
    startPolling() {
        this.stopPolling();
        this.pollTimer = setInterval(() => this.pollMatch(), 2000);
    },
    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    },
    startCountdown(seconds) {
        this.stopCountdown();
        this.timeLeft = seconds || 60;
        this.updateTimerDisplay();
        const timerEl = document.getElementById('game-timer');
        if (timerEl)
            timerEl.classList.remove('hidden');
        this.countdownTimer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            if (this.timeLeft <= 0) {
                this.stopCountdown();
            }
        }, 1000);
    },
    stopCountdown() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        const timerEl = document.getElementById('game-timer');
        if (timerEl)
            timerEl.classList.add('hidden');
    },
    updateTimerDisplay() {
        const el = document.getElementById('game-timer-value');
        if (!el)
            return;
        el.textContent = this.timeLeft;
        const timerEl = document.getElementById('game-timer');
        if (timerEl) {
            timerEl.classList.toggle('game-timer-warning', this.timeLeft <= 10);
        }
    },
    async pollMatch() {
        if (!this.matchId)
            return;
        try {
            const res = await fetch(`${this.API}/api/game/match/${this.matchId}`, { headers: this.headers });
            if (!res.ok)
                return;
            const d = await res.json();
            if (d.status === 'waiting')
                return; // still waiting
            if (d.status === 'playing' || d.status === 'guessing') {
                if (this.state === 'searching') {
                    // Match just started — show play screen
                    this.onMatchReady();
                    return;
                }
                if (!d.my_guessed) {
                    // Still need to guess — keep polling but stay on play screen
                }
                else if (d.my_guessed && !d.opponent_guessed) {
                    this.state = 'waiting_opponent';
                    if (!document.getElementById('game-waiting-label')?.classList.contains('hidden') === false) {
                        this.showWaiting();
                    }
                }
            }
            if (d.status === 'finished') {
                this.stopPolling();
                this.stopCountdown();
                this.showResult(d);
            }
            if (d.status === 'cancelled' || d.status === 'expired') {
                this.stopPolling();
                this.stopCountdown();
                this.matchId = null;
                this.state = 'idle';
                UI.showToast('Гру скасовано');
                this.showScreen('menu');
                this.loadMyRating();
            }
        }
        catch { }
    },
    async onMatchReady() {
        // Hide lobby UI when match starts
        const codeBox = document.getElementById('game-lobby-code-box');
        if (codeBox)
            codeBox.classList.add('hidden');
        this.lobbyCode = null;
        // Don't stop polling — keep polling to detect opponent forfeit/disconnect
        try {
            const res = await fetch(`${this.API}/api/game/match/${this.matchId}`, { headers: this.headers });
            if (!res.ok)
                throw new Error();
            const d = await res.json();
            if (d.status === 'finished') {
                this.stopPolling();
                this.showResult(d);
                return;
            }
            this.state = 'playing';
            this.showScreen('play');
            const poster = document.getElementById('game-movie-poster');
            const title = document.getElementById('game-movie-title');
            if (poster)
                poster.src = d.movie_poster || '';
            if (title)
                title.textContent = d.movie_title || '???';
            // Reset inputs
            const ratingInput = document.getElementById('game-input-rating');
            const yearInput = document.getElementById('game-input-year');
            if (ratingInput)
                ratingInput.value = '';
            if (yearInput)
                yearInput.value = '';
            document.getElementById('game-guess-btn')?.classList.remove('hidden');
            document.getElementById('game-waiting-label')?.classList.add('hidden');
            // Start countdown timer
            if (d.time_left !== undefined) {
                this.startCountdown(d.time_left);
            }
            // Start polling to detect opponent forfeit while playing
            this.startPolling();
        }
        catch {
            UI.showToast('Помилка завантаження гри');
            this.showScreen('menu');
        }
    },
    showWaiting() {
        this.showScreen('play');
        document.getElementById('game-guess-btn')?.classList.add('hidden');
        const waitLabel = document.getElementById('game-waiting-label');
        if (waitLabel) {
            waitLabel.classList.remove('hidden');
            const tFn = typeof I18N !== 'undefined' ? (k) => I18N.t(k) : (k) => k;
            waitLabel.innerHTML = `⏳ ${tFn('gameWaitingOpponent')}`;
        }
        this.startPolling();
    },
    async submitGuess() {
        const ratingVal = parseFloat(document.getElementById('game-input-rating')?.value);
        const yearVal = parseInt(document.getElementById('game-input-year')?.value);
        if (isNaN(ratingVal) || ratingVal < 0 || ratingVal > 10) {
            UI.showToast('Рейтинг від 0 до 10');
            return;
        }
        if (isNaN(yearVal) || yearVal < 1900 || yearVal > 2030) {
            UI.showToast('Рік від 1900 до 2030');
            return;
        }
        try {
            const res = await fetch(`${this.API}/api/game/guess/${this.matchId}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ rating: ratingVal, year: yearVal }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                UI.showToast(err.detail || 'Помилка');
                return;
            }
            const data = await res.json();
            // If both guessed, the server already finished — check
            if (data.finished) {
                // Match is done, poll once to get results
                this.pollMatch();
                return;
            }
            this.state = 'waiting_opponent';
            this.showWaiting();
        }
        catch {
            UI.showToast('Помилка відправки');
        }
    },
    showResult(d) {
        this.state = 'finished';
        this.showScreen('result');
        this.stopPolling();
        this.stopCountdown();
        document.getElementById('game-result-poster').src = d.movie_poster || '';
        document.getElementById('game-result-title').textContent = d.movie_title || '';
        document.getElementById('game-result-real-rating').textContent = d.movie_rating ?? '—';
        document.getElementById('game-result-real-year').textContent = d.movie_year ?? '—';
        // Handle null guesses (forfeit cases)
        const myR = d.my_guess_rating;
        const myY = d.my_guess_year;
        const oppR = d.opponent_guess_rating;
        const oppY = d.opponent_guess_year;
        document.getElementById('game-result-my-rating').textContent = myR != null ? myR : '—';
        document.getElementById('game-result-my-year').textContent = myY != null ? myY : '—';
        document.getElementById('game-result-opp-rating').textContent = oppR != null ? oppR : '—';
        document.getElementById('game-result-opp-year').textContent = oppY != null ? oppY : '—';
        const verdict = document.getElementById('game-result-verdict');
        const isForfeit = d.forfeit;
        if (d.winner === 'me') {
            if (isForfeit) {
                verdict.textContent = '🏆 Суперник здався! +25 рейтингу';
            }
            else {
                verdict.textContent = '🎉 Ти виграв! +25 рейтингу';
            }
            verdict.className = 'game-verdict game-win';
        }
        else if (d.winner === 'opponent') {
            if (isForfeit) {
                verdict.textContent = '🏳️ Ти здався. -10 рейтингу';
            }
            else {
                verdict.textContent = '😔 Суперник ближче. -10 рейтингу';
            }
            verdict.className = 'game-verdict game-lose';
        }
        else {
            verdict.textContent = '🤝 Нічия! +5 рейтингу';
            verdict.className = 'game-verdict game-draw';
        }
        // Show rating change
        const ratingChange = document.getElementById('game-result-rating-change');
        if (ratingChange) {
            if (d.new_rating !== undefined) {
                ratingChange.textContent = `Ваш рейтинг: ${d.new_rating}`;
                ratingChange.classList.remove('hidden');
            }
        }
        this.matchId = null;
        this.loadMyRating();
        this.loadLeaderboard();
    },
    async loadGameHistory() {
        this.showScreen('history');
        const container = document.getElementById('game-history-list');
        if (!container)
            return;
        container.innerHTML = '<div class="game-empty">Завантаження...</div>';
        try {
            const res = await fetch(`${this.API}/api/game/history`, { headers: this.headers });
            if (!res.ok)
                throw new Error();
            const matches = await res.json();
            if (!matches.length) {
                container.innerHTML = '<div class="game-empty">Ви ще не грали жодної гри</div>';
                return;
            }
            container.innerHTML = matches.map(m => {
                const resultClass = m.result === 'win' ? 'game-win' : m.result === 'lose' ? 'game-lose' : 'game-draw';
                const resultIcon = m.result === 'win' ? '🏆' : m.result === 'lose' ? '😔' : '🤝';
                const ratingChange = m.result === 'win' ? '+25' : m.result === 'lose' ? '-10' : '+5';
                const date = new Date(m.created_at).toLocaleDateString('uk');
                return `<div class="game-history-item ${resultClass}">
                    <div class="game-history-movie">${resultIcon} ${m.movie_title || '—'}</div>
                    <div class="game-history-details">
                        <span>vs ${m.opponent_name || 'Гравець'}</span>
                        <span class="game-history-rating">${ratingChange}</span>
                        <span class="game-history-date">${date}</span>
                    </div>
                </div>`;
            }).join('');
        }
        catch {
            container.innerHTML = '<div class="game-empty">Помилка завантаження історії</div>';
        }
    },
};
//# sourceMappingURL=game.js.map