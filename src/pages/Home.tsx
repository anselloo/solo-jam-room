import { useRef, type CSSProperties } from 'react';
import { unlockAudio } from '../audio/engine';
import { GameCard } from '../components/GameCard';
import { href } from '../router';
import { dailyChallenge } from '../games/daily/daily';
import { useToday } from '../games/daily/DailyPage';
import { useApp } from '../state/AppState';
import { currentStreak, isDailyDone } from '../state/stats';
import { DAILY, GAMES } from '../routes';

const STEPS = [
  {
    title: 'Pick a game',
    body: 'Each one is a different way to practise. Not sure? Start with Jam Roulette.',
  },
  {
    title: 'Press start',
    body: 'The band counts you in, then plays. You can change the speed any time.',
  },
  {
    title: 'Play along',
    body: 'Use any instrument, or your voice. Stick to the notes shown and you cannot go wrong.',
  },
];

/** Decorative preview of a jam being dealt. Pure CSS motion; hidden from assistive technology. */
function HeroStage() {
  const reels: { label: string; words: string[] }[] = [
    { label: 'Key', words: ['G', 'E♭', 'A', 'D', 'G'] },
    { label: 'Mode', words: ['Dorian', 'Minor', 'Major', 'Lydian', 'Dorian'] },
    { label: 'Style', words: ['Funk', 'Reggae', 'Rock', 'Waltz', 'Funk'] },
  ];
  return (
    <div className="stage" aria-hidden="true">
      <span className="stage__note stage__note--1">♪</span>
      <span className="stage__note stage__note--2">♫</span>
      <span className="stage__note stage__note--3">♩</span>
      <div className="stage__card">
        <div className="stage__title">Your jam</div>
        <div className="stage__reels">
          {reels.map((r, i) => (
            <div
              className="stage__reel"
              key={r.label}
              style={{ '--d': `${i * 0.25}s` } as CSSProperties}
            >
              <span className="stage__label">{r.label}</span>
              <span className="stage__window">
                <span className="stage__strip">
                  {r.words.map((w, j) => (
                    <span key={j}>{w}</span>
                  ))}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="stage__eq">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
        <div className="stage__beats">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const { stats } = useApp();
  const today = useToday();
  const challenge = dailyChallenge(today);
  const streak = currentStreak(stats.daily.done, today);
  const done = isDailyDone(stats, today);
  const how = useRef<HTMLElement>(null);

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__bg" aria-hidden="true">
          <span className="hero__blob hero__blob--purple" />
          <span className="hero__blob hero__blob--yellow" />
        </div>
        <div className="hero__copy">
          <p className="hero__eyebrow">A practice room for one</p>
          <h1 id="hero-title">
            Solo <span className="hero__mark">Jam</span> Room
          </h1>
          <p className="hero__lead">
            A backing band in your browser. It plays the drums, bass and chords. You play your
            instrument, any instrument, at any level.
          </p>
          <div className="hero__actions">
            <a
              className="btn btn--primary"
              href={href('/roulette') + '?autostart=1'}
              onClick={() => {
                // Unlock audio inside the click so the band can start on arrival (required by iOS).
                void unlockAudio().catch(() => undefined);
              }}
            >
              Start jamming
            </a>
            <button
              type="button"
              className="btn"
              onClick={() => how.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              How it works
            </button>
          </div>
          <p className="hero__fine">
            No sign-up, no wrong notes. Starts with Jam Roulette: a random key, speed and style to
            play along to.
          </p>
        </div>
        <HeroStage />
      </section>

      <section className="how reveal" id="how" ref={how} aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <ol className="how__steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="how__step" style={{ '--i': i } as CSSProperties}>
              <span className="how__num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card daily-card reveal" aria-labelledby="daily-title">
        <div>
          <h2 id="daily-title">
            <span aria-hidden="true">{DAILY.icon} </span>
            {DAILY.title}
          </h2>
          <p className="muted">
            {done ? 'Done for today. See you tomorrow!' : `Today: ${challenge.summary}`}
          </p>
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

      <h2 className="home__heading">Pick a game</h2>
      <p className="muted home__sub">Each one takes a few minutes. Press any card to open it.</p>
      <ul className="grid">
        {GAMES.map((g, i) => (
          <li key={g.path} className="reveal" style={{ '--i': i % 4 } as CSSProperties}>
            <GameCard game={g} featured={g.path === '/roulette'} />
          </li>
        ))}
      </ul>
    </div>
  );
}
