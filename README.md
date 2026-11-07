# Solo Jam Room

Quick jam games for **one musician playing alone**, with a built-in synthesized backing band.
It takes the energy of a jam night (random keys, chord changes thrown at you, trading solos, creative
challenges) and puts it in your practice room. You bring your instrument; the site brings everyone else.

Everything runs in the browser. No accounts, no backend, no microphone. Your profile, settings, stats and
notes stay in `localStorage`, and after the first visit the site works offline and can be installed.

## The games

| Game | What it does |
|---|---|
| **Jam Roulette** | Spin the reels for a key, mode, tempo, time signature, groove and a wildcard card, then jam. |
| **Trade Fours** | You play a phrase, the app answers in key, you answer back. Includes an echo (ear training) mode. |
| **Chord Dealer** | Deal a progression, loop it with the band. Written pitch, capo shapes and a Changes Challenge. |
| **Constraint Cards** | Draw a card that changes how you have to play. Overlays onto the other games. |
| **Missing Member** | One band member is missing each round; you cover their part. |
| **Hold the Pulse** | The click drops out. Tap the beat and see how far you drifted. |
| **Genre Flip** | Play a public-domain tune in a completely different style. |
| **Song Sprint** | Write a tiny song before the timer runs out. Notes are saved locally. |
| **Daily Jam** | One seeded challenge a day, the same for everyone, with a streak. |

## Getting started

Requires Node 20 or newer.

```sh
npm install
npm run dev        # http://localhost:5173/solo-jam-room/
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Typecheck, then build the static site to `dist/` (also writes the service worker). |
| `npm run preview` | Serve `dist/` locally, the way GitHub Pages will. |
| `npm run lint` | ESLint. |
| `npm run format` | Prettier. |
| `npm run typecheck` | `tsc` for the app and tests, and for the Node-side configs. |
| `npm test` | Unit and component tests (Vitest). |
| `npm run test:coverage` | The same, with coverage for `theory/` and `random/`. |
| `npm run e2e` | Playwright end-to-end tests against a fresh production build. |

The first time you run the end-to-end tests, install the browser once with
`npx playwright install chromium`.

## How it is built

- **Vite + React 18 + TypeScript (strict).** Plain CSS with design tokens on `:root`. Hash routing
  (`#/roulette`, `#/trade-fours`, ...) so it works on static hosting.
- **Audio** is the native Web Audio API, with no audio library. A lookahead scheduler (a ~25 ms timer
  scheduling ~100 ms ahead on the audio clock) drives everything musical, so turn changes, role swaps
  and the click all land exactly on the beat. The drums, bass, chord pad and lead voice are synthesized.
  The master chain is gain, compressor and a soft limiter so the band never clips.
- **Music theory** is pure TypeScript with no DOM: key-aware enharmonic spelling, modes, chords derived
  from the mode, Roman numerals (including secondary dominants), written-pitch transposition and capo shapes.
- **Content is data.** Everything in `src/data/*.json` can be edited without touching code, and the
  data tests act as the schema.

```
src/
  audio/        engine, scheduler, click, limiter, transport, and band/ (voices, grooves, voicing)
  components/   Spinner, Card, Timer, BarCounter, ChordStrip, TransportDock, FocusView, ...
  data/         constraints, progressions, phrases, genres, grooves, tunes, songPrompts, instruments
  games/        one folder per game
  pages/        Home, Profile, Settings, About, Onboarding
  random/       seedable RNG, shuffle deck, history
  state/        profile, settings, stats, notes, app context, shortcuts, storage
  styles/       tokens.css, global.css, layout.css, games.css
  theory/       notes, scales, chords, phrases, vamps
sw/             service worker template (the build fills in the precache list)
tests/
  unit/         Vitest: theory, random, audio logic, data files, games, components
  e2e/          Playwright: smoke, real audio, accessibility, keyboard, motion, offline
```

## Testing

- **Unit and component (Vitest, jsdom).** Theory, RNG and decks, scheduler timing, groove validity (every
  pattern fills its time signature exactly), phrase generation staying in scale, difficulty limits,
  Daily Jam seeding, streaks across month, leap-day and daylight-saving boundaries, data-file validation,
  and every game's primary flow. Games that depend on audio timing are tested against a fake audio clock
  that the test controls. Coverage of `src/theory/` and `src/random/` is above 90%.
