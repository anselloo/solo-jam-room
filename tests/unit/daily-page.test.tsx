import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { dailyChallenge } from '../../src/games/daily/daily';
import { DEFAULT_PROFILE, saveProfile } from '../../src/state/profile';
import { loadStats } from '../../src/state/stats';
import { installFakeAudio } from './helpers/fakeAudio';

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
  });
  window.localStorage.clear();
  saveProfile({ ...DEFAULT_PROFILE, onboarded: true });
  installFakeAudio();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function setClock(y: number, m: number, d: number, h = 12, min = 0, s = 0) {
  vi.setSystemTime(new Date(y, m - 1, d, h, min, s));
  await act(async () => {
    vi.advanceTimersByTime(31_000); // let the page notice (it checks every 30 s)
  });
}

const streak = () => screen.getByLabelText('Streak').querySelector('.streak')!.textContent;

describe('Daily Jam page', () => {
  it("shows today's challenge, the same one the generator makes for the local date", () => {
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
    window.location.hash = '#/daily';
    render(<App />);
    const c = dailyChallenge('2026-06-10');
    expect(screen.getByLabelText("Today's challenge").textContent).toContain(c.summary);
    expect(screen.getByRole('link', { name: new RegExp(`open ${c.title}`, 'i') })).toBeTruthy();
    expect(streak()).toContain('0');
  });

  it('marks the day done once and extends the streak across days, but resets after a skipped day', async () => {
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
    window.location.hash = '#/daily';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /i did it/i }));
    expect(loadStats().daily.done).toEqual(['2026-06-10']);
    expect(streak()).toContain('1');
    expect(
      (screen.getByRole('button', { name: /done for today/i }) as HTMLButtonElement).disabled,
    ).toBe(true);

    // Next day: a new challenge, and yesterday's streak still counts until today is skipped.
    await setClock(2026, 6, 11);
    expect(screen.getByLabelText("Today's challenge").textContent).toContain(
      dailyChallenge('2026-06-11').summary,
    );
    expect(streak()).toContain('1');
    fireEvent.click(screen.getByRole('button', { name: /i did it/i }));
    expect(streak()).toContain('2');
    expect(loadStats().daily.best).toBe(2);

    // Skip a day entirely: the streak is gone, the best remains.
    await setClock(2026, 6, 13);
    expect(streak()).toContain('0');
    expect(screen.getByText(/best streak: 2/i)).toBeTruthy();
  });

  it('rolls over at local midnight', async () => {
    vi.setSystemTime(new Date(2026, 5, 10, 23, 59, 40));
    window.location.hash = '#/daily';
    render(<App />);
    expect(screen.getByLabelText("Today's challenge").textContent).toContain(
      dailyChallenge('2026-06-10').summary,
    );
    await act(async () => {
      vi.setSystemTime(new Date(2026, 5, 11, 0, 0, 5));
      vi.advanceTimersByTime(31_000);
    });
    expect(screen.getByLabelText("Today's challenge").textContent).toContain(
      dailyChallenge('2026-06-11').summary,
    );
  });

  it('shows the last seven days with today marked', () => {
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
    window.location.hash = '#/daily';
    render(<App />);
    const week = screen.getByLabelText('Last seven days').querySelectorAll('li');
    expect(week).toHaveLength(7);
    expect(week[6].getAttribute('aria-label')).toContain('2026-06-10');
    expect(week[6].getAttribute('aria-label')).toContain('today');
    expect(week[0].getAttribute('aria-label')).toContain('2026-06-04');
  });

  it('appears on the home page with the streak', () => {
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
    window.location.hash = '#/';
    render(<App />);
    expect(screen.getByLabelText('Current streak: 0 days')).toBeTruthy();
    expect(screen.getByText(dailyChallenge('2026-06-10').summary)).toBeTruthy();
  });
});
