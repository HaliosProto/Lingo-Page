import { describe, expect, it } from 'vitest';
import type {
  TranslationFailure,
  TranslationResponse,
  TranslationSegment,
} from '@translation/shared-types';
import {
  estimateBatchCost,
  providerAwareBatchLimits,
  runAdaptiveTranslationRecovery,
  type AdaptiveAttemptOutcome,
  type AdaptiveRecoveryUpdate,
} from './adaptive-translation-recovery';

function segments(count: number, length = 12): TranslationSegment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `segment-${index}`,
    text: `Text ${index} ${'x'.repeat(length)}`,
  }));
}

function response(
  requested: TranslationSegment[],
  returned = requested,
  classification: NonNullable<
    TranslationResponse['recovery']
  >['classification'] = returned.length === requested.length ? 'complete' : 'valid-partial',
): TranslationResponse {
  const returnedIds = new Set(returned.map((segment) => segment.id));
  return {
    requestId: 'req_adaptive_recovery_12345',
    sessionId: 'session_adaptive_recovery_12345',
    providerId: 'gemini',
    modelId: 'gemini-test',
    translations: returned.map((segment) => ({
      id: segment.id,
      translatedText: `[fr] ${segment.id}`,
    })),
    partial: returned.length !== requested.length,
    recovery: {
      classification,
      requestedSegmentIds: requested.map((segment) => segment.id),
      returnedSegmentIds: returned.map((segment) => segment.id),
      missingSegmentIds: requested
        .filter((segment) => !returnedIds.has(segment.id))
        .map((segment) => segment.id),
      duplicateSegmentIds: [],
      unknownSegmentIds: [],
      emptySegmentIds: [],
      parseFailure: classification === 'malformed-json' || classification === 'truncated-json',
      responseTruncated: classification === 'truncated-json',
      inputCharacters: requested.reduce((total, segment) => total + segment.text.length, 0),
      estimatedInputTokens: 100,
      estimatedOutputTokens: 200,
      responseBytes: 500,
      batchSize: requested.length,
    },
  };
}

function failure(
  reason: TranslationFailure['reason'],
  metadata: TranslationFailure['metadata'] = {},
): AdaptiveAttemptOutcome {
  return {
    ok: false,
    retryable: !['AUTHENTICATION_FAILED', 'UPSTREAM_QUOTA_EXHAUSTED'].includes(reason),
    failure: { reason, metadata },
  };
}

async function run(input: {
  values: TranslationSegment[];
  send: (batch: TranslationSegment[], depth: number) => Promise<AdaptiveAttemptOutcome>;
  updates?: AdaptiveRecoveryUpdate[];
  applied?: string[];
  cancelled?: () => boolean;
  wait?: (seconds: number) => Promise<void>;
}) {
  return runAdaptiveTranslationRecovery({
    segments: input.values,
    providerId: 'gemini',
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    send: input.send,
    apply: (translations) => {
      input.applied?.push(...translations.map((item) => item.id));
    },
    update: (update) => {
      input.updates?.push(update);
    },
    cancelled: input.cancelled,
    wait: input.wait,
  });
}

