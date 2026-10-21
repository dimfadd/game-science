/* Bengkel Kayu (tukang)
 * Pak Darto's woodworking workshop. The child measures, marks, saws and fits real pieces;
 * the build itself judges the work (truthful geometry, no answer snapping):
 * - A cut is exactly where the saw stops, snapped only to the tier's stated precision
 *   (TK half a block, k1/k2/k4 1 cm, k3 1 mm). A piece fits its slot when |piece - slot| <= 0.45 step.
 *   Too short: a gap stays and the piece droops and falls (a table rocks). Too long: it does not
 *   go in (it rests on the posts, the table tilts) and can be trimmed again. A too-short piece is
 *   wasted; the rest of the plank slides back to the bench stop.
 * - Unit blocks and hand spans are laid end to end from the bench stop (a stop rail pushes them
 *   together); a unit that hangs past the end of the plank falls off.
 * - Angles: a wedge (gusset) fits a corner only when its angle equals the corner's angle; a
 *   frame of hinged sticks takes the glass only when its corner is 90 degrees.
 * - Nets fold for real (every hinge turns 90 degrees, 3D transforms), the box is closed only
 *   when the six faces cover the six sides of the box once each.
 * - Regular polygons: equal sticks turn by the set angle at every joint; the frame closes only
 *   when n x turn = 360 degrees.
 * - Volume and paint: cubes fill the crate layer by layer, paint covers the net square by square.
 * Spec: docs/baru/tukang.md (KURIKULUM section). */
