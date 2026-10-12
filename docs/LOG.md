# Work log

Newest first. Every change adds an entry: date, what changed, why, and anything left open.

## 2026-10-12: Landing page, vertical map with game sheets, landscape only in games

Requested by the owner: (1) only the games turn sideways, (2) the map scrolls up and down and tapping a place first shows its explanation with "Main!" and an X to choose another game, (3) a landing page before the 3 questions, with a strong pitch for parents (math and physics as the base for AI and robotics, Mat Sains as learning through play), working on phones and tablets.
- `landing.html` (new, built by a design agent from the lead's brief and exact copy): hero with a live pan balance, verified quotes from Elon Musk (World Government Summit, Dubai, 2017) and Jensen Huang (Beijing, 2025, reported by CNBC), each with its English original and a source link, plus a no-affiliation note; four looping demos of the real mechanics (balance, frog hops 3 x 4, martabak fractions, true parabolas at g = 9.8), the other six games, five design principles, final CTA. No statistics, testimonials or FAQ (none exist yet). `shared/auth.js` sends a first visit (no session, no device profile) to `landing.html`; returning devices still go to `welcome.html`. `welcome.html?masuk=1` opens the Masuk tab; choosing Daftar there starts the 3 questions (a new account needs a kelas).
- Quote check: neither person said "children need math and physics for AI and superintelligence". Musk said physics is the best analytical framework; Huang said he would probably choose the physical sciences over software. The page quotes them exactly and states the AI link in our own words. Musk has also said most people do not need advanced math (WGS 2023), so the page does not claim he endorses math.
- Hub (`index.html`): vertical route laid out per screen (zigzag on phones, snake rows of 3 to 5 on wide screens), curriculum order top to bottom, river with a bridge above Rakit Terapung, scenery placed only in free space (`GS.art.decor`, new). Tapping a place opens a sheet (art, kind, what this kelas learns, progress, "Main!", X / backdrop / Escape closes); the parent guide cards are gone from below the map (their text lives in the sheets). Level-up banner moved to the top.
- Orientation: manifest `orientation: any`; `GS.orient()` locks landscape on game pages and portrait on phones elsewhere where a lock is allowed; the game start gate still enters fullscreen and locks landscape in a browser tab; iPhone keeps the "turn your phone" screen.
- Bug fixed: on a first visit the service worker's first takeover reloaded the page about a second after it opened (lost scroll on the landing page, could wipe a typed name). Now only a real update reloads.
- Tests: `tests/journey.js` now goes landing, onboarding, login, hub, sheet, Main!, gate (ok on phone portrait, phone landscape, tablet); `tests/hub-tiers.js` checks the sheet at four sizes; `tests/hub-hover.js` scrolls each landmark into view; `tests/smoke.js` includes landing.html (repo and dist).
- Open: "Gratis selama masa uji coba. Tanpa iklan." must change if pricing or ads are introduced; the landing page has no real testimonials or results yet (add them only after the playtest); Google can index the landing page only through the JS redirect from `/` (fine for Google, weaker for other search engines).

## 2026-10-11: Worked examples ("Contoh") in every level

Requested by the owner before testing with children: every game in every kelas shows an example first, skippable; an SOP for future games and levels.
- Engine `GS.demo` in `shared/core.js` + styles in `core.css`: a ghost hand plays the example through the game's REAL input handlers (synthetic pointer events; moves follow the pressed element, falling back to the `[data-gs-drag]` holder if the game redraws it), real touches are blocked except "Lewati", `run.win()` only marks the example solved (no stars). Auto-plays the first time a level type (`key`) is met per kelas, after the "Main!" gate (shown even in the installed app when audio is still locked); HUD hand button replays; `run.offerDemo()` pulses it after two misses. On phones the bar is compact (hand icon + Lewati, top-right).
- SOP `docs/CONTOH.md` (different numbers than the child's task, real mechanics, think aloud, one round, 10-25 s, never affects stars) and test `tests/demos.js` (every level has an example that reaches success, auto-plays once, skips cleanly).
- Piloted in Lompat Katak, then one agent per game added examples to all 380 levels; each game passed `demos.js` and `levels.js` on all five tiers. Timbangan's seesaw "jarak" result line no longer always says "Kiri turun".
- Known: some examples run longer than 25 s because the game's own physics/reveal animations were kept at real speed (Rakit 26-31 s, Warung Kembalian up to 43 s in k2 L1/L7 and k4 L2/L5/L6, Wayang up to ~27 s). Lewati is always available.
- Decision: auto-play once per level type, not every time (repeated auto-play teaches children to tap Lewati blindly); one-line change in `GS.runner` if the owner wants otherwise.

## 2026-10-10: Wave 2, four new games (10 in total)

Requested by the owner: more game variety that follows the curriculum; ideas proposed first, owner approved ideas 1, 2, 6, 9 (Warung Kembalian, Jam Kampung, Kebun Bibit, Wayang Bayangan); Tenun Motif and Pancing Magnet postponed. Ideas not yet chosen: Jembatan Bambu (length), Tuang Sirup (volume), Ubin Rumah Joglo (shapes), Panen Grafik (data), Lintasan Kelereng (slopes, friction).
- Spec per tier in `docs/KURIKULUM.md` ("Gelombang 2"); per-tier descriptions in `shared/curriculum.js`. Chosen to cover the elements the first six games never touched: measurement (money, time), arrays/area/perimeter, IPAS light.
- Built by one specialist agent per game, 38 levels each (152 new, 380 in total). Results: `tests/levels.js` ok on all five tiers for each; `tests/visual-qc.js` 0 of 76 level views fail for each (kembalian 9 -> 0 during the build).
- Hub map re-laid out for ten places (three rows, landmarks at 0.86 scale, whole kampung visible on tablet/desktop, phones scroll sideways); four new landmarks in `shared/art.js` (`bibit`, `kelontong`, `posronda`, `panggung`); `tests/hub-hover.js` now expects one landmark per game.
- Core: `GS.tween` clamps progress at 0 (the first rAF timestamp can precede the start time; a negative SVG height logged an error in wayang).
- Decisions: wayang measuring levels use 1 m = 220 u so puppets are 40–60 cm (20 cm would be too small to drag on a phone); jam snaps the hand only to the tier grid (hour / 30 / 5 / 1 min), never to the answer; kembalian "fewest pieces" levels cap stars at 2 when not minimal.
- Open: captions on phones cover up to about x < 600, y < 130 (larger than the 380 × 130 the QC doc assumes); the speakable workarounds above could move into `core.js`; new narrator lines are not yet in `docs/NARASI.md` (run `node tests/collect-lines.js`).

## 2026-10-08 (evening): Visual size QC

Owner reported from a phone: Timbangan weights unreadable and the left side of the game not filling the screen; suspected the same in other games.
- Root causes: the fixed 1280×800 canvas was letterboxed on ~2.2:1 phones and shown at scale ~0.47; asset sizes had never been measured at phone scale. Baseline measurement for Timbangan Kelas 4+: 16/16 level views FAIL (weight numerals 3.5–7 px, drag targets 34–37 px).
- Core: stage viewBox widens to the screen, scenery extends past the edges, HUD becomes a left rail on phone landscape (+20% canvas scale), drag targets are tagged for measurement.
- New SOP `docs/QC-VISUAL.md` and tool `tests/visual-qc.js` (0 FAIL required).
- Per-game results of `tests/visual-qc.js` (level views failing, before -> after, 76 views per game = 38 levels x 2 phones): Timbangan 66 -> 0, Angkot 75 -> 0, Katak 76 -> 0, Ketapel 76 -> 0, Rakit 76 -> 0, Martabak 76 -> 0. Remaining warns are numbers at 17-19.8 px (above the 16 px minimum) where spacing does not allow more.
- Bagi Martabak cutting redesigned after owner feedback ("cara motongnya aneh, 3/4 tidak bisa"): Fruit Ninja style swipe with a trail; on round food a swipe near the centre is a diameter cut and a swipe from the centre to the rim is a radial (wedge) cut, so thirds, sixths and 3/4 are possible; generous snapping for phones (60 u, 80 u in TK/k1, angles to 15 deg); rim guide ticks fade by tier; off-centre swipes do not use a knife; knives = needed + 2 and Ulang pulses when they run out.
- Known: on phones the Si Cil caption briefly covers the top-left (e.g. the leftmost order card in Martabak) until it hides.

## 2026-10-08 (later): Games and difficulty per kelas

Requested by the owner: games, variations and difficulty must follow the selected kelas, with the option to switch or move up.
- `docs/KURIKULUM.md` + `shared/curriculum.js`: five tiers (TK, Kelas 1, 2, 3, 4+) mapped to Kurikulum Merdeka phases; TK 6 levels, others 8; per-tier descriptions for the hub.
- All six games rebuilt per tier by their original builder agents (Timbangan, Angkot, Katak, Ketapel, Rakit, Martabak): 38 levels each, 228 in total, with new mechanics for TK (dots, no reading, looser tolerance) and Kelas 4+ (equations with boxes, kg/g, thousands, rounding, fractions on the number line, equivalent fractions, salt water, angle/pull-squared range). All tiers pass `tests/levels.js`.
- Stars stored per tier; hub map + parent guide follow the tier; profile editor (name, kelas, avatar); level-up banner.
- Bugs fixed: level picker close button clipped (now inside the card); hub map left empty strips on wide phones (viewBox now widens to the screen, scenery extends past the edges); caption bubble covered play areas on short landscape phones (moved to top-left there); hub subtitle overlapped landmarks on short screens.
- Rate limits interrupted the agents several times (including the weekly limit); work resumed from the saved state each time.

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
