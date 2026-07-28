import { defineConfig } from '@playwright/test';

const apiPort = /^\d{2,5}$/u.test(process.env.E2E_API_PORT ?? '')
  ? process.env.E2E_API_PORT!
  : '8787';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  webServer: [
    {
      command: 'node scripts/serve-fixture.mjs',
      url: 'http://127.0.0.1:4173/fixture.html',
      reuseExistingServer: true,
    },
    {
      command: `pnpm --filter @translation/api exec wrangler dev --port ${apiPort} --var REQUESTS_PER_MINUTE:1000`,
      url: `http://127.0.0.1:${apiPort}/v1/health`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
});
