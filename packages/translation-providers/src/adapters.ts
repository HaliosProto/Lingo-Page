import {
  DEFAULT_TRANSLATION_POLICY,
  TRANSLATION_RESPONSE_VERSION,
  type ModelDefinition,
  type TranslationRequest,
  type TranslationResponse,
} from '@translation/shared-types';
import {
  applyGlossary,
  protectTokens,
  restoreTokens,
  runDeterministicQualityChecks,
  segmentsRequiringReview,
  validateTranslationResponse,
} from '@translation/translation-core';
import {
  ProviderError,
  asNonnegativeInteger,
  asRecord,
  fetchProviderJson,
  joinEndpoint,
  type ProviderContext,
  type ProviderRuntimeConfig,
  type TranslationProvider,
} from './runtime';
import {
  parseTranslationJson,
  prepareTranslationPrompt,
  translationOutputJsonSchema,
  type PreparedTranslationPrompt,
} from './prompt';

type TransportResult = {
  text: string;
  usage?: TranslationResponse['usage'];
  finishReason?: string;
  responseTruncated?: boolean;
};

function requireText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProviderError('invalid-response', 'Provider returned no output text.', true);
  }
  return value;
}

function endpoint(config: ProviderRuntimeConfig, path: string): string {
  return /^https:\/\//u.test(path) ? path : joinEndpoint(config.baseUrl, path);
}

async function callOpenAIResponses(
  config: ProviderRuntimeConfig,
  prompt: PreparedTranslationPrompt,
  context: ProviderContext,
): Promise<TransportResult> {
  const payload = asRecord(
    await fetchProviderJson(
      config,
      endpoint(config, '/responses'),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.defaultModel,
          store: false,
          input: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'translation_result',
              strict: true,
              schema: translationOutputJsonSchema,
            },
          },
          max_output_tokens: config.maxOutputTokens,
        }),
      },
      context,
    ),
  );
  if (payload.status !== 'completed' || !Array.isArray(payload.output)) {
    throw new ProviderError('invalid-response', 'Provider returned an incomplete response.', true);
  }
  const texts: string[] = [];
  for (const item of payload.output) {
    const output = asRecord(item);
    if (!Array.isArray(output.content)) continue;
    for (const part of output.content) {
      const content = asRecord(part);
      if (content.type === 'output_text' && typeof content.text === 'string')
        texts.push(content.text);
      if (content.type === 'refusal') {
        throw new ProviderError('invalid-response', 'Provider refused the translation.', false);
      }
    }
  }
  const usage = payload.usage ? asRecord(payload.usage) : {};
  return {
    text: requireText(texts.join('')),
    usage: {
      inputTokens: asNonnegativeInteger(usage.input_tokens),
      outputTokens: asNonnegativeInteger(usage.output_tokens),
    },
  };
}

async function callAnthropic(
  config: ProviderRuntimeConfig,
  prompt: PreparedTranslationPrompt,
  context: ProviderContext,
): Promise<TransportResult> {
  const payload = asRecord(
    await fetchProviderJson(
      config,
      endpoint(config, '/v1/messages'),
      {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.defaultModel,
          max_tokens: config.maxOutputTokens,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }],
          output_config: {
            format: { type: 'json_schema', schema: translationOutputJsonSchema },
          },
        }),
      },
      context,
    ),
  );
  if (payload.stop_reason !== 'end_turn' || !Array.isArray(payload.content)) {
    throw new ProviderError('invalid-response', 'Provider returned an incomplete response.', true);
  }
  const text = payload.content
    .map((part) => asRecord(part))
    .filter((part) => part.type === 'text')
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
  const usage = payload.usage ? asRecord(payload.usage) : {};
  return {
    text: requireText(text),
    usage: {
      inputTokens: asNonnegativeInteger(usage.input_tokens),
      outputTokens: asNonnegativeInteger(usage.output_tokens),
    },
  };
}

