import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test, type Page, type Worker } from '@playwright/test';

type RuntimeCommand = {
  version: 1;
  requestId: string;
  type: string;
  payload: Record<string, unknown>;
};

type Progress = {
  status: string;
  discoveredSegments: number;
  translatedSegments: number;
  failedSegments: number;
};

type Metric = {
  fixture: string;
  addedNodes: number;
  eligibleSegments: number;
  translatedSegments: number;
  batches: number;
  averageCharactersPerBatch: number;
  firstVisibleMs: number;
  completionMs: number;
  restoreMs: number;
  translatedSwitchMs: number;
  repeatedSwitchMs: number;
  switchProviderCalls: number;
  longTaskCount: number;
  longestTaskMs: number;
  heapBeforeBytes?: number;
  heapAfterBytes?: number;
  heapAfterRestoreBytes?: number;
};

async function commandForFixture(control: Page, tabId: number, command: RuntimeCommand) {
  return control.evaluate(
    async ({ command, tabId }) =>
      chrome.runtime.sendMessage({ ...command, payload: { ...command.payload, tabId } }),
    { command, tabId },
  );
}

async function activeTabId(worker: Worker) {
  return worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('Active fixture tab not found.');
    return tab.id;
  });
}

async function heapBytes(page: Page): Promise<number | undefined> {
  return page.evaluate(() => {
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    return memory.memory?.usedJSHeapSize;
  });
}

