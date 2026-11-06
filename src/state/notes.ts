import { loadJson, removeKey, saveJson } from './storage';

/** What the player wrote during a Song Sprint, kept locally so they can find it again. */
export interface SprintNote {
  id: string;
  /** ISO timestamp. */
  savedAt: string;
  title: string;
  theme: string;
  structure: string;
  /** Human-readable, e.g. "D Dorian · 96 BPM". */
  setup: string;
  text: string;
  check: { hook: boolean; chorusLift: boolean; constraint: boolean };
}

export const MAX_NOTES = 100;

export function sanitizeNotes(value: unknown): SprintNote[] | null {
  if (!Array.isArray(value)) return null;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return value
    .filter((n): n is Record<string, unknown> => typeof n === 'object' && n !== null)
    .filter((n) => typeof n.id === 'string' && n.id.length > 0)
    .map((n) => {
      const c = (n.check ?? {}) as Record<string, unknown>;
      return {
        id: n.id as string,
        savedAt: str(n.savedAt),
        title: str(n.title),
        theme: str(n.theme),
        structure: str(n.structure),
        setup: str(n.setup),
        text: str(n.text),
        check: {
          hook: c.hook === true,
          chorusLift: c.chorusLift === true,
          constraint: c.constraint === true,
        },
      };
    });
}

export const loadNotes = (): SprintNote[] => loadJson('sprintNotes', [], sanitizeNotes);
export const saveNotes = (notes: SprintNote[]): boolean => saveJson('sprintNotes', notes);

/** Newest first, capped so storage cannot grow without bound. */
export function addNote(notes: readonly SprintNote[], note: SprintNote): SprintNote[] {
  return [note, ...notes.filter((n) => n.id !== note.id)].slice(0, MAX_NOTES);
}

export function deleteNote(notes: readonly SprintNote[], id: string): SprintNote[] {
  return notes.filter((n) => n.id !== id);
}

// The unfinished notes box, so a refresh in the middle of a sprint loses nothing.
export const loadDraft = (): string =>
  loadJson('sprintDraft', '', (v) => (typeof v === 'string' ? v : null));
export const saveDraft = (text: string): boolean => saveJson('sprintDraft', text);
export const clearDraft = (): void => removeKey('sprintDraft');

export function newNoteId(now: Date = new Date()): string {
  return `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
