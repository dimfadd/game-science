/* Timbangan Pasar (timbangan)
 * A brass market balance (dacing) for levels 1 to 9 and a seesaw for levels 10 to 12.
 * The beam is locked by a peg (pasak). "Lepas!" pulls the peg; the beam then swings as a
 * damped spring toward the truthful target angle (fixed 1/120 s timestep):
 *   dacing:  angle = 18 deg * clamp((R - L) / max(L, R, 1) * 1.6, -1, 1)
 *   seesaw:  full tip (14 deg, end touches the ground) whenever sum(w*d) differs.
 * Changing pan contents re-inserts the peg, so every test is a commitment. */
(function () {
  'use strict';
  const GAME = 'timbangan';
  const OL = '#3B2A20';
  const C = {
    brass: '#D9A441', brassHl: '#F0CB76', brassSh: '#AD7E2C', brassDk: '#7A5518',
    wood: '#A8673A', woodHl: '#C68857', woodSh: '#7E4A27',
    bamboo: '#E2B877', bambooHl: '#F3D9A6', bambooSh: '#B98A4B', bambooIn: '#D6A966',
    blue: '#2F80C9', blueHl: '#6FAEE3', blueSh: '#215F98', blueTint: '#DDEBF9',
    orange: '#F28C28', orangeHl: '#F8B26A', orangeSh: '#C76A12', orangeTint: '#FDE6CC',
    teal: '#0F8C7A', tealTint: '#D3F0EA', amber: '#F2A900', amberTint: '#FFF1C4',
    cream: '#FFF8EC', ink: '#2B1D14', muted: '#8A7462',
    kunyit: '#FFC83D', kunyitSh: '#E09A00', kunyitHl: '#FFE08A',
    green: '#4DAA57', greenSh: '#357F40', greenHl: '#86CC8C', grass: '#7CC26B',
    stone: '#8C8F94', stoneSh: '#63666B', stoneHl: '#B4B7BB'
  };
  const D = { PX: 640, PY: 150, ARM: 290, CHAIN: 165, MAX: 18 };
  const SS = { PX: 640, PY: 430, HALF: 430, STEP: 125, MAX: 14, N: 3 };
  SS.GROUND = Math.round(SS.PY + SS.HALF * Math.sin(SS.MAX * Math.PI / 180) + 12);
  const TRAY = { x: 640, y: 652 };
  const el = GS.el;
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');

  /* ============================== levels (defined below) ============================== */
  const TIER = (GS.tier && GS.tier()) || 'k1';
  const LEVELS = tierLevels(TIER);

  const hud = GS.hud({ gameId: GAME, title: 'Timbangan Pasar', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: buildLevel });

  const bg = el('g', { class: 'bg' }, svg);
  const world = el('g', { class: 'world' }, svg);
  const dragLayer = el('g', { class: 'drag' }, svg);
  const measure = el('g', { opacity: 0, 'pointer-events': 'none' }, svg);

  const S = { gen: 0 };
  let lv = null;

  /* ============================== small helpers ============================== */
  let uidc = 0;
  const uid = p => (p || 'u') + (++uidc);
  const rand = GS.rand, clamp = GS.clamp, lerp = GS.lerp;
  const n1 = v => Math.round(v * 10) / 10;
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  }
  function ell(cx, cy, rx, ry) { return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`; }
  /** Kampung Chunky fill: base + bottom-right shade crescent + top-left highlight, warm outline. */
  function shape3(parent, d, o) {
    const g = el('g', o.attrs || null, parent);
    const id = uid('cp');
    const cp = el('clipPath', { id }, g); el('path', { d }, cp);
    const inner = el('g', { 'clip-path': `url(#${id})` }, g);
    el('path', { d, fill: o.sh || o.base }, inner);
    const off = o.off || [-4, -4];
    el('path', { d, fill: o.base, transform: `translate(${off[0]} ${off[1]})` }, inner);
    if (o.hl && o.hlb) { const b = o.hlb; el('ellipse', { cx: b[0], cy: b[1], rx: b[2], ry: b[3], fill: o.hl, opacity: 0.9 }, inner); }
    if (o.extra) o.extra(inner);
    el('path', { d, fill: 'none', stroke: OL, 'stroke-width': o.sw || 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
    return g;
  }
  const BR = { base: C.brass, sh: C.brassSh, hl: C.brassHl };
  const WD = { base: C.wood, sh: C.woodSh, hl: C.woodHl };
  function txt(parent, x, y, s, o) {
    o = o || {};
    const t = el('text', { x, y, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'central', 'font-size': o.size || 28, fill: o.fill || C.ink, class: o.cls || null, 'font-weight': o.weight || 600, style: 'font-variant-numeric: tabular-nums' }, parent);
    t.textContent = s;
    return t;
  }
  function dotsAt(parent, n, cx, cy, o) {
    o = o || {};
    const per = o.per || 5, gap = o.gap || 13, r = o.r || 4.6, rows = Math.ceil(n / per);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / per), col = i % per, inRow = Math.min(per, n - row * per);
      el('circle', { cx: cx + (col - (inRow - 1) / 2) * gap, cy: cy + (row - (rows - 1) / 2) * gap, r, fill: o.fill || OL }, parent);
    }
  }
  function later(ms, fn) { const g = S.gen; const t = setTimeout(() => { if (g === S.gen) fn(); }, ms); S.timers.push(t); return t; }
  function wait(ms) { return new Promise(r => { const t = setTimeout(r, ms); S.timers.push(t); }); }
  function clientOf(x, y) { const m = svg.getScreenCTM(); return m ? { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f } : { x: innerWidth / 2, y: innerHeight / 2 }; }
  function ctm(g) { const a = svg.getScreenCTM(), b = g.getScreenCTM(); return a && b ? a.inverse().multiply(b) : null; }
  function toSvg(g, x, y) { const m = ctm(g); return m ? { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f } : { x, y }; }
  function fromSvg(g, x, y) { const m0 = ctm(g); if (!m0) return { x, y }; const m = m0.inverse(); return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; }
  function say(t) { GS.say(t); }
  function mood(m) { try { hud.mood(m); } catch (e) { /* no mascot */ } }

  /* ============================== art wrappers ============================== */
  const hasArt = fn => !!(GS.art && typeof GS.art[fn] === 'function');
  function artItem(name, float) {
    try { if (hasArt('item')) return GS.art.item(name, { shadow: false, float: !!float }); } catch (e) { /* fall through */ }
    return `<circle cx="0" cy="-30" r="28" fill="#E9DCC6" stroke="${OL}" stroke-width="4"/>`;
  }
  function artWeight(n) {
    try { if (hasArt('weight')) return GS.art.weight(n, { shadow: false }); } catch (e) { /* fall through */ }
    return `<path d="M-28 -6V-58A28 6 0 0 1 28 -58V-6Z" fill="${C.brass}" stroke="${OL}" stroke-width="4"/><text x="0" y="-30" text-anchor="middle" dominant-baseline="central" font-size="26" fill="${C.ink}">${n}</text>`;
  }
  function artPerson(i) {
    try { if (hasArt('person')) return GS.art.person(i, { shadow: false }); } catch (e) { /* fall through */ }
    return `<circle cx="0" cy="-76" r="18" fill="#E3AE82" stroke="${OL}" stroke-width="3"/><rect x="-14" y="-58" width="28" height="56" rx="10" fill="${C.blue}" stroke="${OL}" stroke-width="3"/>`;
  }
  function label(name) {
    try { const m = hasArt('meta') && GS.art.meta(name); if (m && m.label) return String(m.label).toLowerCase(); } catch (e) { /* ignore */ }
    return name;
  }
  function heaviness(name) {
    if (name === 'weight') return 'heavy';
    try { const m = hasArt('meta') && GS.art.meta(name); if (m && m.heavy) return m.heavy; } catch (e) { /* ignore */ }
    return 'medium';
  }
  const boxCache = {};
  function artBox(key, mk) {
    if (boxCache[key]) return boxCache[key];
    const g = el('g', null, measure);
    GS.markup(g, mk);
    let b = null;
    try { b = g.getBBox(); } catch (e) { b = null; }
    measure.removeChild(g);
    if (!b || !b.width || !b.height) b = { x: -50, y: -100, width: 100, height: 100 };
    return (boxCache[key] = { x: b.x, y: b.y, width: b.width, height: b.height });
  }

  /* ============================== items ============================== */
  function makeItem(def) {
    const it = Object.assign({ w: 1, h: 40, fixed: false }, def);
    it.def = def;
    it.id = uid('it');
    it.g = el('g', { class: 'item' + (it.fixed ? ' fixed' : '') });
    it.hop = el('g', null, it.g);
    it.inner = el('g', null, it.hop);
    let mk, key;
    if (def.custom) { mk = def.custom; key = def.customKey; }
    else if (def.kind === 'weight') { mk = artWeight(def.arg); key = 'w' + def.arg; }
    else if (def.kind === 'person') { mk = artPerson(def.arg); key = 'p' + def.arg; }
    else { mk = artItem(def.kind, def.float); key = 'i' + def.kind; }
    const b = def.box || artBox(key, mk);
    it.sc = it.h / b.height;
    it.fw = b.width * it.sc;
    it.ab = b;
    const art = el('g', { transform: `scale(${n1(it.sc * 1000) / 1000}) translate(${n1(-(b.x + b.width / 2))} ${n1(-(b.y + b.height))})` }, it.inner);
    GS.markup(art, mk);
    it.heavy = heaviness(def.kind);
    if (def.decor) def.decor(it);
    const minHit = TIER === 'tk' ? 100 : 76;
    const hw = Math.max(minHit, it.fw + 18), hh = Math.max(minHit, it.h + 20);
    it.hit = el('rect', { x: -hw / 2, y: -it.h / 2 - hh / 2, width: hw, height: hh, fill: 'transparent' }, it.g);
    it.x = 0; it.y = 0; it.sx = 1; it.sy = 1; it.lift = 1;
    GS.drag(it.g, { svg, onStart: p => dragStart(it, p), onMove: p => dragMove(it, p), onEnd: p => dragEnd(it, p) });
    S.items.push(it);
    return it;
  }
  function setPos(it) { it.g.setAttribute('transform', `translate(${n1(it.x)} ${n1(it.y)})`); }
  function setScale(it) { const s = it.lift; it.inner.setAttribute('transform', `scale(${(it.sx * s).toFixed(3)} ${(it.sy * s).toFixed(3)})`); }
  function setFixed(it, f) { it.fixed = f; it.g.setAttribute('class', 'item' + (f ? ' fixed' : '')); }
  function moveTo(it, x, y, dur, ease) {
    const tok = it.tok = (it.tok || 0) + 1;
    const x0 = it.x, y0 = it.y;
    if (!dur || (Math.abs(x - x0) < 0.5 && Math.abs(y - y0) < 0.5)) { it.x = x; it.y = y; setPos(it); return Promise.resolve(); }
    return GS.tween(dur, e => { if (it.tok !== tok) return; it.x = x0 + (x - x0) * e; it.y = y0 + (y - y0) * e; setPos(it); }, ease || 'outCubic');
  }
  function hopItem(it, amp, dur) {
    if (GS.reducedMotion) return;
    GS.tween(dur || 620, (e, t) => {
      const y = -amp * Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t);
      it.hop.setAttribute('transform', `translate(0 ${n1(y)})`);
    }, 'linear');
  }
  function wobbleItem(it) {
    GS.tween(420, (e, t) => {
      const a = Math.sin(t * Math.PI * 5) * 8 * (1 - t);
      it.hop.setAttribute('transform', `rotate(${n1(a)} 0 ${n1(-it.h / 2)})`);
    }, 'linear');
  }
  function squash(it, kind) {
    const k = kind === 'heavy' ? [1.05, 0.95, 0.98, 1.02] : kind === 'light' ? [1.1, 0.9, 0.95, 1.06] : [1.2, 0.85, 0.92, 1.08];
    return GS.tween(300, (e, t) => {
      let sx, sy;
      if (t < 0.3) { const u = t / 0.3; sx = lerp(1, k[0], u); sy = lerp(1, k[1], u); }
      else if (t < 0.65) { const u = (t - 0.3) / 0.35; sx = lerp(k[0], k[2], u); sy = lerp(k[1], k[3], u); }
      else { const u = (t - 0.65) / 0.35; sx = lerp(k[2], 1, u); sy = lerp(k[3], 1, u); }
      it.sx = sx; it.sy = sy; setScale(it);
    }, 'linear');
  }
  function dropFx(it, c) {
    squash(it, it.heavy);
    if (it.heavy === 'light') hopItem(it, 14, 700);
    if (it.heavy === 'heavy' && c && c.weighs) { GS.sfx.thud(); shake(); }
    else GS.sfx.drop();
    if (c && c.weighs) later(60, () => GS.sfx.count(Math.min(16, c.count())));
  }
  function shake() {
    if (GS.reducedMotion) return;
    world.classList.remove('gs-shake');
    void world.getBoundingClientRect();
    world.classList.add('gs-shake');
  }

  /* ============================== containers ============================== */
  function makeContainer(name, g, bins, o) {
    const c = Object.assign({ name, g, side: 0, weighs: false }, o || {});
    c.bins = bins.map(b => Object.assign({ items: [], pack: 0.95, stack: 0.62 }, b));
    c.items = () => c.bins.reduce((a, b) => a.concat(b.items), []);
    c.count = () => c.items().length;
    c.sum = () => c.items().reduce((a, it) => a + it.w, 0);
    S.conts.push(c);
    return c;
  }
  function binFits(b, it) { return !b.accept || b.accept(it); }
  function chooseBin(c, lx, it) {
    const cand = c.bins.filter(b => binFits(b, it) && (b.cap == null || b.items.length < b.cap || (b.swap && !b.items.some(x => x.fixed))));
    if (!cand.length) return null;
    let best = null, bd = 1e9;
    for (const b of cand) {
      const full = b.cap != null && b.items.length >= b.cap ? 400 : 0;
      const d = Math.abs(lx - (b.x0 + b.x1) / 2) + full;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  function addToBin(it, c, bin) { bin.items.push(it); it.c = c; it.bin = bin; c.g.appendChild(it.g); }
  function removeFromContainer(it) {
    if (it.bin) { const i = it.bin.items.indexOf(it); if (i >= 0) it.bin.items.splice(i, 1); }
    it.c = null; it.bin = null;
  }
  function reparent(it, g) {
    const p = it.g.parentNode ? toSvg(it.g.parentNode, it.x, it.y) : { x: it.x, y: it.y };
    g.appendChild(it.g);
    const q = fromSvg(g, p.x, p.y);
    it.x = q.x; it.y = q.y; setPos(it);
  }
  function layout(c, anim, fresh) {
    for (const bin of c.bins) {
      if (bin.sort) bin.items.sort((p, q) => q.w - p.w);
      const W = bin.x1 - bin.x0, cx = (bin.x0 + bin.x1) / 2;
      const rows = [[]]; let rw = 0;
      for (const it of bin.items) {
        const fw = it.fw * bin.pack;
        if (rows[rows.length - 1].length && rw + fw > W) { rows.push([]); rw = 0; }
        rows[rows.length - 1].push(it); rw += fw;
      }
      let y = bin.y;
      const order = [];
      rows.forEach((row, ri) => {
        if (!row.length) return;
        const tot = row.reduce((s, it) => s + it.fw * bin.pack, 0);
        let x = cx - tot / 2 + (ri % 2 ? 4 : 0);
        let rh = 0;
        row.forEach(it => { const fw = it.fw * bin.pack; it.tx = x + fw / 2; it.ty = y; x += fw; rh = Math.max(rh, it.h); });
        y -= rh * (bin.back ? 0.42 : bin.stack);
        order.push(row);
      });
      if (bin.back) order.reverse();
      order.forEach(row => row.forEach(it => c.g.appendChild(it.g)));
      for (const it of bin.items) {
        if (!anim) { it.tok = (it.tok || 0) + 1; it.x = it.tx; it.y = it.ty; setPos(it); }
        else moveTo(it, it.tx, it.ty, it === fresh ? 150 : 220);
      }
    }
    if (c.onLayout) c.onLayout();
  }

  /* ============================== level scaffolding ============================== */
  function cleanup() {
    S.gen++;
    (S.timers || []).forEach(t => clearTimeout(t));
    simCancel();
    world.innerHTML = '';
    dragLayer.innerHTML = '';
    world.classList.remove('gs-shake');
    Object.assign(S, {
      timers: [], items: [], conts: [], busy: false, locked: true, relocking: false, over: false,
      pred: null, tries: 0, roundFails: 0, last: null, pans: null, tray: null, notches: null, homes: null,
      strip: null, tags: null, slot: null, wp: null, peg: null, rack: null, grid: null
    });
    sim.th = 0; sim.om = 0; sim.tgt = 0;
    S.layers = {
      back: el('g', null, world), rig: el('g', null, world), tray: el('g', null, world),
      ui: el('g', null, world), fx: el('g', null, world)
    };
  }

  function buildLevel(i) {
    cleanup();
    const L = LEVELS[i];
    S.mode = L.mode;
    SS.N = L.notches || 3; SS.STEP = SS.N === 4 ? 100 : 125;
    setScene(L.mode);
    if (L.mode === 'dacing') { buildDacing(); buildTray(); } else buildSeesaw();
    drawTitle(L.title);
    putMascot();
    mood('think');
    lv = L.make();
    const defs = { rounds: 1, round: 0, predictNow: false, revealed: false, near: true, fade: false };
    for (const k in defs) if (!(k in lv)) lv[k] = defs[k];
    lv.round = 0;
    roundPips();
    lv.setup(0);
    refresh();
    render();
    dockRender();
  }

  function refresh() {
    if (lv && lv.changed) lv.changed();
    updateTags();
    renderStripNow();
    renderGrid();
  }

  function setScene(mode) {
    if (bg.getAttribute('data-mode') === mode) return;
    bg.innerHTML = '';
    bg.setAttribute('data-mode', mode);
    let mk = '';
    try { if (hasArt('scene')) mk = GS.art.scene(mode === 'dacing' ? 'pasar' : 'kampung', 1280, 800); } catch (e) { mk = ''; }
    if (!mk) mk = '<rect width="1280" height="800" fill="#9ED8EC"/><rect y="624" width="1280" height="176" fill="#E5BE86"/>';
    GS.markup(bg, mk);
    if (mode === 'seesaw') {
      const G = SS.GROUND;
      el('path', { d: `M-220 ${G - 6}Q320 ${G - 16} 640 ${G - 8}T1500 ${G - 6}V820H-220Z`, fill: C.grass }, bg);
      el('path', { d: `M-220 ${G + 40}Q320 ${G + 30} 640 ${G + 40}T1500 ${G + 38}V820H-220Z`, fill: '#71B862' }, bg);
      el('ellipse', { cx: SS.PX, cy: G + 8, rx: 470, ry: 22, fill: '#D4A062', opacity: 0.55 }, bg);
      for (let i = 0; i < 26; i++) {
        const x = 30 + i * 49 + (i % 3) * 7, y = G + 60 + (i * 37 % 150);
        el('path', { d: `M${x} ${y}l-5 -12M${x} ${y}l1 -14M${x} ${y}l6 -11`, stroke: '#5E9F4F', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none', opacity: 0.6 }, bg);
      }
    }
  }

  function drawTitle(t) {
    const g = el('g', { transform: 'translate(30 40)' }, S.layers.ui);
    const tt = el('text', { x: 0, y: 0, 'dominant-baseline': 'central', 'font-size': 30, fill: C.ink, class: 'tp-tw', stroke: '#FFF8EC', 'stroke-width': 7, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, g);
    tt.textContent = t;
  }
  function roundPips() {
    if (S.pips) S.pips.remove();
    S.pips = el('g', { transform: 'translate(44 80)' }, S.layers.ui);
    if (!lv || lv.rounds < 2) return;
    for (let i = 0; i < lv.rounds; i++) {
      const done = i < lv.round, cur = i === lv.round;
      el('circle', { cx: i * 32, cy: 0, r: cur ? 11 : 9, fill: done ? C.brass : '#FFFFFF', stroke: OL, 'stroke-width': 3, opacity: done || cur ? 1 : 0.6 }, S.pips);
      if (done) el('path', { d: `M${i * 32 - 5} 0l3.5 4 6.5 -7`, stroke: OL, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, S.pips);
    }
  }

  /* ---------- mascot in the scene ---------- */
  function putMascot() {
    const x = 108, y = S.mode === 'dacing' ? 628 : SS.GROUND + 4, size = S.mode === 'dacing' ? 176 : 150;
    S.mascot = { g: el('g', { transform: `translate(${x} ${y})` }, S.layers.ui), size };
    S.mascot.hop = el('g', null, S.mascot.g);
    mascotMood('idle');
  }
  function mascotMood(m) {
    if (!S.mascot || !hasArt('mascot')) return;
    const h = S.mascot.hop, size = S.mascot.size;
    h.innerHTML = '';
    let mk = '';
    try { mk = GS.art.mascot({ mood: m, size }); } catch (e) { return; }
    GS.markup(h, mk);
    const s = h.querySelector('svg');
    if (s) { s.setAttribute('x', -size / 2); s.setAttribute('y', -size * 0.97); s.setAttribute('width', size); s.setAttribute('height', size); }
  }
  function mascotCheer() {
    mascotMood('cheer');
    if (!S.mascot || GS.reducedMotion) return;
    const h = S.mascot.hop;
    GS.tween(700, (e, t) => { h.setAttribute('transform', `translate(0 ${n1(-38 * Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t * 0.5))})`); }, 'linear');
    later(2600, () => mascotMood('idle'));
  }

  /* ============================== the dacing (market balance) ============================== */
  function chain(parent, x1, y1, x2, y2) {
    el('line', { x1, y1, x2, y2, stroke: OL, 'stroke-width': 6.5, 'stroke-linecap': 'round' }, parent);
    el('line', { x1, y1, x2, y2, stroke: C.brass, 'stroke-width': 3.4, 'stroke-linecap': 'round', 'stroke-dasharray': '7 4.5' }, parent);
  }
  function sector(cx, cy, r0, r1, a0, a1) {
    const p = (r, a) => [n1(cx + r * Math.sin(a * Math.PI / 180)), n1(cy - r * Math.cos(a * Math.PI / 180))];
    const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
    return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
  }
  function kawung(parent, x, y, w, h, col, op) {
    const g = el('g', { opacity: op }, parent);
    for (let yy = y + 8; yy < y + h; yy += 16) for (let xx = x + 8 + ((yy / 16) % 2) * 8; xx < x + w; xx += 16) el('circle', { cx: xx, cy: yy, r: 3.2, fill: col }, g);
  }

  function buildDacing() {
    const { PX, PY } = D;
    const rig = S.layers.rig;
    // market table with a kain (fabric) drape
    el('ellipse', { cx: PX, cy: 642, rx: 340, ry: 12, fill: OL, opacity: 0.18 }, rig);
    for (const lx of [350, 930]) shape3(rig, rr(lx - 12, 516, 24, 124, 6), { base: C.wood, sh: C.woodSh, off: [-6, 0] });
    shape3(rig, rr(318, 500, 644, 22, 9), { base: C.wood, sh: C.woodSh, hl: C.woodHl, hlb: [420, 506, 80, 3], off: [0, -5] });
    const cloth = `M462 504H818L812 566Q790 576 768 566Q746 576 724 566Q702 576 680 566Q658 576 640 566Q618 576 596 566Q574 576 552 566Q530 576 508 566Q486 576 468 566Z`;
    shape3(rig, cloth, { base: C.green, sh: C.greenSh, hl: C.greenHl, hlb: [520, 514, 40, 4], off: [-5, -5], sw: 3.5, extra: g => kawung(g, 462, 504, 356, 72, '#FFF8EC', 0.18) });
    // base and column
    shape3(rig, rr(556, 468, 168, 36, 14), Object.assign({ hlb: [600, 476, 30, 4] }, BR));
    shape3(rig, rr(588, 446, 104, 26, 10), Object.assign({ hlb: [612, 452, 18, 3] }, BR));
    shape3(rig, rr(PX - 14, PY + 26, 28, 446 - PY - 24, 9), Object.assign({ off: [-5, 0], hlb: [PX - 8, 300, 3, 120] }, BR));
    for (const y of [PY + 110, PY + 210, 410]) shape3(rig, rr(PX - 22, y, 44, 13, 6), Object.assign({ off: [0, -3] }, BR));
    // dial fan (fixed) behind the needle
    shape3(rig, sector(PX, PY, 26, 110, -42, 42), Object.assign({ off: [-3, -3] }, BR));
    el('path', { d: sector(PX, PY, 34, 100, -36, 36), fill: C.cream, stroke: OL, 'stroke-width': 2.4 }, rig);
    for (let a = -18; a <= 18; a += 6) {
      const r0 = a === 0 ? 78 : 86, s = Math.sin(a * Math.PI / 180), c = Math.cos(a * Math.PI / 180);
      el('line', { x1: PX + r0 * s, y1: PY - r0 * c, x2: PX + 97 * s, y2: PY - 97 * c, stroke: a === 0 ? C.teal : OL, 'stroke-width': a === 0 ? 5 : 2.6, 'stroke-linecap': 'round' }, rig);
    }
    shape3(rig, ell(PX, PY - 118, 12, 12), Object.assign({ hlb: [PX - 4, PY - 122, 4, 3] }, BR));
    // yoke cradling the axle + peg bracket
    shape3(rig, `M${PX - 46} ${PY - 4}C${PX - 46} ${PY + 52} ${PX + 46} ${PY + 52} ${PX + 46} ${PY - 4}L${PX + 30} ${PY - 4}C${PX + 30} ${PY + 30} ${PX - 30} ${PY + 30} ${PX - 30} ${PY - 4}Z`, Object.assign({ off: [-4, -4] }, BR));
    shape3(rig, `M${PX + 30} ${PY + 30}L${PX + 52} ${PY + 16}L${PX + 52} ${PY + 30}L${PX + 36} ${PY + 42}Z`, Object.assign({ off: [-2, -2] }, BR));
    // peg (back half: the shaft sits behind the beam)
    const pegBack = el('g', null, rig);
    // pans hang from the beam ends
    const pansG = el('g', null, rig);
    S.pans = [-1, 1].map(side => buildPan(pansG, side));
    // the rotating beam
    const beam = el('g', null, rig);
    S.beamG = beam;
    const bg2 = el('g', { transform: `translate(${PX} ${PY})` }, beam);
    const A = D.ARM;
    // needle first so it emerges from behind the hub
    el('path', { d: 'M-5 -18L0 -94L5 -18Z', fill: C.ink, stroke: OL, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, bg2);
    el('circle', { cx: 0, cy: -94, r: 3.6, fill: C.orange, stroke: OL, 'stroke-width': 2 }, bg2);
    const beamPath = `M${-A - 6} -8Q${-A / 2} -10 0 -13Q${A / 2} -10 ${A + 6} -8L${A + 6} 8Q${A / 2} 10 0 13Q${-A / 2} 10 ${-A - 6} 8Z`;
    shape3(bg2, beamPath, { base: C.brass, sh: C.brassSh, hl: C.brassHl, hlb: [-120, -8, 150, 2.6], off: [0, -5] });
    el('path', { d: `M${-A + 30} 0H-48M48 0H${A - 30}`, stroke: C.brassDk, 'stroke-width': 2, opacity: 0.45, 'stroke-linecap': 'round' }, bg2);
    for (let x = 60; x < A - 20; x += 40) for (const s of [-1, 1]) el('line', { x1: s * x, y1: -4, x2: s * x, y2: 4, stroke: C.brassDk, 'stroke-width': 2, opacity: 0.4 }, bg2);
    for (const s of [-1, 1]) {
      shape3(bg2, ell(s * (A + 16), 0, 11, 11), Object.assign({ hlb: [s * (A + 16) - 4, -4, 4, 3] }, BR));
      el('path', { d: `M${s * A} 6V16`, stroke: OL, 'stroke-width': 7, 'stroke-linecap': 'round' }, bg2);
      el('path', { d: `M${s * A} 6V16`, stroke: C.brass, 'stroke-width': 3, 'stroke-linecap': 'round' }, bg2);
      el('circle', { cx: s * A, cy: 20, r: 5.5, fill: 'none', stroke: OL, 'stroke-width': 6.5 }, bg2);
      el('circle', { cx: s * A, cy: 20, r: 5.5, fill: 'none', stroke: C.brass, 'stroke-width': 3 }, bg2);
      el('circle', { cx: s * A, cy: 0, r: 4.5, fill: C.brassDk }, bg2);
    }
    shape3(bg2, ell(0, 0, 26, 26), Object.assign({ hlb: [-8, -9, 8, 6] }, BR));
    el('circle', { cx: 0, cy: 0, r: 9, fill: C.brassDk, stroke: OL, 'stroke-width': 2.6 }, bg2);
    el('circle', { cx: -2.5, cy: -2.5, r: 2.6, fill: '#FFFFFF', opacity: 0.85 }, bg2);
    S.wp = buildWaterpass(bg2, -150, -12);
    // peg in front
    const pegFront = el('g', null, rig);
    S.peg = buildPeg(pegBack, pegFront, { x: PX + 62, y: PY - 27, r: 0 }, { x: PX + 86, y: PY + 62, r: 7 }, { x: PX + 46, y: PY + 18 }, 70);
  }

  function buildWaterpass(parent, x, ytop) {
    const g = el('g', { transform: `translate(${x} ${ytop})` }, parent);
    el('path', { d: 'M-22 0V-6M22 0V-6', stroke: OL, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
    const cap = el('path', { d: rr(-34, -30, 68, 24, 12), fill: C.cream, stroke: OL, 'stroke-width': 3.5 }, g);
    const tube = el('path', { d: rr(-27, -25, 54, 14, 7), fill: '#CDEDF3', stroke: OL, 'stroke-width': 1.8 }, g);
    el('path', { d: 'M-10 -25V-11M10 -25V-11', stroke: OL, 'stroke-width': 1.6, opacity: 0.6 }, g);
    const bub = el('ellipse', { cx: 0, cy: -18, rx: 8, ry: 4.6, fill: '#FFFFFF', stroke: OL, 'stroke-width': 1.6 }, g);
    const check = el('g', { transform: 'translate(0 -48)', display: 'none' }, g);
    el('circle', { cx: 0, cy: 0, r: 14, fill: C.teal, stroke: OL, 'stroke-width': 3 }, check);
    el('path', { d: 'M-6 0l4 4.5 8 -9', stroke: '#FFFFFF', 'stroke-width': 3.6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, check);
    return { g, cap, tube, bub, check, on: false };
  }
  function waterpass(on) {
    const w = S.wp; if (!w || w.on === on) return;
    w.on = on;
    w.cap.setAttribute('fill', on ? C.teal : C.cream);
    w.tube.setAttribute('fill', on ? C.tealTint : '#CDEDF3');
    w.check.setAttribute('display', on ? 'inline' : 'none');
    if (on && !GS.reducedMotion) GS.tween(380, e => w.check.setAttribute('transform', `translate(0 -48) scale(${n1(e * 100) / 100})`), 'outBack');
  }

  function buildPan(parent, side) {
    const pan = { side, g: el('g', null, parent), ph: 0, pv: 0 };
    const CH = D.CHAIN;
    chain(pan.g, 0, 4, 0, CH - 16);
    const body = el('g', { transform: `translate(0 ${CH})` }, pan.g);
    pan.body = body;
    const rim = side < 0 ? C.blue : C.orange, rimSh = side < 0 ? C.blueSh : C.orangeSh;
    shape3(body, 'M-114 0Q-108 32 -70 37L70 37Q108 32 114 0Z', { base: C.bamboo, sh: C.bambooSh, off: [-7, -6] });
    el('ellipse', { cx: 0, cy: 0, rx: 114, ry: 21, fill: rim, stroke: OL, 'stroke-width': 4 }, body);
    const inId = uid('pin');
    const cp = el('clipPath', { id: inId }, body); el('ellipse', { cx: 0, cy: -1, rx: 102, ry: 12.5 }, cp);
    el('ellipse', { cx: 0, cy: -1, rx: 102, ry: 12.5, fill: C.bambooIn, stroke: OL, 'stroke-width': 2.4 }, body);
    const wv = el('g', { 'clip-path': `url(#${inId})`, opacity: 0.12 }, body);
    for (let x = -120; x < 120; x += 9) el('path', { d: `M${x} -16l18 32M${x + 18} -16l-18 32`, stroke: OL, 'stroke-width': 1.4 }, wv);
    pan.tapHit = el('ellipse', { cx: 0, cy: -40, rx: 132, ry: 84, fill: 'transparent', display: 'none', class: 'peg-hit' }, body);
    pan.tapHit.addEventListener('click', () => { if (lv && lv.panTap) lv.panTap(side < 0 ? 0 : 1); });
    pan.back = el('g', null, body);
    pan.content = el('g', null, body);
    pan.front = el('g', null, body);
    // front rim band (in front of the items' feet), side-coded: blue + dots / orange + stripes
    const fr = el('g', null, body);
    el('path', { d: 'M-114 0A114 21 0 0 0 114 0L102 -1A102 12.5 0 0 1 -102 -1Z', fill: rim, stroke: OL, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, fr);
    el('path', { d: 'M-108 6A110 18 0 0 0 108 6', fill: 'none', stroke: rimSh, 'stroke-width': 3, opacity: 0.6 }, fr);
    for (let a = 18; a <= 162; a += 12) {
      const x = 108 * Math.cos(a * Math.PI / 180), y = -0.5 + 16.5 * Math.sin(a * Math.PI / 180);
      if (side < 0) el('circle', { cx: n1(x), cy: n1(y), r: 2.6, fill: '#FFFFFF' }, fr);
      else el('path', { d: `M${n1(x - 3)} ${n1(y - 4.5)}L${n1(x + 3)} ${n1(y + 4.5)}`, stroke: '#FFFFFF', 'stroke-width': 2.8, 'stroke-linecap': 'round' }, fr);
    }
    pan.tag = el('g', { transform: `translate(${side * 176} -50)` }, body);
    chain(pan.g, 0, 4, -106, CH - 2);
    chain(pan.g, 0, 4, 106, CH - 2);
    el('circle', { cx: 0, cy: 4, r: 6, fill: C.brass, stroke: OL, 'stroke-width': 3 }, pan.g);
    pan.hl = el('ellipse', { cx: 0, cy: -34, rx: 128, ry: 70, fill: 'none', stroke: C.ink, 'stroke-width': 4, 'stroke-dasharray': '10 9', opacity: 0.5, display: 'none' }, body);
    pan.c = makeContainer(side < 0 ? 'L' : 'R', pan.content, [{ x0: -100, x1: 100, y: 14 }], { weighs: true, isPan: true, side, pan, hl: pan.hl });
    pan.c.zone = q => { const o = toSvg(body, 0, -40); const dx = q.x - o.x, dy = q.y - o.y; return Math.abs(dx) < 150 && dy > -170 && dy < 100 ? Math.hypot(dx, dy * 0.8) : Infinity; };
    return pan;
  }
  function hangPoint(side, th) {
    const t = th * Math.PI / 180, lx = side * D.ARM, ly = 20;
    return { x: D.PX + lx * Math.cos(t) - ly * Math.sin(t), y: D.PY + lx * Math.sin(t) + ly * Math.cos(t) };
  }

  function buildTray() {
    const g = el('g', { transform: `translate(${TRAY.x} ${TRAY.y})` }, S.layers.tray);
    el('ellipse', { cx: 0, cy: 30, rx: 316, ry: 15, fill: OL, opacity: 0.18 }, g);
    shape3(g, 'M-304 0Q-300 24 -252 30L252 30Q300 24 304 0Z', { base: C.bamboo, sh: C.bambooSh, off: [-7, -6] });
    el('ellipse', { cx: 0, cy: 0, rx: 304, ry: 44, fill: C.bamboo, stroke: OL, 'stroke-width': 4 }, g);
    const id = uid('tr');
    const cp = el('clipPath', { id }, g); el('ellipse', { cx: 0, cy: 0, rx: 288, ry: 35 }, cp);
    el('ellipse', { cx: 0, cy: 0, rx: 288, ry: 35, fill: C.bambooIn, stroke: OL, 'stroke-width': 2.4 }, g);
    const wv = el('g', { 'clip-path': `url(#${id})`, opacity: 0.1 }, g);
    for (let x = -320; x < 320; x += 11) el('path', { d: `M${x} -40l40 80M${x + 40} -40l-40 80`, stroke: OL, 'stroke-width': 1.5 }, wv);
    const content = el('g', null, g);
    const hl = el('ellipse', { cx: 0, cy: -10, rx: 312, ry: 60, fill: 'none', stroke: C.ink, 'stroke-width': 4, 'stroke-dasharray': '10 9', opacity: 0.5, display: 'none' }, g);
    S.tray = makeContainer('tray', content, [{ x0: -262, x1: 262, y: 16, back: true }], { isTray: true, hl });
    S.tray.zone = q => { const dx = q.x - TRAY.x, dy = q.y - (TRAY.y - 20); return Math.abs(dx) < 330 && Math.abs(dy) < 90 ? Math.hypot(dx, dy) * 0.6 + 40 : Infinity; };
  }

  /* ============================== the peg (pasak) ============================== */
  function buildPeg(backLayer, frontLayer, lockPose, dangPose, anchor, cordLen) {
    const peg = { lock: lockPose, dang: dangPose, anchor, len: cordLen, pose: Object.assign({}, lockPose) };
    peg.cord = el('path', { fill: 'none', stroke: '#6B4A30', 'stroke-width': 3, 'stroke-linecap': 'round' }, frontLayer);
    el('circle', { cx: anchor.x, cy: anchor.y, r: 4.5, fill: C.brassDk, stroke: OL, 'stroke-width': 2 }, frontLayer);
    const shaft = g => shape3(g, rr(-5.5, 0, 11, 60, 5), { base: C.wood, sh: C.woodSh, hl: C.woodHl, hlb: [-2, 20, 1.6, 16], off: [-3, 0], sw: 3 });
    peg.backG = el('g', null, backLayer); shaft(peg.backG);
    peg.frontG = el('g', null, frontLayer);
    peg.shaftF = el('g', { display: 'none' }, peg.frontG); shaft(peg.shaftF);
    shape3(peg.frontG, ell(0, 0, 13, 12), { base: C.orange, sh: C.orangeSh, hl: C.orangeHl, hlb: [-4, -4, 5, 3.5], off: [-3, -3], sw: 3.5 });
    el('circle', { cx: -4, cy: -4, r: 2, fill: '#FFFFFF' }, peg.frontG);
    const hit = el('circle', { cx: 0, cy: 10, r: 42, fill: 'transparent', class: 'peg-hit' }, peg.frontG);
    hit.addEventListener('click', () => release());
    pegPose(peg, lockPose);
    return peg;
  }
  function pegPose(peg, p) {
    peg.pose = p;
    const t = `translate(${n1(p.x)} ${n1(p.y)}) rotate(${n1(p.r)})`;
    peg.backG.setAttribute('transform', t);
    peg.frontG.setAttribute('transform', t);
    const a = peg.anchor, d = Math.hypot(p.x - a.x, p.y - a.y), sag = Math.max(8, (peg.len - d) * 0.8);
    peg.cord.setAttribute('d', `M${a.x} ${a.y}Q${n1((a.x + p.x) / 2 + 6)} ${n1(Math.max(a.y, p.y) + sag)} ${n1(p.x)} ${n1(p.y)}`);
  }
  async function pegPop() {
    const peg = S.peg; if (!peg) return;
    GS.sfx.pop(); later(60, () => GS.sfx.whoosh());
    peg.backG.setAttribute('display', 'none'); peg.shaftF.setAttribute('display', 'inline');
    const a = peg.lock, b = peg.dang;
    await GS.tween(440, (e, t) => {
      pegPose(peg, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) - 80 * Math.sin(Math.PI * t), r: lerp(0, 360 + b.r, e) });
    }, 'outCubic');
    GS.tween(800, (e, t) => pegPose(peg, { x: b.x, y: b.y, r: b.r + 16 * Math.sin(t * Math.PI * 3) * (1 - t) }), 'linear');
  }
  async function pegInsert() {
    const peg = S.peg; if (!peg) return;
    const a = Object.assign({}, peg.pose), b = peg.lock;
    await GS.tween(300, (e, t) => pegPose(peg, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) - 50 * Math.sin(Math.PI * t), r: lerp(a.r, 0, e) }), 'inOutCubic');
    peg.backG.setAttribute('display', 'inline'); peg.shaftF.setAttribute('display', 'none');
    GS.sfx.click(); GS.sfx.tick();
  }

  /* ============================== the seesaw ============================== */
  function buildSeesaw() {
    const { PX, PY, HALF, STEP, GROUND } = SS;
    const back = S.layers.back, rig = S.layers.rig;
    S.grid = el('g', null, back);
    // fulcrum
    el('ellipse', { cx: PX, cy: GROUND + 4, rx: 96, ry: 10, fill: OL, opacity: 0.18 }, rig);
    shape3(rig, `M${PX - 84} ${GROUND}L${PX - 24} ${PY + 12}Q${PX} ${PY - 6} ${PX + 24} ${PY + 12}L${PX + 84} ${GROUND}Z`, { base: C.stone, sh: C.stoneSh, hl: C.stoneHl, hlb: [PX - 30, PY + 60, 10, 30], off: [-8, -4] });
    el('path', { d: `M${PX - 60} ${GROUND - 30}H${PX + 60}M${PX - 40} ${GROUND - 70}H${PX + 40}`, stroke: C.stoneSh, 'stroke-width': 2.4, opacity: 0.5 }, rig);
    shape3(rig, `M${PX + 28} ${PY + 30}L${PX + 46} ${PY + 14}L${PX + 66} ${PY + 14}L${PX + 66} ${PY + 36}L${PX + 40} ${PY + 50}Z`, Object.assign({ off: [-3, -3] }, BR));
    const pegBack = el('g', null, rig);
    // plank (rotates)
    const plank = el('g', null, rig);
    S.beamG = plank;
    const pg = el('g', { transform: `translate(${PX} ${PY})` }, plank);
    if (SS.N < 4) for (const s of [-1, 1]) {
      el('path', { d: `M${s * (HALF - 24)} -12V-50`, stroke: OL, 'stroke-width': 9, 'stroke-linecap': 'round' }, pg);
      el('path', { d: `M${s * (HALF - 24)} -12V-50`, stroke: C.woodSh, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, pg);
      shape3(pg, rr(s * (HALF - 24) - 14, -60, 28, 12, 6), { base: s < 0 ? C.blue : C.orange, sh: s < 0 ? C.blueSh : C.orangeSh, off: [0, -3], sw: 3 });
    }
    shape3(pg, rr(-HALF, -12, HALF * 2, 24, 11), { base: '#C98B4E', sh: C.wood, hl: '#E0A86E', hlb: [-200, -7, 160, 2.6], off: [0, -5] });
    el('path', { d: `M${-HALF + 20} 2H-30M30 2H${HALF - 20}`, stroke: C.woodSh, 'stroke-width': 2, opacity: 0.4 }, pg);
    S.notches = [];
    for (const s of [-1, 1]) for (let d = 1; d <= SS.N; d++) {
      const x = s * d * STEP;
      el('rect', { x: x - 5, y: -17, width: 10, height: 7, rx: 2, fill: C.woodSh, stroke: OL, 'stroke-width': 2 }, pg);
      el('circle', { cx: x, cy: 1, r: 10.5, fill: s < 0 ? C.blueTint : C.orangeTint, stroke: s < 0 ? C.blue : C.orange, 'stroke-width': 2.6 }, pg);
      txt(pg, x, 1.5, String(d), { size: 15 });
      const g = el('g', { transform: `translate(${x} -12)` }, pg);
      const hl = el('ellipse', { cx: 0, cy: -60, rx: 54, ry: 76, fill: 'none', stroke: C.ink, 'stroke-width': 4, 'stroke-dasharray': '10 9', opacity: 0.5, display: 'none' }, g);
      const content = el('g', null, g);
      const c = makeContainer((s < 0 ? 'L' : 'R') + d, content, [{ x0: -40, x1: 40, y: 0, cap: 1, swap: true }], { weighs: true, isNotch: true, side: s, d, hl });
      c.zone = q => { const o = toSvg(content, 0, -50); const dx = q.x - o.x, dy = q.y - o.y; return Math.abs(dx) < 62 && dy > -140 && dy < 110 ? Math.hypot(dx, dy * 0.5) : Infinity; };
      S.notches.push(c);
    }
    el('circle', { cx: 0, cy: 0, r: 14, fill: C.brass, stroke: OL, 'stroke-width': 3 }, pg);
    el('circle', { cx: 0, cy: 0, r: 4.5, fill: C.brassDk }, pg);
    S.wp = buildWaterpass(pg, -62, -12);
    const pegFront = el('g', null, rig);
    S.peg = buildPeg(pegBack, pegFront, { x: PX + 56, y: PY - 27, r: 0 }, { x: PX + 98, y: PY + 70, r: 6 }, { x: PX + 52, y: PY + 46 }, 70);
    // home spots on the grass (right side)
    S.homes = [1112, 1210].map((x, i) => {
      const g = el('g', { transform: `translate(${x} ${GROUND + 34})` }, S.layers.tray);
      el('ellipse', { cx: 0, cy: 0, rx: 44, ry: 11, fill: '#D4A062', opacity: 0.6 }, g);
      const content = el('g', null, g);
      const hl = el('ellipse', { cx: 0, cy: -60, rx: 54, ry: 80, fill: 'none', stroke: C.ink, 'stroke-width': 4, 'stroke-dasharray': '10 9', opacity: 0.5, display: 'none' }, g);
      const c = makeContainer('home' + i, content, [{ x0: -40, x1: 40, y: 2, cap: 1 }], { isHome: true, hl });
      c.zone = q => { const dx = q.x - x, dy = q.y - (GROUND - 20); return Math.abs(dx) < 50 && Math.abs(dy) < 100 ? 200 + Math.abs(dx) : Infinity; };
      return c;
    });
  }

  /* ============================== physics ============================== */
  const sim = { th: 0, om: 0, tgt: 0, k: 120, c: 7, stop: null, rest: 0.25, raf: 0, last: 0, acc: 0, done: null, lastCreak: 0, hit: 0, t: 0 };
  function simCancel() { if (sim.raf) cancelAnimationFrame(sim.raf); sim.raf = 0; const d = sim.done; sim.done = null; if (d) d('cut'); }
  function simRun(o) {
    return new Promise(res => {
      if (sim.done) { const d = sim.done; sim.done = null; d('cut'); }
      Object.assign(sim, { k: 120, c: 7, stop: null, rest: 0.25, slam: false, slammed: false }, o);
      if (o.kick) sim.om += o.kick;
      sim.done = res; sim.t = 0;
      if (!sim.raf) { sim.last = performance.now(); sim.acc = 0; sim.raf = requestAnimationFrame(simFrame); }
    });
  }
  function simStep(h) {
    const a = -sim.k * (sim.th - sim.tgt) - sim.c * sim.om;
    const om0 = sim.om;
    sim.om += a * h; sim.th += sim.om * h;
    if (sim.stop != null && Math.abs(sim.th) > sim.stop) {
      const s = Math.sign(sim.th);
      sim.th = s * sim.stop;
      if (sim.om * s > 0) { const v = Math.abs(sim.om); sim.om = -sim.om * sim.rest; if (v > 25 && !sim.slammed) { sim.hit = v; sim.slammed = true; } }
    }
    const alpha = (sim.om - om0) / h;
    if (S.pans) for (const p of S.pans) { p.pv += (-55 * p.ph - 3.2 * p.pv - 0.012 * alpha) * h; p.ph += p.pv * h; }
    sim.t += h;
  }
  function simFrame(now) {
    sim.raf = 0;
    sim.acc += Math.min(0.05, (now - sim.last) / 1000); sim.last = now;
    const h = 1 / 120;
    while (sim.acc >= h) { simStep(h); sim.acc -= h; }
    render();
    if (sim.hit) { onImpact(sim.hit); sim.hit = 0; }
    if (Math.abs(sim.om) > 7 && now - sim.lastCreak > 240) { sim.lastCreak = now; GS.sfx.creak(); }
    const eff = sim.stop != null ? clamp(sim.tgt, -sim.stop, sim.stop) : sim.tgt;
    const atStop = sim.stop != null && Math.abs(sim.tgt) > sim.stop && Math.abs(Math.abs(sim.th) - sim.stop) < 0.05;
    const pansQuiet = !S.pans || S.pans.every(p => Math.abs(p.ph) < 0.06 && Math.abs(p.pv) < 0.6);
    const still = (Math.abs(sim.th - eff) < 0.04 && Math.abs(sim.om) < 0.5) || (atStop && Math.abs(sim.om) < 3);
    if ((still && pansQuiet) || sim.t > 9) {
      sim.th = eff; sim.om = 0;
      if (S.pans) S.pans.forEach(p => { p.ph = 0; p.pv = 0; });
      render();
      const d = sim.done; sim.done = null; if (d) d('ok');
      return;
    }
    sim.raf = requestAnimationFrame(simFrame);
  }
  function render() {
    if (!S.beamG) return;
    if (S.mode === 'dacing') {
      S.beamG.setAttribute('transform', `rotate(${sim.th.toFixed(3)} ${D.PX} ${D.PY})`);
      if (S.pans) S.pans.forEach(p => { const h = hangPoint(p.side, sim.th); p.g.setAttribute('transform', `translate(${n1(h.x)} ${n1(h.y)}) rotate(${p.ph.toFixed(2)})`); });
      if (S.wp) S.wp.bub.setAttribute('cx', n1(clamp(-sim.th / D.MAX * 17, -17, 17)));
    } else {
      S.beamG.setAttribute('transform', `rotate(${sim.th.toFixed(3)} ${SS.PX} ${SS.PY})`);
      if (S.wp) S.wp.bub.setAttribute('cx', n1(clamp(-sim.th / SS.MAX * 17, -17, 17)));
    }
  }
  function onImpact(v) {
    GS.sfx.thud(); shake();
    const s = Math.sign(sim.th);
    if (S.mode === 'dacing') {
      // overload slam: light things in the rising pan get tossed up a little
      const up = S.pans[s > 0 ? 0 : 1].c.items(), down = S.pans[s > 0 ? 1 : 0].c.items();
      up.forEach((it, i) => hopItem(it, (it.heavy === 'light' ? 34 : it.heavy === 'heavy' ? 6 : 16) * Math.min(1.4, v / 80), 560 + i * 20));
      down.forEach(it => squash(it, 'heavy'));
    } else {
      const x = SS.PX + s * SS.HALF * Math.cos(SS.MAX * Math.PI / 180);
      dust(x, SS.GROUND);
      S.notches.forEach(c => c.items().forEach(it => { if (c.side === s) squash(it, 'medium'); else hopItem(it, 22, 560); }));
    }
  }
  function dust(x, y) {
    if (GS.reducedMotion) return;
    for (let i = 0; i < 7; i++) {
      const p = el('circle', { cx: x, cy: y, r: 6, fill: '#E5BE86', opacity: 0.8 }, S.layers.fx);
      const dx = (i - 3) * 14, dy = -10 - (i % 3) * 8;
      GS.tween(560, e => { p.setAttribute('cx', n1(x + dx * e)); p.setAttribute('cy', n1(y + dy * e)); p.setAttribute('r', n1(6 + 10 * e)); p.setAttribute('opacity', n1((1 - e) * 0.8 * 100) / 100); }, 'outCubic').then(() => p.remove());
    }
  }

  /* ============================== test / lock cycle ============================== */
  function sideValue(side) {
    if (S.mode === 'dacing') return S.pans[side < 0 ? 0 : 1].c.sum();
    return S.notches.filter(c => c.side === side).reduce((a, c) => a + c.sum() * c.d, 0);
  }
  function evaluate() {
    const L = sideValue(-1), R = sideValue(1);
    const diff = R - L;
    const bal = Math.abs(diff) < 1e-9;
    const dir = bal ? 'B' : diff > 0 ? 'R' : 'L';
    const r = { L, R, diff, balanced: bal, dir, over: false, near: false };
    if (S.mode === 'dacing') {
      const ratio = diff / Math.max(L, R, 1) * 1.6;
      r.angle = D.MAX * clamp(ratio, -1, 1);
      if (bal) r.params = { tgt: 0, k: 120, c: 7, kick: 9 };
      else if (Math.abs(ratio) > 1) {
        r.over = true;
        r.params = { tgt: Math.sign(diff) * (D.MAX + Math.min(16, 6 + 10 * (Math.abs(ratio) - 1))), stop: D.MAX, k: 120, c: 7, rest: 0.22 };
      } else if (lv.near && Math.abs(diff) <= 1) { r.near = true; r.params = { tgt: r.angle, k: 42, c: 3.6 }; }
      else r.params = { tgt: r.angle, k: 120, c: 7 };
    } else {
      r.angle = bal ? 0 : Math.sign(diff) * SS.MAX;
      r.params = bal ? { tgt: 0, k: 50, c: 3.4, kick: 16 } : { tgt: Math.sign(diff) * (SS.MAX + 16), stop: SS.MAX, k: 80, c: 4, rest: 0.2 };
    }
    return r;
  }
  async function release() {
    if (!lv || !S.locked || S.busy || S.relocking || S.over) return;
    if (lv.predictNow && !S.pred) {
      dock.querySelectorAll('.tp-pred').forEach(b => { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); });
      say('Tebak dulu, ya!');
      return;
    }
    if (lv.canRelease && !lv.canRelease()) { if (lv.cantMsg) say(lv.cantMsg); GS.sfx.oops(); return; }
    if (lv.customRelease) return lv.customRelease();
    const g = S.gen;
    S.busy = true; S.locked = false; dockRender();
    await pegPop();
    if (g !== S.gen) return;
    const r = evaluate();
    S.last = r;
    mood(r.over ? 'surprise' : 'think');
    await simRun(r.params);
    if (g !== S.gen) return;
    if (r.balanced) await balanceMoment();
    else if (r.near) { const fp = clientOf(D.PX, D.PY + 120); GS.floatText('Dikit lagi!', fp.x, fp.y); }
    if (g !== S.gen) return;
    renderStripNow(); renderGrid();
    await lv.result(r);
    if (g !== S.gen) return;
    S.busy = false;
    dockRender();
  }
  async function relock() {
    if (S.locked || S.relocking) return;
    const g = S.gen;
    S.relocking = true; dockRender();
    waterpass(false);
    await simRun(lv && lv.fastRelock ? { tgt: 0, k: 110, c: 21 } : { tgt: 0, k: 26, c: 10, kick: 0 });
    if (g !== S.gen) return;
    await pegInsert();
    if (g !== S.gen) return;
    S.locked = true; S.relocking = false; S.last = null;
    renderStripNow(); renderGrid();
    dockRender();
  }
  function contentsChanged() {
    if (!S.locked) relock();
    S.last = null;
    refresh();
  }
  async function balanceMoment() {
    const g = S.gen;
    await wait(300);
    if (g !== S.gen) return;
    [523, 659, 784].forEach(f => GS.tone({ f, t: 0.7, type: 'triangle', vol: 0.11 }));
    GS.tone({ f: 1047, t: 0.6, type: 'triangle', vol: 0.09, delay: 0.12 });
    waterpass(true);
    const p = S.mode === 'dacing' ? clientOf(D.PX, D.PY - 40) : clientOf(SS.PX, SS.PY - 60);
    GS.confetti(p.x, p.y, 40);
    sparkle(S.mode === 'dacing' ? D.PX : SS.PX, S.mode === 'dacing' ? D.PY - 100 : SS.PY - 60, 120);
    mood('cheer'); mascotCheer();
  }
  function sparkle(x, y, rad) {
    if (GS.reducedMotion) return;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, s = el('path', { d: 'M0 -9L2.5 -2.5L9 0L2.5 2.5L0 9L-2.5 2.5L-9 0L-2.5 -2.5Z', fill: i % 2 ? C.kunyit : '#FFFFFF', stroke: OL, 'stroke-width': 1.5 }, S.layers.fx);
      GS.tween(650, e => { s.setAttribute('transform', `translate(${n1(x + Math.cos(a) * rad * e)} ${n1(y + Math.sin(a) * rad * 0.6 * e)}) scale(${n1((1 - e * 0.6) * 1.3 * 100) / 100})`); s.setAttribute('opacity', n1(1 - e * e)); }, 'outCubic').then(() => s.remove());
    }
  }
  function bonus() {
    GS.sfx.coin();
    const x = S.mode === 'dacing' ? D.PX : SS.PX, y = S.mode === 'dacing' ? D.PY - 100 : SS.PY - 120;
    sparkle(x, y, 90);
    const p = clientOf(x, y - 40);
    GS.floatText('Tebakan jitu!', p.x, p.y);
  }
  function unbalanced(r, msg) {
    S.tries++; S.roundFails++;
    GS.sfx.oops(); mood('oops');
    later(1800, () => mood('think'));
    let m = msg;
    if (!m) {
      const down = r.dir === 'L' ? 'kiri' : 'kanan', up = r.dir === 'L' ? 'kanan' : 'kiri';
      const thing = S.mode === 'dacing' ? 'Piring' : 'Sisi';
      m = r.near ? `Dikit lagi! ${thing} ${up} sedikit lebih ringan.` : `${thing} ${down} turun. ${thing} ${up} lebih ringan.`;
    }
    say(m);
    if (S.roundFails >= 2) refresh();
  }
  function stars() { return S.tries === 0 ? 3 : S.tries <= 2 ? 2 : 1; }
  function finish(text) {
    if (lv && lv.__mix) { if (lv.round < lv.rounds - 1) return nextRound(); text = lv.winText(); }
    S.over = true; dockRender();
    const g = S.gen;
    setTimeout(() => { if (g === S.gen) run.win(stars(), text); }, 1100);
  }
  async function nextRound() {
    const g = S.gen;
    lv.round++;
    if (lv.round >= lv.rounds) { roundPips(); return finish(lv.winText ? lv.winText() : 'Hebat!'); }
    await wait(lv.pause || 0);
    if (g !== S.gen) return;
    await sweep(it => !it.keep);
    if (g !== S.gen) return;
    if (!S.locked) await relock();
    if (g !== S.gen) return;
    S.pred = null; S.roundFails = 0; lv.revealed = false;
    roundPips();
    mood('think');
    lv.setup(lv.round);
    refresh();
    dockRender();
  }
  function sweep(filter) {
    const its = S.items.filter(it => it.c && (!filter || filter(it)));
    const touched = new Set();
    its.forEach((it, i) => {
      touched.add(it.c);
      removeFromContainer(it);
      const y0 = it.y;
      GS.tween(320, e => { it.y = y0 - 60 * e; setPos(it); it.g.style.opacity = String(1 - e); }, 'inCubic').then(() => it.g.remove());
      if (i % 3 === 0) later(i * 20, () => GS.sfx.tick());
    });
    S.items = S.items.filter(x => its.indexOf(x) < 0);
    touched.forEach(c => layout(c, true));
    if (its.length) GS.sfx.whoosh();
    return wait(its.length ? 360 : 0);
  }
  /** Spawn items straight into a container with a little drop-in animation. */
  function spawn(defs, c, o) {
    o = o || {};
    const out = defs.map(d => {
      const it = makeItem(d);
      it.home = d.home || o.home || S.tray || null;
      const bin = d.bin != null ? c.bins[d.bin] : chooseBin(c, 0, it);
      addToBin(it, c, bin || c.bins[0]);
      return it;
    });
    layout(c, false);
    out.forEach(it => setScale(it));
    if (o.anim !== false) {
      out.forEach((it, i) => {
        const ty = it.y;
        it.y = ty - (o.drop || 380); setPos(it); it.g.style.opacity = '0';
        later((o.delay || 0) + i * (o.stagger || 55), () => {
          it.g.style.opacity = '1';
          moveTo(it, it.x, ty, 380, 'outBounce').then(() => { if (i === out.length - 1 || i % 2 === 0) GS.sfx.count(Math.min(i + 1, 14)); });
        });
      });
    }
    return out;
  }

  /* ============================== dragging ============================== */
  function dragStart(it, p) {
    if (!lv || S.busy || S.over || it.dragging) return false;
    if (it.fixed || !it.c) {
      if (it.fixed) { wobbleItem(it); GS.sfx.tick(); if (lv.fixedTap) lv.fixedTap(it); }
      return false;
    }
    const from = it.c;
    it.from = from;
    removeFromContainer(it);
    layout(from, true);
    reparent(it, dragLayer);
    it.dragging = true;
    it.p0 = { x: p.x, y: p.y };
    it.fx = p.x; it.fy = p.y - 40 + it.h / 2;
    it.shadow = el('ellipse', { cx: 0, cy: 0, rx: Math.max(18, it.fw * 0.45), ry: 7, fill: OL, opacity: 0.14 }, dragLayer);
    dragLayer.appendChild(it.g);
    const sx = it.x, sy = it.y, tok = it.tok = (it.tok || 0) + 1;
    it.grabbing = true;
    GS.tween(120, e => {
      if (it.tok !== tok || !it.dragging) return;
      it.x = lerp(sx, it.fx, e); it.y = lerp(sy, it.fy, e); setPos(it); moveShadow(it);
      it.lift = 1 + 0.15 * e; setScale(it);
    }, 'outBack').then(() => { it.grabbing = false; });
    GS.sfx.pick();
    if (lv.removed) lv.removed(it, from);
    if (from.weighs) contentsChanged(); else refresh();
    dockRender();
  }
  function moveShadow(it) { if (it.shadow) { it.shadow.setAttribute('cx', n1(it.x)); it.shadow.setAttribute('cy', n1(it.y + 34)); } }
  function dragMove(it, p) {
    if (!it.dragging) return;
    it.fx = p.x; it.fy = p.y - 40 + it.h / 2;
    if (!it.grabbing) { it.x = it.fx; it.y = it.fy; setPos(it); moveShadow(it); }
    const t = findTarget(it, { x: p.x, y: p.y - 40 });
    showHover(t);
  }
  function showHover(t) {
    S.conts.forEach(c => { if (c.hl) c.hl.setAttribute('display', c === t ? 'inline' : 'none'); });
  }
  function findTarget(it, q) {
    let best = null, bd = Infinity;
    for (const c of S.conts) {
      if (!c.zone) continue;
      if (c.isHome && c !== it.home) continue;
      if (lv.accept && !lv.accept(it, c)) continue;
      if (!chooseBin(c, 0, it)) continue;
      const d = c.zone(q);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function dragEnd(it, p) {
    if (!it.dragging) return;
    it.dragging = false; it.grabbing = false;
    showHover(null);
    if (it.shadow) { it.shadow.remove(); it.shadow = null; }
    const moved = Math.hypot(p.x - it.p0.x, p.y - it.p0.y) > 12;
    let target;
    if (moved) target = findTarget(it, { x: p.x, y: p.y - 40 });
    else target = it.from && it.from.weighs ? it.home : it.from;
    if (!target) target = it.home || it.from;
    it.lift = 1; setScale(it);
    place(it, target, { fromC: it.from });
  }
  function place(it, c, o) {
    o = o || {};
    let bin = o.bin || null;
    if (!bin) {
      const p = it.g.parentNode ? toSvg(it.g.parentNode, it.x, it.y) : { x: 0, y: 0 };
      const lp = fromSvg(c.g, p.x, p.y);
      bin = chooseBin(c, lp.x, it);
    }
    if (!bin) {
      if (c !== it.home && it.home) { GS.sfx.oops(); if (lv.fullMsg) say(lv.fullMsg); return place(it, it.home, o); }
      return;
    }
    if (bin.cap != null && bin.items.length >= bin.cap) {
      const old = bin.items[bin.items.length - 1];
      removeFromContainer(old);
      if (lv.removed) lv.removed(old, c);
      place(old, old.home && old.home !== c ? old.home : S.tray, { quiet: true });
    }
    if (it.c) removeFromContainer(it);
    reparent(it, c.g);
    bin.items.push(it); it.c = c; it.bin = bin;
    layout(c, true, it);
    if (!o.quiet) later(150, () => dropFx(it, c));
    else later(150, () => squash(it, 'medium'));
    if (lv.placed) lv.placed(it, c, o.fromC);
    if (c.weighs || (o.fromC && o.fromC.weighs)) contentsChanged(); else refresh();
    dockRender();
  }
  /** Programmatic move through the same code path as a drag (used by the solver). */
  function moveItem(it, c, bin) {
    const from = it.c;
    if (from) { removeFromContainer(it); layout(from, true); if (lv.removed) lv.removed(it, from); }
    place(it, c, { bin, fromC: from });
  }

  /* ============================== dock: Lepas! + prediction ============================== */
  const PEG_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="5.5" r="3.4" fill="currentColor"/><path d="M12 9v12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 3"/></svg>';
  function predIcon(dir) {
    const a = dir === 'L' ? -16 : dir === 'R' ? 16 : 0;
    const rad = a * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
    let s = '<svg viewBox="0 0 86 66" aria-hidden="true">';
    if (S.mode === 'seesaw') {
      s += `<path d="M34 58L43 38L52 58Z" fill="${C.stone}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>`;
      s += `<g transform="rotate(${a} 43 38)"><rect x="5" y="34" width="76" height="8" rx="4" fill="#C98B4E" stroke="${OL}" stroke-width="3"/><circle cx="13" cy="25" r="7" fill="${C.blue}" stroke="${OL}" stroke-width="2.6"/><rect x="66" y="18" width="14" height="14" rx="3" fill="${C.orange}" stroke="${OL}" stroke-width="2.6"/></g>`;
      s += `<path d="M2 61H84" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>`;
    } else {
      const lx = 43 - 32 * cs, ly = 16 - 32 * sn, rx = 43 + 32 * cs, ry = 16 + 32 * sn;
      s += `<path d="M43 16V58M32 60H54" stroke="${OL}" stroke-width="4" stroke-linecap="round"/>`;
      s += `<path d="M${n1(lx)} ${n1(ly)}L${n1(rx)} ${n1(ry)}" stroke="${OL}" stroke-width="6" stroke-linecap="round"/><path d="M${n1(lx)} ${n1(ly)}L${n1(rx)} ${n1(ry)}" stroke="${C.brass}" stroke-width="2.6" stroke-linecap="round"/>`;
      [[lx, ly, C.blue, 'dot'], [rx, ry, C.orange, 'stripe']].forEach(([x, y, col, pat]) => {
        s += `<path d="M${n1(x)} ${n1(y)}L${n1(x - 11)} ${n1(y + 16)}M${n1(x)} ${n1(y)}L${n1(x + 11)} ${n1(y + 16)}" stroke="${OL}" stroke-width="1.8"/>`;
        s += `<path d="M${n1(x - 15)} ${n1(y + 16)}H${n1(x + 15)}Q${n1(x)} ${n1(y + 29)} ${n1(x - 15)} ${n1(y + 16)}Z" fill="${col}" stroke="${OL}" stroke-width="2.8" stroke-linejoin="round"/>`;
        s += pat === 'dot' ? `<circle cx="${n1(x)}" cy="${n1(y + 20)}" r="2.2" fill="#fff"/>` : `<path d="M${n1(x - 3)} ${n1(y + 18)}l4 4M${n1(x + 3)} ${n1(y + 18)}l4 4" stroke="#fff" stroke-width="2"/>`;
      });
      s += `<circle cx="43" cy="16" r="4.5" fill="${C.brass}" stroke="${OL}" stroke-width="2.4"/>`;
    }
    if (dir === 'B') s += `<circle cx="74" cy="56" r="8" fill="${C.teal}" stroke="${OL}" stroke-width="2.4"/><path d="M70 56l3 3 5 -6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    return s + '</svg>';
  }
  const PRED_LABEL = { L: 'Kiri turun', B: 'Seimbang', R: 'Kanan turun' };
  function dockRender() {
    dock.innerHTML = '';
    if (!lv || S.over || lv.noDock) return;
    const canPick = lv.predictNow && !S.pred && !S.busy && (S.locked || lv.revealed);
    if (canPick) {
      const wrap = document.createElement('div');
      wrap.className = 'tp-preds';
      ['L', 'B', 'R'].forEach(d => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'tp-pred';
        b.setAttribute('aria-label', 'Tebak: ' + PRED_LABEL[d]);
        b.innerHTML = predIcon(d);
        b.addEventListener('click', () => pickPrediction(d));
        wrap.appendChild(b);
      });
      dock.appendChild(wrap);
      return;
    }
    if (lv.revealed) return;
    if (lv.predictNow && S.pred) {
      const chip = document.createElement('div');
      chip.className = 'tp-pred chosen';
      chip.setAttribute('role', 'img');
      chip.setAttribute('aria-label', 'Tebakanmu: ' + PRED_LABEL[S.pred]);
      chip.innerHTML = predIcon(S.pred);
      dock.appendChild(chip);
    }
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gs-action';
    b.innerHTML = PEG_ICON + '<span>Lepas!</span>';
    b.disabled = !S.locked || S.busy || S.relocking;
    b.addEventListener('click', () => { GS.sfx.click(); release(); });
    dock.appendChild(b);
  }
  function pickPrediction(d) {
    if (!lv || S.pred || S.busy) return;
    GS.sfx.pop();
    S.pred = d;
    if (lv.onPredict) lv.onPredict(d);
    else say('Sekarang tekan Lepas!');
    dockRender();
  }

  /* ============================== tags, strip, grid ============================== */
  function renderTag(g, val, side) {
    g.innerHTML = '';
    if (val == null) return;
    const parts = typeof val === 'number' ? [val] : val.parts;
    const n = parts.reduce((a, b) => a + b, 0);
    const text = parts.join(' + ');
    const per = 5;
    const rowsOf = k => Math.ceil(k / per);
    const showDots = n <= 20;
    const dotRows = showDots ? parts.reduce((a, k) => a + rowsOf(k), 0) : 0;
    const w = Math.max(84, text.length * 17 + 26), h = 48 + dotRows * 14 + (parts.length - 1) * 5;
    el('path', { d: `M0 ${-h / 2}V${-h / 2 - 14}`, stroke: OL, 'stroke-width': 2.4 }, g);
    el('path', { d: rr(-w / 2, -h / 2, w, h, 14), fill: C.cream, stroke: side < 0 ? C.blue : C.orange, 'stroke-width': 4 }, g);
    txt(g, 0, -h / 2 + 22, text, { size: text.length > 5 ? 24 : 30 });
    let y = -h / 2 + 46;
    if (showDots) parts.forEach((k, i) => {
      const r = rowsOf(k);
      dotsAt(g, k, 0, y + (r - 1) * 7, { fill: i ? C.brassDk : OL, r: 4.4, gap: 13.5 });
      y += r * 14 + 5;
    });
    return n;
  }
  function updateTags() {
    if (S.mode !== 'dacing' || !S.pans) return;
    S.pans.forEach((p, i) => {
      let v = lv && lv.tag ? lv.tag(i) : null;
      if (v == null && lv && lv.fade && S.roundFails >= 2) v = p.c.sum();
      renderTag(p.tag, v, p.side);
    });
  }

  /** Number sentence strip: chips mirror left | sign | right. */
  function renderStripNow() {
    if (!lv || !lv.strip) { if (S.strip) S.strip.g.innerHTML = ''; return; }
    if (!S.strip) {
      const y = S.mode === 'dacing' ? 742 : 66;
      S.strip = { g: el('g', { transform: `translate(${S.mode === 'dacing' ? 700 : 640} ${y})` }, S.layers.ui), prev: [] };
    }
    const tokens = lv.strip();
    const st = S.strip;
    st.g.innerHTML = '';
    if (!tokens) return;
    const signVal = S.last ? (S.last.dir === 'B' ? '=' : S.last.dir === 'L' ? '>' : '<') : '?';
    const show = v => v == null ? '?' : typeof v === 'number' ? fmt(v) : String(v);
    const W = t => t.t === 'op' ? 34 : t.t === 'sign' ? 66 : t.t === 'txt' ? t.v.length * 15 + 30 : Math.max(58, show(t.v).length * (show(t.v).length > 4 ? 20 : 24) + 30);
    const gap = 8;
    const tot = tokens.reduce((a, t) => a + W(t), 0) + gap * (tokens.length - 1);
    el('path', { d: rr(-tot / 2 - 18, -42, tot + 36, 84, 26), fill: OL, opacity: 0.2, transform: 'translate(0 6)' }, st.g);
    el('path', { d: rr(-tot / 2 - 18, -42, tot + 36, 84, 26), fill: C.cream, stroke: OL, 'stroke-width': 4 }, st.g);
    let x = -tot / 2;
    const ext = { '-1': [Infinity, -Infinity], '1': [Infinity, -Infinity] };
    tokens.forEach((t, i) => {
      const w = W(t), cx = x + w / 2;
      const g = el('g', null, st.g);
      const side = t.side || 0;
      if (side) { ext[side][0] = Math.min(ext[side][0], x); ext[side][1] = Math.max(ext[side][1], x + w); }
      const key = t.t + ':' + (t.t === 'sign' ? (t.v || signVal) : t.v);
      if (t.t === 'op') txt(g, cx, 1, t.v, { size: 36 });
      else if (t.t === 'txt') txt(g, cx, 1, t.v, { size: 26, cls: 'tp-body' });
      else if (t.t === 'sign') {
        const v = t.v || signVal;
        let fill = C.cream, stroke = OL;
        if (!t.v) {
          if (v === '?') fill = '#FFFFFF';
          else if (v === '=') { fill = C.tealTint; stroke = C.teal; }
          else { fill = C.amberTint; stroke = C.amber; }
        }
        if (v === '?') {
          el('circle', { cx, cy: 0, r: 27, fill: C.amberTint, stroke: C.brassSh, 'stroke-width': 3.5 }, g);
          [-1, 1].forEach(k => el('path', { d: `M${cx - 13} ${k * 5}H${cx + 13}`, stroke: C.brassSh, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.35 }, g));
          txt(g, cx, 1, '?', { size: 30, fill: C.brassDk });
        } else {
          el('path', { d: rr(x, -32, w, 64, 18), fill, stroke, 'stroke-width': 3.5 }, g);
          txt(g, cx, 1, v, { size: 42, fill: C.ink });
        }
      } else {
        const empty = t.v == null;
        const tint = side < 0 ? C.blueTint : side > 0 ? C.orangeTint : '#FFFFFF';
        const sc = side < 0 ? C.blue : side > 0 ? C.orange : OL;
        el('path', { d: rr(x, -29, w, 58, 16), fill: empty ? '#FFFFFF' : tint, stroke: empty ? C.muted : sc, 'stroke-width': 3.5, 'stroke-dasharray': empty ? '7 6' : null }, g);
        txt(g, cx, 1, show(t.v), { size: show(t.v).length > 4 ? 30 : 36, fill: empty ? C.muted : C.ink });
      }
      if (st.prev[i] && st.prev[i] !== key && !GS.reducedMotion) {
        GS.tween(300, e => g.setAttribute('transform', `translate(${n1(cx)} 0) scale(${n1((1.25 - 0.25 * e) * 100) / 100}) translate(${n1(-cx)} 0)`), 'outBack');
      }
      st.prev[i] = key;
      x += w + gap;
    });
    // side cue under the chips: dots for left, stripes for right
    if (ext['-1'][0] < Infinity) for (let xx = ext['-1'][0] + 6; xx < ext['-1'][1] - 2; xx += 12) el('circle', { cx: xx, cy: 36, r: 2.6, fill: C.blue }, st.g);
    if (ext['1'][0] < Infinity) for (let xx = ext['1'][0] + 4; xx < ext['1'][1] - 4; xx += 10) el('path', { d: `M${xx} 32l6 7`, stroke: C.orange, 'stroke-width': 3, 'stroke-linecap': 'round' }, st.g);
  }

  /** Seesaw "tenaga putar" grid: each rider adds weight rows x distance columns of dots. */
  function renderGrid() {
    if (S.mode !== 'seesaw' || !S.grid) return;
    const g = S.grid; g.innerHTML = '';
    const { PX, STEP, N } = SS, y0 = 584;
    const bal = S.last && S.last.balanced;
    [-1, 1].forEach(side => {
      const objs = S.notches.filter(c => c.side === side && c.count()).map(c => ({ w: c.sum(), d: c.d })).sort((a, b) => a.d - b.d);
      const rows = objs.reduce((a, o) => a + o.w, 0);
      const rowH = Math.min(26, 150 / Math.max(rows, 1)), dr = Math.min(9, rowH * 0.36);
      const x0 = side < 0 ? PX - N * STEP - 40 : PX + 28, x1 = side < 0 ? PX - 28 : PX + N * STEP + 40;
      const h = 40 + Math.max(1, rows) * rowH;
      el('path', { d: rr(x0, y0 - 18, x1 - x0, h, 16), fill: C.cream, stroke: OL, 'stroke-width': 3, opacity: 0.94 }, g);
      for (let d = 1; d <= N; d++) txt(g, PX + side * d * STEP, y0, String(d), { size: 17, fill: C.muted });
      let r = 0;
      objs.forEach(o => {
        const top = y0 + 22 + r * rowH;
        for (let k = 0; k < o.w; k++) {
          const yy = top + k * rowH;
          const xa = PX + side * STEP, xb = PX + side * o.d * STEP;
          el('path', { d: rr(Math.min(xa, xb) - 15, yy - dr - 1, Math.abs(xb - xa) + 30, 2 * dr + 2, dr + 1), fill: side < 0 ? C.blueTint : C.orangeTint }, g);
          for (let d = 1; d <= o.d; d++) {
            const x = PX + side * d * STEP;
            if (side < 0) el('circle', { cx: x, cy: yy, r: dr, fill: C.blue, stroke: OL, 'stroke-width': 2 }, g);
            else el('rect', { x: x - dr, y: yy - dr, width: 2 * dr, height: 2 * dr, rx: 4, fill: C.orange, stroke: OL, 'stroke-width': 2 }, g);
          }
        }
        txt(g, PX + side * 64, top + (o.w - 1) * rowH / 2, `${o.w}×${o.d}`, { size: rowH < 18 ? 16 : 19, fill: C.ink });
        r += o.w;
      });
      const tot = objs.reduce((a, o) => a + o.w * o.d, 0);
      const tx = PX + side * (N * STEP + 84), ty = y0 + 22;
      el('circle', { cx: tx, cy: ty, r: 30, fill: bal ? C.tealTint : side < 0 ? C.blueTint : C.orangeTint, stroke: bal ? C.teal : side < 0 ? C.blue : C.orange, 'stroke-width': 4 }, g);
      txt(g, tx, ty + 1, String(tot), { size: 32 });
    });
  }

  /* ============================== item factories ============================== */
  const fmt = v => typeof v === 'number' ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(v);
  const ramb = (o) => Object.assign({ kind: 'rambutan', w: 1, h: 42 }, o || {});
  const marb = (o) => Object.assign({ kind: 'kelereng', w: 1, h: 27 }, o || {});
  /** Brass weight with a printed label, for values the shared art cannot show (100, 500 g, 1 kg ...). */
  function customWeightArt(text) {
    const hw = Math.max(26, 12 + text.length * 7), T = -62, B = -9;
    const body = `M${-hw} ${B}L${-hw} ${T}A${hw} 6 0 0 1 ${hw} ${T}L${hw} ${B}A${hw} 6 0 0 1 ${-hw} ${B}Z`;
    const fs = text.length > 4 ? 21 : 25;
    const mk = `<rect x="${-hw - 4}" y="-12" width="${2 * hw + 8}" height="11" rx="5" fill="${C.brassSh}" stroke="${OL}" stroke-width="3.4"/>` +
      `<path d="${body}" fill="${C.brass}" stroke="${OL}" stroke-width="3.6" stroke-linejoin="round"/>` +
      `<path d="M${hw - 7} ${T + 7}V${B - 3}" stroke="${C.brassSh}" stroke-width="6" stroke-linecap="round" opacity=".6"/>` +
      `<path d="M${-hw + 7} ${T + 9}V${B - 9}" stroke="${C.brassHl}" stroke-width="4" stroke-linecap="round"/>` +
      `<ellipse cx="0" cy="${T}" rx="${hw}" ry="6" fill="#EBC572" stroke="${OL}" stroke-width="3"/>` +
      `<rect x="-5" y="${T - 11}" width="10" height="10" rx="2" fill="${C.brass}" stroke="${OL}" stroke-width="2.6"/>` +
      `<ellipse cx="0" cy="${T - 14}" rx="8.5" ry="7" fill="${C.brass}" stroke="${OL}" stroke-width="2.8"/>` +
      `<text x="0" y="${(T + B) / 2 + 3}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="600" fill="${C.ink}" style="font-family: Fredoka, 'Baloo 2', sans-serif">${text}</text>`;
    return { mk, box: { x: -hw - 4, y: T - 21, width: 2 * hw + 8, height: -(T - 21) } };
  }
  const wt = (n, o) => {
    o = o || {};
    const base = { kind: 'weight', arg: n, w: n, h: 60 };
    if (n > 99 || o.label) { const cw = customWeightArt(o.label || fmt(n)); Object.assign(base, { custom: cw.mk, customKey: 'cw' + (o.label || n), box: cw.box }); }
    return Object.assign(base, o);
  };
  function karung(n, o) {
    return Object.assign({
      kind: 'karung', w: n, h: 104, fixed: true, labelN: n, labelDots: n <= 10,
      decor: it => { it.labelG = el('g', null, it.inner); drawKarungLabel(it); }
    }, o || {});
  }
  function drawKarungLabel(it) {
    const g = it.labelG; g.innerHTML = '';
    const sc = it.sc, cy = (-36 - (it.ab.y + it.ab.height)) * sc; // art label patch centre (y -36 in art units)
    const n = it.labelN, s = fmt(n);
    const dots = it.labelDots && typeof n === 'number' && n <= 10;
    if (dots) {
      el('path', { d: rr(-32, cy - 24, 64, 58, 10), fill: C.cream, stroke: OL, 'stroke-width': 3 }, g);
      txt(g, 0, cy - 7, s, { size: 26 });
      dotsAt(g, n, 0, cy + 18, { r: 3.4, gap: 10, fill: OL });
    } else {
      const w = Math.max(52, s.length * 15 + 16);
      el('path', { d: rr(-w / 2, cy - 20, w, 40, 10), fill: C.cream, stroke: OL, 'stroke-width': 3 }, g);
      txt(g, 0, cy + 1, s, { size: s.length > 5 ? 22 : 28 });
    }
  }
  /** Sealed cloth bag (kantong) holding g units; its own label is drawn over the art's. */
  function kantong(g, o) {
    return Object.assign({
      kind: 'kantong', w: g, h: 58, fixed: true,
      decor: it => {
        const cy = (-20 - (it.ab.y + it.ab.height)) * it.sc, r = 12 * it.sc + 3;
        const lg = el('g', null, it.inner);
        el('circle', { cx: 0, cy, r, fill: C.cream, stroke: OL, 'stroke-width': 2.6 }, lg);
        txt(lg, 0, cy + 1, fmt(g), { size: String(g).length > 1 ? 17 : 21 });
      }
    }, o || {});
  }
  function signCard(glyph) {
    const mk = `<path d="${rr(-34, -74, 68, 72, 14)}" fill="${OL}" opacity=".2" transform="translate(0 4)"/>` +
      `<path d="${rr(-34, -74, 68, 72, 14)}" fill="#FFF8EC" stroke="${OL}" stroke-width="4"/>` +
      `<path d="${rr(-28, -68, 56, 10, 5)}" fill="${C.brassHl}" opacity=".7"/>` +
      `<text x="0" y="-37" text-anchor="middle" dominant-baseline="central" font-size="56" font-weight="600" fill="${C.ink}" style="font-family: Fredoka, 'Baloo 2', sans-serif">${glyph === '<' ? '&lt;' : glyph === '>' ? '&gt;' : '='}</text>`;
    return { kind: 'sign', glyph, w: 0, h: 76, custom: mk, customKey: 'sign' + glyph, box: { x: -36, y: -76, width: 72, height: 76 }, keep: true };
  }
  function person(i, w, h, o) {
    return Object.assign({
      kind: 'person', arg: i, w, h,
      decor: it => {
        const g = el('g', { transform: `translate(0 ${-h - 30})` }, it.inner);
        const bw = 46, bh = w > 1 ? 50 : 44;
        el('path', { d: 'M0 20V30', stroke: OL, 'stroke-width': 2.4 }, g);
        el('path', { d: rr(-bw / 2, -bh / 2 - 4, bw, bh, 12), fill: C.cream, stroke: OL, 'stroke-width': 3.2 }, g);
        txt(g, 0, -10, String(w), { size: 24 });
        dotsAt(g, w, 0, 10, { r: 3.6, gap: 10 });
      }
    }, o || {});
  }
  /** Tens and ones (or any denominations) as tray stock. */
  function stockOf(denoms, counts, o) {
    const out = [];
    denoms.forEach((d, i) => { for (let k = 0; k < counts[i]; k++) out.push(wt(d, Object.assign({}, o || {}, o && o.unit ? { label: fmt(d) + o.unit } : {}))); });
    return out;
  }
  /** Greedy move of weights from the tray into a container to make `need` (used by solvers). */
  function greedyFill(c, need, bin) {
    const ds = [...new Set(S.tray.items().map(it => it.w))].sort((a, b) => b - a);
    for (const d of ds) while (need >= d) { const it = S.tray.items().find(x => x.w === d); if (!it) break; moveItem(it, c, bin); need -= d; }
    return need;
  }

  /* ============================== dacing level helpers ============================== */
  const pan = i => S.pans[i].c;
  const dirWord = d => d === 'L' ? 'kiri' : 'kanan';
  function setPanBins(i, bins) {
    const c = pan(i);
    c.bins = bins.map(b => Object.assign({ items: [], pack: 0.95, stack: 0.62 }, b));
  }
  function clearPanDecor(i) { const p = S.pans[i]; p.back.innerHTML = ''; p.front.innerHTML = ''; p.baskets = null; }
  function basketDecor(i, centers, w, kind) {
    const p = S.pans[i], hw = (w || 94) / 2;
    p.baskets = centers.map(cx => {
      const bk = el('g', { transform: `translate(${cx} 12)` }, p.back);
      el('ellipse', { cx: 0, cy: -34, rx: hw - 1, ry: 10, fill: kind === 'box' ? '#6E4426' : '#8A5E2E', stroke: OL, 'stroke-width': 3 }, bk);
      const fr = el('g', { transform: `translate(${cx} 12)` }, p.front);
      if (kind === 'box') {
        shape3(fr, rr(-hw, -34, 2 * hw, 37, 6), { base: C.wood, sh: C.woodSh, hl: C.woodHl, hlb: [-hw + 12, -28, 8, 3], off: [-5, -4], sw: 3.5 });
        el('path', { d: `M${-hw + 4} -16H${hw - 4}`, stroke: C.woodSh, 'stroke-width': 2, opacity: 0.6 }, fr);
      } else {
        shape3(fr, `M${-hw} -34L${hw} -34L${hw - 7} -3Q${hw - 9} 3 ${hw - 15} 3L${-hw + 15} 3Q${-hw + 9} 3 ${-hw + 7} -3Z`, { base: C.bamboo, sh: C.bambooSh, hl: C.bambooHl, hlb: [-hw + 16, -28, 10, 3], off: [-5, -4], sw: 3.5,
          extra: g => { for (let y = -28; y < 2; y += 7) el('path', { d: `M${-hw} ${y}H${hw}`, stroke: '#9A6E36', 'stroke-width': 1.4, opacity: 0.6 }, g); } });
        el('path', { d: rr(-hw - 2, -39, 2 * hw + 4, 10, 5), fill: C.bambooSh, stroke: OL, 'stroke-width': 3 }, fr);
      }
      return { lab: el('g', null, fr) };
    });
  }
  function basketLabel(b, text, accent) {
    const g = b.lab; g.innerHTML = '';
    const s = String(text), w = Math.max(30, s.length * 12 + 14);
    el('path', { d: rr(-w / 2, -27, w, 26, 7), fill: accent ? C.blueTint : C.cream, stroke: accent ? C.blue : OL, 'stroke-width': 2.6 }, g);
    txt(g, 0, -13.5, s, { size: 20 });
  }
  function sackDecor(i) {
    const p = S.pans[i];
    const col = i === 0 ? [C.blueTint, '#B9D3EE'] : [C.orangeTint, '#F3CFA6'];
    el('path', { d: 'M-80 -6Q-86 -60 -70 -66Q0 -76 70 -66Q86 -60 80 -6Z', fill: col[1], stroke: OL, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, p.back);
    el('ellipse', { cx: 0, cy: -64, rx: 70, ry: 9, fill: '#8C6C4C', stroke: OL, 'stroke-width': 3 }, p.back);
    shape3(p.front, 'M-82 -20Q0 -10 82 -20L80 4Q0 18 -80 4Z', { base: col[0], sh: col[1], off: [-4, -5], sw: 3.5, extra: g => kawung(g, -84, -22, 168, 40, i === 0 ? C.blue : C.orange, 0.25) });
  }
  function slotOutline(i, cx, w) {
    const p = S.pans[i];
    el('ellipse', { cx, cy: 2, rx: w / 2, ry: 8, fill: '#FFFFFF', opacity: 0.35, stroke: OL, 'stroke-width': 2.6, 'stroke-dasharray': '6 5' }, p.back);
  }
  const outcomeWord = (a, b) => a > b ? 'lebih dari' : a < b ? 'kurang dari' : 'sama dengan';
  /** Feedback for "build on one side" levels: which way to adjust, from the tilt. */
  function buildMsg(r, buildSide) {
    const down = r.dir === 'L' ? -1 : 1;
    return down === buildSide ? 'Kebanyakan. Ambil satu, ya.' : 'Masih kurang berat. Tambah lagi.';
  }
  const rambH = n => n > 12 ? 30 : n > 9 ? 34 : 42;

  /* ============================== LEVEL: Mana lebih berat? ============================== */
  function L1(cfg) {
    const pairs = (cfg && cfg.pairs) || [['kapas', 0.05, 'batu', 1.2], ['balon', 0.01, 'gembok', 0.4], ['bantal', 0.3, 'baut', 0.15]];
    const size = { kapas: 104, batu: 46, balon: 132, gembok: 52, bantal: 80, baut: 50 };
    let cur = null;
    const o = { rounds: pairs.length, predictNow: true, near: false, pause: 2400 };
    o.setup = r => {
      const [a, wa, b, wb] = pairs[r];
      const big = { kind: a, w: wa, h: size[a], fixed: true, float: true }, small = { kind: b, w: wb, h: size[b], fixed: true };
      const flip = Math.random() < 0.5;
      cur = flip ? [small, big] : [big, small];
      spawn([cur[0]], pan(0)); spawn([cur[1]], pan(1), { delay: 120 });
      S.pred = null; o.predictNow = true;
      say(r === 0 ? 'Mana yang lebih berat? Tebak dulu!' : `Sekarang ${label(a)} dan ${label(b)}. Tebak dulu!`);
    };
    o.fixedTap = it => say(`Ini ${label(it.kind)}.`);
    o.result = async r => {
      const ok = S.pred === r.dir;
      const heavy = r.dir === 'L' ? cur[0] : cur[1], light = r.dir === 'L' ? cur[1] : cur[0];
      if (ok) bonus();
      mood(ok ? 'happy' : 'surprise');
      const small = heavy.h < light.h;
      const nm = label(heavy.kind);
      say(ok ? `Tebakanmu benar! ${nm.charAt(0).toUpperCase() + nm.slice(1)} lebih berat` + (small ? ', padahal kecil.' : '.') : `Ternyata ${nm} lebih berat` + (small ? ', padahal kecil.' : '.'));
      await nextRound();
    };
    o.winText = () => 'Kecil belum tentu ringan!';
    o.solve = async () => { const r = evaluate(); pickPrediction(r.dir); await release(); };
    return o;
  }

  /* ============================== LEVEL: Sama banyak ============================== */
  function L2(cfg) {
    cfg = Object.assign({ a: [4, 6], b: [1, 3], tray: 5, cap: 10, h: 42 }, cfg || {});
    const o = { rounds: 1 };
    o.setup = () => {
      const a = rand(cfg.a[0], cfg.a[1]), b = rand(cfg.b[0], cfg.b[1]);
      setPanBins(0, [{ x0: -100, x1: 100, y: 14, cap: cfg.cap }]);
      setPanBins(1, [{ x0: -100, x1: 100, y: 14, cap: cfg.cap }]);
      spawn(Array.from({ length: a }, () => ramb({ h: cfg.h })), pan(0));
      spawn(Array.from({ length: b }, () => ramb({ h: cfg.h })), pan(1), { delay: 200 });
      spawn(Array.from({ length: cfg.tray }, () => ramb({ h: cfg.h })), S.tray, { delay: 400 });
      say(TIER === 'tk' ? 'Buat sama banyak, ya!' : 'Buat timbangan seimbang, ya!');
    };
    o.fullMsg = 'Piringnya sudah penuh.';
    o.result = async r => { if (r.balanced) { say('Seimbang! Sama banyak.'); finish('Seimbang! Sama banyak.'); } else unbalanced(r); };
    o.solve = async () => {
      const Lc = pan(0).count(), Rc = pan(1).count();
      if (Rc < Lc) { const need = Lc - Rc, have = S.tray.count(); S.tray.items().slice(0, Math.min(need, have)).forEach(it => moveItem(it, pan(1))); if (need > have) pan(0).items().slice(0, need - have).forEach(it => moveItem(it, S.tray)); }
      else if (Rc > Lc) pan(1).items().slice(0, Rc - Lc).forEach(it => moveItem(it, S.tray));
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL: Tanda < = > ============================== */
  function L3(cfg) {
    cfg = Object.assign({ lo: 5, hi: 10 }, cfg || {});
    const MAP = { '>': 'L', '=': 'B', '<': 'R' };
    const kinds = GS.shuffle(['gt', 'lt', 'eq']);
    let a, b, cards = [];
    const o = { rounds: 3, predictNow: true, near: false, pause: 2000 };
    const g = el('g', { transform: `translate(${D.PX} 384)` }, S.layers.rig);
    shape3(g, rr(-50, -98, 100, 104, 20), { base: C.brass, sh: C.brassSh, hl: C.brassHl, hlb: [-30, -90, 16, 4], off: [-4, -4] });
    el('path', { d: rr(-41, -89, 82, 86, 14), fill: C.cream, stroke: OL, 'stroke-width': 2.6, 'stroke-dasharray': '7 6' }, g);
    const content = el('g', null, g);
    const hl = el('path', { d: rr(-60, -108, 120, 124, 24), fill: 'none', stroke: C.ink, 'stroke-width': 4, 'stroke-dasharray': '10 9', opacity: 0.5, display: 'none' }, g);
    const slot = makeContainer('slot', content, [{ x0: -36, x1: 36, y: -4, cap: 1, swap: true }], { hl, isSlot: true });
    slot.zone = q => { const dx = q.x - D.PX, dy = q.y - 340; return Math.abs(dx) < 90 && Math.abs(dy) < 100 ? Math.hypot(dx, dy) * 0.5 : Infinity; };
    o.tag = i => i === 0 ? a : b;
    o.accept = (it, c) => it.kind === 'sign' ? (c === slot || c === S.tray) : !c.isSlot;
    o.setup = r => {
      const k = kinds[r];
      if (k === 'eq') { a = b = rand(cfg.lo, cfg.hi); }
      else { const hi = rand(cfg.lo + 1, cfg.hi), lo = rand(cfg.lo, hi - 1); a = k === 'gt' ? hi : lo; b = k === 'gt' ? lo : hi; }
      const h = rambH(Math.max(a, b));
      setPanBins(0, [{ x0: -100, x1: 100, y: 14 }]); setPanBins(1, [{ x0: -100, x1: 100, y: 14 }]);
      spawn(Array.from({ length: a }, () => ramb({ fixed: true, h })), pan(0), { stagger: 35 });
      spawn(Array.from({ length: b }, () => ramb({ fixed: true, h })), pan(1), { delay: 200, stagger: 35 });
      if (!cards.length) cards = spawn(['<', '=', '>'].map(signCard), S.tray, { delay: 400 });
      else cards.forEach(cd => { if (cd.c !== S.tray) moveItem(cd, S.tray); });
      o.predictNow = true; S.pred = null;
      say(r === 0 ? 'Taruh tanda yang cocok, lalu Lepas!' : 'Tanda mana yang cocok?');
    };
    o.fixedTap = it => say(it.c === pan(0) ? `Kiri ada ${a}.` : `Kanan ada ${b}.`);
    o.onPredict = d => {
      const glyph = Object.keys(MAP).find(k => MAP[k] === d);
      const cd = cards.find(x => x.glyph === glyph);
      S.pred = null;
      moveItem(cd, slot);
    };
    o.placed = (it, c) => {
      if (c !== slot) return;
      S.pred = MAP[it.glyph];
      if (o.revealed && S.last) check(S.last);
      else say('Sekarang tekan Lepas!');
    };
    o.removed = (it, c) => { if (c === slot) S.pred = null; };
    o.canRelease = () => slot.count() > 0;
    o.cantMsg = 'Taruh satu tanda dulu, ya.';
    async function check(r) {
      const card = slot.items()[0];
      if (!card) return;
      if (MAP[card.glyph] === r.dir) {
        if (!o.revealed) bonus();
        mood('happy');
        say(`${a} ${outcomeWord(a, b)} ${b}. Tandanya cocok!`);
        S.busy = true; dockRender();
        await nextRound();
        S.busy = false; dockRender();
      } else {
        S.tries++; S.roundFails++;
        GS.sfx.oops(); mood('oops');
        wobbleItem(card);
        await wait(420);
        moveItem(card, S.tray);
        hopItem(card, 30, 500);
        S.pred = null; o.revealed = true;
        say(`Tandanya terguncang lepas. Lihat, ${r.dir === 'B' ? 'timbangannya datar' : 'piring ' + dirWord(r.dir) + ' turun'}.`);
        dockRender();
      }
    }
    o.result = async r => { await check(r); };
    o.winText = () => 'Hebat! Kamu paham tanda < = >';
    o.solve = async () => {
      const r = evaluate();
      const wasRevealed = o.revealed;
      if (!slot.count() || MAP[slot.items()[0].glyph] !== r.dir) { S.pred = null; pickPrediction(r.dir); }
      if (wasRevealed) return;
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL: Pasangan bilangan ============================== */
  function L4(cfg) {
    const ns = (cfg && cfg.ns) || [6, 10];
    const o = { rounds: ns.length, near: true };
    let n = ns[0], found = [], kar = null, given = 0;
    const rack = el('g', { transform: 'translate(1072 128)' }, S.layers.ui);
    const rw = ns.length > 1 ? 192 : 112;
    shape3(rack, rr(0, 0, rw, 300, 18), { base: C.wood, sh: C.woodSh, hl: C.woodHl, hlb: [30, 10, 30, 4], off: [-5, -5] });
    el('path', { d: rr(10, 10, rw - 20, 280, 12), fill: '#F6E9D2', stroke: OL, 'stroke-width': 2.4 }, rack);
    const cols = ns.map((k, ci) => {
      const cx = 56 + ci * 88;
      el('path', { d: rr(cx - 34, 20, 68, 36, 10), fill: '#E8D3A6', stroke: OL, 'stroke-width': 2.6 }, rack);
      txt(rack, cx, 39, String(k), { size: 26 });
      return [0, 1, 2].map(j => {
        const y = 92 + j * 66;
        el('path', { d: rr(cx - 38, y - 24, 76, 48, 12), fill: 'none', stroke: C.muted, 'stroke-width': 2.4, 'stroke-dasharray': '6 5' }, rack);
        return { x: cx, y, g: el('g', null, rack) };
      });
    });
    o.setup = r => {
      n = ns[r]; found = [];
      setPanBins(0, [{ x0: -100, x1: 100, y: 14 }]);
      if (r === 0) {
        setPanBins(1, [{ x0: -100, x1: -10, y: -6, cap: 10, stack: 0.5, pack: 0.78 }, { x0: 10, x1: 100, y: -6, cap: 10, stack: 0.5, pack: 0.78 }]);
        clearPanDecor(1);
        basketDecor(1, [-55, 55]);
      }
      kar = spawn([karung(n)], pan(0))[0];
      spawn(Array.from({ length: n - given }, () => ramb({ keep: true, h: 38 })), S.tray, { delay: 250 });
      given = n;
      say(r === 0 ? 'Isi dua keranjang sampai seimbang.' : `Karungnya sekarang ${n}. Cari 3 pasangan!`);
    };
    o.changed = () => {
      const bs = S.pans[1].baskets; if (!bs) return;
      pan(1).bins.forEach((b, i) => basketLabel(bs[i], b.items.length));
    };
    o.accept = (it, c) => !(c.isPan && c.side < 0);
    o.fixedTap = () => say(`Karung ini isinya ${n}.`);
    o.result = async r => {
      if (!r.balanced) {
        unbalanced(r, r.dir === 'L' ? 'Keranjang masih kurang berat.' : 'Keranjang terlalu berat.');
        return;
      }
      const [x, y] = pan(1).bins.map(b => b.items.length);
      const key = [x, y].sort((p, q) => p - q).join('+');
      if (!x || !y) { say('Seimbang! Coba isi kedua keranjang, ya.'); await wait(1200); relock(); return; }
      if (found.indexOf(key) >= 0) { say('Pasangan itu sudah ada. Cari yang lain!'); await wait(1200); relock(); return; }
      found.push(key);
      const slotPos = cols[o.round][found.length - 1];
      const chip = slotPos.g;
      el('path', { d: rr(slotPos.x - 36, slotPos.y - 22, 72, 44, 12), fill: C.tealTint, stroke: C.teal, 'stroke-width': 3 }, chip);
      txt(chip, slotPos.x, slotPos.y + 1, `${x} + ${y}`, { size: 24 });
      if (!GS.reducedMotion) GS.tween(380, e => chip.setAttribute('transform', `translate(${slotPos.x} ${slotPos.y}) scale(${n1(e * 100) / 100}) translate(${-slotPos.x} ${-slotPos.y})`), 'outBack');
      GS.sfx.coin();
      say(`Pasangan baru: ${x} dan ${y}!`);
      if (found.length >= 3) {
        await wait(1600);
        if (o.round < o.rounds - 1) {
          o.round++;
          say(`Tiga pasangan! Sekarang karungnya ${ns[o.round]}.`);
          await sweep(it => it === kar);
          await relock();
          S.roundFails = 0; roundPips(); o.setup(o.round); refresh();
        } else finish(ns.length > 1 ? `Hebat! Banyak cara membuat ${ns.join(' dan ')}.` : `Hebat! Banyak cara membuat ${n}.`);
      } else { await wait(1300); say('Cari pasangan lain!'); relock(); }
    };
    o.solve = async () => {
      let x = 1; while (x < n && (found.indexOf([x, n - x].sort((p, q) => p - q).join('+')) >= 0)) x++;
      const bins = pan(1).bins, want = [x, n - x];
      for (let i = 0; i < 2; i++) while (bins[i].items.length > want[i]) moveItem(bins[i].items[bins[i].items.length - 1], S.tray);
      for (let i = 0; i < 2; i++) while (bins[i].items.length < want[i]) moveItem(S.tray.items()[0], pan(1), bins[i]);
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL: Penjumlahan (pilih satu anak timbangan) ============================== */
  function L5(cfg) {
    cfg = Object.assign({ a: [2, 6], b: [2, 6], rounds: 2 }, cfg || {});
    const o = { rounds: cfg.rounds };
    let a, b, s;
    o.setup = () => {
      a = rand(cfg.a[0], cfg.a[1]); b = rand(cfg.b[0], cfg.b[1]); s = a + b;
      const h = Math.max(a, b) > 6 ? 30 : 42;
      setPanBins(0, [{ x0: -104, x1: -6, y: 14, stack: 0.55 }, { x0: 6, x1: 104, y: 14, stack: 0.55 }]);
      setPanBins(1, [{ x0: -60, x1: 60, y: 14, cap: 1, swap: true, accept: it => it.kind === 'weight' }]);
      spawn(Array.from({ length: a }, () => ramb({ fixed: true, bin: 0, h })), pan(0), { stagger: 35 });
      spawn(Array.from({ length: b }, () => ramb({ fixed: true, bin: 1, h })), pan(0), { delay: 150, stagger: 35 });
      spawn(GS.shuffle([s, s - 1, s + 1, s + 2]).map(k => wt(k)), S.tray, { delay: 350 });
      say('Pilih satu anak timbangan yang pas.');
    };
    o.tag = i => i === 0 ? { parts: [a, b] } : null;
    o.accept = (it, c) => it.kind === 'weight' ? !(c.isPan && c.side < 0) : true;
    o.fixedTap = () => say(`Ada ${a} dan ${b} rambutan.`);
    const placedW = () => pan(1).items()[0];
    o.strip = () => [{ t: 'n', v: a, side: -1 }, { t: 'op', v: '+', side: -1 }, { t: 'n', v: b, side: -1 }, { t: 'sign' }, { t: 'blank', v: placedW() ? placedW().w : null, side: 1 }];
    o.canRelease = () => pan(1).count() > 0;
    o.cantMsg = 'Taruh satu anak timbangan di kanan.';
    o.result = async r => {
      if (r.balanced) { say(`${a} tambah ${b} sama dengan ${s}. Pas!`); mood('happy'); o.pause = 1800; await nextRound(); }
      else unbalanced(r, r.dir === 'R' ? 'Kanan turun. Coba yang lebih ringan.' : 'Kanan naik. Coba yang lebih berat.');
    };
    o.winText = () => 'Hebat! Kamu bisa menjumlah.';
    o.solve = async () => { const it = S.items.find(x => x.kind === 'weight' && x.w === s); if (it.c !== pan(1)) moveItem(it, pan(1)); await waitLocked(); await release(); };
    return o;
  }

  /* ============================== LEVEL: Bilangan hilang (karung tertutup) ============================== */
  function L6(cfg) {
    cfg = Object.assign({ n: [10, 15], m: [5, 8], stock: [5, 2, 2, 1, 1], rounds: 2 }, cfg || {});
    const o = { rounds: cfg.rounds, fade: true };
    let n, m, kar;
    o.setup = () => {
      m = rand(cfg.m[0], cfg.m[1]); n = rand(Math.max(cfg.n[0], m + 2), cfg.n[1]);
      setPanBins(0, [{ x0: -60, x1: 60, y: 14 }]);
      setPanBins(1, [{ x0: -104, x1: -20, y: 14, accept: it => it.kind === 'karung' }, { x0: -8, x1: 104, y: 14, cap: 8, stack: 0.6, pack: 0.85, accept: it => it.kind === 'weight' }]);
      clearPanDecor(1);
      slotOutline(1, 48, 104);
      spawn([wt(n, { fixed: true, h: 66 })], pan(0));
      kar = spawn([karung(m, { labelDots: false, bin: 0 })], pan(1), { delay: 150 })[0];
      spawn(cfg.stock.map(k => wt(k)), S.tray, { delay: 300 });
      say('Karung tidak bisa dibuka. Tambah anak timbangan sampai seimbang.');
    };
    o.changed = () => { if (kar && m <= 10 && kar.labelDots !== S.roundFails >= 2) { kar.labelDots = S.roundFails >= 2; drawKarungLabel(kar); } };
    o.accept = (it, c) => !(c.isPan && c.side < 0);
    o.fixedTap = it => say(it.kind === 'karung' ? `Karung ini tidak bisa dibuka. Isinya ${m}.` : `Ini anak timbangan ${n}.`);
    const extra = () => pan(1).bins[1].items.reduce((a2, it) => a2 + it.w, 0);
    o.strip = () => [{ t: 'n', v: n, side: -1 }, { t: 'sign' }, { t: 'n', v: m, side: 1 }, { t: 'op', v: '+', side: 1 }, { t: 'blank', v: extra() || null, side: 1 }];
    o.canRelease = () => extra() > 0;
    o.cantMsg = 'Taruh anak timbangan di kanan dulu.';
    o.result = async r => {
      if (r.balanced) { say(`${n} sama dengan ${m} tambah ${n - m}!`); mood('happy'); o.pause = 1800; await nextRound(); }
      else unbalanced(r, r.dir === 'L' ? `Kanan masih kurang. Hitung lanjut dari ${m}.` : 'Kanan terlalu berat. Ambil satu.');
    };
    o.winText = () => 'Hebat! Kamu menemukan bilangan hilang.';
    o.solve = async () => {
      pan(1).bins[1].items.slice().forEach(it => moveItem(it, S.tray));
      greedyFill(pan(1), n - m, pan(1).bins[1]);
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL: Sama dengan itu hubungan ============================== */
  function L7(cfg) {
    cfg = Object.assign({ big: false }, cfg || {});
    const big = cfg.big, step = big ? 5 : 1;
    const o = { rounds: 3, fade: !big };
    let a, b, c, x, sent = null;
    const truth = GS.shuffle([true, false]);
    const R = (lo, hi) => rand(Math.ceil(lo / step), Math.floor(hi / step)) * step;
    o.setup = r => {
      setPanBins(0, [{ x0: -100, x1: 100, y: 14 }]);
      clearPanDecor(1);
      if (r === 0) {
        o.predictNow = false;
        if (big) { do { a = R(10, 45); b = R(10, 45); } while (a + b > 90 || a === b); c = R(10, a + b - 10); }
        else { do { a = rand(2, cfg.max > 10 ? 9 : 6); b = rand(2, cfg.max > 10 ? 9 : 6); } while (a + b > (cfg.max || 10)); c = rand(1, a + b - 2); }
        x = a + b - c;
        setPanBins(1, [{ x0: -104, x1: -6, y: 14, cap: 1, swap: true, accept: it => !it.fixed }, { x0: 6, x1: 104, y: 14, accept: it => it.fixed }]);
        slotOutline(1, -55, 90);
        spawn([wt(a, { fixed: true }), wt(b, { fixed: true })], pan(0));
        spawn([wt(c, { fixed: true, bin: 1 })], pan(1), { delay: 150 });
        const opts = [x, a + b, x + step, x > step ? x - step : x + 2 * step];
        spawn(GS.shuffle(opts.filter((v, i) => opts.indexOf(v) === i)).map(k => wt(k)), S.tray, { delay: 300 });
        say('Sama dengan artinya sama berat. Isi yang kosong!');
      } else {
        o.predictNow = true; S.pred = null;
        const t = big ? R(40, 90) : rand(6, 10);
        const d = big ? R(10, t - 10) : rand(2, t - 2);
        const pool = [];
        for (let v = step; v < t; v += step) if (v !== d && v !== t - d) pool.push(v);
        const f0 = GS.shuffle(pool)[0];
        const isTrue = truth[r - 1];
        let g = t - f0;
        if (!isTrue) g = g > step && Math.random() < 0.5 ? g - step : g + step;
        sent = { d, e: t - d, f: f0, g, isTrue };
        setPanBins(1, [{ x0: -100, x1: 100, y: 14 }]);
        spawn([wt(sent.d, { fixed: true }), wt(sent.e, { fixed: true })], pan(0));
        spawn([wt(sent.f, { fixed: true }), wt(sent.g, { fixed: true })], pan(1), { delay: 150 });
        say('Seimbang atau tidak? Tebak dulu!');
      }
    };
    o.accept = (it, cc) => !(cc.isPan && cc.side < 0);
    o.fixedTap = it => say(`Ini ${it.w}.`);
    const slotW = () => { const it = pan(1).bins[0] && pan(1).bins[0].items[0]; return it && !it.fixed ? it.w : null; };
    o.strip = () => o.round === 0
      ? [{ t: 'n', v: a, side: -1 }, { t: 'op', v: '+', side: -1 }, { t: 'n', v: b, side: -1 }, { t: 'sign' }, { t: 'blank', v: slotW(), side: 1 }, { t: 'op', v: '+', side: 1 }, { t: 'n', v: c, side: 1 }]
      : sent && [{ t: 'n', v: sent.d, side: -1 }, { t: 'op', v: '+', side: -1 }, { t: 'n', v: sent.e, side: -1 }, { t: 'sign' }, { t: 'n', v: sent.f, side: 1 }, { t: 'op', v: '+', side: 1 }, { t: 'n', v: sent.g, side: 1 }];
    o.canRelease = () => o.round > 0 || slotW() != null;
    o.cantMsg = 'Taruh anak timbangan di tempat kosong.';
    o.result = async r => {
      if (o.round === 0) {
        if (r.balanced) { say(`${a} + ${b} sama dengan ${x} + ${c}!`); mood('happy'); o.pause = 1800; await nextRound(); }
        else if (slotW() === a + b) unbalanced(r, `Hmm, kanan jadi lebih berat. Ingat, di kanan sudah ada ${c}.`);
        else unbalanced(r, r.dir === 'R' ? 'Kanan turun. Coba yang lebih ringan.' : 'Kanan naik. Coba yang lebih berat.');
      } else {
        const ok = S.pred === r.dir;
        if (ok) bonus();
        mood(ok ? 'happy' : 'surprise');
        const L = sent.d + sent.e, Rr = sent.f + sent.g;
        say((ok ? 'Benar! ' : 'Lihat! ') + (L === Rr ? `${sent.d} + ${sent.e} sama dengan ${sent.f} + ${sent.g}.` : `${sent.d} + ${sent.e} ${outcomeWord(L, Rr)} ${sent.f} + ${sent.g}.`));
        o.pause = 2600;
        await nextRound();
      }
    };
    o.winText = () => 'Sama dengan artinya sama berat!';
    o.solve = async () => {
      if (o.round === 0) { const it = S.items.find(q => q.kind === 'weight' && !q.fixed && q.w === x); if (it.c !== pan(1)) moveItem(it, pan(1), pan(1).bins[0]); }
      else pickPrediction(evaluate().dir);
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL: Pengurangan (ambil dari kiri) ============================== */
  function L8(cfg) {
    cfg = Object.assign({ n: [11, 15], m: [6, 9], big: false, rounds: 2 }, cfg || {});
    const o = { rounds: cfg.rounds, fade: !cfg.big };
    let n, m;
    o.setup = () => {
      if (cfg.big) {
        const a = rand(4, 9), b = rand(2, 9), c = rand(1, a - 1), d = rand(0, b - 1);
        n = 10 * a + b; m = 10 * c + d;
        setPanBins(0, [{ x0: -100, x1: 100, y: 14, sort: true, pack: 0.85, stack: 0.5 }]);
        spawn(stockOf([10, 1], [a, b], { h: 42 }), pan(0), { stagger: 30 });
      } else {
        n = rand(cfg.n[0], cfg.n[1]); m = rand(cfg.m[0], Math.min(cfg.m[1], n - 2));
        setPanBins(0, [{ x0: -100, x1: 100, y: 14, cap: 20 }]);
        spawn(Array.from({ length: n }, () => ramb({ h: rambH(n) })), pan(0), { stagger: 30 });
      }
      setPanBins(1, [{ x0: -60, x1: 60, y: 14 }]);
      spawn([wt(m, { fixed: true, h: 64 })], pan(1), { delay: 250 });
      say(cfg.big ? 'Ambil anak timbangan dari kiri sampai seimbang.' : 'Ambil rambutan dari kiri sampai seimbang.');
    };
    o.accept = (it, c) => !(c.isPan && c.side > 0);
    o.fixedTap = () => say(`Ini anak timbangan ${m}.`);
    const taken = () => n - pan(0).sum();
    o.strip = () => [{ t: 'n', v: n, side: -1 }, { t: 'op', v: '−', side: -1 }, { t: 'blank', v: taken() > 0 ? taken() : null, side: -1 }, { t: 'sign' }, { t: 'n', v: m, side: 1 }];
    o.result = async r => {
      if (r.balanced) { say(`${n} kurang ${n - m} sama dengan ${m}!`); mood('happy'); o.pause = 1800; await nextRound(); }
      else unbalanced(r, r.dir === 'L' ? 'Kiri masih lebih berat. Ambil lagi.' : 'Kiri jadi terlalu ringan. Kembalikan satu.');
    };
    o.winText = () => 'Hebat! Kamu bisa mengurangi.';
    o.solve = async () => {
      S.tray.items().slice().forEach(it => moveItem(it, pan(0)));
      let need = n - m;
      const ds = [...new Set(pan(0).items().map(it => it.w))].sort((p, q) => q - p);
      for (const d of ds) while (need >= d) { const it = pan(0).items().find(x => x.w === d); if (!it) break; moveItem(it, S.tray); need -= d; }
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL: Setengah ============================== */
  function L9(cfg) {
    cfg = Object.assign({ n: [5, 8], big: false }, cfg || {});
    const o = { rounds: 1, fade: !cfg.big };
    let n;
    o.setup = () => {
      n = rand(cfg.n[0], cfg.n[1]);
      [0, 1].forEach(i => { setPanBins(i, [{ x0: -78, x1: 78, y: -2, stack: 0.55, sort: cfg.big, pack: cfg.big ? 0.85 : 0.95 }]); clearPanDecor(i); sackDecor(i); });
      if (cfg.big) spawn(stockOf([10, 1], [2 * Math.floor(n / 10), 2 * (n % 10)], { h: 40 }), S.tray, { stagger: 25 });
      else spawn(Array.from({ length: 2 * n }, () => marb()), S.tray);
      say(cfg.big ? `Bagi ${2 * n} ke dua kantong, sama berat.` : `Bagi ${2 * n} kelereng ke dua kantong, sama banyak.`);
    };
    o.strip = () => [{ t: 'n', v: 2 * n }, { t: 'sign', v: '=' }, { t: 'blank', v: pan(0).sum() || null, side: -1 }, { t: 'op', v: '+' }, { t: 'blank', v: pan(1).sum() || null, side: 1 }];
    o.canRelease = () => pan(0).count() + pan(1).count() > 0;
    o.cantMsg = 'Masukkan ke kantong dulu.';
    o.result = async r => {
      if (r.balanced && S.tray.count() === 0) {
        say(`Setengah dari ${2 * n} adalah ${n}!`);
        o.strip = () => [{ t: 'txt', v: `Setengah dari ${2 * n} adalah` }, { t: 'n', v: n }];
        if (S.strip) S.strip.prev = [];
        renderStripNow();
        finish(`Setengah dari ${2 * n} adalah ${n}!`);
      } else if (r.balanced) say('Seimbang! Tapi masih ada yang di nampan.');
      else unbalanced(r);
    };
    o.solve = async () => {
      [0, 1].forEach(i => pan(i).items().slice().forEach(it => moveItem(it, S.tray)));
      if (cfg.big) { [0, 1].forEach(i => { for (let k = 0; k < Math.floor(n / 10); k++) moveItem(S.tray.items().find(x => x.w === 10), pan(i)); for (let k = 0; k < n % 10; k++) moveItem(S.tray.items().find(x => x.w === 1), pan(i)); }); }
      else S.tray.items().slice().forEach((it, i) => moveItem(it, pan(i % 2)));
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL: Susun bilangan (puluhan, ratusan, ribuan, gram) ============================== */
  /** cfg.gen(r) -> { target:{kind:'karung'|'weight', v, label}, given?, givenLabel?, denoms, stock, say, ok }
   *  cfg.buildSide: -1 (left) or 1 (right); cfg.strip(cur, built, bySum); cfg.unit (' g'). */
  function Compose(cfg) {
    const o = { rounds: cfg.rounds || 1 };
    let cur;
    const bp = () => (cfg.buildSide < 0 ? 0 : 1), tp = () => 1 - bp();
    o.setup = r => {
      cur = cfg.gen(r);
      const bs = bp();
      const bins = [];
      if (cur.given != null) bins.push({ x0: -106, x1: -40, y: 14, accept: it => it.kind === 'karung' });
      bins.push({ x0: cur.given != null ? -32 : -102, x1: 102, y: 14, sort: true, pack: 0.82, stack: 0.46, accept: it => it.kind === 'weight' && !it.fixed });
      setPanBins(bs, bins);
      setPanBins(tp(), [{ x0: -80, x1: 80, y: 14 }]);
      clearPanDecor(bs); clearPanDecor(tp());
      slotOutline(bs, cur.given != null ? 34 : 0, cur.given != null ? 128 : 186);
      const tg = cur.target;
      spawn([tg.kind === 'karung' ? karung(tg.v, { labelN: tg.label || tg.v, labelDots: false, h: 100 }) : wt(tg.v, { fixed: true, h: 70, label: tg.label })], pan(tp()));
      if (cur.given != null) spawn([karung(cur.given, { labelN: cur.givenLabel || cur.given, labelDots: false, bin: 0, h: 92 })], pan(bs), { delay: 120 });
      spawn(stockOf(cur.denoms, cur.stock, { h: cfg.h || 42, unit: cfg.unit }), S.tray, { delay: 260, stagger: 18 });
      say(cur.say);
    };
    const built = () => pan(bp()).items().filter(it => it.kind === 'weight' && !it.fixed);
    const total = () => built().reduce((a, it) => a + it.w, 0);
    const bySum = d => built().filter(it => it.w === d).reduce((a, it) => a + it.w, 0);
    o.strip = () => cfg.strip(cur, total(), bySum);
    o.accept = (it, c) => !(c.isPan && c.side === (bp() ? -1 : 1));
    o.fixedTap = it => say(it.kind === 'karung' ? 'Karung ini tertutup. Lihat angkanya.' : 'Ini beban yang harus disamakan.');
    o.canRelease = () => built().length > 0;
    o.cantMsg = 'Taruh anak timbangan dulu, ya.';
    o.result = async r => {
      if (r.balanced) { o.final = cfg.final ? cfg.final(cur) : null; renderStripNow(); say(cur.ok); mood('happy'); o.pause = 2000; await nextRound(); }
      else unbalanced(r, buildMsg(r, cfg.buildSide));
    };
    o.strip0 = o.strip;
    o.strip = () => o.final || o.strip0();
    o.winText = () => cfg.win || 'Hebat! Bilangannya tersusun.';
    o.solve = async () => {
      built().slice().forEach(it => moveItem(it, S.tray));
      const bs = bp(), bin = pan(bs).bins[pan(bs).bins.length - 1];
      greedyFill(pan(bs), cur.target.v - (cur.given || 0), bin);
      await waitLocked(); await release();
    };
    const setup0 = o.setup;
    o.setup = r => { o.final = null; setup0(r); };
    return o;
  }
  const digitsOf = (n, denoms) => denoms.map(d => Math.floor(n / d) % 10);
  /** chips for "a + b + c" from per-denomination sums, blanks when empty */
  function placeTokens(denoms, bySum, side, unit) {
    const out = [];
    denoms.forEach((d, i) => { if (i) out.push({ t: 'op', v: '+', side }); const v = bySum(d); out.push({ t: v ? 'n' : 'blank', v: v ? fmt(v) + (unit || '') : null, side }); });
    return out;
  }

  /* ============================== LEVEL: Kantong sama isi (penjumlahan berulang, perkalian) ============================== */
  /** cfg.gen(r) -> {g, k}; cfg.mode 'pick' | 'build'; cfg.strip 'add' | 'mul' | 'mul2' */
  function Bags(cfg) {
    const o = { rounds: cfg.rounds || 1 };
    let cur;
    const prod = () => cur.g * cur.k;
    o.setup = r => {
      cur = cfg.gen(r); o.final = null;
      setPanBins(0, [{ x0: -104, x1: 104, y: 14, pack: 0.9, stack: 0.62 }]);
      if (cfg.mode === 'pick') setPanBins(1, [{ x0: -60, x1: 60, y: 14, cap: 1, swap: true, accept: it => it.kind === 'weight' }]);
      else setPanBins(1, [{ x0: -102, x1: 102, y: 14, sort: true, pack: 0.82, stack: 0.46, accept: it => it.kind === 'weight' }]);
      clearPanDecor(0); clearPanDecor(1);
      spawn(Array.from({ length: cur.k }, () => kantong(cur.g, { h: cur.k > 3 ? 52 : 60 })), pan(0), { stagger: 90 });
      const p = prod();
      if (cfg.mode === 'pick') {
        const opts = [p, p - cur.g, p + cur.g, p + 1].filter(v => v > 0);
        spawn(GS.shuffle(opts.filter((v, i) => opts.indexOf(v) === i)).map(v => wt(v)), S.tray, { delay: 320 });
      } else spawn(stockOf([10, 1], [9, 9], { h: 42 }), S.tray, { delay: 320, stagger: 18 });
      say(r === 0 ? `Ada ${cur.k} kantong, isinya masing-masing ${cur.g}. Seimbangkan!` : `Sekarang ${cur.k} kantong isi ${cur.g}.`);
    };
    const val = () => pan(1).sum();
    o.strip = () => {
      if (o.final) return o.final;
      const right = [{ t: 'blank', v: pan(1).count() ? val() : null, side: 1 }];
      let left;
      if (cfg.strip === 'add') { left = []; for (let i = 0; i < cur.k; i++) { if (i) left.push({ t: 'op', v: '+', side: -1 }); left.push({ t: 'n', v: cur.g, side: -1 }); } }
      else if (cfg.strip === 'mul') left = [{ t: 'n', v: cur.k, side: -1 }, { t: 'op', v: '×', side: -1 }, { t: 'n', v: cur.g, side: -1 }];
      else left = [{ t: 'n', v: cur.g, side: -1 }, { t: 'op', v: '×', side: -1 }, { t: 'n', v: cur.k, side: -1 }];
      return left.concat([{ t: 'sign' }], right);
    };
    o.accept = (it, c) => !(c.isPan && c.side < 0);
    o.fixedTap = () => say(`Kantong ini isinya ${cur.g}.`);
    o.canRelease = () => pan(1).count() > 0;
    o.cantMsg = 'Taruh anak timbangan di kanan dulu.';
    o.result = async r => {
      if (r.balanced) {
        o.final = [{ t: 'n', v: cur.k }, { t: 'op', v: '×' }, { t: 'n', v: cur.g }, { t: 'sign', v: '=' }, { t: 'n', v: prod() }];
        if (cfg.strip === 'mul2') o.final = [{ t: 'n', v: cur.g }, { t: 'op', v: '×' }, { t: 'n', v: cur.k }, { t: 'sign', v: '=' }, { t: 'n', v: prod() }];
        renderStripNow();
        say(`${cur.k} kantong isi ${cur.g} sama dengan ${prod()}!`); mood('happy'); o.pause = 2000; await nextRound();
      } else unbalanced(r, cfg.mode === 'pick' ? (r.dir === 'R' ? 'Kanan turun. Coba yang lebih ringan.' : 'Kanan naik. Coba yang lebih berat.') : buildMsg(r, 1));
    };
    o.winText = () => cfg.win || 'Hebat! Kelompok sama banyak.';
    o.solve = async () => {
      if (cfg.mode === 'pick') { const it = S.items.find(x => x.kind === 'weight' && x.w === prod()); if (it.c !== pan(1)) moveItem(it, pan(1)); }
      else { pan(1).items().slice().forEach(it => moveItem(it, S.tray)); greedyFill(pan(1), prod()); }
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL: Kantong kembar (pembagian, faktor, pecahan, kotak misteri) ============================== */
  /** One "template" basket is filled by the child; Bu Ani fills the other k-1 baskets exactly the same.
   *  cfg.gen(r) -> { k, target:{kind,v,label}, extra?, items:'ramb'|'weights', stock, say, ok }
   *  cfg.tside: side of the baskets (-1 / 1); cfg.strip(cur, s); cfg.final(cur, s); cfg.decor 'basket'|'box' */
  function Template(cfg) {
    const o = { rounds: cfg.rounds || 1 };
    let cur, tp, op;
    const tpl = () => pan(tp).bins[0].items;
    const s = () => tpl().reduce((a, it) => a + it.w, 0);
    o.setup = r => {
      cur = cfg.gen(r); o.final = null;
      tp = cfg.tside < 0 ? 0 : 1; op = 1 - tp;
      const k = cur.k, hasX = cur.extra != null;
      const x0 = -104, x1 = hasX ? 48 : 104, bw = (x1 - x0) / k;
      const bins = [];
      for (let i = 0; i < k; i++) bins.push({ x0: x0 + i * bw + 3, x1: x0 + (i + 1) * bw - 3, y: -4, stack: 0.5, pack: 0.86, accept: i === 0 ? (it => !it.fixed) : (it => !!it.copy) });
      if (hasX) bins.push({ x0: 56, x1: 106, y: 14, accept: it => it.fixed && !it.copy });
      setPanBins(tp, bins); setPanBins(op, [{ x0: -80, x1: 80, y: 14 }]);
      clearPanDecor(0); clearPanDecor(1);
      basketDecor(tp, bins.slice(0, k).map(b => (b.x0 + b.x1) / 2), bw - 2, cfg.decor);
      const tg = cur.target;
      spawn([tg.kind === 'karung' ? karung(tg.v, { labelN: tg.label || tg.v, labelDots: false }) : wt(tg.v, { fixed: true, h: 68, label: tg.label })], pan(op));
      if (hasX) spawn([wt(cur.extra, { fixed: true, bin: k, h: 54 })], pan(tp), { delay: 120 });
      if (cur.items === 'ramb') spawn(Array.from({ length: cur.stock }, () => ramb({ h: 30 })), S.tray, { delay: 260, stagger: 30 });
      else spawn(cur.stock.map(v => wt(v, { h: k > 3 ? 34 : 40 })), S.tray, { delay: 260 });
      say(cur.say);
    };
    function sync() {
      const bins = pan(tp).bins, src = tpl();
      for (let i = 1; i < cur.k; i++) {
        bins[i].items.slice().forEach(cp => { removeFromContainer(cp); cp.g.remove(); const j = S.items.indexOf(cp); if (j >= 0) S.items.splice(j, 1); });
        src.forEach((sv, j) => {
          const def = Object.assign({}, sv.def, { fixed: true, copy: true, home: null });
          delete def.bin;
          const it = makeItem(def);
          addToBin(it, pan(tp), bins[i]);
          it.x = (bins[i].x0 + bins[i].x1) / 2; it.y = bins[i].y - 30; setPos(it); setScale(it);
          it.g.style.opacity = '0';
          later(80 + i * 70 + j * 20, () => { it.g.style.opacity = '1'; squash(it, 'medium'); if (j === 0) GS.sfx.pop(); });
        });
      }
      layout(pan(tp), true);
    }
    o.placed = (it, c) => { if (c === pan(tp)) sync(); };
    o.removed = (it, c) => { if (c === pan(tp)) sync(); };
    o.changed = () => {
      const bs = S.pans[tp].baskets; if (!bs) return;
      bs.forEach((b, i) => basketLabel(b, cfg.decor === 'box' && !s() ? '?' : s(), i === 0));
    };
    o.strip = () => o.final || cfg.strip(cur, tpl().length ? s() : null);
    o.accept = (it, c) => !(c.isPan && c.side === (op ? 1 : -1));
    o.fixedTap = it => say(it.copy ? 'Bu Ani mengisi sama persis dengan yang pertama.' : 'Ini harus disamakan.');
    o.canRelease = () => tpl().length > 0;
    o.cantMsg = 'Isi keranjang pertama dulu, ya.';
    o.result = async r => {
      if (r.balanced) { o.final = cfg.final(cur, s()); renderStripNow(); say(cur.ok(s())); mood('happy'); o.pause = 2200; await nextRound(); }
      else unbalanced(r, buildMsg(r, cfg.tside));
    };
    o.winText = () => cfg.win || 'Hebat!';
    o.solve = async () => {
      tpl().slice().forEach(it => moveItem(it, S.tray));
      const need = cur.answer;
      if (cur.items === 'ramb') S.tray.items().slice(0, need).forEach(it => moveItem(it, pan(tp), pan(tp).bins[0]));
      else greedyFill(pan(tp), need, pan(tp).bins[0]);
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL: Pertidaksamaan (pilih semua beban) ============================== */
  function Ineq() {
    const o = { rounds: 1, near: false };
    let Lv, rv, t, cands = [], tested = false;
    o.setup = () => {
      Lv = rand(11, 16); rv = rand(3, 6); t = Lv - rv;
      setPanBins(0, [{ x0: -60, x1: 60, y: 14 }]);
      setPanBins(1, [{ x0: -104, x1: -20, y: 14, accept: it => it.kind === 'karung' }, { x0: -8, x1: 104, y: 14, cap: 1, accept: it => it.kind === 'weight' }]);
      clearPanDecor(1); slotOutline(1, 48, 104);
      spawn([wt(Lv, { fixed: true, h: 66 })], pan(0));
      spawn([karung(rv, { bin: 0, labelDots: false })], pan(1), { delay: 120 });
      const vals = []; for (let v = t - 3; v <= t + 2; v++) if (v >= 1) vals.push(v);
      cands = spawn(GS.shuffle(vals).map(v => wt(v, { fixed: true, cand: true, h: 54, decor: it => { it.mark = el('g', null, it.inner); } })), S.tray, { delay: 260 });
      say('Ketuk semua beban yang membuat kiri tetap lebih berat.');
    };
    function drawMark(it) {
      const g = it.mark; g.innerHTML = '';
      if (it.sel) {
        const m = el('g', { transform: `translate(0 ${-it.h - 22})` }, g);
        el('circle', { r: 15, fill: C.blue, stroke: OL, 'stroke-width': 3 }, m);
        el('path', { d: 'M-6 0l4 4.5 8 -9', stroke: '#fff', 'stroke-width': 3.4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, m);
      }
      if (it.truth != null) {
        const m = el('g', { transform: 'translate(0 14)' }, g);
        el('path', { d: rr(-22, -9, 44, 18, 9), fill: it.truth ? C.tealTint : C.amberTint, stroke: it.truth ? C.teal : C.amber, 'stroke-width': 2.6 }, m);
        txt(m, 0, 0.5, it.truth ? 'kiri' : 'tidak', { size: 13, cls: 'tp-body' });
      }
    }
    o.fixedTap = it => {
      if (!it.cand) { say(it.kind === 'karung' ? `Karung ini isinya ${rv}.` : `Kiri beratnya ${Lv}.`); return; }
      it.sel = !it.sel; drawMark(it); GS.sfx.pop(); dockRender();
    };
    o.strip = () => [{ t: 'n', v: Lv, side: -1 }, { t: 'sign', v: '>' }, { t: 'n', v: rv, side: 1 }, { t: 'op', v: '+', side: 1 }, { t: 'blank', v: (pan(1).bins[1] && pan(1).bins[1].items[0]) ? pan(1).bins[1].items[0].w : null, side: 1 }];
    o.canRelease = () => cands.some(it => it.sel);
    o.cantMsg = 'Ketuk beban yang kamu pilih dulu.';
    o.customRelease = async () => {
      const g = S.gen;
      S.busy = true; dockRender();
      if (!tested) {
        say('Kita coba satu per satu.');
        for (const it of cands.slice()) {
          moveItem(it, pan(1), pan(1).bins[1]);
          await wait(330); if (g !== S.gen) return;
          await pegPop(); if (g !== S.gen) return;
          S.locked = false;
          const r = evaluate(); S.last = r; renderStripNow();
          await simRun(Object.assign({}, r.params, { k: 170, c: 13 })); if (g !== S.gen) return;
          it.truth = r.dir === 'L'; drawMark(it);
          if (it.truth) GS.sfx.coin(); else GS.sfx.tick();
          await wait(250); if (g !== S.gen) return;
          moveItem(it, S.tray);
          await waitLocked(true); if (g !== S.gen) return;
        }
        tested = true;
      }
      const wrong = cands.filter(it => !!it.sel !== it.truth);
      if (!wrong.length) { mood('happy'); say(`Semua benar! Kiri lebih berat kalau bebannya kurang dari ${t}.`); finish('Hebat! Kamu menemukan semua beban.'); return; }
      S.tries++; GS.sfx.oops(); mood('oops');
      wrong.forEach(wobbleItem);
      say('Lihat tanda di bawah beban. Pilih lagi, ya.');
      S.busy = false; dockRender();
    };
    o.result = async () => {};
    o.winText = () => 'Hebat! Kamu menemukan semua beban.';
    o.solve = async () => { cands.forEach(it => { it.sel = it.w < t; drawMark(it); }); await waitLocked(); await release(); };
    return o;
  }

  /* ============================== seesaw helpers ============================== */
  const notch = (side, d) => S.notches.find(c => c.side === side && c.d === d);
  function seesawResultMsg(r) { return r.dir === 'L' ? 'Sisi kiri turun. Coba geser.' : 'Sisi kanan turun. Coba geser.'; }

  /* ============================== LEVEL 10: Jungkat-jungkit posisi ============================== */
  function L10() {
    const o = { rounds: 1, predictNow: true, near: false };
    let kids = [];
    const idx = GS.shuffle([0, 1, 3, 4, 6, 7]);
    o.setup = () => {
      kids = [spawn([person(idx[0], 1, 112, { fixed: true, home: S.homes[0] })], notch(-1, 3))[0],
        spawn([person(idx[1], 1, 112, { fixed: true, home: S.homes[1] })], notch(1, 1), { delay: 150 })[0]];
      o.phase = 0;
      say('Sama berat. Sisi mana yang turun?');
    };
    o.fixedTap = () => say(o.phase === 0 ? 'Tebak dulu, lalu Lepas!' : 'Geser anak ke pasak lain.');
    o.result = async r => {
      if (o.phase === 0) {
        const ok = S.pred === r.dir;
        if (ok) bonus();
        mood(ok ? 'happy' : 'surprise');
        say((ok ? 'Benar! ' : 'Lihat! ') + 'Kiri turun. Jaraknya lebih jauh.');
        await wait(2600);
        o.phase = 1; o.predictNow = false; S.pred = null;
        kids.forEach(k => setFixed(k, false));
        mood('think');
        say('Pindahkan anak supaya seimbang.');
        return;
      }
      if (r.balanced) { say('Seimbang! Jaraknya sama.'); finish('Jarak juga penting!'); }
      else unbalanced(r, seesawResultMsg(r));
    };
    o.solve = async () => {
      if (o.phase === 0) { pickPrediction(evaluate().dir); await release(); return; }
      moveItem(kids[0], notch(-1, 1)); moveItem(kids[1], notch(1, 1));
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL 11: Kakak dan adik ============================== */
  function L11() {
    const o = { rounds: 2 };
    let fixedP, mover;
    const kIdx = rand(0, 1) ? 0 : 7, aIdx = rand(0, 1) ? 3 : 4;
    o.setup = r => {
      if (r === 0) {
        fixedP = spawn([person(kIdx, 2, 134, { fixed: true, keep: false })], notch(1, 1))[0];
        mover = spawn([person(aIdx, 1, 100, { home: S.homes[1] })], S.homes[1], { delay: 200 })[0];
        say('Kakak lebih berat. Di mana adik duduk?');
      } else {
        fixedP = spawn([person(aIdx, 1, 100, { fixed: true })], notch(-1, 2))[0];
        mover = spawn([person(kIdx, 2, 134, { home: S.homes[1] })], S.homes[1], { delay: 200 })[0];
        say('Sekarang adik di sini. Di mana kakak duduk?');
      }
    };
    o.fixedTap = it => say(it.w === 2 ? 'Ini kakak. Beratnya 2.' : 'Ini adik. Beratnya 1.');
    o.canRelease = () => !!mover.c && !mover.c.isHome;
    o.cantMsg = 'Dudukkan dulu di jungkat-jungkit.';
    o.result = async r => {
      if (r.balanced) { say(o.round === 0 ? '2 kali 1 sama dengan 1 kali 2. Seimbang!' : 'Seimbang! Kakak dekat, adik jauh.'); mood('happy'); o.pause = 2000; await nextRound(); }
      else unbalanced(r, seesawResultMsg(r));
    };
    o.winText = () => 'Berat kali jarak sama, jadi seimbang!';
    o.solve = async () => { moveItem(mover, o.round === 0 ? notch(-1, 2) : notch(1, 1)); await waitLocked(); await release(); };
    return o;
  }

  /* ============================== LEVEL 12: Tenaga putar ============================== */
  function L12() {
    const o = { rounds: 2 };
    let mover, answer;
    const variant = Math.random() < 0.5;
    o.setup = r => {
      if (r === 0) {
        if (variant) { spawn([wt(3, { fixed: true, h: 70 })], notch(1, 2)); mover = spawn([wt(2, { h: 70, home: S.homes[1] })], S.homes[1], { delay: 200 })[0]; answer = notch(-1, 3); }
        else { spawn([wt(2, { fixed: true, h: 70 })], notch(-1, 3)); mover = spawn([wt(3, { h: 70, home: S.homes[1] })], S.homes[1], { delay: 200 })[0]; answer = notch(1, 2); }
        say('Taruh beban di pasak yang pas.');
      } else {
        spawn([wt(2, { fixed: true, h: 70 })], notch(-1, 1));
        spawn([wt(2, { fixed: true, h: 70 })], notch(-1, 2), { delay: 120 });
        mover = spawn([wt(3, { h: 70, home: S.homes[1] })], S.homes[1], { delay: 250 })[0];
        answer = notch(1, 2);
        say('Dua beban di kiri. Di mana beban 3?');
      }
    };
    o.fixedTap = it => say(`Beban ${it.w}.`);
    const sideTokens = side => {
      const parts = [];
      S.notches.filter(c => c.side === side && c.count()).sort((p, q) => p.d - q.d).forEach(c => { for (let k = 0; k < c.d; k++) parts.push(c.sum()); });
      if (!parts.length) return [{ t: 'blank', v: null, side }];
      const out = [];
      parts.forEach((v, i) => { if (i) out.push({ t: 'op', v: '+', side }); out.push({ t: 'n', v, side }); });
      return out;
    };
    o.strip = () => sideTokens(-1).concat([{ t: 'sign' }], sideTokens(1));
    o.canRelease = () => !!mover.c && !mover.c.isHome;
    o.cantMsg = 'Taruh beban di jungkat-jungkit dulu.';
    o.result = async r => {
      if (r.balanced) { say('Seimbang! Tenaga putarnya sama.'); mood('happy'); o.pause = 2000; await nextRound(); }
      else unbalanced(r, seesawResultMsg(r));
    };
    o.winText = () => '2 + 2 + 2 = 3 + 3. Seimbang!';
    o.solve = async () => { moveItem(mover, answer); await waitLocked(); await release(); };
    return o;
  }


  /* ============================== TK: Lebih banyak (ketuk piring) ============================== */
  function TKMore() {
    const o = { rounds: 3, near: false, pause: 2200 };
    let a, b, choice = null;
    function marker(i) {
      S.pans.forEach(p => { if (p.mark) { p.mark.remove(); p.mark = null; } });
      if (i == null) return;
      const p = S.pans[i], col = i ? C.orange : C.blue;
      p.mark = el('g', { transform: 'translate(0 -150)' }, p.front);
      el('path', { d: 'M-16 -30H16V0H32L0 34L-32 0H-16Z', fill: col, stroke: OL, 'stroke-width': 4, 'stroke-linejoin': 'round' }, p.mark);
      el('ellipse', { cx: 0, cy: 150, rx: 124, ry: 30, fill: 'none', stroke: col, 'stroke-width': 6, 'stroke-dasharray': '12 8' }, p.mark);
      if (!GS.reducedMotion) GS.tween(380, e => p.mark.setAttribute('transform', `translate(0 ${n1(-150 - 30 * (1 - e))})`), 'outBounce');
    }
    o.setup = r => {
      do { a = rand(1, 6); b = rand(1, 6); } while (a === b || (r === 0 && Math.abs(a - b) < 2));
      setPanBins(0, [{ x0: -100, x1: 100, y: 14 }]); setPanBins(1, [{ x0: -100, x1: 100, y: 14 }]);
      spawn(Array.from({ length: a }, () => ramb({ fixed: true, h: 46 })), pan(0));
      spawn(Array.from({ length: b }, () => ramb({ fixed: true, h: 46 })), pan(1), { delay: 200 });
      choice = null; S.pred = null; marker(null);
      S.pans.forEach(p => p.tapHit.setAttribute('display', 'inline'));
      say(r === 0 ? 'Mana yang lebih banyak? Ketuk piringnya!' : 'Mana yang lebih banyak? Ketuk!');
    };
    o.panTap = i => {
      if (S.busy || !S.locked || S.over) return;
      choice = i; S.pred = i ? 'R' : 'L';
      marker(i); GS.sfx.pop();
      say('Tekan Lepas!');
      dockRender();
    };
    o.fixedTap = it => o.panTap(it.c === pan(0) ? 0 : 1);
    o.canRelease = () => choice != null;
    o.cantMsg = 'Ketuk piring yang lebih banyak dulu.';
    o.tag = i => TIER === 'tk' && S.last ? (i ? b : a) : null;
    o.result = async r => {
      const ok = S.pred === r.dir;
      if (ok) bonus();
      mood(ok ? 'happy' : 'surprise');
      updateTags();
      say(ok ? 'Benar! Lebih banyak, lebih berat.' : 'Lihat! Piring yang turun isinya lebih banyak.');
      await nextRound();
      marker(null);
    };
    o.winText = () => 'Yang lebih banyak, lebih berat!';
    o.solve = async () => { o.panTap(a > b ? 0 : 1); await release(); };
    return o;
  }

  /* ============================== TK: Jungkat-jungkit kakak dan adik ============================== */
  function TKSee() {
    const o = { rounds: 2, predictNow: true, near: false, pause: 2400 };
    const kIdx = rand(0, 1) ? 0 : 7, aIdx = rand(0, 1) ? 3 : 4;
    let kSide = Math.random() < 0.5 ? -1 : 1;
    o.setup = r => {
      if (r > 0) kSide = -kSide;
      spawn([person(kIdx, 2, 134, { fixed: true })], notch(kSide, 2));
      spawn([person(aIdx, 1, 100, { fixed: true })], notch(-kSide, 2), { delay: 150 });
      S.pred = null; o.predictNow = true;
      say(r === 0 ? 'Kakak dan adik. Sisi mana yang turun?' : 'Sekarang tukar tempat. Mana yang turun?');
    };
    o.fixedTap = it => say(it.w === 2 ? 'Ini kakak.' : 'Ini adik.');
    o.result = async r => {
      const ok = S.pred === r.dir;
      if (ok) bonus();
      mood(ok ? 'happy' : 'surprise');
      say(ok ? 'Benar! Kakak lebih berat.' : 'Lihat! Sisi kakak turun. Kakak lebih berat.');
      await nextRound();
    };
    o.winText = () => 'Yang lebih berat, turun!';
    o.solve = async () => { pickPrediction(evaluate().dir); await release(); };
    return o;
  }

  /* ============================== LEVEL: Pengungkit banyak beban (jarak 1 sampai 4) ============================== */
  /** cfg.gen(r) -> { fixed:[{w,side,d}], movers:[{w, side?, d?}], sol:[{side,d}], say } */
  function Lever(cfg) {
    const o = { rounds: cfg.rounds || 1 };
    let cur, movers = [];
    o.setup = r => {
      cur = cfg.gen(r);
      cur.fixed.forEach((f, i) => spawn([wt(f.w, { fixed: true, h: 58 })], notch(f.side, f.d), { delay: i * 100 }));
      movers = cur.movers.map((m, i) => spawn([wt(m.w, { h: 58, home: S.homes[i] })], m.side ? notch(m.side, m.d) : S.homes[i], { delay: 300 + i * 100 })[0]);
      say(cur.say);
    };
    const sideTokens = side => {
      const objs = S.notches.filter(c => c.side === side && c.count()).sort((p, q) => p.d - q.d);
      if (!objs.length) return [{ t: 'blank', v: null, side }];
      const out = [];
      objs.forEach((c, i) => { if (i) out.push({ t: 'op', v: '+', side }); out.push({ t: 'n', v: `${c.sum()}×${c.d}`, side }); });
      return out;
    };
    o.strip = () => sideTokens(-1).concat([{ t: 'sign' }], sideTokens(1));
    o.fixedTap = it => say(`Beban ${it.w}. Tidak bisa dipindah.`);
    o.canRelease = () => movers.every(m => m.c && m.c.isNotch);
    o.cantMsg = 'Taruh semua beban di jungkat-jungkit dulu.';
    o.result = async r => {
      if (r.balanced) { say('Seimbang! Tenaga putarnya sama.'); mood('happy'); o.pause = 2000; await nextRound(); }
      else unbalanced(r, seesawResultMsg(r));
    };
    o.winText = () => cfg.win || 'Hebat! Pengungkitnya seimbang.';
    o.solve = async () => {
      movers.forEach(m => { if (m.c && m.c.isNotch) moveItem(m, m.home); });
      movers.forEach((m, i) => moveItem(m, notch(cur.sol[i].side, cur.sol[i].d)));
      await waitLocked(); await release();
    };
    return o;
  }
  function leverMulti() {
    for (;;) {
      const a = rand(1, 4), b = rand(1, 4), da = rand(1, 4), db = rand(1, 4);
      if (da === db) continue;
      const M = a * da + b * db, opts = [];
      for (let w1 = 1; w1 <= 5; w1++) for (let d1 = 1; d1 <= 4; d1++) for (let w2 = 1; w2 <= 5; w2++) for (let d2 = d1 + 1; d2 <= 4; d2++) if (w1 * d1 + w2 * d2 === M) opts.push([w1, d1, w2, d2]);
      if (!opts.length) continue;
      const [w1, d1, w2, d2] = GS.shuffle(opts)[0];
      return { fixed: [{ w: w1, side: -1, d: d1 }, { w: w2, side: -1, d: d2 }], movers: [{ w: a }, { w: b }], sol: [{ side: 1, d: da }, { side: 1, d: db }], say: 'Taruh dua beban di kanan supaya seimbang.' };
    }
  }
  function leverSlide() {
    for (;;) {
      const w1 = rand(1, 4), d1 = rand(1, 4), w2 = rand(1, 4), d2 = rand(1, 4);
      if (d1 === d2) continue;
      const M = w1 * d1 + w2 * d2, w3 = rand(1, 3), d3 = rand(1, 4), w = rand(1, 4);
      const rem = M - w3 * d3;
      if (rem <= 0 || rem % w) continue;
      const dm = rem / w;
      if (dm < 1 || dm > 4 || dm === d3) continue;
      const free = [1, 2, 3, 4].filter(d => d !== d3 && d !== dm);
      if (!free.length) continue;
      return { fixed: [{ w: w1, side: -1, d: d1 }, { w: w2, side: -1, d: d2 }, { w: w3, side: 1, d: d3 }], movers: [{ w, side: 1, d: GS.shuffle(free)[0] }], sol: [{ side: 1, d: dm }], say: 'Geser satu beban supaya seimbang.' };
    }
  }

  /* ============================== campuran / tantangan ============================== */
  /** A level made of several one-round puzzles of different types (all on the dacing). */
  function Mix(list, win) {
    const own = { __mix: true, rounds: list.length, round: 0, cur: null, winText: () => win };
    function load(i) {
      const sub = list[i]();
      const defs = { predictNow: false, revealed: false, near: true, fade: false };
      for (const k in defs) if (!(k in sub)) sub[k] = defs[k];
      sub.rounds = 1; sub.round = 0;
      own.cur = sub;
    }
    own.setup = r => {
      if (r > 0) {
        [0, 1].forEach(i => { clearPanDecor(i); setPanBins(i, [{ x0: -100, x1: 100, y: 14 }]); renderTag(S.pans[i].tag, null); });
        if (S.strip) S.strip.prev = [];
        load(r);
      }
      own.cur.setup(0);
    };
    load(0);
    return new Proxy(own, {
      get: (t, k) => (k in t ? t[k] : t.cur ? t.cur[k] : undefined),
      set: (t, k, v) => { if (k in t) t[k] = v; else t.cur[k] = v; return true; },
      has: (t, k) => k in t || !!(t.cur && k in t.cur)
    });
  }
  const pick3 = arr => GS.shuffle(arr).slice(0, 3);

  /* ============================== level sets per grade tier (docs/KURIKULUM.md) ============================== */
  function tierLevels(t) {
    const DAC = 'dacing', SEE = 'seesaw';
    // k2 building blocks
    const k2Compose = () => Compose({ rounds: 2, buildSide: 1, gen: () => { const n = rand(21, 99); const [tn, on] = digitsOf(n, [10, 1]); return { target: { kind: 'karung', v: n }, denoms: [10, 1], stock: [9, 9], say: 'Pakai anak timbangan 10 dan 1. Buat seimbang!', ok: `${n} sama dengan ${tn * 10} tambah ${on}!` }; },
      strip: (cur, tot, by) => [{ t: 'n', v: cur.target.v, side: -1 }, { t: 'sign' }].concat(placeTokens([10, 1], by, 1)), win: 'Hebat! Puluhan dan satuan.' });
    const k2Missing = () => Compose({ rounds: 2, buildSide: -1, gen: () => { const n = rand(5, 9) * 10, m = rand(12, n - 12); return { target: { kind: 'weight', v: n }, given: m, denoms: [10, 1], stock: [9, 9], say: `Karung isinya ${m}. Tambah sampai ${n}.`, ok: `${m} tambah ${n - m} sama dengan ${n}!` }; },
      strip: (cur, tot) => [{ t: 'n', v: cur.given, side: -1 }, { t: 'op', v: '+', side: -1 }, { t: tot ? 'n' : 'blank', v: tot || null, side: -1 }, { t: 'sign' }, { t: 'n', v: cur.target.v, side: 1 }], win: 'Hebat! Bilangan hilangnya ketemu.' });
    const k2Bags = () => Bags({ rounds: 3, mode: 'pick', strip: 'add', gen: r => { const g = [2, 5, 10][r % 3]; return { g, k: rand(2, g === 10 ? 4 : 5) }; }, win: 'Hebat! Penjumlahan berulang.' });
    const k2Sub = () => L8({ big: true });
    // k3 building blocks
    const k3Bags = () => Bags({ rounds: 2, mode: 'build', strip: 'mul', gen: () => ({ g: rand(3, 9), k: rand(3, 5) }), win: 'Hebat! Perkalian kelompok sama.' });
    const k3Div = () => Template({ rounds: 2, tside: 1, gen: r => { const k = r ? 4 : 3, sv = rand(2, r ? 4 : 6), n = k * sv; return { k, target: { kind: 'karung', v: n }, items: 'ramb', stock: 8, answer: sv, say: `Bagi ${n} rambutan ke ${k} keranjang sama berat. Isi keranjang biru.`, ok: x => `${n} dibagi ${k} sama dengan ${x}!` }; },
      strip: (cur, sv) => [{ t: 'n', v: cur.target.v, side: -1 }, { t: 'sign' }, { t: 'n', v: cur.k, side: 1 }, { t: 'op', v: '×', side: 1 }, { t: sv ? 'n' : 'blank', v: sv, side: 1 }],
      final: (cur, sv) => [{ t: 'n', v: cur.target.v }, { t: 'op', v: '÷' }, { t: 'n', v: cur.k }, { t: 'sign', v: '=' }, { t: 'n', v: sv }], win: 'Hebat! Pembagian sama rata.' });
    const k3Factor = () => Template({ rounds: 2, tside: -1, gen: () => { const k = rand(3, 4), sv = rand(2, 6), n = k * sv; return { k, target: { kind: 'weight', v: n }, items: 'w', stock: [5, 2, 2, 1, 1], answer: sv, say: `${k} keranjang sama berat. Berapa isi satu keranjang?`, ok: x => `${k} kali ${x} sama dengan ${n}!` }; },
      strip: (cur, sv) => [{ t: 'n', v: cur.k, side: -1 }, { t: 'op', v: '×', side: -1 }, { t: sv ? 'n' : 'blank', v: sv, side: -1 }, { t: 'sign' }, { t: 'n', v: cur.target.v, side: 1 }],
      final: (cur, sv) => [{ t: 'n', v: cur.k }, { t: 'op', v: '×' }, { t: 'n', v: sv }, { t: 'sign', v: '=' }, { t: 'n', v: cur.target.v }], win: 'Hebat! Faktor hilangnya ketemu.' });
    const k3Frac = () => Template({ rounds: 2, tside: 1, gen: r => { const k = r ? 4 : 2, N = rand(2, 6) * 4; return { k, target: { kind: 'karung', v: N, label: N + ' kg' }, items: 'w', stock: [10, 5, 2, 2, 1, 1], answer: N / k, say: r ? `Bagi ${N} kilogram jadi empat sama berat.` : `Bagi ${N} kilogram jadi dua sama berat.`, ok: x => `${r ? 'Seperempat' : 'Setengah'} dari ${N} kilogram adalah ${x} kilogram!` }; },
      strip: (cur, sv) => { const out = [{ t: 'n', v: cur.target.label, side: -1 }, { t: 'sign' }]; for (let i = 0; i < cur.k; i++) { if (i) out.push({ t: 'op', v: '+', side: 1 }); out.push({ t: sv ? 'n' : 'blank', v: sv, side: 1 }); } return out; },
      final: (cur, sv) => [{ t: 'txt', v: (cur.k === 2 ? '½' : '¼') + ' dari' }, { t: 'n', v: cur.target.label }, { t: 'sign', v: '=' }, { t: 'n', v: sv + ' kg' }], win: 'Hebat! Setengah dan seperempat.' });
    const k3Hundreds = () => Compose({ rounds: 2, buildSide: 1, h: 38, gen: () => { const n = rand(101, 999); const [h, tn, on] = digitsOf(n, [100, 10, 1]); return { target: { kind: 'karung', v: n }, denoms: [100, 10, 1], stock: [9, 9, 9], say: 'Pakai anak timbangan 100, 10, dan 1.', ok: `${n} sama dengan ${h * 100} tambah ${tn * 10} tambah ${on}!` }; },
      strip: (cur, tot, by) => [{ t: 'n', v: cur.target.v, side: -1 }, { t: 'sign' }].concat(placeTokens([100, 10, 1], by, 1)), win: 'Hebat! Ratusan, puluhan, satuan.' });
    // k4 building blocks
    const k4Mystery = () => Template({ rounds: 2, tside: -1, decor: 'box', gen: () => { const sv = rand(2, 9), c = rand(1, 9), n = 2 * sv + c; return { k: 2, extra: c, target: { kind: 'weight', v: n }, items: 'w', stock: [5, 2, 2, 1, 1], answer: sv, say: 'Dua kotak misteri sama berat. Isi kotak pertama.', ok: x => `Kotak misteri beratnya ${x}!` }; },
      strip: (cur, sv) => [{ t: sv ? 'n' : 'blank', v: sv, side: -1 }, { t: 'op', v: '+', side: -1 }, { t: sv ? 'n' : 'blank', v: sv, side: -1 }, { t: 'op', v: '+', side: -1 }, { t: 'n', v: cur.extra, side: -1 }, { t: 'sign' }, { t: 'n', v: cur.target.v, side: 1 }],
      final: (cur, sv) => [{ t: 'txt', v: 'kotak' }, { t: 'sign', v: '=' }, { t: 'n', v: sv }], win: 'Hebat! Kotak misterinya terpecahkan.' });
    const k4Kg = () => Compose({ rounds: 2, buildSide: 1, unit: ' g', h: 42, gen: r => { const p = r ? rand(1, 6) * 100 : null; return { target: { kind: 'weight', v: 1000, label: '1 kg' }, given: p, givenLabel: p ? p + ' g' : null, denoms: [500, 200, 100], stock: [1, 3, 3], say: r ? `Karung ${p} gram. Tambah sampai 1 kilogram.` : '1 kilogram. Seimbangkan dengan gram.', ok: '1 kilogram sama dengan seribu gram!' }; },
      strip: (cur, tot) => { const right = cur.given ? [{ t: 'n', v: cur.given + ' g', side: 1 }, { t: 'op', v: '+', side: 1 }] : []; return [{ t: 'n', v: '1 kg', side: -1 }, { t: 'sign' }].concat(right, [{ t: tot ? 'n' : 'blank', v: tot ? fmt(tot) + ' g' : null, side: 1 }]); },
      final: () => [{ t: 'n', v: '1 kg' }, { t: 'sign', v: '=' }, { t: 'n', v: '1.000 g' }], win: '1 kg sama dengan 1.000 g!' });
    const k4Bags = () => Bags({ rounds: 2, mode: 'build', strip: 'mul2', gen: () => { for (;;) { const g = rand(11, 24), k = rand(2, 4); if (g * k <= 96) return { g, k }; } }, win: 'Hebat! Perkalian dua angka.' });
    const k4Thousands = () => Compose({ rounds: 2, buildSide: 1, h: 34, gen: () => { const ds = [rand(1, 5), rand(0, 5), rand(0, 5), rand(0, 5)]; const n = ds[0] * 1000 + ds[1] * 100 + ds[2] * 10 + ds[3]; return { target: { kind: 'karung', v: n }, denoms: [1000, 100, 10, 1], stock: [5, 5, 5, 5], say: 'Pakai anak timbangan 1.000, 100, 10, dan 1.', ok: `${fmt(n)}. Tepat!` }; },
      strip: (cur, tot, by) => [{ t: 'n', v: fmt(cur.target.v), side: -1 }, { t: 'sign' }].concat(placeTokens([1000, 100, 10, 1], by, 1)), win: 'Hebat! Ribuan tersusun.' });

    if (t === 'tk') return [
      { title: 'Berat atau ringan?', mode: DAC, make: () => L1({ pairs: [['kapas', 0.05, 'batu', 1.2], ['bantal', 0.3, 'baut', 0.15]] }) },
      { title: 'Berat atau ringan?', mode: DAC, make: () => L1({ pairs: [['balon', 0.01, 'gembok', 0.4], ['kapas', 0.05, 'gembok', 0.4]] }) },
      { title: 'Sama banyak', mode: DAC, make: () => L2({ a: [2, 3], b: [1, 1], tray: 3, cap: 5, h: 48 }) },
      { title: 'Sama banyak', mode: DAC, make: () => L2({ a: [4, 5], b: [1, 2], tray: 4, cap: 5, h: 48 }) },
      { title: 'Lebih banyak', mode: DAC, make: TKMore },
      { title: 'Jungkat-jungkit', mode: SEE, make: TKSee }
    ];
    if (t === 'k2') return [
      { title: 'Puluhan dan satuan', mode: DAC, make: k2Compose },
      { title: 'Bilangan hilang', mode: DAC, make: k2Missing },
      { title: 'Pengurangan', mode: DAC, make: k2Sub },
      { title: 'Setengah', mode: DAC, make: () => L9({ big: true, n: [6, 20] }) },
      { title: 'Penjumlahan berulang', mode: DAC, make: k2Bags },
      { title: 'Sama dengan', mode: DAC, make: () => L7({ big: true }) },
      { title: 'Jungkat-jungkit', mode: SEE, make: L10 },
      { title: 'Campuran', mode: DAC, make: () => Mix(pick3([k2Compose, k2Missing, k2Sub, k2Bags]), 'Hebat! Campuran selesai.') }
    ];
    if (t === 'k3') return [
      { title: 'Perkalian', mode: DAC, make: k3Bags },
      { title: 'Pembagian', mode: DAC, make: k3Div },
      { title: 'Faktor hilang', mode: DAC, make: k3Factor },
      { title: 'Pecahan berat', mode: DAC, make: k3Frac },
      { title: 'Kakak dan adik', mode: SEE, make: L11 },
      { title: 'Tenaga putar', mode: SEE, make: L12 },
      { title: 'Ratusan', mode: DAC, make: k3Hundreds },
      { title: 'Campuran', mode: DAC, make: () => Mix(pick3([k3Bags, k3Div, k3Factor, k3Hundreds]), 'Hebat! Campuran selesai.') }
    ];
    if (t === 'k4') return [
      { title: 'Kotak misteri', mode: DAC, make: k4Mystery },
      { title: 'Kilogram dan gram', mode: DAC, make: k4Kg },
      { title: 'Pertidaksamaan', mode: DAC, make: Ineq },
      { title: 'Banyak beban', mode: SEE, notches: 4, make: () => Lever({ rounds: 2, gen: leverMulti }) },
      { title: 'Pengungkit', mode: SEE, notches: 4, make: () => Lever({ rounds: 2, gen: leverSlide }) },
      { title: 'Perkalian dua angka', mode: DAC, make: k4Bags },
      { title: 'Ribuan', mode: DAC, make: k4Thousands },
      { title: 'Tantangan', mode: DAC, make: () => Mix(pick3([k4Mystery, k4Kg, k4Bags, k4Thousands]), 'Hebat! Tantangan selesai.') }
    ];
    // k1 (default)
    return [
      { title: 'Mana lebih berat?', mode: DAC, make: () => L1() },
      { title: 'Sama banyak', mode: DAC, make: () => L2() },
      { title: 'Tanda < = >', mode: DAC, make: () => L3({ lo: 5, hi: 20 }) },
      { title: 'Pasangan 10', mode: DAC, make: () => L4({ ns: [10] }) },
      { title: 'Penjumlahan', mode: DAC, make: () => L5({ a: [3, 9], b: [3, 9] }) },
      { title: 'Bilangan hilang', mode: DAC, make: () => L6({ n: [11, 20], m: [5, 10], stock: [5, 5, 2, 2, 1, 1] }) },
      { title: 'Pengurangan', mode: DAC, make: () => L8({ n: [12, 20], m: [5, 11] }) },
      { title: 'Sama dengan', mode: DAC, make: () => L7({ max: 18 }) }
    ];
  }

  /* ============================== debug hook ============================== */
  function waitLocked(ignoreBusy) {
    return new Promise(res => {
      const t0 = performance.now();
      (function poll() { if ((S.locked && (ignoreBusy || !S.busy) && !S.relocking) || performance.now() - t0 > 6000) res(); else setTimeout(poll, 40); })();
    });
  }
  window.__game = {
    go: i => run.go(i),
    count: () => LEVELS.length,
    tier: () => TIER,
    async solve() { await waitLocked(); if (lv && !S.over) await lv.solve(); },
    get state() { return { level: run.current, round: lv && lv.round, busy: S.busy, locked: S.locked, over: S.over, tries: S.tries, angle: sim.th }; }
  };

  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
