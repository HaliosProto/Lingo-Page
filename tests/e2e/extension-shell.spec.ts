import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, expect, chromium } from '@playwright/test';

test('loads the unpacked extension shell without modifying page text', async () => {
  test.setTimeout(60_000);
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  test.skip(!existsSync(extensionPath), 'The production extension bundle has not been built.');

  const userDataDir = mkdtempSync(join(tmpdir(), 'translation-extension-e2e-'));
  const executablePath = process.env.CHROME_PATH;
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: 'chromium',
    executablePath: executablePath && existsSync(executablePath) ? executablePath : undefined,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--enable-unsafe-extension-debugging',
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    expect(serviceWorker.url()).toContain('chrome-extension://');
    const extensionId = new URL(serviceWorker.url()).host;

    const fixture = await context.newPage();
    await fixture.goto('http://127.0.0.1:4173/fixture.html');
    const originalHeading = await fixture.locator('h1').innerText();
    const originalParagraph = await fixture.locator('p').innerText();

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByRole('heading', { name: 'Lingo Page' })).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Translate Page' })).toBeDisabled();
    await expect(popup.getByText('Backend connected')).toBeVisible();

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.getByRole('heading', { name: 'Settings' })).toBeVisible();

    expect(await fixture.locator('h1').innerText()).toBe(originalHeading);
    expect(await fixture.locator('p').innerText()).toBe(originalParagraph);
  } finally {
    await context.close();
  }
});
