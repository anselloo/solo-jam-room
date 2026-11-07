import type { TapPoint } from './pulse';

interface Props {
  points: readonly TapPoint[];
  /** Number of beats in the silent section (the chart's horizontal extent). */
  beats: number;
}

const W = 320;
const H = 140;
const PAD = 14;
const MAX_MS = 300;

/** Tap timing against the true grid: the centre line is perfectly on the beat. */
export function PulseChart({ points, beats }: Props) {
  const x = (beat: number) => PAD + (beat / Math.max(1, beats - 1)) * (W - PAD * 2);
  const y = (ms: number) =>
    H / 2 - (Math.max(-MAX_MS, Math.min(MAX_MS, ms)) / MAX_MS) * (H / 2 - PAD);
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.beat).toFixed(1)},${y(p.offsetMs).toFixed(1)}`)
    .join(' ');
  const late = points.filter((p) => p.offsetMs > 0).length;
  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Tap timing against the beat. ${points.length} taps, ${late} late and ${points.length - late} early or on time.`}
        style={{ width: '100%', maxWidth: 520, height: 'auto' }}
      >
        <rect x="0" y="0" width={W} height={H} rx="8" fill="var(--bg-sunken)" />
        <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="var(--accent-text)" strokeWidth="2" />
        <text x={PAD} y={PAD - 2} fontSize="9" fill="var(--text-muted)">
          late
        </text>
        <text x={PAD} y={H - 4} fontSize="9" fill="var(--text-muted)">
          early
        </text>
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.7" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.beat)} cy={y(p.offsetMs)} r="3.5" fill="var(--accent)" />
        ))}
      </svg>
      <figcaption className="muted">
        Each dot is a tap. On the line is perfectly on the beat; drifting up or down means you sped
        up or slowed down.
      </figcaption>
    </figure>
  );
}
