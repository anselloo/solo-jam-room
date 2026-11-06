import { describe, expect, it } from 'vitest';
import {
  Scheduler,
  barDuration,
  beatDuration,
  msUntil,
  sameSignature,
  signatureLabel,
  tapTempo,
  type BeatEvent,
  type TimerApi,
} from '../../src/audio/scheduler';

const four = { beats: 4, unit: 4 } as const;

function harness() {
  const clock = { currentTime: 0 };
  let fn: (() => void) | null = null;
  const timer: TimerApi = {
    setInterval: (f) => ((fn = f), 1),
    clearInterval: () => {
      fn = null;
    },
  };
  const s = new Scheduler(clock, { timer });
  const events: BeatEvent[] = [];
  s.subscribe((e) => events.push(e));
  const advance = (to: number) => {
    clock.currentTime = to;
    fn?.();
  };
  return { clock, s, events, advance };
}

describe('timing math', () => {
  it('computes beat and bar durations', () => {
    expect(beatDuration(120, four)).toBeCloseTo(0.5);
    expect(barDuration(120, four)).toBeCloseTo(2);
    expect(beatDuration(120, { beats: 6, unit: 8 })).toBeCloseTo(0.25);
    expect(barDuration(120, { beats: 7, unit: 8 })).toBeCloseTo(1.75);
    expect(signatureLabel({ beats: 5, unit: 4 })).toBe('5/4');
    expect(sameSignature(four, { beats: 4, unit: 4 })).toBe(true);
    expect(sameSignature(four, { beats: 3, unit: 4 })).toBe(false);
  });
  it('converts audio time to a wall-clock delay', () => {
    expect(msUntil(1.5, { currentTime: 1 })).toBe(500);
    expect(msUntil(1, { currentTime: 2 })).toBe(0);
  });
  it('derives tempo from taps', () => {
    expect(tapTempo([0])).toBeNull();
    expect(tapTempo([0, 0.5, 1, 1.5])).toBe(120);
    // A long pause starts a fresh tap sequence.
    expect(tapTempo([0, 0.5, 10, 10.6, 11.2])).toBe(100);
  });
});

describe('scheduler', () => {
  it('schedules only beats inside the lookahead window, on exact grid times', () => {
    const { s, events, advance } = harness();
    s.setTempo(120);
    s.start(1);
    expect(events).toHaveLength(0);
    advance(0.95);
    expect(events.map((e) => e.time)).toEqual([1]);
    advance(1.45);
    expect(events.map((e) => e.time)).toEqual([1, 1.5]);
  });
  it('counts beats and bars', () => {
    const { s, events, advance } = harness();
    s.setTempo(120);
    s.start(0);
    for (let t = 0; t <= 4; t += 0.025) advance(t);
    const first9 = events.slice(0, 9);
    expect(first9.map((e) => [e.bar, e.beat])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 0],
    ]);
    expect(first9.map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('does not drift over many beats', () => {
    const { s, events, advance } = harness();
    s.setTempo(180);
    s.start(0);
    for (let t = 0; t <= 300; t += 0.025) advance(t);
    const last = events[events.length - 1];
    expect(last.time).toBeCloseTo(last.index * (60 / 180), 6);
  });
  it('applies tempo changes from the next beat', () => {
    const { s, events, advance } = harness();
    s.setTempo(60);
    s.start(0);
    advance(0);
    s.setTempo(120);
    for (let t = 0.025; t <= 3; t += 0.025) advance(t);
    expect(events[0].duration).toBe(1);
    expect(events[1].time).toBeCloseTo(1);
    expect(events[2].time).toBeCloseTo(1.5);
  });
  it('applies meter changes only at the next downbeat', () => {
    const { s, events, advance } = harness();
    s.setTempo(120);
    s.start(0);
    advance(0);
    s.setSignature({ beats: 3, unit: 4 });
    for (let t = 0.025; t <= 5; t += 0.025) advance(t);
    const bar0 = events.filter((e) => e.bar === 0);
    const bar1 = events.filter((e) => e.bar === 1);
    expect(bar0).toHaveLength(4);
    expect(bar1.map((e) => e.beat)).toEqual([0, 1, 2]);
  });
  it('clamps tempo, stops cleanly and ignores a second start', () => {
    const { s, events, advance } = harness();
    s.setTempo(1000);
    expect(s.tempo).toBe(300);
    s.setTempo(1);
    expect(s.tempo).toBe(20);
    s.setSignature({ beats: 6, unit: 8 });
    expect(s.meter.beats).toBe(6);
    s.start(0);
    s.start(5);
    expect(s.running).toBe(true);
    advance(0);
    const count = events.length;
    s.stop();
    expect(s.running).toBe(false);
    s.tick();
    expect(events).toHaveLength(count);
  });
  it('stops emitting to unsubscribed listeners', () => {
    const { s, clock } = harness();
    let calls = 0;
    const off = s.subscribe(() => calls++);
    off();
    s.start(0);
    clock.currentTime = 0;
    s.tick();
    expect(calls).toBe(0);
  });
});
