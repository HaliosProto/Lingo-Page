import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';

test('recovers a partial provider batch and continues the queued page', async () => {
  test.setTimeout(45_000);
  const extensionPath = resolve('apps/extension/.output/chrome-mv3-e2e');
  test.skip(!existsSync(extensionPath), 'The E2E extension bundle has not been built.');
  const context = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), 'translation-recovery-e2e-')),
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
  const requestedIds: string[][] = [];
  let firstResponse = true;
  await context.route('**/v1/translate', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return await route.continue();
    const body = request.postDataJSON() as {
      requestId: string;
      sessionId: string;
      targetLanguage: string;
      segments: Array<{ id: string; text: string }>;
    };
    requestedIds.push(body.segments.map((segment) => segment.id));
    const returned = firstResponse ? body.segments.slice(0, 27) : body.segments;
    firstResponse = false;
    const returnedIds = new Set(returned.map((segment) => segment.id));
    const missingIds = body.segments
      .filter((segment) => !returnedIds.has(segment.id))
      .map((segment) => segment.id);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        requestId: body.requestId,
        sessionId: body.sessionId,
        providerId: 'mock',
        modelId: 'mock-deterministic',
        translations: returned.map((segment) => ({
          id: segment.id,
          translatedText: `[${body.targetLanguage}] ${segment.text}`,
        })),
        partial: missingIds.length > 0,
        recovery: {
          classification: missingIds.length > 0 ? 'valid-partial' : 'complete',
          requestedSegmentIds: body.segments.map((segment) => segment.id),
          returnedSegmentIds: returned.map((segment) => segment.id),
          missingSegmentIds: missingIds,
          duplicateSegmentIds: [],
          unknownSegmentIds: [],
          emptySegmentIds: [],
          parseFailure: false,
          responseTruncated: missingIds.length > 0,
          inputCharacters: body.segments.reduce((total, segment) => total + segment.text.length, 0),
          estimatedInputTokens: 500,
          estimatedOutputTokens: 700,
          responseBytes: 2_000,
          batchSize: body.segments.length,
        },
      }),
    });
  });

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(serviceWorker.url()).host;
    const source = await context.newPage();
    await source.goto('http://127.0.0.1:4173/fixture.html?bulk=70');
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const sourceTabId = await serviceWorker.evaluate(async () => {
      const tab = (await chrome.tabs.query({ url: 'http://127.0.0.1:4173/*' }))[0];
      if (tab?.id === undefined) throw new Error('Source fixture tab not found.');
      return tab.id;
    });
    const response = await popup.evaluate(async (tabId) => {
      return await chrome.runtime.sendMessage({
        version: 1,
        requestId: 'req_provider_recovery_e2e_12345',
        type: 'START_PAGE_TRANSLATION',
        payload: {
          tabId,
          sessionId: 'session_provider_recovery_e2e_12345',
          providerId: 'mock',
          modelId: 'mock-deterministic',
          sourceLanguage: 'en',
          targetLanguage: 'fr',
          glossaryVersion: 0,
          glossary: [],
          autoTranslateDynamicContent: false,
        },
      });
    }, sourceTabId);
    expect(response.type).toBe('TRANSLATION_PROGRESS');
    await expect(source.locator('#bulk-69')).toHaveText('[fr] Bulk section 69 remains stable.');
    const progress = await popup.evaluate(async (tabId) => {
      return await chrome.runtime.sendMessage({
        version: 1,
        requestId: 'req_provider_recovery_progress_e2e_12345',
        type: 'GET_TRANSLATION_PROGRESS',
        payload: { tabId },
      });
    }, sourceTabId);
    expect(progress).toMatchObject({
      type: 'TRANSLATION_PROGRESS',
      payload: { progress: { status: 'completed', failedSegments: 0, queuedSegments: 0 } },
    });
    expect(requestedIds[0]?.length).toBeGreaterThan(27);
    const initiallyCompleted = new Set(requestedIds[0]!.slice(0, 27));
    expect(
      requestedIds
        .slice(1)
        .flat()
        .some((id) => initiallyCompleted.has(id)),
    ).toBe(false);
    expect(new Set(requestedIds.flat()).size).toBeGreaterThan(requestedIds[0]!.length);
  } finally {
    await context.close();
  }
});

test('presents a provider outage with clear recovery actions', async () => {
  test.setTimeout(30_000);
  const extensionPath = resolve('apps/extension/.output/chrome-mv3-e2e');
  test.skip(!existsSync(extensionPath), 'The E2E extension bundle has not been built.');
  const context = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), 'translation-provider-error-e2e-')),
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
  let releaseOutage = () => {};
  const outageGate = new Promise<void>((resolveGate) => {
    releaseOutage = resolveGate;
  });
  await context.route('**/v1/translate', async (route) => {
    const body = route.request().postDataJSON() as { requestId: string };
    await outageGate;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Synthetic provider outage.',
          retryable: true,
          requestId: body.requestId,
          details: { source: 'provider', providerId: 'mock', httpStatus: 503 },
        },
      }),
    });
  });

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(serviceWorker.url()).host;
    const fixture = await context.newPage();
    await fixture.goto('http://127.0.0.1:4173/fixture.html');
    const popup = await context.newPage();
    await fixture.bringToFront();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await fixture.bringToFront();
    await popup.reload();

    await popup.getByRole('button', { name: 'Translate page' }).click();
    await expect(popup.getByRole('button', { name: 'Cancel' })).toBeVisible();
    if (process.env.CAPTURE_MILESTONE_1_SCREENSHOTS === '1') {
      const screenshotRoot = resolve('artifacts/milestone-1-visual-baseline');
      mkdirSync(screenshotRoot, { recursive: true });
      await popup.screenshot({
        path: join(screenshotRoot, 'translation-in-progress.png'),
        fullPage: true,
      });
    }
    releaseOutage();
    const outage = popup.getByRole('alert').filter({ hasText: 'Mock is temporarily unavailable.' });
    await expect(outage).toBeVisible();
    await expect(outage.getByRole('button', { name: 'Retry', exact: true })).toHaveClass(
      /ui-button--primary/u,
    );
    await expect(outage.getByText('Technical details')).toBeVisible();
    expect(
      await popup.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);

    if (process.env.CAPTURE_MILESTONE_1_SCREENSHOTS === '1') {
      const screenshotRoot = resolve('artifacts/milestone-1-visual-baseline');
      mkdirSync(screenshotRoot, { recursive: true });
      await popup.screenshot({
        path: join(screenshotRoot, 'provider-error.png'),
        fullPage: true,
      });
    }
  } finally {
    releaseOutage();
    await context.close();
  }
});
