import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** End-to-end smoke tests run against the production build, served the way Pages serves it. */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/solo-jam-room/`,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/solo-jam-room/`,
    // Always build and serve fresh: a stale server would test an old build.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
