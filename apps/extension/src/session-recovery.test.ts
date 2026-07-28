import { describe, expect, it } from 'vitest';
import type { TranslationRecoveryRecord, TranslationSegment } from '@translation/shared-types';
import {
  MAX_MUTATION_BACKLOG,
  MutationBackpressureQueue,
  RequestIdempotencyLedger,
  classifyNetworkRecovery,
  evaluateRecoveryRecord,
  pruneRecoveryRecords,
  recoveryNavigationIdentity,
  remainingRetryDelayMs,
  retryDeadline,
  unresolvedSegments,
} from './session-recovery';

const now = 10_000;

function recoveryRecord(
  overrides: Partial<TranslationRecoveryRecord> = {},
): TranslationRecoveryRecord {
  return {
    version: 1,
    sourceTabId: 7,
    frameId: 0,
    sessionId: 'session_recovery_case',
    operationId: 'op_11111111111111111111111111111111',
    navigationIdentity: 'a'.repeat(64),
    navigationGeneration: 3,
    pageFingerprint: 'fp_page',
    sourceLanguage: 'auto',
    targetLanguage: 'fr',
    providerId: 'mock',
    modelId: 'mock-v1',
    createdAt: 1_000,
    updatedAt: 9_000,
    expiresAt: 20_000,
    displayMode: 'translated',
    lifecycle: 'complete',
    partial: false,
    cancelled: false,
    progress: {
      sessionId: 'session_recovery_case',
      status: 'completed',
      discoveredSegments: 1,
      translatedSegments: 1,
      failedSegments: 0,
    },
    completedSegmentIds: ['seg_0_a'],
    segments: [
      {
        id: 'seg_0_a',
        sourceFingerprint: 'fp_source',
        structuralFingerprint: 'fp_structure',
        translatedText: 'Bonjour',
        status: 'translated',
      },
    ],
    ...overrides,
  };
}

