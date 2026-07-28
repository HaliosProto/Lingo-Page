import { z } from 'zod';
import {
  CONTRACT_VERSION,
  TRANSLATION_RECOVERY_VERSION,
  TRANSLATION_SESSION_VERSION,
} from '@translation/shared-types';

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
  operationId: z
    .string()
    .regex(/^op_[a-f0-9]{32}$/u)
    .optional(),
  batchId: z
    .string()
    .regex(/^batch_[a-f0-9]{32}$/u)
    .optional(),
  attemptId: z
    .string()
    .regex(/^attempt_[a-f0-9]{32}$/u)
    .optional(),
  navigationGeneration: z.number().int().nonnegative().max(1_000_000).optional(),
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
  recovery: z
    .object({
      classification: z.enum([
        'complete',
        'valid-partial',
        'truncated-json',
        'malformed-json',
        'invalid-structured-output',
        'missing-ids',
        'duplicate-ids',
        'unknown-ids',
        'empty-translation',
      ]),
      requestedSegmentIds: z.array(translationSegmentSchema.shape.id).max(500),
      returnedSegmentIds: z.array(translationSegmentSchema.shape.id).max(500),
      missingSegmentIds: z.array(translationSegmentSchema.shape.id).max(500),
      duplicateSegmentIds: z.array(translationSegmentSchema.shape.id).max(500),
      unknownSegmentIds: z.array(translationSegmentSchema.shape.id).max(500),
      emptySegmentIds: z.array(translationSegmentSchema.shape.id).max(500),
      parseFailure: z.boolean(),
      finishReason: z.string().max(120).optional(),
      responseTruncated: z.boolean(),
      inputCharacters: z.number().int().nonnegative(),
      estimatedInputTokens: z.number().int().nonnegative(),
      estimatedOutputTokens: z.number().int().nonnegative(),
      responseBytes: z.number().int().nonnegative(),
      batchSize: z.number().int().positive().max(500),
    })
    .optional(),
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
  failureCategory: z
    .enum([
      'complete',
      'valid-partial',
      'truncated-json',
      'malformed-json',
      'invalid-structured-output',
      'missing-ids',
      'duplicate-ids',
      'unknown-ids',
      'empty-translation',
      'rate-limit',
      'timeout',
      'authentication',
      'quota',
      'provider-refusal',
      'offline',
      'backend-unavailable',
      'retry-exhaustion',
    ])
    .optional(),
  requestedCount: z.number().int().nonnegative().max(500).optional(),
  returnedValidCount: z.number().int().nonnegative().max(500).optional(),
  missingCount: z.number().int().nonnegative().max(500).optional(),
  duplicateCount: z.number().int().nonnegative().max(500).optional(),
  unknownCount: z.number().int().nonnegative().max(500).optional(),
  emptyCount: z.number().int().nonnegative().max(500).optional(),
  parseFailure: z.boolean().optional(),
  finishReason: z.string().max(120).optional(),
  responseTruncated: z.boolean().optional(),
  splitDepth: z.number().int().nonnegative().max(20).optional(),
  smallestAttemptedBatch: z.number().int().positive().max(500).optional(),
  unresolvedCount: z.number().int().nonnegative().max(5_000).optional(),
  inputCharacterCount: z.number().int().nonnegative().optional(),
  estimatedInputTokens: z.number().int().nonnegative().optional(),
  estimatedOutputTokens: z.number().int().nonnegative().optional(),
  responseSize: z.number().int().nonnegative().optional(),
  batchSize: z.number().int().positive().max(500).optional(),
  retryHistory: z.string().max(2_000).optional(),
});

export const translationFailureSchema = z.object({
  reason: translationFailureReasonSchema,
  metadata: translationFailureMetadataSchema,
});

const translatedCopyApplicationStatusSchema = z.enum([
  'applying',
  'ready',
  'partial',
  'no-matches',
  'import-failed',
  'session-stale',
]);

