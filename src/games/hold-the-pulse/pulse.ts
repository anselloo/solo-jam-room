import type { PulseRank } from '../../state/stats';

/** A tap's distance from the true grid beat it was aiming for. Positive means late. */
export interface TapPoint {
  /** Beat number within the silent section (0-based). */
  beat: number;
  offsetMs: number;
}

export interface PulseAnalysis {
  /** Taps used in the analysis. */
  taps: number;
  /** The tempo the player actually held during the silence. */
  avgBpm: number;
  /** How far that is from the target tempo, in BPM. */
  error: number;
  rank: PulseRank;
  points: TapPoint[];
}

/** Minimum taps needed to say anything meaningful about the player's tempo. */
export const MIN_TAPS = 4;

/** "Locked in" within 2 BPM, "Pretty tight" within 5, "Drifting" within 10, otherwise off. */
export function rankForError(error: number): PulseRank {
  const e = Math.abs(error);
  if (e <= 2 + 1e-9) return 0;
  if (e <= 5 + 1e-9) return 1;
  if (e <= 10 + 1e-9) return 2;
  return 3;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Average tempo from tap times. An interval that spans a missed beat (about two or three times
 * the typical gap) is divided back down, so skipping a tap does not look like slowing down.
 */
export function averageBpm(taps: readonly number[]): number | null {
  if (taps.length < 2) return null;
  const sorted = [...taps].sort((a, b) => a - b);
  const intervals = sorted
    .slice(1)
    .map((t, i) => t - sorted[i])
    .filter((d) => d > 0.05);
  if (intervals.length === 0) return null;
  const typical = median(intervals);
  const normalized = intervals.map((d) => d / Math.max(1, Math.round(d / typical)));
  const mean = normalized.reduce((s, d) => s + d, 0) / normalized.length;
  return 60 / mean;
}

/**
 * Score a silent section.
 * @param taps tap times in AudioContext seconds (any that fall outside the silence are ignored)
 * @param gridStart audio time of the first silent beat
 * @param bpm the true tempo
 * @param beats number of beats of silence
 */
export function analyzeTaps(
  taps: readonly number[],
  gridStart: number,
  bpm: number,
  beats: number,
): PulseAnalysis | null {
  const beatDur = 60 / bpm;
  const from = gridStart - beatDur / 2;
  const to = gridStart + beats * beatDur - beatDur / 2;
  const inWindow = taps.filter((t) => t >= from && t < to).sort((a, b) => a - b);
  if (inWindow.length < MIN_TAPS) return null;
  const avg = averageBpm(inWindow);
  if (avg === null) return null;
  const error = Math.abs(avg - bpm);
  // Number the beats in tap order (skipping the beats of any missed taps) rather than snapping each
  // tap to the nearest grid line, so steady drift shows as a smooth slope instead of wrapping.
  const gaps = inWindow.slice(1).map((t, i) => t - inWindow[i]);
  const typical = median(gaps.filter((d) => d > 0.05));
  let beat = Math.max(0, Math.round((inWindow[0] - gridStart) / beatDur));
  const points: TapPoint[] = inWindow.map((t, i) => {
    if (i > 0) beat += Math.max(1, Math.round(gaps[i - 1] / typical));
    return { beat, offsetMs: (t - (gridStart + beat * beatDur)) * 1000 };
  });
  return { taps: inWindow.length, avgBpm: avg, error, rank: rankForError(error), points };
}

export interface PulsePreset {
  id: 'easy' | 'standard' | 'hard';
  label: string;
  bpm: number;
  barsOn: number;
  barsOff: number;
  rounds: number;
}

/** Longer silences and wider tempos as difficulty rises. */
export const PRESETS: readonly PulsePreset[] = [
  { id: 'easy', label: 'Easy', bpm: 80, barsOn: 4, barsOff: 4, rounds: 2 },
  { id: 'standard', label: 'Standard', bpm: 100, barsOn: 4, barsOff: 8, rounds: 3 },
  { id: 'hard', label: 'Hard', bpm: 140, barsOn: 2, barsOff: 16, rounds: 3 },
];

export interface CycleStep {
  round: number;
  barInCycle: number;
}

/** Where a bar falls in the on/off cycle. */
export function cyclePosition(bar: number, barsOn: number, barsOff: number): CycleStep {
  const cycle = barsOn + barsOff;
  return { round: Math.floor(bar / cycle), barInCycle: bar % cycle };
}

/** Whether the click should be audible in a bar of the cycle. */
export function clickAudible(barInCycle: number, barsOn: number): boolean {
  return barInCycle < barsOn;
}
