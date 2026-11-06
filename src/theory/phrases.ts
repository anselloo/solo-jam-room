import phraseData from '../data/phrases.json';
import type { Rng } from '../random/rng';
import type { SkillLevel } from '../state/profile';
import { type Note, mod, pc } from './notes';
import { type ScaleId, scaleSemis } from './scales';

/** Realizes phrase templates (rhythm cells + melodic contours) into notes in a scale. */

export type PhraseStyle = 'simple' | 'bluesy' | 'busy';
export const PHRASE_STYLES: readonly PhraseStyle[] = ['simple', 'bluesy', 'busy'];

type Cell = [number, number][];
interface StyleData {
  label: string;
  cells: Record<string, Cell[]>;
}
interface PhraseData {
  styles: Record<PhraseStyle, StyleData>;
  contours: { id: string; steps: number[] }[];
}
export const PHRASES = phraseData as unknown as PhraseData;

export interface PhraseNote {
  midi: number;
  /** Beats from the start of the phrase. */
  start: number;
  /** Length in beats. */
  duration: number;
  velocity: number;
  /** Bar within the phrase, 0-based. */
  bar: number;
}

/** What each difficulty allows: pitch range (scale steps either side of the tonic) and density. */
export const LEVEL_LIMITS: Record<SkillLevel, { span: number; maxNotesPerBar: number }> = {
  beginner: { span: 4, maxNotesPerBar: 3 },
  intermediate: { span: 7, maxNotesPerBar: 5 },
  advanced: { span: 11, maxNotesPerBar: 9 },
};

const MINORISH: readonly ScaleId[] = ['minor', 'dorian', 'phrygian', 'locrian'];

/**
 * The scale a phrase style plays from, given the jam's mode: simple uses the pentatonic,
 * bluesy uses the blues scale, busy uses the full mode.
 */
export function phraseScaleFor(style: PhraseStyle, mode: ScaleId): ScaleId {
  if (style === 'busy') return mode;
  if (style === 'bluesy') return 'blues';
  if (mode === 'majorPentatonic' || mode === 'minorPentatonic' || mode === 'blues') return mode;
  return MINORISH.includes(mode) ? 'minorPentatonic' : 'majorPentatonic';
}

export interface PhraseOptions {
  /** Tonic of the scale. */
  root: Note;
  scale: ScaleId;
  style: PhraseStyle;
  level: SkillLevel;
  bars: number;
  /** Beats in each bar of the current meter. */
  beatsPerBar: number;
  rng: Rng;
}

/** All MIDI notes of the scale around the tonic (tonic between G3 and F#4), ascending. */
export function scaleLadder(root: Note, scale: ScaleId): { ladder: number[]; tonicIndex: number } {
  const tonic = 55 + mod(pc(root) - 55, 12);
  const semis = scaleSemis(scale);
  const ladder: number[] = [];
  for (let oct = -3; oct <= 3; oct++) for (const s of semis) ladder.push(tonic + oct * 12 + s);
  ladder.sort((a, b) => a - b);
  return { ladder, tonicIndex: ladder.indexOf(tonic) };
}

function cellsFor(style: PhraseStyle, beatsPerBar: number, maxNotes: number): Cell[] {
  // Short bars use the 3-beat cells; longer bars reuse 4-beat cells and hold the last note.
  const key = beatsPerBar < 4 ? '3' : '4';
  const fits = (st: PhraseStyle) =>
    PHRASES.styles[st].cells[key].filter((c) => c.length <= maxNotes);
  // If a style has nothing sparse enough for this level, fall back to the simple style's rhythms
  // so the density limit always holds.
  const ok = fits(style);
  if (ok.length > 0) return ok;
  const simple = fits('simple');
  if (simple.length > 0) return simple;
  const pool = PHRASES.styles.simple.cells[key];
  const lowest = Math.min(...pool.map((c) => c.length));
  return pool.filter((c) => c.length === lowest);
}

/** Generate one phrase. Every pitch comes from `scale` and stays within the level's range. */
export function generatePhrase(o: PhraseOptions): PhraseNote[] {
  const limits = LEVEL_LIMITS[o.level];
  const { ladder, tonicIndex } = scaleLadder(o.root, o.scale);
  const cells = cellsFor(o.style, o.beatsPerBar, limits.maxNotesPerBar);
  const contour = o.rng.pick(PHRASES.contours).steps;

  // Rhythm: one cell per bar, the last bar's final note held to the end of the bar.
  const rhythm: { start: number; duration: number; bar: number }[] = [];
  for (let bar = 0; bar < o.bars; bar++) {
    const cell = o.rng.pick(cells);
    cell.forEach(([start, dur], i) => {
      const last = i === cell.length - 1;
      const duration =
        last && bar === o.bars - 1
          ? o.beatsPerBar - start
          : last && o.beatsPerBar > 4
            ? o.beatsPerBar - start
            : dur;
      rhythm.push({ start: bar * o.beatsPerBar + start, duration, bar });
    });
  }

  const n = rhythm.length;
  const direction = o.rng.chance(0.5) ? 1 : -1;
  const indices = rhythm.map((_, i) => {
    const t = n === 1 ? 0 : (i / (n - 1)) * (contour.length - 1);
    const base = contour[Math.round(t)] * direction;
    const jitter = o.rng.int(-1, 1);
    const step = Math.max(-limits.span, Math.min(limits.span, base + jitter));
    return tonicIndex + step;
  });

  // Resolve on the tonic (within range).
  const tonicPc = pc(o.root);
  const resolve = ladder
    .map((m, idx) => ({ m, idx }))
    .filter(({ m, idx }) => mod(m, 12) === tonicPc && Math.abs(idx - tonicIndex) <= limits.span)
    .sort((a, b) => Math.abs(a.idx - indices[n - 1]) - Math.abs(b.idx - indices[n - 1]))[0];
  indices[n - 1] = resolve ? resolve.idx : tonicIndex;

  return rhythm.map((r, i) => ({
    midi: ladder[indices[i]],
    start: r.start,
    duration: r.duration,
    velocity: Number.isInteger(r.start) ? 0.9 : 0.75,
    bar: r.bar,
  }));
}
