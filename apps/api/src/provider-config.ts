import type { ProviderCapabilities, ProviderId } from '@translation/shared-types';
import type { ApiEnvironment } from '@translation/shared-config/api';
import {
  ProviderError,
  validateCustomProviderBaseUrl,
  type CompatibleResponseFormat,
  type ProviderRuntimeConfig,
} from '@translation/translation-providers';

const modelPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/u;

function splitList(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function models(defaultModel: string | undefined, allowlist: string | undefined): string[] {
  return [...new Set([...splitList(allowlist), ...(defaultModel ? [defaultModel] : [])])].filter(
    (value) => modelPattern.test(value),
  );
}

function capabilities(overrides: Partial<ProviderCapabilities> = {}): ProviderCapabilities {
  return {
    structuredOutput: false,
    strictJsonSchema: false,
    streaming: false,
    cancellation: true,
    languageDetection: false,
    glossary: true,
    usageReporting: true,
    modelDiscovery: false,
    reasoningControls: false,
    ...overrides,
  };
}

type ConfigInput = Omit<
  ProviderRuntimeConfig,
  'enabled' | 'timeoutMs' | 'maxOutputTokens' | 'maxRetries'
>;

export function createProviderConfigs(environment: ApiEnvironment): ProviderRuntimeConfig[] {
  const enabledList = splitList(environment.ENABLED_PROVIDERS);
  const autoEnable =
    enabledList.length === 0 || enabledList.includes('auto') || enabledList.includes('*');
  const disabled = new Set(splitList(environment.DISABLED_PROVIDERS));
  const customCapabilities = new Set(splitList(environment.CUSTOM_OPENAI_CAPABILITIES));
  let customBaseUrl = 'https://invalid.invalid';
  let customApiKey = environment.CUSTOM_OPENAI_API_KEY;
  if (environment.CUSTOM_OPENAI_BASE_URL) {
    try {
      customBaseUrl = validateCustomProviderBaseUrl(environment.CUSTOM_OPENAI_BASE_URL);
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      customApiKey = undefined;
    }
  } else {
    customApiKey = undefined;
  }

  const inputs: ConfigInput[] = [
    {
      id: 'mock',
      displayName: 'Mock',
      dataRecipient: 'Local deterministic mock',
      privacyNotice: 'No external provider receives page text.',
      protocol: 'mock',
      baseUrl: 'local://mock',
      defaultModel: 'mock-deterministic',
      allowedModels: ['mock-deterministic'],
      capabilities: capabilities({
        structuredOutput: true,
        strictJsonSchema: true,
        usageReporting: false,
      }),
    },
    {
      id: 'gemini',
      displayName: 'Gemini',
      dataRecipient: 'Google Gemini API',
      privacyNotice: 'Page text is sent to Google through the local backend with storage disabled.',
      protocol: 'gemini-interactions',
      apiKey: environment.GEMINI_API_KEY,
      baseUrl: 'https://generativelanguage.googleapis.com',
      defaultModel: environment.GEMINI_DEFAULT_MODEL,
      allowedModels: models(environment.GEMINI_DEFAULT_MODEL, environment.GEMINI_ALLOWED_MODELS),
      capabilities: capabilities({
        structuredOutput: true,
        strictJsonSchema: true,
        languageDetection: true,
        modelDiscovery: true,
        reasoningControls: true,
      }),
      modelListPath: 'https://generativelanguage.googleapis.com/v1beta/models',
    },
    {
      id: 'openai',
      displayName: 'OpenAI',
      dataRecipient: 'OpenAI API',
      privacyNotice:
        'Page text is sent to OpenAI through the local backend with response storage disabled.',
      protocol: 'openai-responses',
      apiKey: environment.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: environment.OPENAI_DEFAULT_MODEL,
      allowedModels: models(environment.OPENAI_DEFAULT_MODEL, environment.OPENAI_ALLOWED_MODELS),
      capabilities: capabilities({
        structuredOutput: true,
        strictJsonSchema: true,
        languageDetection: true,
        modelDiscovery: true,
        reasoningControls: true,
      }),
      modelListPath: '/models',
    },
    {
      id: 'anthropic',
      displayName: 'Claude',
      dataRecipient: 'Anthropic Claude API',
      privacyNotice:
        'Page text is sent to Anthropic through the local backend in a stateless Messages request.',
      protocol: 'anthropic-messages',
      apiKey: environment.ANTHROPIC_API_KEY,
      baseUrl: 'https://api.anthropic.com',
      defaultModel: environment.ANTHROPIC_DEFAULT_MODEL,
      allowedModels: models(
        environment.ANTHROPIC_DEFAULT_MODEL,
        environment.ANTHROPIC_ALLOWED_MODELS,
      ),
      capabilities: capabilities({
        structuredOutput: true,
        strictJsonSchema: true,
        languageDetection: true,
        modelDiscovery: true,
        reasoningControls: true,
      }),
      modelListPath: '/v1/models',
    },
    {
      id: 'deepl',
      displayName: 'DeepL',
      dataRecipient: 'DeepL API',
      privacyNotice: 'Page text is sent to DeepL through the local backend.',
      protocol: 'deepl',
      apiKey: environment.DEEPL_API_KEY,
      baseUrl: 'https://api.deepl.com/v2/translate',
      defaultModel: 'deepl',
      allowedModels: ['deepl'],
      capabilities: capabilities({
        structuredOutput: true,
        languageDetection: true,
        usageReporting: false,
      }),
    },
    compatible(
      'deepseek',
      'DeepSeek',
      'DeepSeek API',
      environment.DEEPSEEK_API_KEY,
      'https://api.deepseek.com',
      environment.DEEPSEEK_DEFAULT_MODEL,
      environment.DEEPSEEK_ALLOWED_MODELS,
      'json-object',
      true,
      '/models',
    ),
    compatible(
      'kimi',
      'Kimi',
      'Moonshot AI API',
      environment.MOONSHOT_API_KEY,
      'https://api.moonshot.ai/v1',
      environment.KIMI_DEFAULT_MODEL,
      environment.KIMI_ALLOWED_MODELS,
      'json-schema',
      true,
      '/models',
    ),
    compatible(
      'glm',
      'GLM',
      'Z.AI API',
      environment.ZAI_API_KEY,
      'https://api.z.ai/api/paas/v4',
      environment.GLM_DEFAULT_MODEL,
      environment.GLM_ALLOWED_MODELS,
      'json-object',
      false,
    ),
    compatible(
      'qwen',
      'Qwen',
      'Alibaba Cloud Model Studio',
      environment.DASHSCOPE_API_KEY,
      environment.QWEN_BASE_URL,
      environment.QWEN_DEFAULT_MODEL,
      environment.QWEN_ALLOWED_MODELS,
      'json-object',
      false,
      undefined,
      'The configured Alibaba region receives page text through the local backend.',
    ),
    compatible(
      'xai',
      'Grok',
      'xAI API',
      environment.XAI_API_KEY,
      'https://api.x.ai/v1',
      environment.XAI_DEFAULT_MODEL,
      environment.XAI_ALLOWED_MODELS,
      'json-object',
      true,
      '/models',
    ),
    compatible(
      'mistral',
      'Mistral',
      'Mistral AI API',
      environment.MISTRAL_API_KEY,
      'https://api.mistral.ai/v1',
      environment.MISTRAL_DEFAULT_MODEL,
      environment.MISTRAL_ALLOWED_MODELS,
      'json-object',
      true,
      '/models',
    ),
    compatible(
      'minimax',
      'MiniMax',
      'MiniMax API',
      environment.MINIMAX_API_KEY,
      'https://api.minimax.io/v1',
      environment.MINIMAX_DEFAULT_MODEL,
      environment.MINIMAX_ALLOWED_MODELS,
      'json-object',
      true,
      '/models',
    ),
    {
      id: 'cohere',
      displayName: 'Cohere',
      dataRecipient: 'Cohere API',
      privacyNotice: 'Page text is sent to Cohere through the local backend.',
      protocol: 'cohere-v2',
      apiKey: environment.COHERE_API_KEY,
      baseUrl: 'https://api.cohere.com',
      defaultModel: environment.COHERE_DEFAULT_MODEL,
      allowedModels: models(environment.COHERE_DEFAULT_MODEL, environment.COHERE_ALLOWED_MODELS),
      capabilities: capabilities({
        structuredOutput: true,
        strictJsonSchema: true,
        languageDetection: true,
        reasoningControls: true,
      }),
    },
    {
      id: 'custom-openai-compatible',
      displayName: 'Custom OpenAI-compatible',
      dataRecipient: 'Backend-configured custom provider',
      privacyNotice:
        'Page text is sent only to the custom endpoint configured by the backend administrator.',
      protocol: 'openai-chat-compatible',
      apiKey: customApiKey,
      baseUrl: customBaseUrl,
      defaultModel: environment.CUSTOM_OPENAI_DEFAULT_MODEL,
      allowedModels: models(
        environment.CUSTOM_OPENAI_DEFAULT_MODEL,
        environment.CUSTOM_OPENAI_ALLOWED_MODELS,
      ),
      capabilities: capabilities({
        structuredOutput:
          customCapabilities.has('json-schema') || customCapabilities.has('json-object'),
        strictJsonSchema: customCapabilities.has('json-schema'),
        cancellation: customCapabilities.has('cancellation'),
        usageReporting: customCapabilities.has('usage'),
        reasoningControls: customCapabilities.has('reasoning'),
      }),
      responseFormat: customCapabilities.has('json-schema')
        ? 'json-schema'
        : customCapabilities.has('json-object')
          ? 'json-object'
          : 'prompt-only',
    },
  ];

  return inputs.map((input) => ({
    ...input,
    enabled: !disabled.has(input.id) && (autoEnable || enabledList.includes(input.id)),
    timeoutMs: environment.PROVIDER_TIMEOUT_MS,
    maxOutputTokens: environment.MAX_OUTPUT_TOKENS,
    maxRetries:
      input.protocol === 'openai-chat-compatible' ? (environment.PROVIDER_MAX_RETRIES as 0 | 1) : 0,
  }));
}

function compatible(
  id: ProviderId,
  displayName: string,
  dataRecipient: string,
  apiKey: string | undefined,
  baseUrl: string,
  defaultModel: string | undefined,
  allowedModels: string | undefined,
  responseFormat: CompatibleResponseFormat,
  modelDiscovery: boolean,
  modelListPath?: string,
  privacyNotice = `Page text is sent to ${dataRecipient} through the local backend.`,
): ConfigInput {
  return {
    id,
    displayName,
    dataRecipient,
    privacyNotice,
    protocol: 'openai-chat-compatible',
    apiKey,
    baseUrl,
    defaultModel,
    allowedModels: models(defaultModel, allowedModels),
    capabilities: capabilities({
      structuredOutput: responseFormat !== 'prompt-only',
      strictJsonSchema: responseFormat === 'json-schema',
      languageDetection: true,
      modelDiscovery,
      reasoningControls: true,
    }),
    responseFormat,
    ...(modelListPath ? { modelListPath } : {}),
  };
}
