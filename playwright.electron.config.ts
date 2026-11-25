import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/electron',
  timeout: 60_000,
  workers: 1,
  // On slow CI runners a real-app test that timed out is tried again before it counts as failed.
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
});
