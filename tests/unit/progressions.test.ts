import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/random/rng';
import {
  DATA,
  challengeChange,
  deal,
  describeChord,
  familyOf,
  keyOf,
  modulateUp,
  poolFor,
  realizeDeal,
  redealChord,
  templatesFor,
  type Deal,
  type DealLength,
} from '../../src/games/progressions/deal';
import { chordNotes, chordSymbol, parseRoman, realizeRoman } from '../../src/theory/chords';
import { noteName, pc } from '../../src/theory/notes';
import { MODE_IDS, keyRootsFor, scalePitchClasses, type ScaleId } from '../../src/theory/scales';
import type { SkillLevel } from '../../src/state/profile';

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];
const LENGTHS: DealLength[] = [4, 8, 'blues'];
const lengthOf = (l: DealLength) => (l === 'blues' ? 12 : l);

describe('progression templates', () => {
  it('has templates for every mode, level and length, with the right number of bars', () => {
    for (const mode of MODE_IDS) {
      for (const level of LEVELS) {
        for (const length of LENGTHS) {
          const t = templatesFor(mode, level, length);
          expect(t.length, `${mode} ${level} ${length}`).toBeGreaterThan(0);
          for (const prog of t) expect(prog).toHaveLength(lengthOf(length));
        }
      }
    }
  });

  it('parses every numeral in every template and pool', () => {
    const all: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') all.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(DATA);
    expect(all.length).toBeGreaterThan(200);
    for (const r of all) expect(() => parseRoman(r), r).not.toThrow();
  });

  it('realizes every template in every key with readable chord roots', () => {
    for (const mode of MODE_IDS) {
      for (const level of LEVELS) {
        for (const length of LENGTHS) {
          for (let p = 0; p < 12; p++) {
            for (const romans of templatesFor(mode, level, length)) {
              const d: Deal = { keyPc: p, mode, level, length, romans };
              for (const chord of realizeDeal(d)) {
                // Players read the chord symbol, so its root must never need a double accidental.
                expect(Math.abs(chord.root.acc), chordSymbol(chord)).toBeLessThanOrEqual(1);
              }
            }
          }
        }
      }
    }
  });

  it('keeps beginner and modal templates diatonic to the key', () => {
    for (const mode of MODE_IDS) {
      for (let p = 0; p < 12; p++) {
        const scale = scalePitchClasses(keyRootsFor(mode)[p], mode);
        for (const length of [4, 8] as const) {
          for (const romans of templatesFor(mode, 'beginner', length)) {
            const d: Deal = { keyPc: p, mode, level: 'beginner', length, romans };
            for (const chord of realizeDeal(d)) {
              if (mode === 'minor' && romans.includes('V7')) continue;
              for (const n of chordNotes(chord)) {
                expect(
                  scale.has(pc(n)),
                  `${chordSymbol(chord)} in ${noteName(keyRootsFor(mode)[p])} ${mode}`,
                ).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it('uses triads for beginners', () => {
    for (const fam of ['major', 'minor'] as const) {
      for (const len of ['4', '8']) {
        for (const prog of DATA.templates[fam].beginner[len]) {
          for (const r of prog) expect(['maj', 'min', 'dim']).toContain(parseRoman(r).quality);
        }
      }
    }
  });

  it('includes ii-V-I and borrowed chords at intermediate, secondary dominants at advanced', () => {
    const flat = (lvl: SkillLevel) =>
      DATA.templates.major[lvl]['4'].flat().concat(DATA.templates.major[lvl]['8'].flat());
    expect(flat('intermediate')).toEqual(expect.arrayContaining(['ii7', 'V7', 'Imaj7', 'bVII']));
    expect(flat('advanced').some((r) => r.includes('/'))).toBe(true);
    expect(flat('advanced')).toContain('bII7');
  });

  it('realizes the example from the spec: B♭ major in F, F♯ in D', () => {
    const f = realizeRoman('IV', { root: keyRootsFor('major')[5], mode: 'major' });
    expect(chordSymbol(f)).toBe('B♭');
    const d = realizeRoman('iii', { root: keyRootsFor('major')[2], mode: 'major' });
    expect(chordSymbol(d)).toBe('F♯m');
  });
});

describe('dealing', () => {
  const settings = {
    keyPc: null,
    mode: null,
    level: 'intermediate' as const,
    length: 4 as DealLength,
  };

  it('rolls key and mode when not set, and respects them when set', () => {
    const rng = createRng(1);
    const keys = new Set<number>();
    const modes = new Set<ScaleId>();
    for (let i = 0; i < 200; i++) {
      const d = deal(settings, rng);
      keys.add(d.keyPc);
      modes.add(d.mode);
      expect(d.romans).toHaveLength(4);
    }
    expect(keys.size).toBe(12);
    expect(modes.size).toBe(7);
    const fixed = deal({ ...settings, keyPc: 7, mode: 'dorian' }, rng);
    expect(fixed.keyPc).toBe(7);
    expect(fixed.mode).toBe('dorian');
  });

  it('deals 8-chord and 12-bar blues forms', () => {
    const rng = createRng(2);
    expect(deal({ ...settings, mode: 'major', length: 8 }, rng).romans).toHaveLength(8);
    const blues = deal({ ...settings, mode: 'major', length: 'blues' }, rng);
    expect(blues.romans).toHaveLength(12);
    expect(blues.romans.slice(0, 4)).toEqual(['I7', 'IV7', 'I7', 'I7']);
  });

  it('is repeatable with the same seed', () => {
    const a = deal(settings, createRng(42));
    const b = deal(settings, createRng(42));
    expect(a).toEqual(b);
  });

  it('re-deals exactly one chord to something different', () => {
    const rng = createRng(3);
    const d = deal({ ...settings, mode: 'major', keyPc: 0 }, rng);
    for (let i = 0; i < 4; i++) {
      const next = redealChord(d, i, rng);
      expect(next.romans[i]).not.toBe(d.romans[i]);
      expect(next.romans.filter((_, j) => j !== i)).toEqual(d.romans.filter((_, j) => j !== i));
      expect(poolFor(d.mode, d.level)).toContain(next.romans[i]);
    }
  });

  it('modulates up a step and wraps around', () => {
    const d: Deal = {
      keyPc: 10,
      mode: 'major',
      level: 'beginner',
      length: 4,
      romans: ['I', 'IV', 'V', 'I'],
    };
    const up = modulateUp(d);
    expect(up.keyPc).toBe(0);
    expect(up.romans).toEqual(d.romans);
    expect(chordSymbol(realizeDeal(up)[0])).toBe('C');
  });

  it('Changes Challenge either swaps one chord or modulates', () => {
    const rng = createRng(4);
    const d = deal({ ...settings, mode: 'major', keyPc: 0 }, rng);
    const kinds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const c = challengeChange(d, rng);
      kinds.add(c.kind);
      if (c.kind === 'key') expect(c.deal.keyPc).toBe(2);
      else {
        expect(c.index).toBeGreaterThanOrEqual(0);
        expect(c.deal.romans.filter((r, j) => r !== d.romans[j])).toHaveLength(1);
      }
    }
    expect(kinds).toEqual(new Set(['chord', 'key']));
  });

  it('maps modes to template families', () => {
    expect(familyOf('major')).toBe('major');
    expect(familyOf('blues')).toBe('minor');
    expect(familyOf('dorian')).toBe('modal');
    expect(keyOf({ keyPc: 6, mode: 'major' }).root).toEqual({ letter: 'F', acc: 1 });
  });
});

describe('chord display', () => {
  const key = { root: keyRootsFor('major')[10], mode: 'major' as const }; // B♭
  const chord = realizeRoman('V7', key); // F7

  it('shows concert names by default', () => {
    const d = describeChord(chord, 'V7', { transposition: 'C', capo: 0 });
    expect(d.name).toBe('F7');
    expect(d.concert).toBeUndefined();
    expect(d.roman).toBe('V7');
    expect(d.spoken).toBe('F dominant 7');
  });

  it('shows written pitch for B♭, E♭ and F instruments', () => {
    expect(describeChord(chord, 'V7', { transposition: 'Bb', capo: 0 })).toMatchObject({
      name: 'G7',
      concert: 'F7',
    });
    expect(describeChord(chord, 'V7', { transposition: 'Eb', capo: 0 }).name).toBe('D7');
    expect(describeChord(chord, 'V7', { transposition: 'F', capo: 0 }).name).toBe('C7');
  });

  it('shows capo shapes relative to the capo position', () => {
    const bb = realizeRoman('I', key);
    expect(describeChord(bb, 'I', { transposition: 'C', capo: 1 })).toMatchObject({
      name: 'A',
      concert: 'B♭',
    });
    expect(describeChord(bb, 'I', { transposition: 'C', capo: 3 }).name).toBe('G');
  });
});