async function callGemini(
  config: ProviderRuntimeConfig,
  prompt: PreparedTranslationPrompt,
  context: ProviderContext,
): Promise<TransportResult> {
  const payload = asRecord(
    await fetchProviderJson(
      config,
      endpoint(config, '/v1/interactions'),
      {
        method: 'POST',
        headers: { 'x-goog-api-key': config.apiKey!, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.defaultModel,
          input: prompt.user,
          system_instruction: prompt.system,
          store: false,
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: translationOutputJsonSchema,
          },
          generation_config: {
            max_output_tokens: config.maxOutputTokens,
            temperature: 0,
            thinking_summaries: 'none',
          },
        }),
      },
      context,
    ),
  );
  if (!Array.isArray(payload.steps)) {
    throw new ProviderError('invalid-response', 'Provider returned an incomplete response.', true);
  }
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  if (status && ['failed', 'cancelled', 'refused', 'rejected'].includes(status.toLowerCase())) {
    throw new ProviderError(
      'invalid-response',
      'Provider explicitly refused or failed the translation request.',
      false,
    );
  }
  const texts: string[] = [];
  for (const value of payload.steps) {
    const step = asRecord(value);
    if (step.type !== 'model_output' || !Array.isArray(step.content)) continue;
    for (const valuePart of step.content) {
      const part = asRecord(valuePart);
      if (part.type === 'text' && typeof part.text === 'string') texts.push(part.text);
    }
  }
  const usage = payload.usage ? asRecord(payload.usage) : {};
  const finishReason = typeof payload.finish_reason === 'string' ? payload.finish_reason : status;
  return {
    text: requireText(texts.join('')),
    usage: {
      inputTokens: asNonnegativeInteger(usage.total_input_tokens),
      outputTokens: asNonnegativeInteger(usage.total_output_tokens),
    },
    ...(finishReason ? { finishReason } : {}),
    responseTruncated: status !== undefined && status !== 'completed',
  };
}

async function callCohere(
  config: ProviderRuntimeConfig,
  prompt: PreparedTranslationPrompt,
  context: ProviderContext,
): Promise<TransportResult> {
  const payload = asRecord(
    await fetchProviderJson(
      config,
      endpoint(config, '/v2/chat'),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.defaultModel,
          stream: false,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          response_format: { type: 'json_object', schema: translationOutputJsonSchema },
          max_tokens: config.maxOutputTokens,
          temperature: 0,
        }),
      },
      context,
    ),
  );
  if (payload.finish_reason !== 'COMPLETE') {
    throw new ProviderError('invalid-response', 'Provider returned an incomplete response.', true);
  }
  const message = asRecord(payload.message);
  if (!Array.isArray(message.content)) {
    throw new ProviderError('invalid-response', 'Provider returned no content.', true);
  }
  const text = message.content
    .map((part) => asRecord(part))
    .filter((part) => part.type === 'text')
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
  const usage = payload.usage ? asRecord(payload.usage) : {};
  const tokens = usage.tokens ? asRecord(usage.tokens) : {};
  return {
    text: requireText(text),
    usage: {
      inputTokens: asNonnegativeInteger(tokens.input_tokens),
      outputTokens: asNonnegativeInteger(tokens.output_tokens),
    },
  };
}

async function callOpenAICompatible(
  config: ProviderRuntimeConfig,
  prompt: PreparedTranslationPrompt,
  context: ProviderContext,
): Promise<TransportResult> {
  const responseFormat =
    config.responseFormat === 'json-schema'
      ? {
          type: 'json_schema',
          json_schema: {
            name: 'translation_result',
            strict: true,
            schema: translationOutputJsonSchema,
          },
        }
      : config.responseFormat === 'json-object'
        ? { type: 'json_object' }
        : undefined;
  const payload = asRecord(
    await fetchProviderJson(
      config,
      endpoint(config, '/chat/completions'),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.defaultModel,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature: 0,
          max_tokens: config.maxOutputTokens,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      },
      context,
    ),
  );
  if (!Array.isArray(payload.choices) || payload.choices.length !== 1) {
    throw new ProviderError('invalid-response', 'Provider returned an invalid completion.', true);
  }
  const choice = asRecord(payload.choices[0]);
  if (choice.finish_reason !== 'stop') {
    throw new ProviderError(
      'invalid-response',
      'Provider returned an incomplete or refused completion.',
      false,
    );
  }
  const message = asRecord(choice.message);
  const usage = payload.usage ? asRecord(payload.usage) : {};
  return {
    text: requireText(message.content),
    usage: {
      inputTokens: asNonnegativeInteger(usage.prompt_tokens),
      outputTokens: asNonnegativeInteger(usage.completion_tokens),
    },
  };
}

