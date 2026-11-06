import { describe, expect, it } from 'vitest';
import {
  LIMITER_CEILING,
  LIMITER_THRESHOLD,
  limiterCurve,
  softLimit,
} from '../../src/audio/limiter';

describe('soft limiter', () => {
  it('leaves quiet signals untouched', () => {
    for (const x of [0, 0.01, 0.1, 0.3, LIMITER_THRESHOLD, -0.2, -LIMITER_THRESHOLD]) {
      expect(softLimit(x)).toBeCloseTo(x, 12);
    }
  });

  it('never exceeds the ceiling, however loud the input', () => {
    for (const x of [0.7, 0.9, 1, 1.5, 4, 100, -1, -3, -100]) {
      expect(Math.abs(softLimit(x))).toBeLessThanOrEqual(LIMITER_CEILING + 1e-12);
    }
    expect(LIMITER_CEILING).toBeLessThan(1);
    expect(LIMITER_CEILING).toBeGreaterThan(0.85);
    expect(softLimit(1)).toBeCloseTo(LIMITER_CEILING, 12);
  });

  it('is odd-symmetric and monotonic, so it never reorders or inverts the waveform', () => {
    let prev = -Infinity;
    for (let i = -400; i <= 400; i++) {
      const x = i / 200;
      expect(softLimit(-x)).toBeCloseTo(-softLimit(x), 12);
      const y = softLimit(x);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = y;
    }
  });

  it('has no jump at the threshold', () => {
    const below = softLimit(LIMITER_THRESHOLD - 1e-6);
    const above = softLimit(LIMITER_THRESHOLD + 1e-6);
    expect(Math.abs(above - below)).toBeLessThan(1e-5);
  });

  it('samples a curve that covers [-1, 1] symmetrically', () => {
    const c = limiterCurve(2049);
    expect(c).toHaveLength(2049);
    expect(c[1024]).toBeCloseTo(0, 12);
    expect(c[0]).toBeCloseTo(-LIMITER_CEILING, 6);
    expect(c[2048]).toBeCloseTo(LIMITER_CEILING, 6);
    expect(Math.max(...c)).toBeLessThanOrEqual(LIMITER_CEILING + 1e-6);
  });
});
