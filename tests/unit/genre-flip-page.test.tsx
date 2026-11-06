import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_PROFILE, saveProfile } from '../../src/state/profile';
import { audioNow, installFakeAudio, setAudioNow } from './helpers/fakeAudio';

async function advance(seconds: number) {
  const steps = Math.round((seconds * 1000) / 25);
  for (let i = 0; i < steps; i++) {
    setAudioNow(audioNow() + 0.025);
    await act(async () => {
      vi.advanceTimersByTime(25);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
  });
  vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
  window.localStorage.clear();
  saveProfile({ ...DEFAULT_PROFILE, onboarded: true });
  window.location.hash = '#/genre-flip';
  installFakeAudio();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const prompts = () =>
  Array.from(document.querySelectorAll('.turn .prompt')).map((p) => p.textContent);
const timer = () => screen.getByRole('timer').textContent;

async function draw() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^draw$|skip to next|^next$/i }));
  });
}

describe('Genre Flip page', () => {
  it('starts idle with a Draw button', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /genre flip/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^draw$/i })).toBeTruthy();
    expect(screen.queryByRole('timer')).toBeNull();
  });

  it('deals a tune and a style, starts the band, and starts the 3-minute timer after the count-in', async () => {
    render(<App />);
    await draw();
    const [tune, genre] = prompts();
    expect(tune && genre).toBeTruthy();
    expect(timer()).toBe('3:00');
    // One bar of count-in at the dealt tempo; the timer must not run during it.
    await advance(1);
    expect(timer()).toBe('3:00');
    await advance(12);
    expect(timer()).not.toBe('3:00');
    const [, s] = timer()!.split(':').map(Number);
    expect(s).toBeLessThan(60);
    expect(screen.getAllByRole('button', { name: /■ stop/i }).length).toBeGreaterThan(0);
  });

  it('re-rolls the tune or the style on its own, and goes back', async () => {
    render(<App />);
    await draw();
    const first = prompts();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /new tune/i }));
    });
    const afterTune = prompts();
    expect(afterTune[0]).not.toBe(first[0]);
    expect(afterTune[1]).toBe(first[1]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /new style/i }));
    });
    const afterStyle = prompts();
    expect(afterStyle[0]).toBe(afterTune[0]);
    expect(afterStyle[1]).not.toBe(afterTune[1]);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    });
    expect(prompts()).toEqual(afterTune);
  });

  it('never repeats a tune until every tune has been drawn', async () => {
    render(<App />);
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      await draw();
      seen.add(prompts()[0]!);
    }
    expect(seen.size).toBe(12);
  });

  it('only shows titles and origins, never lyrics or notation', async () => {
    render(<App />);
    await draw();
    const text = document.querySelector('.turn')?.textContent ?? '';
    expect(text.length).toBeLessThan(400);
  });
});
