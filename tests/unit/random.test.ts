import { describe, expect, it } from 'vitest';
import { createRng, hashString } from '../../src/random/rng';
import { Deck, History } from '../../src/random/deck';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('2026-11-07');
    const b = createRng('2026-11-07');
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next()),
    );
  });
  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
    expect(hashString('a')).not.toBe(hashString('b'));
  });
  it('next stays in [0,1) and int stays inclusive in range', () => {
    const r = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const n = r.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const k = r.int(3, 6);
      expect(k).toBeGreaterThanOrEqual(3);
      expect(k).toBeLessThanOrEqual(6);
    }
  });
  it('hits every value of an int range', () => {
    const r = createRng(7);
    const seen = new Set(Array.from({ length: 200 }, () => r.int(0, 2)));
    expect(seen).toEqual(new Set([0, 1, 2]));
  });
  it('pick returns members and throws when empty', () => {
    const r = createRng(1);
    expect(['a', 'b']).toContain(r.pick(['a', 'b']));
    expect(() => r.pick([])).toThrow();
  });
  it('chance respects 0 and 1', () => {
    const r = createRng(1);
    expect(r.chance(0)).toBe(false);
    expect(r.chance(1)).toBe(true);
  });
  it('shuffle is a permutation and does not mutate input', () => {
    const r = createRng(5);
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = r.shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort()).toEqual(src);
  });
  it('uses a default seed when none is given', () => {
    expect(createRng().next()).toBeLessThan(1);
  });
});

describe('deck', () => {
  it('does not repeat until exhausted, then reshuffles with a flag', () => {
    const d = new Deck([1, 2, 3, 4], createRng(9));
    const first = Array.from({ length: 4 }, () => d.draw());
    expect(new Set(first.map((x) => x.item)).size).toBe(4);
    expect(first.every((x) => !x.reshuffled)).toBe(true);
    expect(d.remaining).toBe(0);
    const next = d.draw();
    expect(next.reshuffled).toBe(true);
    expect(next.item).not.toBe(first[3].item);
  });
  it('never repeats back-to-back across many reshuffles', () => {
    const d = new Deck(['a', 'b', 'c'], createRng(3));
    let prev = '';
    for (let i = 0; i < 300; i++) {
      const { item } = d.draw();
      expect(item).not.toBe(prev);
      prev = item;
    }
  });
  it('handles single-item and empty decks', () => {
    const one = new Deck(['x'], createRng(1));
    expect(one.draw().item).toBe('x');
    expect(one.draw()).toEqual({ item: 'x', reshuffled: true });
    expect(() => new Deck([], createRng(1)).draw()).toThrow();
  });
  it('reset swaps contents', () => {
    const d = new Deck([1, 2], createRng(1));
    d.reset([9]);
    expect(d.size).toBe(1);
    expect(d.draw().item).toBe(9);
  });
});

describe('history', () => {
  it('keeps the last N and supports back', () => {
    const h = new History<number>(3);
    [1, 2, 3, 4].forEach((n) => h.push(n));
    expect(h.toArray()).toEqual([2, 3, 4]);
    expect(h.back()).toBe(3);
    expect(h.peek()).toBe(3);
    expect(h.length).toBe(2);
    h.back();
    expect(h.back()).toBeUndefined();
    expect(h.peek()).toBe(2);
  });
});
