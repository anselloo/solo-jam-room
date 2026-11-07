import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

function mockMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '#/roulette';
});
afterEach(() => {
  cleanup();
  // @ts-expect-error restore jsdom default (no matchMedia)
  delete window.matchMedia;
});

async function open() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: /skip for now/i }));
  return user;
}

describe('Jam Roulette page', () => {
  it('reveals the result instantly for reduced-motion users', async () => {
    mockMotion(true);
    const user = await open();
    expect(screen.queryByLabelText('Result')).toBeNull();
    await user.keyboard(' ');
    const result = screen.getByLabelText('Result');
    expect(within(result).getByText(/BPM/)).toBeTruthy();
    expect(within(result).getByText(/Play these notes/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /play/i }).length).toBeGreaterThanOrEqual(2);
  });

  it('animates the reels, then shows the result (and skips on a second press)', async () => {
    mockMotion(false);
    const user = await open();
    await user.keyboard(' ');
    expect(screen.queryByLabelText('Result')).toBeNull();
    expect(screen.getByRole('button', { name: /skip/i })).toBeTruthy();
    await user.keyboard(' ');
    expect(screen.getByLabelText('Result')).toBeTruthy();
  });

  it('keeps a locked reel through re-rolls and goes back to the previous result', async () => {
    mockMotion(true);
    const user = await open();
    await user.keyboard(' ');
    const keyReel = () =>
      screen.getAllByText('Key')[0].closest('.reel')!.querySelector('.reel__window')!.textContent;
    const first = keyReel();
    await user.click(screen.getByRole('button', { name: /lock key/i }));
    for (let i = 0; i < 8; i++) await user.keyboard('r');
    expect(keyReel()).toBe(first);
    await user.keyboard('{Backspace}');
    expect(screen.getByLabelText('Result')).toBeTruthy();
  });

  it('limits beginners to major and minor in 4/4', async () => {
    mockMotion(true);
    const user = await open();
    for (let i = 0; i < 25; i++) {
      await user.keyboard('r');
      const text = screen.getByLabelText('Result').textContent ?? '';
      expect(text).toMatch(/Major|Minor/);
      expect(text).toContain('4/4');
    }
  });

  it('offers the constraint deck as an overlay', async () => {
    mockMotion(true);
    const user = await open();
    await user.click(screen.getByRole('button', { name: /constraint cards/i }));
    await user.click(screen.getByRole('button', { name: /draw a card/i }));
    expect(screen.getByRole('complementary', { name: /constraint card/i })).toBeTruthy();
  });
});
