import { z } from 'zod';
import { CONTRACT_VERSION } from '@translation/shared-types';

export const requestIdSchema = z.string().regex(/^req_[a-zA-Z0-9_-]{8,96}$/);
export const sessionIdSchema = z.string().regex(/^session_[a-zA-Z0-9_-]{8,96}$/);
export const languageCodeSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/);
export const providerIdSchema = z.enum([
  'mock',
  'gemini',
  'openai',
  'anthropic',
  'deepl',
  'deepseek',
  'kimi',
  'glm',
  'qwen',
  'xai',
  'mistral',
  'minimax',
  'cohere',
  'custom-openai-compatible',
]);
export const modelIdSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/);

export const providerCapabilitiesSchema = z.object({
  structuredOutput: z.boolean(),
  strictJsonSchema: z.boolean(),
  streaming: z.boolean(),
  cancellation: z.boolean(),
  languageDetection: z.boolean(),
  glossary: z.boolean(),
  usageReporting: z.boolean(),
  modelDiscovery: z.boolean(),
  reasoningControls: z.boolean(),
});

export const modelDefinitionSchema = z.object({
  id: modelIdSchema,
  displayName: z.string().min(1).max(200),
  enabled: z.boolean(),
  suitableForTranslation: z.boolean(),
  supportsStructuredOutput: z.boolean(),
  contextWindow: z.number().int().positive().optional(),
  deprecated: z.boolean().optional(),
});

export const providerDefinitionSchema = z.object({
  id: providerIdSchema,
  displayName: z.string().min(1).max(100),
  protocol: z.enum([
    'mock',
    'gemini-interactions',
    'openai-responses',
    'anthropic-messages',
    'openai-chat-compatible',
    'cohere-v2',
    'deepl',
  ]),
  configured: z.boolean(),
  enabled: z.boolean(),
  defaultModel: modelIdSchema.optional(),
  availableModels: z.array(modelDefinitionSchema).max(500),
  capabilities: providerCapabilitiesSchema,
  status: z.enum(['ready', 'unconfigured', 'disabled']),
  dataRecipient: z.string().min(1).max(120),
  privacyNotice: z.string().min(1).max(300),
});

export const apiErrorCodeSchema = z.enum([
  'AUTH_REQUIRED',
  'INVALID_REQUEST',
  'NOT_IMPLEMENTED',
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'TRANSLATION_DISABLED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_AUTHENTICATION_FAILED',
  'PROVIDER_TIMEOUT',
  'INVALID_PROVIDER_RESPONSE',
  'CANCELLED',
  'INTERNAL_ERROR',
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1).max(300),
  retryable: z.boolean(),
  requestId: requestIdSchema,
  details: z
    .object({
      source: z.enum(['local', 'provider', 'backend']),
      providerId: providerIdSchema.optional(),
      httpStatus: z.number().int().min(100).max(599).optional(),
      retryAfterSeconds: z.number().int().nonnegative().max(86_400).optional(),
    })
    .optional(),
});

export const errorResponseSchema = z.object({ error: apiErrorSchema });

export const supportedLanguageSchema = z.object({
  code: languageCodeSchema,
  name: z.string().min(1).max(80),
  direction: z.enum(['ltr', 'rtl']),
  detectable: z.boolean(),
});

export const glossaryEntrySchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/),
  sourceLanguage: languageCodeSchema.optional(),
  targetLanguage: languageCodeSchema.optional(),
  sourceTerm: z.string().min(1).max(200),
  preferredTranslation: z.string().max(400),
  preserve: z.boolean(),
  caseSensitive: z.boolean(),
  wholeWord: z.boolean(),
  enabled: z.boolean(),
  notes: z.string().max(500).optional(),
});

