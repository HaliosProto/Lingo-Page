export const CONTRACT_VERSION = 1 as const;

export type TranslationMode = 'page' | 'selection';
export type ProviderId =
  | 'mock'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'deepl'
  | 'deepseek'
  | 'kimi'
  | 'glm'
  | 'qwen'
  | 'xai'
  | 'mistral'
  | 'minimax'
  | 'cohere'
  | 'custom-openai-compatible';

export type ProviderProtocol =
  | 'mock'
  | 'gemini-interactions'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'openai-chat-compatible'
  | 'cohere-v2'
  | 'deepl';

export type ProviderCapabilities = {
  structuredOutput: boolean;
  strictJsonSchema: boolean;
  streaming: boolean;
  cancellation: boolean;
  languageDetection: boolean;
  glossary: boolean;
  usageReporting: boolean;
  modelDiscovery: boolean;
  reasoningControls: boolean;
};

export type ModelDefinition = {
  id: string;
  displayName: string;
  enabled: boolean;
  suitableForTranslation: boolean;
  supportsStructuredOutput: boolean;
  contextWindow?: number;
  deprecated?: boolean;
};

export type ProviderDefinition = {
  id: ProviderId;
  displayName: string;
  protocol: ProviderProtocol;
  configured: boolean;
  enabled: boolean;
  defaultModel?: string;
  availableModels: ModelDefinition[];
  capabilities: ProviderCapabilities;
  status: 'ready' | 'unconfigured' | 'disabled';
  dataRecipient: string;
  privacyNotice: string;
};
export type LanguageDirection = 'ltr' | 'rtl';
export type TranslationStatus =
  'idle' | 'discovering' | 'translating' | 'completed' | 'partial' | 'cancelled' | 'error';

export type SupportedLanguage = {
  code: string;
  name: string;
  direction: LanguageDirection;
  detectable: boolean;
};

export type GlossaryEntry = {
  id: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  sourceTerm: string;
  preferredTranslation: string;
  preserve: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  enabled: boolean;
  notes?: string;
};

export type AppSettings = {
  providerId: ProviderId;
  modelId: string;
  defaultTargetLanguage: string;
  sourceLanguage: string;
  theme: 'system' | 'light' | 'dark';
  reducedMotion: boolean;
  privacyMode: boolean;
  sensitivePageProtection: boolean;
  persistentCache: boolean;
  autoTranslateDynamicContent: boolean;
  selectedTextEnabled: boolean;
  domainExclusions: string[];
  glossaryVersion: number;
  glossary: GlossaryEntry[];
};

export type TranslationSegment = {
  id: string;
  text: string;
  context?: string;
  elementRole?: string;
  surroundingText?: string;
  preserveTokens?: string[];
};

export type TranslationRequest = {
  requestId: string;
  sessionId: string;
  providerId?: ProviderId;
  modelId?: string;
  sourceLanguage?: string;
  targetLanguage: string;
  mode: TranslationMode;
  segments: TranslationSegment[];
  glossaryVersion?: string;
  glossary?: GlossaryEntry[];
  tone?: 'neutral' | 'formal' | 'informal';
  formality?: 'default' | 'more' | 'less';
};

export type TranslationResponse = {
  requestId: string;
  sessionId: string;
  providerId: ProviderId;
  modelId: string;
  detectedSourceLanguage?: string;
  translations: Array<{
    id: string;
    translatedText: string;
  }>;
  usage?: {
    inputCharacters?: number;
    outputCharacters?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  partial?: boolean;
};

export type TranslationProgress = {
  sessionId?: string;
  status: TranslationStatus;
  discoveredSegments: number;
  translatedSegments: number;
  failedSegments: number;
  targetLanguage?: string;
  detectedSourceLanguage?: string;
  error?: string;
  navigationId?: string;
};

export type LanguageDetectionResult = {
  requestId: string;
  detectedLanguage: string;
  confidence: 'low' | 'medium' | 'high';
};

export type UsageResponse = {
  requestId: string;
  period: 'development-session';
  inputCharacters: number;
  requests: number;
  requestLimit: number;
  characterLimit: number;
};

export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_REQUEST'
  | 'NOT_IMPLEMENTED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'TRANSLATION_DISABLED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'CANCELLED'
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
    id: 'none' | ProviderId;
    displayName: string;
    modelId?: string;
  };
  requestId: string;
};

export type ProvidersResponse = {
  version: typeof CONTRACT_VERSION;
  providers: ProviderDefinition[];
  defaultProviderId: ProviderId;
  requestId: string;
};

export type ProviderModelsResponse = {
  version: typeof CONTRACT_VERSION;
  providerId: ProviderId;
  models: ModelDefinition[];
  source: 'configured' | 'discovered-cache' | 'discovered-live';
  requestId: string;
};

export type ProviderTestResponse = {
  version: typeof CONTRACT_VERSION;
  providerId: ProviderId;
  modelId: string;
  status: 'ok';
  latencyMs: number;
  requestId: string;
};

export type LanguagesResponse = {
  version: typeof CONTRACT_VERSION;
  languages: SupportedLanguage[];
  requestId: string;
};

export type PageSupport = {
  status: 'supported' | 'unsupported' | 'warning' | 'unknown';
  reason:
    | 'ordinary-web-page'
    | 'sensitive-page'
    | 'domain-excluded'
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
  progress: TranslationProgress;
};

export type SelectionResult = {
  sourceText: string;
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage: string;
};

export type DiagnosticReport = {
  generatedAt: string;
  extensionVersion: string;
  backend: {
    status: 'available' | 'unavailable';
    translationEnabled: boolean;
    provider: 'none' | ProviderId;
    modelId?: string;
  };
  settings: {
    providerId: ProviderId;
    modelId: string;
    privacyMode: boolean;
    persistentCache: boolean;
    autoTranslateDynamicContent: boolean;
    selectedTextEnabled: boolean;
    domainExclusionCount: number;
    glossaryEntryCount: number;
  };
  cache: {
    memoryEntries: number;
    persistentEntries: number;
  };
};
