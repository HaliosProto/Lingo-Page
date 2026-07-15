import { describe, expect, it, vi } from 'vitest';
import { testProviderConnection, toProviderTestCliOutput } from './provider-test-lib.mjs';

describe('provider test CLI classification', () => {
  it('does not print the backend-configured model identifier on success', () => {
    expect(
      toProviderTestCliOutput({
        providerId: 'gemini',
        modelId: 'configured-model-value',
        status: 'ok',
        latencyMs: 10,
      }),
    ).toEqual({ providerId: 'gemini', status: 'ok', latencyMs: 10 });
  });

  it('preserves a structured backend HTTP 500 error classification', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'The backend environment configuration failed validation.',
          requestId: 'req_backend_test_12345',
          retryable: false,
        },
      }),
    });

    await expect(testProviderConnection('gemini', { fetchImplementation })).resolves.toEqual({
      providerId: 'gemini',
      status: 'failed',
      code: 'INTERNAL_ERROR',
      message: 'The backend environment configuration failed validation.',
      httpStatus: 500,
    });
  });

  it('distinguishes a non-JSON HTTP 500 from an unavailable backend', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('invalid JSON');
      },
    });

    await expect(testProviderConnection('gemini', { fetchImplementation })).resolves.toEqual({
      providerId: 'gemini',
      status: 'failed',
      code: 'BACKEND_HTTP_500',
      message: 'The backend returned HTTP 500 without a structured error.',
      httpStatus: 500,
    });
  });

  it('uses BACKEND_UNAVAILABLE only when no HTTP response is received', async () => {
    const fetchImplementation = vi.fn().mockRejectedValue(new TypeError('connection refused'));

    await expect(testProviderConnection('gemini', { fetchImplementation })).resolves.toEqual({
      providerId: 'gemini',
      status: 'failed',
      code: 'BACKEND_UNAVAILABLE',
    });
  });
});
