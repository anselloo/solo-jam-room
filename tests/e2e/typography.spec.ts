import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page, hash: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'sjr:profile',
      JSON.stringify({
        onboarded: true,
        mainInstrument: null,
        otherInstruments: [],
        transposition: 'C',
        level: 'intermediate',
      }),
    );
  });
  await page.goto('./' + hash);
  await expect(page.locator('main')).toBeVisible();
}

const style = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return { family: cs.fontFamily, transform: cs.textTransform };
    });

/**
 * Chord symbols and Roman numerals are case-sensitive: Gm is minor and GM is not a chord. The display
 * face (Duera) is for headings only, so anything musical must avoid it and avoid uppercasing.
 */
test.describe('case-sensitive music text keeps its case', () => {
  test('chord names on the Chord Dealer', async ({ page }) => {
    await ready(page, '#/progressions');
    await page.getByRole('combobox', { name: 'Mode' }).selectOption('minor');
    await page.getByRole('combobox', { name: 'Difficulty' }).selectOption('beginner');
    await page.getByRole('button', { name: /^deal$/i }).click();
    const names = await page.locator('.chord-card__name').allTextContents();
    expect(names.some((n) => /m$/.test(n))).toBe(true); // a minor chord is dealt in a minor key
    const s = await style(page, '.chord-card__name');
    expect(s.family).not.toMatch(/duera/i);
    expect(s.transform).toBe('none');
    // What is on screen is what was dealt: the minor "m" is rendered as typed.
    const roman = await style(page, '.chord-card__roman');
    expect(roman.transform).toBe('none');
  });

  test('the current chord in the transport dock', async ({ page }) => {
    await ready(page, '#/');
    await page.keyboard.press('p');
    await expect(page.locator('.dock__chord')).toBeVisible({ timeout: 8000 });
    const s = await style(page, '.dock__chord');
    expect(s.family).not.toMatch(/duera/i);
    expect(s.transform).toBe('none');
  });

  test('the Daily Jam summary, which can contain Roman numerals', async ({ page }) => {
    await ready(page, '#/daily');
    const s = await style(page, '[aria-label="Today\'s challenge"] .prompt');
    expect(s.family).not.toMatch(/duera/i);
    expect(s.transform).toBe('none');
  });
});

test.describe('Focus Mode', () => {
  test('enlarges the prompt, not the controls, and hides the panels around it', async ({
    page,
  }) => {
    await ready(page, '#/roulette');
    await page.keyboard.press('Space');
    await expect(page.getByLabel('Result')).toBeVisible({ timeout: 5000 });
    const before = await page
      .getByRole('button', { name: /lock key/i })
      .evaluate((el) => getComputedStyle(el).fontSize);
    await page.keyboard.press('f');
    await expect(page.locator('.app')).toHaveAttribute('data-focus', 'true');
    const after = await page
      .getByRole('button', { name: /lock key/i })
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(after).toBe(before); // controls are not blown up
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeHidden();
    // The top of the focus view is reachable (not clipped above the viewport).
    const top = await page.locator('.focus-view').evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
  });
});
