import { expect, test } from '@playwright/test';

test('works with no signal after the first load', async ({ page, context }) => {
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
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Solo Jam Room', level: 1 })).toBeVisible();

  // Wait for the service worker to install, precache everything and take control.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names[0]);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached.some((p) => p.endsWith('/index.html'))).toBe(true);
  expect(cached.some((p) => /\/assets\/index-.*\.js$/.test(p))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Solo Jam Room', level: 1 })).toBeVisible();

  // A game still works offline, including its data and the chord theory.
  await page.getByRole('link', { name: 'Chord Dealer' }).click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('list', { name: /chord progression/i })).toBeVisible();
  await context.setOffline(false);
});

test('serves a valid web app manifest with working icons', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifestUrl = new URL(href!, page.url()).href;
  const res = await request.get(manifestUrl);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.name).toBe('Solo Jam Room');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBeTruthy();
  const sizes = m.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}:${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
  for (const icon of m.icons) {
    const r = await request.get(new URL(icon.src, manifestUrl).href);
    expect(r.ok(), icon.src).toBe(true);
    expect(r.headers()['content-type']).toContain(icon.type);
  }
});
