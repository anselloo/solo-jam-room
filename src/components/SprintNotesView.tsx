import { useState } from 'react';
import { deleteNote, loadNotes, saveNotes } from '../state/notes';

/** Notes from past Song Sprints, with delete. */
export function SprintNotesView() {
  const [notes, setNotes] = useState(loadNotes);

  const remove = (id: string) => {
    const next = deleteNote(notes, id);
    saveNotes(next);
    setNotes(next);
  };

  return (
    <div className="card stack" aria-label="Sprint notes">
      <h2>Song sprint notes</h2>
      {notes.length === 0 ? (
        <p className="muted">Notes you save after a Song Sprint will show up here.</p>
      ) : (
        <ul className="plain-list">
          {notes.map((n) => (
            <li key={n.id} style={{ display: 'block' }}>
              <details>
                <summary>
                  <strong>{n.title}</strong>{' '}
                  <span className="muted">
                    {n.savedAt ? new Date(n.savedAt).toLocaleDateString() : ''} · {n.setup}
                  </span>
                </summary>
                <p className="muted">
                  {n.theme} · {n.structure}
                </p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{n.text || '(no notes written)'}</p>
                <p className="muted">
                  Hook {n.check.hook ? '✓' : '✗'} · Chorus lift {n.check.chorusLift ? '✓' : '✗'} ·
                  Followed the constraint {n.check.constraint ? '✓' : '✗'}
                </p>
              </details>
              <button
                type="button"
                className="btn"
                aria-label={`Delete notes for ${n.title}`}
                onClick={() => remove(n.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