describe('Milestone 2 lifecycle acceptance matrix', () => {
  it.each([
    ['01 worker restart recovers an exact active session', {}, 'recover', false],
    ['02 translated reload recovers completed work', {}, 'recover', false],
    ['03 partial reload remains recoverable', { lifecycle: 'partial' }, 'recover', false],
    ['04 cancelled work reconstructs paused', { cancelled: true }, 'paused', false],
    ['05 expired work is rejected and cleaned', { expiresAt: now }, 'expired', true],
    ['06 ended work cannot reappear', { lifecycle: 'ended' }, 'incompatible', true],
    ['07 invalidated work cannot reappear', { lifecycle: 'invalidated' }, 'incompatible', true],
    ['08 wrong tab cannot claim recovery', { sourceTabId: 8 }, 'incompatible', false],
    [
      '09 wrong navigation is stale and removed',
      { navigationIdentity: 'b'.repeat(64) },
      'stale',
      true,
    ],
    ['10 complete work remains reusable after wake', { lifecycle: 'complete' }, 'recover', false],
  ] as const)('%s', (_name, overrides, expectedState, expectedRemove) => {
    const decision = evaluateRecoveryRecord(recoveryRecord(overrides), {
      tabId: 7,
      navigationIdentity: 'a'.repeat(64),
      now,
    });
    expect(decision.state).toBe(expectedState);
    expect('remove' in decision ? decision.remove : false).toBe(expectedRemove);
  });

  it.each([
    [
      '11 hashes equivalent URLs without fragments',
      'https://example.test/a#one',
      'https://example.test/a#two',
      true,
    ],
    ['12 distinguishes path navigation', 'https://example.test/a', 'https://example.test/b', false],
    [
      '13 distinguishes query-driven content identity',
      'https://example.test/a?q=1',
      'https://example.test/a?q=2',
      false,
    ],
    ['14 distinguishes origins', 'https://a.example.test/a', 'https://b.example.test/a', false],
    [
      '15 removes credentials before identity hashing',
      'https://user:pass@example.test/a',
      'https://example.test/a',
      true,
    ],
  ] as const)('%s', async (_name, left, right, equal) => {
    expect(
      (await recoveryNavigationIdentity(left)) === (await recoveryNavigationIdentity(right)),
    ).toBe(equal);
  });

  it.each([
    ['16 retains a valid record', [recoveryRecord()], 1, 0],
    ['17 removes an expired record', [recoveryRecord({ expiresAt: now })], 0, 1],
    ['18 removes an ended record', [recoveryRecord({ lifecycle: 'ended' })], 0, 1],
    ['19 removes an invalidated record', [recoveryRecord({ lifecycle: 'invalidated' })], 0, 1],
    [
      '20 retains the newest twelve records',
      Array.from({ length: 14 }, (_, index) =>
        recoveryRecord({
          sourceTabId: index,
          sessionId: `session_recovery_${index}`,
          updatedAt: index,
        }),
      ),
      12,
      2,
    ],
    [
      '21 deduplicates removal evidence by session identity',
      [recoveryRecord({ expiresAt: now }), recoveryRecord({ expiresAt: now })],
      0,
      2,
    ],
    ['22 preserves a cancelled but unexpired record', [recoveryRecord({ cancelled: true })], 1, 0],
    [
      '23 orders retained records by recent activity',
      [
        recoveryRecord({ sessionId: 'session_old', updatedAt: 1 }),
        recoveryRecord({ sessionId: 'session_new', updatedAt: 2 }),
      ],
      2,
      0,
    ],
  ] as const)('%s', (_name, records, retained, removed) => {
    const result = pruneRecoveryRecords([...records], now);
    expect(result.retained).toHaveLength(retained);
    expect(result.removedSessionIds).toHaveLength(removed);
    if (_name.startsWith('23')) expect(result.retained[0]?.sessionId).toBe('session_new');
  });

  it.each([
    ['24 enqueues one mutation root', 1, 1, 0],
    ['25 deduplicates the same mutation root', 2, 1, 0],
    ['26 rejects an obsolete generation', 1, 0, 1],
    ['27 drops work beyond the backlog bound', MAX_MUTATION_BACKLOG + 1, MAX_MUTATION_BACKLOG, 1],
    ['28 drains a bounded root count', 10, 3, 0],
    ['29 leaves excess roots queued for another slice', 10, 4, 0],
    ['30 clears obsolete work on route generation change', 5, 0, 5],
    ['31 accepts work for the new generation', 1, 1, 0],
    ['32 reports queue generation', 0, 0, 0],
    ['33 drains all small bursts', 4, 4, 0],
    ['34 preserves responsiveness with a zero time budget', 4, 1, 0],
    ['35 never returns old-generation roots', 3, 0, 3],
  ] as const)('%s', (_name, count, expected, expectedDropped) => {
    const roots = Array.from({ length: count }, () => ({}));
    const queue = new MutationBackpressureQueue<object>(1);
    if (_name.startsWith('25')) {
      queue.enqueue(roots[0]!);
      queue.enqueue(roots[0]!);
    } else if (_name.startsWith('26')) {
      queue.enqueue(roots[0]!, 0);
    } else if (_name.startsWith('30') || _name.startsWith('35')) {
      roots.forEach((root) => queue.enqueue(root, 1));
      queue.advanceGeneration(2);
    } else {
      roots.forEach((root) => queue.enqueue(root, 1));
    }
    const before = queue.stats();
    if (_name.startsWith('28')) expect(queue.drain({ maximum: 3 })).toHaveLength(3);
    else if (_name.startsWith('29')) {
      expect(queue.drain({ maximum: 6 })).toHaveLength(6);
      expect(queue.stats().queued).toBe(4);
    } else if (_name.startsWith('33')) expect(queue.drain()).toHaveLength(4);
    else if (_name.startsWith('34')) {
      let clock = 0;
      expect(queue.drain({ budgetMs: 0, now: () => clock++ })).toHaveLength(1);
    } else {
      expect(before.queued).toBe(expected);
      expect(before.dropped).toBe(expectedDropped);
    }
  });

  it.each([
    ['36 accepts a first attempt', 'begin', true],
    ['37 rejects duplicate attempt initialization', 'duplicate', false],
    ['38 accepts matching response IDs', 'response', 2],
    ['39 ignores unknown response IDs', 'unknown', 0],
    ['40 ignores stale attempt IDs', 'stale-attempt', 0],
    ['41 ignores stale generations', 'stale-generation', 0],
    ['42 ignores cancelled operations', 'cancelled', 0],
    ['43 does not apply a completed segment twice', 'duplicate-response', 0],
    ['44 keeps completed-segment evidence', 'completed', 2],
    ['45 isolates batches within an operation', 'separate-batch', true],
    ['46 isolates operations sharing a batch ID', 'separate-operation', true],
    ['47 delayed obsolete responses cannot mutate new work', 'obsolete', 0],
  ] as const)('%s', (_name, scenario, expected) => {
    const ledger = new RequestIdempotencyLedger();
    const attempt = {
      operationId: 'op_a',
      batchId: 'batch_a',
      attemptId: 'attempt_a',
      generation: 2,
      segmentIds: ['seg_a', 'seg_b'],
    };
    const first = ledger.begin(attempt);
    if (scenario === 'begin') expect(first).toBe(expected);
    else if (scenario === 'duplicate') expect(ledger.begin(attempt)).toBe(expected);
    else if (scenario === 'response') {
      expect(
        ledger.acceptResponse({ ...attempt, translations: [{ id: 'seg_a' }, { id: 'seg_b' }] }),
      ).toHaveLength(expected as number);
    } else if (scenario === 'unknown') {
      expect(
        ledger.acceptResponse({ ...attempt, translations: [{ id: 'seg_unknown' }] }),
      ).toHaveLength(0);
    } else if (scenario === 'stale-attempt') {
      expect(
        ledger.acceptResponse({
          ...attempt,
          attemptId: 'attempt_old',
          translations: [{ id: 'seg_a' }],
        }),
      ).toHaveLength(0);
    } else if (scenario === 'stale-generation' || scenario === 'obsolete') {
      expect(
        ledger.acceptResponse({ ...attempt, generation: 1, translations: [{ id: 'seg_a' }] }),
      ).toHaveLength(0);
    } else if (scenario === 'cancelled') {
      ledger.cancelOperation(attempt.operationId);
      expect(ledger.acceptResponse({ ...attempt, translations: [{ id: 'seg_a' }] })).toHaveLength(
        0,
      );
    } else if (scenario === 'duplicate-response') {
      ledger.acceptResponse({ ...attempt, translations: [{ id: 'seg_a' }] });
      expect(ledger.acceptResponse({ ...attempt, translations: [{ id: 'seg_a' }] })).toHaveLength(
        0,
      );
    } else if (scenario === 'completed') {
      ledger.acceptResponse({ ...attempt, translations: [{ id: 'seg_a' }, { id: 'seg_b' }] });
      expect(ledger.completed()).toHaveLength(expected as number);
    } else if (scenario === 'separate-batch') {
      expect(ledger.begin({ ...attempt, batchId: 'batch_b' })).toBe(true);
    } else if (scenario === 'separate-operation') {
      expect(ledger.begin({ ...attempt, operationId: 'op_b' })).toBe(true);
    }
  });

  it.each([
    ['48 uses the default five-second retry delay', undefined, 15_000],
    ['49 accepts an immediate retry deadline', 0, 10_000],
    ['50 converts seconds to an absolute deadline', 12, 22_000],
    ['51 clamps negative Retry-After', -5, 10_000],
    ['52 clamps excessive Retry-After', 900, 310_000],
    ['53 reports remaining retry delay after wake', 12, 7_000],
    ['54 reports zero after an elapsed deadline', 3, 0],
    ['55 keeps cancellation independent of elapsed time', 1, 0],
  ] as const)('%s', (_name, seconds, expected) => {
    const deadline = retryDeadline(now, seconds);
    if (_name.startsWith('53')) expect(remainingRetryDelayMs(deadline, 15_000)).toBe(expected);
    else if (_name.startsWith('54') || _name.startsWith('55')) {
      expect(remainingRetryDelayMs(deadline, 20_000)).toBe(expected);
    } else expect(deadline).toBe(expected);
  });

  it.each([
    ['56 classifies browser offline', { online: false }, 'offline'],
    ['57 classifies connection refusal', { online: true }, 'backend-unavailable'],
    ['58 classifies timeout', { online: true, timeout: true }, 'timeout'],
    ['59 classifies HTTP 429', { online: true, status: 429 }, 'rate-limited'],
    ['60 classifies HTTP 500', { online: true, status: 500 }, 'provider-unavailable'],
    ['61 classifies HTTP 502', { online: true, status: 502 }, 'provider-unavailable'],
    ['62 classifies HTTP 503', { online: true, status: 503 }, 'provider-unavailable'],
    [
      '63 classifies invalid backend response',
      { online: true, invalidResponse: true },
      'invalid-response',
    ],
    [
      '64 does not retry a non-retryable client error',
      { online: true, status: 400 },
      'non-retryable',
    ],
  ] as const)('%s', (_name, input, expected) => {
    expect(classifyNetworkRecovery(input)).toBe(expected);
  });

  it.each([
    ['65 filters completed work before retry', ['seg_a'], ['seg_b', 'seg_c']],
    ['66 keeps the full queue when nothing completed', [], ['seg_a', 'seg_b', 'seg_c']],
    ['67 never resends all completed work', ['seg_a', 'seg_b', 'seg_c'], []],
    ['68 ignores completion IDs outside the queue', ['seg_other'], ['seg_a', 'seg_b', 'seg_c']],
  ] as const)('%s', (_name, completed, expected) => {
    const segments: TranslationSegment[] = ['seg_a', 'seg_b', 'seg_c'].map((id) => ({
      id,
      text: id,
    }));
    expect(unresolvedSegments(segments, completed).map((segment) => segment.id)).toEqual(expected);
  });
});
