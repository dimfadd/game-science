/* Lampu Hias (lampu)
 * The kampung prepares the festival lights. On a wooden board the child connects small batteries,
 * bulbs, switches and test objects by dragging wire clips onto brass posts (they snap within a
 * generous radius). A real circuit solver decides what happens; nothing is snapped onto an answer.
 *
 * Physical model (stated, used for every circuit in the game):
 *   - A cell is an ideal 1.5 V source with a tiny internal resistance r = 0.002 (per cell), so a
 *     battery joined straight from + to - (a short circuit) drives a huge current: the solver flags
 *     it, the voltage collapses and no bulb lights. A short never solves a level; a gentle safety
 *     note follows ("baterai kecil" only, never house mains).
 *   - Wires, closed switches and metal objects are 0.001 (practically zero resistance).
 *   - A bulb is a fixed resistor R = (Vr / 1.5)^2 (Vr = its rated voltage, 1.5 V or 3 V). Brightness
 *     is its power over its rated power, b = (V_bulb / Vr)^2: below 0.03 dark, below 0.5 dim (redup),
 *     up to 1.6 bright (terang), up to 3 very bright, above 3 the filament burns (putus) and the bulb
 *     becomes an open circuit. Filament bulbs light in either polarity.
 *   - Insulators (wood, leaf, glass marble, styrofoam, stone, cotton) leave the gap open.
 *   - Node voltages come from nodal analysis (Norton sources, Gaussian elimination with pivoting).
 *     So series bulbs share the voltage (dimmer), parallel bulbs each get the full voltage (as bright
 *     as one), a removed bulb in series opens the only path, in parallel only its own branch.
 *   - Meter (k4): current through a 0.001 element; I = V / R with ideal cells.
 *   - Electromagnet: strength proportional to turns x current (coil resistance taken as fixed),
 *     paper clips lifted = floor(turns x current / 15) (1 cell, 10 turns: 1 clip).
 *   - Energy (k3/k4): one energy block = one lamp for one hour; a kWh token holds 1000 Wh and a lamp
 *     of W watts uses W Wh per hour. Lamps go dark exactly when the energy runs out.
 * Feedback always comes from the board: the lamp stays dark, glows dim, burns, the clips fall. */
