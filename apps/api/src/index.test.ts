import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from './index';

const environment = {
  ENVIRONMENT: 'test',
  APP_VERSION: '0.1.0-test',
  ALLOWED_EXTENSION_IDS: '',
  TRANSLATION_ENABLED: 'true',
  TRANSLATION_PROVIDER: 'mock',
};

const requestBody = {
  requestId: 'req_api_test_12345',
  sessionId: 'session_api_test_12345',
  targetLanguage: 'fa',
  mode: 'page',
  segments: [{ id: 'segment-1', text: 'Hello' }],
};

const geminiEnvironment = {
  ...environment,
  TRANSLATION_DEFAULT_PROVIDER: 'gemini',
  ENABLED_PROVIDERS: 'gemini',
  GEMINI_API_KEY: 'synthetic-gemini-test-key',
  GEMINI_DEFAULT_MODEL: 'gemini-test-model',
  GEMINI_ALLOWED_MODELS: 'gemini-test-model, gemini-test-model-2',
  CUSTOM_OPENAI_BASE_URL: '',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('translation API', () => {
  it('returns validated health data without exposing configuration values', async () => {
    const response = await app.request('http://localhost/v1/health', {}, environment);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      service: 'translation-api',
      status: 'ok',
      environment: 'test',
      translationEnabled: true,
      provider: { configured: true, id: 'mock', modelId: 'mock-deterministic' },
    });
    expect(response.headers.get('x-request-id')).toMatch(/^req_/);
    expect(JSON.stringify(body)).not.toContain('DEV_AUTH_TOKEN');
  });

  it('returns healthy Gemini configuration data with blank optional templates', async () => {
    const response = await app.request('http://localhost/v1/health', {}, geminiEnvironment);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      provider: { configured: true, id: 'gemini', modelId: 'gemini-test-model' },
    });
    expect(response.headers.get('x-request-id')).toMatch(/^req_/);
  });

  it('returns the development language list', async () => {
    const response = await app.request('http://localhost/v1/languages', {}, environment);
    const body = (await response.json()) as { languages: Array<{ code: string }> };
    expect(response.status).toBe(200);
    expect(body.languages.map((language) => language.code)).toContain('fa');
  });

  it('returns a safe provider registry with honest unconfigured states', async () => {
    const response = await app.request('http://localhost/v1/providers', {}, environment);
    const body = (await response.json()) as {
      providers: Array<{ id: string; configured: boolean; enabled: boolean; status: string }>;
    };
    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(14);
    expect(body.providers.find((provider) => provider.id === 'mock')).toMatchObject({
      configured: true,
      enabled: true,
      status: 'ready',
    });
    expect(body.providers.find((provider) => provider.id === 'openai')).toMatchObject({
      configured: false,
      enabled: false,
      status: 'unconfigured',
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('API_KEY');
    expect(serialized).not.toContain('api.openai.com');
  });

  it('returns configured Gemini registry data and parses a comma-separated model allowlist', async () => {
    const response = await app.request('http://localhost/v1/providers', {}, geminiEnvironment);
    const body = (await response.json()) as {
      providers: Array<{
        id: string;
        configured: boolean;
        status: string;
        availableModels: Array<{ id: string }>;
      }>;
    };

    expect(response.status).toBe(200);
    const gemini = body.providers.find((provider) => provider.id === 'gemini');
    expect(gemini).toMatchObject({ configured: true, status: 'ready' });
    expect(gemini?.availableModels.map((model) => model.id)).toEqual([
      'gemini-test-model',
      'gemini-test-model-2',
    ]);
    expect(JSON.stringify(body)).not.toContain('synthetic-gemini-test-key');
  });

  it('returns a structured request-ID error and safe diagnostics for malformed environment values', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const malformedValue = 'not-a-valid-url';
    const response = await app.request(
      'http://localhost/v1/health',
      {},
      { ...environment, CUSTOM_OPENAI_BASE_URL: malformedValue },
    );
    const body = (await response.json()) as { error: { code: string; requestId: string } };

    expect(response.status).toBe(500);
    expect(body.error).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(body.error.requestId).toMatch(/^req_/);
    expect(response.headers.get('x-request-id')).toBe(body.error.requestId);
    expect(error).toHaveBeenCalledWith(
      'api_environment_validation_failed',
      expect.objectContaining({
        requestId: body.error.requestId,
        schemaName: 'apiEnvironmentSchema',
        issues: [
          expect.objectContaining({
            path: 'CUSTOM_OPENAI_BASE_URL',
            expected: 'url',
            receivedCategory: 'string',
            message: 'Invalid URL',
          }),
        ],
      }),
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain(malformedValue);
  });

  it('returns only configured allowlisted model metadata', async () => {
    const response = await app.request(
      'http://localhost/v1/providers/mock/models',
      {},
      environment,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      providerId: 'mock',
      source: 'configured',
      models: [{ id: 'mock-deterministic', enabled: true }],
    });
  });

  it('requires backend authentication before a live model-discovery refresh', async () => {
    const response = await app.request(
      'http://localhost/v1/providers/openai/models?refresh=true',
      {},
      {
        ...environment,
        ENVIRONMENT: 'production',
        DEV_AUTH_TOKEN: 'test-token',
        OPENAI_API_KEY: 'server-secret',
        OPENAI_DEFAULT_MODEL: 'allowed-model',
        OPENAI_ALLOWED_MODELS: 'allowed-model',
      },
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
  });

  it('translates a validated batch through the deterministic mock provider', async () => {
    const response = await app.request(
      'http://localhost/v1/translate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'chrome-extension://api-test' },
        body: JSON.stringify(requestBody),
      },
      environment,
    );
    const body = (await response.json()) as {
      sessionId: string;
      providerId: string;
      modelId: string;
      translations: Array<{ translatedText: string }>;
    };
    expect(response.status).toBe(200);
    expect(body.sessionId).toBe(requestBody.sessionId);
    expect(body.providerId).toBe('mock');
    expect(body.modelId).toBe('mock-deterministic');
    expect(body.translations[0]?.translatedText).toBe('[fa] Hello');
  });

  it('classifies a local backend 429 with a real retry delay', async () => {
    const limitedEnvironment = { ...environment, REQUESTS_PER_MINUTE: '1' };
    const origin = 'chrome-extension://local-rate-limit-test';
    const first = await app.request(
      'http://localhost/v1/translate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ ...requestBody, requestId: 'req_local_limit_first_12345' }),
      },
      limitedEnvironment,
    );
    expect(first.status).toBe(200);

    const second = await app.request(
      'http://localhost/v1/translate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ ...requestBody, requestId: 'req_local_limit_second_12345' }),
      },
      limitedEnvironment,
    );
    const body = (await second.json()) as {
      error: {
        code: string;
        retryable: boolean;
        details: { source: string; httpStatus: number; retryAfterSeconds: number };
      };
    };
    expect(second.status).toBe(429);
    expect(body.error).toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true,
      details: { source: 'local', httpStatus: 429 },
    });
    expect(body.error.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it.each([
    [401, 401, 'PROVIDER_AUTHENTICATION_FAILED', false],
    [402, 429, 'QUOTA_EXCEEDED', false],
    [429, 429, 'RATE_LIMITED', true],
    [503, 503, 'PROVIDER_UNAVAILABLE', true],
  ])(
    'normalizes an upstream HTTP %s with safe provider diagnostics',
    async (upstreamStatus, apiStatus, code, retryable) => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response('secret upstream response', {
            status: upstreamStatus,
            headers: upstreamStatus === 429 ? { 'Retry-After': '18' } : {},
          }),
        ),
      );
      const response = await app.request(
        'http://localhost/v1/translate',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: `chrome-extension://upstream-${upstreamStatus}-test`,
          },
          body: JSON.stringify({
            ...requestBody,
            requestId: `req_upstream_${upstreamStatus}_12345`,
            providerId: 'gemini',
            modelId: 'gemini-test-model',
          }),
        },
        geminiEnvironment,
      );
      const body = (await response.json()) as {
        error: {
          code: string;
          retryable: boolean;
          details: Record<string, unknown>;
        };
      };
      expect(response.status).toBe(apiStatus);
      expect(body.error).toMatchObject({
        code,
        retryable,
        details: {
          source: 'provider',
          providerId: 'gemini',
          httpStatus: upstreamStatus,
        },
      });
      if (upstreamStatus === 429) {
        expect(body.error.details.retryAfterSeconds).toBe(18);
      }
      expect(JSON.stringify(body)).not.toContain('secret upstream response');
      expect(JSON.stringify(body)).not.toContain('synthetic-gemini-test-key');
    },
  );

  it('rejects extension-invented model identifiers', async () => {
    const response = await app.request(
      'http://localhost/v1/translate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...requestBody, providerId: 'mock', modelId: 'invented-model' }),
      },
      environment,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PROVIDER_UNAVAILABLE' },
    });
  });

  it('runs provider tests with fixed backend-controlled input only', async () => {
    const success = await app.request(
      'http://localhost/v1/providers/mock/test',
      { method: 'POST' },
      environment,
    );
    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toMatchObject({
      providerId: 'mock',
      modelId: 'mock-deterministic',
      status: 'ok',
    });

    const rejected = await app.request(
      'http://localhost/v1/providers/mock/test',
      { method: 'POST', body: JSON.stringify({ text: 'arbitrary page content' }) },
      environment,
    );
    expect(rejected.status).toBe(400);
  });

  it('rejects malformed requests without echoing body content', async () => {
    const response = await app.request(
      'http://localhost/v1/translate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secretPageText: 'do-not-echo' }),
      },
      environment,
    );
    const text = await response.text();
    expect(response.status).toBe(400);
    expect(text).toContain('INVALID_REQUEST');
    expect(text).not.toContain('do-not-echo');
  });

  it('provides deterministic local language detection', async () => {
    const response = await app.request(
      'http://localhost/v1/detect-language',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: 'req_detect_12345', text: 'سلام، چطور هستید؟' }),
      },
      environment,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ detectedLanguage: 'fa' });
  });

  it('requires backend authentication for non-mock providers', async () => {
    const response = await app.request(
      'http://localhost/v1/translate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      {
        ...environment,
        ENVIRONMENT: 'production',
        TRANSLATION_PROVIDER: 'deepl',
        DEEPL_API_KEY: 'server-secret',
        DEV_AUTH_TOKEN: 'test-token',
      },
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
  });

  it('returns structured errors for unknown routes', async () => {
    const response = await app.request('http://localhost/v1/unknown', {}, environment);
    const body = (await response.json()) as { error: { code: string; requestId: string } };
    expect(response.status).toBe(404);
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(body.error.requestId).toMatch(/^req_/);
  });

  it('handles development CORS narrowly', async () => {
    const response = await app.request(
      'http://localhost/v1/health',
      { headers: { origin: 'chrome-extension://abcdefghijklmnopqrstuvwxzy123456' } },
      environment,
    );
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'chrome-extension://abcdefghijklmnopqrstuvwxzy123456',
    );
  });
});
