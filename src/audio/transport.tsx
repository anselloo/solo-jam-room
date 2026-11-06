import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getContext, unlockAudio } from './engine';
import {
  Scheduler,
  TIME_SIGNATURES,
  msUntil,
  tapTempo,
  type BeatEvent,
  type BeatListener,
  type TimeSignature,
} from './scheduler';
import { playClick } from './sounds';

export type BandPart = 'drums' | 'bass' | 'chords';
export const BAND_PARTS: readonly BandPart[] = ['drums', 'bass', 'chords'];

export interface PartMix {
  volume: number;
  muted: boolean;
}
export type Mixer = Record<BandPart, PartMix>;

export const DEFAULT_MIXER: Mixer = {
  drums: { volume: 0.8, muted: false },
  bass: { volume: 0.8, muted: false },
  chords: { volume: 0.7, muted: false },
};

export interface BeatPosition {
  bar: number;
  beat: number;
}

interface Transport {
  bpm: number;
  setBpm: (bpm: number) => void;
  signature: TimeSignature;
  setSignature: (sig: TimeSignature) => void;
  running: boolean;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;
  clickOn: boolean;
  setClickOn: (on: boolean) => void;
  mixer: Mixer;
  setPart: (part: BandPart, patch: Partial<PartMix>) => void;
  /** Register for scheduled beats (audio-clock times). Returns an unsubscribe function. */
  onBeat: (listener: BeatListener) => () => void;
  /** Beat currently sounding, for visuals. Null when stopped. */
  position: BeatPosition | null;
  /** Register a tap (tap tempo). Returns the detected BPM, if any. */
  tap: () => number | null;
}

const Ctx = createContext<Transport | null>(null);

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const clampBpm = (bpm: number): number =>
  Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));

export function TransportProvider({ children }: { children: ReactNode }) {
  const [bpm, setBpmState] = useState(100);
  const [signature, setSignatureState] = useState<TimeSignature>(TIME_SIGNATURES[0]);
  const [running, setRunning] = useState(false);
  const [clickOn, setClickOn] = useState(true);
  const [mixer, setMixer] = useState<Mixer>(DEFAULT_MIXER);
  const [position, setPosition] = useState<BeatPosition | null>(null);

  const scheduler = useRef<Scheduler | null>(null);
  const clickRef = useRef(clickOn);
  const taps = useRef<number[]>([]);
  const visualTimers = useRef<number[]>([]);
  const extra = useRef(new Set<BeatListener>());
  useEffect(() => {
    clickRef.current = clickOn;
  }, [clickOn]);

  const getScheduler = useCallback((): Scheduler => {
    if (!scheduler.current) {
      const s = new Scheduler(getContext());
      s.subscribe((e: BeatEvent) => {
        if (clickRef.current) playClick(e.time, e.beat === 0);
        extra.current.forEach((l) => l(e));
        // Flash the visual pulse when the beat actually sounds, not when it was scheduled.
        const id = window.setTimeout(
          () => setPosition({ bar: e.bar, beat: e.beat }),
          msUntil(e.time, getContext()),
        );
        visualTimers.current.push(id);
        if (visualTimers.current.length > 32) visualTimers.current.shift();
      });
      scheduler.current = s;
    }
    return scheduler.current;
  }, []);

  const setBpm = useCallback((value: number) => {
    const next = clampBpm(value);
    setBpmState(next);
    scheduler.current?.setTempo(next);
  }, []);

  const setSignature = useCallback((sig: TimeSignature) => {
    setSignatureState(sig);
    scheduler.current?.setSignature(sig);
  }, []);

  const start = useCallback(async () => {
    await unlockAudio();
    const s = getScheduler();
    s.setTempo(bpm);
    s.setSignature(signature);
    s.start();
    setRunning(true);
  }, [bpm, signature, getScheduler]);

  const stop = useCallback(() => {
    scheduler.current?.stop();
    visualTimers.current.forEach((id) => window.clearTimeout(id));
    visualTimers.current = [];
    setRunning(false);
    setPosition(null);
  }, []);

  const toggle = useCallback(async () => {
    if (running) stop();
    else await start();
  }, [running, start, stop]);

  const setPart = useCallback((part: BandPart, patch: Partial<PartMix>) => {
    setMixer((m) => ({ ...m, [part]: { ...m[part], ...patch } }));
  }, []);

  const onBeat = useCallback((listener: BeatListener) => {
    extra.current.add(listener);
    return () => {
      extra.current.delete(listener);
    };
  }, []);

  const tap = useCallback((): number | null => {
    taps.current.push(performance.now() / 1000);
    taps.current = taps.current.slice(-8);
    const detected = tapTempo(taps.current);
    if (detected !== null) setBpm(detected);
    return detected;
  }, [setBpm]);

  useEffect(() => () => scheduler.current?.stop(), []);

  const value = useMemo<Transport>(
    () => ({
      bpm,
      setBpm,
      signature,
      setSignature,
      running,
      start,
      stop,
      toggle,
      clickOn,
      setClickOn,
      mixer,
      setPart,
      onBeat,
      position,
      tap,
    }),
    [
      bpm,
      setBpm,
      signature,
      setSignature,
      running,
      start,
      stop,
      toggle,
      clickOn,
      mixer,
      setPart,
      onBeat,
      position,
      tap,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTransport(): Transport {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTransport must be used inside TransportProvider');
  return v;
}
