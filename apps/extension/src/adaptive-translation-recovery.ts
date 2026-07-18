import type {
  ProviderId,
  TranslationFailure,
  TranslationResponse,
  TranslationSegment,
} from '@translation/shared-types';

export type AdaptiveBatchLimits = {
  maxSegments: number;
  maxCharacters: number;
  maxEstimatedInputTokens: number;
  maxEstimatedOutputTokens: number;
  maxSplitDepth: number;
  maxAttemptsPerSegment: number;
  maxTotalRecoveryAttempts: number;
  maxRecoveryDurationMs: number;
};

export type AdaptiveAttemptOutcome =
  | { ok: true; response: TranslationResponse }
  | { ok: false; failure: TranslationFailure; retryable: boolean };

export type AdaptiveRecoveryUpdate = {
  state: 'requesting' | 'waiting' | 'retrying';
  batchSize: number;
  splitDepth: number;
  retryAttempts: number;
  unresolvedCount: number;
  safeBatchTarget: number;
  retryAfterSeconds?: number;
  failure?: TranslationFailure;
  response?: TranslationResponse;
};

export type AdaptiveRecoveryResult = {
  unresolvedSegments: TranslationSegment[];
  retryAttempts: number;
  smallestAttemptedBatch: number;
  deepestSplit: number;
  safeBatchTarget: number;
  retryHistory: string;
  terminalFailure?: TranslationFailure;
  lastResponse?: TranslationResponse;
};

type Work = { segments: TranslationSegment[]; splitDepth: number };

const defaultLimits: AdaptiveBatchLimits = {
  maxSegments: 50,
  maxCharacters: 8_000,
  maxEstimatedInputTokens: 4_000,
  maxEstimatedOutputTokens: 7_000,
  maxSplitDepth: 6,
  maxAttemptsPerSegment: 5,
  maxTotalRecoveryAttempts: 512,
  maxRecoveryDurationMs: 120_000,
};

export function providerAwareBatchLimits(input: {
  providerId: ProviderId;
  sourceLanguage: string;
  targetLanguage: string;
  segments: TranslationSegment[];
  useSmallerBatches?: boolean;
  currentSafeBatchTarget?: number;
}): AdaptiveBatchLimits {
  const lengths = input.segments.map(segmentCharacters).sort((left, right) => left - right);
  const highLength = lengths[Math.floor(lengths.length * 0.9)] ?? 0;
  const providerCharacters = input.providerId === 'gemini' ? 7_000 : 9_000;
  const distributionTarget = highLength > 900 ? 8 : highLength > 500 ? 16 : 50;
  const requestedTarget = input.useSmallerBatches ? 10 : distributionTarget;
  return {
    ...defaultLimits,
    maxSegments: Math.max(
      1,
      Math.min(requestedTarget, input.currentSafeBatchTarget ?? defaultLimits.maxSegments),
    ),
    maxCharacters: input.useSmallerBatches ? 2_000 : providerCharacters,
    maxEstimatedInputTokens: input.useSmallerBatches ? 1_200 : 4_000,
    maxEstimatedOutputTokens: input.useSmallerBatches ? 2_000 : 7_000,
  };
}

export function estimateBatchCost(
  segments: TranslationSegment[],
  targetLanguage: string,
): { characters: number; estimatedInputTokens: number; estimatedOutputTokens: number } {
  const characters = segments.reduce((total, segment) => total + segmentCharacters(segment), 0);
  const outputMultiplier = /^(de|fi|fr|it|nl|pl|pt|ru|es|uk)(-|$)/u.test(targetLanguage)
    ? 1.6
    : /^(ar|fa|he|ur)(-|$)/u.test(targetLanguage)
      ? 1.45
      : /^(ja|ko|zh)(-|$)/u.test(targetLanguage)
        ? 1.1
        : 1.35;
  return {
    characters,
    estimatedInputTokens: Math.ceil((characters + segments.length * 24) / 4),
    estimatedOutputTokens: Math.ceil((characters * outputMultiplier + segments.length * 24) / 4),
  };
}

function segmentCharacters(segment: TranslationSegment): number {
  return (
    segment.text.length + (segment.context?.length ?? 0) + (segment.surroundingText?.length ?? 0)
  );
}

function takeProviderAwareBatch(
  pending: TranslationSegment[],
  limits: AdaptiveBatchLimits,
  safeBatchTarget: number,
  targetLanguage: string,
): TranslationSegment[] {
  const batch: TranslationSegment[] = [];
  const maxSegments = Math.max(1, Math.min(limits.maxSegments, safeBatchTarget));
  while (pending.length > 0 && batch.length < maxSegments) {
    const candidate = pending[0]!;
    const next = [...batch, candidate];
    const cost = estimateBatchCost(next, targetLanguage);
    const exceeds =
      cost.characters > limits.maxCharacters ||
      cost.estimatedInputTokens > limits.maxEstimatedInputTokens ||
      cost.estimatedOutputTokens > limits.maxEstimatedOutputTokens;
    if (batch.length > 0 && exceeds) break;
    batch.push(pending.shift()!);
  }
  return batch;
}

