import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/performance',
  timeout: 120_000,
  fullyParallel: false,
  reporter: [['list']],
  webServer: [
    {
      command: 'node scripts/serve-fixture.mjs',
      url: 'http://127.0.0.1:4173/fixture.html',
      reuseExistingServer: true,
    },
    {
      command:
        'pnpm --filter @translation/api exec wrangler dev --var REQUESTS_PER_MINUTE:1000 --var MOCK_TRANSLATION_DELAY_MS:1',
      url: 'http://127.0.0.1:8787/v1/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
});
