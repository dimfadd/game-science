/* Wayang Bayangan (wayang)
 * A shadow-puppet stage seen from the side: the blencong lamp (a point light) hangs at the left,
 * the kelir (white screen) stands at the right and the child moves the wayang between them.
 * The kelir is also drawn face-on, as a tall panel, so the shadow the audience sees is visible.
 *
 * Truthful geometry (straight rays from a point source), used for every shadow in the game:
 *   lamp L = (lx, ly), kelir plane x = SX, puppet point P = (px, py).
 *   The ray from L through P meets the kelir at  y' = ly + (py - ly) * (SX - lx) / (px - lx).
 *   So the shadow is the silhouette scaled by  m = (SX - lx) / (px - lx)  about the lamp axis:
 *   shadow height = puppet height * m. A puppet behind the lamp (px <= lx) or outside the lamp's
 *   cone casts nothing on the kelir. Depth (across the screen) scales by the same m, so the shadow
 *   keeps the puppet's shape; a puppet turned in its own plane gives a shadow turned the same angle.
 * Big lamp: the flame is a disc of radius r. Every source point S = L + (u, v) gives the same m and a
 *   shadow shifted by -(m - 1) * (u, v); the lamp is sampled as 19 point lights, so umbra and penumbra
 *   edges are exact: penumbra width = 2r * (m - 1) (sharp close to the kelir, blurry close to the lamp).
 * Materials: opaque (kulit, karton, kayu, daun) give a dark shadow, translucent (kertas minyak,
 *   kain tipis) a faint one, transparent (plastik bening, kaca) almost none. The carved holes of a
 *   wayang kulit let light through, so they show as light dots in its shadow.
 * Two lamps: each casts its own shadow; where both are blocked it is darkest. Coloured lamps: the
 *   shadow of one lamp is lit only by the other one, so it takes that lamp's colour (multiply blend).
 * Mirrors: the reflected ray is d' = d - 2 (d . n) n, so angle of incidence = angle of reflection.
 * Sun (outdoor level): parallel rays, so height / shadow is the same for the stick and the tree.
 * Feedback comes from the stage: the shadow misses the dashed outline, the beam stops on the curtain.
 * Nothing is snapped onto the answer. The only snapping is the stated grid: rotation 15 deg (TK, k1)
 * or 5 deg, the 10 cm kelir ruler, the 0.1 m floor ruler, the tape measure's 0.5 m and 1 deg mirrors. */
