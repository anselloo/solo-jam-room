# SPEC.md — Solo Jam Room

## 1. Overview

**Solo Jam Room** is a browser-based collection of quick, interactive jam games for **one musician playing alone**. It takes the energy of a club jam night (random keys, chord changes thrown at you, trading solos, creative challenges) and puts it in a single player's practice room.

The site plays the role of the rest of the band: it picks keys and tempos, deals chord progressions, plays a synthesized backing band (drums, bass, chords) for you to jam over, trades phrases with you, and throws in creative constraints. You bring your instrument; the app brings everyone else.

### 1.1 Goals

- Get a solo player jamming within 30 seconds of opening the site.
- Make practising alone feel like playing with a band, through a built-in backing band.
- Work for a beginner strummer and a seasoned jazz player alike (difficulty settings everywhere).
- Keep controls usable while holding an instrument: big buttons, keyboard shortcuts, minimal taps.
- Run entirely client-side, offline-capable, with no accounts and no backend.
- Reward consistency with personal stats, streaks, and a Daily Jam challenge.

### 1.2 Non-goals (v1)

- No multiplayer, rosters, teams, or shared-device group play. Every game is designed for one player.
- No user accounts, login, or server-side storage.
- No microphone input, recording, or pitch/timing detection of the player's instrument.
- No reproduction of copyrighted songs, lyrics, or melodies. Any reference melodies must be public domain.
- No branding or naming of any real-world club, society, or venue anywhere in the code, copy, metadata, or commit messages.

---

## 2. User and context

There is one user: **the solo player**, practising at home, in a practice room, or in an empty rehearsal space. Variations of this user the design must serve:

| Variation | Need |
|---|---|
| **Beginner** | Low-pressure prompts, guitar/keys-friendly keys, simple chords, slow tempos. |
| **Experienced player** | Harder options (modes, odd meters, extended chords) so it stays challenging. |
| **Rhythm-section player** (drums, bass) | Backing that mutes their role so they can fill it; reliable click. |
| **Transposing-instrument player** (sax, trumpet, clarinet) | Chords shown in written pitch for their instrument. |
| **Short-on-time player** | Games that fit into 3–10 minutes. |

Typical setup: a laptop, tablet, or phone on a music stand, speakers or headphones, the player's hands mostly on their instrument.

---

## 3. Tech stack and constraints

- **Build:** Vite
- **Language:** TypeScript (strict mode)
- **UI:** React 18 with function components and hooks
- **Styling:** CSS Modules or plain CSS with custom properties (no heavy UI framework). Design tokens defined on `:root`.
- **Routing:** Hash-based routing (`#/roulette`, `#/trade-fours`, …) so the site works on static hosting without server rewrites.
- **Audio:** Native Web Audio API with a custom lookahead scheduler (no audio library required). Click, cues, and the backing band (drums, bass, chord pad) are synthesized in v1; sample-based sounds may come later.
- **State:** React state + a small context for the player profile and settings. Persist profile, settings, and stats to `localStorage`, wrapped in `try/catch`, with sensible defaults if storage is unavailable.
- **Testing:** Vitest for unit tests (especially music-theory and backing-pattern logic), Playwright for a small set of end-to-end smoke tests.
- **Linting/formatting:** ESLint + Prettier.
- **Hosting:** GitHub Pages via GitHub Actions (static `dist/` output).
- **Browser support:** Latest two versions of Chrome, Safari (including iOS), Firefox, and Edge.
- **Performance budget:** Initial JS bundle under 200 KB gzipped; Lighthouse performance and accessibility scores of 90+.
- **Offline:** A basic service worker (via `vite-plugin-pwa` or hand-rolled) so the site works with no signal, after first load.

---

## 4. Information architecture

```
#/                  Home: game grid, Daily Jam, quick-start
#/roulette          Jam Roulette
#/trade-fours       Trade Fours
#/progressions      Chord Progression Dealer
#/constraints       Constraint Cards
#/missing-member    Missing Member
#/hold-the-pulse    Hold the Pulse
#/genre-flip        Genre Flip
#/song-sprint       Song Sprint
#/daily             Daily Jam
#/profile           Your instruments, level, and stats
#/settings          Global settings
#/about             What this is + how to get the most out of it
```

### 4.1 Global UI

