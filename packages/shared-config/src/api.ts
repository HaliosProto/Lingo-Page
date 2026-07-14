import { z } from 'zod';
import { DEFAULT_APP_VERSION } from './index';

export const apiEnvironmentSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_VERSION: z.string().min(1).max(64).default(DEFAULT_APP_VERSION),
  ALLOWED_EXTENSION_IDS: z.string().default(''),
  TRANSLATION_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .default('true')
    .transform((value) => value === 'true'),
  TRANSLATION_PROVIDER: z.enum(['mock', 'deepl']).default('mock'),
  MOCK_TRANSLATION_DELAY_MS: z.coerce.number().int().nonnegative().max(2_000).default(0),
  DEV_AUTH_TOKEN: z.string().max(500).optional(),
  DEEPL_API_KEY: z.string().max(500).optional(),
  OPENAI_API_KEY: z.string().max(500).optional(),
  GOOGLE_TRANSLATE_API_KEY: z.string().max(500).optional(),
  AZURE_TRANSLATOR_KEY: z.string().max(500).optional(),
  AZURE_TRANSLATOR_REGION: z.string().max(100).optional(),
  MAX_SEGMENTS_PER_REQUEST: z.coerce.number().int().positive().max(5_000).default(500),
  MAX_INPUT_CHARACTERS_PER_REQUEST: z.coerce
    .number()
    .int()
    .positive()
    .max(1_000_000)
    .default(20_000),
  MAX_OUTPUT_CHARACTERS_PER_REQUEST: z.coerce
    .number()
    .int()
    .positive()
    .max(2_000_000)
    .default(60_000),
  REQUESTS_PER_MINUTE: z.coerce.number().int().positive().max(1_000).default(30),
  CHARACTERS_PER_SESSION: z.coerce.number().int().positive().max(10_000_000).default(200_000),
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function parseApiEnvironment(input: Record<string, unknown>): ApiEnvironment {
  return apiEnvironmentSchema.parse(input);
}

export function isAllowedExtensionOrigin(origin: string, environment: ApiEnvironment): boolean {
  if (!origin) return false;
  if (environment.ENVIRONMENT === 'development' || environment.ENVIRONMENT === 'test') {
    return (
      origin.startsWith('chrome-extension://') ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    );
  }
  const allowedIds = environment.ALLOWED_EXTENSION_IDS.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return allowedIds.some((id) => origin === `chrome-extension://${id}`);
}
