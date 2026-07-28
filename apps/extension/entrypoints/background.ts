import { browser } from 'wxt/browser';
import {
  CACHE_STORAGE_KEY,
  classifyPageSupport,
  createRequestId,
  createSessionId,
  DEFAULT_API_BASE_URL,
  DEFAULT_REQUEST_TIMEOUT_MS,
  defaultSettings,
  SETTINGS_STORAGE_KEY,
} from '@translation/shared-config';
import type {
  AppSettings,
  ProviderId,
  SelectionResult,
  TranslationFailure,
  TranslationProgress,
  TranslationRecoveryRecord,
  TranslationRequest,
  TranslationResponse,
  TranslationSessionBundle,
  TranslatedCopyIntentRecord,
} from '@translation/shared-types';
import { CONTRACT_VERSION } from '@translation/shared-types';
import { createCacheKey } from '@translation/translation-core';
import {
  appSettingsSchema,
  errorResponseSchema,
  extensionRequestSchema,
  extensionResponseSchema,
  healthResponseSchema,
  providersResponseSchema,
  providerTestResponseSchema,
  translationResponseSchema,
  translationRecoveryRecordSchema,
  translationSessionBundleSchema,
  translatedCopyHandoffIndexSchema,
  translatedCopyHandoffRecordSchema,
  translatedCopyIntentRecordSchema,
  type ExtensionResponse,
} from '@translation/shared-validation';
import {
  hasTranslatedCopySiteAccess,
  translatedCopyOriginPattern,
} from '../src/translated-copy-access';
import {
  TranslatedCopyIntentCoordinator,
  translatedCopyNavigationIdentity,
  type TranslatedCopyIntentExecutionHooks,
} from '../src/translated-copy-intent';
import {
  MAX_RECOVERY_RECORD_BYTES,
  evaluateRecoveryRecord,
  pruneRecoveryRecords,
  recoveryNavigationIdentity,
  recoveryRecordByteLength,
} from '../src/session-recovery';

type CacheEntry = { translatedText: string; createdAt: number };
type CacheStore = Record<string, CacheEntry>;

const requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS + 2_000;
const maxPersistentCacheEntries = 200;
const memoryCache = new Map<string, CacheEntry>();
const controllersBySession = new Map<string, Set<AbortController>>();
const progressByTab = new Map<number, TranslationProgress>();
const translationAttempts = new Map<
  string,
  { startedAt: number; response: Promise<ExtensionResponse> }
>();
const comparisonTokenByTab = new Map<number, string>();
const COMPARISON_STORAGE_PREFIX = 'comparisonSession:';
const COPY_HANDOFF_STORAGE_PREFIX = 'translatedCopyHandoff:';
const COPY_HANDOFF_TAB_PREFIX = 'translatedCopyTab:';
const COPY_INTENT_STORAGE_PREFIX = 'translatedCopyIntent:';
const RECOVERY_STORAGE_PREFIX = 'translationRecovery:';
const COPY_HANDOFF_TTL_MS = 30_000;
const MAX_SESSION_BUNDLE_BYTES = 2_000_000;
type CopyHandoffSummary = {
  applicationStatus: 'ready' | 'partial' | 'no-matches';
  applicationStage: 'destination-ready';
  discoveredSegments: number;
  appliedSegments: number;
  changedSegments: number;
  providerRequests: 0;
  matchedSegments: number;
  unmatchedSegments: number;
  uncertainSegments: number;
};
const copyHandoffWaiters = new Map<
  string,
  { resolve: (summary: CopyHandoffSummary) => void; reject: (error: Error) => void }
>();
const extensionPageCommandTypes = new Set([
  'GET_TAB_STATUS',
  'GET_API_HEALTH',
  'GET_PROVIDERS',
  'TEST_PROVIDER',
  'OPEN_OPTIONS',
  'GET_SETTINGS',
  'UPDATE_SETTINGS',
  'START_PAGE_TRANSLATION',
  'CONTINUE_PAGE_TRANSLATION',
  'CANCEL_PAGE_TRANSLATION',
  'RESTORE_PAGE',
  'SET_PAGE_VIEW',
  'END_TRANSLATION_SESSION',
  'SCAN_PAGE_CHANGES',
  'UPDATE_CHANGED_SECTIONS',
  'REFRESH_TRANSLATION',
  'OPEN_TRANSLATED_COPY',
  'CREATE_TRANSLATED_COPY_INTENT',
  'RESUME_TRANSLATED_COPY_INTENT',
  'DENY_TRANSLATED_COPY_INTENT',
  'GET_TRANSLATED_COPY_DENIED_ORIGINS',
  'OPEN_TRANSLATED_COPY_FROM_BUNDLE',
  'OPEN_COMPARISON_VIEW',
  'GET_COMPARISON_SESSION',
  'GET_TRANSLATION_PROGRESS',
  'TRANSLATE_SELECTION',
  'CLEAR_LOCAL_DATA',
  'EXPORT_DIAGNOSTICS',
]);

function comparisonStorageKey(token: string): string {
  return `${COMPARISON_STORAGE_PREFIX}${token}`;
}

function copyHandoffStorageKey(token: string): string {
  return `${COPY_HANDOFF_STORAGE_PREFIX}${token}`;
}

function copyHandoffTabKey(tabId: number): string {
  return `${COPY_HANDOFF_TAB_PREFIX}${tabId}`;
}

function copyIntentStorageKey(intentId: string): string {
  return `${COPY_INTENT_STORAGE_PREFIX}${intentId}`;
}

function recoveryStorageKey(tabId: number): string {
  return `${RECOVERY_STORAGE_PREFIX}${tabId}`;
}

async function removeRecoveryRecord(tabId: number): Promise<void> {
  await browser.storage.local.remove(recoveryStorageKey(tabId));
}

async function saveRecoveryRecord(
  tabId: number,
  candidate: TranslationRecoveryRecord,
  senderUrl?: string,
): Promise<void> {
  if ((await getSettings()).privacyMode) {
    await removeRecoveryRecord(tabId);
    return;
  }
  const record = translationRecoveryRecordSchema.parse({
    ...candidate,
    sourceTabId: tabId,
    frameId: 0,
  });
  if (
    recoveryRecordByteLength(record) > MAX_RECOVERY_RECORD_BYTES ||
    (senderUrl && record.navigationIdentity !== (await recoveryNavigationIdentity(senderUrl)))
  ) {
    await removeRecoveryRecord(tabId);
    return;
  }
  const existing = await readRecoveryRecord(tabId);
  if (existing && existing.updatedAt > record.updatedAt) return;
  await browser.storage.local.set({ [recoveryStorageKey(tabId)]: record });
}

async function readRecoveryRecord(tabId: number): Promise<TranslationRecoveryRecord | undefined> {
  const key = recoveryStorageKey(tabId);
  const stored = await browser.storage.local.get(key);
  const record = translationRecoveryRecordSchema.safeParse(stored[key]);
  if (!record.success || recoveryRecordByteLength(record.data) > MAX_RECOVERY_RECORD_BYTES) {
    if (stored[key] !== undefined) await browser.storage.local.remove(key);
    return undefined;
  }
  return record.data;
}

async function cleanupRecoveryRecords(): Promise<void> {
  const stored = await browser.storage.local.get(null);
  const entries = Object.entries(stored).filter(([key]) => key.startsWith(RECOVERY_STORAGE_PREFIX));
  const records: TranslationRecoveryRecord[] = [];
  const invalidKeys: string[] = [];
  for (const [key, value] of entries) {
    const parsed = translationRecoveryRecordSchema.safeParse(value);
    if (!parsed.success) invalidKeys.push(key);
    else records.push(parsed.data);
  }
  const pruned = pruneRecoveryRecords(records);
  const retained = new Set(pruned.retained.map((record) => record.sessionId));
  const obsoleteKeys = records
    .filter((record) => !retained.has(record.sessionId))
    .map((record) => recoveryStorageKey(record.sourceTabId));
  if (invalidKeys.length > 0 || obsoleteKeys.length > 0) {
    await browser.storage.local.remove([...invalidKeys, ...obsoleteKeys]);
  }
}

