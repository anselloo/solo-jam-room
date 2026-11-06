import { chordIntervals, type Chord } from '../../theory/chords';
import { pc } from '../../theory/notes';
import type { BassToken } from './grooves';

/** MIDI number of the chord root in the bass register (C2 = 36 .. B2 = 47). */
export function bassRootMidi(chord: Chord): number {
  return 36 + pc(chord.root);
}

/** The MIDI note a bass token means over a chord. */
export function bassNote(chord: Chord, token: BassToken): number {
  const root = bassRootMidi(chord);
  switch (token) {
    case 'f':
      return root + 7;
    case 'o':
      return root + 12;
    case 't':
      return root + (chordIntervals(chord.quality)[1] ?? 4);
    default:
      return root;
  }
}

/**
 * Close-position chord voicing in the C3-C5 range, kept near middle C so successive chords
 * move smoothly instead of leaping.
 */
export function padVoicing(chord: Chord): number[] {
  const rootPc = pc(chord.root);
  // Root between G3 (55) and F#4 (66).
  const root = 55 + ((rootPc - 55 + 1200) % 12);
  return chordIntervals(chord.quality).map((i) => root + i);
}

/** The chord sounding in a given bar, looping through the progression. */
export function chordAtBar(progression: readonly Chord[], bar: number, barsPerChord = 1): Chord {
  if (progression.length === 0) throw new Error('Progression is empty');
  const index = Math.floor(Math.max(0, bar) / barsPerChord) % progression.length;
  return progression[index];
}
