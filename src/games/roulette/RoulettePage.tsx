import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { genreById } from '../../audio/band/grooves';
import { getContext } from '../../audio/engine';
import { msUntil } from '../../audio/scheduler';
import { playChime } from '../../audio/sounds';
import { useTransport } from '../../audio/transport';
import { announce } from '../../components/announce';
import { FocusView } from '../../components/FocusView';
import { Spinner } from '../../components/Spinner';
import { useReducedMotion } from '../../components/useReducedMotion';
import { History } from '../../random/deck';
import { createRng } from '../../random/rng';
import { SKILL_LEVELS, playerInstruments, type SkillLevel } from '../../state/profile';
import { useApp } from '../../state/AppState';
import { useAction } from '../../state/shortcuts';
import { ConstraintToggle } from '../constraints/ConstraintToggle';
import { CARDS, DEFAULT_FILTER, eligibleCards } from '../constraints/deck';
import {
  DIFFICULTY,
  MODE_NAMES,
  NO_LOCKS,
  REELS,
  REEL_LABELS,
  backingFor,
  describeResult,
  keyName,
  scaleNotesOf,
  signatureOf,
  spin,
  type Locks,
  type ReelId,
  type RouletteResult,
} from './roulette';

const TOTAL_SPIN_MS = 1500;
const JAM_LENGTHS = [0, 2, 3, 5];

function displayValue(r: RouletteResult | null, reel: ReelId): string {
  if (!r) return '';
  switch (reel) {
    case 'key':
      return keyName(r);
    case 'mode':
      return MODE_NAMES[r.mode] ?? r.mode;
    case 'tempo':
      return String(r.bpm);
    case 'signature':
      return r.signature;
    case 'groove':
      return genreById(r.genre)?.name ?? r.genre;
    case 'wildcard':
      return r.wildcard ? '🃏' : 'Off';
  }
}

