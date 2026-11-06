import { useState } from 'react';
import { ConstraintOverlay } from './ConstraintOverlay';

/** "Add constraint cards" button that reveals the overlay on top of any game. */
export function ConstraintToggle() {
  const [open, setOpen] = useState(false);
  return (
    <div className="stack">
      <button
        type="button"
        className="btn"
        aria-pressed={open}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        🎴 Constraint cards
      </button>
      {open && <ConstraintOverlay />}
    </div>
  );
}
