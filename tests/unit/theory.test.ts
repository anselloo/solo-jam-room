import { describe, expect, it } from 'vitest';
import {
  intervalName,
  midiOf,
  midiToFreq,
  noteLabel,
  noteName,
  parseDegree,
  parseNote,
  pc,
  sameNote,
  semitonesBetween,
  simplify,
  spellAbove,
  spellPc,
  toWrittenPitch,
} from '../../src/theory/notes';
import {
  MODE_IDS,
  inKey,
  keyRootsFor,
  scaleNoteNames,
  scaleNotes,
  scalePitchClasses,
  scaleSemis,
  type ScaleId,
} from '../../src/theory/scales';
import {
  bestCapo,
  capoShape,
  chordIntervals,
  chordNotes,
  chordPitchClasses,
  chordSymbol,
  diatonicChords,
  diatonicQuality,
  parseRoman,
  realizeRoman,
  rootMotion,
  toWrittenChord,
  transposeChordBySemitones,
  type Chord,
} from '../../src/theory/chords';

const n = parseNote;
const names = (root: string, mode: ScaleId) => scaleNoteNames(n(root), mode).join(' ');
const sym = (c: Chord) => chordSymbol(c);

describe('notes', () => {
  it('parses and prints notes with proper symbols', () => {
    expect(noteName(n('Bb'))).toBe('B♭');
    expect(noteName(n('F#'))).toBe('F♯');
    expect(noteName(n('c♯'))).toBe('C♯');
    expect(noteName(n('Ebb'))).toBe('E♭♭');
    expect(() => parseNote('H')).toThrow();
    expect(() => parseNote('')).toThrow();
  });
  it('computes pitch classes and equality', () => {
    expect(pc(n('C'))).toBe(0);
    expect(pc(n('B#'))).toBe(0);
    expect(pc(n('Cb'))).toBe(11);
    expect(sameNote(n('A#'), n('A#'))).toBe(true);
    expect(sameNote(n('A#'), n('Bb'))).toBe(false);
  });
  it('gives accessible labels', () => {
    expect(noteLabel(n('Bb'))).toBe('B flat');
    expect(noteLabel(n('F#'))).toBe('F sharp');
    expect(noteLabel(n('Ebb'))).toBe('E double flat');
    expect(noteLabel(n('G'))).toBe('G');
  });
  it('spells by letter step, not by sharps/flats preference', () => {
    expect(noteName(spellAbove(n('D'), 2, 4))).toBe('F♯');
    expect(noteName(spellAbove(n('F'), 3, 5))).toBe('B♭');
    expect(noteName(spellAbove(n('C'), 4, 7))).toBe('G');
  });
  it('parses degrees including compound ones', () => {
    expect(parseDegree('1')).toEqual({ steps: 0, semis: 0 });
    expect(parseDegree('b3')).toEqual({ steps: 2, semis: 3 });
    expect(parseDegree('#4')).toEqual({ steps: 3, semis: 6 });
    expect(parseDegree('9')).toEqual({ steps: 1, semis: 14 });
    expect(parseDegree('bb7')).toEqual({ steps: 6, semis: 9 });
    expect(() => parseDegree('x')).toThrow();
    expect(() => parseDegree('0')).toThrow();
  });
  it('spells bare pitch classes and simplifies double accidentals', () => {
    expect(noteName(spellPc(1))).toBe('D♭');
    expect(noteName(spellPc(1, false))).toBe('C♯');
    expect(noteName(spellPc(-1))).toBe('B');
    expect(noteName(simplify(n('Ebb')))).toBe('D');
    expect(noteName(simplify(n('F##')))).toBe('G');
    expect(noteName(simplify(n('Bb')))).toBe('B♭');
  });
  it('measures intervals', () => {
    expect(semitonesBetween(n('C'), n('G'))).toBe(7);
    expect(semitonesBetween(n('G'), n('C'))).toBe(5);
    expect(intervalName(7)).toBe('perfect 5th');
    expect(intervalName(-1)).toBe('major 7th');
  });
  it('converts MIDI to frequency', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1);
    expect(midiOf(0, 4)).toBe(60);
    expect(midiOf(9, 4)).toBe(69);
  });
  it('writes concert pitch for transposing instruments', () => {
    expect(noteName(toWrittenPitch(n('Bb'), 'Bb'))).toBe('C');
    expect(noteName(toWrittenPitch(n('F'), 'Bb'))).toBe('G');
    expect(noteName(toWrittenPitch(n('Eb'), 'Eb'))).toBe('C');
    expect(noteName(toWrittenPitch(n('G'), 'Eb'))).toBe('E');
    expect(noteName(toWrittenPitch(n('C'), 'F'))).toBe('G');
    expect(noteName(toWrittenPitch(n('Bb'), 'F'))).toBe('F');
    expect(noteName(toWrittenPitch(n('D'), 'C'))).toBe('D');
  });
});

