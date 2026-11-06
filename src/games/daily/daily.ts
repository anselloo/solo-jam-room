import { GENRES, genreById } from '../../audio/band/grooves';
import { Deck } from '../../random/deck';
import { createRng, type Rng } from '../../random/rng';
import { daysBetween } from '../../state/stats';
import { realizeRoman, type Chord } from '../../theory/chords';
import { noteName } from '../../theory/notes';
import { vampProgression } from '../../theory/vamps';
import { keyRootsFor, type ScaleId } from '../../theory/scales';
import { CARDS, type ConstraintCard } from '../constraints/deck';
import { deal, type Deal } from '../progressions/deal';
import { ROLES, ROLE_INFO, type Role } from '../missing-member/roles';
import { MODE_NAMES, NO_LOCKS, keyName, spin, type RouletteResult } from '../roulette/roulette';
import { PRESETS } from '../hold-the-pulse/pulse';
import { TUNES, flipFor, tuneKeyName, type Tune } from '../genre-flip/flip';
import { generatePack, type PromptPack } from '../song-sprint/sprint';
import { PHRASE_STYLES, PHRASES, type PhraseStyle } from '../../theory/phrases';

export type DailyGame =
  | 'roulette'
  | 'trade-fours'
  | 'progressions'
  | 'constraints'
  | 'missing-member'
  | 'hold-the-pulse'
  | 'genre-flip'
  | 'song-sprint';

export const DAILY_GAMES: readonly DailyGame[] = [
  'roulette',
  'trade-fours',
  'progressions',
  'constraints',
  'missing-member',
  'hold-the-pulse',
  'genre-flip',
  'song-sprint',
];

export const GAME_TITLES: Record<DailyGame, string> = {
  roulette: 'Jam Roulette',
  'trade-fours': 'Trade Fours',
  progressions: 'Chord Dealer',
  constraints: 'Constraint Cards',
  'missing-member': 'Missing Member',
  'hold-the-pulse': 'Hold the Pulse',
  'genre-flip': 'Genre Flip',
  'song-sprint': 'Song Sprint',
};

/** What the band should play for a challenge, where it has one. */
export interface DailyBand {
  keyPc: number;
  mode: ScaleId;
  bpm: number;
  signature: string;
  genreId: string;
  /** Roman numerals to play instead of the default loop (Chord Dealer). */
  romans?: string[];
}

export interface DailyChallenge {
  date: string;
  game: DailyGame;
  path: string;
  title: string;
  /** One sentence the whole challenge boils down to. */
  summary: string;
  /** Extra lines of detail. */
  details: string[];
  band?: DailyBand;
  card: ConstraintCard;
}

/** Everyone gets the same cards, so the daily pool excludes instrument-specific ones. */
const DAILY_CARDS = CARDS.filter((c) => !c.instruments && c.difficulty !== 'hard');

const rngFor = (date: string): Rng => createRng(`solo-jam-room:${date}`);

const CYCLE = DAILY_GAMES.length;

