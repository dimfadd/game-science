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
  const ZMIN = 0.17;
  const LEVELS = 10;
  let speed = 1;              // test hook can shorten animations
  const T = ms => ms * speed;
  const sleep = ms => GS.wait(T(ms));

  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const hud = GS.hud({ gameId: GAME, title: 'Lompat Katak', levelCount: LEVELS, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS, hud, start: buildLevel });
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
  const frogScale = z => clamp(0.42 + 0.58 * z, 0.56, 1);
  const stoneScale = z => Math.min(1, 1.05 * z);
  const labelScale = z => (z < 0.45 ? 0.84 : 1);
  function hopSound() { if (GS.tone) GS.tone({ f: 330, f2: 560, t: 0.09, type: 'triangle', vol: 0.07 }); }
  function sprite(parent, n, ys, k, cls) {
    const g = GS.el('g', { class: cls || null }, parent);
    const s = { el: g, n, ys, k };
    const fn = () => g.setAttribute('transform', 'translate(' + (s.n * SP).toFixed(2) + ' ' + (s.ys / cam.z).toFixed(2) + ') scale(' + (s.k(cam.z) / cam.z).toFixed(4) + ')');
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
    const z = clamp(1140 / ((b - a + 2.8) * SP), ZMIN, 1);
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
    if (n === 100) return 'seratus';
    if (n < 200) return 'seratus ' + words(n - 100);
    return String(n);
  }
  function speakSentence(s) {
    return s.split(' ').map(t => (t === '+' ? 'tambah' : t === '−' ? 'kurang' : t === '×' ? 'kali' : t === '=' ? 'sama dengan' : words(+t))).join(' ');
  }

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
  function stoneArt(emph) {
    const id = 'kt-st' + (++stoneN);
    return '<defs><clipPath id="' + id + '"><path d="' + STONE + '"/></clipPath></defs>' +
      '<ellipse cx="2" cy="8" rx="44" ry="9" fill="#2F80C9" opacity="0.35"/>' +
      '<path d="' + STONE + '" fill="#63666B"/>' +
      '<g clip-path="url(#' + id + ')"><path d="' + STONE + '" fill="#8C8F94" transform="translate(-3 -5)"/>' +
      '<ellipse cx="-14" cy="-9" rx="13" ry="4" fill="#B6B9BD"/>' +
      (emph ? '<ellipse cx="14" cy="-8" rx="11" ry="4.5" fill="#7CC26B"/><ellipse cx="11" cy="-10" rx="5" ry="2" fill="#A8DB8F"/>' : '') + '</g>' +
      '<path d="' + STONE + '" fill="none" stroke="' + OUT + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M-40 6q7 -3 14 0t14 0t14 0t14 0t14 0t14 0" fill="none" stroke="#E6F5F0" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>';
  }

  /* ---------------- background + lane (screen space) ---------------- */
  function drawBackground() {
    bgL.innerHTML = ''; laneL.innerHTML = '';
    const top = Y0 - 62;              // top of the pematang
    // sky + hills fallback extends into letterbox bands
    GS.el('rect', { x: -1400, y: -1200, width: 4080, height: top + 1300, fill: '#9ED8EC' }, bgL);
    if (art.scene) {
      try { GS.markup(GS.el('g', { transform: 'translate(0 ' + (top + 8 - 624) + ')' }, bgL), art.scene('sawah', 1280, 800)); } catch (e) { /* art not ready */ }
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
    const r = plan.getBoundingClientRect();
    let panelTop = 800;
    if (r.height > 0) panelTop = GS.svgPoint(svg, r.left + r.width / 2, r.top).y;
    const y = Math.round(clamp(panelTop - 84, 178, 470));
    if (y !== Y0 || !bgL.firstChild) { Y0 = y; drawBackground(); }
    applyCamera();
  }
  let rzT = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(rzT); rzT = requestAnimationFrame(layout); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  /* ---------------- level definitions ---------------- */
  function makeLevel(i) {
    const R = GS.rand;
    const d = { i, start: 0, target: 0, lo: 0, hi: 12, stages: [{ sizes: [1] }], dir: true, labels: 'all', crocs: new Set(), solve: null };
    switch (i) {
      case 0: d.target = R(4, 9); d.hi = Math.max(10, d.target + 3); d.dir = false;
        d.say = 'Bantu Kodi lompat ke temannya. Berapa lompatan?';
        d.hint = 'Hitung lompatannya satu per satu.'; break;
      case 1: d.start = R(8, 12); d.target = d.start - R(3, 6); d.hi = d.start + 3;
        d.say = 'Temannya ada di belakang. Lompat mundur, ya!';
        d.hint = 'Pilih panah mundur, lalu hitung lompatannya.'; break;
      case 2: d.target = 2 * R(4, 8); d.hi = d.target + 4; d.stages = [{ sizes: [2] }];
        d.say = 'Sekali lompat, dua batu. Berapa kali lompat?';
        d.hint = 'Lompat dua: dua, empat, enam, terus.'; break;
      case 3: d.target = 5 * R(3, 6); d.hi = d.target + 4; d.stages = [{ sizes: [1, 2, 5] }];
        for (let n = 1; n <= d.hi; n++) if (n % 5) d.crocs.add(n);
        d.say = 'Awas buaya! Pilih lompatan yang aman.';
        d.hint = 'Batu yang aman: lima, sepuluh, lima belas.'; break;
      case 4: d.target = 10 * R(3, 6); d.hi = d.target + 8; d.stages = [{ sizes: [1, 2, 5, 10] }]; d.labels = 'five';
        d.say = 'Jauh sekali! Coba lompatan sepuluh.';
        d.hint = 'Lompat sepuluh: sepuluh, dua puluh, tiga puluh.'; break;
      case 5: d.target = R(23, 48); d.hi = d.target + 8; d.stages = [{ sizes: [10] }, { sizes: [1] }]; d.labels = 'five'; d.dir = false;
        d.say = 'Lompat sepuluh dulu, lalu lompat satu.';
        d.hint = 'Puluhan dulu dengan lompat sepuluh, lalu sisanya.'; break;
      case 6: d.start = R(6, 11); d.target = d.start + R(4, 7); d.hi = d.target + 4; d.stages = [{ sizes: [1, 2] }]; d.labels = 'five';
        d.say = 'Kodi mulai dari tengah. Berapa lompatan lagi?';
        d.hint = 'Mulai dari batu Kodi, lalu hitung lanjut.'; break;
      case 7: d.start = R(13, 18); d.target = d.start - R(6, 9); d.hi = d.start + 3; d.stages = [{ sizes: [1, 2, 5] }]; d.labels = 'five';
        d.say = 'Kodi mau pulang. Lompat mundur ke temannya.';
        d.hint = 'Mundur, lalu hitung lompatannya satu per satu.'; break;
      case 8: { d.start = R(32, 44); const a = R(2, 3), b = R(3, 8); d.target = d.start + 10 * a + b;
        d.lo = d.start - 4; d.hi = d.target + 6; d.stages = [{ sizes: [10] }, { sizes: [1, 2, 5] }]; d.labels = 'ends'; d.dir = false;
        d.say = 'Batunya tanpa angka. Rencanakan lompatanmu!';
        d.hint = 'Coba lompat sepuluh dulu, lalu sisanya.'; break; }
      case 9: default: {
        d.stages = [{ sizes: [1, 2, 5, 10] }]; d.labels = 'ends';
        if (Math.random() < 0.5) {
          // only hop 2 is safe: crocs on some odd stones, target is not a multiple of 5
          d.target = GS.shuffle([12, 14, 16, 18])[0];
          const odds = []; for (let n = 1; n < d.target; n += 2) odds.push(n);
          GS.shuffle(odds).slice(0, 4).forEach(n => d.crocs.add(n));
          d.crocs.add(d.target + 1);
          d.safe = 2;
        } else {
          // hop 5 (and 10) are safe: crocs on odd and on even non-multiples of 5
          d.target = GS.shuffle([20, 30])[0];
          const odds = [], evens = [];
          for (let n = 1; n < d.target; n++) if (n % 5) (n % 2 ? odds : evens).push(n);
          GS.shuffle(odds).slice(0, 3).forEach(n => d.crocs.add(n));
          GS.shuffle(evens).slice(0, 3).forEach(n => d.crocs.add(n));
          d.crocs.add(d.target + 2);
          d.safe = 5;
        }
        d.hi = d.target + 5;
        d.say = 'Banyak buaya! Pilih lompatan yang aman.';
        d.hint = 'Lihat buayanya. Ukuran lompatan mana yang melewati semua?';
      }
    }
    return d;
  }

  /** The intended plan (used by the debug hook). */
  function solution() {
    const diff = L.target - L.start, dir = sgn(diff), m = Math.abs(diff);
    if (L.stages.length === 2) {
      const tens = Math.floor(m / 10), ones = m % 10;
      return L.stages[1].sizes.includes(5) && ones === 5
        ? [{ size: 10, count: tens, dir: 1 }, { size: 5, count: 1, dir: 1 }]
        : [{ size: 10, count: tens, dir: 1 }, { size: 1, count: ones, dir: 1 }];
    }
    const size = L.safe || (L.i === 2 ? 2 : L.i === 3 ? 5 : L.i === 4 ? 10 : 1);
    return [{ size, count: m / size, dir }];
  }

  /* ---------------- planning panel ---------------- */
  const ARROW = d => '<svg viewBox="0 0 40 26" aria-hidden="true"><path d="' + (d > 0 ? 'M5 13h27M22 4l10 9-10 9' : 'M35 13H8M18 4 8 13l10 9') + '" fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
  function padSVG(s) {
    // lily pad with a notch; under the number a ruler of 10 dots with an arc as long as the hop
    let dots = '';
    for (let k = 0; k <= 10; k++) dots += '<circle cx="' + (23 + k * 5.4) + '" cy="80" r="2.1" fill="#FFF8EC"/>';
    const x1 = 23 + s * 5.4, hgt = 6 + s * 1.2;
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="ring" cx="50" cy="52" r="49" fill="none" stroke="#1F6FD1" stroke-width="6"/>' +
      '<path d="M50 54L77 21.8A42 42 0 1 1 57.3 12.6Z" fill="#357F40"/>' +
      '<path d="M48 51L75 18.8A42 42 0 1 1 55.3 9.6Z" fill="#4DAA57"/>' +
      '<ellipse cx="30" cy="30" rx="14" ry="8" fill="#86CC8C" transform="rotate(-30 30 30)"/>' +
      '<path d="M50 54L77 21.8A42 42 0 1 1 57.3 12.6Z" fill="none" stroke="' + OUT + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<text x="50" y="62" text-anchor="middle" font-family="Fredoka, Baloo 2, sans-serif" font-weight="600" font-size="40" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="6" paint-order="stroke" stroke-linejoin="round">' + s + '</text>' +
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
    const cap = t => { const c = document.createElement('div'); c.className = 'kt-cap'; c.textContent = t; plan.appendChild(c); };
    if (two) cap('');
    if (L.dir) cap('arah');
    cap('lompatan');
    cap('berapa kali');
    L.stages.forEach((st, si) => {
      const ref = {};
      if (two) {
        const lead = document.createElement('div');
        lead.className = 'kt-lead' + (si ? ' chip' : '');
        lead.textContent = si ? 'lalu' : '';
        plan.appendChild(lead);
      }
      if (L.dir) {
        const g = document.createElement('div'); g.className = 'kt-group';
        ref.dirBtns = [-1, 1].map(d => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'kt-dirbtn';
          b.innerHTML = ARROW(d) + '<span>' + (d > 0 ? 'maju' : 'mundur') + '</span>';
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
        b.innerHTML = padSVG(s);
        b.setAttribute('aria-label', 'Lompatan ' + s);
        b.dataset.size = s;
        b.addEventListener('click', () => setSize(si, s));
        sg.appendChild(b);
        return b;
      });
      plan.appendChild(sg);
      const cg = document.createElement('div'); cg.className = 'kt-group';
      const minus = GS.button('kt-step', 'Kurangi lompatan', MINUS, () => setCount(si, P[si].count - 1));
      const num = document.createElement('div'); num.className = 'kt-num'; num.setAttribute('aria-live', 'polite');
      const plus = GS.button('kt-step', 'Tambah lompatan', PLUS, () => setCount(si, P[si].count + 1));
      cg.append(minus, num, plus);
      plan.appendChild(cg);
      Object.assign(ref, { minus, plus, num });
      panelRefs.push(ref);
    });
    refreshPanel();
  }
  const countRange = si => (L.stages.length === 2 ? [0, 9] : [1, 12]);
  function refreshPanel() {
    P.forEach((p, si) => {
      const r = panelRefs[si];
      if (!r) return;
      r.pads.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.size === p.size)));
      if (r.dirBtns) r.dirBtns.forEach((b, k) => b.setAttribute('aria-pressed', String((k ? 1 : -1) === p.dir)));
      r.num.textContent = p.count;
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
  function buildLevel(i) {
    token++;
    world.innerHTML = ''; uiL.innerHTML = '';
    camFns = []; stoneEls = {}; crocEls = {}; labelEls = {}; trail = [];
    tries = 0; busy = false; restored = false; stoneN = 0; crocN = 0;
    L = makeLevel(i);
    P = L.stages.map(st => ({ size: st.sizes.length === 1 ? st.sizes[0] : st.sizes[0], count: 1, dir: 1 }));
    arcsL = GS.el('g', {}, world); gapL = GS.el('g', {}, world); stonesL = GS.el('g', {}, world);
    labelsL = GS.el('g', {}, world); friendL = GS.el('g', {}, world); frogL = GS.el('g', {}, world); fxL = GS.el('g', {}, world);

    const ov = overview();
    cam = { cx: L.start * SP + (ov.cx - L.start * SP) * 0.2, z: Math.min(1, ov.z * 1.7) };

    // stones / crocodiles
    const emph = L.labels !== 'ends';
    for (let n = L.lo; n <= L.hi; n++) {
      if (L.crocs.has(n)) {
        const s = sprite(stonesL, n, 4, z => Math.min(1, 1.12 * z));
        const bob = GS.el('g', { class: 'kt-bob', style: 'animation-delay:' + (-(n * 0.37) % 2.6).toFixed(2) + 's' }, s.el);
        GS.markup(bob, crocArt());
        crocEls[n] = s;
      } else {
        const big = emph && n % 10 === 0 ? 1.16 : emph && n % 5 === 0 ? 1.08 : 1;
        const s = sprite(stonesL, n, 0, z => stoneScale(z) * big);
        GS.markup(s.el, stoneArt(emph && n % 5 === 0));
        stoneEls[n] = s;
      }
    }
    // target marker ring
    const ring = sprite(stonesL, L.target, -2, z => stoneScale(z) * 1.2);
    GS.el('ellipse', { class: 'kt-pulse', cx: 0, cy: -3, rx: 46, ry: 17, fill: 'none', stroke: '#FFF8EC', 'stroke-width': 5, 'stroke-dasharray': '10 8' }, ring.el);
    stonesL.insertBefore(ring.el, stonesL.firstChild);

    // number labels (fading by level) + start/target pills
    for (let n = L.lo; n <= L.hi; n++) {
      if (n === L.start || n === L.target) continue;
      const s = sprite(labelsL, n, 66, labelScale);
      GS.el('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 30, 'font-weight': 600, fill: '#2B1D14', stroke: '#FFF8EC', 'stroke-width': 7, 'paint-order': 'stroke', 'stroke-linejoin': 'round', class: 'gs-num' }, s.el).textContent = n;
      s.el.style.transition = 'opacity 500ms ease-out';
      labelEls[n] = s;
    }
    pill(L.start, '#1F6FD1');
    pill(L.target, '#F28C28');
    updateLabels();

    friend = makeFrog(friendL, 'kt-kiki', KIKI, true);
    friend.n = L.target; friend.base = -60; friend.face = L.target >= L.start ? -1 : 1;
    camFns.push(() => { friend.off = (L.target >= L.start ? 1 : -1) * 30; });
    frog = makeFrog(frogL, 'kt-kodi', KODI, false);
    frog.n = L.start; frog.face = L.target >= L.start ? 1 : -1;
    frog.baseFn = frogBase;

    buildPanel();
    lockPanel(false);
    hud.mood('happy');
    layout();
    const tk = token;
    GS.say(L.say);
    setTimeout(() => { if (tk === token) camTween(ov, 1100, 'inOutCubic'); }, T(500));
  }

  function pill(n, color) {
    const s = sprite(labelsL, n, 66, labelScale);
    const w = String(n).length > 1 ? 62 : 46;
    GS.el('rect', { x: -w / 2, y: -21, width: w, height: 42, rx: 21, fill: '#FFF8EC', stroke: color, 'stroke-width': 5 }, s.el);
    GS.el('text', { x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 30, fill: '#2B1D14', class: 'gs-num' }, s.el).textContent = n;
    return s;
  }
  function labelVisible(n) {
    const z = overview().z;
    if (Math.min(Math.abs(n - L.start), Math.abs(n - L.target)) * SP * z < 50 * labelScale(z)) return false;
    if (restored) return z * SP >= 34 || n % 5 === 0;
    if (L.labels === 'all') return true;
    if (L.labels === 'five') return n % 5 === 0;
    return false;
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
      drops.forEach(d => { d.el.setAttribute('cx', (d.vx * t).toFixed(1)); d.el.setAttribute('cy', (d.vy * t + 380 * t * t).toFixed(1)); d.el.setAttribute('opacity', (1 - p * 0.8).toFixed(2)); });
    }, 'linear').then(() => { s.el.remove(); unreg(s.place); });
  }

  /* ---------------- hopping ---------------- */
  function maxArc() { return clamp(Y0 - 70, 90, 260); }
  async function hop(n1, badge, stageIdx) {
    const tk = token;
    const n0 = frog.n, dz = n1 - n0;
    if (dz) frog.face = sgn(dz);
    const Ls = Math.abs(dz) * SP * cam.z;
    const H = clamp(46 + Ls * 0.42, 56, maxArc());
    // camera follows if the landing would leave the view
    const sx = screenX(n1);
    let pan = null;
    if (sx < 90 || sx > 1190) pan = { from: cam.cx, to: n1 * SP + sgn(dz) * 300 / cam.z };
    // anticipation squash
    await GS.tween(T(90), e => { frog.sx = 1 + 0.14 * e; frog.sy = 1 - 0.2 * e; frog.place(); });
    if (tk !== token) return;
    hopSound();
    const path = GS.el('polyline', { points: '', fill: 'none', stroke: OUT, 'stroke-width': 3.4, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round', opacity: 0.6, 'vector-effect': 'non-scaling-stroke' }, arcsL);
    const pts = [];
    const z0 = cam.z;
    const dur = clamp(300 + Ls * 0.3, 320, 600);
    frog.ground = false;
    await GS.tween(T(dur), (e, p) => {
      frog.n = lerp(n0, n1, p);
      frog.hy = H * 4 * p * (1 - p);
      const st = 0.15 * Math.abs(1 - 2 * p);
      frog.sy = 1 + st; frog.sx = 1 - st * 0.6;
      frog.rot = -16 * (1 - 2 * p);
      if (pan) { cam.cx = lerp(pan.from, pan.to, GS.ease.inOutCubic(p)); applyCamera(); } else frog.place();
      pts.push((frog.n * SP).toFixed(1) + ',' + ((frogBase() - frog.hy * 0.92 - 18) / z0).toFixed(1));
      path.setAttribute('points', pts.join(' '));
    }, 'linear');
    if (tk !== token) return;
    frog.n = n1; frog.hy = 0; frog.rot = 0; frog.ground = true;
    trail.push(path);
    // hop counter badge at the top of the arc
    const bk = clamp(Math.abs(dz) * SP * cam.z / 36, 0.5, 1);
    const b = sprite(arcsL, (n0 + n1) / 2, frogBase() - H * 0.92 - 18 - 22 * bk, () => bk);
    GS.el('circle', { r: 17, fill: stageIdx ? '#FFE08A' : '#FFF8EC', stroke: OUT, 'stroke-width': 3 }, b.el);
    GS.el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 1, 'font-size': 21, fill: '#2B1D14', class: 'gs-num' }, b.el).textContent = badge;
    trail.push(b.el);
    GS.tween(T(220), e => { b.k = () => bk * GS.ease.outBack(e); b.place(); });
    ripple(n1);
    await GS.tween(T(160), (e, p) => {
      const q = p < 0.5 ? p * 2 : (1 - p) * 2;
      frog.sy = 1 - 0.18 * q; frog.sx = 1 + 0.16 * q; frog.place();
    });
    frog.sx = frog.sy = 1; frog.place();
  }

  /** Build the list of landings from the locked plan. */
  function landings() {
    const out = []; let pos = L.start, idx = 0;
    P.forEach((p, si) => {
      const dir = L.dir ? p.dir : 1;
      for (let k = 1; k <= p.count; k++) { pos += dir * p.size; out.push({ n: pos, k, si, idx: ++idx }); }
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
      await hop(h.n, h.k, h.si);
      if (tk !== token) return;
      GS.sfx.count(h.idx);
      if (h.n < L.lo || h.n > L.hi) return fail('water', h.n);
      if (L.crocs.has(h.n)) return fail('croc', h.n);
      await sleep(50);
    }
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
    hud.mood('oops');
    let line;
    if (kind === 'water' || kind === 'croc') {
      const c = crocEls[pos];
      if (c) { c.el.classList.add('kt-wink'); setTimeout(() => c.el.classList.remove('kt-wink'), T(1400)); }
      splashFx(pos);
      await GS.tween(T(320), e => { frog.hy = -26 * e; frog.sy = 1 - 0.4 * e; frog.alpha = 1 - e; frog.place(); }, 'inCubic');
      if (tk !== token) return;
      line = kind === 'croc' ? 'Byur! Ada buaya di situ. Cari batu yang aman.' : 'Byur! Kodi tercebur. Coba lagi, ya!';
    } else {
      GS.sfx.oops();
      const want = sgn(L.target - L.start), went = sgn(pos - L.start);
      const d = (pos - L.target) * want;
      showGap(pos, went !== want && pos !== L.target && went !== 0 ? null : d);
      frog.squash.classList.add('gs-wobble');
      setTimeout(() => frog.squash.classList.remove('gs-wobble'), 450);
      if (went !== want && went !== 0) line = 'Temanmu ada di arah sebaliknya. Coba lagi, ya!';
      else if (d < 0) line = 'Hampir! Kurang ' + (-d) + ' lagi. Coba lagi, ya!';
      else line = 'Wah, kelewatan ' + d + '. Coba lagi, ya!';
    }
    if (tries >= 2) {
      if (L.labels !== 'all' && !restored) { restored = true; updateLabels(); }
      line += ' ' + L.hint;
    }
    GS.say(line);
    await sleep(kind === 'miss' ? 1700 : 700);
    if (tk !== token) return;
    await returnHome(kind !== 'miss');
    if (tk !== token) return;
    busy = false;
    lockPanel(false);
    hud.mood('think');
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
  function showGap(pos, d) {
    gapL.innerHTML = '';
    const a = Math.min(pos, L.target), b = Math.max(pos, L.target);
    const band = GS.el('rect', { fill: '#F2A900', opacity: 0.42, rx: 0 }, gapL);
    const brk = GS.el('path', { fill: 'none', stroke: '#F2A900', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '3 10', 'vector-effect': 'non-scaling-stroke' }, gapL);
    const text = d == null ? 'ke sana' : d < 0 ? 'kurang ' + (-d) : 'lebih ' + d;
    const tag = sprite(gapL, (a + b) / 2, -150, () => 1);
    const w = text.length * 15 + 36;
    GS.el('rect', { x: -w / 2, y: -24, width: w, height: 48, rx: 24, fill: '#FFF8EC', stroke: '#F2A900', 'stroke-width': 5 }, tag.el);
    const arrowDir = sgn(L.target - pos);
    GS.el('text', { y: 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 26, 'font-weight': 700, fill: '#2B1D14', class: 't-body' }, tag.el).textContent = text;
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
    const used = P.filter(p => p.count > 0);
    const r = L.target;
    if (used.length === 1) {
      const p = used[0], dir = L.dir ? p.dir : 1, op = dir > 0 ? '+' : '−';
      if (p.size === 1) return [L.start + ' ' + op + ' ' + p.count + ' = ' + r];
      if (L.start === 0 && dir > 0) {
        const lines = [];
        if (p.count > 1) lines.push(Array(p.count).fill(p.size).join(' + ') + ' = ' + r);
        lines.push(p.count + ' × ' + p.size + ' = ' + r);
        return lines;
      }
    }
    let s = String(L.start);
    used.forEach(p => {
      const op = (L.dir ? p.dir : 1) > 0 ? '+' : '−';
      if (p.size === 1) s += ' ' + op + ' ' + p.count;
      else for (let k = 0; k < p.count; k++) s += ' ' + op + ' ' + p.size;
    });
    if (s.startsWith('0 + ')) s = s.slice(4);
    return [s + ' = ' + r];
  }

  function showStrip(lines) {
    uiL.innerHTML = '';
    const g = GS.el('g', {}, uiL);
    const card = GS.el('rect', { rx: 26, fill: '#FFF8EC', stroke: OUT, 'stroke-width': 4 }, g);
    const texts = lines.map((ln, k) => {
      const t = GS.el('text', { x: 0, y: 46 + k * 60, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': k === lines.length - 1 ? 50 : 38, fill: k === lines.length - 1 ? '#2B1D14' : '#6B5444', class: 'gs-num' }, g);
      t.textContent = ln;
      return t;
    });
    let w = 0;
    texts.forEach(t => { try { w = Math.max(w, t.getComputedTextLength()); } catch (e) { w = Math.max(w, t.textContent.length * 26); } });
    const scale = Math.min(1, 1160 / (w + 60));
    const h = 26 + lines.length * 60;
    card.setAttribute('x', -(w / 2 + 30)); card.setAttribute('y', 8); card.setAttribute('width', w + 60); card.setAttribute('height', h);
    GS.tween(T(420), e => g.setAttribute('transform', 'translate(640 14) scale(' + (scale * (0.6 + 0.4 * e)).toFixed(3) + ')'), 'outBack');
    g.setAttribute('transform', 'translate(640 14) scale(' + (scale * 0.6) + ')');
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
    setPlan(stages) { stages.forEach((s, si) => { if (s.size != null) setSize(si, s.size); if (s.dir != null && L.dir) setDir(si, s.dir); if (s.count != null) setCount(si, s.count); }); },
    solve() { window.__game.setPlan(solution()); return leap(); },
    solution
  };

  run.go(GS.store.nextLevel(GAME, LEVELS));
})();
