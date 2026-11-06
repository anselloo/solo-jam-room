import { href } from '../router';
import type { GameInfo } from '../routes';

export function GameCard({ game }: { game: GameInfo }) {
  return (
    <a className="game-card" href={href(game.path)}>
      <span className="game-card__icon" aria-hidden="true">
        {game.icon}
      </span>
      <span className="game-card__title">{game.title}</span>
      <span className="game-card__desc">{game.blurb}</span>
      <span className="game-card__meta">
        <span className="chip">{game.minutes}</span>
        <span className="chip">{game.difficulty}</span>
      </span>
    </a>
  );
}
