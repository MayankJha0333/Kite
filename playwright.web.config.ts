import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  // Hosted CI runners are three to four times slower than a laptop: fewer tests at once, and a
  // test that only fails under that load is tried again (it then counts as flaky, not failed).
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174/',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
