import {
  type Note,
  type TranspositionKey,
  TRANSPOSITIONS,
  mod,
  noteName,
  parseDegree,
  pc,
  semitonesBetween,
  simplify,
  spellAbove,
  spellPc,
  transposeNote,
} from './notes';
import { type Key, type ScaleId, SCALES, scaleNotes } from './scales';

export type QualityId =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | 'maj6'
  | 'min6'
  | 'dom7'
  | 'maj7'
  | 'min7'
  | 'm7b5'
  | 'dim7'
  | 'mMaj7'
  | 'dom9'
  | 'maj9'
  | 'min9';

export interface QualityDef {
  id: QualityId;
  /** Suffix appended to the root name, e.g. "m7". */
  symbol: string;
  /** Spoken suffix for screen readers. */
  spoken: string;
  degrees: string;
}

export const QUALITIES: Record<QualityId, QualityDef> = {
  maj: { id: 'maj', symbol: '', spoken: 'major', degrees: '1 3 5' },
  min: { id: 'min', symbol: 'm', spoken: 'minor', degrees: '1 b3 5' },
  dim: { id: 'dim', symbol: '°', spoken: 'diminished', degrees: '1 b3 b5' },
  aug: { id: 'aug', symbol: '+', spoken: 'augmented', degrees: '1 3 #5' },
  sus2: { id: 'sus2', symbol: 'sus2', spoken: 'suspended 2', degrees: '1 2 5' },
  sus4: { id: 'sus4', symbol: 'sus4', spoken: 'suspended 4', degrees: '1 4 5' },
  maj6: { id: 'maj6', symbol: '6', spoken: 'major 6', degrees: '1 3 5 6' },
  min6: { id: 'min6', symbol: 'm6', spoken: 'minor 6', degrees: '1 b3 5 6' },
  dom7: { id: 'dom7', symbol: '7', spoken: 'dominant 7', degrees: '1 3 5 b7' },
  maj7: { id: 'maj7', symbol: 'maj7', spoken: 'major 7', degrees: '1 3 5 7' },
  min7: { id: 'min7', symbol: 'm7', spoken: 'minor 7', degrees: '1 b3 5 b7' },
  m7b5: { id: 'm7b5', symbol: 'm7♭5', spoken: 'minor 7 flat 5', degrees: '1 b3 b5 b7' },
  dim7: { id: 'dim7', symbol: '°7', spoken: 'diminished 7', degrees: '1 b3 b5 bb7' },
  mMaj7: { id: 'mMaj7', symbol: 'm(maj7)', spoken: 'minor major 7', degrees: '1 b3 5 7' },
  dom9: { id: 'dom9', symbol: '9', spoken: 'dominant 9', degrees: '1 3 5 b7 9' },
  maj9: { id: 'maj9', symbol: 'maj9', spoken: 'major 9', degrees: '1 3 5 7 9' },
  min9: { id: 'min9', symbol: 'm9', spoken: 'minor 9', degrees: '1 b3 5 b7 9' },
};

export interface Chord {
  root: Note;
  quality: QualityId;
}

/** Degree parser that also understands double flats ("bb7"). Same as parseDegree. */
function degreeOffsets(text: string) {
  return parseDegree(text);
}

/** Chord tones, spelled correctly for the root. */
export function chordNotes(chord: Chord): Note[] {
  return QUALITIES[chord.quality].degrees.split(' ').map((d) => {
    const { steps, semis } = degreeOffsets(d);
    return spellAbove(chord.root, steps, semis);
  });
}

export function chordSymbol(chord: Chord): string {
  return noteName(chord.root) + QUALITIES[chord.quality].symbol;
}

export function chordPitchClasses(chord: Chord): number[] {
  return chordNotes(chord).map(pc);
}

/** Semitone offsets above the root for each chord tone. */
export function chordIntervals(quality: QualityId): number[] {
  return QUALITIES[quality].degrees.split(' ').map((d) => degreeOffsets(d).semis);
}

// ---------------------------------------------------------------------------
// Diatonic chords derived from the scale, never hard-coded per key.
// ---------------------------------------------------------------------------

const TRIAD_BY_SEMIS: Record<string, QualityId> = {
  '4,7': 'maj',
  '3,7': 'min',
  '3,6': 'dim',
  '4,8': 'aug',
};
const SEVENTH_BY_SEMIS: Record<string, QualityId> = {
  '4,7,11': 'maj7',
  '4,7,10': 'dom7',
  '3,7,10': 'min7',
  '3,6,10': 'm7b5',
  '3,6,9': 'dim7',
  '3,7,11': 'mMaj7',
};

/** Stack thirds on one degree of a seven-note scale and name the resulting chord quality. */
export function diatonicQuality(mode: ScaleId, degree: number, sevenths = false): QualityId {
  if (!SCALES[mode].diatonic) throw new Error(`${mode} is not a seven-note scale`);
  const semis = SCALES[mode].degrees.split(' ').map((d) => parseDegree(d).semis);
  const at = (k: number) => mod(semis[(degree + k) % 7] - semis[degree % 7] + 12, 12);
  const stack = [at(2), at(4)];
  if (sevenths) stack.push(at(6));
  const table = sevenths ? SEVENTH_BY_SEMIS : TRIAD_BY_SEMIS;
  const q = table[stack.join(',')];
  if (!q) throw new Error(`No chord quality for ${mode} degree ${degree}: ${stack.join(',')}`);
  return q;
}

