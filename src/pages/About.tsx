import { GAMES } from '../routes';
import { href } from '../router';

const TIPS: { title: string; body: string }[] = [
  {
    title: 'Start small, start now',
    body: 'Press Start Jamming and play anything over the first loop. The goal of the first minute is only to make a sound. Perfect comes later.',
  },
  {
    title: 'Let the constraint do the thinking',
    body: 'When you run out of ideas, draw a Constraint Card. A limit (three notes, only off-beats, whisper-quiet) makes you invent instead of reaching for habits.',
  },
  {
    title: 'Repeat before you vary',
    body: 'Play a short idea twice, then change one thing about it. Repetition makes a phrase sound intentional, and one small change makes it sound musical.',
  },
  {
    title: 'Leave space',
    body: 'Silence is a note. In Trade Fours, listen to how the app leaves gaps, and try to answer with as few notes as you can.',
  },
  {
    title: 'Ears first',
    body: 'Turn on Echo mode in Trade Fours. Hearing a phrase and playing it back is the fastest way to connect what you hear with what your hands do.',
  },
  {
    title: 'Keep honest time',
    body: 'Ten minutes of Hold the Pulse a week will do more for your playing than most exercises. If the click leaves and you stay locked in, so does the band.',
  },
  {
    title: 'Cover the whole band',
    body: 'In Missing Member, playing the part the band is missing teaches you how the drums, bass and chords hold a song together, whatever you normally play.',
  },
  {
    title: 'Rotate the games',
    body: 'Try a different game each day, and let the Daily Jam choose for you. Short, varied sessions beat one long grind.',
  },
  {
    title: 'Finish things',
    body: 'Song Sprint ends when the timer ends. A finished, imperfect song teaches you more than a perfect first verse.',
  },
];

export function About() {
  return (
    <section className="stack about">
      <h1>About</h1>

      <div className="card stack">
        <h2>What this is</h2>
        <p>
          Solo Jam Room is a set of quick jam games for one musician. It takes the energy of a jam
          night (random keys, chord changes thrown at you, trading solos, creative challenges) and
          puts it in your practice room. The site plays the rest of the band, and you bring your
          instrument.
        </p>
        <p>
          Everything runs in your browser. There are no accounts and nothing is uploaded: your
          profile, settings and notes stay on this device. After your first visit it works with no
          signal, and you can install it like an app.
        </p>
      </div>

      <div className="card stack">
        <h2>The games</h2>
        <ul className="plain-list">
          {GAMES.map((g) => (
            <li key={g.path}>
              <span>
                <a href={href(g.path)}>{g.title}</a> <span className="muted">· {g.blurb}</span>
              </span>
            </li>
          ))}
          <li>
            <span>
              <a href={href('/daily')}>Daily Jam</a>{' '}
              <span className="muted">· One fresh challenge a day, the same for everyone.</span>
            </span>
          </li>
        </ul>
      </div>

      <div className="card stack">
        <h2>How to get the most out of solo jamming</h2>
        <ol className="tips">
          {TIPS.map((t) => (
            <li key={t.title}>
              <strong>{t.title}.</strong> {t.body}
            </li>
          ))}
        </ol>
      </div>

      <div className="card stack">
        <h2>Setting up</h2>
        <ul className="tips">
          <li>
            <strong>On a music stand.</strong> Press <kbd>F</kbd> for Focus Mode to hide the
            controls and enlarge the prompt, chords and bar counter so you can read them from a
            metre or two away.
          </li>
          <li>
            <strong>Hands on your instrument.</strong> Every game works from the keyboard. Press{' '}
            <kbd>?</kbd> to see the shortcuts. In Settings you can move any of them to a foot pedal
            or page turner that sends key presses.
          </li>
          <li>
            <strong>Transposing instruments.</strong> Choose B♭, E♭ or F in your{' '}
            <a href={href('/profile')}>profile</a> and chords are shown in written pitch for your
            instrument.
          </li>
          <li>
            <strong>Guitar and ukulele.</strong> The Chord Dealer can show shapes relative to a
            capo, and suggest the capo position that makes the changes easiest.
          </li>
          <li>
            <strong>Headphones or speakers.</strong> Either works. If the band feels too loud or too
            thin, open the Mixer in the bar at the bottom.
          </li>
          <li>
            <strong>No sound?</strong> Browsers only play audio after you press something, so press
            Play or any start button first. On a phone, check the silent switch.
          </li>
        </ul>
      </div>

      <div className="card stack">
        <h2>Good to know</h2>
        <ul className="tips">
          <li>
            Every color, sound and animation cue has a visual or audible partner, so the games work
            if you can&apos;t hear the click or can&apos;t see the screen well.
          </li>
          <li>
            If you prefer less motion, the site follows your device&apos;s reduced-motion setting.
          </li>
          <li>
            The melodies in Genre Flip are old folk songs and classical themes that are free to use.
            You play them from memory, and only the titles are shown.
          </li>
          <li>No wrong notes, just new ideas.</li>
        </ul>
      </div>
    </section>
  );
}
