/* Angkot Penuh! (angkot): kamu kenek di terminal.
 * Angkot hanya berangkat kalau tepat 10 penumpang. Kursi angkot = ten-frame 2 x 5.
 * L1-7, L10: seret rombongan ke angkot (pasangan 10, number bond).
 * L8: puluhan & satuan dari kerumunan (angkot = 10, becak = 1).
 * L9: kebalikannya, kirim pesanan n penumpang dengan angkot penuh + becak. */
(function () {
  'use strict';
  const GAME = 'angkot';
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');

  /* ------------------------------------------------------------------ palette */
  const OUT = '#3B2A20';
  const P = {
    blue: '#2F80C9', blueS: '#215F98', blueH: '#6FAEE3',
    sun: '#FFC83D', sunS: '#E09A00', sunH: '#FFE08A',
    org: '#F28C28', orgS: '#C76A12', orgH: '#F8B26A',
    red: '#E2453C', redS: '#B5322B', redH: '#F27A6E',
    grn: '#4DAA57', grnS: '#357F40', grnH: '#86CC8C',
    wood: '#A8673A', woodS: '#7E4A27', woodH: '#C98A5A',
    stone: '#8C8F94', stoneS: '#63666B', stoneH: '#BFC2C6',
    pink: '#F59AB0', pinkS: '#D9708A', cream: '#FFF8EC', ink: '#2B1D14',
    skin: '#C98B5E', skinS: '#A86F45', skinH: '#E0A87A',
    glass: '#CFEAF5', ui: '#1F6FD1', teal: '#0F8C7A'
  };
  const GROUND = 668;   // wheel contact line of the angkot (on the asphalt)
  const AK_X = 640;     // rear x of the parked angkot
  const KEN_X = 590;    // kenek position
  const SEAT_S = 0.6;   // passenger scale inside angkot
  const GRP_S = 0.47;   // passenger scale at the halte

  /* ------------------------------------------------------------------ helpers */
  const el = GS.el;
  const G = (p, a) => el('g', a || {}, p);
  function base(a, fill, stroke, sw, more) {
    a.fill = fill || 'none';
    if (stroke) { a.stroke = stroke; a['stroke-width'] = sw || 3; }
    return Object.assign(a, more || {});
  }
  const R = (p, x, y, w, h, rx, fill, stroke, sw, more) => el('rect', base({ x, y, width: w, height: h, rx: rx || 0 }, fill, stroke, sw, more), p);
  const PA = (p, d, fill, stroke, sw, more) => el('path', base({ d }, fill, stroke, sw, more), p);
  const C = (p, cx, cy, r, fill, stroke, sw, more) => el('circle', base({ cx, cy, r }, fill, stroke, sw, more), p);
  const E = (p, cx, cy, rx, ry, fill, stroke, sw, more) => el('ellipse', base({ cx, cy, rx, ry }, fill, stroke, sw, more), p);
  function T(p, x, y, str, size, fill, more) {
    const t = el('text', Object.assign({ x, y, 'font-size': size, fill: fill || P.ink, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, more || {}), p);
    t.textContent = str;
    return t;
  }
  const f1 = v => (+v).toFixed(1);
  function place(n, x, y, s, r) {
    n.setAttribute('transform', 'translate(' + f1(x) + ' ' + f1(y) + ')' + (r ? ' rotate(' + (+r).toFixed(2) + ')' : '') + (s != null && s !== 1 ? ' scale(' + (+s).toFixed(3) + ')' : ''));
  }
  function squash(n, sx, sy) { n.setAttribute('transform', 'scale(' + sx.toFixed(3) + ' ' + sy.toFixed(3) + ')'); }
  let UID = 0;
  const uid = p => 'ak' + p + (++UID);
  const rnd = (a, b) => GS.rand(a, b);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const SAT = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
  function words(n) {
    if (n < 10) return SAT[n];
    if (n === 10) return 'sepuluh';
    if (n === 11) return 'sebelas';
    if (n < 20) return SAT[n - 10] + ' belas';
    const t = Math.floor(n / 10), o = n % 10;
    return SAT[t] + ' puluh' + (o ? ' ' + SAT[o] : '');
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function toScreen(x, y) {
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  }
  function floatAt(text, x, y, cls) { const s = toScreen(x, y); GS.floatText(text, s.x, s.y, cls); }

  /* speed factor for automated tests (window.__game.speed) */
  let SPEED = 1;
  const tw = (ms, fn, ease) => GS.tween(ms / SPEED, fn, ease);
  let timers = [];
  const sleep = ms => new Promise(r => { timers.push(setTimeout(r, ms / SPEED)); });
  let tok = 0;
  const alive = t => t === tok;

  /* ------------------------------------------------------------------ people */
  const personCache = {};
  function fallbackPerson(v) {
    const shirts = [P.blue, P.org, P.grn, P.pink, P.sun, P.red, '#7FB7E0', P.teal];
    return '<path d="M-15 -8 Q-17 -52 0 -56 Q17 -52 15 -8 Z" fill="' + shirts[v % 8] + '" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<ellipse cx="0" cy="-76" rx="18" ry="17" fill="#E0A87A" stroke="' + OUT + '" stroke-width="2.4"/>' +
      '<path d="M-18 -76 Q-18 -95 0 -95 Q18 -95 18 -76 Q8 -86 -18 -76Z" fill="' + OUT + '"/>' +
      '<circle cx="-6.5" cy="-75" r="2.4" fill="' + OUT + '"/><circle cx="6.5" cy="-75" r="2.4" fill="' + OUT + '"/>' +
      '<path d="M-4 -68.5 Q0 -64.5 4 -68.5" fill="none" stroke="' + OUT + '" stroke-width="1.6"/>';
  }
  function personMarkup(v, shadow) {
    const k = v + (shadow ? 's' : 'n');
    if (personCache[k]) return personCache[k];
    let s = '';
    try { if (GS.art && typeof GS.art.person === 'function') s = GS.art.person(v, { shadow: !!shadow }); } catch (e) { s = ''; }
    if (!s) s = fallbackPerson(v);
    return (personCache[k] = s);
  }
  function personNode(parent, v, x, y, s, shadow) {
    const n = G(parent);
    place(n, x, y, s);
    GS.markup(n, personMarkup(v, shadow));
    return n;
  }
  /** Grumpy overlay drawn in person-local coordinates (face at y = -75). */
  function grumpy(pg) {
    const g = G(pg, { class: 'ak' });
    PA(g, 'M-12 -84 L-3 -80 M12 -84 L3 -80', 'none', OUT, 2.6);
    R(g, -5, -71, 10, 6, 3, '#FFF8EC');
    PA(g, 'M-5 -66 Q0 -71 5 -66', 'none', OUT, 2.4);
    const puff = G(g);
    PA(puff, 'M20 -104 l6 -8 M27 -100 l9 -4 M18 -96 l9 1', 'none', OUT, 2.6);
    return g;
  }
  let lastVar = -1;
  function randVar() { let v; do { v = rnd(0, 7); } while (v === lastVar); lastVar = v; return v; }

  /* ------------------------------------------------------------------ static background */
  const defs = el('defs', null, svg);
  defs.innerHTML = '<filter id="akBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4"/></filter>';
  const bg = G(svg, { class: 'bg' });
  try {
    if (GS.art && GS.art.scene) GS.markup(bg, GS.art.scene('terminal', 1280, 800));
    else throw new Error('no scene');
  } catch (e) {
    R(bg, 0, 0, 1280, 800, 0, '#CFEDF0');
    R(bg, 0, 616, 1280, 30, 0, '#D4A062');
    R(bg, 0, 636, 1280, 170, 0, '#8E8A86');
  }
  const world = G(svg, { class: 'world' });
  let L_ = {};
  function makeLayers() {
    L_ = {};
    ['halte', 'gBack', 'gFront', 'angkot', 'kenek', 'fx', 'ui', 'drag', 'top'].forEach(k => { L_[k] = G(world, { class: 'ly-' + k }); });
  }

  /* ------------------------------------------------------------------ props: halte */
  function drawHalte(opts) {
    const h = G(L_.halte, { class: 'ak' });
    // floor (depth plane)
    PA(h, 'M30 484 L560 484 L588 640 L4 640 Z', '#DCD3C2');
    PA(h, 'M30 484 L560 484 L563 500 L27 500 Z', '#CBC0AC');
    for (let i = 1; i < 6; i++) PA(h, 'M' + (30 - i * 4.4) + ' ' + (484 + i * 26) + ' H' + (560 + i * 4.6), 'none', '#C6BBA6', 2, { opacity: 0.55 });
    // back wall
    R(h, 38, 300, 514, 186, 0, '#F2E4C8');
    for (let x = 60; x < 550; x += 26) for (let y = 318; y < 480; y += 26) C(h, x + ((y / 26) % 2) * 13, y, 2.2, '#C9A877', null, 0, { opacity: 0.18 });
    R(h, 38, 470, 514, 16, 0, '#E3D2B0');
    if (!opts || !opts.noPoster) {
      // route poster (no numbers)
      const po = G(h); place(po, 64, 322);
      R(po, 0, 0, 132, 92, 10, P.cream, OUT, 3);
      R(po, 0, 0, 132, 24, 10, P.blue, OUT, 3);
      T(po, 66, 13, 'Jalur Angkot', 15, '#fff', { class: 't-display' });
      PA(po, 'M18 66 Q46 40 70 58 T116 46', 'none', P.org, 4, { 'stroke-dasharray': '1 9' });
      C(po, 18, 66, 7, P.grn, OUT, 2.5); C(po, 116, 46, 7, P.red, OUT, 2.5);
      T(po, 26, 82, 'Terminal', 11, P.ink, { class: 't-body', 'font-weight': 700, 'text-anchor': 'start' });
      T(po, 112, 64 - 30, 'Pasar', 11, P.ink, { class: 't-body', 'font-weight': 700 });
    }
    // bench along the back wall
    R(h, 230, 424, 296, 12, 5, P.woodS, OUT, 3);
    R(h, 222, 450, 312, 15, 6, P.wood, OUT, 3);
    R(h, 228, 452, 120, 4, 2, P.woodH);
    R(h, 240, 465, 10, 22, 3, P.woodS, OUT, 2.5); R(h, 506, 465, 10, 22, 3, P.woodS, OUT, 2.5);
    // posts
    [22, 552].forEach(x => {
      R(h, x, 290, 16, 352, 6, P.stone, OUT, 3);
      R(h, x + 3, 300, 4, 330, 2, P.stoneH);
    });
    // roof: corrugated, gently arched
    PA(h, 'M-14 300 L604 300 L590 262 Q296 222 0 262 Z', P.grn, OUT, 4);
    PA(h, 'M6 262 Q296 226 586 262 L589 270 Q296 236 3 270 Z', P.grnH, null, 0, { opacity: 0.9 });
    for (let x = 18; x < 590; x += 24) PA(h, 'M' + x + ' ' + (300 - 2) + ' L' + (x + (x - 296) * 0.02) + ' ' + (262 - 30 * Math.sin(Math.PI * x / 590) + 2), 'none', P.grnS, 2, { opacity: 0.45 });
    R(h, -18, 292, 626, 24, 9, P.grnS, OUT, 3.5);
    T(h, 296, 305, 'HALTE TERMINAL', 18, P.cream, { class: 't-display', 'letter-spacing': '2' });
    // curb with painted stripes
    const cid = uid('curb');
    const cp = el('clipPath', { id: cid }, h); R(cp, 0, 636, 600, 22, 6);
    R(h, 0, 636, 600, 22, 6, '#E8E1D4');
    const st = G(h, { 'clip-path': 'url(#' + cid + ')' });
    for (let x = 0; x < 600; x += 48) PA(st, 'M' + x + ' 658 L' + (x + 14) + ' 636 L' + (x + 38) + ' 636 L' + (x + 24) + ' 658 Z', P.sun);
    R(h, 0, 636, 600, 22, 6, 'none', OUT, 3.5);
    return h;
  }

  /* ------------------------------------------------------------------ props: wheels */
  function wheel(p, cx, cy, r) {
    const w = G(p);
    place(w, cx, cy);
    C(w, 0, 0, r, '#4A3B33', OUT, Math.max(2, r * 0.095));
    C(w, 0, 0, r * 0.78, 'none', '#2E241E', Math.max(1, r * 0.05), { opacity: 0.6 });
    const rot = G(w);
    C(rot, 0, 0, r * 0.5, '#D3D6DA', OUT, Math.max(1.5, r * 0.07));
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5;
      C(rot, Math.cos(a) * r * 0.29, Math.sin(a) * r * 0.29, r * 0.075, P.stoneS);
    }
    R(rot, -r * 0.07, -r * 0.5, r * 0.14, r * 0.2, r * 0.05, P.stoneS);
    PA(w, 'M' + f1(-r * 0.62) + ' ' + f1(-r * 0.42) + ' A' + f1(r * 0.75) + ' ' + f1(r * 0.75) + ' 0 0 1 ' + f1(-r * 0.12) + ' ' + f1(-r * 0.74), 'none', '#7A6A60', Math.max(1.5, r * 0.07));
    return rot;
  }
  function spinWheels(list, dist, r) { const d = (dist / r) * 57.2958; list.forEach(w => w.setAttribute('transform', 'rotate(' + d.toFixed(1) + ')')); }

  /* ------------------------------------------------------------------ props: the angkot */
  const BODY_D = 'M10 -72 L10 -306 Q10 -334 40 -334 L512 -334 Q540 -334 550 -312 L572 -208 Q578 -196 578 -182 L578 -72 Q578 -50 556 -50 L32 -50 Q10 -50 10 -72 Z';
  const COLW = 384 / 5;
  const colX = c => 112 + COLW * (c + 0.5);
  function seatBack(p, cx, top, h) {
    R(p, cx - 29, top, 58, h, 12, P.red, OUT, 3);
    R(p, cx - 22, top + 5, 26, 9, 4.5, P.redH);
    PA(p, 'M' + (cx + 22) + ' ' + (top + 12) + ' L' + (cx + 22) + ' ' + (top + h - 10), 'none', P.redS, 5);
    PA(p, 'M' + (cx - 9) + ' ' + (top + 18) + ' V' + (top + h - 6) + ' M' + (cx + 9) + ' ' + (top + 18) + ' V' + (top + h - 6), 'none', P.redS, 2, { opacity: 0.7 });
  }
  function buildAngkot() {
    const A = { x: -760, count: 0, loads: [], seats: [], roof: [], state: 'arriving', angTries: 0 };
    const root = G(L_.angkot, { class: 'ak' });
    A.root = root;
    E(root, 296, 2, 300, 13, OUT, null, 0, { opacity: 0.18 });
    A.shake = G(root);
    const idle = G(A.shake, { class: 'ak-idle' });
    const bodyClip = uid('body'), winClip = uid('win'), doorClip = uid('door'), cabClip = uid('cab');
    let cp = el('clipPath', { id: bodyClip }, root); PA(cp, BODY_D);
    cp = el('clipPath', { id: winClip }, root); R(cp, 112, -306, 384, 194, 14);
    cp = el('clipPath', { id: doorClip }, root); R(cp, 22, -306, 84, 248, 10);
    const CAB = 'M500 -306 L534 -306 Q545 -306 548 -296 L566 -214 Q568 -204 558 -204 L506 -204 Q500 -204 500 -210 Z';
    cp = el('clipPath', { id: cabClip }, root); PA(cp, CAB);

    // body paint (3-tone + stripe)
    PA(idle, BODY_D, P.blue);
    const paint = G(idle, { 'clip-path': 'url(#' + bodyClip + ')' });
    R(paint, 0, -340, 600, 22, 0, P.blueH);
    E(paint, 56, -300, 30, 18, P.blueH);
    R(paint, 0, -82, 600, 40, 0, P.blueS);
    PA(paint, 'M560 -320 L600 -320 L600 0 L566 0 Z', P.blueS);
    R(paint, 0, -112, 600, 24, 0, P.sun);
    R(paint, 0, -112, 600, 6, 0, P.sunH);
    R(paint, 0, -92, 600, 4, 0, P.sunS);
    R(paint, 0, -80, 600, 4, 0, '#fff', null, 0, { opacity: 0.8 });

    // interior cut-away: ten-frame of seats (2 rows x 5)
    R(idle, 112, -306, 384, 194, 14, '#F6E6C9');
    const inter = G(idle, { 'clip-path': 'url(#' + winClip + ')' });
    R(inter, 112, -306, 384, 30, 0, '#EAD3AE');
    PA(inter, 'M112 -290 H496', 'none', P.stoneS, 3);
    for (let c = 0; c < 5; c++) {
      const cx = colX(c);
      PA(inter, 'M' + (cx - 10) + ' -290 v10 a6 6 0 0 0 12 0 v-10', 'none', P.stone, 2.5);
    }
    for (let c = 0; c < 5; c++) seatBack(inter, colX(c), -262, 82);
    A.far = G(idle, { 'clip-path': 'url(#' + winClip + ')' });
    const nearBacks = G(idle, { 'clip-path': 'url(#' + winClip + ')' });
    for (let c = 0; c < 5; c++) seatBack(nearBacks, colX(c), -186, 80);
    A.near = G(idle, { 'clip-path': 'url(#' + winClip + ')' });
    A.marks = G(idle, { class: 'ak-markpulse', style: 'display:none' });
    // glass glints (only in the ceiling band, never over faces)
    const glint = G(idle, { 'clip-path': 'url(#' + winClip + ')', opacity: 0.5 });
    for (let c = 0; c < 5; c += 2) PA(glint, 'M' + (colX(c) + 6) + ' -306 l16 0 l-14 26 l-16 0 Z', '#fff');
    // pillars and frame
    for (let k = 1; k < 5; k++) R(idle, 112 + COLW * k - 5, -306, 10, 194, 3, P.blue, OUT, 3);
    R(idle, 112, -306, 384, 194, 14, 'none', OUT, 4);

    // cab window with the sopir
    PA(idle, CAB, P.glass);
    const cab = G(idle, { 'clip-path': 'url(#' + cabClip + ')' });
    PA(cab, 'M504 -204 Q506 -228 528 -230 Q548 -228 552 -204 Z', '#F3EFE6', OUT, 2.5);
    E(cab, 528, -250, 16, 18, P.skin, OUT, 2.5);
    E(cab, 524, -256, 6, 4, P.skinH);
    R(cab, 510, -276, 34, 14, 4, '#33302F', OUT, 2);
    E(cab, 536, -250, 2.2, 3, OUT);
    PA(cab, 'M530 -240 q6 3 12 -1', 'none', OUT, 2.5);
    E(cab, 556, -214, 5, 16, 'none', OUT, 3);
    PA(cab, 'M514 -300 l10 0 l-16 40 l-10 0 Z', '#fff', null, 0, { opacity: 0.5 });
    PA(idle, CAB, 'none', OUT, 4);
    // side mirror
    PA(idle, 'M560 -228 L590 -238', 'none', OUT, 4);
    E(idle, 594, -246, 6, 12, P.stone, OUT, 3);

    // sliding door at the rear (slides into the body pocket)
    R(idle, 22, -306, 84, 248, 10, '#5B4636');
    R(idle, 22, -78, 84, 20, 0, P.wood, null, 0, { 'clip-path': 'url(#' + doorClip + ')' });
    A.door = G(idle, { 'clip-path': 'url(#' + doorClip + ')' });
    A.doorPanel = G(A.door);
    const dp = A.doorPanel;
    R(dp, 22, -306, 84, 248, 10, P.blue);
    R(dp, 22, -112, 84, 24, 0, P.sun); R(dp, 22, -112, 84, 6, 0, P.sunH); R(dp, 22, -92, 84, 4, 0, P.sunS);
    R(dp, 22, -82, 84, 24, 0, P.blueS);
    R(dp, 32, -294, 64, 92, 10, P.glass, OUT, 3);
    PA(dp, 'M42 -294 l14 0 l-20 40 l-4 0 l0 -30 Z', '#fff', null, 0, { opacity: 0.55 });
    R(dp, 84, -176, 10, 26, 4, P.stone, OUT, 2);
    R(dp, 22, -306, 84, 248, 10, 'none', OUT, 3.5);
    R(idle, 22, -306, 84, 248, 10, 'none', OUT, 4);

    // body outline, lights, bumpers, exhaust
    PA(idle, BODY_D, 'none', OUT, 5);
    R(idle, 8, -168, 12, 38, 4, P.red, OUT, 2.5);
    R(idle, 10, -164, 5, 12, 2, P.redH);
    C(idle, 578, -126, 15, '#FFF6D8', OUT, 4);
    C(idle, 574, -130, 5, '#fff');
    R(idle, 568, -104, 14, 10, 3, P.org, OUT, 2.5);
    R(idle, -14, -44, 30, 9, 4, P.stone, OUT, 2.5);
    R(idle, -4, -70, 48, 20, 8, P.stone, OUT, 3); R(idle, 2, -66, 30, 5, 2.5, P.stoneH);
    R(idle, 546, -70, 48, 20, 8, P.stone, OUT, 3); R(idle, 552, -66, 30, 5, 2.5, P.stoneH);

    // wheel arches + wheels
    A.wheels = [];
    [130, 468].forEach(cx => {
      PA(idle, 'M' + (cx - 54) + ' -50 A54 54 0 0 1 ' + (cx + 54) + ' -50 Z', '#3E2F27', OUT, 4);
      A.wheels.push(wheel(idle, cx, -44, 42));
    });

    // roof: route sign + rack, roof standers layer
    R(idle, 352, -346, 8, 14, 2, P.stoneS, OUT, 2); R(idle, 546, -346, 8, 14, 2, P.stoneS, OUT, 2);
    R(idle, 334, -398, 236, 54, 12, P.blue, OUT, 4);
    R(idle, 342, -391, 220, 40, 8, P.cream, OUT, 2.5);
    T(idle, 452, -370, 'Pasar - Terminal', 26, P.ink, { class: 't-display' });
    A.roofL = G(idle);
    for (let x = 36; x <= 316; x += 56) R(idle, x - 3, -352, 6, 20, 2, P.stone, OUT, 2);
    R(idle, 26, -358, 302, 9, 4.5, P.stone, OUT, 2.5);
    R(idle, 32, -357, 200, 3, 1.5, P.stoneH);

    // arrow hint (shown while a rombongan is selected or dragged)
    A.arrow = G(idle, { style: 'display:none' });
    const ab = G(A.arrow, { class: 'ak-bounce' });
    PA(ab, 'M-18 -40 L18 -40 L18 -10 L34 -10 L0 24 L-34 -10 L-18 -10 Z', P.sun, OUT, 4);
    PA(ab, 'M-12 -34 L-4 -34 L-4 -14', 'none', P.sunH, 4);

    // hit area for taps (whole angkot) + focus ring
    A.hit = R(root, -24, -430, 640, 450, 24, '#fff', null, 0, { 'fill-opacity': 0, class: 'ak-hit', tabindex: 0, role: 'button', 'aria-label': 'Angkot' });
    R(root, -20, -426, 632, 442, 24, 'none', P.ui, 5, { class: 'ak-ring', 'pointer-events': 'none' });
    A.hit.addEventListener('click', () => onAngkotTap());
    A.hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAngkotTap(); } });
    setAkX(A, A.x);
    return A;
  }
  function setAkX(A, x) { A.x = x; place(A.root, x, GROUND); spinWheels(A.wheels, x, 42); }
  function showArrow(A, where) {
    if (!A || !A.arrow) return;
    if (!where) { A.arrow.style.display = 'none'; return; }
    A.arrow.style.display = '';
    if (where === 'roof') place(A.arrow, 176, -452); else place(A.arrow, 64, -364);
  }
  function setDoor(A, open) {
    const from = A.doorOpen ? 1 : 0, to = open ? 1 : 0;
    A.doorOpen = open;
    if (from === to) return Promise.resolve();
    GS.sfx.creak();
    return tw(260, e => place(A.doorPanel, -86 * GS.lerp(from, to, e), 0), 'outCubic');
  }
  function seatPos(idx) {
    const c = idx % 5, row = Math.floor(idx / 5);
    return { x: colX(c), y: row === 0 ? -168 : -94, layer: row === 0 ? 'far' : 'near' };
  }
  function addSeat(A, idx, v, owner, instant) {
    const sp = seatPos(idx);
    const n = personNode(A[sp.layer], v, sp.x, sp.y, SEAT_S, false);
    A.seats[idx] = { node: n, owner, v };
    if (!instant) popIn(n, sp.x, sp.y, SEAT_S);
    refreshMarks(A);
  }
  function addRoof(A, j, v, owner) {
    const x = 48 + Math.min(j, 8) * 36 + (j > 8 ? 18 : 0);
    const n = G(A.roofL);
    const inner = G(n, { class: 'ak-stomp', style: 'animation-delay:' + (-j * 0.11).toFixed(2) + 's' });
    GS.markup(inner, personMarkup(v, false));
    grumpy(inner);
    place(n, x, -338, 0.62);
    A.roof[j] = { node: n, owner, v };
    popIn(n, x, -338, 0.62);
  }
  function popIn(n, x, y, s) {
    return tw(240, e => place(n, x, y, s * Math.max(0.01, e)), 'outBack');
  }
  function popOut(n, x, y, s) {
    return tw(150, e => place(n, x, y, s * Math.max(0.01, 1 - e)), 'inCubic').then(() => n.remove());
  }
  function refreshMarks(A) {
    if (!A || !A.marks) return;
    A.marks.innerHTML = '';
    if (!A.support) { A.marks.style.display = 'none'; return; }
    A.marks.style.display = '';
    for (let i = 0; i < 10; i++) {
      if (A.seats[i]) continue;
      const sp = seatPos(i);
      const top = sp.layer === 'far' ? -258 : -182;
      R(A.marks, sp.x - 25, top, 50, sp.layer === 'far' ? 70 : 66, 12, '#FFF8EC', P.sunS, 4, { 'stroke-dasharray': '10 7', 'fill-opacity': 0.55 });
    }
  }
  function spawnPuff(x, y, big) {
    if (GS.reducedMotion && Math.random() < 0.7) return;
    const c = C(L_.fx, x, y, 8, '#EFE9DF', '#D2C8B8', 2, { opacity: 0.92 });
    const dx = -30 - Math.random() * 34, dy = -18 - Math.random() * 26, r1 = 18 + Math.random() * 12 * (big || 1);
    GS.tween(900, e => {
      c.setAttribute('cx', f1(x + dx * e)); c.setAttribute('cy', f1(y + dy * e));
      c.setAttribute('r', f1(8 + (r1 - 8) * e)); c.setAttribute('opacity', (0.92 * (1 - e)).toFixed(2));
    }, 'outCubic').then(() => c.remove());
  }
  function drive(A, x0, x1, ms, ease, puff) {
    let last = -1;
    return tw(ms, (e, raw) => {
      setAkX(A, GS.lerp(x0, x1, e));
      if (puff && raw - last > 0.07) { last = raw; spawnPuff(A.x - 16, GROUND - 40, 1 + raw); }
    }, ease);
  }
  function honk() {
    [0, 0.26].forEach(d => {
      GS.tone({ f: 392, t: 0.2, type: 'square', vol: 0.07, delay: d });
      GS.tone({ f: 494, t: 0.2, type: 'square', vol: 0.05, delay: d });
    });
  }
  function engine(t) { GS.noise({ t: t || 1, vol: 0.07, freq: 150, freq2: 480, q: 1.4 }); }
  function brake() { GS.tone({ f: 1250, f2: 900, t: 0.2, type: 'triangle', vol: 0.04 }); }

  async function arriveAngkot(pre, opts) {
    const t = tok;
    const A = buildAngkot();
    cur = A;
    for (let k = 0; k < pre; k++) addSeat(A, k, randVar(), 'pre', true);
    A.count = pre;
    engine(1.2);
    await drive(A, -760, AK_X, 1300, 'outCubic', false);
    if (!alive(t)) return A;
    brake();
    A.state = 'ready';
    if (selected) showArrow(A, 'door');
    updateDock();
    if (opts && opts.say) GS.say(opts.say);
    return A;
  }

  /** "Penuh! Berangkat!" + honk + puffs + drive off. Resolves when gone. */
  async function departAnim(A) {
    const t = tok;
    A.state = 'departing';
    showArrow(A, null);
    updateDock();
    await sleep(320);              // hush before the payoff
    if (!alive(t)) return;
    kenek.pose('shout');
    kenekBubble('Penuh! Berangkat!');
    GS.say('Penuh! Berangkat!');
    hud.mood('cheer');
    honk();
    floatAt('10', A.x + 300, GROUND - 420);
    await sleep(900);
    if (!alive(t)) return;
    await setDoor(A, false);
    for (let i = 0; i < 4; i++) spawnPuff(A.x - 16, GROUND - 40, 1.4);
    engine(1.6);
    GS.sfx.whoosh();
    await drive(A, A.x, 1460, 1500, 'inCubic', true);
    A.root.remove();
    if (!alive(t)) return;
    kenek.pose('idle');
  }

  /* ------------------------------------------------------------------ props: becak */
  function buildBecak(parent) {
    const B = { wheels: [] };
    const g = G(parent, { class: 'ak' });
    B.g = g;
    E(g, 0, 2, 118, 9, OUT, null, 0, { opacity: 0.18 });
    const body = G(g, { class: 'ak-idle' });
    // frame tube
    PA(body, 'M-78 -34 L-62 -116 M-62 -116 L14 -60 M-78 -34 L-40 -48 L14 -52', 'none', OUT, 10);
    PA(body, 'M-78 -34 L-62 -116 M-62 -116 L14 -60 M-78 -34 L-40 -48 L14 -52', 'none', P.red, 5);
    B.wheels.push(wheel(body, -78, -34, 34));
    C(body, -40, -48, 9, P.stone, OUT, 3);
    // driver (tukang becak) with caping
    PA(body, 'M-64 -118 Q-76 -150 -58 -160 L-36 -156 Q-28 -140 -36 -118 Z', '#F3EFE6', OUT, 3);
    PA(body, 'M-44 -146 L-8 -122', 'none', OUT, 9); PA(body, 'M-44 -146 L-8 -122', 'none', P.skin, 5);
    PA(body, 'M-56 -118 L-46 -84 L-40 -50', 'none', OUT, 9); PA(body, 'M-56 -118 L-46 -84 L-40 -50', 'none', '#215F98', 5);
    E(body, -48, -174, 15, 15, P.skin, OUT, 3);
    E(body, -42, -175, 2, 2.6, OUT);
    PA(body, 'M-82 -180 L-48 -204 L-14 -180 Q-48 -172 -82 -180 Z', '#E8C987', OUT, 3);
    PA(body, 'M-48 -204 L-66 -182 M-48 -204 L-32 -181', 'none', '#B48C4C', 1.5);
    R(body, -72, -122, 26, 8, 4, OUT);
    // passenger carriage
    PA(body, 'M8 -48 L8 -118 Q8 -132 22 -132 L56 -132 L60 -96 L102 -86 Q112 -84 112 -74 L112 -48 Z', P.red, OUT, 4);
    PA(body, 'M14 -120 Q14 -126 22 -126 L40 -126', 'none', P.redH, 5);
    PA(body, 'M14 -58 L106 -58', 'none', P.redS, 7);
    C(body, 34, -84, 9, P.sun, OUT, 2.5); C(body, 34, -84, 3.5, P.org);
    R(body, 84, -50, 42, 9, 4, P.stone, OUT, 2.5);
    // hood (tenda)
    PA(body, 'M4 -124 Q10 -200 66 -202 Q104 -202 110 -150 L98 -146 Q92 -186 64 -186 Q26 -184 20 -122 Z', P.org, OUT, 3.5);
    PA(body, 'M14 -150 Q30 -192 66 -194', 'none', P.orgH, 4);
    PA(body, 'M40 -194 Q30 -170 26 -140 M78 -198 Q90 -180 96 -152', 'none', P.orgS, 2.5);
    B.seat = G(body);
    B.wheels.push(wheel(body, 62, -34, 34));
    return B;
  }
  function setBecakX(B, x, y, s) { B.x = x; place(B.g, x, y, s); spinWheels(B.wheels, x / s, 34); }

  /** Parade of becaks: each becak carries exactly one person (satuan). */
  async function becakParade(count, take, onEach) {
    const t = tok;
    const stopX = 470, y = GROUND + 4, s = 0.55;
    const leaving = [];
    for (let i = 0; i < count; i++) {
      const B = buildBecak(L_.fx);
      setBecakX(B, -140, y, s);
      GS.tone({ f: 1500, t: 0.06, type: 'triangle', vol: 0.05 });
      GS.tone({ f: 1500, t: 0.06, type: 'triangle', vol: 0.05, delay: 0.1 });
      await tw(520, e => setBecakX(B, GS.lerp(-140, stopX, e), y, s), 'outCubic');
      if (!alive(t)) return;
      const src = take(i);
      // the passenger hops from the halte into the seat
      const fly = personNode(L_.drag, src.v, src.x, src.y, src.s || GRP_S, false);
      const tx = stopX + 50 * s, ty = y - 58 * s;
      await tw(260, e => place(fly, GS.lerp(src.x, tx, e), GS.lerp(src.y, ty, e) - Math.sin(Math.PI * e) * 50, GS.lerp(src.s || GRP_S, 0.5 * s, e)), 'linear');
      fly.remove();
      if (!alive(t)) return;
      personNode(B.seat, src.v, 50, -58, 0.5, false);
      GS.sfx.count(i + 1);
      onEach && onEach(i);
      leaving.push(tw(1300, e => setBecakX(B, GS.lerp(stopX, 1460, e), y, s), 'inCubic').then(() => B.g.remove()));
      await sleep(140);
    }
    await Promise.all(leaving);
  }

  /* ------------------------------------------------------------------ props: mini angkot (board icons, pips, convoy) */
  function miniAngkot(p, opts) {
    opts = opts || {};
    const g = G(p, { class: 'ak' });
    if (opts.shadow) E(g, 100, 2, 100, 7, OUT, null, 0, { opacity: 0.18 });
    const sw = opts.sw || 4;
    PA(g, 'M6 -30 V-92 Q6 -106 20 -106 H168 Q180 -106 184 -96 L196 -66 V-32 Q196 -22 186 -22 H16 Q6 -22 6 -30 Z', P.blue, OUT, sw);
    R(g, 18, -102, 120, 6, 3, P.blueH);
    R(g, 8, -50, 186, 10, 0, P.sun);
    R(g, 38, -96, 130, 42, 7, '#F6E6C9', OUT, sw * 0.75);
    if (opts.full) {
      for (let c = 0; c < 5; c++) for (let r = 0; r < 2; r++) {
        const x = 51 + c * 26, y = r ? -66 : -84;
        C(g, x, y, 6.5, ['#E0A87A', '#C98B5E', '#8A5A3C', '#EBC39C'][(c + r * 2) % 4], OUT, 1.8);
        PA(g, 'M' + (x - 6) + ' ' + (y - 2) + ' Q' + x + ' ' + (y - 11) + ' ' + (x + 6) + ' ' + (y - 2), OUT);
      }
    }
    for (let k = 1; k < 5; k++) R(g, 38 + 26 * k - 2, -96, 4, 42, 1, P.blue);
    PA(g, 'M172 -96 L180 -96 L190 -66 L172 -66 Z', P.glass, OUT, sw * 0.75);
    R(g, 106, -122, 80, 16, 5, P.cream, OUT, sw * 0.75);
    C(g, 196, -42, 6, '#FFF6D8', OUT, sw * 0.6);
    const wh = [wheel(g, 46, -20, 17), wheel(g, 160, -20, 17)];
    return { g, wheels: wh };
  }

  /* ------------------------------------------------------------------ the kenek */
  function drawKenek(x, y) {
    const K = {};
    const root = G(L_.kenek, { class: 'ak' });
    place(root, x, y);
    E(root, 0, 0, 40, 8, OUT, null, 0, { opacity: 0.18 });
    K.hop = G(root);
    const b = G(K.hop, { class: 'ak-breathe' });
    function arm(sx, sy) {
      const a = G(b);
      R(a, -6.5, 0, 13, 42, 6.5, P.skin, OUT, 3);
      C(a, 0, 44, 8, P.skin, OUT, 3);
      C(a, 0, 5, 11, P.org, OUT, 3);
      a.base = [sx, sy];
      return a;
    }
    function setArm(a, deg) { a.setAttribute('transform', 'translate(' + a.base[0] + ' ' + a.base[1] + ') rotate(' + deg + ')'); a.deg = deg; }
    [-12, 12].forEach(lx => {
      R(b, lx - 7, -50, 14, 46, 6, P.skin, OUT, 3);
      PA(b, 'M' + (lx - 12) + ' -2 Q' + (lx - 12) + ' -9 ' + (lx - 5) + ' -9 L' + (lx + 9) + ' -9 Q' + (lx + 15) + ' -9 ' + (lx + 15) + ' -3 L' + (lx + 15) + ' 0 L' + (lx - 12) + ' 0 Z', P.org, OUT, 3);
    });
    PA(b, 'M-27 -86 L27 -86 L29 -46 L4 -46 L0 -60 L-4 -46 L-29 -46 Z', P.blueS, OUT, 3.5);
    K.armL = arm(-27, -120); K.armR = arm(27, -120);
    PA(b, 'M-28 -84 Q-33 -118 -18 -130 L18 -130 Q33 -118 28 -84 Z', P.org, OUT, 3.5);
    E(b, -13, -114, 8, 6, P.orgH);
    PA(b, 'M24 -116 Q30 -100 26 -88 L17 -88 Q22 -102 18 -114 Z', P.orgS);
    // towel over the shoulder
    PA(b, 'M-22 -130 Q-10 -132 -8 -128 L-12 -76 Q-17 -72 -22 -76 Z', P.cream, OUT, 3);
    PA(b, 'M-19 -112 L-11 -112 M-19 -98 L-12 -98', 'none', P.blue, 3);
    R(b, -7, -138, 14, 12, 4, P.skinS);
    const h = G(b);
    place(h, 0, -166);
    C(h, -29, 4, 7, P.skin, OUT, 3); C(h, 29, 4, 7, P.skin, OUT, 3);
    E(h, 0, 0, 30, 29, P.skin, OUT, 3.5);
    E(h, -13, -10, 9, 6, P.skinH);
    PA(h, 'M-29 -4 Q-30 -34 0 -34 Q30 -34 29 -4 Q0 -15 -29 -4 Z', P.sun, OUT, 3.5);
    PA(h, 'M-26 -11 Q-46 -12 -50 -5 Q-41 -1 -26 -3 Z', P.sunS, OUT, 3);
    E(h, -6, -25, 9, 4, P.sunH);
    K.eyes = G(h, { class: 'ak-blink' });
    E(K.eyes, -10, 5, 4.2, 5.6, OUT); E(K.eyes, 12, 5, 4.2, 5.6, OUT);
    C(K.eyes, -8.6, 3, 1.6, '#fff'); C(K.eyes, 13.4, 3, 1.6, '#fff');
    K.brows = PA(h, 'M-15 -5 Q-10 -8 -5 -5 M7 -5 Q12 -8 17 -5', 'none', OUT, 2.6);
    E(h, -19, 13, 5, 3, P.pink, null, 0, { opacity: 0.75 }); E(h, 21, 13, 5, 3, P.pink, null, 0, { opacity: 0.75 });
    K.smile = PA(h, 'M-6 15 Q1 22 8 15', 'none', OUT, 3);
    K.open = G(h, { style: 'display:none' });
    E(K.open, 1, 17, 7.5, 7, '#7A2E22', OUT, 3); E(K.open, 1, 20.5, 4, 2.4, P.redH);
    K.flat = PA(h, 'M-5 18 Q1 15 7 18', 'none', OUT, 3, { style: 'display:none' });
    setArm(K.armL, 12); setArm(K.armR, -12);
    let waveT = 0;
    K.pose = function (p) {
      clearInterval(waveT);
      K.smile.style.display = p === 'idle' ? '' : 'none';
      K.open.style.display = p === 'shout' ? '' : 'none';
      K.flat.style.display = p === 'think' ? '' : 'none';
      K.brows.setAttribute('d', p === 'think' ? 'M-15 -8 Q-10 -6 -5 -4 M7 -4 Q12 -6 17 -8' : 'M-15 -5 Q-10 -8 -5 -5 M7 -5 Q12 -8 17 -5');
      if (p === 'shout') {
        setArm(K.armR, -150); setArm(K.armL, 30);
        tw(380, e => place(K.hop, 0, -Math.sin(Math.PI * e) * 16), 'linear');
        let k = 0;
        if (!GS.reducedMotion) waveT = setInterval(() => { k++; setArm(K.armR, k % 2 ? -168 : -140); if (k > 8) clearInterval(waveT); }, 140);
      } else if (p === 'think') {
        setArm(K.armR, 158); setArm(K.armL, 12);
      } else if (p === 'point') {
        setArm(K.armR, -95); setArm(K.armL, 12);
      } else {
        setArm(K.armR, -12); setArm(K.armL, 12);
      }
    };
    K.root = root;
    return K;
  }
  let bubbleT = 0;
  function kenekBubble(text) {
    const old = L_.top.querySelector('.ak-bubble');
    if (old) old.remove();
    clearTimeout(bubbleT);
    const g = G(L_.top, { class: 'ak ak-bubble', 'pointer-events': 'none' });
    const w = Math.max(150, text.length * 15.5 + 40);
    const bx = KEN_X + 34, by = GROUND - 290;
    PA(g, 'M' + (bx + 18) + ' ' + (by + 50) + ' L' + (bx + 2) + ' ' + (by + 82) + ' L' + (bx + 44) + ' ' + (by + 50) + ' Z', '#fff', OUT, 3.5);
    R(g, bx, by, w, 56, 26, '#fff', OUT, 3.5);
    PA(g, 'M' + (bx + 19) + ' ' + (by + 49) + ' L' + (bx + 43) + ' ' + (by + 49), 'none', '#fff', 5);
    T(g, bx + w / 2, by + 29, text, 27, P.ink, { class: 't-display' });
    tw(240, e => g.setAttribute('transform', 'translate(' + (bx + 20) + ' ' + (by + 60) + ') scale(' + Math.max(0.01, e).toFixed(3) + ') translate(' + -(bx + 20) + ' ' + -(by + 60) + ')'), 'outBack');
    bubbleT = setTimeout(() => g.remove(), 1700 / SPEED);
  }

  /* ------------------------------------------------------------------ dock buttons */
  function mkBtn(label, alt, onClick, icon) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gs-action' + (alt ? ' alt' : '');
    b.innerHTML = (icon || '') + '<span></span>';
    b.querySelector('span').textContent = label;
    b.addEventListener('click', () => { GS.sfx.click(); onClick(); });
    dock.appendChild(b);
    return b;
  }
  function nudge(b) { if (!b) return; b.classList.remove('ak-nudge'); void b.offsetWidth; b.classList.add('ak-nudge'); }

  /* ------------------------------------------------------------------ progress pips */
  let pips = [];
  function drawPips(total, kind) {
    pips = [];
    const g = G(L_.ui, { class: 'ak' });
    const sp = kind === 'dot' ? 38 : 62, w = kind === 'dot' ? 26 : 52;
    const width = (total - 1) * sp + w + 28;
    R(g, 1256 - width, 14, width, 56, 18, P.cream, OUT, 3, { opacity: 0.95 });
    for (let k = 0; k < total; k++) {
      const x = 1256 - 14 - w - (total - 1 - k) * sp;
      const m = G(g, { opacity: 0.3 });
      if (kind === 'dot') { C(m, x + 13, 42, 12, P.sun, OUT, 3); }
      else { place(m, x, 64, 0.26); miniAngkot(m, { sw: 7 }); }
      pips.push(m);
    }
  }
  function setPips(done) {
    pips.forEach((m, k) => {
      const on = k < done, was = m.getAttribute('opacity') === '1';
      m.setAttribute('opacity', on ? '1' : '0.3');
      if (on && !was) { GS.sfx.coin(); }
    });
  }

  /* ------------------------------------------------------------------ rombongan (groups) */
  const GCOL = [[P.blue, P.blueS], [P.org, P.orgS], [P.grn, P.grnS], [P.pink, P.pinkS], [P.sun, P.sunS], [P.wood, P.woodS]];
  const EMBLEM = ['circle', 'tri', 'square', 'star', 'heart', 'diamond'];
  const ROWS = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [2, 3], 6: [3, 3], 7: [2, 3, 2], 8: [3, 2, 3], 9: [3, 3, 3] };
  const SP = 31, RAISE = 27;
  function emblem(p, kind, col) {
    const fill = col[0], st = col[1];
    if (kind === 'circle') C(p, 0, 0, 11, fill, st, 3);
    else if (kind === 'tri') PA(p, 'M0 -12 L12 9 L-12 9 Z', fill, st, 3);
    else if (kind === 'square') R(p, -10, -10, 20, 20, 4, fill, st, 3);
    else if (kind === 'star') {
      let d = '';
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5.6 : 13; d += (i ? 'L' : 'M') + f1(Math.cos(a) * r) + ' ' + f1(Math.sin(a) * r); }
      PA(p, d + 'Z', fill, st, 2.6);
    } else if (kind === 'heart') PA(p, 'M0 10 C-14 0 -12 -12 -5 -12 C-2 -12 0 -9 0 -7 C0 -9 2 -12 5 -12 C12 -12 14 0 0 10 Z', fill, st, 2.6);
    else PA(p, 'M0 -13 L11 0 L0 13 L-11 0 Z', fill, st, 3);
  }
  let gid = 0, colorCursor = 0;
  function makeGroup(n, flag) {
    const label = cfg.label;
    const gr = { id: ++gid, n, d: flag || false, col: GCOL[colorCursor % GCOL.length], emb: EMBLEM[colorCursor % EMBLEM.length], vars: [], people: [], state: 'new', x: -150, y: 628, s: 1, ds: 1, oy: 0 };
    colorCursor++;
    for (let i = 0; i < n; i++) gr.vars.push(randVar());
    const rows = ROWS[n] || [n];
    const Rn = rows.length;
    const maxRow = Math.max.apply(null, rows);
    const W = (maxRow - 1) * SP + (Rn > 1 ? SP * 0.5 : 0) + 30;
    gr.g = G(L_.gFront, { class: 'ak ak-group', tabindex: 0, role: 'button', 'aria-label': label === 'none' ? 'Rombongan' : 'Rombongan ' + n + ' orang' });
    gr.sq = G(gr.g);
    gr.bob = G(gr.sq);
    const B = gr.bob;
    // hit area (generous) + focus ring
    R(B, -W / 2 - 52, -154, W + 92, 176, 22, '#fff', null, 0, { 'fill-opacity': 0 });
    R(B, -W / 2 - 48, -150, W + 84, 168, 22, 'none', P.ui, 4, { class: 'ak-ring' });
    gr.mat = E(B, -8, 3, W / 2 + 32, 13, gr.col[0], gr.col[1], 2.5, { opacity: 0.4, 'stroke-dasharray': '6 6' });
    gr.peopleG = G(B, label === 'num' ? { filter: 'url(#akBlur)', opacity: 0.85 } : {});
    let k = 0;
    const order = [];
    rows.forEach((m, r) => {
      const lift = (Rn - 1 - r) * RAISE;
      const stag = Rn > 1 ? ((Rn - 1 - r) % 2 ? SP * 0.25 : -SP * 0.25) : 0;
      for (let j = 0; j < m; j++) order.push({ x: (j - (m - 1) / 2) * SP + stag, y: -lift });
    });
    order.forEach(pos => {
      const v = gr.vars[k++];
      const node = personNode(gr.peopleG, v, pos.x, pos.y, GRP_S, true);
      gr.people.push({ node, x: pos.x, y: pos.y, v });
    });
    // sign board
    const sg = G(B);
    gr.signG = sg;
    if (label === 'num') {
      R(sg, -4, -62, 8, 62, 3, P.woodS, OUT, 2.5);
      R(sg, -42, -112, 84, 64, 12, P.wood, OUT, 3.5);
      R(sg, -35, -105, 70, 50, 8, P.cream, OUT, 2.5);
      T(sg, 0, -79, String(n), 42, P.ink, { class: 'gs-num' });
    } else {
      const sx = -W / 2 - 18;
      R(sg, sx - 3, -84, 6, 86, 3, P.woodS, OUT, 2.5);
      R(sg, sx - 24, -124, 48, 44, 9, P.wood, OUT, 3);
      R(sg, sx - 19, -119, 38, 34, 6, P.cream, OUT, 2);
      if (label === 'both') T(sg, sx, -101, String(n), 28, P.ink, { class: 'gs-num' });
      else { const e = G(sg); place(e, sx, -102); emblem(e, gr.emb, gr.col); }
    }
    attachGroup(gr);
    return gr;
  }
  function posGroup(gr) { place(gr.g, gr.x, gr.y + gr.oy, gr.s * gr.ds); }
  function setBlur(gr, on) {
    if (cfg.label !== 'num') return;
    if (on) { gr.peopleG.setAttribute('filter', 'url(#akBlur)'); gr.peopleG.setAttribute('opacity', '0.85'); }
    else { gr.peopleG.removeAttribute('filter'); gr.peopleG.setAttribute('opacity', '1'); }
  }

  const SLOTS_ALL = [
    { x: 122, y: 630, s: 1, tier: 'f' }, { x: 292, y: 630, s: 1, tier: 'f' }, { x: 462, y: 630, s: 1, tier: 'f' },
    { x: 140, y: 514, s: 0.9, tier: 'b' }, { x: 298, y: 514, s: 0.9, tier: 'b' }, { x: 456, y: 514, s: 0.9, tier: 'b' }
  ];
  const SLOTS_BIG = [
    { x: 116, y: 632, s: 1.22, tier: 'f' }, { x: 302, y: 632, s: 1.22, tier: 'f' }, { x: 488, y: 632, s: 1.22, tier: 'f' }
  ];
  let slots = [];
  function freeSlot() { return slots.find(sl => !sl.occ); }
  function putInLayer(gr) {
    const layer = gr.slot && gr.slot.tier === 'b' ? L_.gBack : L_.gFront;
    layer.appendChild(gr.g);
  }

  async function walkTo(gr, x1, y1, s1, ms) {
    const x0 = gr.x, y0 = gr.y, s0 = gr.s;
    const hops = Math.max(1, Math.round(Math.abs(x1 - x0) / 90));
    await tw(ms, (e, raw) => {
      gr.x = GS.lerp(x0, x1, e); gr.y = GS.lerp(y0, y1, e); gr.s = GS.lerp(s0, s1, e);
      gr.oy = GS.reducedMotion ? 0 : -Math.abs(Math.sin(raw * Math.PI * hops)) * 10;
      posGroup(gr);
    }, 'linear');
    gr.oy = 0; posGroup(gr);
  }
  function squashLand(gr, heavy) {
    const a = heavy ? 0.95 : 1.2, b = heavy ? 1.04 : 0.85;
    return tw(300, (e, raw) => {
      let sx, sy;
      if (raw < 0.35) { const k = raw / 0.35; sx = GS.lerp(1, a, k); sy = GS.lerp(1, b, k); }
      else if (raw < 0.7) { const k = (raw - 0.35) / 0.35; sx = GS.lerp(a, 0.94, k); sy = GS.lerp(b, 1.06, k); }
      else { const k = (raw - 0.7) / 0.3; sx = GS.lerp(0.94, 1, k); sy = GS.lerp(1.06, 1, k); }
      squash(gr.sq, sx, sy);
    }, 'linear');
  }
  async function spawnGroups(list) {
    const made = [];
    list.forEach(item => {
      const gr = makeGroup(item.n, item.d);
      const sl = freeSlot();
      if (!sl) { gr.g.remove(); return; }
      sl.occ = gr; gr.slot = sl;
      gr.x = -140 - made.length * 60; gr.y = sl.y; gr.s = sl.s;
      putInLayer(gr);
      posGroup(gr);
      made.push(gr);
      halte.push(gr);
    });
    // order by slot to keep tier draw order (back tier first inside its own layer)
    await Promise.all(made.map((gr, i) => sleep(i * 130).then(() => { GS.sfx.pop(); return walkTo(gr, gr.slot.x, gr.slot.y, gr.slot.s, 700 + gr.slot.x * 0.4); }).then(() => { gr.state = 'halte'; return squashLand(gr); })));
    return made;
  }
  async function walkOff(gr) {
    gr.state = 'leaving';
    if (gr.slot) { gr.slot.occ = null; gr.slot = null; }
    halte = halte.filter(h => h !== gr);
    await walkTo(gr, -170, gr.y, gr.s, 900);
    gr.g.remove();
  }

  /* drag + tap-to-select */
  function attachGroup(gr) {
    let start = null, moved = false, off = null, lastP = null;
    GS.drag(gr.g, {
      svg,
      onStart(p) {
        if (gr.state !== 'halte' || finished) return false;
        start = p; moved = false; lastP = p;
        off = { x: gr.x - p.x, y: gr.y - p.y };
        return true;
      },
      onMove(p) {
        lastP = p;
        if (!moved && Math.hypot(p.x - start.x, p.y - start.y) > 12) { moved = true; pickUp(gr); }
        if (moved) {
          gr.x = p.x + off.x; gr.y = p.y + off.y - 40 * gr.lift;
          posGroup(gr);
          if (cur) showArrow(cur, overAngkot(p) || cur.state === 'ready' ? 'door' : null);
        }
      },
      onEnd(p) {
        if (!moved) { tapGroup(gr); return; }
        dropGroup(gr, p);
      }
    });
    gr.lift = 0;
    gr.g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (gr.state === 'halte') tapGroup(gr); }
    });
  }
  function pickUp(gr) {
    if (selected) deselect();
    dragging = gr;
    L_.drag.appendChild(gr.g);
    GS.sfx.pick();
    const m = gr.mat;
    tw(120, e => { gr.ds = 1 + 0.15 * e; gr.lift = e; m.setAttribute('opacity', (0.4 - 0.2 * e).toFixed(2)); posGroup(gr); }, 'outBack');
  }
  function overAngkot(p) {
    return !!cur && p.x > cur.x - 40 && p.x < cur.x + 620 && p.y > GROUND - 450 && p.y < GROUND + 40;
  }
  function dropGroup(gr, p) {
    dragging = null;
    if (cur) showArrow(cur, cur.state === 'overfull' ? 'roof' : null);
    if (overAngkot(p) && cur) {
      if (cur.state === 'ready') { boardGroup(gr); return; }
      if (cur.state === 'overfull') { GS.say('Atapnya penuh orang! Ketuk atap dulu, ya.'); hud.mood('think'); }
      else GS.say('Tunggu angkotnya siap, ya.');
    }
    returnHome(gr);
  }
  async function returnHome(gr) {
    const sl = gr.slot;
    gr.state = 'moving';
    const x0 = gr.x, y0 = gr.y, s0 = gr.s, d0 = gr.ds;
    await tw(220, e => { gr.x = GS.lerp(x0, sl.x, e); gr.y = GS.lerp(y0, sl.y, e); gr.s = GS.lerp(s0, sl.s, e); gr.ds = GS.lerp(d0, 1, e); posGroup(gr); }, 'outCubic');
    gr.lift = 0; gr.mat.setAttribute('opacity', '0.4');
    putInLayer(gr);
    GS.sfx.drop();
    gr.state = 'halte';
    await squashLand(gr);
  }
  function tapGroup(gr) {
    if (gr.state !== 'halte' || finished) return;
    if (selected === gr) { deselect(); GS.sfx.click(); return; }
    if (selected) deselect();
    selected = gr;
    gr.bob.classList.add('ak-bob');
    gr.oy = -14; gr.ds = 1.08; posGroup(gr);
    GS.sfx.pick();
    if (cur && cur.state === 'ready') showArrow(cur, 'door');
    if (!tapHinted) { tapHinted = true; GS.say('Sekarang ketuk angkotnya.'); }
  }
  function deselect() {
    const gr = selected;
    selected = null;
    if (!gr) return;
    gr.bob.classList.remove('ak-bob');
    gr.oy = 0; gr.ds = 1; posGroup(gr);
    if (cur && cur.state === 'ready') showArrow(cur, null);
  }
  function onAngkotTap() {
    if (!cur || finished) return;
    if (cfg.kind !== 'pool') return;
    if (cur.state === 'overfull') { sendBack(); return; }
    if (selected && cur.state === 'ready') { const gr = selected; deselect(); boardGroup(gr); return; }
    if (cur.state === 'ready' && !selected) { GS.sfx.tick(); GS.say('Seret rombongan ke angkot.'); }
  }

  /* boarding: passengers hop in one by one, counting up */
  async function boardGroup(gr) {
    const t = tok;
    const A = cur;
    if (!A || A.state !== 'ready') { returnHome(gr); return; }
    A.state = 'boarding';
    showArrow(A, null);
    updateDock();
    gr.state = 'riding';
    halte = halte.filter(h => h !== gr);
    A.loads.push(gr);
    L_.drag.appendChild(gr.g);
    const tx = A.x + 62, ty = GROUND + 8;
    const x0 = gr.x, y0 = gr.y, s0 = gr.s, d0 = gr.ds;
    setBlur(gr, false);
    await tw(280, e => { gr.x = GS.lerp(x0, tx, e); gr.y = GS.lerp(y0, ty, e) - Math.sin(Math.PI * e) * 30; gr.s = GS.lerp(s0, 1, e); gr.ds = GS.lerp(d0, 1, e); posGroup(gr); }, 'outCubic');
    gr.lift = 0;
    GS.sfx.drop();
    squashLand(gr);
    gr.signG.style.display = 'none';
    await setDoor(A, true);
    if (!alive(t)) return;
    // board front people first (closest to the door)
    const order = gr.people.slice().sort((a, b) => (b.y - a.y) || (b.x - a.x));
    for (const p of order) {
      if (!alive(t)) return;
      const n = p.node;
      tw(200, e => { n.setAttribute('opacity', (1 - e).toFixed(2)); place(n, p.x * (1 - e), p.y - 60 * e, GRP_S * (1 - 0.3 * e)); }, 'inCubic');
      const idx = A.count;
      A.count++;
      if (idx < 10) addSeat(A, idx, p.v, gr);
      else { addRoof(A, idx - 10, p.v, gr); GS.sfx.creak(); }
      GS.sfx.count(idx + 1);
      await sleep(250);
    }
    if (!alive(t)) return;
    gr.g.style.display = 'none';
    await sleep(220);
    if (!alive(t)) return;
    if (A.count === 10) poolDepart(A);
    else if (A.count > 10) overfull(A);
    else underfull(A);
  }
  function overfull(A) {
    A.state = 'overfull';
    A.shake.classList.add('ak-rumble');
    GS.sfx.oops();
    kenek.pose('think');
    hud.mood('oops');
    kenekBubble('Kebanyakan!');
    GS.say('Kebanyakan! Ketuk atap untuk menurunkan mereka.');
    showArrow(A, 'roof');
    updateDock();
  }
  function underfull(A) {
    A.state = 'ready';
    setDoor(A, false);
    const left = 10 - A.count;
    updateDock();
    if (!subsetExists(halte.map(g => g.n), left)) {
      GS.sfx.oops();
      kenek.pose('think');
      hud.mood('think');
      GS.say('Belum pas. Ketuk Turunkan, lalu coba lagi.');
      nudge(btnDown);
    } else {
      kenek.pose('point');
      hud.mood('think');
      GS.say(pick(['Masih ada kursi kosong. Tambah lagi!', 'Belum penuh. Siapa lagi yang naik?']));
      timers.push(setTimeout(() => kenek && kenek.pose('idle'), 1400));
    }
  }
  /** Last rombongan gets off and walks back to the halte (counts as a retry). */
  async function sendBack() {
    const t = tok;
    const A = cur;
    if (!A || (A.state !== 'ready' && A.state !== 'overfull') || !A.loads.length) return;
    const gr = A.loads.pop();
    A.state = 'unloading';
    showArrow(A, null);
    updateDock();
    tries++; A.angTries++;
    GS.sfx.whoosh();
    await setDoor(A, true);
    const mine = [];
    A.roof.forEach((o, j) => { if (o && o.owner === gr) mine.push({ o, idx: 10 + j }); });
    A.seats.forEach((o, i) => { if (o && o.owner === gr) mine.push({ o, idx: i }); });
    mine.sort((a, b) => b.idx - a.idx);
    for (const m of mine) {
      if (!alive(t)) return;
      const tr = m.o.node.getAttribute('transform') || '';
      const mm = /translate\(([-\d.]+) ([-\d.]+)\)(?: scale\(([-\d.]+)\))?/.exec(tr);
      if (mm) popOut(m.o.node, +mm[1], +mm[2], mm[3] ? +mm[3] : 1); else m.o.node.remove();
      if (m.idx >= 10) A.roof[m.idx - 10] = null; else A.seats[m.idx] = null;
      A.count--;
      GS.sfx.pop();
      await sleep(110);
    }
    A.roof = A.roof.filter(Boolean);
    A.seats.length = Math.min(A.seats.length, 10);
    if (A.count <= 10) A.shake.classList.remove('ak-rumble');
    // the group re-forms at the door and walks back
    gr.g.style.display = '';
    gr.signG.style.display = '';
    gr.people.forEach(p => { p.node.setAttribute('opacity', '1'); place(p.node, p.x, p.y, GRP_S); });
    setBlur(gr, A.angTries < 2);
    gr.x = A.x + 62; gr.y = GROUND + 8; gr.s = 1; gr.ds = 1; posGroup(gr);
    await walkTo(gr, gr.slot.x, gr.slot.y, gr.slot.s, 650);
    if (!alive(t)) return;
    putInLayer(gr);
    gr.state = 'halte';
    halte.push(gr);
    squashLand(gr);
    setDoor(A, false);
    A.state = 'ready';
    kenek.pose('idle');
    hud.mood('think');
    if (A.angTries >= 2 && !A.support) {
      A.support = true;
      refreshMarks(A);
      halte.forEach(h => setBlur(h, false));
      GS.say('Lihat kursi kosongnya. Hitung dulu, ya.');
    } else GS.say('Ayo coba rombongan lain.');
    updateDock();
  }

  /* ------------------------------------------------------------------ solver */
  function subsetExists(sizes, target) {
    const n = sizes.length;
    for (let m = 1; m < (1 << n); m++) {
      let s = 0;
      for (let i = 0; i < n; i++) if (m >> i & 1) s += sizes[i];
      if (s === target) return true;
    }
    return false;
  }
  /** Can these groups fill all needs in order, leaving only flagged extras? */
  function canSolve(groups, needs) {
    const n = groups.length, sizes = groups.map(g => g.n), extra = groups.map(g => !!g.d);
    function rec(mask, k) {
      if (k === needs.length) { for (let i = 0; i < n; i++) if (!(mask >> i & 1) && !extra[i]) return false; return true; }
      const free = ((1 << n) - 1) & ~mask;
      for (let sub = free; sub; sub = (sub - 1) & free) {
        let s = 0;
        for (let i = 0; i < n; i++) if (sub >> i & 1) s += sizes[i];
        if (s === needs[k] && rec(mask | sub, k + 1)) return true;
      }
      return false;
    }
    return rec(0, 0);
  }
  function findPlan(groups, need, laterNeeds) {
    const n = groups.length;
    let any = null;
    for (let m = 1; m < (1 << n); m++) {
      let s = 0; const pickd = [], rest = [];
      for (let i = 0; i < n; i++) if (m >> i & 1) { s += groups[i].n; pickd.push(groups[i]); } else rest.push(groups[i]);
      if (s !== need) continue;
      if (!any) any = pickd;
      if (canSolve(rest, laterNeeds)) return pickd;
    }
    return any;
  }

  /* ------------------------------------------------------------------ level generators */
  const pair = (lo, hi) => { const a = rnd(lo, hi); return [a, 10 - a]; };
  function triple(min) {
    for (;;) { const a = rnd(min, 8), b = rnd(min, 8), c = 10 - a - b; if (c >= min && c <= 8) return [a, b, c]; }
  }
  function quad() {
    for (;;) { const a = rnd(1, 4), b = rnd(1, 4), c = rnd(1, 4), d = 10 - a - b - c; if (d >= 1 && d <= 5) return [a, b, c, d]; }
  }
  function split2(nd) { if (nd <= 1) return [nd]; const a = rnd(1, nd - 1); return [a, nd - a]; }
  const G_ = arr => arr.map(n => ({ n }));
  function oneChoiceRound() {
    const a = rnd(3, 7), need = 10 - a;
    const cands = [need - 2, need - 1, need + 1, need + 2, need + 3].filter(d => d >= 1 && d <= 9 && d !== need);
    let d1, d2;
    do { d1 = pick(cands); d2 = pick(cands); } while (d1 === d2 || d1 + d2 === need);
    return { angkots: [a], groups: GS.shuffle([{ n: need }, { n: d1, d: 'decoy' }, { n: d2, d: 'decoy' }]) };
  }
  function strayFor(waves, cands) {
    for (const d of GS.shuffle(cands || [9, 8, 7, 1])) {
      const ok = waves.every(w => !w.needs.some(nd => {
        const s = w.sizes;
        if (d === nd) return true;
        return subsetExists(s, nd - d);
      }));
      if (ok) return d;
    }
    return 9;
  }
  const LEVELS = [
    { kind: 'pool', label: 'none', slots: 'big', say: 'Angkot belum penuh. Pilih rombongan yang pas!',
      make: () => [oneChoiceRound()] },
    { kind: 'pool', label: 'none', slots: 'big', say: 'Dua angkot menunggu. Isi sampai tepat sepuluh!',
      make: () => [oneChoiceRound(), oneChoiceRound()] },
    { kind: 'pool', label: 'none', say: 'Angkot kosong. Gabungkan dua rombongan jadi sepuluh!',
      make: () => { const as = GS.shuffle([2, 3, 4, 5]).slice(0, 3); return [{ angkots: [0, 0, 0], groups: GS.shuffle(G_(as.flatMap(a => [a, 10 - a]))) }]; } },
    { kind: 'pool', label: 'both', say: 'Lihat angkanya. Pasangkan jadi sepuluh!',
      make: () => { const as = GS.shuffle([1, 2, 3, 4, 5]).slice(0, 4); return [
        { angkots: [0, 0], groups: GS.shuffle(G_([as[0], 10 - as[0], as[1], 10 - as[1]])) },
        { angkots: [0, 0], groups: GS.shuffle(G_([as[2], 10 - as[2], as[3], 10 - as[3]])) }]; } },
    { kind: 'pool', label: 'both', say: 'Tiga rombongan untuk satu angkot. Ayo isi!',
      make: () => [
        { angkots: [0, 0], groups: GS.shuffle(G_(triple(1).concat(triple(2)))) },
        { angkots: [0], groups: GS.shuffle(G_(triple(1))) }] },
    { kind: 'pool', label: 'both', say: 'Isi tepat sepuluh. Ada rombongan yang tidak cocok, lho!',
      make: () => {
        const p1 = pair(2, 5), t1 = triple(2), p2 = pair(2, 5), t2 = triple(2);
        const w1 = p1.concat(t1), w2 = p2.concat(t2);
        const d = strayFor([{ needs: [10], sizes: w1 }, { needs: [10], sizes: w2 }]);
        return [
          { angkots: [0, 0], groups: GS.shuffle(G_(w1).concat([{ n: d, d: 'stray' }])) },
          { angkots: [0, 0], groups: GS.shuffle(G_(w2)) }];
      } },
    { kind: 'pool', label: 'num', say: 'Sekarang hanya angka. Isi tepat sepuluh!',
      make: () => [
        { angkots: [0, 0], groups: GS.shuffle(G_(pair(1, 5).concat(triple(1)))) },
        { angkots: [0, 0], groups: GS.shuffle(G_(triple(1).concat(pair(1, 5)))) }] },
    { kind: 'tens', label: 'none', say: 'Ketuk Isi angkot! Sisanya naik becak.' },
    { kind: 'order', label: 'none', say: 'Ada pesanan! Kirim penumpang ke pasar.' },
    { kind: 'pool', label: 'none', say: 'Tantangan! Lima angkot, tanpa angka.',
      make: () => {
        const a = rnd(2, 5), need = 10 - a, sp = split2(need);
        const d = strayFor([{ needs: [need], sizes: sp }], [1, 2, 3, 4].filter(x => x !== need));
        return [
          { angkots: [0, 0], groups: GS.shuffle(G_(pair(1, 5).concat(triple(1)))) },
          { angkots: [0, 0], groups: GS.shuffle(G_(quad().concat(pair(1, 5)))) },
          { angkots: [a], groups: GS.shuffle(G_(sp).concat([{ n: d, d: 'stray' }])) }];
      } }
  ];

  /* ------------------------------------------------------------------ HUD + runner */
  const hud = GS.hud({ gameId: GAME, title: 'Angkot Penuh!', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: buildLevel });

  /* ------------------------------------------------------------------ level state */
  let cfg = LEVELS[0], LV = 0, tries = 0, cur = null, kenek = null, halte = [], selected = null, dragging = null;
  let finished = false, tapHinted = false, waves = [], waveIdx = 0, pres = [], departed = 0, btnDown = null;
  let mode = {};

  function buildLevel(i) {
    tok++;
    timers.forEach(clearTimeout); timers = [];
    clearTimeout(bubbleT);
    world.innerHTML = '';
    dock.innerHTML = '';
    makeLayers();
    LV = i; cfg = LEVELS[i]; tries = 0; cur = null; halte = []; selected = null; dragging = null;
    finished = false; tapHinted = false; departed = 0; btnDown = null; mode = {}; colorCursor = rnd(0, 5);
    drawHalte({ noPoster: cfg.kind === 'order' });
    kenek = drawKenek(KEN_X, GROUND + 14);
    hud.mood('think');
    if (cfg.kind === 'pool') startPool();
    else if (cfg.kind === 'tens') startTens();
    else startOrder();
  }
  function finish(text) {
    if (finished && mode.won) return;
    finished = true; mode.won = true;
    const stars = tries === 0 ? 3 : tries <= 2 ? 2 : 1;
    hud.mood('cheer');
    kenek.pose('shout');
    run.win(stars, text || 'Hebat! Semua angkot berangkat.');
  }

  /* ================================================================== POOL LEVELS (1-7, 10) */
  function startPool() {
    waves = cfg.make();
    waveIdx = -1;
    const total = waves.reduce((s, w) => s + w.angkots.length, 0);
    drawPips(total, 'angkot');
    slots = (cfg.slots === 'big' ? SLOTS_BIG : SLOTS_ALL).map(s => Object.assign({}, s, { occ: null }));
    btnDown = mkBtn('Turunkan', true, () => sendBack(), GS.ICON.retry);
    btnDown.hidden = true;
    GS.say(cfg.say);
    nextWave(true);
  }
  async function nextWave(first) {
    const t = tok;
    waveIdx++;
    const w = waves[waveIdx];
    pres = w.angkots.slice();
    const p1 = spawnGroups(w.groups);
    const p2 = arriveAngkot(pres[0], first ? null : { say: 'Rombongan baru datang!' });
    await Promise.all([p1, p2]);
    if (!alive(t)) return;
    updateDock();
  }
  function updateDock() {
    if (cfg.kind === 'pool' && btnDown) {
      const show = !!cur && cur.loads.length > 0 && (cur.state === 'ready' || cur.state === 'overfull') && !finished;
      btnDown.hidden = !show;
    }
    if (cfg.kind === 'tens' && mode.btnFill) {
      const ok = !!cur && cur.state === 'ready' && !mode.busy && mode.phase === 'fill';
      mode.btnFill.disabled = !ok; mode.btnBecak.disabled = !ok;
    }
  }
  async function poolDepart(A) {
    const t = tok;
    A.loads.forEach(g => { g.state = 'gone'; if (g.slot) { g.slot.occ = null; g.slot = null; } g.g.remove(); });
    await departAnim(A);
    if (!alive(t)) return;
    departed++;
    setPips(departed);
    cur = null;
    pres.shift();
    hud.mood('happy');
    if (pres.length) {
      const needs = pres.map(p => 10 - p);
      if (!canSolve(halte, needs)) await rebalance(needs);
      if (!alive(t)) return;
      arriveAngkot(pres[0], { say: pick(['Angkot berikutnya datang!', 'Ayo, angkot baru!']) });
    } else if (waveIdx < waves.length - 1) {
      // decoys of this wave go home; strays stay
      await Promise.all(halte.filter(g => g.d !== 'stray').map(g => walkOff(g)));
      if (!alive(t)) return;
      nextWave(false);
    } else {
      levelDone();
    }
  }
  async function rebalance(needs) {
    const olds = halte.filter(g => !g.d);
    await Promise.all(olds.map(g => walkOff(g)));
    await spawnGroups(needs.flatMap(nd => split2(nd)).map(n => ({ n })));
  }
  async function levelDone() {
    const t = tok;
    finished = true;
    updateDock();
    const decoys = halte.filter(g => g.d !== 'stray');
    await Promise.all(decoys.map(g => walkOff(g)));
    const strays = halte.slice();
    if (strays.length) {
      GS.say('Rombongan ini pulang naik becak saja.');
      hud.mood('happy');
      await sleep(600);
      for (const gr of strays) {
        const order = gr.people.slice().sort((a, b) => (b.x - a.x) || (b.y - a.y));
        await becakParade(order.length, i => {
          const p = order[i];
          p.node.style.display = 'none';
          return { x: gr.x + p.x * gr.s, y: gr.y + p.y * gr.s, v: p.v, s: GRP_S * gr.s };
        });
        if (!alive(t)) return;
        gr.g.remove();
      }
    }
    if (!alive(t)) return;
    if (LV === 9) {
      await showSummary(departed);
      if (!alive(t)) return;
    }
    await sleep(350);
    if (!alive(t)) return;
    finish(LV === 9 ? 'Luar biasa! Lima angkot penuh.' : 'Hebat! Semua angkot penuh.');
  }
  async function showSummary(n) {
    const g = G(L_.top, { class: 'ak' });
    R(g, 250, 120, 780, 300, 30, P.cream, OUT, 4);
    T(g, 640, 170, 'Angkot yang berangkat hari ini', 30, P.ink, { class: 't-display' });
    const items = [];
    for (let k = 0; k < n; k++) {
      const m = G(g, { opacity: 0 });
      const x = 640 - (n - 1) * 72 + k * 144 - 60;
      const ic = G(m); place(ic, x, 300, 0.6); miniAngkot(ic, { full: true, sw: 5 });
      T(m, x + 60, 336, '10', 34, P.ui, { class: 'gs-num' });
      items.push(m);
    }
    const eq = T(g, 640, 388, '', 40, P.ink, { class: 'gs-num' });
    for (let k = 0; k < n; k++) {
      items[k].setAttribute('opacity', '1');
      GS.sfx.count((k + 1) * 2);
      eq.textContent = Array(k + 1).fill('10').join(' + ');
      await sleep(380);
    }
    eq.textContent = Array(n).fill('10').join(' + ') + ' = ' + (n * 10);
    GS.sfx.coin();
    GS.say(cap(words(n)) + ' angkot penuh. ' + cap(words(n * 10)) + ' penumpang!');
    await sleep(2600);
  }

  /* ================================================================== LEVEL 8: puluhan & satuan */
  function makeBoard(kind) {
    const B = { tens: 0, ones: 0, dT: 0, dO: 0, kind };
    const g = G(L_.ui, { class: 'ak' });
    B.g = g;
    R(g, 18, 8, 544, 234, 22, P.wood, OUT, 4);
    R(g, 26, 13, 200, 6, 3, P.woodH);
    R(g, 32, 22, 516, 206, 14, '#2F6B4C', OUT, 3);
    PA(g, 'M290 34 V216', 'none', '#E8F0E0', 3, { 'stroke-dasharray': '2 10', opacity: 0.7 });
    T(g, 161, 44, 'PULUHAN', 24, P.cream, { class: 't-display', 'letter-spacing': '1' });
    T(g, 419, 44, 'SATUAN', 24, P.cream, { class: 't-display', 'letter-spacing': '1' });
    B.tG = G(g); B.oG = G(g); B.labels = G(g, { style: 'display:none' });
    function digitBox(cx) {
      const d = G(g);
      R(d, cx - 36, 160, 72, 60, 12, P.cream, OUT, 3);
      const t = T(d, cx, 191, '?', 44, P.ink, { class: 'gs-num' });
      return { g: d, t, cx };
    }
    B.boxT = digitBox(161); B.boxO = digitBox(419);
    B.steps = G(g, { style: 'display:none' });
    const stepper = (cx, sign, which, label) => {
      const b = G(B.steps, { class: 'ak-btn', tabindex: 0, role: 'button', 'aria-label': label });
      place(b, cx, 190);
      const f = G(b);
      R(f, -36, -30, 72, 60, 16, P.ui, OUT, 3.5);
      R(f, -28, -24, 30, 8, 4, '#5E9BE6');
      PA(f, sign > 0 ? 'M-12 0 H12 M0 -12 V12' : 'M-12 0 H12', 'none', '#fff', 6);
      R(b, -42, -36, 84, 72, 18, 'none', P.sun, 4, { class: 'ak-ring' });
      const act = () => {
        if (B.locked) return;
        tw(160, e => place(f, 0, 0, e < 0.4 ? 1 - 0.2 * (e / 0.4) : 0.92 + 0.08 * ((e - 0.4) / 0.6)), 'linear');
        GS.sfx.tick();
        B.onStep(which, sign);
      };
      b.addEventListener('click', act);
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
      return b;
    };
    stepper(161 - 82, -1, 't', 'Kurangi puluhan'); stepper(161 + 82, 1, 't', 'Tambah puluhan');
    stepper(419 - 82, -1, 'o', 'Kurangi satuan'); stepper(419 + 82, 1, 'o', 'Tambah satuan');
    B.renderIcons = function (popLast) {
      B.tG.innerHTML = ''; B.oG.innerHTML = ''; B.labels.innerHTML = '';
      for (let k = 0; k < B.tens; k++) {
        const x = 52 + (k % 5) * 48, y = 100 + Math.floor(k / 5) * 44;
        const m = G(B.tG); place(m, x, y, 0.23); miniAngkot(m, { sw: 8 });
        T(B.labels, x + 23, y + 12, String((k + 1) * 10), 15, P.sunH, { class: 'gs-num' });
        if (popLast && k === B.tens - 1 && popLast === 't') popIn(m, x, y, 0.23);
      }
      for (let k = 0; k < B.ones; k++) {
        const x = 330 + (k % 5) * 44, y = 100 + Math.floor(k / 5) * 44;
        const m = G(B.oG); place(m, x, y, 0.19); buildBecakIcon(m);
        T(B.labels, x, y + 10, String(k + 1), 15, P.sunH, { class: 'gs-num' });
        if (popLast && k === B.ones - 1 && popLast === 'o') popIn(m, x, y, 0.19);
      }
    };
    B.setDigits = function (t, o) { B.boxT.t.textContent = t; B.boxO.t.textContent = o; };
    return B;
  }
  function buildBecakIcon(p) {
    const b = buildBecak(p);
    b.g.querySelector('.ak-idle').classList.remove('ak-idle');
    personNode(b.seat, rnd(0, 7), 50, -58, 0.55, false);
    return b;
  }

  function startTens() {
    mode = { round: 0, rounds: 2, phase: 'fill', crowd: [], busy: false, roundTries: 0 };
    drawPips(2, 'dot');
    mode.board = makeBoard('tens');
    mode.board.onStep = (which, sign) => {
      const B = mode.board;
      if (which === 't') B.dT = GS.clamp(B.dT + sign, 0, 9); else B.dO = GS.clamp(B.dO + sign, 0, 9);
      B.setDigits(B.dT, B.dO);
    };
    mode.btnFill = mkBtn('Isi angkot!', false, () => fillAngkot());
    mode.btnBecak = mkBtn('Becak', true, () => callBecak());
    mode.btnCek = mkBtn('Cek!', false, () => checkTens());
    mode.btnCek.hidden = true;
    GS.say(cfg.say);
    arriveAngkot(0);
    tensRound();
    updateDock();
  }
  function crowdSpots() {
    const spots = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) spots.push({ x: 66 + c * 50 + (r % 2) * 18 + rnd(-5, 5), y: 506 + r * 30 + rnd(-3, 3) });
    return spots;
  }
  function tensRound() {
    const prev = mode.n || 0;
    let n;
    do { n = rnd(21, 49); } while (n % 10 === 0 || Math.floor(n / 10) === Math.floor(prev / 10));
    mode.n = n; mode.phase = 'fill'; mode.roundTries = 0;
    const B = mode.board;
    B.tens = 0; B.ones = 0; B.dT = 0; B.dO = 0; B.locked = false;
    B.renderIcons(); B.setDigits('?', '?');
    B.steps.style.display = 'none'; B.labels.style.display = 'none';
    mode.btnFill.hidden = false; mode.btnBecak.hidden = false; mode.btnCek.hidden = true;
    const spots = GS.shuffle(crowdSpots()).slice(0, n).sort((a, b) => a.y - b.y);
    mode.crowd = spots.map((s, i) => {
      const v = randVar();
      const node = personNode(L_.gFront, v, s.x, s.y, 0.42, true);
      const o = { node, x: s.x, y: s.y, v, s: 0.42 };
      timers.push(setTimeout(() => popIn(node, s.x, s.y, 0.42), i * 18 / SPEED));
      place(node, s.x, s.y, 0.01);
      return o;
    });
    updateDock();
  }
  async function fillAngkot() {
    const t = tok;
    const A = cur;
    if (mode.phase !== 'fill' || mode.busy || !A || A.state !== 'ready' || !mode.crowd.length) return;
    mode.busy = true; A.state = 'boarding'; updateDock();
    const take = Math.min(10, mode.crowd.length);
    mode.crowd.sort((a, b) => (b.x + b.y * 0.6) - (a.x + a.y * 0.6));
    const riders = mode.crowd.splice(0, take);
    await setDoor(A, true);
    const doorX = A.x + 64, doorY = GROUND - 66;
    const flights = [];
    for (let k = 0; k < take; k++) {
      const r = riders[k];
      L_.drag.appendChild(r.node);
      const idx = k;
      flights.push(tw(300, e => place(r.node, GS.lerp(r.x, doorX, e), GS.lerp(r.y, doorY, e) - Math.sin(Math.PI * e) * 60, GS.lerp(0.42, 0.3, e)), 'linear').then(() => {
        r.node.remove();
        if (!alive(t)) return;
        addSeat(A, idx, r.v, 'crowd');
        A.count++;
        GS.sfx.count(idx + 1);
      }));
      await sleep(190);
      if (!alive(t)) return;
    }
    await Promise.all(flights);
    await sleep(300);
    if (!alive(t)) return;
    if (take === 10) {
      await departAnim(A);
      if (!alive(t)) return;
      const B = mode.board;
      B.tens++; B.renderIcons('t'); GS.sfx.coin();
      cur = null;
      mode.busy = false;
      if (mode.crowd.length >= 10) GS.say(pick(['Masih banyak. Isi angkot lagi!', 'Ayo, angkot berikutnya!']));
      else GS.say('Sisanya sedikit. Angkot atau becak?');
      await arriveAngkot(0);
      mode.busy = false;
      updateDock();
    } else {
      tries++; mode.roundTries++;
      GS.sfx.oops();
      kenek.pose('think'); hud.mood('think');
      kenekBubble('Belum penuh!');
      GS.say('Belum penuh. Angkot tidak mau berangkat.');
      A.shake.classList.add('gs-wobble');
      await sleep(1500);
      if (!alive(t)) return;
      A.shake.classList.remove('gs-wobble');
      // everyone hops back into the crowd
      for (let k = take - 1; k >= 0; k--) {
        const o = A.seats[k]; const sp = seatPos(k);
        if (o) popOut(o.node, sp.x, sp.y, SEAT_S);
        A.seats[k] = null; A.count--;
        const r = riders[k];
        const node = personNode(L_.gFront, r.v, r.x, r.y, 0.42, true);
        r.node = node; popIn(node, r.x, r.y, 0.42);
        mode.crowd.push(r);
        GS.sfx.pop();
        await sleep(90);
      }
      A.seats = [];
      setDoor(A, false);
      A.state = 'ready'; mode.busy = false;
      kenek.pose('idle');
      GS.say('Sisa sedikit naik becak saja.');
      nudge(mode.btnBecak);
      updateDock();
    }
  }
  async function callBecak() {
    const t = tok;
    if (mode.phase !== 'fill' || mode.busy || !cur || cur.state !== 'ready') return;
    if (mode.crowd.length >= 10) {
      tries++; mode.roundTries++;
      GS.sfx.oops(); hud.mood('think'); kenek.pose('think');
      GS.say('Masih banyak. Isi angkot dulu, ya.');
      nudge(mode.btnFill);
      timers.push(setTimeout(() => kenek && kenek.pose('idle'), 1500));
      return;
    }
    mode.busy = true; updateDock();
    hud.mood('happy');
    GS.say('Satu becak, satu penumpang.');
    mode.crowd.sort((a, b) => (b.x + b.y * 0.6) - (a.x + a.y * 0.6));
    const list = mode.crowd.splice(0);
    await becakParade(list.length, i => { const r = list[i]; r.node.remove(); return r; }, () => {
      const B = mode.board; B.ones++; B.renderIcons('o');
    });
    if (!alive(t)) return;
    mode.busy = false;
    compose();
  }
  function compose() {
    mode.phase = 'compose';
    const B = mode.board;
    B.dT = 0; B.dO = 0; B.setDigits(0, 0);
    B.steps.style.display = '';
    mode.btnFill.hidden = true; mode.btnBecak.hidden = true; mode.btnCek.hidden = false;
    mode.btnCek.disabled = false;
    hud.mood('think');
    GS.say('Berapa penumpang semuanya? Susun angkanya di papan.');
    updateDock();
  }
  async function checkTens() {
    const t = tok;
    const B = mode.board;
    if (mode.phase !== 'compose' || mode.busy) return;
    const okT = B.dT === B.tens, okO = B.dO === B.ones;
    if (okT && okO) {
      mode.busy = true; B.locked = true; mode.btnCek.disabled = true;
      GS.sfx.coin();
      hud.mood('happy');
      [B.boxT, B.boxO].forEach(bx => { const r = bx.g.querySelector('rect'); r.setAttribute('fill', '#E3F4F1'); r.setAttribute('stroke', P.teal); });
      floatAt(String(mode.n), 290, 120);
      GS.say(cap(words(mode.n)) + ' penumpang! ' + B.tens + ' puluhan, ' + B.ones + ' satuan.');
      await sleep(2800);
      if (!alive(t)) return;
      mode.round++;
      setPips(mode.round);
      mode.busy = false;
      if (mode.round >= mode.rounds) { finish('Hebat! Kamu paham puluhan dan satuan.'); return; }
      [B.boxT, B.boxO].forEach(bx => { const r = bx.g.querySelector('rect'); r.setAttribute('fill', P.cream); r.setAttribute('stroke', OUT); });
      GS.say('Kerumunan baru datang! Ketuk Isi angkot!');
      tensRound();
    } else {
      tries++; mode.roundTries++;
      GS.sfx.oops();
      hud.mood('oops');
      [[okT, B.boxT, B.tG], [okO, B.boxO, B.oG]].forEach(([ok, bx, ic]) => {
        if (ok) return;
        bx.g.classList.remove('gs-wobble'); void bx.g.getBoundingClientRect(); bx.g.classList.add('gs-wobble');
        ic.classList.remove('gs-wobble'); void ic.getBoundingClientRect(); ic.classList.add('gs-wobble');
      });
      if (!okT) GS.say('Hitung lagi angkotnya. Satu angkot, sepuluh orang.');
      else GS.say('Hitung lagi becaknya. Satu becak, satu orang.');
      if (mode.roundTries >= 2) B.labels.style.display = '';
    }
  }

  /* ================================================================== LEVEL 9: kirim pesanan */
  function drawGate() {
    const g = G(L_.halte, { class: 'ak' });
    const front = G(L_.fx, { class: 'ak' });
    // roof + beam
    PA(g, 'M1000 300 L1140 236 L1280 300 Z', P.red, OUT, 4);
    PA(g, 'M1030 292 L1140 244 L1180 262', 'none', P.redH, 5);
    R(g, 1004, 296, 274, 54, 10, P.wood, OUT, 4);
    R(g, 1014, 302, 120, 7, 3, P.woodH);
    T(g, 1140, 326, 'PASAR', 34, P.cream, { class: 't-display', 'letter-spacing': '3' });
    // left pillar behind the road traffic
    R(g, 1028, 348, 38, GROUND - 336, 6, P.redS, OUT, 4);
    R(g, 1034, 356, 8, GROUND - 360, 4, P.red);
    // counter board hanging under the beam
    R(g, 1086, 348, 4, 18, 2, OUT); R(g, 1190, 348, 4, 18, 2, OUT);
    R(g, 1070, 362, 140, 92, 16, P.cream, OUT, 4);
    T(g, 1140, 381, 'sampai', 18, '#6B5444', { class: 't-body', 'font-weight': 700 });
    const num = T(g, 1140, 420, '0', 52, P.ink, { class: 'gs-num' });
    // right pillar in front (vehicles disappear behind it)
    R(front, 1214, 348, 40, GROUND - 336, 6, P.redS, OUT, 4);
    R(front, 1220, 356, 8, GROUND - 360, 4, P.red);
    E(front, 1234, GROUND + 12, 34, 7, OUT, null, 0, { opacity: 0.18 });
    return { num };
  }
  function orderCard(n, hint) {
    if (mode.card) mode.card.remove();
    const g = G(L_.ui, { class: 'ak' });
    mode.card = g;
    place(g, 296, 420);
    R(g, -170, -78, 340, 166, 18, P.cream, OUT, 4);
    C(g, 0, -70, 8, P.red, OUT, 3);
    T(g, 0, -42, 'Kirim ke pasar:', 26, P.ink, { class: 't-body', 'font-weight': 700 });
    if (hint) {
      T(g, -64, 12, String(n), 60, P.ui, { class: 'gs-num' });
      T(g, 58, 12, '= ' + (Math.floor(n / 10) * 10) + ' + ' + (n % 10), 34, P.teal, { class: 'gs-num' });
    } else T(g, 0, 12, String(n), 64, P.ui, { class: 'gs-num' });
    T(g, 0, 60, 'penumpang', 26, P.ink, { class: 't-body', 'font-weight': 700 });
  }
  function startOrder() {
    mode = { round: 0, rounds: 2, busy: false, roundTries: 0 };
    drawPips(2, 'dot');
    mode.gate = drawGate();
    mode.board = makeBoard('order');
    const B = mode.board;
    B.steps.style.display = '';
    B.onStep = (which, sign) => {
      if (mode.busy) return;
      if (which === 't') { const v = GS.clamp(B.tens + sign, 0, 9); if (v === B.tens) return; B.tens = v; B.renderIcons(sign > 0 ? 't' : null); }
      else { const v = GS.clamp(B.ones + sign, 0, 9); if (v === B.ones) return; B.ones = v; B.renderIcons(sign > 0 ? 'o' : null); }
      B.setDigits(B.tens, B.ones);
    };
    mode.btnSend = mkBtn('Kirim!', false, () => kirim());
    orderRound();
  }
  function orderRound() {
    const prev = mode.target || 0;
    let n;
    do { n = rnd(21, 49); } while (n % 10 === 0 || Math.floor(n / 10) === Math.floor(prev / 10));
    mode.target = n; mode.roundTries = 0;
    const B = mode.board;
    B.tens = 0; B.ones = 0; B.locked = false; B.renderIcons(); B.setDigits(0, 0);
    B.labels.style.display = 'none';
    mode.gate.num.textContent = '0';
    orderCard(n, false);
    mode.btnSend.disabled = false;
    hud.mood('think');
    GS.say('Kirim ' + n + ' penumpang ke pasar. Atur angkot dan becak!');
  }
  async function kirim() {
    const t = tok;
    const B = mode.board, gate = mode.gate;
    if (mode.busy) return;
    if (B.tens + B.ones === 0) { GS.sfx.oops(); GS.say('Pilih dulu angkot dan becaknya.'); return; }
    mode.busy = true; B.locked = true; mode.btnSend.disabled = true;
    hud.mood('happy');
    kenek.pose('shout');
    honk();
    // build the convoy behind a clip so vehicles vanish into the gate
    const cid = uid('gate');
    const wrap = G(L_.angkot, { class: 'ak' });
    const cp = el('clipPath', { id: cid }, wrap); R(cp, -4000, 0, 5234, 800);
    const clipG = G(wrap, { 'clip-path': 'url(#' + cid + ')' });
    const train = G(clipG);
    const veh = [];
    let x = 640;
    for (let k = 0; k < B.tens; k++) {
      const m = G(train); place(m, x - 190, GROUND + 6, 0.95);
      const ma = miniAngkot(m, { full: true, shadow: true });
      veh.push({ front: x, val: 10, wheels: ma.wheels, r: 17 * 0.95 });
      x -= 240;
    }
    for (let k = 0; k < B.ones; k++) {
      const bk = buildBecak(train);
      setBecakX(bk, x - 70, GROUND + 6, 0.5);
      personNode(bk.seat, randVar(), 50, -58, 0.5, false);
      veh.push({ front: x, val: 1, wheels: bk.wheels, r: 34 * 0.5 });
      x -= 140;
    }
    const gateX = 1214;
    const dist = gateX - x + 220;
    let total = 0, counted = 0, lastSpoken = '';
    const speed = 380;
    engine(2);
    await tw(dist / speed * 1000, e => {
      const dx = e * dist;
      train.setAttribute('transform', 'translate(' + f1(dx) + ' 0)');
      veh.forEach(v => { const d = (dx / v.r) * 57.2958; v.wheels.forEach(w => w.setAttribute('transform', 'rotate(' + d.toFixed(1) + ')')); });
      while (counted < veh.length && veh[counted].front - 40 + dx >= gateX) {
        total += veh[counted].val;
        counted++;
        gate.num.textContent = String(total);
        if (!alive(t)) return;
        GS.sfx.count(Math.min(24, counted + 2));
        if (veh[counted - 1].val === 10) { lastSpoken = cap(words(total)); GS.say(lastSpoken + '!'); }
      }
    }, 'inOutCubic');
    wrap.remove();
    if (!alive(t)) return;
    kenek.pose('idle');
    await sleep(500);
    if (!alive(t)) return;
    if (total === mode.target) {
      GS.sfx.coin();
      hud.mood('cheer');
      floatAt(String(total), 1140, 330);
      GS.say('Pas! ' + cap(words(total)) + ' penumpang sampai di pasar.');
      await sleep(2600);
      if (!alive(t)) return;
      mode.round++;
      setPips(mode.round);
      mode.busy = false;
      if (mode.round >= mode.rounds) { finish('Hebat! Pesanan sampai dengan pas.'); return; }
      orderRound();
    } else {
      tries++; mode.roundTries++;
      GS.sfx.oops();
      hud.mood('oops');
      const diff = total - mode.target;
      floatAt((diff < 0 ? 'kurang ' : 'lebih ') + Math.abs(diff), 1140, 330);
      GS.say('Sampai ' + total + '. Pesanannya ' + mode.target + '. ' + (diff < 0 ? 'Kurang ' : 'Lebih ') + Math.abs(diff) + '.');
      if (mode.roundTries >= 2) { orderCard(mode.target, true); B.labels.style.display = ''; }
      await sleep(2400);
      if (!alive(t)) return;
      mode.gate.num.textContent = '0';
      B.locked = false; mode.busy = false; mode.btnSend.disabled = false;
      hud.mood('think');
    }
  }

  /* ------------------------------------------------------------------ debug / test hook */
  const until = (fn, ms) => new Promise((res, rej) => {
    const t0 = performance.now();
    (function poll() {
      if (fn()) return res();
      if (performance.now() - t0 > (ms || 60000)) return rej(new Error('timeout'));
      setTimeout(poll, 40);
    })();
  });
  window.__game = {
    go: i => run.go(i),
    speed: s => { SPEED = s || 1; },
    state: () => ({ level: LV, tries, finished, angkot: cur && { state: cur.state, count: cur.count }, halte: halte.map(g => g.n), mode: { phase: mode.phase, n: mode.n, target: mode.target, round: mode.round } }),
    board: g => boardGroup(g),
    halte: () => halte,
    async solve() {
      const t = tok;
      if (cfg.kind === 'pool') {
        while (alive(t) && !finished) {
          await until(() => finished || (cur && (cur.state === 'ready' || cur.state === 'overfull') && halte.every(g => g.state === 'halte')) || !alive(t));
          if (finished || !alive(t)) break;
          if (cur.loads.length) { await sendBack(); continue; }
          const plan = findPlan(halte, 10 - cur.count, pres.slice(1).map(p => 10 - p));
          if (!plan) throw new Error('no plan');
          for (const gr of plan) {
            await until(() => cur && cur.state === 'ready');
            await boardGroup(gr);
          }
          const done = departed;
          await until(() => finished || !alive(t) || departed > done, 30000);
        }
      } else if (cfg.kind === 'tens') {
        for (let r = 0; r < 2 && alive(t); r++) {
          while (mode.crowd.length >= 10) {
            await until(() => cur && cur.state === 'ready' && !mode.busy);
            await fillAngkot();
          }
          await until(() => cur && cur.state === 'ready' && !mode.busy);
          await callBecak();
          await until(() => mode.phase === 'compose');
          mode.board.dT = mode.board.tens; mode.board.dO = mode.board.ones;
          mode.board.setDigits(mode.board.dT, mode.board.dO);
          const rr = mode.round;
          checkTens();
          await until(() => mode.round > rr || finished, 20000);
        }
      } else {
        for (let r = 0; r < 2 && alive(t); r++) {
          await until(() => !mode.busy);
          const B = mode.board;
          B.tens = Math.floor(mode.target / 10); B.ones = mode.target % 10; B.renderIcons(); B.setDigits(B.tens, B.ones);
          const rr = mode.round;
          await kirim();
          await until(() => mode.round > rr || finished, 30000);
        }
      }
      await until(() => mode.won || !alive(t), 60000).catch(() => {});
      return { finished, won: !!mode.won, tries };
    }
  };

  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
