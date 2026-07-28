import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test, type Page } from '@playwright/test';

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

test('reconstructs a reloaded session with zero calls and rejects stale SPA work', async () => {
  test.setTimeout(60_000);
  const extensionPath = resolve('apps/extension/.output/chrome-mv3-e2e');
  test.skip(!existsSync(extensionPath), 'The E2E extension bundle has not been built.');

  const context = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), 'translation-lifecycle-e2e-')),
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
  const runtimeErrors: string[] = [];
  const screenshotRoot = resolve('artifacts/milestone-2-visual-baseline');
  mkdirSync(screenshotRoot, { recursive: true });
  let providerCalls = 0;
  context.on('request', (request) => {
    if (new URL(request.url()).pathname === '/v1/translate') providerCalls += 1;
  });
  context.on('page', (page) => {
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
  });

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    serviceWorker.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    const extensionId = new URL(serviceWorker.url()).host;
    const fixture = await context.newPage();
    await fixture.goto('http://127.0.0.1:4173/fixture.html');
    await fixture.bringToFront();
    const tabId = await serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error('Fixture tab was unavailable.');
      return tab.id;
    });
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    const start = await commandForTab(popup, tabId, {
      version: 1,
      requestId: 'req_lifecycle_start_12345',
      type: 'START_PAGE_TRANSLATION',
      payload: {
        sessionId: 'session_lifecycle_12345',
        providerId: 'mock',
        modelId: 'mock-deterministic',
        sourceLanguage: 'auto',
        targetLanguage: 'fa',
        glossaryVersion: 0,
        glossary: [],
        autoTranslateDynamicContent: false,
        restartRecoveryEnabled: true,
      },
    });
    expect(start).toMatchObject({ type: 'TRANSLATION_PROGRESS' });
    await expect(fixture.locator('#heading')).toHaveText('[fa] Stable fixture heading');
    await fixture.bringToFront();
    await popup.reload();
    await expect(popup.getByText('Translation available')).toBeVisible();
    await expect
      .poll(() =>
        serviceWorker.evaluate(async () => {
          const key = 'translationRecovery:session_lifecycle_12345';
          const stored = await chrome.storage.local.get(key);
          return stored[key]?.lifecycle;
        }),
      )
      .toBe('complete');
    const callsBeforeReload = providerCalls;

    await fixture.reload();
    await popup.reload();
    await expect(fixture.locator('#heading')).toHaveText('[fa] Stable fixture heading');
    await expect(popup.getByText('Session recovered', { exact: true })).toBeVisible();
    await expect(popup.getByText(/without contacting a provider/u)).toBeVisible();
    await popup.screenshot({ path: join(screenshotRoot, 'session-recovered.png'), fullPage: true });
    expect(providerCalls).toBe(callsBeforeReload);

    await fixture.evaluate(() => {
      (
        window as typeof window & { replaceMainWithCompatibleHydration(): void }
      ).replaceMainWithCompatibleHydration();
    });
    await expect(fixture.locator('main[data-hydrated="true"]')).toBeVisible();
    await expect(fixture.locator('#heading')).toHaveText('[fa] Stable fixture heading');
    await fixture.screenshot({
      path: join(screenshotRoot, 'hydration-rebound.png'),
      fullPage: false,
    });
    expect(providerCalls).toBe(callsBeforeReload);

    const mutationStart = Date.now();
    await fixture.evaluate(() => {
      (window as typeof window & { addMutationStorm(count: number): void }).addMutationStorm(600);
    });
    await expect(fixture.locator('[data-storm]')).toHaveCount(600);
    expect(Date.now() - mutationStart).toBeLessThan(5_000);

    await fixture.evaluate(() => {
      (
        window as typeof window & { navigateFixtureRoute(route: string): void }
      ).navigateFixtureRoute('settings');
    });
    await expect(fixture.locator('#route-heading')).toHaveText(
      'Route settings has a new content identity.',
    );
    await fixture.waitForTimeout(400);
    await popup.reload();
    await expect(fixture.locator('#route-heading')).not.toContainText('[fa]');
    await expect(
      popup.getByText(/page changed|does not match this page|No active translation/iu).first(),
    ).toBeVisible();
    await popup.screenshot({
      path: join(screenshotRoot, 'spa-navigation-stale.png'),
      fullPage: true,
    });
    expect(providerCalls).toBe(callsBeforeReload);
    expect(runtimeErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('reattaches a Chrome-restored tab with a new ID and zero provider calls', async () => {
  test.setTimeout(60_000);
  const extensionPath = resolve('apps/extension/.output/chrome-mv3-e2e');
  test.skip(!existsSync(extensionPath), 'The E2E extension bundle has not been built.');

  const context = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), 'translation-restored-tab-e2e-')),
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
  let providerCalls = 0;
  const runtimeErrors: string[] = [];
  context.on('request', (request) => {
    if (new URL(request.url()).pathname === '/v1/translate') providerCalls += 1;
  });
  context.on('page', (page) => {
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
  });

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    serviceWorker.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    const extensionId = new URL(serviceWorker.url()).host;
    const fixture = await context.newPage();
    await fixture.goto('http://127.0.0.1:4173/fixture.html');
    await fixture.bringToFront();
    const originalTabId = await serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error('Fixture tab was unavailable.');
      return tab.id;
    });
    const control = await context.newPage();
    await control.goto(`chrome-extension://${extensionId}/popup.html`);
    const sessionId = 'session_restored_tab_12345';
    const started = await commandForTab(control, originalTabId, {
      version: 1,
      requestId: 'req_restored_start_12345',
      type: 'START_PAGE_TRANSLATION',
      payload: {
        sessionId,
        providerId: 'mock',
        modelId: 'mock-deterministic',
        sourceLanguage: 'auto',
        targetLanguage: 'fa',
        glossaryVersion: 0,
        glossary: [],
        autoTranslateDynamicContent: false,
        restartRecoveryEnabled: true,
      },
    });
    expect(started).toMatchObject({ type: 'TRANSLATION_PROGRESS' });
    await expect(fixture.locator('#heading')).toHaveText('[fa] Stable fixture heading');
    const callsAfterTranslation = providerCalls;

    const manualSameUrl = await context.newPage();
    await manualSameUrl.goto('http://127.0.0.1:4173/fixture.html');
    await expect(manualSameUrl.locator('#heading')).toHaveText('Stable fixture heading');
    await manualSameUrl.waitForTimeout(300);
    await expect(manualSameUrl.locator('#heading')).toHaveText('Stable fixture heading');
    await manualSameUrl.goto('about:blank');
    await manualSameUrl.close();

    await fixture.close();
    await control.waitForTimeout(500);
    const detachedState = await serviceWorker.evaluate(async (key) => {
      const stored = await chrome.storage.local.get(key);
      const recentlyClosed = await chrome.sessions.getRecentlyClosed({ maxResults: 5 });
      return { record: stored[key], recentlyClosed };
    }, `translationRecovery:${sessionId}`);
    expect(
      detachedState.record?.claim?.state,
      JSON.stringify({ detachedState, runtimeErrors }),
    ).toBe('orphaned');

    const restoredPagePromise = context.waitForEvent('page');
    await serviceWorker.evaluate(async () => {
      await chrome.sessions.restore();
    });
    const restored = await restoredPagePromise;
    await restored.waitForLoadState('domcontentloaded');
    await control.waitForTimeout(1_000);
    const restoredDiagnostic = await serviceWorker.evaluate(async (key) => {
      const stored = await chrome.storage.local.get(key);
      const tabs = await chrome.tabs.query({});
      const permission = await chrome.permissions.contains({
        origins: ['http://127.0.0.1/*'],
      });
      const sessionStorage = await chrome.storage.session.get(null);
      const recentlyClosed = await chrome.sessions.getRecentlyClosed({ maxResults: 5 });
      return {
        record: stored[key],
        permission,
        recentlyClosed,
        sessionStorage,
        tabs: tabs.map((tab) => ({ id: tab.id, url: tab.url })),
      };
    }, `translationRecovery:${sessionId}`);
    expect(
      restoredDiagnostic.record?.claim?.state,
      JSON.stringify({ restoredDiagnostic, runtimeErrors }),
    ).toBe('owned');
    await expect(restored.locator('#heading')).toHaveText('[fa] Stable fixture heading');
    const restoredTabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      const tab = tabs.find((candidate) => candidate.id !== undefined);
      if (tab?.id === undefined) throw new Error('Restored fixture tab was unavailable.');
      return tab.id;
    }, 'http://127.0.0.1:4173/fixture.html');
    expect(restoredTabId).not.toBe(originalTabId);
    expect(providerCalls).toBe(callsAfterTranslation);

    await commandForTab(control, restoredTabId, {
      version: 1,
      requestId: 'req_restored_original_12345',
      type: 'SET_PAGE_VIEW',
      payload: { sessionId, displayMode: 'original' },
    });
    await expect(restored.locator('#heading')).toHaveText('Stable fixture heading');
    await commandForTab(control, restoredTabId, {
      version: 1,
      requestId: 'req_restored_translated_12345',
      type: 'SET_PAGE_VIEW',
      payload: { sessionId, displayMode: 'translated' },
    });
    await expect(restored.locator('#heading')).toHaveText('[fa] Stable fixture heading');
    expect(providerCalls).toBe(callsAfterTranslation);
    expect(runtimeErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
