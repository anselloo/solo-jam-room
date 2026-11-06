import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { loadProfile } from '../../src/state/profile';

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});
afterEach(cleanup);

type User = ReturnType<typeof userEvent.setup>;

async function skipOnboarding(user: User) {
  await user.click(screen.getByRole('button', { name: /skip for now/i }));
}

function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('app shell', () => {
  it('shows onboarding on first run and saves the answers', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('dialog', { name: /welcome/i })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: /trumpet/i }));
    expect((screen.getByLabelText(/show chords in/i) as HTMLSelectElement).value).toBe('Bb');
    await user.click(screen.getByLabelText(/advanced/i));
    await user.click(screen.getByRole('button', { name: /let.s jam/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(loadProfile()).toMatchObject({
      onboarded: true,
      mainInstrument: 'trumpet',
      transposition: 'Bb',
      level: 'advanced',
    });
  });

  it('lets onboarding be skipped without losing defaults', async () => {
    const user = userEvent.setup();
    render(<App />);
    await skipOnboarding(user);
    expect(loadProfile()).toMatchObject({
      onboarded: true,
      mainInstrument: null,
      level: 'beginner',
    });
  });

  it('renders the home grid with every game', async () => {
    const user = userEvent.setup();
    render(<App />);
    await skipOnboarding(user);
    expect(screen.getByRole('link', { name: /start jamming/i })).toBeTruthy();
    for (const name of [/jam roulette/i, /trade fours/i, /chord dealer/i, /constraint cards/i]) {
      expect(screen.getByRole('link', { name })).toBeTruthy();
    }
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(8);
  });

  it('routes by hash', async () => {
    const user = userEvent.setup();
    render(<App />);
    await skipOnboarding(user);
    go('#/roulette');
    expect(screen.getByRole('heading', { name: /jam roulette/i })).toBeTruthy();
  });

  it('toggles Focus Mode with the F key and leaves with Escape', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await skipOnboarding(user);
    const root = container.querySelector('.app') as HTMLElement;
    expect(root.dataset.focus).toBe('false');
    await user.keyboard('f');
    expect(root.dataset.focus).toBe('true');
    await user.keyboard('{Escape}');
    expect(root.dataset.focus).toBe('false');
  });

  it('opens the shortcut help with ? and closes it with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await skipOnboarding(user);
    await user.keyboard('?');
    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('honours a remapped shortcut and stops honouring the old key', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await skipOnboarding(user);
    go('#/settings');
    await user.click(screen.getByRole('button', { name: /change key for toggle focus mode/i }));
    await user.keyboard('g');
    const root = container.querySelector('.app') as HTMLElement;
    await user.keyboard('f');
    expect(root.dataset.focus).toBe('false');
    await user.keyboard('g');
    expect(root.dataset.focus).toBe('true');
  });

  it('adjusts tempo from the dock', async () => {
    const user = userEvent.setup();
    render(<App />);
    await skipOnboarding(user);
    const bpm = screen.getByRole('spinbutton', { name: /beats per minute/i }) as HTMLInputElement;
    expect(bpm.value).toBe('100');
    await user.click(screen.getByRole('button', { name: 'Faster' }));
    expect(bpm.value).toBe('101');
  });
});