function bundleByteLength(bundle: TranslationSessionBundle): number {
  return new TextEncoder().encode(JSON.stringify(bundle)).byteLength;
}

function getApiBaseUrl(): string {
  const configured = import.meta.env.WXT_API_BASE_URL;
  return typeof configured === 'string' && configured.length > 0
    ? configured.replace(/\/$/u, '')
    : DEFAULT_API_BASE_URL;
}

function idleProgress(): TranslationProgress {
  return {
    status: 'idle',
    discoveredSegments: 0,
    translatedSegments: 0,
    failedSegments: 0,
  };
}

function createErrorResponse(
  requestId: string,
  code:
    | 'INVALID_MESSAGE'
    | 'UNSUPPORTED_PAGE'
    | 'CONTENT_SCRIPT_UNAVAILABLE'
    | 'BACKEND_UNAVAILABLE'
    | 'REQUEST_TIMEOUT'
    | 'CANCELLED'
    | 'STALE_SESSION'
    | 'AUTH_REQUIRED'
    | 'RATE_LIMITED'
    | 'QUOTA_EXCEEDED'
    | 'PROVIDER_AUTHENTICATION_FAILED'
    | 'PROVIDER_UNAVAILABLE'
    | 'INVALID_PROVIDER_RESPONSE'
    | 'INTERNAL_ERROR',
  message: string,
  retryable: boolean,
  failure?: TranslationFailure,
): ExtensionResponse {
  return extensionResponseSchema.parse({
    version: CONTRACT_VERSION,
    requestId,
    type: 'MESSAGE_ERROR',
    payload: { code, message, retryable, failure },
  });
}

async function getSettings(): Promise<AppSettings> {
  const stored = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
  const parsed = appSettingsSchema.safeParse({
    ...defaultSettings,
    ...(typeof stored[SETTINGS_STORAGE_KEY] === 'object' && stored[SETTINGS_STORAGE_KEY] !== null
      ? stored[SETTINGS_STORAGE_KEY]
      : {}),
  });
  return parsed.success ? parsed.data : defaultSettings;
}

async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const parsed = appSettingsSchema.parse(settings);
  await browser.storage.local.set({ [SETTINGS_STORAGE_KEY]: parsed });
  if (!parsed.persistentCache || parsed.privacyMode) {
    await browser.storage.local.remove(CACHE_STORAGE_KEY);
  }
  return parsed;
}

function isInjectable(status: ReturnType<typeof classifyPageSupport>['status']): boolean {
  return status === 'supported' || status === 'warning' || status === 'unknown';
}

async function ensurePageShell(tabId: number): Promise<void> {
  await browser.scripting.executeScript({ target: { tabId }, files: ['/page-shell.js'] });
}

async function sendContentMessage(tabId: number, message: unknown): Promise<ExtensionResponse> {
  const response = await browser.tabs.sendMessage(tabId, message);
  return extensionResponseSchema.parse(response);
}

async function exportSessionBundle(
  tabId: number,
  sessionId: string,
  requestId: string,
): Promise<TranslationSessionBundle> {
  await ensurePageShell(tabId);
  const response = await sendContentMessage(tabId, {
    version: CONTRACT_VERSION,
    requestId,
    type: 'EXPORT_SESSION_BUNDLE',
    payload: { sessionId },
  });
  if (response.type !== 'SESSION_BUNDLE') {
    throw new Error('The active translation session is unavailable.');
  }
  const bundle = translationSessionBundleSchema.parse(response.payload.bundle);
  if (bundleByteLength(bundle) > MAX_SESSION_BUNDLE_BYTES) {
    throw new Error('The translation session is too large to transfer safely.');
  }
  return bundle;
}

function waitForTabComplete(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error('The new tab did not finish loading.'));
    }, 15_000);
    const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timeout);
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    browser.tabs.onUpdated.addListener(listener);
    void browser.tabs.get(tabId).then((tab) => {
      if (tab.status !== 'complete') return;
      clearTimeout(timeout);
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    });
  });
}

function navigationCompatible(source: string, destination: string): boolean {
  try {
    const sourceUrl = new URL(source);
    const destinationUrl = new URL(destination);
    const normalizePath = (value: string) => value.replace(/\/+$/u, '') || '/';
    const protocolCompatible =
      sourceUrl.protocol === destinationUrl.protocol ||
      (sourceUrl.protocol === 'http:' && destinationUrl.protocol === 'https:');
    const portCompatible =
      sourceUrl.protocol === destinationUrl.protocol
        ? sourceUrl.port === destinationUrl.port
        : (!sourceUrl.port || sourceUrl.port === '80') &&
          (!destinationUrl.port || destinationUrl.port === '443');
    return (
      protocolCompatible &&
      portCompatible &&
      sourceUrl.hostname === destinationUrl.hostname &&
      normalizePath(sourceUrl.pathname) === normalizePath(destinationUrl.pathname)
    );
  } catch {
    return false;
  }
}

function redirectedNavigationCompatible(source: string, destination: string): boolean {
  try {
    const sourceUrl = new URL(source);
    const destinationUrl = new URL(destination);
    const protocolCompatible =
      sourceUrl.protocol === destinationUrl.protocol ||
      (sourceUrl.protocol === 'http:' && destinationUrl.protocol === 'https:');
    const portCompatible =
      sourceUrl.protocol === destinationUrl.protocol
        ? sourceUrl.port === destinationUrl.port
        : (!sourceUrl.port || sourceUrl.port === '80') &&
          (!destinationUrl.port || destinationUrl.port === '443');
    return protocolCompatible && portCompatible && sourceUrl.hostname === destinationUrl.hostname;
  } catch {
    return false;
  }
}

async function copyHandoffIndex(tabId: number) {
  const key = copyHandoffTabKey(tabId);
  const stored = await browser.storage.session.get(key);
  return translatedCopyHandoffIndexSchema.safeParse(stored[key]);
}

async function failCopyHandoff(tabId: number, token: string, message: string): Promise<void> {
  const current = await copyHandoffIndex(tabId);
  if (current.success && current.data.status === 'acknowledged') return;
  await browser.storage.session.remove(copyHandoffStorageKey(token));
  await browser.storage.session.set({
    [copyHandoffTabKey(tabId)]: translatedCopyHandoffIndexSchema.parse({
      version: 1,
      status: 'failed',
      token,
      ...(current.success && current.data.sourceTabId !== undefined
        ? { sourceTabId: current.data.sourceTabId }
        : {}),
      message,
    }),
  });
  copyHandoffWaiters.get(token)?.reject(new Error(message));
  copyHandoffWaiters.delete(token);
}

async function cleanupCopyHandoffForTab(tabId: number): Promise<void> {
  const current = await copyHandoffIndex(tabId);
  const keys = [copyHandoffTabKey(tabId)];
  if (current.success) {
    keys.push(copyHandoffStorageKey(current.data.token));
    copyHandoffWaiters
      .get(current.data.token)
      ?.reject(new Error('The translated-copy tab closed.'));
    copyHandoffWaiters.delete(current.data.token);
  }
  await browser.storage.session.remove(keys);
}

async function waitForCopyAcknowledgement(
  tabId: number,
  token: string,
): Promise<CopyHandoffSummary> {
  return await new Promise<CopyHandoffSummary>((resolve, reject) => {
    const timeout = setTimeout(() => {
      copyHandoffWaiters.delete(token);
      reject(new Error('The translated copy did not acknowledge the saved translation in time.'));
    }, 15_000);
    const settle = {
      resolve: (summary: CopyHandoffSummary) => {
        clearTimeout(timeout);
        copyHandoffWaiters.delete(token);
        resolve(summary);
      },
      reject: (error: Error) => {
        clearTimeout(timeout);
        copyHandoffWaiters.delete(token);
        reject(error);
      },
    };
    copyHandoffWaiters.set(token, settle);
    void copyHandoffIndex(tabId).then((current) => {
      if (!current.success || current.data.token !== token) return;
      if (current.data.status === 'acknowledged') {
        settle.resolve({
          applicationStatus: current.data.applicationStatus,
          applicationStage: current.data.applicationStage,
          discoveredSegments: current.data.discoveredSegments,
          appliedSegments: current.data.appliedSegments,
          changedSegments: current.data.changedSegments,
          providerRequests: current.data.providerRequests,
          matchedSegments: current.data.matchedSegments,
          unmatchedSegments: current.data.unmatchedSegments,
          uncertainSegments: current.data.uncertainSegments,
        });
      } else if (current.data.status === 'failed') {
        settle.reject(new Error(current.data.message));
      }
    });
  });
}

