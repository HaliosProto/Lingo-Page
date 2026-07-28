import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';

type RuntimeCommand = {
  version: 1;
  requestId: string;
  type: string;
  payload: Record<string, unknown>;
};

async function commandForTab(control: Page, tabId: number, command: RuntimeCommand) {
  return control.evaluate(
    async ({ command, tabId }) =>
      chrome.runtime.sendMessage({
        ...command,
        payload: { ...command.payload, tabId },
      }),
    { command, tabId },
  );
}

async function activeTabId(context: BrowserContext): Promise<number> {
  const serviceWorker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('Active fixture tab not found.');
    return tab.id;
  });
}

test('keeps cached translations visible after delayed destination hydration', async () => {
  test.setTimeout(45_000);
  const extensionPath = resolve('apps/extension/.output/chrome-mv3-e2e');
  test.skip(!existsSync(extensionPath), 'The E2E extension bundle has not been built.');

  const context = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), 'translation-copy-e2e-')),
    {
      headless: true,
      channel: 'chromium',
      executablePath:
        process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)
          ? process.env.CHROME_PATH
          : undefined,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        '--enable-unsafe-extension-debugging',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    },
  );
  let translationRequestCount = 0;
  const runtimeErrors: string[] = [];
  const observedLogs: string[] = [];
  context.on('request', (request) => {
    if (new URL(request.url()).pathname === '/v1/translate') translationRequestCount += 1;
  });
  context.on('page', (page) => {
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      observedLogs.push(message.text());
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
  });

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    serviceWorker.on('console', (message) => {
      observedLogs.push(message.text());
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    const extensionId = new URL(serviceWorker.url()).host;
    const source = await context.newPage();
    await source.goto('http://127.0.0.1:4173/fixture.html?hydrateDelay=900');
    await expect(source.locator('main[data-hydrated="true"]')).toBeAttached();
    await source.keyboard.press('Alt+Shift+L');
    await source.bringToFront();
    const sourceTabId = await activeTabId(context);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    const startResponse = await commandForTab(popup, sourceTabId, {
      version: 1,
      requestId: 'req_copy_hydration_start_12345',
      type: 'START_PAGE_TRANSLATION',
      payload: {
        sessionId: 'session_copy_hydration_12345',
        providerId: 'mock',
        modelId: 'mock-deterministic',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        glossaryVersion: 0,
        glossary: [],
        autoTranslateDynamicContent: false,
      },
    });
    expect(startResponse).toMatchObject({ type: 'TRANSLATION_PROGRESS' });
    await expect(source.locator('#heading')).toHaveText('[fr] Stable fixture heading');

    const exported = await popup.evaluate(
      async ({ tabId, sessionId }) => {
        return chrome.tabs.sendMessage(tabId, {
          version: 1,
          requestId: 'req_copy_hydration_export_12345',
          type: 'EXPORT_SESSION_BUNDLE',
          payload: { sessionId },
        });
      },
      { tabId: sourceTabId, sessionId: 'session_copy_hydration_12345' },
    );
    expect(exported.type).toBe('SESSION_BUNDLE');
    expect(
      exported.payload.bundle.segments.some((segment: { translatedText?: string }) =>
        segment.translatedText?.startsWith('[fr]'),
      ),
    ).toBe(true);

    const requestsBeforeCopy = translationRequestCount;
    await source.bringToFront();
    await popup.reload();
    await expect(
      popup.getByText(
        'Lingo Page needs access to this site to open an automatically translated copy.',
      ),
    ).toBeVisible();

    const destinationPromise = context.waitForEvent('page');
    await popup.getByRole('button', { name: 'Open translated copy', exact: true }).click();
    const destination = await destinationPromise;
    await expect(destination.locator('#lingo-page-copy-status')).toHaveAttribute(
      'data-copy-status',
      'applying',
    );
    const pendingHandoff = await serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error('Destination tab not found.');
      const stored = await chrome.storage.session.get(null);
      const index = stored[`translatedCopyTab:${tab.id}`];
      const bundleKeys = Object.keys(stored).filter((key) =>
        key.startsWith('translatedCopyHandoff:'),
      );
      return { tabId: tab.id, index, bundleKeys };
    });
    expect(pendingHandoff.index).toMatchObject({ status: 'pending' });
    expect(pendingHandoff.bundleKeys).toHaveLength(1);
    await expect(destination.locator('main[data-hydrated="true"]')).toBeAttached();
    await expect(destination.locator('#heading')).toHaveText('[fr] Stable fixture heading');
    await expect(destination.locator('#lingo-page-copy-status')).toHaveAttribute(
      'data-copy-status',
      'ready',
    );
    await expect(
      popup.getByRole('button', { name: 'Open translated copy', exact: true }),
    ).toBeEnabled();
    expect(translationRequestCount).toBe(requestsBeforeCopy);

    const destinationProgress = await commandForTab(popup, pendingHandoff.tabId, {
      version: 1,
      requestId: 'req_copy_hydration_progress_12345',
      type: 'GET_TRANSLATION_PROGRESS',
      payload: {},
    });
    expect(destinationProgress).toMatchObject({
      type: 'TRANSLATION_PROGRESS',
      payload: {
        progress: {
          displayMode: 'translated',
          translatedCopy: {
            status: 'ready',
            matchedSegments: expect.any(Number),
            providerRequests: 0,
          },
        },
      },
    });
    const translatedCopyProgress = destinationProgress.payload.progress.translatedCopy;
    expect(translatedCopyProgress.appliedSegments).toBe(translatedCopyProgress.matchedSegments);
    expect(translatedCopyProgress.changedSegments).toBeGreaterThan(0);
    const destinationSessionId = destinationProgress.payload.progress.sessionId;
    await commandForTab(popup, pendingHandoff.tabId, {
      version: 1,
      requestId: 'req_copy_hydration_original_12345',
      type: 'SET_PAGE_VIEW',
      payload: { sessionId: destinationSessionId, displayMode: 'original' },
    });
    await expect(destination.locator('#heading')).toHaveText('Stable fixture heading');
    await commandForTab(popup, pendingHandoff.tabId, {
      version: 1,
      requestId: 'req_copy_hydration_translated_12345',
      type: 'SET_PAGE_VIEW',
      payload: { sessionId: destinationSessionId, displayMode: 'translated' },
    });
    await expect(destination.locator('#heading')).toHaveText('[fr] Stable fixture heading');
    expect(translationRequestCount).toBe(requestsBeforeCopy);

    await serviceWorker.evaluate(async (tabId) => {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['/page-shell.js'] });
    }, pendingHandoff.tabId);
    await expect(destination.locator('#lingo-page-copy-status')).toHaveCount(1);
    await expect(destination.locator('#heading')).toHaveText('[fr] Stable fixture heading');

    await destination.bringToFront();
    await popup.reload();
    await expect(popup.locator('[data-translated-copy-status="ready"]')).toContainText(
      `${translatedCopyProgress.matchedSegments} reused`,
    );
    await expect(popup.getByRole('group', { name: 'Page view' })).toBeVisible();

    if (process.env.CAPTURE_MILESTONE_1_SCREENSHOTS === '1') {
      const screenshotRoot = resolve('artifacts/milestone-1-visual-baseline');
      mkdirSync(screenshotRoot, { recursive: true });
      await destination.screenshot({
        path: join(screenshotRoot, 'translated-copy-hydrated.png'),
        fullPage: false,
      });
    }

    await destination.close();
    await expect(source.locator('#heading')).toHaveText('[fr] Stable fixture heading');
    expect(translationRequestCount).toBe(requestsBeforeCopy);
    expect(runtimeErrors).toEqual([]);
    expect(observedLogs.some((message) => message.includes('Stable fixture heading'))).toBe(false);
  } finally {
    await context.close();
  }
});

