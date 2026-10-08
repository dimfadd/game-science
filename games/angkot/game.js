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
    if (n >= 1000) { const r = Math.floor(n / 1000), rest = n % 1000; return (r === 1 ? 'seribu' : words(r) + ' ribu') + (rest ? ' ' + words(rest) : ''); }
    if (n >= 100) { const r = Math.floor(n / 100), rest = n % 100; return (r === 1 ? 'seratus' : SAT[r] + ' ratus') + (rest ? ' ' + words(rest) : ''); }
    if (n < 10) return SAT[n];
    if (n === 10) return 'sepuluh';
    if (n === 11) return 'sebelas';
    if (n < 20) return SAT[n - 10] + ' belas';
    const t = Math.floor(n / 10), o = n % 10;
    return SAT[t] + ' puluh' + (o ? ' ' + SAT[o] : '');
  }
  const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function toScreen(x, y) {
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  }
  function floatAt(text, x, y, cls) { const s = toScreen(x, y); GS.floatText(text, s.x, s.y, cls); }

  /* speed factor for automated tests (window.__game.speed) */
  let SPEED = 1;
  const VX0 = () => (GS.stageView ? Math.min(0, GS.stageView.x0) : 0);
  const VX1 = () => (GS.stageView ? Math.max(1280, GS.stageView.x1) : 1280);
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
    R(bg, -600, 0, 2480, 800, 0, '#CFEDF0');
    R(bg, -600, 616, 2480, 30, 0, '#D4A062');
    R(bg, -600, 636, 2480, 170, 0, '#8E8A86');
  }
  const world = G(svg, { class: 'world' });
  let L_ = {};
  function makeLayers() {
    L_ = {};
    ['halte', 'gBack', 'gFront', 'angkot', 'kenek', 'fx', 'ui', 'drag', 'top'].forEach(k => { L_[k] = G(world, { class: 'ly-' + k }); });
  }

  /* ------------------------------------------------------------------ props: halte */
  function drawHalte(opts) {
    const h = G(L_.halte, { class: 'ak', 'data-qc': 'decor' });
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
  function buildAngkot(cap) {
    const A = { x: VX0() - 760, count: 0, loads: [], seats: [], roof: [], state: 'arriving', angTries: 0, cap: cap || 10 };
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
    if (A.cap === 5) {
      R(inter, 112, -268, 384, 12, 0, P.woodS);
      for (let c = 0; c < 5; c++) {
        const bx = colX(c);
        if (c % 2 === 0) { R(inter, bx - 20, -296, 40, 28, 8, [P.org, P.grn, P.pink][c / 2], OUT, 2.5); R(inter, bx - 6, -302, 12, 8, 3, 'none', OUT, 2.5); }
      }
    } else for (let c = 0; c < 5; c++) seatBack(inter, colX(c), -262, 82);
    A.far = G(idle, { 'clip-path': 'url(#' + winClip + ')' });
    const nearBacks = G(idle, { 'clip-path': 'url(#' + winClip + ')' });
    for (let c = 0; c < 5; c++) { if (A.cap === 5) seatBack(nearBacks, colX(c), -232, 120); else seatBack(nearBacks, colX(c), -186, 80); }
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
    T(idle, 452, -370, 'Pasar - Terminal', 26, P.ink, { class: 't-display', 'data-qc': 'decor' });
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
    A.hit = R(root, -24, -430, 640, 450, 24, '#fff', null, 0, { 'fill-opacity': 0, class: 'ak-hit', 'data-hit': 'angkot', tabindex: 0, role: 'button', 'aria-label': 'Angkot' });
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
  function seatPos(A, idx) {
    if (A && A.cap === 5) return { x: colX(idx), y: -96, layer: 'near', s: 0.8 };
    const c = idx % 5, row = Math.floor(idx / 5);
    return { x: colX(c), y: row === 0 ? -168 : -94, layer: row === 0 ? 'far' : 'near', s: SEAT_S };
  }
  function addSeat(A, idx, v, owner, instant) {
    const sp = seatPos(A, idx);
    const n = personNode(A[sp.layer], v, sp.x, sp.y, sp.s, false);
    A.seats[idx] = { node: n, owner, v };
    if (!instant) popIn(n, sp.x, sp.y, sp.s);
    if (!instant && TK) floatAt(String(idx + 1), A.x + sp.x, GROUND + sp.y - 120);
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
    for (let i = 0; i < A.cap; i++) {
      if (A.seats[i]) continue;
      const sp = seatPos(A, i);
      const top = A.cap === 5 ? -226 : sp.layer === 'far' ? -258 : -182;
      R(A.marks, sp.x - 25, top, 50, A.cap === 5 ? 110 : sp.layer === 'far' ? 70 : 66, 12, '#FFF8EC', P.sunS, 4, { 'stroke-dasharray': '10 7', 'fill-opacity': 0.55 });
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
    const A = buildAngkot(cfg.cap || 10);
    cur = A;
    for (let k = 0; k < pre; k++) addSeat(A, k, randVar(), 'pre', true);
    A.count = pre;
    engine(1.2);
    await drive(A, A.x, AK_X, 1300, 'outCubic', false);
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
    floatAt(String(A.cap), A.x + 300, GROUND - 420);
    await sleep(900);
    if (!alive(t)) return;
    await setDoor(A, false);
    for (let i = 0; i < 4; i++) spawnPuff(A.x - 16, GROUND - 40, 1.4);
    engine(1.6);
    GS.sfx.whoosh();
    await drive(A, A.x, VX1() + 40, 1500, 'inCubic', true);
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
      const bx0 = VX0() - 160;
      setBecakX(B, bx0, y, s);
      GS.tone({ f: 1500, t: 0.06, type: 'triangle', vol: 0.05 });
      GS.tone({ f: 1500, t: 0.06, type: 'triangle', vol: 0.05, delay: 0.1 });
      await tw(520, e => setBecakX(B, GS.lerp(bx0, stopX, e), y, s), 'outCubic');
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
      const bx1 = VX1() + 160;
      leaving.push(tw(1300, e => setBecakX(B, GS.lerp(stopX, bx1, e), y, s), 'inCubic').then(() => B.g.remove()));
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
    const w = Math.max(170, text.length * 19 + 44);
    const bx = KEN_X + 34, by = GROUND - 290;
    PA(g, 'M' + (bx + 18) + ' ' + (by + 50) + ' L' + (bx + 2) + ' ' + (by + 82) + ' L' + (bx + 44) + ' ' + (by + 50) + ' Z', '#fff', OUT, 3.5);
    R(g, bx, by - 8, w, 64, 28, '#fff', OUT, 3.5);
    PA(g, 'M' + (bx + 19) + ' ' + (by + 49) + ' L' + (bx + 43) + ' ' + (by + 49), 'none', '#fff', 5);
    T(g, bx + w / 2, by + 25, text, 34, P.ink, { class: 't-display' });
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
  function setPips(done, silent) {
    pips.forEach((m, k) => {
      const on = k < done, was = m.getAttribute('opacity') === '1';
      m.setAttribute('opacity', on ? '1' : '0.3');
      if (on && !was && !silent) { GS.sfx.coin(); }
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
    if (n === 1 && label === 'none') gr.single = true;
    gr.sq = G(gr.g);
    gr.bob = G(gr.sq);
    const B = gr.bob;
    // hit area (generous) + focus ring
    R(B, -W / 2 - 70, -166, W + 110, 188, 22, '#fff', null, 0, { 'fill-opacity': 0 });
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
      const sx = -W / 2 - 28;
      const dots = label === 'dots';
      R(sg, sx - 3, -84, 6, 86, 3, P.woodS, OUT, 2.5);
      R(sg, sx - 34, dots ? -160 : -140, 68, dots ? 84 : 62, 11, P.wood, OUT, 3);
      R(sg, sx - 28, dots ? -154 : -134, 56, dots ? 72 : 50, 8, P.cream, OUT, 2);
      if (label === 'both') T(sg, sx, -108, String(n), 50, P.ink, { class: 'gs-num' });
      else if (label === 'dots') {
        T(sg, sx, -131, String(n), 44, P.ink, { class: 'gs-num' });
        for (let d = 0; d < n; d++) C(sg, sx - (n - 1) * 6.5 + d * 13, -98, 5.6, gr.col[0], gr.col[1], 1.5);
      }
      else { const e = G(sg); place(e, sx, -109, 1.4); emblem(e, gr.emb, gr.col); }
    }
    if (gr.single) sg.style.display = 'none';
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
      gr.x = VX0() - 140 - made.length * 60; gr.y = sl.y; gr.s = sl.s;
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
    await walkTo(gr, VX0() - 170, gr.y, gr.s, 900);
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
    if (TK && cur && cur.state === 'ready') { GS.sfx.pick(); boardGroup(gr); return; }
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
      if (idx < A.cap) addSeat(A, idx, p.v, gr);
      else { addRoof(A, idx - A.cap, p.v, gr); GS.sfx.creak(); }
      GS.sfx.count(idx + 1);
      await sleep(250);
    }
    if (!alive(t)) return;
    gr.g.style.display = 'none';
    await sleep(220);
    if (!alive(t)) return;
    if (A.count === A.cap) poolDepart(A);
    else if (A.count > A.cap) overfull(A);
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
    const left = A.cap - A.count;
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
    A.roof.forEach((o, j) => { if (o && o.owner === gr) mine.push({ o, idx: A.cap + j }); });
    A.seats.forEach((o, i) => { if (o && o.owner === gr) mine.push({ o, idx: i }); });
    mine.sort((a, b) => b.idx - a.idx);
    for (const m of mine) {
      if (!alive(t)) return;
      const tr = m.o.node.getAttribute('transform') || '';
      const mm = /translate\(([-\d.]+) ([-\d.]+)\)(?: scale\(([-\d.]+)\))?/.exec(tr);
      if (mm) popOut(m.o.node, +mm[1], +mm[2], mm[3] ? +mm[3] : 1); else m.o.node.remove();
      if (m.idx >= A.cap) A.roof[m.idx - A.cap] = null; else A.seats[m.idx] = null;
      A.count--;
      GS.sfx.pop();
      await sleep(110);
    }
    A.roof = A.roof.filter(Boolean);
    A.seats.length = Math.min(A.seats.length, A.cap);
    if (A.count <= A.cap) A.shake.classList.remove('ak-rumble');
    // the group re-forms at the door and walks back
    gr.g.style.display = '';
    gr.signG.style.display = gr.single ? 'none' : '';
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
  /** Angkot pre-filled with a; three groups, exactly one completes the angkot. */
  function choiceRound(capN, lo, hi) {
    const a = rnd(lo, hi), need = capN - a;
    const cands = [need - 2, need - 1, need + 1, need + 2, need + 3].filter(d => d >= 1 && d <= capN - 1 && d !== need);
    let d1, d2, guard = 0;
    do { d1 = pick(cands); d2 = pick(cands); guard++; } while ((d1 === d2 || d1 + d2 === need) && guard < 200);
    return { angkots: [a], groups: GS.shuffle([{ n: need }, { n: d1, d: 'decoy' }, { n: d2, d: 'decoy' }]) };
  }
  function singles(n, extra) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ n: 1 });
    for (let i = 0; i < extra; i++) out.push({ n: 1, d: 'decoy' });
    return out;
  }
  function strayFor(waves, cands) {
    for (const d of GS.shuffle(cands || [9, 8, 7, 1])) {
      const ok = waves.every(w => !w.needs.some(nd => d === nd || subsetExists(w.sizes, nd - d)));
      if (ok) return d;
    }
    return 9;
  }
  const PL = o => Object.assign({ type: 'pool', cap: 10, label: 'none' }, o);
  const digitsOf = (n, units) => units.map(u => Math.floor(n / u) % 10);
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const lcm = (a, b) => { let x = a; while (x % b) x += a; return x; };

  function calcBuild(units, lo, hi) {
    let n; do { n = rnd(lo, hi); } while (n % 10 === 0);
    return { type: 'calc', mode: 'build', units, target: n };
  }
  function readRound(units, lo, hi, zero) {
    let n;
    do { n = rnd(lo, hi); if (zero) { const d = digitsOf(n, units); d[units.length - 2] = 0; n = d.reduce((s, v, i) => s + v * units[i], 0); } } while (n < lo || n % 10 === 0);
    return { type: 'calc', mode: 'count', op: 'read', units, parts: [n] };
  }
  function sumRound2(carry) {
    let a, b;
    do { a = rnd(11, 59); b = rnd(11, 39); } while (a % 10 === 0 || b % 10 === 0 || (carry ? (a % 10) + (b % 10) < 11 : (a % 10) + (b % 10) > 9) || a + b > 99);
    return { type: 'calc', mode: 'count', op: 'sum', units: [10, 1], parts: [a, b], icons: true };
  }
  function subRound(tensOnly) {
    let a, b;
    do {
      a = rnd(31, 89);
      const ta = Math.floor(a / 10), oa = a % 10;
      b = tensOnly ? 10 * rnd(1, ta - 1) : 10 * rnd(1, ta - 1) + rnd(1, Math.max(1, oa));
      if (!tensOnly && b % 10 > oa) b = -1;
    } while (b <= 0 || a % 10 === 0);
    return { type: 'calc', mode: 'count', op: 'sub', units: [10, 1], parts: [a], take: b };
  }
  function sum3Round() {
    let a, b, c;
    do { a = rnd(101, 399); b = rnd(101, 399); c = rnd(11, 99); } while (a + b + c > 999);
    return { type: 'calc', mode: 'count', op: 'sum', units: [100, 10, 1], parts: [a, b, c] };
  }
  function multRound(capN, lo, hi) {
    const cnt = rnd(lo, hi);
    return { type: 'calc', mode: 'count', op: 'mult', cap: capN, cnt, units: capN * cnt >= 100 ? [100, 10, 1] : [10, 1] };
  }
  function estRound() {
    let parts, tot;
    do { parts = [rnd(95, 330), rnd(95, 330), rnd(95, 330)]; tot = parts[0] + parts[1] + parts[2]; } while (tot % 100 === 50 || tot > 990 || parts.every(x => x % 100 < 10));
    return { type: 'calc', mode: 'count', op: 'est', units: [100, 10, 1], parts, lock: [false, true, true] };
  }
  function shareRound(rem) {
    const N = rnd(3, 5), k = rnd(3, Math.min(8, Math.floor((rem ? 38 : 40) / N)));
    const r = rem ? rnd(1, N - 1) : 0;
    return { type: 'share', N, k, n: N * k + r, rem: r };
  }
  function fleetRound(how, c) {
    const m = rnd(2, 5);
    const n = how === 'ceil' ? (m - 1) * c + rnd(1, c - 1) : m * c + rnd(1, c - 1);
    return { type: 'fleet', how, c, n, m };
  }
  function multiRound(pr) { const [a, b] = GS.shuffle(pr); return { type: 'multi', a, b }; }
  const PAIRS = [[6, 8], [4, 6], [3, 4], [4, 10], [6, 9], [3, 5]];
  function cmpRound(kind) {
    let A, B;
    do {
      A = rnd(21, 98); B = rnd(21, 98);
      if (kind === 'ones') B = Math.floor(A / 10) * 10 + rnd(0, 9);
      if (kind === 'eq') B = A;
    } while ((kind !== 'eq' && A === B) || (kind === 'tens' && Math.floor(A / 10) === Math.floor(B / 10)) || A % 10 === 0 || B % 10 === 0);
    return { type: 'compare', A, B };
  }

  /* ------------------------------------------------------------------ levels per grade tier (docs/KURIKULUM.md) */
  const TIER = (GS.tier && GS.tier()) || 'k1';
  const TK = TIER === 'tk';
  const LEVELS_BY_TIER = {
    tk: [
      { say: 'Ketuk penumpang satu per satu. Hitung sampai penuh!', rounds: () => [PL({ cap: 5, waves: [{ angkots: [0], groups: singles(5, 1) }] })] },
      { say: 'Sudah ada yang duduk. Ajak lagi sampai penuh!', rounds: () => { const a = rnd(1, 3); return [PL({ cap: 5, waves: [{ angkots: [a], groups: singles(5 - a, 2) }] })]; } },
      { say: 'Rombongan mana yang pas? Ketuk dia!', rounds: () => [PL({ cap: 5, label: 'dots', waves: [choiceRound(5, 1, 3)] })] },
      { say: 'Angkot kosong. Dua rombongan sampai penuh!', rounds: () => [PL({ cap: 5, label: 'dots', waves: [{ angkots: [0, 0], groups: GS.shuffle(G_([1, 4, 2, 3])) }] })] },
      { say: 'Dua angkot menunggu. Isi sampai penuh!', rounds: () => [PL({ cap: 5, label: 'dots', waves: [choiceRound(5, 1, 3), choiceRound(5, 1, 3)] })] },
      { say: 'Hitung orangnya, ya. Isi sampai penuh!', rounds: () => {
        const a = rnd(1, 2), d = pick([1, 2, 3, 4].filter(x => x !== a && x !== 5 - a));
        return [PL({ cap: 5, waves: [choiceRound(5, 1, 3), { angkots: [0], groups: GS.shuffle(G_([a, 5 - a]).concat([{ n: d, d: 'decoy' }])) }] })];
      } }
    ],
    k1: [
      { say: 'Angkot belum penuh. Pilih rombongan yang pas!', rounds: () => [PL({ waves: [choiceRound(10, 3, 7)] })] },
      { say: 'Dua angkot menunggu. Isi sampai tepat sepuluh!', rounds: () => [PL({ waves: [choiceRound(10, 3, 7), choiceRound(10, 3, 7)] })] },
      { say: 'Angkot kosong. Gabungkan dua rombongan jadi sepuluh!', rounds: () => { const as = GS.shuffle([2, 3, 4, 5]).slice(0, 3); return [PL({ waves: [{ angkots: [0, 0, 0], groups: GS.shuffle(G_(as.flatMap(a => [a, 10 - a]))) }] })]; } },
      { say: 'Lihat angkanya. Pasangkan jadi sepuluh!', rounds: () => { const as = GS.shuffle([1, 2, 3, 4, 5]).slice(0, 4); return [PL({ label: 'both', waves: [
        { angkots: [0, 0], groups: GS.shuffle(G_([as[0], 10 - as[0], as[1], 10 - as[1]])) },
        { angkots: [0, 0], groups: GS.shuffle(G_([as[2], 10 - as[2], as[3], 10 - as[3]])) }] })]; } },
      { say: 'Tiga rombongan untuk satu angkot. Ayo isi!', rounds: () => [PL({ label: 'both', waves: [
        { angkots: [0, 0], groups: GS.shuffle(G_(triple(1).concat(triple(2)))) },
        { angkots: [0], groups: GS.shuffle(G_(triple(1))) }] })] },
      { say: 'Isi tepat sepuluh. Ada rombongan yang tidak cocok, lho!', rounds: () => {
        const w1 = pair(2, 5).concat(triple(2)), w2 = pair(2, 5).concat(triple(2));
        const d = strayFor([{ needs: [10], sizes: w1 }, { needs: [10], sizes: w2 }]);
        return [PL({ label: 'both', waves: [
          { angkots: [0, 0], groups: GS.shuffle(G_(w1).concat([{ n: d, d: 'stray' }])) },
          { angkots: [0, 0], groups: GS.shuffle(G_(w2)) }] })];
      } },
      { say: 'Sekarang hanya angka. Isi tepat sepuluh!', rounds: () => [PL({ label: 'num', waves: [
        { angkots: [0, 0], groups: GS.shuffle(G_(pair(1, 5).concat(triple(1)))) },
        { angkots: [0, 0], groups: GS.shuffle(G_(triple(1).concat(pair(1, 5)))) }] })] },
      { say: 'Tantangan! Lima angkot, tanpa angka.', rounds: () => {
        const a = rnd(2, 5), need = 10 - a, sp = split2(need);
        const d = strayFor([{ needs: [need], sizes: sp }], [1, 2, 3, 4].filter(x => x !== need));
        return [PL({ summary: true, waves: [
          { angkots: [0, 0], groups: GS.shuffle(G_(pair(1, 5).concat(triple(1)))) },
          { angkots: [0, 0], groups: GS.shuffle(G_(quad().concat(pair(1, 5)))) },
          { angkots: [a], groups: GS.shuffle(G_(sp).concat([{ n: d, d: 'stray' }])) }] })];
      } }
    ],
    k2: [
      { say: 'Ketuk Isi angkot! Sisanya naik becak.', rounds: () => [{ type: 'tens', lo: 21, hi: 59 }] },
      { say: 'Kerumunan besar! Isi angkot, sisanya naik becak.', rounds: () => [{ type: 'tens', lo: 61, hi: 99 }] },
      { say: 'Ada pesanan! Kirim penumpang ke pasar.', rounds: () => [calcBuild([10, 1], 21, 49), calcBuild([10, 1], 21, 49)] },
      { say: 'Pesanan besar! Atur angkot dan becak.', rounds: () => [calcBuild([10, 1], 51, 99), calcBuild([10, 1], 51, 99)] },
      { say: 'Dua rombongan digabung. Berapa semuanya?', rounds: () => [sumRound2(false), sumRound2(false)] },
      { say: 'Ada yang turun di halte. Berapa sisanya?', rounds: () => [subRound(true), subRound(false)] },
      { say: 'Terminal mana yang lebih ramai?', rounds: () => [cmpRound('tens'), cmpRound('ones'), cmpRound(Math.random() < 0.5 ? 'eq' : 'ones')] },
      { say: 'Tantangan! Gabung, kirim, dan bandingkan.', rounds: () => [sumRound2(true), calcBuild([10, 1], 51, 99), cmpRound('ones')] }
    ],
    k3: [
      { say: 'Satu bus isi seratus. Berapa penumpangnya?', rounds: () => [readRound([100, 10, 1], 120, 499), readRound([100, 10, 1], 501, 999)] },
      { say: 'Hati-hati, ada kolom yang kosong!', rounds: () => [readRound([100, 10, 1], 101, 999, true), readRound([100, 10, 1], 101, 999, true)] },
      { say: 'Kirim ratusan penumpang ke pasar!', rounds: () => [calcBuild([100, 10, 1], 101, 499), calcBuild([100, 10, 1], 501, 999)] },
      { say: 'Angkot penuh semua. Berapa penumpangnya?', rounds: () => [multRound(10, 3, 9), multRound(pick([6, 7, 8]), 3, 6)] },
      { say: 'Bagi penumpang sama rata ke semua angkot!', rounds: () => [shareRound(false), shareRound(false)] },
      { say: 'Bagi sama rata. Sisanya naik becak!', rounds: () => [shareRound(true), shareRound(true)] },
      { say: 'Tiga rombongan digabung. Berapa semuanya?', rounds: () => [sum3Round(), sum3Round()] },
      { say: 'Tantangan! Bus, angkot, dan becak.', rounds: () => [calcBuild([100, 10, 1], 101, 999), shareRound(true), multRound(pick([6, 7, 8, 9]), 4, 9)] }
    ],
    k4: [
      { say: 'Satu kereta isi seribu. Hitung penumpangnya!', rounds: () => [readRound([1000, 100, 10, 1], 1001, 9999), calcBuild([1000, 100, 10, 1], 1001, 9999)] },
      { say: 'Semua harus terangkut. Butuh berapa angkot?', rounds: () => [fleetRound('ceil', 10), fleetRound('ceil', 10)] },
      { say: 'Berapa angkot yang penuh? Sisanya naik becak.', rounds: () => [fleetRound('floor', rnd(6, 9)), fleetRound('floor', rnd(6, 9))] },
      { say: 'Cari jumlah yang membuat dua angkot sama-sama penuh!', rounds: () => { const ps = GS.shuffle(PAIRS); return [multiRound([6, 8]), multiRound(ps.find(p => p[0] !== 6 || p[1] !== 8))]; } },
      { say: 'Banyak angkot penuh. Berapa semua penumpangnya?', rounds: () => [multRound(rnd(6, 9), 11, 15), multRound(rnd(6, 9), 11, 15)] },
      { say: 'Kira-kira berapa? Bulatkan ke ratusan.', rounds: () => [estRound(), estRound()] },
      { say: 'Campuran! Pikirkan baik-baik.', rounds: () => [fleetRound('ceil', pick([6, 8])), multRound(rnd(6, 9), 11, 15), multiRound(pick(PAIRS))] },
      { say: 'Tantangan besar! Kereta, angkot, dan becak.', rounds: () => [calcBuild([1000, 100, 10, 1], 1001, 9999), fleetRound('floor', rnd(6, 9)), estRound()] }
    ]
  };
  const LEVELS = LEVELS_BY_TIER[TIER] || LEVELS_BY_TIER.k1;

  /* ------------------------------------------------------------------ HUD + runner */
  const hud = GS.hud({ gameId: GAME, title: 'Angkot Penuh!', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: buildLevel });

  /* ------------------------------------------------------------------ level / round state */
  let cfg = {}, LV = 0, tries = 0, cur = null, kenek = null, halte = [], selected = null, dragging = null;
  let finished = false, tapHinted = false, waves = [], waveIdx = 0, pres = [], departed = 0, btnDown = null;
  let mode = {}, rounds = [], roundIdx = 0, levelWon = false, levelTok = 0, roundReady = false, levelDef = null;

  function buildLevel(i) {
    levelTok++;
    LV = i; levelDef = LEVELS[i]; tries = 0; levelWon = false; tapHinted = false;
    colorCursor = rnd(0, 5);
    rounds = levelDef.rounds();
    roundIdx = 0;
    startRound(true);
  }
  function resetWorld() {
    tok++;
    timers.forEach(clearTimeout); timers = [];
    clearTimeout(bubbleT);
    world.innerHTML = '';
    dock.innerHTML = '';
    makeLayers();
    cur = null; halte = []; selected = null; dragging = null; finished = false; departed = 0; btnDown = null; mode = {}; kenek = null;
  }
  function startRound(first) {
    resetWorld();
    cfg = rounds[roundIdx];
    cfg.kind = cfg.type;
    const say = first ? levelDef.say : null;
    const T_ = cfg.type;
    if (T_ !== 'multi' && T_ !== 'compare') drawHalte({ noPoster: T_ === 'calc' });
    if (T_ === 'multi') kenek = drawKenek(1212, GROUND + 14);
    else if (T_ === 'compare') kenek = drawKenek(640, GROUND + 14);
    else kenek = drawKenek(KEN_X, GROUND + 14);
    if (T_ === 'calc') kenek.root.style.display = 'none';
    hud.mood('think');
    if (rounds.length > 1 || T_ !== 'pool') { drawPips(rounds.length, 'dot'); setPips(roundIdx, true); }
    roundReady = true;
    ({ pool: startPool, tens: startTens, calc: startCalc, share: startShare, fleet: startFleet, multi: startMulti, compare: startCompare })[T_](say);
  }
  function roundDone(text) {
    if (!roundReady) return;
    roundReady = false;
    roundIdx++;
    if (roundIdx >= rounds.length) { finish(text); return; }
    setPips(roundIdx);
    hud.mood('happy');
    timers.push(setTimeout(() => startRound(false), 1300 / SPEED));
  }
  function finish(text) {
    if (levelWon) return;
    levelWon = true; finished = true;
    const stars = tries === 0 ? 3 : tries <= 2 ? 2 : 1;
    hud.mood('cheer');
    if (kenek) kenek.pose('shout');
    updateDock();
    run.win(stars, text || 'Hebat! Semua angkot berangkat.');
  }
  function sayFirst(say, fallback) { GS.say(say || fallback); }

  /* ================================================================== POOL ROUNDS (TK, Kelas 1) */
  function startPool(say) {
    waves = cfg.waves;
    waveIdx = -1;
    const total = waves.reduce((s, w) => s + w.angkots.length, 0);
    if (rounds.length === 1) drawPips(total, 'angkot');
    const maxG = Math.max.apply(null, waves.map(w => w.groups.length));
    const big = maxG <= 3;
    const allSingle = waves.every(w => w.groups.every(g => g.n === 1));
    const mul = TK ? (allSingle ? 1.75 : big ? 1.12 : 1.22) : 1;
    slots = (big ? SLOTS_BIG : SLOTS_ALL).map(s => Object.assign({}, s, { occ: null, s: s.s * mul }));
    btnDown = mkBtn('Turunkan', true, () => sendBack(), GS.ICON.retry);
    btnDown.hidden = true;
    sayFirst(say, 'Isi angkot sampai penuh!');
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
    if (rounds.length === 1) setPips(departed);
    cur = null;
    pres.shift();
    hud.mood('happy');
    if (pres.length) {
      const needs = pres.map(p => cfg.cap - p);
      if (!canSolve(halte, needs)) await rebalance(needs);
      if (!alive(t)) return;
      arriveAngkot(pres[0], { say: pick(['Angkot berikutnya datang!', 'Ayo, angkot baru!']) });
    } else if (waveIdx < waves.length - 1) {
      await Promise.all(halte.filter(g => g.d !== 'stray').map(g => walkOff(g)));
      if (!alive(t)) return;
      nextWave(false);
    } else {
      poolDone();
    }
  }
  async function rebalance(needs) {
    const olds = halte.filter(g => !g.d);
    await Promise.all(olds.map(g => walkOff(g)));
    await spawnGroups(needs.flatMap(nd => split2(nd)).map(n => ({ n })));
  }
  async function poolDone() {
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
    if (cfg.summary) {
      await showSummary(departed);
      if (!alive(t)) return;
    }
    await sleep(350);
    if (!alive(t)) return;
    roundDone(cfg.summary ? 'Luar biasa! Lima angkot penuh.' : TK ? 'Hore! Angkotnya penuh.' : 'Hebat! Semua angkot penuh.');
  }
  async function showSummary(n) {
    const g = G(L_.top, { class: 'ak' });
    R(g, 250, 120, 780, 300, 30, P.cream, OUT, 4);
    T(g, 640, 172, 'Angkot yang berangkat hari ini', 36, P.ink, { class: 't-display' });
    const items = [];
    for (let k = 0; k < n; k++) {
      const m = G(g, { opacity: 0 });
      const x = 640 - (n - 1) * 72 + k * 144 - 60;
      const ic = G(m); place(ic, x, 300, 0.6); miniAngkot(ic, { full: true, sw: 5 });
      T(m, x + 60, 340, '10', 42, P.ui, { class: 'gs-num' });
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
    GS.say(Cap(words(n)) + ' angkot penuh. ' + Cap(words(n * 10)) + ' penumpang!');
    await sleep(2600);
  }

  /* ------------------------------------------------------------------ more vehicles: bus, train, angkot with any capacity */
  function miniBus(p, opts) {
    opts = opts || {};
    const g = G(p, { class: 'ak' });
    const sw = opts.sw || 4;
    if (opts.shadow) E(g, 136, 2, 136, 7, OUT, null, 0, { opacity: 0.18 });
    PA(g, 'M6 -30 V-126 Q6 -142 22 -142 H246 Q262 -142 265 -126 L270 -42 Q270 -24 254 -24 H18 Q6 -24 6 -30 Z', P.org, OUT, sw);
    R(g, 20, -138, 170, 7, 3.5, P.orgH);
    R(g, 8, -50, 260, 12, 0, P.orgS);
    R(g, 8, -64, 260, 9, 0, P.cream);
    for (let i = 0; i < 8; i++) {
      R(g, 22 + i * 27, -126, 23, 50, 5, '#F6E6C9', OUT, sw * 0.6);
      if (opts.full) { C(g, 33.5 + i * 27, -108, 7, ['#E0A87A', '#C98B5E', '#8A5A3C', '#EBC39C'][i % 4], OUT, 1.8); C(g, 33.5 + i * 27, -88, 7, ['#C98B5E', '#EBC39C', '#E0A87A', '#8A5A3C'][i % 4], OUT, 1.8); }
    }
    R(g, 242, -126, 22, 56, 6, P.glass, OUT, sw * 0.6);
    R(g, 70, -160, 140, 18, 6, P.cream, OUT, sw * 0.75);
    C(g, 266, -40, 7, '#FFF6D8', OUT, sw * 0.6);
    const wh = [wheel(g, 58, -22, 21), wheel(g, 214, -22, 21)];
    return { g, wheels: wh };
  }
  function miniTrain(p, opts) {
    opts = opts || {};
    const g = G(p, { class: 'ak' });
    const sw = opts.sw || 4;
    if (opts.shadow) E(g, 166, 2, 166, 7, OUT, null, 0, { opacity: 0.18 });
    R(g, 0, -12, 334, 6, 3, P.stoneS);
    const wh = [];
    [0, 104].forEach(x0 => {
      R(g, x0 + 4, -112, 96, 90, 12, P.grn, OUT, sw);
      R(g, x0 + 10, -106, 60, 6, 3, P.grnH);
      R(g, x0 + 4, -46, 96, 8, 0, P.sun);
      for (let k = 0; k < 3; k++) {
        R(g, x0 + 12 + k * 29, -96, 24, 34, 5, '#F6E6C9', OUT, sw * 0.6);
        if (opts.full) C(g, x0 + 24 + k * 29, -82, 7, ['#E0A87A', '#C98B5E', '#8A5A3C'][k], OUT, 1.8);
      }
      wh.push(wheel(g, x0 + 26, -18, 12), wheel(g, x0 + 78, -18, 12));
    });
    R(g, 100, -70, 8, 10, 2, OUT);
    PA(g, 'M212 -24 V-108 Q212 -122 226 -122 H296 Q324 -122 330 -92 V-24 Z', P.red, OUT, sw);
    R(g, 222, -116, 50, 6, 3, P.redH);
    R(g, 284, -110, 34, 30, 6, P.glass, OUT, sw * 0.6);
    R(g, 212, -46, 118, 8, 0, P.sun);
    C(g, 328, -40, 7, '#FFF6D8', OUT, sw * 0.6);
    wh.push(wheel(g, 240, -18, 14), wheel(g, 300, -18, 14));
    return { g, wheels: wh };
  }
  /** Angkot with any capacity: seats in two rows (ten-frame style); odd capacity leaves one cell for luggage. */
  const HEADC = ['#E0A87A', '#C98B5E', '#8A5A3C', '#EBC39C'];
  function capAngkot(p, capN, opts) {
    opts = opts || {};
    const cols = Math.ceil(capN / 2), L = 70 + cols * 26 + 36;
    const g = G(p, { class: 'ak' });
    const sw = opts.sw || 4;
    if (opts.shadow) E(g, L / 2, 2, L / 2, 7, OUT, null, 0, { opacity: 0.18 });
    const shake = G(g);
    PA(shake, 'M6 -30 V-92 Q6 -106 20 -106 H' + (L - 32) + ' Q' + (L - 20) + ' -106 ' + (L - 16) + ' -96 L' + (L - 4) + ' -66 V-32 Q' + (L - 4) + ' -22 ' + (L - 14) + ' -22 H16 Q6 -22 6 -30 Z', P.blue, OUT, sw);
    R(shake, 18, -102, L * 0.55, 6, 3, P.blueH);
    R(shake, 8, -50, L - 12, 10, 0, P.sun);
    R(shake, 12, -94, 24, 64, 5, P.blueS, OUT, sw * 0.6);
    R(shake, 42, -96, cols * 26 + 6, 42, 7, '#F6E6C9', OUT, sw * 0.75);
    PA(shake, 'M' + (L - 26) + ' -96 L' + (L - 18) + ' -96 L' + (L - 8) + ' -66 L' + (L - 26) + ' -66 Z', P.glass, OUT, sw * 0.75);
    C(shake, L - 4, -42, 6, '#FFF6D8', OUT, sw * 0.6);
    const seats = [];
    for (let i = 0; i < cols * 2; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const x = 58 + c * 26, y = r ? -66 : -84;
      if (i < capN) { seats.push({ x, y }); C(shake, x, y, 7.5, '#E9D9BC', '#CDB894', 2); }
      else { PA(shake, 'M' + (x - 8) + ' ' + (y + 8) + ' Q' + (x - 9) + ' ' + (y - 6) + ' ' + x + ' ' + (y - 8) + ' Q' + (x + 9) + ' ' + (y - 6) + ' ' + (x + 8) + ' ' + (y + 8) + ' Z', P.woodH, OUT, 1.6); }
    }
    if (opts.sign !== false) {
      R(shake, L / 2 - 34, -124, 68, 20, 6, P.cream, OUT, sw * 0.7);
      T(shake, L / 2, -114, 'isi ' + capN, 15, P.ink, { class: 'gs-num', 'data-qc': 'decor' });
    }
    const heads = G(shake);
    const wh = [wheel(shake, 44, -20, 17), wheel(shake, L - 40, -20, 17)];
    const A = { g, shake, wheels: wh, L, seats, filled: 0, cap: capN, headG: heads };
    A.fill = function () {
      if (A.filled >= A.seats.length) return false;
      const s = A.seats[A.filled++];
      const h = G(heads);
      C(h, s.x, s.y, 8, HEADC[(A.filled + s.x) % 4], OUT, 1.8);
      PA(h, 'M' + (s.x - 7.5) + ' ' + (s.y - 2) + ' Q' + s.x + ' ' + (s.y - 13) + ' ' + (s.x + 7.5) + ' ' + (s.y - 2) + ' Z', OUT);
      return true;
    };
    A.clear = function () { heads.innerHTML = ''; A.filled = 0; };
    if (opts.full) for (let i = 0; i < capN; i++) A.fill();
    return A;
  }

  /* ------------------------------------------------------------------ board: place-value columns with steppers */
  const UNITS = { 1000: { title: 'RIBUAN', icon: 'train' }, 100: { title: 'RATUSAN', icon: 'bus' }, 10: { title: 'PULUHAN', icon: 'angkot' }, 1: { title: 'SATUAN', icon: 'becak' } };
  function iconFor(p, kind, x, y, w, extra) {
    const m = G(p);
    if (kind === 'angkot') { place(m, x, y, w / 200); miniAngkot(m, { sw: 8, full: extra && extra.full }); }
    else if (kind === 'bus') { place(m, x, y, w / 270); miniBus(m, { sw: 9 }); }
    else if (kind === 'train') { place(m, x, y, w / 334); miniTrain(m, { sw: 10 }); }
    else if (kind === 'becak') { place(m, x + w / 2, y, w / 250); buildBecakIcon(m); }
    else if (kind === 'cap') { const cpA = capAngkot(G(m), extra.cap, { sw: 7, sign: false, full: extra.full }); place(m, x, y, w / cpA.L); }
    else if (kind === 'dot') { place(m, x + w / 2, y - 14, 1); C(m, 0, 0, 13, HEADC[Math.floor(x) % 4], OUT, 2.5); PA(m, 'M-12 -3 Q0 -18 12 -3 Z', OUT); }
    return m;
  }
  function makeBoard(colsIn, opts) {
    opts = opts || {};
    const cols = colsIn.map(c => typeof c === 'number' ? Object.assign({ unit: c }, UNITS[c]) : c);
    const n = cols.length, layout = opts.layout || (n >= 3 ? 'col' : 'row');
    const W = layout === 'row' ? 330 : n <= 2 ? 156 : n === 3 ? 142 : 134;
    const H = layout === 'row' ? 266 : 476;
    const width = n * W + 28;
    const B = { cols, vals: cols.map(() => 0), dig: cols.map(() => 0), locks: cols.map(() => false), boxes: [], iconG: [], x0: [], W, width, locked: false, onStep: () => {} };
    const bx = opts.x != null ? opts.x : 12, by = opts.y != null ? opts.y : 8;
    const g = G(L_.ui, { class: 'ak' });
    place(g, bx, by);
    B.g = g; B.bx = bx; B.by = by;
    R(g, 0, 0, width, H, 22, P.wood, OUT, 4);
    R(g, 8, 5, 200, 6, 3, P.woodH);
    R(g, 14, 14, n * W, H - 28, 14, '#2F6B4C', OUT, 3);
    B.labels = G(g, { style: 'display:none' });
    B.steps = G(g, { style: 'display:none' });
    const hs = n === 1 ? 44 : layout === 'row' ? 34 : n >= 4 ? 30 : 34;
    const isRow = layout === 'row';
    const bw = isRow ? 92 : Math.min(W - 16, 112), bh = 84;
    cols.forEach((c, i) => {
      const x0 = 14 + i * W, cx = x0 + W / 2;
      B.x0.push(x0);
      if (i) PA(g, 'M' + x0 + ' 26 V' + (H - 26), 'none', '#E8F0E0', 3, { 'stroke-dasharray': '2 10', opacity: 0.7 });
      T(g, cx, 46, c.title, hs, P.cream, { class: 't-display' });
      B.iconG.push(G(g));
      const d = G(g);
      const dy = isRow ? 206 : 322;
      R(d, cx - 44, dy - 39, 88, 78, 14, P.cream, OUT, 3);
      B.boxes.push({ g: d, t: T(d, cx, dy + 2, '?', 58, P.ink, { class: 'gs-num' }), cx });
      const pos = isRow ? [[cx - 108, dy], [cx + 108, dy]] : [[cx, 226], [cx, 418]];
      [-1, 1].forEach((sign, si) => {
        const at = isRow ? pos[si] : pos[sign > 0 ? 0 : 1];
        const b = G(B.steps, { class: 'ak-btn', tabindex: 0, role: 'button', 'aria-label': (sign > 0 ? 'Tambah ' : 'Kurangi ') + c.title.toLowerCase() });
        place(b, at[0], at[1]);
        R(b, -Math.max(bw, 108) / 2, -55, Math.max(bw, 108), 110, 18, '#fff', null, 0, { 'fill-opacity': 0, 'data-hit': 'stepper' });
        const f = G(b);
        R(f, -bw / 2, -bh / 2, bw, bh, 18, P.ui, OUT, 3.5);
        R(f, -bw / 2 + 9, -bh / 2 + 7, 34, 9, 4.5, '#5E9BE6');
        PA(f, sign > 0 ? 'M-15 0 H15 M0 -15 V15' : 'M-15 0 H15', 'none', '#fff', 7);
        R(b, -bw / 2 - 6, -bh / 2 - 6, bw + 12, bh + 12, 20, 'none', P.sun, 4, { class: 'ak-ring' });
        const act = () => {
          if (B.locked || B.locks[i]) return;
          tw(160, e => place(f, 0, 0, e < 0.4 ? 1 - 0.2 * (e / 0.4) : 0.92 + 0.08 * ((e - 0.4) / 0.6)), 'linear');
          GS.sfx.tick();
          B.onStep(i, sign);
        };
        b.addEventListener('click', act);
        b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
        b.__col = i;
      });
    });
    B.render = function (popIdx) {
      B.labels.innerHTML = '';
      cols.forEach((c, i) => {
        B.iconG[i].innerHTML = '';
        const per = isRow ? 5 : 3;
        const sp = isRow ? Math.min(52, (W - 24) / 5) : (W - 16) / 3, w = sp * 0.9;
        for (let k = 0; k < B.vals[i]; k++) {
          const x = B.x0[i] + (isRow ? 14 : 9) + (k % per) * sp, y = (isRow ? 104 : 98) + Math.floor(k / per) * (isRow ? 46 : 38);
          const m = iconFor(B.iconG[i], c.icon, x, y, w, c);
          if (popIdx === i && k === B.vals[i] - 1) { const tr = m.getAttribute('transform'); tw(220, e => m.setAttribute('transform', tr + ' scale(' + Math.max(0.01, e).toFixed(3) + ')'), 'outBack'); }
        }
        if (c.unit && B.vals[i]) {
          const cx = B.x0[i] + W / 2, ly = isRow ? 128 : 150;
          const txt = '= ' + fmt(B.vals[i] * c.unit);
          R(B.labels, cx - txt.length * 11 - 10, ly - 24, txt.length * 22 + 20, 48, 14, '#1E4A33', null, 0, { opacity: 0.92 });
          T(B.labels, cx, ly + 1, txt, 38, P.sunH, { class: 'gs-num' });
        }
      });
    };
    B.setDigit = (i, v) => { B.boxes[i].t.textContent = v; };
    B.setDigits = arr => arr.forEach((v, i) => B.setDigit(i, v));
    B.showSteps = on => {
      B.steps.style.display = on ? '' : 'none';
      [...B.steps.children].forEach(b => { b.style.display = B.locks[b.__col] ? 'none' : ''; });
    };
    B.mark = ok => B.boxes.forEach(bx2 => { const r = bx2.g.querySelector('rect'); r.setAttribute('fill', ok ? '#E3F4F1' : P.cream); r.setAttribute('stroke', ok ? P.teal : OUT); });
    B.number = () => B.dig.reduce((sum, v, i) => sum + v * (cols[i].unit || 1), 0);
    return B;
  }
  function buildBecakIcon(p) {
    const b = buildBecak(p);
    b.g.querySelector('.ak-idle').classList.remove('ak-idle');
    personNode(b.seat, rnd(0, 7), 50, -58, 0.55, false);
    return b;
  }

  /* ------------------------------------------------------------------ crowd at the halte */
  function crowdSpots(n) {
    const spots = [];
    if (n <= 50) for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) spots.push({ x: 66 + c * 50 + (r % 2) * 18 + rnd(-5, 5), y: 506 + r * 30 + rnd(-3, 3), s: 0.42 });
    else for (let r = 0; r < 7; r++) for (let c = 0; c < 15; c++) spots.push({ x: 52 + c * 33 + (r % 2) * 15 + rnd(-3, 3), y: 486 + r * 24 + rnd(-2, 2), s: 0.36 });
    return spots;
  }
  function makeCrowd(n) {
    const spots = GS.shuffle(crowdSpots(n)).slice(0, n).sort((a, b) => a.y - b.y);
    return spots.map((sp, i) => {
      const v = randVar();
      const node = personNode(L_.gFront, v, sp.x, sp.y, 0.01, true);
      timers.push(setTimeout(() => popIn(node, sp.x, sp.y, sp.s), i * Math.max(6, 18 - n / 8) / SPEED));
      return { node, x: sp.x, y: sp.y, v, s: sp.s };
    });
  }
  function restorePerson(r) {
    const node = personNode(L_.gFront, r.v, r.x, r.y, 0.01, true);
    r.node = node; popIn(node, r.x, r.y, r.s);
    return r;
  }
  function crowdSign(n) {
    const g = G(L_.ui, { class: 'ak' });
    place(g, 420, 372);
    R(g, -4, 0, 8, 70, 3, P.woodS, OUT, 2.5);
    R(g, -104, -62, 208, 70, 14, P.wood, OUT, 3.5);
    R(g, -96, -55, 192, 56, 10, P.cream, OUT, 2.5);
    T(g, 0, -27, n + ' orang', 46, P.ink, { class: 'gs-num' });
    return g;
  }
  /** One person hops from the crowd into a seat of a small angkot (world coords). */
  function flyPerson(r, tx, ty, s1) {
    L_.drag.appendChild(r.node);
    return tw(280, e => place(r.node, GS.lerp(r.x, tx, e), GS.lerp(r.y, ty, e) - Math.sin(Math.PI * e) * 70, GS.lerp(r.s, s1 || 0.25, e)), 'linear').then(() => r.node.remove());
  }

  /* ================================================================== TENS ROUND (puluhan & satuan) */
  function startTens(say) {
    mode = { phase: 'fill', crowd: [], busy: false, roundTries: 0, trips: 0 };
    const B = mode.board = makeBoard([10, 1], { x: 396, y: 8 });
    B.onStep = (i, sign) => { B.dig[i] = GS.clamp(B.dig[i] + sign, 0, 9); B.setDigit(i, B.dig[i]); };
    mode.btnFill = mkBtn('Isi angkot!', false, () => fillAngkot());
    mode.btnBecak = mkBtn('Becak', true, () => callBecak());
    mode.btnCek = mkBtn('Cek!', false, () => checkTens());
    mode.btnCek.hidden = true;
    sayFirst(say, 'Ketuk Isi angkot! Sisanya naik becak.');
    arriveAngkot(0);
    let n; do { n = rnd(cfg.lo, cfg.hi); } while (n % 10 === 0);
    mode.n = n;
    B.render(); B.setDigits(['?', '?']);
    mode.crowd = makeCrowd(n);
    updateDock();
  }
  async function fillAngkot() {
    const t = tok;
    const A = cur;
    if (mode.phase !== 'fill' || mode.busy || !A || A.state !== 'ready' || !mode.crowd.length) return;
    mode.busy = true; A.state = 'boarding'; updateDock();
    const take = Math.min(10, mode.crowd.length);
    const gap = mode.trips >= 2 ? 100 : 190;
    mode.crowd.sort((a, b) => (b.x + b.y * 0.6) - (a.x + a.y * 0.6));
    const riders = mode.crowd.splice(0, take);
    await setDoor(A, true);
    const doorX = A.x + 64, doorY = GROUND - 66;
    const flights = [];
    for (let k = 0; k < take; k++) {
      const r = riders[k];
      const idx = k;
      flights.push(flyPerson(r, doorX, doorY, 0.3).then(() => {
        if (!alive(t)) return;
        addSeat(A, idx, r.v, 'crowd');
        A.count++;
        GS.sfx.count(idx + 1);
      }));
      await sleep(gap);
      if (!alive(t)) return;
    }
    await Promise.all(flights);
    await sleep(300);
    if (!alive(t)) return;
    if (take === 10) {
      await departAnim(A);
      if (!alive(t)) return;
      const B = mode.board;
      B.vals[0]++; B.render(0); GS.sfx.coin();
      mode.trips++;
      cur = null;
      if (mode.crowd.length >= 10) GS.say(pick(['Masih banyak. Isi angkot lagi!', 'Ayo, angkot berikutnya!']));
      else GS.say('Sisanya sedikit. Angkot atau becak?');
      await arriveAngkot(0);
      if (!alive(t)) return;
      mode.busy = false;
      updateDock();
    } else {
      tries++; mode.roundTries++;
      GS.sfx.oops();
      kenek.pose('think'); hud.mood('think');
      kenekBubble('Belum penuh!');
      GS.say('Belum penuh. Angkot tidak mau berangkat.');
      GS.fx(A.shake, 'gs-wobble');
      await sleep(1500);
      if (!alive(t)) return;
      GS.fxStop(A.shake, 'gs-wobble');
      for (let k = take - 1; k >= 0; k--) {
        const o = A.seats[k]; const sp = seatPos(A, k);
        if (o) popOut(o.node, sp.x, sp.y, sp.s);
        A.seats[k] = null; A.count--;
        mode.crowd.push(restorePerson(riders[k]));
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
      const B = mode.board; B.vals[1]++; B.render(1);
    });
    if (!alive(t)) return;
    mode.busy = false;
    compose();
  }
  function compose() {
    mode.phase = 'compose';
    const B = mode.board;
    B.dig = [0, 0]; B.setDigits(B.dig);
    B.showSteps(true);
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
    const okT = B.dig[0] === B.vals[0], okO = B.dig[1] === B.vals[1];
    if (okT && okO) {
      mode.busy = true; B.locked = true; mode.btnCek.disabled = true;
      GS.sfx.coin();
      hud.mood('happy');
      B.mark(true);
      floatAt(String(mode.n), 720, 120);
      GS.say(Cap(words(mode.n)) + ' penumpang! ' + B.vals[0] + ' puluhan, ' + B.vals[1] + ' satuan.');
      await sleep(2800);
      if (!alive(t)) return;
      roundDone('Hebat! Kamu paham puluhan dan satuan.');
    } else {
      tries++; mode.roundTries++;
      GS.sfx.oops();
      hud.mood('oops');
      [[okT, 0], [okO, 1]].forEach(([ok, i]) => { if (!ok) { GS.fx(B.boxes[i].g, 'gs-wobble'); GS.fx(B.iconG[i], 'gs-wobble'); } });
      if (!okT) GS.say('Hitung lagi angkotnya. Satu angkot, sepuluh orang.');
      else GS.say('Hitung lagi becaknya. Satu becak, satu orang.');
      if (mode.roundTries >= 2) B.labels.style.display = '';
    }
  }

  /* ================================================================== CALC ROUNDS: kirim ke pasar, the gate counts */
  const GATE_X = 1246;
  function drawGate() {
    const g = G(L_.halte, { class: 'ak', 'data-qc': 'decor' });
    const cnt = G(L_.halte, { class: 'ak' });
    const lab = G(L_.halte, { class: 'ak', 'data-qc': 'decor' });
    const front = G(L_.fx, { class: 'ak' });
    PA(g, 'M1084 300 L1188 238 L1292 300 Z', P.red, OUT, 4);
    PA(g, 'M1106 292 L1188 246 L1220 264', 'none', P.redH, 5);
    R(g, 1090, 296, 196, 54, 10, P.wood, OUT, 4);
    T(g, 1188, 324, 'PASAR', 32, P.cream, { class: 't-display', 'letter-spacing': '3' });
    R(g, 1100, 348, 34, GROUND - 336, 6, P.redS, OUT, 4);
    R(g, 1106, 356, 8, GROUND - 360, 4, P.red);
    R(g, 1136, 348, 4, 18, 2, OUT); R(g, 1236, 348, 4, 18, 2, OUT);
    R(cnt, 1108, 362, 160, 104, 16, P.cream, OUT, 4);
    T(lab, 1188, 382, 'sampai', 20, '#6B5444', { class: 't-body', 'font-weight': 700 });
    const num = T(cnt, 1188, 428, '0', 50, P.ink, { class: 'gs-num' });
    R(front, GATE_X, 348, 36, GROUND - 336, 6, P.redS, OUT, 4);
    R(front, GATE_X + 6, 356, 8, GROUND - 360, 4, P.red);
    E(front, GATE_X + 18, GROUND + 12, 32, 7, OUT, null, 0, { opacity: 0.18 });
    return { num };
  }
  const CX = 276;
  function cardBase() {
    const g = G(L_.ui, { class: 'ak' });
    R(g, 16, 140, 520, 500, 22, P.cream, OUT, 4);
    C(g, CX, 148, 8, P.red, OUT, 3);
    return g;
  }
  const BODY = { class: 't-body', 'font-weight': 700 };
  function orderCard(n, hint) {
    if (mode.card) mode.card.remove();
    const g = mode.card = cardBase();
    T(g, CX, 214, 'Kirim ke pasar:', 38, P.ink, BODY);
    T(g, CX, 336, fmt(n), 104, P.ui, { class: 'gs-num' });
    T(g, CX, 450, 'penumpang', 38, P.ink, BODY);
    if (hint) {
      const parts = digitsOf(n, cfg.units).map((d, i) => d * cfg.units[i]).filter(Boolean).map(fmt);
      const txt = fmt(n) + ' = ' + parts.join(' + ');
      T(g, CX, 560, txt, Math.min(44, 900 / txt.length), P.teal, { class: 'gs-num' });
    }
  }
  function vehiclesOf(n, units) {
    const out = [];
    units.forEach(u => { const d = Math.floor(n / u) % 10 + (u === units[0] ? Math.floor(n / (u * 10)) * 10 : 0); for (let k = 0; k < d; k++) out.push({ kind: UNITS[u].icon, val: u }); });
    return out;
  }
  /** Icon row (one per vehicle) inside the question card. */
  function iconRow(g, list, x, y, k, faded) {
    const sizes = { train: 52, bus: 50, angkot: 46, becak: 34, cap: 52 };
    let cx = x;
    const nodes = [];
    list.forEach((v, j) => {
      const w = (sizes[v.kind] || 40) * (k || 1);
      if (j && list[j - 1].kind !== v.kind) cx += 10;
      const m = iconFor(g, v.kind, cx, y, w, v.kind === 'cap' ? { cap: v.cap, full: true } : { full: true });
      if (faded && faded(j)) m.setAttribute('opacity', '0.3');
      nodes.push(m);
      cx += w + 4;
    });
    return { nodes, w: cx - x };
  }
  function fitK(list, avail) {
    const sizes = { train: 52, bus: 50, angkot: 46, becak: 34, cap: 52 };
    let w = 0;
    list.forEach((v, j) => { w += (sizes[v.kind] || 40) + 4 + (j && list[j - 1].kind !== v.kind ? 10 : 0); });
    return Math.min(1.25, avail / Math.max(1, w));
  }
  function calcCard(S) {
    const g = mode.card = cardBase();
    mode.cardNodes = [];
    if (S.op === 'read') {
      T(g, CX, 200, 'Berapa penumpangnya?', 38, P.ink, BODY);
      const n = S.parts[0];
      const step = S.units.length > 3 ? 86 : 104;
      let y = S.units.length > 3 ? 296 : 316;
      S.units.forEach(u => {
        const d = Math.floor(n / u) % 10;
        const list = Array(d).fill(0).map(() => ({ kind: UNITS[u].icon }));
        if (d) { const r = iconRow(g, list, 40, y, fitK(list, 470)); mode.cardNodes.push(...r.nodes); }
        y += step;
      });
    } else if (S.op === 'sum' && S.icons) {
      T(g, CX, 198, 'Digabung, berapa semuanya?', 36, P.ink, BODY);
      S.parts.forEach((n, i) => {
        const y = 340 + i * 160;
        T(g, 66, y - 22, String(n), 50, P.ui, { class: 'gs-num' });
        if (i) T(g, 66, y - 96, '+', 46, P.ink, { class: 'gs-num' });
        const vs = vehiclesOf(n, [10, 1]);
        const r = iconRow(g, vs, 108, y, fitK(vs, 412));
        mode.cardNodes.push(...r.nodes);
      });
    } else if (S.op === 'sum' || S.op === 'est') {
      T(g, CX, 204, S.op === 'est' ? 'Kira-kira berapa semuanya?' : 'Tiga rombongan digabung:', 36, P.ink, BODY);
      T(g, CX, 340, S.parts.map(fmt).join(' + '), 58, P.ui, { class: 'gs-num' });
      if (S.op === 'est') { T(g, CX, 450, 'Bulatkan ke', 36, P.ink, BODY); T(g, CX, 500, 'ratusan terdekat.', 36, P.ink, BODY); }
      else T(g, CX, 450, '= ?', 58, P.ink, { class: 'gs-num' });
    } else if (S.op === 'sub') {
      T(g, CX, 192, S.parts[0] + ' penumpang.', 44, P.ink, BODY);
      T(g, CX, 246, S.take + ' turun di halte.', 44, P.ink, BODY);
      const vs = vehiclesOf(S.parts[0], [10, 1]);
      const a = vs.filter(v => v.val === 10), b = vs.filter(v => v.val === 1);
      mode.cardNodes.push(...iconRow(g, a, 40, 360, fitK(a, 470)).nodes);
      mode.cardNodes.push(...iconRow(g, b, 40, 460, fitK(b, 470)).nodes);
      mode.subMsg = T(g, CX, 560, '', 36, P.ink, BODY);
    } else if (S.op === 'mult') {
      T(g, CX, 196, S.cnt + ' angkot, isi ' + S.cap, 46, P.ink, BODY);
      const per = 4, rowsN = Math.ceil(S.cnt / per);
      const rh = rowsN > 3 ? 64 : 80;
      for (let k = 0; k < S.cnt; k++) {
        const x = 40 + (k % per) * 118, y = 300 + Math.floor(k / per) * rh;
        mode.cardNodes.push(iconFor(g, 'cap', x, y, 108, { cap: S.cap, full: true }));
      }
      T(g, CX, 300 + (rowsN - 1) * rh + 70, S.cnt + ' × ' + S.cap + ' = ?', 48, P.ui, { class: 'gs-num' });
    }
  }
  function startCalc(say) {
    const S = cfg;
    mode = { busy: false, roundTries: 0 };
    mode.gate = drawGate();
    const bw0 = S.units.length * (S.units.length <= 2 ? 156 : S.units.length === 3 ? 142 : 134) + 28;
    const B = mode.board = makeBoard(S.units, { layout: 'col', x: Math.max(544, Math.round(828 - bw0 / 2)), y: 140 });
    if (S.lock) B.locks = S.lock.slice();
    if (S.mode === 'build') {
      B.onStep = (i, sign) => {
        if (mode.busy) return;
        const v = GS.clamp(B.vals[i] + sign, 0, 9);
        if (v === B.vals[i]) return;
        B.vals[i] = v; B.render(sign > 0 ? i : -1); B.setDigit(i, v);
      };
      B.render(); B.setDigits(B.vals);
      orderCard(S.target, false);
      mode.expected = S.target;
      sayFirst(say, 'Pesanan baru!');
      timers.push(setTimeout(() => GS.say('Kirim ' + S.target + ' penumpang. Atur kendaraannya di papan!'), 2200 / SPEED));
    } else {
      B.onStep = (i, sign) => { if (mode.busy) return; B.dig[i] = GS.clamp(B.dig[i] + sign, 0, 9); B.setDigit(i, B.dig[i]); };
      B.setDigits(B.dig);
      if (S.op === 'mult') mode.vehicles = Array(S.cnt).fill(0).map(() => ({ kind: 'cap', cap: S.cap, val: S.cap }));
      else if (S.op === 'sub') mode.vehicles = vehiclesOf(S.parts[0] - S.take, [10, 1]);
      else mode.vehicles = S.parts.flatMap(n => vehiclesOf(n, S.units.length > 2 ? S.units : [10, 1]));
      mode.truth = mode.vehicles.reduce((s, v) => s + v.val, 0);
      mode.expected = S.op === 'est' ? Math.round(mode.truth / 100) * 100 : mode.truth;
      calcCard(S);
      sayFirst(say, 'Berapa penumpang yang sampai?');
      if (S.op === 'sub') unloadAnim();
      else timers.push(setTimeout(() => GS.say(S.op === 'est' ? 'Pilih ratusannya, lalu Kirim!' : 'Susun angkanya di papan, lalu Kirim!'), 2400 / SPEED));
    }
    B.showSteps(true);
    mode.btnSend = mkBtn('Kirim!', false, () => kirim());
  }
  async function unloadAnim() {
    const t = tok, S = cfg;
    mode.busy = true;
    await sleep(1400);
    if (!alive(t)) return;
    const tb = Math.floor(S.take / 10), ob = S.take % 10, ta = Math.floor(S.parts[0] / 10);
    const idx = [];
    for (let k = 0; k < tb; k++) idx.push(k);
    for (let k = 0; k < ob; k++) idx.push(ta + k);
    for (const k of idx) {
      const m = mode.cardNodes[k];
      if (m) tw(260, e => m.setAttribute('opacity', (1 - 0.72 * e).toFixed(2)), 'outCubic');
      GS.sfx.pop();
      await sleep(160);
      if (!alive(t)) return;
    }
    mode.subMsg.textContent = 'Sisa berapa yang ke pasar?';
    GS.say(S.take + ' penumpang turun. Berapa yang ke pasar?');
    mode.busy = false;
  }
  function vehicleNode(parent, v) {
    const m = G(parent);
    let len, wheels, sc;
    if (v.kind === 'train') { sc = 0.55; const o = miniTrain(m, { full: true, shadow: true }); wheels = o.wheels; len = 334 * sc; place(o.g, 0, 0, sc); }
    else if (v.kind === 'bus') { sc = 0.6; const o = miniBus(m, { full: true, shadow: true }); wheels = o.wheels; len = 270 * sc; place(o.g, 0, 0, sc); }
    else if (v.kind === 'angkot') { sc = 0.7; const o = miniAngkot(m, { full: true, shadow: true }); wheels = o.wheels; len = 200 * sc; place(o.g, 0, 0, sc); }
    else if (v.kind === 'cap') { sc = 0.7; const o = capAngkot(m, v.cap, { full: true, shadow: true }); wheels = o.wheels; len = o.L * sc; place(o.g, 0, 0, sc); }
    else { sc = 0.45; const b = buildBecak(m); personNode(b.seat, randVar(), 50, -58, 0.5, false); wheels = b.wheels; len = 240 * sc; place(b.g, 120 * sc, 0, sc); }
    return { node: m, len, wheels, r: (v.kind === 'becak' ? 34 : v.kind === 'train' ? 12 : v.kind === 'bus' ? 21 : 17) * sc };
  }
  /** Drive a convoy through the PASAR gate; the gate counter adds each vehicle's passengers. Returns the total. */
  async function convoy(veh, gate) {
    const t = tok;
    const cid = uid('gate');
    const wrap = G(L_.angkot, { class: 'ak' });
    const cp = el('clipPath', { id: cid }, wrap); R(cp, -9000, 0, 9000 + GATE_X + 10, 800);
    const train = G(G(wrap, { 'clip-path': 'url(#' + cid + ')' }));
    let x = 660;
    const list = veh.map(v => {
      const o = vehicleNode(train, v);
      place(o.node, x - o.len, GROUND + 6);
      const item = { front: x, val: v.val, wheels: o.wheels, r: o.r };
      x -= o.len + 26;
      return item;
    });
    const gateX = GATE_X, dist = gateX - x + 40;
    const speed = Math.max(380, dist / 8);
    let total = 0, counted = 0;
    const talk = list.length <= 8;
    engine(2);
    honk();
    await tw(dist / speed * 1000, e => {
      const dx = e * dist;
      train.setAttribute('transform', 'translate(' + f1(dx) + ' 0)');
      list.forEach(v => { const d = (dx / v.r) * 57.2958; v.wheels.forEach(w => w.setAttribute('transform', 'rotate(' + d.toFixed(1) + ')')); });
      while (counted < list.length && list[counted].front - 40 + dx >= gateX) {
        total += list[counted].val;
        counted++;
        if (!alive(t)) return;
        gate.num.textContent = fmt(total);
        GS.sfx.count(Math.min(24, counted + 2));
        if (talk && list[counted - 1].val >= 10) GS.say(Cap(words(total)) + '!');
      }
    }, 'inOutCubic');
    wrap.remove();
    return total;
  }
  async function kirim() {
    const t = tok;
    const S = cfg, B = mode.board, gate = mode.gate;
    if (mode.busy) return;
    let veh, answer = null;
    if (S.mode === 'build') {
      if (B.vals.every(v => !v)) { GS.sfx.oops(); GS.say('Pilih dulu kendaraannya di papan.'); return; }
      veh = [];
      B.cols.forEach((c, i) => { for (let k = 0; k < B.vals[i]; k++) veh.push({ kind: c.icon, val: c.unit }); });
    } else {
      answer = B.number();
      veh = mode.vehicles;
    }
    mode.busy = true; B.locked = true; mode.btnSend.disabled = true;
    hud.mood('happy');
    kenek.pose('shout');
    gate.num.textContent = '0';
    const total = await convoy(veh, gate);
    if (!alive(t)) return;
    kenek.pose('idle');
    await sleep(450);
    if (!alive(t)) return;
    const ok = S.mode === 'build' ? total === S.target : answer === mode.expected;
    if (ok) {
      GS.sfx.coin();
      hud.mood('cheer');
      B.mark(true);
      floatAt(fmt(total), 1188, 330);
      if (S.op === 'est') GS.say('Pas! Ada ' + words(total) + ', kira-kira ' + words(mode.expected) + '.');
      else GS.say('Pas! ' + Cap(words(total)) + ' penumpang sampai di pasar.');
      await sleep(2600);
      if (!alive(t)) return;
      roundDone('Hebat! Semua sampai di pasar.');
      return;
    }
    tries++; mode.roundTries++;
    GS.sfx.oops();
    hud.mood('oops');
    if (S.mode === 'build') {
      const diff = total - S.target;
      floatAt((diff < 0 ? 'kurang ' : 'lebih ') + fmt(Math.abs(diff)), 1188, 330);
      GS.say('Sampai ' + total + '. Pesanannya ' + S.target + '. ' + (diff < 0 ? 'Kurang ' : 'Lebih ') + Math.abs(diff) + '.');
      if (mode.roundTries >= 2) { orderCard(S.target, true); B.labels.style.display = ''; }
    } else {
      B.boxes.forEach((bx, i) => { if (!B.locks[i]) GS.fx(bx.g, 'gs-wobble'); });
      if (S.op === 'est') GS.say('Ada ' + total + ' penumpang. Ratusan terdekat berapa?');
      else GS.say('Yang sampai ' + total + '. Jawabanmu ' + answer + '. Coba lagi!');
      if (mode.roundTries >= 2 && !mode.hint) {
        const hintTxt = S.op === 'mult' ? 'Hitung loncat: ' + [1, 2, 3].map(k => k * S.cap).join(', ') + ', ...'
          : S.op === 'est' ? 'Tepatnya ' + fmt(mode.truth) + '.'
          : S.units.length > 2 ? 'Bus 100, angkot 10, becak 1.' : 'Angkot 10, becak 1.';
        mode.hint = T(mode.card, CX, 612, hintTxt, 36, P.teal, { class: 't-body', 'font-weight': 700 });
      }
    }
    await sleep(2400);
    if (!alive(t)) return;
    gate.num.textContent = '0';
    B.locked = false; mode.busy = false; mode.btnSend.disabled = false;
    hud.mood('think');
  }

  /* ================================================================== SHARE ROUNDS: bagi sama rata */
  const capLen = c => 70 + Math.ceil(c / 2) * 26 + 36;
  function parkingPos(i, n, L) {
    const s = Math.min(0.6, 600 / (n * (L + 14)));
    return { x: 650 + i * (L + 14) * s, y: GROUND - 66, s };
  }
  function startShare(say) {
    const S = cfg;
    mode = { busy: false, roundTries: 0 };
    mode.crowd = makeCrowd(S.n);
    crowdSign(S.n);
    mode.cars = [];
    for (let i = 0; i < S.N; i++) {
      const pp = parkingPos(i, S.N, capLen(10));
      const host = G(L_.angkot);
      const A = capAngkot(host, 10, { shadow: true, sign: false });
      place(host, pp.x, pp.y, pp.s);
      A.pos = pp; A.host = host;
      mode.cars.push(A);
    }
    const B = mode.board = makeBoard([{ title: 'TIAP ANGKOT', icon: 'dot' }], { x: 650, y: 8 });
    B.onStep = (i, sign) => { if (mode.busy) return; B.vals[0] = GS.clamp(B.vals[0] + sign, 0, 10); B.setDigit(0, B.vals[0]); B.render(sign > 0 ? 0 : -1); };
    B.setDigits([0]); B.render(); B.showSteps(true);
    mode.btnGo = mkBtn('Bagikan!', false, () => bagikan());
    sayFirst(say, 'Bagi sama rata!');
    timers.push(setTimeout(() => GS.say('Ada ' + S.n + ' penumpang dan ' + S.N + ' angkot. Tiap angkot berapa?'), 2300 / SPEED));
  }
  function seatWorld(A, i) {
    const s = A.seats[Math.min(i, A.seats.length - 1)];
    return { x: A.pos.x + s.x * A.pos.s, y: A.pos.y + s.y * A.pos.s };
  }
  async function bagikan() {
    const t = tok, S = cfg, B = mode.board;
    if (mode.busy) return;
    const k = B.vals[0];
    if (!k) { GS.sfx.oops(); GS.say('Pilih dulu, tiap angkot berapa orang.'); return; }
    mode.busy = true; B.locked = true; mode.btnGo.disabled = true;
    mode.crowd.sort((a, b) => (b.x + b.y * 0.6) - (a.x + a.y * 0.6));
    const taken = [];
    let count = 0;
    const flights = [];
    outer: for (let round = 0; round < k; round++) {
      for (const A of mode.cars) {
        if (!mode.crowd.length) break outer;
        const r = mode.crowd.shift();
        taken.push(r);
        const sw = seatWorld(A, A.filled);
        const idx = ++count;
        flights.push(flyPerson(r, sw.x, sw.y + 10, 0.22).then(() => { if (alive(t)) { A.fill(); GS.sfx.count(Math.min(24, idx)); } }));
        await sleep(S.n > 24 ? 70 : 110);
        if (!alive(t)) return;
      }
    }
    await Promise.all(flights);
    await sleep(400);
    if (!alive(t)) return;
    const short = mode.cars.filter(A => A.filled < k);
    const left = mode.crowd.length;
    if (short.length) return shareFail(taken, 'Penumpangnya tidak cukup. Ada angkot yang cuma dapat ' + short[short.length - 1].filled + '.', short);
    if (left >= S.N) return shareFail(taken, 'Masih ada ' + left + ' orang. Tiap angkot bisa dapat satu lagi.', null);
    hud.mood('cheer');
    GS.sfx.coin();
    if (left) {
      GS.say('Sisa ' + left + ' naik becak.');
      await sleep(900);
      const list = mode.crowd.splice(0);
      await becakParade(list.length, i => { const r = list[i]; r.node.remove(); return r; });
      if (!alive(t)) return;
    }
    GS.say(S.n + ' dibagi ' + S.N + ', tiap angkot ' + k + (left ? ', sisa ' + left : '') + '. Berangkat!');
    honk();
    await Promise.all(mode.cars.map((A, i) => sleep(i * 120).then(() => tw(1200, e => place(A.host, GS.lerp(A.pos.x, VX1() + 300, e), A.pos.y, A.pos.s), 'inCubic'))));
    if (!alive(t)) return;
    await sleep(800);
    roundDone('Hebat! Semua dapat sama rata.');
  }
  async function shareFail(taken, msg, shortCars) {
    const t = tok;
    tries++; mode.roundTries++;
    GS.sfx.oops(); hud.mood('oops'); kenek.pose('think');
    GS.say(msg);
    (shortCars || []).forEach(A => GS.fx(A.shake, 'gs-wobble'));
    if (!shortCars) mode.crowd.forEach(r => r.node && GS.fx(r.node, 'gs-wobble'));
    await sleep(2400);
    if (!alive(t)) return;
    mode.cars.forEach(A => A.clear());
    taken.forEach(r => mode.crowd.push(restorePerson(r)));
    mode.board.locked = false; mode.busy = false; mode.btnGo.disabled = false;
    kenek.pose('idle'); hud.mood('think');
  }

  /* ================================================================== FLEET ROUNDS: berapa angkot? (pembulatan / bersisa) */
  function startFleet(say) {
    const S = cfg;
    mode = { busy: false, roundTries: 0, cars: [] };
    mode.crowd = makeCrowd(S.n);
    crowdSign(S.n);
    const B = mode.board = makeBoard([{ title: 'ANGKOT ISI ' + S.c, icon: 'cap', cap: S.c }], { x: 650, y: 8 });
    B.vals[0] = 1;
    B.onStep = (i, sign) => { if (mode.busy) return; const v = GS.clamp(B.vals[0] + sign, 1, 6); if (v === B.vals[0]) return; B.vals[0] = v; B.setDigit(0, v); B.render(sign > 0 ? 0 : -1); };
    B.setDigits([1]); B.render(); B.showSteps(true);
    mode.btnGo = mkBtn('Berangkat!', false, () => fleetGo());
    sayFirst(say, 'Berapa angkot?');
    const q = S.how === 'ceil' ? S.n + ' penumpang, angkot isi ' + S.c + '. Butuh berapa angkot?' : S.n + ' penumpang, angkot isi ' + S.c + '. Berapa angkot yang penuh?';
    timers.push(setTimeout(() => GS.say(q), 2400 / SPEED));
  }
  async function fleetGo() {
    const t = tok, S = cfg, B = mode.board;
    if (mode.busy) return;
    const m = B.vals[0];
    mode.busy = true; B.locked = true; mode.btnGo.disabled = true;
    mode.cars = [];
    for (let i = 0; i < m; i++) {
      const pp = parkingPos(i, m, capLen(S.c));
      const host = G(L_.angkot);
      const A = capAngkot(host, S.c, { shadow: true });
      A.pos = pp; A.host = host;
      mode.cars.push(A);
      place(host, pp.x + 300, pp.y, pp.s);
      tw(420, e => place(host, GS.lerp(pp.x + 300, pp.x, e), pp.y, pp.s), 'outCubic');
      brake();
      await sleep(140);
    }
    await sleep(400);
    if (!alive(t)) return;
    mode.crowd.sort((a, b) => (b.x + b.y * 0.6) - (a.x + a.y * 0.6));
    const taken = [];
    let count = 0;
    const flights = [];
    for (const A of mode.cars) {
      for (let s = 0; s < S.c; s++) {
        if (!mode.crowd.length) break;
        const r = mode.crowd.shift();
        taken.push(r);
        const sw = seatWorld(A, s);
        const idx = ++count;
        flights.push(flyPerson(r, sw.x, sw.y + 10, 0.22).then(() => { if (alive(t)) { A.fill(); GS.sfx.count(Math.min(24, idx)); } }));
        await sleep(S.n > 30 ? 60 : 95);
        if (!alive(t)) return;
      }
    }
    await Promise.all(flights);
    await sleep(400);
    if (!alive(t)) return;
    const left = mode.crowd.length;
    const empty = mode.cars.filter(A => A.filled === 0), partial = mode.cars.filter(A => A.filled < S.c);
    let fail = null, bad = null;
    if (S.how === 'ceil') {
      if (left) fail = 'Masih ada ' + left + ' orang tertinggal.';
      else if (empty.length) { fail = 'Ada angkot yang kosong.'; bad = empty; }
    } else {
      if (partial.length) { fail = 'Angkot ini belum penuh, tidak mau berangkat.'; bad = partial; }
      else if (left >= S.c) fail = 'Sisanya ' + left + '. Masih cukup untuk satu angkot penuh.';
    }
    if (fail) {
      tries++; mode.roundTries++;
      GS.sfx.oops(); hud.mood('oops'); kenek.pose('think');
      GS.say(fail);
      (bad || []).forEach(A => GS.fx(A.shake, 'gs-wobble'));
      await sleep(2400);
      if (!alive(t)) return;
      mode.cars.forEach(A => A.host.remove());
      mode.cars = [];
      taken.forEach(r => mode.crowd.push(restorePerson(r)));
      B.locked = false; mode.busy = false; mode.btnGo.disabled = false;
      kenek.pose('idle'); hud.mood('think');
      return;
    }
    hud.mood('cheer'); GS.sfx.coin();
    if (S.how === 'floor' && left) {
      GS.say('Sisa ' + left + ' naik becak.');
      await sleep(800);
      const list = mode.crowd.splice(0);
      await becakParade(list.length, i => { const r = list[i]; r.node.remove(); return r; });
      if (!alive(t)) return;
      GS.say(S.n + ' dibagi ' + S.c + ' sama dengan ' + m + ', sisa ' + left + '.');
    } else if (S.how === 'ceil') {
      GS.say(S.n + ' penumpang butuh ' + m + ' angkot. Semua terangkut!');
    } else GS.say(S.n + ' dibagi ' + S.c + ' sama dengan ' + m + '.');
    honk();
    await Promise.all(mode.cars.map((A, i) => sleep(i * 120).then(() => tw(1200, e => place(A.host, GS.lerp(A.pos.x, VX1() + 300, e), A.pos.y, A.pos.s), 'inCubic'))));
    if (!alive(t)) return;
    await sleep(900);
    roundDone('Hebat! Semua penumpang terangkut.');
  }

  /* ================================================================== MULTI ROUNDS: kelipatan, dua angkot sama-sama penuh */
  const LANE_Y = [470, GROUND + 6];
  function startMulti(say) {
    const S = cfg;
    mode = { busy: false, roundTries: 0, lanes: [] };
    const bgL = G(L_.halte, { class: 'ak' });
    R(bgL, -600, 362, 2480, 128, 0, '#8E8A86');
    R(bgL, -600, 362, 2480, 6, 0, '#77736F');
    for (let x = -580; x < 1880; x += 60) R(bgL, x, 486, 30, 4, 2, '#F3EEE2');
    [S.a, S.b].forEach((c, li) => {
      const y = LANE_Y[li];
      const sg = G(L_.ui, { class: 'ak' });
      place(sg, 24, y - 128);
      R(sg, 0, -10, 160, 126, 16, P.cream, OUT, 3.5);
      const ic = G(sg); const o = capAngkot(G(ic), c, { sign: false, sw: 5 }); place(ic, 80 - o.L * 0.3, 58, 0.6);
      T(sg, 80, 88, 'isi ' + c, 44, P.ink, { class: 'gs-num' });
      mode.lanes.push({ c, y, cars: [], g: G(L_.angkot) });
    });
    const B = mode.board = makeBoard([10, 1], { x: 396, y: 8 });
    B.onStep = (i, sign) => { if (mode.busy) return; B.dig[i] = GS.clamp(B.dig[i] + sign, 0, i === 0 ? 4 : 9); B.setDigit(i, B.dig[i]); };
    B.setDigits(B.dig); B.showSteps(true);
    mode.btnGo = mkBtn('Isi!', false, () => multiGo());
    sayFirst(say, 'Cari jumlah yang pas!');
    timers.push(setTimeout(() => GS.say('Angkot isi ' + S.a + ' dan isi ' + S.b + '. Berapa orang supaya semua penuh?'), 2600 / SPEED));
  }
  async function multiGo() {
    const t = tok, S = cfg, B = mode.board;
    if (mode.busy) return;
    const n = B.number();
    if (!n) { GS.sfx.oops(); GS.say('Pilih dulu berapa orang.'); return; }
    mode.busy = true; B.locked = true; mode.btnGo.disabled = true;
    mode.lanes.forEach(L => {
      const cnt = Math.ceil(n / L.c);
      const L0 = 70 + Math.ceil(L.c / 2) * 26 + 36;
      L.s = Math.min(0.5, 960 / (cnt * (L0 + 10)));
      L.step = (L0 + 10) * L.s;
    });
    for (let i = 0; i < n; i++) {
      mode.lanes.forEach(L => {
        const ci = Math.floor(i / L.c);
        if (!L.cars[ci]) {
          const host = G(L.g);
          const A = capAngkot(host, L.c, { shadow: true, sign: false });
          A.host = host;
          place(host, 190 + ci * L.step, L.y, L.s);
          popIn(host, 190 + ci * L.step, L.y, L.s);
          L.cars[ci] = A;
        }
        L.cars[ci].fill();
      });
      GS.sfx.count(Math.min(24, i + 1));
      await sleep(n > 30 ? 55 : 85);
      if (!alive(t)) return;
    }
    await sleep(500);
    if (!alive(t)) return;
    const res = mode.lanes.map(L => { const last = L.cars[L.cars.length - 1]; return { L, full: last.filled === L.c, miss: L.c - last.filled, last }; });
    if (res.every(r => r.full)) {
      hud.mood('cheer'); GS.sfx.coin();
      GS.say(n + ' pas! Angkot isi ' + S.a + ' dan isi ' + S.b + ' sama-sama penuh.');
      honk();
      await Promise.all(mode.lanes.flatMap(L => L.cars.map((A, i) => sleep(i * 60).then(() => { const tr = A.host.getAttribute('transform'); return tw(1200, e => A.host.setAttribute('transform', 'translate(' + f1((VX1() + 200) * e) + ' 0) ' + tr), 'inCubic'); }))));
      if (!alive(t)) return;
      await sleep(600);
      roundDone('Hebat! Kamu menemukan kelipatan yang sama.');
      return;
    }
    tries++; mode.roundTries++;
    GS.sfx.oops(); hud.mood('oops'); kenek.pose('think');
    const bad = res.filter(r => !r.full);
    bad.forEach(r => GS.fx(r.last.shake, 'gs-wobble'));
    GS.say(bad.map(r => 'Angkot isi ' + r.L.c + ' yang terakhir kurang ' + r.miss + '.').join(' '));
    await sleep(2600);
    if (!alive(t)) return;
    mode.lanes.forEach(L => { L.g.innerHTML = ''; L.cars = []; });
    B.locked = false; mode.busy = false; mode.btnGo.disabled = false;
    kenek.pose('idle'); hud.mood('think');
  }

  /* ================================================================== COMPARE ROUNDS: terminal mana lebih ramai */
  function startCompare(say) {
    const S = cfg;
    mode = { busy: false, roundTries: 0, sides: [] };
    [S.A, S.B].forEach((n, si) => {
      const g = G(L_.ui, { class: 'ak' });
      const x0 = si ? 700 : 40;
      R(g, x0, 140, 540, 460, 22, P.cream, OUT, 4);
      R(g, x0, 140, 540, 60, 22, si ? P.org : P.blue, OUT, 4);
      T(g, x0 + 270, 171, 'Terminal ' + (si ? 'B' : 'A'), 36, si ? P.ink : '#fff', { class: 't-display' });
      T(g, x0 + 270, 250, String(n), 72, si ? P.orgS : P.blueS, { class: 'gs-num' });
      const tens = Math.floor(n / 10), ones = n % 10;
      const items = { t: [], o: [] };
      for (let k = 0; k < tens; k++) items.t.push(iconFor(g, 'angkot', x0 + 34 + (k % 5) * 98, 352 + Math.floor(k / 5) * 58, 84, { full: true }));
      for (let k = 0; k < ones; k++) items.o.push(iconFor(g, 'becak', x0 + 44 + (k % 5) * 98, 500 + Math.floor(k / 5) * 64, 58));
      mode.sides.push(items);
    });
    const slot = mode.slot = G(L_.ui, { class: 'ak' });
    place(slot, 640, 360);
    C(slot, 0, 0, 52, P.cream, OUT, 4, { 'stroke-dasharray': '10 8' });
    mode.sign = G(slot);
    mode.btns = [['<', 'kurang dari'], ['=', 'sama dengan'], ['>', 'lebih dari']].map(([s, lab]) => {
      const b = mkBtn(s, s === '=', () => chooseSign(s));
      b.setAttribute('aria-label', 'Terminal A ' + lab + ' terminal B');
      b.style.minWidth = '96px';
      return b;
    });
    sayFirst(say, 'Mana yang lebih ramai?');
    timers.push(setTimeout(() => GS.say('Pilih tanda yang benar: lebih, kurang, atau sama.'), 2300 / SPEED));
  }
  async function chooseSign(sym) {
    const t = tok, S = cfg;
    if (mode.busy) return;
    mode.busy = true;
    mode.btns.forEach(b => { b.disabled = true; });
    mode.sign.innerHTML = '';
    const sg = G(mode.sign);
    T(sg, 0, 4, sym, 84, P.ink, { class: 'gs-num' });
    popIn(sg, 0, 0, 1);
    GS.sfx.drop();
    await sleep(500);
    if (!alive(t)) return;
    // pair the vehicles one to one; whatever is left over shows which terminal has more
    const [a, b] = mode.sides;
    for (const key of ['t', 'o']) {
      const m = Math.min(a[key].length, b[key].length);
      for (let k = 0; k < m; k++) {
        a[key][k].setAttribute('opacity', '0.3'); b[key][k].setAttribute('opacity', '0.3');
        GS.sfx.tick();
        await sleep(90);
        if (!alive(t)) return;
      }
      if (a[key].length !== b[key].length) break;
    }
    const truth = S.A < S.B ? '<' : S.A > S.B ? '>' : '=';
    const W = { '<': 'kurang dari', '>': 'lebih dari', '=': 'sama dengan' };
    await sleep(300);
    if (!alive(t)) return;
    if (sym === truth) {
      GS.sfx.coin(); hud.mood('cheer');
      const ring = mode.slot.querySelector('circle'); ring.setAttribute('fill', '#E3F4F1'); ring.setAttribute('stroke', P.teal); ring.removeAttribute('stroke-dasharray');
      GS.say(S.A + ' ' + W[truth] + ' ' + S.B + '.');
      await sleep(2400);
      if (!alive(t)) return;
      roundDone('Hebat! Kamu pandai membandingkan.');
      return;
    }
    tries++; mode.roundTries++;
    GS.sfx.oops(); hud.mood('oops');
    GS.fx(sg, 'gs-wobble');
    GS.say(truth === '=' ? 'Lihat, tidak ada yang tersisa. Sama banyak!' : 'Lihat yang tersisa. Terminal ' + (truth === '>' ? 'A' : 'B') + ' lebih ramai.');
    await sleep(1600);
    if (!alive(t)) return;
    await tw(400, e => { sg.setAttribute('opacity', (1 - e).toFixed(2)); }, 'inCubic');
    mode.sign.innerHTML = '';
    mode.sides.forEach(sd => ['t', 'o'].forEach(k => sd[k].forEach(m => m.setAttribute('opacity', '1'))));
    mode.busy = false;
    mode.btns.forEach(b => { b.disabled = false; });
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
  async function solveRound() {
    const t = tok, S = cfg;
    if (S.type === 'pool') {
      while (alive(t) && !finished) {
        await until(() => finished || !alive(t) || (cur && (cur.state === 'ready' || cur.state === 'overfull') && halte.every(g => g.state === 'halte')));
        if (finished || !alive(t)) break;
        if (cur.loads.length) { await sendBack(); continue; }
        const plan = findPlan(halte, cur.cap - cur.count, pres.slice(1).map(p => cfg.cap - p));
        if (!plan) throw new Error('no plan');
        for (const gr of plan) {
          await until(() => !alive(t) || (cur && cur.state === 'ready'));
          if (!alive(t)) return;
          await boardGroup(gr);
        }
        const done = departed;
        await until(() => finished || !alive(t) || departed > done, 30000);
      }
    } else if (S.type === 'tens') {
      while (alive(t) && mode.crowd.length >= 10) {
        await until(() => !alive(t) || (cur && cur.state === 'ready' && !mode.busy));
        if (!alive(t)) return;
        await fillAngkot();
      }
      await until(() => !alive(t) || (cur && cur.state === 'ready' && !mode.busy));
      if (!alive(t)) return;
      await callBecak();
      await until(() => !alive(t) || mode.phase === 'compose');
      if (!alive(t)) return;
      const B = mode.board;
      B.dig = B.vals.slice(); B.setDigits(B.dig);
      await checkTens();
    } else {
      await until(() => !alive(t) || !mode.busy);
      if (!alive(t)) return;
      const B = mode.board;
      if (S.type === 'calc') {
        if (S.mode === 'build') { B.vals = digitsOf(S.target, S.units); B.render(); B.setDigits(B.vals); }
        else { B.dig = digitsOf(mode.expected, S.units); B.setDigits(B.dig); }
        await kirim();
      } else if (S.type === 'share') { B.vals[0] = S.k; B.setDigits([S.k]); B.render(); await bagikan(); }
      else if (S.type === 'fleet') { B.vals[0] = S.m; B.setDigits([S.m]); B.render(); await fleetGo(); }
      else if (S.type === 'multi') { B.dig = digitsOf(lcm(S.a, S.b), [10, 1]); B.setDigits(B.dig); await multiGo(); }
      else if (S.type === 'compare') await chooseSign(S.A < S.B ? '<' : S.A > S.B ? '>' : '=');
    }
  }
  window.__game = {
    go: i => run.go(i),
    count: () => LEVELS.length,
    tier: () => TIER,
    speed: s => { SPEED = s || 1; },
    state: () => ({ tier: TIER, level: LV, round: roundIdx, rounds: rounds.length, type: cfg.type, tries, won: levelWon, angkot: cur && { state: cur.state, count: cur.count, cap: cur.cap }, halte: halte.map(g => g.n) }),
    halte: () => halte,
    async solve() {
      const lt = levelTok;
      while (!levelWon && lt === levelTok) {
        await until(() => roundReady || levelWon || lt !== levelTok, 20000);
        if (levelWon || lt !== levelTok) break;
        const r = roundIdx;
        await solveRound();
        await until(() => levelWon || roundIdx !== r || lt !== levelTok, 60000);
      }
      return { won: levelWon, tries };
    }
  };

  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
