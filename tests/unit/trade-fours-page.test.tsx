import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_PROFILE, saveProfile } from '../../src/state/profile';
import { Band } from '../../src/audio/band/band';
import { audioNow, installFakeAudio, setAudioNow } from './helpers/fakeAudio';

/** Move the fake audio clock and the real timers forward together, in 25 ms steps. */
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
  window.location.hash = '#/trade-fours';
  installFakeAudio();
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  vi.useRealTimers();
});

const headline = () => document.querySelector('.turn .prompt')?.textContent;

describe('Trade Fours page', () => {
  it('renders settings and an idle state', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /trade fours/i })).toBeTruthy();
    expect(headline()).toBe('Ready?');
    for (const label of ['Phrase length', 'Key', 'Mode', 'Groove', 'App phrase style', 'Rounds']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByLabelText(/echo mode/i)).toBeTruthy();
  });

  it('counts in, then switches turns exactly on the downbeat, then finishes', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Phrase length'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Rounds'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'major' } });

    // 100 BPM in 4/4: a bar is 2.4 s. The transport starts 0.05 s after pressing Start.
    const lead = vi.spyOn(Band.prototype, 'playLead');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    });
    await advance(1);
    expect(headline()).toBe('Get ready…');

    // Count-in ends at 0.05 + 2.4 = 2.45 s: your turn begins.
    await advance(1.3);
    expect(audioNow()).toBeCloseTo(2.3, 1);
    expect(headline()).toBe('Get ready…');
    await advance(0.3);
    expect(headline()).toBe('YOUR TURN');

    // Your two-bar turn runs to 2.45 + 4.8 = 7.25 s. The last bar starts at 4.85 s.
    await advance(2.4);
    expect(screen.queryByText(/switching next bar/i)).toBeTruthy();
    await advance(2.3); // t ~ 7.3 s, just after the downbeat
    expect(audioNow()).toBeGreaterThan(7.25);
    expect(headline()).toBe("APP'S TURN");

    // Just before the downbeat it was still your turn. Re-run to check by stepping finely.
    expect(lead.mock.calls.length).toBeGreaterThan(0);
    // Every lead note was scheduled at or after the app's turn began (the 7.25 s downbeat).
    for (const [time] of lead.mock.calls) expect(time).toBeGreaterThanOrEqual(7.25 - 1e-6);
    // And all of them fit inside the app's two-bar turn.
    for (const [time] of lead.mock.calls) expect(time).toBeLessThan(12.05);

    // The app's turn ends at 12.05 s; the page finishes after the end chime.
    await advance(5.5);
    expect(headline()).toBe('Nice trading!');
  });

  it('does not switch before the downbeat', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Phrase length'), { target: { value: '2' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    });
    await advance(7.2); // 0.05 s before the 7.25 s switch
    expect(headline()).toBe('YOUR TURN');
    await advance(0.15);
    expect(headline()).toBe("APP'S TURN");
  });

  it('starts with the app in echo mode', async () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText(/echo mode/i));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    });
    await advance(2.8);
    expect(headline()).toBe("APP'S TURN");
    expect(screen.getByText(/listen closely/i)).toBeTruthy();
  });

  it('can be paused, skipped and ended', async () => {
    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    });
    await advance(3);
    expect(headline()).toBe('YOUR TURN');
    // Skip ends the turn after the bar that is playing now (bar 0 -> switch at 4.85 s).
    fireEvent.click(screen.getByRole('button', { name: /skip turn/i }));
    await advance(2.1);
    expect(headline()).toBe("APP'S TURN");
    fireEvent.click(screen.getByRole('button', { name: /^pause$/i }));
    expect(headline()).toBe('Paused');
    fireEvent.click(screen.getByRole('button', { name: /^end$/i }));
    expect(headline()).toBe('Ready?');
  });
});
