import { useCallback, useEffect, useMemo, useState } from 'react';
import { grooveById, genreById } from '../../audio/band/grooves';
import { useTransport } from '../../audio/transport';
import { announce } from '../../components/announce';
import { href } from '../../router';
import { useApp } from '../../state/AppState';
import {
  addDays,
  completeDaily,
  currentStreak,
  isDailyDone,
  localDateKey,
} from '../../state/stats';
import { signatureOf } from '../roulette/roulette';
import { bandChords, dailyChallenge } from './daily';

/** The local date, kept fresh so the page rolls over at midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => localDateKey());
  useEffect(() => {
    const refresh = () => setToday(localDateKey());
    const id = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
}

export function DailyPage() {
  const { stats, updateStats } = useApp();
  const transport = useTransport();
  const today = useToday();
  const challenge = useMemo(() => dailyChallenge(today), [today]);
  const done = isDailyDone(stats, today);
  const streak = currentStreak(stats.daily.done, today);

  const startBand = useCallback(async () => {
    const band = challenge.band;
    if (!band) return;
    transport.setSignature(signatureOf(band.signature));
    transport.setBpm(band.bpm);
    const groove = genreById(band.genreId)?.groove;
    if (groove && grooveById(groove)) transport.setGrooveId(groove);
    transport.setProgression(bandChords(band), 1);
    if (transport.running) transport.stop();
    else await transport.start({ countIn: 1 });
  }, [challenge, transport]);

  const markDone = () => {
    updateStats((s) => completeDaily(s, today));
    announce('Daily Jam done. Nice work. See you tomorrow.');
  };

  // The last week at a glance.
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <section className="stack">
      <h1>
        <span aria-hidden="true">📅 </span>Daily Jam
      </h1>
      <p className="muted">One challenge a day, the same for everyone who opens the site today.</p>

      <div className="card stack" aria-label="Today's challenge">
        <span className="chip">{challenge.title}</span>
        <p className="prompt prompt--prose" style={{ fontSize: 'clamp(1.4rem, 3.6vw, 2.1rem)' }}>
          {challenge.summary}
        </p>
        <ul className="plain-list">
          {challenge.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
          <li>
            <span>
              <span className="muted">Constraint: </span>
              <strong>{challenge.card.text}</strong>
            </span>
          </li>
        </ul>
        <div className="row">
          {challenge.band && (
            <button type="button" className="btn btn--primary" onClick={() => void startBand()}>
              {transport.running ? '■ Stop the band' : '▶ Start the band'}
            </button>
          )}
          <a className="btn" href={href(challenge.path)}>
            Open {challenge.title}
          </a>
          <button type="button" className="btn" onClick={markDone} disabled={done}>
            {done ? '✓ Done for today' : 'I did it'}
          </button>
        </div>
      </div>

      <div className="card stack" aria-label="Streak">
        <div className="streak">
          {streak} <span className="muted">day streak</span>
        </div>
        <ol className="week" aria-label="Last seven days">
          {week.map((d) => (
            <li
              key={d}
              data-done={stats.daily.done.includes(d)}
              data-today={d === today}
              aria-label={`${d}${stats.daily.done.includes(d) ? ', done' : ', not done'}${d === today ? ', today' : ''}`}
            >
              <span aria-hidden="true">{stats.daily.done.includes(d) ? '✓' : '·'}</span>
            </li>
          ))}
        </ol>
        <p className="muted">Best streak: {stats.daily.best} days.</p>
      </div>
    </section>
  );
}
