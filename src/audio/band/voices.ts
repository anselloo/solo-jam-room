import { midiToFreq } from '../../theory/notes';
import { getContext, getMaster } from '../engine';

export type PartId = 'drums' | 'bass' | 'chords' | 'lead';
export const PART_IDS: readonly PartId[] = ['drums', 'bass', 'chords', 'lead'];

/** Everything the band needs to make sound. Swappable so scheduling logic can be tested silently. */
export interface Voices {
  kick(time: number, velocity: number): void;
  snare(time: number, velocity: number): void;
  hat(time: number, velocity: number, open: boolean): void;
  bass(time: number, midi: number, duration: number, velocity: number): void;
  pad(time: number, midis: readonly number[], duration: number, velocity: number): void;
  lead(time: number, midi: number, duration: number, velocity: number): void;
  setLevel(part: PartId, level: number): void;
  /** Dip the backing parts (not the lead) between two audio-clock times. */
  duck(from: number, to: number, level: number): void;
}

const RAMP = 0.012;

/** Headroom for the summed drums, bass and chords before the master chain. */
const BACKING_LEVEL = 0.7;

/** Synthesized drum kit, bass, chord pad and lead built on the Web Audio API. */
export class WebAudioVoices implements Voices {
  private readonly ctx = getContext();
  private readonly parts: Record<PartId, GainNode>;
  /** Drums, bass and chords share this bus so they can be ducked together. */
  private readonly backing: GainNode;
  private noise: AudioBuffer | null = null;

  constructor() {
    const ctx = this.ctx;
    this.backing = ctx.createGain();
    this.backing.gain.value = BACKING_LEVEL;
    this.backing.connect(getMaster());
    const mk = (dest: AudioNode) => {
      const g = ctx.createGain();
      g.connect(dest);
      return g;
    };
    this.parts = {
      drums: mk(this.backing),
      bass: mk(this.backing),
      chords: mk(this.backing),
      lead: mk(getMaster()),
    };
  }

  private noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    return this.noise;
  }

  private env(time: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
    return g;
  }

  kick(time: number, velocity: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    const g = this.env(time, 0.95 * velocity, 0.003, 0.32);
    osc.connect(g).connect(this.parts.drums);
    osc.start(time);
    osc.stop(time + 0.4);
  }

  snare(time: number, velocity: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const ng = this.env(time, 0.55 * velocity, 0.002, 0.17);
    src.connect(hp).connect(ng).connect(this.parts.drums);
    src.start(time, Math.random() * 0.5);
    src.stop(time + 0.22);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.08);
    const og = this.env(time, 0.4 * velocity, 0.002, 0.1);
    osc.connect(og).connect(this.parts.drums);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  hat(time: number, velocity: number, open: boolean): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const decay = open ? 0.28 : 0.045;
    const g = this.env(time, 0.22 * velocity, 0.001, decay);
    src.connect(hp).connect(g).connect(this.parts.drums);
    src.start(time, Math.random() * 0.5);
    src.stop(time + decay + 0.05);
  }

  bass(time: number, midi: number, duration: number, velocity: number): void {
    const ctx = this.ctx;
    const dur = Math.max(0.08, duration);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = midiToFreq(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, time);
    lp.frequency.exponentialRampToValueAtTime(260, time + Math.min(0.25, dur));
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = midiToFreq(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.5 * velocity, time + 0.008);
    g.gain.setValueAtTime(0.5 * velocity, time + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(lp).connect(g);
    sub.connect(g);
    g.connect(this.parts.bass);
    osc.start(time);
    sub.start(time);
    osc.stop(time + dur + 0.02);
    sub.stop(time + dur + 0.02);
  }

  pad(time: number, midis: readonly number[], duration: number, velocity: number): void {
    const ctx = this.ctx;
    const dur = Math.max(0.1, duration);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1700;
    const level = (0.16 * velocity) / Math.sqrt(midis.length || 1);
    const g = ctx.createGain();
    const attack = Math.min(0.03, dur / 4);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(level, time + attack);
    g.gain.setValueAtTime(level, time + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    lp.connect(g).connect(this.parts.chords);
    for (const midi of midis) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiToFreq(midi);
        o.detune.value = detune;
        o.connect(lp);
        o.start(time);
        o.stop(time + dur + 0.02);
      }
    }
  }

  lead(time: number, midi: number, duration: number, velocity: number): void {
    const ctx = this.ctx;
    const dur = Math.max(0.06, duration);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiToFreq(midi);
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = midiToFreq(midi);
    osc2.detune.value = 4;
    const mix2 = ctx.createGain();
    mix2.gain.value = 0.25;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.5 * velocity, time + 0.015);
    g.gain.setValueAtTime(0.5 * velocity, time + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(lp);
    osc2.connect(mix2).connect(lp);
    lp.connect(g).connect(this.parts.lead);
    osc.start(time);
    osc2.start(time);
    osc.stop(time + dur + 0.02);
    osc2.stop(time + dur + 0.02);
  }

  setLevel(part: PartId, level: number): void {
    this.parts[part].gain.setTargetAtTime(level, this.ctx.currentTime, RAMP);
  }

  duck(from: number, to: number, level: number): void {
    const g = this.backing.gain;
    g.setTargetAtTime(BACKING_LEVEL * level, from, 0.03);
    g.setTargetAtTime(BACKING_LEVEL, to, 0.08);
  }
}
