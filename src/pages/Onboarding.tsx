import { useEffect, useRef, useState } from 'react';
import { ProfileForm } from '../components/ProfileForm';
import { DEFAULT_PROFILE, type Profile } from '../state/profile';
import { useApp } from '../state/AppState';

/** Short, skippable first-run setup. */
export function Onboarding() {
  const { updateProfile } = useApp();
  const [draft, setDraft] = useState<Profile>(DEFAULT_PROFILE);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  const finish = () => updateProfile({ ...draft, onboarded: true });
  const skip = () => updateProfile({ onboarded: true });

  return (
    <div className="overlay">
      <div
        className="card dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <h2 id="onboarding-title" ref={heading} tabIndex={-1}>
          Welcome to the jam room
        </h2>
        <p className="muted">
          Tell us what you play so the band can fit around you. You can change this any time in your
          profile.
        </p>
        <ProfileForm profile={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
        <div className="row">
          <button type="button" className="btn btn--primary" onClick={finish}>
            Let&apos;s jam
          </button>
          <button type="button" className="btn btn--ghost" onClick={skip}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
