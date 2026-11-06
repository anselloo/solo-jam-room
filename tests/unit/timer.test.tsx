import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatClock, remainingAt, useCountdown } from '../../src/components/Timer';

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
  });
  vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

describe('clock helpers', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(900)).toBe('15:00');
    expect(formatClock(-4)).toBe('0:00');
  });
  it('computes remaining time from timestamps', () => {
    expect(remainingAt(10_000, 0)).toBe(10);
    expect(remainingAt(10_000, 9_001)).toBe(1);
    expect(remainingAt(10_000, 10_000)).toBe(0);
    expect(remainingAt(10_000, 99_000)).toBe(0);
  });
});

describe('useCountdown', () => {
  it('counts down and finishes once', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useCountdown(5, { onDone }));
    expect(result.current.remaining).toBe(5);
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.remaining).toBe(3);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.remaining).toBe(0);
    expect(result.current.running).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps correct time when timers are throttled in a background tab', () => {
    const { result } = renderHook(() => useCountdown(15 * 60));
    act(() => result.current.start());
    // The tab is hidden: no ticks fire, but the wall clock moves 10 minutes.
    vi.setSystemTime(new Date(2026, 0, 1, 12, 10, 0));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.remaining).toBe(5 * 60);
  });

  it('fires each warning once, even if several thresholds are crossed at once', () => {
    const onWarn = vi.fn();
    const { result } = renderHook(() => useCountdown(600, { warnAt: [300, 60], onWarn }));
    act(() => result.current.start());
    vi.setSystemTime(new Date(2026, 0, 1, 12, 9, 30)); // 30 s left: both thresholds crossed
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onWarn.mock.calls.map((c) => c[0]).sort((a, b) => a - b)).toEqual([60, 300]);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onWarn).toHaveBeenCalledTimes(2);
  });

  it('pauses, resumes and resets', () => {
    const { result } = renderHook(() => useCountdown(60));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    act(() => result.current.pause());
    expect(result.current.remaining).toBe(50);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.remaining).toBe(50);
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.remaining).toBe(45);
    act(() => result.current.reset(120));
    expect(result.current.remaining).toBe(120);
    expect(result.current.running).toBe(false);
  });
});