export const appSettingsSchema = z.object({
  providerId: providerIdSchema.default('mock'),
  modelId: modelIdSchema.default('mock-deterministic'),
  defaultTargetLanguage: languageCodeSchema.default('en'),
  sourceLanguage: z.union([z.literal('auto'), languageCodeSchema]).default('auto'),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  reducedMotion: z.boolean().default(false),
  privacyMode: z.boolean().default(false),
  sensitivePageProtection: z.boolean().default(true),
  persistentCache: z.boolean().default(false),
  autoTranslateDynamicContent: z.boolean().default(true),
  selectedTextEnabled: z.boolean().default(true),
  domainExclusions: z.array(z.string().min(1).max(253)).max(200).default([]),
  glossaryVersion: z.number().int().nonnegative().default(0),
  glossary: z.array(glossaryEntrySchema).max(500).default([]),
});

export const healthResponseSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  service: z.literal('translation-api'),
  status: z.enum(['ok', 'degraded']),
  environment: z.enum(['development', 'test', 'staging', 'production']),
  appVersion: z.string().min(1).max(64),
  translationEnabled: z.boolean(),
  provider: z.object({
    configured: z.boolean(),
    id: z.union([z.literal('none'), providerIdSchema]),
    displayName: z.string().min(1).max(100),
    modelId: modelIdSchema.optional(),
  }),
  requestId: requestIdSchema,
});

export const providersResponseSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  providers: z.array(providerDefinitionSchema).max(100),
  defaultProviderId: providerIdSchema,
  requestId: requestIdSchema,
});

export const providerModelsResponseSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  providerId: providerIdSchema,
  models: z.array(modelDefinitionSchema).max(500),
  source: z.enum(['configured', 'discovered-cache', 'discovered-live']),
  requestId: requestIdSchema,
});

export const providerTestResponseSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  status: z.literal('ok'),
  latencyMs: z.number().int().nonnegative(),
  requestId: requestIdSchema,
});

export const languagesResponseSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  languages: z.array(supportedLanguageSchema).max(200),
  requestId: requestIdSchema,
});

export const translationSegmentSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/),
  text: z.string().min(1).max(2_000),
  context: z.string().max(500).optional(),
  elementRole: z.string().max(80).optional(),
  surroundingText: z.string().max(500).optional(),
  preserveTokens: z.array(z.string().max(100)).max(32).optional(),
});

export const translationRequestSchema = z.object({
  requestId: requestIdSchema,
  sessionId: sessionIdSchema,
  providerId: providerIdSchema.optional(),
  modelId: modelIdSchema.optional(),
  sourceLanguage: languageCodeSchema.optional(),
  targetLanguage: languageCodeSchema,
  mode: z.enum(['page', 'selection']),
  segments: z.array(translationSegmentSchema).min(1).max(500),
  glossaryVersion: z.string().max(96).optional(),
  glossary: z.array(glossaryEntrySchema).max(500).optional(),
  tone: z.enum(['neutral', 'formal', 'informal']).optional(),
  formality: z.enum(['default', 'more', 'less']).optional(),
});

