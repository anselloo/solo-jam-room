import { useCallback, useEffect, useMemo, useState } from 'react';
import { HowTo } from '../../components/HowTo';
import { genreById } from '../../audio/band/grooves';
import { getContext } from '../../audio/engine';
import { playChime } from '../../audio/sounds';
import { useTransport } from '../../audio/transport';
import { announce } from '../../components/announce';
import { Timer, useCountdown } from '../../components/Timer';
import { createRng } from '../../random/rng';
import { playerInstruments } from '../../state/profile';
import { useApp } from '../../state/AppState';
import {
  addNote,
  clearDraft,
  loadDraft,
  loadNotes,
  newNoteId,
  saveDraft,
  saveNotes,
  type SprintNote,
} from '../../state/notes';
import { useAction } from '../../state/shortcuts';
import { CARDS, DEFAULT_FILTER, eligibleCards } from '../constraints/deck';
import { MODE_NAMES, backingFor, keyName, signatureOf } from '../roulette/roulette';
import {
  DEFAULT_SPRINT_MINUTES,
  FIELD_LABELS,
  SPRINT_MINUTES,
  generatePack,
  rerollField,
  warningsFor,
  type PackField,
  type PromptPack,
} from './sprint';

type Phase = 'setup' | 'sprint' | 'down';

const setupText = (p: PromptPack): string =>
  `${keyName(p.result)} ${MODE_NAMES[p.result.mode] ?? p.result.mode} · ${p.result.bpm} BPM`;

