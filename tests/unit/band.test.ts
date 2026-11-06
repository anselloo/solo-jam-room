import { describe, expect, it } from 'vitest';
import { Band } from '../../src/audio/band/band';
import {
  GENRES,
  GROOVES,
  genreById,
  grooveById,
  holdSteps,
  patternFor,
  planStep,
  stepsPerBar,
  stepsPerBeat,
  swingOffset,
} from '../../src/audio/band/grooves';
import { bassNote, bassRootMidi, chordAtBar, padVoicing } from '../../src/audio/band/voicing';
import type { PartId, Voices } from '../../src/audio/band/voices';
import {
  TIME_SIGNATURES,
  signatureLabel,
  type BeatEvent,
  type TimeSignature,
} from '../../src/audio/scheduler';
import { chordNotes, realizeRoman, type Chord } from '../../src/theory/chords';
import { parseNote, pc } from '../../src/theory/notes';

const key = { root: parseNote('C'), mode: 'major' as const };
const prog = ['I', 'vi', 'IV', 'V'].map((r) => realizeRoman(r, key));

describe('groove data', () => {
  it('has unique ids and every genre maps to a real groove', () => {
    expect(new Set(GROOVES.map((g) => g.id)).size).toBe(GROOVES.length);
    expect(new Set(GENRES.map((g) => g.id)).size).toBe(GENRES.length);
    for (const g of GENRES) {
      expect(grooveById(g.groove), `genre ${g.id}`).toBeDefined();
      expect(g.tempo[0]).toBeLessThan(g.tempo[1]);
      expect(g.tempo[0]).toBeGreaterThanOrEqual(40);
      expect(g.tempo[1]).toBeLessThanOrEqual(240);
      expect(g.meters.length).toBeGreaterThan(0);
      for (const m of g.meters) {
        expect(TIME_SIGNATURES.map(signatureLabel)).toContain(m);
      }
    }
    expect(genreById('nope')).toBeUndefined();
  });

  it('covers the genres named in the spec', () => {
    const names = GENRES.map((g) => g.id);
    for (const id of ['reggae', 'punk', 'bossa', 'metal', 'lofi', 'funk', 'waltz', 'shanty']) {
      expect(names).toContain(id);
    }
  });

  it('every pattern fills its time signature exactly', () => {
    for (const g of GROOVES) {
      for (const sig of TIME_SIGNATURES) {
        const p = patternFor(g, sig);
        for (const part of ['kick', 'snare', 'hat', 'bass', 'comp'] as const) {
          expect(p[part].length, `${g.id} ${signatureLabel(sig)} ${part}`).toBe(stepsPerBar(sig));
        }
      }
    }
  });

  it('only uses valid pattern characters and every groove makes drum and bass sound', () => {
    const ok = {
      kick: /^[xX.]+$/,
      snare: /^[xX.]+$/,
      hat: /^[xo.]+$/,
      bass: /^[rfot.]+$/,
      comp: /^[xl.]+$/,
    };
    for (const g of GROOVES) {
      expect(g.swing).toBeGreaterThanOrEqual(0);
      expect(g.swing).toBeLessThanOrEqual(1);
      for (const sig of TIME_SIGNATURES) {
        const p = patternFor(g, sig);
        for (const part of Object.keys(ok) as (keyof typeof ok)[]) {
          expect(p[part]).toMatch(ok[part]);
        }
        expect(p.bass).toMatch(/[rfot]/);
        expect(p.comp).toMatch(/[xl]/);
        expect(p.kick + p.snare + p.hat).toMatch(/[xXo]/);
      }
    }
  });

  it('throws for a meter a groove does not define', () => {
    expect(() => patternFor(GROOVES[0], { beats: 9, unit: 8 })).toThrow();
  });

  it('computes steps and holds', () => {
    expect(stepsPerBeat({ beats: 4, unit: 4 })).toBe(4);
    expect(stepsPerBeat({ beats: 6, unit: 8 })).toBe(2);
    expect(stepsPerBar({ beats: 7, unit: 8 })).toBe(14);
    expect(holdSteps('x...x...', 0)).toBe(4);
    expect(holdSteps('x...x...', 4)).toBe(4);
    expect(holdSteps('x.......', 0)).toBe(8);
  });

  it('plans steps from patterns', () => {
    const rock = grooveById('rock')!;
    const four = { beats: 4, unit: 4 } as const;
    const first = planStep(rock, four, 0);
    expect(first.kick).toBe('x');
    expect(first.snare).toBeNull();
    expect(first.bass?.token).toBe('r');
    expect(planStep(rock, four, 4).snare).toBe('x');
    expect(planStep(rock, four, 1).kick).toBeNull();
  });

  it('keeps swing offsets inside the beat', () => {
    for (const perBeat of [4, 2]) {
      for (let s = 0; s < perBeat; s++) {
        const straight = s / perBeat;
        const o = swingOffset(s, perBeat, 1);
        expect(straight + o).toBeLessThan(1);
        expect(swingOffset(s, perBeat, 0)).toBe(0);
      }
    }
    expect(swingOffset(2, 4, 1)).toBeCloseTo(1 / 6);
    expect(swingOffset(0, 4, 1)).toBe(0);
    expect(swingOffset(2, 4, 5)).toBeCloseTo(1 / 6);
  });
});

