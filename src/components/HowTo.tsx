import { useState } from 'react';
import { HOWTO } from '../content/howto';
import { loadJson, saveJson } from '../state/storage';

/**
 * A plain-language "how this works" card at the top of each game. It is open the first time you visit
 * a game and stays closed once you have closed it (it is always one tap away).
 */
export function HowTo({ game }: { game: string }) {
  const content = HOWTO[game];
  const key = `howto:${game}`;
  const [open, setOpen] = useState(() => !loadJson<boolean>(key, false));
  if (!content) return null;

  return (
    <details
      className="howto"
      open={open}
      onToggle={(e) => {
        const isOpen = e.currentTarget.open;
        setOpen(isOpen);
        if (!isOpen) saveJson(key, true);
      }}
    >
      <summary className="howto__summary">How this works</summary>
      <div className="howto__body">
        <p className="howto__goal">{content.goal}</p>
        <ol className="howto__steps">
          {content.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {content.tip && (
          <p className="howto__tip">
            <strong>Tip:</strong> {content.tip}
          </p>
        )}
      </div>
    </details>
  );
}
