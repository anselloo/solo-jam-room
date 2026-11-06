import { describe, expect, it } from 'vitest';
import {
  MIN_TAPS,
  PRESETS,
  analyzeTaps,
  averageBpm,
  clickAudible,
  cyclePosition,
  rankForError,
} from '../../src/games/hold-the-pulse/pulse';
import { PULSE_LABELS } from '../../src/state/stats';

/** Evenly spaced taps at `bpm` starting at `start`, optionally with a time-varying tempo error. */
const taps = (bpm: number, count: number, start = 10, offset: (i: number) => number = () => 0) =>
  Array.from({ length: count }, (_, i) => start + (i * 60) / bpm + offset(i));

describe('scoring', () => {
  it('uses the spec thresholds', () => {
    expect(rankForError(0)).toBe(0);
    expect(rankForError(2)).toBe(0);
    expect(rankForError(2.01)).toBe(1);
    expect(rankForError(5)).toBe(1);
    expect(rankForError(5.01)).toBe(2);
    expect(rankForError(10)).toBe(2);
    expect(rankForError(10.01)).toBe(3);
    expect(rankForError(-3)).toBe(1);
    expect(PULSE_LABELS[0]).toBe('Locked in');
    expect(PULSE_LABELS[1]).toBe('Pretty tight');
    expect(PULSE_LABELS[2]).toBe('Drifting');
    expect(PULSE_LABELS[3]).toBe('Off to the races');
  });
});

describe('average tempo', () => {
  it('recovers the tempo of evenly spaced taps', () => {
    for (const bpm of [60, 100, 140, 180]) expect(averageBpm(taps(bpm, 16))!).toBeCloseTo(bpm, 6);
  });
  it('needs at least two taps', () => {
    expect(averageBpm([])).toBeNull();
    expect(averageBpm([1])).toBeNull();
    expect(averageBpm([1, 1])).toBeNull();
  });
  it('is not fooled by a missed tap', () => {
    const t = taps(100, 12);
    t.splice(5, 1);
    expect(averageBpm(t)!).toBeCloseTo(100, 6);
    t.splice(8, 2);
    expect(averageBpm(t)!).toBeCloseTo(100, 6);
  });
  it('sorts unordered taps', () => {
    expect(averageBpm([3, 1, 2, 4])!).toBeCloseTo(60, 6);
  });
});

describe('analyzing a silent section', () => {
  const start = 20;

  it('calls perfect timing "locked in" with near-zero offsets', () => {
    const a = analyzeTaps(taps(100, 32, start), start, 100, 32)!;
    expect(a.rank).toBe(0);
    expect(a.error).toBeLessThan(0.001);
    expect(a.taps).toBe(32);
    for (const p of a.points) expect(Math.abs(p.offsetMs)).toBeLessThan(0.001);
    expect(a.points.map((p) => p.beat)).toEqual(Array.from({ length: 32 }, (_, i) => i));
  });

  it('detects rushing and dragging', () => {
    const fast = analyzeTaps(taps(106, 32, start), start, 100, 32)!;
    expect(fast.avgBpm).toBeCloseTo(106, 4);
    expect(fast.rank).toBe(2);
    // Rushing shows as taps arriving earlier and earlier than the grid.
    expect(fast.points[fast.points.length - 1].offsetMs).toBeLessThan(fast.points[0].offsetMs);
    const slow = analyzeTaps(taps(96, 32, start), start, 100, 32)!;
    expect(slow.rank).toBe(1);
    expect(slow.points[slow.points.length - 1].offsetMs).toBeGreaterThan(0);
    expect(analyzeTaps(taps(140, 32, start), start, 100, 32)!.rank).toBe(3);
  });

  it('keeps beat numbers right when a tap is skipped', () => {
    const t = taps(100, 12, start);
    t.splice(5, 1);
    const a = analyzeTaps(t, start, 100, 12)!;
    expect(a.points.map((p) => p.beat)).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11]);
    for (const p of a.points) expect(Math.abs(p.offsetMs)).toBeLessThan(0.001);
  });

  it('ignores taps outside the silent window', () => {
    const early = [start - 5, start - 4, start - 3];
    const late = [start + 40, start + 41];
    const mid = taps(100, 16, start);
    const a = analyzeTaps([...early, ...mid, ...late], start, 100, 16)!;
    expect(a.taps).toBe(16);
    expect(a.rank).toBe(0);
  });

  it('returns null with too few taps', () => {
    expect(analyzeTaps([], start, 100, 8)).toBeNull();
    expect(analyzeTaps(taps(100, MIN_TAPS - 1, start), start, 100, 8)).toBeNull();
    expect(analyzeTaps(taps(100, MIN_TAPS, start), start, 100, 8)).not.toBeNull();
  });

  it('tolerates human jitter without losing the rank', () => {
    let seed = 7;
    const jitter = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647 - 0.5) * 0.04; // +-20 ms
    };
    const a = analyzeTaps(taps(100, 32, start, jitter), start, 100, 32)!;
    expect(a.rank).toBeLessThanOrEqual(1);
    for (const p of a.points) expect(Math.abs(p.offsetMs)).toBeLessThan(25);
  });

  it('reports offsets in milliseconds, late as positive', () => {
    const a = analyzeTaps(
      taps(100, 8, start, () => 0.03),
      start,
      100,
      8,
    )!;
    for (const p of a.points) expect(p.offsetMs).toBeCloseTo(30, 3);
  });
});

describe('cycle and presets', () => {
  it('maps bars to rounds and click audibility', () => {
    expect(cyclePosition(0, 4, 8)).toEqual({ round: 0, barInCycle: 0 });
    expect(cyclePosition(11, 4, 8)).toEqual({ round: 0, barInCycle: 11 });
    expect(cyclePosition(12, 4, 8)).toEqual({ round: 1, barInCycle: 0 });
    expect([0, 3, 4, 11].map((b) => clickAudible(b, 4))).toEqual([true, true, false, false]);
  });
  it('gets harder with longer silences and faster tempos', () => {
    const [easy, standard, hard] = PRESETS;
    expect(easy.barsOff).toBeLessThan(standard.barsOff);
    expect(standard.barsOff).toBeLessThan(hard.barsOff);
    expect(easy.bpm).toBeLessThan(hard.bpm);
    expect(standard.barsOn).toBe(4);
    expect(standard.barsOff).toBe(8);
  });
});
