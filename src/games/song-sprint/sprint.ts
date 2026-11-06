import prompts from '../../data/songPrompts.json';
import type { Rng } from '../../random/rng';
import type { SkillLevel } from '../../state/profile';
import {
  NO_LOCKS,
  REELS,
  spin,
  type Locks,
  type ReelId,
  type RouletteResult,
  type SpinOptions,
} from '../roulette/roulette';

export const SPRINT_MINUTES = [5, 10, 15, 20] as const;
export const DEFAULT_SPRINT_MINUTES = 15;

/** Seconds remaining at which to warn the player. */
export const WARN_SECONDS = [300, 60] as const;

export interface PromptPack {
  title: string;
  theme: string;
  structure: string;
  /** Key, mode, tempo, time signature, groove and the constraint card (the "wildcard"). */
  result: RouletteResult;
}

export type PackField = 'title' | 'theme' | 'structure' | 'key' | 'tempo' | 'groove' | 'constraint';
export const PACK_FIELDS: readonly PackField[] = [
  'title',
  'theme',
  'structure',
  'key',
  'tempo',
  'groove',
  'constraint',
];

export const FIELD_LABELS: Record<PackField, string> = {
  title: 'Working title',
  theme: 'Theme or image',
  structure: 'Structure',
  key: 'Key',
  tempo: 'Tempo',
  groove: 'Groove',
  constraint: 'Constraint',
};

type Data = typeof prompts;
const D: Data = prompts;

function fill(pattern: string, rng: Rng): string {
  const adjs = rng.shuffle(D.titleAdjectives);
  const nouns = rng.shuffle(D.titleNouns);
  return pattern
    .replace('{adj2}', adjs[1])
    .replace('{adj}', adjs[0])
    .replace('{noun2}', nouns[1])
    .replace('{noun}', nouns[0])
    .replace('{time}', rng.pick(D.titleTimes));
}

export function randomTitle(rng: Rng): string {
  return fill(rng.pick(D.titlePatterns), rng);
}

export const randomTheme = (rng: Rng): string => rng.pick(D.themes);
export const randomStructure = (rng: Rng): string => rng.pick(D.structures);

/** Which spin reels a pack field owns. Mode travels with key so the key is always spelled right. */
const FIELD_REELS: Record<'key' | 'tempo' | 'groove' | 'constraint', ReelId[]> = {
  key: ['key', 'mode'],
  tempo: ['tempo'],
  groove: ['groove'],
  constraint: ['wildcard'],
};

export function generatePack(
  rng: Rng,
  level: SkillLevel,
  wildcardPool: SpinOptions['wildcardPool'],
): PromptPack {
  return {
    title: randomTitle(rng),
    theme: randomTheme(rng),
    structure: randomStructure(rng),
    result: spin(null, NO_LOCKS, { level, wildcardOn: true, wildcardPool }, rng),
  };
}

/** Re-roll exactly one field of the pack; every other field stays put. */
export function rerollField(
  pack: PromptPack,
  field: PackField,
  rng: Rng,
  level: SkillLevel,
  wildcardPool: SpinOptions['wildcardPool'],
): PromptPack {
  switch (field) {
    case 'title':
      return { ...pack, title: randomTitle(rng) };
    case 'theme':
      return { ...pack, theme: randomTheme(rng) };
    case 'structure':
      return { ...pack, structure: randomStructure(rng) };
    default: {
      const free = FIELD_REELS[field];
      const locks = Object.fromEntries(REELS.map((r) => [r, !free.includes(r)])) as Locks;
      return {
        ...pack,
        result: spin(pack.result, locks, { level, wildcardOn: true, wildcardPool }, rng),
      };
    }
  }
}

/** Warnings that make sense for a sprint of this length (never at or before the start). */
export function warningsFor(minutes: number): number[] {
  return WARN_SECONDS.filter((s) => s < minutes * 60);
}