(function () {
  'use strict';
  const GAME = 'wayang';
  const TIER = (window.GS && GS.tier) ? GS.tier() : 'k1';   // tk | k1 | k2 | k3 | k4
  const OUT = '#3B2A20', INK = '#2B1D14', CREAM = '#FFF8EC';
  /* ---- layout (canvas units, 1280 x 800 design area) ---- */
  const SX = 880;                                    // kelir plane in the side view
  const KX0 = 880, KX1 = 1220, KY0 = 70, KY1 = 630;  // kelir face, as the audience sees it
  const PCX = (KX0 + KX1) / 2;                       // where the lamp axis meets the kelir face
  const LY0 = 340;                                   // usual lamp height
  const FOOT = 520;                                  // measuring levels: flame and wayang feet
  const UM = 220;                                    // measuring levels: 1 m = 220 units (lamp to kelir 3 m)
  const RACK = 690;                                  // top of the banana-trunk rack (gedebog)
  const STICK = 60;                                  // gapit (handle stick) below a figure
  const TOLS = {
    tk: { s: .22, p: 56, r: 15, blur: 24 }, k1: { s: .14, p: 36, r: 10, blur: 20 }, k2: { s: .10, p: 28, r: 8, blur: 18 },
    k3: { s: .08, p: 22, r: 6, blur: 16 }, k4: { s: .06, p: 18, r: 5, blur: 14 }
  }[TIER] || { s: .14, p: 36, r: 10, blur: 20 };
  const RAY = { tk: .85, k1: .7, k2: .55, k3: .42, k4: 0 }[TIER];    // guide-ray opacity, fading by tier
  const ROT_SNAP = TIER === 'tk' || TIER === 'k1' ? 15 : 5;          // stated rotation grid
  let SPEED = 1;
  const ms = v => v / SPEED;
  // rAF timestamps can be a little older than the tween start, so clamp the first frame at 0
  const tw = (d, fn, e) => GS.tween(ms(d), (v, raw) => fn(Math.max(0, v), Math.max(0, raw)), e);
  const wait = d => GS.wait(ms(d));

  /* ================= small utilities ================= */
  const n1 = v => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rr = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => GS.shuffle(a);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const dec = v => String(Math.round(v * 100) / 100).replace('.', ',');   // Indonesian decimal comma
  const sgn = () => (Math.random() < .5 ? -1 : 1);
  let uidN = 0;
  const salt = Math.random().toString(36).slice(2, 5);
  const uid = p => 'wy' + salt + p + (++uidN).toString(36);
  const RAD = Math.PI / 180;

  /* ================= drawing helpers (Kampung Chunky) ================= */
  const P3 = {
    red: ['#E2453C', '#F27A6E', '#B5322B'], orange: ['#F28C28', '#F8B26A', '#C76A12'], yellow: ['#FFC83D', '#FFE08A', '#E09A00'],
    green: ['#4DAA57', '#86CC8C', '#357F40'], blue: ['#2F80C9', '#6FAEE3', '#215F98'], wood: ['#A8673A', '#C68654', '#7E4A27'],
    gold: ['#D9A441', '#EECB7A', '#A8771F'], cream: ['#FFF8EC', '#FFFFFF', '#E8D9BF'], stone: ['#8C8F94', '#AEB1B5', '#63666B'],
    karton: ['#C9A06A', '#DDBB8A', '#9E7444'], dark: ['#3A3436', '#5A5356', '#232022'], banana: ['#D8D2A0', '#ECE7C2', '#B3AC74']
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
    return `<text x="${n1(x)}" y="${n1(y)}" font-size="${size}" text-anchor="${o.anchor || 'middle'}" fill="${o.fill || INK}"${o.cls ? ` class="${o.cls}"` : ''}${o.decor ? ' data-qc="decor"' : ''}${o.w ? ` font-weight="${o.w}"` : ''} style="font-variant-numeric:tabular-nums">${esc(s)}</text>`;
  };
  /** Cream pill with dark text: every label on the dark stage uses it, so contrast stays high. */
  function pill(x, y, s, size, o) {
    o = o || {};
    const w = o.w || Math.max(size * 1.6, String(s).length * size * 0.56 + size * 0.9), h = size * 1.42;
    return Rc(x - w / 2, y - h / 2, w, h, h / 2, `fill="${o.bg || CREAM}" ${ol(2.5)}`) + txt(x, y + size * 0.35, s, size, { cls: o.cls, fill: o.fill || INK, w: o.cls ? 700 : null });
  }
  /** 3-tone fill: shade crescent (bottom-right), base, highlight blob (top-left), outline.
   *  shape(attrs) returns the markup of one shape; box = [x, y, w, h]; c = [base, hl, shade]. */
  function f3(shape, box, c, o) {
    o = o || {};
    const x = box[0], y = box[1], w = box[2], h = box[3], id = uid('c'), off = Math.min(w, h) * (o.k == null ? 0.1 : o.k);
    let s = `<clipPath id="${id}">${shape('')}</clipPath><g clip-path="url(#${id})">` +
      `<rect x="${n1(x - 6)}" y="${n1(y - 6)}" width="${n1(w + 12)}" height="${n1(h + 12)}" fill="${c[2]}"/>` +
      `<g transform="translate(${n1(-off)} ${n1(-off)})">${shape(`fill="${c[0]}"`)}</g>`;
    if (o.hl !== false) {
      const hx0 = x + w * (o.hx == null ? 0.3 : o.hx), hy0 = y + h * (o.hy == null ? 0.25 : o.hy);
      s += `<ellipse cx="${n1(hx0)}" cy="${n1(hy0)}" rx="${n1(Math.max(2, w * 0.15))}" ry="${n1(Math.max(1.5, h * 0.07))}" transform="rotate(-30 ${n1(hx0)} ${n1(hy0)})" fill="${c[1]}" opacity=".85"/>`;
    }
    s += (o.inner || '') + '</g>';
    if (o.ol !== false) s += shape(`fill="none" ${ol(o.sw)}`);
    return s;
  }
  const rrectD = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
  /** Ellipse as a closed sub-path (used for carved holes, fill-rule evenodd). */
  function ellD(cx, cy, rx, ry, rot) {
    const a = (rot || 0) * RAD, c = Math.cos(a), s = Math.sin(a);
    const x1 = cx - rx * c, y1 = cy - rx * s, x2 = cx + rx * c, y2 = cy + rx * s;
    return `M${n1(x1)} ${n1(y1)}A${rx} ${ry} ${rot || 0} 1 0 ${n1(x2)} ${n1(y2)}A${rx} ${ry} ${rot || 0} 1 0 ${n1(x1)} ${n1(y1)}Z`;
  }
  const holeD = h => (typeof h === 'string' ? h : ellD(h[0], h[1], h[2], h[3] == null ? h[2] : h[3], h[4] || 0));

  /* ================= silhouettes =================
   * Unit coordinates: the pivot (where the dalang's stick meets the figure) is (0, 0); human figures
   * and the gunungan span exactly y -100..100, so a figure drawn at scale k is 200k units tall.
   * d = outline (one simple closed path); holes = carved perforations (only wayang kulit has them). */
  const SH = {
    kucing: {
      label: 'kucing', pal: 'orange',
      d: 'M-40 100L44 100C56 76 54 38 40 10C34 -2 46 -14 52 -26C60 -38 62 -52 54 -62L58 -100L34 -84C26 -88 16 -88 8 -84L-4 -100L-8 -62C-16 -50 -14 -34 -6 -24C-34 -10 -50 30 -48 72L-48 88C-62 90 -76 86 -80 72C-82 64 -88 60 -94 64C-98 70 -96 84 -86 94C-76 102 -56 102 -40 100Z',
      holes: [[38, -63, 7, 3.6, -12], [-18, 18, 5], [-28, 42, 4.5], [-10, 44, 4.5], [-24, 66, 4], [0, 70, 4], [14, -44, 8, 3, 20], [26, 30, 3.5, 7, 10]],
      decor: () => El(28, 54, 22, 40, fill('#F6E3C4', .85)) + Pa('M-14 -24Q18 -6 50 -24L52 -12Q18 6 -16 -12Z', fill('#E2453C')) + Ci(18, -3, 6, solid('#FFC83D', 2)) +
        Pa('M50 -92L54 -70L40 -80Z', fill('#F59AB0')) + Pa('M-1 -92L-4 -68L5 -78Z', fill('#F59AB0')) + El(53, -42, 9, 7, fill('#F6E3C4')) +
        line('M-34 2q12 4 6 16M-42 28q12 4 6 16M-44 54q12 4 6 16', 5, '#C76A12') + line('M-90 70q8 8 2 18', 7, '#F6E3C4')
    },
    burung: {
      label: 'burung', pal: 'blue',
      d: 'M-52 30C-30 52 18 56 44 32C58 20 66 8 66 0L96 -6L66 -16C62 -32 40 -36 28 -22C24 -50 6 -86 -22 -100C-26 -88 -32 -82 -40 -80C-38 -68 -44 -62 -54 -58C-48 -46 -54 -38 -62 -34C-52 -24 -44 -14 -40 -8L-64 -4L-98 -20L-84 2L-100 14L-82 20L-94 42Z',
      holes: [[48, -18, 4.6], [-6, -70, 10, 3.4, -55], [-20, -56, 11, 3.6, -50], [-34, -42, 10, 3.4, -45], [-8, 14, 4.5], [8, 22, 4.5], [24, 14, 4], [-76, 12, 7, 2.5, -10]],
      decor: () => Pa('M28 -22C24 -50 6 -86 -22 -100C-30 -80 -52 -60 -62 -34C-44 -14 -10 -8 28 -22Z', fill('#D9A441')) +
        line('M12 -36C0 -56 -14 -74 -22 -92', 7, '#E2453C') + line('M-8 -26C-22 -42 -36 -54 -46 -64', 5, '#E2453C') +
        Pa('M-64 -4L-98 -20L-84 2L-100 14L-82 20L-94 42L-52 30Z', fill('#E2453C')) + line('M-62 4L-90 -12M-62 14L-92 14M-60 24L-86 36', 3, '#FFC83D') +
        Pa('M66 -16L96 -6L66 0Z', fill('#FFC83D')) + El(10, 34, 34, 12, fill('#6FAEE3', .8))
    },
    pohon: {
      label: 'pohon', pal: 'green',
      d: 'M-24 100L24 100C18 80 14 50 14 30C50 34 82 12 76 -20C96 -42 80 -82 50 -78C40 -100 8 -104 -14 -90C-40 -100 -82 -84 -74 -52C-96 -30 -80 20 -46 26C-30 30 -18 30 -14 30C-14 50 -18 80 -24 100Z',
      holes: [[-40, -42, 6], [-12, -62, 6], [22, -52, 6], [46, -26, 6], [-30, -8, 5.5], [4, -24, 6], [30, 6, 5], [-56, -14, 4.5]],
      decor: () => Rc(-26, 22, 52, 90, 0, fill('#A8673A')) + line('M-6 32V96M8 42V96', 3, '#7E4A27') +
        [[-52, -64], [30, -74], [62, -6], [-62, 2], [-8, -86], [12, 2]].map(([x, y]) => Ci(x, y, 7, solid('#E2453C', 2))).join('') +
        line('M-44 -72q12 -10 24 0M8 -42q12 -10 24 0M-52 -22q12 -10 24 0', 4, '#357F40')
    },
    gunungan: {
      label: 'gunungan', pal: 'gold',
      d: 'M-34 100L34 100L34 72L56 72C70 62 76 40 70 18C58 -30 24 -70 0 -100C-24 -70 -58 -30 -70 18C-76 40 -70 62 -56 72L-34 72Z',
      holes: ['M-12 96L12 96L12 78L-12 78Z', [0, -62, 3, 8], [0, -36, 3.5, 9], [0, -10, 4, 10], [0, 16, 4, 10], [0, 42, 4, 9],
        [-18, -40, 9, 3.5, -35], [18, -40, 9, 3.5, 35], [-26, -14, 11, 4, -30], [26, -14, 11, 4, 30], [-34, 14, 12, 4, -25], [34, 14, 12, 4, 25],
        [-38, 42, 11, 4, -15], [38, 42, 11, 4, 15], [-50, 28, 4], [50, 28, 4], [-28, -52, 3.5], [28, -52, 3.5]],
      decor: () => Pa('M0 -84C18 -60 48 -26 56 16C58 40 50 56 42 62L-42 62C-50 56 -58 40 -56 16C-48 -26 -18 -60 0 -84Z', fill('#B5322B')) +
        Rc(-5, -66, 10, 128, 4, fill('#7E4A27')) +
        [[-20, -40, -35], [20, -40, 35], [-28, -14, -30], [28, -14, 30], [-34, 14, -25], [34, 14, 25], [-36, 42, -15], [36, 42, 15]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="16" ry="7" transform="rotate(${a} ${x} ${y})" fill="#4DAA57"/>`).join('') +
        Rc(-36, 72, 72, 30, 0, fill('#7E4A27')) + Rc(-36, 64, 72, 9, 0, fill('#FFC83D'))
    },
    raksasa: {
      label: 'raksasa', pal: 'gold', arms: [[84, 70, 98, 150], [-66, 40, -82, 132]],
      d: 'M-66 100L-28 100L-14 76L6 76L20 100L70 100C56 80 48 56 42 30C54 32 60 40 64 48L74 70C80 78 92 72 88 62L80 40C82 24 72 8 54 4L34 -6C40 -12 50 -16 52 -22L62 -26L54 -32C66 -34 72 -44 62 -50L52 -56C54 -68 44 -80 28 -80L16 -98L-8 -100L-28 -86C-50 -76 -54 -50 -40 -40C-52 -28 -56 -10 -46 6L-62 22C-74 28 -72 44 -62 42L-42 28C-48 50 -56 74 -66 100Z',
      holes: [[40, -62, 8, 4, -8], [-4, -90, 3.2], [8, -90, 3], [-24, 33, 7, 3], [-2, 34, 7, 3], [20, 34, 7, 3], [14, 6, 4], [-14, 8, 4],
        [-34, 62, 4.5], [-12, 64, 4.5], [10, 64, 4.5], [32, 62, 4.5], [-48, 88, 4], [44, 88, 4]],
      decor: () => Pa('M18 -86L66 -60L74 -28L38 -2L4 -24L2 -80Z', fill('#E2453C')) + Pa('M-42 -90C-66 -70 -62 -20 -48 12L-10 12L-4 -84Z', fill('#2E2624')) +
        Rc(-90, 40, 190, 70, 0, fill('#B5322B')) + Rc(-90, 26, 190, 14, 0, fill('#A8771F')) + line('M-40 52l8 8l8 -8l8 8l8 -8l8 8l8 -8l8 8l8 -8l8 8', 3, '#FFC83D') +
        Ci(4, -88, 4.5, fill('#2F80C9')) + line('M26 -36L50 -30', 3, OUT)
    },
    ksatria: {
      label: 'ksatria', pal: 'gold', arms: [[54, 44, 64, 140], [-38, 16, -50, 120]],
      d: 'M-34 100L-8 100L0 80L8 80L18 100L44 100C32 60 26 30 22 8C28 4 34 12 38 22L46 44C50 52 58 48 56 40L48 18C46 2 40 -14 24 -20L16 -30C20 -36 24 -40 24 -46L28 -52L42 -58L26 -64L22 -72C20 -82 16 -90 8 -94L0 -100C-10 -98 -16 -92 -18 -84C-30 -76 -32 -60 -20 -54C-24 -44 -24 -34 -18 -26L-30 -12L-40 10C-44 16 -38 22 -34 16L-22 -2C-20 30 -24 60 -34 100Z',
      holes: [[26, -62, 5, 2.5, -10], [0, -88, 3], [-9, -84, 2.5], [6, -20, 3], [14, -12, 3], [-6, 18, 6, 2.6], [12, 18, 6, 2.6],
        [-8, 50, 4], [10, 52, 4], [2, 68, 4], [-16, 86, 3.6], [28, 88, 3.6]],
      decor: () => Pa('M-22 -76L22 -76L46 -58L26 -38L0 -30L-22 -40Z', fill('#2E2624')) + Rc(-60, 12, 130, 100, 0, fill('#2F80C9')) +
        Rc(-60, 4, 130, 10, 0, fill('#E2453C')) + line('M-20 40l10 10l10 -10l10 10l10 -10l10 10M-24 64l10 10l10 -10l10 10l10 -10l10 10', 3, '#FFC83D') +
        Ci(4, -90, 3.5, fill('#E2453C'))
    },
    /* real-material samples (k3 sorting) */
    kaca: { label: 'kaca', d: rrectD(-56, -84, 112, 168, 10), holes: [] },
    kertas: { label: 'kertas minyak', d: 'M-56 -84L28 -84L56 -56L56 84L-56 84Z', holes: [] },
    kain: { label: 'kain tipis', d: 'M-62 -84L62 -84C58 -30 66 30 60 76Q42 66 22 80Q2 68 -18 82Q-38 68 -60 80C-66 30 -58 -30 -62 -84Z', holes: [] },
    papan: { label: 'kayu', d: rrectD(-50, -84, 100, 168, 14), holes: [] },
    daun: { label: 'daun', d: 'M0 -100C46 -64 64 6 6 78L6 100L-6 100L-6 78C-64 6 -46 -64 0 -100Z', holes: [] }
  };
  Object.keys(SH).forEach(n => { SH[n].holesD = SH[n].holes.map(holeD).join(''); });

  /* Materials: a = fraction of light the material stops (shadow darkness); kind = how children sort it. */
  const MAT = {
    kulit: { name: 'kulit', a: .9, kind: 'pekat' }, karton: { name: 'karton', a: .92, kind: 'pekat' },
    kayu: { name: 'kayu', a: .94, kind: 'pekat' }, daun: { name: 'daun', a: .84, kind: 'pekat' },
    minyak: { name: 'kertas minyak', a: .38, kind: 'samar' }, kain: { name: 'kain tipis', a: .42, kind: 'samar' },
    plastik: { name: 'plastik bening', a: .07, kind: 'bening' }, kaca: { name: 'kaca', a: .05, kind: 'bening' }
  };
  const KIND_WORD = { bening: 'bening', samar: 'tembus cahaya', pekat: 'tidak tembus cahaya' };

  /** Coloured art of one figure in unit coordinates (drawn at scale k by its group). */
  function figureArt(name, mat, k) {
    const S = SH[name], b = S.bb, sw = 3 / k;
    const shape = a => `<path d="${S.d}" ${a}/>`;
    const box = [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0];
    let s = '';
    // gapit: the horn stick the dalang holds, behind the figure
    const sy0 = b.y1 - 26, sy1 = b.y1 + STICK / k;
    s += line(`M0 ${n1(sy0)}V${n1(sy1)}`, 10 / k) + line(`M0 ${n1(sy0)}V${n1(sy1)}`, 5 / k, '#A0703F');
    (S.arms || []).forEach(a => { if (mat === 'kulit') s += line(`M${a[0]} ${a[1]}L${a[2]} ${a[3]}`, 5 / k) + line(`M${a[0]} ${a[1]}L${a[2]} ${a[3]}`, 2.4 / k, '#C9A06A'); });
    const holes = S.holesD ? `<path d="${S.holesD}" fill="#1B1216"/><path d="${S.holesD}" fill="none" stroke="#7E5A2E" stroke-width="${n1(1.2 / k)}"/>` : '';
    if (mat === 'kulit') {
      s += f3(shape, box, P3[S.pal || 'gold'], { inner: S.decor ? S.decor() : '', sw, k: .07 }) + holes;
    } else if (mat === 'karton' || mat === 'kayu' || mat === 'daun') {
      const pal = mat === 'karton' ? P3.karton : mat === 'kayu' ? P3.wood : P3.green;
      let inner = '';
      if (mat === 'karton') inner = line('M-90 -60H90M-90 -30H90M-90 0H90M-90 30H90M-90 60H90', 3 / k, '#9E7444', .5);
      if (mat === 'kayu') inner = line('M-30 -84C-20 -40 -36 0 -24 84M8 -84C18 -30 2 20 12 84M30 -60q10 20 0 40', 3.4 / k, '#7E4A27', .7);
      if (mat === 'daun') inner = line('M0 -88V80M0 -50L-26 -70M0 -50L26 -70M0 -16L-34 -40M0 -16L34 -40M0 20L-32 -2M0 20L32 -2M0 50L-22 34M0 50L22 34', 3 / k, '#357F40');
      s += f3(shape, box, pal, { inner, sw, k: .07 });
    } else if (mat === 'minyak') {
      s += shape(fill('#F4DC92', .8)) +
        line(`M${b.x0 + 16} ${b.y0 + 30}L${b.x1 - 30} ${b.y0 + 16}`, 6 / k, '#FFFFFF', .55) + shape(`fill="none" stroke="#9A7A3A" stroke-width="${n1(2.6 / k)}" stroke-linejoin="round"`);
    } else if (mat === 'kain') {
      const cid = uid('k');
      let hatch = '';
      for (let x = b.x0 - 100; x < b.x1 + 100; x += 14) hatch += `M${x} ${b.y0}l${n1(b.y1 - b.y0)} ${n1(b.y1 - b.y0)}`;
      s += `<clipPath id="${cid}">${shape('')}</clipPath>` + shape(fill('#F4BDCC', .72)) + `<g clip-path="url(#${cid})">${line(hatch, 1.6 / k, '#C9637F', .45)}</g>` +
        shape(`fill="none" stroke="#B5627A" stroke-width="${n1(2.6 / k)}" stroke-linejoin="round"`);
    } else {   // plastik bening, kaca: clear, a bright edge and a glint
      const tint = mat === 'kaca' ? '#CFF0EE' : '#DFF4FB';
      s += shape(fill(tint, .26)) + shape(`fill="none" stroke="#4F9BD0" stroke-width="${n1(3.4 / k)}" stroke-linejoin="round"`) +
        line(`M${n1(b.x0 * .5)} ${n1(b.y0 * .6)}L${n1(b.x0 * .1)} ${n1(b.y0 * .2)}M${n1(b.x0 * .5 + 16)} ${n1(b.y0 * .62)}l10 -12`, 5 / k, '#FFFFFF', .9);
    }
    return s;
  }

  /* ================= stage ================= */
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const el = (tag, attrs, parent) => GS.el(tag, attrs, parent);
  const defs = el('defs', {}, svg);
  (function () {
    let D = '';
    Object.keys(SH).forEach(n => {
      D += `<path id="wy-ol-${n}" d="${SH[n].d}"/>`;
      D += `<path id="wy-sh-${n}" d="${SH[n].d}${SH[n].holesD}" fill-rule="evenodd"/>`;
    });
    D += `<clipPath id="wyKClip"><rect x="${KX0}" y="${KY0}" width="${KX1 - KX0}" height="${KY1 - KY0}"/></clipPath>`;
    D += `<clipPath id="wyStageClip"><rect x="-600" y="46" width="2480" height="602"/></clipPath>`;
    D += '<linearGradient id="wySky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ED8EC"/><stop offset="1" stop-color="#E6F5F0"/></linearGradient>';
    D += '<pattern id="wyKawung" width="46" height="46" patternUnits="userSpaceOnUse"><ellipse cx="23" cy="13" rx="5" ry="9" fill="#F6E3C4"/><ellipse cx="23" cy="33" rx="5" ry="9" fill="#F6E3C4"/><ellipse cx="13" cy="23" rx="9" ry="5" fill="#F6E3C4"/><ellipse cx="33" cy="23" rx="9" ry="5" fill="#F6E3C4"/></pattern>';
    defs.innerHTML = D;
  })();
  // Sample every outline once: rays touch the extreme points, and targets must fit on the kelir.
  Object.keys(SH).forEach(n => {
    const S = SH[n], pts = [];
    try {
      const p = defs.querySelector('#wy-ol-' + n), Lp = p.getTotalLength();
      for (let i = 0; i < 160; i++) { const q = p.getPointAtLength(Lp * i / 160); pts.push([q.x, q.y]); }
    } catch (e) { /* no geometry API: fall back to the path's own numbers */ }
    if (pts.length < 8) { const v = S.d.match(/-?\d+(\.\d+)?/g).map(Number); for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1]]); }
    S.pts = pts;
    S.bb = pts.reduce((b, p) => ({ x0: Math.min(b.x0, p[0]), x1: Math.max(b.x1, p[0]), y0: Math.min(b.y0, p[1]), y1: Math.max(b.y1, p[1]) }), { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 });
  });
  /** Extent of a figure turned by rot and scaled by sc, relative to its pivot. */
  function extent(shape, sc, rot) {
    const c = Math.cos(rot * RAD), s = Math.sin(rot * RAD);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    SH[shape].pts.forEach(([x, y]) => {
      const X = (x * c - y * s) * sc, Y = (x * s + y * c) * sc;
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    });
    return { x0, x1, y0, y1 };
  }
  /** Does a shadow (scale sc, centre height cy, turned rot) fit on the kelir face with a margin? */
  function fits(shape, sc, cy, rot, mg) {
    const e = extent(shape, sc, rot || 0), g = mg == null ? 14 : mg;
    return PCX + e.x0 >= KX0 + g && PCX + e.x1 <= KX1 - g && cy + e.y0 >= KY0 + g && cy + e.y1 <= KY1 - g;
  }

  /* ---------- static theatre (pendopo at night) ---------- */
  function theatre() {
    let s = Rc(-600, 0, 2480, 800, 0, fill('#2A2030')) + Rc(-600, 40, 2480, 610, 0, 'fill="url(#wyKawung)" opacity=".05"');
    // warm glow of the blencong over the back wall (flat rings, no gradient)
    s += Ci(560, 360, 640, fill('#4A2E2A', .38)) + Ci(520, 350, 440, fill('#5C3A2C', .3)) + Ci(470, 345, 250, fill('#704833', .22));
    // saka (pillars) outside the design area, gamelan for wide screens
    [-470, 1720].forEach(x => { s += Rc(x - 42, 0, 84, 800, 0, fill('#3A2A22')) + Rc(x - 42, 0, 18, 800, 0, fill('#4A372C')); });
    s += gamelan(1420, 650) + gamelan(-260, 650);
    // top beam with carved gold dots
    s += Rc(-600, 0, 2480, 40, 0, fill('#4A3426')) + Rc(-600, 40, 2480, 8, 0, fill('#2E2019'));
    for (let x = -590; x < 1880; x += 40) s += Ci(x, 20, 4, fill('#D9A441', .55));
    // floor
    s += Rc(-600, 648, 2480, 152, 0, fill('#33251E')) + Rc(-600, 648, 2480, 6, 0, fill('#4A372C'));
    for (let x = -600; x < 1880; x += 120) s += Rc(x, 654, 3, 146, 0, fill('#281C17', .7));
    return s;
  }
  function gamelan(x, gy) {
    let s = Rc(x - 70, gy - 170, 10, 170, 0, fill('#5A3A2A')) + Rc(x + 60, gy - 170, 10, 170, 0, fill('#5A3A2A')) + Rc(x - 80, gy - 182, 160, 16, 6, fill('#6E4632'));
    s += Pa(`M${x} ${gy - 166}V${gy - 140}`, 'stroke="#2E2019" stroke-width="4"') + Ci(x, gy - 92, 50, fill('#8A6A2E')) + Ci(x, gy - 92, 36, fill('#A8853A')) + Ci(x, gy - 92, 14, fill('#C9A04A'));
    return s;
  }
  /** Audience seen from behind, along the bottom edge (decoration). */
  function audience() {
    const R = (() => { let v = 7; return () => (v = (v * 9301 + 49297) % 233280) / 233280; })();
    let s = '';
    for (let x = -580; x < 1890; x += 70 + R() * 22) {
      const h = 18 + R() * 8, y = 760 + R() * 12, c = R() < .5 ? '#140D16' : '#1C131E', cap = R();
      let p = El(x, 806, h * 2.1, 40, fill(c)) + Ci(x, y - h * .2, h, fill(c));
      if (cap < .3) p += Rc(x - h * .9, y - h * 1.25, h * 1.8, h * .7, 3, fill('#0E0A10'));
      else if (cap < .5) p += Pa(`M${n1(x - h * 1.15)} ${n1(y + h * .6)}C${n1(x - h * 1.3)} ${n1(y - h * 1.6)} ${n1(x + h * 1.3)} ${n1(y - h * 1.6)} ${n1(x + h * 1.15)} ${n1(y + h * .6)}Z`, fill('#241A2A'));
      p += Pa(`M${n1(x - h * .7)} ${n1(y - h * .9)}Q${n1(x)} ${n1(y - h * 1.5)} ${n1(x + h * .7)} ${n1(y - h * .9)}`, `fill="none" stroke="#7A4E34" stroke-width="3" opacity=".55"`);
      s += `<g class="wy-person" style="animation-delay:${n1(-R() * 0.6)}s">${p}</g>`;
    }
    return s;
  }
  function kelirFrame() {
    let s = '';
    // gawang (frame) posts
    s += f3(a => Rc(862, 34, 18, 640, 3, a), [862, 34, 18, 640], P3.wood, { hl: false, k: .3 }) + f3(a => Rc(1220, 34, 18, 640, 3, a), [1220, 34, 18, 640], P3.wood, { hl: false, k: .3 });
    // plangitan: dark top band with red edges and gold tumpal triangles
    s += Rc(852, 32, 396, 40, 4, solid('#241A1C', 3)) + Rc(856, 36, 388, 5, 0, fill('#E2453C')) + Rc(856, 63, 388, 5, 0, fill('#E2453C'));
    for (let x = 864; x < 1240; x += 24) s += Pa(`M${x} 62L${x + 12} 43L${x + 24} 62Z`, fill('#D9A441'));
    // red border on the screen
    s += Rc(KX0, KY0, KX1 - KX0, KY1 - KY0, 0, 'fill="none" stroke="#B5322B" stroke-width="5"');
    // gedebog: two banana trunks hold the kelir (and the wayang) at the bottom
    s += f3(a => Rc(836, 628, 428, 34, 17, a), [836, 628, 428, 34], P3.banana, { hl: false, k: .18 }) + f3(a => Rc(846, 656, 408, 34, 17, a), [846, 656, 408, 34], P3.banana, { hl: false, k: .18 });
    s += line('M880 634v22M960 634v22M1040 634v22M1120 634v22M1200 634v22M900 662v22M980 662v22M1060 662v22M1140 662v22M1220 662v22', 2.4, '#8F8952');
    return s;
  }
  const bgG = el('g', { class: 'gs-scene wy-bg' }, svg);
  GS.markup(bgG, theatre());
  const audG = el('g', { class: 'gs-scene wy-aud' }, svg);
  GS.markup(audG, audience());
  const coneG = el('g', {}, svg);
  const kelirFace = el('rect', { x: KX0, y: KY0, width: KX1 - KX0, height: KY1 - KY0, fill: '#3E342E' }, svg);
  const kelirGlow = el('rect', { x: KX0, y: KY0, width: KX1 - KX0, height: KY1 - KY0, fill: '#FFF7DC', opacity: 0, class: 'wy-kglow' }, svg);
  const shadowG = el('g', { 'clip-path': 'url(#wyKClip)' }, svg);
  const spotG = el('g', { 'clip-path': 'url(#wyKClip)' }, svg);
  const targetG = el('g', { 'clip-path': 'url(#wyKClip)' }, svg);
  const frameG = el('g', { class: 'gs-scene' }, svg);
  GS.markup(frameG, kelirFrame());
  const kelirUI = el('g', {}, svg);
  const propsG = el('g', {}, svg);
  const raysG = el('g', { 'pointer-events': 'none' }, svg);
  const lampG = el('g', {}, svg);
  const pupG = el('g', {}, svg);
  const coverG = el('g', {}, svg);     // curtain over the side view (k4 "which is nearer")
  const uiG = el('g', {}, svg);
  const fxG = el('g', { 'pointer-events': 'none' }, svg);
  const outG = el('g', { display: 'none' }, svg);   // outdoor scene (tree level) drawn over everything

  /* ================= lamps ================= */
  const LCOL = { orange: '#FFB24A', blue: '#6CB4FF' };
  const lampCol = L => LCOL[L.col] || '#FFD98A';
  // A shadow of the orange lamp is lit only by the blue lamp, so it looks blue (and the other way round).
  const SHADE_COL = { orange: '#4A8DE0', blue: '#F2A23A' };
  function discSamples(r) {
    const s = [[0, 0]];
    for (let i = 0; i < 6; i++) s.push([Math.cos(i * Math.PI / 3) * r * .5, Math.sin(i * Math.PI / 3) * r * .5]);
    for (let i = 0; i < 12; i++) s.push([Math.cos((i + .5) * Math.PI / 6) * r, Math.sin((i + .5) * Math.PI / 6) * r]);
    return s;
  }
  function flameArt(L) {
    const f = L.art === 'besar' ? 1.7 : L.art === 'pelita' || L.art === 'kecil' ? .75 : 1;
    const d = k => `M0 ${n1(-22 * f * k)}C${n1(10 * f * k)} ${n1(-9 * f * k)} ${n1(12 * f * k)} ${n1(5 * f * k)} 0 ${n1(12 * f * k)}C${n1(-12 * f * k)} ${n1(5 * f * k)} ${n1(-10 * f * k)} ${n1(-9 * f * k)} 0 ${n1(-22 * f * k)}Z`;
    let s = '';
    if (L.r > 6) s += Ci(0, 0, L.r, fill('#FFF3C8', .95)) + Ci(0, 0, L.r, 'fill="none" stroke="#FFC83D" stroke-width="3"');
    s += Pa(d(1), solid('#F28C28', 2.4)) + Pa(d(.66), fill('#FFC83D')) + Pa(d(.34), fill('#FFF8EC'));
    if (L.col) s += Ci(0, 0, 26, `fill="${lampCol(L)}" fill-opacity=".45" stroke="${OUT}" stroke-width="3"`);
    return `<g class="wy-flame">${s}</g>`;
  }
  function lampArt(L) {
    let s = '';
    if (L.art === 'pelita') {
      const pole = 650 - L.y;
      s += f3(a => Rc(-20, 16, 12, pole - 18, 3, a), [-20, 16, 12, pole - 18], P3.wood, { hl: false, k: .3 }) + Rc(-40, pole - 12, 52, 12, 5, solid('#7E4A27', 3));
      s += f3(a => Pa('M-40 2C-40 18 -26 24 -12 22C-2 20 4 12 4 6Z', a), [-40, 2, 44, 22], ['#C8643B', '#E08A62', '#963F22'], { k: .14 }) + Rc(-44, -2, 50, 8, 4, solid('#963F22', 2.6));
      return s;
    }
    if (L.art === 'senter') {
      const a = L.beamAng || 0;
      s += f3(q => Rc(-70, -34, 64, 68, 12, q), [-70, -34, 64, 68], P3.dark, { k: .1 }) + Ci(-38, 0, 12, fill('#FFE08A'));
      s += `<g transform="rotate(${n1(a)})">` + f3(q => Rc(-12, -16, 74, 32, 8, q), [-12, -16, 74, 32], P3.dark, { k: .12 }) + Rc(56, -18, 10, 36, 4, solid('#D9A441', 2.6)) + '</g>';
      return s;
    }
    // blencong: a brass garuda oil lamp, the spout points at the kelir
    s += f3(a => Pa('M-62 -2C-86 -26 -108 -20 -112 0C-104 4 -100 10 -104 18C-88 22 -74 16 -62 8Z', a), [-112, -26, 50, 48], P3.gold, { k: .1 });
    s += line('M-70 -2L-100 -10M-70 4L-102 6M-70 10L-96 16', 2.4, '#A8771F');
    s += f3(a => Pa('M-76 2C-76 24 -54 34 -36 32C-18 30 -10 20 -8 6Z', a), [-76, 2, 68, 32], P3.gold, { k: .12, inner: line('M-66 14H-18M-60 22H-26', 2.4, '#A8771F') });
    s += Rc(-80, -3, 76, 9, 4, solid('#A8771F', 2.6)) + Pa('M-14 0L-2 2L-4 9L-16 7Z', solid('#D9A441', 2.4));
    s += f3(a => Pa('M-56 -2C-60 -24 -48 -38 -34 -36C-24 -34 -20 -26 -22 -18L-12 -14L-22 -10C-24 -6 -28 -2 -32 -2Z', a), [-60, -38, 48, 36], P3.gold, { k: .12 });
    s += Ci(-33, -26, 2.8, fill(OUT)) + Pa('M-48 -34L-56 -52L-42 -40L-40 -56L-34 -38Z', solid('#E2453C', 2.4)) + Ci(-44, -42, 6, `fill="none" ${ol(3)}`);
    return s;
  }
  function buildLamp(spec) {
    const L = Object.assign({ x: 320, y: LY0, r: 2.5, art: 'blencong', col: null, drag: null }, spec);
    if (L.art === 'besar' && L.r < 8) L.r = 26;
    L.samples = L.r > 6 ? discSamples(L.r) : [[0, 0]];
    L.g = el('g', { class: 'wy-lamp' }, lampG);
    L.chain = el('path', { fill: 'none', stroke: '#9C8A66', 'stroke-width': 4, 'stroke-dasharray': '7 5', 'stroke-linecap': 'round' }, L.g);
    L.glow = el('g', {}, L.g);
    L.glow.innerHTML = Ci(0, 0, 130, fill(lampCol(L), .05)) + Ci(0, 0, 76, fill(lampCol(L), .1)) + Ci(0, 0, 40, fill(lampCol(L), .2));
    L.body = el('g', {}, L.g);
    GS.markup(L.body, lampArt(L));
    L.flameG = el('g', {}, L.g);
    GS.markup(L.flameG, flameArt(L));
    if (L.drag) {
      GS.markup(L.g, Ci(-40, 52, 20, solid('#FFC83D', 3)) + Pa('M-40 38l-9 9h18ZM-40 66l-9 -9h18Z', fill(OUT)));
      el('circle', { cx: -30, cy: 12, r: 66, fill: 'transparent' }, L.g);
      L.g.style.cursor = 'grab';
      GS.drag(L.g, {
        svg,
        onStart(p) { if (!canInput()) return false; L.dx = L.x - p.x; L.dy = L.y - p.y; GS.sfx.pick(); clearHints(); onGrab(); return true; },
        onMove(p) {
          if (L.drag.indexOf('y') >= 0) L.y = clamp(p.y + L.dy, 140, 560);
          if (L.drag.indexOf('x') >= 0) L.x = clamp(p.x + L.dx, 120, 520);
          render();
        },
        onEnd() { GS.sfx.creak(); render(); afterMove(); }
      });
    }
    L.cone = el('path', { fill: lampCol(L), opacity: 0 }, coneG);
    return L;
  }
  const lampOn = L => light && L.on !== false;

  /* ================= puppets ================= */
  function buildPup(spec) {
    const P = Object.assign({ k: .7, mat: 'kulit', drag: null, rotate: false, rot: 0, x: 600, y: LY0 }, spec);
    const b = SH[P.shape].bb;
    P.g = el('g', { class: 'wy-pup' }, pupG);
    P.rotG = el('g', {}, P.g);
    GS.markup(P.rotG, figureArt(P.shape, P.mat, P.k));
    if (P.drag) {
      const w = Math.max(112, P.k * (b.x1 - b.x0) + 10), h = Math.max(112, P.k * (b.y1 - b.y0) + 30);
      el('rect', { x: n1(P.k * (b.x0 + b.x1) / 2 - w / 2), y: n1(P.k * (b.y0 + b.y1) / 2 - h / 2 + 12), width: n1(w), height: n1(h), fill: 'transparent' }, P.g);
      P.g.style.cursor = 'grab';
      GS.drag(P.g, {
        svg,
        onStart(p) {
          if (!canInput() || P.locked) return false;
          P.dx = P.x - p.x; P.dy = P.y - p.y; P.from = { x: P.x, y: P.y };
          pupG.appendChild(P.g); P.g.classList.add('wy-grab'); GS.sfx.pick(); clearHints();
          if (P.say) GS.say(P.say);
          onGrab(P);
          return true;
        },
        onMove(p) { movePup(P, p.x + P.dx, p.y + P.dy); render(); },
        onEnd() { P.g.classList.remove('wy-grab'); dropPup(P); }
      });
    }
    if (P.rotate) buildHandle(P);
    return P;
  }
  function movePup(P, x, y) {
    const L = LAMPS[0];
    const bx = P.bounds || (P.drag === 'free' ? [-70, SX - 60, 110, 700] : [(L ? L.x : 320) + 90, SX - 70, 120, 600]);
    if (P.drag !== 'y') P.x = clamp(x, bx[0], bx[1]);
    if (P.drag !== 'x') P.y = clamp(y, bx[2], bx[3]);
  }
  /** Rotation knob on a rod above the figure (a game handle: it casts no shadow). */
  function buildHandle(P) {
    P.rod = el('path', { fill: 'none', stroke: '#FFE7B0', 'stroke-width': 4, 'stroke-dasharray': '6 6', opacity: .8 }, uiG);
    P.knob = el('g', {}, uiG);
    P.knob.innerHTML = Ci(0, 3, 32, fill(OUT, .3)) + Ci(0, 0, 32, solid('#FFC83D', 3)) +
      line('M-16 6A17 17 0 0 1 14 -10', 4.5) + Pa('M8 -20L18 -8L4 -4Z', fill(OUT)) + Ci(0, 0, 58, fill('transparent'));
    P.knob.style.cursor = 'grab';
    GS.drag(P.knob, {
      svg,
      onStart() { if (!canInput()) return false; GS.sfx.pick(); clearHints(); onGrab(P); return true; },
      onMove(p) {
        const a = Math.atan2(p.x - P.x, -(p.y - P.y)) / RAD;
        const snapped = clamp(Math.round(a / ROT_SNAP) * ROT_SNAP, -90, 90);
        if (snapped !== P.rot) { P.rot = snapped; GS.sfx.tick(); }
        render();
      },
      onEnd() { GS.sfx.drop(); render(); afterMove(); }
    });
  }

  /* ================= shadows, targets, rays ================= */
  function buildShadows() {
    shadowG.innerHTML = '';
    PUPS.forEach(P => {
      P.sh = LAMPS.map(L => {
        const g = el('g', { display: 'none' }, shadowG);
        const href = '#wy-' + (P.mat === 'kulit' ? 'sh-' : 'ol-') + P.shape;
        const twoWhite = LAMPS.length > 1 && !L.col;
        const a = MAT[P.mat].a * (twoWhite ? .62 : 1);
        const N = L.samples.length, beta = 1 - Math.pow(1 - a, 1 / N);
        const uses = L.samples.map(() => {
          const u = el('use', { href, fill: L.col ? SHADE_COL[L.col] : '#22160F', opacity: L.col ? a : Math.round(beta * 1000) / 1000 }, g);
          if (L.col) u.style.mixBlendMode = 'multiply';
          return u;
        });
        return { g, uses };
      });
    });
  }
  /** m, centre height and penumbra of puppet P lit by lamp L (null when it casts nothing on the kelir). */
  function proj(L, P) {
    if (!(P.x > L.x + 1 && P.x < SX - 1) || P.hidden) return null;
    const m = Math.min(60, (SX - L.x) / (P.x - L.x));   // m = (SX - lx) / (px - lx)
    const cy = L.y + (P.y - L.y) * m;                   // y' = ly + (py - ly) * m
    const e = extent(P.shape, P.k * m, P.rot);
    if (cy + e.y1 < KY0 || cy + e.y0 > KY1) return null; // outside the lamp's cone: nothing on the kelir
    return { m, cy, sc: P.k * m, e, blur: 2 * L.r * (m - 1) };
  }
  function drawTargets() {
    targetG.innerHTML = '';
    TGTS.forEach(t => {
      t.g = el('g', { transform: `translate(${n1(PCX)} ${n1(t.cy)}) rotate(${t.rot}) scale(${n1(t.sc * 1000) / 1000})` }, targetG);
      t.fillU = el('use', { href: '#wy-ol-' + t.shape, fill: t.colFill || '#2F80C9', opacity: t.colFill ? .22 : .1 }, t.g);
      t.line = el('use', { href: '#wy-ol-' + t.shape, fill: 'none', stroke: '#2F80C9', 'stroke-width': 5, 'stroke-dasharray': '14 10', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, t.g);
    });
    drawTargetLabels();
  }
  function drawTargetLabels() {
    const lab = RD.label || (RD.targets || []).map(t => t.label).filter(Boolean)[0];
    // during an example the "Contoh" pill sits top-right on phones: move the label to the kelir's left edge
    const lw = Math.max(44 * 1.6, String(lab).length * 44 * .56 + 44 * .9);
    if (lab) GS.markup(kelirUI, `<g class="wy-tlabel">${pill(DEMO ? KX0 + 6 + lw / 2 : PCX, 26, lab, 44, { cls: lab.match(/\d/) ? '' : 't-body' })}</g>`);
  }
  function render() {
    if (!RD) return;
    const anyOn = LAMPS.some(lampOn);
    LAMPS.forEach(L => {
      L.g.setAttribute('transform', `translate(${n1(L.x)} ${n1(L.y)})`);
      if (L.art === 'pelita') L.chain.setAttribute('d', '');
      else L.chain.setAttribute('d', `M-44 ${n1(48 - L.y)}V-48`);
      const on = lampOn(L);
      L.glow.setAttribute('opacity', on ? 1 : 0);
      L.flameG.setAttribute('display', on ? 'inline' : 'none');
      L.cone.setAttribute('d', `M${n1(L.x)} ${n1(L.y)}L${SX} ${KY0}L${SX} ${KY1}Z`);
      L.cone.setAttribute('opacity', on && !RD.noCone ? (LAMPS.length > 1 ? .09 : .13) : 0);
    });
    const coloured = LAMPS.some(L => L.col);
    kelirFace.setAttribute('fill', RD.kelirDark ? '#3E342E' : !anyOn ? '#3E342E' : coloured ? '#FFF6EA' : '#FFEFC4');
    kelirGlow.setAttribute('display', anyOn && !RD.kelirDark ? 'inline' : 'none');
    PUPS.forEach(P => {
      P.g.setAttribute('transform', `translate(${n1(P.x)} ${n1(P.y)})`);
      P.rotG.setAttribute('transform', `rotate(${n1(P.rot)}) scale(${P.k})`);
      let lit = false;
      P.sh.forEach((S, li) => {
        const L = LAMPS[li], pr = lampOn(L) ? proj(L, P) : null;
        if (!pr) { S.g.setAttribute('display', 'none'); return; }
        lit = true;
        S.g.setAttribute('display', 'inline');
        S.uses.forEach((u, j) => {
          const sm = L.samples[j], dz = -(pr.m - 1) * sm[0], dy = -(pr.m - 1) * sm[1];   // extended source: shifted copies
          u.setAttribute('transform', `translate(${n1(PCX + dz)} ${n1(pr.cy + dy)}) rotate(${n1(P.rot)}) scale(${n1(pr.sc * 1000) / 1000})`);
        });
      });
      P.rotG.classList.toggle('wy-dim', !lit);
      if (P.knob) {
        const R = P.k * -SH[P.shape].bb.y0 + 52, hx = P.x + Math.sin(P.rot * RAD) * R, hy = P.y - Math.cos(P.rot * RAD) * R;
        P.knob.setAttribute('transform', `translate(${n1(hx)} ${n1(hy)})`);
        P.rod.setAttribute('d', `M${n1(P.x)} ${n1(P.y)}L${n1(hx)} ${n1(hy)}`);
      }
    });
    TGTS.forEach(t => { if (t.line && !t.done) t.line.setAttribute('stroke', anyOn && !RD.kelirDark ? '#2F80C9' : '#FFE7B0'); });
    drawRays();
    if (RD.onRender) RD.onRender();
  }
  function rayOpacity() {
    let o = RD.rays != null ? RD.rays : RAY;
    if (helpRays) o = Math.max(o, .6);
    return o;
  }
  function drawRays() {
    let s = '';
    const op = rayOpacity();
    if (op > 0) LAMPS.forEach(L => {
      if (!lampOn(L) || L.art === 'senter') return;
      const c = L.col ? lampCol(L) : '#FFE08A';
      PUPS.forEach(P => {
        const pr = proj(L, P);
        if (!pr) return;
        const e = extent(P.shape, P.k, P.rot);
        [P.y + e.y0, P.y + e.y1].forEach(yy => {
          const ky = L.y + (yy - L.y) * pr.m;
          s += `<path d="M${n1(L.x)} ${n1(L.y)}L${n1(P.x)} ${n1(yy)}" stroke="${c}" stroke-width="3.2" opacity="${op}" stroke-linecap="round"/>`;
          s += `<path d="M${n1(P.x)} ${n1(yy)}L${SX} ${n1(ky)}" stroke="${c}" stroke-width="3" opacity="${n1(op * .8)}" stroke-dasharray="10 8" stroke-linecap="round"/>`;
          if (ky > KY0 && ky < KY1) s += Ci(SX, ky, 6, `fill="${c}" opacity="${op}"`);
        });
      });
    });
    raysG.innerHTML = s;
  }

  /* ================= state ================= */
  let LV = null, RI = 0, RD = null, LAMPS = [], PUPS = [], TGTS = [], light = true, helpRays = false;
  let tries = 0, rTries = 0, busy = false, tok = 0;
  let DEMO = false;   // building/playing the worked example ("Contoh"): other numbers, one round only
  let MK = null, TRAYS = [], BOARDS = [], MIRRORS = [], BLOCKS = [], TB = null, TREE = null, STEP = null;
  const canInput = () => !!RD && !busy;

  function clearStage() {
    [coneG, shadowG, spotG, targetG, kelirUI, propsG, raysG, lampG, pupG, coverG, uiG, fxG].forEach(g => { g.innerHTML = ''; });
    shadowG.removeAttribute('opacity');
    outG.setAttribute('display', 'none'); outG.innerHTML = '';
    LAMPS = []; PUPS = []; TGTS = []; light = true; helpRays = false;
    MK = null; TRAYS = []; BOARDS = []; MIRRORS = []; BLOCKS = []; TB = null; TREE = null; STEP = null;
  }

  /* ---------- props shared by several kinds ---------- */
  function drawRack() {
    GS.markup(propsG, f3(a => Rc(-620, RACK, 1490, 36, 18, a), [-620, RACK, 1490, 36], P3.banana, { hl: false, k: .18 }) +
      line('M-500 694v28M-300 694v28M-100 694v28M100 694v28M300 694v28M500 694v28M700 694v28', 2.4, '#8F8952'));
  }
  /** Rack slot for spare wayang: the figure stands with its stick in the banana trunk. */
  function rackPos(i, shape, k) { return { x: [70, 210, 350, 490, 630][i], y: RACK - 8 - k * SH[shape].bb.y1 }; }
  /** Six equal steps from the lamp to the kelir (k2: halves and thirds). */
  function drawSteps() {
    const L = LAMPS[0];
    let s = line(`M${L.x} 612H${SX}`, 4, '#FFE7B0', .45);
    for (let i = 0; i <= 6; i++) { const x = L.x + (SX - L.x) * i / 6; s += Ci(x, 612, i % 3 === 0 ? 11 : 8, `fill="#FFE7B0" ${ol(2.5)}`); }
    GS.markup(propsG, s);
  }
  /** Measuring levels: metre ruler on the floor and centimetre ruler on the kelir. */
  function drawNumeric() {
    const L = LAMPS[0];
    let s = Rc(L.x - 10, FOOT + 18, SX - L.x + 20, 58, 10, fill('#FFF3DC', .94)) + line(`M${L.x} ${FOOT + 26}H${SX}`, 3);
    for (let i = 0; i <= 30; i++) { const x = L.x + i * UM / 10, big = i % 10 === 0, mid = i % 5 === 0; s += line(`M${n1(x)} ${FOOT + 26}v${big ? 22 : mid ? 15 : 8}`, big ? 3.4 : 2.2); }
    for (let i = 0; i <= 3; i++) s += txt(L.x + i * UM + (i === 0 ? 14 : i === 3 ? -34 : 0), FOOT + 72, i === 0 ? '0' : i + ' m', 40, { w: 600 });
    (RD.marks || []).forEach(d => { const x = L.x + d * UM; s += Pa(`M${n1(x)} ${FOOT + 24}l-9 -14h18Z`, solid('#FFC83D', 2.4)); });
    GS.markup(propsG, s);
    let k = Rc(KX1 - 92, KY0 + 6, 88, FOOT - KY0 + 70, 10, fill('#FFF3DC', .92)) + line(`M${KX0} ${FOOT}H${KX1}`, 3, '#7E5A2E', .55);
    for (let cm = 0; cm * 2.2 <= FOOT - KY0 - 6; cm += 10) { const y = FOOT - cm * 2.2; k += line(`M${KX1 - (cm % 50 ? 18 : 32)} ${n1(y)}H${KX1 - 6}`, cm % 50 ? 2.4 : 3.6, '#5A3E2E'); }
    [50, 100, 150].forEach(cm => { k += txt(KX1 - 36, FOOT - cm * 2.2 + 14, String(cm), 40, { anchor: 'end', fill: '#5A3E2E', w: 600 }); });
    k += txt(KX1 - 30, FOOT + 46, 'cm', 34, { anchor: 'end', fill: '#5A3E2E', cls: 't-body', w: 700 });
    GS.markup(kelirUI, `<g class="wy-ruler">${k}</g>`);
  }
  const distM = P => (P.x - LAMPS[0].x) / UM;
  /** Live labels for the measuring levels: wayang height bracket and its distance from the lamp. */
  function numericLabels() {
    const P = PUPS[0];
    if (!P || !RD.numeric) return '';
    const top = P.y + P.k * SH[P.shape].bb.y0, bot = P.y + P.k * SH[P.shape].bb.y1, bx = P.x - 60;
    let s = line(`M${bx} ${n1(top)}V${n1(bot)}M${bx - 8} ${n1(top)}h16M${bx - 8} ${n1(bot)}h16`, 3.4, '#FFE7B0');
    s += pill(bx - 66, (top + bot) / 2, RD.H + ' cm', 40, { w: 124 });
    if (RD.showDist !== false) s += Pa(`M${n1(P.x)} ${FOOT + 84}l-10 14h20Z`, fill('#FFE08A')) + pill(P.x, FOOT + 120, dec(Math.round(distM(P) * 100) / 100) + ' m', 40, { w: 128, bg: '#FFE08A' });
    return s;
  }
  function measuredLabel(hs) {
    const y = FOOT - hs * 2.2;
    return `<g class="wy-meas">${line(`M${KX0 + 8} ${n1(y)}H${KX1 - 8}`, 4, '#0F8C7A')}${pill(KX0 + 80, y - 36, Math.round(hs) + ' cm', 40, { w: 144 })}</g>`;
  }
  function clearHints() { kelirUI.querySelectorAll('.wy-hint').forEach(n => n.remove()); }
  function arrowV(x, y1, y2) {
    if (Math.abs(y2 - y1) < 16) return '';
    const d = Math.sign(y2 - y1);
    return `<g class="wy-hint">${line(`M${x} ${n1(y1)}V${n1(y2 - d * 14)}`, 12)}${line(`M${x} ${n1(y1)}V${n1(y2 - d * 14)}`, 6, '#F2A900')}<path d="M${x - 16} ${n1(y2 - d * 18)}L${x} ${n1(y2)}L${x + 16} ${n1(y2 - d * 18)}Z" ${solid('#F2A900', 3)}/></g>`;
  }

  /* ---------- feedback ---------- */
  const PRAISE = ['Pas sekali! Penonton senang.', 'Hebat! Bayangannya pas.', 'Tepat! Prok prok prok!', 'Bagus! Pertunjukan dimulai.'];
  function gong() { GS.tone({ f: 98, t: 1.6, vol: .28 }); GS.tone({ f: 147, t: 1.2, vol: .08, delay: .02 }); GS.tone({ f: 196, t: .9, vol: .05, delay: .03 }); }
  function clap() { for (let i = 0; i < 9; i++) GS.noise({ t: .05, vol: .1, freq: 1500 + Math.random() * 900, q: .8, delay: .25 + i * .1 + Math.random() * .05 }); }
  function cheer() {
    audG.classList.remove('cheer'); void audG.getBoundingClientRect(); audG.classList.add('cheer');
    setTimeout(() => audG.classList.remove('cheer'), 1600);
    gong(); clap();
  }
  function confettiAt(x, y) {
    const m = svg.getScreenCTM();
    if (m) GS.confetti(m.a * x + m.e, m.d * y + m.f, 60);
  }
  function fail(sayText, keepBusy) {
    tries++; rTries++;
    if (rTries >= 2) helpRays = true;
    if (tries === 2) run.offerDemo();
    GS.sfx.oops(); hud.mood('oops');
    GS.say(sayText);
    GS.fx(shadowG, 'wy-shake', 450);
    if (!keepBusy) busy = false;
    render(); updateDock();
  }
  async function roundWon(text) {
    busy = true; updateDock();
    const my = tok;
    TGTS.forEach(t => { t.done = true; if (t.line) { t.line.setAttribute('stroke', '#0F8C7A'); t.line.setAttribute('stroke-dasharray', 'none'); t.line.setAttribute('stroke-width', 7); } });
    clearHints();
    hud.mood('cheer'); cheer();
    GS.say(text || pick(PRAISE));
    confettiAt(PCX, 260);
    await wait(1600);
    if (my !== tok) return;
    if (!DEMO && RI + 1 < LV.rounds.length) startRound(RI + 1);
    else run.win(tries === 0 ? 3 : tries <= 2 ? 2 : 1, LV.win || 'Pertunjukan wayangmu hebat!');
  }

  /* ================= kind: match (make the shadow fit the dashed outline) ================= */
  function computeTargets() {
    TGTS = (RD.targets || []).map(t => {
      const Ls0 = RD.lamps[t.lamp || 0], Ls = Object.assign({}, Ls0, Ls0.sol || {});
      const Pspec = RD.pups[t.p >= 0 ? t.p : t.solP], Ps = Pspec.sol;
      const m = (SX - Ls.x) / (Ps.x - Ls.x);
      return Object.assign({}, t, { shape: t.shape || Pspec.shape, k: Pspec.k, sc: m * Pspec.k, cy: Ls.y + (Ps.y - Ls.y) * m, rot: Ps.rot || 0, m });
    });
  }
  function setupMatch() {
    LAMPS = RD.lamps.map(buildLamp);
    if (RD.rack) drawRack();
    if (RD.steps) drawSteps();
    if (RD.numeric) drawNumeric();
    RD.pups.forEach(p => {
      const tip = p.y + p.k * SH[p.shape].bb.y1 + STICK;
      if (p.drag === 'x' && !RD.numeric) GS.markup(propsG, line(`M${LAMPS[0].x + 90} ${n1(tip)}H${SX - 70}`, 5, '#FFE7B0', .3).replace('stroke-linecap', 'stroke-dasharray="2 14" stroke-linecap'));
      if (p.drag === 'y') GS.markup(propsG, line(`M${n1(p.x)} 150V600`, 5, '#FFE7B0', .3).replace('stroke-linecap', 'stroke-dasharray="2 14" stroke-linecap'));
    });
    PUPS = RD.pups.map(buildPup);
    buildShadows(); computeTargets(); drawTargets();
    light = !RD.dark;
    if (RD.lampChoice) drawLampChoice();
    if (RD.numeric) {
      const dyn = el('g', {}, uiG);
      RD.onRender = () => { dyn.innerHTML = numericLabels(); };
    }
  }
  /** How far puppet P's shadow (from lamp L) is from target t. */
  function errOf(L, P, t, pr) {
    const es = pr.sc / t.sc - 1, ep = pr.cy - t.cy, er = P.rot - t.rot;
    const ts = RD.tolS || TOLS.s, tp = RD.tolP || TOLS.p;
    const okS = Math.abs(es) <= ts, okP = Math.abs(ep) <= tp, okR = Math.abs(er) <= TOLS.r + .01;
    const okM = !t.opaque || MAT[P.mat].a > .6, okB = !t.sharp || pr.blur <= TOLS.blur;
    return { ok: okS && okP && okR && okM && okB, P, L, t, pr, es, ep, er, okS, okP, okR, okM, okB, score: Math.abs(es) / ts + Math.abs(ep) / tp + Math.abs(er) / TOLS.r + (okM ? 0 : 3) };
  }
  function evalTarget(t) {
    const L = LAMPS[t.lamp || 0];
    if (!lampOn(L)) return { ok: false, why: 'dark' };
    const cands = t.p >= 0 ? [PUPS[t.p]] : PUPS.filter(P => P.shape === t.shape);
    let best = null;
    cands.forEach(P => { const pr = proj(L, P); if (!pr) return; const e = errOf(L, P, t, pr); if (!best || e.score < best.score) best = e; });
    if (!best) return { ok: false, why: PUPS.some(P => proj(L, P)) ? 'shape' : 'none', t };
    return best;
  }
  /** Spoken, informative feedback: which way to move, never "salah". */
  function hintFor(r) {
    const tk = TIER === 'tk';
    if (r.why === 'none') return tk ? 'Belum ada bayangan. Taruh wayang di depan lampu.' : 'Belum ada bayangan di kelir. Taruh wayang di depan lampu.';
    if (r.why === 'shape') return tk ? 'Hmm, bentuknya lain. Coba wayang yang lain.' : 'Bentuk bayangannya beda. Coba wayang lain.';
    if (r.why === 'extra') return 'Cukup satu wayang di depan lampu.';
    const P = r.P, lampY = LAMPS.some(L => L.drag), px = P.drag && P.drag !== 'y', py = P.drag && P.drag !== 'x';
    if (!r.okM) return MAT[P.mat].a < .15 ? 'Hampir tidak ada bayangan. Bahan itu bening.' : 'Bayangannya samar. Cari bahan yang tidak tembus cahaya.';
    const ns = Math.abs(r.es) / (RD.tolS || TOLS.s), np = Math.abs(r.ep) / (RD.tolP || TOLS.p), nr = Math.abs(r.er) / TOLS.r;
    if (!r.okS && ns >= np && ns >= nr && px) return r.es > 0 ? (tk ? 'Terlalu besar. Jauhkan dari lampu.' : 'Bayangannya kebesaran. Jauhkan dari lampu.') : (tk ? 'Masih kecil. Dekatkan ke lampu.' : 'Bayangannya kekecilan. Dekatkan ke lampu.');
    if (!r.okR && nr >= np) return r.er > 0 ? 'Miringnya kebanyakan. Putar balik sedikit.' : 'Miringnya kurang. Putar lagi sedikit.';
    if (!r.okP) {
      const high = r.ep < 0;
      if (py) return high ? 'Bayangannya terlalu tinggi. Turunkan wayangnya.' : 'Bayangannya terlalu rendah. Naikkan wayangnya.';
      if (lampY) return high ? 'Bayangannya terlalu tinggi. Naikkan lampunya.' : 'Bayangannya terlalu rendah. Turunkan lampunya.';
    }
    if (!r.okS) return r.es > 0 ? 'Bayangannya kebesaran. Jauhkan dari lampu.' : 'Bayangannya kekecilan. Dekatkan ke lampu.';
    if (!r.okB) return RD.lampChoice ? 'Tepinya masih kabur. Coba lampu yang kecil.' : 'Tepinya masih kabur. Dekatkan wayang ke kelir.';
    return 'Hampir pas. Geser sedikit lagi.';
  }
  function showHint(r) {
    if (!r || !r.pr) return;
    const t = r.t, e = r.pr.e, te = extent(t.shape, t.sc, t.rot);
    let s = '';
    if (!r.okS) s += arrowV(KX1 - 46, r.pr.cy + e.y0, t.cy + te.y0);
    else if (!r.okP) s += arrowV(KX1 - 46, r.pr.cy, t.cy);
    if (s) GS.markup(kelirUI, s);
  }
  function judgeMatch() {
    const res = TGTS.map(evalTarget);
    if (res.every(r => r.ok)) {
      // a choose round: other wayang may not cover the kelir as well
      if (RD.choose && PUPS.filter(P => LAMPS.some(L => lampOn(L) && proj(L, P))).length > TGTS.length) return { ok: false, why: 'extra' };
      return { ok: true };
    }
    return res.filter(r => !r.ok).sort((a, b) => (b.score || 99) - (a.score || 99))[0];
  }
  async function checkMatch() {
    if (!canInput()) return;
    const my = tok;
    if (RD.dark && !light) {
      busy = true; updateDock();
      light = true; render(); GS.sfx.whoosh(); GS.tone({ f: 330, f2: 660, t: .3, type: 'triangle', vol: .08 });
      shadowG.setAttribute('opacity', 0);
      await tw(450, e => shadowG.setAttribute('opacity', e));
      shadowG.removeAttribute('opacity');
      await wait(300);
      if (my !== tok) return;
      busy = false;
    }
    const r = judgeMatch();
    if (r.ok) return roundWon(RD.winSay);
    showHint(r);
    fail(hintFor(r));
  }
  /** TK level 1: the shadow appears as soon as the wayang stands in front of the lamp. */
  function autoPlace() {
    const L = LAMPS[0], P = PUPS[0], pr = proj(L, P);
    if (pr && fits(P.shape, pr.sc, pr.cy, P.rot, 0) && P.x > L.x + 60) { roundWon(RD.winSay); return; }
    if (P.from && Math.hypot(P.x - P.from.x, P.y - P.from.y) > 30) {
      tries += P.x <= L.x ? 1 : 0;
      GS.sfx.oops();
      GS.say(P.x <= L.x ? 'Di belakang lampu tidak ada bayangan. Bawa ke depan lampu.' : pr ? 'Bayangannya kebesaran. Jauhkan sedikit dari lampu.' : 'Taruh wayang di antara lampu dan kelir.');
    }
  }
  function onGrab() {
    if (RD && RD.kind === 'match' && RD.dark && light) { light = false; render(); }
    if (RD && RD.kind === 'table' && TB) kelirUI.querySelectorAll('.wy-meas').forEach(n => n.remove());
  }
  function afterMove() {
    if (!RD) return;
    if (RD.kind === 'match' && RD.auto === 'place' && !busy) autoPlace();
    updateDock();
  }
  function dropPup(P) {
    if (RD.snapM) {
      const L = LAMPS[0];
      let d = (P.x - L.x) / UM;
      if (RD.marks) d = RD.marks.reduce((b, v) => (Math.abs(v - d) < Math.abs(b - d) ? v : b), RD.marks[0]);
      else d = Math.round(d / RD.snapM) * RD.snapM;
      P.x = clamp(L.x + d * UM, L.x + 90, SX - 70);
    }
    GS.sfx.drop();
    GS.fx(P.rotG, 'wy-wob', 420);
    if (RD.kind === 'sort') sortDrop(P);
    render();
    afterMove();
  }
  /* k3: big lamp or small lamp (tap to swap the lamp on the hook) */
  function drawLampChoice() {
    const g = el('g', {}, uiG);
    [['besar', 26, 'besar'], ['kecil', 2.5, 'kecil']].forEach(([art, r, word], i) => {
      const c = el('g', { transform: `translate(84 ${430 + i * 150})`, 'data-hit': 'lampu-' + art }, g);
      const draw = () => {
        const on = LAMPS[0].art === art;
        c.innerHTML = Rc(-62, -62, 124, 132, 16, `fill="${on ? '#FFE08A' : CREAM}" ${ol(3)}`) +
          `<g transform="translate(18 -14) scale(.62)">${lampArt({ art: art === 'besar' ? 'blencong' : 'blencong' })}${flameArt({ art, r: art === 'besar' ? 26 : 2 })}</g>` +
          txt(0, 56, word, 33, { cls: 't-body', w: 700 });
      };
      c.__draw = draw; draw();
      c.style.cursor = 'pointer';
      c.addEventListener('click', () => {
        if (!canInput() || LAMPS[0].art === art) return;
        GS.sfx.pop();
        const old = LAMPS[0];
        old.g.remove(); old.cone.remove();
        LAMPS[0] = buildLamp({ x: old.x, y: old.y, art, r });
        buildShadows(); clearHints(); render();
        g.querySelectorAll('g[data-hit]').forEach(n => n.__draw && n.__draw());
        GS.say(art === 'besar' ? 'Lampu besar.' : 'Lampu kecil.');
      });
    });
  }

  /* ================= kind: marker (predict on the kelir before looking) ================= */
  function setupMarker() {
    LAMPS = RD.lamps.map(buildLamp);
    if (RD.numeric) drawNumeric();
    PUPS = RD.pups.map(buildPup);
    buildShadows();
    light = RD.variant === 'lift';
    const P = PUPS[0], L = LAMPS[0];
    MK = { g: el('g', {}, kelirUI) };
    if (RD.variant === 'lift') {
      const pr = proj(L, P);
      MK.y = MK.y0 = pr.cy; MK.sc = pr.sc;
      // the coming move of the wayang, shown as a big amber arrow beside it
      const e = extent(P.shape, P.k, 0), ax = P.x - P.k * (SH[P.shape].bb.x1 - SH[P.shape].bb.x0) / 2 - 40;
      GS.markup(uiG, `<g class="wy-move">${arrowV(ax, P.y + (RD.dy < 0 ? e.y1 : e.y0) * .3, P.y + (RD.dy < 0 ? e.y0 : e.y1) * .9).replace('wy-hint', 'wy-movearrow')}</g>`);
    } else {
      MK.cm = RD.H; MK.y = FOOT - MK.cm * 2.2;
    }
    MK.ghost = el('g', {}, MK.g);
    MK.tab = el('g', { class: 'wy-tab' }, MK.g);
    // art is redrawn on every move; the hit rect stays the same element (the pressed one keeps its events)
    MK.art = el('g', {}, MK.tab);
    MK.hit = el('rect', { width: RD.variant === 'lift' ? 108 : 120, height: 116, rx: 18, fill: 'transparent' }, MK.tab);
    GS.drag(MK.tab, {
      svg,
      onStart(p) { if (!canInput()) return false; MK.dy = MK.y - p.y; GS.sfx.pick(); clearHints(); kelirUI.querySelectorAll('.wy-meas').forEach(n => n.remove()); if (RD.variant === 'height' && light) { light = false; } return true; },
      onMove(p) {
        const y = p.y + MK.dy;
        if (RD.variant === 'height') {
          const cm = clamp(Math.round((FOOT - y) / 2.2 / 10) * 10, 10, 200);   // the ruler's 10 cm grid
          if (cm !== MK.cm) { MK.cm = cm; GS.sfx.tick(); }
          MK.y = FOOT - MK.cm * 2.2;
        } else MK.y = clamp(y, KY0 + 30, KY1 - 30);
        render();
      },
      onEnd() { GS.sfx.drop(); render(); }
    });
    RD.onRender = drawMarker;
    if (RD.numeric) { const dyn = el('g', {}, uiG); const f = drawMarker; RD.onRender = () => { f(); dyn.innerHTML = numericLabels(); }; }
  }
  function drawMarker() {
    if (!MK) return;
    const P = PUPS[0];
    if (RD.variant === 'lift') {
      MK.ghost.innerHTML = `<g transform="translate(${n1(PCX)} ${n1(MK.y)}) rotate(${P.rot}) scale(${n1(MK.sc * 1000) / 1000})"><use href="#wy-ol-${P.shape}" fill="#F2A900" fill-opacity=".16" stroke="#E07B00" stroke-width="5" stroke-dasharray="12 9" vector-effect="non-scaling-stroke"/></g>`;
      MK.art.innerHTML = line(`M${SX - 6} ${n1(MK.y)}H${KX0 + 30}`, 4, '#E07B00') + Rc(782, MK.y - 52, 96, 104, 18, solid('#FFE08A', 3)) +
        Pa(`M830 ${n1(MK.y - 42)}l-14 16h28Z`, fill(OUT)) + Pa(`M830 ${n1(MK.y + 42)}l-14 -16h28Z`, fill(OUT)) + txt(830, MK.y + 11, 'tebak', 32, { cls: 't-body', w: 700 });
      MK.hit.setAttribute('x', 776); MK.hit.setAttribute('y', n1(MK.y - 58));
    } else {
      MK.ghost.innerHTML = line(`M${KX0 + 8} ${n1(MK.y)}H${KX1 - 50}`, 5, '#E07B00') + line(`M${KX0 + 8} ${n1(MK.y)}H${KX1 - 50}`, 2, '#FFE08A');
      MK.art.innerHTML = line(`M${SX - 6} ${n1(MK.y)}H${KX0 + 20}`, 4, '#E07B00') + Rc(768, MK.y - 54, 112, 108, 18, solid('#FFE08A', 3)) +
        txt(824, MK.y + 4, String(MK.cm), 44, { w: 600 }) + txt(824, MK.y + 40, 'cm', 32, { cls: 't-body', w: 700 }) +
        Pa(`M824 ${n1(MK.y - 64)}l-12 10h24Z`, fill('#FFE08A')) + Pa(`M824 ${n1(MK.y + 64)}l-12 -10h24Z`, fill('#FFE08A'));
      MK.hit.setAttribute('x', 764); MK.hit.setAttribute('y', n1(MK.y - 58));
    }
  }
  async function goMarker() {
    if (!canInput()) return;
    busy = true; updateDock();
    const my = tok, P = PUPS[0], L = LAMPS[0];
    clearHints();
    if (RD.variant === 'lift') {
      uiG.querySelectorAll('.wy-move').forEach(n => n.remove());
      const y0 = P.y, y1 = P.y + RD.dy;
      GS.sfx.whoosh();
      await tw(700, e => { P.y = y0 + (y1 - y0) * e; render(); }, 'inOutCubic');
      if (my !== tok) return;
      const pr = proj(L, P), shift = pr.cy - MK.y0, err = MK.y - pr.cy;
      const dirOk = Math.sign(MK.y - MK.y0) === Math.sign(shift) && Math.abs(MK.y - MK.y0) > 8;
      if (dirOk && Math.abs(err) <= Math.max(TOLS.p * 1.6, Math.abs(shift) * .35)) return roundWon(RD.dy < 0 ? 'Betul! Wayang naik, bayangan ikut naik.' : 'Betul! Wayang turun, bayangan ikut turun.');
      GS.markup(kelirUI, arrowV(KX1 - 46, MK.y, pr.cy));
      fail(dirOk ? 'Arahnya betul, tapi bayangannya bergerak lebih jauh.' : (RD.dy < 0 ? 'Lihat, bayangannya ikut naik.' : 'Lihat, bayangannya ikut turun.'), true);
      await wait(2200);
      if (my !== tok) return;
      P.y = y0; clearHints(); busy = false; render(); updateDock();
      GS.say('Coba tebak lagi.');
      return;
    }
    // height: the lamp lights, the shadow grows up the ruler
    light = true; render(); GS.sfx.whoosh();
    shadowG.setAttribute('opacity', 0);
    await tw(450, e => shadowG.setAttribute('opacity', e));
    shadowG.removeAttribute('opacity');
    const m = (SX - L.x) / (P.x - L.x), hs = Math.round(RD.H * m);
    GS.markup(kelirUI, measuredLabel(hs));
    await wait(400);
    if (my !== tok) return;
    if (Math.abs(MK.cm - hs) <= 5) {
      showSentence(RD.H + ' cm × ' + dec(m) + ' = ' + hs + ' cm');
      return roundWon('Tepat! Bayangannya ' + hs + ' cm.');
    }
    showSentence(RD.H + ' cm × ' + dec(m) + ' = ' + hs + ' cm');
    fail('Bayangannya ' + hs + ' cm. Jaraknya ' + dec(3 / m) + ' m, kelirnya 3 m.', true);
    await wait(3200);
    if (my !== tok) return;
    startRound(RI, true);
    GS.say('Coba lagi dengan wayang lain.');
  }
  /** Number sentence card above the stage (concreteness fading: symbols for k3 and k4). */
  function showSentence(s) {
    uiG.querySelectorAll('.wy-sent').forEach(n => n.remove());
    const w = Math.max(320, s.length * 22 + 60);
    GS.markup(uiG, `<g class="wy-sent">${Rc(640 - w / 2 - 20, 68, w, 70, 20, solid(CREAM, 3))}${txt(620, 116, s, 40, { w: 600 })}</g>`);
  }

  /* ================= kind: sort (bening, samar, pekat) ================= */
  const SHELF = [[90, 186], [228, 186], [90, 364], [228, 364], [90, 542], [228, 542]];
  const TEST = { x: 640, y: 330 };
  function setupSort() {
    LAMPS = RD.lamps.map(buildLamp);
    TRAYS = [['bening', 430], ['samar', 600], ['pekat', 770]].map(([kind, x]) => ({ kind, x, y: 735, w: 160, items: [] }));
    let s = '', front = '';
    TRAYS.forEach(T => {
      const a = { bening: .06, samar: .38, pekat: .9 }[T.kind];
      s += shadowE(T.x, 772, 84) + f3(q => Pa(`M${T.x - 80} 702H${T.x + 80}L${T.x + 70} 770H${T.x - 70}Z`, q), [T.x - 80, 702, 160, 68], ['#B07A48', '#CC9866', '#7E4A27'], { hl: false, k: .1 });
      front += Rc(T.x - 74, 718, 148, 46, 10, fill('#7E4A27')) + Ci(T.x - 56, 741, 14, `fill="#FFF3DC" ${ol(2.4)}`) + Ci(T.x - 56, 741, 14, fill('#22160F', a)) + txt(T.x + 16, 752, T.kind, 33, { cls: 't-body', fill: CREAM, w: 700 });
    });
    s += f3(q => Rc(14, 120, 14, 540, 4, q), [14, 120, 14, 540], P3.wood, { hl: false, k: .3 }) + f3(q => Rc(298, 120, 14, 540, 4, q), [298, 120, 14, 540], P3.wood, { hl: false, k: .3 });
    [300, 478, 656].forEach(y => { s += f3(q => Rc(4, y, 318, 16, 5, q), [4, y, 318, 16], P3.wood, { hl: false, k: .25 }); });
    GS.markup(propsG, s);
    GS.markup(coverG, `<g pointer-events="none">${front}</g>`);   // tray fronts in front of the sticks, so the words stay readable
    PUPS = RD.items.map((it, i) => buildPup(Object.assign({ drag: 'free', bounds: [-70, SX - 60, 110, 712 - it.k * SH[it.shape].bb.y1], x: SHELF[i][0], y: SHELF[i][1], say: cap(MAT[it.mat].name) + '.' }, it)));
    PUPS.forEach((P, i) => { P.home = { x: SHELF[i][0], y: SHELF[i][1] }; });
    buildShadows();
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function sortDrop(P) {
    TRAYS.forEach(T => { T.items = T.items.filter(q => q !== P); });
    P.tray = null;
    const T = TRAYS.find(T => Math.abs(P.x - T.x) < T.w / 2 + 16 && P.y + P.k * SH[P.shape].bb.y1 > 640);
    if (T) { P.tray = T; T.items.push(P); GS.sfx.coin(); GS.say(cap(T.kind) + '.'); }
    TRAYS.forEach(arrangeTray);
  }
  function arrangeTray(T) {
    T.items.forEach((P, i) => {
      const n = T.items.length, off = n === 1 ? 0 : (i - (n - 1) / 2) * 44;
      P.x = T.x + off; P.y = 712 - P.k * SH[P.shape].bb.y1;
      pupG.appendChild(P.g);
    });
  }
  async function checkSort() {
    if (!canInput() || PUPS.some(P => !P.tray)) return;
    busy = true; updateDock();
    const my = tok;
    let wrong = 0;
    for (const P of PUPS.slice()) {
      if (P.ok) continue;
      const from = { x: P.x, y: P.y }, T = P.tray;
      pupG.appendChild(P.g);
      await tw(420, e => { P.x = from.x + (TEST.x - from.x) * e; P.y = from.y + (TEST.y - from.y) * e; render(); }, 'inOutCubic');
      if (my !== tok) return;
      GS.say(cap(MAT[P.mat].name) + ': ' + (MAT[P.mat].kind === 'bening' ? 'hampir tidak berbayang.' : MAT[P.mat].kind === 'samar' ? 'bayangannya samar.' : 'bayangannya pekat.'));
      await wait(DEMO ? 500 : 1000);   // the example already tested each one
      if (my !== tok) return;
      const good = MAT[P.mat].kind === T.kind;
      if (good) {
        P.ok = true; P.locked = true; GS.sfx.coin();
        await tw(380, e => { P.x = TEST.x + (from.x - TEST.x) * e; P.y = TEST.y + (from.y - TEST.y) * e; render(); });
        GS.markup(fxG, `<g>${Ci(P.x + 36, P.y - 40, 18, solid('#0F8C7A', 3))}${line(`M${n1(P.x + 27)} ${n1(P.y - 40)}l7 7l12 -13`, 4.5, '#FFFFFF')}</g>`);
      } else {
        wrong++;
        T.items = T.items.filter(q => q !== P); P.tray = null;
        await tw(420, e => { P.x = TEST.x + (P.home.x - TEST.x) * e; P.y = TEST.y + (P.home.y - TEST.y) * e; render(); });
        GS.fx(P.rotG, 'gs-wobble', 420); GS.sfx.oops();
      }
      if (my !== tok) return;
      TRAYS.forEach(arrangeTray); render();
    }
    if (!wrong) return roundWon('Semua bahan sudah di tempatnya!');
    fail(wrong === 1 ? 'Satu bahan kembali ke meja. Coba lagi di depan lampu.' : 'Beberapa bahan kembali ke meja. Uji dulu di depan lampu.');
  }

  /* ================= kind: holes (light travels in straight lines) ================= */
  const HW = 20;   // half height of the hole in each card
  function setupHoles() {
    LAMPS = RD.lamps.map(buildLamp);
    const L = LAMPS[0];
    const bg = el('g', { 'clip-path': 'url(#wyStageClip)' }, propsG);
    BOARDS = RD.boards.map((b, i) => {
      const B = { x: b.x, h: b.h, g: el('g', {}, bg) };
      B.g.innerHTML = Rc(-15, -720, 30, 720 - HW, 4, solid('#C9A06A', 3)) + Rc(-15, HW, 30, 720, 4, solid('#C9A06A', 3)) +
        line('M-8 -700V-40M6 -700V-30M-8 40V700M6 30V700', 2, '#9E7444', .6) + Rc(-15, -HW, 30, 2 * HW, 6, `fill="none" stroke="#FFE7B0" stroke-width="3" stroke-dasharray="5 4"`) +
        Ci(0, 64, 22, solid('#FFC83D', 3)) + Pa('M0 50l-9 9h18ZM0 78l-9 -9h18Z', fill(OUT)) + Rc(-56, -112, 112, 224, 10, fill('transparent'));
      B.g.style.cursor = 'grab';
      GS.drag(B.g, {
        svg,
        onStart(p) { if (!canInput()) return false; B.dy = B.h - p.y; GS.sfx.pick(); clearHints(); return true; },
        onMove(p) { B.h = clamp(p.y + B.dy, 110, 600); render(); },
        onEnd() { GS.sfx.drop(); render(); }
      });
      return B;
    });
    const star = (x, y, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; d += (i ? 'L' : 'M') + n1(x + Math.cos(a) * q) + ' ' + n1(y + Math.sin(a) * q); } return d + 'Z'; };
    GS.markup(kelirUI, `<g class="wy-star">${Pa(star(PCX, RD.ty, 34), `fill="#FFC83D" fill-opacity=".35" stroke="#FFC83D" stroke-width="4" stroke-linejoin="round"`)}</g>`);
    RD.onRender = () => {
      const r = beamHoles();
      let s = '';
      r.wedges.forEach(w => { s += `<path d="${w.d}" fill="#FFE08A" opacity="${w.op}"/>`; });
      raysG.insertAdjacentHTML('beforeend', s);
      BOARDS.forEach(B => B.g.setAttribute('transform', `translate(${n1(B.x)} ${n1(B.h)})`));
      spotG.innerHTML = r.spot ? Ci(PCX, (r.spot[0] + r.spot[1]) / 2, Math.max(6, (r.spot[1] - r.spot[0]) / 2) + 10, fill('#FFF3C8', .35)) + Ci(PCX, (r.spot[0] + r.spot[1]) / 2, Math.max(5, (r.spot[1] - r.spot[0]) / 2), fill('#FFFBEA')) : '';
      void L;
    };
  }
  /** Rays from the lamp are lines y = ly + s (x - lx); a card passes the slopes that go through its hole. */
  function beamHoles() {
    const L = LAMPS[0], D = SX - L.x;
    let lo = (KY0 - L.y) / D, hi = (KY1 - L.y) / D, x0 = L.x + 4;
    const wedges = [];
    const wedge = (xa, xb, a, b, op) => ({ d: `M${n1(xa)} ${n1(L.y + a * (xa - L.x))}L${n1(xb)} ${n1(L.y + a * (xb - L.x))}L${n1(xb)} ${n1(L.y + b * (xb - L.x))}L${n1(xa)} ${n1(L.y + b * (xa - L.x))}Z`, op });
    for (let i = 0; i < BOARDS.length; i++) {
      const B = BOARDS[i];
      wedges.push(wedge(x0, B.x - 15, lo, hi, i ? .5 : .16));
      lo = Math.max(lo, (B.h - HW - L.y) / (B.x - L.x)); hi = Math.min(hi, (B.h + HW - L.y) / (B.x - L.x));
      x0 = B.x + 15;
      if (lo >= hi) return { wedges, spot: null };
    }
    wedges.push(wedge(x0, SX, lo, hi, .5));
    return { wedges, spot: [L.y + lo * D, L.y + hi * D] };
  }
  function checkHoles() {
    if (!canInput()) return;
    const r = beamHoles();
    if (r.spot && RD.ty >= r.spot[0] - 4 && RD.ty <= r.spot[1] + 4) return roundWon('Cahayanya lurus menembus tiga lubang!');
    const blocked = BOARDS.findIndex((B, i) => { const sub = BOARDS.slice(0, i + 1); const save = BOARDS; BOARDS = sub; const rr2 = beamHoles(); BOARDS = save; return !rr2.spot; });
    fail(blocked >= 0 ? 'Cahayanya tertahan karton ke-' + (blocked + 1) + '. Luruskan lubangnya.' : (r.spot[0] > RD.ty ? 'Cahayanya kena di bawah bintang.' : 'Cahayanya kena di atas bintang.'));
  }

  /* ================= kind: mirror (angle of incidence = angle of reflection) ================= */
  function mirrorNormal(M) { return { x: Math.sin(M.a * RAD), y: -Math.cos(M.a * RAD) }; }
  function rayHits(o, d) {
    let best = null;
    const take = (t, what) => { if (t > 1e-3 && (!best || t < best.t)) best = Object.assign({ t }, what); };
    MIRRORS.forEach(M => {
      const tx = Math.cos(M.a * RAD), ty = Math.sin(M.a * RAD), den = d.x * ty - d.y * tx;
      if (Math.abs(den) < 1e-9) return;
      const wx = M.x - o.x, wy = M.y - o.y, t = (wx * ty - wy * tx) / den, u = (wx * d.y - wy * d.x) / den;
      if (Math.abs(u) <= 70) take(t, { M });
    });
    BLOCKS.forEach(B => {
      let t0 = -1e9, t1 = 1e9;
      [[o.x, d.x, B.x, B.x + B.w], [o.y, d.y, B.y, B.y + B.h]].forEach(([p, v, a, b]) => {
        if (Math.abs(v) < 1e-9) { if (p < a || p > b) t0 = 1e9; return; }
        const ta = (a - p) / v, tb = (b - p) / v; t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
      });
      if (t0 <= t1) take(t0, { B });
    });
    const T = RD.target, cx = T.x - o.x, cy = T.y - o.y, b = cx * d.x + cy * d.y, c2 = cx * cx + cy * cy - 46 * 46, disc = b * b - c2;
    if (disc >= 0) take(b - Math.sqrt(disc), { T: true });
    if (d.x > 0) take((SX - o.x) / d.x, { K: true });
    if (d.y < 0) take((48 - o.y) / d.y, { W: true });
    if (d.y > 0) take((648 - o.y) / d.y, { W: true });
    if (d.x < 0) take((-200 - o.x) / d.x, { W: true });
    return best;
  }
  function traceBeam() {
    const L = LAMPS[0], a = L.beamAng * RAD;
    let o = { x: L.x + Math.cos(a) * 66, y: L.y + Math.sin(a) * 66 }, d = { x: Math.cos(a), y: Math.sin(a) };
    const pts = [o], bounces = [];
    let end = null;
    for (let i = 0; i < 6; i++) {
      const h = rayHits(o, d);
      if (!h) break;
      const p = { x: o.x + d.x * h.t, y: o.y + d.y * h.t };
      pts.push(p);
      if (h.M) {
        const n = mirrorNormal(h.M), dn = d.x * n.x + d.y * n.y;
        if (dn >= 0) { end = 'back'; break; }               // the wooden back of the mirror
        const out = { x: d.x - 2 * dn * n.x, y: d.y - 2 * dn * n.y };   // d' = d - 2 (d . n) n
        bounces.push({ M: h.M, p, n, din: d, dout: out, ang: Math.round(Math.acos(Math.min(1, -dn)) / RAD) });
        o = p; d = out; continue;
      }
      end = h.T ? 'target' : h.B ? 'block' : h.K ? 'kelir' : 'wall';
      break;
    }
    return { pts, bounces, end };
  }
  function setupMirror() {
    LAMPS = RD.lamps.map(buildLamp);
    BLOCKS = RD.blocks.map(b => Object.assign({}, b));
    let s = '';
    BLOCKS.forEach(B => {
      if (B.kind === 'tirai') {
        s += Rc(B.x - 10, 40, B.w + 20, 12, 5, solid('#7E4A27', 3)) + f3(q => Pa(`M${B.x} 50H${B.x + B.w}V${B.y + B.h - 12}Q${B.x + B.w * .75} ${B.y + B.h + 8} ${B.x + B.w / 2} ${B.y + B.h - 6}Q${B.x + B.w * .25} ${B.y + B.h + 8} ${B.x} ${B.y + B.h - 12}Z`, q), [B.x, 50, B.w, B.h], P3.red, { hl: false, k: .12, inner: line(`M${B.x + B.w * .33} 52V${B.y + B.h - 10}M${B.x + B.w * .66} 52V${B.y + B.h - 10}`, 3, '#B5322B') });
      } else {
        s += f3(q => Rc(B.x, B.y, B.w, B.h, 6, q), [B.x, B.y, B.w, B.h], P3.wood, { hl: false, k: .1, inner: line(`M${B.x + 8} ${B.y + 20}H${B.x + B.w - 8}M${B.x + 8} ${B.y + 60}H${B.x + B.w - 8}`, 2.4, '#7E4A27') });
      }
    });
    GS.markup(propsG, s);
    MIRRORS = RD.mirrors.map(m => {
      const M = Object.assign({}, m), g = el('g', { transform: `translate(${m.x} ${m.y})` }, propsG);
      const floor = m.y > 400;
      g.innerHTML = floor ? line(`M0 6L-26 ${648 - m.y}M0 6L26 ${648 - m.y}M0 6V${648 - m.y}`, 5, '#7E4A27') + shadowE(0, 648 - m.y, 34)
        : line(`M-40 ${48 - m.y}L0 -4M40 ${48 - m.y}L0 -4`, 3, '#9C8A66');
      M.rotG = el('g', {}, g);
      M.rotG.innerHTML = Rc(-72, -8, 144, 9, 3, `fill="#DDEFF7" ${ol(2.6)}`) + line('M-50 -5H-10M10 -5H24', 2.4, '#FFFFFF') + Rc(-72, 0, 144, 9, 3, solid('#A8673A', 2.6)) + Ci(0, 0, 9, solid('#FFC83D', 2.6));
      el('circle', { r: 80, fill: 'transparent' }, g);
      g.style.cursor = 'grab';
      M.g = g;
      GS.drag(g, {
        svg,
        onStart(p) { if (!canInput()) return false; M.last = Math.atan2(p.y - M.y, p.x - M.x) / RAD; GS.sfx.pick(); clearHints(); return true; },
        onMove(p) {
          if (Math.hypot(p.x - M.x, p.y - M.y) < 18) return;
          const a = Math.atan2(p.y - M.y, p.x - M.x) / RAD;
          let da = a - M.last; while (da > 180) da -= 360; while (da < -180) da += 360;
          M.last = a; M.a = clamp(M.a + da, M.min, M.max); render();
        },
        onEnd() { M.a = Math.round(M.a); GS.sfx.drop(); render(); }   // 1 degree grid
      });
      return M;
    });
    PUPS = [buildPup({ shape: RD.target.shape || 'ksatria', k: .5, x: RD.target.x, y: RD.target.y })];
    buildShadows();
    const tg = el('g', {}, uiG);
    RD.onRender = () => {
      MIRRORS.forEach(M => M.rotG.setAttribute('transform', `rotate(${n1(M.a)})`));
      const r = traceBeam();
      let d = 'M' + r.pts.map(p => n1(p.x) + ' ' + n1(p.y)).join('L');
      let s = `<path d="${d}" fill="none" stroke="#FFE08A" stroke-width="14" opacity=".35" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#FFF6D0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
      r.bounces.forEach(bn => {
        const p = bn.p, n = bn.n;
        s += line(`M${n1(p.x)} ${n1(p.y)}L${n1(p.x + n.x * 110)} ${n1(p.y + n.y * 110)}`, 3, '#FFE7B0', .9).replace('stroke-linecap', 'stroke-dasharray="8 7" stroke-linecap');
        const b1 = norm({ x: n.x - bn.din.x, y: n.y - bn.din.y }), b2 = norm({ x: n.x + bn.dout.x, y: n.y + bn.dout.y });
        s += pill(p.x + b1.x * 100, p.y + b1.y * 100, bn.ang + '°', 40, { w: 100 }) + pill(p.x + b2.x * 100, p.y + b2.y * 100, bn.ang + '°', 40, { w: 100 });
      });
      raysG.insertAdjacentHTML('beforeend', s);
      const hit = r.end === 'target';
      tg.innerHTML = hit ? Ci(RD.target.x, RD.target.y, 74, fill('#FFE08A', .3)) : '';
      PUPS[0].rotG.classList.toggle('wy-dim', !hit);
      const last = r.pts[r.pts.length - 1];
      spotG.innerHTML = r.end === 'kelir' ? Ci(PCX, last.y, 30, fill('#FFF3C8', .5)) + Ci(PCX, last.y, 16, fill('#FFFBEA')) : '';
    };
  }
  const norm = v => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
  function checkMirror() {
    if (!canInput()) return;
    const r = traceBeam();
    if (r.end === 'target') return roundWon(r.bounces.length > 1 ? 'Kena! Cahaya memantul di dua cermin.' : 'Kena! Sudut datang sama dengan sudut pantul.');
    fail(r.end === 'block' ? 'Cahayanya tertahan. Putar cerminnya.' : r.end === 'back' ? 'Cahayanya kena punggung cermin.' : 'Belum kena wayang. Putar cerminnya sedikit lagi.');
  }
  /** Mirror angle that sends light from a to b off the mirror at m: its normal bisects m->a and m->b. */
  function mirrorFor(m, a, b) {
    const u = norm({ x: a.x - m.x, y: a.y - m.y }), v = norm({ x: b.x - m.x, y: b.y - m.y }), n = norm({ x: u.x + v.x, y: u.y + v.y });
    return Math.atan2(n.x, -n.y) / RAD;
  }

  /* ================= kind: table (k4: measure, record, discover the ratio) ================= */
  function setupTable() {
    setupMatch();
    TB = { rows: [], phase: 'measure', guess: RD.H, el: el('g', {}, uiG) };
    const f = RD.onRender;
    RD.onRender = () => {
      f && f();
      kelirUI.querySelectorAll('.wy-meas').forEach(n => n.remove());
      if (light && TB.phase === 'measure') { const m = (SX - LAMPS[0].x) / (PUPS[0].x - LAMPS[0].x); GS.markup(kelirUI, measuredLabel(RD.H * m)); }
      drawTable();
    };
  }
  function drawTable() {
    const x0 = 372, cw = [92, 156, 156, 108], y0 = 132, hh = 72, rh = 46;
    const rows = TB.rows.slice();
    if (TB.phase === 'predict') rows.push({ d: TB.d, hs: null });
    const n = Math.max(3, rows.length);
    let s = Rc(x0, y0, cw.reduce((a, b) => a + b, 0), hh + rh * (TB.phase === 'predict' ? 4 : 3) + 8, 14, solid(CREAM, 3));
    const head = [['jarak', '(m)'], ['bayangan', '(cm)'], ['bayangan', '÷ ' + RD.H + ' cm'], ['3 m', '÷ jarak']];
    let x = x0;
    head.forEach((h, i) => {
      s += txt(x + cw[i] / 2, y0 + 30, h[0], h[0].match(/\d/) ? 36 : 30, h[0].match(/\d/) ? { w: 600 } : { cls: 't-body', w: 700 }) + txt(x + cw[i] / 2, y0 + 64, h[1], h[1].match(/\d/) ? 36 : 30, h[1].match(/\d/) ? { w: 600, fill: '#5A3E2E' } : { cls: 't-body', w: 700, fill: '#5A3E2E' });
      if (i) s += line(`M${x} ${y0 + 8}V${y0 + hh + rh * (TB.phase === 'predict' ? 4 : 3)}`, 2, '#C9B48E');
      x += cw[i];
    });
    for (let r = 0; r < (TB.phase === 'predict' ? 4 : 3); r++) {
      const y = y0 + hh + r * rh;
      s += line(`M${x0 + 8} ${y}H${x0 + cw.reduce((a, b) => a + b, 0) - 8}`, 2, '#C9B48E');
      const row = rows[r];
      if (!row) continue;
      const vals = row.hs == null ? [dec(row.d), String(TB.guess), '?', dec(3 / row.d)] : [dec(row.d), String(Math.round(row.hs)), dec(row.hs / RD.H), dec(3 / row.d)];
      let xx = x0;
      vals.forEach((v, i) => {
        if (row.hs == null && i === 1) s += Rc(xx + 10, y + 5, cw[i] - 20, rh - 10, 10, fill('#FFE08A'));
        s += txt(xx + cw[i] / 2, y + 36, v, 38, { w: 600 }); xx += cw[i];
      });
    }
    void n;
    TB.el.innerHTML = s;
  }
  async function goTable() {
    if (!canInput()) return;
    const P = PUPS[0], L = LAMPS[0];
    if (TB.phase === 'measure') {
      const d = Math.round(distM(P) * 100) / 100;
      if (TB.rows.some(r => Math.abs(r.d - d) < .01)) { GS.sfx.oops(); GS.say('Jarak ini sudah dicatat. Coba jarak lain.'); return; }
      const m = (SX - L.x) / (P.x - L.x);
      TB.rows.push({ d, hs: RD.H * m }); GS.sfx.coin();
      GS.say('Dicatat: ' + dec(d) + ' m, bayangan ' + Math.round(RD.H * m) + ' cm.');
      if (TB.rows.length >= 3) { const my = tok; busy = true; updateDock(); await wait(1500); if (my !== tok) return; busy = false; startPredictRow(); }
      render(); updateDock();
      return;
    }
    busy = true; updateDock();
    const my = tok;
    light = true; render(); GS.sfx.whoosh();
    shadowG.setAttribute('opacity', 0);
    await tw(450, e => shadowG.setAttribute('opacity', e));
    shadowG.removeAttribute('opacity');
    const hs = Math.round(RD.H * 3 / TB.d);
    GS.markup(kelirUI, measuredLabel(hs));
    await wait(500);
    if (my !== tok) return;
    if (Math.abs(TB.guess - hs) <= 2) return roundWon('Tepat! ' + RD.H + ' cm × ' + dec(3 / TB.d) + ' = ' + hs + ' cm.');
    fail('Bayangannya ' + hs + ' cm. Lihat kolom 3 m ÷ jarak.', true);
    await wait(2600);
    if (my !== tok) return;
    startPredictRow();
    busy = false; updateDock();
  }
  function startPredictRow() {
    const used = TB.rows.map(r => r.d).concat(TB.d ? [TB.d] : []);
    TB.d = DEMO ? 2.4 : pick([1.2, .8, 2.4, 1.25].filter(d => !used.some(u => Math.abs(u - d) < .01)));
    TB.phase = 'predict'; TB.guess = RD.H;
    const P = PUPS[0], L = LAMPS[0];
    P.locked = true; P.x = L.x + TB.d * UM; light = false;
    kelirUI.querySelectorAll('.wy-meas').forEach(n => n.remove());
    if (!DEMO) GS.say('Wayang di ' + dec(TB.d) + ' m. Tebak tinggi bayangannya!');
    setDock(); render();
  }

  /* ================= kind: tree (k4: measure a tree with the sun's shadows) ================= */
  const TU = 48, GY = 600;   // outdoor scale: 1 m = 48 units, ground line
  function setupTree() {
    outG.setAttribute('display', 'inline');
    const T = TREE = { hs: RD.stick, r: RD.ratio, ht: RD.tree, sx: 70, tx: 330, guess: 1, tapes: [] };
    let s = Rc(-600, 0, 2480, 800, 0, 'fill="url(#wySky)"') + Ci(90, 92, 46, fill('#FFC83D')) + Ci(90, 92, 62, fill('#FFE08A', .35));
    s += Pa('M-600 560C-300 500 0 540 300 520C600 500 900 540 1200 515C1500 495 1700 530 1880 520V800H-600Z', fill('#A9D3A0'));
    s += Rc(-600, GY, 2480, 200, 0, fill('#7CC26B')) + Rc(-600, GY, 2480, 6, 0, fill('#5A9E4C'));
    // sun rays: parallel, through the tops of the stick and the tree
    const k = 1 / T.r;   // tan(sun elevation) = height / shadow
    [[T.sx, GY - T.hs * TU], [T.tx, GY - T.ht * TU]].forEach(([x, y]) => {
      const x1 = x + (GY - y) / k;
      s += line(`M${n1(x - (y - 40) / k)} 40L${n1(x1)} ${GY}`, 3, '#F2A900', .7).replace('stroke-linecap', 'stroke-dasharray="12 9" stroke-linecap');
    });
    // shadows on the ground: each point at height h lands h / tan(e) = h * r further
    s += Pa(`M${T.sx - 4} ${GY + 2}L${n1(T.sx + T.hs * T.r * TU)} ${GY + 2}L${n1(T.sx + T.hs * T.r * TU)} ${GY + 9}L${T.sx - 4} ${GY + 9}Z`, fill('#2B3A1E', .55));
    const crownR = Math.min(1.6, T.ht * .3) * TU, trunkH = T.ht * TU - crownR * 1.6;
    const shX = h => T.tx + h * T.r;
    s += Pa(`M${T.tx - 10} ${GY + 3}L${n1(shX(trunkH) - 6)} ${GY + 6}L${n1(shX(trunkH) + 6)} ${GY + 12}L${T.tx + 10} ${GY + 12}Z`, fill('#2B3A1E', .5));
    s += El(shX(T.ht * TU - crownR * .8), GY + 10, crownR * 1.6 * T.r * .62, 10, fill('#2B3A1E', .5));
    // the stick (tongkat) and the tree
    s += shadowE(T.sx, GY + 2, 14) + Rc(T.sx - 5, GY - T.hs * TU, 10, T.hs * TU, 4, solid('#E3C27F', 2.6));
    s += shadowE(T.tx, GY + 2, 40) + f3(q => Pa(`M${T.tx - 14} ${GY}L${T.tx - 9} ${n1(GY - trunkH - 10)}L${T.tx + 9} ${n1(GY - trunkH - 10)}L${T.tx + 14} ${GY}Z`, q), [T.tx - 14, GY - trunkH - 10, 28, trunkH + 10], P3.wood, { hl: false, k: .2 });
    const cy = GY - T.ht * TU + crownR;
    s += f3(q => Pa(`M${T.tx} ${n1(cy - crownR)}C${n1(T.tx + crownR * 1.3)} ${n1(cy - crownR)} ${n1(T.tx + crownR * 1.4)} ${n1(cy + crownR * .9)} ${T.tx} ${n1(cy + crownR * .8)}C${n1(T.tx - crownR * 1.4)} ${n1(cy + crownR * .9)} ${n1(T.tx - crownR * 1.3)} ${n1(cy - crownR)} ${T.tx} ${n1(cy - crownR)}Z`, q), [T.tx - crownR * 1.2, cy - crownR, crownR * 2.4, crownR * 1.8], P3.green, { k: .08 });
    s += pill(T.sx + 6, GY - T.hs * TU - 34, dec(T.hs) + ' m', 40, { w: 100 });
    GS.markup(outG, s);
    // two tape measures: drag the yellow case to the tip of each shadow (0.5 m grid)
    [[T.sx, 'tongkat'], [T.tx, 'pohon']].forEach(([x0, who], i) => {
      const tp = { x0, x: x0 + 40 + i * 20, who, g: el('g', {}, outG), case: el('g', {}, outG) };
      tp.art = el('g', {}, tp.case);
      tp.hit = el('rect', { width: 112, height: 112, rx: 12, fill: 'transparent' }, tp.case);   // stable hit element
      tp.case.style.cursor = 'grab';
      GS.drag(tp.case, {
        svg,
        onStart(p) { if (!canInput()) return false; tp.dx = tp.x - p.x; GS.sfx.pick(); return true; },
        onMove(p) { tp.x = clamp(p.x + tp.dx, x0 + 24, i ? 860 : 300); drawTree(); },
        onEnd() { tp.x = x0 + Math.round((tp.x - x0) / (TU / 2)) * (TU / 2); GS.sfx.drop(); drawTree(); }
      });
      T.tapes.push(tp);
    });
    T.card = el('g', {}, outG);
    T.reveal = el('g', {}, outG);
    STEP = { v: 1, step: .5, min: .5, max: 15, unit: ' m' };
    RD.onRender = drawTree;
  }
  function drawTree() {
    const T = TREE;
    if (!T) return;
    T.tapes.forEach((tp, i) => {
      const len = (tp.x - tp.x0) / TU, y = GY + 34 + i * 4;
      tp.g.innerHTML = Rc(tp.x0, y - 7, tp.x - tp.x0, 14, 3, solid('#FFE08A', 2.4)) + Array.from({ length: Math.floor(len * 2) + 1 }, (_, j) => line(`M${n1(tp.x0 + j * TU / 2)} ${y - 7}v${j % 2 ? 7 : 12}`, 2)).join('');
      tp.art.innerHTML = Rc(tp.x - 28, y - 28, 56, 56, 12, solid('#F2A900', 3)) + Ci(tp.x - 4, y, 10, solid('#FFF3DC', 2.4)) + Pa(`M${n1(tp.x + 12)} ${y - 10}l12 10l-12 10Z`, fill(OUT));
      tp.hit.setAttribute('x', n1(tp.x - 56)); tp.hit.setAttribute('y', y - 56);
      tp.len = Math.round(len * 2) / 2;
    });
    const a = T.tapes[0].len, b = T.tapes[1].len;
    // a small table: what is measured, and the one number to find
    const X = 826, cw = [140, 128, 172];
    let c = Rc(X, 18, 440, 168, 18, solid(CREAM, 3)) + line(`M${X + 10} 66H${X + 430}M${X + 10} 124H${X + 430}M${X + cw[0]} 28V176M${X + cw[0] + cw[1]} 28V176`, 2, '#C9B48E');
    c += txt(X + cw[0] + cw[1] / 2, 54, 'tinggi', 33, { cls: 't-body', w: 700 }) + txt(X + cw[0] + cw[1] + cw[2] / 2, 54, 'bayangan', 33, { cls: 't-body', w: 700 });
    c += txt(X + cw[0] / 2, 106, 'tongkat', 33, { cls: 't-body', w: 700 }) + txt(X + cw[0] / 2, 164, 'pohon', 33, { cls: 't-body', w: 700 });
    c += txt(X + cw[0] + cw[1] / 2, 108, dec(T.hs) + ' m', 40, { w: 600 }) + txt(X + cw[0] + cw[1] + cw[2] / 2, 108, dec(a) + ' m', 40, { w: 600 });
    c += Rc(X + cw[0] + 10, 130, cw[1] - 20, 44, 10, fill('#FFE08A')) + txt(X + cw[0] + cw[1] / 2, 165, dec(STEP.v) + ' m', 40, { w: 600, fill: '#215F98' }) + txt(X + cw[0] + cw[1] + cw[2] / 2, 166, dec(b) + ' m', 40, { w: 600 });
    T.card.innerHTML = c;
    if (DEMO) T.card.setAttribute('transform', 'translate(-40 130)');   // clear of the "Contoh" pill
  }
  async function checkTree() {
    if (!canInput()) return;
    busy = true; updateDock();
    const my = tok, T = TREE, top = GY - T.ht * TU;
    GS.sfx.whoosh();
    await tw(900, e => {
      const y = GY - (GY - top) * e;
      T.reveal.innerHTML = Rc(T.tx + 44, y, 14, GY - y, 3, solid('#FFE08A', 2.4)) + line(`M${T.tx + 36} ${n1(GY - STEP.v * TU)}h60`, 4, '#E07B00').replace('stroke-linecap', 'stroke-dasharray="8 6" stroke-linecap') +
        (e > .98 ? pill(T.tx + 112, top + 6, dec(T.ht) + ' m', 36, { w: 100 }) : '');
    });
    if (my !== tok) return;
    if (Math.abs(STEP.v - T.ht) < .01) return roundWon('Tepat! Pohonnya ' + dec(T.ht) + ' m.');
    fail('Pohonnya ' + dec(T.ht) + ' m. Bayangannya ' + dec(T.r) + ' kali tingginya.', true);
    await wait(3000);
    if (my !== tok) return;
    startRound(RI, true);
    GS.say('Coba pohon yang lain.');
  }

  /* ================= kind: ask (k4: which wayang is nearer the lamp?) ================= */
  function setupAsk() {
    setupMatch();
    TGTS = []; targetG.innerHTML = '';
    let s = f3(q => Rc(352, 46, 520, 602, 0, q), [352, 46, 520, 602], P3.red, { hl: false, k: .03, inner: line('M420 48V646M500 48V646M580 48V646M660 48V646M740 48V646M820 48V646', 4, '#B5322B') });
    s += Rc(340, 40, 544, 16, 6, solid('#7E4A27', 3));
    coverG.innerHTML = `<g class="wy-curtain">${s}</g>`;
    PUPS.forEach((P, i) => {
      const c = el('g', { transform: `translate(${500 + i * 230} 360)`, 'data-hit': 'pilih-' + P.shape }, coverG);
      c.innerHTML = Rc(-90, -110, 180, 220, 20, solid(CREAM, 3)) + `<g transform="scale(.42)">${figureArt(P.shape, 'kulit', 1)}</g>`;
      c.style.cursor = 'pointer';
      c.addEventListener('click', () => chooseNearer(i));
    });
  }
  async function chooseNearer(i) {
    if (!canInput()) return;
    busy = true;
    const my = tok, near = PUPS[0].x < PUPS[1].x ? 0 : 1, good = i === near;
    GS.sfx[good ? 'coin' : 'pop']();
    GS.say(good ? 'Betul! Yang dekat lampu, bayangannya besar.' : 'Hmm, lihat ya. Yang dekat lampu, bayangannya besar.');
    const cur = coverG.querySelector('.wy-curtain');
    coverG.querySelectorAll('[data-hit]').forEach(n => n.remove());
    await tw(800, e => cur.setAttribute('transform', `translate(0 ${n1(-600 * e)})`), 'inOutCubic');
    helpRays = true; render();
    await wait(2600);
    if (my !== tok) return;
    if (DEMO) run.win(3, '');
    else startRound(RI + 1);
  }

  /* ================= dock ================= */
  const ICONS = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lamp: GS.ICON.hint,
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>'
  };
  function actionButton(label, icon, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gs-action';
    b.innerHTML = icon + '<span></span>';
    b.querySelector('span').textContent = label;
    b.addEventListener('click', () => { if (b.disabled) return; GS.sfx.click(); fn(); });
    dock.appendChild(b);
    return b;
  }
  function setDock() {
    dock.innerHTML = '';
    if (!RD) return;
    const k = RD.kind;
    if (k === 'ask' || (k === 'match' && RD.auto)) return;
    if ((k === 'table' && TB && TB.phase === 'predict') || k === 'tree') {
      if (k === 'table') STEP = { v: TB.guess, step: 5, min: 5, max: 250, unit: ' cm' };
      const wrap = document.createElement('div');
      wrap.className = 'wy-stepper';
      const mk = (txt0, d) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'wy-step'; b.textContent = txt0; b.setAttribute('aria-label', d > 0 ? 'Tambah' : 'Kurangi'); b.addEventListener('click', () => { if (!canInput()) return; STEP.v = clamp(Math.round((STEP.v + d * STEP.step) * 10) / 10, STEP.min, STEP.max); GS.sfx.tick(); syncStep(); }); return b; };
      const val = document.createElement('span'); val.className = 'wy-val';
      wrap.append(mk('−', -1), val, mk('+', 1));
      dock.appendChild(wrap);
      STEP.val = val; syncStep();
    }
    if (k === 'match') actionButton(RD.dark ? 'Nyalakan!' : 'Cek!', RD.dark ? ICONS.lamp : ICONS.check, checkMatch);
    else if (k === 'marker') actionButton(RD.variant === 'lift' ? 'Lihat!' : 'Nyalakan!', RD.variant === 'lift' ? ICONS.eye : ICONS.lamp, goMarker);
    else if (k === 'sort') actionButton('Cek!', ICONS.check, checkSort);
    else if (k === 'holes') actionButton('Cek!', ICONS.check, checkHoles);
    else if (k === 'mirror') actionButton('Cek!', ICONS.check, checkMirror);
    else if (k === 'table') actionButton(TB && TB.phase === 'predict' ? 'Nyalakan!' : 'Catat', TB && TB.phase === 'predict' ? ICONS.lamp : ICONS.pencil, goTable);
    else if (k === 'tree') actionButton('Cek!', ICONS.check, checkTree);
    updateDock();
  }
  function syncStep() {
    if (!STEP || !STEP.val) return;
    STEP.val.textContent = dec(STEP.v) + STEP.unit;
    if (TB) { TB.guess = STEP.v; drawTable(); }
    if (TREE) drawTree();
  }
  function updateDock() {
    dock.querySelectorAll('button').forEach(b => { b.disabled = busy || (RD && RD.kind === 'sort' && b.classList.contains('gs-action') && PUPS.some(P => !P.tray)); });
  }

  /* ================= round factories ================= */
  const lamp0 = o => Object.assign({ x: 320, y: LY0, r: 2.5, art: 'blencong' }, o || {});
  const lampN = () => ({ x: 220, y: FOOT, r: 2, art: 'pelita' });          // measuring levels: 3 m to the kelir
  const xFor = (L, m) => L.x + (SX - L.x) / m;                           // inverse of m = (SX - lx) / (px - lx)
  const cyOf = (L, py, m) => L.y + (py - L.y) * m;
  function mFit(shape, k, L, py, rot, lo, hi) {
    for (let i = 0; i < 80; i++) { const m = rr(lo, hi); if (fits(shape, m * k, cyOf(L, py, m), rot || 0)) return m; }
    return lo;
  }
  /** A starting distance clearly different from the answer (the child must move it). */
  function mFar(m, shape, k, L, py, rot) {
    const lo = (SX - L.x) / (SX - 72 - L.x), hi = Math.min(3, (SX - L.x) / 110);
    for (let i = 0; i < 80; i++) { const c = rr(lo, hi); if (Math.abs(c / m - 1) > .38 && fits(shape, c * k, cyOf(L, py, c), rot || 0, -60)) return c; }
    return m > 1.8 ? lo + .03 : Math.min(hi, m * 1.7);
  }
  const SHAPES_TALL = ['ksatria', 'raksasa', 'gunungan'], SHAPES_ALL = ['ksatria', 'raksasa', 'gunungan', 'kucing', 'burung', 'pohon'];
  /** Size only: the wayang slides along the lamp axis. */
  function fSize(o) {
    return () => {
      // fixed ratio (2x, 3x): the example uses another lamp spot, so its answer is not the child's
      const L = lamp0(DEMO && o.m[0] === o.m[1] ? { x: ((o.lamp && o.lamp.x) || 320) + 50 } : o.lamp), shape = o.shape || pick(o.shapes || SHAPES_TALL), k = o.k || .7;
      const m = mFit(shape, k, L, L.y, 0, o.m[0], o.m[1]), m0 = o.m0 ? mFit(shape, k, L, L.y, 0, o.m0[0], o.m0[1]) : mFar(m, shape, k, L, L.y, 0);
      return {
        kind: 'match', say: o.say, dark: o.dark, label: o.label, steps: o.steps, rays: o.rays, tolS: o.tolS, winSay: o.winSay, lamps: [L],
        pups: [{ shape, k, drag: 'x', x: xFor(L, m0), y: L.y, sol: { x: xFor(L, m), y: L.y } }], targets: [{ p: 0, lamp: 0 }]
      };
    };
  }
  /** Height only: the wayang moves up and down at a fixed distance. */
  function fPos(o) {
    return () => {
      const L = lamp0(), shape = pick(o.shapes || ['kucing', 'burung', 'gunungan']), k = o.k || .62;
      let m, py, n = 0;
      do { m = rr(o.m[0], o.m[1]); py = L.y + sgn() * rr(o.off[0], o.off[1]) / m; } while (!fits(shape, m * k, cyOf(L, py, m), 0) && ++n < 80);
      const py0 = clamp(2 * L.y - py + sgn() * 10, 150, 560);
      return { kind: 'match', say: o.say, lamps: [L], pups: [{ shape, k, drag: 'y', x: xFor(L, m), y: py0, sol: { x: xFor(L, m), y: py } }], targets: [{ p: 0, lamp: 0 }] };
    };
  }
  /** Size and height at once (optionally turned too, optionally in the dark first). */
  function fXY(o) {
    return () => {
      const L = lamp0(), shape = o.shape || pick(o.shapes || SHAPES_ALL), k = o.k || .62;
      const rot = o.rots ? pick(o.rots) : 0;
      let m, py, n = 0;
      do { m = o.mSet ? pick(o.mSet) : rr(o.m[0], o.m[1]); py = L.y + sgn() * rr(o.off[0], o.off[1]) / m; } while (!fits(shape, m * k, cyOf(L, py, m), rot) && ++n < 120);
      let x0, y0;
      if (o.rack) { const rp = rackPos(1, shape, k); x0 = rp.x; y0 = rp.y; }
      else { const m0 = mFar(m, shape, k, L, L.y, 0); x0 = xFor(L, m0); y0 = clamp(2 * L.y - py, 160, 540); }
      return {
        kind: 'match', say: o.say, dark: o.dark, label: o.mSet ? m + ' ×' : o.label, rack: o.rack, rays: o.rays, lamps: [L],
        pups: [{ shape, k, drag: o.rack ? 'free' : 'xy', rotate: !!o.rots, x: x0, y: y0, sol: { x: xFor(L, m), y: py, rot } }], targets: [{ p: 0, lamp: 0 }]
      };
    };
  }
  /** Turn the wayang (and in mixed levels also slide it). */
  function fRot(o) {
    return () => {
      const L = lamp0(), shape = pick(o.shapes || ['ksatria', 'gunungan', 'raksasa']), k = o.k || .62;
      let rot, m, n = 0;
      do { rot = pick(o.rots); m = rr(o.m[0], o.m[1]); } while (!fits(shape, m * k, L.y, rot) && ++n < 80);
      const x = xFor(L, m), x0 = o.drag ? xFor(L, mFar(m, shape, k, L, L.y, 0)) : x;
      return { kind: 'match', say: o.say, lamps: [L], pups: [{ shape, k, drag: o.drag || null, rotate: true, rot: 0, x: x0, y: L.y, sol: { x, y: L.y, rot } }], targets: [{ p: 0, lamp: 0 }] };
    };
  }
  /** The wayang stands still; the child moves the lamp up or down. */
  function fLampY(o) {
    return () => {
      const shape = pick(o.shapes || ['gunungan', 'kucing', 'raksasa']), k = o.k || .6, m = rr(1.6, 1.85);
      const L = lamp0({ drag: 'y' }), px = xFor(L, m), dir = o.dir || sgn();
      let ly, n = 0;
      do { ly = L.y + dir * rr(90, 150); } while (!fits(shape, m * k, cyOf({ y: ly }, L.y, m), 0) && ++n < 60);
      L.sol = { y: ly };
      return { kind: 'match', say: o.say, rays: o.rays, lamps: [L], pups: [{ shape, k, drag: null, x: px, y: L.y, sol: { x: px, y: L.y } }], targets: [{ p: 0, lamp: 0 }] };
    };
  }
  /** Pick the right wayang from the rack: by shape (TK) or by material (k1). */
  function fChoose(o) {
    return () => {
      const L = lamp0(), k = o.k || .66, mats = DEMO && o.mats ? ['kayu', 'minyak', 'kaca'] : o.mats;
      const set = shuffle(mats ? mats.map(mt => ({ shape: o.shape || pick(['kucing', 'gunungan', 'burung']), mat: mt })) : (o.shapes || ['kucing', 'burung', 'pohon']).map(s => ({ shape: s, mat: 'kulit' })));
      if (o.mats) set.forEach(it => { it.shape = set[0].shape; });
      const want = o.mats ? set.findIndex(it => MAT[it.mat].a > .6) : Math.floor(Math.random() * set.length);
      const m = mFit(set[want].shape, k, L, L.y, 0, o.m[0], o.m[1]);
      const pups = set.map((it, i) => { const rp = rackPos(i, it.shape, k); return { shape: it.shape, mat: it.mat, k, drag: 'free', x: rp.x, y: rp.y, say: o.mats ? cap(MAT[it.mat].name) + '.' : null, sol: i === want ? { x: xFor(L, m), y: L.y } : null }; });
      return { kind: 'match', choose: true, rack: true, say: o.say, label: o.mats ? 'pekat' : null, lamps: [L], pups, targets: [{ p: -1, solP: want, shape: set[want].shape, lamp: 0, opaque: !!o.mats }] };
    };
  }
  /** Two wayang on two rails, two outlines (k1, k4). */
  function fTwo(o) {
    return () => {
      const L = lamp0(), k = o.k || .5, shapes = o.shapes || shuffle(['burung', 'kucing', 'pohon']).slice(0, 2);
      const ys = o.ys || [L.y - 95, L.y + 95];
      let ms, n = 0;
      do {
        ms = o.near ? shuffle([rr(2.1, 2.5), rr(1.3, 1.6)]) : [rr(o.m[0], o.m[1]), rr(o.m[0], o.m[1])];
      } while (!(shapes.every((s, i) => fits(s, ms[i] * k, cyOf(L, ys[i], ms[i]), 0)) && Math.abs(xFor(L, ms[0]) - xFor(L, ms[1])) > (o.near ? 120 : 0)) && ++n < 120);
      const pups = shapes.map((s, i) => {
        const m0 = mFar(ms[i], s, k, L, ys[i], 0);
        return { shape: s, k, drag: o.fixed ? null : 'x', x: o.fixed ? xFor(L, ms[i]) : xFor(L, i ? Math.max(m0, 2.6) : Math.min(m0, 1.3)), y: ys[i], sol: { x: xFor(L, ms[i]), y: ys[i] } };
      });
      return { kind: o.kind || 'match', say: o.say, rays: o.rays, lamps: [L], pups, targets: shapes.map((s, i) => ({ p: i, lamp: 0 })) };
    };
  }
  /** Two lamps, one wayang: two shadows. Coloured lamps: the outline asks for one coloured shadow. */
  function fTwoLamps(o) {
    return () => {
      const lamps = o.colour ? [{ x: 290, y: 230, r: 2.5, art: 'blencong', col: 'orange' }, { x: 330, y: 450, r: 2, art: 'pelita', col: 'blue' }]
        : [{ x: 290, y: 230, r: 2.5, art: 'blencong' }, { x: 330, y: 450, r: 2, art: 'pelita' }];
      const shape = pick(o.shapes || ['kucing', 'burung', 'gunungan']), k = o.k || .5, want = o.colour === 'jingga' ? 1 : 0;
      let px, py, n = 0, ok = false;
      do {
        px = rr(520, 700); py = rr(300, 390);
        ok = lamps.every(L => { const m = (SX - L.x) / (px - L.x); return fits(shape, m * k, cyOf(L, py, m), 0); });
      } while (!ok && ++n < 150);
      const targets = o.colour ? [{ p: 0, lamp: want, colFill: want ? '#F2A23A' : '#4A8DE0' }] : [{ p: 0, lamp: 0 }, { p: 0, lamp: 1 }];
      return {
        kind: 'match', say: o.say, label: o.colour || null, lamps, rays: o.rays,
        pups: [{ shape, k, drag: 'xy', bounds: [430, SX - 70, 150, 560], x: px > 640 ? 470 : 790, y: clamp(2 * 345 - py, 200, 500), sol: { x: px, y: py } }], targets
      };
    };
  }
  /** k3: big lamp vs small lamp (penumbra). */
  function fPenumbra(choice) {
    return () => {
      const L = lamp0({ art: 'besar', r: 26 }), shape = pick(['ksatria', 'gunungan', 'kucing']), k = choice ? .62 : .78;
      const m = choice ? mFit(shape, k, L, L.y, 0, 1.8, 2.3) : mFit(shape, k, L, L.y, 0, 1.18, 1.26);
      const m0 = choice ? mFar(m, shape, k, L, L.y, 0) : 2.6;
      return {
        kind: 'match', lampChoice: choice, label: 'tajam',
        say: choice ? 'Bayangan harus tajam. Pilih lampu, lalu atur jaraknya.' : 'Lampunya besar. Di mana bayangannya tajam?',
        lamps: [L], pups: [{ shape, k, drag: 'x', x: xFor(L, m0), y: L.y, sol: { x: xFor(L, m), y: L.y } }], targets: [{ p: 0, lamp: 0, sharp: true }]
      };
    };
  }
  function fLift(dir) {
    return () => {
      const L = lamp0(), shape = pick(['kucing', 'burung', 'gunungan']), k = .55, m = 2;
      const y0 = L.y - dir * 30;
      return { kind: 'marker', variant: 'lift', dy: dir * (DEMO ? 60 : 80), say: dir < 0 ? 'Wayang akan diangkat. Bayangannya ke mana? Geser tebakanmu!' : 'Wayang akan diturunkan. Tebak, bayangannya ke mana?', lamps: [L], pups: [{ shape, k, x: xFor(L, m), y: y0 }] };
    };
  }
  const numPup = (H, d, o) => { const k = H * 2.2 / 200; return Object.assign({ shape: 'ksatria', k, x: 220 + d * UM, y: FOOT - 100 * k }, o || {}); };
  function fMarkHeight() {
    return () => {
      const H = pick([40, 50, 60]), d = pick([1, 1.5]);
      return { kind: 'marker', variant: 'height', numeric: true, H, say: 'Wayang ' + H + ' cm, jaraknya ' + dec(d) + ' m. Tebak tinggi bayangannya!', lamps: [lampN()], pups: [numPup(H, d)] };
    };
  }
  /** Measuring levels: put the wayang where its shadow will be exactly T cm (light off first). */
  function fNumDark(o) {
    return () => {
      const [H, d] = pick(o.sets), T = Math.round(H * 3 / d);
      let d0; do { d0 = Math.round(rr(.5, 2.6) * 10) / 10; } while (Math.abs(d0 - d) < .45);
      return {
        kind: 'match', dark: true, numeric: true, snapM: .1, H, tolS: .04, rays: o.rays, label: T + ' cm', say: 'Buat bayangan ' + T + ' cm. Di mana wayangnya berdiri?',
        lamps: [lampN()], pups: [numPup(H, d0, { drag: 'x', sol: { x: 220 + d * UM, y: FOOT - 100 * H * 2.2 / 200 } })], targets: [{ p: 0, lamp: 0 }]
      };
    };
  }
  function fSort(real) {
    return () => {
      if (DEMO) return { kind: 'sort', say: '', lamps: [lamp0({ x: 400, y: 330 })],   // the example sorts other materials
        items: (real ? [['kaca', 'plastik'], ['kain', 'kain'], ['papan', 'karton']] : [['gunungan', 'kaca'], ['kucing', 'kain'], ['burung', 'karton']]).map(([shape, mat]) => ({ shape, mat, k: real ? .58 : .55 })) };
      const items = real ? shuffle([['kaca', 'kaca'], ['kertas', 'minyak'], ['kain', 'kain'], ['papan', 'kayu'], ['daun', 'daun']]).map(([shape, mat]) => ({ shape, mat, k: .58 }))
        : (() => { const sh = shuffle(['kucing', 'burung', 'gunungan']); return shuffle(['plastik', 'minyak', 'kulit']).map((mat, i) => ({ shape: sh[i], mat, k: .55 })); })();
      return { kind: 'sort', say: real ? 'Uji tiap bahan di depan lampu, lalu taruh di keranjangnya.' : 'Uji di depan lampu. Bening, samar, atau pekat?', lamps: [lamp0({ x: 400, y: 330 })], items };
    };
  }
  function fHoles() {
    return () => {
      const L = { x: 300, y: LY0, r: 2, art: 'kecil' }, xs = [470, 610, 750];
      const ty = Math.round(rr(150, 540));
      const need = xs.map(x => L.y + (ty - L.y) * (x - L.x) / (SX - L.x));   // collinear with the lamp and the star
      const boards = xs.map((x, i) => { let h; do { h = rr(150, 560); } while (Math.abs(h - need[i]) < 60); return { x, h, need: need[i] }; });
      return { kind: 'holes', kelirDark: true, noCone: true, say: 'Geser karton supaya cahaya sampai ke bintang.', lamps: [L], boards, ty };
    };
  }
  function fMirror(variant) {
    return () => {
      let lamp, mirrors, blocks, target;
      const dz = DEMO ? 1 : 0;   // the example uses shifted mirrors, so its angles are not the child's
      if (variant === 2) {
        lamp = { x: 200, y: 170 + 40 * dz }; target = { x: 790, y: Math.round(rr(440, 520)) };
        const M1 = { x: 420 - 20 * dz, y: 610 }, M2 = { x: 640 + 20 * dz, y: 150 };
        mirrors = [Object.assign(M1, { sol: mirrorFor(M1, lamp, M2) }), Object.assign(M2, { sol: mirrorFor(M2, M1, target) })];
        blocks = [{ kind: 'sketsel', x: 560, y: 340, w: 40, h: 308 }];
      } else if (variant === 'top') {
        lamp = { x: 230, y: 430 }; target = { x: 770, y: Math.round(rr(400, 470)) };
        const M = { x: 500 + 30 * dz, y: 160 };
        mirrors = [Object.assign(M, { sol: mirrorFor(M, lamp, target) })];
        blocks = [{ kind: 'sketsel', x: 590, y: 330, w: 46, h: 318 }];
      } else {
        lamp = { x: 230 + 20 * dz, y: 200 - 10 * dz }; target = { x: 770, y: Math.round(rr(285, 360)) };
        const M = { x: 470 - 30 * dz, y: 600 };
        mirrors = [Object.assign(M, { sol: mirrorFor(M, lamp, target) })];
        blocks = [{ kind: 'tirai', x: 590, y: 50, w: 50, h: 330 }];
      }
      mirrors.forEach(M => { M.a = M.sol + sgn() * rr(16, 28); M.min = M.sol - 60; M.max = M.sol + 60; });
      const first = mirrors[0];
      const L = Object.assign({ art: 'senter', r: 2, on: false, beamAng: Math.atan2(first.y - lamp.y, first.x - lamp.x) / RAD }, lamp);
      return {
        kind: 'mirror', kelirDark: true, noCone: true, lamps: [L], mirrors, blocks, target: Object.assign({ shape: 'ksatria' }, target),
        say: variant === 2 ? 'Putar dua cermin supaya cahaya mengenai wayang.' : 'Putar cermin supaya cahaya mengenai wayang di balik tirai.'
      };
    };
  }
  function fTable() {
    return () => {
      const H = DEMO ? 60 : 40, marks = [.75, 1, 1.5, 2, 2.5];
      return {
        kind: 'table', numeric: true, H, marks, snapM: .25, rays: .35, say: 'Taruh wayang di tanda, lalu catat bayangannya. Tiga kali!',
        lamps: [lampN()], pups: [numPup(H, 2, { drag: 'x' })], targets: []
      };
    };
  }
  function fTree() {
    return () => {
      let stick, ratio, tree;
      do { stick = pick([1, 2]); ratio = stick === 2 ? 1.5 : 2; tree = ratio === 1.5 ? pick([4, 5, 6]) : pick([4, 5]); } while (DEMO && tree > 5);
      return { kind: 'tree', stick, ratio, tree, say: 'Ukur bayangan dengan meteran. Berapa tinggi pohonnya?' };
    };
  }
  function fAsk() {
    const f = fTwo({ near: true, fixed: true, k: .52, ys: [LY0 - 28, LY0 + 26], shapes: shuffle(['kucing', 'burung']), kind: 'ask', say: 'Mana yang lebih dekat ke lampu? Ketuk!' });
    return () => { const r = f(); r.rays = 0; return r; };
  }

  /* ================= levels per tier (docs/KURIKULUM.md, Wayang Bayangan) ================= */
  const BY_TIER = {
    tk: [
      () => ({ win: 'Bayangannya muncul!', rounds: [
        () => ({ kind: 'match', auto: 'place', rack: true, say: 'Seret wayang ke depan lampu, ya!', winSay: 'Muncul bayangan kucing!', lamps: [lamp0()], pups: [{ shape: 'kucing', k: .7, drag: 'free', x: rackPos(0, 'kucing', .7).x, y: rackPos(0, 'kucing', .7).y, sol: { x: 600, y: LY0 } }], targets: [] }),
        () => ({ kind: 'match', auto: 'place', say: 'Burung di belakang lampu. Bawa ke depan!', winSay: 'Muncul bayangan burung!', lamps: [lamp0()], pups: [{ shape: 'burung', k: .74, drag: 'free', x: 140, y: 300, sol: { x: 640, y: LY0 } }], targets: [] })
      ] }),
      () => ({ win: 'Raksasanya besar sekali!', rounds: [fSize({ shape: 'raksasa', k: .6, m: [2.1, 2.5], m0: [1.15, 1.3], say: 'Buat bayangan raksasa yang besar!', winSay: 'Raksasanya besar!' })] }),
      () => ({ win: 'Bayangannya kecil, pas!', rounds: [fSize({ shape: 'ksatria', k: .8, m: [1.2, 1.35], m0: [2.4, 2.7], say: 'Sekarang buat bayangan yang kecil.' })] }),
      () => ({ win: 'Bentuknya cocok!', rounds: [fChoose({ m: [1.6, 2], say: 'Wayang mana yang bayangannya cocok?' }), fChoose({ m: [1.6, 2], say: 'Cari lagi wayang yang cocok!' })] }),
      () => ({ win: 'Lampu pindah, bayangan pindah!', rounds: [fLampY({ dir: -1, say: 'Geser lampunya. Bayangan ikut pindah!' }), fLampY({ dir: 1, say: 'Geser lampu lagi sampai pas.' })] }),
      () => ({ win: 'Hebat, dalang cilik!', rounds: [fXY({ rack: true, m: [1.5, 2.1], off: [30, 70], k: .62, say: 'Buat bayangan pas di garis!' }), fXY({ rack: true, m: [1.5, 2.1], off: [30, 70], k: .62, say: 'Satu lagi. Pas di garis!' })] })
    ],
    k1: [
      () => ({ rounds: [fSize({ m: [1.4, 2.4], say: 'Buat bayangan setinggi garis biru.' }), fSize({ m: [1.4, 2.4], say: 'Sekali lagi, pas setinggi garis.' })] }),
      () => ({ rounds: [fPos({ m: [1.5, 1.9], off: [60, 110], say: 'Geser naik atau turun sampai pas.' }), fPos({ m: [1.5, 1.9], off: [60, 110], say: 'Naik atau turun? Buat pas lagi.' })] }),
      () => ({ rounds: [fXY({ m: [1.4, 2.2], off: [40, 100], say: 'Atur jauh dekat dan naik turun.' }), fXY({ m: [1.4, 2.2], off: [40, 100], say: 'Pas kan ukuran dan letaknya.' })] }),
      () => ({ win: 'Bahan tidak tembus cahaya membuat bayangan pekat!', rounds: [fChoose({ mats: ['kulit', 'minyak', 'plastik'], m: [1.5, 1.9], say: 'Bayangan harus pekat. Pilih bahan yang tepat.' }), fChoose({ mats: ['karton', 'kain', 'kaca'], shape: 'gunungan', m: [1.5, 1.9], say: 'Pilih lagi bahan yang bayangannya pekat.' })] }),
      () => ({ rounds: [fTwo({ m: [1.4, 1.9], say: 'Dua wayang, dua bayangan. Pas kan keduanya!' })] }),
      () => ({ rounds: [fRot({ rots: [-60, -45, -30, 30, 45, 60], m: [1.5, 1.8], say: 'Putar wayangnya sampai miringnya pas.' }), fRot({ rots: [-60, -45, -30, 30, 45, 60], m: [1.5, 1.8], say: 'Putar lagi, cocokkan miringnya.' })] }),
      () => ({ rounds: [fXY({ m: [1.4, 2.2], off: [40, 100], say: 'Atur bayangannya pas di garis.' }), fRot({ drag: 'x', rots: [-45, -30, 30, 45], m: [1.4, 2], say: 'Geser dan putar sampai pas.' })] }),
      () => ({ win: 'Tantangan selesai!', rounds: [fXY({ m: [1.4, 2.1], off: [40, 90], rots: [-45, -30, 30, 45], say: 'Tantangan: ukuran, letak, dan miringnya!' }), fTwo({ m: [1.4, 1.9], say: 'Dua wayang sekaligus. Pas kan!' })] })
    ],
    k2: [
      () => ({ rounds: [fSize({ dark: true, steps: true, k: .6, m: [2, 2], label: '2 ×', tolS: .1, say: 'Bayangan dua kali tinggi wayang. Tebak di mana!' }), fSize({ dark: true, steps: true, k: .6, m: [2, 2], label: '2 ×', tolS: .1, lamp: { x: 380 }, say: 'Lampunya pindah. Di mana dua kalinya?' })] }),
      () => ({ rounds: [fSize({ dark: true, steps: true, k: .48, m: [3, 3], label: '3 ×', tolS: .1, say: 'Sekarang tiga kali tinggi wayang. Tebak dulu!' }), fSize({ dark: true, steps: true, k: .48, m: [3, 3], label: '3 ×', tolS: .1, lamp: { x: 260 }, say: 'Tiga kali lagi. Di mana wayangnya?' })] }),
      () => ({ win: 'Lampu naik, bayangan turun!', rounds: [fLampY({ dir: -1, say: 'Atur tinggi lampu supaya bayangan pas.' }), fLampY({ dir: 1, say: 'Sekarang ke arah lain. Atur lampunya.' })] }),
      () => ({ win: 'Bening, samar, pekat!', rounds: [fSort(false)] }),
      () => ({ rounds: [fLift(-1), fLift(1)] }),
      () => ({ win: 'Dua lampu, dua bayangan!', rounds: [fTwoLamps({ say: 'Dua lampu, dua bayangan. Pas kan keduanya!' }), fTwoLamps({ say: 'Sekali lagi dengan dua lampu.' })] }),
      () => ({ rounds: [fSize({ dark: true, steps: true, k: .5, m: [2, 2], label: '2 ×', tolS: .1, say: 'Tebak dulu: bayangan dua kali tinggi wayang.' }), fLampY({ say: 'Atur lampunya sampai bayangan pas.' })] }),
      () => ({ win: 'Tantangan selesai!', rounds: [fXY({ dark: true, mSet: [2, 3], off: [30, 70], k: .48, say: 'Tantangan: tebak letak wayang dalam gelap!' }), fTwoLamps({ say: 'Dua lampu lagi. Pas kan dua bayangannya!' })] })
    ],
    k3: [
      () => ({ win: 'Cahaya merambat lurus!', rounds: [fHoles(), fHoles()] }),
      () => ({ rounds: [fMarkHeight(), fMarkHeight()] }),
      () => ({ win: 'Lampu kecil membuat tepi bayangan tajam!', rounds: [fPenumbra(true), fPenumbra(false)] }),
      () => ({ win: 'Kamu bisa membedakan bahan!', rounds: [fSort(true)] }),
      () => ({ win: 'Bayangan berwarna!', rounds: [fTwoLamps({ colour: 'biru', say: 'Dua lampu berwarna. Buat bayangan biru pas di garis.' }), fTwoLamps({ colour: 'jingga', say: 'Sekarang buat bayangan jingga pas di garis.' })] }),
      () => ({ rounds: [fNumDark({ sets: [[40, 1], [50, 1.5], [60, 1.5], [40, 1.5], [60, 2], [40, 2]] }), fNumDark({ sets: [[40, 1], [50, 1.5], [60, 1.5], [40, 1.5], [60, 2], [40, 2]] })] }),
      () => ({ rounds: [fMarkHeight(), fTwoLamps({ colour: pick(['biru', 'jingga']), say: 'Buat bayangan berwarna pas di garis.' })] }),
      () => ({ win: 'Tantangan selesai!', rounds: [fNumDark({ sets: [[40, 1.2], [60, 1.2], [50, 2.5]] }), fHoles()] })
    ],
    k4: [
      () => ({ win: 'Bayangan ÷ wayang = kelir ÷ jarak!', rounds: [fTable()] }),
      () => ({ rounds: [fNumDark({ rays: 0, sets: [[40, 1.2], [60, 1.2], [50, 2.5], [40, .8], [40, 2.4]] }), fNumDark({ rays: 0, sets: [[40, 1.2], [60, 1.2], [50, 2.5], [40, .8], [40, 2.4]] })] }),
      () => ({ win: 'Sudut datang = sudut pantul!', rounds: [fMirror(1), fMirror('top')] }),
      () => ({ win: 'Dua cermin, satu jalan cahaya!', rounds: [fMirror(2)] }),
      () => ({ win: 'Yang dekat lampu, bayangannya besar!', rounds: [fAsk(), fTwo({ near: true, k: .52, ys: [LY0 - 28, LY0 + 26], shapes: ['kucing', 'burung'], rays: 0, say: 'Sekarang kamu yang atur. Pas kan dua bayangan!' })] }),
      () => ({ win: 'Kamu mengukur pohon dengan bayangan!', rounds: [fTree()] }),
      () => ({ rounds: [fNumDark({ rays: 0, sets: [[40, 1.2], [60, 1.2], [50, 2.5], [40, 2.4]] }), fMirror(pick([1, 'top']))] }),
      () => ({ win: 'Tantangan selesai!', rounds: [fMirror(2), fTwo({ near: true, k: .52, ys: [LY0 - 28, LY0 + 26], shapes: shuffle(['kucing', 'burung']), rays: 0, say: 'Dua bayangan bertumpuk. Pas kan keduanya!' })] })
    ]
  };
  const LEVELS = BY_TIER[TIER] || BY_TIER.k1;

  /* ================= flow ================= */
  const hud = GS.hud({ gameId: GAME, title: 'Wayang Bayangan', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: i => buildLevel(i), demo: demoSpec });
  // Speech only: units and degrees read as words (the captions keep the symbols).
  if (GS.speakable && !GS.speakable.__wy) {
    const base = GS.speakable;
    GS.speakable = t => base(String(t).replace(/(\d)\s*cm\b/g, '$1 sentimeter').replace(/(\d)\s*m\b/g, '$1 meter').replace(/(\d)°/g, '$1 derajat'));
    GS.speakable.__wy = true;
  }
  /** What makes a round's task (answers, not starting spots): the example and the child's task must differ. */
  const sigOf = rd => rd.choose ? 'choose:' + rd.targets[0].shape + rd.pups.map(p => p.mat).join() : JSON.stringify(rd, function (k, v) {
    if (this && (this.sol !== undefined || this.need != null) && (k === 'x' || k === 'y' || k === 'a' || k === 'h')) return undefined;
    if (k === 'say' || k === 'winSay') return undefined;
    return typeof v === 'number' ? Math.round(v / 6) : v;
  });
  let demoSig = '', kidSig = '';
  function demoTweak(rd) {
    // TK level 1: the example brings the tree wayang (the child gets the cat)
    if (DEMO && rd.auto === 'place' && rd.rack) {
      const rp = rackPos(0, 'pohon', .7);
      Object.assign(rd.pups[0], { shape: 'pohon', x: rp.x, y: rp.y, sol: { x: 620, y: LY0 } });
      rd.winSay = 'Muncul bayangan pohon!';
    }
    return rd;
  }
  function buildLevel(i, demo) {
    tok++;
    DEMO = !!demo;
    document.querySelectorAll('.gs-overlay.gs-win').forEach(o => o.remove());
    const avoid = DEMO ? kidSig : demoSig;
    let rd;
    for (let n = 0; n < 16; n++) { LV = LEVELS[i](); rd = demoTweak(LV.rounds[0]()); if (sigOf(rd) !== avoid) break; }
    if (DEMO) demoSig = sigOf(rd); else kidSig = sigOf(rd);
    tries = 0;
    startRound(0, false, rd);
  }
  function startRound(ri, retry, rd) {
    tok++;
    RI = ri; rTries = 0; busy = false;
    clearStage();
    RD = rd || LV.rounds[ri]();
    ({ match: setupMatch, marker: setupMarker, sort: setupSort, holes: setupHoles, mirror: setupMirror, table: setupTable, tree: setupTree, ask: setupAsk })[RD.kind]();
    render(); setDock();
    hud.mood('think');
    if (!DEMO) GS.say(RD.say);
  }

  /* ================= worked examples (GS.demo, SOP docs/CONTOH.md) =================
   * Chuppy plays the first round of the level with other numbers, through the real handles:
   * it drags the wayang / lamp / boards / tape cases, turns the knob and mirrors along an arc,
   * moves the guess marker BEFORE the light comes on, then presses the dock button. The true
   * projection decides; the script only aims at the answer computed from the same geometry. */
  const DK = {
    tk: [['muncul', 1], ['besar', 1], ['kecil', 1], ['pilih', 1], ['lampu', 1], ['pas', 1]],
    k1: [['ukuran', 1], ['naikturun', 1], ['jauhtinggi', 1], ['bahan', 1], ['dua', 1], ['putar', 1], ['campuran', 0], ['tantangan', 0]],
    k2: [['duakali', 1], ['tigakali', 1], ['lampu', 1], ['sortir', 1], ['angkat', 1], ['dualampu', 1], ['campuran', 0], ['tantangan', 0]],
    k3: [['lubang', 1], ['tinggi', 1], ['tajam', 1], ['bahannyata', 1], ['warna', 1], ['ukurgelap', 1], ['campuran', 0], ['tantangan', 0]],
    k4: [['tabel', 1], ['ukurgelap', 1], ['cermin', 1], ['duacermin', 1], ['dekat', 1], ['pohon', 1], ['campuran', 0], ['tantangan', 0]]
  };
  function demoSpec(i) {
    const k = (DK[TIER] || DK.k1)[i] || ['L' + (i + 1), 0];
    return { key: k[0], auto: !!k[1], build: () => buildLevel(i, true), script: demoScript };
  }
  const TKD = TIER === 'tk';
  const ACT = '#dock .gs-action';
  const grabPt = P => ({ x: P.x, y: P.y + P.k * 55 });   // lower body: clear of the knob rod
  async function dragPupTo(d, P, x, y, t) {
    if (Math.abs(x - P.x) < 2 && Math.abs(y - P.y) < 2) return;
    const g = grabPt(P);
    await d.drag(g, { x: g.x + x - P.x, y: g.y + y - P.y }, t || 1300);
  }
  async function turnKnob(d, P, rot) {
    if (P.rot === rot) return;
    const R = P.k * -SH[P.shape].bb.y0 + 52, r0 = P.rot, pts = [];
    for (let j = 0; j <= 10; j++) { const a = (r0 + (rot - r0) * j / 10) * RAD; pts.push({ x: P.x + Math.sin(a) * R, y: P.y - Math.cos(a) * R }); }
    await d.path(pts, 1500);
  }
  async function demoScript(d) {
    await d.wait(600);
    const k = RD.kind;
    if (k === 'match') await demoMatch(d);
    else if (k === 'marker') await demoMarker(d);
    else if (k === 'sort') await demoSort(d);
    else if (k === 'holes') await demoHoles(d);
    else if (k === 'mirror') await demoMirror(d);
    else if (k === 'table') await demoTable(d);
    else if (k === 'tree') await demoTree(d);
    else if (k === 'ask') await demoAsk(d);
    await d.success(60000);
  }
  function matchLines() {
    const pi = RD.pups.findIndex(p => p.sol), P = PUPS[pi], S = RD.pups[pi].sol, t = TGTS[0], L = LAMPS[0];
    const pr = proj(L, P), lab = t ? SH[t.shape].label : '';
    if (RD.auto) return ['Wayang di depan lampu.', 'Lihat, ada bayangannya!'];
    if (RD.lampChoice) return ['Lampu besar membuat tepi bayangan kabur.', 'Pilih lampu kecil, lalu atur jaraknya.'];
    if (RD.choose && RD.label === 'pekat') return ['Bayangan harus pekat.', cap(MAT[P.mat].name) + ' tidak tembus cahaya. Pakai ini.'];
    if (RD.choose) return ['Garisnya bentuk ' + lab + '.', 'Ambil wayang ' + lab + '.'];
    if (RD.numeric) {
      const T = Math.round(t.sc / P.k * RD.H), m = T / RD.H;
      return ['Bayangan ' + T + ' cm, wayang ' + RD.H + ' cm. ' + T + ' ÷ ' + RD.H + ' = ' + dec(m) + '.', 'Jaraknya 3 m ÷ ' + dec(m) + ' = ' + dec(3 / m) + ' m.'];
    }
    if (LAMPS.some(q => q.drag)) {
      const up = t.cy < pr.cy;
      return TKD ? [up ? 'Bayangan harus naik.' : 'Bayangan harus turun.', up ? 'Lampu turun, bayangan naik.' : 'Lampu naik, bayangan turun.']
        : [up ? 'Bayangannya harus naik.' : 'Bayangannya harus turun.', up ? 'Lampu turun, bayangan naik. Turunkan lampunya.' : 'Lampu naik, bayangan turun. Naikkan lampunya.'];
    }
    if (LAMPS.some(q => q.col)) {
      const blue = t.colFill === '#4A8DE0';
      return [blue ? 'Bayangan biru dibuat lampu jingga.' : 'Bayangan jingga dibuat lampu biru.', 'Cahaya lampu lain mewarnai bayangannya.'];
    }
    if (LAMPS.length > 1) return ['Dua lampu, dua bayangan.', 'Geser wayang sampai keduanya pas.'];
    if (TGTS.length > 1) return ['Dua wayang, dua garis.', 'Atur satu per satu.'];
    if (RD.dark && RD.label) {
      const m = Math.round(t.m);
      if (RD.steps) return [(m === 2 ? 'Dua' : 'Tiga') + ' kali tinggi wayang. Ada enam langkah.', (m === 2 ? 'Tiga' : 'Dua') + ' langkah dari lampu. Taruh di sini.'];
      return [(m === 2 ? 'Dua' : 'Tiga') + ' kali tinggi wayang.', m === 2 ? 'Di tengah antara lampu dan kelir.' : 'Di sepertiga jalan dari lampu.'];
    }
    const lines = [];
    if (P.drag !== 'y' && P.drag && Math.abs(S.x - P.x) > 2) {
      const big = pr ? pr.sc > t.sc : (S.x - L.x) > (P.x - L.x);
      if (!pr) lines.push(TKD ? 'Bawa ke depan lampu.' : 'Bawa wayang ke depan lampu.');
      else lines.push(TKD ? (big ? 'Jauh dari lampu, bayangan kecil.' : 'Dekat lampu, bayangan besar.') : (big ? 'Kebesaran. Jauhkan dari lampu.' : 'Kekecilan. Dekatkan ke lampu.'));
    }
    if (P.drag === 'y' || P.drag === 'xy' || P.drag === 'free') if (Math.abs(S.y - P.y) > 2 && P.drag === 'y') lines.push(S.y < P.y ? 'Garisnya lebih tinggi. Naikkan wayangnya.' : 'Garisnya lebih rendah. Turunkan wayangnya.');
    if ((P.drag === 'xy' || P.drag === 'free') && !TKD) lines.push('Naik turun juga, sampai pas garis.');
    if (TKD && P.drag === 'free' && pr === null) lines.push('Atur sampai pas garis.');
    if (P.rotate && (S.rot || 0) !== P.rot) lines.push('Garisnya miring. Putar tombol kuning.');
    return lines.length ? lines : ['Cocokkan bayangan dengan garis.'];
  }
  async function demoMatch(d) {
    const lines = matchLines();
    await d.say(lines[0]);
    if (RD.lampChoice && LAMPS[0].art !== 'kecil') await d.tap(() => uiG.querySelector('[data-hit="lampu-kecil"]'));
    let li = 1;
    const next = async () => { if (lines[li]) await d.say(lines[li++]); };
    for (let i = 0; i < LAMPS.length; i++) {
      const s = RD.lamps[i].sol, L = LAMPS[i];
      if (L.drag && s && s.y != null && Math.abs(s.y - L.y) > 2) {
        await next();
        const g = { x: L.x - 40, y: L.y + 52 };
        await d.drag(g, { x: g.x, y: g.y + s.y - L.y }, 1400);
      }
    }
    for (let i = 0; i < PUPS.length; i++) {
      const s = RD.pups[i].sol, P = PUPS[i];
      if (!s) continue;
      if (P.drag) {
        if (TGTS.length > 1 || li < 2) await next();
        await dragPupTo(d, P, P.drag === 'y' ? P.x : s.x, P.drag === 'x' ? P.y : s.y);
      }
      if (P.rotate && (s.rot || 0) !== P.rot) { await next(); await turnKnob(d, P, s.rot || 0); }
    }
    while (lines[li]) await next();
    if (RD.auto) return;
    await d.say(RD.dark ? (TKD ? 'Nyalakan lampunya!' : 'Sudah. Sekarang nyalakan lampunya!') : (TKD ? 'Pas! Tekan Cek.' : 'Bayangannya pas di garis. Cek!'), 1600);
    await d.tap(ACT);
  }
  async function demoMarker(d) {
    const P = PUPS[0], L = LAMPS[0], m = (SX - L.x) / (P.x - L.x);
    if (RD.variant === 'lift') {
      const ty = cyOf(L, P.y + RD.dy, m), up = RD.dy < 0;
      await d.say(up ? 'Wayang akan naik. Bayangannya ikut naik.' : 'Wayang akan turun. Bayangannya ikut turun.');
      await d.say('Kelir dua kali lebih jauh, jadi geraknya dua kali.');
      await d.drag({ x: 830, y: MK.y }, { x: 830, y: ty }, 1300);
      await d.say('Itu tebakanku. Sekarang lihat!', 1600);
      await d.tap(ACT);
      return;
    }
    const hs = Math.round(RD.H * m), dd = (P.x - L.x) / UM;
    await d.say('Wayang ' + RD.H + ' cm, jaraknya ' + dec(dd) + ' m. Kelirnya 3 m.');
    await d.say('3 ÷ ' + dec(dd) + ' = ' + dec(m) + '. Bayangan ' + RD.H + ' × ' + dec(m) + ' = ' + hs + ' cm.');
    await d.drag({ x: 824, y: MK.y }, { x: 824, y: FOOT - hs * 2.2 }, 1400);
    await d.say('Tebakanku ' + hs + ' cm. Nyalakan!', 1600);
    await d.tap(ACT);
  }
  async function demoSort(d) {
    await d.say('Uji tiap bahan di depan lampu.', 1700);
    for (const P of PUPS.slice()) {
      await dragPupTo(d, P, 620, 330, 900);
      const kd = MAT[P.mat].kind;
      await d.say(kd === 'bening' ? 'Hampir tanpa bayangan. Bening.' : kd === 'samar' ? 'Bayangannya samar.' : 'Bayangannya pekat.', 1200);
      const T = TRAYS.find(q => q.kind === kd);
      await dragPupTo(d, P, T.x, 700 - P.k * SH[P.shape].bb.y1, 800);
    }
    await d.tap(ACT);
  }
  async function demoHoles(d) {
    await d.say('Cahaya merambat lurus.');
    await d.say('Lubang karton harus segaris dengan lampu dan bintang.');
    for (let i = 0; i < BOARDS.length; i++) {
      const B = BOARDS[i], need = RD.boards[i].need;
      await d.drag({ x: B.x, y: B.h + 64 }, { x: B.x, y: need + 64 }, 1100);
    }
    await d.say('Cahayanya sampai ke bintang. Cek!', 1500);
    await d.tap(ACT);
  }
  async function demoMirror(d) {
    await d.say(MIRRORS.length > 1 ? 'Cahaya ke cermin pertama, lalu cermin kedua.' : 'Cahaya memantul di cermin.');
    await d.say('Sudut datang sama dengan sudut pantul.');
    for (const M of MIRRORS) {
      const a0 = M.y > 400 ? -90 : 90, da = Math.round(M.sol) - M.a, pts = [];
      for (let j = 0; j <= 10; j++) { const a = (a0 + da * j / 10) * RAD; pts.push({ x: M.x + Math.cos(a) * 62, y: M.y + Math.sin(a) * 62 }); }
      await d.path(pts, 1600);
    }
    await d.say('Cahayanya kena wayang. Cek!', 1500);
    await d.tap(ACT);
  }
  async function demoTable(d) {
    const P = PUPS[0], L = LAMPS[0];
    await d.say('Wayang ' + RD.H + ' cm. Ukur di tiga jarak, lalu catat.');
    for (const dd of [2, 1, 1.5]) {
      if (Math.abs(distM(P) - dd) > .01) await dragPupTo(d, P, L.x + dd * UM, P.y, 1000);
      await d.tap(ACT);
      await d.wait(1300);
    }
    for (let n = 0; n < 60 && TB.phase !== 'predict'; n++) await d.wait(150);
    const want = Math.round(RD.H * 3 / TB.d);
    await d.say('Di ' + dec(TB.d) + ' m: 3 ÷ ' + dec(TB.d) + ' = ' + dec(3 / TB.d) + '.');
    await d.say(RD.H + ' cm × ' + dec(3 / TB.d) + ' = ' + want + ' cm.');
    for (let n = 0; n < 40 && TB.guess < want; n++) await d.tap(() => dock.querySelectorAll('.wy-step')[1]);
    await d.tap(ACT);
  }
  async function demoTree(d) {
    const T = TREE, a = T.hs * T.r, b = T.ht * T.r;
    await d.say('Tongkat ' + dec(T.hs) + ' m. Ukur bayangannya.');
    let tp = T.tapes[0];
    await d.drag({ x: tp.x, y: GY + 34 }, { x: T.sx + a * TU, y: GY + 34 }, 1200);
    await d.say('Bayangannya ' + dec(a) + ' m, ' + dec(T.r) + ' kali tingginya.');
    tp = T.tapes[1];
    await d.drag({ x: tp.x, y: GY + 38 }, { x: T.tx + b * TU, y: GY + 38 }, 1400);
    await d.say('Bayangan pohon ' + dec(b) + ' m. ' + dec(b) + ' ÷ ' + dec(T.r) + ' = ' + dec(T.ht) + ' m.');
    for (let n = 0; n < 30 && STEP.v < T.ht - .01; n++) await d.tap(() => dock.querySelectorAll('.wy-step')[1]);
    await d.tap(ACT);
  }
  async function demoAsk(d) {
    const near = PUPS[0].x < PUPS[1].x ? 0 : 1, lab = SH[PUPS[near].shape].label;
    await d.say('Bayangan ' + lab + ' lebih besar.');
    await d.say('Yang dekat lampu, bayangannya besar. Jadi ' + lab + '.');
    await d.tap(() => coverG.querySelector('[data-hit="pilih-' + PUPS[near].shape + '"]'));
  }

  /* ================= test hook: solve() plays the current round through the real code paths ================= */
  function solve() {
    if (!RD || busy) return;
    const k = RD.kind;
    if (k === 'match') {
      if (RD.lampChoice && LAMPS[0].art !== 'kecil') { const c = uiG.querySelector('[data-hit="lampu-kecil"]'); if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      RD.lamps.forEach((ls, i) => { if (ls.sol) { if (ls.sol.x != null) LAMPS[i].x = ls.sol.x; if (ls.sol.y != null) LAMPS[i].y = ls.sol.y; } });
      RD.pups.forEach((ps, i) => { if (ps.sol) { PUPS[i].x = ps.sol.x; PUPS[i].y = ps.sol.y; PUPS[i].rot = ps.sol.rot || 0; } });
      render();
      if (RD.auto) autoPlace(); else checkMatch();
    } else if (k === 'marker') {
      const L = LAMPS[0], P = PUPS[0], m = (SX - L.x) / (P.x - L.x);
      if (RD.variant === 'lift') MK.y = cyOf(L, P.y + RD.dy, m); else MK.cm = Math.round(RD.H * m / 10) * 10;
      if (RD.variant === 'height') MK.y = FOOT - MK.cm * 2.2;
      render(); goMarker();
    } else if (k === 'sort') {
      PUPS.forEach(P => { if (P.ok) return; const T = TRAYS.find(t => t.kind === MAT[P.mat].kind); P.x = T.x; P.y = 700 - P.k * SH[P.shape].bb.y1; sortDrop(P); });
      render(); updateDock(); checkSort();
    } else if (k === 'holes') {
      BOARDS.forEach((B, i) => { B.h = RD.boards[i].need; }); render(); checkHoles();
    } else if (k === 'mirror') {
      MIRRORS.forEach(M => { M.a = Math.round(M.sol); }); render(); checkMirror();
    } else if (k === 'table') {
      const L = LAMPS[0], P = PUPS[0];
      if (TB.phase === 'measure') {
        RD.marks.filter(d => !TB.rows.some(r => Math.abs(r.d - d) < .01)).slice(0, 3 - TB.rows.length).forEach(d => { P.x = L.x + d * UM; render(); goTable(); });
      } else { STEP.v = Math.round(RD.H * 3 / TB.d); syncStep(); goTable(); }
    } else if (k === 'tree') {
      TREE.tapes[0].x = TREE.sx + TREE.hs * TREE.r * TU; TREE.tapes[1].x = TREE.tx + TREE.ht * TREE.r * TU;
      STEP.v = TREE.ht; syncStep(); drawTree(); checkTree();
    } else if (k === 'ask') {
      chooseNearer(PUPS[0].x < PUPS[1].x ? 0 : 1);
    }
  }
  window.__game = {
    go: i => run.go(i),
    solve,
    count: () => LEVELS.length,
    speed: n => { SPEED = Math.max(1, +n || 1); },
    tier: TIER,
    get state() { return { level: run.current, round: RI, rounds: LV ? LV.rounds.length : 0, kind: RD && RD.kind, tries, busy, light }; },
    toScreen(x, y) { const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; const r = pt.matrixTransform(svg.getScreenCTM()); return { x: r.x, y: r.y }; },
    pups: () => PUPS.map(P => ({ x: P.x, y: P.y, rot: P.rot, shape: P.shape, sol: RD.pups && RD.pups[PUPS.indexOf(P)] ? RD.pups[PUPS.indexOf(P)].sol : null })),
    lamps: () => LAMPS.map(L => ({ x: L.x, y: L.y }))
  };
  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
