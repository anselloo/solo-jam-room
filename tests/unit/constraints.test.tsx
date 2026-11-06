import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { INSTRUMENTS } from '../../src/state/profile';
import { createRng } from '../../src/random/rng';
import {
  CARDS,
  CATEGORIES,
  DEFAULT_FILTER,
  createConstraintDeck,
  eligibleCards,
} from '../../src/games/constraints/deck';

describe('constraint data', () => {
  it('has at least 60 well-formed cards with unique ids', () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    expect(new Set(CARDS.map((c) => c.text)).size).toBe(CARDS.length);
    const instrumentIds = INSTRUMENTS.map((i) => i.id);
    for (const c of CARDS) {
      expect(c.text.length).toBeGreaterThan(5);
      expect(CATEGORIES).toContain(c.category);
      expect(['easy', 'medium', 'hard']).toContain(c.difficulty);
      if (c.instruments) {
        expect(c.instruments.length).toBeGreaterThan(0);
        for (const i of c.instruments) expect(instrumentIds).toContain(i);
      }
    }
  });
  it('has cards in every category and some beginner-safe ones in each', () => {
    for (const cat of CATEGORIES) {
      expect(
        CARDS.filter((c) => c.category === cat && c.difficulty !== 'hard').length,
      ).toBeGreaterThan(2);
    }
  });
});

describe('constraint filtering', () => {
  it('never shows instrument-specific cards to other players', () => {
    const pool = eligibleCards(CARDS, DEFAULT_FILTER, ['trumpet']);
    for (const c of pool) {
      if (c.instruments) expect(c.instruments).toContain('trumpet');
    }
    expect(pool.some((c) => c.instruments?.includes('drums'))).toBe(false);
    const noInstrument = eligibleCards(CARDS, DEFAULT_FILTER, []);
    expect(noInstrument.every((c) => !c.instruments)).toBe(true);
    const drummer = eligibleCards(CARDS, DEFAULT_FILTER, ['drums']);
    expect(drummer.some((c) => c.instruments?.includes('drums'))).toBe(true);
  });
  it('applies category and beginner-safe filters', () => {
    const rhythm = eligibleCards(CARDS, { categories: ['rhythm'], beginnerSafe: false }, []);
    expect(rhythm.length).toBeGreaterThan(0);
    expect(rhythm.every((c) => c.category === 'rhythm')).toBe(true);
    const safe = eligibleCards(CARDS, { categories: [...CATEGORIES], beginnerSafe: true }, [
      'guitar',
    ]);
    expect(safe.some((c) => c.difficulty === 'hard')).toBe(false);
    expect(eligibleCards(CARDS, { categories: [], beginnerSafe: false }, [])).toEqual([]);
  });
  it('draws every eligible card once before reshuffling', () => {
    const deck = createConstraintDeck(createRng(11), DEFAULT_FILTER, ['guitar']);
    const size = deck.size;
    const seen = new Set<string>();
    for (let i = 0; i < size; i++) {
      const { item, reshuffled } = deck.draw();
      expect(reshuffled).toBe(false);
      expect(seen.has(item.id)).toBe(false);
      seen.add(item.id);
    }
    expect(deck.draw().reshuffled).toBe(true);
  });
});

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '#/constraints';
});
afterEach(cleanup);

describe('Constraint Cards page', () => {
  it('draws, keeps and unpins cards, with keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(screen.getByRole('heading', { name: /constraint cards/i })).toBeTruthy();
    await user.keyboard(' ');
    const draw = screen.getByRole('button', { name: /draw again/i });
    expect(draw).toBeTruthy();
    expect(screen.getByRole('button', { name: /^keep$/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^keep$/i }));
    const pinned = screen.getByLabelText(/kept cards/i);
    expect(pinned.querySelectorAll('li')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /^discard$/i }));
    expect(screen.getByRole('button', { name: /draw a card/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /unpin/i }));
    expect(screen.queryByLabelText(/kept cards/i)).toBeNull();
  });

  it('shows Reshuffled! when the deck runs out', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    // Narrow the deck to one small category so it is exhausted quickly.
    for (const cat of ['Note limits', 'Rhythm', 'Dynamics', 'Register', 'Technique']) {
      await user.click(screen.getByRole('button', { name: cat }));
    }
    const pool = eligibleCards(CARDS, { categories: ['wild'], beginnerSafe: false }, []).length;
    await act(async () => undefined);
    for (let i = 0; i <= pool; i++) await user.keyboard('r');
    expect(screen.getByText('Reshuffled!')).toBeTruthy();
  });
});
