import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HowTo } from '../../components/HowTo';
import { getContext } from '../../audio/engine';
import { msUntil } from '../../audio/scheduler';
import { useTransport } from '../../audio/transport';
import { announce } from '../../components/announce';
import { BarCounter } from '../../components/BarCounter';
import { ChordStrip } from '../../components/ChordStrip';
import { FocusView } from '../../components/FocusView';
import { History } from '../../random/deck';
import { createRng } from '../../random/rng';
import { SKILL_LEVELS, type SkillLevel } from '../../state/profile';
import { useApp } from '../../state/AppState';
import { useAction } from '../../state/shortcuts';
import { bestCapo } from '../../theory/chords';
import { noteName, TRANSPOSITIONS } from '../../theory/notes';
import { MODE_IDS, keyRootsFor, type ScaleId } from '../../theory/scales';
import { ConstraintToggle } from '../constraints/ConstraintToggle';
import { MODE_NAMES } from '../roulette/roulette';
import {
  challengeChange,
  deal,
  describeChord,
  realizeDeal,
  redealChord,
  type Deal,
  type DealLength,
  type DisplayMode,
} from './deal';

const LENGTH_LABELS: Record<string, string> = {
  '4': '4 chords',
  '8': '8 chords',
  blues: '12-bar blues',
};