async function openTranslatedCopyFromBundle(
  sourceBundle: TranslationSessionBundle,
  requestId: string,
  sourceTabId?: number,
  hooks?: TranslatedCopyIntentExecutionHooks,
): Promise<ExtensionResponse> {
  const validatedSource = translationSessionBundleSchema.parse(sourceBundle);
  if (bundleByteLength(validatedSource) > MAX_SESSION_BUNDLE_BYTES) {
    throw new Error('The translation session is too large to transfer safely.');
  }
  if (!(await hasTranslatedCopySiteAccess(validatedSource.navigationUrl, browser.permissions))) {
    throw new Error('Site access is required before opening an automatically translated copy.');
  }
  const now = Date.now();
  const clonedBundle = translationSessionBundleSchema.parse({
    ...validatedSource,
    sessionId: createSessionId(),
    createdAt: now,
    lastActivityAt: now,
  });
  const copyTab = await browser.tabs.create({ url: 'about:blank', active: true });
  if (copyTab.id === undefined) throw new Error('The translated copy tab could not be created.');
  const token = `copy_${crypto.randomUUID().replaceAll('-', '')}`;
  const expiresAt = now + COPY_HANDOFF_TTL_MS;
  await browser.storage.session.set({
    [copyHandoffStorageKey(token)]: translatedCopyHandoffRecordSchema.parse({
      version: 1,
      token,
      tabId: copyTab.id,
      ...(sourceTabId === undefined ? {} : { sourceTabId }),
      createdAt: now,
      expiresAt,
      bundle: clonedBundle,
    }),
    [copyHandoffTabKey(copyTab.id)]: translatedCopyHandoffIndexSchema.parse({
      version: 1,
      status: 'pending',
      token,
      ...(sourceTabId === undefined ? {} : { sourceTabId }),
      expiresAt,
    }),
  });
  await hooks?.destinationCreated(copyTab.id);

  try {
    await browser.tabs.update(copyTab.id, { url: validatedSource.navigationUrl });
    await waitForTabComplete(copyTab.id);
    const destinationTab = await browser.tabs.get(copyTab.id);
    if (
      !destinationTab.url ||
      !(await hasTranslatedCopySiteAccess(destinationTab.url, browser.permissions))
    ) {
      throw new Error('The destination site does not have translated-copy access.');
    }
    await hooks?.applyingTranslation(copyTab.id);
    await ensurePageShell(copyTab.id);
    const summary = await waitForCopyAcknowledgement(copyTab.id, token);
    return extensionResponseSchema.parse({
      version: CONTRACT_VERSION,
      requestId,
      type: 'TRANSLATED_COPY_OPENED',
      payload: { tabId: copyTab.id, ...summary },
    });
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : 'The saved translation could not be reused in the new tab.';
    await failCopyHandoff(copyTab.id, token, message);
    throw cause;
  }
}

async function openTranslatedCopy(
  sourceTabId: number,
  sessionId: string,
  requestId: string,
  hooks?: TranslatedCopyIntentExecutionHooks,
): Promise<ExtensionResponse> {
  const [sourceTab, sourceBundle] = await Promise.all([
    browser.tabs.get(sourceTabId),
    exportSessionBundle(sourceTabId, sessionId, createRequestId()),
  ]);
  if (!sourceTab.url || !navigationCompatible(sourceBundle.navigationUrl, sourceTab.url)) {
    throw new Error('The source tab navigation changed before the copy could open.');
  }
  return await openTranslatedCopyFromBundle(sourceBundle, requestId, sourceTabId, hooks);
}

const translatedCopyIntentStore = {
  async get(intentId: string): Promise<TranslatedCopyIntentRecord | undefined> {
    const key = copyIntentStorageKey(intentId);
    const stored = await browser.storage.session.get(key);
    const parsed = translatedCopyIntentRecordSchema.safeParse(stored[key]);
    return parsed.success ? parsed.data : undefined;
  },
  async list(): Promise<TranslatedCopyIntentRecord[]> {
    const stored = await browser.storage.session.get(null);
    return Object.entries(stored).flatMap(([key, value]) => {
      if (!key.startsWith(COPY_INTENT_STORAGE_PREFIX)) return [];
      const parsed = translatedCopyIntentRecordSchema.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    });
  },
  async set(record: TranslatedCopyIntentRecord): Promise<void> {
    const parsed = translatedCopyIntentRecordSchema.parse(record);
    await browser.storage.session.set({ [copyIntentStorageKey(parsed.intentId)]: parsed });
  },
  async remove(intentId: string): Promise<void> {
    await browser.storage.session.remove(copyIntentStorageKey(intentId));
  },
};

const translatedCopyIntentCoordinator = new TranslatedCopyIntentCoordinator(
  translatedCopyIntentStore,
  browser.permissions,
  async (intent, hooks) => {
    const sourceTab = await browser.tabs.get(intent.sourceTabId);
    if (
      !sourceTab.url ||
      (await translatedCopyNavigationIdentity(sourceTab.url)) !== intent.navigationIdentity
    ) {
      throw new Error('The source navigation changed before the translated copy could open.');
    }
    const response = await openTranslatedCopy(
      intent.sourceTabId,
      intent.sessionId,
      createRequestId(),
      hooks,
    );
    if (response.type !== 'TRANSLATED_COPY_OPENED') {
      throw new Error('The translated copy did not reach its final translated state.');
    }
    return { destinationTabId: response.payload.tabId };
  },
);

function translatedCopyIntentStatusResponse(
  requestId: string,
  record: TranslatedCopyIntentRecord,
): ExtensionResponse {
  return extensionResponseSchema.parse({
    version: CONTRACT_VERSION,
    requestId,
    type: 'TRANSLATED_COPY_INTENT_STATUS',
    payload: {
      intentId: record.intentId,
      state: record.state,
      originPattern: record.originPattern,
      ...(record.destinationTabId === undefined
        ? {}
        : { destinationTabId: record.destinationTabId }),
    },
  });
}

async function openComparisonView(
  sourceTabId: number,
  sessionId: string,
  requestId: string,
): Promise<ExtensionResponse> {
  const bundle = await exportSessionBundle(sourceTabId, sessionId, createRequestId());
  const token = `cmp_${crypto.randomUUID().replaceAll('-', '')}`;
  await browser.storage.session.set({ [comparisonStorageKey(token)]: bundle });
  const comparisonTab = await browser.tabs.create({
    url: browser.runtime.getURL(`/comparison.html#${token}`),
    active: true,
  });
  if (comparisonTab.id === undefined) {
    await browser.storage.session.remove(comparisonStorageKey(token));
    throw new Error('The comparison view could not be opened.');
  }
  comparisonTokenByTab.set(comparisonTab.id, token);
  return extensionResponseSchema.parse({
    version: CONTRACT_VERSION,
    requestId,
    type: 'COMPARISON_OPENED',
    payload: { tabId: comparisonTab.id },
  });
}

async function pingPageShell(tabId: number, requestId: string): Promise<boolean> {
  try {
    await ensurePageShell(tabId);
    const response = await sendContentMessage(tabId, {
      version: CONTRACT_VERSION,
      requestId,
      type: 'PING_CONTENT_SCRIPT',
      payload: {},
    });
    return response.type === 'CONTENT_PONG';
  } catch {
    return false;
  }
}

