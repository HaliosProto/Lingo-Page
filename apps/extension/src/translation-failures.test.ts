import { describe, expect, it } from 'vitest';
import type { TranslationFailure, TranslationFailureReason } from '@translation/shared-types';
import { failurePresentation, progressLabel, safeFailureDiagnostics } from './translation-failures';

function failure(
  reason: TranslationFailureReason,
  metadata: TranslationFailure['metadata'] = {},
): TranslationFailure {
  return {
    reason,
    metadata: {
      providerId: 'gemini',
      translatedSegments: 48,
      totalSegments: 140,
      failedSegments: 4,
      queuedSegments: 88,
      ...metadata,
    },
  };
}

describe('translation failure explanations', () => {
  it.each([
    [
      'LOCAL_RATE_LIMIT' as const,
      { automaticRetry: true, retryAfterSeconds: 10 },
      'Translation paused because the local service received too many requests at once. Retrying automatically in 10 seconds.',
    ],
    [
      'UPSTREAM_RATE_LIMIT' as const,
      { automaticRetry: true, retryAfterSeconds: 18 },
      'Gemini temporarily limited this translation because too many requests were sent. Your completed sections were preserved. Retrying in 18 seconds.',
    ],
    [
      'UPSTREAM_QUOTA_EXHAUSTED' as const,
      {},
      'Gemini\u2019s usage quota has been exhausted. The translated sections were preserved, but the remaining 92 sections cannot continue until the quota resets or another provider is selected.',
    ],
    [
      'AUTHENTICATION_FAILED' as const,
      {},
      'Gemini rejected the configured API key. Check the backend API-key configuration and restart the local service.',
    ],
    [
      'PROVIDER_TIMEOUT' as const,
      {},
      'Some translation batches took too long and timed out. 48 of 140 sections were translated.',
    ],
    [
      'PROVIDER_UNAVAILABLE' as const,
      {},
      'Gemini is temporarily unavailable. Your completed translations were preserved.',
    ],
    [
      'INVALID_PROVIDER_RESPONSE' as const,
      {},
      'Gemini returned an incomplete response for 4 sections. Those sections were not changed.',
    ],
    [
      'BACKEND_UNAVAILABLE' as const,
      {},
      'The local translation service stopped responding. Restart the local backend, then continue the remaining translation.',
    ],
    [
      'CANCELLED' as const,
      {},
      'Translation was cancelled. 48 of 140 sections had already been translated.',
    ],
    [
      'NAVIGATION_CHANGED' as const,
      {},
      'Translation stopped because the page changed or navigated while translation was running. Stale results were not applied.',
    ],
    [
      'UNSUPPORTED_CONTENT' as const,
      { unsupportedCount: 3 },
      'Some content could not be translated because it is inside protected frames, images, canvas elements, or browser-restricted areas.',
    ],
    [
      'PRIVACY_EXCLUSION' as const,
      { excludedCount: 5 },
      'Some content was skipped for privacy or safety, such as passwords, payment fields, editable inputs, hidden text, or excluded page regions.',
    ],
    [
      'RETRY_EXHAUSTED' as const,
      { causeReason: 'UPSTREAM_RATE_LIMIT' as const },
      'Automatic retries were exhausted. The translated sections were preserved.',
    ],
  ])('renders the exact %s explanation', (reason, metadata, expected) => {
    expect(failurePresentation(failure(reason, metadata)).message).toBe(expected);
  });

  it('keeps partial progress visible instead of resetting it', () => {
    expect(
      progressLabel({
        status: 'partial',
        discoveredSegments: 140,
        translatedSegments: 48,
        failedSegments: 4,
        queuedSegments: 88,
      }),
    ).toBe('48 of 140 sections translated. 92 remain.');
  });

  it('uses the qualified Gemini rate-limit explanation and required recovery actions', () => {
    const presentation = failurePresentation(
      failure('UPSTREAM_RATE_LIMIT', { automaticRetry: true, retryAfterSeconds: 18 }),
    );
    expect(presentation.secondaryMessage).toBe(
      'Gemini\u2019s current API quota or rate limit was reached. This is common with large pages on limited API plans.',
    );
    expect(presentation.actions.map((action) => action.label)).toEqual([
      'Retry automatically',
      'Retry failed sections',
      'Try again later',
      'Change provider',
    ]);
  });

  it('shows translated, remaining, waiting, and retrying progress without resetting counts', () => {
    expect(
      progressLabel({
        status: 'paused',
        discoveredSegments: 140,
        translatedSegments: 48,
        failedSegments: 4,
        queuedSegments: 88,
        waitingSegments: 4,
      }),
    ).toBe('Translation paused at 34%');
    expect(
      progressLabel({
        status: 'retrying',
        discoveredSegments: 140,
        translatedSegments: 48,
        failedSegments: 4,
        retryingSegments: 2,
      }),
    ).toBe('2 sections retrying');
  });

  it('copies only allowlisted technical diagnostics', () => {
    const diagnostics = safeFailureDiagnostics(
      failure('UPSTREAM_RATE_LIMIT', {
        httpStatus: 429,
        requestId: 'req_safe_diagnostics_123',
        retryAttempt: 3,
      }),
    );
    expect(diagnostics).toMatchObject({
      errorCode: 'UPSTREAM_RATE_LIMIT',
      provider: 'Gemini',
      httpStatus: 429,
      requestId: 'req_safe_diagnostics_123',
      retryAttempts: 3,
    });
    expect(JSON.stringify(diagnostics)).not.toMatch(/key|authorization|text|url/iu);
  });
});
