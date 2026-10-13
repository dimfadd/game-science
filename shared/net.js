/* Mat Sains: realtime rooms for the Balapan (race) mode.
 *
 *   MS.net.mode()             -> 'supabase' | 'bc' | '' (no online play configured)
 *   MS.net.available()        -> true when a backend is configured
 *   MS.net.code()             -> a new 5-letter room code (no 0/O, 1/I/L look-alikes)
 *   MS.net.room(code, meta, { onPeers(list), onMsg(msg, fromId), onStatus(s) })
 *                             -> Promise<{ send(type, data), update(meta), peers(), leave() }>
 *   MS.net.lobby({ onRooms(list) }) -> Promise<{ announce(meta|null), leave() }>  (public rooms)
 *
 * meta is what other players see: { id, name, char, host, tier, ... }. Messages are small
 * objects { t: type, ...data, from }. Nothing is stored on a server: rooms live only while
 * someone is in them (presence), so no child data is kept after the race.
 *
 * Backends
 * - 'supabase': Supabase Realtime (broadcast + presence, no database tables). Turns on when
 *   MS.config.SUPABASE_URL and MS.config.SUPABASE_ANON_KEY are set (shared/config.js). The
 *   client library is loaded from the CDN only when a room is opened.
 * - 'bc': BroadcastChannel between tabs of the same browser, presence emulated with
 *   heartbeats. For development and the automated test only (?net=bc); it never leaves the device.
 */
(function () {
  'use strict';
  const MS = (window.MS = window.MS || {});
  const CFG = () => MS.config || {};
  const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const qs = (() => { try { return new URLSearchParams(location.search); } catch (e) { return { get: () => null }; } })();

  function mode() {
    if (qs.get('net') === 'bc' && 'BroadcastChannel' in window) return 'bc';
    const c = CFG();
    return c.SUPABASE_URL && c.SUPABASE_ANON_KEY ? 'supabase' : '';
  }
  function code() {
    let s = '';
    const r = new Uint32Array(5);
    try { crypto.getRandomValues(r); } catch (e) { for (let i = 0; i < 5; i++) r[i] = Math.floor(Math.random() * 1e9); }
    for (let i = 0; i < 5; i++) s += ALPHA[r[i] % ALPHA.length];
    return s;
  }
  const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

  /* ---------------- BroadcastChannel backend (same browser, for tests) ---------------- */
  function bcChannel(name, meta, h) {
    const bc = new BroadcastChannel('ms-' + name);
    const peers = {}; // id -> { meta, seen }
    let me = Object.assign({}, meta), alive = true;
    const list = () => [me].concat(Object.keys(peers).map(k => peers[k].meta)).filter(Boolean);
    const emit = () => h.onPeers && h.onPeers(list());
    const post = m => { try { bc.postMessage(m); } catch (e) { /* closed */ } };
    bc.onmessage = e => {
      const m = e.data || {};
      if (!alive || m.from === me.id) return;
      if (m.k === 'hello' || m.k === 'here') {
        const isNew = !peers[m.from];
        peers[m.from] = { meta: m.meta, seen: Date.now() };
        if (m.k === 'hello') post({ k: 'here', from: me.id, meta: me });
        if (isNew || m.k === 'here') emit();
      } else if (m.k === 'bye') { delete peers[m.from]; emit(); }
      else if (m.k === 'msg' && h.onMsg) h.onMsg(m.data, m.from);
    };
    const beat = setInterval(() => {
      post({ k: 'here', from: me.id, meta: me });
      let gone = false;
      Object.keys(peers).forEach(k => { if (Date.now() - peers[k].seen > 7000) { delete peers[k]; gone = true; } });
      if (gone) emit();
    }, 2000);
    post({ k: 'hello', from: me.id, meta: me });
    setTimeout(() => { if (h.onStatus) h.onStatus('ok'); emit(); }, 50);
    return Promise.resolve({
      send(t, data) { post({ k: 'msg', from: me.id, data: Object.assign({ t, from: me.id }, data || {}) }); },
      update(m) { me = Object.assign({}, me, m); post({ k: 'here', from: me.id, meta: me }); emit(); },
      peers: list,
      leave() { if (!alive) return; alive = false; clearInterval(beat); post({ k: 'bye', from: me.id }); bc.close(); }
    });
  }

  /* ---------------- Supabase Realtime backend ---------------- */
  let sbLoad = null, sbClient = null;
  function supa() {
    if (sbClient) return Promise.resolve(sbClient);
    if (!sbLoad) sbLoad = new Promise((res, rej) => {
      if (window.supabase && window.supabase.createClient) return res();
      const s = document.createElement('script');
      s.src = SB_LIB; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => res(); s.onerror = () => { sbLoad = null; rej(new Error('lib')); };
      document.head.appendChild(s);
    });
    return sbLoad.then(() => {
      sbClient = window.supabase.createClient(CFG().SUPABASE_URL, CFG().SUPABASE_ANON_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } });
      return sbClient;
    });
  }
  function sbChannel(name, meta, h) {
    return supa().then(client => new Promise(resolve => {
      let me = Object.assign({}, meta), done = false;
      const ch = client.channel('ms-' + name, { config: { broadcast: { self: false }, presence: { key: me.id } } });
      const list = () => {
        const st = ch.presenceState(), out = [];
        Object.keys(st).forEach(k => { const m = st[k] && st[k][0]; if (m && m.id) out.push(m); });
        if (!out.some(p => p.id === me.id)) out.unshift(me);
        return out;
      };
      ch.on('presence', { event: 'sync' }, () => h.onPeers && h.onPeers(list()));
      ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (h.onMsg && payload) h.onMsg(payload, payload.from); });
      const api = {
        send(t, data) { ch.send({ type: 'broadcast', event: 'm', payload: Object.assign({ t, from: me.id }, data || {}) }); },
        update(m) { me = Object.assign({}, me, m); ch.track(me); },
        peers: list,
        leave() { try { ch.untrack(); client.removeChannel(ch); } catch (e) { /* ignore */ } }
      };
      ch.subscribe(status => {
        if (h.onStatus) h.onStatus(status === 'SUBSCRIBED' ? 'ok' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'error' : String(status).toLowerCase());
        if (status === 'SUBSCRIBED') { ch.track(me); if (!done) { done = true; resolve(api); } }
      });
      setTimeout(() => { if (!done) { done = true; if (h.onStatus) h.onStatus('error'); resolve(api); } }, 9000);
    }));
  }

  function channel(name, meta, h) {
    const m = mode();
    if (m === 'bc') return bcChannel(name, meta, h || {});
    if (m === 'supabase') return sbChannel(name, meta, h || {});
    return Promise.reject(new Error('offline'));
  }

  MS.net = {
    mode,
    available: () => !!mode(),
    code,
    cleanCode,
    room: (c, meta, h) => channel('room-' + cleanCode(c), meta, h),
    /** Public rooms: hosts announce { code, tier, n, max, open }, everyone else listens. */
    lobby(h) {
      h = h || {};
      const id = 'L' + code() + code();
      let api = null;
      return channel('lobby', { id, lobby: true }, {
        onPeers: list => h.onRooms && h.onRooms(list.filter(p => p.room && p.room.open).map(p => p.room)),
        onStatus: h.onStatus
      }).then(a => {
        api = a;
        return { announce: room => api.update({ room: room || null }), leave: () => api.leave() };
      });
    }
  };
})();
