/* Mat Sains narrator.
 * 1. Recorded clips first: audio/voice/manifest.json maps a spoken sentence to an
 *    audio file (recorded by a child voice actor). Sentences are matched one by one,
 *    so "Hebat! Seimbang!" can use two clips.
 * 2. Otherwise the device's text-to-speech, tuned to sound younger (higher pitch)
 *    and using the best Indonesian voice the device has.
 * Plugs into core.js through GS.speakImpl / GS.stopSpeech (core wraps speakImpl with the
 * narrator switch, so this file never checks mute itself). Load after core.js. */
(function () {
  'use strict';
  const GS = window.GS;
  if (!GS) return;
  const MS = (window.MS = window.MS || {});
  const script = document.currentScript;
  const root = script ? new URL('../', script.src) : new URL('./', location.href);
  const cfg = Object.assign({ pitch: 1.4, rate: 1.0, clips: true }, (MS.config && MS.config.voice) || {});
  const hasTTS = 'speechSynthesis' in window;

  /* ---------- pick the best Indonesian TTS voice ---------- */
  let voice = null;
  function score(v) {
    if (!/^id([-_]|$)/i.test(v.lang) && !/indones/i.test(v.name)) return -1;
    let s = 0;
    if (/natural|neural|enhanced|premium|online/i.test(v.name)) s += 4; // newer, less robotic engines
    if (/google/i.test(v.name)) s += 3;                                 // Android's default id voice
    if (/damayanti/i.test(v.name)) s += 2;                              // Apple's Indonesian voice
    if (/female|wanita|perempuan|gadis/i.test(v.name)) s += 1;          // closer to a child once pitched up
    return s;
  }
  function pickVoice() {
    if (!hasTTS) return;
    const ranked = speechSynthesis.getVoices().map(v => [score(v), v]).filter(a => a[0] >= 0).sort((a, b) => b[0] - a[0]);
    voice = ranked.length ? ranked[0][1] : null;
  }
  if (hasTTS) {
    pickVoice();
    speechSynthesis.addEventListener ? speechSynthesis.addEventListener('voiceschanged', pickVoice) : (speechSynthesis.onvoiceschanged = pickVoice);
  }

  /* ---------- recorded clips ---------- */
  let clips = {};
  if (cfg.clips && /^https?:$/.test(location.protocol)) {
    fetch(new URL('audio/voice/manifest.json', root).href)
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && j.lines) clips = j.lines; })
      .catch(() => { /* no recordings yet: TTS only */ });
  }
  const speakable = t => (GS.speakable ? GS.speakable(t) : String(t));
  /** Normalised key used in manifest.json: spoken form, lower case, no punctuation. */
  const keyOf = t => speakable(t).toLowerCase().replace(/[.,!?;:"'()]/g, '').replace(/\s+/g, ' ').trim();
  const sentences = t => (String(t).match(/[^.!?]+[.!?]*/g) || [String(t)]).map(s => s.trim()).filter(Boolean);

  /* ---------- playback ---------- */
  // Background music ducks while the narrator is audible (core.js GS.music.duck).
  const duck = (on, text) => { if (GS.music && GS.music.duck) GS.music.duck(on, on && GS.speechMs ? GS.speechMs(text) : undefined); };
  let token = 0, audio = null;
  function stop() {
    token++;
    if (audio) { try { audio.pause(); } catch (e) { /* ignore */ } audio = null; }
    if (hasTTS) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
    duck(false);
  }
  function tts(text, done) {
    if (!hasTTS) { done && done(); return; }
    try {
      const u = new SpeechSynthesisUtterance(speakable(text));
      u.lang = 'id-ID';
      if (voice) u.voice = voice;
      u.pitch = cfg.pitch;
      u.rate = cfg.rate;
      u.onstart = () => duck(true, text);
      u.onend = u.onerror = () => { duck(false); if (done) done(); };
      speechSynthesis.speak(u);
    } catch (e) { done && done(); }
  }
  function playSeq(parts, i, my) {
    if (my !== token || i >= parts.length) return;
    const next = () => playSeq(parts, i + 1, my);
    const file = clips[keyOf(parts[i])];
    if (!file) { tts(parts[i], next); return; }
    const a = (audio = new Audio(new URL('audio/voice/' + file, root).href));
    a.onplaying = () => duck(true, parts[i]);
    a.onended = () => { duck(false); next(); };
    a.onerror = () => { duck(false); tts(parts[i], next); };
    const p = a.play();
    if (p && p.catch) p.catch(() => tts(parts[i], next));
  }

  GS.speakImpl = function (text) {
    stop();
    remember(text);
    const my = token;
    const parts = sentences(text);
    // No recording for any sentence: one utterance sounds smoother than a chain.
    if (!parts.some(p => clips[keyOf(p)])) { tts(text); return; }
    playSeq(parts, 0, my);
  };
  GS.stopSpeech = stop;

  /* ---------- line collection for the recording script ---------- */
  const SEEN_KEY = 'ms.voice.seen';
  function remember(text) {
    try {
      const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
      if (seen.indexOf(text) < 0) { seen.push(text); localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-800))); }
    } catch (e) { /* storage blocked */ }
  }
  MS.voice = {
    config: cfg,
    keyOf,
    /** Every line spoken on this device so far, for building the recording list. */
    seen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (e) { return []; } },
    /** Lines heard here that still have no recording. */
    missing() { return MS.voice.seen().filter(t => sentences(t).some(s => !clips[keyOf(s)])); },
    voiceName: () => (voice ? voice.name : null)
  };
})();
