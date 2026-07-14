import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  webServer: [
    {
      command: 'node scripts/serve-fixture.mjs',
      url: 'http://127.0.0.1:4173/fixture.html',
      reuseExistingServer: true,
    },
    {
      command: 'pnpm --filter @translation/api dev',
      url: 'http://127.0.0.1:8787/v1/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
});
