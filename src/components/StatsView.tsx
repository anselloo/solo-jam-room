import { DAILY, GAMES } from '../routes';
import { useApp } from '../state/AppState';
import { PULSE_LABELS, currentStreak, localDateKey } from '../state/stats';

const titleFor = (path: string): string =>
  [...GAMES, DAILY].find((g) => g.path === path)?.title ?? path;

/** Sessions, minutes, per-game counts, Hold the Pulse bests and the Daily Jam streak. */
export function StatsView() {
  const { stats } = useApp();
  const streak = currentStreak(stats.daily.done, localDateKey());
  const games = Object.entries(stats.perGame).sort((a, b) => b[1] - a[1]);
  const pulses = Object.entries(stats.pulseBests).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <div className="card stack" aria-label="Your stats">
      <h2>Your stats</h2>
      <dl className="stat-grid">
        <div>
          <dt>Sessions</dt>
          <dd>{stats.sessions}</dd>
        </div>
        <div>
          <dt>Minutes jammed</dt>
          <dd>{Math.round(stats.minutes)}</dd>
        </div>
        <div>
          <dt>Daily streak</dt>
          <dd>{streak}</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd>{stats.daily.best}</dd>
        </div>
      </dl>

      {games.length === 0 ? (
        <p className="muted">Play a game with the band running and your stats will show up here.</p>
      ) : (
        <>
          <h3>Sessions by game</h3>
          <ul className="plain-list">
            {games.map(([path, n]) => (
              <li key={path}>
                <span>{titleFor(path)}</span> <strong>{n}</strong>
              </li>
            ))}
          </ul>
        </>
      )}

      {pulses.length > 0 && (
        <>
          <h3>Hold the Pulse bests</h3>
          <ul className="plain-list">
            {pulses.map(([bpm, best]) => (
              <li key={bpm}>
                <span>{bpm} BPM</span>{' '}
                <strong>
                  {PULSE_LABELS[best.rank]} (±{best.error.toFixed(1)} BPM)
                </strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
