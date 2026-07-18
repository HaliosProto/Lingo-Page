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
  | 'idle'
  | 'discovering'
  | 'translating'
  | 'paused'
  | 'retrying'
  | 'completed'
  | 'partial'
  | 'cancelled'
  | 'error';

export const TRANSLATION_SESSION_VERSION = 2 as const;

export type TranslationDisplayMode = 'original' | 'translated' | 'mixed-partial';
export type TranslationSessionLifecycle =
  'active' | 'translating' | 'partial' | 'complete' | 'stale' | 'ended' | 'invalidated';
export type TranslationSegmentStatus =
  'pending' | 'translated' | 'failed' | 'changed' | 'uncertain' | 'removed';

export type TranslationChangeSummary = {
  newSegments: number;
  modifiedSegments: number;
  removedSegments: number;
  reorderedSegments: number;
  uncertainSegments: number;
};

export type TranslationChangeScanResult = {
  status: 'no-changes' | 'changes-found' | 'updated';
  summary: TranslationChangeSummary;
  updatedSegments?: number;
};

export type TranslatedCopyApplicationStatus =
  'applying' | 'ready' | 'partial' | 'no-matches' | 'import-failed' | 'session-stale';

export type TranslatedCopyApplicationSummary = {
  status: TranslatedCopyApplicationStatus;
  discoveredSegments: number;
  matchedSegments: number;
  appliedSegments: number;
  unmatchedSegments: number;
  uncertainSegments: number;
  changedSegments: number;
  providerRequests: 0;
};

export type TranslationComparisonElementTag =
  | 'main'
  | 'article'
  | 'section'
  | 'header'
  | 'footer'
  | 'nav'
  | 'aside'
  | 'div'
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'ul'
  | 'ol'
  | 'li'
  | 'dl'
  | 'dt'
  | 'dd'
  | 'table'
  | 'caption'
  | 'thead'
  | 'tbody'
  | 'tfoot'
  | 'tr'
  | 'th'
  | 'td'
  | 'figure'
  | 'figcaption'
  | 'blockquote'
  | 'hr'
  | 'br'
  | 'img'
  | 'a'
  | 'span'
  | 'strong'
  | 'em'
  | 'b'
  | 'i'
  | 'small'
  | 'sub'
  | 'sup'
  | 'time'
  | 'code'
  | 'kbd'
  | 'samp'
  | 'mark'
  | 'button';

export type TranslationComparisonAttributes = {
  href?: string;
  src?: string;
  alt?: string;
  title?: string;
  role?: string;
  ariaLabel?: string;
  lang?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
  rowSpan?: number;
  colSpan?: number;
  listStart?: number;
};

export type TranslationComparisonSnapshotNode =
  | {
      kind: 'element';
      parentIndex?: number;
      tag: TranslationComparisonElementTag;
      attributes?: TranslationComparisonAttributes;
    }
  | {
      kind: 'text';
      parentIndex: number;
      segmentId?: string;
      text?: string;
    };

export type TranslationComparisonSnapshot = {
  rootIndex: 0;
  nodes: TranslationComparisonSnapshotNode[];
};

export type TranslationSessionSegment = {
  id: string;
  sourceFingerprint: string;
  structuralFingerprint: string;
  originalText: string;
  sourceText: string;
  translatedText?: string;
  elementRole?: string;
  status: TranslationSegmentStatus;
};

export type TranslationSessionBundle = {
  version: typeof TRANSLATION_SESSION_VERSION;
  sessionId: string;
  navigationUrl: string;
  pageFingerprint: string;
  pageTitle: string;
  sourceLanguage: string;
  targetLanguage: string;
  providerId: ProviderId;
  modelId: string;
  createdAt: number;
  lastActivityAt: number;
  displayMode: TranslationDisplayMode;
  lifecycle: TranslationSessionLifecycle;
  partial: boolean;
  segments: TranslationSessionSegment[];
  comparisonSnapshot: TranslationComparisonSnapshot;
};

export type TranslationFailureReason =
  | 'LOCAL_RATE_LIMIT'
  | 'UPSTREAM_RATE_LIMIT'
  | 'UPSTREAM_QUOTA_EXHAUSTED'
  | 'AUTHENTICATION_FAILED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'BACKEND_UNAVAILABLE'
  | 'CANCELLED'
  | 'NAVIGATION_CHANGED'
  | 'UNSUPPORTED_CONTENT'
  | 'PRIVACY_EXCLUSION'
  | 'RETRY_EXHAUSTED'
  | 'UNKNOWN';

export type TranslationFailureMetadata = {
  providerId?: ProviderId;
  translatedSegments?: number;
  totalSegments?: number;
  failedSegments?: number;
  queuedSegments?: number;
  retryAttempt?: number;
  retryAfterSeconds?: number;
  httpStatus?: number;
  automaticRetry?: boolean;
  changingProviderMayHelp?: boolean;
  requestId?: string;
  failedBatches?: number;
  unsupportedCount?: number;
  excludedCount?: number;
  causeReason?: Exclude<TranslationFailureReason, 'RETRY_EXHAUSTED'>;
};

export type TranslationFailure = {
  reason: TranslationFailureReason;
  metadata: TranslationFailureMetadata;
};

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
  queuedSegments?: number;
  waitingSegments?: number;
  retryingSegments?: number;
  targetLanguage?: string;
  detectedSourceLanguage?: string;
  error?: string;
  failure?: TranslationFailure;
  notices?: TranslationFailure[];
  displayMode?: TranslationDisplayMode;
  lifecycle?: TranslationSessionLifecycle;
  changed?: TranslationChangeSummary;
  changeScan?: TranslationChangeScanResult;
  translatedCopy?: TranslatedCopyApplicationSummary;
  pageDiverged?: boolean;
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
  | 'PROVIDER_AUTHENTICATION_FAILED'
  | 'PROVIDER_TIMEOUT'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'CANCELLED'
  | 'INTERNAL_ERROR';

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
  details?: {
    source: 'local' | 'provider' | 'backend';
    providerId?: ProviderId;
    httpStatus?: number;
    retryAfterSeconds?: number;
  };
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