const translatedCopyApplicationSummarySchema = z.object({
  status: translatedCopyApplicationStatusSchema,
  discoveredSegments: z.number().int().nonnegative().max(5_000),
  matchedSegments: z.number().int().nonnegative().max(5_000),
  appliedSegments: z.number().int().nonnegative().max(5_000),
  unmatchedSegments: z.number().int().nonnegative().max(5_000),
  uncertainSegments: z.number().int().nonnegative().max(5_000),
  changedSegments: z.number().int().nonnegative().max(5_000),
  providerRequests: z.literal(0),
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
  displayMode: z.enum(['original', 'translated', 'mixed-partial']).optional(),
  lifecycle: z
    .enum(['active', 'translating', 'partial', 'complete', 'stale', 'ended', 'invalidated'])
    .optional(),
  changed: z
    .object({
      newSegments: z.number().int().nonnegative().max(5_000),
      modifiedSegments: z.number().int().nonnegative().max(5_000),
      removedSegments: z.number().int().nonnegative().max(5_000),
      reorderedSegments: z.number().int().nonnegative().max(5_000),
      uncertainSegments: z.number().int().nonnegative().max(5_000),
    })
    .optional(),
  changeScan: z
    .object({
      status: z.enum(['no-changes', 'changes-found', 'updated']),
      summary: z.object({
        newSegments: z.number().int().nonnegative().max(5_000),
        modifiedSegments: z.number().int().nonnegative().max(5_000),
        removedSegments: z.number().int().nonnegative().max(5_000),
        reorderedSegments: z.number().int().nonnegative().max(5_000),
        uncertainSegments: z.number().int().nonnegative().max(5_000),
      }),
      updatedSegments: z.number().int().nonnegative().max(5_000).optional(),
    })
    .optional(),
  translatedCopy: translatedCopyApplicationSummarySchema.optional(),
  pageDiverged: z.boolean().optional(),
  recoveryState: z
    .enum([
      'recovering',
      'recovered',
      'expired',
      'stale',
      'incompatible',
      'offline',
      'backend-unavailable',
    ])
    .optional(),
  recoveryMessage: z.string().max(300).optional(),
  processedSegments: z.number().int().nonnegative().max(5_000).optional(),
  deferredSegments: z.number().int().nonnegative().max(5_000).optional(),
  safetyLimit: z.number().int().positive().max(5_000).optional(),
});

const translationDisplayModeSchema = z.enum(['original', 'translated']);
const comparisonTokenSchema = z.string().regex(/^cmp_[a-f0-9]{32}$/);
const translatedCopyTokenSchema = z.string().regex(/^copy_[a-f0-9]{32}$/);
const sessionSegmentIdSchema = z.string().regex(/^seg_[a-zA-Z0-9_-]{1,120}$/);
const comparisonElementTagSchema = z.enum([
  'main',
  'article',
  'section',
  'header',
  'footer',
  'nav',
  'aside',
  'div',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'figure',
  'figcaption',
  'blockquote',
  'hr',
  'br',
  'img',
  'a',
  'span',
  'strong',
  'em',
  'b',
  'i',
  'small',
  'sub',
  'sup',
  'time',
  'code',
  'kbd',
  'samp',
  'mark',
  'button',
]);

const comparisonAttributesSchema = z.object({
  href: z
    .string()
    .url()
    .max(4_096)
    .refine((value) => /^https?:\/\//u.test(value))
    .optional(),
  src: z
    .string()
    .url()
    .max(4_096)
    .refine((value) => /^https?:\/\//u.test(value))
    .optional(),
  alt: z.string().max(500).optional(),
  title: z.string().max(500).optional(),
  role: z.string().max(100).optional(),
  ariaLabel: z.string().max(500).optional(),
  lang: z
    .string()
    .regex(/^[a-zA-Z0-9-]{1,35}$/u)
    .optional(),
  dir: z.enum(['auto', 'ltr', 'rtl']).optional(),
  rowSpan: z.number().int().min(1).max(100).optional(),
  colSpan: z.number().int().min(1).max(100).optional(),
  listStart: z.number().int().min(-10_000).max(10_000).optional(),
});

const comparisonSnapshotNodeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('element'),
    parentIndex: z.number().int().nonnegative().max(14_999).optional(),
    tag: comparisonElementTagSchema,
    attributes: comparisonAttributesSchema.optional(),
  }),
  z
    .object({
      kind: z.literal('text'),
      parentIndex: z.number().int().nonnegative().max(14_999),
      segmentId: sessionSegmentIdSchema.optional(),
      text: z.string().max(2_200).optional(),
    })
    .refine((node) => Boolean(node.segmentId) !== (node.text !== undefined), {
      message: 'Comparison text nodes require exactly one text source.',
    }),
]);

