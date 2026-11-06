import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/random/rng';
import { CARDS } from '../../src/games/constraints/deck';
import {
  DIFFICULTY,
  NO_LOCKS,
  REELS,
  backingFor,
  describeResult,
  genresFor,
  keyName,
  keyNote,
  pickTempo,
  scaleNotesOf,
  signatureOf,
  spin,
  type Locks,
  type ReelId,
  type RouletteResult,
  type SpinOptions,
} from '../../src/games/roulette/roulette';
import { GENRES, genreById } from '../../src/audio/band/grooves';
import { chordNotes } from '../../src/theory/chords';
import { pc } from '../../src/theory/notes';
import { MODE_IDS, scalePitchClasses } from '../../src/theory/scales';
import { vampProgression } from '../../src/theory/vamps';
import type { SkillLevel } from '../../src/state/profile';

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];
const opts = (level: SkillLevel, wildcardOn = true): SpinOptions => ({
  level,
  wildcardOn,
  wildcardPool: CARDS,
});

describe('difficulty limits', () => {
  it.each(LEVELS)('keeps every %s spin inside its limits', (level) => {
    const cfg = DIFFICULTY[level];
    const rng = createRng(level);
    for (let i = 0; i < 600; i++) {
      const r = spin(null, NO_LOCKS, opts(level), rng);
      expect(cfg.keys).toContain(r.keyPc);
      expect(cfg.modes).toContain(r.mode);
      expect(cfg.signatures).toContain(r.signature);
      expect(r.bpm).toBeGreaterThanOrEqual(cfg.bpm[0]);
      expect(r.bpm).toBeLessThanOrEqual(cfg.bpm[1]);
      expect(genreById(r.genre)).toBeDefined();
    }
  });

  it('matches the spec for beginners', () => {
    const b = DIFFICULTY.beginner;
    expect(b.modes).toEqual(['major', 'minor']);
    expect(b.signatures).toEqual(['4/4']);
    expect(b.bpm).toEqual([70, 110]);
    expect(b.keys.map((k) => k).sort((x, y) => x - y)).toEqual([0, 2, 4, 7, 9]);
  });

  it('matches the spec for intermediate and advanced', () => {
    expect(DIFFICULTY.intermediate.modes).toEqual(expect.arrayContaining(['dorian', 'mixolydian']));
    expect(DIFFICULTY.intermediate.signatures).toEqual(['4/4', '3/4', '6/8']);
    expect(DIFFICULTY.intermediate.keys).toHaveLength(12);
    expect(DIFFICULTY.advanced.modes).toHaveLength(7);
    expect(DIFFICULTY.advanced.signatures).toEqual(expect.arrayContaining(['5/4', '7/8']));
    expect(DIFFICULTY.advanced.bpm).toEqual([50, 180]);
  });

  it('eventually shows odd meters and every mode on advanced', () => {
    const rng = createRng(3);
    const seen = new Set<string>();
    const modes = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const r = spin(null, NO_LOCKS, opts('advanced'), rng);
      seen.add(r.signature);
      modes.add(r.mode);
    }
    expect(seen).toEqual(new Set(['4/4', '3/4', '6/8', '5/4', '7/8']));
    expect(modes.size).toBe(7);
  });
});

describe('locks', () => {
  it('never change a locked reel', () => {
    const rng = createRng(99);
    for (const reel of REELS) {
      const first = spin(null, NO_LOCKS, opts('advanced'), rng);
      const locks: Locks = { ...NO_LOCKS, [reel]: true };
      let prev = first;
      for (let i = 0; i < 100; i++) {
        prev = spin(prev, locks, opts('advanced'), rng);
        const field: Record<ReelId, keyof RouletteResult> = {
          key: 'keyPc',
          mode: 'mode',
          tempo: 'bpm',
          signature: 'signature',
          groove: 'genre',
          wildcard: 'wildcard',
        };
        expect(prev[field[reel]]).toEqual(first[field[reel]]);
      }
    }
  });

  it('lets unlocked reels change', () => {
    const rng = createRng(5);
    const first = spin(null, NO_LOCKS, opts('advanced'), rng);
    const locks: Locks = { ...NO_LOCKS, key: true, mode: true, signature: true };
    const bpms = new Set<number>();
    let prev = first;
    for (let i = 0; i < 40; i++) {
      prev = spin(prev, locks, opts('advanced'), rng);
      bpms.add(prev.bpm);
    }
    expect(bpms.size).toBeGreaterThan(5);
  });

  it('ignores locks when there is no previous result', () => {
    const r = spin(null, { ...NO_LOCKS, key: true }, opts('beginner'), createRng(1));
    expect(r.keyPc).toBeGreaterThanOrEqual(0);
  });

  it('respells a locked key when the mode changes', () => {
    const base: RouletteResult = {
      keyPc: 3,
      mode: 'major',
      bpm: 100,
      signature: '4/4',
      genre: 'rock',
      wildcard: null,
    };
    expect(keyName(base)).toBe('E♭');
    expect(keyName({ ...base, mode: 'minor' })).toBe('E♭');
    expect(keyName({ ...base, keyPc: 1, mode: 'minor' })).toBe('C♯');
    expect(keyName({ ...base, keyPc: 1, mode: 'major' })).toBe('D♭');
  });
});