- **Header:** site name, back-to-home, Focus Mode toggle, mute toggle.
- **Transport dock** (collapsible, bottom of screen): BPM, time signature, start/stop, tap tempo, and a backing-band mixer (drums, bass, chords volume and mute). Games that need tempo or backing read from and write to this shared transport.
- **Focus Mode:** hides chrome and enlarges the current prompt, chords, and bar counter so they're readable from a music stand a metre or two away. Toggle with the `F` key or a button. Requests the Fullscreen API where supported.

### 4.2 Home page

- Hero with the site name and a single **"Start Jamming"** button that launches Jam Roulette with the player's default difficulty and starts the backing band after a count-in.
- **Daily Jam** card showing today's challenge and the current streak.
- Grid of game cards: icon, name, one-line description, duration estimate, difficulty tag.

### 4.3 First-run onboarding

On first visit, a short, skippable setup asks for:
- Main instrument (and optional others).
- Whether it's a transposing instrument (B♭, E♭, F) — pre-filled from instrument choice.
- Skill level (Beginner, Intermediate, Advanced), which sets the default difficulty across games.

Answers are saved to the profile and can be changed later.

---

## 5. Games

Each game has: a short description, settings, flow, controls, and acceptance criteria. All games are single-player and must work with mouse, touch, and keyboard. Every random result keeps a history (at least the last 10) with Re-roll and Back.

### 5.1 Jam Roulette (MVP)

**Pitch:** Spin the reels, and the backing band starts playing your jam.

**Reels:** Key, Mode/Scale, Tempo, Time Signature, Groove (genre feel), Wildcard.

**Settings:**
- Difficulty: Beginner (major/minor only, keys E, A, D, G, C, 4/4, 70–110 BPM), Intermediate (all keys, Dorian/Mixolydian, 3/4 and 6/8), Advanced (all modes, odd meters 5/4 and 7/8, 50–180 BPM). Defaults to the profile's level.
- Per-reel lock: lock any reel so it stays put on the next spin.
- Wildcard on/off (draws one card from the Constraint deck).
- Jam length: open-ended, or 2/3/5 minutes with an end cue.

**Flow:** Press Spin (or `Space`) → reels animate with staggered stops (~1.5 s total) → result card shows all values plus the scale's notes → "Play" sets the transport and starts the backing band (a simple progression in the chosen key and mode, groove matching the Groove reel) after a one-bar count-in → the player jams.

**Acceptance criteria:**
- Locked reels never change on spin.
- Difficulty limits are respected (unit-tested).
- The backing progression always fits the selected key and mode (unit-tested).
- Reduced-motion users get an instant reveal instead of the spin animation.

### 5.2 Trade Fours (MVP)

**Pitch:** Trade solos with the app. You play a phrase, the app answers, you answer back.

**Settings:** Phrase length (2, 4, or 8 bars), key and mode (or roll), tempo, groove, app phrase style (simple, bluesy, busy), number of rounds.

**Flow:**
- Backing band plays continuously.
- Large display alternates between **YOUR TURN** and **APP'S TURN**, with a bar/beat progress indicator.
- On the app's turn, it plays a short synthesized melodic phrase generated from the current scale (rhythm and contour from templates in `src/data/phrases.json`, notes realized in key at runtime).
- An audio cue and visual flash on the last bar before each switch.
- Optional "echo" variant: the app plays a phrase and the player tries to play it back by ear in the next bars (call-and-response ear training).
- Controls: Start/Pause, Skip turn, Extend (+ one phrase length), End.

**Acceptance criteria:**
- Turn changes land exactly on a downbeat, driven by the audio scheduler clock, not `setInterval`.
- Generated phrases use only notes from the current scale (tested), and difficulty controls range, rhythmic density, and phrase length.
- The app's phrase is clearly audible above the backing (backing ducks slightly during app turns).

### 5.3 Chord Progression Dealer (MVP)

**Pitch:** Deal a chord progression in any key, loop it with the backing band, and practise playing over the changes.

**Settings:**
- Key and mode (or "roll for me").
- Difficulty: Beginner (I–IV–V–vi family, triads), Intermediate (ii–V–I, borrowed chords, 7ths), Advanced (secondary dominants, tritone subs, extended chords, modal interchange).
- Length: 4 or 8 chords, or a 12-bar blues template.
- Display: chord names, Roman numerals, or both.
- Capo helper for guitarists (shows shapes relative to a capo position).
- Written-pitch display for B♭, E♭, and F instruments, set automatically from the profile.
- **Changes Challenge:** after N loops, the app re-deals one chord (or modulates up a step) without stopping, and the player has to adapt.

