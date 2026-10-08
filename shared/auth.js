/* Mat Sains: device-local accounts, session and login guard.
 *
 * window.MS.auth
 *   current()               -> session {accountId, email, provider, name, kelas, avatar, createdAt} or null
 *   profile()               -> device profile {name, kelas, avatar} or null
 *   requireLogin()          -> redirects to welcome.html when there is no session (runs automatically)
 *   logout()                -> clears the session only (profile and game progress stay) and opens welcome.html
 *   avatarSvg(id, size, o)  -> SVG string; o.full = whole body instead of a head crop
 *   mountProfileChip(el)    -> compact avatar + name + "Keluar" chip
 *
 * The automatic guard is skipped on <body data-auth="public">, on welcome.html itself,
 * when the URL contains "?autotest", and when navigator.webdriver is true.
 *
 * DEVELOPMENT ONLY: there is no server yet. Registered accounts live in this device's
 * localStorage (password stored as a salted SHA-256 hash), and Google ID tokens are only
 * decoded client side. Production must verify Google ID tokens and passwords on a server.
 * Safe to include on any page: never throws, works from file:// and https.
 */
(function () {
  'use strict';
  var MS = (window.MS = window.MS || {});
  if (MS.auth && MS.auth._loaded) return;

  var K = { session: 'matsains.session.v1', profile: 'matsains.profile.v1', accounts: 'matsains.accounts.v1' };
  var DEV = { email: 'test@matsains.id', password: 'test', id: 'dev-test' };

  /* ---------------- storage (localStorage with in-memory fallback) ---------------- */
  var mem = {};
  function get(k) {
    try { var v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) { /* blocked or corrupt */ }
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
  }
  function set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  /* ---------------- avatars and grades ---------------- */
  var AVATARS = [
    { id: 'p0', label: 'Budi', person: 0 },
    { id: 'p1', label: 'Siti', person: 1 },
    { id: 'p3', label: 'Ani', person: 3 },
    { id: 'p7', label: 'Raka', person: 7 },
    { id: 'kucing', label: 'Kucing', item: 'kucing' },
    { id: 'katak', label: 'Katak', item: 'katak' }
  ];
  var KELAS = [
    { id: 'TK', big: 'TK', small: 'Belum SD' },
    { id: '1', big: '1', small: 'Kelas' },
    { id: '2', big: '2', small: 'Kelas' },
    { id: '3', big: '3', small: 'Kelas' },
    { id: '4+', big: '4+', small: 'Kelas' }
  ];
  function findAvatar(id) { for (var i = 0; i < AVATARS.length; i++) if (AVATARS[i].id === id) return AVATARS[i]; return AVATARS[0]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function avatarSvg(id, size, opts) {
    size = size || 64; opts = opts || {};
    var a = findAvatar(id), art = window.GS && window.GS.art, inner = '', vb = '';
    try {
      if (a.person != null && art && art.person) {
        inner = art.person(a.person, { shadow: !!opts.full });
        vb = opts.full ? '-40 -106 80 110' : '-29 -103 58 58';
      } else if (a.item && art && art.item) {
        inner = art.item(a.item, { shadow: !!opts.full });
        vb = opts.full ? '-50 -95 100 100' : '-40 -78 80 80';
      }
    } catch (e) { inner = ''; }
    if (!inner) {
      vb = '0 0 64 64';
      inner = '<circle cx="32" cy="32" r="29" fill="#FFC83D" stroke="#3B2A20" stroke-width="3"/>' +
        '<text x="32" y="43" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="30" fill="#2B1D14">' + esc(a.label.charAt(0)) + '</text>';
    }
    return '<svg class="ms-avatar" viewBox="' + vb + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(a.label) + '" style="overflow:visible">' + inner + '</svg>';
  }

  /* ---------------- session and profile ---------------- */
  function current() { var s = get(K.session); return s && s.accountId ? s : null; }
  function profile() { var p = get(K.profile); return p && p.name ? { name: p.name, kelas: p.kelas || '', avatar: p.avatar || AVATARS[0].id } : null; }
  function cleanName(n) { n = String(n == null ? '' : n).replace(/\s+/g, ' ').trim().slice(0, 12); return n; }
  function saveProfile(p) {
    var cur = profile() || {};
    var next = { name: cleanName(p.name != null ? p.name : cur.name) || 'Teman', kelas: p.kelas != null ? p.kelas : (cur.kelas || ''), avatar: p.avatar || cur.avatar || AVATARS[0].id };
    set(K.profile, next);
    return next;
  }
  function clearProfile() { del(K.profile); }
  function startSession(acc, provider) {
    var p = profile() || { name: acc.name || 'Teman', kelas: '', avatar: AVATARS[0].id };
    var s = { accountId: acc.id, email: acc.email || '', provider: provider, name: p.name, kelas: p.kelas, avatar: p.avatar, createdAt: new Date().toISOString() };
    if (acc.picture) s.picture = acc.picture;
    set(K.session, s);
    return s;
  }

  /* ---------------- passwords (salted SHA-256 when crypto.subtle exists) ---------------- */
  function hex(buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
  function weakHash(str) { // FNV-1a fallback for insecure contexts (plain http on a LAN IP)
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) { h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619); h2 = Math.imul(h2 ^ str.charCodeAt(i), 2246822519); }
    return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }
  function hashPw(pw, salt, alg) {
    var data = 'matsains|' + salt + '|' + pw;
    var canSubtle = !!(window.crypto && window.crypto.subtle && window.TextEncoder);
    if (alg !== 'fnv' && canSubtle) {
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
        .then(function (b) { return 'sha256:' + hex(b); })
        .catch(function () { return 'fnv:' + weakHash(data); });
    }
    return Promise.resolve('fnv:' + weakHash(data));
  }
  function randomId(n) {
    var s = '';
    try { var a = new Uint8Array(n); window.crypto.getRandomValues(a); for (var i = 0; i < n; i++) s += (a[i] % 36).toString(36); }
    catch (e) { while (s.length < n) s += Math.random().toString(36).slice(2); s = s.slice(0, n); }
    return s;
  }

  /* ---------------- accounts ---------------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function fail(field, msg) { return { ok: false, field: field, msg: msg }; }
  function accounts() { var a = get(K.accounts); return a && typeof a === 'object' ? a : {}; }
  function normEmail(e) { return String(e == null ? '' : e).trim().toLowerCase(); }

  function validateEmail(email) {
    if (!email) return fail('email', 'Tulis email dulu ya.');
    if (!EMAIL_RE.test(email)) return fail('email', 'Emailnya belum lengkap. Contoh: nama@contoh.com');
    return null;
  }

  function loginEmail(emailIn, pw) {
    var email = normEmail(emailIn);
    pw = String(pw == null ? '' : pw);
    var bad = validateEmail(email);
    if (bad) return Promise.resolve(bad);
    if (!pw) return Promise.resolve(fail('password', 'Tulis kata sandi dulu ya.'));
    if (email === DEV.email) {
      if (pw.trim() === DEV.password) return Promise.resolve({ ok: true, session: startSession({ id: DEV.id, email: DEV.email }, 'dev') });
      return Promise.resolve(fail('password', 'Kata sandinya belum cocok. Coba lagi ya.'));
    }
    var acc = accounts()[email];
    if (!acc) return Promise.resolve(fail('email', 'Email ini belum terdaftar di perangkat ini. Pilih "Daftar" dulu ya.'));
    return hashPw(pw, acc.salt, String(acc.hash).split(':')[0]).then(function (h) {
      if (h !== acc.hash) return fail('password', 'Kata sandinya belum cocok. Coba lagi ya.');
      return { ok: true, session: startSession(acc, 'local') };
    });
  }

  function register(nameIn, emailIn, pw) {
    var name = cleanName(nameIn), email = normEmail(emailIn);
    pw = String(pw == null ? '' : pw);
    if (!name) return Promise.resolve(fail('name', 'Tulis nama panggilan dulu ya.'));
    var bad = validateEmail(email);
    if (bad) return Promise.resolve(bad);
    if (pw.length < 4) return Promise.resolve(fail('password', 'Kata sandi minimal 4 huruf atau angka.'));
    if (email === DEV.email || accounts()[email]) return Promise.resolve(fail('email', 'Email ini sudah terdaftar. Pilih "Masuk" saja ya.'));
    var salt = randomId(16);
    return hashPw(pw, salt).then(function (h) {
      var all = accounts();
      var acc = { id: 'local-' + randomId(12), email: email, name: name, salt: salt, hash: h, createdAt: new Date().toISOString() };
      all[email] = acc;
      set(K.accounts, all);
      saveProfile({ name: name });
      return { ok: true, session: startSession(acc, 'local') };
    });
  }

  /* Google ID token (JWT): decode the payload only. DEVELOPMENT ONLY: production must send the
     credential to a server and verify its signature, audience and expiry there. */
  function decodeJwt(token) {
    try {
      var part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (part.length % 4) part += '=';
      var bin = atob(part), bytes = '';
      for (var i = 0; i < bin.length; i++) bytes += '%' + ('0' + bin.charCodeAt(i).toString(16)).slice(-2);
      return JSON.parse(decodeURIComponent(bytes));
    } catch (e) { return null; }
  }
  function loginGoogle(credential) {
    var p = decodeJwt(credential);
    if (!p || !p.sub) return fail('google', 'Masuk dengan Google belum berhasil. Coba lagi ya.');
    return { ok: true, session: startSession({ id: 'google-' + p.sub, email: p.email || '', name: p.given_name || p.name || '', picture: p.picture || '' }, 'google'), google: { name: p.name || '', email: p.email || '', picture: p.picture || '' } };
  }

  /* ---------------- navigation ---------------- */
  // Relative path from the current page back to the site root ('' for the hub, '../../' for /games/<id>/).
  function rootPrefix() {
    var p = '';
    try { p = location.pathname || ''; } catch (e) { return ''; }
    var i = p.lastIndexOf('/games/');
    if (i < 0) return '';
    var depth = p.slice(i + 1).split('/').length - 1; // 'games/katak/index.html' -> 2, 'games/katak' -> 1
    var s = ''; for (var d = 0; d < depth; d++) s += '../';
    return s;
  }
  function herePath() { // page path relative to the root, used to come back after login
    try { var p = location.pathname, i = p.lastIndexOf('/games/'); return i < 0 ? '' : p.slice(i + 1); } catch (e) { return ''; }
  }
  function welcomeUrl(withNext) {
    var u = rootPrefix() + 'welcome.html', h = herePath();
    return withNext && h ? u + '?next=' + encodeURIComponent(h) : u;
  }
  // Only same-site game pages are accepted as a return target.
  function safeNext(n) { n = String(n || ''); return /^games\/[\w-]+\/?(index\.html)?$/.test(n) ? n : 'index.html'; }

  function isWelcomePage() { try { return /welcome\.html$/i.test(location.pathname); } catch (e) { return false; } }
  function isPublic() { var b = document.body; return isWelcomePage() || !!(b && b.getAttribute('data-auth') === 'public'); }
  function isAutomated() {
    try { if (/[?&]autotest(\b|=|&|$)/.test(location.search)) return true; } catch (e) { /* ignore */ }
    try { return navigator.webdriver === true; } catch (e) { return false; }
  }
  function shouldRedirect() { return !isPublic() && !isAutomated() && !current(); }
  function go(url) { try { location.replace(url); } catch (e) { try { location.href = url; } catch (e2) { /* ignore */ } } }
  function requireLogin() {
    if (!shouldRedirect()) return false;
    go(welcomeUrl(true));
    return true;
  }
  function logout() {
    del(K.session);
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ }
    go(rootPrefix() + 'welcome.html');
  }

  /* ---------------- profile chip ---------------- */
  var CSS = [
    '.ms-chip{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-body,Andika,system-ui,sans-serif)}',
    '.ms-chip-id{display:inline-flex;align-items:center;gap:8px;height:56px;max-width:220px;padding:0 16px 0 4px;background:#fff;border:3px solid #3B2A20;border-radius:999px;box-shadow:0 4px 0 #3B2A20;color:#2B1D14}',
    '.ms-chip-av{flex:none;width:44px;height:44px;border-radius:50%;background:#E6F5F0;border:2px solid #3B2A20;display:grid;place-items:center;overflow:hidden}',
    '.ms-chip-av svg{width:44px;height:44px;display:block}',
    '.ms-chip-name{font-family:var(--font-display,"Baloo 2",system-ui,sans-serif);font-weight:800;font-size:20px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
    '.ms-chip-out{height:56px;min-width:56px;padding:0 16px;border:3px solid #3B2A20;border-radius:999px;background:#fff;color:#2B1D14;box-shadow:0 4px 0 #3B2A20;font-family:var(--font-display,"Baloo 2",system-ui,sans-serif);font-weight:800;font-size:18px;cursor:pointer;text-decoration:none;display:inline-grid;place-items:center;transition:transform 80ms ease-out,box-shadow 80ms ease-out}',
    '.ms-chip-out:active{transform:translateY(3px) scale(.95);box-shadow:0 1px 0 #3B2A20}',
    '.ms-chip-out.ask{background:#FFC83D}',
    '@media (max-width:560px){.ms-chip-name{display:none}.ms-chip-id{padding:0 4px}.ms-chip-out{padding:0 12px;font-size:16px}}'
  ].join('\n');
  function injectCss() {
    if (document.getElementById('ms-auth-css')) return;
    var st = document.createElement('style'); st.id = 'ms-auth-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  function mountProfileChip(container) {
    if (!container) return null;
    try {
      injectCss();
      var s = current(), wrap = document.createElement('div');
      wrap.className = 'ms-chip';
      if (!s) {
        wrap.innerHTML = '<a class="ms-chip-out" href="' + esc(welcomeUrl(true)) + '">Masuk</a>';
      } else {
        wrap.innerHTML = '<span class="ms-chip-id" title="' + esc(s.email || '') + '"><span class="ms-chip-av">' + avatarSvg(s.avatar, 44) + '</span>' +
          '<span class="ms-chip-name">' + esc(s.name) + '</span></span>' +
          '<button type="button" class="ms-chip-out" aria-label="Keluar dari akun ' + esc(s.name) + '">Keluar</button>';
        var btn = wrap.querySelector('button'), t = 0;
        // Two taps so a child does not log out by accident (no dialogs).
        btn.addEventListener('click', function () {
          if (btn.classList.contains('ask')) { clearTimeout(t); logout(); return; }
          btn.classList.add('ask'); btn.textContent = 'Yakin?';
          t = setTimeout(function () { btn.classList.remove('ask'); btn.textContent = 'Keluar'; }, 4000);
        });
      }
      container.appendChild(wrap);
      return wrap;
    } catch (e) { return null; }
  }

  MS.auth = {
    _loaded: true,
    current: current,
    profile: profile,
    requireLogin: requireLogin,
    logout: logout,
    avatarSvg: avatarSvg,
    mountProfileChip: mountProfileChip,
    // used by welcome.html and tests
    _: {
      AVATARS: AVATARS, KELAS: KELAS, DEV_EMAIL: DEV.email,
      saveProfile: saveProfile, clearProfile: clearProfile,
      loginEmail: loginEmail, register: register, loginGoogle: loginGoogle, decodeJwt: decodeJwt,
      welcomeUrl: welcomeUrl, rootPrefix: rootPrefix, safeNext: safeNext,
      shouldRedirect: shouldRedirect, isAutomated: isAutomated, keys: K
    }
  };

  function autoGuard() { try { requireLogin(); } catch (e) { /* never break the page */ } }
  if (document.body) autoGuard();
  else document.addEventListener('DOMContentLoaded', autoGuard);
})();
