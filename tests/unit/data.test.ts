import { describe, expect, it } from 'vitest';
import constraints from '../../src/data/constraints.json';
import genres from '../../src/data/genres.json';
import grooves from '../../src/data/grooves.json';
import instruments from '../../src/data/instruments.json';
import phrases from '../../src/data/phrases.json';
import progressions from '../../src/data/progressions.json';
import { parseRoman } from '../../src/theory/chords';

/**
 * Build-time validation of every file in src/data/. Content is edited without touching code,
 * so these tests are the schema: a malformed entry fails the build.
 */

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: Json): v is string => typeof v === 'string' && v.trim().length > 0;

function strings(v: Json, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (isObj(v)) Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe('instruments.json', () => {
  it('matches its schema', () => {
    expect(Array.isArray(instruments)).toBe(true);
    const ids = new Set<string>();
    for (const i of instruments) {
      expect(nonEmpty(i.id) && nonEmpty(i.name) && nonEmpty(i.range) && nonEmpty(i.family)).toBe(
        true,
      );
      expect(['C', 'Bb', 'Eb', 'F']).toContain(i.transposition);
      expect(i.roles.length).toBeGreaterThan(0);
      for (const r of i.roles) expect(['drums', 'bass', 'chords', 'lead']).toContain(r);
      expect(ids.has(i.id)).toBe(false);
      ids.add(i.id);
    }
  });

  it('assigns the usual transpositions', () => {
    const t = (id: string) => instruments.find((i) => i.id === id)?.transposition;
    expect(t('trumpet')).toBe('Bb');
    expect(t('clarinet')).toBe('Bb');
    expect(t('tenorSax')).toBe('Bb');
    expect(t('altoSax')).toBe('Eb');
    expect(t('baritoneSax')).toBe('Eb');
    expect(t('horn')).toBe('F');
    expect(t('guitar')).toBe('C');
  });

  it('gives every Missing Member role a player', () => {
    for (const role of ['drums', 'bass', 'chords', 'lead']) {
      expect(instruments.some((i) => i.roles.includes(role))).toBe(true);
    }
  });
});

describe('genres.json and grooves.json', () => {
  it('every genre has the required fields and maps to a groove', () => {
    const grooveIds = new Set(grooves.map((g) => g.id));
    for (const g of genres) {
      expect(nonEmpty(g.id) && nonEmpty(g.name) && nonEmpty(g.feel)).toBe(true);
      expect(grooveIds.has(g.groove)).toBe(true);
      expect(g.tempo).toHaveLength(2);
      expect(Number.isFinite(g.tempo[0]) && Number.isFinite(g.tempo[1])).toBe(true);
    }
  });

  it('every groove is used by at least one genre', () => {
    const used = new Set(genres.map((g) => g.groove));
    for (const g of grooves) expect(used.has(g.id), g.id).toBe(true);
  });

  it('every groove covers all five meters with the same five parts', () => {
    for (const g of grooves) {
      expect(Object.keys(g.patterns).sort()).toEqual(['3/4', '4/4', '5/4', '6/8', '7/8']);
      for (const p of Object.values(g.patterns)) {
        expect(Object.keys(p).sort()).toEqual(['bass', 'comp', 'hat', 'kick', 'snare']);
      }
    }
  });
});

describe('phrases.json', () => {
  it('matches its schema', () => {
    expect(Object.keys(phrases.styles).sort()).toEqual(['bluesy', 'busy', 'simple']);
    for (const style of Object.values(phrases.styles)) {
      expect(nonEmpty(style.label)).toBe(true);
      expect(Object.keys(style.cells).sort()).toEqual(['3', '4']);
    }
    const ids = phrases.contours.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of phrases.contours) {
      expect(c.steps.length).toBeGreaterThan(2);
      expect(c.steps.every(Number.isInteger)).toBe(true);
    }
  });
});

describe('progressions.json', () => {
  it('has only valid Roman numerals', () => {
    const romans = strings(progressions);
    expect(romans.length).toBeGreaterThan(300);
    for (const r of romans) expect(() => parseRoman(r), r).not.toThrow();
  });

  it('covers every skill level for major, minor and blues', () => {
    for (const fam of ['major', 'minor'] as const) {
      for (const lvl of ['beginner', 'intermediate', 'advanced'] as const) {
        expect(progressions.templates[fam][lvl]['4'].length).toBeGreaterThan(2);
        expect(progressions.templates[fam][lvl]['8'].length).toBeGreaterThan(2);
        expect(progressions.blues[fam][lvl][0]).toHaveLength(12);
        expect(progressions.pools[fam][lvl].length).toBeGreaterThan(4);
      }
    }
  });
});

describe('constraints.json', () => {
  it('has at least 60 cards with the required fields', () => {
    expect(constraints.length).toBeGreaterThanOrEqual(60);
    for (const c of constraints) {
      expect(isObj(c) && nonEmpty(c.id) && nonEmpty(c.text) && nonEmpty(c.category)).toBe(true);
      expect(['easy', 'medium', 'hard']).toContain(c.difficulty);
    }
  });
});

describe('all data files', () => {
  it('contain no empty or whitespace-only strings', () => {
    const all = [constraints, genres, grooves, instruments, phrases, progressions].flatMap((d) =>
      strings(d),
    );
    expect(all.length).toBeGreaterThan(500);
    expect(all.every((s) => s.trim().length > 0)).toBe(true);
  });
});