export function SongSprintPage() {
  const { profile } = useApp();
  const transport = useTransport();
  const level = profile.level;
  const [rng] = useState(() => createRng(Date.now()));
  const pool = useMemo(
    () =>
      eligibleCards(
        CARDS,
        { ...DEFAULT_FILTER, beginnerSafe: level === 'beginner' },
        playerInstruments(profile),
      ),
    [level, profile],
  );

  const [pack, setPack] = useState<PromptPack>(() => generatePack(rng, level, pool));
  const [minutes, setMinutes] = useState<number>(DEFAULT_SPRINT_MINUTES);
  const [phase, setPhase] = useState<Phase>('setup');
  const [text, setText] = useState(loadDraft);
  const [banner, setBanner] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [check, setCheck] = useState({ hook: false, chorusLift: false, constraint: false });

  const countdown = useCountdown(minutes * 60, {
    warnAt: warningsFor(minutes),
    onWarn: (s) => {
      const msg = s >= 120 ? `${Math.round(s / 60)} minutes left` : 'One minute left. Wrap it up.';
      playChime(getContext().currentTime + 0.02, 'warn');
      setBanner(msg);
      announce(msg);
    },
    onDone: () => {
      playChime(getContext().currentTime + 0.02, 'end');
      setPhase('down');
      setBanner(null);
      announce('Pencils down!');
    },
  });

  const reroll = (field: PackField) => setPack((p) => rerollField(p, field, rng, level, pool));

  const loadBand = useCallback(() => {
    const r = pack.result;
    transport.setSignature(signatureOf(r.signature));
    transport.setBpm(r.bpm);
    const genre = genreById(r.genre);
    if (genre) transport.setGrooveId(genre.groove);
    transport.setProgression(backingFor(r, level), 1);
  }, [pack, transport, level]);

  const startSprint = useCallback(() => {
    countdown.reset(minutes * 60);
    countdown.start();
    setSaved(false);
    setCheck({ hook: false, chorusLift: false, constraint: false });
    setBanner(null);
    setPhase('sprint');
    announce(`Sprint started: ${minutes} minutes. Title: ${pack.title}.`);
  }, [countdown, minutes, pack.title]);

  const pencilsDown = useCallback(() => {
    countdown.pause();
    setBanner(null);
    setPhase('down');
    announce('Pencils down!');
  }, [countdown]);

  const playThrough = useCallback(async () => {
    loadBand();
    if (transport.running) transport.stop();
    else await transport.start({ countIn: 1 });
  }, [loadBand, transport]);

  const saveNote = useCallback(() => {
    const note: SprintNote = {
      id: newNoteId(),
      savedAt: new Date().toISOString(),
      title: pack.title,
      theme: pack.theme,
      structure: pack.structure,
      setup: setupText(pack),
      text,
      check,
    };
    saveNotes(addNote(loadNotes(), note));
    clearDraft();
    setText('');
    setSaved(true);
    announce('Notes saved to your profile.');
  }, [pack, text, check]);

  const another = useCallback(() => {
    transport.stop();
    countdown.reset(minutes * 60);
    setPack(generatePack(rng, level, pool));
    setSaved(false);
    setPhase('setup');
  }, [transport, countdown, minutes, rng, level, pool]);

  const onText = (value: string) => {
    setText(value);
    saveDraft(value);
  };

  useAction('primary', () => {
    if (phase === 'setup') startSprint();
  });
  useAction('reroll', () => {
    if (phase === 'setup') setPack(generatePack(rng, level, pool));
  });

  useEffect(
    () => () => {
      transport.stop();
    },
    // Stop the band when leaving the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const genreName = genreById(pack.result.genre)?.name ?? pack.result.genre;
  const fields: { field: PackField; value: string }[] = [
    { field: 'title', value: pack.title },
    { field: 'theme', value: pack.theme },
    { field: 'structure', value: pack.structure },
    { field: 'key', value: `${keyName(pack.result)} ${MODE_NAMES[pack.result.mode] ?? ''}` },
    { field: 'tempo', value: `${pack.result.bpm} BPM · ${pack.result.signature}` },
    { field: 'groove', value: genreName },
    { field: 'constraint', value: pack.result.wildcard?.text ?? 'No constraint' },
  ];

  return (
    <section className="stack">
      <h1>Song sprint</h1>
      <HowTo game="song-sprint" />

      {phase === 'down' && (
        <div className="card stack" aria-live="polite">
          <p className="prompt">Pencils down!</p>
          <p>Now play your song through once with the band. Then be honest with yourself:</p>
          <div className="row">
            <button type="button" className="btn btn--primary" onClick={() => void playThrough()}>
              {transport.running ? '■ Stop' : '▶ Play it through'}
            </button>
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend>Self-check</legend>
            {(
              [
                ['hook', 'Did it have a hook?'],
                ['chorusLift', 'Did the chorus lift?'],
                ['constraint', 'Did you follow the constraint?'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="row" style={{ minHeight: 'var(--tap)' }}>
                <input
                  type="checkbox"
                  checked={check[k]}
                  onChange={(e) => setCheck((c) => ({ ...c, [k]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="sprint-notes-final">Your notes</label>
            <textarea
              id="sprint-notes-final"
              className="input notes-box"
              value={text}
              onChange={(e) => onText(e.target.value)}
            />
          </div>
          <div className="row">
            <button type="button" className="btn btn--primary" onClick={saveNote} disabled={saved}>
              {saved ? 'Saved' : 'Save notes'}
            </button>
            <button type="button" className="btn" onClick={another}>
              Start another sprint
            </button>
          </div>
          {saved && (
            <p className="notice" role="status">
              Saved. Find your notes on your <a href="#/profile">profile</a>.
            </p>
          )}
        </div>
      )}

      {phase === 'sprint' && (
        <div className="stack">
          <Timer remaining={countdown.remaining} warnAt={60} label="Sprint time left" />
          {banner && (
            <p className="notice" role="status" style={{ fontSize: '1.4rem' }}>
              {banner}
            </p>
          )}
          <div className="row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn--primary" onClick={pencilsDown}>
              Pencils down
            </button>
            <button type="button" className="btn" onClick={() => void playThrough()}>
              {transport.running ? '■ Stop the band' : '▶ Hear the groove'}
            </button>
          </div>
        </div>
      )}

      <div className="card stack" aria-label="Prompt pack">
        <h2>Your prompt</h2>
        <ul className="plain-list">
          {fields.map(({ field, value }) => (
            <li key={field}>
              <span>
                <span className="muted">{FIELD_LABELS[field]}: </span>
                <strong>{value}</strong>
              </span>
              {phase === 'setup' && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  aria-label={`Re-roll ${FIELD_LABELS[field]}`}
                  onClick={() => reroll(field)}
                >
                  ↻
                </button>
              )}
            </li>
          ))}
        </ul>
        {phase === 'setup' && (
          <div className="row">
            <div className="field">
              <label htmlFor="sprint-minutes">Time</label>
              <select
                id="sprint-minutes"
                className="input"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                {SPRINT_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn--primary" onClick={startSprint}>
              Start the sprint
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setPack(generatePack(rng, level, pool))}
            >
              New prompt
            </button>
          </div>
        )}
      </div>

      {phase !== 'down' && (
        <div className="card stack">
          <div className="field">
            <label htmlFor="sprint-notes">Notes: lyrics, chords, ideas</label>
            <textarea
              id="sprint-notes"
              className="input notes-box"
              value={text}
              onChange={(e) => onText(e.target.value)}
              placeholder="Jot anything down. It saves on this device as you type."
            />
          </div>
        </div>
      )}
    </section>
  );
}
