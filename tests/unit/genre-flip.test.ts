import { describe, expect, it } from 'vitest';
import { GENRES, grooveById } from '../../src/audio/band/grooves';
import { TIME_SIGNATURES, signatureLabel } from '../../src/audio/scheduler';
import {
  TUNES,
  backingForFlip,
  flipFor,
  genreFor,
  tuneKeyName,
  tuneKeyPc,
} from '../../src/games/genre-flip/flip';
import { Deck } from '../../src/random/deck';
import { createRng } from '../../src/random/rng';
import { chordNotes } from '../../src/theory/chords';
import { parseNote, pc } from '../../src/theory/notes';
import { MODE_IDS, keyRootsFor, scalePitchClasses } from '../../src/theory/scales';

describe('tunes.json', () => {
  it('marks every tune public domain, with a source note', () => {
    expect(TUNES.length).toBeGreaterThanOrEqual(30);
    for (const t of TUNES) {
      expect(t.publicDomain, `${t.id} must be publicDomain: true`).toBe(true);
      expect(
        typeof t.source === 'string' && t.source.trim().length > 10,
        `${t.id} needs a source note`,
      ).toBe(true);
    }
  });

  it('has the fields the game needs and no duplicates', () => {
    expect(new Set(TUNES.map((t) => t.id)).size).toBe(TUNES.length);
    expect(new Set(TUNES.map((t) => t.title)).size).toBe(TUNES.length);
    for (const t of TUNES) {
      expect(t.title.trim().length).toBeGreaterThan(2);
      expect(t.origin.trim().length).toBeGreaterThan(5);
      expect(() => parseNote(t.key.root)).not.toThrow();
      expect(MODE_IDS).toContain(t.key.mode);
    }
  });

  it('reproduces no lyrics or notation: entries hold only short metadata', () => {
    for (const t of TUNES) {
      expect(Object.keys(t).sort()).toEqual([
        'id',
        'key',
        'origin',
        'publicDomain',
        'source',
        'title',
      ]);
      expect(t.title.length).toBeLessThan(60);
      expect(t.origin.length).toBeLessThan(100);
      expect(t.source.length).toBeLessThan(200);
    }
  });

  it('only names composers who died long ago, or traditional sources', () => {
    // A guard against adding something recent: every source must say traditional or give a death year.
    for (const t of TUNES) {
      const ok = /traditional/i.test(t.source) || /died (1[0-9]{3})/i.test(t.source);
      expect(ok, `${t.id}: ${t.source}`).toBe(true);
      const died = /died (\d{4})/i.exec(t.source);
      if (died) expect(Number(died[1])).toBeLessThan(1925);
    }
  });
});

describe('genres', () => {
  it('every genre maps to a backing groove with a pattern for each of its meters', () => {
    for (const g of GENRES) {
      const groove = grooveById(g.groove);
      expect(groove, g.id).toBeDefined();
      for (const m of g.meters) expect(groove!.patterns[m], `${g.id} ${m}`).toBeDefined();
    }
    expect(GENRES.length).toBeGreaterThanOrEqual(10);
    expect(() => genreFor('nope')).toThrow();
    expect(genreFor('reggae').groove).toBe('reggae');
  });
});

describe('flipping a tune', () => {
  it('names the suggested key with the right spelling', () => {
    const find = (id: string) => TUNES.find((t) => t.id === id)!;
    expect(tuneKeyName(find('silent-night'))).toBe('B♭ major');
    expect(tuneKeyName(find('moonlight'))).toBe('C♯ minor');
    expect(tuneKeyName(find('scarborough'))).toBe('D dorian');
    expect(tuneKeyName(find('swing-low'))).toBe('E♭ major');
    expect(tuneKeyPc(find('silent-night'))).toBe(10);
  });

  it('picks a tempo in the genre range and a meter the genre knows', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const g = rng.pick(GENRES);
      const flip = flipFor(rng.pick(TUNES), g, rng);
      expect(flip.bpm).toBeGreaterThanOrEqual(g.tempo[0]);
      expect(flip.bpm).toBeLessThanOrEqual(g.tempo[1]);
      expect(TIME_SIGNATURES.map(signatureLabel)).toContain(flip.signature);
      expect(g.meters).toContain(flip.signature);
    }
  });

  it('backs every tune with chords from its own key and mode', () => {
    const rng = createRng(2);
    for (const tune of TUNES) {
      const flip = flipFor(tune, rng.pick(GENRES), rng);
      const scale = scalePitchClasses(keyRootsFor(tune.key.mode)[tuneKeyPc(tune)], tune.key.mode);
      for (const chord of backingForFlip(flip, true)) {
        for (const n of chordNotes(chord)) expect(scale.has(pc(n))).toBe(true);
      }
    }
  });

  it('deals every tune and every genre once before repeating', () => {
    const rng = createRng(3);
    const tunes = new Deck(TUNES, rng);
    const genres = new Deck(GENRES, rng);
    const seenTunes = new Set<string>();
    for (let i = 0; i < TUNES.length; i++) seenTunes.add(tunes.draw().item.id);
    expect(seenTunes.size).toBe(TUNES.length);
    const seenGenres = new Set<string>();
    for (let i = 0; i < GENRES.length; i++) seenGenres.add(genres.draw().item.id);
    expect(seenGenres.size).toBe(GENRES.length);
    expect(tunes.draw().reshuffled).toBe(true);
  });
});
