import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppState';
import { SHORTCUT_ACTIONS, SHORTCUT_LABELS, keyLabel } from '../state/settings';

export function ShortcutHelp() {
  const { settings, helpOpen, setHelpOpen } = useApp();
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (helpOpen) close.current?.focus();
  }, [helpOpen]);

  if (!helpOpen) return null;
  return (
    <div className="overlay" onClick={() => setHelpOpen(false)}>
      <div
        className="card dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="help-title">Keyboard shortcuts</h2>
        <table className="shortcut-table">
          <tbody>
            {SHORTCUT_ACTIONS.map((a) => (
              <tr key={a}>
                <th scope="row">{SHORTCUT_LABELS[a]}</th>
                <td>
                  <kbd>{keyLabel(settings.shortcuts[a])}</kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          Change these in <a href="#/settings">Settings</a>, for example to use a foot pedal or page
          turner.
        </p>
        <button ref={close} type="button" className="btn" onClick={() => setHelpOpen(false)}>
          Close
        </button>
      </div>
    </div>
  );
}
