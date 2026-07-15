import { z } from 'zod';
import { DEFAULT_APP_VERSION } from './index';

const providerIdValues = [
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
] as const;

const optionalSecret = z.string().max(1_000).optional();
const optionalModel = z.string().max(200).optional();
const optionalModelList = z.string().max(10_000).optional();

export const apiEnvironmentSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_VERSION: z.string().min(1).max(64).default(DEFAULT_APP_VERSION),
  ALLOWED_EXTENSION_IDS: z.string().default(''),
  TRANSLATION_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .default('true')
    .transform((value) => value === 'true'),
  TRANSLATION_DEFAULT_PROVIDER: z.enum(providerIdValues).default('mock'),
  TRANSLATION_PROVIDER: z.enum(providerIdValues).default('mock'),
  ENABLED_PROVIDERS: z.string().max(2_000).default('auto'),
  DISABLED_PROVIDERS: z.string().max(2_000).default(''),
  MOCK_TRANSLATION_DELAY_MS: z.coerce.number().int().nonnegative().max(2_000).default(0),
  DEV_AUTH_TOKEN: z.string().max(500).optional(),
  GEMINI_API_KEY: optionalSecret,
  GEMINI_DEFAULT_MODEL: optionalModel,
  GEMINI_ALLOWED_MODELS: optionalModelList,
  OPENAI_API_KEY: optionalSecret,
  OPENAI_DEFAULT_MODEL: optionalModel,
  OPENAI_ALLOWED_MODELS: optionalModelList,
  ANTHROPIC_API_KEY: optionalSecret,
  ANTHROPIC_DEFAULT_MODEL: optionalModel,
  ANTHROPIC_ALLOWED_MODELS: optionalModelList,
  DEEPL_API_KEY: optionalSecret,
  DEEPSEEK_API_KEY: optionalSecret,
  DEEPSEEK_DEFAULT_MODEL: optionalModel,
  DEEPSEEK_ALLOWED_MODELS: optionalModelList,
  MOONSHOT_API_KEY: optionalSecret,
  KIMI_DEFAULT_MODEL: optionalModel,
  KIMI_ALLOWED_MODELS: optionalModelList,
  ZAI_API_KEY: optionalSecret,
  GLM_DEFAULT_MODEL: optionalModel,
  GLM_ALLOWED_MODELS: optionalModelList,
  DASHSCOPE_API_KEY: optionalSecret,
  QWEN_DEFAULT_MODEL: optionalModel,
  QWEN_ALLOWED_MODELS: optionalModelList,
  QWEN_BASE_URL: z
    .enum([
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
    ])
    .default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  XAI_API_KEY: optionalSecret,
  XAI_DEFAULT_MODEL: optionalModel,
  XAI_ALLOWED_MODELS: optionalModelList,
  MISTRAL_API_KEY: optionalSecret,
  MISTRAL_DEFAULT_MODEL: optionalModel,
  MISTRAL_ALLOWED_MODELS: optionalModelList,
  MINIMAX_API_KEY: optionalSecret,
  MINIMAX_DEFAULT_MODEL: optionalModel,
  MINIMAX_ALLOWED_MODELS: optionalModelList,
  COHERE_API_KEY: optionalSecret,
  COHERE_DEFAULT_MODEL: optionalModel,
  COHERE_ALLOWED_MODELS: optionalModelList,
  CUSTOM_OPENAI_API_KEY: optionalSecret,
  CUSTOM_OPENAI_BASE_URL: z.string().url().max(500).optional(),
  CUSTOM_OPENAI_DEFAULT_MODEL: optionalModel,
  CUSTOM_OPENAI_ALLOWED_MODELS: optionalModelList,
  CUSTOM_OPENAI_CAPABILITIES: z.string().max(1_000).default('json-object,cancellation,usage'),
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
  MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(100_000).default(8_000),
  MAX_CONCURRENT_PROVIDER_REQUESTS: z.coerce.number().int().positive().max(100).default(4),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(20_000),
  PROVIDER_MAX_RETRIES: z.coerce.number().int().min(0).max(1).default(1),
  PROVIDER_CHARACTER_QUOTAS: z.string().max(4_000).default(''),
  MODEL_DISCOVERY_CACHE_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3_600),
  REQUESTS_PER_MINUTE: z.coerce.number().int().positive().max(1_000).default(30),
  CHARACTERS_PER_SESSION: z.coerce.number().int().positive().max(10_000_000).default(200_000),
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function parseApiEnvironment(input: Record<string, unknown>): ApiEnvironment {
  const parsed = apiEnvironmentSchema.parse(input);
  return {
    ...parsed,
    TRANSLATION_DEFAULT_PROVIDER:
      input.TRANSLATION_DEFAULT_PROVIDER === undefined && parsed.TRANSLATION_PROVIDER
        ? parsed.TRANSLATION_PROVIDER
        : parsed.TRANSLATION_DEFAULT_PROVIDER,
  };
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
