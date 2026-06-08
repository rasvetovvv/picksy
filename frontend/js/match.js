/* ─── Picksy Match — Compatibility Test ──────────────────────────────
   8-question quiz for two people. Creator takes quiz → gets share link →
   invitee opens link → takes same quiz → both see compatibility result.
   Vanilla JS, no deps.
─────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:7888'
    : window.location.origin;

  var STAGE = document.getElementById('match-stage');
  var TOKEN = window.__MATCH_TOKEN__ || null;

  // 8-question IDs that we use for match (must match backend)
  var COMPAT_Q_IDS = [
    'q1_evening', 'q2_focus', 'q3_pace', 'q5_ending',
    'q6_soundtrack', 'q7_visual', 'q8_seeking', 'q12_word'
  ];

  var allQuestions = null;
  var matchQuestions = null;
  var archetypes = null;
  var state = { step: 0, answers: [], name: '' };

  function esc(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function showToast(text) {
    var el = document.querySelector('.match-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'match-toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    requestAnimationFrame(function () { el.classList.add('show'); });
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  async function loadQuizData() {
    var cb = '?v=picksy-147';
    var [qr, ar] = await Promise.all([
      fetch('/data/quiz_questions.json' + cb, { credentials: 'same-origin' }),
      fetch('/data/archetypes.json' + cb, { credentials: 'same-origin' })
    ]);
    if (!qr.ok || !ar.ok) throw new Error('Data load failed');
    var qd = await qr.json();
    var ad = await ar.json();
    allQuestions = qd.questions;
    archetypes = ad.archetypes;
    matchQuestions = allQuestions.filter(function (q) { return COMPAT_Q_IDS.indexOf(q.id) !== -1; });
    // Sort by the order in COMPAT_Q_IDS
    matchQuestions.sort(function (a, b) { return COMPAT_Q_IDS.indexOf(a.id) - COMPAT_Q_IDS.indexOf(b.id); });
  }

  // ─── Quiz rendering ───

  function renderProgress() {
    var pct = Math.round((state.step / matchQuestions.length) * 100);
    return '<div class="match-progress-wrap">' +
      '<div class="match-progress-bar"><div class="match-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="match-progress-meta"><span>' + pct + '%</span><span>Питання ' + state.step + '/' + matchQuestions.length + '</span></div>' +
      '</div>';
  }

  function renderQuizStep(idx) {
    var q = matchQuestions[idx];
    var html = renderProgress();
    html += '<div class="match-quiz-card">';
    html += '<div class="match-quiz-num">Питання ' + (idx + 1) + ' з ' + matchQuestions.length + '</div>';
    html += '<h2 class="match-quiz-title">' + esc(q.question) + '</h2>';
    html += '<div class="match-quiz-options">';
    q.answers.forEach(function (ans, i) {
      html += '<div class="match-quiz-option" data-idx="' + i + '">';
      html += '<span class="match-quiz-option-emoji">' + esc(ans.emoji) + '</span>';
      html += '<span class="match-quiz-option-text">' + esc(ans.text) + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
    STAGE.innerHTML = html;

    STAGE.querySelectorAll('.match-quiz-option').forEach(function (el) {
      el.addEventListener('click', function () {
        var ansIdx = parseInt(el.dataset.idx, 10);
        state.answers[idx] = ansIdx;
        state.step = idx + 1;
        if (state.step >= matchQuestions.length) {
          onQuizComplete();
        } else {
          renderQuizStep(state.step);
        }
      });
    });
  }

  // ─── Creator flow ───

  function startCreatorQuiz() {
    var nameInput = document.getElementById('match-creator-name');
    state.name = (nameInput && nameInput.value.trim()) || 'User';
    state.step = 0;
    state.answers = new Array(matchQuestions.length).fill(null);
    renderQuizStep(0);
  }

  async function onQuizComplete() {
    if (TOKEN) {
      // We are invitee — submit answers
      await submitInviteeAnswers();
    } else {
      // We are creator — create match and show share link
      await createMatch();
    }
  }

  async function createMatch() {
    STAGE.innerHTML = '<div class="match-loading"><div class="match-loading-emoji">⏳</div><h2>Створюємо кімнату…</h2></div>';
    try {
      var authToken = null;
      try { authToken = localStorage.getItem('picksy_token'); } catch (e) {}
      var headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = 'Bearer ' + authToken;

      var resp = await fetch(API + '/api/match/create', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ name: state.name, answers: state.answers })
      });
      if (!resp.ok) throw new Error('Create failed');
      var data = await resp.json();
      TOKEN = data.token;
      renderShareSection(data);
    } catch (e) {
      STAGE.innerHTML = '<div class="match-loading"><div class="match-loading-emoji">😵</div><h2>Помилка створення</h2><p style="color:#94a3b8">' + esc(e.message) + '</p><br><button class="match-btn" onclick="location.reload()">Спробувати ще</button></div>';
    }
  }

  function renderShareSection(data) {
    var shareUrl = data.share_url || (window.location.origin + '/match/' + data.token);

    var html = '<div class="match-share-section">';
    html += '<h2>🎉 Квіз пройдено!</h2>';
    html += '<p class="match-share-sub">Тепер надішли це посилання другу або коханій людині — вони пройдуть ті самі 8 питань, і ви побачите результат!</p>';

    // Stickers
    if (data.creator_archetype) {
      var arch = archetypes && archetypes.find(function (a) { return a.slug === data.creator_archetype; });
      if (arch) {
        html += '<div class="match-share-stickers">';
        html += '<span class="match-sticker">' + esc(arch.emoji) + ' ' + esc(arch.name) + '</span>';
        html += '</div>';
      }
    }

    // Share link box
    html += '<div class="match-share-link-box">';
    html += '<span class="match-share-link-text" id="match-share-url">' + esc(shareUrl) + '</span>';
    html += '<button class="match-share-copy-btn" id="match-copy-btn">📋 Копіювати</button>';
    html += '</div>';

    // Share buttons
    html += '<div class="match-share-buttons">';
    var tgUrl = 'https://t.me/share/url?url=' + encodeURIComponent(shareUrl) + '&text=' + encodeURIComponent('Перевір нашу кіно-сумісність! 💞');
    html += '<a class="match-share-btn" href="' + tgUrl + '" target="_blank" rel="noopener">📨 Telegram</a>';

    if (navigator.share) {
      html += '<button class="match-share-btn" id="match-native-share">📤 Поділитись</button>';
    }

    var waUrl = 'https://api.whatsapp.com/send?text=' + encodeURIComponent('Перевір нашу кіно-сумісність! 💞 ' + shareUrl);
    html += '<a class="match-share-btn" href="' + waUrl + '" target="_blank" rel="noopener">💬 WhatsApp</a>';
    html += '</div>';

    // Waiting indicator
    html += '<div class="match-waiting" id="match-waiting">';
    html += '<div class="match-waiting-dots"><span></span><span></span><span></span></div>';
    html += '<div class="match-waiting-text">Чекаємо, поки друг пройде квіз…</div>';
    html += '</div>';

    html += '</div>';
    STAGE.innerHTML = html;

    // Copy button
    document.getElementById('match-copy-btn').addEventListener('click', function () {
      navigator.clipboard.writeText(shareUrl).then(function () {
        showToast('Посилання скопійовано!');
      }).catch(function () {
        showToast('Не вдалося скопіювати');
      });
    });

    // Native share
    var nativeBtn = document.getElementById('match-native-share');
    if (nativeBtn) {
      nativeBtn.addEventListener('click', function () {
        navigator.share({
          title: 'Перевір кіно-сумісність! 💞',
          text: 'Пройди 8 питань — дізнайся нашу кіно-сумісність!',
          url: shareUrl
        }).catch(function () {});
      });
    }

    // Start polling for result
    pollForResult(data.token);
  }

  async function pollForResult(token) {
    var maxAttempts = 300; // 5 min
    for (var i = 0; i < maxAttempts; i++) {
      await new Promise(function (r) { setTimeout(r, 3000); });
      try {
        var resp = await fetch(API + '/api/match/' + token);
        if (!resp.ok) continue;
        var data = await resp.json();
        if (data.status === 'completed' && data.result) {
          renderResults(data.result);
          return;
        }
      } catch (e) {}
    }
  }

  // ─── Invitee flow ───

  function renderInviteLanding(creatorName) {
    var html = '<div class="match-invite">';
    html += '<div class="match-invite-emoji">💜</div>';
    html += '<h1 class="match-invite-title"><span class="match-creator-name">' + esc(creatorName) + '</span> запросив(ла) тебе перевірити кіно-сумісність!</h1>';
    html += '<p class="match-invite-sub">Пройди 8 питань — і ви обидва побачите результат: % сумісності, спільні фільми та ваш кіно-знак 🎬</p>';
    html += '<input class="match-name-input" id="match-invitee-name" type="text" placeholder="Твоє ім\'я" maxlength="40" autocomplete="given-name">';
    html += '<br><br>';
    html += '<button class="match-btn" id="match-invitee-start">💞 Пройти квіз</button>';
    html += '</div>';
    STAGE.innerHTML = html;

    document.getElementById('match-invitee-start').addEventListener('click', function () {
      var inp = document.getElementById('match-invitee-name');
      state.name = (inp && inp.value.trim()) || 'User';
      state.step = 0;
      state.answers = new Array(matchQuestions.length).fill(null);
      renderQuizStep(0);
    });
  }

  async function submitInviteeAnswers() {
    STAGE.innerHTML = '<div class="match-loading"><div class="match-loading-emoji">🔮</div><h2>Обчислюємо сумісність…</h2></div>';
    try {
      var resp = await fetch(API + '/api/match/' + TOKEN + '/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: state.name, answers: state.answers })
      });
      if (!resp.ok) {
        var err = await resp.json().catch(function () { return {}; });
        throw new Error(err.detail || 'Join failed');
      }
      var result = await resp.json();
      renderResults(result);
    } catch (e) {
      STAGE.innerHTML = '<div class="match-loading"><div class="match-loading-emoji">😵</div><h2>Помилка</h2><p style="color:#94a3b8">' + esc(e.message) + '</p><br><button class="match-btn" onclick="location.reload()">Спробувати ще</button></div>';
    }
  }

  // ─── Results ───

  function renderResults(result) {
    var score = result.score || 0;
    var circumference = 2 * Math.PI * 80; // r=80

    var html = '<div class="match-results">';

    // Score circle
    html += '<div class="match-score-section">';
    html += '<div class="match-score-circle">';
    html += '<svg class="match-score-svg" viewBox="0 0 180 180">';
    html += '<defs><linearGradient id="matchScoreGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#8b5cf6"/><stop offset="100%" style="stop-color:#ec4899"/></linearGradient></defs>';
    html += '<circle class="match-score-track" cx="90" cy="90" r="80"/>';
    html += '<circle class="match-score-fill" id="match-score-arc" cx="90" cy="90" r="80" stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + circumference.toFixed(1) + '"/>';
    html += '</svg>';
    html += '<div class="match-score-number"><span class="match-score-pct" id="match-score-num">0</span><span class="match-score-label">сумісність</span></div>';
    html += '</div>';
    html += '<div class="match-score-title">Ваша кіно-сумісність</div>';
    html += '</div>';

    // Names
    html += '<div class="match-names-row">';
    html += '<div class="match-person"><span class="match-person-emoji">' + esc(result.arch1_emoji || '🎬') + '</span>';
    html += '<span class="match-person-name">' + esc(result.creator_name || 'User 1') + '</span>';
    html += '<span class="match-person-arch">' + esc(result.arch1_name || '') + '</span></div>';
    html += '<span class="match-vs">💞</span>';
    html += '<div class="match-person"><span class="match-person-emoji">' + esc(result.arch2_emoji || '🎬') + '</span>';
    html += '<span class="match-person-name">' + esc(result.invitee_name || 'User 2') + '</span>';
    html += '<span class="match-person-arch">' + esc(result.arch2_name || '') + '</span></div>';
    html += '</div>';

    // Cinema sign
    html += '<div class="match-cinema-sign">';
    html += '<div class="match-cinema-sign-label">Ваш спільний кіно-знак</div>';
    html += '<div class="match-cinema-sign-name">' + esc(result.cinema_sign || 'Cinema Pals') + '</div>';
    html += '</div>';

    // Must watch together
    if (result.must_watch && result.must_watch.length > 0) {
      html += '<div class="match-movies-section">';
      html += '<div class="match-section-title">🎬 Обов\'язково дивіться разом</div>';
      result.must_watch.forEach(function (m) {
        html += '<div class="match-movie-card">';
        html += '<span class="match-movie-emoji">🍿</span>';
        html += '<div class="match-movie-info">';
        html += '<div class="match-movie-title">' + esc(m.title) + ' <span class="match-movie-year">(' + esc(m.year) + ')</span></div>';
        if (m.note) html += '<div class="match-movie-note">' + esc(m.note) + '</div>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    // Don't watch together
    if (result.dont_watch && result.dont_watch.length > 0) {
      html += '<div class="match-movies-section">';
      html += '<div class="match-section-title">🚫 Не дивіться разом</div>';
      result.dont_watch.forEach(function (m) {
        html += '<div class="match-movie-card">';
        html += '<span class="match-movie-emoji">⚠️</span>';
        html += '<div class="match-movie-info">';
        html += '<div class="match-movie-title">' + esc(m.title) + ' <span class="match-movie-year">(' + esc(m.year) + ')</span></div>';
        if (m.note) html += '<div class="match-movie-note">' + esc(m.note) + '</div>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    // Differences
    if (result.differences) {
      html += '<div class="match-diff-section">';
      html += '<div class="match-section-title">🔀 Де розходитесь</div>';
      html += '<div class="match-diff-row">';
      html += '<div class="match-diff-card"><div class="match-diff-name">' + esc(result.creator_name || 'User 1') + '</div>';
      html += '<div class="match-diff-items">' + (result.differences.user1_unique || []).map(function (s) { return '• ' + esc(s); }).join('<br>') + '</div></div>';
      html += '<div class="match-diff-card"><div class="match-diff-name">' + esc(result.invitee_name || 'User 2') + '</div>';
      html += '<div class="match-diff-items">' + (result.differences.user2_unique || []).map(function (s) { return '• ' + esc(s); }).join('<br>') + '</div></div>';
      html += '</div></div>';
    }

    // Share story button
    html += '<div class="match-story-section">';
    html += '<button class="match-story-btn" id="match-story-btn">📸 Поділитись у сторіс</button>';
    html += '<br>';
    html += '<div class="match-new-test"><a href="/match" class="match-btn match-btn-secondary">💞 Новий тест</a></div>';
    html += '</div>';

    html += '</div>';
    STAGE.innerHTML = html;

    // Animate score
    animateScore(score, circumference);

    // Story button
    document.getElementById('match-story-btn').addEventListener('click', function () {
      generateShareImage(result);
    });
  }

  function animateScore(target, circumference) {
    var numEl = document.getElementById('match-score-num');
    var arcEl = document.getElementById('match-score-arc');
    if (!numEl || !arcEl) return;

    var duration = 2000;
    var start = performance.now();

    function animate(now) {
      var elapsed = now - start;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      var current = Math.round(eased * target);
      numEl.textContent = current + '%';
      var offset = circumference - (circumference * (eased * target / 100));
      arcEl.style.strokeDashoffset = offset.toFixed(1);
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  // ─── Share Image Generator (1080×1920) ───

  function generateShareImage(result) {
    var canvas = document.getElementById('match-share-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      document.body.appendChild(canvas);
    }
    canvas.width = 1080;
    canvas.height = 1920;
    var ctx = canvas.getContext('2d');

    // Background
    var grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#07060d');
    grad.addColorStop(0.4, '#0f0e1a');
    grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Decorative circles
    ctx.globalAlpha = 0.08;
    var radGrad1 = ctx.createRadialGradient(200, 400, 0, 200, 400, 400);
    radGrad1.addColorStop(0, '#8b5cf6');
    radGrad1.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad1;
    ctx.fillRect(0, 0, 600, 800);

    var radGrad2 = ctx.createRadialGradient(880, 1400, 0, 880, 1400, 400);
    radGrad2.addColorStop(0, '#ec4899');
    radGrad2.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad2;
    ctx.fillRect(480, 1000, 600, 800);
    ctx.globalAlpha = 1;

    // Title
    ctx.fillStyle = '#a78bfa';
    ctx.font = '700 32px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PICKSY MATCH', 540, 120);

    // Heart emoji area
    ctx.font = '120px Inter, system-ui, sans-serif';
    ctx.fillText('💞', 540, 280);

    // Score
    var scoreGrad = ctx.createLinearGradient(340, 350, 740, 550);
    scoreGrad.addColorStop(0, '#a78bfa');
    scoreGrad.addColorStop(1, '#ec4899');
    ctx.fillStyle = scoreGrad;
    ctx.font = '900 180px Inter, system-ui, sans-serif';
    ctx.fillText(result.score + '%', 540, 520);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 28px Inter, system-ui, sans-serif';
    ctx.fillText('КІНО-СУМІСНІСТЬ', 540, 570);

    // Names
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 42px Inter, system-ui, sans-serif';
    var name1 = (result.creator_name || 'User 1').substring(0, 15);
    var name2 = (result.invitee_name || 'User 2').substring(0, 15);
    ctx.fillText(name1 + '  💞  ' + name2, 540, 680);

    // Archetypes
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 28px Inter, system-ui, sans-serif';
    ctx.fillText((result.arch1_emoji || '') + ' ' + (result.arch1_name || ''), 540, 740);
    ctx.fillText('×', 540, 780);
    ctx.fillText((result.arch2_emoji || '') + ' ' + (result.arch2_name || ''), 540, 820);

    // Cinema sign
    ctx.fillStyle = '#64748b';
    ctx.font = '700 22px Inter, system-ui, sans-serif';
    ctx.fillText('ВАШ КІНО-ЗНАК', 540, 920);
    var signGrad = ctx.createLinearGradient(340, 940, 740, 990);
    signGrad.addColorStop(0, '#a78bfa');
    signGrad.addColorStop(1, '#ec4899');
    ctx.fillStyle = signGrad;
    ctx.font = '900 48px Inter, system-ui, sans-serif';
    ctx.fillText(result.cinema_sign || '', 540, 980);

    // Must watch
    if (result.must_watch && result.must_watch.length > 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '700 22px Inter, system-ui, sans-serif';
      ctx.fillText('🎬 ДИВІТЬСЯ РАЗОМ', 540, 1100);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 30px Inter, system-ui, sans-serif';
      result.must_watch.forEach(function (m, i) {
        ctx.fillText((m.title || '') + ' (' + (m.year || '') + ')', 540, 1160 + i * 50);
      });
    }

    // Differences
    if (result.differences) {
      var diffY = 1380;
      ctx.fillStyle = '#64748b';
      ctx.font = '700 22px Inter, system-ui, sans-serif';
      ctx.fillText('🔀 ДЕ РОЗХОДИТЕСЬ', 540, diffY);
      ctx.font = '600 26px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#a78bfa';
      ctx.fillText(name1 + ':', 120, diffY + 50);
      ctx.fillStyle = '#cbd5e1';
      (result.differences.user1_unique || []).forEach(function (s, i) {
        ctx.fillText('• ' + s, 140, diffY + 90 + i * 36);
      });
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ec4899';
      ctx.fillText(name2 + ':', 960, diffY + 50);
      ctx.fillStyle = '#cbd5e1';
      (result.differences.user2_unique || []).forEach(function (s, i) {
        ctx.fillText('• ' + s, 940, diffY + 90 + i * 36);
      });
      ctx.textAlign = 'center';
    }

    // Footer
    ctx.fillStyle = '#475569';
    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.fillText('picksy.my/match', 540, 1820);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 20px Inter, system-ui, sans-serif';
    ctx.fillText('Перевір свою кіно-сумісність на picksy.my', 540, 1860);

    // Download
    try {
      canvas.toBlob(function (blob) {
        if (!blob) { showToast('Не вдалося створити картинку'); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'picksy-match-' + (result.score || 0) + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        showToast('Картинка збережена!');
      }, 'image/png');
    } catch (e) {
      showToast('Помилка збереження');
    }
  }

  // ─── Init ───

  async function init() {
    try {
      await loadQuizData();
    } catch (e) {
      STAGE.innerHTML = '<div class="match-loading"><div class="match-loading-emoji">😵</div><h2>Помилка завантаження</h2><br><button class="match-btn" onclick="location.reload()">Спробувати ще</button></div>';
      return;
    }

    if (TOKEN) {
      // Invitee flow — check match status
      try {
        var resp = await fetch(API + '/api/match/' + TOKEN);
        if (!resp.ok) throw new Error('Match not found');
        var data = await resp.json();

        if (data.status === 'completed' && data.result) {
          // Already completed — show results
          renderResults(data.result);
        } else {
          // Show invite landing
          renderInviteLanding(data.creator_name || 'Друг');
        }
      } catch (e) {
        STAGE.innerHTML = '<div class="match-loading"><div class="match-loading-emoji">😵</div><h2>Тест не знайдено</h2><p style="color:#94a3b8">Цей тест не існує або вже завершився.</p><br><a href="/match" class="match-btn">💞 Створити новий тест</a></div>';
      }
    } else {
      // Creator flow — bind start button
      var startBtn = document.getElementById('match-start-btn');
      if (startBtn) {
        startBtn.addEventListener('click', startCreatorQuiz);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
