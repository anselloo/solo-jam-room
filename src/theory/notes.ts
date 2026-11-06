/** Pitch classes, key-aware enharmonic spelling and intervals. Pure TypeScript, no DOM. */

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A spelled note: a letter plus an accidental count (-2 double flat ... +2 double sharp). */
export interface Note {
  letter: Letter;
  acc: number;
}

/** Semitones of the major scale above the tonic for each letter step (0-based). */
export const MAJOR_SEMIS: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

export const mod = (n: number, m: number): number => ((n % m) + m) % m;

export function note(letter: Letter, acc = 0): Note {
  return { letter, acc };
}

/** Pitch class 0-11 of a spelled note (C = 0). */
export function pc(n: Note): number {
  return mod(LETTER_PC[n.letter] + n.acc, 12);
}

export function sameNote(a: Note, b: Note): boolean {
  return a.letter === b.letter && a.acc === b.acc;
}

/** Parse "F#", "Bb", "B♭", "C♯", "Ebb". Throws on invalid input. */
export function parseNote(text: string): Note {
  const m = /^([A-Ga-g])([#♯b♭]*)$/.exec(text.trim());
  if (!m) throw new Error(`Invalid note: "${text}"`);
  let acc = 0;
  for (const ch of m[2]) acc += ch === '#' || ch === '♯' ? 1 : -1;
  return { letter: m[1].toUpperCase() as Letter, acc };
}

/** Display name using proper symbols, e.g. "B♭" or "F♯". */
export function noteName(n: Note): string {
  return n.letter + (n.acc > 0 ? '♯'.repeat(n.acc) : '♭'.repeat(-n.acc));
}

/** Spoken label for screen readers, e.g. "B flat". */
export function noteLabel(n: Note): string {
  const word = ['', 'sharp', 'double sharp'];
  const flat = ['', 'flat', 'double flat'];
  const a = Math.abs(n.acc);
  if (a === 0) return n.letter;
  return `${n.letter} ${(n.acc > 0 ? word : flat)[a] ?? (n.acc > 0 ? 'sharp' : 'flat')}`;
}

/**
 * Spell the note a given number of letter steps and semitones above `root`.
 * `steps` is generic interval size minus one (third = 2), which is what keeps spelling
 * correct: B♭ major in F, F♯ in D major, never A♯ or G♭.
 */
export function spellAbove(root: Note, steps: number, semis: number): Note {
  const letter = LETTERS[mod(LETTERS.indexOf(root.letter) + steps, 7)];
  const target = mod(pc(root) + semis, 12);
  const acc = mod(target - LETTER_PC[letter] + 6, 12) - 6;
  return { letter, acc };
}

/**
 * Parse a degree such as "1", "b3", "#4", "9", "b13" into letter steps and semitones above
 * the tonic. Compound degrees (9, 11, 13) map to the same letter as 2, 4, 6.
 */
export function parseDegree(text: string): { steps: number; semis: number } {
  const m = /^([#b]*)(\d+)$/.exec(text);
  if (!m) throw new Error(`Invalid degree: "${text}"`);
  const n = Number(m[2]);
  if (n < 1) throw new Error(`Invalid degree: "${text}"`);
  const steps = (n - 1) % 7;
  let semis = MAJOR_SEMIS[steps] + (n > 7 ? 12 : 0);
  for (const ch of m[1]) semis += ch === '#' ? 1 : -1;
  return { steps, semis };
}

const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** Spell a bare pitch class with the simplest name (no double accidentals). */
export function spellPc(pitchClass: number, preferFlats = true): Note {
  const p = mod(pitchClass, 12);
  return parseNote((preferFlats ? FLAT_NAMES : SHARP_NAMES)[p]);
}

/** Re-spell a note with more than one accidental to a simpler enharmonic equivalent. */
export function simplify(n: Note): Note {
  return Math.abs(n.acc) <= 1 ? n : spellPc(pc(n), n.acc < 0);
}

/** Transpose by a named interval (letter steps + semitones), simplifying double accidentals. */
export function transposeNote(n: Note, steps: number, semis: number): Note {
  return simplify(spellAbove(n, steps, semis));
}

/** Semitone distance going up from `a` to `b`, 0-11. */
export function semitonesBetween(a: Note, b: Note): number {
  return mod(pc(b) - pc(a), 12);
}

export const INTERVAL_NAMES = [
  'unison',
  'minor 2nd',
  'major 2nd',
  'minor 3rd',
  'major 3rd',
  'perfect 4th',
  'tritone',
  'perfect 5th',
  'minor 6th',
  'major 6th',
  'minor 7th',
  'major 7th',
] as const;

export function intervalName(semis: number): string {
  return INTERVAL_NAMES[mod(semis, 12)];
}

/** Transposing-instrument key. The interval is the written-pitch offset above concert pitch. */
export type TranspositionKey = 'C' | 'Bb' | 'Eb' | 'F';

export const TRANSPOSITIONS: Record<
  TranspositionKey,
  { steps: number; semis: number; label: string }
> = {
  C: { steps: 0, semis: 0, label: 'Concert pitch (C)' },
  Bb: { steps: 1, semis: 2, label: 'B♭ instrument' },
  Eb: { steps: 5, semis: 9, label: 'E♭ instrument' },
  F: { steps: 4, semis: 7, label: 'F instrument' },
};

export function toWrittenPitch(concert: Note, key: TranspositionKey): Note {
  const t = TRANSPOSITIONS[key];
  return transposeNote(concert, t.steps, t.semis);
}

/** Frequency in Hz for a MIDI note number (A4 = 69 = 440 Hz). */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** MIDI note number for a pitch class in a given octave (C4 = 60). */
export function midiOf(pitchClass: number, octave: number): number {
  return 12 * (octave + 1) + mod(pitchClass, 12);
}
