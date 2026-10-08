/* Mat Sains profile editor: change nickname, kelas (grade tier) and avatar.
 * MS.profileEditor.open({ onSave(profile, tierChanged) }) shows a sheet built on
 * the core overlay styles. Progress is kept per tier, so switching kelas never
 * deletes anything. Needs core.js, auth.js and curriculum.js. */
(function () {
  'use strict';
  const MS = (window.MS = window.MS || {});

  const CSS = `
  .ms-pe .gs-card { width: min(640px, 100%); text-align: left; padding: 20px 22px 22px; }
  .ms-pe h2 { margin: 0 56px 14px 0; font-family: var(--font-display); font-weight: 800; font-size: 28px; line-height: 1.1; }
  .ms-pe-close { position: absolute; top: 12px; right: 12px; width: 52px; height: 52px; }
  .ms-pe-sec { margin: 0 0 16px; }
  .ms-pe-label { display: block; margin: 0 0 8px; font-weight: 700; font-size: 17px; }
  .ms-pe-name { width: 100%; height: 60px; padding: 0 16px; border: 3px solid var(--line); border-radius: 18px; background: #fff; color: var(--ink); font-family: var(--font-display); font-weight: 800; font-size: 26px; }
  .ms-pe-name:focus-visible { outline: 4px solid var(--primary); outline-offset: 2px; }
  .ms-pe-tiers { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
  .ms-pe-tier, .ms-pe-av {
    min-width: 0; border: 3px solid var(--line); border-radius: 18px; background: #fff; color: var(--ink);
    box-shadow: 0 4px 0 var(--line); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center;
    transition: transform 80ms ease-out, box-shadow 80ms ease-out;
  }
  .ms-pe-tier { min-height: 76px; padding: 4px 2px; }
  .ms-pe-tier:active, .ms-pe-av:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--line); }
  .ms-pe-tier[aria-pressed="true"], .ms-pe-av[aria-pressed="true"] { background: var(--sun); }
  .ms-pe-tier small { font-size: 13px; font-weight: 700; color: #6B5444; line-height: 1; text-align: center; }
  .ms-pe-tier b { font-family: var(--font-num); font-weight: 600; font-size: 32px; line-height: 1.05; }
  .ms-pe-tier i { font-style: normal; font-size: 12px; font-weight: 700; color: #6B5444; font-variant-numeric: tabular-nums; }
  .ms-pe-note { margin: 8px 0 0; font-size: 15px; line-height: 1.4; color: #5C4636; }
  .ms-pe-avs { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
  .ms-pe-av { aspect-ratio: 1; padding: 2px; overflow: hidden; }
  .ms-pe-av svg { width: 100%; height: 100%; display: block; }
  /* Save stays visible while the sheet scrolls on short screens. */
  .ms-pe-actions { position: sticky; bottom: -22px; z-index: 1; display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; margin: 6px -22px -22px; padding: 12px 22px 16px; background: var(--panel); border-top: 2px solid rgba(59, 42, 32, 0.15); }
  .ms-pe-actions .gs-action { min-height: 64px; font-size: 26px; }
  @media (max-width: 520px) {
    .ms-pe-tiers { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .ms-pe-avs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .ms-pe-actions .gs-action { flex: 1; }
  }
  @media (max-height: 500px) {
    .ms-pe .gs-card { padding: 14px 16px 16px; }
    .ms-pe-actions { bottom: -16px; margin: 6px -16px -16px; padding: 10px 16px 12px; }
    .ms-pe h2 { font-size: 24px; margin-bottom: 10px; }
    .ms-pe-name { height: 52px; font-size: 22px; }
    .ms-pe-tier { min-height: 64px; }
    .ms-pe-tier b { font-size: 26px; }
    .ms-pe-avs { grid-template-columns: repeat(6, minmax(0, 64px)); }
  }`;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function open(opts) {
    opts = opts || {};
    const A = MS.auth, K = MS.kur, GS = window.GS;
    if (!A || !K || !GS) return;
    if (!document.getElementById('ms-pe-css')) {
      const st = document.createElement('style'); st.id = 'ms-pe-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const s = A.current() || {};
    const prof = A.profile() || {};
    const state = { name: s.name || prof.name || 'Teman', kelas: s.kelas || prof.kelas || '1', avatar: s.avatar || prof.avatar };
    const before = K.tier();

    const games = Object.keys(K.GAMES);
    const doneIn = tier => games.reduce((n, g) => n + GS.store.stars(g + '@' + tier).filter(Boolean).length, 0);
    const totalIn = tier => games.length * K.levels(tier);

    const ov = document.createElement('div');
    ov.className = 'gs-overlay ms-pe';
    ov.innerHTML =
      '<div class="gs-card" role="dialog" aria-modal="true" aria-labelledby="ms-pe-title">' +
      '<h2 id="ms-pe-title">Profil</h2>' +
      '<div class="ms-pe-sec"><label class="ms-pe-label" for="ms-pe-name">Nama panggilan</label>' +
      '<input class="ms-pe-name" id="ms-pe-name" maxlength="12" autocomplete="off" autocapitalize="words" spellcheck="false" value="' + esc(state.name) + '"></div>' +
      '<div class="ms-pe-sec"><span class="ms-pe-label" id="ms-pe-kelas-l">Kelas</span>' +
      '<div class="ms-pe-tiers" role="group" aria-labelledby="ms-pe-kelas-l">' +
      K.TIERS.map(t => '<button type="button" class="ms-pe-tier" data-kelas="' + esc(t.kelas) + '" aria-pressed="' + (t.kelas === state.kelas) + '" aria-label="' + esc(t.long) + ', ' + doneIn(t.id) + ' dari ' + totalIn(t.id) + ' level selesai">' +
        '<small>' + (t.id === 'tk' ? 'Belum SD' : 'Kelas') + '</small><b>' + esc(t.id === 'tk' ? 'TK' : t.kelas) + '</b><i>' + doneIn(t.id) + '/' + totalIn(t.id) + '</i></button>').join('') +
      '</div><p class="ms-pe-note">Progres tiap kelas tersimpan sendiri-sendiri, jadi pindah kelas tidak menghapus bintang.</p></div>' +
      '<div class="ms-pe-sec"><span class="ms-pe-label" id="ms-pe-av-l">Teman</span>' +
      '<div class="ms-pe-avs" role="group" aria-labelledby="ms-pe-av-l">' +
      A.AVATARS.map(a => '<button type="button" class="ms-pe-av" data-av="' + esc(a.id) + '" aria-pressed="' + (a.id === state.avatar) + '" aria-label="' + esc(a.label) + '">' + A.avatarSvg(a.id, 72) + '</button>').join('') +
      '</div></div>' +
      '<div class="ms-pe-actions"><button type="button" class="gs-action alt" id="ms-pe-cancel">Batal</button><button type="button" class="gs-action" id="ms-pe-save">Simpan</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    const card = ov.querySelector('.gs-card');
    const x = GS.button('gs-btn-round gs-secondary ms-pe-close', 'Tutup', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>', () => close());
    card.appendChild(x);

    const pick = (sel, attr, key) => ov.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => {
      state[key] = b.getAttribute(attr);
      ov.querySelectorAll(sel).forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      GS.sfx.pop();
    }));
    pick('.ms-pe-tier', 'data-kelas', 'kelas');
    pick('.ms-pe-av', 'data-av', 'avatar');

    function close() { ov.classList.remove('show'); setTimeout(() => ov.remove(), 250); document.removeEventListener('keydown', onKey); }
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('#ms-pe-cancel').addEventListener('click', () => { GS.sfx.click(); close(); });
    ov.querySelector('#ms-pe-save').addEventListener('click', () => {
      state.name = ov.querySelector('#ms-pe-name').value.replace(/\s+/g, ' ').trim().slice(0, 12) || 'Teman';
      const next = A.updateProfile({ name: state.name, kelas: state.kelas, avatar: state.avatar });
      GS.sfx.coin();
      close();
      if (opts.onSave) opts.onSave(next, K.tier() !== before);
    });
    setTimeout(() => { try { ov.querySelector('.ms-pe-tier[aria-pressed="true"]').focus(); } catch (e) { /* ignore */ } }, 60);
    return { close };
  }

  MS.profileEditor = { open };
})();
