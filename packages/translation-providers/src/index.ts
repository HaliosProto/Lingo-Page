import type { TranslationRequest, TranslationResponse } from '@translation/shared-types';
import {
  applyGlossary,
  protectTokens,
  restoreTokens,
  validateTranslationResponse,
} from '@translation/translation-core';

export type ProviderContext = {
  signal?: AbortSignal;
};

export type ProviderErrorCode =
  | 'cancelled'
  | 'timeout'
  | 'authentication'
  | 'rate-limited'
  | 'quota-exceeded'
  | 'invalid-response'
  | 'unavailable';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;

  constructor(code: ProviderErrorCode, message: string, retryable: boolean, cause?: unknown) {
    super(message, { cause });
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

export interface TranslationProvider {
  readonly name: 'mock' | 'deepl';
  translate(request: TranslationRequest, context: ProviderContext): Promise<TranslationResponse>;
}

export function createMockProvider(): TranslationProvider {
  return {
    name: 'mock',
    async translate(request, context) {
      if (context.signal?.aborted) {
        throw new ProviderError('cancelled', 'The mock translation was cancelled.', false);
      }

      const response: TranslationResponse = {
        requestId: request.requestId,
        sessionId: request.sessionId,
        detectedSourceLanguage: request.sourceLanguage ?? 'en',
        translations: request.segments.map((segment) => {
          const protectedValue = protectTokens(segment.text);
          const visiblyTranslated = `[${request.targetLanguage}] ${protectedValue.text}`;
          return {
            id: segment.id,
            translatedText: restoreTokens(
              applyGlossary(
                visiblyTranslated,
                request.glossary ?? [],
                request.sourceLanguage,
                request.targetLanguage,
              ),
              protectedValue.tokens,
            ),
          };
        }),
        usage: {
          inputCharacters: request.segments.reduce(
            (total, segment) => total + segment.text.length,
            0,
          ),
        },
      };
      return validateTranslationResponse(request, response);
    },
  };
}

type DeepLProviderOptions = {
  apiKey: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type DeepLTranslation = {
  detected_source_language?: string;
  text: string;
};

function isDeepLResponse(value: unknown): value is { translations: DeepLTranslation[] } {
  if (typeof value !== 'object' || value === null || !('translations' in value)) return false;
  const translations = (value as { translations?: unknown }).translations;
  return (
    Array.isArray(translations) &&
    translations.every(
      (translation) =>
        typeof translation === 'object' &&
        translation !== null &&
        typeof (translation as { text?: unknown }).text === 'string' &&
        ((translation as { detected_source_language?: unknown }).detected_source_language ===
          undefined ||
          typeof (translation as { detected_source_language?: unknown })
            .detected_source_language === 'string'),
    )
  );
}

function normalizeDeepLLanguage(code: string): string {
  const normalized = code.toUpperCase().replace('_', '-');
  const aliases: Record<string, string> = {
    EN: 'EN-US',
    PT: 'PT-BR',
    ZH: 'ZH-HANS',
  };
  return aliases[normalized] ?? normalized;
}

function createAbortScope(
  parent: AbortSignal | undefined,
  timeoutMs: number,
): {
  signal: AbortSignal;
  didTimeout: () => boolean;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(parent?.reason);
  parent?.addEventListener('abort', onAbort, { once: true });
  if (parent?.aborted) controller.abort(parent.reason);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('Provider request timed out.'));
  }, timeoutMs);
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timeout);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

export function createDeepLProvider(options: DeepLProviderOptions): TranslationProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint =
    options.endpoint ??
    (options.apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate');
  const timeoutMs = options.timeoutMs ?? 12_000;

  return {
    name: 'deepl',
    async translate(request, context) {
      if (!options.apiKey.trim()) {
        throw new ProviderError(
          'authentication',
          'The translation provider is not configured.',
          false,
        );
      }
      const protectedSegments = request.segments.map((segment) => protectTokens(segment.text));
      const abortScope = createAbortScope(context.signal, timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `DeepL-Auth-Key ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: protectedSegments.map((segment) => segment.text),
            target_lang: normalizeDeepLLanguage(request.targetLanguage),
            ...(request.sourceLanguage && request.sourceLanguage !== 'auto'
              ? { source_lang: normalizeDeepLLanguage(request.sourceLanguage) }
              : {}),
            ...(request.formality && request.formality !== 'default'
              ? { formality: request.formality === 'more' ? 'more' : 'less' }
              : {}),
            preserve_formatting: true,
          }),
          signal: abortScope.signal,
        });
      } catch (error) {
        if (abortScope.didTimeout()) {
          throw new ProviderError('timeout', 'The translation provider timed out.', true, error);
        }
        if (context.signal?.aborted) {
          throw new ProviderError('cancelled', 'The translation was cancelled.', false, error);
        }
        throw new ProviderError(
          'unavailable',
          'The translation provider is unavailable.',
          true,
          error,
        );
      } finally {
        abortScope.dispose();
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new ProviderError('authentication', 'Provider authentication failed.', false);
        }
        if (response.status === 429) {
          throw new ProviderError('rate-limited', 'The provider rate limit was reached.', true);
        }
        if (response.status === 456) {
          throw new ProviderError(
            'quota-exceeded',
            'The provider character quota was reached.',
            false,
          );
        }
        throw new ProviderError(
          'unavailable',
          `Provider request failed (${response.status}).`,
          true,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        throw new ProviderError('invalid-response', 'Provider returned invalid JSON.', true, error);
      }
      if (!isDeepLResponse(payload) || payload.translations.length !== request.segments.length) {
        throw new ProviderError(
          'invalid-response',
          'Provider returned an invalid translation set.',
          true,
        );
      }

      const result: TranslationResponse = {
        requestId: request.requestId,
        sessionId: request.sessionId,
        detectedSourceLanguage: payload.translations[0]?.detected_source_language?.toLowerCase(),
        translations: payload.translations.map((translation, index) => ({
          id: request.segments[index]!.id,
          translatedText: restoreTokens(translation.text, protectedSegments[index]!.tokens),
        })),
        usage: {
          inputCharacters: request.segments.reduce(
            (total, segment) => total + segment.text.length,
            0,
          ),
        },
      };
      try {
        return validateTranslationResponse(request, result);
      } catch (error) {
        throw new ProviderError(
          'invalid-response',
          'Provider response failed validation.',
          true,
          error,
        );
      }
    },
  };
}