async function getPageProgress(tabId: number, requestId: string): Promise<TranslationProgress> {
  try {
    const response = await sendContentMessage(tabId, {
      version: CONTRACT_VERSION,
      requestId,
      type: 'GET_TRANSLATION_PROGRESS',
      payload: {},
    });
    if (response.type !== 'TRANSLATION_PROGRESS') return progressByTab.get(tabId) ?? idleProgress();
    const current = response.payload.progress;
    if (current.status === 'idle') {
      const [record, tab] = await Promise.all([readRecoveryRecord(tabId), browser.tabs.get(tabId)]);
      if (record && tab.url) {
        const decision = evaluateRecoveryRecord(record, {
          tabId,
          navigationIdentity: await recoveryNavigationIdentity(tab.url),
        });
        if (decision.state === 'recover' || decision.state === 'paused') {
          const recovered = await sendContentMessage(tabId, {
            version: CONTRACT_VERSION,
            requestId,
            type: 'IMPORT_RECOVERY_RECORD',
            payload: { recovery: decision.record },
          });
          if (recovered.type === 'TRANSLATION_PROGRESS') {
            progressByTab.set(tabId, recovered.payload.progress);
            return recovered.payload.progress;
          }
        } else {
          if (decision.remove) await removeRecoveryRecord(tabId);
          return {
            ...idleProgress(),
            recoveryState: decision.state,
            recoveryMessage:
              decision.state === 'expired'
                ? 'The saved translation session expired and was removed.'
                : 'The saved translation no longer matches this page.',
          };
        }
      }
    }
    const stored = progressByTab.get(tabId);
    if (
      current.status === 'idle' &&
      stored?.failure?.reason === 'NAVIGATION_CHANGED' &&
      stored.status !== 'idle'
    ) {
      return stored;
    }
    if (current.status !== 'idle') progressByTab.set(tabId, current);
    return current;
  } catch {
    return progressByTab.get(tabId) ?? idleProgress();
  }
}

async function getTabStatus(tabId: number, requestId: string): Promise<ExtensionResponse> {
  const [tab, settings] = await Promise.all([browser.tabs.get(tabId), getSettings()]);
  const support = classifyPageSupport(tab.url, settings);
  const contentScriptReady = isInjectable(support.status)
    ? await pingPageShell(tabId, requestId)
    : false;
  const progress = contentScriptReady
    ? await getPageProgress(tabId, createRequestId())
    : idleProgress();
  return extensionResponseSchema.parse({
    version: CONTRACT_VERSION,
    requestId,
    type: 'TAB_STATUS',
    payload: {
      tabId,
      title: tab.title ?? '',
      url: tab.url ?? '',
      support,
      contentScriptReady,
      apiStatus: 'unknown',
      progress,
    },
  });
}

async function getApiHealth(requestId: string): Promise<ExtensionResponse> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${getApiBaseUrl()}/v1/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('BACKEND_UNAVAILABLE');
    const health = healthResponseSchema.parse(await response.json());
    return extensionResponseSchema.parse({
      version: CONTRACT_VERSION,
      requestId,
      type: 'API_HEALTH',
      payload: { status: 'available', health },
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === 'AbortError';
    return createErrorResponse(
      requestId,
      timedOut ? 'REQUEST_TIMEOUT' : 'BACKEND_UNAVAILABLE',
      timedOut
        ? 'The backend health check timed out.'
        : 'The local translation service is unavailable.',
      true,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function getProviders(requestId: string): Promise<ExtensionResponse> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${getApiBaseUrl()}/v1/providers`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('BACKEND_UNAVAILABLE');
    const providers = providersResponseSchema.parse(await response.json());
    return extensionResponseSchema.parse({
      version: CONTRACT_VERSION,
      requestId,
      type: 'PROVIDERS',
      payload: providers,
    });
  } catch {
    return createErrorResponse(
      requestId,
      'BACKEND_UNAVAILABLE',
      'Provider configuration is unavailable.',
      true,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function testProvider(requestId: string, providerId: ProviderId): Promise<ExtensionResponse> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${getApiBaseUrl()}/v1/providers/${providerId}/test`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const body = (await response.json()) as unknown;
    if (!response.ok) return mapApiError(requestId, body, providerId);
    const result = providerTestResponseSchema.parse(body);
    return extensionResponseSchema.parse({
      version: CONTRACT_VERSION,
      requestId,
      type: 'PROVIDER_TEST',
      payload: result,
    });
  } catch {
    return createErrorResponse(requestId, 'BACKEND_UNAVAILABLE', 'Provider test failed.', true);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function getDiagnostics(requestId: string): Promise<ExtensionResponse> {
  const settings = await getSettings();
  const healthResponse = await getApiHealth(createRequestId());
  const health = healthResponse.type === 'API_HEALTH' ? healthResponse.payload.health : null;
  let persistentEntries = 0;
  if (settings.persistentCache && !settings.privacyMode) {
    const stored = await browser.storage.local.get(CACHE_STORAGE_KEY);
    const cache = stored[CACHE_STORAGE_KEY];
    if (typeof cache === 'object' && cache !== null && !Array.isArray(cache)) {
      persistentEntries = Object.keys(cache).length;
    }
  }
  return extensionResponseSchema.parse({
    version: CONTRACT_VERSION,
    requestId,
    type: 'DIAGNOSTICS',
    payload: {
      report: {
        generatedAt: new Date().toISOString(),
        extensionVersion: browser.runtime.getManifest().version,
        backend: {
          status: health ? 'available' : 'unavailable',
          translationEnabled: health?.translationEnabled ?? false,
          provider: health?.provider.id ?? 'none',
          modelId: health?.provider.modelId,
        },
        settings: {
          providerId: settings.providerId,
          modelId: settings.modelId,
          privacyMode: settings.privacyMode,
          persistentCache: settings.persistentCache,
          autoTranslateDynamicContent: settings.autoTranslateDynamicContent,
          selectedTextEnabled: settings.selectedTextEnabled,
          domainExclusionCount: settings.domainExclusions.length,
          glossaryEntryCount: settings.glossary.length,
        },
        cache: { memoryEntries: memoryCache.size, persistentEntries },
      },
    },
  });
}

async function loadPersistentCache(settings: AppSettings): Promise<CacheStore> {
  if (!settings.persistentCache || settings.privacyMode) return {};
  const stored = await browser.storage.local.get(CACHE_STORAGE_KEY);
  const value = stored[CACHE_STORAGE_KEY];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, CacheEntry] =>
        typeof entry[1] === 'object' &&
        entry[1] !== null &&
        'translatedText' in entry[1] &&
        typeof entry[1].translatedText === 'string' &&
        entry[1].translatedText.length > 0 &&
        entry[1].translatedText.length <= 16_000 &&
        'createdAt' in entry[1] &&
        typeof entry[1].createdAt === 'number' &&
        Number.isFinite(entry[1].createdAt),
    ),
  );
}

async function persistCache(cache: CacheStore, settings: AppSettings): Promise<void> {
  if (!settings.persistentCache || settings.privacyMode) return;
  const limited = Object.fromEntries(
    Object.entries(cache)
      .sort((left, right) => right[1].createdAt - left[1].createdAt)
      .slice(0, maxPersistentCacheEntries),
  );
  await browser.storage.local.set({ [CACHE_STORAGE_KEY]: limited });
}

function registerController(sessionId: string, controller: AbortController): () => void {
  const controllers = controllersBySession.get(sessionId) ?? new Set<AbortController>();
  controllers.add(controller);
  controllersBySession.set(sessionId, controllers);
  return () => {
    controllers.delete(controller);
    if (controllers.size === 0 && controllersBySession.get(sessionId) === controllers) {
      controllersBySession.delete(sessionId);
    }
  };
}

function cancelSession(sessionId: string): void {
  for (const controller of controllersBySession.get(sessionId) ?? []) controller.abort();
  controllersBySession.delete(sessionId);
}