**Flow:** Deal → progression shown as chord cards, one per bar, with the current chord highlighted as the loop plays → Play loops the progression with the backing band → Re-deal individual chords or the whole progression.

**Music theory requirements:**
- Correct enharmonic spelling based on key (e.g. B♭ major in F, not A♯; F♯ in D major, not G♭).
- Diatonic chord qualities derived from the selected mode, not hard-coded per key.
- Progression templates stored as data in Roman numeral form and realized in the selected key at runtime.

**Acceptance criteria:**
- Unit tests cover chord spelling in all 12 major and 12 minor keys, plus Dorian and Mixolydian.
- Transposition for B♭, E♭, and F instruments is correct (tested).
- Highlighted chord matches the sounding chord, synced to the scheduler.

### 5.4 Constraint Cards (MVP)

**Pitch:** Draw a card that changes how you have to play. Use it on its own or on top of any other game.

**Deck categories:** Note limits ("Only three notes allowed"), Rhythm ("Only play on the off-beats"), Dynamics ("Start at a whisper and build over 8 bars"), Register ("Stay in the lowest octave you can play"), Technique ("No open strings" / "Only one hand" where sensible), Wild ("Play it like a lullaby").

**Settings:** Category filters, beginner-safe toggle (filters out cards marked hard), auto-draw every N bars while the backing band plays.

**Flow:** Tap the deck → card flips with an animation → Discard / Keep / Draw again. Kept cards stay pinned on screen while playing.

**Content:** At least 60 cards in v1, stored in `src/data/constraints.json` with fields `id`, `text`, `category`, `difficulty`, and an optional `instruments` array. Cards with `instruments` only appear if the player's profile includes one of them.

**Acceptance criteria:**
- No card repeats until the filtered deck is exhausted, then the deck reshuffles with a visible "Reshuffled!" notice.
- Instrument-specific cards never appear for players who don't play that instrument.
- Constraint Cards can be overlaid on Jam Roulette, Trade Fours, and Chord Progression Dealer.

### 5.5 Missing Member

**Pitch:** The band shows up one member short, and you're filling in.