export function ProgressionsPage() {
  const { profile } = useApp();
  const transport = useTransport();
  const [rng] = useState(() => createRng(Date.now()));
  const [history] = useState(() => new History<Deal>(10));

  const [keyPc, setKeyPc] = useState<number | null>(null);
  const [mode, setMode] = useState<ScaleId | null>(null);
  const [level, setLevel] = useState<SkillLevel>(profile.level);
  const [length, setLength] = useState<DealLength>(4);
  const [display, setDisplay] = useState<DisplayMode>('both');
  const [capo, setCapo] = useState(0);
  const [challengeLoops, setChallengeLoops] = useState(0);
  const [current, setCurrent] = useState<Deal | null>(null);
  const dealRef = useRef<Deal | null>(null);

  const chords = useMemo(() => (current ? realizeDeal(current) : []), [current]);

  /** Show a deal and hand its chords to the backing band. */
  const commit = useCallback(
    (d: Deal, announceIt = true) => {
      dealRef.current = d;
      setCurrent(d);
      transport.setProgression(realizeDeal(d), 1);
      if (announceIt) {
        const names = realizeDeal(d).map(
          (c, i) => describeChord(c, d.romans[i], { transposition: 'C', capo: 0 }).name,
        );
        announce(`Progression: ${names.join(', ')}`);
      }
    },
    [transport],
  );

  const dealNew = useCallback(() => {
    const d = deal({ keyPc, mode, level, length }, rng);
    history.push(d);
    commit(d);
  }, [keyPc, mode, level, length, rng, history, commit]);

  const redealOne = useCallback(
    (index: number) => {
      const d = dealRef.current;
      if (!d) return;
      const next = redealChord(d, index, rng);
      history.push(next);
      commit(next);
    },
    [rng, history, commit],
  );

  const back = useCallback(() => {
    const prev = history.back();
    if (prev) commit(prev);
  }, [history, commit]);

  useAction('primary', dealNew);
  useAction('reroll', dealNew);
  useAction('back', back);

  // Changes Challenge: after N loops, change one chord (or modulate up a step) without stopping.
  useEffect(() => {
    if (challengeLoops <= 0) return;
    return transport.onBeat((e) => {
      const d = dealRef.current;
      if (!d || e.bar < 0) return;
      const barsInLoop = d.romans.length;
      const lastBeat = e.beat === e.signature.beats - 1;
      const loopsDone = (e.bar + 1) / barsInLoop;
      if (!lastBeat || !Number.isInteger(loopsDone) || loopsDone % challengeLoops !== 0) return;
      const change = challengeChange(d, rng);
      history.push(change.deal);
      dealRef.current = change.deal;
      // The band reads the progression at each bar, so this takes effect on the next downbeat.
      transport.setProgression(realizeDeal(change.deal), 1);
      window.setTimeout(
        () => {
          setCurrent(change.deal);
          announce(
            change.kind === 'key'
              ? 'Changes! Same progression, up a step.'
              : `Changes! Chord ${(change.index ?? 0) + 1} is different.`,
          );
        },
        msUntil(e.time + e.duration, getContext()),
      );
    });
  }, [challengeLoops, transport, rng, history]);

  const pos = transport.position;
  const currentIndex =
    transport.running && pos && pos.bar >= 0 && chords.length > 0 ? pos.bar % chords.length : null;

  const cards = useMemo(
    () =>
      current
        ? chords.map((c, i) => {
            const d = describeChord(c, current.romans[i], {
              transposition: profile.transposition,
              capo,
            });
            return {
              name: d.name,
              roman: d.roman,
              spoken: d.spoken,
              note: d.concert ? `sounds as ${d.concert}` : undefined,
            };
          })
        : [],
    [current, chords, profile.transposition, capo],
  );

  const keyOptions = keyRootsFor(mode ?? 'major');

  return (
    <section className="stack">
      <FocusView>
        <h1>Chord dealer</h1>
        <HowTo game="progressions" />
        {current ? (
          <>
            <p className="prompt" style={{ textAlign: 'center' }}>
              {noteName(keyRootsFor(current.mode)[current.keyPc])} {MODE_NAMES[current.mode]}
            </p>
            <ChordStrip
              chords={cards}
              currentIndex={currentIndex}
              show={display}
              action={(i) => (
                <button
                  type="button"
                  className="btn btn--ghost"
                  aria-label={`Re-deal chord ${i + 1}`}
                  onClick={() => redealOne(i)}
                >
                  ↻
                </button>
              )}
            />
            <BarCounter
              bars={current.romans.length}
              beatsPerBar={transport.signature.beats}
              position={
                transport.running && pos && pos.bar >= 0
                  ? { bar: pos.bar % current.romans.length, beat: pos.beat }
                  : null
              }
            />
          </>
        ) : (
          <p className="muted" style={{ textAlign: 'center' }}>
            Deal a progression, loop it with the band, and play over the changes.
          </p>
        )}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn--primary" onClick={dealNew}>
            {current ? 'Deal again' : 'Deal'}
          </button>
          {current && (
            <button
              type="button"
              className="btn"
              onClick={() =>
                transport.running ? transport.stop() : void transport.start({ countIn: 1 })
              }
            >
              {transport.running ? '■ Stop' : '▶ Play'}
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={back}>
            Back
          </button>
        </div>
        {profile.transposition !== 'C' && (
          <p className="muted" style={{ textAlign: 'center' }}>
            Showing written pitch for your{' '}
            {TRANSPOSITIONS[profile.transposition].label.toLowerCase()}.
          </p>
        )}
      </FocusView>

      <div className="card stack">
        <h2>Settings</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="d-key">Key</label>
            <select
              id="d-key"
              className="input"
              value={keyPc ?? 'roll'}
              onChange={(e) => setKeyPc(e.target.value === 'roll' ? null : Number(e.target.value))}
            >
              <option value="roll">Roll for me</option>
              {keyOptions.map((n, pc) => (
                <option key={pc} value={pc}>
                  {noteName(n)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-mode">Mode</label>
            <select
              id="d-mode"
              className="input"
              value={mode ?? 'roll'}
              onChange={(e) =>
                setMode(e.target.value === 'roll' ? null : (e.target.value as ScaleId))
              }
            >
              <option value="roll">Roll for me</option>
              {MODE_IDS.map((m) => (
                <option key={m} value={m}>
                  {MODE_NAMES[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-level">Difficulty</label>
            <select
              id="d-level"
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
            <label htmlFor="d-length">Length</label>
            <select
              id="d-length"
              className="input"
              value={String(length)}
              onChange={(e) =>
                setLength(e.target.value === 'blues' ? 'blues' : (Number(e.target.value) as 4 | 8))
              }
            >
              {Object.entries(LENGTH_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="d-display">Show</label>
            <select
              id="d-display"
              className="input"
              value={display}
              onChange={(e) => setDisplay(e.target.value as DisplayMode)}
            >
              <option value="names">Chord names</option>
              <option value="roman">Roman numerals</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-capo">Capo</label>
            <div className="row">
              <select
                id="d-capo"
                className="input"
                value={capo}
                disabled={profile.transposition !== 'C'}
                onChange={(e) => setCapo(Number(e.target.value))}
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? 'No capo' : `Fret ${i}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                disabled={chords.length === 0 || profile.transposition !== 'C'}
                onClick={() => setCapo(bestCapo(chords))}
              >
                Suggest
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="d-challenge">Changes Challenge</label>
            <select
              id="d-challenge"
              className="input"
              value={challengeLoops}
              onChange={(e) => setChallengeLoops(Number(e.target.value))}
            >
              <option value={0}>Off</option>
              {[2, 3, 4, 6].map((n) => (
                <option key={n} value={n}>
                  Change something every {n} loops
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="muted">
          Beginner deals use triads. Intermediate adds ii–V–I, 7ths and borrowed chords. Advanced
          adds secondary dominants, tritone subs and extended chords.
        </p>
      </div>

      <ConstraintToggle />
    </section>
  );
}
