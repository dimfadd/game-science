/* Jam Kampung (jam)
 * A big wall clock hangs on the pos ronda tower. The child turns the minute hand by dragging
 * anywhere on the face: the angle from the centre is unwrapped continuously, so time keeps
 * running through hours, noon and midnight. The hour hand is geared like a real clock:
 * hour angle = (h + m/60) * 30 deg, minute angle = m * 6 deg; it is never set on its own
 * (only the TK "jarum pendek saja" level shows an hour hand alone).
 * The kampung runs on the clock's time with truthful formulas (see renderWorld):
 *   sun elevation e = 90 - 15 * |t - 12| (equator, equinox: rises east 06.00, sets west 18.00),
 *   pole shadow L = H / tan(e), pointing away from the sun; sky, lamps, moon and stars follow e.
 * Hands snap only to the tier's stated grid on release (TK 60, k1 30, k2 5, k3/k4 1 minute),
 * never to the answer. Feedback comes from the world: the bus does not come, the angkot has
 * not arrived, the shadow is longer than the line. */
(function () {
  'use strict';
  const GAME = 'jam';
  const TIER = (window.GS && GS.tier) ? GS.tier() : 'k1';   // tk | k1 | k2 | k3 | k4
  const OUT = '#3B2A20', INK = '#2B1D14';
  const DAY = 86400, HALF = 43200;
  /* ---- layout (canvas units, 1280 x 800 design area) ---- */
  const CX = 1020, CY = 352, FR = 222, BEZ = 246, ARC_R = 236;   // clock centre, face, bezel, duration arc
  const HZ = 600;                                               // horizon
  const POLE = { x: 360, y: 662, h: 110, f0: 82, f1: 108, fw: 44 }; // flagpole: base, height, flag heights/width
  const SUNP = { cx: 360, cy: 600, rx: 335, ry: 318 };          // sun path (centred over the pole)
  const SHADOW_MAX = 430;                                       // drawn shadow length cap (fades out beyond)
  const CARD = { x: 395, y: 16, w: 362 };
  const PANEL = { x: 395, w: 362 };
  const GRID = { tk: 3600, k1: 1800, k2: 300, k3: 60, k4: 60 }[TIER] || 1800;   // snapping grid in seconds
  const LIFT = 30;
  let SPEED = 1;
  const ms = v => v / SPEED;
  const hasArt = fn => !!(window.GS && GS.art && typeof GS.art[fn] === 'function');

  /* ================= small utilities ================= */
  const n1 = v => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = n => String(n).padStart(2, '0');
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const shuffle = a => GS.shuffle(a);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function wrap(v, m) { return ((v % m) + m) % m; }
  function wrapSigned(v, m) { let x = wrap(v, m); if (x > m / 2) x -= m; return x; }
  const HM = (h, m, s) => h * 3600 + (m || 0) * 60 + (s || 0);
  const tod = t => wrap(Math.round(t), DAY);                       // seconds since midnight
  const hmOf = t => { const x = tod(t); return { h: Math.floor(x / 3600), m: Math.floor((x % 3600) / 60), s: x % 60 }; };
  let uidN = 0;
  const uid = p => 'jm' + p + (++uidN).toString(36);
  function rngS(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  const hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  function mix(a, b, t) { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join(''); }
  const nightCol = c => mix(c, '#141C44', 0.62);

  /* ================= time in words (captions and speech) ================= */
  const NW = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
  function numWords(n) {
    if (n < 10) return NW[n];
    if (n === 10) return 'sepuluh';
    if (n === 11) return 'sebelas';
    if (n < 20) return NW[n - 10] + ' belas';
    if (n < 100) return NW[Math.floor(n / 10)] + ' puluh' + (n % 10 ? ' ' + NW[n % 10] : '');
    const h = Math.floor(n / 100), r = n % 100;
    return (h === 1 ? 'seratus' : NW[h] + ' ratus') + (r ? ' ' + numWords(r) : '');
  }
  const h12 = h => (wrap(h, 12) || 12);
  /** Part of the day the Indonesian way. */
  function period(sec) {
    const t = wrap(sec, DAY) / 3600;
    return t >= 4 && t < 11 ? 'pagi' : t >= 11 && t < 15 ? 'siang' : t >= 15 && t < 18 ? 'sore' : 'malam';
  }
  /** h:m as children say it: "jam 7", "jam setengah 8" (= 7.30), "jam 7 lewat seperempat",
   *  "jam 8 kurang seperempat", "jam 8 lewat 25 menit", "jam 9 kurang 10 menit".
   *  Digits stay digits (easy to read in the caption; TTS reads them as Indonesian numbers). */
  function timeWords(sec, withPeriod) {
    const x = tod(sec), h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60);
    let s;
    if (m === 0) s = 'jam ' + h12(h);
    else if (m === 30) s = 'jam setengah ' + h12(h + 1);
    else if (m === 15) s = 'jam ' + h12(h) + ' lewat seperempat';
    else if (m === 45) s = 'jam ' + h12(h + 1) + ' kurang seperempat';
    else if (m < 30) s = 'jam ' + h12(h) + ' lewat ' + m + ' menit';
    else s = 'jam ' + h12(h + 1) + ' kurang ' + (60 - m) + ' menit';
    return withPeriod ? s + ' ' + period(x) : s;
  }
  /** Digital time, Indonesian style with a dot: 07.25, 19.30. */
  const digital = sec => { const a = hmOf(sec); return pad2(a.h) + '.' + pad2(a.m); };
  const digital12 = sec => { const a = hmOf(sec); return pad2(h12(a.h)) + '.' + pad2(a.m); };
  /** "19.30" read aloud: "sembilan belas tiga puluh"; "07.05": "tujuh lewat lima". */
  function digitalSpoken(h, m) { return numWords(h) + (m === 0 ? '' : m < 10 ? ' lewat ' + numWords(m) : ' ' + numWords(m)); }
  const durWords = (sec, unit) => {
    const tm = Math.round(Math.abs(sec) / 60), h = Math.floor(tm / 60), m = tm % 60;
    if (unit === 'm') return tm + ' menit';
    if (unit === 's') return Math.round(Math.abs(sec)) + ' detik';
    if (unit === 'h' && !m) return h + ' jam';
    return (h ? h + ' jam' : '') + (h && m ? ' ' : '') + (m || !h ? m + ' menit' : '');
  };
  // Speech only: digital times "07.25" are read as words (captions keep the digits).
  // A local wrapper around the shared GS.speakable; nothing else on the page uses "dd.dd".
  if (GS.speakable && !GS.speakable.__jam) {
    const base = GS.speakable;
    GS.speakable = function (t) {
      return base(String(t).replace(/\b(\d{1,2})\.(\d{2})\b/g, (m0, h, mm) => (+h < 24 && +mm < 60 ? digitalSpoken(+h, +mm) : m0)).replace(/\bkm\b/g, 'kilometer'));
    };
    GS.speakable.__jam = true;
  }

  /* ================= the sun and the shadow (truthful) =================
   * Indonesia lies on the equator, so the model is the equinox sun at latitude 0: it rises due
   * east at 06.00, passes overhead at 12.00 and sets due west at 18.00. The hour angle grows
   * 15 degrees per hour from noon: Hd = 15 * (t - 12); elevation e = 90 - |Hd| (degrees,
   * negative below the horizon). On screen east is left, west is right (viewer faces south). */
  const elevAt = t => 90 - Math.abs(15 * (tod(t) / 3600 - 12));
  function skyPos(Hd) { const r = Hd * Math.PI / 180; return { x: SUNP.cx + SUNP.rx * Math.sin(r), y: SUNP.cy - SUNP.ry * Math.cos(r) }; }
  /** Shadow of a vertical pole of height h on flat ground: L = h / tan(e); none when e <= 0. */
  const shadowLen = (h, e) => (e <= 0.01 ? null : h / Math.tan(e * Math.PI / 180));
  /** +1: shadow points west (right, morning sun in the east); -1: east (afternoon). */
  const shadowDir = t => (tod(t) < HM(12) ? 1 : -1);
  const SKY = [[-90, '#0D1433', '#1A2452'], [-12, '#0D1433', '#1A2452'], [-6, '#212C63', '#4B3F7E'], [-1.5, '#3B4C8E', '#E0796B'],
    [2, '#6E9ED6', '#FFB27A'], [9, '#8DCAE8', '#FFE2AC'], [22, '#9ED8EC', '#E6F5F0'], [91, '#86CDEB', '#E9F7F2']];
  function skyAt(e) {
    for (let i = 1; i < SKY.length; i++) if (e <= SKY[i][0]) {
      const a = SKY[i - 1], b = SKY[i], k = (e - a[0]) / (b[0] - a[0]);
      return [mix(a[1], b[1], k), mix(a[2], b[2], k)];
    }
    return [SKY[SKY.length - 1][1], SKY[SKY.length - 1][2]];
  }

  /* ================= drawing helpers (Kampung Chunky) ================= */
  const P = {
    red: ['#E2453C', '#F27A6E', '#B5322B'], orange: ['#F28C28', '#F8B26A', '#C76A12'], yellow: ['#FFC83D', '#FFE08A', '#E09A00'],
    green: ['#4DAA57', '#86CC8C', '#357F40'], blue: ['#2F80C9', '#6FAEE3', '#215F98'], wood: ['#A8673A', '#C68654', '#7E4A27'],
    stone: ['#8C8F94', '#AEB1B5', '#63666B'], brass: ['#D9A441', '#EECB7A', '#A8771F'], cream: ['#FFF8EC', '#FFFFFF', '#E8D9BF'],
    teal: ['#2E9C8A', '#62C2B2', '#1D7466'], white: ['#FBF6EC', '#FFFFFF', '#DCCFBB'], roof: ['#C8643B', '#E08A62', '#963F22'],
    bamboo: ['#E3C27F', '#F2DCAA', '#B8924F'], dark: ['#3A3436', '#5A5356', '#232022'], steel: ['#B9C2CB', '#E3E8ED', '#7F8994']
  };
  const Ci = (cx, cy, r, a) => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" ${a || ''}/>`;
  const El = (cx, cy, rx, ry, a) => `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" ${a || ''}/>`;
  const Rc = (x, y, w, h, rx, a) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(rx || 0)}" ${a || ''}/>`;
  const Pa = (d, a) => `<path d="${d}" ${a || ''}/>`;
  const fill = (c, op) => `fill="${c}"` + (op != null ? ` opacity="${op}"` : '');
  const ol = sw => `stroke="${OUT}" stroke-width="${sw || 3}" stroke-linejoin="round" stroke-linecap="round"`;
  const solid = (c, sw) => `fill="${c}" ${ol(sw)}`;
  const line = (d, sw, c, op) => `<path d="${d}" fill="none" stroke="${c || OUT}" stroke-width="${sw || 3}" stroke-linecap="round" stroke-linejoin="round"${op != null ? ` opacity="${op}"` : ''}/>`;
  const shadowE = (cx, cy, rx) => El(cx, cy, rx, Math.max(3, rx * 0.2), fill(OUT, 0.18));
  const txt = (x, y, s, size, o) => {
    o = o || {};
    return `<text x="${n1(x)}" y="${n1(y)}" font-size="${size}" text-anchor="${o.anchor || 'middle'}" fill="${o.fill || INK}"${o.cls ? ` class="${o.cls}"` : ''}${o.decor ? ' data-qc="decor"' : ''}${o.w ? ` font-weight="${o.w}"` : ''} style="font-variant-numeric:tabular-nums">${esc(s)}</text>`;
  };
  /** 3-tone fill: shade crescent (bottom-right), base, highlight blob (top-left), outline.
   *  shape(attrs) returns the markup of one shape; box = [x, y, w, h]; c = [base, hl, shade]. */
  function f3(shape, box, c, o) {
    o = o || {};
    const x = box[0], y = box[1], w = box[2], h = box[3], id = uid('c'), off = Math.min(w, h) * (o.k == null ? 0.12 : o.k);
    let s = `<clipPath id="${id}">${shape('')}</clipPath><g clip-path="url(#${id})">` +
      `<rect x="${n1(x - 6)}" y="${n1(y - 6)}" width="${n1(w + 12)}" height="${n1(h + 12)}" fill="${c[2]}"/>` +
      `<g transform="translate(${n1(-off)} ${n1(-off)})">${shape(`fill="${c[0]}"`)}</g>`;
    if (o.hl !== false) {
      const hx0 = x + w * (o.hx == null ? 0.3 : o.hx), hy0 = y + h * (o.hy == null ? 0.27 : o.hy);
      s += `<ellipse cx="${n1(hx0)}" cy="${n1(hy0)}" rx="${n1(Math.max(2, w * 0.17))}" ry="${n1(Math.max(1.5, h * 0.09))}" transform="rotate(-30 ${n1(hx0)} ${n1(hy0)})" fill="${c[1]}" opacity=".9"/>`;
    }
    s += (o.inner || '') + '</g>';
    if (o.ol !== false) s += shape(`fill="none" ${ol(o.sw)}`);
    return s;
  }
  const leafD = (bx, by, tx, ty, wid) => {
    const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
    const p = (a, b) => `${n1(bx + ux * a + px * b)} ${n1(by + uy * a + py * b)}`;
    return `M${p(0, 0)}C${p(L * 0.25, wid)} ${p(L * 0.72, wid * 0.8)} ${p(L, 0)}C${p(L * 0.72, -wid * 0.8)} ${p(L * 0.25, -wid)} ${p(0, 0)}Z`;
  };

  /* ---------- scenery (no outline: background, see DESIGN.md) ---------- */
  function ridge(y, amp, n, seed, col) {
    const R = rngS(seed), x0 = -600, x1 = 1880, pts = [];
    for (let i = 0; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y - amp * (0.3 + 0.7 * R())]);
    let d = `M${x0} 800L${x0} ${n1(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2; d += `C${n1(mx)} ${n1(a[1])} ${n1(mx)} ${n1(b[1])} ${n1(b[0])} ${n1(b[1])}`; }
    return `<path d="${d}L${x1} 800Z" fill="${col}"/>`;
  }
  const cloud = (x, y, k, cls) => `<g transform="translate(${x} ${y}) scale(${k})"><g class="jm-cloud ${cls || ''}"><path d="M-62 0C-68 -18 -50 -30 -35 -22C-29 -44 6 -50 18 -30C30 -42 56 -36 54 -12C68 -12 70 0 62 0Z" fill="#FFFFFF" opacity=".95"/><path d="M-60 0C-59 -6 -53 -7 -44 -7L56 -7C63 -7 66 -3 62 0Z" fill="#DDEFF3"/></g></g>`;
  function tree(x, gy, k, cols) {
    cols = cols || ['#5DAE52', '#80C774', '#3F8A3E'];
    let o = `<path d="M${n1(x - 7 * k)} ${gy}L${n1(x - 5 * k)} ${n1(gy - 52 * k)}L${n1(x + 5 * k)} ${n1(gy - 52 * k)}L${n1(x + 7 * k)} ${gy}Z" fill="#8A5A36"/>`;
    const blobs = [[0, -72, 32], [-27, -56, 24], [27, -56, 24], [-14, -92, 24], [15, -90, 24]];
    o += blobs.map(b => Ci(x + (b[0] + 4) * k, gy + (b[1] + 4) * k, b[2] * k, fill(cols[2]))).join('');
    o += blobs.map(b => Ci(x + b[0] * k, gy + b[1] * k, b[2] * k, fill(cols[0]))).join('');
    return o + Ci(x - 17 * k, gy - 98 * k, 9 * k, fill(cols[1])) + Ci(x - 32 * k, gy - 62 * k, 7 * k, fill(cols[1]));
  }
  function palm(x, gy, H, lean, k) {
    const tx = x + lean, ty = gy - H;
    let o = `<path d="M${n1(x - 6 * k)} ${gy}Q${n1(x - 4 * k)} ${n1(gy - H / 2)} ${n1(tx - 3 * k)} ${n1(ty)}L${n1(tx + 3 * k)} ${n1(ty)}Q${n1(x + 6 * k)} ${n1(gy - H / 2)} ${n1(x + 6 * k)} ${gy}Z" fill="#A07A52"/>`;
    [[-62, -4], [-36, -20], [-8, -26], [20, -22], [46, -6], [64, 12], [-50, 14]].forEach(([dx, dy], i) => {
      o += `<path d="${leafD(tx, ty, tx + dx * k, ty + (dy + 16) * k, 8 * k)}" fill="${i % 2 ? '#3F8A3E' : '#5DA84F'}"/>`;
    });
    return o + Ci(tx - 3 * k, ty + 5 * k, 4.5 * k, fill('#7E5A2E')) + Ci(tx + 4 * k, ty + 6 * k, 4.5 * k, fill('#6B4A24'));
  }
  function house(x, gy, k, wall, roof, kind, glows) {
    const W = 74 * k, H = 38 * k, st = 12 * k, top = gy - st - H;
    let o = '';
    [-0.42, -0.14, 0.14, 0.42].forEach(f => { o += Rc(x + f * W - 2.5 * k, gy - st, 5 * k, st, 0, fill('#7E5A3A')); });
    o += Rc(x - W / 2, top, W, H, 0, fill(wall)) + Rc(x + W / 2 - 8 * k, top, 8 * k, H, 0, fill(mix(wall, '#5A2A14', 0.18)));
    for (let yy = top + 6 * k; yy < top + H; yy += 6 * k) o += Rc(x - W / 2, yy, W - 8 * k, 1.2 * k, 0, fill('#6B4A20', 0.12));
    o += Rc(x - W / 2 - 3 * k, gy - st - 4 * k, W + 6 * k, 5 * k, 0, fill('#8A5A36'));
    o += Rc(x - 8 * k, top + 10 * k, 14 * k, H - 14 * k, 1.5 * k, fill('#7A5238'));
    [[x - 30 * k, top + 10 * k, 14 * k, 12 * k], [x + 14 * k, top + 10 * k, 12 * k, 12 * k]].forEach(w => {
      o += Rc(w[0], w[1], w[2], w[3], 1.5 * k, fill('#5A3E2E')) + Rc(w[0] + w[2] / 2 - 0.6 * k, w[1], 1.2 * k, w[3], 0, fill('#8A6A4E'));
      glows.push({ x: w[0], y: w[1], w: w[2], h: w[3], kind });
    });
    o += `<path d="M${n1(x - W / 2 - 12 * k)} ${n1(top + 4 * k)}L${n1(x - 10 * k)} ${n1(top - 34 * k)}L${n1(x + 10 * k)} ${n1(top - 34 * k)}L${n1(x + W / 2 + 12 * k)} ${n1(top + 4 * k)}Z" fill="${roof}"/>`;
    o += `<path d="M${n1(x + 10 * k)} ${n1(top - 34 * k)}L${n1(x + W / 2 + 12 * k)} ${n1(top + 4 * k)}L${n1(x + W / 2 - 4 * k)} ${n1(top + 4 * k)}L${n1(x + 4 * k)} ${n1(top - 30 * k)}Z" fill="${mix(roof, '#3B2A20', 0.14)}"/>`;
    o += `<path d="M${n1(x - W / 2 - 12 * k)} ${n1(top + 4 * k)}H${n1(x + W / 2 + 12 * k)}L${n1(x + W / 2 + 8 * k)} ${n1(top - 1 * k)}H${n1(x - W / 2 - 8 * k)}Z" fill="${mix(roof, '#3B2A20', 0.28)}"/>`;
    return o;
  }
  function warung(x, gy, glows) {
    const W = 150, top = gy - 92;
    let o = Rc(x - W / 2 + 6, top, 8, 92, 0, fill('#8A5A36')) + Rc(x + W / 2 - 14, top, 8, 92, 0, fill('#8A5A36'));
    o += Rc(x - W / 2, top + 6, W, 86, 0, fill('#D29A62')) + Rc(x + W / 2 - 14, top + 6, 14, 86, 0, fill('#B07A48'));
    for (let xx = x - W / 2 + 18; xx < x + W / 2 - 14; xx += 18) o += Rc(xx, top + 6, 1.6, 86, 0, fill('#A8703E', 0.6));
    // opening with goods; the shutter (class jm-shutter) rolls up when the warung opens
    o += Rc(x - 58, top + 20, 104, 40, 3, fill('#5A3E2E'));
    ['#E2453C', '#FFC83D', '#4DAA57', '#F28C28', '#2F80C9', '#F59AB0'].forEach((c, i) => { o += Rc(x - 52 + i * 16, top + 28, 11, 14, 2, fill(c)); });
    o += Rc(x - 52, top + 46, 92, 5, 2, fill('#A8673A'));
    glows.push({ x: x - 58, y: top + 20, w: 104, h: 40, kind: 'warung' });
    o += `<rect class="jm-shutter" x="${x - 60}" y="${top + 18}" width="108" height="44" fill="#9FB3BE"/>`;
    o += Rc(x - W / 2 - 4, top + 60, W + 8, 10, 3, fill('#8A5A36'));
    o += `<path d="M${x - W / 2 - 16} ${top + 10}L${x + W / 2 + 16} ${top + 10}L${x + W / 2 + 4} ${top - 22}L${x - W / 2 - 4} ${top - 22}Z" fill="#A9BCC6"/>`;
    for (let xx = x - W / 2 - 4; xx < x + W / 2 + 6; xx += 14) o += Rc(xx, top - 21, 2, 30, 0, fill('#7F949F', 0.7));
    o += Rc(x - 46, top - 52, 92, 28, 6, fill('#FFF8EC')) + txt(x, top - 30, 'WARUNG', 22, { cls: 't-display', fill: '#C8643B', decor: true });
    return o;
  }
  function musala(x, gy, glows) {
    const W = 120, H = 74, top = gy - H;
    let o = Rc(x - W / 2, top, W, H, 0, fill('#F3E9D6')) + Rc(x + W / 2 - 12, top, 12, H, 0, fill('#DCCFBB'));
    o += Rc(x - W / 2 - 6, top - 8, W + 12, 10, 3, fill('#4DAA57'));
    o += `<path d="M${x - 14} ${gy}V${gy - 34}A14 14 0 0 1 ${x + 14} ${gy - 34}V${gy}Z" fill="#6B4A36"/>`;
    [[x - 46, gy - 50], [x + 26, gy - 50]].forEach(([wx, wy]) => {
      o += `<path d="M${wx} ${wy + 26}V${wy + 8}A10 10 0 0 1 ${wx + 20} ${wy + 8}V${wy + 26}Z" fill="#5A3E2E"/>`;
      glows.push({ x: wx, y: wy, w: 20, h: 26, kind: 'musala' });
    });
    o += `<path d="M${x - 42} ${top - 8}A42 40 0 0 1 ${x + 42} ${top - 8}Z" fill="#4DAA57"/><path d="M${x + 8} ${top - 47}A42 40 0 0 1 ${x + 42} ${top - 8}H${x + 26}A30 34 0 0 0 ${x + 6} ${top - 44}Z" fill="#357F40"/>`;
    o += Rc(x - 2, top - 66, 4, 20, 2, fill('#D9A441')) + Ci(x, top - 66, 5, fill('#D9A441'));
    // speaker horn on a pole (azan waves start here)
    o += Rc(x - 82, gy - 150, 5, 150, 0, fill('#8C8F94')) + `<path d="M${x - 80} ${gy - 150}l22 -10v24z" fill="#B9C2CB"/>`;
    return o;
  }
  function halte(x, gy, glows) {
    let o = Rc(x - 44, gy - 96, 7, 96, 0, fill('#7E5A3A')) + Rc(x + 37, gy - 96, 7, 96, 0, fill('#7E5A3A'));
    o += `<path d="M${x - 58} ${gy - 92}L${x + 58} ${gy - 92}L${x + 48} ${gy - 112}L${x - 48} ${gy - 112}Z" fill="#E2453C"/>`;
    o += Rc(x - 58, gy - 96, 116, 6, 2, fill('#B5322B'));
    o += Rc(x - 34, gy - 40, 68, 8, 3, fill('#A8673A')) + Rc(x - 30, gy - 32, 5, 32, 0, fill('#7E4A27')) + Rc(x + 25, gy - 32, 5, 32, 0, fill('#7E4A27'));
    o += Rc(x - 26, gy - 136, 52, 24, 5, fill('#2F80C9')) + txt(x, gy - 118, 'HALTE', 16, { cls: 't-display', fill: '#FFFFFF', decor: true });
    o += Rc(x - 2, gy - 112, 4, 12, 0, fill('#5A3E2E')) + Rc(x - 8, gy - 102, 16, 14, 4, fill('#F2DCAA'));
    glows.push({ x: x - 8, y: gy - 102, w: 16, h: 14, kind: 'lamp' });
    return o;
  }
  function roosterArt() {
    // feet at (0,0), ~92 units tall, facing right
    let s = shadowE(0, 0, 22);
    s += Pa('M-14 -42C-34 -60 -48 -66 -52 -88C-38 -82 -26 -74 -18 -56Z', solid('#357F40', 2.6));
    s += Pa('M-16 -40C-40 -48 -54 -46 -62 -64C-46 -64 -32 -60 -20 -50Z', solid('#E2453C', 2.6));
    s += Pa('M-16 -34C-36 -34 -50 -26 -58 -40C-44 -44 -30 -44 -18 -42Z', solid('#F28C28', 2.6));
    s += line('M-5 -16L-7 -2M-7 -2L-13 0M-7 -2L-1 0M6 -16L8 -2M8 -2L2 0M8 -2L14 0', 3.2, '#E09A00');
    s += f3(a => El(0, -36, 26, 21, a), [-26, -57, 52, 42], P.white, { k: 0.12 });
    s += El(-4, -36, 14, 9, solid('#E8DCC6', 2));
    s += `<g class="jm-head">` + f3(a => Ci(18, -60, 12, a), [6, -72, 24, 24], P.white, { k: 0.12, hl: false }) +
      Pa('M10 -70C10 -80 16 -82 18 -76C20 -84 26 -84 26 -76C30 -80 34 -76 30 -70Z', solid('#E2453C', 2.2)) +
      Pa('M29 -63L39 -60L29 -56Z', solid('#FFC83D', 2)) + El(28, -52, 3.5, 5, solid('#E2453C', 1.8)) + Ci(21, -63, 2.4, fill(INK)) + Ci(20.3, -63.8, 0.8, fill('#FFFFFF')) + '</g>';
    return s;
  }
  function poleArt() {
    const x = POLE.x, y = POLE.y, top = y - POLE.h;
    let s = shadowE(x, y + 2, 26);
    s += f3(a => Rc(x - 22, y - 12, 44, 14, 3, a), [x - 22, y - 12, 44, 14], P.stone, { hl: false, k: 0.25 });
    s += f3(a => Rc(x - 14, y - 22, 28, 12, 3, a), [x - 14, y - 22, 28, 12], P.stone, { hl: false, k: 0.25 });
    s += f3(a => Rc(x - 3.5, top, 7, POLE.h - 20, 3, a), [x - 3.5, top, 7, POLE.h - 20], P.steel, { hl: false, k: 0.3, sw: 2.4 });
    s += Ci(x, top - 3, 5, solid('#D9A441', 2));
    s += `<g transform="translate(${x + 3} ${top + 2})"><g class="jm-flag">` + Rc(0, 0, POLE.fw, 13, 0, fill('#E2453C')) + Rc(0, 13, POLE.fw, 13, 0, fill('#FBF6EC')) + Rc(0, 0, POLE.fw, 26, 1.5, `fill="none" ${ol(2.4)}`) + '</g></g>';
    return `<g class="jm-pole">${s}</g>`;
  }
  function towerArt(glows) {
    let s = '';
    s += Rc(905, 560, 18, 146, 4, fill('#7E4A27')) + Rc(1117, 560, 18, 146, 4, fill('#7E4A27'));
    s += line('M880 616L1160 700M880 700L1160 616', 12, '#7E4A27') + line('M880 616L1160 700M880 700L1160 616', 2, OUT, 0.35);
    [868, 1172].forEach(x => { s += f3(a => Rc(x - 13, 560, 26, 150, 5, a), [x - 13, 560, 26, 150], P.wood, { hl: false, k: 0.25 }); });
    s += shadowE(1020, 708, 190);
    s += f3(a => Rc(846, 108, 348, 490, 12, a), [846, 108, 348, 490], ['#C68654', '#DDA472', '#9A5A2E'], { k: 0.04, hl: false });
    s += f3(a => Rc(826, 588, 388, 28, 8, a), [826, 588, 388, 28], P.wood, { hl: false, k: 0.2 });
    s += f3(a => Pa('M786 116L878 40L1162 40L1254 116Z', a), [786, 40, 468, 76], P.roof, { k: 0.08, inner: line('M830 104L900 46M880 112L930 46M1160 112L1110 46M1210 104L1140 46', 2, '#963F22', 0.5) });
    s += f3(a => Pa('M902 40L948 8L1092 8L1138 40Z', a), [902, 8, 236, 32], P.roof, { k: 0.1 });
    s += f3(a => Rc(776, 106, 488, 18, 6, a), [776, 106, 488, 18], P.wood, { hl: false, k: 0.25 });
    // lantern under the eave
    s += line('M1236 124V138', 2.4) + f3(a => Rc(1226, 138, 20, 26, 6, a), [1226, 138, 20, 26], ['#F2DCAA', '#FFF6DF', '#C9A86A'], { hl: false, k: 0.2 });
    glows.push({ x: 1228, y: 141, w: 16, h: 20, kind: 'lamp' });
    // kentongan (bamboo slit drum of the pos ronda): swings when it is struck
    s += '<g class="jm-kent">' + line('M930 616V634', 2.6) + f3(a => Rc(918, 632, 24, 66, 10, a), [918, 632, 24, 66], P.bamboo, { k: 0.18 }) + Rc(926, 646, 8, 36, 4, fill('#6B4A20')) + '</g>';
    return s;
  }
  /** The whole static kampung. Drawn twice: a day copy and a night copy (colours mixed toward
   *  deep blue) whose opacity follows the sun, so the world darkens without filters. */
  function landscape() {
    const glows = [];
    let s = '<g class="jm-clouds">' + [[-380, 150, 1.2, ''], [200, 178, 1, 'd1'], [1450, 132, 1.1, 'd2'], [1720, 236, 0.9, ''], [-160, 262, 0.8, 'd1']].map(c => cloud(c[0], c[1], c[2], c[3])).join('') + '</g>';
    s += ridge(552, 34, 14, 3, '#B9DCB1') + ridge(574, 22, 18, 9, '#A3D195');
    s += tree(-470, 600, 1.4) + house(-250, 600, 1.5, '#EBCB92', '#C8643B', 'house', glows) + palm(-60, 600, 150, 14, 1.15);
    s += house(110, 600, 1.6, '#E6C389', '#B5502F', 'kamar', glows);
    s += warung(530, 600, glows) + musala(690, 600, glows);
    s += house(1360, 600, 1.5, '#EBCB92', '#C8643B', 'house', glows) + tree(1540, 602, 1.2) + palm(1650, 600, 140, -16, 1.1) + house(1780, 600, 1.3, '#E3C27F', '#9C7A4A', 'house', glows);
    // ground: grass, the yard around the pole, the road
    s += `<path d="M-600 800V600Q-300 592 0 600T600 600T1200 600T1880 600V800Z" fill="#7CC26B"/>`;
    s += Rc(-600, 640, 2480, 70, 0, fill('#86C874'));
    s += El(380, 664, 330, 30, fill('#E5BE86')) + El(360, 662, 300, 22, fill('#EBC892'));
    s += Rc(-600, 705, 2480, 95, 0, fill('#D4A062')) + Rc(-600, 705, 2480, 7, 0, fill('#B9854A'));
    for (let x = -580; x < 1880; x += 120) s += Rc(x, 752, 60, 6, 3, fill('#F3DDA6'));
    s += halte(225, 706, glows);
    // bamboo fence with the rooster
    s += line('M-40 640H70M-40 662H70', 6, '#B8924F');
    for (let x = -36; x <= 66; x += 17) s += Rc(x, 626, 9, 74, 3, fill('#E3C27F')) + Rc(x + 6, 626, 3, 74, 0, fill('#B8924F'));
    s += `<g transform="translate(26 628)"><g class="jm-rooster jm-bob">${roosterArt()}</g></g>`;
    s += poleArt() + towerArt(glows);
    return { markup: s, glows };
  }

  /* ---------- clock ---------- */
  function clockFace() {
    let s = f3(a => Ci(0, 0, BEZ, a), [-BEZ, -BEZ, 2 * BEZ, 2 * BEZ], P.wood, { k: 0.04, hx: 0.25, hy: 0.15 });
    s += Ci(0, 0, FR + 9, solid('#D9A441', 3));
    s += f3(a => Ci(0, 0, FR, a), [-FR, -FR, 2 * FR, 2 * FR], ['#FFF8EC', '#FFFFFF', '#EFE2C8'], { k: 0.03, hl: false });
    const tk = TIER === 'tk';
    if (!tk) for (let i = 0; i < 60; i++) {
      const a = i * 6 * Math.PI / 180, major = i % 5 === 0, r0 = major ? FR - 26 : FR - 14, r1 = FR - 5;
      s += line(`M${n1(Math.sin(a) * r0)} ${n1(-Math.cos(a) * r0)}L${n1(Math.sin(a) * r1)} ${n1(-Math.cos(a) * r1)}`, major ? 5 : 2.4, INK, major ? 1 : 0.7);
    }
    const rn = tk ? 150 : 168;
    for (let k = 1; k <= 12; k++) {
      const a = k * 30 * Math.PI / 180;
      s += txt(Math.sin(a) * rn, -Math.cos(a) * rn + 19, String(k), 54, { w: 600 });
    }
    // TK: numbers 1 to 6 carry dots (no reading needed)
    if (tk) for (let k = 1; k <= 6; k++) {
      const a = k * 30 * Math.PI / 180, cx = Math.sin(a) * 203, cy = -Math.cos(a) * 203;
      const cols = k <= 3 ? k : 3, rows = Math.ceil(k / 3);
      for (let j = 0; j < k; j++) {
        const r = Math.floor(j / 3), c = j % 3, nInRow = r < rows - 1 ? 3 : k - 3 * (rows - 1);
        const dx = (c - (Math.min(cols, nInRow) - 1) / 2) * 18, dy = (r - (rows - 1) / 2) * 18;
        s += Ci(cx + dx, cy + dy, 7.5, solid('#F28C28', 1.6));
      }
    }
    return s;
  }
  const HAND = {
    m: () => Pa('M-7 26L-6 -148L-14 -148L0 -194L14 -148L6 -148L7 26Z', solid('#2F80C9', 3)) + line('M-2 18V-150', 2.4, '#6FAEE3', 0.9),
    h: () => Pa('M-12 22L-11 -94L-21 -94L0 -128L21 -94L11 -94L12 22Z', solid('#F28C28', 3)) + line('M-4 14V-96', 3, '#F8B26A', 0.9),
    s: () => line('M0 34V-202', 4, '#E2453C') + Ci(0, 26, 8, solid('#E2453C', 2))
  };

  /* ---------- small pictures (cards, order cards): centred at (0,0), about 100 x 100 ---------- */
  function miniClock(r, sec, o) {
    o = o || {};
    let s = Ci(0, 0, r + 6, solid(o.rim || '#A8673A', 3)) + Ci(0, 0, r, solid('#FFF8EC', 2.4));
    for (let k = 0; k < 12; k++) {
      const a = k * 30 * Math.PI / 180, r0 = k % 3 === 0 ? r * 0.74 : r * 0.84, r1 = r * 0.94;
      s += line(`M${n1(Math.sin(a) * r0)} ${n1(-Math.cos(a) * r0)}L${n1(Math.sin(a) * r1)} ${n1(-Math.cos(a) * r1)}`, k % 3 === 0 ? 3.4 : 2, INK);
    }
    if (o.nums) [12, 3, 6, 9].forEach(k => { const a = k * 30 * Math.PI / 180; s += txt(Math.sin(a) * r * 0.58, -Math.cos(a) * r * 0.58 + 13, String(k), 40, { w: 600 }); });
    if (sec != null) s += miniHands(r, sec);
    return s + Ci(0, 0, Math.max(3, r * 0.08), solid('#D9A441', 1.6));
  }
  function miniHands(r, sec) {
    const ha = wrap(sec, HALF) / 120, ma = wrap(sec, 3600) / 10;
    return `<g transform="rotate(${n1(ha)})">${line(`M0 ${n1(r * 0.12)}V${n1(-r * 0.5)}`, Math.max(4, r * 0.15), OUT)}${line(`M0 ${n1(r * 0.12)}V${n1(-r * 0.5)}`, Math.max(2, r * 0.15 - 3), '#F28C28')}</g>` +
      `<g transform="rotate(${n1(ma)})">${line(`M0 ${n1(r * 0.12)}V${n1(-r * 0.8)}`, Math.max(3.4, r * 0.1), OUT)}${line(`M0 ${n1(r * 0.12)}V${n1(-r * 0.8)}`, Math.max(1.6, r * 0.1 - 3), '#2F80C9')}</g>`;
  }
  function busArt() {
    let s = shadowE(0, 2, 150);
    s += f3(a => Rc(-160, -128, 320, 108, 18, a), [-160, -128, 320, 108], P.yellow, { k: 0.08, hx: 0.2 });
    s += Rc(-160, -66, 320, 9, 0, fill(INK, 0.85));
    for (let i = 0; i < 5; i++) s += Rc(-146 + i * 50, -114, 40, 36, 6, solid('#CFEFF7', 2.4)) + line(`M${-140 + i * 50} -108l10 14`, 3, '#FFFFFF', 0.8);
    s += Rc(110, -114, 40, 54, 8, solid('#CFEFF7', 2.4)) + Rc(98, -112, 0.1, 80, 0, '') + Rc(78, -110, 26, 84, 4, solid('#E09A00', 2.4));
    s += Rc(150, -46, 12, 10, 3, solid('#FFE08A', 2)) + Rc(-166, -36, 332, 12, 5, solid('#8C8F94', 2.4));
    s += txt(-30, -38, 'BUS SEKOLAH', 22, { cls: 't-display', fill: INK, decor: true });
    [-100, 100].forEach(x => { s += Ci(x, -20, 24, solid('#3A3436', 3)) + Ci(x, -20, 10, solid('#B9C2CB', 2)); });
    return s;
  }
  function angkotArt(col) {
    col = col || P.teal;
    let s = shadowE(0, 2, 110);
    s += f3(a => Pa('M-112 -24V-86Q-112 -98 -98 -98H52Q66 -98 74 -86L104 -54Q112 -48 112 -38V-24Z', a), [-112, -98, 224, 74], col, { k: 0.08, hx: 0.2 });
    s += Rc(-112, -58, 224, 8, 0, fill('#FFC83D'));
    for (let i = 0; i < 3; i++) s += Rc(-100 + i * 50, -90, 40, 26, 5, solid('#CFEFF7', 2.2));
    s += Pa('M56 -90L66 -90L94 -60H56Z', solid('#CFEFF7', 2.2));
    s += txt(-30, -32, 'ANGKOT', 18, { cls: 't-display', fill: '#FFFFFF', decor: true });
    [-70, 70].forEach(x => { s += Ci(x, -20, 19, solid('#3A3436', 3)) + Ci(x, -20, 8, solid('#B9C2CB', 2)); });
    return s;
  }
  function personArt(i, k) {
    let s = '';
    try { if (hasArt('person')) s = GS.art.person(i, { shadow: true }); } catch (e) { s = ''; }
    if (!s) s = shadowE(0, 0, 16) + Rc(-12, -60, 24, 52, 10, solid('#2F80C9', 2.4)) + Ci(0, -74, 14, solid('#C98B4E', 2.4));
    return `<g transform="scale(${k || 1})">${s}</g>`;
  }
  const ICONS = {
    ayam: () => `<g transform="translate(6 44) scale(1.02)">${roosterArt()}</g>`,
    bus: () => `<g transform="translate(0 30) scale(.3)">${busArt()}</g>`,
    angkot: () => `<g transform="translate(0 26) scale(.4)">${angkotArt()}</g>`,
    pos: () => f3(a => Rc(-42, -28, 84, 56, 6, a), [-42, -28, 84, 56], P.white, { hl: false }) + line('M-40 -24L0 6L40 -24', 3) + Rc(20, -22, 16, 18, 2, solid('#E2453C', 2)),
    warung: () => Rc(-44, -12, 88, 46, 4, solid('#D29A62', 3)) + Rc(-34, -2, 68, 22, 3, fill('#5A3E2E')) + ['#E2453C', '#FFC83D', '#4DAA57', '#F28C28'].map((c, i) => Rc(-30 + i * 16, 4, 11, 12, 2, fill(c))).join('') +
      [0, 1, 2, 3, 4].map(i => Pa(`M${-50 + i * 20} -12l4 -26h16l-4 26z`, solid(i % 2 ? '#FFF8EC' : '#E2453C', 2.4))).join(''),
    makan: () => El(0, 18, 46, 16, solid('#FFFFFF', 3)) + f3(a => Pa('M-30 14C-30 -20 30 -20 30 14Z', a), [-30, -20, 60, 34], P.white, { k: 0.1 }) + El(16, -6, 12, 8, solid('#FFC83D', 2)) + Pa('M-46 -26q8 -10 0 -20M-34 -28q8 -10 0 -20', `fill="none" ${ol(2.4)} opacity=".5"`),
    makanmalam: () => ICONS.makan() + Pa('M30 -46A16 16 0 1 0 46 -26A12 12 0 1 1 30 -46Z', solid('#FFE08A', 2.4)),
    layangan: () => Pa('M0 -46L30 -4L0 30L-30 -4Z', solid('#E2453C', 3)) + Pa('M0 -46L0 30M-30 -4H30', `fill="none" ${ol(2)}`) + Pa('M0 -46L30 -4L0 -4Z', fill('#FFC83D', 0.9)) + line('M0 30Q10 40 0 48Q-10 56 4 62', 2.6, '#2F80C9'),
    azan: () => Rc(-36, -6, 72, 44, 3, solid('#F3E9D6', 3)) + Pa('M-28 -6A28 26 0 0 1 28 -6Z', solid('#4DAA57', 3)) + line('M0 -32V-44', 3) + Pa('M-8 38V22A8 8 0 0 1 8 22V38Z', fill('#6B4A36')),
    tidur: () => {
      let s = '';
      try { if (hasArt('item')) s = `<g transform="translate(-6 34) scale(.95)">${GS.art.item('bantal')}</g>`; } catch (e) { s = ''; }
      if (!s) s = f3(a => Rc(-40, -10, 80, 40, 18, a), [-40, -10, 80, 40], P.white, {});
      return s + txt(30, -26, 'z', 30, { cls: 't-display', fill: '#2F80C9', decor: true }) + txt(44, -46, 'z', 24, { cls: 't-display', fill: '#2F80C9', decor: true });
    },
    kue: () => f3(a => Rc(-36, -12, 72, 46, 8, a), [-36, -12, 72, 46], P.steel, { k: 0.12 }) + f3(a => Pa('M-40 -12Q0 -40 40 -12Z', a), [-40, -32, 80, 20], P.steel, { hl: false }) + Ci(0, -32, 6, solid('#3A3436', 2)) +
      line('M-18 -44q8 -8 0 -16M2 -48q8 -8 0 -16M22 -44q8 -8 0 -16', 3, '#8C8F94', 0.7),
    bola: () => Ci(0, 0, 38, solid('#FFFFFF', 3)) + Pa('M0 -14L13 -4L8 12H-8L-13 -4Z', fill(INK)) + line('M0 -14V-37M13 -4L35 -11M8 12L22 30M-8 12L-22 30M-13 -4L-35 -11', 2.4),
    sunHigh: () => Rc(-50, 30, 100, 20, 4, fill('#7CC26B')) + line('M0 36V-8', 4) + Rc(2, -8, 18, 12, 0, fill('#E2453C')) + El(4, 37, 10, 3, fill(OUT, 0.4)) + sunDisc(-0, -36, 16, true),
    sunMid: () => Rc(-50, 30, 100, 20, 4, fill('#7CC26B')) + sunDisc(-22, -6, 18, true),
    sunrise: () => Rc(-50, -50, 100, 80, 6, fill('#FFD9A0')) + sunDisc(0, 30, 24, true) + Rc(-50, 30, 100, 20, 4, fill('#7CC26B')),
    moon: () => Rc(-50, -50, 100, 100, 10, fill('#26306A')) + Pa('M-6 -32A26 26 0 1 0 22 10A20 20 0 1 1 -6 -32Z', solid('#FFE08A', 2.4)) + Ci(-30, -30, 3, fill('#FFFFFF')) + Ci(30, -36, 2.4, fill('#FFFFFF')) + Ci(-34, 24, 2, fill('#FFFFFF')),
    longShadow: () => Rc(-50, 18, 100, 30, 4, fill('#E5BE86')) + Pa('M-34 22L40 20L40 26L-34 28Z', fill(OUT, 0.45)) + line('M-34 24V-30', 4) + Rc(-32, -30, 16, 10, 0, fill('#E2453C')) + El(42, 22, 9, 6, solid('#8C8F94', 2)) + sunDisc(-46, -6, 12, true),
    clock: () => miniClock(40, HM(3)),
    tugu: () => Rc(-12, 6, 24, 44, 2, solid('#C68654', 2.6)) + `<g transform="translate(0 -18)">${miniClock(28, HM(10, 10))}</g>`,
    kereta: () => f3(a => Rc(-40, -40, 80, 74, 14, a), [-40, -40, 80, 74], P.red, { k: 0.1 }) + Rc(-30, -30, 60, 26, 5, solid('#CFEFF7', 2.4)) + Ci(-20, 18, 6, solid('#FFE08A', 2)) + Ci(20, 18, 6, solid('#FFE08A', 2)) + line('M-30 40L-40 50M30 40L40 50', 3),
    peta: () => Rc(-50, -36, 100, 72, 8, fill('#3FA7C4')) + El(-28, -4, 18, 8, fill('#4DAA57')) + El(4, 0, 10, 12, fill('#4DAA57')) + El(32, 4, 14, 9, fill('#4DAA57')) + Ci(-28, -4, 4, fill('#E2453C')) + Ci(4, 0, 4, fill('#E2453C')) + Ci(32, 4, 4, fill('#E2453C')),
    sundial: () => ICONS.longShadow(),
    dots: n => { let s = ''; const cols = Math.min(3, n), rows = Math.ceil(n / 3); for (let j = 0; j < n; j++) { const r = Math.floor(j / 3), c = j % 3, inRow = r < rows - 1 ? 3 : n - 3 * (rows - 1); s += Ci((c - (Math.min(cols, inRow) - 1) / 2) * 30, (r - (rows - 1) / 2) * 30, 11, solid('#F28C28', 2.4)); } return s; },
    bangun: () => ICONS.ayam()
  };
  function sunDisc(x, y, r, rays) {
    let s = '';
    if (rays) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += line(`M${n1(x + Math.cos(a) * r * 1.3)} ${n1(y + Math.sin(a) * r * 1.3)}L${n1(x + Math.cos(a) * r * 1.65)} ${n1(y + Math.sin(a) * r * 1.65)}`, 3, '#E09A00'); }
    return s + f3(a => Ci(x, y, r, a), [x - r, y - r, 2 * r, 2 * r], P.yellow, { k: 0.12, sw: 2.4 });
  }
  const icon = (name, arg) => (ICONS[name] ? ICONS[name](arg) : ICONS.clock());

  /* ================= events in the kampung ================= */
  const EV = {
    ayam: { icon: 'ayam', card: 'Ayam berkokok', ok: 'Kukuruyuk! Ayam berkokok. Selamat pagi!' },
    bus: { icon: 'bus', card: 'Bus sekolah', say: 'Bus sekolah datang', ok: 'Tin tin! Bus sekolah datang.', early: 'Busnya belum datang.', late: 'Busnya sudah berangkat.' },
    pos: { icon: 'pos', card: 'Pak Pos', say: 'Pak Pos datang', ok: 'Kring kring! Pak Pos membawa surat.', early: 'Pak Pos belum datang.', late: 'Pak Pos sudah lewat.' },
    warung: { icon: 'warung', card: 'Warung buka', say: 'Warung buka', ok: 'Warungnya buka. Ayo belanja!', early: 'Warungnya masih tutup.', late: 'Warungnya sudah buka dari tadi.' },
    makan: { icon: 'makan', card: 'Makan siang', say: 'Makan siang', ok: 'Waktunya makan siang. Nyam!', early: 'Belum waktunya makan siang.', late: 'Makan siangnya sudah lewat.' },
    layangan: { icon: 'layangan', card: 'Main layangan', say: 'Main layangan', ok: 'Layang-layang terbang tinggi!', early: 'Belum waktunya main.', late: 'Waktu mainnya sudah lewat.' },
    azan: { icon: 'azan', card: 'Azan magrib', say: 'Azan magrib', ok: 'Azan magrib terdengar dari musala. Lampu menyala.', early: 'Belum magrib.', late: 'Magribnya sudah lewat.' },
    makanmalam: { icon: 'makanmalam', card: 'Makan malam', say: 'Makan malam', ok: 'Makan malam bersama keluarga. Nyam!', early: 'Belum waktunya makan malam.', late: 'Makan malamnya sudah lewat.' },
    tidur: { icon: 'tidur', card: 'Waktunya tidur', say: 'Waktunya tidur', ok: 'Selamat tidur! Lampu kamar dimatikan.', early: 'Belum waktunya tidur.', late: 'Wah, sudah terlalu malam.' },
    kue: { icon: 'kue', card: 'Kue matang', say: 'Kue matang', ok: 'Kuenya matang. Harum sekali!', early: 'Kuenya belum matang.', late: 'Kelamaan. Kuenya matang dari tadi.' },
    bola: { icon: 'bola', card: 'Main bola', say: 'Main bola selesai', ok: 'Priit! Main bolanya selesai.', early: 'Main bolanya belum selesai.', late: 'Main bolanya sudah selesai dari tadi.' },
    angkot: { icon: 'angkot', card: 'Angkot', say: 'Angkot datang', ok: 'Angkot datang. Ayo naik!', early: 'Angkotnya belum sampai.', late: 'Angkotnya sudah sampai dari tadi.' },
    kereta: { icon: 'kereta', card: 'Kereta', say: 'Kereta', ok: 'Tut tut! Pas, tepat waktu.', early: 'Belum sampai.', late: 'Kelewatan.' },
    chime: { icon: 'clock', card: '', ok: '' }
  };

  /* ================= stage ================= */
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const el = (tag, attrs, parent) => GS.el(tag, attrs, parent);
  const defs = el('defs', {}, svg);
  defs.innerHTML = '<linearGradient id="jmSky" x1="0" y1="0" x2="0" y2="1"><stop id="jmSkyTop" offset="0" stop-color="#9ED8EC"/><stop id="jmSkyBot" offset="0.75" stop-color="#E6F5F0"/></linearGradient>' +
    `<linearGradient id="jmShFade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0"><stop offset="0" stop-color="${OUT}" stop-opacity=".4"/><stop offset="1" stop-color="${OUT}" stop-opacity="0"/></linearGradient>`;
  const skyTop = defs.querySelector('#jmSkyTop'), skyBot = defs.querySelector('#jmSkyBot'), shFade = defs.querySelector('#jmShFade');
  el('rect', { x: -600, y: 0, width: 2480, height: 800, fill: 'url(#jmSky)' }, svg);
  const starsG = el('g', { class: 'jm-stars', opacity: 0 }, svg);
  (function () {
    const R = rngS(5); let s = '';
    for (let i = 0; i < 70; i++) { const x = -600 + R() * 2480, y = 14 + R() * 500, r = 1.4 + R() * 2.4; s += i % 5 ? Ci(x, y, r, fill('#FFF6D6', 0.6 + R() * 0.4)) : Pa(`M${n1(x)} ${n1(y - r * 2.6)}L${n1(x + r * 0.7)} ${n1(y)}L${n1(x)} ${n1(y + r * 2.6)}L${n1(x - r * 0.7)} ${n1(y)}Z`, fill('#FFF6D6')); }
    starsG.innerHTML = s;
  })();
  const sunG = el('g', {}, svg);
  sunG.innerHTML = Ci(0, 0, 76, fill('#FFF4C8', 0.35)) + `<g class="jm-rays">${[...Array(12)].map((_, i) => { const a = i * 30; return `<path d="M-7 -52L0 -68L7 -52Z" fill="#FFC83D" transform="rotate(${a})"/>`; }).join('')}</g>` + sunDisc(0, 0, 40, false);
  const moonG = el('g', {}, svg);
  moonG.innerHTML = Ci(0, 0, 54, fill('#FFF8DC', 0.18)) + f3(a => Ci(0, 0, 32, a), [-32, -32, 64, 64], ['#F4F1DE', '#FFFFFF', '#CFCAB2'], { k: 0.1, sw: 2.4 }) + Ci(-9, -6, 6, fill('#D9D3BA')) + Ci(10, 9, 4.5, fill('#D9D3BA')) + Ci(8, -12, 3, fill('#D9D3BA'));
  const LS = landscape();
  const dayG = el('g', { class: 'gs-scene jm-day' }, svg);
  GS.markup(dayG, LS.markup);
  const nightG = el('g', { class: 'gs-scene jm-night', opacity: 0 }, svg);
  GS.markup(nightG, LS.markup.replace(/#[0-9A-Fa-f]{6}\b/g, nightCol).replace(/(id="|url\(#)(jm\w+)/g, '$1$2n'));
  const glowG = el('g', { class: 'jm-glows' }, svg);
  const glowEls = LS.glows.map(g => {
    const ge = el('g', { class: 'jm-glow', opacity: 0 }, glowG);
    ge.innerHTML = El(g.x + g.w / 2, g.y + g.h / 2, g.w * 0.7 + 10, g.h * 0.7 + 10, fill('#FFE9A8', 0.28)) + Rc(g.x, g.y, g.w, g.h, 2, fill('#FFD66B'));
    return { el: ge, kind: g.kind };
  });
  const groundFx = el('g', { class: 'jm-groundfx' }, svg);
  const shadowG = el('g', {}, svg);
  const poleSh = el('path', { fill: OUT, opacity: 0.38 }, shadowG);
  const flagSh = el('path', { fill: OUT, opacity: 0.38 }, shadowG);
  const actorsG = el('g', { class: 'jm-actors' }, svg);
  const cloudBank = el('g', { class: 'jm-cloudbank', opacity: 0 }, svg);
  cloudBank.innerHTML = [[-250, 330, 2.6], [40, 250, 3], [330, 220, 3.2], [600, 280, 2.8], [180, 420, 2.6], [480, 430, 2.6], [-80, 470, 2.2], [690, 470, 2.2]]
    .map(c => `<g transform="translate(${c[0]} ${c[1]}) scale(${c[2]})"><path d="M-62 0C-68 -18 -50 -30 -35 -22C-29 -44 6 -50 18 -30C30 -42 56 -36 54 -12C68 -12 70 0 62 0Z" fill="#C9D3DA"/><path d="M-60 0C-59 -6 -53 -7 -44 -7L56 -7C63 -7 66 -3 62 0Z" fill="#AEBAC3"/></g>`).join('');

  const clockG = el('g', { class: 'jm-clock', transform: `translate(${CX} ${CY})` }, svg);
  GS.markup(clockG, clockFace());
  const quartersG = el('g', { opacity: 0 }, clockG);
  quartersG.innerHTML = [0, 90, 180, 270].map((a, i) => { const r = a * Math.PI / 180; return line(`M0 0L${n1(Math.sin(r) * (FR - 30))} ${n1(-Math.cos(r) * (FR - 30))}`, 4, '#2F80C9', 0.55); }).join('') +
    Pa(`M0 0L0 ${-(FR - 30)}A${FR - 30} ${FR - 30} 0 0 1 ${FR - 30} 0Z`, fill('#2F80C9', 0.1)) + Pa(`M0 0L0 ${FR - 30}A${FR - 30} ${FR - 30} 0 0 1 ${-(FR - 30)} 0Z`, fill('#2F80C9', 0.1));
  const wedgeM = el('path', { fill: '#2F80C9', opacity: 0.16 }, clockG);
  const wedgeD = el('path', { fill: '#2F80C9', opacity: 0.12 }, clockG);
  const arcFull = el('circle', { r: ARC_R, fill: 'none', 'stroke-width': 14, opacity: 0.45, display: 'none' }, clockG);
  const arcP = el('path', { fill: 'none', 'stroke-width': 14, 'stroke-linecap': 'round' }, clockG);
  const pinG = el('g', {}, clockG);
  const handsG = el('g', {}, clockG);
  const hands = {};
  ['h', 'm', 's'].forEach(k => { hands[k] = el('g', {}, handsG); hands[k].innerHTML = '<g class="jm-hand-in">' + HAND[k]() + '</g>'; });
  GS.markup(clockG, Ci(0, 0, 17, solid('#D9A441', 3)) + Ci(-4, -4, 4, fill('#FFFFFF', 0.8)));
  const clockHit = el('circle', { r: 254, fill: 'transparent', class: 'jm-clock-hit' }, clockG);

  const worldUI = el('g', { class: 'jm-worldui' }, svg);
  const orderG = el('g', { class: 'jm-order' }, svg);
  const cardG = el('g', { class: 'jm-card', transform: `translate(${CARD.x} ${CARD.y})` }, svg);
  const panelG = el('g', { class: 'jm-panel' }, svg);
  const nudgeG = el('g', { class: 'jm-nudge' }, svg);
  const hitsG = el('g', { class: 'jm-hits' }, svg);
  const fxG = el('g', { class: 'jm-fx' }, svg);
  const sunHit = el('circle', { r: 64, fill: 'transparent', display: 'none' }, hitsG);
  const moonHit = el('circle', { r: 60, fill: 'transparent', display: 'none' }, hitsG);

  /* ================= state ================= */
  let tok = 0, LV = null, RI = 0, RD = null, tries = 0, busy = true, inputOn = false;
  let T = 2 * DAY + HM(6), T0 = T;
  let cloudy = false, sleepAt = HM(21), warungAt = HM(6), glowKey = '';
  let counterEl = null, pipsG = null, zoneUI = null, tuguHands = null;
  let orderS = null, stepS = null, digS = null, angkotActor = null, speedUI = null;
  const live = new Set();       // passing angkots (schedule level)
  async function pause(t) { const my = tok; await GS.wait(ms(t)); return my === tok; }
  function tw(d, fn, ease) { const my = tok; return GS.tween(ms(d), (e, r) => { if (my === tok) fn(e, r); }, ease); }

  /* ================= time and rendering ================= */
  const handAngle = (t, mode) => (mode === 'sec' ? wrap(t, 60) * 6 : mode === 'hour' ? wrap(t, HALF) / 120 : wrap(t, 3600) / 10);
  function setTime(nT) {
    const prev = T;
    T = clamp(nT, T0 - 30 * 3600, T0 + 30 * 3600);
    crossings(prev, T);
    render();
  }
  let lastTick = 0;
  function crossings(a, b) {
    if (a === b || !RD) return;
    const mode = RD.mode || 'min';
    const step = mode === 'sec' ? 5 : mode === 'hour' ? 3600 : 300;
    if (Math.floor(a / step) !== Math.floor(b / step)) { const now = performance.now(); if (now - lastTick > 45) { lastTick = now; GS.sfx.tick(); } }
    if (mode === 'min' && Math.floor(a / 3600) !== Math.floor(b / 3600)) GS.tone({ f: 392, t: 0.45, type: 'sine', vol: 0.07 });
    if (RD.schedule && b > a && Math.floor(b / RD.schedule) > Math.floor(a / RD.schedule)) passAngkot();
  }
  function render() {
    hands.h.setAttribute('transform', 'rotate(' + n1(wrap(T, HALF) / 120) + ')');
    hands.m.setAttribute('transform', 'rotate(' + n1(wrap(T, 3600) / 10) + ')');
    hands.s.setAttribute('transform', 'rotate(' + n1(wrap(T, 60) * 6) + ')');
    renderWorld();
    renderArc();
    renderCounter();
    if (zoneUI) renderZones();
  }
  function renderWorld() {
    const t = tod(T) / 3600;                 // hours since midnight [0, 24)
    const Hd = 15 * (t - 12);                // hour angle of the sun, degrees from noon (-180..180)
    const e = 90 - Math.abs(Hd);             // sun elevation, degrees (negative: below the horizon)
    const sp = skyPos(Hd);
    sunG.setAttribute('transform', `translate(${n1(sp.x)} ${n1(sp.y)})`);
    sunG.setAttribute('display', cloudy ? 'none' : 'inline');
    // Full moon, opposite the sun (a simplification; real moon phases shift its time)
    const Hm = wrapSigned(Hd + 180, 360), mp = skyPos(Hm), em = 90 - Math.abs(Hm);
    moonG.setAttribute('transform', `translate(${n1(mp.x)} ${n1(mp.y)})`);
    const sky = skyAt(e);
    skyTop.setAttribute('stop-color', sky[0]);
    skyBot.setAttribute('stop-color', sky[1]);
    nightG.setAttribute('opacity', clamp((3 - e) / 11, 0, 1).toFixed(3));
    starsG.setAttribute('opacity', clamp((-4 - e) / 6, 0, 1).toFixed(3));
    // lamps are lit while the sun is (almost) down; the bedroom goes dark at bedtime
    // warung shutter: open from its opening time until 21.00
    const open = t * 3600 >= warungAt && t < 21;
    const lamps = e < 2, asleep = t * 3600 >= sleepAt || t < 5;
    const key = (lamps ? 1 : 0) + '' + (asleep ? 1 : 0) + (open ? 1 : 0);
    if (key !== glowKey) { glowKey = key; glowEls.forEach(g => g.el.setAttribute('opacity', lamps && !(g.kind === 'kamar' && asleep) && !(g.kind === 'warung' && !open) ? 1 : 0)); }
    svg.querySelectorAll('.jm-shutter').forEach(s => s.setAttribute('height', open ? 6 : 44));
    // the pole's shadow, L = H / tan(e), pointing away from the sun
    const L = shadowLen(POLE.h, e);
    if (L == null || cloudy || (RD && RD.noPole)) { poleSh.setAttribute('d', ''); flagSh.setAttribute('d', ''); }
    else drawShadow(L, Hd < 0 ? 1 : -1);
    // TK: sun and moon can be dragged along their path too
    const sd = !!(RD && RD.sunDrag && inputOn);
    sunHit.setAttribute('display', sd && e > -2 ? 'inline' : 'none'); sunHit.setAttribute('cx', n1(sp.x)); sunHit.setAttribute('cy', n1(sp.y));
    moonHit.setAttribute('display', sd && em > -2 ? 'inline' : 'none'); moonHit.setAttribute('cx', n1(mp.x)); moonHit.setAttribute('cy', n1(mp.y));
  }
  function drawShadow(L, dir) {
    const x0 = POLE.x, y = POLE.y, capped = L > SHADOW_MAX, Ld = Math.min(L, SHADOW_MAX), x1 = x0 + dir * Ld;
    poleSh.setAttribute('d', `M${x0} ${y - 5}L${n1(x1)} ${y - 3.5}L${n1(x1)} ${y + 3.5}L${x0} ${y + 5}Z`);
    // the flag (heights f0..f1, width fw to the right of the pole) lands at x' + dir * h / tan(e)
    const k = L / POLE.h, a = POLE.fw;
    let fa = x0 + 3 + dir * k * POLE.f0, fb = x0 + 3 + a + dir * k * POLE.f1;
    let lo = Math.min(fa, fb, x0 + 3 + dir * k * POLE.f1, x0 + 3 + a + dir * k * POLE.f0), hi = Math.max(fa, fb, x0 + 3 + dir * k * POLE.f1, x0 + 3 + a + dir * k * POLE.f0);
    lo = Math.max(lo, x0 - SHADOW_MAX); hi = Math.min(hi, x0 + SHADOW_MAX);
    flagSh.setAttribute('d', hi - lo > 1 ? `M${n1(lo)} ${y - 8}L${n1(hi)} ${y - 7}L${n1(hi)} ${y + 7}L${n1(lo)} ${y + 8}Z` : '');
    const f = capped ? 'url(#jmShFade)' : OUT, op = capped ? 1 : 0.38;
    if (capped) { shFade.setAttribute('x1', n1(x0 + dir * (SHADOW_MAX - 150))); shFade.setAttribute('x2', n1(x0 + dir * SHADOW_MAX)); }
    [poleSh, flagSh].forEach(p => { p.setAttribute('fill', f); p.setAttribute('opacity', op); });
  }
  const polar = (r, a) => [n1(r * Math.sin(a * Math.PI / 180)), n1(-r * Math.cos(a * Math.PI / 180))];
  function arcD(r, a0, a1) {
    if (Math.abs(a1 - a0) < 0.3) return '';
    const p0 = polar(r, a0), p1 = polar(r, a1), large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 1 : 0;
    return `M${p0[0]} ${p0[1]}A${r} ${r} 0 ${large} ${sweep} ${p1[0]} ${p1[1]}`;
  }
  const pieD = (r, a0, a1) => { const d = arcD(r, a0, a1); return d ? 'M0 0L' + d.slice(1) + 'Z' : ''; };
  function renderArc() {
    // minute "lewat" wedge (k2 helper): from 12 to the minute hand
    if (RD && RD.wedge) { const a = wrap(T, 3600) / 10; wedgeM.setAttribute('d', a < 0.5 ? '' : a > 359.5 ? `M0 ${-(FR - 30)}A${FR - 30} ${FR - 30} 0 1 1 0.1 ${-(FR - 30)}Z` : pieD(FR - 30, 0, a)); }
    else wedgeM.setAttribute('d', '');
    if (!RD || !RD.arc) { arcP.setAttribute('d', ''); wedgeD.setAttribute('d', ''); arcFull.setAttribute('display', 'none'); return; }
    // duration arc: one lap of the moving hand = 60 minutes (60 seconds for the second hand)
    const unit = RD.mode === 'sec' ? 60 : 3600, d = T - T0, ad = Math.abs(d);
    const laps = Math.floor(ad / unit + 1e-6), part = ad - laps * unit;
    const a0 = handAngle(T0, RD.mode), span = (part / unit) * 360 * (d < 0 ? -1 : 1);
    const col = d < 0 ? '#F28C28' : '#2F80C9';
    arcP.setAttribute('stroke', col); arcFull.setAttribute('stroke', col);
    arcFull.setAttribute('display', laps >= 1 ? 'inline' : 'none');
    arcP.setAttribute('d', arcD(ARC_R, a0, a0 + span));
    wedgeD.setAttribute('fill', col);
    wedgeD.setAttribute('d', laps >= 1 ? `M0 ${-(FR - 30)}A${FR - 30} ${FR - 30} 0 1 1 -0.1 ${-(FR - 30)}Z` : pieD(FR - 30, a0, a0 + span));
  }
  function renderCounter() {
    if (!RD) return;
    if (counterEl && RD.counter === 'live') counterEl.textContent = (T - T0 < 0 ? 'Mundur ' : 'Maju ') + durWords(T - T0, RD.cunit);
    if (counterEl && RD.counter === 'wedge') { const m = Math.round(wrap(T, 3600) / 60) % 60; counterEl.textContent = m === 0 ? 'Tepat' : m <= 30 ? 'Lewat ' + m + ' menit' : 'Kurang ' + (60 - m) + ' menit'; }
    if (pipsG && RD.counter === 'pips') {
      const d = Math.max(0, T - T0), full = Math.floor(d / 3600 + 1e-6), half = d - full * 3600 >= 1799;
      let s = '';
      for (let i = 0; i < Math.min(full, 6); i++) s += Ci(24 + i * 40, 0, 15, solid('#2F80C9', 2.6));
      if (half && full < 6) s += Pa(`M${24 + full * 40} -15A15 15 0 0 1 ${24 + full * 40} 15Z`, fill('#2F80C9')) + Ci(24 + full * 40, 0, 15, `fill="none" ${ol(2.6)}`);
      if (!s) s = Ci(24, 0, 15, `fill="none" stroke="${OUT}" stroke-width="2.6" stroke-dasharray="5 5"`);
      pipsG.innerHTML = s;
    }
  }

  /* ================= input: clock, sun, nudge ================= */
  const angOf = p => Math.atan2(p.x - CX, CY - p.y) * 180 / Math.PI;   // 0 at 12, clockwise
  const unitOf = mode => (mode === 'sec' ? 60 : mode === 'hour' ? HALF : 3600);  // seconds per revolution of the dragged hand
  let lastA = 0, dragging = false;
  GS.drag(clockHit, {
    svg,
    onStart(p) {
      if (!inputOn || !RD || RD.kind !== 'clock' || RD.locked) return false;
      dragging = true; lastA = angOf(p);
      clockG.classList.add('jm-grab'); GS.sfx.pick();
      return true;
    },
    onMove(p) {
      if (!dragging) return;
      const a = angOf(p), r = Math.hypot(p.x - CX, p.y - CY);
      if (r < 30) { lastA = a; return; }     // too close to the centre: the angle is unstable
      let da = a - lastA; while (da > 180) da -= 360; while (da < -180) da += 360;
      lastA = a;
      setTime(T + (da / 360) * unitOf(RD.mode));
    },
    onEnd() { if (!dragging) return; dragging = false; clockG.classList.remove('jm-grab'); snap(); }
  });
  function skyDrag(target, isMoon) {
    GS.drag(target, {
      svg,
      onStart() { if (!inputOn || !RD || !RD.sunDrag) return false; dragging = true; GS.sfx.pick(); return true; },
      onMove(p) {
        if (!dragging) return;
        // inverse of skyPos: hour angle from the finger, then the nearest equivalent time
        let Hd = Math.atan2((p.x - SUNP.cx) / SUNP.rx, (SUNP.cy - p.y) / SUNP.ry) * 180 / Math.PI;
        if (isMoon) Hd -= 180;
        const sec = wrap((12 + Hd / 15) * 3600, DAY);
        setTime(T + wrapSigned(sec - tod(T), DAY));
      },
      onEnd() { if (!dragging) return; dragging = false; snap(); }
    });
  }
  skyDrag(sunHit, false); skyDrag(moonHit, true);
  function snap() {
    if (!RD) return;
    const g = RD.grid || GRID, target = Math.round(T / g) * g, from = T;
    if (Math.abs(target - from) < 0.5) { setTime(target); return; }
    tw(150, e => setTime(from + (target - from) * e), 'outCubic').then(() => { if (RD) setTime(Math.round(T / g) * g); });
  }
  function hitButton(parent, x, y, r, label, onTap, o) {
    o = o || {};
    const g = el('g', { transform: `translate(${x} ${y})` }, parent);
    const inner = el('g', { class: 'jm-press' }, g);
    inner.innerHTML = Ci(0, 4, r, fill(OUT, 0.25)) + f3(a => Ci(0, 0, r, a), [-r, -r, 2 * r, 2 * r], o.col || ['#1F6FD1', '#5B97E0', '#1757A6'], { k: 0.08 }) +
      (o.glyph || txt(0, 14, label, o.size || 40, { fill: '#FFFFFF', w: 600 }));
    const hit = el('circle', { r: Math.max(r, 50), fill: 'transparent', 'data-hit': o.name || 'button' }, g);
    hit.style.cursor = 'pointer';
    hit.addEventListener('pointerdown', e => { e.preventDefault(); inner.classList.add('down'); });
    const up = () => inner.classList.remove('down');
    hit.addEventListener('pointerup', up); hit.addEventListener('pointerleave', up); hit.addEventListener('pointercancel', up);
    hit.addEventListener('click', () => { if (!inputOn) return; GS.sfx.click(); onTap(); });
    return g;
  }
  const GLYPH = {
    minus: Rc(-20, -5, 40, 10, 5, fill('#FFFFFF')),
    plus: Rc(-20, -5, 40, 10, 5, fill('#FFFFFF')) + Rc(-5, -20, 10, 40, 5, fill('#FFFFFF')),
    up: Pa('M-20 10L0 -14L20 10Z', `fill="#FFFFFF" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"`),
    down: Pa('M-20 -10L0 14L20 -10Z', `fill="#FFFFFF" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"`)
  };
  function buildNudges() {
    nudgeG.innerHTML = '';
    if (!RD || RD.kind !== 'clock' || !RD.nudge) return;
    const st = RD.grid;
    const lab = RD.mode === 'sec' ? String(st) : String(st / 60);
    hitButton(nudgeG, 828, 690, 50, '−' + lab, () => { setTime(Math.round(T / st) * st - st); }, { name: 'nudge-minus', col: ['#F28C28', '#F8B26A', '#C76A12'] });
    hitButton(nudgeG, 958, 690, 50, '+' + lab, () => { setTime(Math.round(T / st) * st + st); }, { name: 'nudge-plus' });
  }

  /* ================= card (task) ================= */
  function showCard(c) {
    cardG.innerHTML = ''; counterEl = null; pipsG = null;
    if (!c) { cardG.setAttribute('display', 'none'); return; }
    cardG.setAttribute('display', 'inline');
    // wrap long lines; a card with long text drops its picture to make room
    const wrapAll = maxC => [].concat(...(c.lines || []).map(l => (typeof l === 'string' ? { t: l } : l)).map(l => (l.lcd || l.num ? [l] : wrapWords(l.t, maxC).map(t => Object.assign({}, l, { t })))));
    let lines = wrapAll(c.icon ? 11 : 16);
    if (c.icon && lines.length > 3) { c = Object.assign({}, c, { icon: null }); lines = wrapAll(16); }
    const W = c.w || (lines.length ? CARD.w : 140), tx = c.icon ? 126 : 22;
    let y = 14;
    const items = lines.map(l => {
      const size = l.size || 40, lh = l.lcd ? size * 1.5 : size * 1.2;
      const it = { l, size, y: y + lh * 0.5 + size * 0.35, top: y, lh }; y += lh + 2; return it;
    });
    const h = Math.max(c.icon ? 132 : 0, y + 14), ch = c.counter ? 66 : 0;
    let s = line(`M40 -20V0M${W - 40} -20V0`, 4, '#7E4A27') + Rc(4, 6, W, h + ch, 20, fill(OUT, 0.22)) + Rc(0, 0, W, h + ch, 20, solid('#FFF8EC', 4));
    if (c.icon) s += Rc(12, 12, 104, 108, 16, fill(c.iconBg || '#EAF6F8')) + `<g transform="translate(64 66)">${icon(c.icon, c.dots)}</g>`;
    const avail = W - tx - 16;
    items.forEach(it => {
      if (it.l.lcd) {
        s += Rc(tx - 4, it.top + 4, Math.min(avail + 8, it.size * 0.62 * it.l.t.length + 34), it.lh - 6, 12, solid('#2B2A33', 3)) +
          txt(tx + 14, it.y, it.l.t, it.size, { anchor: 'start', fill: '#FFC83D', w: 600 });
      } else s += txt(c.center ? W / 2 : tx, it.y, it.l.t, it.size, { anchor: c.center ? 'middle' : 'start', cls: it.l.num ? '' : 't-body', w: it.l.num ? 600 : null });
    });
    if (ch) s += line(`M18 ${h}H${W - 18}`, 2.4, '#C9B391', 0.9) + `<g transform="translate(30 ${h + 34})">${miniClock(17, HM(2))}</g>`;
    cardG.innerHTML = s;
    cardG.querySelectorAll('text').forEach(t => { try { const L = t.getComputedTextLength(); if (L > avail + 4 && !t.closest('[data-qc]')) { t.setAttribute('textLength', avail); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } } catch (e) { /* not rendered */ } });
    if (ch) {
      if (c.counter === 'pips') pipsG = el('g', { transform: `translate(64 ${h + 33})` }, cardG);
      else counterEl = GS.el('text', { x: 60, y: h + 46, 'font-size': 40, fill: INK, class: 't-body' }, cardG);
    }
    GS.fx(cardG, 'gs-wobble', 450);
  }
  function setCounterText(s) { if (counterEl) counterEl.textContent = s; }

  /* ================= world UI per level ================= */
  function clearWorldUI() {
    worldUI.innerHTML = ''; groundFx.innerHTML = ''; orderG.innerHTML = ''; panelG.innerHTML = ''; nudgeG.innerHTML = ''; fxG.innerHTML = ''; pinG.innerHTML = '';
    actorsG.innerHTML = ''; live.clear();
    zoneUI = null; tuguHands = null; orderS = null; stepS = null; digS = null; angkotActor = null; speedUI = null;
    quartersG.setAttribute('opacity', 0);
    cloudBank.setAttribute('opacity', 0); cloudy = false;
    svg.querySelectorAll('.jm-pole').forEach(p => p.setAttribute('display', 'inline'));
  }
  function buildTugu(sec) {
    const g = el('g', { transform: 'translate(590 392)' }, worldUI);
    g.innerHTML = shadowE(0, 298, 46) + f3(a => Rc(-26, 96, 52, 202, 6, a), [-26, 96, 52, 202], ['#E8DCC6', '#FBF6EC', '#C9B9A0'], { k: 0.12 }) +
      f3(a => Rc(-46, 282, 92, 18, 5, a), [-46, 282, 92, 18], P.stone, { hl: false, k: 0.2 }) +
      f3(a => Pa('M-70 -104L0 -150L70 -104Z', a), [-70, -150, 140, 46], P.roof, { k: 0.1 }) + miniClock(98, sec, { nums: true, rim: '#E8DCC6' });
  }
  function buildStones(mult) {
    [1, -1].forEach(d => {
      const x = POLE.x + d * POLE.h * mult;
      GS.markup(groundFx, `<g transform="translate(${n1(x)} ${POLE.y + 6})">${shadowE(0, 2, 24)}${f3(a => Pa('M-24 0C-26 -14 -12 -22 0 -22C14 -22 26 -14 24 0Z', a), [-26, -22, 52, 22], P.stone, { k: 0.15 })}</g>`);
    });
  }
  function buildCompass() {
    GS.markup(groundFx, signpost(24, 'Timur') + signpost(708, 'Barat'));
  }
  function signpost(x, word) {
    return `<g transform="translate(${x} 704)">${Rc(-4, -78, 8, 78, 2, solid('#A8673A', 2.4))}${f3(a => Rc(-62, -116, 124, 44, 10, a), [-62, -116, 124, 44], P.cream, { hl: false, k: 0.1 })}${txt(0, -82, word, 34, { cls: 't-body' })}</g>`;
  }
  function markAt(x, col, redraw) {
    if (!redraw && LV) (LV.marks = LV.marks || []).push(x);
    GS.markup(groundFx, `<g transform="translate(${n1(x)} ${POLE.y + 4})">${line('M0 0V-44', 4, '#7E4A27')}${Pa('M2 -44L26 -36L2 -28Z', solid(col || '#2F80C9', 2.4))}${El(0, 2, 10, 3, fill(OUT, 0.3))}</g>`);
  }
  function shadowOutline(sec) {
    const e = elevAt(sec), L = shadowLen(POLE.h, e), dir = shadowDir(sec);
    if (L == null) return;
    const Ld = Math.min(L, SHADOW_MAX), x1 = POLE.x + dir * Ld;
    GS.markup(groundFx, `<path d="M${POLE.x} ${POLE.y - 9}L${n1(x1)} ${POLE.y - 9}L${n1(x1)} ${POLE.y + 9}L${POLE.x} ${POLE.y + 9}Z" fill="#2F80C9" fill-opacity=".18" stroke="#1F6FD1" stroke-width="4" stroke-dasharray="12 8"/>`);
    markAt(x1, '#1F6FD1', true);
  }
  function buildRuler() {
    // tick marks at one and two pole heights on each side: L = H means e = 45 degrees
    let s = '';
    [1, 2].forEach(m => [1, -1].forEach(d => {
      const x = POLE.x + d * POLE.h * m;
      s += line(`M${x} ${POLE.y + 12}V${POLE.y + (m === 1 ? 26 : 62)}`, 4, '#7E4A27') + Rc(x - 62, POLE.y + (m === 1 ? 28 : 64), 124, 44, 12, fill('#FFF8EC', 0.85)) + txt(x, POLE.y + (m === 1 ? 62 : 98), m + ' tiang', 36, { cls: 't-body', fill: '#5C3A1E' });
    }));
    GS.markup(groundFx, s);
  }
  const CITY = ['Jakarta', 'Makassar', 'Jayapura'], ZN = ['WIB', 'WITA', 'WIT'];
  function buildZones(cover) {
    zoneUI = { hands: [], digi: [], cover: null };
    [110, 330, 550].forEach((x, i) => {
      const g = el('g', { transform: `translate(${x} 430)` }, worldUI);
      g.innerHTML = shadowE(0, 262, 30) + Rc(-7, 70, 14, 192, 3, solid('#A8673A', 2.4)) +
        f3(a => Rc(-64, -170, 128, 52, 12, a), [-64, -170, 128, 52], i === 0 ? P.blue : i === 1 ? P.teal : P.orange, { hl: false, k: 0.1 }) +
        txt(0, -131, ZN[i], 38, { cls: 't-display', fill: '#FFFFFF' }) + miniClock(82, null) +
        f3(a => Rc(-74, 98, 148, 50, 12, a), [-74, 98, 148, 50], P.cream, { hl: false, k: 0.1 }) + txt(0, 136, CITY[i], 34, { cls: 't-body' });
      const hg = el('g', {}, g); zoneUI.hands.push(hg);
      if (i === cover) {
        const cv = el('g', {}, g);
        cv.innerHTML = `<g transform="scale(1.9) translate(0 26)"><path d="M-62 0C-68 -18 -50 -30 -35 -22C-29 -44 6 -50 18 -30C30 -42 56 -36 54 -12C68 -12 70 0 62 0Z" fill="#FFFFFF" stroke="${OUT}" stroke-width="1.6"/></g>` + txt(0, 6, '?', 64, { cls: 't-display', fill: '#1F6FD1' });
        zoneUI.cover = cv;
      }
    });
    svg.querySelectorAll('.jm-pole').forEach(p => p.setAttribute('display', 'none'));
    // the tower clock is Jakarta time
    GS.markup(worldUI, `<g transform="translate(${CX} ${CY - BEZ - 6})">${f3(a => Rc(-62, -30, 124, 46, 12, a), [-62, -30, 124, 46], P.blue, { hl: false, k: 0.1 })}${txt(0, 4, 'WIB', 34, { cls: 't-display', fill: '#FFFFFF' })}</g>`);
  }
  function renderZones() {
    zoneUI.hands.forEach((hg, i) => { hg.innerHTML = miniHands(82, T + i * 3600) + Ci(0, 0, 7, solid('#D9A441', 1.6)); });
  }
  const kmX = (k, km) => 70 + k * (640 / km);
  function buildSpeed(km) {
    let s = '';
    for (let k = 0; k <= km; k++) {
      const x = kmX(k, km);
      s += `<g transform="translate(${n1(x)} 712)">${Rc(-4, -46, 8, 46, 2, solid('#FFFFFF', 2.2))}${f3(a => Rc(-30, -98, 60, 54, 10, a), [-30, -98, 60, 54], k === km ? P.orange : P.cream, { hl: false, k: 0.1 })}${txt(0, -57, String(k), 40, { w: 600 })}</g>`;
    }
    s += `<g transform="translate(${n1(kmX(km, km) + 10)} 600)">${f3(a => Rc(-50, -64, 100, 30, 8, a), [-50, -64, 100, 30], P.red, { hl: false, k: 0.1 })}${txt(0, -42, 'PASAR', 22, { cls: 't-display', fill: '#FFFFFF', decor: true })}</g>`;
    GS.markup(groundFx, s);
    angkotActor = el('g', {}, actorsG);
    angkotActor.innerHTML = `<g transform="scale(.8)">${angkotArt()}</g>`;
    placeAngkot(0, km);
    svg.querySelectorAll('.jm-pole').forEach(p => p.setAttribute('display', 'none'));
  }
  function placeAngkot(k, km) { if (angkotActor) angkotActor.setAttribute('transform', `translate(${n1(kmX(k, km) + 60)} 784)`); }
  function startPin() {
    // where the moving hand started: a small flag on the bezel and a faint ghost hand
    const a = handAngle(T0, RD.mode), p = polar(ARC_R, a), g = polar(186, a);
    pinG.innerHTML = line(`M0 0L${g[0]} ${g[1]}`, 6, '#2F80C9', 0.25) + `<g transform="translate(${p[0]} ${p[1]}) rotate(${n1(a)})">${Pa('M0 10L-12 -14H12Z', solid('#FFC83D', 2.6))}</g>`;
  }

  /* ================= levels ================= */
  const DEF_MISS = 'Belum pas. Coba lagi ya!';
  /** A "turn the clock" round. o: start, target (seconds of day), mod (DAY: pagi and malam differ;
   *  HALF: only the dial), card, say, ev, okSay, check(T), miss(T), arc, counter, ... */
  const clockR = o => Object.assign({ kind: 'clock', mode: 'min', grid: GRID, mod: DAY, nudge: TIER === 'k3' || TIER === 'k4' }, o);
  const evLines = (ev, t) => [EV[ev].card, cap(timeWords(t))];
  function setEv(ev, t, back, extra) {
    return clockR(Object.assign({
      start: t - back, target: t, ev, card: { icon: EV[ev].icon, lines: TIER === 'tk' ? [] : evLines(ev, t) },
      say: EV[ev].say + ' ' + timeWords(t) + '. Atur jamnya!'
    }, extra || {}));
  }
  const tk = {
    rooster: start => clockR({
      start: start == null ? HM(3) : start, target: HM(6), sunDrag: true, ev: 'ayam', card: { icon: 'ayam' },
      check: t => tod(t) >= HM(5, 30) && tod(t) <= HM(6),
      say: 'Masih malam. Putar jam sampai ayam berkokok!',
      okSay: 'Kukuruyuk! Matahari terbit. Selamat pagi!',
      miss: t => (elevAt(t) > 0 ? 'Matahari sudah tinggi. Ayamnya sudah berkokok tadi.' : 'Masih gelap. Ayamnya masih tidur. Putar lagi!')
    }),
    noon: start => clockR({
      start: start == null ? HM(8) : start, target: HM(12), sunDrag: true, ev: 'makan', card: { icon: 'sunHigh' },
      say: 'Buat matahari paling tinggi. Bayangan tiang jadi pendek!',
      okSay: 'Matahari paling tinggi. Bayangannya paling pendek!',
      miss: t => (elevAt(t) <= 0 ? 'Wah, malam. Tidak ada matahari, tidak ada bayangan.' : tod(t) < HM(12) ? 'Matahari masih naik. Bayangannya masih panjang.' : 'Matahari sudah turun. Bayangannya memanjang lagi.')
    }),
    night: start => clockR({
      start: start == null ? HM(15) : start, target: HM(20), sunDrag: true, ev: 'tidur', card: { icon: 'moon' }, sleepAt: HM(19),
      check: t => elevAt(t) <= -15,
      say: 'Buat kampung jadi malam. Bulan dan bintang muncul!',
      okSay: 'Malam sudah tiba. Ada bulan dan bintang.',
      miss: t => (elevAt(t) > 0 ? 'Langitnya masih terang. Putar lagi!' : 'Hampir malam. Langitnya belum gelap. Putar lagi!')
    }),
    longShadow: start => clockR({
      start: start == null ? HM(12) : start, target: HM(7), sunDrag: true, stones: 2.5, card: { icon: 'longShadow' },
      // the shadow reaches a stone 2.5 pole heights away when tan(e) <= 1/2.5, i.e. e <= 21.8 deg
      check: t => { const L = shadowLen(POLE.h, elevAt(t)); return L != null && L >= POLE.h * 2.5 - 0.5; },
      say: 'Buat bayangan tiang panjang sampai ke batu!',
      okSay: 'Matahari rendah, bayangannya panjang sekali!',
      miss: t => (elevAt(t) <= 0 ? 'Matahari belum ada. Tidak ada bayangan.' : 'Bayangannya belum sampai batu. Matahari masih tinggi.')
    }),
    hour: (n, start) => clockR({
      mode: 'hour', start: start == null ? HM(12) : start, target: HM(n), mod: HALF, ev: 'chime', chimes: n,
      card: { icon: 'dots', dots: n, lines: [{ t: String(n), size: 84, num: true }], w: 250 },
      say: 'Putar jarum pendek ke angka ' + n + '. Lihat titiknya!',
      okSay: 'Jam ' + n + '! Ayo hitung bunyinya.',
      miss: t => 'Ini angka ' + h12(hmOf(t).h) + '. Cari angka dengan ' + n + ' titik.'
    })
  };
  const TK_ORDER = () => ({
    kind: 'order', mode: 'tk', start: HM(5),
    slots: [{ t: HM(6), icon: 'sunrise' }, { t: HM(7), icon: 'sunMid' }, { t: HM(20), icon: 'moon' }],
    cards: shuffle([{ id: 'bangun', t: HM(6), icon: 'ayam', why: 'Bangun tidur itu pagi, waktu ayam berkokok.' },
      { id: 'sekolah', t: HM(7), icon: 'bus', why: 'Berangkat sekolah itu pagi, sesudah bangun.' },
      { id: 'tidur', t: HM(20), icon: 'tidur', why: 'Tidur itu malam, waktu ada bulan.' }]),
    say: 'Taruh gambar di jalur matahari. Pagi, siang, malam.',
    win: 'Bangun, sekolah, lalu tidur. Urutannya pas!'
  });
  const ACTS = [
    { id: 'bangun', ts: [HM(5, 30), HM(6)], icon: 'ayam' }, { id: 'sekolah', ts: [HM(7)], icon: 'bus' },
    { id: 'istirahat', ts: [HM(9, 30), HM(10)], icon: 'bola' }, { id: 'makan', ts: [HM(12), HM(12, 30)], icon: 'makan' },
    { id: 'layangan', ts: [HM(16), HM(16, 30)], icon: 'layangan' }, { id: 'makanmalam', ts: [HM(19)], icon: 'makanmalam' },
    { id: 'tidur', ts: [HM(20, 30), HM(21)], icon: 'tidur' }
  ];
  function K1_ORDER() {
    const picks = shuffle(ACTS.slice()).slice(0, 4).map(a => ({ id: a.id, icon: a.icon, t: pick(a.ts) }));
    return { kind: 'order', mode: 'k1', start: HM(5), slots: [0, 1, 2, 3].map(() => ({})), cards: shuffle(picks), say: 'Lihat jam di kartu. Urutkan dari pagi sampai malam!', win: 'Urut dari pagi sampai malam. Hebat!' };
  }
  const K1POOL = [['bus', HM(7)], ['pos', HM(7, 30)], ['warung', HM(8)], ['warung', HM(8, 30)], ['makan', HM(12)], ['layangan', HM(15, 30)], ['layangan', HM(16)],
    ['azan', HM(18)], ['makanmalam', HM(18, 30)], ['makanmalam', HM(19)], ['tidur', HM(20)], ['tidur', HM(20, 30)]];
  const evExtra = (ev, t) => (ev === 'warung' ? { warungAt: t } : ev === 'tidur' ? { sleepAt: t } : {});
  const k1Ev = (ev, t, back) => setEv(ev, t, back == null ? 1800 * rand(3, 5) : back, evExtra(ev, t));
  function k1Mix(n, needHalf) {
    let pool = shuffle(K1POOL.slice()), out = [], used = {};
    if (needHalf) { const h = pool.find(p => p[1] % 3600); out.push(h); used[h[0]] = 1; }
    for (const p of pool) { if (out.length >= n) break; if (!used[p[0]]) { out.push(p); used[p[0]] = 1; } }
    return shuffle(out).map(p => k1Ev(p[0], p[1]));
  }
  function matchR(sec, start) {
    return clockR({
      start: start == null ? HM(12) : start, target: sec, mod: HALF, tugu: sec, card: { icon: 'tugu', lines: ['Samakan dengan', 'jam tugu'] },
      say: 'Lihat jam tugu. Samakan jam menara dengan jam tugu!', okSay: 'Sama! Sekarang ' + timeWords(sec) + '.'
    });
  }
  function afterR(start, d, ev, lines, say, extra) {
    return clockR(Object.assign({
      start, target: wrap(start + d, DAY), ev, arc: true, card: { icon: EV[ev].icon, lines, counter: TIER === 'k1' ? 'pips' : null }, counter: TIER === 'k1' ? 'pips' : null, pin: true, say
    }, extra || {}));
  }
  const quarterR = (h, late) => {
    const t = late ? HM(h, 45) : HM(h, 15), w = timeWords(t);
    return clockR({ start: HM(h), target: t, mod: HALF, quarters: true, card: { icon: 'clock', lines: wrapWords(cap(w), 13) }, say: 'Atur ' + w + '.', okSay: cap(w) + '. Seperempat putaran!' });
  };
  const fiveR = (h, m) => {
    const t = HM(h, m), w = timeWords(t);
    return clockR({ start: HM(h), target: t, mod: HALF, wedge: true, counter: 'wedge', card: { icon: 'clock', lines: wrapWords(cap(w), 13), counter: true }, say: 'Atur ' + w + '. Hitung lima, lima!', okSay: 'Pas! ' + cap(w) + '.' });
  };
  const digCardR = (t, h24, ev) => clockR({
    start: hmOf(t).h % 12 === 0 ? HM(3) : HM(12), target: t, mod: h24 ? DAY : HALF, ev: ev || null,
    card: { icon: ev ? EV[ev].icon : 'clock', lines: [{ t: h24 ? digital(t) : digital12(t), lcd: true, size: 56, num: true }].concat(h24 ? [{ t: 'format 24 jam', size: 36 }] : []) },
    say: (h24 ? 'Jam ' + digital(t) + '. Atur jam menaranya!' : 'Jam digital ' + digital12(t) + '. Atur jam menaranya!'),
    okSay: (h24 ? digital(t) : digital12(t)) + ' artinya ' + timeWords(t, h24) + '.'
  });
  const digSetR = t => ({ kind: 'digital', start: t, card: { icon: 'clock', lines: ['Jam digital mati.', 'Samakan dengan', 'jam menara!'] }, say: 'Jam digitalnya mati. Samakan dengan jam menara!' });
  const howR = (start, end, unit, ev, lines, say, msgs) => { msgs = msgs || {}; return { kind: 'howlong', start, answer: end - start, unit, ev, card: { icon: msgs.icon || (ev ? EV[ev].icon : 'clock'), lines }, say, msgs }; };
  const ampmR = (target, ev) => clockR({
    start: HM(12), target, mod: DAY, ev, card: { icon: EV[ev].icon, lines: [EV[ev].card, cap(timeWords(target, true))] }, sleepAt: ev === 'tidur' ? target : HM(21),
    say: EV[ev].say + ' ' + timeWords(target, true) + '. Atur jamnya!'
  });
  const schedR = (start, every) => {
    const target = Math.ceil((start + 1) / every) * every;
    return clockR({ start, target, schedule: every, ev: 'angkot', card: { icon: 'angkot', lines: ['Angkot datang', 'tiap ' + every / 60 + ' menit', { t: 'Sekarang ' + digital(start), size: 36 }] },
      say: 'Angkot datang tiap ' + every / 60 + ' menit. Kapan angkot berikutnya?',
      okSay: 'Angkot berikutnya jam ' + digital(target) + '. Pas!',
      miss: t => (tod(t) < target ? 'Jam ' + digital(t) + '. Belum ada angkot.' : tod(t) < target + 60 * 30 && tod(t) > target ? 'Angkotnya sudah lewat. Kamu menunggu kelamaan.' : 'Hmm, itu bukan angkot berikutnya.') });
  };
  const backR = (end, d, ev, lines, say) => clockR({ start: end, target: wrap(end - d, DAY), ev, arc: true, pin: true, counter: 'after', cunit: 'm', card: { icon: EV[ev].icon, lines, counter: true }, say });
  const secR = d => clockR({
    mode: 'sec', grid: 5, start: HM(7, 10), target: HM(7, 10) + d, arc: true, pin: true, counter: 'after', cunit: 's', nudge: true,
    card: { icon: 'clock', lines: d === 60 ? ['1 menit = 60 detik', 'Putar jarum detik', 'satu putaran'] : [d + ' detik', 'Putar jarum detik'], counter: true },
    say: d === 60 ? 'Satu menit sama dengan 60 detik. Putar jarum merah satu putaran!' : 'Lompat tali ' + d + ' detik. Putar jarum detiknya!',
    okSay: d + ' detik sama dengan ' + (d % 60 ? Math.floor(d / 60) + ' menit ' + (d % 60) + ' detik' : d / 60 + ' menit') + '!'
  });
  const trainFwd = (dep, dur) => clockR({ start: dep, target: wrap(dep + dur, DAY), ev: 'kereta', arc: true, pin: true, counter: 'after', cunit: 'hm',
    card: { icon: 'kereta', lines: ['Berangkat ' + digital(dep), 'Lama ' + durWords(dur), 'Tiba jam?'], counter: true },
    say: 'Kereta berangkat ' + digital(dep) + ', perjalanan ' + durWords(dur) + '. Tiba jam berapa?' });
  const trainBack = (arr, dur) => clockR({ start: arr, target: wrap(arr - dur, DAY), ev: 'kereta', arc: true, pin: true, counter: 'after', cunit: 'hm',
    card: { icon: 'kereta', lines: ['Tiba ' + digital(arr), 'Lama ' + durWords(dur), 'Berangkat jam?'], counter: true },
    say: 'Kereta tiba ' + digital(arr) + ' sesudah ' + durWords(dur) + '. Berangkat jam berapa?' });
  const convR = (start, dur, shownAs) => clockR({ start, target: wrap(start + dur, DAY), ev: 'kue', arc: true, pin: true, counter: 'live', cunit: shownAs === 'm' ? 'hm' : 'm',
    card: { icon: 'kue', lines: ['Mulai ' + digital(start), 'Lama ' + durWords(dur, shownAs === 'm' ? 'm' : 'hm')], counter: true },
    say: 'Kue mulai dikukus ' + digital(start) + '. Lamanya ' + durWords(dur, shownAs === 'm' ? 'm' : 'hm') + '. Kapan matang?' });
  const zoneR = (zi, local) => clockR({
    start: HM(7), target: wrap(local - zi * 3600, DAY), zones: zi, noPole: true,
    card: { icon: 'peta', lines: ['Di ' + CITY[zi], digital(local) + ' ' + ZN[zi], 'Jakarta jam?'] },
    say: 'Di ' + CITY[zi] + ' jam ' + digital(local) + ' ' + ZN[zi] + '. Atur jam Jakarta!',
    okSay: 'Pas! Jakarta ' + digital(local - zi * 3600) + ', ' + CITY[zi] + ' ' + digital(local) + '.'
  });
  const speedR = (per, km, start) => clockR({
    start, target: wrap(start + per * km * 60, DAY), speed: { per: per * 60, km }, noPole: true, go: 'Jalan!',
    card: { icon: 'angkot', lines: ['1 km: ' + per + ' menit', 'Pasar: ' + km + ' km', 'Berangkat ' + digital(start)] },
    say: 'Angkot berangkat ' + digital(start) + '. Satu km ' + per + ' menit. Kapan sampai pasar?',
    okSay: 'Sampai di pasar tepat ' + digital(start + per * km * 60) + '!'
  });
  const sunR = sec => clockR({
    start: HM(12), target: sec, grid: 300, sundial: sec, compass: true,
    // generous zone: within 15 minutes and on the same side of noon counts as reading the shadow
    check: t => Math.abs(wrapSigned(tod(t) - sec, DAY)) <= 900,
    card: { icon: 'sundial', lines: ['Langit mendung.', 'Lihat garis biru.', 'Jam berapa?'] },
    say: 'Tadi bayangan tiang ada di garis biru. Jam berapa itu?',
    okSay: 'Bayangannya pas di garis. Itu ' + timeWords(sec, true) + '!'
  });
  function wrapWords(s, maxChars) {
    const words = s.split(' '), out = []; let cur = '';
    words.forEach(w => { if ((cur + ' ' + w).trim().length > maxChars && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) out.push(cur);
    return out;
  }
  const predictR = () => ({ kind: 'predict', say: 'Tebak dulu! Jam 12 nanti, bayangannya lebih panjang atau lebih pendek?', correct: 'pendek' });
  const hours = (n, lo, hi) => shuffle([...Array(hi - lo + 1)].map((_, i) => lo + i)).slice(0, n);

  const TIERS = {
    tk: [
      () => ({ rounds: [tk.rooster()] }),
      () => ({ rounds: [tk.noon()] }),
      () => ({ rounds: [TK_ORDER()] }),
      () => { const [a, b] = hours(2, 1, 6); return { rounds: [tk.hour(a), tk.hour(b)], win: 'Jarum pendek menunjuk angkanya. Hebat!' }; },
      () => ({ rounds: [tk.longShadow()] }),
      () => ({ rounds: shuffle([tk.rooster(HM(2)), tk.noon(HM(9)), tk.night(HM(16)), tk.longShadow(HM(12))]).slice(0, 2), win: 'Kamu bisa mengatur pagi, siang, dan malam!' })
    ],
    k1: [
      () => { const p = pick([['makan', HM(12)], ['layangan', HM(16)], ['tidur', HM(20)]]); return { rounds: [k1Ev('bus', HM(7), HM(2)), k1Ev(p[0], p[1], HM(2))] }; },
      () => { const [a, b] = hours(2, 1, 11); return { rounds: [matchR(HM(a)), matchR(HM(b))], win: 'Jam menara sama dengan jam tugu!' }; },
      () => { const h = pick([9, 10]); return { rounds: [k1Ev('pos', HM(7, 30), HM(1, 30)), k1Ev('warung', HM(h, 30), HM(2))], win: 'Setengah jam: jarum panjang di angka 6!' }; },
      () => {
        const h = pick([8, 9, 10]), h2 = pick([15, 16]);
        return { rounds: [afterR(HM(h), 3600, 'kue', ['Mulai ' + timeWords(HM(h)), '1 jam lagi'], 'Kue dikukus ' + timeWords(HM(h)) + '. Matang 1 jam lagi!'),
          afterR(HM(h2, 30), 3600, 'bola', ['Mulai ' + timeWords(HM(h2, 30)), '1 jam lagi'], 'Main bola ' + timeWords(HM(h2, 30)) + '. Selesai 1 jam lagi!')], win: 'Satu jam: jarum panjang berputar satu kali!' };
      },
      () => ({ rounds: [K1_ORDER()] }),
      () => ({ rounds: [clockR({ start: HM(7), target: HM(9), markShadow: true, card: { icon: 'longShadow', lines: ['Jam 9 pagi.', 'Lihat bayangan.'] }, say: 'Atur jam 9 pagi. Lihat bayangan tiangnya!', okSay: 'Jam 9 pagi. Bayangannya sampai di bendera biru.' }),
        predictR(), clockR({ start: HM(9), target: HM(12), ev: 'makan', card: { icon: 'sunHigh', lines: ['Jam 12 siang.', 'Bayangannya?'] }, say: 'Sekarang atur jam 12 siang. Lihat bayangannya!', okSay: 'Jam 12 siang. Matahari paling tinggi, bayangan paling pendek!' })], win: 'Siang hari bayangannya paling pendek!' }),
      () => ({ rounds: k1Mix(3, true) }),
      () => { const h = rand(1, 11), h2 = pick([8, 9, 10]); return { rounds: [matchR(HM(h, 30)), afterR(HM(h2, 30), 3600, 'kue', ['Mulai ' + timeWords(HM(h2, 30)), '1 jam lagi'], 'Kue dikukus ' + timeWords(HM(h2, 30)) + '. Matang 1 jam lagi!'), k1Mix(1, true)[0]], win: 'Tantangan selesai. Kamu pintar membaca jam!' }; }
    ],
    k2: [
      () => { const [a, b] = hours(2, 1, 11); return { rounds: [quarterR(a, false), quarterR(b, true)], win: 'Seperempat jam sama dengan 15 menit!' }; },
      () => { const [a, b] = hours(2, 1, 11); return { rounds: [fiveR(a, 5 * rand(1, 5)), fiveR(b, 5 * rand(7, 11))], win: 'Menghitung lima, lima. Hebat!' }; },
      () => { const t1 = HM(rand(1, 11), 5 * rand(1, 11)), t2 = HM(rand(1, 11), 5 * rand(1, 11)); return { rounds: [digCardR(t1), digSetR(t2)], win: 'Jam digital dan jam dinding sama!' }; },
      () => {
        const s2 = pick([6, 13]), d2 = rand(3, 5);
        return { rounds: [howR(HM(7), HM(12), 'h', 'bus', ['Berangkat jam 7', 'Pulang jam 12'], 'Siti berangkat sekolah jam 7, pulang jam 12. Berapa jam?', { short: 'Siti masih di sekolah.', long: 'Siti sudah pulang dari tadi.' }),
          howR(HM(s2), HM(s2 + d2), 'h', null, ['Buka jam ' + h12(s2), 'Tutup jam ' + h12(s2 + d2)], 'Pasar buka jam ' + h12(s2) + ', tutup jam ' + h12(s2 + d2) + '. Berapa jam?', { short: 'Pasarnya masih buka.', long: 'Pasarnya sudah tutup dari tadi.', icon: 'warung', ok: 'Pasarnya tutup. Saatnya pulang.' })], win: 'Menghitung lama waktu dalam jam. Pintar!' };
      },
      () => {
        const s1 = HM(pick([9, 10]), 5 * rand(1, 4)), d1 = 60 * pick([15, 20, 25]), s2 = HM(pick([8, 10, 14]), 5 * rand(8, 10)), d2 = 60 * pick([20, 25, 30]);
        return { rounds: [afterR(s1, d1, 'kue', ['Mulai ' + digital(s1), d1 / 60 + ' menit lagi'], 'Kue dikukus jam ' + digital(s1) + '. Matang ' + d1 / 60 + ' menit lagi!', { counter: 'live', cunit: 'm', card: { icon: 'kue', lines: ['Mulai ' + digital(s1), d1 / 60 + ' menit lagi'], counter: true } }),
          afterR(s2, d2, 'bola', ['Mulai ' + digital(s2), d2 / 60 + ' menit lagi'], 'Main bola mulai ' + digital(s2) + '. Selesai ' + d2 / 60 + ' menit lagi!', { counter: 'live', cunit: 'm', card: { icon: 'bola', lines: ['Mulai ' + digital(s2), d2 / 60 + ' menit lagi'], counter: true } })], win: 'Menit demi menit, tepat waktu!' };
      },
      () => ({ rounds: shuffle([ampmR(HM(19), 'makanmalam'), ampmR(HM(pick([7, 8])), pick(['bus', 'warung']))]), win: 'Jam 7 pagi terang, jam 7 malam gelap!' }),
      () => { const [a, b, c] = hours(3, 1, 11); return { rounds: shuffle([quarterR(a, Math.random() < 0.5), fiveR(b, 5 * pick([1, 2, 4, 5, 7, 8, 10, 11])), digCardR(HM(c, 5 * rand(1, 11)))]) }; },
      () => { const s = HM(pick([8, 9, 10]), 5 * rand(9, 10)), d = 60 * pick([20, 25]); return { rounds: [digSetR(HM(rand(1, 11), 5 * rand(1, 11))), afterR(s, d, 'kue', ['Mulai ' + digital(s), d / 60 + ' menit lagi'], 'Kue dikukus ' + digital(s) + '. Matang ' + d / 60 + ' menit lagi!', { counter: 'live', cunit: 'm', card: { icon: 'kue', lines: ['Mulai ' + digital(s), d / 60 + ' menit lagi'], counter: true } }), ampmR(HM(20), 'tidur')], win: 'Tantangan selesai. Kamu jago jam!' }; }
    ],
    k3: [
      () => { const t1 = HM(8, pick([47, 43, 52, 38])), t2 = HM(rand(1, 11), pick([12, 23, 34, 41, 56])); return { rounds: [digCardR(t1), digCardR(t2)], win: 'Tepat sampai menitnya!' }; },
      () => ({ rounds: [digCardR(HM(19, 30), true, 'makanmalam'), digCardR(HM(pick([15, 16]), pick([15, 45, 20])), true, 'layangan')], win: 'Jam 13 sampai 24 itu siang, sore, dan malam!' }),
      () => ({ rounds: [howR(HM(8, 40), HM(9, 15), 'm', 'angkot', ['Berangkat 08.40', 'Tiba 09.15'], 'Angkot berangkat 08.40, tiba 09.15. Berapa menit?', { short: 'Angkotnya belum sampai.', long: 'Angkotnya sudah sampai dari tadi.' }),
        (() => { const s = HM(pick([10, 13]), 50), d = 60 * pick([25, 35, 40]); return howR(s, s + d, 'm', 'kue', ['Mulai ' + digital(s), 'Matang ' + digital(s + d)], 'Kue dikukus ' + digital(s) + ', matang ' + digital(s + d) + '. Berapa menit?', { short: 'Kuenya belum matang.', long: 'Kuenya sudah matang dari tadi.' }); })()], win: 'Menghitung menit melewati jam. Hebat!' }),
      () => ({ rounds: [schedR(HM(7, 20), 900), schedR(HM(pick([9, 10]), pick([50, 35])), 900)], win: 'Angkot tiap 15 menit. Tidak perlu menunggu lama!' }),
      () => ({ rounds: [backR(HM(11, 20), 45 * 60, 'bola', ['Selesai 11.20', 'Lama 45 menit', 'Mulai jam?'], 'Main bola selesai 11.20, lamanya 45 menit. Mulai jam berapa?'),
        backR(HM(14, 10), 50 * 60, 'kue', ['Matang 14.10', 'Lama 50 menit', 'Mulai jam?'], 'Kue matang 14.10 sesudah 50 menit. Mulai jam berapa?')], win: 'Menghitung mundur waktu. Pintar!' }),
      () => ({ rounds: [secR(60), secR(90)], win: 'Satu menit sama dengan 60 detik!' }),
      () => ({ rounds: shuffle([digCardR(HM(rand(1, 11), pick([7, 18, 29, 44, 53]))), digCardR(HM(pick([17, 20, 21]), pick([10, 25, 40])), true, 'tidur'), schedR(HM(pick([7, 8]), pick([5, 40])), 900)]) }),
      () => ({ rounds: [backR(HM(10, 5), 40 * 60, 'kue', ['Matang 10.05', 'Lama 40 menit', 'Mulai jam?'], 'Kue matang 10.05 sesudah 40 menit. Mulai jam berapa?'),
        howR(HM(13, 45), HM(14, 30), 'm', 'angkot', ['Berangkat 13.45', 'Tiba 14.30'], 'Angkot berangkat 13.45, tiba 14.30. Berapa menit?', { short: 'Angkotnya belum sampai.', long: 'Angkotnya sudah sampai dari tadi.' }),
        digCardR(HM(18, pick([35, 50])), true, 'azan')], win: 'Tantangan selesai. Kamu ahli waktu!' })
    ],
    k4: [
      () => ({ rounds: [howR(HM(6, 45), HM(10, 10), 'hm', 'bus', ['Berangkat 06.45', 'Tiba 10.10'], 'Bus berangkat 06.45, tiba 10.10. Berapa lama?', { short: 'Busnya belum sampai.', long: 'Busnya sudah sampai dari tadi.' }),
        howR(HM(13, 20), HM(15, 5), 'hm', 'kereta', ['Berangkat 13.20', 'Tiba 15.05'], 'Kereta berangkat 13.20, tiba 15.05. Berapa lama?', { short: 'Keretanya belum sampai.', long: 'Keretanya sudah sampai dari tadi.' })], win: 'Jam dan menit dihitung sekaligus. Hebat!' }),
      () => ({ rounds: [convR(HM(8), 135 * 60, 'm'), convR(HM(13), 100 * 60, 'hm')], win: '2 jam 15 menit sama dengan 135 menit!' }),
      () => ({ rounds: [trainFwd(HM(9, 50), HM(1, 25)), trainBack(HM(14, 5), HM(2, 10))], win: 'Jadwal kereta terbaca semua!' }),
      () => ({ rounds: [zoneR(2, HM(12)), zoneR(1, HM(8, 30))], win: 'WIB, WITA, WIT: selisihnya satu jam!' }),
      () => ({ rounds: [speedR(3, 6, HM(8)), speedR(4, 5, HM(13, 10))], win: 'Jarak dan waktu. Angkot tepat sampai!' }),
      () => { const [a, b] = shuffle([HM(8), HM(9), HM(10)]).slice(0, 1).concat(shuffle([HM(14), HM(15), HM(16)]).slice(0, 1)); return { rounds: shuffle([sunR(a), sunR(b)]), win: 'Kamu bisa membaca jam matahari!' }; },
      () => ({ rounds: shuffle([zoneR(pick([1, 2]), HM(pick([9, 10, 14]), 30)), convR(HM(pick([7, 9])), 60 * pick([95, 125, 150]), 'm'), trainFwd(HM(10, 35), HM(1, 50))]) }),
      () => ({ rounds: [sunR(pick([HM(8), HM(16)])), speedR(5, 4, HM(15, 15)), howR(HM(7, 55), HM(11, 20), 'hm', 'kereta', ['Berangkat 07.55', 'Tiba 11.20'], 'Kereta berangkat 07.55, tiba 11.20. Berapa lama?', { short: 'Keretanya belum sampai.', long: 'Keretanya sudah sampai dari tadi.' })], win: 'Tantangan selesai. Kamu juara waktu!' })
    ]
  };
  const LEVELS = TIERS[TIER] || TIERS.k1;
  const hud = GS.hud({ gameId: GAME, title: 'Jam Kampung', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: i => buildLevel(i) });

  /* ================= level flow ================= */
  function buildLevel(i) {
    tok++;
    document.querySelectorAll('.gs-overlay.gs-win').forEach(o => o.remove());
    LV = LEVELS[i]();
    tries = 0;
    startRound(0);
  }
  function startRound(ri) {
    tok++;
    RI = ri; RD = LV.rounds[ri];
    clearWorldUI();
    busy = false; inputOn = true;
    T0 = 2 * DAY + (RD.start != null ? RD.start : tod(T)); T = T0;
    sleepAt = RD.sleepAt != null ? RD.sleepAt : HM(21);
    warungAt = RD.warungAt != null ? RD.warungAt : HM(6);
    hands.m.setAttribute('display', RD.kind === 'clock' && RD.mode === 'hour' ? 'none' : 'inline');
    hands.s.setAttribute('display', RD.mode === 'sec' ? 'inline' : 'none');
    if (RD.tugu != null) buildTugu(RD.tugu);
    if (RD.stones) buildStones(RD.stones);
    if (RD.quarters) quartersG.setAttribute('opacity', 1);
    if (RD.zones != null) buildZones(RD.zones);
    if (RD.speed) buildSpeed(RD.speed.km);
    if (RD.sundial != null) { cloudy = true; cloudBank.setAttribute('opacity', 1); buildRuler(); shadowOutline(RD.sundial); }
    if (RD.compass || RD.markShadow || RD.stones) buildCompass();
    (LV.marks || []).forEach(x => markAt(x, '#2F80C9', true));
    if (RD.pin) startPin();
    showCard(RD.card || null);
    if (RD.kind === 'order') buildOrder(RD);
    if (RD.kind === 'howlong') buildHowlong(RD);
    if (RD.kind === 'digital') buildDigital(RD);
    if (RD.kind === 'predict') buildPredict(RD);
    if (RD.kind === 'clock') buildNudges();
    setDock();
    render();
    hud.mood('think');
    GS.say(RD.say);
  }
  function setDock() {
    dock.innerHTML = '';
    if (!RD || RD.kind === 'predict') return;
    const label = RD.kind === 'howlong' || RD.go ? (RD.go || 'Jalan!') : 'Cek!';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gs-action';
    b.innerHTML = (label === 'Cek!' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : GS.ICON.play) + '<span></span>';
    b.querySelector('span').textContent = label;
    b.addEventListener('click', () => { if (b.disabled) return; GS.sfx.click(); onGo(); });
    dock.appendChild(b);
    updateDock();
  }
  function updateDock() {
    const b = dock.querySelector('.gs-action');
    if (!b) return;
    b.disabled = busy || !inputOn || (RD.kind === 'order' && !orderS.slots.every(s => s.card));
  }
  async function onGo() {
    if (busy || !inputOn || !RD) return;
    busy = true; inputOn = false; updateDock(); render();
    const my = tok;
    if (dragging) dragging = false;
    if (RD.kind === 'clock') { setTime(Math.round(T / RD.grid) * RD.grid); await commitClock(my); }
    else if (RD.kind === 'order') await commitOrder(my);
    else if (RD.kind === 'howlong') await commitHowlong(my);
    else if (RD.kind === 'digital') await commitDigital(my);
  }
  function defaultOk(r) {
    if (r.ev && EV[r.ev] && EV[r.ev].ok) return cap(timeWords(T, r.mod === DAY)) + '. ' + EV[r.ev].ok;
    return 'Pas! ' + cap(timeWords(T)) + '.';
  }
  function checkClock(r, t) {
    if (r.check) return r.check(t);
    return wrap(tod(t) - r.target, r.mod) === 0;
  }
  async function commitClock(my) {
    const r = RD;
    let ok;
    if (r.speed) { ok = await runSpeed(my); if (my !== tok) return; }
    else ok = checkClock(r, T);
    if (r.sundial != null) {
      cloudy = false;
      await tw(500, e => cloudBank.setAttribute('opacity', (1 - e).toFixed(2)));
      render();
      if (!(await pause(500))) return;
    }
    if (r.zones != null && zoneUI && zoneUI.cover) { zoneUI.cover.setAttribute('display', 'none'); GS.sfx.pop(); if (!(await pause(500))) return; }
    if (r.counter === 'after') setCounterText((T - T0 < 0 ? 'Mundur ' : 'Maju ') + durWords(T - T0, r.cunit));
    if (ok) {
      await success(r, my, r.okSay ? (typeof r.okSay === 'function' ? r.okSay(T) : r.okSay) : defaultOk(r));
      return;
    }
    await miss(my, r.miss ? r.miss(T) : missText(r, T));
    if (my !== tok) return;
    if (r.sundial != null) { await tw(500, e => cloudBank.setAttribute('opacity', e.toFixed(2))); cloudy = true; render(); }
    if (r.zones != null && zoneUI && zoneUI.cover) zoneUI.cover.setAttribute('display', 'inline');
    if (r.speed) placeAngkot(0, r.speed.km);
  }
  function missText(r, t) {
    const ev = r.ev ? EV[r.ev] : null, words = timeWords(t, r.mod === DAY);
    if (r.sundial != null) {
      const e = elevAt(t), Lm = shadowLen(POLE.h, e), Lt = shadowLen(POLE.h, elevAt(r.sundial));
      if (Lm == null) return 'Itu malam. Tidak ada bayangan. Coba lagi!';
      if (shadowDir(t) !== shadowDir(r.sundial)) return 'Arah bayangannya terbalik. Pagi ke barat, sore ke timur.';
      return Lm > Lt ? 'Bayanganmu lebih panjang. Matahari masih terlalu rendah.' : 'Bayanganmu lebih pendek. Matahari terlalu tinggi.';
    }
    if (r.speed) {
      const d = T - T0, arrive = r.speed.per * r.speed.km;
      if (d < arrive) return 'Jam ' + digital(t) + ', angkot baru sampai km ' + Math.max(0, Math.floor(d / r.speed.per)) + '. Belum sampai pasar.';
      return 'Angkotnya sudah sampai dari tadi. Waktunya kelamaan.';
    }
    if (r.zones != null) {
      const loc = t + r.zones * 3600;
      return 'Jakarta ' + digital(t) + ', ' + CITY[r.zones] + ' ' + digital(loc) + '. Belum pas. Coba lagi!';
    }
    if (r.mod === HALF) {
      const a = hmOf(t), b = hmOf(r.target);
      if (r.mode === 'hour') return 'Ini angka ' + h12(a.h) + '. Coba lagi!';
      if (a.m !== b.m) return 'Jammu ' + words + '. Lihat lagi jarum panjangnya.';
      return 'Jammu ' + words + '. Jarum panjang sudah pas. Lihat jarum pendek.';
    }
    const diff = wrapSigned(tod(t) - r.target, DAY);
    if (Math.abs(diff) > 60 && Math.abs(wrapSigned(diff, HALF)) < 1) {
      const dark = elevAt(t) < 0;
      return cap(words) + '. Langitnya ' + (dark ? 'gelap' : 'terang') + '. Kita perlu ' + timeWords(r.target, true) + '.';
    }
    if (r.mode === 'sec') return diff < 0 ? 'Belum sampai. Putar jarum detik maju sedikit.' : 'Kelewatan. Putar jarum detik mundur sedikit.';
    if (r.arc) return (diff < 0 ? (ev && ev.early ? ev.early + ' ' : '') + 'Putar maju sedikit lagi.' : (ev && ev.late ? ev.late + ' ' : '') + 'Putar mundur sedikit.');
    return 'Jammu ' + words + '. ' + (diff < 0 ? (ev && ev.early ? ev.early : 'Belum waktunya.') + ' Putar maju.' : (ev && ev.late ? ev.late : 'Sudah lewat.') + ' Putar mundur.');
  }
  let lastOk = '';
  async function success(r, my, text) {
    lastOk = text;
    hud.mood('cheer');
    GS.sfx.coin();
    sparkle(CX, CY - 40);
    GS.say(text);
    if (r.markShadow) { const L = shadowLen(POLE.h, elevAt(T)); if (L != null) markAt(POLE.x + shadowDir(T) * Math.min(L, SHADOW_MAX)); }
    if (r.ev) await playEvent(r.ev, my, r);
    if (my !== tok) return;
    if (!(await pause(r.ev ? 700 : 1300))) return;
    nextRound();
  }
  async function miss(my, text, keepLocked) {
    tries++;
    hud.mood('oops');
    GS.sfx.oops();
    GS.fx(clockG, 'gs-shake', 200);
    GS.say(text || DEF_MISS);
    if (!(await pause(keepLocked ? 1600 : 650))) return;
    if (keepLocked) return;
    busy = false; inputOn = true; hud.mood('think'); updateDock(); render();
  }
  function nextRound() {
    if (RI + 1 < LV.rounds.length) { startRound(RI + 1); return; }
    const stars = tries === 0 ? 3 : tries <= 2 ? 2 : 1;
    busy = true; inputOn = false; updateDock();
    run.win(stars, LV.win || lastOk || 'Hebat! Jamnya pas.');
  }

  /* ================= speed: the angkot drives at the stated speed ================= */
  async function runSpeed(my) {
    const r = RD, Tset = T, d = Tset - T0, arrive = r.speed.per * r.speed.km;
    setTime(T0); placeAngkot(0, r.speed.km);
    GS.tone({ f: 523, t: 0.12, type: 'square', vol: 0.05 });
    if (d > 0) await tw(Math.max(1200, Math.min(3200, d / 60 * 90)), e => { const el = d * e; T = T0 + el; render(); placeAngkot(Math.min(r.speed.km, el / r.speed.per), r.speed.km); }, 'linear');
    if (my !== tok) return false;
    setTime(Tset);
    placeAngkot(Math.min(r.speed.km, Math.max(0, d) / r.speed.per), r.speed.km);
    return d === arrive;
  }

  /* ================= order: activity cards on the day path ================= */
  function buildOrder(r) {
    const tkMode = r.mode === 'tk', n = r.slots.length;
    const xs = tkMode ? [150, 390, 630] : [100, 280, 460, 640], cw = tkMode ? 176 : 156, chh = tkMode ? 186 : 204;
    const sy = tkMode ? 432 : 428, ty = 690;
    orderS = { slots: [], cards: [] };
    r.slots.forEach((s, i) => {
      const g = el('g', { transform: `translate(${xs[i]} ${sy})` }, orderG);
      let m = Rc(-cw / 2 - 6, -chh / 2 - 6, cw + 12, chh + 12, 22, `fill="#FFF8EC" fill-opacity=".55" stroke="${OUT}" stroke-width="3.4" stroke-dasharray="12 9"`);
      if (tkMode) m += `<g opacity=".9" transform="translate(0 0) scale(1.15)">${icon(s.icon)}</g>`;
      else m += Ci(0, -chh / 2 - 36, 30, solid('#FFF8EC', 3)) + txt(0, -chh / 2 - 21, String(i + 1), 44, { w: 600 });
      if (i < n - 1) m += Pa(`M${cw / 2 + 12} -10l14 10l-14 10`, `fill="none" ${ol(4)}`);
      g.innerHTML = m;
      const ring = el('rect', { x: -cw / 2 - 6, y: -chh / 2 - 6, width: cw + 12, height: chh + 12, rx: 22, fill: 'none', stroke: '#0F8C7A', 'stroke-width': 7, opacity: 0 }, g);
      orderS.slots.push(Object.assign({}, s, { x: xs[i], y: sy, card: null, ring }));
    });
    const homes = shuffle(xs.slice());
    r.cards.forEach((c, i) => {
      const g = el('g', {}, orderG);
      const body = el('g', {}, g);
      body.innerHTML = orderCardMarkup(c, cw, chh, tkMode);
      const card = Object.assign({}, c, { g, body, home: { x: homes[i], y: ty }, at: null, x: homes[i], y: ty });
      placeCard(card, card.x, card.y, 1);
      orderS.cards.push(card);
      let off = null;
      GS.drag(g, {
        svg,
        onStart(p) { if (!inputOn || busy) return false; off = { x: p.x - card.x, y: p.y - card.y }; orderG.appendChild(g); GS.sfx.pick(); placeCard(card, card.x, card.y - LIFT, 1.08); return true; },
        onMove(p) { if (!off) return; placeCard(card, p.x - off.x, p.y - off.y - LIFT, 1.08); card.dx = p.x - off.x; card.dy = p.y - off.y; },
        onEnd(p) { if (!off) return; off = null; dropCard(card, p.x, p.y); }
      });
    });
    orderS.cw = cw; orderS.chh = chh;
  }
  function orderCardMarkup(c, cw, chh, tkMode) {
    const night = c.t >= HM(18) || c.t < HM(5), sore = c.t >= HM(15) && !night;
    const bg = tkMode ? '#FFF8EC' : night ? '#33407A' : sore ? '#FFE2B8' : '#E3F4FA';
    let s = Rc(-cw / 2 + 4, -chh / 2 + 6, cw, chh, 18, fill(OUT, 0.22)) + Rc(-cw / 2, -chh / 2, cw, chh, 18, solid(bg, 3.4));
    if (tkMode) s += `<g transform="translate(0 -4) scale(1.35)">${icon(c.icon)}</g>`;
    else s += `<g transform="translate(0 ${-chh / 2 + 56}) scale(.85)">${icon(c.icon)}</g><g transform="translate(0 ${chh / 2 - 54})">${miniClock(42, c.t)}</g>`;
    return s;
  }
  function placeCard(c, x, y, k) { c.x = x; c.y = y; c.g.setAttribute('transform', `translate(${n1(x)} ${n1(y)}) scale(${k || 1})`); }
  function moveCard(c, x, y) { const x0 = c.x, y0 = c.y; return tw(160, e => placeCard(c, GS.lerp(x0, x, e), GS.lerp(y0, y, e), 1), 'outCubic').then(() => placeCard(c, x, y, 1)); }
  function dropCard(c, px, py) {
    const S = orderS.slots;
    let best = null, bd = 150;
    S.forEach((s, i) => { const d = Math.hypot(s.x - c.x, s.y - (c.y + LIFT)); if (d < bd) { bd = d; best = i; } });
    const from = c.at;
    if (best == null) { if (from != null) S[from].card = null; c.at = null; moveCard(c, c.home.x, c.home.y); GS.sfx.drop(); updateDock(); return; }
    const other = S[best].card;
    if (from != null) S[from].card = null;
    if (other && other !== c) {
      if (from != null) { S[from].card = other; other.at = from; moveCard(other, S[from].x, S[from].y); }
      else { other.at = null; moveCard(other, other.home.x, other.home.y); }
    }
    S[best].card = c; c.at = best;
    moveCard(c, S[best].x, S[best].y);
    GS.sfx.drop();
    updateDock();
  }
  async function commitOrder(my) {
    const r = RD, S = orderS.slots, tkMode = r.mode === 'tk';
    let prev = -1, failAt = -1, why = '';
    for (let i = 0; i < S.length; i++) {
      const c = S[i].card, tt = tkMode ? S[i].t : c.t;
      if (!tkMode && c.t < prev) { failAt = i; why = cap(timeWords(c.t)) + ' itu sebelum ' + timeWords(prev) + '. Urutannya tertukar.'; break; }
      // the day plays: the clock runs forward to this slot's time
      const target = T0 + wrap(tt - tod(T0), DAY);
      const from = T;
      await tw(Math.max(450, Math.min(1400, (target - from) / 3600 * 160)), e => setTime(from + (target - from) * e), 'inOutCubic');
      if (my !== tok) return;
      setTime(target);
      if (tkMode && c.t !== S[i].t) { failAt = i; why = c.why; break; }
      S[i].ring.setAttribute('opacity', 1);
      GS.sfx.count(i + 2);
      sparkle(S[i].x, S[i].y - 80);
      prev = c.t;
      if (!(await pause(380))) return;
    }
    if (failAt < 0) {
      hud.mood('cheer'); GS.sfx.coin(); GS.say(r.win || 'Urutannya pas!');
      if (!(await pause(1200))) return;
      nextRound();
      return;
    }
    tries++;
    hud.mood('oops'); GS.sfx.oops();
    const bad = S[failAt].card;
    GS.fx(bad.body, 'gs-wobble', 450);
    GS.say(why);
    if (!(await pause(1500))) return;
    // the misplaced cards go back to the tray, the clock goes back to the morning
    for (let i = tkMode ? 0 : failAt; i < S.length; i++) {
      const c = S[i].card;
      if (!c) continue;
      if (tkMode && c.t === S[i].t) continue;
      S[i].card = null; c.at = null; moveCard(c, c.home.x, c.home.y);
    }
    S.forEach(s => s.ring.setAttribute('opacity', 0));
    const from = T;
    await tw(500, e => setTime(from + (T0 - from) * e));
    if (my !== tok) return;
    setTime(T0);
    busy = false; inputOn = true; hud.mood('think'); updateDock();
  }

  /* ================= how long? (predict with steppers, then the clock runs) ================= */
  function stepper(parent, cx, cy, o) {
    const g = el('g', { transform: `translate(${cx} ${cy})` }, parent);
    const st = { v: o.value, min: o.min, max: o.max, step: o.step };
    const valT = GS.el('text', { x: 0, y: 16, 'font-size': 64, 'text-anchor': 'middle', fill: INK, 'font-weight': 600 }, g);
    GS.markup(g, txt(0, 60, o.unit, 34, { cls: 't-body', fill: '#5C3A1E' }));
    const show = () => { valT.textContent = String(st.v); };
    hitButton(g, -122, 0, 50, '', () => { st.v = Math.max(st.min, st.v - st.step); show(); GS.sfx.pop(); }, { glyph: GLYPH.minus, name: 'minus', col: ['#F28C28', '#F8B26A', '#C76A12'] });
    hitButton(g, 122, 0, 50, '', () => { st.v = Math.min(st.max, st.v + st.step); show(); GS.sfx.pop(); }, { glyph: GLYPH.plus, name: 'plus' });
    show();
    st.set = v => { st.v = v; show(); };
    return st;
  }
  function panelBox(y, h, title) {
    GS.markup(panelG, Rc(PANEL.x + 4, y + 6, PANEL.w, h, 22, fill(OUT, 0.22)) + Rc(PANEL.x, y, PANEL.w, h, 22, solid('#FFF8EC', 4)) +
      (title ? txt(PANEL.x + PANEL.w / 2, y + 40, title, 34, { cls: 't-body' }) : ''));
  }
  function cardBottom() { try { const b = cardG.getBBox(); return CARD.y + b.y + b.height; } catch (e) { return 200; } }
  function buildHowlong(r) {
    const y0 = cardBottom() + 14, rows = r.unit === 'hm' ? 2 : 1, h = 56 + rows * 150;
    panelBox(y0, h, 'Berapa lama?');
    stepS = {};
    const cx = PANEL.x + PANEL.w / 2;
    if (r.unit === 'h' || r.unit === 'hm') stepS.h = stepper(panelG, cx, y0 + 112, { value: r.unit === 'h' ? 1 : 0, min: 0, max: 12, step: 1, unit: 'jam' });
    if (r.unit === 'm' || r.unit === 'hm') stepS.m = stepper(panelG, cx, y0 + 112 + (rows - 1) * 150, { value: r.unit === 'm' ? 5 : 0, min: 0, max: r.unit === 'm' ? 120 : 55, step: 5, unit: 'menit' });
    RD.arc = true; RD.pin = true; startPin();
  }
  const stepValue = () => (stepS.h ? stepS.h.v * 3600 : 0) + (stepS.m ? stepS.m.v * 60 : 0);
  async function commitHowlong(my) {
    const r = RD, d = stepValue();
    GS.tone({ f: 523, t: 0.12, type: 'square', vol: 0.05 });
    await tw(Math.max(900, Math.min(3600, d / 3600 * 700)), e => setTime(T0 + d * e), 'inOutCubic');
    if (my !== tok) return;
    setTime(T0 + d);
    const now = r.unit === 'h' ? timeWords(T) : digital(T);
    if (d === r.answer) {
      await success(r, my, cap(durWords(d, r.unit === 'm' ? 'm' : 'hm')) + '! Sekarang ' + now + '. ' + (r.msgs.ok || (r.ev && EV[r.ev] ? EV[r.ev].ok : 'Pas!')));
      return;
    }
    await miss(my, (d < r.answer ? 'Baru ' + now + '. ' + (r.msgs.short || 'Belum sampai.') : 'Sudah ' + now + '. ' + (r.msgs.long || 'Kelewatan.')), true);
    if (my !== tok) return;
    // the clock goes back to the start for the next try
    const from = T;
    await tw(600, e => setTime(from + (T0 - from) * e));
    if (my !== tok) return;
    setTime(T0);
    busy = false; inputOn = true; hud.mood('think'); updateDock();
  }

  /* ================= digital clock: set it to match the tower clock ================= */
  function buildDigital(r) {
    const y0 = cardBottom() + 14, h = 316, x = PANEL.x;
    GS.markup(panelG, Rc(x + 4, y0 + 6, PANEL.w, h, 22, fill(OUT, 0.22)) + Rc(x, y0, PANEL.w, h, 22, solid('#2B2A33', 4)) + Rc(x + 26, y0 + 112, PANEL.w - 52, 96, 14, fill('#1B1A20')));
    digS = { h: 12, m: 0 };
    const hT = GS.el('text', { x: x + 112, y: y0 + 188, 'font-size': 80, 'text-anchor': 'middle', fill: '#FFC83D', 'font-weight': 600 }, panelG);
    GS.markup(panelG, txt(x + 181, y0 + 186, '.', 80, { fill: '#FFC83D', w: 600 }));
    const mT = GS.el('text', { x: x + 250, y: y0 + 188, 'font-size': 80, 'text-anchor': 'middle', fill: '#FFC83D', 'font-weight': 600 }, panelG);
    const show = () => { hT.textContent = pad2(digS.h); mT.textContent = pad2(digS.m); };
    const btn = (bx, by, glyph, fn, name) => hitButton(panelG, bx, by, 47, '', () => { fn(); show(); GS.sfx.pop(); }, { glyph, name, col: ['#F28C28', '#F8B26A', '#C76A12'] });
    btn(x + 112, y0 + 58, GLYPH.up, () => { digS.h = digS.h % 12 + 1; }, 'jam-naik');
    btn(x + 112, y0 + 262, GLYPH.down, () => { digS.h = (digS.h + 10) % 12 + 1; }, 'jam-turun');
    btn(x + 250, y0 + 58, GLYPH.up, () => { digS.m = (digS.m + 5) % 60; }, 'menit-naik');
    btn(x + 250, y0 + 262, GLYPH.down, () => { digS.m = (digS.m + 55) % 60; }, 'menit-turun');
    digS.show = show; show();
  }
  async function commitDigital(my) {
    const a = hmOf(T0), okH = digS.h === h12(a.h), okM = digS.m === a.m;
    if (okH && okM) { await success(RD, my, 'Sama! ' + pad2(digS.h) + '.' + pad2(digS.m) + ' artinya ' + timeWords(T0) + '.'); return; }
    await miss(my, !okM && !okH ? 'Belum sama. Lihat jarum pendek dan jarum panjang.' : !okM ? 'Jamnya sudah pas. Lihat jarum panjang, hitung lima, lima.' : 'Menitnya sudah pas. Lihat jarum pendek.');
  }

  /* ================= predict (k1): one tap, never penalised ================= */
  function buildPredict(r) {
    const y0 = 236;
    panelBox(y0, 214, '');
    [['panjang', 'lebih panjang', 150], ['pendek', 'lebih pendek', 30]].forEach((o, i) => {
      const x = PANEL.x + 96 + i * 170, g = el('g', { transform: `translate(${x} ${y0 + 104})` }, panelG);
      const inner = el('g', { class: 'jm-press' }, g);
      inner.innerHTML = Rc(-78, -88, 156, 172, 18, solid('#EAF6F8', 3.4)) + Rc(-66, 6, 132, 22, 4, fill('#E5BE86')) + Pa(`M-40 12L${-40 + o[2] * 0.6} 13L${-40 + o[2] * 0.6} 19L-40 20Z`, fill(OUT, 0.45)) + line('M-40 16V-56', 4) + Rc(-38, -56, 20, 13, 0, fill('#E2453C')) +
        txt(0, 66, o[1], 32, { cls: 't-body' });
      const hit = el('rect', { x: -80, y: -90, width: 160, height: 176, fill: 'transparent', 'data-hit': 'tebak-' + o[0] }, g);
      hit.style.cursor = 'pointer';
      hit.addEventListener('click', () => choosePredict(o[0], inner));
    });
  }
  async function choosePredict(id, inner) {
    if (!inputOn || busy || !RD || RD.kind !== 'predict') return;
    busy = true; inputOn = false;
    const my = tok;
    GS.sfx.click();
    if (inner) inner.querySelector('rect').setAttribute('stroke', '#0F8C7A');
    if (id === RD.correct) { GS.sfx.star(0); sparkle(PANEL.x + PANEL.w / 2, 300); GS.say('Tebakanmu benar! Ayo kita buktikan.'); hud.mood('happy'); }
    else { GS.say('Ayo kita lihat sendiri!'); hud.mood('think'); }
    if (!(await pause(1400))) return;
    if (my === tok) nextRound();
  }

  /* ================= events ================= */
  async function playEvent(name, my, r) {
    const map = { ayam: evRooster, bus: evBus, pos: evPos, warung: evWarung, makan: evSteam, makanmalam: evSteam, kue: evSteam, layangan: evKite, azan: evAzan, tidur: evSleep, bola: evBall, angkot: evAngkot, kereta: evChime, chime: evChime };
    const fn = map[name];
    if (fn) await fn(my, r);
  }
  function actor(markup) { const g = el('g', {}, actorsG); g.innerHTML = markup; return g; }
  const place = (g, x, y, k) => g.setAttribute('transform', `translate(${n1(x)} ${n1(y)})${k ? ` scale(${k})` : ''}`);
  async function evRooster(my) {
    svg.querySelectorAll('.jm-rooster .jm-head').forEach(h => { h.classList.remove('jm-crow'); void h.getBoundingClientRect(); h.classList.add('jm-crow'); });
    [0, 0.22, 0.44].forEach((d, i) => GS.tone({ f: 620 + i * 60, f2: 980 - i * 80, t: 0.2, type: 'sawtooth', vol: 0.05, delay: d }));
    floatWord(110, 520, 'Kukuruyuk!');
    await pause(1300);
  }
  async function evBus(my) {
    const kids = actor(`<g transform="translate(205 704)">${personArt(1, 0.9)}</g><g transform="translate(250 704)">${personArt(3, 0.9)}</g>`);
    const bus = actor(busArt()), stop = 130;
    place(bus, -700, 782);
    await tw(1300, e => place(bus, GS.lerp(-700, stop, e), 782), 'outCubic');
    if (my !== tok) return;
    GS.tone({ f: 330, t: 0.16, type: 'square', vol: 0.06 }); GS.tone({ f: 415, t: 0.2, type: 'square', vol: 0.06, delay: 0.2 });
    await tw(500, e => kids.setAttribute('opacity', (1 - e).toFixed(2)));
    if (my !== tok) return;
    await tw(1100, e => place(bus, GS.lerp(stop, 1950, e), 782), 'inCubic');
    if (my === tok) { bus.remove(); kids.remove(); }
  }
  function passAngkot() {
    if (live.size > 1 || GS.reducedMotion) return;
    const my = tok, g = actor(`<g transform="scale(.8)">${angkotArt(pick([P.teal, P.blue, P.orange]))}</g>`);
    live.add(g);
    GS.tone({ f: 520, t: 0.1, type: 'square', vol: 0.04 });
    GS.tween(ms(1700), e => place(g, GS.lerp(-500, 1900, e), 784), 'linear').then(() => { live.delete(g); if (my === tok) g.remove(); });
  }
  async function evAngkot(my) {
    const g = actor(`<g transform="scale(.8)">${angkotArt()}</g>`);
    place(g, -500, 784);
    await tw(1100, e => place(g, GS.lerp(-500, 225, e), 784), 'outCubic');
    if (my !== tok) return;
    GS.tone({ f: 520, t: 0.12, type: 'square', vol: 0.05 }); GS.tone({ f: 620, t: 0.16, type: 'square', vol: 0.05, delay: 0.16 });
    await pause(500);
    await tw(900, e => place(g, GS.lerp(225, 1900, e), 784), 'inCubic');
    if (my === tok) g.remove();
  }
  async function evPos(my) {
    const g = actor(`<g class="jm-bob">${personArt(5, 1)}${Rc(8, -58, 22, 26, 5, solid('#F28C28', 2.4))}</g>`);
    place(g, -160, 702);
    GS.tone({ f: 1500, t: 0.08, type: 'triangle', vol: 0.06 }); GS.tone({ f: 1500, t: 0.08, type: 'triangle', vol: 0.06, delay: 0.14 });
    await tw(1300, e => place(g, GS.lerp(-160, 170, e), 702), 'outCubic');
    if (my !== tok) return;
    sparkle(170, 560);
    floatPic(170, 590, ICONS.pos());
    await pause(900);
  }
  async function evWarung(my) {
    sparkle(530, 520);
    const g = actor(`<g transform="translate(530 470)">${f3(a => Rc(-46, -22, 92, 40, 10, a), [-46, -22, 92, 40], P.green, { hl: false, k: 0.1 })}${txt(0, 8, 'BUKA', 26, { cls: 't-display', fill: '#FFFFFF', decor: true })}</g>`);
    GS.sfx.pop();
    await pause(1100);
    void g;
  }
  async function evSteam(my, r) {
    const x = r && r.ev === 'kue' ? 64 : 110, y = 540;
    const g = actor(`<g class="jm-steam" transform="translate(${x} ${y})">${[-14, 0, 14].map(dx => Pa(`M${dx} 0q8 -10 0 -20q-8 -10 0 -20`, `fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"`)).join('')}</g>`);
    floatPic(x + 4, y - 10, icon(r && EV[r.ev] ? EV[r.ev].icon : 'makan'));
    GS.tone({ f: 1320, t: 0.08, type: 'triangle', vol: 0.06 }); GS.tone({ f: 1760, t: 0.12, type: 'triangle', vol: 0.05, delay: 0.1 });
    await pause(1500);
    if (my === tok) g.remove();
  }
  async function evKite(my) {
    const kid = actor(`<g transform="translate(470 700)">${personArt(2, 1)}</g>`);
    const str = el('path', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2.4 }, actorsG);
    const kite = actor(`<g transform="scale(1.2)">${ICONS.layangan()}</g>`);
    GS.sfx.whoosh();
    await tw(1600, e => { const x = GS.lerp(480, 560, e), y = GS.lerp(640, 300, e); place(kite, x, y); str.setAttribute('d', `M488 650Q${n1((488 + x) / 2 + 40)} ${n1((650 + y) / 2 + 30)} ${n1(x)} ${n1(y + 30)}`); }, 'outCubic');
    void kid;
    await pause(600);
  }
  async function evAzan(my) {
    const g = actor(`<g transform="translate(630 452)">${[22, 40, 58].map(rr => `<path class="jm-wave-arc" d="M${-rr * 0.2} ${-rr}A${rr} ${rr} 0 0 0 ${-rr * 0.2} ${rr}" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>`).join('')}</g>`);
    [0, 0.5, 1].forEach(d => GS.tone({ f: 90, f2: 60, t: 0.35, type: 'sine', vol: 0.3, delay: d }));
    await pause(1700);
    if (my === tok) g.remove();
  }
  async function evSleep(my) {
    [0, 1, 2].forEach(i => setTimeout(() => { if (my === tok) floatWord(150 + i * 10, 520 - i * 6, 'z', 34, 'jm-zzz'); }, ms(i * 420)));
    GS.tone({ f: 523, t: 0.4, type: 'sine', vol: 0.06 }); GS.tone({ f: 392, t: 0.6, type: 'sine', vol: 0.06, delay: 0.35 });
    await pause(1600);
  }
  async function evBall(my) {
    const kids = actor(`<g transform="translate(470 700)">${personArt(0, 1)}</g><g transform="translate(610 700)">${personArt(6, 1)}</g>`);
    const b = actor(`<g transform="scale(.42)">${ICONS.bola()}</g>`);
    GS.tone({ f: 2200, t: 0.4, type: 'square', vol: 0.03 });
    await tw(1100, e => place(b, GS.lerp(490, 590, e), 690 - Math.abs(Math.sin(e * Math.PI * 2)) * 60), 'linear');
    void kids;
    await pause(500);
  }
  async function evChime(my, r) {
    const n = r && r.chimes ? r.chimes : 3;
    const kents = svg.querySelectorAll('.jm-kent');
    for (let i = 0; i < n; i++) {
      kents.forEach(k => { k.classList.remove('hit'); void k.getBoundingClientRect(); k.classList.add('hit'); });
      GS.tone({ f: 520, t: 0.1, type: 'triangle', vol: 0.16 }); GS.noise({ t: 0.05, vol: 0.06, freq: 900 });
      if (r && r.chimes) floatWord(930, 600, String(i + 1), 44, null, true);
      if (!(await pause(r && r.chimes ? 520 : 260))) return;
    }
  }
  function sparkle(x, y) {
    const g = el('g', { transform: `translate(${n1(x)} ${n1(y)})` }, fxG);
    const inner = el('g', { class: 'jm-sparkle' }, g);
    inner.innerHTML = [0, 60, 120, 180, 240, 300].map(a => `<path d="M0 -34L5 -12L0 -16L-5 -12Z" fill="#FFC83D" stroke="${OUT}" stroke-width="2" transform="rotate(${a})"/>`).join('') + Ci(0, 0, 9, solid('#FFE08A', 2));
    setTimeout(() => g.remove(), 1000);
  }
  function floatWord(x, y, s, size, cls, num) {
    const g = el('g', { transform: `translate(${n1(x)} ${n1(y)})` }, fxG);
    const inner = el('g', { class: cls || 'jm-zzz' }, g);
    inner.innerHTML = Rc(-s.length * (size || 30) * 0.3 - 14, -(size || 30) - 6, s.length * (size || 30) * 0.6 + 28, (size || 30) + 22, 16, solid('#FFFFFF', 2.6)) + txt(0, 2, s, size || 30, { cls: num ? '' : 't-display', decor: true, w: num ? 600 : null });
    setTimeout(() => g.remove(), 2500);
  }
  function floatPic(x, y, markup) {
    const g = el('g', { transform: `translate(${n1(x)} ${n1(y)}) scale(.7)` }, fxG);
    const inner = el('g', { class: 'jm-zzz' }, g);
    inner.innerHTML = Ci(0, 0, 58, solid('#FFFFFF', 3)) + markup;
    setTimeout(() => g.remove(), 2500);
  }

  /* ================= test hook ================= */
  function answerT() {
    const r = RD;
    if (r.answer != null && r.kind === 'howlong') return null;
    return T0 + wrapSigned(r.target - tod(T0), r.mod || DAY);
  }
  async function solve() {
    if (!RD || busy || !inputOn) return;
    const r = RD;
    if (r.kind === 'clock') {
      const a = answerT(), from = T;
      busy = true;
      await tw(300, e => setTime(from + (a - from) * e));
      setTime(a); busy = false;
      onGo();
    } else if (r.kind === 'order') {
      const S = orderS.slots, cards = orderS.cards.slice();
      const order = r.mode === 'tk' ? S.map(s => cards.find(c => c.t === s.t)) : cards.slice().sort((a, b) => a.t - b.t);
      S.forEach(s => { s.card = null; });
      order.forEach((c, i) => { S[i].card = c; c.at = i; placeCard(c, S[i].x, S[i].y, 1); });
      updateDock(); onGo();
    } else if (r.kind === 'howlong') {
      const d = r.answer;
      if (stepS.h && stepS.m) { stepS.h.set(Math.floor(d / 3600)); stepS.m.set(Math.round((d % 3600) / 60)); }
      else if (stepS.h) stepS.h.set(Math.round(d / 3600));
      else stepS.m.set(Math.round(d / 60));
      onGo();
    } else if (r.kind === 'digital') {
      const a = hmOf(T0); digS.h = h12(a.h); digS.m = a.m; digS.show(); onGo();
    } else if (r.kind === 'predict') choosePredict(r.correct, null);
  }
  window.__game = {
    go: i => run.go(i),
    solve,
    count: () => LEVELS.length,
    speed: n => { SPEED = Math.max(1, +n || 1); },
    tier: TIER,
    get state() { return { level: run.current, round: RI, rounds: LV ? LV.rounds.length : 0, kind: RD && RD.kind, time: digital(T), T: Math.round(T - 2 * DAY), tries, busy, inputOn }; },
    toScreen(x, y) { const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; const r = pt.matrixTransform(svg.getScreenCTM()); return { x: r.x, y: r.y }; },
    clock: { cx: CX, cy: CY, r: FR },
    words: timeWords, digital, setTime: s => setTime(T0 + s)
  };
  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
