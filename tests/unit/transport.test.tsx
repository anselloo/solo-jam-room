import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sounds from '../../src/audio/sounds';
import { TransportProvider, useTransport } from '../../src/audio/transport';
import { signatureOf } from '../../src/games/roulette/roulette';
import { AppStateProvider } from '../../src/state/AppState';
import { audioNow, installFakeAudio, setAudioNow } from './helpers/fakeAudio';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>
    <TransportProvider>{children}</TransportProvider>
  </AppStateProvider>
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  installFakeAudio();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function run(seconds: number) {
  for (let i = 0; i < Math.round(seconds / 0.025); i++) {
    setAudioNow(audioNow() + 0.025);
    await act(async () => {
      vi.advanceTimersByTime(25);
    });
  }
}

describe('transport', () => {
  it('starts at the tempo and meter set in the same handler, not the previous ones', async () => {
    const click = vi.spyOn(sounds, 'playClick');
    const { result } = renderHook(() => useTransport(), { wrapper });
    await act(async () => {
      // Games do exactly this: set the result's tempo and meter, then start.
      result.current.setBpm(150);
      result.current.setSignature(signatureOf('3/4'));
      await result.current.start({ countIn: 0 });
    });
    await run(3);
    const times = click.mock.calls.map((c) => c[0]);
    expect(times[1] - times[0]).toBeCloseTo(60 / 150, 6);
    // 3/4: the accent (second argument) falls on every third click.
    const accents = click.mock.calls.map((c) => c[1]);
    expect(accents.slice(0, 7)).toEqual([true, false, false, true, false, false, true]);
  });

  it('clamps the tempo', async () => {
    const { result } = renderHook(() => useTransport(), { wrapper });
    act(() => result.current.setBpm(1000));
    expect(result.current.bpm).toBe(240);
    act(() => result.current.setBpm(1));
    expect(result.current.bpm).toBe(40);
  });
});
