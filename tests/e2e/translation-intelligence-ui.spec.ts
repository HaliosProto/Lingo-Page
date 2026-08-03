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
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('Active fixture tab not found.');
    return tab.id;
  });
}

test('configures structured preferences and exposes bounded quality review states', async () => {
  test.setTimeout(60_000);
  const extensionPath = resolve('apps/extension/.output/chrome-mv3-e2e');
  test.skip(!existsSync(extensionPath), 'The E2E extension bundle has not been built.');
  const evidencePath = resolve('artifacts/milestone-3-ui');
  mkdirSync(evidencePath, { recursive: true });
  const runtimeErrors: string[] = [];
  const providerRequests: Array<{ review: boolean; segmentCount: number }> = [];
  const context = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), 'lingo-page-intelligence-ui-')),
    {
      headless: true,
      channel: 'chromium',
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        '--enable-unsafe-extension-debugging',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    },
  );

  context.on('page', (page) => {
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
  });
  await context.route('**/v1/translate', async (route) => {
    const request = route.request().postDataJSON() as {
      requestId: string;
      sessionId: string;
      review?: { segmentIds: string[] };
      segments: Array<{ id: string; text: string }>;
    };
    const review = request.review !== undefined;
    providerRequests.push({ review, segmentCount: request.segments.length });
    if (review) await new Promise((resolveDelay) => setTimeout(resolveDelay, 700));
    const translations = request.segments.map((segment) => ({
      id: segment.id,
      translatedText: review ? 'ترجمه بازبینی‌شده' : segment.text,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schemaVersion: 1,
        requestId: request.requestId,
        sessionId: request.sessionId,
        providerId: 'mock',
        modelId: 'mock-deterministic',
        detectedSourceLanguage: 'en',
        translations,
        partial: false,
        quality: {
          findings: review
            ? []
            : [
                {
                  segmentId: request.segments[0]!.id,
                  severity: 'warning',
                  reason: 'suspicious-identical-output',
                },
              ],
          reviewRequestedSegmentIds: review ? [] : [request.segments[0]!.id],
          translationProviderCalls: review ? 0 : 1,
          reviewProviderCalls: review ? 1 : 0,
        },
        ...(review
          ? {
              review: {
                pass: 1,
                decisions: request.segments.map((segment) => ({
                  segmentId: segment.id,
                  decision: 'correct',
                  correctedText: 'ترجمه بازبینی‌شده',
                })),
              },
            }
          : {}),
      }),
    });
  });

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    worker.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    const extensionId = new URL(worker.url()).host;
    const options = await context.newPage();
    await options.setViewportSize({ width: 680, height: 900 });
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.getByRole('heading', { name: 'Translation preferences' })).toBeVisible();
    const preferenceCard = options
      .locator('section')
      .filter({ has: options.getByRole('heading', { name: 'Translation preferences' }) });
    await preferenceCard.screenshot({ path: join(evidencePath, '01-default-preferences.png') });

    await options
      .getByLabel('Translation brief')
      .fill('Keep industrial safety terms concise and use formal Persian.');
    await options.getByLabel('Default target').selectOption('fa');
    await options.getByText('Advanced language and review preferences').click();
    await options.getByLabel('Tone').selectOption('formal');
    await options.getByLabel('Formality').selectOption('more');
    await options.getByLabel('Content type').selectOption('technical-documentation');
    await options.getByLabel('Audience').selectOption('expert');
    await options.getByLabel('Quality mode').selectOption('enhanced');
    await preferenceCard.screenshot({ path: join(evidencePath, '02-expanded-preferences.png') });
    await options.getByLabel('Translation brief').screenshot({
      path: join(evidencePath, '03-translation-brief.png'),
    });

    await options.getByRole('button', { name: 'Add term' }).click();
    await options.getByLabel('Source term').fill('Fisher Y692');
    await options.getByLabel('Preferred translation').fill('Fisher Y692');
    await options.getByLabel('Glossary scope').selectOption('site');
    await options.getByLabel('Site origin').fill('http://127.0.0.1:4173');
    const glossaryCard = options
      .locator('section')
      .filter({ has: options.getByRole('heading', { name: 'Personal glossary' }) });
    await glossaryCard.screenshot({ path: join(evidencePath, '04-glossary-editor.png') });

    await options.getByLabel('Theme').selectOption('dark');
    await options.getByRole('checkbox', { name: /Reduced motion/u }).check();
    await options.getByRole('button', { name: 'Save settings' }).click();
    await expect(options.getByRole('status')).toContainText(
      'Existing page translations keep their original policy',
    );
    await options.getByRole('status').screenshot({
      path: join(evidencePath, '10-policy-change-retranslation-notice.png'),
    });
    await expect(options.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(options.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await options.screenshot({
      path: join(evidencePath, '05-dark-reduced-motion.png'),
      fullPage: true,
    });

    await options.setViewportSize({ width: 390, height: 844 });
    await options.evaluate(() => {
      document.documentElement.dir = 'rtl';
      document.querySelector('main')?.setAttribute('dir', 'rtl');
    });
    const rtlLayout = await options.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(rtlLayout.scrollWidth, JSON.stringify(rtlLayout)).toBeLessThanOrEqual(
      rtlLayout.clientWidth,
    );
    await preferenceCard.screenshot({ path: join(evidencePath, '06-rtl-preferences.png') });
    await options.evaluate(() => {
      document.documentElement.dir = 'ltr';
      document.querySelector('main')?.setAttribute('dir', 'auto');
    });
    await options.setViewportSize({ width: 195, height: 422 });
    const zoomLayout = await options.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      zoomLayout.scrollWidth - zoomLayout.clientWidth,
      JSON.stringify(zoomLayout),
    ).toBeLessThanOrEqual(10);
    await preferenceCard.screenshot({ path: join(evidencePath, '11-zoom-preferences.png') });
    await options.setViewportSize({ width: 390, height: 844 });
    await options.getByRole('button', { name: 'Save settings' }).focus();
    expect(await options.evaluate(() => document.activeElement?.textContent)).toContain(
      'Save settings',
    );

    await options.reload();
    await expect(options.getByLabel('Translation brief')).toHaveValue(
      'Keep industrial safety terms concise and use formal Persian.',
    );
    await expect(options.getByLabel('Glossary scope')).toHaveValue('site');
    const stored = await worker.evaluate(async () => chrome.storage.local.get(null));
    expect(stored.appSettings.translationPolicy.style.tone).toBe('formal');
    expect(stored.appSettings.glossary[0]).toMatchObject({
      sourceTerm: 'Fisher Y692',
      scope: 'site',
      siteOrigin: 'http://127.0.0.1:4173',
    });

    const source = await context.newPage();
    await source.goto('http://127.0.0.1:4173/fixture.html');
    await source.bringToFront();
    const sourceTabId = await activeTabId(context);
    expect(sourceTabId).toBeGreaterThan(0);
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 390, height: 844 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await source.bringToFront();
    const startResponse = await commandForTab(popup, sourceTabId, {
      version: 1,
      requestId: 'req_ui_start_12345',
      type: 'START_PAGE_TRANSLATION',
      payload: {
        sessionId: 'session_ui_intelligence_12345',
        providerId: 'mock',
        modelId: 'mock-deterministic',
        sourceLanguage: 'en',
        targetLanguage: 'fa',
        glossaryVersion: stored.appSettings.glossaryVersion,
        glossary: stored.appSettings.glossary,
        policy: {
          ...stored.appSettings.translationPolicy,
          sourceLanguage: 'en',
          targetLanguage: 'fa',
        },
        autoTranslateDynamicContent: false,
        restartRecoveryEnabled: false,
      },
    });
    expect(startResponse).toMatchObject({ type: 'TRANSLATION_PROGRESS' });
    await expect(source.locator('#heading')).toHaveText('Stable fixture heading');
    await popup.reload();
    await expect(popup.getByText('Quality check found a concern')).toBeVisible();
    await expect(popup.getByText('Active policy')).toBeVisible();
    await popup.screenshot({ path: join(evidencePath, '07-active-policy-quality-warning.png') });

    await popup.getByRole('button', { name: 'Review flagged sections' }).click();
    await expect(popup.getByRole('button', { name: 'Reviewing…' })).toBeVisible();
    await popup.screenshot({ path: join(evidencePath, '08-review-in-progress.png') });
    await expect(popup.getByText('Selective review completed')).toBeVisible();
    await expect(source.locator('#heading')).toHaveText('ترجمه بازبینی‌شده');
    await popup.screenshot({ path: join(evidencePath, '09-review-completed.png') });

    expect(providerRequests).toEqual([
      { review: false, segmentCount: 5 },
      { review: true, segmentCount: 1 },
    ]);
    const progress = await popup.evaluate(async (tabId) => {
      return chrome.runtime.sendMessage({
        version: 1,
        requestId: 'req_ui_progress_12345',
        type: 'GET_TRANSLATION_PROGRESS',
        payload: { tabId },
      });
    }, sourceTabId);
    expect(progress.payload.progress).toMatchObject({
      qualityState: 'reviewed',
      translationProviderCalls: 1,
      reviewProviderCalls: 1,
    });
    expect(progress.payload.progress.policyFingerprint).toMatch(/^policy_/u);
    const finalStorage = await worker.evaluate(async () => chrome.storage.local.get(null));
    expect(JSON.stringify(finalStorage)).not.toContain('Stable fixture heading');
    expect(runtimeErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
