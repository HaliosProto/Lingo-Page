import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
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

test('translates, explains exclusions and cancellation, continues pending work, restores, and supports selection', async () => {
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
    await fixture.bringToFront();
    await popup.reload();

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
        providerId: 'mock',
        modelId: 'mock-deterministic',
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
    await expect(
      popup.getByText(
        'Some content could not be translated because it is inside protected frames, images, canvas elements, or browser-restricted areas.',
      ),
    ).toBeVisible();
    await expect(
      popup.getByText(
        'Some content was skipped for privacy or safety, such as passwords, payment fields, editable inputs, hidden text, or excluded page regions.',
      ),
    ).toBeVisible();

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

    await fixture.evaluate(() => window.addBulkText(1_000));
    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_partial_start_12345',
      type: 'START_PAGE_TRANSLATION',
      payload: {
        sessionId: 'session_e2e_partial_12345',
        providerId: 'mock',
        modelId: 'mock-deterministic',
        sourceLanguage: 'auto',
        targetLanguage: 'de',
        glossaryVersion: 0,
        glossary: [],
        autoTranslateDynamicContent: false,
      },
    });
    await expect(fixture.locator('#bulk-0')).toHaveText('[de] Bulk section 0 remains stable.');
    const cancelResponse = await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_partial_cancel_12345',
      type: 'CANCEL_PAGE_TRANSLATION',
      payload: { sessionId: 'session_e2e_partial_12345' },
    });
    expect(cancelResponse).toMatchObject({
      type: 'TRANSLATION_PROGRESS',
      payload: { progress: { status: 'cancelled' } },
    });
    const partialProgress = (await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_partial_progress_12345',
      type: 'GET_TRANSLATION_PROGRESS',
      payload: {},
    })) as {
      payload: { progress: { translatedSegments: number; discoveredSegments: number } };
    };
    expect(partialProgress.payload.progress.translatedSegments).toBeGreaterThan(0);
    expect(partialProgress.payload.progress.translatedSegments).toBeLessThan(
      partialProgress.payload.progress.discoveredSegments,
    );
    await expect(fixture.locator('#bulk-0')).toHaveText('[de] Bulk section 0 remains stable.');
    await expect(
      popup.getByText(/^Translation was cancelled\. \d+ of \d+ sections/u),
    ).toBeVisible();

    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_continue_12345',
      type: 'CONTINUE_PAGE_TRANSLATION',
      payload: {
        sessionId: 'session_e2e_partial_12345',
        providerId: 'mock',
        modelId: 'mock-deterministic',
        useSmallerBatches: false,
      },
    });
    await expect(fixture.locator('#bulk-999')).toHaveText('[de] Bulk section 999 remains stable.');
    await expect(fixture.locator('#bulk-0')).toHaveText('[de] Bulk section 0 remains stable.');
    const completedProgress = (await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_completed_progress_12345',
      type: 'GET_TRANSLATION_PROGRESS',
      payload: {},
    })) as { payload: { progress: { status: string; failedSegments: number } } };
    expect(completedProgress.payload.progress).toMatchObject({
      status: 'completed',
      failedSegments: 0,
    });

    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_selection_12345',
      type: 'TRANSLATE_SELECTION',
      payload: { text: 'Selected sentence' },
    });
    await expect(fixture.locator('#lingo-page-selection-result')).toBeAttached();

    await expect(popup.getByRole('heading', { name: 'Lingo Page' })).toBeVisible();
    await expect(popup.getByText(/Mock - local backend/u)).toBeVisible();

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.getByRole('heading', { name: 'Translation settings' })).toBeVisible();
    await expect(options.getByText('Privacy and page behavior')).toBeVisible();

    if (process.env.CAPTURE_BASELINE_SCREENSHOTS === '1') {
      const screenshotRoot = resolve('artifacts/milestone-0-visual-baseline');
      mkdirSync(screenshotRoot, { recursive: true });
      await popup.setViewportSize({ width: 360, height: 700 });
      await popup.screenshot({ path: join(screenshotRoot, 'popup.png'), fullPage: true });
      await options.setViewportSize({ width: 1024, height: 900 });
      await options.screenshot({ path: join(screenshotRoot, 'options.png'), fullPage: true });
      await fixture.setViewportSize({ width: 1280, height: 720 });
      await fixture.screenshot({
        path: join(screenshotRoot, 'selected-text-result.png'),
        fullPage: false,
      });
    }
  } finally {
    await context.close();
  }
});

declare global {
  interface Window {
    addDynamicText(): void;
    addBulkText(count: number): void;
  }
}
