import type { AppSettings, PageSupport, SupportedLanguage } from '@translation/shared-types';

export const CONTRACT_VERSION = 1 as const;
export const DEFAULT_APP_VERSION = '0.1.0';
export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
export const DEFAULT_MAX_BODY_BYTES = 256_000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const SETTINGS_STORAGE_KEY = 'appSettings';
export const CACHE_STORAGE_KEY = 'translationCache';

export const developmentLanguages: readonly SupportedLanguage[] = [
  { code: 'en', name: 'English', direction: 'ltr', detectable: true },
  { code: 'fa', name: 'Persian', direction: 'rtl', detectable: true },
  { code: 'ar', name: 'Arabic', direction: 'rtl', detectable: true },
  { code: 'de', name: 'German', direction: 'ltr', detectable: true },
  { code: 'es', name: 'Spanish', direction: 'ltr', detectable: true },
  { code: 'fr', name: 'French', direction: 'ltr', detectable: true },
  { code: 'ja', name: 'Japanese', direction: 'ltr', detectable: true },
  { code: 'zh-CN', name: 'Chinese (Simplified)', direction: 'ltr', detectable: true },
  { code: 'it', name: 'Italian', direction: 'ltr', detectable: true },
  { code: 'pt', name: 'Portuguese', direction: 'ltr', detectable: true },
  { code: 'ru', name: 'Russian', direction: 'ltr', detectable: true },
];

export const defaultSettings: AppSettings = {
  providerId: 'mock',
  modelId: 'mock-deterministic',
  defaultTargetLanguage: 'en',
  sourceLanguage: 'auto',
  theme: 'system',
  reducedMotion: false,
  privacyMode: false,
  sensitivePageProtection: true,
  persistentCache: false,
  autoTranslateDynamicContent: true,
  selectedTextEnabled: true,
  domainExclusions: [],
  glossaryVersion: 0,
  glossary: [],
};

function isExcludedHostname(hostname: string, exclusions: string[]): boolean {
  return exclusions.some((entry) => {
    const normalized = entry.trim().toLowerCase().replace(/^\*\./, '');
    return (
      normalized.length > 0 && (hostname === normalized || hostname.endsWith(`.${normalized}`))
    );
  });
}

export function isLikelySensitivePage(url: URL): boolean {
  const value = `${url.hostname}${url.pathname}`.toLowerCase();
  return /(bank|wallet|payment|checkout|login|signin|auth|account|health|patient|medical|mail|inbox|message|chat|admin|internal|dashboard)/.test(
    value,
  );
}

export function classifyPageSupport(
  url: string | undefined,
  settings: Pick<
    AppSettings,
    'domainExclusions' | 'privacyMode' | 'sensitivePageProtection'
  > = defaultSettings,
): PageSupport {
  if (!url) {
    return { status: 'unknown', reason: 'missing-url' };
  }

  if (url.startsWith('chrome-extension://')) {
    return { status: 'unsupported', reason: 'extension-page' };
  }

  if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) {
    return { status: 'unsupported', reason: 'browser-internal-page' };
  }

  if (
    url.startsWith('https://chrome.google.com/webstore') ||
    url.startsWith('https://webstore.google.com')
  ) {
    return { status: 'unsupported', reason: 'chrome-web-store' };
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    const parsed = new URL(url);
    if (isExcludedHostname(parsed.hostname.toLowerCase(), settings.domainExclusions)) {
      return { status: 'unsupported', reason: 'domain-excluded' };
    }
    if (settings.sensitivePageProtection && isLikelySensitivePage(parsed)) {
      return { status: settings.privacyMode ? 'unsupported' : 'warning', reason: 'sensitive-page' };
    }
    return { status: 'supported', reason: 'ordinary-web-page' };
  }

  return { status: 'unsupported', reason: 'browser-internal-page' };
}

export function createRequestId(random: () => string = () => crypto.randomUUID()): string {
  return `req_${random().replaceAll('-', '')}`;
}

export function createSessionId(random: () => string = () => crypto.randomUUID()): string {
  return `session_${random().replaceAll('-', '')}`;
}
