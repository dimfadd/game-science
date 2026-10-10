/* Warung Kembalian (kembalian)
 * The child stands behind a warung counter. Money (stylised rupiah coins and notes, never
 * copies of real banknote designs) is dragged from a cash drawer (laci) or wallet (dompet)
 * onto a rattan tray (nampan). "Bayar!" / "Berikan" commits; the person across the counter
 * then counts the tray aloud, largest pieces first, so the running total is visible.
 *
 * The arithmetic is exact and never bent toward the answer:
 *   pay     start = money already on the tray (locked), goal = sum(price x qty)
 *   change  start = total price (count up from harga), goal = uang pembeli
 *   running r_k = start + v_1 + ... + v_k        (v sorted largest first)
 *   r = goal          -> the deal happens (barang pindah tangan)
 *   r < goal          -> the person waits; the gap stays visible on the board / strip
 *   r > goal          -> pieces are handed back from the end of the count while r > goal;
 *                        the child must commit again (the game never completes it).
 *   "lembar paling sedikit": minimum number of pieces by dynamic programming over the
 *   denominations in the drawer; only these rounds cap the stars at 2 when not minimal.
 * Prices are randomised per level build inside the tier ranges written next to each level. */
(function () {
  'use strict';
  const GAME = 'kembalian';
  const OL = '#3B2A20', INK = '#2B1D14', CREAM = '#FFF8EC', TEAL = '#0F8C7A', AMBER = '#F2A900';
  const el = GS.el;
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const TIER = (GS.tier && GS.tier()) || 'k1';
  const TK = TIER === 'tk';
  const rand = GS.rand, clamp = GS.clamp, lerp = GS.lerp;
  let SPEED = 1;
  const T = ms => ms / SPEED;
  const n1 = v => Math.round(v * 10) / 10;
  let uidc = 0;
  const uid = p => 'km' + (p || '') + (++uidc);
  const pick1 = a => a[Math.floor(Math.random() * a.length)];
  const pickN = (a, n) => GS.shuffle(a).slice(0, n);
  const K = v => Math.round(v * 1000);

  /* ============================== geometry (canvas units) ============================== */
  const G = {
    counterY: 400, lipY: 586,
    tray: { x: 250, y: 408, w: 620, h: 176 },
    mat: { x: 14, y: 408, w: 230, h: 176 },
    drawer: { x: 10, y: 588, w: 842, h: 214 },
    person: { x: 1110, y: 488, s: 3.4 },
    items: { x0: 892, x1: 1268, y: 578 },
    bubble: { x: 560, y: 86, w: 450 },
    strip: { x0: 340, x1: 830, y: 380 },
    board: { x: 560, y: 352 }
  };

  /* ============================== money ============================== */
  const METAL = {
    alu: ['#D3D8DC', '#F2F4F6', '#A2A9B0'], silver: ['#BCC3CA', '#E6EAEE', '#8A929B'],
    gold: ['#E3BF57', '#F5DE95', '#B38D27']
  };
  // Colours roughly follow real Indonesian money; the designs are our own playful ones.
  const DEN = {
    t1000: { v: 1000, coin: true, r: 60, metal: 'silver', ink: '#3A424B', fs: 39, dot: true },
    c100: { v: 100, coin: true, r: 44, metal: 'alu', ink: '#3A424B', fs: 44 },
    c200: { v: 200, coin: true, r: 47, metal: 'silver', ink: '#3A424B', fs: 44 },
    c500: { v: 500, coin: true, r: 50, metal: 'gold', ink: '#5E4208', fs: 44 },
    c1000: { v: 1000, coin: true, r: 55, metal: 'bi', ink: '#3A2E10', fs: 40 },
    n1000: { v: 1000, col: ['#A9C4A2', '#D2E3CC', '#7F9E79'], ink: '#203F27', fs: 48 },
    n2000: { v: 2000, col: ['#B9AFCF', '#DCD5EA', '#8F84AB'], ink: '#33294E', fs: 48 },
    n5000: { v: 5000, col: ['#CDA676', '#E8CEA6', '#A27C4E'], ink: '#42260C', fs: 48 },
    n10000: { v: 10000, col: ['#B394D3', '#D6C2EC', '#8565A9'], ink: '#2F1549', fs: 46 },
    n20000: { v: 20000, col: ['#86C490', '#B8E2BD', '#5A9D66'], ink: '#143B1F', fs: 46 },
    n50000: { v: 50000, col: ['#79B0E1', '#ADD0F1', '#4C84BA'], ink: '#10335C', fs: 46 },
    n100000: { v: 100000, col: ['#EC8C84', '#F7BAB4', '#C65A53'], ink: '#51110D', fs: 44 }
  };
  const NW = 198, NH = 90;        // note size at scale 1
  const TRAY_NOTE = 0.85;         // notes shrink a little on the tray (value text stays >= 37 u)
  const fmt = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const rp = v => 'Rp' + fmt(v);
  const ONES = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
  /** Indonesian number words ("tiga ribu lima ratus"): speech never depends on how a TTS reads "Rp". */
  function words(n) {
    n = Math.round(n);
    if (n < 10) return ONES[n];
    if (n === 10) return 'sepuluh';
    if (n === 11) return 'sebelas';
    if (n < 20) return ONES[n - 10] + ' belas';
    if (n < 100) return ONES[Math.floor(n / 10)] + ' puluh' + (n % 10 ? ' ' + ONES[n % 10] : '');
    if (n < 1000) return (n < 200 ? 'seratus' : ONES[Math.floor(n / 100)] + ' ratus') + (n % 100 ? ' ' + words(n % 100) : '');
    if (n < 1e6) { const k = Math.floor(n / 1000), r = n % 1000; return (k === 1 ? 'seribu' : words(k) + ' ribu') + (r ? ' ' + words(r) : ''); }
    const m = Math.floor(n / 1e6), r = n % 1e6;
    return (m === 1 ? 'satu juta' : words(m) + ' juta') + (r ? ' ' + words(r) : '');
  }
  const rpW = v => words(v) + ' rupiah';
  const sumKeys = keys => (keys || []).reduce((a, k) => a + DEN[k].v, 0);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  /** Fewest pieces that make `amount` exactly (dynamic programming, not greedy). Returns keys, largest first, or null. */
  function decompose(amount, keys) {
    if (amount === 0) return [];
    const ks = keys.slice().sort((a, b) => DEN[b].v - DEN[a].v);
    let unit = amount;
    ks.forEach(k => { unit = gcd(unit, DEN[k].v); });
    const N = Math.round(amount / unit);
    if (N > 200000) return null;
    const best = new Int32Array(N + 1).fill(1e9), from = new Int16Array(N + 1).fill(-1);
    best[0] = 0;
    const us = ks.map(k => Math.round(DEN[k].v / unit));
    for (let a = 1; a <= N; a++) for (let j = 0; j < us.length; j++) {
      const u = us[j];
      if (u <= a && best[a - u] + 1 < best[a]) { best[a] = best[a - u] + 1; from[a] = j; }
    }
    if (best[N] >= 1e9) return null;
    const out = [];
    for (let a = N; a > 0; a -= us[from[a]]) out.push(ks[from[a]]);
    return out.sort((a, b) => DEN[b].v - DEN[a].v);
  }

  /* ============================== layers ============================== */
  const LEVELS = buildLevels(TIER);
  const hud = GS.hud({ gameId: GAME, title: 'Warung Kembalian', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: buildLevel });
  // Captions show "Rp7.000" while speech says "tujuh ribu rupiah": spoken -> caption map.
  const CAP = {};
  if (typeof GS._bubble === 'function') { const ob = GS._bubble; GS._bubble = t => ob(CAP[t] || t); }
  function say(cap, spoken) { if (spoken && spoken !== cap) CAP[spoken] = cap; GS.say(spoken || cap); }
  function mood(m) { try { hud.mood(m); } catch (e) { /* no mascot */ } }

  const bg = el('g', { class: 'bg' }, svg);
  const personLayer = el('g', { class: 'people' }, svg);
  const counterLayer = el('g', { class: 'counter' }, svg);
  const world = el('g', { class: 'world' }, svg);
  const dragLayer = el('g', { class: 'drag' }, svg);
  const measure = el('g', { opacity: 0, 'pointer-events': 'none' }, svg);
  let L = {};
  const S = { gen: 0, timers: [] };

  /* ============================== small helpers ============================== */
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return `M${n1(x + r)} ${n1(y)}H${n1(x + w - r)}A${r} ${r} 0 0 1 ${n1(x + w)} ${n1(y + r)}V${n1(y + h - r)}A${r} ${r} 0 0 1 ${n1(x + w - r)} ${n1(y + h)}H${n1(x + r)}A${r} ${r} 0 0 1 ${n1(x)} ${n1(y + h - r)}V${n1(y + r)}A${r} ${r} 0 0 1 ${n1(x + r)} ${n1(y)}Z`;
  }
  const circ = (cx, cy, r) => `M${n1(cx - r)} ${n1(cy)}A${r} ${r} 0 1 0 ${n1(cx + r)} ${n1(cy)}A${r} ${r} 0 1 0 ${n1(cx - r)} ${n1(cy)}Z`;
  /** Kampung Chunky fill as markup: base, bottom-right shade crescent, top-left highlight, outline. c = [base, hl, shade]. */
  function f3s(d, c, o) {
    o = o || {};
    const id = uid('c'), off = o.off == null ? 5 : o.off;
    let s = `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><path d="${d}" fill="${c[2]}"/><path d="${d}" fill="${c[0]}" transform="translate(${-off} ${-off})"/>`;
    if (o.hl) s += `<ellipse cx="${n1(o.hl[0])}" cy="${n1(o.hl[1])}" rx="${n1(o.hl[2])}" ry="${n1(o.hl[3])}" fill="${c[1]}" opacity=".85" transform="rotate(-24 ${n1(o.hl[0])} ${n1(o.hl[1])})"/>`;
    if (o.inner) s += o.inner;
    s += `</g>`;
    if (o.ol !== false) s += `<path d="${d}" fill="none" stroke="${OL}" stroke-width="${o.sw || 4}" stroke-linejoin="round" stroke-linecap="round"/>`;
    return s;
  }
  function tS(x, y, s, size, fill, o) {
    o = o || {};
    return `<text x="${n1(x)}" y="${n1(y)}" font-size="${size}" fill="${fill || INK}" text-anchor="${o.anchor || 'middle'}" dominant-baseline="central"${o.cls ? ` class="${o.cls}"` : ''}${o.halo ? ` stroke="${o.halo}" stroke-width="${o.hw || 6}" paint-order="stroke" stroke-linejoin="round"` : ''}${o.decor ? ' data-qc="decor"' : ''}>${s}</text>`;
  }
  function txt(parent, x, y, s, o) {
    o = o || {};
    const t = el('text', {
      x: n1(x), y: n1(y), 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'central', 'font-size': o.size || 40,
      fill: o.fill || INK, class: o.cls || null, stroke: o.halo || null, 'stroke-width': o.halo ? (o.hw || 7) : null,
      'paint-order': o.halo ? 'stroke' : null, 'stroke-linejoin': o.halo ? 'round' : null
    }, parent);
    t.textContent = s;
    return t;
  }
  const shadowS = (cx, cy, rx, op) => `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(Math.max(4, rx * 0.2))}" fill="${OL}" opacity="${op || 0.18}"/>`;
  function alive(gen) { if (gen !== S.gen) throw ABORT; }
  const ABORT = { abort: true };
  function pause(ms, gen) { return new Promise(res => { S.timers.push(setTimeout(res, T(ms))); }).then(() => alive(gen)); }
  const tween = (ms, fn, ease) => GS.tween(T(ms), fn, ease);
  function ctm(g) { const a = svg.getScreenCTM(), b = g.getScreenCTM(); return a && b ? a.inverse().multiply(b) : null; }
  function toSvg(g, x, y) { const m = ctm(g); return m ? { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f } : { x, y }; }
  function clientOf(x, y) { const m = svg.getScreenCTM(); return m ? { x: m.a * x + m.e, y: m.d * y + m.f } : { x: innerWidth / 2, y: innerHeight / 2 }; }

  /* ============================== money art ============================== */
  function kawung(cx, cy, r, c, op) {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const a = i * 90 + 45;
      s += `<ellipse cx="${n1(cx)}" cy="${n1(cy - r * 0.5)}" rx="${n1(r * 0.28)}" ry="${n1(r * 0.48)}" fill="${c}" opacity="${op}" transform="rotate(${a} ${n1(cx)} ${n1(cy)})"/>`;
    }
    return s + `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r * 0.16)}" fill="${c}" opacity="${op}"/>`;
  }
  function noteArt(d) {
    const W = NW, H = NH, x = -W / 2, y = -H / 2, c = d.col;
    let inner = `<rect x="${x + 9}" y="${y + 9}" width="${W - 18}" height="${H - 18}" rx="7" fill="none" stroke="${d.ink}" stroke-width="2" opacity=".32"/>`;
    inner += `<path d="M${x + 12} ${y + H - 18}q14 -8 28 0t28 0t28 0t28 0t28 0t28 0t28 0" fill="none" stroke="${d.ink}" stroke-width="2" opacity=".18"/>`;
    inner += `<path d="M${x + 12} ${y + 19}q14 -8 28 0t28 0t28 0t28 0t28 0t28 0t28 0" fill="none" stroke="${d.ink}" stroke-width="2" opacity=".14"/>`;
    inner += `<circle cx="${x + 30}" cy="${y + 28}" r="17" fill="${c[1]}" opacity=".9"/>` + kawung(x + 30, y + 28, 15, d.ink, 0.4);
    inner += kawung(x + W - 24, y + H - 24, 12, d.ink, 0.22);
    let s = f3s(rr(x, y, W, H, 11), c, { off: 5, hl: [x + 46, y + 16, 30, 7], sw: 3.6, inner });
    s += tS(10, 3, fmt(d.v), d.fs, d.ink, { halo: c[1], hw: 7 });
    return s;
  }
  function coinArt(d) {
    const r = d.r, m = d.metal === 'bi' ? METAL.silver : METAL[d.metal];
    let s = f3s(circ(0, 0, r), m, { off: r * 0.1, hl: [-r * 0.38, -r * 0.42, r * 0.3, r * 0.14], sw: 3.6 });
    if (d.metal === 'bi') s += f3s(circ(0, 0, r * 0.7), METAL.gold, { off: r * 0.07, sw: 2.4 });
    s += `<circle r="${n1(r - 7)}" fill="none" stroke="${d.ink}" stroke-width="2" opacity=".3"/>`;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; s += `<circle cx="${n1(Math.cos(a) * (r - 3.5))}" cy="${n1(Math.sin(a) * (r - 3.5))}" r="1.4" fill="${d.ink}" opacity=".25"/>`; }
    if (d.dot) {
      s += `<circle cx="0" cy="${n1(-r * 0.47)}" r="12" fill="${INK}"/><circle cx="-3.5" cy="${n1(-r * 0.47 - 4)}" r="3" fill="#fff" opacity=".7"/>`;
      s += tS(0, r * 0.2, fmt(d.v), d.fs, d.ink);
    } else s += tS(0, 2, fmt(d.v), d.fs, d.ink, { halo: d.metal === 'gold' ? '#F5DE95' : '#EEF1F4', hw: 5 });
    return s;
  }
  const moneyArt = key => (DEN[key].coin ? coinArt(DEN[key]) : noteArt(DEN[key]));
  const pieceH = key => (DEN[key].coin ? DEN[key].r * 2 : NH);
  const pieceW = key => (DEN[key].coin ? DEN[key].r * 2 : NW);
  const traySc = key => (DEN[key].coin ? (DEN[key].dot ? 0.94 : 1) : TRAY_NOTE);
  /** A small coin glyph for the TK price tags: one glyph per coin to pay. */
  const coinDot = (x, y, r) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${r}" fill="#E6EAEE" stroke="${OL}" stroke-width="3"/><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r * 0.42)}" fill="${INK}"/>`;

  /* ============================== items ============================== */
  const LABEL = { permen: 'permen', pensil: 'pensil', botol: 'minuman', es: 'es batu', karung: 'beras', keranjang: 'parsel buah', tampah: 'tampah' };
  const CUSTOM = {
    permen() {
      return `<path d="M-24 -32L-48 -50Q-52 -32 -48 -14Z" fill="#F59AB0" stroke="${OL}" stroke-width="3.4" stroke-linejoin="round"/>` +
        `<path d="M24 -32L48 -50Q52 -32 48 -14Z" fill="#F59AB0" stroke="${OL}" stroke-width="3.4" stroke-linejoin="round"/>` +
        `<path d="M-44 -44L-44 -20M38 -44L38 -20" stroke="#D9708C" stroke-width="2.4" stroke-linecap="round"/>` +
        f3s(`M-27 -32A27 22 0 1 0 27 -32A27 22 0 1 0 -27 -32Z`, ['#E2453C', '#F27A6E', '#B5322B'], {
          off: 4, hl: [-12, -42, 9, 4], sw: 3.6,
          inner: `<path d="M-14 -52Q-2 -32 -14 -12M2 -54Q14 -32 2 -10M18 -50Q28 -32 18 -14" fill="none" stroke="#FFF3E0" stroke-width="5" stroke-linecap="round" opacity=".9"/>`
        }) + `<circle cx="-10" cy="-42" r="2.6" fill="#fff"/>`;
    },
    pensil() {
      return f3s('M-11 -98L11 -98L11 -16L-11 -16Z', ['#FFC83D', '#FFE08A', '#E09A00'], {
        off: 3, sw: 3, inner: `<path d="M-3.5 -98V-16M3.5 -98V-16" stroke="#E09A00" stroke-width="2"/>`
      }) + `<path d="M-11 -98L0 -124L11 -98Z" fill="#F2D2A0" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>` +
        `<path d="M-4.2 -114L0 -124L4.2 -114Z" fill="#3E3A38" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>` +
        `<rect x="-11.5" y="-18" width="23" height="9" fill="#C9CED3" stroke="${OL}" stroke-width="3"/>` +
        `<path d="M-11 -9H11V-4Q11 0 7 0H-7Q-11 0 -11 -4Z" fill="#F59AB0" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>`;
    }
  };
  function itemMarkup(name) {
    if (CUSTOM[name]) return CUSTOM[name]();
    try { if (GS.art && GS.art.item) return GS.art.item(name, { shadow: false }); } catch (e) { /* fall through */ }
    return `<circle cx="0" cy="-30" r="28" fill="#E9DCC6" stroke="${OL}" stroke-width="4"/>`;
  }
  const boxCache = {};
  function itemBox(name) {
    if (boxCache[name]) return boxCache[name];
    const g = el('g', null, measure);
    GS.markup(g, itemMarkup(name));
    let b = null;
    try { b = g.getBBox(); } catch (e) { b = null; }
    measure.removeChild(g);
    if (!b || !b.width || !b.height) b = { x: -30, y: -60, width: 60, height: 60 };
    return (boxCache[name] = { x: b.x, y: b.y, width: b.width, height: b.height });
  }
  /** Item art with its bottom-centre at (x, y), fitted into h x wMax. Returns {g, inner, w, h}. */
  function itemG(parent, name, h, x, y, wMax, noShadow) {
    const b = itemBox(name), sc = Math.min(h / b.height, (wMax || 1e9) / b.width);
    const g = el('g', { transform: `translate(${n1(x)} ${n1(y)})` }, parent);
    if (!noShadow) GS.markup(g, shadowS(0, 0, b.width * sc * 0.42));
    const inner = el('g', null, g);
    const a = el('g', { transform: `scale(${n1(sc * 1000) / 1000}) translate(${n1(-(b.x + b.width / 2))} ${n1(-(b.y + b.height))})` }, inner);
    GS.markup(a, itemMarkup(name));
    return { g, inner, w: b.width * sc, h: b.height * sc, x, y };
  }
  function personMarkup(i) {
    try { if (GS.art && GS.art.person) return GS.art.person(i, { shadow: false }); } catch (e) { /* fall through */ }
    return `<circle cx="0" cy="-76" r="18" fill="#E3AE82" stroke="${OL}" stroke-width="3"/><rect x="-15" y="-58" width="30" height="56" rx="10" fill="#2F80C9" stroke="${OL}" stroke-width="3"/>`;
  }

  /* ============================== static scene ============================== */
  function drawStatic() {
    let s = '';
    try { s += GS.art.scene('kampung', 1280, 800); } catch (e) { s += `<rect x="-600" y="0" width="2480" height="800" fill="#9ED8EC"/>`; }
    // inside of the warung: back posts left and right of the serving window
    [[-330, 70], [1540, 70]].forEach(([x, w]) => { s += f3s(rr(x, 30, w, 380, 6), ['#A8673A', '#C68654', '#7E4A27'], { off: 6, sw: 4 }); });
    // striped awning with a scalloped valance
    let st = '';
    for (let x = -600, i = 0; x < 1880; x += 80, i++) st += `<rect x="${x}" y="0" width="80" height="46" fill="${i % 2 ? '#FFF3E0' : '#E2453C'}"/>`;
    s += st + `<path d="M-600 46H1880" stroke="${OL}" stroke-width="4"/>`;
    for (let x = -600, i = 0; x < 1880; x += 80, i++) s += `<path d="M${x} 46a40 22 0 0 0 80 0Z" fill="${i % 2 ? '#FFF3E0' : '#E2453C'}" stroke="${OL}" stroke-width="3.4" stroke-linejoin="round"/>`;
    // hanging sachets (renceng) and a bunch of bananas: decoration only
    const renceng = (x, n, c1, c2) => {
      let r = `<path d="M${x} 52V${70}" stroke="${OL}" stroke-width="3"/>`;
      for (let i = 0; i < n; i++) r += `<rect x="${x - 17}" y="${70 + i * 30}" width="34" height="28" rx="4" fill="${i % 2 ? c2 : c1}" stroke="${OL}" stroke-width="2.6"/><rect x="${x - 9}" y="${78 + i * 30}" width="18" height="10" rx="3" fill="#FFF8EC" opacity=".8"/>`;
      return `<g class="km-sway">${r}</g>`;
    };
    s += `<g>${renceng(1222, 3, '#2F80C9', '#FFC83D')}</g><g>${renceng(1262, 2, '#E2453C', '#4DAA57')}</g><g>${renceng(-60, 4, '#F28C28', '#4DAA57')}</g><g>${renceng(-110, 3, '#2F80C9', '#F59AB0')}</g>`;
    bg.innerHTML = '';
    GS.markup(bg, s);

    // the counter: top seen from above, a dark lip, then the plank front
    let c = '';
    c += `<rect x="-600" y="${G.counterY}" width="2480" height="${G.lipY - G.counterY}" fill="#C98B55"/>`;
    c += `<rect x="-600" y="${G.counterY}" width="2480" height="14" fill="#DDA774"/>`;
    [452, 506, 556].forEach(y => { c += `<path d="M-600 ${y}H1880" stroke="#A8673A" stroke-width="3" opacity=".55"/>`; });
    for (let x = -560, i = 0; x < 1880; x += 260, i++) c += `<path d="M${x + (i % 2) * 90} ${452 + (i % 3) * 52}v${i % 2 ? 54 : 50}" stroke="#A8673A" stroke-width="3" opacity=".45"/>`;
    c += `<path d="M-600 ${G.counterY}H1880" stroke="${OL}" stroke-width="4"/>`;
    c += `<rect x="-600" y="${G.lipY}" width="2480" height="20" fill="#8A5530"/><path d="M-600 ${G.lipY}H1880" stroke="${OL}" stroke-width="4"/>`;
    c += `<rect x="-600" y="${G.lipY + 20}" width="2480" height="${800 - G.lipY}" fill="#A8673A"/>`;
    for (let x = -600; x < 1880; x += 110) c += `<path d="M${x} ${G.lipY + 22}V800" stroke="#7E4A27" stroke-width="3" opacity=".5"/>`;
    // glass jars of sweets on the far ends (only visible on wide screens)
    [-210, -420, 1490, 1700].forEach((x, i) => { c += jar(x, G.counterY + 150, ['#E2453C', '#FFC83D', '#4DAA57', '#F59AB0'][i]); });
    counterLayer.innerHTML = '';
    GS.markup(counterLayer, c);
  }
  function jar(x, y, c) {
    let s = shadowS(x, y, 60);
    s += `<path d="M${x - 52} ${y - 120}Q${x - 58} ${y - 8} ${x - 40} ${y - 2}H${x + 40}Q${x + 58} ${y - 8} ${x + 52} ${y - 120}Z" fill="#DFF3F8" opacity=".85" stroke="${OL}" stroke-width="3.6" stroke-linejoin="round"/>`;
    for (let i = 0; i < 7; i++) s += `<circle cx="${x - 30 + (i % 4) * 20 + (i > 3 ? 10 : 0)}" cy="${y - 22 - (i > 3 ? 22 : 0)}" r="11" fill="${i % 2 ? c : '#FFF3E0'}" stroke="${OL}" stroke-width="2.4"/>`;
    s += f3s(rr(x - 46, y - 146, 92, 28, 8), ['#E2453C', '#F27A6E', '#B5322B'], { off: 3, sw: 3.4 });
    s += `<path d="M${x - 34} ${y - 104}Q${x - 38} ${y - 50} ${x - 30} ${y - 30}" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none" opacity=".75"/>`;
    return s;
  }

  /* ============================== level scaffolding ============================== */
  function cleanup() {
    S.gen++;
    (S.timers || []).forEach(t => clearTimeout(t));
    world.innerHTML = '';
    dragLayer.innerHTML = '';
    personLayer.innerHTML = '';
    dock.innerHTML = '';
    Object.assign(S, {
      timers: [], busy: false, over: false, tries: 0, notMinimal: false, money: null, tray: [], cells: {},
      solver: null, drag: null, dockMode: null, round: 0, rounds: [], live: false, roundFails: 0,
      person: null, items: [], qtyN: 0, strip: null, marks: [], selected: null
    });
    L = {
      pips: el('g', null, world), bubble: el('g', null, world), mat: el('g', null, world),
      items: el('g', null, world), trayArt: el('g', null, world), trayPieces: el('g', null, world),
      badges: el('g', null, world), marks: el('g', null, world), strip: el('g', null, world),
      cards: el('g', null, world), drawer: el('g', null, world), fx: el('g', null, world)
    };
  }
  let LV = null;
  function buildLevel(i) {
    cleanup();
    LV = LEVELS[i];
    S.rounds = LV.rounds();
    mood('happy');
    playLevel(S.gen);
  }
  async function playLevel(gen) {
    try {
      for (let r = 0; r < S.rounds.length; r++) {
        S.round = r; S.roundFails = 0; S.live = false;
        renderPips();
        await playRound(S.rounds[r], r, gen);
      }
      alive(gen);
      renderPips(true);
      finish();
    } catch (e) { if (e !== ABORT) throw e; }
  }
  function renderPips(all) {
    L.pips.innerHTML = '';
    const n = S.rounds.length;
    if (n < 2) return;
    for (let i = 0; i < n; i++) {
      const x = G.person.x + (i - (n - 1) / 2) * 40, done = all || i < S.round, cur = !all && i === S.round;
      el('circle', { cx: x, cy: 76, r: cur ? 14 : 11, fill: done ? TEAL : cur ? '#FFC83D' : CREAM, stroke: OL, 'stroke-width': 3.4 }, L.pips);
    }
  }
  function finish() {
    S.over = true;
    S.solver = null;
    dockRender();
    let stars = S.tries === 0 ? 3 : S.tries <= 2 ? 2 : 1;
    if (S.notMinimal) stars = Math.min(stars, 2);
    mood('cheer');
    const text = stars === 3 ? pick1(['Warungnya laris! Semua uangnya pas.', 'Hebat! Hitunganmu pas semua.']) : stars === 2 ? 'Bagus! Uangnya pas.' : 'Berhasil! Ayo main lagi.';
    const g = S.gen;
    setTimeout(() => { if (g === S.gen) run.win(stars, text); }, T(700));
  }
  function fail() {
    S.tries++; S.roundFails++;
    if (S.roundFails >= 2) S.live = true;
  }

  /* ============================== rounds ============================== */
  async function playRound(R, r, gen) {
    const prev = S.person;
    if (!prev || prev.idx !== R.person) {
      if (prev) await personLeave(gen);
      await personEnter(R.person, gen);
    }
    clearRoundBits();
    if (R.kids) drawKids(R.kids);
    showBubble(R);
    showItems(R.items, R.qtyItem);
    if (R.paid) showPaid(R.paid);
    say(r === 0 ? LV.say : (R.say || defaultSay(R)), r === 0 ? LV.spoken : R.spoken);
    if (R.pick) { await pickPhase(R, gen); alive(gen); }
    await moneyPhase(R, gen);
    alive(gen);
    await roundSuccess(R, gen);
  }
  function defaultSay(R) {
    if (R.type === 'pay') return TK ? 'Bayar dengan koin yang pas.' : 'Bayar pas, ya.';
    if (R.type === 'share') return 'Bagi uangnya sama rata.';
    return 'Berikan kembaliannya.';
  }
  function clearRoundBits() {
    ['bubble', 'mat', 'items', 'trayArt', 'trayPieces', 'badges', 'marks', 'strip', 'cards', 'drawer', 'fx'].forEach(k => { L[k].innerHTML = ''; });
    S.tray = []; S.cells = {}; S.money = null; S.strip = null; S.items = []; S.qtyN = 0; S.paidEls = [];
    personLayer.querySelectorAll('.km-kid').forEach(k => k.remove());
  }

  /* ---------- the person across the counter ---------- */
  function personEnter(idx, gen) {
    const p = { idx };
    p.g = el('g', { transform: `translate(1560 ${G.person.y})` }, personLayer);
    p.hop = el('g', null, p.g);
    p.lean = el('g', null, p.hop);
    p.breath = el('g', { class: 'km-breathe' }, p.lean);
    const a = el('g', { transform: `scale(${G.person.s})` }, p.breath);
    GS.markup(a, personMarkup(idx));
    p.x = 1560;
    S.person = p;
    GS.sfx.whoosh();
    return tween(620, (e, t) => {
      p.x = lerp(1560, G.person.x, e);
      const bob = GS.reducedMotion ? 0 : -Math.abs(Math.sin(t * Math.PI * 4)) * 14 * (1 - t);
      p.g.setAttribute('transform', `translate(${n1(p.x)} ${n1(G.person.y + bob)})`);
    }, 'outCubic').then(() => alive(gen));
  }
  function personLeave(gen) {
    const p = S.person;
    if (!p) return Promise.resolve();
    S.person = null;
    L.bubble.innerHTML = '';
    return tween(520, (e, t) => {
      const x = lerp(G.person.x, 1600, e), bob = GS.reducedMotion ? 0 : -Math.abs(Math.sin(t * Math.PI * 4)) * 14;
      p.g.setAttribute('transform', `translate(${n1(x)} ${n1(G.person.y + bob)})`);
    }, 'inCubic').then(() => { p.g.remove(); alive(gen); });
  }
  function personHop(times) {
    const p = S.person;
    if (!p || GS.reducedMotion) return;
    tween(300 * (times || 2), (e, t) => {
      const y = -Math.abs(Math.sin(t * Math.PI * (times || 2))) * 26 * (1 - t * 0.4);
      p.hop.setAttribute('transform', `translate(0 ${n1(y)})`);
    }, 'linear');
  }
  function personLean(deg, ms) {
    const p = S.person;
    if (!p) return;
    const piv = -90;
    tween(ms || 800, (e, t) => {
      const a = deg * Math.sin(t * Math.PI);
      p.lean.setAttribute('transform', `rotate(${n1(a)} 0 ${piv})`);
    }, 'linear');
  }
  function thought(text) {
    const p = S.person;
    if (!p) return;
    const g = el('g', { transform: `translate(${G.person.x + 112} 200)` }, L.fx);
    GS.markup(g, `<circle cx="-62" cy="56" r="8" fill="#fff" stroke="${OL}" stroke-width="3"/><circle cx="-44" cy="36" r="12" fill="#fff" stroke="${OL}" stroke-width="3"/>` +
      `<path d="${rr(-46, -38, 92, 64, 30)}" fill="#fff" stroke="${OL}" stroke-width="3.4"/>`);
    txt(g, 0, -6, text, { size: 44, cls: 'km-disp' });
    S.timers.push(setTimeout(() => g.remove(), T(2600)));
  }
  function sparkle(x, y, n) {
    if (GS.reducedMotion) return;
    for (let i = 0; i < (n || 5); i++) {
      const a = (i / (n || 5)) * Math.PI * 2, g = el('g', null, L.fx);
      GS.markup(g, `<path d="M0 -14Q3 -3 14 0Q3 3 0 14Q-3 3 -14 0Q-3 -3 0 -14Z" fill="#FFC83D" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/>`);
      tween(700, e => {
        g.setAttribute('transform', `translate(${n1(x + Math.cos(a) * 80 * e)} ${n1(y + Math.sin(a) * 60 * e - 30 * e)}) scale(${n1(1 - e * 0.6)})`);
        g.setAttribute('opacity', n1(1 - e * e));
      }).then(() => g.remove());
    }
  }
  function drawKids(n) {
    const xs = matRects(n).map(m => m.x + m.w / 2);
    const idxs = GS.shuffle([0, 3, 6, 7, 2, 5]).slice(0, n);
    xs.forEach((x, i) => {
      const g = el('g', { class: 'km-kid', transform: `translate(${n1(x)} ${G.tray.y + 72}) scale(1.6)` }, personLayer);
      const b = el('g', { class: 'km-breathe' }, g);
      GS.markup(b, personMarkup(idxs[i]));
    });
  }

  /* ---------- speech bubble: what is bought and for how much ---------- */
  function showBubble(R, rowsOverride) {
    L.bubble.innerHTML = '';
    const rows = rowsOverride || R.bubble || R.items.map(it => TK ? { item: it.name, dots: Math.round(it.price / 1000) } : { item: it.name, text: (it.qty > 1 ? it.qty + ' × ' : '') + rp(it.price) });
    if (!rows.length) return;
    const B = G.bubble, rowH = TK ? 84 : 62, h = 32 + rows.length * rowH, x = B.x, y = Math.max(80, 292 - h), w = B.w;
    const g = el('g', { transform: `translate(${x + w} ${y + h * 0.6})` }, L.bubble);
    const inner = el('g', null, g);
    const body = el('g', { transform: `translate(${-w} ${-h * 0.6})` }, inner);
    GS.markup(body, `<path d="M${w - 14} ${n1(h * 0.42)}L${w + 66} ${n1(h * 0.62)}L${w - 18} ${n1(h * 0.78)}Z" fill="#fff" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="${rr(0, 0, w, h, 26)}" fill="#fff" stroke="${OL}" stroke-width="4"/><path d="M${w - 20} ${n1(h * 0.45)}L${w - 20} ${n1(h * 0.75)}" stroke="#fff" stroke-width="8"/>`);
    rows.forEach((row, i) => {
      const cy = 16 + rowH * i + rowH / 2;
      let tx = 30;
      if (row.item) { itemG(body, row.item, TK ? 72 : 54, TK ? 66 : 56, cy + (TK ? 36 : 27), TK ? 96 : 70, true); tx = TK ? 128 : 104; }
      if (row.money) { const m = el('g', { transform: `translate(${row.coin ? 58 : 66} ${cy}) scale(${row.coin ? 0.5 : 0.48})` }, body); GS.markup(m, moneyArt(row.money)); tx = 126; }
      if (row.dots) { let s = ''; for (let k = 0; k < row.dots; k++) s += coinDot(tx + 28 + k * 60, cy, 25); GS.markup(body, s); }
      if (row.text) txt(body, tx, cy + 2, row.text, { size: row.small ? 32 : 44, anchor: 'start', cls: row.small ? 'km-body' : null });
    });
    tween(360, e => inner.setAttribute('transform', `scale(${n1((0.4 + 0.6 * e) * 100) / 100})`), 'outBack');
    GS.sfx.pop();
  }

  /* ---------- items on the counter, in front of the person ---------- */
  function showItems(list, qtyItem) {
    L.items.innerHTML = '';
    S.items = [];
    const n = list.length;
    if (!n) return;
    const X0 = G.items.x0, X1 = G.items.x1, slot = (X1 - X0) / Math.max(n, 1);
    list.forEach((it, i) => {
      const cx = X0 + slot * (i + 0.5), q = it.qty || 1;
      const holder = { it, els: [], g: el('g', null, L.items), cx };
      if (q === 1) holder.els.push(itemG(holder.g, it.name, Math.min(118, 40 + slot * 0.55), cx, G.items.y, slot - 16));
      else {
        const cols = Math.min(q, q > 8 ? 5 : 4), rows = Math.ceil(q / cols), h = Math.min(62, 150 / rows), sp = Math.min((slot - 20) / cols, h * 0.9);
        for (let k = 0; k < q; k++) {
          const r = Math.floor(k / cols), c = k % cols, inRow = Math.min(cols, q - r * cols);
          holder.els.push(itemG(holder.g, it.name, h, cx + (c - (inRow - 1) / 2) * sp + (r % 2) * 6, G.items.y - (rows - 1 - r) * h * 0.62, sp * 1.1, r < rows - 1));
        }
      }
      S.items.push(holder);
    });
  }

  /* ---------- the customer's money, kept on a cloth beside the tray ---------- */
  function showPaid(keys) {
    L.mat.innerHTML = '';
    const M = G.mat;
    GS.markup(L.mat, shadowS(M.x + M.w / 2, M.y + M.h - 2, M.w * 0.48) + f3s(rr(M.x, M.y, M.w, M.h, 22), ['#F3DDA6', '#FBEFCF', '#D9BC7C'], {
      off: 6, sw: 3.6, inner: `<path d="${rr(M.x + 10, M.y + 10, M.w - 20, M.h - 20, 16)}" fill="none" stroke="#C8643B" stroke-width="3" stroke-dasharray="10 8" opacity=".6"/>`
    }));
    txt(L.mat, M.x + M.w / 2, M.y + 30, 'Uang pembeli', { size: 30, cls: 'km-body', fill: '#6B4A20' });
    S.paidEls = [];
    const keysSorted = keys.slice().sort((a, b) => DEN[b].v - DEN[a].v), n = keysSorted.length;
    const dx = n > 1 ? Math.min(16, (M.w - 30 - NW * 0.8) / (n - 1)) : 0;
    keysSorted.forEach((k, i) => {
      const g = el('g', { transform: `translate(${n1(M.x + M.w / 2 - (n - 1) * dx / 2 + i * dx)} ${n1(M.y + 110 - (n - 1) * 3 + i * 6)}) scale(0.8)` }, L.mat);
      GS.markup(g, moneyArt(k));
      S.paidEls.push(g);
    });
    if (n > 1) badge(L.mat, M.x + M.w - 22, M.y + 64, '×' + n);
  }
  function badge(parent, x, y, s) {
    const g = el('g', { transform: `translate(${n1(x)} ${n1(y)})` }, parent);
    GS.markup(g, `<circle r="27" fill="${TEAL}" stroke="${OL}" stroke-width="3.4"/>`);
    txt(g, 0, 1, s, { size: 36, fill: '#fff' });
    return g;
  }

  /* ============================== the drawer (laci) / wallet (dompet) ============================== */
  function drawDrawer(keys, skin) {
    L.drawer.innerHTML = '';
    S.cells = {};
    const D = G.drawer, ks = keys.slice().sort((a, b) => DEN[a].v - DEN[b].v), n = ks.length;
    const rows = n > 4 ? 2 : 1, perRow = rows === 2 ? Math.ceil(n / 2) : n;
    const cw = 205, ch = rows === 2 ? 104 : 186, gap = 4;
    const laci = skin !== 'dompet';
    // box
    if (laci) {
      GS.markup(L.drawer, f3s(rr(D.x, D.y, D.w, D.h + 20, 14), ['#8A5530', '#A8703E', '#6B3F22'], { off: 6, sw: 4 }) +
        `<rect x="${D.x + 300}" y="${D.y + 4}" width="${D.w - 600}" height="4" rx="2" fill="#C68654" opacity=".6"/>`);
    } else {
      GS.markup(L.drawer, f3s(rr(D.x, D.y, D.w, D.h + 20, 26), ['#2F80C9', '#6FAEE3', '#215F98'], {
        off: 7, sw: 4, inner: kawungField(D.x, D.y, D.w, D.h + 20)
      }) + `<path d="M${D.x + 30} ${D.y + 5}H${D.x + D.w - 30}" stroke="#D9A441" stroke-width="5" stroke-dasharray="4 4"/>`);
    }
    const totW = perRow * cw + (perRow - 1) * gap, x0 = D.x + (D.w - totW) / 2, y0 = D.y + (rows === 2 ? 2 : 14);
    ks.forEach((k, i) => {
      const r = rows === 2 ? Math.floor(i / perRow) : 0, c = rows === 2 ? i % perRow : i;
      const rowN = rows === 2 ? (r === 0 ? perRow : n - perRow) : n;
      const rowW = rowN * cw + (rowN - 1) * gap, rx0 = D.x + (D.w - rowW) / 2;
      const cell = { key: k, x: (rows === 2 ? rx0 : x0) + c * (cw + gap) + cw / 2, y: y0 + r * (ch + gap) + ch / 2, w: cw, h: ch };
      cell.g = el('g', { class: 'km-cell', 'data-key': k, transform: `translate(${n1(cell.x)} ${n1(cell.y)})` }, L.drawer);
      GS.markup(cell.g, laci
        ? `<path d="${rr(-cw / 2 + 4, -ch / 2 + 4, cw - 8, ch - 8, 10)}" fill="#5A3720" stroke="${OL}" stroke-width="3"/><path d="M${-cw / 2 + 10} ${-ch / 2 + 9}H${cw / 2 - 10}" stroke="#3E2414" stroke-width="5" opacity=".6"/>`
        : `<path d="${rr(-cw / 2 + 4, -ch / 2 + 4, cw - 8, ch - 8, 14)}" fill="#FFF3E0" stroke="${OL}" stroke-width="3"/><path d="M${-cw / 2 + 12} ${-ch / 2 + 12}H${cw / 2 - 12}" stroke="#E0C49A" stroke-width="4" stroke-dasharray="6 6"/>`);
      const sc = DEN[k].coin ? Math.min(1, (ch + 8) / pieceH(k)) : 1;
      const copies = rows === 2 ? 2 : 3;
      for (let j = copies - 1; j >= 0; j--) {
        const dx = DEN[k].coin ? (j - (copies - 1) / 2) * (rows === 2 ? 8 : 26) : j * 4, dy = DEN[k].coin ? (rows === 2 ? 0 : (j - 1) * -14) : -j * 5;
        const cg = el('g', { transform: `translate(${n1(dx)} ${n1(dy + (rows === 2 ? 0 : 4))}) scale(${sc})`, opacity: j ? 0.9 : 1 }, cell.g);
        GS.markup(cg, moneyArt(k));
        if (j) cg.querySelectorAll('text').forEach(t => t.setAttribute('data-qc', 'decor'));
      }
      el('rect', { x: -cw / 2, y: -ch / 2, width: cw, height: ch, fill: 'transparent' }, cell.g);
      GS.drag(cell.g, { svg, onStart: p => cellStart(cell, p), onMove: p => dragMove(p), onEnd: p => dragEnd(p) });
      S.cells[k] = cell;
    });
  }
  function kawungField(x, y, w, h) {
    const id = uid('p'), sz = 34;
    return `<pattern id="${id}" width="${sz}" height="${sz}" patternUnits="userSpaceOnUse">${kawung(sz / 2, sz / 2, 12, '#FFF8EC', 1)}</pattern><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id})" opacity=".14"/>`;
  }
  function drawerEnabled(on) {
    L.drawer.querySelectorAll('.km-shut').forEach(x => x.remove());
    L.drawer.style.pointerEvents = on ? '' : 'none';
    if (!on) { const D = G.drawer; el('path', { class: 'km-shut', d: rr(D.x, D.y, D.w, D.h + 20, 20), fill: OL, opacity: 0.38 }, L.drawer); }
  }

  /* ============================== pieces ============================== */
  function makePiece(key, locked) {
    const pc = { key, v: DEN[key].v, coin: !!DEN[key].coin, x: 0, y: 0, sc: 1, lift: 1, sx: 1, sy: 1, mat: 0, locked: !!locked };
    pc.g = el('g', { class: 'km-piece' + (locked ? ' locked' : '') });
    pc.shadow = el('ellipse', { cx: 0, cy: pieceH(key) / 2 + 26, rx: pieceW(key) * 0.42, ry: 12, fill: OL, opacity: 0 }, pc.g);
    pc.inner = el('g', null, pc.g);
    GS.markup(pc.inner, moneyArt(key));
    if (locked) GS.markup(pc.inner, `<path d="${rr(-pieceW(key) / 2, -pieceH(key) / 2, pieceW(key), pieceH(key), pc.coin ? pieceH(key) / 2 : 11)}" fill="#3B2A20" opacity=".12"/>`);
    const hw = pc.coin ? Math.max(110, pieceW(key) + 10) : NW + 10, hh = pc.coin ? Math.max(110, pieceH(key) + 10) : 112;
    el('rect', { x: -hw / 2, y: -hh / 2, width: hw, height: hh, fill: 'transparent' }, pc.inner);
    if (!locked) GS.drag(pc.g, { svg, onStart: p => pieceStart(pc, p), onMove: p => dragMove(p), onEnd: p => dragEnd(p) });
    return pc;
  }
  function setPos(pc) { pc.g.setAttribute('transform', `translate(${n1(pc.x)} ${n1(pc.y)})`); }
  function setScale(pc) { const s = pc.sc * pc.lift; pc.inner.setAttribute('transform', `scale(${(s * pc.sx).toFixed(3)} ${(s * pc.sy).toFixed(3)})`); }
  function moveTo(pc, x, y, dur, ease) {
    const tok = pc.tok = (pc.tok || 0) + 1, x0 = pc.x, y0 = pc.y;
    if (!dur || (Math.abs(x - x0) < 0.5 && Math.abs(y - y0) < 0.5)) { pc.x = x; pc.y = y; setPos(pc); return Promise.resolve(); }
    return tween(dur, e => { if (pc.tok !== tok) return; pc.x = x0 + (x - x0) * e; pc.y = y0 + (y - y0) * e; setPos(pc); }, ease || 'outCubic');
  }
  function scaleTo(pc, sc, dur) {
    const s0 = pc.sc;
    if (!dur) { pc.sc = sc; setScale(pc); return; }
    tween(dur, e => { pc.sc = lerp(s0, sc, e); setScale(pc); });
  }
  function squash(pc) {
    const k = pc.coin ? [1.12, 0.9, 0.96, 1.04] : [1.18, 0.86, 0.94, 1.06];
    tween(300, (e, t) => {
      let sx, sy;
      if (t < 0.3) { const u = t / 0.3; sx = lerp(1, k[0], u); sy = lerp(1, k[1], u); }
      else if (t < 0.65) { const u = (t - 0.3) / 0.35; sx = lerp(k[0], k[2], u); sy = lerp(k[1], k[3], u); }
      else { const u = (t - 0.65) / 0.35; sx = lerp(k[2], 1, u); sy = lerp(k[3], 1, u); }
      pc.sx = sx; pc.sy = sy; setScale(pc);
    }, 'linear');
  }
  function popPiece(pc) {
    tween(300, (e, t) => { pc.lift = 1 + Math.sin(t * Math.PI) * 0.16; setScale(pc); }, 'linear');
  }
  const canEdit = () => !!(S.money && !S.busy && !S.over);

  /* ---------- dragging (a tap also works: drawer -> tray, tray -> drawer) ---------- */
  const LIFT = 46;
  function cellStart(cell, p) {
    if (!canEdit()) return false;
    const pc = makePiece(cell.key);
    dragLayer.appendChild(pc.g);
    pc.x = p.x; pc.y = p.y - LIFT; setPos(pc);
    pc.sc = 1; pc.lift = 1.12; setScale(pc);
    pc.shadow.setAttribute('opacity', 0.2);
    S.drag = { pc, from: 'cell', p0: p, t0: performance.now(), moved: false };
    GS.sfx.pick();
    return true;
  }
  function pieceStart(pc, p) {
    if (!canEdit() || pc.locked || S.tray.indexOf(pc) < 0) return false;
    S.tray.splice(S.tray.indexOf(pc), 1);
    const q = toSvg(pc.g.parentNode, pc.x, pc.y);
    dragLayer.appendChild(pc.g);
    pc.tok = (pc.tok || 0) + 1;
    pc.x = q.x; pc.y = q.y; setPos(pc);
    pc.lift = 1.12; setScale(pc);
    pc.shadow.setAttribute('opacity', 0.2);
    S.drag = { pc, from: 'tray', p0: p, t0: performance.now(), moved: false, off: { x: q.x - p.x, y: q.y - p.y } };
    layoutTray(true);
    trayChanged();
    GS.sfx.pick();
    return true;
  }
  function dragMove(p) {
    const d = S.drag;
    if (!d) return;
    if (Math.hypot(p.x - d.p0.x, p.y - d.p0.y) > 14) d.moved = true;
    d.pc.x = p.x; d.pc.y = p.y - LIFT;
    setPos(d.pc);
  }
  function dragEnd(p) {
    const d = S.drag;
    if (!d) return;
    S.drag = null;
    const pc = d.pc;
    pc.shadow.setAttribute('opacity', 0);
    if (!S.money) { pc.g.remove(); return; }
    if (!d.moved) {
      // a tap: drawer -> tray, tray -> back to the drawer
      if (d.from === 'cell') addToTray(pc, tapMat(), true);
      else returnToDrawer(pc);
      return;
    }
    const m = matAt(pc.x, pc.y);
    if (m != null) addToTray(pc, m, true);
    else returnToDrawer(pc);
  }
  function matRects(n) {
    const T0 = G.tray, pad = 14, gap = 10;
    if (!n || n === 1) return [{ x: T0.x + pad, y: T0.y + 10, w: T0.w - 2 * pad, h: T0.h - 20 }];
    const w = (T0.w - 2 * pad - (n - 1) * gap) / n;
    return Array.from({ length: n }, (_, i) => ({ x: T0.x + pad + i * (w + gap), y: T0.y + 10, w, h: T0.h - 20 }));
  }
  function matAt(x, y) {
    const T0 = G.tray;
    if (x < T0.x - 50 || x > T0.x + T0.w + 50 || y < T0.y - 90 || y > T0.y + T0.h + 40) return null;
    const mats = S.money.mats;
    if (mats.length === 1) return 0;
    let best = 0, bd = 1e9;
    mats.forEach((m, i) => { const dd = Math.abs(x - (m.x + m.w / 2)); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }
  /** A tap on the drawer deals onto the mat that has the least so far (one for you, one for you). */
  function tapMat() {
    const mats = S.money.mats;
    if (mats.length === 1) return 0;
    let best = 0, bv = 1e12;
    mats.forEach((m, i) => { const v = S.tray.filter(p => p.mat === i).reduce((a, p) => a + p.v, 0); if (v < bv) { bv = v; best = i; } });
    return best;
  }
  function addToTray(pc, mat, anim) {
    pc.mat = mat;
    S.tray.push(pc);
    const q = pc.g.parentNode ? toSvg(pc.g.parentNode, pc.x, pc.y) : { x: pc.x, y: pc.y };
    L.trayPieces.appendChild(pc.g);
    pc.x = q.x; pc.y = q.y; setPos(pc);
    pc.lift = 1; scaleTo(pc, traySc(pc.key), anim ? 150 : 0);
    layoutTray(anim, pc);
    if (anim) { squash(pc); pc.coin ? GS.sfx.coin() : GS.sfx.drop(); }
    trayChanged();
  }
  function returnToDrawer(pc, quiet) {
    const i = S.tray.indexOf(pc);
    if (i >= 0) S.tray.splice(i, 1);
    const cell = S.cells[pc.key];
    const q = pc.g.parentNode ? toSvg(pc.g.parentNode, pc.x, pc.y) : { x: pc.x, y: pc.y };
    dragLayer.appendChild(pc.g);
    pc.x = q.x; pc.y = q.y; setPos(pc);
    if (!quiet) GS.sfx.pop();
    const tx = cell ? cell.x : G.drawer.x + G.drawer.w / 2, ty = cell ? cell.y : G.drawer.y + 60;
    const p = moveTo(pc, tx, ty, 260, 'inCubic').then(() => pc.g.remove());
    if (quiet !== 'keep') { layoutTray(true); trayChanged(); }
    return p;
  }

  /* ---------- tidy tray layout: groups of the same piece, largest first ---------- */
  function layoutTray(anim, fresh) {
    if (!S.money) return;
    L.badges.innerHTML = '';
    S.money.mats.forEach((m, mi) => {
      const pcs = S.tray.filter(p => p.mat === mi);
      if (TK) layoutRow(pcs, m, anim, fresh);
      else layoutGroups(pcs, m, anim, fresh);
    });
  }
  function slotPositions(n, groups, m) {
    const sp = 116, gapG = 46, gs = groups || [n];
    const tot = n * sp + (gs.length - 1) * gapG;
    const out = [];
    let x = m.x + m.w / 2 - tot / 2 + sp / 2, k = 0;
    gs.forEach((cnt, gi) => { for (let j = 0; j < cnt; j++) { out.push({ x, y: m.y + m.h / 2 + 4 }); x += sp; k++; } x += gi < gs.length - 1 ? gapG : 0; });
    return out;
  }
  function layoutRow(pcs, m, anim, fresh) {
    const M = S.money;
    const slots = M.slotsOn ? slotPositions(M.slotN, M.slotGroups, m) : [];
    const cy = m.y + m.h / 2 + 4;
    pcs.forEach((pc, i) => {
      let x, y;
      if (i < slots.length) { x = slots[i].x; y = slots[i].y; }
      else if (slots.length) { const j = i - slots.length, s0 = slots[j % slots.length]; x = s0.x + 34; y = s0.y - 30 - Math.floor(j / slots.length) * 14; }
      else { const r = Math.floor(i / 5), c = i % 5, inRow = Math.min(5, pcs.length - r * 5); x = m.x + m.w / 2 + (c - (inRow - 1) / 2) * 114 + (r % 2) * 30; y = cy - r * 32; }
      L.trayPieces.appendChild(pc.g);
      if (anim) moveTo(pc, x, y, pc === fresh ? 170 : 220); else { pc.tok = (pc.tok || 0) + 1; pc.x = x; pc.y = y; setPos(pc); }
    });
  }
  function layoutGroups(pcs, m, anim, fresh) {
    const map = new Map();
    pcs.forEach(p => { const k = (p.locked ? 'L' : '') + p.key; if (!map.has(k)) map.set(k, { key: p.key, locked: p.locked, pcs: [] }); map.get(k).pcs.push(p); });
    const groups = Array.from(map.values()).sort((a, b) => (b.locked - a.locked) || (DEN[b.key].v - DEN[a.key].v));
    const W = m.w - 8;
    const dims = (g, dx) => {
      const n = g.pcs.length, sc = traySc(g.key), pw = pieceW(g.key) * sc, ph = pieceH(g.key) * sc;
      if (g.pcs[0].coin) { const towers = Math.ceil(n / 5), sp = Math.min(pw + 6, pw * (dx / 22) + 6); return { w: pw + (towers - 1) * sp, h: ph + (Math.min(n, 5) - 1) * 11, pw, ph, sp, towers }; }
      return { w: pw + (n - 1) * dx, h: ph, pw, ph, dx };
    };
    let rows;
    for (const dx of [22, 14, 8, 4]) {
      rows = [[]]; let rw = 0, maxW = 0;
      for (const g of groups) {
        const d = dims(g, dx);
        if (rows[rows.length - 1].length && rw + d.w > W) { rows.push([]); rw = 0; }
        rows[rows.length - 1].push({ g, d }); rw += d.w + 12; maxW = Math.max(maxW, rw - 12);
      }
      if (rows.length <= 2 && maxW <= W) break;
    }
    const rowH = rows.map(r => r.reduce((a, it) => Math.max(a, it.d.h), 0));
    const need = rowH.reduce((a, b) => a + b, 0) + (rows.length - 1) * 8;
    const pitchScale = need > m.h ? (m.h - rowH[rowH.length - 1]) / Math.max(1, need - rowH[rowH.length - 1]) : 1;
    let y = m.y + m.h / 2 - Math.min(need, m.h) / 2;
    rows.forEach((row, ri) => {
      const rw = row.reduce((a, it) => a + it.d.w, 0) + (row.length - 1) * 12;
      let x = m.x + m.w / 2 - Math.min(rw, W) / 2;
      const squeeze = rw > W ? (W - row[row.length - 1].d.w) / Math.max(1, rw - row[row.length - 1].d.w) : 1;
      row.forEach(({ g, d }) => {
        const cy = y + rowH[ri] / 2;
        g.pcs.forEach((pc, k) => {
          let px, py;
          if (pc.coin) { const tw = Math.floor(k / 5), lv = k % 5; px = x + d.pw / 2 + tw * d.sp; py = cy + (Math.min(g.pcs.length, 5) - 1) * 5.5 - lv * 11; }
          else { px = x + d.pw / 2 + k * d.dx; py = cy + (k % 2 ? -3 : 0); }
          L.trayPieces.appendChild(pc.g);
          if (anim) moveTo(pc, px, py, pc === fresh ? 170 : 220); else { pc.tok = (pc.tok || 0) + 1; pc.x = px; pc.y = py; setPos(pc); }
        });
        if (g.pcs.length > 1) badge(L.badges, Math.min(x + d.w - 6, m.x + m.w - 20), cy - d.h / 2 + 4, '×' + g.pcs.length);
        x += (d.w + 12) * squeeze;
      });
      y += (rowH[ri] + 8) * pitchScale;
    });
  }

  /* ============================== count marks: board, strip, TK numbers ============================== */
  function clearMarks() {
    L.marks.innerHTML = '';
    if (S.strip) { S.strip.hops.innerHTML = ''; S.strip.run.innerHTML = ''; S.strip.extra.innerHTML = ''; S.strip.la.removeAttribute('display'); S.strip.lb.removeAttribute('display'); }
  }
  function trayChanged() {
    clearMarks();
    if (!S.money || !S.live || S.busy) return;
    const M = S.money;
    // after two misses the concrete help comes back for this round only: a live running total
    if (M.share) {
      M.mats.forEach((m, i) => { const v = S.tray.filter(p => p.mat === i).reduce((a, p) => a + p.v, 0); markLabel(m.x + m.w / 2, 372, rp(v)); });
      return;
    }
    if (TK) { if (!M.slotsOn) { M.slotsOn = true; drawTrayArt(M); layoutTray(true); } return; }
    const free = S.tray.filter(p => !p.locked).sort((a, b) => b.v - a.v);
    let r = M.start;
    if (M.qty) r += S.qtyN * M.qty.price;
    if (S.strip) {
      if (M.qty) for (let i = 0; i < S.qtyN; i++) stripHop(M.start + i * M.qty.price, M.start + (i + 1) * M.qty.price, '#E09A00', false);
      free.forEach(p => { stripHop(r, r + p.v, hopCol(p.key), false); r += p.v; });
      stripRun(r);
    } else { free.forEach(p => { r += p.v; }); boardShow(r, true); }
  }
  const hopCol = k => (DEN[k].coin ? (DEN[k].metal === 'gold' || DEN[k].metal === 'bi' ? '#E09A00' : '#8A929B') : DEN[k].col[2]);
  function markLabel(x, y, s, col) {
    const g = el('g', { transform: `translate(${n1(x)} ${n1(y)})` }, L.marks);
    const w = Math.max(80, s.length * 23 + 26);
    GS.markup(g, `<path d="${rr(-w / 2, -28, w, 56, 28)}" fill="${col || '#fff'}" stroke="${OL}" stroke-width="3.4"/>`);
    txt(g, 0, 1, s, { size: 40 });
    return g;
  }
  function boardShow(v, live) {
    L.marks.querySelectorAll('.km-board').forEach(b => b.remove());
    const g = el('g', { class: 'km-board', transform: `translate(${G.board.x} ${G.board.y})` }, L.marks);
    const s = rp(v), w = Math.max(250, s.length * 31 + 60);
    GS.markup(g, `<path d="${rr(-w / 2, -40, w, 80, 22)}" fill="${live ? '#FFF1C4' : CREAM}" stroke="${OL}" stroke-width="4"/>`);
    txt(g, 0, 2, s, { size: 54 });
    return g;
  }
  function stripDraw(a, b, o) {
    L.strip.innerHTML = '';
    o = o || {};
    const st = { a, b, x0: G.strip.x0, x1: G.strip.x1, y: G.strip.y };
    st.g = el('g', null, L.strip);
    // a count-up line from a (left) to b (flag); the part past the flag shows any overshoot
    GS.markup(st.g, `<path d="${rr(252, 298, 736, 106, 24)}" fill="${CREAM}" opacity=".95" stroke="${OL}" stroke-width="3.4"/>` +
      `<path d="M${st.x0 - 20} ${st.y}H${st.x1 + 128}" stroke="#C9B79C" stroke-width="10" stroke-linecap="round"/>` +
      `<path d="M${st.x0} ${st.y - 14}V${st.y + 14}" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M${st.x1} ${st.y + 14}V${st.y - 30}" stroke="${OL}" stroke-width="4" stroke-linecap="round"/><path d="M${st.x1} ${st.y - 30}L${st.x1 + 26} ${st.y - 22}L${st.x1} ${st.y - 14}Z" fill="${TEAL}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>`);
    st.extra = el('g', null, st.g);
    st.hops = el('g', null, st.g);
    st.la = labelPill(st.g, st.x0 - 6, o.aLabel || rp(a));
    st.lb = labelPill(st.g, st.x1 + 6, o.bLabel || rp(b));
    st.run = el('g', null, st.g);
    S.strip = st;
    return st;
  }
  function labelPill(parent, x, s) {
    const w = Math.max(70, s.length * 21 + 20);
    const g = el('g', { transform: `translate(${n1(clamp(x, 262 + w / 2, 978 - w / 2))} 330)` }, parent);
    GS.markup(g, `<path d="${rr(-w / 2, -22, w, 44, 14)}" fill="#fff" stroke="${OL}" stroke-width="3"/>`);
    txt(g, 0, 1, s, { size: 36 });
    return g;
  }
  function sxOf(v) { const st = S.strip; const t = (v - st.a) / Math.max(1, st.b - st.a); return st.x0 + clamp(t, -0.05, 1.22) * (st.x1 - st.x0); }
  function stripHop(from, to, col, anim) {
    const st = S.strip;
    if (!st) return Promise.resolve();
    const xa = sxOf(from), xb = sxOf(to), h = clamp(Math.abs(xb - xa) * 0.5, 12, 40);
    const d = `M${n1(xa)} ${st.y - 4}Q${n1((xa + xb) / 2)} ${n1(st.y - 4 - h * 1.6)} ${n1(xb)} ${st.y - 4}`;
    const under = el('path', { d, fill: 'none', stroke: OL, 'stroke-width': 12, 'stroke-linecap': 'round' }, st.hops);
    const p = el('path', { d, fill: 'none', stroke: col, 'stroke-width': 7, 'stroke-linecap': 'round' }, st.hops);
    if (!anim) return Promise.resolve();
    let len = 100;
    try { len = p.getTotalLength(); } catch (e) { /* ignore */ }
    [under, p].forEach(q => { q.setAttribute('stroke-dasharray', len); q.setAttribute('stroke-dashoffset', len); });
    return tween(260, e => { [under, p].forEach(q => q.setAttribute('stroke-dashoffset', n1(len * (1 - e)))); });
  }
  function stripRun(v) {
    const st = S.strip;
    if (!st) return;
    st.run.innerHTML = '';
    const x = sxOf(v);
    GS.markup(st.run, `<circle cx="${n1(x)}" cy="${st.y}" r="12" fill="#FFC83D" stroke="${OL}" stroke-width="3"/>`);
    if (v === st.a) { st.la.removeAttribute('display'); st.lb.removeAttribute('display'); return; }
    const s = rp(v), w = Math.max(90, s.length * 23 + 24), lx = clamp(x, 262 + w / 2, 978 - w / 2);
    // the running total replaces an end label it would cover
    st.la.setAttribute('display', Math.abs(lx - sxOf(st.a)) < 150 ? 'none' : 'inline');
    st.lb.setAttribute('display', Math.abs(lx - sxOf(st.b)) < 150 ? 'none' : 'inline');
    const g = el('g', { transform: `translate(${n1(lx)} 328)` }, st.run);
    GS.markup(g, `<path d="${rr(-w / 2, -25, w, 50, 18)}" fill="#FFF1C4" stroke="${OL}" stroke-width="3.4"/>`);
    txt(g, 0, 1, s, { size: 40 });
  }
  function stripGap(from, to, over) {
    const st = S.strip;
    if (!st) return;
    const xa = sxOf(Math.min(from, to)), xb = sxOf(Math.max(from, to));
    el('path', { d: `M${n1(xa)} ${st.y}H${n1(xb)}`, stroke: over ? AMBER : TEAL, 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-dasharray': over ? null : '2 16', opacity: 0.9 }, st.extra);
  }

  /* ============================== the tray (nampan) ============================== */
  function drawTrayArt(M) {
    L.trayArt.innerHTML = '';
    const T0 = G.tray;
    let s = shadowS(T0.x + T0.w / 2, T0.y + T0.h - 2, T0.w * 0.5, 0.2);
    const weave = (() => {
      const id = uid('w');
      return `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M0 22L22 0M-11 11L11 -11M11 33L33 11" stroke="#9A6E36" stroke-width="3"/></pattern><rect x="${T0.x}" y="${T0.y}" width="${T0.w}" height="${T0.h}" fill="url(#${id})" opacity=".18"/>`;
    })();
    s += f3s(rr(T0.x, T0.y, T0.w, T0.h, 54), ['#C99A5B', '#E3BD86', '#9A6E36'], { off: 6, sw: 4 });
    s += f3s(rr(T0.x + 14, T0.y + 12, T0.w - 28, T0.h - 24, 44), ['#E3C08A', '#F2DCAA', '#C9A065'], { off: 4, sw: 3, inner: weave });
    if (M.mats.length > 1) M.mats.slice(1).forEach(m => { s += `<path d="M${n1(m.x - 5)} ${T0.y + 16}V${T0.y + T0.h - 16}" stroke="#7E4A27" stroke-width="7" stroke-linecap="round"/><path d="M${n1(m.x - 5)} ${T0.y + 16}V${T0.y + T0.h - 16}" stroke="#B8924F" stroke-width="3" stroke-linecap="round"/>`; });
    if (M.slotsOn) slotPositions(M.slotN, M.slotGroups, M.mats[0]).forEach(p => {
      s += `<circle cx="${n1(p.x)}" cy="${n1(p.y)}" r="56" fill="#FFF8EC" opacity=".55" stroke="${OL}" stroke-width="3.4" stroke-dasharray="10 9"/><circle cx="${n1(p.x)}" cy="${n1(p.y)}" r="11" fill="${OL}" opacity=".5"/>`;
    });
    GS.markup(L.trayArt, s);
  }

  /* ============================== money phase ============================== */
  function moneyPhase(R, gen) {
    const priceTotal = R.items.reduce((a, it) => a + it.price * (it.qty || 1), 0);
    const M = {
      R, type: R.type, denoms: R.denoms, minimal: !!R.minimal, qty: R.qtyItem || null, share: R.type === 'share',
      slotN: 0, slotGroups: R.slotGroups || null, slotsOn: false
    };
    const preTotal = sumKeys(R.pre);
    if (R.type === 'pay') { M.start = preTotal; M.goal = priceTotal; }
    else if (R.type === 'share') { M.start = 0; M.goal = priceTotal / R.kids; M.total = priceTotal; }
    else { M.start = M.qty ? 0 : priceTotal; M.goal = sumKeys(R.paid); }
    M.mats = matRects(M.share ? R.kids : 1);
    if (TK) { M.slotN = Math.round((M.goal - M.start) / 1000); M.slotsOn = !!R.slots; }
    const singleLine = R.items.length <= 1 && (!R.items[0] || (R.items[0].qty || 1) === 1);
    M.strip = !TK && TIER !== 'k1' && !M.share && (singleLine || R.stripOk) && M.goal > M.start;
    M.minPieces = M.minimal ? (decompose(M.goal - M.start - (M.qty ? 0 : 0), R.denoms) || []).length : 0;
    S.money = M;
    S.tray = [];
    drawTrayArt(M);
    drawDrawer(R.denoms, R.type === 'change' ? 'laci' : 'dompet');
    drawerEnabled(true);
    if (R.pre) R.pre.forEach(k => addToTray(makePiece(k, true), 0, false));
    if (M.strip) stripDraw(M.start, M.goal, R.stripLabels);
    if (M.qty) drawQty(M);
    S.dockMode = R.type === 'change' ? 'give' : 'pay';
    dockRender();
    S.solver = () => solveMoney(M);
    return new Promise(res => { M.resolve = res; });
  }
  async function solveMoney(M) {
    if (S.busy || S.money !== M) return;
    S.tray.filter(p => !p.locked).forEach(p => { const i = S.tray.indexOf(p); S.tray.splice(i, 1); p.g.remove(); });
    if (M.qty) { S.qtyN = Math.floor(M.goal / M.qty.price); renderQty(M); }
    if (M.share) {
      M.mats.forEach((m, i) => (decompose(M.goal, M.denoms) || []).forEach(k => addToTray(makePiece(k), i, false)));
    } else {
      const need = M.goal - M.start - (M.qty ? S.qtyN * M.qty.price : 0);
      (decompose(need, M.denoms) || []).forEach(k => addToTray(makePiece(k), 0, false));
    }
    layoutTray(false);
    await commit();
  }

  /* ---------- k4 pencils: buy as many as the money allows ---------- */
  function drawQty(M) {
    L.items.innerHTML = '';
    S.items = [];
    const jx = 950, y = G.items.y;
    const jar = el('g', { transform: `translate(${jx} ${y})`, 'data-hit': 'pensil-tambah' }, L.items);
    let s = shadowS(0, 0, 54);
    for (let i = 0; i < 5; i++) s += `<g transform="translate(${(i - 2) * 14} ${-64 - (i % 2) * 10}) rotate(${(i - 2) * 6})">${CUSTOM.pensil()}</g>`;
    s += f3s('M-50 -86L50 -86L42 0L-42 0Z', ['#2F80C9', '#6FAEE3', '#215F98'], { off: 5, sw: 4 });
    s += `<circle cx="0" cy="-40" r="25" fill="#fff" stroke="${OL}" stroke-width="3.4"/><path d="M-12 -40H12M0 -52V-28" stroke="${TEAL}" stroke-width="7" stroke-linecap="round"/>`;
    GS.markup(jar, s);
    el('rect', { x: -60, y: -190, width: 120, height: 196, fill: 'transparent' }, jar);
    jar.addEventListener('click', () => qtyTap(M, +1));
    const pile = el('g', { transform: `translate(1150 ${y})`, 'data-hit': 'pensil-kurang' }, L.items);
    el('rect', { x: -112, y: -170, width: 224, height: 178, fill: 'transparent' }, pile);
    M.pile = el('g', null, pile);
    pile.addEventListener('click', () => qtyTap(M, -1));
    renderQty(M);
  }
  function renderQty(M) {
    if (!M.pile) return;
    M.pile.innerHTML = '';
    const n = S.qtyN, sp = Math.min(26, 190 / Math.max(1, n));
    let s = shadowS(0, 0, 100);
    for (let i = 0; i < n; i++) s += `<g transform="translate(${n1((i - (n - 1) / 2) * sp)} 0)">${CUSTOM.pensil()}</g>`;
    if (!n) s += `<path d="${rr(-90, -120, 180, 112, 20)}" fill="#FFF8EC" opacity=".6" stroke="${OL}" stroke-width="3" stroke-dasharray="10 8"/>`;
    GS.markup(M.pile, s);
    if (n) {
      const b = el('g', { transform: 'translate(86 -150)' }, M.pile);
      GS.markup(b, `<circle r="30" fill="${TEAL}" stroke="${OL}" stroke-width="3.4"/>`);
      txt(b, 0, 1, String(n), { size: 40, fill: '#fff' });
      const mn = el('g', { transform: 'translate(-86 -150)' }, M.pile);
      GS.markup(mn, `<circle r="24" fill="#fff" stroke="${OL}" stroke-width="3"/><path d="M-10 0H10" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>`);
    }
  }
  function qtyTap(M, d) {
    if (!canEdit() || S.money !== M) return;
    const n = clamp(S.qtyN + d, 0, M.qty.max || 12);
    if (n === S.qtyN) { GS.sfx.tick(); return; }
    S.qtyN = n;
    d > 0 ? GS.sfx.pick() : GS.sfx.pop();
    renderQty(M);
    trayChanged();
  }

  /* ---------- commit: the person counts the tray ---------- */
  async function commit() {
    const M = S.money;
    if (!M || S.busy || S.over) return;
    if (M.share) return commitShare(M);
    const gen = S.gen;
    if (M.qty && S.qtyN === 0) { GS.sfx.tick(); say('Ambil pensilnya dulu, ya. Ketuk gelasnya.'); return; }
    S.busy = true; dockRender(); clearMarks();
    const free = S.tray.filter(p => !p.locked).sort((a, b) => b.v - a.v);
    const seq = [];
    if (M.qty) for (let i = 0; i < S.qtyN; i++) seq.push({ v: M.qty.price, qty: i });
    free.forEach(p => seq.push({ v: p.v, p }));
    const runv = [];
    let r = M.start;
    seq.forEach(s => { r += s.v; runv.push(r); });
    const total = r;
    countSpeech(M, runv, seq);
    hudThinking();
    // each step lasts about as long as the number takes to say, so the voice and the tray stay together
    const stepOf = i => (seq.length > 9 ? 230 : TK ? 620 : clamp(words(runv[i]).split(' ').length * 300, 560, 1300));
    if (M.strip) stripRun(M.start); else if (!TK) boardShow(M.start);
    if (!seq.length) await pause(500, gen);
    for (let i = 0; i < seq.length; i++) {
      const s = seq[i], from = i ? runv[i - 1] : M.start;
      if (s.p) popPiece(s.p); else qtyPop(M, s.qty);
      GS.sfx.coin();
      if (M.strip) { stripHop(from, runv[i], s.p ? hopCol(s.p.key) : '#E09A00', true); stripRun(runv[i]); }
      else if (TK) { const q = toSvg(s.p.g.parentNode, s.p.x, s.p.y); markLabel(q.x, q.y - 86, String(i + 1), '#FFF1C4'); }
      else boardShow(runv[i]);
      await pause(stepOf(i), gen);
    }
    await pause(320, gen);
    // --- judge, truthfully ---
    if (M.qty && S.qtyN * M.qty.price > M.goal) {
      fail(); S.busy = false;
      if (M.strip) stripGap(M.goal, S.qtyN * M.qty.price, true);
      say(`Uangnya tidak cukup untuk ${S.qtyN} pensil.`, `Uangnya tidak cukup untuk ${words(S.qtyN)} pensil.`);
      GS.sfx.oops(); mood('think'); personLean(-5, 900); thought('?');
      dockRender(); return;
    }
    if (total > M.goal) {
      fail();
      const extras = [];
      let rr2 = total;
      for (let i = seq.length - 1; i >= 0 && rr2 > M.goal; i--) { if (!seq[i].p) break; extras.push(seq[i].p); rr2 -= seq[i].v; }
      if (M.strip) stripGap(M.goal, total, true);
      say(TK ? 'Kebanyakan koinnya. Ini kukembalikan.' : 'Kebanyakan, Nak. Ini kukembalikan.');
      GS.sfx.boing(); mood('surprise'); personLean(-8, 700);
      await pause(500, gen);
      for (const p of extras) { returnToDrawer(p, 'keep'); await pause(170, gen); }
      layoutTray(true);
      await pause(300, gen);
      S.busy = false; clearMarks(); dockRender(); mood('think');
      if (S.live) trayChanged();
      return;
    }
    if (total < M.goal) {
      fail(); S.busy = false;
      if (M.strip) stripGap(total, M.goal, false);
      if (TK) say('Koinnya masih kurang. Tambah lagi, ya.');
      else if (M.type === 'pay') say(`Masih kurang. Baru ${rp(total)}.`, `Masih kurang. Baru ${rpW(total)}.`);
      else say(`Kembaliannya masih kurang. Baru sampai ${rp(total)}.`, `Kembaliannya masih kurang. Baru sampai ${rpW(total)}.`);
      GS.sfx.oops(); mood('think'); personLean(-6, 1000); thought('...');
      dockRender(); return;
    }
    if (M.qty) {
      const rem = M.goal - S.qtyN * M.qty.price;
      if (rem >= M.qty.price) {
        fail(); S.busy = false;
        say(`Sisanya ${rp(rem)}, masih cukup untuk satu pensil lagi.`, `Sisanya ${rpW(rem)}, masih cukup untuk satu pensil lagi.`);
        GS.sfx.oops(); mood('think'); thought('+1');
        dockRender(); return;
      }
    }
    // --- exact ---
    let line = TK ? 'Pas! Terima kasih.' : M.type === 'pay' ? 'Pas! Terima kasih.' : 'Pas! Kembaliannya benar. Terima kasih.';
    let spoken = null;
    if (M.R.exchange) { const n = free.length; line = `Pas! ${n} keping koin ${rp(DEN[M.R.denoms[0]].v)}.`; spoken = `Pas! ${words(n)} keping koin ${rpW(DEN[M.R.denoms[0]].v)}.`; }
    if (M.qty) { const rem = M.goal - S.qtyN * M.qty.price; line = `Pas! ${S.qtyN} pensil, kembaliannya ${rp(rem)}.`; spoken = `Pas! ${words(S.qtyN)} pensil, kembaliannya ${rpW(rem)}.`; }
    if (M.minimal) {
      if (free.length <= M.minPieces) { line += ' Lembarnya paling sedikit!'; if (spoken) spoken += ' Lembarnya paling sedikit!'; stamp(); }
      else { S.notMinimal = true; line += ' Bisa juga dengan lebih sedikit lembar.'; if (spoken) spoken += ' Bisa juga dengan lebih sedikit lembar.'; }
    }
    say(line, spoken);
    S.solver = null;
    S.dockMode = null; dockRender();
    mood('cheer');
    M.resolve();
  }
  function qtyPop(M, i) {
    if (!M.pile) return;
    const kids = M.pile.children;
    // the pile draws a shadow first, then one <g> per pencil
    const g = kids[i + 1];
    if (!g || GS.reducedMotion) return;
    const base = g.getAttribute('transform');
    tween(260, (e, t) => g.setAttribute('transform', `${base} translate(0 ${n1(-Math.sin(t * Math.PI) * 18)})`), 'linear').then(() => g.setAttribute('transform', base));
  }
  function countSpeech(M, runv, seq) {
    if (!seq.length) { if (M.goal === M.start) say('Uangnya pas, tidak perlu kembalian.'); return; }
    if (TK) {
      const nums = runv.map((_, i) => i + 1);
      say(nums.join(', ') + '.', nums.map(words).join(', ') + '.');
      return;
    }
    let vals = runv.slice(), cap, spk;
    const head = M.type === 'change' && !M.qty && M.start > 0 ? [M.start] : [];
    if (vals.length > 8) vals = [vals[0], vals[1], vals[2], null, vals[vals.length - 1]];
    const all = head.concat(vals);
    cap = all.map(v => (v == null ? '...' : rp(v))).join(', ');
    spk = all.map(v => (v == null ? '...' : words(v))).join(', ');
    say(cap, spk);
  }
  function hudThinking() { mood('think'); }
  function stamp() {
    const g = el('g', { transform: `translate(${G.person.x - 140} 470)` }, L.fx);
    const inner = el('g', null, g);
    GS.markup(inner, `<g transform="rotate(-12)"><circle r="78" fill="#FFF8EC" stroke="${TEAL}" stroke-width="7"/><circle r="66" fill="none" stroke="${TEAL}" stroke-width="3" stroke-dasharray="6 6"/>` +
      `<path d="M0 -58l7 14 15 2 -11 10 3 15 -14 -7 -14 7 3 -15 -11 -10 15 -2Z" fill="#FFC83D" stroke="${OL}" stroke-width="2.4" stroke-linejoin="round"/></g>`);
    const t1 = txt(inner, 0, 6, 'Paling', { size: 30, cls: 'km-disp', fill: TEAL }); t1.setAttribute('transform', 'rotate(-12)');
    const t2 = txt(inner, 0, 38, 'sedikit!', { size: 30, cls: 'km-disp', fill: TEAL }); t2.setAttribute('transform', 'rotate(-12)');
    GS.sfx.thud();
    sparkle(G.person.x, 260, 6);
    tween(320, e => inner.setAttribute('transform', `scale(${n1((2.2 - 1.2 * e) * 100) / 100})`), 'outCubic');
  }

  /* ---------- share (patungan): each mat must hold the same amount ---------- */
  async function commitShare(M) {
    const gen = S.gen;
    S.busy = true; dockRender(); clearMarks(); mood('think');
    const res = [];
    const caps = [];
    for (let i = 0; i < M.mats.length; i++) {
      const pcs = S.tray.filter(p => p.mat === i).sort((a, b) => b.v - a.v);
      let r = 0;
      for (const p of pcs) {
        r += p.v; popPiece(p); GS.sfx.coin();
        L.marks.querySelectorAll('.km-m' + i).forEach(x => x.remove());
        markLabel(M.mats[i].x + M.mats[i].w / 2, 372, rp(r)).setAttribute('class', 'km-m' + i);
        await pause(pcs.length > 6 ? 200 : 380, gen);
      }
      if (!pcs.length) markLabel(M.mats[i].x + M.mats[i].w / 2, 372, rp(0)).setAttribute('class', 'km-m' + i);
      res.push({ pcs, r });
      caps.push(r);
      await pause(200, gen);
    }
    await pause(300, gen);
    const allOk = res.every(x => x.r === M.goal);
    if (allOk) {
      say(`Pas! Tiap anak ${rp(M.goal)}. Semuanya sama.`, `Pas! Tiap anak ${rpW(M.goal)}. Semuanya sama.`);
      S.solver = null; S.dockMode = null; dockRender(); mood('cheer');
      M.resolve();
      return;
    }
    fail();
    const anyOver = res.some(x => x.r > M.goal);
    if (anyOver) {
      say('Ada yang kebanyakan. Ini dikembalikan.');
      GS.sfx.boing();
      for (const x of res) {
        let r = x.r;
        for (let k = x.pcs.length - 1; k >= 0 && r > M.goal; k--) { returnToDrawer(x.pcs[k], 'keep'); r -= x.pcs[k].v; await pause(150, gen); }
      }
      layoutTray(true);
    } else {
      say(`Bagiannya belum pas. Tiap anak harus sama, jumlahnya ${rp(M.total)}.`, `Bagiannya belum pas. Tiap anak harus sama, jumlahnya ${rpW(M.total)}.`);
      GS.sfx.oops(); thought('...');
    }
    await pause(300, gen);
    S.busy = false; dockRender(); mood('think');
    if (anyOver) clearMarks();
    if (S.live) trayChanged();
  }

  /* ---------- success: the deal happens ---------- */
  async function roundSuccess(R, gen) {
    personHop(2);
    sparkle(G.person.x, 250, 5);
    GS.sfx.win();
    await pause(500, gen);
    const pTo = { x: G.person.x - 40, y: 300 };
    const pcs = S.tray.slice();
    S.tray = [];
    L.badges.innerHTML = '';
    pcs.forEach((p, i) => {
      const q = toSvg(p.g.parentNode, p.x, p.y);
      dragLayer.appendChild(p.g); p.x = q.x; p.y = q.y; setPos(p);
      const target = R.type === 'change' || R.type === 'share' ? pTo : pTo;
      S.timers.push(setTimeout(() => { moveTo(p, target.x, target.y, 420, 'inCubic').then(() => p.g.remove()); scaleTo(p, 0.3, 420); }, T(i * 50)));
    });
    // the customer's own money goes into the drawer
    (S.paidEls || []).forEach(g => tween(420, e => g.setAttribute('opacity', n1(1 - e))));
    // items change hands: to the person (they bought), or toward the child (we bought)
    const toChild = R.type === 'pay' || R.type === 'share';
    S.items.forEach(h => {
      h.els.forEach(it => {
        const x0 = it.x, y0 = it.y, tx = toChild ? 560 : G.person.x, ty = toChild ? 860 : 330;
        tween(560, e => { it.g.setAttribute('transform', `translate(${n1(lerp(x0, tx, e))} ${n1(lerp(y0, ty, e) - Math.sin(e * Math.PI) * 60)})`); it.g.setAttribute('opacity', n1(1 - e * e)); }, 'inOutCubic');
      });
    });
    if (S.money && S.money.pile) tween(420, e => S.money.pile.setAttribute('opacity', n1(1 - e)));
    await pause(900, gen);
    S.money = null;
    dockRender();
    clearMarks();
    L.strip.innerHTML = '';
    S.strip = null;
    S.busy = false;
  }

  /* ============================== pick phases (before money) ============================== */
  function pickPhase(R, gen) {
    const P = R.pick;
    drawDrawer(R.denoms, R.type === 'change' ? 'laci' : 'dompet');
    drawerEnabled(false);
    drawTrayArt({ mats: [matRects(1)[0]] });
    if (P.kind === 'pricier') return pickPricier(R, gen);
    if (P.kind === 'basket') return pickBasket(R, gen);
    if (P.kind === 'offer') return pickOffer(R, gen);
    if (P.kind === 'select') return pickSelect(R, gen);
    if (P.kind === 'estimate') return pickEstimate(R, gen);
    return Promise.resolve();
  }
  function card(parent, x, y, w, h, hitName) {
    const g = el('g', { transform: `translate(${n1(x)} ${n1(y)})`, 'data-hit': hitName }, parent);
    const hop = el('g', null, g);
    const bgp = el('path', { d: rr(0, 0, w, h, 24), fill: '#fff', stroke: OL, 'stroke-width': 4 }, hop);
    GS.markup(hop, `<path d="${rr(6, h - 14, w - 12, 10, 5)}" fill="${OL}" opacity=".08"/>`);
    const body = el('g', null, hop);
    el('rect', { x: 0, y: 0, width: w, height: h, fill: 'transparent' }, hop);
    return { g, hop, bgp, body, x, y, w, h };
  }
  function cardWobble(c) {
    tween(420, (e, t) => c.hop.setAttribute('transform', `rotate(${n1(Math.sin(t * Math.PI * 5) * 5 * (1 - t))} ${c.w / 2} ${c.h})`), 'linear');
  }
  function cardSelect(c, on) {
    c.bgp.setAttribute('stroke', on ? TEAL : OL);
    c.bgp.setAttribute('stroke-width', on ? 9 : 4);
    c.bgp.setAttribute('fill', on ? '#E4F5F1' : '#fff');
    c.hop.querySelectorAll('.km-check').forEach(x => x.remove());
    if (on) { const k = el('g', { class: 'km-check', transform: `translate(${c.w - 18} 18)` }, c.hop); GS.markup(k, `<circle r="22" fill="${TEAL}" stroke="${OL}" stroke-width="3"/><path d="M-10 0l7 7 12 -13" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`); }
  }
  function onTap(c, fn) {
    c.g.addEventListener('click', () => { if (!S.busy && !S.over) fn(); });
  }
  const priceOfItems = list => list.reduce((a, it) => a + it.price * (it.qty || 1), 0);

  /* TK L4: which is dearer? (dots on the tags) */
  function pickPricier(R, gen) {
    const opts = R.pick.options;
    L.cards.innerHTML = '';
    const cards = opts.map((o, i) => {
      const c = card(L.cards, 262 + i * 310, 298, 290, 288, 'barang-' + (i + 1));
      itemG(c.body, o.name, 150, c.w / 2, 186, 220);
      let s = `<path d="${rr(18, 208, c.w - 36, 62, 20)}" fill="#FFF1C4" stroke="${OL}" stroke-width="3"/>`;
      const n = Math.round(o.price / 1000), sp = Math.min(48, (c.w - 60) / n);
      for (let k = 0; k < n; k++) s += coinDot(c.w / 2 + (k - (n - 1) / 2) * sp, 239, 20);
      GS.markup(c.body, s);
      return c;
    });
    return new Promise(res => {
      const choose = i => {
        if (S.busy) return;
        const o = opts[i], other = opts[1 - i];
        if (o.price > other.price) {
          GS.sfx.pop(); cardSelect(cards[i], true); cardWobble(cards[1 - i]);
          S.busy = true; S.solver = null;
          S.timers.push(setTimeout(() => {
            if (gen !== S.gen) return;
            S.busy = false;
            L.cards.innerHTML = '';
            R.items = [{ name: o.name, price: o.price }];
            showBubble(R); showItems(R.items);
            say('Ya, itu lebih mahal. Bayar koin sebanyak titiknya.');
            res();
          }, T(700)));
        } else {
          fail(); GS.sfx.oops(); cardWobble(cards[i]); mood('think');
          say('Yang ini koinnya lebih sedikit. Coba yang satu lagi.');
        }
      };
      cards.forEach((c, i) => onTap(c, () => choose(i)));
      S.solver = async () => choose(opts[0].price > opts[1].price ? 0 : 1);
    });
  }

  /* k2 L7: two baskets, which is dearer; then add the difference on top of the cheaper total */
  function pickBasket(R, gen) {
    const B = R.pick.baskets;
    L.cards.innerHTML = '';
    const cards = B.map((b, i) => {
      const c = card(L.cards, 256 + i * 314, 298, 296, 288, 'keranjang-' + (i + 1));
      GS.markup(c.body, `<path d="${rr(14, 14, c.w - 28, 30, 12)}" fill="${i ? '#FDE6CC' : '#DDEBF9'}"/>`);
      txt(c.body, c.w / 2, 30, i ? 'Keranjang B' : 'Keranjang A', { size: 30, cls: 'km-body', fill: i ? '#C76A12' : '#215F98' });
      b.items.forEach((it, k) => {
        itemG(c.body, it.name, 60, 56, 118 + k * 72, 76, true);
        txt(c.body, 104, 92 + k * 72, rp(it.price), { size: 42, anchor: 'start' });
      });
      c.total = el('g', null, c.body);
      return c;
    });
    const showTotals = () => cards.forEach((c, i) => {
      c.total.innerHTML = '';
      GS.markup(c.total, `<path d="M20 236H${c.w - 20}" stroke="${OL}" stroke-width="3" stroke-dasharray="8 7"/>`);
      txt(c.total, c.w / 2, 262, '= ' + rp(priceOfItems(B[i].items)), { size: 42, fill: TEAL });
    });
    return new Promise(res => {
      const choose = i => {
        if (S.busy) return;
        const me = priceOfItems(B[i].items), other = priceOfItems(B[1 - i].items);
        showTotals();
        if (me > other) {
          GS.sfx.pop(); cardSelect(cards[i], true);
          S.busy = true; S.solver = null;
          say(`Ya! ${rp(me)} lebih mahal dari ${rp(other)}.`, `Ya! ${rpW(me)} lebih mahal dari ${rpW(other)}.`);
          S.timers.push(setTimeout(() => {
            if (gen !== S.gen) return;
            S.busy = false;
            L.cards.innerHTML = '';
            R.items = B[i].items;
            R.pre = decompose(other, R.denoms);
            R.stripOk = true;
            R.bubble = B[i].items.map(it => ({ item: it.name, text: rp(it.price) }));
            showBubble(R); showItems(R.items);
            say('Uangmu sudah cukup untuk yang murah. Tambahkan sampai cukup.');
            res();
          }, T(1500)));
        } else {
          fail(); GS.sfx.oops(); cardWobble(cards[i]); mood('think');
          say(`Keranjang ini lebih murah, ${rp(me)}. Coba yang satu lagi.`, `Keranjang ini lebih murah, ${rpW(me)}. Coba yang satu lagi.`);
        }
      };
      cards.forEach((c, i) => onTap(c, () => choose(i)));
      S.solver = async () => choose(priceOfItems(B[0].items) > priceOfItems(B[1].items) ? 0 : 1);
    });
  }

  /* k4 L3: buy 3 singly or as a pack, whichever is cheaper (multiply, then compare) */
  function pickOffer(R, gen) {
    const O = R.pick;
    L.cards.innerHTML = '';
    const totals = [3 * O.unit, O.pack];
    const cards = [0, 1].map(i => {
      const c = card(L.cards, 256 + i * 314, 298, 296, 288, i ? 'paket' : 'satuan');
      if (i === 0) itemG(c.body, O.name, 84, c.w / 2, 108, 120, true);
      else [-1, 0, 1].forEach(k => itemG(c.body, O.name, 70, c.w / 2 + k * 62, 104 - Math.abs(k) * 4, 70, true));
      txt(c.body, c.w / 2, 140, i ? 'Paket isi 3' : 'Satu bungkus', { size: 30, cls: 'km-body', fill: '#6B4A20' });
      txt(c.body, c.w / 2, 186, rp(i ? O.pack : O.unit), { size: 46 });
      c.total = el('g', null, c.body);
      return c;
    });
    const showTotals = () => cards.forEach((c, i) => {
      c.total.innerHTML = '';
      txt(c.total, c.w / 2, 252, i ? 'Untuk 3: ' + rp(totals[1]) : '3 × ' + rp(O.unit) + ' = ' + rp(totals[0]), { size: i ? 36 : 32, fill: TEAL });
    });
    return new Promise(res => {
      const choose = i => {
        if (S.busy) return;
        showTotals();
        if (totals[i] < totals[1 - i]) {
          GS.sfx.pop(); cardSelect(cards[i], true);
          S.busy = true; S.solver = null;
          const d = totals[1 - i] - totals[i];
          say(`Ya, lebih hemat ${rp(d)}.`, `Ya, lebih hemat ${rpW(d)}.`);
          S.timers.push(setTimeout(() => {
            if (gen !== S.gen) return;
            S.busy = false;
            L.cards.innerHTML = '';
            R.items = i ? [{ name: O.name, price: O.pack }] : [{ name: O.name, price: O.unit, qty: 3 }];
            R.bubble = [i ? { item: O.name, text: 'Paket ' + rp(O.pack) } : { item: O.name, text: '3 × ' + rp(O.unit) }];
            showBubble(R); showItems(i ? [{ name: O.name, price: O.pack, qty: 3 }] : R.items);
            say('Sekarang bayar pas, ya.');
            res();
          }, T(1600)));
        } else {
          fail(); GS.sfx.oops(); cardWobble(cards[i]); mood('think');
          const d = totals[i] - totals[1 - i];
          say(`Yang ini lebih mahal ${rp(d)}. Pilih yang hemat.`, `Yang ini lebih mahal ${rpW(d)}. Pilih yang hemat.`);
        }
      };
      cards.forEach((c, i) => onTap(c, () => choose(i)));
      S.solver = async () => choose(totals[0] < totals[1] ? 0 : 1);
    });
  }

  /* k2 L6 / k4 L5: choose goods within the customer's money; the seller adds them up on the strip */
  function pickSelect(R, gen) {
    const P = R.pick, opts = P.options;
    const sel = new Set();
    S.selOk = false;
    let cards = [];
    const draw = () => {
      L.cards.innerHTML = '';
      cards = opts.map((o, i) => {
        const r = Math.floor(i / 3), c0 = i % 3;
        const c = card(L.cards, 252 + c0 * 210, 300 + r * 146, 198, 136, 'barang-' + (i + 1));
        itemG(c.body, o.name, 64, c.w / 2, 76, 120, true);
        txt(c.body, c.w / 2, 106, rp(o.price), { size: 40 });
        cardSelect(c, sel.has(i));
        onTap(c, () => toggle(i));
        return c;
      });
    };
    const chosen = () => Array.from(sel).sort((a, b) => a - b).map(i => opts[i]);
    const toggle = i => {
      if (S.busy || S.dockMode !== 'buy') return;
      if (sel.has(i)) sel.delete(i); else { if (P.count && sel.size >= P.count) { GS.sfx.tick(); cardWobble(cards[i]); return; } sel.add(i); }
      GS.sfx.pop();
      cardSelect(cards[i], sel.has(i));
      showItems(chosen().map(o => ({ name: o.name, price: o.price })));
      S.selOk = P.count ? sel.size === P.count : sel.size > 0;
      dockRender();
    };
    draw();
    return new Promise(res => {
      const go = async () => {
        if (S.busy) return;
        const list = chosen();
        if (!list.length || (P.count && list.length !== P.count)) { GS.sfx.tick(); return; }
        S.busy = true; dockRender();
        L.cards.setAttribute('display', 'none');
        const total = await revealSum(list, P.budget, gen);
        if (total > P.budget) {
          fail(); GS.sfx.oops(); mood('think'); thought('?');
          say(`Uangnya cuma ${rp(P.budget)}. Tidak cukup.`, `Uangnya cuma ${rpW(P.budget)}. Tidak cukup.`);
          await pause(1400, gen);
          L.strip.innerHTML = ''; S.strip = null; L.cards.removeAttribute('display');
          S.busy = false; dockRender(); return;
        }
        const left = P.budget - total, more = P.maximal ? opts.find((o, i) => !sel.has(i) && o.price <= left) : null;
        if (more) {
          fail(); GS.sfx.oops(); mood('think'); thought('+');
          say(`Masih sisa ${rp(left)}. Masih cukup untuk beli lagi.`, `Masih sisa ${rpW(left)}. Masih cukup untuk beli lagi.`);
          await pause(1400, gen);
          L.strip.innerHTML = ''; S.strip = null; L.cards.removeAttribute('display');
          cardWobble(cards[opts.indexOf(more)]);
          S.busy = false; dockRender(); return;
        }
        GS.sfx.pop(); mood('happy');
        say(`Cukup! Totalnya ${rp(total)}. Sekarang berikan kembaliannya.`, `Cukup! Totalnya ${rpW(total)}. Sekarang berikan kembaliannya.`);
        await pause(1300, gen);
        L.cards.innerHTML = ''; L.cards.removeAttribute('display'); L.strip.innerHTML = ''; S.strip = null;
        R.items = list.map(o => ({ name: o.name, price: o.price }));
        R.bubble = null;
        showBubble(R); showItems(R.items);
        S.busy = false; S.dockMode = null; S.solver = null;
        res();
      };
      S.pickGo = go;
      S.dockMode = 'buy'; dockRender();
      S.solver = async () => {
        if (S.busy) return;
        sel.clear();
        const idx = opts.map((o, i) => i).sort((a, b) => opts[a].price - opts[b].price);
        if (P.count) {
          // the pair with the largest total that still fits
          let best = null, bv = -1;
          for (let a = 0; a < opts.length; a++) for (let b = a + 1; b < opts.length; b++) { const v = opts[a].price + opts[b].price; if (v <= P.budget && v > bv) { bv = v; best = [a, b]; } }
          best.forEach(i => sel.add(i));
        } else { let t = 0; idx.forEach(i => { if (t + opts[i].price <= P.budget) { sel.add(i); t += opts[i].price; } }); }
        draw(); showItems(chosen().map(o => ({ name: o.name, price: o.price })));
        S.selOk = true;
        await go();
      };
    });
  }
  /** The seller adds the prices on a strip from 0 to the budget. Truthful: overshoot shows past the flag. */
  async function revealSum(list, budget, gen) {
    stripDraw(0, budget, { bLabel: rp(budget) });
    let r = 0;
    const runs = list.map(o => (r += o.price));
    say(runs.map(rp).join(', '), runs.map(words).join(', '));
    stripRun(0);
    for (let i = 0; i < list.length; i++) {
      GS.sfx.coin();
      await stripHop(i ? runs[i - 1] : 0, runs[i], ['#2F80C9', '#F28C28', '#4DAA57', '#E2453C', '#8565A9', '#E09A00'][i % 6], true);
      stripRun(runs[i]);
      await pause(380, gen);
    }
    if (r > budget) stripGap(budget, r, true);
    await pause(300, gen);
    return r;
  }

  /* k4 L2: is Rp50.000 enough for three things? Estimate first (not graded), then count. */
  function pickEstimate(R, gen) {
    const P = R.pick;
    return new Promise(res => {
      const answer = async guess => {
        if (S.busy) return;
        S.busy = true; S.dockMode = null; dockRender();
        const total = await revealSum(R.items, P.budget, gen);
        const enough = total <= P.budget;
        if (guess === enough) { GS.sfx.star(1); sparkle(560, 330, 6); }
        if (enough) {
          say(`${guess ? 'Tebakanmu benar! ' : ''}Cukup, totalnya ${rp(total)}. Berikan kembaliannya.`, `${guess ? 'Tebakanmu benar! ' : ''}Cukup, totalnya ${rpW(total)}. Berikan kembaliannya.`);
          await pause(1500, gen);
          L.strip.innerHTML = ''; S.strip = null;
          R.stripOk = true; S.busy = false; S.solver = null;
          res();
          return;
        }
        say(`${guess ? '' : 'Tebakanmu benar! '}Tidak cukup, totalnya ${rp(total)}. Kembalikan satu barang.`, `${guess ? '' : 'Tebakanmu benar! '}Tidak cukup, totalnya ${rpW(total)}. Kembalikan satu barang.`);
        await pause(1200, gen);
        S.busy = false;
        // tap one of the goods on the counter to put it back
        S.items.forEach((h, i) => {
          const hit = el('rect', { x: h.cx - 60, y: G.items.y - 150, width: 120, height: 160, fill: 'transparent', 'data-hit': 'kembalikan-' + (i + 1) }, L.items);
          hit.addEventListener('click', () => putBack(i));
        });
        S.solver = async () => putBack(0);
      };
      const putBack = async i => {
        if (S.busy) return;
        S.busy = true; S.solver = null;
        GS.sfx.pop();
        R.items = R.items.filter((_, k) => k !== i);
        L.strip.innerHTML = ''; S.strip = null;
        showItems(R.items); showBubble(R, R.items.map(it => ({ item: it.name, text: rp(it.price) })));
        const total = await revealSum(R.items, P.budget, gen);
        if (total > P.budget) { S.busy = false; return; } // cannot happen with the generated prices, kept truthful
        say(`Sekarang cukup, totalnya ${rp(total)}. Berikan kembaliannya.`, `Sekarang cukup, totalnya ${rpW(total)}. Berikan kembaliannya.`);
        await pause(1500, gen);
        L.strip.innerHTML = ''; S.strip = null;
        R.stripOk = true; S.busy = false;
        res();
      };
      S.estimate = answer;
      S.dockMode = 'estimate'; dockRender();
      S.solver = async () => answer(priceOfItems(R.items) <= P.budget);
    });
  }

  /* ============================== dock ============================== */
  const COIN_ICO = `<svg class="km-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#FFC83D" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" fill="none" stroke="#3B2A20" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  function actionBtn(label, cls, onClick, disabled, icon) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gs-action' + (cls ? ' ' + cls : '');
    b.innerHTML = (icon || '') + '<span></span>';
    b.querySelector('span').textContent = label;
    b.disabled = !!disabled;
    b.addEventListener('click', () => { GS.sfx.click(); onClick(); });
    dock.appendChild(b);
    return b;
  }
  function dockRender() {
    dock.innerHTML = '';
    if (S.over) return;
    const m = S.dockMode;
    if ((m === 'pay' || m === 'give') && S.money) actionBtn(m === 'pay' ? 'Bayar!' : 'Berikan', 'km-wide', () => commit(), S.busy, COIN_ICO);
    else if (m === 'buy') actionBtn('Beli!', 'km-wide', () => S.pickGo && S.pickGo(), S.busy || !S.selOk);
    else if (m === 'estimate') {
      actionBtn('Cukup', 'km-wide', () => S.estimate && S.estimate(true), S.busy);
      actionBtn('Tidak cukup', 'alt', () => S.estimate && S.estimate(false), S.busy);
    }
  }

  /* ============================== levels per tier (docs/KURIKULUM.md) ============================== */
  function buildLevels(tier) {
    const SELLER = 4;
    let lastCust = -1;
    const cust = () => { let c; do { c = pick1([0, 1, 2, 3, 5, 6, 7]); } while (c === lastCust); lastCust = c; return c; };
    const CHEAP = ['permen', 'kerupuk', 'klepon', 'es'];
    const MID = ['pisang', 'jeruk', 'apel', 'rambutan', 'salak', 'botol', 'mangga'];
    const BIG = ['semangka', 'kelapa', 'ikan'];
    const ANY = CHEAP.concat(MID, BIG);
    const pay = o => Object.assign({ type: 'pay', person: SELLER, items: [] }, o);
    const chg = o => Object.assign({ type: 'change', person: cust(), items: [] }, o);
    const it = (name, price, qty) => ({ name, price, qty: qty || 1 });
    const minAtLeast = (gen, keys, k) => { for (let i = 0; i < 200; i++) { const v = gen(); if ((decompose(v, keys) || []).length >= k) return v; } return gen(); };
    const NOTES1 = ['n1000', 'n2000', 'n5000', 'n10000'];
    const NOTES2 = ['n1000', 'n2000', 'n5000', 'n10000', 'n20000', 'n50000'];
    const NOTES4 = NOTES2.concat(['n100000']);
    const COINS3 = ['c100', 'c200', 'c500', 'c1000'];
    const hundreds = (a, b) => { let v; do { v = rand(a, b) * 100; } while (v % 1000 === 0); return v; };
    const T1 = 't1000';
    const lv = (say, rounds, spoken) => ({ say, spoken, rounds });

    const tk = [
      // 1-2: pay 1-3 coins, a dashed slot for every coin
      lv('Bayar permennya. Taruh koin di setiap titik.', () => [pay({ items: [it('permen', K(rand(1, 2)))], denoms: [T1], slots: true })]),
      lv('Taruh satu koin di setiap titik, lalu tekan Bayar.', () => [pay({ items: [it(pick1(['klepon', 'kerupuk', 'jeruk']), K(rand(2, 3)))], denoms: [T1], slots: true })]),
      // 3: up to 5 coins, count the dots on the tag (no slots)
      lv('Lihat titiknya. Bayar koin sebanyak itu.', () => [pay({ items: [it(pick1(MID), K(rand(4, 5)))], denoms: [T1] })]),
      // 4: which is dearer (more coins), then pay for it
      lv('Mana yang lebih mahal? Ketuk barangnya.', () => {
        let a = rand(1, 5), b; do { b = rand(1, 5); } while (Math.abs(a - b) < 2);
        const nm = pickN(MID.concat(['kelapa', 'semangka']), 2);
        return [pay({ pick: { kind: 'pricier', options: [{ name: nm[0], price: K(a) }, { name: nm[1], price: K(b) }] }, denoms: [T1], slots: true })];
      }),
      // 5: two things (2 + 1), slots grouped per thing
      lv('Beli dua barang. Bayar semua titiknya.', () => {
        const pr = pick1([[2, 1], [1, 2], [3, 1], [2, 2]]), nm = pickN(['permen', 'klepon', 'kerupuk', 'jeruk', 'apel'], 2);
        return [pay({ items: [it(nm[0], K(pr[0])), it(nm[1], K(pr[1]))], denoms: [T1], slots: true, slotGroups: pr })];
      }),
      // 6: challenge <= 5, no slots: one thing, then two things
      lv('Tantangan! Bayar dengan koin yang pas.', () => {
        const a = rand(1, 3), b = rand(1, 5 - a), nm = pickN(['permen', 'klepon', 'kerupuk', 'jeruk', 'apel', 'pisang'], 3);
        return [pay({ items: [it(nm[0], K(rand(3, 5)))], denoms: [T1] }), pay({ items: [it(nm[1], K(a)), it(nm[2], K(b))], denoms: [T1] })];
      })
    ];

    const k1 = [
      // thousands only, prices Rp1.000 to Rp20.000
      lv('Bayar pas dengan uang seribuan.', () => [pay({ items: [it(pick1(CHEAP), K(rand(3, 9)))], denoms: ['n1000'] })]),
      lv('Bayar pas. Pakai dua ribuan dan seribuan.', () => [pay({ items: [it(pick1(MID), K(rand(5, 12)))], denoms: ['n1000', 'n2000'] })]),
      lv('Ada lima ribuan sekarang. Bayar pas, ya.', () => [pay({ items: [it(pick1(MID.concat(BIG)), K(rand(7, 15)))], denoms: ['n1000', 'n2000', 'n5000'] })]),
      // 4: change from 10.000 (pairs of 10: price 5-9 ribu)
      lv('Pembeli bayar sepuluh ribu. Berikan kembaliannya.', () => [chg({ items: [it(pick1(ANY), K(rand(5, 9)))], paid: ['n10000'], denoms: ['n1000', 'n2000', 'n5000'] })]),
      // 5: two things added, 2-9 ribu each, total <= 18 ribu
      lv('Beli dua barang. Jumlahkan harganya, lalu bayar.', () => { const a = rand(2, 9), b = rand(2, Math.min(9, 18 - a)), nm = pickN(ANY, 2); return [pay({ items: [it(nm[0], K(a)), it(nm[1], K(b))], denoms: NOTES1 })]; }),
      // 6: change from 20.000, price 11-18 ribu
      lv('Pembeli bayar dua puluh ribu. Berikan kembaliannya.', () => [chg({ items: [it(pick1(BIG.concat(MID)), K(rand(11, 18)))], paid: ['n20000'], denoms: ['n1000', 'n2000', 'n5000'] })]),
      // 7: fewest notes (Rp8.000 = 5 + 2 + 1), only amounts needing 3 or more notes
      lv('Bayar pas dengan lembar paling sedikit.', () => [pay({ items: [it(pick1(MID), K(pick1([8, 9, 13, 16, 17, 18, 19])))], denoms: NOTES1, minimal: true })]),
      // 8: challenge, three customers
      lv('Tantangan! Tiga pembeli datang.', () => {
        const a = rand(2, 9), b = rand(2, Math.min(9, 20 - a)), nm = pickN(ANY, 4);
        return [pay({ items: [it(nm[0], K(a)), it(nm[1], K(b))], denoms: NOTES1 }),
          chg({ items: [it(nm[2], K(rand(4, 9)))], paid: ['n10000'], denoms: ['n1000', 'n2000', 'n5000'] }),
          chg({ items: [it(nm[3], K(rand(12, 17)))], paid: ['n20000'], denoms: ['n1000', 'n2000', 'n5000'] })];
      })
    ];

    const k2 = [
      // up to Rp100.000; 1: tens of thousands and thousands (Rp47.000)
      lv('Bayar pas dengan puluhan ribu dan ribuan.', () => [pay({ items: [it(pick1(BIG), K(rand(2, 8) * 10 + rand(1, 9)))], denoms: ['n1000', 'n10000'] })]),
      // 2: change from 50.000, price 21-46 ribu, count up
      lv('Hitung lanjut dari harga sampai lima puluh ribu.', () => [chg({ items: [it(pick1(BIG.concat(MID)), K(rand(21, 46)))], paid: ['n50000'], denoms: ['n1000', 'n2000', 'n5000', 'n10000', 'n20000'] })]),
      // 3: change from 100.000, price 51-94 ribu
      lv('Pembeli bayar seratus ribu. Berikan kembaliannya.', () => [chg({ items: [it(pick1(BIG), K(rand(51, 94)))], paid: ['n100000'], denoms: NOTES2 })]),
      // 4: fewest notes, 23-98 ribu needing at least 4 notes
      lv('Bayar pas dengan lembar paling sedikit.', () => [pay({ items: [it(pick1(BIG), minAtLeast(() => K(rand(23, 98)), NOTES2, 4))], denoms: NOTES2, minimal: true })]),
      // 5: three things, 3-25 ribu each, total <= 80 ribu
      lv('Beli tiga barang. Jumlahkan, lalu bayar pas.', () => { const nm = pickN(ANY, 3); return [pay({ items: nm.map(n => it(n, K(rand(3, 25)))), denoms: NOTES2 })]; }),
      // 6: enough or not: Rp20.000 for two things (3-15 ribu), then change
      lv('Uangnya dua puluh ribu. Pilih dua barang yang cukup.', () => {
        let ps;
        for (let g = 0; g < 200; g++) {
          ps = Array.from({ length: 5 }, () => K(rand(3, 15)));
          let ok = 0, bad = 0;
          for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) { if (ps[a] + ps[b] <= K(20)) ok++; else bad++; }
          if (ok >= 2 && bad >= 3 && new Set(ps).size === 5) break;
        }
        const nm = pickN(ANY, 5);
        return [chg({ pick: { kind: 'select', count: 2, budget: K(20), options: nm.map((n, i) => ({ name: n, price: ps[i] })) }, bubble: [{ money: 'n20000', text: rp(K(20)) }, { text: 'Mau beli dua barang.', small: true }], paid: ['n20000'], denoms: ['n1000', 'n2000', 'n5000', 'n10000'] })];
      }),
      // 7: which basket is dearer, and by how much (count up from the cheaper total)
      lv('Keranjang mana yang lebih mahal? Ketuk.', () => {
        let A, B;
        do { A = [K(rand(5, 30)), K(rand(5, 30))]; B = [K(rand(5, 30)), K(rand(5, 30))]; } while (Math.abs(A[0] + A[1] - B[0] - B[1]) < K(5) || Math.abs(A[0] + A[1] - B[0] - B[1]) > K(25));
        const nm = pickN(ANY, 4);
        return [pay({ pick: { kind: 'basket', baskets: [{ items: [it(nm[0], A[0]), it(nm[1], A[1])] }, { items: [it(nm[2], B[0]), it(nm[3], B[1])] }] }, denoms: NOTES2, bubble: [{ text: 'Pilih satu keranjang.', small: true }] })];
      }),
      // 8: challenge
      lv('Tantangan! Tiga pembeli datang.', () => {
        const nm = pickN(ANY, 4);
        return [pay({ items: [it(nm[0], K(rand(8, 30))), it(nm[1], K(rand(8, 30)))], denoms: NOTES2 }),
          chg({ items: [it(nm[2], K(rand(12, 44)))], paid: ['n50000'], denoms: ['n1000', 'n2000', 'n5000', 'n10000', 'n20000'] }),
          chg({ items: [it(nm[3], K(rand(52, 93)))], paid: ['n100000'], denoms: NOTES2 })];
      })
    ];

    const k3 = [
      // hundreds and thousands; 1: Rp3.500 with coins and notes
      lv('Bayar pas dengan koin dan uang kertas.', () => [pay({ items: [it(pick1(CHEAP.concat(MID)), hundreds(11, 49))], denoms: COINS3.concat(['n2000']) })]),
      // 2: change from 5.000 (Rp2.300 -> Rp2.700)
      lv('Hitung lanjut dari harga sampai lima ribu.', () => [chg({ items: [it(pick1(CHEAP.concat(MID)), hundreds(11, 47))], paid: ['n5000'], denoms: COINS3.concat(['n2000']) })]),
      // 3: multiplication, n packets at the same price
      lv('Beberapa bungkus, harganya sama. Bayar semuanya.', () => [pay({ items: [it(pick1(['kerupuk', 'klepon', 'permen']), pick1([1200, 1500, 2500, 1800, 2200]), rand(3, 5))], denoms: ['c100', 'c200', 'c500', 'c1000', 'n2000', 'n5000', 'n10000'] })]),
      // 4: division, three children share a price equally
      lv('Tiga anak patungan. Bagi uangnya sama rata.', () => { const sh = pick1([2000, 2500, 3000, 3500, 4000, 5000]); const nm = pick1(['semangka', 'kelapa', 'keranjang']); return [{ type: 'share', person: SELLER, kids: 3, items: [it(nm, sh * 3)], bubble: [{ item: nm, text: rp(sh * 3) }, { text: 'Dibagi tiga, sama rata.', small: true }], denoms: ['c500', 'c1000', 'n2000', 'n5000'] }]; }),
      // 5: several things, change from 50.000 (multiples of 500, total <= 40 ribu)
      lv('Beli beberapa barang. Berikan kembalian dari lima puluh ribu.', () => { const n = rand(2, 3), nm = pickN(ANY, n); return [chg({ items: nm.map(x => it(x, rand(5, 26) * 500)), paid: ['n50000'], denoms: ['c500', 'c1000', 'n2000', 'n5000', 'n10000', 'n20000'] })]; }),
      // 6: fewest notes and coins (Rp3.800 = 2.000 + 1.000 + 500 + 200 + 100)
      lv('Bayar pas dengan lembar dan koin paling sedikit.', () => { const keys = COINS3.concat(['n2000', 'n5000']); return [pay({ items: [it(pick1(MID), minAtLeast(() => hundreds(11, 99), keys, 4))], denoms: keys, minimal: true })]; }),
      // 7: exchange a note for coins: how many pieces
      lv('Tukar uangnya jadi koin, ya.', () => { const ex = Math.random() < 0.6 ? ['n10000', 'c500'] : ['n5000', 'c500']; return [chg({ exchange: true, paid: [ex[0]], denoms: [ex[1]], bubble: [{ money: ex[0], text: 'Tukar jadi', small: true }, { money: ex[1], coin: true, text: 'koin ' + rp(DEN[ex[1]].v) }] })]; }),
      // 8: challenge
      lv('Tantangan! Tiga pembeli datang.', () => {
        const nm = pickN(ANY, 3);
        return [pay({ items: [it(nm[0], hundreds(21, 49))], denoms: COINS3.concat(['n2000']) }),
          chg({ items: [it(nm[1], hundreds(51, 97))], paid: ['n10000'], denoms: COINS3.concat(['n2000', 'n5000']) }),
          pay({ items: [it(pick1(['kerupuk', 'klepon']), pick1([1500, 2500, 1200]), rand(3, 4))], denoms: ['c100', 'c500', 'c1000', 'n2000', 'n5000', 'n10000'] })];
      })
    ];

    const k4 = [
      // up to Rp1.000.000; 1: pay hundreds of thousands, then change from 500.000
      lv('Belanja ratusan ribu. Bayar pas, lalu beri kembalian.', () => [
        pay({ items: [it('karung', rand(21, 79) * 5000)], denoms: ['n5000', 'n10000', 'n20000', 'n50000', 'n100000'] }),
        chg({ items: [it(pick1(['keranjang', 'tampah']), K(rand(201, 479)))], paid: Array(5).fill('n100000'), denoms: NOTES4 })]),
      // 2: rounding and estimation, is 50.000 enough for three things
      lv('Cukupkah lima puluh ribu? Perkirakan dulu.', () => {
        const mk = enough => {
          let r;
          do { r = [rand(1, 5), rand(1, 5), rand(1, 5)].map(x => x * 5); } while (enough ? r.reduce((a, b) => a + b, 0) > 46 : (r.reduce((a, b) => a + b, 0) < 55 || r.reduce((a, b) => a + b, 0) - Math.min(...r) > 45));
          const nm = pickN(ANY, 3);
          return chg({ pick: { kind: 'estimate', budget: K(50) }, items: r.map((x, i) => it(nm[i], K(x) - rand(1, 9) * 100)), paid: ['n50000'], denoms: ['c100', 'c200', 'c500', 'n1000', 'n2000', 'n5000', 'n10000', 'n20000'] });
        };
        return GS.shuffle([mk(true), mk(false)]);
      }),
      // 3: unit price: three singly or a pack of three
      lv('Mau beli tiga. Mana yang lebih hemat?', () => [0, 1].map(() => {
        const u = pick1([3000, 4000, 4500, 5000, 6000, 7500]), d = pick1([-3000, -1500, -1000, 1000, 1500]);
        return pay({ pick: { kind: 'offer', name: pick1(['botol', 'kerupuk', 'jeruk', 'apel', 'klepon']), unit: u, pack: 3 * u + d }, bubble: [{ text: 'Aku mau beli tiga.', small: true }], denoms: ['c500', 'n1000', 'n2000', 'n5000', 'n10000', 'n20000'] });
      })),
      // 4: two-digit multiplication: 12 bottles at Rp4.500
      lv('Banyak botol, harganya sama. Bayar semuanya.', () => { let n, u; do { n = rand(11, 15); u = pick1([2500, 3500, 4500, 1500]); } while (n * u > 70000); return [pay({ items: [it('botol', u, n)], denoms: ['c500', 'n1000', 'n2000', 'n5000', 'n10000', 'n20000', 'n50000'] })]; }),
      // 5: budget: as many things as Rp100.000 allows, then change
      lv('Uangnya seratus ribu. Belanja sebanyak mungkin.', () => {
        let ps;
        do { ps = Array.from({ length: 6 }, () => K(rand(8, 38))); } while (ps.reduce((a, b) => a + b, 0) <= K(115) || new Set(ps).size < 6);
        const nm = pickN(ANY, 6);
        return [chg({ pick: { kind: 'select', maximal: true, budget: K(100), options: nm.map((n, i) => ({ name: n, price: ps[i] })) }, bubble: [{ money: 'n100000', text: rp(K(100)) }, { text: 'Belanja sebanyak mungkin!', small: true }], paid: ['n100000'], denoms: NOTES2 })];
      }),
      // 6: division with remainder: pencils at a fixed price, as many as possible, then the change
      lv('Beli pensil sebanyak mungkin, lalu beri kembalian.', () => {
        const c = pick1([[25000, 3000], [20000, 3000], [25000, 4000], [30000, 4000], [50000, 7000]]);
        return [chg({ items: [it('pensil', c[1])], qtyItem: { name: 'pensil', price: c[1], max: 12 }, bubble: [{ item: 'pensil', text: rp(c[1]) }, { text: 'Sebanyak mungkin, ya.', small: true }], paid: decompose(c[0], ['n5000', 'n10000', 'n20000', 'n50000']), denoms: ['n1000', 'n2000', 'n5000'] })];
      }),
      // 7: mixed
      lv('Campuran! Dua pembeli datang.', () => {
        const nm = pickN(ANY, 3);
        return [pay({ items: [it(nm[0], pick1([12500, 7500, 8500, 6500]), rand(3, 6))], denoms: ['c500', 'n1000', 'n2000', 'n5000', 'n10000', 'n20000', 'n50000'] }),
          chg({ items: [it(nm[1], K(rand(12, 40)) + pick1([0, 500])), it(nm[2], K(rand(10, 40)))], paid: ['n100000'], denoms: ['c500'].concat(NOTES2) })];
      }),
      // 8: challenge
      lv('Tantangan! Tiga pembeli datang.', () => [
        pay({ items: [it('karung', minAtLeast(() => K(rand(120, 980)), NOTES4, 6))], denoms: NOTES4, minimal: true }),
        chg({ items: [it(pick1(['keranjang', 'tampah']), K(rand(510, 960)))], paid: Array(10).fill('n100000'), denoms: NOTES4 }),
        (() => { const u = pick1([4000, 5000, 6000]), d = pick1([-2000, -1000, 1500]); return pay({ pick: { kind: 'offer', name: pick1(['botol', 'jeruk', 'apel']), unit: u, pack: 3 * u + d }, bubble: [{ text: 'Aku mau beli tiga.', small: true }], denoms: ['n1000', 'n2000', 'n5000', 'n10000', 'n20000'] }); })()])
    ];
    const by = { tk, k1, k2, k3, k4 };
    return by[tier] || k1;
  }

  /* ============================== test hook ============================== */
  window.__game = {
    go: i => run.go(i),
    count: () => LEVELS.length,
    tier: () => TIER,
    speed(n) { SPEED = Math.max(1, +n || 1); },
    async solve() { if (S.busy || S.over || !S.solver) return; await S.solver(); },
    get state() { return { level: run.current, round: S.round, rounds: S.rounds.length, busy: S.busy, tries: S.tries, money: !!S.money, tray: S.tray.map(p => p.v), goal: S.money && S.money.goal, start: S.money && S.money.start }; }
  };

  drawStatic();
  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
