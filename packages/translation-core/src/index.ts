import type {
  TranslationRequest,
  TranslationResponse,
  TranslationSegment,
} from '@translation/shared-types';

export type TranslationCoreStatus = 'shell-only';

export interface TranslationCore {
  readonly status: TranslationCoreStatus;
  createRequest(segments: TranslationSegment[], targetLanguage: string): TranslationRequest;
  validateResponse(response: TranslationResponse): TranslationResponse;
}

export function createTranslationCore(): TranslationCore {
  return {
    status: 'shell-only',
    createRequest(segments, targetLanguage) {
      return {
        requestId: `req_shell_${Date.now()}`,
        targetLanguage,
        mode: 'page',
        segments,
      };
    },
    validateResponse(response) {
      return response;
    },
  };
}
