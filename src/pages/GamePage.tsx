import type { ComponentType } from 'react';
import { ConstraintCardsPage } from '../games/constraints/ConstraintCardsPage';
import { DailyPage } from '../games/daily/DailyPage';
import { GenreFlipPage } from '../games/genre-flip/GenreFlipPage';
import { HoldThePulsePage } from '../games/hold-the-pulse/HoldThePulsePage';
import { MissingMemberPage } from '../games/missing-member/MissingMemberPage';
import { ProgressionsPage } from '../games/progressions/ProgressionsPage';
import { SongSprintPage } from '../games/song-sprint/SongSprintPage';
import { RoulettePage } from '../games/roulette/RoulettePage';
import { TradeFoursPage } from '../games/trade-fours/TradeFoursPage';
import type { GameInfo } from '../routes';
import { Glossary } from '../components/Glossary';
import { Placeholder } from './Placeholder';

/** Games that have been built. Anything else shows a placeholder. */
const IMPLEMENTED: Record<string, ComponentType> = {
  '/roulette': RoulettePage,
  '/trade-fours': TradeFoursPage,
  '/progressions': ProgressionsPage,
  '/missing-member': MissingMemberPage,
  '/hold-the-pulse': HoldThePulsePage,
  '/genre-flip': GenreFlipPage,
  '/song-sprint': SongSprintPage,
  '/daily': DailyPage,
  '/constraints': ConstraintCardsPage,
};

export function GamePage({ game }: { game: GameInfo }) {
  const Impl = IMPLEMENTED[game.path];
  if (Impl)
    return (
      <>
        <Impl />
        <div className="glossary-wrap">
          <Glossary />
        </div>
      </>
    );
  return (
    <Placeholder title={game.title} icon={game.icon}>
      <p>{game.blurb}</p>
      <p className="muted">This game is on its way. Check back soon.</p>
    </Placeholder>
  );
}
