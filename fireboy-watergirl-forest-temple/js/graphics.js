'use strict';
/* ============================================================
   SENI PIKSEL: karakter, logo, latar menu, dan pembuat latar level
   ============================================================ */
const BODY = {
  f: ['...oo...', '..orro..', '.orrrro.', '.rwrrwr.', '.rrrrrr.', '..rrrd..', '.rrrrrd.', '.rrrrdd.'],
  w: ['..llll..', '.llbbll.', '.bbbbbb.', '.bwbbwb.', '.bbbbbb.', '..bbbd..', '.bbbbbd.', '.bbbbdd.'],
};
const LEGS = { stand: ['..X..X..', '..X..X..'], a: ['..XX....', '..X.X...'], b: ['....XX..', '...X.X..'], jump: ['.X....X.', '.X....X.'] };
const PALETTE = {
  f: { o: '#ffb02e', r: '#e8452c', d: '#a82814', w: '#fff5dc' },
  w: { l: '#9fe3ff', b: '#2e86de', d: '#1d5fa8', w: '#fff5dc' },
};
function spriteRows(id, pose, flip, tick) {
  const legs = LEGS[pose].map(r => r.replace(/X/g, id === 'f' ? 'r' : 'b'));
  const rows = BODY[id].concat(legs);
  if (id === 'f' && tick) { rows[0] = '..o..o..'; rows[1] = '..oroo..'; }       // api di kepala berkedip
  return flip ? rows.map(r => [...r].reverse().join('')) : rows;
}
function drawRows(ctx, rows, palette, px, X, Y, outline) {
  if (outline) {
    ctx.fillStyle = '#04100a';
    rows.forEach((row, j) => [...row].forEach((k, i) => { if (k !== '.') ctx.fillRect(X + i * px - 1, Y + j * px - 1, px + 2, px + 2); }));
  }
  rows.forEach((row, j) => [...row].forEach((k, i) => { if (k !== '.') { ctx.fillStyle = palette[k]; ctx.fillRect(X + i * px, Y + j * px, px, px); } }));
}

// ---------- font piksel 5x7 (untuk logo) ----------
const GLYPHS = {};
('A:.###./#...#/#...#/#####/#...#/#...#/#...#|B:####./#...#/#...#/####./#...#/#...#/####.|E:#####/#..../#..../####./#..../#..../#####|' +
 'F:#####/#..../#..../####./#..../#..../#....|G:.####/#..../#..../#.###/#...#/#...#/.####|I:.###./..#../..#../..#../..#../..#../.###.|' +
 'L:#..../#..../#..../#..../#..../#..../#####|M:#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#|O:.###./#...#/#...#/#...#/#...#/#...#/.###.|' +
 'P:####./#...#/#...#/####./#..../#..../#....|R:####./#...#/#...#/####./#.#../#..#./#...#|S:.####/#..../#..../.###./....#/....#/####.|' +
 'T:#####/..#../..#../..#../..#../..#../..#..|W:#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#|Y:#...#/#...#/.#.#./..#../..#../..#../..#..|' +
 '&:.##../#..#./.##../.#.#./#..##/#...#/.###.| : ...../...../...../...../...../...../.....').split('|')
  .forEach(s => { GLYPHS[s[0]] = s.slice(2).split('/'); });

