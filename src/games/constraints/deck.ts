import constraintData from '../../data/constraints.json';
import { Deck } from '../../random/deck';
import type { Rng } from '../../random/rng';

export type ConstraintCategory =
  'notes' | 'rhythm' | 'dynamics' | 'register' | 'technique' | 'wild';
export type ConstraintDifficulty = 'easy' | 'medium' | 'hard';

export const CATEGORIES: readonly ConstraintCategory[] = [
  'notes',
  'rhythm',
  'dynamics',
  'register',
  'technique',
  'wild',
];

export const CATEGORY_LABELS: Record<ConstraintCategory, string> = {
  notes: 'Note limits',
  rhythm: 'Rhythm',
  dynamics: 'Dynamics',
  register: 'Register',
  technique: 'Technique',
  wild: 'Wild',
};

export interface ConstraintCard {
  id: string;
  text: string;
  category: ConstraintCategory;
  difficulty: ConstraintDifficulty;
  /** Instrument ids; when present the card only appears for players of one of them. */
  instruments?: string[];
}

export const CARDS = constraintData as ConstraintCard[];

export interface ConstraintFilter {
  /** Enabled categories. */
  categories: ConstraintCategory[];
  /** Hide cards marked hard. */
  beginnerSafe: boolean;
}

export const DEFAULT_FILTER: ConstraintFilter = {
  categories: [...CATEGORIES],
  beginnerSafe: false,
};

/** Cards the player may draw: category on, difficulty allowed, instrument match. */
export function eligibleCards(
  cards: readonly ConstraintCard[],
  filter: ConstraintFilter,
  playerInstruments: readonly string[],
): ConstraintCard[] {
  return cards.filter((c) => {
    if (!filter.categories.includes(c.category)) return false;
    if (filter.beginnerSafe && c.difficulty === 'hard') return false;
    if (c.instruments && !c.instruments.some((i) => playerInstruments.includes(i))) return false;
    return true;
  });
}

/** A shuffled deck of the eligible cards. No repeats until exhausted, then it reshuffles. */
export function createConstraintDeck(
  rng: Rng,
  filter: ConstraintFilter,
  playerInstruments: readonly string[],
  cards: readonly ConstraintCard[] = CARDS,
): Deck<ConstraintCard> {
  return new Deck(eligibleCards(cards, filter, playerInstruments), rng);
}
