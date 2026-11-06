import { loadJson, saveJson } from './storage';

/** How good a Hold the Pulse run was. Lower rank is better. */
export type PulseRank = 0 | 1 | 2 | 3;
export const PULSE_LABELS: Record<PulseRank, string> = {
  0: 'Locked in',
  1: 'Pretty tight',
  2: 'Drifting',
  3: 'Off to the races',
};

export interface PulseBest {
  rank: PulseRank;
  /** Average tempo error in BPM for the best run. */
  error: number;
}

export interface DailyProgress {
  /** Local dates (YYYY-MM-DD) on which the Daily Jam was completed. */
  done: string[];
  best: number;
}

export interface Stats {
  sessions: number;
  minutes: number;
  perGame: Record<string, number>;
  /** Best Hold the Pulse result per tempo, keyed by BPM. */
  pulseBests: Record<string, PulseBest>;
  daily: DailyProgress;
}

export const EMPTY_STATS: Stats = {
  sessions: 0,
  minutes: 0,
  perGame: {},
  pulseBests: {},
  daily: { done: [], best: 0 },
};

// ---------------------------------------------------------------------------
// Local dates. Streaks are about the player's calendar day, so everything is keyed by the local
// date. Differences are computed on calendar components, never on millisecond gaps, so daylight
// saving changes (23- and 25-hour days) cannot skip or repeat a day.
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD in the local time zone. */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const pa = parseDateKey(a);
  const pb = parseDateKey(b);
  if (!pa || !pb) throw new Error(`Invalid date key: ${a} / ${b}`);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

export function addDays(key: string, n: number): string {
  const p = parseDateKey(key);
  if (!p) throw new Error(`Invalid date key: ${key}`);
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Current streak as of `today`: consecutive completed days ending today, or ending yesterday
 * (today is not over yet, so an unfinished today does not break the streak).
 */
export function currentStreak(done: readonly string[], today: string): number {
  const set = new Set(done);
  let day = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/** Longest run of consecutive days anywhere in the history. */
export function longestStreak(done: readonly string[]): number {
  const days = [...new Set(done)].filter((d) => parseDateKey(d)).sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function isDailyDone(stats: Stats, today: string): boolean {
  return stats.daily.done.includes(today);
}

/** Mark the Daily Jam for `date` complete. Completing the same day twice changes nothing. */
export function completeDaily(stats: Stats, date: string): Stats {
  if (!parseDateKey(date) || stats.daily.done.includes(date)) return stats;
  const done = [...stats.daily.done, date].sort();
  return { ...stats, daily: { done, best: Math.max(stats.daily.best, longestStreak(done)) } };
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

export function recordSession(stats: Stats, game: string, minutes: number): Stats {
  return {
    ...stats,
    sessions: stats.sessions + 1,
    minutes: stats.minutes + Math.max(0, minutes),
    perGame: { ...stats.perGame, [game]: (stats.perGame[game] ?? 0) + 1 },
  };
}

/** Keep only the better of the old and new best for a tempo. */
export function recordPulse(stats: Stats, bpm: number, result: PulseBest): Stats {
  const key = String(bpm);
  const old = stats.pulseBests[key];
  const better =
    !old || result.rank < old.rank || (result.rank === old.rank && result.error < old.error);
  return better ? { ...stats, pulseBests: { ...stats.pulseBests, [key]: result } } : stats;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;

export function sanitizeStats(value: unknown): Stats | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const perGame: Record<string, number> = {};
  if (typeof v.perGame === 'object' && v.perGame !== null) {
    for (const [k, n] of Object.entries(v.perGame)) perGame[k] = num(n);
  }
  const pulseBests: Record<string, PulseBest> = {};
  if (typeof v.pulseBests === 'object' && v.pulseBests !== null) {
    for (const [k, b] of Object.entries(v.pulseBests)) {
      const o = b as Record<string, unknown>;
      if (o && [0, 1, 2, 3].includes(o.rank as number)) {
        pulseBests[k] = { rank: o.rank as PulseRank, error: num(o.error) };
      }
    }
  }
  const d = (v.daily ?? {}) as Record<string, unknown>;
  const done = Array.isArray(d.done)
    ? [
        ...new Set(d.done.filter((x): x is string => typeof x === 'string' && !!parseDateKey(x))),
      ].sort()
    : [];
  return {
    sessions: num(v.sessions),
    minutes: num(v.minutes),
    perGame,
    pulseBests,
    daily: { done, best: Math.max(num(d.best), longestStreak(done)) },
  };
}

export const loadStats = (): Stats => loadJson('stats', EMPTY_STATS, sanitizeStats);
export const saveStats = (s: Stats): boolean => saveJson('stats', s);
