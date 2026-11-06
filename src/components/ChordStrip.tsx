import type { ReactNode } from 'react';

export interface ChordCardData {
  name: string;
  roman: string;
  spoken: string;
  /** Extra line, e.g. "sounds as B♭". */
  note?: string;
}

interface Props {
  chords: readonly ChordCardData[];
  /** Index of the chord that is sounding now, or null when stopped. */
  currentIndex: number | null;
  show: 'names' | 'roman' | 'both';
  /** Renders a control under each card (e.g. Re-deal). */
  action?: (index: number) => ReactNode;
}

/** A row of chord cards, one per bar, with the sounding chord highlighted. */
export function ChordStrip({ chords, currentIndex, show, action }: Props) {
  return (
    <ol className="chord-strip" aria-label="Chord progression">
      {chords.map((c, i) => (
        <li
          key={i}
          className="chord-card"
          data-current={currentIndex === i}
          aria-current={currentIndex === i ? 'step' : undefined}
          aria-label={`Bar ${i + 1}: ${c.spoken}`}
        >
          {show !== 'roman' && <span className="chord-card__name">{c.name}</span>}
          {show !== 'names' && <span className="chord-card__roman">{c.roman}</span>}
          {c.note && <span className="muted">{c.note}</span>}
          {action?.(i)}
        </li>
      ))}
    </ol>
  );
}
