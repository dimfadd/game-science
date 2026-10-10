/* Kebun Bibit (bibit)
 * A field of petak (cells). The planted region is an array: rows x cols. The basket is the truth:
 * on "Tanam!" its seedlings go one per hole, row by row, so
 *   holes = rows x cols, leftover = seedlings - holes  (leftover > 0: they wilt; < 0: empty holes grow weeds).
 * Harvest counts row by row (4, 8, 12): repeated addition you can see.
 * Fence (keliling): one bamboo pole per petak edge, poles = 2 x (rows + cols).
 * Area model: (a + b) x (c + d) = ac + ad + bc + bd, each part planted from its own basket.
 * Handles and ropes snap to whole petak (the unit), never to the answer. Spec: docs/KURIKULUM.md. */
(function () {
  'use strict';
  const GAME = 'bibit';
  const TIER = (window.GS && GS.tier) ? GS.tier() : 'k1';
  const TK = TIER === 'tk';
  const OL = '#3B2A20', INK = '#2B1D14', CREAM = '#FFF8EC';
  const LIFT = 40;              // dragged things float this far above the finger
  const BOARD_X = 700;          // number-sentence board centre (away from the caption, top-left)
  const CROPS = ['tomat', 'cabai', 'jagung'];
  let SPEED = 1;
  const wait = v => GS.wait(v / SPEED);
  const tween = (d, fn, e) => GS.tween(d / SPEED, fn, e);
  const R = (a, b) => GS.rand(a, b);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const n1 = v => Math.round(v * 10) / 10;
  const clamp = GS.clamp;
  const hasArt = fn => !!(window.GS && GS.art && typeof GS.art[fn] === 'function');
  function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
  const isPrime = n => { if (n < 2) return false; for (let k = 2; k * k <= n; k++) if (n % k === 0) return false; return true; };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const rect = (rows, cols) => { const a = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) a.push([r, c]); return a; };
  const sortCells = a => a.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);

  /* ================= art (Kampung Chunky) ================= */
  const GREEN = ['#5BAE4E', '#8ED07E', '#3E8A3A'];
  const WILT = ['#C9A94A', '#E6D08A', '#9C7E2E'];
  const SOIL = ['#A86F42', '#C08A5A', '#86532E'];
  function leaf(bx, by, tx, ty, wid, bend) {
    const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
    bend = bend || 0;
    const p = (a, b) => n1(bx + ux * a + px * b) + ' ' + n1(by + uy * a + py * b);
    return 'M' + p(0, 0) + 'C' + p(L * 0.25, wid + bend) + ' ' + p(L * 0.72, wid * 0.8 + bend) + ' ' + p(L, 0) + 'C' + p(L * 0.72, -wid * 0.8 + bend) + ' ' + p(L * 0.25, -wid + bend) + ' ' + p(0, 0) + 'Z';
  }
  const leafEl = (bx, by, tx, ty, wid, bend, c, sw) =>
    '<path d="' + leaf(bx, by, tx, ty, wid, bend) + '" fill="' + c[0] + '" stroke="' + OL + '" stroke-width="' + (sw || 2.6) + '" stroke-linejoin="round"/>' +
    '<path d="M' + n1(bx) + ' ' + n1(by) + 'L' + n1(bx + (tx - bx) * 0.7) + ' ' + n1(by + (ty - by) * 0.7) + '" stroke="' + c[1] + '" stroke-width="2" stroke-linecap="round" fill="none"/>';
  const stemEl = (d, c, w) => '<path d="' + d + '" fill="none" stroke="' + OL + '" stroke-width="' + (w + 3.6) + '" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  const shadowEl = (rx, cy) => '<ellipse cx="0" cy="' + (cy || 0) + '" rx="' + rx + '" ry="' + n1(Math.max(3, rx * 0.22)) + '" fill="' + OL + '" opacity=".18"/>';
  function ball(x, y, r, c) {
    return '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + r + '" fill="' + c[2] + '"/>' +
      '<circle cx="' + n1(x - r * 0.12) + '" cy="' + n1(y - r * 0.14) + '" r="' + n1(r * 0.86) + '" fill="' + c[0] + '"/>' +
      '<ellipse cx="' + n1(x - r * 0.36) + '" cy="' + n1(y - r * 0.4) + '" rx="' + n1(r * 0.3) + '" ry="' + n1(r * 0.17) + '" transform="rotate(-35 ' + n1(x - r * 0.36) + ' ' + n1(y - r * 0.4) + ')" fill="' + c[1] + '"/>' +
      '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + r + '" fill="none" stroke="' + OL + '" stroke-width="2.6"/>' +
      '<circle cx="' + n1(x - r * 0.5) + '" cy="' + n1(y - r * 0.5) + '" r="' + n1(Math.max(1.2, r * 0.13)) + '" fill="#fff"/>';
  }
  /** Seedling with root ball; base (ground contact) at 0,0, about 60 u tall at scale 1. */
  function seedArt(w, noShadow) {
    const c = w ? WILT : GREEN;
    let s = noShadow ? '' : shadowEl(17);
    s += '<ellipse cx="0" cy="-7" rx="16" ry="9.5" fill="#7E5030" stroke="' + OL + '" stroke-width="2.6"/><ellipse cx="-5" cy="-10" rx="6" ry="2.6" fill="#A87448"/>';
    if (!w) {
      s += stemEl('M0 -11Q-2 -26 0 -40', '#3E8A3A', 4.4);
      s += leafEl(-1, -28, -28, -42, 9, -2, c) + leafEl(1, -34, 28, -54, 9, 2, c) + leafEl(0, -38, -1, -60, 5.5, 0, [c[1], '#C2E8B6'], 2.2);
    } else {
      s += stemEl('M0 -11Q4 -22 13 -26', '#A88A3A', 4.4);
      s += leafEl(11, -25, -6, -11, 8, 2, c) + leafEl(13, -26, 31, -10, 8, -2, c) + leafEl(13, -26, 22, -15, 4.5, 0, [c[2], c[1]], 2.2);
    }
    return s;
  }
  /** Grown plant ready to harvest (base at 0,0, ~95 u tall). */
  function growArt(kind) {
    let s = shadowEl(30);
    if (kind === 'jagung') {
      s += stemEl('M0 -2Q-2 -50 0 -98', '#4E9A3E', 7);
      s += leafEl(0, -22, -44, -12, 9, -6, GREEN) + leafEl(0, -34, 44, -28, 9, 6, GREEN) + leafEl(0, -60, -38, -66, 8, -4, GREEN) + leafEl(0, -72, 34, -88, 8, 4, GREEN);
      s += '<path d="M5 -38Q22 -48 18 -74Q15 -86 9 -81Q1 -64 5 -38Z" fill="#FFC83D" stroke="' + OL + '" stroke-width="2.6" stroke-linejoin="round"/>';
      for (let k = 0; k < 5; k++) s += '<circle cx="' + (10 + (k % 2) * 4) + '" cy="' + (-46 - k * 7) + '" r="2" fill="#E09A00"/>';
      s += leafEl(3, -36, 16, -66, 6, -3, ['#86CC8C', '#C2E8B6'], 2.2);
      s += '<path d="M0 -98l-7 -12M0 -98l0 -14M0 -98l7 -12" stroke="#C99A5B" stroke-width="3.2" stroke-linecap="round" fill="none"/>';
      return s;
    }
    s += stemEl('M0 -2Q-2 -30 0 -62', '#3E8A3A', 5.5);
    s += leafEl(0, -14, -38, -28, 13, -3, GREEN) + leafEl(0, -20, 38, -36, 13, 3, GREEN) + leafEl(0, -40, -32, -66, 12, -2, GREEN) + leafEl(0, -46, 30, -76, 12, 2, GREEN) + leafEl(0, -60, -2, -90, 10, 0, GREEN);
    if (kind === 'cabai') {
      [[-18, -40, 20], [16, -56, -15], [-4, -72, 6]].forEach(([x, y, a]) => {
        s += '<g transform="translate(' + x + ' ' + y + ') rotate(' + a + ')"><path d="M0 0C7 6 8 22 1 32C-1 35 -4 33 -3 29C0 19 -5 9 -5 2Z" fill="#E2453C" stroke="' + OL + '" stroke-width="2.4" stroke-linejoin="round"/>' +
          '<path d="M-2.4 5C-1.6 12 -2.2 20 -2.2 25" stroke="#F27A6E" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M-5 1Q0 -5 5 0" stroke="#357F40" stroke-width="4" fill="none" stroke-linecap="round"/></g>';
      });
    } else {
      [[-17, -34, 12], [17, -50, 11], [-5, -66, 9]].forEach(([x, y, r]) => {
        s += ball(x, y, r, ['#E2453C', '#F27A6E', '#B5322B']) + '<path d="M' + (x - 5) + ' ' + (y - r + 1) + 'l5 3l5 -3M' + x + ' ' + (y - r + 3) + 'v-5" stroke="#357F40" stroke-width="2.6" stroke-linecap="round" fill="none"/>';
      });
    }
    return s;
  }
  const WEED = shadowEl(18) + '<path d="M-18 0Q-16 -14 -24 -30Q-10 -19 -7 -34Q-1 -19 3 -38Q8 -17 23 -28Q13 -12 18 0Z" fill="#9CC64E" stroke="' + OL + '" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M-7 -3L-13 -21M3 -3L3 -28M10 -3L16 -19" stroke="#5E9A36" stroke-width="2.2" stroke-linecap="round" fill="none"/>';
  const HOLE = '<ellipse cx="0" cy="0" rx="25" ry="12.5" fill="#C99460"/><ellipse cx="0" cy="1.6" rx="19" ry="8.5" fill="#4A2E1A"/><path d="M-14 -2.5Q0 -7.5 14 -2.5" stroke="#2E1C10" stroke-width="2" fill="none" opacity=".5"/>';
  function birdArt() {
    return shadowEl(16, 2) + '<path d="M-18 -14Q-31 -19 -35 -10Q-26 -10 -18 -8Z" fill="#7E5A36" stroke="' + OL + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<ellipse cx="0" cy="-16" rx="20" ry="14" fill="#A0703F" stroke="' + OL + '" stroke-width="2.6"/><ellipse cx="5" cy="-11" rx="12" ry="6.5" fill="#F3DDA6"/>' +
      '<circle cx="16" cy="-29" r="10" fill="#A0703F" stroke="' + OL + '" stroke-width="2.6"/><circle cx="19" cy="-31" r="2.6" fill="' + INK + '"/><circle cx="18.2" cy="-32" r="1" fill="#fff"/>' +
      '<path d="M25 -30L35 -27L25 -24Z" fill="#F28C28" stroke="' + OL + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<g class="bb-flap"><path d="M-9 -20Q-3 -36 11 -22Q2 -13 -9 -20Z" fill="#7E5A36" stroke="' + OL + '" stroke-width="2" stroke-linejoin="round"/></g>' +
      '<path d="M-2 -3v5M6 -3v5" stroke="#C76A12" stroke-width="2.6" stroke-linecap="round"/>';
  }
  function poleArt(len) {
    len = len || 110;
    return '<rect x="' + (-len / 2) + '" y="-7" width="' + len + '" height="14" rx="7" fill="#E3C27F" stroke="' + OL + '" stroke-width="2.6"/>' +
      '<rect x="' + (-len / 2 + 7) + '" y="1" width="' + (len - 14) + '" height="3.6" rx="1.8" fill="#B8924F" opacity=".7"/>' +
      '<path d="M' + n1(-len / 6) + ' -6v12M' + n1(len / 6) + ' -6v12" stroke="#A47E3E" stroke-width="2.4"/>';
  }
  /** A tied bundle of seedlings (or bamboo poles) with a size tag. */
  function bundleArt(size, item, decor) {
    let s = shadowEl(30);
    if (item === 'pole') {
      for (let k = 0; k < 5; k++) s += '<g transform="translate(' + ((k % 2) * 6 - 3) + ' ' + (-8 - k * 11) + ')">' + poleArt(96) + '</g>';
      s += '<rect x="-30" y="-64" width="9" height="62" rx="4" fill="#E2453C" stroke="' + OL + '" stroke-width="2"/><rect x="21" y="-64" width="9" height="62" rx="4" fill="#E2453C" stroke="' + OL + '" stroke-width="2"/>';
      s += '<rect x="-27" y="-50" width="54" height="44" rx="10" fill="' + CREAM + '" stroke="' + OL + '" stroke-width="2.4"/>' + Tc(0, -28, size, 38, { decor });
      return s;
    }
    [-15, -7.5, 0, 7.5, 15].forEach(x => { s += '<use href="#bb-seedns" transform="translate(' + x + ' 0) rotate(' + n1(x * 0.9) + ')"/>'; });
    s += '<rect x="-21" y="-26" width="42" height="9" rx="4" fill="#E2453C" stroke="' + OL + '" stroke-width="2.2"/>';
    s += '<rect x="-27" y="-14" width="54" height="44" rx="10" fill="' + CREAM + '" stroke="' + OL + '" stroke-width="2.4"/>' + Tc(0, 8, size, 38, { decor });
    return s;
  }
  function handleArt(mode) {
    let s = '<circle r="56" fill="#C76A12"/><circle cx="-5" cy="-6" r="50" fill="#F28C28"/><ellipse cx="-22" cy="-26" rx="16" ry="9" transform="rotate(-35 -22 -26)" fill="#F8B26A"/>' +
      '<circle r="56" fill="none" stroke="' + OL + '" stroke-width="4"/>';
    const d = mode === 'x' ? 'M-30 0H30M-30 0l12 -12M-30 0l12 12M30 0l-12 -12M30 0l-12 12'
      : mode === 'y' ? 'M0 -30V30M0 -30l-12 12M0 -30l12 12M0 30l-12 -12M0 30l12 -12'
        : 'M-22 -22L22 22M-22 -22h17M-22 -22v17M22 22h-17M22 22v-17';
    s += '<path d="' + d + '" stroke="' + OL + '" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="' + d + '" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    return s;
  }
  function pegArt(mode) {
    let s = '<circle r="52" fill="#7E4A27"/><circle cx="-4" cy="-5" r="47" fill="#A8673A"/><circle r="30" fill="#C68654" stroke="#7E4A27" stroke-width="3"/>' +
      '<circle r="52" fill="none" stroke="' + OL + '" stroke-width="4"/>';
    const d = mode === 'y' ? 'M0 -24V24M0 -24l-10 10M0 -24l10 10M0 24l-10 -10M0 24l10 -10' : 'M-24 0H24M-24 0l10 -10M-24 0l10 10M24 0l-10 -10M24 0l-10 10';
    s += '<path d="' + d + '" stroke="' + OL + '" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="' + d + '" stroke="#FFF3E0" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    return s;
  }
  function tuft(x, y, s, c) {
    return '<path d="M' + n1(x - 8 * s) + ' ' + n1(y) + 'Q' + n1(x - 7 * s) + ' ' + n1(y - 10 * s) + ' ' + n1(x - 10 * s) + ' ' + n1(y - 15 * s) + 'Q' + n1(x - 2 * s) + ' ' + n1(y - 9 * s) + ' ' + n1(x) + ' ' + n1(y - 17 * s) + 'Q' + n1(x + 3 * s) + ' ' + n1(y - 8 * s) + ' ' + n1(x + 10 * s) + ' ' + n1(y - 13 * s) + 'Q' + n1(x + 7 * s) + ' ' + n1(y - 6 * s) + ' ' + n1(x + 8 * s) + ' ' + n1(y) + 'Z" fill="' + (c || '#5FAE52') + '"/>';
  }
  /** Text: numbers in Fredoka (default), words in Andika with o.body. y is the visual centre. */
  function Tc(x, y, s, size, o) {
    o = o || {};
    return '<text x="' + n1(x) + '" y="' + n1(y + size * 0.35) + '" font-size="' + size + '" text-anchor="' + (o.anchor || 'middle') + '" fill="' + (o.fill || INK) + '"' +
      (o.body ? ' class="t-body" font-weight="700"' : ' font-weight="600" style="font-variant-numeric:tabular-nums"') +
      (o.decor ? ' data-qc="decor"' : '') + (o.op != null ? ' opacity="' + o.op + '"' : '') + '>' + s + '</text>';
  }

  /* ================= stage setup ================= */
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const defs = GS.el('defs', null, svg);
  defs.innerHTML = '<g id="bb-seed">' + seedArt(false) + '</g><g id="bb-seedns">' + seedArt(false, true) + '</g><g id="bb-wilt">' + seedArt(true) + '</g>' +
    CROPS.map(k => '<g id="bb-grow-' + k + '">' + growArt(k) + '</g>').join('') + '<g id="bb-weed">' + WEED + '</g><g id="bb-hole">' + HOLE + '</g>';
  const bgG = GS.el('g', { class: 'bb-bg' }, svg);
  drawBackground(bgG);
  const world = GS.el('g', { class: 'bb-world' }, svg);

  function drawBackground(g) {
    let sc = '';
    try { if (hasArt('scene')) sc = GS.art.scene('sawah', 1280, 240); } catch (e) { sc = ''; }
    if (!sc) sc = '<rect x="-600" y="0" width="2480" height="240" fill="#BFE6EE"/>';
    let s = '<rect x="-600" y="176" width="2480" height="640" fill="#7CC26B"/>' +
      '<path d="M-600 176Q640 164 1880 176V192Q640 182 -600 192Z" fill="#8FCD7C"/>';
    const r = rng(11);
    for (let i = 0; i < 90; i++) s += tuft(-580 + r() * 2440, 205 + r() * 590, 0.8 + r() * 0.9, i % 3 ? '#5FAE52' : '#6DBA5E');
    const FL = ['#F59AB0', '#FFC83D', '#FFF8EC', '#F28C28'];
    for (let i = 0; i < 40; i++) { const x = -580 + r() * 2440, y = 210 + r() * 580; s += '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + n1(3 + r() * 2.5) + '" fill="' + FL[i % 4] + '"/>'; }
    // far-off rest hut (dangau) and bushes, only visible on wide screens
    s += '<g transform="translate(1420 330)"><rect x="-60" y="-70" width="8" height="70" fill="#A8673A"/><rect x="52" y="-70" width="8" height="70" fill="#A8673A"/><path d="M-80 -66L0 -118L80 -66Z" fill="#C99A5B"/><rect x="-62" y="-26" width="124" height="10" fill="#C68654"/></g>';
    s += '<g transform="translate(-160 360)"><ellipse rx="70" ry="38" fill="#5BAE4E"/><ellipse cx="-30" cy="-14" rx="40" ry="26" fill="#6DBA5E"/></g>';
    GS.markup(g, sc + '<g class="gs-scene">' + s + '</g>');
  }

  /* ================= level tables (docs/KURIKULUM.md, Kebun Bibit) ================= */
  const add = (r, c) => Array(r).fill(c).join(' + ');
  const mulS = (r, c) => r + ' × ' + c + ' = ' + r * c;
  const addS = (r, c) => add(r, c) + ' = ' + r * c;
  function pairsRound(a, cols, b) {
    const cells = [];
    for (let c = 0; c < a; c++) cells.push([0, c]);
    for (let c = 0; c < cols; c++) cells.push([1, c]);
    const pre = cells.filter(([r, c]) => r === 0 || c < b);
    return {
      kind: 'place', rows: 2, cols, cells, pre, tray: cols - b + 1, check: 'pairs', a,
      done: () => [a + ' + ' + a + ' = ' + 2 * a],
      say: TK ? 'Buat baris bawah sama panjang dengan baris atas.' : 'Baris bawah harus sama banyak dengan baris atas.'
    };
  }
  function compareRound() {
    let a = R(3, 6), b;
    do { b = R(3, 6); } while (b === a || Math.abs(a - b) > 2);
    return { kind: 'compare', a, b, say: 'Baris bibit mana yang lebih banyak? Ketuk satu.' };
  }
  const tkBasket = (rows, cols, cells, say, tray) => ({ kind: 'basket', rows, cols, cells, tray: tray || 10, say });
  function basketRect(rows, cols, o) { return Object.assign({ kind: 'basket', rows, cols, cells: rect(rows, cols), shape: 'rect' }, o); }
  function polyRound(N, rows, cols) {
    const H = rows * cols;
    return { kind: 'basket', rows, cols, cells: rect(rows, cols), basketN: N, polyCap: 4, done: () => [N + ' − ' + H + ' = ' + (N - H)], say: 'Ada ' + N + ' bibit, lubangnya ' + H + '. Taruh sisanya di polybag.' };
  }
  function completeRound(rows, cols, k, say) {
    const H = rows * cols;
    return basketRect(rows, cols, { pre: rect(rows, cols).slice(0, k), tray: 12, done: () => [k + ' + ' + (H - k) + ' = ' + H], say: say || 'Lengkapi lahannya. Berapa bibit lagi?' });
  }
  function dobel(n) {
    const cells = rect(2, n).concat([[0, n]]);
    return { kind: 'basket', rows: 2, cols: n + 1, cells: sortCells(cells), tray: 12, done: () => [n + ' + ' + n + ' + 1 = ' + (2 * n + 1)], say: 'Dobel tambah satu. Ambil bibit yang pas.' };
  }
  function evenOdd(N) {
    const h = Math.floor(N / 2);
    return {
      kind: 'grid', N, lockR: 2, maxR: 2, maxC: 8, start: [2, 1], poly: 1, live: null,
      done: () => N % 2 ? [N + ' = ' + h + ' + ' + h + ' + 1', 'ganjil'] : [N + ' = ' + h + ' + ' + h, 'genap'],
      say: 'Ada ' + N + ' bibit. Tanam berpasangan. Tarik pojok lahan.'
    };
  }
  function orderRound(a, b, o) {
    return Object.assign({
      kind: 'grid', N: a * b, order: [a, b], maxR: 6, maxC: 10, start: [1, 1], live: TIER === 'k2' ? 'add' : 'mul',
      done: () => TIER === 'k2' ? [addS(a, b), mulS(a, b)] : [mulS(a, b)],
      say: 'Buat lahan ' + a + ' baris, isi ' + b + '. Tarik pojoknya.'
    }, o);
  }
  function lockCRound(N, c, o) {
    const r = N / c;
    return Object.assign({
      kind: 'grid', N, lockC: c, maxR: 6, maxC: c, start: [1, c], live: 'add',
      done: () => [addS(r, c), mulS(r, c)], say: 'Tiap baris isi ' + c + '. Tarik lahan sampai bibitnya pas.'
    }, o);
  }
  function divRound(N, c) {
    const r = N / c;
    return lockCRound(N, c, { done: () => [N + ' − ' + Array(r).fill(c).join(' − ') + ' = 0', N + ' : ' + c + ' = ' + r], say: 'Ada ' + N + ' bibit. Tiap baris isi ' + c + '. Berapa baris?' });
  }
  function lockRRound(N, r) {
    const c = N / r;
    return { kind: 'grid', N, lockR: r, maxR: r, maxC: 10, start: [r, 1], live: 'mul', done: () => [N + ' : ' + r + ' = ' + c, mulS(r, c)], say: 'Bagi ' + N + ' bibit ke ' + r + ' baris sama banyak.' };
  }
  function remRound(N, c, maxR) {
    const q = Math.floor(N / c), m = N % c;
    return { kind: 'grid', N, lockC: c, maxR: maxR || 8, maxC: c, start: [1, c], poly: c - 1, live: 'mul', done: () => [N + ' : ' + c + ' = ' + q + ' sisa ' + m], say: 'Ada ' + N + ' bibit, baris isi ' + c + '. Sisanya masuk polybag.' };
  }
  function ceilRound(N, c) {
    const q = Math.floor(N / c), m = N % c, need = Math.ceil(N / c);
    return { kind: 'grid', N, lockC: c, maxR: 7, maxC: c, start: [1, c], ceil: true, live: 'mul', done: () => [N + ' : ' + c + ' = ' + q + ' sisa ' + m, 'jadi butuh ' + need + ' baris'], say: 'Ada ' + N + ' bibit, baris isi ' + c + '. Butuh berapa baris?' };
  }
  function splitRound(Rr, Cc) {
    return { kind: 'split', R: Rr, C: Cc, s: 5, say: 'Belah lahan dengan tali. Tiap keranjang harus pas.' };
  }
  function split2Round(Rr, Cc) {
    return { kind: 'split', R: Rr, C: Cc, s: 10, t: 10, say: 'Geser dua tali. Tiap keranjang harus pas.' };
  }
  function areaRound(rows, cols) {
    return basketRect(rows, cols, { hideGrid: true, labels: true, tray: 9, bundles: 5, bundle: 10, done: () => [mulS(rows, cols) + ' petak'], say: 'Berapa petak luas lahan ini? Ambil bibit sebanyak itu.' });
  }
  function fenceRound(rows, cols) {
    const P = 2 * (rows + cols);
    return basketRect(rows, cols, { item: 'pole', fence: true, labels: true, tray: 9, bundles: 4, bundle: 5, done: () => [cols + ' + ' + rows + ' + ' + cols + ' + ' + rows + ' = ' + P + ' batang'], say: 'Kambing lapar! Ambil batang bambu untuk pagar keliling.' });
  }
  function lShape(Rr, Cc, cr, cc, split) {
    const cells = rect(Rr, Cc).filter(([r, c]) => !(r < cr && c >= Cc - cc));
    const A = Rr * (Cc - cc), B = (Rr - cr) * cc;
    return {
      kind: 'basket', rows: Rr, cols: Cc, cells, shape: 'L', L: { cr, cc }, hideGrid: true, labels: true, showSplit: split, tray: 9, bundles: 5, bundle: 10,
      done: () => [Rr + ' × ' + (Cc - cc) + ' + ' + (Rr - cr) + ' × ' + cc + ' = ' + (A + B)],
      say: split ? 'Lahan L ini dua persegi panjang. Berapa petak semuanya?' : 'Berapa petak luas lahan L ini? Ambil bibitnya.'
    };
  }
  function randomL() { const Rr = R(5, 7), Cc = R(6, 8); return lShape(Rr, Cc, R(2, Rr - 2), R(2, Cc - 3), false); }
  function lcmRound(a, b) { return { kind: 'lcm', a, b, say: 'Baris isi ' + a + ' dan isi ' + b + '. Berapa bibit paling sedikit supaya pas?' }; }
  function primeRound(N) {
    return { kind: 'grid', N, maxR: 7, maxC: 8, minR: 2, minC: 2, start: [2, 2], prime: true, live: 'mul', say: 'Ada ' + N + ' bibit. Bisa jadi persegi panjang? Kalau tidak, satu baris saja.' };
  }
  function freeRound(N) {
    return { kind: 'grid', N, maxR: 6, maxC: 8, start: [1, 1], live: 'mul', done: s => [mulS(s.r, s.c)], say: 'Ada ' + N + ' bibit. Buat lahan yang pas.' };
  }
  function twoDiff(min, max, not) { let a, b; do { a = R(min, max); b = R(min, max); } while (not && a === not[0] && b === not[1]); return [a, b]; }

  const LV = {
    tk: [
      () => [
        { kind: 'place', rows: 1, cols: 3, cells: rect(1, 3), tray: 5, auto: true, say: 'Tanam satu bibit di setiap lubang.' },
        { kind: 'place', rows: 1, cols: 4, cells: rect(1, 4), tray: 6, auto: true, say: 'Satu lubang, satu bibit. Ayo tanam!' }
      ],
      () => [
        tkBasket(2, 3, sortCells(GS.shuffle(rect(2, 3)).slice(0, 4)), 'Ambil bibit ke keranjang. Satu untuk setiap lubang.', 8),
        tkBasket(2, 3, sortCells(GS.shuffle(rect(2, 3)).slice(0, 5)), 'Lubangnya ada berapa? Ambil bibit yang pas.', 8)
      ],
      () => { const a1 = R(3, 5), a2 = R(3, 5); return [pairsRound(a1, 6, R(1, a1 - 2)), pairsRound(a2, 6, R(1, a2 - 2))]; },
      () => [compareRound(), compareRound()],
      () => [
        { kind: 'place', rows: 2, cols: 2, cells: rect(2, 2), tray: 6, auto: true, say: 'Isi semua lubang. Lalu kita hitung panennya!' },
        { kind: 'place', rows: 2, cols: 3, cells: rect(2, 3), tray: 8, auto: true, say: 'Lahan 2 baris. Isi semua lubangnya.' }
      ],
      () => { const f = pick([[2, 4], [3, 3]]); return [tkBasket(f[0], f[1], rect(f[0], f[1]), 'Ambil bibit yang pas untuk semua lubang.', 12), tkBasket(2, 5, rect(2, 5), 'Lahan baru. Ambil bibit yang pas, ya.', 12)]; }
    ],
    k1: [
      () => [
        { kind: 'place', rows: 1, cols: 5, cells: rect(1, 5), tray: 7, auto: true, done: () => ['1 + 1 + 1 + 1 + 1 = 5'], say: 'Isi satu baris dengan 5 bibit.' },
        { kind: 'place', rows: 1, cols: 5, cells: rect(1, 5), pre: rect(1, 2), tray: 5, auto: true, done: () => ['2 + 3 = 5'], say: 'Sudah ada 2 bibit. Isi sampai penuh.' }
      ],
      () => [basketRect(2, 5, { tray: 12, done: () => ['5 + 5 = 10'], say: 'Lahan 2 baris isi 5. Ambil bibit yang pas.' })],
      () => [pairsRound(4, 7, R(1, 2)), pairsRound(6, 7, R(1, 3))],
      () => [dobel(3), dobel(4)],
      () => { const r2 = pick([[11, 2, 4], [10, 2, 4], [9, 2, 4]]); return [polyRound(12, 2, 5), polyRound(r2[0], r2[1], r2[2])]; },
      () => { const e = R(3, 6) * 2, o = R(3, 7) * 2 + 1; return GS.shuffle([evenOdd(e), evenOdd(o)]).concat([evenOdd(R(9, 15))]); },
      () => [completeRound(2, 5, R(4, 7)), completeRound(4, 5, R(11, 15))],
      () => [completeRound(2, 6, R(5, 7), 'Tantangan! Lahan 2 baris isi 6. Lengkapi.'), polyRound(13, 2, 5)]
    ],
    k2: [
      () => [lockCRound(12, 4), lockCRound(15, 3)],
      () => [orderRound(R(3, 5), 2), orderRound(R(2, 4), 5), orderRound(R(2, 3), 10)],
      () => { const p = pick([[3, 4], [4, 3], [2, 6], [3, 5]]); return [orderRound(2, 5, { rotate: true, maxR: 6, maxC: 8 }), orderRound(p[0], p[1], { rotate: true, maxR: 6, maxC: 8 })]; },
      () => { const p = pick([[3, 6], [5, 3], [3, 5]]); return [basketRect(4, 5, { tray: 9, bundles: 4, bundle: 5, done: () => [mulS(4, 5), addS(4, 5)], say: 'Berapa bibit untuk 4 baris isi 5? Ambil, lalu tanam.' }), basketRect(p[0], p[1], { tray: 9, bundles: 4, bundle: 5, done: () => [mulS(p[0], p[1]), addS(p[0], p[1])], say: 'Lahan ' + p[0] + ' baris isi ' + p[1] + '. Berapa bibitnya?' })]; },
      () => { const c = pick([3, 4]); return [divRound(15, 5), divRound(c * R(3, 5), c)]; },
      () => [{ kind: 'grid', N: 12, maxR: 6, maxC: 8, start: [1, 1], arr: { need: 2 }, live: 'mul', say: 'Ada 12 bibit. Temukan dua susunan yang berbeda.' }],
      () => [
        { kind: 'grid', N: 20, stack: [3, 4], maxR: 6, maxC: 4, start: [1, 4], live: 'stack', done: () => ['3 × 4 + 2 × 4 = 20', '5 × 4 = 20'], say: 'Ada 20 bibit. Lahan atas 3 × 4. Tarik lahan bawah.' },
        { kind: 'grid', N: 25, stack: [2, 5], maxR: 6, maxC: 5, start: [1, 5], live: 'stack', done: () => ['2 × 5 + 3 × 5 = 25', '5 × 5 = 25'], say: 'Ada 25 bibit. Lahan atas 2 × 5. Tarik lahan bawah.' }
      ],
      () => GS.shuffle([14, 16, 18, 20]).slice(0, 2).map(freeRound)
    ],
    k3: [
      () => [orderRound(6, 7, { maxR: 10, maxC: 10 }), orderRound(...twoDiff(6, 9, [6, 7]), { maxR: 10, maxC: 10 })],
      () => { const r = pick([3, 5]); return [lockRRound(24, 4), lockRRound(r * R(5, 8), r)]; },
      () => [{ kind: 'grid', N: 24, maxR: 12, maxC: 12, start: [1, 1], arr: { need: 3, given: [1, 24] }, live: 'mul', say: 'Ada 24 bibit. 1 baris isi 24 kepanjangan. Cari semua susunan lain!' }],
      () => [splitRound(7, 6), splitRound(R(6, 9), R(4, 8))],
      () => [remRound(26, 4), remRound(5 * R(4, 6) + R(1, 4), 5)],
      () => { const p = pick([[4, 8], [6, 6], [4, 9], [6, 5]]); return [areaRound(5, 7), areaRound(p[0], p[1])]; },
      () => { const p = pick([[4, 5], [3, 6], [4, 4]]); return [fenceRound(3, 4), fenceRound(p[0], p[1])]; },
      () => [orderRound(...twoDiff(7, 9), { maxR: 10, maxC: 10, say: 'Tantangan! Pesanan baru. Tarik pojoknya.' }), splitRound(R(6, 9), R(4, 8)), remRound(6 * R(3, 5) + R(1, 5), 6)]
    ],
    k4: [
      () => { let a, b; do { a = R(11, 15); b = R(11, 15); } while (a === 12 && b === 13); return [split2Round(12, 13), split2Round(a, b)]; },
      () => [{ kind: 'grid', N: 0, fence: 20, maxR: 9, maxC: 9, start: [2, 3], live: null, say: 'Ada 20 batang pagar. Buat lahan yang paling luas.' }],
      () => GS.shuffle(GS.shuffle([7, 11, 13]).slice(0, 2).concat(GS.shuffle([9, 10, 12, 14, 15]).slice(0, 2))).map(primeRound),
      () => { const p = pick([[3, 4], [6, 8], [2, 5], [3, 5]]); return [lcmRound(4, 6), lcmRound(p[0], p[1])]; },
      () => { const c = pick([6, 7, 9]); let N; do { N = R(2 * c + 1, 6 * c - 1); } while (N % c === 0); return [ceilRound(30, 8), ceilRound(N, c)]; },
      () => [lShape(6, 8, 3, 4, true), randomL()],
      () => { const p = pick([[3, 4], [2, 5], [3, 5]]), c = pick([6, 7]); let N; do { N = R(2 * c + 1, 5 * c - 1); } while (N % c === 0); return [split2Round(R(11, 14), R(11, 14)), ceilRound(N, c), lcmRound(p[0], p[1])]; },
      () => [randomL(), lcmRound(6, 8), split2Round(R(13, 15), R(13, 15))]
    ]
  };
  const LEVELS = LV[TIER] || LV.k1;

  const hud = GS.hud({ gameId: GAME, title: 'Kebun Bibit', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: i => buildLevel(i) });

  /* ================= state ================= */
  let rounds = [], ri = 0, C = null, S = {}, LS = {};
  let tries = 0, busy = false, tok = 0, solving = false;
  const layers = {};
  let btnMain = null, btnAlt = null;

  function buildLevel(i) {
    tries = 0; ri = 0; LS = {};
    rounds = LEVELS[i]();
    startRound();
  }
  function startRound() {
    tok++; busy = false;
    C = rounds[ri]; S = { plants: {} };
    C.crop = C.crop || CROPS[(run.current + ri) % CROPS.length];
    world.innerHTML = '';
    ['lahan', 'soil', 'labels', 'plants', 'fx', 'ui', 'board', 'handles', 'drag'].forEach(k => { layers[k] = GS.el('g', { class: 'bb-' + k }, world); });
    layers.drag.setAttribute('pointer-events', 'none');
    dock.innerHTML = ''; btnMain = btnAlt = null;
    ({ place: buildPlace, basket: buildBasket, grid: buildGrid, split: buildSplit, compare: buildCompare, lcm: buildLcm })[C.kind]();
    updateDock();
    hud.mood('happy');
    GS.say(C.say);
  }
  function nextRound() {
    ri++;
    if (ri < rounds.length) { startRound(); return; }
    const stars = tries === 0 ? 3 : tries <= 2 ? 2 : 1;
    hud.mood('cheer');
    run.win(stars, pick(['Panen besar! Hebat!', 'Kebunmu subur sekali!', 'Semua bibit tumbuh. Hebat!']));
  }

  /* ================= geometry ================= */
  const BOX = { x0: 90, y0: 165, x1: 800, y1: 772 };
  function geom(rows, cols, box, maxCell) {
    box = box || BOX;
    const cell = Math.floor(Math.min(maxCell || 120, (box.x1 - box.x0) / cols, (box.y1 - box.y0) / rows));
    const w = cell * cols, h = cell * rows;
    return { rows, cols, cell, w, h, x: Math.round(box.x0 + (box.x1 - box.x0 - w) / 2), y: Math.round(box.y0 + (box.y1 - box.y0 - h) / 2) };
  }
  const cxOf = (g, c) => g.x + (c + 0.5) * g.cell;
  const cyOf = (g, r) => g.y + (r + 0.5) * g.cell;
  const baseOf = (g, r, c) => ({ x: cxOf(g, c), y: cyOf(g, r) + g.cell * 0.2 });
  function toScreen(x, y) { const m = svg.getScreenCTM(); if (!m) return null; const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; return pt.matrixTransform(m); }
  function floatAt(x, y, text) { const q = toScreen(x, y); if (q) GS.floatText(text, q.x, q.y); }

  /* ================= plants, weeds, birds ================= */
  function plantAt(g, r, c, type, pop) {
    const key = g.id + ':' + r + ',' + c;
    let p = S.plants[key];
    if (!type) { if (p) { p.el.remove(); delete S.plants[key]; } return; }
    if (!p) {
      const b = baseOf(g, r, c);
      const el = GS.el('g', { transform: 'translate(' + n1(b.x) + ' ' + n1(b.y) + ')' });
      el.__order = r * 1000 + c + (g.order || 0);
      let before = null;
      for (const ch of layers.plants.children) if (ch.__order > el.__order) { before = ch; break; }
      layers.plants.insertBefore(el, before);
      p = S.plants[key] = { el, u: GS.el('use', null, el), g, r, c };
    }
    p.type = type;
    p.u.setAttribute('href', '#bb-' + (type === 'grow' ? 'grow-' + C.crop : type));
    const s = (g.cell / 100) * (type === 'grow' ? 0.86 : 1);
    p.u.setAttribute('transform', 'scale(' + n1(s * 100) / 100 + ')');
    if (pop && !GS.reducedMotion) tween(260, e => p.u.setAttribute('transform', 'scale(' + (s * (0.35 + 0.65 * e)).toFixed(3) + ')'), 'outBack');
  }
  function clearPlants(filter) { Object.keys(S.plants).forEach(k => { const p = S.plants[k]; if (!filter || filter(p)) { p.el.remove(); delete S.plants[k]; } }); }
  function weedAt(g, r, c) {
    const b = baseOf(g, r, c), s = g.cell / 100;
    const el = GS.el('g', { transform: 'translate(' + n1(b.x) + ' ' + n1(b.y) + ')' }, layers.fx);
    const u = GS.el('use', { href: '#bb-weed', transform: 'scale(' + n1(s * 100) / 100 + ')' }, el);
    if (!GS.reducedMotion) tween(300, e => u.setAttribute('transform', 'scale(' + (s * (0.2 + 0.8 * e)).toFixed(3) + ')'), 'outBack');
    return el;
  }
  async function birdTo(x, y, scale) {
    const my = tok;
    const el = GS.el('g', { transform: 'translate(' + (x + 500) + ' ' + (y - 320) + ')' }, layers.fx);
    const inner = GS.el('g', { transform: 'scale(' + (scale || 1.3) + ')' }, el);
    GS.markup(inner, birdArt());
    GS.sfx.whoosh();
    await tween(700, e => el.setAttribute('transform', 'translate(' + n1(x + 500 * (1 - e)) + ' ' + n1(y - 320 * (1 - e) - Math.sin(e * Math.PI) * 40) + ')'), 'outCubic');
    if (my !== tok) return;
    for (let k = 0; k < 2; k++) {
      await tween(160, e => el.setAttribute('transform', 'translate(' + x + ' ' + n1(y - 10 * Math.sin(e * Math.PI)) + ')'));
      GS.sfx.tick();
    }
  }
  /** Fly a seedling (or bundle/pole) from a to b along an arc. */
  function flyArt(kind, a, b, dur, delay, s0, s1) {
    const el = GS.el('g', { transform: 'translate(' + n1(a.x) + ' ' + n1(a.y) + ')' }, layers.drag);
    const inner = GS.el('g', null, el);
    GS.markup(inner, itemArt(kind));
    s0 = s0 || 1; s1 = s1 || 1;
    const go = () => tween(dur, e => {
      const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * 70;
      el.setAttribute('transform', 'translate(' + n1(x) + ' ' + n1(y) + ') scale(' + (s0 + (s1 - s0) * e).toFixed(3) + ')');
    }, 'inOutCubic').then(() => el.remove());
    return delay ? wait(delay).then(go) : go();
  }
  function itemArt(kind) {
    if (kind === 'bundle') return bundleArt(S.bundleSize || 10, 'seed', true);
    if (kind === 'pole') return poleArt(100);
    if (kind === 'polebundle') return bundleArt(S.bundleSize || 5, 'pole', true);
    return '<use href="#bb-seed"/>';
  }
  function clearFx() { layers.fx.innerHTML = ''; }

  /* ================= field drawing ================= */
  function drawLahan(layer, g) {
    const pad = Math.max(10, g.cell * 0.14);
    let s = '<rect x="' + (g.x - pad) + '" y="' + (g.y - pad) + '" width="' + (g.w + 2 * pad) + '" height="' + (g.h + 2 * pad) + '" rx="18" fill="#6FA85C" stroke="' + OL + '" stroke-width="3"/>' +
      '<rect x="' + (g.x - pad + 5) + '" y="' + (g.y - pad + 4) + '" width="' + (g.w + 2 * pad - 10) + '" height="' + (g.h + 2 * pad - 10) + '" rx="14" fill="#8CC877"/>' +
      '<rect x="' + g.x + '" y="' + g.y + '" width="' + g.w + '" height="' + g.h + '" fill="#9AD384"/>';
    let d = '';
    for (let c = 1; c < g.cols; c++) d += 'M' + (g.x + c * g.cell) + ' ' + g.y + 'v' + g.h;
    for (let r = 1; r < g.rows; r++) d += 'M' + g.x + ' ' + (g.y + r * g.cell) + 'h' + g.w;
    s += '<path d="' + d + '" stroke="#6FA85C" stroke-width="2" opacity=".75" fill="none"/>';
    if (g.cell >= 44) {
      const r = rng(g.rows * 31 + g.cols);
      for (let i = 0; i < g.rows * g.cols * 0.5; i++) { const c = Math.floor(r() * g.cols), rr = Math.floor(r() * g.rows); s += tuft(g.x + (c + 0.2 + r() * 0.6) * g.cell, g.y + (rr + 0.4 + r() * 0.5) * g.cell, g.cell / 70, '#78B866'); }
    }
    GS.markup(layer, s);
  }
  /** One hoed rectangle (in cell units r0,c0,rows,cols) with furrows and holes. */
  function regionMarkup(g, r0, c0, rows, cols, o) {
    o = o || {};
    if (rows <= 0 || cols <= 0) return '';
    const k = g.cell, x = g.x + c0 * k, y = g.y + r0 * k, w = cols * k, h = rows * k, rx = Math.min(18, k * 0.2), sh = Math.max(4, k * 0.07);
    let s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + n1(rx) + '" fill="' + SOIL[2] + '"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + n1(w - sh) + '" height="' + n1(h - sh) + '" rx="' + n1(rx) + '" fill="' + (o.fill || SOIL[0]) + '"/>' +
      '<rect x="' + n1(x + 10) + '" y="' + n1(y + 7) + '" width="' + n1(Math.min(w * 0.4, 160)) + '" height="5" rx="2.5" fill="' + SOIL[1] + '" opacity=".8"/>';
    if (o.tint) s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + n1(rx) + '" fill="' + o.tint + '" opacity=".16"/>';
    if (!o.hideGrid) {
      let d = '', d2 = '';
      for (let r = 1; r < rows; r++) d += 'M' + n1(x + 4) + ' ' + (y + r * k) + 'h' + n1(w - 8);
      for (let c = 1; c < cols; c++) d2 += 'M' + (x + c * k) + ' ' + n1(y + 4) + 'v' + n1(h - 8);
      s += '<path d="' + d + '" stroke="#6E4224" stroke-width="' + n1(Math.max(2, k * 0.045)) + '" opacity=".55" fill="none"/><path d="' + d2 + '" stroke="#7E4E2C" stroke-width="1.6" opacity=".35" fill="none"/>';
      if (!o.noHoles) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) s += '<use href="#bb-hole" transform="translate(' + n1(x + (c + 0.5) * k) + ' ' + n1(y + (r + 0.5) * k + k * 0.12) + ') scale(' + n1(k) / 100 + ')"/>';
    }
    s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + n1(rx) + '" fill="none" stroke="' + OL + '" stroke-width="3"/>';
    return s;
  }
  /** Single soil mound for a scattered hole (place/basket kinds), centred on the cell. */
  function moundMarkup(g, r, c) {
    const k = g.cell, m = k * 0.07, w = k - 2 * m, x = g.x + c * k + m, y = g.y + r * k + m, rx = k * 0.2;
    return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(w) + '" rx="' + n1(rx) + '" fill="' + SOIL[2] + '"/>' +
      '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w - k * 0.06) + '" height="' + n1(w - k * 0.07) + '" rx="' + n1(rx) + '" fill="' + SOIL[0] + '"/>' +
      '<rect x="' + n1(x + k * 0.12) + '" y="' + n1(y + k * 0.08) + '" width="' + n1(w * 0.35) + '" height="' + n1(k * 0.05) + '" rx="' + n1(k * 0.025) + '" fill="' + SOIL[1] + '"/>' +
      '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(w) + '" rx="' + n1(rx) + '" fill="none" stroke="' + OL + '" stroke-width="3"/>' +
      '<use href="#bb-hole" transform="translate(' + n1(cxOf(g, c)) + ' ' + n1(cyOf(g, r) + k * 0.12) + ') scale(' + n1(k) / 100 + ')"/>';
  }
  /** Side lengths in petak: numbers along the top and the left edge (k2 and up). */
  function dimsMarkup(g, r0, c0, rows, cols, o) {
    o = o || {};
    if (TK || TIER === 'k1') return '';
    const k = g.cell, x = g.x + c0 * k, y = g.y + r0 * k;
    let s = '';
    if (!o.noTop) s += chip(x + cols * k / 2, y - 30, String(cols));
    if (!o.noLeft) s += chip(x - 36, y + rows * k / 2, String(rows));
    return s;
  }
  function chip(x, y, t, o) {
    o = o || {};
    const fs = o.fs || 40, w = Math.max(54, t.length * fs * 0.56 + 22);
    return '<rect x="' + n1(x - w / 2) + '" y="' + n1(y - fs * 0.62) + '" width="' + n1(w) + '" height="' + n1(fs * 1.24) + '" rx="' + n1(fs * 0.4) + '" fill="' + (o.bg || CREAM) + '" stroke="' + (o.stroke || OL) + '" stroke-width="2.6"/>' + Tc(x, y, t, fs, { fill: o.fill });
  }
  function ticksMarkup(x, y, w, h, k) {
    let d = '';
    for (let i = 0; i <= Math.round(w / k); i++) d += 'M' + n1(x + i * k) + ' ' + (y - 8) + 'v10M' + n1(x + i * k) + ' ' + (y + h - 2) + 'v10';
    for (let i = 0; i <= Math.round(h / k); i++) d += 'M' + (x - 8) + ' ' + n1(y + i * k) + 'h10M' + (x + w - 2) + ' ' + n1(y + i * k) + 'h10';
    return '<path d="' + d + '" stroke="' + OL + '" stroke-width="3" stroke-linecap="round" fill="none"/>';
  }

  /* ================= board, order card, notes, farmer ================= */
  function setBoard(lines, done) {
    const g = layers.board;
    g.innerHTML = '';
    if (TK || !lines || !lines.length) return;
    const fs = lines.length > 1 ? 44 : 52;
    const w = Math.max(240, Math.max.apply(null, lines.map(l => l.length)) * fs * 0.56 + 70);
    const h = lines.length > 1 ? 126 : 86, x = BOARD_X - w / 2, y = 14;
    let s = '<path d="M' + n1(x + 46) + ' -20V' + y + 'M' + n1(x + w - 46) + ' -20V' + y + '" stroke="#8A5A36" stroke-width="5"/>' +
      '<rect x="' + n1(x) + '" y="' + y + '" width="' + n1(w) + '" height="' + h + '" rx="18" fill="#A8673A" stroke="' + OL + '" stroke-width="3.5"/>' +
      '<rect x="' + n1(x + 9) + '" y="' + (y + 9) + '" width="' + n1(w - 18) + '" height="' + (h - 18) + '" rx="12" fill="' + CREAM + '" stroke="#7E4A27" stroke-width="2"/>';
    lines.forEach((l, i) => { s += Tc(BOARD_X, y + 9 + (h - 18) * (i + 0.5) / lines.length, l, fs, { fill: done ? '#0B6E60' : '#6B5444' }); });
    GS.markup(g, s);
    if (done) GS.fx(g, 'gs-pulse', 900);
  }
  function liveBoard() {
    if (!C || C.kind !== 'grid' || !C.live) return;
    const r = S.r, c = S.c, help = tries >= 2;
    let t = '';
    if (C.live === 'add') t = add(r, c) + (help ? ' = ' + r * c : '');
    else if (C.live === 'mul') t = r + ' × ' + c + (help ? ' = ' + r * c : '');
    else if (C.live === 'stack') t = C.stack[0] + ' × ' + C.stack[1] + ' + ' + r + ' × ' + c + (help ? ' = ' + (C.stack[0] * C.stack[1] + r * c) : '');
    setBoard([t], false);
  }
  function drawOrder(a, b) {
    const k2 = TIER === 'k2', h = k2 ? 176 : 138, x = 880, y = 146, w = 360;
    let s = '<path d="M' + (x + w / 2) + ' ' + (y - 4) + 'v12" stroke="#8A5A36" stroke-width="4"/>' +
      '<rect x="' + (x + 4) + '" y="' + (y + 6) + '" width="' + w + '" height="' + h + '" rx="16" fill="' + OL + '" opacity=".18"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="16" fill="' + CREAM + '" stroke="' + OL + '" stroke-width="3"/>' +
      '<circle cx="' + (x + w / 2) + '" cy="' + (y + 2) + '" r="7" fill="#E2453C" stroke="' + OL + '" stroke-width="2"/>' +
      Tc(x + w / 2, y + 34, 'Pesanan Pak Tani', 30, { body: true, fill: '#7E4A27' }) + Tc(x + w / 2, y + 88, a + ' × ' + b, 60);
    if (k2) s += Tc(x + w / 2, y + 142, a + ' baris, isi ' + b, 38, { body: true });
    GS.markup(layers.ui, s);
  }
  /** Notes board: arrangements / results found so far. entries: [{t, r, c, grey}] */
  function drawCatatan(entries, title, rowH) {
    let g = S.catG;
    if (!g) g = S.catG = GS.el('g', null, layers.ui);
    g.innerHTML = '';
    rowH = rowH || 62;
    const x = 872, y = 138, w = 376, h = 58 + Math.max(1, entries.length) * rowH;
    let s = '<rect x="' + (x + 4) + '" y="' + (y + 6) + '" width="' + w + '" height="' + h + '" rx="16" fill="' + OL + '" opacity=".18"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="16" fill="#A8673A" stroke="' + OL + '" stroke-width="3"/>' +
      '<rect x="' + (x + 8) + '" y="' + (y + 8) + '" width="' + (w - 16) + '" height="' + (h - 16) + '" rx="11" fill="' + CREAM + '"/>' +
      Tc(x + w / 2, y + 34, title || 'Catatan', /\d/.test(title || '') ? 38 : 32, { body: true, fill: '#7E4A27' });
    entries.forEach((e, i) => {
      const yy = y + 58 + i * rowH + rowH / 2;
      if (e.r) {
        const m = Math.min(40 / Math.max(e.r, e.c), 9), mw = e.c * m, mh = e.r * m;
        s += '<rect x="' + n1(x + 46 - mw / 2) + '" y="' + n1(yy - mh / 2) + '" width="' + n1(mw) + '" height="' + n1(mh) + '" fill="' + (e.grey ? '#CFC6B8' : SOIL[0]) + '" stroke="' + OL + '" stroke-width="2"/>';
        let d = '';
        for (let c = 1; c < e.c; c++) d += 'M' + n1(x + 46 - mw / 2 + c * m) + ' ' + n1(yy - mh / 2) + 'v' + n1(mh);
        for (let r = 1; r < e.r; r++) d += 'M' + n1(x + 46 - mw / 2) + ' ' + n1(yy - mh / 2 + r * m) + 'h' + n1(mw);
        if (d) s += '<path d="' + d + '" stroke="' + OL + '" stroke-width="1" opacity=".5"/>';
      }
      s += Tc(x + 86, yy, e.t, e.fs || 40, { anchor: 'start', fill: e.grey ? '#8A7A6A' : INK });
      if (e.note) s += Tc(x + w - 18, yy, e.note, 30, { anchor: 'end', body: true, fill: '#8A7A6A' });
    });
    GS.markup(g, s);
  }
  function drawFarmer(x, y, s) {
    if (!hasArt('person')) return;
    const g = GS.el('g', { transform: 'translate(' + x + ' ' + y + ') scale(' + (s || 2) + ')' }, layers.ui);
    const inner = GS.el('g', { class: 'bb-breathe' }, g);
    try { GS.markup(inner, GS.art.person(5)); } catch (e) { g.remove(); }
  }

  /* ================= stores: tray, bundles, basket, polybag, holes ================= */
  function storeTray(x, y, w, h, n, item) {
    const s = { type: 'tray', x, y, w, h, n, item: item || 'seed' };
    s.g = GS.el('g', { transform: 'translate(' + x + ' ' + y + ')' }, layers.ui);
    s.art = GS.el('g', null, s.g);
    GS.el('rect', { x: 0, y: 0, width: w, height: h, fill: 'transparent', class: 'bb-hit' }, s.g);
    s.zone = { x0: x - 20, y0: y - 30, x1: x + w + 20, y1: y + h + 20 };
    s.at = () => ({ x: x + w / 2, y: y + h * 0.48 });
    s.canTake = () => s.n > 0;
    s.take = () => { if (s.n <= 0) return null; s.n--; return { v: 1, kind: s.item, origin: s }; };
    s.put = () => { s.n++; };
    s.accepts = () => true;
    s.render = () => {
      let m = '';
      if (s.item === 'pole') {
        m += '<ellipse cx="' + w / 2 + '" cy="' + (h - 14) + '" rx="' + (w / 2 - 6) + '" ry="16" fill="' + OL + '" opacity=".16"/>' +
          '<rect x="8" y="' + (h - 44) + '" width="' + (w - 16) + '" height="30" rx="10" fill="#E3C27F" stroke="' + OL + '" stroke-width="2.6"/>';
        const shown = Math.min(s.n, 9);
        const rowsP = [4, 3, 2];
        let k = 0;
        for (let ri2 = 0; ri2 < 3 && k < shown; ri2++) for (let j = 0; j < rowsP[ri2] && k < shown; j++, k++) {
          m += '<g transform="translate(' + n1(w / 2 + (j - (rowsP[ri2] - 1) / 2) * 6) + ' ' + (h - 52 - ri2 * 15 - j * 0) + ')">' + poleArt(w - 60) + '</g>';
        }
      } else {
        m += '<ellipse cx="' + w / 2 + '" cy="' + (h - 4) + '" rx="' + (w / 2 - 8) + '" ry="12" fill="' + OL + '" opacity=".18"/>' +
          '<rect x="10" y="' + n1(h * 0.3) + '" width="' + (w - 20) + '" height="' + n1(h * 0.36) + '" rx="12" fill="#6E4426" stroke="' + OL + '" stroke-width="2.6"/>';
        const shown = Math.min(s.n, 10), per = 5, sp = (w - 40) / per;
        for (let i = 0; i < shown; i++) {
          const back = i < per, j = back ? i : i - per;
          m += '<g transform="translate(' + n1(20 + (j + 0.5) * sp + (back ? -sp * 0.12 : sp * 0.12)) + ' ' + n1(h * (back ? 0.43 : 0.64)) + ') scale(' + (back ? 0.88 : 1) + ')"><g class="bb-sway d' + (i % 4) + '"><use href="#bb-seed"/></g></g>';
        }
        m += '<rect x="0" y="' + n1(h * 0.62) + '" width="' + w + '" height="' + n1(h * 0.38) + '" rx="14" fill="#A8673A" stroke="' + OL + '" stroke-width="3"/>' +
          '<path d="M12 ' + n1(h * 0.82) + 'H' + (w - 12) + '" stroke="#7E4A27" stroke-width="2.4" opacity=".7"/>' +
          '<rect x="14" y="' + n1(h * 0.67) + '" width="' + n1(w * 0.3) + '" height="6" rx="3" fill="#C68654"/>';
      }
      s.art.innerHTML = m;
    };
    s.render();
    attach(s);
    return s;
  }
  function storeBundles(x, y, w, h, n, size, item) {
    const s = { type: 'bundle', x, y, w, h, n, size, item: item === 'pole' ? 'polebundle' : 'bundle' };
    S.bundleSize = size;
    s.g = GS.el('g', { transform: 'translate(' + x + ' ' + y + ')' }, layers.ui);
    s.art = GS.el('g', null, s.g);
    GS.el('rect', { x: 0, y: 0, width: w, height: h, fill: 'transparent', class: 'bb-hit' }, s.g);
    s.zone = { x0: x - 20, y0: y - 30, x1: x + w + 20, y1: y + h + 20 };
    s.at = () => ({ x: x + w / 2, y: y + h * 0.55 });
    s.canTake = () => s.n > 0;
    s.take = () => { if (s.n <= 0) return null; s.n--; return { v: size, kind: s.item, origin: s }; };
    s.put = () => { s.n++; };
    s.accepts = () => true;
    s.render = () => {
      let m = '<ellipse cx="' + w / 2 + '" cy="' + (h - 4) + '" rx="' + (w / 2 - 6) + '" ry="12" fill="' + OL + '" opacity=".18"/>' +
        '<rect x="4" y="' + n1(h * 0.62) + '" width="' + (w - 8) + '" height="' + n1(h * 0.36) + '" rx="12" fill="#C99A5B" stroke="' + OL + '" stroke-width="3"/>' +
        '<path d="M14 ' + n1(h * 0.74) + 'H' + (w - 14) + 'M14 ' + n1(h * 0.86) + 'H' + (w - 14) + '" stroke="#9A6E36" stroke-width="2.4" opacity=".7"/>';
      const shown = Math.min(s.n, 3);
      for (let i = 0; i < shown; i++) m += '<g transform="translate(' + n1(w / 2 + (i - (shown - 1) / 2) * Math.min(56, (w - 70) / 2)) + ' ' + n1(h * 0.66 - (i % 2) * 6) + ')">' + bundleArt(size, item, false) + '</g>';
      if (s.n > 3) m += Tc(w - 26, 24, '+' + (s.n - 3), 30, { decor: true, fill: '#7E4A27' });
      s.art.innerHTML = m;
    };
    s.render();
    attach(s);
    return s;
  }
  function storeBasket(x, y, o) {
    o = o || {};
    const cart = o.item === 'pole';
    const s = { type: 'basket', x, y, w: o.w || 250, h: o.h || 112, items: o.items || [], out: 0, wilt: false, fixed: !!o.fixed, item: o.item || 'seed', color: o.color };
    s.g = GS.el('g', { transform: 'translate(' + x + ' ' + y + ')' }, layers.ui);
    s.art = GS.el('g', null, s.g);
    GS.el('rect', { x: -s.w / 2 - 10, y: -s.h - 70, width: s.w + 20, height: s.h + 80, fill: 'transparent', class: 'bb-hit' }, s.g);
    s.zone = { x0: x - s.w / 2 - 40, y0: y - s.h - 120, x1: x + s.w / 2 + 40, y1: y + 30 };
    s.total = () => s.items.reduce((a, it) => a + it.v, 0);
    s.shown = () => s.total() - s.out;
    s.at = () => ({ x, y: y - s.h - 6 });
    s.canTake = () => !s.fixed && s.items.length > 0;
    s.take = () => { if (!s.canTake()) return null; return s.items.pop(); };
    s.put = it => { s.items.push(it); };
    s.accepts = () => true;
    s.render = () => {
      const w = s.w, h = s.h, n = s.shown();
      let m = '<ellipse cx="0" cy="4" rx="' + (w * 0.46) + '" ry="12" fill="' + OL + '" opacity=".18"/>';
      if (cart) {
        // gerobak: wheels, bed, poles lying on it
        m += '<path d="M' + (w * 0.5) + ' ' + (-h * 0.5) + 'L' + (w * 0.66) + ' ' + (-h * 0.62) + '" stroke="' + OL + '" stroke-width="10" stroke-linecap="round"/><path d="M' + (w * 0.5) + ' ' + (-h * 0.5) + 'L' + (w * 0.66) + ' ' + (-h * 0.62) + '" stroke="#C68654" stroke-width="5" stroke-linecap="round"/>';
        const shown = Math.min(n, 10);
        for (let i = 0; i < shown; i++) m += '<g transform="translate(' + ((i % 2) * 8 - 4) + ' ' + n1(-h * 0.62 - i * 9) + ')">' + poleArt(w * 0.86) + '</g>';
        m += '<rect x="' + (-w / 2) + '" y="' + n1(-h * 0.66) + '" width="' + w + '" height="' + n1(h * 0.42) + '" rx="10" fill="#A8673A" stroke="' + OL + '" stroke-width="3"/>' +
          '<path d="M' + (-w / 2 + 12) + ' ' + n1(-h * 0.45) + 'H' + (w / 2 - 12) + '" stroke="#7E4A27" stroke-width="2.4" opacity=".7"/>';
        [-w * 0.3, w * 0.3].forEach(wx => { m += '<circle cx="' + n1(wx) + '" cy="' + n1(-h * 0.2) + '" r="' + n1(h * 0.2) + '" fill="#5A4636" stroke="' + OL + '" stroke-width="3"/><circle cx="' + n1(wx) + '" cy="' + n1(-h * 0.2) + '" r="' + n1(h * 0.07) + '" fill="#C68654" stroke="' + OL + '" stroke-width="2"/>'; });
      } else {
        const ry = h * 0.2, top = -h;
        m += '<ellipse cx="0" cy="' + top + '" rx="' + (w / 2) + '" ry="' + n1(ry) + '" fill="#6E4A24" stroke="' + OL + '" stroke-width="3"/>';
        // contents: bundles first (as loaded), then singles; wilted after a failed planting
        const bundles = s.out ? 0 : s.items.filter(it => it.v > 1).length;
        const singles = s.out ? n : n - s.items.filter(it => it.v > 1).reduce((a, it) => a + it.v, 0);
        const slots = [];
        const nb = Math.min(bundles, 5), ns = Math.min(singles, 14 - nb * 2);
        for (let i = 0; i < nb; i++) slots.push({ b: true, x: (i - (nb - 1) / 2) * 34 - (ns ? w * 0.14 : 0), y: top + 8 });
        const x0 = nb ? w * 0.0 : -w * 0.36, span = nb ? w * 0.36 : w * 0.72;
        for (let i = 0; i < ns; i++) slots.push({ x: x0 + (ns > 1 ? i / (ns - 1) : 0.5) * span, y: top + (i % 2 ? 10 : 0) });
        slots.sort((a, b) => a.y - b.y).forEach(p => {
          m += p.b ? '<g transform="translate(' + n1(p.x) + ' ' + n1(p.y + 18) + ') scale(.8)">' + bundleArt(S.bundleSize || 10, 'seed', true) + '</g>'
            : '<use href="#bb-' + (s.wilt ? 'wilt' : 'seedns') + '" transform="translate(' + n1(p.x) + ' ' + n1(p.y + (s.wilt ? -12 : 6)) + ') scale(' + (s.wilt ? 1.1 : 0.9) + ')"/>';
        });
        const body = 'M' + (-w / 2) + ' ' + top + 'Q0 ' + n1(top + 2 * ry) + ' ' + (w / 2) + ' ' + top + 'L' + n1(w * 0.4) + ' -8Q0 8 ' + n1(-w * 0.4) + ' -8Z';
        m += '<path d="' + body + '" fill="#C99A5B"/>' +
          '<path d="M' + n1(w * 0.16) + ' ' + n1(top + ry * 1.7) + 'Q' + n1(w * 0.42) + ' ' + n1(top + ry) + ' ' + (w / 2) + ' ' + top + 'L' + n1(w * 0.4) + ' -8Q' + n1(w * 0.2) + ' 2 ' + n1(w * 0.04) + ' 3Z" fill="#9A6E36" opacity=".5"/>';
        let d = '';
        [0.32, 0.56, 0.8].forEach(t => { const yy = top + ry + t * (h - ry - 6), hw = w / 2 - w * 0.1 * t; d += 'M' + n1(-hw) + ' ' + n1(yy - ry * 0.5) + 'Q0 ' + n1(yy + ry * 0.6) + ' ' + n1(hw) + ' ' + n1(yy - ry * 0.5); });
        for (let i = -4; i <= 4; i++) d += 'M' + n1(i * w / 10) + ' ' + n1(top + ry * 1.8) + 'L' + n1(i * w * 0.08) + ' -4';
        m += '<path d="' + d + '" stroke="#8E6532" stroke-width="2.2" opacity=".55" fill="none"/>';
        m += '<path d="' + body + '" fill="none" stroke="' + OL + '" stroke-width="3" stroke-linejoin="round"/>';
        const rim = 'M' + (-w / 2) + ' ' + top + 'Q0 ' + n1(top + 2 * ry) + ' ' + (w / 2) + ' ' + top;
        m += '<path d="' + rim + '" stroke="' + OL + '" stroke-width="15" fill="none" stroke-linecap="round"/><path d="' + rim + '" stroke="#E3BD86" stroke-width="9" fill="none" stroke-linecap="round"/>';
        if (s.color) m += '<path d="M' + n1(-w * 0.44) + ' -16Q0 -2 ' + n1(w * 0.44) + ' -16" stroke="' + OL + '" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M' + n1(-w * 0.44) + ' -16Q0 -2 ' + n1(w * 0.44) + ' -16" stroke="' + s.color + '" stroke-width="8" fill="none" stroke-linecap="round"/>';
      }
      // tag: dots for TK (no reading), number otherwise
      if (TK) {
        if (n > 0) {
          const cols = Math.min(n, 5), rows = Math.ceil(n / 5), tw = cols * 24 + 20, th = rows * 24 + 16, ty = -h * 0.52;
          m += '<rect x="' + n1(-tw / 2) + '" y="' + n1(ty - th / 2) + '" width="' + tw + '" height="' + th + '" rx="12" fill="' + CREAM + '" stroke="' + OL + '" stroke-width="2.6"/>';
          for (let i = 0; i < n; i++) m += '<circle cx="' + n1(-tw / 2 + 22 + (i % 5) * 24) + '" cy="' + n1(ty - th / 2 + 20 + Math.floor(i / 5) * 24) + '" r="8.5" fill="' + (s.wilt ? '#9C7E2E' : '#357F40') + '"/>';
        }
      } else {
        const t = String(n), tw = Math.max(84, t.length * 32 + 34), ty = cart ? -h * 0.45 : -h * 0.5;
        m += '<rect x="' + n1(-tw / 2) + '" y="' + n1(ty - 34) + '" width="' + n1(tw) + '" height="68" rx="14" fill="' + (s.wilt ? '#F3E3B5' : CREAM) + '" stroke="' + OL + '" stroke-width="3"/>' + Tc(0, ty, t, 52, { fill: s.wilt ? '#8A6A2A' : INK });
      }
      s.art.innerHTML = m;
    };
    s.render();
    if (!s.fixed || o.drag) attach(s);
    return s;
  }
  function storePoly(x, y, cap) {
    const s = { type: 'poly', x, y, cap, n: 0 };
    const sp = cap > 4 ? 74 : 88, w = cap * sp + 30, h = 150;
    s.g = GS.el('g', { transform: 'translate(' + x + ' ' + y + ')' }, layers.ui);
    s.art = GS.el('g', null, s.g);
    GS.el('rect', { x: 0, y: 0, width: w, height: h, fill: 'transparent', class: 'bb-hit' }, s.g);
    s.zone = { x0: x - 20, y0: y - 40, x1: x + w + 20, y1: y + h + 20 };
    s.slot = i => ({ x: x + 15 + (i + 0.5) * sp, y: y + h - 52 });
    s.at = () => s.slot(Math.min(s.n, cap - 1));
    s.canTake = () => s.n > 0;
    s.take = () => { if (s.n <= 0) return null; s.n--; return { v: 1, kind: 'seed', origin: S.basket }; };
    s.put = () => { s.n = Math.min(cap, s.n + 1); };
    s.accepts = () => s.n < cap;
    s.render = () => {
      let m = '<rect x="2" y="' + (h - 30) + '" width="' + (w - 4) + '" height="24" rx="8" fill="#A8673A" stroke="' + OL + '" stroke-width="3"/>' +
        Tc(w / 2, 18, 'polybag', 30, { body: true, fill: '#7E4A27' });
      for (let i = 0; i < cap; i++) {
        const px = 15 + (i + 0.5) * sp, py = h - 30;
        if (i < s.n) m += '<use href="#bb-seedns" transform="translate(' + px + ' ' + (py - 50) + ') scale(.95)"/>';
        m += '<path d="M' + (px - 30) + ' ' + (py - 54) + 'L' + (px - 25) + ' ' + py + 'H' + (px + 25) + 'L' + (px + 30) + ' ' + (py - 54) + 'Z" fill="#2E2A30" stroke="' + OL + '" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M' + (px - 18) + ' ' + (py - 46) + 'L' + (px - 16) + ' ' + (py - 10) + '" stroke="#5A5560" stroke-width="4" stroke-linecap="round"/>' +
          '<ellipse cx="' + px + '" cy="' + (py - 54) + '" rx="30" ry="7" fill="#5E3B22" stroke="' + OL + '" stroke-width="2.4"/>';
      }
      s.art.innerHTML = m;
    };
    s.render();
    if (S.mode === 'poly') attach(s);
    return s;
  }
  function storeHole(g, r, c, pre) {
    const s = { type: 'hole', r, c, filled: !!pre, pre: !!pre };
    s.el = s.g = GS.el('g', null, layers.handles);
    const k = g.cell;
    GS.el('rect', { x: g.x + c * k + 2, y: g.y + r * k + 2, width: k - 4, height: k - 4, fill: 'transparent', class: 'bb-hit', 'data-hit': 'hole' }, s.el);
    s.zone = { x0: g.x + c * k - k * 0.12, y0: g.y + r * k - k * 0.12, x1: g.x + (c + 1) * k + k * 0.12, y1: g.y + (r + 1) * k + k * 0.12 };
    s.at = () => baseOf(g, r, c);
    s.canTake = () => s.filled && !s.pre;
    s.take = () => { if (!s.canTake()) return null; s.filled = false; return { v: 1, kind: 'seed', origin: S.tray }; };
    s.put = () => { s.filled = true; };
    s.accepts = () => !s.filled;
    s.render = pop => plantAt(g, r, c, s.filled ? 'seed' : null, pop);
    s.render();
    if (!pre) attach(s); else s.el.querySelector('rect').removeAttribute('data-hit');
    return s;
  }

  /* ---- drag and tap between stores ---- */
  function attach(s) {
    let start = null, fl = null;
    GS.drag(s.g || s.el, {
      svg,
      onStart(p) { if (busy) return false; start = p; fl = null; return true; },
      onMove(p) {
        if (busy || !start) return;
        if (!fl && Math.hypot(p.x - start.x, p.y - start.y) > 12) {
          if (s.canTake()) fl = lift(s, p); else start = { x: 1e9, y: 1e9 };
        }
        if (fl) fl.el.setAttribute('transform', 'translate(' + n1(p.x) + ' ' + n1(p.y - LIFT) + ') scale(1.15)');
      },
      onEnd(p) {
        if (fl) { const f = fl; fl = null; drop(f, p); return; }
        if (!busy && start && Math.hypot(p.x - start.x, p.y - start.y) <= 12) tap(s);
        start = null;
      }
    });
  }
  function lift(s, p) {
    const it = s.take();
    s.render(true);
    const el = GS.el('g', { transform: 'translate(' + n1(p.x) + ' ' + n1(p.y - LIFT) + ')' }, layers.drag);
    GS.markup(el, itemArt(it.kind));
    GS.sfx.pick();
    return { it, el, src: s };
  }
  const inZ = (z, p) => z && p.x >= z.x0 && p.x <= z.x1 && p.y >= z.y0 && p.y <= z.y1;
  function findDest(src, p, it) {
    const q = { x: p.x, y: p.y - LIFT * 0.6 };
    if (S.mode === 'place') {
      const h = S.holes.find(h => !h.pre && inZ(h.zone, q) && !h.filled);
      if (h) return h;
      return src.type === 'hole' ? S.tray : null;
    }
    if (S.mode === 'basket') {
      if (src.type !== 'basket') return inZ(S.basket.zone, q) ? S.basket : null;
      return inZ(S.basket.zone, q) ? null : it.origin;
    }
    if (S.mode === 'poly') {
      if (src.type === 'basket') return inZ(S.poly.zone, q) && S.poly.accepts() ? S.poly : null;
      if (src.type === 'poly') return inZ(S.basket.zone, q) ? S.basket : null;
    }
    return null;
  }
  async function drop(f, p) {
    const my = tok;
    const dest = findDest(f.src, p, f.it) || f.src;
    const target = dest.accepts(f.it) ? dest : f.src;
    target.put(f.it);
    const a = { x: p.x, y: p.y - LIFT }, b = target.at();
    await tween(150, e => f.el.setAttribute('transform', 'translate(' + n1(a.x + (b.x - a.x) * e) + ' ' + n1(a.y + (b.y - a.y) * e) + ') scale(' + (1.15 - 0.15 * e).toFixed(3) + ')'));
    f.el.remove();
    if (my !== tok) return;
    target.render(true);
    if (target !== f.src) { GS.sfx.drop(); squash(target); } else GS.sfx.tick();
    afterChange();
  }
  function tap(s) {
    let src = s, dest = null;
    if (S.mode === 'place') {
      if (s.type === 'tray') dest = S.holes.find(h => !h.filled);
      else if (s.type === 'hole') { if (!s.filled) { src = S.tray; dest = s; } else if (!s.pre) dest = S.tray; }
    } else if (S.mode === 'basket') {
      if (s.type === 'basket') { const it = s.items[s.items.length - 1]; dest = it ? it.origin : null; }
      else dest = S.basket;
    } else if (S.mode === 'poly') {
      if (s.type === 'basket' && S.poly.accepts()) dest = S.poly;
      else if (s.type === 'poly') dest = S.basket;
    }
    if (!dest || !src.canTake()) { GS.sfx.oops(); GS.fx(s.g || s.el, 'gs-wobble', 420); return; }
    moveFly(src, dest);
  }
  /** Move one item: the logic changes now (so quick taps never double-book a hole), the picture follows. */
  async function moveFly(src, dest) {
    const my = tok;
    const it = src.take();
    if (!it) return;
    dest.put(it);
    src.render(true);
    GS.sfx.pick();
    await flyArt(it.kind, src.at(), dest.at(), 260);
    if (my !== tok) return;
    dest.render(true);
    GS.sfx.drop();
    squash(dest);
    afterChange();
  }
  function moveNow(src, dest) { const it = src.take(); if (!it) return false; dest.put(it); src.render(); dest.render(); return true; }
  function squash(st) {
    const el = st.art || null;
    if (!el || GS.reducedMotion) return;
    const base = st.type === 'basket' ? { x: 0, y: 0 } : { x: (st.w || 0) / 2, y: st.h || 0 };
    tween(300, e => {
      const k = Math.sin(e * Math.PI) * (1 - e);
      el.setAttribute('transform', 'translate(' + n1(base.x) + ' ' + n1(base.y) + ') scale(' + (1 + 0.1 * k).toFixed(3) + ' ' + (1 - 0.12 * k).toFixed(3) + ') translate(' + n1(-base.x) + ' ' + n1(-base.y) + ')');
    }).then(() => el.removeAttribute('transform'));
  }
  function afterChange() {
    updateDock();
    if (S.mode === 'place' && C.auto && !busy && S.holes.every(h => h.filled)) placeDone();
  }

  /* ================= kind: place (tk, k1) ================= */
  function buildPlace() {
    S.mode = 'place';
    const g = S.g = geom(C.rows, C.cols, { x0: 90, y0: 210, x1: 800, y1: 740 }, TK ? 160 : 130);
    g.id = 'f';
    const preKeys = new Set((C.pre || []).map(p => p.join(',')));
    let soil = '';
    C.cells.forEach(([r, c]) => { soil += moundMarkup(g, r, c); });
    GS.markup(layers.soil, soil);
    S.holes = C.cells.map(([r, c]) => storeHole(g, r, c, preKeys.has(r + ',' + c)));
    if (C.check === 'pairs') {
      // row flags: blue with dots (top) and orange with stripes (bottom), so the rows differ by more than colour
      GS.markup(layers.labels, rowFlag(g.x - 46, cyOf(g, 0), '#2F80C9', 'dots') + rowFlag(g.x - 46, cyOf(g, 1), '#F28C28', 'stripes'));
    }
    S.tray = storeTray(860, 246, 390, 220, C.tray);
    drawFarmer(1205, 612, 1.8);
    if (C.check === 'pairs') setDock('Cek!', onPairs);
  }
  function rowFlag(x, y, col, pat) {
    let s = '<path d="M' + x + ' ' + (y + 34) + 'V' + (y - 36) + '" stroke="' + OL + '" stroke-width="7" stroke-linecap="round"/><path d="M' + x + ' ' + (y + 34) + 'V' + (y - 36) + '" stroke="#C68654" stroke-width="3.5" stroke-linecap="round"/>' +
      '<path d="M' + (x + 2) + ' ' + (y - 34) + 'L' + (x + 36) + ' ' + (y - 22) + 'L' + (x + 2) + ' ' + (y - 8) + 'Z" fill="' + col + '" stroke="' + OL + '" stroke-width="2.6" stroke-linejoin="round"/>';
    if (pat === 'dots') s += '<circle cx="' + (x + 11) + '" cy="' + (y - 22) + '" r="3" fill="#fff"/><circle cx="' + (x + 21) + '" cy="' + (y - 22) + '" r="2.6" fill="#fff"/>';
    else s += '<path d="M' + (x + 9) + ' ' + (y - 30) + 'v16M' + (x + 18) + ' ' + (y - 27) + 'v10" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>';
    return s;
  }
  async function placeDone() {
    const my = tok;
    busy = true; updateDock();
    await wait(300);
    if (my !== tok) return;
    await success(rowsOf(S.holes.map(h => ({ g: S.g, r: h.r, c: h.c }))), {});
  }
  async function onPairs() {
    if (busy) return;
    const my = tok;
    busy = true; updateDock();
    const top = S.holes.filter(h => h.r === 0 && h.filled).sort((a, b) => a.c - b.c);
    const bot = S.holes.filter(h => h.r === 1 && h.filled).sort((a, b) => a.c - b.c);
    const g = S.g, k = g.cell;
    const n = Math.min(top.length, bot.length);
    // ropes pair the k-th seedling of each row (one-to-one correspondence)
    for (let i = 0; i < n; i++) {
      const a = top[i], b = bot[i];
      const x1 = cxOf(g, a.c), y1 = cyOf(g, 0) + k * 0.25, x2 = cxOf(g, b.c), y2 = cyOf(g, 1) - k * 0.3;
      GS.markup(layers.fx, '<path d="M' + n1(x1) + ' ' + n1(y1) + 'L' + n1(x2) + ' ' + n1(y2) + '" stroke="' + OL + '" stroke-width="8" stroke-linecap="round"/><path d="M' + n1(x1) + ' ' + n1(y1) + 'L' + n1(x2) + ' ' + n1(y2) + '" stroke="#E3C27F" stroke-width="4" stroke-dasharray="8 6" stroke-linecap="round"/>');
      GS.sfx.count(i + 1);
      await wait(200);
      if (my !== tok) return;
    }
    if (top.length === bot.length) {
      await wait(300);
      if (my !== tok) return;
      clearFx();
      await success(rowsOf(S.holes.filter(h => h.filled).map(h => ({ g, r: h.r, c: h.c }))), {});
      return;
    }
    const lonely = (top.length > bot.length ? top : bot).slice(n);
    lonely.forEach(h => { const b = baseOf(g, h.r, h.c); GS.markup(layers.fx, '<circle class="bb-glow" cx="' + n1(b.x) + '" cy="' + n1(b.y - k * 0.3) + '" r="' + n1(k * 0.42) + '" fill="none" stroke="#F2A900" stroke-width="6"/>'); });
    hud.mood('oops'); GS.sfx.oops();
    GS.say(top.length > bot.length ? (TK ? 'Ada bibit atas yang belum punya teman.' : 'Baris bawah masih kurang. Ada yang belum punya pasangan.') : (TK ? 'Ada bibit bawah yang tidak punya teman.' : 'Baris bawah kebanyakan. Ada yang tidak punya pasangan.'));
    tries++;
    await wait(2000);
    if (my !== tok) return;
    clearFx(); busy = false; updateDock(); hud.mood('think');
  }

  /* ================= kind: basket (tk, k1, k2 L4, k3 area/fence, k4 L-shape) ================= */
  function buildBasket() {
    const poly = C.basketN != null;
    S.mode = poly ? 'poly' : 'basket';
    const box = C.labels ? { x0: 140, y0: 190, x1: 800, y1: 760 } : { x0: 90, y0: 200, x1: 800, y1: 760 };
    const g = S.g = geom(C.rows, C.cols, box, TK ? 140 : C.fence ? 100 : 120);
    g.id = 'f';
    const preKeys = new Set((C.pre || []).map(p => p.join(',')));
    let soil = '';
    if (C.shape === 'rect') soil = regionMarkup(g, 0, 0, C.rows, C.cols, { hideGrid: C.hideGrid });
    else if (C.shape === 'L') soil = lMarkup(g, C.rows, C.cols, C.L.cr, C.L.cc, C.showSplit);
    else C.cells.forEach(([r, c]) => { soil += moundMarkup(g, r, c); });
    GS.markup(layers.soil, soil);
    S.holes = sortCells(C.cells).map(([r, c]) => ({ g, r, c, pre: preKeys.has(r + ',' + c), filled: preKeys.has(r + ',' + c) }));
    S.holes.forEach(h => { if (h.pre) plantAt(g, h.r, h.c, 'seed'); });
    if (C.fence) S.holes.forEach(h => plantAt(g, h.r, h.c, 'grow'));
    if (C.labels) drawShapeLabels();
    if (poly) {
      S.poly = storePoly(870, 196, C.polyCap);
      const items = []; for (let i = 0; i < C.basketN; i++) items.push({ v: 1, kind: 'seed', origin: null });
      S.basket = storeBasket(1010, 600, { items, fixed: true, drag: true });
      S.basket.canTake = () => S.basket.items.length > 0;
      S.basket.take = () => S.basket.items.pop() || null;
    } else {
      const item = C.item || 'seed';
      if (C.bundles) {
        S.tray = storeTray(860, 152, 196, 218, C.tray, item);
        S.bundles = storeBundles(1066, 152, 184, 218, C.bundles, C.bundle, item);
      } else S.tray = storeTray(860, 152, 390, 218, C.tray, item);
      S.basket = storeBasket(1010, 600, { item, w: item === 'pole' ? 260 : 250 });
    }
    if (!C.fence) drawFarmer(1205, 612, 1.8);
    else drawGoat(1215, 612, false);
    setDock(C.fence ? 'Pasang!' : 'Tanam!', C.fence ? onFenceSupply : onBasketTanam);
  }
  function lMarkup(g, Rr, Cc, cr, cc, split) {
    const k = g.cell, x = g.x, y = g.y;
    const pts = [[0, 0], [Cc - cc, 0], [Cc - cc, cr], [Cc, cr], [Cc, Rr], [0, Rr]].map(([a, b]) => n1(x + a * k) + ' ' + n1(y + b * k));
    const d = 'M' + pts.join('L') + 'Z';
    let s = '<path d="' + d + '" fill="' + SOIL[2] + '" transform="translate(4 5)"/><path d="' + d + '" fill="' + SOIL[0] + '"/>' +
      '<rect x="' + (x + 10) + '" y="' + (y + 7) + '" width="' + n1(Math.min((Cc - cc) * k * 0.5, 140)) + '" height="5" rx="2.5" fill="' + SOIL[1] + '" opacity=".8"/>';
    if (split) {
      s += '<rect x="' + n1(x + (Cc - cc) * k) + '" y="' + n1(y + cr * k) + '" width="' + n1(cc * k) + '" height="' + n1((Rr - cr) * k) + '" fill="#F28C28" opacity=".14"/>' +
        '<rect x="' + x + '" y="' + y + '" width="' + n1((Cc - cc) * k) + '" height="' + n1(Rr * k) + '" fill="#2F80C9" opacity=".12"/>' +
        '<path d="M' + n1(x + (Cc - cc) * k) + ' ' + n1(y + cr * k) + 'V' + n1(y + Rr * k) + '" stroke="' + OL + '" stroke-width="8" stroke-linecap="round"/><path d="M' + n1(x + (Cc - cc) * k) + ' ' + n1(y + cr * k) + 'V' + n1(y + Rr * k) + '" stroke="#E3C27F" stroke-width="4" stroke-dasharray="10 7" stroke-linecap="round"/>';
    }
    s += '<path d="' + d + '" fill="none" stroke="' + OL + '" stroke-width="3" stroke-linejoin="round"/>';
    return s;
  }
  function drawShapeLabels() {
    const g = S.g, k = g.cell, x = g.x, y = g.y;
    let s = '';
    if (C.shape === 'L') {
      const { cr, cc } = C.L, Rr = C.rows, Cc = C.cols;
      s += tickPath([[x, y, x + (Cc - cc) * k, y], [x, y + Rr * k, x + Cc * k, y + Rr * k], [x, y, x, y + Rr * k], [x + Cc * k, y + cr * k, x + Cc * k, y + Rr * k], [x + (Cc - cc) * k, y + cr * k, x + Cc * k, y + cr * k], [x + (Cc - cc) * k, y, x + (Cc - cc) * k, y + cr * k]], k);
      s += chip(x + (Cc - cc) * k / 2, y - 30, String(Cc - cc)) + chip(x - 36, y + Rr * k / 2, String(Rr)) + chip(x + Cc * k / 2, y + Rr * k + 32, String(Cc)) +
        chip(x + Cc * k + 36, y + (cr + Rr) * k / 2, String(Rr - cr)) + chip(x + (Cc - cc / 2) * k, y + cr * k - 30, String(cc)) + chip(x + (Cc - cc) * k + 36, y + cr * k / 2, String(cr));
    } else {
      if (C.hideGrid) s += ticksMarkup(x, y, g.w, g.h, k);
      s += chip(x + g.w / 2, y - 30, String(C.cols)) + chip(x - 36, y + g.h / 2, String(C.rows));
    }
    GS.markup(layers.labels, s);
  }
  function tickPath(segs, k) {
    let d = '';
    segs.forEach(([x1, y1, x2, y2]) => {
      const L = Math.hypot(x2 - x1, y2 - y1), n = Math.round(L / k), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
      for (let i = 0; i <= n; i++) { const px = x1 + ux * i * k, py = y1 + uy * i * k; d += 'M' + n1(px - uy * 7) + ' ' + n1(py + ux * 7) + 'L' + n1(px + uy * 7) + ' ' + n1(py - ux * 7); }
    });
    return '<path d="' + d + '" stroke="' + OL + '" stroke-width="3" stroke-linecap="round" fill="none"/>';
  }
  async function onBasketTanam() {
    if (busy) return;
    const my = tok;
    busy = true; updateDock();
    const B = S.basket, holes = S.holes.filter(h => !h.filled), N = B.total(), k = Math.min(N, holes.length);
    if (C.hideGrid) { S.gridShown = true; } // the planting shows every petak
    const ok = await plantCells(holes.slice(0, k), B);
    if (!ok || my !== tok) return;
    holes.slice(0, k).forEach(h => { h.filled = true; });
    const left = N - k, miss = holes.length - k;
    if (!left && !miss) { await success(rowsOf(S.holes), {}); return; }
    await showFail(left, miss, holes.slice(k), B);
    if (my !== tok) return;
    holes.slice(0, k).forEach(h => { h.filled = false; plantAt(h.g, h.r, h.c, null); });
    B.out = 0; B.wilt = false; B.render();
    clearFx(); tries++;
    if (tries >= 2 && C.hideGrid && !S.helped) { S.helped = true; layers.soil.innerHTML = ''; GS.markup(layers.soil, C.shape === 'L' ? lMarkup(S.g, C.rows, C.cols, C.L.cr, C.L.cc, true) + lGrid() : regionMarkup(S.g, 0, 0, C.rows, C.cols, { noHoles: true })); }
    busy = false; updateDock(); hud.mood('think');
  }
  function lGrid() {
    const g = S.g, k = g.cell;
    let d = '';
    S.holes.forEach(h => { d += 'M' + (g.x + h.c * k) + ' ' + (g.y + h.r * k) + 'h' + k + 'v' + k + 'h' + (-k) + 'Z'; });
    return '<path d="' + d + '" stroke="#6E4224" stroke-width="1.6" opacity=".45" fill="none"/>';
  }
  async function onFenceSupply() {
    if (busy) return;
    const my = tok;
    busy = true; updateDock();
    const B = S.basket, n = B.total(), g = S.g;
    const res = await buildFence(g, 0, 0, C.rows, C.cols, n, B);
    if (my !== tok) return;
    if (res.ok) { await success([], { lines: C.done(), say: 'Pagarnya pas, ' + res.P + ' batang! Kebun aman.', noHarvest: true }); return; }
    tries++;
    await wait(2200);
    if (my !== tok) return;
    layers.fx.innerHTML = '';
    if (S.goat) { S.goat.remove(); S.goat = null; }
    drawGoat(1215, 612, false);
    B.out = 0; B.render(); setBoard([]);
    busy = false; updateDock(); hud.mood('think');
  }
  /** Lay one bamboo pole per petak edge around the region, counting. poles = 2 x (rows + cols). */
  async function buildFence(g, r0, c0, rows, cols, n, B) {
    const my = tok, k = g.cell, x = g.x + c0 * k, y = g.y + r0 * k;
    const segs = [];
    for (let c = 0; c < cols; c++) segs.push([x + c * k, y, x + (c + 1) * k, y]);
    for (let r = 0; r < rows; r++) segs.push([x + cols * k, y + r * k, x + cols * k, y + (r + 1) * k]);
    for (let c = cols - 1; c >= 0; c--) segs.push([x + (c + 1) * k, y + rows * k, x + c * k, y + rows * k]);
    for (let r = rows - 1; r >= 0; r--) segs.push([x, y + (r + 1) * k, x, y + r * k]);
    const P = segs.length, m = Math.min(n, P);
    const per = Math.max(60, 160 - P * 4);
    for (let i = 0; i < m; i++) {
      const [x1, y1, x2, y2] = segs[i];
      B.out++; B.render();
      GS.markup(layers.fx, '<path d="M' + n1(x1) + ' ' + n1(y1) + 'L' + n1(x2) + ' ' + n1(y2) + '" stroke="' + OL + '" stroke-width="15" stroke-linecap="round"/><path d="M' + n1(x1) + ' ' + n1(y1) + 'L' + n1(x2) + ' ' + n1(y2) + '" stroke="#E3C27F" stroke-width="8" stroke-linecap="round"/>' +
        '<circle cx="' + n1(x1) + '" cy="' + n1(y1) + '" r="8" fill="#C99A5B" stroke="' + OL + '" stroke-width="2.6"/><circle cx="' + n1(x2) + '" cy="' + n1(y2) + '" r="8" fill="#C99A5B" stroke="' + OL + '" stroke-width="2.6"/>');
      GS.sfx.tick();
      if (!TK) setBoard([String(i + 1) + ' batang'], false);
      await wait(per);
      if (my !== tok) return { ok: false };
    }
    if (n === P) { GS.sfx.coin(); return { ok: true, P }; }
    hud.mood('oops'); GS.sfx.oops();
    if (n > P) {
      GS.say('Pagarnya sudah keliling, tapi sisa ' + (n - P) + ' batang.');
      return { ok: false, P };
    }
    const [x1, y1, x2, y2] = segs[m];
    GS.markup(layers.fx, '<circle class="bb-glow" cx="' + n1((x1 + x2) / 2) + '" cy="' + n1((y1 + y2) / 2) + '" r="' + n1(k * 0.45) + '" fill="none" stroke="#F2A900" stroke-width="7"/>');
    GS.say('Bambunya kurang ' + (P - n) + ' batang. Kambing masuk!');
    await goatTo((x1 + x2) / 2, (y1 + y2) / 2);
    return { ok: false, P };
  }
  function drawGoat(x, y, flip) {
    if (!hasArt('item')) return null;
    const g = GS.el('g', { transform: 'translate(' + x + ' ' + y + ') scale(' + (flip ? -1.9 : 1.9) + ' 1.9)' }, layers.ui);
    try { GS.markup(g, GS.art.item('kambing')); } catch (e) { /* art missing */ }
    S.goat = g;
    return g;
  }
  async function goatTo(x, y) {
    if (!S.goat) return;
    const g = S.goat, x0 = 1215, y0 = 612;
    GS.sfx.boing();
    await tween(900, e => g.setAttribute('transform', 'translate(' + n1(x0 + (x - x0) * e) + ' ' + n1(y0 + (y + 30 - y0) * e - Math.abs(Math.sin(e * Math.PI * 4)) * 14) + ') scale(-1.9 1.9)'), 'linear');
  }

  /* ================= kind: grid (corner handle) ================= */
  function buildGrid() {
    S.mode = 'grid';
    const prime = !!C.prime;
    const box = { x0: 140, y0: prime ? 300 : 200, x1: 800, y1: 768 };
    const g = S.g = geom(C.maxR, C.maxC, box, C.maxCell || 110);
    g.id = 'f';
    drawLahan(layers.lahan, g);
    S.r = C.start[0]; S.c = C.start[1];
    if (C.lockR) S.r = C.lockR;
    if (C.lockC) S.c = C.lockC;
    if (C.stack) S.r = 1;
    // right column
    if (C.fence) {
      S.basket = storeBasket(1010, 600, { item: 'pole', fixed: true, items: [{ v: C.fence, kind: 'pole' }], w: 240 });
      LS.found = LS.found || [];
      drawFenceNotes();
    } else {
      S.basket = storeBasket(1010, 600, { fixed: true, items: [{ v: C.N, kind: 'seed' }], w: (C.arr || C.prime || C.poly) ? 230 : 250, h: (C.arr || C.prime) ? 100 : 112 });
      S.basket.items = []; for (let i = 0; i < C.N; i++) S.basket.items.push({ v: 1, kind: 'seed' });
      S.basket.render();
    }
    if (C.poly) S.poly = storePoly(C.poly > 3 ? 864 : 900, 190, C.poly);
    if (C.order) drawOrder(C.order[0], C.order[1]);
    if (C.arr) { LS.found = LS.found || []; drawArrNotes(); }
    if (C.prime) { LS.prime = LS.prime || []; drawPrimeNotes(); }
    if (!C.arr && !C.prime && !C.fence && !C.poly) drawFarmer(1205, 612, 1.8);
    if (C.fence) drawGoat(1215, 612, false);
    const mode = C.stack || C.lockC ? 'y' : C.lockR ? 'x' : 'xy';
    S.handle = makeHandle(mode);
    renderRegion();
    setDock(C.fence ? 'Pasang!' : 'Tanam!', onGridTanam);
    if (C.prime) btnAlt = actionBtn('1 baris', 'alt', '', onOneRow, true);
  }
  function regionCells() {
    const out = [], g = S.g;
    if (C.stack) {
      for (let r = 0; r < C.stack[0]; r++) for (let c = 0; c < C.stack[1]; c++) out.push({ g, r, c });
      for (let r = 0; r < S.r; r++) for (let c = 0; c < S.c; c++) out.push({ g, r: C.stack[0] + r, c });
      return out;
    }
    for (let r = 0; r < S.r; r++) for (let c = 0; c < S.c; c++) out.push({ g, r, c });
    return out;
  }
  function renderRegion() {
    const g = S.g;
    layers.soil.innerHTML = ''; layers.labels.innerHTML = '';
    let s = '', lab = '';
    if (C.stack) {
      const a = C.stack[0];
      s += regionMarkup(g, 0, 0, a, S.c, { tint: '#2F80C9' }) + regionMarkup(g, a, 0, S.r, S.c, { tint: '#F28C28' });
      s += '<path d="M' + (g.x + 6) + ' ' + (g.y + a * g.cell) + 'h' + (S.c * g.cell - 12) + '" stroke="#7CC26B" stroke-width="7" stroke-linecap="round"/>';
      lab += dimsMarkup(g, 0, 0, a, S.c) + dimsMarkup(g, a, 0, S.r, S.c, { noTop: true });
    } else {
      s += regionMarkup(g, 0, 0, S.r, S.c);
      lab += dimsMarkup(g, 0, 0, S.r, S.c);
    }
    GS.markup(layers.soil, s);
    GS.markup(layers.labels, lab);
    if (!S.dragging) placeHandle();
    liveBoard();
  }
  const HOFF = 30;
  function handlePos() {
    const g = S.g, k = g.cell, rows = C.stack ? C.stack[0] + S.r : S.r;
    if (C.stack || C.lockC) return { x: g.x + S.c * k / 2, y: g.y + rows * k + HOFF };
    if (C.lockR) return { x: g.x + S.c * k + HOFF, y: g.y + S.r * k / 2 };
    return { x: g.x + S.c * k + HOFF * 0.75, y: g.y + S.r * k + HOFF * 0.75 };
  }
  function placeHandle(p) {
    p = p || handlePos();
    S.handle.g.setAttribute('transform', 'translate(' + n1(p.x) + ' ' + n1(p.y) + ')');
  }
  function makeHandle(mode) {
    const h = { mode };
    h.g = GS.el('g', { class: 'bb-handle' }, layers.handles);
    h.mid = GS.el('g', null, h.g);
    h.inner = GS.el('g', { class: 'bb-hint' }, h.mid);
    GS.markup(h.inner, shadowEl(40, 50) + handleArt(mode));
    GS.el('circle', { r: 64, fill: 'transparent', class: 'bb-hit' }, h.g);
    let off = null;
    GS.drag(h.g, {
      svg,
      onStart(p) {
        if (busy) return false;
        const hp = handlePos(); off = { x: hp.x - p.x, y: hp.y - p.y };
        S.dragging = true; h.inner.classList.remove('bb-hint');
        h.mid.setAttribute('transform', 'scale(1.15)');
        GS.sfx.pick();
        return true;
      },
      onMove(p) {
        if (!off) return;
        const q = { x: p.x + off.x, y: p.y + off.y };
        const g = S.g, k = g.cell;
        const ox = mode === 'y' ? 0 : mode === 'x' ? HOFF : HOFF * 0.75, oy = mode === 'x' ? 0 : mode === 'y' ? HOFF : HOFF * 0.75;
        const top = C.stack ? C.stack[0] : 0;
        const minR = C.minR || 1, minC = C.minC || 1;
        const maxRows = C.stack ? C.maxR - C.stack[0] : C.maxR;
        let r = S.r, c = S.c;
        if (mode === 'xy' || mode === 'x') c = clamp(Math.round((q.x - ox - g.x) / k), minC, C.maxC);
        if (mode === 'xy' || mode === 'y') r = clamp(Math.round((q.y - oy - g.y) / k) - top, minR, maxRows);
        if (C.lockR) r = C.lockR;
        if (C.lockC) c = C.lockC;
        const fx = mode === 'y' ? handlePos().x : clamp(q.x, g.x + minC * k - k * 0.4 + ox, g.x + C.maxC * k + k * 0.4 + ox);
        const fy = mode === 'x' ? handlePos().y : clamp(q.y, g.y + (top + minR) * k - k * 0.4 + oy, g.y + g.h + k * 0.4 + oy);
        placeHandle({ x: fx, y: fy });
        if (r !== S.r || c !== S.c) { S.r = r; S.c = c; GS.sfx.tick(); renderRegion(); }
      },
      onEnd() {
        off = null; S.dragging = false;
        const from = (h.g.getAttribute('transform') || '').match(/-?[\d.]+/g).map(Number), to = handlePos();
        tween(160, e => placeHandle({ x: from[0] + (to.x - from[0]) * e, y: from[1] + (to.y - from[1]) * e }), 'outCubic').then(() => {
          if (GS.reducedMotion) { h.mid.removeAttribute('transform'); return; }
          tween(280, e => { const k = Math.sin(e * Math.PI) * (1 - e); h.mid.setAttribute('transform', 'scale(' + (1 + 0.15 * k).toFixed(3) + ' ' + (1 - 0.12 * k).toFixed(3) + ')'); }).then(() => h.mid.removeAttribute('transform'));
        });
        GS.sfx.drop();
      }
    });
    return h;
  }
  function setRegion(r, c) { S.r = r; S.c = c; renderRegion(); }
  async function onGridTanam() {
    if (busy) return;
    const my = tok;
    busy = true; updateDock();
    S.handle.inner.classList.remove('bb-hint');
    if (C.fence) { await fenceAttempt(); return; }
    const N = C.N, r = S.r, c = S.c, cells = regionCells(), H = cells.length, k = Math.min(N, H);
    const B = S.basket;
    const ok0 = await plantCells(cells.slice(0, k), B);
    if (!ok0 || my !== tok) return;
    let left = N - k, miss = H - k, saved = 0, softMiss = false;
    if (C.ceil && left === 0 && miss > 0 && miss < c) { miss = 0; softMiss = true; }
    if (C.poly && left > 0) {
      saved = Math.min(left, C.poly);
      for (let i = 0; i < saved; i++) {
        B.out++; B.render();
        const slot = S.poly.slot(S.poly.n);
        await flyArt('seed', B.at(), slot, 240);
        if (my !== tok) return;
        S.poly.n++; S.poly.render(); GS.sfx.drop();
      }
      left -= saved;
    }
    const exact = left === 0 && miss === 0;
    if (exact && C.order && (r !== C.order[0] || c !== C.order[1])) {
      hud.mood('think'); GS.sfx.oops();
      GS.say('Bibitnya pas, tapi ini ' + r + ' baris isi ' + c + '. Pesanannya ' + C.order[0] + ' baris isi ' + C.order[1] + '.');
      tries++;
      await wait(2400);
      if (my !== tok) return;
      resetGrid(cells.slice(0, k));
      return;
    }
    if (exact && C.arr) { await arrFound(cells.slice(0, k)); return; }
    if (exact) {
      const lines = C.prime ? [N + ' = ' + r + ' × ' + c] : C.done(S);
      if (C.prime) { LS.prime.push({ t: N + ' = ' + r + ' × ' + c, r, c }); drawPrimeNotes(); }
      if (saved) GS.say('Sisa ' + saved + ' bibit masuk polybag. Pas!');
      else if (softMiss) GS.say('Semua bibit tertanam. Baris terakhir belum penuh, tidak apa-apa.');
      await success(rowsOf(cells.slice(0, k)), { lines, quiet: !!(saved || softMiss), rotate: C.rotate });
      return;
    }
    // world feedback: wilted leftovers, weeds in empty holes
    const empty = cells.slice(k);
    await showFail(left, miss, empty, B, C.ceil && left === 0 ? 'row' : null);
    if (my !== tok) return;
    if (!(C.prime && isPrime(N))) tries++;
    resetGrid(cells.slice(0, k));
  }
  function resetGrid(planted) {
    planted.forEach(cl => plantAt(cl.g, cl.r, cl.c, null));
    clearPlants();
    S.basket.out = 0; S.basket.wilt = false; S.basket.render();
    if (S.poly) { S.poly.n = 0; S.poly.render(); }
    clearFx(); busy = false; updateDock(); hud.mood('think');
    liveBoard();
  }
  async function arrFound(planted) {
    const my = tok, r = S.r, c = S.c, key = Math.min(r, c) + 'x' + Math.max(r, c);
    const prev = LS.found.find(f => f.key === key);
    if (prev) {
      if (prev.r === r) GS.say('Susunan ini sudah dicatat. Coba susunan lain.');
      else {
        GS.say('Sama dengan ' + prev.r + ' × ' + prev.c + ', hanya diputar.');
        await rotateDemo(planted);
        if (my !== tok) return;
      }
      hud.mood('think');
      await wait(1800);
      if (my !== tok) return;
      resetGrid(regionCells());
      return;
    }
    LS.found.push({ key, r, c });
    drawArrNotes();
    await harvest(rowsOf(planted), {});
    if (my !== tok) return;
    setBoard([mulS(r, c)], true);
    GS.sfx.star(LS.found.length - 1);
    if (LS.found.length >= C.arr.need) {
      GS.say(C.arr.need === 2 ? 'Dua susunan untuk ' + C.N + ' bibit. Hebat!' : 'Semua susunan untuk ' + C.N + ' sudah ketemu!');
      await wait(1600);
      if (my !== tok) return;
      nextRound();
      return;
    }
    GS.say('Hebat! Sekarang cari susunan yang lain.');
    await wait(1800);
    if (my !== tok) return;
    resetGrid(regionCells());
  }
  /** Rotate the planted field a quarter turn: r x c becomes c x r with the same plants. */
  async function rotateDemo(planted) {
    const my = tok, g = S.g, k = g.cell, r = S.r, c = S.c;
    const wrap = GS.el('g', null, world);
    world.insertBefore(wrap, layers.labels);
    wrap.appendChild(layers.soil); wrap.appendChild(layers.plants);
    layers.labels.innerHTML = '';
    const ocx = g.x + c * k / 2, ocy = g.y + r * k / 2, ncx = g.x + r * k / 2, ncy = g.y + c * k / 2;
    GS.sfx.whoosh();
    await tween(900, e => wrap.setAttribute('transform', 'translate(' + n1((ncx - ocx) * e) + ' ' + n1((ncy - ocy) * e) + ') rotate(' + n1(90 * e) + ' ' + n1(ocx) + ' ' + n1(ocy) + ')'), 'inOutCubic');
    if (my !== tok) return;
    world.insertBefore(layers.soil, wrap); world.insertBefore(layers.plants, wrap); wrap.remove();
    const types = planted.map(cl => (S.plants[cl.g.id + ':' + cl.r + ',' + cl.c] || {}).type || 'seed');
    clearPlants();
    S.r = c; S.c = r;
    renderRegion();
    const out = [];
    for (let rr = 0; rr < S.r; rr++) for (let cc = 0; cc < S.c; cc++) out.push({ g, r: rr, c: cc });
    out.forEach((cl, i) => plantAt(g, cl.r, cl.c, types[0] === 'grow' ? 'grow' : 'seed'));
    GS.sfx.drop();
    return out;
  }
  async function onOneRow() {
    if (busy) return;
    const my = tok, N = C.N;
    busy = true; updateDock();
    if (!isPrime(N)) {
      hud.mood('think'); GS.sfx.oops();
      GS.say(N + ' bisa dibuat persegi panjang, lho. Coba di lahan.');
      tries++;
      await wait(1800);
      if (my !== tok) return;
      busy = false; updateDock();
      return;
    }
    // pematang path: one long row below the field
    const pg = { id: 'p', rows: 1, cols: N, cell: Math.min(56, Math.floor(700 / N)), order: 100000 };
    pg.w = pg.cell * N; pg.h = pg.cell; pg.x = Math.round(470 - pg.w / 2); pg.y = 190;
    GS.markup(layers.soil, regionMarkup(pg, 0, 0, 1, N));
    const cells = []; for (let c = 0; c < N; c++) cells.push({ g: pg, r: 0, c });
    const ok = await plantCells(cells, S.basket);
    if (!ok || my !== tok) return;
    LS.prime.push({ t: N + ': 1 baris', r: 1, c: N });
    drawPrimeNotes();
    await success([cells], { lines: [N + ' hanya bisa 1 baris'], say: N + ' tidak bisa jadi persegi panjang. Hanya satu baris!' });
  }
  function drawArrNotes() {
    const e = [];
    if (C.arr.given) e.push({ t: C.arr.given[0] + ' × ' + C.arr.given[1], r: 1, c: 8, grey: true, fs: 38 });
    LS.found.forEach(f => e.push({ t: f.r + ' × ' + f.c + ' = ' + f.r * f.c, r: f.r, c: f.c }));
    for (let i = LS.found.length; i < C.arr.need; i++) e.push({ t: '?', grey: true });
    drawCatatan(e, 'Catatan', 58);
  }
  function drawPrimeNotes() { drawCatatan(LS.prime.map(p => ({ t: p.t, r: p.r === 1 ? 1 : p.r, c: p.r === 1 ? 8 : p.c, fs: 38 })), 'Catatan', 54); }
  function drawFenceNotes() {
    const e = LS.found.slice().sort((a, b) => b.r * b.c - a.r * a.c).map(f => ({ t: f.r + ' × ' + f.c, r: f.r, c: f.c, note: 'luas ' + f.r * f.c, fs: 38 }));
    drawCatatan(e.slice(0, 4), 'Pagar 20 batang', 54);
  }
  async function fenceAttempt() {
    const my = tok, r = S.r, c = S.c, B = S.basket;
    const res = await buildFence(S.g, 0, 0, r, c, C.fence, B);
    if (my !== tok) return;
    if (!res.ok) {
      tries++;
      await wait(2200);
      if (my !== tok) return;
      if (S.goat) { S.goat.remove(); S.goat = null; }
      drawGoat(1215, 612, false);
      B.out = 0; B.render(); clearFx(); setBoard([]);
      busy = false; updateDock(); hud.mood('think');
      return;
    }
    const key = Math.min(r, c) + 'x' + Math.max(r, c);
    const cells = regionCells();
    await harvest(rowsOf(cells), { quiet: true });
    if (my !== tok) return;
    setBoard([r + ' × ' + c + ' = ' + r * c + ' petak'], true);
    const isNew = !LS.found.some(f => f.key === key);
    if (isNew) { LS.found.push({ key, r, c }); drawFenceNotes(); GS.sfx.star(LS.found.length - 1); }
    const best = LS.found.some(f => f.key === '5x5');
    if (best && LS.found.length >= 3) {
      GS.say('5 × 5 paling luas: 25 petak! Kelilingnya sama, luasnya beda.');
      await wait(2200);
      if (my !== tok) return;
      nextRound();
      return;
    }
    GS.say(isNew ? 'Luasnya ' + r * c + ' petak. Coba bentuk lain, mana yang paling luas?' : 'Bentuk ini sudah dicatat. Coba bentuk lain.');
    await wait(2000);
    if (my !== tok) return;
    clearPlants(); clearFx(); B.out = 0; B.render(); setBoard([]);
    busy = false; updateDock(); hud.mood('think');
  }

  /* ================= kind: split (distributive, area model) ================= */
  const PART_COL = ['#2F80C9', '#F28C28', '#0F8C7A', '#F59AB0'];
  function buildSplit() {
    S.mode = 'split';
    const two = C.t != null;
    const g = S.g = geom(C.R, C.C, { x0: 150, y0: 175, x1: 800, y1: two ? 672 : 770 }, 80);
    g.id = 'f';
    S.s = C.R > 6 ? 2 : C.R - 1;
    if (S.s === C.s) S.s = 3;
    S.t = two ? 3 : null;
    // baskets, one per part: their seedlings are the truth for that part
    const targets = partsOf(C.s, C.t).map(p => p.rows * p.cols);
    S.baskets = [];
    if (two) {
      const pos = [[958, 380], [1158, 380], [958, 600], [1158, 600]];
      targets.forEach((n, i) => S.baskets.push(fixedBasket(pos[i][0], pos[i][1], n, PART_COL[i], 176, 86)));
      GS.markup(layers.ui, Tc(1058, 168, 'Keranjang tiap bagian', 30, { body: true, fill: '#3B2A20' }));
    } else {
      S.baskets.push(fixedBasket(1010, 360, targets[0], PART_COL[0], 240, 100));
      S.baskets.push(fixedBasket(1010, 600, targets[1], PART_COL[1], 240, 100));
    }
    S.ropeH = makeRope('h');
    if (two) S.ropeV = makeRope('v');
    renderSplit();
    setDock('Tanam!', onSplitTanam);
  }
  function fixedBasket(x, y, n, color, w, h) {
    const items = []; for (let i = 0; i < n; i++) items.push({ v: 1, kind: 'seed' });
    return storeBasket(x, y, { fixed: true, items, color, w, h });
  }
  function partsOf(s, t) {
    const Rr = C.R, Cc = C.C;
    if (t == null) return [{ r0: 0, c0: 0, rows: s, cols: Cc }, { r0: s, c0: 0, rows: Rr - s, cols: Cc }];
    return [{ r0: 0, c0: 0, rows: s, cols: t }, { r0: 0, c0: t, rows: s, cols: Cc - t }, { r0: s, c0: 0, rows: Rr - s, cols: t }, { r0: s, c0: t, rows: Rr - s, cols: Cc - t }];
  }
  function renderSplit() {
    const g = S.g, k = g.cell;
    layers.soil.innerHTML = ''; layers.labels.innerHTML = '';
    const parts = partsOf(S.s, S.t);
    let s = '', lab = '';
    parts.forEach((p, i) => { s += regionMarkup(g, p.r0, p.c0, p.rows, p.cols, { tint: PART_COL[i] }); });
    GS.markup(layers.soil, s);
    parts.forEach((p, i) => {
      const t = p.rows + ' × ' + p.cols, x = g.x + (p.c0 + p.cols / 2) * k, y = g.y + (p.r0 + p.rows / 2) * k;
      lab += chip(x, y, t, { fs: 38, stroke: PART_COL[i] });
    });
    lab += chip(g.x + g.w / 2, g.y - 32, String(C.C)) ;
    if (S.t == null) lab += chip(g.x + g.w + 40, g.y + g.h / 2, String(C.R));
    else lab += chip(g.x + g.w + 40, g.y + g.h / 2, String(C.R));
    GS.markup(layers.labels, lab);
    placeRope(S.ropeH); if (S.ropeV) placeRope(S.ropeV);
    const head = S.t == null ? S.s + ' × ' + C.C + ' + ' + (C.R - S.s) + ' × ' + C.C
      : '(' + S.s + ' + ' + (C.R - S.s) + ') × (' + S.t + ' + ' + (C.C - S.t) + ')';
    setBoard([head], false);
  }
  function makeRope(dir) {
    const rp = { dir };
    rp.line = GS.el('g', { 'pointer-events': 'none' }, layers.handles);
    rp.g = GS.el('g', null, layers.handles);
    rp.mid = GS.el('g', null, rp.g);
    rp.inner = GS.el('g', { class: 'bb-hint' }, rp.mid);
    GS.markup(rp.inner, shadowEl(36, 46) + pegArt(dir === 'h' ? 'y' : 'x'));
    GS.el('circle', { r: 60, fill: 'transparent', class: 'bb-hit' }, rp.g);
    let off = null;
    GS.drag(rp.g, {
      svg,
      onStart(p) { if (busy) return false; const q = ropePos(rp); off = { x: q.x - p.x, y: q.y - p.y }; rp.inner.classList.remove('bb-hint'); rp.mid.setAttribute('transform', 'scale(1.12)'); GS.sfx.pick(); return true; },
      onMove(p) {
        if (!off) return;
        const g = S.g, k = g.cell;
        if (dir === 'h') { const v = clamp(Math.round((p.y + off.y - g.y) / k), 1, C.R - 1); if (v !== S.s) { S.s = v; GS.sfx.tick(); renderSplit(); } }
        else { const v = clamp(Math.round((p.x + off.x - g.x) / k), 1, C.C - 1); if (v !== S.t) { S.t = v; GS.sfx.tick(); renderSplit(); } }
      },
      onEnd() { off = null; rp.mid.removeAttribute('transform'); GS.sfx.drop(); }
    });
    return rp;
  }
  function ropePos(rp) {
    const g = S.g, k = g.cell;
    return rp.dir === 'h' ? { x: g.x - 66, y: g.y + S.s * k } : { x: g.x + S.t * k, y: g.y + g.h + 66 };
  }
  function placeRope(rp) {
    const g = S.g, k = g.cell, p = ropePos(rp);
    rp.g.setAttribute('transform', 'translate(' + n1(p.x) + ' ' + n1(p.y) + ')');
    const d = rp.dir === 'h' ? 'M' + (g.x - 20) + ' ' + p.y + 'H' + (g.x + g.w + 14) : 'M' + p.x + ' ' + (g.y - 14) + 'V' + (g.y + g.h + 20);
    rp.line.innerHTML = '<path d="' + d + '" stroke="' + OL + '" stroke-width="10" stroke-linecap="round"/><path d="' + d + '" stroke="#E3C27F" stroke-width="5.5" stroke-dasharray="12 8" stroke-linecap="round"/>';
  }
  async function onSplitTanam() {
    if (busy) return;
    const my = tok;
    busy = true; updateDock();
    [S.ropeH, S.ropeV].forEach(rp => rp && rp.inner.classList.remove('bb-hint'));
    const g = S.g, parts = partsOf(S.s, S.t);
    const res = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], B = S.baskets[i], N = B.total();
      const cells = [];
      for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) cells.push({ g, r: p.r0 + r, c: p.c0 + c });
      const k = Math.min(N, cells.length);
      const ok = await plantCells(cells.slice(0, k), B, true);
      if (!ok || my !== tok) return;
      res.push({ cells, k, left: N - k, miss: cells.length - k, B });
    }
    if (res.every(x => !x.left && !x.miss)) {
      const sums = res.map(x => x.cells.length);
      const lines = S.t == null
        ? [C.R + ' × ' + C.C + ' = ' + S.s + ' × ' + C.C + ' + ' + (C.R - S.s) + ' × ' + C.C, '= ' + sums.join(' + ') + ' = ' + C.R * C.C]
        : [C.R + ' × ' + C.C + ' = (' + S.s + ' + ' + (C.R - S.s) + ') × (' + S.t + ' + ' + (C.C - S.t) + ')', '= ' + sums.join(' + ') + ' = ' + C.R * C.C];
      await success(res.map(x => x.cells), { lines });
      return;
    }
    hud.mood('oops'); GS.sfx.oops();
    const wl = res.filter(x => x.left > 0), ml = res.filter(x => x.miss > 0);
    wl.forEach(x => { x.B.wilt = true; x.B.render(); });
    for (const x of ml) for (const cl of x.cells.slice(x.k)) weedAt(cl.g, cl.r, cl.c);
    GS.say(wl.length && ml.length ? 'Ada keranjang yang sisa, ada bagian yang kosong.' : wl.length ? 'Ada bibit yang sisa di keranjang. Layu, deh.' : 'Ada lubang kosong. Rumput tumbuh di situ.');
    tries++;
    await wait(2400);
    if (my !== tok) return;
    clearPlants(); clearFx();
    S.baskets.forEach(B => { B.out = 0; B.wilt = false; B.render(); });
    busy = false; updateDock(); hud.mood('think');
  }

  /* ================= kind: compare (tk L4) ================= */
  function buildCompare() {
    S.mode = 'compare';
    const g = S.g = geom(2, 7, { x0: 110, y0: 330, x1: 800, y1: 560 }, 100);
    g.id = 'f';
    let soil = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 7; c++) soil += moundMarkup(g, r, c);
    GS.markup(layers.soil, soil);
    GS.markup(layers.labels, rowFlag(g.x - 46, cyOf(g, 0), '#2F80C9', 'dots') + rowFlag(g.x - 46, cyOf(g, 1), '#F28C28', 'stripes'));
    S.trays = [compareTray(0, C.a, C.a < C.b), compareTray(1, C.b, C.b < C.a)];
    S.choice = null;
    setDock('Tanam!', onCompare);
  }
  function compareTray(i, n, wide) {
    const x = 860, y = i ? 400 : 168, w = 390, h = 196, col = i ? '#F28C28' : '#2F80C9';
    const t = { i, n, wide, x, y, w, h, col };
    t.g = GS.el('g', { transform: 'translate(' + x + ' ' + y + ')', 'data-hit': 'tray', class: 'bb-hit' }, layers.ui);
    // fewer seedlings spread wide, more seedlings bunched up: length is not number
    const sp = wide ? Math.min(84, (w - 60) / Math.max(1, n - 1)) : 46;
    t.pos = []; for (let k = 0; k < n; k++) t.pos.push({ x: x + w / 2 + (k - (n - 1) / 2) * sp, y: y + h * 0.62 });
    t.render = () => {
      let m = '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="20" fill="transparent"/>' +
        '<ellipse cx="' + w / 2 + '" cy="' + (h - 8) + '" rx="' + (w / 2 - 10) + '" ry="12" fill="' + OL + '" opacity=".16"/>' +
        '<rect x="6" y="' + n1(h * 0.62) + '" width="' + (w - 12) + '" height="' + n1(h * 0.3) + '" rx="12" fill="' + col + '" stroke="' + OL + '" stroke-width="3"/>';
      m += i ? '<path d="M30 ' + n1(h * 0.66) + 'l-14 ' + n1(h * 0.22) + 'M70 ' + n1(h * 0.66) + 'l-14 ' + n1(h * 0.22) + 'M' + (w - 40) + ' ' + n1(h * 0.66) + 'l-14 ' + n1(h * 0.22) + '" stroke="#fff" stroke-width="5" opacity=".7"/>'
        : '<circle cx="28" cy="' + n1(h * 0.77) + '" r="6" fill="#fff" opacity=".8"/><circle cx="52" cy="' + n1(h * 0.77) + '" r="6" fill="#fff" opacity=".8"/><circle cx="' + (w - 30) + '" cy="' + n1(h * 0.77) + '" r="6" fill="#fff" opacity=".8"/>';
      if (!t.planted) t.pos.forEach((p, k) => { m += '<g transform="translate(' + n1(p.x - x) + ' ' + n1(p.y - y + 6) + ')"><g class="bb-sway d' + (k % 4) + '"><use href="#bb-seed"/></g></g>'; });
      if (S.choice === i) m += '<rect x="-6" y="-6" width="' + (w + 12) + '" height="' + (h + 12) + '" rx="24" fill="none" stroke="#0F8C7A" stroke-width="7"/>' + '<g transform="translate(' + (w - 26) + ' 22)"><circle r="20" fill="#0F8C7A" stroke="' + OL + '" stroke-width="2.6"/><path d="M-9 0l6 7l12 -13" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
      t.g.innerHTML = m;
    };
    t.render();
    t.g.addEventListener('click', () => {
      if (busy) return;
      chooseTray(i);
    });
    return t;
  }
  function chooseTray(i) {
    S.choice = i; GS.sfx.pop();
    S.trays.forEach(t => t.render());
    GS.fx(S.trays[i].g, 'gs-wobble', 420);
    GS.say(TK ? 'Ayo tanam untuk membuktikan!' : 'Ayo tanam untuk membuktikan.');
    updateDock();
  }
  async function onCompare() {
    if (busy || S.choice == null) return;
    const my = tok;
    busy = true; updateDock();
    const g = S.g, k = g.cell, [A, Bt] = S.trays;
    A.planted = Bt.planted = true; A.render(); Bt.render();
    const n = Math.max(A.n, Bt.n);
    for (let i = 0; i < n; i++) {
      const fl = [];
      if (i < A.n) fl.push(flyArt('seed', A.pos[i], baseOf(g, 0, i), 300).then(() => { if (my === tok) plantAt(g, 0, i, 'seed', true); }));
      if (i < Bt.n) fl.push(flyArt('seed', Bt.pos[i], baseOf(g, 1, i), 300).then(() => { if (my === tok) plantAt(g, 1, i, 'seed', true); }));
      await Promise.all(fl);
      if (my !== tok) return;
      if (i < A.n && i < Bt.n) {
        const x = cxOf(g, i), y1 = cyOf(g, 0) + k * 0.25, y2 = cyOf(g, 1) - k * 0.3;
        GS.markup(layers.fx, '<path d="M' + n1(x) + ' ' + n1(y1) + 'V' + n1(y2) + '" stroke="' + OL + '" stroke-width="8" stroke-linecap="round"/><path d="M' + n1(x) + ' ' + n1(y1) + 'V' + n1(y2) + '" stroke="#E3C27F" stroke-width="4" stroke-dasharray="8 6" stroke-linecap="round"/>');
      }
      GS.sfx.count(i + 1);
    }
    const more = A.n > Bt.n ? 0 : 1, row = more, extra = Math.abs(A.n - Bt.n);
    for (let i = Math.min(A.n, Bt.n); i < Math.min(A.n, Bt.n) + extra; i++) {
      const b = baseOf(g, row, i);
      GS.markup(layers.fx, '<circle class="bb-glow" cx="' + n1(b.x) + '" cy="' + n1(b.y - k * 0.3) + '" r="' + n1(k * 0.42) + '" fill="none" stroke="#0F8C7A" stroke-width="6"/>');
    }
    if (S.choice === more) { GS.sfx.star(0); hud.mood('cheer'); GS.say('Betul! Baris ini lebih banyak. Lihat, ada yang tidak punya pasangan.'); }
    else { hud.mood('surprise'); GS.sfx.oops(); GS.say('Ternyata baris ini yang lebih banyak. Lihat pasangannya.'); tries++; }
    await wait(2600);
    if (my !== tok) return;
    clearFx();
    const rows = [[], []];
    for (let i = 0; i < A.n; i++) rows[0].push({ g, r: 0, c: i });
    for (let i = 0; i < Bt.n; i++) rows[1].push({ g, r: 1, c: i });
    await success(rows, { quiet: true });
  }

  /* ================= kind: lcm (k4 L4) ================= */
  function buildLcm() {
    S.mode = 'lcm';
    const a = C.a, b = C.b, L = lcm(a, b);
    S.maxN = L + Math.max(a, b);
    S.N = 0;
    const rA = Math.ceil(S.maxN / a), rB = Math.ceil(S.maxN / b);
    const cell = Math.floor(Math.min(90, 640 / (a + b), 520 / Math.max(rA, rB)));
    const gap = 60, totalW = cell * (a + b) + gap, x0 = Math.round(445 - totalW / 2), y0 = 240;
    S.gA = { id: 'A', rows: rA, cols: a, cell, x: x0, y: y0, w: a * cell, h: rA * cell };
    S.gB = { id: 'B', rows: rB, cols: b, cell, x: x0 + a * cell + gap, y: y0, w: b * cell, h: rB * cell, order: 0 };
    drawLahan(layers.lahan, S.gA); drawLahan(layers.lahan, S.gB);
    GS.markup(layers.labels, chip(S.gA.x + S.gA.w / 2, y0 - 44, 'isi ' + a, { fs: 36 }) + chip(S.gB.x + S.gB.w / 2, y0 - 44, 'isi ' + b, { fs: 36 }));
    // sack with the count and +/- buttons (SVG tap targets)
    S.sack = GS.el('g', { transform: 'translate(1000 600)' }, layers.ui);
    S.plus = svgButton(1190, 300, '+', () => setLcmN(S.N + 1), '#0F8C7A');
    S.minus = svgButton(1190, 450, '−', () => setLcmN(S.N - 1), '#F28C28');
    renderSack();
    setDock('Tanam!', onLcmTanam);
  }
  function renderSack() {
    let m = shadowEl(110, 4) + '<path d="M-100 -6Q-116 -120 -60 -170L-40 -186Q0 -196 40 -186L60 -170Q116 -120 100 -6Q0 12 -100 -6Z" fill="#D9C08A" stroke="' + OL + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M60 -170Q110 -120 100 -6Q60 4 30 6Q86 -60 60 -170Z" fill="#B89A5C" opacity=".6"/><path d="M-46 -184Q0 -172 46 -184" stroke="#8A6A3A" stroke-width="5" fill="none"/>';
    for (let i = 0; i < 5; i++) m += '<use href="#bb-seedns" transform="translate(' + (-40 + i * 20) + ' ' + (-180 + (i % 2) * 6) + ') scale(.8)"/>';
    m += '<rect x="-62" y="-118" width="124" height="74" rx="14" fill="' + CREAM + '" stroke="' + OL + '" stroke-width="3"/>' + Tc(0, -81, String(S.N), 54);
    S.sack.innerHTML = m;
  }
  function svgButton(x, y, label, fn, col) {
    const g = GS.el('g', { transform: 'translate(' + x + ' ' + y + ')', 'data-hit': 'btn', class: 'bb-hit' }, layers.ui);
    const inner = GS.el('g', null, g);
    GS.markup(inner, '<circle r="58" fill="' + OL + '" opacity=".18" cy="6"/><circle r="56" fill="' + col + '" stroke="' + OL + '" stroke-width="4"/><circle cx="-14" cy="-18" r="12" fill="#fff" opacity=".25"/>' + Tc(0, -2, label, 70, { fill: '#fff' }));
    g.addEventListener('click', () => {
      if (busy) return;
      fn();
      if (!GS.reducedMotion) tween(200, e => inner.setAttribute('transform', 'scale(' + (1 - 0.1 * Math.sin(e * Math.PI)).toFixed(3) + ')')).then(() => inner.removeAttribute('transform'));
    });
    return g;
  }
  function setLcmN(n) {
    n = clamp(n, 0, S.maxN);
    if (n === S.N) { GS.sfx.oops(); return; }
    const up = n > S.N;
    S.N = n;
    renderLcm(up);
    renderSack();
    if (up) GS.sfx.count(Math.min(n, 24)); else GS.sfx.tick();
    updateDock();
  }
  function renderLcm(pop) {
    layers.soil.innerHTML = '';
    let s = '';
    [S.gA, S.gB].forEach(g => {
      const rows = Math.ceil(S.N / g.cols);
      if (rows) s += regionMarkup(g, 0, 0, rows, g.cols);
    });
    GS.markup(layers.soil, s);
    [S.gA, S.gB].forEach(g => {
      for (let i = 0; i < g.rows * g.cols; i++) {
        const r = Math.floor(i / g.cols), c = i % g.cols, key = g.id + ':' + r + ',' + c, has = !!S.plants[key];
        if (i < S.N && !has) plantAt(g, r, c, 'seed', pop && i === S.N - 1);
        if (i >= S.N && has) plantAt(g, r, c, null);
      }
    });
  }
  async function onLcmTanam() {
    if (busy || !S.N) return;
    const my = tok, a = C.a, b = C.b, L = lcm(a, b), N = S.N;
    busy = true; updateDock();
    const fullA = N % a === 0, fullB = N % b === 0;
    if (fullA && fullB && N === L) {
      const rowsOfField = g => { const rows = []; for (let r = 0; r < N / g.cols; r++) { const row = []; for (let c = 0; c < g.cols; c++) row.push({ g, r, c }); rows.push(row); } return rows; };
      const seq = g => rowsOfField(g).map((_, i) => (i + 1) * g.cols).join(', ');
      GS.say(seq(S.gA) + '. ' + seq(S.gB) + '!');
      await harvest(rowsOfField(S.gA), { quiet: true });
      if (my !== tok) return;
      await harvest(rowsOfField(S.gB), { quiet: true });
      if (my !== tok) return;
      await success([], { noHarvest: true, lines: [L + ' = ' + (L / a) + ' × ' + a + ' = ' + (L / b) + ' × ' + b], say: L + ' bibit pas untuk keduanya. Paling sedikit!' });
      return;
    }
    hud.mood('think'); GS.sfx.oops();
    if (fullA && fullB) GS.say('Pas untuk keduanya. Tapi ada jumlah yang lebih sedikit. Coba kurangi.');
    else {
      [S.gA, S.gB].forEach(g => { if (N % g.cols) { const r = Math.floor(N / g.cols); for (let c = N % g.cols; c < g.cols; c++) weedAt(g, r, c); } });
      GS.say(!fullA && !fullB ? 'Dua lahan, baris terakhirnya belum penuh. Rumput tumbuh.' : 'Satu lahan baris terakhirnya belum penuh.');
    }
    tries++;
    await wait(2200);
    if (my !== tok) return;
    clearFx(); busy = false; updateDock(); hud.mood('think');
  }

  /* ================= shared: planting, failure, harvest ================= */
  function rowsOf(cells) {
    const m = new Map();
    cells.forEach(cl => { const k = cl.g.id + ':' + cl.r; if (!m.has(k)) m.set(k, []); m.get(k).push(cl); });
    return Array.from(m.values());
  }
  /** Seedlings leave the basket one per hole (row by row for big fields). */
  async function plantCells(list, B, fast) {
    const my = tok;
    if (!list.length) return true;
    const g0 = list[0].g, s1 = g0.cell / 100;
    if (list.length <= 12 && !fast) {
      for (let i = 0; i < list.length; i++) {
        const cl = list[i];
        B.out++; B.render();
        await flyArt('seed', B.at(), baseOf(cl.g, cl.r, cl.c), 220, 0, 0.9, cl.g.cell / 100);
        if (my !== tok) return false;
        plantAt(cl.g, cl.r, cl.c, 'seed', true);
        GS.sfx.count(i + 1);
      }
      return true;
    }
    const rows = rowsOf(list);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      B.out += row.length; B.render();
      await Promise.all(row.map((cl, j) => flyArt('seed', B.at(), baseOf(cl.g, cl.r, cl.c), 300, j * 16, 0.9, s1)));
      if (my !== tok) return false;
      row.forEach(cl => plantAt(cl.g, cl.r, cl.c, 'seed', false));
      GS.sfx.count(i + 1);
    }
    return true;
  }
  async function showFail(left, miss, empty, B, kind) {
    const my = tok;
    hud.mood('oops'); GS.sfx.oops();
    if (left > 0) { B.wilt = true; B.render(); GS.fx(B.g, 'gs-wobble', 420); }
    if (miss > 0) {
      empty.forEach((cl, i) => setTimeout(() => { if (my === tok) weedAt(cl.g, cl.r, cl.c); }, (i * 40) / SPEED));
    }
    let line;
    if (TK) line = left > 0 ? 'Ada bibit yang tidak dapat lubang. Layu, deh.' : 'Ada lubang kosong. Rumputnya tumbuh!';
    else if (left > 0 && miss > 0) line = 'Ada bibit layu dan ada lubang kosong.';
    else if (left > 0) line = 'Sisa ' + left + ' bibit tidak dapat lubang. Kasihan, layu.';
    else if (kind === 'row') line = 'Ada baris yang kosong. Rumput tumbuh di situ.';
    else line = 'Ada ' + miss + ' lubang kosong. Rumput tumbuh di situ.';
    GS.say(line);
    if (miss > 0 && empty.length) {
      const cl = empty[Math.floor(empty.length / 2)], b = baseOf(cl.g, cl.r, cl.c);
      await birdTo(b.x + cl.g.cell * 0.1, b.y - 2, Math.max(0.9, Math.min(1.4, cl.g.cell / 80)));
    }
    if (my !== tok) return;
    await wait(1900);
  }
  /** Plants grow, then the harvest is counted group by group (rows: 4, 8, 12; TK: one by one). */
  async function harvest(groups, o) {
    const my = tok;
    o = o || {};
    const one = TK && !o.rows;
    const gs = one ? groups.reduce((a, g) => a.concat(g.map(c => [c])), []) : groups;
    const seq = []; let total = 0;
    gs.forEach(gr => { total += gr.length; seq.push(total); });
    if (!o.quiet) GS.say(seq.length <= 7 ? seq.join(', ') + '!' : 'Panennya ' + total + '!');
    total = 0;
    for (let i = 0; i < gs.length; i++) {
      const gr = gs[i];
      gr.forEach(cl => plantAt(cl.g, cl.r, cl.c, 'grow', true));
      total += gr.length;
      const last = gr[gr.length - 1], g = last.g;
      floatAt(cxOf(g, last.c) + (one ? 0 : g.cell * 0.7), cyOf(g, last.r) - (one ? g.cell * 0.5 : 0), String(total));
      GS.sfx.count(i + 1);
      await wait(one ? 380 : gs.length > 8 ? 260 : 440);
      if (my !== tok) return;
    }
  }
  async function success(groups, o) {
    const my = tok;
    o = o || {};
    busy = true; updateDock();
    hud.mood('cheer');
    if (!o.noHarvest) await harvest(groups, o);
    if (my !== tok) return;
    const lines = o.lines || (C.done ? C.done(S) : null);
    if (lines) setBoard(lines, true);
    GS.sfx.star(Math.min(ri, 2));
    if (o.say) GS.say(o.say);
    if (o.rotate) {
      await wait(1400);
      if (my !== tok) return;
      GS.say('Kita putar lahannya!');
      const planted = regionCells();
      const out = await rotateDemo(planted);
      if (my !== tok || !out) return;
      await harvest(rowsOf(out), {});
      if (my !== tok) return;
      setBoard([mulS(C.order[0], C.order[1]), mulS(C.order[1], C.order[0])], true);
      GS.say('Diputar, panennya tetap ' + C.N + '!');
    }
    await wait(o.rotate ? 2000 : 1700);
    if (my !== tok) return;
    nextRound();
  }

  /* ================= dock ================= */
  function actionBtn(label, cls, icon, fn, prepend) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gs-action' + (cls ? ' ' + cls : '');
    b.innerHTML = (icon || '') + '<span></span>';
    b.querySelector('span').textContent = label;
    b.addEventListener('click', () => { if (b.disabled) return; GS.sfx.click(); fn(); });
    if (prepend) dock.insertBefore(b, dock.firstChild); else dock.appendChild(b);
    return b;
  }
  function setDock(label, fn) { btnMain = actionBtn(label, '', '', fn); }
  function updateDock() {
    const ready = S.mode === 'basket' ? S.basket && S.basket.total() > 0 : S.mode === 'compare' ? S.choice != null : S.mode === 'lcm' ? S.N > 0 : true;
    if (btnMain) btnMain.disabled = busy || !ready;
    if (btnAlt) btnAlt.disabled = busy;
  }

  /* ================= test hook: solve() plays the current round through the real code paths ================= */
  async function solve() {
    if (busy || solving || !C) return;
    solving = true;
    try {
      if (S.mode === 'place') {
        if (C.check === 'pairs') {
          const bot = S.holes.filter(h => h.r === 1), want = C.a;
          let have = bot.filter(h => h.filled).length;
          for (const h of bot) { if (have > want && h.filled && !h.pre) { moveNow(h, S.tray); have--; } }
          for (const h of bot) { if (have < want && !h.filled) { moveNow(S.tray, h); have++; } }
          onPairs();
        } else {
          for (const h of S.holes) if (!h.filled) moveNow(S.tray, h);
          afterChange();
        }
      } else if (S.mode === 'basket') {
        const B = S.basket;
        while (B.items.length) moveNow(B, B.items[B.items.length - 1].origin);
        let need = C.fence ? 2 * (C.rows + C.cols) : S.holes.filter(h => !h.filled).length;
        if (S.bundles) while (need >= S.bundles.size && S.bundles.n > 0) { moveNow(S.bundles, B); need -= S.bundles.size; }
        while (need > 0 && S.tray.n > 0) { moveNow(S.tray, B); need--; }
        updateDock();
        btnMain.click();
      } else if (S.mode === 'poly') {
        const H = S.holes.filter(h => !h.filled).length;
        while (S.poly.n > 0) moveNow(S.poly, S.basket);
        while (S.basket.total() > H) moveNow(S.basket, S.poly);
        btnMain.click();
      } else if (S.mode === 'grid') {
        const N = C.N;
        if (C.fence) {
          const cands = []; for (let r = 1; r <= C.maxR; r++) { const c = C.fence / 2 - r; if (c >= 1 && c <= C.maxC) cands.push([r, c]); }
          const has = k => LS.found.some(f => f.key === k);
          const pickC = !has('5x5') ? [5, 5] : cands.find(([r, c]) => !has(Math.min(r, c) + 'x' + Math.max(r, c)));
          setRegion(pickC[0], pickC[1]);
        } else if (C.prime) {
          if (isPrime(N)) { onOneRow(); return; }
          let best = null;
          for (let r = 2; r <= C.maxR && !best; r++) if (N % r === 0 && N / r >= 2 && N / r <= C.maxC) best = [r, N / r];
          setRegion(best[0], best[1]);
        } else if (C.arr) {
          let best = null;
          for (let r = 1; r <= C.maxR && !best; r++) {
            const c = N / r;
            if (c === Math.floor(c) && c <= C.maxC && !LS.found.some(f => f.key === Math.min(r, c) + 'x' + Math.max(r, c))) best = [r, c];
          }
          setRegion(best[0], best[1]);
        } else if (C.order) setRegion(C.order[0], C.order[1]);
        else if (C.stack) setRegion((N - C.stack[0] * C.stack[1]) / C.stack[1], C.stack[1]);
        else if (C.lockC) setRegion(C.ceil ? Math.ceil(N / C.lockC) : Math.floor(N / C.lockC), C.lockC);
        else if (C.lockR) setRegion(C.lockR, Math.floor(N / C.lockR));
        else {
          let best = null;
          for (let r = 2; r <= C.maxR && !best; r++) if (N % r === 0 && N / r <= C.maxC) best = [r, N / r];
          setRegion(best[0], best[1]);
        }
        btnMain.click();
      } else if (S.mode === 'split') {
        S.s = C.s; if (C.t != null) S.t = C.t;
        renderSplit();
        btnMain.click();
      } else if (S.mode === 'compare') {
        chooseTray(C.a > C.b ? 0 : 1);
        btnMain.click();
      } else if (S.mode === 'lcm') {
        const L = lcm(C.a, C.b);
        while (S.N !== L) setLcmN(S.N < L ? S.N + 1 : S.N - 1);
        btnMain.click();
      }
    } finally { solving = false; }
  }
  window.__game = {
    go: i => run.go(i),
    solve,
    count: () => LEVELS.length,
    speed: n => { SPEED = Math.max(1, +n || 1); },
    tier: TIER,
    get state() { return { level: run.current, round: ri, rounds: rounds.length, kind: C && C.kind, mode: S.mode, tries, busy, r: S.r, c: S.c, s: S.s, t: S.t, N: S.N }; },
    toScreen: (x, y) => { const q = toScreen(x, y); return q ? { x: q.x, y: q.y } : null; },
    handle: () => { const p = S.handle ? handlePos() : null; return p ? window.__game.toScreen(p.x, p.y) : null; },
    cellScreen: (r, c) => S.g ? window.__game.toScreen(cxOf(S.g, c), cyOf(S.g, r)) : null,
    geom: () => S.g
  };

  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
