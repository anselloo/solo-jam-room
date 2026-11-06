import { useCallback, useEffect, useRef, useState } from 'react';
import { getContext } from '../../audio/engine';
import { barDuration, msUntil } from '../../audio/scheduler';
import { playChime } from '../../audio/sounds';
import { useTransport } from '../../audio/transport';
import { announce } from '../../components/announce';
import { BarCounter } from '../../components/BarCounter';
import { FocusView } from '../../components/FocusView';
import { useApp } from '../../state/AppState';
import { keyLabel, keyMatches } from '../../state/settings';
import { useAction } from '../../state/shortcuts';
import { PULSE_LABELS, recordPulse } from '../../state/stats';
import { signatureOf } from '../roulette/roulette';
import { PulseChart } from './PulseChart';
import {
  PRESETS,
  analyzeTaps,
  clickAudible,
  cyclePosition,
  type PulseAnalysis,
  type PulsePreset,
} from './pulse';

type Phase = 'idle' | 'playing' | 'done';

interface RoundResult {
  round: number;
  bpm: number;
  beats: number;
  analysis: PulseAnalysis | null;
}

const MAX_BARS_SHOWN = 24;

export function HoldThePulsePage() {
  const { profile, settings, updateStats } = useApp();
  const transport = useTransport();

  const defaultPreset =
    PRESETS.find(
      (p) =>
        p.id ===
        (profile.level === 'beginner'
          ? 'easy'
          : profile.level === 'advanced'
            ? 'hard'
            : 'standard'),
    ) ?? PRESETS[1];
  const [bpm, setBpm] = useState(defaultPreset.bpm);
  const [barsOn, setBarsOn] = useState(defaultPreset.barsOn);
  const [barsOff, setBarsOff] = useState(defaultPreset.barsOff);
  const [rounds, setRounds] = useState(defaultPreset.rounds);
  const [withBand, setWithBand] = useState(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [silent, setSilent] = useState(false);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [tapFlash, setTapFlash] = useState(false);

  const taps = useRef<number[]>([]);
  const grids = useRef<Map<number, { start: number; beats: number }>>(new Map());
  const timers = useRef<number[]>([]);
  /** Rounds already scored, so each silence is scored exactly once. */
  const scored = useRef(new Set<number>());
  const cfg = useRef({ bpm, barsOn, barsOff, rounds, withBand });
  useEffect(() => {
    cfg.current = { bpm, barsOn, barsOff, rounds, withBand };
  }, [bpm, barsOn, barsOff, rounds, withBand]);

  const later = useCallback((fn: () => void, audioTime: number) => {
    timers.current.push(window.setTimeout(fn, msUntil(audioTime, getContext())));
  }, []);

  const applyPreset = (p: PulsePreset) => {
    setBpm(p.bpm);
    setBarsOn(p.barsOn);
    setBarsOff(p.barsOff);
    setRounds(p.rounds);
  };

  /** Record a tap using the audio clock, which is what the click and grid are scheduled on. */
  const registerTap = useCallback(() => {
    taps.current.push(getContext().currentTime);
    setTapCount((n) => n + 1);
    setTapFlash(true);
    window.setTimeout(() => setTapFlash(false), 90);
  }, []);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const finish = useCallback(() => {
    transport.stop();
    transport.setClickOn(true);
    transport.setBandOn(true);
    setSilent(false);
    setPhase('done');
  }, [transport]);

  // The tap key (a foot pedal or page turner sends key presses) is handled before global shortcuts.
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!keyMatches(e.key, settings.pulseTapKey) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) registerTap();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [phase, settings.pulseTapKey, registerTap]);

  // Click on, click off, click back: all decided on scheduler beats.
  useEffect(() => {
    if (phase !== 'playing') return;
    return transport.onBeat((e) => {
      if (e.bar < 0) return;
      const c = cfg.current;
      const { round, barInCycle } = cyclePosition(e.bar, c.barsOn, c.barsOff);
      const cycle = c.barsOn + c.barsOff;
      const lastBeat = e.beat === e.signature.beats - 1;
      const playingRound = round < c.rounds;

      // Last beat of the "on" section: the next downbeat is the first silent one.
      if (playingRound && barInCycle === c.barsOn - 1 && lastBeat) {
        transport.setClickOn(false);
        transport.setBandOn(false);
      }
      if (playingRound && barInCycle === c.barsOn && e.beat === 0) {
        grids.current.set(round, { start: e.time, beats: c.barsOff * e.signature.beats });
        later(() => {
          setSilent(true);
          announce('The click is gone. Keep the beat and tap each beat.');
        }, e.time);
      }
      // Last beat of the silence: bring the click back on the downbeat.
      if (playingRound && barInCycle === cycle - 1 && lastBeat) {
        transport.setClickOn(true);
        transport.setBandOn(c.withBand);
      }
      // The click is back: score the silence that just ended.
      if (barInCycle === 0 && e.beat === 0 && round >= 1) {
        const finished = round - 1;
        if (!scored.current.has(finished)) {
          const grid = grids.current.get(finished);
          const analysis = grid ? analyzeTaps(taps.current, grid.start, c.bpm, grid.beats) : null;
          const result: RoundResult = {
            round: finished,
            bpm: c.bpm,
            beats: grid?.beats ?? 0,
            analysis,
          };
          scored.current.add(finished);
          later(() => {
            setResults((r) => [...r, result]);
            setSilent(false);
            announce(
              analysis
                ? `${PULSE_LABELS[analysis.rank]}. You held ${analysis.avgBpm.toFixed(1)} BPM against ${c.bpm}.`
                : 'Not enough taps to score that round.',
            );
          }, e.time);
          if (analysis) {
            updateStats((s) =>
              recordPulse(s, c.bpm, { rank: analysis.rank, error: analysis.error }),
            );
          }
          playChime(e.time, analysis && analysis.rank <= 1 ? 'go' : 'warn');
          if (round >= c.rounds) later(finish, e.time + barDuration(c.bpm, e.signature));
        }
      }
    });
  }, [phase, transport, later, finish, updateStats]);

  const start = useCallback(async () => {
    taps.current = [];
    grids.current = new Map();
    scored.current = new Set();
    setResults([]);
    setTapCount(0);
    setSilent(false);
    transport.setSignature(signatureOf('4/4'));
    transport.setBpm(bpm);
    transport.setClickOn(true);
    transport.setBandOn(withBand);
    setPhase('playing');
    await transport.start({ countIn: 0 });
  }, [transport, bpm, withBand]);

  const stop = useCallback(() => {
    clearTimers();
    transport.stop();
    transport.setClickOn(true);
    transport.setBandOn(true);
    setSilent(false);
    setPhase('idle');
  }, [transport]);

  // Space only starts the game here; while playing, the tap key takes over.
  useAction('primary', () => {
    if (phase !== 'playing') void start();
  });

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      transport.stop();
      transport.setClickOn(true);
      transport.setBandOn(true);
    },
    // Hand the click and band back when leaving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const pos = transport.position;
  const cycleBars = barsOn + barsOff;
  const cyclePos = pos && pos.bar >= 0 ? cyclePosition(pos.bar, barsOn, barsOff) : null;
  const headline =
    phase === 'idle'
      ? 'Ready?'
      : phase === 'done'
        ? 'All done'
        : silent
          ? 'KEEP THE BEAT'
          : 'LISTEN';

  return (
    <section className="stack">
      <FocusView>
        <h1>Hold the pulse</h1>
        <div
          className="turn"
          data-who={phase === 'playing' ? (silent ? 'you' : 'app') : undefined}
          data-flash={tapFlash}
        >
          <p className="prompt">{headline}</p>
          <p>
            {phase === 'idle' &&
              'The click drops out. Keep playing, and tap the beat to see if you stay locked in.'}
            {phase === 'playing' &&
              !silent &&
              'Play along with the click and get the tempo into your body.'}
            {phase === 'playing' &&
              silent &&
              `The click is gone. Tap each beat (${keyLabel(settings.pulseTapKey)} or the big button).`}
            {phase === 'done' && 'Here is how each round went.'}
          </p>
          {phase === 'playing' && (
            <p className="muted">
              Round {Math.min(rounds, (cyclePos?.round ?? 0) + 1)} of {rounds} · {tapCount} taps
            </p>
          )}
        </div>

        {phase === 'playing' && cycleBars <= MAX_BARS_SHOWN && (
          <BarCounter
            bars={cycleBars}
            beatsPerBar={4}
            position={cyclePos && pos ? { bar: cyclePos.barInCycle, beat: pos.beat } : null}
          />
        )}
        {phase === 'playing' && cyclePos && !clickAudible(cyclePos.barInCycle, barsOn) && (
          <p className="sr-only">Silent section</p>
        )}

        <div className="row" style={{ justifyContent: 'center' }}>
          {phase === 'playing' ? (
            <>
              <button
                type="button"
                className="btn btn--primary tap-pad"
                onPointerDown={(e) => {
                  e.preventDefault();
                  registerTap();
                }}
                aria-label={`Tap the beat (${keyLabel(settings.pulseTapKey)})`}
              >
                TAP
              </button>
              <button type="button" className="btn btn--ghost" onClick={stop}>
                End
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--primary" onClick={() => void start()}>
              {phase === 'done' ? 'Again' : 'Start'}
            </button>
          )}
        </div>
      </FocusView>

      {results.length > 0 && (
        <div className="stack" aria-label="Results">
          {results.map((r) => (
            <div className="card stack" key={r.round}>
              <h2>Round {r.round + 1}</h2>
              {r.analysis ? (
                <>
                  <p className="prompt" style={{ fontSize: '2.4rem' }}>
                    {PULSE_LABELS[r.analysis.rank]}
                  </p>
                  <p>
                    You held <strong>{r.analysis.avgBpm.toFixed(1)} BPM</strong> against a click of{' '}
                    <strong>{r.bpm}</strong> (off by {r.analysis.error.toFixed(1)}) over{' '}
                    {r.analysis.taps} taps.
                  </p>
                  <PulseChart points={r.analysis.points} beats={r.beats} />
                </>
              ) : (
                <p>
                  Not enough taps to score this round. Try tapping on every beat of the silence.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card stack">
        <h2>Settings</h2>
        <div className="row" role="group" aria-label="Difficulty presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn"
              onClick={() => applyPreset(p)}
              disabled={phase === 'playing'}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="hp-bpm">Tempo (BPM)</label>
            <input
              id="hp-bpm"
              className="input"
              type="number"
              min={40}
              max={240}
              value={bpm}
              onChange={(e) => setBpm(Math.max(40, Math.min(240, Number(e.target.value) || 100)))}
              disabled={phase === 'playing'}
            />
          </div>
          <div className="field">
            <label htmlFor="hp-on">Bars with click</label>
            <select
              id="hp-on"
              className="input"
              value={barsOn}
              onChange={(e) => setBarsOn(Number(e.target.value))}
              disabled={phase === 'playing'}
            >
              {[1, 2, 4, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="hp-off">Bars of silence</label>
            <select
              id="hp-off"
              className="input"
              value={barsOff}
              onChange={(e) => setBarsOff(Number(e.target.value))}
              disabled={phase === 'playing'}
            >
              {[2, 4, 8, 12, 16].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="hp-rounds">Rounds</label>
            <select
              id="hp-rounds"
              className="input"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              disabled={phase === 'playing'}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="row" style={{ minHeight: 'var(--tap)' }}>
          <input
            type="checkbox"
            checked={withBand}
            onChange={(e) => setWithBand(e.target.checked)}
            disabled={phase === 'playing'}
          />
          Play the backing band with the click (it drops out too)
        </label>
        <p className="muted">
          Tap key: <kbd>{keyLabel(settings.pulseTapKey)}</kbd>. Change it in Settings to use a foot
          pedal or page turner.
        </p>
      </div>
    </section>
  );
}