function splitWork(segments: TranslationSegment[], splitDepth: number): Work[] {
  if (segments.length <= 1) return [{ segments, splitDepth: splitDepth + 1 }];
  const middle = Math.ceil(segments.length / 2);
  return [
    { segments: segments.slice(0, middle), splitDepth: splitDepth + 1 },
    { segments: segments.slice(middle), splitDepth: splitDepth + 1 },
  ];
}

function recoverableBySplitting(failure: TranslationFailure): boolean {
  return failure.reason === 'INVALID_PROVIDER_RESPONSE' || failure.reason === 'PROVIDER_TIMEOUT';
}

function rateLimited(failure: TranslationFailure): boolean {
  return failure.reason === 'LOCAL_RATE_LIMIT' || failure.reason === 'UPSTREAM_RATE_LIMIT';
}

function boundedHistory(values: string[]): string {
  return values.slice(-60).join('>');
}

export async function runAdaptiveTranslationRecovery(input: {
  segments: TranslationSegment[];
  providerId: ProviderId;
  sourceLanguage: string;
  targetLanguage: string;
  limits?: AdaptiveBatchLimits;
  initialSafeBatchTarget?: number;
  send: (segments: TranslationSegment[], splitDepth: number) => Promise<AdaptiveAttemptOutcome>;
  apply: (translations: TranslationResponse['translations']) => void | Promise<void>;
  update?: (progress: AdaptiveRecoveryUpdate) => void;
  wait?: (seconds: number) => Promise<void>;
  cancelled?: () => boolean;
  now?: () => number;
}): Promise<AdaptiveRecoveryResult> {
  const limits =
    input.limits ??
    providerAwareBatchLimits({
      providerId: input.providerId,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      segments: input.segments,
      currentSafeBatchTarget: input.initialSafeBatchTarget,
    });
  const pending = [...input.segments];
  const recovery: Work[] = [];
  const permanentlyUnresolved: TranslationSegment[] = [];
  const attemptsById = new Map<string, number>();
  const startedAt = (input.now ?? Date.now)();
  const history: string[] = [];
  let safeBatchTarget = Math.max(
    1,
    Math.min(limits.maxSegments, input.initialSafeBatchTarget ?? limits.maxSegments),
  );
  let retryAttempts = 0;
  let smallestAttemptedBatch = Number.POSITIVE_INFINITY;
  let deepestSplit = 0;
  let lastResponse: TranslationResponse | undefined;

  const result = (terminalFailure?: TranslationFailure): AdaptiveRecoveryResult => ({
    unresolvedSegments: [
      ...permanentlyUnresolved,
      ...recovery.flatMap((work) => work.segments),
      ...pending,
    ],
    retryAttempts,
    smallestAttemptedBatch: Number.isFinite(smallestAttemptedBatch) ? smallestAttemptedBatch : 0,
    deepestSplit,
    safeBatchTarget,
    retryHistory: boundedHistory(history),
    ...(terminalFailure ? { terminalFailure } : {}),
    ...(lastResponse ? { lastResponse } : {}),
  });

  while (pending.length > 0 || recovery.length > 0) {
    if (input.cancelled?.()) {
      return result({
        reason: 'CANCELLED',
        metadata: { providerId: input.providerId, automaticRetry: false },
      });
    }
    if ((input.now ?? Date.now)() - startedAt > limits.maxRecoveryDurationMs) {
      permanentlyUnresolved.push(...recovery.flatMap((work) => work.segments), ...pending);
      recovery.length = 0;
      pending.length = 0;
      break;
    }

    const work = recovery.shift() ?? {
      segments: takeProviderAwareBatch(pending, limits, safeBatchTarget, input.targetLanguage),
      splitDepth: 0,
    };
    if (work.segments.length === 0) break;
    deepestSplit = Math.max(deepestSplit, work.splitDepth);
    smallestAttemptedBatch = Math.min(smallestAttemptedBatch, work.segments.length);
    for (const segment of work.segments) {
      attemptsById.set(segment.id, (attemptsById.get(segment.id) ?? 0) + 1);
    }
    input.update?.({
      state: work.splitDepth > 0 ? 'retrying' : 'requesting',
      batchSize: work.segments.length,
      splitDepth: work.splitDepth,
      retryAttempts,
      unresolvedCount: work.segments.length,
      safeBatchTarget,
    });
    const outcome = await input.send(work.segments, work.splitDepth);
    if (!outcome.ok) {
      history.push(`${work.segments.length}@${work.splitDepth}:${outcome.failure.reason}`);
      const maximumAttempt = Math.max(
        ...work.segments.map((segment) => attemptsById.get(segment.id) ?? 0),
      );
      if (
        rateLimited(outcome.failure) &&
        outcome.retryable &&
        maximumAttempt < limits.maxAttemptsPerSegment
      ) {
        retryAttempts += 1;
        const retryAfterSeconds = outcome.failure.metadata.retryAfterSeconds ?? 5;
        input.update?.({
          state: 'waiting',
          batchSize: work.segments.length,
          splitDepth: work.splitDepth,
          retryAttempts,
          unresolvedCount: work.segments.length,
          safeBatchTarget,
          retryAfterSeconds,
          failure: outcome.failure,
        });
        await (
          input.wait ??
          (async (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1_000)))
        )(retryAfterSeconds);
        recovery.unshift(work);
        continue;
      }
      if (recoverableBySplitting(outcome.failure) && outcome.retryable) {
        const canRecover =
          work.splitDepth < limits.maxSplitDepth &&
          retryAttempts < limits.maxTotalRecoveryAttempts &&
          work.segments.some(
            (segment) => (attemptsById.get(segment.id) ?? 0) < limits.maxAttemptsPerSegment,
          );
        if (canRecover) {
          retryAttempts += 1;
          safeBatchTarget = Math.min(
            safeBatchTarget,
            Math.max(1, Math.ceil(work.segments.length / 2)),
          );
          recovery.unshift(...splitWork(work.segments, work.splitDepth));
          continue;
        }
        permanentlyUnresolved.push(...work.segments);
        continue;
      }
      return result(outcome.failure);
    }

    lastResponse = outcome.response;
    const expectedIds = new Set(work.segments.map((segment) => segment.id));
    const responseCounts = new Map<string, number>();
    for (const translation of outcome.response.translations) {
      responseCounts.set(translation.id, (responseCounts.get(translation.id) ?? 0) + 1);
    }
    const explicitlyInvalidIds = new Set([
      ...(outcome.response.recovery?.duplicateSegmentIds ?? []),
      ...(outcome.response.recovery?.emptySegmentIds ?? []),
    ]);
    const seenIds = new Set<string>();
    const validTranslations = outcome.response.translations.filter((translation) => {
      if (
        !expectedIds.has(translation.id) ||
        explicitlyInvalidIds.has(translation.id) ||
        responseCounts.get(translation.id) !== 1 ||
        seenIds.has(translation.id) ||
        !translation.translatedText.trim()
      ) {
        return false;
      }
      seenIds.add(translation.id);
      return true;
    });
    await input.apply(validTranslations);
    const unresolved = work.segments.filter((segment) => !seenIds.has(segment.id));
    const classification =
      outcome.response.recovery?.classification ??
      (unresolved.length > 0 ? 'valid-partial' : 'complete');
    history.push(
      `${work.segments.length}@${work.splitDepth}:${classification}:${validTranslations.length}`,
    );
    if (unresolved.length === 0) continue;

    retryAttempts += 1;
    safeBatchTarget = Math.min(safeBatchTarget, Math.max(1, Math.ceil(work.segments.length / 2)));
    input.update?.({
      state: 'retrying',
      batchSize: work.segments.length,
      splitDepth: work.splitDepth,
      retryAttempts,
      unresolvedCount: unresolved.length,
      safeBatchTarget,
      response: outcome.response,
    });
    const recoverable = unresolved.filter(
      (segment) => (attemptsById.get(segment.id) ?? 0) < limits.maxAttemptsPerSegment,
    );
    const exhausted = unresolved.filter(
      (segment) => (attemptsById.get(segment.id) ?? 0) >= limits.maxAttemptsPerSegment,
    );
    permanentlyUnresolved.push(...exhausted);
    if (
      recoverable.length === 0 ||
      work.splitDepth >= limits.maxSplitDepth ||
      retryAttempts >= limits.maxTotalRecoveryAttempts
    ) {
      permanentlyUnresolved.push(...recoverable);
      continue;
    }
    recovery.unshift(...splitWork(recoverable, work.splitDepth));
  }

  return result(
    permanentlyUnresolved.length > 0
      ? {
          reason: 'RETRY_EXHAUSTED',
          metadata: {
            providerId: input.providerId,
            automaticRetry: false,
            failureCategory: 'retry-exhaustion',
          },
        }
      : undefined,
  );
}