function mapApiError(
  requestId: string,
  value: unknown,
  requestedProviderId?: ProviderId,
): ExtensionResponse {
  const parsed = errorResponseSchema.safeParse(value);
  if (!parsed.success) {
    return createErrorResponse(
      requestId,
      'BACKEND_UNAVAILABLE',
      'The backend returned an invalid response.',
      true,
    );
  }
  const error = parsed.data.error;
  const providerId = error.details?.providerId ?? requestedProviderId;
  const failureReason: TranslationFailure['reason'] =
    error.code === 'RATE_LIMITED'
      ? error.details?.source === 'local'
        ? 'LOCAL_RATE_LIMIT'
        : 'UPSTREAM_RATE_LIMIT'
      : error.code === 'QUOTA_EXCEEDED'
        ? providerId
          ? 'UPSTREAM_QUOTA_EXHAUSTED'
          : 'UNKNOWN'
        : error.code === 'PROVIDER_AUTHENTICATION_FAILED'
          ? 'AUTHENTICATION_FAILED'
          : error.code === 'PROVIDER_TIMEOUT'
            ? 'PROVIDER_TIMEOUT'
            : error.code === 'PROVIDER_UNAVAILABLE'
              ? 'PROVIDER_UNAVAILABLE'
              : error.code === 'INVALID_PROVIDER_RESPONSE'
                ? 'INVALID_PROVIDER_RESPONSE'
                : error.code === 'CANCELLED'
                  ? 'CANCELLED'
                  : error.code === 'INTERNAL_ERROR'
                    ? 'BACKEND_UNAVAILABLE'
                    : 'UNKNOWN';
  const automaticRetry =
    error.retryable &&
    (failureReason === 'LOCAL_RATE_LIMIT' || failureReason === 'UPSTREAM_RATE_LIMIT');
  const failure: TranslationFailure = {
    reason: failureReason,
    metadata: {
      ...(providerId ? { providerId } : {}),
      ...(error.details?.httpStatus ? { httpStatus: error.details.httpStatus } : {}),
      ...(error.details?.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: error.details.retryAfterSeconds }
        : automaticRetry
          ? { retryAfterSeconds: 5 }
          : {}),
      automaticRetry,
      changingProviderMayHelp:
        failureReason.startsWith('UPSTREAM_') ||
        failureReason.startsWith('PROVIDER_') ||
        failureReason === 'AUTHENTICATION_FAILED' ||
        failureReason === 'INVALID_PROVIDER_RESPONSE',
      requestId: error.requestId,
    },
  };
  const code =
    error.code === 'AUTH_REQUIRED'
      ? 'AUTH_REQUIRED'
      : error.code === 'RATE_LIMITED'
        ? 'RATE_LIMITED'
        : error.code === 'QUOTA_EXCEEDED'
          ? 'QUOTA_EXCEEDED'
          : error.code === 'PROVIDER_AUTHENTICATION_FAILED'
            ? 'PROVIDER_AUTHENTICATION_FAILED'
            : error.code === 'PROVIDER_UNAVAILABLE'
              ? 'PROVIDER_UNAVAILABLE'
              : error.code === 'INVALID_PROVIDER_RESPONSE'
                ? 'INVALID_PROVIDER_RESPONSE'
                : error.code === 'CANCELLED'
                  ? 'CANCELLED'
                  : error.code === 'PROVIDER_TIMEOUT'
                    ? 'REQUEST_TIMEOUT'
                    : 'BACKEND_UNAVAILABLE';
  return createErrorResponse(requestId, code, error.message, error.retryable, failure);
}

async function translateRequest(request: TranslationRequest): Promise<ExtensionResponse> {
  const settings = await getSettings();
  const persistentCache = await loadPersistentCache(settings);
  const translations = new Map<string, string>();
  const uncached = request.segments.filter((segment) => {
    const key = createCacheKey({
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      text: segment.text,
      context: segment.context,
      provider: `${request.providerId ?? settings.providerId}:${request.modelId ?? settings.modelId}`,
      glossaryVersion: request.glossaryVersion,
      tone: request.tone,
      formality: request.formality,
    });
    const cached = memoryCache.get(key) ?? persistentCache[key];
    if (!cached) return true;
    translations.set(segment.id, cached.translatedText);
    memoryCache.set(key, cached);
    return false;
  });

  let detectedSourceLanguage: string | undefined;
  let providerRecovery: TranslationResponse['recovery'];
  if (uncached.length > 0) {
    const controller = new AbortController();
    const unregister = registerController(request.sessionId, controller);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);
    try {
      const response = await fetch(`${getApiBaseUrl()}/v1/translate`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, segments: uncached }),
        signal: controller.signal,
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) return mapApiError(request.requestId, body, request.providerId);
      const parsed = translationResponseSchema.safeParse(body);
      if (!parsed.success) {
        return createErrorResponse(
          request.requestId,
          'INVALID_PROVIDER_RESPONSE',
          'The backend returned an invalid translation response.',
          false,
          {
            reason: 'INVALID_PROVIDER_RESPONSE',
            metadata: {
              providerId: request.providerId,
              requestId: request.requestId,
              automaticRetry: false,
              changingProviderMayHelp: true,
            },
          },
        );
      }
      if (parsed.data.sessionId !== request.sessionId) {
        return createErrorResponse(
          request.requestId,
          'STALE_SESSION',
          'The backend response did not match the active translation session.',
          true,
          {
            reason: 'NAVIGATION_CHANGED',
            metadata: {
              providerId: request.providerId,
              requestId: request.requestId,
              automaticRetry: false,
            },
          },
        );
      }
      detectedSourceLanguage = parsed.data.detectedSourceLanguage;
      providerRecovery = parsed.data.recovery;
      for (const translated of parsed.data.translations) {
        translations.set(translated.id, translated.translatedText);
        const original = request.segments.find((segment) => segment.id === translated.id);
        if (!original) continue;
        const key = createCacheKey({
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          text: original.text,
          context: original.context,
          provider: `${request.providerId ?? settings.providerId}:${request.modelId ?? settings.modelId}`,
          glossaryVersion: request.glossaryVersion,
          tone: request.tone,
          formality: request.formality,
        });
        const entry = { translatedText: translated.translatedText, createdAt: Date.now() };
        memoryCache.set(key, entry);
        persistentCache[key] = entry;
      }
      await persistCache(persistentCache, settings);
    } catch {
      const cancelled = controllersBySession.get(request.sessionId) === undefined;
      const offline = !cancelled && !timedOut && globalThis.navigator?.onLine === false;
      return createErrorResponse(
        request.requestId,
        cancelled ? 'CANCELLED' : timedOut ? 'REQUEST_TIMEOUT' : 'BACKEND_UNAVAILABLE',
        cancelled
          ? 'The translation was cancelled.'
          : timedOut
            ? 'The translation request timed out.'
            : 'The local translation service is unavailable.',
        !cancelled,
        {
          reason: cancelled ? 'CANCELLED' : timedOut ? 'PROVIDER_TIMEOUT' : 'BACKEND_UNAVAILABLE',
          metadata: {
            providerId: request.providerId,
            requestId: request.requestId,
            automaticRetry: false,
            changingProviderMayHelp: false,
            ...(!cancelled && !timedOut
              ? {
                  failureCategory: offline
                    ? ('offline' as const)
                    : ('backend-unavailable' as const),
                }
              : {}),
          },
        },
      );
    } finally {
      clearTimeout(timeout);
      unregister();
    }
  }

  const returnedSegments = request.segments.flatMap((segment) => {
    const translatedText = translations.get(segment.id);
    return translatedText === undefined ? [] : [{ id: segment.id, translatedText }];
  });
  const returnedIds = new Set(returnedSegments.map((translation) => translation.id));
  const missingSegmentIds = request.segments
    .map((segment) => segment.id)
    .filter((id) => !returnedIds.has(id));
  const response: TranslationResponse = translationResponseSchema.parse({
    requestId: request.requestId,
    sessionId: request.sessionId,
    providerId: request.providerId ?? settings.providerId,
    modelId: request.modelId ?? settings.modelId,
    detectedSourceLanguage,
    translations: returnedSegments,
    partial: missingSegmentIds.length > 0,
    ...(providerRecovery
      ? {
          recovery: {
            ...providerRecovery,
            requestedSegmentIds: request.segments.map((segment) => segment.id),
            returnedSegmentIds: returnedSegments.map((translation) => translation.id),
            missingSegmentIds,
            batchSize: request.segments.length,
          },
        }
      : {}),
  });
  return extensionResponseSchema.parse({
    version: CONTRACT_VERSION,
    requestId: request.requestId,
    type: 'TRANSLATION_RESULT',
    payload: { response },
  });
}

