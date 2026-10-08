# Work log

Newest first. Every change adds an entry: date, what changed, why, and anything left open.

## 2026-10-08: Mat Sains, PWA, onboarding, bug fixes (in progress)

Requested by the owner after testing on a real Android phone via Vercel (game-science-seven.vercel.app).
- Renamed the product to **Mat Sains**.
- PWA: `manifest.webmanifest`, `sw.js` (precache + offline, versioned per deploy), `shared/pwa.js` (install button, iOS how-to sheet), icons rendered from Si Cil.
- Vercel: `vercel.json` + `scripts/build.sh` build `dist/` with public files only, so `assets.html`, `docs/` and templates are not served.
- Narrator: `shared/voice.js` (recorded clips first, tuned TTS fallback). No child voice is possible with browser TTS; real recordings are needed (see `docs/NARASI.md`).
- Project memory: `CLAUDE.md`, `AGENTS.md`, this log.
- Pending in this round: hub icon cropping, hiding the gallery link, the Timbangan "scale flies away" bug, fullscreen start gate for games, onboarding + login (`welcome.html`, `shared/auth.js`).

## 2026-10-07: First playable version (Kampung Sains)

- Brainstorm by four specialist agents (math didactics, IPAS/physics, game design, art direction), synthesized into `docs/DESIGN.md` and `docs/GAMES.md`.
- Shared runtime `shared/core.js` / `core.css`, SVG asset library `shared/art.js` with mascot Si Cil (kancil), asset gallery `assets.html`.
- Six games built by one agent each: Timbangan Pasar (12 levels), Angkot Penuh!, Lompat Katak, Ketapel Mangga, Rakit Terapung, Bagi Martabak (10 levels each). All 62 levels verified to reach the win screen without console errors.
- Phone fixes: compact caption and side-by-side win card under 500px height; hidden caption no longer swallows taps; math symbols spoken as words (`GS.speakable`).
- Deployed by the owner to Vercel.
