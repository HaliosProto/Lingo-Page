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
  ProviderId,
  ProviderModelsResponse,
  ProvidersResponse,
  ProviderTestResponse,
  TranslationRequest,
  TranslationResponse,
  UsageResponse,
} from '@translation/shared-types';
import {
  errorResponseSchema,
  healthResponseSchema,
  languageDetectionRequestSchema,
  languageDetectionResponseSchema,
  languagesResponseSchema,
  providerIdSchema,
  providerModelsResponseSchema,
  providersResponseSchema,
  providerTestResponseSchema,
  translationRequestSchema,
  translationResponseSchema,
  usageResponseSchema,
} from '@translation/shared-validation';
import {
  createProviderFromConfig,
  isProviderConfigured,
  ProviderError,
  selectProviderConfig,
  toProviderDefinition,
  type ProviderRuntimeConfig,
} from '@translation/translation-providers';
import { createProviderConfigs } from './provider-config';

export type EnvironmentBindings = Record<string, string | undefined>;

type AppVariables = { requestId: string; environment: ApiEnvironment };
type UsageCounter = { inputCharacters: number; requests: number };
type RateBucket = { windowStartedAt: number; requests: number };
type DiscoveryCache = { expiresAt: number; models: ProviderModelsResponse['models'] };

const usageByClient = new Map<string, UsageCounter>();
const dailyUsageByProvider = new Map<string, number>();
const rateByClient = new Map<string, RateBucket>();
const activeByProvider = new Map<ProviderId, number>();
const modelDiscoveryCache = new Map<ProviderId, DiscoveryCache>();
const maxTrackedClients = 1_000;

const app = new Hono<{ Bindings: EnvironmentBindings; Variables: AppVariables }>();

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
  const requiresAuthentication =
    environment.ENVIRONMENT === 'staging' ||
    environment.ENVIRONMENT === 'production' ||
    Boolean(environment.DEV_AUTH_TOKEN);
  if (!requiresAuthentication) return true;
  return (
    Boolean(environment.DEV_AUTH_TOKEN) && authorization === `Bearer ${environment.DEV_AUTH_TOKEN}`
  );
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

function parseProviderQuotas(value: string): Map<ProviderId, number> {
  const quotas = new Map<ProviderId, number>();
  for (const item of value.split(',')) {
    const [rawId, rawLimit] = item.split(':').map((part) => part.trim());
    const id = providerIdSchema.safeParse(rawId);
    const limit = Number(rawLimit);
    if (id.success && Number.isInteger(limit) && limit > 0) quotas.set(id.data, limit);
  }
  return quotas;
}

function acquireProviderSlot(providerId: ProviderId, limit: number): (() => void) | undefined {
  const active = activeByProvider.get(providerId) ?? 0;
  if (active >= limit) return undefined;
  activeByProvider.set(providerId, active + 1);
  return () => {
    const next = (activeByProvider.get(providerId) ?? 1) - 1;
    if (next <= 0) activeByProvider.delete(providerId);
    else activeByProvider.set(providerId, next);
  };
}

function resolveDefaultProviderId(
  environment: ApiEnvironment,
  configs: readonly ProviderRuntimeConfig[],
): ProviderId {
  const configured = configs.find(
    (config) =>
      config.id === environment.TRANSLATION_DEFAULT_PROVIDER &&
      config.enabled &&
      isProviderConfigured(config),
  );
  if (configured) return configured.id;
  if (environment.ENVIRONMENT === 'development' || environment.ENVIRONMENT === 'test') {
    const mock = configs.find((config) => config.id === 'mock' && config.enabled);
    if (mock) return 'mock';
  }
  return environment.TRANSLATION_DEFAULT_PROVIDER;
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
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text))
    return { detectedLanguage: 'ja', confidence: 'high' };
  if (/\p{Script=Han}/u.test(text)) return { detectedLanguage: 'zh-CN', confidence: 'medium' };
  if (/\p{Script=Cyrillic}/u.test(text)) return { detectedLanguage: 'ru', confidence: 'high' };
  return { detectedLanguage: 'en', confidence: 'low' };
}

