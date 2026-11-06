import type { Chord } from '../../theory/chords';
import type { BeatEvent } from '../scheduler';
import { GROOVES, planStep, stepsPerBeat, swingOffset, type Groove } from './grooves';
import { bassNote, chordAtBar, padVoicing } from './voicing';
import { PART_IDS, type PartId, type Voices } from './voices';

export interface PartState {
  volume: number;
  muted: boolean;
}

export type PartStates = Record<PartId, PartState>;

const defaultParts = (): PartStates => ({
  drums: { volume: 0.8, muted: false },
  bass: { volume: 0.8, muted: false },
  chords: { volume: 0.7, muted: false },
  lead: { volume: 0.9, muted: false },
});

/**
 * The synthesized backing band. It is driven beat by beat from the scheduler: each beat event
 * is expanded into steps and handed to the voices at exact audio times. All state (groove,
 * progression, mutes) is read at schedule time, so changes land on the next beat without
 * restarting anything, which keeps loops and tempo changes glitch-free.
 *
 * A muted part is never scheduled at all, so it is truly silent.
 */
export class Band {
  groove: Groove = GROOVES[0];
  private progression: Chord[] = [];
  private barsPerChord = 1;
  private parts: PartStates = defaultParts();

  constructor(private readonly voices: Voices) {
    this.applyLevels();
  }

  setGroove(groove: Groove): void {
    this.groove = groove;
  }

  setProgression(chords: readonly Chord[], barsPerChord = 1): void {
    this.progression = chords.slice();
    this.barsPerChord = Math.max(1, barsPerChord);
  }

  getProgression(): readonly Chord[] {
    return this.progression;
  }

  getPart(part: PartId): PartState {
    return this.parts[part];
  }

  setPart(part: PartId, patch: Partial<PartState>): void {
    this.parts = { ...this.parts, [part]: { ...this.parts[part], ...patch } };
    this.applyLevels();
  }

  isAudible(part: PartId): boolean {
    return !this.parts[part].muted;
  }

  /** The chord sounding in a bar (bars count from the first bar after any count-in). */
  chordForBar(bar: number): Chord | null {
    return this.progression.length === 0
      ? null
      : chordAtBar(this.progression, bar, this.barsPerChord);
  }

  /** Dip the backing parts, e.g. while the app plays a phrase. */
  duck(from: number, to: number, level = 0.55): void {
    this.voices.duck(from, to, level);
  }

  /** Play a single lead note (app phrases). Silent when the lead is muted. */
  playLead(time: number, midi: number, duration: number, velocity = 0.8): void {
    if (this.parts.lead.muted) return;
    this.voices.lead(time, midi, duration, velocity);
  }

  /** Schedule one beat of the groove. `event.bar` must be >= 0 (count-in beats are skipped). */
  scheduleBeat(event: BeatEvent): void {
    if (event.bar < 0) return;
    const perBeat = stepsPerBeat(event.signature);
    const chord = this.chordForBar(event.bar);
    const stepDur = event.duration / perBeat;

    for (let s = 0; s < perBeat; s++) {
      const step = event.beat * perBeat + s;
      const time =
        event.time + (s + swingOffset(s, perBeat, this.groove.swing) * perBeat) * stepDur;
      const plan = planStep(this.groove, event.signature, step);
      const accent = s === 0 && event.beat === 0 ? 1 : 0.85;

      if (this.isAudible('drums')) {
        if (plan.kick) this.voices.kick(time, plan.kick === 'X' ? 1 : accent);
        if (plan.snare) this.voices.snare(time, plan.snare === 'X' ? 1 : 0.85);
        if (plan.hat) this.voices.hat(time, s === 0 ? 0.9 : 0.6, plan.hat === 'o');
      }
      if (!chord) continue;
      if (plan.bass && this.isAudible('bass')) {
        const dur = Math.min(plan.bass.holdSteps, perBeat) * stepDur * 0.92;
        this.voices.bass(time, bassNote(chord, plan.bass.token), dur, accent);
      }
      if (plan.comp && this.isAudible('chords')) {
        const dur = plan.comp.long
          ? plan.comp.holdSteps * stepDur * 0.98
          : Math.min(plan.comp.holdSteps, perBeat) * stepDur * 0.6;
        this.voices.pad(time, padVoicing(chord), dur, plan.comp.long ? 0.7 : accent);
      }
    }
  }

  private applyLevels(): void {
    for (const id of PART_IDS) {
      const p = this.parts[id];
      this.voices.setLevel(id, p.muted ? 0 : p.volume);
    }
  }
}
