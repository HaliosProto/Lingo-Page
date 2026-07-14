import { z } from 'zod';
import { CONTRACT_VERSION } from '@translation/shared-types';

export const requestIdSchema = z.string().regex(/^req_[a-zA-Z0-9_-]{8,96}$/);

export const apiErrorCodeSchema = z.enum([
  'AUTH_REQUIRED',
  'INVALID_REQUEST',
  'NOT_IMPLEMENTED',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1).max(300),
  retryable: z.boolean(),
  requestId: requestIdSchema,
});

export const errorResponseSchema = z.object({
  error: apiErrorSchema,
});

export const supportedLanguageSchema = z.object({
  code: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
  name: z.string().min(1).max(80),
  direction: z.enum(['ltr', 'rtl']),
  detectable: z.boolean(),
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
    name: z.enum(['none', 'mock']),
  }),
  requestId: requestIdSchema,
});

export const languagesResponseSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  languages: z.array(supportedLanguageSchema).max(100),
  requestId: requestIdSchema,
});

const messageBaseSchema = z.object({
  version: z.literal(CONTRACT_VERSION),
  requestId: requestIdSchema,
});

export const extensionRequestSchema = z.discriminatedUnion('type', [
  messageBaseSchema.extend({
    type: z.literal('GET_TAB_STATUS'),
    payload: z.object({ tabId: z.number().int().nonnegative() }),
  }),
  messageBaseSchema.extend({
    type: z.literal('PING_CONTENT_SCRIPT'),
    payload: z.object({}),
  }),
  messageBaseSchema.extend({
    type: z.literal('GET_API_HEALTH'),
    payload: z.object({}),
  }),
  messageBaseSchema.extend({
    type: z.literal('OPEN_OPTIONS'),
    payload: z.object({}),
  }),
]);

export const contentRequestSchema = messageBaseSchema.extend({
  type: z.literal('PING_CONTENT_SCRIPT'),
  payload: z.object({}),
});

export const extensionResponseSchema = z.discriminatedUnion('type', [
  messageBaseSchema.extend({
    type: z.literal('TAB_STATUS'),
    payload: z.object({
      tabId: z.number().int().nonnegative(),
      title: z.string().max(500),
      url: z.string().max(4_096),
      support: z.object({
        status: z.enum(['supported', 'unsupported', 'unknown']),
        reason: z.enum([
          'ordinary-web-page',
          'browser-internal-page',
          'extension-page',
          'chrome-web-store',
          'missing-url',
        ]),
      }),
      contentScriptReady: z.boolean(),
      apiStatus: z.enum(['unknown', 'available', 'unavailable']),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('CONTENT_PONG'),
    payload: z.object({
      ready: z.literal(true),
      extensionVersion: z.string().min(1).max(64),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('API_HEALTH'),
    payload: z.object({
      status: z.enum(['available', 'unavailable']),
      health: healthResponseSchema.nullable(),
    }),
  }),
  messageBaseSchema.extend({
    type: z.literal('OPTIONS_OPENED'),
    payload: z.object({ opened: z.literal(true) }),
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
        'INTERNAL_ERROR',
      ]),
      message: z.string().min(1).max(300),
      retryable: z.boolean(),
    }),
  }),
]);

export const translationSegmentSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/),
  text: z.string().min(1).max(2_000),
  context: z.string().max(500).optional(),
  elementRole: z.string().max(80).optional(),
  preserveTokens: z.array(z.string().max(100)).max(32).optional(),
});

export const translationRequestSchema = z.object({
  requestId: requestIdSchema,
  sourceLanguage: z
    .string()
    .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
    .optional(),
  targetLanguage: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
  mode: z.enum(['page', 'selection', 'composer']),
  segments: z.array(translationSegmentSchema).min(1).max(500),
  glossaryVersion: z.string().max(96).optional(),
  tone: z.enum(['neutral', 'formal', 'informal']).optional(),
  formality: z.enum(['default', 'more', 'less']).optional(),
});

export const translationResponseSchema = z.object({
  requestId: requestIdSchema,
  detectedSourceLanguage: z
    .string()
    .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
    .optional(),
  translations: z.array(
    z.object({
      id: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/),
      translatedText: z.string().max(16_000),
    }),
  ),
  usage: z
    .object({
      inputCharacters: z.number().int().nonnegative().optional(),
      outputCharacters: z.number().int().nonnegative().optional(),
    })
    .optional(),
  partial: z.boolean().optional(),
});

export type ExtensionRequest = z.infer<typeof extensionRequestSchema>;
export type ExtensionResponse = z.infer<typeof extensionResponseSchema>;

export function parseExtensionRequest(value: unknown): ExtensionRequest {
  return extensionRequestSchema.parse(value);
}

export function parseExtensionResponse(value: unknown): ExtensionResponse {
  return extensionResponseSchema.parse(value);
}