/** The seven diatonic chords of a key. */
export function diatonicChords(key: Key, sevenths = false): Chord[] {
  const notes = scaleNotes(key.root, key.mode);
  return notes.map((root, i) => ({ root, quality: diatonicQuality(key.mode, i, sevenths) }));
}

// ---------------------------------------------------------------------------
// Roman numerals
// ---------------------------------------------------------------------------

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface ParsedRoman {
  /** 0-based scale degree. */
  degree: number;
  /** Semitone alteration of the chord root relative to the scale degree. */
  accidental: number;
  quality: QualityId;
  /** Secondary target, e.g. the "V" in "V7/V". */
  of?: ParsedRoman;
  text: string;
}

const UPPER_SUFFIX: Record<string, QualityId> = {
  '': 'maj',
  '7': 'dom7',
  maj7: 'maj7',
  M7: 'maj7',
  '△7': 'maj7',
  '9': 'dom9',
  maj9: 'maj9',
  sus4: 'sus4',
  sus2: 'sus2',
  '6': 'maj6',
  '+': 'aug',
};
const LOWER_SUFFIX: Record<string, QualityId> = {
  '': 'min',
  '7': 'min7',
  '9': 'min9',
  '6': 'min6',
  '°': 'dim',
  dim: 'dim',
  '°7': 'dim7',
  dim7: 'dim7',
  ø: 'm7b5',
  ø7: 'm7b5',
  m7b5: 'm7b5',
  'm7♭5': 'm7b5',
  maj7: 'mMaj7',
};

/**
 * Parse a Roman numeral such as "ii", "V7", "bVII", "#iv°", "viiø7" or "V7/V".
 * Case selects major or minor; accidentals are relative to the key's own scale.
 */
export function parseRoman(text: string): ParsedRoman {
  const [main, target, ...rest] = text.trim().split('/');
  if (rest.length > 0) throw new Error(`Invalid Roman numeral: "${text}"`);
  const m = /^([b#♭♯]*)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(main);
  if (!m) throw new Error(`Invalid Roman numeral: "${text}"`);
  let accidental = 0;
  for (const ch of m[1]) accidental += ch === '#' || ch === '♯' ? 1 : -1;
  const upper = m[2] === m[2].toUpperCase();
  const degree = NUMERALS.indexOf(m[2].toUpperCase());
  const quality = (upper ? UPPER_SUFFIX : LOWER_SUFFIX)[m[3]];
  if (!quality) throw new Error(`Unknown chord suffix "${m[3]}" in "${text}"`);
  return { degree, accidental, quality, of: target ? parseRoman(target) : undefined, text };
}

/** Realize a Roman numeral in a key as a concrete, correctly spelled chord. */
export function realizeRoman(roman: string | ParsedRoman, key: Key): Chord {
  const parsed = typeof roman === 'string' ? parseRoman(roman) : roman;
  let scaleKey = key;
  if (parsed.of) {
    // Secondary function: treat the target degree as a temporary major tonic.
    const target = realizeRoman({ ...parsed.of, quality: 'maj' }, key);
    scaleKey = { root: target.root, mode: 'major' };
  }
  const degreeNote = scaleNotes(scaleKey.root, scaleKey.mode)[parsed.degree];
  const root = simplify(spellAbove(degreeNote, 0, parsed.accidental));
  return { root, quality: parsed.quality };
}

// ---------------------------------------------------------------------------
// Transposition and capo
// ---------------------------------------------------------------------------

/** Chord as written for a transposing instrument. */
export function toWrittenChord(chord: Chord, instrument: TranspositionKey): Chord {
  const t = TRANSPOSITIONS[instrument];
  return { ...chord, root: transposeNote(chord.root, t.steps, t.semis) };
}

/**
 * Open-chord shape to play with a capo so the sounding chord matches the concert chord.
 * Sounding = shape + capo frets, so the shape is the concert root lowered by `capo` semitones.
 */
export function capoShape(chord: Chord, capo: number): Chord {
  if (capo === 0) return chord;
  const flatKey = chord.root.acc < 0 || chord.root.letter === 'F';
  const p = mod(pc(chord.root) - capo, 12);
  // Prefer sharps for typical guitar shapes (G, D, A, E, C) except for flat-side roots.
  return { ...chord, root: spellPc(p, flatKey) };
}

/** Suggest the capo position (0-7) that makes the most chords playable with open shapes. */
export function bestCapo(chords: Chord[]): number {
  const OPEN = new Set([0, 2, 4, 7, 9]); // C D E G A pitch classes
  let best = 0;
  let bestScore = -1;
  for (let capo = 0; capo <= 7; capo++) {
    const score = chords.reduce((s, c) => {
      const p = mod(pc(c.root) - capo, 12);
      return s + (OPEN.has(p) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      best = capo;
      bestScore = score;
    }
  }
  return best;
}

/** Transpose a chord by a number of semitones, spelled with flats or sharps. */
export function transposeChordBySemitones(chord: Chord, semis: number, preferFlats = true): Chord {
  return { ...chord, root: spellPc(pc(chord.root) + semis, preferFlats) };
}

/** Distance in semitones between two chord roots, going up. */
export function rootMotion(a: Chord, b: Chord): number {
  return semitonesBetween(a.root, b.root);
}
