import type { Rng } from './rng';

export interface DrawResult<T> {
  item: T;
  /** True when the deck had been exhausted and was reshuffled before this draw. */
  reshuffled: boolean;
}

/** Shuffle-without-replacement deck: no repeats until every item has been drawn. */
export class Deck<T> {
  private pile: T[];
  private items: T[];
  private lastDrawn: T | undefined;

  constructor(
    items: readonly T[],
    private readonly rng: Rng,
  ) {
    this.items = items.slice();
    this.pile = this.rng.shuffle(this.items);
  }

  get remaining(): number {
    return this.pile.length;
  }

  get size(): number {
    return this.items.length;
  }

  draw(): DrawResult<T> {
    if (this.items.length === 0) throw new Error('Cannot draw from an empty deck');
    let reshuffled = false;
    if (this.pile.length === 0) {
      this.pile = this.rng.shuffle(this.items);
      // Avoid showing the same item twice in a row across the reshuffle boundary.
      const top = this.pile.length - 1;
      if (this.items.length > 1 && this.pile[top] === this.lastDrawn) {
        [this.pile[0], this.pile[top]] = [this.pile[top], this.pile[0]];
      }
      reshuffled = true;
    }
    const item = this.pile.pop() as T;
    this.lastDrawn = item;
    return { item, reshuffled };
  }

  /** Replace the contents (e.g. after a filter change) and reshuffle. */
  reset(items: readonly T[]): void {
    this.items = items.slice();
    this.pile = this.rng.shuffle(this.items);
    this.lastDrawn = undefined;
  }
}

/** Bounded result history supporting "previous result" (spec section 5: at least the last 10). */
export class History<T> {
  private entries: T[] = [];

  constructor(private readonly limit = 10) {}

  push(item: T): void {
    this.entries.push(item);
    if (this.entries.length > this.limit) this.entries.shift();
  }

  /** Drop the current entry and return the previous one (undefined if there is none). */
  back(): T | undefined {
    if (this.entries.length <= 1) return undefined;
    this.entries.pop();
    return this.entries[this.entries.length - 1];
  }

  peek(): T | undefined {
    return this.entries[this.entries.length - 1];
  }

  get length(): number {
    return this.entries.length;
  }

  toArray(): T[] {
    return this.entries.slice();
  }
}
