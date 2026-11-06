import instrumentData from '../data/instruments.json';
import type { TranspositionKey } from '../theory/notes';
import { loadJson, saveJson } from './storage';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export const SKILL_LEVELS: readonly SkillLevel[] = ['beginner', 'intermediate', 'advanced'];

export interface InstrumentInfo {
  id: string;
  name: string;
  transposition: TranspositionKey;
  range: string;
  roles: string[];
  family: string;
}

export const INSTRUMENTS = instrumentData as InstrumentInfo[];

export function instrumentById(id: string): InstrumentInfo | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}

export interface Profile {
  /** False until the player finishes or skips onboarding. */
  onboarded: boolean;
  mainInstrument: string | null;
  otherInstruments: string[];
  transposition: TranspositionKey;
  level: SkillLevel;
}

export const DEFAULT_PROFILE: Profile = {
  onboarded: false,
  mainInstrument: null,
  otherInstruments: [],
  transposition: 'C',
  level: 'beginner',
};

const TRANSPOSITION_KEYS: readonly string[] = ['C', 'Bb', 'Eb', 'F'];

/** Coerce stored data into a valid Profile, discarding anything unrecognized. */
export function sanitizeProfile(value: unknown): Profile | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const known = (id: unknown): id is string => typeof id === 'string' && !!instrumentById(id);
  return {
    onboarded: v.onboarded === true,
    mainInstrument: known(v.mainInstrument) ? v.mainInstrument : null,
    otherInstruments: Array.isArray(v.otherInstruments) ? v.otherInstruments.filter(known) : [],
    transposition: TRANSPOSITION_KEYS.includes(v.transposition as string)
      ? (v.transposition as TranspositionKey)
      : 'C',
    level: SKILL_LEVELS.includes(v.level as SkillLevel)
      ? (v.level as SkillLevel)
      : DEFAULT_PROFILE.level,
  };
}

export const loadProfile = (): Profile => loadJson('profile', DEFAULT_PROFILE, sanitizeProfile);
export const saveProfile = (p: Profile): boolean => saveJson('profile', p);

/** All instruments the player plays, main first. */
export function playerInstruments(p: Profile): string[] {
  return p.mainInstrument ? [p.mainInstrument, ...p.otherInstruments] : p.otherInstruments;
}

/** Transposition suggested by an instrument choice (used to pre-fill onboarding). */
export function transpositionFor(instrumentId: string | null): TranspositionKey {
  return (instrumentId && instrumentById(instrumentId)?.transposition) || 'C';
}
