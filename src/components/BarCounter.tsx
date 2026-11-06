interface Props {
  /** Bars to show (e.g. the length of a loop or phrase). */
  bars: number;
  beatsPerBar: number;
  /** Current bar within the loop and beat within the bar; null when stopped. */
  position: { bar: number; beat: number } | null;
}

/** Bar and beat progress, driven by scheduler events via the transport's position. */
export function BarCounter({ bars, beatsPerBar, position }: Props) {
  const label = position
    ? `Bar ${position.bar + 1} of ${bars}, beat ${position.beat + 1}`
    : 'Stopped';
  return (
    <div className="bar-counter" role="img" aria-label={label}>
      {Array.from({ length: bars }, (_, b) => (
        <div key={b} className="bar-counter__bar" data-current={position?.bar === b}>
          {Array.from({ length: beatsPerBar }, (_, i) => (
            <span
              key={i}
              className="bar-counter__beat"
              data-on={position?.bar === b && position.beat === i}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
