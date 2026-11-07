import { TRANSPOSITIONS, type TranspositionKey } from '../theory/notes';
import {
  INSTRUMENTS,
  SKILL_LEVELS,
  transpositionFor,
  type Profile,
  type SkillLevel,
} from '../state/profile';

const LEVEL_TEXT: Record<SkillLevel, string> = {
  beginner: 'Beginner: friendly keys, simple chords, slow tempos',
  intermediate: 'Intermediate: all keys, modes, 7th chords',
  advanced: 'Advanced: odd meters, extended chords, wide tempos',
};

interface Props {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
}

/** Shared by first-run onboarding and the Profile page. */
export function ProfileForm({ profile, onChange }: Props) {
  const setMain = (id: string) =>
    onChange({
      mainInstrument: id,
      otherInstruments: profile.otherInstruments.filter((o) => o !== id),
      // Pre-fill transposition from the instrument; the player can still change it.
      transposition: transpositionFor(id),
    });

  const toggleOther = (id: string) =>
    onChange({
      otherInstruments: profile.otherInstruments.includes(id)
        ? profile.otherInstruments.filter((o) => o !== id)
        : [...profile.otherInstruments, id],
    });

  return (
    <div>
      <fieldset className="field" style={{ border: 0, padding: 0 }}>
        <legend>Main instrument</legend>
        <div className="choice-grid" role="radiogroup" aria-label="Main instrument">
          {INSTRUMENTS.map((i) => (
            <button
              key={i.id}
              type="button"
              role="radio"
              aria-checked={profile.mainInstrument === i.id}
              aria-pressed={undefined}
              className="btn"
              data-selected={profile.mainInstrument === i.id}
              style={
                profile.mainInstrument === i.id
                  ? { background: 'var(--yellow)', color: 'var(--on-yellow)' }
                  : undefined
              }
              onClick={() => setMain(i.id)}
            >
              {profile.mainInstrument === i.id ? '✓ ' : ''}
              {i.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field" style={{ border: 0, padding: 0 }}>
        <legend>Also play (optional)</legend>
        <div className="choice-grid">
          {INSTRUMENTS.filter((i) => i.id !== profile.mainInstrument).map((i) => (
            <button
              key={i.id}
              type="button"
              className="btn"
              aria-pressed={profile.otherInstruments.includes(i.id)}
              onClick={() => toggleOther(i.id)}
            >
              {i.name}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="transposition">Show chords in</label>
        <select
          id="transposition"
          className="input"
          value={profile.transposition}
          onChange={(e) => onChange({ transposition: e.target.value as TranspositionKey })}
        >
          {(Object.keys(TRANSPOSITIONS) as TranspositionKey[]).map((k) => (
            <option key={k} value={k}>
              {TRANSPOSITIONS[k].label}
            </option>
          ))}
        </select>
        <span className="muted">
          B♭, E♭ and F instruments (sax, trumpet, clarinet, horn) read written pitch.
        </span>
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0 }}>
        <legend>Skill level</legend>
        <div role="radiogroup" aria-label="Skill level" className="stack">
          {SKILL_LEVELS.map((l) => (
            <label key={l} className="row" style={{ minHeight: 'var(--tap)' }}>
              <input
                type="radio"
                name="level"
                value={l}
                checked={profile.level === l}
                onChange={() => onChange({ level: l })}
              />
              <span>{LEVEL_TEXT[l]}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