function drawPixelLine(c, text, cx, y, px, stops) {
  const w = (text.length * 6 - 1) * px, x0 = Math.round(cx - w / 2);
  const grad = c.createLinearGradient(0, y, 0, y + 7 * px);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  const cells = [];
  [...text].forEach((ch, i) => {
    const gl = GLYPHS[ch]; if (!gl) return;
    gl.forEach((row, j) => [...row].forEach((v, k) => { if (v === '#') cells.push([x0 + (i * 6 + k) * px, y + j * px]); }));
  });
  const e = Math.max(2, Math.round(px / 3));
  c.fillStyle = 'rgba(0,0,0,0.5)'; cells.forEach(([X, Y]) => c.fillRect(X + px * 0.45, Y + px * 0.6, px, px));   // bayangan
  c.fillStyle = '#04100a'; cells.forEach(([X, Y]) => c.fillRect(X - e, Y - e, px + e * 2, px + e * 2));            // garis tepi
  c.fillStyle = grad; cells.forEach(([X, Y]) => c.fillRect(X, Y, px, px));
  c.fillStyle = 'rgba(255,255,255,0.28)'; cells.forEach(([X, Y]) => c.fillRect(X, Y, px, Math.max(1, Math.floor(px / 4))));   // kilau
}
function drawLogo() {
  const c = $('logo').getContext('2d');
  c.clearRect(0, 0, 720, 260);
  drawPixelLine(c, 'FIREBOY', 360, 14, 12, [[0, '#fff3a0'], [0.45, '#ffa21f'], [1, '#e8452c']]);
  drawPixelLine(c, '& WATERGIRL', 360, 112, 9, [[0, '#ffffff'], [0.45, '#9fe3ff'], [1, '#2e86de']]);
  drawPixelLine(c, 'FOREST TEMPLE', 360, 196, 6, [[0, '#e9ffb0'], [0.5, '#6fdc4f'], [1, '#2f7d3a']]);
}

