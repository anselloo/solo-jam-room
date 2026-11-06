import { describe, expect, it } from 'vitest';
import { TurnTracker } from '../../src/games/trade-fours/turns';
import { createRng } from '../../src/random/rng';
import {
  LEVEL_LIMITS,
  PHRASES,
  PHRASE_STYLES,
  generatePhrase,
  phraseScaleFor,
  scaleLadder,
  type PhraseStyle,
} from '../../src/theory/phrases';
import { MODE_IDS, keyRootsFor, scalePitchClasses, type ScaleId } from '../../src/theory/scales';
import { pc } from '../../src/theory/notes';
import type { SkillLevel } from '../../src/state/profile';

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];

describe('phrase templates', () => {
  it('are well-formed: cells fit their bar and have positive lengths', () => {
    for (const style of PHRASE_STYLES) {
      for (const [beats, cells] of Object.entries(PHRASES.styles[style].cells)) {
        expect(cells.length).toBeGreaterThan(0);
        for (const cell of cells) {
          let prevEnd = 0;
          for (const [start, dur] of cell) {
            expect(dur).toBeGreaterThan(0);
            expect(start).toBeGreaterThanOrEqual(prevEnd);
            prevEnd = start + dur;
          }
          expect(prevEnd).toBeLessThanOrEqual(Number(beats));
        }
      }
    }
    expect(PHRASES.contours.length).toBeGreaterThan(3);
  });
});

describe('phrase generation', () => {
  it('only uses notes from the scale, in every key, mode, style and level', () => {
    const rng = createRng(1);
    for (const mode of MODE_IDS) {
      for (const style of PHRASE_STYLES) {
        const scale = phraseScaleFor(style, mode);
        for (let p = 0; p < 12; p++) {
          const root = keyRootsFor(mode)[p];
          const allowed = scalePitchClasses(root, scale);
          for (const level of LEVELS) {
            const phrase = generatePhrase({
              root,
              scale,
              style,
              level,
              bars: 4,
              beatsPerBar: 4,
              rng,
            });
            for (const note of phrase) expect(allowed.has(note.midi % 12)).toBe(true);
          }
        }
      }
    }
  });

  it('chooses the scale from the style', () => {
    expect(phraseScaleFor('simple', 'major')).toBe('majorPentatonic');
    expect(phraseScaleFor('simple', 'dorian')).toBe('minorPentatonic');
    expect(phraseScaleFor('simple', 'mixolydian')).toBe('majorPentatonic');
    expect(phraseScaleFor('bluesy', 'major')).toBe('blues');
    expect(phraseScaleFor('busy', 'lydian')).toBe('lydian');
    expect(phraseScaleFor('simple', 'blues')).toBe('blues');
  });

  const gen = (over: Partial<Parameters<typeof generatePhrase>[0]> = {}, seed = 7) => {
    const root = keyRootsFor('major')[0];
    return generatePhrase({
      root,
      scale: 'major' as ScaleId,
      style: 'simple' as PhraseStyle,
      level: 'intermediate',
      bars: 4,
      beatsPerBar: 4,
      rng: createRng(seed),
      ...over,
    });
  };

  it('fills exactly the requested phrase length, in order, without overlaps', () => {
    for (const bars of [2, 4, 8]) {
      for (const beatsPerBar of [3, 4, 5, 6, 7]) {
        for (const style of PHRASE_STYLES) {
          const phrase = gen({ bars, beatsPerBar, style }, bars * 10 + beatsPerBar);
          expect(phrase.length).toBeGreaterThan(bars - 1);
          let prevEnd = 0;
          for (const n of phrase) {
            expect(n.start).toBeGreaterThanOrEqual(prevEnd - 1e-9);
            expect(n.duration).toBeGreaterThan(0);
            expect(n.start + n.duration).toBeLessThanOrEqual(bars * beatsPerBar + 1e-9);
            expect(n.bar).toBe(Math.floor(n.start / beatsPerBar));
            prevEnd = n.start + n.duration;
          }
          expect(phrase[phrase.length - 1].bar).toBe(bars - 1);
        }
      }
    }
  });

  it('limits range and density by difficulty', () => {
    for (const level of LEVELS) {
      const { span, maxNotesPerBar } = LEVEL_LIMITS[level];
      const root = keyRootsFor('major')[0];
      const { ladder, tonicIndex } = scaleLadder(root, 'major');
      for (let seed = 0; seed < 60; seed++) {
        const phrase = gen({ level, style: 'busy', scale: 'major' }, seed);
        for (const n of phrase) {
          const idx = ladder.indexOf(n.midi);
          expect(Math.abs(idx - tonicIndex)).toBeLessThanOrEqual(span);
        }
        const perBar = new Map<number, number>();
        phrase.forEach((n) => perBar.set(n.bar, (perBar.get(n.bar) ?? 0) + 1));
        for (const count of perBar.values()) expect(count).toBeLessThanOrEqual(maxNotesPerBar);
      }
    }
    expect(LEVEL_LIMITS.beginner.span).toBeLessThan(LEVEL_LIMITS.advanced.span);
  });

  it('is busier for the busy style and advanced players', () => {
    const avg = (opts: Parameters<typeof gen>[0]) => {
      let total = 0;
      for (let s = 0; s < 80; s++) total += gen(opts, s).length;
      return total / 80;
    };
    expect(avg({ style: 'busy', level: 'advanced' })).toBeGreaterThan(
      avg({ style: 'simple', level: 'advanced' }),
    );
    expect(avg({ style: 'busy', level: 'advanced' })).toBeGreaterThan(
      avg({ style: 'busy', level: 'beginner' }),
    );
  });

  it('resolves on the tonic and is repeatable for a seed', () => {
    for (let seed = 0; seed < 40; seed++) {
      const root = keyRootsFor('major')[7];
      const phrase = gen({ root }, seed);
      expect(phrase[phrase.length - 1].midi % 12).toBe(pc(root));
    }
    expect(gen({}, 5)).toEqual(gen({}, 5));
    expect(gen({}, 5)).not.toEqual(gen({}, 6));
  });

  it('keeps notes in a singable register', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const n of gen({ level: 'advanced', style: 'busy' }, seed)) {
        expect(n.midi).toBeGreaterThanOrEqual(36);
        expect(n.midi).toBeLessThanOrEqual(96);
      }
    }
  });
});

