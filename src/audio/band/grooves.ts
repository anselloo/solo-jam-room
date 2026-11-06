import genreData from '../../data/genres.json';
import grooveData from '../../data/grooves.json';
import { signatureLabel, type TimeSignature } from '../scheduler';

/**
 * Groove patterns as data. One character per step; a bar has `beats * stepsPerBeat(sig)` steps
 * (16th-note steps for x/4 meters, 8th-note-subdivided steps for x/8 meters).
 *
 *   kick/snare: x hit, X accent          hat: x closed, o open
 *   bass: r root, f fifth, o octave, t third
 *   comp: x short stab, l long held chord
 *   .: rest
 */
export interface GroovePattern {
  kick: string;
  snare: string;
  hat: string;
  bass: string;
  comp: string;
}

export interface Groove {
  id: string;
  name: string;
  /** 0 = straight, 1 = full triplet swing. */
  swing: number;
  patterns: Record<string, GroovePattern>;
}

export interface Genre {
  id: string;
  name: string;
  groove: string;
  /** Suggested tempo range in BPM. */
  tempo: [number, number];
  feel: string;
  /** Meters this genre feels natural in. */
  meters: string[];
}

export const GROOVES = grooveData as Groove[];
export const GENRES = genreData as Genre[];

export const grooveById = (id: string): Groove | undefined => GROOVES.find((g) => g.id === id);
export const genreById = (id: string): Genre | undefined => GENRES.find((g) => g.id === id);

/** Steps per beat: quarter-note beats get four 16ths; eighth-note beats get two. */
export const stepsPerBeat = (sig: TimeSignature): number => (sig.unit === 4 ? 4 : 2);
export const stepsPerBar = (sig: TimeSignature): number => sig.beats * stepsPerBeat(sig);

export function patternFor(groove: Groove, sig: TimeSignature): GroovePattern {
  const p = groove.patterns[signatureLabel(sig)];
  if (!p) throw new Error(`Groove "${groove.id}" has no pattern for ${signatureLabel(sig)}`);
  return p;
}

/** Fraction of a beat by which each step is pushed late to create swing. */
export function swingOffset(step: number, perBeat: number, swing: number): number {
  const extra = perBeat === 4 ? [0, 1 / 12, 1 / 6, 1 / 12] : [0, 1 / 6];
  return (extra[step % perBeat] ?? 0) * Math.min(1, Math.max(0, swing));
}

export type BassToken = 'r' | 'f' | 'o' | 't';

export interface StepPlan {
  kick: 'x' | 'X' | null;
  snare: 'x' | 'X' | null;
  hat: 'x' | 'o' | null;
  bass: { token: BassToken; holdSteps: number } | null;
  comp: { long: boolean; holdSteps: number } | null;
}

const ch = (s: string, i: number): string => {
  const c = s[i];
  return c && c !== '.' ? c : '';
};

/** Steps from index `i` until the next hit in `pattern`, or the end of the bar. */
export function holdSteps(pattern: string, i: number): number {
  for (let j = i + 1; j < pattern.length; j++) if (pattern[j] !== '.') return j - i;
  return pattern.length - i;
}

/** What each part plays on one step of the bar. Pure, so it is testable without audio. */
export function planStep(groove: Groove, sig: TimeSignature, step: number): StepPlan {
  const p = patternFor(groove, sig);
  const k = ch(p.kick, step);
  const s = ch(p.snare, step);
  const h = ch(p.hat, step);
  const b = ch(p.bass, step);
  const c = ch(p.comp, step);
  return {
    kick: k ? (k === 'X' ? 'X' : 'x') : null,
    snare: s ? (s === 'X' ? 'X' : 'x') : null,
    hat: h ? (h === 'o' ? 'o' : 'x') : null,
    bass: b ? { token: b as BassToken, holdSteps: holdSteps(p.bass, step) } : null,
    comp: c ? { long: c === 'l', holdSteps: holdSteps(p.comp, step) } : null,
  };
}
