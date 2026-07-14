import { z } from 'zod';
import type { AppSettings, PageSupport, SupportedLanguage } from '@translation/shared-types';

export const CONTRACT_VERSION = 1 as const;
export const DEFAULT_APP_VERSION = '0.1.0';
export const DEFAULT_API_BASE_URL = 'http://localhost:8787';
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

export const apiEnvironmentSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_VERSION: z.string().min(1).max(64).default(DEFAULT_APP_VERSION),
  ALLOWED_EXTENSION_IDS: z.string().default(''),
  TRANSLATION_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .default('true')
    .transform((value) => value === 'true'),
  TRANSLATION_PROVIDER: z.enum(['mock', 'deepl']).default('mock'),
  DEV_AUTH_TOKEN: z.string().max(500).optional(),
  DEEPL_API_KEY: z.string().max(500).optional(),
  OPENAI_API_KEY: z.string().max(500).optional(),
  GOOGLE_TRANSLATE_API_KEY: z.string().max(500).optional(),
  AZURE_TRANSLATOR_KEY: z.string().max(500).optional(),
  AZURE_TRANSLATOR_REGION: z.string().max(100).optional(),
  MAX_SEGMENTS_PER_REQUEST: z.coerce.number().int().positive().max(5_000).default(500),
  MAX_INPUT_CHARACTERS_PER_REQUEST: z.coerce
    .number()
    .int()
    .positive()
    .max(1_000_000)
    .default(20_000),
  MAX_OUTPUT_CHARACTERS_PER_REQUEST: z.coerce
    .number()
    .int()
    .positive()
    .max(2_000_000)
    .default(60_000),
  REQUESTS_PER_MINUTE: z.coerce.number().int().positive().max(1_000).default(30),
  CHARACTERS_PER_SESSION: z.coerce.number().int().positive().max(10_000_000).default(200_000),
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function parseApiEnvironment(input: Record<string, unknown>): ApiEnvironment {
  return apiEnvironmentSchema.parse(input);
}

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
  settings: Pick<AppSettings, 'domainExclusions' | 'sensitivePageProtection'> = defaultSettings,
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
      return { status: 'warning', reason: 'sensitive-page' };
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

export function isAllowedExtensionOrigin(origin: string, environment: ApiEnvironment): boolean {
  if (!origin) {
    return false;
  }

  if (environment.ENVIRONMENT === 'development' || environment.ENVIRONMENT === 'test') {
    return (
      origin.startsWith('chrome-extension://') ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    );
  }

  const allowedIds = environment.ALLOWED_EXTENSION_IDS.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return allowedIds.some((id) => origin === `chrome-extension://${id}`);
}
