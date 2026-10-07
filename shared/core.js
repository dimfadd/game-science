/* Kampung Sains: shared runtime for every mini-game.
 * Exposes window.GS with storage, sound, voice, tweening, SVG helpers,
 * drag handling, confetti, the in-game HUD and the level-complete overlay.
 * No dependencies; works offline from file:// and on touch tablets. */
(function () {
  'use strict';
  const GS = (window.GS = window.GS || {});

  /* ---------------- storage (survives missing localStorage) ---------------- */
  const KEY = 'kampung-sains.v1';
  let mem = {};
  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || mem; } catch (e) { return mem; }
  }
  function writeAll(d) {
    mem = d;
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* private mode */ }
  }
  GS.store = {
    get(k, def) { const d = readAll(); return k in d ? d[k] : def; },
    set(k, v) { const d = readAll(); d[k] = v; writeAll(d); },
    stars(gameId) { return GS.store.get('stars.' + gameId, []); },
    setStars(gameId, level, n) {
      const s = GS.store.stars(gameId).slice();
      s[level] = Math.max(s[level] || 0, n);
      GS.store.set('stars.' + gameId, s);
    },
    totalStars(gameId) { return GS.store.stars(gameId).reduce((a, b) => a + (b || 0), 0); },
    /** First level index that has not been completed yet. */
    nextLevel(gameId, count) {
      const s = GS.store.stars(gameId);
      for (let i = 0; i < count; i++) if (!s[i]) return i;
      return count - 1;
    }
  };

  /* ---------------- motion preferences ---------------- */
  GS.reducedMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------- sound: synthesized, no audio files ---------------- */
  GS.muted = GS.store.get('muted', false);
  let actx = null;
  function ac() {
    if (!actx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      actx = new C();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  // Browsers only allow audio after a user gesture: unlock on first touch.
  window.addEventListener('pointerdown', function unlock() { ac(); window.removeEventListener('pointerdown', unlock); }, { once: true });

  function tone(o) {
    const a = ac(); if (!a || GS.muted) return;
    const f = o.f || 440, dur = o.t || 0.15, vol = o.vol == null ? 0.2 : o.vol;
    const t0 = a.currentTime + (o.delay || 0);
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  function noise(o) {
    const a = ac(); if (!a || GS.muted) return;
    const dur = o.t || 0.2, t0 = a.currentTime + (o.delay || 0);
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf;
    const filt = a.createBiquadFilter(); filt.type = 'bandpass';
    filt.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.freq2) filt.frequency.exponentialRampToValueAtTime(o.freq2, t0 + dur);
    filt.Q.value = o.q || 1;
    const g = a.createGain();
    g.gain.setValueAtTime(o.vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(a.destination);
    src.start(t0); src.stop(t0 + dur);
  }
  GS.tone = tone; GS.noise = noise;
  GS.sfx = {
    pick() { tone({ f: 520, f2: 820, t: 0.09, type: 'triangle', vol: 0.16 }); },
    drop() { tone({ f: 260, f2: 120, t: 0.16, vol: 0.3 }); noise({ t: 0.06, vol: 0.08, freq: 700 }); },
    pop() { tone({ f: 700, f2: 1200, t: 0.07, type: 'square', vol: 0.06 }); },
    tick() { tone({ f: 1400, t: 0.03, type: 'square', vol: 0.04 }); },
    creak() { tone({ f: 140, f2: 110, t: 0.22, type: 'sawtooth', vol: 0.035 }); },
    boing() { tone({ f: 160, f2: 620, t: 0.28, vol: 0.22 }); tone({ f: 320, f2: 900, t: 0.2, type: 'triangle', vol: 0.06, delay: 0.03 }); },
    whoosh() { noise({ t: 0.4, vol: 0.12, freq: 400, freq2: 2400, q: 0.8 }); },
    splash() { noise({ t: 0.5, vol: 0.2, freq: 1800, freq2: 300, q: 0.6 }); },
    thud() { tone({ f: 110, f2: 50, t: 0.25, vol: 0.4 }); noise({ t: 0.08, vol: 0.12, freq: 300 }); },
    coin() { tone({ f: 988, t: 0.08, type: 'square', vol: 0.06 }); tone({ f: 1319, t: 0.25, type: 'square', vol: 0.06, delay: 0.07 }); },
    click() { tone({ f: 900, t: 0.04, type: 'triangle', vol: 0.1 }); },
    // Gentle, never punishing: a soft falling two-note "hmm".
    oops() { tone({ f: 392, t: 0.16, type: 'triangle', vol: 0.14 }); tone({ f: 330, t: 0.22, type: 'triangle', vol: 0.14, delay: 0.14 }); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone({ f, t: 0.28, type: 'triangle', vol: 0.18, delay: i * 0.09 })); },
    star(i) { tone({ f: 784 * Math.pow(1.26, i || 0), t: 0.3, type: 'triangle', vol: 0.18 }); tone({ f: 1568 * Math.pow(1.26, i || 0), t: 0.2, vol: 0.05 }); },
    /** Pitch rises with n: use for counting so each step is audible. */
    count(n) { tone({ f: 440 * Math.pow(2, Math.min(n, 24) / 12), t: 0.12, type: 'triangle', vol: 0.15 }); }
  };

  /* ---------------- voice (Bahasa Indonesia) ---------------- */
  let idVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    idVoice = vs.find(v => /^id([-_]|$)/i.test(v.lang)) || vs.find(v => /indones/i.test(v.name)) || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  GS.lastSay = '';
  /** Speak and show a caption. Captions always appear even when muted or without TTS. */
  GS.say = function (text, opts) {
    GS.lastSay = text;
    if (GS._bubble) GS._bubble(text);
    if (GS.muted || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'id-ID';
      if (idVoice) u.voice = idVoice;
      u.rate = (opts && opts.rate) || 0.92;
      u.pitch = 1.15;
      speechSynthesis.speak(u);
    } catch (e) { /* speech unavailable */ }
  };
  GS.setMuted = function (m) {
    GS.muted = m; GS.store.set('muted', m);
    if (m && 'speechSynthesis' in window) speechSynthesis.cancel();
    document.querySelectorAll('[data-gs-sound]').forEach(b => {
      b.setAttribute('aria-pressed', String(!m));
      b.innerHTML = m ? ICON.soundOff : ICON.soundOn;
      b.setAttribute('aria-label', m ? 'Nyalakan suara' : 'Matikan suara');
    });
  };

  /* ---------------- tweening ---------------- */
  GS.ease = {
    linear: t => t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
    outBounce: t => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  };
  /** tween(ms, fn(easedT, rawT), easeName) -> Promise */
  GS.tween = function (dur, fn, ease) {
    const e = typeof ease === 'function' ? ease : GS.ease[ease || 'outCubic'];
    if (GS.reducedMotion) dur = Math.min(dur, 120);
    return new Promise(res => {
      const t0 = performance.now();
      function step(now) {
        const p = Math.min(1, (now - t0) / dur);
        fn(e(p), p);
        if (p < 1) requestAnimationFrame(step); else res();
      }
      requestAnimationFrame(step);
    });
  };
  GS.lerp = (a, b, t) => a + (b - a) * t;
  GS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  GS.wait = ms => new Promise(r => setTimeout(r, ms));
  GS.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  GS.rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  /* ---------------- SVG helpers ---------------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  GS.SVGNS = SVGNS;
  /** GS.el('rect', {x:1}, parent) creates an SVG element. */
  GS.el = function (tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  /** Insert an SVG markup string (e.g. from GS.art) into a <g>. */
  GS.markup = function (g, svgString) {
    const tmp = document.createElementNS(SVGNS, 'g');
    tmp.innerHTML = svgString;
    while (tmp.firstChild) g.appendChild(tmp.firstChild);
    return g;
  };
  /** Convert a client (screen) point into the user space of an SVG element. */
  GS.svgPoint = function (svg, clientX, clientY, el) {
    const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
    const m = (el || svg).getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: clientX, y: clientY };
  };
  /**
   * Pointer drag that works with mouse, pen and touch.
   * opts: { svg, onStart(p, e) -> false to cancel, onMove(p, e), onEnd(p, e) }
   * p is in the svg's user space.
   */
  GS.drag = function (target, opts) {
    let active = null;
    target.style.touchAction = 'none';
    target.addEventListener('pointerdown', e => {
      if (active !== null) return;
      const p = GS.svgPoint(opts.svg, e.clientX, e.clientY);
      if (opts.onStart && opts.onStart(p, e) === false) return;
      active = e.pointerId;
      try { target.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      e.preventDefault();
    });
    target.addEventListener('pointermove', e => {
      if (e.pointerId !== active) return;
      opts.onMove && opts.onMove(GS.svgPoint(opts.svg, e.clientX, e.clientY), e);
    });
    const end = e => {
      if (e.pointerId !== active) return;
      active = null;
      opts.onEnd && opts.onEnd(GS.svgPoint(opts.svg, e.clientX, e.clientY), e);
    };
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  };

  /* ---------------- icons (UI only) ---------------- */
  const ICON = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m16 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    voice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17h-2A1.5 1.5 0 0 1 3 15.5V7a1.5 1.5 0 0 1 1.5-1.5z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="8.5" cy="11.3" r="1.4" fill="currentColor"/><circle cx="12" cy="11.3" r="1.4" fill="currentColor"/><circle cx="15.5" cy="11.3" r="1.4" fill="currentColor"/></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="currentColor"/></svg>',
    retry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.2-5.1" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M5 3.5v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5 16 12l-8 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.6-4.4 6.3-.8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    hint: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1V17h5v-1.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z" fill="currentColor"/><rect x="9.5" y="18.5" width="5" height="2.5" rx="1.2" fill="currentColor"/></svg>'
  };
  GS.ICON = ICON;

  function button(cls, label, icon, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gs-btn ' + cls;
    b.setAttribute('aria-label', label);
    b.innerHTML = icon;
    b.addEventListener('click', e => { GS.sfx.click(); onClick && onClick(e); });
    return b;
  }
  GS.button = button;

  /* ---------------- confetti (canvas overlay, real gravity) ---------------- */
  let cv = null, cctx = null, parts = [], running = false;
  const CONFETTI = ['#F2B33D', '#E8603C', '#2F9C95', '#3D7DD8', '#F28CB1', '#8CC152'];
  function ensureCanvas() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.className = 'gs-confetti';
    document.body.appendChild(cv);
    cctx = cv.getContext('2d');
    const fit = () => { const d = window.devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; cctx.setTransform(d, 0, 0, d, 0, 0); };
    fit(); window.addEventListener('resize', fit);
  }
  /** Burst of confetti from a screen point (defaults to centre). */
  GS.confetti = function (x, y, n) {
    if (GS.reducedMotion) return;
    ensureCanvas();
    x = x == null ? innerWidth / 2 : x; y = y == null ? innerHeight / 2 : y;
    for (let i = 0; i < (n || 70); i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, s = 6 + Math.random() * 9;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 7 + Math.random() * 6, h: 4 + Math.random() * 4, c: CONFETTI[i % CONFETTI.length], life: 0 });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  };
  function loop() {
    cctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.y < innerHeight + 40 && p.life < 240);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
      cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.r);
      cctx.fillStyle = p.c; cctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.life * 0.15)), p.w, p.h * Math.abs(Math.cos(p.life * 0.15)) + 0.5);
      cctx.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else { running = false; cctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------------- HUD ---------------- */
  /**
   * GS.hud({ gameId, title, levelCount, onLevelPick(i), home })
   * Builds the top bar: home, title, level indicator, voice replay, sound toggle,
   * plus a mascot caption bubble at the bottom. Returns { setLevel(i), bubble(text), el }.
   */
  GS.hud = function (o) {
    const bar = document.createElement('header');
    bar.className = 'gs-hud';
    const home = document.createElement('a');
    home.className = 'gs-btn gs-home';
    home.href = o.home || '../../index.html';
    home.setAttribute('aria-label', 'Kembali ke peta');
    home.innerHTML = ICON.home;
    const title = document.createElement('div');
    title.className = 'gs-title';
    title.innerHTML = '<span class="gs-title-name"></span><span class="gs-title-level"></span>';
    title.querySelector('.gs-title-name').textContent = o.title;
    const right = document.createElement('div');
    right.className = 'gs-hud-right';
    if (o.levelCount && o.onLevelPick) {
      right.appendChild(button('gs-levels', 'Pilih level', ICON.grid, () => GS.levelPicker({ gameId: o.gameId, count: o.levelCount, title: o.title, onPick: o.onLevelPick })));
    }
    right.appendChild(button('gs-voice', 'Ulangi petunjuk', ICON.voice, () => { if (GS.lastSay) GS.say(GS.lastSay); }));
    const snd = button('gs-sound', '', '', () => GS.setMuted(!GS.muted));
    snd.setAttribute('data-gs-sound', '');
    right.appendChild(snd);
    bar.append(home, title, right);
    document.body.prepend(bar);

    // Small portrait phones get a friendly "turn your phone" screen (CSS decides when).
    const rot = document.createElement('div');
    rot.className = 'gs-rotate';
    rot.innerHTML = '<div><svg viewBox="0 0 120 90" width="140" aria-hidden="true"><rect x="38" y="6" width="44" height="78" rx="8" fill="#fff" stroke="#3B2A20" stroke-width="4"/><path d="M14 58a40 40 0 0 1 22-40" fill="none" stroke="#1F6FD1" stroke-width="5" stroke-linecap="round"/><path d="m28 14 9 4-5 9" fill="none" stroke="#1F6FD1" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg><p>Putar HP-mu ke samping, ya!</p></div>';
    document.body.appendChild(rot);

    // Caption bubble with the mascot's face; doubles as subtitles for the voice.
    const cap = document.createElement('div');
    cap.className = 'gs-caption';
    cap.setAttribute('role', 'status');
    cap.setAttribute('aria-live', 'polite');
    cap.innerHTML = '<div class="gs-caption-face"></div><p class="gs-caption-text"></p>';
    document.body.appendChild(cap);
    const face = cap.querySelector('.gs-caption-face');
    if (GS.art && GS.art.mascot) face.innerHTML = GS.art.mascot({ mood: 'happy', size: 64 });
    const txt = cap.querySelector('.gs-caption-text');
    let hideT = 0;
    GS._bubble = function (text) {
      txt.textContent = text;
      cap.classList.add('show');
      clearTimeout(hideT);
      const short = window.innerHeight <= 500;
      hideT = setTimeout(() => cap.classList.remove('show'), short ? Math.max(2500, text.length * 60) : Math.max(3500, text.length * 85));
    };
    cap.addEventListener('click', () => { if (GS.lastSay) GS.say(GS.lastSay); });
    GS.setMuted(GS.muted);
    return {
      el: bar,
      setLevel(i) { title.querySelector('.gs-title-level').textContent = 'Level ' + (i + 1) + (o.levelCount ? ' / ' + o.levelCount : ''); },
      bubble: GS._bubble,
      mood(m) { if (GS.art && GS.art.mascot) face.innerHTML = GS.art.mascot({ mood: m, size: 64 }); }
    };
  };

  /* ---------------- overlays ---------------- */
  function overlay(cls) {
    const o = document.createElement('div');
    o.className = 'gs-overlay ' + (cls || '');
    o.innerHTML = '<div class="gs-card" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add('show'));
    const close = () => { o.classList.remove('show'); setTimeout(() => o.remove(), 250); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape' && o.dataset.dismiss !== 'no') close(); };
    document.addEventListener('keydown', onKey);
    return { root: o, card: o.querySelector('.gs-card'), close };
  }

  /**
   * Level-complete celebration.
   * GS.celebrate({ stars: 1-3, text, onNext, onReplay, hasNext })
   */
  GS.celebrate = function (o) {
    const ov = overlay('gs-win');
    ov.root.dataset.dismiss = 'no';
    const stars = Math.max(1, Math.min(3, o.stars || 3));
    const mascot = GS.art && GS.art.mascot ? GS.art.mascot({ mood: 'cheer', size: 150 }) : '';
    ov.card.innerHTML =
      '<div class="gs-win-mascot">' + mascot + '</div>' +
      '<div class="gs-win-stars">' + [0, 1, 2].map(i => '<span class="gs-star' + (i < stars ? ' on' : '') + '" style="--i:' + i + '">' + ICON.star + '</span>').join('') + '</div>' +
      '<p class="gs-win-text"></p>' +
      '<div class="gs-win-actions"></div>';
    ov.card.querySelector('.gs-win-text').textContent = o.text || 'Hebat!';
    const act = ov.card.querySelector('.gs-win-actions');
    act.appendChild(button('gs-btn-round gs-secondary', 'Main lagi', ICON.retry, () => { ov.close(); o.onReplay && o.onReplay(); }));
    if (o.hasNext !== false) {
      const nb = button('gs-btn-round gs-primary gs-big', 'Lanjut', ICON.next, () => { ov.close(); o.onNext && o.onNext(); });
      act.appendChild(nb);
      setTimeout(() => nb.focus(), 300);
    } else {
      const hb = document.createElement('a');
      hb.className = 'gs-btn gs-btn-round gs-primary gs-big';
      hb.href = '../../index.html';
      hb.setAttribute('aria-label', 'Kembali ke peta');
      hb.innerHTML = ICON.home;
      act.appendChild(hb);
    }
    GS.sfx.win();
    for (let i = 0; i < stars; i++) setTimeout(() => GS.sfx.star(i), 350 + i * 260);
    const r = ov.card.getBoundingClientRect();
    setTimeout(() => GS.confetti(r.left + r.width / 2, r.top + 40, 90), 200);
    if (o.say !== false) GS.say(o.text || 'Hebat!');
    return ov;
  };

  /** Level picker grid. Levels unlock one after another; finished ones show stars. */
  GS.levelPicker = function (o) {
    const ov = overlay('gs-picker');
    const s = GS.store.stars(o.gameId);
    const unlocked = GS.store.nextLevel(o.gameId, o.count);
    ov.card.innerHTML = '<h2 class="gs-picker-title"></h2><div class="gs-picker-grid"></div>';
    ov.card.querySelector('.gs-picker-title').textContent = o.title || 'Pilih level';
    const grid = ov.card.querySelector('.gs-picker-grid');
    for (let i = 0; i < o.count; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      const open = i <= Math.max(unlocked, s.length);
      b.className = 'gs-level' + (s[i] ? ' done' : '') + (open ? '' : ' locked');
      b.disabled = !open;
      b.setAttribute('aria-label', 'Level ' + (i + 1) + (open ? '' : ', terkunci'));
      b.innerHTML = open
        ? '<span class="gs-level-n">' + (i + 1) + '</span><span class="gs-level-stars">' + [0, 1, 2].map(k => '<i class="' + (k < (s[i] || 0) ? 'on' : '') + '">' + ICON.star + '</i>').join('') + '</span>'
        : ICON.lock;
      b.addEventListener('click', () => { GS.sfx.click(); ov.close(); o.onPick(i); });
      grid.appendChild(b);
    }
    const x = button('gs-btn-round gs-secondary gs-picker-close', 'Tutup', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>', () => ov.close());
    ov.card.appendChild(x);
    return ov;
  };

  /** Floating "+1" style text at a screen point. */
  GS.floatText = function (text, x, y, cls) {
    const d = document.createElement('div');
    d.className = 'gs-float ' + (cls || '');
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1100);
  };

  /**
   * Standard level runner used by every game.
   * GS.runner({ gameId, count, start(i) }) -> { go(i), next(), win(stars, text), current }
   * start(i) builds level i. win() saves stars and shows the celebration.
   */
  GS.runner = function (o) {
    GS.store.set('lastGame', o.gameId);
    const r = {
      current: 0,
      go(i) { r.current = GS.clamp(i, 0, o.count - 1); if (o.hud) o.hud.setLevel(r.current); o.start(r.current); },
      next() { r.go(r.current + 1); },
      win(stars, text) {
        GS.store.setStars(o.gameId, r.current, stars);
        const hasNext = r.current < o.count - 1;
        return GS.celebrate({ stars, text, hasNext, onNext: () => r.next(), onReplay: () => r.go(r.current) });
      }
    };
    return r;
  };
})();