- **End-to-end (Playwright, Chromium, production build).** Onboarding, every game, offline use, the
  web app manifest, keyboard-only play, reduced motion, and axe checks for WCAG 2.2 AA (including
  contrast) on every route in both themes. The audio tests measure the real output: it must be
  non-silent, must not clip, must follow Mute, and the audio clock must keep running.

## Manual audio QA checklist

Automated tests cannot judge feel, so run this before a release. Use headphones and speakers.

- [ ] **Steady for five minutes at 60 BPM.** Start the band on any groove, leave it for five minutes in
      Chrome and in iOS Safari. It must not speed up, slow down or stutter.
- [ ] **Steady for five minutes at 180 BPM**, same browsers.
- [ ] **No clicks or pops at loop boundaries.** Loop a four-bar progression for several minutes and
      listen at the point where it wraps.
- [ ] **Tempo changes are smooth.** Drag the tempo up and down while playing; no dropouts or doubled beats.
- [ ] **Meter changes land on a downbeat.** Switch between 4/4, 3/4, 6/8, 5/4 and 7/8 while playing.
- [ ] **Backgrounding the tab.** Switch away for a minute and back. The Song Sprint and Genre Flip timers
      must still show the right time. (Browsers throttle hidden tabs, so audio may glitch; the timers must not.)
- [ ] **Every groove sounds like a band.** Play each genre for a minute: reggae, punk, bossa nova, metal,
      lo-fi, funk, waltz, sea shanty, blues, jazz, rock, ballad, country.
- [ ] **Missing Member.** The missing part is completely silent, and the others still sound coherent.
- [ ] **Trade Fours.** The app's phrase is clearly audible above the band, and turns switch exactly on the beat.
- [ ] **Hold the Pulse.** The click is really gone for the silent bars and comes back on a downbeat.
- [ ] **Levels.** No part is painfully loud at the default mix; master mute and volume respond instantly.
- [ ] **iOS Safari.** Audio starts after the first tap, and still plays with the silent switch off.

## Keyboard shortcuts

`Space` primary action (spin, draw, deal, start; or tap in Hold the Pulse), `R` re-roll, `Backspace` previous
result, `P` play/stop the band, `T` tap tempo, `F` Focus Mode, `?` shortcut help, `Esc` leave Focus Mode or close
an overlay. Every shortcut can be remapped in Settings, so a foot pedal or page turner that sends key presses
can run the show.

## Deployment

`.github/workflows/deploy.yml` runs on every pull request and on pushes to `main`: install, lint, typecheck,
unit tests, build and end-to-end tests. Pushes to `main` then publish `dist/` to GitHub Pages.

One-time setup: in the repository's **Settings > Pages**, set **Source** to **GitHub Actions**. The site is
then served at `https://<username>.github.io/solo-jam-room/`. The base path is set in `vite.config.ts`.

## Typography and colour

The palette is purple (interactive), yellow ("now" and "selected") and white, in light and dark, following
Apple's Human Interface Guidelines: large sentence-case titles, pill buttons, soft cards and translucent bars.
Tokens live in `src/styles/tokens.css`.

Body text uses **Funnel Sans** (bundled, SIL Open Font License). Headings use **Duera**, which is listed first in
`--font-display` and falls back to Funnel Sans until its files are added. Duera is free for personal use only,
so a public site needs a commercial licence from the designer; the font files are not in this repository. Once
licensed, put the `.woff2` files in `public/fonts/` and add this to `src/styles/global.css`:

```css
@font-face {
  font-family: 'Duera';
  src: url('/solo-jam-room/fonts/Duera-Bold.woff2') format('woff2');
  font-weight: 700 800;
  font-display: swap;
}
```

## Content rules

All written content is original to this project. Genre Flip uses only public-domain melodies, shown by
title only: every tune in `src/data/tunes.json` must carry `publicDomain: true` and a source note, and a
test fails the build if one does not.
