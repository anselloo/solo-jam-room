import { expect, test, type Page } from '@playwright/test';

/** Walk through first-run onboarding the way a new player would. */
async function onboard(page: Page) {
  await page.goto('./');
  const dialog = page.getByRole('dialog', { name: /welcome/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: 'Guitar' }).click();
  await dialog.getByLabel(/beginner/i).check();
  await dialog.getByRole('button', { name: /let.s jam/i }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // The failed-request message does not say which URL; the response listener below does.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource'))
      errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  (page as Page & { __errors: string[] }).__errors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { __errors: string[] }).__errors).toEqual([]);
});

test('onboarding, then the Home page lists every game', async ({ page }) => {
  await onboard(page);
  await expect(page.getByRole('heading', { name: 'Solo Jam Room', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /start jamming/i })).toBeVisible();
  for (const name of [
    'Jam Roulette',
    'Trade Fours',
    'Chord Dealer',
    'Constraint Cards',
    'Missing Member',
    'Hold the Pulse',
    'Genre Flip',
    'Song Sprint',
  ]) {
    await expect(page.getByRole('link', { name })).toBeVisible();
  }
  // The choices were remembered.
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test.describe('each game opens and responds to its primary action', () => {
  test.beforeEach(async ({ page }) => {
    await onboard(page);
  });

  test('Jam Roulette', async ({ page }) => {
    await page.getByRole('link', { name: 'Jam Roulette' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Jam Roulette' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByLabel('Result')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel('Result')).toContainText('BPM');
  });

  test('Trade Fours', async ({ page }) => {
    await page.getByRole('link', { name: 'Trade Fours' }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByText('Get ready…')).toBeVisible();
  });

  test('Chord Dealer', async ({ page }) => {
    await page.getByRole('link', { name: 'Chord Dealer' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /chord dealer/i })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByRole('list', { name: /chord progression/i })).toBeVisible();
    expect(
      await page
        .getByRole('list', { name: /chord progression/i })
        .getByRole('listitem')
        .count(),
    ).toBe(4);
  });

  test('Constraint Cards', async ({ page }) => {
    await page.getByRole('link', { name: 'Constraint Cards' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /constraint cards/i })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: /draw again/i })).toBeVisible();
  });

  test('Missing Member', async ({ page }) => {
    await page.getByRole('link', { name: 'Missing Member' }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByText('Get ready…')).toBeVisible();
  });

  test('Hold the Pulse', async ({ page }) => {
    await page.getByRole('link', { name: 'Hold the Pulse' }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByText('LISTEN')).toBeVisible();
  });

  test('Genre Flip', async ({ page }) => {
    await page.getByRole('link', { name: 'Genre Flip' }).click();
    await page.getByRole('button', { name: 'Draw', exact: true }).click();
    await expect(page.getByRole('timer')).toBeVisible();
    await expect(page.getByText('Play this tune')).toBeVisible();
  });

  test('Song Sprint', async ({ page }) => {
    await page.getByRole('link', { name: 'Song Sprint' }).click();
    await page
      .getByRole('button', { name: /start the sprint/i })
      .first()
      .click();
    await expect(page.getByRole('timer')).toBeVisible();
  });

  test('Daily Jam', async ({ page }) => {
    await page.getByRole('link', { name: /see today.s challenge/i }).click();
    await expect(page.getByRole('heading', { name: /daily jam/i })).toBeVisible();
    await page.getByRole('button', { name: /i did it/i }).click();
    await expect(page.getByRole('button', { name: /done for today/i })).toBeDisabled();
  });
});
