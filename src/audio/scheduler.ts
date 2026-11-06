/**
 * Lookahead scheduler: a coarse timer (~25 ms) schedules beats that fall inside a short
 * window (~100 ms) ahead of the audio clock, so musical timing never depends on timer jitter.
 */

export interface TimeSignature {
  /** Beats per bar. */
  beats: number;
  /** Note value that gets the beat: 4 = quarter, 8 = eighth. */
  unit: 4 | 8;
}

export const TIME_SIGNATURES: readonly TimeSignature[] = [
  { beats: 4, unit: 4 },
  { beats: 3, unit: 4 },
  { beats: 6, unit: 8 },
  { beats: 5, unit: 4 },
  { beats: 7, unit: 8 },
];

export const signatureLabel = (s: TimeSignature): string => `${s.beats}/${s.unit}`;

export function sameSignature(a: TimeSignature, b: TimeSignature): boolean {
  return a.beats === b.beats && a.unit === b.unit;
}

/** Seconds per beat. BPM always counts quarter notes; eighth-note meters beat twice as fast. */
export function beatDuration(bpm: number, sig: TimeSignature): number {
  return (60 / bpm) * (4 / sig.unit);
}

export function barDuration(bpm: number, sig: TimeSignature): number {
  return beatDuration(bpm, sig) * sig.beats;
}

export interface BeatEvent {
  /** Audio-clock time (seconds) at which the beat sounds. */
  time: number;
  /** Zero-based bar count since start. */
  bar: number;
  /** Zero-based beat within the bar; 0 is the downbeat. */
  beat: number;
  /** Total beats since start. */
  index: number;
  bpm: number;
  signature: TimeSignature;
  duration: number;
}

export type BeatListener = (event: BeatEvent) => void;

export interface Clock {
  readonly currentTime: number;
}

export interface TimerApi {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface SchedulerOptions {
  /** How often the timer fires, in ms. */
  intervalMs?: number;
  /** How far ahead of the audio clock to schedule, in seconds. */
  lookahead?: number;
  timer?: TimerApi;
}

export class Scheduler {
  private bpm = 100;
  private signature: TimeSignature = { beats: 4, unit: 4 };
  private nextTime = 0;
  private index = 0;
  private handle: unknown = null;
  private listeners = new Set<BeatListener>();
  private readonly intervalMs: number;
  private readonly lookahead: number;
  private readonly timer: TimerApi;
  /** Pending meter change, applied at the next downbeat so bars are never cut short. */
  private pendingSignature: TimeSignature | null = null;
  private barOffset = 0;
  private beatInBar = 0;

  constructor(
    private readonly clock: Clock,
    options: SchedulerOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? 25;
    this.lookahead = options.lookahead ?? 0.1;
    this.timer = options.timer ?? {
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
    };
  }

  get running(): boolean {
    return this.handle !== null;
  }

  get tempo(): number {
    return this.bpm;
  }

  get meter(): TimeSignature {
    return this.signature;
  }

  /** Tempo changes take effect from the next scheduled beat. */
  setTempo(bpm: number): void {
    this.bpm = Math.min(300, Math.max(20, bpm));
  }

  /** Meter changes take effect at the next downbeat (immediately when stopped). */
  setSignature(sig: TimeSignature): void {
    if (this.running) this.pendingSignature = sig;
    else this.signature = sig;
  }

  subscribe(listener: BeatListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Start on the audio clock. `at` defaults to a hair after now. */
  start(at?: number): void {
    if (this.running) return;
    this.nextTime = at ?? this.clock.currentTime + 0.05;
    this.index = 0;
    this.barOffset = 0;
    this.beatInBar = 0;
    this.pendingSignature = null;
    this.handle = this.timer.setInterval(() => this.tick(), this.intervalMs);
    this.tick();
  }

  stop(): void {
    if (this.handle !== null) this.timer.clearInterval(this.handle);
    this.handle = null;
    this.pendingSignature = null;
  }

  /** Schedule every beat inside the lookahead window. Exposed for tests. */
  tick(): void {
    const horizon = this.clock.currentTime + this.lookahead;
    while (this.running && this.nextTime < horizon) {
      if (this.beatInBar === 0 && this.pendingSignature) {
        this.signature = this.pendingSignature;
        this.pendingSignature = null;
      }
      const duration = beatDuration(this.bpm, this.signature);
      const event: BeatEvent = {
        time: this.nextTime,
        bar: this.barOffset,
        beat: this.beatInBar,
        index: this.index,
        bpm: this.bpm,
        signature: this.signature,
        duration,
      };
      this.nextTime += duration;
      this.index++;
      this.beatInBar++;
      if (this.beatInBar >= this.signature.beats) {
        this.beatInBar = 0;
        this.barOffset++;
      }
      this.listeners.forEach((l) => l(event));
    }
  }
}

/**
 * Convert an audio-clock time into a wall-clock delay in ms, for syncing visuals
 * (highlighting the sounding chord) to scheduled audio.
 */
export function msUntil(audioTime: number, clock: Clock): number {
  return Math.max(0, (audioTime - clock.currentTime) * 1000);
}

/** Tap-tempo: average the intervals between recent taps (audio-clock seconds). */
export function tapTempo(taps: readonly number[], maxGap = 2): number | null {
  const recent: number[] = [];
  for (let i = taps.length - 1; i >= 0; i--) {
    if (i < taps.length - 1 && taps[i + 1] - taps[i] > maxGap) break;
    recent.unshift(taps[i]);
  }
  if (recent.length < 2) return null;
  const avg = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
  return Math.round(60 / avg);
}
