import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_STATS,
  addDays,
  completeDaily,
  currentStreak,
  daysBetween,
  isDailyDone,
  loadStats,
  localDateKey,
  longestStreak,
  parseDateKey,
  recordPulse,
  recordSession,
  sanitizeStats,
  saveStats,
} from '../../src/state/stats';

afterEach(() => window.localStorage.clear());

describe('date keys', () => {
  it('formats the local date, including around midnight', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59, 59))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 0, 6, 0, 0, 1))).toBe('2026-01-06');
    expect(localDateKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31');
  });
  it('parses and rejects dates', () => {
    expect(parseDateKey('2026-02-28')).toEqual({ y: 2026, m: 2, d: 28 });
    expect(parseDateKey('2026-02-30')).toBeNull();
    expect(parseDateKey('2026-2-3')).toBeNull();
    expect(parseDateKey('nope')).toBeNull();
  });
  it('counts calendar days, across months, years and leap days', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-03-01', '2026-02-01')).toBe(-28);
    expect(() => daysBetween('x', '2026-01-01')).toThrow();
  });
  it('counts whole days across daylight-saving changes', () => {
    // Spring-forward and fall-back weekends in the northern hemisphere.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(() => addDays('bad', 1)).toThrow();
  });
});

describe('streaks', () => {
  it('is zero with no history', () => {
    expect(currentStreak([], '2026-06-10')).toBe(0);
    expect(longestStreak([])).toBe(0);
  });
  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-06-08', '2026-06-09', '2026-06-10'], '2026-06-10')).toBe(3);
  });
  it('keeps the streak alive until the end of today', () => {
    expect(currentStreak(['2026-06-08', '2026-06-09'], '2026-06-10')).toBe(2);
  });
  it('resets after a skipped day', () => {
    expect(currentStreak(['2026-06-07', '2026-06-08'], '2026-06-10')).toBe(0);
    expect(
      currentStreak(['2026-06-05', '2026-06-06', '2026-06-08', '2026-06-09'], '2026-06-09'),
    ).toBe(2);
  });
  it('handles month, year and leap-day boundaries', () => {
    expect(currentStreak(['2025-12-30', '2025-12-31', '2026-01-01'], '2026-01-01')).toBe(3);
    expect(currentStreak(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01')).toBe(3);
  });
  it('survives daylight-saving weekends', () => {
    expect(currentStreak(['2026-03-07', '2026-03-08', '2026-03-09'], '2026-03-09')).toBe(3);
    expect(currentStreak(['2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02')).toBe(3);
  });
  it('ignores a future or duplicate date and finds the longest run', () => {
    expect(currentStreak(['2026-06-11'], '2026-06-10')).toBe(0);
    expect(
      longestStreak([
        '2026-01-01',
        '2026-01-02',
        '2026-01-02',
        '2026-01-04',
        '2026-01-05',
        '2026-01-06',
      ]),
    ).toBe(3);
  });
});

describe('completing the Daily Jam', () => {
  it('extends the streak and tracks the best', () => {
    let s = EMPTY_STATS;
    s = completeDaily(s, '2026-06-08');
    s = completeDaily(s, '2026-06-09');
    expect(currentStreak(s.daily.done, '2026-06-09')).toBe(2);
    expect(s.daily.best).toBe(2);
    expect(isDailyDone(s, '2026-06-09')).toBe(true);
    expect(isDailyDone(s, '2026-06-10')).toBe(false);
  });
  it('is idempotent for the same day and ignores bad dates', () => {
    const once = completeDaily(EMPTY_STATS, '2026-06-08');
    expect(completeDaily(once, '2026-06-08')).toBe(once);
    expect(completeDaily(once, 'garbage')).toBe(once);
  });
  it('keeps the best streak after a break', () => {
    let s = EMPTY_STATS;
    for (const d of ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-10'])
      s = completeDaily(s, d);
    expect(s.daily.best).toBe(3);
    expect(currentStreak(s.daily.done, '2026-06-10')).toBe(1);
  });
  it('handles completing days out of order', () => {
    let s = EMPTY_STATS;
    for (const d of ['2026-06-03', '2026-06-01', '2026-06-02']) s = completeDaily(s, d);
    expect(s.daily.done).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    expect(s.daily.best).toBe(3);
  });
});

describe('recording', () => {
  it('records sessions per game', () => {
    let s = recordSession(EMPTY_STATS, '/roulette', 4.5);
    s = recordSession(s, '/roulette', 2);
    s = recordSession(s, '/constraints', -3);
    expect(s.sessions).toBe(3);
    expect(s.minutes).toBeCloseTo(6.5);
    expect(s.perGame).toEqual({ '/roulette': 2, '/constraints': 1 });
  });
  it('keeps only the best Hold the Pulse result per tempo', () => {
    let s = recordPulse(EMPTY_STATS, 100, { rank: 2, error: 8 });
    s = recordPulse(s, 100, { rank: 1, error: 4 });
    expect(s.pulseBests['100']).toEqual({ rank: 1, error: 4 });
    const worse = recordPulse(s, 100, { rank: 3, error: 20 });
    expect(worse).toBe(s);
    const tighter = recordPulse(s, 100, { rank: 1, error: 3 });
    expect(tighter.pulseBests['100'].error).toBe(3);
    expect(recordPulse(s, 120, { rank: 3, error: 30 }).pulseBests['120']).toBeDefined();
  });
});

describe('persistence', () => {
  it('round-trips and sanitizes', () => {
    let s = recordSession(EMPTY_STATS, '/roulette', 3);
    s = completeDaily(s, '2026-06-08');
    s = recordPulse(s, 90, { rank: 0, error: 1 });
    expect(saveStats(s)).toBe(true);
    expect(loadStats()).toEqual(s);
  });
  it('recovers from junk', () => {
    expect(sanitizeStats(5)).toBeNull();
    const clean = sanitizeStats({
      sessions: -4,
      minutes: 'lots',
      perGame: { a: 2, b: 'x' },
      pulseBests: { '100': { rank: 9, error: 1 }, '90': { rank: 1, error: 2 } },
      daily: { done: ['2026-06-08', 'nope', '2026-06-08', 5], best: 'x' },
    })!;
    expect(clean.sessions).toBe(0);
    expect(clean.minutes).toBe(0);
    expect(clean.perGame).toEqual({ a: 2, b: 0 });
    expect(clean.pulseBests).toEqual({ '90': { rank: 1, error: 2 } });
    expect(clean.daily).toEqual({ done: ['2026-06-08'], best: 1 });
  });
  it('falls back to empty stats when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadStats()).toEqual(EMPTY_STATS);
    vi.restoreAllMocks();
  });
});
