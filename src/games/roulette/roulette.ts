import { GENRES, genreById, type Genre } from '../../audio/band/grooves';
import { TIME_SIGNATURES, signatureLabel, type TimeSignature } from '../../audio/scheduler';
import type { Rng } from '../../random/rng';
import type { SkillLevel } from '../../state/profile';
import type { Chord } from '../../theory/chords';
import { type Note, parseNote, pc } from '../../theory/notes';
import { keyRootsFor, scaleNoteNames, type ScaleId } from '../../theory/scales';
import { vampProgression } from '../../theory/vamps';
import { type ConstraintCard } from '../constraints/deck';

export type ReelId = 'key' | 'mode' | 'tempo' | 'signature' | 'groove' | 'wildcard';
export const REELS: readonly ReelId[] = ['key', 'mode', 'tempo', 'signature', 'groove', 'wildcard'];

export const REEL_LABELS: Record<ReelId, string> = {
  key: 'Key',
  mode: 'Mode',
  tempo: 'Tempo',
  signature: 'Time',
  groove: 'Groove',
  wildcard: 'Wildcard',
};

/** A few words under each reel that say what it decides. */
export const REEL_HINTS: Record<ReelId, string> = {
  key: 'your home note',
  mode: 'the scale’s mood',
  tempo: 'speed in BPM',
  signature: 'beats per bar',
  groove: 'band style',
  wildcard: 'a twist',
};

export interface DifficultyConfig {
  /** Allowed tonic pitch classes. */
  keys: number[];
  modes: ScaleId[];
  signatures: string[];
  bpm: [number, number];
}

const pcsOf = (names: string[]) => names.map((n) => pc(parseNote(n)));
const ALL_PCS = Array.from({ length: 12 }, (_, i) => i);

export const DIFFICULTY: Record<SkillLevel, DifficultyConfig> = {
  beginner: {
    keys: pcsOf(['E', 'A', 'D', 'G', 'C']),
    modes: ['major', 'minor'],
    signatures: ['4/4'],
    bpm: [70, 110],
  },
  intermediate: {
    keys: ALL_PCS,
    modes: ['major', 'minor', 'dorian', 'mixolydian'],
    signatures: ['4/4', '3/4', '6/8'],
    bpm: [60, 140],
  },
  advanced: {
    keys: ALL_PCS,
    modes: ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'],
    signatures: ['4/4', '3/4', '6/8', '5/4', '7/8'],
    bpm: [50, 180],
  },
};

export const MODE_NAMES: Partial<Record<ScaleId, string>> = {
  major: 'Major',
  minor: 'Minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  locrian: 'Locrian',
};

/** One line on what each mode sounds like, for people who have never heard the word. */
export const MODE_MOODS: Partial<Record<ScaleId, string>> = {
  major: 'bright and happy',
  minor: 'darker and more serious',
  dorian: 'minor with a hopeful lift',
  phrygian: 'dark and Spanish-sounding',
  lydian: 'dreamy and floating',
  mixolydian: 'relaxed and bluesy, a rock favourite',
  locrian: 'tense and unsettled',
};

export interface RouletteResult {
  /** Tonic pitch class; spelling is derived from the mode so it is always correct. */
  keyPc: number;
  mode: ScaleId;
  bpm: number;
  signature: string;
  genre: string;
  wildcard: ConstraintCard | null;
}

export type Locks = Record<ReelId, boolean>;
export const NO_LOCKS: Locks = {
  key: false,
  mode: false,
  tempo: false,
  signature: false,
  groove: false,
  wildcard: false,
};

export interface SpinOptions {
  level: SkillLevel;
  wildcardOn: boolean;
  /** Cards the player is eligible to draw as a wildcard. */
  wildcardPool: readonly ConstraintCard[];
}

export function keyNote(result: Pick<RouletteResult, 'keyPc' | 'mode'>): Note {
  return keyRootsFor(result.mode)[result.keyPc];
}

export function keyName(result: Pick<RouletteResult, 'keyPc' | 'mode'>): string {
  const n = keyNote(result);
  return n.letter + (n.acc > 0 ? '♯'.repeat(n.acc) : '♭'.repeat(-n.acc));
}

export const signatureOf = (label: string): TimeSignature =>
  TIME_SIGNATURES.find((s) => signatureLabel(s) === label) as TimeSignature;

/** Pick a tempo inside the difficulty range, preferring the part that suits the genre. */
export function pickTempo(rng: Rng, cfg: DifficultyConfig, genre: Genre | undefined): number {
  let [lo, hi] = cfg.bpm;
  if (genre) {
    const gLo = Math.max(lo, genre.tempo[0]);
    const gHi = Math.min(hi, genre.tempo[1]);
    if (gLo <= gHi) [lo, hi] = [gLo, gHi];
  }
  return rng.int(lo, hi);
}

/** Genres that feel natural in a meter, or all genres if none claims it. */
export function genresFor(signature: string): Genre[] {
  const native = GENRES.filter((g) => g.meters.includes(signature));
  return native.length > 0 ? native : GENRES;
}

/**
 * Spin the reels. Locked reels keep the previous value (when there is one); everything else is
 * drawn within the difficulty limits. Signature is chosen before the groove, and the groove before
 * the tempo, so the combination hangs together.
 */
export function spin(
  prev: RouletteResult | null,
  locks: Locks,
  opts: SpinOptions,
  rng: Rng,
): RouletteResult {
  const cfg = DIFFICULTY[opts.level];
  const keep = <K extends keyof RouletteResult>(
    reel: ReelId,
    field: K,
    fresh: () => RouletteResult[K],
  ) => (prev && locks[reel] ? prev[field] : fresh());

  const keyPc = keep('key', 'keyPc', () => rng.pick(cfg.keys));
  const mode = keep('mode', 'mode', () => rng.pick(cfg.modes));
  const signature = keep('signature', 'signature', () => rng.pick(cfg.signatures));
  const genre = keep('groove', 'genre', () => rng.pick(genresFor(signature)).id);
  const bpm = keep('tempo', 'bpm', () => pickTempo(rng, cfg, genreById(genre)));
  const wildcard = keep('wildcard', 'wildcard', () =>
    opts.wildcardOn && opts.wildcardPool.length > 0 ? rng.pick(opts.wildcardPool) : null,
  );
  return { keyPc, mode, bpm, signature, genre, wildcard: opts.wildcardOn ? wildcard : null };
}

/** The backing loop for a result. Intermediate and advanced players get seventh chords. */
export function backingFor(result: RouletteResult, level: SkillLevel): Chord[] {
  return vampProgression({ root: keyNote(result), mode: result.mode }, level !== 'beginner');
}

export function scaleNotesOf(result: RouletteResult): string[] {
  return scaleNoteNames(keyNote(result), result.mode);
}

/** Text for the aria-live region, e.g. "Key: D, Mode: Dorian, Tempo: 96". */
export function describeResult(r: RouletteResult): string {
  const genre = genreById(r.genre)?.name ?? r.genre;
  const wild = r.wildcard ? `, Wildcard: ${r.wildcard.text}` : '';
  return `Key: ${keyName(r)}, Mode: ${MODE_NAMES[r.mode] ?? r.mode}, Tempo: ${r.bpm}, Time: ${r.signature}, Groove: ${genre}${wild}`;
}
