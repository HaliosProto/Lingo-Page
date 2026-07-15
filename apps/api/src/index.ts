import { Hono } from 'hono';
import { DEFAULT_MAX_BODY_BYTES, developmentLanguages } from '@translation/shared-config';
import {
  isAllowedExtensionOrigin,
  parseApiEnvironment,
  type ApiEnvironment,
} from '@translation/shared-config/api';
import type {
  ApiErrorCode,
  HealthResponse,
  LanguageDetectionResult,
  LanguagesResponse,
  TranslationRequest,
  UsageResponse,
} from '@translation/shared-types';
import {
  errorResponseSchema,
  healthResponseSchema,
  languageDetectionRequestSchema,
  languageDetectionResponseSchema,
  languagesResponseSchema,
  translationRequestSchema,
  translationResponseSchema,
  usageResponseSchema,
} from '@translation/shared-validation';
import {
  createDeepLProvider,
  createMockProvider,
  ProviderError,
  type TranslationProvider,
} from '@translation/translation-providers';

export type EnvironmentBindings = Record<string, string | undefined>;

type AppVariables = {
  requestId: string;
  environment: ApiEnvironment;
};

type UsageCounter = { inputCharacters: number; requests: number };
type RateBucket = { windowStartedAt: number; requests: number };

const usageByClient = new Map<string, UsageCounter>();
const rateByClient = new Map<string, RateBucket>();
const maxTrackedClients = 1_000;

const app = new Hono<{
  Bindings: EnvironmentBindings;
  Variables: AppVariables;
}>();

function createRequestId(): string {
  return `req_${crypto.randomUUID().replaceAll('-', '')}`;
}

function createError(code: ApiErrorCode, message: string, requestId: string, retryable = false) {
  return errorResponseSchema.parse({ error: { code, message, requestId, retryable } });
}

function clientKey(context: { req: { header(name: string): string | undefined } }): string {
  return (
    context.req.header('origin') ?? context.req.header('cf-connecting-ip') ?? 'local-development'
  );
}

function isAuthorized(authorization: string | undefined, environment: ApiEnvironment): boolean {
  // Local development is loopback-only and can exercise a real provider without
  // placing a bearer token in the extension bundle. Staging and production require auth.
  const requiresAuthentication =
    environment.ENVIRONMENT === 'staging' ||
    environment.ENVIRONMENT === 'production' ||
    Boolean(environment.DEV_AUTH_TOKEN);
  if (!requiresAuthentication) return true;
  if (!environment.DEV_AUTH_TOKEN) return false;
  return authorization === `Bearer ${environment.DEV_AUTH_TOKEN}`;
}

function checkRateLimit(key: string, environment: ApiEnvironment): boolean {
  const now = Date.now();
  const current = rateByClient.get(key);
  if (!current || now - current.windowStartedAt >= 60_000) {
    if (!rateByClient.has(key) && rateByClient.size >= maxTrackedClients) {
      const oldestKey = rateByClient.keys().next().value;
      if (oldestKey !== undefined) rateByClient.delete(oldestKey);
    }
    rateByClient.set(key, { windowStartedAt: now, requests: 1 });
    return true;
  }
  if (current.requests >= environment.REQUESTS_PER_MINUTE) return false;
  current.requests += 1;
  return true;
}

function createProvider(environment: ApiEnvironment): TranslationProvider | undefined {
  if (!environment.TRANSLATION_ENABLED) return undefined;
  if (environment.TRANSLATION_PROVIDER === 'mock') {
    return createMockProvider({ delayMs: environment.MOCK_TRANSLATION_DELAY_MS });
  }
  if (!environment.DEEPL_API_KEY) return undefined;
  return createDeepLProvider({ apiKey: environment.DEEPL_API_KEY });
}

async function readJsonBody(context: {
  req: { text(): Promise<string>; header(name: string): string | undefined };
}): Promise<{ ok: true; value: unknown } | { ok: false; reason: string; tooLarge: boolean }> {
  if (!context.req.header('content-type')?.toLowerCase().includes('application/json')) {
    return { ok: false, reason: 'Content-Type must be application/json.', tooLarge: false };
  }
  const raw = await context.req.text();
  if (new TextEncoder().encode(raw).byteLength > DEFAULT_MAX_BODY_BYTES) {
    return { ok: false, reason: 'Request body exceeds the development limit.', tooLarge: true };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, reason: 'Request body must be valid JSON.', tooLarge: false };
  }
}