describe('scales', () => {
  const MAJORS: Record<string, string> = {
    C: 'C D E F G A B',
    'D♭': 'D♭ E♭ F G♭ A♭ B♭ C',
    D: 'D E F♯ G A B C♯',
    'E♭': 'E♭ F G A♭ B♭ C D',
    E: 'E F♯ G♯ A B C♯ D♯',
    F: 'F G A B♭ C D E',
    'F♯': 'F♯ G♯ A♯ B C♯ D♯ E♯',
    G: 'G A B C D E F♯',
    'A♭': 'A♭ B♭ C D♭ E♭ F G',
    A: 'A B C♯ D E F♯ G♯',
    'B♭': 'B♭ C D E♭ F G A',
    B: 'B C♯ D♯ E F♯ G♯ A♯',
  };
  const MINORS: Record<string, string> = {
    C: 'C D E♭ F G A♭ B♭',
    'C♯': 'C♯ D♯ E F♯ G♯ A B',
    D: 'D E F G A B♭ C',
    'E♭': 'E♭ F G♭ A♭ B♭ C♭ D♭',
    E: 'E F♯ G A B C D',
    F: 'F G A♭ B♭ C D♭ E♭',
    'F♯': 'F♯ G♯ A B C♯ D E',
    G: 'G A B♭ C D E♭ F',
    'G♯': 'G♯ A♯ B C♯ D♯ E F♯',
    A: 'A B C D E F G',
    'B♭': 'B♭ C D♭ E♭ F G♭ A♭',
    B: 'B C♯ D E F♯ G A',
  };
  it.each(Object.entries(MAJORS))('spells %s major', (root, expected) => {
    expect(names(root, 'major')).toBe(expected);
  });
  it.each(Object.entries(MINORS))('spells %s natural minor', (root, expected) => {
    expect(names(root, 'minor')).toBe(expected);
  });
  it('spells the modes correctly', () => {
    expect(names('D', 'dorian')).toBe('D E F G A B C');
    expect(names('E', 'phrygian')).toBe('E F G A B C D');
    expect(names('F', 'lydian')).toBe('F G A B C D E');
    expect(names('G', 'mixolydian')).toBe('G A B C D E F');
    expect(names('B', 'locrian')).toBe('B C D E F G A');
    expect(names('E♭', 'mixolydian')).toBe('E♭ F G A♭ B♭ C D♭');
    expect(names('F♯', 'dorian')).toBe('F♯ G♯ A B C♯ D♯ E');
  });
  it('spells pentatonic and blues scales', () => {
    expect(names('A', 'minorPentatonic')).toBe('A C D E G');
    expect(names('C', 'majorPentatonic')).toBe('C D E G A');
    expect(names('A', 'blues')).toBe('A C D E♭ E G');
  });
  it('uses each letter once in every 7-note scale for the best-spelled roots', () => {
    for (const mode of MODE_IDS) {
      for (const root of keyRootsFor(mode)) {
        const notes = scaleNotes(root, mode);
        expect(new Set(notes.map((x) => x.letter)).size).toBe(7);
        expect(notes.every((x) => Math.abs(x.acc) <= 1)).toBe(true);
      }
    }
  });
  it('chooses conventional key names', () => {
    expect(keyRootsFor('major').map(noteName)).toEqual(Object.keys(MAJORS).sort(byPc('major')));
    expect(keyRootsFor('minor').map(noteName)).toEqual(Object.keys(MINORS).sort(byPc('minor')));
  });
  it('exposes semitones and pitch-class membership', () => {
    expect(scaleSemis('minor')).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(scalePitchClasses(n('C'), 'major').size).toBe(7);
    expect(inKey({ root: n('C'), mode: 'major' }, 4)).toBe(true);
    expect(inKey({ root: n('C'), mode: 'major' }, 1)).toBe(false);
    expect(inKey({ root: n('C'), mode: 'major' }, -1)).toBe(true);
  });
});

function byPc(mode: ScaleId) {
  const roots = keyRootsFor(mode).map(noteName);
  return (a: string, b: string) => roots.indexOf(a) - roots.indexOf(b);
}

