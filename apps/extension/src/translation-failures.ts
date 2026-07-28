import type {
  ProviderId,
  TranslationFailure,
  TranslationProgress,
} from '@translation/shared-types';

export type FailureActionId =
  | 'automatic-retry'
  | 'retry-failed'
  | 'continue'
  | 'continue-smaller'
  | 'retry-connection'
  | 'start-again'
  | 'change-provider'
  | 'retry-later'
  | 'keep-partial'
  | 'restore';

export type FailureAction = { id: FailureActionId; label: string };

export type FailurePresentation = {
  message: string;
  secondaryMessage?: string;
  actions: FailureAction[];
};

const providerNames: Record<ProviderId, string> = {
  mock: 'Mock',
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
  deepl: 'DeepL',
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
  glm: 'GLM',
  qwen: 'Qwen',
  xai: 'Grok',
  mistral: 'Mistral',
  minimax: 'MiniMax',
  cohere: 'Cohere',
  'custom-openai-compatible': 'Custom provider',
};

function counts(failure: TranslationFailure): {
  translated: number;
  total: number;
  failed: number;
  remaining: number;
} {
  const translated = failure.metadata.translatedSegments ?? 0;
  const total = Math.max(translated, failure.metadata.totalSegments ?? translated);
  const failed = failure.metadata.failedSegments ?? Math.max(0, total - translated);
  return { translated, total, failed, remaining: Math.max(0, total - translated) };
}

export function providerDisplayName(failure: TranslationFailure, configuredName?: string): string {
  return (
    configuredName ??
    (failure.metadata.providerId ? providerNames[failure.metadata.providerId] : undefined) ??
    'The provider'
  );
}

const retryFailed: FailureAction = { id: 'retry-failed', label: 'Retry failed sections' };
const automaticRetry: FailureAction = {
  id: 'automatic-retry',
  label: 'Retry automatically',
};
const continueTranslation: FailureAction = { id: 'continue', label: 'Continue translation' };
const changeProvider: FailureAction = { id: 'change-provider', label: 'Change provider' };
const keepPartial: FailureAction = { id: 'keep-partial', label: 'Keep partial translation' };
const restore: FailureAction = { id: 'restore', label: 'Restore original page' };

export function failurePresentation(
  failure: TranslationFailure,
  configuredProviderName?: string,
): FailurePresentation {
  const provider = providerDisplayName(failure, configuredProviderName);
  const { translated, total, failed, remaining } = counts(failure);
  const seconds = failure.metadata.retryAfterSeconds ?? 5;

  switch (failure.reason) {
    case 'LOCAL_RATE_LIMIT':
      return {
        message: failure.metadata.automaticRetry
          ? seconds === 0
            ? 'The local service received too many requests at once. Retrying automatically now.'
            : `Translation paused because the local service received too many requests at once. Retrying automatically in ${seconds} seconds.`
          : `Translation stopped because the local service continued rejecting new batches. ${translated} of ${total} sections were translated.`,
        actions: [retryFailed, continueTranslation, restore],
      };
    case 'UPSTREAM_RATE_LIMIT':
      return {
        message: failure.metadata.automaticRetry
          ? seconds === 0
            ? `${provider} temporarily limited this translation because too many requests were sent. Your completed sections were preserved. Retrying now.`
            : `${provider} temporarily limited this translation because too many requests were sent. Your completed sections were preserved. Retrying in ${seconds} seconds.`
          : `${provider} temporarily limited this translation because too many requests were sent. Your completed sections were preserved.`,
        secondaryMessage:
          provider === 'Gemini'
            ? `Gemini\u2019s current API quota or rate limit was reached. This is common with large pages on limited API plans.`
            : undefined,
        actions: [
          ...(failure.metadata.automaticRetry ? [automaticRetry] : []),
          retryFailed,
          { id: 'retry-later', label: 'Try again later' },
          changeProvider,
        ],
      };
    case 'UPSTREAM_QUOTA_EXHAUSTED':
      return {
        message: `${provider}\u2019s usage quota has been exhausted. The translated sections were preserved, but the remaining ${remaining} sections cannot continue until the quota resets or another provider is selected.`,
        actions: [changeProvider, { id: 'retry-later', label: 'Retry later' }, restore],
      };
    case 'AUTHENTICATION_FAILED':
      return {
        message: `${provider} rejected the configured API key. Check the backend API-key configuration and restart the local service.`,
        actions: [changeProvider, { id: 'retry-connection', label: 'Retry connection' }, restore],
      };
    case 'PROVIDER_TIMEOUT':
      return {
        message: `Some translation batches took too long and timed out. ${translated} of ${total} sections were translated.`,
        actions: [
          retryFailed,
          { id: 'continue-smaller', label: 'Retry using smaller batches' },
          changeProvider,
          restore,
        ],
      };
    case 'PROVIDER_UNAVAILABLE':
      return {
        message: `${provider} is temporarily unavailable. Your completed translations were preserved.`,
        actions: [{ id: 'retry-failed', label: 'Retry' }, changeProvider, restore],
      };
    case 'INVALID_PROVIDER_RESPONSE':
      if (failure.metadata.automaticRetry) {
        return {
          message: `${provider} returned only part of this batch. Retrying the remaining ${failure.metadata.unresolvedCount ?? failed} sections in smaller groups…`,
          actions: [],
        };
      }
      return {
        message: `${provider} returned an incomplete response for ${failed} sections. Those sections were not changed.`,
        actions: [retryFailed, changeProvider, keepPartial],
      };
    case 'BACKEND_UNAVAILABLE':
      return {
        message:
          failure.metadata.failureCategory === 'offline'
            ? 'You appear to be offline. Completed sections were preserved. Reconnect, then continue the remaining translation.'
            : 'The local translation service stopped responding. Restart the local backend, then continue the remaining translation.',
        actions: [
          { id: 'retry-connection', label: 'Retry connection' },
          { id: 'continue', label: 'Continue after reconnecting' },
          restore,
        ],
      };
    case 'CANCELLED':
      return {
        message: `Translation was cancelled. ${translated} of ${total} sections had already been translated.`,
        actions: [{ id: 'continue', label: 'Continue remaining sections' }, restore],
      };
    case 'NAVIGATION_CHANGED':
      return {
        message:
          'Translation stopped because the page changed or navigated while translation was running. Stale results were not applied.',
        actions: [
          { id: 'start-again', label: 'Start translation again' },
          { id: 'restore', label: 'Restore translated sections where safe' },
        ],
      };
    case 'UNSUPPORTED_CONTENT': {
      const unsupported = failure.metadata.unsupportedCount ?? 0;
      return {
        message:
          'Some content could not be translated because it is inside protected frames, images, canvas elements, or browser-restricted areas.',
        secondaryMessage:
          unsupported > 0 ? `${unsupported} sections could not be accessed.` : undefined,
        actions: [],
      };
    }
    case 'PRIVACY_EXCLUSION':
      return {
        message:
          'Some content was skipped for privacy or safety, such as passwords, payment fields, editable inputs, hidden text, or excluded page regions.',
        actions: [],
      };
    case 'RETRY_EXHAUSTED':
      return {
        message:
          failure.metadata.causeReason === 'LOCAL_RATE_LIMIT'
            ? `Translation stopped because the local service continued rejecting new batches. ${translated} of ${total} sections were translated.`
            : `Automatic recovery stopped after bounded retries. ${translated} of ${total} sections were translated, and ${failure.metadata.unresolvedCount ?? remaining} remain unresolved.`,
        actions: [
          { id: 'retry-failed', label: 'Retry unresolved sections' },
          changeProvider,
          keepPartial,
        ],
      };
    case 'UNKNOWN':
      return {
        message: `Translation stopped before it could complete. ${translated} of ${total} sections were translated.`,
        actions: [retryFailed, changeProvider, restore],
      };
  }
}

