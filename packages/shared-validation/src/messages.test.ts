import { describe, expect, it } from 'vitest';
import {
  extensionRequestSchema,
  extensionResponseSchema,
  healthResponseSchema,
  translationSessionBundleSchema,
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

  it('validates bounded translation-session bundles and rejects unsafe navigation', () => {
    const bundle = {
      version: 1,
      sessionId: 'session_bundle_test123',
      navigationUrl: 'https://example.test/article',
      pageFingerprint: 'fp_page123',
      pageTitle: 'Example article',
      sourceLanguage: 'en',
      targetLanguage: 'fa',
      providerId: 'mock',
      modelId: 'mock-deterministic',
      createdAt: 1,
      lastActivityAt: 2,
      displayMode: 'translated',
      lifecycle: 'complete',
      partial: false,
      segments: [
        {
          id: 'seg_0_example',
          sourceFingerprint: 'fp_source',
          structuralFingerprint: 'fp_structure',
          originalText: 'Hello',
          sourceText: 'Hello',
          translatedText: 'سلام',
          elementRole: 'p',
          status: 'translated',
        },
      ],
    };

    expect(translationSessionBundleSchema.safeParse(bundle).success).toBe(true);
    expect(
      translationSessionBundleSchema.safeParse({ ...bundle, navigationUrl: 'javascript:alert(1)' })
        .success,
    ).toBe(false);
    expect(
      translationSessionBundleSchema.safeParse({
        ...bundle,
        segments: Array.from({ length: 2_501 }, () => bundle.segments[0]),
      }).success,
    ).toBe(false);
  });

  it('requires a session identity for every view-changing command', () => {
    const valid = extensionRequestSchema.safeParse({
      version: 1,
      requestId: 'req_view_switch123',
      type: 'SET_PAGE_VIEW',
      payload: {
        tabId: 8,
        sessionId: 'session_view_switch123',
        displayMode: 'original',
      },
    });
    const forged = extensionRequestSchema.safeParse({
      version: 1,
      requestId: 'req_view_switch124',
      type: 'SET_PAGE_VIEW',
      payload: { tabId: 8, displayMode: 'translated' },
    });

    expect(valid.success).toBe(true);
    expect(forged.success).toBe(false);
  });
});
