import { Card } from '../../components/Card';
import { HowTo } from '../../components/HowTo';
import { FocusView } from '../../components/FocusView';
import { useAction } from '../../state/shortcuts';
import { CATEGORIES, CATEGORY_LABELS, type ConstraintCategory } from './deck';
import { useConstraints } from './useConstraints';

export function ConstraintCardsPage() {
  const c = useConstraints();
  useAction('primary', c.draw);
  useAction('reroll', c.draw);
  useAction('back', c.back);

  const toggle = (cat: ConstraintCategory) => {
    const on = c.prefs.categories.includes(cat);
    c.setPrefs({
      categories: on ? c.prefs.categories.filter((x) => x !== cat) : [...c.prefs.categories, cat],
    });
  };

  return (
    <section className="stack">
      <FocusView>
        <h1>Constraint cards</h1>
        <HowTo game="constraints" />
        <Card flipped={!!c.current} back={<span className="flip__logo">Draw</span>}>
          {c.current && (
            <div className="constraint">
              <span className="chip">{CATEGORY_LABELS[c.current.category]}</span>
              <p className="constraint__text">{c.current.text}</p>
            </div>
          )}
        </Card>
        <p className="notice" role="status">
          {c.notice ?? ''}
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn--primary" onClick={c.draw}>
            {c.current ? 'Draw again' : 'Draw a card'}
          </button>
        </div>
        {c.current && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn" onClick={c.keep}>
              Keep
            </button>
            <button type="button" className="btn" onClick={c.discard}>
              Discard
            </button>
            <button type="button" className="btn btn--ghost" onClick={c.back}>
              Back
            </button>
          </div>
        )}
      </FocusView>

      {c.kept.length > 0 && (
        <div className="card" aria-label="Kept cards">
          <h2>Pinned</h2>
          <ul className="pinned">
            {c.kept.map((k) => (
              <li key={k.id}>
                <span>{k.text}</span>
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
        </div>
      )}

      <div className="card stack">
        <h2>Deck settings</h2>
        <div className="row" role="group" aria-label="Categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className="btn"
              aria-pressed={c.prefs.categories.includes(cat)}
              onClick={() => toggle(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        <label className="row" style={{ minHeight: 'var(--tap)' }}>
          <input
            type="checkbox"
            checked={c.prefs.beginnerSafe}
            onChange={(e) => c.setPrefs({ beginnerSafe: e.target.checked })}
          />
          Beginner-safe (hide the hard cards)
        </label>
        <div className="field">
          <label htmlFor="auto-bars">Auto-draw while the band plays</label>
          <select
            id="auto-bars"
            className="input"
            value={c.prefs.autoBars}
            onChange={(e) => c.setPrefs({ autoBars: Number(e.target.value) })}
          >
            <option value={0}>Off</option>
            {[4, 8, 12, 16].map((n) => (
              <option key={n} value={n}>
                Every {n} bars
              </option>
            ))}
          </select>
        </div>
        <p className="muted">{c.poolSize} cards in the deck with these settings.</p>
      </div>
    </section>
  );
}
