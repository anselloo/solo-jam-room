import { useCallback, useEffect, useRef, useState } from 'react';

/** Whole seconds left until `endAt`, never negative. Based on timestamps, not tick counting. */
export function remainingAt(endAt: number, now: number): number {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

/** 75 -> "1:15", 3600 -> "60:00". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Options {
  /** Fire once each time the countdown first reaches one of these remaining seconds. */
  warnAt?: readonly number[];
  onWarn?: (secondsLeft: number) => void;
  onDone?: () => void;
}

export interface Countdown {
  remaining: number;
  running: boolean;
  start: () => void;
  pause: () => void;
  reset: (durationSec?: number) => void;
}

/**
 * Countdown that keeps correct time when the tab is backgrounded: browsers throttle timers in
 * hidden tabs, so each tick recomputes the time left from the wall clock rather than counting.
 */
export function useCountdown(durationSec: number, options: Options = {}): Countdown {
  const [duration, setDuration] = useState(durationSec);
  const [remaining, setRemaining] = useState(durationSec);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);
  const left = useRef(durationSec * 1000);
  const fired = useRef(new Set<number>());
  const finished = useRef(false);
  const opts = useRef(options);

  useEffect(() => {
    opts.current = options;
  });

  const tick = useCallback(() => {
    if (finished.current) return;
    const secs = remainingAt(endAt.current, Date.now());
    setRemaining(secs);
    for (const w of opts.current.warnAt ?? []) {
      if (secs <= w && secs > 0 && !fired.current.has(w)) {
        fired.current.add(w);
        opts.current.onWarn?.(w);
      }
    }
    if (secs <= 0) {
      finished.current = true;
      setRunning(false);
      left.current = 0;
      opts.current.onDone?.();
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(tick, 250);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [running, tick]);

  const start = useCallback(() => {
    if (left.current <= 0) left.current = duration * 1000;
    endAt.current = Date.now() + left.current;
    finished.current = false;
    setRunning(true);
  }, [duration]);

  const pause = useCallback(() => {
    left.current = Math.max(0, endAt.current - Date.now());
    setRunning(false);
    setRemaining(Math.ceil(left.current / 1000));
  }, []);

  const reset = useCallback(
    (next?: number) => {
      const d = next ?? duration;
      setDuration(d);
      left.current = d * 1000;
      fired.current = new Set();
      finished.current = false;
      setRemaining(d);
      setRunning(false);
    },
    [duration],
  );

  return { remaining, running, start, pause, reset };
}

interface TimerProps {
  remaining: number;
  /** Highlight when this many seconds or fewer are left. */
  warnAt?: number;
  label?: string;
}

/** Large countdown readout. */
export function Timer({ remaining, warnAt = 60, label = 'Time left' }: TimerProps) {
  return (
    <div className="timer" data-warn={remaining <= warnAt} role="timer" aria-label={label}>
      <span className="timer__digits">{formatClock(remaining)}</span>
    </div>
  );
}
