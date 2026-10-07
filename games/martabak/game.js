/* Bagi Martabak (martabak)
 * The child is the seller at a warung. Food is a convex polygon (martabak = 64-gon,
 * kue lapis = rectangle, roti = rounded rectangle). A straight knife stroke splits every
 * piece it fully crosses (convex polygon vs line clipping, pieces stay convex). Pieces are
 * dragged onto friends' plates; "Bagikan!" compares real areas (shoelace formula).
 * Fair = every share within 6% (relative) of its target share. */
(function () {
  'use strict';
  const GAME = 'martabak';
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
    roti: { shape: 'round', w: 372, h: 252, rr: 46, label: 'roti bakar' }
  };
  function foodPoly(def) {
    if (def.shape === 'circle') return Geo.circle(def.r, 64);
    if (def.shape === 'rect') return Geo.rect(def.w, def.h);
    return Geo.roundRect(def.w, def.h, def.rr, 8);
  }
  /** Line snapping, applied in the food's own frame, never to the math of the answer.
   *  Circle: a motor-skill aid for 6-year-olds. When the drawn stroke already passes within
   *  12 units of the centre, it is moved (angle kept) to pass exactly through the centre.
   *  Rectangles: only the two exact midlines snap, when the stroke stays within 10 units. */
  function snapLine(def, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    if (def.shape === 'circle') {
      const nx = -dy / L, ny = dx / L, d = a.x * nx + a.y * ny;
      if (Math.abs(d) <= 12) return { a: { x: a.x - nx * d, y: a.y - ny * d }, b: { x: b.x - nx * d, y: b.y - ny * d }, snapped: Math.abs(d) > 1e-9 };
      return { a, b, snapped: false };
    }
    const hw = def.w / 2, hh = def.h / 2;
    if (Math.abs(dy) > 1e-6) {
      const xt = a.x + dx * (-hh - a.y) / dy, xb = a.x + dx * (hh - a.y) / dy;
      if (Math.abs(xt) <= 10 && Math.abs(xb) <= 10) return { a: { x: 0, y: a.y }, b: { x: 0, y: b.y }, snapped: true };
    }
    if (Math.abs(dx) > 1e-6) {
      const yl = a.y + dy * (-hw - a.x) / dx, yr = a.y + dy * (hw - a.x) / dx;
      if (Math.abs(yl) <= 10 && Math.abs(yr) <= 10) return { a: { x: a.x, y: 0 }, b: { x: b.x, y: 0 }, snapped: true };
    }
    return { a, b, snapped: false };
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
  function tagMarkup(d) {
    return '<rect x="-23" y="-34" width="46" height="70" rx="14" fill="' + OUT + '" opacity=".2" transform="translate(2 4)"/>' +
      '<rect x="-23" y="-34" width="46" height="70" rx="14" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="3"/>' +
      '<g transform="translate(0 -1)">' + fracMarkup(1, d, 28, '#2B1D14') + '</g>';
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
  const hud = GS.hud({ gameId: GAME, title: 'Bagi Martabak', levelCount: 10, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: 10, hud, start: buildLevel });

  const sceneG = GS.el('g', { class: 'mk-scene' }, svg);
  try { GS.markup(sceneG, hasArt('scene') ? GS.art.scene('warung', 1280, 390) : fallbackScene(1280, 390)); }
  catch (e) { GS.markup(sceneG, fallbackScene(1280, 390)); }
  const friendsG = GS.el('g', { class: 'mk-friends' }, svg);
  const counterG = GS.el('g', { class: 'mk-counter' }, svg);
  drawCounter(counterG);
  const world = GS.el('g', { class: 'world' }, svg);

  function drawCounter(g) {
    let s = '<rect x="-20" y="300" width="1320" height="520" fill="#C68A55"/>' +
      '<rect x="-20" y="306" width="1320" height="30" fill="#D9A270" opacity=".7"/>';
    [470, 640].forEach(y => { s += '<path d="M-20 ' + y + 'H1300" stroke="#8E5530" stroke-width="3" opacity=".45"/><path d="M-20 ' + (y + 3) + 'H1300" stroke="#E3B07D" stroke-width="2" opacity=".5"/>'; });
    const R = rng(7);
    for (let k = 0; k < 16; k++) {
      const x = R() * 1280, y = 340 + R() * 440, w = 60 + R() * 120;
      s += '<path d="M' + x.toFixed(0) + ' ' + y.toFixed(0) + 'q' + (w / 2).toFixed(0) + ' -8 ' + w.toFixed(0) + ' 0" fill="none" stroke="#A8673A" stroke-width="2.5" stroke-linecap="round" opacity=".35"/>';
    }
    s += '<rect x="-20" y="290" width="1320" height="16" fill="#7E4A27"/>' +
      '<path d="M-20 290H1300" stroke="' + OUT + '" stroke-width="3"/>' +
      '<path d="M-20 296H1300" stroke="#A8673A" stroke-width="3" opacity=".8"/>' +
      '<rect x="-20" y="770" width="1320" height="40" fill="' + OUT + '" opacity=".08"/>';
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
  let hintedDrag = false, guidesShown = false;
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
  function makeLevel(i) {
    switch (i) {
      case 0: return { kind: 'cut', food: 'martabak', people: pickPeople(2), knives: 2, say: 'Potong martabak jadi dua. Sama besar ya!' };
      case 1: return { kind: 'cut', food: 'lapis', people: pickPeople(2), knives: 2, say: 'Potong kue lapis untuk dua teman.' };
      case 2: return { kind: 'cut', food: 'martabak', people: pickPeople(4), knives: 3, say: 'Martabak untuk empat teman. Potong sama besar!' };
      case 3: return { kind: 'cut', food: 'lapis', people: pickPeople(4), knives: 4, say: 'Kue lapis untuk empat teman. Bentuknya boleh beda!' };
      case 4: return { kind: 'cut', food: 'lapis', people: pickPeople(3), knives: 3, labels: true, say: 'Kue lapis untuk tiga teman. Potong dua kali.' };
      case 5: {
        const p = pickPeople(2);
        return { kind: 'pick', people: p, orders: [F(1, 4), F(1, 4)], cards: true, plateScale: 0.9, say: p[0].name + ' dan ' + p[1].name + ' minta seperempat. Pilih yang pas!' };
      }
      case 6: {
        const p = pickPeople(2), h = GS.rand(0, 1);
        return { kind: 'hungry', people: p, hungry: h, labels: true, say: p[h].name + ' lapar sekali. Setengah atau seperempat? Beri yang lebih besar!' };
      }
      case 7: {
        const p = GS.shuffle(pickPeople(3, ['Siti', 'Budi', 'Ani']).map((q, k) => Object.assign(q, { order: [F(1, 2), F(1, 4), F(1, 4)][k] })));
        return { kind: 'cut', food: 'martabak', people: p, orders: p.map(q => q.order), cards: true, knives: 3, labels: true, say: 'Lihat pesanan di kartu. Potong, lalu bagikan!' };
      }
      case 8: return { kind: 'order', people: pickPeople(3), labels: true, plateScale: 0.9, say: 'Urutkan teman dari potongan terbesar.' };
      default: {
        const food = Math.random() < 0.5 ? 'roti' : 'lapis';
        const p = pickPeople(3);
        const ord = GS.shuffle([F(1, 2), F(1, 4), F(1, 4)]);
        return { kind: 'cut', food, people: p, orders: ord, cards: true, knives: 3, labels: true, say: 'Tantangan! Baca kartu pesanan, lalu potong.' };
      }
    }
  }

  function seatXs(n) {
    return { 1: [640], 2: [430, 850], 3: [330, 640, 950], 4: [262, 514, 766, 1018] }[n];
  }

  /* ================= build ================= */
  function buildLevel(i) {
    tok++;
    timers.forEach(t => clearTimeout(t)); timers.clear();
    world.innerHTML = ''; friendsG.innerHTML = ''; dock.innerHTML = '';
    pieces = []; friends = []; foods = [];
    busy = false; tries = 0; cutsMade = 0; hintedDrag = false; guidesShown = false;
    L = makeLevel(i);
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
      const body = GS.el('g', { transform: 'scale(1.5)' }, br);
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
      GS.markup(f.plate.el, plateMarkup());
      friends.push(f);
    });
  }
  function drawCard(f) {
    const sw = GS.el('g', { class: 'mk-card-swing' }, f.card);
    const hungryCard = L.kind === 'hungry';
    if (f.order || hungryCard) {
      const h = 132, w = 118, y0 = 22;
      GS.markup(sw, '<path d="M-26 0L0 ' + y0 + 'L26 0" fill="none" stroke="#7E4A27" stroke-width="3"/>' +
        '<rect x="' + (-w / 2 + 4) + '" y="' + (y0 + 6) + '" width="' + w + '" height="' + h + '" rx="16" fill="' + OUT + '" opacity=".18"/>' +
        '<rect x="' + (-w / 2) + '" y="' + y0 + '" width="' + w + '" height="' + h + '" rx="16" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="3.5"/>' +
        '<circle cx="0" cy="' + (y0 + 10) + '" r="5" fill="#E2453C" stroke="' + OUT + '" stroke-width="2"/>');
      if (f.order) GS.markup(sw, '<g transform="translate(0 ' + (y0 + 62) + ')">' + fracMarkup(f.order.n, f.order.d, 46, '#2B1D14') + '</g>');
      else {
        const hungry = f.k === L.hungry;
        GS.markup(sw, '<g transform="translate(0 ' + (y0 + 68) + ') scale(1.15)">' + faceMarkup(hungry ? 'hungry' : 'happy') + '</g>' +
          '<text class="mk-name" x="0" y="' + (y0 + 120) + '" text-anchor="middle" font-size="19" fill="#2B1D14">' + (hungry ? 'lapar!' : 'sedikit saja') + '</text>');
      }
      const t = GS.el('text', { class: 'mk-name', x: 0, y: y0 + h - 10, 'text-anchor': 'middle', 'font-size': 21, fill: '#2B1D14' }, sw);
      t.textContent = f.name;
      if (!f.order) t.setAttribute('y', y0 + 30);
    } else {
      const w = Math.max(96, f.name.length * 13 + 36), y0 = 112;
      GS.markup(sw, '<path d="M0 0V' + y0 + '" stroke="#7E4A27" stroke-width="3"/>' +
        '<rect x="' + (-w / 2 + 3) + '" y="' + (y0 + 5) + '" width="' + w + '" height="46" rx="14" fill="' + OUT + '" opacity=".18"/>' +
        '<rect x="' + (-w / 2) + '" y="' + y0 + '" width="' + w + '" height="46" rx="14" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="3.5"/>');
      const t = GS.el('text', { class: 'mk-name', x: 0, y: y0 + 31, 'text-anchor': 'middle', 'font-size': 23, fill: '#2B1D14' }, sw);
      t.textContent = f.name;
    }
  }

  function boardCenter() { return { x: 640, y: 590 }; }

  function drawLoyang(c) {
    const g = GS.el('g', { transform: 'translate(' + c.x + ' ' + c.y + ')' }, layers.board);
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
    const any = pieces.some(p => !p.plate && p.food.def === FOOD.martabak);
    steamG.style.display = any ? '' : 'none';
  }

  function makeFood(type, ox, oy) {
    const def = FOOD[type];
    const f = { id: ++foodSeq, type, def, ox, oy, poly: foodPoly(def) };
    f.area = Geo.absArea(f.poly);
    f.artId = 'mkart' + f.id;
    const g = GS.el('g', { id: f.artId }, defs);
    const seed = (Math.random() * 1e9) | 0;
    if (def.shape === 'circle') GS.markup(g, martabakArt(def.r, seed));
    else if (def.shape === 'rect') GS.markup(g, lapisArt(def.w, def.h, def.layers));
    else GS.markup(g, rotiArt(def.w, def.h, def.rr, seed, f.id));
    foods.push(f);
    return f;
  }

  /* ================= pieces ================= */
  function makePiece(food, poly, pos) {
    const c = Geo.centroid(poly);
    const p = {
      id: ++pieceSeq, food, poly, c, bb: Geo.bbox(poly), area: Geo.absArea(poly),
      pos: pos || { x: food.ox + c.x, y: food.oy + c.y }, rot: 0, s: 1, sx: 1, sy: 1, lift: 1,
      plate: null, locked: false, tagD: 0
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
    p.hitSmall = p.bb.w < 64 || p.bb.h < 64;
    setHit(p);
    GS.drag(g, {
      svg,
      onStart: pt => { if (busy || p.locked || L.kind === 'order') return false; startDrag(p, pt); },
      onMove: pt => moveDrag(p, pt),
      onEnd: pt => endDrag(p, pt)
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
    const bb = p.bb, on = !!p.plate, need = on ? 84 / L.plateScale : 72;
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
      const k = (p.plate ? 0.85 : 1) / Math.max(0.2, s);
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
    for (const d of [2, 3, 4]) if (Math.abs((p.area / unit) * d - 1) <= TOL) return d;
    return 0;
  }
  function setTag(p, d) {
    if (p.tag) { p.tag.remove(); p.tag = null; }
    p.tagD = d || 0;
    if (!d) return;
    p.tag = GS.el('g', { 'pointer-events': 'none' }, p.el);
    const inner = GS.el('g', null, p.tag);
    GS.markup(inner, tagMarkup(d));
    applyT(p);
    tw(320, e => inner.setAttribute('transform', 'scale(' + e.toFixed(3) + ')'), 'outBack');
  }
  function refreshTags() { if (!L.labels) return; pieces.forEach(p => { const d = fracOf(p); if (d !== p.tagD) setTag(p, d); }); }

  /* ================= dragging pieces ================= */
  let drag = null;
  function scaleAt(y) { const k = GS.clamp((y - (PLATE_Y + 30)) / 170, 0, 1); return GS.lerp(L.plateScale, 1, k); }
  function startDrag(p, pt) {
    const from = { pos: { ...p.pos }, s: p.s, plate: p.plate };
    if (p.plate) { const pl = p.plate; pl.pieces = pl.pieces.filter(q => q !== p); p.plate = null; layoutPlate(pl, true); setHit(p); }
    drag = { p, from };
    layers.pieces.appendChild(p.el);
    p.el.style.cursor = 'grabbing';
    GS.sfx.pick();
    tw(120, e => { p.lift = 1 + 0.15 * e; p.shadow.setAttribute('transform', 'translate(' + (5 + 9 * e).toFixed(1) + ' ' + (8 + 14 * e).toFixed(1) + ')'); moveDrag(p, pt); }, 'outBack');
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
    pl.pieces.forEach((p, i) => {
      const spread = k > 1 ? Math.min(64, 150 / (k - 1)) : 0;
      const t = { x: pl.x + (i - (k - 1) / 2) * spread, y: pl.y - 12 + (k > 1 ? (i % 2 ? 7 : -5) : 0) };
      const s0 = p.s, r0 = p.rot, c0 = centerOf(p);
      const end = () => { p.s = L.plateScale; p.rot = 0; p.pos = posForCenter(p, t); applyT(p); };
      if (!animate) { end(); return; }
      tw(170, e => {
        p.s = GS.lerp(s0, L.plateScale, e); p.rot = GS.lerp(r0, 0, e);
        p.pos = posForCenter(p, { x: GS.lerp(c0.x, t.x, e), y: GS.lerp(c0.y, t.y, e) }); applyT(p);
      }).then(() => { if (p.plate === pl) end(); });
    });
  }

  /* ================= cutting ================= */
  let cutting = null;
  function buildCutLevel() {
    const c = boardCenter();
    const def = FOOD[L.food];
    if (def.shape === 'circle') { drawLoyang(c); }
    else drawTalenan(c, def.w + 100, def.h + 84, def.shape === 'rect' ? { w: def.w + 34, h: def.h + 30 } : null);
    guideG = GS.el('g', { opacity: 0 }, layers.board);
    const food = makeFood(L.food, c.x, c.y);
    L.unit = food.area;
    L.foodRef = food;
    makePiece(food, food.poly.map(q => ({ x: q.x, y: q.y, cut: false })));
    if (def.shape === 'circle') drawSteam(c);
    knives = L.knives;
    drawKnifeRack();
    // the cutting surface: strokes must start outside the food
    const zone = GS.el('rect', { x: 100, y: 318, width: 1080, height: 482, fill: '#000', 'fill-opacity': 0 }, layers.zone);
    zone.style.cursor = 'crosshair';
    cutting = null;
    GS.drag(zone, {
      svg,
      onStart: pt => {
        if (busy) return false;
        if (knives <= 0) { GS.sfx.oops(); hud.mood('think'); GS.say('Pisaunya habis. Bagikan, atau tekan Ulang.'); wobbleEl(knifeRack); return false; }
        cutting = { a: pt, b: pt };
        drawCutPreview();
      },
      onMove: pt => { if (!cutting) return; cutting.b = pt; drawCutPreview(); },
      onEnd: pt => { if (!cutting) return; cutting.b = pt; const cu = cutting; cutting = null; clearCutPreview(); performCut(cu.a, cu.b); }
    });
  }
  let previewG = null;
  function drawCutPreview() {
    if (!previewG) previewG = GS.el('g', null, layers.fx);
    if (!previewG.parentNode) layers.fx.appendChild(previewG);
    previewG.innerHTML = '';
    const a = cutting.a, b = cutting.b;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const info = cutInfo(a, b);
    const col = info.hits.length ? '#0F8C7A' : OUT;
    if (len > 4) {
      GS.el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#fff', 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0.75 }, previewG);
      GS.el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: col, 'stroke-width': 4.5, 'stroke-dasharray': '14 10', 'stroke-linecap': 'round' }, previewG);
      info.hits.forEach(h => {
        if (h.snapped && h.p.food.def.shape === 'circle') {
          const w = toWorld(h.p, { x: 0, y: 0 });
          GS.markup(GS.el('g', { transform: 'translate(' + w.x.toFixed(1) + ' ' + w.y.toFixed(1) + ')' }, previewG), '<circle class="mk-snapdot" r="9" fill="#FFC83D" stroke="' + OUT + '" stroke-width="3"/>');
        }
      });
    }
    GS.el('circle', { cx: a.x, cy: a.y, r: 7, fill: col, stroke: '#fff', 'stroke-width': 3 }, previewG);
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    const flip = Math.cos(ang * Math.PI / 180) < 0 ? ' scale(1 -1)' : '';
    GS.markup(GS.el('g', { transform: 'translate(' + b.x.toFixed(1) + ' ' + b.y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')' + flip }, previewG), knifeMarkup());
  }
  function clearCutPreview() { if (previewG) previewG.innerHTML = ''; }
  /** Which board pieces does segment a->b fully cross, and how would each split. */
  function cutInfo(A, B) {
    const hits = [];
    for (const p of pieces) {
      if (p.plate || p.locked) continue;
      const a = toLocal(p, A), b = toLocal(p, B);
      const ch = Geo.chord(p.poly, a, b);
      if (!ch || ch[0] <= 0 || ch[1] >= 1) continue;     // must enter and leave the piece
      const sn = snapLine(p.food.def, a, b);
      const parts = Geo.split(p.poly, sn.a, sn.b);
      if (!parts[0] || !parts[1]) continue;
      if (Math.min(Geo.absArea(parts[0]), Geo.absArea(parts[1])) < 0.01 * p.food.area) continue;
      hits.push({ p, parts, la: sn.a, lb: sn.b, snapped: sn.snapped });
    }
    return { hits };
  }
  function performCut(A, B) {
    if (Math.hypot(B.x - A.x, B.y - A.y) < 20) return false;
    const { hits } = cutInfo(A, B);
    if (!hits.length) {
      GS.sfx.tick(); hud.mood('think');
      GS.say('Tarik pisaunya sampai lewat ujung ya.');
      return false;
    }
    knives--; cutsMade++;
    updateKnives();
    GS.sfx.whoosh();
    // slash flash along the (possibly snapped) line
    const h0 = hits[0], fa = toWorld(h0.p, h0.la), fb = toWorld(h0.p, h0.lb);
    const dx = fb.x - fa.x, dy = fb.y - fa.y, ln = Math.hypot(dx, dy) || 1;
    const ext = 260, flash = GS.el('line', { x1: fa.x - dx / ln * ext, y1: fa.y - dy / ln * ext, x2: fb.x + dx / ln * ext, y2: fb.y + dy / ln * ext, stroke: '#fff', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0.9 }, layers.fx);
    tw(380, e => { flash.setAttribute('opacity', (0.9 * (1 - e)).toFixed(3)); flash.setAttribute('stroke-width', (8 * (1 - e) + 1).toFixed(2)); }).then(() => flash.remove());
    for (const h of hits) {
      const p = h.p;
      const ddx = h.lb.x - h.la.x, ddy = h.lb.y - h.la.y, L2 = Math.hypot(ddx, ddy) || 1;
      const n = { x: -ddy / L2, y: ddx / L2 };
      removePiece(p);
      h.parts.forEach(part => {
        const c2 = Geo.centroid(part);
        const np = makePiece(p.food, part, { x: p.pos.x + (c2.x - p.c.x), y: p.pos.y + (c2.y - p.c.y) });
        const sd = Math.sign((c2.x - h.la.x) * n.x + (c2.y - h.la.y) * n.y) || 1;
        const p0 = { ...np.pos };
        tw(420, e => { np.pos = { x: p0.x + n.x * sd * GAP * e, y: p0.y + n.y * sd * GAP * e }; applyT(np); }, 'outBack');
      });
    }
    later(120, () => GS.sfx.pop());
    refreshTags();
    updateSteam(); updateButtons();
    if (!hintedDrag) { hintedDrag = true; later(700, () => { if (!busy) GS.say('Seret potongan ke piring teman.'); }); }
    return true;
  }
  function drawKnifeRack() {
    knifeRack = GS.el('g', null, GS.el('g', { transform: 'translate(180 470)' }, layers.board));
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
      GS.markup(GS.el('g', { transform: 'translate(' + x + ' 26) rotate(90) scale(.55)', opacity: used ? 0.22 : 1 }, knifeRack), knifeMarkup());
    }
    const b = GS.el('g', { transform: 'translate(' + (w / 2 - 4) + ' 2)' }, knifeRack);
    GS.markup(b, '<circle r="22" fill="#1F6FD1" stroke="' + OUT + '" stroke-width="3.5"/>');
    const t = GS.el('text', { y: 9, 'text-anchor': 'middle', 'font-size': 26, fill: '#fff', class: 'gs-num' }, b);
    t.textContent = String(knives);
  }
  function wobbleEl(el) { if (!el) return; el.classList.remove('gs-wobble'); void el.getBBox(); el.classList.add('gs-wobble'); later(450, () => el.classList.remove('gs-wobble')); }

  function showGuides() {
    if (guidesShown || !guideG || L.kind !== 'cut') return;
    guidesShown = true;
    const food = L.foodRef, def = food.def, c = { x: food.ox, y: food.oy };
    const n = L.orders ? (L.orders.some(o => o.d === 3) ? 3 : 4) : L.people.length;
    let s = '';
    const dot = (x, y) => '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="8" fill="#FFC83D" stroke="' + OUT + '" stroke-width="3"/>';
    if (def.shape === 'circle') {
      const steps = n === 2 ? 2 : 4;
      for (let k = 0; k < steps; k++) { const t = (k / steps) * Math.PI * 2 - Math.PI / 2; s += dot(c.x + Math.cos(t) * (def.r + 18), c.y + Math.sin(t) * (def.r + 18)); }
    } else {
      const hw = def.w / 2, hh = def.h / 2;
      const parts = n === 3 ? [1 / 3, 2 / 3] : n === 2 ? [0.5] : [0.5];
      parts.forEach(f => {
        s += dot(c.x - hw - 20, c.y - hh + def.h * f) + dot(c.x + hw + 20, c.y - hh + def.h * f);
        if (n !== 3) s += dot(c.x - hw + def.w * f, c.y - hh - 20) + dot(c.x - hw + def.w * f, c.y + hh + 20);
      });
    }
    GS.markup(guideG, s);
    tw(400, e => guideG.setAttribute('opacity', e.toFixed(2)));
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
    const c = { x: 540, y: 575 };
    drawTalenan(c, 790, 250, null);
    const xs = GS.shuffle([290, 540, 790]);
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
  function buildOrderLevel() {
    const c = { x: 560, y: 600 };
    drawTalenan(c, 790, 230, null);
    // "besar -> kecil" sign between the plates and the board
    const xs = seatXs(3);
    let s = '<rect x="' + (xs[0] - 70) + '" y="424" width="' + (xs[2] - xs[0] + 140) + '" height="40" rx="20" fill="#FFF8EC" stroke="' + OUT + '" stroke-width="3"/>' +
      '<path d="M' + (xs[0] + 30) + ' 444H' + (xs[2] - 40) + '" stroke="#1F6FD1" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M' + (xs[2] - 50) + ' 432L' + (xs[2] - 30) + ' 444L' + (xs[2] - 50) + ' 456" fill="none" stroke="#1F6FD1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + (xs[0] - 42) + '" cy="444" r="14" fill="#F28C28" stroke="' + OUT + '" stroke-width="2.5"/>' +
      '<circle cx="' + (xs[2] + 46) + '" cy="444" r="6" fill="#F28C28" stroke="' + OUT + '" stroke-width="2.5"/>';
    GS.markup(layers.signs, s);
    const lbl = (x, t) => { const e = GS.el('text', { class: 'mk-name', x, y: 452, 'text-anchor': 'middle', 'font-size': 22, fill: '#2B1D14' }, layers.signs); e.textContent = t; };
    lbl(xs[0] + 6, 'besar'); lbl(xs[2] - 4, 'kecil');
    const cxs = [310, 560, 810];
    const ds = GS.shuffle([2, 3, 4]);
    const opts = { 2: [[V(0)], [Hz(0)]], 3: [[V(-100 / 3), V(100 / 3)], [Hz(-20), Hz(20)]], 4: [[V(-50), V(0), V(50)], [V(0), Hz(0)], [Hz(-30), Hz(0), Hz(30)]] };
    const given = [];
    ds.forEach((d, i) => {
      const food = makeFood('lapisKecil', cxs[i], c.y + 4);
      const choice = opts[d][GS.rand(0, opts[d].length - 1)];
      const ps = placePrecut(food, cutAll(food.poly, choice), 6);
      ps.forEach(p => { p.locked = true; p.el.style.pointerEvents = 'none'; });
      given.push(ps[GS.rand(0, ps.length - 1)]);
    });
    L.unit = foods[0].area;
    refreshTags();
    // make sure the starting order is not already sorted
    let order = GS.shuffle([0, 1, 2]);
    const sorted = o => given[o[0]].area > given[o[1]].area && given[o[1]].area > given[o[2]].area;
    while (sorted(order)) order = GS.shuffle([0, 1, 2]);
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
    if (L.kind === 'cut') {
      if (cutsMade > 0) tries++;
      pieces.slice().forEach(removePiece);
      friends.forEach(f => { f.plate.pieces = []; });
      const food = L.foodRef;
      makePiece(food, food.poly.map(q => ({ x: q.x, y: q.y, cut: false })));
      knives = L.knives; cutsMade = 0;
      updateKnives(); updateSteam();
      GS.sfx.whoosh();
      GS.say(food.def.label === 'martabak' ? 'Martabak utuh lagi. Ayo potong!' : 'Utuh lagi. Ayo potong!');
    } else if (L.kind === 'order') {
      // back to the starting seats
      GS.sfx.whoosh();
    } else {
      pieces.forEach(p => {
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
    const n = friends.length;
    const shares = friends.map(shareOf);
    const targets = friends.map(f => (f.order ? f.order.v : 1 / n));
    const ratios = shares.map((s, i) => s / targets[i]);
    const fair = ratios.every(r => Math.abs(r - 1) <= TOL);
    hud.mood('think');
    if (!(await pause(350))) return;
    if (fair) return celebrateFair(my);
    tries++;
    const iMin = ratios.indexOf(Math.min(...ratios)), iMax = ratios.lastIndexOf(Math.max(...ratios));
    const fMin = friends[iMin], fMax = friends[iMax];
    const equalButShort = L.kind === 'cut' && ratios[iMax] / ratios[iMin] <= 1 + TOL && ratios[iMax] < 1;
    GS.sfx.oops(); hud.mood('oops');
    if (equalButShort) {
      GS.say('Masih ada sisa. Bagi habis ya!');
      friends.forEach(f => wobbleEl(f.tilt));
      pieces.filter(p => !p.plate).forEach(p => squash(p));
      if (!(await pause(1400))) return;
    } else {
      if (ratios[iMin] < 1 - TOL) sulk(fMin); else mood(fMax, 'puzzled', 2600);
      let line;
      if (L.orders) {
        if (ratios[iMin] < 1 - TOL) line = fMin.name + ' minta ' + FR[fMin.order.d] + '. Dapatnya kurang.';
        else line = fMax.name + ' dapat lebih dari ' + FR[fMax.order.d] + '.';
      } else line = fMin.name + ' dapat lebih sedikit. Lihat bedanya!';
      GS.say(line);
      const big = shares[iMax] >= shares[iMin] ? fMax : fMin, small = big === fMax ? fMin : fMax;
      if (fMin !== fMax && Math.abs(shares[iMax] - shares[iMin]) > TOL * Math.min(shares[iMax], shares[iMin])) {
        await stackCompare(big.plate.pieces.slice(), small.plate.pieces.slice(), my);
      } else if (!(await pause(2000))) return;
      if (my !== tok) return;
    }
    unsulkAll();
    afterFail();
  }
  function afterFail() {
    busy = false; updateButtons(); hud.mood('think');
    if (tries >= 2 && L.kind === 'cut' && !guidesShown) { showGuides(); later(300, () => GS.say('Ada titik bantu di pinggir. Coba lagi!')); }
  }
  async function judgeHungry(my) {
    const fh = friends[L.hungry], fo = friends[1 - L.hungry];
    const sh = shareOf(fh), so = shareOf(fo);
    if (!(await pause(350))) return;
    if (sh > so * (1 + TOL)) return celebrateFair(my);
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
  async function stackCompare(big, small, my) {
    if (!big.length || !small.length) { await pause(1200); return; }
    const C = { x: 640, y: 590 };
    const dim = GS.el('rect', { x: 0, y: 306, width: 1280, height: 494, fill: '#FFF8EC', opacity: 0 }, layers.dim);
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
    bigPolys.forEach(pl => GS.el('polygon', { class: 'mk-diff', points: pts(pl), fill: 'none', stroke: '#F2A900', 'stroke-width': 7, 'stroke-dasharray': '16 10', 'stroke-linejoin': 'round' }, out));
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
    let text = 'Adil! Semua sama besar!';
    const shapes = friends.map(f => f.plate.pieces);
    if (L.index === 1) text = shapes.some(ps => ps.some(p => p.poly.length === 3)) ? 'Potongan miring juga adil!' : 'Setengah dan setengah. Adil!';
    else if (L.index === 0) text = 'Dua bagian sama besar. Setengah!';
    else if (L.index === 2) text = 'Empat bagian sama. Seperempat!';
    else if (L.index === 3) {
      const asp = shapes.map(ps => ps.length === 1 ? (ps[0].bb.w / ps[0].bb.h).toFixed(1) + ps[0].poly.length : 'x');
      text = new Set(asp).size > 1 ? 'Bentuknya beda, tetap seperempat!' : 'Seperempat semua. Adil!';
    } else if (L.index === 4) text = 'Tiga bagian sama. Sepertiga!';
    else if (L.kind === 'pick') text = 'Bentuknya beda, sama-sama seperempat!';
    else if (L.kind === 'hungry') text = 'Setengah lebih besar dari seperempat!';
    else if (L.kind === 'order') text = 'Setengah, sepertiga, seperempat. Pas!';
    else if (L.orders) text = 'Pesanan pas semua. Hebat!';
    GS.say(text);
    // labels appear after the child made the pieces (concreteness fading)
    if (L.index >= 4) friends.forEach(f => f.plate.pieces.forEach(p => { if (!p.tag) { const d = fracOf(p); if (d) setTag(p, d); } }));
    if (L.kind === 'pick') await pickDemo(my);
    if (my !== tok) return;
    for (const f of friends) { eat(f, my); if (!(await pause(320))) return; }
    if (!(await pause(1200))) return;
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
    const C = { x: 640, y: 560 };
    const dim = GS.el('rect', { x: 0, y: 306, width: 1280, height: 494, fill: '#FFF8EC', opacity: 0.72 }, layers.fx);
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
    while (busy) { await GS.wait(100); if (my !== tok) return; }
    const wait = ms => GS.wait(ms);
    const boardPieces = () => pieces.filter(p => !p.plate && !p.locked);
    const cutThrough = async (p, a, b) => {      // a, b local points of piece p (line through the food frame)
      const A = toWorld(p, a), B = toWorld(p, b);
      const dx = B.x - A.x, dy = B.y - A.y, ln = Math.hypot(dx, dy);
      const ok = performCut({ x: A.x - dx / ln * 400, y: A.y - dy / ln * 400 }, { x: B.x + dx / ln * 400, y: B.y + dy / ln * 400 });
      await wait(500);
      return ok;
    };
    const give = async (p, f) => { putOnPlate(p, f.plate); updateButtons(); await wait(200); };
    if (L.kind === 'cut') {
      const def = L.foodRef.def, n = friends.length;
      const p0 = boardPieces()[0];
      if (L.orders) {
        // half + two quarters
        await cutThrough(p0, { x: 0, y: -10 }, { x: 0, y: 10 });
        const halves = boardPieces().sort((a, b) => a.c.x - b.c.x);
        const fh = friends.find(f => f.order.d === 2), fq = friends.filter(f => f.order.d === 4);
        await give(halves[0], fh);
        await cutThrough(halves[1], { x: -10, y: 0 }, { x: 10, y: 0 });
        const qs = boardPieces();
        await give(qs[0], fq[0]); await give(qs[1], fq[1]);
      } else if (n === 2) {
        await cutThrough(p0, { x: 0, y: -10 }, { x: 0, y: 10 });
        const hs = boardPieces(); await give(hs[0], friends[0]); await give(hs[1], friends[1]);
      } else if (n === 4) {
        await cutThrough(p0, { x: 0, y: -10 }, { x: 0, y: 10 });
        const hs = boardPieces();
        await cutThrough(hs[0], { x: -10, y: 0 }, { x: 10, y: 0 });
        const rest = boardPieces().filter(p => Math.abs(p.area / L.unit - 0.5) < 0.05);
        if (rest[0]) await cutThrough(rest[0], { x: -10, y: 0 }, { x: 10, y: 0 });
        const qs = boardPieces(); for (let k = 0; k < 4; k++) await give(qs[k], friends[k]);
      } else if (n === 3) {
        const h = def.h, y1 = -h / 2 + h / 3, y2 = -h / 2 + 2 * h / 3;
        await cutThrough(p0, { x: -10, y: y1 }, { x: 10, y: y1 });
        const big = boardPieces().sort((a, b) => b.area - a.area)[0];
        await cutThrough(big, { x: -10, y: y2 }, { x: 10, y: y2 });
        const qs = boardPieces(); for (let k = 0; k < 3; k++) await give(qs[k], friends[k]);
      }
    } else if (L.kind === 'pick') {
      const grid = L.cakes.find(c => c.k === 'grid').pieces[0], strip = L.cakes.find(c => c.k === 'strip4').pieces[0];
      await give(grid, friends[0]); await give(strip, friends[1]);
    } else if (L.kind === 'hungry') {
      await give(L.half, friends[L.hungry]); await give(L.quarter, friends[1 - L.hungry]);
    } else if (L.kind === 'order') {
      for (let k = 0; k < 3; k++) {
        const xs = seatXs(3);
        const seated = xs.map(x => friends.find(f => f.x === x));
        const want = seated.slice().sort((a, b) => shareOf(b) - shareOf(a))[k];
        const i = seatIndex(want);
        if (i !== k) { swapSeats(i, k); await wait(400); }
      }
    }
    await wait(300);
    if (my !== tok) return;
    onGo();
  }
  window.__game = {
    go: i => run.go(i),
    solve,
    get state() { return { level: run.current, kind: L && L.kind, tries, knives, busy, pieces: pieces.map(p => ({ area: +(p.area / L.unit).toFixed(4), plate: p.plate ? friends.indexOf(p.plate.friend) : -1, tag: p.tagD })) }; },
    cut: (a, b) => performCut(a, b),
    give: (pi, fi) => { putOnPlate(pieces[pi], friends[fi].plate); updateButtons(); },
    bagikan: () => onGo(),
    reset: () => onReset(),
    toScreen(x, y) { const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; const m = svg.getScreenCTM(); const r = pt.matrixTransform(m); return { x: r.x, y: r.y }; },
    centerOfPiece: i => centerOf(pieces[i]),
    geo: Geo
  };

  run.go(GS.store.nextLevel(GAME, 10));
})();
