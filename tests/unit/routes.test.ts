import { describe, expect, it } from 'vitest';
import { DAILY, GAMES, pathFromHash, resolveRoute } from '../../src/routes';

describe('routes', () => {
  it('normalizes hashes', () => {
    expect(pathFromHash('')).toBe('/');
    expect(pathFromHash('#')).toBe('/');
    expect(pathFromHash('#/')).toBe('/');
    expect(pathFromHash('#/roulette')).toBe('/roulette');
    expect(pathFromHash('#/roulette/')).toBe('/roulette');
    expect(pathFromHash('#/roulette?seed=4')).toBe('/roulette');
    expect(pathFromHash('#roulette')).toBe('/roulette');
  });
  it('resolves every spec route', () => {
    for (const g of [...GAMES, DAILY]) {
      expect(resolveRoute(g.path)).toEqual({ page: 'game', game: g });
    }
    expect(resolveRoute('/').page).toBe('home');
    expect(resolveRoute('/profile').page).toBe('profile');
    expect(resolveRoute('/settings').page).toBe('settings');
    expect(resolveRoute('/about').page).toBe('about');
    expect(resolveRoute('/nope').page).toBe('notFound');
  });
  it('covers all nine games from the spec', () => {
    expect([...GAMES, DAILY].map((g) => g.path).sort()).toEqual(
      [
        '/constraints',
        '/daily',
        '/genre-flip',
        '/hold-the-pulse',
        '/missing-member',
        '/progressions',
        '/roulette',
        '/song-sprint',
        '/trade-fours',
      ].sort(),
    );
  });
});
