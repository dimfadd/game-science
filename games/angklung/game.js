/* Angklung Ajaib (angklung)
 * A sanggar (music hut) full of bamboo angklung. The child sorts, cuts, shakes and plays angklung
 * and builds rhythms on a beat grid. Sound is synthesized (GS.tone / GS.noise, the sfx channel), and
 * everything you hear is also shown: shivering tubes and vibration marks, sound rings, a note-height
 * board, beat dots and a playhead, so the game can be played with the sound off.
 *
 * Physical model (stated, used everywhere):
 *   Pitch. An angklung tube is a bamboo resonator closed at the bottom node and open at the top, a
 *   quarter-wave tube: f = v / (4 L) with v = 343 m/s, so f = 8575 / L (L in cm, f in Hz). The end
 *   correction (about 0.6 x the radius) is left out on purpose so that ratios are exact: half the length
 *   is exactly one octave up (2 x f), 2/3 of the length is a fifth (3/2 x f). The second, shorter tube of
 *   every angklung is half as long and sounds the octave, as on a real angklung.
 *   Note heights on screen are log2(f), so every octave is the same step.
 *   Scale: the pentatonic do re mi sol la (number notation 1 2 3 5 6, and high do with a dot), tuned in
 *   just ratios 1, 9/8, 5/4, 3/2, 5/3, 2. (Traditional Sundanese angklung is salendro/pelog; school
 *   angklung after Daeng Soetigna is diatonic. We use the diatonic pentatonic subset.)
 *   Loudness. How far the child swings the angklung sets the amplitude A (0..1), never the pitch.
 *   With the inverse-square law the distance at which a sound is still heard grows in proportion to A,
 *   so the sound ring reaches R = 800 x A canvas units.
 *   Vibration. A tube that cannot vibrate (wrapped in cloth, string pinched or slack) makes no tone.
 *   Echo: t = 2 d / 340 (there and back). Thunder: t = d / 340 (light arrives almost at once).
 * Rhythm tasks are never timing tests: the child places sounds on a beat grid at rest and then it plays.
 * Nothing is snapped onto an answer. The only snapping is stated: the cutting ruler is in whole cm,
 * the distance flag in 10 m. */
