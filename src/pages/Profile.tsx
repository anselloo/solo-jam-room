import { ProfileForm } from '../components/ProfileForm';
import { useApp } from '../state/AppState';

export function Profile() {
  const { profile, updateProfile } = useApp();
  return (
    <section className="stack">
      <h1>Your profile</h1>
      <p className="muted">
        Saved on this device only. Nothing leaves your browser, and there&apos;s no account.
      </p>
      <div className="card">
        <ProfileForm profile={profile} onChange={updateProfile} />
      </div>
    </section>
  );
}
