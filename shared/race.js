/* Mat Sains Balapan: race inside a real game. Loaded on every game page (before game.js); does
 * nothing unless the URL has ?race=bot | ?race=host&room=CODE[&pub=1] | ?race=join&room=CODE.
 *
 * How a race works
 * - Everyone plays the SAME rounds: ROUNDS levels of this game, picked from the kelas' level list
 *   with the race seed and played easiest first. While a round is on, Math.random is a PRNG
 *   seeded with (seed, round), so the level builds the same numbers on every device (effects
 *   use GS.fxRandom, the real one). A retry inside a round rebuilds the same content.
 * - A finished round moves the racer by its stars (3 first try, 2 after 1 to 2 retries, 1 after
 *   more: the game's own star rule). "Ganti soal" (shown after a while) changes the round
 *   without moving. The finish is 3 x ROUNDS steps: the farthest racer wins, an earlier finish
 *   breaks a tie. Accuracy first; speed only decides ties.
 * - Between rounds a race view shows every racer moving; during a round a small pill shows
 *   the round and the child's place, so the game itself stays uncovered.
 * - Bots (always labelled BOT) fill empty seats; the device that owns the race runs them.
 * - Race rounds do not change the normal level stars or the play log.
 * Rooms go through shared/net.js (presence + broadcast; nothing stored). */
