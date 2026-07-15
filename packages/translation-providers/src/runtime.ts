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
  readonly httpStatus?: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ProviderErrorCode,
    message: string,
    retryable: boolean,
    cause?: unknown,
    metadata: { httpStatus?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message, { cause });
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable;
    this.httpStatus = metadata.httpStatus;
    this.retryAfterSeconds = metadata.retryAfterSeconds;
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

function parseRetryAfter(headers: Headers): number | undefined {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(86_400, Math.ceil(seconds));
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.min(86_400, Math.max(0, Math.ceil((date - Date.now()) / 1_000)));
}

export function mapHttpFailure(response: Pick<Response, 'status' | 'headers'>): ProviderError {
  const { status } = response;
  const metadata = { httpStatus: status, retryAfterSeconds: parseRetryAfter(response.headers) };
  if (status === 401 || status === 403) {
    return new ProviderError(
      'authentication',
      'Provider authentication failed.',
      false,
      undefined,
      metadata,
    );
  }
  if (status === 429) {
    return new ProviderError(
      'rate-limited',
      'The provider rate limit was reached.',
      true,
      undefined,
      metadata,
    );
  }
  if (status === 402 || status === 456) {
    return new ProviderError(
      'quota-exceeded',
      'The provider quota was reached.',
      false,
      undefined,
      metadata,
    );
  }
  return new ProviderError(
    'unavailable',
    `Provider request failed (${status}).`,
    status >= 500,
    undefined,
    metadata,
  );
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
  if (!response.ok) throw mapHttpFailure(response);
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