(function () {
  'use strict';
  const GAME = 'lampu';
  const TIER = (window.GS && GS.tier) ? GS.tier() : 'k1';   // tk | k1 | k2 | k3 | k4
  const TK = TIER === 'tk';
  const OUT = '#3B2A20', INK = '#2B1D14', CREAM = '#FFF8EC';
  const SNAP = TK ? 88 : 72;                 // a dropped clip joins the nearest post within this radius
  let SPEED = 1;
  const ms = v => v / SPEED;
  const wait = d => GS.wait(ms(d));
  const tw = (d, fn, e) => GS.tween(ms(d), (v, raw) => fn(Math.max(0, v), Math.max(0, raw)), e);

  /* ================= small utilities ================= */
  const n1 = v => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const R0 = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => GS.shuffle(a);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const fxRand = () => (GS.fxRandom || Math.random)();   // effects only: never shifts a race's seeded stream
  const salt = fxRand().toString(36).slice(2, 5);
  let uidN = 0;
  const uid = p => 'lh' + salt + p + (++uidN).toString(36);
  const dec = v => { const r = Math.round(v * 10) / 10; return String(r).replace('.', ','); };
  const rp = v => 'Rp' + String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ================= drawing helpers (Kampung Chunky) ================= */
  const P3 = {
    red: ['#E2453C', '#F27A6E', '#B5322B'], orange: ['#F28C28', '#F8B26A', '#C76A12'], yellow: ['#FFC83D', '#FFE08A', '#E09A00'],
    green: ['#4DAA57', '#86CC8C', '#357F40'], blue: ['#2F80C9', '#6FAEE3', '#215F98'], wood: ['#A8673A', '#C68654', '#7E4A27'],
    gold: ['#D9A441', '#EECB7A', '#A8771F'], cream: ['#FFF8EC', '#FFFFFF', '#E8D9BF'], stone: ['#8C8F94', '#AEB1B5', '#63666B'],
    dark: ['#3A3436', '#5A5356', '#232022'], ply: ['#E9C795', '#F3DAB2', '#CFA46C'], steel: ['#959EA8', '#D6DCE2', '#626A74'],
    teal: ['#2BB3A6', '#7FD8CE', '#1E857B']
  };
  const Ci = (cx, cy, r, a) => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" ${a || ''}/>`;
  const El = (cx, cy, rx, ry, a) => `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" ${a || ''}/>`;
  const Rc = (x, y, w, h, rx, a) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(rx || 0)}" ${a || ''}/>`;
  const Pa = (d, a) => `<path d="${d}" ${a || ''}/>`;
  const fill = (c, op) => `fill="${c}"` + (op != null ? ` opacity="${op}"` : '');
  const ol = sw => `stroke="${OUT}" stroke-width="${n1(sw || 3)}" stroke-linejoin="round" stroke-linecap="round"`;
  const solid = (c, sw) => `fill="${c}" ${ol(sw)}`;
  const line = (d, sw, c, op) => `<path d="${d}" fill="none" stroke="${c || OUT}" stroke-width="${n1(sw || 3)}" stroke-linecap="round" stroke-linejoin="round"${op != null ? ` opacity="${op}"` : ''}/>`;
  const shadowE = (cx, cy, rx) => El(cx, cy, rx, Math.max(3, rx * 0.2), fill(OUT, 0.18));
  const txt = (x, y, s, size, o) => {
    o = o || {};
    return `<text x="${n1(x)}" y="${n1(y)}" font-size="${size}" text-anchor="${o.anchor || 'middle'}" fill="${o.fill || INK}"${o.cls ? ` class="${o.cls}"` : ''}${o.decor ? ' data-qc="decor"' : ''} font-weight="${o.w || 700}" style="font-variant-numeric:tabular-nums">${esc(s)}</text>`;
  };
  const NUM = 'lh-num', BODY = 'lh-body';
  /** Cream pill with dark text: labels on the board. */
  function pill(x, y, s, size, o) {
    o = o || {};
    const w = o.w || Math.max(size * 1.6, String(s).length * size * 0.56 + size * 0.9), h = size * 1.42;
    return Rc(x - w / 2, y - h / 2, w, h, h / 2, `fill="${o.bg || CREAM}" ${ol(2.6)}`) + txt(x, y + size * 0.35, s, size, { cls: o.cls || NUM, fill: o.fill || INK, decor: o.decor });
  }
  /** 3-tone fill: shade crescent (bottom-right), base, highlight blob (top-left), outline. */
  function f3(shape, box, c, o) {
    o = o || {};
    const x = box[0], y = box[1], w = box[2], h = box[3], id = uid('c'), off = Math.min(w, h) * (o.k == null ? 0.1 : o.k);
    let s = `<clipPath id="${id}">${shape('')}</clipPath><g clip-path="url(#${id})">` +
      `<rect x="${n1(x - 6)}" y="${n1(y - 6)}" width="${n1(w + 12)}" height="${n1(h + 12)}" fill="${c[2]}"/>` +
      `<g transform="translate(${n1(-off)} ${n1(-off)})">${shape(`fill="${c[0]}"`)}</g>`;
    if (o.hl !== false) {
      const hx0 = x + w * (o.hx == null ? 0.28 : o.hx), hy0 = y + h * (o.hy == null ? 0.26 : o.hy);
      s += `<ellipse cx="${n1(hx0)}" cy="${n1(hy0)}" rx="${n1(Math.max(2, w * 0.14))}" ry="${n1(Math.max(1.5, h * 0.08))}" transform="rotate(-25 ${n1(hx0)} ${n1(hy0)})" fill="${c[1]}" opacity=".85"/>`;
    }
    s += (o.inner || '') + '</g>';
    if (o.ol !== false) s += shape(`fill="none" ${ol(o.sw)}`);
    return s;
  }
  const box3 = (x, y, w, h, r, c, o) => f3(a => Rc(x, y, w, h, r, a), [x, y, w, h], c, o);
  const disc3 = (x, y, r, c, o) => f3(a => Ci(x, y, r, a), [x - r, y - r, 2 * r, 2 * r], c, o);
  /** Brass screw post: where wire clips are fastened. */
  const post = (x, y) => Ci(x + 2, y + 4, 21, fill(OUT, 0.2)) + disc3(x, y, 19, P3.gold, { k: .14 }) + line(`M${n1(x - 8)} ${n1(y + 8)}L${n1(x + 8)} ${n1(y - 8)}`, 3.4, '#8A6418');
  const strip = (x1, y1, x2, y2) => line(`M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}`, 11, OUT) + line(`M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}`, 6, '#C9CED4');

  /* Festival glass colours, each with a second cue (a shape), never red vs green alone. */
  const GLASS = {
    merah: { name: 'merah', base: '#E2453C', hl: '#F8A49B', pale: '#F6C9C2', glow: '#FF8A70', sym: 'dot' },
    biru: { name: 'biru', base: '#2F80C9', hl: '#9CCBF2', pale: '#C9DFF2', glow: '#7CC0FF', sym: 'tri' },
    kuning: { name: 'kuning', base: '#FFC83D', hl: '#FFEBA3', pale: '#FBEBC0', glow: '#FFE070', sym: 'star' },
    hijau: { name: 'hijau', base: '#4DAA57', hl: '#A9DDAE', pale: '#CFE7CF', glow: '#8CEB93', sym: 'sq' }
  };
  function symbol(kind, x, y, r, c, sw) {
    const a = `fill="${c || '#FFFFFF'}" stroke="${OUT}" stroke-width="${sw || 2.4}" stroke-linejoin="round"`;
    if (kind === 'dot') return Ci(x, y, r * .8, a);
    if (kind === 'tri') return Pa(`M${n1(x)} ${n1(y - r)}L${n1(x + r * .95)} ${n1(y + r * .7)}L${n1(x - r * .95)} ${n1(y + r * .7)}Z`, a);
    if (kind === 'sq') return Rc(x - r * .72, y - r * .72, r * 1.44, r * 1.44, r * .2, a);
    let d = '';
    for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; d += (i ? 'L' : 'M') + n1(x + Math.cos(t) * q) + ' ' + n1(y + Math.sin(t) * q); }
    return Pa(d + 'Z', a);
  }

  /* ================= component art (all relative to the component centre) ================= */
  const CELL_T = 128;
  /** A 1.5 V cell lying on its side; + at the right unless flipped. sc scales the body only. */
  function cellBody(flip, o) {
    o = o || {};
    const s = flip ? -1 : 1, dead = o.dead;
    const body = dead ? ['#9A9396', '#B8B2B4', '#7A7477'] : P3.dark, band = dead ? ['#C9B9A6', '#DDD0C0', '#A99886'] : P3.orange;
    let g = box3(-96, -36, 192, 72, 16, body, { k: .12, hl: false });
    const bx = s > 0 ? 14 : -96;
    g += Rc(bx, -36, 82, 72, 16, fill(band[0])) + Rc(s > 0 ? 14 : -40, -36, 26, 72, 0, fill(band[0])) + Rc(bx + 8, -30, 50, 10, 5, fill(band[1], .8));
    g += Rc(-96, -36, 192, 72, 16, `fill="none" ${ol(3.4)}`);
    g += box3(s > 0 ? 96 : -108, -15, 12, 30, 4, P3.steel, { k: .2, hl: false, sw: 2.6 });
    g += txt(s * 56, 14, '+', 46, { fill: INK, w: 800, decor: true }) + txt(-s * 56, 14, '−', 46, { fill: '#FFF8EC', w: 800, decor: true });
    if (o.label) g += txt(-s * 8, 11, o.label, 28, { fill: dead ? '#5A5356' : '#FFF8EC', decor: true });
    if (dead) g += Rc(-30, -24, 40, 18, 4, `fill="none" ${ol(2.4)}`) + Rc(-26, -20, 7, 10, 2, fill('#E2453C'));
    return g;
  }
  function cellArt(c) {
    let s = shadowE(0, 44, 120) + strip(-CELL_T, 0, -96, 0) + strip(96, 0, CELL_T, 0) + post(-CELL_T, 0) + post(CELL_T, 0);
    s += cellBody(c.flip, { label: c.showV ? '1,5 V' : '', dead: c.dead });
    return s;
  }
  /** Small cell used inside holders and in the tray (about 62%). */
  const smallCell = (o) => `<g transform="scale(.62)">${cellBody(false, o)}</g>`;

  const BULB_T = 92, BULB_TY = 30, GLOBE_Y = -78, GLOBE_R = 52;
  function bulbBase(c) {
    let s = shadowE(0, 60, 96) + strip(-BULB_T, BULB_TY, -50, BULB_TY) + strip(50, BULB_TY, BULB_T, BULB_TY) + post(-BULB_T, BULB_TY) + post(BULB_T, BULB_TY);
    s += box3(-62, 6, 124, 50, 12, c.base || P3.blue, { k: .14 });
    if (c.showV) s += txt(0, 44, c.Vr === 3 ? '3 V' : '1,5 V', 30, { fill: '#FFF8EC', cls: NUM });
    return s;
  }
  /** Glass, filament and light of a bulb for a brightness b (power / rated power) and level. */
  function glassArt(c, st) {
    const G = c.col ? GLASS[c.col] : null, lvl = st ? st.lvl : 0, b = st ? st.b : 0, burnt = c.burnt;
    const cy = GLOBE_Y, r = GLOBE_R;
    let s = '';
    if (!burnt && lvl >= 1) {
      const k = Math.sqrt(Math.min(b, 3)), hc = G ? G.glow : '#FFE08A';
      s += Ci(0, cy, r + 26 + 50 * k, fill(hc, .2)) + Ci(0, cy, r + 10 + 26 * k, fill(hc, .32));
      const len = 10 + 34 * k;
      let d = '';
      for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2 + 0.31; d += `M${n1(Math.cos(t) * (r + 14))} ${n1(cy + Math.sin(t) * (r + 14))}l${n1(Math.cos(t) * len)} ${n1(Math.sin(t) * len)}`; }
      s += line(d, 7, hc, .95);
    }
    s += box3(-30, -30, 60, 38, 6, P3.steel, { k: .18, hl: false, inner: line('M-30 -18H30M-30 -6H30', 2.4, '#626A74') });
    let gl;
    if (burnt) gl = '#A9A39A';
    else if (!G) gl = lvl === 0 ? '#E6EEF2' : lvl === 1 ? '#FFD36E' : lvl === 2 ? '#FFF1A6' : '#FFFBE6';
    else gl = lvl === 0 ? G.pale : lvl === 1 ? G.base : G.hl;
    s += Ci(0, cy, r, `fill="${gl}" ${ol(3.4)}`);
    const fc = burnt ? '#5A5356' : lvl === 0 ? '#8C8F94' : lvl === 1 ? '#F28C28' : '#FFFFFF';
    if (burnt) s += line(`M-12 -28L-12 -58Q-8 -70 -3 -66M12 -28L12 -58Q8 -72 4 -70`, 3.6, fc) + El(-6, cy - 4, 18, 12, fill('#5A5356', .45));
    else s += line(`M-12 -28L-12 -58Q-6 -82 0 -66Q6 -82 12 -58L12 -28`, lvl >= 2 ? 5 : 3.6, fc);
    if (G) s += symbol(G.sym, 0, cy + 22, 13, lvl >= 1 ? '#FFFFFF' : G.base, 2.4);
    s += El(-20, cy - 22, 12, 8, fill('#FFFFFF', .75));
    return s;
  }
  function switchArt(c) {
    let s = shadowE(0, 34, 110) + box3(-108, -26, 216, 52, 16, P3.cream, { k: .14 });
    s += post(-80, 0) + post(80, 0);
    // contact clip at the right post
    s += Pa('M66 -26L72 -6L88 -6L94 -26', `fill="none" ${ol(3.4)}`) + Pa('M68 -24L73 -8L87 -8L92 -24', `fill="none" stroke="#C9CED4" stroke-width="2.2"`);
    return s;
  }
  /** Knife-switch lever (pivot at the left post). Angle 0 = closed. */
  function leverArt(on, len, toY) {
    const ang = on ? (toY ? Math.atan2(toY, 160) * 180 / Math.PI : 0) : -38;
    return `<g transform="translate(-80 0) rotate(${n1(ang)})">` + line(`M0 0L${len || 168} 0`, 15, OUT) + line(`M0 0L${len || 168} 0`, 8.5, '#C9CED4') +
      Ci(len ? len - 6 : 162, 0, 19, solid('#F28C28', 3.2)) + Ci(len ? len - 12 : 156, -5, 6, fill('#F8B26A')) + Ci(0, 0, 9, solid('#D9A441', 2.6)) + '</g>';
  }
  function spdtArt(c) {
    let s = shadowE(0, 100, 110) + box3(-108, -96, 216, 192, 18, P3.cream, { k: .1 });
    s += post(-80, 0) + post(80, -60) + post(80, 60);
    return s;
  }
  /** Crocodile clips facing each other: the test gap. */
  function gapArt(c) {
    let s = shadowE(0, 58, 140) + Rc(-150, 28, 300, 22, 11, solid('#C9A06A', 2.6));
    s += Rc(-66, -62, 132, 104, 18, `fill="#FFF8EC" opacity=".55" stroke="#9E7444" stroke-width="3" stroke-dasharray="10 8"`);
    [-1, 1].forEach(d => {
      s += strip(d * 116, 0, d * 86, 0) + post(d * 116, 0);
      s += `<g transform="translate(${d * 84} 0) scale(${d} 1)">` + Pa('M0 -12L-22 -16L-30 -4L-22 -2L0 -4Z', solid('#E2453C', 2.8)) + Pa('M0 12L-22 16L-30 4L-22 2L0 4Z', solid('#E2453C', 2.8)) +
        line('M-30 -4l4 2M-30 4l4 -2', 2.4, '#C9CED4') + '</g>';
    });
    return s;
  }
  function holderW(c) { return c.n * 138 + 40; }
  function holderArt(c) {
    const W = holderW(c), x0 = -W / 2;
    let s = shadowE(0, 46, W / 2 + 10) + strip(x0 - 36, 0, x0, 0) + strip(-x0, 0, -x0 + 36, 0) + post(x0 - 36, 0) + post(-x0 + 36, 0);
    s += box3(x0, -40, W, 80, 14, P3.dark, { k: .1, hl: false });
    for (let i = 0; i < c.n; i++) s += Rc(x0 + 20 + i * 138 + 4, -30, 130, 60, 10, `fill="#5A5356" stroke="#232022" stroke-width="2"`);
    s += line(`M${x0 + 8} -16l6 8l-6 8l6 8l-6 8`, 3, '#C9CED4');
    s += txt(x0 + 2, -50, '−', 40, { decor: true, w: 800 }) + txt(-x0 - 2, -50, '+', 40, { decor: true, w: 800 });
    return s;
  }
  function packArt(c) {
    let s = shadowE(0, 58, 150) + strip(-150, 0, -118, 0) + strip(118, 0, 150, 0) + post(-150, 0) + post(150, 0);
    s += box3(-118, -50, 236, 100, 16, P3.dark, { k: .1, hl: false }) + Rc(-110, -42, 46, 84, 10, fill('#F28C28')) + Rc(64, -42, 46, 84, 10, fill('#F28C28'));
    s += txt(0, 18, dec(c.V) + ' V', 50, { fill: '#FFF8EC', cls: NUM });
    s += txt(-87, 14, '−', 40, { decor: true, w: 800 }) + txt(87, 14, '+', 40, { decor: true, w: 800 });
    return s;
  }
  function meterArt(c) {
    let s = shadowE(0, 120, 120) + strip(-130, 70, -80, 70) + strip(80, 70, 130, 70) + post(-130, 70) + post(130, 70);
    s += box3(-96, -100, 192, 200, 26, P3.blue, { k: .08 });
    s += Ci(0, -20, 70, solid('#FFF8EC', 3));
    let d = '';
    for (let i = 0; i <= 10; i++) { const t = (-150 + i * 12) * Math.PI / 180; d += `M${n1(Math.cos(t) * 52)} ${n1(-20 + Math.sin(t) * 52)}L${n1(Math.cos(t) * (i % 5 ? 60 : 64))} ${n1(-20 + Math.sin(t) * (i % 5 ? 60 : 64))}`; }
    s += line(d, 3, OUT) + txt(0, 22, 'A', 34, { decor: true });
    return s;
  }
  function slotArt(c) {
    let s = shadowE(0, 50, 140) + Rc(-150, 26, 300, 20, 10, solid('#C9A06A', 2.6));
    s += Rc(-70, -46, 140, 84, 16, `fill="#FFF8EC" opacity=".55" stroke="#9E7444" stroke-width="3" stroke-dasharray="10 8"`);
    [-1, 1].forEach(d => { s += strip(d * 116, 0, d * 76, 0) + post(d * 116, 0) + Rc(d * 76 - 8, -12, 16, 24, 4, solid('#C9CED4', 2.4)); });
    return s;
  }
  function socketArt(c) {
    let s = shadowE(0, 80, 160) + strip(-150, 0, -124, 0) + strip(124, 0, 150, 0) + post(-150, 0) + post(150, 0);
    s += box3(-124, 20, 248, 52, 14, P3.stone, { k: .12 });
    s += Rc(-104, -84, 208, 104, 18, `fill="#FFF8EC" opacity=".5" stroke="#63666B" stroke-width="3" stroke-dasharray="10 8"`);
    return s;
  }
  function postArt() { return shadowE(0, 22, 30) + Rc(-30, 4, 60, 22, 8, solid('#A8673A', 2.6)) + post(0, 0); }
  /* Movable items (tray objects, cells, resistors, sources, loose bulbs). */
  const COND = { sendok: 'sendok', koin: 'koin', paku: 'paku', baut: 'baut', gembok: 'gembok' };
  const INSUL = { kayu: 'stik kayu', daun: 'daun', kelereng: 'kelereng', gabus: 'gabus', batu: 'batu', kapas: 'kapas' };
  const OBJ_NAME = Object.assign({}, COND, INSUL);
  function resistorArt(R) {
    let s = line('M-84 0H84', 7, OUT) + line('M-84 0H84', 3.6, '#C9CED4');
    s += box3(-54, -24, 108, 48, 20, ['#E8D9BF', '#F6EEDF', '#CDBB9E'], { k: .14 });
    const bands = ['#7E4A27', '#E2453C', '#F28C28', '#FFC83D', '#4DAA57', '#2F80C9', '#8A5ACB'];
    [-30, -14, 2].forEach((x, i) => { s += Rc(x, -24, 9, 48, 0, fill(bands[(R + i * 3) % bands.length])); });
    s += Rc(-54, -24, 108, 48, 20, `fill="none" ${ol(3)}`);
    s += pill(0, -56, R + ' Ω', 40, { w: 104 });
    return s;
  }
  function panelArt() {
    let s = shadowE(0, 58, 96) + Pa('M-8 30L-24 58M8 30L24 58', `fill="none" ${ol(6)}`);
    s += box3(-92, -56, 184, 92, 8, ['#2F5FA8', '#5A86CC', '#1F4580'], { k: .08, hl: false });
    let g = '';
    for (let i = 1; i < 4; i++) g += `M${-92 + i * 46} -56V36`;
    g += 'M-92 -10H92';
    s += line(g, 2.6, '#9CC0EE', .9) + Pa('M-80 -50L-56 -50L-70 -18L-90 -18Z', fill('#FFFFFF', .35));
    return s;
  }
  function itemArt(it) {
    if (it.kind === 'obj') {
      if (it.name === 'pensil') return pencilObj();
      return `<g transform="translate(0 44) scale(1.05)">${GS.art.item(it.name, { shadow: false })}</g>`;
    }
    if (it.kind === 'cell') return smallCell({});
    if (it.kind === 'res') return resistorArt(it.R);
    if (it.kind === 'src') {
      if (it.name === 'panel') return panelArt();
      if (it.name === 'batu') return `<g transform="translate(0 48) scale(1.2)">${GS.art.item('batu', { shadow: false })}</g>`;
      return `<g transform="scale(.86)">${cellBody(false, { dead: it.name === 'habis', label: it.name === 'habis' ? '' : '' })}</g>`;
    }
    if (it.kind === 'bulb') return smallBulb(it.col);
    return '';
  }
  function pencilObj() {
    return `<g transform="rotate(-8)">` + Pa('M-70 -12L46 -12L70 0L46 12L-70 12Z', solid('#FFC83D', 3)) + Pa('M46 -12L70 0L46 12Z', solid('#F3DDA6', 2.6)) +
      Pa('M60 -5L70 0L60 5Z', fill('#3A3436')) + Rc(-82, -12, 14, 24, 4, solid('#F59AB0', 2.6)) + line('M-60 0H40', 2.4, '#E09A00') + '</g>';
  }
  function smallBulb(col) {
    const G = col ? GLASS[col] : null;
    return Rc(-16, 6, 32, 24, 5, solid('#959EA8', 2.6)) + Ci(0, -18, 28, solid(G ? G.base : '#FFF1A6', 3)) + (G ? symbol(G.sym, 0, -16, 11, '#FFFFFF', 2) : '') + El(-10, -30, 7, 5, fill('#FFFFFF', .75));
  }

  /* ================= component types =================
   * terms(c): terminal positions relative to the centre; edges(c, R, V, over): what the solver sees
   * (R(a, b, ohm, tag) a resistor between two of its terminals, V(p, n, volt, r) a source);
   * art(c): static body; dyn(c, st): state-dependent drawing; slot: items it can hold. */
  const RW = 1e-3, RIN = 0.002, LEAK = 1e-7, SHORT_I = 60;
  const bulbR = c => Math.pow((c.Vr || 1.5) / 1.5, 2);
  const TYPES = {
    cell: {
      terms: () => ({ l: [-CELL_T, 0], r: [CELL_T, 0] }),
      edges(c, R, V) { if (!c.dead) V(c.flip ? 'l' : 'r', c.flip ? 'r' : 'l', 1.5, RIN); },
      art: cellArt
    },
    pack: {
      terms: () => ({ l: [-150, 0], r: [150, 0] }),
      edges(c, R, V) { V('r', 'l', c.V, RIN * c.V / 1.5); },
      art: packArt
    },
    holder: {
      terms: c => ({ l: [-holderW(c) / 2 - 36, 0], r: [holderW(c) / 2 + 36, 0] }),
      edges(c, R, V) { const n = c.items.length; if (n) V('r', 'l', 1.5 * n, RIN * n); },
      art: holderArt,
      dyn(c) { return c.showV ? pill(0, -80, dec(1.5 * c.items.length) + ' V', 40, { w: 120 }) : ''; },
      slot: { accept: 'cell', cap: c => c.n, pos: (c, i) => [-holderW(c) / 2 + 20 + i * 138 + 69, 0] }
    },
    bulb: {
      terms: () => ({ a: [-BULB_T, BULB_TY], b: [BULB_T, BULB_TY] }),
      edges(c, R, V, o) { if (!c.burnt && !c.pulled && !(o.pull && o.pull[c.id])) R('a', 'b', bulbR(c), 'bulb'); },
      art: bulbBase,
      dyn(c, st, o) {
        const out = c.pulled || (o && o.pull && o.pull[c.id]);
        let s = '';
        if (c.choose) s += Ci(0, GLOBE_Y, GLOBE_R + 22, `fill="none" stroke="#1F6FD1" stroke-width="9" stroke-dasharray="16 10"`);
        if (out) return s + El(0, -4, 26, 10, fill('#3A3436')) + `<g transform="translate(0 -96)" opacity=".85">${glassArt(c, null)}</g>` + line('M0 -40V-56', 4, OUT);
        return s + glassArt(c, st);
      }
    },
    switch: {
      terms: () => ({ a: [-80, 0], b: [80, 0] }),
      edges(c, R, V, o) { const on = o.sw && o.sw[c.id] != null ? o.sw[c.id] : c.on; if (on) R('a', 'b', RW, 'sw'); },
      art: switchArt,
      dyn(c, st, o) { const on = o && o.sw && o.sw[c.id] != null ? o.sw[c.id] : c.on; return leverArt(on) + (c.label ? pill(0, -86, c.label, 44, { w: 84 }) : ''); }
    },
    spdt: {
      terms: c => { const m = c.mir ? -1 : 1; return { c: [-80 * m, 0], u: [80 * m, -60], d: [80 * m, 60] }; },
      edges(c, R, V, o) { const st = o.sw && o.sw[c.id] != null ? o.sw[c.id] : c.st; R('c', st ? 'd' : 'u', RW, 'sw'); },
      art: spdtArt,
      dyn(c, st, o) { const s = o && o.sw && o.sw[c.id] != null ? o.sw[c.id] : c.st; return leverArt(true, 172, s ? 60 : -60); }
    },
    gap: {
      terms: () => ({ a: [-116, 0], b: [116, 0] }),
      edges(c, R) { const it = c.items[0]; if (!it) return; if (COND[it.name]) R('a', 'b', RW, 'obj'); else if (it.name === 'pensil') R('a', 'b', 1, 'obj'); },
      art: gapArt,
      slot: { accept: 'obj', cap: () => 1, pos: () => [0, -8] }
    },
    rslot: {
      terms: () => ({ a: [-116, 0], b: [116, 0] }),
      edges(c, R) { const it = c.items[0]; if (it) R('a', 'b', it.R, 'res'); },
      art: slotArt,
      slot: { accept: 'res', cap: () => 1, pos: () => [0, 0] }
    },
    meter: {
      terms: () => ({ a: [-130, 70], b: [130, 70] }),
      edges(c, R) { R('a', 'b', RW, 'meter'); },
      art: meterArt,
      dyn(c, st) {
        const I = st && st.meters[c.id] != null ? st.meters[c.id] : 0, t = (-150 + 120 * clamp(I / (c.max || 10), 0, 1.05)) * Math.PI / 180;
        return line(`M0 -20L${n1(Math.cos(t) * 56)} ${n1(-20 + Math.sin(t) * 56)}`, 6, '#E2453C') + Ci(0, -20, 8, solid('#3A3436', 2)) + pill(0, 74, (st ? ampTxt(I) : '0') + ' A', 44, { w: 150 });
      }
    },
    socket: {
      terms: () => ({ l: [-150, 0], r: [150, 0] }),
      edges(c, R, V) { const it = c.items[0]; if (!it) return; if (it.name === 'baterai' || (it.name === 'panel' && RD && RD.sun)) V('r', 'l', 1.5, RIN); },
      art: socketArt,
      slot: { accept: 'src', cap: () => 1, pos: () => [0, -36] }
    },
    coil: {
      terms: () => ({ a: [-130, -150], b: [130, -150] }),
      edges(c, R) { R('a', 'b', 1, 'coil'); },
      art: c => post(-130, -150) + post(130, -150),
      dyn(c, st) { return coilArt(c, st); }
    },
    pencil: {
      terms: c => ({ a: [-70, 0], b: [c.cm * 10 + 70, 0] }),
      edges(c, R) { R('a', 'b', Math.max(1, c.L), 'pencil'); },
      art: pencilArt,
      dyn: c => pencilDyn(c)
    },
    post: { terms: () => ({ t: [0, 0] }), art: postArt },
    bin: {
      terms: () => ({}),
      art: binArt,
      slot: { accept: c => c.accept || 'obj', cap: c => c.cap || 9, pos: (c, i) => [((i % 2) - .5) * (c.w / 2 - 6), -c.h / 2 + 76 + Math.floor(i / 2) * 84] }
    }
  };
  const ampTxt = I => dec(Math.round(I * 10) / 10);
  function binArt(c) {
    const w = c.w, h = c.h;
    let s = shadowE(0, h / 2 + 8, w / 2) + box3(-w / 2, -h / 2, w, h, 22, c.pal || P3.ply, { k: .06, hl: false });
    s += Rc(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 16, `fill="#FFF8EC" opacity=".45"`);
    if (c.icon) s += `<g transform="translate(${-w / 2 + 44} ${-h / 2 + 46}) scale(.62)">${glassArt({ col: null }, c.icon === 'on' ? { lvl: 2, b: 1 } : null)}</g>`;
    if (c.label) s += txt(-w / 2 + 82, -h / 2 + 46, c.label, 30, { anchor: 'start', cls: BODY });
    return s;
  }
  /* Electromagnet: a big nail with a coil; the stand is drawn by the component, clips by the level. */
  function coilArt(c, st) {
    const turns = c.turns || 10;
    let s = Rc(-160, 186, 320, 24, 10, solid('#A8673A', 2.6)) + Rc(-150, -230, 22, 420, 8, solid('#A8673A', 2.6)) + Rc(-150, -230, 170, 22, 8, solid('#A8673A', 2.6));
    s += box3(-14, -212, 28, 250, 6, P3.steel, { k: .2, hl: false }) + Pa('M-14 38L0 70L14 38Z', solid('#959EA8', 2.8)) + box3(-34, -226, 68, 18, 6, P3.steel, { k: .2, hl: false });
    const top = -190, bot = 20, n = Math.round(turns / 2), dy = (bot - top) / n;
    let d = '';
    for (let i = 0; i < n; i++) { const y = top + dy * (i + .5); d += `M-24 ${n1(y - dy * .3)}Q0 ${n1(y + dy * .45)} 24 ${n1(y - dy * .3)}`; }
    s += line(d, 6.5, OUT) + line(d, 3.6, '#D9733A');
    s += line(`M-24 ${top - 4}C-60 ${top - 10} -100 -170 -130 -150`, 6, OUT) + line(`M-24 ${top - 4}C-60 ${top - 10} -100 -170 -130 -150`, 3, '#D9733A');
    s += line(`M24 ${bot}C70 ${bot} 110 -100 130 -150`, 6, OUT) + line(`M24 ${bot}C70 ${bot} 110 -100 130 -150`, 3, '#D9733A');
    s += pill(110, -10, turns + ' lilitan', 34, { w: 190 });
    // paper clips: a pile in the tray, the lifted ones hang in a chain under the nail tip
    const up = st && st.clips ? st.clips : 0, pile = c.pile || 12;
    for (let i = 0; i < up; i++) s += clipArt(0, 86 + i * 24, i % 2 ? 90 : 0);
    s += Rc(-110, 148, 220, 40, 10, solid('#C9A06A', 2.6));
    for (let i = 0; i < pile - up; i++) s += clipArt(-84 + (i % 7) * 28, 150 - Math.floor(i / 7) * 12, (i * 47) % 180);
    return s;
  }
  function clipArt(x, y, rot) {
    return `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${rot})">` + Pa('M-12 -4V8A5 5 0 0 0 -2 8V-8A7 7 0 0 1 12 -8V10A4 4 0 0 1 4 10V-4', `fill="none" stroke="${OUT}" stroke-width="5" stroke-linecap="round"`) +
      Pa('M-12 -4V8A5 5 0 0 0 -2 8V-8A7 7 0 0 1 12 -8V10A4 4 0 0 1 4 10V-4', `fill="none" stroke="#C9CED4" stroke-width="2.4" stroke-linecap="round"`) + '</g>';
  }
  /* Pencil graphite (k4): R = 1 ohm per cm between the fixed clip at 0 and the sliding clip. */
  const CM = 72;
  function pencilArt(c) {
    const W = c.cm * 10;
    let s = shadowE(W / 2, 40, W / 2 + 60) + Pa(`M-30 -20L${W} -20L${W + 40} 0L${W} 20L-30 20Z`, solid('#FFC83D', 3)) + Rc(-12, -9, W + 20, 18, 9, solid('#3A3436', 2.4));
    for (let i = 0; i <= 10; i++) s += line(`M${i * c.cm} 20V36`, 3, OUT) + txt(i * c.cm, 74, String(i), 36, { cls: NUM });
    s += txt(W + 86, 80, 'cm', 32, { cls: BODY });
    s += strip(-70, 0, -10, 0) + post(-70, 0) + post(W + 70, 0);
    return s;
  }
  function pencilDyn(c) {
    const x = c.L * c.cm, W = c.cm * 10;
    return line(`M${x} -40C${x + 40} -120 ${W + 30} -100 ${W + 70} -14`, 10, OUT) + line(`M${x} -40C${x + 40} -120 ${W + 30} -100 ${W + 70} -14`, 5.5, '#2F80C9');
  }

  /* ================= stage ================= */
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const el = (tag, attrs, parent) => GS.el(tag, attrs, parent);
  const bgG = el('g', { class: 'lh-bg' }, svg);
  GS.markup(bgG, GS.art.scene('kampung', 1280, 800));
  const skyG = el('g', {}, svg);        // sun / moon / night tint
  const tableG = el('g', {}, svg);
  GS.markup(tableG, box3(-620, 628, 2520, 200, 0, P3.wood, { k: .03, hl: false, ol: false }) + Rc(-620, 628, 2520, 16, 0, fill('#C68654')) + line('M-620 628H1900', 4, OUT));
  const boardG = el('g', {}, svg);
  const decoG = el('g', {}, svg);       // level-specific scenery under the parts
  const compG = el('g', {}, svg);
  const itemG = el('g', {}, svg);
  const wireG = el('g', {}, svg);
  const endG = el('g', {}, svg);
  const uiG = el('g', {}, svg);
  const fxG = el('g', {}, svg);
  function drawBoard(on, h) {
    boardG.innerHTML = '';
    if (!on) return;
    const y1 = h || 628;
    GS.markup(boardG, box3(24, 96, 1232, y1 - 96 + 12, 26, P3.ply, { k: .02, hl: false }) +
      Rc(44, 116, 1192, y1 - 136, 18, `fill="none" stroke="#CFA46C" stroke-width="3" opacity=".7"`));
    let d = '';
    for (let x = 84; x < 1220; x += 120) for (let y = 150; y < y1 - 20; y += 120) d += `M${x} ${y}h.1`;
    GS.markup(boardG, line(d, 7, '#CFA46C', .55));
  }

  /* ================= state ================= */
  let LV = null, RI = 0, RD = null, COMPS = [], WIRES = [], ITEMS = [], S = null;
  let tries = 0, rTries = 0, busy = false, tok = 0, DEMO = false;
  let powered = false, predicted = false, choosing = false, seqI = 0, failed = {}, STV = {}, testing = false;
  const canInput = () => !!RD && !busy && !choosing && !testing && !(RD.predict && !predicted && RD.mode === 'live');
  const comp = id => COMPS.find(c => c.id === id);
  function termPos(tid, list) {
    const [cid, tn] = tid.split('.');
    const c = (list || COMPS).find(q => q.id === cid);
    const t = TYPES[c.type].terms(c)[tn];
    return { x: c.x + t[0], y: c.y + t[1] };
  }
  function allTerms() {
    const out = [];
    COMPS.forEach(c => { if (c.noWire) return; const t = TYPES[c.type].terms(c); Object.keys(t).forEach(k => out.push({ id: c.id + '.' + k, x: c.x + t[k][0], y: c.y + t[k][1] })); });
    return out;
  }

  /* ================= solver =================
   * Nodal analysis over the terminals: every wire, closed switch and metal object is RW, every
   * source a Norton equivalent (V / r in parallel with r). A tiny leak to ground keeps floating
   * parts solvable. over: { off (main sources off), sw {id: state}, pull {id: true} }. */
  function solveSet(comps, wires, over) {
    over = over || {};
    const idx = {}; let n = 0;
    const node = t => (idx[t] != null ? idx[t] : (idx[t] = n++));
    const Rs = [], Vs = [];
    wires.forEach(w => { if (w.a.t && w.b.t) Rs.push({ a: node(w.a.t), b: node(w.b.t), R: RW, wire: w }); });
    comps.forEach(c => {
      const d = TYPES[c.type];
      if (!d.edges) return;
      d.edges(c, (a, b, r, tag) => Rs.push({ a: node(c.id + '.' + a), b: node(c.id + '.' + b), R: r, tag, c }),
        (p, m, v, r) => { if (!(over.off && !c.ref)) Vs.push({ p: node(c.id + '.' + p), n: node(c.id + '.' + m), V: v, r, c }); }, over);
    });
    const G = [], I = new Float64Array(n);
    for (let i = 0; i < n; i++) G.push(new Float64Array(n));
    const stamp = (a, b, g) => { G[a][a] += g; G[b][b] += g; G[a][b] -= g; G[b][a] -= g; };
    Rs.forEach(e => { if (e.a !== e.b) stamp(e.a, e.b, 1 / e.R); });
    Vs.forEach(s => { const g = 1 / s.r; if (s.p !== s.n) stamp(s.p, s.n, g); I[s.p] += s.V * g; I[s.n] -= s.V * g; });
    for (let i = 0; i < n; i++) G[i][i] += LEAK;
    const v = gauss(G, I, n);
    const res = { short: false, bulbs: {}, meters: {}, coils: {}, wireI: new Map(), srcI: 0 };
    Vs.forEach(s => { const cur = (s.V - (v[s.p] - v[s.n])) / s.r; if (Math.abs(cur) > SHORT_I) res.short = true; res.srcI = Math.max(res.srcI, Math.abs(cur)); });
    Rs.forEach(e => {
      const cur = (v[e.a] - v[e.b]) / e.R;
      if (e.wire) res.wireI.set(e.wire, cur);
      if (e.tag === 'meter') res.meters[e.c.id] = Math.abs(cur);
      if (e.tag === 'coil') res.coils[e.c.id] = Math.abs(cur);
      if (e.tag === 'bulb') { const dv = v[e.a] - v[e.b], b = Math.pow(dv / (e.c.Vr || 1.5), 2); res.bulbs[e.c.id] = { b, lvl: lvlOf(b), dv }; }
    });
    comps.forEach(c => { if (c.type === 'bulb' && !res.bulbs[c.id]) res.bulbs[c.id] = { b: 0, lvl: c.burnt ? 4 : 0, out: true }; });
    return res;
  }
  function gauss(A, b, n) {
    const M = A.map((r, i) => { const q = Array.from(r); q.push(b[i]); return q; });
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      if (p !== k) { const t = M[k]; M[k] = M[p]; M[p] = t; }
      const d = M[k][k] || 1e-30;
      for (let i = k + 1; i < n; i++) {
        const f = M[i][k] / d;
        if (!f) continue;
        for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
      }
    }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / (M[i][i] || 1e-30); }
    return x;
  }
  const lvlOf = b => (b > 3 ? 4 : b > 1.6 ? 3 : b >= 0.5 ? 2 : b >= 0.03 ? 1 : 0);
  /** Solve the board; filaments above their limit burn and open the circuit (re-solved). */
  function solveBoard(over) {
    let st = solveSet(COMPS, WIRES, over), burnt = [];
    for (let k = 0; k < 4; k++) {
      const hot = COMPS.filter(c => c.type === 'bulb' && !c.burnt && st.bulbs[c.id] && st.bulbs[c.id].b > 3);
      if (!hot.length) break;
      hot.forEach(c => { c.burnt = true; burnt.push(c); });
      st = solveSet(COMPS, WIRES, over);
    }
    st.burnt = burnt;
    return st;
  }
  const lit = (st, id) => !!(st && st.bulbs[id] && st.bulbs[id].lvl >= 1 && st.bulbs[id].lvl < 4);
  const lvl = (st, id) => (st && st.bulbs[id] ? st.bulbs[id].lvl : 0);
  /** Behaviour of the board for a switch setting: sorted bulb levels (for comparing with a diagram). */
  const levelsKey = st => Object.keys(st.bulbs).map(k => Math.min(st.bulbs[k].lvl, 3)).sort().join('');

  /* ================= wires ================= */
  const WCOL = ['#E2453C', '#2F80C9', '#4DAA57', '#F28C28', '#3A3436', '#8A5ACB'];
  function endPos(w, e) {
    const E = w[e];
    if (!E.t) return { x: E.x, y: E.y };
    const p = termPos(E.t);
    // several clips on one post fan out a little so each stays visible
    let k = 0;
    for (const q of WIRES) { if (q === w) { if (e === 'b' && q.a.t === E.t) k++; break; } if (q.a.t === E.t) k++; if (q.b.t === E.t) k++; }
    const off = [[0, 0], [20, -18], [-20, -18], [0, -30]][k % 4];
    return { x: p.x + off[0], y: p.y + off[1] };
  }
  function wirePath(w) {
    const A = endPos(w, 'a'), B = endPos(w, 'b');
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy), sag = Math.min(110, 24 + L * 0.16) * (w.sag == null ? 1 : w.sag);
    return `M${n1(A.x)} ${n1(A.y)}C${n1(A.x + dx * .28)} ${n1(A.y + dy * .28 + sag)} ${n1(A.x + dx * .72)} ${n1(A.y + dy * .72 + sag)} ${n1(B.x)} ${n1(B.y)}`;
  }
  function buildWire(w, i) {
    w.col = w.col || WCOL[i % WCOL.length];
    w.g = el('g', { class: 'lh-wire' }, wireG);
    w.p0 = el('path', { fill: 'none', stroke: OUT, 'stroke-width': 17, 'stroke-linecap': 'round' }, w.g);
    w.p1 = el('path', { fill: 'none', stroke: w.col, 'stroke-width': 10.5, 'stroke-linecap': 'round' }, w.g);
    w.p2 = el('path', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: .35, transform: 'translate(-2 -3)' }, w.g);
    w.pf = el('path', { fill: 'none', stroke: '#FFF3B0', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '3 26', opacity: 0 }, w.g);
    ['a', 'b'].forEach(e => {
      const g = el('g', {}, endG);
      g.innerHTML = clipEndArt(w, false);
      w[e].g = g;
      if (!w.fix && !w[e].fix) {
        el('rect', { x: -48, y: -48, width: 96, height: 96, rx: 20, fill: 'transparent' }, g);
        g.style.cursor = 'grab';
        bindEnd(w, e);
      }
    });
    drawWire(w);
  }
  function clipEndArt(w, loose) {
    return Ci(0, 0, 15, solid('#D9A441', 3)) + Ci(0, 0, 6, fill('#8A6418')) + (loose ? Ci(0, 0, 24, `fill="none" stroke="${w.col}" stroke-width="5" opacity=".9"`) : '');
  }
  function drawWire(w) {
    const d = wirePath(w);
    [w.p0, w.p1, w.p2, w.pf].forEach(p => p.setAttribute('d', d));
    ['a', 'b'].forEach(e => {
      const p = endPos(w, e), loose = !w[e].t;
      w[e].g.setAttribute('transform', `translate(${n1(p.x)} ${n1(p.y)})`);
      if (w[e].loose !== loose) { w[e].loose = loose; const hit = w[e].g.querySelector('rect'); w[e].g.innerHTML = clipEndArt(w, loose); if (hit) w[e].g.appendChild(hit); }
    });
  }
  const drawWires = () => WIRES.forEach(drawWire);
  let snapRing = null;
  function bindEnd(w, e) {
    const E = w[e];
    GS.drag(E.g, {
      svg,
      onStart(p) {
        if (!canInput()) return false;
        const pos = endPos(w, e);
        E.dx = pos.x - p.x; E.dy = pos.y - p.y; E.x = pos.x; E.y = pos.y;
        E.from = E.t; E.t = null;
        endG.appendChild(E.g); wireG.appendChild(w.g);
        GS.sfx.pick(); hud.mood('think');
        refresh(false);
        return true;
      },
      onMove(p) {
        E.x = clamp(p.x + E.dx, -60, 1340); E.y = clamp(p.y + E.dy, 100, 790);
        drawWire(w);
        const t = nearTerm(E.x, E.y);
        if (!snapRing) snapRing = el('circle', { r: 34, fill: 'none', stroke: '#0F8C7A', 'stroke-width': 6, 'stroke-dasharray': '10 7' }, uiG);
        snapRing.setAttribute('opacity', t ? 1 : 0);
        if (t) { snapRing.setAttribute('cx', t.x); snapRing.setAttribute('cy', t.y); }
      },
      onEnd() { if (snapRing) { snapRing.remove(); snapRing = null; } dropEnd(w, e, E.x, E.y); }
    });
  }
  function nearTerm(x, y) {
    let best = null, bd = SNAP;
    allTerms().forEach(t => { const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = t; } });
    return best;
  }
  /** Release a clip at (x, y): it joins the nearest post in reach, else it lies loose there. */
  function dropEnd(w, e, x, y) {
    const E = w[e], t = nearTerm(x, y);
    if (t) { E.t = t.id; GS.sfx.tick(); GS.tone({ f: 1200, t: .05, type: 'triangle', vol: .08 }); } else { E.t = null; E.x = x; E.y = y; GS.sfx.drop(); }
    drawWires();
    onEdit('wire');
  }
  function attach(wi, e, tid) { const p = termPos(tid); dropEnd(WIRES[wi], e, p.x, p.y); }

  /* ================= items ================= */
  function slotOf(c) { return TYPES[c.type].slot; }
  const accepts = (c, it) => { const s = slotOf(c); if (!s) return false; const a = typeof s.accept === 'function' ? s.accept(c) : s.accept; return a === it.kind; };
  function itemHome(it) { return it.home; }
  function layoutSlot(c) {
    const s = slotOf(c);
    c.items.forEach((it, i) => { const p = s.pos(c, i); it.x = c.x + p[0]; it.y = c.y + p[1]; posItem(it); });
  }
  function posItem(it) { it.g.setAttribute('transform', `translate(${n1(it.x)} ${n1(it.y)})${it.sc ? ` scale(${it.sc})` : ''}`); }
  function buildItem(it) {
    it.g = el('g', { class: 'lh-item' }, itemG);
    it.art = el('g', {}, it.g);
    GS.markup(it.art, itemArt(it));
    el('rect', { x: -56, y: -56, width: 112, height: 112, rx: 20, fill: 'transparent' }, it.g);
    it.g.style.cursor = 'grab';
    it.x = it.home.x; it.y = it.home.y; it.slot = null;
    posItem(it);
    if (it.lock) return;
    GS.drag(it.g, {
      svg,
      onStart(p) {
        if (!canInput()) return false;
        it.dx = it.x - p.x; it.dy = it.y - p.y; it.p0 = { x: p.x, y: p.y }; it.moved = false;
        itemG.appendChild(it.g); GS.sfx.pick();
        if (it.kind === 'obj' && !TK) GS.say(cap(OBJ_NAME[it.name] || it.name) + '.');
        return true;
      },
      onMove(p) {
        if (!it.moved && Math.hypot(p.x - it.p0.x, p.y - it.p0.y) < 14) return;
        it.moved = true;
        it.x = clamp(p.x + it.dx, -60, 1340); it.y = clamp(p.y + it.dy, 110, 780); posItem(it);
      },
      onEnd() { if (!it.moved) tapItem(it); else placeItem(it, slotNear(it)); }
    });
  }
  function slotNear(it) {
    let best = null, bd = 1e9;
    COMPS.forEach(c => {
      if (!accepts(c, it)) return;
      const s = slotOf(c);
      let d;
      if (c.type === 'holder' || c.type === 'bin') {
        const hw = (c.type === 'holder' ? holderW(c) : c.w) / 2 + 50, hh = (c.type === 'holder' ? 60 : c.h / 2) + 50;
        d = Math.abs(it.x - c.x) < hw && Math.abs(it.y - c.y) < hh ? Math.hypot(it.x - c.x, it.y - c.y) * .2 : 1e9;
      } else { const p = s.pos(c, 0); d = Math.hypot(it.x - c.x - p[0], it.y - c.y - p[1]); if (d > 130) d = 1e9; }
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  }
  /** Put an item into a part (or back to the tray when c is null). A full single slot swaps. */
  function placeItem(it, c, quiet) {
    const old = it.slot ? comp(it.slot) : null;
    if (old) { old.items.splice(old.items.indexOf(it), 1); layoutSlot(old); }
    it.slot = null;
    if (c) {
      const capN = slotOf(c).cap(c);
      if (c.items.length >= capN) {
        if (capN === 1) { const o = c.items.pop(); o.slot = null; o.x = o.home.x; o.y = o.home.y; posItem(o); }
        else c = null;
      }
    }
    if (c) { c.items.push(it); it.slot = c.id; layoutSlot(c); if (!quiet) GS.sfx.drop(); }
    else { it.x = it.home.x; it.y = it.home.y; posItem(it); if (!quiet) GS.sfx.drop(); }
    onEdit('item');
  }
  /** A tap moves an item: tray -> its first free part, part -> tray. */
  function tapItem(it) {
    if (RD.tapTo) { const t = RD.tapTo(it); placeItem(it, t ? comp(t) : null); return; }
    if (it.slot) { placeItem(it, null); return; }
    const c = COMPS.find(q => accepts(q, it) && q.type !== 'bin' && q.items.length < slotOf(q).cap(q)) || COMPS.find(q => accepts(q, it) && q.type !== 'bin');
    placeItem(it, c || null);
  }
  const itemById = id => ITEMS.find(i => i.id === id);
