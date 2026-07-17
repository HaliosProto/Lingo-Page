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
  TranslationRequest,
  TranslationResponse,
  TranslationSessionBundle,
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
  translationSessionBundleSchema,
  type ExtensionResponse,
} from '@translation/shared-validation';

type CacheEntry = { translatedText: string; createdAt: number };
type CacheStore = Record<string, CacheEntry>;

const requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS + 2_000;
const maxPersistentCacheEntries = 200;
const memoryCache = new Map<string, CacheEntry>();
const controllersBySession = new Map<string, Set<AbortController>>();
const progressByTab = new Map<number, TranslationProgress>();
const comparisonTokenByTab = new Map<number, string>();
const COMPARISON_STORAGE_PREFIX = 'comparisonSession:';
const MAX_SESSION_BUNDLE_BYTES = 2_000_000;
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

async function openTranslatedCopy(
  sourceTabId: number,
  sessionId: string,
  requestId: string,
): Promise<ExtensionResponse> {
  const [sourceTab, sourceBundle] = await Promise.all([
    browser.tabs.get(sourceTabId),
    exportSessionBundle(sourceTabId, sessionId, createRequestId()),
  ]);
  if (!sourceTab.url || sourceTab.url !== sourceBundle.navigationUrl) {
    throw new Error('The source tab navigation changed before the copy could open.');
  }
  const copyTab = await browser.tabs.create({ url: sourceTab.url, active: true });
  if (copyTab.id === undefined) throw new Error('The translated copy tab could not be created.');
  try {
    await waitForTabComplete(copyTab.id);
    await ensurePageShell(copyTab.id);
    const now = Date.now();
    const clonedBundle = translationSessionBundleSchema.parse({
      ...sourceBundle,
      sessionId: createSessionId(),
      createdAt: now,
      lastActivityAt: now,
    });
    const response = await sendContentMessage(copyTab.id, {
      version: CONTRACT_VERSION,
      requestId: createRequestId(),
      type: 'IMPORT_SESSION_BUNDLE',
      payload: { bundle: clonedBundle },
    });
    if (response.type !== 'TRANSLATION_PROGRESS') {
      throw new Error('The translated copy did not match the source page safely.');
    }
    progressByTab.set(copyTab.id, response.payload.progress);
    const uncertainSegments = response.payload.progress.changed?.uncertainSegments ?? 0;
    return extensionResponseSchema.parse({
      version: CONTRACT_VERSION,
      requestId,
      type: 'TRANSLATED_COPY_OPENED',
      payload: {
        tabId: copyTab.id,
        matchedSegments: response.payload.progress.translatedSegments,
        unmatchedSegments: Math.max(
          0,
          response.payload.progress.discoveredSegments -
            response.payload.progress.translatedSegments -
            uncertainSegments,
        ),
        uncertainSegments,
      },
    });
  } catch (cause) {
    await browser.tabs.remove(copyTab.id).catch(() => undefined);
    throw cause;
  }
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
          },
        },
      );
    } finally {
      clearTimeout(timeout);
      unregister();
    }
  }

  const response: TranslationResponse = translationResponseSchema.parse({
    requestId: request.requestId,
    sessionId: request.sessionId,
    providerId: request.providerId ?? settings.providerId,
    modelId: request.modelId ?? settings.modelId,
    detectedSourceLanguage,
    translations: request.segments.map((segment) => ({
      id: segment.id,
      translatedText: translations.get(segment.id),
    })),
  });
  return extensionResponseSchema.parse({
    version: CONTRACT_VERSION,
    requestId: request.requestId,
    type: 'TRANSLATION_RESULT',
    payload: { response },
  });
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
  browser.tabs.onRemoved.addListener((tabId) => {
    progressByTab.delete(tabId);
    const token = comparisonTokenByTab.get(tabId);
    comparisonTokenByTab.delete(tabId);
    if (token) void browser.storage.session.remove(comparisonStorageKey(token));
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
        case 'UPDATE_SETTINGS':
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'SETTINGS',
            payload: { settings: await saveSettings(parsed.data.payload.settings) },
          });
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
          return await translateRequest(parsed.data.payload.request);
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
          await browser.storage.local.remove(CACHE_STORAGE_KEY);
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
