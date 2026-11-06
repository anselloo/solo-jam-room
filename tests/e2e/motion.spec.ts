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
        level: 'beginner',
      }),
    );
  });
  await page.goto('./' + hash);
  await expect(page.locator('main')).toBeVisible();
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('Jam Roulette reveals the result instantly instead of spinning', async ({ page }) => {
    await ready(page, '#/roulette');
    await page.keyboard.press('Space');
    // No ~1.5 s spin: the result is there almost at once.
    await expect(page.getByLabel('Result')).toBeVisible({ timeout: 400 });
  });

  test('the card flip and other transitions are effectively instant', async ({ page }) => {
    await ready(page, '#/constraints');
    const duration = await page
      .locator('.flip__inner')
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: /draw again/i })).toBeVisible();
  });

  test('no looping animations are left running', async ({ page }) => {
    await ready(page, '#/roulette');
    await page.keyboard.press('Space');
    const running = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => {
          const t = a.effect?.getComputedTiming();
          return t && t.iterations === Infinity && a.playState === 'running';
        }).length,
    );
    expect(running).toBe(0);
  });
});

test.describe('normal motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('Jam Roulette spins for about a second and a half, and a second press skips it', async ({
    page,
  }) => {
    await ready(page, '#/roulette');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await expect(page.getByLabel('Result')).toHaveCount(0);
    await expect(page.getByLabel('Result')).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('r');
    await page.waitForTimeout(200);
    await expect(page.getByLabel('Result')).toHaveCount(0);
    await page.keyboard.press('r'); // pressing again skips the animation
    await expect(page.getByLabel('Result')).toBeVisible({ timeout: 400 });
  });

  test('the card flip animates', async ({ page }) => {
    await ready(page, '#/constraints');
    const duration = await page
      .locator('.flip__inner')
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeGreaterThan(0.3);
  });
});
