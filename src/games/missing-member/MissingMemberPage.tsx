import { useCallback, useEffect, useRef, useState } from 'react';
import { HowTo } from '../../components/HowTo';
import { GROOVES, genreById, GENRES } from '../../audio/band/grooves';
import { getContext } from '../../audio/engine';
import { msUntil } from '../../audio/scheduler';
import { playChime } from '../../audio/sounds';
import { useTransport } from '../../audio/transport';
import { announce } from '../../components/announce';
import { BarCounter } from '../../components/BarCounter';
import { FocusView } from '../../components/FocusView';
import { createRng } from '../../random/rng';
import { playerInstruments } from '../../state/profile';
import { useApp } from '../../state/AppState';
import { useAction } from '../../state/shortcuts';
import { noteName } from '../../theory/notes';
import { generatePhrase, phraseScaleFor } from '../../theory/phrases';
import { MODE_IDS, keyRootsFor, type ScaleId } from '../../theory/scales';
import { vampProgression } from '../../theory/vamps';
import { DIFFICULTY, MODE_NAMES, pickTempo, signatureOf } from '../roulette/roulette';
import { ROLES, ROLE_INFO, pickRole, roleWeights, roundPosition, type Role } from './roles';

type Phase = 'idle' | 'playing';

interface Jam {
  keyPc: number;
  mode: ScaleId;
}

const BAND_ROLES: readonly Role[] = ['drums', 'bass', 'chords'];

