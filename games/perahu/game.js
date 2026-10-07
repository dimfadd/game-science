/* Rakit Terapung (perahu)
 * A (L1-4)  predict float/sink, then drop items into a glass aquarium (buoyancy sim).
 * B (L5-8)  load a bamboo raft up to its capacity K kg, then paddle across.
 * C (L9-10) same lump of plastisin as ball / boat / bowl: how many marbles before it sinks?
 * Physics: fixed timestep 1/120 s, semi-implicit Euler, g = 9.8 m/s^2 at 100 units per metre.
 * A body of density rho and height H floats with submerged depth rho*H (water rho = 1). */
(function () {
  'use strict';
  const GAME = 'perahu';
  const el = GS.el;
  const clamp = GS.clamp;
  const OUT = '#3B2A20';
  const G = 980, DT = 1 / 120, ZETA = 0.32, CQ = 0.9, RHO_W = 1.0;
  const DBG = { fast: false };

  const LEVELS = ['A', 'A', 'A', 'A', 'B', 'B', 'B', 'B', 'C', 'C'];

  /* ---------------- materials ---------------- */
  // rho: density relative to water. s: drawn scale (size never encodes weight). air: air drag for light, wide things.
  const MAT = {
    gabus: { rho: 0.05, label: 'gabus', s: 0.85 },
    bulu: { rho: 0.1, label: 'bulu', s: 0.8, air: 5 },
    botol: { rho: 0.3, label: 'botol tertutup', s: 0.85 },
    daun: { rho: 0.5, label: 'daun', s: 0.8, air: 2.5 },
    kayu: { rho: 0.6, label: 'kayu', s: 1.15 },
    apel: { rho: 0.8, label: 'apel', s: 0.7 },
    kelapa: { rho: 0.9, label: 'kelapa', s: 1.0 },
    es: { rho: 0.92, label: 'es batu', s: 0.75 },
    plastisin: { rho: 1.5, label: 'plastisin', s: 0.6 },
    kelereng: { rho: 2.5, label: 'kelereng', s: 0.42 },
    batu: { rho: 2.6, label: 'batu', s: 0.72 },
    gembok: { rho: 7.5, label: 'gembok', s: 0.6 },
    koin: { rho: 7.1, label: 'koin', s: 0.45 },
    sendok: { rho: 7.8, label: 'sendok', s: 0.8 },
    paku: { rho: 7.8, label: 'paku', s: 0.5 },
    baut: { rho: 7.8, label: 'baut', s: 0.5 }
  };
  const WHY = {
    kayu: 'Kayu ringan untuk ukurannya, jadi terapung.',
    paku: 'Paku kecil, tapi padat. Tenggelam!',
    gabus: 'Gabus sangat ringan untuk ukurannya. Terapung tinggi!',
    batu: 'Batu padat untuk ukurannya. Tenggelam.',
    kelapa: 'Kelapa besar, tapi berserat dan berongga. Terapung!',
    koin: 'Koin kecil, tapi logamnya padat. Tenggelam!',
    apel: 'Apel menyimpan udara di dalamnya. Terapung!',
    kelereng: 'Kelereng kecil dari kaca padat. Tenggelam!',
    es: 'Es terapung, tapi hampir seluruhnya terendam.',
    sendok: 'Sendok dari logam padat. Tenggelam!',
    botol: 'Botol tertutup berisi udara. Terapung!',
    daun: 'Daun tipis dan ringan. Terapung.',
    bulu: 'Bulu sangat ringan. Terapung di atas air.',
    gembok: 'Gembok dari logam padat. Tenggelam.',
    baut: 'Baut kecil, tapi logamnya padat. Tenggelam!',
    plastisin: 'Plastisin sedikit lebih padat dari air. Tenggelam pelan.'
  };
  const PAIRS = [['kayu', 'paku'], ['kelapa', 'koin'], ['apel', 'kelereng'], ['es', 'sendok'], ['gabus', 'batu']];
  const EXTRA = ['botol', 'daun', 'bulu', 'gembok', 'baut', 'plastisin'];
  const CARGO = {
    karung: { rho: 1.6, label: 'karung pasir', k: 0.74 },
    keranjang: { rho: 0.6, label: 'keranjang buah', k: 0.74 },
    kantong: { rho: 2.0, label: 'kantong paku', k: 0.72 },
    semangka: { rho: 0.95, label: 'semangka', k: 0.7 },
    kelapa: { rho: 0.9, label: 'kelapa', k: 0.62 }
  };

  /* ---------------- art wrappers (never throw) ---------------- */
  const art = () => GS.art || {};
  function artMeta(n) { try { return (art().meta && art().meta(n)) || {}; } catch (e) { return {}; } }
  function artItem(n) {
    try {
      const has = !art().names || art().names().indexOf(n) >= 0;
      if (art().item && has) return art().item(n, { shadow: false });
    } catch (e) { /* fall through */ }
    if (n === 'plastisin') return lumpMarkup();
    return '<circle cx="0" cy="-40" r="36" fill="#F3DDA6" stroke="' + OUT + '" stroke-width="4"/><text x="0" y="-28" text-anchor="middle" font-size="32" fill="#2B1D14">' + n.charAt(0).toUpperCase() + '</text>';
  }
  function artPerson(i) {
    try { if (art().person) return art().person(i); } catch (e) { /* fall through */ }
    return '<path d="M-22 0v-46a22 22 0 0 1 44 0V0z" fill="#2F80C9" stroke="' + OUT + '" stroke-width="4"/><circle cx="0" cy="-70" r="22" fill="#E0A86E" stroke="' + OUT + '" stroke-width="4"/>';
  }
  function density(n) {
    const mine = MAT[n] ? MAT[n].rho : 1.5;
    const d = +artMeta(n).density;
    // Use the shared table when present, but never a near-neutral value (visually ambiguous).
    if (d > 0 && Math.abs(d - 1) > 0.03) return d;
    return mine;
  }
  function labelOf(n) { return (MAT[n] && MAT[n].label) || String(artMeta(n).label || n).toLowerCase(); }

  // Plastisin lump drawn here (not in the shared library). Bottom-centre origin.
  const PL = { b: '#F59AB0', s: '#D9738E', h: '#FBC3D0', in: '#C45E7A' };
  function lumpMarkup() {
    return '<path d="M-44 -4 C-52 -30 -36 -58 -8 -60 C20 -64 46 -46 46 -22 C47 -6 34 2 0 1 C-24 1 -40 2 -44 -4Z" fill="' + PL.b + '" stroke="' + OUT + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<ellipse cx="-16" cy="-40" rx="14" ry="8" fill="' + PL.h + '" transform="rotate(-18 -16 -40)"/>' +
      '<path d="M14 -6 C30 -8 40 -16 40 -28" fill="none" stroke="' + PL.s + '" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M-20 -22 q8 -6 16 0 M6 -40 q8 -6 14 0" fill="none" stroke="' + PL.s + '" stroke-width="2.5" stroke-linecap="round"/>';
  }

  /* ---------------- page skeleton ---------------- */
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const hud = GS.hud({ gameId: GAME, title: 'Rakit Terapung', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: buildLevel });

  const defs = el('defs', null, svg);
  defs.innerHTML =
    '<pattern id="pr-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.6" fill="#fff" fill-opacity=".5"/><circle cx="12" cy="12" r="2.6" fill="#fff" fill-opacity=".5"/></pattern>' +
    '<pattern id="pr-stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="14" fill="#fff" fill-opacity=".42"/></pattern>' +
    '<linearGradient id="pr-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ED8EC"/><stop offset="1" stop-color="#E6F5F0"/></linearGradient>';
  const bg = el('g', { class: 'bg' }, svg);
  try {
    if (art().scene) GS.markup(bg, art().scene('sungai', 1280, 800));
    else el('rect', { width: 1280, height: 800, fill: 'url(#pr-sky)' }, bg);
  } catch (e) { el('rect', { width: 1280, height: 800, fill: 'url(#pr-sky)' }, bg); }
  const world = el('g', { class: 'world' }, svg);

  let gen = 0, tries = 0, S = {};

  /* ---------------- small helpers ---------------- */
  const T = (ms, fn, ease) => GS.tween(DBG.fast ? Math.max(16, ms / 6) : ms, fn, ease);
  const W = ms => GS.wait(DBG.fast ? Math.min(ms, 40) : ms);
  const f1 = v => Math.round(v * 10) / 10;
  function waitUntil(fn, max) {
    const my = gen, t0 = performance.now(), lim = DBG.fast ? max / 2 : max;
    return new Promise(res => {
      (function poll() {
        if (my !== gen) return; // level changed: let the old flow die quietly
        if (fn() || performance.now() - t0 > lim) return res();
        setTimeout(poll, 40);
      })();
    });
  }
  function say(text, mood) { if (mood) hud.mood(mood); GS.say(text); }
  function sayWait(text, mood) { say(text, mood); return W(clamp(text.length * 58, 1300, 3800)); }
  function toScreen(x, y) { const m = svg.getScreenCTM(); return m ? { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f } : { x, y }; }
  function txt(parent, x, y, s, a) {
    const t = el('text', Object.assign({ x, y, 'text-anchor': 'middle', fill: '#2B1D14' }, a || {}), parent);
    t.textContent = s; return t;
  }
  function button(label, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gs-action' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', () => { GS.sfx.click(); onClick(); });
    dock.appendChild(b);
    return b;
  }
  function measure(markup, key) {
    if (key && measure.c[key]) return measure.c[key];
    const g = el('g', { visibility: 'hidden' }, svg);
    GS.markup(g, markup);
    let b = null;
    try { b = g.getBBox(); } catch (e) { b = null; }
    g.remove();
    if (!b || !b.height) b = { x: -40, y: -80, width: 80, height: 80 };
    const r = { x: b.x, top: b.y, bottom: b.y + b.height, w: b.width, h: b.height };
    if (key) measure.c[key] = r;
    return r;
  }
  measure.c = {};
  function wavePath(x0, x1, y, amp, P) {
    let d = 'M' + x0 + ' ' + y;
    for (let x = x0; x < x1; x += P) d += ' q' + P / 4 + ' ' + -amp + ' ' + P / 2 + ' 0 t' + P / 2 + ' 0';
    return d;
  }
  function sparkle(layer, x, y) {
    GS.sfx.coin();
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 - Math.PI / 2, r = 34 + (i % 2) * 12;
      const g = el('g', { transform: 'translate(' + x + ' ' + y + ')' }, layer);
      el('path', { d: 'M0 -11 Q2 -2 11 0 Q2 2 0 11 Q-2 2 -11 0 Q-2 -2 0 -11Z', fill: '#FFC83D', stroke: OUT, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
      T(650, (e, p) => {
        const s = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65 * 0.6;
        g.setAttribute('transform', 'translate(' + f1(x + Math.cos(a) * r * e) + ' ' + f1(y + Math.sin(a) * r * e) + ') scale(' + f1(s * 1.2) + ')');
        g.setAttribute('opacity', p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3);
      }).then(() => g.remove());
    }
  }

  /* ---------------- fixed-step simulation ---------------- */
  const sim = { bodies: [], fx: [], springs: [], raf: 0, last: 0, acc: 0 };
  function simReset() { cancelAnimationFrame(sim.raf); sim.raf = 0; sim.bodies = []; sim.fx = []; sim.springs = []; sim.acc = 0; }
  function kick() { if (!sim.raf) { sim.last = performance.now(); sim.acc = 0; sim.raf = requestAnimationFrame(frame); } }
  function busy() { return sim.fx.length || sim.bodies.some(b => !b.asleep) || sim.springs.some(s => !s.asleep); }
  function frame(now) {
    const dt = Math.min(0.05, (now - sim.last) / 1000); sim.last = now;
    sim.acc += dt * (DBG.fast ? 4 : 1);
    let n = 0;
    while (sim.acc >= DT && n < 40) { stepAll(DT); sim.acc -= DT; n++; }
    if (n >= 40) sim.acc = 0;
    renderAll();
    sim.raf = busy() ? requestAnimationFrame(frame) : 0;
  }
  function Body(o) {
    return Object.assign({ x: 0, y: 0, v: 0, H: 50, w: 50, rho: 1, ws: 0, floor: 1e4, air: 0, drift: 0, asleep: false, inWater: false, onBottom: false, calm: false, calmT: 0, bubT: 0, fxLayer: null, render: null, onEnter: null }, o);
  }
  function stepBody(b, dt) {
    if (b.asleep) return;
    const d = clamp(b.y - b.ws, 0, b.H), f = d / b.H;
    // gravity minus buoyancy (rho_w * g * submerged depth / (rho * H)), per unit mass
    let a = G * (1 - (RHO_W / b.rho) * f);
    if (f > 0) {
      const w = Math.sqrt(G * RHO_W / (b.rho * b.H)); // natural bobbing frequency
      a -= 2 * ZETA * w * b.v + CQ * b.v * Math.abs(b.v) / (b.rho * b.H); // linear + quadratic water drag
    } else if (b.air) a -= b.air * b.v; // air drag only for light, wide things
    b.v += a * dt;
    b.y += b.v * dt;
    if (f > 0 && b.drift) b.x += b.drift * dt;
    if (f > 0 && !b.inWater) { b.inWater = true; if (b.onEnter) b.onEnter(b); }
    if (b.y >= b.floor) {
      b.y = b.floor;
      if (b.v > 0) { if (!b.onBottom && b.onLand) b.onLand(b); b.onBottom = true; b.v = b.v > 40 ? -b.v * 0.18 : 0; }
    }
    if (b.fxLayer && f >= 1 && b.v > 25 && b.y < b.floor) {
      b.bubT -= dt;
      if (b.bubT <= 0) { b.bubT = 0.09; bubble(b.fxLayer, b.x + (Math.random() - 0.5) * b.w * 0.5, b.y - b.H * 0.6, b.ws); }
    }
    const fNow = clamp(b.y - b.ws, 0, b.H) / b.H;
    const still = Math.abs(b.v) < 9 && (b.onBottom || (fNow > 0 && fNow < 1 && Math.abs(fNow - b.rho) < 0.06));
    b.calmT = still ? b.calmT + dt : 0;
    b.calm = b.calmT > 0.25;
    if (!b.drift && b.calmT > 2 && Math.abs(b.v) < 0.6) { b.v = 0; b.asleep = true; }
  }
  function wake(b) { b.asleep = false; b.calm = false; b.calmT = 0; kick(); }
  function Spring(o) { return Object.assign({ y: 0, v: 0, target: 0, w: 5, z: 0.5, asleep: true, apply: null }, o); }
  function stepSpring(s, dt) {
    if (s.asleep) return;
    const a = s.w * s.w * (s.target - s.y) - 2 * s.z * s.w * s.v;
    s.v += a * dt; s.y += s.v * dt;
    if (Math.abs(s.target - s.y) < 0.15 && Math.abs(s.v) < 0.4) { s.y = s.target; s.v = 0; s.asleep = true; }
  }
  function stepAll(dt) {
    for (const b of sim.bodies) stepBody(b, dt);
    for (const s of sim.springs) stepSpring(s, dt);
    for (const p of sim.fx) {
      p.life += dt;
      if (p.kind === 'drop') { p.vy += G * dt; p.x += p.vx * dt; p.y += p.vy * dt; if ((p.vy > 0 && p.y > p.floorY) || p.life > 2) p.dead = true; }
      else if (p.kind === 'bubble') { p.y += p.vy * dt; if (p.y < p.top) p.dead = true; }
      else if (p.life >= p.max) p.dead = true;
    }
  }
  function renderAll() {
    for (const b of sim.bodies) if (b.render) b.render(b);
    for (const s of sim.springs) if (s.apply) s.apply(s);
    sim.fx = sim.fx.filter(p => {
      if (p.dead) { p.el.remove(); return false; }
      if (p.kind === 'drop') { p.el.setAttribute('cx', f1(p.x)); p.el.setAttribute('cy', f1(p.y)); }
      else if (p.kind === 'bubble') { p.el.setAttribute('cx', f1(p.x + Math.sin(p.life * 9 + p.ph) * 3)); p.el.setAttribute('cy', f1(p.y)); }
      else { const q = p.life / p.max, rx = GS.lerp(p.r0, p.r1, q); p.el.setAttribute('rx', f1(rx)); p.el.setAttribute('ry', f1(rx * 0.24)); p.el.setAttribute('opacity', f1((1 - q) * 0.9 * 100) / 100); }
      return true;
    });
  }
  function splash(layer, x, y, size, speed) {
    const n = GS.reducedMotion ? 4 : Math.round(clamp(4 + size / 12 + speed / 90, 5, 14));
    for (let i = 0; i < n; i++) {
      const c = el('circle', { cx: x, cy: y, r: f1(2.5 + Math.random() * 3.5), fill: '#DDF3F8', stroke: '#2F80C9', 'stroke-width': 1.5 }, layer);
      sim.fx.push({ kind: 'drop', el: c, x: x + (Math.random() - 0.5) * size * 0.6, y: y - 2, vx: (Math.random() - 0.5) * 2 * (50 + size * 1.4), vy: -(110 + Math.random() * Math.min(300, speed * 0.75)), floorY: y, life: 0 });
    }
    ring(layer, x, y, size * 0.3, size * 0.8 + 34, 0.75);
    GS.sfx.splash();
    kick();
  }
  function ring(layer, x, y, r0, r1, max) {
    const e = el('ellipse', { cx: x, cy: y, rx: r0, ry: r0 * 0.24, fill: 'none', stroke: '#fff', 'stroke-width': 3 }, layer);
    sim.fx.push({ kind: 'ring', el: e, r0, r1, life: 0, max });
    kick();
  }
  function bubble(layer, x, y, top) {
    if (sim.fx.length > 160) return;
    const c = el('circle', { cx: x, cy: y, r: f1(2 + Math.random() * 3.5), fill: '#fff', 'fill-opacity': 0.35, stroke: '#fff', 'stroke-width': 1.5 }, layer);
    sim.fx.push({ kind: 'bubble', el: c, x, y, vy: -(60 + Math.random() * 40), top: top + 2, life: 0, ph: Math.random() * 6 });
    kick();
  }

  /* ---------------- things: items that can be placed, dragged, squashed ---------------- */
  function makeThing(parent, name, markup, k, opt) {
    opt = opt || {};
    const t = { name, k, base: k, x: 0, y: 0, sq: [1, 1], lift: 0 };
    t.g = el('g', { class: 'pr-thing' + (opt.drag ? ' pr-drag pr-focus' : ''), tabindex: opt.drag ? 0 : null, role: opt.drag ? 'button' : null, 'aria-label': opt.aria || null }, parent);
    t.bb = measure(markup, 'item:' + name);
    t.shadow = el('ellipse', { cx: 0, cy: 0, rx: f1(t.bb.w * k * 0.42), ry: 7, fill: OUT, 'fill-opacity': 0.18 }, t.g);
    const hw = Math.max(44, t.bb.w * k / 2 + 14), hh = Math.max(84, t.bb.h * k + 22);
    t.ring = el('rect', { class: 'pr-ring', x: f1(-hw), y: f1(-hh + 6), width: f1(hw * 2), height: f1(hh), rx: 16, fill: 'none', stroke: '#1F6FD1', 'stroke-width': 4, 'stroke-dasharray': '10 7' }, t.g);
    t.fx = el('g', null, t.g);
    t.inner = el('g', null, t.fx);
    GS.markup(t.inner, markup);
    t.hit = el('rect', { x: f1(-hw), y: f1(-hh + 6), width: f1(hw * 2), height: f1(hh + 6), fill: '#fff', 'fill-opacity': 0 }, t.g);
    return t;
  }
  function place(t, x, y, k) {
    t.x = x; t.y = y; if (k != null) t.k = k;
    t.g.setAttribute('transform', 'translate(' + f1(x) + ' ' + f1(y) + ')');
    t.inner.setAttribute('transform', 'translate(0 ' + f1(-t.lift) + ') scale(' + f1(t.k * t.sq[0] * 1000) / 1000 + ' ' + f1(t.k * t.sq[1] * 1000) / 1000 + ') translate(0 ' + f1(-t.bb.bottom) + ')');
    t.shadow.setAttribute('rx', f1(t.bb.w * t.k * 0.42 * (1 + t.lift / 120)));
    t.shadow.setAttribute('fill-opacity', t.lift ? 0.12 : 0.18);
  }
  function squash(t, heavy) {
    const keys = heavy ? [[1, 1], [1.05, 0.95], [0.98, 1.02], [1, 1]] : [[1, 1], [1.2, 0.85], [0.92, 1.08], [1, 1]];
    return T(300, (e, p) => {
      const q = p * 3, i = Math.min(2, Math.floor(q)), u = q - i;
      t.sq = [GS.lerp(keys[i][0], keys[i + 1][0], u), GS.lerp(keys[i][1], keys[i + 1][1], u)];
      place(t, t.x, t.y);
    }, 'linear');
  }
  function flyTo(t, x, y, k, ms, arc) {
    const x0 = t.x, y0 = t.y, k0 = t.k, l0 = t.lift;
    return T(ms || 260, e => {
      t.lift = l0 * (1 - e);
      place(t, GS.lerp(x0, x, e), GS.lerp(y0, y, e) - (arc || 0) * Math.sin(Math.PI * e), GS.lerp(k0, k, e));
    }, 'inOutCubic');
  }
  // Drag: item drawn 40 units above the finger, scaled 1.15, shadow grows.
  function dragify(t, o) {
    GS.drag(t.g, {
      svg,
      onStart(p) {
        if (!o.can(t)) return false;
        const w = o.worldPos ? o.worldPos(t) : { x: t.x, y: t.y };
        S.dragLayer.appendChild(t.g);
        t.d = { ox: w.x - p.x, oy: w.y - p.y, p, sx: p.x, sy: p.y };
        place(t, w.x, w.y);
        if (o.pick) o.pick(t);
        GS.sfx.pick();
        const k0 = t.k, kk = t.base * 1.15;
        T(120, e => { if (!t.d) return; t.lift = 40 * e; place(t, t.d.p.x + t.d.ox, t.d.p.y + t.d.oy, GS.lerp(k0, kk, e)); }, 'outBack');
      },
      onMove(p) {
        if (!t.d) return;
        t.d.p = p;
        place(t, p.x + t.d.ox, p.y + t.d.oy);
        if (o.hover) o.hover(t, { x: t.x, y: t.y - t.lift });
      },
      onEnd(p) {
        if (!t.d) return;
        const moved = Math.hypot(p.x - t.d.sx, p.y - t.d.sy);
        t.d = null;
        if (o.hover) o.hover(t, null);
        o.drop(t, { x: t.x, y: t.y - t.lift }, moved);
      }
    });
    t.g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (o.can(t) && o.key) o.key(t); }
    });
  }

  /* ---------------- scenery ---------------- */
  function drawPier(parent, x0, x1, yTop, yFront, posts) {
    const g = el('g', null, parent);
    el('rect', { x: x0, y: yTop, width: x1 - x0, height: yFront - yTop, fill: '#C48A55' }, g);
    let row = 0;
    for (let y = yTop; y < yFront - 1; y += 30, row++) {
      const h = Math.min(30, yFront - y);
      if (row % 2 === 0) el('rect', { x: x0, y, width: x1 - x0, height: h, fill: '#CC9461' }, g);
      el('rect', { x: x0, y: y + 3, width: x1 - x0, height: 4, fill: '#DCA672', opacity: 0.6 }, g);
      if (y > yTop) el('path', { d: 'M' + x0 + ' ' + y + 'H' + x1, stroke: '#7E4A27', 'stroke-width': 2.5, opacity: 0.55 }, g);
      for (let x = x0 + 70 + (row * 97) % 180; x < x1 - 20; x += 230 + (row % 3) * 40) {
        el('path', { d: 'M' + x + ' ' + (y + 2) + 'v' + (h - 4), stroke: '#7E4A27', 'stroke-width': 2.5, opacity: 0.5 }, g);
        el('circle', { cx: x - 7, cy: y + h / 2, r: 2.2, fill: '#7E4A27', opacity: 0.7 }, g);
        el('circle', { cx: x + 7, cy: y + h / 2, r: 2.2, fill: '#7E4A27', opacity: 0.7 }, g);
      }
    }
    el('path', { d: 'M' + x0 + ' ' + yTop + 'H' + x1, stroke: OUT, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
    if (x0 > 0) el('path', { d: 'M' + x0 + ' ' + yTop + 'V' + yFront, stroke: OUT, 'stroke-width': 4 }, g);
    if (x1 < 1280) el('path', { d: 'M' + x1 + ' ' + yTop + 'V' + yFront, stroke: OUT, 'stroke-width': 4 }, g);
    el('rect', { x: x0, y: yFront, width: x1 - x0, height: 24, rx: 4, fill: '#A8673A', stroke: OUT, 'stroke-width': 4 }, g);
    el('path', { d: 'M' + (x0 + 6) + ' ' + (yFront + 6) + 'H' + (x1 - 6), stroke: '#C2814F', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M' + (x0 + 6) + ' ' + (yFront + 19) + 'H' + (x1 - 6), stroke: '#7E4A27', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    return g;
  }
  function drawPosts(parent, xs, yFrom) {
    const g = el('g', null, parent);
    for (const x of xs) {
      el('rect', { x: x - 15, y: yFrom - 4, width: 30, height: 820 - yFrom, fill: '#8A5530', stroke: OUT, 'stroke-width': 3.5 }, g);
      el('rect', { x: x - 10, y: yFrom, width: 7, height: 800 - yFrom, fill: '#A8673A' }, g);
      el('rect', { x: x - 16, y: yFrom + 22, width: 32, height: 9, rx: 3, fill: '#C9A66B', stroke: OUT, 'stroke-width': 2.5 }, g);
    }
    return g;
  }
  function drawRiver(parent, ws, x0, x1) {
    x0 = x0 || 0; x1 = x1 || 1280;
    const back = el('g', null, parent);
    el('rect', { x: x0, y: ws, width: x1 - x0, height: 800 - ws + 4, fill: '#3FA7C4' }, back);
    for (let i = 0; i < 9; i++) {
      const x = x0 + 60 + ((i * 263) % (x1 - x0 - 120)), y = ws + 40 + ((i * 71) % (800 - ws - 60));
      el('path', { d: 'M' + x + ' ' + y + 'q12 -6 24 0 t24 0', fill: 'none', stroke: '#7FC6DA', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.8 }, back);
    }
    return back;
  }
  function drawWaterFront(parent, x0, x1, ws, bottom, opacity, clipId) {
    const g = el('g', clipId ? { 'clip-path': 'url(#' + clipId + ')' } : null, parent);
    const P = 120, a = 3;
    const wv = el('g', { class: 'pr-wave' }, g);
    el('path', { d: wavePath(x0 - P, x1 + P, ws, a, P) + ' V' + bottom + ' H' + (x0 - P) + ' Z', fill: '#3FA7C4', 'fill-opacity': opacity }, wv);
    el('path', { d: wavePath(x0 - P, x1 + P, ws, a, P), fill: 'none', stroke: '#2F80C9', 'stroke-width': 3, 'stroke-linecap': 'round' }, wv);
    const wv2 = el('g', { class: 'pr-wave slow' }, g);
    el('path', { d: wavePath(x0 - P, x1 + P, ws + 5, 2, P), fill: 'none', stroke: '#DDF3F8', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.8 }, wv2);
    return g;
  }

  // Clear glass aquarium. Returns the layers that go inside it.
  const TK = { x0: 690, x1: 1230, top: 128, ws: 232, floor: 572, base: 600 };
  TK.cx = (TK.x0 + TK.x1) / 2; TK.ix0 = TK.x0 + 12; TK.ix1 = TK.x1 - 12;
  function drawTank(parent) {
    const { x0, x1, top, ws, floor, base, ix0, ix1, cx } = TK;
    if (!document.getElementById('pr-tank-clip')) {
      const cp = el('clipPath', { id: 'pr-tank-clip' }, defs);
      el('rect', { x: ix0, y: top, width: ix1 - ix0, height: base - top }, cp);
    }
    const back = el('g', null, parent);
    el('ellipse', { cx, cy: base + 4, rx: (x1 - x0) / 2 + 18, ry: 14, fill: OUT, 'fill-opacity': 0.18 }, back);
    el('rect', { x: ix0, y: top, width: ix1 - ix0, height: base - top - 12, fill: '#E3F4F6', 'fill-opacity': 0.55 }, back);
    el('rect', { x: ix0, y: ws, width: ix1 - ix0, height: base - ws - 12, fill: '#3FA7C4', 'fill-opacity': 0.3 }, back);
    // water plants (background, no outline)
    for (const [px, h] of [[ix0 + 36, 90], [ix0 + 52, 120], [ix1 - 40, 100]]) {
      el('path', { d: 'M' + px + ' ' + floor + ' q-14 ' + (-h / 3) + ' 0 ' + (-h / 1.6) + ' q12 ' + (-h / 5) + ' 2 ' + (-h / 2.7), fill: 'none', stroke: '#4DAA57', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.55 }, back);
    }
    let d = 'M' + ix0 + ' ' + (floor + 2);
    for (let x = ix0; x < ix1; x += 60) d += ' q15 -7 30 -2 t30 0';
    d += ' V' + (base - 12) + ' H' + ix0 + ' Z';
    el('path', { d, fill: '#F3DDA6' }, back);
    for (let i = 0; i < 9; i++) el('ellipse', { cx: ix0 + 30 + i * 58, cy: floor + 12 + (i % 3) * 4, rx: 7 + (i % 3) * 2, ry: 4.5, fill: i % 2 ? '#8C8F94' : '#D4A062', opacity: 0.8 }, back);
    const items = el('g', null, parent);
    const front = el('g', null, parent);
    drawWaterFront(front, ix0, ix1, ws, base - 12, 0.22, 'pr-tank-clip');
    const fxL = el('g', null, parent);
    const glass = el('g', { 'pointer-events': 'none' }, parent);
    el('rect', { x: ix0, y: top, width: ix1 - ix0, height: base - top - 12, fill: 'none', stroke: '#BFE3E0', 'stroke-width': 5 }, glass);
    el('path', { d: 'M' + (ix0 + 26) + ' ' + (top + 84) + ' l46 -50 M' + (ix0 + 30) + ' ' + (top + 122) + ' l70 -76 M' + (ix1 - 70) + ' ' + (base - 40) + ' l40 -44', stroke: '#fff', 'stroke-width': 9, 'stroke-linecap': 'round', opacity: 0.45 }, glass);
    el('rect', { x: x0, y: top, width: x1 - x0, height: base - top, rx: 10, fill: 'none', stroke: OUT, 'stroke-width': 5 }, glass);
    el('rect', { x: x0 - 6, y: top - 8, width: x1 - x0 + 12, height: 14, rx: 7, fill: '#BFE3E0', stroke: OUT, 'stroke-width': 4 }, glass);
    el('rect', { x: x0 - 8, y: base - 16, width: x1 - x0 + 16, height: 22, rx: 8, fill: '#A8673A', stroke: OUT, 'stroke-width': 4 }, glass);
    el('path', { d: 'M' + (x0 + 2) + ' ' + (base - 10) + 'H' + (x1 - 2), stroke: '#C2814F', 'stroke-width': 4, 'stroke-linecap': 'round' }, glass);
    return { back, items, front, fx: fxL, glass };
  }

  // Scene for parts A and C: a wide wooden pier (dermaga) over the river, aquarium on the right.
  function pierScene() {
    const L = {};
    L.river = el('g', null, world);
    drawRiver(L.river, 640);
    el('rect', { x: 0, y: 624, width: 1280, height: 26, fill: OUT, 'fill-opacity': 0.22 }, L.river);
    drawPosts(L.river, [60, 330, 600, 870, 1140], 624);
    drawWaterFront(L.river, 0, 1280, 652, 800, 0.5);
    drawPier(L.river, 0, 1280, 362, 600);
    // mooring bollard and rope coil (decor)
    const bo = el('g', { transform: 'translate(650 594)' }, L.river);
    el('ellipse', { cx: 0, cy: 2, rx: 22, ry: 6, fill: OUT, 'fill-opacity': 0.18 }, bo);
    el('path', { d: 'M-12 0 V-28 h24 V0 Z', fill: '#63666B', stroke: OUT, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, bo);
    el('ellipse', { cx: 0, cy: -30, rx: 17, ry: 7, fill: '#8C8F94', stroke: OUT, 'stroke-width': 3.5 }, bo);
    el('path', { d: 'M-12 -14 q12 7 24 0', fill: 'none', stroke: '#C9A66B', 'stroke-width': 5 }, bo);
    return L;
  }

  /* ---------------- level dispatcher ---------------- */
  function buildLevel(i) {
    gen++;
    simReset();
    world.innerHTML = '';
    dock.innerHTML = '';
    tries = 0;
    S = { gen, level: i, locked: false };
    hud.mood('think');
    if (LEVELS[i] === 'A') buildA(i);
    else if (LEVELS[i] === 'B') buildB(i);
    else buildC(i);
  }
  function finish(stars, text) {
    const my = gen;
    hud.mood('cheer');
    W(300).then(() => { if (my === gen) run.win(stars, text); });
  }
  const starsFor = n => (n === 0 ? 3 : n <= 2 ? 2 : 1);

  /* =====================================================================
   * PART A: terapung atau tenggelam (L1-4)
   * ===================================================================== */
  function pickA(i) {
    const P = PAIRS, rnd = a => a[Math.floor(Math.random() * a.length)];
    let names;
    if (i === 0) names = P[0].concat(P[4]);
    else if (i === 1) names = P[1].concat(P[2]);
    else if (i === 2) names = P[3].concat(rnd([P[0], P[1], P[2], P[4]]), rnd(EXTRA));
    else names = GS.shuffle(P).slice(0, 2).flat().concat(GS.shuffle(EXTRA).slice(0, 2));
    return GS.shuffle(names);
  }
  function drawBasket(parent, cx, by, kind) {
    const C = kind === 'float'
      ? { b: '#2F80C9', s: '#215F98', h: '#6FAEE3', pat: 'url(#pr-dots)', label: 'Terapung' }
      : { b: '#F28C28', s: '#C76A12', h: '#F8B26A', pat: 'url(#pr-stripes)', label: 'Tenggelam' };
    const rimY = by - 118, rx = 124, ry = 22, bw = 96;
    const bk = { kind, cx, by, rimY, items: [] };
    bk.back = el('g', null, parent);
    bk.content = el('g', null, parent);
    bk.front = el('g', null, parent);
    el('ellipse', { cx, cy: by + 2, rx: 112, ry: 12, fill: OUT, 'fill-opacity': 0.18 }, bk.back);
    el('ellipse', { cx, cy: rimY, rx, ry, fill: C.s, stroke: OUT, 'stroke-width': 4 }, bk.back);
    el('ellipse', { cx, cy: rimY + 5, rx: rx - 24, ry: ry - 9, fill: OUT, 'fill-opacity': 0.22 }, bk.back);
    el('ellipse', { cx, cy: rimY, rx, ry, fill: 'none', stroke: OUT, 'stroke-width': 14 }, bk.back);
    el('ellipse', { cx, cy: rimY, rx, ry, fill: 'none', stroke: C.h, 'stroke-width': 8 }, bk.back);
    bk.hot = el('ellipse', { class: 'pr-ring', cx, cy: rimY - 40, rx: rx + 14, ry: 76, fill: '#FFF8EC', 'fill-opacity': 0.35, stroke: '#FFF8EC', 'stroke-width': 5, 'stroke-dasharray': '12 8' }, bk.back);
    const body = 'M' + (cx - rx) + ' ' + rimY + ' Q' + (cx - rx + 4) + ' ' + (by - 30) + ' ' + (cx - bw) + ' ' + (by - 6) + ' Q' + cx + ' ' + (by + 6) + ' ' + (cx + bw) + ' ' + (by - 6) +
      ' Q' + (cx + rx - 4) + ' ' + (by - 30) + ' ' + (cx + rx) + ' ' + rimY + ' A' + rx + ' ' + ry + ' 0 0 1 ' + (cx - rx) + ' ' + rimY + 'Z';
    const cid = 'pr-bk-' + kind;
    const old = document.getElementById(cid); if (old) old.remove();
    el('path', { d: body }, el('clipPath', { id: cid }, defs));
    el('path', { d: body, fill: C.b }, bk.front);
    const inner = el('g', { 'clip-path': 'url(#' + cid + ')' }, bk.front);
    el('ellipse', { cx: cx - rx + 30, cy: rimY + 40, rx: 34, ry: 60, fill: C.h, opacity: 0.85 }, inner);
    el('ellipse', { cx: cx + rx - 10, cy: by - 20, rx: 70, ry: 40, fill: C.s, opacity: 0.8 }, inner);
    el('path', { d: body, fill: C.pat }, inner);
    for (let k = 1; k <= 3; k++) {
      const y = rimY + 8 + k * 24;
      el('path', { d: 'M' + (cx - rx) + ' ' + y + ' Q' + cx + ' ' + (y + 16) + ' ' + (cx + rx) + ' ' + y, fill: 'none', stroke: C.s, 'stroke-width': 3, opacity: 0.7 }, inner);
    }
    for (let k = -3; k <= 3; k++) el('path', { d: 'M' + (cx + k * 36) + ' ' + (rimY + 18) + ' L' + (cx + k * 29) + ' ' + by, stroke: C.s, 'stroke-width': 3, opacity: 0.55 }, inner);
    el('path', { d: body, fill: 'none', stroke: OUT, 'stroke-width': 4, 'stroke-linejoin': 'round' }, bk.front);
    el('path', { d: 'M' + (cx - rx) + ' ' + rimY + ' A' + rx + ' ' + ry + ' 0 0 0 ' + (cx + rx) + ' ' + rimY, fill: 'none', stroke: OUT, 'stroke-width': 14, 'stroke-linecap': 'round' }, bk.front);
    el('path', { d: 'M' + (cx - rx) + ' ' + rimY + ' A' + rx + ' ' + ry + ' 0 0 0 ' + (cx + rx) + ' ' + rimY, fill: 'none', stroke: C.h, 'stroke-width': 8, 'stroke-linecap': 'round' }, bk.front);
    // label plate with icon
    el('rect', { x: cx - 96, y: by - 66, width: 192, height: 48, rx: 16, fill: '#FFF8EC', stroke: OUT, 'stroke-width': 3 }, bk.front);
    const ix = cx - 68, iy = by - 42;
    el('circle', { cx: ix, cy: iy, r: 18, fill: C.b, stroke: OUT, 'stroke-width': 2.5 }, bk.front);
    if (kind === 'float') {
      el('rect', { x: ix - 6, y: iy - 13, width: 12, height: 11, rx: 2.5, fill: '#FFC83D', stroke: OUT, 'stroke-width': 2 }, bk.front);
      el('path', { d: 'M' + (ix - 13) + ' ' + (iy + 1) + ' q3.25 -4 6.5 0 t6.5 0 t6.5 0 t6.5 0 M' + (ix - 12) + ' ' + (iy + 8) + ' q3 -4 6 0 t6 0 t6 0 t6 0', fill: 'none', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, bk.front);
    } else {
      el('path', { d: 'M' + (ix - 13) + ' ' + (iy - 8) + ' q3.25 -4 6.5 0 t6.5 0 t6.5 0 t6.5 0', fill: 'none', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, bk.front);
      el('path', { d: 'M' + ix + ' ' + (iy - 3) + ' V' + (iy + 11) + ' M' + (ix - 6) + ' ' + (iy + 5) + ' L' + ix + ' ' + (iy + 11) + ' L' + (ix + 6) + ' ' + (iy + 5), fill: 'none', stroke: '#fff', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, bk.front);
    }
    txt(bk.front, cx + 16, by - 32, C.label, { class: 't-display', 'font-size': 27 });
    return bk;
  }
  function basketSlot(bk, j) {
    const row = j < 3 ? 0 : 1, col = j % 3;
    return { x: bk.cx + (col - 1) * 72 + (row ? 18 : 0), y: bk.rimY + (row ? 2 : 14) };
  }
  function nameTag(parent, label) {
    const g = el('g', null, parent);
    const w = Math.max(56, label.length * 11 + 22);
    el('rect', { x: -w / 2, y: 10, width: w, height: 28, rx: 10, fill: '#FFF8EC', stroke: OUT, 'stroke-width': 2.5 }, g);
    txt(g, 0, 31, label, { class: 't-body', 'font-size': 19, 'font-weight': 700 });
    return g;
  }

  function buildA(i) {
    const L = pierScene();
    const tank = drawTank(world);
    const bLayer = el('g', null, world);
    const jetty = el('g', null, world);
    S.fxTop = el('g', null, world);
    S.dragLayer = el('g', null, world);
    const baskets = { float: drawBasket(bLayer, 175, 592, 'float'), sink: drawBasket(bLayer, 478, 592, 'sink') };
    // Baskets list content in insertion order: re-append in back-to-front order.
    const names = pickA(i);
    const n = names.length;
    const items = names.map((name, j) => {
      const m = MAT[name] || { s: 0.7 };
      const t = makeThing(jetty, name, artItem(name), m.s, { drag: true, aria: labelOf(name) });
      t.rho = density(name);
      t.floats = t.rho < RHO_W;
      t.label = labelOf(name);
      t.air = m.air || 0;
      t.home = { x: 70 + (j + 0.5) * (560 / n), y: 392 };
      t.tag = nameTag(t.g, t.label);
      t.where = null;
      place(t, t.home.x, t.home.y);
      return t;
    });
    S.items = items;

    function relayout(bk) {
      bk.items.forEach((t, j) => {
        const s = basketSlot(bk, j);
        if (t.parentNode !== bk.content) bk.content.appendChild(t.g);
        if (Math.abs(t.x - s.x) > 0.5 || Math.abs(t.y - s.y) > 0.5) flyTo(t, s.x, s.y, t.base * 0.78, 200);
      });
      // back row first so the front row draws on top
      bk.items.slice().sort((a, b) => basketSlot(bk, bk.items.indexOf(a)).y - basketSlot(bk, bk.items.indexOf(b)).y).forEach(t => bk.content.appendChild(t.g));
    }
    function assign(t, where) {
      if (t.where) { const bk = baskets[t.where]; bk.items.splice(bk.items.indexOf(t), 1); relayout(bk); }
      t.where = where;
      if (where) {
        const bk = baskets[where];
        bk.items.push(t);
        t.tag.setAttribute('display', 'none');
        t.shadow.setAttribute('display', 'none');
        const s = basketSlot(bk, bk.items.length - 1);
        bk.content.appendChild(t.g);
        flyTo(t, s.x, s.y, t.base * 0.78, 150).then(() => squash(t, false));
        relayout(bk);
        GS.sfx.drop();
      } else {
        jetty.appendChild(t.g);
        t.tag.removeAttribute('display');
        t.shadow.removeAttribute('display');
        flyTo(t, t.home.x, t.home.y, t.base, 220).then(() => squash(t, false));
        GS.sfx.pop();
      }
      btn.disabled = items.some(x => !x.where);
    }
    function overBasket(p) {
      for (const k of ['float', 'sink']) {
        const bk = baskets[k];
        if (Math.abs(p.x - bk.cx) < 145 && p.y > bk.rimY - 150 && p.y < bk.by + 30) return k;
      }
      return null;
    }
    items.forEach(t => dragify(t, {
      can: () => !S.locked,
      pick: () => { t.tag.setAttribute('display', 'none'); },
      hover: (tt, p) => {
        const k = p && overBasket(p);
        for (const kk of ['float', 'sink']) baskets[kk].hot.classList.toggle('pr-hot', k === kk);
      },
      drop: (tt, p) => {
        const k = overBasket(p);
        if (k) {
          if (t.where === k) { baskets[k].content.appendChild(t.g); relayout(baskets[k]); GS.sfx.drop(); squash(t, false); }
          else assign(t, k);
        } else if (t.where) {
          // dropped elsewhere: back to its basket
          baskets[t.where].content.appendChild(t.g); relayout(baskets[t.where]); GS.sfx.pop();
        } else { assign(t, null); }
      },
      key: tt => assign(t, t.where === 'float' ? 'sink' : t.where === 'sink' ? null : 'float')
    }));

    const btn = button('Cemplung!', '', () => cemplung());
    btn.disabled = true;
    S.assign = assign;
    S.cemplung = () => cemplung();

    async function cemplung() {
      if (S.locked || items.some(t => !t.where)) return;
      const my = gen; S.locked = true; btn.disabled = true;
      let wrong = 0;
      for (let j = 0; j < n; j++) {
        const t = items[j];
        const tx = TK.ix0 + (j + 0.5) * (TK.ix1 - TK.ix0) / n, ty = TK.top + 52;
        tank.items.appendChild(t.g);
        t.shadow.setAttribute('display', 'none');
        GS.sfx.whoosh();
        await flyTo(t, tx, ty, t.base, 520, 80);
        if (my !== gen) return;
        const b = Body({
          x: tx, y: ty, H: t.bb.h * t.base, w: t.bb.w * t.base, rho: t.rho, air: t.air,
          ws: TK.ws, floor: TK.floor, fxLayer: tank.fx,
          render: bb => place(t, bb.x, bb.y),
          onEnter: bb => splash(tank.fx, bb.x, TK.ws, bb.w, bb.v),
          onLand: bb => { if (bb.v > 120) GS.sfx.thud(); }
        });
        t.body = b;
        sim.bodies.push(b); kick();
        await waitUntil(() => b.calm, 6000);
        if (my !== gen) return;
        const ok = (t.where === 'float') === t.floats;
        if (!ok) wrong++;
        if (t.floats) t.fx.classList.add('pr-bob');
        const why = (t.floats === (MAT[t.name] ? MAT[t.name].rho < 1 : t.floats) && WHY[t.name]) ||
          (t.label.charAt(0).toUpperCase() + t.label.slice(1) + (t.floats ? ' ringan untuk ukurannya. Terapung!' : ' padat untuk ukurannya. Tenggelam!'));
        if (ok) { sparkle(S.fxTop, t.x, t.y - t.bb.h * t.base - 20); await sayWait('Pas! ' + why, 'happy'); }
        else await sayWait(why, 'surprise');
        if (my !== gen) return;
      }
      tries = wrong;
      finish(starsFor(wrong), wrong === 0 ? 'Semua tebakan pas!' : 'Semua benda sudah diamati!');
    }

    S.solve = () => { items.forEach(t => assign(t, t.floats ? 'float' : 'sink')); setTimeout(() => S.cemplung(), 300); };
    const intro = [
      'Terapung atau tenggelam? Seret ke keranjang tebakan.',
      'Tebak lagi. Terapung atau tenggelam?',
      'Besar belum tentu tenggelam. Ayo tebak!',
      'Enam benda. Seret semua ke keranjang tebakan.'
    ];
    say(intro[i], 'think');
  }

  /* =====================================================================
   * PART B: muatan rakit (L5-8)
   * ===================================================================== */
  function subsetInfo(ws, K) {
    let best = -1, bestMask = 0, exactMin = 99;
    for (let m = 1; m < 1 << ws.length; m++) {
      let s = 0, c = 0;
      for (let j = 0; j < ws.length; j++) if (m & (1 << j)) { s += ws[j]; c++; }
      if (s <= K && (s > best || (s === best && c < popc(bestMask)))) { best = s; bestMask = m; }
      if (s === K) exactMin = Math.min(exactMin, c);
    }
    return { best, bestMask, exactMin };
  }
  function popc(m) { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; }
  function genB(i) {
    const cfg = [[8, 10, 4], [10, 13, 5], [10, 15, 5], [12, 15, 6]][i - 4];
    for (let tr = 0; tr < 800; tr++) {
      const K = GS.rand(cfg[0], cfg[1]);
      const ws = Array.from({ length: cfg[2] }, () => GS.rand(2, 7));
      const total = ws.reduce((a, b) => a + b, 0);
      if (total < K + 4) continue;
      const info = subsetInfo(ws, K);
      if (i === 4 && info.best !== K) continue;
      if (i === 5 && (info.best !== K || info.exactMin < 3)) continue;
      if (i === 6 && (info.best === K || info.best < K - 2)) continue;
      if (i === 7 && info.best < K - 2) continue;
      return Object.assign({ K, ws }, info);
    }
    const fb = [[9, [4, 5, 3, 6]], [12, [2, 3, 7, 6, 5]], [11, [4, 4, 6, 6, 2]], [13, [4, 6, 2, 6, 4, 4]]][i - 4];
    return Object.assign({ K: fb[0], ws: fb[1] }, subsetInfo(fb[1], fb[0]));
  }
  const RV = { ws: 620, F: 34, hw: 220 };
  function drawRaft(parent, K) {
    const g = el('g', null, parent);
    const hw = RV.hw, w = hw * 2;
    // deck (top surface, 4 lashed poles)
    for (let k = 0; k < 4; k++) {
      const y = -42 + k * 10.5;
      el('rect', { x: -hw + 10, y, width: w - 20, height: 11, rx: 5.5, fill: k % 2 ? '#D2AF55' : '#DDBE66', stroke: OUT, 'stroke-width': 1.8 }, g);
      for (let x = -hw + 60 + k * 17; x < hw - 20; x += 74) el('path', { d: 'M' + x + ' ' + (y + 1.5) + 'v8', stroke: '#A88A3A', 'stroke-width': 2 }, g);
    }
    // front pole (side view)
    el('rect', { x: -hw, y: 0, width: w, height: 26, rx: 13, fill: '#D8B65A', stroke: OUT, 'stroke-width': 3.5 }, g);
    el('rect', { x: -hw + 14, y: 4, width: w - 28, height: 6, rx: 3, fill: '#EFD58E' }, g);
    el('rect', { x: -hw + 12, y: 17, width: w - 24, height: 5, rx: 2.5, fill: '#B0913E' }, g);
    for (let x = -hw + 44; x < hw - 20; x += 72) el('path', { d: 'M' + x + ' 2 q3 11 0 22 M' + (x + 5) + ' 2 q3 11 0 22', fill: 'none', stroke: '#A88A3A', 'stroke-width': 2.2 }, g);
    for (const sx of [-1, 1]) {
      el('ellipse', { cx: sx * (hw - 3), cy: 13, rx: 6, ry: 12, fill: '#EBD9A0', stroke: OUT, 'stroke-width': 2.5 }, g);
      el('ellipse', { cx: sx * (hw - 3), cy: 13, rx: 2.5, ry: 6, fill: 'none', stroke: '#C9A85A', 'stroke-width': 2 }, g);
    }
    // cross beams (cut ends) and rope lashings
    for (const x of [-hw * 0.72, 0, hw * 0.72]) {
      el('circle', { cx: x, cy: 34, r: 12, fill: '#C9A85A', stroke: OUT, 'stroke-width': 3 }, g);
      el('circle', { cx: x, cy: 34, r: 6, fill: '#EBD9A0' }, g);
      for (const dx of [-9, 0, 9]) {
        el('path', { d: 'M' + (x + dx - 5) + ' -1 L' + (x + dx + 4) + ' 27', stroke: '#7A5A30', 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
        el('path', { d: 'M' + (x + dx - 5) + ' -1 L' + (x + dx + 4) + ' 27', stroke: '#C9A66B', 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
      }
      el('path', { d: 'M' + (x - 8) + ' -42 V-2 M' + (x + 8) + ' -42 V-2', stroke: '#7A5A30', 'stroke-width': 4.5, 'stroke-linecap': 'round' }, g);
      el('path', { d: 'M' + (x - 8) + ' -42 V-2 M' + (x + 8) + ' -42 V-2', stroke: '#C9A66B', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, g);
    }
    // mast + capacity flag
    const mx = hw - 30;
    el('rect', { x: mx - 4, y: -176, width: 9, height: 140, rx: 4, fill: '#7E4A27', stroke: OUT, 'stroke-width': 2.5 }, g);
    el('circle', { cx: mx, cy: -180, r: 7, fill: '#FFC83D', stroke: OUT, 'stroke-width': 2.5 }, g);
    const fl = el('g', { class: 'pr-flag' }, g);
    el('path', { d: 'M' + (mx + 5) + ' -170 h104 l-16 25 l16 25 h-104 Z', fill: '#FFC83D', stroke: OUT, 'stroke-width': 3, 'stroke-linejoin': 'round' }, fl);
    el('path', { d: 'M' + (mx + 10) + ' -164 h86', stroke: '#FFE08A', 'stroke-width': 4, 'stroke-linecap': 'round' }, fl);
    el('path', { d: 'M' + (mx + 10) + ' -126 h80', stroke: '#E09A00', 'stroke-width': 3, 'stroke-linecap': 'round' }, fl);
    const t = txt(fl, mx + 50, -135, '', { 'font-size': 30 });
    t.innerHTML = K + '<tspan font-size="19" dx="3">kg</tspan>';
    return g;
  }
  function kgTag(parent, kg, dots, y) {
    const g = el('g', { transform: 'translate(0 ' + f1(y) + ')' }, parent);
    const h = dots ? 46 : 34;
    el('path', { d: 'M0 -26 V-17', stroke: OUT, 'stroke-width': 2 }, g);
    el('rect', { x: -32, y: -17, width: 64, height: h, rx: 10, fill: '#FFF8EC', stroke: OUT, 'stroke-width': 2.5 }, g);
    el('circle', { cx: 0, cy: -11, r: 2.4, fill: OUT }, g);
    const t = txt(g, 0, 11, '', { 'font-size': 23 });
    t.innerHTML = kg + '<tspan font-size="14" dx="2">kg</tspan>';
    if (dots) {
      const per = Math.min(kg, 4), rows = Math.ceil(kg / 4);
      for (let d = 0; d < kg; d++) {
        const r = Math.floor(d / 4), c = d % 4, cnt = r < rows - 1 ? 4 : kg - r * 4;
        el('circle', { cx: (c - (cnt - 1) / 2) * 9, cy: 19 + r * 7 - (rows - 1) * 3, r: 3, fill: '#2F80C9' }, g);
      }
      void per;
    }
    return g;
  }
  function boatman(parent) {
    const g = el('g', null, parent);
    const fxw = el('g', null, g);
    GS.markup(fxw, artPerson(5));
    const pad = el('g', null, fxw);
    el('path', { d: 'M24 -96 V-2', stroke: OUT, 'stroke-width': 8, 'stroke-linecap': 'round' }, pad);
    el('path', { d: 'M24 -96 V-2', stroke: '#C2814F', 'stroke-width': 4, 'stroke-linecap': 'round' }, pad);
    el('path', { d: 'M24 -40 c11 0 13 18 11 34 c-2 10 -20 10 -22 0 c-2 -16 0 -34 11 -34z', fill: '#A8673A', stroke: OUT, 'stroke-width': 3, 'stroke-linejoin': 'round' }, pad);
    el('path', { d: 'M20 -30 c-2 8 -2 16 0 22', fill: 'none', stroke: '#C2814F', 'stroke-width': 3, 'stroke-linecap': 'round' }, pad);
    return { g, fxw, pad };
  }

  function buildB(i) {
    const P = genB(i);
    const K = P.K, exactLevel = i <= 5, hideSum = i === 7, dots = i === 4;
    const WS = RV.ws, F = RV.F;
    // scene
    const river = el('g', null, world);
    drawRiver(river, WS);
    // far bank: the kampung seberang jetty
    drawPosts(river, [1170, 1260], 590);
    const raftL = el('g', null, world);
    const riverItems = el('g', null, world);
    const frontW = el('g', null, world);
    drawWaterFront(frontW, 0, 1280, WS, 800, 0.5);
    S.fxTop = el('g', null, world);
    const land = el('g', null, world);
    drawPosts(land, [40, 210, 380], 596);
    el('rect', { x: 0, y: 596, width: 432, height: 24, fill: OUT, 'fill-opacity': 0.22 }, land);
    drawPosts(land, [40, 210, 380], 596);
    drawWaterFront(land, 0, 434, WS, 800, 0.5);
    drawPier(land, -10, 432, 470, 574);
    el('rect', { x: 1150, y: 590, width: 140, height: 30, fill: OUT, 'fill-opacity': 0.2 }, land);
    drawPier(land, 1150, 1290, 540, 568);
    const friend = el('g', { transform: 'translate(1222 560) scale(0.82)' }, land);
    GS.markup(friend, artPerson(2));
    const jettyL = el('g', null, world);
    S.dragLayer = el('g', null, world);

    // board with the running number sentence
    const board = el('g', null, world);
    el('rect', { x: 26, y: 22, width: 590, height: 92, rx: 18, fill: '#A8673A', stroke: OUT, 'stroke-width': 4 }, board);
    el('rect', { x: 38, y: 33, width: 566, height: 70, rx: 12, fill: '#FFF8EC', stroke: OUT, 'stroke-width': 2.5 }, board);
    txt(board, 104, 77, 'Muatan', { class: 't-body', 'font-size': 24, 'font-weight': 700 });
    const sent = txt(board, 390, 82, '', { 'font-size': 38 });

    // raft
    const raft = { x: 690, g: el('g', null, raftL) };
    raft.bobW = el('g', { class: 'pr-bob' }, raft.g);
    drawRaft(raft.bobW, K);
    raft.backL = el('g', null, raft.bobW);
    raft.frontL = el('g', null, raft.bobW);
    raft.slots = [[-118, -8], [-10, -8], [98, -8], [-66, -28], [42, -28], [146, -28]].map(s => ({ x: s[0], y: s[1], t: null }));
    const spr = Spring({ y: WS - F, target: WS - F, w: 4.2, z: 0.45, apply: s => raft.g.setAttribute('transform', 'translate(' + f1(raft.x) + ' ' + f1(s.y) + ')') });
    sim.springs.push(spr);
    spr.apply(spr);

    // boatman on the jetty
    const man = boatman(jettyL);
    man.g.setAttribute('transform', 'translate(392 548) scale(0.92)');

    // cargo
    const pool = GS.shuffle(['karung', 'keranjang', 'kantong', 'semangka', 'karung', 'keranjang', 'kantong', 'semangka']);
    const homes = [[78, 506], [192, 506], [306, 506], [100, 562], [214, 562], [328, 562]];
    const order = GS.shuffle(P.ws.map((kg, j) => j));
    const cargo = P.ws.map((kg, j) => {
      let name = pool[j];
      if (kg <= 3 && Math.random() < 0.4) name = 'kelapa';
      const C = CARGO[name];
      const t = makeThing(jettyL, name, artItem(name), C.k, { drag: true, aria: C.label + ' ' + kg + ' kilo' });
      t.kg = kg; t.rho = C.rho; t.label = C.label; t.idx = j;
      const h = homes[order.indexOf(j)];
      t.home = { x: h[0], y: h[1] };
      t.slot = null;
      t.tagG = kgTag(t.g, kg, dots, -t.bb.h * C.k * 0.42);
      place(t, t.home.x, t.home.y);
      return t;
    });
    // back row of jetty first
    cargo.slice().sort((a, b) => a.home.y - b.home.y).forEach(t => jettyL.appendChild(t.g));
    jettyL.appendChild(man.g);

    const load = () => cargo.reduce((a, t) => a + (t.slot ? t.kg : 0), 0);
    function updateBoard(reveal) {
      const on = raft.slots.filter(s => s.t).map(s => s.t.kg);
      const sum = load();
      let s;
      if (!on.length) s = '0 kg';
      else s = on.join(' + ') + ' = ' + (hideSum && !reveal ? '?' : sum) + ' kg';
      sent.textContent = s;
      sent.setAttribute('font-size', 38);
      try { const L = sent.getComputedTextLength(); if (L > 440) sent.setAttribute('font-size', f1(38 * 440 / L)); } catch (e) { /* hidden */ }
    }
    function draftTarget() {
      const l = load();
      const d = l <= K ? l / K * F : F + Math.min(26, (l - K) / K * F);
      return WS - F + d;
    }
    function settleRaft() { spr.target = draftTarget(); spr.w = 4.2; spr.z = 0.45; spr.asleep = false; kick(); }
    function slotWorld(s) { return { x: raft.x + s.x, y: spr.y + s.y }; }
    function toRaft(t, s) {
      s.t = t; t.slot = s;
      (s.y < -20 ? raft.backL : raft.frontL).appendChild(t.g);
      const w = { x: t.x - raft.x, y: t.y - spr.y };
      place(t, w.x, w.y);
      t.shadow.setAttribute('display', 'none');
      return flyTo(t, s.x, s.y, t.base, 180).then(() => squash(t, t.kg >= 5));
    }
    function addToRaft(t) {
      const free = raft.slots.find(s => !s.t);
      if (!free) { toHome(t); return; }
      GS.sfx.drop();
      toRaft(t, free);
      settleRaft();
      if (t.kg >= 5) GS.sfx.creak();
      updateBoard();
      btn.disabled = false;
    }
    function toHome(t) {
      if (t.slot) { t.slot.t = null; t.slot = null; }
      jettyL.appendChild(t.g);
      t.shadow.removeAttribute('display');
      cargo.slice().sort((a, b) => a.home.y - b.home.y).forEach(c => { if (!c.slot && c !== t) jettyL.appendChild(c.g); });
      jettyL.appendChild(man.g);
      GS.sfx.pop();
      flyTo(t, t.home.x, t.home.y, t.base, 220).then(() => squash(t, false));
      settleRaft();
      updateBoard();
      btn.disabled = load() === 0;
    }
    const overRaft = p => Math.abs(p.x - raft.x) < RV.hw + 30 && p.y > spr.y - 190 && p.y < spr.y + 70;
    cargo.forEach(t => dragify(t, {
      can: () => !S.locked,
      worldPos: tt => tt.slot ? slotWorld(tt.slot) : { x: tt.x, y: tt.y },
      pick: tt => {
        if (tt.slot) { tt.slot.t = null; tt.slot = null; settleRaft(); updateBoard(); }
        tt.shadow.removeAttribute('display');
      },
      drop: (tt, p) => { if (overRaft(p)) addToRaft(tt); else toHome(tt); },
      key: tt => { if (tt.slot) toHome(tt); else { const w = { x: tt.x, y: tt.y }; S.dragLayer.appendChild(tt.g); place(tt, w.x, w.y); addToRaft(tt); } }
    }));

    const btn = button('Dayung!', '', () => dayung());
    btn.disabled = true;
    updateBoard();

    async function dayung() {
      if (S.locked) return;
      const l = load();
      if (!l) return;
      const my = gen; S.locked = true; btn.disabled = true;
      if (hideSum) updateBoard(true);
      if (l > K) { await overload(l); if (my !== gen) return; }
      else if ((exactLevel && l === K) || (!exactLevel && l === P.best)) { await cross(l); return; }
      else {
        tries++;
        GS.sfx.oops();
        man.fxw.classList.remove('gs-wobble'); void man.fxw.getBBox(); man.fxw.classList.add('gs-wobble');
        if (exactLevel) await sayWait('Belum ' + K + ' kilo. Masih kurang ' + (K - l) + ' kilo.', 'oops');
        else await sayWait('Masih bisa lebih berat, asal tidak lewat ' + K + ' kilo.', 'oops');
        if (my !== gen) return;
        if (!exactLevel && tries >= 2) hint();
      }
      if (hideSum) updateBoard(false);
      S.locked = false; btn.disabled = load() === 0;
      hud.mood('think');
    }
    function hint() {
      cargo.forEach(t => {
        if (P.bestMask & (1 << t.idx)) {
          t.fx.classList.add('gs-pulse');
          setTimeout(() => t.fx.classList.remove('gs-pulse'), 2600);
        }
      });
      say('Coba barang yang berkedip.', 'point');
    }
    async function overload(l) {
      const my = gen;
      tries++;
      GS.sfx.creak();
      say('Wah, terlalu berat! Rakitnya tenggelam.', 'surprise');
      // the boatman pushes off; the overloaded raft goes under slowly
      T(500, (e, p) => man.pad.setAttribute('transform', 'rotate(' + f1(Math.sin(p * Math.PI) * 25) + ' 24 -60)'));
      spr.w = 1.3; spr.z = 1.0; spr.target = WS + 70; spr.asleep = false; kick();
      await waitUntil(() => spr.y > WS + 2, 4000);
      if (my !== gen) return;
      const loose = cargo.filter(t => t.slot);
      loose.forEach(t => {
        const w = slotWorld(t.slot);
        riverItems.appendChild(t.g);
        place(t, w.x, w.y);
        t.body = Body({
          x: w.x, y: w.y, v: spr.v, H: t.bb.h * t.base, w: t.bb.w * t.base, rho: t.rho, ws: WS, floor: 1100, drift: 16,
          fxLayer: S.fxTop, inWater: true,
          render: b => { place(t, b.x, b.y); t.g.setAttribute('opacity', f1(1 - clamp((b.y - b.H - WS) / 140, 0, 0.92))); }
        });
        sim.bodies.push(t.body);
      });
      GS.sfx.splash(); kick();
      await W(2600);
      if (my !== gen) return;
      const fl = [...new Set(loose.filter(t => t.rho < 1).map(t => t.label))];
      const sk = [...new Set(loose.filter(t => t.rho >= 1).map(t => t.label))];
      const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
      const andJoin = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' dan ' + a[a.length - 1] : a[0];
      let msg = '';
      if (fl.length) msg += cap(andJoin(fl)) + ' terapung. ';
      if (sk.length) msg += cap(andJoin(sk)) + ' tenggelam.';
      await sayWait(msg.trim(), 'think');
      if (my !== gen) return;
      // retry restores it: lift the raft, fish the cargo back on board
      loose.forEach(t => { sim.bodies.splice(sim.bodies.indexOf(t.body), 1); t.body = null; });
      spr.target = draftTarget(); spr.w = 3; spr.z = 0.8; spr.asleep = false; kick();
      man.pad.removeAttribute('transform');
      GS.sfx.whoosh();
      await Promise.all(loose.map(t => {
        const x0 = t.x, y0 = t.y, s = t.slot;
        return T(700, e => {
          const w = slotWorld(s);
          place(t, GS.lerp(x0, w.x, e), GS.lerp(y0, w.y, e) - Math.sin(Math.PI * e) * 60);
          t.g.setAttribute('opacity', f1(GS.lerp(+t.g.getAttribute('opacity') || 1, 1, e)));
        }, 'inOutCubic').then(() => {
          t.g.removeAttribute('opacity');
          (s.y < -20 ? raft.backL : raft.frontL).appendChild(t.g);
          place(t, s.x, s.y);
        });
      }));
      if (my !== gen) return;
      await sayWait('Rakit cuma kuat ' + K + ' kilo. Kurangi muatannya.', 'point');
    }
    async function cross(l) {
      const my = gen;
      hud.mood('happy');
      say(exactLevel ? 'Tepat ' + K + ' kilo! Ayo menyeberang!' : l + ' kilo, paling banyak tanpa lewat ' + K + '!');
      // hop on board at the stern
      const from = { x: 392, y: 548 }, to = { x: raft.x - RV.hw + 36, y: spr.y - 20 };
      GS.sfx.boing();
      await T(520, (e, p) => {
        man.g.setAttribute('transform', 'translate(' + f1(GS.lerp(from.x, to.x, e)) + ' ' + f1(GS.lerp(from.y, to.y, e) - Math.sin(Math.PI * p) * 70) + ') scale(0.92)');
      }, 'inOutCubic');
      if (my !== gen) return;
      raft.backL.appendChild(man.g);
      man.g.setAttribute('transform', 'translate(' + (-RV.hw + 36) + ' -20) scale(0.92)');
      GS.sfx.drop();
      await W(250);
      GS.sfx.whoosh();
      const x0 = raft.x, x1 = 1150 - RV.hw - 8;
      let lastWake = 0;
      await T(3200, (e, p) => {
        raft.x = GS.lerp(x0, x1, e);
        spr.apply(spr);
        man.pad.setAttribute('transform', 'rotate(' + f1(Math.sin(p * Math.PI * 7) * 28) + ' 24 -60)');
        if (p - lastWake > 0.07 && p < 0.9) {
          lastWake = p;
          ring(S.fxTop, raft.x - RV.hw - 6, WS + 4, 8, 60, 1.1);
          if (Math.floor(p * 14) % 2 === 0) GS.sfx.tick();
        }
      }, 'inOutCubic');
      if (my !== gen) return;
      man.pad.removeAttribute('transform');
      GS.sfx.thud();
      finish(starsFor(tries), 'Sampai di seberang!');
    }

    S.solve = () => {
      cargo.forEach(t => { if (t.slot) toHome(t); });
      setTimeout(() => {
        cargo.forEach(t => { if (P.bestMask & (1 << t.idx)) { S.dragLayer.appendChild(t.g); addToRaft(t); } });
        setTimeout(() => dayung(), 400);
      }, 300);
    };
    S.over = () => { cargo.forEach(t => { if (!t.slot) { S.dragLayer.appendChild(t.g); addToRaft(t); } }); setTimeout(() => dayung(), 400); };
    const intro = [
      'Muat rakit tepat ' + K + ' kilo, lalu Dayung!',
      'Rakit kuat ' + K + ' kilo. Muat tepat segitu!',
      'Muat sebanyak mungkin, asal tidak lewat ' + K + ' kilo.',
      'Muat paling banyak, jangan lewat ' + K + ' kilo. Hitung sendiri, ya!'
    ];
    say(intro[i - 4], 'think');
  }

  /* =====================================================================
   * PART C: bentuk plastisin (L9-10)
   * ===================================================================== */
  const PM = 30, MM = 5; // plastisin mass (g) and marble mass (g)
  function hullVolume(N) { return PM + MM * (N + 0.5); } // capacity = floor((V - M) / m) = N
  function drawShape(parent, sh) {
    const g = el('g', null, parent);
    sh.back = el('g', null, g); sh.marbL = el('g', null, g); sh.front = el('g', null, g);
    const hw = sh.W / 2, D = sh.D;
    const st = { stroke: OUT, 'stroke-width': 4, 'stroke-linejoin': 'round' };
    if (sh.k === 'bola') {
      el('circle', Object.assign({ cx: 0, cy: -sh.r, r: sh.r, fill: PL.b }, st), sh.front);
      el('ellipse', { cx: -sh.r * 0.35, cy: -sh.r * 1.35, rx: sh.r * 0.32, ry: sh.r * 0.22, fill: PL.h }, sh.front);
      el('path', { d: 'M' + sh.r * 0.2 + ' ' + -sh.r * 0.2 + ' a' + sh.r * 0.8 + ' ' + sh.r * 0.8 + ' 0 0 0 ' + sh.r * 0.6 + ' ' + -sh.r * 0.6, fill: 'none', stroke: PL.s, 'stroke-width': 6, 'stroke-linecap': 'round' }, sh.front);
      return g;
    }
    let outer, rimFront, inner;
    if (sh.k === 'perahu') {
      outer = 'M' + -hw + ' ' + (-D - 10) + ' Q' + -hw * 0.6 + ' 2 0 0 Q' + hw * 0.6 + ' 2 ' + hw + ' ' + (-D - 10);
      rimFront = ' Q0 ' + (-D + 16) + ' ' + -hw + ' ' + (-D - 10) + 'Z';
      inner = 'M' + -hw + ' ' + (-D - 10) + ' Q0 ' + (-D - 30) + ' ' + hw + ' ' + (-D - 10) + ' Q0 ' + (-D + 16) + ' ' + -hw + ' ' + (-D - 10) + 'Z';
    } else if (sh.k === 'kotak') {
      outer = 'M' + -hw + ' ' + -D + ' L' + (-hw + 8) + ' -8 Q' + (-hw + 10) + ' 0 ' + (-hw + 20) + ' 0 H' + (hw - 20) + ' Q' + (hw - 10) + ' 0 ' + (hw - 8) + ' -8 L' + hw + ' ' + -D;
      rimFront = ' L' + (hw - 10) + ' ' + (-D + 8) + ' H' + (-hw + 10) + 'Z';
      inner = 'M' + -hw + ' ' + -D + ' L' + (-hw + 12) + ' ' + (-D - 14) + ' H' + (hw - 12) + ' L' + hw + ' ' + -D + ' L' + (hw - 10) + ' ' + (-D + 8) + ' H' + (-hw + 10) + 'Z';
    } else {
      outer = 'M' + -hw + ' ' + -D + ' C' + -hw + ' ' + -D * 0.25 + ' ' + -hw * 0.55 + ' 0 0 0 C' + hw * 0.55 + ' 0 ' + hw + ' ' + -D * 0.25 + ' ' + hw + ' ' + -D;
      rimFront = ' A' + hw + ' 12 0 0 1 ' + -hw + ' ' + -D + 'Z';
      inner = 'M' + -hw + ' ' + -D + ' A' + hw + ' 12 0 0 1 ' + hw + ' ' + -D + ' A' + hw + ' 12 0 0 1 ' + -hw + ' ' + -D + 'Z';
    }
    el('path', Object.assign({ d: inner, fill: PL.in }, st), sh.back);
    el('path', { d: inner, fill: OUT, 'fill-opacity': 0.12, transform: 'translate(0 3) scale(0.86 0.7) translate(0 ' + (-D * 0.4) + ')' }, sh.back);
    sh.flood = el('path', { d: inner, fill: '#3FA7C4', 'fill-opacity': 0.75, display: 'none' }, sh.back);
    const body = outer + rimFront;
    el('path', { d: body, fill: PL.b }, sh.front);
    el('ellipse', { cx: -hw * 0.55, cy: -D * 0.55, rx: Math.max(7, hw * 0.16), ry: D * 0.16, fill: PL.h, transform: 'rotate(-20 ' + -hw * 0.55 + ' ' + -D * 0.55 + ')' }, sh.front);
    el('path', { d: 'M' + hw * 0.15 + ' -5 Q' + hw * 0.62 + ' -6 ' + hw * 0.8 + ' ' + -D * 0.45, fill: 'none', stroke: PL.s, 'stroke-width': 7, 'stroke-linecap': 'round' }, sh.front);
    el('path', Object.assign({ d: body, fill: 'none' }, st), sh.front);
    return g;
  }
  function drawMarble(parent, j, x, y) {
    const cols = ['#6FAEE3', '#FFC83D', '#86CC8C', '#F27A6E', '#F59AB0'];
    const g = el('g', { transform: 'translate(' + f1(x) + ' ' + f1(y) + ')' }, parent);
    el('circle', { r: 9, fill: cols[j % cols.length], stroke: OUT, 'stroke-width': 2.2 }, g);
    el('path', { d: 'M-5 2 q4 -6 9 -2', fill: 'none', stroke: '#fff', 'stroke-width': 2, opacity: 0.7, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: -3, cy: -3.5, r: 2, fill: '#fff' }, g);
    return g;
  }
  function marbleSlot(sh, j) {
    const cap0 = Math.max(3, Math.floor((sh.W - 34) / 19));
    let row = 0, k = j, cap = cap0;
    while (k >= cap && cap > 1) { k -= cap; row++; cap--; }
    return { x: (k - (cap - 1) / 2) * 19, y: -sh.D + 3 - row * 13 };
  }
  function drawJar(parent, x, y, target) {
    const g = el('g', { class: 'pr-tap pr-focus', tabindex: 0, role: 'button', 'aria-label': 'Toples kelereng', transform: 'translate(' + x + ' ' + y + ')' }, parent);
    el('ellipse', { cx: 0, cy: 2, rx: 48, ry: 9, fill: OUT, 'fill-opacity': 0.18 }, g);
    el('rect', { class: 'pr-ring', x: -62, y: -150, width: 124, height: 168, rx: 18, fill: 'none', stroke: '#1F6FD1', 'stroke-width': 4, 'stroke-dasharray': '10 7' }, g);
    el('rect', { x: -44, y: -104, width: 88, height: 104, rx: 20, fill: '#E3F4F6', 'fill-opacity': 0.7 }, g);
    const pos = [[-24, -12], [-4, -12], [16, -12], [32, -14], [-30, -30], [-12, -31], [8, -30], [26, -31], [-20, -48], [0, -49], [20, -48], [-8, -65], [12, -64]];
    pos.forEach((p, j) => drawMarble(g, j, p[0], p[1]));
    el('rect', { x: -44, y: -104, width: 88, height: 104, rx: 20, fill: 'none', stroke: OUT, 'stroke-width': 4 }, g);
    el('path', { d: 'M-30 -86 v50', stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.6 }, g);
    el('rect', { x: -34, y: -118, width: 68, height: 18, rx: 7, fill: '#2F80C9', stroke: OUT, 'stroke-width': 3.5 }, g);
    el('path', { d: 'M-26 -112 h44', stroke: '#6FAEE3', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
    const w = target ? 150 : 100;
    el('rect', { x: -w / 2, y: 8, width: w, height: 28, rx: 10, fill: '#FFF8EC', stroke: OUT, 'stroke-width': 2.5 }, g);
    txt(g, 0, 29, target ? 'bawa ' + target + ' kelereng' : 'kelereng', { class: 't-body', 'font-size': 18, 'font-weight': 700 });
    el('rect', { x: -62, y: -150, width: 124, height: 190, fill: '#fff', 'fill-opacity': 0 }, g);
    return g;
  }

  function buildC(i) {
    const L9 = i === 8;
    const shapes = [];
    if (L9) {
      shapes.push({ k: 'bola', label: 'bola', N: 0 });
      shapes.push({ k: 'perahu', label: 'perahu kecil', N: GS.rand(4, 6) });
      shapes.push({ k: 'mangkuk', label: 'mangkuk lebar', N: GS.rand(9, 12) });
    } else {
      const nB = GS.rand(3, 5), nS = GS.rand(6, 8), nL = GS.rand(nS + 3, 12);
      shapes.push({ k: 'bola', label: 'bola', N: 0 });
      shapes.push({ k: 'perahu', label: 'perahu kecil', N: nB });
      shapes.push({ k: 'kotak', label: 'kotak kecil', N: nS });
      shapes.push({ k: 'mangkuk', label: 'mangkuk lebar', N: nL });
      S.target = GS.rand(nS + 1, nL);
    }
    shapes.forEach(sh => {
      if (sh.k === 'bola') { sh.r = 22; sh.W = 44; sh.D = 44; sh.H = 44; sh.rho0 = 1.5; }
      else { sh.V = hullVolume(sh.N); sh.D = 46; sh.H = 46; sh.W = clamp(sh.V * 1.75, 84, 210); sh.rho0 = PM / sh.V; }
    });
    pierScene();
    const tank = drawTank(world);
    const jetty = el('g', null, world);
    S.fxTop = el('g', null, world);
    S.dragLayer = el('g', null, world);

    // comparison chart: one row per shape, bars made of marbles
    const rows = shapes.length, rowH = rows > 3 ? 46 : 56;
    const chart = el('g', null, world);
    const ch = { x: 24, y: 18, w: 600, h: 70 + rows * rowH };
    el('rect', { x: ch.x, y: ch.y, width: ch.w, height: ch.h, rx: 18, fill: '#A8673A', stroke: OUT, 'stroke-width': 4 }, chart);
    el('rect', { x: ch.x + 11, y: ch.y + 11, width: ch.w - 22, height: ch.h - 22, rx: 12, fill: '#FFF8EC', stroke: OUT, 'stroke-width': 2.5 }, chart);
    txt(chart, ch.x + ch.w / 2, ch.y + 48, 'Muat berapa kelereng?', { class: 't-display', 'font-size': 28 });
    shapes.forEach((sh, r) => {
      const y = ch.y + 66 + r * rowH + rowH / 2;
      sh.rowY = y;
      const ic = el('g', { transform: 'translate(' + (ch.x + 70) + ' ' + (y + 14) + ') scale(' + f1(Math.min(0.5, 62 / sh.W) * 100) / 100 + ')' }, chart);
      drawShape(ic, Object.assign({}, sh));
      el('path', { d: 'M' + (ch.x + 118) + ' ' + (y + 15) + ' H' + (ch.x + ch.w - 70), stroke: '#E5BE86', 'stroke-width': 2, 'stroke-dasharray': '4 6' }, chart);
      sh.bar = el('g', null, chart);
      sh.num = txt(chart, ch.x + ch.w - 42, y + 12, '?', { 'font-size': 30, fill: '#A79C8F' });
    });

    // shapes waiting on the jetty
    let xCursor = 40;
    const gap = (560 - shapes.reduce((a, s) => a + s.W, 0)) / (shapes.length - 1 || 1);
    shapes.forEach((sh, j) => {
      sh.g = el('g', { class: 'pr-tap pr-focus', tabindex: 0, role: 'button', 'aria-label': sh.label }, jetty);
      sh.home = { x: xCursor + sh.W / 2, y: 452 };
      xCursor += sh.W + gap;
      sh.sel = el('ellipse', { cx: 0, cy: 2, rx: sh.W / 2 + 16, ry: 14, fill: '#1F6FD1', 'fill-opacity': 0.25, stroke: '#1F6FD1', 'stroke-width': 4, display: 'none' }, sh.g);
      sh.shadow = el('ellipse', { cx: 0, cy: 2, rx: sh.W * 0.42, ry: 7, fill: OUT, 'fill-opacity': 0.18 }, sh.g);
      sh.ringEl = el('rect', { class: 'pr-ring', x: -sh.W / 2 - 14, y: -sh.D - 40, width: sh.W + 28, height: sh.D + 84, rx: 14, fill: 'none', stroke: '#1F6FD1', 'stroke-width': 4, 'stroke-dasharray': '10 7' }, sh.g);
      sh.art = drawShape(sh.g, sh);
      sh.tag = nameTag(sh.g, sh.label);
      el('rect', { x: -Math.max(40, sh.W / 2 + 10), y: -sh.D - 40, width: Math.max(80, sh.W + 20), height: sh.D + 84, fill: '#fff', 'fill-opacity': 0 }, sh.g);
      sh.x = sh.home.x; sh.y = sh.home.y;
      sh.g.setAttribute('transform', 'translate(' + sh.x + ' ' + sh.y + ')');
      const pick = () => choose(sh);
      sh.g.addEventListener('click', pick);
      sh.g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    const posShape = (sh, x, y) => { sh.x = x; sh.y = y; sh.g.setAttribute('transform', 'translate(' + f1(x) + ' ' + f1(y) + ')'); };
    const jar = drawJar(jetty, 560, 588, L9 ? 0 : S.target);

    let choice = null;
    function choose(sh) {
      if (S.locked) return;
      choice = sh;
      shapes.forEach(s => s.sel.setAttribute('display', s === sh ? 'inline' : 'none'));
      GS.sfx.pop();
      btn.disabled = false;
      say(L9 ? 'Tebakanmu: ' + sh.label + '. Tekan Coba!' : 'Pakai ' + sh.label + '? Tekan Coba!', 'think');
    }
    const btn = button('Coba!', '', () => coba());
    btn.disabled = true;

    // marbles: drag from the jar (or tap / Enter) into the floating shape
    let loadSt = null;
    GS.drag(jar, {
      svg,
      onStart(p) {
        if (!loadSt || loadSt.busy) return false;
        const m = drawMarble(S.dragLayer, loadSt.n, p.x, p.y - 40);
        jar.__d = { m, sx: p.x, sy: p.y, p };
        GS.sfx.pick();
      },
      onMove(p) { const d = jar.__d; if (!d) return; d.p = p; d.m.setAttribute('transform', 'translate(' + f1(p.x) + ' ' + f1(p.y - 40) + ')'); },
      onEnd(p) {
        const d = jar.__d; jar.__d = null; if (!d) return;
        const tap = Math.hypot(p.x - d.sx, p.y - d.sy) < 12;
        const inTank = p.x > TK.x0 - 30 && p.x < TK.x1 + 30 && p.y < TK.base;
        if (tap || inTank) addMarble(d.m, { x: tap ? 560 : p.x, y: tap ? 460 : p.y - 40 });
        else { GS.sfx.pop(); d.m.remove(); }
      }
    });
    jar.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && loadSt) { e.preventDefault(); addMarble(null, { x: 560, y: 460 }); } });

    async function addMarble(mEl, from) {
      const st = loadSt;
      if (!st || st.busy) { if (mEl) mEl.remove(); return; }
      const my = gen;
      st.busy = true;
      const sh = st.sh, b = sh.body, j = st.n, s = marbleSlot(sh, j);
      const m = mEl || drawMarble(S.dragLayer, j, from.x, from.y);
      await T(280, e => {
        const x = GS.lerp(from.x, b.x + s.x, e), y = GS.lerp(from.y, b.y + s.y, e) - Math.sin(Math.PI * e) * 50;
        m.setAttribute('transform', 'translate(' + f1(x) + ' ' + f1(y) + ')');
      }, 'inOutCubic');
      if (my !== gen) return;
      sh.marbL.appendChild(m);
      m.setAttribute('transform', 'translate(' + f1(s.x) + ' ' + f1(s.y) + ')');
      st.n++;
      GS.sfx.count(st.n);
      const sp = toScreen(b.x, b.y - sh.D - 46);
      GS.floatText(String(st.n), sp.x, sp.y);
      // heavier load: rho_eff = (plastisin + marbles) / hull volume
      b.rho = (PM + st.n * MM) / sh.V;
      wake(b);
      if (b.rho > RHO_W) {
        // rim dips under the surface, water floods in, it sinks
        await waitUntil(() => b.y - b.ws >= b.H - 0.5, 1800);
        if (my !== gen) return;
        sh.flood.removeAttribute('display');
        b.rho = 1.7; wake(b);
        splash(tank.fx, b.x, TK.ws, sh.W * 0.6, 120);
        for (let k = 0; k < 8; k++) bubble(tank.fx, b.x + (k - 4) * sh.W / 10, b.y - sh.D * 0.5, TK.ws);
        loadSt = null; jar.classList.remove('gs-pulse');
        await waitUntil(() => b.onBottom && b.calm, 8000);
        if (my !== gen) return;
        st.res({ count: st.n - 1, sank: true });
        return;
      }
      if (st.stopAt && st.n >= st.stopAt) {
        loadSt = null; jar.classList.remove('gs-pulse');
        await waitUntil(() => b.calm, 4000);
        if (my !== gen) return;
        st.res({ count: st.n, sank: false });
        return;
      }
      st.busy = false;
    }

    async function testShape(sh, stopAt) {
      const my = gen;
      tank.items.appendChild(sh.g);
      sh.tag.setAttribute('display', 'none');
      sh.sel.setAttribute('display', 'none');
      sh.shadow.setAttribute('display', 'none');
      GS.sfx.whoosh();
      const x0 = sh.x, y0 = sh.y, tx = TK.cx, ty = TK.ws - 30;
      await T(600, e => posShape(sh, GS.lerp(x0, tx, e), GS.lerp(y0, ty, e) - Math.sin(Math.PI * e) * 120), 'inOutCubic');
      if (my !== gen) return null;
      const b = sh.body = Body({
        x: tx, y: ty, H: sh.H, w: sh.W, rho: sh.rho0, ws: TK.ws, floor: TK.floor, fxLayer: tank.fx,
        render: bb => posShape(sh, bb.x, bb.y),
        onEnter: bb => splash(tank.fx, bb.x, TK.ws, sh.W * 0.7, bb.v),
        onLand: bb => { if (bb.v > 60) GS.sfx.thud(); }
      });
      sim.bodies.push(b); kick();
      if (sh.k === 'bola') {
        await waitUntil(() => b.onBottom && b.calm, 8000);
        return { count: 0, sank: true };
      }
      await waitUntil(() => b.calm, 5000);
      if (my !== gen) return null;
      say('Seret kelereng ke ' + sh.label + '. Hitung, ya!', 'point');
      jar.classList.add('gs-pulse');
      return new Promise(res => { loadSt = { sh, n: 0, stopAt, res, busy: false }; });
    }
    async function fillBar(sh, count) {
      const my = gen;
      sh.bar.innerHTML = '';
      for (let k = 0; k < count; k++) {
        const m = drawMarble(sh.bar, k, ch.x + 134 + k * 30, sh.rowY + 6);
        m.setAttribute('opacity', 0);
        await T(90, e => { m.setAttribute('opacity', 1); m.setAttribute('transform', 'translate(' + (ch.x + 134 + k * 30) + ' ' + (sh.rowY + 6) + ') scale(' + f1(0.4 + 0.6 * e) + ')'); }, 'outBack');
        GS.sfx.count(k + 1);
        if (my !== gen) return;
      }
      sh.num.textContent = count;
      sh.num.setAttribute('fill', '#2B1D14');
      GS.sfx.pop();
    }
    async function returnShape(sh) {
      const my = gen;
      sim.bodies.splice(sim.bodies.indexOf(sh.body), 1); sh.body = null;
      const x0 = sh.x, y0 = sh.y;
      GS.sfx.whoosh();
      await T(560, e => posShape(sh, GS.lerp(x0, sh.home.x, e), GS.lerp(y0, sh.home.y, e) - Math.sin(Math.PI * e) * 120), 'inOutCubic');
      if (my !== gen) return;
      sh.marbL.innerHTML = '';
      sh.flood && sh.flood.setAttribute('display', 'none');
      sh.tag.removeAttribute('display');
      sh.shadow.removeAttribute('display');
      jetty.insertBefore(sh.g, jar);
      GS.sfx.drop();
    }

    async function coba() {
      if (S.locked || !choice) return;
      const my = gen;
      S.locked = true; btn.disabled = true;
      shapes.forEach(s => s.g.classList.remove('pr-tap'));
      if (L9) {
        const pred = choice;
        for (const sh of shapes) {
          const r = await testShape(sh, 0);
          if (my !== gen || !r) return;
          sh.result = r.count;
          await sayWait(sh.k === 'bola' ? 'Bola langsung tenggelam. Nol kelereng!' : sh.label.charAt(0).toUpperCase() + sh.label.slice(1) + ' kuat membawa ' + r.count + ' kelereng.', sh.k === 'bola' ? 'surprise' : 'happy');
          if (my !== gen) return;
          await fillBar(sh, r.count);
          await returnShape(sh);
          if (my !== gen) return;
        }
        const best = shapes.reduce((a, s) => (s.result > a.result ? s : a));
        const ok = pred === best;
        sparkle(S.fxTop, ch.x + ch.w - 42, best.rowY);
        if (ok) await sayWait('Tebakanmu pas! Ruang di dalam mangkuk paling besar.', 'happy');
        else await sayWait('Mangkuk lebar paling banyak. Ruang di dalamnya paling besar!', 'surprise');
        if (my !== gen) return;
        finish(ok ? 3 : 2, 'Bentuk lebar dan berongga, muatannya banyak!');
      } else {
        const sh = choice;
        const r = await testShape(sh, S.target);
        if (my !== gen || !r) return;
        await fillBar(sh, r.count);
        if (!r.sank && r.count >= S.target) {
          sparkle(S.fxTop, sh.x, sh.y - sh.D - 30);
          await sayWait(S.target + ' kelereng terbawa! Hebat!', 'happy');
          if (my !== gen) return;
          finish(starsFor(tries), 'Mangkuk lebar kuat membawa muatan!');
          return;
        }
        tries++;
        GS.sfx.oops();
        await sayWait(sh.k === 'bola' ? 'Bola langsung tenggelam. Coba bentuk lain!' : 'Tenggelam di kelereng ke-' + (r.count + 1) + '. Coba bentuk lain!', 'oops');
        if (my !== gen) return;
        await returnShape(sh);
        if (my !== gen) return;
        S.locked = false; choice = null;
        shapes.forEach(s => s.g.classList.add('pr-tap'));
        hud.mood('think');
      }
    }

    S.solve = () => {
      const best = shapes[shapes.length - 1];
      choose(best);
      coba();
      const my = gen;
      (function feed() {
        if (my !== gen) return;
        if (loadSt && !loadSt.busy) addMarble(null, { x: 560, y: 460 });
        setTimeout(feed, 60);
      })();
    };
    say(L9 ? 'Mana yang membawa kelereng paling banyak? Ketuk satu.' : 'Bawa ' + S.target + ' kelereng tanpa tenggelam. Pilih bentuknya!', 'think');
  }

  /* ---------------- debug hook (harmless) ---------------- */
  window.__game = {
    go: i => run.go(i),
    solve: () => S.solve && S.solve(),
    over: () => S.over && S.over(),
    set fast(v) { DBG.fast = !!v; },
    get state() { return { level: S.level, tries, locked: S.locked, bodies: sim.bodies.length, fx: sim.fx.length, raf: !!sim.raf }; }
  };

  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
