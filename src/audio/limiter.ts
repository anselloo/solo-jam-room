/** Output protection: the band can sum above full scale, so the master chain ends in a soft limiter. */

/** Level below which the limiter leaves the signal untouched. */
export const LIMITER_THRESHOLD = 0.6;

/** The most the limiter can ever output (its value for an input of 1 and above). */
export const LIMITER_CEILING = LIMITER_THRESHOLD + (1 - LIMITER_THRESHOLD) * Math.tanh(1);

/**
 * Transfer function: unity gain up to the threshold, then a smooth tanh knee up to the ceiling.
 * Odd-symmetric and monotonic, so it never inverts or reorders the waveform.
 */
export function softLimit(x: number): number {
  const a = Math.abs(x);
  const t = LIMITER_THRESHOLD;
  const y = a <= t ? a : t + (1 - t) * Math.tanh((Math.min(a, 1) - t) / (1 - t));
  return Math.sign(x) * y;
}

/** Sample the transfer function over [-1, 1] for a WaveShaperNode. */
export function limiterCurve(points = 2049): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) curve[i] = softLimit((i / (points - 1)) * 2 - 1);
  return curve;
}