// ---------- latar menu: hutan kuil malam hari, beranimasi ----------
const MenuBg = (() => {
  const W = 480, H = 270, GY = 222;
  let canvas = null, c = null, raf = 0, seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stars = [], flies = [], trees = [], leaves = [];
  const SKY = [[4, 12, 20], [8, 34, 34], [16, 66, 52], [36, 104, 66], [70, 140, 76]];
  function setup() {
    seed = 5; stars.length = flies.length = trees.length = leaves.length = 0;
    for (let i = 0; i < 70; i++) stars.push({ x: rnd() * W, y: rnd() * 110, p: rnd() * 6 });
    for (let i = 0; i < 46; i++) flies.push({ x: rnd() * W, y: 90 + rnd() * 140, a: rnd() * 6.28, s: 0.2 + rnd() * 0.5, p: rnd() * 6 });
    for (let i = 0; i < 9; i++) trees.push({ x: i * 62 + rnd() * 30, w: 16 + rnd() * 16, h: 120 + rnd() * 80, layer: i % 2 });
    for (let i = 0; i < 16; i++) leaves.push({ x: rnd() * W, y: rnd() * H, v: 0.2 + rnd() * 0.3, p: rnd() * 6 });
  }
  function glow(x, y, r, rgb, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function sky() {
    for (let y = 0; y < GY; y += 6) {
      const k = (y / GY) * (SKY.length - 1), i = Math.floor(k), f = k - i, a = SKY[i], b = SKY[Math.min(i + 1, SKY.length - 1)];
      c.fillStyle = 'rgb(' + [0, 1, 2].map(j => Math.round(a[j] + (b[j] - a[j]) * f)).join(',') + ')';
      c.fillRect(0, y, W, 6);
    }
  }
  function tree(t, tr, col, canopy) {
    const x = Math.round(tr.x + Math.sin(t / 3200 + tr.x) * (tr.layer ? 3 : 1.5)), top = GY - tr.h;
    c.fillStyle = col; c.fillRect(x, top, tr.w, tr.h);
    c.fillStyle = canopy;
    for (let k = 0; k < 5; k++) c.fillRect(x - 18 + ((k * 13 + tr.x) % 36), top - 8 + ((k * 7) % 14), 26 + (k % 3) * 8, 16);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + tr.w - 4, top, 4, tr.h);
  }
  function temple(t) {
    const X = 168, w = 144;
    c.fillStyle = '#0a2a22';
    for (let i = 0; i < 6; i++) c.fillRect(X + i * 10, GY - 20 - i * 12 - 0, w - i * 20, 12);        // tangga piramida
    c.fillStyle = '#0d352a'; c.fillRect(X + 40, GY - 112, 64, 36);
    c.fillStyle = '#071d17'; c.fillRect(X + 60, GY - 96, 24, 40);                                      // pintu kuil
    const p = 0.6 + 0.4 * Math.sin(t / 700);
    c.globalAlpha = p; c.fillStyle = '#ffe48a'; c.fillRect(X + 66, GY - 90, 12, 34); c.globalAlpha = 1;
    c.fillStyle = '#6fdc4f';
    [[X + 46, GY - 106], [X + 92, GY - 106], [X + 20, GY - 44], [X + 118, GY - 44]].forEach(([rx, ry], i) => { c.globalAlpha = 0.5 + 0.5 * Math.sin(t / 500 + i); c.fillRect(rx, ry, 6, 10); c.fillRect(rx + 2, ry - 2, 2, 14); });
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter'; glow(X + 72, GY - 76, 60, '255,220,120', 0.3 * p); glow(X + 72, GY - 100, 90, '90,255,160', 0.1); c.globalCompositeOperation = 'source-over';
  }
  function frame(t) {
    sky();
    c.fillStyle = '#fff';
    stars.forEach(s => { c.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t / 800 + s.p)); c.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); });
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter'; glow(60, 46, 70, '200,255,220', 0.22); c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#e9ffe0';
    for (let dy = -14; dy <= 14; dy += 2) { const hw = Math.round(Math.sqrt(14 * 14 - dy * dy)); c.fillRect(60 - hw, 46 + dy, hw * 2, 2); }
    trees.filter(tr => !tr.layer).forEach(tr => tree(t, tr, '#06241c', '#08301f'));
    c.globalAlpha = 0.07; c.fillStyle = '#d8ffb0';                                                       // berkas cahaya
    [70, 210, 340].forEach((bx, i) => { const o = Math.sin(t / 1800 + i) * 10; c.beginPath(); c.moveTo(bx + o, 0); c.lineTo(bx + 26 + o, 0); c.lineTo(bx + 120 + o, GY); c.lineTo(bx + 60 + o, GY); c.fill(); });
    c.globalAlpha = 1;
    temple(t);
    trees.filter(tr => tr.layer).forEach(tr => tree(t, tr, '#0a2e1e', '#0f4a26'));
    c.fillStyle = '#0a1f12'; c.fillRect(0, GY, W, H - GY);                                               // tanah
    for (let r = 0; r < 5; r++) for (let x = (r % 2 ? -10 : 0); x < W; x += 20) { c.fillStyle = (r + x / 20) % 3 ? '#35503a' : '#2c4631'; c.fillRect(x + 1, GY + 5 + r * 9, 18, 8); }
    c.fillStyle = '#3f9a45'; c.fillRect(0, GY, W, 5);
    c.fillStyle = '#6fdc4f'; for (let x = 0; x < W; x += 6) c.fillRect(x, GY - 1 - ((x * 7) % 3), 2, 3);
    // Fireboy & Watergirl berdiri dan melompat bersama
    const hopT = t % 4800, hop = hopT < 520 ? Math.sin((hopT / 520) * Math.PI) * 16 : 0;
    [['f', 84], ['w', 372]].forEach(([id, x]) => {
      const rows = spriteRows(id, hop > 0 ? 'jump' : 'stand', id === 'w', Math.floor(t / 140) % 2);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 2, GY - 1, 20, 3);
      drawRows(c, rows, PALETTE[id], 3, x, Math.round(GY - 30 - hop + (Math.floor(t / 500) % 2 && !hop ? 1 : 0)), true);
    });
    c.globalCompositeOperation = 'lighter'; glow(96, GY - 16, 40, '255,110,40', 0.2); glow(384, GY - 16, 40, '70,170,255', 0.2); c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgba(150,230,170,0.07)';                                                              // kabut
    for (let i = 0; i < 4; i++) c.fillRect(((t / 40 + i * 140) % (W + 200)) - 200, 150 + i * 22, 200, 14);
    if (settings.particles) {
      c.globalCompositeOperation = 'lighter';
      flies.forEach(f => {
        f.a += 0.01 * f.s; f.x += Math.cos(f.a) * f.s; f.y += Math.sin(f.a * 1.3) * f.s * 0.6;
        if (f.x < -5) f.x = W + 5; if (f.x > W + 5) f.x = -5; if (f.y < 60) f.y = 60; if (f.y > GY - 6) f.y = GY - 6;
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t / 400 + f.p));
        glow(f.x, f.y, 7, '220,255,110', a * 0.9); c.fillStyle = 'rgba(255,255,200,' + a + ')'; c.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
      });
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#5fbf4a';
      leaves.forEach(l => { l.y += l.v; l.x += Math.sin(t / 700 + l.p) * 0.4; if (l.y > H) { l.y = -4; l.x = rnd() * W; } c.fillRect(Math.round(l.x), Math.round(l.y), 2, 2); });
    }
    raf = requestAnimationFrame(frame);
  }
  return {
    start() { if (raf) return; canvas = $('menuBg'); canvas.width = W; canvas.height = H; c = canvas.getContext('2d'); setup(); raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
})();