const comparisonSnapshotSchema = z
  .object({
    rootIndex: z.literal(0),
    nodes: z.array(comparisonSnapshotNodeSchema).min(1).max(15_000),
  })
  .superRefine((snapshot, context) => {
    if (snapshot.nodes[0]?.kind !== 'element' || snapshot.nodes[0].parentIndex !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'The comparison snapshot root is invalid.',
        path: ['nodes', 0],
      });
    }
    const depths = new Array<number>(snapshot.nodes.length).fill(0);
    snapshot.nodes.forEach((node, index) => {
      if (index === 0) return;
      if (node.parentIndex === undefined || node.parentIndex >= index) {
        context.addIssue({
          code: 'custom',
          message: 'Comparison snapshot parents must precede their children.',
          path: ['nodes', index, 'parentIndex'],
        });
        return;
      }
      depths[index] = depths[node.parentIndex]! + 1;
      if (depths[index] > 40) {
        context.addIssue({
          code: 'custom',
          message: 'Comparison snapshot nesting exceeds the safe limit.',
          path: ['nodes', index, 'parentIndex'],
        });
      }
    });
  });

export const translationSessionBundleSchema = z.object({
  version: z.literal(TRANSLATION_SESSION_VERSION),
  sessionId: sessionIdSchema,
  navigationUrl: z
    .string()
    .url()
    .max(4_096)
    .refine((value) => /^https?:\/\//u.test(value)),
  pageFingerprint: z.string().min(4).max(160),
  pageTitle: z.string().max(500),
  sourceLanguage: z.union([z.literal('auto'), languageCodeSchema]),
  targetLanguage: languageCodeSchema,
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  createdAt: z.number().int().nonnegative(),
  lastActivityAt: z.number().int().nonnegative(),
  displayMode: z.enum(['original', 'translated', 'mixed-partial']),
  lifecycle: z.enum([
    'active',
    'translating',
    'partial',
    'complete',
    'stale',
    'ended',
    'invalidated',
  ]),
  partial: z.boolean(),
  segments: z
    .array(
      z.object({
        id: sessionSegmentIdSchema,
        sourceFingerprint: z.string().min(2).max(120),
        structuralFingerprint: z.string().min(2).max(300),
        originalText: z.string().max(2_200),
        sourceText: z.string().min(1).max(2_000),
        translatedText: z.string().max(16_000).optional(),
        elementRole: z.string().max(100).optional(),
        status: z.enum(['pending', 'translated', 'failed', 'changed', 'uncertain', 'removed']),
      }),
    )
    .max(2_500),
  comparisonSnapshot: comparisonSnapshotSchema,
});

export const translationRecoveryRecordSchema = z.object({
  version: z.literal(TRANSLATION_RECOVERY_VERSION),
  sourceTabId: z.number().int().nonnegative(),
  frameId: z.literal(0),
  sessionId: sessionIdSchema,
  operationId: z.string().regex(/^op_[a-f0-9]{32}$/u),
  normalizedOrigin: z
    .string()
    .url()
    .max(2_048)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return /^https?:$/u.test(parsed.protocol) && parsed.origin === value;
      } catch {
        return false;
      }
    }),
  originIdentity: z.string().regex(/^[a-f0-9]{64}$/u),
  navigationIdentity: z.string().regex(/^[a-f0-9]{64}$/u),
  translationIdentity: z.string().regex(/^[a-f0-9]{64}$/u),
  navigationGeneration: z.number().int().nonnegative().max(1_000_000),
  pageFingerprint: z.string().min(4).max(160),
  sourceLanguage: z.union([z.literal('auto'), languageCodeSchema]),
  targetLanguage: languageCodeSchema,
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  retryDeadlineAt: z.number().int().nonnegative().optional(),
  displayMode: z.enum(['original', 'translated', 'mixed-partial']),
  lifecycle: z.enum([
    'active',
    'translating',
    'partial',
    'complete',
    'stale',
    'ended',
    'invalidated',
  ]),
  partial: z.boolean(),
  cancelled: z.boolean(),
  restartRecoveryEnabled: z.boolean(),
  claim: z
    .object({
      state: z.enum(['owned', 'orphaned', 'claiming']),
      ownerTabId: z.number().int().nonnegative().optional(),
      browserInstanceId: z.string().regex(/^[a-f0-9]{32}$/u),
      claimId: z
        .string()
        .regex(/^claim_[a-f0-9]{32}$/u)
        .optional(),
      reason: z
        .enum(['window-closing', 'tab-closed', 'browser-restart', 'tab-replaced'])
        .optional(),
      detachedAt: z.number().int().nonnegative().optional(),
      claimStartedAt: z.number().int().nonnegative().optional(),
      claimExpiresAt: z.number().int().nonnegative().optional(),
    })
    .superRefine((claim, context) => {
      if (claim.state === 'owned' && claim.ownerTabId === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['ownerTabId'],
          message: 'Owned recovery claims require a tab owner.',
        });
      }
      if (
        claim.state === 'claiming' &&
        (claim.ownerTabId === undefined ||
          claim.claimId === undefined ||
          claim.claimStartedAt === undefined ||
          claim.claimExpiresAt === undefined ||
          claim.claimExpiresAt <= claim.claimStartedAt)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'In-flight recovery claims require a bounded claim identity and owner.',
        });
      }
    }),
  progress: translationProgressSchema,
  completedSegmentIds: z.array(sessionSegmentIdSchema).max(2_500),
  segments: z
    .array(
      z.object({
        id: sessionSegmentIdSchema,
        sourceFingerprint: z.string().min(2).max(120),
        structuralFingerprint: z.string().min(2).max(300),
        translatedText: z.string().max(16_000).optional(),
        elementRole: z.string().max(100).optional(),
        status: z.enum(['pending', 'translated', 'failed', 'changed', 'uncertain', 'removed']),
      }),
    )
    .max(2_500),
});

