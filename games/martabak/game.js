/* Bagi Martabak (martabak)
 * The child is the seller at a warung. Food is a convex polygon (martabak = 64-gon,
 * kue lapis = rectangle, roti = rounded rectangle). A straight knife stroke splits every
 * piece it fully crosses (convex polygon vs line clipping, pieces stay convex). Pieces are
 * dragged onto friends' plates; "Bagikan!" compares real areas (shoelace formula).
 * Fair = every share within 6% (relative) of its target share. */
(function () {
  'use strict';
  const GAME = 'martabak';
  const TIER = (window.GS && GS.tier) ? GS.tier() : 'k1';   // tk | k1 | k2 | k3 | k4 (shared/curriculum.js)
  const OUT = '#3B2A20';
  const TOL = 0.06;                 // fairness tolerance, relative to each target share
  const LIFT = 40;                  // dragged pieces float this far above the finger
  const FRIEND_Y = 338;             // friends' feet (hidden behind the counter edge at y=300)
  const PLATE_Y = 374;
  const GAP = 7;                    // how far each half moves away from a fresh cut
  const NAMES = ['Budi', 'Siti', 'Dodi', 'Ani', 'Rina', 'Pak Joko', 'Bayu', 'Raka']; // matches GS.art.person(i) looks
  const FR = { 2: 'setengah', 3: 'sepertiga', 4: 'seperempat' };
  const hasArt = fn => !!(window.GS && GS.art && typeof GS.art[fn] === 'function');

  /* ================= geometry ================= */
  const Geo = {
    area(poly) {
      let a = 0;
      for (let i = 0, n = poly.length; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; a += p.x * q.y - q.x * p.y; }
      return a / 2;
    },
    absArea(poly) { return Math.abs(Geo.area(poly)); },
    centroid(poly) {
      let a = 0, cx = 0, cy = 0;
      for (let i = 0, n = poly.length; i < n; i++) {
        const p = poly[i], q = poly[(i + 1) % n], cr = p.x * q.y - q.x * p.y;
        a += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr;
      }
      if (Math.abs(a) < 1e-9) return { x: poly[0].x, y: poly[0].y };
      return { x: cx / (3 * a), y: cy / (3 * a) };
    },
    bbox(poly) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of poly) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
      return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    },
    /** Keep the part of a convex polygon on one side of the infinite line a->b (sign +1 = left).
     *  Each vertex carries `cut`: whether its outgoing edge lies on a knife cut. */
    clipHalf(poly, a, b, sign) {
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const sd = p => sign * (ux * (p.y - a.y) - uy * (p.x - a.x));   // signed distance
      const E = 1e-7, out = [], n = poly.length;
      for (let i = 0; i < n; i++) {
        const P = poly[i], Q = poly[(i + 1) % n], dp = sd(P), dq = sd(Q);
        const pin = dp >= -E, qin = dq >= -E;
        if (pin) out.push({ x: P.x, y: P.y, cut: !!P.cut });
        if (pin && !qin) {
          if (dp > E) { const t = dp / (dp - dq); out.push({ x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t, cut: true }); }
          else out[out.length - 1].cut = true;
        } else if (!pin && qin && dq > E) {
          const t = dp / (dp - dq); out.push({ x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t, cut: !!P.cut });
        }
      }
      const res = [];
      for (const v of out) {
        const last = res[res.length - 1];
        if (last && Math.abs(last.x - v.x) < 1e-6 && Math.abs(last.y - v.y) < 1e-6) res[res.length - 1] = v; else res.push(v);
      }
      while (res.length > 1 && Math.abs(res[0].x - res[res.length - 1].x) < 1e-6 && Math.abs(res[0].y - res[res.length - 1].y) < 1e-6) res.pop();
      return res.length >= 3 && Geo.absArea(res) > 1e-6 ? res : null;
    },
    split(poly, a, b) { return [Geo.clipHalf(poly, a, b, 1), Geo.clipHalf(poly, a, b, -1)]; },
    /** Parameter range [t0,t1] of segment a->b that lies inside the convex polygon (on the
     *  infinite line). null when the line misses. Fully crossed when t0 > 0 and t1 < 1. */
    chord(poly, a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
      if (L2 < 1) return null;
      let t0 = Infinity, t1 = -Infinity, pos = false, neg = false;
      const s = p => dx * (p.y - a.y) - dy * (p.x - a.x);
      for (let i = 0, n = poly.length; i < n; i++) {
        const p = poly[i], q = poly[(i + 1) % n], sp = s(p), sq = s(q);
        if (sp > 0) pos = true; if (sp < 0) neg = true;
        if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
          const t = sp / (sp - sq), ix = p.x + (q.x - p.x) * t, iy = p.y + (q.y - p.y) * t;
          const u = ((ix - a.x) * dx + (iy - a.y) * dy) / L2;
          t0 = Math.min(t0, u); t1 = Math.max(t1, u);
        }
      }
      return pos && neg && t0 < t1 ? [t0, t1] : null;
    },
    /** Intersection of two convex polygons (clip A by every edge of B). */
    intersect(A, B) {
      const o = Math.sign(Geo.area(B)) || 1;
      let out = A;
      for (let i = 0; i < B.length && out; i++) out = Geo.clipHalf(out, B[i], B[(i + 1) % B.length], o);
      return out;
    },
    circle(r, n) { const a = []; for (let k = 0; k < n; k++) { const t = (k / n) * Math.PI * 2; a.push({ x: r * Math.cos(t), y: r * Math.sin(t) }); } return a; },
    rect(w, h) { return [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }]; },
    roundRect(w, h, r, seg) {
      const a = [], cs = [[w / 2 - r, -h / 2 + r, -90], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180]];
      for (const [cx, cy, a0] of cs) for (let k = 0; k <= seg; k++) { const t = (a0 + (90 * k) / seg) * Math.PI / 180; a.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }); }
      return a;
    },
    rot(p, deg) { const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }; }
  };
  const pts = poly => poly.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' ');
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ================= food definitions ================= */
  const FOOD = {
    martabak: { shape: 'circle', r: 145, label: 'martabak' },
    lapis: { shape: 'rect', w: 390, h: 234, layers: 9, label: 'kue lapis' },
    lapisKecil: { shape: 'rect', w: 200, h: 120, layers: 5, label: 'kue lapis' },
    roti: { shape: 'round', w: 372, h: 252, rr: 46, label: 'roti bakar' },
    martabakKecil: { shape: 'circle', r: 112, label: 'martabak' },
    klepon: { shape: 'ball', r: 30, label: 'klepon' }
  };
  function foodPoly(def) {
    if (def.shape === 'circle') return Geo.circle(def.r, 72);   // 5-degree steps, like sectorPoly
    if (def.shape === 'rect') return Geo.rect(def.w, def.h);
    if (def.shape === 'ball') return Geo.circle(def.r, 24);
    return Geo.roundRect(def.w, def.h, def.rr, 8);
  }
  /* Snapping is a motor-skill aid only (phone scale is ~0.45, a 6-year-old's swipe is rough).
   * The child still decides how many cuts and where; areas are always measured truthfully.
   * Round food cuts like a real martabak: a swipe passing near the centre becomes a diameter,
   * a swipe that starts (or ends) near the centre becomes a radius; angles snap to 15 degrees
   * (the rim ticks are every 30). Rectangles: near-horizontal/vertical swipes are straightened
   * and snap to the nearest equal division of the side; other swipes near the centre pass
   * exactly through it. */
  const YOUNG = TIER === 'tk' || TIER === 'k1';
  const SNAP = { centre: YOUNG ? 80 : 60, line: YOUNG ? 40 : 30, deg: 15 };
  const LINE_DIVS = YOUNG ? [2, 4] : [2, 3, 4, 6, 8];
  const GUIDE_OPACITY = { tk: 1, k1: 1, k2: 1, k3: 0.35, k4: 0 }[TIER];
  function lineFractions() {
    const out = [];
    LINE_DIVS.forEach(m => { for (let k = 1; k < m; k++) if (!out.some(f => Math.abs(f - k / m) < 1e-9)) out.push(k / m); });
    return out;
  }
  function snapRect(def, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    const hw = def.w / 2, hh = def.h / 2, lim = Math.sin(12 * Math.PI / 180);
    const nearest = (v, half) => {
      let best = null;
      for (const f of lineFractions()) { const c = -half + 2 * half * f; if (Math.abs(c - v) <= SNAP.line && (best === null || Math.abs(c - v) < Math.abs(best - v))) best = c; }
      return best === null ? v : best;
    };
    if (Math.abs(dy / L) < lim) { const y = nearest(a.y + dy * (0 - a.x) / (dx || 1e-9), hh); return { a: { x: a.x, y }, b: { x: b.x, y } }; }
    if (Math.abs(dx / L) < lim) { const x = nearest(a.x + dx * (0 - a.y) / (dy || 1e-9), hw); return { a: { x, y: a.y }, b: { x, y: b.y } }; }
    const nx = -dy / L, ny = dx / L, d = a.x * nx + a.y * ny;
    if (Math.abs(d) <= SNAP.line) return { a: { x: a.x - nx * d, y: a.y - ny * d }, b: { x: b.x - nx * d, y: b.y - ny * d } };
    return { a, b };
  }
  /** Sector of a round food (degrees, a1 > a0, span <= 360) as a polygon; radial edges are cut edges.
   *  Arcs use 5-degree steps, so sectors of equal angle have exactly equal area. */
  function sectorPoly(r, a0, a1) {
    const n = Math.max(1, Math.round((a1 - a0) / 5));
    const pts = [{ x: 0, y: 0, cut: true }];
    for (let k = 0; k <= n; k++) { const t = (a0 + (a1 - a0) * k / n) * Math.PI / 180; pts.push({ x: r * Math.cos(t), y: r * Math.sin(t), cut: k === n }); }
    return pts;
  }
  function raySplit(sec, th) {
    if (!sec) return [{ a0: th, a1: th + 360 }];          // first radius: a slit, still one piece
    const t = sec.a0 + ((((th - sec.a0) % 360) + 360) % 360);
    if (t <= sec.a0 + 0.5 || t >= sec.a1 - 0.5) return null;
    return [{ a0: sec.a0, a1: t }, { a0: t, a1: sec.a1 }];
  }

  /* ================= art helpers (Kampung Chunky) ================= */
  function martabakArt(r, seed) {
    const R = rng(seed);
    let s = '<circle r="' + r + '" fill="#D98E3A"/>' +
      '<ellipse cx="' + (-r * 0.3) + '" cy="' + (-r * 0.32) + '" rx="' + (r * 0.55) + '" ry="' + (r * 0.45) + '" fill="#EBAA58" opacity=".75"/>' +
      '<path d="M' + (r * 0.95) + ' ' + (r * 0.1) + 'A' + r + ' ' + r + ' 0 0 1 ' + (-r * 0.15) + ' ' + (r * 0.97) + '" fill="none" stroke="#B86E28" stroke-width="' + (r * 0.22) + '" opacity=".45"/>' +
      '<circle r="' + (r - 7) + '" fill="none" stroke="#B5652A" stroke-width="13" opacity=".7"/>' +
      '<circle r="' + (r - 15) + '" fill="none" stroke="#F0B868" stroke-width="3" opacity=".6"/>';
    // honeycomb pores of the batter
    for (let k = 0; k < 46; k++) {
      const t = R() * Math.PI * 2, d = Math.sqrt(R()) * (r - 26);
      s += '<circle cx="' + (Math.cos(t) * d).toFixed(1) + '" cy="' + (Math.sin(t) * d).toFixed(1) + '" r="' + (2 + R() * 2.5).toFixed(1) + '" fill="#B9742E" opacity=".45"/>';
    }
    // cheese shreds
    for (let k = 0; k < 44; k++) {
      const t = R() * Math.PI * 2, d = Math.sqrt(R()) * (r - 22), a = R() * 180;
      s += '<rect x="-8" y="-2.4" width="16" height="4.8" rx="2.4" fill="#FFE08A" stroke="#E0A93A" stroke-width=".9" transform="translate(' + (Math.cos(t) * d).toFixed(1) + ' ' + (Math.sin(t) * d).toFixed(1) + ') rotate(' + a.toFixed(0) + ')"/>';
    }
    // chocolate sprinkles (meses)
    for (let k = 0; k < 190; k++) {
      const t = R() * Math.PI * 2, d = Math.sqrt(R()) * (r - 18), a = R() * 180;
      s += '<rect x="-5" y="-1.7" width="10" height="3.4" rx="1.7" fill="' + (k % 3 ? '#4A2717' : '#6B3B22') + '" transform="translate(' + (Math.cos(t) * d).toFixed(1) + ' ' + (Math.sin(t) * d).toFixed(1) + ') rotate(' + a.toFixed(0) + ')"/>';
    }
    // crushed peanuts
    for (let k = 0; k < 26; k++) {
      const t = R() * Math.PI * 2, d = Math.sqrt(R()) * (r - 24), x = Math.cos(t) * d, y = Math.sin(t) * d;
      s += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="4.6" ry="3.6" fill="#E3B47A" stroke="#B07A3E" stroke-width=".8"/>';
    }
    // butter sheen
    s += '<ellipse cx="' + (-r * 0.42) + '" cy="' + (-r * 0.45) + '" rx="' + (r * 0.24) + '" ry="' + (r * 0.09) + '" fill="#fff" opacity=".3" transform="rotate(-35 ' + (-r * 0.42) + ' ' + (-r * 0.45) + ')"/>';
    return s;
  }
  const LAPIS_COLS = [['#F27FA0', '#F8A9BE', '#D9607F'], ['#FFF1D2', '#FFFAEC', '#EBD8B0'], ['#7CC98A', '#A6DDAF', '#5BA96A'], ['#FFF1D2', '#FFFAEC', '#EBD8B0']];
  function lapisArt(w, h, layers) {
    let s = '';
    const lh = h / layers;
    for (let k = 0; k < layers; k++) {
      const c = LAPIS_COLS[k % 4], y = -h / 2 + k * lh;
      s += '<rect x="' + (-w / 2) + '" y="' + y.toFixed(2) + '" width="' + w + '" height="' + (lh + 0.6).toFixed(2) + '" fill="' + c[0] + '"/>' +
        '<rect x="' + (-w / 2) + '" y="' + y.toFixed(2) + '" width="' + w + '" height="' + (lh * 0.22).toFixed(2) + '" fill="' + c[1] + '" opacity=".8"/>' +
        '<rect x="' + (-w / 2) + '" y="' + (y + lh * 0.82).toFixed(2) + '" width="' + w + '" height="' + (lh * 0.18).toFixed(2) + '" fill="' + c[2] + '" opacity=".55"/>';
    }
    s += '<rect x="' + (-w / 2 + 10) + '" y="' + (-h / 2 + 8) + '" width="' + (w * 0.42) + '" height="' + (h * 0.5) + '" rx="18" fill="#fff" opacity=".14"/>';
    s += '<rect x="' + (w / 2 - w * 0.2) + '" y="' + (-h / 2) + '" width="' + (w * 0.2) + '" height="' + h + '" fill="#3B2A20" opacity=".05"/>';
    return s;
  }
  function rotiArt(w, h, rr, seed, uid) {
    const R = rng(seed);
    const inner = Geo.roundRect(w - 30, h - 30, rr - 12, 6);
    let s = '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="' + rr + '" fill="#C7782F"/>' +
      '<rect x="' + (-w / 2 + 4) + '" y="' + (-h / 2 + 4) + '" width="' + (w * 0.6) + '" height="' + (h * 0.5) + '" rx="' + rr + '" fill="#D98E3A" opacity=".8"/>' +
      '<clipPath id="rin' + uid + '"><polygon points="' + pts(inner) + '"/></clipPath>' +
      '<polygon points="' + pts(inner) + '" fill="#F2C46B"/>' +
      '<g clip-path="url(#rin' + uid + ')">' +
      '<ellipse cx="' + (-w * 0.2) + '" cy="' + (-h * 0.2) + '" rx="' + (w * 0.3) + '" ry="' + (h * 0.25) + '" fill="#F8DA95" opacity=".8"/>';
    for (let k = -6; k <= 6; k++) s += '<path d="M' + (k * 46 - 150) + ' ' + (-h / 2 - 20) + 'l' + 300 + ' ' + (h + 40) + '" stroke="#D9963F" stroke-width="11" opacity=".5"/>';
    s += '</g>';
    // chocolate drizzle
    let d = 'M' + (-w / 2 + 40) + ' ' + (-h / 2 + 50);
    for (let k = 0; k < 7; k++) d += ' Q' + (-w / 2 + 60 + k * 45) + ' ' + (k % 2 ? -h / 2 + 40 : h / 2 - 40) + ' ' + (-w / 2 + 80 + k * 45) + ' ' + (k % 2 ? -h / 2 + 55 : h / 2 - 55);
    s += '<path d="' + d + '" fill="none" stroke="#5A3220" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="#8A5534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".7" transform="translate(-1.5 -2)"/>';
    for (let k = 0; k < 40; k++) {
      const x = (R() - 0.5) * (w - 70), y = (R() - 0.5) * (h - 70), a = R() * 180;
      s += '<rect x="-8" y="-2.4" width="16" height="4.8" rx="2.4" fill="#FFE08A" stroke="#E0A93A" stroke-width=".9" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + a.toFixed(0) + ')"/>';
    }
    return s;
  }
  function kleponArt(r) {
    let s = '<circle r="' + r + '" fill="#4DAA57"/>' +
      '<circle cx="' + (-r * 0.28) + '" cy="' + (-r * 0.3) + '" r="' + (r * 0.5) + '" fill="#86CC8C" opacity=".8"/>' +
      '<path d="M' + (r * 0.8) + ' ' + (r * 0.3) + 'A' + r + ' ' + r + ' 0 0 1 ' + (-r * 0.25) + ' ' + (r * 0.92) + '" fill="none" stroke="#357F40" stroke-width="' + (r * 0.24) + '" opacity=".6"/>';
    [[-0.45, -0.55, 20], [0.05, -0.7, -30], [0.45, -0.45, 60], [-0.6, -0.1, -70], [0.3, -0.05, 15], [-0.15, -0.25, 80], [0.6, 0.2, -20], [-0.3, 0.35, 40], [0.1, 0.5, -60]].forEach(([x, y, a]) => {
      s += '<rect x="' + (-r * 0.17).toFixed(1) + '" y="' + (-r * 0.05).toFixed(1) + '" width="' + (r * 0.34).toFixed(1) + '" height="' + (r * 0.1).toFixed(1) + '" rx="' + (r * 0.05).toFixed(1) + '" fill="#FFFAEC" transform="translate(' + (x * r).toFixed(1) + ' ' + (y * r).toFixed(1) + ') rotate(' + a + ')"/>';
    });
    return s + '<circle cx="' + (-r * 0.42) + '" cy="' + (-r * 0.45) + '" r="' + (r * 0.1) + '" fill="#fff" opacity=".9"/>';
  }
  function knifeMarkup() {
    // Tip at (0,0), edge along +x direction ending at the tip, handle trailing to -x.
    return '<g>' +
      '<rect x="-176" y="-13" width="78" height="26" rx="11" fill="#A8673A" stroke="' + OUT + '" stroke-width="3.5"/>' +
      '<rect x="-170" y="-9" width="62" height="8" rx="4" fill="#C98B4E" opacity=".9"/>' +
      '<path d="M-174 6h72" stroke="#7E4A27" stroke-width="5" stroke-linecap="round" opacity=".7"/>' +
      '<circle cx="-158" cy="0" r="3.4" fill="#D9A441" stroke="' + OUT + '" stroke-width="1.5"/><circle cx="-124" cy="0" r="3.4" fill="#D9A441" stroke="' + OUT + '" stroke-width="1.5"/>' +
      '<rect x="-104" y="-16" width="12" height="32" rx="4" fill="#8C8F94" stroke="' + OUT + '" stroke-width="3"/>' +
      '<path d="M-93 -24H-30Q-8 -20 0 0H-93Z" fill="#D5D9DE" stroke="' + OUT + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M-88 -18H-34" stroke="#F4F6F8" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M-90 -4H-8" stroke="#8C8F94" stroke-width="3" stroke-linecap="round"/>' +
      '</g>';
  }
  function plateMarkup() {
    return '<ellipse cx="6" cy="10" rx="96" ry="30" fill="' + OUT + '" opacity=".18"/>' +
      '<ellipse cx="0" cy="0" rx="94" ry="33" fill="#FFFFFF" stroke="' + OUT + '" stroke-width="4"/>' +
      '<ellipse class="mk-ring" cx="0" cy="0" rx="86" ry="28" fill="none" stroke="#2F80C9" stroke-width="4"/>' +
      '<ellipse cx="0" cy="3" rx="64" ry="18" fill="#EEF2F5"/>' +
      '<ellipse cx="0" cy="6" rx="58" ry="13" fill="#E1E7EC" opacity=".8"/>' +
      '<path d="M-70 -14Q-40 -26 -6 -27" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".9"/>';
  }
  function fracMarkup(n, d, fs, color) {
    const g = fs * 0.1;
    return '<text x="0" y="' + (-g).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '" fill="' + color + '" class="gs-num">' + n + '</text>' +
      '<line x1="' + (-fs * 0.36).toFixed(1) + '" x2="' + (fs * 0.36).toFixed(1) + '" y1="' + (fs * 0.07).toFixed(1) + '" y2="' + (fs * 0.07).toFixed(1) + '" stroke="' + color + '" stroke-width="' + (fs * 0.1).toFixed(1) + '" stroke-linecap="round"/>' +
      '<text x="0" y="' + (fs * 0.83).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '" fill="' + color + '" class="gs-num">' + d + '</text>';
  }
  function tagMarkup(d, n) {
    return '<rect x="-34" y="-52" width="68" height="106" rx="17" fill="' + OUT + '" opacity=".2" transform="translate(2 4)"/>' +
      '<rect x="-34" y="-52" width="68" height="106" rx="17" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="3"/>' +
      '<g transform="translate(0 -3)">' + fracMarkup(n || 1, d, 46, '#2B1D14') + '</g>';
  }
  function faceMarkup(kind) {
    // A round friend-face emoji used inside the reaction bubble.
    let s = '<circle r="21" fill="#FFC83D" stroke="' + OUT + '" stroke-width="3"/><circle cx="-6" cy="-7" r="9" fill="#FFE08A" opacity=".8"/>';
    if (kind === 'happy') {
      s += '<path d="M-11 -4q4 -6 8 0M3 -4q4 -6 8 0" fill="none" stroke="' + OUT + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M-10 5q10 12 20 0z" fill="#B5322B" stroke="' + OUT + '" stroke-width="2.6" stroke-linejoin="round"/>' +
        '<ellipse cx="-13" cy="5" rx="4" ry="2.6" fill="#F59AB0"/><ellipse cx="13" cy="5" rx="4" ry="2.6" fill="#F59AB0"/>';
    } else if (kind === 'sulk') {
      s += '<path d="M-13 -11l8 4M13 -11l-8 4" stroke="' + OUT + '" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="-7" cy="-2" r="2.8" fill="' + OUT + '"/><circle cx="7" cy="-2" r="2.8" fill="' + OUT + '"/>' +
        '<path d="M-8 12q8 -8 16 0" fill="none" stroke="' + OUT + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M15 -16q4 4 0 8" fill="none" stroke="#2F80C9" stroke-width="2.4" stroke-linecap="round"/>';
    } else if (kind === 'hungry') {
      s += '<circle cx="-7" cy="-4" r="3" fill="' + OUT + '"/><circle cx="7" cy="-4" r="3" fill="' + OUT + '"/>' +
        '<ellipse cx="0" cy="8" rx="6" ry="5" fill="#B5322B" stroke="' + OUT + '" stroke-width="2.4"/>' +
        '<path d="M6 11q2 6 0 9" stroke="#6FAEE3" stroke-width="3" stroke-linecap="round" fill="none"/>';
    } else { // puzzled
      s += '<circle cx="-7" cy="-4" r="3" fill="' + OUT + '"/><circle cx="7" cy="-4" r="3" fill="' + OUT + '"/>' +
        '<path d="M-7 9h14" stroke="' + OUT + '" stroke-width="3" stroke-linecap="round"/>' +
        '<text x="26" y="-10" font-size="26" fill="' + OUT + '" text-anchor="middle" class="gs-num">?</text>';
    }
    return s;
  }
  function bubbleMarkup(kind) {
    return '<path d="M-30 -32h60a12 12 0 0 1 12 12v40a12 12 0 0 1 -12 12h-44l-14 14v-14a12 12 0 0 1 -14 -12v-40a12 12 0 0 1 12 -12z" fill="#fff" stroke="' + OUT + '" stroke-width="3.5" stroke-linejoin="round" transform="translate(0 0)"/>' +
      '<g transform="translate(0 0)">' + faceMarkup(kind) + '</g>';
  }
  function heartPath() { return 'M0 6C-12 -4 -8 -14 0 -8C8 -14 12 -4 0 6Z'; }

  function fallbackPerson(i) {
    const shirts = ['#E2453C', '#2F80C9', '#F59AB0', '#4DAA57', '#F28C28', '#3FA7C4', '#FFC83D', '#A8673A'];
    const c = shirts[i % shirts.length];
    return '<ellipse cx="0" cy="0" rx="28" ry="6" fill="' + OUT + '" opacity=".18"/>' +
      '<path d="M-26 0v-38q0 -20 26 -20q26 0 26 20v38z" fill="' + c + '" stroke="' + OUT + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<circle cx="0" cy="-78" r="24" fill="#E3A574" stroke="' + OUT + '" stroke-width="3.5"/>' +
      '<path d="M-24 -80q2 -26 24 -24q24 -2 24 24q-10 -12 -24 -12q-14 0 -24 12z" fill="#3B2A20"/>' +
      '<circle cx="-8" cy="-76" r="3" fill="' + OUT + '"/><circle cx="8" cy="-76" r="3" fill="' + OUT + '"/>' +
      '<path d="M-7 -66q7 6 14 0" fill="none" stroke="' + OUT + '" stroke-width="2.6" stroke-linecap="round"/>';
  }
  function fallbackScene(w, h) {
    const g = h * 0.78;
    return '<defs><linearGradient id="mkSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ED8EC"/><stop offset="1" stop-color="#E6F5F0"/></linearGradient></defs>' +
      '<rect width="' + w + '" height="' + h + '" fill="url(#mkSky)"/>' +
      '<path d="M0 ' + (g - 60) + 'Q200 ' + (g - 130) + ' 420 ' + (g - 70) + 'T900 ' + (g - 80) + 'T1280 ' + (g - 90) + 'V' + h + 'H0z" fill="#A9D3A0"/>' +
      '<rect x="120" y="' + (g - 210) + '" width="1040" height="210" fill="#F3DDA6"/>' +
      '<path d="M80 ' + (g - 200) + 'L200 ' + (g - 290) + 'H1080L1200 ' + (g - 200) + 'z" fill="#E2453C"/>' +
      '<rect x="0" y="' + g + '" width="' + w + '" height="' + (h - g) + '" fill="#E5BE86"/>';
  }

  /* ================= stage setup ================= */
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');

  const sceneG = GS.el('g', { class: 'mk-scene' }, svg);
  try { GS.markup(sceneG, hasArt('scene') ? GS.art.scene('warung', 1280, 390) : fallbackScene(1280, 390)); }
  catch (e) { GS.markup(sceneG, fallbackScene(1280, 390)); }
  const friendsG = GS.el('g', { class: 'mk-friends' }, svg);
  const counterG = GS.el('g', { class: 'mk-counter' }, svg);
  drawCounter(counterG);
  const world = GS.el('g', { class: 'world' }, svg);

  function drawCounter(g) {
    let s = '<rect x="-600" y="300" width="2480" height="620" fill="#C68A55"/>' +
      '<rect x="-600" y="306" width="2480" height="30" fill="#D9A270" opacity=".7"/>';
    [470, 640].forEach(y => { s += '<path d="M-600 ' + y + 'H1880" stroke="#8E5530" stroke-width="3" opacity=".45"/><path d="M-600 ' + (y + 3) + 'H1880" stroke="#E3B07D" stroke-width="2" opacity=".5"/>'; });
    const R = rng(7);
    for (let k = 0; k < 16; k++) {
      const x = R() * 1280, y = 340 + R() * 440, w = 60 + R() * 120;
      s += '<path d="M' + x.toFixed(0) + ' ' + y.toFixed(0) + 'q' + (w / 2).toFixed(0) + ' -8 ' + w.toFixed(0) + ' 0" fill="none" stroke="#A8673A" stroke-width="2.5" stroke-linecap="round" opacity=".35"/>';
    }
    s += '<rect x="-600" y="290" width="2480" height="16" fill="#7E4A27"/>' +
      '<path d="M-600 290H1880" stroke="' + OUT + '" stroke-width="3"/>' +
      '<path d="M-600 296H1880" stroke="#A8673A" stroke-width="3" opacity=".8"/>';
    GS.markup(g, s);
  }

  /* ================= state ================= */
  let tok = 0;                 // bumps on every level build; stale async work checks it
  let L = null;                // current level config
  let defs, layers = {};
  let pieces = [], friends = [], foods = [];
  let knives = 0, cutsMade = 0, tries = 0, busy = false;
  let pieceSeq = 0, foodSeq = 0;
  let btnGo = null, btnReset = null, knifeRack = null, steamG = null, guideG = null;
  let hintedDrag = false, guidesShown = false, solving = 0, artCache = {};
  const timers = new Set();
  function later(ms, fn) { const my = tok; const t = setTimeout(() => { timers.delete(t); if (my === tok) fn(); }, ms); timers.add(t); }
  async function pause(ms) { const my = tok; await GS.wait(ms); return my === tok; }
  function tw(ms, fn, ease) { const my = tok; return GS.tween(ms, (e, r) => { if (my === tok) fn(e, r); }, ease); }

  /* ================= levels ================= */
  const pickPeople = (n, fixed) => {
    const idx = fixed ? fixed.map(nm => NAMES.indexOf(nm)) : GS.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, n);
    return idx.map(i => ({ person: i, name: NAMES[i] }));
  };
  const F = (n, d) => ({ n, d, v: n / d });
  const WORD = { 2: 'setengah', 3: 'sepertiga', 4: 'seperempat', 5: 'seperlima', 6: 'seperenam', 8: 'seperdelapan' };
  const NUM = { 1: 'satu', 2: 'dua', 3: 'tiga', 4: 'empat', 5: 'lima', 6: 'enam', 7: 'tujuh', 8: 'delapan' };
  const fracWords = (n, d) => (n === 1 ? WORD[d] : NUM[n] + ' per ' + NUM[d]);
  const orderWords = o => o.words || fracWords(o.n, o.d);
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  /** An order written as a small sum on the card, e.g. 1/4 + 1/4 (k4). */
  const Ex = (a, op, b) => {
    const v = op === '+' ? a[0] / a[1] + b[0] / b[1] : a[0] / a[1] - b[0] / b[1];
    return { n: 0, d: 0, v, expr: [a, op, b], words: fracWords(a[0], a[1]) + (op === '+' ? ' tambah ' : ' kurang ') + fracWords(b[0], b[1]) };
  };
  const withOrders = (orders, fixedNames) => {
    if (fixedNames) {   // names keep their order, seats are shuffled
      const pairs = GS.shuffle(pickPeople(orders.length, fixedNames).map((q, k) => [q, orders[k]]));
      return { people: pairs.map(x => x[0]), orders: pairs.map(x => x[1]) };
    }
    return { people: pickPeople(orders.length), orders: GS.shuffle(orders.slice()) };
  };
  const diagWin = ps => (ps.some(list => list.some(p => p.poly.length === 3)) ? 'Potongan miring juga adil!' : 'Setengah dan setengah. Adil!');
  const shapeWin = ps => (new Set(ps.map(list => (list.length === 1 ? (list[0].bb.w / list[0].bb.h).toFixed(1) + list[0].poly.length : 'x'))).size > 1 ? 'Bentuknya beda, tetap seperempat!' : 'Seperempat semua. Adil!');

  /* Reusable level builders (parameterised); the tier tables below pick from them. */
  const LV = {
    // knives: what a careful child needs + 2 spare, so a wobbly cut never strands anyone
    cutEqual: (food, n, knives, say, win, extra) => Object.assign({ kind: 'cut', food, people: pickPeople(n), knives: knives + 2, say, win }, extra || {}),
    cutOrders: (food, orders, knives, say, win, extra) => Object.assign({ kind: 'cut', food, knives: knives + 2, labels: true, tagAfter: true, say, win: win || 'Pesanan pas semua. Hebat!' }, withOrders(orders, extra && extra.names), extra || {}),
    pick: () => {
      const p = pickPeople(2);
      return { kind: 'pick', people: p, orders: [F(1, 4), F(1, 4)], plateScale: 0.9, tagAfter: true, say: p[0].name + ' dan ' + p[1].name + ' minta seperempat. Pilih yang pas!', win: 'Bentuknya beda, sama-sama seperempat!' };
    },
    hungry: () => {
      const p = pickPeople(2), h = GS.rand(0, 1);
      return { kind: 'hungry', people: p, hungry: h, labels: true, say: p[h].name + ' lapar sekali. Setengah atau seperempat? Beri yang lebih besar!', win: 'Setengah lebih besar dari seperempat!' };
    },
    compare: pair => {
      const p = pickPeople(2), h = GS.rand(0, 1), pr = GS.shuffle(pair);
      const big = pr[0].v > pr[1].v ? pr[0] : pr[1], small = big === pr[0] ? pr[1] : pr[0];
      return { kind: 'hungry', pair: pr, people: p, hungry: h, plateScale: 0.8, say: p[h].name + ' lapar sekali. ' + cap(fracWords(pr[0].n, pr[0].d)) + ' atau ' + fracWords(pr[1].n, pr[1].d) + '?', win: cap(fracWords(big.n, big.d)) + ' lebih besar dari ' + fracWords(small.n, small.d) + '!' };
    },
    sort: ds => ({ kind: 'order', ds, people: pickPeople(ds.length), labels: true, plateScale: 0.9, say: ds.length > 3 ? 'Urutkan empat potongan dari yang terbesar.' : 'Urutkan teman dari potongan terbesar.' }),
    set: (count, orders, say, win, extra) => Object.assign({ kind: 'set', count, plateScale: 0.8, say, win }, orders ? withOrders(orders) : { people: pickPeople(2) }, extra || {}),
    match: () => {
      const p = pickPeople(2);
      return { kind: 'match', people: p, equalShares: true, tol: 0.12, plateScale: 0.9, say: p[1].name + ' mau sama besar dengan ' + p[0].name + '. Pilih yang pas!', win: 'Sama besar. Adil!' };
    }
  };
  const TK = { tol: 0.12 };
  const TIERS = {
    tk: [
      () => LV.cutEqual('martabak', 2, 2, 'Potong martabaknya untuk dua teman. Sama besar!', 'Sama besar. Semua senang!', TK),
      () => LV.cutEqual('roti', 2, 2, 'Sekarang roti. Potong jadi dua sama besar!', 'Dua bagian sama besar!', TK),
      () => LV.cutEqual('lapis', 2, 2, 'Kue lapis untuk dua teman. Potong ya!', diagWin, TK),
      () => LV.match(),
      () => LV.set(4, null, 'Ada empat klepon. Bagi sama banyak untuk dua teman!', 'Dua dan dua. Sama banyak!', { tol: 0.12, ballR: 36 }),
      () => LV.cutEqual(Math.random() < 0.5 ? 'martabak' : 'roti', 2, 1, 'Tantangan! Gesek pisaunya, bagi yang adil.', 'Hebat! Adil untuk berdua!', TK)
    ],
    k1: [
      () => LV.cutEqual('martabak', 2, 2, 'Potong martabak jadi dua. Sama besar ya!', 'Dua bagian sama besar. Setengah!'),
      () => LV.cutEqual('lapis', 2, 2, 'Potong kue lapis untuk dua teman.', diagWin),
      () => LV.cutEqual('martabak', 4, 3, 'Martabak untuk empat teman. Potong sama besar!', 'Empat bagian sama. Seperempat!'),
      () => LV.cutEqual('lapis', 4, 4, 'Kue lapis untuk empat teman. Bentuknya boleh beda!', shapeWin),
      () => LV.pick(),
      () => LV.hungry(),
      () => LV.cutOrders('roti', [F(1, 2), F(1, 2)], 2, 'Lihat kartu pesanan. Potong rotinya!', 'Setengah dan setengah. Pas!'),
      () => LV.cutOrders('martabak', [F(1, 4), F(1, 4), F(1, 4), F(1, 4)], 3, 'Tantangan! Empat teman, lihat kartu pesanan.', 'Seperempat semua. Hebat!')
    ],
    k2: [
      () => LV.cutEqual('lapis', 3, 3, 'Kue lapis untuk tiga teman. Potong dua kali.', 'Tiga bagian sama. Sepertiga!', { labels: true, tagAfter: true }),
      () => LV.sort(GS.shuffle([2, 3, 4])),
      () => LV.cutOrders('martabak', [F(1, 2), F(1, 4), F(1, 4)], 3, 'Lihat pesanan di kartu. Potong, lalu bagikan!', null, { names: ['Siti', 'Budi', 'Ani'] }),
      () => LV.cutEqual('lapis', 6, 4, 'Kue lapis untuk enam teman. Potong sama besar!', 'Enam bagian sama. Seperenam!', { labels: true, tagAfter: true }),
      () => LV.sort(GS.shuffle([2, 3, 4, 6])),
      () => { const n = [6, 8, 10][GS.rand(0, 2)]; const c = LV.set(n, [F(1, 2)], '', 'Setengah dari ' + n + ' adalah ' + n / 2 + '!'); c.say = c.people[0].name + ' minta setengah dari ' + n + ' klepon.'; return c; },
      () => (Math.random() < 0.5
        ? LV.cutOrders('martabak', [F(1, 2), F(1, 4), F(1, 4)], 3, 'Lihat kartu pesanan, lalu potong.')
        : LV.cutOrders('lapis', [F(1, 3), F(1, 3), F(1, 3)], 3, 'Lihat kartu pesanan, lalu potong.')),
      () => LV.cutOrders(Math.random() < 0.5 ? 'roti' : 'lapis', [F(1, 2), F(1, 4), F(1, 4)], 3, 'Tantangan! Baca kartu pesanan, lalu potong.')
    ],
    k3: [
      () => LV.cutOrders('martabak', [F(3, 4), F(1, 4)], 3, 'Ada pesanan tiga per empat. Potong, lalu bagikan!', 'Tiga per empat dan seperempat. Pas!'),
      () => Object.assign(LV.cutOrders('martabak', [F(1, 2), F(2, 4)], 3, 'Setengah dan dua per empat. Mana yang lebih banyak?', 'Dua per empat sama dengan setengah!'), { stackDemo: true, demoSay: 'Kita tumpuk. Sama besar!' }),
      () => LV.sort(GS.shuffle([3, 4, 5, 6, 8]).slice(0, 3)),
      r => (r === 0
        ? LV.cutEqual('lapis', 3, 3, 'Kue lapis untuk tiga teman.', '', { labels: true, tagAfter: true, rounds: 2 })
        : LV.cutEqual('lapis', 6, 4, 'Sekarang untuk enam teman. Kue lapisnya sama besar!', 'Makin banyak teman, makin kecil potongannya!', { labels: true, tagAfter: true, rounds: 2 })),
      () => LV.set(12, [F(1, 4), F(3, 4)], 'Ada 12 klepon. Lihat kartu pesanan!', 'Seperempat dari 12 adalah 3!'),
      () => LV.compare([F(2, 3), F(3, 4)]),
      () => LV.cutOrders('lapis', [F(2, 4), F(1, 4), F(1, 4)], 3, 'Lihat kartu pesanan, lalu potong.'),
      () => LV.cutOrders('lapis', [F(3, 6), F(2, 6), F(1, 6)], 4, 'Tantangan! Tiga pesanan berbeda.')
    ],
    k4: [
      () => Object.assign(LV.cutOrders('martabak', [F(1, 2), F(4, 8)], 4, 'Setengah dan empat per delapan. Potong ya!', 'Setengah sama dengan empat per delapan!'), { stackDemo: true, demoSay: 'Kita tumpuk. Sama besar!' }),
      () => Object.assign(LV.cutOrders('martabak', [Ex([1, 4], '+', [1, 4]), F(1, 2)], 3, 'Seperempat tambah seperempat itu berapa? Potong ya!', 'Seperempat tambah seperempat sama dengan setengah!'), { stackDemo: true, demoSay: 'Kita tumpuk. Sama besar!' }),
      () => LV.cutOrders('martabak', [Ex([3, 4], '-', [1, 4]), F(1, 4), F(1, 4)], 3, 'Hitung dulu pesanan di kartu, lalu potong.'),
      () => { const n = [9, 12][GS.rand(0, 1)]; return LV.set(n, [F(2, 3), F(1, 3)], 'Ada ' + n + ' klepon. Lihat kartu pesanan!', 'Dua per tiga dari ' + n + ' adalah ' + (2 * n / 3) + '!'); },
      () => LV.cutOrders('martabakKecil', [F(1, 2), F(1, 2), F(1, 2)], 2, 'Ada satu setengah martabak untuk tiga teman.', 'Masing-masing setengah. Pas!', { extraHalf: true, center: { x: 330, y: 560 } }),
      () => LV.compare([[F(2, 3), F(3, 5)], [F(3, 4), F(2, 3)], [F(3, 5), F(1, 2)], [F(5, 8), F(3, 4)], [F(2, 5), F(1, 3)]][GS.rand(0, 4)]),
      () => LV.cutOrders('lapis', [F(1, 2), F(1, 3), F(1, 6)], 4, 'Tiga pesanan berbeda. Potong yang pas!'),
      () => LV.cutOrders('roti', [Ex([3, 4], '-', [1, 2]), Ex([1, 4], '+', [1, 4]), F(1, 4)], 3, 'Tantangan! Hitung pesanan, lalu potong.')
    ]
  };
  function tierCount() { return (TIERS[TIER] || TIERS.k1).length; }
  function makeLevel(i, round) { return (TIERS[TIER] || TIERS.k1)[i](round || 0); }
  const hud = GS.hud({ gameId: GAME, title: 'Bagi Martabak', levelCount: tierCount(), onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: tierCount(), hud, start: i => buildLevel(i) });

  function seatXs(n) {
    return { 1: [640], 2: [430, 850], 3: [330, 640, 950], 4: [262, 514, 766, 1018], 6: [150, 346, 542, 738, 934, 1130] }[n];
  }

  /* ================= build ================= */
  let roundIdx = 0, keepTries = 0;
  function buildLevel(i, nextRound) {
    tok++; solving = 0;
    roundIdx = nextRound ? roundIdx + 1 : 0;
    timers.forEach(t => clearTimeout(t)); timers.clear();
    world.innerHTML = ''; friendsG.innerHTML = ''; dock.innerHTML = '';
    pieces = []; friends = []; foods = [];
    busy = false; tries = nextRound ? keepTries : 0; cutsMade = 0; hintedDrag = false; guidesShown = false;
    artCache = {};
    L = makeLevel(i, roundIdx);
    L.index = i;
    if (!L.plateScale) L.plateScale = 0.5;

    defs = GS.el('defs', null, world);
    layers.cards = GS.el('g', { class: 'mk-cards' }, world);
    layers.signs = GS.el('g', null, world);
    layers.plates = GS.el('g', { class: 'mk-plates' }, world);
    layers.board = GS.el('g', { class: 'mk-board' }, world);
    layers.zone = GS.el('g', null, world);
    layers.dim = GS.el('g', { 'pointer-events': 'none' }, world);
    layers.pieces = GS.el('g', { class: 'mk-pieces' }, world);
    layers.fx = GS.el('g', { class: 'mk-fx', 'pointer-events': 'none' }, world);
    layers.top = GS.el('g', null, world);

    buildFriends();
    if (L.kind === 'cut') buildCutLevel();
    else if (L.kind === 'pick') buildPickLevel();
    else if (L.kind === 'hungry') buildHungryLevel();
    else if (L.kind === 'set') buildSetLevel();
    else if (L.kind === 'match') buildMatchLevel();
    else buildOrderLevel();
    buildDock();
    updateButtons();
    hud.mood('think');
    GS.say(L.say);
  }

  function buildFriends() {
    const xs = seatXs(L.people.length);
    L.people.forEach((pp, k) => {
      const f = { k, name: pp.name, person: pp.person, order: L.orders ? L.orders[k] : null, x: xs[k] };
      f.el = GS.el('g', { transform: 'translate(' + f.x + ' ' + FRIEND_Y + ')' }, friendsG);
      f.tilt = GS.el('g', null, f.el);
      const br = GS.el('g', { class: 'mk-breathe d' + (k % 4) }, f.tilt);
      const body = GS.el('g', { transform: 'scale(1.7)' }, br);
      let art = '';
      try { art = hasArt('person') ? GS.art.person(pp.person) : ''; } catch (e) { art = ''; }
      GS.markup(body, art || fallbackPerson(pp.person));
      f.bubble = GS.el('g', { transform: 'translate(62 -150)', opacity: 0 }, f.el);
      // hanging card with the name (and the order from L6 on)
      f.card = GS.el('g', { transform: 'translate(' + f.x + ' 0)' }, layers.cards);
      drawCard(f);
      // plate
      f.plate = { x: f.x, y: PLATE_Y, pieces: [], friend: f };
      f.plate.el = GS.el('g', { class: 'mk-plate', transform: 'translate(' + f.x + ' ' + PLATE_Y + ')' }, layers.plates);
      GS.markup(L.people.length > 4 ? GS.el('g', { transform: 'scale(.9)' }, f.plate.el) : f.plate.el, plateMarkup());
      friends.push(f);
    });
  }
  function drawCard(f) {
    const sw = GS.el('g', { class: 'mk-card-swing' }, f.card);
    const hungryCard = L.kind === 'hungry';
    if (f.order || hungryCard) {
      const h = 150, w = Math.max(130, f.name.length * 18 + 30), y0 = 12;
      GS.markup(sw, '<path d="M-26 0L0 ' + y0 + 'L26 0" fill="none" stroke="#7E4A27" stroke-width="3"/>' +
        '<rect x="' + (-w / 2 + 4) + '" y="' + (y0 + 6) + '" width="' + w + '" height="' + h + '" rx="16" fill="' + OUT + '" opacity=".18"/>' +
        '<rect x="' + (-w / 2) + '" y="' + y0 + '" width="' + w + '" height="' + h + '" rx="16" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="3.5"/>' +
        '<circle cx="0" cy="' + (y0 + 10) + '" r="5" fill="#E2453C" stroke="' + OUT + '" stroke-width="2"/>');
      if (f.order && f.order.expr) {
        const [a, op, b] = f.order.expr;
        GS.markup(sw, '<rect x="' + (-w / 2 - 28) + '" y="' + y0 + '" width="' + (w + 56) + '" height="' + h + '" rx="16" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="3.5"/>' +
          '<circle cx="0" cy="' + (y0 + 10) + '" r="5" fill="#E2453C" stroke="' + OUT + '" stroke-width="2"/>' +
          '<g transform="translate(-50 ' + (y0 + 60) + ')">' + fracMarkup(a[0], a[1], 46, '#2B1D14') + '</g>' +
          '<text x="0" y="' + (y0 + 72) + '" text-anchor="middle" font-size="42" fill="#2B1D14" class="gs-num">' + (op === '+' ? '+' : '−') + '</text>' +
          '<g transform="translate(50 ' + (y0 + 60) + ')">' + fracMarkup(b[0], b[1], 46, '#2B1D14') + '</g>');
      } else if (f.order) GS.markup(sw, '<g transform="translate(0 ' + (y0 + 64) + ')">' + fracMarkup(f.order.n, f.order.d, 48, '#2B1D14') + '</g>');
      else {
        const hungry = f.k === L.hungry;
        GS.markup(sw, '<g transform="translate(0 ' + (y0 + 76) + ') scale(1.15)">' + faceMarkup(hungry ? 'hungry' : 'happy') + '</g>' +
          '<text class="mk-name" x="0" y="' + (y0 + 138) + '" text-anchor="middle" font-size="34" fill="#2B1D14">' + (hungry ? 'lapar!' : 'sedikit') + '</text>');
      }
      const t = GS.el('text', { class: 'mk-name', x: 0, y: y0 + h - 12, 'text-anchor': 'middle', 'font-size': 34, fill: '#2B1D14' }, sw);
      t.textContent = f.name;
      if (!f.order) t.setAttribute('y', y0 + 36);
    } else {
      const w = Math.max(110, f.name.length * 19 + 36), y0 = 102;
      GS.markup(sw, '<path d="M0 0V' + y0 + '" stroke="#7E4A27" stroke-width="3"/>' +
        '<rect x="' + (-w / 2 + 3) + '" y="' + (y0 + 5) + '" width="' + w + '" height="58" rx="16" fill="' + OUT + '" opacity=".18"/>' +
        '<rect x="' + (-w / 2) + '" y="' + y0 + '" width="' + w + '" height="58" rx="16" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="3.5"/>');
      const t = GS.el('text', { class: 'mk-name', x: 0, y: y0 + 41, 'text-anchor': 'middle', 'font-size': 34, fill: '#2B1D14' }, sw);
      t.textContent = f.name;
    }
  }

  function boardCenter() { return { x: 470, y: 574 }; }   // a bit left of centre: the dock sits bottom-right on phones

  function drawLoyang(c, k) {
    const g = GS.el('g', { transform: 'translate(' + c.x + ' ' + c.y + ') scale(' + (k || 1) + ')' }, layers.board);
    let s = '<circle cx="9" cy="12" r="174" fill="' + OUT + '" opacity=".18"/>';
    [-1, 1].forEach(sd => {
      s += '<rect x="' + (sd > 0 ? 158 : -202) + '" y="-15" width="44" height="30" rx="13" fill="#5C6169" stroke="' + OUT + '" stroke-width="4"/>' +
        '<rect x="' + (sd > 0 ? 172 : -194) + '" y="-6" width="22" height="12" rx="6" fill="#C68A55" stroke="' + OUT + '" stroke-width="2.5"/>';
    });
    s += '<circle r="170" fill="#4A4E55" stroke="' + OUT + '" stroke-width="4"/>' +
      '<path d="M-150 -60A162 162 0 0 1 -40 -157" fill="none" stroke="#858B94" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M140 80A162 162 0 0 1 40 157" fill="none" stroke="#33363B" stroke-width="7" stroke-linecap="round" opacity=".8"/>' +
      '<circle r="156" fill="#5C6169" stroke="#3A3D43" stroke-width="2.5"/>' +
      '<ellipse cx="-50" cy="-60" rx="70" ry="40" fill="#6C727A" opacity=".55" transform="rotate(-35 -50 -60)"/>';
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2 + Math.PI / 8; s += '<circle cx="' + (163 * Math.cos(t)).toFixed(1) + '" cy="' + (163 * Math.sin(t)).toFixed(1) + '" r="3.2" fill="#A3A8AE"/>'; }
    GS.markup(g, s);
    return g;
  }
  function drawTalenan(c, w, h, leaf) {
    const g = GS.el('g', { transform: 'translate(' + c.x + ' ' + c.y + ')' }, layers.board);
    let s = '<rect x="' + (-w / 2 + 10) + '" y="' + (-h / 2 + 12) + '" width="' + (w + 60) + '" height="' + h + '" rx="34" fill="' + OUT + '" opacity=".18"/>' +
      '<rect x="' + (w / 2 - 20) + '" y="-34" width="80" height="68" rx="30" fill="#E2B07A" stroke="' + OUT + '" stroke-width="4"/>' +
      '<circle cx="' + (w / 2 + 34) + '" cy="0" r="11" fill="#C68A55" stroke="' + OUT + '" stroke-width="3"/>' +
      '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="34" fill="#E2B07A" stroke="' + OUT + '" stroke-width="4"/>' +
      '<rect x="' + (-w / 2 + 12) + '" y="' + (-h / 2 + 10) + '" width="' + (w * 0.55) + '" height="' + (h * 0.4) + '" rx="26" fill="#EEC796" opacity=".8"/>' +
      '<path d="M' + (w / 2 - 30) + ' ' + (-h / 2 + 40) + 'V' + (h / 2 - 30) + 'Q' + (w / 2 - 34) + ' ' + (h / 2 - 12) + ' ' + (w / 2 - 70) + ' ' + (h / 2 - 12) + '" fill="none" stroke="#C98F55" stroke-width="10" stroke-linecap="round" opacity=".7"/>';
    const R = rng(w + h);
    for (let k = 0; k < 9; k++) {
      const y = -h / 2 + 24 + R() * (h - 48), x = -w / 2 + 30 + R() * (w * 0.5), len = 80 + R() * (w * 0.35);
      s += '<path d="M' + x.toFixed(0) + ' ' + y.toFixed(0) + 'q' + (len / 2).toFixed(0) + ' -6 ' + len.toFixed(0) + ' 0" fill="none" stroke="#C98F55" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>';
    }
    if (leaf) {
      const lw = leaf.w, lh = leaf.h;
      s += '<path d="M' + (-lw / 2) + ' ' + (-lh / 2 + 16) + 'Q' + (-lw / 2) + ' ' + (-lh / 2) + ' ' + (-lw / 2 + 18) + ' ' + (-lh / 2) + 'H' + (lw / 2 - 18) + 'Q' + (lw / 2) + ' ' + (-lh / 2) + ' ' + (lw / 2) + ' ' + (-lh / 2 + 16) + 'V' + (lh / 2 - 16) + 'Q' + (lw / 2) + ' ' + (lh / 2) + ' ' + (lw / 2 - 18) + ' ' + (lh / 2) + 'H' + (-lw / 2 + 18) + 'Q' + (-lw / 2) + ' ' + (lh / 2) + ' ' + (-lw / 2) + ' ' + (lh / 2 - 16) + 'z" fill="#4DAA57" stroke="' + OUT + '" stroke-width="3.5"/>' +
        '<rect x="' + (-lw / 2 + 8) + '" y="' + (-lh / 2 + 7) + '" width="' + (lw * 0.6) + '" height="' + (lh * 0.35) + '" rx="14" fill="#86CC8C" opacity=".55"/>' +
        '<path d="M' + (-lw / 2 + 6) + ' 0H' + (lw / 2 - 6) + '" stroke="#357F40" stroke-width="4"/>';
      for (let k = -5; k <= 5; k++) s += '<path d="M' + (k * lw / 12) + ' 0l' + (lw / 16) + ' ' + (-lh / 2 + 8) + 'M' + (k * lw / 12) + ' 0l' + (lw / 16) + ' ' + (lh / 2 - 8) + '" stroke="#357F40" stroke-width="2" opacity=".6"/>';
    }
    GS.markup(g, s);
    return g;
  }
  function drawSteam(c) {
    steamG = GS.el('g', { class: 'mk-steam', transform: 'translate(' + c.x + ' ' + (c.y - 60) + ')' }, layers.fx);
    GS.markup(steamG, [-55, 0, 55].map(x => '<path d="M' + x + ' 0q-14 -22 0 -44q14 -22 0 -44" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round"/>').join(''));
  }
  function updateSteam() {
    if (!steamG) return;
    const any = pieces.some(p => !p.plate && p.food.def.shape === 'circle');
    steamG.style.display = any ? '' : 'none';
  }

  function makeFood(type, ox, oy, over) {
    const def = over ? Object.assign({}, FOOD[type], over) : FOOD[type];
    const f = { id: ++foodSeq, type, def, ox, oy, poly: foodPoly(def) };
    f.area = Geo.absArea(f.poly);
    foods.push(f);
    if (def.shape === 'ball' && artCache['ball' + def.r]) { f.artId = artCache['ball' + def.r]; return f; }
    f.artId = 'mkart' + f.id;
    const g = GS.el('g', { id: f.artId }, defs);
    const seed = (Math.random() * 1e9) | 0;
    if (def.shape === 'ball') { GS.markup(g, kleponArt(def.r)); artCache['ball' + def.r] = f.artId; return f; }
    if (def.shape === 'circle') GS.markup(g, martabakArt(def.r, seed));
    else if (def.shape === 'rect') GS.markup(g, lapisArt(def.w, def.h, def.layers));
    else GS.markup(g, rotiArt(def.w, def.h, def.rr, seed, f.id));
    return f;
  }

  /* ================= pieces ================= */
  let gest = null;
  function makePiece(food, poly, pos, sector) {
    const c = Geo.centroid(poly);
    const p = {
      id: ++pieceSeq, food, poly, c, bb: Geo.bbox(poly), area: Geo.absArea(poly),
      pos: pos || { x: food.ox + c.x, y: food.oy + c.y }, rot: 0, s: 1, sx: 1, sy: 1, lift: 1,
      plate: null, locked: false, tagD: 0, sector: sector || null
    };
    const cp = GS.el('clipPath', { id: 'mkc' + p.id }, defs);
    GS.el('polygon', { points: pts(poly) }, cp);
    p.cp = cp;
    const g = GS.el('g', { class: 'mk-piece', style: 'cursor:grab' }, layers.pieces);
    p.el = g;
    p.shadow = GS.el('polygon', { points: pts(poly), fill: OUT, opacity: 0.18, transform: 'translate(5 8)', 'pointer-events': 'none' }, g);
    const art = GS.el('g', { 'clip-path': 'url(#mkc' + p.id + ')' }, g);
    const use = GS.el('use', { href: '#' + food.artId }, art);
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + food.artId);
    drawCutEdges(p, art);
    GS.el('polygon', { points: pts(poly), fill: 'none', stroke: OUT, 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'pointer-events': 'none' }, g);
    p.hit = GS.el('rect', { fill: '#000', 'fill-opacity': 0 }, g);
    p.hitSmall = p.bb.w < 112 || p.bb.h < 112;
    setHit(p);
    GS.drag(g, {
      svg,
      // On the board a quick flick that starts on the food is a knife swipe (Fruit Ninja style);
      // a press-and-move is a drag. A fast flick that ends on a plate is a drag too.
      onStart: pt => {
        if (busy || p.locked || L.kind === 'order') return false;
        if (L.kind === 'cut' && !p.plate && knives > 0 && p.food.def.shape !== 'ball') { layers.pieces.appendChild(p.el); gest = { p, t0: performance.now(), a: pt, mode: 'pending' }; return; }
        gest = { p, mode: 'drag' }; startDrag(p, pt);
      },
      onMove: pt => {
        if (!gest || gest.p !== p) return;
        if (gest.mode === 'pending') {
          const d = Math.hypot(pt.x - gest.a.x, pt.y - gest.a.y), dt = performance.now() - gest.t0;
          if (d > 26 && dt < 120) { gest.mode = 'swipe'; swipeStart(gest.a); swipeMove(pt); }
          else if ((d > 10 && dt >= 120) || dt > 280) { gest.mode = 'drag'; startDrag(p, gest.a); moveDrag(p, pt); }
          return;
        }
        if (gest.mode === 'swipe') swipeMove(pt); else moveDrag(p, pt);
      },
      onEnd: pt => {
        if (!gest || gest.p !== p) return;
        const m = gest.mode; gest = null;
        if (m === 'drag') return endDrag(p, pt);
        if (m !== 'swipe') return;
        const pl = plateAt({ x: pt.x, y: pt.y - LIFT });
        if (swipeEnd(pt, !!pl) || !pl || p.plate || !pieces.includes(p)) return;
        putOnPlate(p, pl); GS.sfx.drop(); squash(p); updateButtons(); updateSteam();
      }
    });
    pieces.push(p);
    applyT(p);
    return p;
  }
  function drawCutEdges(p, parent) {
    const poly = p.poly, n = poly.length;
    const sh = p.food.def.shape;
    let d = '', dh = '';
    for (let i = 0; i < n; i++) {
      if (!poly[i].cut) continue;
      const a = poly[i], b = poly[(i + 1) % n];
      d += 'M' + a.x.toFixed(2) + ' ' + a.y.toFixed(2) + 'L' + b.x.toFixed(2) + ' ' + b.y.toFixed(2);
      // inward normal: toward the centroid
      let nx = -(b.y - a.y), ny = b.x - a.x; const ln = Math.hypot(nx, ny) || 1; nx /= ln; ny /= ln;
      if ((p.c.x - a.x) * nx + (p.c.y - a.y) * ny < 0) { nx = -nx; ny = -ny; }
      dh += 'M' + (a.x + nx * 4).toFixed(2) + ' ' + (a.y + ny * 4).toFixed(2) + 'L' + (b.x + nx * 4).toFixed(2) + ' ' + (b.y + ny * 4).toFixed(2);
    }
    if (!d) return;
    if (sh === 'circle') {
      GS.el('path', { d, stroke: '#F7D98C', 'stroke-width': 18, fill: 'none' }, parent);
      GS.el('path', { d: dh, stroke: '#D59A3F', 'stroke-width': 3.5, 'stroke-dasharray': '1.5 7', 'stroke-linecap': 'round', fill: 'none' }, parent);
    } else if (sh === 'round') {
      GS.el('path', { d, stroke: '#FBE3A6', 'stroke-width': 16, fill: 'none' }, parent);
      GS.el('path', { d: dh, stroke: '#E0B860', 'stroke-width': 3, 'stroke-dasharray': '1.5 8', 'stroke-linecap': 'round', fill: 'none' }, parent);
    } else {
      GS.el('path', { d, stroke: OUT, 'stroke-opacity': 0.16, 'stroke-width': 12, fill: 'none' }, parent);
    }
  }
  /** Invisible grab area: >= 72 world units on the board (thin pieces only, so it never
   *  swallows the start of a knife stroke) and >= 84 world units on a plate. */
  function setHit(p) {
    const bb = p.bb, on = !!p.plate, need = on ? 112 / L.plateScale : 112;
    const hw = Math.max(bb.w + (on ? 20 : 0), need), hh = Math.max(bb.h + (on ? 20 : 0), need);
    p.hit.setAttribute('x', (bb.cx - hw / 2).toFixed(1)); p.hit.setAttribute('y', (bb.cy - hh / 2).toFixed(1));
    p.hit.setAttribute('width', hw.toFixed(1)); p.hit.setAttribute('height', hh.toFixed(1));
    p.hit.style.pointerEvents = (on || p.hitSmall) ? 'all' : 'none';
  }
  function removePiece(p) {
    p.el.remove(); p.cp.remove();
    pieces = pieces.filter(q => q !== p);
    if (p.plate) p.plate.pieces = p.plate.pieces.filter(q => q !== p);
  }
  function applyT(p) {
    const s = p.s * p.lift;
    p.el.setAttribute('transform', 'translate(' + p.pos.x.toFixed(2) + ' ' + p.pos.y.toFixed(2) + ') rotate(' + p.rot.toFixed(2) + ') scale(' + (s * p.sx).toFixed(4) + ' ' + (s * p.sy).toFixed(4) + ') translate(' + (-p.c.x).toFixed(2) + ' ' + (-p.c.y).toFixed(2) + ')');
    if (p.tag) {
      // tags stay readable (>= 36 u digits); only locked reference pieces may shrink them
      const thin = Math.min(p.bb.w, p.bb.h) * s;
      const k = GS.clamp(thin / 70, p.locked ? 0.6 : 0.92, 1) / Math.max(0.2, s);
      p.tag.setAttribute('transform', 'translate(' + p.c.x.toFixed(2) + ' ' + p.c.y.toFixed(2) + ') rotate(' + (-p.rot).toFixed(2) + ') scale(' + k.toFixed(3) + ')');
    }
  }
  /** World position of a local (food-frame) point of piece p. */
  function toWorld(p, q) {
    const s = p.s * p.lift, v = Geo.rot({ x: (q.x - p.c.x) * s, y: (q.y - p.c.y) * s }, p.rot);
    return { x: p.pos.x + v.x, y: p.pos.y + v.y };
  }
  function toLocal(p, w) {
    const s = p.s * p.lift, v = Geo.rot({ x: w.x - p.pos.x, y: w.y - p.pos.y }, -p.rot);
    return { x: v.x / s + p.c.x, y: v.y / s + p.c.y };
  }
  /** pos that puts the bbox centre of p at world point t (at the current scale/rotation). */
  function posForCenter(p, t) {
    const s = p.s * p.lift, v = Geo.rot({ x: (p.bb.cx - p.c.x) * s, y: (p.bb.cy - p.c.y) * s }, p.rot);
    return { x: t.x - v.x, y: t.y - v.y };
  }
  function centerOf(p) { return toWorld(p, { x: p.bb.cx, y: p.bb.cy }); }
  function fracOf(p) {
    const unit = L.unit;
    if (p.food.def.shape === 'ball') return 0;
    for (const d of [2, 3, 4, 5, 6, 8]) if (Math.abs((p.area / unit) * d - 1) <= TOL) return d;
    return 0;
  }
  function setTag(p, d, n) {
    if (p.tag) { p.tag.remove(); p.tag = null; }
    p.tagD = d ? (n > 1 ? -1 : d) : 0;
    if (!d) return;
    p.tag = GS.el('g', { 'pointer-events': 'none', 'data-qc': p.locked ? 'decor' : null }, p.el);
    const inner = GS.el('g', null, p.tag);
    GS.markup(inner, tagMarkup(d, n));
    applyT(p);
    tw(320, e => inner.setAttribute('transform', 'scale(' + e.toFixed(3) + ')'), 'outBack');
  }
  function refreshTags() { if (!L.labels) return; pieces.forEach(p => { if (p.tagD < 0) return; const d = fracOf(p); if (d !== p.tagD) setTag(p, d); }); }

  /* ================= dragging pieces ================= */
  let drag = null;
  function scaleAt(y) { const k = GS.clamp((y - (PLATE_Y + 30)) / 170, 0, 1); return GS.lerp(L.plateScale, 1, k); }
  function startDrag(p, pt) {
    const from = { pos: { ...p.pos }, s: p.s, plate: p.plate };
    if (p.plate) { const pl = p.plate; pl.pieces = pl.pieces.filter(q => q !== p); p.plate = null; layoutPlate(pl, true); setHit(p); }
    drag = { p, from };
    if (layers.pieces.lastChild !== p.el) layers.pieces.appendChild(p.el);   // (moving a captured element would drop the pointer capture)
    p.el.style.cursor = 'grabbing';
    GS.sfx.pick();
    const r0 = p.rot;
    tw(120, e => { p.lift = 1 + 0.15 * e; p.rot = r0 * (1 - e); p.shadow.setAttribute('transform', 'translate(' + (5 + 9 * e).toFixed(1) + ' ' + (8 + 14 * e).toFixed(1) + ')'); moveDrag(p, pt); }, 'outBack');
    moveDrag(p, pt);
  }
  function moveDrag(p, pt) {
    if (!drag || drag.p !== p) return;
    drag.last = pt;
    const t = { x: pt.x, y: pt.y - LIFT };
    p.s = scaleAt(t.y);
    p.pos = posForCenter(p, t);
    applyT(p);
    const pl = plateAt(t);
    friends.forEach(f => f.plate.el.classList.toggle('hot', f.plate === pl));
  }
  function endDrag(p, pt) {
    if (!drag || drag.p !== p) return;
    const from = drag.from; drag = null;
    p.el.style.cursor = 'grab';
    friends.forEach(f => f.plate.el.classList.remove('hot'));
    const t = { x: pt.x, y: pt.y - LIFT };
    const pl = plateAt(t);
    const settle = () => tw(140, e => { p.lift = 1.15 - 0.15 * e; p.shadow.setAttribute('transform', 'translate(' + (14 - 9 * e).toFixed(1) + ' ' + (22 - 14 * e).toFixed(1) + ')'); applyT(p); });
    if (pl) {
      putOnPlate(p, pl); settle(); GS.sfx.drop(); squash(p);
      if (pl.friend) bounceFriend(pl.friend, 6);
    } else if (inBoard(t)) {
      p.plate = null;
      const tc = { x: GS.clamp(t.x, 150, 1130), y: GS.clamp(t.y, 450, 760) };
      const s0 = p.s, c0 = centerOf(p);
      settle();
      tw(160, e => { p.s = GS.lerp(s0, 1, e); p.pos = posForCenter(p, { x: GS.lerp(c0.x, tc.x, e), y: GS.lerp(c0.y, tc.y, e) }); applyT(p); });
      GS.sfx.drop(); squash(p);
    } else {
      // back where it came from
      settle();
      if (from.plate) putOnPlate(p, from.plate);
      else { const s0 = p.s, p0 = { ...p.pos }; tw(220, e => { p.s = GS.lerp(s0, 1, e); p.pos = { x: GS.lerp(p0.x, from.pos.x, e), y: GS.lerp(p0.y, from.pos.y, e) }; applyT(p); }); }
      GS.sfx.tick();
    }
    setHit(p);
    updateButtons(); updateSteam();
  }
  function squash(p) {
    tw(300, (e, r) => {
      // 1.2 x 0.85 -> 0.92 x 1.08 -> 1
      let sx, sy;
      if (r < 0.33) { const k = r / 0.33; sx = GS.lerp(1, 1.2, k); sy = GS.lerp(1, 0.85, k); }
      else if (r < 0.66) { const k = (r - 0.33) / 0.33; sx = GS.lerp(1.2, 0.92, k); sy = GS.lerp(0.85, 1.08, k); }
      else { const k = (r - 0.66) / 0.34; sx = GS.lerp(0.92, 1, k); sy = GS.lerp(1.08, 1, k); }
      p.sx = sx; p.sy = sy; applyT(p);
    }, 'linear');
  }
  function plateAt(t) {
    let best = null, bd = Infinity;
    for (const f of friends) {
      const pl = f.plate, dx = Math.abs(t.x - pl.x), dy = t.y - pl.y;
      if (dx < 125 && dy > -130 && dy < 75) { const d = dx + Math.abs(dy); if (d < bd) { bd = d; best = pl; } }
    }
    return best;
  }
  function inBoard(t) { return t.y > 440 && t.x > 110 && t.x < 1170; }
  function putOnPlate(p, pl) {
    p.plate = pl;
    if (!pl.pieces.includes(p)) pl.pieces.push(p);
    layoutPlate(pl, true);
    setHit(p);
  }
  function layoutPlate(pl, animate) {
    const k = pl.pieces.length;
    const balls = k && pl.pieces.every(p => p.food.def.shape === 'ball');
    const cols = k <= 3 ? k : k <= 6 ? 3 : 4, rows = Math.ceil(k / Math.max(1, cols));
    pl.pieces.forEach((p, i) => {
      const spread = k > 1 ? Math.min(64, 150 / (k - 1)) : 0;
      const t = balls
        ? { x: pl.x + ((i % cols) - (cols - 1) / 2) * 38 + (Math.floor(i / cols) % 2 ? 10 : 0), y: pl.y - 10 + (Math.floor(i / cols) - (rows - 1) / 2) * 17 }
        : { x: pl.x + (i - (k - 1) / 2) * spread, y: pl.y - 12 + (k > 1 ? (i % 2 ? 7 : -5) : 0) };
      // tall pieces lie down on the plate (rotation never changes area)
      const r1 = p.bb.h > p.bb.w * 1.3 ? 90 : 0;
      const s0 = p.s, r0 = p.rot, c0 = centerOf(p);
      const end = () => { p.s = L.plateScale; p.rot = r1; p.pos = posForCenter(p, t); applyT(p); };
      if (!animate) { end(); return; }
      tw(170, e => {
        p.s = GS.lerp(s0, L.plateScale, e); p.rot = GS.lerp(r0, r1, e);
        p.pos = posForCenter(p, { x: GS.lerp(c0.x, t.x, e), y: GS.lerp(c0.y, t.y, e) }); applyT(p);
      }).then(() => { if (p.plate === pl) end(); });
    });
  }

  /* ================= cutting: swipe like Fruit Ninja ================= */
  function freshPieces() {
    const food = L.foodRef;
    makePiece(food, food.poly.map(q => ({ x: q.x, y: q.y, cut: false })));
    if (L.extraFood) {
      // the "½" of 1½ martabak: one half already cut (k4)
      const ef = L.extraFood;
      makePiece(ef, sectorPoly(ef.def.r, 90, 270), null, { a0: 90, a1: 270 });
    }
  }
  function buildCutLevel() {
    const c = L.center || boardCenter();
    const def = FOOD[L.food];
    if (def.shape === 'circle') { drawLoyang(c, def.r / 145); }
    else drawTalenan(c, def.w + 100, def.h + 84, def.shape === 'rect' ? { w: def.w + 34, h: def.h + 30 } : null);
    guideG = GS.el('g', { opacity: GUIDE_OPACITY, 'pointer-events': 'none' }, layers.board);
    const food = makeFood(L.food, c.x, c.y);
    L.unit = food.area;
    L.foodRef = food;
    if (L.extraHalf) { const c2 = { x: 690, y: c.y }; drawLoyang(c2, def.r / 145); L.extraFood = makeFood(L.food, c2.x, c2.y); }
    drawGuides();
    freshPieces();
    if (def.shape === 'circle') drawSteam(c);
    knives = L.knives;
    drawKnifeRack();
    // the cutting surface: a swipe can start anywhere
    const zone = GS.el('rect', { x: -600, y: 318, width: 2480, height: 520, fill: '#000', 'fill-opacity': 0 }, layers.zone);
    zone.style.cursor = 'crosshair';
    swipe = null;
    GS.drag(zone, {
      svg,
      onStart: pt => {
        if (busy) return false;
        if (knives <= 0) { GS.sfx.oops(); hud.mood('think'); GS.say('Pisaunya habis. Mau potong lagi? Tekan Ulang.'); wobbleEl(knifeRack); nudgeReset(); return false; }
        swipeStart(pt);
      },
      onMove: pt => swipeMove(pt),
      onEnd: pt => swipeEnd(pt)
    });
  }
  /** Rim ticks (every 30 degrees) and a centre dot for round food; dots at equal divisions on
   *  rectangle sides. Full in TK to Kelas 2, faint in Kelas 3, none in Kelas 4 (concreteness fading). */
  function drawGuides() {
    const food = L.foodRef, def = food.def, c = { x: food.ox, y: food.oy };
    let s = '';
    const dot = (x, y, r) => '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="#FFC83D" stroke="' + OUT + '" stroke-width="3"/>';
    if (def.shape === 'circle') {
      for (let k = 0; k < 12; k++) { const t = k * Math.PI / 6; s += dot(c.x + Math.cos(t) * (def.r + 17), c.y + Math.sin(t) * (def.r + 17), k % 3 ? 6 : 9); }
    } else {
      const hw = def.w / 2, hh = def.h / 2;
      lineFractions().filter(f => YOUNG || [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4].some(g => Math.abs(g - f) < 1e-9)).forEach(f => {
        const r = Math.abs(f - 0.5) < 1e-9 ? 9 : 6;
        s += dot(c.x - hw - 22, c.y - hh + def.h * f, r) + dot(c.x + hw + 22, c.y - hh + def.h * f, r) +
          dot(c.x - hw + def.w * f, c.y - hh - 22, r) + dot(c.x - hw + def.w * f, c.y + hh + 22, r);
      });
    }
    GS.markup(guideG, s);
    if (def.shape === 'circle') {
      centreMark = GS.el('g', { opacity: GUIDE_OPACITY, 'pointer-events': 'none' }, layers.fx);
      GS.markup(centreMark, '<circle cx="' + c.x + '" cy="' + c.y + '" r="9" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="3"/>');
    }
  }
  let swipe = null, trailG = null, centreMark = null;
  function swipeStart(a) {
    swipe = { a, b: a, pts: [{ x: a.x, y: a.y, t: performance.now() }] };
    if (!trailG || !trailG.parentNode) trailG = GS.el('g', null, layers.fx);
    trailG.setAttribute('opacity', 1);
    drawTrail();
  }
  function swipeMove(pt) {
    if (!swipe) return;
    swipe.b = pt;
    const now = performance.now();
    swipe.pts.push({ x: pt.x, y: pt.y, t: now });
    swipe.pts = swipe.pts.filter((q, i) => i === swipe.pts.length - 1 || now - q.t < 240);
    drawTrail();
  }
  function drawTrail() {
    trailG.innerHTML = '';
    const P = swipe.pts, b = swipe.b;
    if (P.length > 1) {
      const d = P.map(q => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ');
      GS.el('polyline', { points: d, fill: 'none', stroke: '#FFE08A', 'stroke-width': 26, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.45 }, trailG);
      GS.el('polyline', { points: d, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.95 }, trailG);
    }
    const prev = P.length > 1 ? P[Math.max(0, P.length - 3)] : swipe.a;
    const ang = Math.atan2(b.y - prev.y, b.x - prev.x) * 180 / Math.PI || 0;
    const flip = Math.cos(ang * Math.PI / 180) < 0 ? ' scale(1 -1)' : '';
    GS.markup(GS.el('g', { transform: 'translate(' + b.x.toFixed(1) + ' ' + b.y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')' + flip }, trailG), knifeMarkup());
  }
  function swipeCancel() { swipe = null; if (trailG) trailG.innerHTML = ''; }
  function swipeEnd(pt, quiet) {
    if (!swipe) return false;
    swipe.b = pt;
    const a = swipe.a;
    const g = trailG;
    tw(200, e => g.setAttribute('opacity', (1 - e).toFixed(2))).then(() => { if (!swipe) g.innerHTML = ''; });
    swipe = null;
    return performSwipe(a, pt, quiet);
  }
  const hyp = v => Math.hypot(v.x, v.y);
  function segDist(a, b) {   // distance from the origin to segment a-b
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
    const t = GS.clamp(-(a.x * dx + a.y * dy) / L2, 0, 1);
    return Math.hypot(a.x + dx * t, a.y + dy * t);
  }
  const snapDeg = x => Math.round(x / SNAP.deg) * SNAP.deg;
  const angOf = v => Math.atan2(v.y, v.x) * 180 / Math.PI;
  /** Round food: radius (from or to the centre) or diameter (through the centre). */
  function roundGesture(p, A, B) {
    const a = toLocal(p, A), b = toLocal(p, B), r = p.food.def.r, Rc = Math.min(SNAP.centre, r * 0.6);
    const da = hyp(a), db = hyp(b);
    if (da <= Rc && db >= 0.75 * r) return [snapDeg(angOf(b))];
    if (db <= Rc && da >= 0.75 * r) return [snapDeg(angOf(a))];
    if (da > Rc && db > Rc && segDist(a, b) <= Rc && Math.hypot(b.x - a.x, b.y - a.y) >= 0.9 * r) {
      const th = snapDeg(angOf({ x: b.x - a.x, y: b.y - a.y }));
      return [th, th + 180];
    }
    return null;
  }
  /** Straight food: the swipe must pass over the piece; the snapped line splits it. */
  function lineGesture(p, A, B) {
    const a = toLocal(p, A), b = toLocal(p, B), len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 70) return null;
    const ch = Geo.chord(p.poly, a, b);
    if (!ch || ch[1] <= 0 || ch[0] >= 1 || (Math.min(ch[1], 1) - Math.max(ch[0], 0)) * len < 20) return null;
    const sn = snapRect(p.food.def, a, b);
    const parts = Geo.split(p.poly, sn.a, sn.b);
    if (!parts[0] || !parts[1] || Math.min(Geo.absArea(parts[0]), Geo.absArea(parts[1])) < 0.01 * p.food.area) return null;
    return { p, parts, la: sn.a, lb: sn.b };
  }
  function performSwipe(A, B, quiet) {
    if (Math.hypot(B.x - A.x, B.y - A.y) < 40) return false;
    const board = pieces.filter(p => !p.plate && !p.locked && p.food.def.shape !== 'ball');
    const roundJobs = [], lineJobs = [];
    for (const p of board) {
      if (p.food.def.shape === 'circle') {
        const rays = roundGesture(p, A, B);
        if (!rays) continue;
        let list = [p.sector];
        for (const th of rays) list = [].concat(...list.map(sec => raySplit(sec, th) || [sec]));
        if (list.length === 1 && list[0] === p.sector) continue;
        roundJobs.push({ p, list, rays });
      } else { const h = lineGesture(p, A, B); if (h) lineJobs.push(h); }
    }
    if (!roundJobs.length && !lineJobs.length) {
      if (quiet) return false;
      GS.sfx.tick(); hud.mood('think');
      GS.say(board.some(p => p.food.def.shape === 'circle') ? 'Gesek pisaunya lewat tengah martabak, ya.' : 'Gesek pisaunya melewati kuenya, ya.');
      return false;
    }
    knives--; cutsMade++;
    updateKnives();
    GS.sfx.whoosh();
    const flash = (x1, y1, x2, y2) => {
      const f = GS.el('line', { x1, y1, x2, y2, stroke: '#fff', 'stroke-width': 9, 'stroke-linecap': 'round', opacity: 0.95 }, layers.fx);
      tw(380, e => { f.setAttribute('opacity', (0.95 * (1 - e)).toFixed(3)); f.setAttribute('stroke-width', (9 * (1 - e) + 1).toFixed(2)); }).then(() => f.remove());
    };
    for (const j of roundJobs) {
      const p = j.p, r = p.food.def.r, O = toWorld(p, { x: 0, y: 0 });
      j.rays.forEach(th => { const t = th * Math.PI / 180; flash(O.x, O.y, O.x + Math.cos(t) * (r + 24), O.y + Math.sin(t) * (r + 24)); });
      removePiece(p);
      j.list.forEach(sec => {
        const poly = sectorPoly(r, sec.a0, sec.a1), c2 = Geo.centroid(poly);
        const np = makePiece(p.food, poly, { x: p.pos.x + (c2.x - p.c.x), y: p.pos.y + (c2.y - p.c.y) }, sec);
        if (sec.a1 - sec.a0 >= 359.9) return;            // a slit: nothing moves yet
        const mid = (sec.a0 + sec.a1) / 2 * Math.PI / 180, p0 = { ...np.pos };
        tw(420, e => { np.pos = { x: p0.x + Math.cos(mid) * GAP * e, y: p0.y + Math.sin(mid) * GAP * e }; applyT(np); }, 'outBack');
        const cw = toWorld(np, np.c); crumbs(cw.x, cw.y, 5);
      });
    }
    for (const h of lineJobs) {
      const p = h.p;
      const fa = toWorld(p, h.la), fb = toWorld(p, h.lb), dx = fb.x - fa.x, dy = fb.y - fa.y, ln = Math.hypot(dx, dy) || 1, ext = 260;
      flash(fa.x - dx / ln * ext, fa.y - dy / ln * ext, fb.x + dx / ln * ext, fb.y + dy / ln * ext);
      const n = { x: -(h.lb.y - h.la.y) / ln, y: (h.lb.x - h.la.x) / ln };
      removePiece(p);
      h.parts.forEach(part => {
        const c2 = Geo.centroid(part);
        const np = makePiece(p.food, part, { x: p.pos.x + (c2.x - p.c.x), y: p.pos.y + (c2.y - p.c.y) });
        const sd = Math.sign((c2.x - h.la.x) * n.x + (c2.y - h.la.y) * n.y) || 1, p0 = { ...np.pos };
        tw(420, e => { np.pos = { x: p0.x + n.x * sd * GAP * e, y: p0.y + n.y * sd * GAP * e }; applyT(np); }, 'outBack');
        const cw = toWorld(np, np.c); crumbs(cw.x, cw.y, 5);
      });
    }
    later(120, () => GS.sfx.pop());
    refreshTags();
    updateSteam(); updateButtons();
    if (!hintedDrag) { hintedDrag = true; later(700, () => { if (!busy) GS.say('Seret potongan ke piring teman.'); }); }
    else if (knives === 0) later(700, () => { if (!busy) GS.say('Pisaunya habis. Sekarang bagikan, ya.'); });
    return true;
  }
  function nudgeReset() { if (btnReset) btnReset.classList.add('mk-nudge'); }
  function drawKnifeRack() {
    knifeRack = GS.el('g', null, GS.el('g', { transform: 'translate(960 432)' }, layers.board));
    updateKnives();
  }
  function updateKnives() {
    if (!knifeRack) return;
    knifeRack.innerHTML = '';
    const n = L.knives, w = 40 * n + 34;
    GS.markup(knifeRack, '<rect x="' + (-w / 2 + 4) + '" y="6" width="' + w + '" height="150" rx="18" fill="' + OUT + '" opacity=".16"/>' +
      '<rect x="' + (-w / 2) + '" y="0" width="' + w + '" height="150" rx="18" fill="#FFF1D2" stroke="' + OUT + '" stroke-width="3.5"/>' +
      '<path d="M' + (-w / 2 + 8) + ' 18H' + (w / 2 - 8) + 'M' + (-w / 2 + 8) + ' 132H' + (w / 2 - 8) + '" stroke="#E2453C" stroke-width="5" stroke-dasharray="10 8" opacity=".75"/>');
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 37 + k * 40, used = k >= knives;
      GS.markup(GS.el('g', { transform: 'translate(' + x + ' 24) rotate(-90) scale(.6)', opacity: used ? 0.22 : 1 }, knifeRack), knifeMarkup());
    }
    const b = GS.el('g', { transform: 'translate(' + (w / 2 - 4) + ' 2)' }, knifeRack);
    GS.markup(b, '<circle r="33" fill="#1F6FD1" stroke="' + OUT + '" stroke-width="3.5"/>');
    const t = GS.el('text', { y: 16, 'text-anchor': 'middle', 'font-size': 46, fill: '#fff', class: 'gs-num' }, b);
    t.textContent = String(knives);
  }
  function wobbleEl(el) { if (!el) return; const t = GS.fx(el, 'gs-wobble'); later(450, () => t.classList.remove('gs-wobble')); }

  /** After two unfair tries the faded guides (Kelas 3 and 4) come back fully. */
  function showGuides() {
    if (guidesShown || !guideG || L.kind !== 'cut' || GUIDE_OPACITY >= 1) return;
    guidesShown = true;
    tw(400, e => { guideG.setAttribute('opacity', (GUIDE_OPACITY + (1 - GUIDE_OPACITY) * e).toFixed(2)); if (centreMark) centreMark.setAttribute('opacity', (GUIDE_OPACITY + (1 - GUIDE_OPACITY) * e).toFixed(2)); });
    later(300, () => GS.say('Lihat titik bantu di pinggir. Coba lagi!'));
  }

  function targetsOf() {
    const n = friends.length;
    if (L.equalShares) { const m = friends.reduce((a, f) => a + shareOf(f), 0) / n; return friends.map(() => m || 1); }
    return friends.map(f => (f.order ? f.order.v : 1 / n));
  }
  /** Smallest number of equal parts that serves every order (2, 3, 4, 6 or 8). */
  function partsNeeded() {
    const t = friends.map(f => (f.order ? f.order.v : 1 / friends.length));
    return [2, 3, 4, 6, 8].find(D => t.every(v => Math.abs(v * D - Math.round(v * D)) < 1e-6)) || 4;
  }

  /* ================= pre-cut levels ================= */
  function cutAll(poly, lines) {
    let list = [poly.map(q => ({ x: q.x, y: q.y, cut: false }))];
    for (const [a, b] of lines) {
      const next = [];
      for (const pc of list) {
        const ch = Geo.chord(pc, { x: a.x - (b.x - a.x) * 50, y: a.y - (b.y - a.y) * 50 }, { x: b.x + (b.x - a.x) * 50, y: b.y + (b.y - a.y) * 50 });
        const parts = ch ? Geo.split(pc, a, b) : [pc, null];
        if (parts[0] && parts[1]) next.push(parts[0], parts[1]); else next.push(pc);
      }
      list = next;
    }
    return list;
  }
  const V = x => [{ x, y: -500 }, { x, y: 500 }], Hz = y => [{ x: -500, y }, { x: 500, y }];
  function placePrecut(food, polys, spread) {
    return polys.map(poly => {
      const c = Geo.centroid(poly), ln = Math.hypot(c.x, c.y) || 1;
      const off = ln > 1 ? { x: c.x / ln * spread, y: c.y / ln * spread } : { x: 0, y: 0 };
      const p = makePiece(food, poly, { x: food.ox + c.x + off.x, y: food.oy + c.y + off.y });
      p.home = { ...p.pos };
      return p;
    });
  }
  function buildPickLevel() {
    const c = { x: 480, y: 560 };
    drawTalenan(c, 760, 240, null);
    const xs = GS.shuffle([245, 480, 715]);
    const kinds = ['grid', 'strip4', 'strip3'];
    const cakes = kinds.map((k, i) => {
      const food = makeFood('lapisKecil', xs[i], c.y);
      const w = food.def.w, h = food.def.h;
      const lines = k === 'grid' ? [V(0), Hz(0)] : k === 'strip4' ? [V(-w / 4), V(0), V(w / 4)] : [V(-w / 6), V(w / 6)];
      return { k, food, pieces: placePrecut(food, cutAll(food.poly, lines), 7) };
    });
    L.unit = cakes[0].food.area;
    L.cakes = cakes;
  }
  function buildHungryLevel() {
    if (L.pair) return buildCompareLevel();
    const c = boardCenter();
    drawLoyang(c);
    const food = makeFood('martabak', c.x, c.y);
    L.unit = food.area;
    const t = GS.rand(0, 7) * 22.5 * Math.PI / 180;
    const dir = { x: Math.cos(t), y: Math.sin(t) }, nor = { x: -dir.y, y: dir.x };
    const [h1, h2] = Geo.split(food.poly.map(q => ({ ...q, cut: false })), { x: -dir.x * 400, y: -dir.y * 400 }, { x: dir.x * 400, y: dir.y * 400 });
    const [q1] = Geo.split(h2, { x: -nor.x * 400, y: -nor.y * 400 }, { x: nor.x * 400, y: nor.y * 400 });
    const ps = placePrecut(food, [h1, q1], 10);
    // crumbs where the eaten quarter was
    const ce = Geo.centroid(Geo.split(h2, { x: -nor.x * 400, y: -nor.y * 400 }, { x: nor.x * 400, y: nor.y * 400 })[1]);
    const R = rng(3);
    let s = '';
    for (let k = 0; k < 14; k++) s += '<circle cx="' + (c.x + ce.x + (R() - 0.5) * 90).toFixed(1) + '" cy="' + (c.y + ce.y + (R() - 0.5) * 90).toFixed(1) + '" r="' + (2 + R() * 3).toFixed(1) + '" fill="#D98E3A" stroke="' + OUT + '" stroke-width="1.2"/>';
    GS.markup(layers.board, s);
    drawSteam(c);
    refreshTags();
    L.half = ps[0]; L.quarter = ps[1];
  }
  /** Two equal cakes; from each a piece of n/d is cut (one along, one across), the rest stays. */
  function buildCompareLevel() {
    const c = { x: 450, y: 565 };
    drawTalenan(c, 660, 250, null);
    const xs = [300, 600], w = 240, h = 140, across = GS.rand(0, 1);
    L.pairPieces = L.pair.map((fr, i) => {
      const food = makeFood('lapisKecil', xs[i], c.y, { w, h, layers: 5 });
      const poly = food.poly.map(q => ({ x: q.x, y: q.y, cut: false }));
      const vert = i !== across;
      const parts = vert ? Geo.split(poly, { x: -w / 2 + w * fr.v, y: -500 }, { x: -w / 2 + w * fr.v, y: 500 }) : Geo.split(poly, { x: -500, y: -h / 2 + h * fr.v }, { x: 500, y: -h / 2 + h * fr.v });
      const frac = vert ? parts[0] : parts[1], rest = vert ? parts[1] : parts[0];
      const ps = placePrecut(food, [frac, rest], 8);
      ps[1].locked = true; ps[1].el.setAttribute('opacity', 0.45); ps[1].el.style.pointerEvents = 'none';
      L.unit = food.area;
      setTag(ps[0], fr.d, fr.n);
      return ps[0];
    });
  }
  /** Fractions of a set: klepon on a tampah, dragged one by one onto plates. */
  function buildSetLevel() {
    const c = { x: 480, y: 560 }, N = L.count, r = L.ballR || 30;
    const cols = N <= 4 ? 2 : N <= 6 ? 3 : 4, rows = Math.ceil(N / cols), sp = 2 * r + 18;
    const rx = cols * sp / 2 + 46, ry = Math.min(190, rows * sp / 2 + 40);
    let s = '<ellipse cx="' + (c.x + 8) + '" cy="' + (c.y + 12) + '" rx="' + (rx + 4) + '" ry="' + (ry + 4) + '" fill="' + OUT + '" opacity=".18"/>' +
      '<ellipse cx="' + c.x + '" cy="' + c.y + '" rx="' + rx + '" ry="' + ry + '" fill="#E8C987" stroke="' + OUT + '" stroke-width="4"/>' +
      '<ellipse cx="' + c.x + '" cy="' + c.y + '" rx="' + (rx - 16) + '" ry="' + (ry - 16) + '" fill="#F5E2B5" stroke="#C49E5A" stroke-width="3"/>';
    for (let k = -6; k <= 6; k++) s += '<path d="M' + (c.x + k * (rx / 7)) + ' ' + (c.y - ry + 20) + 'V' + (c.y + ry - 20) + '" stroke="#C49E5A" stroke-width="2" opacity=".35"/>';
    s += '<ellipse cx="' + c.x + '" cy="' + c.y + '" rx="' + (rx - 30) + '" ry="' + (ry - 30) + '" fill="#FFF8EC" stroke="#E0C48E" stroke-width="2"/>';
    GS.markup(layers.board, s);
    let unit = 0;
    for (let k = 0; k < N; k++) {
      const x = c.x + ((k % cols) - (cols - 1) / 2) * sp, y = c.y + (Math.floor(k / cols) - (rows - 1) / 2) * sp * 0.85;
      const food = makeFood('klepon', x, y, { r });
      const p = makePiece(food, food.poly.map(q => ({ x: q.x, y: q.y, cut: false })));
      p.home = { ...p.pos };
      unit += p.area;
    }
    L.unit = unit;
  }
  /** TK: one friend already has a piece; give the other friend one that is just as big. */
  function buildMatchLevel() {
    const c = { x: 510, y: 575 };
    drawTalenan(c, 680, 250, null);
    const W = 130, H = 110;
    const ref = makeFood('lapisKecil', friends[0].x, PLATE_Y, { w: W, h: H, layers: 4 });
    L.unit = ref.area;
    const rp = makePiece(ref, ref.poly.map(q => ({ x: q.x, y: q.y, cut: false })));
    rp.locked = true; rp.el.style.cursor = 'default';
    putOnPlate(rp, friends[0].plate); layoutPlate(friends[0].plate, false);
    const sizes = GS.shuffle([{ w: W, eq: true }, { w: Math.round(W * (0.5 + Math.random() * 0.1)) }, { w: Math.round(W * (1.5 + Math.random() * 0.15)) }]);
    [290, 510, 730].forEach((x, i) => {
      const f = makeFood('lapisKecil', x, c.y, { w: sizes[i].w, h: H, layers: 4 });
      const p = makePiece(f, f.poly.map(q => ({ x: q.x, y: q.y, cut: false })));
      p.home = { ...p.pos };
      if (sizes[i].eq) L.equalPiece = p;
    });
  }
  function buildOrderLevel() {
    const n = L.ds.length;
    const c = { x: 480, y: 590 };
    drawTalenan(c, n > 3 ? 820 : 760, 220, null);
    // "besar -> kecil" sign between the plates and the board
    const xs = seatXs(n);
    let s = '<rect x="' + (xs[0] - 70) + '" y="424" width="' + (xs[n - 1] - xs[0] + 140) + '" height="40" rx="20" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="3"/>' +
      '<path d="M' + (xs[0] + 60) + ' 444H' + (xs[n - 1] - 60) + '" stroke="#1F6FD1" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M' + (xs[n - 1] - 74) + ' 432L' + (xs[n - 1] - 58) + ' 444L' + (xs[n - 1] - 74) + ' 456" fill="none" stroke="#1F6FD1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + (xs[0] - 46) + '" cy="444" r="14" fill="#F28C28" stroke="' + OUT + '" stroke-width="2.5"/>' +
      '<circle cx="' + (xs[n - 1] + 52) + '" cy="444" r="6" fill="#F28C28" stroke="' + OUT + '" stroke-width="2.5"/>';
    GS.markup(layers.signs, s);
    const lbl = (x, t, a) => { const e = GS.el('text', { class: 'mk-name', x, y: 452, 'text-anchor': a, 'font-size': 34, fill: '#2B1D14' }, layers.signs); e.textContent = t; };
    lbl(xs[0] - 26, 'besar', 'start'); lbl(xs[n - 1] + 40, 'kecil', 'end');
    const cxs = n > 3 ? [175, 375, 575, 775] : [245, 480, 715];
    const over = n > 3 ? { w: 168, h: 104 } : null, w = over ? over.w : 200, h = over ? over.h : 120;
    const ds = L.ds;
    const opts = {
      2: [[V(0)], [Hz(0)]], 3: [[V(-w / 6), V(w / 6)], [Hz(-h / 6), Hz(h / 6)]], 4: [[V(-w / 4), V(0), V(w / 4)], [V(0), Hz(0)]],
      5: [[V(-3 * w / 10), V(-w / 10), V(w / 10), V(3 * w / 10)]], 6: [[V(-w / 6), V(w / 6), Hz(0)]],
      8: [[V(-w / 4), V(0), V(w / 4), Hz(0)], [V(-3 * w / 8), V(-w / 4), V(-w / 8), V(0), V(w / 8), V(w / 4), V(3 * w / 8)]]
    };
    const given = [];
    ds.forEach((d, i) => {
      const food = makeFood('lapisKecil', cxs[i], c.y + 4, over);
      const choice = opts[d][GS.rand(0, opts[d].length - 1)];
      const ps = placePrecut(food, cutAll(food.poly, choice), 6);
      ps.forEach(p => { p.locked = true; p.el.style.pointerEvents = 'none'; });
      given.push(ps[GS.rand(0, ps.length - 1)]);
    });
    L.unit = foods[0].area;
    refreshTags();
    // make sure the starting order is not already sorted
    let order = GS.shuffle(ds.map((d, k) => k));
    const sorted = o => o.every((g, k) => k === 0 || given[o[k - 1]].area > given[g].area);
    while (sorted(order)) order = GS.shuffle(order);
    order.forEach((gi, seat) => { const p = given[gi]; putOnPlate(p, friends[seat].plate); layoutPlate(friends[seat].plate, false); });
    friends.forEach(f => {
      f.hit = GS.el('rect', { x: -110, y: -100, width: 220, height: 150, fill: '#000', 'fill-opacity': 0 }, layers.top);
      f.hit.setAttribute('transform', 'translate(' + f.x + ' ' + PLATE_Y + ')');
      f.hit.style.cursor = 'grab';
      GS.drag(f.hit, {
        svg,
        onStart: pt => { if (busy) return false; startSeatDrag(f, pt); },
        onMove: pt => moveSeatDrag(f, pt),
        onEnd: pt => endSeatDrag(f, pt)
      });
    });
  }
  let seatDrag = null;
  function startSeatDrag(f, pt) {
    seatDrag = { f, start: pt };
    layers.plates.appendChild(f.plate.el);
    f.plate.pieces.forEach(p => { layers.pieces.appendChild(p.el); p.lift = 1.15; applyT(p); });
    GS.sfx.pick();
    moveSeatDrag(f, pt);
  }
  function moveSeatDrag(f, pt) {
    if (!seatDrag || seatDrag.f !== f) return;
    const dx = pt.x - seatDrag.start.x, dy = Math.min(0, pt.y - seatDrag.start.y) - 20;
    f.plate.el.setAttribute('transform', 'translate(' + (f.x + dx) + ' ' + (PLATE_Y + dy) + ') scale(1.08)');
    f.plate.pieces.forEach(p => { p.pos = posForCenter(p, { x: f.x + dx, y: PLATE_Y - 12 + dy }); applyT(p); });
    const tgt = nearestSeat(f.x + dx);
    friends.forEach(o => o.plate.el.classList.toggle('hot', o !== f && seatIndex(o) === tgt));
  }
  function seatIndex(f) { const xs = seatXs(friends.length); return xs.indexOf(f.x); }
  function nearestSeat(x) { const xs = seatXs(friends.length); let bi = 0; xs.forEach((sx, i) => { if (Math.abs(sx - x) < Math.abs(xs[bi] - x)) bi = i; }); return bi; }
  function endSeatDrag(f, pt) {
    if (!seatDrag || seatDrag.f !== f) return;
    const dx = pt.x - seatDrag.start.x; seatDrag = null;
    friends.forEach(o => o.plate.el.classList.remove('hot'));
    f.plate.pieces.forEach(p => { p.lift = 1; });
    const j = nearestSeat(f.x + dx), i = seatIndex(f);
    if (j !== i) { swapSeats(i, j); GS.sfx.drop(); }
    else { slideFriend(f, f.x, 160); GS.sfx.tick(); }
  }
  function swapSeats(i, j) {
    const xs = seatXs(friends.length);
    const a = friends.find(f => f.x === xs[i]), b = friends.find(f => f.x === xs[j]);
    a.x = xs[j]; b.x = xs[i];
    slideFriend(a, a.x, 260); slideFriend(b, b.x, 260);
    GS.sfx.whoosh();
  }
  function slideFriend(f, x, ms) {
    const fx0 = parseFloat(f.el.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
    const px0 = parseFloat(f.plate.el.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
    const py0 = parseFloat(f.plate.el.getAttribute('transform').match(/translate\([-\d.]+ ([-\d.]+)/)[1]);
    f.plate.x = x;
    if (f.hit) f.hit.setAttribute('transform', 'translate(' + x + ' ' + PLATE_Y + ')');
    tw(ms, e => {
      const hop = Math.sin(e * Math.PI) * 12;
      f.el.setAttribute('transform', 'translate(' + GS.lerp(fx0, x, e).toFixed(1) + ' ' + (FRIEND_Y - hop).toFixed(1) + ')');
      f.card.setAttribute('transform', 'translate(' + GS.lerp(fx0, x, e).toFixed(1) + ' 0)');
      const px = GS.lerp(px0, x, e), py = GS.lerp(py0, PLATE_Y, e);
      f.plate.el.setAttribute('transform', 'translate(' + px.toFixed(1) + ' ' + py.toFixed(1) + ')');
      f.plate.pieces.forEach(p => { p.pos = posForCenter(p, { x: px, y: py - 12 }); applyT(p); });
    }, 'outCubic').then(() => { f.el.setAttribute('transform', 'translate(' + x + ' ' + FRIEND_Y + ')'); f.card.setAttribute('transform', 'translate(' + x + ' 0)'); layoutPlate(f.plate, false); });
  }

  /* ================= dock ================= */
  function actionBtn(label, cls, icon, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gs-action' + (cls ? ' ' + cls : '');
    b.innerHTML = (icon || '') + '<span></span>';
    b.querySelector('span').textContent = label;
    b.addEventListener('click', () => { if (b.disabled) return; GS.sfx.click(); fn(); });
    dock.appendChild(b);
    return b;
  }
  function buildDock() {
    btnReset = actionBtn('Ulang', 'alt', GS.ICON.retry, onReset);
    btnGo = actionBtn(L.kind === 'order' ? 'Cek!' : 'Bagikan!', '', '', onGo);
  }
  function updateButtons() {
    if (!btnGo) return;
    const ready = L.kind === 'order' || friends.every(f => f.plate.pieces.length > 0);
    btnGo.disabled = busy || !ready;
    btnReset.disabled = busy;
  }
  function onReset() {
    if (busy) return;
    btnReset.classList.remove('mk-nudge');
    if (L.kind === 'cut') {
      if (cutsMade > 0) tries++;
      pieces.slice().forEach(removePiece);
      friends.forEach(f => { f.plate.pieces = []; });
      const food = L.foodRef;
      freshPieces();
      knives = L.knives; cutsMade = 0;
      updateKnives(); updateSteam();
      GS.sfx.whoosh();
      GS.say(food.def.label === 'martabak' ? 'Martabak utuh lagi. Ayo potong!' : 'Utuh lagi. Ayo potong!');
    } else if (L.kind === 'order') {
      // back to the starting seats
      GS.sfx.whoosh();
    } else {
      pieces.forEach(p => {
        if (p.locked || !p.home) return;
        if (p.plate) { p.plate.pieces = p.plate.pieces.filter(q => q !== p); p.plate = null; }
        const s0 = p.s, p0 = { ...p.pos };
        tw(260, e => { p.s = GS.lerp(s0, 1, e); p.pos = { x: GS.lerp(p0.x, p.home.x, e), y: GS.lerp(p0.y, p.home.y, e) }; applyT(p); });
        setHit(p);
      });
      GS.sfx.whoosh();
    }
    updateButtons();
  }

  /* ================= judging ================= */
  function shareOf(f) { return f.plate.pieces.reduce((a, p) => a + p.area, 0) / L.unit; }
  async function onGo() {
    if (busy) return;
    busy = true; updateButtons();
    const my = tok;
    if (L.kind === 'order') return judgeOrder(my);
    if (L.kind === 'hungry') return judgeHungry(my);
    const tol = L.tol || TOL;
    const shares = friends.map(shareOf);
    const targets = targetsOf();
    const ratios = shares.map((s, i) => s / targets[i]);
    const fair = ratios.every(r => Math.abs(r - 1) <= tol);
    hud.mood('think');
    if (!(await pause(350))) return;
    if (fair) return celebrateFair(my);
    tries++;
    const iMin = ratios.indexOf(Math.min(...ratios)), iMax = ratios.lastIndexOf(Math.max(...ratios));
    const fMin = friends[iMin], fMax = friends[iMax];
    const equalButShort = L.kind === 'cut' && ratios[iMax] / ratios[iMin] <= 1 + tol && ratios[iMax] < 1;
    GS.sfx.oops(); hud.mood('oops');
    if (equalButShort) {
      GS.say('Masih ada sisa. Bagi habis ya!');
      friends.forEach(f => wobbleEl(f.tilt));
      pieces.filter(p => !p.plate).forEach(p => squash(p));
      if (!(await pause(1400))) return;
    } else {
      if (ratios[iMin] < 1 - tol) sulk(fMin); else mood(fMax, 'puzzled', 2600);
      let line;
      if (L.orders) {
        if (ratios[iMin] < 1 - tol) line = fMin.name + ' minta ' + orderWords(fMin.order) + '. Dapatnya kurang.';
        else line = fMax.name + ' dapat lebih dari ' + orderWords(fMax.order) + '.';
      } else line = fMin.name + ' dapat lebih sedikit. Lihat bedanya!';
      GS.say(line);
      const big = shares[iMax] >= shares[iMin] ? fMax : fMin, small = big === fMax ? fMin : fMax;
      if (fMin !== fMax && Math.abs(shares[iMax] - shares[iMin]) > tol * Math.min(shares[iMax], shares[iMin])) {
        await stackCompare(big.plate.pieces.slice(), small.plate.pieces.slice(), my);
      } else if (!(await pause(2000))) return;
      if (my !== tok) return;
    }
    unsulkAll();
    afterFail();
  }
  function afterFail() {
    busy = false; updateButtons(); hud.mood('think');
    if (L.kind === 'cut' && knives === 0) { nudgeReset(); later(300, () => GS.say('Pisaunya habis. Tekan Ulang untuk potong lagi.')); }
    else if (tries >= 2 && L.kind === 'cut') showGuides();
  }
  async function judgeHungry(my) {
    const fh = friends[L.hungry], fo = friends[1 - L.hungry];
    const sh = shareOf(fh), so = shareOf(fo);
    if (!(await pause(350))) return;
    if (sh > so * (1 + (L.tol || TOL))) return celebrateFair(my);
    tries++;
    GS.sfx.oops(); hud.mood('oops');
    sulk(fh);
    GS.say(fh.name + ' masih lapar. Lihat, mana yang lebih besar?');
    const big = so >= sh ? fo : fh, small = big === fo ? fh : fo;
    await stackCompare(big.plate.pieces.slice(), small.plate.pieces.slice(), my);
    if (my !== tok) return;
    unsulkAll(); afterFail();
  }
  async function judgeOrder(my) {
    const xs = seatXs(friends.length);
    const seated = xs.map(x => friends.find(f => f.x === x));
    const areas = seated.map(f => shareOf(f));
    if (!(await pause(350))) return;
    let bad = -1;
    for (let k = 0; k < areas.length - 1; k++) if (areas[k] < areas[k + 1]) { bad = k; break; }
    if (bad < 0) return celebrateFair(my);
    tries++;
    GS.sfx.oops(); hud.mood('oops');
    const a = seated[bad], b = seated[bad + 1];
    mood(b, 'puzzled', 2600);
    GS.say('Punya ' + b.name + ' lebih besar dari punya ' + a.name + '.');
    await stackCompare(b.plate.pieces.slice(), a.plate.pieces.slice(), my);
    if (my !== tok) return;
    afterFail();
  }

  /* ----- friend reactions ----- */
  function mood(f, kind, ms) {
    f.bubble.innerHTML = '';
    GS.markup(f.bubble, bubbleMarkup(kind));
    f.bubble.setAttribute('opacity', 1);
    tw(260, e => f.bubble.setAttribute('transform', 'translate(62 -150) scale(' + e.toFixed(3) + ')'), 'outBack');
    if (ms) later(ms, () => f.bubble.setAttribute('opacity', 0));
  }
  function sulk(f) {
    mood(f, 'sulk');
    f.sulking = true;
    tw(300, e => f.tilt.setAttribute('transform', 'rotate(' + (-9 * e).toFixed(2) + ')'), 'outBack');
  }
  function unsulkAll() {
    friends.forEach(f => {
      f.bubble.setAttribute('opacity', 0);
      if (f.sulking) { f.sulking = false; tw(300, e => f.tilt.setAttribute('transform', 'rotate(' + (-9 * (1 - e)).toFixed(2) + ')')); }
    });
  }
  function bounceFriend(f, h) {
    tw(260, (e, r) => f.tilt.setAttribute('transform', 'translate(0 ' + (-Math.sin(r * Math.PI) * h).toFixed(2) + ')'), 'linear');
  }

  /* ----- comparison: stack two shares on top of each other ----- */
  function groupPolys(group, T, deg, g) {
    return group.map(p => p.poly.map(q => {
      const v = Geo.rot({ x: p.food.ox + q.x - g.x, y: p.food.oy + q.y - g.y }, deg);
      return { x: T.x + v.x, y: T.y + v.y };
    }));
  }
  function groupBox(group) {
    return Geo.bbox([].concat(...group.map(p => p.poly.map(q => ({ x: p.food.ox + q.x, y: p.food.oy + q.y })))));
  }
  async function stackCompare(big, small, my, color) {
    if (!big.length || !small.length) { await pause(1200); return; }
    const C = { x: 520, y: 545 };
    const dim = GS.el('rect', { x: -600, y: 306, width: 2480, height: 594, fill: '#FFF8EC', opacity: 0 }, layers.dim);
    tw(250, e => dim.setAttribute('opacity', (0.72 * e).toFixed(2)));
    // big share at its original shape, centred
    const gb = groupBox(big), gbc = { x: gb.cx, y: gb.cy };
    const bigPolys = groupPolys(big, C, 0, gbc);
    const bbB = Geo.bbox([].concat(...bigPolys));
    // try rotations and corner alignments for the small share; keep the best overlap
    const gs = groupBox(small), gsc = { x: gs.cx, y: gs.cy };
    let best = null;
    for (const deg of [0, 90, 180, 270]) {
      const raw = groupPolys(small, { x: 0, y: 0 }, deg, gsc), bbS = Geo.bbox([].concat(...raw));
      const anchors = [
        { x: bbB.cx - bbS.cx, y: bbB.cy - bbS.cy }, { x: bbB.x0 - bbS.x0, y: bbB.y0 - bbS.y0 }, { x: bbB.x1 - bbS.x1, y: bbB.y0 - bbS.y0 },
        { x: bbB.x0 - bbS.x0, y: bbB.y1 - bbS.y1 }, { x: bbB.x1 - bbS.x1, y: bbB.y1 - bbS.y1 }
      ];
      for (const T of anchors) {
        const polys = raw.map(pl => pl.map(q => ({ x: q.x + T.x, y: q.y + T.y })));
        let ov = 0;
        for (const A of polys) for (const B of bigPolys) { const I = Geo.intersect(A, B); if (I) ov += Geo.absArea(I); }
        if (!best || ov > best.ov + 1) best = { ov, deg, T };
      }
    }
    const placeGroup = (group, Tc, deg, gc) => group.map(p => {
      const v = Geo.rot({ x: p.food.ox + p.c.x - gc.x, y: p.food.oy + p.c.y - gc.y }, deg);
      return { p, pos: { x: Tc.x + v.x, y: Tc.y + v.y }, rot: deg };
    });
    const bigT = placeGroup(big, C, 0, gbc);
    const smallT = placeGroup(small, best.T, best.deg, gsc);
    const animTo = (list, ms) => {
      list.forEach(({ p }) => { layers.pieces.appendChild(p.el); p.tagHidden = true; if (p.tag) p.tag.setAttribute('opacity', 0); });
      const starts = list.map(({ p }) => ({ pos: { ...p.pos }, s: p.s, rot: p.rot }));
      return tw(ms, e => list.forEach(({ p, pos, rot }, i) => {
        const st = starts[i];
        p.s = GS.lerp(st.s, 1, e); p.rot = GS.lerp(st.rot, rot, e);
        p.pos = { x: GS.lerp(st.pos.x, pos.x, e), y: GS.lerp(st.pos.y, pos.y, e) - Math.sin(e * Math.PI) * 30 };
        applyT(p);
      }), 'inOutCubic');
    };
    GS.sfx.whoosh();
    await animTo(bigT, 480);
    if (my !== tok) return;
    GS.sfx.drop();
    await animTo(smallT, 520);
    if (my !== tok) return;
    GS.sfx.thud();
    smallT.forEach(({ p }) => squash(p));
    // highlight the part of the bigger share that sticks out
    const out = GS.el('g', null, layers.top);
    bigPolys.forEach(pl => GS.el('polygon', { class: 'mk-diff', points: pts(pl), fill: 'none', stroke: color || '#F2A900', 'stroke-width': 7, 'stroke-dasharray': '16 10', 'stroke-linejoin': 'round' }, out));
    if (!(await pause(2300))) return;
    out.remove();
    tw(250, e => dim.setAttribute('opacity', (0.72 * (1 - e)).toFixed(2))).then(() => dim.remove());
    const plates = new Set(big.concat(small).map(p => p.plate).filter(Boolean));
    plates.forEach(pl => layoutPlate(pl, true));
    big.concat(small).forEach(p => { if (p.tag) p.tag.setAttribute('opacity', 1); });
    GS.sfx.pop();
    await pause(300);
  }

  /* ----- eating & winning ----- */
  function crumbs(x, y, n) {
    const g = GS.el('g', null, layers.fx);
    const cs = [];
    for (let k = 0; k < n; k++) {
      const c = GS.el('circle', { r: (2 + Math.random() * 3).toFixed(1), fill: ['#D98E3A', '#4A2717', '#FFE08A', '#F27FA0'][k % 4], stroke: OUT, 'stroke-width': 1 }, g);
      cs.push({ c, vx: (Math.random() - 0.5) * 160, vy: -80 - Math.random() * 120 });
    }
    tw(600, (e, r) => cs.forEach(o => {
      const t = r * 0.6;
      o.c.setAttribute('cx', (x + o.vx * t).toFixed(1)); o.c.setAttribute('cy', (y + o.vy * t + 490 * t * t).toFixed(1));
      o.c.setAttribute('opacity', (1 - r).toFixed(2));
    }), 'linear').then(() => g.remove());
  }
  function hearts(x, y) {
    const g = GS.el('g', null, layers.fx);
    const hs = [-18, 14].map((dx, i) => GS.el('path', { d: heartPath(), fill: '#F59AB0', stroke: OUT, 'stroke-width': 2.5, transform: 'translate(' + (x + dx) + ' ' + y + ')' }, g));
    tw(1000, (e, r) => hs.forEach((h, i) => h.setAttribute('transform', 'translate(' + (x + (i ? 14 : -18) + Math.sin(r * 8 + i) * 5).toFixed(1) + ' ' + (y - 60 * e).toFixed(1) + ') scale(' + (1.4 - 0.3 * r).toFixed(2) + ')'))).then(() => g.remove());
  }
  async function eat(f, my) {
    mood(f, 'happy');
    const ps = f.plate.pieces.slice();
    for (let b = 0; b < 3; b++) {
      GS.sfx.pop();
      bounceFriend(f, 10);
      ps.forEach(p => {
        const c = centerOf(p); crumbs(c.x, c.y, 7);
        const s0 = p.s, s1 = L.plateScale * (1 - (b + 1) / 3) + 0.0001;
        tw(160, e => { p.s = GS.lerp(s0, s1, e); p.pos = posForCenter(p, c); applyT(p); });
      });
      if (!(await pause(260))) return;
    }
    ps.forEach(p => { p.el.setAttribute('opacity', 0); });
    hearts(f.x, 150);
  }
  async function celebrateFair(my) {
    hud.mood('happy');
    const shapes = friends.map(f => f.plate.pieces);
    let text = typeof L.win === 'function' ? L.win(shapes) : L.win;
    if (L.kind === 'order') text = L.ds.slice().sort((a, b) => a - b).map(d => WORD[d]).join(', ') + '. Urutannya pas!';
    if (!text) text = L.orders ? 'Pesanan pas semua. Hebat!' : 'Adil! Semua sama besar!';
    const lastRound = !L.rounds || roundIdx >= L.rounds - 1;
    GS.say(lastRound ? text : 'Adil! Semua sama besar!');
    // labels appear after the child made the pieces (concreteness fading)
    if (L.tagAfter) friends.forEach(f => f.plate.pieces.forEach(p => { if (!p.tag) { const d = fracOf(p); if (d) setTag(p, d); } }));
    if (L.kind === 'pick') await pickDemo(my);
    if (L.stackDemo && friends.length >= 2) {
      if (!(await pause(700))) return;
      GS.say(L.demoSay || 'Sama besar!');
      const a = friends[0].plate.pieces.slice(), b = friends[1].plate.pieces.slice();
      const A = a.reduce((x, p) => x + p.area, 0), B = b.reduce((x, p) => x + p.area, 0);
      await stackCompare(A >= B ? a : b, A >= B ? b : a, my, '#0F8C7A');
      if (my !== tok) return;
      GS.say(text);
    }
    if (my !== tok) return;
    for (const f of friends) { eat(f, my); if (!(await pause(320))) return; }
    if (!(await pause(1200))) return;
    if (!lastRound) { keepTries = tries; buildLevel(run.current, true); return; }
    const stars = tries === 0 ? 3 : tries <= 2 ? 2 : 1;
    busy = true;
    run.win(stars, text);
  }
  /** L6: when a strip and a box were given, cut a copy of the strip in half and lay the
   *  halves over the box: they cover it exactly, so equal area, different shape. */
  async function pickDemo(my) {
    const ps = friends.map(f => f.plate.pieces[0]).filter(Boolean);
    if (ps.length < 2) return;
    const asp = p => p.bb.w / p.bb.h;
    const strip = ps.find(p => asp(p) < 0.6), box = ps.find(p => asp(p) > 1.2);
    if (!strip || !box) { await pause(600); return; }
    if (!(await pause(500))) return;
    const C = { x: 520, y: 545 };
    const dim = GS.el('rect', { x: -600, y: 306, width: 2480, height: 594, fill: '#FFF8EC', opacity: 0.72 }, layers.fx);
    const gs = GS.el('g', null, layers.top);
    const bw = box.bb.w * 1.6, bh = box.bb.h * 1.6;
    // the box, big, then the two halves of the strip landing on it
    const boxG = GS.el('g', { transform: 'translate(' + C.x + ' ' + C.y + ') scale(1.6) translate(' + (-box.bb.cx) + ' ' + (-box.bb.cy) + ')' }, gs);
    GS.markup(boxG, '<g clip-path="url(#mkc' + box.id + ')"><use href="#' + box.food.artId + '"/></g><polygon points="' + pts(box.poly) + '" fill="none" stroke="' + OUT + '" stroke-width="3"/>');
    const halves = Geo.split(strip.poly, { x: -999, y: strip.bb.cy }, { x: 999, y: strip.bb.cy });
    const hg = halves.map((hp, i) => {
      const id = 'mkd' + i + strip.id;
      GS.markup(defs, '<clipPath id="' + id + '"><polygon points="' + pts(hp) + '"/></clipPath>');
      const g = GS.el('g', null, gs);
      const hb = Geo.bbox(hp);
      GS.markup(g, '<g transform="translate(' + (-hb.cx) + ' ' + (-hb.cy) + ')"><g clip-path="url(#' + id + ')"><use href="#' + strip.food.artId + '"/></g><polygon points="' + pts(hp) + '" fill="none" stroke="' + OUT + '" stroke-width="3"/></g>');
      return { g, hb };
    });
    const sw = hg[0].hb.w * 1.6;
    const targets = [{ x: C.x - bw / 2 + sw / 2, y: C.y }, { x: C.x + bw / 2 - sw / 2, y: C.y }];
    const startsY = [C.y - 240, C.y - 240];
    GS.say('Lihat! Potongan panjang dibelah dua.');
    for (let i = 0; i < 2; i++) {
      GS.sfx.whoosh();
      await tw(520, e => hg[i].g.setAttribute('transform', 'translate(' + targets[i].x.toFixed(1) + ' ' + GS.lerp(startsY[i], targets[i].y, e).toFixed(1) + ') scale(1.6)'), 'outBack');
      if (my !== tok) return;
      GS.sfx.drop();
    }
    if (!(await pause(1600))) return;
    tw(300, e => { gs.setAttribute('opacity', (1 - e).toFixed(2)); dim.setAttribute('opacity', (0.72 * (1 - e)).toFixed(2)); }).then(() => { gs.remove(); dim.remove(); });
    await pause(300);
  }

  /* ================= debug / test hook ================= */
  async function solve() {
    const my = tok;
    if (solving === my) return;
    solving = my;
    while (busy) { await GS.wait(100); if (my !== tok) return; }
    const wait = ms => GS.wait(ms);
    const boardPieces = () => pieces.filter(p => !p.plate && !p.locked);
    const cutThrough = async (p, a, b) => {      // a, b local points of piece p: one swipe along that line
      const A = toWorld(p, a), B = toWorld(p, b);
      const dx = B.x - A.x, dy = B.y - A.y, ln = Math.hypot(dx, dy);
      const ok = performSwipe({ x: A.x - dx / ln * 400, y: A.y - dy / ln * 400 }, { x: B.x + dx / ln * 400, y: B.y + dy / ln * 400 });
      await wait(450);
      return ok;
    };
    const give = async (p, f) => { putOnPlate(p, f.plate); updateButtons(); await wait(120); };
    if (L.kind === 'cut') {
      const D = partsNeeded(), def = L.foodRef.def, w = def.w, h = def.h;
      if (def.shape === 'circle') {
        // diameters for 2, 4, 8 parts; radii (pizza cuts) for 3 and 6
        const F0 = L.foodRef, C = { x: F0.ox, y: F0.oy }, R = def.r + 60;
        const diam = { 2: [0], 4: [0, 90], 8: [0, 45, 90, 135] }[D];
        const swipes = diam ? diam.map(t => [-1, 1].map(s2 => ({ x: C.x + s2 * Math.cos(t * Math.PI / 180) * R, y: C.y + s2 * Math.sin(t * Math.PI / 180) * R })))
          : Array.from({ length: D }, (_, k) => { const t = (k * 360 / D - 90) * Math.PI / 180; return [{ x: C.x + Math.cos(t) * 5, y: C.y + Math.sin(t) * 5 }, { x: C.x + Math.cos(t) * R, y: C.y + Math.sin(t) * R }]; });
        for (const [A, B] of swipes) { performSwipe(A, B); await wait(450); if (my !== tok) return; }
      } else {
        const v = x => [{ x, y: -10 }, { x, y: 10 }], hz = y => [{ x: -10, y }, { x: 10, y }];
        const plan = { 2: [v(0)], 3: [hz(-h / 6), hz(h / 6)], 4: [v(0), hz(0)], 6: [hz(0), v(-w / 6), v(w / 6)], 8: [v(0), hz(0), v(-w / 4), v(w / 4)] }[D];
        const splits = (q, ln) => { const pr = Geo.split(q.poly, ln[0], ln[1]); return pr[0] && pr[1] && Math.min(Geo.absArea(pr[0]), Geo.absArea(pr[1])) > 0.01 * L.unit; };
        for (const ln of plan) {
          const q = boardPieces().find(x => x.food === L.foodRef && splits(x, ln));
          if (q) await cutThrough(q, ln[0], ln[1]);
          if (my !== tok) return;
        }
      }
      const pool = boardPieces().filter(p => Math.abs(p.area / L.unit * D - Math.round(p.area / L.unit * D)) < 0.02);
      for (const f of friends) {
        let need = (f.order ? f.order.v : 1 / friends.length);
        while (need > 1e-6 && pool.length) {
          const i = pool.findIndex(p => p.area / L.unit <= need + 1e-3);
          if (i < 0) break;
          const p = pool.splice(i, 1)[0]; need -= p.area / L.unit; await give(p, f);
        }
      }
    } else if (L.kind === 'pick') {
      const grid = L.cakes.find(c => c.k === 'grid').pieces[0], strip = L.cakes.find(c => c.k === 'strip4').pieces[0];
      await give(grid, friends[0]); await give(strip, friends[1]);
    } else if (L.kind === 'match') {
      await give(L.equalPiece, friends[1]);
    } else if (L.kind === 'set') {
      const pool = boardPieces();
      const t = targetsOf();
      for (let k = 0; k < friends.length; k++) for (let j = Math.round(t[k] * L.count); j > 0; j--) await give(pool.shift(), friends[k]);
    } else if (L.kind === 'hungry') {
      if (L.pair) {
        const [a, b] = L.pairPieces, big = a.area > b.area ? a : b;
        await give(big, friends[L.hungry]); await give(big === a ? b : a, friends[1 - L.hungry]);
      } else { await give(L.half, friends[L.hungry]); await give(L.quarter, friends[1 - L.hungry]); }
    } else if (L.kind === 'order') {
      const n = friends.length, xs = seatXs(n);
      for (let k = 0; k < n; k++) {
        const seated = xs.map(x => friends.find(f => f.x === x));
        const want = seated.slice().sort((a, b) => shareOf(b) - shareOf(a))[k];
        const i = seatIndex(want);
        if (i !== k) { swapSeats(i, k); await wait(400); }
      }
    }
    await wait(300);
    if (my !== tok) return;
    solving = 0;
    onGo();
  }
  window.__game = {
    go: i => run.go(i),
    solve,
    count: () => tierCount(),
    tier: TIER,
    get state() { return { level: run.current, kind: L && L.kind, tries, knives, busy, pieces: pieces.map(p => ({ area: +(p.area / L.unit).toFixed(4), plate: p.plate ? friends.indexOf(p.plate.friend) : -1, tag: p.tagD })) }; },
    cut: (a, b) => performSwipe(a, b),
    give: (pi, fi) => { putOnPlate(pieces[pi], friends[fi].plate); updateButtons(); },
    bagikan: () => onGo(),
    reset: () => onReset(),
    toScreen(x, y) { const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; const m = svg.getScreenCTM(); const r = pt.matrixTransform(m); return { x: r.x, y: r.y }; },
    centerOfPiece: i => centerOf(pieces[i]),
    geo: Geo
  };

  run.go(GS.store.nextLevel(GAME, tierCount()));
})();
