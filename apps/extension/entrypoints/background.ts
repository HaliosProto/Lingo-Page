import { browser } from 'wxt/browser';
import { classifyPageSupport, DEFAULT_API_BASE_URL } from '@translation/shared-config';
import { CONTRACT_VERSION } from '@translation/shared-types';
import {
  extensionRequestSchema,
  extensionResponseSchema,
  healthResponseSchema,
  type ExtensionResponse,
} from '@translation/shared-validation';

const requestTimeoutMs = 5_000;

function createRequestId(): string {
  return `req_worker_${crypto.randomUUID().replaceAll('-', '')}`;
}

function getApiBaseUrl(): string {
  const configured = import.meta.env.WXT_API_BASE_URL;
  return typeof configured === 'string' && configured.length > 0
    ? configured
    : DEFAULT_API_BASE_URL;
}

function createErrorResponse(
  requestId: string,
  code:
    | 'INVALID_MESSAGE'
    | 'UNSUPPORTED_PAGE'
    | 'CONTENT_SCRIPT_UNAVAILABLE'
    | 'BACKEND_UNAVAILABLE'
    | 'REQUEST_TIMEOUT'
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function pingContentScript(tabId: number, requestId: string): Promise<boolean> {
  const tab = await browser.tabs.get(tabId);
  const support = classifyPageSupport(tab.url);
  if (support.status !== 'supported') return false;

  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['/page-shell.js'],
    });
    const response = await withTimeout(
      browser.tabs.sendMessage(tabId, {
        version: CONTRACT_VERSION,
        requestId,
        type: 'PING_CONTENT_SCRIPT',
        payload: {},
      }),
      requestTimeoutMs,
    );
    return extensionResponseSchema.safeParse(response).success;
  } catch {
    return false;
  }
}

async function getTabStatus(tabId: number, requestId: string): Promise<ExtensionResponse> {
  const tab = await browser.tabs.get(tabId);
  const support = classifyPageSupport(tab.url);
  const contentScriptReady =
    support.status === 'supported' ? await pingContentScript(tabId, requestId) : false;
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
    },
  });
}

async function getApiHealth(requestId: string): Promise<ExtensionResponse> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${getApiBaseUrl()}/v1/health`, {
      method: 'GET',
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
    const code =
      cause instanceof Error && cause.name === 'AbortError'
        ? 'REQUEST_TIMEOUT'
        : 'BACKEND_UNAVAILABLE';
    return createErrorResponse(
      requestId,
      code,
      code === 'REQUEST_TIMEOUT'
        ? 'The backend health check timed out.'
        : 'The translation backend is unavailable.',
      true,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export default defineBackground(() => {
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
          return getTabStatus(parsed.data.payload.tabId, requestId);
        case 'PING_CONTENT_SCRIPT': {
          const tabId = sender.tab?.id ?? (await getActiveTab())?.id;
          if (tabId === undefined) {
            return createErrorResponse(
              requestId,
              'CONTENT_SCRIPT_UNAVAILABLE',
              'No active tab is available.',
              false,
            );
          }
          const ready = await pingContentScript(tabId, requestId);
          return ready
            ? extensionResponseSchema.parse({
                version: CONTRACT_VERSION,
                requestId,
                type: 'CONTENT_PONG',
                payload: { ready: true, extensionVersion: browser.runtime.getManifest().version },
              })
            : createErrorResponse(
                requestId,
                'CONTENT_SCRIPT_UNAVAILABLE',
                'The page cannot receive extension messages.',
                true,
              );
        }
        case 'GET_API_HEALTH':
          return getApiHealth(requestId);
        case 'OPEN_OPTIONS':
          await browser.runtime.openOptionsPage();
          return extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'OPTIONS_OPENED',
            payload: { opened: true },
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
