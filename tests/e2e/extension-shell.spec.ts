import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, expect, chromium, type Page } from '@playwright/test';

type RuntimeCommand = {
  version: 1;
  requestId: string;
  type: string;
  payload: Record<string, unknown>;
};

async function commandForFixture(control: Page, tabId: number, command: RuntimeCommand) {
  return control.evaluate(
    async ({ command, tabId }) => {
      const payload = { ...command.payload, tabId };
      return chrome.runtime.sendMessage({ ...command, payload });
    },
    { command, tabId },
  );
}

test('translates, updates dynamic content, restores exactly, and supports selection', async () => {
  test.setTimeout(90_000);
  const extensionPath = resolve('apps/extension/.output/chrome-mv3-e2e');
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
    const extensionId = new URL(serviceWorker.url()).host;
    const fixture = await context.newPage();
    await fixture.goto('http://127.0.0.1:4173/fixture.html');
    await fixture.keyboard.press('Alt+Shift+L');
    await fixture.bringToFront();
    const fixtureTabId = await serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error('Active fixture tab not found.');
      return tab.id;
    });
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    const original = {
      heading: await fixture.locator('#heading').textContent(),
      paragraph: await fixture.locator('#paragraph').textContent(),
      whitespace: await fixture.locator('#whitespace').textContent(),
    };
    expect(original.heading).toBe('Stable fixture heading');

    const startResponse = await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_start_12345',
      type: 'START_PAGE_TRANSLATION',
      payload: {
        sessionId: 'session_e2e_page_12345',
        sourceLanguage: 'auto',
        targetLanguage: 'fa',
        glossaryVersion: 0,
        glossary: [],
        autoTranslateDynamicContent: true,
      },
    });
    expect(startResponse).toMatchObject({ type: 'TRANSLATION_PROGRESS' });

    await expect(fixture.locator('#heading')).toHaveText('[fa] Stable fixture heading');
    await expect(fixture.locator('#paragraph')).toContainText('[fa] This page changes');
    await expect(fixture.locator('#notranslate')).toHaveText('ProductName must stay unchanged.');
    await expect(fixture.locator('#code')).toHaveText('const doNotTranslate = true;');
    await expect(fixture.locator('#account')).toHaveValue('1234 5678 9012');

    await fixture.evaluate(() => window.addDynamicText());
    await expect(fixture.locator('#dynamic-paragraph')).toHaveText(
      '[fa] New content arrived after initial translation.',
    );

    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_restore_12345',
      type: 'RESTORE_PAGE',
      payload: {},
    });
    await expect(fixture.locator('#heading')).toHaveText(original.heading!);
    await expect(fixture.locator('#paragraph')).toHaveText(original.paragraph!);
    expect(await fixture.locator('#whitespace').textContent()).toBe(original.whitespace);

    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_cancel_start_12345',
      type: 'START_PAGE_TRANSLATION',
      payload: {
        sessionId: 'session_e2e_cancel_12345',
        sourceLanguage: 'auto',
        targetLanguage: 'de',
        glossaryVersion: 0,
        glossary: [],
        autoTranslateDynamicContent: false,
      },
    });
    const cancelResponse = await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_cancel_12345',
      type: 'CANCEL_PAGE_TRANSLATION',
      payload: { sessionId: 'session_e2e_cancel_12345' },
    });
    expect(cancelResponse).toMatchObject({
      type: 'TRANSLATION_PROGRESS',
      payload: { progress: { status: 'cancelled' } },
    });
    await expect(fixture.locator('#heading')).toHaveText(original.heading!);

    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_selection_12345',
      type: 'TRANSLATE_SELECTION',
      payload: { text: 'Selected sentence' },
    });
    await expect(fixture.locator('#lingo-page-selection-result')).toBeAttached();

    await expect(popup.getByRole('heading', { name: 'Lingo Page' })).toBeVisible();
    await expect(popup.getByText(/Mock mode - local backend/u)).toBeVisible();

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.getByRole('heading', { name: 'Translation settings' })).toBeVisible();
    await expect(options.getByText('Privacy and page behavior')).toBeVisible();
  } finally {
    await context.close();
  }
});

declare global {
  interface Window {
    addDynamicText(): void;
  }
}
