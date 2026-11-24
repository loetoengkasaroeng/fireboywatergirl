'use strict';
/* ============================================================
   INTI: penyimpanan (LocalStorage), akun, pengaturan, progres
   ============================================================ */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtTime = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');

const KEYS = { users: 'fwft_users', session: 'fwft_session', settings: 'fwft_settings', progress: 'fwft_progress' };
const DB = {
  get(k, d) { try { const r = localStorage.getItem(k); return r === null ? d : JSON.parse(r); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* penyimpanan penuh/diblokir */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } },
};
const DEFAULTS = { music: 0.55, sfx: 0.8, muted: false, particles: true, shake: true, touch: 'auto' };
const settings = Object.assign({}, DEFAULTS, DB.get(KEYS.settings, {}));
const saveSettings = () => DB.set(KEYS.settings, settings);

// Catatan: ini simulasi akun lokal untuk belajar, bukan sistem keamanan sungguhan.
const hashPw = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'h' + (h >>> 0).toString(36); };
const getUsers = () => DB.get(KEYS.users, []);
const getSession = () => DB.get(KEYS.session, null);
const getProgress = u => (DB.get(KEYS.progress, {})[u]) || { unlocked: 1, levels: {} };
function saveProgress(u, p) { const all = DB.get(KEYS.progress, {}); all[u] = p; DB.set(KEYS.progress, all); }

function registerUser(name, pw, pw2) {
  name = name.trim();
  if (!name || !pw || !pw2) return { ok: false, msg: 'Semua data wajib diisi.' };
  if (name.length < 3) return { ok: false, msg: 'Username minimal 3 karakter.' };
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) return { ok: false, msg: 'Username hanya boleh huruf, angka, titik, minus, dan garis bawah.' };
  if (pw.length < 4) return { ok: false, msg: 'Password minimal 4 karakter.' };
  if (pw !== pw2) return { ok: false, msg: 'Konfirmasi password tidak sama.' };
  const users = getUsers();
  if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) return { ok: false, msg: 'Username sudah digunakan.' };
  users.push({ name, pw: hashPw(pw) });
  DB.set(KEYS.users, users);
  return { ok: true, msg: 'Registrasi berhasil! Silakan masuk.' };
}
function loginUser(name, pw) {
  name = name.trim();
  if (!name || !pw) return { ok: false, msg: 'Username dan password wajib diisi.' };
  const u = getUsers().find(x => x.name.toLowerCase() === name.toLowerCase() && x.pw === hashPw(pw));
  if (!u) return { ok: false, msg: 'Username atau password salah.' };
  DB.set(KEYS.session, { name: u.name });
  return { ok: true, msg: 'Login berhasil!' };
}
const logoutUser = () => DB.del(KEYS.session);

function toast(text) {
  const t = $('toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('show'), 2200);
}

