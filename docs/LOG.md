# Work log

Newest first. Every change adds an entry: date, what changed, why, and anything left open.

## 2026-10-08: Mat Sains, PWA, onboarding, login, bug fixes

Requested by the owner after testing on a real Android phone via Vercel (game-science-seven.vercel.app).
- Renamed the product to **Mat Sains** (storage key `kampung-sains.v1` kept so progress survives).
- **Bug "the scale flies away"**: root cause was CSS `transform` on SVG groups positioned with a `transform` attribute. On the hub, `:hover`/`:active` scale replaced the landmark's `translate`, so tapping Timbangan Pasar flung its landmark to 0,0 just before the game opened. Same class of bug in shared keyframes (`.gs-wobble/.gs-pulse/.gs-shake`) affected Rakit (jar), Katak (frog) and Ketapel (mango). Fixed with outer/inner groups and `GS.fx`; regression test `tests/hub-hover.js`.
- Hub: card icons no longer cropped; gallery link removed (and `assets.html` excluded from the deploy); swipe hint moved; header stacks on narrow phones; profile chip and install card added.
- Games: start gate ("Main!") that unlocks audio, requests fullscreen + landscape on touch devices, and speaks the first instruction after the tap; fullscreen toggle in the HUD.
- PWA: manifest, service worker (offline, versioned per deploy), install button with an iOS how-to sheet, icons from Si Cil.
- Vercel: `vercel.json` + `scripts/build.sh` publish only public files from `dist/`.
- Onboarding + login (`welcome.html`, `shared/auth.js`, `shared/config.js`): 3 questions (nickname, kelas, avatar), then login/register; dev account test@matsains.id / test; Google sign-in ready once `GOOGLE_CLIENT_ID` is set; every page redirects to welcome without a session. Fixed: kelas tiles overflowing on phone landscape.
- Narrator: `shared/voice.js` (recorded clips first, TTS pitched up as fallback). Browser TTS has no child voice; real recordings are needed (`docs/NARASI.md`).
- Project memory: `CLAUDE.md`, `AGENTS.md`, this log. Test harness in `tests/`.
- Open: record child narration; set up the Google OAuth client ID; a real backend before commercial use; one intermittent perahu solver error seen once under heavy CPU load (not reproduced in 3 reruns).

## 2026-10-07: First playable version (Kampung Sains)

- Brainstorm by four specialist agents (math didactics, IPAS/physics, game design, art direction), synthesized into `docs/DESIGN.md` and `docs/GAMES.md`.
- Shared runtime `shared/core.js` / `core.css`, SVG asset library `shared/art.js` with mascot Si Cil (kancil), asset gallery `assets.html`.
- Six games built by one agent each: Timbangan Pasar (12 levels), Angkot Penuh!, Lompat Katak, Ketapel Mangga, Rakit Terapung, Bagi Martabak (10 levels each). All 62 levels verified to reach the win screen without console errors.
- Phone fixes: compact caption and side-by-side win card under 500px height; hidden caption no longer swallows taps; math symbols spoken as words (`GS.speakable`).
- Deployed by the owner to Vercel.
