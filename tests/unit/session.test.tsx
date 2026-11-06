import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_PROFILE, saveProfile } from '../../src/state/profile';
import { loadStats } from '../../src/state/stats';
import { installFakeAudio } from './helpers/fakeAudio';

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
  });
  vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
  window.localStorage.clear();
  saveProfile({ ...DEFAULT_PROFILE, onboarded: true });
  window.location.hash = '#/roulette';
  installFakeAudio();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function playFor(seconds: number) {
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /▶ play/i })[0]);
  });
  await act(async () => {
    vi.advanceTimersByTime(seconds * 1000);
  });
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /■ stop/i })[0]);
  });
}

describe('session tracking', () => {
  it('counts a session and the minutes once the band has played long enough', async () => {
    render(<App />);
    await playFor(90);
    const stats = loadStats();
    expect(stats.sessions).toBe(1);
    expect(stats.minutes).toBeCloseTo(1.5, 1);
    expect(stats.perGame['/roulette']).toBe(1);
  });

  it('ignores accidental taps on Play', async () => {
    render(<App />);
    await playFor(3);
    expect(loadStats().sessions).toBe(0);
  });

  it('shows the stats on the Profile page', async () => {
    render(<App />);
    await playFor(120);
    act(() => {
      window.location.hash = '#/profile';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    const stats = screen.getByLabelText('Your stats');
    expect(stats.textContent).toContain('Sessions');
    expect(stats.textContent).toContain('Jam Roulette');
  });
});
