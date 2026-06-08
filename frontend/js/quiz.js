/* ─── Quiz: Який ти кіноархетип ────────────────────────────────────
   Loads questions + archetypes from /data/*.json and runs a 12-step
   quiz funnel that lands on one of 16 archetype results.
   No external deps — vanilla JS, ES2018+.
─────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const SHELL_SELECTOR = '#quiz-shell';
  const STAGE_SELECTOR = '#quiz-stage';
  const PROGRESS_FILL_SELECTOR = '#quiz-progress-fill';
  const PROGRESS_LABEL_SELECTOR = '#quiz-progress-label';
  const PROGRESS_WRAP_SELECTOR = '#quiz-progress-wrap';
  const STORAGE_KEY = 'picksy:lastArchetype';

  let archetypes = null;       // array
  let archetypesBySlug = null; // map slug -> archetype
  let questions = null;        // array

  let state = {
    step: 0,                   // 0 = intro
    answers: [],               // array of selected option indices, length === questions.length
    scores: {},                // accumulated score per archetype
    compatWith: null,          // slug we are checking compatibility against
    fromUser: null,            // optional referrer name
  };

  // --- helpers ---
  function $(sel, root = document) { return root.querySelector(sel); }
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getQueryParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function setQueryParam(name, value) {
    const u = new URL(window.location.href);
    if (value == null || value === '') u.searchParams.delete(name);
    else u.searchParams.set(name, value);
    window.history.replaceState({}, '', u.toString());
  }

  function showToast(text) {
    let el = document.querySelector('.quiz-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'quiz-toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // --- data load ---
  async function loadData() {
    const cacheBust = '?v=picksy-147';
    const [archResp, qResp] = await Promise.all([
      fetch('/data/archetypes.json' + cacheBust, { credentials: 'same-origin' }),
      fetch('/data/quiz_questions.json' + cacheBust, { credentials: 'same-origin' }),
    ]);
    if (!archResp.ok || !qResp.ok) throw new Error('quiz data load failed');
    const archData = await archResp.json();
    const qData = await qResp.json();
    archetypes = archData.archetypes;
    archetypesBySlug = Object.fromEntries(archetypes.map(a => [a.slug, a]));
    questions = qData.questions;
    state.answers = new Array(questions.length).fill(null);
    state.scores = Object.fromEntries(archetypes.map(a => [a.slug, 0]));
  }

  // --- scoring ---
  function recomputeScores() {
    const scores = Object.fromEntries(archetypes.map(a => [a.slug, 0]));
    for (let i = 0; i < questions.length; i++) {
      const ai = state.answers[i];
      if (ai == null) continue;
      const ans = questions[i].answers[ai];
      for (const [slug, w] of Object.entries(ans.weights || {})) {
        if (slug in scores) scores[slug] += w;
      }
    }
    state.scores = scores;
  }

  function rankedResults() {
    return Object.entries(state.scores)
      .sort((a, b) => b[1] - a[1])
      .map(([slug, score]) => ({ slug, score, archetype: archetypesBySlug[slug] }));
  }

  // --- progress ---
  function updateProgress() {
    const wrap = $(PROGRESS_WRAP_SELECTOR);
    const fill = $(PROGRESS_FILL_SELECTOR);
    const label = $(PROGRESS_LABEL_SELECTOR);
    if (!fill || !label || !wrap) return;
    const total = questions.length;
    let pct;
    let labelText;
    if (state.step <= 0) {
      pct = 0;
      labelText = 'Готовність 0%';
      wrap.style.display = '';
    } else if (state.step > total) {
      pct = 100;
      labelText = 'Результат';
      wrap.style.display = 'none';
    } else {
      pct = Math.round((state.step - 1) / total * 100);
      labelText = `Питання ${state.step} з ${total}`;
      wrap.style.display = '';
    }
    fill.style.width = pct + '%';
    label.textContent = labelText;
  }

  // --- render: intro ---
  function renderIntro() {
    const stage = $(STAGE_SELECTOR);
    if (!stage) return;

    const compatBadge = state.compatWith && archetypesBySlug[state.compatWith]
      ? `
        <div class="quiz-compat-badge">
          🎬 Тебе запросили перевірити сумісність зі <strong>«${escapeHtml(archetypesBySlug[state.compatWith].name)}»</strong>${
            state.fromUser ? ` (${escapeHtml(state.fromUser)})` : ''
          }. Пройди квіз — і ми покажемо ваш збіг.
        </div>`
      : '';

    stage.innerHTML = `
      <div class="quiz-intro">
        ${compatBadge}
        <span class="quiz-intro-eyebrow">Quiz · 12 питань · 90 секунд</span>
        <h1 class="quiz-intro-title">
          Який ти
          <span class="gradient">кіноархетип?</span>
        </h1>
        <p class="quiz-intro-sub">12 питань — і ми відкриємо, який із 16 кіноархетипів живе всередині тебе. Артхаус-візіонер? Адреналіновий брат? Тиха дитина криптики? Дізнайся за дві хвилини.</p>
        <div class="quiz-meta-row">
          <span class="quiz-meta-pill">🎯 16 архетипів</span>
          <span class="quiz-meta-pill">🎬 5 фільмів кожному</span>
          <span class="quiz-meta-pill">⭐ 3 знаменитості з твоїм смаком</span>
          <span class="quiz-meta-pill">🔗 Shareable URL</span>
        </div>
        <button class="quiz-cta-primary" id="quiz-start-btn">
          <span>🎲</span> Почати квіз
        </button>
      </div>
    `;

    $('#quiz-start-btn').addEventListener('click', () => goToStep(1));
  }

  // --- render: question ---
  function renderQuestion() {
    const stage = $(STAGE_SELECTOR);
    if (!stage) return;
    const idx = state.step - 1;
    const q = questions[idx];
    const selected = state.answers[idx];

    const answersHtml = q.answers.map((a, i) => `
      <button class="quiz-answer ${selected === i ? 'is-active' : ''}" data-answer-idx="${i}" type="button">
        <span class="quiz-answer-emoji" aria-hidden="true">${escapeHtml(a.emoji || '·')}</span>
        <span class="quiz-answer-text">${escapeHtml(a.text)}</span>
      </button>
    `).join('');

    stage.innerHTML = `
      <div class="quiz-card" id="quiz-card">
        <div class="quiz-card-num">Питання ${state.step} / ${questions.length}</div>
        <h2 class="quiz-card-title">${escapeHtml(q.question)}</h2>
        <div class="quiz-answers">
          ${answersHtml}
        </div>
        <div class="quiz-card-foot">
          <button class="quiz-prev" id="quiz-prev-btn" ${state.step <= 1 ? 'disabled' : ''}>← Назад</button>
          <span class="quiz-card-num" aria-hidden="true">${state.step} / ${questions.length}</span>
        </div>
      </div>
    `;

    stage.querySelectorAll('.quiz-answer').forEach(el => {
      el.addEventListener('click', () => {
        const ai = parseInt(el.dataset.answerIdx, 10);
        state.answers[idx] = ai;
        // visual highlight then advance with fade-out
        stage.querySelectorAll('.quiz-answer').forEach(b => b.classList.remove('is-active'));
        el.classList.add('is-active');
        const card = $('#quiz-card');
        if (card) card.classList.add('quiz-fade-out');
        setTimeout(() => {
          if (state.step >= questions.length) {
            goToResult();
          } else {
            goToStep(state.step + 1);
          }
        }, 360);
      });
    });

    const prevBtn = $('#quiz-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      if (state.step > 1) goToStep(state.step - 1);
    });
  }

  // --- result rendering ---
  function buildShareUrl(slug) {
    const u = new URL(window.location.origin + '/archetype/' + encodeURIComponent(slug));
    return u.toString();
  }

  function buildCompatInviteUrl(slug) {
    const u = new URL(window.location.origin + '/quiz');
    u.searchParams.set('compat', slug);
    return u.toString();
  }

  function computeCompatibilityPercent(targetSlug) {
    // similarity = how much overlap between user's full score vector and target
    // 1) target archetype score normalized
    // 2) cap percent ~ user_score_for_target / max_possible_for_target
    if (!targetSlug || !(targetSlug in state.scores)) return 0;
    const userScore = state.scores[targetSlug];
    let maxPossible = 0;
    for (const q of questions) {
      let best = 0;
      for (const a of q.answers) {
        const w = a.weights[targetSlug] || 0;
        if (w > best) best = w;
      }
      maxPossible += best;
    }
    if (maxPossible <= 0) return 0;
    const ratio = userScore / maxPossible;
    // give a friendly base + scaled portion (so weak overlap still shows >0)
    const pct = Math.round(20 + ratio * 75);
    return Math.max(5, Math.min(99, pct));
  }

  function compatTip(pct) {
    if (pct >= 85) return 'Серйозно. Ви буквально один кіноорганізм у двох тілах.';
    if (pct >= 70) return 'Сильний збіг — на спільний марафон вистачить кількох вечорів.';
    if (pct >= 55) return 'Гарний баланс. Ви будете сваритися, що дивитися — і це частина шарму.';
    if (pct >= 40) return 'Перетин помітний, але кожен лишається при своєму смаку. Це теж добре.';
    if (pct >= 25) return 'Спільного небагато — однак саме ви розширите фільмотеку одне одному.';
    return 'Майже протилежні смаки. Це або мегадрама, або ідеальна освіта одне для одного.';
  }

  function renderResult() {
    const stage = $(STAGE_SELECTOR);
    if (!stage) return;
    recomputeScores();
    const ranked = rankedResults();
    const top = ranked[0];
    const arch = top.archetype;
    if (!arch) {
      stage.innerHTML = '<div class="quiz-card"><h2 class="quiz-card-title">Щось пішло не так</h2><p>Спробуй ще раз.</p></div>';
      return;
    }

    // remember last archetype for the homepage CTA
    try { localStorage.setItem(STORAGE_KEY, arch.slug); } catch (_) { /* ignore */ }

    // Best-effort: ping backend so the global archetype leaderboard
    // (/api/quiz/leaderboard) reflects this completion. Fire-and-forget.
    try {
      const recordKey = 'picksy:quizRecorded:' + arch.slug;
      if (!localStorage.getItem(recordKey)) {
        fetch('/api/quiz/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archetype: arch.slug })
        }).then(() => { try { localStorage.setItem(recordKey, '1'); } catch (_) {} })
          .catch(() => {});
      }
    } catch (_) {}

    const filmsHtml = (arch.films || []).map(f => `
      <li class="quiz-film">
        <span class="quiz-film-title">${escapeHtml(f.title)}</span>
        <span class="quiz-film-year">${escapeHtml(String(f.year || ''))}</span>
        ${f.note ? `<span class="quiz-film-note">${escapeHtml(f.note)}</span>` : ''}
      </li>
    `).join('');

    const celebsHtml = (arch.celebs || []).map(c => {
      const initials = (c.name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
      return `
        <li class="quiz-celeb">
          <span class="quiz-celeb-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
          <div>
            <div class="quiz-celeb-name">${escapeHtml(c.name)}</div>
            <div class="quiz-celeb-why">${escapeHtml(c.why)}</div>
          </div>
        </li>
      `;
    }).join('');

    const traitsHtml = (arch.traits || []).map(t => `<span class="quiz-result-trait">${escapeHtml(t)}</span>`).join('');

    const runnersHtml = ranked.slice(1, 4).map(r => `
      <a class="quiz-runner-pill" href="/archetype/${encodeURIComponent(r.slug)}">
        ${escapeHtml(r.archetype.emoji)} ${escapeHtml(r.archetype.name)}
      </a>
    `).join('');

    let compatBlock = '';
    if (state.compatWith && archetypesBySlug[state.compatWith]) {
      const target = archetypesBySlug[state.compatWith];
      const pct = computeCompatibilityPercent(state.compatWith);
      const isSame = state.compatWith === arch.slug;
      compatBlock = `
        <div class="quiz-compat-result">
          <h3>${isSame ? 'Той самий архетип!' : 'Сумісність зі ' + escapeHtml(target.name)}</h3>
          <div class="quiz-compat-score">
            <span class="quiz-compat-percent">${pct}%</span>
            <span class="quiz-compat-label">${escapeHtml(target.emoji)} ${escapeHtml(target.name)}${state.fromUser ? ' · ' + escapeHtml(state.fromUser) : ''}</span>
          </div>
          <div class="quiz-compat-meter"><div class="quiz-compat-meter-fill" style="width:${pct}%"></div></div>
          <p class="quiz-compat-tip">${escapeHtml(compatTip(pct))}</p>
        </div>
      `;
    }

    const shareUrl = buildShareUrl(arch.slug);
    const compatInviteUrl = buildCompatInviteUrl(arch.slug);

    stage.innerHTML = `
      <article class="quiz-result" style="--archetype-gradient: ${arch.gradient}">
        <span class="quiz-result-eyebrow">Твій архетип · 1 з 16</span>
        <div class="quiz-result-emoji">${escapeHtml(arch.emoji)}</div>
        <h1 class="quiz-result-title">${escapeHtml(arch.name)}</h1>
        <p class="quiz-result-tagline">${escapeHtml(arch.tagline)}</p>
        <p class="quiz-result-desc">${escapeHtml(arch.description)}</p>
        <div class="quiz-result-traits">${traitsHtml}</div>

        ${compatBlock}

        <section class="quiz-result-section">
          <h3>🎞️ 5 фільмів-саундтрек</h3>
          <ul class="quiz-films">${filmsHtml}</ul>
        </section>

        <section class="quiz-result-section">
          <h3>⭐ Знаменитості з твоїм смаком</h3>
          <ul class="quiz-celebs">${celebsHtml}</ul>
        </section>

        <div class="quiz-result-actions">
          <button class="quiz-action primary" id="quiz-save-btn">
            <span class="quiz-action-icon">💾</span> Зберегти результат — реєстрація
          </button>
          <button class="quiz-action" id="quiz-compat-btn" data-share-url="${escapeHtml(compatInviteUrl)}">
            <span class="quiz-action-icon">💞</span> Перевір сумісність зі мною
          </button>
          <a class="quiz-action" href="/archetype/${encodeURIComponent(arch.slug)}">
            <span class="quiz-action-icon">📄</span> Сторінка архетипу
          </a>
          <button class="quiz-action" id="quiz-restart-btn">
            <span class="quiz-action-icon">🔁</span> Пройти ще раз
          </button>
        </div>

        <div class="quiz-share-list">
          <button class="quiz-action" id="quiz-share-result-btn" data-share-url="${escapeHtml(shareUrl)}">
            <span class="quiz-action-icon">🔗</span> Скопіювати посилання
          </button>
          <a class="quiz-action" id="quiz-share-tw" target="_blank" rel="noopener"
             href="https://twitter.com/intent/tweet?text=${encodeURIComponent('Я — ' + arch.name + ' ' + arch.emoji + ' Який ти кіноархетип?')}&url=${encodeURIComponent(shareUrl)}">
            <span class="quiz-action-icon">𝕏</span> X / Twitter
          </a>
          <a class="quiz-action" id="quiz-share-tg" target="_blank" rel="noopener"
             href="https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Я — ' + arch.name + ' ' + arch.emoji + ' Який ти кіноархетип?')}">
            <span class="quiz-action-icon">✈️</span> Telegram
          </a>
        </div>

        <div class="quiz-runners">
          <h3>Тобі також близькі</h3>
          <div class="quiz-runners-list">${runnersHtml}</div>
        </div>
      </article>
    `;

    // wire actions
    const saveBtn = $('#quiz-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      // Try to open the existing auth modal if present, else go home with hash
      try {
        if (typeof window.openAuthModal === 'function') {
          window.openAuthModal('register');
          return;
        }
        const authBtn = document.getElementById('user-btn');
        if (authBtn) { authBtn.click(); return; }
      } catch (_) {}
      window.location.href = '/?from=quiz&archetype=' + encodeURIComponent(arch.slug) + '#register';
    });

    const compatBtn = $('#quiz-compat-btn');
    if (compatBtn) compatBtn.addEventListener('click', async () => {
      const url = compatBtn.dataset.shareUrl;
      const ok = await copyToClipboard(url);
      if (ok) showToast('Посилання скопійовано — надішли другу 💞');
      else fallbackShare(url, 'Перевір сумісність зі мною: ' + arch.name);
    });

    const shareBtn = $('#quiz-share-result-btn');
    if (shareBtn) shareBtn.addEventListener('click', async () => {
      const url = shareBtn.dataset.shareUrl;
      const ok = await copyToClipboard(url);
      if (ok) showToast('Посилання скопійовано');
      else fallbackShare(url, 'Я — ' + arch.name);
    });

    const restart = $('#quiz-restart-btn');
    if (restart) restart.addEventListener('click', () => {
      state.answers = new Array(questions.length).fill(null);
      state.scores = Object.fromEntries(archetypes.map(a => [a.slug, 0]));
      goToStep(0);
    });

    // update URL with result for share-back
    setQueryParam('a', arch.slug);
  }

  async function copyToClipboard(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const t = document.createElement('textarea');
      t.value = text;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(t);
      return ok;
    } catch (_) { return false; }
  }

  function fallbackShare(url, title) {
    if (navigator.share) {
      navigator.share({ url, title }).catch(() => {});
      return;
    }
    // last resort: prompt
    try { window.prompt('Скопіюй URL:', url); } catch (_) {}
  }

  // --- step machine ---
  function goToStep(step) {
    state.step = step;
    updateProgress();
    if (step <= 0) renderIntro();
    else if (step <= questions.length) renderQuestion();
    // result is triggered by goToResult()
  }

  function goToResult() {
    state.step = questions.length + 1;
    updateProgress();
    renderResult();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- bootstrap ---
  async function init() {
    const compat = getQueryParam('compat');
    const fromUser = getQueryParam('from');
    if (compat) state.compatWith = compat;
    if (fromUser) state.fromUser = fromUser;

    // pre-answer URL: ?a=<slug> shows that archetype directly (when shared from result)
    const answeredA = getQueryParam('a');

    try {
      await loadData();
    } catch (e) {
      const stage = $(STAGE_SELECTOR);
      if (stage) {
        stage.innerHTML = '<div class="quiz-card"><h2 class="quiz-card-title">Не вдалося завантажити квіз</h2><p>Перевір з\'єднання та спробуй оновити сторінку.</p></div>';
      }
      return;
    }

    if (answeredA && archetypesBySlug && archetypesBySlug[answeredA]) {
      // synthetic result: show only that archetype's card without scoring (used for shared links)
      state.scores[answeredA] = 100;
      goToResult();
      return;
    }

    goToStep(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
