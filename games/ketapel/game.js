/* Ketapel Mangga (ketapel): pull the slingshot, launch with real projectile physics.
 * World: 1 m = 100 viewBox units, slingshot at x = 150, ground at y = 624.
 * Physics: fixed timestep 1/120 s, semi-implicit Euler, g = 9.8 m/s^2.
 * Launch speed v0 = pull * sqrt(k / m). Paper ball adds linear air drag F = -c v.
 * Every shot is simulated completely (deterministically) at release, then played back
 * in real time, so the aim guide, the debug solver and the real shot share one code path. */
(function () {
  'use strict';
  const GAME = 'ketapel';
  const LINE = '#3B2A20';
  const GY = 624;                    // ground line (viewBox)
  const X0 = 150;                    // slingshot (patok 0) x
  const LAUNCH_H = 1.4;              // pouch rest height above ground (m)
  const REST = { x: X0, y: GY - LAUNCH_H * 100 };
  const TIP_L = { x: 124, y: 477 }, TIP_R = { x: 176, y: 477 };
  const G = 9.8, DT = 1 / 120, MAX_STEPS = 120 * 9;
  const PULL_MAX = 1.6;              // m (= 160 viewBox units of pouch travel)
  const PULL_MIN = 0.15;
  const ANG_MIN = 10, ANG_MAX = 78;
  const sx = m => X0 + m * 100;
  const sy = m => GY - m * 100;

  /* ---------------- projectiles ---------------- */
  // m is relative mass (kelereng = 1). c is the linear drag coefficient (tuned below).
  const PROJ = {
    kelereng: { key: 'kelereng', name: 'kelereng', its: 'kelerengnya', m: 1, r: 0.14, e: 0.2, c: 0, weight: 'ringan', heavy: false, color: '#2F80C9' },
    batu: { key: 'batu', name: 'batu', its: 'batunya', m: 2, r: 0.16, e: 0.2, c: 0, weight: 'berat', heavy: true, color: '#63666B' },
    kertas: { key: 'kertas', name: 'bola kertas', its: 'bola kertasnya', m: 0.5, r: 0.17, e: 0, c: 0, weight: 'ringan sekali', heavy: false, color: '#B49A62' }
  };
  let K = 1; // spring constant (per kelereng mass): v0 = pull * sqrt(K / m)

  /* ---------------- geometry helpers ---------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function circAabb(x, y, r, b) {
    const qx = clamp(x, b.x0, b.x1), qy = clamp(y, b.y0, b.y1);
    const dx = x - qx, dy = y - qy, d2 = dx * dx + dy * dy;
    if (d2 > r * r) return null;
    const d = Math.sqrt(d2);
    if (d > 1e-9) return { nx: dx / d, ny: dy / d, pen: r - d };
    const opts = [[x - b.x0, -1, 0], [b.x1 - x, 1, 0], [y - b.y0, 0, -1], [b.y1 - y, 0, 1]];
    opts.sort((a, c) => a[0] - c[0]);
    return { nx: opts[0][1], ny: opts[0][2], pen: opts[0][0] + r };
  }
  function circCirc(x, y, r, c) {
    const dx = x - c.x, dy = y - c.y, rr = r + c.r, d2 = dx * dx + dy * dy;
    if (d2 > rr * rr) return null;
    const d = Math.sqrt(d2) || 1e-6;
    return { nx: dx / d, ny: dy / d, pen: rr - d };
  }
  function respond(s, c, e, fr) {
    s.x += c.nx * c.pen; s.y += c.ny * c.pen;
    const vn = s.vx * c.nx + s.vy * c.ny;
    if (vn < 0) {
      const tx = s.vx - vn * c.nx, ty = s.vy - vn * c.ny;
      s.vx = tx * fr - e * vn * c.nx;
      s.vy = ty * fr - e * vn * c.ny;
    }
  }
  // Collision boxes of a 3-can pyramid standing on a crate at patok x (meters).
  const crateBox = x => ({ x0: x - 0.44, x1: x + 0.44, y0: 0, y1: 0.40 });
  const canBoxes = x => [{ x0: x - 0.40, x1: x + 0.40, y0: 0.40, y1: 0.88 }, { x0: x - 0.20, x1: x + 0.20, y0: 0.88, y1: 1.36 }];

  /**
   * Simulate one shot completely. Pure and deterministic.
   * world: { targets:[{id, kind:'can', boxes} | {id, kind:'mango', x, y, r}], solids:[{x0,x1,y0,y1,kind}], canopies:[{x,y,r}] }
   */
  function simulate(world, projKey, pull, deg) {
    const P = PROJ[projKey];
    const v0 = pull * Math.sqrt(K / P.m);
    const a = deg * Math.PI / 180;
    const s = { x: 0, y: LAUNCH_H, vx: v0 * Math.cos(a), vy: v0 * Math.sin(a) };
    const b = P.c / P.m;
    const r = P.r;
    const gone = {};
    const pts = [s.x, s.y];
    const events = [];
    let landing = null, caught = false, out = false, hitSolid = null;
    let i = 1;
    for (; i <= MAX_STEPS; i++) {
      // semi-implicit Euler: velocity first, then position with the new velocity
      s.vx += (-b * s.vx) * DT;
      s.vy += (-G - b * s.vy) * DT;
      s.x += s.vx * DT;
      s.y += s.vy * DT;
      let surf = false;
      for (const t of world.targets) {
        if (gone[t.id]) continue;
        let c = null;
        if (t.kind === 'can') { for (const bx of t.boxes) { c = circAabb(s.x, s.y, r, bx); if (c) break; } }
        else c = circCirc(s.x, s.y, r, t);
        if (c) {
          gone[t.id] = true;
          events.push({ step: i, type: 'hit', id: t.id, vx: s.vx, vy: s.vy });
          respond(s, c, 0.3, 0.6);
        }
      }
      if (!caught) {
        for (const cp of world.canopies) {
          if (circCirc(s.x, s.y, r, cp)) {
            caught = true;
            events.push({ step: i, type: 'leaves', x: s.x, y: s.y });
            s.vx *= 0.08; s.vy = Math.min(0, s.vy * 0.08);
            break;
          }
        }
      }
      for (const bx of world.solids) {
        const c = circAabb(s.x, s.y, r, bx);
        if (!c) continue;
        if (c.ny > 0.7) surf = true;
        else if (!hitSolid) { hitSolid = bx.kind || 'solid'; events.push({ step: i, type: 'bonk', kind: hitSolid }); }
        respond(s, c, bx.e != null ? bx.e : P.e, 0.3);
      }
      if (s.y < r) { respond(s, { nx: 0, ny: 1, pen: r - s.y }, P.e, 0.3); surf = true; }
      if (surf) {
        if (!landing) { landing = { x: s.x, y: s.y - r, step: i }; events.push({ step: i, type: 'land', x: s.x }); }
        if (Math.abs(s.vy) < 0.6) {
          s.vy = 0;
          const f = 1.2 * G * DT; // rolling/sliding friction on grass
          s.vx = Math.abs(s.vx) <= f ? 0 : s.vx - Math.sign(s.vx) * f;
        }
      }
      pts.push(s.x, s.y);
      if (surf && s.vy === 0 && Math.abs(s.vx) < 0.03) break;
      if (s.x > 12.9 || s.x < -1.6 || s.y < -1) { out = true; break; }
    }
    return { pts, events, landing, caught, out, hitSolid, steps: Math.min(i, MAX_STEPS), v0, proj: projKey, pull, deg };
  }

  // Tune constants once, with the same simulator: max pull at 45 deg sends the kelereng ~11 m,
  // the paper ball (half the mass, so faster) lands at ~6 m because of air drag.
  function freeRange(projKey, pull, deg) {
    const res = simulate({ targets: [], solids: [], canopies: [] }, projKey, pull, deg);
    return res.landing ? res.landing.x : 99;
  }
  (function tune() {
    let lo = 1, hi = 200;
    for (let n = 0; n < 50; n++) { K = (lo + hi) / 2; if (freeRange('kelereng', PULL_MAX, 45) < 11) lo = K; else hi = K; }
    K = (lo + hi) / 2;
    lo = 0; hi = 5;
    for (let n = 0; n < 50; n++) { PROJ.kertas.c = (lo + hi) / 2; if (freeRange('kertas', PULL_MAX, 45) > 6) lo = PROJ.kertas.c; else hi = PROJ.kertas.c; }
    PROJ.kertas.c = (lo + hi) / 2;
  })();

  /* ---------------- level definitions ---------------- */
  const R = GS.rand;
  const LEVELS = [
    { lock: true, guide: true, proj: ['kelereng'], make: () => ({ cans: [3] }), say: 'Robohkan kalengnya! Ketuk dulu patok tebakanmu.' },
    { lock: true, guide: true, proj: ['kelereng'], make: () => ({ cans: [6] }), say: 'Kalengnya lebih jauh. Ketuk patok tebakanmu dulu.' },
    { lock: true, proj: ['kelereng'], make: () => ({ cans: [4, 8] }), say: 'Dua kaleng! Tarik pendek untuk dekat, panjang untuk jauh.' },
    { lock: true, proj: ['kelereng'], make: () => ({ cans: [R(3, 9)] }), say: 'Sekarang tanpa titik pemandu. Kamu pasti bisa!' },
    { lock: false, proj: ['kelereng'], make: () => ({ cans: [R(5, 7)], bush: R(2, 3) + 0.5 }), say: 'Arah tarikan bisa diubah. Lewati pohon kecil itu!' },
    { lock: false, proj: ['kelereng'], make: () => mangoSetup(2), say: 'Jatuhkan mangga ke keranjang! Ketuk patok tebakanmu dulu.' },
    { lock: false, proj: ['kelereng', 'batu'], predictStages: true, staged: true, make: () => { const p = R(4, 5); return { cans: [p, p] }; }, say: 'Kelereng dulu, lalu batu. Kalengnya sama.' },
    { lock: false, proj: ['kertas'], make: () => ({ cans: [R(3, 5)] }), say: 'Ini bola kertas. Ringan, tapi ditahan udara.' },
    { lock: false, proj: ['kelereng'], make: () => ({ cans: [R(2, 3), R(5, 6), R(8, 9)] }), say: 'Tiga kaleng berjajar. Robohkan satu per satu!' },
    { lock: false, inOrder: true, proj: ['batu', 'kertas', 'kelereng'], make: () => Object.assign(mangoSetup(1, true), { cans: [R(4, 5), R(2, 3)] }), say: 'Tantangan! Batu, lalu bola kertas, lalu kelereng.' }
  ];
  function mangoSetup(n, far) {
    const mangoes = [];
    if (n === 1) mangoes.push({ x: (R(78, 84)) / 10, y: R(24, 28) / 10 });
    else { mangoes.push({ x: R(63, 67) / 10, y: R(22, 26) / 10 }); mangoes.push({ x: R(72, 76) / 10, y: R(26, 30) / 10 }); }
    const last = mangoes[mangoes.length - 1].x;
    return { mangoes, trunk: last + (far ? 0.8 : 0.75) };
  }

  /* ---------------- stage + HUD ---------------- */
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const hud = GS.hud({ gameId: GAME, title: 'Ketapel Mangga', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: buildLevel });
  const art = GS.art || {};

  const defs = GS.el('defs', null, svg);
  defs.innerHTML = '<pattern id="ktWeave" width="12" height="10" patternUnits="userSpaceOnUse"><path d="M0 5h12M6 0v10" stroke="#9C6B2E" stroke-width="2" opacity="0.55"/></pattern>';
  const bg = GS.el('g', { class: 'bg' }, svg);
  try {
    if (art.scene) GS.markup(bg, art.scene('kebun', 1280, 800));
    else throw new Error('no scene');
    const mid = bg.querySelector('.layer-mid');
    if (mid) [...mid.children].forEach(n => { const f = (n.getAttribute('fill') || '').toUpperCase(); if (!(n.tagName === 'rect' && (f === '#C9A06A' || f === '#B08650'))) n.remove(); });
    decorTree(bg, 46, 1.05); decorTree(bg, 1238, 0.9);
  } catch (e) { fallbackScene(bg); }
  const world = GS.el('g', { class: 'world' }, svg);
  const fireBtn = document.createElement('button');
  fireBtn.type = 'button'; fireBtn.className = 'gs-action'; fireBtn.textContent = 'Tembak!'; fireBtn.hidden = true;
  fireBtn.addEventListener('click', () => { GS.sfx.click(); keyFire(); });
  dock.appendChild(fireBtn);

  // Plain far-away tree (no outline, mixed toward the sky) so the kebun keeps its trees.
  function decorTree(g, x, k) {
    const t = GS.el('g', { opacity: 0.95 }, g);
    GS.el('rect', { x: x - 9 * k, y: GY - 120 * k, width: 18 * k, height: 122 * k, rx: 6, fill: '#B9926A' }, t);
    [[0, -150, 62], [-48, -118, 44], [46, -116, 46], [-20, -190, 44], [26, -186, 42]].forEach(b => GS.el('circle', { cx: x + b[0] * k, cy: GY + b[1] * k, r: b[2] * k, fill: '#86BF7E' }, t));
    GS.el('ellipse', { cx: x - 22 * k, cy: GY - 190 * k, rx: 24 * k, ry: 14 * k, fill: '#A6D29C' }, t);
  }
  function fallbackScene(g) {
    GS.el('rect', { x: 0, y: 0, width: 1280, height: 800, fill: '#9ED8EC' }, g);
    GS.el('ellipse', { cx: 300, cy: 640, rx: 520, ry: 150, fill: '#A9D3A0' }, g);
    GS.el('ellipse', { cx: 1000, cy: 650, rx: 560, ry: 170, fill: '#A9D3A0' }, g);
    GS.el('rect', { x: 0, y: GY, width: 1280, height: 800 - GY, fill: '#7CC26B' }, g);
  }

  /* ---------------- level state ---------------- */
  let S = null;    // current level state
  let token = 0;   // increments each level; stale callbacks compare against it
  let rafId = 0;
  const movers = [];

  function later(fn, ms) { const tk = token; const id = setTimeout(() => { if (tk === token) fn(); }, ms); S.timers.push(id); return id; }
  function addMover(fn) { movers.push(fn); if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(loop); } }
  let last = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (let i = movers.length - 1; i >= 0; i--) if (!movers[i](dt, now)) movers.splice(i, 1);
    rafId = movers.length ? requestAnimationFrame(loop) : 0;
  }
  function stopAll() { movers.length = 0; if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  function buildLevel(i) {
    token++;
    if (S) S.timers.forEach(clearTimeout);
    stopAll();
    world.innerHTML = '';
    world.classList.remove('gs-shake');
    const L = LEVELS[i];
    const setup = L.make();
    S = {
      i, L, timers: [], shots: 0, hits: 0, phase: 'intro', won: false,
      targets: [], solids: [], canopies: [], trails: [], predicted: null, predictedProj: null,
      pull: 0, deg: 45, kbd: false, projKey: L.proj[0], lastFlight: null
    };
    // layers (back to front)
    const Ly = S.layers = {};
    ['far', 'patok', 'trails', 'basketBack', 'targets', 'falling', 'basketFront', 'slingBack', 'shot', 'slingFront', 'fx', 'ui', 'hits'].forEach(n => { Ly[n] = GS.el('g', { class: 'L-' + n }, world); });
    drawPatok();
    // targets
    let id = 0;
    const crateXs = [];
    (setup.cans || []).forEach((x, k) => {
      const stage = L.staged ? k : 0;
      const t = { id: id++, kind: 'can', x, stage, active: stage === 0, hit: false };
      S.targets.push(t);
      if (crateXs.indexOf(x) < 0) { crateXs.push(x); drawCrate(x); S.solids.push(Object.assign(crateBox(x), { kind: 'crate' })); }
      if (t.active) drawCanStack(t, false);
    });
    if (setup.bush != null) drawBush(setup.bush);
    if (setup.mangoes) drawMangoTree(setup, id);
    S.order = L.inOrder ? S.targets.slice() : S.targets.slice().sort((a, b) => (a.stage - b.stage) || (a.x - b.x));
    drawSlingshot();
    drawPicker();
    setupInput();
    S.projKey = currentProj();
    loadProjectile(false);
    hud.mood('happy');
    GS.say(L.say);
    startPredictOrAim(true);
    updateMarker();
  }

  function currentProj() { const p = S.L.proj; return p[Math.min(S.hits, p.length - 1)]; }
  function aliveTargets() { return S.targets.filter(t => t.active && !t.hit); }
  function allHit() { return S.targets.every(t => t.hit); }
  function needPredict() {
    if (S.shots === 0 && S.predictedProj == null) return true;
    return !!(S.L.predictStages && S.predictedProj !== S.projKey);
  }

  /* ---------------- drawing: patok number line ---------------- */
  function drawPatok() {
    const g = S.layers.patok;
    // a faint rope line along the ground marks the number line
    GS.el('path', { d: `M${X0} ${GY + 30}H${sx(10)}`, stroke: LINE, 'stroke-width': 3, 'stroke-dasharray': '2 10', 'stroke-linecap': 'round', opacity: 0.35 }, g);
    S.plates = [];
    for (let n = 1; n <= 10; n++) {
      const x = sx(n);
      const st = GS.el('g', null, g);
      GS.el('ellipse', { cx: x + 2, cy: GY + 2, rx: 14, ry: 4, fill: LINE, opacity: 0.18 }, st);
      GS.el('path', { d: `M${x - 7} ${GY + 4}V${GY - 34}L${x} ${GY - 44}L${x + 7} ${GY - 34}V${GY + 4}Z`, fill: '#A8673A', stroke: LINE, 'stroke-width': 3, 'stroke-linejoin': 'round' }, st);
      GS.el('path', { d: `M${x + 2} ${GY - 32}V${GY + 2}`, stroke: '#7E4A27', 'stroke-width': 4, 'stroke-linecap': 'round' }, st);
      GS.el('path', { d: `M${x - 3} ${GY - 34}V${GY - 6}`, stroke: '#C98552', 'stroke-width': 2, 'stroke-linecap': 'round' }, st);
      // number plate in front, below the ground line so crates never hide it
      const pl = GS.el('g', null, S.layers.fx);
      const inner = GS.el('g', null, pl);
      GS.el('rect', { x: x - 21, y: GY + 14, width: 42, height: 34, rx: 10, fill: '#FFF8EC', stroke: LINE, 'stroke-width': 3 }, inner);
      const t = GS.el('text', { x, y: GY + 40, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 600, fill: '#2B1D14', class: 'gs-num' }, inner);
      t.textContent = n;
      S.plates.push(inner);
    }
    // "0" under the slingshot so the line reads from zero
    const z = GS.el('text', { x: X0, y: GY + 40, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 600, fill: '#6B5444', class: 'gs-num' }, S.layers.fx);
    z.textContent = '0';
    const m = GS.el('text', { x: sx(10) + 40, y: GY + 40, 'text-anchor': 'start', 'font-size': 18, 'font-weight': 600, fill: '#6B5444', class: 'gs-num' }, S.layers.fx);
    m.textContent = 'meter';
  }

  /* ---------------- drawing: props ---------------- */
  function shadow(parent, x, y, rx) { GS.el('ellipse', { cx: x, cy: y, rx, ry: Math.max(4, rx * 0.18), fill: LINE, opacity: 0.18 }, parent); }
  function stick(parent, d, w, col) {
    col = col || { base: '#A8673A', hl: '#C98552', sh: '#7E4A27' };
    const o = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    GS.el('path', Object.assign({ d, stroke: LINE, 'stroke-width': w + 7 }, o), parent);
    GS.el('path', Object.assign({ d, stroke: col.base, 'stroke-width': w }, o), parent);
    GS.el('path', Object.assign({ d, stroke: col.sh, 'stroke-width': w * 0.32, transform: `translate(${w * 0.26} ${w * 0.08})` }, o), parent);
    GS.el('path', Object.assign({ d, stroke: col.hl, 'stroke-width': w * 0.22, transform: `translate(${-w * 0.22} ${-w * 0.06})` }, o), parent);
  }
  function drawCrate(xm) {
    const x = sx(xm), g = GS.el('g', null, S.layers.targets);
    shadow(g, x + 4, GY + 2, 52);
    const w = 88, h = 40, y = GY - h;
    GS.el('rect', { x: x - w / 2, y, width: w, height: h, rx: 5, fill: '#A8673A', stroke: LINE, 'stroke-width': 3.5 }, g);
    GS.el('rect', { x: x - w / 2 + 4, y: y + 3, width: w - 8, height: 6, rx: 3, fill: '#C98552' }, g);
    GS.el('rect', { x: x - w / 2 + 4, y: y + h - 9, width: w - 8, height: 6, rx: 3, fill: '#7E4A27' }, g);
    GS.el('path', { d: `M${x - w / 2 + 3} ${y + h / 2}H${x + w / 2 - 3}`, stroke: LINE, 'stroke-width': 2.5, opacity: 0.7 }, g);
    [-1, 1].forEach(sd => {
      GS.el('rect', { x: x + sd * (w / 2 - 9) - 7, y: y + 2, width: 14, height: h - 4, rx: 3, fill: '#8E5631', stroke: LINE, 'stroke-width': 2 }, g);
      GS.el('circle', { cx: x + sd * (w / 2 - 9), cy: y + 8, r: 2, fill: LINE }, g);
      GS.el('circle', { cx: x + sd * (w / 2 - 9), cy: y + h - 8, r: 2, fill: LINE }, g);
    });
    GS.el('path', { d: `M${x - 26} ${y + 6}L${x + 26} ${y + h - 6}`, stroke: '#7E4A27', 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
  }
  const CAN_COLORS = [
    { base: '#E2453C', hl: '#F27A6E', sh: '#B5322B' },
    { base: '#2F80C9', hl: '#6FAEE3', sh: '#215F98' },
    { base: '#FFC83D', hl: '#FFE08A', sh: '#E09A00' },
    { base: '#4DAA57', hl: '#86CC8C', sh: '#357F40' }
  ];
  // Tin can, origin at its centre (w 40, h 48).
  function canMarkup(c) {
    return `<rect x="-20" y="-24" width="40" height="48" rx="6" fill="#C9CDD2"/>
      <rect x="-20" y="-16" width="40" height="32" fill="${c.base}"/>
      <rect x="-20" y="-6" width="40" height="6" fill="#FFF8EC" opacity="0.9"/>
      <rect x="-20" y="6" width="40" height="3" fill="${c.sh}"/>
      <rect x="-20" y="-13" width="40" height="3" fill="${c.hl}"/>
      <rect x="7" y="-23" width="11" height="46" rx="3" fill="${LINE}" opacity="0.14"/>
      <rect x="-15" y="-22" width="5" height="44" rx="2.5" fill="#fff" opacity="0.5"/>
      <path d="M-19 -18H19M-19 18H19" stroke="#8C8F94" stroke-width="2"/>
      <rect x="-20" y="-24" width="40" height="48" rx="6" fill="none" stroke="${LINE}" stroke-width="3"/>
      <ellipse cx="0" cy="-24" rx="19" ry="4.5" fill="#E4E7EA" stroke="${LINE}" stroke-width="2.5"/>
      <ellipse cx="-5" cy="-25" rx="6" ry="1.4" fill="#fff" opacity="0.8"/>`;
  }
  function drawCanStack(t, drop) {
    const x = sx(t.x), base = GY - 40;
    const g = GS.el('g', { class: drop ? 'kt-pop' : null }, S.layers.targets);
    t.g = g;
    const pos = [[x - 21, base - 24], [x + 21, base - 24], [x, base - 72]];
    t.cans = pos.map((p, k) => {
      const c = CAN_COLORS[(t.id + k) % CAN_COLORS.length];
      const el = GS.el('g', { transform: `translate(${p[0]} ${p[1]})` }, g);
      GS.markup(el, canMarkup(c));
      return { el, x: p[0], y: p[1], a: 0 };
    });
  }
  function drawBush(xm) {
    const x = sx(xm), g = GS.el('g', null, S.layers.targets);
    shadow(g, x + 6, GY + 2, 50);
    stick(g, `M${x} ${GY + 2}C${x - 2} ${GY - 50} ${x + 3} ${GY - 100} ${x} ${GY - 140}`, 18);
    const cy = sy(2.0), leaves = GS.el('g', { class: 'kt-leaf' }, g);
    const blobs = [[0, 0, 62], [-46, 18, 40], [44, 16, 42], [-22, -40, 40], [26, -38, 40]];
    blobs.forEach(b => GS.el('circle', { cx: x + b[0], cy: cy + b[1], r: b[2] + 3.5, fill: LINE }, leaves));
    blobs.forEach(b => GS.el('circle', { cx: x + b[0], cy: cy + b[1], r: b[2], fill: '#4DAA57' }, leaves));
    GS.el('ellipse', { cx: x + 26, cy: cy + 34, rx: 46, ry: 18, fill: '#357F40', opacity: 0.8 }, leaves);
    GS.el('ellipse', { cx: x - 26, cy: cy - 36, rx: 26, ry: 14, fill: '#86CC8C' }, leaves);
    GS.el('ellipse', { cx: x - 44, cy: cy + 6, rx: 14, ry: 9, fill: '#86CC8C', opacity: 0.8 }, leaves);
    // a few small jambu fruits for charm
    [[-30, 6], [20, 20], [40, -12]].forEach(p => GS.el('circle', { cx: x + p[0], cy: cy + p[1], r: 6, fill: '#F59AB0', stroke: LINE, 'stroke-width': 2 }, leaves));
    S.bushG = leaves;
    S.canopies.push({ x: xm, y: 2.0, r: 0.72 });
    S.solids.push({ x0: xm - 0.12, x1: xm + 0.12, y0: 0, y1: 1.45, kind: 'trunk', e: 0.2 });
  }

  function mangoMarkup() {
    try {
      if (art.item) return { m: art.item('mangga', { shadow: false }), lib: true };
    } catch (e) { /* fall through */ }
    return { m: '', lib: false };
  }
  function drawOwnMango(g) {
    GS.el('path', { d: 'M0 -20C14 -20 22 -8 20 6C18 18 6 22 -4 20C-16 18 -22 6 -18 -6C-15 -15 -8 -20 0 -20Z', fill: '#F2B33D', stroke: LINE, 'stroke-width': 3 }, g);
    GS.el('path', { d: 'M8 14C14 10 17 4 17 -2', fill: 'none', stroke: '#C76A12', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.7 }, g);
    GS.el('ellipse', { cx: -8, cy: -8, rx: 6, ry: 4, fill: '#FFE08A' }, g);
    GS.el('path', { d: 'M-2 -18C-6 -16 -10 -12 -12 -6', fill: 'none', stroke: '#4DAA57', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
  }
  function drawMangoTree(setup, firstId) {
    const tx = sx(setup.trunk);
    const far = S.layers.far;
    const g = GS.el('g', null, far);
    shadow(g, tx + 10, GY + 3, 90);
    const topY = sy(3.6);
    stick(g, `M${tx - 4} ${GY + 4}C${tx + 4} ${GY - 120} ${tx - 10} ${GY - 220} ${tx} ${topY}`, 40);
    // roots
    stick(g, `M${tx - 16} ${GY - 10}Q${tx - 30} ${GY - 2} ${tx - 42} ${GY + 2}`, 10);
    stick(g, `M${tx + 14} ${GY - 10}Q${tx + 28} ${GY - 2} ${tx + 40} ${GY + 2}`, 10);
    // canopy (behind the branches tips): merged blobs with one outline
    const cx = tx - 40, cy = sy(4.1);
    const leaves = GS.el('g', { class: 'kt-leaf' }, g);
    const blobs = [[0, 0, 105], [-120, 30, 80], [110, 30, 78], [-60, -60, 78], [60, -62, 80], [-190, 70, 58], [0, 70, 80]];
    blobs.forEach(b => GS.el('circle', { cx: cx + b[0], cy: cy + b[1], r: b[2] + 4, fill: LINE }, leaves));
    blobs.forEach(b => GS.el('circle', { cx: cx + b[0], cy: cy + b[1], r: b[2], fill: '#4DAA57' }, leaves));
    GS.el('ellipse', { cx: cx + 60, cy: cy + 90, rx: 120, ry: 40, fill: '#357F40', opacity: 0.75 }, leaves);
    GS.el('ellipse', { cx: cx - 80, cy: cy - 70, rx: 60, ry: 26, fill: '#86CC8C' }, leaves);
    GS.el('ellipse', { cx: cx - 170, cy: cy + 40, rx: 30, ry: 16, fill: '#86CC8C', opacity: 0.8 }, leaves);
    // collision for the trunk (canopy is above the flight zone of the mangoes; branches are thin)
    S.solids.push({ x0: setup.trunk - 0.2, x1: setup.trunk + 0.2, y0: 0, y1: 3.4, kind: 'trunk', e: 0.2 });
    // basket under the mangoes
    const xs = setup.mangoes.map(m => m.x);
    const bx0 = Math.min(...xs) - 0.42, bx1 = Math.max(...xs) + 0.42;
    S.basket = { x0: bx0, x1: bx1, floor: 0.12 };
    drawBasket(bx0, bx1);
    // branches and mangoes
    const mlib = mangoMarkup();
    setup.mangoes.forEach((mg, k) => {
      const mx = sx(mg.x), my = sy(mg.y);
      const by = my - 52;
      stick(g, `M${tx - 6} ${by - 50 + k * 10}Q${(tx + mx) / 2} ${by - 30} ${mx + 4} ${by}`, 12);
      const lc = GS.el('g', null, g);
      [[-14, -6, 18], [12, -10, 16], [0, -18, 15]].forEach(b => GS.el('circle', { cx: mx + b[0], cy: by + b[1], r: b[2] + 3, fill: LINE }, lc));
      [[-14, -6, 18], [12, -10, 16], [0, -18, 15]].forEach(b => GS.el('circle', { cx: mx + b[0], cy: by + b[1], r: b[2], fill: '#4DAA57' }, lc));
      GS.el('ellipse', { cx: mx - 10, cy: by - 14, rx: 8, ry: 5, fill: '#86CC8C' }, lc);
      const t = { id: firstId + k, kind: 'mango', x: mg.x, y: mg.y, r: 0.22, stage: 0, active: true, hit: false };
      // hanging mango: sway group (CSS) -> body group (moved when it falls)
      const sway = GS.el('g', { class: 'kt-sway', style: `transform-origin:${mx}px ${by}px;animation-delay:${-k * 1.1}s` }, S.layers.falling);
      const stem = GS.el('path', { d: `M${mx} ${by}V${my - 20}`, stroke: '#357F40', 'stroke-width': 4, 'stroke-linecap': 'round' }, sway);
      const body = GS.el('g', { transform: `translate(${mx} ${my})` }, sway);
      if (mlib.lib && mlib.m) {
        GS.markup(GS.el('g', { transform: 'rotate(-62) scale(0.8) translate(0 25)' }, body), mlib.m);
      } else drawOwnMango(body);
      t.sway = sway; t.stem = stem; t.body = body;
      S.targets.push(t);
    });
  }
  function drawBasket(x0m, x1m) {
    const x0 = sx(x0m), x1 = sx(x1m), h = 48, top = GY - h;
    const back = S.layers.basketBack, front = S.layers.basketFront;
    shadow(back, (x0 + x1) / 2 + 6, GY + 3, (x1 - x0) / 2 + 10);
    GS.el('ellipse', { cx: (x0 + x1) / 2, cy: top + 2, rx: (x1 - x0) / 2, ry: 10, fill: '#7E4A27', stroke: LINE, 'stroke-width': 3 }, back);
    const g = GS.el('g', null, front);
    S.basketG = g;
    const body = `M${x0} ${top}L${x0 + 14} ${GY}H${x1 - 14}L${x1} ${top}Z`;
    GS.el('path', { d: body, fill: '#D9A85C', stroke: LINE, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, g);
    GS.el('path', { d: body, fill: 'url(#ktWeave)' }, g);
    GS.el('path', { d: `M${x1 - 30} ${top + 6}L${x1 - 18} ${GY - 4}`, stroke: '#9C6B2E', 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0.55 }, g);
    GS.el('path', { d: `M${x0 + 14} ${top + 8}L${x0 + 22} ${GY - 10}`, stroke: '#F0CC8A', 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
    GS.el('rect', { x: x0 - 6, y: top - 7, width: x1 - x0 + 12, height: 14, rx: 7, fill: '#C98B4E', stroke: LINE, 'stroke-width': 3 }, g);
    GS.el('path', { d: `M${x0 + 2} ${top - 2}H${x1 - 20}`, stroke: '#E8B97E', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
  }

  /* ---------------- slingshot ---------------- */
  function drawSlingshot() {
    const back = S.layers.slingBack, front = S.layers.slingFront;
    // dirt mound and stones
    shadow(back, X0 + 8, GY + 4, 60);
    GS.el('path', { d: `M${X0 - 58} ${GY + 4}Q${X0} ${GY - 30} ${X0 + 58} ${GY + 4}Z`, fill: '#D4A062', stroke: LINE, 'stroke-width': 3, 'stroke-linejoin': 'round' }, back);
    GS.el('path', { d: `M${X0 - 30} ${GY - 10}Q${X0} ${GY - 22} ${X0 + 22} ${GY - 12}`, stroke: '#E5BE86', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, back);
    // fork: handle + two arms
    stick(back, `M${X0} ${GY - 6}C${X0 - 2} ${GY - 40} ${X0 + 2} ${GY - 62} ${X0} ${GY - 76}`, 20);
    stick(back, `M${X0} ${GY - 70}C${X0 - 6} ${GY - 100} ${TIP_L.x + 2} ${TIP_L.y + 40} ${TIP_L.x} ${TIP_L.y}`, 16);
    stick(back, `M${X0} ${GY - 70}C${X0 + 6} ${GY - 100} ${TIP_R.x - 2} ${TIP_R.y + 40} ${TIP_R.x} ${TIP_R.y}`, 16);
    // rope binding at the fork
    GS.el('rect', { x: X0 - 13, y: GY - 84, width: 26, height: 20, rx: 6, fill: '#E9D3A6', stroke: LINE, 'stroke-width': 3 }, back);
    GS.el('path', { d: `M${X0 - 12} ${GY - 78}H${X0 + 12}M${X0 - 12} ${GY - 71}H${X0 + 12}`, stroke: '#B99860', 'stroke-width': 2.5 }, back);
    // stones on the mound
    GS.el('ellipse', { cx: X0 - 36, cy: GY - 2, rx: 13, ry: 9, fill: '#8C8F94', stroke: LINE, 'stroke-width': 2.5 }, back);
    GS.el('ellipse', { cx: X0 + 34, cy: GY, rx: 10, ry: 7, fill: '#8C8F94', stroke: LINE, 'stroke-width': 2.5 }, back);
    GS.el('ellipse', { cx: X0 - 39, cy: GY - 5, rx: 4, ry: 2.5, fill: '#B5B8BC' }, back);
    // band wraps at both tips
    [TIP_L, TIP_R].forEach(t => GS.el('rect', { x: t.x - 10, y: t.y + 2, width: 20, height: 9, rx: 4, fill: '#7A2E1E', stroke: LINE, 'stroke-width': 2.5 }, back));
    // pull track hint (where to pull) and max-pull arc
    S.track = GS.el('g', { opacity: 0 }, back);
    S.bandBack = band(back);
    S.pouch = GS.el('g', null, back);
    GS.el('rect', { x: -9, y: -19, width: 18, height: 38, rx: 8, fill: '#7E4A27', stroke: LINE, 'stroke-width': 3 }, S.pouch);
    GS.el('path', { d: 'M-3 -14V14', stroke: '#C98552', 'stroke-width': 2, 'stroke-dasharray': '3 4', 'stroke-linecap': 'round' }, S.pouch);
    S.proj = GS.el('g', null, S.layers.shot);
    S.bandFront = band(front);
    S.guide = GS.el('g', null, S.layers.trails);
    S.vib = { t: 9, amp: 0 };
    setPouch(REST.x, REST.y);
  }
  function band(parent) {
    const g = GS.el('g', null, parent);
    const o = GS.el('path', { fill: 'none', stroke: LINE, 'stroke-linecap': 'round' }, g);
    const c = GS.el('path', { fill: 'none', stroke: '#A8432B', 'stroke-linecap': 'round' }, g);
    const h = GS.el('path', { fill: 'none', stroke: '#D9735A', 'stroke-linecap': 'round', 'stroke-width': 2 }, g);
    return { o, c, h };
  }
  function setBand(b, tip, end, wob, w) {
    const mx = (tip.x + end.x) / 2, my = (tip.y + end.y) / 2;
    const dx = end.x - tip.x, dy = end.y - tip.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const sag = 4 + wob;
    const d = `M${tip.x} ${tip.y + 6}Q${mx + nx * sag} ${my + ny * sag + 3} ${end.x} ${end.y}`;
    b.o.setAttribute('d', d); b.c.setAttribute('d', d); b.h.setAttribute('d', d);
    b.o.setAttribute('stroke-width', w + 5); b.c.setAttribute('stroke-width', w);
    b.h.setAttribute('transform', `translate(${-w * 0.2} ${-w * 0.2})`);
  }
  // Place the pouch (and the projectile in it) and stretch both rubber bands to it.
  function setPouch(px, py, wob) {
    const dx = px - REST.x, dy = py - REST.y, len = Math.hypot(dx, dy);
    let ux = -1, uy = 0;
    if (len > 3) { ux = dx / len; uy = dy / len; }
    const ang = Math.atan2(uy, ux) * 180 / Math.PI;
    S.pouch.setAttribute('transform', `translate(${px + ux * 8} ${py + uy * 8}) rotate(${ang})`);
    const perpX = -uy, perpY = ux;
    const e1 = { x: px + ux * 8 + perpX * 17, y: py + uy * 8 + perpY * 17 };
    const e2 = { x: px + ux * 8 - perpX * 17, y: py + uy * 8 - perpY * 17 };
    // back band goes to the end closer to the back (left) tip
    const d1 = Math.hypot(e1.x - TIP_L.x, e1.y - TIP_L.y), d2 = Math.hypot(e2.x - TIP_L.x, e2.y - TIP_L.y);
    const eb = d1 < d2 ? e1 : e2, ef = d1 < d2 ? e2 : e1;
    const w = 10 - 4 * clamp(len / 160, 0, 1);
    setBand(S.bandBack, TIP_L, eb, wob || 0, w);
    setBand(S.bandFront, TIP_R, ef, -(wob || 0), w);
    S.pouchPos = { x: px, y: py };
    if (S.projVisible) placeProj(px, py, 0, 1, 1);
  }
  function placeProj(x, y, rot, scx, scy) {
    S.proj.setAttribute('transform', `translate(${x} ${y}) rotate(${rot || 0}) scale(${scx || 1} ${scy || 1})`);
  }

  /* ---------------- projectile art (origin at centre) ---------------- */
  function projMarkup(key, r) {
    if (key === 'kelereng') {
      return `<circle r="${r}" fill="#9ED8EC" stroke="${LINE}" stroke-width="${r * 0.2}"/>
        <path d="M${-r * 0.7} ${r * 0.2}C${-r * 0.2} ${-r * 0.5} ${r * 0.3} ${r * 0.6} ${r * 0.75} ${-r * 0.1}" fill="none" stroke="#2F80C9" stroke-width="${r * 0.32}" stroke-linecap="round"/>
        <path d="M${-r * 0.4} ${r * 0.6}C0 ${r * 0.2} ${r * 0.2} ${r * 0.8} ${r * 0.55} ${r * 0.5}" fill="none" stroke="#F28C28" stroke-width="${r * 0.2}" stroke-linecap="round"/>
        <path d="M${r * 0.15} ${r * 0.85}A${r * 0.8} ${r * 0.8} 0 0 0 ${r * 0.85} ${r * 0.2}" fill="none" stroke="#215F98" stroke-width="${r * 0.18}" stroke-linecap="round" opacity="0.6"/>
        <circle cx="${-r * 0.38}" cy="${-r * 0.4}" r="${r * 0.22}" fill="#fff"/>
        <circle cx="${-r * 0.05}" cy="${-r * 0.58}" r="${r * 0.09}" fill="#fff"/>`;
    }
    if (key === 'batu') {
      const p = [[-1, -0.25], [-0.6, -0.9], [0.2, -1], [0.85, -0.55], [1.05, 0.2], [0.6, 0.85], [-0.25, 0.95], [-0.9, 0.55]].map(q => `${q[0] * r},${q[1] * r}`).join(' ');
      return `<polygon points="${p}" fill="#8C8F94" stroke="${LINE}" stroke-width="${r * 0.18}" stroke-linejoin="round"/>
        <path d="M${r * 0.8} ${r * 0.1}C${r * 0.75} ${r * 0.6} ${r * 0.3} ${r * 0.8} ${-r * 0.2} ${r * 0.82}" fill="none" stroke="#63666B" stroke-width="${r * 0.3}" stroke-linecap="round"/>
        <ellipse cx="${-r * 0.35}" cy="${-r * 0.45}" rx="${r * 0.32}" ry="${r * 0.2}" fill="#B5B8BC"/>
        <circle cx="${r * 0.3}" cy="${-r * 0.1}" r="${r * 0.08}" fill="#63666B"/><circle cx="${-r * 0.3}" cy="${r * 0.3}" r="${r * 0.07}" fill="#63666B"/>`;
    }
    const n = 11, pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, rr = r * (k % 2 ? 0.86 : 1.04); pts.push(`${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`); }
    return `<polygon points="${pts.join(' ')}" fill="#FFF8EC" stroke="${LINE}" stroke-width="${r * 0.16}" stroke-linejoin="round"/>
      <path d="M${r * 0.2} ${r * 0.9}C${r * 0.6} ${r * 0.7} ${r * 0.85} ${r * 0.35} ${r * 0.9} 0" fill="none" stroke="#E5D9C2" stroke-width="${r * 0.35}" stroke-linecap="round"/>
      <path d="M${-r * 0.6} ${-r * 0.2}L${-r * 0.1} ${r * 0.1}L${r * 0.15} ${-r * 0.5}M${-r * 0.1} ${r * 0.1}L${-r * 0.2} ${r * 0.6}M${r * 0.15} ${-r * 0.5}L${r * 0.6} ${-r * 0.2}" fill="none" stroke="#B9AD96" stroke-width="${r * 0.1}" stroke-linecap="round"/>
      <path d="M${-r * 0.75} ${r * 0.35}H${r * 0.1}" stroke="#9ECBE8" stroke-width="${r * 0.08}" opacity="0.7"/>`;
  }
  function loadProjectile(anim) {
    S.proj.innerHTML = '';
    const P = PROJ[S.projKey];
    const inner = GS.el('g', { class: anim ? 'kt-pop' : null }, S.proj);
    GS.markup(inner, projMarkup(S.projKey, P.r * 100));
    S.projVisible = true;
    setPouch(REST.x, REST.y);
  }

  /* ---------------- projectile picker card ---------------- */
  function drawPicker() {
    const g = GS.el('g', { transform: 'translate(20 18)' }, S.layers.ui);
    S.picker = g;
    renderPicker();
  }
  function weightIcon(heavy) {
    if (heavy) {
      return `<path d="M-9 -8a9 7 0 0 1 18 0" fill="none" stroke="${LINE}" stroke-width="7" stroke-linecap="round"/>
        <path d="M-9 -8a9 7 0 0 1 18 0" fill="none" stroke="#63666B" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M-15 12Q-16 -6 0 -6Q16 -6 15 12Z" fill="#63666B" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
        <ellipse cx="-6" cy="0" rx="4" ry="3" fill="#8C8F94"/>`;
    }
    return `<path d="M-12 14C-10 0 0 -12 13 -14C10 -2 2 10 -12 14Z" fill="#FFF8EC" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-13 15L8 -8" stroke="#A8673A" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M-4 6l-4 -5M1 1l-3 -6M4 -3l4 4" stroke="#C9BFAE" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  function renderPicker() {
    const g = S.picker; g.innerHTML = '';
    const P = PROJ[S.projKey];
    const seq = S.L.proj;
    const w = seq.length > 1 ? 300 : 262;
    GS.el('rect', { x: 0, y: 4, width: w, height: 92, rx: 22, fill: LINE, opacity: 0.25 }, g);
    GS.el('rect', { x: 0, y: 0, width: w, height: 90, rx: 22, fill: '#FFF8EC', stroke: LINE, 'stroke-width': 3.5 }, g);
    GS.el('circle', { cx: 46, cy: 45, r: 33, fill: '#E6F5F0', stroke: LINE, 'stroke-width': 3 }, g);
    const ic = GS.el('g', { class: 'kt-pop' }, GS.el('g', { transform: 'translate(46 45)' }, g));
    GS.markup(ic, projMarkup(S.projKey, 21));
    const name = GS.el('text', { x: 90, y: 40, 'font-size': 26, 'font-weight': 700, fill: '#2B1D14', class: 't-body' }, g);
    name.textContent = P.name;
    const wi = GS.el('g', { transform: 'translate(103 64)' }, g);
    GS.markup(wi, weightIcon(P.heavy));
    const wt = GS.el('text', { x: 126, y: 72, 'font-size': 20, 'font-weight': 700, fill: P.heavy ? '#2B1D14' : '#6B5444', class: 't-body' }, g);
    wt.textContent = P.weight;
    if (seq.length > 1) {
      // queue of projectiles for this level, current one marked
      seq.forEach((k, j) => {
        const done = j < Math.min(S.hits, seq.length - 1) || (j < seq.length - 1 && S.hits > j);
        const cur = k === S.projKey && j === Math.min(S.hits, seq.length - 1);
        const cx = w - 26, cy = 18 + j * 27;
        GS.el('circle', { cx, cy, r: 12, fill: cur ? '#FFC83D' : '#FFF8EC', stroke: LINE, 'stroke-width': 2, opacity: done ? 0.45 : 1 }, g);
        const s = GS.el('g', { transform: `translate(${cx} ${cy})`, opacity: done ? 0.45 : 1 }, g);
        GS.markup(s, projMarkup(k, 7.5));
      });
    }
  }

  /* ---------------- input ---------------- */
  function setupInput() {
    // big pull zone: the whole left third of the screen
    const zone = GS.el('rect', { x: 0, y: 0, width: 427, height: 800, fill: 'transparent', class: 'kt-dragzone' }, S.layers.hits);
    GS.drag(zone, {
      svg,
      onStart(p) {
        if (S.phase === 'predict') { nudgePredict(); return false; }
        if (S.phase !== 'aim') return false;
        S.phase = 'pulling';
        S.dragStart = { x: p.x, y: p.y };
        S.pull = 0; S.creakAt = 0; S.kbd = false; fireBtn.hidden = true;
        hideHint();
        S.track.setAttribute('opacity', 1);
        drawTrack();
        GS.sfx.pick();
        S.proj.firstChild && S.proj.firstChild.setAttribute('transform', 'scale(1.15)');
      },
      onMove(p) {
        if (S.phase !== 'pulling') return;
        aimFrom(p.x - S.dragStart.x, p.y - S.dragStart.y);
      },
      onEnd() {
        if (S.phase !== 'pulling') return;
        S.track.setAttribute('opacity', 0);
        S.proj.firstChild && S.proj.firstChild.removeAttribute('transform');
        releaseShot();
      }
    });
    // patok tap targets (prediction); only active during the prediction phase
    S.patokHits = GS.el('g', { 'pointer-events': 'none' }, S.layers.hits);
    for (let n = 1; n <= 10; n++) {
      const r = GS.el('rect', { x: sx(n) - 46, y: 500, width: 92, height: 200, rx: 18, fill: 'transparent', class: 'kt-patok-hit', tabindex: -1, role: 'button', 'aria-label': 'Patok ' + n }, S.patokHits);
      r.addEventListener('click', () => choosePatok(n));
      r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); choosePatok(n); } });
    }
  }
  // Convert a finger offset (viewBox units, y down) into pull length + launch angle.
  function aimFrom(dx, dy) {
    let L, deg;
    if (S.L.lock) {
      deg = 45;
      L = (-dx + dy) * Math.SQRT1_2; // projection on the down-left pull rail
    } else {
      deg = Math.hypot(dx, dy) < 12 ? S.deg : clamp(Math.atan2(dy, -dx) * 180 / Math.PI, ANG_MIN, ANG_MAX);
      if (dx > 0 && dy < 0) deg = ANG_MIN;
      const a = deg * Math.PI / 180;
      L = -dx * Math.cos(a) + dy * Math.sin(a); // finger offset projected on the pull direction
    }
    setAim(L / 100, deg);
  }
  function maxPull(deg) {
    const a = deg * Math.PI / 180;
    let m = PULL_MAX;
    m = Math.min(m, (GY + 10 - REST.y) / 100 / Math.sin(a));   // pouch stays above the grass
    m = Math.min(m, (REST.x - 12) / 100 / Math.cos(a));        // and on screen
    return m;
  }
  function setAim(pullM, deg) {
    pullM = clamp(pullM, 0, maxPull(deg));
    const a = deg * Math.PI / 180;
    const px = REST.x - Math.cos(a) * pullM * 100, py = REST.y + Math.sin(a) * pullM * 100;
    if (pullM > S.creakAt + 0.16) { GS.sfx.creak(); S.creakAt = pullM; } else if (pullM < S.creakAt - 0.16) S.creakAt = pullM;
    S.pull = pullM; S.deg = deg;
    setPouch(px, py);
    if (!S.L.lock) drawTrack();
    drawGuide();
  }
  function drawTrack() {
    const g = S.track; g.innerHTML = '';
    const a = S.deg * Math.PI / 180, mp = maxPull(S.deg) * 100;
    // dashed rail in the current pull direction, with ring marks every 0.4 m
    GS.el('path', { d: `M${REST.x} ${REST.y}L${REST.x - Math.cos(a) * mp} ${REST.y + Math.sin(a) * mp}`, stroke: '#FFF8EC', 'stroke-width': 6, 'stroke-dasharray': '2 12', 'stroke-linecap': 'round', opacity: 0.9 }, g);
    for (let k = 40; k <= mp + 1; k += 40) GS.el('circle', { cx: REST.x - Math.cos(a) * k, cy: REST.y + Math.sin(a) * k, r: 4, fill: '#FFF8EC', stroke: LINE, 'stroke-width': 1.5, opacity: 0.85 }, g);
    if (!S.L.lock) {
      const R0 = PULL_MAX * 100;
      const p = deg => ({ x: REST.x - Math.cos(deg * Math.PI / 180) * R0, y: REST.y + Math.sin(deg * Math.PI / 180) * R0 });
      const s = p(ANG_MIN), e = p(Math.min(ANG_MAX, 62));
      GS.el('path', { d: `M${s.x} ${s.y}A${R0} ${R0} 0 0 1 ${e.x} ${e.y}`, fill: 'none', stroke: '#FFF8EC', 'stroke-width': 3, 'stroke-dasharray': '4 9', opacity: 0.55 }, g);
    }
  }
  function drawGuide() {
    S.guide.innerHTML = '';
    if (!S.L.guide || S.pull < PULL_MIN) return;
    const res = simulate(simWorld(), S.projKey, S.pull, S.deg);
    const end = res.landing ? res.landing.step : res.steps;
    const upto = Math.floor(end * 0.3);
    for (let i = 6; i <= upto; i += 6) {
      GS.el('circle', { cx: sx(res.pts[2 * i]), cy: sy(res.pts[2 * i + 1]), r: 6, fill: '#FFF8EC', stroke: LINE, 'stroke-width': 2, opacity: 0.9 }, S.guide);
    }
  }

  /* ---------------- prediction ---------------- */
  function startPredictOrAim(quiet) {
    if (S.won) return;
    S.projKey = currentProj();
    if (needPredict()) {
      S.phase = 'predict';
      S.patokHits.setAttribute('pointer-events', 'all');
      [...S.patokHits.children].forEach(r => r.setAttribute('tabindex', 0));
      S.plates.forEach((p, k) => { p.classList.add('kt-plate-pulse'); p.style.animationDelay = (k * 70) + 'ms'; });
      hud.mood('think');
      const P = PROJ[S.projKey];
      const line = S.shots === 0 && S.hits === 0 ? `Ketuk patok: di mana ${P.name} akan jatuh?` : `Sekarang ${P.name}. Tebak dulu, jatuh di patok mana?`;
      if (quiet) later(() => { if (S.phase === 'predict') GS.say(line); }, 3600);
      else GS.say(line);
    } else toAim();
  }
  function nudgePredict() {
    GS.sfx.oops();
    S.plates.forEach(p => { p.classList.remove('kt-plate-pulse'); void p.getBBox(); p.classList.add('kt-plate-pulse'); });
    GS.say('Ketuk patok tebakanmu dulu, ya.');
  }
  function choosePatok(n) {
    if (S.phase !== 'predict') return;
    S.predicted = n; S.predictedProj = S.projKey;
    S.patokHits.setAttribute('pointer-events', 'none');
    [...S.patokHits.children].forEach(r => r.setAttribute('tabindex', -1));
    S.plates.forEach(p => p.classList.remove('kt-plate-pulse'));
    GS.sfx.count(n);
    plantFlag(n);
    GS.say(`Tebakanmu patok ${n}. Sekarang tarik karetnya!`);
    toAim();
  }
  function plantFlag(n) {
    if (S.flag) S.flag.remove();
    const x = sx(n);
    const g = GS.el('g', { class: 'kt-pop' }, S.layers.fx);
    S.flag = g;
    GS.el('ellipse', { cx: x + 3, cy: GY + 2, rx: 10, ry: 3, fill: LINE, opacity: 0.2 }, g);
    GS.el('path', { d: `M${x} ${GY}V${GY - 92}`, stroke: LINE, 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
    GS.el('path', { d: `M${x} ${GY}V${GY - 92}`, stroke: '#E9D3A6', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    GS.el('path', { d: `M${x + 2} ${GY - 90}L${x + 50} ${GY - 76}L${x + 2} ${GY - 60}Z`, fill: '#1F6FD1', stroke: LINE, 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
    [[14, -80], [26, -76], [14, -70]].forEach(p => GS.el('circle', { cx: x + p[0], cy: GY + p[1], r: 3, fill: '#fff' }, g));
    const lab = GS.el('text', { x: x + 8, y: GY - 100, 'font-size': 17, 'font-weight': 700, fill: '#1F6FD1', class: 't-body', 'text-anchor': 'middle' }, g);
    lab.textContent = 'tebakanku';
  }
  function toAim() {
    S.phase = 'aim';
    hud.mood('point');
    if (S.shots === 0 && (S.i === 0 || S.i === 4)) showHint();
  }
  function showHint() {
    hideHint();
    const g = GS.el('g', { 'pointer-events': 'none' }, S.layers.ui);
    S.hint = g;
    const inner = GS.el('g', { class: 'kt-hint' + (S.L.lock ? '' : ' kt-hint-open') }, g);
    // a simple pointing hand (fingertip at 0,0)
    const hand = GS.el('g', { transform: `translate(${REST.x + 4} ${REST.y + 4})` }, inner);
    GS.el('path', { d: 'M0 0C-4 -2 -6 4 -3 8L6 30C9 38 18 42 28 40L38 37C46 34 49 26 46 18L40 6C38 1 32 0 29 4C28 -1 22 -2 19 2C18 -3 12 -4 9 1L5 -9C3 -14 -3 -13 -2 -7Z', fill: '#FFE0C2', stroke: LINE, 'stroke-width': 3, 'stroke-linejoin': 'round' }, hand);
    GS.el('circle', { cx: 0, cy: 0, r: 16, fill: 'none', stroke: '#fff', 'stroke-width': 4, opacity: 0.85 }, hand);
  }
  function hideHint() { if (S.hint) { S.hint.remove(); S.hint = null; } }

  /* ---------------- shooting ---------------- */
  function simWorld() {
    const targets = aliveTargets().map(t => t.kind === 'can' ? { id: t.id, kind: 'can', boxes: canBoxes(t.x) } : { id: t.id, kind: 'mango', x: t.x, y: t.y, r: t.r });
    return { targets, solids: S.solids, canopies: S.canopies };
  }
  function releaseShot() {
    if (S.pull < PULL_MIN) {
      // too small: the pouch just flops back
      S.phase = 'aim';
      S.guide.innerHTML = '';
      snapBack(false);
      GS.say('Tarik karetnya lebih jauh ke belakang.');
      return;
    }
    fire(S.pull, S.deg);
  }
  function fire(pull, deg) {
    S.phase = 'flying';
    hideHint();
    S.guide.innerHTML = '';
    fireBtn.hidden = true;
    S.shots++;
    const res = simulate(simWorld(), S.projKey, pull, deg);
    S.lastFlight = res;
    const from = { x: S.pouchPos.x, y: S.pouchPos.y };
    GS.tone({ f: 1100, f2: 260, t: 0.07, type: 'square', vol: 0.07 });
    GS.sfx.whoosh();
    hud.mood('surprise');
    // trails: push new one, fade older
    const trail = { g: GS.el('g', null, S.layers.trails), proj: S.projKey, from };
    S.trails.unshift(trail);
    while (S.trails.length > 3) S.trails.pop().g.remove();
    S.trails.forEach((t, k) => t.g.setAttribute('opacity', [1, 0.5, 0.25][k]));
    // ghost ring where the pouch was pulled to (helps "pull the same")
    GS.el('circle', { cx: from.x, cy: from.y, r: 9, fill: 'none', stroke: PROJ[S.projKey].color, 'stroke-width': 4, 'stroke-dasharray': '4 4' }, trail.g);
    playFlight(res, from, trail);
  }
  function snapBack(vibrate) {
    const from = { x: S.pouchPos.x, y: S.pouchPos.y };
    S.vib = { t: 0, amp: vibrate ? 14 : 6 };
    const t0 = performance.now();
    addMover((dt, now) => {
      const p = Math.min(1, (now - t0) / 70);
      S.vib.t += dt;
      const wob = S.vib.amp * Math.exp(-S.vib.t / 0.14) * Math.sin(S.vib.t * 2 * Math.PI * 13);
      const x = GS.lerp(from.x, REST.x, p), y = GS.lerp(from.y, REST.y, p);
      const keep = S.projVisible; if (S.flying) S.projVisible = false;
      setPouch(x, y, GS.reducedMotion ? 0 : wob);
      S.projVisible = keep;
      return S.vib.t < 0.6;
    });
  }
  function playFlight(res, from, trail) {
    const tk = token;
    const P = PROJ[res.proj];
    S.flying = true;
    // 1) band snap: the pouch springs back to rest carrying the projectile (~60 ms)
    snapBack(true);
    const t0 = performance.now();
    const snapMs = 60;
    let evIdx = 0, lastDot = 0, landed = false, landedAt = 0;
    const total = res.steps;
    addMover((dt, now) => {
      if (tk !== token) return false;
      const el = now - t0;
      if (el < snapMs) {
        const p = el / snapMs;
        placeProj(GS.lerp(from.x, REST.x, p), GS.lerp(from.y, REST.y, p), 0, 1, 1);
        return true;
      }
      const step = Math.min(total, Math.floor((el - snapMs) / 1000 / DT));
      // events up to this step
      while (evIdx < res.events.length && res.events[evIdx].step <= step) { onEvent(res.events[evIdx], res); evIdx++; }
      const x = res.pts[2 * step], y = res.pts[2 * step + 1];
      const pv = Math.max(0, step - 1);
      const vx = (x - res.pts[2 * pv]) / DT, vy = (y - res.pts[2 * pv + 1]) / DT;
      const sp = Math.hypot(vx, vy);
      if (!landed && res.landing && step >= res.landing.step) { landed = true; landedAt = now; }
      if (landed) {
        // squash and stretch on touchdown (heavy: small squash, light: bigger)
        const ms = now - landedAt, k = P.heavy ? 0.35 : res.proj === 'kertas' ? 1.2 : 1;
        let scx = 1, scy = 1;
        if (!GS.reducedMotion && ms < 100) { scx = 1 + 0.2 * k; scy = 1 - 0.15 * k; }
        else if (!GS.reducedMotion && ms < 220) { scx = 1 - 0.08 * k; scy = 1 + 0.08 * k; }
        placeProj(sx(x), sy(y) + P.r * 100 * (1 - scy), 0, scx, scy);
      } else {
        const st = GS.reducedMotion ? 1 : 1 + Math.min(0.22, sp / 50);
        placeProj(sx(x), sy(y), -Math.atan2(vy, vx) * 180 / Math.PI, st, 1 / st);
      }
      for (; lastDot + 4 <= step && (!res.landing || lastDot + 4 <= res.landing.step); lastDot += 4) {
        const i = lastDot + 4;
        GS.el('circle', { cx: sx(res.pts[2 * i]), cy: sy(res.pts[2 * i + 1]), r: 4.5, fill: P.color, stroke: '#FFF8EC', 'stroke-width': 1.5 }, trail.g);
      }
      if (step >= total && (!landed || now - landedAt > 260)) {
        S.flying = false;
        later(() => afterShot(res), 650);
        return false;
      }
      return true;
    });
  }
  function onEvent(ev, res) {
    const P = PROJ[res.proj];
    if (ev.type === 'hit') {
      const t = S.targets.find(q => q.id === ev.id);
      if (!t || t.hit) return;
      t.hit = true;
      if (t.kind === 'can') { clang(); toppleCans(t, ev); }
      else dropMango(t);
    } else if (ev.type === 'land') {
      if (P.heavy) { GS.sfx.thud(); shake(); }
      else if (res.proj === 'kertas') GS.noise({ t: 0.12, vol: 0.08, freq: 900 });
      else GS.sfx.drop();
      landMarker(ev.x);
    } else if (ev.type === 'leaves') {
      GS.noise({ t: 0.35, vol: 0.12, freq: 3200, q: 0.7 });
      if (S.bushG) { S.bushG.classList.remove('kt-rustle'); void S.bushG.getBBox(); S.bushG.classList.add('kt-rustle'); }
      leafBurst(sx(ev.x), sy(ev.y));
    } else if (ev.type === 'bonk') {
      if (ev.kind === 'trunk') GS.tone({ f: 180, f2: 90, t: 0.12, type: 'triangle', vol: 0.25 });
      else GS.tone({ f: 240, f2: 120, t: 0.1, type: 'triangle', vol: 0.2 });
    }
  }
  function shake() {
    if (GS.reducedMotion) return;
    world.classList.remove('gs-shake'); void world.getBBox(); world.classList.add('gs-shake');
  }
  function clang() {
    GS.tone({ f: 1650, t: 0.25, type: 'square', vol: 0.045 });
    GS.tone({ f: 2480, t: 0.32, type: 'triangle', vol: 0.06, delay: 0.01 });
    GS.noise({ t: 0.12, vol: 0.1, freq: 4000, q: 2 });
    GS.tone({ f: 1320, t: 0.2, type: 'square', vol: 0.03, delay: 0.16 });
  }
  // Visual-only can physics (the projectile itself was simulated exactly).
  function toppleCans(t, ev) {
    const push = clamp(ev.vx, 1, 6);
    t.cans.forEach((c, k) => {
      const b = { x: (c.x - X0) / 100, y: (GY - c.y) / 100, vx: push * (0.45 + k * 0.12) + 0.4, vy: 1.4 + (k === 2 ? 1.2 : 0.4) + Math.max(0, ev.vy) * 0.1, a: 0, va: 300 + k * 140 };
      let rest = false, bounces = 0;
      addMover(dt => {
        if (rest) return false;
        const n = Math.max(1, Math.round(dt / DT));
        for (let i = 0; i < n; i++) {
          b.vy -= G * DT; b.x += b.vx * DT; b.y += b.vy * DT; b.a += b.va * DT;
          if (b.y < 0.2) {
            b.y = 0.2;
            if (b.vy < -0.8 && bounces < 3) { b.vy = -b.vy * 0.3; b.vx *= 0.6; b.va *= 0.5; bounces++; GS.tone({ f: 1500 + k * 200, t: 0.12, type: 'square', vol: 0.025 }); }
            else { b.vy = 0; b.vx *= 0.9; b.va *= 0.8; }
          }
        }
        if (b.y <= 0.2 && Math.abs(b.vx) < 0.05) {
          b.a = Math.round(b.a / 90) * 90 + (Math.round(b.a / 90) % 2 === 0 ? 90 : 0);
          rest = true;
        }
        c.el.setAttribute('transform', `translate(${sx(b.x)} ${sy(b.y)}) rotate(${b.a})`);
        return !rest;
      });
    });
    hitSparkle(sx(t.x), GY - 100);
  }
  function dropMango(t) {
    t.sway.classList.remove('kt-sway');
    t.stem.remove();
    GS.sfx.pop();
    const b = { y: t.y, vy: 0 };
    const floor = (S.basket ? S.basket.floor : 0) + t.r;
    let bounced = 0;
    addMover(dt => {
      const n = Math.max(1, Math.round(dt / DT));
      for (let i = 0; i < n; i++) {
        b.vy -= G * DT; b.y += b.vy * DT; // same gravity as the projectile
        if (b.y < floor) {
          b.y = floor;
          if (b.vy < -1 && bounced < 2) { b.vy = -b.vy * 0.25; bounced++; if (bounced === 1) { GS.sfx.thud(); GS.sfx.coin(); basketSquash(); } }
          else b.vy = 0;
        }
      }
      t.body.setAttribute('transform', `translate(${sx(t.x)} ${sy(b.y)})`);
      return !(b.y <= floor && b.vy === 0);
    });
  }
  function basketSquash() {
    if (!S.basketG || GS.reducedMotion) return;
    const cx = (sx(S.basket.x0) + sx(S.basket.x1)) / 2;
    GS.tween(300, (e, p) => {
      const s = p < 0.5 ? 1 + 0.12 * Math.sin(p * Math.PI * 2) : 1 - 0.05 * Math.sin((p - 0.5) * Math.PI * 2);
      S.basketG.setAttribute('transform', `translate(${cx} ${GY}) scale(${2 - s} ${s}) translate(${-cx} ${-GY})`);
    }, 'linear').then(() => S.basketG && S.basketG.removeAttribute('transform'));
  }
  function hitSparkle(x, y) {
    if (GS.reducedMotion) return;
    const g = GS.el('g', null, S.layers.fx);
    const parts = [];
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      parts.push({ el: GS.el('path', { d: 'M0 -9L2.5 -2.5L9 0L2.5 2.5L0 9L-2.5 2.5L-9 0L-2.5 -2.5Z', fill: k % 2 ? '#FFC83D' : '#fff', stroke: LINE, 'stroke-width': 1.5 }, g), a });
    }
    GS.tween(520, e => parts.forEach(p => p.el.setAttribute('transform', `translate(${x + Math.cos(p.a) * 70 * e} ${y + Math.sin(p.a) * 50 * e}) scale(${1 - e * 0.7})`))).then(() => g.remove());
  }
  function leafBurst(x, y) {
    if (GS.reducedMotion) return;
    const g = GS.el('g', null, S.layers.fx);
    const leaves = [];
    for (let k = 0; k < 6; k++) leaves.push({ el: GS.el('ellipse', { rx: 8, ry: 4, fill: k % 2 ? '#4DAA57' : '#86CC8C', stroke: LINE, 'stroke-width': 1.5 }, g), dx: (k - 2.5) * 14, rot: k * 50 });
    GS.tween(900, e => leaves.forEach(l => l.el.setAttribute('transform', `translate(${x + l.dx * e * 1.5} ${y + 90 * e + Math.sin(e * 6 + l.dx) * 6}) rotate(${l.rot + e * 200})`)), 'linear').then(() => g.remove());
  }
  function landMarker(xm) {
    if (S.landG) S.landG.remove();
    const g = GS.el('g', null, S.layers.fx);
    S.landG = g;
    const x = sx(xm);
    // exact landing point
    const top = GY - 196;
    GS.el('ellipse', { cx: x, cy: GY, rx: 13, ry: 5, fill: '#7E4A27', opacity: 0.5 }, g);
    GS.el('path', { d: `M${x} ${GY - 4}V${top + 38}`, stroke: LINE, 'stroke-width': 2.5, 'stroke-dasharray': '3 6', 'stroke-linecap': 'round', opacity: 0.8 }, g);
    GS.el('circle', { cx: x, cy: GY, r: 6, fill: '#F28C28', stroke: LINE, 'stroke-width': 2.5 }, g);
    const text = labelFor(xm);
    const tw = text.length * 10.5 + 28;
    const lx = clamp(x, 20 + tw / 2, 1260 - tw / 2);
    const lg = GS.el('g', { class: 'kt-pop' }, g);
    GS.el('rect', { x: lx - tw / 2, y: top + 4, width: tw, height: 36, rx: 18, fill: LINE, opacity: 0.25 }, lg);
    GS.el('rect', { x: lx - tw / 2, y: top, width: tw, height: 36, rx: 18, fill: '#F28C28', stroke: LINE, 'stroke-width': 3 }, lg);
    const t = GS.el('text', { x: lx, y: top + 25, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: '#2B1D14', class: 't-body' }, lg);
    t.textContent = text;
  }
  function labelFor(xm) {
    const n = Math.round(xm);
    if (n < 1) return 'jatuh dekat ketapel';
    if (n > 10) return 'jatuh lewat patok 10';
    return 'jatuh di patok ' + n;
  }
  function patokWords(res) {
    if (!res.landing) return 'terbang lewat patok 10';
    const n = Math.round(res.landing.x);
    if (n < 1) return 'jatuh dekat ketapel';
    if (n > 10) return 'jatuh lewat patok 10';
    return 'jatuh di patok ' + n;
  }

  /* ---------------- after each shot ---------------- */
  function afterShot(res) {
    if (S.won) return;
    const P = PROJ[res.proj];
    const hitNow = res.events.filter(e => e.type === 'hit').length;
    S.hits = S.targets.filter(t => t.hit).length;
    if (!res.landing && res.out) landMarker(12.6);
    // prediction comparison (only on a predicted shot)
    let line = '';
    if (S.predicted != null) {
      const land = res.landing ? Math.round(res.landing.x) : 11;
      const where = patokWords(res);
      if (land === S.predicted) {
        line = `Tebakanmu tepat! ${cap(P.its)} ${where}.`;
        GS.sfx.coin();
        if (S.flag) hitSparkle(sx(S.predicted) + 20, GY - 80);
      } else {
        line = `Tebakanmu patok ${S.predicted}, ${P.its} ${where}.`;
        drawDiffArrow(S.predicted, res.landing ? res.landing.x : 11);
      }
      S.predicted = null;
    }
    if (allHit()) {
      S.won = true; S.phase = 'done';
      if (S.marker) { S.marker.remove(); S.marker = null; }
      hud.mood('cheer');
      const stars = S.shots <= S.targets.length ? 3 : S.shots <= S.targets.length + 2 ? 2 : 1;
      GS.say(line ? line + ' Kena!' : 'Kena! Hebat!');
      const text = S.targets.some(t => t.kind === 'mango') && !S.targets.some(t => t.kind === 'can') ? 'Mangganya masuk keranjang!' : S.L.proj.length > 1 ? 'Semua sasaran kena! Hebat!' : 'Kalengnya roboh semua! Hebat!';
      later(() => run.win(stars, text), 1600);
      return;
    }
    if (hitNow > 0) {
      hud.mood('happy');
      const projChanged = currentProj() !== S.projKey;
      const say = line ? line + ' Kena!' : (projChanged ? '' : 'Kena! Masih ada sasaran lagi.');
      if (say) GS.say(say);
      later(() => nextShot(), say ? 1700 : 300);
      return;
    }
    // miss: feedback from the world (target wobbles) + an informative hint
    GS.sfx.oops();
    hud.mood('oops');
    const tgt = S.order.find(t => t.active && !t.hit);
    if (tgt) wobbleTarget(tgt);
    const hint = missHint(res, tgt);
    GS.say(line ? line + ' ' + hint : hint);
    later(() => nextShot(false), line ? 2200 : 900);
  }
  // Small bouncing arrow above the next can stack in multi-target levels.
  function updateMarker() {
    if (S.marker) { S.marker.remove(); S.marker = null; }
    if (S.targets.filter(t => !t.hit).length < 2 && S.targets.length < 2) return;
    const t = S.order.find(q => q.active && !q.hit);
    if (!t || t.kind !== 'can' || S.targets.length < 2) return;
    const g = GS.el('g', { 'pointer-events': 'none' }, S.layers.fx);
    S.marker = g;
    const inner = GS.el('g', { class: 'kt-next' }, g);
    const x = sx(t.x), y = GY - 160;
    GS.el('path', { d: `M${x - 14} ${y - 22}H${x + 14}V${y - 6}H${x + 24}L${x} ${y + 16}L${x - 24} ${y - 6}H${x - 14}Z`, fill: '#FFC83D', stroke: LINE, 'stroke-width': 3, 'stroke-linejoin': 'round' }, inner);
    GS.el('path', { d: `M${x - 8} ${y - 17}V${y - 4}`, stroke: '#FFE08A', 'stroke-width': 4, 'stroke-linecap': 'round' }, inner);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function wobbleTarget(t) {
    const el = t.kind === 'can' ? t.g : t.body;
    if (!el) return;
    el.classList.remove('gs-wobble'); void el.getBBox(); el.classList.add('gs-wobble');
  }
  function missHint(res, t) {
    if (res.caught) return 'Tersangkut daun. Arahkan lebih tinggi!';
    if (!t) return 'Coba lagi, ya!';
    if (t.kind === 'mango') {
      // height of the path where it passes the mango
      const pts = res.pts;
      for (let i = 0; i + 1 < pts.length / 2; i++) {
        if (pts[2 * i] <= t.x && pts[2 * i + 2] > t.x) {
          return pts[2 * i + 1] < t.y ? 'Lewat bawah mangga. Coba lebih tinggi!' : 'Lewat atas mangga. Coba lebih rendah.';
        }
      }
      return 'Belum sampai mangga. Tarik lebih panjang!';
    }
    const lx = res.landing ? res.landing.x : 12;
    if (res.hitSolid === 'trunk' && lx < t.x) return 'Kena batang pohon. Arahkan lebih tinggi!';
    if (lx < t.x) return 'Kurang jauh. Tarik lebih panjang!';
    return 'Terlalu jauh. Tarik sedikit saja.';
  }
  function drawDiffArrow(pred, landX) {
    if (S.diffG) S.diffG.remove();
    const g = GS.el('g', { class: 'kt-fade' }, S.layers.fx);
    S.diffG = g;
    const x1 = sx(pred), x2 = sx(clamp(landX, 0, 11.2)), y = GY - 146;
    if (Math.abs(x2 - x1) < 30) return;
    const dir = Math.sign(x2 - x1);
    GS.el('path', { d: `M${x1} ${y}H${x2 - dir * 10}`, stroke: '#1F6FD1', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '1 10' }, g);
    GS.el('path', { d: `M${x2 - dir * 16} ${y - 9}L${x2} ${y}L${x2 - dir * 16} ${y + 9}`, fill: 'none', stroke: '#1F6FD1', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    GS.el('circle', { cx: x1, cy: y, r: 7, fill: '#1F6FD1', stroke: LINE, 'stroke-width': 2 }, g);
    later(() => { g.style.opacity = 0; }, 4200);
  }
  function nextShot() {
    if (S.won) return;
    hud.mood('happy');
    const newProj = currentProj();
    const changed = newProj !== S.projKey;
    // staged level: reveal the next target (cans rebuilt on the same crate)
    let revealed = false;
    S.targets.forEach(t => {
      if (!t.active && t.stage <= S.hits) {
        t.active = true; revealed = true;
        S.targets.filter(o => o.kind === 'can' && o.hit && o.x === t.x && o.g).forEach(o => { o.g.classList.add('kt-fade'); o.g.style.opacity = 0; });
        later(() => { drawCanStack(t, true); GS.sfx.drop(); }, 350);
      }
    });
    S.projKey = newProj;
    if (changed) { renderPicker(); GS.sfx.pick(); }
    loadProjectile(true);
    GS.sfx.pick();
    if (changed && !S.L.predictStages) GS.say(`Sekarang pakai ${PROJ[newProj].name}. ${PROJ[newProj].heavy ? 'Lebih berat!' : 'Ringan sekali!'}`);
    if (revealed) GS.say('Pak Tani menyusun kalengnya lagi.');
    later(() => { startPredictOrAim(); updateMarker(); }, revealed ? 1500 : changed && !S.L.predictStages ? 900 : 50);
  }

  /* ---------------- keyboard ---------------- */
  document.addEventListener('keydown', e => {
    if (!S || e.target.closest && e.target.closest('.gs-overlay')) return;
    if (S.phase === 'predict' && /^[0-9]$/.test(e.key)) { choosePatok(e.key === '0' ? 10 : +e.key); return; }
    if (S.phase !== 'aim') return;
    const step = 0.04;
    let used = true;
    if (e.key === 'ArrowLeft') kbdAim(S.pull + step, S.deg);
    else if (e.key === 'ArrowRight') kbdAim(S.pull - step, S.deg);
    else if (e.key === 'ArrowUp' && !S.L.lock) kbdAim(S.pull, S.deg + 2);
    else if (e.key === 'ArrowDown' && !S.L.lock) kbdAim(S.pull, S.deg - 2);
    else if ((e.key === 'Enter' || e.key === ' ') && S.kbd && !(e.target instanceof HTMLButtonElement)) keyFire();
    else used = false;
    if (used) e.preventDefault();
  });
  function kbdAim(pull, deg) {
    if (!S.kbd) { S.kbd = true; S.creakAt = 0; S.track.setAttribute('opacity', 1); drawTrack(); hideHint(); }
    fireBtn.hidden = false;
    setAim(pull, clamp(deg, ANG_MIN, ANG_MAX));
  }
  function keyFire() {
    if (S.phase !== 'aim') return;
    S.track.setAttribute('opacity', 0);
    S.kbd = false;
    releaseShot();
  }

  /* ---------------- debug / test hook ---------------- */
  function findSolution() {
    const tgt = S.order.find(t => t.active && !t.hit);
    if (!tgt) return null;
    const W = simWorld();
    const tryShot = (pull, deg) => { const r = simulate(W, S.projKey, pull, deg); return r.events.some(e => e.type === 'hit' && e.id === tgt.id) ? r : null; };
    const degs = S.L.lock ? [45] : [];
    if (!S.L.lock) for (let d = 45; d <= 72; d += 1) { degs.push(d); if (d !== 45) degs.push(90 - d); }
    for (const deg of degs) {
      if (deg < ANG_MIN || deg > ANG_MAX) continue;
      const mp = maxPull(deg);
      for (let pull = 0.2; pull <= mp; pull += 0.005) {
        const r = tryShot(pull, deg);
        if (r) {
          // aim for the middle of the hitting window
          let p2 = pull; while (p2 + 0.005 <= mp && tryShot(p2 + 0.005, deg)) p2 += 0.005;
          const mid = (pull + p2) / 2;
          return { pull: mid, deg, res: simulate(W, S.projKey, mid, deg) };
        }
      }
    }
    return null;
  }
  window.__game = {
    go: i => run.go(i),
    get state() { return S; },
    PROJ, simulate, get K() { return K; }, freeRange, findSolution,
    patok: n => choosePatok(n),
    // Release the slingshot with a given pull (m) and angle, through the same code path as a drag.
    shoot(pull, deg) {
      if (S.phase !== 'aim') return false;
      S.creakAt = 0;
      setAim(pull, S.L.lock ? 45 : deg);
      releaseShot();
      return true;
    },
    async solve() {
      const tk = token;
      for (let guard = 0; guard < 20 && tk === token && !S.won; guard++) {
        while (tk === token && !S.won && S.phase !== 'predict' && S.phase !== 'aim') await GS.wait(80);
        if (tk !== token || S.won) break;
        const sol = findSolution();
        if (!sol) return 'no-solution';
        if (S.phase === 'predict') {
          const n = sol.res.landing ? clamp(Math.round(sol.res.landing.x), 1, 10) : 10;
          choosePatok(n);
          await GS.wait(60);
        }
        window.__game.shoot(sol.pull, sol.deg);
        await GS.wait(100);
      }
      return S.won ? 'won' : 'stopped';
    }
  };

  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
