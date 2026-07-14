import { describe, expect, it } from 'vitest';
import { extensionRequestSchema, extensionResponseSchema, healthResponseSchema } from './index';

describe('shared runtime validation', () => {
  it('accepts a valid popup request', () => {
    const result = extensionRequestSchema.safeParse({
      version: 1,
      requestId: 'req_test_popup123',
      type: 'GET_API_HEALTH',
      payload: {},
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown message types', () => {
    const result = extensionRequestSchema.safeParse({
      version: 1,
      requestId: 'req_test_popup123',
      type: 'TRANSLATE_EVERYTHING',
      payload: {},
    });

    expect(result.success).toBe(false);
  });

  it('rejects malformed health data', () => {
    const result = healthResponseSchema.safeParse({
      version: 1,
      service: 'translation-api',
      status: 'ok',
      environment: 'development',
      appVersion: '0.1.0',
      translationEnabled: 'false',
      provider: { configured: false, name: 'none' },
      requestId: 'not-a-request-id',
    });

    expect(result.success).toBe(false);
  });

  it('accepts a validated content response', () => {
    const result = extensionResponseSchema.safeParse({
      version: 1,
      requestId: 'req_test_content123',
      type: 'CONTENT_PONG',
      payload: { ready: true, extensionVersion: '0.1.0' },
    });

    expect(result.success).toBe(true);
  });
});