describe('adaptive incomplete-response recovery', () => {
  it('1. accepts a complete 50-record response normally', async () => {
    const values = segments(50);
    const applied: string[] = [];
    const result = await run({
      values,
      applied,
      send: async (batch) => ({ ok: true, response: response(batch) }),
    });
    expect(result.unresolvedSegments).toEqual([]);
    expect(applied).toHaveLength(50);
    expect(result.retryAttempts).toBe(0);
  });

  it('2. preserves valid records from a partial response', async () => {
    const values = segments(10);
    const applied: string[] = [];
    await run({
      values,
      applied,
      send: async (batch) => ({ ok: true, response: response(batch, batch.slice(0, 6)) }),
    });
    expect(new Set(applied)).toEqual(new Set(values.map((segment) => segment.id)));
  });

  it('3. retries only missing IDs', async () => {
    const values = segments(8);
    const sent: string[][] = [];
    await run({
      values,
      send: async (batch, depth) => {
        sent.push(batch.map((segment) => segment.id));
        return { ok: true, response: response(batch, depth === 0 ? batch.slice(0, 5) : batch) };
      },
    });
    expect(sent.slice(1).flat()).toEqual(
      expect.arrayContaining(values.slice(5).map((segment) => segment.id)),
    );
    expect(sent.slice(1).flat()).not.toContain(values[0]!.id);
  });

  it('4. never resends completed IDs', async () => {
    const values = segments(12);
    const counts = new Map<string, number>();
    await run({
      values,
      send: async (batch, depth) => {
        batch.forEach((segment) => counts.set(segment.id, (counts.get(segment.id) ?? 0) + 1));
        return { ok: true, response: response(batch, depth === 0 ? batch.slice(0, 7) : batch) };
      },
    });
    values.slice(0, 7).forEach((segment) => expect(counts.get(segment.id)).toBe(1));
  });

  it('5. splits 50 into 25 and 25 when the provider fails above 25', async () => {
    const sizes: number[] = [];
    const result = await run({
      values: segments(50),
      send: async (batch) => {
        sizes.push(batch.length);
        return batch.length > 25
          ? failure('INVALID_PROVIDER_RESPONSE')
          : { ok: true, response: response(batch) };
      },
    });
    expect(sizes).toEqual([50, 25, 25]);
    expect(result.unresolvedSegments).toEqual([]);
  });

  it('6. splits only the failing half again', async () => {
    const calls: string[][] = [];
    await run({
      values: segments(50),
      send: async (batch) => {
        calls.push(batch.map((segment) => segment.id));
        const containsFailure = batch.some((segment) => segment.id === 'segment-37');
        return batch.length > 25 || (containsFailure && batch.length > 13)
          ? failure('INVALID_PROVIDER_RESPONSE')
          : { ok: true, response: response(batch) };
      },
    });
    expect(calls.map((call) => call.length)).toEqual([50, 25, 25, 13, 12]);
  });

  it('7. retains successful halves as complete', async () => {
    const applied: string[] = [];
    await run({
      values: segments(50),
      applied,
      send: async (batch) =>
        batch.length > 25
          ? failure('INVALID_PROVIDER_RESPONSE')
          : { ok: true, response: response(batch) },
    });
    expect(new Set(applied).size).toBe(50);
    expect(applied).toHaveLength(50);
  });

  it('8. recovers all 2,500 sections with a provider threshold of 25', async () => {
    const applied: string[] = [];
    const result = await run({
      values: segments(2_500, 2),
      applied,
      send: async (batch) =>
        batch.length > 25
          ? failure('INVALID_PROVIDER_RESPONSE')
          : { ok: true, response: response(batch) },
    });
    expect(result.unresolvedSegments).toEqual([]);
    expect(new Set(applied).size).toBe(2_500);
  });

  it('9. continues queued sections after recovering a failed batch', async () => {
    const applied: string[] = [];
    await run({
      values: segments(120),
      applied,
      send: async (batch) =>
        batch.length > 25
          ? failure('INVALID_PROVIDER_RESPONSE')
          : { ok: true, response: response(batch) },
    });
    expect(applied).toContain('segment-119');
  });

  it('10. isolates an individual problematic segment', async () => {
    const sizes: number[] = [];
    const result = await run({
      values: segments(50),
      send: async (batch) => {
        sizes.push(batch.length);
        const valid = batch.filter((segment) => segment.id !== 'segment-17');
        return { ok: true, response: response(batch, valid) };
      },
    });
    expect(result.unresolvedSegments.map((segment) => segment.id)).toEqual(['segment-17']);
    expect(sizes).toContain(1);
  });

  it('11. does not discard other results for one permanently failing segment', async () => {
    const applied: string[] = [];
    await run({
      values: segments(80),
      applied,
      send: async (batch) => ({
        ok: true,
        response: response(
          batch,
          batch.filter((segment) => segment.id !== 'segment-17'),
        ),
      }),
    });
    expect(new Set(applied).size).toBe(79);
    expect(applied).toContain('segment-79');
  });

  it('12. reports honest partial state after retry exhaustion', async () => {
    const result = await run({
      values: segments(1),
      send: async (batch) => ({ ok: true, response: response(batch, []) }),
    });
    expect(result.terminalFailure?.reason).toBe('RETRY_EXHAUSTED');
    expect(result.unresolvedSegments).toHaveLength(1);
  });

  it('13. retries a truncated-JSON response safely', async () => {
    let calls = 0;
    const result = await run({
      values: segments(4),
      send: async (batch) => ({
        ok: true,
        response: response(
          batch,
          ++calls === 1 ? batch.slice(0, 2) : batch,
          calls === 1 ? 'truncated-json' : 'complete',
        ),
      }),
    });
    expect(result.unresolvedSegments).toEqual([]);
  });

  it('14. handles missing IDs as unresolved', async () => {
    const permanentlyMissingId = 'segment-2';
    const result = await run({
      values: segments(3),
      send: async (batch) => ({
        ok: true,
        response: response(
          batch,
          batch.filter((segment) => segment.id !== permanentlyMissingId),
          'missing-ids',
        ),
      }),
    });
    expect(result.unresolvedSegments).toHaveLength(1);
  });

  it('15. never applies duplicate IDs twice', async () => {
    const applied: string[] = [];
    const values = segments(2);
    let calls = 0;
    await run({
      values,
      applied,
      send: async (batch) => {
        calls += 1;
        if (calls > 1 || batch.length === 1) return { ok: true, response: response(batch) };
        return {
          ok: true,
          response: {
            ...response(batch),
            translations: [
              { id: batch[0]!.id, translatedText: 'one' },
              { id: batch[0]!.id, translatedText: 'two' },
              { id: batch[1]!.id, translatedText: 'three' },
            ],
          },
        };
      },
    });
    expect(applied.filter((id) => id === values[0]!.id)).toHaveLength(1);
  });

  it('16. ignores unknown IDs', async () => {
    const applied: string[] = [];
    await run({
      values: segments(1),
      applied,
      send: async (batch) => ({
        ok: true,
        response: {
          ...response(batch),
          translations: [...response(batch).translations, { id: 'unknown', translatedText: 'bad' }],
        },
      }),
    });
    expect(applied).toEqual(['segment-0']);
  });

  it('17. leaves empty outputs unresolved', async () => {
    const result = await run({
      values: segments(1),
      send: async (batch) => ({
        ok: true,
        response: { ...response(batch), translations: [{ id: batch[0]!.id, translatedText: ' ' }] },
      }),
    });
    expect(result.unresolvedSegments).toHaveLength(1);
  });

  it('18. assigns changed response order by stable ID', async () => {
    const applied: string[] = [];
    const values = segments(5);
    await run({
      values,
      applied,
      send: async (batch) => ({ ok: true, response: response(batch, [...batch].reverse()) }),
    });
    expect(new Set(applied)).toEqual(new Set(values.map((segment) => segment.id)));
  });

  it('19. stops split recovery when cancelled', async () => {
    let cancelled = false;
    const result = await run({
      values: segments(50),
      cancelled: () => cancelled,
      send: async () => {
        cancelled = true;
        return failure('INVALID_PROVIDER_RESPONSE');
      },
    });
    expect(result.terminalFailure?.reason).toBe('CANCELLED');
  });

  it('20. respects Retry-After for rate limiting', async () => {
    const waits: number[] = [];
    let calls = 0;
    const result = await run({
      values: segments(2),
      wait: async (seconds) => {
        waits.push(seconds);
      },
      send: async (batch) =>
        ++calls === 1
          ? failure('UPSTREAM_RATE_LIMIT', { retryAfterSeconds: 7 })
          : { ok: true, response: response(batch) },
    });
    expect(waits).toEqual([7]);
    expect(result.unresolvedSegments).toEqual([]);
  });

  it('21. does not split authentication failures', async () => {
    let calls = 0;
    const result = await run({
      values: segments(50),
      send: async () => {
        calls += 1;
        return failure('AUTHENTICATION_FAILED');
      },
    });
    expect(calls).toBe(1);
    expect(result.terminalFailure?.reason).toBe('AUTHENTICATION_FAILED');
  });

  it('22. does not split quota failures', async () => {
    let calls = 0;
    const result = await run({
      values: segments(50),
      send: async () => {
        calls += 1;
        return failure('UPSTREAM_QUOTA_EXHAUSTED');
      },
    });
    expect(calls).toBe(1);
    expect(result.terminalFailure?.reason).toBe('UPSTREAM_QUOTA_EXHAUSTED');
  });

  it('23. reports accurate retrying and queued progress metadata', async () => {
    const updates: AdaptiveRecoveryUpdate[] = [];
    await run({
      values: segments(50),
      updates,
      send: async (batch) =>
        batch.length > 25
          ? failure('INVALID_PROVIDER_RESPONSE')
          : { ok: true, response: response(batch) },
    });
    expect(updates.some((update) => update.state === 'retrying' && update.batchSize === 25)).toBe(
      true,
    );
    expect(updates.every((update) => update.unresolvedCount >= 0)).toBe(true);
  });

  it('24. calculates provider-aware character/token limits without page text diagnostics', () => {
    const short = segments(50, 2);
    const long = segments(50, 1_000);
    expect(
      providerAwareBatchLimits({
        providerId: 'gemini',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        segments: short,
      }).maxSegments,
    ).toBe(50);
    expect(
      providerAwareBatchLimits({
        providerId: 'gemini',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        segments: long,
      }).maxSegments,
    ).toBe(8);
    const cost = estimateBatchCost(long.slice(0, 2), 'fr');
    expect(cost.estimatedInputTokens).toBeGreaterThan(0);
    expect(JSON.stringify(cost)).not.toContain(long[0]!.text);
  });
});