function createLlmProvider(config: ProviderRuntimeConfig): TranslationProvider {
  if (!config.apiKey?.trim() || !config.defaultModel) {
    throw new ProviderError('authentication', 'The translation provider is not configured.', false);
  }
  const transport =
    config.protocol === 'openai-responses'
      ? callOpenAIResponses
      : config.protocol === 'anthropic-messages'
        ? callAnthropic
        : config.protocol === 'gemini-interactions'
          ? callGemini
          : config.protocol === 'cohere-v2'
            ? callCohere
            : callOpenAICompatible;
  return {
    id: config.id,
    modelId: config.defaultModel,
    async translate(request, context) {
      const prepared = prepareTranslationPrompt(request, config.capabilities);
      let lastError: unknown;
      let translationProviderCalls = 0;
      for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
        try {
          translationProviderCalls += 1;
          const result = await transport(config, prepared, context);
          const translated = parseTranslationJson(
            result.text,
            request,
            config,
            prepared,
            result.usage,
            {
              ...(result.finishReason ? { finishReason: result.finishReason } : {}),
              responseTruncated: result.responseTruncated,
            },
          );
          if (translated.quality)
            translated.quality.translationProviderCalls = request.review
              ? 0
              : translationProviderCalls;
          const reviewIds = request.review
            ? []
            : (translated.quality?.reviewRequestedSegmentIds ?? []).slice(0, 50);
          if (reviewIds.length === 0) return translated;
          const reviewSegments = request.segments.filter((segment) =>
            reviewIds.includes(segment.id),
          );
          const reviewCandidates = translated.translations
            .filter((translation) => reviewIds.includes(translation.id))
            .map((translation) => ({
              id: translation.id,
              translatedText: translation.translatedText,
            }));
          if (reviewSegments.length === 0 || reviewCandidates.length === 0) return translated;
          const reviewRequest: TranslationRequest = {
            ...request,
            segments: reviewSegments,
            review: {
              mode: 'automatic',
              segmentIds: reviewCandidates.map((candidate) => candidate.id),
              candidates: reviewCandidates,
              pass: 1,
            },
          };
          try {
            const reviewPrepared = prepareTranslationPrompt(reviewRequest, config.capabilities);
            const reviewResult = await transport(config, reviewPrepared, context);
            const reviewed = parseTranslationJson(
              reviewResult.text,
              reviewRequest,
              config,
              reviewPrepared,
              reviewResult.usage,
              {
                ...(reviewResult.finishReason ? { finishReason: reviewResult.finishReason } : {}),
                responseTruncated: reviewResult.responseTruncated,
              },
            );
            const corrections = new Map(
              reviewed.translations.map((translation) => [
                translation.id,
                translation.translatedText,
              ]),
            );
            const merged = translated.translations.map((translation) => ({
              ...translation,
              translatedText: corrections.get(translation.id) ?? translation.translatedText,
            }));
            const reviewedIds = new Set(reviewIds);
            return {
              ...translated,
              translations: merged,
              quality: {
                findings: [
                  ...(translated.quality?.findings ?? []).filter(
                    (finding) => !reviewedIds.has(finding.segmentId),
                  ),
                  ...(reviewed.quality?.findings ?? []),
                ],
                reviewRequestedSegmentIds: [],
                translationProviderCalls,
                reviewProviderCalls: 1,
              },
              review: {
                pass: 1,
                decisions: reviewIds.map((segmentId) => {
                  const original = reviewCandidates.find((candidate) => candidate.id === segmentId);
                  const corrected = corrections.get(segmentId);
                  return corrected === undefined
                    ? { segmentId, decision: 'unresolved' as const }
                    : corrected === original?.translatedText
                      ? { segmentId, decision: 'accept' as const }
                      : { segmentId, decision: 'correct' as const, correctedText: corrected };
                }),
              },
            };
          } catch (error) {
            if (error instanceof ProviderError && error.code === 'cancelled') throw error;
            return {
              ...translated,
              quality: translated.quality
                ? {
                    ...translated.quality,
                    translationProviderCalls,
                    reviewRequestedSegmentIds: [],
                    reviewProviderCalls: 1,
                  }
                : undefined,
              review: {
                pass: 1,
                decisions: reviewIds.map((segmentId) => ({
                  segmentId,
                  decision: 'unresolved' as const,
                })),
              },
            };
          }
        } catch (error) {
          lastError = error;
          if (
            !(error instanceof ProviderError) ||
            error.code !== 'invalid-response' ||
            !error.retryable
          )
            throw error;
        }
      }
      throw lastError;
    },
    ...(config.modelListPath
      ? { discoverModels: (context: ProviderContext) => discoverAllowedModels(config, context) }
      : {}),
  };
}

