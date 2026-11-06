import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { saveProfile, DEFAULT_PROFILE } from '../../src/state/profile';

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '#/progressions';
});
afterEach(cleanup);

const cards = () =>
  within(screen.getByRole('list', { name: /chord progression/i })).getAllByRole('listitem');

const clickDeal = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /^deal/i }));

async function open(profile: Partial<typeof DEFAULT_PROFILE> = {}) {
  saveProfile({ ...DEFAULT_PROFILE, onboarded: true, ...profile });
  const user = userEvent.setup();
  render(<App />);
  return user;
}

describe('Chord Progression Dealer page', () => {
  it('deals a progression with chord names and Roman numerals', async () => {
    const user = await open();
    expect(screen.queryByRole('list', { name: /chord progression/i })).toBeNull();
    await clickDeal(user);
    expect(cards()).toHaveLength(4);
    await user.selectOptions(screen.getByLabelText('Length'), 'blues');
    await clickDeal(user);
    expect(cards()).toHaveLength(12);
    await user.selectOptions(screen.getByLabelText('Length'), '8');
    await clickDeal(user);
    expect(cards()).toHaveLength(8);
  });

  it('deals with the Space key', async () => {
    const user = await open();
    await user.keyboard(' ');
    expect(cards()).toHaveLength(4);
  });

  it('honours a chosen key and mode and the display option', async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText('Mode'), 'major');
    await user.selectOptions(screen.getByLabelText('Key'), '10');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'beginner');
    await clickDeal(user);
    expect(screen.getByText(/B♭ Major/)).toBeTruthy();
    const first = cards()[0];
    expect(within(first).getAllByText(/./).length).toBeGreaterThan(1);
    await user.selectOptions(screen.getByLabelText('Show'), 'roman');
    expect(within(cards()[0]).queryByText('B♭')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Show'), 'names');
    expect(within(cards()[0]).getByText('B♭')).toBeTruthy();
  });

  it('re-deals just one chord', async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText('Mode'), 'major');
    await user.selectOptions(screen.getByLabelText('Key'), '0');
    await clickDeal(user);
    const before = cards().map((c) => c.getAttribute('aria-label'));
    await user.click(screen.getByRole('button', { name: /re-deal chord 3/i }));
    const after = cards().map((c) => c.getAttribute('aria-label'));
    expect(after.filter((a, i) => a !== before[i])).toHaveLength(1);
    expect(after[2]).not.toBe(before[2]);
    await user.keyboard('{Backspace}');
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual(before);
  });

  it('shows written pitch for a B♭ instrument', async () => {
    const user = await open({ mainInstrument: 'trumpet', transposition: 'Bb' });
    await user.selectOptions(screen.getByLabelText('Mode'), 'major');
    await user.selectOptions(screen.getByLabelText('Key'), '10');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'beginner');
    await clickDeal(user);
    expect(screen.getByText(/written pitch/i)).toBeTruthy();
    // Concert B♭ is written C for a B♭ instrument.
    expect(within(cards()[0]).getByText('sounds as B♭')).toBeTruthy();
    expect((screen.getByLabelText('Capo') as HTMLSelectElement).disabled).toBe(true);
  });

  it('shows capo shapes and can suggest a capo', async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText('Mode'), 'major');
    await user.selectOptions(screen.getByLabelText('Key'), '10');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'beginner');
    await clickDeal(user);
    await user.selectOptions(screen.getByLabelText('Capo'), '3');
    expect(within(cards()[0]).getByText('G')).toBeTruthy();
    expect(within(cards()[0]).getByText('sounds as B♭')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /suggest/i }));
    expect(Number((screen.getByLabelText('Capo') as HTMLSelectElement).value)).toBeGreaterThan(0);
  });
});
