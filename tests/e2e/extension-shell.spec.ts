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
    await popup.evaluate(async () => {
      const response = await chrome.runtime.sendMessage({
        version: 1,
        requestId: 'req_e2e_light_theme_get_12345',
        type: 'GET_SETTINGS',
        payload: {},
      });
      if (response.type !== 'SETTINGS') throw new Error('Settings unavailable.');
      await chrome.runtime.sendMessage({
        version: 1,
        requestId: 'req_e2e_light_theme_update_12345',
        type: 'UPDATE_SETTINGS',
        payload: { settings: { ...response.payload.settings, theme: 'light' } },
      });
    });
    const rtlComparisonPagePromise = context.waitForEvent('page');
    const rtlComparisonResponse = await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_open_rtl_comparison_12345',
      type: 'OPEN_COMPARISON_VIEW',
      payload: { sessionId: 'session_e2e_page_12345' },
    });
    expect(rtlComparisonResponse).toMatchObject({ type: 'COMPARISON_OPENED' });
    const rtlComparison = await rtlComparisonPagePromise;
    await rtlComparison.setViewportSize({ width: 1100, height: 800 });
    await expect
      .poll(() => rtlComparison.evaluate(() => document.documentElement.dataset.theme))
      .toBe('light');
    await expect(rtlComparison.locator('#original-pane')).toHaveAttribute('dir', 'auto');
    await expect(rtlComparison.locator('#translation-pane')).toHaveAttribute('dir', 'rtl');
    await expect(
      rtlComparison.locator('#translation-pane').getByText('[fa] Stable fixture heading'),
    ).toBeVisible();
    if (captureMilestoneOne) {
      await rtlComparison.screenshot({
        path: join(milestoneOneScreenshotRoot, 'comparison-rtl-ltr.png'),
        fullPage: false,
      });
    }
    const rtlComparisonClosed = rtlComparison.waitForEvent('close');
    await rtlComparison.getByRole('button', { name: 'Close comparison' }).click();
    await rtlComparisonClosed;
    await fixture.bringToFront();
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

    const continueResponse = await commandForFixture(popup, fixtureTabId, {
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
    expect(continueResponse).toMatchObject({ type: 'TRANSLATION_PROGRESS' });
    await expect
      .poll(
        async () => {
          const response = (await commandForFixture(popup, fixtureTabId, {
            version: 1,
            requestId: `req_e2e_continue_poll_${Date.now()}`,
            type: 'GET_TRANSLATION_PROGRESS',
            payload: {},
          })) as { payload?: { progress?: { status?: string } } };
          return response.payload?.progress?.status;
        },
        { timeout: 15_000 },
      )
      .toBe('completed');
    await expect(fixture.locator('#bulk-999')).toHaveText('[en] Bulk section 999 remains stable.', {
      timeout: 15_000,
    });
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

    const requestsBeforeNoChangeScan = translationRequestCount;
    const noChangeResponse = await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_scan_no_changes_12345',
      type: 'SCAN_PAGE_CHANGES',
      payload: { sessionId: 'session_e2e_partial_12345' },
    });
    expect(noChangeResponse).toMatchObject({
      type: 'TRANSLATION_PROGRESS',
      payload: {
        progress: {
          pageDiverged: false,
          changeScan: { status: 'no-changes' },
        },
      },
    });
    expect(translationRequestCount).toBe(requestsBeforeNoChangeScan);
    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_scan_original_view_12345',
      type: 'SET_PAGE_VIEW',
      payload: { sessionId: 'session_e2e_partial_12345', displayMode: 'original' },
    });
    await expect(fixture.locator('#heading')).toHaveText('Stable fixture heading');
    const originalViewScan = await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_scan_original_no_changes_12345',
      type: 'SCAN_PAGE_CHANGES',
      payload: { sessionId: 'session_e2e_partial_12345' },
    });
    expect(originalViewScan).toMatchObject({
      type: 'TRANSLATION_PROGRESS',
      payload: { progress: { changeScan: { status: 'no-changes' } } },
    });
    await commandForFixture(popup, fixtureTabId, {
      version: 1,
      requestId: 'req_e2e_scan_translated_view_12345',
      type: 'SET_PAGE_VIEW',
      payload: { sessionId: 'session_e2e_partial_12345', displayMode: 'translated' },
    });
    await expect(fixture.locator('#heading')).toHaveText('[en] Stable fixture heading');
    expect(translationRequestCount).toBe(requestsBeforeNoChangeScan);
    await popup.reload();
    await expect(popup.getByText('No page changes found.')).toBeVisible();
    await expect(popup.getByText('Your translation is up to date.')).toBeVisible();
    if (captureMilestoneOne) {
      await popup.screenshot({
        path: join(milestoneOneScreenshotRoot, 'no-page-changes.png'),
        fullPage: true,
      });
    }

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
    await popup.reload();
    await expect(popup.getByText('Changed sections updated.')).toBeVisible();
    await expect(popup.getByText(/2 translated/u)).toBeVisible();
    if (captureMilestoneOne) {
      await popup.screenshot({
        path: join(milestoneOneScreenshotRoot, 'changed-sections-updated.png'),
        fullPage: true,
      });
    }

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
    await expect(copyPage!.locator('#lingo-page-copy-status')).toHaveAttribute(
      'data-copy-status',
      'partial',
    );
    await expect(copyPage!.locator('#lingo-page-copy-status')).toHaveAttribute(
      'data-provider-requests',
      '0',
    );
    await expect(copyPage!.locator('#lingo-page-copy-status')).toHaveAttribute(
      'data-actions',
      'Translate unmatched sections',
    );
    const copyHandoffState = await serviceWorker.evaluate(async (copyTabId) => {
      const stored = await chrome.storage.session.get(null);
      const tabEntry = stored[`translatedCopyTab:${copyTabId}`];
      const pendingKeys = Object.keys(stored).filter((key) =>
        key.startsWith('translatedCopyHandoff:'),
      );
      return { tabEntry, pendingKeys };
    }, copyResponse.payload.tabId);
    expect(copyHandoffState.tabEntry).toMatchObject({ status: 'acknowledged' });
    expect(copyHandoffState.pendingKeys).toHaveLength(0);
    const duplicateClaim = await serviceWorker.evaluate(async (copyTabId) => {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: copyTabId },
        func: async () =>
          chrome.runtime.sendMessage({
            version: 1,
            requestId: 'req_e2e_duplicate_copy_claim_12345',
            type: 'GET_TRANSLATED_COPY_HANDOFF',
            payload: {},
          }),
      });
      return result?.result;
    }, copyResponse.payload.tabId);
    expect(duplicateClaim).toMatchObject({
      type: 'TRANSLATED_COPY_HANDOFF_STATUS',
      payload: { status: 'already-applied' },
    });
    const duplicateAck = await serviceWorker.evaluate(
      async ({ tabId, token, summary }) => {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId },
          func: async ({ token, summary }) =>
            chrome.runtime.sendMessage({
              version: 1,
              requestId: 'req_e2e_duplicate_copy_ack_12345',
              type: 'ACK_TRANSLATED_COPY_HANDOFF',
              payload: { token, ...summary },
            }),
          args: [{ token, summary }],
        });
        return result?.result;
      },
      {
        tabId: copyResponse.payload.tabId,
        token: copyHandoffState.tabEntry.token as string,
        summary: {
          applicationStatus: copyHandoffState.tabEntry.applicationStatus as string,
          applicationStage: 'destination-ready' as const,
          discoveredSegments: copyHandoffState.tabEntry.discoveredSegments as number,
          appliedSegments: copyHandoffState.tabEntry.appliedSegments as number,
          changedSegments: copyHandoffState.tabEntry.changedSegments as number,
          providerRequests: 0 as const,
          matchedSegments: copyHandoffState.tabEntry.matchedSegments as number,
          unmatchedSegments: copyHandoffState.tabEntry.unmatchedSegments as number,
          uncertainSegments: copyHandoffState.tabEntry.uncertainSegments as number,
        },
      },
    );
    expect(duplicateAck).toMatchObject({
      type: 'TRANSLATED_COPY_ACKNOWLEDGED',
      payload: { acknowledged: true },
    });

    const exportedBundle = await popup.evaluate(
      async ({ tabId, sessionId }) => {
        return chrome.tabs.sendMessage(tabId, {
          version: 1,
          requestId: 'req_e2e_export_redirect_copy_12345',
          type: 'EXPORT_SESSION_BUNDLE',
          payload: { sessionId },
        });
      },
      { tabId: fixtureTabId, sessionId: 'session_e2e_partial_12345' },
    );
    expect(exportedBundle.type).toBe('SESSION_BUNDLE');

    for (const rejection of ['expired', 'invalid', 'wrong-tab'] as const) {
      const rejectedClaim = await serviceWorker.evaluate(
        async ({ sourceTabId, copyTabId, bundle, rejection }) => {
          const token = `copy_${crypto.randomUUID().replaceAll('-', '')}`;
          const expiresAt = rejection === 'expired' ? Date.now() - 1 : Date.now() + 30_000;
          const record = {
            version: 1,
            token,
            tabId: rejection === 'wrong-tab' ? copyTabId : sourceTabId,
            createdAt: Date.now(),
            expiresAt,
            bundle: rejection === 'invalid' ? { invalid: true } : bundle,
          };
          await chrome.storage.session.set({
            [`translatedCopyHandoff:${token}`]: record,
            [`translatedCopyTab:${sourceTabId}`]: {
              version: 1,
              status: 'pending',
              token,
              expiresAt,
            },
          });
          const [result] = await chrome.scripting.executeScript({
            target: { tabId: sourceTabId },
            func: async () =>
              chrome.runtime.sendMessage({
                version: 1,
                requestId: `req_e2e_rejected_claim_${crypto.randomUUID().replaceAll('-', '')}`,
                type: 'GET_TRANSLATED_COPY_HANDOFF',
                payload: {},
              }),
          });
          return result?.result;
        },
        {
          sourceTabId: fixtureTabId,
          copyTabId: copyResponse.payload.tabId,
          bundle: exportedBundle.payload.bundle,
          rejection,
        },
      );
      expect(rejectedClaim).toMatchObject({
        type: 'TRANSLATED_COPY_HANDOFF_STATUS',
        payload: { status: 'failed' },
      });
      await expect(fixture.locator('#heading')).toHaveText('[en] Stable fixture heading');
    }

    const zeroMatchPagePromise = context.waitForEvent('page');
    const zeroMatchResponsePromise = popup.evaluate(async (bundle) => {
      return chrome.runtime.sendMessage({
        version: 1,
        requestId: 'req_e2e_open_zero_match_copy_12345',
        type: 'OPEN_TRANSLATED_COPY_FROM_BUNDLE',
        payload: {
          bundle: {
            ...bundle,
            segments: bundle.segments.map((segment: { id: string }, index: number) => ({
              ...segment,
              sourceFingerprint: `fp_unmatched_${index}`,
              structuralFingerprint: `structure_unmatched_${index}`,
            })),
          },
        },
      });
    }, exportedBundle.payload.bundle);
    const zeroMatchPage = await zeroMatchPagePromise;
    const zeroMatchResponse = await zeroMatchResponsePromise;
    expect(zeroMatchResponse).toMatchObject({
      type: 'TRANSLATED_COPY_OPENED',
      payload: { applicationStatus: 'no-matches', matchedSegments: 0, providerRequests: 0 },
    });
    await expect(zeroMatchPage).toHaveURL('http://127.0.0.1:4173/fixture.html');
    await expect(zeroMatchPage.locator('#heading')).toHaveText('Stable fixture heading');
    await expect(zeroMatchPage.locator('#lingo-page-copy-status')).toHaveAttribute(
      'data-copy-status',
      'no-matches',
    );
    await expect(zeroMatchPage.locator('#lingo-page-copy-status')).toHaveAttribute(
      'data-actions',
      'Retry matching|Translate this page|Return to source tab',
    );
    await zeroMatchPage.close();
    await expect(fixture.locator('#heading')).toHaveText('[en] Stable fixture heading');

    const redirectPagePromise = context.waitForEvent('page');
    const failedCopyResponsePromise = popup.evaluate(async (bundle) => {
      return chrome.runtime.sendMessage({
        version: 1,
        requestId: 'req_e2e_open_redirect_copy_12345',
        type: 'OPEN_TRANSLATED_COPY_FROM_BUNDLE',
        payload: {
          bundle: {
            ...bundle,
            navigationUrl: 'http://127.0.0.1:4173/redirect-copy',
          },
        },
      });
    }, exportedBundle.payload.bundle);
    const redirectedCopy = await redirectPagePromise;
    const redirectedCopyResponse = await failedCopyResponsePromise;
    expect(redirectedCopyResponse).toMatchObject({
      type: 'TRANSLATED_COPY_OPENED',
      payload: { applicationStatus: 'partial', matchedSegments: expect.any(Number) },
    });
    await expect(redirectedCopy).toHaveURL('http://127.0.0.1:4173/fixture.html');
    await expect(redirectedCopy.locator('#heading')).toHaveText('[en] Stable fixture heading');
    await expect(redirectedCopy.locator('#lingo-page-copy-status')).toHaveAttribute(
      'data-copy-status',
      'partial',
    );
    expect(context.pages()).toContain(redirectedCopy);

    const wrongSitePagePromise = context.waitForEvent('page');
    const wrongSiteResponsePromise = popup.evaluate(async (bundle) => {
      return chrome.runtime.sendMessage({
        version: 1,
        requestId: 'req_e2e_open_wrong_site_copy_12345',
        type: 'OPEN_TRANSLATED_COPY_FROM_BUNDLE',
        payload: {
          bundle: {
            ...bundle,
            navigationUrl: 'http://127.0.0.1:4173/redirect-copy-wrong-site',
          },
        },
      });
    }, exportedBundle.payload.bundle);
    const wrongSiteCopy = await wrongSitePagePromise;
    const wrongSiteResponse = await wrongSiteResponsePromise;
    expect(wrongSiteResponse).toMatchObject({ type: 'MESSAGE_ERROR' });
    await expect(wrongSiteCopy).toHaveURL('http://localhost:4173/fixture.html');
    await expect(wrongSiteCopy.locator('#heading')).toHaveText('Stable fixture heading');
    await expect(wrongSiteCopy.locator('#lingo-page-copy-status')).toHaveCount(0);
    await wrongSiteCopy.close();
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
    await expect(comparison.getByText('Partial session')).toBeVisible();
    await expect
      .poll(() => comparison.evaluate(() => document.documentElement.dataset.theme))
      .toBe('dark');
    expect(await comparison.evaluate(() => document.documentElement.dataset.reducedMotion)).toBe(
      'true',
    );
    await comparison.setViewportSize({ width: 1100, height: 800 });
    const originalPane = comparison.locator('#original-pane');
    const translationPane = comparison.locator('#translation-pane');
    const divider = comparison.getByRole('separator', { name: 'Resize comparison panes' });
    await expect(originalPane.getByText('Stable fixture heading', { exact: true })).toBeVisible();
    await expect(
      translationPane.getByText('[en] Stable fixture heading', { exact: true }),
    ).toBeVisible();
    await expect(comparison.locator('.segment-pair')).toHaveCount(0);
    await expect(comparison.locator('.snapshot-document table')).toHaveCount(2);
    await expect(comparison.locator('.snapshot-document ul')).toHaveCount(2);
    await expect(comparison.locator('.snapshot-document button')).toHaveCount(4);
    await expect(
      comparison.locator(
        '.snapshot-document script, .snapshot-document iframe, .snapshot-document object, .snapshot-document embed, .snapshot-document form, .snapshot-document input, .snapshot-document textarea, .snapshot-document select',
      ),
    ).toHaveCount(0);
    await expect(
      comparison.locator(
        '.snapshot-document [onclick], .snapshot-document [onload], .snapshot-document a[href^="javascript:"]',
      ),
    ).toHaveCount(0);
    expect(await comparison.evaluate(() => typeof (window as Window).addChangedSection)).toBe(
      'undefined',
    );

    const initialPaneWidths = await comparison.evaluate(() => {
      const original = document.querySelector('#original-pane')!.getBoundingClientRect();
      const translation = document.querySelector('#translation-pane')!.getBoundingClientRect();
      const workspace = document.querySelector('.comparison-workspace')!.getBoundingClientRect();
      return {
        original: original.width,
        translation: translation.width,
        workspaceBottom: workspace.bottom,
        innerHeight: innerHeight,
      };
    });
    expect(Math.abs(initialPaneWidths.original - initialPaneWidths.translation)).toBeLessThan(30);
    expect(initialPaneWidths.workspaceBottom).toBeLessThanOrEqual(initialPaneWidths.innerHeight);

    if (captureMilestoneOne) {
      await comparison.screenshot({
        path: join(milestoneOneScreenshotRoot, 'comparison-default-50-50.png'),
        fullPage: false,
      });
      await comparison.screenshot({
        path: join(milestoneOneScreenshotRoot, 'comparison-partial.png'),
        fullPage: false,
      });
    }

    await originalPane.hover();
    await comparison.mouse.wheel(0, 900);
    await expect
      .poll(() => translationPane.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    expect(await comparison.evaluate(() => window.scrollY)).toBe(0);
    if (captureMilestoneOne) {
      await comparison.screenshot({
        path: join(milestoneOneScreenshotRoot, 'comparison-synchronized-scrolled.png'),
        fullPage: false,
      });
    }

    await translationPane.hover();
    await comparison.mouse.wheel(0, 650);
    await expect
      .poll(() => originalPane.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await comparison.getByRole('button', { name: 'Scrolling linked' }).click();
    const translationBeforeIndependentScroll = await translationPane.evaluate(
      (element) => element.scrollTop,
    );
    await originalPane.hover();
    await comparison.mouse.wheel(0, 500);
    await expect
      .poll(async () =>
        Math.abs(
          (await translationPane.evaluate((element) => element.scrollTop)) -
            translationBeforeIndependentScroll,
        ),
      )
      .toBeLessThan(3);
    if (captureMilestoneOne) {
      await comparison.screenshot({
        path: join(milestoneOneScreenshotRoot, 'comparison-unlinked-scroll.png'),
        fullPage: false,
      });
    }
    await comparison.getByRole('button', { name: 'Scrolling unlinked' }).click();
    await expect(comparison.getByText(/panes were realigned/u)).toBeVisible();

    await divider.focus();
    await divider.press('ArrowRight');
    await divider.press('ArrowRight');
    await divider.press('ArrowRight');
    await expect(divider).toHaveAttribute('aria-valuenow', '56');
    const dividerBox = await divider.boundingBox();
    expect(dividerBox).not.toBeNull();
    if (dividerBox) {
      await comparison.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + 30);
      await comparison.mouse.down();
      await comparison.mouse.move(dividerBox.x - 80, dividerBox.y + 30, { steps: 6 });
      await comparison.mouse.up();
      expect(Number(await divider.getAttribute('aria-valuenow'))).toBeLessThan(56);
    }
    if (captureMilestoneOne) {
      await comparison.screenshot({
        path: join(milestoneOneScreenshotRoot, 'comparison-adjusted-divider.png'),
        fullPage: false,
      });
    }
    await comparison.getByRole('button', { name: 'Reset layout' }).click();
    await expect(divider).toHaveAttribute('aria-valuenow', '50');
    await comparison.getByRole('button', { name: 'Swap sides' }).click();
    await expect(comparison.locator('.comparison-pane').first()).toHaveAttribute(
      'id',
      'translation-pane',
    );
    if (captureMilestoneOne) {
      await comparison.screenshot({
        path: join(milestoneOneScreenshotRoot, 'comparison-swapped-sides.png'),
        fullPage: false,
      });
    }
    await comparison.getByRole('button', { name: 'Swap sides' }).click();
    await serviceWorker.evaluate(
      async (tabId) => chrome.tabs.setZoom(tabId, 2),
      comparisonResponse.payload.tabId,
    );
    await expect(comparison.getByRole('heading', { name: 'Original', exact: true })).toBeVisible();
    await expect(
      comparison.getByRole('heading', { name: 'Translation', exact: true }),
    ).toBeVisible();
    await expect(comparison.getByRole('button', { name: 'Reset layout' })).toBeVisible();
    expect(
      await comparison.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(
      await comparison.evaluate(() => document.documentElement.clientWidth + 1),
    );
    await serviceWorker.evaluate(
      async (tabId) => chrome.tabs.setZoom(tabId, 1),
      comparisonResponse.payload.tabId,
    );
    await comparison.setViewportSize({ width: 390, height: 844 });
    await expect(comparison.getByRole('heading', { name: 'Original', exact: true })).toBeVisible();
    await expect(
      comparison.getByRole('heading', { name: 'Translation', exact: true }),
    ).toBeVisible();
    if (captureMilestoneOne) {
      await comparison.screenshot({
        path: join(milestoneOneScreenshotRoot, 'comparison-narrow.png'),
        fullPage: false,
      });
    }
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
    await fixture.close();
    expect(copyPage!.isClosed()).toBe(false);
    await expect(copyPage!.locator('#heading')).toHaveText('[en] Stable fixture heading');
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
