import { GLOSSARY } from '../content/howto';

/** Explains the music words used in the games. Collapsed by default. */
export function Glossary({ open = false }: { open?: boolean }) {
  return (
    <details className="howto glossary" open={open}>
      <summary className="howto__summary">What do these words mean?</summary>
      <dl className="howto__body glossary__list">
        {GLOSSARY.map((g) => (
          <div key={g.term}>
            <dt>{g.term}</dt>
            <dd>{g.meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
