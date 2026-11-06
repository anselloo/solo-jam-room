import { describe, expect, it } from 'vitest';
import { genreById } from '../../src/audio/band/grooves';
import { DAILY_GAMES, GAME_TITLES, dailyChallenge, gameFor } from '../../src/games/daily/daily';
import { DIFFICULTY } from '../../src/games/roulette/roulette';
import { addDays } from '../../src/state/stats';
import { resolveRoute } from '../../src/routes';

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('daily challenge', () => {
  it('is identical for the same date, however often and in whatever order it is asked for', () => {
    const a = dailyChallenge('2026-06-10');
    dailyChallenge('2026-06-11');
    dailyChallenge('2030-01-01');
    const b = dailyChallenge('2026-06-10');
    expect(b).toEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('differs from day to day', () => {
    const summaries = days('2026-01-01', 60).map((d) => dailyChallenge(d).summary);
    expect(new Set(summaries).size).toBe(60);
  });

  it('never gives the same game two days running', () => {
    const list = days('2026-01-01', 800);
    for (let i = 1; i < list.length; i++) {
      expect(gameFor(list[i]), list[i]).not.toBe(gameFor(list[i - 1]));
    }
  });

  it('reaches every game and spreads them out', () => {
    const counts = new Map<string, number>();
    for (const d of days('2026-01-01', 400))
      counts.set(gameFor(d), (counts.get(gameFor(d)) ?? 0) + 1);
    expect(new Set(counts.keys())).toEqual(new Set(DAILY_GAMES));
    for (const n of counts.values()) expect(n).toBeGreaterThan(20);
  });

  it('points to a real game page with a title and summary', () => {
    for (const d of days('2026-03-01', 120)) {
      const c = dailyChallenge(d);
      expect(c.date).toBe(d);
      expect(c.title).toBe(GAME_TITLES[c.game]);
      expect(resolveRoute(c.path).page).toBe('game');
      expect(c.summary.length).toBeGreaterThan(20);
      expect(c.summary).toContain(
        c.title === 'Chord Dealer' ? 'Chord Dealer' : c.title.split(' ')[0],
      );
      expect(c.details.length).toBeGreaterThan(0);
    }
  });

  it('keeps its band settings within sensible, intermediate limits', () => {
    const cfg = DIFFICULTY.intermediate;
    for (const d of days('2026-01-01', 300)) {
      const { band } = dailyChallenge(d);
      if (!band) continue;
      expect(band.keyPc).toBeGreaterThanOrEqual(0);
      expect(band.keyPc).toBeLessThan(12);
      expect(band.bpm).toBeGreaterThanOrEqual(40);
      expect(band.bpm).toBeLessThanOrEqual(cfg.bpm[1] + 60);
      expect(genreById(band.genreId)).toBeDefined();
      expect(['4/4', '3/4', '6/8', '5/4', '7/8']).toContain(band.signature);
    }
  });

  it('uses cards that anyone can play, so everyone gets the same challenge', () => {
    for (const d of days('2026-01-01', 200)) {
      const { card } = dailyChallenge(d);
      expect(card.instruments).toBeUndefined();
      expect(card.difficulty).not.toBe('hard');
    }
  });

  it('gives the Trade Fours example from the spec its shape', () => {
    const trade = days('2026-01-01', 400)
      .map(dailyChallenge)
      .find((c) => c.game === 'trade-fours')!;
    expect(trade.summary).toMatch(/^Trade Fours in .+ at \d+ BPM, \d-bar .+ phrases\. Card: .+/);
  });

  it('works across year and leap-day boundaries', () => {
    for (const d of ['2025-12-31', '2026-01-01', '2028-02-29', '2028-03-01']) {
      expect(dailyChallenge(d).date).toBe(d);
    }
    expect(dailyChallenge('2028-02-29')).not.toEqual(dailyChallenge('2028-03-01'));
  });
});

describe('game rotation', () => {
  it('plays every game once in each run of eight days', () => {
    // Any window that starts on a cycle boundary contains each game exactly once.
    const all = days('2026-01-01', 8 * 60).map(gameFor);
    const firstBoundary = all.findIndex((_, i) => new Set(all.slice(i, i + 8)).size === 8);
    expect(firstBoundary).toBeGreaterThanOrEqual(0);
    for (let c = 0; c < 50; c++) {
      const chunk = all.slice(firstBoundary + c * 8, firstBoundary + c * 8 + 8);
      if (chunk.length === 8) expect(new Set(chunk).size).toBe(8);
    }
  });
});
