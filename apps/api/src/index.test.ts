import { describe, expect, it } from 'vitest';
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
      provider: { configured: true, name: 'mock' },
    });
    expect(response.headers.get('x-request-id')).toMatch(/^req_/);
    expect(JSON.stringify(body)).not.toContain('DEV_AUTH_TOKEN');
  });

  it('returns the development language list', async () => {
    const response = await app.request('http://localhost/v1/languages', {}, environment);
    const body = (await response.json()) as { languages: Array<{ code: string }> };
    expect(response.status).toBe(200);
    expect(body.languages.map((language) => language.code)).toContain('fa');
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
      translations: Array<{ translatedText: string }>;
    };
    expect(response.status).toBe(200);
    expect(body.sessionId).toBe(requestBody.sessionId);
    expect(body.translations[0]?.translatedText).toBe('[fa] Hello');
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
      { ...environment, TRANSLATION_PROVIDER: 'deepl', DEEPL_API_KEY: 'server-secret' },
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
