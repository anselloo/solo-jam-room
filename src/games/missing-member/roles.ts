import { INSTRUMENTS, instrumentById } from '../../state/profile';
import type { Rng } from '../../random/rng';

export type Role = 'drums' | 'bass' | 'chords' | 'lead';
export const ROLES: readonly Role[] = ['drums', 'bass', 'chords', 'lead'];

export interface RoleInfo {
  label: string;
  /** Big banner text. */
  banner: string;
  /** What the player might do about it. */
  hint: string;
  /** Short phrase for "Next up: ...". */
  short: string;
}

export const ROLE_INFO: Record<Role, RoleInfo> = {
  drums: {
    label: 'Drums',
    banner: 'No drummer tonight: you keep the time.',
    hint: 'Drive the groove. Play the pulse, add accents and fills.',
    short: 'no drummer',
  },
  bass: {
    label: 'Bass',
    banner: "No bassist tonight: you've got the low end.",
    hint: 'Play root notes and simple walking lines under the chords.',
    short: 'no bassist',
  },
  chords: {
    label: 'Chords',
    banner: 'No chord player tonight: you carry the harmony.',
    hint: 'Strum, comp or arpeggiate the changes.',
    short: 'no chord player',
  },
  lead: {
    label: 'Lead melody',
    banner: 'No lead player tonight: the melody is yours.',
    hint: 'Play the tune on top of the groove.',
    short: 'no lead player',
  },
};

/**
 * Weight for each role from the player's instruments: everyone gets a base chance, and each
 * instrument that plays a role adds to it, so a drummer is asked to cover drums more often.
 */
export function roleWeights(instrumentIds: readonly string[]): Record<Role, number> {
  const w: Record<Role, number> = { drums: 1, bass: 1, chords: 1, lead: 1 };
  for (const id of instrumentIds) {
    const info = instrumentById(id);
    if (!info) continue;
    for (const r of info.roles) if (r in w) w[r as Role] += 2;
  }
  return w;
}

/** Weighted pick from `allowed`, avoiding an immediate repeat whenever there is a choice. */
export function pickRole(
  rng: Rng,
  allowed: readonly Role[],
  weights: Record<Role, number>,
  previous?: Role,
): Role {
  if (allowed.length === 0) throw new Error('No roles allowed');
  const pool = allowed.length > 1 && previous ? allowed.filter((r) => r !== previous) : allowed;
  const total = pool.reduce((s, r) => s + weights[r], 0);
  let x = rng.next() * total;
  for (const r of pool) {
    x -= weights[r];
    if (x < 0) return r;
  }
  return pool[pool.length - 1];
}

/** Which round a bar belongs to and where in the round it falls. */
export function roundPosition(bar: number, roundBars: number) {
  return {
    round: Math.floor(bar / roundBars),
    barInRound: bar % roundBars,
    isLastBar: bar % roundBars === roundBars - 1,
  };
}

export const INSTRUMENT_ROLE_TAGS = new Set(INSTRUMENTS.flatMap((i) => i.roles));