export const translationResponseSchema = z.object({
  requestId: requestIdSchema,
  sessionId: sessionIdSchema,
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  detectedSourceLanguage: languageCodeSchema.optional(),
  translations: z.array(
    z.object({
      id: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/),
      translatedText: z.string().min(1).max(16_000),
    }),
  ),
  usage: z
    .object({
      inputCharacters: z.number().int().nonnegative().optional(),
      outputCharacters: z.number().int().nonnegative().optional(),
      inputTokens: z.number().int().nonnegative().optional(),
      outputTokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
  partial: z.boolean().optional(),
});

export const languageDetectionResponseSchema = z.object({
  requestId: requestIdSchema,
  detectedLanguage: languageCodeSchema,
  confidence: z.enum(['low', 'medium', 'high']),
});

export const languageDetectionRequestSchema = z.object({
  requestId: requestIdSchema,
  text: z.string().min(1).max(10_000),
});

export const usageResponseSchema = z.object({
  requestId: requestIdSchema,
  period: z.literal('development-session'),
  inputCharacters: z.number().int().nonnegative(),
  requests: z.number().int().nonnegative(),
  requestLimit: z.number().int().positive(),
  characterLimit: z.number().int().positive(),
});

export const diagnosticReportSchema = z.object({
  generatedAt: z.string().max(64),
  extensionVersion: z.string().min(1).max(64),
  backend: z.object({
    status: z.enum(['available', 'unavailable']),
    translationEnabled: z.boolean(),
    provider: z.union([z.literal('none'), providerIdSchema]),
    modelId: modelIdSchema.optional(),
  }),
  settings: z.object({
    providerId: providerIdSchema,
    modelId: modelIdSchema,
    privacyMode: z.boolean(),
    persistentCache: z.boolean(),
    autoTranslateDynamicContent: z.boolean(),
    selectedTextEnabled: z.boolean(),
    domainExclusionCount: z.number().int().nonnegative(),
    glossaryEntryCount: z.number().int().nonnegative(),
  }),
  cache: z.object({
    memoryEntries: z.number().int().nonnegative(),
    persistentEntries: z.number().int().nonnegative(),
  }),
});

export const translationFailureReasonSchema = z.enum([
  'LOCAL_RATE_LIMIT',
  'UPSTREAM_RATE_LIMIT',
  'UPSTREAM_QUOTA_EXHAUSTED',
  'AUTHENTICATION_FAILED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'INVALID_PROVIDER_RESPONSE',
  'BACKEND_UNAVAILABLE',
  'CANCELLED',
  'NAVIGATION_CHANGED',
  'UNSUPPORTED_CONTENT',
  'PRIVACY_EXCLUSION',
  'RETRY_EXHAUSTED',
  'UNKNOWN',
]);

const translationFailureMetadataSchema = z.object({
  providerId: providerIdSchema.optional(),
  translatedSegments: z.number().int().nonnegative().optional(),
  totalSegments: z.number().int().nonnegative().optional(),
  failedSegments: z.number().int().nonnegative().optional(),
  queuedSegments: z.number().int().nonnegative().optional(),
  retryAttempt: z.number().int().nonnegative().max(20).optional(),
  retryAfterSeconds: z.number().int().nonnegative().max(86_400).optional(),
  httpStatus: z.number().int().min(100).max(599).optional(),
  automaticRetry: z.boolean().optional(),
  changingProviderMayHelp: z.boolean().optional(),
  requestId: requestIdSchema.optional(),
  failedBatches: z.number().int().nonnegative().optional(),
  unsupportedCount: z.number().int().nonnegative().optional(),
  excludedCount: z.number().int().nonnegative().optional(),
  causeReason: z
    .enum([
      'LOCAL_RATE_LIMIT',
      'UPSTREAM_RATE_LIMIT',
      'UPSTREAM_QUOTA_EXHAUSTED',
      'AUTHENTICATION_FAILED',
      'PROVIDER_TIMEOUT',
      'PROVIDER_UNAVAILABLE',
      'INVALID_PROVIDER_RESPONSE',
      'BACKEND_UNAVAILABLE',
      'CANCELLED',
      'NAVIGATION_CHANGED',
      'UNSUPPORTED_CONTENT',
      'PRIVACY_EXCLUSION',
      'UNKNOWN',
    ])
    .optional(),
});

export const translationFailureSchema = z.object({
  reason: translationFailureReasonSchema,
  metadata: translationFailureMetadataSchema,
});

export const translationProgressSchema = z.object({
  sessionId: sessionIdSchema.optional(),
  status: z.enum([
    'idle',
    'discovering',
    'translating',
    'paused',
    'retrying',
    'completed',
    'partial',
    'cancelled',
    'error',
  ]),
  discoveredSegments: z.number().int().nonnegative(),
  translatedSegments: z.number().int().nonnegative(),
  failedSegments: z.number().int().nonnegative(),
  queuedSegments: z.number().int().nonnegative().optional(),
  waitingSegments: z.number().int().nonnegative().optional(),
  retryingSegments: z.number().int().nonnegative().optional(),
  targetLanguage: languageCodeSchema.optional(),
  detectedSourceLanguage: languageCodeSchema.optional(),
  error: z.string().max(300).optional(),
  failure: translationFailureSchema.optional(),
  notices: z.array(translationFailureSchema).max(8).optional(),
});

const messageBaseSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  requestId: requestIdSchema,
});

