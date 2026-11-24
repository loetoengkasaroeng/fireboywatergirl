'use strict';
/* Fireboy & Watergirl: Forest Temple - script.js (HTML + CSS + JavaScript murni, tanpa library) */

/*ENGINE-BEGIN*/
/* ============================================================
   MESIN GIM (fisika, tumbukan, tombol, tuas, gerbang, elevator,
   tumpuk karakter, bahaya). Tanpa DOM: bisa diuji di Node.
   ============================================================ */
const Engine = (() => {
  const TS = 40, COLS = 24, ROWS = 14, EPS = 0.01;
  // Lompat setinggi ±2,8 petak (tangga 2 petak mudah, dinding 3 petak butuh tumpukan), sejauh ±3,2 petak.
  const PHYS = { speed: 3.2, jump: -11.1, gravity: 0.55, maxFall: 13, w: 24, h: 30, coyote: 6, buffer: 6, lift: 1.6 };
  const KILLS = { f: 'WG', w: 'LG' };                       // Fireboy mati kena air/racun, Watergirl kena lava/racun
  const NAMES = { L: 'lava', W: 'air', G: 'racun hijau' };

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function parseLevel(def) {
    if (def.map.length !== ROWS) throw new Error(def.name + ': harus ' + ROWS + ' baris');
    const L = { name: def.name, hint: def.hint, par: def.par, grid: [], gems: [], doors: {}, starts: {}, plates: [], gates: [], levers: [], movers: [] };
    def.map.forEach((row, y) => {
      if (row.length !== COLS) throw new Error(def.name + ': baris ' + y + ' harus ' + COLS + ' karakter');
      const cells = [];
      [...row].forEach((ch, x) => {
        let c = ch;
        if (ch === 'x' || ch === 'y') { L.gems.push({ kind: ch === 'x' ? 'f' : 'w', x, y, got: false }); c = '.'; }
        else if (ch === 'f' || ch === 'w') { L.doors[ch] = { x, y }; c = '.'; }
        else if (ch === '1' || ch === '2') { L.starts[ch === '1' ? 'f' : 'w'] = { x, y }; c = '.'; }
        else if (!'#.LWG'.includes(ch)) throw new Error('karakter tidak dikenal ' + ch);
        cells.push(c);
      });
      L.grid.push(cells);
    });
    for (const e of def.ents || []) {
      if (e.t === 'plate') L.plates.push({ x: e.x, y: e.y, ch: e.ch });
      else if (e.t === 'gate') L.gates.push({ x: e.x, y: e.y, h: e.h, ch: e.ch });
      else if (e.t === 'lever') L.levers.push({ x: e.x, y: e.y, ch: e.ch });
      else if (e.t === 'mover') L.movers.push({ x: e.x, y: e.y, w: e.w, dx: e.dx, dy: e.dy, ch: e.ch });
      else throw new Error('entitas tidak dikenal ' + e.t);
    }
    return L;
  }

  function place(p, tx, ty) {
    p.x = tx * TS + (TS - p.w) / 2; p.y = (ty + 1) * TS - p.h;
    p.vx = 0; p.vy = 0; p.grounded = true; p.ground = 'tile'; p.coyote = 0; p.buffer = 0;
  }

  function createState(L) {
    const players = ['f', 'w'].map(id => {
      const p = { id, w: PHYS.w, h: PHYS.h, dir: id === 'f' ? 1 : -1, walk: 0, moving: false, upPrev: false, dx: 0, dy: 0, ghost: false };
      place(p, L.starts[id].x, L.starts[id].y);
      return p;
    });
    return {
      L, grid: L.grid, doors: L.doors, players,
      gems: L.gems.map(g => ({ ...g })),
      plates: L.plates.map(e => ({ ...e, on: false })),
      gates: L.gates.map(e => ({ ...e })),
      levers: L.levers.map(e => ({ ...e, on: false, touch: { f: false, w: false } })),
      movers: L.movers.map(e => ({ ...e, x0: e.x * TS, y0: e.y * TS, x: e.x * TS, y: e.y * TS, vx: 0, vy: 0 })),
      act: {}, solids: [], frame: 0, status: 'play', cause: '', events: [],
    };
  }

  const solidTile = (g, x, y) => x < 0 || y < 0 || x >= COLS || y >= ROWS || g.grid[y][x] === '#';

  function computeAct(g) {
    const act = {};
    for (const e of g.plates) if (e.on) act[e.ch] = true;
    for (const e of g.levers) if (e.on) act[e.ch] = true;
    g.act = act;
  }

  function updateMovers(g) {
    for (const m of g.movers) {
      const on = !!g.act[m.ch];
      const tx = m.x0 + (on ? m.dx * TS : 0), ty = m.y0 + (on ? m.dy * TS : 0);
      m.vx = Math.sign(tx - m.x) * Math.min(PHYS.lift, Math.abs(tx - m.x));
      m.vy = Math.sign(ty - m.y) * Math.min(PHYS.lift, Math.abs(ty - m.y));
      m.x += m.vx; m.y += m.vy;
      if (m.vx || m.vy) {                                    // dorong pemain yang bukan penumpang
        const r = { x: m.x, y: m.y, w: m.w * TS, h: 12 };
        for (const p of g.players) {
          if (p.ghost || p.ground === m || !overlap(p, r)) continue;
          if (m.vy < 0) p.y = m.y - p.h; else if (m.vy > 0) p.y = m.y + 12;
          if (m.vx > 0) p.x = m.x + r.w; else if (m.vx < 0) p.x = m.x - p.w;
        }
      }
    }
  }

  function buildSolids(g) {
    g.solids = g.movers.map(m => ({ x: m.x, y: m.y, w: m.w * TS, h: 12, mover: m }));
    for (const e of g.gates) {
      e.open = !!g.act[e.ch];
      if (e.open) continue;
      const r = { x: e.x * TS, y: e.y * TS, w: TS, h: e.h * TS };
      if (g.players.some(p => !p.ghost && overlap(p, r))) continue;      // jangan menjepit pemain
      g.solids.push(r);
    }
  }

  function colliders(g, p) {
    const out = [];
    for (let y = Math.floor(p.y / TS); y <= Math.floor((p.y + p.h - EPS) / TS); y++)
      for (let x = Math.floor(p.x / TS); x <= Math.floor((p.x + p.w - EPS) / TS); x++)
        if (solidTile(g, x, y)) out.push({ x: x * TS, y: y * TS, w: TS, h: TS });
    for (const r of g.solids) if (overlap(p, r)) out.push(r);
    return out;
  }

  function movePlayer(g, p, input) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.vx = dir * PHYS.speed; p.moving = dir !== 0;
    if (dir) p.dir = dir;
    if (input.up && !p.upPrev) p.buffer = PHYS.buffer;
    p.upPrev = !!input.up;
    if (p.buffer > 0) p.buffer--;
    p.coyote = p.grounded ? PHYS.coyote : Math.max(0, p.coyote - 1);
    if ((input.up || p.buffer > 0) && p.coyote > 0) {
      p.vy = PHYS.jump; p.coyote = 0; p.buffer = 0; p.grounded = false; p.ground = null;
      g.events.push({ type: 'jump', id: p.id });
    }
    p.vy = Math.min(p.vy + PHYS.gravity, PHYS.maxFall);

    p.x += p.vx;                                                    // sumbu X
    if (p.vx) {
      const cs = colliders(g, p);
      if (cs.length) p.x = p.vx > 0 ? Math.min(...cs.map(r => r.x)) - p.w : Math.max(...cs.map(r => r.x + r.w));
    }

    const wasGrounded = p.grounded, impact = p.vy;                 // sumbu Y
    p.y += p.vy; p.grounded = false; p.ground = null;
    const cs = colliders(g, p);
    if (cs.length && p.vy !== 0) {
      if (p.vy > 0) {
        const top = Math.min(...cs.map(r => r.y));
        p.y = top - p.h; p.grounded = true;
        const base = cs.find(r => r.y === top);
        p.ground = base.mover || 'tile';
        if (!wasGrounded && impact > 4) g.events.push({ type: 'land', id: p.id });
      } else p.y = Math.max(...cs.map(r => r.y + r.h));
      p.vy = 0;
    }
    if (!p.grounded && impact >= 0) {                              // mendarat di kepala pemain lain (tumpuk)
      for (const o of g.players) {
        if (o === p || o.ghost) continue;
        const ox = Math.min(p.x + p.w, o.x + o.w) - Math.max(p.x, o.x);
        const bottom = p.y + p.h;
        if (ox > 4 && bottom >= o.y && bottom - impact <= o.y + 5 && bottom <= o.y + 14) {
          p.y = o.y - p.h; p.grounded = true; p.ground = o; p.vy = 0;
          if (!wasGrounded && impact > 4) g.events.push({ type: 'land', id: p.id });
        }
      }
    }
    p.walk = (p.moving && p.grounded) ? p.walk + 1 : 0;
  }

  function carry(p) {
    const b = p.ground;
    if (!b || b === 'tile') return;
    if (b.mover) { p.x += b.mover.vx; p.y += b.mover.vy; }
    else { p.x += b.dx; p.y = b.y - p.h; }
  }

  function updateSwitches(g) {
    for (const e of g.plates) {
      const rect = { x: e.x * TS + 4, y: e.y * TS, w: TS - 8, h: TS };
      const on = g.players.some(p => !p.ghost && p.grounded && overlap({ x: p.x, y: p.y + p.h - 4, w: p.w, h: 4 }, rect));
      if (on !== e.on) g.events.push({ type: on ? 'plate-on' : 'plate-off', ch: e.ch });
      e.on = on;
    }
    for (const e of g.levers) {
      const rect = { x: e.x * TS + 10, y: e.y * TS + 6, w: 20, h: 34 };
      for (const p of g.players) {
        const t = !p.ghost && overlap(p, rect);
        if (t && !e.touch[p.id]) { e.on = !e.on; g.events.push({ type: 'lever', ch: e.ch, on: e.on }); }
        e.touch[p.id] = t;
      }
    }
  }

  function checkHazards(g) {
    for (const p of g.players) {
      if (p.ghost) continue;
      for (let y = Math.floor(p.y / TS); y <= Math.floor((p.y + p.h - EPS) / TS); y++)
        for (let x = Math.floor(p.x / TS); x <= Math.floor((p.x + p.w - EPS) / TS); x++) {
          const c = (g.grid[y] || [])[x];
          if (g.status !== 'play' || !c || !KILLS[p.id].includes(c)) continue;
          if (overlap(p, { x: x * TS + 6, y: y * TS + 14, w: TS - 12, h: TS - 14 })) {
            g.status = 'lose';
            g.cause = (p.id === 'f' ? 'Fireboy' : 'Watergirl') + ' terkena ' + NAMES[c] + '.';
            g.events.push({ type: 'die', id: p.id, c });
          }
        }
    }
  }
  function collectGems(g) {
    for (const p of g.players) {
      if (p.ghost) continue;
      for (const gem of g.gems)
        if (!gem.got && gem.kind === p.id && overlap(p, { x: gem.x * TS + 8, y: gem.y * TS + 8, w: 24, h: 24 })) {
          gem.got = true; g.events.push({ type: 'gem', id: p.id, x: gem.x * TS + 20, y: gem.y * TS + 20 });
        }
    }
  }
  function checkDoors(g) {
    const inside = p => overlap(p, { x: g.doors[p.id].x * TS + 6, y: g.doors[p.id].y * TS, w: TS - 12, h: TS });
    if (g.players.filter(p => !p.ghost).every(inside)) { g.status = 'win'; g.events.push({ type: 'win' }); }
  }

  function tick(g, inputs) {
    if (g.status !== 'play') return;
    g.events = []; g.frame++;
    computeAct(g);
    updateMovers(g);
    buildSolids(g);
    const order = g.players.slice();
    if (order[0].ground === order[1]) order.reverse();              // penopang diproses lebih dulu
    for (const p of order) {
      const x0 = p.x, y0 = p.y;
      carry(p);
      movePlayer(g, p, inputs[p.id] || {});
      p.dx = p.x - x0; p.dy = p.y - y0;
    }
    updateSwitches(g);
    checkHazards(g);
    if (g.status === 'play') { collectGems(g); checkDoors(g); }
  }

  // Untuk pembuktian: tempatkan elevator/slab langsung di posisi akhir sesuai tombol & tuas yang aktif
  function settle(g) {
    for (const e of g.levers) {
      const rect = { x: e.x * TS + 10, y: e.y * TS + 6, w: 20, h: 34 };
      for (const p of g.players) e.touch[p.id] = !p.ghost && overlap(p, rect);
    }
    updateSwitches(g); computeAct(g);
    for (const m of g.movers) {
      const on = !!g.act[m.ch];
      m.x = m.x0 + (on ? m.dx * TS : 0); m.y = m.y0 + (on ? m.dy * TS : 0); m.vx = m.vy = 0;
    }
    buildSolids(g);
  }

  return { TS, COLS, ROWS, PHYS, KILLS, parseLevel, createState, place, tick, settle, overlap };
})();
/*ENGINE-END*/