async function discoverAllowedModels(
  config: ProviderRuntimeConfig,
  context: ProviderContext,
): Promise<ModelDefinition[]> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.protocol === 'gemini-interactions') headers['x-goog-api-key'] = config.apiKey!;
  else if (config.protocol === 'anthropic-messages') {
    headers['x-api-key'] = config.apiKey!;
    headers['anthropic-version'] = '2023-06-01';
  } else headers.Authorization = `Bearer ${config.apiKey}`;
  const payload = await fetchProviderJson(
    config,
    endpoint(config, config.modelListPath!),
    { method: 'GET', headers },
    context,
  );
  const root = asRecord(payload);
  const values = Array.isArray(root.data)
    ? root.data
    : Array.isArray(root.models)
      ? root.models
      : Array.isArray(payload)
        ? payload
        : [];
  const discovered = new Set<string>();
  for (const value of values) {
    const model = asRecord(value);
    const rawId =
      typeof model.id === 'string' ? model.id : typeof model.name === 'string' ? model.name : '';
    const id = rawId.replace(/^models\//u, '');
    if (config.allowedModels.includes(id)) discovered.add(id);
  }
  return config.allowedModels.map((id) => ({
    id,
    displayName: id,
    enabled: discovered.has(id),
    suitableForTranslation: true,
    supportsStructuredOutput: config.capabilities.structuredOutput,
  }));
}

export function createMockProvider(options: { delayMs?: number } = {}): TranslationProvider {
  return {
    id: 'mock',
    modelId: 'mock-deterministic',
    async translate(request, context) {
      if (context.signal?.aborted) {
        throw new ProviderError('cancelled', 'The mock translation was cancelled.', false);
      }
      if ((options.delayMs ?? 0) > 0) {
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timer);
            reject(new ProviderError('cancelled', 'The mock translation was cancelled.', false));
          };
          const timer = setTimeout(() => {
            context.signal?.removeEventListener('abort', onAbort);
            resolve();
          }, options.delayMs);
          context.signal?.addEventListener('abort', onAbort, { once: true });
        });
      }
      const translations = request.segments.map((segment) => {
        const protectedValue = protectTokens(segment.text, segment.preserveTokens);
        return {
          id: segment.id,
          translatedText: restoreTokens(
            applyGlossary(
              `[${request.targetLanguage}] ${protectedValue.text}`,
              request.glossary ?? [],
              request.sourceLanguage,
              request.targetLanguage,
            ),
            protectedValue.tokens,
          ),
        };
      });
      const policy = request.policy ?? {
        ...DEFAULT_TRANSLATION_POLICY,
        targetLanguage: request.targetLanguage,
      };
      const findings = policy.quality.deterministicChecks
        ? translations.flatMap((translation) =>
            runDeterministicQualityChecks({
              segment: request.segments.find((segment) => segment.id === translation.id)!,
              translatedText: translation.translatedText,
              targetLanguage: request.targetLanguage,
              glossary: request.glossary ?? policy.terminology.entries,
            }),
          )
        : [];
      return validateTranslationResponse(request, {
        schemaVersion: TRANSLATION_RESPONSE_VERSION,
        requestId: request.requestId,
        sessionId: request.sessionId,
        providerId: 'mock',
        modelId: 'mock-deterministic',
        detectedSourceLanguage: request.sourceLanguage ?? 'en',
        translations,
        usage: {
          inputCharacters: request.segments.reduce(
            (total, segment) => total + segment.text.length,
            0,
          ),
          outputCharacters: translations.reduce(
            (total, item) => total + item.translatedText.length,
            0,
          ),
        },
        quality: {
          findings,
          reviewRequestedSegmentIds: segmentsRequiringReview(findings, policy),
          translationProviderCalls: 1,
          reviewProviderCalls: 0,
        },
      });
    },
  };
}