function providerErrorResponse(error: ProviderError, requestId: string) {
  if (error.code === 'cancelled')
    return { status: 408 as const, body: createError('CANCELLED', error.message, requestId) };
  if (error.code === 'timeout')
    return {
      status: 504 as const,
      body: createError('PROVIDER_TIMEOUT', error.message, requestId, true),
    };
  if (error.code === 'rate-limited')
    return {
      status: 429 as const,
      body: createError('RATE_LIMITED', error.message, requestId, true),
    };
  if (error.code === 'quota-exceeded')
    return { status: 429 as const, body: createError('QUOTA_EXCEEDED', error.message, requestId) };
  if (error.code === 'invalid-response')
    return {
      status: 502 as const,
      body: createError('INVALID_PROVIDER_RESPONSE', error.message, requestId, error.retryable),
    };
  return {
    status: 503 as const,
    body: createError('PROVIDER_UNAVAILABLE', error.message, requestId, error.retryable),
  };
}

async function executeTranslation(
  request: TranslationRequest,
  environment: ApiEnvironment,
  configs: ProviderRuntimeConfig[],
  signal: AbortSignal,
): Promise<TranslationResponse> {
  const providerId = request.providerId ?? resolveDefaultProviderId(environment, configs);
  const config = selectProviderConfig(configs, providerId, request.modelId);
  const release = acquireProviderSlot(providerId, environment.MAX_CONCURRENT_PROVIDER_REQUESTS);
  if (!release)
    throw new ProviderError('rate-limited', 'Provider concurrency limit reached.', true);
  try {
    return translationResponseSchema.parse(
      await createProviderFromConfig(config).translate(request, { signal }),
    );
  } finally {
    release();
  }
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
  const configs = createProviderConfigs(environment);
  const providerId = resolveDefaultProviderId(environment, configs);
  const config = configs.find((candidate) => candidate.id === providerId);
  const configured = Boolean(config?.enabled && isProviderConfigured(config));
  const response: HealthResponse = healthResponseSchema.parse({
    version: 1,
    service: 'translation-api',
    status: environment.TRANSLATION_ENABLED && configured ? 'ok' : 'degraded',
    environment: environment.ENVIRONMENT,
    appVersion: environment.APP_VERSION,
    translationEnabled: environment.TRANSLATION_ENABLED,
    provider: {
      configured,
      id: environment.TRANSLATION_ENABLED ? providerId : 'none',
      displayName: environment.TRANSLATION_ENABLED
        ? (config?.displayName ?? 'Unavailable')
        : 'None',
      ...(configured && config?.defaultModel ? { modelId: config.defaultModel } : {}),
    },
    requestId: context.get('requestId'),
  });
  return context.json(response);
});

app.get('/v1/providers', (context) => {
  const environment = context.get('environment');
  const configs = createProviderConfigs(environment);
  const response: ProvidersResponse = providersResponseSchema.parse({
    version: 1,
    providers: configs.map(toProviderDefinition),
    defaultProviderId: resolveDefaultProviderId(environment, configs),
    requestId: context.get('requestId'),
  });
  return context.json(response);
});

app.get('/v1/providers/:providerId/models', async (context) => {
  const environment = context.get('environment');
  const id = providerIdSchema.safeParse(context.req.param('providerId'));
  if (!id.success)
    return context.json(
      createError('INVALID_REQUEST', 'Unknown provider.', context.get('requestId')),
      404,
    );
  const configs = createProviderConfigs(environment);
  const config = configs.find((candidate) => candidate.id === id.data);
  if (!config)
    return context.json(
      createError('INVALID_REQUEST', 'Unknown provider.', context.get('requestId')),
      404,
    );
  let models = toProviderDefinition(config).availableModels;
  let source: ProviderModelsResponse['source'] = 'configured';
  const refreshRequested = context.req.query('refresh') === 'true';
  if (refreshRequested && !isAuthorized(context.req.header('authorization'), environment)) {
    return context.json(
      createError('AUTH_REQUIRED', 'Backend authentication is required.', context.get('requestId')),
      401,
    );
  }
  if (refreshRequested && config.enabled && isProviderConfigured(config) && config.modelListPath) {
    const cached = modelDiscoveryCache.get(id.data);
    if (cached && cached.expiresAt > Date.now()) {
      models = cached.models;
      source = 'discovered-cache';
    } else {
      try {
        const discovered = await createProviderFromConfig(config).discoverModels?.({
          signal: context.req.raw.signal,
        });
        if (discovered) {
          models = discovered;
          modelDiscoveryCache.set(id.data, {
            models,
            expiresAt: Date.now() + environment.MODEL_DISCOVERY_CACHE_SECONDS * 1_000,
          });
          source = 'discovered-live';
        }
      } catch {
        source = 'configured';
      }
    }
  }
  const response: ProviderModelsResponse = providerModelsResponseSchema.parse({
    version: 1,
    providerId: id.data,
    models,
    source,
    requestId: context.get('requestId'),
  });
  return context.json(response);
});

