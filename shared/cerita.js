/* Mat Sains Petualangan (story mode): chapters whose obstacles are the REAL games.
 *
 *   MS.cerita.chapters        list of chapters (data below)
 *   MS.cerita.get(id)         one chapter
 *   MS.cerita.progress(id)    { done: [step...], stars: {step: n}, opened, closed }
 *   MS.cerita.save(id, p)
 *   MS.cerita.level(step, tier) the level index of that step's game for a kelas
 *
 * A chapter = an opening comic, steps, a closing comic and a badge. A step is one obstacle:
 * a villager asks for help (comic panel on cerita.html), the child plays ONE real level of a
 * game (games/<id>/index.html?story=<chapter>&step=<n>), the world reacts (outcome card in the
 * game), then back to the chapter route. The math is the obstacle itself: no quiz, no lives.
 *
 * On a game page this file is inert unless the URL has ?story=...: then it wraps GS.runner so
 * the game plays the step's level (worked examples and stars work as usual: a story win is a
 * real level win), hides the level picker, points Home to the chapter and shows the outcome.
 * Text placeholders: {nama} = the child's nickname (the character's name when empty). */
(function () {
  'use strict';
  const MS = (window.MS = window.MS || {});
  const GS = window.GS;

  /* Cast: p = GS.art.person index. Panels: s = 'w' (the villager of the step), 'rt' (Pak RT),
     'm' (the child's mascot); t = text; mood = mascot mood. */
  const CAST = {
    rt: { p: 2, name: 'Pak RT' },
    sopir: { p: 6, name: 'Pak Sopir' },
    sari: { p: 4, name: 'Bu Sari' },
    tani: { p: 5, name: 'Pak Tani' },
    dodi: { p: 7, name: 'Kak Dodi' },
    rina: { p: 3, name: 'Kak Rina' }
  };

  const CHAPTERS = [{
    id: 'festival',
    no: 1,
    title: 'Festival Kampung',
    badge: 'Penolong Festival',
    intro: [
      { scene: 'kampung', lm: 'rumah', cast: ['rt'], s: 'rt', mood: 'surprise', t: 'Selamat pagi! Nanti malam ada Festival Kampung. Ada pertunjukan wayang juga!' },
      { scene: 'kampung', lm: 'rumah', cast: ['rt'], s: 'rt', mood: 'think', t: 'Tapi persiapannya belum selesai. Tamu belum datang, buah belum ditimbang, jembatannya juga rusak.' },
      { scene: 'kampung', lm: 'rumah', cast: ['rt'], s: 'm', mood: 'cheer', t: 'Tenang, Pak RT! {nama} siap membantu!' },
      { scene: 'kampung', lm: 'rumah', cast: ['rt'], s: 'rt', mood: 'happy', t: 'Terima kasih! Ikuti jalan kampung ini, ya. Banyak warga yang butuh bantuan.' }
    ],
    steps: [
      {
        game: 'angkot', name: 'Terminal', lm: 'terminal', scene: 'terminal', who: 'sopir',
        lv: { tk: 0, k1: 0, k2: 2, k3: 2, k4: 1 },
        ask: [
          { s: 'w', mood: 'surprise', t: 'Tamu-tamu festival sudah menunggu di terminal.' },
          { s: 'w', mood: 'point', t: 'Angkotku baru boleh berangkat kalau penumpangnya pas. Bantu aku, ya!' }
        ],
        done: 'Angkotnya berangkat! Tamu-tamu festival sampai di kampung.'
      },
      {
        game: 'timbangan', name: 'Pasar', lm: 'pasar', scene: 'pasar', who: 'sari',
        lv: { tk: 2, k1: 1, k2: 1, k3: 1, k4: 0 },
        ask: [
          { s: 'w', mood: 'happy', t: 'Aku menyiapkan buah untuk rujak festival.' },
          { s: 'w', mood: 'think', t: 'Timbangannya harus seimbang dulu, baru buahnya dibungkus. Bisa bantu?' }
        ],
        done: 'Seimbang! Buahnya sudah dibungkus dan siap dibawa.'
      },
      {
        game: 'ketapel', name: 'Kebun', lm: 'kebun', scene: 'kebun', who: 'tani',
        lv: { tk: 4, k1: 3, k2: 1, k3: 3, k4: 4 },
        ask: [
          { s: 'w', mood: 'surprise', t: 'Rujak festival butuh mangga, tapi mangganya tinggi sekali!' },
          { s: 'w', mood: 'point', t: 'Pakai ketapel ini. Pikirkan dulu tarikannya, lalu lepas!' }
        ],
        done: 'Kena! Pak Tani mengumpulkan mangga ke keranjang.'
      },
      {
        game: 'perahu', name: 'Sungai', lm: 'sungai', scene: 'sungai', who: 'dodi',
        lv: { tk: 4, k1: 4, k2: 2, k3: 0, k4: 2 },
        ask: [
          { s: 'w', mood: 'surprise', t: 'Waduh, jembatan ke lapangan festival rusak!' },
          { s: 'w', mood: 'think', t: 'Barang festival harus diseberangkan pakai rakit. Rakitnya bisa tenggelam kalau muatannya salah.' }
        ],
        done: 'Semua barang sampai di seberang dengan selamat!'
      },
      {
        game: 'jam', name: 'Pos Ronda', lm: 'posronda', scene: 'kampung', who: 'rt',
        lv: { tk: 3, k1: 0, k2: 2, k3: 1, k4: 0 },
        ask: [
          { s: 'w', mood: 'happy', t: 'Kentongan festival harus dipukul tepat pada waktunya.' },
          { s: 'w', mood: 'point', t: 'Bantu Pak RT mengatur jam di pos ronda, ya!' }
        ],
        done: 'Tepat waktu! Tong, tong, tong! Warga berkumpul di lapangan.'
      },
      {
        game: 'wayang', name: 'Panggung', lm: 'panggung', scene: 'kampung', night: true, who: 'rina',
        lv: { tk: 1, k1: 0, k2: 0, k3: 1, k4: 1 },
        ask: [
          { s: 'w', mood: 'surprise', t: 'Pertunjukan wayang hampir dimulai! Penonton sudah duduk.' },
          { s: 'w', mood: 'point', t: 'Bantu aku membuat bayangan wayang yang pas di kelir.' }
        ],
        done: 'Penonton bertepuk tangan! Bayangannya bagus sekali.'
      }
    ],
    outro: [
      { scene: 'kampung', lm: 'panggung', night: true, cast: ['rt', 'sari', 'sopir'], s: 'rt', mood: 'cheer', t: 'Festival Kampung meriah sekali. Semua ini berkat bantuanmu, {nama}!' },
      { scene: 'kampung', lm: 'warung', night: true, cast: ['tani', 'dodi', 'rina'], s: 'w', who: 'dodi', mood: 'happy', t: 'Martabaknya sudah dibagi sama besar. Ayo makan bersama!' },
      { scene: 'kampung', lm: 'panggung', night: true, cast: ['rt'], s: 'm', mood: 'cheer', t: 'Hore! Dengan berhitung dan mengamati, kita bisa menolong banyak orang.' },
      { scene: 'kampung', lm: 'panggung', night: true, cast: ['rt'], s: 'rt', mood: 'happy', t: 'Ini lencana Penolong Festival untukmu. Sampai jumpa di petualangan berikutnya!' }
    ]
  }];

  const get = id => CHAPTERS.find(c => c.id === id) || null;
  const KEY = id => 'cerita.' + id;
  const store = () => (GS && GS.store) || null;
  function progress(id) {
    const s = store(), p = (s && s.get(KEY(id), null)) || {};
    return { done: Array.isArray(p.done) ? p.done.slice() : [], stars: Object.assign({}, p.stars || {}), opened: !!p.opened, closed: !!p.closed };
  }
  function save(id, p) { const s = store(); if (s) s.set(KEY(id), p); }
  function level(step, tier) { const v = step.lv[tier]; return v == null ? 0 : v; }
  function nickname() {
    const A = MS.auth;
    const who = (A && ((A.current && A.current()) || (A.profile && A.profile()))) || null;
    if (who && who.name) return who.name; // current()/profile() already fall back to the character's name
    const art = GS && GS.art, c = GS && GS.mascotChar ? GS.mascotChar() : 'chuppy';
    return art && art.mascotName ? art.mascotName(c) : 'Chuppy';
  }
  const fill = t => String(t || '').replace(/\{nama\}/g, nickname());

  MS.cerita = { chapters: CHAPTERS, cast: CAST, get, progress, save, level, nickname, fill };

  /* ====================== inside a game page ====================== */
  const QP = (() => { try { return new URLSearchParams(location.search); } catch (e) { return { get: () => null }; } })();
  const CH = get(QP.get('story') || '');
  const STEP = CH ? CH.steps[parseInt(QP.get('step'), 10)] : null;
  if (!GS || !CH || !STEP || QP.get('race') || !/\/games\//.test(location.pathname)) return;
  const SI = CH.steps.indexOf(STEP);
  const back = '../../cerita.html?bab=' + CH.id + '&dari=' + SI;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  document.title = 'Bab ' + CH.no + ': ' + CAST[STEP.who].name + ' butuh bantuan';
  document.documentElement.classList.add('gs-story');

  const css = document.createElement('style');
  css.textContent = `
  html.gs-story .gs-hud .gs-levels { display: none !important; }
  .st-ov { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 10px max(14px, env(safe-area-inset-right, 0px)) 10px max(14px, env(safe-area-inset-left, 0px)); background: rgba(43, 29, 20, 0.5); }
  .st-card { position: relative; width: min(640px, 100%); max-height: 100%; overflow-y: auto; background: var(--panel); border: 4px solid var(--line); border-radius: 28px; box-shadow: 0 6px 0 var(--line); padding: 16px 20px; display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; align-items: center; }
  .st-card .st-art { grid-row: span 3; width: 150px; height: 150px; }
  .st-card .st-art svg { width: 100%; height: 100%; display: block; }
  .st-card h2 { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 28px; line-height: 1.1; }
  .st-card p { margin: 0; font-size: 19px; line-height: 1.4; }
  .st-stars { display: flex; gap: 4px; }
  .st-stars svg { width: 40px; height: 40px; }
  .st-row { grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; margin-top: 6px; }
  .st-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 60px; padding: 0 22px; border: 3px solid var(--line); border-radius: 999px; background: var(--card); color: var(--ink); box-shadow: 0 4px 0 var(--line); font-family: var(--font-display); font-weight: 800; font-size: 20px; cursor: pointer; text-decoration: none; }
  .st-btn.blue { background: var(--primary); color: #fff; }
  .st-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--line); }
  .st-btn:focus-visible { outline: 4px solid var(--primary); outline-offset: 3px; }
  @media (max-height: 500px) { .st-card { padding: 10px 16px; } .st-card .st-art { width: 110px; height: 110px; } .st-card h2 { font-size: 24px; } .st-btn { min-height: 54px; font-size: 18px; } }
  @media (max-width: 480px) { .st-card { grid-template-columns: 1fr; justify-items: center; text-align: center; } .st-card .st-art { grid-row: auto; } .st-row { justify-content: center; } }`;
  document.head.appendChild(css);

  const STAR = on => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" fill="' + (on ? '#FFC83D' : '#EADBC4') + '" stroke="#3B2A20" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  const orig = GS.runner;
  GS.runner = function (o) {
    const r = orig(o);
    const LVL = Math.min(level(STEP, GS.tier ? GS.tier() : 'k1'), o.count - 1);
    const go0 = r.go;
    r.go = function () {
      go0(LVL);
      const t = document.querySelector('.gs-title-level');
      if (t) { t.textContent = (SI + 1) + '/' + CH.steps.length; t.setAttribute('aria-label', 'Bab ' + CH.no + ', rintangan ' + (SI + 1) + ' dari ' + CH.steps.length); }
    };
    r.next = () => { location.href = back; };
    r.win = function (stars, text) {
      if (GS.demo && GS.demo.active) { GS.demo._solved(); return Promise.resolve(); }
      // a story win is a real level win: stars and the play log as usual
      GS.store.setStars(o.gameId, r.current, stars);
      if (GS.activity) GS.activity.add(o.gameId, r.current, stars);
      const p = progress(CH.id);
      if (p.done.indexOf(SI) < 0) p.done.push(SI);
      p.stars[SI] = Math.max(p.stars[SI] || 0, stars);
      save(CH.id, p);
      outcome(stars, r);
      return Promise.resolve();
    };
    setTimeout(() => {
      const home = document.querySelector('.gs-home');
      if (home) { home.setAttribute('href', '../../cerita.html?bab=' + CH.id); home.setAttribute('aria-label', 'Kembali ke petualangan'); }
    }, 0);
    return r;
  };

  function outcome(stars, r) {
    document.querySelectorAll('.st-ov').forEach(x => x.remove());
    GS.sfx.win();
    try { GS.confetti(innerWidth / 2, innerHeight * 0.3, 70); } catch (e) { /* ignore */ }
    const art = GS.art || {};
    const ov = document.createElement('div');
    ov.className = 'st-ov';
    const last = SI === CH.steps.length - 1;
    ov.innerHTML = '<div class="st-card" role="dialog" aria-modal="true" aria-labelledby="stTitle">' +
      '<div class="st-art">' + (art.mascot ? art.mascot({ mood: 'cheer', size: 150 }) : '') + '</div>' +
      '<h2 id="stTitle">Berhasil!</h2>' +
      '<div class="st-stars" aria-label="' + stars + ' bintang">' + [1, 2, 3].map(k => STAR(k <= stars)).join('') + '</div>' +
      '<p>' + esc(STEP.done) + '</p>' +
      '<div class="st-row"><button type="button" class="st-btn" id="stAgain">Main lagi</button>' +
      '<a class="st-btn blue" id="stNext" href="' + back + '">' + (last ? 'Lihat festival' : 'Lanjut petualangan') + '</a></div></div>';
    document.body.appendChild(ov);
    GS.say(STEP.done);
    ov.querySelector('#stAgain').addEventListener('click', () => { GS.sfx.click(); ov.remove(); r.go(); });
    ov.querySelector('#stNext').addEventListener('click', () => GS.sfx.click());
    setTimeout(() => { const n = ov.querySelector('#stNext'); if (n) n.focus(); }, 50);
  }
})();
