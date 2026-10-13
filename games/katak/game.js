/* Lompat Katak (katak): Kodi the frog hops along a number line of stepping stones.
 * The child plans hop size, number of hops and direction, then presses Lompat!.
 * Math is intrinsic: where Kodi lands is exactly start ± size × count, nothing is
 * nudged; a miss shows the real gap ("kurang 2" / "lebih 3").
 * World camera: one <g> transform (pan + zoom). Positions zoom, while sprites
 * (frog, stones, labels) are counter-scaled so they stay readable when zoomed out. */
(function () {
  'use strict';
  const GAME = 'katak';
  const OUT = '#3B2A20';
  const SP = 100;             // world units per number on the line
  const ZMIN = 0.12;
  const TIER = GS.tier ? GS.tier() : 'k1';
  const LEVELS = (window.MS && MS.kur && MS.kur.levels) ? MS.kur.levels(TIER) : (TIER === 'tk' ? 6 : 8);
  let speed = 1;              // test hook can shorten animations
  const T = ms => ms * speed;
  const sleep = ms => GS.wait(T(ms));

  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const hud = GS.hud({ gameId: GAME, title: 'Lompat Katak', levelCount: LEVELS, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS, hud, start: i => buildLevel(i), demo: demoSpec });
  const art = GS.art || {};

  /* ---------------- layers ---------------- */
  const bgL = GS.el('g', { class: 'kt-bg' }, svg);
  const laneL = GS.el('g', { class: 'kt-lane' }, svg);
  const world = GS.el('g', { class: 'kt-world' }, svg);
  const uiL = GS.el('g', { class: 'kt-ui' }, svg);
  let arcsL, gapL, stonesL, labelsL, friendL, frogL, fxL;

  /* ---------------- planning panel (HTML) ---------------- */
  const plan = document.createElement('div');
  plan.className = 'kt-plan';
  plan.setAttribute('role', 'group');
  plan.setAttribute('aria-label', 'Rencana lompatan');
  const goBtn = document.createElement('button');
  goBtn.type = 'button';
  goBtn.className = 'gs-action';
  goBtn.innerHTML = '<svg class="kt-hop-ico" viewBox="0 0 40 34" aria-hidden="true"><path d="M5 28 Q12 4 20 28 Q27 8 35 28" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="1 6.5"/><circle cx="5" cy="29" r="3.6" fill="currentColor"/><circle cx="20" cy="29" r="3.6" fill="currentColor"/><circle cx="35" cy="29" r="3.6" fill="currentColor"/></svg><span>Lompat!</span>';
  goBtn.addEventListener('click', () => { if (!busy) leap(); });
  dock.append(plan, goBtn);

  /* ---------------- state ---------------- */
  let L = null, P = [], tries = 0, busy = false, token = 0;
  let cam = { cx: 0, z: 1 }, Y0 = 440;
  let camFns = [];
  let frog = null, friend = null;
  let stoneEls = {}, crocEls = {}, labelEls = {};
  let restored = false;
  let trail = [];

  /* ---------------- helpers ---------------- */
  const clamp = GS.clamp, lerp = GS.lerp;
  const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
  let uiK = 1;                // >1 on small screens so sprites and numbers stay readable
  const frogScale = z => clamp(0.42 + 0.58 * z, 0.56, 1) * Math.min(uiK, 1.3);
  const stoneScale = z => (L && L.tk ? Math.min(1.15, 1.25 * z) : Math.min(1, 1.05 * z));
  const labelScale = z => (z < 0.45 ? 0.92 : 1) * uiK;
  const labelY = () => 46 + 20 * uiK;          // below the water, clear of it at any size
  function hopSound() { if (GS.tone) GS.tone({ f: 330, f2: 560, t: 0.09, type: 'triangle', vol: 0.07 }); }
  function sprite(parent, n, ys, k, cls) {
    const g = GS.el('g', { class: cls || null }, parent);
    const s = { el: g, n, ys, k };
    const fn = () => g.setAttribute('transform', 'translate(' + (s.n * SP).toFixed(2) + ' ' + ((typeof s.ys === 'function' ? s.ys() : s.ys) / cam.z).toFixed(2) + ') scale(' + (s.k(cam.z) / cam.z).toFixed(4) + ')');
    s.place = fn; fn(); camFns.push(fn);
    return s;
  }
  function unreg(fn) { const k = camFns.indexOf(fn); if (k >= 0) camFns.splice(k, 1); }
  function applyCamera() {
    world.setAttribute('transform', 'translate(' + (640 - cam.cx * cam.z).toFixed(2) + ' ' + Y0 + ') scale(' + cam.z.toFixed(4) + ')');
    for (const f of camFns) f();
  }
  function camTween(to, dur, ease) {
    const from = { cx: cam.cx, z: cam.z };
    return GS.tween(T(dur), e => { cam.cx = lerp(from.cx, to.cx, e); cam.z = lerp(from.z, to.z, e); applyCamera(); }, ease || 'inOutCubic');
  }
  function overview() {
    const a = Math.min(L.start, L.target), b = Math.max(L.start, L.target);
    // fixed screen margin each side for the pills and the friend, whatever the zoom
    const z = clamp(1000 / ((b - a) * SP + 80), ZMIN, 1);
    return { cx: (a + b) / 2 * SP, z };
  }
  /** Screen x (svg units) of a number at the current camera. */
  const screenX = n => 640 + (n * SP - cam.cx) * cam.z;

  /* ---------------- number words for speech ---------------- */
  const W = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  function words(n) {
    if (n < 12) return W[n];
    if (n < 20) return W[n - 10] + ' belas';
    if (n < 100) { const t = Math.floor(n / 10), u = n % 10; return (t === 1 ? 'sepuluh' : W[t] + ' puluh') + (u ? ' ' + W[u] : ''); }
    if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return (h === 1 ? 'seratus' : W[h] + ' ratus') + (r ? ' ' + words(r) : ''); }
    if (n < 1000000) { const k = Math.floor(n / 1000), r = n % 1000; return (k === 1 ? 'seribu' : words(k) + ' ribu') + (r ? ' ' + words(r) : ''); }
    return String(n);
  }
  const FRAC = { '½': 'setengah', '¼': 'seperempat', '¾': 'tiga perempat' };
  function speakTok(t) {
    const op = { '+': 'tambah', '−': 'kurang', '×': 'kali', ':': 'dibagi', '=': 'sama dengan' }[t];
    if (op) return op;
    const m = /^([\d.]*)([½¼¾]?)$/.exec(t);
    if (!m) return t;
    const whole = m[1] ? +m[1].replace(/\./g, '') : 0;
    return ((m[1] && (whole || !m[2]) ? words(whole) : '') + (m[2] ? ' ' + FRAC[m[2]] : '')).trim();
  }
  function speakSentence(s) { return s.split(' ').map(speakTok).join(' '); }
  /** Format a value: thousands with a dot (Indonesian), halves and quarters as ½ ¼ ¾. */
  function fmtV(v) {
    const whole = Math.floor(v + 1e-9), fr = Math.round((v - whole) * 4);
    const w = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const f = ['', '¼', '½', '¾'][fr];
    return whole === 0 && f ? f : w + f;
  }
  const fmt = n => fmtV(n * L.unit);   // stone index -> label

  /* ---------------- art: Kodi, friend, croc, stone ---------------- */
  const KODI = { base: '#7CC26B', hl: '#A8DB8F', shade: '#4E9F45', belly: '#EAF4C8', spot: '#5BA84E' };
  const KIKI = { base: '#FFC83D', hl: '#FFE08A', shade: '#E09A00', belly: '#FFF3C8', spot: '#F28C28' };
  const BODY = 'M-44 -8C-50 -30 -36 -52 -12 -56C6 -60 30 -58 42 -46C52 -38 52 -22 42 -14C30 -4 -30 -2 -44 -8Z';

  function eye(cx, cy, r, c, pdx, wink) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + c.base + '" stroke="' + OUT + '" stroke-width="3"/>' +
      '<g class="kt-eye-open"><circle cx="' + cx + '" cy="' + (cy - 1.5) + '" r="' + (r * 0.7) + '" fill="#fff" stroke="' + OUT + '" stroke-width="1.8"/>' +
      '<circle cx="' + (cx + pdx) + '" cy="' + (cy - 1) + '" r="' + (r * 0.38) + '" fill="#2B1D14"/>' +
      '<circle cx="' + (cx + pdx - r * 0.16) + '" cy="' + (cy - r * 0.3) + '" r="' + (r * 0.14) + '" fill="#fff"/>' +
      '<circle cx="' + (cx + pdx + r * 0.16) + '" cy="' + (cy + r * 0.04) + '" r="' + (r * 0.07) + '" fill="#fff"/></g>' +
      '<path class="kt-eye-shut" d="M' + (cx - r * 0.45) + ' ' + (cy) + 'Q' + cx + ' ' + (cy - r * 0.6) + ' ' + (cx + r * 0.45) + ' ' + cy + '" fill="none" stroke="' + OUT + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<circle class="kt-lid' + (wink ? ' w' : '') + '" cx="' + cx + '" cy="' + (cy - 1.5) + '" r="' + (r * 0.74) + '" fill="' + c.base + '" stroke="' + OUT + '" stroke-width="1.8"/>';
  }

  /** Frog facing right, origin at its feet (bottom-centre). ~100 wide, ~75 tall. */
  function frogArt(id, c, friendly) {
    const s = [];
    s.push('<defs><clipPath id="' + id + '-b"><path d="' + BODY + '"/></clipPath><clipPath id="' + id + '-h"><ellipse cx="-24" cy="-20" rx="22" ry="17"/></clipPath></defs>');
    // far eye behind the head
    s.push(eye(3, -57, 13, c, 3));
    // body with 3-tone shading
    s.push('<path d="' + BODY + '" fill="' + c.shade + '"/>');
    s.push('<g clip-path="url(#' + id + '-b)"><path d="' + BODY + '" fill="' + c.base + '" transform="translate(-5 -6)"/>' +
      '<ellipse cx="16" cy="-11" rx="27" ry="12" fill="' + c.belly + '"/>' +
      '<ellipse cx="-16" cy="-45" rx="15" ry="7" fill="' + c.hl + '" transform="rotate(-16 -16 -45)"/>' +
      '<circle cx="-8" cy="-50" r="3.6" fill="' + c.spot + '"/><circle cx="-26" cy="-42" r="4.6" fill="' + c.spot + '"/><circle cx="-36" cy="-30" r="2.8" fill="' + c.spot + '"/></g>');
    s.push('<path d="' + BODY + '" fill="none" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>');
    // haunch
    s.push('<ellipse cx="-24" cy="-20" rx="22" ry="17" fill="' + c.shade + '"/>');
    s.push('<g clip-path="url(#' + id + '-h)"><ellipse cx="-27" cy="-23" rx="22" ry="17" fill="' + c.base + '"/><ellipse cx="-31" cy="-29" rx="9" ry="4.5" fill="' + c.hl + '" transform="rotate(-20 -31 -29)"/></g>');
    s.push('<ellipse cx="-24" cy="-20" rx="22" ry="17" fill="none" stroke="' + OUT + '" stroke-width="3"/>');
    // back foot with toes
    s.push('<g fill="' + c.base + '" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round">' +
      '<circle cx="-3" cy="-3" r="3.6"/><circle cx="2" cy="-1" r="3.4"/>' +
      '<path d="M-46 -1C-48 -7 -38 -8 -28 -7L-6 -6C0 -6 1 1 -4 1.5L-42 2C-45 2 -46 1 -46 -1Z"/></g>');
    // near eye
    s.push(eye(27, -55, 14.5, c, 3.5));
    // face
    s.push('<path d="M29 -33Q39 -25 48 -32" fill="none" stroke="' + OUT + '" stroke-width="2.6" stroke-linecap="round"/>');
    s.push('<ellipse cx="34" cy="-27" rx="6" ry="3.6" fill="#F59AB0" opacity="0.9"/>');
    s.push('<circle cx="45" cy="-43" r="1.5" fill="' + OUT + '"/>');
    // front arm (a waving one for the friend)
    if (friendly) {
      const wave = GS.reducedMotion ? '' : '<animateTransform attributeName="transform" type="rotate" values="0 56 -22;-24 56 -22;14 56 -22;-24 56 -22;14 56 -22;0 56 -22;0 56 -22" keyTimes="0;0.1;0.2;0.3;0.4;0.5;1" dur="3s" repeatCount="indefinite"/>';
      s.push('<path d="M24 -14L56 -22" fill="none" stroke="' + OUT + '" stroke-width="11" stroke-linecap="round"/><path d="M24 -14L56 -22" fill="none" stroke="' + c.base + '" stroke-width="5.6" stroke-linecap="round"/>');
      s.push('<g>' + wave + '<path d="M56 -22L62 -46" fill="none" stroke="' + OUT + '" stroke-width="11" stroke-linecap="round"/><path d="M56 -22L62 -46" fill="none" stroke="' + c.base + '" stroke-width="5.6" stroke-linecap="round"/>' +
        '<g fill="' + c.base + '" stroke="' + OUT + '" stroke-width="2.4"><circle cx="57" cy="-56" r="3.4"/><circle cx="63" cy="-59" r="3.4"/><circle cx="69" cy="-55" r="3.4"/><circle cx="63" cy="-50" r="6.5"/></g></g>');
      s.push('<g transform="translate(-4 -64)"><g fill="#F59AB0" stroke="' + OUT + '" stroke-width="2"><circle cx="0" cy="-6" r="4.6"/><circle cx="5.7" cy="-1.8" r="4.6"/><circle cx="3.5" cy="4.8" r="4.6"/><circle cx="-3.5" cy="4.8" r="4.6"/><circle cx="-5.7" cy="-1.8" r="4.6"/></g><circle r="3.4" fill="#F28C28" stroke="' + OUT + '" stroke-width="1.6"/></g>');
    } else {
      s.push('<g fill="' + c.base + '" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round">' +
        '<circle cx="24" cy="-2.5" r="3.4"/><circle cx="30" cy="-2" r="3.4"/><circle cx="35.5" cy="-3" r="3.4"/>' +
        '<path d="M16 -25C20 -16 22 -9 22 -4L36 -4C35 -10 30 -17 28 -25Z"/></g>');
    }
    return s.join('');
  }

  const CROC = { base: '#3F9152', hl: '#6DBA78', shade: '#2E6E3B' };
  const CROC_HEAD = 'M38 2C40 -12 30 -20 16 -20C4 -20 -12 -16 -28 -13C-40 -11 -44 -5 -42 0C-41 2 -39 2 -36 2Z';
  let crocN = 0;
  /** Cute crocodile head peeking out of the water, facing left. Origin at the water line. */
  function crocArt() {
    const id = 'kt-croc' + (++crocN);
    return '<defs><clipPath id="' + id + '"><path d="' + CROC_HEAD + '"/></clipPath></defs>' +
      '<ellipse cx="0" cy="3" rx="48" ry="9" fill="#2F80C9" opacity="0.35"/>' +
      '<path d="' + CROC_HEAD + '" fill="' + CROC.shade + '"/>' +
      '<g clip-path="url(#' + id + ')"><path d="' + CROC_HEAD + '" fill="' + CROC.base + '" transform="translate(-3 -5)"/>' +
      '<ellipse cx="-14" cy="-15" rx="16" ry="4" fill="' + CROC.hl + '" transform="rotate(-8 -14 -15)"/>' +
      '<circle cx="0" cy="-15" r="2.4" fill="' + CROC.shade + '"/><circle cx="-8" cy="-13" r="2" fill="' + CROC.shade + '"/></g>' +
      '<path d="' + CROC_HEAD + '" fill="none" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="-35" cy="-12" r="4" fill="' + CROC.base + '" stroke="' + OUT + '" stroke-width="2.4"/><circle cx="-36" cy="-13" r="1.3" fill="' + OUT + '"/>' +
      '<path d="M-36 -4Q-12 3 20 -6" fill="none" stroke="' + OUT + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M-26 -2.4l3 4.5 2.5 -4.2M-12 -0.6l3 4.4 2.6 -4.4" fill="#fff" stroke="' + OUT + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      eye(13, -21, 9, CROC, -2.5, true) + eye(27, -19, 8, CROC, -2.2, false) +
      '<path d="M-44 4q8 -4 16 0t16 0t16 0t16 0t16 0t16 0" fill="none" stroke="#E6F5F0" stroke-width="2.6" stroke-linecap="round" opacity="0.85"/>';
  }

  const STONE = 'M-38 0C-38 -12 -22 -16 0 -16C22 -16 38 -12 38 -2C38 8 22 10 0 10C-22 10 -38 8 -38 0Z';
  let stoneN = 0;
  function dotsArt(n, y0, r, gap) {
    // up to 5 per row, centred: the count is visible without reading the numeral
    let o = '';
    const rows = n > 5 ? [5, n - 5] : [n];
    rows.forEach((c, ri) => {
      for (let k = 0; k < c; k++) o += '<circle cx="' + ((k - (c - 1) / 2) * gap).toFixed(1) + '" cy="' + (y0 + ri * gap * 0.75).toFixed(1) + '" r="' + r + '" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="1.4"/>';
    });
    return o;
  }
  function stoneArt(emph, dots) {
    const id = 'kt-st' + (++stoneN);
    if (dots != null && L && L.tk) return '<g transform="scale(1.14 1.55)">' + stoneArt(false, null) + '</g>' + (dots ? dotsArt(dots, dots > 5 ? -17 : -10, 7, 15.5) : '');
    return '<defs><clipPath id="' + id + '"><path d="' + STONE + '"/></clipPath></defs>' +
      '<ellipse cx="2" cy="8" rx="44" ry="9" fill="#2F80C9" opacity="0.35"/>' +
      '<path d="' + STONE + '" fill="#63666B"/>' +
      '<g clip-path="url(#' + id + ')"><path d="' + STONE + '" fill="#8C8F94" transform="translate(-3 -5)"/>' +
      '<ellipse cx="-14" cy="-9" rx="13" ry="4" fill="#B6B9BD"/>' +
      (emph ? '<ellipse cx="14" cy="-8" rx="11" ry="4.5" fill="#7CC26B"/><ellipse cx="11" cy="-10" rx="5" ry="2" fill="#A8DB8F"/>' : '') + '</g>' +
      '<path d="' + STONE + '" fill="none" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>' +
      (dots ? dotsArt(dots, dots > 5 ? -13 : -6, 7, 15.5) : '') +
      '<path d="M-40 6q7 -3 14 0t14 0t14 0t14 0t14 0t14 0" fill="none" stroke="#E6F5F0" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>';
  }

  /* ---------------- background + lane (screen space) ---------------- */
  function drawBackground() {
    bgL.innerHTML = ''; laneL.innerHTML = '';
    const top = Y0 - 62;              // top of the pematang
    // sky + hills fallback extends into letterbox bands
    GS.el('rect', { x: -1400, y: -1200, width: 4080, height: top + 1300, fill: '#9ED8EC' }, bgL);
    if (art.scene) {
      try {
        const sc = art.scene('sawah', 1280, 800), dy = top + 8 - 624;
        // mirrored copies (behind) fill the letterbox bands on phones and wide screens
        GS.markup(GS.el('g', { transform: 'translate(0 ' + dy + ') scale(-1 1)' }, bgL), sc);
        GS.markup(GS.el('g', { transform: 'translate(2560 ' + dy + ') scale(-1 1)' }, bgL), sc);
        GS.markup(GS.el('g', { transform: 'translate(0 ' + dy + ')' }, bgL), sc);
      } catch (e) { /* art not ready */ }
    } else {
      GS.el('rect', { x: -1400, y: top - 260, width: 4080, height: 260, fill: '#E6F5F0', opacity: 0.6 }, bgL);
      GS.el('path', { d: 'M-1400 ' + (top - 20) + ' Q-200 ' + (top - 210) + ' 360 ' + (top - 90) + ' T1400 ' + (top - 120) + ' T2680 ' + (top - 60) + ' V' + (top + 40) + ' H-1400Z', fill: '#A9D3A0' }, bgL);
      GS.el('rect', { x: -1400, y: top - 40, width: 4080, height: 60, fill: '#7CC26B' }, bgL);
    }
    // pematang (dike): flat top path and earthen face
    const g = laneL;
    GS.el('path', { d: 'M-1400 ' + (top + 4) + ' Q-700 ' + (top - 4) + ' 0 ' + (top + 2) + ' T1280 ' + (top) + ' T2680 ' + (top + 2) + ' V' + (Y0 - 10) + ' H-1400Z', fill: '#E5BE86' }, g);
    GS.el('rect', { x: -1400, y: top + 20, width: 4080, height: Y0 - 10 - top - 20, fill: '#D4A062' }, g);
    GS.el('rect', { x: -1400, y: Y0 - 22, width: 4080, height: 10, fill: '#B9844C', opacity: 0.6 }, g);
    // grass fringe along the pematang top
    let tufts = '';
    for (let x = -1380; x < 2680; x += 46) {
      const y = top + 4 + Math.sin(x * 0.05) * 2;
      tufts += 'M' + x + ' ' + y + 'l6 -12 4 11 5 -9 4 10';
    }
    GS.el('path', { d: tufts, fill: 'none', stroke: '#4DAA57', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    GS.el('rect', { x: -1400, y: top - 1, width: 4080, height: 7, fill: '#7CC26B' }, g);
    // pebbles on the dike face
    let peb = '';
    for (let x = -1360; x < 2680; x += 137) peb += 'M' + x + ' ' + (top + 34 + (x % 3) * 4) + 'a7 4 0 1 0 14 0a7 4 0 1 0 -14 0';
    GS.el('path', { d: peb, fill: '#C38F55' }, g);
    // water channel
    GS.el('rect', { x: -1400, y: Y0 - 16, width: 4080, height: 52, fill: '#3FA7C4' }, g);
    GS.el('rect', { x: -1400, y: Y0 - 16, width: 4080, height: 7, fill: '#2F8FAE' }, g);
    let sh = '';
    for (let x = -1400; x < 2840; x += 160) sh += 'M' + x + ' ' + (Y0 + 6) + 'h34M' + (x + 80) + ' ' + (Y0 + 22) + 'h22';
    const shim = GS.el('g', {}, g);
    GS.el('path', { class: 'kt-shimmer', d: sh, stroke: '#8FD3E3', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.8 }, shim);
    // near bank and the rice field in front
    GS.el('path', { d: 'M-1400 ' + (Y0 + 36) + ' Q-1000 ' + (Y0 + 28) + ' -600 ' + (Y0 + 36) + ' T200 ' + (Y0 + 34) + ' T1000 ' + (Y0 + 36) + ' T1800 ' + (Y0 + 33) + ' T2680 ' + (Y0 + 36) + ' V2000 H-1400Z', fill: '#7CC26B' }, g);
    GS.el('rect', { x: -1400, y: Y0 + 34, width: 4080, height: 6, fill: '#4DAA57' }, g);
    let rice = '';
    for (let row = 0; row < 8; row++) {
      const y = Y0 + 120 + row * 64;
      for (let x = -1380 + (row % 2) * 40; x < 2680; x += 80) rice += 'M' + x + ' ' + y + 'l-7 -16M' + x + ' ' + y + 'l0 -19M' + x + ' ' + y + 'l7 -16';
    }
    GS.el('path', { d: rice, fill: 'none', stroke: '#4DAA57', 'stroke-width': 3.4, 'stroke-linecap': 'round', opacity: 0.55 }, g);
  }

  /** Put the number line just above the planning panel; recompute on resize. */
  function layout() {
    if (!L) return;
    const ctm = svg.getScreenCTM();
    if (ctm) uiK = clamp(0.62 / ctm.a, 1, 1.45);
    const r = plan.getBoundingClientRect();
    let panelTop = 800;
    if (r.height > 0) panelTop = GS.svgPoint(svg, r.left + r.width / 2, r.top).y;
    const y = Math.round(clamp(panelTop - 50 - 40 * uiK, 178, 500));
    if (y !== Y0 || !bgL.firstChild) { Y0 = y; drawBackground(); }
    applyCamera();
    updateLabels();
  }
  let rzT = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(rzT); rzT = requestAnimationFrame(layout); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  /* ---------------- level definitions (per grade tier, docs/KURIKULUM.md) ----------------
   * Levels are written in VALUES (e.g. 340, ½, 5.000). `unit` is the value of one stone;
   * finalize() converts everything to stone indices so all hop math is exact integers. */
  const R = GS.rand;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const lcm = (a, b) => { let x = a, y = b; while (y) [x, y] = [y, x % y]; return a * b / x; };
  const fwd = (size, count) => ({ size, count, dir: 1 });
  const back = (size, count) => ({ size, count, dir: -1 });

  function finalize(d, i) {
    const u = d.unit = d.unit || 1;
    const k = v => Math.round(v / u);
    const o = Object.assign({ i, start: 0, lo: 0, dir: false, labels: 'auto', crocs: [], hint: 'Hitung lompatannya pelan-pelan.' }, d);
    o.start = k(o.start); o.target = k(o.target); o.lo = k(o.lo);
    o.hi = o.hi != null ? k(o.hi) : Math.max(o.start, o.target) + (o.pad || 4);
    o.crocs = new Set(o.crocs.map(k));
    o.stages = o.stages.map(st => Object.assign({ min: o.stages.length > 1 ? 0 : 1, max: o.tk ? 10 : 12 }, st, { sizes: st.sizes.map(k) }));
    o.sol = o.sol.map(p => ({ size: k(p.size), count: p.count, dir: p.dir }));
    return o;
  }

  const TIERS = {
    tk: [
      () => { const t = R(2, 4); return { tk: true, target: t, hi: 6, labels: 1, stages: [{ sizes: [1] }], sol: [fwd(1, t)],
        say: 'Ayo lompat ke teman Kodi!', hint: 'Hitung titiknya, satu, dua, tiga.' }; },
      () => { const t = R(4, 5); return { tk: true, target: t, hi: 7, labels: 1, stages: [{ sizes: [1] }], sol: [fwd(1, t)],
        say: 'Lompat lagi ke temannya!', hint: 'Satu lompat, satu batu.' }; },
      () => { const t = R(6, 10); return { tk: true, target: t, hi: 11, labels: 1, stages: [{ sizes: [1] }], sol: [fwd(1, t)],
        say: 'Temannya jauh. Lompat berapa kali?', hint: 'Hitung batunya sampai teman.' }; },
      () => ({ tk: true, start: 5, target: 0, hi: 7, labels: 1, dir: true, stages: [{ sizes: [1] }], sol: [back(1, 5)],
        say: 'Kodi mau pulang. Lompat mundur!', hint: 'Tekan panah ke belakang.' }),
      () => { const t = 2 * R(2, 5); return { tk: true, target: t, hi: 11, labels: 1, stages: [{ sizes: [2] }], sol: [fwd(2, t / 2)],
        say: 'Sekali lompat, dua batu!', hint: 'Lompat dua-dua: dua, empat, enam.' }; },
      () => Math.random() < 0.5
        ? (() => { const s = R(7, 10), t = s - R(3, 5); return { tk: true, start: s, target: t, hi: 11, labels: 1, dir: true, stages: [{ sizes: [1] }], sol: [back(1, s - t)],
          say: 'Temannya di belakang. Lompat ke sana!', hint: 'Mundur, lalu hitung titiknya.' }; })()
        : (() => { const s = R(1, 3), t = R(7, 10); return { tk: true, start: s, target: t, hi: 11, labels: 1, dir: true, stages: [{ sizes: [1, 2] }], sol: [fwd(1, t - s)],
          say: 'Tantangan! Lompat ke temannya.', hint: 'Hitung lompatannya satu per satu.' }; })()
    ],
    k1: [
      () => { const t = R(5, 12); return { target: t, hi: Math.max(10, t + 3), labels: 1, stages: [{ sizes: [1] }], sol: [fwd(1, t)],
        say: 'Bantu Kodi lompat ke temannya. Berapa lompatan?', hint: 'Hitung lompatannya satu per satu.' }; },
      () => { const s = R(9, 15), t = s - R(3, 7); return { start: s, target: t, hi: s + 3, labels: 1, dir: true, stages: [{ sizes: [1] }], sol: [back(1, s - t)],
        say: 'Temannya ada di belakang. Lompat mundur, ya!', hint: 'Pilih panah mundur, lalu hitung lompatannya.' }; },
      () => { const t = 2 * R(4, 9); return { target: t, hi: Math.min(20, t + 4), labels: 1, dir: true, stages: [{ sizes: [2] }], sol: [fwd(2, t / 2)],
        say: 'Sekali lompat, dua batu. Berapa kali lompat?', hint: 'Lompat dua: dua, empat, enam, terus.' }; },
      () => { const s = R(6, 11), t = s + R(4, 7); return { start: s, target: t, hi: t + 4, labels: 5, dir: true, stages: [{ sizes: [1, 2] }], sol: [fwd(1, t - s)],
        say: 'Kodi mulai dari tengah. Berapa lompatan lagi?', hint: 'Mulai dari batu Kodi, lalu hitung lanjut.' }; },
      () => { const s = R(13, 18), t = s - R(6, 9); return { start: s, target: t, hi: s + 3, labels: 5, dir: true, stages: [{ sizes: [1, 2, 5] }], sol: [back(1, s - t)],
        say: 'Kodi mau pulang. Lompat mundur ke temannya.', hint: 'Mundur, lalu hitung lompatannya satu per satu.' }; },
      () => { const t = pick([15, 20]), crocs = []; for (let n = 1; n <= t + 4; n++) if (n % 5) crocs.push(n);
        return { target: t, hi: t + 4, labels: 1, dir: true, crocs, stages: [{ sizes: [1, 2, 5] }], sol: [fwd(5, t / 5)],
          say: 'Awas buaya! Pilih lompatan yang aman.', hint: 'Batu yang aman: lima, sepuluh, lima belas.' }; },
      () => { let t; do t = R(11, 19); while (t % 5 === 0);
        return { target: t, hi: t + 4, labels: 5, stages: [{ sizes: [5] }, { sizes: [1] }], sol: [fwd(5, Math.floor(t / 5)), fwd(1, t % 5)],
          say: 'Lompat lima dulu, lalu lompat satu.', hint: 'Lima, sepuluh, lalu sisanya satu-satu.' }; },
      () => crocChallenge(false)
    ],
    k2: [
      () => { const t = 10 * R(4, 9); return { target: t, hi: t + 8, labels: 5, stages: [{ sizes: [1, 2, 5, 10] }], sol: [fwd(10, t / 10)],
        say: 'Jauh sekali! Coba lompatan sepuluh.', hint: 'Lompat sepuluh: sepuluh, dua puluh, tiga puluh.' }; },
      () => { const t = 5 * (2 * R(2, 5) + 1); return { target: t, hi: t + 6, labels: 5, dir: true, stages: [{ sizes: [2, 5, 10] }], sol: [fwd(5, t / 5)],
        say: 'Lompat lima-lima sampai ke temannya.', hint: 'Lima, sepuluh, lima belas, terus.' }; },
      () => { const t = R(23, 67); return { target: t, hi: t + 8, labels: 5, stages: [{ sizes: [10] }, { sizes: [1] }], sol: [fwd(10, Math.floor(t / 10)), fwd(1, t % 10)],
        say: 'Lompat sepuluh dulu, lalu lompat satu.', hint: 'Puluhan dulu dengan lompat sepuluh, lalu satuan.' }; },
      () => { const s = R(32, 44), a = R(2, 3), b = R(3, 8), t = s + 10 * a + b;
        return { start: s, target: t, lo: s - 4, hi: t + 6, labels: 5, stages: [{ sizes: [10] }, { sizes: [1, 2, 5] }], sol: [fwd(10, a), b === 5 ? fwd(5, 1) : fwd(1, b)],
          say: 'Hitung lanjut dengan puluhan. Lompat sepuluh dulu!', hint: 'Dari batu Kodi, lompat sepuluh, lalu sisanya.' }; },
      () => { const s = R(62, 88), a = R(2, 4), b = R(1, 9), t = s - 10 * a - b;
        return { start: s, target: t, lo: t - 4, hi: s + 4, labels: 5, dir: true, stages: [{ sizes: [10] }, { sizes: [1] }], sol: [back(10, a), back(1, b)],
          say: 'Temannya di belakang. Mundur puluhan, lalu satuan.', hint: 'Pilih mundur di dua baris, lalu hitung.' }; },
      () => { const s = R(30, 55), a = R(2, 3), b = R(2, 8), t = s + 10 * a + b;
        return { start: s, target: t, lo: s - 4, hi: t + 6, labels: 'ends', stages: [{ sizes: [10] }, { sizes: [1, 2, 5] }], sol: [fwd(10, a), b === 5 ? fwd(5, 1) : fwd(1, b)],
          say: 'Batunya tanpa angka. Rencanakan lompatanmu!', hint: 'Coba lompat sepuluh dulu, lalu sisanya.' }; },
      () => { const k = pick([5, 10]), t = k === 10 ? 10 * R(3, 7) : 5 * R(5, 11), crocs = [];
        for (let n = 1; n <= t + 6; n++) if (n % k) crocs.push(n);
        return { target: t, hi: t + 6, labels: k, dir: true, crocs, stages: [{ sizes: k === 10 ? [2, 5, 10] : [1, 2, 5] }], sol: [fwd(k, t / k)],
          say: 'Awas buaya! Batu mana yang aman?', hint: 'Batu yang aman hanya batu ' + (k === 10 ? 'puluhan.' : 'kelipatan lima.') }; },
      () => { const s = R(30, 60), a = R(1, 3), b = R(1, 9), dir = pick([1, -1]), t = s + dir * (10 * a + b);
        return { start: s, target: t, lo: Math.min(s, t) - 4, hi: Math.max(s, t) + 6, labels: 'ends', dir: true, stages: [{ sizes: [10] }, { sizes: [1, 2, 5] }], sol: [{ size: 10, count: a, dir }, { size: 1, count: b, dir }],
          say: 'Tantangan! Maju atau mundur? Rencanakan dulu.', hint: 'Lihat temannya di mana, lalu lompat puluhan.' }; }
    ],
    k3: [
      () => { const b = R(2, 10), a = R(3, 9); return { target: a * b, hi: a * b + b, stages: [{ sizes: [b] }], sol: [fwd(b, a)], sentence: 'mul',
        say: 'Sekali lompat ' + b + ' batu. Berapa kali sampai temannya?', hint: 'Lompat ' + b + ', ' + 2 * b + ', ' + 3 * b + ', terus.' }; },
      () => { const d = R(3, 6), q = R(4, 9); return { target: d * q, hi: d * q + d, stages: [{ sizes: [d] }], sol: [fwd(d, q)], sentence: 'div',
        say: 'Lompatan isi ' + d + '. Berapa kali sampai ' + d * q + '?', hint: 'Hitung lompatannya: ' + d + ', ' + 2 * d + ', ' + 3 * d + '.' }; },
      () => { const t = 100 * R(3, 7); return { unit: 10, target: t, hi: 1000, stages: [{ sizes: [10, 50, 100] }], sol: [fwd(100, t / 100)], dir: true,
        say: 'Garisnya sampai seribu. Coba lompat seratus!', hint: 'Seratus, dua ratus, tiga ratus, terus.' }; },
      () => { const a = R(2, 4), b = R(1, 9), t = 100 * a + 10 * b; return { unit: 10, target: t, hi: t + 100, stages: [{ sizes: [100] }, { sizes: [10] }], sol: [fwd(100, a), fwd(10, b)],
        say: 'Lompat ratusan dulu, lalu puluhan.', hint: 'Ratusan dulu, lalu sisanya lompat sepuluh.' }; },
      () => { const s = 100 * R(1, 3) + 10 * R(1, 9), a = R(1, 3), b = R(1, 9), t = s + 100 * a + 10 * b;
        return { unit: 10, start: s, target: t, lo: s - 40, hi: t + 60, labels: 'ends', stages: [{ sizes: [100] }, { sizes: [10, 50] }], sol: [fwd(100, a), b === 5 ? fwd(50, 1) : fwd(10, b)],
          say: 'Garis kosong! Rencanakan ratusan dan puluhan.', hint: 'Dari batu Kodi, lompat seratus dulu.' }; },
      () => { const t = pick([12, 18, 20, 24, 30]), divs = [2, 3, 4, 5, 6, 7, 8, 9].filter(x => t % x === 0 && t / x <= 12), non = [3, 4, 5, 7, 8, 9].filter(x => t % x);
        const sizes = GS.shuffle(divs).slice(0, 2).concat(GS.shuffle(non).slice(0, 2)).sort((x, y) => x - y), ok = sizes.filter(x => t % x === 0);
        return { target: t, hi: t + 5, stages: [{ sizes }], sol: [fwd(ok[0], t / ok[0])], sentence: 'mul',
          say: 'Lompatan berapa yang pas sampai ' + t + '?', hint: 'Lompatan yang pas membagi ' + t + ' sama rata.' }; },
      () => { const b = R(3, 8), a = R(3, 8), t = a * b, div = Math.random() < 0.5;
        return { target: t, hi: t + b, stages: [{ sizes: [b - 1, b, b + 1] }], sol: [fwd(b, a)], sentence: div ? 'div' : 'mul',
          say: div ? 'Bagi ' + t + ' jadi lompatan sama besar. Pilih lompatannya!' : 'Lompat sama besar sampai ' + t + '. Pilih lompatannya!', hint: 'Coba lompatan ' + b + '.' }; },
      () => mulCrocs()
    ],
    k4: [
      () => meetLevel(),
      () => { const w = R(2, 4); return { unit: 0.5, target: w, hi: w + 1, stages: [{ sizes: [0.5] }], sol: [fwd(0.5, w * 2)], sentence: 'mul',
        say: 'Lompatan Kodi setengah. Berapa kali sampai ' + w + '?', hint: 'Dua kali setengah sama dengan satu.' }; },
      () => { let q; do q = R(5, 11); while (q % 2 === 0); return { unit: 0.25, target: q / 4, hi: q / 4 + 1, stages: [{ sizes: [0.25, 0.5] }], sol: [fwd(0.25, q)], sentence: 'mul',
        say: 'Batunya seperempat-seperempat. Lompat ke temannya!', hint: 'Empat kali seperempat sama dengan satu.' }; },
      () => { const t = 1000 * R(3, 9); return { unit: 500, target: t, hi: 10000, dir: true, stages: [{ sizes: [500, 1000, 2000] }], sol: [fwd(1000, t / 1000)],
        say: 'Garisnya sampai sepuluh ribu. Lompat seribu!', hint: 'Seribu, dua ribu, tiga ribu, terus.' }; },
      () => divRem(),
      () => { const w = R(1, 4), q = Math.random() < 0.5;
        return q ? { unit: 0.25, target: w + 0.75, hi: w + 2, stages: [{ sizes: [1] }, { sizes: [0.25] }], sol: [fwd(1, w), fwd(0.25, 3)],
          say: 'Lompat satu-satu, lalu seperempat.', hint: 'Satuan dulu, lalu tiga kali seperempat.' }
          : { unit: 0.5, target: w + 0.5, hi: w + 2, stages: [{ sizes: [1] }, { sizes: [0.5] }], sol: [fwd(1, w), fwd(0.5, 1)],
            say: 'Lompat satu-satu, lalu setengah.', hint: 'Satuan dulu, lalu setengah.' }; },
      () => { const g = R(0, 2);
        if (g === 0) { const s = R(1, 3) + 0.5, n = R(2, 4); return { unit: 0.5, start: s, target: s + n, hi: s + n + 1, dir: true, stages: [{ sizes: [0.5, 1] }], sol: [fwd(1, n)],
          say: 'Kodi mulai dari pecahan. Lompat ke temannya!', hint: 'Lompat satu-satu dari batu Kodi.' }; }
        if (g === 1) return divRem();
        const s = 1000 * R(1, 3), a = R(1, 3), t = s + 1000 * a + 500;
        return { unit: 500, start: s, target: t, lo: s - 1000, hi: t + 1000, stages: [{ sizes: [1000] }, { sizes: [500] }], sol: [fwd(1000, a), fwd(500, 1)],
          say: 'Ribuan dulu, lalu lima ratus.', hint: 'Lompat seribu, lalu lima ratus.' }; },
      () => { const w = R(2, 3), t = w + 0.5, crocs = [];
        for (let q = 1; q < (t + 1) * 4; q += 2) if (Math.random() < 0.6 || q === 1) crocs.push(q / 4);
        return { unit: 0.25, target: t, hi: t + 1, dir: true, crocs, stages: [{ sizes: [0.25, 0.5, 1] }], sol: [fwd(0.5, t * 2)], sentence: 'mul',
          say: 'Tantangan! Buaya di batu seperempat. Pilih lompatan aman.', hint: 'Lompatan setengah melewati semua buaya.' }; }
    ]
  };

  function crocChallenge() {
    const d = { labels: 'ends', stages: [{ sizes: [1, 2, 5, 10] }], crocs: [], say: 'Banyak buaya! Pilih lompatan yang aman.', hint: 'Lihat buayanya. Ukuran lompatan mana yang melewati semua?' };
    if (Math.random() < 0.5) {
      d.target = pick([12, 14, 16, 18]);
      const odds = []; for (let n = 1; n < d.target; n += 2) odds.push(n);
      GS.shuffle(odds).slice(0, 4).forEach(n => d.crocs.push(n));
      d.crocs.push(d.target + 1); d.sol = [fwd(2, d.target / 2)];
    } else {
      d.target = 20;
      const odds = [], evens = [];
      for (let n = 1; n < d.target; n++) if (n % 5) (n % 2 ? odds : evens).push(n);
      GS.shuffle(odds).slice(0, 3).concat(GS.shuffle(evens).slice(0, 3)).forEach(n => d.crocs.push(n));
      d.crocs.push(d.target + 2); d.sol = [fwd(5, 4)];
    }
    d.hi = d.target + 5;
    return d;
  }
  function mulCrocs() {
    const b = R(3, 7), a = R(4, 8), t = a * b;
    const others = GS.shuffle([2, 3, 4, 5, 6, 7, 8, 9].filter(x => x !== b && x % b)).slice(0, 2);
    const sizes = [b].concat(others).sort((x, y) => x - y), crocs = new Set();
    others.forEach(s => { const m = []; for (let v = s; v < t; v += s) if (v % b) m.push(v); if (m.length) crocs.add(pick(m)); });
    for (let k = 0; k < 3; k++) { const v = R(1, t - 1); if (v % b) crocs.add(v); }
    return { target: t, hi: t + 4, labels: 'ends', crocs: [...crocs], stages: [{ sizes }], sol: [fwd(b, a)], sentence: 'mul',
      say: 'Tantangan! Pilih lompatan yang aman sampai temannya.', hint: 'Lompatan ' + b + ' tidak pernah kena buaya.' };
  }
  function divRem() {
    const d = R(3, 7), q = R(3, 6), r = R(1, d - 1), t = q * d + r;
    return { target: t, hi: t + d, stages: [{ sizes: [d], max: 12 }, { sizes: [1] }], sol: [fwd(d, q), fwd(1, r)], sentence: 'divrem',
      say: 'Lompat ' + d + ' sebanyak mungkin, sisanya lompat kecil.', hint: 'Berhenti sebelum lewat, lalu lompat satu-satu.' };
  }
  function meetLevel() {
    const [a, b] = pick([[2, 3], [3, 4], [2, 5], [4, 6], [3, 5]]), m = lcm(a, b);
    return { meet: true, target: m, hi: 2 * m + 2, labels: 1, stages: [{ sizes: [a], who: 'Kodi', min: 1 }, { sizes: [b], who: 'Kiki', min: 1 }], sol: [fwd(a, m / a), fwd(b, m / b)], sentence: 'meet',
      say: 'Kodi lompat ' + a + ', Kiki lompat ' + b + '. Di mana mereka bertemu?', hint: 'Cari batu yang dilewati keduanya.' };
  }

  function makeLevel(i) {
    const list = TIERS[TIER] || TIERS.k1;
    return finalize(list[Math.min(i, list.length - 1)](), i);
  }
  /** The intended plan (used by the debug hook). */
  function solution() { return L.sol.map(p => Object.assign({}, p)); }

  /* ---------------- planning panel ---------------- */
  const ARROW = d => '<svg viewBox="0 0 40 26" aria-hidden="true"><path d="' + (d > 0 ? 'M5 13h27M22 4l10 9-10 9' : 'M35 13H8M18 4 8 13l10 9') + '" fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
  function padSVG(s, label) {
    // lily pad with a notch; under the number a ruler of 10 dots with an arc as long as the hop
    let dots = '';
    for (let k = 0; k <= 10; k++) dots += '<circle cx="' + (23 + k * 5.4) + '" cy="80" r="2.1" fill="#FFF8EC"/>';
    s = Math.min(s, 10);
    const x1 = 23 + s * 5.4, hgt = 6 + s * 1.2, fs = label.length <= 2 ? 40 : label.length === 3 ? 32 : 25;
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="ring" cx="50" cy="52" r="49" fill="none" stroke="#1F6FD1" stroke-width="6"/>' +
      '<path d="M50 54L77 21.8A42 42 0 1 1 57.3 12.6Z" fill="#357F40"/>' +
      '<path d="M48 51L75 18.8A42 42 0 1 1 55.3 9.6Z" fill="#4DAA57"/>' +
      '<ellipse cx="30" cy="30" rx="14" ry="8" fill="#86CC8C" transform="rotate(-30 30 30)"/>' +
      '<path d="M50 54L77 21.8A42 42 0 1 1 57.3 12.6Z" fill="none" stroke="' + OUT + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<text x="50" y="62" text-anchor="middle" font-family="Fredoka, Baloo 2, sans-serif" font-weight="600" font-size="' + fs + '" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="6" paint-order="stroke" stroke-linejoin="round">' + label + '</text>' +
      dots + '<path d="M23 79Q' + ((23 + x1) / 2) + ' ' + (79 - hgt * 2) + ' ' + x1 + ' 79" fill="none" stroke="#FFF8EC" stroke-width="3.2" stroke-linecap="round"/>' +
      '</svg>';
  }
  let panelRefs = [];
  function buildPanel() {
    plan.innerHTML = '';
    panelRefs = [];
    const two = L.stages.length === 2;
    const cols = (two ? 1 : 0) + (L.dir ? 1 : 0) + 2;
    plan.style.gridTemplateColumns = 'repeat(' + cols + ', auto)';
    plan.classList.toggle('kt-tk', !!L.tk);
    const cap = t => { const c = document.createElement('div'); c.className = 'kt-cap'; c.textContent = t; plan.appendChild(c); };
    if (!L.tk) {            // TK: no text to read, the icons carry the meaning
      if (two) cap('');
      if (L.dir) cap('arah');
      cap('lompatan');
      cap('berapa kali');
    }
    L.stages.forEach((st, si) => {
      const ref = {};
      if (two) {
        const lead = document.createElement('div');
        lead.className = 'kt-lead' + (si || st.who ? ' chip' : '') + (st.who ? ' who' + si : '');
        lead.textContent = st.who || (si ? 'lalu' : '');
        plan.appendChild(lead);
      }
      if (L.dir) {
        const g = document.createElement('div'); g.className = 'kt-group';
        ref.dirBtns = [-1, 1].map(d => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'kt-dirbtn';
          b.innerHTML = ARROW(d) + (L.tk ? '' : '<span>' + (d > 0 ? 'maju' : 'mundur') + '</span>');
          b.setAttribute('aria-label', d > 0 ? 'Lompat maju' : 'Lompat mundur');
          b.addEventListener('click', () => { setDir(si, d); });
          g.appendChild(b);
          return b;
        });
        plan.appendChild(g);
      }
      const sg = document.createElement('div'); sg.className = 'kt-group';
      ref.pads = st.sizes.map(s => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'kt-pad';
        b.innerHTML = padSVG(s, fmt(s));
        b.setAttribute('aria-label', 'Lompatan ' + fmt(s));
        b.dataset.size = s;
        b.addEventListener('click', () => setSize(si, s));
        sg.appendChild(b);
        return b;
      });
      plan.appendChild(sg);
      const cg = document.createElement('div'); cg.className = 'kt-group';
      const minus = GS.button('kt-step', 'Kurangi lompatan', MINUS, () => setCount(si, P[si].count - 1));
      const num = document.createElement('div'); num.className = 'kt-num'; num.setAttribute('aria-live', 'polite');
      if (L.tk) { num.innerHTML = '<b></b><svg viewBox="-34 -6 68 22" aria-hidden="true"></svg>'; num.classList.add('dots'); }
      const plus = GS.button('kt-step', 'Tambah lompatan', PLUS, () => setCount(si, P[si].count + 1));
      cg.append(minus, num, plus);
      plan.appendChild(cg);
      Object.assign(ref, { minus, plus, num });
      panelRefs.push(ref);
    });
    refreshPanel();
  }
  const countRange = si => [L.stages[si].min, L.stages[si].max];
  function refreshPanel() {
    P.forEach((p, si) => {
      const r = panelRefs[si];
      if (!r) return;
      r.pads.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.size === p.size)));
      if (r.dirBtns) r.dirBtns.forEach((b, k) => b.setAttribute('aria-pressed', String((k ? 1 : -1) === p.dir)));
      if (L.tk) { r.num.firstChild.textContent = p.count; r.num.lastChild.innerHTML = dotsArt(p.count, 0, 3.4, 7.6).replace(/stroke-width="1.4"/g, 'stroke-width="1"').replace(/#FFF8EC/g, '#F28C28'); }
      else r.num.textContent = p.count;
      const [lo, hi] = countRange(si);
      r.minus.disabled = busy || p.count <= lo;
      r.plus.disabled = busy || p.count >= hi;
    });
  }
  function setSize(si, s) { if (busy) return; P[si].size = s; GS.sfx.pop(); refreshPanel(); }
  function setDir(si, d) { if (busy) return; P[si].dir = d; GS.sfx.pick(); refreshPanel(); faceFrog(d); }
  function setCount(si, c) {
    if (busy) return;
    const [lo, hi] = countRange(si);
    c = clamp(c, lo, hi);
    if (c === P[si].count) return;
    P[si].count = c;
    GS.sfx.count(c);
    refreshPanel();
    const n = panelRefs[si].num; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
  }
  function lockPanel(on) {
    plan.classList.toggle('locked', on);
    plan.querySelectorAll('button').forEach(b => { if (on) b.disabled = true; });
    goBtn.disabled = on;
    if (!on) { plan.querySelectorAll('.kt-pad, .kt-dirbtn').forEach(b => { b.disabled = false; }); refreshPanel(); }
  }

  /* ---------------- frog + friend sprites ---------------- */
  function makeFrog(parent, id, colors, friendly) {
    const shadow = GS.el('ellipse', { cx: 0, cy: 0, rx: 40, ry: 7, fill: OUT, opacity: 0.18 }, parent);
    const root = GS.el('g', { class: friendly ? 'kt-friend' : 'kt-kodi' }, parent);
    const flip = GS.el('g', {}, root);
    const squash = GS.el('g', {}, flip);
    const breathe = GS.el('g', { class: 'kt-breathe' }, squash);
    GS.markup(breathe, frogArt(id, colors, friendly));
    const f = { root, flip, squash, shadow, n: 0, base: 0, baseFn: null, hy: 0, face: 1, sx: 1, sy: 1, rot: 0, off: 0, alpha: 1, ground: true };
    f.place = () => {
      const z = cam.z, k = frogScale(z) * (friendly ? 0.86 : 1);
      if (f.baseFn) f.base = f.baseFn();
      const x = f.n * SP + f.off / z;
      root.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + ((f.base - f.hy) / z).toFixed(2) + ') scale(' + (k / z).toFixed(4) + ')');
      flip.setAttribute('transform', 'scale(' + f.face + ' 1)');
      squash.setAttribute('transform', 'rotate(' + f.rot.toFixed(2) + ') scale(' + f.sx.toFixed(3) + ' ' + f.sy.toFixed(3) + ')');
      root.setAttribute('opacity', f.alpha);
      const sk = Math.max(0.35, 1 - Math.max(0, f.hy) / 240);
      shadow.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + ((f.base + 1) / z).toFixed(2) + ') scale(' + (k * sk / z).toFixed(4) + ')');
      shadow.setAttribute('opacity', (f.ground ? 0.18 * sk * f.alpha : 0).toFixed(3));
    };
    camFns.push(f.place);
    return f;
  }
  function faceFrog(d) { if (frog && d) { frog.face = d; frog.place(); } }
  const frogBase = () => -7 * stoneScale(cam.z);

  /* ---------------- build a level ---------------- */
  let demoSig = '';           // the example's numbers; the child's own level must differ
  const sigOf = l => l.start + '>' + l.target + ':' + l.sol.map(p => p.size + 'x' + p.count).join(',');
  function buildLevel(i, demo) {
    token++;
    world.innerHTML = ''; uiL.innerHTML = '';
    camFns = []; stoneEls = {}; crocEls = {}; labelEls = {}; trail = [];
    tries = 0; busy = false; restored = false; stoneN = 0; crocN = 0;
    L = makeLevel(i);
    for (let k = 0; k < 12 && sigOf(L) === demoSig; k++) L = makeLevel(i);
    if (demo) demoSig = sigOf(L);
    P = L.stages.map(st => ({ size: st.sizes[0], count: 1, dir: 1 }));
    arcsL = GS.el('g', {}, world); gapL = GS.el('g', {}, world); stonesL = GS.el('g', {}, world);
    labelsL = GS.el('g', {}, world); friendL = GS.el('g', {}, world); frogL = GS.el('g', {}, world); fxL = GS.el('g', {}, world);

    const ov = overview();
    cam = { cx: L.start * SP + (ov.cx - L.start * SP) * 0.2, z: Math.min(1, ov.z * 1.7) };

    // stones / crocodiles
    const emph = L.labels !== 'ends' && !L.tk;
    const whole = L.unit < 1 ? Math.round(1 / L.unit) : 0;   // fraction lines: whole numbers are the big stones
    for (let n = L.lo; n <= L.hi; n++) {
      if (L.crocs.has(n)) {
        const s = sprite(stonesL, n, 4, z => Math.min(uiK, 1.12 * z * Math.min(uiK, 1.25)));
        const bob = GS.el('g', { class: 'kt-bob', style: 'animation-delay:' + (-(n * 0.37) % 2.6).toFixed(2) + 's' }, s.el);
        GS.markup(bob, crocArt());
        crocEls[n] = s;
      } else {
        const major = whole ? n % whole === 0 : n % 10 === 0, minor = whole ? false : n % 5 === 0;
        const big = emph && major ? 1.16 : emph && minor ? 1.08 : 1;
        const s = sprite(stonesL, n, 0, z => stoneScale(z) * big);
        GS.markup(s.el, stoneArt(emph && (major || minor), L.tk ? n : null));
        stoneEls[n] = s;
      }
    }
    // target marker ring (none when the meeting stone is the question)
    if (!L.meet) {
      const ring = sprite(stonesL, L.target, -2, z => stoneScale(z) * 1.2);
      GS.el('ellipse', { class: 'kt-pulse', cx: 0, cy: -3, rx: 46, ry: 17, fill: 'none', stroke: '#FFF8EC', 'stroke-width': 5, 'stroke-dasharray': '10 8' }, ring.el);
      stonesL.insertBefore(ring.el, stonesL.firstChild);
    }

    // number labels (fading by level) + start/target pills
    for (let n = L.lo; n <= L.hi; n++) {
      if (n === L.start || (n === L.target && !L.meet)) continue;
      const s = sprite(labelsL, n, labelY, labelScale);
      GS.el('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': L.tk ? 34 : 36, 'font-weight': 600, fill: '#2B1D14', stroke: '#FFF8EC', 'stroke-width': 7, 'paint-order': 'stroke', 'stroke-linejoin': 'round', class: 'gs-num' }, s.el).textContent = fmt(n);
      s.el.style.transition = 'opacity 500ms ease-out';
      labelEls[n] = s;
    }
    pill(L.start, '#1F6FD1');
    if (!L.meet) pill(L.target, '#F28C28');
    updateLabels();

    friend = makeFrog(friendL, 'kt-kiki', KIKI, true);
    friend.n = L.meet ? L.start : L.target; friend.base = -60; friend.face = L.meet ? 1 : L.target >= L.start ? -1 : 1;
    if (!L.meet) camFns.push(() => { friend.off = (L.target >= L.start ? 1 : -1) * 30; });
    frog = makeFrog(frogL, 'kt-kodi', KODI, false);
    frog.n = L.start; frog.face = L.target >= L.start ? 1 : -1;
    frog.baseFn = frogBase;

    buildPanel();
    lockPanel(false);
    hud.mood('happy');
    layout();
    const tk = token;
    if (!demo) GS.say(L.say);
    setTimeout(() => { if (tk === token) camTween(ov, 1100, 'inOutCubic'); }, T(500));
  }

  /* ---------------- worked example (GS.demo, SOP docs/CONTOH.md) ----------------
   * The ghost hand plans the hops on the real panel with OTHER numbers and presses Lompat!,
   * while Chuppy thinks aloud. Challenge levels only replay on request (auto: false). */
  function demoSpec(i) {
    return {
      key: 'L' + (i + 1),
      auto: !/^Tantangan/.test(makeLevel(i).say),
      build: () => buildLevel(i, true),
      script: async d => {
        await d.wait(1300);                      // let the camera settle on the line
        await d.say(L.say);
        const sol = solution();
        for (let si = 0; si < sol.length; si++) {
          const want = sol[si], ref = panelRefs[si];
          if (L.dir && want.dir != null && P[si].dir !== want.dir) await d.tap(ref.dirBtns[want.dir > 0 ? 1 : 0]);
          const pad = ref.pads.find(b => +b.dataset.size === want.size);
          if (pad && P[si].size !== want.size) await d.tap(pad);
          let guard = 40;
          while (P[si].count < want.count && guard--) await d.tap(ref.plus);
          while (P[si].count > want.count && guard--) await d.tap(ref.minus);
        }
        await d.say(demoLine(sol), 2600);
        await d.tap(goBtn);
        await d.success(60000);
      }
    };
  }
  function demoLine(sol) {
    if (L.meet) return 'Kodi dan Kiki sama-sama sampai di ' + fmt(L.target) + '.';
    const parts = sol.map(p => (L.dir && p.dir < 0 ? 'mundur ' : '') + 'lompat ' + fmt(p.size) + ' sebanyak ' + p.count + ' kali');
    return (L.tk ? '' : 'Dari ' + fmt(L.start) + ', ') + parts.join(', lalu ') + '.';
  }

  function pill(n, color) {
    const s = sprite(labelsL, n, labelY, labelScale);
    const txt = fmt(n), w = 28 + txt.length * 21;
    GS.el('rect', { x: -w / 2, y: -25, width: w, height: 50, rx: 25, fill: '#FFF8EC', stroke: color, 'stroke-width': 5 }, s.el);
    GS.el('text', { x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 36, fill: '#2B1D14', class: 'gs-num' }, s.el).textContent = txt;
    return s;
  }
  /** Label every k-th stone, k chosen so the numerals never overlap at the overview zoom. */
  function labelStep(z) {
    const len = Math.max(fmt(L.lo).length, fmt(L.hi).length);
    const need = (len * 21 + 16) * labelScale(z), gap = SP * z;
    // label steps that land on round values (halves/wholes, thousands on a 500-line)
    const steps = L.unit < 1 ? [1, 2, 4, 8] : L.unit === 500 ? [2, 4, 10, 20] : [1, 2, 5, 10, 20, 50];
    return steps.find(k => k * gap >= need) || steps[steps.length - 1];
  }
  function labelVisible(n) {
    const z = overview().z;
    const near = m => Math.abs(n - m) * SP * z < (fmt(m).length * 21 + 40) * labelScale(z);
    if (near(L.start) || (!L.meet && near(L.target))) return false;
    const step = labelStep(z);
    if (restored) return n % step === 0;
    if (L.labels === 'ends') return false;
    const k = L.labels === 'auto' ? step : Math.max(L.labels, step);
    return n % k === 0;
  }
  function updateLabels() {
    for (const k in labelEls) labelEls[k].el.style.opacity = labelVisible(+k) ? 1 : 0;
  }

  /* ---------------- effects ---------------- */
  function ripple(n, big) {
    const s = sprite(fxL, n, 2, () => 1);
    const e = GS.el('ellipse', { cx: 0, cy: 0, rx: 40, ry: 10, fill: 'none', stroke: '#E6F5F0', 'stroke-width': 4, 'vector-effect': 'non-scaling-stroke' }, s.el);
    const kk = big ? 1.6 : 1.1;
    return GS.tween(T(520), e2 => {
      s.k = () => (0.35 + e2 * kk) * frogScale(cam.z); s.place();
      e.setAttribute('opacity', (1 - e2).toFixed(2));
    }).then(() => { s.el.remove(); unreg(s.place); });
  }
  function splashFx(n) {
    GS.sfx.splash();
    ripple(n, true); setTimeout(() => ripple(n, true), T(160));
    const s = sprite(fxL, n, -4, () => frogScale(cam.z));
    const drops = [];
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.28, v = 120 + (k % 3) * 40;
      drops.push({ el: GS.el('circle', { r: 5 + (k % 3) * 2, fill: k % 2 ? '#8FD3E3' : '#E6F5F0', stroke: '#2F80C9', 'stroke-width': 1.6 }, s.el), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 1.4 });
    }
    return GS.tween(T(650), (e, p) => {
      const t = p * 1.1;
      drops.forEach(d => { d.el.setAttribute('cx', (d.vx * t).toFixed(1)); d.el.setAttribute('cy', (d.vy * t - d.vy / 1.1 * t * t).toFixed(1)); d.el.setAttribute('opacity', (1 - p * 0.8).toFixed(2)); });
    }, 'linear').then(() => { s.el.remove(); unreg(s.place); });
  }

  /* ---------------- hopping ---------------- */
  function maxArc() { return clamp(Y0 - 70, 90, 260); }
  async function hop(f, n1, badge, stageIdx, last) {
    const tk = token;
    const n0 = f.n, dz = n1 - n0;
    if (dz) f.face = sgn(dz);
    const Ls = Math.abs(dz) * SP * cam.z;
    const H = clamp(46 + Ls * 0.42, 56, maxArc() + (f === friend ? -50 : 0));
    // camera follows if the landing would leave the view
    const sx = screenX(n1);
    let pan = null;
    if (sx < 90 || sx > 1190) pan = { from: cam.cx, to: n1 * SP + sgn(dz) * 300 / cam.z };
    // anticipation squash
    await GS.tween(T(90), e => { f.sx = 1 + 0.14 * e; f.sy = 1 - 0.2 * e; f.place(); });
    if (tk !== token) return;
    hopSound();
    const path = GS.el('polyline', { points: '', fill: 'none', stroke: OUT, 'stroke-width': 3.4, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round', opacity: 0.6, 'vector-effect': 'non-scaling-stroke' }, arcsL);
    const pts = [];
    const z0 = cam.z;
    const dur = clamp(300 + Ls * 0.3, 320, 600);
    f.ground = false;
    await GS.tween(T(dur), (e, p) => {
      f.n = lerp(n0, n1, p);
      f.hy = H * 4 * p * (1 - p);
      const st = 0.15 * Math.abs(1 - 2 * p);
      f.sy = 1 + st; f.sx = 1 - st * 0.6;
      f.rot = -16 * (1 - 2 * p);
      if (pan) { cam.cx = lerp(pan.from, pan.to, GS.ease.inOutCubic(p)); applyCamera(); } else f.place();
      pts.push((f.n * SP).toFixed(1) + ',' + ((f.base - f.hy * 0.92 - 18) / z0).toFixed(1));
      path.setAttribute('points', pts.join(' '));
    }, 'linear');
    if (tk !== token) return;
    f.n = n1; f.hy = 0; f.rot = 0; f.ground = true;
    trail.push(path);
    // hop counter badge at the top of the arc
    const bk = clamp(Math.abs(dz) * SP * cam.z / 50, 0.85, 1);
    // tiny hops: only the last badge of the row, so the counters never pile up
    if (Ls < 44 * uiK && !last) { ripple(n1); await GS.tween(T(120), (e, p) => { const q = p < 0.5 ? p * 2 : (1 - p) * 2; f.sy = 1 - 0.18 * q; f.sx = 1 + 0.16 * q; f.place(); }); f.sx = f.sy = 1; f.place(); return; }
    const b = sprite(arcsL, (n0 + n1) / 2, f.base - H * 0.92 - 18 - 28 * bk * uiK, () => bk * uiK);
    GS.el('circle', { r: 24, fill: stageIdx ? '#FFE08A' : '#FFF8EC', stroke: OUT, 'stroke-width': 3 }, b.el);
    GS.el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 1, 'font-size': 34, fill: '#2B1D14', class: 'gs-num' }, b.el).textContent = badge;
    trail.push(b.el);
    GS.tween(T(220), e => { b.k = () => bk * uiK * GS.ease.outBack(e); b.place(); });
    ripple(n1);
    await GS.tween(T(160), (e, p) => {
      const q = p < 0.5 ? p * 2 : (1 - p) * 2;
      f.sy = 1 - 0.18 * q; f.sx = 1 + 0.16 * q; f.place();
    });
    f.sx = f.sy = 1; f.place();
  }

  /** Build the list of landings from the locked plan. */
  function landings() {
    const out = []; let pos = L.start, idx = 0;
    P.forEach((p, si) => {
      const dir = L.dir ? p.dir : 1;
      // meet levels: row 1 is Kodi, row 2 is Kiki, both start from the same stone
      if (L.meet && si === 1) { pos = L.start; idx = 0; }
      const f = L.meet && si === 1 ? friend : frog;
      for (let k = 1; k <= p.count; k++) { pos += dir * p.size; out.push({ n: pos, k, si, idx: ++idx, f }); }
    });
    return out;
  }

  async function leap() {
    const list = landings();
    if (!list.length) { GS.sfx.oops(); GS.say('Atur berapa kali Kodi lompat dulu, ya.'); return; }
    busy = true;
    const tk = token;
    lockPanel(true);
    hud.mood('think');
    clearTrail();
    await sleep(120);
    for (const h of list) {
      if (L.meet && h.f === friend && h.k === 1) await sleep(250);
      await hop(h.f, h.n, h.k, h.si, h.k === P[h.si].count);
      if (tk !== token) return;
      GS.sfx.count(h.idx);
      if (h.f === frog && (h.n < L.lo || h.n > L.hi)) return fail('water', h.n);
      if (h.f === frog && L.crocs.has(h.n)) return fail('croc', h.n);
      await sleep(50);
    }
    if (L.meet) return frog.n === friend.n ? success() : fail('meet', frog.n);
    if (frog.n === L.target) return success();
    return fail('miss', frog.n);
  }

  function clearTrail() {
    const old = trail; trail = [];
    old.forEach(el => { el.style.transition = 'opacity 300ms'; el.style.opacity = 0; setTimeout(() => el.remove(), 320); });
    gapL.innerHTML = '';
  }

  /* ---------------- outcomes ---------------- */
  async function fail(kind, pos) {
    const tk = token;
    tries++;
    if (tries === 2) run.offerDemo();
    hud.mood('oops');
    let line;
    if (kind === 'water' || kind === 'croc') {
      const c = crocEls[pos];
      if (c) { c.el.classList.add('kt-wink'); setTimeout(() => c.el.classList.remove('kt-wink'), T(1400)); }
      splashFx(pos);
      await GS.tween(T(320), e => { frog.hy = -26 * e; frog.sy = 1 - 0.4 * e; frog.alpha = 1 - e; frog.place(); }, 'inCubic');
      if (tk !== token) return;
      line = kind === 'croc' ? 'Byur! Ada buaya di situ. Cari batu yang aman.' : 'Byur! Kodi tercebur. Coba lagi, ya!';
    } else if (kind === 'meet') {
      GS.sfx.oops();
      showGap(pos, null, friend.n, 'selisih ' + fmt(Math.abs(friend.n - pos)));
      GS.fx(frog.squash, 'gs-wobble', 450);
      line = 'Belum bertemu. Kodi di ' + fmt(pos) + ', Kiki di ' + fmt(friend.n) + '.';
    } else {
      GS.sfx.oops();
      const want = sgn(L.target - L.start), went = sgn(pos - L.start);
      const d = (pos - L.target) * want;
      showGap(pos, went !== want && pos !== L.target && went !== 0 ? null : d);
      GS.fx(frog.squash, 'gs-wobble', 450); // squash has its own transform: wobble an inner <g>
      if (went !== want && went !== 0) line = 'Temanmu ada di arah sebaliknya. Coba lagi, ya!';
      else if (d < 0) line = 'Hampir! Kurang ' + fmtV(-d * L.unit) + ' lagi. Coba lagi, ya!';
      else line = 'Wah, kelewatan ' + fmtV(d * L.unit) + '. Coba lagi, ya!';
    }
    if (tries >= 2) {
      if (!restored) { restored = true; updateLabels(); }
      line += ' ' + L.hint;
    }
    GS.say(line);
    await sleep(kind === 'miss' || kind === 'meet' ? 1700 : 700);
    if (tk !== token) return;
    if (L.meet) friendHome();
    await returnHome(kind === 'water' || kind === 'croc');
    if (tk !== token) return;
    busy = false;
    lockPanel(false);
    hud.mood('think');
  }

  function friendHome() {
    const n0 = friend.n;
    if (n0 === L.start) return Promise.resolve();
    friend.face = -1;
    return GS.tween(T(600), e => { friend.n = lerp(n0, L.start, e); friend.hy = 60 * 4 * e * (1 - e); friend.place(); }, 'inOutCubic')
      .then(() => { friend.hy = 0; friend.face = 1; friend.place(); });
  }
  async function returnHome(fromWater) {
    const tk = token;
    const ov = overview();
    if (fromWater) {
      frog.n = L.start; frog.face = sgn(L.target - L.start) || 1;
      await camTween(ov, 500);
      frog.alpha = 1; frog.hy = -20; frog.ground = true;
      ripple(L.start);
      GS.sfx.boing();
      await GS.tween(T(380), e => { frog.hy = -20 + 20 * e; frog.sy = 0.7 + 0.3 * e; frog.place(); }, 'outBack');
      frog.sy = 1; frog.place();
      return;
    }
    if (frog.n === L.start) return;
    GS.sfx.whoosh();
    const n0 = frog.n, Ls = Math.abs(n0 - L.start) * SP * cam.z;
    const H = clamp(60 + Ls * 0.25, 70, maxArc());
    frog.face = sgn(L.start - n0); frog.ground = false;
    const from = { cx: cam.cx, z: cam.z };
    await GS.tween(T(clamp(420 + Ls * 0.3, 450, 800)), (e, p) => {
      frog.n = lerp(n0, L.start, e);
      frog.hy = H * 4 * e * (1 - e);
      frog.rot = -10 * (1 - 2 * e);
      cam.cx = lerp(from.cx, ov.cx, e); cam.z = lerp(from.z, ov.z, e);
      applyCamera();
    }, 'inOutCubic');
    if (tk !== token) return;
    frog.n = L.start; frog.hy = 0; frog.rot = 0; frog.ground = true;
    frog.face = sgn(L.target - L.start) || 1;
    ripple(L.start);
    GS.sfx.drop();
    await GS.tween(T(200), (e, p) => { const q = p < 0.5 ? p * 2 : (1 - p) * 2; frog.sy = 1 - 0.18 * q; frog.sx = 1 + 0.14 * q; frog.place(); });
    frog.sx = frog.sy = 1; frog.place();
  }

  /** Amber gap between where Kodi stopped and the friend, with "kurang n" / "lebih n". */
  function showGap(pos, d, other, label) {
    gapL.innerHTML = '';
    const tgt = other != null ? other : L.target;
    const a = Math.min(pos, tgt), b = Math.max(pos, tgt);
    const band = GS.el('rect', { fill: '#F2A900', opacity: 0.42, rx: 0 }, gapL);
    const brk = GS.el('path', { fill: 'none', stroke: '#F2A900', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '3 10', 'vector-effect': 'non-scaling-stroke' }, gapL);
    const text = label || (d == null ? 'ke sana' : d < 0 ? 'kurang ' + fmtV(-d * L.unit) : 'lebih ' + fmtV(d * L.unit));
    const tag = sprite(gapL, (a + b) / 2, -150, () => uiK);
    const dotsOnly = L.tk && d != null && Math.abs(d) <= 10;     // TK: show the gap as dots, no reading
    const w = dotsOnly ? Math.min(5, Math.abs(d)) * 14 + 30 : text.length * 17 + 40;
    GS.el('rect', { x: -w / 2, y: dotsOnly && Math.abs(d) > 5 ? -30 : -27, width: w, height: dotsOnly && Math.abs(d) > 5 ? 60 : 54, rx: 27, fill: '#FFF8EC', stroke: '#F2A900', 'stroke-width': 5 }, tag.el);
    const arrowDir = sgn(tgt - pos);
    if (dotsOnly) GS.markup(tag.el, dotsArt(Math.abs(d), Math.abs(d) > 5 ? -6 : 0, 5, 14).replace(/#FFF8EC/g, '#F2A900'));
    else GS.el('text', { y: 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 30, 'font-weight': 700, fill: '#2B1D14', class: 't-body' }, tag.el).textContent = text;
    GS.el('path', { d: 'M' + (arrowDir * (w / 2 + 6)) + ' -10l' + (arrowDir * 14) + ' 10l' + (-arrowDir * 14) + ' 10Z', fill: '#F2A900', stroke: OUT, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, tag.el);
    const upd = () => {
      const z = cam.z, pad = 0.42 * SP;
      band.setAttribute('x', a * SP - pad); band.setAttribute('width', (b - a) * SP + 2 * pad);
      band.setAttribute('y', -18 / z); band.setAttribute('height', 52 / z);
      const h = Math.min(110, maxArc() - 40) / z, y0 = -30 / z;
      brk.setAttribute('d', 'M' + a * SP + ' ' + y0 + 'C' + a * SP + ' ' + (y0 - h) + ' ' + b * SP + ' ' + (y0 - h) + ' ' + b * SP + ' ' + y0);
      tag.ys = -30 - Math.min(110, maxArc() - 40) * 0.75 - 26; tag.place();
    };
    upd(); camFns.push(upd);
    gapL.style.opacity = 0;
    GS.tween(T(260), e => { gapL.style.opacity = e; });
  }

  function sentenceLines() {
    const F = n => fmt(n), used = P.filter(p => p.count > 0), r = F(frog.n);
    if (L.sentence === 'meet') return [P[0].count + ' × ' + F(P[0].size) + ' = ' + r, P[1].count + ' × ' + F(P[1].size) + ' = ' + r];
    if (L.sentence === 'divrem') {
      const q = P[0].count, d = F(P[0].size), rest = P[1].count * P[1].size;
      return [q + ' × ' + d + ' + ' + F(rest) + ' = ' + r, r + ' : ' + d + ' = ' + q + ' sisa ' + F(rest)];
    }
    if (used.length === 1) {
      const p = used[0], dir = L.dir ? p.dir : 1, op = dir > 0 ? '+' : '−', sz = p.size * L.unit;
      if (L.sentence === 'div') return [p.count + ' × ' + F(p.size) + ' = ' + r, r + ' : ' + F(p.size) + ' = ' + p.count];
      if (sz === 1 && L.sentence !== 'mul') return [F(L.start) + ' ' + op + ' ' + p.count + ' = ' + r];
      if (L.start === 0 && dir > 0) {
        const lines = [];
        if (p.count > 1 && p.count <= 8) lines.push(Array(p.count).fill(F(p.size)).join(' + ') + ' = ' + r);
        lines.push(p.count + ' × ' + F(p.size) + ' = ' + r);
        return lines;
      }
    }
    let s = F(L.start);
    used.forEach(p => {
      const op = (L.dir ? p.dir : 1) > 0 ? '+' : '−';
      if (p.size * L.unit === 1) s += ' ' + op + ' ' + p.count;
      else if (p.count >= 3) s += ' ' + op + ' ' + p.count + ' × ' + F(p.size);
      else for (let k = 0; k < p.count; k++) s += ' ' + op + ' ' + F(p.size);
    });
    if (s.startsWith('0 + ')) s = s.slice(4);
    return [s + ' = ' + r];
  }

  function showStrip(lines) {
    uiL.innerHTML = '';
    const g = GS.el('g', {}, uiL);
    const card = GS.el('rect', { rx: 26, fill: '#FFF8EC', stroke: OUT, 'stroke-width': 4 }, g);
    const mk = (ln, k, last) => {
      const t = GS.el('text', { x: 0, y: 48 + k * 64, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': last ? 56 : 44, fill: last ? '#2B1D14' : '#6B5444', class: 'gs-num' }, g);
      t.textContent = ln;
      return t;
    };
    const width = ts => ts.reduce((w, t) => { try { return Math.max(w, t.getComputedTextLength()); } catch (e) { return Math.max(w, t.textContent.length * 28); } }, 0);
    let texts = lines.map((ln, k) => mk(ln, k, k === lines.length - 1));
    let w = width(texts);
    if (lines.length > 1 && 1220 / (w + 60) < 0.82) {   // long repeated sum: keep only the short sentence
      texts.forEach(t => t.remove());
      lines = lines.slice(-1); texts = [mk(lines[0], 0, true)]; w = width(texts);
    }
    const scale = Math.min(1, 1220 / (w + 60));
    const h = 32 + lines.length * 64;
    card.setAttribute('x', -(w / 2 + 30)); card.setAttribute('y', 8); card.setAttribute('width', w + 60); card.setAttribute('height', h);
    // below the caption zone (top-left ~130 u) when the frogs leave room, else at the top
    const y = Math.max(10, Math.min(136, Y0 - 150 * uiK - h * scale));
    GS.tween(T(420), e => g.setAttribute('transform', 'translate(640 ' + y.toFixed(1) + ') scale(' + (scale * (0.6 + 0.4 * e)).toFixed(3) + ')'), 'outBack');
    g.setAttribute('transform', 'translate(640 ' + y.toFixed(1) + ') scale(' + (scale * 0.6) + ')');
  }

  async function success() {
    const tk = token;
    hud.mood('cheer');
    await sleep(300);
    if (tk !== token) return;
    GS.sfx.coin();
    friend.root.classList.add('kt-happy'); frog.root.classList.add('kt-happy');
    const jump = (f, h, d) => GS.tween(T(d), (e, p) => { f.hy = h * 4 * p * (1 - p); f.ground = true; f.place(); }, 'linear');
    for (let k = 0; k < 2; k++) {
      GS.sfx.boing();
      await Promise.all([jump(friend, 70, 420), jump(frog, 50, 420)]);
      if (tk !== token) return;
    }
    const lines = sentenceLines();
    showStrip(lines);
    GS.sfx.pop();
    GS.say('Tepat! ' + speakSentence(lines[lines.length - 1]) + '.');
    await sleep(2600);
    if (tk !== token) return;
    // both frogs hop off home together
    const dir = sgn(L.target - L.start) || 1;
    friend.face = dir; frog.face = dir;
    const go = (f, dist, h) => {
      const n0 = f.n;
      return GS.tween(T(520), (e, p) => { f.n = n0 + dist * p; f.hy = h * 4 * p * (1 - p); f.alpha = 1 - Math.max(0, p - 0.6) * 1.5; f.place(); }, 'linear');
    };
    const step = 2.2 / Math.max(cam.z, 0.3);
    GS.sfx.whoosh();
    await Promise.all([go(friend, dir * step, 80), go(frog, dir * step, 90)]);
    if (tk !== token) return;
    const stars = tries === 0 ? 3 : tries <= 2 ? 2 : 1;
    const msgs = ['Tepat! Kodi bertemu temannya.', 'Hore, Kodi sampai!', 'Lompatanmu pas sekali!'];
    run.win(stars, msgs[L.i % msgs.length]);
  }

  /* ---------------- debug hook (harmless) ---------------- */
  window.__game = {
    go: i => run.go(i),
    get level() { return L; },
    get plan() { return P; },
    get busy() { return busy; },
    setSpeed(f) { speed = f; },
    speed(n) { speed = 1 / Math.max(1, n); },
    count: () => LEVELS,
    tier: TIER,
    setPlan(stages) { stages.forEach((s, si) => { if (s.size != null) setSize(si, s.size); if (s.dir != null && L.dir) setDir(si, s.dir); if (s.count != null) setCount(si, s.count); }); },
    solve() { if (busy) return Promise.resolve(); window.__game.setPlan(solution()); return leap(); },
    solution
  };

  run.go(GS.store.nextLevel(GAME, LEVELS));
})();
