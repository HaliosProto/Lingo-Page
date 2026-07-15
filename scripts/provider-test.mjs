/* global fetch */
import process from 'node:process';

const providerIds = new Set([
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

const argumentsAfterSeparator = process.argv.slice(2).filter((value) => value !== '--');
const providerId = argumentsAfterSeparator[0];
if (!providerId || !providerIds.has(providerId)) {
  console.error('Usage: pnpm provider:test -- <provider-id>');
  process.exitCode = 2;
} else {
  try {
    const response = await fetch(`http://127.0.0.1:8787/v1/providers/${providerId}/test`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json();
    if (!response.ok) {
      console.error(
        JSON.stringify({
          providerId,
          status: 'failed',
          code: body?.error?.code ?? 'UNKNOWN_ERROR',
          message: body?.error?.message ?? 'The provider test failed.',
        }),
      );
      process.exitCode = 1;
    } else {
      console.log(
        JSON.stringify({
          providerId: body.providerId,
          modelId: body.modelId,
          status: body.status,
          latencyMs: body.latencyMs,
        }),
      );
    }
  } catch {
    console.error(JSON.stringify({ providerId, status: 'failed', code: 'BACKEND_UNAVAILABLE' }));
    process.exitCode = 1;
  }
}
