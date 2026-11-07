import { href } from '../router';
import type { GameInfo } from '../routes';

export function GameCard({ game, featured = false }: { game: GameInfo; featured?: boolean }) {
  return (
    <a className="game-card" href={href(game.path)} data-featured={featured}>
      {featured && <span className="game-card__badge">Start here</span>}
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
