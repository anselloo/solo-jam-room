import { unlockAudio } from '../audio/engine';
import { GameCard } from '../components/GameCard';
import { href } from '../router';
import { dailyChallenge } from '../games/daily/daily';
import { useToday } from '../games/daily/DailyPage';
import { useApp } from '../state/AppState';
import { currentStreak, isDailyDone } from '../state/stats';
import { DAILY, GAMES } from '../routes';

export function Home() {
  const { stats } = useApp();
  const today = useToday();
  const challenge = dailyChallenge(today);
  const streak = currentStreak(stats.daily.done, today);
  const done = isDailyDone(stats, today);
  return (
    <div>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Solo Jam Room</h1>
        <p>Your band is always here. Pick up your instrument, and we&apos;ll deal the rest.</p>
        <a
          className="btn btn--primary"
          href={href('/roulette') + '?autostart=1'}
          onClick={() => {
            // Unlock audio inside the click so the band can start on arrival (required by iOS).
            void unlockAudio().catch(() => undefined);
          }}
        >
          Start Jamming
        </a>
      </section>

      <section className="card daily-card" aria-labelledby="daily-title">
        <div>
          <h2 id="daily-title">
            <span aria-hidden="true">{DAILY.icon} </span>
            {DAILY.title}
          </h2>
          <p className="muted">{done ? 'Done for today. See you tomorrow!' : challenge.summary}</p>
        </div>
        <div>
          <div className="streak" aria-label={`Current streak: ${streak} days`}>
            {streak} <span className="muted">day streak</span>
          </div>
          <a className="btn" href={href(DAILY.path)}>
            {done ? 'View today' : "See today's challenge"}
          </a>
        </div>
      </section>

      <h2 style={{ marginTop: 'var(--space-6)' }}>Pick a game</h2>
      <ul className="grid">
        {GAMES.map((g) => (
          <li key={g.path}>
            <GameCard game={g} />
          </li>
        ))}
      </ul>
    </div>
  );
}
