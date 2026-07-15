/* global fetch */

export const providerIds = new Set([
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

export function toProviderTestCliOutput(result) {
  if (result.status !== 'ok') return result;
  return {
    providerId: result.providerId,
    status: result.status,
    latencyMs: result.latencyMs,
  };
}

function structuredBackendError(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  const error = body.error;
  if (typeof error !== 'object' || error === null || Array.isArray(error)) return undefined;
  if (typeof error.code !== 'string' || typeof error.message !== 'string') return undefined;
  return { code: error.code, message: error.message };
}

export async function testProviderConnection(
  providerId,
  { fetchImplementation = fetch, baseUrl = 'http://127.0.0.1:8787' } = {},
) {
  let response;
  try {
    response = await fetchImplementation(`${baseUrl}/v1/providers/${providerId}/test`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { providerId, status: 'failed', code: 'BACKEND_UNAVAILABLE' };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return {
      providerId,
      status: 'failed',
      code: response.ok ? 'BACKEND_INVALID_RESPONSE' : `BACKEND_HTTP_${response.status}`,
      message: response.ok
        ? 'The backend returned an invalid provider-test response.'
        : `The backend returned HTTP ${response.status} without a structured error.`,
      httpStatus: response.status,
    };
  }

  if (!response.ok) {
    const backendError = structuredBackendError(body);
    return {
      providerId,
      status: 'failed',
      code: backendError?.code ?? `BACKEND_HTTP_${response.status}`,
      message: backendError?.message ?? `The backend returned HTTP ${response.status}.`,
      httpStatus: response.status,
    };
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    body.status !== 'ok' ||
    typeof body.providerId !== 'string' ||
    typeof body.modelId !== 'string' ||
    typeof body.latencyMs !== 'number'
  ) {
    return {
      providerId,
      status: 'failed',
      code: 'BACKEND_INVALID_RESPONSE',
      message: 'The backend returned an invalid provider-test response.',
      httpStatus: response.status,
    };
  }

  return {
    providerId: body.providerId,
    modelId: body.modelId,
    status: body.status,
    latencyMs: body.latencyMs,
  };
}
