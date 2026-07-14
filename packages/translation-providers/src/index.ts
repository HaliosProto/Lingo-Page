import type { TranslationRequest, TranslationResponse } from '@translation/shared-types';

export type ProviderContext = {
  signal?: AbortSignal;
};

export interface TranslationProvider {
  readonly name: 'mock' | 'deepl' | 'google' | 'azure' | 'openai';
  translate(request: TranslationRequest, context: ProviderContext): Promise<TranslationResponse>;
}

export function createMockProvider(): TranslationProvider {
  return {
    name: 'mock',
    async translate(request, context) {
      if (context.signal?.aborted) {
        throw new DOMException('The mock translation was cancelled.', 'AbortError');
      }

      return {
        requestId: request.requestId,
        translations: request.segments.map((segment) => ({
          id: segment.id,
          translatedText: `[mock] ${segment.text}`,
        })),
        usage: {
          inputCharacters: request.segments.reduce(
            (total, segment) => total + segment.text.length,
            0,
          ),
        },
      };
    },
  };
}
