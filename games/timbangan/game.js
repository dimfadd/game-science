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
  const SS = { PX: 640, PY: 430, HALF: 430, STEP: 125, MAX: 14 };
  SS.GROUND = Math.round(SS.PY + SS.HALF * Math.sin(SS.MAX * Math.PI / 180) + 12);
  const TRAY = { x: 640, y: 652 };
  const el = GS.el;
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');

  /* ============================== levels (defined below) ============================== */
  const LEVELS = [
    { title: 'Mana lebih berat?', mode: 'dacing', make: L1 },
    { title: 'Sama banyak', mode: 'dacing', make: L2 },
    { title: 'Tanda < = >', mode: 'dacing', make: L3 },
    { title: 'Pasangan bilangan', mode: 'dacing', make: L4 },
    { title: 'Penjumlahan', mode: 'dacing', make: L5 },
    { title: 'Bilangan hilang', mode: 'dacing', make: L6 },
    { title: 'Sama dengan', mode: 'dacing', make: L7 },
    { title: 'Pengurangan', mode: 'dacing', make: L8 },
    { title: 'Setengah', mode: 'dacing', make: L9 },
    { title: 'Jungkat-jungkit', mode: 'seesaw', make: L10 },
    { title: 'Kakak dan adik', mode: 'seesaw', make: L11 },
    { title: 'Tenaga putar', mode: 'seesaw', make: L12 }
  ];

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
    const hw = Math.max(76, it.fw + 18), hh = Math.max(76, it.h + 20);
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
    for (const s of [-1, 1]) {
      el('path', { d: `M${s * (HALF - 24)} -12V-50`, stroke: OL, 'stroke-width': 9, 'stroke-linecap': 'round' }, pg);
      el('path', { d: `M${s * (HALF - 24)} -12V-50`, stroke: C.woodSh, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, pg);
      shape3(pg, rr(s * (HALF - 24) - 14, -60, 28, 12, 6), { base: s < 0 ? C.blue : C.orange, sh: s < 0 ? C.blueSh : C.orangeSh, off: [0, -3], sw: 3 });
    }
    shape3(pg, rr(-HALF, -12, HALF * 2, 24, 11), { base: '#C98B4E', sh: C.wood, hl: '#E0A86E', hlb: [-200, -7, 160, 2.6], off: [0, -5] });
    el('path', { d: `M${-HALF + 20} 2H-30M30 2H${HALF - 20}`, stroke: C.woodSh, 'stroke-width': 2, opacity: 0.4 }, pg);
    S.notches = [];
    for (const s of [-1, 1]) for (let d = 1; d <= 3; d++) {
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
    await simRun({ tgt: 0, k: 26, c: 10, kick: 0 });
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
    const dotRows = parts.reduce((a, k) => a + rowsOf(k), 0);
    const w = Math.max(84, text.length * 17 + 26), h = 48 + dotRows * 14 + (parts.length - 1) * 5;
    el('path', { d: `M0 ${-h / 2}V${-h / 2 - 14}`, stroke: OL, 'stroke-width': 2.4 }, g);
    el('path', { d: rr(-w / 2, -h / 2, w, h, 14), fill: C.cream, stroke: side < 0 ? C.blue : C.orange, 'stroke-width': 4 }, g);
    txt(g, 0, -h / 2 + 22, text, { size: 30 });
    let y = -h / 2 + 46;
    parts.forEach((k, i) => {
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
    const W = t => t.t === 'op' ? 34 : t.t === 'sign' ? 66 : t.t === 'txt' ? t.v.length * 15 + 30 : Math.max(58, String(t.v == null ? '?' : t.v).length * 24 + 30);
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
        txt(g, cx, 1, empty ? '?' : String(t.v), { size: 36, fill: empty ? C.muted : C.ink });
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
    const { PX, STEP } = SS, y0 = 584, rowH = 26;
    const bal = S.last && S.last.balanced;
    [-1, 1].forEach(side => {
      const objs = S.notches.filter(c => c.side === side && c.count()).map(c => ({ w: c.sum(), d: c.d })).sort((a, b) => a.d - b.d);
      const rows = objs.reduce((a, o) => a + o.w, 0);
      const x0 = side < 0 ? PX - 3 * STEP - 40 : PX + 28, x1 = side < 0 ? PX - 28 : PX + 3 * STEP + 40;
      const h = 40 + Math.max(1, rows) * rowH;
      el('path', { d: rr(x0, y0 - 18, x1 - x0, h, 16), fill: C.cream, stroke: OL, 'stroke-width': 3, opacity: 0.94 }, g);
      for (let d = 1; d <= 3; d++) txt(g, PX + side * d * STEP, y0, String(d), { size: 17, fill: C.muted });
      let r = 0;
      objs.forEach(o => {
        const top = y0 + 22 + r * rowH;
        for (let k = 0; k < o.w; k++) {
          const yy = top + k * rowH;
          const xa = PX + side * STEP, xb = PX + side * o.d * STEP;
          el('path', { d: rr(Math.min(xa, xb) - 15, yy - 10, Math.abs(xb - xa) + 30, 20, 10), fill: side < 0 ? C.blueTint : C.orangeTint }, g);
          for (let d = 1; d <= o.d; d++) {
            const x = PX + side * d * STEP;
            if (side < 0) el('circle', { cx: x, cy: yy, r: 9, fill: C.blue, stroke: OL, 'stroke-width': 2 }, g);
            else el('rect', { x: x - 8.5, y: yy - 8.5, width: 17, height: 17, rx: 4, fill: C.orange, stroke: OL, 'stroke-width': 2 }, g);
          }
        }
        txt(g, PX + side * 64, top + (o.w - 1) * rowH / 2, `${o.w}×${o.d}`, { size: 19, fill: C.ink });
        r += o.w;
      });
      const tot = objs.reduce((a, o) => a + o.w * o.d, 0);
      const tx = PX + side * (3 * STEP + 84), ty = y0 + 22;
      el('circle', { cx: tx, cy: ty, r: 30, fill: bal ? C.tealTint : side < 0 ? C.blueTint : C.orangeTint, stroke: bal ? C.teal : side < 0 ? C.blue : C.orange, 'stroke-width': 4 }, g);
      txt(g, tx, ty + 1, String(tot), { size: 32 });
    });
  }

  /* ============================== item factories ============================== */
  const ramb = (o) => Object.assign({ kind: 'rambutan', w: 1, h: 42 }, o || {});
  const marb = (o) => Object.assign({ kind: 'kelereng', w: 1, h: 27 }, o || {});
  const wt = (n, o) => Object.assign({ kind: 'weight', arg: n, w: n, h: 60 }, o || {});
  function karung(n, o) {
    return Object.assign({
      kind: 'karung', w: n, h: 104, fixed: true, labelN: n, labelDots: true,
      decor: it => { it.labelG = el('g', null, it.inner); drawKarungLabel(it); }
    }, o || {});
  }
  function drawKarungLabel(it) {
    const g = it.labelG; g.innerHTML = '';
    const sc = it.sc, cy = (-36 - (it.ab.y + it.ab.height)) * sc; // art label patch centre (y -36 in art units)
    const dots = it.labelDots, n = it.labelN;
    if (dots) {
      el('path', { d: rr(-32, cy - 24, 64, 58, 10), fill: C.cream, stroke: OL, 'stroke-width': 3 }, g);
      txt(g, 0, cy - 7, String(n), { size: 26 });
      dotsAt(g, n, 0, cy + 18, { r: 3.4, gap: 10, fill: OL });
    } else {
      el('path', { d: rr(-26, cy - 20, 52, 40, 10), fill: C.cream, stroke: OL, 'stroke-width': 3 }, g);
      txt(g, 0, cy + 1, String(n), { size: 28 });
    }
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

  /* ============================== dacing level helpers ============================== */
  const pan = i => S.pans[i].c;
  const dirWord = d => d === 'L' ? 'kiri' : 'kanan';
  function setPanBins(i, bins) {
    const c = pan(i);
    c.bins = bins.map(b => Object.assign({ items: [], pack: 0.95, stack: 0.62 }, b));
  }
  function basketDecor(i, centers) {
    const p = S.pans[i];
    p.baskets = centers.map(cx => {
      const bk = el('g', { transform: `translate(${cx} 12)` }, p.back);
      el('ellipse', { cx: 0, cy: -34, rx: 46, ry: 10, fill: '#8A5E2E', stroke: OL, 'stroke-width': 3 }, bk);
      const fr = el('g', { transform: `translate(${cx} 12)` }, p.front);
      shape3(fr, 'M-47 -34L47 -34L40 -3Q38 3 32 3L-32 3Q-38 3 -40 -3Z', { base: C.bamboo, sh: C.bambooSh, hl: C.bambooHl, hlb: [-30, -28, 14, 3], off: [-5, -4], sw: 3.5,
        extra: g => { for (let y = -28; y < 2; y += 7) el('path', { d: `M-46 ${y}H46`, stroke: '#9A6E36', 'stroke-width': 1.4, opacity: 0.6 }, g); } });
      el('path', { d: rr(-49, -39, 98, 10, 5), fill: C.bambooSh, stroke: OL, 'stroke-width': 3 }, fr);
      const lab = el('g', null, fr);
      return { lab };
    });
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

  /* ============================== LEVEL 1: Mana lebih berat? ============================== */
  function L1() {
    const pairs = [['kapas', 0.05, 'batu', 1.2], ['balon', 0.01, 'gembok', 0.4], ['bantal', 0.3, 'baut', 0.15]];
    const size = { kapas: 104, batu: 46, balon: 132, gembok: 52, bantal: 80, baut: 50 };
    let cur = null;
    const o = { rounds: 3, predictNow: true, near: false, pause: 2400, noTray: true };
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
      say((ok ? 'Tebakanmu benar! ' : 'Ternyata ') + `${label(heavy.kind)} lebih berat` + (small ? ', padahal kecil.' : '.'));
      await nextRound();
    };
    o.winText = () => 'Kecil belum tentu ringan!';
    o.solve = async () => { const r = evaluate(); pickPrediction(r.dir); await release(); };
    return o;
  }

  /* ============================== LEVEL 2: Sama banyak ============================== */
  function L2() {
    const o = { rounds: 1 };
    let a, b;
    o.setup = () => {
      a = rand(4, 6); b = rand(1, 3);
      setPanBins(0, [{ x0: -100, x1: 100, y: 14, cap: 10 }]);
      setPanBins(1, [{ x0: -100, x1: 100, y: 14, cap: 10 }]);
      spawn(Array.from({ length: a }, () => ramb()), pan(0));
      spawn(Array.from({ length: b }, () => ramb()), pan(1), { delay: 200 });
      spawn(Array.from({ length: 5 }, () => ramb()), S.tray, { delay: 400 });
      say('Buat timbangan seimbang, ya!');
    };
    o.fullMsg = 'Piringnya sudah penuh.';
    o.result = async r => { if (r.balanced) { say('Seimbang! Sama banyak.'); finish('Seimbang! Sama banyak.'); } else unbalanced(r); };
    o.solve = async () => {
      const Lc = pan(0).count(), Rc = pan(1).count();
      if (Rc < Lc) S.tray.items().slice(0, Lc - Rc).forEach(it => moveItem(it, pan(1)));
      else if (Rc > Lc) pan(1).items().slice(0, Rc - Lc).forEach(it => moveItem(it, S.tray));
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL 3: Tanda < = > ============================== */
  function L3() {
    const MAP = { '>': 'L', '=': 'B', '<': 'R' };
    const kinds = GS.shuffle(['gt', 'lt', 'eq']);
    let a, b, cards = [];
    const o = { rounds: 3, predictNow: true, near: false, pause: 2000 };
    // sign slot on the post
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
      if (k === 'eq') { a = b = rand(5, 10); }
      else { const hi = rand(6, 10), lo = rand(5, hi - 1); a = k === 'gt' ? hi : lo; b = k === 'gt' ? lo : hi; }
      setPanBins(0, [{ x0: -100, x1: 100, y: 14 }]); setPanBins(1, [{ x0: -100, x1: 100, y: 14 }]);
      spawn(Array.from({ length: a }, () => ramb({ fixed: true })), pan(0));
      spawn(Array.from({ length: b }, () => ramb({ fixed: true })), pan(1), { delay: 200 });
      if (!cards.length) cards = spawn(['<', '=', '>'].map(signCard), S.tray, { delay: 400 });
      else cards.forEach(cd => { if (cd.c !== S.tray) moveItem(cd, S.tray); });
      o.predictNow = true; S.pred = null;
      say(r === 0 ? 'Taruh tanda yang cocok, lalu Lepas!' : 'Tanda mana yang cocok?');
    };
    o.fixedTap = it => say(it.c === pan(0) ? `Kiri ada ${a}.` : `Kanan ada ${b}.`);
    o.onPredict = d => {
      const glyph = Object.keys(MAP).find(k => MAP[k] === d);
      const cd = cards.find(x => x.glyph === glyph);
      S.pred = null; // set by placed()
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

  /* ============================== LEVEL 4: Pasangan bilangan ============================== */
  function L4() {
    const o = { rounds: 2, near: true };
    let n = 6, found = [], kar = null;
    // collection rack
    const rack = el('g', { transform: 'translate(1072 128)' }, S.layers.ui);
    shape3(rack, rr(0, 0, 192, 300, 18), { base: C.wood, sh: C.woodSh, hl: C.woodHl, hlb: [30, 10, 30, 4], off: [-5, -5] });
    el('path', { d: rr(10, 10, 172, 280, 12), fill: '#F6E9D2', stroke: OL, 'stroke-width': 2.4 }, rack);
    const cols = [6, 10].map((k, ci) => {
      const cx = 52 + ci * 88;
      el('path', { d: rr(cx - 34, 20, 68, 36, 10), fill: '#E8D3A6', stroke: OL, 'stroke-width': 2.6 }, rack);
      txt(rack, cx, 39, String(k), { size: 26 });
      const slots = [0, 1, 2].map(j => {
        const y = 92 + j * 66;
        el('path', { d: rr(cx - 38, y - 24, 76, 48, 12), fill: 'none', stroke: C.muted, 'stroke-width': 2.4, 'stroke-dasharray': '6 5' }, rack);
        return { x: cx, y, g: el('g', null, rack) };
      });
      return slots;
    });
    o.setup = r => {
      n = r === 0 ? 6 : 10; found = [];
      setPanBins(0, [{ x0: -100, x1: 100, y: 14 }]);
      if (r === 0) {
        setPanBins(1, [{ x0: -100, x1: -10, y: -6, cap: 10, stack: 0.5, pack: 0.78 }, { x0: 10, x1: 100, y: -6, cap: 10, stack: 0.5, pack: 0.78 }]);
        S.pans[1].back.innerHTML = ''; S.pans[1].front.innerHTML = '';
        basketDecor(1, [-55, 55]);
      }
      kar = spawn([karung(n)], pan(0))[0];
      spawn(Array.from({ length: r === 0 ? 6 : 4 }, () => ramb({ keep: true, h: 38 })), S.tray, { delay: 250 });
      say(r === 0 ? 'Isi dua keranjang sampai seimbang.' : 'Karungnya sekarang 10. Cari 3 pasangan!');
    };
    o.changed = () => {
      const bs = S.pans[1].baskets; if (!bs) return;
      pan(1).bins.forEach((b, i) => {
        const g = bs[i].lab; g.innerHTML = '';
        el('path', { d: rr(-18, -27, 36, 26, 7), fill: C.cream, stroke: OL, 'stroke-width': 2.6 }, g);
        txt(g, 0, -13.5, String(b.items.length), { size: 21 });
      });
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
        if (o.round === 0) {
          say('Tiga pasangan! Sekarang karungnya 10.');
          o.round++;
          await sweep(it => it === kar);
          await relock();
          S.roundFails = 0; roundPips(); o.setup(1); refresh();
        } else finish('Hebat! Banyak cara membuat 6 dan 10.');
      } else { await wait(1300); say('Cari pasangan lain!'); relock(); }
    };
    o.solve = async () => {
      let x = 1; while (x < n && (found.indexOf([x, n - x].sort((p, q) => p - q).join('+')) >= 0)) x++;
      const bins = pan(1).bins, want = [x, n - x];
      // move extras out first, then fill
      for (let i = 0; i < 2; i++) while (bins[i].items.length > want[i]) moveItem(bins[i].items[bins[i].items.length - 1], S.tray);
      for (let i = 0; i < 2; i++) while (bins[i].items.length < want[i]) moveItem(S.tray.items()[0], pan(1), bins[i]);
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL 5: Penjumlahan ============================== */
  function L5() {
    const o = { rounds: 2 };
    let a, b, s;
    o.setup = () => {
      a = rand(2, 6); b = rand(2, 6); s = a + b;
      setPanBins(0, [{ x0: -104, x1: -6, y: 14 }, { x0: 6, x1: 104, y: 14 }]);
      setPanBins(1, [{ x0: -60, x1: 60, y: 14, cap: 1, swap: true, accept: it => it.kind === 'weight' }]);
      spawn(Array.from({ length: a }, () => ramb({ fixed: true, bin: 0 })), pan(0));
      spawn(Array.from({ length: b }, () => ramb({ fixed: true, bin: 1 })), pan(0), { delay: 150 });
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

  /* ============================== LEVEL 6: Bilangan hilang ============================== */
  function L6() {
    const o = { rounds: 2, fade: true };
    let n, m, kar;
    o.setup = () => {
      m = rand(5, 8); n = rand(Math.max(10, m + 2), 15);
      setPanBins(0, [{ x0: -60, x1: 60, y: 14 }]);
      setPanBins(1, [{ x0: -104, x1: -20, y: 14, accept: it => it.kind === 'karung' }, { x0: -8, x1: 104, y: 14, cap: 6, stack: 0.7, accept: it => it.kind === 'weight' }]);
      S.pans[1].back.innerHTML = '';
      slotOutline(1, 48, 104);
      spawn([wt(n, { fixed: true, h: 66 })], pan(0));
      kar = spawn([karung(m, { labelDots: false, bin: 0 })], pan(1), { delay: 150 })[0];
      spawn([5, 2, 2, 1, 1].map(k => wt(k)), S.tray, { delay: 300 });
      say('Karung tidak bisa dibuka. Tambah anak timbangan sampai seimbang.');
    };
    o.changed = () => { if (kar && kar.labelDots !== S.roundFails >= 2) { kar.labelDots = S.roundFails >= 2; drawKarungLabel(kar); } };
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
      let need = n - m;
      for (const k of [5, 2, 2, 1, 1]) {
        if (k > need) continue;
        const it = S.tray.items().find(x => x.w === k);
        if (it) { moveItem(it, pan(1), pan(1).bins[1]); need -= k; }
      }
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL 7: Sama dengan itu hubungan ============================== */
  function L7() {
    const o = { rounds: 3, fade: true };
    let a, b, c, x, sent = null;
    const truth = GS.shuffle([true, false]);
    o.setup = r => {
      setPanBins(0, [{ x0: -100, x1: 100, y: 14 }]);
      S.pans[1].back.innerHTML = '';
      if (r === 0) {
        o.predictNow = false;
        do { a = rand(2, 6); b = rand(2, 6); } while (a + b > 10);
        c = rand(1, a + b - 2); x = a + b - c;
        setPanBins(1, [{ x0: -104, x1: -6, y: 14, cap: 1, swap: true, accept: it => !it.fixed }, { x0: 6, x1: 104, y: 14, accept: it => it.fixed }]);
        slotOutline(1, -55, 90);
        spawn([wt(a, { fixed: true }), wt(b, { fixed: true })], pan(0));
        spawn([wt(c, { fixed: true, bin: 1 })], pan(1), { delay: 150 });
        const opts = [x, a + b, x + 1, x > 1 ? x - 1 : x + 2];
        spawn(GS.shuffle(opts.filter((v, i) => opts.indexOf(v) === i)).map(k => wt(k)), S.tray, { delay: 300 });
        say('Sama dengan artinya sama berat. Isi yang kosong!');
      } else {
        o.predictNow = true; S.pred = null;
        const t = rand(6, 10), d = rand(2, t - 2), f0 = GS.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(v => v < t && v !== d && v !== t - d))[0];
        const isTrue = truth[r - 1];
        let g = t - f0;
        if (!isTrue) g = g > 1 && Math.random() < 0.5 ? g - 1 : g + 1;
        sent = { d, e: t - d, f: f0, g, isTrue };
        setPanBins(1, [{ x0: -100, x1: 100, y: 14 }]);
        spawn([wt(sent.d, { fixed: true }), wt(sent.e, { fixed: true })], pan(0));
        spawn([wt(sent.f, { fixed: true }), wt(sent.g, { fixed: true })], pan(1), { delay: 150 });
        say('Seimbang atau tidak? Tebak dulu!');
      }
    };
    o.accept = (it, cc) => !(cc.isPan && cc.side < 0);
    o.fixedTap = it => say(`Ini ${it.w}.`);
    const slotW = () => { const it = pan(1).bins[0].items[0]; return it && !it.fixed ? it.w : null; };
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
        const L = sent.d + sent.e, R = sent.f + sent.g;
        say((ok ? 'Benar! ' : 'Lihat! ') + (L === R ? `${sent.d} + ${sent.e} sama dengan ${sent.f} + ${sent.g}.` : `${sent.d} + ${sent.e} ${outcomeWord(L, R)} ${sent.f} + ${sent.g}.`));
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

  /* ============================== LEVEL 8: Pengurangan ============================== */
  function L8() {
    const o = { rounds: 2, fade: true };
    let n, m;
    o.setup = () => {
      n = rand(11, 15); m = rand(6, 9);
      setPanBins(0, [{ x0: -100, x1: 100, y: 14, cap: 15 }]);
      setPanBins(1, [{ x0: -60, x1: 60, y: 14 }]);
      spawn(Array.from({ length: n }, () => ramb()), pan(0));
      spawn([wt(m, { fixed: true, h: 64 })], pan(1), { delay: 250 });
      say('Ambil rambutan dari kiri sampai seimbang.');
    };
    o.accept = (it, c) => !(c.isPan && c.side > 0);
    o.fixedTap = () => say(`Ini anak timbangan ${m}.`);
    const taken = () => n - pan(0).count();
    o.strip = () => [{ t: 'n', v: n, side: -1 }, { t: 'op', v: '−', side: -1 }, { t: 'blank', v: taken() > 0 ? taken() : null, side: -1 }, { t: 'sign' }, { t: 'n', v: m, side: 1 }];
    o.result = async r => {
      if (r.balanced) { say(`${n} kurang ${n - m} sama dengan ${m}!`); mood('happy'); o.pause = 1800; await nextRound(); }
      else unbalanced(r, r.dir === 'L' ? 'Kiri masih lebih berat. Ambil lagi.' : 'Kiri jadi terlalu ringan. Kembalikan satu.');
    };
    o.winText = () => 'Hebat! Kamu bisa mengurangi.';
    o.solve = async () => {
      const need = n - m - taken();
      if (need > 0) pan(0).items().slice(-need).forEach(it => moveItem(it, S.tray));
      else if (need < 0) S.tray.items().slice(0, -need).forEach(it => moveItem(it, pan(0)));
      await waitLocked(); await release();
    };
    return o;
  }

  /* ============================== LEVEL 9: Setengah ============================== */
  function L9() {
    const o = { rounds: 1, fade: true };
    let n;
    o.setup = () => {
      n = rand(5, 8);
      [0, 1].forEach(i => { setPanBins(i, [{ x0: -78, x1: 78, y: -2, stack: 0.55 }]); S.pans[i].back.innerHTML = ''; S.pans[i].front.innerHTML = ''; sackDecor(i); });
      spawn(Array.from({ length: 2 * n }, () => marb()), S.tray);
      say(`Bagi ${2 * n} kelereng ke dua kantong, sama banyak.`);
    };
    o.strip = () => [{ t: 'n', v: 2 * n }, { t: 'sign', v: '=' }, { t: 'blank', v: pan(0).count() || null, side: -1 }, { t: 'op', v: '+' }, { t: 'blank', v: pan(1).count() || null, side: 1 }];
    o.canRelease = () => pan(0).count() + pan(1).count() > 0;
    o.cantMsg = 'Masukkan kelereng ke kantong dulu.';
    o.result = async r => {
      if (r.balanced && S.tray.count() === 0) {
        say(`Setengah dari ${2 * n} adalah ${n}!`);
        o.strip = () => [{ t: 'txt', v: `Setengah dari ${2 * n} adalah` }, { t: 'n', v: n }];
        S.strip && (S.strip.prev = []);
        renderStripNow();
        finish(`Setengah dari ${2 * n} adalah ${n}!`);
      } else if (r.balanced) say('Seimbang! Tapi masih ada kelereng di nampan.');
      else unbalanced(r);
    };
    o.solve = async () => {
      S.tray.items().forEach(it => moveItem(it, pan(0).count() < n ? pan(0) : pan(1)));
      while (pan(0).count() > n) moveItem(pan(0).items()[0], pan(1));
      while (pan(1).count() > n) moveItem(pan(1).items()[0], pan(0));
      await waitLocked(); await release();
    };
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

  /* ============================== debug hook ============================== */
  function waitLocked() {
    return new Promise(res => {
      const t0 = performance.now();
      (function poll() { if ((S.locked && !S.busy && !S.relocking) || performance.now() - t0 > 6000) res(); else setTimeout(poll, 40); })();
    });
  }
  window.__game = {
    go: i => run.go(i),
    async solve() { await waitLocked(); if (lv && !S.over) await lv.solve(); },
    get state() { return { level: run.current, round: lv && lv.round, busy: S.busy, locked: S.locked, over: S.over, tries: S.tries, angle: sim.th }; }
  };

  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
