import { loadJson, saveJson } from './storage';

export type ThemeChoice = 'system' | 'dark' | 'light';

/** Actions that can be bound to a key. */
export type ShortcutAction =
  'primary' | 'reroll' | 'back' | 'transport' | 'tap' | 'focus' | 'help' | 'escape';

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  primary: 'Primary action (spin, draw, deal, start)',
  reroll: 'Re-roll',
  back: 'Previous result',
  transport: 'Play / stop backing band',
  tap: 'Tap tempo',
  focus: 'Toggle Focus Mode',
  help: 'Shortcut help',
  escape: 'Exit Focus Mode / close overlays',
};

export const SHORTCUT_ACTIONS = Object.keys(SHORTCUT_LABELS) as ShortcutAction[];

/** Keys are `KeyboardEvent.key` values, compared case-insensitively for letters. */
export type ShortcutMap = Record<ShortcutAction, string>;

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  primary: ' ',
  reroll: 'r',
  back: 'Backspace',
  transport: 'p',
  tap: 't',
  focus: 'f',
  help: '?',
  escape: 'Escape',
};

export interface Settings {
  theme: ThemeChoice;
  muted: boolean;
  volume: number;
  shortcuts: ShortcutMap;
  /** Key used to tap the beat in Hold the Pulse (foot pedals, page turners). */
  pulseTapKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  muted: false,
  volume: 0.8,
  shortcuts: DEFAULT_SHORTCUTS,
  pulseTapKey: ' ',
};

export function sanitizeSettings(value: unknown): Settings | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const shortcuts = { ...DEFAULT_SHORTCUTS };
  if (typeof v.shortcuts === 'object' && v.shortcuts !== null) {
    for (const a of SHORTCUT_ACTIONS) {
      const k = (v.shortcuts as Record<string, unknown>)[a];
      if (typeof k === 'string' && k.length > 0) shortcuts[a] = k;
    }
  }
  return {
    theme: v.theme === 'dark' || v.theme === 'light' ? v.theme : 'system',
    muted: v.muted === true,
    volume:
      typeof v.volume === 'number' && v.volume >= 0 && v.volume <= 1
        ? v.volume
        : DEFAULT_SETTINGS.volume,
    shortcuts,
    pulseTapKey:
      typeof v.pulseTapKey === 'string' && v.pulseTapKey.length > 0
        ? v.pulseTapKey
        : DEFAULT_SETTINGS.pulseTapKey,
  };
}

export const loadSettings = (): Settings =>
  loadJson('settings', DEFAULT_SETTINGS, sanitizeSettings);
export const saveSettings = (s: Settings): boolean => saveJson('settings', s);

const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k);

/** Does this key press match the key bound to an action? */
export function keyMatches(pressed: string, bound: string): boolean {
  return norm(pressed) === norm(bound);
}

/** Which action (if any) a key press triggers. */
export function actionForKey(pressed: string, map: ShortcutMap): ShortcutAction | null {
  return SHORTCUT_ACTIONS.find((a) => keyMatches(pressed, map[a])) ?? null;
}

/** Human-friendly key label for display. */
export function keyLabel(key: string): string {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/**
 * Rebind an action. If another action already uses the key, the two swap so every action
 * always keeps a unique key.
 */
export function rebind(map: ShortcutMap, action: ShortcutAction, key: string): ShortcutMap {
  const clash = SHORTCUT_ACTIONS.find((a) => a !== action && keyMatches(map[a], key));
  const next = { ...map, [action]: key };
  if (clash) next[clash] = map[action];
  return next;
}
