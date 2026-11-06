import { useEffect, useState } from 'react';
import { useApp } from '../state/AppState';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  keyLabel,
  rebind,
  type ShortcutAction,
  type ThemeChoice,
} from '../state/settings';

type Target = ShortcutAction | 'pulseTapKey';

/** Wait for the next key press and report it. Global shortcuts pause while capturing. */
function useKeyCapture(onKey: (target: Target, key: string) => void) {
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    if (!target) return;
    document.body.dataset.capturing = 'true';
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key !== 'Escape') onKey(target, e.key);
      setTarget(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      delete document.body.dataset.capturing;
    };
  }, [target, onKey]);

  return { target, capture: setTarget };
}

export function Settings() {
  const { settings, updateSettings } = useApp();

  const { target, capture } = useKeyCapture((t, key) => {
    if (t === 'pulseTapKey') updateSettings({ pulseTapKey: key });
    else updateSettings({ shortcuts: rebind(settings.shortcuts, t, key) });
  });

  return (
    <section className="stack">
      <h1>Settings</h1>

      <div className="card stack">
        <h2>Look and sound</h2>
        <div className="field">
          <label htmlFor="theme">Theme</label>
          <select
            id="theme"
            className="input"
            value={settings.theme}
            onChange={(e) => updateSettings({ theme: e.target.value as ThemeChoice })}
          >
            <option value="system">Match my device</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="volume">Master volume</label>
          <input
            id="volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            style={{ minHeight: 'var(--tap)', accentColor: 'var(--accent)' }}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
          />
        </div>
        <label className="row" style={{ minHeight: 'var(--tap)' }}>
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => updateSettings({ muted: e.target.checked })}
          />
          Mute all sound
        </label>
      </div>

      <div className="card stack">
        <h2>Keyboard shortcuts</h2>
        <p className="muted" role="status">
          {target
            ? 'Press the key you want to use (Esc to cancel)…'
            : 'Remap any action to a key, so a foot pedal or page turner that sends key presses can run the show.'}
        </p>
        <table className="shortcut-table">
          <tbody>
            {SHORTCUT_ACTIONS.map((a) => (
              <tr key={a}>
                <th scope="row">{SHORTCUT_LABELS[a]}</th>
                <td>
                  <kbd>{keyLabel(settings.shortcuts[a])}</kbd>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    aria-label={`Change key for ${SHORTCUT_LABELS[a]}`}
                    aria-pressed={target === a}
                    onClick={() => capture(a)}
                  >
                    Change
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row">Hold the Pulse tap key</th>
              <td>
                <kbd>{keyLabel(settings.pulseTapKey)}</kbd>
              </td>
              <td>
                <button
                  type="button"
                  className="btn"
                  aria-label="Change key for Hold the Pulse tap"
                  aria-pressed={target === 'pulseTapKey'}
                  onClick={() => capture('pulseTapKey')}
                >
                  Change
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div>
          <button
            type="button"
            className="btn"
            onClick={() => updateSettings({ shortcuts: DEFAULT_SHORTCUTS, pulseTapKey: ' ' })}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </section>
  );
}
