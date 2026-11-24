'use strict';
/* ============================================================
   ANTARMUKA MULTI-HALAMAN: login, register, dashboard, level,
   gameplay, pengaturan, jeda, menang, dan game over.
   ============================================================ */
const UI = (() => {
  const page = document.body.dataset.page || 'index';
  const MINI = { '#': '#5f7a5a', L: '#e8452c', W: '#2e86de', G: '#6bd83a' };
  const CHC = { 1: '#ffb703', 2: '#b36bff', 3: '#3dd9ff', 4: '#ff6bb0' };

  const pages = {
    landing: 'index.html', index: 'index.html',
    login: 'login.html', register: 'register.html',
    dashboard: 'dashboard.html', levels: 'levels.html', game: 'game.html'
  };

  function go(name, level) {
    if (name === 'play') name = getSession() ? 'dashboard' : 'login';
    if (['dashboard', 'levels', 'game'].includes(name) && !getSession()) name = 'login';
    if (['login', 'register'].includes(name) && getSession()) name = 'dashboard';
    let url = pages[name] || 'index.html';
    if (name === 'game') url += '?level=' + (Number.isFinite(level) ? level + 1 : 1);
    window.location.href = url;
  }

  function applyTouch() {
    const on = settings.touch === 'on' || (settings.touch === 'auto' && (matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0));
    document.body.classList.toggle('touch-on', on);
    if (typeof Game !== 'undefined') Game.fit();
  }

  function syncSettings() {
    if (!$('settings')) return;
    $('setMusic').value = Math.round(settings.music * 100); $('outMusic').textContent = Math.round(settings.music * 100) + '%';
    $('setSfx').value = Math.round(settings.sfx * 100); $('outSfx').textContent = Math.round(settings.sfx * 100) + '%';
    $('setMute').checked = settings.muted; $('setParticles').checked = settings.particles; $('setShake').checked = settings.shake; $('setTouch').value = settings.touch;
  }

  function bindSettings() {
    if (!$('settings')) return;
    $('setMusic').oninput = e => { settings.music = e.target.value / 100; $('outMusic').textContent = e.target.value + '%'; saveSettings(); Sound.applyVolumes(); };
    $('setSfx').oninput = e => { settings.sfx = e.target.value / 100; $('outSfx').textContent = e.target.value + '%'; saveSettings(); Sound.applyVolumes(); };
    $('setSfx').onchange = () => Sound.play('gem');
    $('setMute').onchange = e => { settings.muted = e.target.checked; saveSettings(); Sound.applyVolumes(); };
    $('setParticles').onchange = e => { settings.particles = e.target.checked; saveSettings(); };
    $('setShake').onchange = e => { settings.shake = e.target.checked; saveSettings(); };
    $('setTouch').onchange = e => { settings.touch = e.target.value; saveSettings(); applyTouch(); };
    $('setClose').onclick = () => $('settings').classList.remove('show');
    $('settings').addEventListener('pointerdown', e => { if (e.target === $('settings')) $('settings').classList.remove('show'); });
    $('setReset').onclick = () => {
      const session = getSession();
      if (!session) { toast('Masuk dulu untuk menghapus progres.'); return; }
      if (confirm('Hapus semua progres akun ' + session.name + '?')) {
        saveProgress(session.name, { unlocked: 1, levels: {} });
        toast('Progres dihapus.');
        if (page === 'dashboard') renderDashboard();
        if (page === 'levels') renderLevels();
      }
    };
    addEventListener('keydown', e => { if (e.key === 'Escape' && $('settings').classList.contains('show')) $('settings').classList.remove('show'); });
  }

  function openSettings() { syncSettings(); $('settings').classList.add('show'); }

  function renderDashboard() {
    const session = getSession();
    if (!session) return;
    const P = getProgress(session.name), values = Object.values(P.levels);
    const done = values.length;
    const stars = values.reduce((a, x) => a + x.stars, 0);
    const gems = values.reduce((a, x) => a + x.gems, 0);
    const score = values.reduce((a, x) => a + x.score, 0);
    $('dashUser').textContent = session.name.toUpperCase();
    $('stLevels').textContent = done + '/' + LEVELS.length;
    $('stStars').textContent = stars + '/' + LEVELS.length * 3;
    $('stGems').textContent = gems;
    $('stScore').textContent = score;
    const next = Math.min(P.unlocked, LEVELS.length);
    $('btnContinue').textContent = done === 0 ? 'MULAI MAIN' : 'LEVEL ' + next;
    $('btnContinue').onclick = () => go('game', next - 1);
  }

  function drawMini(canvas, L) {
    const px = 6; canvas.width = 24 * px; canvas.height = 14 * px;
    const c = canvas.getContext('2d');
    c.fillStyle = '#0a1a10'; c.fillRect(0, 0, canvas.width, canvas.height);
    L.grid.forEach((row, y) => row.forEach((ch, x) => { if (MINI[ch]) { c.fillStyle = MINI[ch]; c.fillRect(x * px, y * px, px, px); } }));
    L.gates.forEach(e => { c.fillStyle = CHC[e.ch]; c.fillRect(e.x * px + 2, e.y * px, 2, e.h * px); });
    L.plates.forEach(e => { c.fillStyle = CHC[e.ch]; c.fillRect(e.x * px, (e.y + 1) * px - 2, px, 2); });
    L.levers.forEach(e => { c.fillStyle = CHC[e.ch]; c.fillRect(e.x * px + 2, e.y * px + 1, 2, px - 1); });
    L.movers.forEach(e => { c.fillStyle = '#c8924f'; c.fillRect(e.x * px, e.y * px, e.w * px, 2); });
    L.gems.forEach(e => { c.fillStyle = e.kind === 'f' ? '#ff9a4d' : '#7fd0ff'; c.fillRect(e.x * px + 1, e.y * px + 1, 3, 3); });
    c.fillStyle = '#ff6a2b'; c.fillRect(L.doors.f.x * px, L.doors.f.y * px, px, px);
    c.fillStyle = '#3fa7ff'; c.fillRect(L.doors.w.x * px, L.doors.w.y * px, px, px);
  }

  function renderLevels() {
    const session = getSession();
    if (!session) return;
    const P = getProgress(session.name), grid = $('levelGrid');
    grid.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const open = i < P.unlocked, rec = P.levels[i];
      const card = document.createElement('div');
      card.className = 'panel card' + (open ? '' : ' locked');
      card.innerHTML = '<div class="no">LEVEL ' + (i + 1) + '</div><canvas></canvas><div class="nm">' + L.name + '</div>' +
        '<div class="st">' + [1, 2, 3].map(n => '<i class="' + (rec && rec.stars >= n ? 'on' : '') + '">&#9733;</i>').join('') + '</div>' +
        '<div class="rec">' + (rec ? fmtTime(rec.secs) + ' &middot; skor ' + rec.score : (open ? 'Belum dimainkan' : '')) + '</div>';
      drawMini(card.querySelector('canvas'), L);
      card.tabIndex = open ? 0 : -1;
      if (open) {
        const start = () => { Sound.play('click'); go('game', i); };
        card.onclick = start;
        card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') start(); };
      } else card.onclick = () => toast('Selesaikan level ' + i + ' untuk membuka level ini.');
      grid.appendChild(card);
    });
  }

  function setupAuth() {
    if (page === 'login' && $('loginForm')) {
      $('loginForm').addEventListener('submit', e => {
        e.preventDefault();
        const result = loginUser($('lu').value, $('lp').value), message = $('loginMsg');
        message.textContent = result.msg; message.className = 'msg ' + (result.ok ? 'ok' : 'err');
        if (result.ok) setTimeout(() => go('dashboard'), 450);
      });
    }
    if (page === 'register' && $('registerForm')) {
      $('registerForm').addEventListener('submit', e => {
        e.preventDefault();
        const result = registerUser($('ru').value, $('rp').value, $('rc').value), message = $('regMsg');
        message.textContent = result.msg; message.className = 'msg ' + (result.ok ? 'ok' : 'err');
        if (result.ok) setTimeout(() => go('login'), 1100);
      });
    }
  }

  function setupGame() {
    Game.api.onWin = result => {
      const user = getSession().name, P = getProgress(user), old = P.levels[result.idx];
      P.levels[result.idx] = {
        score: Math.max(result.score, old ? old.score : 0),
        secs: old ? Math.min(result.secs, old.secs) : result.secs,
        gems: Math.max(result.gems, old ? old.gems : 0),
        stars: Math.max(result.stars, old ? old.stars : 0),
      };
      P.unlocked = Math.max(P.unlocked, Math.min(LEVELS.length, result.idx + 2));
      saveProgress(user, P);
      $('vStars').innerHTML = [1, 2, 3].map(n => '<i class="' + (result.stars >= n ? 'on' : '') + '" style="animation-delay:' + n * 0.18 + 's">&#9733;</i>').join('');
      $('vInfo').innerHTML = 'Waktu <b>' + fmtTime(result.secs) + '</b> (target ' + fmtTime(LEVELS[result.idx].par) + ')<br>Permata <b>' + result.gems + '/' + result.total + '</b><br>Skor <b>' + result.score + '</b>';
      const last = result.idx >= LEVELS.length - 1;
      $('vNext').textContent = last ? 'SEMUA LEVEL TAMAT!' : 'LEVEL BERIKUTNYA';
      $('vNext').onclick = () => { if (last) go('levels'); else go('game', result.idx + 1); };
      $('victory').classList.add('show');
    };
    Game.api.onLose = cause => { $('goCause').textContent = cause || 'Kalian gagal.'; $('gameover').classList.add('show'); };

    $('btnPause').onclick = () => Game.pause();
    $('btnRestart').onclick = () => Game.restart();
    $('pResume').onclick = () => Game.resume();
    $('pRestart').onclick = () => Game.restart();
    $('pLevels').onclick = () => go('levels');
    $('pQuit').onclick = () => go('dashboard');
    $('vReplay').onclick = () => Game.restart();
    $('vLevels').onclick = () => go('levels');
    $('goRetry').onclick = () => Game.restart();
    $('goLevels').onclick = () => go('levels');
    $('goDash').onclick = () => go('dashboard');

    const requested = Number.parseInt(new URLSearchParams(location.search).get('level') || '1', 10);
    const P = getProgress(getSession().name);
    const levelIndex = clamp((Number.isFinite(requested) ? requested : 1) - 1, 0, Math.min(P.unlocked, LEVELS.length) - 1);
    MenuBg.stop();
    Game.start(levelIndex);
  }

  function bindNavigation() {
    document.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', e => {
      e.preventDefault(); Sound.play('click'); go(el.dataset.go);
    }));
    document.querySelectorAll('[data-settings]').forEach(el => el.addEventListener('click', () => {
      Sound.play('click'); openSettings();
    }));
    if ($('btnLogout')) $('btnLogout').onclick = () => { logoutUser(); toast('Berhasil keluar.'); setTimeout(() => go('landing'), 100); };
  }

  function init() {
    const protectedPage = ['dashboard', 'levels', 'game'].includes(page);
    const guestOnlyPage = ['login', 'register'].includes(page);
    if (protectedPage && !getSession()) { go('login'); return; }
    if (guestOnlyPage && getSession()) { go('dashboard'); return; }

    bindNavigation(); bindSettings(); syncSettings(); setupAuth(); applyTouch();
    if (page === 'index') { MenuBg.start(); drawLogo(); Sound.theme('menu'); }
    else if (page !== 'game') { MenuBg.start(); Sound.theme('menu'); }
    if (page === 'dashboard') renderDashboard();
    if (page === 'levels') renderLevels();
    if (page === 'game') setupGame();
  }
  return { init, go };
})();
UI.init();