test('explains recovery when translated-copy site access is denied', async () => {
  test.setTimeout(30_000);
  const extensionPath = resolve('apps/extension/.output/chrome-mv3-e2e');
  test.skip(!existsSync(extensionPath), 'The E2E extension bundle has not been built.');

  const context = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), 'translation-copy-denial-e2e-')),
    {
      headless: true,
      channel: 'chromium',
      executablePath:
        process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)
          ? process.env.CHROME_PATH
          : undefined,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        '--enable-unsafe-extension-debugging',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    },
  );

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(serviceWorker.url()).host;
    const source = await context.newPage();
    await source.goto('http://127.0.0.1:4173/fixture.html');
    await source.keyboard.press('Alt+Shift+L');
    await source.bringToFront();
    const sourceTabId = await activeTabId(context);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    const denialStartResponse = await commandForTab(popup, sourceTabId, {
      version: 1,
      requestId: 'req_copy_denial_start_12345',
      type: 'START_PAGE_TRANSLATION',
      payload: {
        sessionId: 'session_copy_denial_12345',
        providerId: 'mock',
        modelId: 'mock-deterministic',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        glossaryVersion: 0,
        glossary: [],
        autoTranslateDynamicContent: false,
      },
    });
    expect(denialStartResponse).toMatchObject({ type: 'TRANSLATION_PROGRESS' });
    await expect(source.locator('#heading')).toHaveText('[fr] Stable fixture heading');

    await source.bringToFront();
    await popup.reload();
    await expect(
      popup.getByText(
        'Lingo Page needs access to this site to open an automatically translated copy.',
      ),
    ).toBeVisible();
    await popup.evaluate(() => {
      Object.defineProperty(chrome.permissions, 'request', {
        configurable: true,
        value: async () => false,
      });
    });
    await popup.getByRole('button', { name: 'Open translated copy', exact: true }).click();
    await expect(
      popup.getByText(
        'Site access was not granted. You can duplicate this tab and invoke Lingo Page manually there.',
      ),
    ).toBeVisible();

    if (process.env.CAPTURE_MILESTONE_1_SCREENSHOTS === '1') {
      const screenshotRoot = resolve('artifacts/milestone-1-visual-baseline');
      mkdirSync(screenshotRoot, { recursive: true });
      await popup.screenshot({
        path: join(screenshotRoot, 'translated-copy-permission-denied.png'),
        fullPage: true,
      });
    }
  } finally {
    await context.close();
  }
});