function detectLanguage(
  text: string,
): Pick<LanguageDetectionResult, 'detectedLanguage' | 'confidence'> {
  if (/[پچژگ]/u.test(text)) return { detectedLanguage: 'fa', confidence: 'high' };
  if (/\p{Script=Arabic}/u.test(text)) return { detectedLanguage: 'ar', confidence: 'medium' };
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text)) {
    return { detectedLanguage: 'ja', confidence: 'high' };
  }
  if (/\p{Script=Han}/u.test(text)) return { detectedLanguage: 'zh-CN', confidence: 'medium' };
  if (/\p{Script=Cyrillic}/u.test(text)) return { detectedLanguage: 'ru', confidence: 'high' };
  return { detectedLanguage: 'en', confidence: 'low' };
}

app.use('*', async (context, next) => {
  const requestId = createRequestId();
  const environment = parseApiEnvironment(context.env ?? {});
  context.set('requestId', requestId);
  context.set('environment', environment);
  context.header('X-Content-Type-Options', 'nosniff');
  context.header('X-Frame-Options', 'DENY');
  context.header('Referrer-Policy', 'no-referrer');
  context.header('Cache-Control', 'no-store');
  context.header('X-Request-ID', requestId);
  context.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const origin = context.req.header('origin');
  if (origin && isAllowedExtensionOrigin(origin, environment)) {
    context.header('Access-Control-Allow-Origin', origin);
    context.header('Vary', 'Origin');
    context.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    context.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    context.header('Access-Control-Max-Age', '600');
  }

  if (context.req.method === 'OPTIONS') return context.body(null, 204);

  const contentLength = Number(context.req.header('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > DEFAULT_MAX_BODY_BYTES) {
    return context.json(
      createError('INVALID_REQUEST', 'Request body exceeds the development limit.', requestId),
      413,
    );
  }

  await next();
  return context.res;
});

app.get('/v1/health', (context) => {
  const environment = context.get('environment');
  const configured = Boolean(createProvider(environment));
  const response: HealthResponse = healthResponseSchema.parse({
    version: 1,
    service: 'translation-api',
    status: environment.TRANSLATION_ENABLED && configured ? 'ok' : 'degraded',
    environment: environment.ENVIRONMENT,
    appVersion: environment.APP_VERSION,
    translationEnabled: environment.TRANSLATION_ENABLED,
    provider: {
      configured,
      name: environment.TRANSLATION_ENABLED ? environment.TRANSLATION_PROVIDER : 'none',
    },
    requestId: context.get('requestId'),
  });
  return context.json(response);
});

app.get('/v1/languages', (context) => {
  const response: LanguagesResponse = languagesResponseSchema.parse({
    version: 1,
    languages: developmentLanguages,
    requestId: context.get('requestId'),
  });
  return context.json(response);
});

app.post('/v1/translate', async (context) => {
  const serverRequestId = context.get('requestId');
  const environment = context.get('environment');
  if (!isAuthorized(context.req.header('authorization'), environment)) {
    return context.json(
      createError('AUTH_REQUIRED', 'Backend authentication is required.', serverRequestId),
      401,
    );
  }
  const provider = createProvider(environment);
  if (!environment.TRANSLATION_ENABLED) {
    return context.json(
      createError('TRANSLATION_DISABLED', 'Translation is disabled.', serverRequestId),
      503,
    );
  }
  if (!provider) {
    return context.json(
      createError(
        'PROVIDER_UNAVAILABLE',
        'Translation provider is not configured.',
        serverRequestId,
      ),
      503,
    );
  }

  const body = await readJsonBody(context);
  if (!body.ok) {
    return context.json(
      createError('INVALID_REQUEST', body.reason, serverRequestId),
      body.tooLarge ? 413 : 400,
    );
  }
  const parsed = translationRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return context.json(
      createError('INVALID_REQUEST', 'Translation request failed validation.', serverRequestId),
      400,
    );
  }
  const request: TranslationRequest = parsed.data;
  const inputCharacters = request.segments.reduce(
    (total, segment) => total + segment.text.length,
    0,
  );
  if (
    request.segments.length > environment.MAX_SEGMENTS_PER_REQUEST ||
    inputCharacters > environment.MAX_INPUT_CHARACTERS_PER_REQUEST
  ) {
    return context.json(
      createError(
        'INVALID_REQUEST',
        'Translation request exceeds configured limits.',
        request.requestId,
      ),
      413,
    );
  }

  const key = clientKey(context);
  if (!checkRateLimit(key, environment)) {
    return context.json(
      createError(
        'RATE_LIMITED',
        'Too many translation requests. Try again shortly.',
        request.requestId,
        true,
      ),
      429,
    );
  }
  const usage = usageByClient.get(key) ?? { inputCharacters: 0, requests: 0 };
  if (usage.inputCharacters + inputCharacters > environment.CHARACTERS_PER_SESSION) {
    return context.json(
      createError('QUOTA_EXCEEDED', 'Development character quota reached.', request.requestId),
      429,
    );
  }

  try {
    const response = translationResponseSchema.parse(
      await provider.translate(request, { signal: context.req.raw.signal }),
    );
    const outputCharacters = response.translations.reduce(
      (total, translation) => total + translation.translatedText.length,
      0,
    );
    if (outputCharacters > environment.MAX_OUTPUT_CHARACTERS_PER_REQUEST) {
      return context.json(
        createError(
          'INVALID_PROVIDER_RESPONSE',
          'Provider response exceeds output limits.',
          request.requestId,
        ),
        502,
      );
    }
    usage.inputCharacters += inputCharacters;
    usage.requests += 1;
    if (!usageByClient.has(key) && usageByClient.size >= maxTrackedClients) {
      const oldestKey = usageByClient.keys().next().value;
      if (oldestKey !== undefined) usageByClient.delete(oldestKey);
    }
    usageByClient.set(key, usage);
    return context.json(response);
  } catch (error) {
    if (error instanceof ProviderError) {
      if (error.code === 'cancelled') {
        return context.json(createError('CANCELLED', error.message, request.requestId), 408);
      }
      if (error.code === 'timeout') {
        return context.json(
          createError('PROVIDER_TIMEOUT', error.message, request.requestId, true),
          504,
        );
      }
      if (error.code === 'rate-limited') {
        return context.json(
          createError('RATE_LIMITED', error.message, request.requestId, true),
          429,
        );
      }
      if (error.code === 'quota-exceeded') {
        return context.json(createError('QUOTA_EXCEEDED', error.message, request.requestId), 429);
      }
      if (error.code === 'invalid-response') {
        return context.json(
          createError('INVALID_PROVIDER_RESPONSE', error.message, request.requestId, true),
          502,
        );
      }
      return context.json(
        createError('PROVIDER_UNAVAILABLE', error.message, request.requestId, error.retryable),
        503,
      );
    }
    throw error;
  }
});

