import data from '../../data/progressions.json';
import type { Rng } from '../../random/rng';
import type { SkillLevel } from '../../state/profile';
import {
  capoShape,
  chordSymbol,
  realizeRoman,
  toWrittenChord,
  type Chord,
} from '../../theory/chords';
import { type TranspositionKey, noteLabel } from '../../theory/notes';
import { MODE_IDS, keyRootsFor, type Key, type ScaleId } from '../../theory/scales';
import { QUALITIES } from '../../theory/chords';

export type DealLength = 4 | 8 | 'blues';
export type DisplayMode = 'names' | 'roman' | 'both';

type LevelMap<T> = Record<SkillLevel, T>;
interface Data {
  templates: {
    major: LevelMap<Record<string, string[][]>>;
    minor: LevelMap<Record<string, string[][]>>;
    modal: Record<string, Record<string, string[][]>>;
  };
  blues: Record<'major' | 'minor', LevelMap<string[][]>>;
  pools: {
    major: LevelMap<string[]>;
    minor: LevelMap<string[]>;
    modal: Record<string, string[]>;
  };
}
export const DATA = data as unknown as Data;

/** Which template family a mode uses. Modes without their own table borrow major or minor. */
export type Family = 'major' | 'minor' | 'modal';

export function familyOf(mode: ScaleId): Family {
  if (mode === 'major' || mode === 'majorPentatonic') return 'major';
  if (mode === 'minor' || mode === 'minorPentatonic' || mode === 'blues') return 'minor';
  return 'modal';
}

export interface DealSettings {
  /** Tonic pitch class, or null to roll. */
  keyPc: number | null;
  /** Mode, or null to roll. */
  mode: ScaleId | null;
  level: SkillLevel;
  length: DealLength;
}

export interface Deal {
  keyPc: number;
  mode: ScaleId;
  level: SkillLevel;
  length: DealLength;
  /** Roman numerals, one per bar. */
  romans: string[];
}

export function keyOf(deal: Pick<Deal, 'keyPc' | 'mode'>): Key {
  return { root: keyRootsFor(deal.mode)[deal.keyPc], mode: deal.mode };
}

/** Candidate Roman-numeral templates for a mode, level and length. */
export function templatesFor(mode: ScaleId, level: SkillLevel, length: DealLength): string[][] {
  const fam = familyOf(mode);
  if (length === 'blues') {
    // Modes other than major/minor use the closer blues form.
    const bluesFam =
      fam === 'major' || mode === 'mixolydian' || mode === 'lydian' ? 'major' : 'minor';
    return DATA.blues[bluesFam][level];
  }
  if (fam === 'modal') return DATA.templates.modal[mode]?.[String(length)] ?? [];
  return DATA.templates[fam][level][String(length)] ?? [];
}

/** Single-chord alternatives used when re-dealing one chord. */
export function poolFor(mode: ScaleId, level: SkillLevel): string[] {
  const fam = familyOf(mode);
  return fam === 'modal' ? DATA.pools.modal[mode] : DATA.pools[fam][level];
}

/** Modes that can be rolled for a level: modal templates exist for all seven modes. */
export function modesFor(): ScaleId[] {
  return [...MODE_IDS];
}

export function deal(settings: DealSettings, rng: Rng): Deal {
  const mode = settings.mode ?? rng.pick(modesFor());
  const keyPc = settings.keyPc ?? rng.int(0, 11);
  const options = templatesFor(mode, settings.level, settings.length);
  const romans =
    options.length > 0 ? rng.pick(options) : rng.pick(templatesFor('major', settings.level, 4));
  return { keyPc, mode, level: settings.level, length: settings.length, romans: [...romans] };
}

/** Realize a deal's numerals as concrete chords in its key. */
export function realizeDeal(d: Deal): Chord[] {
  const key = keyOf(d);
  return d.romans.map((r) => realizeRoman(r, key));
}

/** Replace one chord with a different one from the level's pool. */
export function redealChord(d: Deal, index: number, rng: Rng): Deal {
  const pool = poolFor(d.mode, d.level).filter((r) => r !== d.romans[index]);
  if (pool.length === 0) return d;
  const romans = d.romans.slice();
  romans[index] = rng.pick(pool);
  return { ...d, romans };
}

/** Same changes, up a whole step (the Changes Challenge modulation). */
export function modulateUp(d: Deal, semitones = 2): Deal {
  return { ...d, keyPc: (d.keyPc + semitones) % 12 };
}

export interface ChallengeChange {
  deal: Deal;
  kind: 'chord' | 'key';
  /** Index of the changed chord, for kind 'chord'. */
  index?: number;
}

/** What the Changes Challenge does after N loops: usually swap a chord, sometimes modulate. */
export function challengeChange(d: Deal, rng: Rng): ChallengeChange {
  if (rng.chance(0.3)) return { deal: modulateUp(d), kind: 'key' };
  const index = rng.int(0, d.romans.length - 1);
  const next = redealChord(d, index, rng);
  return next === d ? { deal: modulateUp(d), kind: 'key' } : { deal: next, kind: 'chord', index };
}

export interface ChordDisplay {
  /** Name as shown to the player (written pitch or capo shape applied). */
  name: string;
  roman: string;
  /** Screen-reader text. */
  spoken: string;
  /** Concert name when it differs from `name`, e.g. "sounds as B♭". */
  concert?: string;
}

export interface DisplayOptions {
  transposition: TranspositionKey;
  capo: number;
}

export function describeChord(chord: Chord, roman: string, opts: DisplayOptions): ChordDisplay {
  const concert = chordSymbol(chord);
  let shown = chord;
  if (opts.transposition !== 'C') shown = toWrittenChord(chord, opts.transposition);
  else if (opts.capo > 0) shown = capoShape(chord, opts.capo);
  const name = chordSymbol(shown);
  const q = QUALITIES[chord.quality];
  return {
    name,
    roman,
    spoken: `${noteLabel(shown.root)} ${q.spoken}`,
    concert: name !== concert ? concert : undefined,
  };
}
