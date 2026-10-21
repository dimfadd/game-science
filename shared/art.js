/* Kampung Sains: GS.art, the hand-authored inline-SVG asset library.
 * Style "Kampung Chunky" (docs/DESIGN.md): one warm outline #3B2A20 with round joins,
 * three tones per fill (base, top-left highlight blob, bottom-right shade crescent),
 * white specular dots only on shiny things, separate contact shadows, outline-free
 * backgrounds and a single gradient (the sky).
 *
 * Everything returns SVG markup strings. Items, weights, people and landmarks are
 * drawn with their ORIGIN AT BOTTOM-CENTER (where they rest on a surface).
 * Ids inside the markup are unique per call, so the same asset can appear many times. */
(function () {
  'use strict';
  const GS = (window.GS = window.GS || {});
  const art = (GS.art = GS.art || {});

  /* ======================= palette + tiny helpers ======================= */
  const OL = '#3B2A20', SW = 3, DW = 1.8, CREAM = '#F6E3C4', PINK = '#F59AB0', EYE = '#2B1D14';
  const NUMF = "Fredoka, 'Baloo 2', 'Trebuchet MS', system-ui, sans-serif";
  const PAL = {
    red: ['#E2453C', '#F27A6E', '#B5322B'], orange: ['#F28C28', '#F8B26A', '#C76A12'],
    yellow: ['#FFC83D', '#FFE08A', '#E09A00'], green: ['#4DAA57', '#86CC8C', '#357F40'],
    blue: ['#2F80C9', '#6FAEE3', '#215F98'], wood: ['#A8673A', '#C68654', '#7E4A27'],
    stone: ['#8C8F94', '#AEB1B5', '#63666B'], brass: ['#D9A441', '#EECB7A', '#A8771F'],
    steel: ['#959EA8', '#D6DCE2', '#626A74'], fur: ['#C98B4E', '#E0A86E', '#A06A36'],
    grass: ['#7CC26B', '#A6D998', '#5A9E4C'], rattan: ['#C99A5B', '#E3BD86', '#9A6E36'],
    leaf: ['#5BAE4E', '#8ED07E', '#3E8A3A'], bamboo: ['#E3C27F', '#F2DCAA', '#B8924F'],
    roof: ['#C8643B', '#E08A62', '#963F22'], cream: [CREAM, '#FFF6E6', '#E0C49A'],
    white: ['#FBF6EC', '#FFFFFF', '#DCCFBB']
  };
  const n1 = v => Math.round(v * 10) / 10;
  let seq = 0;
  const salt = Math.random().toString(36).slice(2, 6);
  const uid = p => 'g' + salt + p + (++seq).toString(36);
  const h2r = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = h2r(a), B = h2r(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const tone = c => Array.isArray(c) ? { b: c[0], h: c[1] || mix(c[0], '#FFFBEA', 0.38), s: c[2] || mix(c[0], '#4A2410', 0.32) } : tone([c]);
  function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 7; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

  // shape factories: each returns fn(attrs) -> markup, so one shape can be filled, clipped and outlined
  const tfA = tf => (tf ? ` transform="${tf}"` : '');
  const E = (cx, cy, rx, ry, tf) => a => `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}"${tfA(tf)} ${a}/>`;
  const C = (cx, cy, r) => E(cx, cy, r, r);
  const P = (d, tf) => a => `<path d="${d}"${tfA(tf)} ${a}/>`;
  const R = (x, y, w, h, rx, tf) => a => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(rx || 0)}"${tfA(tf)} ${a}/>`;
  const fl = (c, op) => `fill="${c}"` + (op != null ? ` opacity="${op}"` : '');
  const stk = (sw, c) => `fill="none" stroke="${c || OL}" stroke-width="${sw || SW}" stroke-linejoin="round" stroke-linecap="round"`;
  const ln = (d, sw, c, op) => `<path d="${d}" ${stk(sw || DW, c)}${op != null ? ` opacity="${op}"` : ''}/>`;
  const solid = (shape, c, sw) => shape(`fill="${c}" stroke="${OL}" stroke-width="${sw || SW}" stroke-linejoin="round" stroke-linecap="round"`);
  const g = (inner, tf, cls) => `<g${cls ? ` class="${cls}"` : ''}${tfA(tf)}>${inner}</g>`;
  const dot = (x, y, r, c, op) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" ${fl(c || OL, op)}/>`;
  const spec = (x, y, r) => dot(x, y, r, '#fff') + dot(x + r * 1.5, y + r * 1.2, r * 0.45, '#fff');
  const shadow = (rx, cx) => `<ellipse class="gs-shadow" cx="${n1(cx || 0)}" cy="0" rx="${n1(rx)}" ry="${n1(Math.max(3, rx * 0.2))}" fill="${OL}" opacity=".18"/>`;
  const limb = (d, w, c, sw) => ln(d, w + 2 * (sw || SW * 0.8), OL) + ln(d, w, c);
  const txt = (x, y, s, size, c, fam) => `<text x="${n1(x)}" y="${n1(y)}" font-family="${fam || NUMF}" font-weight="700" font-size="${size}" fill="${c || OL}" text-anchor="middle" style="font-variant-numeric:tabular-nums">${s}</text>`;

  /** The 3-tone fill: base, clipped highlight blob (top-left) and shade crescent (bottom-right),
   *  then the outline. box = [x, y, w, h] of the shape. o: {k, hl, hx, hy, hs, inner, top, ol, sw, so} */
  function f3(shape, box, col, o) {
    o = o || {};
    const t = tone(col), x = box[0], y = box[1], w = box[2], h = box[3], cid = uid('c');
    const k = o.k == null ? 0.1 : o.k, m = Math.min(w, h), mean = Math.sqrt(w * h);
    let s = shape(fl(t.b)) + `<clipPath id="${cid}">${shape('')}</clipPath><g clip-path="url(#${cid})">` + (o.inner || '');
    if (k) {
      const mid = uid('m'), pad = 6, off = m * k;
      const rect = `x="${n1(x - pad)}" y="${n1(y - pad)}" width="${n1(w + 2 * pad)}" height="${n1(h + 2 * pad)}"`;
      s += `<mask id="${mid}" maskUnits="userSpaceOnUse" ${rect}><rect ${rect} fill="#fff"/><g transform="translate(${n1(-off * (o.kx == null ? 1 : o.kx))} ${n1(-off)})">${shape('fill="#000"')}</g></mask>` +
        `<rect ${rect} fill="${t.s}" mask="url(#${mid})"${o.so ? ` opacity="${o.so}"` : ''}/>`;
    }
    if (o.hl !== false) {
      if (o.hlShape) s += o.hlShape(fl(t.h, o.hlo));
      else {
        const hx = x + w * (o.hx == null ? 0.3 : o.hx), hy = y + h * (o.hy == null ? 0.26 : o.hy), hs = o.hs || 1;
        s += E(hx, hy, Math.min(w * 0.2, mean * 0.17) * hs, Math.min(h * 0.13, mean * 0.095) * hs, `rotate(-35 ${n1(hx)} ${n1(hy)})`)(fl(t.h, o.hlo));
      }
    }
    s += (o.top || '') + '</g>';
    if (o.ol !== false) s += shape(stk(o.sw));
    return s;
  }

  /** Bumpy "cloud" outline around an ellipse: used for fluffy light things. */
  function scallop(cx, cy, rx, ry, n, amp, seed, rot) {
    const r = rng(seed || 3); rot = rot || 0;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = rot + (i / n) * 2 * Math.PI, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
      if (!i) { d += `M${n1(x)} ${n1(y)}`; continue; }
      const am = rot + ((i - 0.5) / n) * 2 * Math.PI, A = amp * (0.75 + r() * 0.5) * 2;
      d += `Q${n1(cx + (rx + A) * Math.cos(am))} ${n1(cy + (ry + A) * Math.sin(am))} ${n1(x)} ${n1(y)}`;
    }
    return d + 'Z';
  }
  /** Pointed leaf from base (bx,by) to tip (tx,ty), half-width wid, optional sideways bend. */
  function leaf(bx, by, tx, ty, wid, bend) {
    const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
    bend = bend || 0;
    const p = (a, b) => `${n1(bx + ux * a + px * b)} ${n1(by + uy * a + py * b)}`;
    return `M${p(0, 0)}C${p(L * 0.25, wid + bend)} ${p(L * 0.72, wid * 0.8 + bend)} ${p(L, 0)}C${p(L * 0.72, -wid * 0.8 + bend)} ${p(L * 0.25, -wid + bend)} ${p(0, 0)}Z`;
  }
  /** Low-opacity textile textures (kawung dots or diagonal lines); only for cloth, weaving, backgrounds. */
  function texture(kind, x, y, w, h, c, op, sz) {
    const id = uid('p'); sz = sz || 8;
    const cell = kind === 'kawung'
      ? [0, 90, 180, 270].map(a => `<ellipse cx="${sz / 2}" cy="${n1(sz / 2 - sz * 0.22)}" rx="${n1(sz * 0.1)}" ry="${n1(sz * 0.17)}" transform="rotate(${a + 45} ${sz / 2} ${sz / 2})" fill="${c}"/>`).join('')
      : kind === 'weave'
        ? `<rect width="${sz / 2}" height="${n1(sz * 0.18)}" y="${n1(sz * 0.16)}" fill="${c}"/><rect x="${sz / 2}" y="${n1(sz * 0.66)}" width="${sz / 2}" height="${n1(sz * 0.18)}" fill="${c}"/><rect x="${n1(sz * 0.16)}" y="${sz / 2}" width="${n1(sz * 0.18)}" height="${sz / 2}" fill="${c}"/><rect x="${n1(sz * 0.66)}" width="${n1(sz * 0.18)}" height="${sz / 2}" fill="${c}"/>`
        : `<path d="M0 ${sz}L${sz} 0M${-sz / 2} ${sz / 2}L${sz / 2} ${-sz / 2}M${sz / 2} ${sz * 1.5}L${sz * 1.5} ${sz / 2}" stroke="${c}" stroke-width="${n1(sz * 0.14)}"/>`;
    return `<pattern id="${id}" width="${sz}" height="${sz}" patternUnits="userSpaceOnUse">${cell}</pattern><rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" fill="url(#${id})" opacity="${op || 0.07}"/>`;
  }
  const eye = (x, y, rx, ry) => E(x, y, rx, ry)(fl(EYE)) + dot(x - rx * 0.32, y - ry * 0.38, Math.max(0.8, rx * 0.36), '#fff') + dot(x + rx * 0.3, y + ry * 0.36, Math.max(0.5, rx * 0.18), '#fff');
  const blush = (x, y, rx) => E(x, y, rx, rx * 0.6)(fl(PINK, 0.55));
  const star4 = (x, y, r, c) => P(`M${x} ${y - r}Q${n1(x + r * 0.2)} ${n1(y - r * 0.2)} ${x + r} ${y}Q${n1(x + r * 0.2)} ${n1(y + r * 0.2)} ${x} ${y + r}Q${n1(x - r * 0.2)} ${n1(y + r * 0.2)} ${x - r} ${y}Q${n1(x - r * 0.2)} ${n1(y - r * 0.2)} ${x} ${y - r}Z`)(`fill="${c || '#FFC83D'}" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"`);

  /* ============================== items ============================== */
  const ITEMS = {};
  /** def(name, label, heavy, physics {density, floats}, shadow half-width, draw) */
  function def(name, label, heavy, phys, sh, draw) { ITEMS[name] = { label, heavy, phys: phys || {}, sh, draw }; }
  const D = (density) => ({ density, floats: density < 1 });

  /* ---------- fruit and food ---------- */
  def('rambutan', 'Rambutan', 'medium', {}, 24, () => {
    const cx = 0, cy = -32, r = 22, rn = rng(11);
    let hair = '', tips = '';
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + rn() * 0.1, L = 6 + rn() * 3.5, cs = Math.cos, sn = Math.sin;
      const x1 = cx + cs(a + 0.15) * (r + L), y1 = cy + sn(a + 0.15) * (r + L);
      if (y1 > -3) continue;
      hair += `M${n1(cx + cs(a) * (r - 4))} ${n1(cy + sn(a) * (r - 4))}Q${n1(cx + cs(a - 0.04) * (r + L * 0.75))} ${n1(cy + sn(a - 0.04) * (r + L * 0.75))} ${n1(x1)} ${n1(y1)}`;
      tips += dot(x1, y1, 1.3, '#C9DB6A');
    }
    let fuzz = '';
    for (let i = 0; i < 9; i++) { const a = rn() * 6.28, d = rn() * 13; fuzz += `M${n1(cx + Math.cos(a) * d)} ${n1(cy + Math.sin(a) * d)}q2 -3 4 -1`; }
    return ln(hair, 4.6, OL) + ln(hair, 2.2, '#E2453C') + tips +
      f3(C(cx, cy, r), [-r, cy - r, 2 * r, 2 * r], PAL.red, { inner: ln(fuzz, 1.3, '#B5322B', 0.8) }) + spec(-9, -44, 2);
  });

  def('mangga', 'Mangga', 'medium', {}, 30, () => {
    const d = 'M-32 -22C-34 -40 -16 -51 4 -49C24 -47 36 -34 33 -17C31 -5 18 -1 2 -1C-16 -1 -31 -8 -32 -22Z';
    return f3(P(d), [-34, -51, 69, 50], ['#FFC23A', '#FFE38F', '#DE8A1C'], {
      inner: E(22, -40, 24, 15, 'rotate(25 22 -40)')(fl('#9BC745', 0.9)) + E(-22, -14, 17, 11)(fl('#F28C28', 0.45)), hx: 0.28, hy: 0.32
    }) + ln('M20 -48Q22 -55 27 -58', 4.6, OL) + ln('M20 -48Q22 -55 27 -58', 2, '#7E4A27') +
      f3(P(leaf(26, -57, 46, -66, 7)), [26, -73, 22, 16], PAL.green, { k: 0.12, hl: false, sw: 2.4 }) + ln('M28 -58L43 -65', 1.2, '#357F40') +
      spec(-19, -37, 2.2);
  });

  const BAN = 'M-30 -18C-20 0 16 0 30 -16C32 -19 30 -22 27 -20C14 -15 -14 -15 -26 -22C-28 -24 -31 -22 -30 -18Z';
  def('pisang', 'Pisang', 'medium', {}, 32, () => {
    const one = tf => g(f3(P(BAN), [-31, -24, 63, 24], PAL.yellow, { k: 0.14, hy: 0.6, hx: 0.4 }) +
      ln('M-20 -12C-8 -7 10 -7 22 -13', 1.4, '#E09A00', 0.7) + dot(-29, -21, 2.6, '#5A3A20'), tf);
    return limb('M28 -24C33 -32 34 -38 38 -44', 5, '#8A9A3A', 2.4) + one('translate(1 -17) rotate(-7)') + one('translate(0 -9) rotate(-3)') + one('translate(-1 0)');
  });

  def('salak', 'Salak', 'medium', {}, 22, () => {
    const d = 'M0 -58C10 -50 24 -38 24 -22C24 -8 13 -1 0 -1C-13 -1 -24 -8 -24 -22C-24 -38 -10 -50 0 -58Z';
    let sc = '';
    for (let y = -50, row = 0; y < -2; y += 7, row++) for (let x = -24 + (row % 2) * 4; x < 26; x += 8) sc += `M${x - 3} ${y}Q${x} ${y + 4.5} ${x + 3} ${y}`;
    return f3(P(d), [-24, -58, 48, 57], ['#9A4E2E', '#C67E58', '#6B321C'], { inner: ln(sc, 1.4, '#D49270', 0.75) }) +
      ln('M0 -58L1 -64', 3.4, '#5A3A20') + spec(-11, -36, 1.9);
  });

  def('jeruk', 'Jeruk', 'medium', { density: 0.85, floats: true }, 25, () => {
    const rn = rng(4); let pores = '';
    for (let i = 0; i < 14; i++) pores += dot(-18 + rn() * 36, -46 + rn() * 38, 0.9, '#C76A12', 0.55);
    return f3(E(0, -27, 27, 25), [-27, -52, 54, 50], PAL.orange, { inner: pores }) +
      f3(P(leaf(2, -51, 22, -62, 6)), [2, -67, 20, 17], PAL.green, { k: 0.12, hl: false, sw: 2.2 }) + ln('M4 -52L19 -60', 1.1, '#357F40') +
      E(1, -51, 3.2, 2)(fl('#5E7F2A')) + spec(-13, -38, 2.6);
  });

  def('semangka', 'Semangka', 'heavy', {}, 44, () => {
    const cx = 0, cy = -30, rx = 46, ry = 29;
    let st = '';
    for (let k = -3; k <= 3; k++) {
      let d = '';
      for (let i = 0, x = -rx; x <= rx; x += 4, i++) { const y = cy + k * 8.6 * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) + (i % 2 ? 1.6 : -1.6); d += (i ? 'L' : 'M') + n1(x) + ' ' + n1(y); }
      st += d;
    }
    return f3(E(cx, cy, rx, ry), [-rx, cy - ry, 2 * rx, 2 * ry], ['#73C25E', '#A7DC93', '#3B8742'], { inner: ln(st, 5, '#2E7A3A'), so: 0.8, hy: 0.22 }) +
      ln('M45 -34q7 -2 6 -9', 3.4, '#6B4A20') + spec(-24, -47, 2.8);
  });

  def('kelapa', 'Kelapa', 'heavy', D(0.9), 32, () => {
    const d = 'M0 -74C20 -74 35 -56 35 -33C35 -12 20 -1 0 -1C-20 -1 -35 -12 -35 -33C-35 -56 -20 -74 0 -74Z';
    return f3(P(d), [-35, -74, 70, 73], ['#6DAF45', '#A3D27C', '#457E2B'], {
      inner: ln('M-11 -71C-25 -52 -24 -18 -11 -2M11 -71C25 -52 24 -18 11 -2', 1.6, '#457E2B', 0.6)
    }) + solid(P('M-11 -71Q-6 -80 0 -76Q6 -80 11 -71Q0 -67 -11 -71Z'), '#9C6B3A', 2.2) + dot(0, -73, 2.4, '#6B4520') + spec(-18, -52, 2.6);
  });

  def('klepon', 'Klepon', 'medium', {}, 34, () => {
    const ball = (x, y, seed) => {
      const rn = rng(seed); let fl8 = '';
      for (let i = 0; i < 7; i++) { const a = -2.6 + rn() * 2.2, d = 4 + rn() * 7, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; fl8 += `M${n1(px)} ${n1(py)}l${n1(2 + rn() * 2)} ${n1(-1 + rn() * 2)}`; }
      return f3(C(x, y, 13), [x - 13, y - 13, 26, 26], ['#55B25A', '#8DD48A', '#3A8A42'], { top: ln(fl8, 1.8, '#FFFDF5') });
    };
    return f3(P('M-37 -5C-20 -14 20 -14 37 -5C20 2 -20 2 -37 -5Z'), [-37, -12, 74, 11], PAL.leaf, { hl: false, k: 0.18, sw: 2.4 }) + ln('M-34 -5L34 -5', 1.2, '#3E8A3A') +
      ball(0, -31, 2) + ball(-14, -16, 5) + ball(14, -16, 8) + spec(-18, -22, 1.6);
  });

  def('apel', 'Apel', 'medium', D(0.8), 26, () => {
    const d = 'M0 -44C8 -50 26 -50 28 -32C30 -14 16 -1 6 -2C3 -2 2 -3 0 -3C-2 -3 -3 -2 -6 -2C-16 -1 -30 -14 -28 -32C-26 -50 -8 -50 0 -44Z';
    return f3(P(d), [-29, -49, 58, 48], PAL.red, {}) + ln('M0 -44Q-1 -52 2 -57', 3.4, '#5A3A20') +
      f3(P(leaf(2, -51, 20, -60, 5.5)), [2, -64, 19, 14], PAL.green, { k: 0.12, hl: false, sw: 2.2 }) + spec(-15, -36, 2.4);
  });

  /* ---------- small and dense ---------- */
  def('batu', 'Batu', 'heavy', D(2.6), 22, () => {
    const d = 'M-20 -2C-25 -8 -23 -20 -13 -27C-5 -32 10 -32 17 -25C23 -19 24 -7 18 -2Z';
    return f3(P(d), [-24, -31, 48, 30], PAL.stone, { k: 0.14, inner: ln('M3 -29L0 -21L5 -16', 1.4, '#63666B') + dot(-9, -12, 1.4, '#63666B') + dot(10, -10, 1.1, '#63666B') + dot(-3, -7, 0.9, '#63666B') });
  });

  def('baut', 'Baut', 'heavy', D(7.8), 21, () => {
    let th = '';
    for (let y = -52; y < -16; y += 4.6) th += `M-8 ${n1(y + 2)}L8 ${n1(y - 1)}`;
    return f3(R(-8, -60, 16, 46, 3), [-8, -60, 16, 46], PAL.steel, { k: 0.2, inner: ln(th, 1.4, '#626A74'), hlShape: R(-6, -56, 3, 36, 1.5) }) +
      f3(P('M-20 -14L-15 -19L15 -19L20 -14L20 -4Q20 -1 17 -1L-17 -1Q-20 -1 -20 -4Z'), [-20, -19, 40, 18], PAL.steel, { k: 0.16, inner: ln('M-8 -15V-1M8 -15V-1', 1.4, '#626A74') + `<path d="M-20 -14L-15 -19L15 -19L20 -14Z" fill="#D6DCE2"/>`, hl: false }) +
      spec(-14, -10, 1.5) + spec(-5, -54, 1.2);
  });

  def('gembok', 'Gembok', 'heavy', D(7.5), 21, () =>
    limb('M-11 -30L-11 -43A11 11 0 0 1 11 -43L11 -30', 5.5, '#959EA8', 2.6) + ln('M-12 -36L-12 -43A12 12 0 0 1 -4 -54', 1.6, '#E3E8EC') +
    f3(R(-19, -34, 38, 33, 7), [-19, -34, 38, 33], ['#D29A35', '#EDC66F', '#9A6814'], { k: 0.14 }) +
    dot(0, -21, 3.8, OL) + P('M-2 -19L-3.4 -10L3.4 -10L2 -19Z')(fl(OL)) +
    dot(-13, -7, 1.3, '#9A6814') + dot(13, -7, 1.3, '#9A6814') + spec(-12, -28, 2));

  def('koin', 'Koin', 'heavy', D(7.1), 18, () =>
    solid(E(3.5, -19, 17, 18), '#A0721A') +
    f3(E(0, -19, 17, 18), [-17, -37, 34, 36], ['#E8B83E', '#F8DC86', '#B8861E'], { k: 0.07 }) +
    E(0, -19, 12.5, 13.5)(stk(1.4, '#A0721A')) + txt(0, -15.5, '100', 10, '#7A5310') + spec(-9, -30, 1.8));

  def('kelereng', 'Kelereng', 'heavy', D(2.5), 15, () =>
    f3(C(0, -17, 16), [-16, -33, 32, 32], ['#5DBBDC', '#A6E0F0', '#2F8DB0'], {
      k: 0.12, hl: false,
      inner: P('M-13 -8C-5 -16 2 -23 13 -27C8 -18 1 -12 -13 -8Z')(fl('#F28C28')) + P('M-10 -10C-3 -16 3 -21 10 -24')(stk(1.6, '#FFE08A'))
    }) + spec(-7, -25, 3.2));

  def('paku', 'Paku', 'heavy', D(7.8), 30, () =>
    g(f3(P('M-26 -14L22 -13L32 -10.5L22 -8L-26 -7Z'), [-26, -14, 58, 7], PAL.steel, { k: 0.3, hl: false, top: ln('M-24 -12.2L20 -11.6', 1.2, '#E9EDF1') }) +
      f3(R(-31, -20, 6, 19, 2), [-31, -20, 6, 19], PAL.steel, { k: 0.25, hl: false }) + spec(-29.4, -17, 1), 'rotate(9 -28 -1)'));

  def('sendok', 'Sendok', 'heavy', D(7.8), 38, () =>
    f3(P('M-42 -8C-42 -12 -36 -13 -30 -12L2 -11C6 -20 14 -23 24 -23C36 -23 42 -17 42 -11C42 -5 34 0 23 0C14 0 6 -4 2 -8L-30 -6C-36 -5 -42 -4 -42 -8Z'),
      [-42, -23, 84, 23], PAL.steel, { k: 0.16, hl: false, inner: E(24, -11, 13, 7.5)(fl('#B7BFC7')) + E(28, -9, 8, 4)(fl('#7E8690', 0.6)) }) +
    spec(16, -16, 1.8) + ln('M-36 -9.5L-6 -10', 1.3, '#E9EDF1'));

  def('plastisin', 'Plastisin', 'medium', D(1.5), 22, () =>
    f3(P('M-22 -6C-26 -16 -20 -30 -6 -32C6 -34 20 -30 22 -18C24 -8 18 -2 8 -2L-14 -2C-18 -2 -21 -3 -22 -6Z'), [-24, -33, 48, 31], ['#EF6F6C', '#F7A19A', '#C2463F'], {
      k: 0.12, inner: P('M-24 -20C-10 -26 6 -14 24 -22L24 -15C6 -8 -10 -19 -24 -12Z')(fl('#FFC83D')) + P('M-24 -9C-8 -14 8 -4 24 -9L24 -4C8 1 -8 -8 -24 -3Z')(fl('#6FAEE3')),
      top: ln('M-6 -28q4 -3 8 0M-8 -24q6 -4 12 0', 1.2, '#C2463F', 0.7)
    }));

  /* ---------- big and light ---------- */
  def('kapas', 'Kapas', 'light', D(0.25), 40, () => {
    const d = scallop(0, -33, 39, 24, 12, 4.6, 5);
    return f3(P(d), [-46, -64, 92, 62], ['#FFF8EE', '#FFFFFF', '#E9DCCB'], {
      k: 0.09, hx: 0.32, hy: 0.3, hs: 1.3,
      inner: ln('M-22 -30q6 -7 13 -1M2 -40q7 -6 14 0M-6 -18q6 -5 12 0M18 -24q5 -5 10 0', 1.5, '#E3D3BE')
    });
  });

  def('balon', 'Balon', 'light', D(0.01), 18, () =>
    ln('M0 -19C-8 -13 7 -7 0 0', 1.6) +
    f3(P('M0 -98C25 -98 43 -81 43 -59C43 -39 24 -25 4 -23L-4 -23C-24 -25 -43 -39 -43 -59C-43 -81 -25 -98 0 -98Z'), [-43, -98, 86, 75], ['#F7A1B5', '#FCD3DD', '#D9708C'], { hx: 0.27, hy: 0.24, hs: 1.3 }) +
    solid(P('M-4.5 -23.5L4.5 -23.5L6.5 -18L-6.5 -18Z'), '#D9708C', 2.2) + E(-23, -70, 4, 9, 'rotate(28 -23 -70)')(fl('#fff', 0.85)) + dot(-16, -84, 2.4, '#fff'));

  def('bantal', 'Bantal', 'light', {}, 42, () => {
    const d = 'M-43 -47C-30 -41 30 -41 43 -47C40 -33 40 -16 44 -2C30 -7 -30 -7 -44 -2C-40 -16 -40 -33 -43 -47Z';
    return f3(P(d), [-44, -47, 88, 45], ['#AEDDEB', '#DAF1F7', '#7FB7CC'], {
      k: 0.1, hy: 0.3,
      inner: texture('kawung', -46, -50, 92, 50, '#215F98', 0.1, 9) +
        P('M-36 -40C-26 -36 26 -36 36 -40C34 -29 34 -18 37 -9C26 -12 -26 -12 -37 -9C-34 -18 -34 -29 -36 -40Z')(stk(1.3, '#5E9BB2') + ' stroke-dasharray="3 3.4"'),
      top: ln('M-5 -27Q0 -24 5 -27M0 -31Q-1 -26 0 -21', 1.4, '#5E9BB2')
    });
  });

  def('kerupuk', 'Kerupuk', 'light', {}, 40, () => {
    const rn = rng(21); let bub = '', arc = '';
    for (let i = 0; i < 13; i++) {
      const a = rn() * 6.28, d = Math.sqrt(rn()), x = Math.cos(a) * d * 32, y = -27 + Math.sin(a) * d * 15, r = 2 + rn() * 2.4;
      bub += E(x, y, r * 1.3, r)(fl('#FFF6DE')); arc += `M${n1(x - r)} ${n1(y + r * 0.4)}q${n1(r)} ${n1(r)} ${n1(2 * r)} 0`;
    }
    return f3(P(scallop(0, -27, 40, 21, 17, 2.4, 9)), [-44, -51, 88, 49], ['#F7E0AE', '#FFF3D4', '#D8B678'], { k: 0.1, hl: false, inner: bub + ln(arc, 1.1, '#D8B678') });
  });

  def('bulu', 'Bulu', 'light', D(0.1), 36, () => {
    let barbs = '';
    for (let x = -26; x < 36; x += 7) barbs += `M${x} -1L${x + 6} -10M${x} 1L${x + 5} 8`;
    const vane = 'M-34 0C-30 -10 -16 -16 -4 -16L-1 -11L3 -16C18 -15 34 -10 44 -1C36 6 24 10 10 10L7 5L3 10C-12 11 -28 8 -34 0Z';
    return g(f3(P(vane), [-34, -16, 78, 27], ['#FFF0DA', '#FFFFFF', '#E6C79C'], {
      k: 0.12, hl: false, inner: E(38, -1, 13, 10)(fl('#F8B26A', 0.6)) + ln(barbs, 1.1, '#E6C79C')
    }) + ln('M-46 3C-20 0 18 -3 43 -1', 2.4, '#B98652'), 'translate(0 -21) rotate(-18)');
  });

  def('gabus', 'Gabus', 'light', D(0.05), 40, () => {
    const rn = rng(13); let beads = '';
    for (let i = 0; i < 26; i++) beads += C(-36 + rn() * 60, -34 + rn() * 30, 1.6 + rn())(stk(0.8, '#C7CDC4'));
    const sil = P('M-40 -38L-28 -50L40 -50L40 -12L28 -1L-37 -1Q-40 -1 -40 -4Z');
    return sil(fl('#F2F4EF')) + P('M-40 -38L-28 -50L40 -50L28 -38Z')(fl('#FFFFFF')) + P('M28 -38L40 -50L40 -12L28 -1Z')(fl('#D3D9D0')) +
      beads + E(-26, -30, 8, 3, 'rotate(-20 -26 -30)')(fl('#FFFFFF')) + ln('M-40 -38L28 -38L40 -50M28 -38L28 -1', 1.8) + sil(stk(SW));
  });

  def('botol', 'Botol', 'light', D(0.3), 18, () =>
    f3(P('M-6 -71L-6 -67C-6 -61 -16 -59 -16 -49L-16 -6Q-16 -1 -11 -1L11 -1Q16 -1 16 -6L16 -49C16 -59 6 -61 6 -67L6 -71Z'), [-16, -71, 32, 70], ['#BFE6F2', '#E8F8FC', '#8AC6DA'], {
      k: 0.14, hl: false,
      inner: R(-17, -42, 34, 17)(fl('#F28C28')) + R(-17, -38, 34, 3)(fl('#FFE08A')) + ln('M-10 -7V-14M-4 -6V-14M4 -6V-14M10 -7V-14', 1.2, '#8AC6DA'),
      top: R(-12, -55, 3.6, 46, 1.8)(fl('#fff', 0.75))
    }) + solid(R(-8, -75, 16, 4, 1.5), '#215F98', 2.2) + f3(R(-7, -84, 14, 10, 2.5), [-7, -84, 14, 10], PAL.blue, { k: 0.18, sw: 2.4, hl: false }) + spec(-9, -58, 1.4));

  def('daun', 'Daun', 'light', D(0.5), 34, () =>
    ln('M-34 -6L-43 -1', 2.6, '#357F40') +
    f3(P('M-36 -6C-20 -30 14 -37 38 -26C26 -6 -8 3 -36 -6Z'), [-36, -36, 74, 34], PAL.leaf, {
      k: 0.12, hx: 0.4, hy: 0.35, top: ln('M-34 -7C-14 -14 12 -22 34 -26M-14 -13L-8 -24M-2 -17L6 -28M10 -20L19 -29M-18 -11L-8 -5M-4 -15L6 -8M10 -20L20 -14', 1.4, '#3E8A3A')
    }));

  def('kayu', 'Kayu', 'medium', D(0.6), 42, () =>
    f3(P('M-36 -33L30 -33C38 -33 43 -26 43 -17.5C43 -9 38 -2 30 -2L-36 -2Z'), [-36, -33, 79, 31], PAL.wood, {
      hy: 0.25, inner: ln('M-26 -26C-10 -23 6 -28 26 -25M-20 -16C-2 -13 14 -18 34 -15M-28 -8C-12 -5 4 -9 22 -7', 1.5, '#7E4A27')
    }) + f3(E(-36, -17.5, 9, 15.5), [-45, -33, 18, 31], ['#E8C38E', '#F5DDB3', '#C99A60'], { k: 0.06, hl: false, top: E(-36, -17.5, 5.5, 10)(stk(1.2, '#B98652')) + E(-36, -17.5, 2.2, 4)(stk(1.1, '#B98652')) }) +
    limb('M8 -33Q10 -42 17 -46', 3, '#A8673A', 2) + f3(P(leaf(17, -46, 34, -50, 5)), [17, -54, 17, 9], PAL.green, { k: 0.15, hl: false, sw: 2 }));

  def('es', 'Es batu', 'medium', D(0.92), 20, () => {
    const sil = P('M-20 -35L-9 -46L22 -46L22 -14L11 -2L-17 -2Q-20 -2 -20 -5Z');
    return sil(fl('#CDEFF7')) + P('M-20 -35L-9 -46L22 -46L11 -35Z')(fl('#F0FBFE')) + P('M11 -35L22 -46L22 -14L11 -2Z')(fl('#9FD3E3')) +
      C(-4, -18, 2.2)(stk(1, '#fff')) + C(3, -26, 1.4)(stk(1, '#fff')) + C(-10, -10, 1.2)(stk(1, '#fff')) +
      ln('M-16 -30V-20M-16 -32L-12 -32', 2, '#fff') + ln('M-20 -35L11 -35L22 -46M11 -35L11 -2', 1.8) + sil(stk(SW)) + spec(-4, -41, 1.5);
  });

  /* ---------- creatures ---------- */
  def('ayam', 'Anak ayam', 'light', {}, 20, () =>
    ln('M-7 -4l-3 4M-7 -4v4M-7 -4l3 4M7 -4l-3 4M7 -4v4M7 -4l3 4', 2, '#E07A12') +
    solid(P('M-4 -46Q-6 -55 0 -52Q2 -58 5 -51Q9 -55 8 -47Z'), '#FFC83D', 2.2) +
    f3(P('M0 -48C14 -48 23 -38 23 -24C23 -10 13 -4 0 -4C-13 -4 -23 -10 -23 -24C-23 -38 -14 -48 0 -48Z'), [-23, -48, 46, 44], PAL.yellow, {
      top: ln('M11 -26C18 -24 19 -17 14 -13', 1.8, '#E09A00')
    }) + eye(-7.5, -30, 2.6, 3.4) + eye(7.5, -30, 2.6, 3.4) + blush(-12, -23, 3.6) + blush(12, -23, 3.6) +
    solid(P('M-4 -26L4 -26L0 -20Z'), '#F28C28', 1.8));

  def('kucing', 'Kucing', 'medium', {}, 26, () => {
    const T = ['#F2A65A', '#F8C891', '#C97B33'];
    return limb('M16 -6C32 -6 36 -20 30 -34', 6.5, '#F2A65A', 2.6) + ln('M30 -32l-2.6 -3', 6.5, '#C97B33') +
      solid(P('M-20 -66L-18 -84L-5 -73Z'), '#F2A65A', 2.6) + solid(P('M20 -66L18 -84L5 -73Z'), '#F2A65A', 2.6) +
      P('M-16 -71L-15.5 -79L-9 -74Z')(fl(PINK)) + P('M16 -71L15.5 -79L9 -74Z')(fl(PINK)) +
      f3(P('M0 -46C14 -46 20 -32 21 -18C22 -7 16 -2 8 -2L-8 -2C-16 -2 -22 -7 -21 -18C-20 -32 -14 -46 0 -46Z'), [-22, -46, 44, 44], T, { inner: E(0, -16, 10, 14)(fl('#FFF4E4')) }) +
      solid(E(-8, -4, 6, 3.6), '#FFF4E4', 2.4) + solid(E(8, -4, 6, 3.6), '#FFF4E4', 2.4) +
      f3(E(0, -62, 22, 18), [-22, -80, 44, 36], T, { inner: E(0, -55, 10, 6.5)(fl('#FFF4E4')) + ln('M-4 -79L-3 -73M0 -80V-74M4 -79L3 -73', 2, '#C97B33') }) +
      eye(-8.5, -63, 2.8, 3.8) + eye(8.5, -63, 2.8, 3.8) + P('M-2.4 -58.5L2.4 -58.5L0 -55.8Z')(fl('#D9708C')) +
      ln('M-4 -53Q-2 -51 0 -53Q2 -51 4 -53M-13 -56L-22 -57M-13 -54L-21 -52M13 -56L22 -57M13 -54L21 -52', 1.3) + blush(-13, -59, 3.2) + blush(13, -59, 3.2);
  });

  def('kambing', 'Kambing', 'heavy', {}, 38, () => {
    const W = ['#F6EEE0', '#FFFFFF', '#D6C6AE'];
    const leg = (x, c) => limb(`M${x} -28L${x + 0.5} -6`, 5.5, c || '#F0E6D4', 2.2) + solid(R(x - 3.8, -7, 8.3, 6, 2), '#5A4636', 2);
    return leg(-21, '#CDBFA6') + leg(17, '#CDBFA6') + solid(P('M-34 -46L-41 -56L-32 -52Z'), '#F6EEE0', 2.4) +
      f3(E(-6, -38, 31, 18), [-37, -56, 62, 36], W, { inner: E(-16, -44, 13, 9)(fl('#B07A4A')) }) + leg(-14) + leg(23) +
      limb('M20 -68C18 -79 10 -84 4 -79', 3.6, '#B7A58A', 2.2) +
      f3(E(26, -60, 15, 12, 'rotate(18 26 -60)'), [11, -72, 30, 24], W, {}) +
      solid(P('M30 -50L35 -51L33 -41Z'), '#EADFCB', 2) +
      solid(P(leaf(16, -64, 6, -54, 4)), '#EADFCB', 2.2) + eye(27, -63, 2.4, 3.2) + dot(38, -55, 1.2, OL) + ln('M31 -52Q35 -51 37 -53', 1.4) + blush(23, -55, 3.2);
  });

  def('kerbau', 'Kerbau', 'heavy', {}, 46, () => {
    const K = ['#6F6A74', '#908B95', '#4D4952'];
    const leg = (x, c) => limb(`M${x} -34V-7`, 10, c || '#6A6570', 2.6) + solid(R(x - 6, -8, 12, 7, 2.5), '#2E2A30', 2.2);
    return leg(-26, '#4D4952') + leg(14, '#4D4952') + limb('M-44 -48C-49 -40 -49 -30 -47 -25', 2.4, '#625D67', 1.6) + solid(E(-47, -23, 3, 4.5), '#2E2A30', 1.8) +
      f3(P('M-45 -46C-45 -62 -28 -68 -8 -68C12 -68 28 -62 30 -48C32 -34 22 -26 -8 -26C-35 -26 -45 -32 -45 -46Z'), [-45, -68, 76, 42], K, {}) + leg(-34) + leg(6) +
      solid(P('M24 -61C20 -72 11 -77 2 -75C9 -71 15 -65 17 -58Z'), '#D3C6AC', 2.4) +
      f3(E(31, -50, 15, 13.5), [16, -63.5, 30, 27], K, {}) + solid(E(40, -43, 8.5, 7.5), '#9A949D', 2.4) + dot(38, -44, 1.3, OL) + dot(43.5, -43, 1.3, OL) +
      solid(P('M36 -60C36 -74 26 -83 12 -83C21 -78 27 -70 28 -59Z'), '#E9DFCB', 2.4) + solid(P(leaf(21, -55, 9, -51, 4)), '#625D67', 2.2) +
      eye(30, -53, 2.6, 3.4) + ln('M26 -58.5Q29 -60 32 -59', 1.3) + blush(26, -46, 3.4);
  });

  def('katak', 'Katak', 'light', {}, 28, () => {
    const G = ['#6CC05E', '#A3DD8F', '#46953F'];
    return solid(E(-21, -8, 10, 7), '#5DB050', 2.4) + solid(E(21, -8, 10, 7), '#5DB050', 2.4) +
      f3(P('M0 -40C18 -40 28 -28 28 -16C28 -5 16 -2 0 -2C-16 -2 -28 -5 -28 -16C-28 -28 -18 -40 0 -40Z'), [-28, -40, 56, 38], G, { inner: E(0, -11, 15, 9)(fl('#E3EEB0')) + dot(-14, -26, 2, '#46953F') + dot(15, -22, 1.6, '#46953F') }) +
      f3(C(-12, -38, 9), [-21, -47, 18, 18], G, { hl: false }) + f3(C(12, -38, 9), [3, -47, 18, 18], G, { hl: false }) +
      C(-12, -39, 6)(fl('#fff')) + C(12, -39, 6)(fl('#fff')) + eye(-11, -39, 3.2, 3.8) + eye(13, -39, 3.2, 3.8) +
      ln('M-12 -24Q0 -15 12 -24', 2) + blush(-18, -23, 3.6) + blush(18, -23, 3.6) +
      solid(E(-9, -3, 5, 3), '#5DB050', 2) + solid(E(9, -3, 5, 3), '#5DB050', 2);
  });

  def('ikan', 'Ikan', 'medium', {}, 32, () => {
    let sc = '';
    for (let x = -8; x < 22; x += 7) for (let y = -32; y < -10; y += 7) sc += `M${x} ${y}q3 3 0 6`;
    return f3(P('M24 -26L42 -38C40 -28 40 -20 42 -10Z'), [24, -38, 18, 28], ['#E8792A', '#F5A766', '#BD5A13'], { hl: false, k: 0.14 }) +
      solid(P('M-8 -40C0 -50 12 -48 18 -38Z'), '#E8792A', 2.4) +
      f3(P('M-34 -24C-28 -40 -10 -44 6 -42C20 -40 28 -32 28 -24C28 -16 20 -8 6 -6C-10 -4 -28 -8 -34 -24Z'), [-34, -42, 62, 37], PAL.orange, { inner: ln(sc, 1.3, '#C76A12', 0.6) }) +
      ln('M-18 -34Q-13 -24 -18 -14', 1.6) + C(-24, -27, 4.6)(fl('#fff')) + eye(-24, -27, 2.8, 3.2) +
      solid(P('M-4 -20C2 -22 8 -18 6 -12C2 -14 -2 -16 -4 -20Z'), '#F8B26A', 1.8) + ln('M-34 -23L-30 -22', 1.6) + spec(-12, -37, 1.6);
  });

  def('bebek', 'Bebek', 'medium', {}, 28, () => {
    const W = ['#FFFBF2', '#FFFFFF', '#E2D6C2'];
    return solid(P('M-10 -5L-4 -1L-14 -1Z'), '#F28C28', 2) + solid(P('M4 -5L10 -1L0 -1Z'), '#F28C28', 2) +
      f3(P('M-30 -30C-34 -38 -31 -43 -26 -40C-18 -34 -10 -34 2 -36C4 -44 6 -50 12 -52L22 -47C20 -41 21 -36 25 -31C30 -24 28 -6 0 -4C-18 -4 -28 -14 -30 -30Z'), [-32, -52, 60, 48], W, {
        top: ln('M-16 -24C-6 -16 8 -16 14 -24', 1.8, '#C9BBA4')
      }) +
      f3(C(14, -48, 13), [1, -61, 26, 26], W, {}) + solid(P('M24 -49C32 -51 39 -49 39 -45C39 -41 31 -40 24 -42Z'), '#F28C28', 2.2) +
      eye(16, -51, 2.4, 3.2) + blush(12, -43, 3.2);
  });

  /* ---------- containers ---------- */
  def('karung', 'Karung', 'heavy', {}, 36, () => {
    const B = ['#D9B77E', '#EBD3A4', '#B08A50'];
    return f3(P('M-12 -70C-18 -78 -22 -84 -16 -88C-8 -84 -4 -88 0 -86C4 -88 10 -84 16 -88C22 -84 18 -78 12 -70Z'), [-22, -88, 44, 18], B, { hl: false, k: 0.14 }) +
      f3(P('M-14 -68C-30 -62 -38 -40 -34 -14C-33 -5 -28 -1 -20 -1L20 -1C28 -1 33 -5 34 -14C38 -40 30 -62 14 -68Z'), [-38, -68, 76, 67], B, {
        inner: texture('weave', -40, -70, 80, 72, '#6B4A20', 0.09, 6),
        top: R(-17, -50, 34, 28, 4)(fl('#FFF8EC') + ` stroke="${OL}" stroke-width="1.6"`) + R(-14, -47, 28, 22, 2.5)(stk(1.1, '#C9A877') + ' stroke-dasharray="2.4 2.4"')
      }) + limb('M-15 -70Q0 -66 15 -70', 3.4, '#8A5A2E', 2);
  });

  def('kantong', 'Kantong isi 10', 'medium', {}, 24, () => {
    const B = ['#6FAEE3', '#A8D1F1', '#3F7EB8'];
    return f3(P('M-9 -44C-13 -50 -11 -54 -6 -53C-3 -55 3 -55 6 -53C11 -54 13 -50 9 -44Z'), [-13, -55, 26, 11], B, { hl: false, k: 0.14, sw: 2.6 }) +
      f3(P('M-9 -44C-22 -38 -26 -20 -22 -8C-20 -3 -16 -1 -10 -1L10 -1C16 -1 20 -3 22 -8C26 -20 22 -38 9 -44Z'), [-26, -44, 52, 43], B, {
        inner: texture('kawung', -28, -46, 56, 46, '#215F98', 0.16, 7), hx: 0.25, hy: 0.25
      }) + limb('M-10 -44Q0 -40 10 -44', 2.6, '#F28C28', 1.8) + ln('M10 -44Q16 -42 15 -36', 2, '#F28C28') +
      solid(C(0, -20, 11), '#FFF8EC', 2.2) + txt(0, -15.4, '10', 13);
  });

  def('keranjang', 'Keranjang', 'medium', {}, 40, () => {
    const B = PAL.rattan;
    let wv = '';
    for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) { const x = -40 + i * 9 + (row % 2) * 4.5, y = -40 + row * 9; wv += `M${x} ${y}h4.5`; }
    return limb('M-34 -46C-34 -96 34 -96 34 -46', 5, '#C99A5B', 2.6) + ln('M-31 -54C-30 -86 30 -86 31 -54', 1.2, '#9A6E36') +
      f3(P('M-42 -46L42 -46L34 -6Q32 -1 26 -1L-26 -1Q-32 -1 -34 -6Z'), [-42, -46, 84, 45], B, {
        inner: ln('M-42 -37H42M-42 -28H42M-42 -19H42M-42 -10H42', 1.4, '#9A6E36') + ln(wv, 3.2, '#E3BD86', 0.8)
      }) + f3(R(-46, -51, 92, 9, 4.5), [-46, -51, 92, 9], B, { k: 0.2, hl: false, top: ln('M-40 -46.5H40', 1.2, '#9A6E36') });
  });

  def('tampah', 'Tampah', 'light', {}, 46, () => {
    const B = ['#D9B57A', '#EDD3A1', '#AF8A4E'];
    return solid(E(0, -12, 48, 12), '#B4904F') +
      f3(E(0, -16, 48, 13), [-48, -29, 96, 26], B, { k: 0.12, hl: false }) +
      f3(E(0, -17, 40, 9.5), [-40, -26.5, 80, 19], ['#E6C68D', '#F2DCB0', '#C9A465'], { k: 0.1, sw: 1.8, hl: false, inner: texture('weave', -42, -28, 84, 22, '#6B4A20', 0.14, 5) });
  });

  /* ---------- public item API ---------- */
  function placeholder(name) {
    return `<g class="gs-item gs-item-missing" data-name="${String(name).replace(/[^\w-]/g, '')}">${shadow(26)}` +
      f3(R(-26, -50, 52, 49, 8), [-26, -50, 52, 49], ['#E9DCC6', '#F6EEDF', '#CDBB9E'], {}) + txt(0, -16, '?', 30, '#8A7358') + '</g>';
  }
  art.item = function (name, opts) {
    opts = opts || {};
    const d = ITEMS[name];
    if (!d) return placeholder(name);
    let body;
    try { body = d.draw(opts); } catch (e) { return placeholder(name); }
    return `<g class="gs-item gs-item-${name}">${opts.shadow === false ? '' : shadow(d.sh)}<g class="gs-item-body${opts.float ? ' gs-float-light' : ''}">${body}</g></g>`;
  };
  art.svg = function (name, size, opts) {
    size = size || 110;
    return `<svg class="gs-art gs-art-${String(name).replace(/[^\w-]/g, '')}" viewBox="-55 -105 110 110" width="${size}" height="${size}" role="img" aria-label="${art.meta(name).label}">${art.item(name, opts)}</svg>`;
  };
  art.names = () => Object.keys(ITEMS);
  art.meta = function (name) {
    const d = ITEMS[name];
    if (!d) return { label: String(name), heavy: 'medium' };
    return Object.assign({ label: d.label, heavy: d.heavy }, d.phys);
  };

  /* ===================== anak timbangan (brass weight) ===================== */
  art.weight = function (n, opts) {
    opts = opts || {};
    n = Math.max(1, Math.min(99, Math.round(+n) || 1));
    const k = Math.min(n, 20), hw = n1(25 + k * 0.85), T = n1(-(56 + k * 0.5)), B = -9;
    const body = P(`M${-hw} ${B}L${-hw} ${T}A${hw} 6 0 0 1 ${hw} ${T}L${hw} ${B}A${hw} 6 0 0 1 ${-hw} ${B}Z`);
    let s = opts.shadow === false ? '' : shadow(hw + 2);
    s += f3(R(-hw - 4, -12, 2 * hw + 8, 11, 5), [-hw - 4, -12, 2 * hw + 8, 11], PAL.brass, { k: 0.25, hl: false });
    s += f3(body, [-hw, T - 6, 2 * hw, B - T + 12], PAL.brass, { k: 0.1, kx: 1.6, hlShape: R(-hw + 5, T + 5, 5, B - T - 6, 2.5) });
    s += solid(E(0, T, hw, 6), '#EBC572', 2.6) + E(0, T, hw - 6, 3)(stk(1.2, '#A8771F', 0.5));
    s += f3(R(-5, T - 10, 10, 10, 2), [-5, T - 10, 10, 10], PAL.brass, { k: 0.2, hl: false, sw: 2.4 }) + f3(E(0, T - 13, 8.5, 7), [-8.5, T - 20, 17, 14], PAL.brass, { k: 0.14, sw: 2.6, hl: false }) + spec(-3.5, T - 15.5, 1.5);
    s += spec(-hw + 7.5, T + 9, 1.4);
    const dots = n <= 10;
    if (dots) {
      s += txt(0, T + (n > 5 ? 26.5 : 29), n, n === 10 ? 21 : 24);
      const rows = n > 5 ? [5, n - 5] : [n], sp = 8.2;
      rows.forEach((cnt, ri) => {
        const y = n > 5 ? -22 + ri * 8 : -18;
        for (let i = 0; i < cnt; i++) s += dot((n > 5 ? i - 2 : i - (cnt - 1) / 2) * sp, y, 2.9, '#5A3B10');
      });
    } else s += txt(0, (T + B) / 2 + 10, n, n > 99 ? 22 : 27);
    return `<g class="gs-weight" data-n="${n}">${s}</g>`;
  };

  /* ============================ people ============================ */
  const PPL = [
    { skin: '#D9A273', hair: 'short', top: '#FFFFFF', bot: '#D8342C', bt: 'shorts', collar: 1, shoe: '#2E2A30' },
    { skin: '#F0C9A0', hair: 'hijab', hc: '#FFFFFF', top: '#FFFFFF', bot: '#D8342C', bt: 'skirt', shoe: '#2E2A30' },
    { skin: '#B97A4E', hair: 'peci', top: '#2F80C9', batik: 1, bot: '#4A3C33', bt: 'pants', shoe: '#6B4A30' },
    { skin: '#E3AE82', hair: 'pony', top: '#FFC83D', bot: '#2F80C9', bt: 'skirt', shoe: '#E2453C' },
    { skin: '#C68A5C', hair: 'hijab', hc: '#F59AB0', top: '#4DAA57', bot: '#4DAA57', bt: 'dress', shoe: '#7E4A27' },
    { skin: '#8E5A35', hair: 'caping', top: '#86CC8C', bot: '#6B5240', bt: 'pants', shoe: '#3B2A20' },
    { skin: '#6E4428', hair: 'curly', top: '#F28C28', bot: '#215F98', bt: 'shorts', shoe: '#F5F0E6' },
    { skin: '#EBC39C', hair: 'spiky', top: '#0F8C7A', bot: '#5C4A3E', bt: 'shorts', bag: '#E2453C', shoe: '#2F80C9' }
  ];
  const HAIR = ['#2B1D14', '#4A3426', '#170F0A'];
  art.person = function (i, opts) {
    opts = opts || {};
    const p = PPL[(((i | 0) % 8) + 8) % 8];
    const sk = [p.skin, mix(p.skin, '#FFF3E0', 0.3), mix(p.skin, '#5A2A14', 0.25)];
    const top = [p.top, null, null], hij = p.hair === 'hijab';
    let s = opts.shadow === false ? '' : shadow(19);
    // legs + shoes
    const legC = p.bt === 'pants' ? p.bot : p.skin;
    s += limb('M-7 -30V-7', 7, legC, 2.4) + limb('M7 -30V-7', 7, legC, 2.4);
    s += solid(P('M-13 -2Q-13 -9 -7 -9Q-2 -9 -2 -4Q-2 -1 -5 -1H-11Q-13 -1 -13 -2Z'), p.shoe, 2.2) + solid(P('M13 -2Q13 -9 7 -9Q2 -9 2 -4Q2 -1 5 -1H11Q13 -1 13 -2Z'), p.shoe, 2.2);
    // bottom
    if (p.bt === 'shorts') s += f3(P('M-14 -45L14 -45L15.5 -26L2 -26L0 -32L-2 -26L-15.5 -26Z'), [-15.5, -45, 31, 19], p.bot, { k: 0.12, hl: false });
    if (p.bt === 'skirt') s += f3(P('M-13 -45L13 -45L19 -23Q0 -19 -19 -23Z'), [-19, -45, 38, 26], p.bot, { k: 0.12, hl: false, top: ln('M-6 -42L-8 -22M6 -42L8 -22', 1.2, mix(p.bot, '#000', 0.3)) });
    if (p.bt === 'pants') s += f3(P('M-13 -45L13 -45L12.5 -24L1.6 -24L0 -33L-1.6 -24L-12.5 -24Z'), [-13, -45, 26, 21], p.bot, { k: 0.12, hl: false });
    // torso / dress
    const torso = p.bt === 'dress' ? P('M-13 -58Q-14 -52 -14 -46L-20 -14Q0 -9 20 -14L14 -46Q14 -52 13 -58Q0 -61 -13 -58Z') : P('M-14 -58Q-15.5 -51 -14.5 -42L14.5 -42Q15.5 -51 14 -58Q0 -61 -14 -58Z');
    const tb = p.bt === 'dress' ? [-20, -60, 40, 48] : [-15.5, -60, 31, 18];
    let inner = '';
    if (p.batik) inner += texture('kawung', -22, -62, 44, 24, '#FFF8EC', 0.35, 7);
    if (p.bag) inner += ln('M-9 -58L-10 -43M9 -58L10 -43', 3, p.bag);
    if (p.bt === 'dress') inner += ln('M-14 -40Q0 -36 14 -40', 1.4, '#357F40');
    s += f3(torso, tb, top, { k: 0.1, hy: 0.25, inner });
    if (p.collar) s += solid(P('M-7 -59L0 -54L-2 -50L-9 -56Z'), '#FFFFFF', 1.6) + solid(P('M7 -59L0 -54L2 -50L9 -56Z'), '#FFFFFF', 1.6) + solid(P('M-1.6 -54L1.6 -54L2.2 -47L0 -45L-2.2 -47Z'), '#D8342C', 1.4);
    // arms
    const sleeve = mix(p.top, '#3B2A20', 0.05);
    [-1, 1].forEach(sd => {
      s += limb(`M${sd * 13} -56L${sd * 17} -48`, 7, sleeve, 2.2) + limb(`M${sd * 17} -48L${sd * 18} -40`, 5.2, p.skin, 2.2) + solid(C(sd * 18, -38.5, 3.4), p.skin, 2);
    });
    // hair behind head
    if (p.hair === 'pony') s += f3(P('M12 -88C26 -90 31 -76 26 -62C24 -70 20 -77 13 -79Z'), [12, -90, 19, 28], HAIR, { hl: false, k: 0.12, sw: 2.4 }) + solid(C(15, -84, 3), '#F59AB0', 1.8);
    if (p.hair === 'curly') s += f3(P(scallop(0, -80, 21, 16, 11, 3, 6)), [-27, -102, 54, 42], ['#1E140E', '#3A2A20', '#0F0A07'], { hl: false, k: 0.06, sw: 2.4 });
    if (hij) {
      const H = [p.hc, mix(p.hc, '#FFFFFF', 0.4), mix(p.hc, '#5A2A14', 0.2)];
      s += f3(P('M0 -97C14 -97 23 -86 23 -72C23 -64 21 -59 25 -50C16 -44 -16 -44 -25 -50C-21 -59 -23 -64 -23 -72C-23 -86 -14 -97 0 -97Z'), [-25, -97, 50, 53], H, { hx: 0.28, hy: 0.18 });
      s += f3(E(0, -73, 14, 14.5), [-14, -87.5, 28, 29], sk, { k: 0.08, sw: 2, hl: false });
    } else {
      s += solid(C(-17.5, -74, 3.8), p.skin, 2.2) + solid(C(17.5, -74, 3.8), p.skin, 2.2);
      s += f3(E(0, -76, 18, 17), [-18, -93, 36, 34], sk, { k: 0.08, hx: 0.3, hy: 0.4 });
    }
    // hair / headwear in front
    const SHORT = 'M-18.5 -74C-20 -90 -10 -96 1 -95C13 -95 20 -88 18.5 -74C16 -80 12 -84 6 -84C2 -80 -6 -80 -10 -82C-13 -80 -16 -78 -18.5 -74Z';
    if (p.hair === 'short' || p.hair === 'pony') s += f3(P(SHORT), [-19, -95, 38, 21], HAIR, { hl: false, k: 0.1, sw: 2.4, top: E(-6, -90, 5, 2, 'rotate(-15 -6 -90)')(fl('#5A4232')) });
    if (p.hair === 'spiky') s += f3(P('M-18.5 -74C-20 -84 -16 -90 -12 -92L-10 -99L-5 -93L0 -100L4 -93L10 -98L11 -91C17 -88 20 -82 18.5 -74C15 -82 8 -85 0 -84C-8 -85 -15 -82 -18.5 -74Z'), [-19, -100, 38, 26], HAIR, { hl: false, k: 0.1, sw: 2.4 });
    if (p.hair === 'curly') s += f3(P(scallop(0, -89, 16, 6, 8, 3, 2)), [-21, -100, 42, 18], ['#1E140E', '#3A2A20', '#0F0A07'], { hl: false, k: 0, sw: 2.4 });
    if (p.hair === 'peci') {
      s += P('M-18 -76C-19 -84 -16 -88 -12 -89L-12 -82C-15 -80 -17 -78 -18 -76ZM18 -76C19 -84 16 -88 12 -89L12 -82C15 -80 17 -78 18 -76Z')(fl(HAIR[0]));
      s += f3(P('M-15 -85L-14 -97Q0 -100 14 -97L15 -85Q0 -88 -15 -85Z'), [-15, -100, 30, 15], ['#33302F', '#5A5450', '#1C1A19'], { k: 0.12, sw: 2.4, hy: 0.4 });
    }
    if (p.hair === 'caping') {
      s += P('M-18 -76C-19 -84 -16 -87 -12 -88L-12 -82C-15 -80 -17 -78 -18 -76ZM18 -76C19 -84 16 -87 12 -88L12 -82C15 -80 17 -78 18 -76Z')(fl(HAIR[0]));
      s += f3(P('M-34 -83L0 -100L34 -83Q0 -77 -34 -83Z'), [-34, -100, 68, 22], ['#E8C987', '#F5E2B5', '#C49E5A'], { k: 0.12, hx: 0.38, hy: 0.45, top: ln('M0 -100L-18 -80M0 -100L-6 -79M0 -100L6 -79M0 -100L18 -80', 1.1, '#B48C4C') }) + ln('M-14 -79Q-16 -66 -10 -62M14 -79Q16 -66 10 -62', 1.1, '#8A6A3A');
    }
    // face
    const fy = hij ? -73 : -75;
    s += eye(-6.5, fy, 2.3, 3.1) + eye(6.5, fy, 2.3, 3.1) + blush(-11, fy + 5.5, 3.4) + blush(11, fy + 5.5, 3.4) +
      ln(`M-4 ${fy + 6.5}Q0 ${fy + 10.5} 4 ${fy + 6.5}`, 1.6) + ln(`M-1 ${fy + 3}q1 1 2 0`, 1.1, sk[2]);
    return `<g class="gs-person gs-person-${(((i | 0) % 8) + 8) % 8}">${s}</g>`;
  };

  /* ===================== Mascots: Chuppy and friends ===================== */
  // Every playable character (the child picks one; it is their companion in every game) is
  // drawn by ONE rig in a 200 x 200 box: feet on the ground at y ~190, contact shadow at
  // cy 192, body centred on x 100. A character supplies its own drawing (body, head, face,
  // tail) plus its arm geometry and colours; the rig adds the mood (eyes, mouth, arm pose,
  // extras) and the shared CSS hooks: .m-body (puff), .m-eyes (blink), .m-arm-r (wave),
  // .m-tail (sway), class "walk" on the svg (waddle).
  //
  // Chuppy: a chubby, soft "bakpao" robot: head and body are ONE round dumpling shape (no
  // separate small head), a dark screen for a face with LED eyes, teal headphone pods, an
  // antenna with a light bulb and a glowing chest light. Moves slowly and softly, like
  // something inflatable: it puffs while idle, waddles when it walks, waves when happy, hops on cheer.
  // The kids (Budi, Siti, Ani, Raka) keep the colours of the person avatars 0, 1, 3, 7 in chibi
  // proportions (big head, chubby round body, stubby legs); Mimi is a ginger kampung cat and
  // Kiko a green frog, both in the same chubby body language. No copyrighted character traits.
  const MOODS = ['idle', 'happy', 'cheer', 'think', 'surprise', 'oops', 'point'];
  const BOT = PAL.white, TEAL = ['#2BB3A6', '#7DD8CE', '#1D8278'], SCREEN = ['#22304A', '#3A4E70', '#141E30'];
  const LED = '#7CF5EA', MSW = 4.2, MDW = 2.6;
  const BOTP = 'M100 33C146 33 170 64 171 108C172 146 165 171 141 179C122 186 78 186 59 179C35 171 28 146 29 108C30 64 54 33 100 33Z';
  const MCFG = {
    idle: { eyes: 'open', mouth: 'smile', arms: 'down' },
    happy: { eyes: 'happy', mouth: 'grin', arms: 'out', blush: 0.8 },
    cheer: { eyes: 'cheer', mouth: 'open', arms: 'up', blush: 0.8, extra: 'sparkle' },
    think: { eyes: 'open', look: [3, -3], mouth: 'hmm', arms: 'chin', extra: 'dots' },
    surprise: { eyes: 'round', mouth: 'o', arms: 'wide', extra: 'pop' },
    oops: { eyes: 'oops', mouth: 'wobble', arms: 'scratch', extra: 'sweat' },
    point: { eyes: 'open', look: [4, 0], mouth: 'smirk', arms: 'point' }
  };
  // Arm poses per body family: [left, right], each [shoulder x, y, curve x, y, wrist x, y, hand x, y].
  // Arms start just inside the body edge; the right arm is the one that waves, points and scratches.
  const ARMSETS = {
    bot: {
      down: [[41, 120, 25, 134, 27, 152, 27, 155], [159, 120, 175, 134, 173, 152, 173, 155]],
      out: [[41, 120, 22, 126, 16, 141, 15, 144], [159, 120, 178, 126, 184, 141, 185, 144]],
      up: [[41, 118, 22, 102, 21, 79, 21, 75], [159, 118, 178, 102, 179, 79, 179, 75]],
      chin: [[41, 120, 25, 134, 27, 152, 27, 155], [159, 122, 174, 138, 140, 120, 136, 119]],
      wide: [[41, 118, 20, 112, 14, 97, 13, 93], [159, 118, 180, 112, 186, 97, 187, 93]],
      scratch: [[41, 120, 25, 134, 27, 152, 27, 155], [159, 120, 184, 104, 172, 66, 170, 62]],
      point: [[41, 120, 25, 134, 27, 152, 27, 155], [159, 118, 180, 114, 191, 103, 194, 101]]
    },
    // big head on a chubby little body: shoulders at (65, 130) and (135, 130)
    kid: {
      down: [[65, 130, 52, 142, 53, 158, 53, 161], [135, 130, 148, 142, 147, 158, 147, 161]],
      out: [[65, 130, 46, 134, 38, 148, 37, 151], [135, 130, 154, 134, 162, 148, 163, 151]],
      up: [[65, 128, 42, 120, 34, 92, 33, 88], [135, 128, 158, 120, 166, 92, 167, 88]],
      chin: [[65, 130, 52, 142, 53, 158, 53, 161], [135, 132, 158, 150, 128, 124, 124, 121]],
      wide: [[65, 128, 44, 124, 33, 108, 31, 104], [135, 128, 156, 124, 167, 108, 169, 104]],
      scratch: [[65, 130, 52, 142, 53, 158, 53, 161], [135, 130, 172, 112, 156, 52, 154, 48]],
      point: [[65, 130, 52, 142, 53, 158, 53, 161], [135, 128, 160, 126, 176, 114, 179, 112]]
    }
  };
  // the frog's mouth is lower and wider: its thinking hand rests under the mouth corner
  ARMSETS.frog = Object.assign({}, ARMSETS.bot, { chin: [[41, 120, 25, 134, 27, 152, 27, 155], [159, 124, 178, 146, 146, 134, 142, 133]] });
  const qp = a => `M${n1(a[0])} ${n1(a[1])}Q${n1(a[2])} ${n1(a[3])} ${n1(a[4])} ${n1(a[5])}`;
  // first part (0..t) of the arm curve, used for the short sleeve over the skin
  const qhead = (a, t) => {
    const L = (p, q) => p + (q - p) * t, mx = L(a[0], a[2]), my = L(a[1], a[3]);
    return [a[0], a[1], mx, my, L(mx, L(a[2], a[4])), L(my, L(a[3], a[5]))];
  };
  const pt = (x, y) => `${n1(x)} ${n1(y)}`;
  const clipTo = (inner, x, y, w, h) => { const id = uid('k'); return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`; };

  /* --- Chuppy's LED face --- */
  const led = (d, w) => ln(d, (w || 4.6) + 5, LED, 0.22) + ln(d, w || 4.6, LED);
  function mEye(kind, x, y, side) {
    if (kind === 'happy') return led(`M${x - 9} ${y + 4}Q${x} ${y - 9} ${x + 9} ${y + 4}`);
    if (kind === 'cheer') return led(`M${x - 9} ${y + 5}L${x} ${y - 5}L${x + 9} ${y + 5}`);
    if (kind === 'squint') return led(side < 0 ? `M${x - 7} ${y - 7}L${x + 6} ${y}L${x - 7} ${y + 7}` : `M${x + 7} ${y - 7}L${x - 6} ${y}L${x + 7} ${y + 7}`);
    if (kind === 'round') return C(x, y, 14)(fl(LED, 0.2)) + C(x, y, 10.5)(stk(4.4, LED)) + dot(x, y, 4.2, LED);
    return R(x - 11.5, y - 15.5, 23, 31, 11.5)(fl(LED, 0.2)) + R(x - 8.5, y - 12.5, 17, 25, 8.5)(fl(LED)) + R(x - 5.2, y - 8.5, 4.6, 7.2, 2.3)(fl('#fff', 0.85));
  }
  const MOUTH = {
    smile: 'M92 97Q100 103 108 97',
    grin: 'M88 95Q100 107 112 95',
    hmm: 'M91 99Q95.5 96 100 99Q104.5 102 109 99',
    wobble: 'M89 100L93.5 96.5L98 100L102.5 96.5L107 100L111 97',
    smirk: 'M91 99Q101 103 110 94'
  };

  /* --- ink face for the kids and animals: eyes like the eye() helper, mouths as ink lines --- */
  const IW = 4.8, MOUTHC = '#9E3B33', TONGUE = '#FF8FA3';
  function inkEye(kind, x, y, rx, ry, side) {
    if (kind === 'happy') return ln(`M${pt(x - rx - 1.5, y + 3)}Q${pt(x, y - ry - 4)} ${pt(x + rx + 1.5, y + 3)}`, IW, EYE);
    if (kind === 'cheer') return ln(`M${pt(x - rx - 1, y + 4)}L${pt(x, y - ry + 1)}L${pt(x + rx + 1, y + 4)}`, IW, EYE);
    if (kind === 'squint') return ln(side < 0 ? `M${pt(x - rx, y - ry * 0.75)}L${pt(x + rx * 0.9, y)}L${pt(x - rx, y + ry * 0.75)}` : `M${pt(x + rx, y - ry * 0.75)}L${pt(x - rx * 0.9, y)}L${pt(x + rx, y + ry * 0.75)}`, IW, EYE);
    if (kind === 'round') return C(x, y, ry + 2.5)(`fill="#fff" stroke="${OL}" stroke-width="2.6"`) + eye(x, y, rx * 0.78, rx * 0.78);
    return eye(x, y, rx, ry);
  }
  function inkEyes(M, f, side) {
    const lk = M.look || [0, 0], k = M.eyes;
    const one = (x, sd) => inkEye(k === 'oops' ? (sd < 0 ? 'open' : 'squint') : k, x + lk[0], f.ey + lk[1], f.erx, f.ery, sd);
    return one(100 - f.edx, -1) + one(100 + f.edx, 1);
  }
  function inkMouth(kind, x, y, w) {
    const o = `stroke="${OL}" stroke-width="2.6" stroke-linejoin="round"`;
    if (kind === 'grin' || kind === 'open') {
      const k = kind === 'open' ? 1.25 : 1, W = w * k, H = w * (kind === 'open' ? 1.25 : 0.9);
      const d = `M${pt(x - W - 1, y - 3)}Q${pt(x, y)} ${pt(x + W + 1, y - 3)}Q${pt(x + W * 0.9, y + H)} ${pt(x, y + H)}Q${pt(x - W * 0.9, y + H)} ${pt(x - W - 1, y - 3)}Z`;
      const id = uid('k');
      return `<clipPath id="${id}"><path d="${d}"/></clipPath>` + P(d)(`fill="${MOUTHC}"`) +
        `<g clip-path="url(#${id})">` + E(x, y + H, W * 0.62, H * 0.5)(fl(TONGUE)) + '</g>' + P(d)(`fill="none" ${o}`);
    }
    if (kind === 'o') return E(x, y + 2, Math.max(4.2, w * 0.5), Math.max(5.2, w * 0.62))(`fill="${MOUTHC}" ${o}`);
    if (kind === 'hmm') return ln(`M${pt(x - w, y)}Q${pt(x - w / 2, y - 4)} ${pt(x, y)}Q${pt(x + w / 2, y + 4)} ${pt(x + w, y)}`, 3.4, EYE);
    if (kind === 'wobble') return ln(`M${pt(x - w - 1, y + 1)}L${pt(x - w / 2, y - 2.5)}L${pt(x, y + 1)}L${pt(x + w / 2, y - 2.5)}L${pt(x + w + 1, y + 1)}`, 3.2, EYE);
    if (kind === 'smirk') return ln(`M${pt(x - w + 1, y)}Q${pt(x + 2, y + 5)} ${pt(x + w + 2, y - 5)}`, 3.4, EYE);
    return ln(`M${pt(x - w, y - 2)}Q${pt(x, y + w * 0.7)} ${pt(x + w, y - 2)}`, 3.4, EYE);
  }
  const cheeks = (M, f) => E(100 - f.cdx, f.cy, f.crx || 8.5, (f.crx || 8.5) * 0.58)(fl(PINK, M.blush || 0.55)) + E(100 + f.cdx, f.cy, f.crx || 8.5, (f.crx || 8.5) * 0.58)(fl(PINK, M.blush || 0.55));

  /* --- the characters --- */
  const CH = {};
  CH.chuppy = {
    name: 'Chuppy', kind: 'robot', arms: 'bot', eyesY: 78, shoulder: [159, 120], head: '24 6 152 152',
    arm: { w: 15, col: BOT[0], osw: 3.2, hand: BOT, hr: 9.5, hsw: MDW + 0.6 },
    draw(M) {
      const look = M.look || [0, 0];
      const white = (shape, box, opt) => f3(shape, box, BOT, Object.assign({ sw: MSW }, opt || {}));
      let b = '';
      // feet: chubby teal booties peeking out under the body
      b += f3(E(78, 183, 17, 9), [61, 174, 34, 18], TEAL, { sw: MDW + 0.6, hl: false, k: 0.18 }) + f3(E(122, 183, 17, 9), [105, 174, 34, 18], TEAL, { sw: MDW + 0.6, hl: false, k: 0.18 });
      // headphone pods behind the body
      b += f3(R(16, 66, 24, 40, 11), [16, 66, 24, 40], TEAL, { sw: MDW + 0.6, k: 0.12, hx: 0.4, hy: 0.25 }) + f3(R(160, 66, 24, 40, 11), [160, 66, 24, 40], TEAL, { sw: MDW + 0.6, k: 0.12, hx: 0.5, hy: 0.25 });
      // antenna (sways from its base) with a light bulb that glows
      b += g(limb('M100 36V18', 4.4, TEAL[0], 2.6) + '<g opacity=".5">' + C(100, 12, 13)(fl('#FFE08A') + ' class="m-glow"') + '</g>' +
        f3(C(100, 12, 7.5), [92.5, 4.5, 15, 15], PAL.yellow, { sw: MDW, k: 0.12, hx: 0.3, hy: 0.3 }) + dot(97.6, 9.4, 1.8, '#fff'), '', 'm-ant');
      // the round body, a soft seam and the chest light
      b += white(P(BOTP), [29, 33, 142, 152], {
        k: 0.07, hx: 0.24, hy: 0.14, hs: 1.1,
        top: ln('M34 126Q100 143 166 126', 2.2, OL, 0.22) +
          f3(C(100, 148, 14), [86, 134, 28, 28], TEAL, { sw: MDW, k: 0.1, hx: 0.3, hy: 0.3 }) +
          C(100, 148, 7)(fl('#FFE08A') + ' class="m-glow"') + dot(97.4, 145.4, 1.8, '#fff')
      });
      // the face screen with LED eyes, cheeks and mouth (eyes blink as one group)
      const lx = 78 + look[0], rx = 122 + look[0], ey = 78 + look[1];
      let eyes;
      if (M.eyes === 'oops') eyes = mEye('open', lx, ey, -1) + mEye('squint', rx, ey, 1);
      else eyes = mEye(M.eyes, lx, ey, -1) + mEye(M.eyes, rx, ey, 1);
      let face = g(eyes, '', 'm-eyes');
      const bl = M.blush || 0.5;
      face += E(61, 99, 8.5, 4.8)(fl(PINK, bl)) + E(139, 99, 8.5, 4.8)(fl(PINK, bl));
      if (M.mouth === 'open') face += P('M88 94Q100 96 112 94Q110 108 100 108Q90 108 88 94Z')(fl(LED)) + E(100, 104, 5, 2.2)(fl('#FF8FA3'));
      else if (M.mouth === 'o') face += E(100, 100, 4.6, 5.8)(stk(3.8, LED));
      else face += led(MOUTH[M.mouth], 4);
      b += f3(R(48, 47, 104, 66, 31), [48, 47, 104, 66], SCREEN, {
        sw: MDW + 0.6, k: 0.1, hl: false,
        top: P('M66 54Q57 55 55 65')(stk(3.4, '#fff')).replace('/>', ' opacity=".3"/>') + face
      });
      return b;
    }
  };

  // Kids: one builder, the identity lives in the colours, hair and clothes.
  const KB = 'M100 104C131 104 148 126 148 150C148 168 135 177 100 177C65 177 52 168 52 150C52 126 69 104 100 104Z';
  const KBOX = [52, 104, 96, 73];
  const KF = { ey: 82, edx: 21, erx: 7.6, ery: 10, my: 101, mw: 8, cdx: 36, cy: 97 };
  const HAIRK = ['#2B1D14', '#4A3426', '#170F0A'];
  function kid(p) {
    const sk = [p.skin, mix(p.skin, '#FFF3E0', 0.3), mix(p.skin, '#5A2A14', 0.25)];
    const hij = p.hair === 'hijab', f = Object.assign({}, KF, hij ? { ey: 84, edx: 19, my: 103, cdx: 30, cy: 99, crx: 7.5 } : {});
    return {
      name: p.name, kind: 'anak', arms: 'kid', eyesY: f.ey, shoulder: [135, 130], head: hij ? '34 8 132 132' : '38 10 124 124',
      ex: hij ? { dots: [8, -6], sweat: [-7, 2], pop: [10, -4] } : { dots: [2, -4] },
      arm: { w: 12, col: p.skin, osw: 2.8, hand: sk, hr: 8.6, hsw: 2.8, sleeve: { col: p.top, w: 15, t: 0.5 } },
      draw(M) {
        let b = '';
        // stubby legs and chunky shoes
        b += limb('M86 166V181', 12, p.skin, 2.6) + limb('M114 166V181', 12, p.skin, 2.6);
        b += f3(E(85, 184, 15, 7.5), [70, 176.5, 30, 15], [p.shoe], { sw: 2.8, k: 0.16, hx: 0.32, hy: 0.3 }) + f3(E(115, 184, 15, 7.5), [100, 176.5, 30, 15], [p.shoe], { sw: 2.8, k: 0.16, hx: 0.32, hy: 0.3 });
        // ponytail behind the head
        if (p.hair === 'pony') b += f3(P('M136 44C168 36 186 62 176 96C172 108 164 116 156 118C162 100 164 82 150 62Z'), [136, 38, 46, 80], HAIRK, { hl: false, k: 0.12, sw: 2.8 });
        // the chubby body is the shirt; shorts or skirt below
        let shirt = '';
        if (p.bag) shirt += limb('M75 112Q68 132 70 158', 6, p.bag, 2.2) + limb('M125 112Q132 132 130 158', 6, p.bag, 2.2);
        b += f3(P(KB), KBOX, [p.top], { k: 0.1, hx: 0.26, hy: 0.36, top: shirt });
        if (p.bt === 'shorts') b += clipTo(f3(P(KB), KBOX, [p.bot], { k: 0.1, hl: false }), 40, 152, 120, 40) + ln('M53 152H147', 2.6) + ln('M100 162V176', 2.2, mix(p.bot, '#000', 0.35));
        if (p.bt === 'skirt') b += f3(P('M62 148L138 148L151 171Q100 181 49 171Z'), [49, 148, 102, 30], [p.bot], { k: 0.12, hl: false, top: ln('M82 150L77 175M100 150V177M118 150L123 175', 1.6, mix(p.bot, '#000', 0.3), 0.7) });
        if (p.collar) {
          b += f3(P('M100 135L96 126L104 126Z'), [96, 126, 8, 9], ['#D8342C'], { k: 0, hl: false, sw: 2 }) + solid(P('M97 128L103 128L105 146L100 151L95 146Z'), '#D8342C', 2.2);
          b += solid(P('M100 122L78 110L80 131Z'), '#FFFFFF', 2.4) + solid(P('M100 122L122 110L120 131Z'), '#FFFFFF', 2.4);
        }
        // head: hijab or ears + round face
        if (hij) {
          const H = ['#FDFBF6', '#FFFFFF', '#DCD2C4'];
          b += f3(P('M100 16C138 16 162 42 162 76C162 96 158 108 166 126C150 142 50 142 34 126C42 108 38 96 38 76C38 42 62 16 100 16Z'), [34, 16, 132, 124], H, { hx: 0.26, hy: 0.14, k: 0.08, top: ln('M58 124Q100 138 142 124', 1.8, OL, 0.25) });
          b += f3(E(100, 84, 40, 37), [60, 47, 80, 74], sk, { k: 0.07, sw: 2.8, hx: 0.28, hy: 0.3 });
          b += ln('M66 66Q100 40 134 66', 2, OL, 0.2);
        } else {
          b += solid(C(51, 82, 9), p.skin, 2.8) + solid(C(149, 82, 9), p.skin, 2.8) + E(52, 82, 3.6, 4.6)(fl(sk[2], 0.7)) + E(148, 82, 3.6, 4.6)(fl(sk[2], 0.7));
          b += f3(E(100, 72, 50, 46), [50, 26, 100, 92], sk, { k: 0.08, hx: 0.24, hy: 0.42 });
        }
        // hair in front
        if (p.hair === 'short') b += f3(P('M49 80C41 44 64 19 100 19C136 19 159 44 151 80C147 64 140 55 130 50C122 58 110 59 102 52C94 59 80 59 72 52C62 57 54 66 49 80Z'), [41, 19, 118, 61], HAIRK, { hl: false, k: 0.08, sw: 3, top: E(78, 32, 13, 5, 'rotate(-18 78 32)')(fl('#5A4232')) });
        if (p.hair === 'pony') {
          b += f3(P('M49 82C41 44 64 19 100 19C136 19 159 44 151 82C148 64 138 50 120 45C108 54 84 57 66 50C58 58 52 68 49 82Z'), [41, 19, 118, 63], HAIRK, { hl: false, k: 0.08, sw: 3, top: E(78, 32, 13, 5, 'rotate(-18 78 32)')(fl('#5A4232')) });
          b += f3(C(147, 46, 7), [140, 39, 14, 14], ['#F59AB0'], { k: 0.14, sw: 2.4, hx: 0.3, hy: 0.3 });
        }
        if (p.hair === 'spiky') b += f3(P('M49 80C44 58 50 42 62 33L58 15L76 25L84 7L97 21L110 5L118 23L135 12L137 32C151 42 157 60 151 80C147 64 139 55 128 50C118 58 104 58 96 51C86 58 70 59 49 80Z'), [44, 5, 113, 75], HAIRK, { hl: false, k: 0.08, sw: 3 });
        // face
        b += cheeks(M, f) + g(inkEyes(M, f), '', 'm-eyes') + ln(`M98 ${f.my - 9}q2 1.6 4 0`, 1.8, sk[2]) + inkMouth(MOUTHK[M.mouth], 100, f.my, f.mw);
        return b;
      }
    };
  }
  const MOUTHK = { smile: 'smile', grin: 'grin', open: 'open', hmm: 'hmm', o: 'o', wobble: 'wobble', smirk: 'smirk' };
  CH.budi = kid({ name: 'Budi', skin: '#D9A273', hair: 'short', top: '#FFFFFF', bot: '#D8342C', bt: 'shorts', collar: 1, shoe: '#2E2A30' });
  CH.siti = kid({ name: 'Siti', skin: '#F0C9A0', hair: 'hijab', top: '#FFFFFF', bot: '#D8342C', bt: 'skirt', shoe: '#2E2A30' });
  CH.ani = kid({ name: 'Ani', skin: '#E3AE82', hair: 'pony', top: '#FFC83D', bot: '#2F80C9', bt: 'skirt', shoe: '#E2453C' });
  CH.raka = kid({ name: 'Raka', skin: '#EBC39C', hair: 'spiky', top: '#0F8C7A', bot: '#5C4A3E', bt: 'shorts', bag: '#E2453C', shoe: '#2F80C9' });

  // Mimi, the ginger kampung cat (colours of the 'kucing' item)
  const FUR = ['#F2A65A', '#F8C891', '#C97B33'], FURD = '#C97B33', MILK = ['#FFF4E4', '#FFFFFF', '#EAD6BC'];
  CH.kucing = {
    name: 'Mimi', kind: 'hewan', arms: 'kid', eyesY: 80, shoulder: [135, 130], head: '34 4 132 132',
    arm: { w: 13, col: FUR[0], osw: 2.8, hand: MILK, hr: 8.8, hsw: 2.8 },
    draw(M) {
      const f = { ey: 80, edx: 22, erx: 7.6, ery: 10, cdx: 38, cy: 95 };
      let b = '';
      // tail behind the body: sways from its base
      b += g(limb('M128 166C162 172 182 148 174 114', 14, FUR[0], 2.8) + ln('M175 124C175 120 175 117 174 114', 14, FURD) + ln('M162 164Q166 158 172 158M174 140Q170 136 176 132', 2, FURD, 0.8), '', 'm-tail');
      // paws
      b += f3(E(84, 184, 14, 8), [70, 176, 28, 16], MILK, { sw: 2.8, k: 0.16, hl: false }) + f3(E(116, 184, 14, 8), [102, 176, 28, 16], MILK, { sw: 2.8, k: 0.16, hl: false }) + ln('M80 182v4M88 182v4M112 182v4M120 182v4', 1.6, OL, 0.5);
      // body with a cream belly
      b += f3(P(KB), KBOX, FUR, { k: 0.1, hx: 0.26, hy: 0.36, inner: E(100, 152, 26, 22)(fl(MILK[0])) + ln('M60 132q6 3 12 2M140 132q-6 3 -12 2M56 148q6 2 11 1M144 148q-6 2 -11 1', 2.4, FURD, 0.7) });
      // ears (pink inside), then the round head with forehead stripes and a cream muzzle
      b += solid(P('M49 66L55 20Q57 11 65 16L96 38Z'), FUR[0], 2.8) + solid(P('M151 66L145 20Q143 11 135 16L104 38Z'), FUR[0], 2.8);
      b += P('M59 48L62 26L82 39Z')(fl(PINK)) + P('M141 48L138 26L118 39Z')(fl(PINK));
      b += f3(E(100, 78, 54, 44), [46, 34, 108, 88], FUR, { k: 0.08, hx: 0.24, hy: 0.4, inner: E(100, 101, 23, 15)(fl(MILK[0])) + ln('M90 36L92 50M100 34V50M110 36L108 50', 3.4, FURD) + ln('M47 82h8M47 90h6M153 82h-8M153 90h-6', 3, FURD, 0.7) });
      // face: eyes, pink nose, cat mouth, whiskers
      b += cheeks(M, f) + g(inkEyes(M, f), '', 'm-eyes');
      b += solid(P('M94.5 92Q100 90 105.5 92L100 98Z'), '#D9708C', 1.8);
      if (M.mouth === 'smile') b += ln('M100 98V101M90 100Q95 106 100 101Q105 106 110 100', 2.8, EYE);
      else b += ln('M100 98V100', 2.6, EYE) + inkMouth(MOUTHK[M.mouth], 100, 104, 7);
      b += ln('M76 99L50 95M76 104L51 108M124 99L150 95M124 104L149 108', 1.8, OL, 0.8);
      return b;
    }
  };

  // Kiko, the green frog (colours of the 'katak' item): head and body one round shape, eyes on top
  const FROG = ['#6CC05E', '#A3DD8F', '#46953F'], FROGF = ['#5DB050', '#8FD07E', '#3F8A38'];
  const FROGP = 'M100 74C99 54 86 43 68 43C50 43 40 56 42 72C30 86 24 108 24 132C24 164 40 180 62 183C82 186 118 186 138 183C160 180 176 164 176 132C176 108 170 86 158 72C160 56 150 43 132 43C114 43 101 54 100 74Z';
  CH.katak = {
    name: 'Kiko', kind: 'hewan', arms: 'frog', eyesY: 66, shoulder: [159, 120], head: '30 16 140 140',
    arm: { w: 14, col: FROGF[0], osw: 3, hand: FROGF, hr: 9, hsw: 3 },
    ex: { sweat: [-8, 14], pop: [10, 6], dots: [4, 6] },
    draw(M) {
      const lk = M.look || [0, 0];
      let b = '';
      // webbed feet
      const foot = x => f3(P(`M${x - 22} 186Q${x - 24} 176 ${x - 12} 175Q${x} 172 ${x + 12} 175Q${x + 24} 176 ${x + 22} 186Q${x + 14} 190 ${x + 7} 186Q${x} 191 ${x - 7} 186Q${x - 14} 190 ${x - 22} 186Z`), [x - 24, 172, 48, 18], FROGF, { sw: 2.8, k: 0.14, hl: false });
      b += foot(62) + foot(138);
      // one round body with the eye bumps, light belly and a few spots
      b += f3(P(FROGP), [24, 43, 152, 143], FROG, {
        k: 0.07, hx: 0.22, hy: 0.3, hs: 1.1,
        inner: E(100, 154, 50, 28)(fl('#E3EEB0')) + dot(40, 128, 4, FROG[2]) + dot(160, 124, 3.4, FROG[2]) + dot(46, 146, 2.6, FROG[2]) + dot(154, 142, 3, FROG[2])
      });
      // eyes: white balls in the bumps; closed moods show a green lid with an ink line
      const closed = M.eyes === 'happy' || M.eyes === 'cheer';
      let eyes = '';
      [-1, 1].forEach(sd => {
        const x = 100 + sd * 32, k = M.eyes === 'oops' ? (sd < 0 ? 'open' : 'squint') : M.eyes, shut = closed || k === 'squint';
        eyes += C(x, 66, 16.5)(`fill="${shut ? FROG[1] : '#fff'}" stroke="${OL}" stroke-width="2.6"`);
        eyes += k === 'round' ? eye(x + lk[0], 66 + lk[1], 6.5, 6.5) : inkEye(k, x + lk[0] - sd * 1.5, 67 + lk[1], 7.4, 9.4, sd);
      });
      b += g(eyes, '', 'm-eyes');
      // wide smile, cheeks and nostrils
      b += cheeks(M, { cdx: 52, cy: 110, crx: 9 }) + dot(94, 94, 1.7, OL, 0.7) + dot(106, 94, 1.7, OL, 0.7);
      if (M.mouth === 'smile') b += ln('M68 104Q100 126 132 104', 3.8, EYE);
      else b += inkMouth(MOUTHK[M.mouth], 100, 108, M.mouth === 'o' ? 12 : 17);
      return b;
    }
  };

  const CHAR_IDS = ['chuppy', 'budi', 'siti', 'ani', 'raka', 'kucing', 'katak'];
  art.CHARS = CHAR_IDS.map(id => ({ id, name: CH[id].name, kind: CH[id].kind }));
  art.mascotName = id => (CH[id] || CH.chuppy).name;
  const escA = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function pickChar(c) {
    if (!c) { try { c = typeof GS.mascotChar === 'function' && GS.mascotChar(); } catch (e) { c = null; } }
    return CH[c] ? c : 'chuppy';
  }
  /** GS.art.mascot({ mood, size, char, name }): the chosen companion (default: GS.mascotChar(), else Chuppy). */
  art.mascot = function (o) {
    o = o || {};
    const id = pickChar(o.char), D = CH[id];
    const mood = MOODS.indexOf(o.mood) >= 0 ? o.mood : 'idle', size = o.size || 120, M = MCFG[mood];
    const A = ARMSETS[D.arms][M.arms], a = D.arm, ex = D.ex || {};
    let s = `<ellipse cx="100" cy="192" rx="46" ry="6" fill="${OL}" opacity=".18"/>`;
    let b = D.draw(M);
    // arms + round mitten hands (the right arm is its own group so it can wave)
    const hand = (x, y) => f3(C(x, y, a.hr), [x - a.hr, y - a.hr, 2 * a.hr, 2 * a.hr], a.hand, { sw: a.hsw, k: 0.12, hx: 0.3, hy: 0.3 });
    const arm = q => limb(qp(q), a.w, a.col, a.osw) + (a.sleeve ? limb(qp(qhead(q, a.sleeve.t)), a.sleeve.w, a.sleeve.col, a.osw) : '') + hand(q[6], q[7]);
    b += arm(A[0]);
    b += g(arm(A[1]), '', 'm-arm-r');
    // mood extras (a character may shift them clear of its head)
    const at = (k, m) => ex[k] ? g(m, `translate(${ex[k][0]} ${ex[k][1]})`) : m;
    if (M.extra === 'dots') b += at('dots', [[160, 50, 3.2], [171, 38, 4.6], [184, 23, 6.6]].map(c => C(c[0], c[1], c[2])(`fill="#fff" stroke="${OL}" stroke-width="${MDW}"`)).join(''));
    if (M.extra === 'sweat') b += at('sweat', P('M40 42Q47 52 46 57Q45 63.5 39.5 63.5Q34 63 34 57.5Q34.5 51 40 42Z')(`fill="#3FA7C4" stroke="${OL}" stroke-width="${MDW}" stroke-linejoin="round"`) + E(38, 57, 1.6, 2.8)(fl('#fff', 0.9)));
    if (M.extra === 'sparkle') b += star4(14, 50, 8) + star4(186, 50, 8) + star4(36, 26, 5, '#F8B26A') + star4(164, 26, 5, '#F8B26A');
    if (M.extra === 'pop') b += at('pop', ln('M160 36L167 27M168 48L179 44M150 30L152 19', 3.2));
    s += g(b, '', 'm-body');
    return `<svg class="gs-mascot gs-mood-${mood} gs-char-${id}" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${escA(o.name || D.name)}">${s}</svg>`;
  };
  /** Square crop around the face of a mascot, for round avatar circles. */
  art.mascotHead = function (c, size, mood) {
    const id = pickChar(c);
    return art.mascot({ char: id, mood: mood || 'happy', size: size || 64 })
      .replace('viewBox="0 0 200 200"', `viewBox="${CH[id].head}"`).replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
  };
  // per-character motion origins: blink at eye height, wave from the right shoulder
  const MCSS = CHAR_IDS.filter(id => id !== 'chuppy').map(id => `.gs-char-${id} .m-eyes{transform-origin:100px ${CH[id].eyesY}px}.gs-char-${id}.gs-mood-happy .m-arm-r{transform-origin:${CH[id].shoulder[0]}px ${CH[id].shoulder[1]}px}`);

  /* ========================== backgrounds ========================== */
  const SKY_MIX = '#CBEBEF';
  const far = (c, t) => mix(c, SKY_MIX, t == null ? 0.4 : t);
  const pathF = (d, c, op) => `<path d="${d}" ${fl(c, op)}/>`;
  // Scenery extends this fraction of the width past each edge, so stages widened to
  // wide phone screens (core.js fitStage) never show the end of the world.
  const EXT = 0.6;
  function ridge(w, h, y, amp, n, seed, col) {
    const r = rng(seed), x0 = -w * EXT, x1 = w * (1 + EXT), pts = [];
    n = Math.round(n * (1 + 2 * EXT) / 1.24);
    for (let i = 0; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y - amp * (0.3 + 0.7 * r())]);
    let d = `M${n1(x0)} ${n1(h)}L${n1(pts[0][0])} ${n1(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2; d += `C${n1(mx)} ${n1(a[1])} ${n1(mx)} ${n1(b[1])} ${n1(b[0])} ${n1(b[1])}`; }
    return pathF(`${d}L${n1(x1)} ${n1(h)}Z`, col);
  }
  const mountain = (cx, base, wd, ht) => `M${n1(cx - wd)} ${n1(base)}C${n1(cx - wd * 0.45)} ${n1(base - ht * 0.6)} ${n1(cx - wd * 0.16)} ${n1(base - ht)} ${n1(cx)} ${n1(base - ht)}C${n1(cx + wd * 0.16)} ${n1(base - ht)} ${n1(cx + wd * 0.45)} ${n1(base - ht * 0.6)} ${n1(cx + wd)} ${n1(base)}Z`;
  const cloud = (x, y, s) => `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n1(s * 100) / 100})"><path d="M-42 0C-46 -12 -34 -20 -24 -15C-20 -30 4 -34 12 -20C20 -28 38 -24 37 -8C46 -8 48 0 42 0Z" fill="#fff" opacity=".95"/><path d="M-41 0C-40 -4 -36 -5 -30 -5L38 -5C43 -5 45 -2 42 0Z" fill="#E0F0F3"/></g>`;
  const sun = (x, y, r) => dot(x, y, r * 1.35, '#FFF4C8', 0.7) + dot(x, y, r, '#FFE58F');
  function palm(x, gy, H, lean, s, col) {
    col = col || '#5DA84F';
    const tx = x + lean, ty = gy - H, cx = x + lean * 0.15, cy = gy - H * 0.5, w0 = 6 * s, w1 = 3.5 * s;
    let o = pathF(`M${n1(x - w0)} ${n1(gy)}Q${n1(cx - w0)} ${n1(cy)} ${n1(tx - w1)} ${n1(ty)}L${n1(tx + w1)} ${n1(ty)}Q${n1(cx + w0)} ${n1(cy)} ${n1(x + w0)} ${n1(gy)}Z`, '#A07A52');
    let rings = '';
    for (let i = 1; i < 9; i++) { const t = i / 9, px = (1 - t) * (1 - t) * x + 2 * t * (1 - t) * cx + t * t * tx, py = (1 - t) * (1 - t) * gy + 2 * t * (1 - t) * cy + t * t * ty; rings += `M${n1(px - 5 * s)} ${n1(py + s)}l${n1(10 * s)} ${n1(-2 * s)}`; }
    o += ln(rings, 1.6 * s, '#80603F');
    [[-60, -6], [-34, -18], [-8, -22], [18, -20], [44, -8], [62, 8], [-48, 12]].forEach(([dx, dy], i) => {
      o += pathF(leaf(tx, ty, tx + dx * s, ty + (dy + 14) * s, 7 * s, (i % 2 ? -3 : 3) * s), i % 2 ? mix(col, '#2E6B33', 0.25) : col);
    });
    return o + dot(tx - 3 * s, ty + 4 * s, 4 * s, '#7E5A2E') + dot(tx + 4 * s, ty + 5 * s, 4 * s, '#6B4A24');
  }
  function tree(x, gy, s, cols, fruit) {
    cols = cols || ['#5DAE52', '#80C774', '#3F8A3E'];
    let o = pathF(`M${n1(x - 6 * s)} ${n1(gy)}L${n1(x - 4 * s)} ${n1(gy - 46 * s)}L${n1(x + 4 * s)} ${n1(gy - 46 * s)}L${n1(x + 6 * s)} ${n1(gy)}Z`, '#8A5A36');
    const blobs = [[0, -64, 30], [-25, -50, 22], [25, -50, 22], [-13, -82, 22], [14, -80, 22]];
    o += blobs.map(b => dot(x + (b[0] + 3) * s, gy + (b[1] + 4) * s, b[2] * s, cols[2])).join('');
    o += blobs.map(b => dot(x + b[0] * s, gy + b[1] * s, b[2] * s, cols[0])).join('');
    o += dot(x - 16 * s, gy - 88 * s, 8 * s, cols[1]) + dot(x - 30 * s, gy - 56 * s, 6 * s, cols[1]);
    if (fruit) [[-18, -46], [10, -52], [24, -40], [-4, -66], [-30, -40]].forEach(f => { o += E(x + f[0] * s, gy + f[1] * s, 3.4 * s, 4.6 * s)(fl(fruit)); });
    return o;
  }
  function house(x, gy, s, wall, roof) {
    const W = 74 * s, H = 38 * s, st = 12 * s, top = gy - st - H;
    let o = '';
    [-0.42, -0.14, 0.14, 0.42].forEach(f => { o += `<rect x="${n1(x + f * W - 2.5 * s)}" y="${n1(gy - st)}" width="${n1(5 * s)}" height="${n1(st)}" fill="#7E5A3A"/>`; });
    o += `<rect x="${n1(x - W / 2)}" y="${n1(top)}" width="${n1(W)}" height="${n1(H)}" fill="${wall}"/><rect x="${n1(x + W / 2 - 8 * s)}" y="${n1(top)}" width="${n1(8 * s)}" height="${n1(H)}" fill="${mix(wall, '#5A2A14', 0.18)}"/>`;
    o += texture('weave', x - W / 2, top, W - 8 * s, H, '#6B4A20', 0.08, 7 * s);
    o += `<rect x="${n1(x - W / 2 - 3 * s)}" y="${n1(gy - st - 4 * s)}" width="${n1(W + 6 * s)}" height="${n1(5 * s)}" fill="#8A5A36"/>`;
    o += `<rect x="${n1(x - 8 * s)}" y="${n1(top + 10 * s)}" width="${n1(14 * s)}" height="${n1(H - 14 * s)}" fill="#7A5238"/><rect x="${n1(x - 30 * s)}" y="${n1(top + 10 * s)}" width="${n1(14 * s)}" height="${n1(12 * s)}" fill="#7A5238"/><rect x="${n1(x + 14 * s)}" y="${n1(top + 10 * s)}" width="${n1(12 * s)}" height="${n1(12 * s)}" fill="#7A5238"/>`;
    o += pathF(`M${n1(x - W / 2 - 12 * s)} ${n1(top + 4 * s)}L${n1(x - 10 * s)} ${n1(top - 34 * s)}L${n1(x + 10 * s)} ${n1(top - 34 * s)}L${n1(x + W / 2 + 12 * s)} ${n1(top + 4 * s)}Z`, roof);
    o += pathF(`M${n1(x - W / 2 - 12 * s)} ${n1(top + 4 * s)}L${n1(x + W / 2 + 12 * s)} ${n1(top + 4 * s)}L${n1(x + W / 2 + 8 * s)} ${n1(top - 1 * s)}L${n1(x - W / 2 - 8 * s)} ${n1(top - 1 * s)}Z`, mix(roof, '#3B2A20', 0.25));
    o += pathF(`M${n1(x + 10 * s)} ${n1(top - 34 * s)}L${n1(x + W / 2 + 12 * s)} ${n1(top + 4 * s)}L${n1(x + W / 2 - 4 * s)} ${n1(top + 4 * s)}L${n1(x + 4 * s)} ${n1(top - 30 * s)}Z`, mix(roof, '#3B2A20', 0.12));
    return o;
  }
  function stall(x, gy, s, c1, c2, goods) {
    const W = 90 * s;
    let o = `<rect x="${n1(x - W / 2 + 2 * s)}" y="${n1(gy - 92 * s)}" width="${n1(5 * s)}" height="${n1(92 * s)}" fill="#8A5A36"/><rect x="${n1(x + W / 2 - 7 * s)}" y="${n1(gy - 92 * s)}" width="${n1(5 * s)}" height="${n1(92 * s)}" fill="#8A5A36"/>`;
    o += `<rect x="${n1(x - W / 2)}" y="${n1(gy - 36 * s)}" width="${n1(W)}" height="${n1(36 * s)}" fill="#B9794A"/><rect x="${n1(x - W / 2)}" y="${n1(gy - 36 * s)}" width="${n1(W)}" height="${n1(5 * s)}" fill="#D49A68"/>`;
    o += ln(`M${n1(x - W / 2)} ${n1(gy - 20 * s)}H${n1(x + W / 2)}`, 1.4 * s, '#8A5A36');
    (goods || ['#F28C28', '#E2453C', '#FFC83D']).forEach((c, i) => { for (let j = 0; j < 4; j++) o += dot(x - W / 2 + (14 + i * 26 + j * 5) * s, gy - (40 + (j % 2) * 4) * s, 4.5 * s, c); });
    const sw = W / 6;
    for (let i = 0; i < 6; i++) o += pathF(`M${n1(x - W / 2 - 6 * s + i * (sw + 2 * s))} ${n1(gy - 92 * s)}L${n1(x - W / 2 + i * sw)} ${n1(gy - 116 * s)}L${n1(x - W / 2 + (i + 1) * sw)} ${n1(gy - 116 * s)}L${n1(x - W / 2 - 6 * s + (i + 1) * (sw + 2 * s))} ${n1(gy - 92 * s)}Z`, i % 2 ? c2 : c1);
    for (let i = 0; i < 7; i++) o += pathF(`M${n1(x - W / 2 - 6 * s + i * (W + 12 * s) / 7)} ${n1(gy - 92 * s)}a${n1((W + 12 * s) / 14)} ${n1(6 * s)} 0 0 0 ${n1((W + 12 * s) / 7)} 0Z`, i % 2 ? c2 : c1);
    return o;
  }
  function bamboo(x, gy, H, s) {
    let o = '';
    [[-10, 1, '#7FB548'], [0, 1.1, '#6EA83E'], [11, 0.9, '#8CC055'], [-4, 0.75, '#5E9A36']].forEach(([dx, hk, c]) => {
      const top = gy - H * hk, bx = x + dx * s, tx = bx + dx * 0.6 * s;
      o += ln(`M${n1(bx)} ${n1(gy)}L${n1(tx)} ${n1(top)}`, 5 * s, c);
      for (let y = gy - 22 * s; y > top + 10 * s; y -= 22 * s) { const t = (gy - y) / (gy - top); o += ln(`M${n1(bx + (tx - bx) * t - 3 * s)} ${n1(y)}h${n1(6 * s)}`, 1.6 * s, mix(c, '#2E5A1E', 0.35)); }
      for (let k = 0; k < 4; k++) { const ly = top + k * 16 * s, lx = tx + (dx * 0.6 * s * k) / 4, sd = k % 2 ? 1 : -1; o += pathF(leaf(lx, ly, lx + sd * 26 * s, ly + 10 * s, 4.5 * s), mix(c, '#3E8A3A', 0.3)); }
    });
    return o;
  }
  function tuft(x, y, s, c) { return pathF(`M${n1(x - 8 * s)} ${n1(y)}Q${n1(x - 7 * s)} ${n1(y - 10 * s)} ${n1(x - 10 * s)} ${n1(y - 15 * s)}Q${n1(x - 2 * s)} ${n1(y - 9 * s)} ${n1(x)} ${n1(y - 17 * s)}Q${n1(x + 3 * s)} ${n1(y - 8 * s)} ${n1(x + 10 * s)} ${n1(y - 13 * s)}Q${n1(x + 7 * s)} ${n1(y - 6 * s)} ${n1(x + 8 * s)} ${n1(y)}Z`, c || '#5FAE52'); }
  function groundBand(w, h, y, col, seed, amp) {
    const r = rng(seed || 5), n = Math.round(8 * (1 + 2 * EXT) / 1.24), x0 = -w * EXT, x1 = w * (1 + EXT);
    let d = `M${n1(x0)} ${n1(h + 2)}L${n1(x0)} ${n1(y)}`;
    for (let i = 1; i <= n; i++) { const xa = x0 + ((x1 - x0) * (i - 0.5)) / n, xb = x0 + ((x1 - x0) * i) / n; d += `Q${n1(xa)} ${n1(y - (amp || 4) * r())} ${n1(xb)} ${n1(y)}`; }
    return pathF(`${d}L${n1(x1)} ${n1(h + 2)}Z`, col);
  }
  const edges = (w, fn) => fn(w * 0.05) + fn(w * 0.13) + fn(w * 0.87) + fn(w * 0.95);
  const diag = (w, h, y, op) => texture('diag', -w * EXT, y, w * (1 + 2 * EXT), h - y + 2, OL, op || 0.05, 14);

  const SCN = {
    kampung(w, h, G, s) {
      const F = sun(w * 0.82, h * 0.16, 20 * s) + cloud(w * 0.2, h * 0.14, s) + cloud(w * 0.6, h * 0.09, s * 0.7) +
        pathF(mountain(w * 0.4, G - 34 * s, 230 * s, 150 * s), far('#88B39A', 0.5)) + pathF(`M${n1(w * 0.4 - 22 * s)} ${n1(G - 175 * s)}Q${n1(w * 0.4)} ${n1(G - 190 * s)} ${n1(w * 0.4 + 22 * s)} ${n1(G - 175 * s)}L${n1(w * 0.4 + 12 * s)} ${n1(G - 165 * s)}L${n1(w * 0.4)} ${n1(G - 172 * s)}L${n1(w * 0.4 - 10 * s)} ${n1(G - 164 * s)}Z`, far('#6E9A80', 0.45)) +
        ridge(w, h, G - 44 * s, 36 * s, 7, 3, far('#A9D3A0', 0.35)) + ridge(w, h, G - 22 * s, 22 * s, 9, 8, far('#96CB8B', 0.15));
      const M = tree(w * 0.33, G - 6 * s, s * 0.8) + house(w * 0.11, G - 4 * s, s * 1.1, '#EBCB92', '#C8643B') + palm(w * 0.24, G - 2 * s, 128 * s, 14 * s, s) +
        tree(w * 0.68, G - 6 * s, s * 0.7) + house(w * 0.9, G - 4 * s, s, '#E6C389', '#B5502F') + palm(w * 0.77, G - 2 * s, 108 * s, -16 * s, s);
      const N = groundBand(w, h, G - 6 * s, '#7CC26B', 4, 5 * s) + groundBand(w, h, G + 6 * s, '#E5BE86', 7, 3 * s) + diag(w, h, G + 6 * s) +
        pathF(`M${n1(-w * EXT)} ${n1(h * 0.93)}H${n1(w * (1 + EXT))}V${n1(h + 2)}H${n1(-w * EXT)}Z`, '#D9AE73') + edges(w, x => tuft(x, G + 2 * s, s * 0.9));
      return [F, M, N];
    },
    sawah(w, h, G, s) {
      const F = pathF(mountain(w * 0.36, G - 60 * s, 170 * s, 140 * s), far('#7FA88F', 0.45)) + pathF(mountain(w * 0.66, G - 60 * s, 180 * s, 128 * s), far('#8DB59A', 0.45)) +
        sun(w * 0.51, G - 168 * s, 22 * s) + cloud(w * 0.16, h * 0.15, s * 0.8) + cloud(w * 0.82, h * 0.12, s * 0.9) + ridge(w, h, G - 58 * s, 16 * s, 8, 12, far('#A9D3A0', 0.3));
      let M = '';
      [[G - 60 * s, '#9AD27F'], [G - 42 * s, '#86C870'], [G - 24 * s, '#76BD62']].forEach(([y, c], i) => {
        M += groundBand(w, h, y, mix(c, '#5A9E4C', 0.25), 20 + i, 6 * s) + groundBand(w, h, y + 4 * s, c, 30 + i, 4 * s);
        for (let x = -w * 0.05 + i * 9 * s; x < w * 1.05; x += 18 * s) M += ln(`M${n1(x)} ${n1(y + 12 * s)}l${n1(-2 * s)} ${n1(-7 * s)}M${n1(x)} ${n1(y + 12 * s)}l${n1(2 * s)} ${n1(-8 * s)}`, 1.4 * s, mix(c, '#2E6B33', 0.35), 0.6);
        M += ln(`M${n1(w * (0.2 + i * 0.2))} ${n1(y + 9 * s)}h${n1(40 * s)}`, 2 * s, '#D8F1EC', 0.7);
      });
      M += palm(w * 0.07, G - 20 * s, 120 * s, 10 * s, s * 0.9) + house(w * 0.88, G - 28 * s, s * 0.6, '#E3C27F', '#9C7A4A');
      const N = groundBand(w, h, G - 2 * s, '#6FB35E', 41, 4 * s) + groundBand(w, h, G + 8 * s, '#7CC26B', 42, 3 * s) + diag(w, h, G + 8 * s, 0.04) +
        pathF(`M${n1(-w * EXT)} ${n1(h * 0.92)}Q${n1(w * 0.5)} ${n1(h * 0.89)} ${n1(w * (1 + EXT))} ${n1(h * 0.92)}V${n1(h + 2)}H${n1(-w * EXT)}Z`, '#D4A062') + edges(w, x => tuft(x, G + 6 * s, s, '#4E9E44'));
      return [F, M, N];
    },
    pasar(w, h, G, s) {
      let roofs = '';
      for (let i = 0; i < 9; i++) { const x = w * (0.04 + i * 0.12), hh = (26 + ((i * 37) % 3) * 9) * s; roofs += `<rect x="${n1(x)}" y="${n1(G - 30 * s - hh)}" width="${n1(52 * s)}" height="${n1(hh + 30 * s)}" fill="${far(i % 2 ? '#E8CFA6' : '#DDBE92', 0.45)}"/>` + pathF(`M${n1(x - 6 * s)} ${n1(G - 30 * s - hh)}L${n1(x + 26 * s)} ${n1(G - 48 * s - hh)}L${n1(x + 58 * s)} ${n1(G - 30 * s - hh)}Z`, far('#C8643B', 0.5)); }
      const F = cloud(w * 0.3, h * 0.12, s * 0.8) + cloud(w * 0.76, h * 0.16, s) + ridge(w, h, G - 70 * s, 30 * s, 6, 4, far('#A9D3A0', 0.4)) + roofs;
      let flags = ln(`M${n1(w * 0.18)} ${n1(h * 0.2)}Q${n1(w * 0.5)} ${n1(h * 0.3)} ${n1(w * 0.82)} ${n1(h * 0.2)}`, 1.4 * s, '#8A5A36');
      for (let i = 1; i < 14; i++) { const t = i / 14, x = w * (0.18 + 0.64 * t), y = h * 0.2 + 4 * t * (1 - t) * h * 0.1 * 1.0; flags += pathF(`M${n1(x - 7 * s)} ${n1(y)}L${n1(x + 7 * s)} ${n1(y)}L${n1(x)} ${n1(y + 14 * s)}Z`, ['#E2453C', '#FFC83D', '#2F80C9', '#4DAA57', '#F28C28'][i % 5]); }
      const M = flags + stall(w * 0.1, G - 2 * s, s * 1.05, '#E2453C', '#FFF3E0', ['#F28C28', '#E2453C', '#4DAA57']) + stall(w * 0.9, G - 2 * s, s * 1.05, '#2F80C9', '#FFF3E0', ['#FFC83D', '#F59AB0', '#F28C28']) + tree(w * 0.24, G - 2 * s, s * 0.6) + tree(w * 0.77, G - 2 * s, s * 0.55);
      let tiles = '';
      for (let x = -w * 0.1; x < w * 1.1; x += 40 * s) tiles += `M${n1(x)} ${n1(G + 4 * s)}l${n1(-14 * s)} ${n1(h - G)}`;
      const N = groundBand(w, h, G, '#D4A062', 9, 2 * s) + groundBand(w, h, G + 2 * s, '#E2B57A', 10, 2 * s) + ln(tiles, 1.4 * s, '#C48F55', 0.6) + ln(`M${n1(-w * 0.1)} ${n1(G + 30 * s)}H${n1(w * 1.1)}`, 1.4 * s, '#C48F55', 0.6);
      return [F, M, N];
    },
    pantai(w, h, G, s) {
      const sea = G - 64 * s;
      const F = sun(w * 0.74, h * 0.18, 22 * s) + cloud(w * 0.18, h * 0.12, s) + cloud(w * 0.5, h * 0.2, s * 0.6) +
        pathF(`M${n1(w * 0.3)} ${n1(sea)}Q${n1(w * 0.38)} ${n1(sea - 26 * s)} ${n1(w * 0.47)} ${n1(sea)}Z`, far('#7FB08A', 0.45)) +
        pathF(`M${n1(-w * EXT)} ${n1(sea)}H${n1(w * (1 + EXT))}V${n1(h)}H${n1(-w * EXT)}Z`, far('#3FA7C4', 0.25)) +
        ln(`M${n1(w * 0.1)} ${n1(sea + 10 * s)}h${n1(30 * s)}M${n1(w * 0.56)} ${n1(sea + 18 * s)}h${n1(46 * s)}M${n1(w * 0.8)} ${n1(sea + 8 * s)}h${n1(24 * s)}`, 2 * s, '#E6F5F0', 0.7) +
        pathF(`M${n1(w * 0.62)} ${n1(sea - 4 * s)}l${n1(9 * s)} ${n1(-22 * s)}l${n1(2 * s)} ${n1(22 * s)}Z`, far('#FFF8EC', 0.2)) + pathF(`M${n1(w * 0.6)} ${n1(sea - 4 * s)}h${n1(18 * s)}l${n1(-4 * s)} ${n1(4 * s)}h${n1(-11 * s)}Z`, far('#A8673A', 0.3));
      const foam = `M${n1(-w * EXT)} ${n1(G - 16 * s)}` + Array.from({ length: 16 }, (_, i) => `q${n1(w * 0.0775)} ${n1((i % 2 ? 6 : -6) * s)} ${n1(w * 0.155)} 0`).join('') + `V${n1(G)}H${n1(-w * EXT)}Z`;
      const M = pathF(foam, '#EAF7F7', 0.9) + palm(w * 0.06, G + 2 * s, 150 * s, 30 * s, s * 1.1) + palm(w * 0.93, G + 2 * s, 130 * s, -26 * s, s) + palm(w * 0.99, G + 2 * s, 96 * s, -8 * s, s * 0.8, '#6BB65C') +
        pathF(`M${n1(w * 0.78)} ${n1(G - 2 * s)}Q${n1(w * 0.8)} ${n1(G + 8 * s)} ${n1(w * 0.84)} ${n1(G + 8 * s)}H${n1(w * 0.9)}Q${n1(w * 0.93)} ${n1(G + 6 * s)} ${n1(w * 0.94)} ${n1(G - 2 * s)}Z`, '#C8643B') + ln(`M${n1(w * 0.79)} ${n1(G + 1 * s)}H${n1(w * 0.935)}`, 2 * s, '#FFF3E0');
      const N = groundBand(w, h, G - 4 * s, '#F3DDA6', 15, 4 * s) + diag(w, h, G, 0.04) + groundBand(w, h, h * 0.94, '#EBCF92', 16, 2 * s) +
        pathF(star5(w * 0.1, G + 30 * s, 9 * s), '#F28C28') + E(w * 0.92, G + 34 * s, 7 * s, 5 * s)(fl('#F59AB0')) + E(w * 0.06, G + 50 * s, 5 * s, 3.5 * s)(fl('#FFF8EC')) + E(w * 0.96, G + 52 * s, 6 * s, 4 * s)(fl('#E6C38E'));
      return [F, M, N];
    },
    sungai(w, h, G, s) {
      const F = cloud(w * 0.22, h * 0.13, s) + cloud(w * 0.72, h * 0.1, s * 0.75) + ridge(w, h, G - 90 * s, 34 * s, 6, 21, far('#A9D3A0', 0.4)) + ridge(w, h, G - 66 * s, 22 * s, 8, 22, far('#8CC47E', 0.2));
      const water = G - 40 * s;
      let rip = '';
      for (let i = 0; i < 7; i++) rip += `M${n1(w * (0.08 + (i * 0.137) % 0.86))} ${n1(water + (14 + (i % 3) * 18) * s)}h${n1(34 * s)}`;
      const M = groundBand(w, h, water - 10 * s, '#7CC26B', 31, 4 * s) + bamboo(w * 0.07, water - 6 * s, 170 * s, s) + bamboo(w * 0.94, water - 6 * s, 150 * s, s * 0.9) + tree(w * 0.2, water - 6 * s, s * 0.55) + tree(w * 0.8, water - 6 * s, s * 0.6) +
        pathF(`M${n1(-w * EXT)} ${n1(water)}H${n1(w * (1 + EXT))}V${n1(h + 2)}H${n1(-w * EXT)}Z`, '#3FA7C4') + pathF(`M${n1(-w * EXT)} ${n1(water)}H${n1(w * (1 + EXT))}V${n1(water + 6 * s)}H${n1(-w * EXT)}Z`, '#6FC0D6') + ln(rip, 2.4 * s, '#9ED8EC', 0.8);
      const N = pathF(`M${n1(-w * EXT)} ${n1(h * 0.86)}Q${n1(w * 0.08)} ${n1(h * 0.84)} ${n1(w * 0.18)} ${n1(h + 2)}H${n1(-w * EXT)}Z`, '#7CC26B') + pathF(`M${n1(w * (1 + EXT))} ${n1(h * 0.87)}Q${n1(w * 0.92)} ${n1(h * 0.85)} ${n1(w * 0.83)} ${n1(h + 2)}H${n1(w * (1 + EXT))}Z`, '#7CC26B') +
        tuft(w * 0.03, h * 0.88, s) + tuft(w * 0.97, h * 0.89, s) + E(w * 0.12, h * 0.95, 9 * s, 5 * s)(fl('#9A9DA2'));
      return [F, M, N];
    },
    kebun(w, h, G, s) {
      const F = sun(w * 0.15, h * 0.15, 18 * s) + cloud(w * 0.42, h * 0.12, s * 0.8) + cloud(w * 0.86, h * 0.17, s) + ridge(w, h, G - 50 * s, 34 * s, 7, 17, far('#A9D3A0', 0.35)) + ridge(w, h, G - 26 * s, 20 * s, 9, 18, far('#92C987', 0.15));
      let fence = '';
      for (let x = -w * 0.05; x < w * 1.05; x += 16 * s) fence += `<rect x="${n1(x)}" y="${n1(G - 30 * s)}" width="${n1(5 * s)}" height="${n1(30 * s)}" rx="${n1(2.5 * s)}" fill="#C9A06A"/>`;
      fence += `<rect x="${n1(-w * 0.1)}" y="${n1(G - 22 * s)}" width="${n1(w * 1.2)}" height="${n1(4 * s)}" fill="#B08650"/>`;
      const M = fence + tree(w * 0.1, G - 2 * s, s * 1.3, null, '#FFB938') + tree(w * 0.9, G - 2 * s, s * 1.2, null, '#FFB938') + tree(w * 0.24, G - 2 * s, s * 0.8);
      let fl8 = '';
      [0.04, 0.16, 0.84, 0.95].forEach((f, i) => { fl8 += dot(w * f, G + (14 + (i % 2) * 18) * s, 3 * s, ['#F59AB0', '#FFC83D', '#FFF8EC', '#F28C28'][i]); });
      const N = groundBand(w, h, G - 2 * s, '#7CC26B', 51, 4 * s) + diag(w, h, G, 0.04) + groundBand(w, h, h * 0.93, '#6BB35C', 52, 2 * s) + edges(w, x => tuft(x, G + 8 * s, s, '#5AA54E')) + fl8;
      return [F, M, N];
    },
    terminal(w, h, G, s) {
      let city = '';
      for (let i = 0; i < 12; i++) { const x = w * (-0.05 + i * 0.1), hh = (40 + ((i * 53) % 5) * 14) * s; city += `<rect x="${n1(x)}" y="${n1(G - 20 * s - hh)}" width="${n1(w * 0.085)}" height="${n1(hh)}" fill="${far(['#C9CFC6', '#D9C9AE', '#B9C4CC'][i % 3], 0.5)}"/>`; }
      const F = cloud(w * 0.26, h * 0.12, s) + cloud(w * 0.7, h * 0.08, s * 0.7) + city + ridge(w, h, G - 22 * s, 12 * s, 9, 61, far('#A9D3A0', 0.25));
      const sx = w * 0.1;
      let shelter = '';
      [-40, 40].forEach(dx => { shelter += `<rect x="${n1(sx + (dx - 2) * s)}" y="${n1(G - 96 * s)}" width="${n1(5 * s)}" height="${n1(96 * s)}" fill="#6B737C"/>`; });
      shelter += pathF(`M${n1(sx - 58 * s)} ${n1(G - 94 * s)}L${n1(sx + 58 * s)} ${n1(G - 94 * s)}L${n1(sx + 48 * s)} ${n1(G - 112 * s)}L${n1(sx - 48 * s)} ${n1(G - 112 * s)}Z`, '#2F80C9') + `<rect x="${n1(sx - 58 * s)}" y="${n1(G - 96 * s)}" width="${n1(116 * s)}" height="${n1(6 * s)}" fill="#215F98"/>`;
      shelter += `<rect x="${n1(sx - 34 * s)}" y="${n1(G - 32 * s)}" width="${n1(68 * s)}" height="${n1(6 * s)}" rx="${n1(2 * s)}" fill="#A8673A"/><rect x="${n1(sx - 30 * s)}" y="${n1(G - 26 * s)}" width="${n1(4 * s)}" height="${n1(24 * s)}" fill="#7E4A27"/><rect x="${n1(sx + 26 * s)}" y="${n1(G - 26 * s)}" width="${n1(4 * s)}" height="${n1(24 * s)}" fill="#7E4A27"/>`;
      const px = w * 0.9;
      const sign = `<rect x="${n1(px - 2 * s)}" y="${n1(G - 100 * s)}" width="${n1(4 * s)}" height="${n1(100 * s)}" fill="#6B737C"/>` + dot(px, G - 106 * s, 14 * s, '#2F80C9') + dot(px, G - 106 * s, 10 * s, '#FFF8EC') + `<rect x="${n1(px - 7 * s)}" y="${n1(G - 110 * s)}" width="${n1(14 * s)}" height="${n1(8 * s)}" rx="${n1(2 * s)}" fill="#2F80C9"/>`;
      const M = shelter + sign + tree(w * 0.78, G - 2 * s, s * 0.75) + tree(w * 0.26, G - 2 * s, s * 0.6);
      let dash = '';
      for (let x = -w * 0.1; x < w * 1.1; x += 60 * s) dash += `M${n1(x)} ${n1(G + 44 * s)}h${n1(30 * s)}`;
      const N = groundBand(w, h, G - 4 * s, '#D4A062', 62, 1) + pathF(`M${n1(-w * EXT)} ${n1(G + 6 * s)}H${n1(w * (1 + EXT))}V${n1(h + 2)}H${n1(-w * EXT)}Z`, '#8E8A86') + pathF(`M${n1(-w * EXT)} ${n1(G + 6 * s)}H${n1(w * (1 + EXT))}V${n1(G + 10 * s)}H${n1(-w * EXT)}Z`, '#77736F') + ln(dash, 4 * s, '#F3EEE2');
      return [F, M, N];
    },
    warung(w, h, G, s) {
      const F = sun(w * 0.86, h * 0.14, 18 * s) + cloud(w * 0.34, h * 0.1, s * 0.9) + cloud(w * 0.6, h * 0.18, s * 0.6) + ridge(w, h, G - 54 * s, 30 * s, 7, 71, far('#A9D3A0', 0.38)) + ridge(w, h, G - 28 * s, 18 * s, 9, 72, far('#96CB8B', 0.18));
      const x = w * 0.13, W = 120 * s;
      let wr = `<rect x="${n1(x - W / 2)}" y="${n1(G - 84 * s)}" width="${n1(W)}" height="${n1(84 * s)}" fill="#D29A62"/><rect x="${n1(x + W / 2 - 10 * s)}" y="${n1(G - 84 * s)}" width="${n1(10 * s)}" height="${n1(84 * s)}" fill="#B07A48"/>`;
      wr += `<rect x="${n1(x - W / 2 + 10 * s)}" y="${n1(G - 70 * s)}" width="${n1(W - 30 * s)}" height="${n1(34 * s)}" fill="#6B4A36"/><rect x="${n1(x - W / 2 + 6 * s)}" y="${n1(G - 38 * s)}" width="${n1(W - 22 * s)}" height="${n1(6 * s)}" fill="#8A5A36"/>`;
      ['#E2453C', '#FFC83D', '#4DAA57', '#F28C28', '#2F80C9', '#F59AB0'].forEach((c, i) => { wr += `<rect x="${n1(x - W / 2 + (14 + i * 14) * s)}" y="${n1(G - 70 * s)}" width="${n1(9 * s)}" height="${n1(13 * s)}" fill="${c}"/>`; });
      [0, 1, 2].forEach(i => { wr += `<rect x="${n1(x - W / 2 + (18 + i * 26) * s)}" y="${n1(G - 54 * s)}" width="${n1(14 * s)}" height="${n1(16 * s)}" rx="${n1(3 * s)}" fill="#CFEFF7"/>` + `<rect x="${n1(x - W / 2 + (19.5 + i * 26) * s)}" y="${n1(G - 46 * s)}" width="${n1(11 * s)}" height="${n1(7 * s)}" fill="${['#F8B26A', '#E2453C', '#FFE08A'][i]}"/>`; });
      wr += pathF(`M${n1(x - W / 2 - 12 * s)} ${n1(G - 80 * s)}L${n1(x + W / 2 + 12 * s)} ${n1(G - 80 * s)}L${n1(x + W / 2)} ${n1(G - 108 * s)}L${n1(x - W / 2)} ${n1(G - 108 * s)}Z`, '#9FB3BD');
      let cor = '';
      for (let i = 0; i < 12; i++) cor += `M${n1(x - W / 2 - 8 * s + i * 11.5 * s)} ${n1(G - 81 * s)}l${n1(4 * s)} ${n1(-26 * s)}`;
      wr += ln(cor, 1.6 * s, '#7E929C') + `<rect x="${n1(x - 34 * s)}" y="${n1(G - 122 * s)}" width="${n1(68 * s)}" height="${n1(16 * s)}" rx="${n1(3 * s)}" fill="#FFF3E0"/>` + `<text x="${n1(x)}" y="${n1(G - 110 * s)}" font-family="'Baloo 2', system-ui, sans-serif" font-weight="800" font-size="${n1(11 * s)}" fill="#C8643B" text-anchor="middle">WARUNG</text>`;
      wr += `<rect x="${n1(x + W / 2 + 6 * s)}" y="${n1(G - 18 * s)}" width="${n1(40 * s)}" height="${n1(5 * s)}" fill="#A8673A"/><rect x="${n1(x + W / 2 + 9 * s)}" y="${n1(G - 13 * s)}" width="${n1(4 * s)}" height="${n1(13 * s)}" fill="#7E4A27"/><rect x="${n1(x + W / 2 + 39 * s)}" y="${n1(G - 13 * s)}" width="${n1(4 * s)}" height="${n1(13 * s)}" fill="#7E4A27"/>`;
      const M = wr + tree(w * 0.88, G - 2 * s, s * 1.1) + palm(w * 0.97, G, 120 * s, -14 * s, s * 0.9) + tree(w * 0.72, G - 2 * s, s * 0.55);
      const N = groundBand(w, h, G - 2 * s, '#E5BE86', 81, 3 * s) + diag(w, h, G) + edges(w, x2 => tuft(x2, G + 4 * s, s * 0.8)) + E(w * 0.95, G + 40 * s, 10 * s, 5 * s)(fl('#D4A062'));
      return [F, M, N];
    }
  };
  function star5(cx, cy, r) {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.48 : r; d += (i ? 'L' : 'M') + n1(cx + Math.cos(a) * rr) + ' ' + n1(cy + Math.sin(a) * rr); }
    return d + 'Z';
  }
  art.sceneNames = () => Object.keys(SCN);
  art.scene = function (name, w, h) {
    w = +w || 1280; h = +h || 800;
    const G = h * 0.78, s = Math.min(h / 360, w / 640), id = uid('sky');
    const L = (SCN[name] || SCN.kampung)(w, h, G, s);
    return `<g class="gs-scene gs-scene-${SCN[name] ? name : 'kampung'}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ED8EC"/><stop offset="1" stop-color="#E6F5F0"/></linearGradient></defs>` +
      `<rect x="${n1(-w * EXT)}" y="0" width="${n1(w * (1 + 2 * EXT))}" height="${n1(h)}" fill="url(#${id})"/><g class="layer-far">${L[0]}</g><g class="layer-mid">${L[1]}</g><g class="layer-near">${L[2]}</g></g>`;
  };

  /** Single scenery pieces for pages that lay out their own world (the hub map).
      gy = ground line, s = scale. kinds: tree, fruit, house, house2, palm, bamboo, tuft, stall. */
  art.decor = function (kind, x, gy, s) {
    s = +s || 1;
    switch (kind) {
      case 'tree': return tree(x, gy, s);
      case 'fruit': return tree(x, gy, s, null, '#FFB938');
      case 'house': return house(x, gy, s, '#EBCB92', '#C8643B');
      case 'house2': return house(x, gy, s, '#E6C389', '#B5502F');
      case 'palm': return palm(x, gy, 120 * s, 12 * s, s);
      case 'bamboo': return bamboo(x, gy, 150 * s, s);
      case 'tuft': return tuft(x, gy, s);
      case 'stall': return stall(x, gy, s, '#E2453C', '#FFF3E0', ['#F28C28', '#E2453C', '#4DAA57']);
      default: return '';
    }
  };

  /* ============================ landmarks ============================ */
  const grassBase = (rx) => f3(E(0, -5, rx, 9), [-rx, -14, 2 * rx, 18], PAL.grass, { hl: false, k: 0.2, sw: 2.6 });
  const LM = {
    pasar() {
      let s = shadow(86) + grassBase(88);
      s += f3(R(-74, -128, 8, 124, 2), [-74, -128, 8, 124], PAL.wood, { hl: false, k: 0.3 }) + f3(R(66, -128, 8, 124, 2), [66, -128, 8, 124], PAL.wood, { hl: false, k: 0.3 });
      s += P('M-66 -120H66V-56H-66Z')(fl('#F3DDA6')) + texture('kawung', -66, -120, 132, 64, '#A8673A', 0.12, 10);
      s += f3(R(-84, -58, 168, 52, 5), [-84, -58, 168, 52], ['#B9794A', '#D49A68', '#8A5530'], { hl: false, top: ln('M-84 -40H84M-84 -24H84', 1.6, '#8A5530') });
      [[-66, '#F28C28'], [-56, '#F28C28'], [-61, '#F28C28'], [-46, '#F28C28']].forEach(([x, c], i) => { s += f3(C(x, i === 2 ? -73 : -65, 7.5), [x - 7.5, -80, 15, 15], [c, null, null], { k: 0.14, sw: 2.2 }); });
      [[-30, -66], [-20, -66], [-25, -74]].forEach(([x, y]) => { s += f3(C(x, y, 7), [x - 7, y - 7, 14, 14], PAL.red, { k: 0.14, sw: 2.2 }); });
      s += g(f3(P(BAN), [-31, -24, 63, 24], PAL.yellow, { k: 0.14, sw: 2.4 }), 'translate(4 -56) scale(.55)');
      // timbangan (table balance)
      s += f3(R(28, -64, 44, 7, 3), [28, -64, 44, 7], PAL.brass, { hl: false, k: 0.25, sw: 2.4 }) + f3(R(47, -100, 6, 37, 2), [47, -100, 6, 37], PAL.brass, { hl: false, k: 0.3, sw: 2.4 });
      s += f3(R(22, -104, 56, 6, 3), [22, -104, 56, 6], PAL.brass, { hl: false, k: 0.25, sw: 2.4 }) + solid(C(50, -101, 4), '#EECB7A', 2.2);
      s += ln('M27 -100L22 -84M27 -100L32 -84M73 -100L68 -84M73 -100L78 -84', 1.4) + solid(P('M16 -84H38Q35 -76 27 -76Q19 -76 16 -84Z'), '#D9A441', 2.2) + solid(P('M62 -84H84Q81 -76 73 -76Q65 -76 62 -84Z'), '#D9A441', 2.2) + f3(C(27, -88, 4.5), [22.5, -92.5, 9, 9], PAL.red, { k: 0.15, sw: 1.8, hl: false });
      // striped awning with scalloped valance
      const aw = P('M-90 -124L90 -124L78 -160L-78 -160Z');
      let stripes = '';
      for (let i = 0; i < 9; i += 2) stripes += P(`M${-90 + i * 20} -124L${-78 + i * 17.33} -160L${-78 + (i + 1) * 17.33} -160L${-90 + (i + 1) * 20} -124Z`)(fl('#E2453C'));
      s += f3(aw, [-90, -160, 180, 36], ['#FFF3E0', '#FFFFFF', '#E6D3B8'], { hl: false, k: 0.12, inner: stripes });
      for (let i = 0; i < 9; i++) s += solid(P(`M${-90 + i * 20} -124a10 9 0 0 0 20 0Z`), i % 2 ? '#FFF3E0' : '#E2453C', 2.4);
      return s;
    },
    terminal() {
      let s = shadow(86) + grassBase(88);
      s += f3(R(-76, -164, 5, 150, 2), [-76, -164, 5, 150], PAL.steel, { hl: false, k: 0.3, sw: 2.4 }) + f3(C(-73.5, -152, 14), [-87.5, -166, 28, 28], PAL.blue, { k: 0.1, sw: 2.6 }) + C(-73.5, -152, 9.5)(fl('#FFF8EC')) + solid(R(-81, -156, 15, 8, 2.5), '#2F80C9', 1.6);
      const body = P('M-82 -24L-82 -86Q-82 -100 -68 -101L36 -103Q52 -103 60 -92L80 -66Q86 -60 86 -50L86 -24Q86 -14 76 -14L-72 -14Q-82 -14 -82 -24Z');
      s += f3(body, [-82, -103, 168, 89], ['#2E9C8A', '#62C2B2', '#1D7466'], {
        k: 0.06, hx: 0.2, hy: 0.2, inner: R(-84, -58, 172, 9)(fl('#FFC83D')) + R(-84, -49, 172, 2.5)(fl('#E09A00')), top: ln('M-82 -36H86', 1.6, '#1D7466')
      });
      s += solid(R(-72, -94, 30, 24, 5), '#CFEFF7', 2.4) + solid(R(-36, -94, 30, 24, 5), '#CFEFF7', 2.4) + solid(P('M38 -95L54 -95Q58 -95 61 -91L76 -70L38 -70Z'), '#CFEFF7', 2.4);
      s += ln('M-68 -90L-60 -78M-32 -90L-24 -78M42 -91L50 -79', 2.6, '#fff', 0.85);
      s += solid(R(2, -96, 30, 62, 4), '#3A3238', 2.4) + solid(R(4, -40, 26, 5, 2), '#8C8F94', 2);
      s += f3(R(-46, -116, 70, 15, 5), [-46, -116, 70, 15], PAL.cream, { hl: false, k: 0.15, sw: 2.4 }) + txt(-11, -104.5, 'KAMPUNG', 11, '#215F98', "'Baloo 2', system-ui, sans-serif");
      s += solid(E(82, -56, 3.5, 5), '#FFE08A', 2) + solid(R(78, -32, 12, 9, 3.5), '#B9C0C7', 2.2) + solid(R(-86, -32, 10, 9, 3.5), '#B9C0C7', 2.2);
      [-50, 52].forEach(x => { s += f3(C(x, -16, 15), [x - 15, -31, 30, 30], ['#3A3436', '#5A5356', '#232022'], { hl: false, k: 0.1 }) + f3(C(x, -16, 6.5), [x - 6.5, -22.5, 13, 13], PAL.steel, { hl: false, sw: 2, k: 0.15 }) + spec(x - 3, -19, 1.2); });
      return s;
    },
    sawah() {
      let s = shadow(86);
      s += palmLm(-64, -92, 56);
      const tier = (y, hw, top, i) => {
        const surf = P(`M${-hw} ${y}Q0 ${y - 12} ${hw} ${y}L${hw} ${y + top}Q0 ${y + top - 10} ${-hw} ${y + top}Z`);
        let rice = '';
        for (let x = -hw + 8; x < hw - 4; x += 11) { const yy = y + top * 0.55 - 6 * (1 - (x / hw) ** 2) + (i % 2) * 2; rice += `M${x} ${n1(yy)}l-2 -7M${x} ${n1(yy)}l2 -8M${x} ${n1(yy)}l0 -9`; }
        return f3(surf, [-hw, y - 12, 2 * hw, top + 12], ['#8FCB78', '#BFE6B0', '#5E9E4E'], { hl: false, k: 0.12, inner: ln(`M${-hw * 0.5} ${n1(y + top * 0.42 - 6)}h${n1(hw * 0.5)}`, 2.4, '#D8F1EC', 0.9) + ln(rice, 1.8, '#3E8A3A') }) +
          f3(P(`M${-hw} ${y + top}Q0 ${y + top - 10} ${hw} ${y + top}L${hw} ${y + top + 12}Q0 ${y + top + 2} ${-hw} ${y + top + 12}Z`), [-hw, y + top - 10, 2 * hw, 22], ['#C69259', '#DDB07A', '#9A6A36'], { hl: false, k: 0.2, sw: 2.6 });
      };
      s += tier(-128, 58, 16, 0) + tier(-98, 74, 18, 1) + tier(-64, 88, 20, 2);
      s += f3(P('M-90 -30Q0 -42 90 -30L90 -6Q0 2 -90 -6Z'), [-90, -42, 180, 44], PAL.grass, { hl: false, k: 0.12, top: ln('M-70 -18l-2 -8M-66 -18l2 -9M60 -16l-2 -8M64 -16l2 -9', 1.8, '#3E8A3A') });
      s += g(ITEMS.katak.draw(), 'translate(36 -14) scale(.62)');
      return s;
    },
    kebun() {
      let s = shadow(84) + grassBase(84);
      s += f3(P('M-14 -6C-10 -36 -12 -62 -24 -86L-10 -88C-4 -74 0 -68 4 -66C10 -74 14 -84 18 -90L30 -86C18 -66 12 -40 16 -6Z'), [-24, -90, 54, 84], PAL.wood, { hx: 0.4, hy: 0.4 });
      s += f3(P(scallop(-2, -122, 74, 40, 13, 6, 31)), [-88, -168, 172, 92], ['#5DAE52', '#8ED07E', '#3D8A3B'], {
        k: 0.1, hx: 0.3, hy: 0.25, hs: 1.4, inner: ln('M-50 -110q8 -8 16 0M20 -134q8 -8 16 0M-14 -146q8 -8 16 0M34 -104q8 -8 16 0M-60 -136q8 -8 16 0', 2, '#3D8A3B', 0.7)
      });
      [[-48, -96], [-14, -108], [22, -92], [50, -118], [-34, -134]].forEach(([x, y]) => {
        s += ln(`M${x} ${y - 10}V${y - 5}`, 1.8, '#5A3A20') + f3(P(`M${x} ${y - 6}C${x + 7} ${y - 6} ${x + 8} ${y + 4} ${x + 3} ${y + 8}C${x} ${y + 11} ${x - 7} ${y + 8} ${x - 7} ${y + 1}C${x - 7} ${y - 4} ${x - 4} ${y - 6} ${x} ${y - 6}Z`), [x - 7, y - 6, 15, 16], ['#FFB938', '#FFDD88', '#D9821C'], { k: 0.14, sw: 2.2, inner: dot(x + 3, y - 3, 4, '#9BC745', 0.9) }) + dot(x - 3.6, y - 1, 1.2, '#fff');
      });
      s += limb('M66 -4V-34', 6.5, '#A8673A', 2.4) + limb('M66 -32L57 -54M66 -32L75 -54', 5.5, '#A8673A', 2.4) + ln('M57 -51Q66 -38 75 -51', 3.2, '#E2453C') + solid(R(62, -42, 8, 5, 2), '#7E4A27', 1.6);
      return s;
    },
    sungai() {
      let s = shadow(86);
      s += f3(P('M-90 -52Q0 -76 90 -52L90 -40H-90Z'), [-90, -70, 180, 30], PAL.grass, { hl: false, k: 0.15 });
      s += bambooLm(-54, -48);
      s += f3(P('M-92 -46Q0 -56 92 -46L90 -8Q0 2 -90 -8Z'), [-92, -56, 184, 58], ['#3FA7C4', '#7CCBE0', '#2C85A3'], { hl: false, k: 0.1, inner: ln('M-70 -20h20M30 -14h26M-30 -10h14M50 -36h18M-62 -38h16', 2.4, '#BCE7F0', 0.9) });
      let raft = '';
      for (let i = 0; i < 5; i++) { const y = -46 + i * 5.6; raft += f3(R(-50 + i * 1.5, y, 98, 7, 3.5), [-50, y, 98, 7], ['#D9C36A', '#EEDC98', '#A99236'], { hl: false, k: 0.3, sw: 2.2 }); }
      s += raft + ln('M-30 -48V-18M28 -48V-18', 2.6, '#7E4A27') + ln('M-46 -44h8M-14 -38h6M10 -32h8M36 -26h6', 1.4, '#A99236');
      s += limb('M-8 -46L18 -74', 3.2, '#A8673A', 2) + solid(P('M16 -72L30 -88L34 -84L22 -68Z'), '#C68654', 2.2);
      s += f3(P('M50 -50C64 -64 84 -60 92 -48L92 -30C80 -36 64 -38 50 -50Z'), [50, -62, 42, 32], PAL.grass, { hl: false, k: 0.14, sw: 2.6 }) + ln('M70 -52l-2 -14M76 -52l2 -16M82 -50l3 -12', 2, '#4E9E44');
      return s;
    },
    warung() {
      let s = shadow(86) + grassBase(88);
      s += f3(R(-86, -112, 102, 108, 3), [-86, -112, 102, 108], ['#D29A62', '#E6B888', '#A8703E'], { hl: false, k: 0.06, top: ln('M-60 -112V-4M-34 -112V-4M-8 -112V-4', 1.4, '#A8703E', 0.7) });
      s += solid(R(-78, -96, 86, 40, 3), '#6B4A36', 2.4);
      ['#E2453C', '#FFC83D', '#4DAA57', '#F28C28', '#2F80C9', '#F59AB0'].forEach((c, i) => { s += solid(R(-74 + i * 13.5, -96, 9, 13, 1.5), c, 1.6); });
      [0, 1, 2].forEach(i => { s += solid(R(-70 + i * 26, -76, 16, 20, 4), '#DDF3F8', 2) + R(-68 + i * 26, -68, 12, 10, 2)(fl(['#F8B26A', '#E2453C', '#FFE08A'][i])) + solid(R(-71 + i * 26, -79, 18, 4, 1.5), '#2F80C9', 1.6); });
      s += f3(R(-84, -60, 96, 9, 3), [-84, -60, 96, 9], PAL.wood, { hl: false, k: 0.25, sw: 2.6 });
      s += f3(P('M-98 -106L28 -106L16 -138L-86 -138Z'), [-98, -138, 126, 32], ['#A9BCC6', '#CFDDE4', '#7F949F'], { hl: false, k: 0.12, inner: ln('M-88 -106l4 -32M-74 -106l4 -32M-60 -106l4 -32M-46 -106l4 -32M-32 -106l4 -32M-18 -106l4 -32M-4 -106l4 -32M10 -106l4 -32', 1.4, '#7F949F') });
      s += f3(R(-72, -156, 76, 18, 4), [-72, -156, 76, 18], PAL.cream, { hl: false, k: 0.14, sw: 2.6 }) + txt(-34, -142.5, 'WARUNG', 13, '#C8643B', "'Baloo 2', system-ui, sans-serif") + ln('M-56 -138V-132M-12 -138V-132', 2.4);
      // gerobak martabak
      s += limb('M84 -50L94 -54', 3, '#7E4A27', 2) + f3(R(26, -78, 62, 40, 5), [26, -78, 62, 40], PAL.red, { k: 0.1, top: R(32, -64, 50, 14, 3)(fl('#FFF3E0')) });
      s += txt(57, -53.5, 'MARTABAK', 9.5, '#B5322B', "'Baloo 2', system-ui, sans-serif");
      s += solid(R(30, -104, 54, 26, 4), '#DFF3F8', 2.4) + f3(P('M40 -84A15 13 0 0 1 70 -84Z'), [40, -97, 30, 13], ['#E9B44C', '#F6D58A', '#B9822A'], { k: 0.15, sw: 2, hl: false, inner: ln('M46 -88h18M50 -93h10', 1.2, '#B9822A') }) + ln('M34 -100l6 6', 2, '#fff', 0.9);
      s += f3(R(26, -110, 62, 7, 3), [26, -110, 62, 7], PAL.wood, { hl: false, k: 0.25, sw: 2.4 });
      s += f3(C(42, -22, 15), [27, -37, 30, 30], PAL.wood, { hl: false, k: 0.1, top: ln('M42 -34V-10M30 -22H54M34 -30L50 -14M50 -30L34 -14', 1.6, '#7E4A27') }) + solid(C(42, -22, 3.5), '#7E4A27', 2) + limb('M80 -38V-6', 4, '#7E4A27', 2);
      return s;
    },
    rumah() {
      let s = shadow(86) + grassBase(88);
      [-60, -24, 18, 54].forEach(x => { s += f3(R(x, -58, 7, 54, 2), [x, -58, 7, 54], PAL.wood, { hl: false, k: 0.3, sw: 2.4 }); });
      s += f3(R(-66, -118, 132, 58, 2), [-66, -118, 132, 58], PAL.bamboo, { hl: false, k: 0.06, inner: texture('weave', -66, -118, 132, 58, '#6B4A20', 0.14, 8) });
      s += solid(R(-50, -104, 26, 24, 3), '#5A3E2E', 2.4) + solid(R(26, -104, 26, 24, 3), '#5A3E2E', 2.4) + solid(R(-60, -104, 9, 24, 2), '#4DAA57', 2) + solid(R(53, -104, 9, 24, 2), '#4DAA57', 2);
      s += f3(R(-13, -108, 26, 48, 3), [-13, -108, 26, 48], PAL.wood, { hl: false, k: 0.12 }) + dot(7, -84, 2, '#FFC83D');
      s += f3(R(-74, -64, 148, 9, 3), [-74, -64, 148, 9], PAL.wood, { hl: false, k: 0.25 });
      s += f3(P('M-92 -112L-8 -168L8 -168L92 -112L84 -104L-84 -104Z'), [-92, -168, 184, 64], PAL.roof, { k: 0.08, hx: 0.36, hy: 0.4, inner: ln('M-60 -112L-4 -158M-30 -112L0 -150M0 -112V-150M30 -112L4 -150M60 -112L8 -158M-74 -122H74M-52 -138H52', 1.4, '#963F22', 0.6) });
      s += solid(P('M-16 -135L16 -135L0 -148Z'), '#FFF3E0', 2) + ln('M-6 -138L6 -138', 1.4);
      s += limb('M-13 -56L-17 -4M13 -56L17 -4', 4, '#A8673A', 2) + ln('M-14 -46H14M-15 -34H15M-16 -22H16M-17 -10H17', 3.4, '#7E4A27');
      return s;
    },
    /* landmark: bibit */
    bibit() {
      // Kebun Bibit: a hoed bed with a 3 x 4 array of seedlings, bamboo fence, nursery basket and a scarecrow
      let s = shadow(86) + grassBase(88);
      // soil bed (top-down-ish trapezoid) with furrows
      const bed = P('M-78 -18L-62 -96L62 -96L78 -18Z');
      s += f3(bed, [-78, -96, 156, 78], ['#A86F42', '#C08A5A', '#86532E'], { k: 0.08, hx: 0.3, hy: 0.2, inner: ln('M-72 -44H72M-67 -70H67', 2, '#6E4224', 0.6) + ln('M-26 -96L-31 -18M26 -96L31 -18M0 -96V-18', 1.4, '#7E4E2C', 0.4) });
      // 3 rows x 4 seedlings (the array)
      [[-82, 0.78], [-58, 0.9], [-32, 1]].forEach(([y, k], ri) => {
        const hw = 48 + ri * 8;
        for (let i = 0; i < 4; i++) {
          const x = -hw + (i + 0.5) * (2 * hw / 4);
          s += E(x, y + 2, 7 * k, 3 * k)(fl('#4A2E1A'));
          s += ln(`M${n1(x)} ${n1(y)}V${n1(y - 12 * k)}`, 2.4 * k, '#3E8A3A');
          s += f3(P(leaf(x, y - 9 * k, x - 11 * k, y - 17 * k, 4.5 * k, -1)), [x - 12 * k, y - 22 * k, 13 * k, 14 * k], PAL.leaf, { hl: false, k: 0.1, sw: 1.8 });
          s += f3(P(leaf(x, y - 11 * k, x + 11 * k, y - 21 * k, 4.5 * k, 1)), [x, y - 26 * k, 13 * k, 16 * k], PAL.leaf, { hl: false, k: 0.1, sw: 1.8 });
        }
      });
      // bamboo fence along the back
      for (let i = 0; i < 7; i++) { const x = -66 + i * 22; s += f3(R(x - 3, -122, 6, 30, 3), [x - 3, -122, 6, 30], PAL.bamboo, { hl: false, k: 0.25, sw: 2 }); }
      s += f3(R(-70, -114, 140, 6, 3), [-70, -114, 140, 6], PAL.bamboo, { hl: false, k: 0.25, sw: 2 });
      // scarecrow with caping
      s += limb('M64 -96V-150', 4, '#A8673A', 2) + limb('M48 -136H80', 3.5, '#A8673A', 2);
      s += f3(R(56, -140, 16, 20, 4), [56, -140, 16, 20], PAL.red, { k: 0.12, sw: 2.2, hl: false });
      s += solid(C(64, -150, 7), '#F3DDA6', 2.2) + f3(P('M48 -153L64 -166L80 -153Q64 -149 48 -153Z'), [48, -166, 32, 17], ['#E8C987', '#F5E2B5', '#C49E5A'], { k: 0.12, sw: 2.2, hl: false });
      // nursery basket with seedlings in front
      s += f3(P('M-92 -36Q-70 -30 -48 -36L-52 -6Q-70 -2 -88 -6Z'), [-92, -36, 44, 34], PAL.rattan, { k: 0.12, sw: 2.4, hl: false, inner: ln('M-90 -24Q-70 -19 -50 -24M-89 -14Q-70 -9 -51 -14', 1.4, '#9A6E36', 0.7) });
      [-82, -70, -58].forEach((x, i) => { s += f3(P(leaf(x, -36, x + (i - 1) * 6, -54, 4, 0)), [x - 6, -56, 12, 22], PAL.leaf, { hl: false, k: 0.1, sw: 1.8 }); });
      s += E(-70, -36, 22, 5)(stk(2.4)) ;
      return s;
    },
    /* landmark: kelontong */
    kelontong() {
      // Warung Kembalian: a little shop window with a cash tray on the counter and a coin sign.
      let s = shadow(86) + grassBase(88);
      // posts
      s += f3(R(-82, -120, 8, 116, 2), [-82, -120, 8, 116], PAL.wood, { hl: false, k: 0.3 }) + f3(R(74, -120, 8, 116, 2), [74, -120, 8, 116], PAL.wood, { hl: false, k: 0.3 });
      // dark shop interior with a shelf of jars and hanging sachets (renceng)
      s += f3(R(-74, -114, 148, 62, 3), [-74, -114, 148, 62], ['#6B4A36', '#8A6450', '#4E3426'], { hl: false, k: 0.06 });
      s += ln('M-74 -84H8', 2.6, '#A8673A');
      [[-58, '#E2453C'], [-38, '#FFC83D'], [-18, '#4DAA57']].forEach(([x, c]) => {
        s += solid(R(x - 8, -104, 16, 19, 4), '#DDF3F8', 2) + dot(x - 3, -92, 3.4, c) + dot(x + 3, -96, 3.4, c) + solid(R(x - 9, -107, 18, 5, 2), '#2F80C9', 1.6);
      });
      [[-56, '#F28C28'], [-36, '#F59AB0'], [-16, '#86CC8C']].forEach(([x, c]) => { s += solid(R(x - 7, -78, 14, 20, 3), c, 1.8) + ln(`M${x - 4} -71h8`, 1.2, '#FFF8EC'); });
      [[22, '#2F80C9', '#FFC83D'], [38, '#E2453C', '#4DAA57'], [54, '#F28C28', '#2F80C9']].forEach(([x, c1, c2]) => {
        s += ln(`M${x} -114V-108`, 1.6);
        for (let i = 0; i < 3; i++) s += solid(R(x - 6, -108 + i * 15, 12, 13, 2), i % 2 ? c2 : c1, 1.6) + R(x - 3, -105 + i * 15, 6, 4, 1)(fl('#FFF8EC', 0.8));
      });
      // counter with a rattan cash tray: a note and coins
      s += f3(R(-88, -50, 176, 46, 5), [-88, -50, 176, 46], ['#C98B55', '#DDA774', '#A8673A'], { hl: false, k: 0.08, top: ln('M-88 -30H88M-30 -50V-4M34 -50V-4', 1.6, '#A8673A') });
      s += f3(R(-92, -57, 184, 10, 3), [-92, -57, 184, 10], PAL.wood, { hl: false, k: 0.25, sw: 2.6 });
      s += f3(E(-28, -60, 30, 7.5), [-58, -67.5, 60, 15], PAL.rattan, { hl: false, k: 0.18, sw: 2.2 });
      s += g(solid(R(-16, -9, 32, 15, 2.5), '#86C490', 1.8) + ln('M-11 -2h22', 1.4, '#143B1F', 0.5) + dot(-9, -2, 2.6, '#B8E2BD'), 'translate(-38 -64) rotate(-8)');
      s += f3(C(-18, -65, 6.5), [-24.5, -71.5, 13, 13], PAL.brass, { hl: false, k: 0.15, sw: 1.8 }) + f3(C(-8, -63, 6), [-14, -69, 12, 12], PAL.steel, { hl: false, k: 0.15, sw: 1.8 });
      // goods on the counter: a candy jar and a bunch of bananas
      s += solid(P('M30 -84Q26 -60 34 -58H58Q66 -60 62 -84Z'), '#DFF3F8', 2.2) + solid(R(28, -90, 36, 7, 3), '#E2453C', 1.8);
      [[38, -66, '#E2453C'], [48, -64, '#FFC83D'], [56, -68, '#4DAA57'], [43, -74, '#F59AB0'], [53, -76, '#F28C28']].forEach(([x, y, c]) => { s += solid(C(x, y, 4.5), c, 1.4); });
      s += g(f3(P(BAN), [-31, -24, 63, 24], PAL.yellow, { k: 0.14, sw: 2.4 }), 'translate(74 -56) scale(.42)');
      // green striped awning with scallops (the market stall uses red)
      const aw = P('M-98 -118L98 -118L86 -148L-86 -148Z');
      let stripes = '';
      for (let i = 0; i < 9; i += 2) stripes += P(`M${-98 + i * 21.8} -118L${-86 + i * 19.1} -148L${-86 + (i + 1) * 19.1} -148L${-98 + (i + 1) * 21.8} -118Z`)(fl('#4DAA57'));
      s += f3(aw, [-98, -148, 196, 30], ['#FFF3E0', '#FFFFFF', '#E6D3B8'], { hl: false, k: 0.12, inner: stripes });
      for (let i = 0; i < 9; i++) s += solid(P(`M${n1(-98 + i * 21.8)} -118a10.9 9 0 0 0 21.8 0Z`), i % 2 ? '#FFF3E0' : '#4DAA57', 2.4);
      // the sign: a big gold coin marked Rp
      s += ln('M0 -148V-154', 3);
      s += f3(C(0, -166, 15), [-15, -181, 30, 30], PAL.brass, { k: 0.12, sw: 2.6 }) + C(0, -166, 10.5)(stk(1.4, '#A8771F')) + txt(0, -161.5, 'Rp', 12, '#7A5518', "'Baloo 2', system-ui, sans-serif") + spec(-7, -173, 1.6);
      return s;
    },
/* landmark: panggung (game wayang) */
    // Panggung wayang: a kelir (white screen) in a wooden frame with a red-black plangitan,
    // a gunungan shadow on it, the brass blencong hanging at the left, banana trunks at the base.
    // Suggested hub icon: GS.art.item('kucing') (a wayang kucing is the first puppet in TK level 1).
    panggung() {
      let s = shadow(86) + grassBase(88);
      // frame posts and the screen
      s += f3(R(-58, -150, 8, 140, 2), [-58, -150, 8, 140], PAL.wood, { hl: false, k: 0.3 }) + f3(R(74, -150, 8, 140, 2), [74, -150, 8, 140], PAL.wood, { hl: false, k: 0.3 });
      s += solid(R(-50, -142, 124, 118, 2), '#FFEFC4', 2.6) + R(-50, -142, 124, 118)(`fill="none" stroke="#B5322B" stroke-width="2.4"`);
      // gunungan shadow on the kelir, with carved light dots
      s += P('M12 -132C24 -116 40 -96 44 -70C46 -58 40 -50 34 -48L22 -48L22 -34L2 -34L2 -48L-10 -48C-16 -50 -22 -58 -20 -70C-16 -96 0 -116 12 -132Z')(fl('#2B1D14', 0.88));
      [[12, -104], [12, -88], [12, -72], [2, -94], [22, -94], [-2, -76], [26, -76], [12, -40]].forEach(([x, y]) => { s += dot(x, y, 2.4, '#FFEFC4'); });
      // plangitan (top band) with gold triangles
      s += solid(R(-64, -162, 152, 16, 3), '#241A1C', 2.4);
      for (let x = -58; x < 82; x += 12) s += P(`M${x} -148L${x + 6} -158L${x + 12} -148Z`)(fl('#D9A441'));
      // banana trunks (gedebog) holding the screen
      s += f3(R(-70, -30, 164, 14, 7), [-70, -30, 164, 14], ['#D8D2A0', '#ECE7C2', '#B3AC74'], { hl: false, k: 0.2, sw: 2.4 }) + f3(R(-64, -18, 152, 13, 6.5), [-64, -18, 152, 13], ['#D8D2A0', '#ECE7C2', '#B3AC74'], { hl: false, k: 0.2, sw: 2.4 });
      // blencong lamp hanging at the left, with its flame and warm glow
      s += ln('M-78 -168V-118', 1.8, '#9C8A66') + dot(-72, -104, 16, '#FFD98A', 0.25);
      s += f3(P('M-94 -108C-94 -98 -86 -94 -78 -95C-71 -96 -68 -100 -67 -106Z'), [-94, -108, 27, 14], PAL.brass, { hl: false, k: 0.15, sw: 2 });
      s += solid(P('M-90 -110C-92 -120 -86 -126 -80 -124C-76 -123 -75 -119 -76 -116L-71 -114L-76 -111Z'), '#D9A441', 1.8);
      s += solid(P('M-66 -118C-62 -113 -61 -108 -66 -104C-71 -108 -70 -113 -66 -118Z'), '#F28C28', 1.6) + P('M-66 -114C-64 -111 -64 -109 -66 -107C-68 -109 -68 -111 -66 -114Z')(fl('#FFE08A'));
      return s;
    },
    /* landmark: posronda (game jam) */
    posronda() {
      // pos ronda tower with a big wall clock, kentongan hanging below
      let s = shadow(78) + grassBase(80);
      s += f3(R(-50, -70, 10, 66, 2), [-50, -70, 10, 66], PAL.wood, { hl: false, k: 0.3 }) + f3(R(40, -70, 10, 66, 2), [40, -70, 10, 66], PAL.wood, { hl: false, k: 0.3 });
      s += ln('M-45 -60L45 -10M-45 -10L45 -60', 3.4, '#7E4A27');
      s += f3(R(-60, -74, 120, 10, 3), [-60, -74, 120, 10], PAL.wood, { hl: false, k: 0.25 });
      s += f3(R(-46, -150, 92, 78, 6), [-46, -150, 92, 78], ['#C68654', '#DDA472', '#9A5A2E'], { hl: false, k: 0.06 });
      s += f3(P('M-70 -144L-36 -170L36 -170L70 -144Z'), [-70, -170, 140, 26], PAL.roof, { k: 0.1 });
      s += f3(C(0, -112, 40), [-40, -152, 80, 80], PAL.wood, { hl: false, k: 0.05 }) + solid(C(0, -112, 33), '#FFF8EC', 2.6);
      [0, 3, 6, 9].forEach(k => { const a = k * Math.PI / 6; s += ln(`M${n1(Math.sin(a) * 25)} ${n1(-112 - Math.cos(a) * 25)}L${n1(Math.sin(a) * 31)} ${n1(-112 - Math.cos(a) * 31)}`, 3, OL); });
      s += limb('M0 -112L0 -136', 3.2, '#2F80C9', 1.6) + limb('M0 -112L14 -104', 4.2, '#F28C28', 1.6) + solid(C(0, -112, 4), '#D9A441', 1.6);
      s += ln('M-20 -64V-56', 2) + f3(R(-26, -56, 12, 34, 5), [-26, -56, 12, 34], PAL.bamboo, { hl: false, k: 0.2 }) + R(-22, -50, 4, 20, 2)(fl('#6B4A20'));
      return s;
    },
    /* landmark: bengkel (game Bengkel Kayu) */
    bengkel() {
      // open woodworking shed: plank wall with a ruler and a carpenter's square, a workbench with a plank and a saw, planks stacked outside
      let s = shadow(88) + grassBase(90);
      s += f3(R(-86, -128, 8, 124, 2), [-86, -128, 8, 124], PAL.wood, { hl: false, k: 0.3 }) + f3(R(38, -128, 8, 124, 2), [38, -128, 8, 124], PAL.wood, { hl: false, k: 0.3 });
      s += f3(R(-78, -124, 116, 64, 2), [-78, -124, 116, 64], ['#D29A62', '#E6B888', '#A8703E'], { hl: false, k: 0.06, top: ln('M-52 -124V-60M-26 -124V-60M0 -124V-60M26 -124V-60', 1.4, '#A8703E', 0.7) });
      // ruler with ticks and a carpenter's square hanging on the wall
      let ticks = '';
      for (let i = 0; i <= 10; i++) ticks += `M${-66 + i * 4.6} -116v${i % 5 ? 3 : 5.5}`;
      s += solid(R(-68, -118, 50, 10, 2), '#FFC83D', 2.2) + ln(ticks, 1.2, '#7A5518');
      s += f3(P('M2 -120H10V-100H34V-92H2Z'), [2, -120, 32, 28], PAL.steel, { hl: false, k: 0.2, sw: 2.2 }) + ln('M6 -115h2M6 -110h2M6 -105h2M17 -96v-2M23 -96v-2M29 -96v-2', 1, '#3B2A20', 0.8);
      // roof
      s += f3(P('M-100 -122L58 -122L46 -156L-90 -156Z'), [-100, -156, 158, 34], PAL.roof, { k: 0.1, hx: 0.3, hy: 0.4, inner: ln('M-80 -122l4 -34M-58 -122l4 -34M-36 -122l4 -34M-14 -122l4 -34M8 -122l4 -34M30 -122l4 -34', 1.4, '#963F22', 0.6) });
      // workbench
      s += f3(R(-68, -54, 7, 50, 2), [-68, -54, 7, 50], PAL.wood, { hl: false, k: 0.3, sw: 2.4 }) + f3(R(19, -54, 7, 50, 2), [19, -54, 7, 50], PAL.wood, { hl: false, k: 0.3, sw: 2.4 });
      s += ln('M-61 -24H19', 3.4, '#7E4A27');
      s += E(-22, -6, 18, 4)(fl('#F2DCAA'));
      s += f3(R(-76, -62, 110, 10, 3), [-76, -62, 110, 10], PAL.wood, { hl: false, k: 0.25, sw: 2.6 });
      s += f3(R(-66, -73, 78, 11, 2), [-66, -73, 78, 11], ['#E8C08A', '#F5DAB0', '#C49A62'], { hl: false, k: 0.2, sw: 2.4 }) + ln('M-30 -73V-62', 1.6, '#3B2A20', 0.6);
      // saw resting on the plank
      let teeth = 'M-40 -76';
      for (let x = -37; x <= 2; x += 3) teeth += `L${x} ${x % 2 ? -73.5 : -76}`;
      s += solid(P('M-42 -76L4 -76L4 -90L-40 -82Z'), '#D6DCE2', 2.2) + ln(teeth, 1.2, '#626A74') + ln('M-34 -80L-4 -86', 1.6, '#fff', 0.8);
      s += f3(P('M2 -92H18Q22 -92 22 -88V-78Q22 -74 18 -74H2Z'), [2, -92, 20, 18], PAL.red, { hl: false, k: 0.15, sw: 2.2 }) + solid(R(8, -88, 8, 9, 3), '#6B4A36', 1.6);
      // stacked planks outside, one leaning
      s += f3(P('M50 -40L60 -42L54 -108L46 -106Z'), [46, -108, 14, 68], ['#E8C08A', '#F5DAB0', '#C49A62'], { hl: false, k: 0.25, sw: 2.2 });
      [['#C98B55', 0], ['#E8C08A', 4], ['#D7A46E', -2], ['#E8C08A', 3]].forEach(([c, dx], i) => {
        const y = -12 - i * 9;
        s += f3(R(48 + dx, y, 46, 9, 2), [48 + dx, y, 46, 9], [c, null, null], { hl: false, k: 0.25, sw: 2.2 }) + solid(E(48 + dx + 46, y + 4.5, 2.6, 4.5), '#F5DAB0', 1.4);
      });
      return s;
    },
    /* landmark: denah (game Chuppy Jalan-jalan) */
    denah() {
      // a 3 x 3 tiled plaza seen slightly from above: arrow tiles lead from the start to the flag; a signpost with arrows
      let s = shadow(92) + f3(E(0, -50, 100, 50), [-100, -100, 200, 100], PAL.grass, { hl: false, k: 0.08, sw: 2.6 });
      const pt = (u, v) => { const y = -116 + 92 * (0.82 * v + 0.18 * v * v), hw = 58 + 28 * v; return [n1((u * 2 - 1) * hw), n1(y)]; };
      const poly = list => 'M' + list.map(p => p.join(' ')).join('L') + 'Z';
      const tileP = (c, r, a0, b0, a1, b1) => poly([pt((c + a0) / 3, (r + b0) / 3), pt((c + a1) / 3, (r + b0) / 3), pt((c + a1) / 3, (r + b1) / 3), pt((c + a0) / 3, (r + b1) / 3)]);
      // front face of the slab
      const fl0 = pt(0, 1), fr0 = pt(1, 1);
      s += f3(P(`M${fl0[0]} ${fl0[1]}L${fr0[0]} ${fr0[1]}L${fr0[0] - 2} ${fr0[1] + 10}L${fl0[0] + 2} ${fl0[1] + 10}Z`), [fl0[0], fl0[1], fr0[0] - fl0[0], 10], PAL.stone, { hl: false, k: 0.2, sw: 2.6 });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const goal = c === 2 && r === 0, col = goal ? '#BFE6B0' : (r + c) % 2 ? '#E6CF9C' : '#F6E6C2';
        s += P(tileP(c, r, 0.05, 0.07, 0.95, 0.93))(`fill="${col}" stroke="#B89868" stroke-width="1.6" stroke-linejoin="round"`);
      }
      s += P(poly([pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)]))(stk(2.8));
      // arrows: start (0,2) up, (0,1) right, (1,1) right, (2,1) up
      const up = [[0.5, 0.16], [0.84, 0.5], [0.63, 0.5], [0.63, 0.84], [0.37, 0.84], [0.37, 0.5], [0.16, 0.5]];
      [[0, 2, 0, '#F28C28'], [0, 1, 1, '#2F80C9'], [1, 1, 1, '#2F80C9'], [2, 1, 0, '#F28C28']].forEach(([c, r, rot, colr]) => {
        const p = up.map(([a, b]) => rot ? [1 - b, a] : [a, b]).map(([a, b]) => pt((c + a) / 3, (r + b) / 3));
        s += solid(P(poly(p)), colr, 2);
      });
      // start ring on the first tile
      const st = pt(0.5 / 3, 2.85 / 3);
      s += E(st[0], st[1] - 2, 6, 2.6)(fl('#3B2A20', 0.25));
      // goal flag
      const gp = pt(2.5 / 3, 0.55 / 3);
      s += E(gp[0], gp[1], 10, 3.5)(fl('#3B2A20', 0.2)) + limb(`M${gp[0]} ${gp[1]}V${gp[1] - 54}`, 3, '#8C8F94', 1.6) + dot(gp[0], gp[1] - 56, 3.2, '#FFC83D') + `<circle cx="${gp[0]}" cy="${gp[1] - 56}" r="3.2" ${stk(1.6)}/>`;
      s += f3(P(`M${gp[0] + 1.5} ${gp[1] - 52}L${gp[0] + 30} ${gp[1] - 44}L${gp[0] + 1.5} ${gp[1] - 34}Z`), [gp[0], gp[1] - 52, 29, 18], PAL.red, { hl: false, k: 0.15, sw: 2.2 });
      // signpost at the left
      s += f3(R(-96, -150, 7, 92, 2), [-96, -150, 7, 92], PAL.wood, { hl: false, k: 0.3, sw: 2.4 }) + E(-92.5, -58, 9, 3)(fl('#3B2A20', 0.18));
      s += f3(P('M-82 -146H-58L-46 -138L-58 -130H-82Z'), [-82, -146, 36, 16], PAL.yellow, { hl: false, k: 0.18, sw: 2.2 }) + ln('M-78 -138H-62M-66 -142L-62 -138L-66 -134', 1.8, '#7A5518');
      s += f3(P('M-90 -124H-70V-108H-90L-104 -116Z'), [-104, -124, 34, 16], PAL.green, { hl: false, k: 0.18, sw: 2.2 }) + ln('M-80 -116H-96M-92 -120L-96 -116L-92 -112', 1.8, '#FFF8EC');
      s += solid(C(-92.5, -152, 4), '#C68654', 2);
      // a small bush at the back right
      s += f3(P(scallop(84, -84, 16, 11, 7, 3, 9)), [66, -97, 36, 26], PAL.leaf, { hl: false, k: 0.14, sw: 2.2 });
      return s;
    },
    /* landmark: dapur (game Dapur Bu Sari) */
    dapur() {
      // open kampung kitchen: clay tungku with a flame and a steaming pot, a shelf with a teapot, a table with a measuring jug and cups
      let s = shadow(88) + grassBase(90);
      s += f3(R(-84, -132, 8, 128, 2), [-84, -132, 8, 128], PAL.bamboo, { hl: false, k: 0.3 }) + f3(R(76, -132, 8, 128, 2), [76, -132, 8, 128], PAL.bamboo, { hl: false, k: 0.3 });
      s += f3(R(-76, -128, 152, 74, 2), [-76, -128, 152, 74], PAL.bamboo, { hl: false, k: 0.05, inner: texture('weave', -76, -128, 152, 74, '#6B4A20', 0.14, 8) });
      // shelf with jars and the teapot
      s += f3(R(-8, -98, 80, 7, 2), [-8, -98, 80, 7], PAL.wood, { hl: false, k: 0.25, sw: 2.4 }) + ln('M0 -91l6 8M64 -91l-6 8', 2.6, '#7E4A27');
      s += solid(R(-2, -116, 13, 18, 3), '#DDF3F8', 2) + R(0, -108, 9, 8, 1.5)(fl('#E2453C')) + solid(R(-3, -119, 15, 4, 1.5), '#A8673A', 1.6);
      s += solid(R(14, -112, 11, 14, 3), '#DDF3F8', 2) + R(16, -105, 7, 5, 1.5)(fl('#FFC83D')) + solid(R(13, -115, 13, 4, 1.5), '#A8673A', 1.6);
      s += limb('M58 -110Q70 -110 68 -100', 2.4, '#C68654', 1.6) + limb('M38 -106L28 -116', 3, '#2F80C9', 1.6);
      s += f3(P('M36 -98C32 -106 36 -116 48 -116C60 -116 64 -106 60 -98Z'), [32, -116, 32, 18], PAL.blue, { k: 0.15, sw: 2.2 }) + solid(R(42, -121, 12, 5, 2), '#215F98', 1.6) + dot(48, -123, 2.2, '#FFC83D');
      // thatch roof
      s += f3(P('M-100 -124L100 -124L80 -164L-80 -164Z'), [-100, -164, 200, 40], PAL.rattan, { k: 0.1, hx: 0.3, hy: 0.4, inner: ln('M-90 -134H90M-84 -146H84M-80 -156H80', 1.6, '#9A6E36', 0.6) });
      for (let x = -96; x < 100; x += 12) s += ln(`M${x} -124l2 6`, 2, '#9A6E36');
      // tungku: clay stove with a fire mouth, burning sticks
      s += f3(P('M-76 -6L-70 -48Q-46 -54 -16 -48L-10 -6Z'), [-76, -54, 66, 48], ['#C8643B', '#E08A62', '#963F22'], { k: 0.12, hx: 0.25, hy: 0.3 });
      s += solid(P('M-56 -6V-20Q-56 -32 -43 -32Q-30 -32 -30 -20V-6Z'), '#3A2420', 2.2);
      s += solid(P('M-43 -30C-36 -22 -35 -16 -38 -10C-40 -7 -46 -7 -48 -10C-51 -16 -50 -22 -43 -30Z'), '#F28C28', 1.6) + P('M-43 -22C-40 -18 -40 -14 -42 -12C-43 -11 -45 -11 -46 -12C-47 -15 -46 -18 -43 -22Z')(fl('#FFE08A'));
      s += limb('M-60 -8L-36 -14M-26 -8L-48 -14', 3.2, '#A8673A', 1.6);
      // pot on the stove with steam
      s += f3(P('M-68 -48Q-70 -66 -60 -72H-26Q-16 -66 -18 -48Z'), [-70, -72, 54, 24], ['#4A4448', '#6E676B', '#2E2A2C'], { k: 0.12, hx: 0.25, hy: 0.3 }) + solid(R(-66, -76, 46, 6, 3), '#5A5356', 2.2) + spec(-58, -66, 1.4);
      s += ln('M-72 -64h4M-18 -64h4', 3.2);
      s += ln('M-52 -82Q-58 -90 -52 -98Q-46 -106 -52 -114M-34 -82Q-40 -92 -34 -100Q-28 -108 -34 -116', 3.4, '#FFFFFF', 0.85);
      // table with a measuring jug (water at a level line) and three cups of different sizes
      s += f3(R(6, -52, 76, 8, 3), [6, -52, 76, 8], PAL.wood, { hl: false, k: 0.25, sw: 2.4 }) + f3(R(12, -44, 6, 40, 2), [12, -44, 6, 40], PAL.wood, { hl: false, k: 0.3, sw: 2.2 }) + f3(R(70, -44, 6, 40, 2), [70, -44, 6, 40], PAL.wood, { hl: false, k: 0.3, sw: 2.2 });
      s += P('M16 -66L18 -52H40L42 -66Z')(fl('#5FB6D6', 0.85));
      s += P('M14 -86L18 -52H40L44 -86L48 -90H14Z')(`fill="#DDF3F8" fill-opacity=".5" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"`) + ln('M16 -66h8M15 -76h8M17 -58h6', 1.4) + ln('M44 -82Q54 -80 52 -68Q50 -60 42 -60', 2.6) + ln('M20 -82l2 18', 2, '#fff', 0.8);
      s += f3(P('M52 -68L54 -52H66L68 -68Z'), [52, -68, 16, 16], PAL.red, { hl: false, k: 0.15, sw: 2 }) + f3(P('M70 -62L71.5 -52H79L80 -62Z'), [70, -62, 10, 10], PAL.yellow, { hl: false, k: 0.15, sw: 1.8 });
      return s;
    },
    /* landmark: sanggar (game Angklung Ajaib) */
    sanggar() {
      // bamboo music hut (pendopo) with four angklung on a rack: the longer the tube, the taller the angklung
      let s = shadow(88) + grassBase(90);
      s += f3(R(-88, -146, 8, 142, 2), [-88, -146, 8, 142], PAL.bamboo, { hl: false, k: 0.3 }) + f3(R(80, -146, 8, 142, 2), [80, -146, 8, 142], PAL.bamboo, { hl: false, k: 0.3 });
      s += ln('M-84 -112v-1M-84 -78v-1M-84 -44v-1M84 -112v-1M84 -78v-1M84 -44v-1', 5, '#B8924F');
      s += f3(R(-80, -136, 160, 56, 2), [-80, -136, 160, 56], ['#E9D3A4', '#F5E6C4', '#C9AE78'], { hl: false, k: 0.04, inner: texture('weave', -80, -136, 160, 56, '#6B4A20', 0.07, 8) });
      s += f3(P('M-100 -138L-42 -170L42 -170L100 -138Z'), [-100, -170, 200, 32], PAL.rattan, { k: 0.1, hx: 0.3, hy: 0.4, inner: ln('M-78 -150H78M-60 -160H60', 1.6, '#9A6E36', 0.6) });
      for (let x = -96; x <= 96; x += 12) s += ln(`M${x} -138l1 6`, 2, '#9A6E36');
      s += f3(R(-48, -178, 96, 11, 5), [-48, -178, 96, 11], ['#B9794A', '#D49A68', '#8A5530'], { hl: false, k: 0.2, sw: 2.4 });
      // rack
      s += f3(R(-84, -20, 168, 10, 4), [-84, -20, 168, 10], PAL.bamboo, { hl: false, k: 0.25, sw: 2.4 }) + ln('M-76 -10V-4M76 -10V-4', 4, '#B8924F');
      // four angklung, tallest at the left
      [[-56, 112, '#E3C27F'], [-18, 94, '#E3C27F'], [20, 78, '#E3C27F'], [56, 62, '#E3C27F']].forEach(([x, H]) => {
        const by = -22, top = by - H, w = 15;
        // frame
        s += limb(`M${x - w} ${by}V${top}M${x + w} ${by}V${top}`, 3.4, '#7FB548', 1.6);
        s += limb(`M${x - w - 3} ${top + 2}H${x + w + 3}M${x - w} ${n1(by - H * 0.55)}H${x + w}`, 3.4, '#7FB548', 1.6);
        // two tubes: long one and its octave (half as long)
        const tube = (tx, th, tw) => f3(R(tx - tw, by - th, 2 * tw, th - 6, tw), [tx - tw, by - th, 2 * tw, th - 6], PAL.bamboo, { hl: false, k: 0.2, sw: 2 }) + R(tx - tw * 0.45, by - th * 0.92, tw * 0.9, th * 0.32, tw * 0.45)(fl('#9A6E36')) + ln(`M${tx - tw} ${n1(by - th * 0.5)}h${2 * tw}`, 1.4, '#B8924F');
        s += tube(x - 6, H * 0.86, 5) + tube(x + 6, H * 0.5, 5);
        // base tube
        s += f3(R(x - w - 4, by - 8, 2 * w + 8, 9, 4), [x - w - 4, by - 8, 2 * w + 8, 9], PAL.bamboo, { hl: false, k: 0.25, sw: 2.2 });
      });
      return s;
    },
    /* landmark: layangan (game Layangan Pantai) */
    layangan() {
      // a sandy beach with a palm, waves at the right and a symmetric diamond kite on a string from a stake
      let s = shadow(90);
      s += f3(P('M-96 -8Q-100 -40 -60 -48Q0 -58 40 -46L96 -40L96 -6Q0 4 -96 -8Z'), [-100, -58, 196, 62], ['#F2D48F', '#F8E6B8', '#D6B36A'], { hl: false, k: 0.12, sw: 2.6 });
      // sea at the right with foam lines
      s += f3(P('M36 -46Q60 -54 96 -52L98 -6Q74 -4 58 -10Q72 -18 56 -24Q70 -30 50 -36Q62 -42 36 -46Z'), [36, -54, 62, 50], ['#3FA7C4', '#7CCBE0', '#2C85A3'], { hl: false, k: 0.1, sw: 2.6, inner: ln('M68 -44h14M74 -30h16M70 -16h18', 2.4, '#BCE7F0', 0.9) });
      s += ln('M58 -10Q72 -18 56 -24Q70 -30 50 -36Q62 -42 36 -46', 3, '#FFFFFF', 0.9);
      // palm
      s += palmLm(-66, -26, 90);
      // shells / starfish
      s += star4(-26, -18, 6, '#F28C28') + solid(P('M-4 -30Q2 -38 8 -30Z'), '#F59AB0', 1.6);
      // stake and string
      s += E(14, -14, 8, 2.6)(fl('#3B2A20', 0.2)) + f3(R(11, -32, 6, 20, 2), [11, -32, 6, 20], PAL.wood, { hl: false, k: 0.3, sw: 2.2 });
      s += ln('M14 -30Q2 -90 30 -142', 1.4, '#3B2A20', 0.9);
      // kite: four mirrored panels, cross sticks, tail with bows
      const K = [30, -184], Rg = [56, -146], B = [30, -104], Lf = [4, -146], M = [30, -146];
      const tri = (a, b, c) => `M${a.join(' ')}L${b.join(' ')}L${c.join(' ')}Z`;
      s += ln('M30 -104Q40 -92 32 -80Q24 -68 36 -56', 1.6, '#3B2A20');
      [[34, -92], [30, -76], [34, -62]].forEach(([x, y], i) => { s += solid(P(`M${x} ${y}L${x - 6} ${y - 4}L${x - 6} ${y + 4}ZM${x} ${y}L${x + 6} ${y - 4}L${x + 6} ${y + 4}Z`), i % 2 ? '#FFC83D' : '#E2453C', 1.4); });
      s += P(tri(K, M, Lf))(fl('#E2453C')) + P(tri(K, Rg, M))(fl('#E2453C')) + P(tri(Lf, M, B))(fl('#FFC83D')) + P(tri(M, Rg, B))(fl('#FFC83D'));
      s += P('M30 -184L17 -165L30 -160L43 -165Z')(fl('#F27A6E')) + P('M30 -146L17 -125L30 -118L43 -125Z')(fl('#E09A00', 0.5));
      s += ln(`M${K.join(' ')}L${B.join(' ')}M${Lf.join(' ')}L${Rg.join(' ')}`, 2, '#7E4A27');
      s += P(`M${K.join(' ')}L${Rg.join(' ')}L${B.join(' ')}L${Lf.join(' ')}Z`)(stk(2.6));
      return s;
    },
    /* landmark: gardu (game Lampu Hias) */
    gardu() {
      // festival gate: two bamboo poles, red-white pennants, a string of coloured bulbs, a battery box with a switch on the left pole
      let s = shadow(88) + grassBase(90);
      const pole = x => f3(R(x - 5, -168, 10, 164, 4), [x - 5, -168, 10, 164], PAL.bamboo, { hl: false, k: 0.3 }) + ln(`M${x - 5} -136h10M${x - 5} -100h10M${x - 5} -64h10M${x - 5} -30h10`, 1.8, '#B8924F');
      s += pole(-72) + pole(72);
      // pole tips (janur-like curls) and the top bar with pennants
      s += f3(R(-86, -158, 172, 8, 4), [-86, -158, 172, 8], PAL.bamboo, { hl: false, k: 0.25, sw: 2.4 });
      for (let i = 0; i < 10; i++) { const x = -66 + i * 14.6; s += solid(P(`M${n1(x - 6)} -150H${n1(x + 6)}L${n1(x)} -138Z`), i % 2 ? '#FBF6EC' : '#E2453C', 1.8); }
      s += solid(P('M-72 -168Q-80 -182 -66 -186Q-72 -178 -68 -170Z'), '#5BAE4E', 1.8) + solid(P('M72 -168Q80 -182 66 -186Q72 -178 68 -170Z'), '#5BAE4E', 1.8);
      // wire: a sagging string between the poles, then down the left pole to the battery box
      const sag = x => -126 + 34 * (1 - (x / 68) ** 2);
      let wd = 'M-68 -126';
      for (let x = -60; x <= 68; x += 8) wd += `L${x} ${n1(sag(x))}`;
      s += ln(wd, 2, '#3B2A20') + ln('M-68 -126Q-80 -110 -78 -70', 2, '#3B2A20');
      const cols = [['#E2453C', '#F27A6E'], ['#FFC83D', '#FFE08A'], ['#4DAA57', '#86CC8C'], ['#2F80C9', '#6FAEE3'], ['#F28C28', '#F8B26A'], ['#F59AB0', '#FBC6D3']];
      [-52, -34, -17, 0, 17, 34, 52].forEach((x, i) => {
        const y = n1(sag(x)), c = cols[i % cols.length];
        s += dot(x, y + 13, 11, c[1], 0.35);
        s += solid(R(x - 3.5, y - 1, 7, 6, 1.5), '#959EA8', 1.6);
        s += f3(P(`M${x} ${y + 5}C${x + 7} ${y + 5} ${x + 8} ${y + 16} ${x + 4} ${y + 20}C${x + 2} ${y + 23} ${x - 2} ${y + 23} ${x - 4} ${y + 20}C${x - 8} ${y + 16} ${x - 7} ${y + 5} ${x} ${y + 5}Z`), [x - 8, y + 5, 16, 18], [c[0], c[1], null], { k: 0.12, sw: 2, hl: false }) + dot(x - 2.5, y + 11, 1.6, '#fff');
      });
      // battery box with a switch
      s += f3(R(-96, -72, 36, 30, 4), [-96, -72, 36, 30], ['#2E9C8A', '#62C2B2', '#1D7466'], { hl: false, k: 0.15, sw: 2.4 });
      s += solid(R(-91, -66, 18, 10, 2), '#FFC83D', 1.6) + solid(R(-73, -63, 3, 4, 1), '#FFC83D', 1.2) + ln('M-88 -61h4M-86 -63v4', 1.2) + ln('M-79 -61h4', 1.2);
      s += solid(R(-89, -52, 22, 7, 3.5), '#3A3238', 1.6) + solid(C(-73, -48.5, 4), '#E2453C', 1.6);
      // a lantern-lit kid-height post sign is skipped: grass tufts at the pole feet
      s += ln('M-82 -4l-2 -8M-78 -4l2 -9M62 -4l-2 -8M66 -4l2 -9', 1.8, '#3E8A3A');
      return s;
    }
  };
  function palmLm(x, by, H) {
    return limb(`M${x} ${by}Q${x - 6} ${by - H * 0.5} ${x + 4} ${by - H}`, 6, '#A07A52', 2.4) +
      [[-34, -8], [-20, -26], [6, -32], [28, -18], [34, 4], [-30, 10]].map(([dx, dy], i) => f3(P(leaf(x + 4, by - H, x + 4 + dx, by - H + dy + 8, 6, i % 2 ? -3 : 3)), [x + 4 + Math.min(0, dx) - 8, by - H + Math.min(0, dy) - 6, Math.abs(dx) + 16, Math.abs(dy) + 24], PAL.leaf, { hl: false, k: 0.1, sw: 2.2 })).join('') + dot(x + 1, by - H + 4, 3.6, '#7E5A2E') + dot(x + 7, by - H + 5, 3.6, '#6B4A24');
  }
  function bambooLm(x, gy) {
    let o = '';
    [[-12, 112, '#7FB548'], [0, 118, '#6EA83E'], [12, 102, '#8CC055'], [-22, 84, '#5E9A36']].forEach(([dx, H, c], j) => {
      const bx = x + dx, tx = bx + dx * 0.2, ty = gy - H;
      o += limb(`M${bx} ${gy}L${n1(tx)} ${ty}`, 5, c, 2);
      for (let y = gy - 18; y > ty + 8; y -= 18) { const t = (gy - y) / H; o += ln(`M${n1(bx + (tx - bx) * t - 3.5)} ${y}h7`, 1.8); }
      [0, 1].forEach(k => { const ly = ty + 6 + k * 18, sd = (j + k) % 2 ? 1 : -1; o += f3(P(leaf(tx, ly, tx + sd * 19, ly + 8, 4.5)), [Math.min(tx, tx + sd * 19) - 2, ly - 6, 23, 18], PAL.leaf, { hl: false, k: 0.1, sw: 1.8 }); });
    });
    return o;
  }
  art.landmarkNames = () => Object.keys(LM);
  art.landmark = function (name) {
    const fn = LM[name];
    return `<g class="gs-landmark gs-landmark-${fn ? name : 'missing'}">${fn ? fn() : placeholder(name)}</g>`;
  };

  /* ============================== CSS ============================== */
  art.css = [
    '.gs-mascot{overflow:visible}',
    // inflatable "puff": squash and stretch from the feet, slow like breathing
    '.gs-mascot .m-body{transform-box:view-box;transform-origin:100px 190px;animation:gsPuff 3.2s cubic-bezier(.37,0,.63,1) infinite}',
    '.gs-mascot .m-eyes{transform-box:view-box;transform-origin:100px 78px;animation:gsBlink 4.6s linear infinite}',
    '.gs-mascot.gs-mood-happy .m-eyes,.gs-mascot.gs-mood-cheer .m-eyes{animation:none}',
    '.gs-mascot .m-ant{transform-box:view-box;transform-origin:100px 36px;animation:gsAnt 2.8s cubic-bezier(.37,0,.63,1) infinite alternate}',
    '.gs-mascot .m-glow{animation:gsGlow 1.8s ease-in-out infinite alternate}',
    '.gs-mascot.gs-mood-happy .m-arm-r{transform-box:view-box;transform-origin:159px 120px;animation:gsWave 1.6s cubic-bezier(.37,0,.63,1) infinite alternate}',
    '.gs-mascot.gs-mood-cheer .m-body{animation:gsHop .9s cubic-bezier(.37,0,.63,1) infinite}',
    '.gs-mascot.walk{transform-origin:50% 96%;animation:gsWaddle .32s ease-in-out infinite alternate}',
    // the cat's tail sways slowly from its base
    '.gs-mascot .m-tail{transform-box:view-box;transform-origin:130px 166px;animation:gsTail 2.6s cubic-bezier(.37,0,.63,1) infinite alternate}',
    '@keyframes gsTail{from{transform:rotate(-5deg)}to{transform:rotate(7deg)}}',
    ...MCSS,
    '@keyframes gsPuff{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,.975)}}',
    '@keyframes gsHop{0%,100%{transform:translateY(0) scale(1.03,.97)}45%{transform:translateY(-9px) scale(.98,1.03)}}',
    '@keyframes gsAnt{from{transform:rotate(-7deg)}to{transform:rotate(7deg)}}',
    '@keyframes gsGlow{from{opacity:.35}to{opacity:1}}',
    '@keyframes gsWave{from{transform:rotate(8deg)}to{transform:rotate(-26deg)}}',
    '@keyframes gsWaddle{from{transform:rotate(-5deg) translateY(0)}to{transform:rotate(5deg) translateY(-3px)}}',
    '.gs-float-light{animation:gsFloat 3s cubic-bezier(.37,0,.63,1) infinite}',
    '@keyframes gsBlink{0%,93%,100%{transform:scaleY(1)}95.5%{transform:scaleY(.1)}}',
    '@keyframes gsFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',
    '@media (prefers-reduced-motion:reduce){.gs-mascot,.gs-mascot *,.gs-float-light{animation:none!important}}'
  ].join('\n');
  if (typeof document !== 'undefined' && !document.getElementById('gs-art-css')) {
    const st = document.createElement('style');
    st.id = 'gs-art-css';
    st.textContent = art.css;
    (document.head || document.documentElement).appendChild(st);
  }
})();
