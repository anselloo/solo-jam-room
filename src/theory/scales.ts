import { type Note, noteName, parseDegree, parseNote, pc, spellAbove } from './notes';

export type ScaleId =
  | 'major'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'minor'
  | 'locrian'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'blues';

export interface ScaleDef {
  id: ScaleId;
  name: string;
  /** Degrees relative to the tonic, e.g. "1 2 b3 4 5 6 b7". */
  degrees: string;
  /** Seven-note scales support diatonic chord derivation. */
  diatonic: boolean;
}

export const SCALES: Record<ScaleId, ScaleDef> = {
  major: { id: 'major', name: 'Major', degrees: '1 2 3 4 5 6 7', diatonic: true },
  dorian: { id: 'dorian', name: 'Dorian', degrees: '1 2 b3 4 5 6 b7', diatonic: true },
  phrygian: { id: 'phrygian', name: 'Phrygian', degrees: '1 b2 b3 4 5 b6 b7', diatonic: true },
  lydian: { id: 'lydian', name: 'Lydian', degrees: '1 2 3 #4 5 6 7', diatonic: true },
  mixolydian: { id: 'mixolydian', name: 'Mixolydian', degrees: '1 2 3 4 5 6 b7', diatonic: true },
  minor: { id: 'minor', name: 'Natural minor', degrees: '1 2 b3 4 5 b6 b7', diatonic: true },
  locrian: { id: 'locrian', name: 'Locrian', degrees: '1 b2 b3 4 b5 b6 b7', diatonic: true },
  majorPentatonic: {
    id: 'majorPentatonic',
    name: 'Major pentatonic',
    degrees: '1 2 3 5 6',
    diatonic: false,
  },
  minorPentatonic: {
    id: 'minorPentatonic',
    name: 'Minor pentatonic',
    degrees: '1 b3 4 5 b7',
    diatonic: false,
  },
  blues: { id: 'blues', name: 'Blues', degrees: '1 b3 4 b5 5 b7', diatonic: false },
};

export const MODE_IDS: readonly ScaleId[] = [
  'major',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'minor',
  'locrian',
];

export interface Key {
  root: Note;
  mode: ScaleId;
}

/** Semitone offsets from the tonic for each scale degree. */
export function scaleSemis(id: ScaleId): number[] {
  return SCALES[id].degrees.split(' ').map((d) => parseDegree(d).semis);
}

/** Correctly spelled notes of a scale (one letter per degree for seven-note scales). */
export function scaleNotes(root: Note, id: ScaleId): Note[] {
  return SCALES[id].degrees.split(' ').map((d) => {
    const { steps, semis } = parseDegree(d);
    return spellAbove(root, steps, semis);
  });
}

export function scaleNoteNames(root: Note, id: ScaleId): string[] {
  return scaleNotes(root, id).map(noteName);
}

/** Pitch classes in the scale, for fast "is this note in key" checks. */
export function scalePitchClasses(root: Note, id: ScaleId): Set<number> {
  return new Set(scaleNotes(root, id).map(pc));
}

const LETTER_OPTIONS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].flatMap((l) => [l + '♭', l, l + '♯']);
const TIEBREAK = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const rank = (n: Note): number => {
  const i = TIEBREAK.indexOf(noteName(n));
  return i < 0 ? 99 : i;
};

/**
 * The best-spelled tonic for each of the 12 pitch classes in a given scale: the candidate
 * whose scale needs the fewest accidentals and never needs a double accidental.
 * Returns index = pitch class.
 */
const rootsCache = new Map<ScaleId, Note[]>();

export function keyRootsFor(id: ScaleId): Note[] {
  const cached = rootsCache.get(id);
  if (cached) return cached;
  const out: Note[] = [];
  for (let p = 0; p < 12; p++) {
    const candidates = LETTER_OPTIONS.map(parseNote).filter((n) => pc(n) === p);
    const scored = candidates
      .map((n) => {
        const notes = scaleNotes(n, id);
        return {
          n,
          double: notes.some((x) => Math.abs(x.acc) > 1) || Math.abs(n.acc) > 1,
          cost: notes.reduce((s, x) => s + Math.abs(x.acc), 0),
        };
      })
      .filter((c) => !c.double)
      .sort((a, b) => a.cost - b.cost || rank(a.n) - rank(b.n));
    // Candidates always include one without double accidentals for the 7-note scales we ship.
    out.push((scored[0] ?? { n: candidates[0] }).n);
  }
  rootsCache.set(id, out);
  return out;
}

/** Whether a pitch class (any octave) is a member of the key's scale. */
export function inKey(key: Key, pitchClass: number): boolean {
  return scalePitchClasses(key.root, key.mode).has(((pitchClass % 12) + 12) % 12);
}
