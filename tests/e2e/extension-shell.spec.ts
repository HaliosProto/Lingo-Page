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
  let translationRequestCount = 0;
  const runtimeErrors: string[] = [];
  const inspectPage = (page: Page) => {
    page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const location = message.location().url || page.url();
        runtimeErrors.push(`console (${location}): ${message.text()}`);
      }
    });
  };
  context.pages().forEach(inspectPage);
  context.on('page', inspectPage);
  context.on('request', (request) => {
    if (new URL(request.url()).pathname === '/v1/translate') translationRequestCount += 1;
  });

  try {
    const captureMilestoneOne = process.env.CAPTURE_MILESTONE_1_SCREENSHOTS === '1';
    const milestoneOneScreenshotRoot = resolve('artifacts/milestone-1-visual-baseline');
    if (captureMilestoneOne) mkdirSync(milestoneOneScreenshotRoot, { recursive: true });
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    serviceWorker.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(`worker: ${message.text()}`);
    });
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
    await fixture.evaluate(() => window.addBidiTestMatrix());

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
    await expect(fixture.locator('#bidi-english-persian')).toContainText('[fa]');
    await expect(fixture.locator('#bidi-arabic-numbers')).toContainText('١٢٣٤');
    await expect(fixture.locator('#bidi-hebrew-url')).toContainText('https://example.com/path');
    await expect(fixture.locator('#bidi-list li')).toContainText('[fa]');
    await expect(fixture.locator('#bidi-table td')).toHaveCount(2);
    await expect(fixture.locator('#bidi-table td').first()).toContainText('[fa]');
    await expect(fixture.locator('#bidi-button')).toContainText('[fa]');
    await expect(popup.getByText('Translation available')).toBeVisible();
    await expect(popup.getByRole('group', { name: 'Page view' })).toBeVisible();
    if (captureMilestoneOne) {
      await popup.setViewportSize({ width: 360, height: 760 });
      await popup.screenshot({
        path: join(milestoneOneScreenshotRoot, 'completed-translated-popup.png'),
        fullPage: true,
      });
      await fixture.screenshot({
        path: join(milestoneOneScreenshotRoot, 'completed-translated-page.png'),
        fullPage: false,
      });
    }
    const requestsAfterInitialTranslation = translationRequestCount;
    for (let cycle = 0; cycle < 5; cycle += 1) {
      const originalView = await commandForFixture(popup, fixtureTabId, {
        version: 1,
        requestId: `req_e2e_original_${cycle}_12345`,
        type: 'SET_PAGE_VIEW',
        payload: { sessionId: 'session_e2e_page_12345', displayMode: 'original' },
      });
      expect(originalView).toMatchObject({
        type: 'TRANSLATION_PROGRESS',
        payload: { progress: { displayMode: 'original' } },
      });
      await expect(fixture.locator('#heading')).toHaveText(original.heading!);
      if (captureMilestoneOne && cycle === 0) {
        await fixture.screenshot({
          path: join(milestoneOneScreenshotRoot, 'original-view-session-retained.png'),
          fullPage: false,
        });
      }
      const translatedView = await commandForFixture(popup, fixtureTabId, {
        version: 1,
        requestId: `req_e2e_translated_${cycle}_12345`,
        type: 'SET_PAGE_VIEW',
        payload: { sessionId: 'session_e2e_page_12345', displayMode: 'translated' },
      });
      expect(translatedView).toMatchObject({ type: 'TRANSLATION_PROGRESS' });
      await expect(fixture.locator('#heading')).toHaveText('[fa] Stable fixture heading');
      if (captureMilestoneOne && cycle === 0) {
        await fixture.screenshot({
          path: join(milestoneOneScreenshotRoot, 'translated-view-reapplied.png'),
          fullPage: false,
        });
      }
    }
    expect(translationRequestCount).toBe(requestsAfterInitialTranslation);
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
        targetLanguage: 'en',
        glossaryVersion: 0,
        glossary: [],
        autoTranslateDynamicContent: false,
      },
    });
    await expect(fixture.locator('#bulk-0')).toHaveText('[en] Bulk section 0 remains stable.');
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
    await expect(fixture.locator('#bulk-0')).toHaveText('[en] Bulk section 0 remains stable.');
    await expect(
      popup.getByText(/^Translation was cancelled\. \d+ of \d+ sections/u),
    ).toBeVisible();
    if (captureMilestoneOne) {
      await popup.screenshot({
        path: join(milestoneOneScreenshotRoot, 'partial-cancelled-session.png'),
        fullPage: true,
      });
    }

    const requestsBeforePartialSwitch = translationRequestCount;
    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_partial_original_12345',
      type: 'SET_PAGE_VIEW',
      payload: { sessionId: 'session_e2e_partial_12345', displayMode: 'original' },
    });
    await expect(fixture.locator('#bulk-0')).toHaveText('Bulk section 0 remains stable.');
    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_partial_translated_12345',
      type: 'SET_PAGE_VIEW',
      payload: { sessionId: 'session_e2e_partial_12345', displayMode: 'translated' },
    });
    await expect(fixture.locator('#bulk-0')).toHaveText('[en] Bulk section 0 remains stable.');
    expect(translationRequestCount).toBe(requestsBeforePartialSwitch);

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
    await expect(fixture.locator('#bulk-999')).toHaveText('[en] Bulk section 999 remains stable.');
    await expect(fixture.locator('#bulk-0')).toHaveText('[en] Bulk section 0 remains stable.');
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

    await fixture.evaluate(() => window.addChangedSection());
    await fixture.evaluate(() => window.addMixedDirectionText());
    const requestsBeforeChangeScan = translationRequestCount;
    const scanResponse = await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_scan_changes_12345',
      type: 'SCAN_PAGE_CHANGES',
      payload: { sessionId: 'session_e2e_partial_12345' },
    });
    expect(scanResponse).toMatchObject({
      type: 'TRANSLATION_PROGRESS',
      payload: { progress: { pageDiverged: true, changed: { newSegments: 2 } } },
    });
    if (captureMilestoneOne) {
      await popup.reload();
      await expect(popup.getByText(/page changes found/u)).toBeVisible();
      await popup.screenshot({
        path: join(milestoneOneScreenshotRoot, 'changed-sections.png'),
        fullPage: true,
      });
    }
    expect(translationRequestCount).toBe(requestsBeforeChangeScan);
    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_update_changes_12345',
      type: 'UPDATE_CHANGED_SECTIONS',
      payload: { sessionId: 'session_e2e_partial_12345' },
    });
    await expect(fixture.locator('#changed-section')).toHaveText(
      '[en] A deliberately added section needs translation.',
    );
    await expect(fixture.locator('#mixed-direction')).toContainText(
      'Persian فارسی model XJ-2026, https://example.com/path and number ۱۲۳۴.',
    );
    expect(translationRequestCount).toBe(requestsBeforeChangeScan + 1);

    if (captureMilestoneOne) {
      await fixture.locator('#mixed-direction').scrollIntoViewIfNeeded();
      await fixture.screenshot({
        path: join(milestoneOneScreenshotRoot, 'rtl-mixed-direction.png'),
        fullPage: false,
      });
    }

    await fixture.evaluate(() => window.modifyFixtureParagraph());
    await fixture.evaluate(() => window.reorderFixtureHeading());
    await fixture.evaluate(() => window.removeFixtureWhitespace());
    const structuralScan = await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_structural_scan_12345',
      type: 'SCAN_PAGE_CHANGES',
      payload: { sessionId: 'session_e2e_partial_12345' },
    });
    expect(structuralScan).toMatchObject({
      type: 'TRANSLATION_PROGRESS',
      payload: {
        progress: {
          changed: { modifiedSegments: 1, removedSegments: 1, reorderedSegments: 1 },
        },
      },
    });
    const requestsBeforeStructuralUpdate = translationRequestCount;
    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_structural_update_12345',
      type: 'UPDATE_CHANGED_SECTIONS',
      payload: { sessionId: 'session_e2e_partial_12345' },
    });
    await expect(fixture.locator('#paragraph')).toHaveText(
      '[en] This paragraph was deliberately modified after translation.',
    );
    expect(translationRequestCount).toBe(requestsBeforeStructuralUpdate + 1);

    await fixture.evaluate(() => window.addDuplicateDynamicText());
    const duplicateScan = await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_duplicate_scan_12345',
      type: 'SCAN_PAGE_CHANGES',
      payload: { sessionId: 'session_e2e_partial_12345' },
    });
    expect(duplicateScan).toMatchObject({
      type: 'TRANSLATION_PROGRESS',
      payload: { progress: { changed: { newSegments: 1, uncertainSegments: 1 } } },
    });
    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_duplicate_update_12345',
      type: 'UPDATE_CHANGED_SECTIONS',
      payload: { sessionId: 'session_e2e_partial_12345' },
    });
    await expect(fixture.locator('#duplicate-dynamic-0')).toHaveText(
      '[en] Duplicated dynamic text requires a confident match.',
    );
    await expect(fixture.locator('#duplicate-dynamic-1')).toHaveText(
      'Duplicated dynamic text requires a confident match.',
    );

    const requestsBeforeCopy = translationRequestCount;
    const copyResponse = (await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_open_copy_12345',
      type: 'OPEN_TRANSLATED_COPY',
      payload: { sessionId: 'session_e2e_partial_12345' },
    })) as { type: string; payload: { tabId: number; matchedSegments: number } };
    expect(copyResponse.type).toBe('TRANSLATED_COPY_OPENED');
    expect(copyResponse.payload.matchedSegments).toBeGreaterThan(0);
    const copyPage = context
      .pages()
      .find((page) => page.url() === 'http://127.0.0.1:4173/fixture.html' && page !== fixture);
    expect(copyPage).toBeDefined();
    await expect(copyPage!.locator('#heading')).toHaveText('[en] Stable fixture heading');
    if (captureMilestoneOne) {
      await copyPage!.screenshot({
        path: join(milestoneOneScreenshotRoot, 'translated-copy.png'),
        fullPage: false,
      });
    }
    expect(translationRequestCount).toBe(requestsBeforeCopy);

    await popup.evaluate(async () => {
      const settingsResponse = await chrome.runtime.sendMessage({
        version: 1,
        requestId: 'req_e2e_settings_get_12345',
        type: 'GET_SETTINGS',
        payload: {},
      });
      if (settingsResponse.type !== 'SETTINGS') throw new Error('Settings unavailable.');
      await chrome.runtime.sendMessage({
        version: 1,
        requestId: 'req_e2e_settings_update_12345',
        type: 'UPDATE_SETTINGS',
        payload: {
          settings: { ...settingsResponse.payload.settings, theme: 'dark', reducedMotion: true },
        },
      });
    });

    const comparisonResponse = (await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_open_comparison_12345',
      type: 'OPEN_COMPARISON_VIEW',
      payload: { sessionId: 'session_e2e_partial_12345' },
    })) as { type: string; payload: { tabId: number } };
    expect(comparisonResponse.type).toBe('COMPARISON_OPENED');
    const comparison =
      context.pages().find((page) => page.url().includes('comparison.html')) ??
      (await context.waitForEvent('page', {
        predicate: (page) => page.url().includes('comparison.html'),
      }));
    await expect(
      comparison.getByRole('heading', { name: 'Translation Extension Fixture' }),
    ).toBeVisible();
    await expect(comparison.getByText(/of \d+ translated/u)).toBeVisible();
    await expect
      .poll(() => comparison.evaluate(() => document.documentElement.dataset.theme))
      .toBe('dark');
    expect(await comparison.evaluate(() => document.documentElement.dataset.reducedMotion)).toBe(
      'true',
    );
    if (captureMilestoneOne) {
      await comparison.setViewportSize({ width: 1100, height: 800 });
      await comparison.evaluate(() => window.scrollTo(0, 0));
      await comparison.screenshot({
        path: join(milestoneOneScreenshotRoot, 'comparison-dark.png'),
        fullPage: false,
      });
      await comparison.setViewportSize({ width: 390, height: 844 });
      await comparison.evaluate(() => window.scrollTo(0, 0));
      await comparison.screenshot({
        path: join(milestoneOneScreenshotRoot, 'comparison-narrow.png'),
        fullPage: false,
      });
    }
    await comparison.getByRole('button', { name: 'Next' }).click();
    expect(translationRequestCount).toBe(requestsBeforeCopy);

    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_end_session_12345',
      type: 'END_TRANSLATION_SESSION',
      payload: { sessionId: 'session_e2e_partial_12345' },
    });
    await expect(fixture.locator('#heading')).toHaveText(original.heading!);
    await expect(copyPage!.locator('#heading')).toHaveText('[en] Stable fixture heading');

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
    await expect(options.getByRole('checkbox', { name: /Reduced motion/u })).toBeChecked();
    await expect(options.getByLabel('Theme')).toHaveValue('dark');
    expect(await options.evaluate(() => document.documentElement.dataset.reducedMotion)).toBe(
      'true',
    );

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
    expect(runtimeErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

declare global {
  interface Window {
    addDynamicText(): void;
    addBulkText(count: number): void;
    addChangedSection(): void;
    modifyFixtureParagraph(): void;
    reorderFixtureHeading(): void;
    removeFixtureWhitespace(): void;
    addMixedDirectionText(): void;
    addBidiTestMatrix(): void;
    addDuplicateDynamicText(): void;
  }
}
