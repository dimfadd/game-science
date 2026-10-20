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
- Installable **PWA** (`manifest.webmanifest`, `sw.js`, `shared/pwa.js`). Display `fullscreen`, manifest orientation `any`: **only games play sideways**. `GS.orient()` (core.js) locks landscape on game pages and portrait on phones elsewhere, where the browser allows a lock (installed app or fullscreen); in a browser tab the game's start gate enters fullscreen and locks landscape; on iPhone (no lock API) games show the "turn your phone" screen.
- No backend or database yet. Accounts are client-side only (see Auth).

## File map

```
landing.html            Landing page for first-time visitors (search/ads): why math + physics, the games, CTA to welcome.html
index.html              Hub: map home screen (vertical route, 10 landmarks, a sheet per game) + screens Balapan (race + Papan Juara), Orang Tua, Pengaturan; floating top bar + dock
cerita.html             Petualangan (story mode): chapter route, comic panels, badge; Bab 1 "Festival Kampung"
welcome.html            Onboarding (3 quick questions) then register/login
assets.html             Internal asset gallery (NOT deployed, not linked)
manifest.webmanifest    PWA manifest
sw.js                   Service worker (precache + offline; VERSION replaced at build)
vercel.json             Vercel build/output/headers
scripts/build.sh        Builds dist/ for Vercel
icons/                  PWA icons rendered from the Chuppy mascot (cheer mood on the sky)
audio/voice/            Recorded narrator clips + manifest.json (empty until recorded)
shared/core.js          window.GS runtime (see API below)
shared/core.css         Design tokens, HUD, buttons, overlays, start gate
shared/art.js           window.GS.art SVG library (mascot, items, people, scenes, landmarks)
shared/auth.js          window.MS.auth: session, guard, characters (AVATARS, charOf, defaultName, GS.mascotChar), updateProfile
shared/curriculum.js    window.MS.kur + GS.tier(): grade tiers and per-tier game texts/level counts
shared/profile.js       window.MS.profileEditor: change name, kelas and avatar (hub)
shared/config.js        window.MS.config: GOOGLE_CLIENT_ID, SUPABASE_URL + SUPABASE_ANON_KEY (online race rooms), voice settings
shared/pwa.js           window.MS.pwa: SW registration, install button ([data-pwa-install])
shared/voice.js         Narrator: recorded clips first, tuned TTS fallback (GS.speakImpl)
shared/race.js          Balapan: race inside any game (?race=bot|host|join); loaded on every game page, inert without ?race
shared/cerita.js        window.MS.cerita: chapter data (cast, panels, steps with a level per kelas) + the game-side story hook (?story=, inert without it)
shared/net.js           window.MS.net: realtime race rooms (Supabase Realtime when configured; BroadcastChannel ?net=bc for tests)
games/<id>/index.html   One folder per game: timbangan, angkot, katak, ketapel, perahu, martabak, bibit, kembalian, jam, wayang
games/<id>/game.js
games/_template/        Starting point for a new game
docs/DESIGN.md          Design bible: pedagogy, visual style, palette, fonts, motion, physics rules
docs/KURIKULUM.md       Level list of every game PER GRADE TIER (the current spec)
docs/GAMES.md           Original single-tier spec (historical; superseded by KURIKULUM.md)
docs/NARASI.md          Narrator line list + recording guide
docs/QC-VISUAL.md       SOP: minimum text/number/target sizes and the visual QC procedure (MANDATORY)
docs/CONTOH.md          SOP: worked examples ("Contoh") for every level type (MANDATORY)
docs/LOG.md             Chronological work log (append an entry for every change)
docs/sprites/           PNG sprite sheets of every character x mood (design/ads only, the game draws SVG; NOT deployed)
tests/                  Playwright smoke + full-level tests (see Testing)
```

## Grade tiers (kelas)

Every game has five tiers: `tk`, `k1`, `k2`, `k3`, `k4` (Kelas 4+), following Kurikulum Merdeka phases (Fondasi, A, B). **TK = 6 levels, every other tier = 8 levels.** The level lists are in `docs/KURIKULUM.md`.
- The tier comes from the child's kelas (session/profile), overridable with `?tier=k3` in the URL. `GS.tier()` / `MS.kur` live in `shared/curriculum.js`, which also holds the per-tier descriptions shown on the hub map and parent guide.
- Each game builds its level list from `GS.tier()`; `window.__game.count()` must equal `MS.kur.levels(tier)`.
- Stars are stored per game per tier (`stars.<game>@<tier>`; `GS.store` adds the suffix automatically).
- Hub: the profile pill in the top bar and "Ubah profil" in Orang Tua / Pengaturan open `MS.profileEditor` (name, kelas, character). When every level of the current tier has a star, a banner offers the next tier (top of the map).
- TK tier: no reading required (numbers always with dots/objects), bigger targets, looser tolerances.

