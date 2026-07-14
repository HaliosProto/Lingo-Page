import { describe, expect, it } from 'vitest';
import { app } from './index';

const environment = {
  ENVIRONMENT: 'test',
  APP_VERSION: '0.1.0-test',
  ALLOWED_EXTENSION_IDS: '',
  TRANSLATION_ENABLED: 'false',
};

describe('API shell', () => {
  it('returns validated health data', async () => {
    const response = await app.request('http://localhost/v1/health', {}, environment);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      service: 'translation-api',
      status: 'ok',
      environment: 'test',
      translationEnabled: false,
    });
    expect(response.headers.get('x-request-id')).toMatch(/^req_/);
  });

  it('returns the deterministic development language list', async () => {
    const response = await app.request('http://localhost/v1/languages', {}, environment);
    const body = (await response.json()) as { languages: Array<{ code: string }> };

    expect(response.status).toBe(200);
    expect(body.languages.map((language) => language.code)).toContain('fa');
  });

  it('does not fake translation success', async () => {
    const response = await app.request(
      'http://localhost/v1/translate',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
      environment,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(501);
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
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