// ---------- tema warna per dunia (level 1-4 hutan, 5-7 kuil lumut, 8-10 inti kuil) ----------
const WORLDS = [
  { name: 'Hutan Luar', wall: '#4c6b4a', hi: '#7fb25f', dark: '#2a3f2b', bg0: '#06140b', bg1: '#17482b', ray: '#d8ffb0', rune: false, fly: '220,255,110', mist: '150,230,170' },
  { name: 'Kuil Lumut', wall: '#3d5c5a', hi: '#74b0a6', dark: '#1d3636', bg0: '#051419', bg1: '#0f3f44', ray: '#9ff4ff', rune: true, fly: '150,255,240', mist: '130,220,230' },
  { name: 'Inti Kuil', wall: '#5c5436', hi: '#b5a45a', dark: '#2e2a18', bg0: '#120e05', bg1: '#41310f', ray: '#ffe39a', rune: true, fly: '255,220,120', mist: '230,200,130' },
];
const worldOf = idx => WORLDS[idx < 4 ? 0 : idx < 7 ? 1 : 2];

const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
};
const makeLayer = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Lapisan latar jauh: batang pohon raksasa + kabut (lebih lebar agar bisa bergeser untuk parallax)
function buildFarLayer(theme, idx) {
  const c = makeLayer(1040, 560), b = c.getContext('2d');
  const gr = b.createLinearGradient(0, 0, 0, 560); gr.addColorStop(0, theme.bg0); gr.addColorStop(1, theme.bg1);
  b.fillStyle = gr; b.fillRect(0, 0, 1040, 560);
  for (let i = 0; i < 9; i++) {                                              // pohon jauh
    const x = i * 120 + hash(i, 1, idx) * 50, w = 40 + hash(i, 2, idx) * 40;
    b.fillStyle = 'rgba(0,0,0,0.28)'; b.fillRect(x, 0, w, 560);
    b.fillStyle = 'rgba(255,255,255,0.03)'; b.fillRect(x, 0, 6, 560);
    for (let k = 0; k < 6; k++) { b.fillStyle = 'rgba(0,0,0,0.22)'; b.fillRect(x - 40 + k * 18, 20 + hash(i, k, idx) * 120, 60 + hash(k, i, idx) * 50, 26); }
  }
  const mist = b.createLinearGradient(0, 300, 0, 560); mist.addColorStop(0, 'rgba(' + theme.mist + ',0)'); mist.addColorStop(1, 'rgba(' + theme.mist + ',0.18)');
  b.fillStyle = mist; b.fillRect(0, 300, 1040, 260);
  return c;
}
// Lapisan tengah: pilar kuil, lengkungan, tanaman merambat, ukiran rune
function buildMidLayer(theme, idx) {
  const c = makeLayer(1040, 560), b = c.getContext('2d');
  for (let x = 100; x < 1040; x += 220) {
    b.fillStyle = 'rgba(0,0,0,0.34)'; b.fillRect(x - 18, 0, 36, 560);
    b.fillStyle = 'rgba(255,255,255,0.06)'; b.fillRect(x - 18, 0, 5, 560);
    b.fillStyle = 'rgba(0,0,0,0.42)'; b.fillRect(x - 28, 64, 56, 16); b.fillRect(x - 28, 430, 56, 16);
    for (let s = 0; s < 8; s++) { b.fillStyle = 'rgba(0,0,0,0.25)'; b.fillRect(x - 110 + s * 6, 80 + s * 4, 220 - s * 12, 4); }   // lengkungan
    if (theme.rune) { b.fillStyle = 'rgba(' + theme.fly + ',0.5)'; b.fillRect(x - 3, 150, 6, 22); b.fillRect(x - 9, 156, 18, 4); b.fillRect(x - 3, 250, 6, 6); }
    for (let k = 0; k < 7; k++) { b.fillStyle = 'rgba(40,120,50,0.5)'; b.fillRect(x - 18 + (k % 2) * 30, 80 + k * 22, 5, 14 + hash(k, x, idx) * 18); }
  }
  return c;
}
// Lapisan batu: semua petak '#' dengan lumut, retakan, dan sulur
function buildStone(L, theme, idx) {
  const c = makeLayer(960, 560), s = c.getContext('2d');
  const open = (x, y) => { const row = L.grid[y]; return !!row && row[x] !== undefined && row[x] !== '#'; };
  for (let y = 0; y < 14; y++) for (let x = 0; x < 24; x++) {
    if (L.grid[y][x] !== '#') continue;
    const X = x * 40, Y = y * 40;
    s.fillStyle = theme.wall; s.fillRect(X, Y, 40, 40);
    for (let r = 0; r < 2; r++) {
      const off = (r + y) % 2 ? 10 : 0;
      for (let bx = -off; bx < 40; bx += 20) {
        s.fillStyle = 'rgba(255,255,255,' + (hash(x * 3 + bx, y * 2 + r, 5 + idx) * 0.1) + ')'; s.fillRect(X + Math.max(bx, 0) + 2, Y + r * 20 + 2, 16, 16);
        s.fillStyle = theme.dark; if (bx >= 0) s.fillRect(X + bx, Y + r * 20, 2, 20);
      }
      s.fillStyle = theme.dark; s.fillRect(X, Y + r * 20, 40, 2);
    }
    if (hash(x, y, 8 + idx) > 0.84) { s.fillStyle = theme.dark; s.fillRect(X + 12, Y + 8, 2, 8); s.fillRect(X + 14, Y + 14, 2, 8); s.fillRect(X + 16, Y + 20, 2, 6); }
    if (theme.rune && hash(x, y, 3 + idx) > 0.93 && !open(x, y - 1)) { s.fillStyle = 'rgba(' + theme.fly + ',0.55)'; s.fillRect(X + 17, Y + 10, 6, 6); s.fillRect(X + 19, Y + 8, 2, 14); }
    if (open(x, y - 1)) {                                                    // permukaan atas: lumut dan rumput
      s.fillStyle = theme.hi; s.fillRect(X, Y, 40, 5);
      s.fillStyle = '#4fa844'; for (let i = 0; i < 40; i += 4) s.fillRect(X + i, Y - 2, 4, 3 + Math.floor(hash(x * 10 + i, y, 4 + idx) * 4));
      s.fillStyle = '#7ddc5a'; for (let i = 0; i < 40; i += 8) s.fillRect(X + i + 1, Y - 3, 2, 2);
    }
    if (open(x, y + 1)) {                                                    // sulur menggantung
      s.fillStyle = 'rgba(0,0,0,0.35)'; s.fillRect(X, Y + 34, 40, 6);
      for (let i = 0; i < 3; i++) if (hash(x * 5 + i, y, 6 + idx) > 0.5) {
        const vx = X + 4 + i * 14, len = 8 + Math.floor(hash(x, y * 5 + i, 7 + idx) * 22);
        s.fillStyle = '#2f7d3a'; s.fillRect(vx, Y + 40, 3, len); s.fillStyle = '#5fcf4a'; s.fillRect(vx - 3, Y + 40 + len - 4, 5, 4); s.fillRect(vx + 2, Y + 40 + len - 8, 5, 4);
      }
    }
    if (open(x - 1, y)) { s.fillStyle = 'rgba(255,255,255,0.12)'; s.fillRect(X, Y, 3, 40); }
    if (open(x + 1, y)) { s.fillStyle = 'rgba(0,0,0,0.3)'; s.fillRect(X + 36, Y, 4, 40); }
  }
  return c;
}
function buildVignette() {
  const c = makeLayer(960, 560), v = c.getContext('2d');
  const gr = v.createRadialGradient(480, 280, 190, 480, 280, 600);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.62)');
  v.fillStyle = gr; v.fillRect(0, 0, 960, 560);
  return c;
}

