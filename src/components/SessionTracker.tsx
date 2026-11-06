import { useEffect, useRef } from 'react';
import { useTransport } from '../audio/transport';
import { pathFromHash } from '../routes';
import { useApp } from '../state/AppState';
import { recordSession } from '../state/stats';

/** Sessions shorter than this are accidental taps on Play, not jams. */
export const MIN_SESSION_SECONDS = 10;

/** Counts a session (and minutes jammed) each time the backing band runs long enough. Renders nothing. */
export function SessionTracker() {
  const { running } = useTransport();
  const { updateStats } = useApp();
  const startedAt = useRef<{ at: number; game: string } | null>(null);

  useEffect(() => {
    if (running) {
      startedAt.current = { at: Date.now(), game: pathFromHash(window.location.hash) };
      return;
    }
    const s = startedAt.current;
    startedAt.current = null;
    if (!s) return;
    const seconds = (Date.now() - s.at) / 1000;
    if (seconds >= MIN_SESSION_SECONDS) {
      updateStats((st) => recordSession(st, s.game, seconds / 60));
    }
  }, [running, updateStats]);

  return null;
}
