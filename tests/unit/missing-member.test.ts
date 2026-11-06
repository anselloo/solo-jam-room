import { describe, expect, it } from 'vitest';
import {
  INSTRUMENT_ROLE_TAGS,
  ROLES,
  ROLE_INFO,
  pickRole,
  roleWeights,
  roundPosition,
  type Role,
} from '../../src/games/missing-member/roles';
import { createRng } from '../../src/random/rng';

function tally(allowed: readonly Role[], weights: ReturnType<typeof roleWeights>, n = 4000) {
  const rng = createRng(1);
  const counts: Record<Role, number> = { drums: 0, bass: 0, chords: 0, lead: 0 };
  for (let i = 0; i < n; i++) counts[pickRole(rng, allowed, weights)]++;
  return counts;
}

describe('roles', () => {
  it('describes every role and uses only known instrument tags', () => {
    for (const r of ROLES) {
      expect(ROLE_INFO[r].banner.length).toBeGreaterThan(10);
      expect(ROLE_INFO[r].hint.length).toBeGreaterThan(10);
      expect(INSTRUMENT_ROLE_TAGS.has(r)).toBe(true);
    }
    for (const tag of INSTRUMENT_ROLE_TAGS) expect(ROLES).toContain(tag);
  });

  it('weights a drummer toward drums, and everyone else evenly', () => {
    const drummer = roleWeights(['drums']);
    expect(drummer.drums).toBeGreaterThan(drummer.bass);
    expect(drummer.drums).toBeGreaterThan(drummer.lead);
    expect(roleWeights([])).toEqual({ drums: 1, bass: 1, chords: 1, lead: 1 });
    const guitarist = roleWeights(['guitar']);
    expect(guitarist.chords).toBeGreaterThan(guitarist.drums);
    expect(roleWeights(['nonexistent'])).toEqual(roleWeights([]));
  });

  it('gives a drummer "drums" more often', () => {
    const counts = tally(ROLES, roleWeights(['drums']));
    expect(counts.drums).toBeGreaterThan(counts.bass * 2);
    const even = tally(ROLES, roleWeights([]));
    for (const r of ROLES) expect(even[r]).toBeGreaterThan(800);
  });

  it('only picks allowed roles and never repeats back to back', () => {
    const rng = createRng(2);
    const allowed: Role[] = ['bass', 'chords'];
    let prev: Role | undefined;
    for (let i = 0; i < 200; i++) {
      const r = pickRole(rng, allowed, roleWeights([]), prev);
      expect(allowed).toContain(r);
      expect(r).not.toBe(prev);
      prev = r;
    }
  });

  it('can repeat when only one role is allowed, and rejects an empty list', () => {
    const rng = createRng(3);
    expect(pickRole(rng, ['lead'], roleWeights([]), 'lead')).toBe('lead');
    expect(() => pickRole(rng, [], roleWeights([]))).toThrow();
  });

  it('maps bars to rounds', () => {
    expect(roundPosition(0, 8)).toEqual({ round: 0, barInRound: 0, isLastBar: false });
    expect(roundPosition(7, 8)).toEqual({ round: 0, barInRound: 7, isLastBar: true });
    expect(roundPosition(8, 8)).toEqual({ round: 1, barInRound: 0, isLastBar: false });
    expect(roundPosition(23, 4)).toEqual({ round: 5, barInRound: 3, isLastBar: true });
  });
});
