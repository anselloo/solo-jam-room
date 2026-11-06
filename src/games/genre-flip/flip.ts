import { GENRES, genreById, type Genre } from '../../audio/band/grooves';
import tuneData from '../../data/tunes.json';
import type { Rng } from '../../random/rng';
import type { Chord } from '../../theory/chords';
import { parseNote, pc } from '../../theory/notes';
import { keyRootsFor, type ScaleId } from '../../theory/scales';
import { vampProgression } from '../../theory/vamps';

/** A public-domain melody to play from memory in a different style. Titles only: no lyrics or notation. */
export interface Tune {
  id: string;
  title: string;
  origin: string;
  key: { root: string; mode: ScaleId };
  /** Must be true for every entry; a test fails the build otherwise. */
  publicDomain: true;
  source: string;
}

export const TUNES = tuneData as Tune[];

export const FLIP_MINUTES = 3;

export interface Flip {
  tune: Tune;
  genre: Genre;
  bpm: number;
  signature: string;
}

export function tuneKeyPc(tune: Tune): number {
  return pc(parseNote(tune.key.root));
}

/** "G major", "E minor" in the spelling that suits the mode. */
export function tuneKeyName(tune: Tune): string {
  const n = keyRootsFor(tune.key.mode)[tuneKeyPc(tune)];
  const acc = n.acc > 0 ? '♯'.repeat(n.acc) : '♭'.repeat(-n.acc);
  const mode = tune.key.mode === 'minor' ? 'minor' : tune.key.mode;
  return `${n.letter}${acc} ${mode}`;
}

/** Pick a tempo inside the genre's range, and the genre's own meter. */
export function flipFor(tune: Tune, genre: Genre, rng: Rng): Flip {
  return {
    tune,
    genre,
    bpm: rng.int(genre.tempo[0], genre.tempo[1]),
    signature: genre.meters[0] ?? '4/4',
  };
}

/** The backing loop for a flip: the genre's groove under a loop in the tune's key and mode. */
export function backingForFlip(flip: Flip, sevenths = false): Chord[] {
  const root = keyRootsFor(flip.tune.key.mode)[tuneKeyPc(flip.tune)];
  return vampProgression({ root, mode: flip.tune.key.mode }, sevenths);
}

export function genreFor(id: string): Genre {
  const g = genreById(id);
  if (!g) throw new Error(`Unknown genre ${id}`);
  return g;
}

export const ALL_GENRES = GENRES;