(function () {
  'use strict';
  const GAME = 'angklung';
  const TIER = (window.GS && GS.tier) ? GS.tier() : 'k1';   // tk | k1 | k2 | k3 | k4
  const TK = TIER === 'tk';
  const OUT = '#3B2A20', INK = '#2B1D14', CREAM = '#FFF8EC', AMBER = '#F2A900', TEAL = '#0F8C7A', BLUE = '#1F6FD1';
  const KT = 8575;                     // v / 4 in cm * Hz: f = KT / L
  const FLOOR = 690;                   // where angklung stand
  const fOf = L => KT / L;
  let SPEED = 1;
  const ms = v => v / SPEED;
  const tw = (d, fn, e) => GS.tween(ms(d), (v, raw) => fn(Math.max(0, v), Math.max(0, raw)), e);
  const wait = d => GS.wait(ms(d));
  const MNAME = (() => { try { return GS.art.mascotName(GS.mascotChar()); } catch (e) { return 'Chuppy'; } })();

  /* ================= small utilities ================= */
  const n1 = v => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => GS.shuffle(a);
  const fxR = () => (GS.fxRandom || Math.random)();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const dec = v => String(Math.round(v * 100) / 100).replace('.', ',');
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const lcm = (a, b) => a / gcd(a, b) * b;
  const range = n => Array.from({ length: n }, (_, i) => i);
  const sameSet = (a, b) => a.length === b.length && a.every(v => b.indexOf(v) >= 0);
  let uidN = 0;
  const salt = fxR().toString(36).slice(2, 5);
  const uid = p => 'ak' + salt + p + (++uidN).toString(36);

  /* ================= svg string helpers ================= */
  const Ci = (cx, cy, r, a) => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" ${a || ''}/>`;
  const El = (cx, cy, rx, ry, a) => `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" ${a || ''}/>`;
  const Rc = (x, y, w, h, rx, a) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(Math.max(0, w))}" height="${n1(Math.max(0, h))}" rx="${n1(rx || 0)}" ${a || ''}/>`;
  const Pa = (d, a) => `<path d="${d}" ${a || ''}/>`;
  const fill = (c, op) => `fill="${c}"` + (op != null ? ` opacity="${op}"` : '');
  const ol = sw => `stroke="${OUT}" stroke-width="${n1(sw || 3)}" stroke-linejoin="round" stroke-linecap="round"`;
  const solid = (c, sw) => `fill="${c}" ${ol(sw)}`;
  const line = (d, sw, c, op) => `<path d="${d}" fill="none" stroke="${c || OUT}" stroke-width="${n1(sw || 3)}" stroke-linecap="round" stroke-linejoin="round"${op != null ? ` opacity="${op}"` : ''}/>`;
  const shadowE = (cx, cy, rx) => El(cx, cy, rx, Math.max(3, rx * 0.16), fill(OUT, 0.18));
  const txt = (x, y, s, size, o) => {
    o = o || {};
    return `<text x="${n1(x)}" y="${n1(y)}" font-size="${size}" text-anchor="${o.anchor || 'middle'}" fill="${o.fill || INK}"${o.cls ? ` class="${o.cls}"` : ''}${o.decor ? ' data-qc="decor"' : ''}${o.w ? ` font-weight="${o.w}"` : ''} style="font-variant-numeric:tabular-nums">${esc(s)}</text>`;
  };
  /** Cream pill with dark text. */
  function pill(x, y, s, size, o) {
    o = o || {};
    const w = o.w || Math.max(size * 1.6, String(s).length * size * 0.56 + size * 0.9), h = o.h || size * 1.42;
    return Rc(x - w / 2, y - h / 2, w, h, h / 2, `fill="${o.bg || CREAM}" ${ol(o.sw || 3)}`) + txt(x, y + size * 0.35, s, size, { cls: o.cls, fill: o.fill || INK, w: o.cls ? 700 : null });
  }
  function G(parent, attrs, markup) { const g = GS.el('g', attrs || {}, parent); if (markup) GS.markup(g, markup); return g; }
  const at = (x, y) => `translate(${n1(x)} ${n1(y)})`;

  /* ================= notes ================= */
  // Pentatonic degrees in just ratios; each has a colour AND a shape (colour-blind safe) and a number.
  const NOTE = [
    { n: '1', c: '#E2453C', sym: 'c', r: 1, word: 'merah', name: 'do' },
    { n: '2', c: '#F28C28', sym: 't', r: 9 / 8, word: 'jingga', name: 're' },
    { n: '3', c: '#FFC83D', sym: 's', r: 5 / 4, word: 'kuning', name: 'mi' },
    { n: '5', c: '#4DAA57', sym: 'd', r: 3 / 2, word: 'hijau', name: 'sol' },
    { n: '6', c: '#2F80C9', sym: 'r', r: 5 / 3, word: 'biru', name: 'la' },
    { n: '1', c: '#F59AB0', sym: 'o', r: 2, word: 'merah muda', name: 'do tinggi', hi: true }
  ];
  const noteL = (Ldo, k) => Ldo / NOTE[k].r;

  /* ================= sound (sfx channel: GS.tone / GS.noise) =================
   * The music IS the gameplay, so it uses the sfx channel (gated by the master mute and the sfx switch,
   * like every effect), not the backsound channel. */
  function strike(f, amp, delay) {
    if (!(amp > 0.01)) return;
    const v = 0.035 + 0.25 * Math.min(1, amp), d = delay || 0;
    GS.tone({ f, t: 0.42, vol: v, type: 'triangle', delay: d });
    GS.tone({ f: f * 2, t: 0.3, vol: v * 0.5, delay: d });          // the octave tube
    GS.tone({ f: f * 3, t: 0.12, vol: v * 0.12, delay: d });
    GS.noise({ t: 0.035, vol: 0.03 + 0.08 * amp, freq: 2600, q: 1.4, delay: d });   // bamboo knock
  }
  /** One angklung note: the shaken tubes knock about 9 times a second (tremolo). */
  function noteSound(f, amp, dur) {
    const n = Math.max(1, Math.round((dur || 0.42) / 0.11));
    for (let k = 0; k < n; k++) strike(f, (amp == null ? 0.6 : amp) * (k ? 0.75 : 1), k * 0.11);
  }
  function gongSound() { GS.tone({ f: 98, t: 1.4, vol: 0.3 }); GS.tone({ f: 147, t: 1.0, vol: 0.09, delay: 0.01 }); GS.tone({ f: 196, t: 0.7, vol: 0.05, delay: 0.02 }); }
  function knockSound(v) { GS.tone({ f: 620, f2: 480, t: 0.09, type: 'triangle', vol: 0.22 * (v || 1) }); GS.noise({ t: 0.05, vol: 0.12 * (v || 1), freq: 1200, q: 2 }); }
  function chord() { [0, 2, 3, 5].forEach((k, i) => noteSound(fOf(noteL(40, k)), 0.5, 0.3 + i * 0.05)); }

  /* ================= art ================= */
  const BAM = ['#E3C27A', '#F3DFA8', '#BF9A50'];     // tube bamboo
  const FRM = ['#C9A45E', '#E2C68A', '#9E7A3A'];     // frame bamboo
  const WOOD = ['#A8673A', '#C68654', '#7E4A27'];
  /** A bamboo tube, top-left (x, y). cut: height of the open, carved top (the resonator mouth). */
  function tubeSVG(x, y, w, h, c, cut) {
    let s = Rc(x, y, w, h, w * 0.42, fill(c[0]));
    s += Rc(x + w * 0.62, y + 5, w * 0.26, h - 10, w * 0.13, fill(c[2], 0.75));
    s += Rc(x + w * 0.14, y + 8, w * 0.18, h - 16, w * 0.09, fill(c[1], 0.9));
    if (cut) {
      s += Rc(x + 5, y + 5, w - 10, cut, (w - 10) / 2, fill('#6E4F2A'));
      s += Rc(x + w * 0.32, y + cut * 0.25, w * 0.36, cut * 0.75 + 4, w * 0.18, fill(c[0]));
    }
    for (let k = 1; k <= 2; k++) { const yy = y + h * (cut ? 0.52 + k * 0.16 : k / 3); s += line(`M${n1(x + 3)} ${n1(yy)}H${n1(x + w - 3)}`, 2.2, c[2]); }
    return s + Rc(x, y, w, h, w * 0.42, `fill="none" ${ol(3)}`);
  }
  function symSVG(x, y, sym, r, c) {
    const f = fill(c || CREAM);
    if (sym === 'c') return Ci(x, y, r, f);
    if (sym === 'o') return Ci(x, y, r, `fill="none" stroke="${c || CREAM}" stroke-width="${n1(r * 0.42)}"`);
    if (sym === 't') return Pa(`M${n1(x)} ${n1(y - r)}L${n1(x + r * 1.05)} ${n1(y + r * 0.8)}L${n1(x - r * 1.05)} ${n1(y + r * 0.8)}Z`, f + ' stroke-linejoin="round"');
    if (sym === 's') return Rc(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, r * 0.2, f);
    if (sym === 'd') return Pa(`M${n1(x)} ${n1(y - r * 1.1)}L${n1(x + r)} ${n1(y)}L${n1(x)} ${n1(y + r * 1.1)}L${n1(x - r)} ${n1(y)}Z`, f);
    let d = '';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r * 1.1; d += (i ? 'L' : 'M') + n1(x + Math.cos(a) * rr) + ' ' + n1(y + Math.sin(a) * rr); }
    return Pa(d + 'Z', f);
  }
  /** Number with the dot above for high do. */
  function noteNum(x, y, k, size, col) {
    const N = NOTE[k];
    return txt(x, y + size * 0.36, N.n, size, { fill: col || INK, w: 600 }) + (N.hi ? Ci(x, y - size * 0.62, Math.max(4, size * 0.1), fill(col || INK)) : '');
  }
  /** The coloured tag that hangs on an angklung: shape (TK) or number (k1+). */
  function tagSVG(x, y, k, mode, r) {
    r = r || 28;
    const N = NOTE[k];
    let s = line(`M${n1(x)} ${n1(y + r)}V${n1(y + r + 16)}`, 3) + Ci(x, y, r, solid(N.c, 3));
    if (mode === 'num') s += Ci(x, y, r - 6, fill(CREAM)) + noteNum(x, y, k, 36);
    else s += symSVG(x, y, N.sym, r * 0.5, CREAM);
    return s;
  }
  /** An angklung standing with its base at (0, 0). L = main tube length in cm, S = canvas units per cm. */
  function akSVG(L, S, o) {
    o = o || {};
    const H = L * S, W = 116, top = -(H + 62);
    let s = o.shadow === false ? '' : shadowE(0, 2, 66);
    s += Rc(-W / 2, top, 13, -top - 12, 6, solid(FRM[0], 3)) + Rc(W / 2 - 13, top, 13, -top - 12, 6, solid(FRM[0], 3));
    s += Rc(-W / 2 + 8, -(H * 0.42 + 44), W - 16, 9, 4, solid(FRM[2], 2.5));
    s += '<g class="ak-tubes">' + tubeSVG(-36, -(H + 28), 36, H + 14, BAM, Math.min(H * 0.4, 70)) + tubeSVG(8, -(H / 2 + 28), 28, H / 2 + 14, BAM, Math.min(H * 0.2, 36)) + '</g>';
    s += Rc(-W / 2 - 4, top, W + 8, 13, 6.5, solid(FRM[0], 3));
    s += Rc(-W / 2 - 8, -26, W + 16, 26, 13, solid(BAM[0], 3)) + Rc(-W / 2 - 2, -22, W + 4, 5, 2.5, fill(BAM[1], 0.8));
    if (o.cloth) s += `<g class="ak-cloth">${Rc(-46, -(H * 0.62 + 34), 92, H * 0.34 + 24, 14, solid('#B5322B', 3))}${line(`M-40 ${n1(-(H * 0.5 + 30))}H40M-40 ${n1(-(H * 0.38 + 30))}H40`, 4, '#FFC83D')}${Ci(0, -(H * 0.45 + 22), 7, solid('#FFC83D', 2))}</g>`;
    const ly = -(H * 0.55 + 28);
    s += `<g class="ak-lines">${line(`M-56 ${n1(ly - 22)}q-10 22 0 44M-70 ${n1(ly - 34)}q-15 34 0 68M56 ${n1(ly + 10)}q10 18 0 36M70 ${n1(ly)}q15 28 0 56`, 4.5, BLUE)}</g>`;
    if (o.tag != null) s += tagSVG(0, top - 44, o.tag, o.tagMode || 'sym', o.tagR);
    if (o.peg) s += Rc(-14, -40, 28, 42, 8, solid(WOOD[0], 3)) + Ci(0, -30, 6, fill(WOOD[2]));
    if (o.hit) s += Rc(-W / 2 - 14, top - (o.tag != null ? 80 : 20), W + 28, -top + (o.tag != null ? 88 : 28), 12, `fill="transparent" data-hit="${o.hit}"`);
    return s;
  }
  const akTop = (L, S) => -(L * S + 62);
  function makeAk(parent, x, y, L, S, o) {
    const g = GS.el('g', { transform: at(x, y), class: 'ak' + (o && o.grab ? ' ak-grab' : '') }, parent);
    g.__in = G(g, { class: 'ak-in' }, akSVG(L, S, o));
    return g;
  }
  function vibrate(g, dur) {
    if (!g || !g.__in) return;
    const inn = g.__in;
    inn.classList.add('ak-ring');
    clearTimeout(inn.__t);
    if (dur !== Infinity) inn.__t = setTimeout(() => inn.classList.remove('ak-ring'), ms(dur || 520));
  }
  function stopVib(g) { if (g && g.__in) { clearTimeout(g.__in.__t); g.__in.classList.remove('ak-ring'); } }
  /** A strip token: shape on colour (sym), number in a coloured frame (num), or number only (bare). */
  function tokenSVG(x, y, k, style, sz) {
    sz = sz || 96;
    const h = sz / 2, N = NOTE[k];
    if (style === 'sym') return Rc(x - h, y - h, sz, sz, 20, solid(N.c, 3.5)) + symSVG(x, y, N.sym, sz * 0.24, CREAM);
    if (style === 'bare') return Rc(x - h, y - h, sz, sz, 20, solid(CREAM, 3.5)) + noteNum(x, y + 2, k, 54);
    return Rc(x - h, y - h, sz, sz, 20, solid(CREAM, 3.5)) + Rc(x - h + 6, y - h + 6, sz - 12, sz - 12, 15, `fill="none" stroke="${N.c}" stroke-width="9"`) + noteNum(x, y + 2, k, 50);
  }
  function emptySlotSVG(x, y, sz) { sz = sz || 96; return Rc(x - sz / 2, y - sz / 2, sz, sz, 20, `fill="${CREAM}" fill-opacity=".55" stroke="${OUT}" stroke-width="3" stroke-dasharray="10 8"`); }
  function babySVG(awake) {
    let s = shadowE(0, 4, 120);
    s += Pa('M-130 -40Q0 60 130 -40', `fill="none" ${ol(4)}`) + line('M-130 -40L-150 -250M130 -40L150 -250M-150 -250L150 -250', 8, WOOD[2]);
    s += Pa('M-120 -60Q0 40 120 -60Q60 -20 0 -18Q-60 -20 -120 -60Z', solid('#F59AB0', 3)) + line('M-80 -42Q0 0 80 -42', 3, '#FFF8EC', 0.7);
    s += Ci(-30, -74, 34, solid('#EBC39C', 3)) + Pa('M-64 -80Q-30 -122 6 -82Q-30 -98 -64 -80Z', fill('#2B1D14'));
    if (awake) s += Ci(-42, -76, 5.5, fill(INK)) + Ci(-20, -76, 5.5, fill(INK)) + El(-31, -58, 8, 10, fill('#B5322B')) + line('M-62 -96l-10 -12M0 -96l10 -12', 3.5, AMBER);
    else s += line('M-48 -76q6 5 12 0M-26 -76q6 5 12 0', 3.2, INK) + line('M-36 -60q5 3 10 0', 3, INK);
    s += Pa('M-4 -70Q60 -96 112 -60Q60 -36 -4 -50Z', solid('#6FAEE3', 3));
    return s;
  }
  function kentonganSVG() {
    return line('M0 -170V-128', 5) + Rc(-38, -130, 76, 190, 34, solid(WOOD[0], 3.5)) + Rc(-8, -96, 16, 120, 8, fill(WOOD[2])) + Rc(-26, -122, 14, 170, 7, fill(WOOD[1], 0.7));
  }
  function gongIcon(x, y, r) { return Ci(x, y, r, solid('#D9A441', 3)) + Ci(x, y, r * 0.42, solid('#EECB7A', 2.5)) + Ci(x - r * 0.15, y - r * 0.15, r * 0.12, fill('#FFF8EC', 0.8)); }
  function handIcon(x, y, s) {
    s = s || 1;
    return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${s})">${Pa('M-6 10V-14a5 5 0 0 1 10 0v12l.3-3.6a4.6 4.6 0 0 1 9 .6v3.6a4.3 4.3 0 0 1 8.4.8v10C21.7 30 15.6 36 6 36h-1.8C-1.4 36-5.4 33.8-8.6 29.2L-16.6 18a4.6 4.6 0 0 1 7-5.8z', solid('#FFF8EC', 3))}</g>`;
  }
  function earIcon(x, y, s) {
    s = s || 1;
    return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${s})">${Pa('M-10 18C-18 12 -20 -2 -14 -12C-6 -24 14 -22 18 -8C22 4 10 8 8 16C6 24 -2 26 -10 18Z', solid('#EBC39C', 3))}${line('M-4 4C-6 -6 4 -12 8 -4', 3)}${line('M24 -16q8 12 0 24M32 -22q12 18 0 36', 3.5, BLUE)}</g>`;
  }
  function personSVG(i, k) {
    let s = '';
    try { s = GS.art.person(i, { shadow: true }); } catch (e) { s = Ci(0, -50, 30, solid('#EBC39C', 3)); }
    return `<g transform="scale(${k || 2.3})">${s}</g>`;
  }
  function mascotSVG(x, y, size, mood) {
    let s = '';
    try { s = GS.art.mascot({ mood: mood || 'happy', size }); } catch (e) { return ''; }
    return s.replace('<svg ', `<svg x="${n1(x - size / 2)}" y="${n1(y - size * 0.96)}" `);
  }

  /* ================= stage layers ================= */
  const svg = document.getElementById('stage');
  const bgL = G(svg, { class: 'ak-bg' });
  const world = G(svg, { class: 'ak-world' });
  const fxL = G(svg, { class: 'ak-fx', 'pointer-events': 'none' });
  const dock = document.getElementById('dock');

  function bgSanggar() {
    let s = Rc(-600, 0, 2480, 660, 0, fill('#E8CF9E'));
    let wv = '';
    for (let x = -600; x < 1900; x += 34) wv += `M${x} 0l-120 660`;
    for (let x = -720; x < 1900; x += 34) wv += `M${x} 0l120 660`;
    s += line(wv, 3, '#8A6A3A', 0.07);
    s += Rc(-600, 0, 2480, 30, 0, fill(WOOD[0])) + Rc(-600, 26, 2480, 8, 0, fill(WOOD[2], 0.6));
    s += Rc(-600, 608, 2480, 34, 0, fill('#C9A06A')) + Rc(-600, 608, 2480, 6, 0, fill('#E2C68A'));
    s += Rc(-600, 640, 2480, 160, 0, fill(WOOD[1]));
    let pl = '';
    [684, 734, 782].forEach((y, r) => { pl += `M-600 ${y}H1880`; for (let x = -600 + (r % 2) * 120; x < 1880; x += 240) pl += `M${x} ${y - 46}V${y}`; });
    s += line(pl, 3, WOOD[2], 0.45);
    [-90, 1370].forEach(x => { s += Rc(x - 28, 0, 56, 650, 10, fill(FRM[0])) + Rc(x - 16, 0, 10, 650, 5, fill(FRM[1], 0.8)) + line(`M${x - 28} 200H${x + 28}M${x - 28} 420H${x + 28}`, 4, FRM[2]); });
    G(bgL, { class: 'gs-scene', 'aria-hidden': 'true' }, s);
  }
  function bgOutdoor(name) {
    let s = '';
    try { s = GS.art.scene(name || 'kampung', 1280, 800); } catch (e) { s = Rc(-600, 0, 2480, 800, 0, fill('#9ED8EC')) + Rc(-600, 624, 2480, 176, 0, fill('#7CC26B')); }
    GS.markup(bgL, s);
  }
  function bgValley() {
    const id = uid('sky');
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ED8EC"/><stop offset="1" stop-color="#E6F5F0"/></linearGradient></defs>`;
    s += Rc(-600, 0, 2480, 800, 0, `fill="url(#${id})"`);
    s += Pa('M-600 470L-380 380L-160 440L80 360L300 430L560 350L820 420L1100 340L1380 420L1640 360L1880 430V560H-600Z', fill('#B7D9AE'));
    s += Pa('M-600 500L-300 450L40 490L380 440L720 490L1060 450L1400 490L1880 455V560H-600Z', fill('#A9D3A0'));
    s += Rc(-600, 520, 2480, 280, 0, fill('#7CC26B')) + Rc(-600, 520, 2480, 8, 0, fill('#8CCB7C'));
    let tf = '';
    for (let x = -560; x < 1880; x += 170) tf += `M${x} 700q8 -18 16 0q8 -14 16 0`;
    s += line(tf, 4, '#5AA54E', 0.8);
    G(bgL, { class: 'gs-scene', 'aria-hidden': 'true' }, s);
  }

  /* ================= flow state ================= */
  let LV = null, RD = null, RI = 0, tries = 0, rTries = 0, busy = false, DEMO = false, tok = 0, solving = false;
  let KS = {};          // state of the current round's kind
  let BTN = {};
  const TEMPO = { tk: 680, k1: 560, k2: 500, k3: 460, k4: 420 }[TIER] || 520;

  function clearStage() {
    bgL.innerHTML = ''; world.innerHTML = ''; fxL.innerHTML = '';
    dock.innerHTML = ''; BTN = {};
    KS = {};
  }
  const ICO = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.9l11-7.2a1 1 0 0 0 0-1.7l-11-7.2A1 1 0 0 0 7 4.8z" fill="currentColor"/></svg>',
    ear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 18c-2-2-3-4.5-3-7.5A7 7 0 0 1 19 10c0 3-2.4 4-3 6.4-.4 1.8-1.6 3.6-4 3.6-1.6 0-3-.8-4-2z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M9.5 10.5a2.6 2.6 0 0 1 5 0c0 1.5-1.4 2-1.6 3.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.5 12.5 5 5 10-11" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    saw: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15 15 3l3 3L6 18z" fill="currentColor"/><path d="M15 3l6 6-3 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M5 20l2-2" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12 20 4l-4 16-4-6z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>'
  };
  function actionBtn(id, label, icon, fn, alt) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'ak-' + id;
    b.className = 'gs-action' + (alt ? ' alt' : '');
    b.innerHTML = (icon || '') + '<span></span>';
    b.querySelector('span').textContent = label;
    b.addEventListener('click', () => { if (b.disabled) return; GS.sfx.click(); fn(); });
    dock.appendChild(b);
    BTN[id] = b;
    return b;
  }
  function updDock() {
    const ready = KS.ready ? KS.ready() : true;
    if (BTN.main) BTN.main.disabled = busy || !ready;
    if (BTN.alt) BTN.alt.disabled = busy || (KS.altReady ? !KS.altReady() : false);
  }
  function floatAt(text, x, y, cls) {
    const m = svg.getScreenCTM();
    if (m) GS.floatText(text, m.a * x + m.e, m.d * y + m.f, cls);
  }
  function ring(x, y, R, col, w) {
    const c = GS.el('circle', { cx: n1(x), cy: n1(y), r: 16, fill: 'none', stroke: col || BLUE, 'stroke-width': w || 7, opacity: 0.85 }, fxL);
    tw(Math.max(450, R * 1.1), v => { c.setAttribute('r', n1(16 + (R - 16) * v)); c.setAttribute('opacity', n1((1 - v) * 85) / 100); }, 'outCubic').then(() => c.remove());
  }
  function confettiAt(x, y) { const m = svg.getScreenCTM(); if (m) GS.confetti(m.a * x + m.e, m.d * y + m.f, 60); }

  const PRAISE = ['Merdu sekali!', 'Hebat! Bunyinya pas.', 'Tepat! Prok prok prok!', 'Bagus! Angklungnya bernyanyi.'];
  function fail(text, el) {
    tries++; rTries++;
    if (tries === 2) run.offerDemo();
    GS.sfx.oops(); hud.mood('oops');
    if (text) GS.say(text);
    if (el) GS.fx(el, 'gs-wobble', 450);
    busy = false; updDock();
  }
  async function roundWon(text, x, y) {
    busy = true; updDock();
    const my = tok;
    hud.mood('cheer');
    GS.say(text || pick(PRAISE));
    await wait(300);
    if (my !== tok) return;
    chord();
    confettiAt(x || 640, y || 300);
    await wait(1500);
    if (my !== tok) return;
    if (!DEMO && RI + 1 < LV.rds.length) startRound(RI + 1);
    else run.win(tries === 0 ? 3 : tries <= 2 ? 2 : 1, LV.win || 'Sanggar angklungmu hebat!');
  }

  /* ================= note-height board (rack) ================= */
  const F_LO = KT / 52, F_HI = KT / 12;
  const yOfF = f => 254 - clamp(Math.log2(f / F_LO) / Math.log2(F_HI / F_LO), 0, 1) * 150;
  function boardPanel(x0, x1) {
    const g = G(world, { class: 'ak-board' });
    GS.markup(g, Rc(x0, 84, x1 - x0, 196, 24, `fill="${CREAM}" fill-opacity=".85" ${ol(3)}`) +
      line(`M${x0 + 20} 254H${x1 - 20}M${x0 + 20} 179H${x1 - 20}M${x0 + 20} 104H${x1 - 20}`, 2, OUT, 0.15) +
      line(`M${x0 + 34} 250V112`, 5, BLUE, 0.7) + Pa(`M${x0 + 22} 122L${x0 + 34} 100L${x0 + 46} 122Z`, fill(BLUE, 0.7)));
    const dots = G(g, {});
    return { g, dots, last: null };
  }
  function boardDot(B, x, f, col) {
    const y = yOfF(f);
    if (B.last) GS.markup(B.dots, line(`M${n1(B.last.x)} ${n1(B.last.y)}L${n1(x)} ${n1(y)}`, 5, OUT, 0.35));
    const d = G(B.dots, {}, Ci(x, y, 20, solid(col || BLUE, 3)));
    d.classList.add('ak-pop');
    B.last = { x, y };
    return d;
  }
  function boardClear(B) { B.dots.innerHTML = ''; B.last = null; }

  /* ================================================================
   * kind: rack (sort angklung from low to high, or find the middle one)
   * ================================================================ */
  function setupRack() {
    bgSanggar();
    const mid = RD.mode === 'middle', S = RD.S;
    const n = mid ? 3 : RD.tubes.length;
    const xs = mid ? [230, 420, 610] : range(n).map(i => 640 + (i - (n - 1) / 2) * Math.min(205, 1040 / n));
    KS = { pos: [], items: [], xs, n };
    const bx0 = xs[0] - 96, bx1 = xs[n - 1] + 96;
    // the wooden rack the angklung stand in
    let base = Rc(bx0, FLOOR - 6, bx1 - bx0, 30, 12, solid(WOOD[0], 3)) + Rc(bx0 + 8, FLOOR - 2, bx1 - bx0 - 16, 6, 3, fill(WOOD[1], 0.8));
    xs.forEach(x => { base += El(x, FLOOR + 2, 70, 10, fill(WOOD[2], 0.55)); });
    if (mid) base += Rc(790, FLOOR - 4, 450, 24, 12, solid('#D9C08A', 3)) + emptySlotSVG(xs[1], FLOOR - 120, 120);
    G(world, {}, base);
    KS.board = boardPanel(bx0 + 4, bx1 - 4);
    xs.forEach((x, i) => KS.pos.push({ x, slot: i, fixed: mid && i !== 1 }));
    if (mid) [860, 1012, 1164].forEach(x => KS.pos.push({ x, pool: true }));
    const add = (L, at, k) => {
      const it = { L, f: fOf(L), at, k };
      it.el = makeAk(world, KS.pos[at].x, FLOOR, L, S, { peg: KS.pos[at].fixed, grab: true, tag: RD.tagsNow ? k : null, tagMode: 'num' });
      it.H = L * S;
      KS.items.push(it);
      bindRackItem(it);
    };
    if (mid) { add(RD.ends[0], 0); add(RD.ends[1], 2); RD.pool.forEach((L, j) => add(L, 3 + j)); }
    else RD.tubes.forEach((L, i) => add(L, i, RD.notes ? RD.notes[i] : null));
    KS.ready = () => !mid || KS.items.some(it => it.at === 1);
    actionBtn('main', 'Mainkan', ICO.play, playRack);
    updDock();
  }
  function rackPlace(it, x, y) { it.el.setAttribute('transform', at(x, y)); it.cx = x; it.cy = y; }
  function rackMove(it, d) {
    const x0 = it.cx == null ? KS.pos[it.at].x : it.cx, y0 = it.cy == null ? FLOOR : it.cy, x1 = KS.pos[it.at].x;
    return tw(d || 240, v => rackPlace(it, x0 + (x1 - x0) * v, y0 + (FLOOR - y0) * v), 'outCubic').then(() => GS.sfx.drop());
  }
  function rackTap(it) {
    vibrate(it.el, 600);
    noteSound(it.f, 0.6, 0.45);
    ring(KS.pos[it.at].x, FLOOR - it.H * 0.6 - 30, 150);
  }
  function bindRackItem(it) {
    let st = null;
    GS.drag(it.el, {
      svg,
      onStart(p) { if (busy) return false; st = { p, moved: false, x: KS.pos[it.at].x }; world.appendChild(it.el); return true; },
      onMove(p) {
        if (!st) return;
        const dx = p.x - st.p.x, dy = p.y - st.p.y;
        if (!st.moved && Math.hypot(dx, dy) < 14) return;
        if (KS.pos[it.at].fixed) return;
        if (!st.moved) GS.sfx.pick();
        st.moved = true;
        rackPlace(it, st.x + dx, FLOOR + Math.min(0, dy) - 26);
      },
      onEnd(p) {
        if (!st) return;
        const s = st; st = null;
        if (!s.moved) { rackTap(it); return; }
        rackDrop(it, p.x);
      }
    });
  }
  function rackDrop(it, x) {
    let best = -1, bd = 1e9;
    KS.pos.forEach((P, i) => { if (P.fixed) return; const d = Math.abs(P.x - x); if (d < bd) { bd = d; best = i; } });
    if (best < 0) best = it.at;
    const other = KS.items.find(o => o !== it && o.at === best);
    if (other) { other.at = it.at; rackMove(other, 300); }
    it.at = best;
    rackMove(it, 200);
    boardClear(KS.board);
    world.querySelectorAll('.ak-mark').forEach(n => n.remove());
    updDock();
  }
  async function playRack() {
    if (busy) return;
    busy = true; updDock();
    const my = tok;
    world.querySelectorAll('.ak-mark').forEach(n => n.remove());
    boardClear(KS.board);
    const seq = range(KS.n).map(i => KS.items.find(it => it.at === i));
    for (let i = 0; i < seq.length; i++) {
      const it = seq[i];
      if (!it) continue;
      vibrate(it.el, 600);
      noteSound(it.f, 0.6, 0.45);
      it.dot = boardDot(KS.board, KS.xs[i], it.f, it.k != null && RD.tagsNow ? NOTE[it.k].c : BLUE);
      await wait(TK ? 700 : 560);
      if (my !== tok) return;
    }
    let bad = -1;
    for (let i = 1; i < seq.length; i++) if (!(seq[i].f > seq[i - 1].f)) { bad = i; break; }
    if (bad < 0) {
      if (RD.notes && !RD.tagsNow) {
        seq.forEach((it, i) => { G(world, { class: 'ak-pop' }, pill(KS.xs[i], FLOOR + 66, NOTE[it.k].n, 40, { w: 76 })); });
      }
      return roundWon(RD.winSay, 640, 200);
    }
    const a = yOfF(seq[bad - 1].f), b = yOfF(seq[bad].f), xm = (KS.xs[bad - 1] + KS.xs[bad]) / 2;
    G(world, { class: 'ak-mark' }, line(`M${n1(KS.xs[bad - 1] + 26)} ${n1(a)}L${n1(KS.xs[bad] - 26)} ${n1(b)}`, 10, AMBER) + Pa(`M${n1(xm - 18)} ${n1(Math.max(a, b) + 18)}L${n1(xm)} ${n1(Math.max(a, b) + 44)}L${n1(xm + 18)} ${n1(Math.max(a, b) + 18)}Z`, solid(AMBER, 3)));
    GS.fx(seq[bad].el, 'gs-wobble', 450); GS.fx(seq[bad - 1].el, 'gs-wobble', 450);
    fail(RD.mode === 'middle'
      ? (seq[1].f < seq[0].f ? 'Yang tengah lebih rendah. Coba yang lebih pendek.' : 'Yang tengah lebih tinggi. Coba yang lebih panjang.')
      : TK ? 'Ups, nadanya turun di sini. Tukar, ya.' : 'Di sini nadanya turun. Tukar tempatnya, lalu coba lagi.');
  }

  /* ================================================================
   * kind: seq (copy a pattern, continue a pattern, play a song from notation)
   * ================================================================ */
  function setupSeq() {
    bgSanggar();
    const m = RD.insts.length, Ldo = RD.Ldo || 40;
    const Ls = RD.insts.map(k => noteL(Ldo, k));
    const S = Math.min(5.6, 200 / Math.max.apply(null, Ls));
    const sp = Math.min(200, 1100 / m);
    KS = { insts: [], slots: [], top: [], style: RD.style };
    RD.insts.forEach((k, i) => {
      const x = 640 + (i - (m - 1) / 2) * sp, L = Ls[i];
      const el = makeAk(world, x, FLOOR, L, S, { tag: k, tagMode: RD.style === 'sym' ? 'sym' : 'num', hit: 'ak' });
      const it = { k, x, L, f: fOf(L), el, H: L * S };
      el.addEventListener('click', () => seqTap(i));
      KS.insts.push(it);
    });
    const n = RD.tgt.length, ts = Math.min(120, 1120 / n);
    const x0 = 640 - (n - 1) / 2 * ts;
    const cy = RD.mode === 'cont' ? 250 : 312;
    if (RD.mode !== 'cont') {
      // the model row: what to copy (heard + seen) or the song card
      const ty = 160;
      const g = G(world, {});
      GS.markup(g, Rc(x0 - ts / 2 - 70, ty - 62, n * ts + 92, 124, 26, `fill="#FFF3DA" ${ol(3)}`) + earIcon(x0 - ts / 2 - 36, ty, 1.25));
      RD.tgt.forEach((k, i) => {
        const tg = G(g, {});
        GS.markup(tg, tokenSVG(x0 + i * ts, ty, k, RD.mode === 'song' ? (RD.card || 'num') : RD.style, Math.min(96, ts - 16)));
        KS.top.push(tg);
      });
    }
    const sg = G(world, {});
    GS.markup(sg, Rc(x0 - ts / 2 - 70, cy - 62, n * ts + 92, 124, 26, `fill="#E9F4FB" ${ol(3)}`) + handIcon(x0 - ts / 2 - 38, cy - 14, 1.2));
    RD.tgt.forEach((k, i) => {
      const s = { x: x0 + i * ts, y: cy, val: i < (RD.given || 0) ? k : null, locked: i < (RD.given || 0), sz: Math.min(96, ts - 16) };
      s.el = G(world, {});
      s.el.addEventListener('click', () => seqSlotTap(i));
      KS.slots.push(s);
      drawSlot(s);
    });
    KS.ready = () => KS.slots.every(s => s.val != null);
    if (RD.mode !== 'cont') actionBtn('alt', 'Dengar', ICO.ear, () => playModel(), true);
    actionBtn('main', 'Mainkan', ICO.play, checkSeq);
    updDock();
  }
  function drawSlot(s, mark) {
    s.el.innerHTML = '';
    GS.markup(s.el, s.val == null ? emptySlotSVG(s.x, s.y, s.sz) : tokenSVG(s.x, s.y, s.val, KS.style, s.sz));
    if (s.locked) GS.markup(s.el, Ci(s.x + s.sz / 2 - 10, s.y - s.sz / 2 + 10, 9, solid(WOOD[0], 2.5)));
    if (mark) GS.markup(s.el, Rc(s.x - s.sz / 2 - 8, s.y - s.sz / 2 - 8, s.sz + 16, s.sz + 16, 24, `fill="none" stroke="${AMBER}" stroke-width="8"`));
    if (!s.locked) GS.markup(s.el, Rc(s.x - Math.max(s.sz, 94) / 2, s.y - 52, Math.max(s.sz, 94), 104, 16, 'fill="transparent" data-hit="slot"'));
  }
  function instSound(it, dur) { vibrate(it.el, 520); noteSound(it.f, 0.6, dur || 0.4); ring(it.x, FLOOR - it.H * 0.6 - 30, 130); }
  function seqTap(i) {
    const it = KS.insts[i];
    if (!it) return;
    instSound(it);
    if (busy) return;
    const s = KS.slots.find(q => q.val == null);
    if (!s) { GS.sfx.tick(); return; }
    s.val = it.k;
    KS.slots.forEach(q => { if (q.marked) { q.marked = false; drawSlot(q); } });
    drawSlot(s);
    GS.fx(s.el, 'ak-pop', 320);
    updDock();
  }
  function seqSlotTap(i) {
    const s = KS.slots[i];
    if (busy || !s || s.locked || s.val == null) return;
    s.val = null; s.marked = false;
    GS.sfx.pop();
    drawSlot(s);
    updDock();
  }
  async function playModel() {
    if (busy) return;
    busy = true; updDock();
    const my = tok;
    for (let i = 0; i < RD.tgt.length; i++) {
      const it = KS.insts.find(q => q.k === RD.tgt[i]);
      if (KS.top[i]) GS.fx(KS.top[i], 'ak-hl', 380);
      if (it) instSound(it);
      await wait(TEMPO);
      if (my !== tok) return;
    }
    busy = false; updDock();
  }
  async function checkSeq() {
    if (busy) return;
    busy = true; updDock();
    const my = tok;
    for (let i = 0; i < KS.slots.length; i++) {
      const s = KS.slots[i], it = KS.insts.find(q => q.k === s.val);
      GS.fx(s.el, 'ak-hl', 380);
      if (it) instSound(it);
      await wait(TEMPO);
      if (my !== tok) return;
    }
    const bad = KS.slots.map((s, i) => (s.val !== RD.tgt[i] ? i : -1)).filter(i => i >= 0);
    if (!bad.length) return roundWon(RD.winSay, 640, 250);
    bad.forEach(i => { const s = KS.slots[i]; s.marked = true; drawSlot(s, true); GS.fx(s.el, 'gs-wobble', 450); });
    const msg = RD.mode === 'copy' ? (TK ? 'Ada yang beda. Lihat kotak kuning.' : 'Ada yang beda dengan contoh. Lihat kotak kuning.')
      : RD.mode === 'cont' ? (TK ? 'Polanya berubah. Lihat kotak kuning.' : 'Di kotak kuning polanya berubah. Ketuk untuk menghapus.')
        : 'Nada di kotak kuning belum sama dengan lagunya.';
    fail(msg);
  }

  /* ================================================================
   * kind: shake (loud and soft: the swing sets the amplitude, never the pitch)
   * ================================================================ */
  const RMAX = 800;
  function setupShake() {
    bgSanggar();
    const soft = RD.task === 'soft';
    const AX = soft ? 780 : 380, S = 6.2, L = RD.L, H = L * S;
    KS = { AX, soft, D: soft ? 400 : 740, count: 0, f: fOf(L), H, gesture: null, lock: false };
    const tx = soft ? AX - 400 : AX + 740;
    // the listener: a sleeping baby close by, or a friend far away outside the open door
    if (soft) {
      KS.baby = G(world, { transform: at(tx, FLOOR - 4) });
      KS.babyArt = G(KS.baby, {}, babySVG(false));
      KS.zz = G(world, { class: 'ak-zz' }, txt(tx + 30, FLOOR - 200, 'z z', 40, { decor: true, fill: BLUE, w: 700 }));
    } else {
      G(world, {}, Rc(960, 150, 300, 470, 14, solid('#9ED8EC', 4)) + Rc(960, 520, 300, 100, 0, fill('#7CC26B')) + El(1060, 460, 70, 40, fill('#4DAA57')) + Rc(946, 136, 328, 26, 10, solid(WOOD[0], 3)));
      KS.friend = G(world, { transform: at(tx, FLOOR - 70) });
      KS.friendIn = G(KS.friend, {}, personSVG(RD.person, 2.0));
    }
    // dashed line to the listener, so how far the sound must (or must not) go is visible
    G(world, {}, line(`M${AX} ${FLOOR + 44}H${tx}`, 4, OUT, 0.35).replace('/>', ' stroke-dasharray="4 14"/>') + earIcon(tx, FLOOR + 44, 0.9));
    // loudness meter: 5 bars
    const mx = soft ? AX + 150 : AX + 150;
    KS.meter = range(5).map(i => GS.el('rect', { x: mx + i * 34, y: FLOOR - 30 - (i + 1) * 34, width: 26, height: (i + 1) * 34, rx: 6, fill: '#E8D9BF', stroke: OUT, 'stroke-width': 3 }, world));
    KS.ak = makeAk(world, AX, FLOOR, L, S, { grab: true, tag: 3, tagMode: 'sym' });
    KS.ak.appendChild(GS.el('rect', { x: -80, y: akTop(L, S) - 70, width: 160, height: -akTop(L, S) + 80, fill: 'transparent' }));
    bindShake();
    KS.ready = () => false;
    updDock();
  }
  function shakeMeter(amp) {
    const lit = Math.ceil(amp * 5 - 0.001);
    KS.meter.forEach((r, i) => r.setAttribute('fill', i < lit ? (i < 2 ? '#6FAEE3' : i < 4 ? '#2F80C9' : '#215F98') : '#E8D9BF'));
    clearTimeout(KS.meterT);
    KS.meterT = setTimeout(() => KS.meter && KS.meter.forEach(r => r.setAttribute('fill', '#E8D9BF')), ms(900));
  }
  function bindShake() {
    let st = null;
    GS.drag(KS.ak, {
      svg,
      onStart(p) { if (busy || KS.lock) return false; st = { x0: p.x, turn: 0, peak: 0, dir: 0, best: 0 }; GS.sfx.pick(); return true; },
      onMove(p) {
        if (!st) return;
        const pos = clamp(p.x - st.x0, -150, 150);
        KS.ak.setAttribute('transform', at(KS.AX + pos, FLOOR));
        if (st.dir === 0) { if (Math.abs(pos - st.turn) > 6) { st.dir = Math.sign(pos - st.turn); st.peak = pos; } return; }
        if ((st.dir > 0 && pos > st.peak) || (st.dir < 0 && pos < st.peak)) { st.peak = pos; return; }
        if (Math.abs(pos - st.peak) > 8) {             // turned around: the tubes knock once
          const stroke = Math.abs(st.peak - st.turn);
          if (stroke >= 30) shakeStrike(Math.min(1, stroke / 240), st);
          st.turn = st.peak; st.peak = pos; st.dir = -st.dir;
        }
      },
      onEnd() {
        if (!st) return;
        const s = st; st = null;
        const stroke = Math.abs(s.peak - s.turn);
        if (s.dir !== 0 && stroke >= 30) shakeStrike(Math.min(1, stroke / 240), s);
        const x0 = KS.ak ? +(KS.ak.getAttribute('transform').match(/translate\(([-\d.]+)/) || [0, KS.AX])[1] : KS.AX;
        tw(220, v => KS.ak && KS.ak.setAttribute('transform', at(x0 + (KS.AX - x0) * v, FLOOR)));
        if (!KS.soft && !busy && s.best > 0 && !KS.won) {
          fail('Temanmu belum dengar. Goyang lebih jauh, lebih keras!');
        }
      }
    });
  }
  function shakeStrike(amp, st) {
    if (busy || KS.lock || KS.won) return;
    if (st) st.best = Math.max(st.best, amp);
    const R = RMAX * amp, my = tok;
    vibrate(KS.ak, 500);
    noteSound(KS.f, amp, 0.25);
    ring(KS.AX, FLOOR - KS.H * 0.6 - 30, R, KS.soft ? '#6FAEE3' : BLUE, 4 + 6 * amp);
    shakeMeter(amp);
    if (KS.soft) {
      if (R >= KS.D) {
        KS.lock = true; KS.count = 0;
        setTimeout(() => {
          if (my !== tok) return;
          KS.babyArt.innerHTML = ''; GS.markup(KS.babyArt, babySVG(true)); KS.zz.style.display = 'none';
          GS.fx(KS.baby, 'gs-wobble', 450);
          GS.tone({ f: 520, f2: 640, t: 0.4, type: 'triangle', vol: 0.08 });
          fail(TK ? 'Wah, adik bangun. Goyang pelan-pelan saja.' : 'Terlalu keras, adik terbangun. Goyang lebih pelan.');
          setTimeout(() => { if (my !== tok) return; KS.babyArt.innerHTML = ''; GS.markup(KS.babyArt, babySVG(false)); KS.zz.style.display = ''; KS.lock = false; }, ms(2200));
        }, ms(R / 1.6));
      } else {
        KS.count++;
        floatAt('♪', KS.AX - 90, FLOOR - 300);
        if (KS.count >= 3) { KS.won = true; setTimeout(() => { if (my === tok) roundWon(TK ? 'Pelan sekali. Adik tetap tidur.' : 'Bunyinya pelan, adik tetap tidur nyenyak.', KS.AX - 400, 400); }, ms(500)); }
      }
    } else if (R >= KS.D) {
      KS.won = true;
      setTimeout(() => {
        if (my !== tok) return;
        KS.friendIn.innerHTML = ''; GS.markup(KS.friendIn, personSVG(RD.person, 2.0) + earIcon(-10, -250, 1.1));
        GS.fx(KS.friend, 'ak-hop', 900);
        roundWon(TK ? 'Keras sekali! Temanmu dengar.' : 'Bunyinya keras, sampai ke temanmu!', 1100, 360);
      }, ms(R / 1.6));
    }
  }

  /* ================================================================
   * kind: hold (sound comes from vibration: a tube wrapped in cloth cannot vibrate)
   * ================================================================ */
  function setupHold() {
    bgSanggar();
    const S = 5.2;
    KS = { items: [], want: RD.want || null };
    G(world, {}, line('M300 154H980', 26, FRM[2]) + line('M300 150H980', 18, FRM[0]) + Rc(280, 120, 36, 560, 12, solid(FRM[0], 3)) + Rc(964, 120, 36, 560, 12, solid(FRM[0], 3)));
    // wind coming through the window: the frames keep swaying, so an undamped tube keeps sounding
    G(world, {}, range(3).map(i => `<g class="ak-wind" style="animation-delay:${-i * 0.8}s">${line(`M${40 + i * 30} ${260 + i * 70}q40 -16 80 0t80 0`, 5, '#FFFFFF', 0.9)}</g>`).join(''));
    RD.notes.forEach((k, i) => {
      const x = 450 + i * 190, L = noteL(40, k), y = 640;
      const top = akTop(L, S) - 44 - 28;
      G(world, {}, line(`M${x} 160V${n1(y + top)}`, 4));
      const hang = G(world, { class: 'ak-sway d' + i, style: `transform-origin:${x}px 160px` });
      const el = makeAk(hang, x, y, L, S, { tag: k, tagMode: TK ? 'sym' : 'num', hit: 'tube', cloth: true });
      const it = { k, x, L, f: fOf(L), el, damped: !!RD.startDamped, H: L * S };
      el.addEventListener('click', () => holdTap(i));
      KS.items.push(it);
      holdDraw(it);
    });
    if (RD.want) {
      const g = G(world, {});
      GS.markup(g, Rc(1030, 120, 220, 240, 24, solid(CREAM, 3)) + earIcon(1080, 170, 1.3));
      RD.want.forEach((i, j) => GS.markup(g, tagSVG(1140, 200 + j * 90 - (RD.want.length > 1 ? 0 : -40), RD.notes[i], TK ? 'sym' : 'num', 34)));
      GS.markup(world, personSVG(4, 2.2).replace('<g ', `<g data-x="" `).replace('transform="scale(2.2)"', `transform="translate(1140 ${FLOOR}) scale(2.2)"`));
    } else {
      KS.baby = G(world, { transform: at(1130, FLOOR - 4) });
      KS.babyArt = G(KS.baby, {}, babySVG(true));
      KS.zz = G(world, { class: 'ak-zz' }, txt(1160, FLOOR - 200, 'z z', 40, { decor: true, fill: BLUE, w: 700 }));
      KS.zz.style.display = 'none';
    }
    ringLoop();
    KS.ready = () => false;
    updDock();
  }
  function holdDraw(it) {
    const cl = it.el.querySelector('.ak-cloth');
    if (cl) cl.style.display = it.damped ? '' : 'none';
    if (it.damped) stopVib(it.el); else vibrate(it.el, Infinity);
  }
  function ringLoop() {
    const my = tok;
    (function step() {
      if (my !== tok || !KS.items) return;
      KS.items.forEach((it, i) => { if (!it.damped) { strike(it.f, 0.32, i * 0.045); if (fxR() < 0.35) ring(it.x, 640 - it.H * 0.6 - 30, 120, BLUE, 4); } });
      setTimeout(step, 190);
    })();
  }
  function holdTap(i) {
    const it = KS.items[i];
    if (!it || busy) return;
    it.damped = !it.damped;
    GS.sfx.pop();
    if (it.damped) knockSound(0.6);
    holdDraw(it);
    const ringing = KS.items.map((q, j) => (q.damped ? -1 : j)).filter(j => j >= 0);
    if (!KS.want) {
      if (!ringing.length) {
        KS.babyArt.innerHTML = ''; GS.markup(KS.babyArt, babySVG(false)); KS.zz.style.display = '';
        roundWon(TK ? 'Sepi. Adik tidur nyenyak.' : 'Tidak ada yang bergetar, jadi sepi. Adik tidur.', 1130, 420);
      }
      return;
    }
    if (!it.damped && KS.want.indexOf(i) < 0) { fail('Itu angklung ' + NOTE[it.k].word + '. Bungkus lagi, ya.', it.el); return; }
    if (sameSet(ringing, KS.want)) roundWon('Yang dibuka bergetar dan berbunyi. Pas!', 640, 300);
  }

  /* ================================================================
   * kind: grid (a beat grid: place sounds at rest, then it plays; never a timing test)
   * ================================================================ */
  const TRACKC = ['#E2453C', '#4DAA57', '#2F80C9'];
  const TRACKF = [fOf(noteL(40, 0)), fOf(noteL(40, 3)), fOf(noteL(40, 5))];
  function setupGrid() {
    bgSanggar();
    const g = RD, per = g.per, lines = Math.ceil(g.n / per);
    const cw = Math.min(130, 1100 / per), x0 = 640 - per * cw / 2 + (g.tracks.length ? 34 : 0);
    const nT = g.tracks.length + (g.durTrack ? 1 : 0);
    const tH = nT >= 3 ? 38 : 50, lH = 44, eH = 96, gap = 14;
    const top0 = g.mode === 'count' ? 370 : g.chips ? 250 : 200;
    const blk = lH + nT * tH + eH + gap;
    KS = { cw, x0, tH, lH, eH, blk, top0, per, hits: (g.given || []).slice(), locked: (g.given || []).slice(), cellEls: [], trackDots: [], lineY: [] };
    // header: the rule, in words and numbers
    const hg = G(world, {});
    if (g.head) GS.markup(hg, pill(640, 128, g.head, 34, { cls: 't-body', h: 70, bg: '#FFF3DA' }));
    if (g.chips) {
      const cwid = 76, gp = 10, tot = g.chips.length * (cwid + gp) - gp, cx0 = 640 - tot / 2 + cwid / 2;
      g.chips.forEach((c, i) => GS.markup(hg, Rc(cx0 + i * (cwid + gp) - cwid / 2, 172, cwid, 58, 14, solid(i % 2 ? '#F8B26A' : '#FFE08A', 3)) + txt(cx0 + i * (cwid + gp), 213, c, 38, { w: 600 })));
    }
    if (g.mode === 'count') {
      KS.kent = G(world, { transform: at(640, 290) }, kentonganSVG());
      G(world, {}, line('M560 120H720', 8, WOOD[2]));
    }
    const art = G(world, {});
    for (let l = 0; l < lines; l++) {
      const y = top0 + l * blk;
      KS.lineY.push(y);
      let s = '';
      const c0 = l * per, c1 = Math.min(g.n, c0 + per);
      // beat numbers (or a dot on the half and quarter beats)
      for (let c = c0; c < c1; c++) {
        const x = x0 + (c - c0) * cw + cw / 2;
        if (c % g.sub === 0) s += txt(x, y + 34, String(c / g.sub + 1), 36, { w: 600 });
        else s += Ci(x, y + 22, 6, fill(OUT, 0.5));
      }
      // beat boundaries
      if (g.sub > 1) for (let c = c0; c <= c1; c += 1) if (c % g.sub === 0) s += line(`M${n1(x0 + (c - c0) * cw)} ${y + 42}V${y + lH + nT * tH + eH}`, 3, OUT, 0.3);
      // display tracks
      let r = 0;
      if (g.durTrack) {
        const ry = y + lH + r * tH;
        g.durTrack.forEach(seg => {
          const a = Math.max(seg.on, c0), b = Math.min(seg.on + seg.len, c1);
          if (b <= a) return;
          const xa = x0 + (a - c0) * cw + 4, xb = x0 + (b - c0) * cw - 4;
          s += Rc(xa, ry + 4, xb - xa, tH - 8, 10, solid(seg.i % 2 ? '#F8B26A' : '#FFE08A', 2.5));
          if (a === seg.on) s += txt((xa + Math.min(xb, xa + seg.len * cw - 8)) / 2, ry + tH / 2 + 13, seg.label, 36, { w: 600 });
        });
        r++;
      }
      g.tracks.forEach((t, ti) => {
        const ry = y + lH + r * tH;
        s += Rc(x0, ry + 6, (c1 - c0) * cw, tH - 12, (tH - 12) / 2, fill(TRACKC[ti], 0.12));
        s += Ci(x0 - 40, ry + tH / 2, Math.min(18, tH / 2 - 2), solid(TRACKC[ti], 3)) + symSVG(x0 - 40, ry + tH / 2, ['c', 'd', 'o'][ti], 7, CREAM);
        r++;
      });
      // the child's row
      const ey = y + lH + nT * tH;
      s += Rc(x0, ey, (c1 - c0) * cw, eH, 18, `fill="#E9F4FB" ${ol(3)}`);
      s += g.edit === 'gong' ? gongIcon(x0 - 40, ey + eH / 2, 24) : handIcon(x0 - 40, ey + eH / 2 - 14, 1);
      GS.markup(art, s);
      for (let c = c0; c < c1; c++) {
        const cell = G(world, {});
        cell.__x = x0 + (c - c0) * cw + cw / 2; cell.__y = ey + eH / 2;
        cell.addEventListener('click', () => gridTap(c));
        KS.cellEls[c] = cell;
        drawCell(c);
      }
      // track dots
      g.tracks.forEach((t, ti) => {
        const ry = y + lH + (ti + (g.durTrack ? 1 : 0)) * tH + tH / 2;
        t.hits.forEach(c => {
          if (c < c0 || c >= c1) return;
          const d = G(world, {}, Ci(x0 + (c - c0) * cw + cw / 2, ry, Math.min(15, tH / 2 - 6), solid(TRACKC[ti], 2.5)));
          if (!t.show) d.style.display = 'none';
          (KS.trackDots[ti] = KS.trackDots[ti] || {})[c] = d;
        });
      });
    }
    KS.head = KS.lineY[0];
    KS.ph = GS.el('rect', { x: 0, y: 0, width: cw, height: lH + nT * tH + eH, rx: 10, fill: AMBER, opacity: 0.28, style: 'display:none' }, world);
    KS.marks = G(world, {});
    KS.ready = () => (g.mode === 'count' ? KS.hits.length > 0 : KS.hits.length > KS.locked.length);
    if (g.mode === 'count') { actionBtn('alt', 'Dengar', ICO.ear, () => playKent()); KS.altReady = () => true; }
    actionBtn('main', 'Mainkan', ICO.play, checkGrid);
    updDock();
  }
  function cellPos(c) { const e = KS.cellEls[c]; return { x: e.__x, y: e.__y }; }
  function drawCell(c, mark) {
    const e = KS.cellEls[c];
    if (!e) return;
    e.innerHTML = '';
    const x = e.__x, y = e.__y, cw = KS.cw, r = Math.min(36, cw * 0.36);
    let s = Rc(x - cw / 2 + 6, y - KS.eH / 2 + 8, cw - 12, KS.eH - 16, 14, `fill="#FFFFFF" fill-opacity=".6" stroke="${OUT}" stroke-opacity=".25" stroke-width="2"`);
    if (KS.hits.indexOf(c) >= 0) {
      if (RD.edit === 'gong') s += gongIcon(x, y, r);
      else s += Ci(x, y, r, solid('#FFC83D', 3)) + Rc(x - 7, y - r * 0.62, 14, r * 1.24, 7, solid(BAM[0], 2.5));
      if (KS.locked.indexOf(c) >= 0) s += Ci(x + r * 0.75, y - r * 0.75, 9, solid(WOOD[0], 2.5));
    }
    if (mark) s += Rc(x - cw / 2 + 2, y - KS.eH / 2 + 4, cw - 4, KS.eH - 8, 16, `fill="none" stroke="${AMBER}" stroke-width="8"`);
    s += Rc(x - cw / 2, y - KS.eH / 2, cw, KS.eH, 0, 'fill="transparent" data-hit="beat"');
    GS.markup(e, s);
  }
  function gridSound(c) {
    if (RD.edit === 'gong') gongSound(); else noteSound(fOf(noteL(40, 2)), 0.55, 0.22);
  }
  function gridTap(c) {
    if (busy) return;
    if (KS.locked.indexOf(c) >= 0) { GS.sfx.tick(); return; }
    KS.marks.innerHTML = '';
    const was = KS.hits.indexOf(c) >= 0;
    if (RD.single) {
      const old = KS.hits.filter(h => KS.locked.indexOf(h) < 0);
      KS.hits = KS.locked.concat(was ? [] : [c]);
      old.forEach(h => drawCell(h));
    } else if (was) KS.hits.splice(KS.hits.indexOf(c), 1);
    else KS.hits.push(c);
    if (!was) { gridSound(c); GS.fx(KS.cellEls[c], 'ak-pop', 300); } else GS.sfx.pop();
    KS.cellEls.forEach((e, i) => { if (e && e.__marked) { e.__marked = false; drawCell(i); } });
    drawCell(c);
    updDock();
  }
  async function playKent() {
    if (busy) return;
    busy = true; updDock();
    const my = tok;
    for (let i = 0; i < RD.N; i++) {
      knockSound(1);
      GS.fx(KS.kent, 'gs-wobble', 300);
      ring(640, 300, 170, '#C76A12', 6);
      await wait(620);
      if (my !== tok) return;
    }
    busy = false; updDock();
  }
  async function playGrid() {
    const my = tok, cellMs = TEMPO / RD.sub;
    KS.ph.style.display = '';
    for (let c = 0; c < RD.n; c++) {
      const l = Math.floor(c / KS.per);
      KS.ph.setAttribute('x', n1(KS.x0 + (c - l * KS.per) * KS.cw));
      KS.ph.setAttribute('y', n1(KS.lineY[l] + 40));
      RD.tracks.forEach((t, ti) => {
        if (t.hits.indexOf(c) < 0) return;
        const d = KS.trackDots[ti] && KS.trackDots[ti][c];
        if (d) { d.style.display = ''; GS.fx(d, 'ak-hl', 380); }
        noteSound(TRACKF[ti], 0.45, 0.2);
      });
      if (KS.hits.indexOf(c) >= 0) { gridSound(c); GS.fx(KS.cellEls[c], 'ak-hl', 380); }
      else if (c % RD.sub === 0 && !RD.tracks.some(t => t.hits.indexOf(c) >= 0)) GS.tone({ f: 1500, t: 0.025, type: 'square', vol: 0.02 });
      await wait(cellMs);
      if (my !== tok) return false;
    }
    KS.ph.style.display = 'none';
    return true;
  }
  async function checkGrid() {
    if (busy) return;
    busy = true; updDock();
    KS.marks.innerHTML = '';
    if (!(await playGrid())) return;
    const g = RD, hits = KS.hits;
    if (g.mode === 'count') {
      if (hits.length === g.N) return roundWon(g.N + ' bunyi, sama banyak!', 640, 300);
      // one-to-one: the knocks as dots above the cells
      let s = '';
      for (let i = 0; i < g.N; i++) s += Ci(KS.x0 + i * KS.cw + KS.cw / 2, KS.top0 + 6, 13, solid('#C76A12', 2.5));
      GS.markup(KS.marks, s);
      return fail('Kentongan ' + g.N + ' kali, angklungmu ' + hits.length + ' kali. ' + (hits.length < g.N ? 'Tambah lagi.' : 'Kurangi.'));
    }
    const T = g.target;
    const extra = hits.filter(c => T.indexOf(c) < 0), missing = T.filter(c => hits.indexOf(c) < 0);
    if (!extra.length && !missing.length) return roundWon(g.winSay, 640, 300);
    extra.forEach(c => { KS.cellEls[c].__marked = true; drawCell(c, true); GS.fx(KS.cellEls[c], 'gs-wobble', 450); });
    let msg;
    if (g.single) {
      const c = hits.filter(h => KS.locked.indexOf(h) < 0)[0];
      const who = g.tracks.map((t, ti) => (t.hits.indexOf(c) >= 0 ? ti : -1)).filter(i => i >= 0);
      const w = ['merah', 'hijau', 'biru'];
      msg = who.length === g.tracks.length ? 'Di ketukan ' + (c + 1) + ' semua bertemu, tapi ada yang lebih awal.'
        : who.length ? 'Di ketukan ' + (c + 1) + ' hanya angklung ' + who.map(i => w[i]).join(' dan ') + ' yang berbunyi.'
          : 'Di ketukan ' + (c + 1) + ' tidak ada angklung yang berbunyi.';
    } else if (g.mode === 'onset') msg = extra.length ? 'Bunyi di kotak kuning tidak cocok dengan kartu.' : 'Masih ada bunyi di kartu yang belum ditaruh.';
    else msg = extra.length ? 'Ketukan ' + extra.map(c => c + 1).join(', ') + ' tidak ikut pola.' : 'Polanya belum lengkap. Masih ada yang kurang.';
    fail(msg);
  }

  /* ================================================================
   * kind: cut (cut a bamboo tube to a length; f = 8575 / L)
   * ================================================================ */
  const CX0 = 140, CY = { ref: 318, nw: 402, knob: 482, blank: 556, rul: 590 };
  function setupCut() {
    bgSanggar();
    const U = 1000 / RD.Lmax;
    KS = { U, blankL: RD.Lmax, cutL: RD.start, piece: null };
    // workbench and ruler
    let s = Rc(70, 520, 1140, 160, 18, solid(WOOD[0], 3.5)) + Rc(80, 528, 1120, 10, 5, fill(WOOD[1], 0.8));
    s += Rc(CX0 - 10, CY.rul, 1020, 70, 8, solid('#FFF3DA', 3));
    for (let c = 0; c <= RD.Lmax; c++) {
      const x = CX0 + c * U, big = c % 5 === 0;
      s += line(`M${n1(x)} ${CY.rul}v${big ? 22 : 11}`, big ? 3 : 2, OUT, big ? 0.9 : 0.5);
      if (c % 5 === 0 && c > 0) s += txt(x, CY.rul + 60, String(c), 34, { w: 600 });
    }
    s += txt(CX0 + 6, CY.rul + 60, '0', 34, { w: 600 }) + txt(1180, CY.rul + 30, 'cm', 30, { cls: 't-body' });
    G(world, {}, s);
    // panels: note heights (left) and the waves (right)
    KS.pan = G(world, {});
    KS.refG = G(world, {});
    KS.newG = G(world, {});
    KS.blankG = G(world, {});
    KS.refG.addEventListener('click', () => { if (!busy) playTube(RD.Lref, KS.refG); });
    KS.blankG.addEventListener('click', () => { if (!busy) playTube(KS.blankL, KS.blankG); });
    drawHTube(KS.refG, RD.Lref, CY.ref, RD.refLabel || (RD.Lref + ' cm'), true);
    drawBlank();
    KS.knob = G(world, { class: 'ak-grab' });
    drawKnob();
    bindKnob();
    drawPanels();
    KS.ready = () => KS.cutL > 0 && KS.cutL < KS.blankL;
    actionBtn('main', 'Potong!', ICO.saw, doCut);
    updDock();
  }
  function hTubeSVG(L, y, U) {
    const w = L * U, h = 44, x = CX0;
    let s = Rc(x, y - h / 2, w, h, 14, fill(BAM[0])) + Rc(x + 6, y - h / 2 + 7, w - 12, 8, 4, fill(BAM[1], 0.9)) + Rc(x + 6, y + h / 2 - 13, w - 12, 8, 4, fill(BAM[2], 0.7));
    for (let k = 1; k < Math.floor(L / 12) + 1; k++) s += line(`M${n1(x + k * 12 * U)} ${y - h / 2 + 3}v${h - 6}`, 2.5, BAM[2]);
    s += Rc(x, y - h / 2, w, h, 14, `fill="none" ${ol(3)}`) + El(x + w - 6, y, 6, h / 2 - 4, fill('#6E4F2A'));
    return s;
  }
  function drawHTube(g, L, y, label, hit) {
    g.innerHTML = '';
    const U = KS.U;
    GS.markup(g, hTubeSVG(L, y, U) + pill(CX0 + L * U + 82, y, label, 36, { w: 140 }));
    if (hit) GS.markup(g, Rc(CX0, y - 46, L * U + 160, 92, 12, 'fill="transparent" data-hit="tube"'));
  }
  function drawBlank() {
    KS.blankG.innerHTML = '';
    const U = KS.U, w = KS.blankL * U;
    let s = Rc(CX0, CY.blank - 27, w, 54, 16, fill('#C9D17A')) + Rc(CX0 + 6, CY.blank - 19, w - 12, 9, 4, fill('#E4E8A8', 0.9)) + Rc(CX0 + 6, CY.blank + 8, w - 12, 9, 4, fill('#9DA552', 0.7));
    for (let k = 1; k * 12 < KS.blankL; k++) s += line(`M${n1(CX0 + k * 12 * U)} ${CY.blank - 24}v48`, 3, '#8E9645');
    s += Rc(CX0, CY.blank - 27, w, 54, 16, `fill="none" ${ol(3)}`);
    s += Rc(CX0, CY.blank - 30, w, 60, 0, 'fill="transparent"');
    GS.markup(KS.blankG, s);
  }
  function drawKnob() {
    const x = CX0 + KS.cutL * KS.U, y = CY.knob;
    KS.knob.innerHTML = '';
    GS.markup(KS.knob, line(`M${n1(x)} ${y + 30}V${CY.rul + 18}`, 5, '#C76A12').replace('/>', ' stroke-dasharray="10 7"/>') +
      Ci(x, y, 46, solid('#F28C28', 3.5)) + txt(x, y + 2, String(KS.cutL), 38, { w: 600 }) + txt(x, y + 32, 'cm', 26, { decor: true }) +
      Rc(x - 56, y - 56, 112, 112, 56, 'fill="transparent"'));
  }
  function bindKnob() {
    let st = null;
    GS.drag(KS.knob, {
      svg,
      onStart(p) { if (busy) return false; st = { dx: p.x - (CX0 + KS.cutL * KS.U) }; GS.sfx.pick(); return true; },
      onMove(p) {
        if (!st) return;
        const L = clamp(Math.round((p.x - st.dx - CX0) / KS.U), 1, KS.blankL - 1);
        if (L !== KS.cutL) { KS.cutL = L; drawKnob(); GS.sfx.tick(); updDock(); }
      },
      onEnd() { st = null; }
    });
  }
  function playTube(L, g) { noteSound(fOf(L), 0.6, 0.5); if (g) GS.fx(g, 'ak-hl', 380); }
  function wavePath(x0, y, w, cyc, amp) {
    let d = '';
    const N = Math.max(60, Math.ceil(cyc * 24));
    for (let i = 0; i <= N; i++) { const t = i / N; d += (i ? 'L' : 'M') + n1(x0 + t * w) + ' ' + n1(y - Math.sin(t * cyc * 2 * Math.PI) * amp); }
    return d;
  }
  function drawPanels() {
    const g = KS.pan;
    g.innerHTML = '';
    const fr = fOf(RD.Lref), fn = KS.piece ? fOf(KS.piece) : null;
    // note heights
    const yN = f => 252 - clamp(Math.log2(f / (KT / 64)) / Math.log2(64 / 8), 0, 1) * 150;
    let s = Rc(70, 84, 300, 196, 22, `fill="${CREAM}" fill-opacity=".9" ${ol(3)}`);
    if (RD.octLines) [-2, -1, 0, 1, 2, 3].forEach(k => { const y = yN(fr * Math.pow(2, k)); if (y > 96 && y < 270) s += line(`M90 ${n1(y)}H350`, 2.5, BLUE, 0.4).replace('/>', ' stroke-dasharray="8 8"/>'); });
    s += Ci(160, yN(fr), 20, solid(BAM[0], 3));
    if (fn) s += Ci(280, yN(fn), 20, solid('#C9D17A', 3)) + line(`M180 ${n1(yN(fr))}L260 ${n1(yN(fn))}`, 4, OUT, 0.35);
    // waves: the old tube and the new one over the same short time
    const wx = 400, ww = 790, cyc = 3;
    s += Rc(wx, 84, ww + 20, 196, 22, `fill="${CREAM}" fill-opacity=".9" ${ol(3)}`);
    const L0 = 494, Lw = 520;
    s += hTubeMini(wx + 40, 136, BAM[0]) + hTubeMini(wx + 40, 226, '#C9D17A');
    s += line(wavePath(L0, 136, Lw, cyc, 26), 4, '#A8771F');
    if (fn) {
      const c2 = cyc * fn / fr;
      s += line(wavePath(L0, 226, Lw, c2, 26), 4, '#357F40');
      // where both start a wave together again (a simple ratio p:q shows as lines)
      const rat = fn / fr;
      for (let q = 1; q <= 4; q++) {
        const p = Math.round(rat * q);
        if (p > 0 && Math.abs(rat * q - p) < 0.01) {
          for (let k = 0; k <= cyc; k += q) s += line(`M${n1(L0 + k / cyc * Lw)} 104V256`, 3, TEAL, 0.8).replace('/>', ' stroke-dasharray="6 6"/>');
          s += txt(L0 + Lw + 70, 192, p + ' : ' + q, 36, { w: 600 });
          break;
        }
      }
    }
    if (RD.hz) {
      s += txt(L0 + Lw + 70, 146, Math.round(fr) + ' Hz', 30, { w: 600 });
      if (fn) s += txt(L0 + Lw + 70, 242, Math.round(fn) + ' Hz', 30, { w: 600 });
    }
    GS.markup(g, s);
  }
  function hTubeMini(x, y, c) { return Rc(x - 24, y - 14, 48, 28, 10, solid(c, 2.5)); }
  async function doCut() {
    if (busy || !(KS.cutL > 0 && KS.cutL < KS.blankL)) return;
    busy = true; updDock();
    const my = tok, L = KS.cutL, x = CX0 + L * KS.U;
    // saw
    const saw = G(fxL, {}, Pa(`M${x - 8} ${CY.blank - 70}l16 0l0 140l-16 0z`, solid('#8C8F94', 3)) + Rc(x - 22, CY.blank - 104, 44, 40, 10, solid(WOOD[0], 3)));
    for (let k = 0; k < 4; k++) { GS.noise({ t: 0.16, vol: 0.12, freq: 1800, freq2: 900, q: 1, delay: k * 0.18 }); }
    await tw(700, v => saw.setAttribute('transform', `translate(0 ${n1(Math.sin(v * Math.PI * 4) * 14)})`), 'linear');
    saw.remove();
    if (my !== tok) return;
    KS.piece = L;
    KS.blankG.innerHTML = '';
    drawHTube(KS.newG, L, CY.nw, L + ' cm', false);
    KS.newG.style.opacity = 1;
    GS.fx(KS.newG, 'ak-pop', 320);
    drawPanels();
    await wait(400);
    playTube(RD.Lref, KS.refG); await wait(700);
    playTube(L, KS.newG); await wait(700);
    playTube(RD.Lref); playTube(L); await wait(900);
    if (my !== tok) return;
    if (L === RD.target) return roundWon(RD.winSay, 640, 360);
    const low = L > RD.target;   // longer tube: lower note
    if (low) {
      KS.blankL = L; KS.cutL = Math.max(1, Math.min(KS.cutL, L - 1));
      KS.newG.innerHTML = ''; KS.piece = null;
      drawBlank(); drawKnob(); drawPanels();
      fail(RD.lowSay || 'Masih terlalu rendah, tabungnya kepanjangan. Potong lagi sedikit.', KS.blankG);
    } else {
      KS.blankL = RD.Lmax; KS.cutL = Math.min(KS.cutL, RD.Lmax - 1);
      drawBlank(); drawKnob();
      KS.newG.style.opacity = 0.45;
      fail(RD.highSay || 'Terlalu tinggi, tabungnya kependekan. Ini bambu baru.');
    }
  }

  /* ================================================================
   * kind: phone (string telephone: sound travels along a taut, free string)
   * ================================================================ */
  const PH = { ax: 300, y: 430, len: 640 };
  function setupPhone() {
    bgOutdoor('kampung');
    KS = { fx: RD.fx, towel: !!RD.towel, max: PH.ax + PH.len + 60 };
    G(world, {}, mascotSVG(180, 640, 230, 'happy'));
    KS.akG = G(world, {});
    KS.ak = makeAk(KS.akG, 74, 640, 26, 4.6, { tag: 3, tagMode: 'sym', hit: 'ak' });
    KS.ak.addEventListener('click', () => sendPhone());
    G(world, {}, canSVG(PH.ax, PH.y, -1));
    KS.str = GS.el('path', { fill: 'none', stroke: '#FFF8EC', 'stroke-width': 5, 'stroke-linecap': 'round' }, world);
    KS.str2 = GS.el('path', { fill: 'none', stroke: OUT, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.5 }, world);
    KS.friend = G(world, { class: RD.fx == null ? 'ak-grab' : '' });
    KS.pulses = G(world, {});
    if (KS.towel) {
      KS.tw = G(world, { class: 'ak-grab' });
      KS.twX = (PH.ax + KS.max - 60) / 2; KS.twY = PH.y;
      drawTowel();
      bindTowel();
    }
    phoneFriend(RD.fx != null ? RD.fx : RD.start);
    if (RD.fx == null) bindFriend();
    KS.ready = () => true;
    actionBtn('main', 'Kirim bunyi', ICO.send, sendPhone);
    updDock();
  }
  function canSVG(x, y, dir) {
    return Rc(x - 22, y - 30, 44, 60, 8, solid('#8C8F94', 3)) + El(x - dir * 22, y, 6, 30, solid('#AEB1B5', 2.5)) + line(`M${x - 18} ${y - 18}H${x + 18}M${x - 18} ${y + 18}H${x + 18}`, 2.5, '#63666B');
  }
  function phoneSpan() { return (KS.fxNow - 60) - PH.ax; }
  function phoneSlack() { return PH.len - phoneSpan(); }
  function phoneFriend(x) {
    KS.fxNow = clamp(x, PH.ax + 260, KS.max);
    KS.friend.innerHTML = '';
    GS.markup(KS.friend, `<g transform="${at(KS.fxNow + 30, 640)}">${personSVG(RD.person, 2.3)}</g>` + canSVG(KS.fxNow - 60 + 22, PH.y, 1) +
      Rc(KS.fxNow - 70, 360, 150, 300, 20, 'fill="transparent"'));
    phoneString();
  }
  function phoneString() {
    const D = phoneSpan(), slack = Math.max(0, PH.len - D), sag = slack > 1 ? Math.sqrt(3 * D * slack / 8) : 0;
    const x1 = KS.fxNow - 60;
    KS.sag = sag;
    let d = `M${PH.ax + 22} ${PH.y}`;
    if (KS.towel) d += `L${n1(KS.twX)} ${PH.y + 4}L${n1(x1)} ${PH.y}`;
    else d += `Q${n1((PH.ax + x1) / 2)} ${n1(PH.y + 2 * sag)} ${n1(x1)} ${PH.y}`;
    KS.str.setAttribute('d', d); KS.str2.setAttribute('d', d);
  }
  function bindFriend() {
    let st = null;
    GS.drag(KS.friend, {
      svg,
      onStart(p) { if (busy) return false; st = { dx: p.x - KS.fxNow }; return true; },
      onMove(p) { if (st) phoneFriend(p.x - st.dx); },
      onEnd() { if (st && phoneSlack() <= 4) GS.sfx.creak(); st = null; }
    });
  }
  function drawTowel() {
    KS.tw.innerHTML = '';
    const x = KS.twX, y = KS.twY;
    GS.markup(KS.tw, Rc(x - 10, y - 26, 20, 34, 5, solid('#A8673A', 2.5)) + Pa(`M${x - 60} ${y + 4}L${x + 60} ${y + 4}L${x + 52} ${y + 130}Q${x} ${y + 140} ${x - 52} ${y + 130}Z`, solid('#2F80C9', 3)) +
      line(`M${x - 50} ${y + 40}H${x + 50}M${x - 48} ${y + 90}H${x + 48}`, 5, '#FFC83D') + Rc(x - 70, y - 40, 140, 190, 14, 'fill="transparent"'));
  }
  function bindTowel() {
    let st = null;
    GS.drag(KS.tw, {
      svg,
      onStart(p) { if (busy) return false; st = { dx: p.x - KS.twX, dy: p.y - KS.twY }; GS.sfx.pick(); return true; },
      onMove(p) { if (!st) return; KS.twX = p.x - st.dx; KS.twY = p.y - st.dy; KS.towel = false; drawTowel(); phoneString(); },
      onEnd() {
        if (!st) return; st = null;
        const onString = Math.abs(KS.twY - PH.y) < 50 && KS.twX > PH.ax + 40 && KS.twX < KS.fxNow - 80;
        if (onString) { KS.twY = PH.y; KS.towel = true; } else GS.sfx.drop();
        drawTowel(); phoneString();
      }
    });
  }
  async function sendPhone() {
    if (busy) return;
    busy = true; updDock();
    const my = tok;
    vibrate(KS.ak, 600);
    noteSound(fOf(noteL(40, 3)), 0.6, 0.5);
    ring(74, 520, 140);
    const slack = phoneSlack() > 4;
    const stopAt = slack ? 0.4 : KS.towel ? clamp((KS.twX - PH.ax) / (KS.fxNow - 60 - PH.ax), 0.1, 0.9) : 1;
    const pts = range(5).map(() => GS.el('circle', { r: 11, fill: BLUE, stroke: OUT, 'stroke-width': 2 }, KS.pulses));
    const path = KS.str, Lp = path.getTotalLength();
    await tw(1400, v => {
      pts.forEach((c, j) => {
        const u = clamp(v * 1.3 - j * 0.08, 0, 1) * stopAt;
        const p = path.getPointAtLength(u * Lp);
        c.setAttribute('cx', n1(p.x)); c.setAttribute('cy', n1(p.y));
        const fade = stopAt < 1 ? clamp(1 - (u / stopAt - 0.7) / 0.3, 0, 1) : 1;
        c.setAttribute('opacity', n1(fade * 100) / 100);
        c.setAttribute('r', n1(11 * (stopAt < 1 ? 0.4 + 0.6 * fade : 1)));
      });
    }, 'linear');
    KS.pulses.innerHTML = '';
    if (my !== tok) return;
    if (stopAt >= 1) {
      noteSound(fOf(noteL(40, 3)), 0.35, 0.4);
      GS.markup(KS.friend, earIcon(KS.fxNow + 30, 380, 1.2));
      GS.fx(KS.friend, 'ak-hop', 900);
      return roundWon(RD.winSay, KS.fxNow, 360);
    }
    fail(slack ? 'Benangnya kendur, getarannya hilang. Tarik temanmu sampai benang tegang.' : 'Handuk menahan benang, getarannya berhenti. Ambil handuknya.');
  }

  /* ================================================================
   * kind: dist (echo t = 2d / 340, thunder t = d / 340; find the distance)
   * ================================================================ */
  const DX0 = 220, DX1 = 1180, DAY = 566;
  function setupDist() {
    bgValley();
    const echo = RD.mode === 'echo';
    const X = d => DX0 + d / RD.maxD * (DX1 - DX0);
    KS = { X, heard: false, flagD: RD.flag0, echo };
    // the hidden thing: a cliff, or a storm cloud
    const hid = G(world, {});
    if (echo) GS.markup(hid, Pa(`M${X(RD.d) - 30} 530L${X(RD.d) - 10} 280L${X(RD.d) + 40} 220L${X(RD.d) + 120} 240L${X(RD.d) + 170} 300L${X(RD.d) + 220} 530Z`, solid('#8C8F94', 4)) + Pa(`M${X(RD.d) - 10} 280L${X(RD.d) + 40} 220L${X(RD.d) + 60} 320L${X(RD.d) + 10} 420Z`, fill('#AEB1B5')) + line(`M${X(RD.d) - 30} 530V280`, 6, '#63666B'));
    else GS.markup(hid, El(X(RD.d), 210, 120, 60, solid('#6B737C', 4)) + El(X(RD.d) - 70, 230, 70, 44, fill('#6B737C')) + Pa(`M${X(RD.d) - 10} 260L${X(RD.d) - 40} 360L${X(RD.d) - 6} 356L${X(RD.d) - 30} 470L${X(RD.d) + 40} 330L${X(RD.d) + 6} 334L${X(RD.d) + 30} 260Z`, solid('#FFC83D', 3)));
    KS.waveL = G(world, {});
    // fog over everything to the right of the child
    let fg = Rc(330, 100, 1560, 450, 60, fill('#F4F1EA', 0.97));
    for (let x = 340; x < 1880; x += 120) fg += Ci(x, 118, 60, fill('#F4F1EA', 0.97));
    KS.fog = G(world, { class: 'ak-fogfade' }, fg + txt(800, 300, '?', 120, { decor: true, fill: '#C9C2B5', w: 700 }));
    // the child, the measuring tape
    G(world, {}, mascotSVG(110, 548, 190, 'happy'));
    if (echo) G(world, {}, `<g transform="${at(200, 480)} scale(0.42)">${kentonganSVG()}</g>`);
    else G(world, {}, Rc(10, 400, 130, 130, 6, solid('#E6C389', 3)) + Pa('M0 404L75 340L150 404Z', solid('#B5502F', 3)));
    let s = Rc(DX0 - 20, DAY - 14, DX1 - DX0 + 40, 28, 10, solid('#FFE08A', 3));
    const step = RD.maxD <= 800 ? 100 : 200;
    for (let d = 0; d <= RD.maxD; d += 50) { const x = X(d); s += line(`M${n1(x)} ${DAY - 12}v${d % step === 0 ? 20 : 10}`, 2.5); if (d % step === 0) s += txt(x, DAY + 50, String(d), 34, { w: 600 }); }
    s += txt(DX1 + 40, DAY + 50, 'm', 30, { cls: 't-body' });
    G(world, {}, s);
    // stopwatch
    KS.sw = G(world, {});
    drawWatch(null);
    // flag
    KS.flag = G(world, { class: 'ak-grab' });
    drawFlag();
    bindFlag();
    // nudge buttons (10 m)
    const ng = G(world, {});
    GS.markup(ng, Rc(470, 640, 340, 108, 54, solid(CREAM, 3)));
    KS.minus = G(ng, {}, Ci(530, 694, 46, solid('#F28C28', 3)) + Pa('M548 672L506 694L548 716Z', fill(INK)) + Rc(482, 646, 96, 96, 48, 'fill="transparent" data-hit="minus"'));
    KS.plus = G(ng, {}, Ci(750, 694, 46, solid('#F28C28', 3)) + Pa('M732 672L774 694L732 716Z', fill(INK)) + Rc(702, 646, 96, 96, 48, 'fill="transparent" data-hit="plus"'));
    KS.val = G(ng, {});
    KS.minus.addEventListener('click', () => nudgeFlag(-10));
    KS.plus.addEventListener('click', () => nudgeFlag(10));
    drawVal();
    KS.ready = () => true;
    actionBtn('alt', echo ? 'Bunyikan' : 'Lihat petir', ICO.ear, listenDist, true);
    actionBtn('main', 'Cek', ICO.check, checkDist);
    KS.altReady = () => true;
    KS.ready = () => KS.heard;
    updDock();
  }
  function drawWatch(t, running) {
    KS.sw.innerHTML = '';
    GS.markup(KS.sw, Rc(990, 90, 250, 110, 26, solid(CREAM, 3)) + Ci(1046, 145, 34, solid('#FFFFFF', 3)) + Rc(1038, 100, 16, 12, 4, solid('#8C8F94', 2.5)) +
      line(`M1046 145L${n1(1046 + Math.sin((t || 0) * 2 * Math.PI) * 24)} ${n1(145 - Math.cos((t || 0) * 2 * Math.PI) * 24)}`, 4, '#E2453C') +
      txt(1160, 160, t == null ? '?' : dec(Math.round(t * 10) / 10), 40, { w: 600 }) + txt(1160, 190, 'detik', 26, { decor: true }));
    if (running) KS.sw.firstChild && KS.sw.classList.add('ak-blink'); else KS.sw.classList.remove('ak-blink');
  }
  function drawFlag() {
    const x = KS.X(KS.flagD);
    KS.flag.innerHTML = '';
    GS.markup(KS.flag, line(`M${n1(x)} ${DAY - 4}V${DAY - 190}`, 6, WOOD[2]) + Pa(`M${n1(x)} ${DAY - 190}L${n1(x + 80)} ${DAY - 164}L${n1(x)} ${DAY - 138}Z`, solid('#E2453C', 3)) +
      Ci(x, DAY, 12, solid(WOOD[0], 2.5)) + Rc(x - 50, DAY - 200, 140, 220, 16, 'fill="transparent"'));
  }
  function drawVal() { KS.val.innerHTML = ''; GS.markup(KS.val, txt(640, 710, KS.flagD + ' m', 42, { w: 600 })); }
  function setFlag(d) { KS.flagD = clamp(Math.round(d / 10) * 10, 0, RD.maxD); drawFlag(); drawVal(); }
  function nudgeFlag(dd) { if (busy) return; setFlag(KS.flagD + dd); GS.sfx.tick(); }
  function bindFlag() {
    let st = null;
    GS.drag(KS.flag, {
      svg,
      onStart(p) { if (busy) return false; st = { dx: p.x - KS.X(KS.flagD) }; GS.sfx.pick(); return true; },
      onMove(p) { if (!st) return; const d = (p.x - st.dx - DX0) / (DX1 - DX0) * RD.maxD; const old = KS.flagD; setFlag(d); if (KS.flagD !== old) GS.sfx.tick(); },
      onEnd() { st = null; }
    });
  }
  async function listenDist() {
    if (busy) return;
    busy = true; updDock();
    const my = tok, t = RD.t, echo = KS.echo;
    const fogX = 330;
    if (echo) { knockSound(1); ring(200, 470, 200, '#C76A12'); }
    else {
      const fl = GS.el('rect', { x: -600, y: 0, width: 2480, height: 800, fill: '#FFFFFF', opacity: 0.85 }, fxL);
      setTimeout(() => fl.remove(), 160);
    }
    // the sound front (hidden in the fog after x = 330): real time, and the stopwatch runs
    const arc = GS.el('path', { fill: 'none', stroke: echo ? '#C76A12' : '#6B737C', 'stroke-width': 8, 'stroke-linecap': 'round' }, KS.waveL);
    const t0 = performance.now(), Xd = KS.X(RD.d);
    await new Promise(res => {
      (function frame() {
        if (my !== tok) { res(); return; }
        const el = (performance.now() - t0) / 1000 * SPEED;
        const k = Math.min(1, el / t);
        drawWatch(k * t, true);
        let x;
        if (echo) x = k < 0.5 ? 200 + (Xd - 200) * (k / 0.5) : Xd - (Xd - 200) * ((k - 0.5) / 0.5);
        else x = Xd - (Xd - 140) * k;
        arc.setAttribute('d', `M${n1(x)} 360q${echo && k < 0.5 ? 30 : -30} 90 0 180`);
        arc.setAttribute('opacity', x < fogX ? 1 : 0);
        if (k >= 1) { res(); return; }
        requestAnimationFrame(frame);
      })();
    });
    arc.remove();
    if (my !== tok) return;
    if (echo) { knockSound(0.45); ring(200, 470, 130, '#C76A12', 4); }
    else { GS.noise({ t: 1.4, vol: 0.3, freq: 160, freq2: 60, q: 0.6 }); GS.tone({ f: 55, t: 1.2, vol: 0.25 }); }
    drawWatch(t, false);
    KS.heard = true;
    busy = false; updDock();
    if (!DEMO) GS.say(echo ? 'Gema kembali setelah ' + dec(t) + ' detik. Di mana tebingnya?' : 'Guruh terdengar ' + dec(t) + ' detik setelah petir. Di mana awannya?');
  }
  async function checkDist() {
    if (busy || !KS.heard) return;
    if (KS.flagD === RD.d) {
      KS.fog.style.opacity = 0;
      return roundWon(KS.echo ? '340 × ' + dec(RD.t) + ' ÷ 2 = ' + RD.d + ' m. Tepat!' : '340 × ' + dec(RD.t) + ' = ' + RD.d + ' m. Tepat!', KS.X(RD.d), 320);
    }
    const tt = KS.echo ? 2 * KS.flagD / 340 : KS.flagD / 340;
    GS.fx(KS.flag, 'gs-wobble', 450);
    fail((KS.echo ? 'Kalau tebingnya ' + KS.flagD + ' m, gema kembali setelah ' : 'Kalau awannya ' + KS.flagD + ' m, guruh datang setelah ') + dec(Math.round(tt * 100) / 100) + ' detik. Yang kita dengar ' + dec(RD.t) + ' detik.');
  }

  /* ================================================================
   * kind: board (growing pattern: build the next figure on a peg board)
   * ================================================================ */
  const BRD = { x: 760, y: 170, c: 90, n: 5 };
  function figCells(type, n) {
    const out = [];
    if (type === 'tri') for (let c = 0; c < n; c++) for (let r = 0; r <= c; r++) out.push([c, r]);
    else if (type === 'sq') for (let c = 0; c < n; c++) for (let r = 0; r < n; r++) out.push([c, r]);
    else if (type === 'L') { for (let r = 0; r < n; r++) out.push([0, r]); for (let c = 1; c < n; c++) out.push([c, 0]); }
    return out;
  }
  function setupBoard() {
    bgSanggar();
    KS = { on: [], cells: [] };
    const nums = [1, 2, 3].map(n => figCells(RD.type, n).length);
    // the given figures, small, with their numbers
    let s = Rc(60, 130, 640, 520, 26, `fill="${CREAM}" fill-opacity=".9" ${ol(3)}`);
    const cs = 30, base = 520, cx = [150, 290, 470];
    [1, 2, 3].forEach((n, i) => {
      const w = n * cs, x0 = cx[i] - w / 2;
      figCells(RD.type, n).forEach(([c, r]) => { s += Rc(x0 + c * cs + 2, base - (r + 1) * cs + 2, cs - 4, cs - 4, 7, solid('#E3C27A', 2)); });
      s += txt(cx[i], base + 60, String(nums[i]), 44, { w: 600 });
      s += txt(cx[i], base + 100, 'ke-' + n, 30, { cls: 't-body' });
    });
    s += Rc(590, base - 120, 100, 120, 16, `fill="none" ${ol(3)}`).replace('/>', ' stroke-dasharray="10 8"/>') + txt(640, base - 40, '?', 56, { w: 600 }) + txt(640, base + 100, 'ke-4', 30, { cls: 't-body' });
    G(world, {}, s);
    KS.count = G(world, {});
    // the peg board
    GS.markup(world, Rc(BRD.x - 16, BRD.y - 16, BRD.n * BRD.c + 32, BRD.n * BRD.c + 32, 24, solid(WOOD[0], 3.5)));
    for (let r = 0; r < BRD.n; r++) for (let c = 0; c < BRD.n; c++) {
      const g = G(world, {});
      g.__c = c; g.__r = BRD.n - 1 - r;       // r counted from the bottom
      g.addEventListener('click', () => boardTap(g.__c, g.__r));
      KS.cells.push(g);
      drawPeg(g);
    }
    drawCount();
    KS.ready = () => KS.on.length > 0;
    actionBtn('main', 'Cek', ICO.check, checkBoard);
    updDock();
  }
  const pegOn = (c, r) => KS.on.some(q => q[0] === c && q[1] === r);
  function pegXY(c, r) { return { x: BRD.x + c * BRD.c + BRD.c / 2, y: BRD.y + (BRD.n - 1 - r) * BRD.c + BRD.c / 2 }; }
  function drawPeg(g, mark) {
    g.innerHTML = '';
    const p = pegXY(g.__c, g.__r);
    let s = Rc(p.x - 38, p.y - 38, 76, 76, 14, `fill="${WOOD[2]}" opacity=".55"`);
    if (pegOn(g.__c, g.__r)) s += Rc(p.x - 34, p.y - 40, 68, 76, 16, solid('#E3C27A', 3)) + Rc(p.x - 24, p.y - 32, 12, 60, 6, fill('#F3DFA8', 0.9)) + El(p.x, p.y - 32, 22, 6, fill('#6E4F2A'));
    if (mark) s += Rc(p.x - 42, p.y - 42, 84, 84, 16, `fill="none" stroke="${AMBER}" stroke-width="7"`);
    s += Rc(p.x - BRD.c / 2, p.y - BRD.c / 2, BRD.c, BRD.c, 0, 'fill="transparent" data-hit="peg"');
    GS.markup(g, s);
  }
  function drawCount() { KS.count.innerHTML = ''; GS.markup(KS.count, pill(985, 110, KS.on.length + ' tabung', 38, { w: 220 })); }
  function boardTap(c, r) {
    if (busy) return;
    const i = KS.on.findIndex(q => q[0] === c && q[1] === r);
    if (i >= 0) { KS.on.splice(i, 1); GS.sfx.pop(); } else { KS.on.push([c, r]); noteSound(fOf(noteL(40, Math.min(5, r))), 0.4, 0.2); }
    KS.cells.forEach(g => drawPeg(g));
    drawCount(); updDock();
  }
  function boardMatch(on, type, n) {
    if (!on.length) return false;
    const minC = Math.min.apply(null, on.map(q => q[0])), minR = Math.min.apply(null, on.map(q => q[1]));
    const norm = on.map(q => (q[0] - minC) + ',' + (q[1] - minR));
    const want = figCells(type, n);
    const sets = [want, want.map(([c, r]) => [n - 1 - c, r])];
    return sets.some(w => w.length === norm.length && w.every(([c, r]) => norm.indexOf(c + ',' + r) >= 0));
  }
  async function checkBoard() {
    if (busy) return;
    busy = true; updDock();
    const my = tok;
    const sorted = KS.on.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (let i = 0; i < sorted.length; i++) {
      const p = pegXY(sorted[i][0], sorted[i][1]);
      noteSound(fOf(noteL(40, Math.min(5, sorted[i][1]))), 0.35, 0.12);
      floatAt(String(i + 1), p.x, p.y - 40);
      await wait(Math.max(120, 1600 / sorted.length));
      if (my !== tok) return;
    }
    const want = figCells(RD.type, 4).length;
    if (boardMatch(KS.on, RD.type, 4)) return roundWon(RD.winSay || ('Pola ke-4: ' + want + ' tabung!'), 985, 400);
    fail(KS.on.length !== want ? 'Bentukmu ' + KS.on.length + ' tabung. Lihat lagi cara polanya bertambah.' : 'Jumlahnya ' + KS.on.length + ', tapi bentuknya belum mengikuti pola.');
  }

  /* ================================================================
   * kind: cols (number pattern as stacks of tubes; rule machine n x a + b)
   * ================================================================ */
  const COLX = i => 240 + i * 200;
  const MINI = { w: 30, h: 34, gx: 6, gy: 6 };
  function stackSVG(x, base, n, col) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / 5), c = i % 5;
      const xx = x - 2.5 * (MINI.w + MINI.gx) + c * (MINI.w + MINI.gx) + MINI.gx / 2, yy = base - (r + 1) * (MINI.h + MINI.gy);
      s += Rc(xx, yy, MINI.w, MINI.h, 9, solid(col || '#E3C27A', 2.2)) + Rc(xx + 6, yy + 5, 6, MINI.h - 10, 3, fill('#F3DFA8', 0.9));
    }
    return s;
  }
  function setupCols() {
    bgSanggar();
    const rule = RD.rule === true;
    KS = { vals: RD.terms.map((v, i) => (rule ? 0 : i < RD.given ? v : 0)), a: 1, b: 0, colG: [], rule };
    const base = rule ? 590 : 530;
    KS.base = base;
    let s = '';
    RD.terms.forEach((v, i) => { s += Rc(COLX(i) - 94, base - 300, 188, 316, 18, `fill="${CREAM}" fill-opacity=".55" stroke="${OUT}" stroke-opacity=".3" stroke-width="2"`) + txt(COLX(i), base + 46, 'ke-' + (i + 1), 30, { cls: 't-body' }); });
    G(world, {}, s);
    RD.terms.forEach((v, i) => { KS.colG.push(G(world, {})); });
    if (rule) {
      // the rule machine: term n = n x a + b
      const mg = G(world, {});
      GS.markup(mg, Rc(90, 96, 1100, 118, 30, solid('#FFF3DA', 3)) + txt(250, 170, 'suku ke-n =', 36, { cls: 't-body' }) + txt(402, 170, 'n ×', 40, { w: 600 }) + txt(655, 170, '+', 44, { w: 600 }));
      KS.aG = G(mg, {}); KS.bG = G(mg, {});
      [['a', 455, -1], ['a', 595, 1], ['b', 715, -1], ['b', 855, 1]].forEach(([k, x, d]) => {
        const b = G(mg, {}, Ci(x, 155, 44, solid('#F28C28', 3)) + txt(x, 170, d < 0 ? '−' : '+', 48, { w: 700, decor: true }) + Rc(x - 46, 109, 92, 92, 46, `fill="transparent" data-hit="${k}${d < 0 ? 'm' : 'p'}"`));
        b.addEventListener('click', () => ruleStep(k, d));
      });
      // target numbers above the columns
      RD.terms.forEach((v, i) => { GS.markup(world, pill(COLX(i), 262, i < RD.given ? String(v) : '?', 40, { w: 110, bg: i < RD.given ? '#FFE08A' : CREAM })); });
      KS.res = G(world, {});
      drawRule();
    } else {
      RD.terms.forEach((v, i) => {
        if (i < RD.given) return;
        [[-50, -1], [50, 1]].forEach(([dx, d]) => {
          const b = G(world, {}, Rc(COLX(i) + dx - 46, base + 70, 92, 92, 24, solid(d < 0 ? '#F8B26A' : '#86CC8C', 3)) + txt(COLX(i) + dx, base + 134, d < 0 ? '−' : '+', 56, { w: 700, decor: true }) +
            Rc(COLX(i) + dx - 46, base + 70, 92, 92, 24, `fill="transparent" data-hit="${d < 0 ? 'minus' : 'plus'}"`));
          b.addEventListener('click', () => colStep(i, d));
        });
      });
    }
    RD.terms.forEach((v, i) => drawCol(i));
    KS.ready = () => (rule ? true : KS.vals.every(v => v > 0));
    actionBtn('main', 'Cek', ICO.check, checkCols);
    updDock();
  }
  function drawCol(i, mark) {
    const g = KS.colG[i], v = KS.vals[i], ed = !KS.rule && i >= RD.given;
    g.innerHTML = '';
    let s = stackSVG(COLX(i), KS.base - 8, v, ed || KS.rule ? '#C9D17A' : '#E3C27A');
    if (!KS.rule) s += pill(COLX(i), KS.base - 340, ed ? (v ? String(v) : '?') : String(v), 40, { w: 104, bg: ed ? '#E9F4FB' : '#FFE08A' });
    else s += txt(COLX(i), KS.base + 0 - 316, '', 10);
    if (KS.rule) s += pill(COLX(i), KS.base - 318 + 0, String(v), 34, { w: 90, bg: '#E9F4FB' });
    if (mark) s += Rc(COLX(i) - 98, KS.base - 304, 196, 324, 20, `fill="none" stroke="${AMBER}" stroke-width="8"`);
    GS.markup(g, s);
  }
  function colStep(i, d) {
    if (busy) return;
    const v = clamp(KS.vals[i] + d, 0, 40);
    if (v === KS.vals[i]) { GS.sfx.tick(); return; }
    KS.vals[i] = v;
    if (d > 0) noteSound(fOf(noteL(40, 2)), 0.35, 0.12); else GS.sfx.pop();
    drawCol(i); updDock();
  }
  function drawRule() {
    KS.aG.innerHTML = ''; KS.bG.innerHTML = '';
    GS.markup(KS.aG, Rc(487, 118, 76, 76, 16, solid(CREAM, 3)) + txt(525, 172, String(KS.a), 48, { w: 600 }));
    GS.markup(KS.bG, Rc(747, 118, 76, 76, 16, solid(CREAM, 3)) + txt(785, 172, String(KS.b), 48, { w: 600 }));
    KS.vals = RD.terms.map((v, i) => (i + 1) * KS.a + KS.b);
    RD.terms.forEach((v, i) => drawCol(i));
  }
  function ruleStep(k, d) {
    if (busy) return;
    const lim = k === 'a' ? [1, 6] : [0, 9];
    const v = clamp(KS[k] + d, lim[0], lim[1]);
    if (v === KS[k]) { GS.sfx.tick(); return; }
    KS[k] = v; GS.sfx.tick();
    KS.res.innerHTML = '';
    drawRule(); updDock();
  }
  async function checkCols() {
    if (busy) return;
    busy = true; updDock();
    const my = tok;
    for (let i = 0; i < RD.terms.length; i++) {
      GS.fx(KS.colG[i], 'ak-hl', 380);
      noteSound(fOf(noteL(40, Math.min(5, i))), 0.45, 0.25);
      await wait(380);
      if (my !== tok) return;
    }
    const n = KS.rule ? RD.given : RD.terms.length;
    const bad = range(n).filter(i => KS.vals[i] !== RD.terms[i]);
    if (!bad.length) {
      if (KS.rule) {
        const t10 = 10 * KS.a + KS.b;
        GS.markup(KS.res, pill(640, 740, 'suku ke-10 = 10 × ' + KS.a + ' + ' + KS.b + ' = ' + t10, 36, { cls: 't-body', w: 640, bg: '#E3F3EE' }));
        return roundWon('Rumusnya pas! Suku ke-10 adalah ' + t10 + '.', 640, 300);
      }
      return roundWon(RD.winSay, 900, 300);
    }
    bad.forEach(i => drawCol(i, true));
    if (KS.rule) fail('Suku ke-' + (bad[0] + 1) + ' harus ' + RD.terms[bad[0]] + ', rumusmu memberi ' + KS.vals[bad[0]] + '.');
    else fail('Lihat lagi: tiap langkah bertambah atau berkurang berapa?');
  }

  /* ================================================================
   * round generators (everything random is drawn here, at build time)
   * ================================================================ */
  const LEN7 = [14, 17, 21, 26, 32, 39, 48];
  function gRackSort(n) {
    let idx;
    for (let k = 0; k < 60; k++) {
      idx = shuffle(range(7)).slice(0, n).sort((a, b) => a - b);
      if (idx.every((v, i) => i === 0 || v - idx[i - 1] >= (n <= 3 ? 2 : 1))) break;
    }
    const good = idx.map(i => LEN7[i]).reverse();          // long to short = low to high
    let order;
    do { order = shuffle(good); } while (order.every((v, i) => v === good[i]));
    return { kind: 'rack', mode: 'sort', tubes: order, S: 5.4, say: TK ? 'Urutkan angklung dari bunyi rendah ke tinggi.' : 'Urutkan dari nada rendah ke nada tinggi.', winSay: TK ? 'Rendah, lalu tinggi. Seperti tangga!' : 'Dari rendah ke tinggi. Tabung panjang bunyinya rendah!' };
  }
  function gRackScale() {
    const Ldo = pick([36, 40, 44, 48]), notes = [0, 1, 2, 3, 4];
    let order;
    do { order = shuffle(notes); } while (order.every((v, i) => v === i));
    return { kind: 'rack', mode: 'sort', tubes: order.map(k => noteL(Ldo, k)), notes: order, Ldo, S: 5.4, say: 'Urutkan lima angklung jadi tangga nada, dari rendah ke tinggi.', winSay: 'Tangga nada 1 2 3 5 6: do re mi sol la!' };
  }
  function gRackMid() {
    let lo, hi;
    for (;;) { lo = ri(2, 5); hi = ri(1, lo - 2); if (lo - hi >= 2 && hi >= 1) break; }
    const m = ri(hi + 1, lo - 1);
    const pool = shuffle([LEN7[m], LEN7[ri(lo + 1, 6)], LEN7[ri(0, hi - 1)]]);
    return { kind: 'rack', mode: 'middle', ends: [LEN7[lo], LEN7[hi]], pool, S: 5.4, say: 'Cari angklung yang bunyinya di tengah.', winSay: 'Rendah, tengah, tinggi. Pas!' };
  }
  function gShake(task) {
    return { kind: 'shake', task, L: pick([30, 34, 38]), person: pick([0, 2, 3, 7]),
      say: task === 'soft' ? (TK ? 'Adik tidur. Goyang angklung pelan-pelan.' : 'Adik sedang tidur. Mainkan angklung pelan, tiga kali.') : (TK ? 'Panggil temanmu! Goyang angklung kuat-kuat.' : 'Temanmu jauh di luar. Goyang angklung keras supaya dia dengar.') };
  }
  const PAIRS = [[0, 3], [0, 4], [1, 4], [0, 5], [2, 5]];
  function gSeqCopy() {
    const pr = pick(PAIRS), pat = pick(['ABAB', 'AABB', 'ABBA', 'BABA', 'BBAA', 'ABAA', 'BAAB']);
    const tgt = pat.split('').map(c => (c === 'A' ? pr[0] : pr[1]));
    return { kind: 'seq', mode: 'copy', insts: shuffle(pr), tgt, style: 'sym', say: 'Dengar pola ' + MNAME + ', lalu tiru. Ketuk angklungnya.', winSay: 'Sama persis! Kamu pandai meniru.' };
  }
  function gSeqCont(unit, total, given, style) {
    const letters = []; unit.split('').forEach(c => { if (letters.indexOf(c) < 0) letters.push(c); });
    const notes = shuffle([0, 1, 2, 3, 4, 5]).slice(0, letters.length);
    const tgt = range(total).map(i => notes[letters.indexOf(unit[i % unit.length])]);
    return { kind: 'seq', mode: 'cont', insts: shuffle(notes), tgt, given, style: style || 'sym', unit,
      say: TK ? 'Lanjutkan polanya. Ketuk angklung yang pas.' : 'Pola berulang. Lanjutkan sampai kotak penuh.', winSay: TK ? 'Polanya pas!' : 'Polanya berulang dengan benar!' };
  }
  function melody(len, top) {
    for (let k = 0; k < 80; k++) {
      let p = pick([0, 2]);
      const m = [p];
      for (let i = 1; i < len; i++) {
        const st = pick([-1, 1, 1, -1, 2, -2, 0]);
        p = clamp(p + st, 0, top);
        m.push(p);
      }
      m[len - 1] = pick([0, 3 <= top ? 3 : 0]);
      const distinct = m.filter((v, i) => m.indexOf(v) === i).length;
      let runs = true;
      for (let i = 2; i < len; i++) if (m[i] === m[i - 1] && m[i] === m[i - 2]) runs = false;
      if (distinct >= 3 && runs) return m;
    }
    return range(len).map(i => i % (top + 1));
  }
  function gSeqSong(len, card, top) {
    const insts = range(top + 1);
    return { kind: 'seq', mode: 'song', insts, tgt: melody(len, top), style: 'num', card, Ldo: 40,
      say: card === 'bare' ? 'Baca not angkanya, lalu mainkan lagunya.' : 'Mainkan lagu ini. Ketuk angklung sesuai warna dan angkanya.', winSay: 'Lagunya pas! Merdu sekali.' };
  }
  function gHold(phase) {
    const notes = shuffle([0, 1, 2, 3, 4]).slice(0, 3).sort((a, b) => a - b);
    if (phase === 'stop') return { kind: 'hold', notes, startDamped: false, say: 'Adik mau tidur. Pegang dan bungkus angklung supaya berhenti bergetar.' };
    const want = shuffle([0, 1, 2]).slice(0, 2).sort();
    return { kind: 'hold', notes, startDamped: true, want, say: 'Buka bungkus angklung ' + want.map(i => NOTE[notes[i]].word).join(' dan ') + ' saja.' };
  }
  function gGridCount(N) {
    return { kind: 'grid', mode: 'count', n: 10, per: 10, sub: 1, tracks: [], given: [], N, edit: 'ak', head: 'Dengar kentongan. Buat bunyi sama banyak.', say: 'Hitung bunyi kentongan. Taruh angklung sama banyak.' };
  }
  function multiples(step, n, start) { const out = []; for (let v = start || step; v <= n; v += step) out.push(v - 1); return out; }
  function gGridSkip(step, n, start, nGiven, o) {
    o = o || {};
    const target = multiples(step, n, start);
    const per = n <= 12 ? n : n === 20 ? 10 : 12;
    const st = start || step;
    const head = o.head || (st === step ? 'Angklung berbunyi tiap ' + step + ' ketukan.' : 'Gong: ketukan ' + st + ', lalu tiap ' + step + ' ketukan.');
    return { kind: 'grid', mode: 'set', n, per, sub: 1, tracks: [], given: target.slice(0, nGiven), target, edit: o.edit || 'ak', head,
      say: o.say || head + ' Lengkapi polanya.', winSay: o.winSay || ((st === step ? '' : '') + target.map(c => c + 1).join(', ') + '. Polanya pas!') };
  }
  const RHY = { 2: [[2], [1, 1]], 4: [[4], [2, 2], [2, 1, 1], [1, 1, 2], [1, 1, 1, 1]] };
  const DUR = { 2: { 2: '1', 1: '½', 4: '2' }, 4: { 4: '1', 2: '½', 1: '¼' } };
  function gGridOnset(sub, beats, aligned) {
    let parts;
    for (let k = 0; k < 40; k++) {
      parts = [];
      for (let b = 0; b < beats; b++) parts = parts.concat(pick(RHY[sub]));
      const kinds = parts.filter((v, i) => parts.indexOf(v) === i).length;
      if (kinds >= 2 && parts.length > beats && parts.length < beats * sub) break;
    }
    const target = []; let on = 0;
    const seg = parts.map((len, i) => { const s = { on, len, i, label: DUR[sub][len] }; target.push(on); on += len; return s; });
    const per = sub === 2 ? 8 : 8;
    return { kind: 'grid', mode: 'onset', n: beats * sub, per, sub, tracks: [], given: [], target, edit: 'ak', durTrack: aligned ? seg : null, chips: aligned ? null : seg.map(s => s.label),
      head: sub === 2 ? 'Tiap ketukan dibagi dua: ½ ketukan.' : 'Tiap ketukan dibagi empat: ¼ ketukan.',
      say: aligned ? 'Taruh angklung di awal setiap bunyi pada kartu.' : 'Baca kartu irama. Taruh angklung di awal setiap bunyi.', winSay: 'Iramanya pas dengan kartu!' };
  }
  function gGridKpk(a, b, show, n, all) {
    n = n || 24;
    const tA = multiples(a, n), tB = multiples(b, n);
    const common = tA.filter(c => tB.indexOf(c) >= 0);
    return { kind: 'grid', mode: 'set', n, per: 12, sub: 1, single: !all, edit: 'gong',
      tracks: [{ hits: tA, show }, { hits: tB, show }], given: [], target: all ? common : [common[0]],
      head: 'Merah tiap ' + a + ', hijau tiap ' + b + ' ketukan.',
      say: all ? 'Pukul gong setiap kali merah dan hijau berbunyi bersama.' : show ? 'Pukul gong saat merah dan hijau pertama kali bertemu.' : 'Tanpa titik! Kapan merah dan hijau pertama kali bertemu?',
      winSay: all ? 'Mereka bertemu di ' + common.map(c => c + 1).join(' dan ') + ': kelipatan ' + lcm(a, b) + '.' : 'Bertemu di ketukan ' + lcm(a, b) + '. KPK ' + a + ' dan ' + b + ' adalah ' + lcm(a, b) + '!' };
  }
  function gGridKpk3(trip, show) {
    const n = 24, [a, b, c] = trip;
    const T = trip.map(s => multiples(s, n));
    const common = T[0].filter(x => T[1].indexOf(x) >= 0 && T[2].indexOf(x) >= 0);
    const L = lcm(lcm(a, b), c);
    return { kind: 'grid', mode: 'set', n, per: 12, sub: 1, single: true, edit: 'gong', tracks: T.map(h => ({ hits: h, show })), given: [], target: [common[0]],
      head: 'Merah ' + a + ', hijau ' + b + ', biru ' + c + ' ketukan.', say: 'Tiga angklung. Pukul gong saat ketiganya pertama kali bertemu.', winSay: 'Ketiganya bertemu di ketukan ' + L + '!' };
  }
  function gCut(type) {
    let Lref, target, say, winSay, refLabel, o = {};
    if (type === 'up') { Lref = 2 * ri(12, 26); target = Lref / 2; say = 'Buat tabung satu oktaf lebih tinggi dari tabung ' + Lref + ' cm.'; winSay = 'Setengah panjangnya, satu oktaf lebih tinggi!'; o.octLines = true; }
    else if (type === 'down') { Lref = 2 * ri(7, 14); target = Lref * 2; say = 'Buat tabung satu oktaf lebih rendah dari tabung ' + Lref + ' cm.'; winSay = 'Dua kali panjangnya, satu oktaf lebih rendah!'; o.octLines = true; }
    else if (type === 'sol') { Lref = 3 * ri(9, 19); target = Lref * 2 / 3; refLabel = 'do ' + Lref + ' cm'; say = 'Tabung sol panjangnya 2/3 dari tabung do. Potong tabung sol.'; winSay = 'Panjang 2 : 3, getaran 3 : 2. Itu nada sol!'; }
    else if (type === 'fa') { Lref = 4 * ri(7, 14); target = Lref * 3 / 4; refLabel = 'do ' + Lref + ' cm'; say = 'Tabung fa panjangnya 3/4 dari tabung do. Potong tabung fa.'; winSay = 'Panjang 3 : 4, getaran 4 : 3. Itu nada fa!'; }
    else if (type === 'mi') { Lref = 5 * ri(6, 11); target = Lref * 4 / 5; refLabel = 'do ' + Lref + ' cm'; say = 'Tabung mi panjangnya 4/5 dari tabung do. Potong tabung mi.'; winSay = 'Panjang 4 : 5, getaran 5 : 4. Itu nada mi!'; }
    else if (type === 'dua') { Lref = 4 * ri(9, 14); target = Lref / 4; say = 'Buat tabung dua oktaf lebih tinggi dari tabung ' + Lref + ' cm.'; winSay = 'Setengah dari setengah: 1/4 panjangnya!'; }
    else if (type === 'solhi') { Lref = 3 * ri(11, 19); target = Lref / 3; refLabel = 'do ' + Lref + ' cm'; say = 'Buat sol satu oktaf di atas sol biasa. Sol biasa 2/3 dari do.'; winSay = '2/3 lalu 1/2: jadi 1/3 panjang do!'; }
    else if (type === 'hz') {
      const k = pick([2, 3, 4]); Lref = 12 * ri(3, 5); target = Lref / k; o.hz = true;
      say = 'Tabung ' + Lref + ' cm bergetar ' + Math.round(KT / Lref) + ' kali per detik. Buat yang bergetar ' + k + ' kali lebih cepat.'; winSay = 'Getaran ' + k + ' kali lebih cepat, panjangnya 1/' + k + '!';
    } else {           // hzdown: 2/3 as fast -> 3/2 as long
      Lref = 2 * ri(8, 18); target = Lref * 3 / 2; o.hz = true;
      say = 'Tabung ' + Lref + ' cm bergetar ' + Math.round(KT / Lref) + ' kali per detik. Buat yang getarannya 2/3 kalinya.'; winSay = 'Getaran 2/3 kali, panjangnya 3/2 kali!';
    }
    return Object.assign({ kind: 'cut', type, Lref, target, Lmax: 60, start: target > 30 ? 12 : 48, refLabel, say, winSay }, o);
  }
  function gPhone(towel) {
    const person = pick([0, 2, 3, 7]);
    if (towel) return { kind: 'phone', towel: true, fx: PH.ax + PH.len + 60, person, say: 'Benangnya sudah tegang, tapi ada handuk. Kirim bunyi ke temanmu.', winSay: 'Benang bebas bergetar, bunyinya sampai!' };
    return { kind: 'phone', towel: false, fx: null, start: PH.ax + PH.len - 170, person, say: 'Kirim bunyi angklung lewat telepon kaleng ke temanmu.', winSay: 'Benang tegang ikut bergetar. Bunyinya sampai!' };
  }
  function gDist(mode, t) {
    if (mode === 'echo') { const d = 170 * t; return { kind: 'dist', mode, t, d, maxD: 800, flag0: 400 === d ? 300 : 400, say: 'Pukul kentongan. Dengar gemanya dari tebing di balik kabut.' }; }
    const d = 340 * t;
    return { kind: 'dist', mode, t, d, maxD: 1200, flag0: d === 600 ? 400 : 600, say: 'Ada petir di balik kabut. Hitung waktu sampai guruh terdengar.' };
  }
  function gBoard(type) { return { kind: 'board', type, say: 'Lihat polanya. Buat susunan ke-4 di papan.', winSay: type === 'tri' ? '1, 3, 6, 10. Tiap kali bertambah satu kolom!' : type === 'sq' ? '1, 4, 9, 16. Persegi yang makin besar!' : 'Polanya pas!' }; }
  function gCols(kind) {
    let terms, say;
    if (kind === 'add') { const st = ri(1, 3), d = pick([2, 3, 4, 5]); terms = range(5).map(i => st + i * d); say = 'Pola bertambah. Buat dua tumpukan berikutnya.'; }
    else if (kind === 'sub') { const d = pick([2, 3]), st = d * 4 + ri(2, 4); terms = range(5).map(i => st - i * d); say = 'Pola berkurang. Buat dua tumpukan berikutnya.'; }
    else if (kind === 'dbl') { const st = pick([1, 2]); terms = range(5).map(i => st * Math.pow(2, i)); say = 'Tiap langkah jadi dua kali. Buat dua tumpukan berikutnya.'; }
    else { const st = pick([1, 2]); terms = [st]; for (let i = 1; i < 5; i++) terms.push(terms[i - 1] + i); say = 'Tambahnya makin besar: 1, 2, 3. Buat dua tumpukan berikutnya.'; }
    return { kind: 'cols', terms, given: 3, say, winSay: terms.join(', ') + '. Polanya pas!' };
  }
  function gRule() {
    const a = ri(2, 5), b = ri(0, 5);
    return { kind: 'cols', rule: true, terms: range(5).map(i => (i + 1) * a + b), given: 4, a, b, say: 'Atur rumus mesin supaya tumpukannya sama dengan angka di atas.' };
  }

  /* ================= levels per tier (docs/baru/angklung.md) ================= */
  const lv = (win, ...rounds) => ({ win, rounds });
  const BY_TIER = {
    tk: [
      () => lv('Rendah ke tinggi, kamu bisa!', () => gRackSort(3), () => gRackSort(3)),
      () => lv('Keras dan pelan, kamu bisa!', ...shuffle([() => gShake('soft'), () => gShake('loud')])),
      () => lv('Tangga tiga nada!', () => gRackMid(), () => gRackMid()),
      () => lv('Kamu pandai meniru!', () => gSeqCopy(), () => gSeqCopy()),
      () => lv('Polanya berlanjut!', () => gSeqCont('AB', 6, 4), () => gSeqCont(pick(['AAB', 'ABB']), 9, 6)),
      () => lv('Tantangan selesai!', () => gRackSort(4), () => gSeqCont('ABC', 6, 3))
    ],
    k1: [
      () => lv('Tangga nadamu merdu!', () => gRackScale()),
      () => lv('Pola berulang, hebat!', () => gSeqCont('ABC', 9, 5), () => gSeqCont(pick(['ABB', 'AAB', 'ABCC', 'AABC']), 8, 5)),
      () => lv('Pintar menghitung bunyi!', () => gGridCount(ri(4, 6)), () => gGridCount(ri(7, 9))),
      () => lv('Lagumu merdu!', () => gSeqSong(5, 'num', 4), () => gSeqSong(6, 'num', 4)),
      () => lv('Bunyi datang dari getaran!', () => gHold('stop'), () => gHold('pick')),
      () => lv('Lompat dua, lompat lima!', () => (Math.random() < 0.5 ? gGridSkip(2, 12, 2, 2) : gGridSkip(2, 12, 1, 2, { head: 'Angklung: 1, 3, ... lompat 2.' })), () => gGridSkip(5, 20, 5, 1)),
      () => lv('Campuran selesai!', () => gSeqCont(pick(['ABC', 'ABB']), 9, 5), () => gRackSort(4), () => gGridSkip(2, 12, 2, 1)),
      () => lv('Tantangan selesai!', () => gSeqSong(7, 'num', 4), () => gGridSkip(5, 20, 5, 0, { head: 'Angklung berbunyi tiap 5 ketukan.' }), () => gHold('pick'))
    ],
    k2: [
      () => lv('Bunyi merambat lewat benang!', () => gPhone(false), () => gPhone(true)),
      () => lv('Kelipatan berirama!', ...shuffle([3, 4, 6]).slice(0, 2).map(s => () => gGridSkip(s, 24, s, 1))),
      () => lv('Oktaf: setengah dan dua kali!', () => gCut('up'), () => gCut('down')),
      () => lv('Kamu bisa membaca not angka!', () => gSeqSong(7, 'bare', 5), () => gSeqSong(8, 'bare', 5)),
      () => lv('Setengah ketukan, pas!', () => gGridOnset(2, 4, true), () => gGridOnset(2, 4, false)),
      () => lv('Pola bilangan, hebat!', () => gCols('add'), () => gCols('sub')),
      () => lv('Campuran selesai!', () => gGridSkip(pick([3, 4]), 24, null, 1), () => gSeqSong(7, 'bare', 5), () => gCut('up')),
      () => lv('Tantangan selesai!', () => gGridOnset(2, 4, false), () => gCols(pick(['add', 'sub'])), () => gCut('down'))
    ],
    k3: [
      () => lv('Perbandingan nada!', () => gCut('sol'), () => gCut(pick(['fa', 'mi']))),
      () => lv('Seperempat ketukan, pas!', () => gGridOnset(4, 4, true), () => gGridOnset(4, 4, false)),
      () => lv('Pola tumbuh!', () => gBoard('tri'), () => gBoard('sq')),
      () => lv('Pola gong berirama!', () => gGridSkip(3, 24, 1, 2), () => gGridSkip(4, 24, pick([1, 2]), 2)),
      () => lv('Pecahan dari pecahan!', () => gCut('dua'), () => gCut('solhi')),
      () => lv('Pola kali dan tambah!', () => gCols('dbl'), () => gCols('grow')),
      () => lv('Campuran selesai!', () => gCut(pick(['sol', 'fa'])), () => gGridSkip(pick([3, 4]), 24, 1, 2), () => gBoard('tri')),
      () => lv('Tantangan selesai!', () => gGridOnset(4, 4, false), () => gCut(pick(['dua', 'solhi'])), () => gCols(pick(['dbl', 'grow'])))
    ],
    k4: [
      () => lv('KPK lewat irama!', () => gGridKpk(...pick([[2, 3], [3, 4], [2, 5], [4, 6]]), true), () => gGridKpk(...pick([[3, 5], [4, 5], [6, 8], [3, 8], [2, 7]]), false)),
      () => lv('Rumus pola, hebat!', () => gRule(), () => gRule()),
      () => lv('Gema mengukur jarak!', ...shuffle([1, 2, 3, 4]).slice(0, 2).map(t => () => gDist('echo', t))),
      () => lv('Petir dan guruh!', ...shuffle([1, 1.5, 2, 2.5, 3]).slice(0, 2).map(t => () => gDist('thunder', t))),
      () => lv('Tiga irama bertemu!', () => gGridKpk3(pick([[2, 3, 4], [3, 4, 6], [2, 4, 6], [2, 3, 8], [4, 6, 8], [3, 6, 8]]), true), () => gGridKpk(...pick([[2, 3], [3, 4], [4, 6], [2, 5], [3, 6]]), true, 24, true)),
      () => lv('Getaran dan panjang tabung!', () => gCut('hz'), () => gCut('hzdown')),
      () => lv('Campuran selesai!', () => gGridKpk(...pick([[3, 4], [4, 6], [6, 8]]), false), () => gDist('echo', pick([1, 2, 3, 4])), () => gRule()),
      () => lv('Tantangan selesai!', () => gGridKpk3(pick([[2, 3, 8], [3, 4, 6], [4, 6, 8]]), false), () => gDist('thunder', pick([1.5, 2.5, 3])), () => gCut(pick(['hz', 'hzdown'])))
    ]
  };
  const LEVELS = BY_TIER[TIER] || BY_TIER.k1;

  /* ================= flow ================= */
  const hud = GS.hud({ gameId: GAME, title: 'Angklung Ajaib', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: i => buildLevel(i), demo: demoSpec });
  if (GS.speakable && !GS.speakable.__ak) {
    const base = GS.speakable;
    GS.speakable = t => base(String(t).replace(/(\d)\s*cm\b/g, '$1 sentimeter').replace(/(\d)\s*m\b/g, '$1 meter').replace(/(\d)\s*Hz\b/g, '$1 hertz').replace(/(\d+)\s*:\s*(\d+)/g, '$1 banding $2'));
    GS.speakable.__ak = true;
  }
  const sigOf = rd => JSON.stringify(rd, (k, v) => (k === 'say' || k === 'winSay' || k === 'person' ? undefined : v));
  let demoSig = '', kidSig = '';
  const NATIVE_RANDOM = Math.random;
  const seededNow = () => Math.random !== NATIVE_RANDOM || !!(GS.race && GS.race.active);
  function makeRounds(lvl) {
    const rds = [];
    lvl.rounds.forEach(f => {
      let rd;
      for (let n = 0; n < 10; n++) { rd = f(); if (!rds.some(q => sigOf(q) === sigOf(rd))) break; }
      rds.push(rd);
    });
    lvl.rds = rds;
    return rds;
  }
  function buildLevel(i, demo) {
    tok++;
    DEMO = !!demo;
    document.querySelectorAll('.gs-overlay.gs-win').forEach(o => o.remove());
    const avoid = DEMO ? kidSig : demoSig, seeded = seededNow();
    let rd;
    for (let n = 0; n < 16; n++) { LV = LEVELS[i](); rd = makeRounds(LV)[0]; if (sigOf(rd) !== avoid || (seeded && !DEMO)) break; }
    if (DEMO) demoSig = sigOf(rd); else kidSig = sigOf(rd);
    tries = 0;
    startRound(0);
  }
  const SETUP = { rack: setupRack, seq: setupSeq, shake: setupShake, hold: setupHold, grid: setupGrid, cut: setupCut, phone: setupPhone, dist: setupDist, board: setupBoard, cols: setupCols };
  function startRound(ri) {
    tok++;
    RI = ri; rTries = 0; busy = false; solving = false;
    clearStage();
    RD = LV.rds[ri];
    SETUP[RD.kind]();
    hud.mood('think');
    if (!DEMO) {
      GS.say(RD.say);
      const my = tok;
      if (RD.kind === 'seq' && RD.mode !== 'cont') setTimeout(() => { if (my === tok && !busy && !GS.demo.active) playModel(); }, ms(TK ? 2600 : 2200));
      if (RD.kind === 'grid' && RD.mode === 'count') setTimeout(() => { if (my === tok && !busy && !GS.demo.active) playKent(); }, ms(2200));
    }
  }

  /* ================= worked examples (GS.demo, SOP docs/CONTOH.md) =================
   * Chuppy plays the first round of the level with other numbers through the real handlers:
   * drags angklung between rack slots, taps angklung into the strip, swings the angklung,
   * taps beat cells, drags the saw knob, the friend, the flag, and taps the + / - buttons. */
  const DK = {
    tk: [['urut', 1], ['keras', 1], ['tengah', 1], ['tiru', 1], ['lanjut', 1], ['tantangan', 0]],
    k1: [['tangga', 1], ['pola', 1], ['hitung', 1], ['lagu', 1], ['getar', 1], ['lompat', 1], ['campuran', 0], ['tantangan', 0]],
    k2: [['telepon', 1], ['kelipatan', 1], ['oktaf', 1], ['notasi', 1], ['setengah', 1], ['polaangka', 1], ['campuran', 0], ['tantangan', 0]],
    k3: [['rasio', 1], ['seperempat', 1], ['tumbuh', 1], ['birama', 1], ['duaoktaf', 1], ['polakali', 1], ['campuran', 0], ['tantangan', 0]],
    k4: [['kpk', 1], ['rumus', 1], ['gema', 1], ['petir', 1], ['kpk3', 1], ['frekuensi', 1], ['campuran', 0], ['tantangan', 0]]
  };
  function demoSpec(i) {
    const k = (DK[TIER] || DK.k1)[i] || ['L' + (i + 1), 0];
    return { key: k[0], auto: !!k[1], build: () => buildLevel(i, true), script: demoScript };
  }
  const MAIN = '#ak-main', ALT = '#ak-alt';
  async function demoScript(d) {
    await d.wait(500);
    const k = RD.kind;
    if (k === 'rack') await demoRack(d);
    else if (k === 'seq') await demoSeq(d);
    else if (k === 'shake') await demoShake(d);
    else if (k === 'hold') await demoHold(d);
    else if (k === 'grid') await demoGrid(d);
    else if (k === 'cut') await demoCut(d);
    else if (k === 'phone') await demoPhone(d);
    else if (k === 'dist') await demoDist(d);
    else if (k === 'board') await demoBoard(d);
    else if (k === 'cols') await demoCols(d);
    await d.success(60000);
  }
  const grabPt = it => () => ({ x: (it.cx == null ? KS.pos[it.at].x : it.cx), y: FLOOR - it.H * 0.5 - 30 });
  async function demoRack(d) {
    if (RD.mode === 'middle') {
      await d.say('Kiri rendah, kanan tinggi. Cari yang di tengah.');
      const lo = KS.items[0].f, hi = KS.items[1].f;
      const it = KS.items.find(q => q.at >= 3 && q.f > lo && q.f < hi);
      await d.tap(grabPt(it));
      await d.drag(grabPt(it), { x: KS.pos[1].x, y: FLOOR - 160 }, 1200);
      await d.wait(400);
    } else {
      await d.say(TK ? 'Tabung panjang, bunyinya rendah.' : 'Tabung panjang bunyinya rendah. Taruh di kiri.');
      const want = KS.items.slice().sort((a, b) => a.f - b.f);
      for (let i = 0; i < want.length; i++) {
        const it = want[i];
        if (it.at === i) continue;
        await d.drag(grabPt(it), { x: KS.pos[i].x, y: FLOOR - 160 }, 1000);
        await d.wait(450);
      }
    }
    await d.say(TK ? 'Sekarang mainkan.' : 'Dengar: naik seperti tangga.', 900);
    await d.tap(MAIN);
  }
  async function demoSeq(d) {
    const instPt = k => () => { const it = KS.insts.find(q => q.k === k); return { x: it.x, y: FLOOR - it.H * 0.5 - 30 }; };
    if (RD.mode === 'copy') await d.say('Dengar dan lihat polanya. Lalu ketuk yang sama.');
    else if (RD.mode === 'cont') await d.say(TK ? 'Polanya berulang. Apa berikutnya?' : 'Cari bagian yang berulang, lalu lanjutkan.');
    else await d.say(RD.card === 'bare' ? 'Baca angkanya satu per satu.' : 'Cocokkan warna dan angkanya.');
    for (let i = 0; i < RD.tgt.length; i++) {
      if (KS.slots[i].val != null) continue;
      await d.tap(instPt(RD.tgt[i]));
    }
    await d.tap(MAIN);
  }
  async function demoShake(d) {
    const c = { x: KS.AX, y: FLOOR - KS.H * 0.5 - 30 };
    const P = dx => ({ x: c.x + dx, y: c.y });
    if (KS.soft) {
      await d.say(TK ? 'Goyang sedikit saja. Pelan.' : 'Ayunan kecil, bunyinya pelan.');
      await d.path([P(0), P(36), P(-34), P(36), P(-34), P(36), P(0)], 3200);
    } else {
      await d.say(TK ? 'Goyang jauh ke kiri dan kanan. Keras!' : 'Ayunan besar, bunyinya keras.');
      await d.path([P(0), P(140), P(-140), P(140), P(0)], 2200);
    }
  }
  async function demoHold(d) {
    const pt = i => () => { const it = KS.items[i]; return { x: it.x, y: 640 - it.H * 0.5 - 30 }; };
    if (!KS.want) {
      await d.say('Kain menahan tabung, getarannya berhenti.');
      for (let i = 0; i < KS.items.length; i++) await d.tap(pt(i));
    } else {
      await d.say('Buka kainnya, tabung bergetar lagi.');
      for (const i of KS.want) await d.tap(pt(i));
    }
  }
  async function demoGrid(d) {
    const g = RD;
    if (g.mode === 'count') {
      await d.say('Dengar dan hitung bunyinya.');
      await d.tap(ALT);
      await d.wait(g.N * 620 + 300);
      await d.say(g.N + ' kali. Taruh ' + g.N + ' angklung.');
      for (let i = 0; i < g.N; i++) await d.tap(() => cellPos(i));
    } else {
      if (g.single) await d.say('Cari ketukan yang ada merah' + (g.tracks.length > 2 ? ', hijau, dan biru.' : ' dan hijau.'));
      else if (g.mode === 'onset') await d.say('Bunyi pertama di ketukan 1. Lalu tambahkan panjangnya.');
      else await d.say('Lompat sama jauh, lalu ketuk.');
      for (const c of g.target) if (KS.hits.indexOf(c) < 0) await d.tap(() => cellPos(c));
    }
    await d.tap(MAIN);
  }
  async function demoCut(d) {
    const R = RD;
    const line1 = { up: 'Satu oktaf lebih tinggi: setengah panjangnya.', down: 'Satu oktaf lebih rendah: dua kali panjangnya.', sol: 'Sol: 2/3 dari panjang do.', fa: 'Fa: 3/4 dari panjang do.', mi: 'Mi: 4/5 dari panjang do.', dua: 'Dua oktaf: setengah dari setengah.', solhi: '2/3 lalu setengah, jadi 1/3.', hz: 'Getaran lebih cepat, tabung lebih pendek.', hzdown: 'Getaran lebih lambat, tabung lebih panjang.' }[R.type];
    await d.say(line1);
    await d.say(R.Lref + ' cm jadi ' + R.target + ' cm.', 1400);
    await d.drag(() => ({ x: CX0 + KS.cutL * KS.U, y: CY.knob }), () => ({ x: CX0 + R.target * KS.U, y: CY.knob }), 1400);
    await d.tap(MAIN);
  }
  async function demoPhone(d) {
    await d.say('Benangnya kendur. Tarik sampai tegang.');
    await d.drag(() => ({ x: KS.fxNow, y: 520 }), () => ({ x: KS.max + 40, y: 520 }), 1400);
    await d.tap(MAIN);
  }
  async function demoDist(d) {
    await d.tap(ALT);
    await d.wait(RD.t * 1000 + 500);
    await d.say(RD.mode === 'echo' ? 'Bolak-balik ' + dec(RD.t) + ' detik. Pergi saja ' + dec(RD.t / 2) + ' detik.' : 'Guruh ' + dec(RD.t) + ' detik. 340 meter tiap detik.');
    await d.say((RD.mode === 'echo' ? '340 × ' + dec(RD.t / 2) : '340 × ' + dec(RD.t)) + ' = ' + RD.d + ' m.', 1500);
    await d.drag(() => ({ x: KS.X(KS.flagD), y: DAY - 120 }), () => ({ x: KS.X(RD.d), y: DAY - 120 }), 1400);
    await d.tap(MAIN);
  }
  async function demoBoard(d) {
    await d.say(RD.type === 'tri' ? 'Tiap kali tambah satu kolom yang lebih tinggi.' : 'Tiap kali perseginya lebih besar.');
    for (const [c, r] of figCells(RD.type, 4)) await d.tap(() => pegXY(c, r));
    await d.tap(MAIN);
  }
  async function demoCols(d) {
    if (KS.rule) {
      await d.say('Tiap langkah bertambah ' + RD.a + '. Jadi n × ' + RD.a + '.');
      for (let k = KS.a; k < RD.a; k++) await d.tap({ x: 595, y: 155 });
      await d.say('Lalu tambah ' + RD.b + ' supaya suku pertama ' + RD.terms[0] + '.');
      for (let k = KS.b; k < RD.b; k++) await d.tap({ x: 855, y: 155 });
    } else {
      const df = RD.terms[1] - RD.terms[0];
      await d.say(RD.terms[2] === RD.terms[1] * 2 && RD.terms[1] === RD.terms[0] * 2 ? 'Tiap langkah jadi dua kali.' : df === RD.terms[2] - RD.terms[1] ? 'Tiap langkah ' + (df > 0 ? 'tambah ' : 'kurang ') + Math.abs(df) + '.' : 'Tambahnya bertambah satu.');
      for (let i = RD.given; i < RD.terms.length; i++) for (let k = 0; k < RD.terms[i]; k++) await d.tap({ x: COLX(i) + 50, y: KS.base + 116 });
    }
    await d.tap(MAIN);
  }

  /* ================= test hook: solve() plays the current round through the real code paths ================= */
  async function solve() {
    if (busy || solving || !RD) return;
    solving = true;
    const my = tok;
    try {
      const k = RD.kind;
      if (k === 'rack') {
        if (RD.mode === 'middle') { const lo = KS.items[0].f, hi = KS.items[1].f; const it = KS.items.find(q => q.at >= 3 && q.f > lo && q.f < hi); rackDrop(it, KS.pos[1].x); }
        else KS.items.slice().sort((a, b) => a.f - b.f).forEach((it, i) => { if (it.at !== i) rackDrop(it, KS.pos[i].x); });
        await wait(400);
        if (my === tok) await playRack();
      } else if (k === 'seq') {
        for (let i = 0; i < RD.tgt.length; i++) if (KS.slots[i].val !== RD.tgt[i] && !KS.slots[i].locked) { KS.slots[i].val = null; }
        for (let i = 0; i < RD.tgt.length; i++) if (KS.slots[i].val == null) seqTap(KS.insts.findIndex(q => q.k === RD.tgt[i]));
        await checkSeq();
      } else if (k === 'shake') {
        if (KS.soft) { for (let i = 0; i < 3; i++) { shakeStrike(0.2); await wait(200); } } else shakeStrike(1);
      } else if (k === 'hold') {
        KS.items.forEach((it, i) => { const want = KS.want ? KS.want.indexOf(i) < 0 : true; if (it.damped !== want && !busy) holdTap(i); });
      } else if (k === 'grid') {
        if (RD.mode === 'count') { KS.hits = []; range(RD.N).forEach(c => gridTap(c)); }
        else { KS.hits.filter(c => RD.target.indexOf(c) < 0 && KS.locked.indexOf(c) < 0).forEach(c => gridTap(c)); RD.target.forEach(c => { if (KS.hits.indexOf(c) < 0) gridTap(c); }); }
        await checkGrid();
      } else if (k === 'cut') {
        if (KS.blankL <= RD.target) { KS.blankL = RD.Lmax; drawBlank(); }
        KS.cutL = RD.target; drawKnob(); updDock();
        await doCut();
      } else if (k === 'phone') {
        if (KS.towel) { KS.twX = KS.fxNow - 20; KS.twY = PH.y + 260; KS.towel = false; drawTowel(); phoneString(); }
        if (RD.fx == null) phoneFriend(KS.max);
        await sendPhone();
      } else if (k === 'dist') {
        if (!KS.heard) await listenDist();
        if (my !== tok) return;
        setFlag(RD.d);
        await checkDist();
      } else if (k === 'board') {
        KS.on = figCells(RD.type, 4).map(q => q.slice());
        KS.cells.forEach(g => drawPeg(g)); drawCount(); updDock();
        await checkBoard();
      } else if (k === 'cols') {
        if (KS.rule) { KS.a = RD.a; KS.b = RD.b; drawRule(); }
        else RD.terms.forEach((v, i) => { if (i >= RD.given) { KS.vals[i] = v; drawCol(i); } });
        updDock();
        await checkCols();
      }
    } finally { if (my === tok) solving = false; }
  }
  window.__game = {
    go: i => run.go(i),
    solve,
    count: () => LEVELS.length,
    speed: n => { SPEED = Math.max(1, +n || 1); },
    tier: TIER,
    get state() { return { level: run.current, round: RI, rounds: LV ? LV.rds.length : 0, kind: RD && RD.kind, tries, busy }; },
    task: () => (LV && LV.rds ? LV.rds.map(sigOf).join('\n') : ''),
    fOf
  };
  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
