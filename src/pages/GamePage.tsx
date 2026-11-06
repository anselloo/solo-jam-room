import type { ComponentType } from 'react';
import { ConstraintCardsPage } from '../games/constraints/ConstraintCardsPage';
import { ProgressionsPage } from '../games/progressions/ProgressionsPage';
import { RoulettePage } from '../games/roulette/RoulettePage';
import { TradeFoursPage } from '../games/trade-fours/TradeFoursPage';
import type { GameInfo } from '../routes';
import { Placeholder } from './Placeholder';

/** Games that have been built. Anything else shows a placeholder. */
const IMPLEMENTED: Record<string, ComponentType> = {
  '/roulette': RoulettePage,
  '/trade-fours': TradeFoursPage,
  '/progressions': ProgressionsPage,
  '/constraints': ConstraintCardsPage,
};

export function GamePage({ game }: { game: GameInfo }) {
  const Impl = IMPLEMENTED[game.path];
  if (Impl) return <Impl />;
  return (
    <Placeholder title={game.title} icon={game.icon}>
      <p>{game.blurb}</p>
      <p className="muted">This game is on its way. Check back soon.</p>
    </Placeholder>
  );
}