async function translateRequestIdempotently(
  request: TranslationRequest,
): Promise<ExtensionResponse> {
  if (!request.operationId || !request.batchId || !request.attemptId) {
    return await translateRequest(request);
  }
  const key = `${request.operationId}:${request.batchId}:${request.attemptId}:${request.navigationGeneration ?? 0}`;
  const existing = translationAttempts.get(key);
  if (existing) return await existing.response;
  const response = translateRequest(request);
  translationAttempts.set(key, { startedAt: Date.now(), response });
  for (const [attemptKey, attempt] of translationAttempts) {
    if (translationAttempts.size <= 128 && attempt.startedAt + 5 * 60_000 > Date.now()) break;
    translationAttempts.delete(attemptKey);
  }
  return await response;
}

async function translateSelection(tabId: number, text: string): Promise<SelectionResult> {
  const settings = await getSettings();
  const sessionId = createSessionId();
  const requestId = createRequestId();
  const response = await translateRequest({
    requestId,
    sessionId,
    providerId: settings.providerId,
    modelId: settings.modelId,
    ...(settings.sourceLanguage === 'auto' ? {} : { sourceLanguage: settings.sourceLanguage }),
    targetLanguage: settings.defaultTargetLanguage,
    mode: 'selection',
    segments: [{ id: 'selection_1', text }],
    glossaryVersion: String(settings.glossaryVersion),
    glossary: settings.glossary,
  });
  if (response.type !== 'TRANSLATION_RESULT') {
    throw new Error(
      response.type === 'MESSAGE_ERROR'
        ? response.payload.message
        : 'Selected-text translation stopped without a result.',
    );
  }
  const translatedText = response.payload.response.translations[0]?.translatedText;
  if (!translatedText) throw new Error('Translation returned no selected text.');
  const result: SelectionResult = {
    sourceText: text,
    translatedText,
    sourceLanguage: response.payload.response.detectedSourceLanguage,
    targetLanguage: settings.defaultTargetLanguage,
  };
  await ensurePageShell(tabId);
  await sendContentMessage(tabId, {
    version: CONTRACT_VERSION,
    requestId: createRequestId(),
    type: 'SHOW_SELECTION_RESULT',
    payload: result,
  });
  return result;
}