(function () {
  'use strict';
  const QP = (() => { try { return new URLSearchParams(location.search); } catch (e) { return { get: () => null }; } })();
  const MODE = { bot: 'bot', host: 'host', join: 'join' }[QP.get('race')] || '';
  const GS = window.GS;
  if (!MODE || !GS) return;

  const MS = window.MS || {};
  const ROUNDS = 5, MAXP = 4, LIMIT_MS = 10 * 60 * 1000, SKIP_AFTER = 25000;
  const BASE = { timbangan: 28, angkot: 32, katak: 24, ketapel: 26, perahu: 32, martabak: 28, bibit: 34, kembalian: 38, jam: 30, wayang: 32 };
  const TIERF = { tk: 1.15, k1: 1, k2: 1.05, k3: 1.15, k4: 1.25 };
  const PROFILES = [{ acc: 0.5, speed: 1.25 }, { acc: 0.62, speed: 1.05 }, { acc: 0.74, speed: 0.95 }];
  const NAMES = { timbangan: 'Timbangan Pasar', angkot: 'Angkot Penuh!', katak: 'Lompat Katak', ketapel: 'Ketapel Mangga', perahu: 'Rakit Terapung', martabak: 'Bagi Martabak', bibit: 'Kebun Bibit', kembalian: 'Warung Kembalian', jam: 'Jam Kampung', wayang: 'Wayang Bayangan' };
  const realRandom = GS.fxRandom || Math.random.bind(Math);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mmss = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const now = () => performance.now();

  /* ---------------- seeded content randomness ---------------- */
  function prng(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  let stream = null;
  Math.random = function () { return stream ? stream() : realRandom(); };

  /* ---------------- styles ---------------- */
  const css = document.createElement('style');
  css.textContent = `
  html.gs-racing .gs-hud .gs-levels, html.gs-racing .gs-hud .gs-demo-btn { display: none !important; }
  .rc-ov { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 10px max(14px, env(safe-area-inset-right, 0px)) 10px max(14px, env(safe-area-inset-left, 0px)); background: rgba(43, 29, 20, 0.5); }
  .rc-ov[hidden] { display: none; }
  .rc-card { position: relative; width: min(760px, 100%); max-height: 100%; overflow-y: auto; background: var(--panel); border: 4px solid var(--line); border-radius: 28px; box-shadow: 0 6px 0 var(--line); padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
  .rc-card h2 { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 30px; line-height: 1.1; }
  .rc-card p { margin: 0; font-size: 17px; line-height: 1.45; }
  .rc-note { font-size: 15px !important; color: #6B5444; }
  .rc-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .rc-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 58px; padding: 0 20px; border: 3px solid var(--line); border-radius: 999px; background: var(--card); color: var(--ink); box-shadow: 0 4px 0 var(--line); font-family: var(--font-display); font-weight: 800; font-size: 20px; cursor: pointer; text-decoration: none; }
  .rc-btn.blue { background: var(--primary); color: #fff; }
  .rc-btn.sun { background: var(--sun); }
  .rc-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--line); }
  .rc-btn:focus-visible { outline: 4px solid var(--primary); outline-offset: 3px; }
  .rc-code { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-weight: 700; }
  .rc-code b { font-family: var(--font-num); font-weight: 600; font-size: 42px; letter-spacing: 6px; padding: 0 16px; background: #fff; border: 3px solid var(--line); border-radius: 16px; }
  .rc-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
  .rc-list li { display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 4px 10px 4px 6px; background: #fff; border: 3px solid var(--line); border-radius: 999px; font-family: var(--font-display); font-weight: 800; font-size: 18px; min-width: 0; }
  .rc-list li.empty { border-style: dashed; border-color: #B9A68B; color: #9C8669; background: #F6EEDF; }
  .rc-av { flex: none; width: 42px; height: 42px; border-radius: 50%; overflow: hidden; border: 2px solid var(--line); background: var(--sky-low); }
  .rc-av svg { width: 100%; height: 100%; display: block; }
  .rc-who { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; }
  .rc-who .nm { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rc-tag { flex: none; padding: 0 7px; border-radius: 8px; font-family: var(--font-body); font-weight: 700; font-size: 12px; line-height: 20px; }
  .rc-tag.bot { background: #DCEAFB; color: #134C93; }
  .rc-tag.me { background: #FFC83D; color: #2B1D14; }
  .rc-tag.host { background: #FFF1C9; color: #7A4B00; }
  /* the race view: one lane per racer, the head runs to the flag */
  .rc-lanes { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .rc-lanes li { display: grid; grid-template-columns: minmax(84px, 22%) 1fr 54px; gap: 10px; align-items: center; }
  .rc-lanes .who { display: flex; align-items: center; gap: 6px; min-width: 0; font-family: var(--font-display); font-weight: 800; font-size: 17px; }
  .rc-lanes .who span.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rc-track { position: relative; height: 46px; border-radius: 999px; background: #E3C08A; border: 3px solid var(--line); background-image: linear-gradient(90deg, transparent calc(100% - 22px), #2B1D14 calc(100% - 22px), #2B1D14 calc(100% - 16px), #fff calc(100% - 16px), #fff calc(100% - 10px), #2B1D14 calc(100% - 10px), #2B1D14 calc(100% - 4px), transparent calc(100% - 4px)); }
  .rc-track i { position: absolute; top: 50%; left: 0; width: 44px; height: 44px; margin: -22px 0 0 -2px; border-radius: 50%; overflow: hidden; border: 2px solid var(--line); background: var(--sky-low); transition: left 900ms var(--ease-in); }
  .rc-track i svg { width: 100%; height: 100%; display: block; }
  .rc-lanes li.me .rc-track { background-color: #FFD98A; }
  .rc-lanes b { font-family: var(--font-num); font-weight: 600; font-size: 22px; text-align: right; font-variant-numeric: tabular-nums; }
  .rc-big { font-family: var(--font-num); font-weight: 600; font-size: 64px; line-height: 1; text-align: center; }
  .rc-res { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .rc-res li { display: grid; grid-template-columns: 38px 42px 1fr auto; gap: 10px; align-items: center; padding: 4px 12px 4px 8px; background: #fff; border: 3px solid var(--line); border-radius: 16px; }
  .rc-res li.me { background: #FFF1C9; }
  .rc-res .rk { font-family: var(--font-num); font-weight: 600; font-size: 26px; text-align: center; }
  .rc-res .nm { font-family: var(--font-display); font-weight: 800; font-size: 19px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rc-res .sc { font-family: var(--font-num); font-weight: 600; font-size: 17px; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  /* during a round the HUD carries the race: "1/5" in the title, a place badge, and "Ganti soal" after a while */
  .rc-rk { display: inline-flex; align-items: center; gap: 3px; margin-left: 8px; padding: 0 8px 0 5px; background: var(--sun); border: 2px solid var(--line); border-radius: 999px; font-family: var(--font-num); font-weight: 600; font-size: 15px; line-height: 1.4; color: var(--ink); vertical-align: middle; }
  .rc-rk svg { width: 15px; height: 15px; }
  .gs-hud .rc-skip { background: #FFE3D6; }
  .gs-hud .rc-skip.ask { background: #F2A900; }
  .gs-hud .rc-skip[hidden] { display: none; }
  @media (max-height: 500px) and (orientation: landscape) { .rc-rk { display: flex; margin: 4px auto 0; width: max-content; } }
  @media (max-height: 500px) {
    .rc-card { padding: 10px 16px; gap: 7px; } .rc-card h2 { font-size: 24px; } .rc-btn { min-height: 52px; font-size: 18px; } .rc-code b { font-size: 32px; }
    .rc-lanes { gap: 5px; } .rc-track { height: 38px; } .rc-track i { width: 36px; height: 36px; margin-top: -18px; } .rc-big { font-size: 48px; }
    .rc-res li { padding: 2px 10px 2px 6px; } .rc-res .rk { font-size: 22px; }
  }
  @media (prefers-reduced-motion: reduce) { .rc-track i { transition: none; } }`;
  document.head.appendChild(css);
  document.documentElement.classList.add('gs-racing');

  /* ---------------- who am I ---------------- */
  const A = MS.auth, KUR = MS.kur, NET = MS.net;
  const art = GS.art || {};
  const who = (A && (A.current() || A.profile())) || null;
  const MYCHAR = who && A.charOf ? A.charOf(who.avatar) : 'chuppy';
  const charName = c => (art.mascotName ? art.mascotName(c) : 'Chuppy');
  const ROOM = NET ? NET.cleanCode(QP.get('room')) : '';
  const PUB = QP.get('pub') === '1';
  // public rooms: strangers only see the character's name, never the nickname
  const MYNAME = MODE !== 'bot' && PUB ? charName(MYCHAR) : ((who && who.name) || charName(MYCHAR));
  const ME = 'P' + realRandom().toString(36).slice(2, 9);
  const head = (c, size) => { try { return art.mascotHead ? art.mascotHead(c, size) : ''; } catch (e) { return ''; } };
  const tierLabel = t => (KUR && KUR.info ? KUR.info(t).label : t);

  /* ---------------- the runner the game gets ---------------- */
  let O = null, R = null, GAME = '';
  GS.runner = function (o) {
    O = o; GAME = o.gameId;
    R = {
      current: 0,
      demoSpec: null,
      // the game asks for a level (on load, or to retry): during a round rebuild that round
      go() { if (state === 'race' && !roundDone) buildRound(); },
      next() {},
      playDemo() { return Promise.resolve('none'); },
      offerDemo() {},
      win(stars) { roundWon(stars); return Promise.resolve(); }
    };
    GS._runner = R;
    setTimeout(setup, 0); // the HUD exists once game.js has run
    return R;
  };

  /* ---------------- race state ---------------- */
  let state = 'idle', cfg = null, P = [], round = 0, roundDone = false, roundT0 = 0, t0 = 0, limitT = 0, skipT = 0;
  const me = () => P.find(p => p.id === ME);
  const maxDist = () => 3 * (cfg ? cfg.plan.length : ROUNDS);
  function plan(levels, seed) {
    const r = prng(seed + '#plan'), idx = Array.from({ length: levels }, (_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.slice(0, Math.min(ROUNDS, levels)).sort((a, b) => a - b);
  }

  function setup() {
    const home = document.querySelector('.gs-home');
    if (home) home.setAttribute('href', '../../index.html#balapan');
    const ov = document.createElement('div');
    ov.className = 'rc-ov'; ov.id = 'rcOv'; ov.hidden = true;
    ov.innerHTML = '<div class="rc-card" role="dialog" aria-modal="true" aria-labelledby="rcTitle" id="rcCard"></div>';
    document.body.appendChild(ov);
    // "Ganti soal" in the HUD; two taps (the first asks), so a stray tap never costs a round
    const right = document.querySelector('.gs-hud-right');
    if (right && GS.button) {
      const sk = GS.button('rc-skip', 'Ganti soal (tidak maju)', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6l8 6-8 6z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M17 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>', () => {
        if (sk.classList.contains('ask')) { sk.classList.remove('ask'); roundWon(0); return; }
        sk.classList.add('ask'); sk.setAttribute('aria-label', 'Yakin ganti soal? Ketuk lagi');
        GS.say('Mau ganti soal? Kamu tidak maju. Ketuk sekali lagi.');
        setTimeout(() => { sk.classList.remove('ask'); sk.setAttribute('aria-label', 'Ganti soal (tidak maju)'); }, 4000);
      });
      sk.id = 'rcSkip'; sk.hidden = true;
      right.insertBefore(sk, right.firstChild);
    }
    addEventListener('pagehide', () => { try { if (lobby) lobby.leave(); if (room) room.leave(); } catch (e) { /* ignore */ } });
    showCard('<h2 id="rcTitle">Balapan ' + esc(NAMES[GAME] || '') + '</h2><p>Sebentar, ya...</p>');
    GS.afterGate(() => {
      if (MODE === 'bot') {
        const tier = GS.tier ? GS.tier() : 'k1', seed = QP.get('seed') || ('bot-' + Date.now().toString(36));
        begin({ game: GAME, tier, seed, plan: plan(O.count, seed), players: [{ id: ME, name: MYNAME, char: MYCHAR, bot: false }].concat(makeBots(3, [MYCHAR])) });
      } else goOnline();
    });
  }

  function begin(c) {
    cfg = c;
    P = c.players.map(p => Object.assign({ dist: 0, qi: 0, done: false, ms: 0, gone: false }, p));
    state = 'count';
    raceView('Siap?', '', null);
    const steps = /autotest/.test(location.search) || GS.reducedMotion ? [] : ['3', '2', '1'];
    GS.say('Siap? Kerjakan dengan teliti, ya!');
    let k = 0;
    (function tick() {
      if (k < steps.length) { setBig(steps[k++]); GS.sfx.tick(); setTimeout(tick, 800); return; }
      setBig('Mulai!'); GS.sfx.pop();
      setTimeout(() => {
        state = 'race'; t0 = now(); round = 0;
        limitT = setTimeout(() => endRace(true), LIMIT_MS);
        if (botOwner()) P.filter(p => p.bot).forEach(botNext);
        startRound();
      }, steps.length ? 600 : 50);
    })();
  }
  function startRound() {
    roundDone = false;
    hideCard();
    buildRound();
    updatePill();
    clearTimeout(skipT);
    const sk = document.getElementById('rcSkip');
    if (sk) { sk.hidden = true; skipT = setTimeout(() => { if (state === 'race' && !roundDone) sk.hidden = false; }, SKIP_AFTER); }
  }
  function buildRound() {
    const lvl = cfg.plan[round];
    R.current = lvl;
    document.querySelectorAll('.gs-overlay').forEach(x => x.remove());
    stream = prng(cfg.seed + '#' + cfg.game + '#' + round); // same content on every device; a retry rebuilds the same
    roundT0 = now();
    try { O.start(lvl); } catch (e) { console.error(e); }
    updatePill();
  }
  function roundWon(stars) {
    if (state !== 'race' || roundDone) return;
    roundDone = true;
    stream = null;
    clearTimeout(skipT);
    const m = me();
    if (!m) return;
    m.dist += stars; m.qi = round + 1;
    if (m.qi >= cfg.plan.length) { m.done = true; m.ms = now() - t0; }
    sendP(m);
    const sk = document.getElementById('rcSkip'); if (sk) sk.hidden = true;
    if (stars) GS.sfx.coin(); else GS.sfx.whoosh();
    raceView(stars ? '+' + stars + ' langkah!' : 'Soal diganti, tidak maju.', m.done ? 'Kamu sudah sampai!' : 'Soal berikutnya...', null);
    setBig(stars ? '+' + stars : '0');
    setTimeout(() => {
      if (state !== 'race') return;
      if (m.done) { waitOthers(); checkEnd(); } else { round++; startRound(); }
    }, 2200);
  }
  // HUD title: round "2/5" and a place badge (cup + place)
  function updatePill() {
    const t = document.querySelector('.gs-title-level');
    if (!cfg || !t || state === 'end') return;
    const rk = ranked().findIndex(p => p.id === ME) + 1, n = Math.min(round + 1, cfg.plan.length);
    t.innerHTML = n + '/' + cfg.plan.length + '<span class="rc-rk"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10v5a5 5 0 0 1-10 0z" fill="#fff" stroke="#3B2A20" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 13.5v4M8 20.5h8" stroke="#3B2A20" stroke-width="2.2" stroke-linecap="round"/></svg>' + rk + '</span>';
    t.setAttribute('aria-label', 'Balapan, soal ' + n + ' dari ' + cfg.plan.length + ', kamu juara ' + rk);
  }

  /* ---------------- the race view (lanes) ---------------- */
  function laneHTML() {
    const max = maxDist();
    return '<ul class="rc-lanes">' + P.map(p => '<li class="' + (p.id === ME ? 'me' : '') + '" data-id="' + p.id + '"><span class="who"><span class="nm">' + esc(p.name) + '</span>' +
      (p.bot ? '<span class="rc-tag bot">BOT</span>' : p.id === ME ? '<span class="rc-tag me">KAMU</span>' : '') + '</span>' +
      '<span class="rc-track"><i style="left:calc(' + (100 * Math.min(1, p.dist / max)).toFixed(1) + '% - ' + (40 * Math.min(1, p.dist / max)).toFixed(0) + 'px)">' + head(p.char, 44) + '</i></span><b>' + p.dist + '</b></li>').join('') + '</ul>';
  }
  function raceView(title, sub, extra) {
    showCard('<h2 id="rcTitle">' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '<div class="rc-big" id="rcBig" aria-live="polite"></div>' + laneHTML() +
      '<p class="rc-note">Finis = ' + maxDist() + ' langkah. Benar di coba pertama 3 langkah, setelah salah 2 atau 1 langkah.</p>' + (extra || ''));
  }
  function refreshLanes() {
    const ul = document.querySelector('#rcCard .rc-lanes');
    if (!ul) return;
    const max = maxDist();
    P.forEach(p => {
      const li = ul.querySelector('li[data-id="' + p.id + '"]');
      if (!li) return;
      const f = Math.min(1, p.dist / max);
      li.querySelector('.rc-track i').style.left = 'calc(' + (100 * f).toFixed(1) + '% - ' + (40 * f).toFixed(0) + 'px)';
      li.querySelector('b').textContent = p.dist;
    });
  }
  function setBig(t) { const b = document.getElementById('rcBig'); if (b) b.textContent = t; }
  function waitOthers() {
    const ff = botOwner() && P.some(p => p.bot && !p.done) ? '<div class="rc-row"><button type="button" class="rc-btn blue" id="rcFF">Lihat hasil</button></div>' : '';
    raceView('Kamu sudah sampai!', me().dist + ' langkah dari ' + maxDist() + '. Menunggu yang lain...', ff);
    const b = document.getElementById('rcFF');
    if (b) b.addEventListener('click', () => { GS.sfx.click(); finishBots(); });
    GS.say('Hebat, kamu sudah sampai! Tunggu yang lain, ya.');
  }
  function showCard(html) { document.getElementById('rcCard').innerHTML = html; document.getElementById('rcOv').hidden = false; }
  function hideCard() { document.getElementById('rcOv').hidden = true; }

  /* ---------------- bots ---------------- */
  const botOwner = () => MODE === 'bot' || MODE === 'host';
  function makeBots(k, taken) {
    const chars = (art.CHARS || []).map(c => c.id).filter(c => taken.indexOf(c) < 0);
    const prof = PROFILES.slice().sort(() => realRandom() - 0.5), out = [];
    for (let i = 0; i < k; i++) {
      const c = chars[i % Math.max(1, chars.length)] || 'chuppy';
      out.push(Object.assign({ id: 'B' + (i + 1) + realRandom().toString(36).slice(2, 5), name: charName(c), char: c, bot: true }, prof[i % prof.length]));
    }
    return out;
  }
  function botRound(b) {
    const r = realRandom(), stars = r < 0.04 ? 0 : r < b.acc ? 3 : r < b.acc + (1 - b.acc) * 0.65 ? 2 : 1;
    const base = (BASE[GAME] || 30) * 1000 * (TIERF[cfg.tier] || 1);
    return { stars, ms: base * b.speed * (0.7 + realRandom() * 0.65) * (stars === 3 ? 1 : 1.3) };
  }
  function leadHuman() { return Math.max.apply(null, P.filter(p => !p.bot && !p.gone).map(p => p.dist).concat([0])); }
  function botNext(b) {
    if (state !== 'race' || b.done) return;
    const next = botRound(b);
    // keep it close: a bot far ahead of the leading child slows down, one far behind hurries
    const gap = b.dist - leadHuman(), rubber = gap > 4 ? 1.35 : gap < -4 ? 0.8 : 1;
    b.timer = setTimeout(() => {
      if (state !== 'race') return;
      b.dist += next.stars; b.qi++;
      if (b.qi >= cfg.plan.length) { b.done = true; b.ms = now() - t0; }
      sendP(b); refreshLanes(); updatePill();
      if (b.done) checkEnd(); else botNext(b);
    }, next.ms * rubber);
  }
  function finishBots() {
    const t = now() - t0;
    P.filter(p => p.bot && !p.done).forEach(b => {
      clearTimeout(b.timer);
      let ms = t;
      while (b.qi < cfg.plan.length) { const n = botRound(b); b.dist += n.stars; b.qi++; ms += n.ms; }
      b.done = true; b.ms = ms;
      sendP(b);
    });
    refreshLanes();
    checkEnd();
  }

  /* ---------------- end ---------------- */
  function ranked() {
    const fin = p => (p.done && !p.gone ? 0 : 1);
    return P.slice().sort((a, b) => (b.dist - a.dist) || (fin(a) - fin(b)) || ((a.ms || 1e12) - (b.ms || 1e12)));
  }
  function checkEnd() { if (state === 'race' && P.every(p => p.done || p.gone)) endRace(false); }
  function endRace(timeUp) {
    if (state === 'end') return;
    state = 'end'; stream = null;
    clearTimeout(limitT); clearTimeout(skipT);
    P.forEach(p => clearTimeout(p.timer));
    const Rk = ranked(), place = Rk.findIndex(p => p.id === ME) + 1, m = me() || { dist: 0, ms: 0 };
    try {
      const log = GS.store.get('race.log', []);
      log.push({ d: new Date().toISOString().slice(0, 10), game: GAME, mode: MODE === 'bot' ? 'bot' : 'online', place, of: P.length, dist: m.dist, max: maxDist(), ms: Math.round(m.ms || 0) });
      GS.store.set('race.log', log.slice(-20));
    } catch (e) { /* storage */ }
    if (place === 1) { GS.sfx.win(); try { GS.confetti(innerWidth / 2, innerHeight * 0.3, 80); } catch (e) { /* ignore */ } }
    GS.say(place === 1 ? 'Juara satu! Hebat sekali!' : 'Kamu juara ' + place + '. Ayo coba lagi!');
    const rows = Rk.map((p, i) => '<li class="' + (p.id === ME ? 'me' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="rc-av">' + head(p.char, 42) + '</span>' +
      '<span class="nm">' + esc(p.name) + (p.bot ? ' <span class="rc-tag bot">BOT</span>' : '') + (p.id === ME ? ' <span class="rc-tag me">KAMU</span>' : '') + '</span>' +
      '<span class="sc">' + p.dist + ' langkah' + (p.gone ? ', keluar' : p.done && p.ms ? ', ' + mmss(p.ms) : ', belum selesai') + '</span></li>').join('');
    const again = MODE === 'bot' ? '<button type="button" class="rc-btn blue" id="rcAgain">Main lagi</button>' : MODE === 'host' ? '<button type="button" class="rc-btn blue" id="rcAgain">Main lagi di ruang ini</button>' : '';
    showCard('<h2 id="rcTitle">' + (place === 1 ? 'Juara 1!' : 'Kamu juara ' + place) + '</h2>' +
      '<p>Langkahmu ' + m.dist + ' dari ' + maxDist() + (timeUp ? '. Waktu balapan habis.' : '.') + '</p>' +
      '<ol class="rc-res">' + rows + '</ol><p class="rc-note">Yang paling jauh menang. Kalau sama jauh, yang lebih dulu sampai.</p>' +
      '<div class="rc-row">' + again + '<a class="rc-btn" href="../../index.html#balapan">Ganti game</a></div>' +
      (MODE === 'join' ? '<p class="rc-note">Tunggu tuan rumah untuk main lagi di ruang ini.</p>' : ''));
    const ag = document.getElementById('rcAgain');
    if (ag) ag.addEventListener('click', () => {
      GS.sfx.click();
      if (MODE === 'bot') { location.replace(location.pathname + '?race=bot'); return; }
      if (room) room.send('again', {});
      toLobby();
    });
  }

  /* ---------------- rooms ---------------- */
  let room = null, peers = [], lobby = null;
  const joinedAt = Date.now();
  function sendP(p) { if (room) room.send('p', { id: p.id, dist: p.dist, qi: p.qi, done: p.done, ms: Math.round(p.ms || 0) }); }
  function myMeta() { return { id: ME, name: MYNAME, char: MYCHAR, host: MODE === 'host', game: GAME, tier: GS.tier ? GS.tier() : 'k1', state: state === 'end' ? 'idle' : state, joined: joinedAt }; }
  function humans() {
    const seen = {};
    return peers.filter(p => p && p.id && !seen[p.id] && (seen[p.id] = 1)).sort((a, b) => ((b.host ? 1 : 0) - (a.host ? 1 : 0)) || (a.joined - b.joined));
  }
  const offCard = (t, p) => showCard('<h2 id="rcTitle">' + t + '</h2><p>' + p + '</p><div class="rc-row"><a class="rc-btn sun" href="?race=bot">Lawan bot saja</a><a class="rc-btn" href="../../index.html#balapan">Kembali</a></div>');
  function lobbyCard() {
    if (state !== 'idle') return;
    const hs = humans(), host = hs.find(p => p.host);
    if (MODE === 'join' && !host) { offCard('Mencari ruang ' + esc(ROOM) + '...', 'Pastikan kodenya benar dan tuan rumah masih membuka ruangnya.'); return; }
    // the room plays the host's game: a guest who opened another game moves there
    if (MODE === 'join' && host.game && host.game !== GAME) { location.replace('../' + host.game + '/index.html?' + withTier(host.tier)); return; }
    // and the host's kelas: the game reads the kelas when it loads, so switch before the start
    if (MODE === 'join' && host.tier && GS.tier && host.tier !== GS.tier()) { location.replace(location.pathname + '?' + withTier(host.tier)); return; }
    if (hs.findIndex(p => p.id === ME) >= MAXP) { offCard('Ruang penuh', 'Sudah ada 4 pemain di ruang ' + esc(ROOM) + '.'); return; }
    if (MODE === 'join' && host.state && host.state !== 'idle') { offCard('Balapan sedang berjalan', 'Tunggu sebentar, kamu ikut di balapan berikutnya.'); return; }
    const list = hs.slice(0, MAXP), t = (host && host.tier) || myMeta().tier;
    const slots = list.map(p => '<li><span class="rc-av">' + head(p.char, 42) + '</span><span class="rc-who"><span class="nm">' + esc(p.name) + '</span>' +
      (p.host ? '<span class="rc-tag host">TUAN RUMAH</span>' : '') + (p.id === ME ? '<span class="rc-tag me">KAMU</span>' : '') + '</span></li>').join('') +
      Array.from({ length: MAXP - list.length }, () => '<li class="empty">' + (MODE === 'host' ? 'kosong, jadi bot' : 'kosong') + '</li>').join('');
    showCard('<h2 id="rcTitle">' + esc(NAMES[GAME] || 'Balapan') + ', ' + esc(tierLabel(t)) + '</h2>' +
      '<div class="rc-code"><span>' + (PUB ? 'Ruang publik' : 'Ruang privat') + ', kode</span><b>' + esc(ROOM) + '</b>' + (MODE === 'host' ? '<button type="button" class="rc-btn" id="rcShare">Bagikan kode</button>' : '') + '</div>' +
      '<ul class="rc-list">' + slots + '</ul>' +
      '<div class="rc-row">' + (MODE === 'host' ? '<button type="button" class="rc-btn blue" id="rcStart">' + (list.length < MAXP ? 'Mulai (' + (MAXP - list.length) + ' bot ikut)' : 'Mulai!') + '</button>' : '') + '<a class="rc-btn" href="../../index.html#balapan">Keluar</a></div>' +
      '<p class="rc-note">' + (MODE === 'host' ? 'Bagikan kodenya ke teman. Kursi yang kosong saat mulai diisi bot.' : 'Menunggu tuan rumah memulai balapan...') + (PUB ? ' Di ruang publik yang tampil hanya nama karakter.' : '') + '</p>');
    const sh = document.getElementById('rcShare');
    if (sh) sh.addEventListener('click', () => {
      const url = new URL('index.html?race=join&room=' + ROOM + (PUB ? '&pub=1' : ''), location.href).href;
      const text = 'Ayo balapan ' + (NAMES[GAME] || '') + ' di Mat Sains! Kode ruang: ' + ROOM;
      if (navigator.share) navigator.share({ title: 'Balapan Mat Sains', text, url }).catch(() => {});
      else { try { navigator.clipboard.writeText(text + ' ' + url); sh.textContent = 'Tautan disalin'; } catch (e) { /* ignore */ } }
    });
    const st = document.getElementById('rcStart');
    if (st) st.addEventListener('click', hostStart);
  }
  function hostStart() {
    if (MODE !== 'host' || state !== 'idle') return;
    GS.sfx.click();
    const players = humans().slice(0, MAXP).map(p => ({ id: p.id, name: p.name, char: p.char, bot: false }));
    const tier = myMeta().tier, seed = ROOM + '-' + Date.now().toString(36);
    const c = { game: GAME, tier, seed, plan: plan(O.count, seed), players: players.concat(makeBots(MAXP - players.length, players.map(p => p.char))) };
    room.send('start', { cfg: c });
    begin(c);
    announce();
    room.update(myMeta());
  }
  function toLobby() {
    state = 'idle'; stream = null;
    P.forEach(p => clearTimeout(p.timer));
    P = []; cfg = null;
    if (room) room.update(myMeta());
    announce();
    lobbyCard();
  }
  function announce() {
    if (!lobby || MODE !== 'host') return;
    lobby.announce(state === 'idle' ? { code: ROOM, game: GAME, gameName: NAMES[GAME], tier: myMeta().tier, label: tierLabel(myMeta().tier), n: Math.min(MAXP, humans().length), max: MAXP, open: true } : null);
  }
  function onMsg(m) {
    if (!m || !m.t) return;
    if (m.t === 'start' && m.cfg && state === 'idle') {
      // a guest of another kelas plays the host's kelas: the plan already names the levels
      if (m.cfg.players.some(p => p.id === ME)) begin(m.cfg);
      else lobbyCard();
    } else if (m.t === 'p' && cfg) {
      const p = P.find(x => x.id === m.id);
      if (p && p.id !== ME && !(p.bot && botOwner())) { Object.assign(p, { dist: m.dist, qi: m.qi, done: m.done, ms: m.ms }); refreshLanes(); updatePill(); checkEnd(); }
    } else if (m.t === 'again' && MODE === 'join') toLobby();
  }
  function withTier(t) { const q = new URLSearchParams(location.search); if (t) q.set('tier', t); return q.toString(); }
  function onPeers(list) {
    peers = list;
    if (state === 'idle') { lobbyCard(); announce(); return; }
    const ids = list.map(p => p.id);
    P.forEach(p => { if (!p.bot && p.id !== ME && ids.indexOf(p.id) < 0 && !p.done) p.gone = true; });
    checkEnd();
  }
  function goOnline() {
    if (!NET || !NET.available() || !ROOM) { offCard('Main online belum aktif', 'Balapan dengan teman butuh server. Orang tua atau guru perlu menyambungkannya dulu. Sementara itu, ayo balapan melawan bot!'); return; }
    showCard('<h2 id="rcTitle">Menyambung ke ruang ' + esc(ROOM) + '...</h2><p>Sebentar, ya.</p>');
    NET.room(ROOM, myMeta(), {
      onPeers, onMsg,
      onStatus: s => { if (s === 'error' && state === 'idle') offCard('Tidak bisa tersambung', 'Periksa internetnya, lalu coba lagi.'); }
    }).then(r => {
      room = r;
      lobbyCard();
      if (MODE === 'host' && PUB) NET.lobby({}).then(l => { lobby = l; announce(); }).catch(() => {});
      if (MODE === 'join') setTimeout(lobbyCard, 6000);
    }).catch(() => offCard('Tidak bisa tersambung', 'Periksa internetnya, lalu coba lagi.'));
  }

  // Test hook
  window.__race = {
    state: () => state, round: () => round, plan: () => (cfg ? cfg.plan.slice() : []), seed: () => (cfg ? cfg.seed : ''),
    players: () => P.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, dist: p.dist, qi: p.qi, done: p.done, gone: p.gone })),
    me: () => ME, skip: () => roundWon(0), finishBots, start: hostStart, max: maxDist
  };
  GS.race = { active: true, mode: MODE };
})();
