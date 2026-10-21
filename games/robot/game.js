/* Chuppy Jalan-jalan (robot)
 * Position, direction, maps and algorithmic thinking with the robot Chuppy.
 * A top-down grid map of the kampung. The child builds a PROGRAM from big cards in a strip
 * (tap a palette card to add it, tap a placed card to take one step off / remove it, the gap
 * waits for the next card), then presses "Jalan!". Chuppy runs the program truthfully, card by
 * card, step by step, with the running card lit:
 *   - he only moves where a card sends him; a stone, tree, water, building or the map fence
 *     stops him on the square before it (he bumps, the card that sent him there stays lit amber);
 *   - a battery (some levels) holds exactly N steps; a step beyond it is not taken;
 *   - the program must END on the target, with every item picked up and every stop visited in order.
 * Nothing is rounded or helped: the result is the program's own trace (sim()), then it is animated.
 * Card families: screen arrows (TK: one card = one square; k1+: tap again = +1, the card shows the
 * number), compass letters U T S B (map north from the compass rose, which can point anywhere),
 * relative "maju n / belok kiri / belok kanan" (from Chuppy's own facing), "putar kanan 90/180/270
 * derajat", the "ulangi" box (repeat the box N times) and the star card (a procedure: the box is
 * defined once and used wherever the star card is placed).
 * Stars: 3 = the first run reaches the target, 2 = after 1 to 2 failed runs, 1 = more. Running a
 * ready-made program unchanged in a "perbaiki" level (to see the bug) does not count.
 * Every map is drawn from Math.random when the level is built (race seeding), visuals use
 * GS.fxRandom. Spec: docs/baru/robot.md (KURIKULUM section). */
