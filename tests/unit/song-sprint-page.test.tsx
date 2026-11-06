import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { loadDraft, loadNotes } from '../../src/state/notes';
import { DEFAULT_PROFILE, saveProfile } from '../../src/state/profile';
import { installFakeAudio } from './helpers/fakeAudio';

const START = new Date(2026, 5, 10, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
  });
  vi.setSystemTime(START);
  window.localStorage.clear();
  saveProfile({ ...DEFAULT_PROFILE, onboarded: true });
  window.location.hash = '#/song-sprint';
  installFakeAudio();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Move the wall clock (as when a hidden tab wakes up) and let the timer tick once. */
async function jumpTo(secondsAfterStart: number) {
  vi.setSystemTime(new Date(START.getTime() + secondsAfterStart * 1000));
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
}

const pack = () => screen.getByLabelText('Prompt pack');
const valueOf = (label: string) =>
  within(pack())
    .getByText(new RegExp(`^${label}:`))
    .parentElement!.querySelector('strong')!.textContent;

describe('Song Sprint page', () => {
  it('deals a full prompt pack', () => {
    render(<App />);
    for (const label of [
      'Working title',
      'Theme or image',
      'Structure',
      'Key',
      'Tempo',
      'Groove',
      'Constraint',
    ]) {
      expect(valueOf(label)!.length).toBeGreaterThan(0);
    }
  });

  it('re-rolls one field at a time', () => {
    render(<App />);
    const labels = [
      'Working title',
      'Theme or image',
      'Structure',
      'Key',
      'Tempo',
      'Groove',
      'Constraint',
    ];
    const before = Object.fromEntries(labels.map((l) => [l, valueOf(l)]));
    let changed = false;
    for (let i = 0; i < 30 && !changed; i++) {
      fireEvent.click(screen.getByRole('button', { name: /re-roll theme or image/i }));
      expect(valueOf('Working title')).toBe(before['Working title']);
      expect(valueOf('Structure')).toBe(before['Structure']);
      expect(valueOf('Key')).toBe(before['Key']);
      expect(valueOf('Tempo')).toBe(before['Tempo']);
      expect(valueOf('Groove')).toBe(before['Groove']);
      expect(valueOf('Constraint')).toBe(before['Constraint']);
      changed = valueOf('Theme or image') !== before['Theme or image'];
    }
    expect(changed).toBe(true);
  });

  it('counts down in real time, warns at one minute, and calls pencils down at zero', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /start the sprint/i }));
    expect(screen.getByRole('timer').textContent).toBe('5:00');
    await jumpTo(30);
    expect(screen.getByRole('timer').textContent).toBe('4:30');
    // The tab was in the background for four minutes: the clock is still right.
    await jumpTo(4 * 60 + 10);
    expect(screen.getByRole('timer').textContent).toBe('0:50');
    expect(screen.getAllByText(/one minute left/i).length).toBeGreaterThan(0);
    await jumpTo(5 * 60 + 1);
    expect(screen.getAllByText(/pencils down/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /play it through/i })).toBeTruthy();
  });

  it('only warns about the five-minute mark on longer sprints', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /start the sprint/i }));
    await jumpTo(5 * 60 + 5);
    expect(screen.getAllByText(/5 minutes left/i).length).toBeGreaterThan(0);
  });

  it('saves notes as you type, and the finished notes show on the profile where they can be deleted', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /start the sprint/i }));
    fireEvent.change(screen.getByLabelText(/notes: lyrics/i), {
      target: { value: 'Verse: walking home' },
    });
    expect(loadDraft()).toBe('Verse: walking home');

    fireEvent.click(screen.getByRole('button', { name: /pencils down/i }));
    fireEvent.click(screen.getByLabelText(/did it have a hook/i));
    fireEvent.click(screen.getByRole('button', { name: /^save notes$/i }));
    const [saved] = loadNotes();
    expect(saved.text).toBe('Verse: walking home');
    expect(saved.check).toEqual({ hook: true, chorusLift: false, constraint: false });
    expect(saved.title.length).toBeGreaterThan(0);
    expect(loadDraft()).toBe('');

    act(() => {
      window.location.hash = '#/profile';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    const list = screen.getByLabelText('Sprint notes');
    expect(list.textContent).toContain('Verse: walking home');
    fireEvent.click(within(list).getByRole('button', { name: /delete notes for/i }));
    expect(loadNotes()).toHaveLength(0);
    expect(screen.getByLabelText('Sprint notes').textContent).toContain('Notes you save');
  });

  it('offers a self-check after the sprint', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /start the sprint/i }));
    fireEvent.click(screen.getByRole('button', { name: /pencils down/i }));
    for (const q of [/hook/i, /chorus lift/i, /follow the constraint/i]) {
      expect(screen.getByLabelText(q)).toBeTruthy();
    }
  });
});