export function RoulettePage() {
  const { profile } = useApp();
  const transport = useTransport();
  const reduced = useReducedMotion();
  const [rng] = useState(() => createRng(Date.now()));
  const [history] = useState(() => new History<RouletteResult>(10));

  const [level, setLevel] = useState<SkillLevel>(profile.level);
  const [wildcardOn, setWildcardOn] = useState(true);
  const [jamMinutes, setJamMinutes] = useState(0);
  const [locks, setLocks] = useState<Locks>(NO_LOCKS);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [settled, setSettled] = useState<Set<ReelId>>(new Set(REELS));
  const timers = useRef<number[]>([]);
  const endAt = useRef<number | null>(null);

  const wildcardPool = useMemo(
    () =>
      eligibleCards(
        CARDS,
        { ...DEFAULT_FILTER, beginnerSafe: level === 'beginner' },
        playerInstruments(profile),
      ),
    [level, profile],
  );

  const spinning = settled.size < REELS.length;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  /** Point the shared transport at a result so Play (here or in the dock) uses it. */
  const applyToTransport = useCallback(
    (r: RouletteResult) => {
      const genre = genreById(r.genre);
      transport.setBpm(r.bpm);
      transport.setSignature(signatureOf(r.signature));
      if (genre) transport.setGrooveId(genre.groove);
      transport.setProgression(backingFor(r, level));
    },
    [transport, level],
  );

  const settleAll = useCallback(
    (r: RouletteResult) => {
      clearTimers();
      setSettled(new Set(REELS));
      applyToTransport(r);
      announce(describeResult(r));
    },
    [applyToTransport],
  );

  const doSpin = useCallback(() => {
    // Pressing again while reels are turning skips straight to the result.
    if (spinning && result) {
      settleAll(result);
      return;
    }
    const next = spin(result, locks, { level, wildcardOn, wildcardPool }, rng);
    history.push(next);
    setResult(next);
    if (reduced) {
      settleAll(next);
      return;
    }
    // Locked reels do not spin; the rest stop one after another, finishing at ~1.5 s.
    const spinningReels = REELS.filter((r) => !locks[r] || !result);
    setSettled(new Set(REELS.filter((r) => !spinningReels.includes(r))));
    clearTimers();
    spinningReels.forEach((reel, i) => {
      const at = TOTAL_SPIN_MS - (spinningReels.length - 1 - i) * 180;
      timers.current.push(
        window.setTimeout(() => {
          setSettled((s) => new Set(s).add(reel));
        }, at),
      );
    });
    timers.current.push(window.setTimeout(() => settleAll(next), TOTAL_SPIN_MS + 10));
  }, [spinning, result, locks, level, wildcardOn, wildcardPool, rng, history, reduced, settleAll]);

  const back = useCallback(() => {
    const prev = history.back();
    if (prev) {
      setResult(prev);
      settleAll(prev);
    }
  }, [history, settleAll]);

  const play = useCallback(async () => {
    if (!result) return;
    applyToTransport(result);
    endAt.current = null;
    await transport.start({ countIn: 1 });
  }, [result, applyToTransport, transport]);

  useAction('primary', doSpin);
  useAction('reroll', doSpin);
  useAction('back', back);

  // End cue for timed jams, driven by the audio clock rather than a timer tick.
  useEffect(() => {
    if (jamMinutes <= 0) return;
    return transport.onBeat((e) => {
      if (e.bar < 0) return;
      endAt.current ??= e.time + jamMinutes * 60;
      if (e.time >= endAt.current) {
        endAt.current = Infinity;
        playChime(e.time, 'end');
        window.setTimeout(() => transport.stop(), msUntil(e.time + 0.8, getContext()));
        announce('Jam finished. Nice playing.');
      }
    });
  }, [jamMinutes, transport]);

  // "Start Jamming" on Home lands here with ?autostart=1.
  const autostarted = useRef(false);
  useEffect(() => {
    if (autostarted.current || !window.location.hash.includes('autostart=1')) return;
    autostarted.current = true;
    const next = spin(null, NO_LOCKS, { level, wildcardOn, wildcardPool }, rng);
    history.push(next);
    setResult(next);
    applyToTransport(next);
    announce(describeResult(next));
    void transport.start({ countIn: 1 });
    // Run once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      clearTimers();
    },
    [],
  );

  const optionsFor = (reel: ReelId): string[] => {
    const cfg = DIFFICULTY[level];
    switch (reel) {
      case 'key':
        return ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'B♭', 'E♭', 'A♭', 'F♯'];
      case 'mode':
        return cfg.modes.map((m) => MODE_NAMES[m] ?? m);
      case 'tempo':
        return [String(cfg.bpm[0]), '88', '96', '104', '120', String(cfg.bpm[1])];
      case 'signature':
        return cfg.signatures;
      case 'groove':
        return ['Rock', 'Funk', 'Reggae', 'Bossa nova', 'Waltz'];
      case 'wildcard':
        return ['🃏', '🎴'];
    }
  };

  const visible = (reel: ReelId) => (reel === 'wildcard' && !wildcardOn ? false : true);

  return (
    <section className="stack">
      <FocusView>
        <h1>Jam Roulette</h1>
        <div className="reels">
          {REELS.filter(visible).map((reel) => (
            <Spinner
              key={reel}
              label={REEL_LABELS[reel]}
              value={displayValue(result, reel)}
              options={optionsFor(reel)}
              spinning={!settled.has(reel)}
              locked={locks[reel]}
              onToggleLock={() => setLocks((l) => ({ ...l, [reel]: !l[reel] }))}
            />
          ))}
        </div>

        {result && !spinning && (
          <div className="card stack" aria-label="Result">
            <p className="prompt">
              {keyName(result)} {MODE_NAMES[result.mode]}
            </p>
            <p>
              <span className="chip">{result.bpm} BPM</span>{' '}
              <span className="chip">{result.signature}</span>{' '}
              <span className="chip">{genreById(result.genre)?.name}</span>
            </p>
            <p className="muted">Scale: {scaleNotesOf(result).join(' – ')}</p>
            {result.wildcard && (
              <p>
                <span className="chip">Wildcard</span> {result.wildcard.text}
              </p>
            )}
          </div>
        )}

        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn--primary" onClick={doSpin}>
            {spinning ? 'Skip' : result ? 'Spin again' : 'Spin'}
          </button>
          {result && (
            <button
              type="button"
              className="btn"
              onClick={() => (transport.running ? transport.stop() : void play())}
            >
              {transport.running ? '■ Stop' : '▶ Play'}
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={back}>
            Back
          </button>
        </div>
      </FocusView>

      <div className="card stack">
        <h2>Settings</h2>
        <div className="field">
          <label htmlFor="roulette-level">Difficulty</label>
          <select
            id="roulette-level"
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
        <label className="row" style={{ minHeight: 'var(--tap)' }}>
          <input
            type="checkbox"
            checked={wildcardOn}
            onChange={(e) => setWildcardOn(e.target.checked)}
          />
          Wildcard (draw a constraint card)
        </label>
        <div className="field">
          <label htmlFor="jam-length">Jam length</label>
          <select
            id="jam-length"
            className="input"
            value={jamMinutes}
            onChange={(e) => setJamMinutes(Number(e.target.value))}
          >
            {JAM_LENGTHS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'Open-ended' : `${m} minutes`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ConstraintToggle />
    </section>
  );
}