export function progressLabel(progress: TranslationProgress): string {
  if (progress.recoveryState === 'recovering') return 'Recovering translation session…';
  if (progress.recoveryState === 'recovered') {
    return `${progress.translatedSegments} sections restored from the saved session`;
  }
  if (progress.recoveryState === 'expired') return 'Saved translation session expired';
  if (progress.recoveryState === 'stale' || progress.recoveryState === 'incompatible') {
    return 'Saved translation does not match this page';
  }
  if (progress.recoveryState === 'offline') return 'Offline. Completed sections are preserved.';
  if (progress.recoveryState === 'backend-unavailable') {
    return 'Local translation service unavailable';
  }
  const total = progress.discoveredSegments;
  const translated = progress.translatedSegments;
  const remaining = Math.max(0, total - translated);
  if (progress.status === 'idle') return 'No active translation';
  if (progress.status === 'discovering') return 'Finding page text\u2026';
  if (progress.status === 'translating') return `${translated} of ${total} sections translated`;
  if (progress.status === 'paused') {
    const percent = total > 0 ? Math.round((translated / total) * 100) : 0;
    return `Translation paused at ${percent}%`;
  }
  if (progress.status === 'retrying') {
    return `${progress.retryingSegments ?? progress.failedSegments} sections retrying`;
  }
  if (progress.status === 'completed') return `${translated} sections translated`;
  if (total > 0) return `${translated} of ${total} sections translated. ${remaining} remain.`;
  return 'Translation stopped before any eligible sections were found.';
}

export function safeFailureDiagnostics(
  failure: TranslationFailure,
  configuredProviderName?: string,
): Record<string, string | number | boolean> {
  const metadata = failure.metadata;
  return Object.fromEntries(
    Object.entries({
      errorCode: failure.reason,
      provider: providerDisplayName(failure, configuredProviderName),
      httpStatus: metadata.httpStatus,
      requestId: metadata.requestId,
      translatedSections: metadata.translatedSegments,
      totalSections: metadata.totalSegments,
      failedSections: metadata.failedSegments,
      queuedSections: metadata.queuedSegments,
      failedBatches: metadata.failedBatches,
      retryAttempts: metadata.retryAttempt,
      retryAfterSeconds: metadata.retryAfterSeconds,
      automaticRetry: metadata.automaticRetry,
      failureCategory: metadata.failureCategory,
      requestedCount: metadata.requestedCount,
      returnedValidCount: metadata.returnedValidCount,
      missingCount: metadata.missingCount,
      duplicateCount: metadata.duplicateCount,
      unknownCount: metadata.unknownCount,
      emptyCount: metadata.emptyCount,
      parseFailure: metadata.parseFailure,
      finishReason: metadata.finishReason,
      responseTruncated: metadata.responseTruncated,
      splitDepth: metadata.splitDepth,
      smallestAttemptedBatch: metadata.smallestAttemptedBatch,
      unresolvedCount: metadata.unresolvedCount,
      inputCharacterCount: metadata.inputCharacterCount,
      estimatedInputTokens: metadata.estimatedInputTokens,
      estimatedOutputTokens: metadata.estimatedOutputTokens,
      responseSize: metadata.responseSize,
      batchSize: metadata.batchSize,
      retryHistory: metadata.retryHistory,
    }).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined),
  );
}
