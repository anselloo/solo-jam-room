/** Single shared AudioContext, unlocked on first user gesture, with master gain and mute. */

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let volume = 0.8;

function create(): AudioContext {
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  const Ctx = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctx) throw new Error('Web Audio is not supported in this browser');
  const c = new Ctx({ latencyHint: 'interactive' });
  master = c.createGain();
  master.gain.value = muted ? 0 : volume;
  master.connect(c.destination);
  return c;
}

/** The shared context. Created lazily; call from a user gesture (see `unlockAudio`). */
export function getContext(): AudioContext {
  ctx ??= create();
  return ctx;
}

/** Destination all sounds should connect to (master gain). */
export function getMaster(): GainNode {
  getContext();
  return master as GainNode;
}

/** Create/resume the context. Must run inside a user gesture on iOS Safari. */
export async function unlockAudio(): Promise<AudioContext> {
  const c = getContext();
  if (c.state !== 'running') await c.resume();
  return c;
}

export function now(): number {
  return getContext().currentTime;
}

function applyGain(): void {
  if (!ctx || !master) return;
  // Short ramp avoids zipper noise and clicks.
  master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.015);
}

export function setMuted(value: boolean): void {
  muted = value;
  applyGain();
}

export function isMuted(): boolean {
  return muted;
}

export function setMasterVolume(value: number): void {
  volume = Math.min(1, Math.max(0, value));
  applyGain();
}

export function getMasterVolume(): number {
  return volume;
}