describe('chords', () => {
  const triads = (root: string, mode: ScaleId) =>
    diatonicChords({ root: n(root), mode })
      .map(sym)
      .join(' ');

  it('derives diatonic triads from the mode', () => {
    expect(triads('C', 'major')).toBe('C Dm Em F G Am B°');
    expect(triads('A', 'minor')).toBe('Am B° C Dm Em F G');
    expect(triads('D', 'dorian')).toBe('Dm Em F G Am B° C');
    expect(triads('G', 'mixolydian')).toBe('G Am B° C Dm Em F');
    expect(triads('F', 'lydian')).toBe('F G Am B° C Dm Em');
    expect(triads('E', 'phrygian')).toBe('Em F G Am B° C Dm');
    expect(triads('B', 'locrian')).toBe('B° C Dm Em F G Am');
  });
  it('derives diatonic seventh chords', () => {
    const sevenths = diatonicChords({ root: n('C'), mode: 'major' }, true).map(sym);
    expect(sevenths).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
  });
  it('rejects non-diatonic scales', () => {
    expect(() => diatonicQuality('blues', 0)).toThrow();
  });

  const MAJOR_ROOTS = keyRootsFor('major');
  const MINOR_ROOTS = keyRootsFor('minor');
  const EXPECT_MAJOR_TRIADS: Record<string, string> = {
    C: 'C Dm Em F G Am B°',
    'D♭': 'D♭ E♭m Fm G♭ A♭ B♭m C°',
    D: 'D Em F♯m G A Bm C♯°',
    'E♭': 'E♭ Fm Gm A♭ B♭ Cm D°',
    E: 'E F♯m G♯m A B C♯m D♯°',
    F: 'F Gm Am B♭ C Dm E°',
    'F♯': 'F♯ G♯m A♯m B C♯ D♯m E♯°',
    G: 'G Am Bm C D Em F♯°',
    'A♭': 'A♭ B♭m Cm D♭ E♭ Fm G°',
    A: 'A Bm C♯m D E F♯m G♯°',
    'B♭': 'B♭ Cm Dm E♭ F Gm A°',
    B: 'B C♯m D♯m E F♯ G♯m A♯°',
  };
  it('spells chords in all 12 major keys', () => {
    for (const root of MAJOR_ROOTS) {
      expect(triads(noteName(root), 'major')).toBe(EXPECT_MAJOR_TRIADS[noteName(root)]);
    }
  });
  it('spells chords in all 12 minor keys', () => {
    const expected: Record<string, string> = {
      C: 'Cm D° E♭ Fm Gm A♭ B♭',
      'C♯': 'C♯m D♯° E F♯m G♯m A B',
      D: 'Dm E° F Gm Am B♭ C',
      'E♭': 'E♭m F° G♭ A♭m B♭m C♭ D♭',
      E: 'Em F♯° G Am Bm C D',
      F: 'Fm G° A♭ B♭m Cm D♭ E♭',
      'F♯': 'F♯m G♯° A Bm C♯m D E',
      G: 'Gm A° B♭ Cm Dm E♭ F',
      'G♯': 'G♯m A♯° B C♯m D♯m E F♯',
      A: 'Am B° C Dm Em F G',
      'B♭': 'B♭m C° D♭ E♭m Fm G♭ A♭',
      B: 'Bm C♯° D Em F♯m G A',
    };
    expect(MINOR_ROOTS.length).toBe(12);
    for (const root of MINOR_ROOTS) {
      expect(triads(noteName(root), 'minor')).toBe(expected[noteName(root)]);
    }
  });
  it('spells Dorian and Mixolydian chords in every key without double accidentals', () => {
    for (const mode of ['dorian', 'mixolydian'] as const) {
      for (const root of keyRootsFor(mode)) {
        const chords = diatonicChords({ root, mode }, true);
        for (const c of chords) {
          expect(chordNotes(c).every((x) => Math.abs(x.acc) <= 1)).toBe(true);
        }
      }
    }
    expect(triads('E♭', 'dorian')).toBe('E♭m Fm G♭ A♭ B♭m C° D♭');
    expect(triads('B♭', 'mixolydian')).toBe('B♭ Cm D° E♭ Fm Gm A♭');
  });
  it('builds chord tones and pitch classes', () => {
    const g7: Chord = { root: n('G'), quality: 'dom7' };
    expect(chordNotes(g7).map(noteName)).toEqual(['G', 'B', 'D', 'F']);
    expect(chordPitchClasses(g7)).toEqual([7, 11, 2, 5]);
    expect(chordIntervals('maj7')).toEqual([0, 4, 7, 11]);
    expect(chordNotes({ root: n('C'), quality: 'dom9' }).map(noteName)).toEqual([
      'C',
      'E',
      'G',
      'B♭',
      'D',
    ]);
    expect(chordNotes({ root: n('B♭'), quality: 'dim7' }).map(noteName)).toEqual([
      'B♭',
      'D♭',
      'F♭',
      'A♭♭',
    ]);
  });
  it('transposes by semitones and measures root motion', () => {
    const c: Chord = { root: n('C'), quality: 'min7' };
    expect(sym(transposeChordBySemitones(c, 1))).toBe('D♭m7');
    expect(sym(transposeChordBySemitones(c, 1, false))).toBe('C♯m7');
    expect(rootMotion(c, { root: n('F'), quality: 'dom7' })).toBe(5);
  });
});