app.post('/v1/detect-language', async (context) => {
  const body = await readJsonBody(context);
  if (!body.ok) {
    return context.json(
      createError('INVALID_REQUEST', body.reason, context.get('requestId')),
      body.tooLarge ? 413 : 400,
    );
  }
  const parsed = languageDetectionRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return context.json(
      createError(
        'INVALID_REQUEST',
        'Language detection request failed validation.',
        context.get('requestId'),
      ),
      400,
    );
  }
  const response: LanguageDetectionResult = languageDetectionResponseSchema.parse({
    requestId: parsed.data.requestId,
    ...detectLanguage(parsed.data.text),
  });
  return context.json(response);
});

app.get('/v1/usage', (context) => {
  const environment = context.get('environment');
  if (!isAuthorized(context.req.header('authorization'), environment)) {
    return context.json(
      createError('AUTH_REQUIRED', 'Backend authentication is required.', context.get('requestId')),
      401,
    );
  }
  const usage = usageByClient.get(clientKey(context)) ?? { inputCharacters: 0, requests: 0 };
  const response: UsageResponse = usageResponseSchema.parse({
    requestId: context.get('requestId'),
    period: 'development-session',
    ...usage,
    requestLimit: environment.REQUESTS_PER_MINUTE,
    characterLimit: environment.CHARACTERS_PER_SESSION,
  });
  return context.json(response);
});

app.notFound((context) =>
  context.json(
    createError(
      'INVALID_REQUEST',
      'The requested API route does not exist.',
      context.get('requestId'),
    ),
    404,
  ),
);

app.onError((error, context) => {
  // Operational logging intentionally excludes credentials, request bodies, and page content.
  console.error('api_request_failed', {
    requestId: context.get('requestId'),
    error: error instanceof Error ? error.name : 'unknown',
  });
  return context.json(
    createError(
      'INTERNAL_ERROR',
      'The API could not complete the request.',
      context.get('requestId'),
      true,
    ),
    500,
  );
});

export { app };

export default { fetch: app.fetch };
