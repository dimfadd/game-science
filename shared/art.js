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

  /* ======================= Si Cil the kancil ======================= */
  const MOODS = ['idle', 'happy', 'cheer', 'think', 'surprise', 'oops', 'point'];
  const FUR = PAL.fur, BAND = PAL.orange, HOOF = '#4A2F22', MSW = 4.2, MDW = 2.6;
  const ARMS = {
    down: ['M80 124Q70 138 72 151', [72, 154], 'M120 124Q130 138 128 151', [128, 154]],
    out: ['M80 124Q66 134 64 147', [63, 150], 'M120 124Q134 134 136 147', [137, 150]],
    up: ['M81 124Q60 116 52 94', [50, 89], 'M119 124Q140 116 148 94', [150, 89]],
    chin: ['M80 124Q74 146 94 150', [96, 150], 'M120 124Q146 140 116 119', [112, 116]],
    wide: ['M80 124Q62 130 57 114', [56, 109], 'M120 124Q138 130 143 114', [144, 109]],
    together: ['M80 124Q76 146 93 152', [95, 153], 'M120 124Q124 146 107 152', [105, 153]],
    point: ['M80 124Q62 134 72 149', [74, 151], 'M120 124Q150 126 170 117', [175, 115]]
  };
  const MCFG = {
    idle: { eyes: 'open', mouth: 'smile', arms: 'down', ears: [0, 0] },
    happy: { eyes: 'happy', mouth: 'grin', arms: 'out', ears: [-5, 5], blush: 0.75 },
    cheer: { eyes: 'cheer', mouth: 'open', arms: 'up', ears: [9, -9], blush: 0.75, extra: 'sparkle' },
    think: { eyes: 'open', look: [2.5, -2.5], brow: 'think', mouth: 'hmm', arms: 'chin', ears: [0, -14], extra: 'dots' },
    surprise: { eyes: 'round', mouth: 'o', arms: 'wide', ears: [16, -16], extra: 'pop' },
    oops: { eyes: 'oops', brow: 'worry', mouth: 'wobble', arms: 'together', ears: [-58, 4], extra: 'sweat' },
    point: { eyes: 'open', look: [3, 0], mouth: 'smirk', arms: 'point', ears: [0, 6] }
  };
  const HEAD = 'M100 36C126 36 144 50 148 70C153 90 151 104 138 112C126 120 74 120 62 112C49 104 47 90 52 70C56 50 74 36 100 36Z';
  const BODY = 'M100 108C115 108 123 121 126 136C131 158 127 175 100 177C73 175 69 158 74 136C77 121 85 108 100 108Z';
  function mEye(kind, x, y, side) {
    if (kind === 'happy') return ln(`M${x - 7} ${y + 3}Q${x} ${y - 8} ${x + 7} ${y + 3}`, 4.2, EYE);
    if (kind === 'cheer') return ln(`M${x - 7} ${y + 4}L${x} ${y - 4}L${x + 7} ${y + 4}`, 4.2, EYE);
    if (kind === 'squint') return ln(side < 0 ? `M${x - 6} ${y - 6}L${x + 5} ${y}L${x - 6} ${y + 6}` : `M${x + 6} ${y - 6}L${x - 5} ${y}L${x + 6} ${y + 6}`, 4.2, EYE);
    if (kind === 'round') return C(x, y, 10)(fl(EYE)) + dot(x - 3.2, y - 3.6, 3.2, '#fff') + dot(x + 3.4, y + 3.8, 1.5, '#fff');
    return E(x, y, 7, 10)(fl(EYE)) + dot(x - 2.3, y - 4, 2.7, '#fff') + dot(x + 2.5, y + 3.8, 1.3, '#fff');
  }
  const MOUTH = {
    smile: 'M100 99.5V103M91 103Q95.5 108.5 100 103Q104.5 108.5 109 103',
    grin: 'M100 99.5V103M87 101.5Q94 112 100 103Q106 112 113 101.5',
    hmm: 'M100 99.5V102.5M93 106Q97.5 103.5 101 105.5Q104.5 107.5 108 104.5',
    wobble: 'M100 99.5V102.5M90 107Q93 103.5 96 107Q99 110.5 102 107Q105 103.5 108 107',
    smirk: 'M100 99.5V103M90 103Q99 110.5 111 101'
  };
  art.mascot = function (o) {
    o = o || {};
    const mood = MOODS.indexOf(o.mood) >= 0 ? o.mood : 'idle', size = o.size || 120, M = MCFG[mood];
    const ms = (shape, box, col, opt) => f3(shape, box, col, Object.assign({ sw: MSW }, opt || {}));
    const A = ARMS[M.arms], look = M.look || [0, 0];
    let s = `<ellipse cx="100" cy="192" rx="38" ry="6" fill="${OL}" opacity=".18"/>`;
    [90, 110].forEach(x => {
      s += limb(`M${x} 164V185`, 8, FUR[2], 3.4) + P(`M${x - 6} 184h12v3.6q0 4.4 -4.4 4.4h-3.2q-4.4 0 -4.4 -4.4z`)(`fill="${HOOF}" stroke="${OL}" stroke-width="${MDW}" stroke-linejoin="round"`) + ln(`M${x} 186.5V191`, 1.3, '#7A5A48');
    });
    let b = '';
    // short tail peeking out at the back
    b += ms(P('M121 160C131 156 139 148 139 139C133 141 125 147 119 153Z'), [119, 139, 20, 21], FUR, { hl: false, sw: MDW + 0.6 }) + P('M139 139C138 145 135 149 130 153C134 148 136 144 139 139Z')(fl(CREAM));
    // body with cream belly and the three throat chevrons
    b += ms(P(BODY), [68, 108, 64, 70], FUR, {
      hx: 0.3, hy: 0.24, k: 0.09,
      inner: E(100, 157, 18, 16.5)(fl(CREAM)) + ln('M93 121L100 125L107 121M93.5 127.5L100 131.5L106.5 127.5M94 134L100 138L106 134', 3, CREAM)
    });
    // headband tails (flutter) + ears (twitch); both sit behind the head
    b += g(g(ms(P('M57 62C50 56 42 60 34 56C30 54 26 50 21 50L27 58L18 63C26 64 31 67 38 67C46 67 51 66 57 69Z'), [18, 50, 39, 19], BAND, { hl: false, k: 0.14, sw: MDW + 0.8 })), '', 'm-tail-a');
    b += g(g(ms(P('M57 68C53 74 50 80 44 84C40 87 36 89 30 93L38 94L37 102C44 97 48 92 53 86C57 81 59 77 61 73Z'), [30, 68, 31, 34], BAND, { hl: false, k: 0.14, sw: MDW + 0.8 })), '', 'm-tail-b');
    const ear = (bx, tx, rot, cls) => g(g(ms(P(leaf(bx, 52, tx, 12, 15)), [Math.min(bx, tx) - 8, 10, 46, 44], FUR, { hl: false, k: 0.08 }) +
      P(leaf(bx + (tx > bx ? 1 : -1), 48, tx + (tx > bx ? -5 : 5), 21, 6.8))(fl(PINK)), `rotate(${rot} ${bx} 52)`), '', cls);
    b += ear(76, 42, M.ears[0], 'm-ear-l') + ear(124, 158, M.ears[1], 'm-ear-r');
    // head with the ikat kepala band (clipped to the head) and cheeks
    let kaw = '';
    [0.2, 0.4, 0.6, 0.8].forEach(t => {
      const x = 46 + 108 * t, y = (1 - t) * (1 - t) * 64 + 2 * t * (1 - t) * 43 + t * t * 64;
      kaw += [45, 135, 225, 315].map(a => E(x, y - 2.3, 1.3, 2.1, `rotate(${a} ${n1(x)} ${n1(y)})`)(fl('#FFE3B3'))).join('') + dot(x, y, 0.9, '#C76A12');
    });
    const bl = M.blush || 0.5;
    b += ms(P(HEAD), [50, 36, 100, 84], FUR, {
      k: 0.07, hx: 0.27, hy: 0.15, hs: 0.9,
      inner: E(64, 98, 7.5, 4.6)(fl(PINK, bl)) + E(136, 98, 7.5, 4.6)(fl(PINK, bl)),
      top: P('M44 58Q100 35 156 58L156 71Q100 50 44 71Z')(fl(BAND[0])) + P('M44 58Q100 35 156 58L156 61.5Q100 39 44 61.5Z')(fl(BAND[1])) +
        P('M44 67.5Q100 46.5 156 67.5L156 71Q100 50 44 71Z')(fl(BAND[2])) + P('M120 50L156 58L156 71L120 54Z')(fl(BAND[2], 0.35)) +
        ln('M44 58Q100 35 156 58M44 71Q100 50 156 71', MDW * 0.8) + kaw
    });
    b += ms(E(54, 66, 7, 8.5), [47, 57.5, 14, 17], BAND, { hl: false, k: 0.14, sw: MDW + 0.8 }) + ln('M51 62Q55 66 52 71', 1.4, '#C76A12');
    // snout, nose, mouth
    b += f3(E(100, 102, 24, 15.5), [76, 86.5, 48, 31], [CREAM, '#FFF6E8', '#E3C79E'], { sw: MDW, k: 0.1, hx: 0.34, hy: 0.32, hs: 0.8 });
    if (M.mouth === 'open') b += P('M87.5 102Q100 106 112.5 102Q111 116.5 100 116.5Q89 116.5 87.5 102Z')(`fill="#7A2E22" stroke="${OL}" stroke-width="${MDW}" stroke-linejoin="round"`) + E(100, 112.6, 6.4, 3.2)(fl('#F27A8A'));
    else if (M.mouth === 'o') b += ln('M100 99.5V101.5', MDW) + E(100, 108.5, 4.6, 6)(`fill="#7A2E22" stroke="${OL}" stroke-width="${MDW}"`);
    else b += ln(MOUTH[M.mouth], MDW);
    b += P('M92.5 92Q100 88 107.5 92Q106 98.5 100 99.5Q94 98.5 92.5 92Z')(fl(OL)) + dot(96.4, 91.6, 1.5, '#fff');
    // eyes (blink group)
    const lx = 80 + look[0], rx = 120 + look[0], ey = 81 + look[1];
    let eyes;
    if (M.eyes === 'oops') eyes = mEye('open', lx, ey, -1) + mEye('squint', rx, ey, 1);
    else eyes = mEye(M.eyes, lx, ey, -1) + mEye(M.eyes, rx, ey, 1);
    b += g(eyes, '', 'm-eyes');
    if (M.brow === 'think') b += ln('M72 67.5Q79 65.5 86 67.5', 2.8) + ln('M113 64Q121 59.5 129 63', 2.8);
    if (M.brow === 'worry') b += ln('M72 66.5Q78 66.5 86 63.5', 2.8);
    // arms + hooves
    const hoof = (x, y, el) => (el ? E(x, y, 8.5, 5.4, `rotate(-20 ${x} ${y})`) : E(x, y, 6, 6.4))(`fill="${HOOF}" stroke="${OL}" stroke-width="${MDW}"`) + dot(x - 2, y - 2.2, 1.3, '#7A5A48');
    b += limb(A[0], 7.5, FUR[0], 3.3) + hoof(A[1][0], A[1][1]) + limb(A[2], 7.5, FUR[0], 3.3) + hoof(A[3][0], A[3][1], M.arms === 'point');
    // mood extras
    if (M.extra === 'dots') b += [[158, 52, 3.2], [169, 40, 4.6], [182, 25, 6.6]].map(c => C(c[0], c[1], c[2])(`fill="#fff" stroke="${OL}" stroke-width="${MDW}"`)).join('');
    if (M.extra === 'sweat') b += P('M150 57Q157 67 156 72Q155 78.5 149.5 78.5Q144 78 144 72.5Q144.5 66 150 57Z')(`fill="#3FA7C4" stroke="${OL}" stroke-width="${MDW}" stroke-linejoin="round"`) + E(148, 72, 1.6, 2.8)(fl('#fff', 0.9));
    if (M.extra === 'sparkle') b += star4(28, 70, 8) + star4(172, 70, 8) + star4(38, 44, 5, '#F8B26A') + star4(164, 40, 5, '#F8B26A');
    if (M.extra === 'pop') b += ln('M158 34L165 25M166 46L177 42M150 28L152 17', 3.2);
    s += g(b, '', 'm-body');
    return `<svg class="gs-mascot gs-mood-${mood}" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="Si Cil">${s}</svg>`;
  };

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
    '.gs-mascot .m-body{animation:gsBreath 2.4s cubic-bezier(.37,0,.63,1) infinite}',
    '.gs-mascot .m-eyes{transform-box:view-box;transform-origin:100px 81px;animation:gsBlink 4.2s linear infinite}',
    '.gs-mascot.gs-mood-happy .m-eyes,.gs-mascot.gs-mood-cheer .m-eyes{animation:none}',
    '.gs-mascot .m-ear-l{transform-box:view-box;transform-origin:76px 52px;animation:gsEarL 5.6s cubic-bezier(.37,0,.63,1) infinite}',
    '.gs-mascot .m-ear-r{transform-box:view-box;transform-origin:124px 52px;animation:gsEarR 6.8s cubic-bezier(.37,0,.63,1) 1.3s infinite}',
    '.gs-mascot .m-tail-a,.gs-mascot .m-tail-b{transform-box:view-box;transform-origin:56px 66px;animation:gsSway 1.9s cubic-bezier(.37,0,.63,1) infinite alternate}',
    '.gs-mascot .m-tail-b{animation-duration:2.3s;animation-delay:-.9s}',
    '.gs-float-light{animation:gsFloat 3s cubic-bezier(.37,0,.63,1) infinite}',
    '@keyframes gsBreath{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
    '@keyframes gsBlink{0%,93%,100%{transform:scaleY(1)}95.5%{transform:scaleY(.1)}}',
    '@keyframes gsEarL{0%,80%,94%,100%{transform:rotate(0)}84%{transform:rotate(-9deg)}89%{transform:rotate(4deg)}}',
    '@keyframes gsEarR{0%,80%,94%,100%{transform:rotate(0)}84%{transform:rotate(9deg)}89%{transform:rotate(-4deg)}}',
    '@keyframes gsSway{from{transform:rotate(-5deg)}to{transform:rotate(7deg)}}',
    '@keyframes gsFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',
    '@media (prefers-reduced-motion:reduce){.gs-mascot *,.gs-float-light{animation:none!important}}'
  ].join('\n');
  if (typeof document !== 'undefined' && !document.getElementById('gs-art-css')) {
    const st = document.createElement('style');
    st.id = 'gs-art-css';
    st.textContent = art.css;
    (document.head || document.documentElement).appendChild(st);
  }
})();
