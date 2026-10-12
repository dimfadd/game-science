/* Mat Sains PWA helper: registers the service worker and offers "Pasang aplikasi".
 * Any element with [data-pwa-install] becomes an install button (hidden when the
 * app is already installed). Android/Chrome uses the native install prompt;
 * iPhone/iPad Safari has none, so the button opens a short how-to sheet. */
(function () {
  'use strict';
  const MS = (window.MS = window.MS || {});
  const script = document.currentScript;
  const root = script ? new URL('../', script.src) : new URL('./', location.href);

  const standalone = () =>
    (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)) ||
    navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let deferred = null;
  const pwa = (MS.pwa = {
    standalone,
    isIOS,
    /** True when tapping an install button can do something useful. */
    canInstall: () => !standalone() && (!!deferred || isIOS),
    install
  });

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('sw.js', root).href, { scope: root.pathname }).catch(() => { /* offline support is optional */ });
    });
    // A new version took over: refresh quietly, but never in the middle of a game. On the very
    // first visit there was no worker yet: its first takeover is not an update, so no reload
    // (it used to reload the landing page and the onboarding a second after they opened).
    const hadController = !!navigator.serviceWorker.controller;
    let refreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshed || document.body.classList.contains('gs-game')) return;
      refreshed = true;
      location.reload();
    });
  }

  /* ---------- install prompt ---------- */
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    render();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    render();
    toast('Mat Sains sudah terpasang di layar utama.');
  });

  async function install() {
    if (deferred) {
      const ev = deferred;
      deferred = null;
      ev.prompt();
      try { await ev.userChoice; } catch (e) { /* dismissed */ }
      render();
      return;
    }
    if (isIOS) iosSheet();
  }

  function render() {
    const show = pwa.canInstall();
    document.querySelectorAll('[data-pwa-install]').forEach(el => {
      el.hidden = !show;
      if (!el.dataset.pwaBound) {
        el.dataset.pwaBound = '1';
        el.addEventListener('click', e => { e.preventDefault(); install(); });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();

  /* ---------- iOS how-to sheet ---------- */
  const SHARE_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="#1F6FD1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="#1F6FD1" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const ADD_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="#2B1D14" stroke-width="2.2"/><path d="M12 8v8M8 12h8" stroke="#2B1D14" stroke-width="2.4" stroke-linecap="round"/></svg>';
  function iosSheet() {
    injectStyle();
    const ov = document.createElement('div');
    ov.className = 'ms-pwa-sheet';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'ms-pwa-title');
    ov.innerHTML =
      '<div class="ms-pwa-card">' +
      '<h2 id="ms-pwa-title">Pasang Mat Sains</h2>' +
      '<ol>' +
      '<li><span class="ms-pwa-ic">' + SHARE_ICON + '</span><span>Ketuk tombol <b>Bagikan</b> di Safari.</span></li>' +
      '<li><span class="ms-pwa-ic">' + ADD_ICON + '</span><span>Pilih <b>Tambahkan ke Layar Utama</b>.</span></li>' +
      '<li><span class="ms-pwa-ic ms-pwa-app"><img src="' + new URL('icons/apple-touch-icon.png', root).href + '" alt=""></span><span>Buka Mat Sains dari layar utama. Game tampil layar penuh.</span></li>' +
      '</ol>' +
      '<button type="button" class="ms-pwa-ok">Mengerti</button>' +
      '</div>';
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    const ok = ov.querySelector('.ms-pwa-ok');
    ok.addEventListener('click', close);
    ok.focus();
  }

  function toast(text) {
    injectStyle();
    const t = document.createElement('div');
    t.className = 'ms-pwa-toast';
    t.setAttribute('role', 'status');
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  let styled = false;
  function injectStyle() {
    if (styled) return;
    styled = true;
    const s = document.createElement('style');
    s.textContent =
      '.ms-pwa-sheet{position:fixed;inset:0;z-index:90;display:grid;place-items:end center;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px));background:rgba(43,29,20,.45)}' +
      '.ms-pwa-card{width:min(440px,100%);max-height:calc(100% - 16px);overflow:auto;background:#FFF8EC;color:#2B1D14;border:4px solid #3B2A20;border-radius:28px;padding:20px 20px 18px;box-shadow:0 8px 0 rgba(59,42,32,.35);font-family:Andika,Nunito,system-ui,sans-serif}' +
      '.ms-pwa-card h2{margin:0 0 12px;font-family:"Baloo 2",system-ui,sans-serif;font-weight:800;font-size:26px}' +
      '.ms-pwa-card ol{list-style:none;margin:0 0 16px;padding:0;display:grid;gap:12px}' +
      '.ms-pwa-card li{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:center;font-size:18px;line-height:1.35}' +
      '.ms-pwa-ic{width:44px;height:44px;border-radius:12px;background:#fff;border:2px solid #3B2A20;display:grid;place-items:center;overflow:hidden}' +
      '.ms-pwa-app img{width:100%;height:100%;display:block}' +
      '.ms-pwa-ok{width:100%;min-height:56px;border:3px solid #3B2A20;border-radius:999px;background:#1F6FD1;color:#fff;font-family:"Baloo 2",system-ui,sans-serif;font-weight:800;font-size:22px;box-shadow:0 4px 0 #3B2A20;cursor:pointer}' +
      '.ms-pwa-ok:focus-visible{outline:4px solid #1F6FD1;outline-offset:3px}' +
      '.ms-pwa-toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:95;padding:12px 18px;background:#0F8C7A;color:#fff;border:3px solid #3B2A20;border-radius:999px;font-family:Andika,system-ui,sans-serif;font-weight:700;font-size:16px}';
    document.head.appendChild(s);
  }
})();