describe('voicing', () => {
  it('keeps bass notes in a playable register', () => {
    for (let p = 0; p < 12; p++) {
      const chord: Chord = {
        root: parseNote(['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'][p]),
        quality: 'maj',
      };
      expect(bassRootMidi(chord)).toBe(36 + p);
      for (const t of ['r', 'f', 'o', 't'] as const) {
        const n = bassNote(chord, t);
        expect(n).toBeGreaterThanOrEqual(36);
        expect(n).toBeLessThanOrEqual(36 + 11 + 12);
      }
    }
    const minor: Chord = { root: parseNote('A'), quality: 'min' };
    expect(bassNote(minor, 't') - bassNote(minor, 'r')).toBe(3);
    expect(bassNote({ root: parseNote('A'), quality: 'maj' }, 't') - 45).toBe(4);
  });

  it('voices pads with exactly the chord tones, in a sensible range', () => {
    for (const quality of ['maj', 'min7', 'dom9', 'dim7', 'sus4'] as const) {
      for (let p = 0; p < 12; p++) {
        const chord: Chord = {
          root: parseNote(['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][p]),
          quality,
        };
        const midis = padVoicing(chord);
        const want = new Set(chordNotes(chord).map(pc));
        expect(new Set(midis.map((m) => m % 12))).toEqual(want);
        expect(midis[0]).toBeGreaterThanOrEqual(55);
        expect(midis[0]).toBeLessThanOrEqual(66);
        expect(midis).toEqual([...midis].sort((a, b) => a - b));
      }
    }
  });

  it('loops the progression by bar', () => {
    expect(chordAtBar(prog, 0)).toBe(prog[0]);
    expect(chordAtBar(prog, 3)).toBe(prog[3]);
    expect(chordAtBar(prog, 4)).toBe(prog[0]);
    expect(chordAtBar(prog, 1000)).toBe(prog[0]);
    expect(chordAtBar(prog, 3, 2)).toBe(prog[1]);
    expect(chordAtBar(prog, -5)).toBe(prog[0]);
    expect(() => chordAtBar([], 0)).toThrow();
  });
});

type Call = { part: PartId | 'duck'; time: number; midis?: number[] };

function fakeVoices() {
  const calls: Call[] = [];
  const levels: Partial<Record<PartId, number>> = {};
  const voices: Voices = {
    kick: (time) => calls.push({ part: 'drums', time }),
    snare: (time) => calls.push({ part: 'drums', time }),
    hat: (time) => calls.push({ part: 'drums', time }),
    bass: (time, midi) => calls.push({ part: 'bass', time, midis: [midi] }),
    pad: (time, midis) => calls.push({ part: 'chords', time, midis: [...midis] }),
    lead: (time, midi) => calls.push({ part: 'lead', time, midis: [midi] }),
    setLevel: (part, level) => {
      levels[part] = level;
    },
    duck: (from) => calls.push({ part: 'duck', time: from }),
  };
  return { voices, calls, levels };
}

function beat(sig: TimeSignature, bar: number, b: number, time: number, bpm = 120): BeatEvent {
  const duration = (60 / bpm) * (4 / sig.unit);
  return { time, bar, beat: b, index: bar * sig.beats + b, bpm, signature: sig, duration };
}

function playBars(band: Band, sig: TimeSignature, bars: number) {
  const dur = 0.5 * (4 / sig.unit);
  for (let bar = 0; bar < bars; bar++) {
    for (let b = 0; b < sig.beats; b++) {
      band.scheduleBeat(beat(sig, bar, b, (bar * sig.beats + b) * dur));
    }
  }
}

describe('band', () => {
  const four = TIME_SIGNATURES[0];

  it('plays drums, bass and chords over the progression', () => {
    const { voices, calls } = fakeVoices();
    const band = new Band(voices);
    band.setGroove(grooveById('rock')!);
    band.setProgression(prog);
    playBars(band, four, 4);
    const parts = new Set(calls.map((c) => c.part));
    expect(parts).toEqual(new Set(['drums', 'bass', 'chords']));
  });

  it('stays in the chord: bass roots and pad tones follow the current bar', () => {
    const { voices, calls } = fakeVoices();
    const band = new Band(voices);
    band.setGroove(grooveById('rock')!);
    band.setProgression(prog);
    playBars(band, four, 4);
    // Bar 0 spans 0..2s (I = C): first bass note is C.
    const firstBass = calls.find((c) => c.part === 'bass')!;
    expect(firstBass.midis![0] % 12).toBe(0);
    // Bar 3 spans 6..8s (V = G).
    const bar3Pads = calls.filter((c) => c.part === 'chords' && c.time >= 6 && c.time < 8);
    expect(bar3Pads.length).toBeGreaterThan(0);
    for (const p of bar3Pads) {
      expect(new Set(p.midis!.map((m) => m % 12))).toEqual(new Set([7, 11, 2]));
    }
  });

  it('muted parts are truly silent and others keep playing', () => {
    for (const muted of ['drums', 'bass', 'chords'] as const) {
      const { voices, calls, levels } = fakeVoices();
      const band = new Band(voices);
      band.setGroove(grooveById('funk')!);
      band.setProgression(prog);
      band.setPart(muted, { muted: true });
      playBars(band, four, 4);
      expect(calls.filter((c) => c.part === muted)).toHaveLength(0);
      expect(levels[muted]).toBe(0);
      const others = (['drums', 'bass', 'chords'] as const).filter((p) => p !== muted);
      for (const o of others) expect(calls.some((c) => c.part === o)).toBe(true);
    }
  });

  it('unmuting restores sound on the next beat', () => {
    const { voices, calls, levels } = fakeVoices();
    const band = new Band(voices);
    band.setProgression(prog);
    band.setPart('bass', { muted: true, volume: 0.5 });
    playBars(band, four, 1);
    expect(calls.some((c) => c.part === 'bass')).toBe(false);
    band.setPart('bass', { muted: false });
    expect(levels.bass).toBe(0.5);
    playBars(band, four, 1);
    expect(calls.some((c) => c.part === 'bass')).toBe(true);
  });

  it('skips count-in beats and stays quiet without a progression for pitched parts', () => {
    const { voices, calls } = fakeVoices();
    const band = new Band(voices);
    band.setProgression(prog);
    band.scheduleBeat(beat(four, -1, 0, 0));
    expect(calls).toHaveLength(0);
    band.setProgression([]);
    expect(band.chordForBar(0)).toBeNull();
    band.scheduleBeat(beat(four, 0, 0, 0));
    expect(calls.every((c) => c.part === 'drums')).toBe(true);
  });

  it('schedules every step inside its beat for every groove and meter', () => {
    for (const g of GROOVES) {
      for (const sig of TIME_SIGNATURES) {
        const { voices, calls } = fakeVoices();
        const band = new Band(voices);
        band.setGroove(g);
        band.setProgression(prog);
        const t0 = 10;
        const e = beat(sig, 0, 0, t0);
        band.scheduleBeat(e);
        for (const c of calls) {
          expect(c.time).toBeGreaterThanOrEqual(t0);
          expect(c.time).toBeLessThan(t0 + e.duration);
        }
        expect(calls.length).toBeGreaterThan(0);
      }
    }
  });

  it('follows tempo changes because timing comes from each beat event', () => {
    const { voices, calls } = fakeVoices();
    const band = new Band(voices);
    band.setGroove(grooveById('punk')!);
    band.setProgression(prog);
    band.scheduleBeat(beat(four, 0, 0, 0, 60));
    const slow = Math.max(...calls.map((c) => c.time));
    calls.length = 0;
    band.scheduleBeat(beat(four, 0, 0, 0, 240));
    const fast = Math.max(...calls.map((c) => c.time));
    expect(fast).toBeLessThan(slow);
  });

  it('ducks the backing and plays the lead unless muted', () => {
    const { voices, calls } = fakeVoices();
    const band = new Band(voices);
    band.duck(1, 3);
    expect(calls[0]).toEqual({ part: 'duck', time: 1 });
    band.playLead(2, 64, 0.5);
    expect(calls.some((c) => c.part === 'lead')).toBe(true);
    calls.length = 0;
    band.setPart('lead', { muted: true });
    band.playLead(2, 64, 0.5);
    expect(calls).toHaveLength(0);
    expect(band.getPart('lead').muted).toBe(true);
    expect(band.getProgression()).toEqual([]);
  });
});
