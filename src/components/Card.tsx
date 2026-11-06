import type { ReactNode } from 'react';

interface Props {
  flipped: boolean;
  /** Shown when face-down. */
  back?: ReactNode;
  /** Shown when face-up. */
  children: ReactNode;
}

/** Flippable card. The flip is a CSS transition, which reduced-motion users get instantly. */
export function Card({ flipped, back, children }: Props) {
  return (
    <div className="flip" data-flipped={flipped}>
      <div className="flip__inner">
        <div className="flip__face flip__back" aria-hidden={flipped}>
          {back ?? <span className="flip__logo">?</span>}
        </div>
        <div className="flip__face flip__front" aria-hidden={!flipped}>
          {children}
        </div>
      </div>
    </div>
  );
}