app.post('/v1/providers/:providerId/test', async (context) => {
  const environment = context.get('environment');
  const requestId = context.get('requestId');
  if (!isAuthorized(context.req.header('authorization'), environment)) {
    return context.json(
      createError('AUTH_REQUIRED', 'Backend authentication is required.', requestId),
      401,
    );
  }
  const providerTestBody = await context.req.text();
  if (providerTestBody.trim() && providerTestBody.trim() !== '{}') {
    return context.json(
      createError('INVALID_REQUEST', 'Provider tests do not accept custom input.', requestId),
      400,
    );
  }
  const id = providerIdSchema.safeParse(context.req.param('providerId'));
  if (!id.success)
    return context.json(createError('INVALID_REQUEST', 'Unknown provider.', requestId), 404);
  const configs = createProviderConfigs(environment);
  const config = configs.find((candidate) => candidate.id === id.data);
  if (!config?.defaultModel)
    return context.json(
      createError('PROVIDER_UNAVAILABLE', 'Provider is not configured.', requestId),
      503,
    );
  const started = Date.now();
  const testRequest: TranslationRequest = {
    requestId,
    sessionId: `session_test_${crypto.randomUUID().replaceAll('-', '')}`,
    providerId: id.data,
    modelId: config.defaultModel,
    sourceLanguage: 'en',
    targetLanguage: 'fa',
    mode: 'selection',
    segments: [{ id: 'controlled_test', text: 'Hello.' }],
  };
  try {
    await executeTranslation(testRequest, environment, configs, context.req.raw.signal);
    const response: ProviderTestResponse = providerTestResponseSchema.parse({
      version: 1,
      providerId: id.data,
      modelId: config.defaultModel,
      status: 'ok',
      latencyMs: Date.now() - started,
      requestId,
    });
    return context.json(response);
  } catch (error) {
    if (error instanceof ProviderError) {
      const mapped = providerErrorResponse(error, requestId);
      return context.json(mapped.body, mapped.status);
    }
    throw error;
  }
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
  if (!environment.TRANSLATION_ENABLED) {
    return context.json(
      createError('TRANSLATION_DISABLED', 'Translation is disabled.', serverRequestId),
      503,
    );
  }
  const body = await readJsonBody(context);
  if (!body.ok)
    return context.json(
      createError('INVALID_REQUEST', body.reason, serverRequestId),
      body.tooLarge ? 413 : 400,
    );
  const parsed = translationRequestSchema.safeParse(body.value);
  if (!parsed.success)
    return context.json(
      createError('INVALID_REQUEST', 'Translation request failed validation.', serverRequestId),
      400,
    );
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
  const configs = createProviderConfigs(environment);
  const providerId = request.providerId ?? resolveDefaultProviderId(environment, configs);
  const dailyKey = `${new Date().toISOString().slice(0, 10)}:${providerId}`;
  const providerQuota = parseProviderQuotas(environment.PROVIDER_CHARACTER_QUOTAS).get(providerId);
  if (
    providerQuota &&
    (dailyUsageByProvider.get(dailyKey) ?? 0) + inputCharacters > providerQuota
  ) {
    return context.json(
      createError('QUOTA_EXCEEDED', 'Provider daily character quota reached.', request.requestId),
      429,
    );
  }
  try {
    const response = await executeTranslation(
      request,
      environment,
      configs,
      context.req.raw.signal,
    );
    const outputCharacters = response.translations.reduce(
      (total, item) => total + item.translatedText.length,
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
    dailyUsageByProvider.set(dailyKey, (dailyUsageByProvider.get(dailyKey) ?? 0) + inputCharacters);
    return context.json(response);
  } catch (error) {
    if (error instanceof ProviderError) {
      const mapped = providerErrorResponse(error, request.requestId);
      return context.json(mapped.body, mapped.status);
    }
    throw error;
  }
});

app.post('/v1/detect-language', async (context) => {
  const body = await readJsonBody(context);
  if (!body.ok)
    return context.json(
      createError('INVALID_REQUEST', body.reason, context.get('requestId')),
      body.tooLarge ? 413 : 400,
    );
  const parsed = languageDetectionRequestSchema.safeParse(body.value);
  if (!parsed.success)
    return context.json(
      createError(
        'INVALID_REQUEST',
        'Language detection request failed validation.',
        context.get('requestId'),
      ),
      400,
    );
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