const translateCommandPayloadSchema = z.object({
  sessionId: sessionIdSchema,
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  sourceLanguage: z.union([z.literal('auto'), languageCodeSchema]),
  targetLanguage: languageCodeSchema,
  glossaryVersion: z.number().int().nonnegative(),
  glossary: z.array(glossaryEntrySchema).max(500),
  autoTranslateDynamicContent: z.boolean(),
});

export const extensionRequestSchema = z.discriminatedUnion('type', [
  messageBaseSchema.extend({
    type: z.literal('GET_TAB_STATUS'),
    payload: z.object({ tabId: z.number().int().nonnegative() }),
  }),
  messageBaseSchema.extend({ type: z.literal('PING_CONTENT_SCRIPT'), payload: z.object({}) }),
  messageBaseSchema.extend({ type: z.literal('GET_API_HEALTH'), payload: z.object({}) }),
  messageBaseSchema.extend({ type: z.literal('GET_PROVIDERS'), payload: z.object({}) }),
  messageBaseSchema.extend({
    type: z.literal('TEST_PROVIDER'),
    payload: z.object({ providerId: providerIdSchema }),
  }),
  messageBaseSchema.extend({ type: z.literal('OPEN_OPTIONS'), payload: z.object({}) }),
  messageBaseSchema.extend({ type: z.literal('GET_SETTINGS'), payload: z.object({}) }),
  messageBaseSchema.extend({
    type: z.literal('UPDATE_SETTINGS'),
    payload: z.object({ settings: appSettingsSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('START_PAGE_TRANSLATION'),
    payload: z
      .object({ tabId: z.number().int().nonnegative() })
      .merge(translateCommandPayloadSchema),
  }),
  messageBaseSchema.extend({
    type: z.literal('CONTINUE_PAGE_TRANSLATION'),
    payload: z.object({
      tabId: z.number().int().nonnegative(),
      sessionId: sessionIdSchema,
      providerId: providerIdSchema,
      modelId: modelIdSchema,
      useSmallerBatches: z.boolean().default(false),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('CANCEL_PAGE_TRANSLATION'),
    payload: z.object({ tabId: z.number().int().nonnegative(), sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('RESTORE_PAGE'),
    payload: z.object({ tabId: z.number().int().nonnegative() }),
  }),
  messageBaseSchema.extend({
    type: z.literal('GET_TRANSLATION_PROGRESS'),
    payload: z.object({ tabId: z.number().int().nonnegative() }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATE_SEGMENTS'),
    payload: z.object({ request: translationRequestSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('REPORT_TRANSLATION_PROGRESS'),
    payload: z.object({ progress: translationProgressSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATE_SELECTION'),
    payload: z.object({
      tabId: z.number().int().nonnegative(),
      text: z.string().min(1).max(10_000),
    }),
  }),
  messageBaseSchema.extend({ type: z.literal('CLEAR_LOCAL_DATA'), payload: z.object({}) }),
  messageBaseSchema.extend({ type: z.literal('EXPORT_DIAGNOSTICS'), payload: z.object({}) }),
]);

export const contentRequestSchema = z.discriminatedUnion('type', [
  messageBaseSchema.extend({ type: z.literal('PING_CONTENT_SCRIPT'), payload: z.object({}) }),
  messageBaseSchema.extend({
    type: z.literal('START_PAGE_TRANSLATION'),
    payload: translateCommandPayloadSchema,
  }),
  messageBaseSchema.extend({
    type: z.literal('CONTINUE_PAGE_TRANSLATION'),
    payload: z.object({
      sessionId: sessionIdSchema,
      providerId: providerIdSchema,
      modelId: modelIdSchema,
      useSmallerBatches: z.boolean().default(false),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('CANCEL_PAGE_TRANSLATION'),
    payload: z.object({ sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({ type: z.literal('RESTORE_PAGE'), payload: z.object({}) }),
  messageBaseSchema.extend({ type: z.literal('GET_TRANSLATION_PROGRESS'), payload: z.object({}) }),
  messageBaseSchema.extend({
    type: z.literal('SHOW_SELECTION_RESULT'),
    payload: z.object({
      sourceText: z.string().min(1).max(10_000),
      translatedText: z.string().min(1).max(16_000),
      sourceLanguage: languageCodeSchema.optional(),
      targetLanguage: languageCodeSchema,
    }),
  }),
]);

export const extensionResponseSchema = z.discriminatedUnion('type', [
  messageBaseSchema.extend({
    type: z.literal('TAB_STATUS'),
    payload: z.object({
      tabId: z.number().int().nonnegative(),
      title: z.string().max(500),
      url: z.string().max(4_096),
      support: z.object({
        status: z.enum(['supported', 'unsupported', 'warning', 'unknown']),
        reason: z.enum([
          'ordinary-web-page',
          'sensitive-page',
          'domain-excluded',
          'browser-internal-page',
          'extension-page',
          'chrome-web-store',
          'missing-url',
        ]),
      }),
      contentScriptReady: z.boolean(),
      apiStatus: z.enum(['unknown', 'available', 'unavailable']),
      progress: translationProgressSchema,
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('CONTENT_PONG'),
    payload: z.object({ ready: z.literal(true), extensionVersion: z.string().min(1).max(64) }),
  }),
  messageBaseSchema.extend({
    type: z.literal('API_HEALTH'),
    payload: z.object({
      status: z.enum(['available', 'unavailable']),
      health: healthResponseSchema.nullable(),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('PROVIDERS'),
    payload: providersResponseSchema,
  }),
  messageBaseSchema.extend({
    type: z.literal('PROVIDER_TEST'),
    payload: providerTestResponseSchema,
  }),
  messageBaseSchema.extend({
    type: z.literal('OPTIONS_OPENED'),
    payload: z.object({ opened: z.literal(true) }),
  }),
  messageBaseSchema.extend({
    type: z.literal('SETTINGS'),
    payload: z.object({ settings: appSettingsSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATION_PROGRESS'),
    payload: z.object({ progress: translationProgressSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATION_RESULT'),
    payload: z.object({ response: translationResponseSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('LOCAL_DATA_CLEARED'),
    payload: z.object({ cleared: z.literal(true) }),
  }),
  messageBaseSchema.extend({
    type: z.literal('DIAGNOSTICS'),
    payload: z.object({ report: diagnosticReportSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('MESSAGE_ERROR'),
    payload: z.object({
      code: z.enum([
        'INVALID_MESSAGE',
        'UNSUPPORTED_PAGE',
        'CONTENT_SCRIPT_UNAVAILABLE',
        'BACKEND_UNAVAILABLE',
        'REQUEST_TIMEOUT',
        'CANCELLED',
        'STALE_SESSION',
        'AUTH_REQUIRED',
        'RATE_LIMITED',
        'QUOTA_EXCEEDED',
        'PROVIDER_AUTHENTICATION_FAILED',
        'PROVIDER_UNAVAILABLE',
        'INVALID_PROVIDER_RESPONSE',
        'INTERNAL_ERROR',
      ]),
      message: z.string().min(1).max(300),
      retryable: z.boolean(),
      failure: translationFailureSchema.optional(),
    }),
  }),
]);

export type ExtensionRequest = z.infer<typeof extensionRequestSchema>;
export type ContentRequest = z.infer<typeof contentRequestSchema>;
export type ExtensionResponse = z.infer<typeof extensionResponseSchema>;

export function parseExtensionRequest(value: unknown): ExtensionRequest {
  return extensionRequestSchema.parse(value);
}

export function parseExtensionResponse(value: unknown): ExtensionResponse {
  return extensionResponseSchema.parse(value);
}
