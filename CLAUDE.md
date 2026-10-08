# Mat Sains: project memory

Read this first. It is the single source of truth for any person or AI picking up this project.
Keep it current: **every change that alters behavior, structure or decisions must update this file and add an entry to `docs/LOG.md`** in the same commit.

## What it is

Mat Sains (formerly "Kampung Sains") is a collection of HTML5 games that teach **math and intuitive physics to Indonesian children from TK to kelas 3 SD** (target ages 5–9), played mostly on Android phones, tablets and iPads. The owner is a non-developer; communicate in Bahasa Indonesia, plainly.

Core pedagogy (non-negotiable, details in `docs/DESIGN.md`):
- **No chocolate-covered broccoli.** The math/physics *is* the game mechanic. Never "answer a quiz to unlock play". Feedback comes from the game world (beam tilts, raft sinks), never a red "Salah!".
- **Concreteness fading**: objects → objects + numbers → number sentence → symbols only.
- **Predict → try → observe.** No lives, no timers, stars for accuracy (3 = first try, 2 = 1–2 retries, 1 = more).
- **Truthful physics** (fixed timestep, g = 9.8, size never encodes weight, no "helping" a wrong attempt succeed).

## Stack and constraints

- Vanilla HTML/CSS/JS, **no framework, no npm runtime deps**. All art is hand-made inline SVG (`shared/art.js`), all sfx synthesized with Web Audio, narration via recorded clips or Web Speech `id-ID`.
- Works from `file://` (open `index.html`) and from any static host.
- Deployed on **Vercel** from branch `claude/educational-game-math-physics-ep6s5i` (the repo's only and default branch). `vercel.json` runs `scripts/build.sh`, which copies only public files into `dist/` (the asset gallery `assets.html`, `docs/`, `games/_template/`, project notes are **not** deployed).
- Installable **PWA** (`manifest.webmanifest`, `sw.js`, `shared/pwa.js`). Display `fullscreen`, orientation `landscape`.
- No backend or database yet. Accounts are client-side only (see Auth).

## File map

```
index.html              Hub "Peta Kampung": illustrated map with 6 game landmarks + parent/teacher guide
welcome.html            Onboarding (3 quick questions) then register/login
assets.html             Internal asset gallery (NOT deployed, not linked)
manifest.webmanifest    PWA manifest
sw.js                   Service worker (precache + offline; VERSION replaced at build)
vercel.json             Vercel build/output/headers
scripts/build.sh        Builds dist/ for Vercel
icons/                  PWA icons rendered from the Si Cil mascot
audio/voice/            Recorded narrator clips + manifest.json (empty until recorded)
shared/core.js          window.GS runtime (see API below)
shared/core.css         Design tokens, HUD, buttons, overlays, start gate
shared/art.js           window.GS.art SVG library (mascot, items, people, scenes, landmarks)
shared/auth.js          window.MS.auth: session, guard, profile chip
shared/config.js        window.MS.config: GOOGLE_CLIENT_ID, voice settings
shared/pwa.js           window.MS.pwa: SW registration, install button ([data-pwa-install])
shared/voice.js         Narrator: recorded clips first, tuned TTS fallback (GS.speakImpl)
games/<id>/index.html   One folder per game: timbangan, angkot, katak, ketapel, perahu, martabak
games/<id>/game.js
games/_template/        Starting point for a new game
docs/DESIGN.md          Design bible: pedagogy, visual style, palette, fonts, motion, physics rules
docs/GAMES.md           Level-by-level spec of every game
docs/NARASI.md          Narrator line list + recording guide
docs/LOG.md             Chronological work log (append an entry for every change)
tests/                  Playwright smoke + full-level tests (see Testing)
```

## The games

| id | Name | Levels | Teaches |
|---|---|---|---|
| timbangan | Timbangan Pasar | 12 | =, <, >, number bonds, missing addend, subtraction, halves (pan balance locked by a peg, "Lepas!" releases); L10–12 seesaw torque (weight × distance) |
| angkot | Angkot Penuh! | 10 | Make-ten (angkot leaves only at exactly 10, seats are a ten-frame), tens and ones with angkot + becak |
| katak | Lompat Katak | 10 | Number line, hop size × hop count planned before jumping, skip counting, subtraction |
| ketapel | Ketapel Mangga | 10 | Pull → speed → distance, parabolic flight, mass and air drag, patok number line |
| perahu | Rakit Terapung | 10 | Float/sink by density, raft capacity (exact sums), hull shape capacity |
| martabak | Bagi Martabak | 10 | Equal parts, ½ ⅓ ¼ by cutting convex polygons, comparing unit fractions |

Every game exposes a debug hook `window.__game = { go(i), solve(), ... }`. `solve()` completes the **current round**; multi-round levels need repeated calls. Angkot also has `speed(n)` to speed up animations in tests.

## GS runtime (shared/core.js)

`GS.store` (localStorage with memory fallback; key `kampung-sains.v1`, kept for progress compatibility) · `GS.sfx.*` · `GS.say(text)` (caption + speech; speech output goes through `GS.speakImpl`, replaced by `shared/voice.js`) · `GS.speakable(text)` (math symbols to words) · `GS.tween/ease/wait` · `GS.el/markup/svgPoint/drag` · `GS.confetti/floatText` · `GS.hud({...})` · `GS.runner({gameId,count,hud,start})` → `go(i)/next()/win(stars,text)` · `GS.celebrate` · `GS.levelPicker`.

**SVG animation rule**: never put a CSS animation that sets `transform` on an SVG element that is positioned with a `transform` attribute (the CSS replaces the attribute and the element jumps to the origin). Use the individual `translate`/`rotate`/`scale` properties or animate an inner `<g>`.

## Auth (development only)

- Flow: `welcome.html` asks 3 questions (nickname, kelas, avatar), then login/register.
- Hard-coded dev account for everyone: **test@matsains.id / test**.
- Registered accounts live in this device's localStorage only (password stored as SHA-256 hash). Not secure, not synced: fine for the trial phase only.
- Google login uses Google Identity Services and activates when `GOOGLE_CLIENT_ID` is set in `shared/config.js` (create an OAuth Web client ID in Google Cloud Console, add the Vercel domain as an authorized JavaScript origin). The ID token is decoded client-side without verification: development only.
- Pages are guarded by `shared/auth.js` (redirects to `welcome.html` without a session; skipped for `?autotest` and `navigator.webdriver`).
- Before commercial launch: real backend, server-side token verification, parental consent and data handling under Indonesia's UU PDP (personal data of children).

## Narration

- `shared/voice.js` plays recorded clips listed in `audio/voice/manifest.json` sentence by sentence, else device TTS with pitch 1.4 to sound younger.
- A natural child voice requires **real recordings** (a child voice actor with parental consent) or a paid neural TTS with a child voice. Browser TTS has no child voices.
- `docs/NARASI.md` lists the lines to record; `MS.voice.missing()` lists lines heard on a device that have no clip.

## Testing

- `tests/` holds Playwright scripts (uses `playwright-core`; Chromium path via `CHROMIUM` env or `/opt/pw-browsers/...`). Run `npm --prefix tests install` once, then `node tests/smoke.js` (every page loads without errors over HTTP) and `node tests/levels.js [gameId]` (solves every level of every game).
- Always test phone landscape 844×390, phone portrait 412×915, tablet 1180×820 and desktop 1280×800, with `isMobile`/`hasTouch` for touch bugs.

## Conventions

- UI copy in simple, warm Bahasa Indonesia; **no em dash (—) in any visible text**.
- Style "Kampung Chunky" (outline `#3B2A20`, 3-tone fills, palette in `docs/DESIGN.md`), fonts Baloo 2 / Andika / Fredoka.
- Touch targets ≥ 64px (HUD ≥ 50px on small phones). No hover-only, double-tap or long-press-only actions.
- Commit messages explain why; update `CLAUDE.md` and `docs/LOG.md` with every change.