export const translatedCopyHandoffRecordSchema = z.object({
  version: z.literal(1),
  token: translatedCopyTokenSchema,
  tabId: z.number().int().nonnegative(),
  sourceTabId: z.number().int().nonnegative().optional(),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  bundle: translationSessionBundleSchema,
});

export const translatedCopyHandoffIndexSchema = z.discriminatedUnion('status', [
  z.object({
    version: z.literal(1),
    status: z.literal('pending'),
    token: translatedCopyTokenSchema,
    sourceTabId: z.number().int().nonnegative().optional(),
    expiresAt: z.number().int().nonnegative(),
  }),
  z.object({
    version: z.literal(1),
    status: z.literal('acknowledged'),
    token: translatedCopyTokenSchema,
    sourceTabId: z.number().int().nonnegative().optional(),
    applicationStatus: z.enum(['ready', 'partial', 'no-matches']),
    applicationStage: z.literal('destination-ready'),
    discoveredSegments: z.number().int().nonnegative().max(5_000),
    appliedSegments: z.number().int().nonnegative().max(5_000),
    changedSegments: z.number().int().nonnegative().max(5_000),
    providerRequests: z.literal(0),
    matchedSegments: z.number().int().nonnegative().max(5_000),
    unmatchedSegments: z.number().int().nonnegative().max(5_000),
    uncertainSegments: z.number().int().nonnegative().max(5_000),
  }),
  z.object({
    version: z.literal(1),
    status: z.literal('failed'),
    token: translatedCopyTokenSchema,
    sourceTabId: z.number().int().nonnegative().optional(),
    message: z.string().min(1).max(300),
  }),
]);

const translatedCopyIntentIdSchema = z.string().regex(/^copyIntent_[a-f0-9]{32}$/u);
const translatedCopyOriginPatternSchema = z
  .string()
  .max(4_096)
  .regex(/^https?:\/\/[^/\s]+\/\*$/u);
