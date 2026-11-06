import { useApp } from '../state/AppState';
import { href } from '../router';

export function Header({ atHome }: { atHome: boolean }) {
  const { settings, updateSettings, toggleFocus, focus } = useApp();
  return (
    <header className="header">
      {!atHome && (
        <a className="btn btn--ghost" href={href('/')} aria-label="Back to home">
          <span aria-hidden="true">←</span>
          <span className="label-text">Home</span>
        </a>
      )}
      <a className="header__brand" href={href('/')}>
        Solo Jam Room
      </a>
      <nav className="header__nav" aria-label="Main">
        <a className="btn btn--ghost" href={href('/profile')}>
          Profile
        </a>
        <a className="btn btn--ghost" href={href('/settings')}>
          Settings
        </a>
        <a className="btn btn--ghost" href={href('/about')}>
          About
        </a>
        <button
          type="button"
          className="btn"
          aria-pressed={focus}
          onClick={toggleFocus}
          title="Focus Mode (F)"
        >
          Focus
        </button>
        <button
          type="button"
          className="btn"
          aria-pressed={settings.muted}
          onClick={() => updateSettings({ muted: !settings.muted })}
          title="Mute"
        >
          {settings.muted ? 'Muted' : 'Sound on'}
        </button>
      </nav>
    </header>
  );
}
