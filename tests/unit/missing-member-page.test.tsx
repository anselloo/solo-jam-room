import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { WebAudioVoices } from '../../src/audio/band/voices';
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
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  window.localStorage.clear();
  saveProfile({ ...DEFAULT_PROFILE, onboarded: true });
  window.location.hash = '#/missing-member';
  installFakeAudio();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const banner = () => document.querySelector('.turn .prompt')?.textContent ?? '';

describe('Missing Member page', () => {
  it('renders settings and an idle prompt', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /missing member/i })).toBeTruthy();
    expect(screen.getByText(/one member short/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Drums' })).toBeTruthy();
    expect(screen.getByLabelText('Round length')).toBeTruthy();
  });

  it('keeps at least one role enabled', () => {
    render(<App />);
    for (const name of ['Drums', 'Bass', 'Chords'])
      fireEvent.click(screen.getByRole('button', { name }));
    fireEvent.click(screen.getByRole('button', { name: 'Lead melody' }));
    expect(screen.getByRole('button', { name: 'Lead melody' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('silences exactly the missing part and swaps roles on the downbeat', async () => {
    const calls: { part: 'drums' | 'bass' | 'chords'; time: number }[] = [];
    const rec = (part: 'drums' | 'bass' | 'chords') =>
      function (this: unknown, time: number) {
        calls.push({ part, time });
      };
    vi.spyOn(WebAudioVoices.prototype, 'kick').mockImplementation(rec('drums'));
    vi.spyOn(WebAudioVoices.prototype, 'snare').mockImplementation(rec('drums'));
    vi.spyOn(WebAudioVoices.prototype, 'hat').mockImplementation(rec('drums'));
    vi.spyOn(WebAudioVoices.prototype, 'bass').mockImplementation(rec('bass'));
    vi.spyOn(WebAudioVoices.prototype, 'pad').mockImplementation(rec('chords'));

    render(<App />);
    // Only drums and bass can go missing, so the two rounds must differ.
    fireEvent.click(screen.getByRole('button', { name: 'Chords' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lead melody' }));
    fireEvent.change(screen.getByLabelText('Round length'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'major' } });
    fireEvent.click(screen.getByLabelText(/roll a tempo/i)); // keep the dock's 100 BPM and rock groove

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    });
    await advance(1);
    expect(banner()).toBe('Get ready…');

    // 100 BPM: a bar is 2.4 s. The count-in is 0.05..2.45 s; round 0 is 2.45..12.05 s.
    await advance(5);
    const first = banner();
    expect(first).toMatch(/^No (drummer|bassist) tonight/);
    const missing0 = /drummer/.test(first) ? 'drums' : 'bass';
    const other0 = missing0 === 'drums' ? 'bass' : 'drums';

    // The warning shows during the last bar (9.65 s onwards) and the chime plays.
    await advance(4);
    expect(screen.getAllByText(/next round/i).length).toBeGreaterThan(0);

    // Just before the downbeat nothing has changed; just after, the roles have swapped.
    await advance(2.0); // t ~ 12.0
    expect(banner()).toBe(first);
    await advance(0.5);
    expect(banner()).not.toBe(first);
    await advance(1.5);

    // Beat times are sums of floats (e.g. 12.049999999999999), so compare with a tolerance.
    const EPS = 1e-6;
    const ROUND1 = 12.05 - EPS;
    const inRound0 = (p: string) =>
      calls.filter((c) => c.part === p && c.time >= 2.45 - EPS && c.time < ROUND1);
    const inRound1 = (p: string) => calls.filter((c) => c.part === p && c.time >= ROUND1);

    // Round 0: the missing part never sounds; the other does.
    expect(inRound0(missing0)).toHaveLength(0);
    expect(inRound0(other0).length).toBeGreaterThan(10);
    // Round 1: roles are reversed, and the swap lands on the 12.05 s downbeat.
    expect(inRound1(other0)).toHaveLength(0);
    expect(inRound1(missing0).length).toBeGreaterThan(5);
    const firstBack = Math.min(...inRound1(missing0).map((c) => c.time));
    expect(firstBack).toBeGreaterThanOrEqual(ROUND1);
    expect(firstBack).toBeLessThan(12.05 + 0.3);
    // Nothing from the previously present part leaks past the boundary.
    expect(calls.filter((c) => c.part === other0 && c.time >= ROUND1)).toHaveLength(0);
  });
});
