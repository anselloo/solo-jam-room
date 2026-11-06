import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadJson, removeKey, saveJson } from '../../src/state/storage';
import {
  DEFAULT_PROFILE,
  INSTRUMENTS,
  instrumentById,
  loadProfile,
  playerInstruments,
  sanitizeProfile,
  saveProfile,
  transpositionFor,
} from '../../src/state/profile';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTIONS,
  actionForKey,
  keyLabel,
  keyMatches,
  loadSettings,
  rebind,
  sanitizeSettings,
  saveSettings,
} from '../../src/state/settings';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('storage', () => {
  it('round-trips JSON and falls back when missing or corrupt', () => {
    expect(loadJson('x', 5)).toBe(5);
    expect(saveJson('x', { a: 1 })).toBe(true);
    expect(loadJson('x', null)).toEqual({ a: 1 });
    window.localStorage.setItem('sjr:bad', '{nope');
    expect(loadJson('bad', 'fallback')).toBe('fallback');
    removeKey('x');
    expect(loadJson('x', 0)).toBe(0);
  });
  it('uses the fallback when validation rejects data', () => {
    saveJson('v', 'wrong');
    expect(loadJson('v', 1, () => null)).toBe(1);
  });
  it('survives unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadJson('k', 'default')).toBe('default');
    expect(saveJson('k', 1)).toBe(false);
    expect(() => removeKey('k')).not.toThrow();
    expect(loadProfile()).toEqual(DEFAULT_PROFILE);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('profile', () => {
  it('has valid instrument data', () => {
    expect(new Set(INSTRUMENTS.map((i) => i.id)).size).toBe(INSTRUMENTS.length);
    expect(instrumentById('trumpet')?.transposition).toBe('Bb');
    expect(instrumentById('altoSax')?.transposition).toBe('Eb');
    expect(instrumentById('horn')?.transposition).toBe('F');
    expect(instrumentById('nope')).toBeUndefined();
  });
  it('pre-fills transposition from the instrument', () => {
    expect(transpositionFor('clarinet')).toBe('Bb');
    expect(transpositionFor('guitar')).toBe('C');
    expect(transpositionFor(null)).toBe('C');
  });
  it('persists and reloads', () => {
    const p = {
      ...DEFAULT_PROFILE,
      onboarded: true,
      mainInstrument: 'trumpet',
      otherInstruments: ['piano'],
      transposition: 'Bb' as const,
      level: 'advanced' as const,
    };
    expect(saveProfile(p)).toBe(true);
    expect(loadProfile()).toEqual(p);
    expect(playerInstruments(p)).toEqual(['trumpet', 'piano']);
    expect(playerInstruments(DEFAULT_PROFILE)).toEqual([]);
  });
  it('sanitizes junk', () => {
    expect(sanitizeProfile(null)).toBeNull();
    expect(sanitizeProfile('x')).toBeNull();
    expect(
      sanitizeProfile({
        onboarded: 'yes',
        mainInstrument: 'kazoo',
        otherInstruments: ['piano', 'kazoo', 3],
        transposition: 'G',
        level: 'god',
      }),
    ).toEqual({ ...DEFAULT_PROFILE, otherInstruments: ['piano'] });
  });
});

describe('settings and shortcuts', () => {
  it('has a unique default key for every action', () => {
    const keys = SHORTCUT_ACTIONS.map((a) => DEFAULT_SHORTCUTS[a].toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('matches keys case-insensitively for letters only', () => {
    expect(keyMatches('R', 'r')).toBe(true);
    expect(keyMatches('Backspace', 'backspace')).toBe(false);
    expect(actionForKey('F', DEFAULT_SHORTCUTS)).toBe('focus');
    expect(actionForKey(' ', DEFAULT_SHORTCUTS)).toBe('primary');
    expect(actionForKey('Escape', DEFAULT_SHORTCUTS)).toBe('escape');
    expect(actionForKey('z', DEFAULT_SHORTCUTS)).toBeNull();
  });
  it('labels keys', () => {
    expect(keyLabel(' ')).toBe('Space');
    expect(keyLabel('r')).toBe('R');
    expect(keyLabel('PageDown')).toBe('PageDown');
  });
  it('rebinds, swapping on conflict', () => {
    const a = rebind(DEFAULT_SHORTCUTS, 'primary', 'PageDown');
    expect(a.primary).toBe('PageDown');
    const b = rebind(DEFAULT_SHORTCUTS, 'primary', 'r');
    expect(b.primary).toBe('r');
    expect(b.reroll).toBe(' ');
  });
  it('persists and sanitizes', () => {
    const s = { ...DEFAULT_SETTINGS, theme: 'light' as const, volume: 0.3, muted: true };
    expect(saveSettings(s)).toBe(true);
    expect(loadSettings()).toEqual(s);
    expect(sanitizeSettings(7)).toBeNull();
    expect(
      sanitizeSettings({
        theme: 'neon',
        volume: 9,
        shortcuts: { primary: 'Enter', reroll: '', focus: 5 },
        pulseTapKey: '',
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      shortcuts: { ...DEFAULT_SHORTCUTS, primary: 'Enter' },
    });
  });
});
