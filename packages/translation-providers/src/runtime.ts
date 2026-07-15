import type {
  ModelDefinition,
  ProviderCapabilities,
  ProviderId,
  ProviderProtocol,
  TranslationRequest,
  TranslationResponse,
} from '@translation/shared-types';

export type ProviderContext = { signal?: AbortSignal };

export type ProviderErrorCode =
  | 'cancelled'
  | 'timeout'
  | 'authentication'
  | 'rate-limited'
  | 'quota-exceeded'
  | 'invalid-response'
  | 'unavailable';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;

  constructor(code: ProviderErrorCode, message: string, retryable: boolean, cause?: unknown) {
    super(message, { cause });
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

export type CompatibleResponseFormat = 'json-schema' | 'json-object' | 'prompt-only';

export type ProviderRuntimeConfig = {
  id: ProviderId;
  displayName: string;
  dataRecipient: string;
  privacyNotice: string;
  protocol: ProviderProtocol;
  enabled: boolean;
  apiKey?: string;
  baseUrl: string;
  defaultModel?: string;
  allowedModels: string[];
  capabilities: ProviderCapabilities;
  timeoutMs: number;
  maxOutputTokens: number;
  maxRetries: 0 | 1;
  responseFormat?: CompatibleResponseFormat;
  modelListPath?: string;
  fetchImpl?: typeof fetch;
};

export interface TranslationProvider {
  readonly id: ProviderId;
  readonly modelId: string;
  translate(request: TranslationRequest, context: ProviderContext): Promise<TranslationResponse>;
  discoverModels?(context: ProviderContext): Promise<ModelDefinition[]>;
}

export function createAbortScope(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(parent?.reason);
  parent?.addEventListener('abort', onAbort, { once: true });
  if (parent?.aborted) controller.abort(parent.reason);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('Provider request timed out.'));
  }, timeoutMs);
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timeout);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

export function joinEndpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/u, '')}/${path.replace(/^\//u, '')}`;
}

export function mapHttpFailure(status: number): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('authentication', 'Provider authentication failed.', false);
  }
  if (status === 429) {
    return new ProviderError('rate-limited', 'The provider rate limit was reached.', true);
  }
  if (status === 402 || status === 456) {
    return new ProviderError('quota-exceeded', 'The provider quota was reached.', false);
  }
  return new ProviderError('unavailable', `Provider request failed (${status}).`, status >= 500);
}

export async function fetchProviderJson(
  config: ProviderRuntimeConfig,
  url: string,
  init: RequestInit,
  context: ProviderContext,
): Promise<unknown> {
  const scope = createAbortScope(context.signal, config.timeoutMs);
  let response: Response;
  try {
    response = await (config.fetchImpl ?? fetch)(url, { ...init, signal: scope.signal });
  } catch (error) {
    if (scope.didTimeout()) {
      throw new ProviderError('timeout', 'The translation provider timed out.', true, error);
    }
    if (context.signal?.aborted) {
      throw new ProviderError('cancelled', 'The translation was cancelled.', false, error);
    }
    throw new ProviderError('unavailable', 'The translation provider is unavailable.', true, error);
  } finally {
    scope.dispose();
  }
  if (!response.ok) throw mapHttpFailure(response.status);
  try {
    return await response.json();
  } catch (error) {
    throw new ProviderError('invalid-response', 'Provider returned invalid JSON.', true, error);
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProviderError('invalid-response', 'Provider returned an invalid response.', true);
  }
  return value as Record<string, unknown>;
}

export function asNonnegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}
