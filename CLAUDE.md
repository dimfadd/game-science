# Mat Sains: project memory

Read this first. It is the single source of truth for any person or AI picking up this project.
Keep it current: **every change that alters behavior, structure or decisions must update this file and add an entry to `docs/LOG.md`** in the same commit.

## What it is

Mat Sains (formerly "Kampung Sains") is a collection of HTML5 games that teach **math and intuitive physics to Indonesian children from TK to kelas 4+ SD** (target ages 5–10), played mostly on Android phones, tablets and iPads. The owner is a non-developer; communicate in Bahasa Indonesia, plainly.

Core pedagogy (non-negotiable, details in `docs/DESIGN.md`):
- **No chocolate-covered broccoli.** The math/physics *is* the game mechanic. Never "answer a quiz to unlock play". Feedback comes from the game world (beam tilts, raft sinks), never a red "Salah!".
- **Concreteness fading**: objects → objects + numbers → number sentence → symbols only.
- **Predict → try → observe.** No lives, no timers, stars for accuracy (3 = first try, 2 = 1–2 retries, 1 = more).
- **Truthful physics** (fixed timestep, g = 9.8, size never encodes weight, no "helping" a wrong attempt succeed).

## Stack and constraints

- Vanilla HTML/CSS/JS, **no framework, no npm runtime deps**. All art is hand-made inline SVG (`shared/art.js`), all sfx synthesized with Web Audio, narration via recorded clips or Web Speech `id-ID`.
- Works from `file://` (open `index.html`) and from any static host.
- Deployed on **Vercel** (e.g. game-science-seven.vercel.app) from branch `claude/educational-game-math-physics-ep6s5i` (the repo's only and default branch). `vercel.json` runs `scripts/build.sh`, which copies only public files into `dist/` (the asset gallery `assets.html`, `docs/`, `games/_template/`, project notes are **not** deployed).
- Installable **PWA** (`manifest.webmanifest`, `sw.js`, `shared/pwa.js`). Display `fullscreen`, orientation `landscape`.
- No backend or database yet. Accounts are client-side only (see Auth).

## File map

```
index.html              Hub "Peta Kampung": illustrated map with 10 game landmarks + parent/teacher guide
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
shared/auth.js          window.MS.auth: session, guard, profile chip, updateProfile
shared/curriculum.js    window.MS.kur + GS.tier(): grade tiers and per-tier game texts/level counts
shared/profile.js       window.MS.profileEditor: change name, kelas and avatar (hub)
shared/config.js        window.MS.config: GOOGLE_CLIENT_ID, voice settings
shared/pwa.js           window.MS.pwa: SW registration, install button ([data-pwa-install])
shared/voice.js         Narrator: recorded clips first, tuned TTS fallback (GS.speakImpl)
games/<id>/index.html   One folder per game: timbangan, angkot, katak, ketapel, perahu, martabak, bibit, kembalian, jam, wayang
games/<id>/game.js
games/_template/        Starting point for a new game
docs/DESIGN.md          Design bible: pedagogy, visual style, palette, fonts, motion, physics rules
docs/KURIKULUM.md       Level list of every game PER GRADE TIER (the current spec)
docs/GAMES.md           Original single-tier spec (historical; superseded by KURIKULUM.md)
docs/NARASI.md          Narrator line list + recording guide
docs/QC-VISUAL.md       SOP: minimum text/number/target sizes and the visual QC procedure (MANDATORY)
docs/LOG.md             Chronological work log (append an entry for every change)
tests/                  Playwright smoke + full-level tests (see Testing)
```

## Grade tiers (kelas)

Every game has five tiers: `tk`, `k1`, `k2`, `k3`, `k4` (Kelas 4+), following Kurikulum Merdeka phases (Fondasi, A, B). **TK = 6 levels, every other tier = 8 levels.** The level lists are in `docs/KURIKULUM.md`.
- The tier comes from the child's kelas (session/profile), overridable with `?tier=k3` in the URL. `GS.tier()` / `MS.kur` live in `shared/curriculum.js`, which also holds the per-tier descriptions shown on the hub map and parent guide.
- Each game builds its level list from `GS.tier()`; `window.__game.count()` must equal `MS.kur.levels(tier)`.
- Stars are stored per game per tier (`stars.<game>@<tier>`; `GS.store` adds the suffix automatically).
- Hub: the "Kelas" button and the profile chip open `MS.profileEditor` (name, kelas, avatar). When every level of the current tier has a star, a banner offers the next tier.
- TK tier: no reading required (numbers always with dots/objects), bigger targets, looser tolerances.

## The games

| id | Name | Levels (per tier) | Teaches (across tiers) |
|---|---|---|---|
| timbangan | Timbangan Pasar | 6 / 8 | =, <, >, number bonds, missing addend, subtraction, halves (pan balance locked by a peg, "Lepas!" releases); L10–12 seesaw torque (weight × distance) |
| angkot | Angkot Penuh! | 6 / 8 | Make-ten (angkot leaves only at exactly 10, seats are a ten-frame), tens and ones with angkot + becak |
| katak | Lompat Katak | 6 / 8 | Number line, hop size × hop count planned before jumping, skip counting, subtraction |
| ketapel | Ketapel Mangga | 6 / 8 | Pull → speed → distance, parabolic flight, mass and air drag, patok number line |
| perahu | Rakit Terapung | 6 / 8 | Float/sink by density, raft capacity (exact sums), hull shape capacity |
| martabak | Bagi Martabak | 6 / 8 | Equal parts, ½ ⅓ ¼ by swipe-cutting (Fruit Ninja style; round food gets diameter and radial wedge cuts), comparing and adding fractions |
| bibit | Kebun Bibit | 6 / 8 | Arrays rows × columns (drag the field corner; basket must empty exactly), repeated addition, ×/÷, factors, distributive split, remainder, area, perimeter (fence), primes, LCM, area model 12 × 13, L-shapes |
| kembalian | Warung Kembalian | 6 / 8 | Rupiah: pay exact, give change (counting up), fewest pieces (DP-checked), several items, n × price, patungan, budgets, unit price, rounding |
| jam | Jam Kampung | 6 / 8 | Analog clock with geared hands (drag the minute hand, angle unwrapped), the kampung follows the time truthfully (sun elevation 90 − 15·|t − 12|, shadow H / tan e), o'clock to minutes, 24-hour, durations, schedules, WIB/WITA/WIT, sundial |
| wayang | Wayang Bayangan | 6 / 8 | Shadow play with a true point-light projection (shadow = size × screen distance ÷ lamp distance), materials (opaque/translucent/clear), penumbra from a big lamp, two/coloured lamps, light travels straight, mirrors (reflection), ratios, tree height from a shadow |

Wave 2 (bibit, kembalian, jam, wayang, 2026-10-10) covers the Kurikulum Merdeka elements the first six never touched: measurement (money, time), arrays/area/perimeter and IPAS light. Hub map landmarks: `bibit`, `kelontong`, `posronda`, `panggung` in `GS.art` LM.

Every game exposes a debug hook `window.__game = { go(i), solve(), ... }`. `solve()` completes the **current round**; multi-round levels need repeated calls. Angkot also has `speed(n)` to speed up animations in tests.

## GS runtime (shared/core.js)

`GS.store` (localStorage with memory fallback; key `kampung-sains.v1`, kept for progress compatibility) · `GS.sfx.*` · `GS.say(text)` (caption + speech; speech is queued until the first tap, then goes through `GS.speakImpl`/`GS.stopSpeech`, replaced by `shared/voice.js`) · `GS.fx(el, cls)` (plays a shared animation class on an untransformed inner group, see the SVG rule below) · `GS.fs` (fullscreen helpers) · start gate: pages with `body.gs-game` show a "Main!" overlay that unlocks audio, requests fullscreen + landscape lock on touch devices and then speaks the first instruction (skipped when installed as an app, with `?autotest`, or under `navigator.webdriver`) · `GS.speakable(text)` (math symbols to words; `jam` wraps it locally for "07.25" and "km", `kembalian` speaks money as words via a local caption wrapper, and `bibit` speaks ":" as "dibagi" in its own lines) · `GS.tween/ease/wait` · `GS.el/markup/svgPoint/drag` · `GS.confetti/floatText` · `GS.hud({...})` · `GS.runner({gameId,count,hud,start})` → `go(i)/next()/win(stars,text)` · `GS.celebrate` · `GS.levelPicker`.

**Stage fitting**: games draw in a fixed 1280×800 canvas; `GS.fitStage` widens the viewBox to fill wide screens (`GS.stageView = {x0, x1, scale}`, event `gs:stage`). Scenery from `GS.art.scene` extends 60% past each edge; game-drawn floors must span x −600..1880. On short landscape screens the HUD is a left rail so the canvas gets the full height. Small phones show the canvas at **scale ≈ 0.45**, so sizes follow `docs/QC-VISUAL.md` (numbers ≥ 36 u, text ≥ 30 u, targets ≥ 90 u; SVG tap targets carry `data-hit`).

**SVG animation rule** (caused the "scale flies away" bug, 2026-10-08): never put CSS `transform` (rules, `:hover`/`:active`, keyframes) on an SVG element that is positioned with a `transform` attribute. The CSS replaces the attribute and the element jumps to the origin. Position with an outer `<g transform=...>` and animate an inner `<g>` (use `GS.fx`). `tests/hub-hover.js` guards the hub map.

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

- `tests/` holds Playwright scripts (uses `playwright-core`; Chromium path via `CHROMIUM` env or `/opt/pw-browsers/...`). Run `npm --prefix tests install` once, then:
  - `node tests/smoke.js`: every page loads without errors or horizontal overflow at 4 device sizes (`SITE_DIR=dist` to test the Vercel build).
  - `node tests/levels.js [gameId] [tier]`: solves every level of every tier and checks the level count (run one game per command; one game takes 3 to 8 minutes).
  - `node tests/hub-tiers.js`: signed-in hub at four sizes, profile editor, switching kelas, level-up banner.
  - `node tests/journey.js [phoneLandscape|phonePortrait|tablet]`: new player end to end with the login guard on (onboarding, dev login, hub, tap a landmark, start gate).
  - `node tests/hub-hover.js`: hub landmarks stay in place on hover/press.
  - `node tests/visual-qc.js [gameId] [tier]`: measures every text, number and touch target in px on 740×360 and 844×390 phones; **must report 0 FAIL** (SOP in `docs/QC-VISUAL.md`).
  - `node tests/collect-lines.js`: plays every level and rewrites the narrator line list in `docs/NARASI.md`.
- Always test phone landscape 844×390, phone portrait 412×915, tablet 1180×820 and desktop 1280×800, with `isMobile`/`hasTouch` for touch bugs.

## Conventions

- UI copy in simple, warm Bahasa Indonesia; **no em dash (—) in any visible text**.
- Style "Kampung Chunky" (outline `#3B2A20`, 3-tone fills, palette in `docs/DESIGN.md`), fonts Baloo 2 / Andika / Fredoka.
- Touch targets ≥ 64px (HUD ≥ 50px on small phones). No hover-only, double-tap or long-press-only actions.
- Commit messages explain why; update `CLAUDE.md` and `docs/LOG.md` with every change.