describe('turn tracker', () => {
  const opts = { phraseBars: 4, rounds: 2, echo: false };

  it('alternates you and app, switching exactly on the phrase boundary', () => {
    const t = new TurnTracker(opts);
    const events: string[] = [];
    for (let bar = 0; bar < 20; bar++) {
      const e = t.onDownbeat(bar);
      if (e?.type === 'start') events.push(`${bar}:${e.turn.who}:r${e.turn.round}`);
      if (e?.type === 'end') events.push(`${bar}:end`);
    }
    expect(events).toEqual(['0:you:r1', '4:app:r1', '8:you:r2', '12:app:r2', '16:end']);
    expect(t.finished).toBe(true);
    expect(t.onDownbeat(17)).toBeNull();
  });

  it('starts with the app in the echo variant', () => {
    const t = new TurnTracker({ ...opts, echo: true });
    expect(t.onDownbeat(0)).toMatchObject({ type: 'start', turn: { who: 'app' } });
    expect(t.onDownbeat(4)).toMatchObject({ type: 'start', turn: { who: 'you' } });
  });

  it('flags the last bar of each turn', () => {
    const t = new TurnTracker(opts);
    t.onDownbeat(0);
    expect([0, 1, 2, 3, 4].map((b) => t.isLastBar(b))).toEqual([false, false, false, true, false]);
    expect(new TurnTracker(opts).isLastBar(0)).toBe(false);
  });

  it('skips after the current bar', () => {
    const t = new TurnTracker(opts);
    t.onDownbeat(0);
    t.onDownbeat(1);
    t.skip(1);
    expect(t.turn!.bars).toBe(2);
    expect(t.onDownbeat(2)).toMatchObject({ type: 'start', turn: { who: 'app', startBar: 2 } });
    new TurnTracker(opts).skip(3);
  });

  it('extends by one phrase length', () => {
    const t = new TurnTracker(opts);
    t.onDownbeat(0);
    t.extend();
    expect(t.turn!.bars).toBe(8);
    expect(t.onDownbeat(4)).toBeNull();
    expect(t.onDownbeat(8)).toMatchObject({ type: 'start', turn: { who: 'app', startBar: 8 } });
    new TurnTracker(opts).extend();
  });

  it('replays the current turn after a pause', () => {
    const t = new TurnTracker(opts);
    t.onDownbeat(0);
    t.onDownbeat(4);
    expect(t.turn!.who).toBe('app');
    t.resume();
    expect(t.onDownbeat(0)).toMatchObject({
      type: 'start',
      turn: { who: 'app', startBar: 0, index: 1 },
    });
    expect(t.onDownbeat(4)).toMatchObject({ type: 'start', turn: { who: 'you', index: 2 } });
  });
});