export const translatedCopyIntentRecordSchema = z.object({
  version: z.literal(1),
  intentId: translatedCopyIntentIdSchema,
  state: z.enum([
    'CREATED',
    'REQUESTING_PERMISSION',
    'PERMISSION_GRANTED',
    'OPENING_DESTINATION',
    'DESTINATION_CREATED',
    'APPLYING_TRANSLATION',
    'COMPLETED',
    'DENIED',
    'FAILED',
    'EXPIRED',
  ]),
  sourceTabId: z.number().int().nonnegative(),
  sessionId: sessionIdSchema,
  originPattern: translatedCopyOriginPatternSchema,
  navigationIdentity: z.string().regex(/^[a-f0-9]{64}$/u),
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  destinationTabId: z.number().int().nonnegative().optional(),
  failureCode: z
    .enum(['permission-revoked', 'source-changed', 'destination-failed', 'expired'])
    .optional(),
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
  restartRecoveryEnabled: z.boolean().default(false),
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
    type: z.literal('SET_PAGE_VIEW'),
    payload: z.object({
      tabId: z.number().int().nonnegative(),
      sessionId: sessionIdSchema,
      displayMode: translationDisplayModeSchema,
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('END_TRANSLATION_SESSION'),
    payload: z.object({ tabId: z.number().int().nonnegative(), sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('SCAN_PAGE_CHANGES'),
    payload: z.object({ tabId: z.number().int().nonnegative(), sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('UPDATE_CHANGED_SECTIONS'),
    payload: z.object({ tabId: z.number().int().nonnegative(), sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('REFRESH_TRANSLATION'),
    payload: z.object({
      tabId: z.number().int().nonnegative(),
      sessionId: sessionIdSchema,
      scope: z.enum(['changed', 'entire-page']),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('OPEN_TRANSLATED_COPY'),
    payload: z.object({ tabId: z.number().int().nonnegative(), sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('CREATE_TRANSLATED_COPY_INTENT'),
    payload: z.object({
      tabId: z.number().int().nonnegative(),
      sessionId: sessionIdSchema,
      navigationUrl: z
        .string()
        .url()
        .max(4_096)
        .refine((value) => /^https?:\/\//u.test(value)),
      providerId: providerIdSchema,
      modelId: modelIdSchema,
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('RESUME_TRANSLATED_COPY_INTENT'),
    payload: z.object({ intentId: translatedCopyIntentIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('DENY_TRANSLATED_COPY_INTENT'),
    payload: z.object({ intentId: translatedCopyIntentIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('GET_TRANSLATED_COPY_DENIED_ORIGINS'),
    payload: z.object({}),
  }),
  messageBaseSchema.extend({
    type: z.literal('OPEN_TRANSLATED_COPY_FROM_BUNDLE'),
    payload: z.object({ bundle: translationSessionBundleSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('GET_TRANSLATED_COPY_HANDOFF'),
    payload: z.object({}),
  }),
  messageBaseSchema.extend({
    type: z.literal('ACK_TRANSLATED_COPY_HANDOFF'),
    payload: z.object({
      token: translatedCopyTokenSchema,
      applicationStatus: z.enum(['ready', 'partial', 'no-matches']),
      applicationStage: z.literal('destination-ready'),
      discoveredSegments: z.number().int().nonnegative().max(5_000),
      appliedSegments: z.number().int().nonnegative().max(5_000),
      changedSegments: z.number().int().nonnegative().max(5_000),
      providerRequests: z.literal(0),
      matchedSegments: z.number().int().nonnegative().max(5_000),
      unmatchedSegments: z.number().int().nonnegative().max(5_000),
      uncertainSegments: z.number().int().nonnegative().max(5_000),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('REJECT_TRANSLATED_COPY_HANDOFF'),
    payload: z.object({ token: translatedCopyTokenSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATE_IMPORTED_SECTIONS'),
    payload: z.object({ sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('FOCUS_TRANSLATED_COPY_SOURCE'),
    payload: z.object({ token: translatedCopyTokenSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('OPEN_COMPARISON_VIEW'),
    payload: z.object({ tabId: z.number().int().nonnegative(), sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('GET_COMPARISON_SESSION'),
    payload: z.object({ token: comparisonTokenSchema }),
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
    payload: z.object({
      progress: translationProgressSchema,
      recovery: translationRecoveryRecordSchema.optional(),
    }),
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
  messageBaseSchema.extend({
    type: z.literal('SET_PAGE_VIEW'),
    payload: z.object({ sessionId: sessionIdSchema, displayMode: translationDisplayModeSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('END_TRANSLATION_SESSION'),
    payload: z.object({ sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('SCAN_PAGE_CHANGES'),
    payload: z.object({ sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('UPDATE_CHANGED_SECTIONS'),
    payload: z.object({ sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('REFRESH_TRANSLATION'),
    payload: z.object({ sessionId: sessionIdSchema, scope: z.enum(['changed', 'entire-page']) }),
  }),
  messageBaseSchema.extend({
    type: z.literal('EXPORT_SESSION_BUNDLE'),
    payload: z.object({ sessionId: sessionIdSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('IMPORT_SESSION_BUNDLE'),
    payload: z.object({ bundle: translationSessionBundleSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('IMPORT_RECOVERY_RECORD'),
    payload: z.object({ recovery: translationRecoveryRecordSchema }),
  }),
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
    type: z.literal('SESSION_BUNDLE'),
    payload: z.object({ bundle: translationSessionBundleSchema }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATED_COPY_OPENED'),
    payload: z.object({
      tabId: z.number().int().nonnegative(),
      applicationStatus: z.enum(['ready', 'partial', 'no-matches']),
      applicationStage: z.literal('destination-ready'),
      discoveredSegments: z.number().int().nonnegative(),
      appliedSegments: z.number().int().nonnegative(),
      changedSegments: z.number().int().nonnegative(),
      providerRequests: z.literal(0),
      matchedSegments: z.number().int().nonnegative(),
      unmatchedSegments: z.number().int().nonnegative(),
      uncertainSegments: z.number().int().nonnegative(),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATED_COPY_INTENT_STATUS'),
    payload: z.object({
      intentId: translatedCopyIntentIdSchema,
      state: translatedCopyIntentRecordSchema.shape.state,
      originPattern: translatedCopyOriginPatternSchema,
      destinationTabId: z.number().int().nonnegative().optional(),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATED_COPY_DENIED_ORIGINS'),
    payload: z.object({ origins: z.array(translatedCopyOriginPatternSchema).max(200) }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATED_COPY_HANDOFF'),
    payload: z.object({
      token: translatedCopyTokenSchema,
      bundle: translationSessionBundleSchema,
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATED_COPY_HANDOFF_STATUS'),
    payload: z.object({
      status: z.enum(['none', 'already-applied', 'failed']),
      message: z.string().min(1).max(300).optional(),
      applicationStatus: z.enum(['ready', 'partial', 'no-matches']).optional(),
      applicationStage: z.literal('destination-ready').optional(),
      discoveredSegments: z.number().int().nonnegative().max(5_000).optional(),
      appliedSegments: z.number().int().nonnegative().max(5_000).optional(),
      changedSegments: z.number().int().nonnegative().max(5_000).optional(),
      providerRequests: z.literal(0).optional(),
      matchedSegments: z.number().int().nonnegative().max(5_000).optional(),
      unmatchedSegments: z.number().int().nonnegative().max(5_000).optional(),
      uncertainSegments: z.number().int().nonnegative().max(5_000).optional(),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('TRANSLATED_COPY_ACKNOWLEDGED'),
    payload: z.object({ acknowledged: z.literal(true) }),
  }),
  messageBaseSchema.extend({
    type: z.literal('COMPARISON_OPENED'),
    payload: z.object({ tabId: z.number().int().nonnegative() }),
  }),
  messageBaseSchema.extend({
    type: z.literal('COMPARISON_SESSION'),
    payload: z.object({ bundle: translationSessionBundleSchema }),
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
