import { diatonicChords, type Chord } from './chords';
import type { Key, ScaleId } from './scales';

/**
 * Scale degrees (0-based) of a short, characteristic backing loop for each mode. Every chord is
 * built from the mode's own scale, so the progression always fits the key and mode.
 */
const VAMP_DEGREES: Partial<Record<ScaleId, number[]>> = {
  major: [0, 5, 3, 4], // I vi IV V
  minor: [0, 5, 2, 6], // i VI III VII
  dorian: [0, 0, 3, 0], // i, i, IV, i
  mixolydian: [0, 6, 3, 0], // I VII IV I
  lydian: [0, 1, 0, 1], // I II I II
  phrygian: [0, 1, 0, 1], // i II i II
  locrian: [0, 1, 4, 1], // i° II v II
};

/** A simple four-bar loop in the given key and mode. Pentatonic/blues fall back to major/minor. */
export function vampProgression(key: Key, sevenths = false): Chord[] {
  let mode: ScaleId = key.mode;
  if (mode === 'majorPentatonic') mode = 'major';
  if (mode === 'minorPentatonic' || mode === 'blues') mode = 'minor';
  const chords = diatonicChords({ root: key.root, mode }, sevenths);
  return (VAMP_DEGREES[mode] ?? VAMP_DEGREES.major!).map((d) => chords[d]);
}
