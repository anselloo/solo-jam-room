import { expect, test, type Page } from '@playwright/test';

/**
 * Runs the real Web Audio engine in Chromium. An analyser is tapped onto the destination so we can
 * measure what the player would actually hear, and the context clock is exposed for timing checks.
 */
test.describe.configure({ mode: 'serial' });

async function tapAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const Original = window.AudioContext;
    w.__peaks = [] as number[];
    class Tapped extends Original {
      constructor(opts?: AudioContextOptions) {
        super(opts);
        w.__ctx = this;
        const analyser = this.createAnalyser();
        analyser.fftSize = 2048;
        w.__analyser = analyser;
        const orig = AudioNode.prototype.connect as (this: AudioNode, ...a: unknown[]) => unknown;
        const destination = this.destination;
        AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
          const result = orig.apply(this, args);
          if (args[0] === destination && this !== analyser) orig.call(this, analyser);
          return result;
        } as typeof AudioNode.prototype.connect;
        // Sample the output regularly so short sounds are not missed.
        setInterval(() => {
          const buf = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v));
          (w.__peaks as number[]).push(peak);
        }, 20);
      }
    }
    window.AudioContext = Tapped as unknown as typeof AudioContext;
  });
}

const state = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __ctx?: AudioContext; __peaks: number[] };
    return { running: w.__ctx?.state, time: w.__ctx?.currentTime ?? 0, peaks: [...w.__peaks] };
  });

async function onboard(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: /skip for now/i }).click();
}

test('the backing band makes real, unclipped sound and the audio clock keeps running', async ({
  page,
}) => {
  await tapAudio(page);
  await onboard(page);
  await page.getByRole('button', { name: /▶ play/i }).click();
  await expect.poll(async () => (await state(page)).running).toBe('running');
  // Count-in is one bar of click, then the band joins.
  await page.waitForTimeout(6500);
  const s = await state(page);
  expect(s.time).toBeGreaterThan(5);
  const max = Math.max(...s.peaks);
  const loud = s.peaks.filter((p) => p > 0.02).length;
  expect(max, 'the output should not be silent').toBeGreaterThan(0.05);
  expect(max, 'the output should not clip').toBeLessThanOrEqual(1);
  expect(loud, 'sound should be frequent, not a single blip').toBeGreaterThan(20);
});

test('muting the master silences the output', async ({ page }) => {
  await tapAudio(page);
  await onboard(page);
  await page.getByRole('button', { name: /▶ play/i }).click();
  await expect.poll(async () => (await state(page)).running).toBe('running');
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: /sound on/i }).click();
  await page.waitForTimeout(400); // let the short fade finish
  const before = (await state(page)).peaks.length;
  await page.waitForTimeout(2500);
  const after = (await state(page)).peaks.slice(before);
  expect(after.length).toBeGreaterThan(50);
  expect(Math.max(...after)).toBeLessThan(0.005);
});

test('Jam Roulette plays the band at the dealt tempo, with the click on the beat', async ({
  page,
}) => {
  await tapAudio(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Jam Roulette' }).click();
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Result')).toBeVisible({ timeout: 5_000 });
  const bpmText = await page.getByLabel('Result').locator('.chip').first().textContent();
  const bpm = Number(/(\d+) BPM/.exec(bpmText ?? '')?.[1]);
  expect(bpm).toBeGreaterThanOrEqual(70);
  expect(bpm).toBeLessThanOrEqual(110);
  // The dock must show the dealt tempo (not the previous one): the stale-tempo bug regression.
  await page
    .getByLabel('Result')
    .locator('..')
    .getByRole('button', { name: /▶ play/i })
    .first()
    .click();
  await expect(page.getByLabel('Beats per minute')).toHaveValue(String(bpm));
  await expect.poll(async () => (await state(page)).running).toBe('running');
  await page.waitForTimeout(4000);
  expect((await state(page)).time).toBeGreaterThan(3);
});
