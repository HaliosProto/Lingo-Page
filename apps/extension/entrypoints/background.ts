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
  SelectionResult,
  TranslationProgress,
  TranslationRequest,
  TranslationResponse,
} from '@translation/shared-types';
import { CONTRACT_VERSION } from '@translation/shared-types';
import { createCacheKey } from '@translation/translation-core';
import {
  appSettingsSchema,
  errorResponseSchema,
  extensionRequestSchema,
  extensionResponseSchema,
  healthResponseSchema,
  translationResponseSchema,
  type ExtensionResponse,
} from '@translation/shared-validation';

type CacheEntry = { translatedText: string; createdAt: number };
type CacheStore = Record<string, CacheEntry>;

const requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS + 2_000;
const maxPersistentCacheEntries = 200;
const memoryCache = new Map<string, CacheEntry>();
const controllersBySession = new Map<string, Set<AbortController>>();

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
    | 'INTERNAL_ERROR',
  message: string,
  retryable: boolean,
): ExtensionResponse {
  return extensionResponseSchema.parse({
    version: CONTRACT_VERSION,
    requestId,
    type: 'MESSAGE_ERROR',
    payload: { code, message, retryable },
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
    return response.type === 'TRANSLATION_PROGRESS' ? response.payload.progress : idleProgress();
  } catch {
    return idleProgress();
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
    if (controllers.size === 0) controllersBySession.delete(sessionId);
  };
}

function cancelSession(sessionId: string): void {
  for (const controller of controllersBySession.get(sessionId) ?? []) controller.abort();
  controllersBySession.delete(sessionId);
}

function mapApiError(requestId: string, value: unknown): ExtensionResponse {
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
  const code =
    error.code === 'AUTH_REQUIRED'
      ? 'AUTH_REQUIRED'
      : error.code === 'RATE_LIMITED'
        ? 'RATE_LIMITED'
        : error.code === 'QUOTA_EXCEEDED'
          ? 'QUOTA_EXCEEDED'
          : error.code === 'CANCELLED'
            ? 'CANCELLED'
            : error.code === 'PROVIDER_TIMEOUT'
              ? 'REQUEST_TIMEOUT'
              : 'BACKEND_UNAVAILABLE';
  return createErrorResponse(requestId, code, error.message, error.retryable);
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
      provider: 'backend',
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
      if (!response.ok) return mapApiError(request.requestId, body);
      const parsed = translationResponseSchema.safeParse(body);
      if (!parsed.success || parsed.data.sessionId !== request.sessionId) {
        return createErrorResponse(
          request.requestId,
          'STALE_SESSION',
          'The backend response did not match the active translation session.',
          true,
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
          provider: 'backend',
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
      );
    } finally {
      clearTimeout(timeout);
      unregister();
    }
  }

  const response: TranslationResponse = translationResponseSchema.parse({
    requestId: request.requestId,
    sessionId: request.sessionId,
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
    ...(settings.sourceLanguage === 'auto' ? {} : { sourceLanguage: settings.sourceLanguage }),
    targetLanguage: settings.defaultTargetLanguage,
    mode: 'selection',
    segments: [{ id: 'selection_1', text }],
    glossaryVersion: String(settings.glossaryVersion),
    glossary: settings.glossary,
  });
  if (response.type !== 'TRANSLATION_RESULT') {
    throw new Error(
      response.type === 'MESSAGE_ERROR' ? response.payload.message : 'Translation failed.',
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
          await ensurePageShell(tabId);
          return await sendContentMessage(tabId, {
            version: CONTRACT_VERSION,
            requestId,
            type: 'START_PAGE_TRANSLATION',
            payload,
          });
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
