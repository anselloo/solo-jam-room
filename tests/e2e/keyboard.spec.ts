import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page, hash = '') {
  await page.addInitScript(() => {
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
  });
  await page.goto('./' + hash);
  await expect(page.locator('main')).toBeVisible();
}

const hasFocusIndicator = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { ok: false, tag: 'body' };
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
    const shadow = cs.boxShadow !== 'none';
    return { ok: outline || shadow, tag: el.tagName + (el.textContent ?? '').slice(0, 20) };
  });

test('Tab order starts with a skip link and every stop shows a focus indicator', async ({
  page,
}) => {
  await ready(page);
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.textContent);
  expect(first).toMatch(/skip to content/i);
  const missing: string[] = [];
  let stops = 0;
  // Tab through the page until focus leaves it (back to the browser, so body is active).
  for (let i = 0; i < 80; i++) {
    const f = await hasFocusIndicator(page);
    if (f.tag === 'body') break;
    stops++;
    if (!f.ok) missing.push(f.tag);
    await page.keyboard.press('Tab');
  }
  expect(stops).toBeGreaterThan(20);
  expect(missing).toEqual([]);
});

test('the skip link jumps to the main content', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('a whole game can be played from the keyboard alone', async ({ page }) => {
  await ready(page);
  const link = page.getByRole('link', { name: 'Constraint Cards' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /constraint cards/i })).toBeVisible();
  // Move focus off any button so Space is the global "draw" shortcut.
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: /draw again/i })).toBeVisible();
  await page.keyboard.press('r');
  await page.keyboard.press('Backspace');
  await expect(page.getByRole('button', { name: /^keep$/i })).toBeVisible();
});

test('shortcuts: ? opens help, Escape closes it, F toggles Focus Mode', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.keyboard.press('f');
  await expect(page.locator('.app')).toHaveAttribute('data-focus', 'true');
  await expect(page.getByRole('banner')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.app')).toHaveAttribute('data-focus', 'false');
});

test('P starts and stops the band', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: /■ stop/i })).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: /▶ play/i })).toBeVisible();
});

test('T taps a tempo (with a controlled clock, so the result is exact)', async ({ page }) => {
  await page.clock.install({ time: 0 });
  await ready(page);
  // Freeze time: from here it only moves when the test says so.
  await page.clock.pauseAt(60_000);
  // Five taps, 500 ms apart: 120 BPM.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('t');
    await page.clock.runFor(500);
  }
  await expect(page.getByLabel('Beats per minute')).toHaveValue('120');
});

test('a remapped key works, so a foot pedal can drive the app', async ({ page }) => {
  await ready(page, '#/settings');
  await page.getByRole('button', { name: /change key for toggle focus mode/i }).click();
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await expect(page.locator('.app')).toHaveAttribute('data-focus', 'true');
  await page.keyboard.press('f');
  await expect(page.locator('.app')).toHaveAttribute('data-focus', 'true');
});

test('interactive controls are at least 48px (the touch-target goal)', async ({ page }) => {
  for (const hash of ['', '#/roulette', '#/settings', '#/hold-the-pulse']) {
    await ready(page, hash);
    const small = await page.evaluate(() => {
      const out: string[] = [];
      const sel = 'button, select, input:not([type=hidden]), a.btn, .game-card, summary';
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') continue;
        if (el.classList.contains('skip-link') || el.closest('.sr-only')) continue;
        const isCheck =
          el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');
        // A checkbox is operated through its 48px label row.
        const box = isCheck ? (el.closest('label') ?? el).getBoundingClientRect() : r;
        if (box.height < 47.5 || (box.width < 47.5 && !isCheck)) {
          out.push(
            `${el.tagName}.${el.className} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 24)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
          );
        }
      }
      return out;
    });
    expect(small, hash || 'home').toEqual([]);
  }
});
