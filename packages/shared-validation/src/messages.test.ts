import { describe, expect, it } from 'vitest';
import {
  extensionRequestSchema,
  extensionResponseSchema,
  healthResponseSchema,
  translationProgressSchema,
} from './index';

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

  it('accepts a continuation command that targets only the current session', () => {
    const result = extensionRequestSchema.safeParse({
      version: 1,
      requestId: 'req_continue_popup123',
      type: 'CONTINUE_PAGE_TRANSLATION',
      payload: {
        tabId: 7,
        sessionId: 'session_continue_popup123',
        providerId: 'gemini',
        modelId: 'gemini-2.5-flash',
        useSmallerBatches: true,
      },
    });

    expect(result.success).toBe(true);
  });

  it('retains only privacy-safe normalized failure metadata', () => {
    const result = translationProgressSchema.parse({
      status: 'paused',
      discoveredSegments: 140,
      translatedSegments: 48,
      failedSegments: 4,
      queuedSegments: 88,
      waitingSegments: 4,
      navigationId: 'https://sensitive.example/private?token=do-not-cross',
      failure: {
        reason: 'UPSTREAM_RATE_LIMIT',
        metadata: {
          providerId: 'gemini',
          httpStatus: 429,
          retryAfterSeconds: 18,
          automaticRetry: true,
          requestId: 'req_safe_failure123',
          rawProviderBody: 'must not cross the contract',
          authorization: 'must not cross the contract',
          pageText: 'must not cross the contract',
        },
      },
    });

    expect(result.failure?.metadata).toEqual({
      providerId: 'gemini',
      retryAfterSeconds: 18,
      httpStatus: 429,
      automaticRetry: true,
      requestId: 'req_safe_failure123',
    });
  });
});
