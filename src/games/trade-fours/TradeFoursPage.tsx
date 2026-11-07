import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HowTo } from '../../components/HowTo';
import { GROOVES, grooveById } from '../../audio/band/grooves';
import { getContext } from '../../audio/engine';
import { msUntil } from '../../audio/scheduler';
import { playChime } from '../../audio/sounds';
import { useTransport } from '../../audio/transport';
import { announce } from '../../components/announce';
import { BarCounter } from '../../components/BarCounter';
import { FocusView } from '../../components/FocusView';
import { createRng } from '../../random/rng';
import { SKILL_LEVELS, type SkillLevel } from '../../state/profile';
import { useApp } from '../../state/AppState';
import { useAction } from '../../state/shortcuts';
import { noteName } from '../../theory/notes';
import {
  PHRASES,
  PHRASE_STYLES,
  generatePhrase,
  phraseScaleFor,
  type PhraseStyle,
} from '../../theory/phrases';
import { MODE_IDS, keyRootsFor, type ScaleId } from '../../theory/scales';
import { vampProgression } from '../../theory/vamps';
import { ConstraintToggle } from '../constraints/ConstraintToggle';
import { MODE_NAMES } from '../roulette/roulette';
import { TurnTracker, type Turn } from './turns';

type Phase = 'idle' | 'playing' | 'paused' | 'done';

interface Jam {
  keyPc: number;
  mode: ScaleId;
}

