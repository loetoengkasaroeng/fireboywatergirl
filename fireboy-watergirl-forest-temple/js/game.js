'use strict';
/* ============================================================
   GAME: loop (requestAnimationFrame + delta time), kontrol,
   efek visual, pencahayaan, partikel, dan hasil level.
   ============================================================ */
const Game = (() => {
  const cv = $('cv'), cx = cv.getContext('2d');
  const TS = Engine.TS, W = 960, H = 560, STEP = 1000 / 60;
  const CH = { 1: ['#ffb703', '#7a4f00', '255,183,3'], 2: ['#b36bff', '#4a2090', '179,107,255'], 3: ['#3dd9ff', '#0b5a70', '61,217,255'], 4: ['#ff6bb0', '#701f48', '255,107,176'] };
  const LIQ = {
    L: { deep: '#9a2a10', mid: '#e8452c', surf: '#ffb02e', hi: '#fff0a0', rgb: '255,120,40' },
    W: { deep: '#1d4f9a', mid: '#2e86de', surf: '#9fe3ff', hi: '#ffffff', rgb: '80,170,255' },
    G: { deep: '#1c5a12', mid: '#3fbf1f', surf: '#9dff4a', hi: '#eaffb0', rgb: '110,255,60' },
  };
  const GEM_ROWS = ['..g..', '.gwg.', 'ggggg', '.ggg.', '..g..'];

  let idx = 0, L = null, g = null, world = null, layers = {}, lamps = [], pools = [];
  let state = 'idle', raf = 0, last = 0, acc = 0, shake = 0, fade = 1, intro = 0, lastHud = '';
  const keys = {}, particles = [], flies = [];
  const chAnim = { 1: 0, 2: 0, 3: 0, 4: 0 }, chPrev = {};
  let leverAnim = [];
  const api = { onWin: null, onLose: null };
  let vignette = null;

  // ---------- memulai level ----------
  function start(n) {
    idx = clamp(n, 0, LEVELS.length - 1);
    L = LEVELS[idx];
    g = Engine.createState(L);
    world = worldOf(idx);
    layers = { far: buildFarLayer(world, idx), mid: buildMidLayer(world, idx), stone: buildStone(L, world, idx) };
    vignette = vignette || buildVignette();
    lamps = [3, 8, 13, 18, 21].filter(tx => L.grid[1][tx] === '.' && L.grid[2][tx] === '.' && L.grid[3][tx] === '.').map(tx => ({ x: tx * TS + 20, len: 26 + Math.floor(hash(tx, 3, idx) * 30) }));
    pools = [];
    for (let y = 0; y < 14; y++) for (let x = 0; x < 24; x++) if ('LWG'.includes(L.grid[y][x])) pools.push({ k: L.grid[y][x], x, y });
    particles.length = 0; flies.length = 0;
    if (settings.particles) for (let i = 0; i < 26; i++) flies.push({ x: Math.random() * W, y: 60 + Math.random() * 420, a: Math.random() * 6.28, s: 0.25 + Math.random() * 0.5, p: Math.random() * 6 });
    for (const k in chAnim) { chAnim[k] = 0; chPrev[k] = false; }
    leverAnim = L.levers.map(() => 0);
    shake = 0; fade = 1; intro = 170; acc = 0; last = 0; lastHud = '';
    state = 'play';
    $('hudLevel').textContent = 'LEVEL ' + (idx + 1);
    $('hudName').textContent = L.name;
    $('hint').textContent = L.hint;
    ['pause', 'victory', 'gameover'].forEach(id => $(id).classList.remove('show'));
    fit();
    Sound.theme('game');
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function stop() {
    cancelAnimationFrame(raf); raf = 0; state = 'idle';
    for (const k in keys) keys[k] = false;
    document.querySelectorAll('#touch button.on').forEach(b => b.classList.remove('on'));
  }
  const restart = () => start(idx);
  function pause() { if (state !== 'play') return; state = 'pause'; $('pause').classList.add('show'); Sound.play('pause'); }
  function resume() { if (state !== 'pause') return; state = 'play'; last = 0; $('pause').classList.remove('show'); }
  const isActive = () => state !== 'idle';

  // ---------- kontrol: Fireboy = WASD, Watergirl = tombol panah ----------
  const inputs = () => ({
    f: { left: keys.KeyA, right: keys.KeyD, up: keys.KeyW },
    w: { left: keys.ArrowLeft, right: keys.ArrowRight, up: keys.ArrowUp },
  });
  addEventListener('keydown', e => {
    if (!isActive() || $('settings').classList.contains('show') || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pause(); else if (state === 'pause') resume(); return; }
    if (e.code === 'KeyM') { settings.muted = !settings.muted; saveSettings(); Sound.applyVolumes(); toast(settings.muted ? 'Suara dimatikan' : 'Suara menyala'); return; }
    if (e.repeat && e.code === 'KeyR') return;
    if (e.code === 'KeyR' && state !== 'idle') { restart(); return; }
    keys[e.code] = true;
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(); });
  document.querySelectorAll('#touch button').forEach(btn => {            // layar sentuh: jempol kiri = Fireboy, kanan = Watergirl
    const k = btn.dataset.k;
    const set = v => e => { e.preventDefault(); keys[k] = v; btn.classList.toggle('on', v); };
    btn.addEventListener('pointerdown', set(true));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => btn.addEventListener(t, set(false)));
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });

  // ---------- ukuran kanvas mengikuti layar ----------
  function fit() {
    const portrait = innerHeight > innerWidth, touch = document.body.classList.contains('touch-on');
    const btn = Math.round(Math.max(44, Math.min(62, Math.min(innerWidth, innerHeight) * 0.115)));
    document.documentElement.style.setProperty('--btn', btn + 'px');
    const compact = innerHeight < 520;                                       // HP landscape: petunjuk disembunyikan agar kanvas besar
    const padW = touch && !portrait ? 2 * (btn * 3 + 16) + 24 : 0, padH = touch && portrait ? btn + 24 : 0;
    const availW = innerWidth - 24 - padW;
    const availH = innerHeight - $('hud').offsetHeight - (compact ? 0 : Math.max(46, $('hint').offsetHeight + 12)) - padH - (compact ? 22 : 44);
    const s = Math.max(0.2, Math.min(availW / W, availH / H));
    const w = Math.floor(W * s);
    cv.style.width = w + 'px'; cv.style.height = Math.floor(H * s) + 'px';
    $('stage').style.width = touch && portrait ? (w + 10) + 'px' : '';
  }
  addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 200));

  // ---------- partikel ----------
  function burst(x, y, color, n, sp, life) {
    if (!settings.particles) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = Math.random() * sp;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: (life || 36) + Math.random() * 18, max: (life || 36) + 18, c: color, s: 3, grav: 0.08 });
    }
  }
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.x += q.vx; q.y += q.vy; q.vy += q.grav; if (--q.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
  }
  function ambient() {
    if (!settings.particles) return;
    for (const p of g.players) {
      if (Math.random() < 0.3) particles.push(p.id === 'f'
        ? { x: p.x + 9 + Math.random() * 6, y: p.y + 2, vx: (Math.random() - 0.5) * 0.5, vy: -1.2, life: 18, max: 18, c: Math.random() < 0.5 ? '#ffb02e' : '#e8452c', s: 3, grav: 0 }
        : { x: p.x + 4 + Math.random() * 16, y: p.y + 6, vx: (Math.random() - 0.5) * 0.6, vy: -0.2, life: 22, max: 22, c: '#9fe3ff', s: 2, grav: 0.02 });
      if (p.grounded && p.moving && g.frame % 7 === 0) particles.push({ x: p.x + 12, y: p.y + p.h, vx: -p.dir * 0.6, vy: -0.4, life: 14, max: 14, c: '#a9b89a', s: 3, grav: 0 });
    }
    for (const pl of pools) {                                            // percikan lava, gelembung racun, kilau air
      const r = Math.random();
      if (pl.k === 'L' && r < 0.02) particles.push({ x: pl.x * TS + 8 + Math.random() * 24, y: pl.y * TS + 6, vx: (Math.random() - 0.5) * 0.4, vy: -1.2 - Math.random(), life: 34, max: 34, c: '#ffb02e', s: 2, grav: 0.04 });
      if (pl.k === 'G' && r < 0.025) particles.push({ x: pl.x * TS + 8 + Math.random() * 24, y: pl.y * TS + 8, vx: 0, vy: -0.45, life: 46, max: 46, c: '#9dff4a', s: 3, grav: -0.002 });
      if (pl.k === 'W' && r < 0.008) particles.push({ x: pl.x * TS + 8 + Math.random() * 24, y: pl.y * TS + 6, vx: 0, vy: -0.6, life: 24, max: 24, c: '#dff6ff', s: 2, grav: 0.03 });
    }
    if (Math.random() < 0.05) particles.push({ x: Math.random() * W, y: 8, vx: 0.3 + Math.random() * 0.3, vy: 0.5 + Math.random() * 0.4, life: 300, max: 300, c: '#5fbf4a', s: 3, grav: 0 });   // daun jatuh
  }

  // ---------- kejadian mesin -> suara dan efek ----------
  function handleEvents() {
    for (const e of g.events) {
      const p = e.id && g.players.find(q => q.id === e.id);
      const fx = p ? p.x + p.w / 2 : 0, fy = p ? p.y + p.h : 0;
      if (e.type === 'jump') { Sound.play('jump'); burst(fx, fy, '#a9b89a', 5, 1.2, 14); }
      else if (e.type === 'land') { Sound.play(p.ground && p.ground.id ? 'stack' : 'land'); burst(fx, fy, '#a9b89a', 6, 1.5, 16); }
      else if (e.type === 'gem') { Sound.play('gem'); burst(e.x, e.y, e.id === 'f' ? '#ffb02e' : '#9fe3ff', 18, 2.8); }
      else if (e.type === 'plate-on' || e.type === 'plate-off') Sound.play('plate');
      else if (e.type === 'lever') Sound.play('lever');
      else if (e.type === 'die') { Sound.play('die'); burst(fx, fy - 10, e.id === 'f' ? '#e8452c' : '#2e86de', 44, 4.2); shake = 16; }
      else if (e.type === 'win') Sound.play('win');
    }
    g.events = [];
    for (const k in chAnim) {                                            // gerbang/elevator berbunyi saat saluran berubah
      const on = !!g.act[k];
      if (on !== chPrev[k]) { chPrev[k] = on; if (L.gates.some(q => q.ch == k) || L.movers.some(q => q.ch == k)) Sound.play('gate'); }
    }
  }

  // ---------- satu langkah (60x per detik, waktu tetap) ----------
  function step() {
    Engine.tick(g, inputs());
    handleEvents();
    for (const k in chAnim) chAnim[k] += ((g.act[k] ? 1 : 0) - chAnim[k]) * 0.16;
    g.levers.forEach((lv, i) => { leverAnim[i] += ((lv.on ? 1 : 0) - leverAnim[i]) * 0.3; });
    updateParticles(); ambient();
    if (fade > 0) fade = Math.max(0, fade - 0.035);
    if (intro > 0) intro--;
    if (g.status === 'lose' && state === 'play') {
      state = 'lose';
      setTimeout(() => { if (state === 'lose' && api.onLose) api.onLose(g.cause); }, 750);
    } else if (g.status === 'win' && state === 'play') {
      state = 'win';
      for (const p of g.players) burst(p.x + 12, p.y + 10, p.id === 'f' ? '#ffd23f' : '#9fe3ff', 36, 4.5, 50);
      const secs = Math.floor(g.frame / 60), got = g.gems.filter(x => x.got).length, total = g.gems.length;
      const stars = 1 + (got === total ? 1 : 0) + (secs <= L.par ? 1 : 0);
      const score = got * 100 + Math.max(0, Math.round((L.par * 2 - secs) * 10)) + stars * 50;
      setTimeout(() => { if (state === 'win' && api.onWin) api.onWin({ idx, secs, gems: got, total, stars, score }); }, 900);
    }
  }

  // ---------- menggambar ----------
  function glow(x, y, r, rgb, a) {
    const gr = cx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    cx.fillStyle = gr; cx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function drawLamp(l, t) {
    const sway = Math.sin(t / 900 + l.x) * 1.5, y = 40 + l.len;
    cx.fillStyle = '#26301f'; cx.fillRect(l.x - 1, 40, 2, l.len);
    cx.fillStyle = '#2a2014'; cx.fillRect(l.x - 8 + sway, y, 16, 4); cx.fillRect(l.x - 8 + sway, y + 18, 16, 4);
    cx.fillStyle = '#ffd77a'; cx.globalAlpha = 0.85 + 0.15 * Math.sin(t / 130 + l.x); cx.fillRect(l.x - 5 + sway, y + 4, 10, 14); cx.globalAlpha = 1;
    cx.fillStyle = '#fff3b0'; cx.fillRect(l.x - 2 + sway, y + 8, 4, 7);
  }
  function drawRails() {
    for (const m of g.movers) {
      if (!m.dy) continue;
      const y1 = Math.min(m.y0, m.y0 + m.dy * TS), y2 = Math.max(m.y0, m.y0 + m.dy * TS) + 12;
      cx.fillStyle = '#1d140a';
      cx.fillRect(m.x0 + 4, y1, 4, y2 - y1); cx.fillRect(m.x0 + m.w * TS - 8, y1, 4, y2 - y1);
      cx.fillStyle = '#4a3a24';
      for (let y = y1 + 10; y < y2; y += 30) { cx.fillRect(m.x0 + 3, y, 6, 3); cx.fillRect(m.x0 + m.w * TS - 9, y, 6, 3); }
    }
  }
  function drawMover(m) {
    const w = m.w * TS;
    cx.fillStyle = '#3b2412'; cx.fillRect(m.x, m.y, w, 12);
    cx.fillStyle = '#8a5a2c'; cx.fillRect(m.x + 1, m.y, w - 2, 8);
    cx.fillStyle = '#b07a42'; cx.fillRect(m.x + 1, m.y, w - 2, 3);
    cx.fillStyle = '#3b2412'; for (let x = 20; x < w; x += 20) cx.fillRect(m.x + x, m.y, 2, 8);
    cx.fillStyle = '#5b626a'; cx.fillRect(m.x, m.y, 5, 12); cx.fillRect(m.x + w - 5, m.y, 5, 12);
    const c = CH[m.ch] || CH[1];
    cx.fillStyle = g.act[m.ch] ? c[0] : c[1]; cx.fillRect(m.x + w / 2 - 4, m.y + 3, 8, 4);          // lampu status saluran
  }
  function drawPlate(e) {
    const X = e.x * TS, Y = e.y * TS, c = CH[e.ch], h = e.on ? 2 : 7;
    cx.fillStyle = '#1b1f18'; cx.fillRect(X + 3, Y + 35, TS - 6, 5);
    cx.fillStyle = c[1]; cx.fillRect(X + 5, Y + 40 - 4 - h, TS - 10, h + 2);
    cx.fillStyle = e.on ? '#fff' : c[0]; cx.fillRect(X + 7, Y + 40 - 4 - h, TS - 14, 3);
  }
  function drawLever(e, i) {
    const X = e.x * TS, Y = e.y * TS, c = CH[e.ch], a = (leverAnim[i] - 0.5) * 1.5;
    cx.fillStyle = '#1b1f18'; cx.fillRect(X + 10, Y + 32, 20, 8);
    cx.fillStyle = '#6a7468'; cx.fillRect(X + 12, Y + 30, 16, 5);
    const px = X + 20, py = Y + 31, ex = px + Math.sin(a) * 22, ey = py - Math.cos(a) * 22;
    cx.strokeStyle = '#2a1c0c'; cx.lineWidth = 6; cx.beginPath(); cx.moveTo(px, py); cx.lineTo(ex, ey); cx.stroke();
    cx.strokeStyle = '#c89a50'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(px, py); cx.lineTo(ex, ey); cx.stroke();
    cx.fillStyle = e.on ? c[0] : c[1]; cx.fillRect(ex - 4, ey - 4, 8, 8);
  }
  function drawGate(e, t) {
    const anim = chAnim[e.ch], c = CH[e.ch], X = e.x * TS, Y = e.y * TS, hOpen = Math.round(e.h * TS * (1 - anim));
    cx.fillStyle = '#10150f'; cx.fillRect(X + 2, Y - 4, TS - 4, 8);                                   // lintel
    cx.fillStyle = c[1]; cx.fillRect(X + 6, Y - 2, TS - 12, 6);
    cx.fillStyle = c[0]; cx.globalAlpha = 0.6 + 0.4 * Math.sin(t / 260); cx.fillRect(X + 15, Y - 2, 10, 5); cx.globalAlpha = 1;
    if (hOpen < 2) return;
    cx.fillStyle = '#222b22'; cx.fillRect(X + 4, Y, TS - 8, hOpen);
    cx.fillStyle = '#323d33'; cx.fillRect(X + 4, Y, 4, hOpen);
    cx.fillStyle = c[1]; cx.fillRect(X + TS - 10, Y, 6, hOpen);
    for (let k = 0; k < e.h; k++) {                                                                    // rune berpendar di tiap petak
      const ry = Y + k * TS + 12; if (ry + 16 > Y + hOpen) break;
      cx.fillStyle = c[0]; cx.globalAlpha = 0.55 + 0.4 * Math.sin(t / 300 + k); cx.fillRect(X + 16, ry, 8, 3); cx.fillRect(X + 18, ry, 4, 16); cx.fillRect(X + 12, ry + 8, 16, 3); cx.globalAlpha = 1;
    }
  }
  function drawDoor(id, t) {
    const d = g.doors[id], X = d.x * TS, Y = d.y * TS, p = g.players.find(q => q.id === id);
    const dark = id === 'f' ? '#a82814' : '#1d5fa8', mid = id === 'f' ? '#e8452c' : '#2e86de', light = id === 'f' ? '#ffb02e' : '#9fe3ff';
    const inside = Engine.overlap(p, { x: X + 6, y: Y, w: TS - 12, h: TS });
    cx.fillStyle = '#10150f'; cx.fillRect(X + 1, Y - 4, TS - 2, TS + 4);
    cx.fillStyle = '#4a5a48'; cx.fillRect(X + 3, Y - 2, TS - 6, 5); cx.fillRect(X + 3, Y - 2, 5, TS + 2); cx.fillRect(X + TS - 8, Y - 2, 5, TS + 2);
    cx.fillStyle = dark; cx.fillRect(X + 8, Y + 3, TS - 16, TS - 3);
    cx.fillStyle = inside ? light : '#0a120c'; cx.fillRect(X + 10, Y + 5, TS - 20, TS - 5);
    cx.fillStyle = '#4fa844'; cx.fillRect(X + 3, Y - 4, 7, 4); cx.fillRect(X + TS - 10, Y - 4, 7, 4); cx.fillRect(X + 6, Y + 2, 3, 12);       // sulur
    const icon = id === 'f' ? ['..o..', '.ooo.', 'oyyyo', '.ooo.'] : ['..b..', '.bbb.', 'bwwwb', '.bbb.'];
    drawRows(cx, icon, { o: '#ff6a3d', y: '#ffd23f', b: '#2e86de', w: '#d6f4ff' }, 3, X + 12, Y + 14 + Math.round(Math.sin(t / 300)));
  }
  function drawGems(t) {
    for (const gm of g.gems) {
      if (gm.got) continue;
      const bob = Math.round(Math.sin(t / 250 + gm.x) * 3);
      drawRows(cx, GEM_ROWS, { g: gm.kind === 'f' ? '#ff6a3d' : '#7bd3ff', w: '#fff' }, 4, gm.x * TS + 10, gm.y * TS + 10 + bob, true);
    }
  }
  function drawPlayer(p, t) {
    const pose = !p.grounded ? 'jump' : p.moving ? (Math.floor(p.walk / 6) % 2 ? 'a' : 'b') : 'stand';
    const bob = p.grounded && !p.moving && Math.floor(t / 450) % 2 ? 1 : 0;
    cx.fillStyle = 'rgba(0,0,0,0.3)'; cx.fillRect(Math.round(p.x) + 2, Math.round(p.y + p.h) - 1, p.w - 4, 3);
    drawRows(cx, spriteRows(p.id, pose, p.dir < 0, Math.floor(t / 130) % 2), PALETTE[p.id], 3, Math.round(p.x), Math.round(p.y) + bob, true);
  }
  // Cairan berada DI DALAM tanah: permukaannya sedikit di bawah lantai dan diapit batu
  function drawLiquid(pl, t) {
    const q = LIQ[pl.k], X = pl.x * TS, Y = pl.y * TS, hasPlate = L.plates.some(e => e.x === pl.x && e.y === pl.y) || L.levers.some(e => e.x === pl.x && e.y === pl.y);
    cx.globalAlpha = hasPlate ? 0.72 : 0.92;
    cx.fillStyle = q.mid; cx.fillRect(X, Y + 5, TS, TS - 5);
    cx.fillStyle = q.deep; cx.fillRect(X, Y + 24, TS, TS - 24);
    cx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) {
      const w = Math.round(Math.sin(t / 260 + (X + i * 4) / 10) * 2);
      cx.fillStyle = q.surf; cx.fillRect(X + i * 4, Y + 3 + w, 4, 5);
      if ((i + Math.floor(t / 200)) % 5 === 0) { cx.fillStyle = q.hi; cx.fillRect(X + i * 4, Y + 3 + w, 4, 2); }
    }
    cx.fillStyle = 'rgba(0,0,0,0.28)';
    if (L.grid[pl.y][pl.x - 1] === '#') cx.fillRect(X, Y + 5, 4, TS - 5);
    if (L.grid[pl.y][pl.x + 1] === '#') cx.fillRect(X + TS - 4, Y + 5, 4, TS - 5);
    const bub = (t / 45 + X * 3) % 26;
    cx.fillStyle = q.hi; cx.fillRect(X + 8 + (X * 5) % 22, Y + TS - 8 - bub, 3, 3);
  }

  function render(ts, dt) {
    const t = ts;
    cx.save();
    if (shake > 0) { if (settings.shake) cx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake = shake < 0.5 ? 0 : shake * 0.88; }
    const mx = ((g.players[0].x + g.players[1].x) / 2 - W / 2) / (W / 2);                       // parallax mengikuti pemain
    cx.drawImage(layers.far, -40 - mx * 14, 0);
    cx.drawImage(layers.mid, -40 - mx * 30, 0);
    cx.globalAlpha = 0.07; cx.fillStyle = world.ray;                                              // berkas cahaya bergerak
    [180, 520, 800].forEach((bx, i) => { const o = Math.sin(t / 2200 + i * 2) * 16; cx.beginPath(); cx.moveTo(bx + o, 0); cx.lineTo(bx + 44 + o, 0); cx.lineTo(bx + 250 + o, H); cx.lineTo(bx + 120 + o, H); cx.fill(); });
    cx.globalAlpha = 1;
    lamps.forEach(l => drawLamp(l, t));
    cx.drawImage(layers.stone, 0, 0);
    drawRails();
    L.plates.length && g.plates.forEach(drawPlate);
    g.levers.forEach(drawLever);
    g.gates.forEach(e => drawGate(e, t));
    g.movers.forEach(drawMover);
    drawDoor('f', t); drawDoor('w', t);
    drawGems(t);
    g.players.forEach(p => drawPlayer(p, t));
    pools.forEach(pl => drawLiquid(pl, t));
    for (const q of particles) { cx.globalAlpha = Math.max(0, q.life / q.max); cx.fillStyle = q.c; cx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); }
    cx.globalAlpha = 1;

    cx.globalCompositeOperation = 'lighter';                                                      // pencahayaan
    lamps.forEach(l => glow(l.x, 40 + l.len + 12, 95, '255,200,110', 0.28 + 0.05 * Math.sin(t / 130 + l.x)));
    pools.forEach(pl => { const q = LIQ[pl.k]; glow(pl.x * TS + 20, pl.y * TS + 8, pl.k === 'W' ? 46 : 64, q.rgb, pl.k === 'L' ? 0.28 : pl.k === 'G' ? 0.22 : 0.14); });
    g.gems.forEach(gm => { if (!gm.got) glow(gm.x * TS + 20, gm.y * TS + 20, 26, gm.kind === 'f' ? '255,120,60' : '120,210,255', 0.35); });
    g.players.forEach(p => glow(p.x + 12, p.y + 14, 48, p.id === 'f' ? '255,110,40' : '90,190,255', 0.22));
    ['f', 'w'].forEach(id => glow(g.doors[id].x * TS + 20, g.doors[id].y * TS + 20, 40, id === 'f' ? '255,110,40' : '90,190,255', 0.2 + 0.08 * Math.sin(t / 300)));
    g.plates.forEach(e => { if (e.on) glow(e.x * TS + 20, e.y * TS + 34, 40, CH[e.ch][2], 0.4); });
    g.levers.forEach(e => { if (e.on) glow(e.x * TS + 20, e.y * TS + 22, 36, CH[e.ch][2], 0.35); });
    g.gates.forEach(e => glow(e.x * TS + 20, e.y * TS, 30, CH[e.ch][2], 0.2 * (1 - chAnim[e.ch]) + 0.05));
    if (settings.particles) flies.forEach(f => {
      f.a += 0.012 * f.s; f.x += Math.cos(f.a) * f.s; f.y += Math.sin(f.a * 1.3) * f.s * 0.6;
      if (f.x < 0) f.x = W; if (f.x > W) f.x = 0; if (f.y < 50) f.y = 50; if (f.y > 500) f.y = 500;
      glow(f.x, f.y, 10, world.fly, 0.25 + 0.55 * Math.abs(Math.sin(t / 420 + f.p)));
    });
    cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = 'rgba(' + world.mist + ',0.05)';                                               // kabut tipis
    for (let i = 0; i < 3; i++) cx.fillRect(((t / 60 + i * 340) % (W + 300)) - 300, 360 + i * 40, 300, 22);
    cx.drawImage(vignette, 0, 0);

    if (intro > 0) {                                                                              // judul level
      const a = Math.min(1, intro / 40, (170 - intro) / 25);
      cx.globalAlpha = Math.max(0, a); cx.textAlign = 'center';
      cx.font = '900 34px "Courier New", monospace'; cx.fillStyle = '#04100a'; cx.fillText('LEVEL ' + (idx + 1), W / 2 + 3, 233); cx.fillStyle = '#ffe48a'; cx.fillText('LEVEL ' + (idx + 1), W / 2, 230);
      cx.font = '900 18px "Courier New", monospace'; cx.fillStyle = '#04100a'; cx.fillText(L.name.toUpperCase(), W / 2 + 2, 272); cx.fillStyle = '#f4ecd0'; cx.fillText(L.name.toUpperCase(), W / 2, 270);
      cx.globalAlpha = 1; cx.textAlign = 'left';
    }
    if (fade > 0) { cx.fillStyle = 'rgba(0,0,0,' + fade + ')'; cx.fillRect(0, 0, W, H); }
    cx.restore();
  }

  function hud() {
    const secs = fmtTime(g.frame / 60);
    const gf = g.gems.filter(x => x.kind === 'f'), gw = g.gems.filter(x => x.kind === 'w');
    const s = secs + '|' + gf.filter(x => x.got).length + '/' + gf.length + '|' + gw.filter(x => x.got).length + '/' + gw.length;
    if (s === lastHud) return; lastHud = s;
    $('hudTime').textContent = secs;
    $('hudGems').innerHTML = '<span class="f">&#9670; ' + gf.filter(x => x.got).length + '/' + gf.length + '</span> <span class="w">&#9670; ' + gw.filter(x => x.got).length + '/' + gw.length + '</span>';
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(100, ts - (last || ts)); last = ts;
    if (state === 'play') {                                                                       // waktu tetap: stabil di layar 60/90/120/144 Hz
      acc += dt; let n = 0;
      while (acc >= STEP && n++ < 5) { step(); acc -= STEP; }
      if (n >= 5) acc = 0;
    } else if (state === 'lose' || state === 'win') {
      acc += dt; while (acc >= STEP) { updateParticles(); if (fade > 0) fade = Math.max(0, fade - 0.035); acc -= STEP; }
    }
    render(ts, dt); hud();
  }

  return { start, stop, restart, pause, resume, fit, isActive, api, get index() { return idx; }, get state() { return state; } };
})();

