export const CONTRACT_VERSION = 1 as const;

export type TranslationMode = 'page' | 'selection' | 'composer';

export type LanguageDirection = 'ltr' | 'rtl';

export type SupportedLanguage = {
  code: string;
  name: string;
  direction: LanguageDirection;
  detectable: boolean;
};

export type TranslationSegment = {
  id: string;
  text: string;
  context?: string;
  elementRole?: string;
  preserveTokens?: string[];
};

export type TranslationRequest = {
  requestId: string;
  sourceLanguage?: string;
  targetLanguage: string;
  mode: TranslationMode;
  segments: TranslationSegment[];
  glossaryVersion?: string;
  tone?: 'neutral' | 'formal' | 'informal';
  formality?: 'default' | 'more' | 'less';
};

export type TranslationResponse = {
  requestId: string;
  detectedSourceLanguage?: string;
  translations: Array<{
    id: string;
    translatedText: string;
  }>;
  usage?: {
    inputCharacters?: number;
    outputCharacters?: number;
  };
  partial?: boolean;
};

export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_REQUEST'
  | 'NOT_IMPLEMENTED'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
};

export type HealthResponse = {
  version: typeof CONTRACT_VERSION;
  service: 'translation-api';
  status: 'ok' | 'degraded';
  environment: 'development' | 'test' | 'staging' | 'production';
  appVersion: string;
  translationEnabled: boolean;
  provider: {
    configured: boolean;
    name: 'none' | 'mock';
  };
  requestId: string;
};

export type LanguagesResponse = {
  version: typeof CONTRACT_VERSION;
  languages: SupportedLanguage[];
  requestId: string;
};

export type PageSupport = {
  status: 'supported' | 'unsupported' | 'unknown';
  reason:
    | 'ordinary-web-page'
    | 'browser-internal-page'
    | 'extension-page'
    | 'chrome-web-store'
    | 'missing-url';
};

export type TabStatus = {
  tabId: number;
  title: string;
  url: string;
  support: PageSupport;
  contentScriptReady: boolean;
  apiStatus: 'unknown' | 'available' | 'unavailable';
};