describe('roman numerals', () => {
  const real = (r: string, root: string, mode: ScaleId = 'major') =>
    sym(realizeRoman(r, { root: n(root), mode }));

  it('realizes common progressions', () => {
    expect(['I', 'IV', 'V', 'vi'].map((r) => real(r, 'G')).join(' ')).toBe('G C D Em');
    expect(['ii7', 'V7', 'Imaj7'].map((r) => real(r, 'B♭')).join(' ')).toBe('Cm7 F7 B♭maj7');
    expect(
      ['i', 'bVI', 'bVII', 'i'].map((r) => real(r.replace('b', ''), 'A', 'minor')).join(' '),
    ).toBe('Am F G Am');
  });
  it('handles borrowed chords and accidentals', () => {
    expect(real('bVII', 'C')).toBe('B♭');
    expect(real('bVI', 'C')).toBe('A♭');
    expect(real('iv', 'C')).toBe('Fm');
    expect(real('#iv°', 'C')).toBe('F♯°');
    expect(real('bII7', 'C')).toBe('D♭7');
    expect(real('viiø7', 'C')).toBe('Bm7♭5');
  });
  it('handles secondary dominants', () => {
    expect(real('V7/V', 'C')).toBe('D7');
    expect(real('V7/ii', 'C')).toBe('A7');
    expect(real('V7/vi', 'C')).toBe('E7');
    expect(real('vii°7/V', 'C')).toBe('F♯°7');
    expect(real('V7/V', 'F')).toBe('G7');
    expect(real('V7/IV', 'A')).toBe('A7');
  });
  it('realizes in modes using the mode scale', () => {
    expect(real('i7', 'D', 'dorian')).toBe('Dm7');
    expect(real('IV7', 'D', 'dorian')).toBe('G7');
    expect(real('bVII', 'G', 'mixolydian').length).toBeGreaterThan(0);
    expect(real('I7', 'G', 'mixolydian')).toBe('G7');
  });
  it('parses numerals into parts and rejects bad input', () => {
    const p = parseRoman('bVII7');
    expect(p).toMatchObject({ degree: 6, accidental: -1, quality: 'dom7' });
    expect(parseRoman('V7/V').of?.degree).toBe(4);
    expect(() => parseRoman('X')).toThrow();
    expect(() => parseRoman('Vfoo')).toThrow();
    expect(() => parseRoman('V/V/V')).toThrow();
  });
  it('accepts pre-parsed numerals', () => {
    expect(sym(realizeRoman(parseRoman('V'), { root: n('D'), mode: 'major' }))).toBe('A');
  });
});

describe('transposition and capo', () => {
  const c = (root: string, quality: Chord['quality'] = 'maj'): Chord => ({
    root: n(root),
    quality,
  });
  it('writes chords for B♭, E♭ and F instruments', () => {
    expect(sym(toWrittenChord(c('B♭'), 'Bb'))).toBe('C');
    expect(sym(toWrittenChord(c('F', 'dom7'), 'Bb'))).toBe('G7');
    expect(sym(toWrittenChord(c('E♭', 'maj7'), 'Eb'))).toBe('Cmaj7');
    expect(sym(toWrittenChord(c('A', 'min7'), 'Eb'))).toBe('F♯m7');
    expect(sym(toWrittenChord(c('C'), 'F'))).toBe('G');
    expect(sym(toWrittenChord(c('F'), 'F'))).toBe('C');
    expect(sym(toWrittenChord(c('G', 'min'), 'C'))).toBe('Gm');
  });
  it('avoids double accidentals when writing for transposing instruments', () => {
    for (const key of ['Bb', 'Eb', 'F'] as const) {
      for (const root of keyRootsFor('major')) {
        const w = toWrittenChord({ root, quality: 'maj' }, key);
        expect(Math.abs(w.root.acc)).toBeLessThanOrEqual(1);
      }
    }
  });
  it('gives capo shapes', () => {
    expect(sym(capoShape(c('A'), 2))).toBe('G');
    expect(sym(capoShape(c('B', 'min'), 2))).toBe('Am');
    expect(sym(capoShape(c('E'), 0))).toBe('E');
    expect(sym(capoShape(c('F'), 1))).toBe('E');
  });
  it('suggests a capo that makes chords open-friendly', () => {
    expect(bestCapo([c('B♭'), c('E♭'), c('F'), c('G', 'min')])).toBe(3);
    expect(bestCapo([c('G'), c('C'), c('D')])).toBe(0);
  });
});