describe('wildcard', () => {
  it('is off when disabled and drawn from the pool when enabled', () => {
    const rng = createRng(2);
    expect(spin(null, NO_LOCKS, opts('beginner', false), rng).wildcard).toBeNull();
    const r = spin(null, NO_LOCKS, opts('beginner', true), rng);
    expect(CARDS).toContain(r.wildcard);
    expect(
      spin(null, NO_LOCKS, { level: 'beginner', wildcardOn: true, wildcardPool: [] }, rng).wildcard,
    ).toBeNull();
  });
});

describe('tempo and groove', () => {
  it('picks tempos that suit the genre when the ranges overlap', () => {
    const rng = createRng(8);
    const punk = genreById('punk')!;
    for (let i = 0; i < 100; i++) {
      const bpm = pickTempo(rng, DIFFICULTY.advanced, punk);
      expect(bpm).toBeGreaterThanOrEqual(150);
      expect(bpm).toBeLessThanOrEqual(180);
    }
    // No overlap with beginner's range: falls back to the difficulty range.
    const b = pickTempo(rng, DIFFICULTY.beginner, punk);
    expect(b).toBeGreaterThanOrEqual(70);
    expect(b).toBeLessThanOrEqual(110);
    expect(pickTempo(rng, DIFFICULTY.beginner, undefined)).toBeGreaterThanOrEqual(70);
  });
  it('prefers genres native to the meter', () => {
    expect(genresFor('3/4').map((g) => g.id)).toEqual(['waltz']);
    expect(genresFor('6/8').map((g) => g.id)).toContain('shanty');
    expect(genresFor('7/8')).toEqual(GENRES);
  });
  it('resolves signatures', () => {
    expect(signatureOf('7/8')).toEqual({ beats: 7, unit: 8 });
  });
});

describe('backing progression', () => {
  it('always fits the selected key and mode', () => {
    for (const mode of MODE_IDS) {
      for (let p = 0; p < 12; p++) {
        for (const level of LEVELS) {
          const r: RouletteResult = {
            keyPc: p,
            mode,
            bpm: 100,
            signature: '4/4',
            genre: 'rock',
            wildcard: null,
          };
          const scale = scalePitchClasses(keyNote(r), mode);
          const prog = backingFor(r, level);
          expect(prog).toHaveLength(4);
          for (const chord of prog) {
            for (const n of chordNotes(chord)) expect(scale.has(pc(n))).toBe(true);
          }
          // The loop starts on the tonic.
          expect(pc(prog[0].root)).toBe(p);
        }
      }
    }
  });
  it('uses sevenths above beginner and handles pentatonic fallbacks', () => {
    const r: RouletteResult = {
      keyPc: 0,
      mode: 'major',
      bpm: 100,
      signature: '4/4',
      genre: 'rock',
      wildcard: null,
    };
    expect(backingFor(r, 'beginner')[0].quality).toBe('maj');
    expect(backingFor(r, 'intermediate')[0].quality).toBe('maj7');
    const key = keyNote(r);
    expect(vampProgression({ root: key, mode: 'majorPentatonic' })[0].quality).toBe('maj');
    expect(vampProgression({ root: key, mode: 'blues' })[0].quality).toBe('min');
    expect(vampProgression({ root: key, mode: 'minorPentatonic' })).toHaveLength(4);
  });
});

describe('result text', () => {
  it('lists the scale notes and describes the result for screen readers', () => {
    const r: RouletteResult = {
      keyPc: 2,
      mode: 'dorian',
      bpm: 96,
      signature: '4/4',
      genre: 'funk',
      wildcard: null,
    };
    expect(scaleNotesOf(r)).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
    expect(describeResult(r)).toBe('Key: D, Mode: Dorian, Tempo: 96, Time: 4/4, Groove: Funk');
    expect(describeResult({ ...r, wildcard: CARDS[0] })).toContain('Wildcard: ');
  });
});