type DeepLProviderOptions = {
  apiKey: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function normalizeDeepLLanguage(code: string): string {
  const normalized = code.toUpperCase().replace('_', '-');
  return (
    ({ EN: 'EN-US', PT: 'PT-BR', ZH: 'ZH-HANS' } as Record<string, string>)[normalized] ??
    normalized
  );
}

export function createDeepLProvider(options: DeepLProviderOptions): TranslationProvider {
  const config: ProviderRuntimeConfig = {
    id: 'deepl',
    displayName: 'DeepL',
    dataRecipient: 'DeepL',
    privacyNotice: 'Page text is sent to DeepL through the local backend.',
    protocol: 'deepl',
    enabled: true,
    apiKey: options.apiKey,
    baseUrl:
      options.endpoint ??
      (options.apiKey.endsWith(':fx')
        ? 'https://api-free.deepl.com/v2/translate'
        : 'https://api.deepl.com/v2/translate'),
    defaultModel: 'deepl',
    allowedModels: ['deepl'],
    capabilities: {
      structuredOutput: true,
      strictJsonSchema: false,
      streaming: false,
      cancellation: true,
      languageDetection: true,
      glossary: true,
      usageReporting: false,
      modelDiscovery: false,
      reasoningControls: false,
    },
    timeoutMs: options.timeoutMs ?? 12_000,
    maxOutputTokens: 8_000,
    maxRetries: 0,
    fetchImpl: options.fetchImpl,
  };
  return {
    id: 'deepl',
    modelId: 'deepl',
    async translate(request, context) {
      if (!options.apiKey.trim()) {
        throw new ProviderError(
          'authentication',
          'The translation provider is not configured.',
          false,
        );
      }
      const protectedSegments = request.segments.map((segment) => protectTokens(segment.text));
      const payload = asRecord(
        await fetchProviderJson(
          config,
          config.baseUrl,
          {
            method: 'POST',
            headers: {
              Authorization: `DeepL-Auth-Key ${options.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: protectedSegments.map((segment) => segment.text),
              target_lang: normalizeDeepLLanguage(request.targetLanguage),
              ...(request.sourceLanguage
                ? { source_lang: normalizeDeepLLanguage(request.sourceLanguage) }
                : {}),
              ...(request.formality && request.formality !== 'default'
                ? { formality: request.formality === 'more' ? 'more' : 'less' }
                : {}),
              preserve_formatting: true,
            }),
          },
          context,
        ),
      );
      if (
        !Array.isArray(payload.translations) ||
        payload.translations.length !== request.segments.length
      ) {
        throw new ProviderError(
          'invalid-response',
          'Provider returned an invalid translation set.',
          true,
        );
      }
      const translations = payload.translations.map((value, index) => {
        const item = asRecord(value);
        return {
          id: request.segments[index]!.id,
          translatedText: restoreTokens(requireText(item.text), protectedSegments[index]!.tokens),
        };
      });
      try {
        return validateTranslationResponse(request, {
          schemaVersion: TRANSLATION_RESPONSE_VERSION,
          requestId: request.requestId,
          sessionId: request.sessionId,
          providerId: 'deepl',
          modelId: 'deepl',
          detectedSourceLanguage:
            typeof asRecord(payload.translations[0]).detected_source_language === 'string'
              ? String(asRecord(payload.translations[0]).detected_source_language).toLowerCase()
              : undefined,
          translations,
          usage: {
            inputCharacters: request.segments.reduce(
              (total, segment) => total + segment.text.length,
              0,
            ),
            outputCharacters: translations.reduce(
              (total, item) => total + item.translatedText.length,
              0,
            ),
          },
        });
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw new ProviderError(
          'invalid-response',
          'Provider response failed validation.',
          true,
          error,
        );
      }
    },
  };
}

export function createProviderFromConfig(config: ProviderRuntimeConfig): TranslationProvider {
  if (!config.enabled) {
    throw new ProviderError('unavailable', 'The translation provider is disabled.', false);
  }
  if (config.id === 'mock') return createMockProvider();
  if (config.id === 'deepl') {
    return createDeepLProvider({
      apiKey: config.apiKey ?? '',
      timeoutMs: config.timeoutMs,
      fetchImpl: config.fetchImpl,
    });
  }
  return createLlmProvider(config);
}
