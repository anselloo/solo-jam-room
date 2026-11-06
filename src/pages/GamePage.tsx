import type { GameInfo } from '../routes';
import { Placeholder } from './Placeholder';

/** Stand-in shown until each game is built. */
export function GamePage({ game }: { game: GameInfo }) {
  return (
    <Placeholder title={game.title} icon={game.icon}>
      <p>{game.blurb}</p>
      <p className="muted">This game is on its way. Check back soon.</p>
    </Placeholder>
  );
}