export function TradeFoursPage() {
  const { profile } = useApp();
  const transport = useTransport();
  const [rng] = useState(() => createRng(Date.now()));

  const [phraseBars, setPhraseBars] = useState<2 | 4 | 8>(4);
  const [keyPc, setKeyPc] = useState<number | null>(null);
  const [mode, setMode] = useState<ScaleId | null>(null);
  const [style, setStyle] = useState<PhraseStyle>('simple');
  const [level, setLevel] = useState<SkillLevel>(profile.level);
  const [rounds, setRounds] = useState(4);
  const [echo, setEcho] = useState(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [jam, setJam] = useState<Jam | null>(null);
  const [turnView, setTurnView] = useState<Turn | null>(null);

  const tracker = useRef<TurnTracker | null>(null);
  const jamRef = useRef<Jam | null>(null);
  const timers = useRef<number[]>([]);
  // Latest phrase settings, read by the beat listener without re-subscribing mid-turn.
  const phraseSettings = useRef({ style, level });
  useEffect(() => {
    phraseSettings.current = { style, level };
  }, [style, level]);

  const later = useCallback((fn: () => void, audioTime: number) => {
    timers.current.push(window.setTimeout(fn, msUntil(audioTime, getContext())));
  }, []);

  const finish = useCallback(() => {
    transport.stop();
    setPhase('done');
    setTurnView(null);
    announce('Trading finished. Nice playing.');
  }, [transport]);

  // The turn engine: all decisions are made on scheduler beats, never on a timer tick.
  useEffect(() => {
    if (phase !== 'playing') return;
    return transport.onBeat((e) => {
      const t = tracker.current;
      const j = jamRef.current;
      if (!t || !j || e.bar < 0 || e.beat !== 0) return;

      const ev = t.onDownbeat(e.bar);
      if (ev?.type === 'end') {
        playChime(e.time, 'end');
        later(finish, e.time + 0.6);
        return;
      }
      if (ev?.type === 'start') {
        const turn = ev.turn;
        later(() => {
          setTurnView(turn);
          announce(turn.who === 'you' ? 'Your turn' : "App's turn");
        }, e.time);
        if (turn.who === 'app') {
          const band = transport.getBand();
          const { style: st, level: lv } = phraseSettings.current;
          const phrase = generatePhrase({
            root: keyRootsFor(j.mode)[j.keyPc],
            scale: phraseScaleFor(st, j.mode),
            style: st,
            level: lv,
            bars: turn.bars,
            beatsPerBar: e.signature.beats,
            rng,
          });
          for (const n of phrase) {
            band?.playLead(
              e.time + n.start * e.duration,
              n.midi,
              n.duration * e.duration * 0.95,
              n.velocity,
            );
          }
          // Duck the backing so the app's phrase sits clearly on top.
          band?.duck(e.time, e.time + turn.bars * e.signature.beats * e.duration, 0.55);
        }
        return;
      }
      if (t.isLastBar(e.bar)) playChime(e.time, 'warn');
    });
  }, [phase, transport, rng, later, finish]);

  const start = useCallback(async () => {
    const resolvedMode = mode ?? rng.pick([...MODE_IDS]);
    const resolvedKey = keyPc ?? rng.int(0, 11);
    const resolved: Jam =
      jamRef.current && phase === 'paused'
        ? jamRef.current
        : { keyPc: resolvedKey, mode: resolvedMode };
    jamRef.current = resolved;
    setJam(resolved);
    if (phase === 'paused' && tracker.current) tracker.current.resume();
    else {
      tracker.current = new TurnTracker({ phraseBars, rounds, echo });
      setTurnView(null);
    }
    transport.setProgression(
      vampProgression(
        { root: keyRootsFor(resolved.mode)[resolved.keyPc], mode: resolved.mode },
        level !== 'beginner',
      ),
      1,
    );
    setPhase('playing');
    await transport.start({ countIn: 1 });
  }, [mode, keyPc, rng, phase, phraseBars, rounds, echo, transport, level]);

  const pause = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    transport.stop();
    setPhase('paused');
  }, [transport]);

  const end = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    tracker.current = null;
    transport.stop();
    setPhase('idle');
    setTurnView(null);
  }, [transport]);

  const toggle = useCallback(() => {
    if (phase === 'playing') pause();
    else void start();
  }, [phase, pause, start]);

  useAction('primary', toggle);

  const pos = transport.position;
  const skip = () => {
    const t = tracker.current;
    if (!t || !pos) return;
    t.skip(Math.max(0, pos.bar));
    if (t.turn) setTurnView(t.turn);
  };
  const extend = () => {
    const t = tracker.current;
    if (!t) return;
    t.extend();
    if (t.turn) setTurnView(t.turn);
  };

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      transport.stop();
    },
    // Stop the band when leaving the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const counting = phase === 'playing' && pos && pos.bar < 0;
  const inTurn = phase === 'playing' && turnView && pos && pos.bar >= 0;
  const lastBar = !!(inTurn && pos.bar === turnView.startBar + turnView.bars - 1);
  const who = turnView?.who;

  const headline = useMemo(() => {
    if (phase === 'done') return 'Nice trading!';
    if (phase === 'paused') return 'Paused';
    if (counting) return 'Get ready…';
    if (!turnView || phase !== 'playing') return 'Ready?';
    return who === 'you' ? 'YOUR TURN' : "APP'S TURN";
  }, [phase, counting, turnView, who]);

  const subline = useMemo(() => {
    if (!turnView || phase !== 'playing') return '';
    if (who === 'app')
      return echo ? 'Listen closely, then play it back.' : 'Listen. Your answer is next.';
    return echo ? 'Play back what you heard.' : 'Play your phrase. No wrong notes, just new ideas.';
  }, [turnView, phase, who, echo]);

  const keyLabel = jam
    ? `${noteName(keyRootsFor(jam.mode)[jam.keyPc])} ${MODE_NAMES[jam.mode]}`
    : null;

  return (
    <section className="stack">
      <FocusView>
        <h1>Trade fours</h1>
        <HowTo game="trade-fours" />
        <div
          className="turn"
          data-who={phase === 'playing' ? who : undefined}
          data-flash={lastBar}
          aria-live="off"
        >
          <p className="prompt">{headline}</p>
          {subline && <p>{subline}</p>}
          {lastBar && <p role="status">Switching next bar…</p>}
          {keyLabel && phase !== 'idle' && (
            <p className="muted">
              {keyLabel} · {transport.bpm} BPM · {PHRASES.styles[style].label} phrases
              {turnView ? ` · Round ${turnView.round} of ${rounds}` : ''}
            </p>
          )}
        </div>

        {phase === 'playing' && turnView && (
          <BarCounter
            bars={turnView.bars}
            beatsPerBar={transport.signature.beats}
            position={
              pos && pos.bar >= turnView.startBar
                ? { bar: pos.bar - turnView.startBar, beat: pos.beat }
                : null
            }
          />
        )}

        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn--primary" onClick={toggle}>
            {phase === 'playing'
              ? 'Pause'
              : phase === 'paused'
                ? 'Resume'
                : phase === 'done'
                  ? 'Again'
                  : 'Start'}
          </button>
          {(phase === 'playing' || phase === 'paused') && (
            <>
              <button type="button" className="btn" onClick={skip} disabled={phase !== 'playing'}>
                Skip turn
              </button>
              <button type="button" className="btn" onClick={extend}>
                Extend +{phraseBars} bars
              </button>
              <button type="button" className="btn btn--ghost" onClick={end}>
                End
              </button>
            </>
          )}
        </div>
      </FocusView>

      <div className="card stack">
        <h2>Settings</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="tf-bars">Phrase length</label>
            <select
              id="tf-bars"
              className="input"
              value={phraseBars}
              onChange={(e) => setPhraseBars(Number(e.target.value) as 2 | 4 | 8)}
              disabled={phase === 'playing'}
            >
              {[2, 4, 8].map((n) => (
                <option key={n} value={n}>
                  {n} bars
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tf-key">Key</label>
            <select
              id="tf-key"
              className="input"
              value={keyPc ?? 'roll'}
              onChange={(e) => setKeyPc(e.target.value === 'roll' ? null : Number(e.target.value))}
              disabled={phase === 'playing'}
            >
              <option value="roll">Roll for me</option>
              {keyRootsFor(mode ?? 'major').map((n, pc) => (
                <option key={pc} value={pc}>
                  {noteName(n)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tf-mode">Mode</label>
            <select
              id="tf-mode"
              className="input"
              value={mode ?? 'roll'}
              onChange={(e) =>
                setMode(e.target.value === 'roll' ? null : (e.target.value as ScaleId))
              }
              disabled={phase === 'playing'}
            >
              <option value="roll">Roll for me</option>
              {MODE_IDS.map((m) => (
                <option key={m} value={m}>
                  {MODE_NAMES[m]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="tf-groove">Groove</label>
            <select
              id="tf-groove"
              className="input"
              value={transport.grooveId}
              onChange={(e) => {
                if (grooveById(e.target.value)) transport.setGrooveId(e.target.value);
              }}
            >
              {GROOVES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tf-style">App phrase style</label>
            <select
              id="tf-style"
              className="input"
              value={style}
              onChange={(e) => setStyle(e.target.value as PhraseStyle)}
            >
              {PHRASE_STYLES.map((s) => (
                <option key={s} value={s}>
                  {PHRASES.styles[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tf-level">Difficulty</label>
            <select
              id="tf-level"
              className="input"
              value={level}
              onChange={(e) => setLevel(e.target.value as SkillLevel)}
            >
              {SKILL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l[0].toUpperCase() + l.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tf-rounds">Rounds</label>
            <select
              id="tf-rounds"
              className="input"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              disabled={phase === 'playing'}
            >
              {[1, 2, 3, 4, 6, 8].map((n) => (
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
            checked={echo}
            onChange={(e) => setEcho(e.target.checked)}
            disabled={phase === 'playing'}
          />
          Echo mode: the app plays first, you play it back by ear
        </label>
        <p className="muted">
          Set the tempo in the dock below. The band ducks a little while the app plays.
        </p>
      </div>

      <ConstraintToggle />
    </section>
  );
}