/** The play order for one cycle of days: every game exactly once, in a seeded shuffle. */
function cycleOrder(cycle: number): DailyGame[] {
  const order = createRng(`solo-jam-room:cycle:${cycle}`).shuffle(DAILY_GAMES);
  // Do not open a cycle with the game that closed the one before it.
  const previousLast = createRng(`solo-jam-room:cycle:${cycle - 1}`).shuffle(DAILY_GAMES)[
    CYCLE - 1
  ];
  if (order[0] === previousLast) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

/**
 * The game for a date. Days are grouped into cycles of one-day-per-game, each in a seeded
 * shuffled order, so every game comes round regularly and the same game never appears two days
 * running. The result depends only on the date.
 */
export function gameFor(date: string): DailyGame {
  const day = daysBetween('1970-01-01', date);
  const cycle = Math.floor(day / CYCLE);
  const index = day - cycle * CYCLE;
  return cycleOrder(cycle)[index];
}

const bandFrom = (r: RouletteResult): DailyBand => ({
  keyPc: r.keyPc,
  mode: r.mode,
  bpm: r.bpm,
  signature: r.signature,
  genreId: r.genre,
});

const keyText = (r: Pick<RouletteResult, 'keyPc' | 'mode'>) =>
  `${keyName(r)} ${MODE_NAMES[r.mode] ?? r.mode}`;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The Daily Jam for a local date (YYYY-MM-DD). The same date always gives the same challenge. */
export function dailyChallenge(date: string): DailyChallenge {
  const game = gameFor(date);
  const rng = rngFor(`${date}:${game}`);
  const card = rng.pick(DAILY_CARDS);
  // Keep the daily approachable but not trivial.
  const roulette = spin(
    null,
    NO_LOCKS,
    { level: 'intermediate', wildcardOn: false, wildcardPool: [] },
    rng,
  );
  const genre = genreById(roulette.genre)?.name ?? roulette.genre;
  const cardText = `Card: ${lowerFirst(card.text)}`;
  const base = { date, game, title: GAME_TITLES[game], card };
  const path = `/${game}`;

  switch (game) {
    case 'roulette':
      return {
        ...base,
        path,
        summary: `Jam Roulette in ${keyText(roulette)} at ${roulette.bpm} BPM, ${genre} feel. ${cardText}`,
        details: [`Time signature ${roulette.signature}`, `Groove: ${genre}`],
        band: bandFrom(roulette),
      };
    case 'trade-fours': {
      const style: PhraseStyle = rng.pick([...PHRASE_STYLES]);
      const bars = rng.pick([2, 4, 4, 8]);
      return {
        ...base,
        path,
        summary: `Trade Fours in ${keyText(roulette)} at ${roulette.bpm} BPM, ${bars}-bar ${PHRASES.styles[style].label.toLowerCase()} phrases. ${cardText}`,
        details: [`Groove: ${genre}`, `${bars} bars each, 4 rounds`],
        band: bandFrom(roulette),
      };
    }
    case 'progressions': {
      const d: Deal = deal(
        { keyPc: roulette.keyPc, mode: roulette.mode, level: 'intermediate', length: 4 },
        rng,
      );
      return {
        ...base,
        path,
        summary: `Chord Dealer in ${keyText(roulette)} at ${roulette.bpm} BPM: play over ${d.romans.join(' – ')}. ${cardText}`,
        details: [
          `Groove: ${genre}`,
          'Loop it for ten minutes and change your approach every four loops.',
        ],
        band: { ...bandFrom(roulette), romans: d.romans },
      };
    }
    case 'constraints': {
      const deck = new Deck(DAILY_CARDS, rng);
      const three = [card, deck.draw().item, deck.draw().item].filter(
        (c, i, all) => all.findIndex((x) => x.id === c.id) === i,
      );
      return {
        ...base,
        path,
        summary: `Constraint Cards: improvise for a minute under each of these: ${three.map((c) => lowerFirst(c.text)).join(' Then: ')}`,
        details: three.map((c, i) => `${i + 1}. ${c.text}`),
        band: bandFrom(roulette),
      };
    }
    case 'missing-member': {
      const role: Role = rng.pick([...ROLES]);
      return {
        ...base,
        path,
        summary: `Missing Member: ${ROLE_INFO[role].short} in ${keyText(roulette)} at ${roulette.bpm} BPM. ${cardText}`,
        details: [ROLE_INFO[role].banner, ROLE_INFO[role].hint],
        band: bandFrom(roulette),
      };
    }
    case 'hold-the-pulse': {
      const preset = rng.pick([...PRESETS]);
      const bpm = rng.int(70, 150);
      return {
        ...base,
        path,
        summary: `Hold the Pulse at ${bpm} BPM: ${preset.barsOn} bars with the click, ${preset.barsOff} without, ${preset.rounds} rounds. Land within 5 BPM.`,
        details: ['Tap each beat during the silence.'],
      };
    }
    case 'genre-flip': {
      const tune: Tune = rng.pick(TUNES);
      const g = rng.pick(GENRES);
      const flip = flipFor(tune, g, rng);
      return {
        ...base,
        path,
        summary: `Genre Flip: play "${tune.title}" as ${g.name} at ${flip.bpm} BPM. ${cardText}`,
        details: [`Try it in ${tuneKeyName(tune)}`, g.feel],
        band: {
          keyPc: roulette.keyPc,
          mode: roulette.mode,
          bpm: flip.bpm,
          signature: flip.signature,
          genreId: g.id,
        },
      };
    }
    case 'song-sprint': {
      const pack: PromptPack = generatePack(rng, 'intermediate', DAILY_CARDS);
      const minutes = rng.pick([5, 10]);
      return {
        ...base,
        path,
        summary: `Song Sprint: write "${pack.title}" in ${minutes} minutes. Theme: ${lowerFirst(pack.theme)}. ${cardText}`,
        details: [
          `Structure: ${pack.structure}`,
          `${noteName(keyRootsFor(pack.result.mode)[pack.result.keyPc])} ${MODE_NAMES[pack.result.mode]} at ${pack.result.bpm} BPM`,
        ],
        band: bandFrom(pack.result),
      };
    }
  }
}

/** The chords the band plays for a challenge: its dealt changes, or a loop in the key and mode. */
export function bandChords(band: DailyBand): Chord[] {
  const key = { root: keyRootsFor(band.mode)[band.keyPc], mode: band.mode };
  return band.romans ? band.romans.map((r) => realizeRoman(r, key)) : vampProgression(key, true);
}