export default defineBackground(() => {
  void translatedCopyIntentCoordinator.cleanupAbandoned();
  void cleanupRecoveryRecords();

  browser.permissions.onAdded.addListener((permissions) => {
    void translatedCopyIntentCoordinator.resumeForAddedOrigins(permissions.origins ?? []);
  });

  browser.permissions.onRemoved.addListener((permissions) => {
    void translatedCopyIntentCoordinator.handleRemovedOrigins(permissions.origins ?? []);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    progressByTab.delete(tabId);
    void removeRecoveryRecord(tabId);
    void cleanupCopyHandoffForTab(tabId);
    const token = comparisonTokenByTab.get(tabId);
    comparisonTokenByTab.delete(tabId);
    if (token) void browser.storage.session.remove(comparisonStorageKey(token));
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;
    void readRecoveryRecord(tabId).then(async (record) => {
      if (
        record &&
        record.navigationIdentity !== (await recoveryNavigationIdentity(changeInfo.url!))
      ) {
        cancelSession(record.sessionId);
        progressByTab.delete(tabId);
        await removeRecoveryRecord(tabId);
      }
    });
  });

  void browser.contextMenus
    .remove('translate-selection')
    .catch(() => undefined)
    .then(() => {
      browser.contextMenus.create({
        id: 'translate-selection',
        title: 'Translate selected text',
        contexts: ['selection'],
      });
    });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'translate-selection' || !info.selectionText || tab?.id === undefined)
      return;
    void getSettings().then(async (settings) => {
      if (!settings.selectedTextEnabled) return;
      if (!isInjectable(classifyPageSupport(tab.url, settings).status)) return;
      try {
        await translateSelection(tab.id!, info.selectionText!.slice(0, 10_000));
        await browser.action.setBadgeText({ tabId: tab.id, text: '' });
      } catch {
        await browser.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#B42318' });
        await browser.action.setBadgeText({ tabId: tab.id, text: '!' });
      }
    });
  });

  browser.runtime.onMessage.addListener(async (message: unknown, sender) => {
    const parsed = extensionRequestSchema.safeParse(message);
    const requestId = parsed.success ? parsed.data.requestId : createRequestId();
    if (!parsed.success) {
      return createErrorResponse(
        requestId,
        'INVALID_MESSAGE',
        'The extension message was invalid.',
        false,
      );
    }

    if (
      extensionPageCommandTypes.has(parsed.data.type) &&
      (sender.id !== browser.runtime.id || !sender.url?.startsWith(browser.runtime.getURL('/')))
    ) {
      return createErrorResponse(
        requestId,
        'INVALID_MESSAGE',
        'This command is available only to an extension page.',
        false,
      );
    }

    try {
      switch (parsed.data.type) {
        case 'GET_TAB_STATUS':
          return await getTabStatus(parsed.data.payload.tabId, requestId);
        case 'PING_CONTENT_SCRIPT': {
          const tabId = sender.tab?.id;
          if (tabId === undefined || !(await pingPageShell(tabId, requestId))) {
            return createErrorResponse(
              requestId,
              'CONTENT_SCRIPT_UNAVAILABLE',
              'The page cannot receive extension messages.',
              true,
            );
          }
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'CONTENT_PONG',
            payload: { ready: true, extensionVersion: browser.runtime.getManifest().version },
          });
        }
        case 'GET_API_HEALTH':
          return await getApiHealth(requestId);
        case 'GET_PROVIDERS':
          return await getProviders(requestId);
        case 'TEST_PROVIDER':
          return await testProvider(requestId, parsed.data.payload.providerId);
        case 'OPEN_OPTIONS':
          await browser.runtime.openOptionsPage();
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'OPTIONS_OPENED',
            payload: { opened: true },
          });
        case 'GET_SETTINGS':
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'SETTINGS',
            payload: { settings: await getSettings() },
          });
        case 'UPDATE_SETTINGS': {
          const settings = await saveSettings(parsed.data.payload.settings);
          if (settings.privacyMode) {
            const stored = await browser.storage.local.get(null);
            await browser.storage.local.remove(
              Object.keys(stored).filter((key) => key.startsWith(RECOVERY_STORAGE_PREFIX)),
            );
          }
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'SETTINGS',
            payload: { settings },
          });
        }
        case 'START_PAGE_TRANSLATION': {
          const { tabId, ...payload } = parsed.data.payload;
          const tab = await browser.tabs.get(tabId);
          const support = classifyPageSupport(tab.url, await getSettings());
          if (!isInjectable(support.status)) {
            return createErrorResponse(
              requestId,
              'UNSUPPORTED_PAGE',
              'This page cannot be translated.',
              false,
            );
          }
          progressByTab.delete(tabId);
          await removeRecoveryRecord(tabId);
          await ensurePageShell(tabId);
          return await sendContentMessage(tabId, {
            version: CONTRACT_VERSION,
            requestId,
            type: 'START_PAGE_TRANSLATION',
            payload,
          });
        }
        case 'CONTINUE_PAGE_TRANSLATION': {
          const { tabId, ...payload } = parsed.data.payload;
          await ensurePageShell(tabId);
          const response = await sendContentMessage(tabId, {
            version: CONTRACT_VERSION,
            requestId,
            type: 'CONTINUE_PAGE_TRANSLATION',
            payload,
          });
          if (response.type === 'TRANSLATION_PROGRESS') {
            progressByTab.set(tabId, response.payload.progress);
          }
          return response;
        }
        case 'CANCEL_PAGE_TRANSLATION':
          cancelSession(parsed.data.payload.sessionId);
          return await sendContentMessage(parsed.data.payload.tabId, {
            version: CONTRACT_VERSION,
            requestId,
            type: 'CANCEL_PAGE_TRANSLATION',
            payload: { sessionId: parsed.data.payload.sessionId },
          });
        case 'RESTORE_PAGE':
          return await sendContentMessage(parsed.data.payload.tabId, {
            version: CONTRACT_VERSION,
            requestId,
            type: 'RESTORE_PAGE',
            payload: {},
          });
        case 'SET_PAGE_VIEW': {
          const { tabId, ...payload } = parsed.data.payload;
          const response = await sendContentMessage(tabId, {
            version: CONTRACT_VERSION,
            requestId,
            type: 'SET_PAGE_VIEW',
            payload,
          });
          if (response.type === 'TRANSLATION_PROGRESS') {
            progressByTab.set(tabId, response.payload.progress);
          }
          return response;
        }
        case 'END_TRANSLATION_SESSION': {
          const { tabId, ...payload } = parsed.data.payload;
          cancelSession(payload.sessionId);
          const response = await sendContentMessage(tabId, {
            version: CONTRACT_VERSION,
            requestId,
            type: 'END_TRANSLATION_SESSION',
            payload,
          });
          progressByTab.delete(tabId);
          await removeRecoveryRecord(tabId);
          return response;
        }
        case 'SCAN_PAGE_CHANGES':
        case 'UPDATE_CHANGED_SECTIONS':
        case 'REFRESH_TRANSLATION': {
          const { tabId, ...payload } = parsed.data.payload;
          const response = await sendContentMessage(tabId, {
            version: CONTRACT_VERSION,
            requestId,
            type: parsed.data.type,
            payload,
          });
          if (response.type === 'TRANSLATION_PROGRESS') {
            progressByTab.set(tabId, response.payload.progress);
          }
          return response;
        }
        case 'OPEN_TRANSLATED_COPY':
          return await openTranslatedCopy(
            parsed.data.payload.tabId,
            parsed.data.payload.sessionId,
            requestId,
          );
        case 'CREATE_TRANSLATED_COPY_INTENT': {
          const payload = parsed.data.payload;
          const tab = await browser.tabs.get(payload.tabId);
          const requestedOrigin = translatedCopyOriginPattern(payload.navigationUrl);
          const currentOrigin = translatedCopyOriginPattern(tab.url ?? '');
          if (!requestedOrigin || requestedOrigin !== currentOrigin) {
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'The translated-copy origin no longer matches the source tab.',
              false,
            );
          }
          const record = await translatedCopyIntentCoordinator.create({
            sourceTabId: payload.tabId,
            sessionId: payload.sessionId,
            navigationUrl: payload.navigationUrl,
            providerId: payload.providerId,
            modelId: payload.modelId,
          });
          return translatedCopyIntentStatusResponse(requestId, record);
        }
        case 'RESUME_TRANSLATED_COPY_INTENT': {
          const record = await translatedCopyIntentCoordinator.resume(parsed.data.payload.intentId);
          return record
            ? translatedCopyIntentStatusResponse(requestId, record)
            : createErrorResponse(
                requestId,
                'INVALID_MESSAGE',
                'The translated-copy action is unavailable or expired.',
                false,
              );
        }
        case 'DENY_TRANSLATED_COPY_INTENT': {
          const record = await translatedCopyIntentCoordinator.deny(parsed.data.payload.intentId);
          return record
            ? translatedCopyIntentStatusResponse(requestId, record)
            : createErrorResponse(
                requestId,
                'INVALID_MESSAGE',
                'The translated-copy action is unavailable or expired.',
                false,
              );
        }
        case 'GET_TRANSLATED_COPY_DENIED_ORIGINS':
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'TRANSLATED_COPY_DENIED_ORIGINS',
            payload: { origins: await translatedCopyIntentCoordinator.deniedOrigins() },
          });
        case 'OPEN_TRANSLATED_COPY_FROM_BUNDLE':
          return await openTranslatedCopyFromBundle(
            parsed.data.payload.bundle,
            requestId,
            sender.tab?.id,
          );
        case 'GET_TRANSLATED_COPY_HANDOFF': {
          const tabId = sender.tab?.id;
          const senderUrl = sender.url ?? sender.tab?.url;
          if (
            sender.id !== browser.runtime.id ||
            tabId === undefined ||
            sender.frameId !== 0 ||
            !senderUrl
          ) {
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'The translated-copy destination is invalid.',
              false,
            );
          }
          const index = await copyHandoffIndex(tabId);
          if (!index.success) {
            return extensionResponseSchema.parse({
              version: CONTRACT_VERSION,
              requestId,
              type: 'TRANSLATED_COPY_HANDOFF_STATUS',
              payload: { status: 'none' },
            });
          }
          if (index.data.status === 'failed') {
            return extensionResponseSchema.parse({
              version: CONTRACT_VERSION,
              requestId,
              type: 'TRANSLATED_COPY_HANDOFF_STATUS',
              payload: { status: 'failed', message: index.data.message },
            });
          }
          if (index.data.status === 'acknowledged') {
            return extensionResponseSchema.parse({
              version: CONTRACT_VERSION,
              requestId,
              type: 'TRANSLATED_COPY_HANDOFF_STATUS',
              payload: {
                status: 'already-applied',
                applicationStatus: index.data.applicationStatus,
                applicationStage: index.data.applicationStage,
                discoveredSegments: index.data.discoveredSegments,
                appliedSegments: index.data.appliedSegments,
                changedSegments: index.data.changedSegments,
                providerRequests: index.data.providerRequests,
                matchedSegments: index.data.matchedSegments,
                unmatchedSegments: index.data.unmatchedSegments,
                uncertainSegments: index.data.uncertainSegments,
              },
            });
          }
          if (index.data.expiresAt < Date.now()) {
            await failCopyHandoff(
              tabId,
              index.data.token,
              'The saved translation expired before this page was ready.',
            );
            return extensionResponseSchema.parse({
              version: CONTRACT_VERSION,
              requestId,
              type: 'TRANSLATED_COPY_HANDOFF_STATUS',
              payload: {
                status: 'failed',
                message: 'The saved translation expired before this page was ready.',
              },
            });
          }
          const key = copyHandoffStorageKey(index.data.token);
          const stored = await browser.storage.session.get(key);
          const handoff = translatedCopyHandoffRecordSchema.safeParse(stored[key]);
          if (
            !handoff.success ||
            handoff.data.tabId !== tabId ||
            handoff.data.token !== index.data.token ||
            bundleByteLength(handoff.data.bundle) > MAX_SESSION_BUNDLE_BYTES ||
            !redirectedNavigationCompatible(handoff.data.bundle.navigationUrl, senderUrl)
          ) {
            await failCopyHandoff(
              tabId,
              index.data.token,
              'The saved translation did not match this destination safely.',
            );
            return extensionResponseSchema.parse({
              version: CONTRACT_VERSION,
              requestId,
              type: 'TRANSLATED_COPY_HANDOFF_STATUS',
              payload: {
                status: 'failed',
                message: 'The saved translation did not match this destination safely.',
              },
            });
          }
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'TRANSLATED_COPY_HANDOFF',
            payload: { token: handoff.data.token, bundle: handoff.data.bundle },
          });
        }
        case 'ACK_TRANSLATED_COPY_HANDOFF': {
          const tabId = sender.tab?.id;
          const senderUrl = sender.url ?? sender.tab?.url;
          if (
            sender.id !== browser.runtime.id ||
            tabId === undefined ||
            sender.frameId !== 0 ||
            !senderUrl
          ) {
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'The translated-copy acknowledgment is invalid.',
              false,
            );
          }
          const index = await copyHandoffIndex(tabId);
          if (!index.success || index.data.token !== parsed.data.payload.token) {
            return createErrorResponse(
              requestId,
              'STALE_SESSION',
              'The translated-copy handoff is unavailable.',
              false,
            );
          }
          if (index.data.status === 'acknowledged') {
            return extensionResponseSchema.parse({
              version: CONTRACT_VERSION,
              requestId,
              type: 'TRANSLATED_COPY_ACKNOWLEDGED',
              payload: { acknowledged: true },
            });
          }
          if (index.data.status !== 'pending') {
            return createErrorResponse(
              requestId,
              'STALE_SESSION',
              'The translated-copy handoff is unavailable.',
              false,
            );
          }
          const application = parsed.data.payload;
          const expectedApplicationStatus =
            application.matchedSegments === 0
              ? 'no-matches'
              : application.unmatchedSegments + application.uncertainSegments > 0
                ? 'partial'
                : 'ready';
          if (
            application.applicationStage !== 'destination-ready' ||
            application.applicationStatus !== expectedApplicationStatus ||
            application.appliedSegments !== application.matchedSegments ||
            application.providerRequests !== 0 ||
            application.discoveredSegments !==
              application.matchedSegments +
                application.unmatchedSegments +
                application.uncertainSegments
          ) {
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'The translated-copy application summary is invalid.',
              false,
            );
          }
          const key = copyHandoffStorageKey(index.data.token);
          const stored = await browser.storage.session.get(key);
          const handoff = translatedCopyHandoffRecordSchema.safeParse(stored[key]);
          if (
            !handoff.success ||
            handoff.data.tabId !== tabId ||
            !redirectedNavigationCompatible(handoff.data.bundle.navigationUrl, senderUrl)
          ) {
            await failCopyHandoff(
              tabId,
              index.data.token,
              'The translated-copy acknowledgment did not match this page.',
            );
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'The translated-copy acknowledgment did not match this page.',
              false,
            );
          }
          const summary: CopyHandoffSummary = {
            applicationStatus: parsed.data.payload.applicationStatus,
            applicationStage: parsed.data.payload.applicationStage,
            discoveredSegments: parsed.data.payload.discoveredSegments,
            appliedSegments: parsed.data.payload.appliedSegments,
            changedSegments: parsed.data.payload.changedSegments,
            providerRequests: parsed.data.payload.providerRequests,
            matchedSegments: parsed.data.payload.matchedSegments,
            unmatchedSegments: parsed.data.payload.unmatchedSegments,
            uncertainSegments: parsed.data.payload.uncertainSegments,
          };
          await browser.storage.session.remove(key);
          await browser.storage.session.set({
            [copyHandoffTabKey(tabId)]: translatedCopyHandoffIndexSchema.parse({
              version: 1,
              status: 'acknowledged',
              token: index.data.token,
              ...(index.data.sourceTabId === undefined
                ? {}
                : { sourceTabId: index.data.sourceTabId }),
              ...summary,
            }),
          });
          copyHandoffWaiters.get(index.data.token)?.resolve(summary);
          copyHandoffWaiters.delete(index.data.token);
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'TRANSLATED_COPY_ACKNOWLEDGED',
            payload: { acknowledged: true },
          });
        }
        case 'REJECT_TRANSLATED_COPY_HANDOFF': {
          const tabId = sender.tab?.id;
          if (sender.id !== browser.runtime.id || tabId === undefined || sender.frameId !== 0) {
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'The translated-copy rejection is invalid.',
              false,
            );
          }
          const index = await copyHandoffIndex(tabId);
          if (index.success && index.data.token === parsed.data.payload.token) {
            await failCopyHandoff(
              tabId,
              index.data.token,
              'The saved translation did not match this page safely.',
            );
          }
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'TRANSLATED_COPY_ACKNOWLEDGED',
            payload: { acknowledged: true },
          });
        }
        case 'TRANSLATE_IMPORTED_SECTIONS': {
          const tabId = sender.tab?.id;
          if (sender.id !== browser.runtime.id || tabId === undefined || sender.frameId !== 0) {
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'The translated-copy action is invalid.',
              false,
            );
          }
          const settings = await getSettings();
          return await sendContentMessage(tabId, {
            version: CONTRACT_VERSION,
            requestId,
            type: 'CONTINUE_PAGE_TRANSLATION',
            payload: {
              sessionId: parsed.data.payload.sessionId,
              providerId: settings.providerId,
              modelId: settings.modelId,
              useSmallerBatches: false,
            },
          });
        }
        case 'FOCUS_TRANSLATED_COPY_SOURCE': {
          const tabId = sender.tab?.id;
          if (sender.id !== browser.runtime.id || tabId === undefined || sender.frameId !== 0) {
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'The translated-copy source action is invalid.',
              false,
            );
          }
          const index = await copyHandoffIndex(tabId);
          if (
            !index.success ||
            index.data.token !== parsed.data.payload.token ||
            index.data.sourceTabId === undefined
          ) {
            return createErrorResponse(
              requestId,
              'STALE_SESSION',
              'The source tab is no longer available.',
              false,
            );
          }
          await browser.tabs.update(index.data.sourceTabId, { active: true });
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'TRANSLATED_COPY_ACKNOWLEDGED',
            payload: { acknowledged: true },
          });
        }
        case 'OPEN_COMPARISON_VIEW':
          return await openComparisonView(
            parsed.data.payload.tabId,
            parsed.data.payload.sessionId,
            requestId,
          );
        case 'GET_COMPARISON_SESSION': {
          const { token } = parsed.data.payload;
          const expectedPage = browser.runtime.getURL('/comparison.html');
          if (
            sender.id !== browser.runtime.id ||
            sender.tab?.id === undefined ||
            !sender.url?.startsWith(expectedPage) ||
            comparisonTokenByTab.get(sender.tab.id) !== token
          ) {
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'The comparison session is unavailable.',
              false,
            );
          }
          const key = comparisonStorageKey(token);
          const stored = await browser.storage.session.get(key);
          const bundle = translationSessionBundleSchema.safeParse(stored[key]);
          await browser.storage.session.remove(key);
          comparisonTokenByTab.delete(sender.tab.id);
          if (!bundle.success || bundleByteLength(bundle.data) > MAX_SESSION_BUNDLE_BYTES) {
            return createErrorResponse(
              requestId,
              'STALE_SESSION',
              'The comparison session expired or was invalid.',
              false,
            );
          }
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'COMPARISON_SESSION',
            payload: { bundle: bundle.data },
          });
        }
        case 'GET_TRANSLATION_PROGRESS':
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'TRANSLATION_PROGRESS',
            payload: {
              progress: await getPageProgress(parsed.data.payload.tabId, requestId),
            },
          });
        case 'TRANSLATE_SEGMENTS':
          if (
            sender.id !== browser.runtime.id ||
            sender.tab?.id === undefined ||
            sender.frameId !== 0
          ) {
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'Page sender is missing.',
              false,
            );
          }
          return await translateRequestIdempotently(parsed.data.payload.request);
        case 'REPORT_TRANSLATION_PROGRESS':
          if (
            sender.id !== browser.runtime.id ||
            sender.tab?.id === undefined ||
            sender.frameId !== 0
          ) {
            return createErrorResponse(
              requestId,
              'INVALID_MESSAGE',
              'Page sender is missing.',
              false,
            );
          }
          progressByTab.set(sender.tab.id, parsed.data.payload.progress);
          if (parsed.data.payload.recovery) {
            await saveRecoveryRecord(
              sender.tab.id,
              parsed.data.payload.recovery,
              sender.url ?? sender.tab.url,
            );
          } else if (
            parsed.data.payload.progress.lifecycle === 'ended' ||
            parsed.data.payload.progress.lifecycle === 'invalidated'
          ) {
            await removeRecoveryRecord(sender.tab.id);
          }
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'TRANSLATION_PROGRESS',
            payload: { progress: parsed.data.payload.progress },
          });
        case 'TRANSLATE_SELECTION':
          await translateSelection(parsed.data.payload.tabId, parsed.data.payload.text);
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'TRANSLATION_PROGRESS',
            payload: {
              progress: { ...idleProgress(), status: 'completed', translatedSegments: 1 },
            },
          });
        case 'CLEAR_LOCAL_DATA':
          memoryCache.clear();
          {
            const stored = await browser.storage.local.get(null);
            await browser.storage.local.remove([
              CACHE_STORAGE_KEY,
              ...Object.keys(stored).filter((key) => key.startsWith(RECOVERY_STORAGE_PREFIX)),
            ]);
          }
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'LOCAL_DATA_CLEARED',
            payload: { cleared: true },
          });
        case 'EXPORT_DIAGNOSTICS':
          return await getDiagnostics(requestId);
      }
    } catch (cause) {
      return createErrorResponse(
        requestId,
        'INTERNAL_ERROR',
        cause instanceof Error ? cause.message : 'The extension could not handle the request.',
        true,
      );
    }
  });
});
