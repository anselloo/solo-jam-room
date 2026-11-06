import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const ROUTES = [
  '#/',
  '#/roulette',
  '#/trade-fours',
  '#/progressions',
  '#/constraints',
  '#/missing-member',
  '#/hold-the-pulse',
  '#/genre-flip',
  '#/song-sprint',
  '#/daily',
  '#/profile',
  '#/settings',
  '#/about',
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes
      .slice(0, 4)
      .map((n) => `${n.target.join(' ')} :: ${n.failureSummary?.split('\n')[1] ?? ''}`),
  }));
}

async function open(page: Page, hash: string, theme: 'dark' | 'light') {
  await page.addInitScript(
    ([t]) => {
      window.localStorage.setItem(
        'sjr:profile',
        JSON.stringify({
          onboarded: true,
          mainInstrument: 'guitar',
          otherInstruments: [],
          transposition: 'C',
          level: 'beginner',
        }),
      );
      window.localStorage.setItem('sjr:settings', JSON.stringify({ theme: t }));
    },
    [theme],
  );
  await page.goto('./' + hash);
  await expect(page.locator('main')).toBeVisible();
}

for (const theme of ['dark', 'light'] as const) {
  for (const route of ROUTES) {
    test(`no axe violations on ${route} (${theme})`, async ({ page }) => {
      await open(page, route, theme);
      expect(await scan(page)).toEqual([]);
    });
  }
}

test('no axe violations on the onboarding dialog', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('dialog', { name: /welcome/i })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('no axe violations with results showing: Roulette, Dealer, Constraint card', async ({
  page,
}) => {
  await open(page, '#/roulette', 'dark');
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Result')).toBeVisible({ timeout: 5000 });
  expect(await scan(page)).toEqual([]);

  await page.goto('./#/progressions');
  await page.keyboard.press('Space');
  await expect(page.getByRole('list', { name: /chord progression/i })).toBeVisible();
  expect(await scan(page)).toEqual([]);

  await page.goto('./#/constraints');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: /draw again/i })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('no axe violations with the mixer open and Focus Mode on', async ({ page }) => {
  await open(page, '#/', 'dark');
  await page.getByRole('button', { name: /mixer/i }).click();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('f');
  expect(await scan(page)).toEqual([]);
});
