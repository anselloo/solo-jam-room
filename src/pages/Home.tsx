import { GameCard } from '../components/GameCard';
import { href } from '../router';
import { DAILY, GAMES } from '../routes';

export function Home() {
  return (
    <div>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Solo Jam Room</h1>
        <p>Your band is always here. Pick up your instrument, and we&apos;ll deal the rest.</p>
        <a className="btn btn--primary" href={href('/roulette')}>
          Start Jamming
        </a>
      </section>

      <section className="card daily-card" aria-labelledby="daily-title">
        <div>
          <h2 id="daily-title">
            <span aria-hidden="true">{DAILY.icon} </span>
            {DAILY.title}
          </h2>
          <p className="muted">{DAILY.blurb}</p>
        </div>
        <div>
          <div className="streak" aria-label="Current streak: 0 days">
            0 <span className="muted">day streak</span>
          </div>
          <a className="btn" href={href(DAILY.path)}>
            See today&apos;s challenge
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