(function () {
  'use strict';
  const GAME = 'tukang';
  const TIER = (window.GS && GS.tier) ? GS.tier() : 'k1';
  const TK = TIER === 'tk';
  const OL = '#3B2A20', INK = '#2B1D14', CREAM = '#FFF8EC', TEAL = '#0F8C7A', AMBER = '#F2A900', BLUE = '#2F80C9', ORANGE = '#F28C28';
  const WOOD = ['#DDA669', '#F0C690', '#B57C45'];        // fresh plank
  const DARK = ['#A8673A', '#C68654', '#7E4A27'];        // sample, posts
  const PALE = ['#E9C893', '#F7E2BC', '#C9A065'];        // sticks, plywood
  const LIFT = 40;
  let SPEED = 1;
  const wait = v => GS.wait(v / SPEED);
  const tween = (d, fn, e) => GS.tween(d / SPEED, fn, e);
  const R = (a, b) => GS.rand(a, b);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const coin = () => Math.random() < 0.5;
  const n1 = v => Math.round(v * 10) / 10;
  const clamp = GS.clamp;
  const fxr = () => (GS.fxRandom ? GS.fxRandom() : Math.random());
  const deg = Math.PI / 180;
  const hasArt = fn => !!(window.GS && GS.art && typeof GS.art[fn] === 'function');
  function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
  /** Draw from gen() until ok(v) holds (bounded; deterministic under a seeded Math.random). */
  function draw(gen, ok) { let v = gen(); for (let k = 0; k < 80 && ok && !ok(v); k++) v = gen(); return v; }
  const fmt = v => String(Math.round(v * 10) / 10).replace('.', ',');

  /* ================= text and art (Kampung Chunky) ================= */
  function Tc(x, y, s, size, o) {
    o = o || {};
    return '<text x="' + n1(x) + '" y="' + n1(y + size * 0.35) + '" font-size="' + size + '" text-anchor="' + (o.anchor || 'middle') + '" fill="' + (o.fill || INK) + '"' +
      (o.body ? ' class="t-body" font-weight="700"' : ' font-weight="600" style="font-variant-numeric:tabular-nums"') +
      (o.decor ? ' data-qc="decor"' : '') + (o.op != null ? ' opacity="' + o.op + '"' : '') + (o.rot ? ' transform="rotate(' + o.rot + ' ' + n1(x) + ' ' + n1(y) + ')"' : '') + '>' + s + '</text>';
  }
  const shadowEl = (cx, cy, rx) => '<ellipse cx="' + n1(cx) + '" cy="' + n1(cy) + '" rx="' + n1(rx) + '" ry="' + n1(Math.max(3, rx * 0.16)) + '" fill="' + OL + '" opacity=".18"/>';
  /** A plank (3 tones, grain, end grain), top-left at x,y. */
  function plankM(x, y, w, h, pal, seed, o) {
    o = o || {};
    pal = pal || WOOD;
    if (w <= 0) return '';
    const r = rng(seed || Math.round(w * 7 + h));
    const rx = Math.min(7, h * 0.18, w / 2);
    let s = '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" rx="' + n1(rx) + '" fill="' + pal[2] + '"/>' +
      '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h * 0.84) + '" rx="' + n1(rx) + '" fill="' + pal[0] + '"/>' +
      '<rect x="' + n1(x + Math.min(8, w * 0.1)) + '" y="' + n1(y + h * 0.12) + '" width="' + n1(Math.max(0, Math.min(w * 0.45, w - 16))) + '" height="' + n1(Math.max(2, h * 0.1)) + '" rx="2" fill="' + pal[1] + '" opacity=".85"/>';
    if (!o.plain && w > 40) {
      let d = '';
      const lines = h > 30 ? 3 : 2;
      for (let i = 0; i < lines; i++) {
        const yy = y + h * (0.3 + i * 0.2) + r() * 4, a = x + 10 + r() * w * 0.2, b = x + w * (0.5 + r() * 0.4);
        d += 'M' + n1(a) + ' ' + n1(yy) + 'Q' + n1((a + b) / 2) + ' ' + n1(yy + (r() - 0.5) * 6) + ' ' + n1(Math.min(b, x + w - 8)) + ' ' + n1(yy);
      }
      if (w > 120 && h > 30) { const kx = x + w * (0.25 + r() * 0.5), ky = y + h * 0.5; d += 'M' + n1(kx - 9) + ' ' + n1(ky) + 'a9 5 0 1 0 18 0a9 5 0 1 0 -18 0'; }
      s += '<path d="' + d + '" stroke="' + pal[2] + '" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>';
    }
    s += '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" rx="' + n1(rx) + '" fill="none" stroke="' + OL + '" stroke-width="' + (o.sw || 3) + '"/>';
    return s;
  }
  /** Unit block (TK, k1): a small wooden cube seen from the front, w wide. */
  function blockM(x, y, w, h, c) {
    c = c || ['#4DAA57', '#86CC8C', '#357F40'];
    return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" rx="8" fill="' + c[2] + '"/>' +
      '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w - 4) + '" height="' + n1(h - 5) + '" rx="8" fill="' + c[0] + '"/>' +
      '<rect x="' + n1(x + 7) + '" y="' + n1(y + 6) + '" width="' + n1(w * 0.4) + '" height="6" rx="3" fill="' + c[1] + '"/>' +
      '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" rx="8" fill="none" stroke="' + OL + '" stroke-width="3"/>';
  }
  /** Hand span (jengkal) seen from above: thumb tip at x, little finger tip at x + w. */
  function handM(x, y, w, skin) {
    skin = skin || ['#E3AE82', '#F0CBA6', '#B97A4E'];
    const h = w * 0.5, cy = y + h * 0.62;
    const p = (u, v) => n1(x + u * w) + ' ' + n1(cy - v * h);
    // palm in the middle, thumb to the left, little finger to the right, three fingers up
    let d = 'M' + p(0, 0.05) + 'Q' + p(0.02, 0.18) + ' ' + p(0.12, 0.16) + 'L' + p(0.3, 0.12) + 'L' + p(0.32, 0.55) + 'Q' + p(0.34, 0.8) + ' ' + p(0.4, 0.78) +
      'Q' + p(0.45, 0.76) + ' ' + p(0.44, 0.45) + 'L' + p(0.47, 0.88) + 'Q' + p(0.5, 1) + ' ' + p(0.55, 0.98) + 'Q' + p(0.59, 0.95) + ' ' + p(0.57, 0.5) +
      'L' + p(0.62, 0.82) + 'Q' + p(0.66, 0.92) + ' ' + p(0.7, 0.88) + 'Q' + p(0.73, 0.82) + ' ' + p(0.69, 0.4) + 'L' + p(0.86, 0.2) + 'Q' + p(0.97, 0.12) + ' ' + p(1, 0.05) +
      'Q' + p(0.99, -0.04) + ' ' + p(0.9, -0.02) + 'L' + p(0.7, 0.02) + 'Q' + p(0.55, -0.32) + ' ' + p(0.36, -0.18) + 'L' + p(0.12, -0.06) + 'Q' + p(0.01, -0.06) + ' ' + p(0, 0.05) + 'Z';
    return '<path d="' + d + '" fill="' + skin[0] + '" stroke="' + OL + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M' + p(0.4, 0.1) + 'Q' + p(0.5, 0.2) + ' ' + p(0.62, 0.1) + '" stroke="' + skin[2] + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<circle cx="' + n1(x + 2) + '" cy="' + n1(cy - 0.05 * h) + '" r="5" fill="' + BLUE + '" stroke="' + OL + '" stroke-width="2"/><circle cx="' + n1(x + w - 2) + '" cy="' + n1(cy - 0.05 * h) + '" r="5" fill="' + BLUE + '" stroke="' + OL + '" stroke-width="2"/>';
  }
  function sawM(o) {
    o = o || {};
    // blade cutting edge at x = 0, from y = 0 (top of plank) downwards; handle above
    let s = '<path d="M-10 -70L10 -70L10 70L-10 74Z" fill="#C9CED3" stroke="' + OL + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path d="M-6 -60L-6 66" stroke="#EEF2F5" stroke-width="3" stroke-linecap="round"/>';
    let teeth = 'M-10 74';
    for (let i = 0; i < 7; i++) teeth += 'l3.3 -6l3.3 6';
    s += '<path d="' + teeth + '" fill="none" stroke="#63666B" stroke-width="2"/>';
    s += '<path d="M-34 -150Q-40 -150 -40 -142L-40 -78Q-40 -70 -32 -70L32 -70Q40 -70 40 -78L40 -142Q40 -150 34 -150Z" fill="' + DARK[2] + '"/>' +
      '<path d="M-34 -150Q-40 -150 -40 -142L-40 -80Q-40 -74 -32 -74L28 -74Q36 -74 36 -80L36 -142Q36 -150 30 -150Z" fill="' + DARK[0] + '"/>' +
      '<rect x="-20" y="-134" width="40" height="40" rx="14" fill="#5A3B22"/>' +
      '<rect x="-30" y="-146" width="30" height="7" rx="3.5" fill="' + DARK[1] + '"/>' +
      '<path d="M-34 -150Q-40 -150 -40 -142L-40 -78Q-40 -70 -32 -70L32 -70Q40 -70 40 -78L40 -142Q40 -150 34 -150Z" fill="none" stroke="' + OL + '" stroke-width="3.2"/>' +
      '<rect x="-20" y="-134" width="40" height="40" rx="14" fill="none" stroke="' + OL + '" stroke-width="2.6"/>';
    return s;
  }
  function nudgeM(dir) {
    const d = dir < 0 ? 'M8 -16L-10 0L8 16' : 'M-8 -16L10 0L-8 16';
    return '<circle r="44" fill="' + OL + '" opacity=".16" cy="5"/><circle r="44" fill="' + CREAM + '" stroke="' + OL + '" stroke-width="3.2"/>' +
      '<path d="' + d + '" stroke="' + OL + '" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="' + d + '" stroke="' + ORANGE + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
  }
  function chip(x, y, t, o) {
    o = o || {};
    const fs = o.fs || 40, w = Math.max(56, t.length * fs * 0.56 + 24);
    return '<rect x="' + n1(x - w / 2) + '" y="' + n1(y - fs * 0.64) + '" width="' + n1(w) + '" height="' + n1(fs * 1.28) + '" rx="' + n1(fs * 0.42) + '" fill="' + (o.bg || CREAM) + '" stroke="' + (o.stroke || OL) + '" stroke-width="2.6"/>' + Tc(x, y, t, fs, { fill: o.fill, body: o.body });
  }
  const dotsM = (x, y, n, r, c) => { let s = ''; const sp = r * 2.6; for (let i = 0; i < n; i++) s += '<circle cx="' + n1(x + (i - (n - 1) / 2) * sp) + '" cy="' + n1(y) + '" r="' + r + '" fill="' + (c || INK) + '"/>'; return s; };
  function personM(i, x, y, s, flip) {
    if (!hasArt('person')) return '';
    try { return '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -s : s) + ' ' + s + ')"><g class="tk-breathe">' + GS.art.person(i) + '</g></g>'; } catch (e) { return ''; }
  }

  /* ================= stage ================= */
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const bgG = GS.el('g', { class: 'tk-bg' }, svg);
  drawBackground(bgG);
  const world = GS.el('g', { class: 'tk-world' }, svg);
  const BENCH_TOP = 452, PLANK_Y = 462, PLANK_H = 58, RULER_Y = 530, RULER_H = 74, X0 = 150;

  function drawBackground(g) {
    let s = '';
    // back wall: vertical boards
    s += '<rect x="-600" y="0" width="2480" height="800" fill="#CFA06C"/>';
    const r = rng(23);
    for (let x = -600; x < 1880; x += 86) {
      const c = ['#D6A874', '#C99761', '#D2A26C'][Math.floor(r() * 3)];
      s += '<rect x="' + x + '" y="0" width="84" height="800" fill="' + c + '"/><path d="M' + (x + 84) + ' 0V800" stroke="#A8743F" stroke-width="3" opacity=".6"/>';
      s += '<circle cx="' + (x + 42) + '" cy="' + (60 + Math.floor(r() * 3) * 40) + '" r="3" fill="#8A5A36" opacity=".6"/>';
    }
    // windows to the kampung, only on the wide edges
    [[-420, 110], [1480, 110]].forEach(([wx, wy]) => {
      s += '<rect x="' + wx + '" y="' + wy + '" width="300" height="220" rx="10" fill="#9ED8EC"/><path d="M' + wx + ' ' + (wy + 170) + 'Q' + (wx + 150) + ' ' + (wy + 130) + ' ' + (wx + 300) + ' ' + (wy + 170) + 'V' + (wy + 220) + 'H' + wx + 'Z" fill="#7CC26B"/>' +
        '<circle cx="' + (wx + 220) + '" cy="' + (wy + 60) + '" r="26" fill="#FFE08A"/><rect x="' + wx + '" y="' + wy + '" width="300" height="220" rx="10" fill="none" stroke="#7E4A27" stroke-width="14"/><path d="M' + (wx + 150) + ' ' + wy + 'V' + (wy + 220) + 'M' + wx + ' ' + (wy + 110) + 'H' + (wx + 300) + '" stroke="#7E4A27" stroke-width="10"/>';
    });
    // tool rack (pegboard strip) high on the wall
    s += '<rect x="-600" y="40" width="2480" height="16" fill="#8A5A36" opacity=".55"/>';
    const tools = [[-160, 'hammer'], [40, 'square'], [1180, 'clamp'], [1360, 'hammer']];
    tools.forEach(([tx, t]) => {
      s += '<g transform="translate(' + tx + ' 56)" opacity=".75">';
      if (t === 'hammer') s += '<rect x="-6" y="0" width="12" height="110" rx="5" fill="#A8673A"/><rect x="-30" y="0" width="60" height="26" rx="6" fill="#8C8F94"/>';
      else if (t === 'square') s += '<path d="M0 0V130H70V116H14V0Z" fill="#8C8F94"/>';
      else s += '<path d="M-30 0H30V18H14V90H30V108H-30V90H-14V18H-30Z" fill="#2F80C9"/>';
      s += '</g>';
    });
    // floor
    s += '<rect x="-600" y="700" width="2480" height="110" fill="#B9874F"/><rect x="-600" y="700" width="2480" height="10" fill="#9C6C3A"/>';
    for (let x = -600; x < 1880; x += 140) s += '<path d="M' + x + ' 712L' + (x - 30) + ' 800" stroke="#9C6C3A" stroke-width="3" opacity=".6"/>';
    // sawdust and offcuts on the floor
    for (let i = 0; i < 40; i++) s += '<ellipse cx="' + n1(-580 + r() * 2440) + '" cy="' + n1(730 + r() * 60) + '" rx="' + n1(3 + r() * 6) + '" ry="2" fill="#F0D3A4" opacity=".8"/>';
    // workbench: top, apron, legs (the stop block at the left end)
    s += '<rect x="-600" y="' + (BENCH_TOP) + '" width="2480" height="170" fill="#E2B67C"/>';
    s += '<rect x="-600" y="' + (BENCH_TOP) + '" width="2480" height="8" fill="#F0CB94"/>';
    s += '<rect x="-600" y="622" width="2480" height="34" fill="#A8673A"/><rect x="-600" y="622" width="2480" height="6" fill="#C68654"/><rect x="-600" y="652" width="2480" height="4" fill="#7E4A27"/>';
    [-420, 40, 1240, 1700].forEach(x => { s += '<rect x="' + x + '" y="656" width="44" height="60" fill="#8A5A36"/><rect x="' + x + '" y="656" width="10" height="60" fill="#A8673A"/>'; });
    GS.markup(g, '<g class="gs-scene">' + s + '</g>');
  }

  /* ================= state ================= */
  let rounds = [], ri = 0, C = null, S = {};
  let tries = 0, busy = false, tok = 0, solving = false;
  let demoMode = false, demoSig = '';
  const layers = {};
  let btnMain = null, btnAlt = null;
  function miss() { tries++; if (tries === 2) run.offerDemo(); }
  function toScreen(x, y) { const m = svg.getScreenCTM(); if (!m) return null; const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; return pt.matrixTransform(m); }
  function floatAt(x, y, text) { const q = toScreen(x, y); if (q) GS.floatText(text, q.x, q.y); }
  const inBox = (b, p) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;

  /** Pointer handling: tap (moved <= 12 u) or drag. h = { start(p) -> false to refuse, move(p, p0), end(p, p0), tap(p) } */
  function grab(el, h) {
    let p0 = null, dragging = false;
    el.classList.add('tk-grab');
    GS.drag(el, {
      svg,
      onStart(p) { if (busy || (h.ok && !h.ok())) return false; p0 = p; dragging = false; return true; },
      onMove(p) {
        if (!p0 || busy) return;
        if (!dragging && Math.hypot(p.x - p0.x, p.y - p0.y) > 12) { dragging = true; if (h.start && h.start(p0) === false) { p0 = null; return; } }
        if (dragging && h.move) h.move(p, p0);
      },
      onEnd(p) {
        if (!p0) return;
        const a = p0; p0 = null;
        if (dragging) { dragging = false; if (h.end) h.end(p, a); } else if (h.tap && !busy) h.tap(p);
      }
    });
  }
  function hitRect(parent, x, y, w, h, name) {
    return GS.el('rect', { x: n1(x), y: n1(y), width: n1(w), height: n1(h), fill: 'transparent', class: 'tk-hit', 'data-hit': name || 'hit' }, parent);
  }
  function setT(el, x, y, extra) { el.setAttribute('transform', 'translate(' + n1(x) + ' ' + n1(y) + ')' + (extra || '')); }
  async function shake(el) { if (el) GS.fx(el, 'gs-wobble', 450); await wait(450); }

  /* ================= board (number sentence) and order card ================= */
  function setBoard(lines, done) {
    const g = layers.board;
    g.innerHTML = '';
    if (TK || !lines || !lines.length) return;
    const fs = lines.length > 1 ? 40 : 46;
    const w = Math.max(240, Math.max.apply(null, lines.map(l => l.length)) * fs * 0.55 + 60);
    const h = lines.length * (fs * 1.25) + 30, x = 640 - w / 2, y = 16;
    let s = '<rect x="' + n1(x + 4) + '" y="' + (y + 6) + '" width="' + n1(w) + '" height="' + n1(h) + '" rx="16" fill="' + OL + '" opacity=".18"/>' +
      '<rect x="' + n1(x) + '" y="' + y + '" width="' + n1(w) + '" height="' + n1(h) + '" rx="16" fill="#3F5A4A" stroke="' + OL + '" stroke-width="3.5"/>' +
      '<rect x="' + n1(x + 8) + '" y="' + (y + 8) + '" width="' + n1(w - 16) + '" height="' + n1(h - 16) + '" rx="10" fill="none" stroke="#A8673A" stroke-width="5"/>';
    lines.forEach((l, i) => { s += Tc(640, y + 15 + fs * 1.25 * (i + 0.5), l, fs, { fill: done ? '#BFF3E6' : '#FFF8EC' }); });
    GS.markup(g, s);
    if (done) GS.fx(g, 'gs-pulse', 900);
  }
  /** Pak Darto's order card (top centre): title + big line (+ small line). */
  function orderCard(big, small, o) {
    o = o || {};
    const g = layers.card;
    g.innerHTML = '';
    if (!big) return;
    const fs = o.fs || 52, w = Math.max(300, big.length * fs * 0.56 + 70, small ? small.length * 34 * 0.52 + 60 : 0), h = small ? 140 : 104;
    const x = 640 - w / 2, y = 14;
    let s = '<rect x="' + n1(x + 4) + '" y="' + (y + 6) + '" width="' + n1(w) + '" height="' + h + '" rx="16" fill="' + OL + '" opacity=".18"/>' +
      '<rect x="' + n1(x) + '" y="' + y + '" width="' + n1(w) + '" height="' + h + '" rx="16" fill="' + CREAM + '" stroke="' + OL + '" stroke-width="3"/>' +
      '<circle cx="640" cy="' + (y + 2) + '" r="8" fill="#E2453C" stroke="' + OL + '" stroke-width="2"/>' +
      Tc(640, y + 50, big, fs, { body: !!o.body });
    if (small) s += Tc(640, y + 106, small, 34, { body: true, fill: '#6B5444' });
    GS.markup(g, s);
  }


  // Speech only: units and degrees read as words (captions keep the symbols). A local wrapper.
  if (GS.speakable && !GS.speakable.__tukang) {
    const base = GS.speakable;
    GS.speakable = function (t) {
      return base(String(t).replace(/(\d),(\d)/g, '$1 koma $2').replace(/(\d)\s*:\s*(\d)/g, '$1 banding $2').replace(/°/g, ' derajat')
        .replace(/\bcm\b/g, 'sentimeter').replace(/\bmm\b/g, 'milimeter').replace(/(\d)\s*m\b/g, '$1 meter'));
    };
    GS.speakable.__tukang = true;
  }

  /* ================= rounds ================= */
  const sigOf = c => JSON.stringify(c, (k, v) => (typeof v === 'function' || k === 'say' ? undefined : v));
  function buildLevel(i, demo) {
    tries = 0; ri = 0;
    demoMode = !!demo;
    if (demo) { rounds = [DEMO[i]()]; demoSig = i + '#' + sigOf(rounds[0]); }
    else {
      rounds = LEVELS[i]();
      // the banks avoid the example's task; this loop is only a safety net
      for (let k = 0; k < 12 && rounds.some(r => i + '#' + sigOf(r) === demoSig); k++) rounds = LEVELS[i]();
    }
    startRound();
  }
  function startRound() {
    tok++; busy = false;
    C = rounds[ri]; S = {};
    world.innerHTML = '';
    ['build', 'bench', 'tools', 'pieces', 'ui', 'card', 'board', 'fx', 'drag'].forEach(k => { layers[k] = GS.el('g', { class: 'tk-' + k }, world); });
    layers.drag.setAttribute('pointer-events', 'none');
    dock.innerHTML = ''; btnMain = btnAlt = null;
    KINDS[C.kind]();
    updateDock();
    hud.mood('happy');
    if (!demoMode && C.say) GS.say(C.say);
  }
  async function roundDone(lines, text) {
    const my = tok;
    busy = true; updateDock();
    if (lines) setBoard(lines, true);
    hud.mood('cheer');
    GS.sfx.coin();
    if (text) GS.say(text);
    await wait(text ? Math.max(1800, text.length * 55) : 1500);
    if (my !== tok) return;
    nextRound();
  }
  function nextRound() {
    ri++;
    if (ri < rounds.length) { startRound(); return; }
    const stars = tries === 0 ? 3 : tries <= 2 ? 2 : 1;
    hud.mood('cheer');
    run.win(stars, pick(['Rapi sekali! Pak Darto senang.', 'Hebat, tukang kayu cilik!', 'Pas! Kayunya terpasang semua.']));
  }

  /* ================= dock ================= */
  function actionBtn(label, cls, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gs-action' + (cls ? ' ' + cls : '');
    b.innerHTML = '<span></span>';
    b.querySelector('span').textContent = label;
    b.addEventListener('click', () => { if (b.disabled || busy) return; GS.sfx.click(); fn(); });
    dock.appendChild(b);
    return b;
  }
  function setDock(label, fn) { btnMain = actionBtn(label, '', fn); }
  function setLabel(b, label) { if (b) b.querySelector('span').textContent = label; }
  function updateDock() {
    const ready = S.ready ? S.ready() : true;
    if (btnMain) btnMain.disabled = busy || !ready;
    if (btnAlt) btnAlt.disabled = busy;
  }

  /* ================= builds: where the pieces go =================
   * A slot is a segment from (x, y) along angle `ang` (degrees, 0 = right), `len` units long, drawn at
   * `bs` u per unit. The piece is judged only by its real length against the slot. */
  const BUILD = { x0: 430, x1: 1250, y0: 150, y1: 440 };
  function postM(x, y, w, h) { return plankM(x, y, w, h, DARK, Math.round(x + h), { plain: true }); }
  /** Fence/shelf rack: common left post, one rail slot per entry (top = first), each with its own right post. */
  function railBuild(list, bs, o) {
    o = o || {};
    const g = layers.build, maxL = Math.max.apply(null, list.map(e => e.len)), PW = 34;
    const th = o.th || Math.max(26, Math.min(46, bs * 0.9));
    const box = o.box || BUILD;
    const xL = Math.round((box.x0 + box.x1) / 2 - maxL * bs / 2), n = list.length;
    const sp = n > 1 ? Math.min(110, (box.y1 - box.y0 - 40) / n) : 0;
    const yTop = box.y0 + 10, yBot = box.y1 - 4;
    const ys = n > 1 ? list.map((e, i) => yTop + 50 + i * sp) : [(yTop + yBot) / 2];
    let s = shadowEl((box.x0 + box.x1) / 2, yBot + 2, maxL * bs / 2 + 60);
    s += postM(xL - PW, yTop, PW, yBot - yTop);
    list.forEach((e, i) => {
      const xr = xL + e.len * bs, y0 = n > 1 ? ys[i] - 40 : yTop;
      s += postM(xr, y0, PW, yBot - y0);
      // brackets that carry the rail
      s += '<rect x="' + n1(xL - 4) + '" y="' + n1(ys[i] + th / 2) + '" width="20" height="12" rx="3" fill="#63666B" stroke="' + OL + '" stroke-width="2"/>' +
        '<rect x="' + n1(xr - 16) + '" y="' + n1(ys[i] + th / 2) + '" width="20" height="12" rx="3" fill="#63666B" stroke="' + OL + '" stroke-width="2"/>';
      if (e.label) s += chip(xL + e.len * bs / 2, ys[i] - th / 2 - 30, e.label, { fs: 36 });
    });
    if (n === 1 && !o.noRails) {
      // the rails already in place above and below the gap (same length, they fit)
      const L = list[0].len * bs;
      s += plankM(xL, yTop + 22, L, th, WOOD, 11) + plankM(xL, yBot - 22 - th, L, th, WOOD, 12);
    }
    GS.markup(g, s);
    return list.map((e, i) => ({ type: 'h', x: xL, y: ys[i], ang: 0, len: e.len, bs, th, filled: false, idx: i, pre: e.pre || 0 }));
  }
  /** Table with three legs; the fourth (front right) is the slot. */
  function legBuild(len, bs, box) {
    box = box || BUILD;
    const g = layers.build, H = len * bs, W = 360, th = 30, cx = (box.x0 + box.x1) / 2;
    const yTop = box.y1 - 10 - H - th, x0 = cx - W / 2;
    const tab = GS.el('g', null, g);
    let s = shadowEl(cx, box.y1 - 8, W / 2 + 40);
    s += postM(x0 + 40, yTop + th - 4, 26, H + 4) + postM(x0 + W - 80, yTop + th - 4, 26, H + 4);   // back legs
    s += postM(x0 + 10, yTop + th - 4, 28, H + 4);                                                // front left
    s += plankM(x0 - 20, yTop, W + 40, th, DARK, 7);
    s += '<path d="M' + n1(x0 + W - 46) + ' ' + n1(yTop + th) + 'v' + n1(H) + '" stroke="' + OL + '" stroke-width="2.4" stroke-dasharray="8 8" opacity=".5"/>';
    GS.markup(tab, s);
    S.table = { g: tab, pivot: { x: x0 + 24, y: box.y1 - 10 }, W };
    return [{ type: 'leg', x: x0 + W - 46, y: yTop + th, ang: 90, len, bs, th: 28, filled: false, idx: 0 }];
  }
  /** Picture frame: the child cuts the top strip and the left strip; Pak Darto copies them. */
  function frameBuild(Wd, Ht, bs, box) {
    box = box || BUILD;
    const g = layers.build, w = Wd * bs, h = Ht * bs, th = 26, cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2 + 10;
    const x = cx - w / 2, y = cy - h / 2;
    let s = '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="#9ED8EC" stroke="' + OL + '" stroke-width="2.6"/>' +
      '<path d="M' + n1(x) + ' ' + n1(y + h) + 'L' + n1(x + w * 0.35) + ' ' + n1(y + h * 0.45) + 'L' + n1(x + w * 0.6) + ' ' + n1(y + h * 0.75) + 'L' + n1(x + w * 0.78) + ' ' + n1(y + h * 0.55) + 'L' + n1(x + w) + ' ' + n1(y + h) + 'Z" fill="#4DAA57" stroke="' + OL + '" stroke-width="2"/>' +
      '<circle cx="' + n1(x + w * 0.78) + '" cy="' + n1(y + h * 0.28) + '" r="' + n1(Math.min(w, h) * 0.1) + '" fill="#FFC83D" stroke="' + OL + '" stroke-width="2"/>';
    // dashed outline of where the strips go
    s += '<rect x="' + n1(x - th) + '" y="' + n1(y - th) + '" width="' + n1(w + 2 * th) + '" height="' + n1(h + 2 * th) + '" fill="none" stroke="' + OL + '" stroke-width="2.4" stroke-dasharray="10 8" opacity=".45"/>';
    GS.markup(g, s);
    S.frame = { x, y, w, h, th, bs };
    return [
      { type: 'h', x, y: y - th / 2, ang: 0, len: Wd, bs, th, filled: false, idx: 0, frame: 'top' },
      { type: 'v', x: x - th / 2, y, ang: 90, len: Ht, bs, th, filled: false, idx: 1, frame: 'left' }
    ];
  }
  /** Piece element: a plank drawn along +x from the local origin (left end, centre line). */
  function pieceEl(len, bs, th, pal, layer) {
    const el = GS.el('g', null, layer || layers.pieces);
    const inner = GS.el('g', null, el);
    GS.markup(inner, plankM(0, -th / 2, len * bs, th, pal || WOOD, Math.round(len * 13)));
    el.__len = len; el.__bs = bs; el.__th = th; el.__inner = inner;
    return el;
  }
  function placeEl(el, x, y, ang, sc) { el.setAttribute('transform', 'translate(' + n1(x) + ' ' + n1(y) + ') rotate(' + n1(ang || 0) + ')' + (sc && sc !== 1 ? ' scale(' + sc.toFixed(3) + ')' : '')); }
  function flyEl(el, a, b, dur, arc) {
    return tween(dur, e => {
      const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * (arc == null ? 80 : arc);
      const ang = (a.ang || 0) + ((b.ang || 0) - (a.ang || 0)) * e, sc = (a.sc || 1) + ((b.sc || 1) - (a.sc || 1)) * e;
      placeEl(el, x, y, ang, sc);
    }, 'inOutCubic');
  }
  const fitOf = (len, slotLen, tol) => (Math.abs(len - slotLen) <= tol + 1e-9 ? 'ok' : len < slotLen ? 'short' : 'long');
  /** Mark a gap (short) or an overrun (long) along a slot. */
  function markDiff(slot, len, layer) {
    const g = GS.el('g', null, layer || layers.fx);
    const a = slot.ang * deg, ux = Math.cos(a), uy = Math.sin(a);
    const p0 = len < slot.len ? len : slot.len, p1 = len < slot.len ? slot.len : len;
    const x0 = slot.x + ux * p0 * slot.bs, y0 = slot.y + uy * p0 * slot.bs, x1 = slot.x + ux * p1 * slot.bs, y1 = slot.y + uy * p1 * slot.bs;
    GS.markup(g, '<path d="M' + n1(x0) + ' ' + n1(y0) + 'L' + n1(x1) + ' ' + n1(y1) + '" stroke="' + AMBER + '" stroke-width="' + n1(slot.th + 14) + '" stroke-linecap="butt" opacity=".55"/>' +
      '<path d="M' + n1(x0) + ' ' + n1(y0) + 'L' + n1(x1) + ' ' + n1(y1) + '" stroke="' + OL + '" stroke-width="3" stroke-dasharray="7 6"/>');
    GS.fx(g, 'tk-glow');
    return g;
  }
  /** Bring a piece (already at its start position) into a slot and let the build judge it.
   *  Returns 'ok' | 'short' | 'long'. On 'ok' the piece stays; otherwise it is left for the caller. */
  async function fitInto(el, slot, from) {
    const my = tok, len = el.__len, res = fitOf(len, slot.len, C.tol);
    const sc = slot.bs / el.__bs;
    const at = { x: slot.x, y: slot.y, ang: slot.type === 'leg' ? 90 : slot.ang, sc };
    if (slot.type === 'h' && res === 'long') at.y = slot.y - slot.th - 8;       // it rests on top of the posts
    if (slot.type === 'leg' && res === 'long') at.y = slot.y;                  // pushed in, the table will tilt
    await flyEl(el, from, at, 650, 90);
    if (my !== tok) return res;
    if (res === 'ok') {
      GS.sfx.drop();
      for (let k = 0; k < 2; k++) { await wait(140); GS.sfx.tick(); }
      slot.filled = true;
      return res;
    }
    GS.sfx.oops();
    const mk = markDiff(slot, len);
    if (slot.type === 'leg') await tableRock(len, slot);
    else if (slot.type === 'h' && res === 'short') {
      // supported only at the left bracket: it droops and falls
      await tween(420, e => placeEl(el, at.x, at.y, at.ang + 18 * e * e, at.sc), 'inCubic');
      await tween(380, e => placeEl(el, at.x, at.y + 260 * e * e, at.ang + 18 + 30 * e, at.sc), 'inCubic');
    } else await shake(el);
    await wait(500);
    mk.remove();
    return res;
  }
  /** Truthful wobble: the table rotates until the odd leg (or the gap) touches the floor. */
  async function tableRock(len, slot) {
    const t = S.table; if (!t) return;
    const d = (slot.len - len) * slot.bs, ang = Math.atan2(d, t.W - 70) / deg;    // >0 short: tips forward
    const px = d > 0 ? t.pivot.x : t.pivot.x + t.W - 70, py = t.pivot.y;
    const rot = e => t.g.setAttribute('transform', 'rotate(' + n1(e) + ' ' + n1(px) + ' ' + n1(py) + ')');
    for (let k = 0; k < 3; k++) {
      await tween(200, e => rot(ang * e));
      GS.sfx.tick();
      await tween(200, e => rot(ang * (1 - e)));
    }
    t.g.removeAttribute('transform');
  }

  /* ================= kind: pick (choose the plank that fits) ================= */
  function buildPick() {
    const c = C, k = c.k;
    S.slots = railBuild(c.slots.map(len => ({ len })), k, { th: 46, noRails: c.slots.length > 1 });
    S.planks = [];
    const rows = c.planks.length, y0 = 470, sp = rows > 3 ? 62 : 74;
    c.planks.forEach((len, i) => {
      const x = 140 + (i % 2) * 18, y = y0 + i * sp + 23;
      const el = pieceEl(len, k, 46, WOOD);
      placeEl(el, x, y, 0);
      const hit = GS.el('rect', { x: -10, y: -46, width: len * k + 20, height: 92, fill: 'transparent' }, el);
      const p = { el, len, home: { x, y }, used: false, hit };
      S.planks.push(p);
      let off = null;
      grab(el, {
        ok: () => !p.used,
        start(p0) { off = { x: p0.x - p.home.x, y: p0.y - p.home.y }; GS.sfx.pick(); layers.drag.appendChild(el); },
        move(q) {
          const sl = slotNear(q);
          if (sl) placeEl(el, sl.x, sl.y - 16, 0, 1);            // preview: ends lined up at the left post
          else placeEl(el, q.x - off.x, q.y - off.y - LIFT, 0, 1.04);
        },
        end(q) { pickDrop(p, slotNear(q), q, off); }
      });
    });
    S.slotNear = slotNear;
    function slotNear(q) { return S.slots.find(s => !s.filled && q.y > s.y - 70 && q.y < s.y + 70 && q.x > s.x - 120 && q.x < s.x + s.len * k + 150); }
  }
  async function pickDrop(p, sl, q, off) {
    const my = tok;
    if (!sl) { layers.pieces.appendChild(p.el); await flyEl(p.el, { x: q.x - off.x, y: q.y - off.y - LIFT }, p.home, 240, 0); GS.sfx.tick(); return; }
    busy = true; updateDock();
    layers.pieces.appendChild(p.el);
    const res = await fitInto(p.el, sl, { x: sl.x, y: sl.y - 16 });
    if (my !== tok) return;
    if (res === 'ok') {
      p.used = true;
      if (C.slots.length === 1) { busy = false; return roundDone(null, TK ? 'Pas! Pagarnya rapat.' : 'Pas!'); }
      if (S.slots.every(s => s.filled)) { busy = false; return roundDone(null, TK ? 'Tangganya jadi! Dari pendek ke panjang.' : 'Tangganya jadi!'); }
      GS.say(pick(['Pas!', 'Masuk!', 'Bagus!']));
    } else {
      miss();
      GS.say(res === 'short' ? (TK ? 'Kependekan. Ada celah.' : 'Kurang panjang, ada celah.') : (TK ? 'Kepanjangan. Tidak muat.' : 'Terlalu panjang, tidak muat.'));
      p.el.removeAttribute('opacity');
      placeEl(p.el, p.home.x, p.home.y + 200, 0);
      await flyEl(p.el, { x: p.home.x, y: 760 }, p.home, 380, 40);
    }
    busy = false; updateDock();
  }

  /* ================= kind: cover (lay units end to end) ================= */
  const UNIT = {
    block: { name: 'balok', color: ['#4DAA57', '#86CC8C', '#357F40'] },
    blockB: { name: 'balok', color: ['#2F80C9', '#6FAEE3', '#215F98'] },
    darto: { name: 'jengkal Pak Darto', skin: ['#B97A4E', '#D69F74', '#8E5A35'] },
    cil: { name: 'jengkal Chuppy', skin: ['#E3AE82', '#F0CBA6', '#B97A4E'] }
  };
  function buildCover() {
    const c = C, k = c.k, L = c.len * k, uw = c.uw * k;
    S.n = 0; S.max = Math.round(c.len / c.uw);
    S.plank = GS.el('g', null, layers.bench);
    GS.markup(S.plank, plankM(X0, PLANK_Y, L, PLANK_H, c.shelf ? PALE : WOOD, 5) + (c.shelf ? Tc(X0 + L / 2, PLANK_Y + 30, 'rak', 30, { body: true, decor: true, fill: '#8A6A40' }) : ''));
    stopBlock();
    S.chain = GS.el('g', null, layers.pieces);
    // the unit source
    const src = GS.el('g', { transform: 'translate(640 345)' }, layers.ui);
    const u = UNIT[c.unit];
    let s = '';
    if (c.unit.indexOf('block') === 0) {
      s += shadowEl(0, 52, uw * 1.2);
      for (let i = 0; i < 3; i++) s += blockM(-uw / 2 - 26 + i * 26, -20 + (i % 2) * 6 - i * 10, uw, 66, u.color);
    } else s += '<g transform="translate(' + n1(-uw / 2) + ' -40)">' + handM(0, 0, uw, u.skin) + '</g>';
    GS.markup(src, s);
    hitRect(src, -Math.max(uw, 120) / 2 - 30, -90, Math.max(uw, 120) + 60, 170, 'unit');
    S.src = src;
    if (!TK) GS.markup(src, Tc(0, 104, u.name, 32, { body: true, fill: '#5A3B22' }));
    let fl = null;
    grab(src, {
      ok: () => S.n < S.max + 1,
      start() { fl = GS.el('g', null, layers.drag); GS.markup(fl, unitM(c, 0, 0)); GS.sfx.pick(); },
      move(q) { setT(fl, q.x - uw / 2, q.y - LIFT); },
      end(q) { const f = fl; fl = null; f.remove(); if (q.y > PLANK_Y - 160 && q.y < RULER_Y + 80) layUnit({ x: q.x - uw / 2, y: q.y - LIFT }); else GS.sfx.tick(); },
      tap() { layUnit({ x: 640 - uw / 2, y: 300 }); }
    });
    S.ready = () => false;
  }
  function unitM(c, x, y) {
    const uw = c.uw * c.k, u = UNIT[c.unit];
    if (c.unit.indexOf('block') === 0) return blockM(x, y - 33, uw, 66, u.color);
    return '<g transform="translate(' + n1(x) + ' ' + n1(y - uw * 0.31) + ')">' + handM(0, 0, uw, u.skin) + '</g>';
  }
  function stopBlock() { GS.markup(layers.bench, plankM(X0 - 34, PLANK_Y - 26, 34, PLANK_H + 30, DARK, 3, { plain: true })); }
  async function layUnit(from) {
    if (busy) return;
    const my = tok, c = C, uw = c.uw * c.k;
    busy = true;
    const el = GS.el('g', null, S.chain);
    GS.markup(el, unitM(c, 0, 0));
    const tx = X0 + S.n * uw, ty = PLANK_Y - (c.unit.indexOf('block') === 0 ? 34 : 12);
    await flyEl(el, from, { x: tx, y: ty }, 300, 30);
    if (my !== tok) return;
    S.n++;
    if (S.n > S.max) {
      // hangs past the end of the plank: it tips over and falls
      GS.sfx.oops();
      await tween(500, e => el.setAttribute('transform', 'translate(' + n1(tx + 30 * e) + ' ' + n1(ty + 300 * e * e) + ') rotate(' + n1(60 * e) + ')'), 'inCubic');
      el.remove(); S.n--;
      GS.say(TK ? 'Jatuh! Papannya sudah habis.' : 'Lewat ujung papan, jatuh!');
      busy = false; return;
    }
    GS.sfx.drop();
    if (TK || c.dots) floatAt(tx + uw / 2, ty - 70, String(S.n));
    if (S.n === S.max) {
      await wait(350);
      if (my !== tok) return;
      // count them aloud, one by one
      for (let i = 0; i < S.max; i++) {
        const ch = S.chain.children[i];
        GS.fx(ch, 'gs-pulse', 500);
        GS.sfx.tick();
        await wait(380);
        if (my !== tok) return;
      }
      if (TK) GS.markup(layers.fx, dotsM(X0 + S.max * uw / 2, PLANK_Y - 140, S.max, 13, BLUE));
      const nm = UNIT[c.unit].name;
      const res = S.max + ' ' + nm;
      if (c.record) S.recordLine = res;
      busy = false;
      const lines = c.lines ? c.lines(S.max) : (TK ? null : ['Panjangnya ' + res]);
      return roundDone(lines, TK ? 'Papan ini ' + S.max + ' balok.' : (c.after ? c.after(S.max) : 'Panjangnya ' + res + '.'));
    }
    busy = false;
  }