(function () {
  'use strict';
  const GAME = 'robot';
  const TIER = (window.GS && GS.tier) ? GS.tier() : 'k1';
  const TK = TIER === 'tk';
  const TIER_I = Math.max(0, ['tk', 'k1', 'k2', 'k3', 'k4'].indexOf(TIER));
  const OL = '#3B2A20', INK = '#2B1D14', CREAM = '#FFF8EC';
  let SPEED = 1;
  const wait = ms => GS.wait(ms / SPEED);
  const tween = (d, fn, e) => GS.tween(d / SPEED, fn, e);
  const n1 = v => Math.round(v * 10) / 10;
  const vrand = () => (GS.fxRandom ? GS.fxRandom() : Math.random());

  /* ================= directions and cards ================= */
  // 0 up (north on an unrotated map), 1 right, 2 down, 3 left
  const DC = [0, 1, 0, -1], DR = [-1, 0, 1, 0];
  const ABS = ['U', 'R', 'D', 'L'], CMP = ['N', 'E', 'S', 'W'];
  const ABS_WORD = ['atas', 'kanan', 'bawah', 'kiri'];
  const CMP_WORD = ['utara', 'timur', 'selatan', 'barat'];
  const CT = {
    U: { fam: 'abs', dir: 0, name: 'atas' }, R: { fam: 'abs', dir: 1, name: 'kanan' }, D: { fam: 'abs', dir: 2, name: 'bawah' }, L: { fam: 'abs', dir: 3, name: 'kiri' },
    N: { fam: 'cmp', k: 0, label: 'U', name: 'utara' }, E: { fam: 'cmp', k: 1, label: 'T', name: 'timur' }, S: { fam: 'cmp', k: 2, label: 'S', name: 'selatan' }, W: { fam: 'cmp', k: 3, label: 'B', name: 'barat' },
    F: { fam: 'fwd', name: 'maju' },
    TL: { fam: 'turn', d: 3, label: 'kiri', name: 'belok kiri' }, TR: { fam: 'turn', d: 1, label: 'kanan', name: 'belok kanan' },
    R90: { fam: 'turn', d: 1, label: '90°', name: 'putar 90 derajat' }, R180: { fam: 'turn', d: 2, label: '180°', name: 'putar 180 derajat' }, R270: { fam: 'turn', d: 3, label: '270°', name: 'putar 270 derajat' },
    LOOP: { fam: 'loop', name: 'ulangi' }, PROC: { fam: 'proc', name: 'kartu bintang' }, DEL: { fam: 'del', name: 'hapus' }
  };
  const isMove = t => { const f = CT[t] && CT[t].fam; return f === 'abs' || f === 'cmp' || f === 'fwd'; };
  const isCall = t => t === 'LOOP' || t === 'PROC';
  const PALETTE = {
    step: ['L', 'U', 'R', 'DEL', 'D'],
    abs: ['L', 'U', 'R', 'DEL', 'D'],
    cmp: ['N', 'E', 'S', 'W'],
    rel: ['F', 'TL', 'TR'],
    deg: ['F', 'R90', 'R180', 'R270']
  };

  /* ================= random helpers ================= */
  function mkR(rand) {
    const R = { f: rand };
    R.int = (a, b) => a + Math.floor(rand() * (b - a + 1));
    R.pick = a => a[Math.floor(rand() * a.length)];
    R.chance = p => rand() < p;
    R.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    return R;
  }
  function seeded(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

  /* ================= the map ================= */
  const WALK = { stone: false, tree: false, water: false, sawah: false, pond: false, bridge: true, masjid: false, warung: false, beringin: false,
    sekolah: false, pasar: false, puskesmas: false, rumah: false };
  const BLOCK_NAME = { stone: 'batu', tree: 'pohon', water: 'sungai', sawah: 'sawah', pond: 'kolam', masjid: 'masjid', warung: 'warung', beringin: 'pohon beringin',
    sekolah: 'sekolah', pasar: 'pasar', puskesmas: 'puskesmas', rumah: 'rumah', pagar: 'pagar' };
  const PLACE_NAME = { masjid: 'masjid', warung: 'warung', beringin: 'pohon beringin', sekolah: 'sekolah', pasar: 'pasar', puskesmas: 'puskesmas', rumah: 'rumah', kolam: 'kolam' };
  const ITEM_NAME = { mangga: 'mangga', jeruk: 'jeruk', apel: 'apel', pisang: 'pisang', rambutan: 'rambutan', salak: 'salak', flag: 'bendera' };
  const HOUSE_COLORS = [['#E2453C', 'merah'], ['#2F80C9', 'biru'], ['#4DAA57', 'hijau'], ['#FFC83D', 'kuning'], ['#F59AB0', 'jambu']];
  const LETTERS = 'ABCDEFGH';
  const key = (c, r) => c + ',' + r;
  const newMap = (cols, rows) => ({ cols, rows, cell: {}, items: [], seq: [], dots: [], foot: [], start: null, goal: null, battery: null, gk: 'rumah' });
  const inb = (M, c, r) => c >= 0 && r >= 0 && c < M.cols && r < M.rows;
  const cellAt = (M, c, r) => M.cell[key(c, r)];
  const canWalk = (M, c, r) => { if (!inb(M, c, r)) return false; const x = cellAt(M, c, r); return !x || x.walk; };
  const same = (p, c, r) => !!p && p.c === c && p.r === r;
  function taken(M, c, r) {
    return !!cellAt(M, c, r) || same(M.start, c, r) || same(M.goal, c, r) || M.items.some(p => same(p, c, r)) || M.seq.some(p => same(p, c, r));
  }
  function put(M, c, r, k, o) { M.cell[key(c, r)] = Object.assign({ k, walk: !!WALK[k] }, o || {}); }
  function freeCells(M, avoid) {
    const out = [];
    for (let r = 0; r < M.rows; r++) for (let c = 0; c < M.cols; c++) if (!taken(M, c, r) && !(avoid && avoid.has(key(c, r)))) out.push([c, r]);
    return out;
  }
  function scatter(M, R, n, kinds, avoid) {
    const f = R.shuffle(freeCells(M, avoid));
    for (let i = 0; i < n && i < f.length; i++) put(M, f[i][0], f[i][1], R.pick(kinds));
  }
  const manh = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
  /** Cells of both L-shaped routes between two points (kept free so the simple plan works). */
  function lRoutes(a, b) {
    const s = new Set();
    const sx = Math.sign(b.c - a.c), sy = Math.sign(b.r - a.r);
    for (let c = a.c; c !== b.c + sx || (sx === 0 && c === a.c); c += sx || 1) { s.add(key(c, a.r)); s.add(key(c, b.r)); if (!sx) break; }
    for (let r = a.r; r !== b.r + sy || (sy === 0 && r === a.r); r += sy || 1) { s.add(key(a.c, r)); s.add(key(b.c, r)); if (!sy) break; }
    return s;
  }
  function advance(M, c, r, si, m) {
    if (si < M.seq.length && M.seq[si].c === c && M.seq[si].r === r) si++;
    for (let i = 0; i < M.items.length; i++) if (M.items[i].c === c && M.items[i].r === r) m |= 1 << i;
    return [si, m];
  }
  const doneAt = (M, c, r, si, m) => same(M.goal, c, r) && si === M.seq.length && m === (1 << M.items.length) - 1;

  /** Shortest route in steps (fewest turns among those) through the stops and items. Returns directions. */
  function route(M) {
    const heap = [];
    const push = x => { heap.push(x); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } }
      return top;
    };
    const [si0, m0] = advance(M, M.start.c, M.start.r, 0, 0);
    const sk = s => s.join('|');
    const s0 = [M.start.c, M.start.r, M.start.f, si0, m0];
    const dist = new Map([[sk(s0), 0]]), prev = new Map();
    push([0, s0]);
    while (heap.length) {
      const [d, s] = pop();
      const k = sk(s);
      if (d > dist.get(k)) continue;
      if (doneAt(M, s[0], s[1], s[3], s[4])) {
        const dirs = []; let cur = k;
        while (prev.has(cur)) { const [pk, dir] = prev.get(cur); dirs.push(dir); cur = pk; }
        return dirs.reverse();
      }
      for (let dir = 0; dir < 4; dir++) {
        const c = s[0] + DC[dir], r = s[1] + DR[dir];
        if (!canWalk(M, c, r)) continue;
        const turn = dir === s[2] ? 0 : (dir + 2) % 4 === s[2] ? 2 : 1;
        const [si, m] = advance(M, c, r, s[3], s[4]);
        const ns = [c, r, dir, si, m], nk = sk(ns), nd = d + 100 + turn;
        if (!dist.has(nk) || nd < dist.get(nk)) { dist.set(nk, nd); prev.set(nk, [k, dir]); push([nd, ns]); }
      }
    }
    return null;
  }
  /** Fewest cards that reach the target WITHOUT the ulangi box or the star card (BFS over programs). */
  function minCards(M, set, limit) {
    limit = limit || 9;
    const facing = set === 'rel' || set === 'deg';
    const [si0, m0] = advance(M, M.start.c, M.start.r, 0, 0);
    const q = [[M.start.c, M.start.r, facing ? M.start.f : 0, si0, m0, 0]];
    const seen = new Set([q[0].slice(0, 5).join('|')]);
    const add = (s, d) => { const k = s.join('|'); if (seen.has(k)) return; seen.add(k); q.push(s.concat(d)); };
    for (let qi = 0; qi < q.length; qi++) {
      const [c0, r0, f, si, m, d] = q[qi];
      if (doneAt(M, c0, r0, si, m)) return d;
      if (d >= limit) continue;
      const runs = set === 'step' ? [0, 1, 2, 3].map(x => [x, 1]) : set === 'abs' || set === 'cmp' ? [0, 1, 2, 3].map(x => [x, 99]) : [[f, 99]];
      runs.forEach(([dir, maxN]) => {
        let c = c0, r = r0, a = si, b = m;
        for (let n = 1; n <= maxN; n++) {
          c += DC[dir]; r += DR[dir];
          if (!canWalk(M, c, r)) break;
          [a, b] = advance(M, c, r, a, b);
          add([c, r, f, a, b], d + 1);
        }
      });
      if (set === 'rel') { add([c0, r0, (f + 1) % 4, si, m], d + 1); add([c0, r0, (f + 3) % 4, si, m], d + 1); }
      if (set === 'deg') for (let t = 1; t < 4; t++) add([c0, r0, (f + t) % 4, si, m], d + 1);
    }
    return Infinity;
  }
  function bfsDist(M, a, b) {
    const q = [[a.c, a.r, 0]], seen = new Set([key(a.c, a.r)]);
    for (let i = 0; i < q.length; i++) {
      const [c, r, d] = q[i];
      if (c === b.c && r === b.r) return d;
      for (let k = 0; k < 4; k++) { const nc = c + DC[k], nr = r + DR[k]; if (canWalk(M, nc, nr) && !seen.has(key(nc, nr))) { seen.add(key(nc, nr)); q.push([nc, nr, d + 1]); } }
    }
    return -1;
  }
  /** Directions -> cards of a family. f0 = start facing, north = screen direction of map north. */
  function toCards(dirs, set, f0, north) {
    const runs = [];
    dirs.forEach(d => { if (runs.length && runs[runs.length - 1].d === d) runs[runs.length - 1].n++; else runs.push({ d, n: 1 }); });
    const out = [];
    let f = f0;
    runs.forEach(({ d, n }) => {
      if (set === 'step') { for (let k = 0; k < n; k++) out.push({ t: ABS[d], n: 1 }); return; }
      if (set === 'abs') { out.push({ t: ABS[d], n }); return; }
      if (set === 'cmp') { out.push({ t: CMP[(d - north + 4) % 4], n }); return; }
      const delta = (d - f + 4) % 4;
      if (set === 'rel') { if (delta === 1) out.push({ t: 'TR', n: 1 }); if (delta === 3) out.push({ t: 'TL', n: 1 }); if (delta === 2) out.push({ t: 'TR', n: 1 }, { t: 'TR', n: 1 }); }
      if (set === 'deg' && delta) out.push({ t: ['', 'R90', 'R180', 'R270'][delta], n: 1 });
      out.push({ t: 'F', n });
      f = d;
    });
    return out;
  }
  const cardFor = (d, set, north) => (set === 'cmp' ? CMP[(d - (north || 0) + 4) % 4] : ABS[d]);
  const cloneCards = a => a.map(c => ({ t: c.t, n: c.n || 1 }));
  const sameCards = (a, b) => a.length === b.length && a.every((c, i) => c.t === b[i].t && (c.n || 1) === (b[i].n || 1));
  const usesBox = P => P.main.some(c => isCall(c.t));
  const cardCount = P => P.main.length + (usesBox(P) ? P.box.length : 0);
  function stepsOf(P) {
    let s = 0;
    P.main.forEach(c => { if (isMove(c.t)) s += c.n || 1; else if (isCall(c.t)) { const reps = c.t === 'LOOP' ? P.count : 1; P.box.forEach(b => { if (isMove(b.t)) s += reps * (b.n || 1); }); } });
    return s;
  }

  /** Run a program truthfully. Returns the full trace; the animation only replays it. */
  function sim(M, P, north) {
    const ev = [];
    let c = M.start.c, r = M.start.r, f = M.start.f, used = 0, stop = null, visitedGoal = false;
    let [si, mask] = advance(M, c, r, 0, 0);
    const runCard = (cd, src) => {
      const d = CT[cd.t];
      if (d.fam === 'turn') { f = (f + d.d) % 4; ev.push({ e: 'turn', f, src }); return true; }
      if (!isMove(cd.t)) return true;
      const dir = d.fam === 'abs' ? d.dir : d.fam === 'cmp' ? ((north || 0) + d.k) % 4 : f;
      if (dir !== f) { f = dir; ev.push({ e: 'face', f, src }); }
      const n = cd.n || 1;
      for (let s = 0; s < n; s++) {
        const nc = c + DC[dir], nr = r + DR[dir];
        if (!inb(M, nc, nr)) { ev.push({ e: 'bump', c: nc, r: nr, kind: 'pagar', src, s }); stop = 'bump'; return false; }
        const x = cellAt(M, nc, nr);
        if (x && !x.walk) { ev.push({ e: 'bump', c: nc, r: nr, kind: x.k, src, s }); stop = 'bump'; return false; }
        if (M.battery != null && used >= M.battery) { ev.push({ e: 'battery', src, s }); stop = 'battery'; return false; }
        if (same(M.goal, c, r) && used > 0) visitedGoal = true;
        c = nc; r = nr; used++;
        ev.push({ e: 'move', c, r, f, src, s, used });
        if (si < M.seq.length && M.seq[si].c === c && M.seq[si].r === r) { ev.push({ e: 'seq', i: si }); si++; }
        M.items.forEach((it, i) => { if (!(mask >> i & 1) && it.c === c && it.r === r) { mask |= 1 << i; ev.push({ e: 'item', i }); } });
      }
      return true;
    };
    outer: for (let i = 0; i < P.main.length; i++) {
      const cd = P.main[i];
      if (isCall(cd.t)) {
        const reps = cd.t === 'LOOP' ? P.count : 1;
        for (let k = 0; k < reps; k++) {
          ev.push({ e: 'iter', k, reps, src: { row: 'main', i } });
          for (let j = 0; j < P.box.length; j++) if (!runCard(P.box[j], { row: 'box', i: j, outer: i, k })) break outer;
        }
      } else if (!runCard(cd, { row: 'main', i })) break;
    }
    const ok = !stop && doneAt(M, c, r, si, mask);
    return { ev, ok, stop, end: { c, r, f }, si, mask, used, visitedGoal };
  }

  /* ================= level generators (docs/baru/robot.md) =================
   * Each takes R (random helper) and returns a level or null (then it is drawn again).
   * A level: { M (map), set (card family), numbered, maxMain, box, preset, north, labels, lattice,
   *   style, info, sign, say (spoken task), think (worked-example lines), sol (a correct program) }. */
  function level(o) {
    const L = Object.assign({ lattice: false, style: 'kampung', labels: null, north: 0, set: 'abs', numbered: !TK, maxMain: 7, box: null, preset: null,
      scale: null, info: [], sign: null, facing: false, say: '', think: [], bonus: null }, o);
    L.cols = L.M.cols; L.rows = L.M.rows;
    if (L.set === 'step') L.numbered = false;
    if (L.set === 'rel' || L.set === 'deg') L.facing = true;
    if (!L.sol) {
      const d = route(L.M);
      if (!d) return null;
      L.sol = { main: toCards(d, L.set, L.M.start.f, L.north), box: [], count: 2 };
    }
    if (L.sol.main.length > L.maxMain) return null;
    if (L.box && L.sol.box.length > L.box.max) return null;
    if (!sim(L.M, L.sol, L.north).ok) return null;
    L.sig = JSON.stringify([L.set, L.M.start, L.M.goal, L.M.items, L.M.seq, Object.keys(L.M.cell).sort().map(k => k + L.M.cell[k].k), L.preset, L.north, L.M.battery]);
    return L;
  }
  const coordName = (L, c, r) => (L.labels === 'cart' ? '(' + c + ', ' + (L.rows - 1 - r) + ')' : LETTERS[c] + (L.rows - r));
  const coordSay = (L, c, r) => (L.labels === 'cart' ? '(' + c + ', ' + (L.rows - 1 - r) + ')' : LETTERS[c] + ' ' + (L.rows - r));
  /** Plain words for a program, used by the worked examples ("3 ke kanan, lalu 2 ke atas"). */
  function planWords(cards, set, north) {
    const parts = cards.map(c => {
      const d = CT[c.t];
      if (d.fam === 'abs') return (c.n || 1) + ' ke ' + d.name;
      if (d.fam === 'cmp') return (c.n || 1) + ' ke ' + d.name;
      if (d.fam === 'fwd') return 'maju ' + (c.n || 1);
      return d.name;
    });
    return parts.length > 1 ? parts.slice(0, -1).join(', ') + ', lalu ' + parts[parts.length - 1] : parts[0] || '';
  }
  const dirRange = (d, size, span) => (d > 0 ? [0, size - 1 - span] : [span, size - 1]);

  /* ---------- TK: screen arrows, one card = one square ---------- */
  function tkStraight(R) {
    const M = newMap(6, 4), r = R.int(0, 3), k = R.int(2, 4), c0 = R.int(0, 5 - k);
    M.start = { c: c0, r, f: 1 }; M.goal = { c: c0 + k, r };
    for (let c = c0 + 1; c <= c0 + k; c++) M.dots.push([c, r]);
    const avoid = new Set(); for (let c = 0; c < 6; c++) avoid.add(key(c, r));
    scatter(M, R, 3, ['tree', 'stone', 'tree'], avoid);
    return level({ M, set: 'step', say: 'Antar Chuppy ke rumah. Satu kartu, satu kotak.', think: ['Hitung kotaknya: ' + k + ' kotak ke kanan.', 'Satu kartu, satu kotak. Jalan!'] });
  }
  function tkTurn(R) {
    const M = newMap(6, 4);
    const dx = R.int(2, 3) * (R.chance(0.7) ? 1 : -1), dy = R.int(1, 2) * (R.chance(0.65) ? -1 : 1);
    const cr = dirRange(dx, 6, Math.abs(dx)), rr = dirRange(dy, 4, Math.abs(dy));
    const c0 = R.int(cr[0], cr[1]), r0 = R.int(rr[0], rr[1]);
    M.start = { c: c0, r: r0, f: dx > 0 ? 1 : 3 }; M.goal = { c: c0 + dx, r: r0 + dy };
    scatter(M, R, 3, ['tree', 'stone'], lRoutes(M.start, M.goal));
    const L = level({ M, set: 'step', say: 'Rumahnya di sana. Susun panah untuk Chuppy.' });
    if (!L) return null;
    L.think = [Math.abs(dy) + ' kotak ke ' + (dy < 0 ? 'atas' : 'bawah') + ', ' + Math.abs(dx) + ' ke ' + (dx > 0 ? 'kanan' : 'kiri') + '.', 'Sudah. Ayo jalan!'];
    const v = cardFor(dy < 0 ? 0 : 2, 'abs'), h = cardFor(dx > 0 ? 1 : 3, 'abs');
    L.sol.main = [].concat(Array(Math.abs(dy)).fill(0).map(() => ({ t: v, n: 1 })), Array(Math.abs(dx)).fill(0).map(() => ({ t: h, n: 1 })));
    return sim(M, L.sol, 0).ok ? L : null;
  }
  function tkStone(R) {
    const M = newMap(6, 4), r = R.int(0, 3), k = R.int(3, 4), right = R.chance(0.7);
    const c0 = right ? R.int(0, 5 - k) : R.int(k, 5), s = right ? 1 : -1;
    M.start = { c: c0, r, f: right ? 1 : 3 }; M.goal = { c: c0 + s * k, r };
    put(M, c0 + s * R.int(1, k - 1), r, 'stone');
    const avoid = new Set();
    for (let c = 0; c < 6; c++) avoid.add(key(c, r));
    for (let c = Math.min(c0, M.goal.c); c <= Math.max(c0, M.goal.c); c++) { avoid.add(key(c, r - 1)); avoid.add(key(c, r + 1)); }
    scatter(M, R, 2, ['tree'], avoid);
    const L = level({ M, set: 'step', say: 'Ada batu di jalan. Cari jalan memutar.' });
    if (!L || L.sol.main.length !== k + 2) return null;
    L.think = ['Ada batu. Kita lewat samping.', 'Naik, lewati batu, lalu turun.'];
    if (L.sol.main[0].t === 'D') L.think[1] = 'Turun, lewati batu, lalu naik.';
    return L;
  }
  function tkItems(R) {
    const M = newMap(6, 4);
    M.start = { c: R.int(0, 5), r: R.int(0, 3), f: 1 };
    const g = R.pick(freeCells(M)); M.goal = { c: g[0], r: g[1] };
    const d = manh(M.start, M.goal);
    if (d < 2 || d > 4) return null;
    const kind = R.pick(['mangga', 'jeruk', 'apel']);
    for (let i = 0; i < 2; i++) { const f = R.pick(freeCells(M)); M.items.push({ c: f[0], r: f[1], kind }); }
    const L = level({ M, set: 'step', say: 'Ambil dua ' + ITEM_NAME[kind] + ', lalu pulang ke rumah.', think: ['Ambil ' + ITEM_NAME[kind] + ' satu, lalu satu lagi.', 'Lalu pulang ke rumah.'] });
    if (!L) return null;
    const len = stepsOf(L.sol);
    return len <= 7 && len >= d + 2 ? L : null;
  }
  function tkFoot(R) {
    const M = newMap(6, 4), ax = R.int(2, 3), ay = R.int(2, 3), sx = R.chance(0.6) ? 1 : -1, sy = R.chance(0.5) ? -1 : 1;
    if (ax + ay > 6) return null;
    const turns = m => m.reduce((a, d, i) => a + (i && d !== m[i - 1] ? 1 : 0), 0);
    let moves = null;
    for (let k = 0; k < 30; k++) {
      const m = R.shuffle([].concat(Array(ax).fill(sx > 0 ? 1 : 3), Array(ay).fill(sy > 0 ? 2 : 0)));
      if (turns(m) >= 2) { moves = m; break; }
    }
    if (!moves) return null;
    const cr = dirRange(sx, 6, ax), rr = dirRange(sy, 4, ay);
    let c = R.int(cr[0], cr[1]), r = R.int(rr[0], rr[1]);
    M.start = { c, r, f: moves[0] };
    const path = new Set([key(c, r)]);
    moves.forEach((d, i) => { c += DC[d]; r += DR[d]; path.add(key(c, r)); if (i < moves.length - 1) M.foot.push([c, r, d]); });
    M.goal = { c, r };
    scatter(M, R, 3, ['tree', 'stone'], path);
    const L = level({ M, set: 'step', say: 'Ikuti jejak kaki sampai ke rumah.' });
    if (!L || stepsOf(L.sol) !== moves.length) return null;
    L.sol.main = moves.map(d => ({ t: ABS[d], n: 1 }));
    L.think = ['Lihat jejaknya. Satu jejak, satu kartu.', 'Ikuti terus sampai rumah.'];
    return sim(M, L.sol, 0).ok ? L : null;
  }
  function tkChallenge(R) {
    const M = newMap(6, 4);
    M.start = { c: R.int(0, 5), r: R.int(0, 3), f: 1 };
    const g = R.pick(freeCells(M)); M.goal = { c: g[0], r: g[1] };
    const d = manh(M.start, M.goal);
    if (d < 2 || d > 4) return null;
    const kind = R.pick(['mangga', 'jeruk', 'rambutan']);
    const f = R.pick(freeCells(M)); M.items.push({ c: f[0], r: f[1], kind });
    const s = R.pick(freeCells(M)); put(M, s[0], s[1], 'stone');
    const L = level({ M, set: 'step', say: 'Ambil ' + ITEM_NAME[kind] + ' dulu. Awas batu!', think: ['Ambil ' + ITEM_NAME[kind] + ' dulu.', 'Lalu ke rumah. Awas batu.'] });
    if (!L) return null;
    const len = stepsOf(L.sol);
    return len <= 7 && len >= d + 2 ? L : null;
  }

  /* ---------- k1: arrows with a number ---------- */
  function k1Two(R) {
    const M = newMap(7, 5);
    const dx = R.int(2, 5) * (R.chance(0.6) ? 1 : -1), dy = R.int(1, 3) * (R.chance(0.5) ? -1 : 1);
    const cr = dirRange(dx, 7, Math.abs(dx)), rr = dirRange(dy, 5, Math.abs(dy));
    if (cr[0] > cr[1] || rr[0] > rr[1]) return null;
    M.start = { c: R.int(cr[0], cr[1]), r: R.int(rr[0], rr[1]), f: 1 };
    M.goal = { c: M.start.c + dx, r: M.start.r + dy };
    scatter(M, R, 3, ['tree', 'stone'], lRoutes(M.start, M.goal));
    const L = level({ M, set: 'abs', sign: 'Antar ke rumah', say: 'Antar Chuppy ke rumah. Ketuk panah dua kali, langkahnya jadi 2.' });
    if (!L || L.sol.main.length !== 2) return null;
    L.think = ['Hitung kotaknya: ' + planWords(L.sol.main) + '.', 'Ketuk panah lagi, angkanya bertambah.'];
    return L;
  }
  function batteryLevel(R, o) {
    const M = newMap(o.cols, o.rows);
    M.start = { c: R.int(0, o.cols - 1), r: R.int(0, o.rows - 1), f: 1 };
    const g = R.pick(freeCells(M)); M.goal = { c: g[0], r: g[1] };
    const d = manh(M.start, M.goal);
    if (d < 4 || d > 7) return null;
    scatter(M, R, R.int(7, 10), ['stone', 'tree', 'stone'], null);
    const L = level({ M, set: o.set, labels: o.labels || null, maxMain: 7, info: ['battery'], scale: o.scale || null, gk: 'rumah' });
    if (!L) return null;
    const len = stepsOf(L.sol);
    if (len < d + 2 || len > 10 || L.sol.main.length > 6) return null;
    M.battery = len;
    const amount = o.scale ? len * o.scale + ' meter' : len + ' langkah';
    L.sign = o.scale ? 'Baterai ' + len * o.scale + ' m' : 'Jalan terpendek';
    L.say = 'Baterai Chuppy cukup untuk ' + amount + '.' + (o.scale ? ' Satu kotak ' + o.scale + ' meter.' : '') + ' Cari jalan terpendek.';
    L.think = [o.scale ? amount + ' itu ' + len + ' kotak. Cari jalan ' + len + ' kotak.' : 'Baterai ' + len + ' langkah. Hitung jalan yang paling pendek.', planWords(L.sol.main, L.set) + '.'];
    L.sig += '|' + len;
    return L;
  }
  function mutate(R, sol, set) {
    const out = cloneCards(sol);
    const turnIdx = out.map((c, i) => (c.t === 'TL' || c.t === 'TR' ? i : -1)).filter(i => i >= 0);
    if (set === 'rel' && turnIdx.length && R.chance(0.7)) { const i = R.pick(turnIdx); out[i].t = out[i].t === 'TL' ? 'TR' : 'TL'; return out; }
    const moves = out.map((c, i) => (isMove(c.t) ? i : -1)).filter(i => i >= 0);
    const i = R.pick(moves), c = out[i];
    const op = R.pick(c.n > 1 ? ['plus', 'minus', 'minus', 'turn'] : ['plus', 'turn']);
    if (op === 'plus') c.n++;
    else if (op === 'minus') c.n--;
    else if (set === 'abs' || set === 'cmp') {
      const fam = set === 'abs' ? ABS : CMP, k = fam.indexOf(c.t), nt = fam[(k + (R.chance(0.5) ? 1 : 3)) % 4];
      if ((out[i - 1] && out[i - 1].t === nt) || (out[i + 1] && out[i + 1].t === nt)) return null;
      c.t = nt;
    } else c.n++;
    return out;
  }
  function debugLevel(R, set) {
    const M = newMap(7, 5);
    M.start = { c: R.int(0, 6), r: R.int(0, 4), f: R.int(0, 3) };
    const g = R.pick(freeCells(M)); M.goal = { c: g[0], r: g[1] };
    const d = manh(M.start, M.goal);
    if (d < 4 || d > 8) return null;
    scatter(M, R, R.int(4, 6), ['stone', 'tree'], null);
    const L = level({ M, set, sign: 'Perbaiki program', say: 'Program ini ada yang salah. Jalankan dulu, lalu perbaiki satu kartu.' });
    if (!L) return null;
    const n = L.sol.main.length;
    if (set === 'rel' ? (n < 4 || n > 6 || !L.sol.main.some(c => c.t === 'TL' || c.t === 'TR')) : (n < 3 || n > 4)) return null;
    const pre = mutate(R, L.sol.main, set);
    if (!pre || sameCards(pre, L.sol.main) || sim(M, { main: pre, box: [], count: 2 }, 0).ok) return null;
    L.preset = pre;
    L.sig = JSON.stringify([L.sig, pre]);
    L.think = ['Jalankan dulu. Lihat di mana Chuppy berhenti.', 'Kartu ini yang salah. Kita perbaiki.'];
    return L;
  }
  function k1Order(R) {
    const M = newMap(7, 5);
    M.start = { c: R.int(0, 6), r: R.int(0, 4), f: 1 };
    const kinds = R.shuffle(['apel', 'pisang', 'jeruk', 'mangga']).slice(0, 2);
    kinds.forEach((kind, i) => { const f = R.pick(freeCells(M)); M.seq.push({ c: f[0], r: f[1], type: 'item', kind, n: i + 1 }); });
    const g = R.pick(freeCells(M)); M.goal = { c: g[0], r: g[1] };
    scatter(M, R, R.int(2, 3), ['tree', 'stone'], null);
    if (manh(M.start, M.seq[0]) < 2 || manh(M.seq[0], M.seq[1]) < 2 || manh(M.seq[1], M.goal) < 2) return null;
    const L = level({ M, set: 'abs', info: ['order'], sign: 'Ambil 1, lalu 2',
      say: 'Ambil ' + kinds[0] + ' dulu, lalu ' + kinds[1] + '. Lalu bawa pulang ke rumah.' });
    if (!L || L.sol.main.length > 6 || stepsOf(L.sol) > 13) return null;
    L.think = ['Nomor 1 dulu: ' + kinds[0] + '.', 'Lalu ' + kinds[1] + ', lalu rumah.'];
    return L;
  }
  function posLevel(R, withStop) {
    const M = newMap(7, 5);
    const ref = withStop ? R.pick(['masjid', 'beringin']) : R.pick(['masjid', 'warung', 'beringin']);
    const rc = R.int(1, 5), rr = R.int(0, 4);
    put(M, rc, rr, ref);
    const rel = R.pick(['kiri', 'kanan']), s = rel === 'kiri' ? -1 : 1;
    const cols = R.shuffle(HOUSE_COLORS);
    put(M, rc + s, rr, 'rumah', { walk: true, house: true, color: cols[0] });
    put(M, rc - s, rr, 'rumah', { walk: true, house: true, color: cols[1] });
    M.goal = { c: rc + s, r: rr }; M.gk = 'cell';
    const near = new Set(); for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) near.add(key(rc + dc, rr + dr));
    const extra = R.int(1, 2);
    for (let i = 0; i < extra; i++) { const f = R.pick(freeCells(M, near)); if (f) put(M, f[0], f[1], 'rumah', { walk: true, house: true, color: cols[2 + i] }); }
    const other = R.pick(['masjid', 'warung', 'beringin'].filter(k => k !== ref));
    const o = R.pick(freeCells(M, near)); if (o) put(M, o[0], o[1], other);
    if (withStop) {
      const w = R.pick(freeCells(M, near));
      if (!w) return null;
      put(M, w[0], w[1], 'warung', { walk: true });
      M.seq.push({ c: w[0], r: w[1], type: 'stop', name: 'warung' });
      if (other === 'warung') return null;
    }
    scatter(M, R, R.int(1, 2), ['tree', 'stone'], near);
    const st = R.pick(freeCells(M, near));
    if (!st) return null;
    M.start = { c: st[0], r: st[1], f: 1 };
    const refName = PLACE_NAME[ref];
    const L = level({ M, set: 'abs', relText: 'sebelah ' + rel + ' ' + refName,
      sign: withStop ? 'Warung, lalu rumah di ' + rel + ' ' + refName : 'Rumah di ' + rel + ' ' + refName,
      say: withStop ? 'Mampir ke warung dulu. Lalu antar telur ke rumah di sebelah ' + rel + ' ' + refName + '.' : 'Antar surat ke rumah di sebelah ' + rel + ' ' + refName + '.' });
    if (!L || L.sol.main.length > (withStop ? 7 : 6) || L.sol.main.length < 2) return null;
    L.think = [(withStop ? 'Ke warung dulu. ' : '') + 'Cari ' + refName + '. Rumah di sebelah ' + rel + 'nya.', planWords(L.sol.main) + '.'];
    return L;
  }
  function riverLevel(R) {
    const M = newMap(7, 5), cr = R.int(2, 4), br = R.int(0, 4);
    for (let r = 0; r < 5; r++) put(M, cr, r, r === br ? 'bridge' : 'water', { o: 'h' });
    const left = R.chance(0.5);
    const sc = left ? R.int(0, cr - 1) : R.int(cr + 1, 6), gc = left ? R.int(cr + 1, 6) : R.int(0, cr - 1);
    M.start = { c: sc, r: R.int(0, 4), f: left ? 1 : 3 };
    M.goal = { c: gc, r: R.int(0, 4) };
    scatter(M, R, R.int(2, 3), ['stone', 'tree'], null);
    const L = level({ M, set: 'abs', sign: 'Lewat jembatan', say: 'Rumahnya di seberang sungai. Lewat jembatan, ya.' });
    if (!L || L.sol.main.length < 4 || L.sol.main.length > 6) return null;
    L.think = ['Cari jembatannya dulu.', planWords(L.sol.main) + '.'];
    return L;
  }

  /* ---------- k2: turns from Chuppy's facing, compass, repeat ---------- */
  function turnLevel(R, o) {
    o = o || {};
    const M = newMap(7, 5);
    M.start = { c: R.int(0, 6), r: R.int(0, 4), f: R.int(0, 3) };
    const g = R.pick(freeCells(M)); M.goal = { c: g[0], r: g[1] };
    if (M.goal.c === M.start.c || M.goal.r === M.start.r) return null;
    if (o.item) {
      const kind = R.pick(['mangga', 'jeruk', 'pisang']);
      const f = R.pick(freeCells(M)); M.items.push({ c: f[0], r: f[1], kind });
      scatter(M, R, R.int(4, 5), ['stone', 'tree'], null);
    } else scatter(M, R, R.int(2, 3), ['stone', 'tree'], lRoutes(M.start, M.goal));
    const L = level({ M, set: 'rel', maxMain: 7, sign: o.item ? 'Ambil, lalu antar' : 'Maju dan belok',
      say: o.item ? 'Ambil ' + ITEM_NAME[M.items[0].kind] + ', lalu antar ke rumah. Kiri dan kanan menurut Chuppy, ya.' : 'Chuppy hanya bisa maju dan belok. Kiri dan kanan menurut Chuppy, ya.' });
    if (!L) return null;
    const n = L.sol.main.length;
    if (n > (o.item ? 7 : 6) || (o.item && n < 4)) return null;
    if (!L.sol.main.some(c => c.t === 'TL' || c.t === 'TR')) return null;
    if (!o.item && R.chance(0.6) && !(L.sol.main[0].t === 'TL' || L.sol.main[0].t === 'TR')) return null;
    const fw = ['ke atas', 'ke kanan', 'ke bawah', 'ke kiri'][M.start.f];
    L.think = ['Chuppy menghadap ' + fw + '. Kirinya dan kanannya dari Chuppy.', planWords(L.sol.main) + '.'];
    return L;
  }
  function compassLevel(R) {
    const M = newMap(7, 5);
    M.start = { c: R.int(0, 6), r: R.int(0, 4), f: 1 };
    const g = R.pick(freeCells(M)); M.goal = { c: g[0], r: g[1] }; M.gk = 'flag';
    if (manh(M.start, M.goal) < 4) return null;
    scatter(M, R, R.int(4, 6), ['stone', 'tree'], null);
    const L = level({ M, set: 'cmp', sign: 'Ke bendera', say: 'Pakai arah mata angin. Lihat mawar anginnya: U utara, T timur, S selatan, B barat.' });
    if (!L || L.sol.main.length < 2 || L.sol.main.length > 5) return null;
    L.think = ['Utara ke atas, timur ke kanan.', planWords(L.sol.main) + '.'];
    return L;
  }
  /** A staircase that repeats (d1 a, d2 b) n times; the short board makes the ulangi box necessary. */
  function staircase(R, o) {
    const M = newMap(o.cols, o.rows);
    const [a, b, n, tailMax] = R.pick(o.opts);
    const A = R.pick([1, 3]), B = R.pick([0, 2]), firstA = R.chance(0.5);
    const d1 = firstA ? A : B, d2 = firstA ? B : A, k1 = firstA ? a : b, k2 = firstA ? b : a;
    const tail = tailMax ? R.int(0, tailMax) : 0;
    let dx = a * n + (firstA ? tail : 0), dy = b * n + (firstA ? 0 : tail);
    const cr = dirRange(A === 1 ? 1 : -1, o.cols, dx), rr = dirRange(B === 2 ? 1 : -1, o.rows, dy);
    if (cr[0] > cr[1] || rr[0] > rr[1]) return null;
    let c = R.int(cr[0], cr[1]), r = R.int(rr[0], rr[1]);
    M.start = { c, r, f: d1 };
    const path = new Set([key(c, r)]);
    const step = d => { c += DC[d]; r += DR[d]; path.add(key(c, r)); };
    for (let k = 0; k < n; k++) { for (let s = 0; s < k1; s++) step(d1); for (let s = 0; s < k2; s++) step(d2); }
    for (let s = 0; s < tail; s++) step(d1);
    M.goal = { c, r }; M.gk = 'flag';
    const x0 = Math.min(M.start.c, c), x1 = Math.max(M.start.c, c), y0 = Math.min(M.start.r, r), y1 = Math.max(M.start.r, r);
    if (o.corridor) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!path.has(key(x, y))) put(M, x, y, 'sawah');
    if (o.scatter) scatter(M, R, o.scatter, ['stone', 'tree'], path);
    const ring = [];
    for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (inb(M, x, y) && (x < x0 || x > x1 || y < y0 || y > y1) && !taken(M, x, y)) ring.push([x, y]);
    const ringS = R.shuffle(ring);
    const need = o.need || 4;
    while (minCards(M, o.set, need) < need && ringS.length) { const p = ringS.pop(); put(M, p[0], p[1], R.pick(['tree', 'stone'])); }
    const noLoop = minCards(M, o.set, 12);
    if (noLoop < need) return null;
    const nm = d => cardFor(d, o.set, 0);
    const sol = { main: [{ t: 'LOOP', n: 1 }].concat(tail ? [{ t: nm(d1), n: tail }] : []), box: [{ t: nm(d1), n: k1 }, { t: nm(d2), n: k2 }], count: n };
    const L = level(Object.assign({ M, set: o.set, sol, box: { kind: 'loop', max: 3, cmin: 2, cmax: 5 }, maxMain: o.maxMain }, o.level || {}));
    if (!L) return null;
    L.noLoop = noLoop;
    if (o.battery) { M.battery = stepsOf(sol); L.info = L.info.concat(['battery']); }
    L.think = ['Polanya berulang: ' + planWords(sol.box, o.set) + '.', 'Ulangi ' + n + ' kali.' + (tail ? ' Lalu ' + planWords(sol.main.slice(1), o.set) + '.' : '')];
    return L;
  }
  function denahLevel(R) {
    const M = newMap(7, 5);
    const kinds = ['sekolah', 'masjid', 'pasar', 'puskesmas'];
    kinds.forEach(k => { const f = R.pick(freeCells(M)); put(M, f[0], f[1], k); });
    for (let i = 0; i < 2; i++) { const f = R.pick(freeCells(M)); put(M, f[0], f[1], 'rumah'); }
    const w = R.pick(freeCells(M)); put(M, w[0], w[1], 'pond');
    const target = R.pick(kinds);
    const tk = Object.keys(M.cell).find(k => M.cell[k].k === target);
    const [tc, tr] = tk.split(',').map(Number);
    M.cell[tk].walk = true;
    M.goal = { c: tc, r: tr }; M.gk = 'cell';
    const st = R.pick(freeCells(M)); M.start = { c: st[0], r: st[1], f: 1 };
    if (manh(M.start, M.goal) < 3) return null;
    const L = level({ M, style: 'denah', set: 'cmp', info: ['legend'], sign: 'Pergi ke ' + PLACE_NAME[target],
      say: 'Ini denah kampung. Pergi ke ' + PLACE_NAME[target] + '. Lihat keterangan gambarnya.' });
    if (!L || L.sol.main.length > 5 || L.sol.main.length < 2) return null;
    L.think = ['Cari gambar ' + PLACE_NAME[target] + ' di keterangan.', planWords(L.sol.main, 'cmp') + '.'];
    return L;
  }

  /* ---------- k3: grid coordinates, scale, nested repeat ---------- */
  function coordLevel(R) {
    const M = newMap(8, 5);
    const cols = R.shuffle(HOUSE_COLORS);
    for (let i = 0; i < 5; i++) { const f = R.pick(freeCells(M)); put(M, f[0], f[1], 'rumah', { walk: true, house: true, color: cols[i] }); }
    scatter(M, R, 3, ['tree', 'stone'], null);
    const houses = Object.keys(M.cell).filter(k => M.cell[k].house);
    const [tc, tr] = R.pick(houses).split(',').map(Number);
    M.goal = { c: tc, r: tr }; M.gk = 'cell';
    const st = R.pick(freeCells(M)); M.start = { c: st[0], r: st[1], f: 1 };
    if (manh(M.start, M.goal) < 3) return null;
    const L = level({ M, set: 'cmp', labels: 'grid', sign: 'Paket untuk ' + LETTERS[tc] + (5 - tr) });
    if (!L || L.sol.main.length > 5) return null;
    L.say = 'Antar paket ke rumah ' + coordSay(L, tc, tr) + '. Cari kolom ' + LETTERS[tc] + ', baris ' + (5 - tr) + '.';
    L.think = ['Kolom ' + LETTERS[tc] + ' di bawah, baris ' + (5 - tr) + ' di samping.', planWords(L.sol.main, 'cmp') + '.'];
    L.hiddenName = true;
    return L;
  }
  function stopsLevel(R, o) {
    const M = newMap(8, 5);
    M.start = { c: R.int(0, 7), r: R.int(0, 4), f: R.int(0, 3) };
    const a = R.pick(freeCells(M));
    M.seq.push({ c: a[0], r: a[1], type: 'stop', hidden: true });
    const g = R.pick(freeCells(M)); M.goal = { c: g[0], r: g[1] }; M.gk = 'hidden';
    if (manh(M.start, M.seq[0]) < 3 || manh(M.seq[0], M.goal) < 3) return null;
    scatter(M, R, R.int(3, 5), ['stone', 'tree'], null);
    const L = level({ M, set: o.set, labels: o.labels, lattice: !!o.lattice, maxMain: 7 });
    if (!L || L.sol.main.length > (o.set === 'deg' ? 7 : 6)) return null;
    const n1s = coordName(L, a[0], a[1]), n2s = coordName(L, g[0], g[1]);
    M.seq[0].name = n1s;
    L.sign = 'Ke ' + n1s + ' dulu, lalu ' + n2s;
    L.say = 'Ke ' + coordSay(L, a[0], a[1]) + ' dulu, lalu ke ' + coordSay(L, g[0], g[1]) + '.';
    L.think = ['Cari ' + n1s + ' dulu, lalu ' + n2s + '.', planWords(L.sol.main, o.set) + '.'];
    return L;
  }
  function scaleLevel(R) {
    const M = newMap(8, 5), s = R.pick([10, 10, 5]);
    const dx = R.int(2, 5) * (R.chance(0.5) ? 1 : -1), dy = R.int(1, 3) * (R.chance(0.5) ? -1 : 1);
    const cr = dirRange(dx, 8, Math.abs(dx)), rr = dirRange(dy, 5, Math.abs(dy));
    if (cr[0] > cr[1] || rr[0] > rr[1]) return null;
    M.start = { c: R.int(cr[0], cr[1]), r: R.int(rr[0], rr[1]), f: 1 };
    M.goal = { c: M.start.c + dx, r: M.start.r + dy }; M.gk = 'chest';
    scatter(M, R, 4, ['tree', 'stone'], lRoutes(M.start, M.goal));
    const ew = dx > 0 ? 'timur' : 'barat', ns = dy < 0 ? 'utara' : 'selatan';
    const sol = { main: [{ t: dx > 0 ? 'E' : 'W', n: Math.abs(dx) }, { t: dy < 0 ? 'N' : 'S', n: Math.abs(dy) }], box: [], count: 2 };
    const L = level({ M, set: 'cmp', labels: 'grid', scale: s, sol, info: ['scale'],
      sign: Math.abs(dx) * s + ' m ke ' + ew + ', ' + Math.abs(dy) * s + ' m ke ' + ns,
      say: 'Hartanya ' + Math.abs(dx) * s + ' meter ke ' + ew + ', lalu ' + Math.abs(dy) * s + ' meter ke ' + ns + '. Satu kotak ' + s + ' meter.' });
    if (!L) return null;
    L.think = [Math.abs(dx) * s + ' meter itu ' + Math.abs(dx) + ' kotak, karena satu kotak ' + s + ' meter.', Math.abs(dy) * s + ' meter itu ' + Math.abs(dy) + ' kotak.'];
    return L;
  }
  function river2Level(R) {
    const M = newMap(8, 5), b1 = R.int(0, 3), b2 = R.int(b1 + 3, 7);
    for (let c = 0; c < 8; c++) put(M, c, 2, c === b1 || c === b2 ? 'bridge' : 'water', { o: 'v' });
    const top = R.chance(0.5);
    M.start = { c: R.int(0, 7), r: top ? R.int(0, 1) : R.int(3, 4), f: top ? 2 : 0 };
    M.goal = { c: R.int(0, 7), r: top ? R.int(3, 4) : R.int(0, 1) };
    scatter(M, R, R.int(1, 2), ['stone', 'tree'], null);
    const L = level({ M, set: 'cmp', labels: 'grid', info: ['battery'], maxMain: 7 });
    if (!L || L.sol.main.length > 6) return null;
    const len = stepsOf(L.sol);
    // the other bridge must be clearly longer
    const used = route(M), path = []; let c = M.start.c, r = M.start.r; used.forEach(d => { c += DC[d]; r += DR[d]; path.push(c); });
    const via = [b1, b2].find(b => used.some((d, i) => path[i] === b && (DR[d] !== 0)));
    const alt = JSON.parse(JSON.stringify(M)); alt.cell = Object.assign({}, M.cell); alt.cell[key(via, 2)] = { k: 'water', walk: false };
    const d2 = route(alt);
    if (d2 && d2.length < len + 2) return null;
    M.battery = len;
    L.sign = 'Baterai ' + len + ' langkah';
    L.say = 'Ada dua jembatan. Baterai cukup untuk ' + len + ' langkah. Pilih jembatan yang dekat.';
    L.think = ['Jembatan mana yang lebih dekat? Hitung kotaknya.', planWords(L.sol.main, 'cmp') + '.'];
    L.sig += '|' + len;
    return L;
  }
  function northLevel(R) {
    const M = newMap(8, 5), north = R.pick([1, 3]);
    M.start = { c: R.int(0, 7), r: R.int(0, 4), f: 1 };
    const g = R.pick(freeCells(M)); M.goal = { c: g[0], r: g[1] }; M.gk = 'hidden';
    if (manh(M.start, M.goal) < 4 || M.goal.c === M.start.c || M.goal.r === M.start.r) return null;
    scatter(M, R, 4, ['stone', 'tree'], null);
    const L = level({ M, set: 'cmp', labels: 'grid', north });
    if (!L || L.sol.main.length > 5) return null;
    const side = north === 1 ? 'kanan' : 'kiri';
    L.sign = 'Ke ' + coordName(L, g[0], g[1]) + '. Utara ke ' + side + '!';
    L.say = 'Hati-hati, utara di peta ini ke ' + side + '. Pergi ke ' + coordSay(L, g[0], g[1]) + '.';
    L.think = ['Lihat mawar angin: utara ke ' + side + '.', planWords(L.sol.main, 'cmp') + '.'];
    return L;
  }

  /* ---------- k4: Cartesian coordinates, degrees, procedure, cheapest program ---------- */
  function cartLevel(R) {
    const M = newMap(8, 5);
    M.start = R.chance(0.5) ? { c: 0, r: 4, f: 1 } : { c: R.int(0, 3), r: R.int(2, 4), f: 1 };
    const x = R.int(1, 7), y = R.int(1, 4);
    if (x === y || (x === M.start.c && 4 - y === M.start.r)) return null;
    M.goal = { c: x, r: 4 - y }; M.gk = 'hidden';
    if (manh(M.start, M.goal) < 3) return null;
    scatter(M, R, 3, ['stone', 'tree'], null);
    const L = level({ M, set: 'abs', lattice: true, labels: 'cart' });
    if (!L || L.sol.main.length > 5) return null;
    L.sign = 'Ke titik (' + x + ', ' + y + ')';
    L.say = 'Pergi ke titik (' + x + ', ' + y + '). Angka pertama x, ke kanan. Angka kedua y, ke atas.';
    L.think = ['Titik (' + x + ', ' + y + '): x = ' + x + ' dan y = ' + y + '.', planWords(L.sol.main) + '.'];
    return L;
  }
  function degLevel(R) {
    const M = newMap(8, 5);
    M.start = { c: R.int(0, 7), r: R.int(0, 4), f: R.int(0, 3) };
    const g = R.pick(freeCells(M)); M.goal = { c: g[0], r: g[1] }; M.gk = 'flag';
    if (manh(M.start, M.goal) < 3) return null;
    scatter(M, R, 3, ['stone', 'tree'], null);
    const L = level({ M, set: 'deg', lattice: true, labels: 'cart', sign: 'Putar, lalu maju', say: 'Putar ke kanan 90, 180, atau 270 derajat. Lalu maju.' });
    if (!L || L.sol.main.length > 6 || !L.sol.main.some(c => c.t === 'R180' || c.t === 'R270')) return null;
    L.think = ['180 derajat itu balik arah. 270 derajat sama dengan belok kiri.', planWords(L.sol.main, 'deg') + '.'];
    return L;
  }
  function procLevel(R, hidden) {
    const M = newMap(8, 5);
    const a = R.int(1, 2), b = R.int(1, 2), cc = R.int(0, 2), T1 = R.pick(['R90', 'R270']), T2 = T1 === 'R90' ? 'R270' : 'R90';
    const box = [{ t: 'F', n: a }, { t: T1, n: 1 }, { t: 'F', n: b }, { t: T2, n: 1 }];
    const main = [{ t: 'PROC', n: 1 }].concat(cc ? [{ t: 'F', n: cc }] : []).concat([{ t: 'PROC', n: 1 }]);
    const f0 = R.int(0, 3);
    M.start = { c: R.int(0, 7), r: R.int(0, 4), f: f0 };
    // walk it on the empty map to place the two houses
    let c = M.start.c, r = M.start.r, f = f0, ok = true;
    const path = new Set([key(c, r)]), ends = [];
    const exec = cd => { if (CT[cd.t].fam === 'turn') { f = (f + CT[cd.t].d) % 4; return; } for (let s = 0; s < cd.n; s++) { c += DC[f]; r += DR[f]; if (!inb(M, c, r)) ok = false; path.add(key(c, r)); } };
    main.forEach(cd => { if (cd.t === 'PROC') { box.forEach(exec); ends.push([c, r]); } else exec(cd); });
    if (!ok || path.size < 2 * (a + b) + cc + 1) return null;
    const [h1, h2] = ends;
    M.seq.push({ c: h1[0], r: h1[1], type: 'stop', hidden: !!hidden, house: !hidden });
    M.goal = { c: h2[0], r: h2[1] }; M.gk = hidden ? 'hidden' : 'rumah';
    scatter(M, R, 4, ['stone', 'tree'], path);
    const L = level({ M, set: 'deg', lattice: true, labels: 'cart', sol: { main, box, count: 1 }, box: { kind: 'proc', max: 4 }, maxMain: 3 });
    if (!L || minCards(M, 'deg', 4) <= 3) return null;
    const p1 = coordName(L, h1[0], h1[1]), p2 = coordName(L, h2[0], h2[1]);
    M.seq[0].name = hidden ? p1 : 'rumah pertama';
    L.sign = hidden ? 'Kue ke ' + p1 + ' dan ' + p2 : 'Kartu bintang 2 kali';
    L.say = hidden ? 'Antar kue ke ' + p1 + ', lalu ke ' + p2 + '. Jalannya sama bentuknya. Pakai kartu bintang.'
      : 'Dua rumah, jalannya sama bentuknya. Buat kartu bintang sekali, pakai dua kali.';
    L.think = ['Bentuk jalannya sama: ' + planWords(box, 'deg') + '.', 'Isi kartu bintang sekali. Pakai dua kali.'];
    return L;
  }
  function squareLevel(R) {
    const M = newMap(8, 5), s = R.int(2, 4);
    const x0 = R.int(0, 7 - s), y0 = R.int(0, 4 - s), q = R.int(0, 3);
    const corners = [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]];
    M.start = { c: corners[q][0], r: corners[q][1], f: [1, 2, 3, 0][q] };
    for (let k = 1; k < 4; k++) { const p = corners[(q + k) % 4]; M.items.push({ c: p[0], r: p[1], kind: 'flag' }); }
    M.goal = { c: M.start.c, r: M.start.r }; M.gk = 'start';
    for (let y = y0 + 1; y < y0 + s; y++) for (let x = x0 + 1; x < x0 + s; x++) put(M, x, y, 'pond');
    const side = new Set(); for (let y = y0; y <= y0 + s; y++) for (let x = x0; x <= x0 + s; x++) side.add(key(x, y));
    scatter(M, R, R.int(2, 3), ['tree', 'stone'], side);
    const sol = { main: [{ t: 'LOOP', n: 1 }], box: [{ t: 'F', n: s }, { t: 'R90', n: 1 }], count: 4 };
    const L = level({ M, set: 'deg', lattice: true, labels: 'cart', sol, box: { kind: 'loop', max: 3, cmin: 2, cmax: 6 }, maxMain: 2,
      sign: 'Keliling kolam', say: 'Kelilingi kolam. Ambil tiga bendera, lalu kembali ke tempat awal.' });
    if (!L) return null;
    L.think = ['Satu sisi: maju ' + s + ', putar 90 derajat.', 'Empat sisi, jadi ulangi 4 kali. 4 kali 90 derajat, satu putaran penuh.'];
    return L;
  }
  function thriftLevel(R) {
    const L = staircase(R, { cols: 8, rows: 5, set: 'abs', opts: [[1, 1, 4, 0], [2, 1, 3, 0], [1, 1, 3, 0]], corridor: false, scatter: 3, maxMain: 7, need: 4,
      level: { lattice: true, labels: 'cart', info: ['count'], sign: 'Program paling hemat', say: 'Sampai ke bendera dengan kartu sesedikit mungkin. Kartu ulangi bisa membantu.' } });
    if (!L) return null;
    L.bonus = Math.min(L.noLoop, 3);
    return L;
  }

  /* ================= level tables per kelas ================= */
  const GEN = {
    tk: [tkStraight, tkTurn, tkStone, tkItems, tkFoot, tkChallenge],
    k1: [k1Two, R => batteryLevel(R, { cols: 7, rows: 5, set: 'abs' }), R => debugLevel(R, 'abs'), k1Order, R => posLevel(R, false), riverLevel,
      R => R.pick([R2 => batteryLevel(R2, { cols: 7, rows: 5, set: 'abs' }), k1Order, riverLevel])(R), R => posLevel(R, true)],
    k2: [R => turnLevel(R), compassLevel, R => staircase(R, { cols: 7, rows: 5, set: 'cmp', opts: [[1, 1, 3, 0], [1, 1, 4, 0], [2, 1, 3, 0]], corridor: true, maxMain: 3,
      level: { sign: 'Pakai kartu ulangi', say: 'Papan programnya pendek. Pakai kartu ulangi untuk pola yang sama.' } }),
    R => debugLevel(R, 'rel'), denahLevel,
    R => staircase(R, { cols: 7, rows: 5, set: 'cmp', opts: [[1, 1, 3, 0], [1, 1, 4, 0], [2, 1, 3, 0]], corridor: false, scatter: 4, maxMain: 3, battery: true,
      level: { sign: 'Pendek dan hemat baterai', say: 'Cari jalan terpendek. Papannya pendek, jadi pakai kartu ulangi.' } }),
    R => R.pick([R2 => turnLevel(R2), compassLevel, R2 => staircase(R2, { cols: 7, rows: 5, set: 'cmp', opts: [[1, 1, 3, 0], [2, 1, 3, 0]], corridor: true, maxMain: 3,
      level: { sign: 'Pakai kartu ulangi', say: 'Papan programnya pendek. Pakai kartu ulangi.' } })])(R),
    R => turnLevel(R, { item: true })],
    k3: [coordLevel, R => stopsLevel(R, { set: 'cmp', labels: 'grid' }), scaleLevel, R => batteryLevel(R, { cols: 8, rows: 5, set: 'cmp', labels: 'grid', scale: R.pick([10, 5]) }),
      R => staircase(R, { cols: 8, rows: 5, set: 'cmp', opts: [[2, 1, 3, 1], [3, 1, 2, 1], [1, 2, 2, 1], [2, 2, 2, 0]], corridor: true, maxMain: 3,
        level: { labels: 'grid', sign: 'Ulangi berisi kartu angka', say: 'Di dalam kotak ulangi, kartu boleh berangka. Cari bagian yang berulang.' } }),
      river2Level, R => R.pick([coordLevel, R2 => stopsLevel(R2, { set: 'cmp', labels: 'grid' }), R2 => batteryLevel(R2, { cols: 8, rows: 5, set: 'cmp', labels: 'grid', scale: 10 })])(R),
      northLevel],
    k4: [cartLevel, degLevel, R => procLevel(R, false), squareLevel, thriftLevel, R => stopsLevel(R, { set: 'deg', labels: 'cart', lattice: true }),
      R => R.pick([cartLevel, degLevel, R2 => stopsLevel(R2, { set: 'deg', labels: 'cart', lattice: true })])(R), R => procLevel(R, true)]
  };
  const LEVELS = GEN[TIER] || GEN.k1;
  const DEMO_AUTO_OFF = { tk: [5], k1: [6, 7], k2: [6, 7], k3: [6, 7], k4: [6, 7] };   // campuran / tantangan: button only
  const KEYS = {
    tk: ['lurus', 'belok', 'batu', 'barang', 'jejak', 'tantangan'],
    k1: ['angka', 'baterai', 'perbaiki', 'urutan', 'posisi', 'jembatan', 'campuran', 'tantangan'],
    k2: ['belok', 'mataangin', 'ulangi', 'perbaiki', 'denah', 'ulangi-baterai', 'campuran', 'tantangan'],
    k3: ['koordinat', 'duatitik', 'skala', 'baterai-meter', 'ulangi-angka', 'jembatan', 'campuran', 'utara'],
    k4: ['kartesius', 'derajat', 'bintang', 'keliling', 'hemat', 'titik', 'campuran', 'tantangan']
  };
  function fallback() {
    const M = newMap(TK ? 6 : 7, TK ? 4 : 5);
    M.start = { c: 0, r: 1, f: 1 }; M.goal = { c: 3, r: 1 };
    const set = TIER === 'k2' || TIER === 'k3' ? 'cmp' : TK ? 'step' : 'abs';
    return level({ M, set, say: 'Antar Chuppy ke rumah.', think: ['Tiga kotak ke kanan.', 'Ayo jalan!'], sign: TK ? null : 'Antar ke rumah' });
  }
  function makeLevel(i, rand) {
    const R = mkR(rand), g = LEVELS[i];
    for (let k = 0; k < 600; k++) { const L = g(R); if (L) return L; }
    return fallback();
  }
  const demoCache = {};
  const demoLevel = i => demoCache[i] || (demoCache[i] = makeLevel(i, seeded(7001 + i * 977 + TIER_I * 131)));

  /* ================= art (Kampung Chunky) ================= */
  const sh = (rx, cy) => '<ellipse cx="0" cy="' + cy + '" rx="' + rx + '" ry="' + n1(rx * 0.26) + '" fill="' + OL + '" opacity=".18"/>';
  const S3 = 'stroke="' + OL + '" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';
  function houseArt(col) {
    const c = col || '#E2453C';
    return sh(38, 32) +
      '<rect x="-32" y="-8" width="64" height="40" rx="4" fill="#F3DDA6" ' + S3 + '/><rect x="-32" y="20" width="64" height="12" fill="#E5BE86" opacity=".7"/>' +
      '<path d="M-42 -4L0 -42L42 -4Z" fill="' + c + '" ' + S3 + '/><path d="M-30 -10L0 -36" stroke="#fff" stroke-width="4" opacity=".35" stroke-linecap="round"/>' +
      '<rect x="-9" y="6" width="18" height="26" rx="3" fill="#A8673A" ' + S3 + '/><circle cx="5" cy="20" r="2" fill="' + OL + '"/>' +
      '<rect x="14" y="2" width="13" height="12" rx="2" fill="#9ED8EC" stroke="' + OL + '" stroke-width="2.6"/>';
  }
  const ART = {
    stone: () => sh(34, 30) + '<path d="M-32 28Q-38 4 -18 -8Q-2 -18 16 -10Q36 -2 32 28Z" fill="#8C8F94" ' + S3 + '/>' +
      '<path d="M-20 0Q-12 -8 -2 -9" stroke="#B4B7BB" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M16 22Q26 16 25 5" stroke="#63666B" stroke-width="5" stroke-linecap="round" fill="none" opacity=".6"/>',
    tree: () => sh(30, 34) + '<rect x="-7" y="4" width="14" height="30" rx="4" fill="#A8673A" ' + S3 + '/>' +
      '<path d="M-34 6Q-46 -18 -22 -30Q-16 -50 4 -46Q26 -52 32 -28Q48 -14 34 6Q0 18 -34 6Z" fill="#4DAA57" ' + S3 + '/>' +
      '<path d="M-22 -18Q-18 -32 -4 -34" stroke="#86CC8C" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M14 2Q28 -2 30 -14" stroke="#357F40" stroke-width="5" stroke-linecap="round" fill="none"/>',
    beringin: () => sh(42, 36) + '<rect x="-9" y="0" width="18" height="36" rx="4" fill="#7E4A27" ' + S3 + '/><path d="M-4 6v20M4 8v22" stroke="#5E3A1E" stroke-width="2"/>' +
      '<path d="M-46 4Q-56 -22 -30 -34Q-24 -56 0 -52Q26 -58 34 -34Q56 -22 46 4Q0 18 -46 4Z" fill="#357F40" ' + S3 + '/>' +
      '<path d="M-30 -22Q-24 -38 -8 -40" stroke="#4DAA57" stroke-width="7" stroke-linecap="round" fill="none"/>',
    sawah: () => '<rect x="-46" y="-46" width="92" height="92" rx="10" fill="#8FC9B8" stroke="#5FA07E" stroke-width="3"/>' +
      [-28, -4, 20].map(y => [-26, 0, 26].map(x => '<path d="M' + (x - 7) + ' ' + (y + 8) + 'Q' + (x - 6) + ' ' + (y - 2) + ' ' + (x - 9) + ' ' + (y - 8) + 'M' + x + ' ' + (y + 8) + 'V' + (y - 10) + 'M' + (x + 7) + ' ' + (y + 8) + 'Q' + (x + 6) + ' ' + (y - 2) + ' ' + (x + 9) + ' ' + (y - 8) + '" stroke="#3E8A3A" stroke-width="3.2" stroke-linecap="round" fill="none"/>').join('')).join(''),
    masjid: () => sh(44, 34) + '<rect x="-34" y="-2" width="68" height="34" rx="4" fill="#FFF8EC" ' + S3 + '/>' +
      '<path d="M-24 -2Q-24 -36 0 -40Q24 -36 24 -2Z" fill="#4DAA57" ' + S3 + '/><path d="M0 -40V-52" stroke="' + OL + '" stroke-width="3.5"/><circle cx="0" cy="-54" r="4" fill="#FFC83D" stroke="' + OL + '" stroke-width="2.4"/>' +
      '<rect x="36" y="-34" width="10" height="66" rx="3" fill="#FFF8EC" ' + S3 + '/><path d="M33 -34Q41 -48 49 -34Z" fill="#4DAA57" ' + S3 + '/>' +
      '<path d="M-8 32V14Q0 4 8 14V32Z" fill="#357F40" ' + S3 + '/><path d="M-26 8h10M16 8h10" stroke="#4DAA57" stroke-width="5" stroke-linecap="round"/>',
    warung: () => sh(42, 34) + '<rect x="-36" y="0" width="72" height="32" rx="4" fill="#C68654" ' + S3 + '/>' +
      '<rect x="-36" y="0" width="72" height="10" fill="#FFF8EC" stroke="' + OL + '" stroke-width="3"/>' +
      '<path d="M-42 -2L-36 -26H36L42 -2Z" fill="#F28C28" ' + S3 + '/><path d="M-22 -26L-26 -2M-6 -26L-8 -2M10 -26L10 -2M26 -26L28 -2" stroke="#FFF8EC" stroke-width="6"/>' +
      '<path d="M-42 -2L-36 -26H36L42 -2Z" fill="none" ' + S3 + '/><circle cx="-18" cy="-4" r="0"/>' +
      '<circle cx="-16" cy="16" r="6" fill="#FFC83D" stroke="' + OL + '" stroke-width="2.4"/><circle cx="0" cy="16" r="6" fill="#E2453C" stroke="' + OL + '" stroke-width="2.4"/><circle cx="16" cy="16" r="6" fill="#4DAA57" stroke="' + OL + '" stroke-width="2.4"/>',
    flag: () => sh(18, 32) + '<rect x="-4" y="-40" width="8" height="72" rx="3" fill="#A8673A" ' + S3 + '/><path d="M4 -38L40 -26L4 -12Z" fill="#F28C28" ' + S3 + '/>' +
      '<path d="M10 -32L26 -26" stroke="#F8B26A" stroke-width="4" stroke-linecap="round"/><ellipse cx="0" cy="32" rx="12" ry="4" fill="#8C8F94"/>',
    chest: () => sh(36, 30) + '<rect x="-32" y="-6" width="64" height="36" rx="5" fill="#A8673A" ' + S3 + '/><path d="M-32 -6Q0 -36 32 -6Z" fill="#C68654" ' + S3 + '/>' +
      '<rect x="-6" y="-14" width="12" height="44" fill="#FFC83D" stroke="' + OL + '" stroke-width="3"/><circle cx="0" cy="6" r="5" fill="' + OL + '"/>' +
      '<circle cx="-18" cy="-20" r="4" fill="#FFE08A"/><circle cx="16" cy="-24" r="3" fill="#FFE08A"/>',
    parcel: () => sh(30, 30) + '<rect x="-26" y="-14" width="52" height="44" rx="5" fill="#D9A273" ' + S3 + '/><path d="M-26 -2H26M0 -14V30" stroke="#F3DDA6" stroke-width="7"/>' +
      '<rect x="-26" y="-14" width="52" height="44" rx="5" fill="none" ' + S3 + '/>',
    mat: () => '<ellipse cx="0" cy="22" rx="40" ry="16" fill="#F28C28" opacity=".35" stroke="#C76A12" stroke-width="3" stroke-dasharray="8 7"/>'
  };
  /* Denah (map) symbols: flat, seen from above, with a legend. */
  const SYM = {
    rumah: ['#F28C28', '<path d="M-20 4L0 -16L20 4V20H-20Z" fill="#fff"/>', 'rumah'],
    sekolah: ['#2F80C9', '<rect x="-22" y="-6" width="44" height="26" fill="#fff"/><path d="M-4 -6V-24" stroke="#fff" stroke-width="4"/><path d="M-2 -24H14V-16H-2Z" fill="#fff"/>', 'sekolah'],
    masjid: ['#4DAA57', '<path d="M-18 20V2Q-18 -18 0 -20Q18 -18 18 2V20Z" fill="#fff"/><path d="M0 -20V-28" stroke="#fff" stroke-width="4"/>', 'masjid'],
    pasar: ['#FFC83D', '<path d="M-24 -4L-18 -20H18L24 -4Z" fill="#fff"/><rect x="-20" y="0" width="40" height="20" fill="#fff"/>', 'pasar'],
    puskesmas: ['#0F8C7A', '<path d="M-7 -22H7V-7H22V7H7V22H-7V7H-22V-7H-7Z" fill="#fff"/>', 'puskesmas'],
    pond: ['#3FA7C4', '<path d="M-20 -4Q-10 -12 0 -4T20 -4M-20 10Q-10 2 0 10T20 10" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>', 'kolam']
  };
  function symArt(k, size) {
    const s = SYM[k], h = size / 2;
    return '<rect x="' + (-h) + '" y="' + (-h) + '" width="' + size + '" height="' + size + '" rx="' + n1(size * 0.18) + '" fill="' + s[0] + '" stroke="' + OL + '" stroke-width="3"/>' +
      '<g transform="scale(' + n1(size / 64) + ')">' + s[1] + '</g>';
  }
  function itemArt(kind, s) {
    if (kind === 'flag') return '<g transform="scale(' + n1(s / 110) + ')">' + ART.flag() + '</g>';
    let a = '';
    try { a = GS.art.item(kind, { shadow: true }); } catch (e) { a = ''; }
    return '<g transform="translate(0 ' + n1(s * 0.3) + ') scale(' + n1(s * 0.55 / 100) + ')">' + a + '</g>';
  }
  function objArt(x, s) {
    if (L.style === 'denah' && SYM[x.k]) return symArt(x.k, Math.round(s * 0.78));
    const k = s / 100;
    let a = '';
    if (x.k === 'rumah') a = houseArt(x.color && x.color[0]);
    else if (ART[x.k]) a = ART[x.k]();
    return '<g transform="scale(' + n1(k) + ')">' + a + '</g>';
  }

  /* Card glyphs (local coords, centre 0,0, about +-32). */
  const ARROW = 'M-28 -9H4V-24L30 0L4 24V9H-28Z';
  const FAM = {
    abs: ['#E4F0FC', '#2F80C9'], cmp: ['#DFF3EE', '#0F8C7A'], fwd: ['#FDEBD8', '#F28C28'], turn: ['#FDEBD8', '#F28C28'],
    loop: ['#FFF3C4', '#E09A00'], proc: ['#E3F2E1', '#4DAA57'], del: ['#EFE6DA', '#8A7358']
  };
  function arc(deg, r, col, w) {
    const a0 = -Math.PI / 2, a1 = a0 + deg * Math.PI / 180 - 0.35;
    const p = a => [n1(r * Math.cos(a)), n1(r * Math.sin(a))];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    const large = deg > 190 ? 1 : 0;
    const d = 'M' + x0 + ' ' + y0 + 'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1 + ' ' + y1;
    const tx = -Math.sin(a1), ty = Math.cos(a1), nx = Math.cos(a1), ny = Math.sin(a1);
    const hx = x1 + tx * 15, hy = y1 + ty * 15;
    const head = 'M' + n1(x1 + nx * 13) + ' ' + n1(y1 + ny * 13) + 'L' + n1(hx) + ' ' + n1(hy) + 'L' + n1(x1 - nx * 13) + ' ' + n1(y1 - ny * 13) + 'Z';
    return '<path d="' + d + '" fill="none" stroke="' + OL + '" stroke-width="' + (w + 7) + '" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>' +
      '<path d="' + head + '" fill="' + col + '" ' + S3 + '/>';
  }
  function glyph(t, col) {
    const d = CT[t];
    if (d.fam === 'abs') return '<path d="' + ARROW + '" fill="' + col + '" ' + S3 + ' transform="rotate(' + (d.dir * 90 - 90) + ')"/>';
    if (d.fam === 'cmp') return '<text x="0" y="20" font-size="60" text-anchor="middle" class="t-display" fill="' + col + '" stroke="' + OL + '" stroke-width="2" paint-order="stroke">' + d.label + '</text>';
    if (d.fam === 'fwd') return '<circle cx="0" cy="22" r="9" fill="#FFF8EC" stroke="' + OL + '" stroke-width="3"/><path d="M-9 14V-6H-20L0 -30L20 -6H9V14Z" fill="' + col + '" ' + S3 + '/>';
    if (t === 'TL' || t === 'TR') {
      const g = '<path d="M-12 28V6Q-12 -12 6 -12H10" fill="none" stroke="' + OL + '" stroke-width="20" stroke-linecap="round"/><path d="M-12 28V6Q-12 -12 6 -12H10" fill="none" stroke="' + col + '" stroke-width="12" stroke-linecap="round"/>' +
        '<path d="M8 -30L32 -12L8 6Z" fill="' + col + '" ' + S3 + '/>';
      return t === 'TL' ? '<g transform="scale(-1 1)">' + g + '</g>' : g;
    }
    if (d.fam === 'turn') return arc(d.d * 90, 22, col, 9);
    if (d.fam === 'loop') return '<g transform="translate(0 -2)">' + arc(300, 22, col, 9) + '</g>';
    if (d.fam === 'proc') return '<path d="M0 -32L9 -11L32 -10L14 4L20 27L0 14L-20 27L-14 4L-32 -10L-9 -11Z" fill="#FFC83D" ' + S3 + '/>';
    if (d.fam === 'del') return '<path d="M-32 0L-14 -20H28V20H-14Z" fill="' + col + '" ' + S3 + '/><path d="M-2 -8L14 8M14 -8L-2 8" stroke="#fff" stroke-width="5" stroke-linecap="round"/>';
    return '';
  }
  const TXT = (x, y, s, size, o) => {
    o = o || {};
    return '<text x="' + n1(x) + '" y="' + n1(y + size * 0.35) + '" font-size="' + size + '" text-anchor="' + (o.anchor || 'middle') + '" fill="' + (o.fill || INK) + '"' +
      (o.body ? ' class="t-body" font-weight="700"' : o.display ? ' class="t-display"' : ' font-weight="600" style="font-variant-numeric:tabular-nums"') +
      (o.decor ? ' data-qc="decor"' : '') + '>' + s + '</text>';
  };
  /** A card face. mode: 'pal' (palette tile, shows its word) or 'row' (placed card, shows its number). */
  function cardFace(c, size, mode, count) {
    const d = CT[c.t], col = FAM[d.fam], h = size / 2;
    let s = '<rect class="rb-face" x="' + (-h) + '" y="' + (-h) + '" width="' + size + '" height="' + size + '" rx="18" fill="' + col[0] + '" stroke="' + OL + '" stroke-width="4"/>' +
      '<rect x="' + (-h + 7) + '" y="' + (-h + 6) + '" width="' + (size - 14) + '" height="10" rx="5" fill="#fff" opacity=".55"/>';
    let label = null, big = false;
    if (mode === 'pal') {
      if (d.fam === 'fwd' || d.fam === 'loop' || d.fam === 'del') label = d.fam === 'fwd' ? 'maju' : d.fam === 'loop' ? 'ulangi' : 'hapus';
      else if (d.fam === 'turn') label = d.label;
    } else {
      if ((d.fam === 'abs' || d.fam === 'cmp' || d.fam === 'fwd') && L.numbered) { label = String(c.n || 1); big = true; }
      else if (d.fam === 'turn') label = d.label;
      else if (d.fam === 'loop') { label = '× ' + count; big = true; }
    }
    if (label == null) s += '<g transform="scale(1.15)">' + glyph(c.t, col[1]) + '</g>';
    else {
      s += '<g transform="translate(0 -16) scale(0.78)">' + glyph(c.t, col[1]) + '</g>';
      const num = /\d/.test(label);
      s += TXT(0, 32, label, num ? (big ? 40 : 36) : 30, num ? {} : { body: true });
    }
    return s;
  }

  /* ================= stage ================= */
  const svg = document.getElementById('stage');
  const dock = document.getElementById('dock');
  const bgG = GS.el('g', { class: 'rb-bg' }, svg);
  const world = GS.el('g', { class: 'rb-world' }, svg);
  drawBackground();
  function drawBackground() {
    const r = seeded(31);
    let s = '<rect x="-700" y="-20" width="2680" height="860" fill="#7CC26B"/>';
    for (let i = 0; i < 120; i++) {
      const x = -680 + r() * 2640, y = -10 + r() * 820, k = 0.8 + r() * 0.8;
      s += '<path d="M' + n1(x - 8 * k) + ' ' + n1(y) + 'Q' + n1(x - 6 * k) + ' ' + n1(y - 12 * k) + ' ' + n1(x - 10 * k) + ' ' + n1(y - 16 * k) + 'Q' + n1(x) + ' ' + n1(y - 8 * k) + ' ' + n1(x + 10 * k) + ' ' + n1(y - 14 * k) + 'Q' + n1(x + 6 * k) + ' ' + n1(y - 6 * k) + ' ' + n1(x + 8 * k) + ' ' + n1(y) + 'Z" fill="' + (i % 3 ? '#5FAE52' : '#6DBA5E') + '"/>';
    }
    const FL = ['#F59AB0', '#FFC83D', '#FFF8EC'];
    for (let i = 0; i < 50; i++) s += '<circle cx="' + n1(-680 + r() * 2640) + '" cy="' + n1(r() * 800) + '" r="' + n1(3 + r() * 2.5) + '" fill="' + FL[i % 3] + '"/>';
    GS.markup(bgG, '<g class="gs-scene">' + s + '</g>');
  }

  /* ================= layout ================= */
  const MAPX0 = 20, MAPX1 = 806, MAPY0 = 14;
  const SLOT = 116, CARD = 108, ROWX = 30;
  const PAL_X = [908, 1042, 1176], PAL_Y = [208, 342], TILE = 112;
  const SIGN = { x: 846, y: 14, w: 412, h: 124 };
  const INFO = { x: 846, y: 404, w: 412, h: 210 };
  let L = null, G = null;
  const mapBottom = () => (L.box ? 552 : 618);
  const rowTop = row => (row === 'main' ? (L.box ? 566 : 636) : 682);
  function geom() {
    const lab = L.labels ? 60 : 0, labB = L.labels ? 52 : 0;
    const x0 = MAPX0 + lab, x1 = MAPX1, y0 = MAPY0, y1 = mapBottom() - labB;
    const cell = Math.floor(Math.min((x1 - x0) / L.cols, (y1 - y0) / L.rows, TK ? 124 : 112));
    const w = cell * L.cols, h = cell * L.rows;
    return { cell, w, h, x: Math.round(x0 + (x1 - x0 - w) / 2), y: Math.round(y0 + (y1 - y0 - h) / 2) };
  }
  const cx = c => G.x + (c + 0.5) * G.cell;
  const cy = r => G.y + (r + 0.5) * G.cell;
  const feet = (c, r) => ({ x: cx(c), y: cy(r) + G.cell * 0.3 });

  /* ================= state ================= */
  const layers = {};
  let P = null;                 // program: { main, box, count, active, cursor }
  let tries = 0, busy = false, tok = 0, solving = false, demoMode = false, after = false;
  let hl = null, bad = null;    // the running card and the card that made Chuppy stop
  let robot = null, btnGo = null;
  const palEl = {}, rowHit = {};
  let cardEls = { main: [], box: [] }, countEl = null;

  const hud = GS.hud({ gameId: GAME, title: 'Chuppy Jalan-jalan', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: i => buildLevel(i), demo: demoSpec });

  function buildLevel(i, demo) {
    tok++; busy = false; tries = 0; after = false; hl = null; bad = null;
    demoMode = !!demo;
    if (demo) L = demoLevel(i);
    else {
      const dsig = demoLevel(i).sig;
      L = makeLevel(i, Math.random);
      for (let k = 0; k < 10 && L.sig === dsig; k++) L = makeLevel(i, Math.random);
    }
    G = geom();
    P = { main: L.preset ? cloneCards(L.preset) : [], box: [], count: L.box ? (L.box.cmin || 2) : 2, active: 'main', cursor: 0 };
    P.cursor = P.main.length;
    world.innerHTML = '';
    ['board', 'tiles', 'marks', 'labels', 'objs', 'trail', 'robot', 'fx', 'panel', 'rows', 'pal', 'sign', 'info'].forEach(k => { layers[k] = GS.el('g', { class: 'rb-' + k }, world); });
    layers.fx.setAttribute('pointer-events', 'none');
    drawBoard(); drawObjects(); drawLabels(); drawRobot(); drawPanel(); drawPalette(); drawSign(); drawInfo(); drawRows();
    dock.innerHTML = '';
    btnGo = document.createElement('button');
    btnGo.type = 'button'; btnGo.className = 'gs-action';
    btnGo.innerHTML = GS.ICON.play + '<span>Jalan!</span>';
    btnGo.addEventListener('click', () => { if (btnGo.disabled) return; GS.sfx.click(); goRun(); });
    dock.appendChild(btnGo);
    updateDock();
    hud.mood('happy');
    if (!demoMode) GS.say(L.say);
  }
  function updateDock() { if (btnGo) btnGo.disabled = busy; }

  /* ================= drawing: the map ================= */
  function drawBoard() {
    const g = layers.board, s = G.cell, pad = 14;
    const x = G.x - pad, y = G.y - pad, w = G.w + 2 * pad, h = G.h + 2 * pad;
    let m = '';
    if (L.style === 'denah') {
      m += '<rect x="' + (x + 4) + '" y="' + (y + 8) + '" width="' + w + '" height="' + h + '" rx="18" fill="' + OL + '" opacity=".25"/>' +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="18" fill="#FFF8EC" stroke="' + OL + '" stroke-width="4"/>';
      for (let c = 0; c <= L.cols; c++) m += '<path d="M' + (G.x + c * s) + ' ' + G.y + 'V' + (G.y + G.h) + '" stroke="#D9C7A6" stroke-width="2.5"/>';
      for (let r = 0; r <= L.rows; r++) m += '<path d="M' + G.x + ' ' + (G.y + r * s) + 'H' + (G.x + G.w) + '" stroke="#D9C7A6" stroke-width="2.5"/>';
    } else {
      m += '<rect x="' + (x + 4) + '" y="' + (y + 8) + '" width="' + w + '" height="' + h + '" rx="20" fill="' + OL + '" opacity=".22"/>' +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="20" fill="#A8D88F" stroke="#7E4A27" stroke-width="10"/>' +
        '<rect x="' + (x + 5) + '" y="' + (y + 5) + '" width="' + (w - 10) + '" height="' + (h - 10) + '" rx="16" fill="none" stroke="#C68654" stroke-width="3"/>';
      if (L.lattice) {
        for (let r = 0; r < L.rows; r++) m += '<path d="M' + cx(0) + ' ' + cy(r) + 'H' + cx(L.cols - 1) + '" stroke="#D4A062" stroke-width="' + n1(s * 0.3) + '" stroke-linecap="round"/>';
        for (let c = 0; c < L.cols; c++) m += '<path d="M' + cx(c) + ' ' + cy(0) + 'V' + cy(L.rows - 1) + '" stroke="#D4A062" stroke-width="' + n1(s * 0.3) + '" stroke-linecap="round"/>';
        for (let r = 0; r < L.rows; r++) m += '<path d="M' + cx(0) + ' ' + cy(r) + 'H' + cx(L.cols - 1) + '" stroke="#EBD3A4" stroke-width="' + n1(s * 0.22) + '" stroke-linecap="round"/>';
        for (let c = 0; c < L.cols; c++) m += '<path d="M' + cx(c) + ' ' + cy(0) + 'V' + cy(L.rows - 1) + '" stroke="#EBD3A4" stroke-width="' + n1(s * 0.22) + '" stroke-linecap="round"/>';
        for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) m += '<circle cx="' + cx(c) + '" cy="' + cy(r) + '" r="' + n1(s * 0.15) + '" fill="#F3DDA6" stroke="#D4A062" stroke-width="2.5"/>';
      } else {
        for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
          m += '<rect x="' + (G.x + c * s + 2) + '" y="' + (G.y + r * s + 2) + '" width="' + (s - 4) + '" height="' + (s - 4) + '" rx="8" fill="' + ((c + r) % 2 ? '#93CF7F' : '#9DD58A') + '"/>';
        }
        for (let c = 0; c <= L.cols; c++) m += '<path d="M' + (G.x + c * s) + ' ' + G.y + 'V' + (G.y + G.h) + '" stroke="#6FB15F" stroke-width="2" opacity=".55"/>';
        for (let r = 0; r <= L.rows; r++) m += '<path d="M' + G.x + ' ' + (G.y + r * s) + 'H' + (G.x + G.w) + '" stroke="#6FB15F" stroke-width="2" opacity=".55"/>';
      }
    }
    GS.markup(g, m);
    // water, bridges, paddies are ground tiles
    let t = '';
    const M = L.M;
    Object.keys(M.cell).forEach(k => {
      const x0 = M.cell[k];
      const [c, r] = k.split(',').map(Number);
      const X = G.x + c * s, Y = G.y + r * s;
      if (x0.k === 'water' || x0.k === 'bridge') {
        t += '<rect x="' + X + '" y="' + Y + '" width="' + s + '" height="' + s + '" fill="#3FA7C4"/>' +
          '<path d="M' + (X + s * 0.18) + ' ' + (Y + s * 0.35) + 'q' + n1(s * 0.16) + ' -' + n1(s * 0.1) + ' ' + n1(s * 0.32) + ' 0M' + (X + s * 0.5) + ' ' + (Y + s * 0.7) + 'q' + n1(s * 0.16) + ' -' + n1(s * 0.1) + ' ' + n1(s * 0.32) + ' 0" stroke="#9FD8E8" stroke-width="4" fill="none" stroke-linecap="round"/>';
        if (x0.k === 'bridge') {
          const hz = x0.o === 'h';   // a vertical river: the bridge runs left-right
          for (let i = 0; i < 5; i++) {
            const o = s * (0.1 + i * 0.17);
            t += hz ? '<rect x="' + n1(X + o) + '" y="' + n1(Y + s * 0.18) + '" width="' + n1(s * 0.15) + '" height="' + n1(s * 0.64) + '" rx="3" fill="#C68654" stroke="' + OL + '" stroke-width="2.6"/>'
              : '<rect x="' + n1(X + s * 0.18) + '" y="' + n1(Y + o) + '" width="' + n1(s * 0.64) + '" height="' + n1(s * 0.15) + '" rx="3" fill="#C68654" stroke="' + OL + '" stroke-width="2.6"/>';
          }
        }
      } else if (x0.k === 'pond' && L.style !== 'denah') {
        t += '<ellipse cx="' + cx(c) + '" cy="' + cy(r) + '" rx="' + n1(s * 0.5) + '" ry="' + n1(s * 0.44) + '" fill="#3FA7C4" stroke="#2C7F99" stroke-width="3"/>' +
          '<path d="M' + n1(cx(c) - s * 0.2) + ' ' + n1(cy(r) - s * 0.05) + 'q' + n1(s * 0.1) + ' -' + n1(s * 0.07) + ' ' + n1(s * 0.2) + ' 0" stroke="#9FD8E8" stroke-width="4" fill="none" stroke-linecap="round"/>';
      }
    });
    GS.markup(layers.tiles, t);
    // guides: counting dots (TK) and footprints
    let mk = '';
    M.dots.forEach(([c, r]) => { if (!same(M.goal, c, r)) mk += '<circle cx="' + cx(c) + '" cy="' + cy(r) + '" r="' + n1(s * 0.12) + '" fill="#FFF8EC" stroke="#C99A5B" stroke-width="3"/>'; });
    M.foot.forEach(([c, r, d]) => { mk += '<g transform="translate(' + cx(c) + ' ' + cy(r) + ') rotate(' + (d * 90) + ')">' + footArt(s, '#7E5A36', 0.55) + '</g>'; });
    if (M.gk === 'start') mk += '<g transform="translate(' + cx(M.start.c) + ' ' + cy(M.start.r) + ') scale(' + n1(s / 100) + ')">' + ART.mat() + '</g>';
    GS.markup(layers.marks, mk);
  }
  function footArt(s, col, op) {
    const k = s / 100;
    return '<g transform="scale(' + n1(k) + ')" opacity="' + op + '"><ellipse cx="-11" cy="6" rx="8" ry="12" fill="' + col + '"/><ellipse cx="11" cy="-8" rx="8" ry="12" fill="' + col + '"/></g>';
  }
  function drawObjects() {
    const g = layers.objs, M = L.M, s = G.cell;
    g.innerHTML = '';
    const list = [];
    Object.keys(M.cell).forEach(k => { const x = M.cell[k]; if (x.k === 'water' || x.k === 'bridge' || (x.k === 'pond' && L.style !== 'denah')) return; const [c, r] = k.split(',').map(Number); list.push({ c, r, x }); });
    list.sort((a, b) => a.r - b.r || a.c - b.c);
    list.forEach(o => GS.markup(g, '<g transform="translate(' + cx(o.c) + ' ' + cy(o.r) + ')">' + objArt(o.x, s) + '</g>'));
    // goal marker
    if (M.goal && (M.gk === 'rumah' || M.gk === 'flag')) {
      const a = M.gk === 'rumah' ? houseArt('#E2453C') : ART.flag();
      GS.markup(g, '<g transform="translate(' + cx(M.goal.c) + ' ' + cy(M.goal.r) + ') scale(' + n1(s / 100) + ')">' + a + '</g>');
    }
    // stops shown as houses (star-card level)
    M.seq.forEach((q, i) => {
      if (q.type === 'stop' && q.house) GS.markup(g, '<g transform="translate(' + cx(q.c) + ' ' + cy(q.r) + ') scale(' + n1(s / 100) + ')">' + houseArt('#2F80C9') + '</g>');
    });
    // items
    S.itemEls = M.items.map(it => {
      const e = GS.el('g', { transform: 'translate(' + cx(it.c) + ' ' + cy(it.r) + ')' }, g);
      GS.markup(e, itemArt(it.kind, s));
      return e;
    });
    S.seqEls = M.seq.map(q => {
      if (q.type !== 'item') return null;
      const e = GS.el('g', { transform: 'translate(' + cx(q.c) + ' ' + cy(q.r) + ')' }, g);
      GS.markup(e, itemArt(q.kind, s) + '<circle cx="' + n1(-s * 0.3) + '" cy="' + n1(-s * 0.28) + '" r="24" fill="#FFF8EC" stroke="' + OL + '" stroke-width="3"/>' + TXT(-s * 0.3, -s * 0.28, q.n, 36));
      return e;
    });
  }
  const S = {};
  function drawLabels() {
    const g = layers.labels;
    if (!L.labels) return;
    let m = '';
    const yb = G.y + G.h + 38, xl = G.x - 34;
    if (L.labels === 'grid') {
      for (let c = 0; c < L.cols; c++) m += TXT(cx(c), yb, LETTERS[c], 38, { display: true });
      for (let r = 0; r < L.rows; r++) m += TXT(xl, cy(r), L.rows - r, 38);
    } else {
      for (let c = 0; c < L.cols; c++) m += TXT(cx(c), yb, c, 38);
      for (let r = 0; r < L.rows; r++) m += TXT(xl, cy(r), L.rows - 1 - r, 38);
      m += TXT(G.x + G.w + 4, yb, 'x', 34, { body: true, anchor: 'start' });
      m += TXT(xl, G.y - 6, 'y', 34, { body: true });
    }
    GS.markup(g, m);
  }

  /* ================= Chuppy ================= */
  const BACK = '<g class="rb-back"><rect x="44" y="43" width="112" height="74" rx="34" fill="#F4EDE1"/><path d="M62 62Q100 52 138 62" stroke="#DCCFBB" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<circle cx="100" cy="148" r="18" fill="#F4EDE1"/><path d="M86 92h28M86 103h28" stroke="#CFC2AC" stroke-width="5" stroke-linecap="round"/></g>';
  function drawRobot() {
    const g = layers.robot;
    g.innerHTML = '';
    const p = feet(L.M.start.c, L.M.start.r);
    const outer = GS.el('g', { transform: 'translate(' + n1(p.x) + ' ' + n1(p.y) + ')' }, g);
    const bump = GS.el('g', null, outer);
    const sprite = GS.el('g', null, bump);
    const badge = GS.el('g', { transform: 'translate(' + n1(G.cell * 0.36) + ' ' + n1(-G.cell * 0.1) + ')' }, outer);
    robot = { outer, bump, sprite, badge, c: L.M.start.c, r: L.M.start.r, f: L.M.start.f, x: p.x, y: p.y };
    setFacing(L.M.start.f, true);
    if (L.facing) {
      GS.markup(badge, '<circle r="25" fill="#FFF8EC" stroke="' + OL + '" stroke-width="3.5"/>');
      robot.arrow = GS.el('g', null, badge);
      GS.markup(robot.arrow, '<path d="M-14 -6H2V-15L18 0L2 15V6H-14Z" fill="#0F8C7A" stroke="' + OL + '" stroke-width="2.6" stroke-linejoin="round"/>');
      robot.arrow.setAttribute('transform', 'rotate(' + (robot.f * 90 - 90) + ')');
    }
  }
  /** Draw Chuppy facing f (0 back to us, 1 right, 2 front, 3 left), or in a mood facing us. */
  function setSprite(mood, f) {
    const size = Math.round(G.cell * 1.02);
    let m = mood || 'idle', flip = false, back = false;
    if (f != null) {
      if (f === 1) m = 'point';
      else if (f === 3) { m = 'point'; flip = true; }
      else if (f === 0) { m = 'idle'; back = true; }
    }
    const sp = robot.sprite;
    sp.innerHTML = '';
    let mk = '';
    try { mk = GS.art.mascot({ char: 'chuppy', mood: m, size }); } catch (e) { mk = '<circle r="30" fill="#FBF6EC"/>'; }
    GS.markup(sp, mk);
    const el = sp.querySelector('svg');
    if (el) {
      el.setAttribute('x', -size / 2); el.setAttribute('y', -size * 0.96); el.setAttribute('width', size); el.setAttribute('height', size);
      if (back) { const b = el.querySelector('.m-body') || el; GS.markup(b, BACK); }
      if (robot.walking) el.classList.add('walk');
    }
    sp.setAttribute('transform', flip ? 'scale(-1 1)' : 'scale(1 1)');
  }
  function setFacing(f, now) {
    robot.f = f;
    setSprite(null, f === 2 ? null : f);
    if (robot.arrow) {
      const to = f * 90 - 90;
      if (now || GS.reducedMotion) robot.arrow.setAttribute('transform', 'rotate(' + to + ')');
      else {
        let from = robot.arrowDeg == null ? to : robot.arrowDeg;
        let d = to - from; while (d > 180) d -= 360; while (d < -180) d += 360;
        tween(240, e => robot.arrow.setAttribute('transform', 'rotate(' + n1(from + d * e) + ')'));
      }
      robot.arrowDeg = to;
    }
  }
  function placeRobot(c, r) {
    const p = feet(c, r);
    robot.c = c; robot.r = r; robot.x = p.x; robot.y = p.y;
    robot.outer.setAttribute('transform', 'translate(' + n1(p.x) + ' ' + n1(p.y) + ')');
  }
  function walking(on) {
    robot.walking = on;
    const el = robot.sprite.querySelector('svg');
    if (el) el.classList.toggle('walk', on && !GS.reducedMotion);
  }
  /** Back to the start after a finished run (the child edits or runs again). */
  function resetRun() {
    if (!after) return;
    after = false; hl = null; bad = null;
    layers.trail.innerHTML = ''; layers.fx.innerHTML = '';
    robot.outer.setAttribute('opacity', '1');
    placeRobot(L.M.start.c, L.M.start.r);
    robot.bump.removeAttribute('transform');
    setFacing(L.M.start.f, true);
    drawObjects(); drawInfo();
    hud.mood('happy');
  }

  /* ================= drawing: panel, palette, sign, info, program rows ================= */
  function drawPanel() {
    let m = '<rect x="836" y="6" width="432" height="612" rx="26" fill="' + OL + '" opacity=".2" transform="translate(4 8)"/>' +
      '<rect x="836" y="6" width="432" height="612" rx="26" fill="#FFF3E0" stroke="' + OL + '" stroke-width="4"/>';
    const top = rowTop('main') - 14, bottom = (L.box ? rowTop('box') : rowTop('main')) + CARD + 14;
    m += '<rect x="10" y="' + top + '" width="' + (ROWX + 7 * SLOT + 8) + '" height="' + (bottom - top) + '" rx="24" fill="#C68654" stroke="' + OL + '" stroke-width="4"/>' +
      '<rect x="18" y="' + (top + 7) + '" width="' + (ROWX + 7 * SLOT - 8) + '" height="10" rx="5" fill="#E0A774" opacity=".8"/>';
    GS.markup(layers.panel, m);
  }
  function hitTarget(parent, x, y, w, h, name, onTap, label) {
    const g = GS.el('g', { transform: 'translate(' + n1(x) + ' ' + n1(y) + ')', class: 'rb-hit', 'data-hit': name, tabindex: 0, role: 'button', 'aria-label': label || name }, parent);
    g.addEventListener('click', e => { e.stopPropagation(); onTap(); });
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); } });
    GS.el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'transparent' }, g);
    return g;
  }
  function paletteList() {
    const p = (PALETTE[L.set] || PALETTE.abs).slice();
    if (L.box) { if (p.indexOf('DEL') >= 0) p.splice(p.indexOf('DEL'), 1, L.box.kind === 'loop' ? 'LOOP' : 'PROC', 'DEL'); else p.push(L.box.kind === 'loop' ? 'LOOP' : 'PROC'); }
    if (p.indexOf('DEL') < 0) p.push('DEL');
    return p;
  }
  function drawPalette() {
    const g = layers.pal;
    g.innerHTML = '';
    Object.keys(palEl).forEach(k => delete palEl[k]);
    let list = paletteList();
    // arrows keep a d-pad layout: left up right / hapus down (ulangi)
    const pos = {};
    if (L.set === 'step' || L.set === 'abs') {
      pos.L = [0, 0]; pos.U = [1, 0]; pos.R = [2, 0]; pos.DEL = [0, 1]; pos.D = [1, 1]; pos.LOOP = [2, 1]; pos.PROC = [2, 1];
    } else list.forEach((t, i) => { pos[t] = [i % 3, Math.floor(i / 3)]; });
    list.forEach(t => {
      const [ci, ri] = pos[t];
      const e = hitTarget(g, PAL_X[ci], PAL_Y[ri], TILE, TILE, 'pal', () => onPalette(t), CT[t].name);
      GS.markup(e, cardFace({ t, n: 1 }, TILE, 'pal'));
      palEl[t] = e;
    });
  }
  function wrapText(s, max) {
    const words = String(s).split(' '), lines = [];
    let cur = '';
    words.forEach(w => { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawSign() {
    const g = layers.sign, M = L.M;
    g.innerHTML = '';
    let m = '<rect x="' + SIGN.x + '" y="' + SIGN.y + '" width="' + SIGN.w + '" height="' + SIGN.h + '" rx="20" fill="#FFF8EC" stroke="' + OL + '" stroke-width="3.5"/>';
    const rose = L.set === 'cmp';
    if (TK) {
      // no reading needed: Chuppy -> (items) -> house
      const y = SIGN.y + SIGN.h / 2;
      let x = SIGN.x + 60;
      let head = '';
      try { head = GS.art.mascotHead('chuppy', 84, 'happy'); } catch (e) { head = ''; }
      m += '<g transform="translate(' + (x - 42) + ' ' + (y - 42) + ')">' + head.replace('<svg', '<svg width="84" height="84"') + '</g>';
      x += 70;
      const arrow = xx => '<path d="M' + (xx - 16) + ' ' + y + 'h22m-8 -10l10 10l-10 10" stroke="' + OL + '" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      if (M.items.length) {
        m += arrow(x); x += 46;
        M.items.forEach(it => { m += '<g transform="translate(' + x + ' ' + (y - 20) + ')">' + itemArt(it.kind, 84) + '</g>'; x += 62; });
      }
      m += arrow(x); x += 66;
      m += '<g transform="translate(' + x + ' ' + (y + 10) + ') scale(0.82)">' + houseArt('#E2453C') + '</g>';
    } else {
      const lines = wrapText(L.sign || '', rose ? 14 : 22).slice(0, 3);
      const x = rose ? SIGN.x + 20 : SIGN.x + SIGN.w / 2;
      const y0 = SIGN.y + SIGN.h / 2 - (lines.length - 1) * 19;
      lines.forEach((ln, i) => { m += TXT(x, y0 + i * 38, ln, /\d/.test(ln) ? 36 : 32, { body: true, anchor: rose ? 'start' : 'middle' }); });
      if (rose) m += roseArt(SIGN.x + SIGN.w - 66, SIGN.y + SIGN.h / 2, 56);
    }
    GS.markup(g, m);
  }
  function roseArt(x, y, R0) {
    const north = L.north || 0;
    let m = '<g transform="translate(' + x + ' ' + y + ')"><circle r="' + R0 + '" fill="#DFF3EE" stroke="' + OL + '" stroke-width="3"/>';
    m += '<g transform="rotate(' + north * 90 + ')"><path d="M0 -' + (R0 - 22) + 'L9 0L0 ' + (R0 - 22) + 'L-9 0Z" fill="#FFF8EC" stroke="' + OL + '" stroke-width="2.4"/><path d="M0 -' + (R0 - 22) + 'L9 0H-9Z" fill="#E2453C" stroke="' + OL + '" stroke-width="2.4" stroke-linejoin="round"/></g>';
    ['U', 'T', 'S', 'B'].forEach((t, k) => {
      const a = ((north + k) % 4) * Math.PI / 2;
      m += TXT(Math.sin(a) * (R0 - 13), -Math.cos(a) * (R0 - 13), t, 30, { display: true, fill: k === 0 ? '#B5322B' : INK });
    });
    return m + '</g>';
  }
  function drawInfo() {
    const g = layers.info, M = L.M;
    g.innerHTML = '';
    const list = L.info.filter(w => w !== 'rose');
    if (!list.length) return;
    const X = INFO.x, Y = INFO.y, W = INFO.w;
    let m = '<rect x="' + X + '" y="' + Y + '" width="' + W + '" height="' + INFO.h + '" rx="20" fill="#FFF8EC" stroke="' + OL + '" stroke-width="3"/>';
    const one = list[0];
    if (one === 'battery') {
      const N = M.battery || 0, left = Math.max(0, N - (S.used || 0));
      const bw = 250, bh = 78, bx = X + (W - bw) / 2 - 8, by = Y + 24;
      m += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="14" fill="#fff" stroke="' + OL + '" stroke-width="4"/>' +
        '<rect x="' + (bx + bw) + '" y="' + (by + 24) + '" width="16" height="30" rx="5" fill="' + OL + '"/>';
      const sw = (bw - 16) / Math.max(1, N);
      for (let i = 0; i < N; i++) m += '<rect x="' + n1(bx + 8 + i * sw + 2) + '" y="' + (by + 9) + '" width="' + n1(sw - 4) + '" height="' + (bh - 18) + '" rx="4" fill="' + (i < left ? '#4DAA57' : '#E4DCCF') + '"/>';
      const txt = L.scale ? left * L.scale + ' m' : left + ' langkah';
      m += TXT(X + W / 2, by + bh + 36, txt, 38);
      if (L.scale) m += TXT(X + W / 2, by + bh + 82, '1 kotak = ' + L.scale + ' m', 36);
    } else if (one === 'scale') {
      const s = 66, x0 = X + 40, y0 = Y + (INFO.h - s) / 2;
      m += '<rect x="' + x0 + '" y="' + y0 + '" width="' + s + '" height="' + s + '" rx="8" fill="#9DD58A" stroke="' + OL + '" stroke-width="3"/>';
      m += TXT(x0 + s + 24, Y + INFO.h / 2 - 26, 'satu kotak', 32, { body: true, anchor: 'start' });
      m += TXT(x0 + s + 24, Y + INFO.h / 2 + 26, '= ' + L.scale + ' meter', 38, { anchor: 'start' });
    } else if (one === 'legend') {
      const keys = ['rumah', 'sekolah', 'masjid', 'pasar', 'puskesmas', 'pond'];
      keys.forEach((k, i) => {
        const col = i % 2, row = Math.floor(i / 2), x0 = X + 24 + col * 200, y0 = Y + 40 + row * 64;
        m += '<g transform="translate(' + (x0 + 24) + ' ' + y0 + ')">' + symArt(k, 48) + '</g>' + TXT(x0 + 58, y0, SYM[k][2], 30, { body: true, anchor: 'start' });
      });
    } else if (one === 'order') {
      const y = Y + INFO.h / 2;
      M.seq.forEach((q, i) => {
        const x0 = X + 60 + i * 150, done = (S.si || 0) > i;
        m += '<circle cx="' + x0 + '" cy="' + y + '" r="28" fill="' + (done ? '#0F8C7A' : '#FFF8EC') + '" stroke="' + OL + '" stroke-width="3"/>' + TXT(x0, y, q.n, 38, { fill: done ? '#fff' : INK });
        m += '<g transform="translate(' + (x0 + 66) + ' ' + (y - 34) + ')">' + itemArt(q.kind, 100) + '</g>';
      });
      m += '<g transform="translate(' + (X + 360) + ' ' + (y + 12) + ') scale(0.7)">' + houseArt('#E2453C') + '</g>';
    } else if (one === 'count') {
      const n = cardCount(P);
      m += TXT(X + W / 2, Y + 64, 'Kartu dipakai', 32, { body: true });
      m += TXT(X + W / 2, Y + 140, n, 64);
    }
    GS.markup(g, m);
  }
  function drawRows() {
    const g = layers.rows;
    g.innerHTML = '';
    cardEls = { main: [], box: [] }; countEl = null;
    drawRow('main');
    if (L.box) drawRow('box');
    if (L.info.indexOf('count') >= 0) drawInfo();
  }
  function rowSlots(row) { return row === 'main' ? L.maxMain : L.box.max; }
  function drawRow(row) {
    const g = layers.rows, y = rowTop(row), off = row === 'box' ? 1 : 0, cap = rowSlots(row), arr = P[row];
    const x0 = ROWX + off * SLOT - 8, w = (cap + off) * SLOT - off * SLOT + 8;
    const active = P.active === row && !busy;
    // row background (tap: write in this row); empty slots
    const bgEl = hitTarget(g, x0 + w / 2 - 4, y + CARD / 2, w + 8, CARD + 14, 'row', () => onRowTap(row), row === 'main' ? 'Program' : 'Isi kotak');
    rowHit[row] = bgEl;
    let m = '<rect x="' + (-w / 2 - 4) + '" y="' + (-CARD / 2 - 7) + '" width="' + (w + 8) + '" height="' + (CARD + 14) + '" rx="18" fill="' + (row === 'box' ? '#F6E7C8' : '#EAD2B0') + '" stroke="' + (active && L.box ? '#0F8C7A' : OL) + '" stroke-width="' + (active && L.box ? 6 : 3) + '"/>';
    for (let k = 0; k < cap; k++) {
      const sx = ROWX + (off + k) * SLOT + CARD / 2 - (x0 + w / 2 - 4);
      m += '<rect x="' + n1(sx - CARD / 2 + 4) + '" y="' + (-CARD / 2 + 4) + '" width="' + (CARD - 8) + '" height="' + (CARD - 8) + '" rx="14" fill="none" stroke="#B08A60" stroke-width="3" stroke-dasharray="10 8"/>';
    }
    GS.markup(bgEl, m);
    if (row === 'box') {
      // header: the ulangi count (tap to change) or the star
      const hx = ROWX + CARD / 2, hy = y + CARD / 2;
      if (L.box.kind === 'loop') {
        countEl = hitTarget(g, hx, hy, CARD, CARD, 'count', onCount, 'Ulangi ' + P.count + ' kali');
        GS.markup(countEl, '<rect class="rb-face" x="-54" y="-54" width="108" height="108" rx="18" fill="#FFC83D" stroke="' + OL + '" stroke-width="4"/>' +
          '<g transform="translate(0 -18) scale(0.7)">' + glyph('LOOP', '#B07A00') + '</g>' + TXT(0, 30, '× ' + P.count, 40));
      } else {
        const e = GS.el('g', { transform: 'translate(' + hx + ' ' + hy + ')' }, g);
        GS.markup(e, '<rect x="-54" y="-54" width="108" height="108" rx="18" fill="#BFE3BB" stroke="' + OL + '" stroke-width="4"/>' + '<g transform="scale(1.1)">' + glyph('PROC', '#4DAA57') + '</g>');
      }
    }
    arr.forEach((c, i) => {
      const x = ROWX + (off + i) * SLOT + CARD / 2, yy = y + CARD / 2;
      const e = hitTarget(g, x, yy, CARD, CARD, 'card', () => onCardTap(row, i), CT[c.t].name + (L.numbered && isMove(c.t) ? ' ' + c.n : ''));
      const isHl = hl && hl.row === row && hl.i === i, isBad = bad && bad.row === row && bad.i === i;
      let face = '';
      if (isHl || isBad) face += '<rect x="-62" y="-62" width="124" height="124" rx="24" fill="none" stroke="' + (isBad ? '#F2A900' : '#FFE08A') + '" stroke-width="10"' + (isHl && !isBad ? ' class="rb-glow"' : '') + '/>';
      face += cardFace(c, CARD, 'row', P.count);
      if (isBad) face += '<circle cx="40" cy="-40" r="20" fill="#F2A900" stroke="' + OL + '" stroke-width="3"/><path d="M40 -50v12M40 -31v1" stroke="' + OL + '" stroke-width="5" stroke-linecap="round"/>';
      GS.markup(e, face);
      cardEls[row][i] = e;
    });
    // insert caret
    if (P.active === row && !busy && arr.length < cap) {
      const cxp = ROWX + (off + P.cursor) * SLOT - 5;
      GS.el('rect', { x: cxp - 5, y: y + 4, width: 10, height: CARD - 8, rx: 5, fill: '#FFC83D', stroke: OL, 'stroke-width': 2.5, class: 'rb-caret', 'pointer-events': 'none' }, g);
    }
  }

  /* ================= editing ================= */
  const canEdit = () => !busy;
  function bumpRow(row) { GS.sfx.oops(); GS.say(row === 'box' ? 'Kotaknya sudah penuh.' : TK ? 'Papannya sudah penuh.' : 'Papan programnya sudah penuh. Ketuk kartu untuk menghapus.'); }
  function onPalette(t) {
    if (!canEdit()) return;
    resetRun();
    if (t === 'DEL') {
      const arr = P[P.active];
      if (P.cursor > 0) onCardTap(P.active, P.cursor - 1, true); else if (arr.length) onCardTap(P.active, 0, true);
      return;
    }
    if (isCall(t)) {
      if (P.main.length >= L.maxMain) { bumpRow('main'); return; }
      const at = P.active === 'main' ? P.cursor : P.main.length;
      P.main.splice(at, 0, { t, n: 1 });
      GS.sfx.pop();
      if (!P.box.length) { P.active = 'box'; P.cursor = 0; } else { P.active = 'main'; P.cursor = at + 1; }
      drawRows();
      return;
    }
    const row = P.active, arr = P[row], prev = arr[P.cursor - 1];
    if (L.numbered && isMove(t) && prev && prev.t === t) {
      if (prev.n >= 9) { GS.sfx.oops(); return; }
      prev.n++; GS.sfx.count(prev.n); drawRows(); return;
    }
    if (arr.length >= rowSlots(row)) { bumpRow(row); return; }
    arr.splice(P.cursor, 0, { t, n: 1 });
    P.cursor++;
    GS.sfx.pick();
    drawRows();
  }
  function onCardTap(row, i, whole) {
    if (!canEdit()) return;
    resetRun();
    const arr = P[row], c = arr[i];
    if (!c) return;
    P.active = row;
    if (!whole && L.numbered && isMove(c.t) && c.n > 1) { c.n--; P.cursor = i + 1; GS.sfx.tick(); }
    else { arr.splice(i, 1); P.cursor = i; GS.sfx.drop(); }
    if (row === 'box' && !P.box.length) P.cursor = 0;
    drawRows();
  }
  function onRowTap(row) {
    if (!canEdit()) return;
    resetRun();
    P.active = row; P.cursor = P[row].length;
    GS.sfx.tick();
    drawRows();
  }
  function onCount() {
    if (!canEdit()) return;
    resetRun();
    const b = L.box;
    P.count = P.count >= b.cmax ? b.cmin : P.count + 1;
    GS.sfx.count(P.count);
    drawRows();
  }

  /* ================= running ================= */
  async function goRun() {
    if (busy) return;
    resetRun();
    if (!P.main.length) { GS.say(TK ? 'Pasang kartu panah dulu, ya.' : 'Pasang kartu dulu, ya.'); return; }
    if (usesBox(P) && !P.box.length) { GS.say('Kotaknya masih kosong. Isi dulu, ya.'); P.active = 'box'; P.cursor = 0; drawRows(); return; }
    const counted = !(L.preset && sameCards(P.main, L.preset) && !P.box.length);
    const my = tok;
    busy = true; updateDock(); drawRows();
    S.used = 0; S.si = 0;
    const tr = sim(L.M, P, L.north);
    await play(tr, my);
    if (my !== tok) return;
    busy = false; updateDock();
    if (tr.ok) await success(tr, my);
    else {
      after = true;
      if (counted) { tries++; if (tries === 2) run.offerDemo(); }
      hud.mood('think');
      setSprite('think', null);
      drawRows();
      GS.say(failMsg(tr));
    }
  }
  async function play(tr, my) {
    const s = G.cell;
    let lastSrc = null;
    for (const ev of tr.ev) {
      if (my !== tok) return;
      if (ev.src && (!lastSrc || lastSrc.row !== ev.src.row || lastSrc.i !== ev.src.i || ev.e === 'iter')) {
        lastSrc = ev.src; hl = { row: ev.src.row, i: ev.src.i }; drawRows();
        if (ev.e !== 'iter') await wait(90);
      }
      if (ev.e === 'iter') {
        if (countEl && ev.reps > 1) floatSvg(ROWX + CARD / 2, rowTop('box') - 18, (ev.k + 1) + ' dari ' + ev.reps);
        await wait(160);
      } else if (ev.e === 'face') { setFacing(ev.f); await wait(120); }
      else if (ev.e === 'turn') { setFacing(ev.f); GS.sfx.tick(); await wait(330); }
      else if (ev.e === 'move') {
        const a = { x: robot.x, y: robot.y }, b = feet(ev.c, ev.r);
        walking(true);
        await tween(360, e => robot.outer.setAttribute('transform', 'translate(' + n1(a.x + (b.x - a.x) * e) + ' ' + n1(a.y + (b.y - a.y) * e) + ')'), 'inOutCubic');
        if (my !== tok) return;
        placeRobot(ev.c, ev.r);
        walking(false);
        S.used = ev.used;
        stepMark(ev, s);
        GS.sfx.count(Math.min(ev.used, 14));
        if (L.M.battery != null) drawInfo();
      } else if (ev.e === 'item') {
        const el = S.itemEls[ev.i];
        GS.sfx.coin();
        if (el) await fadeUp(el);
      } else if (ev.e === 'seq') {
        const q = L.M.seq[ev.i];
        S.si = ev.i + 1;
        GS.sfx.coin();
        if (q.type === 'item' && S.seqEls[ev.i]) await fadeUp(S.seqEls[ev.i]);
        else if (q.hidden) popFlag(q.c, q.r);
        else popCheck(q.c, q.r);
        if (L.info.indexOf('order') >= 0) drawInfo();
      } else if (ev.e === 'bump') {
        bad = { row: ev.src.row, i: ev.src.i }; hl = null;
        walking(false);
        const dx = DC[robot.f] * s * 0.32, dy = DR[robot.f] * s * 0.32;
        GS.sfx.thud();
        await tween(140, e => robot.bump.setAttribute('transform', 'translate(' + n1(dx * e) + ' ' + n1(dy * e) + ')'), 'outCubic');
        burst(robot.x + DC[robot.f] * s * 0.5, robot.y - s * 0.35 + DR[robot.f] * s * 0.5);
        await tween(220, e => robot.bump.setAttribute('transform', 'translate(' + n1(dx * (1 - e)) + ' ' + n1(dy * (1 - e)) + ')'), 'outBack');
        setSprite('oops', null);
        await wait(300);
      } else if (ev.e === 'battery') {
        bad = { row: ev.src.row, i: ev.src.i }; hl = null;
        GS.sfx.creak();
        robot.outer.setAttribute('opacity', '0.7');
        setSprite('oops', null);
        await wait(400);
      }
    }
    hl = null;
    drawRows();
  }
  function stepMark(ev, s) {
    const g = GS.el('g', { transform: 'translate(' + n1(cx(ev.c)) + ' ' + n1(cy(ev.r)) + ') rotate(' + (ev.f * 90) + ')' }, layers.trail);
    GS.markup(g, footArt(s, '#2B1D14', 0.28));
    if (TK || TIER === 'k1') {
      const t = GS.el('g', { transform: 'translate(' + n1(cx(ev.c) - s * 0.3) + ' ' + n1(cy(ev.r) - s * 0.3) + ')' }, layers.trail);
      GS.markup(t, '<circle r="22" fill="#FFF8EC" stroke="' + OL + '" stroke-width="2.5" opacity=".92"/>' + TXT(0, 0, ev.used, 36));
    }
  }
  async function fadeUp(el) {
    const tr0 = el.getAttribute('transform') || '';
    await tween(380, e => { el.setAttribute('opacity', n1(1 - e)); el.setAttribute('transform', tr0 + ' translate(0 ' + n1(-50 * e) + ')'); });
    el.setAttribute('visibility', 'hidden');
  }
  function popFlag(c, r) {
    const g = GS.el('g', { transform: 'translate(' + cx(c) + ' ' + cy(r) + ') scale(' + n1(G.cell / 100) + ')' }, layers.fx);
    GS.markup(g, ART.flag());
  }
  function popCheck(c, r) {
    const g = GS.el('g', { transform: 'translate(' + n1(cx(c) + G.cell * 0.3) + ' ' + n1(cy(r) - G.cell * 0.32) + ')' }, layers.fx);
    GS.markup(g, '<circle r="22" fill="#0F8C7A" stroke="' + OL + '" stroke-width="3"/><path d="M-10 0l7 7l13 -14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
  }
  function burst(x, y) {
    const g = GS.el('g', { transform: 'translate(' + n1(x) + ' ' + n1(y) + ')' }, layers.fx);
    let m = '';
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + vrand() * 0.3; m += '<path d="M' + n1(Math.cos(a) * 12) + ' ' + n1(Math.sin(a) * 12) + 'L' + n1(Math.cos(a) * 26) + ' ' + n1(Math.sin(a) * 26) + '" stroke="#F2A900" stroke-width="5" stroke-linecap="round"/>'; }
    GS.markup(g, m);
    setTimeout(() => g.remove(), 700 / SPEED);
  }
  function floatSvg(x, y, text) {
    const g = GS.el('g', { transform: 'translate(' + n1(x) + ' ' + n1(y) + ')' }, layers.fx);
    GS.markup(g, '<rect x="-78" y="-22" width="156" height="44" rx="22" fill="#FFC83D" stroke="' + OL + '" stroke-width="3"/>' + TXT(0, 0, text, 30, { body: true, decor: true }));
    setTimeout(() => g.remove(), 900 / SPEED);
  }
  function failMsg(tr) {
    const M = L.M;
    if (tr.stop === 'bump') {
      const b = tr.ev.find(e => e.e === 'bump'), nm = BLOCK_NAME[b.kind] || 'sesuatu';
      return TK ? 'Duk! Ada ' + nm + '. Cari jalan lain.' : 'Duk! Chuppy menabrak ' + nm + '. Kartu yang menyala perlu diubah.';
    }
    if (tr.stop === 'battery') return 'Baterai habis! Cari jalan yang lebih pendek.';
    if (tr.si < M.seq.length) {
      const q = M.seq[tr.si];
      if (q.type === 'item') return 'Chuppy belum mengambil ' + q.kind + ' nomor ' + q.n + '.';
      return 'Chuppy belum ke ' + (q.name || 'tempat pertama') + '.';
    }
    if (tr.mask !== (1 << M.items.length) - 1) {
      const nm = ITEM_NAME[M.items[0].kind] || 'barang';
      return TK ? nm[0].toUpperCase() + nm.slice(1) + 'nya belum diambil semua.' : 'Masih ada ' + nm + ' yang belum diambil.';
    }
    if (M.gk === 'start') return 'Chuppy belum kembali ke tempat awal.';
    if (L.labels && (M.gk === 'hidden' || L.hiddenName)) return 'Chuppy berhenti di ' + coordSay(L, tr.end.c, tr.end.r) + '. Tujuannya ' + coordSay(L, M.goal.c, M.goal.r) + '.';
    const here = cellAt(M, tr.end.c, tr.end.r);
    if (here && here.house && L.relText) return 'Ini rumah lain. Cari rumah di ' + L.relText + '.';
    if (M.gk === 'chest') return 'Tidak ada harta di sini. Hitung lagi meternya.';
    if (tr.visitedGoal) return TK ? 'Kelewatan! Rumahnya sudah lewat.' : 'Kelewatan! Chuppy sudah melewati tujuannya.';
    const d = bfsDist(M, tr.end, M.goal);
    return TK && d > 0 ? 'Belum sampai. Masih ' + d + ' kotak lagi.' : 'Belum sampai. Coba lagi, ya!';
  }
  async function success(tr, my) {
    const M = L.M;
    hud.mood('cheer');
    setSprite('cheer', null);
    if (M.gk === 'chest' || M.gk === 'hidden') {
      const g = GS.el('g', { transform: 'translate(' + n1(cx(M.goal.c) + G.cell * 0.32) + ' ' + n1(cy(M.goal.r) + G.cell * 0.05) + ') scale(' + n1(G.cell / 150) + ')' }, layers.fx);
      GS.markup(g, M.gk === 'chest' ? ART.chest() : ART.parcel());
    }
    const q = feet(robot.c, robot.r), m = svg.getScreenCTM();
    if (m) GS.confetti(m.a * q.x + m.e, m.d * (q.y - G.cell) + m.f, 40);
    GS.sfx.boing();
    await wait(800);
    if (my !== tok) return;
    const stars = tries === 0 ? 3 : tries <= 2 ? 2 : 1;
    let text = TK ? R0pick(['Sampai! Hebat!', 'Hore, Chuppy sampai!', 'Pas sekali!']) : R0pick(['Sampai! Programmu tepat.', 'Hore, Chuppy sampai!', 'Programmu jalan dengan benar!']);
    if (L.bonus) {
      const n = cardCount(P);
      text += n <= L.bonus ? ' Hemat sekali, hanya ' + n + ' kartu!' : ' Kamu pakai ' + n + ' kartu. Bisa ' + L.bonus + ' kartu saja.';
    }
    run.win(stars, text);
  }
  const R0pick = a => a[Math.floor(vrand() * a.length)];

  /* ================= worked examples ================= */
  function demoSpec(i) {
    return { key: KEYS[TIER] ? KEYS[TIER][i] : 'L' + i, auto: (DEMO_AUTO_OFF[TIER] || []).indexOf(i) < 0, build: () => buildLevel(i, true), script: demoScript };
  }
  const idle = async d => { await d.wait(200); while (busy) await d.wait(120); };
  async function tapTimes(d, t, k) { for (let j = 0; j < k; j++) await d.tap(() => palEl[t]); }
  async function enterProgram(d, sol) {
    let boxDone = false;
    for (let i = 0; i < sol.main.length; i++) {
      const c = sol.main[i];
      if (isCall(c.t)) {
        await d.tap(() => palEl[c.t]);
        if (!boxDone) {
          boxDone = true;
          for (const b of sol.box) await tapTimes(d, b.t, L.numbered && isMove(b.t) ? b.n : 1);
          if (c.t === 'LOOP') while (P.count !== sol.count) await d.tap(() => countEl);
          if (i < sol.main.length - 1) await d.tap(() => rowHit.main);
        }
      } else await tapTimes(d, c.t, L.numbered && isMove(c.t) ? c.n : 1);
    }
  }
  async function demoScript(d) {
    await d.wait(500);
    if (L.preset) {
      await d.say(L.think[0]);
      await d.tap(() => btnGo);
      await idle(d);
      const i = L.preset.findIndex((c, k) => !L.sol.main[k] || c.t !== L.sol.main[k].t || c.n !== L.sol.main[k].n);
      const p = L.preset[i], s = L.sol.main[i];
      await d.point(() => cardEls.main[i]);
      await d.say(L.think[1]);
      if (p.t === s.t) {
        if (p.n > s.n) for (let k = 0; k < p.n - s.n; k++) await d.tap(() => cardEls.main[i]);
        else { await d.tap(() => cardEls.main[i]); await tapTimes(d, s.t, s.n - p.n + 1); }
      } else {
        for (let k = 0; k < (L.numbered && isMove(p.t) ? p.n : 1); k++) await d.tap(() => cardEls.main[i]);
        await tapTimes(d, s.t, L.numbered && isMove(s.t) ? s.n : 1);
      }
      await d.tap(() => btnGo);
      await d.success(30000);
      return;
    }
    if (L.think[0]) await d.say(L.think[0]);
    await enterProgram(d, L.sol);
    if (L.think[1]) await d.say(L.think[1]);
    await d.tap(() => btnGo);
    await d.success(30000);
  }

  /* ================= test hook ================= */
  async function solve() {
    if (busy || solving || !L) return;
    solving = true;
    try {
      while (P.box.length) onCardTap('box', 0, true);
      while (P.main.length) onCardTap('main', 0, true);
      onRowTap('main');
      const sol = L.sol;
      let boxDone = false;
      sol.main.forEach((c, i) => {
        if (isCall(c.t)) {
          onPalette(c.t);
          if (!boxDone) {
            boxDone = true;
            sol.box.forEach(b => { for (let k = 0; k < (L.numbered && isMove(b.t) ? b.n : 1); k++) onPalette(b.t); });
            if (c.t === 'LOOP') { let g = 0; while (P.count !== sol.count && g++ < 10) onCount(); }
            if (i < sol.main.length - 1) onRowTap('main');
          }
        } else for (let k = 0; k < (L.numbered && isMove(c.t) ? c.n : 1); k++) onPalette(c.t);
      });
      btnGo.click();
    } finally { solving = false; }
  }
  window.__game = {
    go: i => run.go(i),
    solve,
    count: () => LEVELS.length,
    speed: n => { SPEED = Math.max(1, +n || 1); },
    tier: TIER,
    get state() { return { level: run.current, tries, busy, set: L && L.set, main: P && P.main, box: P && P.box, count: P && P.count, robot: robot && { c: robot.c, r: robot.r, f: robot.f } }; },
    level: () => L,
    sol: () => L && JSON.parse(JSON.stringify(L.sol)),
    sim: () => L && sim(L.M, P, L.north),
    toScreen: (x, y) => { const m = svg.getScreenCTM(); return m ? { x: m.a * x + m.e, y: m.d * y + m.f } : null; },
    bank: (i, n) => { const out = []; for (let k = 0; k < (n || 1); k++) out.push(makeLevel(i, Math.random).sig); return out; }
  };

  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
