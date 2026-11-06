import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import * as sounds from '../../src/audio/sounds';
import { DEFAULT_PROFILE, saveProfile } from '../../src/state/profile';
import { DEFAULT_SETTINGS, saveSettings } from '../../src/state/settings';
import { loadStats } from '../../src/state/stats';
import { audioNow, installFakeAudio, setAudioNow } from './helpers/fakeAudio';

/** Advance the audio clock and timers together up to an exact audio time. */
async function advanceTo(t: number) {
  while (audioNow() + 0.025 <= t + 1e-9) {
    setAudioNow(audioNow() + 0.025);
    await act(async () => {
      vi.advanceTimersByTime(25);
    });
  }
  setAudioNow(t);
}

/** Tap at an exact audio time, the way a key press is stamped with the audio clock. */
async function tapAt(t: number, key = ' ') {
  await advanceTo(t);
  fireEvent.keyDown(window, { key });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  window.localStorage.clear();
  saveProfile({ ...DEFAULT_PROFILE, onboarded: true });
  window.location.hash = '#/hold-the-pulse';
  installFakeAudio();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function startShortGame() {
  render(<App />);
  // 120 BPM: a beat is 0.5 s and a bar 2 s. One bar of click, two bars of silence, one round.
  fireEvent.change(screen.getByLabelText('Tempo (BPM)'), { target: { value: '120' } });
  fireEvent.change(screen.getByLabelText('Bars with click'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Bars of silence'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Rounds'), { target: { value: '1' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
  });
  // The transport starts 0.05 s after pressing Start: click bar 0.05-2.05, silence 2.05-6.05.
}

const silentBeats = Array.from({ length: 8 }, (_, k) => 2.05 + k * 0.5);

describe('Hold the Pulse page', () => {
  it('renders its settings and presets', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /hold the pulse/i })).toBeTruthy();
    for (const p of ['Easy', 'Standard', 'Hard'])
      expect(screen.getByRole('button', { name: p })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    expect((screen.getByLabelText('Tempo (BPM)') as HTMLInputElement).value).toBe('140');
    expect((screen.getByLabelText('Bars of silence') as HTMLSelectElement).value).toBe('16');
  });

  it('drops the click for the silent section and brings it back', async () => {
    const click = vi.spyOn(sounds, 'playClick');
    await startShortGame();
    await advanceTo(8.5);
    const times = click.mock.calls.map((c) => c[0]);
    const EPS = 1e-6;
    expect(times.filter((t) => t >= 0.05 - EPS && t < 2.05 - EPS).length).toBe(4);
    expect(times.filter((t) => t >= 2.05 - EPS && t < 6.05 - EPS)).toHaveLength(0);
    expect(times.filter((t) => t >= 6.05 - EPS).length).toBeGreaterThanOrEqual(4);
  });

  it('scores steady tapping as locked in and saves the best score for the tempo', async () => {
    await startShortGame();
    for (const t of silentBeats) await tapAt(t);
    await advanceTo(6.3);
    const results = screen.getByLabelText('Results');
    expect(results.textContent).toContain('Locked in');
    expect(results.textContent).toContain('8');
    expect(results.querySelector('svg circle')).toBeTruthy();
    expect(loadStats().pulseBests['120']).toMatchObject({ rank: 0 });
    // After the click returns for a bar the game finishes.
    await advanceTo(8.6);
    expect(screen.getByRole('button', { name: /again/i })).toBeTruthy();
  });

  it('flags a rushed tempo as off to the races', async () => {
    await startShortGame();
    // 140 BPM taps against a 120 BPM click.
    for (let k = 0; k < 8; k++) await tapAt(2.05 + k * (60 / 140));
    await advanceTo(6.3);
    expect(screen.getByLabelText('Results').textContent).toContain('Off to the races');
    expect(loadStats().pulseBests['120'].rank).toBe(3);
  });

  it('ignores taps made while the click is still playing', async () => {
    await startShortGame();
    for (let k = 0; k < 4; k++) await tapAt(0.1 + k * 0.5); // practising along with the click
    for (const t of silentBeats) await tapAt(t);
    await advanceTo(6.3);
    expect(screen.getByLabelText('Results').textContent).toContain('Locked in');
  });

  it('says so when there are too few taps', async () => {
    await startShortGame();
    await tapAt(2.1);
    await advanceTo(6.3);
    expect(screen.getByLabelText('Results').textContent).toMatch(/not enough taps/i);
    expect(loadStats().pulseBests['120']).toBeUndefined();
  });

  it('uses whatever key is mapped as the tap key', async () => {
    saveSettings({ ...DEFAULT_SETTINGS, pulseTapKey: 'PageDown' });
    await startShortGame();
    for (const t of silentBeats) await tapAt(t, 'PageDown');
    await advanceTo(6.3);
    expect(screen.getByLabelText('Results').textContent).toContain('Locked in');
  });

  it('does not treat Space as a tap when another key is mapped', async () => {
    saveSettings({ ...DEFAULT_SETTINGS, pulseTapKey: 'PageDown' });
    await startShortGame();
    for (const t of silentBeats) await tapAt(t, ' ');
    await advanceTo(6.3);
    expect(screen.getByLabelText('Results').textContent).toMatch(/not enough taps/i);
  });
});
