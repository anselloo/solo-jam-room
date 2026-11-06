import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_PROFILE, saveProfile } from '../../src/state/profile';

beforeEach(() => {
  window.localStorage.clear();
  saveProfile({ ...DEFAULT_PROFILE, onboarded: true });
  window.location.hash = '#/about';
});
afterEach(cleanup);

describe('About page', () => {
  it('explains what the site is and lists every game with a working link', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'About', level: 1 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /what this is/i })).toBeTruthy();
    const games = screen.getByRole('heading', { name: 'The games' }).closest('.card')!;
    for (const name of [
      'Jam Roulette',
      'Trade Fours',
      'Chord Dealer',
      'Constraint Cards',
      'Missing Member',
      'Hold the Pulse',
      'Genre Flip',
      'Song Sprint',
      'Daily Jam',
    ]) {
      const link = within(games as HTMLElement).getByRole('link', { name });
      expect(link.getAttribute('href')).toMatch(/^#\//);
    }
  });

  it('includes the how-to-get-the-most-out-of-it guide with real advice', () => {
    render(<App />);
    const guide = screen
      .getByRole('heading', { name: /get the most out of solo jamming/i })
      .closest('.card')!;
    expect(guide.querySelectorAll('li').length).toBeGreaterThanOrEqual(8);
    expect(guide.textContent).toMatch(/constraint/i);
    expect(guide.textContent).toMatch(/hold the pulse/i);
  });

  it('covers setup for stands, pedals, transposing instruments and capos', () => {
    render(<App />);
    const text = document.body.textContent ?? '';
    for (const word of ['Focus Mode', 'foot pedal', 'written pitch', 'capo', 'reduced-motion']) {
      expect(text).toContain(word);
    }
  });
});
