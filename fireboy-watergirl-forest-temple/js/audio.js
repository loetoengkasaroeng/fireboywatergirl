'use strict';
/* ============================================================
   AUDIO: musik tema (menu & game) + efek suara, semuanya dibuat
   dengan WebAudio (tanpa file). Volume musik/efek diatur di Pengaturan.
   ============================================================ */
const Sound = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let wanted = null, running = null, timer = null, nextTime = 0, step = 0;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function applyVolumes() {
    if (!ctx) return;
    musicBus.gain.value = settings.muted ? 0 : settings.music;
    sfxBus.gain.value = settings.muted ? 0 : settings.sfx;
  }
  function unlock() {                       // browser baru mengizinkan suara setelah sentuhan/klik pertama
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain(); master.gain.value = 0.9;
      musicBus = ctx.createGain(); sfxBus = ctx.createGain();
      musicBus.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolumes();
    }
    if (ctx.state === 'suspended') ctx.resume();
    apply();
  }

  function voice(bus, t, freq, dur, type, vol, slide) {
    const osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp); amp.connect(bus);
    osc.start(t); osc.stop(t + dur + 0.03);
  }
  function hiss(bus, t, dur, vol, rate) {
    const src = ctx.createBufferSource(), amp = ctx.createGain();
    src.buffer = noiseBuf; src.playbackRate.value = rate || 1;
    amp.gain.setValueAtTime(vol, t); amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(amp); amp.connect(bus); src.start(t, Math.random() * 0.5, dur + 0.02);
  }
  const kick = t => voice(musicBus, t, 140, 0.16, 'sine', 0.55, -100);
  const soft = t => hiss(musicBus, t, 0.05, 0.08, 3);

  // ----- efek suara -----
  const now = () => ctx.currentTime;
  const SFX = {
    click: () => voice(sfxBus, now(), 660, 0.07, 'square', 0.12, 240),
    jump: () => voice(sfxBus, now(), 320, 0.17, 'square', 0.12, 420),
    land: () => hiss(sfxBus, now(), 0.07, 0.2, 0.8),
    stack: () => { voice(sfxBus, now(), 120, 0.12, 'sine', 0.4, -40); hiss(sfxBus, now(), 0.05, 0.12, 1.4); },
    gem: () => { voice(sfxBus, now(), 988, 0.08, 'square', 0.12); voice(sfxBus, now() + 0.07, 1480, 0.2, 'square', 0.12); },
    plate: () => { voice(sfxBus, now(), 170, 0.12, 'square', 0.18); hiss(sfxBus, now(), 0.04, 0.1, 1.2); },
    lever: () => { voice(sfxBus, now(), 240, 0.08, 'square', 0.16, -100); voice(sfxBus, now() + 0.07, 360, 0.1, 'square', 0.14, 100); },
    gate: () => { voice(sfxBus, now(), 90, 0.5, 'triangle', 0.35, 70); hiss(sfxBus, now(), 0.4, 0.14, 0.5); },
    die: () => { voice(sfxBus, now(), 440, 0.6, 'sawtooth', 0.2, -380); hiss(sfxBus, now(), 0.35, 0.25, 0.7); },
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => voice(sfxBus, now() + i * 0.11, f, 0.24, 'square', 0.14)),
    pause: () => voice(sfxBus, now(), 440, 0.12, 'triangle', 0.2, -160),
  };

  // ----- musik tema: 4 birama x 8 langkah (nada seperdelapan). 0 = diam -----
  const THEMES = {
    menu: {                                  // misterius dan tenang (A minor), seperti suling di tengah hutan
      bpm: 84, roots: [45, 41, 43, 40], chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
      lead: [76, 0, 0, 72, 0, 74, 76, 0,   77, 0, 0, 74, 0, 72, 69, 0,   71, 0, 74, 0, 79, 0, 76, 0,   76, 0, 74, 0, 71, 0, 0, 0],
      bass: [0, null, null, null, 7, null, null, null], leadType: 'triangle', drums: 'none',
    },
    game: {                                  // berdebar dan penuh petualangan (D minor)
      bpm: 118, roots: [38, 34, 36, 33], chords: [[62, 65, 69], [58, 62, 65], [60, 64, 67], [57, 60, 64]],
      lead: [74, 0, 77, 74, 0, 72, 74, 0,   70, 0, 74, 70, 0, 69, 70, 0,   72, 0, 76, 72, 0, 71, 72, 0,   69, 0, 72, 76, 0, 72, 69, 0],
      bass: [0, null, 0, null, 12, null, 0, null], leadType: 'square', drums: 'drive',
    },
  };
  function playStep(th, n, t) {
    const dur = 60 / th.bpm / 2, bar = Math.floor(n / 8) % 4, s = n % 8;
    if (th.lead[n]) voice(musicBus, t, midi(th.lead[n]), dur * 1.9, th.leadType, th.leadType === 'square' ? 0.07 : 0.2);
    voice(musicBus, t, midi(th.chords[bar][s % 3] + 12), dur * 0.95, 'sine', 0.08);
    if (th.bass[s] !== null) voice(musicBus, t, midi(th.roots[bar] + th.bass[s]), dur * 2.2, 'triangle', 0.26);
    if (th.drums === 'drive') { if (s % 4 === 0) kick(t); if (s % 2) soft(t); if (s === 6) hiss(musicBus, t, 0.1, 0.12, 1); }
    else if (s === 0) soft(t);
  }
  function schedule() {
    const th = THEMES[running];
    while (nextTime < ctx.currentTime + 0.3) {
      playStep(th, step, nextTime);
      nextTime += 60 / th.bpm / 2;
      step = (step + 1) % th.lead.length;
    }
  }
  function apply() {                         // samakan lagu yang berjalan dengan lagu yang diminta
    if (!ctx) return;
    if (wanted === running) return;
    clearInterval(timer); timer = null; running = wanted;
    if (wanted) { step = 0; nextTime = ctx.currentTime + 0.1; schedule(); timer = setInterval(schedule, 40); }
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });

  return {
    unlock, applyVolumes,
    theme: name => { wanted = name; apply(); },
    play: name => { if (ctx && !settings.muted && SFX[name]) SFX[name](); },
  };
})();

