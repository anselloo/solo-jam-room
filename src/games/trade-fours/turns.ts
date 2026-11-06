export type Who = 'you' | 'app';

export interface Turn {
  index: number;
  who: Who;
  /** Absolute bar (counted from the end of the count-in) on which the turn begins. */
  startBar: number;
  bars: number;
  /** 1-based round (a round is one turn each). */
  round: number;
}

export type TurnEvent = { type: 'start'; turn: Turn } | { type: 'end'; bar: number };

export interface TurnOptions {
  phraseBars: number;
  rounds: number;
  /** Echo variant: the app plays first and the player plays it back. */
  echo: boolean;
}

/**
 * Pure turn bookkeeping for Trade Fours. It only ever changes on a bar's downbeat, and it is
 * fed bar numbers from the audio scheduler, so turn changes land exactly on the beat.
 */
export class TurnTracker {
  turn: Turn | null = null;
  finished = false;
  private restartPending = false;

  constructor(readonly options: TurnOptions) {}

  get totalTurns(): number {
    return this.options.rounds * 2;
  }

  whoFor(index: number): Who {
    const first: Who = this.options.echo ? 'app' : 'you';
    const second: Who = first === 'app' ? 'you' : 'app';
    return index % 2 === 0 ? first : second;
  }

  private makeTurn(index: number, startBar: number): Turn {
    return {
      index,
      who: this.whoFor(index),
      startBar,
      bars: this.options.phraseBars,
      round: Math.floor(index / 2) + 1,
    };
  }

  /** Call on every bar's downbeat. Returns what changed, if anything. */
  onDownbeat(bar: number): TurnEvent | null {
    if (this.finished) return null;
    if (!this.turn) {
      this.turn = this.makeTurn(0, bar);
      return { type: 'start', turn: this.turn };
    }
    if (this.restartPending) {
      this.restartPending = false;
      this.turn = { ...this.makeTurn(this.turn.index, bar) };
      return { type: 'start', turn: this.turn };
    }
    if (bar < this.turn.startBar + this.turn.bars) return null;
    const next = this.turn.index + 1;
    if (next >= this.totalTurns) {
      this.finished = true;
      return { type: 'end', bar };
    }
    this.turn = this.makeTurn(next, this.turn.startBar + this.turn.bars);
    return { type: 'start', turn: this.turn };
  }

  /** True on the final bar of the current turn: the cue to get ready for the switch. */
  isLastBar(bar: number): boolean {
    return !!this.turn && bar === this.turn.startBar + this.turn.bars - 1;
  }

  /** End the current turn after the bar that is playing now. */
  skip(currentBar: number): void {
    if (!this.turn) return;
    this.turn = { ...this.turn, bars: Math.max(1, currentBar - this.turn.startBar + 1) };
  }

  /** Add one more phrase length to the current turn. */
  extend(): void {
    if (!this.turn) return;
    this.turn = { ...this.turn, bars: this.turn.bars + this.options.phraseBars };
  }

  /** After a pause the transport restarts its bar count; replay the current turn from the top. */
  resume(): void {
    this.restartPending = true;
  }
}