**Flow:**
- The app picks a role to leave out of the backing band: drums, bass, chords, or lead melody (the app's melody line is only present when another role is missing).
- The backing band plays without that role, and a large banner tells the player what to cover ("No bassist tonight: you've got the low end").
- The player fills the role on their own instrument, however they interpret it (e.g. a guitarist covering bass plays root-note lines; a pianist covering drums plays rhythmic stabs).
- Each round lasts a set number of bars, then a new role goes missing.

**Settings:** Allowed roles (default from the profile: a drummer gets "drums" more often), round length, key/tempo/groove (or roll).

**Acceptance criteria:**
- The muted role is truly silent; the remaining parts still sound like a coherent band.
- Role changes happen on a downbeat with a one-bar warning.

### 5.6 Hold the Pulse

**Pitch:** The click drops out. Can you keep time on your own?

**Flow:**
- Metronome (and optionally the backing band) plays for N bars (default 4), then goes silent for M bars (default 8).
- During the silent section, the player keeps playing and taps a big button, a foot pedal mapped to a key, or `Space` on each beat.
- When the click returns, the app shows how far they drifted: average BPM during the silent section and a simple chart of tap timing vs. the true grid.
- Scoring: "Locked in" (within 2 BPM), "Pretty tight" (within 5), "Drifting" (within 10), "Off to the races" (beyond). Best score per tempo is saved to stats.

**Settings:** Tempo, bars on, bars off, rounds, difficulty preset (longer silences, faster or slower tempos).

**Acceptance criteria:**
- Tap timestamps use `AudioContext.currentTime` for accuracy, not `Date.now()`.
- Any single key can be mapped as the tap key (for USB/Bluetooth page-turner pedals that send key presses).

### 5.7 Genre Flip

**Pitch:** Take a familiar public-domain tune and play it in a totally different style.

**Content:** A list of public-domain melodies only (traditional folk songs, nursery rhymes, classical themes whose copyright has expired), stored in `src/data/tunes.json` with title, origin note, and suggested key. No lyrics or notation are reproduced beyond the title; the player plays from memory.

**Flow:** Draw a tune + draw a genre (reggae, punk, bossa nova, metal, lo-fi, funk, waltz, sea shanty, etc.) → the backing band starts a groove in that genre at a suggested tempo → 3-minute timer → next.

**Acceptance criteria:**
- Every tune in the data file has a `publicDomain: true` field and a source note; a unit test fails the build if any entry lacks it.
- Every genre in `genres.json` maps to a backing groove pattern.

### 5.8 Song Sprint

**Pitch:** A solo songwriting race: write a tiny song before the timer runs out.

**Flow:** Generate a prompt pack: a working title, a theme or image, a structure (e.g. Verse–Chorus–Verse–Chorus), a key and tempo, and one constraint card → countdown timer (default 15 minutes, options 5/10/15/20) with warnings at 5 minutes and 1 minute → "Pencils down" screen that prompts the player to play the song through once with the backing band and offers a short self-check (Did it have a hook? Did the chorus lift? Did you follow the constraint?).

**Content:** Title and theme word lists in `src/data/songPrompts.json`, original to this project. A plain notes box (saved locally) lets the player jot lyrics or chords during the sprint.

**Acceptance criteria:**
- Timer keeps correct time when the tab is backgrounded (based on timestamps, not tick counting).
- Prompt pack can be re-rolled one field at a time.
- Notes from past sprints are listed on the Profile page and can be deleted.

### 5.9 Daily Jam

**Pitch:** One fresh challenge a day, the same for everyone who opens the site that day.

**Flow:** Each day a seeded generator (seed = the local date) picks one game and a fixed set of its parameters (e.g. "Trade Fours in E♭ Mixolydian at 104 BPM, card: only play on the off-beats"). Completing it marks the day done and extends the streak.

**Acceptance criteria:**
- The same date always produces the same challenge (tested).
- Streak logic handles skipped days and time-zone edges correctly (tested).

---

## 6. Shared components and modules

| Module | Responsibility |
|---|---|
| `audio/engine.ts` | Single shared `AudioContext`, unlocked on first user gesture; master gain; mute. |
| `audio/scheduler.ts` | Lookahead scheduler (~25 ms timer, ~100 ms schedule-ahead window) emitting beat and bar events with precise audio times. |
| `audio/sounds.ts` | Synthesized click (accented downbeat), cue chimes. |
| `audio/band/` | Backing band: synthesized drum kit (kick, snare, hats), bass voice, chord pad, lead voice for app phrases; per-part gain and mute. |
| `audio/band/grooves.ts` | Groove patterns per genre and time signature (drum steps, bass rhythm, comping rhythm), defined as data. |
| `theory/notes.ts` | Pitch classes, enharmonic spelling by key, intervals. |
| `theory/scales.ts` | Major, natural minor, the seven modes, pentatonics, blues. |
| `theory/chords.ts` | Chord construction, qualities, Roman numeral parsing and realization, transposition. |
| `theory/phrases.ts` | Realizes phrase templates into notes within a scale for Trade Fours. |
| `random/rng.ts` | Seedable PRNG so results can be replayed, tested, and used for the Daily Jam. |
| `random/deck.ts` | Generic shuffle-without-replacement deck used by cards, tunes, prompts. |
| `components/Spinner` | Animated reel with lock toggle and reduced-motion fallback. |
| `components/Card` | Flippable card. |
| `components/Timer` | Countdown with warnings, background-safe. |
| `components/BarCounter` | Bar/beat progress driven by scheduler events. |
| `components/ChordStrip` | Row of chord cards with the sounding chord highlighted. |
| `components/TransportDock` | Global tempo, time signature, tap tempo, backing mixer. |
| `components/FocusView` | Large-type wrapper used by Focus Mode. |
| `state/profile.ts` | Instruments, transposition, skill level; persisted. |
| `state/settings.ts` | Global settings (sound, theme, tap key mapping); persisted. |
| `state/stats.ts` | Sessions played, minutes jammed, per-game counts, Hold the Pulse bests, Daily Jam streak; persisted. |

---

## 7. Design and UX

### 7.1 Visual direction

- Mood: a warm, slightly gritty rehearsal room after hours: dark charcoal background, amber "stage light" accents, a secondary electric-teal accent for interactive states. Subtle texture (CSS noise or gradient), never at the expense of contrast.
- Typography: a bold condensed display face for prompts (e.g. a Google Font such as "Bebas Neue" or "Oswald") and a highly readable sans for UI text, both with system fallbacks.
- Both dark (default) and light themes, driven by CSS custom properties and `prefers-color-scheme`, with a manual override in Settings.

### 7.2 Interaction principles

- One primary action per screen, always the biggest button, always bound to `Space` or `Enter`.
- Minimum touch target 48×48 px.
- Once a game is running, the player should never need to touch the screen until it ends.
- Every random reveal has a satisfying animation (≤ 1.5 s) and a skip-by-pressing-again behavior.
- Copy speaks directly to the player, short and encouraging ("No wrong notes, just new ideas").

### 7.3 Keyboard shortcuts (global)

| Key | Action |
|---|---|
| `Space` | Primary action (spin, draw, deal, start) / tap in Hold the Pulse |
| `R` | Re-roll |
| `Backspace` | Previous result |
| `P` | Play/stop transport and backing band |
| `T` | Tap tempo |
| `F` | Toggle Focus Mode |
| `?` | Shortcut help overlay |
| `Esc` | Exit Focus Mode / close overlays |

Shortcuts are remappable in Settings so they work with foot pedals and page turners that send key presses.

### 7.4 Accessibility

- WCAG 2.2 AA contrast in both themes.
- All interactive elements reachable and operable by keyboard with visible focus rings.
- Results announced via an `aria-live="polite"` region (e.g. "Key: D, Mode: Dorian, Tempo: 96").
- Respect `prefers-reduced-motion`.
- Visual equivalents for every audio cue (flash, banner, bar counter), so the games still work for Deaf/hard-of-hearing players using the visual pulse.
- Musical symbols (♭, ♯) paired with accessible labels ("B flat").

---

## 8. Data files

All content lives in `src/data/` as JSON so it can be edited without touching code, and is validated at build time with a schema (zod or a JSON schema test).

- `constraints.json` (≥ 60 cards)
- `progressions.json` (Roman numeral templates by difficulty)
- `phrases.json` (rhythm and contour templates for Trade Fours)
- `genres.json` (name, suggested tempo range, groove id, feel description)
- `grooves.json` (drum/bass/comping patterns referenced by genres)
- `tunes.json` (public-domain only, with `publicDomain` and `source` fields)
- `songPrompts.json` (titles, themes, structures)
- `instruments.json` (name, transposition, default range, role tags used by Missing Member and Constraint Cards)

All written content must be original to this project. No real club, society, or venue names appear in any data file.

---

## 9. Project structure

```
solo-jam-room/
├── .github/workflows/deploy.yml
├── public/
│   ├── favicon.svg
│   └── manifest.webmanifest
├── src/
│   ├── audio/
│   │   └── band/
│   ├── components/
│   ├── data/
│   ├── games/
│   │   ├── roulette/
│   │   ├── trade-fours/
│   │   ├── progressions/
│   │   ├── constraints/
│   │   ├── missing-member/
│   │   ├── hold-the-pulse/
│   │   ├── genre-flip/
│   │   ├── song-sprint/
│   │   └── daily/
│   ├── pages/            (Home, Profile, Settings, About, Onboarding)
│   ├── random/
│   ├── state/
│   ├── styles/           (tokens.css, global.css)
│   ├── theory/
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── unit/
│   └── e2e/
├── SPEC.md
├── README.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 10. Testing

- **Unit (Vitest):** all of `theory/`, `random/`, scheduler timing math, groove pattern validity (every pattern fills its time signature exactly), phrase generation staying in scale, deck exhaustion logic, Daily Jam seeding and streak logic, difficulty constraints, data-file validation. Target ≥ 90% coverage on `theory/` and `random/`.
- **Component:** key games render, primary action works, Focus Mode toggles.
- **E2E (Playwright):** smoke test that completes onboarding, loads Home, opens each game, triggers its primary action, and checks a result appears. Run against the production build.
- **Manual audio QA checklist** in `README.md`: backing band stays steady for 5 minutes at 60 and 180 BPM on Chrome and iOS Safari; no clicks or pops at loop boundaries; tab backgrounding doesn't break the timer.

---

## 11. Deployment

- `npm run build` outputs static files to `dist/`.
- GitHub Actions workflow on push to `main`: install → lint → typecheck → unit tests → build → deploy to GitHub Pages.
- `vite.config.ts` sets `base: "/solo-jam-room/"` (the repo name) for Pages, so the site is served at `https://<username>.github.io/solo-jam-room/`.
- PR builds run the same checks without deploying.

---

## 12. Git and commit workflow

This project is built incrementally and committed as it goes. These rules apply to every session.

### 12.1 Before each commit

1. Run `npm run lint`, `npm run typecheck`, and `npm test`. Do not commit if any fail; fix first.
2. Review `git diff --staged` and make sure only files relevant to the current task are included.
3. Never commit `node_modules/`, `dist/`, `.env*`, editor folders, or OS files (covered by `.gitignore` from the first commit).

### 12.2 Commit style

- Use **Conventional Commits**: `type(scope): summary` in the imperative mood, ≤ 72 characters.
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`, `perf`.
  - Scopes match folders or games: `roulette`, `trade-fours`, `progressions`, `constraints`, `missing-member`, `pulse`, `genre-flip`, `sprint`, `daily`, `audio`, `band`, `theory`, `profile`, `stats`, `ui`, `data`, `ci`.
- Add a body when the "why" isn't obvious from the summary.
- One logical change per commit. Prefer several small commits over one large one. A commit should leave the app building and tests passing.

Examples:
```
chore: scaffold Vite + React + TypeScript project
feat(theory): add key-aware enharmonic spelling
test(theory): cover chord spelling in all major and minor keys
feat(audio): add lookahead scheduler with bar and beat events
feat(band): add synthesized drum kit and genre groove patterns
feat(roulette): start backing band from spin result
feat(trade-fours): generate in-scale call phrases from templates
fix(trade-fours): switch turns on downbeat instead of timer tick
feat(daily): add date-seeded challenge and streak tracking
ci: deploy to GitHub Pages on push to main
```

### 12.3 Branching

- Work on a feature branch per milestone: `milestone/1-foundation`, `milestone/2-backing-band`, etc.
- Merge to `main` only when the milestone's acceptance criteria pass.
- Do not force-push, rewrite published history, or push to a remote unless the user asks.

### 12.4 Progress tracking

- Keep the milestone checklist in Section 13 of this file up to date: tick items (`- [x]`) in the same commit that completes them.
- If a decision changes the spec, update `SPEC.md` in a `docs(spec): …` commit with a one-line rationale in the body.

---

## 13. Milestones

### Milestone 1 — Foundation
- [x] Scaffold Vite + React + TS, ESLint, Prettier, Vitest, `.gitignore`
- [x] Design tokens, light/dark themes, global layout, header
- [x] Hash router with placeholder pages for every route
- [x] Home page game grid
- [x] Onboarding flow and Profile page with persistence
- [x] Seedable RNG and deck utilities with tests
- [x] Music theory module (notes, scales, chords, transposition) with tests
- [x] Audio engine, lookahead scheduler, synthesized click
- [x] Transport dock with tap tempo
- [x] Focus Mode wrapper and remappable keyboard shortcuts

### Milestone 2 — Backing band
- [x] Synthesized drum kit, bass voice, chord pad, lead voice
- [x] Groove patterns for each genre and time signature, with validity tests
- [x] Progression playback with per-part mixer and mute
- [x] Glitch-free looping and tempo changes

### Milestone 3 — Core games (MVP)
- [x] Jam Roulette (with backing)
- [x] Trade Fours (incl. echo variant)
- [x] Chord Progression Dealer (incl. Changes Challenge, capo and transposition)
- [x] Constraint Cards with ≥ 60 cards and overlay mode
- [x] Data-file schema validation test

### Milestone 4 — More games and progress
- [x] Missing Member
- [x] Hold the Pulse
- [x] Genre Flip (public-domain tune list with validation)
- [ ] Song Sprint with saved notes
- [x] Stats tracking and Profile stats view
- [ ] Daily Jam with streaks

### Milestone 5 — Polish and ship
- [ ] Animations and reduced-motion fallbacks across all games
- [ ] Accessibility pass (axe checks, keyboard-only run-through, live regions)
- [ ] Service worker for offline use, web app manifest, icons
- [ ] Playwright smoke tests
- [ ] GitHub Actions CI + Pages deploy
- [ ] About page with "How to get the most out of solo jamming" guide
- [ ] README with setup, scripts, and audio QA checklist

---

## 14. Open questions

1. Should v2 add optional microphone input (with explicit permission) for features like scoring Trade Fours echoes or detecting tempo drift without tapping?
2. Should the backing band move from synthesized sounds to small sample packs for a more realistic feel, given the bundle-size budget?
3. Is a shareable link for a result (e.g. `#/roulette?seed=…`) worth adding in v1, or deferred?
4. Should there be a "Practice Set" mode that chains several games into a timed 20–30 minute session?
