import { useEffect, useState } from 'react';

interface Props {
  label: string;
  /** The settled value. */
  value: string;
  /** Values flickered through while spinning. */
  options: readonly string[];
  spinning: boolean;
  locked: boolean;
  onToggleLock: () => void;
}

/** One reel: shows a flickering value while spinning, with a lock toggle. */
export function Spinner({ label, value, options, spinning, locked, onToggleLock }: Props) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!spinning || options.length === 0) return;
    const id = window.setInterval(() => {
      setShown(options[Math.floor(Math.random() * options.length)]);
    }, 70);
    return () => window.clearInterval(id);
  }, [spinning, options]);

  const text = spinning ? shown : value;
  return (
    <div className="reel" data-locked={locked}>
      <span className="reel__label">{label}</span>
      <div className="reel__window" data-spinning={spinning} aria-hidden={spinning}>
        {text || '–'}
      </div>
      <button
        type="button"
        className="btn"
        aria-pressed={locked}
        aria-label={`Lock ${label}`}
        onClick={onToggleLock}
      >
        {locked ? '🔒 Locked' : '🔓 Lock'}
      </button>
    </div>
  );
}
