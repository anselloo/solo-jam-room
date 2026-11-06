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
import { realizeRoman, type Chord } from '../theory/chords';
import { parseNote } from '../theory/notes';
import { Band } from './band/band';
import { GROOVES, grooveById } from './band/grooves';
import { WebAudioVoices } from './band/voices';
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
  /** Bar since the end of the count-in; negative during the count-in. */
  bar: number;
  beat: number;
  /** Chord sounding in this bar, if the band has a progression. */
  chord: Chord | null;
}

export interface StartOptions {
  /** Bars of click before the band comes in. Defaults to one. */
  countIn?: number;
}

interface Transport {
  bpm: number;
  setBpm: (bpm: number) => void;
  signature: TimeSignature;
  setSignature: (sig: TimeSignature) => void;
  running: boolean;
  start: (options?: StartOptions) => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;
  clickOn: boolean;
  setClickOn: (on: boolean) => void;
  mixer: Mixer;
  setPart: (part: BandPart, patch: Partial<PartMix>) => void;
  bandOn: boolean;
  setBandOn: (on: boolean) => void;
  grooveId: string;
  setGrooveId: (id: string) => void;
  progression: Chord[];
  setProgression: (chords: Chord[], barsPerChord?: number) => void;
  /** The band, once audio has been unlocked (null before the first Play). */
  getBand: () => Band | null;
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

/** A friendly default so the band has something to play before a game sets a progression. */
const DEFAULT_PROGRESSION: Chord[] = ['I', 'vi', 'IV', 'V'].map((r) =>
  realizeRoman(r, { root: parseNote('C'), mode: 'major' }),
);

export function TransportProvider({ children }: { children: ReactNode }) {
  const [bpm, setBpmState] = useState(100);
  const [signature, setSignatureState] = useState<TimeSignature>(TIME_SIGNATURES[0]);
  const [running, setRunning] = useState(false);
  const [clickOn, setClickOn] = useState(true);
  const [mixer, setMixer] = useState<Mixer>(DEFAULT_MIXER);
  const [bandOn, setBandOn] = useState(true);
  const [grooveId, setGrooveIdState] = useState(GROOVES[0].id);
  const [progression, setProgressionState] = useState<Chord[]>(DEFAULT_PROGRESSION);
  const [position, setPosition] = useState<BeatPosition | null>(null);

  const scheduler = useRef<Scheduler | null>(null);
  const band = useRef<Band | null>(null);
  const clickRef = useRef(clickOn);
  const bandOnRef = useRef(bandOn);
  const countInRef = useRef(0);
  // The latest tempo and meter, readable synchronously. A game often sets them and calls start()
  // in the same handler, before React has re-rendered with the new state.
  const bpmRef = useRef(100);
  const signatureRef = useRef<TimeSignature>(TIME_SIGNATURES[0]);
  const taps = useRef<number[]>([]);
  const visualTimers = useRef<number[]>([]);
  const extra = useRef(new Set<BeatListener>());
  // Latest band configuration, so a band created on first Play starts out up to date.
  const config = useRef({ grooveId, progression, barsPerChord: 1, mixer });

  useEffect(() => {
    clickRef.current = clickOn;
    bandOnRef.current = bandOn;
  }, [clickOn, bandOn]);

  const getBand = useCallback((): Band | null => band.current, []);

  const ensureBand = useCallback((): Band => {
    if (!band.current) {
      const b = new Band(new WebAudioVoices());
      const c = config.current;
      b.setGroove(grooveById(c.grooveId) ?? GROOVES[0]);
      b.setProgression(c.progression, c.barsPerChord);
      for (const part of BAND_PARTS) b.setPart(part, c.mixer[part]);
      band.current = b;
    }
    return band.current;
  }, []);

  const getScheduler = useCallback((): Scheduler => {
    if (!scheduler.current) {
      const s = new Scheduler(getContext());
      s.subscribe((raw: BeatEvent) => {
        // Bars before the count-in ends are negative, so the band's bar 0 is always the first
        // bar after the count-in.
        const e: BeatEvent = { ...raw, bar: raw.bar - countInRef.current };
        const counting = e.bar < 0;
        if (clickRef.current || counting) playClick(e.time, e.beat === 0);
        if (bandOnRef.current) band.current?.scheduleBeat(e);
        extra.current.forEach((l) => l(e));
        // Flash the visual pulse when the beat actually sounds, not when it was scheduled.
        const chord = counting ? null : (band.current?.chordForBar(e.bar) ?? null);
        const id = window.setTimeout(
          () => setPosition({ bar: e.bar, beat: e.beat, chord }),
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
    bpmRef.current = next;
    setBpmState(next);
    scheduler.current?.setTempo(next);
  }, []);

  const setSignature = useCallback((sig: TimeSignature) => {
    signatureRef.current = sig;
    setSignatureState(sig);
    scheduler.current?.setSignature(sig);
  }, []);

  const start = useCallback(
    async (options: StartOptions = {}) => {
      await unlockAudio();
      ensureBand();
      const s = getScheduler();
      countInRef.current = options.countIn ?? 1;
      s.setTempo(bpmRef.current);
      s.setSignature(signatureRef.current);
      s.start();
      setRunning(true);
    },
    [getScheduler, ensureBand],
  );

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
    const next = { ...config.current.mixer, [part]: { ...config.current.mixer[part], ...patch } };
    config.current.mixer = next;
    band.current?.setPart(part, next[part]);
    setMixer(next);
  }, []);

  const setGrooveId = useCallback((id: string) => {
    const g = grooveById(id);
    if (!g) return;
    setGrooveIdState(id);
    config.current.grooveId = id;
    band.current?.setGroove(g);
  }, []);

  const setProgression = useCallback((chords: Chord[], barsPerChord = 1) => {
    setProgressionState(chords);
    config.current.progression = chords;
    config.current.barsPerChord = barsPerChord;
    band.current?.setProgression(chords, barsPerChord);
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
      bandOn,
      setBandOn,
      grooveId,
      setGrooveId,
      progression,
      setProgression,
      getBand,
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
      bandOn,
      grooveId,
      setGrooveId,
      progression,
      setProgression,
      getBand,
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