## Characters (the child's mascot)

The child picks one of 7 characters in onboarding; it is their profile picture AND the mascot that plays with them everywhere (welcome host after the pick, hub map, start gate, caption face, win card). Ids (kept from the old avatar list so profiles survive): `chuppy` Chuppy (robot, default), `p0` Budi, `p1` Siti, `p3` Ani, `p7` Raka, `kucing` Mimi, `katak` Kiko (`MS.auth.AVATARS`, `charOf`, `defaultName`). The nickname the child types is the character's name; empty (or the old placeholder "Teman") means the character's own name. `GS.mascotChar()` (set by auth.js) returns the player's character, so `GS.art.mascot({mood, size})` without `char` draws it. `GS.art.mascot({mood, size, char, name})`, `GS.art.mascotHead(char, size, mood)`, `GS.art.CHARS`, `GS.art.mascotName(char)`; same 7 moods for all (idle, happy, cheer, think, surprise, oops, point) and the same motion hooks (puff, blink, wave on happy, hop on cheer, waddle with class `walk`, cat tail sway). PNG sprite sheets for design use in `docs/sprites/`.

Chuppy (since 2026-10-13, replaced Si Cil the kancil) is a chubby soft robot shaped like a bakpao: head and body one round shape, a dark face screen with cyan LED eyes and mouth, teal headphone pods, an antenna with a glowing bulb, a chest light, teal boots. Inspired by the gentle, slow, inflatable feel of big friendly film robots but deliberately different (no two-dots-and-line face, no small head on a big body, colour accents, own name); never add traits of a copyrighted character. Speech says "Cupi" (`GS.speakable`). Details in `docs/DESIGN.md`.

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

**Hub map** (`index.html`, 2026-10-12): one tall route that scrolls DOWN, laid out in script for the screen: s = px per map unit = min(W/620, H/470, 1.15); two lanes zigzag on narrow screens, snake rows of 3 to 5 places on wide ones; the route follows the curriculum order (`MS.kur.GAMES`), a river with a bridge runs above Rakit Terapung, scenery (`GS.art.decor`) is placed only where no place, sign or path is. Tapping a place does NOT open the game: Chuppy waddles there (mirrored so he points at the place), says its line and a sheet opens (landmark art, Matematika/Fisika badge, what this kelas learns, progress, big "Main!", X top-right; also closes on the backdrop and Escape). Bottom sheet on portrait phones, centred card elsewhere, art beside the text on short landscape screens.