export function MissingMemberPage() {
  const { profile } = useApp();
  const transport = useTransport();
  const [rng] = useState(() => createRng(Date.now()));

  const [allowed, setAllowed] = useState<Role[]>([...ROLES]);
  const [roundBars, setRoundBars] = useState(8);
  const [keyPc, setKeyPc] = useState<number | null>(null);
  const [mode, setMode] = useState<ScaleId | null>(null);
  const [rollTempo, setRollTempo] = useState(true);

  const [phase, setPhase] = useState<Phase>('idle');
  const [jam, setJam] = useState<Jam | null>(null);
  const [view, setView] = useState<{ round: number; role: Role } | null>(null);
  const [warning, setWarning] = useState<Role | null>(null);

  const roles = useRef<Role[]>([]);
  const jamRef = useRef<Jam | null>(null);
  const timers = useRef<number[]>([]);
  const settings = useRef({ allowed, roundBars });
  useEffect(() => {
    settings.current = { allowed, roundBars };
  }, [allowed, roundBars]);

  const weights = roleWeights(playerInstruments(profile));
  const weightsRef = useRef(weights);
  useEffect(() => {
    weightsRef.current = weights;
  });

  const later = useCallback((fn: () => void, audioTime: number) => {
    timers.current.push(window.setTimeout(fn, msUntil(audioTime, getContext())));
  }, []);

  /** The role missing in a given round, chosen on first need and then remembered. */
  const roleFor = useCallback(
    (round: number): Role => {
      while (roles.current.length <= round) {
        roles.current.push(
          pickRole(
            rng,
            settings.current.allowed,
            weightsRef.current,
            roles.current[roles.current.length - 1],
          ),
        );
      }
      return roles.current[round];
    },
    [rng],
  );

  /** Mute exactly the missing part (lead is handled by simply not playing the app's melody). */
  const applyRole = useCallback(
    (role: Role) => {
      for (const part of BAND_ROLES)
        transport.setPart(part as 'drums' | 'bass' | 'chords', { muted: part === role });
    },
    [transport],
  );

  const unmuteAll = useCallback(() => {
    for (const part of BAND_ROLES)
      transport.setPart(part as 'drums' | 'bass' | 'chords', { muted: false });
  }, [transport]);

  useEffect(() => {
    if (phase !== 'playing') return;
    return transport.onBeat((e) => {
      const j = jamRef.current;
      if (!j || e.bar < 0) return;
      const { round, isLastBar } = roundPosition(e.bar, settings.current.roundBars);
      const role = roleFor(round);
      const lastBeat = e.beat === e.signature.beats - 1;

      if (e.beat === 0) {
        // The app plays a light melody over the band, but only when the lead is not the missing part.
        if (role !== 'lead' && e.bar % 2 === 0) {
          const band = transport.getBand();
          const phrase = generatePhrase({
            root: keyRootsFor(j.mode)[j.keyPc],
            scale: phraseScaleFor('simple', j.mode),
            style: 'simple',
            level: 'beginner',
            bars: 2,
            beatsPerBar: e.signature.beats,
            rng,
          });
          for (const n of phrase) {
            band?.playLead(
              e.time + n.start * e.duration,
              n.midi,
              n.duration * e.duration * 0.9,
              n.velocity * 0.6,
            );
          }
        }
        if (e.bar === 0) later(() => setView({ round: 0, role }), e.time);
        if (isLastBar) {
          // One-bar warning before the role changes.
          const next = roleFor(round + 1);
          playChime(e.time, 'warn');
          later(() => {
            setWarning(next);
            announce(`Next round: ${ROLE_INFO[next].short}`);
          }, e.time);
        }
      }

      // Change roles on the last beat of the last bar so the very next scheduled beat, the
      // downbeat, already has the new part missing.
      if (isLastBar && lastBeat) {
        const next = roleFor(round + 1);
        applyRole(next);
        later(() => {
          setWarning(null);
          setView({ round: round + 1, role: next });
          announce(ROLE_INFO[next].banner);
        }, e.time + e.duration);
      }
    });
  }, [phase, transport, roleFor, applyRole, later, rng]);

  const start = useCallback(async () => {
    const level = profile.level;
    const m = mode ?? rng.pick([...MODE_IDS]);
    const k = keyPc ?? rng.int(0, 11);
    const j: Jam = { keyPc: k, mode: m };
    jamRef.current = j;
    setJam(j);
    roles.current = [];
    const first = roleFor(0);
    transport.setSignature(signatureOf('4/4'));
    if (rollTempo) {
      // Roll a groove, and a tempo that suits it and the player's level. Otherwise the dock's
      // tempo and groove are used as they are.
      const genre = rng.pick(GENRES);
      transport.setGrooveId(genre.groove);
      transport.setBpm(pickTempo(rng, DIFFICULTY[level], genreById(genre.id)));
    }
    transport.setProgression(
      vampProgression({ root: keyRootsFor(m)[k], mode: m }, level !== 'beginner'),
      1,
    );
    applyRole(first);
    setView({ round: 0, role: first });
    setWarning(null);
    setPhase('playing');
    await transport.start({ countIn: 1 });
    announce(ROLE_INFO[first].banner);
  }, [profile.level, mode, keyPc, rollTempo, rng, roleFor, applyRole, transport]);

  const stop = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    transport.stop();
    unmuteAll();
    setPhase('idle');
    setWarning(null);
  }, [transport, unmuteAll]);

  const toggle = useCallback(() => {
    if (phase === 'playing') stop();
    else void start();
  }, [phase, start, stop]);

  useAction('primary', toggle);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      transport.stop();
      for (const part of BAND_ROLES)
        transport.setPart(part as 'drums' | 'bass' | 'chords', { muted: false });
    },
    // Leaving the game must hand the full band back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const pos = transport.position;
  const counting = phase === 'playing' && pos !== null && pos.bar < 0;
  const info = view ? ROLE_INFO[view.role] : null;
  const barInRound = pos && pos.bar >= 0 ? roundPosition(pos.bar, roundBars).barInRound : null;

  const toggleRole = (r: Role) =>
    setAllowed((a) => (a.includes(r) ? (a.length > 1 ? a.filter((x) => x !== r) : a) : [...a, r]));

  return (
    <section className="stack">
      <FocusView>
        <h1>Missing member</h1>
        <HowTo game="missing-member" />
        <div
          className="turn"
          data-who={phase === 'playing' ? 'app' : undefined}
          data-flash={!!warning}
        >
          {phase === 'idle' || !info ? (
            <p className="muted">
              The band shows up one member short, and you&apos;re filling in. Press Start and cover
              whatever is missing.
            </p>
          ) : (
            <>
              <p className="prompt">{counting ? 'Get ready…' : info.banner}</p>
              <p>{info.hint}</p>
              {warning && (
                <p role="status" className="notice">
                  Next round: {ROLE_INFO[warning].short}.
                </p>
              )}
              {jam && (
                <p className="muted">
                  {noteName(keyRootsFor(jam.mode)[jam.keyPc])} {MODE_NAMES[jam.mode]} ·{' '}
                  {transport.bpm} BPM · Round {(view?.round ?? 0) + 1}
                </p>
              )}
            </>
          )}
        </div>

        {phase === 'playing' && (
          <BarCounter
            bars={roundBars}
            beatsPerBar={transport.signature.beats}
            position={barInRound !== null && pos ? { bar: barInRound, beat: pos.beat } : null}
          />
        )}

        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn--primary" onClick={toggle}>
            {phase === 'playing' ? 'Stop' : 'Start'}
          </button>
        </div>
      </FocusView>

      <div className="card stack">
        <h2>Settings</h2>
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend>Roles that can go missing</legend>
          <div className="row">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                className="btn"
                aria-pressed={allowed.includes(r)}
                onClick={() => toggleRole(r)}
                disabled={phase === 'playing'}
              >
                {ROLE_INFO[r].label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="row">
          <div className="field">
            <label htmlFor="mm-bars">Round length</label>
            <select
              id="mm-bars"
              className="input"
              value={roundBars}
              onChange={(e) => setRoundBars(Number(e.target.value))}
              disabled={phase === 'playing'}
            >
              {[4, 8, 16].map((n) => (
                <option key={n} value={n}>
                  {n} bars
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mm-key">Key</label>
            <select
              id="mm-key"
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
            <label htmlFor="mm-mode">Mode</label>
            <select
              id="mm-mode"
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
        <label className="row" style={{ minHeight: 'var(--tap)' }}>
          <input
            type="checkbox"
            checked={rollTempo}
            onChange={(e) => setRollTempo(e.target.checked)}
            disabled={phase === 'playing'}
          />
          Roll a tempo and groove for me (otherwise use the dock&apos;s tempo and groove)
        </label>
        <p className="muted">
          A drummer is asked to cover drums more often. Groove:{' '}
          {GROOVES.find((g) => g.id === transport.grooveId)?.name}.
        </p>
      </div>
    </section>
  );
}
