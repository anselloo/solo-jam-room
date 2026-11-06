import type { ReactNode } from 'react';

/**
 * Large-type wrapper for the current prompt, chords and bar counter. In Focus Mode the
 * surrounding chrome is hidden (see layout.css) and this content scales up to be readable
 * from a music stand a metre or two away.
 */
export function FocusView({ children }: { children: ReactNode }) {
  return <div className="focus-view">{children}</div>;
}
