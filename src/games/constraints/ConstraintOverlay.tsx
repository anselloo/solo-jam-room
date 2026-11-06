import { useConstraints } from './useConstraints';
import { CATEGORY_LABELS } from './deck';

/**
 * Constraint Cards on top of another game (Jam Roulette, Trade Fours, Chord Dealer).
 * Kept cards stay pinned while the player jams.
 */
export function ConstraintOverlay({ label = 'Constraint card' }: { label?: string }) {
  const c = useConstraints();
  return (
    <aside className="card overlay-card" aria-label={label}>
      <div className="row">
        <h3 style={{ margin: 0 }}>{label}</h3>
        <button type="button" className="btn" onClick={c.draw}>
          {c.current ? 'Draw another' : 'Draw a card'}
        </button>
        {c.current && (
          <>
            <button type="button" className="btn" onClick={c.keep}>
              Keep
            </button>
            <button type="button" className="btn btn--ghost" onClick={c.discard}>
              Discard
            </button>
          </>
        )}
      </div>
      <p className="notice" role="status">
        {c.notice ?? ''}
      </p>
      {c.current && (
        <p className="constraint__text constraint__text--small">
          <span className="chip">{CATEGORY_LABELS[c.current.category]}</span> {c.current.text}
        </p>
      )}
      {c.kept.length > 0 && (
        <ul className="pinned">
          {c.kept.map((k) => (
            <li key={k.id}>
              <span>📌 {k.text}</span>
              <button
                type="button"
                className="btn btn--ghost"
                aria-label={`Unpin: ${k.text}`}
                onClick={() => c.unkeep(k.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
