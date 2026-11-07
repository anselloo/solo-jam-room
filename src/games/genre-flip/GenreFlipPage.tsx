import { useCallback, useEffect, useRef, useState } from 'react';
import { HowTo } from '../../components/HowTo';
import { genreById, GENRES } from '../../audio/band/grooves';
import { getContext } from '../../audio/engine';
import { msUntil } from '../../audio/scheduler';
import { playChime } from '../../audio/sounds';
import { useTransport } from '../../audio/transport';
import { announce } from '../../components/announce';
import { FocusView } from '../../components/FocusView';
import { Timer, useCountdown } from '../../components/Timer';
import { Deck, History } from '../../random/deck';
import { createRng } from '../../random/rng';
import { useAction } from '../../state/shortcuts';
import { useApp } from '../../state/AppState';
import { ConstraintToggle } from '../constraints/ConstraintToggle';
import { signatureOf } from '../roulette/roulette';
import { FLIP_MINUTES, TUNES, backingForFlip, flipFor, tuneKeyName, type Flip } from './flip';

export function GenreFlipPage() {
  const { profile } = useApp();
  const transport = useTransport();
  const [rng] = useState(() => createRng(Date.now()));
  const [tunes] = useState(() => new Deck(TUNES, rng));
  const [genres] = useState(() => new Deck(GENRES, rng));
  const [history] = useState(() => new History<Flip>(10));
  const [flip, setFlip] = useState<Flip | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const waitingForDownbeat = useRef(false);
  const timers = useRef<number[]>([]);

  const countdown = useCountdown(FLIP_MINUTES * 60, {
    warnAt: [60, 30],
    onWarn: (s) => {
      playChime(getContext().currentTime + 0.02, 'warn');
      announce(`${s} seconds left`);
    },
    onDone: () => {
      playChime(getContext().currentTime + 0.02, 'end');
      setTimeUp(true);
      announce('Time is up. Draw the next tune when you are ready.');
    },
  });
  const { start: startTimer, reset: resetTimer } = countdown;

  const later = useCallback((fn: () => void, audioTime: number) => {
    timers.current.push(window.setTimeout(fn, msUntil(audioTime, getContext())));
  }, []);

  /** Hand a flip to the band: groove, tempo, meter and a loop in the tune's key. */
  const apply = useCallback(
    (f: Flip) => {
      transport.setSignature(signatureOf(f.signature));
      transport.setBpm(f.bpm);
      transport.setGrooveId(f.genre.groove);
      transport.setProgression(backingForFlip(f, profile.level !== 'beginner'), 1);
    },
    [transport, profile.level],
  );

  const show = useCallback(
    (f: Flip) => {
      setFlip(f);
      setTimeUp(false);
      apply(f);
      announce(`${f.tune.title}, in the style of ${f.genre.name}`);
    },
    [apply],
  );

  /** Make sure the band is playing and the timer is running for the current flip. */
  const begin = useCallback(async () => {
    resetTimer(FLIP_MINUTES * 60);
    if (transport.running) {
      startTimer();
    } else {
      // Fresh start: the three minutes begin on the first bar after the count-in.
      waitingForDownbeat.current = true;
      await transport.start({ countIn: 1 });
    }
  }, [transport, resetTimer, startTimer]);

  useEffect(() => {
    if (!transport.running) return;
    return transport.onBeat((e) => {
      if (waitingForDownbeat.current && e.bar >= 0 && e.beat === 0) {
        waitingForDownbeat.current = false;
        later(startTimer, e.time);
      }
    });
  }, [transport, transport.running, later, startTimer]);

  const drawBoth = useCallback(() => {
    const t = tunes.draw();
    const g = genres.draw();
    const f = flipFor(t.item, g.item, rng);
    history.push(f);
    setNotice(t.reshuffled || g.reshuffled ? 'Reshuffled!' : null);
    show(f);
    void begin();
  }, [tunes, genres, rng, history, show, begin]);

  const rerollTune = useCallback(() => {
    if (!flip) return;
    const t = tunes.draw();
    const f = flipFor(t.item, flip.genre, rng);
    const same = { ...f, bpm: flip.bpm, signature: flip.signature };
    history.push(same);
    setNotice(t.reshuffled ? 'Reshuffled!' : null);
    show(same);
    void begin();
  }, [flip, tunes, rng, history, show, begin]);

  const rerollGenre = useCallback(() => {
    if (!flip) return;
    const g = genres.draw();
    const f = flipFor(flip.tune, g.item, rng);
    history.push(f);
    setNotice(g.reshuffled ? 'Reshuffled!' : null);
    show(f);
    void begin();
  }, [flip, genres, rng, history, show, begin]);

  const back = useCallback(() => {
    const prev = history.back();
    if (prev) show(prev);
  }, [history, show]);

  const stop = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    waitingForDownbeat.current = false;
    countdown.pause();
    transport.stop();
  }, [transport, countdown]);

  useAction('primary', drawBoth);
  useAction('reroll', drawBoth);
  useAction('back', back);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      transport.stop();
    },
    // Stop the band when leaving the game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const feel = flip ? genreById(flip.genre.id)?.feel : null;

  return (
    <section className="stack">
      <FocusView>
        <h1>Genre flip</h1>
        <HowTo game="genre-flip" />
        {flip ? (
          <div className="turn" data-who="app" data-flash={timeUp}>
            <p className="muted">Play this tune</p>
            <p className="prompt">{flip.tune.title}</p>
            <p className="muted">
              {flip.tune.origin} · try it in {tuneKeyName(flip.tune)}
            </p>
            <p className="muted">as</p>
            <p className="prompt">{flip.genre.name}</p>
            <p className="muted">
              {feel} · {flip.bpm} BPM · {flip.signature}
            </p>
          </div>
        ) : (
          <p className="muted" style={{ textAlign: 'center' }}>
            Draw a familiar old tune and a style, and play the tune from memory in that style for
            three minutes.
          </p>
        )}

        {flip && (
          <>
            <Timer remaining={countdown.remaining} warnAt={60} label="Time left in this round" />
            {timeUp && (
              <p className="notice" role="status">
                Time! Draw the next one when you&apos;re ready.
              </p>
            )}
          </>
        )}
        <p className="notice" role="status">
          {notice ?? ''}
        </p>

        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn--primary" onClick={drawBoth}>
            {flip ? (timeUp ? 'Next' : 'Skip to next') : 'Draw'}
          </button>
          {flip && (
            <>
              <button type="button" className="btn" onClick={rerollTune}>
                New tune
              </button>
              <button type="button" className="btn" onClick={rerollGenre}>
                New style
              </button>
              <button type="button" className="btn btn--ghost" onClick={back}>
                Back
              </button>
              <button type="button" className="btn btn--ghost" onClick={stop}>
                Stop
              </button>
            </>
          )}
        </div>
      </FocusView>

      <p className="muted">
        Tunes are old folk songs and classical themes that are free to use. You play from memory:
        nothing but the title is shown.
      </p>
      <ConstraintToggle />
    </section>
  );
}