test('records deterministic browser translation baselines', async () => {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3-e2e');
  test.skip(!existsSync(extensionPath), 'The E2E extension bundle has not been built.');

  const context = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), 'lingo-page-performance-')),
    {
      headless: true,
      channel: 'chromium',
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        '--enable-unsafe-extension-debugging',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--enable-precise-memory-info',
      ],
    },
  );

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(worker.url()).host;
    const control = await context.newPage();
    await control.goto(`chrome-extension://${extensionId}/popup.html`);
    const metrics: Metric[] = [];

    for (const fixture of [
      { name: 'very-small', nodes: 25, targetLanguage: 'fa' },
      { name: 'medium', nodes: 400, targetLanguage: 'de' },
      { name: 'large', nodes: 1_000, targetLanguage: 'es' },
      { name: 'very-large', nodes: 2_200, targetLanguage: 'fr' },
    ]) {
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4173/fixture.html');
      await page.evaluate((count) => {
        const longTasks: number[] = [];
        (window as Window & { __longTasks?: number[] }).__longTasks = longTasks;
        if ('PerformanceObserver' in window) {
          try {
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) longTasks.push(entry.duration);
            }).observe({ type: 'longtask', buffered: true });
          } catch {
            // Long-task entries are optional browser evidence.
          }
        }
        window.addBulkText(count);
        const rtl = document.createElement('p');
        rtl.id = 'rtl-baseline';
        rtl.dir = 'rtl';
        rtl.textContent = 'متن فارسی با English 2026 و کد AB-42.';
        document.querySelector('main')?.append(rtl);
      }, fixture.nodes);
      await page.bringToFront();
      const tabId = await activeTabId(worker);
      const requests: Array<{ characters: number }> = [];
      const onRequest = (request: { url(): string; postDataJSON(): unknown }) => {
        if (!request.url().endsWith('/v1/translate')) return;
        try {
          const body = request.postDataJSON() as { segments?: Array<{ text?: string }> };
          requests.push({
            characters: (body.segments ?? []).reduce(
              (total, segment) => total + (segment.text?.length ?? 0),
              0,
            ),
          });
        } catch {
          requests.push({ characters: 0 });
        }
      };
      context.on('request', onRequest);
      const heapBefore = await heapBytes(page);
      const started = performance.now();
      const start = commandForFixture(control, tabId, {
        version: 1,
        requestId: `req_perf_${fixture.name}`,
        type: 'START_PAGE_TRANSLATION',
        payload: {
          sessionId: `session_perf_${fixture.name}`,
          providerId: 'mock',
          modelId: 'mock-deterministic',
          sourceLanguage: 'auto',
          targetLanguage: fixture.targetLanguage,
          glossaryVersion: 0,
          glossary: [],
          autoTranslateDynamicContent: true,
        },
      });
      await expect(page.locator('#bulk-0')).toHaveText(
        `[${fixture.targetLanguage}] Bulk section 0 remains stable.`,
      );
      const firstVisibleMs = performance.now() - started;
      await start;
      let pollOrdinal = 0;
      await expect
        .poll(
          async () => {
            pollOrdinal += 1;
            const result = (await commandForFixture(control, tabId, {
              version: 1,
              requestId: `req_perf_poll_${fixture.name}_${pollOrdinal}`,
              type: 'GET_TRANSLATION_PROGRESS',
              payload: {},
            })) as { payload: { progress: Progress } };
            return result.payload.progress.status;
          },
          { timeout: 90_000 },
        )
        .toBe('completed');
      const completionMs = performance.now() - started;
      const progressResult = (await commandForFixture(control, tabId, {
        version: 1,
        requestId: `req_perf_progress_${fixture.name}`,
        type: 'GET_TRANSLATION_PROGRESS',
        payload: {},
      })) as { payload: { progress: Progress } };
      expect(progressResult.payload.progress.status).toBe('completed');
      expect(progressResult.payload.progress.failedSegments).toBe(0);
      await expect(page.locator('#rtl-baseline')).toContainText(`[${fixture.targetLanguage}]`);
      expect(await page.locator('#account').inputValue()).toBe('1234 5678 9012');
      const heapAfter = await heapBytes(page);

      const restoreStarted = performance.now();
      await commandForFixture(control, tabId, {
        version: 1,
        requestId: `req_perf_restore_${fixture.name}`,
        type: 'SET_PAGE_VIEW',
        payload: { sessionId: `session_perf_${fixture.name}`, displayMode: 'original' },
      });
      await expect(page.locator('#bulk-0')).toHaveText('Bulk section 0 remains stable.');
      const restoreMs = performance.now() - restoreStarted;
      const requestsBeforeSwitching = requests.length;
      const translatedSwitchStarted = performance.now();
      await commandForFixture(control, tabId, {
        version: 1,
        requestId: `req_perf_translated_${fixture.name}`,
        type: 'SET_PAGE_VIEW',
        payload: { sessionId: `session_perf_${fixture.name}`, displayMode: 'translated' },
      });
      await expect(page.locator('#bulk-0')).toHaveText(
        `[${fixture.targetLanguage}] Bulk section 0 remains stable.`,
      );
      const translatedSwitchMs = performance.now() - translatedSwitchStarted;
      const repeatedSwitchStarted = performance.now();
      for (let cycle = 0; cycle < 10; cycle += 1) {
        await commandForFixture(control, tabId, {
          version: 1,
          requestId: `req_perf_cycle_original_${fixture.name}_${cycle}`,
          type: 'SET_PAGE_VIEW',
          payload: { sessionId: `session_perf_${fixture.name}`, displayMode: 'original' },
        });
        await commandForFixture(control, tabId, {
          version: 1,
          requestId: `req_perf_cycle_translated_${fixture.name}_${cycle}`,
          type: 'SET_PAGE_VIEW',
          payload: { sessionId: `session_perf_${fixture.name}`, displayMode: 'translated' },
        });
      }
      const repeatedSwitchMs = performance.now() - repeatedSwitchStarted;
      await expect(page.locator('#bulk-0')).toHaveText(
        `[${fixture.targetLanguage}] Bulk section 0 remains stable.`,
      );
      expect(requests.length).toBe(requestsBeforeSwitching);
      await commandForFixture(control, tabId, {
        version: 1,
        requestId: `req_perf_final_original_${fixture.name}`,
        type: 'SET_PAGE_VIEW',
        payload: { sessionId: `session_perf_${fixture.name}`, displayMode: 'original' },
      });
      const heapAfterRestore = await heapBytes(page);
      const longTasks = await page.evaluate(
        () => (window as Window & { __longTasks?: number[] }).__longTasks ?? [],
      );
      context.off('request', onRequest);
      metrics.push({
        fixture: fixture.name,
        addedNodes: fixture.nodes,
        eligibleSegments: progressResult.payload.progress.discoveredSegments,
        translatedSegments: progressResult.payload.progress.translatedSegments,
        batches: requests.length,
        averageCharactersPerBatch:
          requests.length === 0
            ? 0
            : Math.round(
                requests.reduce((total, request) => total + request.characters, 0) /
                  requests.length,
              ),
        firstVisibleMs: Math.round(firstVisibleMs),
        completionMs: Math.round(completionMs),
        restoreMs: Math.round(restoreMs),
        translatedSwitchMs: Math.round(translatedSwitchMs),
        repeatedSwitchMs: Math.round(repeatedSwitchMs),
        switchProviderCalls: requests.length - requestsBeforeSwitching,
        longTaskCount: longTasks.length,
        longestTaskMs: Math.round(Math.max(0, ...longTasks)),
        heapBeforeBytes: heapBefore,
        heapAfterBytes: heapAfter,
        heapAfterRestoreBytes: heapAfterRestore,
      });
      await page.close();
    }

    const dynamic = await context.newPage();
    await dynamic.goto('http://127.0.0.1:4173/fixture.html');
    await dynamic.bringToFront();
    const dynamicTabId = await activeTabId(worker);
    await commandForFixture(control, dynamicTabId, {
      version: 1,
      requestId: 'req_perf_dynamic_start',
      type: 'START_PAGE_TRANSLATION',
      payload: {
        sessionId: 'session_perf_dynamic',
        providerId: 'mock',
        modelId: 'mock-deterministic',
        sourceLanguage: 'auto',
        targetLanguage: 'de',
        glossaryVersion: 0,
        glossary: [],
        autoTranslateDynamicContent: true,
      },
    });
    let dynamicPollOrdinal = 0;
    await expect
      .poll(async () => {
        dynamicPollOrdinal += 1;
        const result = (await commandForFixture(control, dynamicTabId, {
          version: 1,
          requestId: `req_perf_dynamic_poll_${dynamicPollOrdinal}`,
          type: 'GET_TRANSLATION_PROGRESS',
          payload: {},
        })) as { payload: { progress: Progress } };
        return result.payload.progress.status;
      })
      .toBe('completed');
    const dynamicStarted = performance.now();
    await dynamic.evaluate(() => window.addDynamicText());
    await expect(dynamic.locator('#dynamic-paragraph')).toHaveText(
      '[de] New content arrived after initial translation.',
    );
    const dynamicTranslationMs = Math.round(performance.now() - dynamicStarted);
    await dynamic.close();

    const copySource = await context.newPage();
    await copySource.goto('http://127.0.0.1:4173/fixture.html?bulk=2200');
    await copySource.bringToFront();
    const copySourceTabId = await activeTabId(worker);
    let reuseProviderCalls = 0;
    const reuseRequestListener = (request: { url(): string }) => {
      if (request.url().endsWith('/v1/translate')) reuseProviderCalls += 1;
    };
    context.on('request', reuseRequestListener);
    await commandForFixture(control, copySourceTabId, {
      version: 1,
      requestId: 'req_perf_copy_source',
      type: 'START_PAGE_TRANSLATION',
      payload: {
        sessionId: 'session_perf_copy_source',
        providerId: 'mock',
        modelId: 'mock-deterministic',
        sourceLanguage: 'auto',
        targetLanguage: 'fa',
        glossaryVersion: 0,
        glossary: [],
        autoTranslateDynamicContent: false,
      },
    });
    await expect(copySource.locator('#bulk-2199')).toHaveText(
      '[fa] Bulk section 2199 remains stable.',
    );
    const callsBeforeCopy = reuseProviderCalls;
    const copyStarted = performance.now();
    const copyResult = (await commandForFixture(control, copySourceTabId, {
      version: 1,
      requestId: 'req_perf_copy_open',
      type: 'OPEN_TRANSLATED_COPY',
      payload: { sessionId: 'session_perf_copy_source' },
    })) as { payload: { tabId: number; matchedSegments: number; unmatchedSegments: number } };
    const translatedCopy = context
      .pages()
      .find(
        (page) =>
          page !== copySource && page.url() === 'http://127.0.0.1:4173/fixture.html?bulk=2200',
      );
    expect(translatedCopy).toBeDefined();
    await expect(translatedCopy!.locator('#bulk-2199')).toHaveText(
      '[fa] Bulk section 2199 remains stable.',
    );
    const copyMatchAndApplyMs = Math.round(performance.now() - copyStarted);
    expect(copyResult.payload.matchedSegments).toBeGreaterThanOrEqual(2_200);
    expect(copyResult.payload.unmatchedSegments).toBe(0);
    expect(reuseProviderCalls).toBe(callsBeforeCopy);

    const comparisonStarted = performance.now();
    await commandForFixture(control, copySourceTabId, {
      version: 1,
      requestId: 'req_perf_comparison_open',
      type: 'OPEN_COMPARISON_VIEW',
      payload: { sessionId: 'session_perf_copy_source' },
    });
    const comparisonPage =
      context.pages().find((page) => page.url().includes('comparison.html')) ??
      (await context.waitForEvent('page', {
        predicate: (page) => page.url().includes('comparison.html'),
      }));
    await expect(
      comparisonPage.getByRole('heading', { name: 'Translation Extension Fixture' }),
    ).toBeVisible();
    const comparisonLoadMs = Math.round(performance.now() - comparisonStarted);
    expect(reuseProviderCalls).toBe(callsBeforeCopy);
    context.off('request', reuseRequestListener);

    console.log(
      `LINGO_PERFORMANCE_BASELINE=${JSON.stringify({
        metrics,
        dynamicTranslationMs,
        sessionReuse: {
          eligibleSegments: copyResult.payload.matchedSegments,
          copyMatchAndApplyMs,
          comparisonLoadMs,
          providerCallsDuringCopyAndComparison: reuseProviderCalls - callsBeforeCopy,
        },
      })}`,
    );
    await comparisonPage.close();
    await translatedCopy!.close();
    await copySource.close();
  } finally {
    await context.close();
  }
});

declare global {
  interface Window {
    addBulkText(count: number): void;
    addDynamicText(): void;
  }
}
