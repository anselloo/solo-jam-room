import { afterEach, describe, expect, it } from 'vitest';
import prompts from '../../src/data/songPrompts.json';
import { CARDS } from '../../src/games/constraints/deck';
import { DIFFICULTY } from '../../src/games/roulette/roulette';
import {
  FIELD_LABELS,
  PACK_FIELDS,
  SPRINT_MINUTES,
  generatePack,
  randomTitle,
  rerollField,
  warningsFor,
  type PackField,
} from '../../src/games/song-sprint/sprint';
import { createRng } from '../../src/random/rng';
import {
  MAX_NOTES,
  addNote,
  clearDraft,
  deleteNote,
  loadDraft,
  loadNotes,
  newNoteId,
  sanitizeNotes,
  saveDraft,
  saveNotes,
  type SprintNote,
} from '../../src/state/notes';

afterEach(() => window.localStorage.clear());

describe('songPrompts.json', () => {
  it('has plenty of original material in every list', () => {
    expect(prompts.titleAdjectives.length).toBeGreaterThanOrEqual(20);
    expect(prompts.titleNouns.length).toBeGreaterThanOrEqual(20);
    expect(prompts.themes.length).toBeGreaterThanOrEqual(30);
    expect(prompts.structures.length).toBeGreaterThanOrEqual(8);
    for (const list of [
      prompts.titleAdjectives,
      prompts.titleNouns,
      prompts.themes,
      prompts.structures,
      prompts.titlePatterns,
      prompts.titleTimes,
    ]) {
      expect(new Set(list).size).toBe(list.length);
      for (const s of list) expect(s.trim().length).toBeGreaterThan(2);
    }
  });
  it('includes the structure named in the spec', () => {
    expect(prompts.structures.some((s) => s.startsWith('Verse – Chorus – Verse – Chorus'))).toBe(
      true,
    );
  });
});

describe('prompt packs', () => {
  const pool = CARDS.filter((c) => !c.instruments);

  it('make a full pack within the level limits', () => {
    const rng = createRng(1);
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      const cfg = DIFFICULTY[level];
      for (let i = 0; i < 50; i++) {
        const p = generatePack(rng, level, pool);
        expect(p.title.length).toBeGreaterThan(3);
        expect(prompts.themes).toContain(p.theme);
        expect(prompts.structures).toContain(p.structure);
        expect(cfg.modes).toContain(p.result.mode);
        expect(p.result.bpm).toBeGreaterThanOrEqual(cfg.bpm[0]);
        expect(p.result.bpm).toBeLessThanOrEqual(cfg.bpm[1]);
        expect(pool).toContain(p.result.wildcard);
      }
    }
  });

  it('builds titles with no leftover placeholders', () => {
    const rng = createRng(2);
    for (let i = 0; i < 300; i++) expect(randomTitle(rng)).not.toMatch(/[{}]/);
  });

  it('re-rolls exactly one field at a time', () => {
    const rng = createRng(3);
    const base = generatePack(rng, 'advanced', pool);
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const groupOf = (field: PackField) => {
      switch (field) {
        case 'key':
          return ['keyPc', 'mode'];
        case 'tempo':
          return ['bpm'];
        case 'groove':
          return ['genre'];
        case 'constraint':
          return ['wildcard'];
        default:
          return [];
      }
    };
    for (const field of PACK_FIELDS) {
      let changedSomething = false;
      for (let i = 0; i < 40; i++) {
        const next = rerollField(base, field, rng, 'advanced', pool);
        // Everything outside the field's own group is untouched.
        for (const other of ['title', 'theme', 'structure'] as const) {
          if (other !== field) expect(next[other]).toBe(base[other]);
        }
        const own = groupOf(field);
        for (const k of Object.keys(base.result) as (keyof typeof base.result)[]) {
          if (!own.includes(k))
            expect(same(next.result[k], base.result[k]), `${field} changed ${k}`).toBe(true);
        }
        if (!same(next, base)) changedSomething = true;
      }
      expect(changedSomething, `${field} never changed`).toBe(true);
    }
    expect(PACK_FIELDS.every((f) => FIELD_LABELS[f].length > 0)).toBe(true);
  });

  it('only warns before the end of the sprint', () => {
    expect(SPRINT_MINUTES).toEqual([5, 10, 15, 20]);
    expect(warningsFor(15)).toEqual([300, 60]);
    expect(warningsFor(5)).toEqual([60]);
    expect(warningsFor(20)).toEqual([300, 60]);
  });
});

const note = (id: string, text = 'la la'): SprintNote => ({
  id,
  savedAt: '2026-06-10T12:00:00.000Z',
  title: 'The Slow Lighthouse',
  theme: 'A storm rolling in',
  structure: 'Verse – Chorus',
  setup: 'D Dorian · 96 BPM',
  text,
  check: { hook: true, chorusLift: false, constraint: true },
});

describe('sprint notes storage', () => {
  it('saves, lists newest first, and deletes', () => {
    let notes = addNote([], note('a'));
    notes = addNote(notes, note('b'));
    expect(notes.map((n) => n.id)).toEqual(['b', 'a']);
    expect(saveNotes(notes)).toBe(true);
    expect(loadNotes().map((n) => n.id)).toEqual(['b', 'a']);
    notes = deleteNote(loadNotes(), 'b');
    saveNotes(notes);
    expect(loadNotes().map((n) => n.id)).toEqual(['a']);
    expect(deleteNote(notes, 'zzz')).toEqual(notes);
  });
  it('replaces a note saved twice and caps the list', () => {
    let notes = addNote([], note('a', 'one'));
    notes = addNote(notes, note('a', 'two'));
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe('two');
    for (let i = 0; i < MAX_NOTES + 20; i++) notes = addNote(notes, note(`n${i}`));
    expect(notes).toHaveLength(MAX_NOTES);
    expect(notes[0].id).toBe(`n${MAX_NOTES + 19}`);
  });
  it('sanitizes junk', () => {
    expect(sanitizeNotes('x')).toBeNull();
    expect(sanitizeNotes([null, 4, { id: '' }, { id: 'ok', text: 5, check: 'x' }])).toEqual([
      {
        id: 'ok',
        savedAt: '',
        title: '',
        theme: '',
        structure: '',
        setup: '',
        text: '',
        check: { hook: false, chorusLift: false, constraint: false },
      },
    ]);
  });
  it('keeps and clears the draft', () => {
    expect(loadDraft()).toBe('');
    saveDraft('verse one…');
    expect(loadDraft()).toBe('verse one…');
    clearDraft();
    expect(loadDraft()).toBe('');
  });
  it('makes distinct ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newNoteId()));
    expect(ids.size).toBe(200);
  });
});