**Hub dashboard** (2026-10-13, screens 2026-10-14): the map is the home screen; the other menus are screens of their own, hash routes `#balapan` (alias `#juara`), `#orang-tua`, `#pengaturan` (the back button works; the map keeps its scroll). Floating top bar on the map only: profile pill (`#profile`: the character's head, name, kelas; opens `MS.profileEditor`) and one stats pill with all stars of this kelas (`#starBtn`, tap speaks the count) and this week's stars (`#weekBtn`, trophy, opens Balapan). Floating dock on every screen: Peta (on the map: scroll back to the mascot's place), Cerita (a link to `cerita.html`), Balapan, Orang Tua, Pengaturan (labelled "Atur" when the dock is narrow, width <= 460 or the rail, because five items do not fit "Pengaturan"); a left rail on short landscape phones (height <= 520), the map laid out in the width right of it.
- **Balapan** (`#balapan`, element ids still `scr-juara`/`navJuara`): pick one of the 10 games, then Lawan bot / Buat ruang (privat or publik) / Gabung pakai kode; live list of public rooms; last result, then **Papan Juara**: the child's own week (stars and levels this week from `GS.activity`) and an empty podium "Segera hadir". No other players are shown or invented until a server exists; rules: weekly reset on Monday, each level counts once with its best stars, stars come from accuracy not speed. Planned: only nickname + character shown, parental consent (UU PDP).
- **Orang Tua**: child card, progress per kelas (switchable), tiles (stars, levels, games tried, days played in the last 7), a 7-day bar chart of levels won (tap a bar for the day), per game a strip of level cells with the star count written in them, last played date, "Perlu latihan" (levels with 1 star), then how Mat Sains teaches (the old guide text). The daily log only starts with this version; older stars still count.
- **Pengaturan**: three switches (Efek suara, Musik latar, Narator; `GS.audio`), a banner when the master mute is on, profile, install card, account: "Keluar dari akun" (two taps) and "Hapus progres" (in-page confirmation). These two are not on the map any more.

**Balapan (race mode, 2026-10-15)**: races are played INSIDE the real games (`shared/race.js`, loaded on every game page before game.js, inert without `?race`). The child picks a game on the hub's Balapan screen; `games/<id>/index.html?race=bot` (against 3 bots), `?race=host&room=CODE[&pub=1]` or `?race=join&room=CODE` (a guest who opened another game or kelas is moved to the host's game and `?tier=`). Every racer plays the SAME 5 rounds: levels of the kelas picked with the race seed, easiest first. race.js replaces `GS.runner` (the game's level wins come back as round results) and, while a round is on, `Math.random` is a PRNG seeded with (seed, game, round), so the level builds the same numbers on every device; a retry rebuilds the same content. Effects use `GS.fxRandom` (the real one; core.js noise, music jitter, confetti) so they never shift that stream. Steps = the game's own stars for the round (3 / 2 / 1); "Ganti soal" (a HUD button after 25 s, two taps) changes the round with 0 steps. Finish = 15 steps: the farthest racer wins, an earlier finish breaks a tie. During a round only the HUD shows the race ("2/5" + a cup with the place); between rounds a race view shows all lanes. Level picker and examples are off; race rounds do not change level stars or the play log; results go to store key `race.log` (last 20, with the game). Bots: 3 profiles (3-star chance 0.5 to 0.74, time per round from a per-game base x kelas factor x 0.95 to 1.25) with mild rubber-banding; always labelled BOT; online the host runs them and empty seats become bots at the start. Rooms (`shared/net.js`): presence + broadcast only, nothing stored; messages `start {cfg: game, tier, seed, plan, players}`, `p {id, dist, qi, done, ms}`, `again`; public rooms announce `{code, game, gameName, tier, label, n, max, open}` on a lobby channel and show only character names. Race limit 10 minutes. Online needs `SUPABASE_URL` + `SUPABASE_ANON_KEY` in `shared/config.js` (the client library loads from jsdelivr only then); without them the room buttons explain that online is off. Debug hook `window.__race = { state, round, plan, seed, players, me, skip, finishBots, start, max }`.

**Petualangan (story mode, 2026-10-20)**: `cerita.html` + `shared/cerita.js`. A chapter is an opening comic, a route of stops, a closing comic and a badge. Each stop is a villager who needs help (1 to 2 comic panels: art from `GS.art` scene + landmark + `GS.art.person` + the child's mascot, a speech box with the speaker's head and name, narrated with `GS.say`, "Lanjut", back, "Lewati"); the last panel's "Ayo bantu!" opens ONE real level of a game: `games/<id>/index.html?story=<chapter>&step=<n>`. The obstacle IS the game mechanic (no quiz gate, no lives, no timers: same pedagogy as the games). In the game `shared/cerita.js` wraps `GS.runner`: plays the step's level for the kelas (`step.lv[tier]`), worked examples work as usual, the level picker is hidden, the HUD shows "2/6", Home goes to the chapter, and a win shows an outcome card (the world's reaction + stars, "Main lagi" / "Lanjut petualangan"). A story win is a real level win (level stars + play log) and saves store key `cerita.<chapter>` = `{done, stars, opened, closed}`. Back on the route (`cerita.html?bab=<id>&dari=<n>`) the mascot walks on and the next villager asks right away; locked stops only speak a hint; solved stops can be replayed. Placeholder `{nama}` = the nickname. Comic panels keep their shape (no crop): a 1280x720 composition, a 640x720 one on tall screens. **Bab 1 "Festival Kampung"** (6 stops): Terminal (angkot, Pak Sopir), Pasar (timbangan, Bu Sari), Kebun (ketapel, Pak Tani), Sungai (perahu, Kak Dodi), Pos Ronda (jam, Pak RT), Panggung at night (wayang, Kak Rina); badge "Penolong Festival"; "Bab 2 segera hadir". The owner plays Bab 1 first and decides whether more chapters follow. Debug hook `window.__cerita = { chapter, next, progress, comic, tier }`. Planned (not built): later chapters, free vs paid chapters once a backend and accounts exist.

Every game exposes a debug hook `window.__game = { go(i), solve(), ... }`. `solve()` completes the **current round**; multi-round levels need repeated calls. Angkot also has `speed(n)` to speed up animations in tests.

## GS runtime (shared/core.js)

`GS.store` (localStorage with memory fallback; key `kampung-sains.v1`, kept for progress compatibility) · **sound channels** `GS.audio = { get(ch), set(ch, on), effective(ch), CHANNELS }` for `sfx`, `music`, `voice` (store keys `snd.<ch>`, default on; event `gs:audio`), under the master `GS.muted` (HUD speaker button, `[data-gs-sound]`; `setMuted` fires `gs:audio` with ch `master`); sfx gated in `GS.tone/noise`, narration gated in the `GS.speakImpl` wrapper (captions always show) · **backsound** `GS.music = { start, stop, playing, duck }`: synthesized C pentatonic loop, 88 BPM, 16 bars A A' B A, plucks with an octave partial, gain 0.24 (peak about 0.22, RMS -32 dBFS; 0.045 was inaudible on phones), starts after the first real tap (games: after "Main!"), pauses when hidden, ducks to 25% under the narrator, silent under autotest unless `?music=1`, never auto-starts on `<body data-no-music>` (landing.html) · **play log** `GS.activity = { log(), days(n), weekStars(), weekLevels(), weekStart() }`: every real level win (not examples) appends `{d, ts, g, t, l, s}` to the raw store key `log` (cap 600); week = Monday 00:00 local, each (game, tier, level) counts once with its best stars · `GS.sfx.*` · `GS.say(text)` (caption + speech; speech is queued until the first tap, then goes through `GS.speakImpl`/`GS.stopSpeech`, replaced by `shared/voice.js`) · `GS.fx(el, cls)` (plays a shared animation class on an untransformed inner group, see the SVG rule below) · `GS.fs` (fullscreen helpers) · start gate: pages with `body.gs-game` show a "Main!" overlay that unlocks audio, requests fullscreen + landscape lock on touch devices and then speaks the first instruction (skipped when installed as an app, with `?autotest`, or under `navigator.webdriver`) · `GS.speakable(text)` (math symbols to words; `jam` wraps it locally for "07.25" and "km", `kembalian` speaks money as words via a local caption wrapper, and `bibit` speaks ":" as "dibagi" in its own lines) · `GS.tween/ease/wait` · `GS.el/markup/svgPoint/drag` · `GS.confetti/floatText` · `GS.hud({...})` · `GS.runner({gameId,count,hud,start})` → `go(i)/next()/win(stars,text)` · `GS.celebrate` · `GS.levelPicker`.

**Worked examples ("Contoh", `GS.demo`, SOP `docs/CONTOH.md`)**: every level has an example a ghost hand plays through the game's REAL input handlers (synthetic pointer events), with different numbers than the child's task. `GS.runner({ demo: i => ({ key, auto, build, script }) })`; auto-plays the first time a `key` is met per kelas (after the "Main!" gate, which is shown even in the installed app when audio is not unlocked yet), the HUD hand button replays, `run.offerDemo()` pulses it after two misses. During an example real input is blocked except "Lewati", and `run.win()` only marks it solved (no stars). `?nodemo` disables auto-play; under `?autotest` it is off unless `?demotest`. `tests/demos.js` checks every level.

**Stage fitting**: games draw in a fixed 1280×800 canvas; `GS.fitStage` widens the viewBox to fill wide screens (`GS.stageView = {x0, x1, scale}`, event `gs:stage`). Scenery from `GS.art.scene` extends 60% past each edge; game-drawn floors must span x −600..1880. On short landscape screens the HUD is a left rail so the canvas gets the full height. Small phones show the canvas at **scale ≈ 0.45**, so sizes follow `docs/QC-VISUAL.md` (numbers ≥ 36 u, text ≥ 30 u, targets ≥ 90 u; SVG tap targets carry `data-hit`).

**SVG animation rule** (caused the "scale flies away" bug, 2026-10-08): never put CSS `transform` (rules, `:hover`/`:active`, keyframes) on an SVG element that is positioned with a `transform` attribute. The CSS replaces the attribute and the element jumps to the origin. Position with an outer `<g transform=...>` and animate an inner `<g>` (use `GS.fx`). `tests/hub-hover.js` guards the hub map.

## Auth (development only)

- Flow: first visit on a device (no session, no profile) lands on `landing.html` (copy for parents, verified quotes from Elon Musk and Jensen Huang with sources and a no-affiliation note, CTA "Mulai main bersama Chuppy"); then `welcome.html` asks 3 questions (character first, Chuppy hosts; then the nickname with the character's name as default; then kelas), then login/register (`welcome.html?masuk=1` opens the Masuk tab; Daftar there starts the questions). Landing copy rules: no statistics, testimonials or FAQ until real ones exist, quotes only verbatim with source, and "Gratis selama masa uji coba. Tanpa iklan." must change if pricing or ads arrive.
- Hard-coded dev account for everyone: **test@matsains.id / test**.
- Registered accounts live in this device's localStorage only (password stored as SHA-256 hash). Not secure, not synced: fine for the trial phase only.
- Google login uses Google Identity Services and activates when `GOOGLE_CLIENT_ID` is set in `shared/config.js` (create an OAuth Web client ID in Google Cloud Console, add the Vercel domain as an authorized JavaScript origin). The ID token is decoded client-side without verification: development only.
- Pages are guarded by `shared/auth.js` (without a session: to `landing.html` on a device with no profile yet, else to `welcome.html`; skipped for `?autotest` and `navigator.webdriver`).
- Before commercial launch: real backend, server-side token verification, parental consent and data handling under Indonesia's UU PDP (personal data of children).

## Narration

- `shared/voice.js` plays recorded clips listed in `audio/voice/manifest.json` sentence by sentence, else device TTS with pitch 1.4 to sound younger.
- A natural child voice requires **real recordings** (a child voice actor with parental consent) or a paid neural TTS with a child voice. Browser TTS has no child voices.
- `docs/NARASI.md` lists the lines to record; `MS.voice.missing()` lists lines heard on a device that have no clip.

## Testing

- `tests/` holds Playwright scripts (uses `playwright-core`; Chromium path via `CHROMIUM` env or `/opt/pw-browsers/...`). Run `npm --prefix tests install` once, then:
  - `node tests/smoke.js`: every page loads without errors or horizontal overflow at 4 device sizes (`SITE_DIR=dist` to test the Vercel build).
  - `node tests/levels.js [gameId] [tier]`: solves every level of every tier and checks the level count (run one game per command; one game takes 3 to 8 minutes).
  - `node tests/hub-tiers.js`: signed-in hub at four sizes, top bar and dock on screen, profile editor, switching kelas, game sheet (opens on tap, fits, X closes), every dock screen opens and fits, back button, sound switches persist, account actions only in Pengaturan, level-up banner.
  - `node tests/journey.js [phoneLandscape|phonePortrait|tablet]`: new player end to end with the login guard on (landing, character, nickname default, kelas, dev login, hub shows the character, tap a landmark, sheet, Main!, start gate, the game mascot is the chosen character).
  - `node tests/hub-hover.js`: hub landmarks stay in place on hover/press.
  - `node tests/cerita.js`: Petualangan: every step has a level in every kelas, start card, opening comic, walk + villager request, locked stops, "Ayo bantu!" opens the game in story mode (the step's level, no picker, Home to the chapter), the outcome card saves chapter progress and level stars, the next villager asks on return, all 6 stops solved, closing comic and badge, and the comic + route fit at 4 sizes.
  - `node tests/race.js`: Balapan inside Lompat Katak (5 rounds, steps = stars, "Ganti soal" = 0, bots, ranked results, level stars untouched), the same seed builds the same round in all 10 games, a host + guest room over `?net=bc` (guest moved to the host's game and kelas, same content, live steps, bots fill seats, same results), and the hub game picker.
  - `node tests/visual-qc.js [gameId] [tier]`: measures every text, number and touch target in px on 740×360 and 844×390 phones; **must report 0 FAIL** (SOP in `docs/QC-VISUAL.md`).
  - `node tests/demos.js [gameId] [tier]`: plays every level's worked example through real input; each must reach success, auto-play once, and skip cleanly.
  - `node tests/collect-lines.js`: plays every level and rewrites the narrator line list in `docs/NARASI.md`.
- Always test phone landscape 844×390, phone portrait 412×915, tablet 1180×820 and desktop 1280×800, with `isMobile`/`hasTouch` for touch bugs.

## Conventions

- UI copy in simple, warm Bahasa Indonesia; **no em dash (—) in any visible text**.
- Style "Kampung Chunky" (outline `#3B2A20`, 3-tone fills, palette in `docs/DESIGN.md`), fonts Baloo 2 / Andika / Fredoka.
- Touch targets ≥ 64px (HUD ≥ 50px on small phones). No hover-only, double-tap or long-press-only actions.
- Commit messages explain why; update `CLAUDE.md` and `docs/LOG.md` with every change.
