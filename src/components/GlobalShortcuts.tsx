import { useEffect } from 'react';
import { useTransport } from '../audio/transport';
import { useApp } from '../state/AppState';
import { actionForKey } from '../state/settings';
import { dispatchAction, shouldHandle } from '../state/shortcuts';
import { announce } from './announce';

/** Window-level keyboard handling. Renders nothing. */
export function GlobalShortcuts() {
  const { settings, focus, setFocus, toggleFocus, helpOpen, setHelpOpen } = useApp();
  const transport = useTransport();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      // The Settings page sets this while waiting for a new key binding.
      if (document.body.dataset.capturing === 'true') return;
      const action = actionForKey(e.key, settings.shortcuts);
      if (!action || !shouldHandle(action, e.target, e.key)) return;
      e.preventDefault();

      switch (action) {
        case 'focus':
          toggleFocus();
          break;
        case 'help':
          setHelpOpen(!helpOpen);
          break;
        case 'escape':
          if (helpOpen) setHelpOpen(false);
          else if (focus) setFocus(false);
          else dispatchAction('escape');
          break;
        case 'transport':
          void transport.toggle();
          break;
        case 'tap': {
          const bpm = transport.tap();
          if (bpm) announce(`Tempo ${bpm}`);
          break;
        }
        default:
          dispatchAction(action);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settings.shortcuts, focus, setFocus, toggleFocus, helpOpen, setHelpOpen, transport]);

  return null;
}
