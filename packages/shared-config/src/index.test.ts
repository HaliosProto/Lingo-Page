import { describe, expect, it } from 'vitest';
import { classifyPageSupport } from './index';
import { parseApiEnvironment, safeParseApiEnvironment } from './api';

describe('shared configuration', () => {
  it('applies safe development environment defaults', () => {
    const environment = parseApiEnvironment({});

    expect(environment.ENVIRONMENT).toBe('development');
    expect(environment.TRANSLATION_ENABLED).toBe(true);
    expect(environment.TRANSLATION_PROVIDER).toBe('mock');
    expect(environment.MAX_SEGMENTS_PER_REQUEST).toBe(500);
  });

  it('rejects invalid environment values', () => {
    expect(() => parseApiEnvironment({ ENVIRONMENT: 'unknown' })).toThrow();
  });

  it('accepts a valid Gemini-only environment configuration', () => {
    const environment = parseApiEnvironment({
      TRANSLATION_DEFAULT_PROVIDER: 'gemini',
      ENABLED_PROVIDERS: 'gemini',
      GEMINI_API_KEY: 'synthetic-test-key',
      GEMINI_DEFAULT_MODEL: 'gemini-test-model',
      GEMINI_ALLOWED_MODELS: 'gemini-test-model,gemini-test-model-2',
    });

    expect(environment.TRANSLATION_DEFAULT_PROVIDER).toBe('gemini');
    expect(environment.GEMINI_DEFAULT_MODEL).toBe('gemini-test-model');
    expect(environment.GEMINI_ALLOWED_MODELS).toBe('gemini-test-model,gemini-test-model-2');
  });

  it('normalizes blank optional template variables without rejecting the environment', () => {
    const environment = parseApiEnvironment({
      DEV_AUTH_TOKEN: '  ',
      GEMINI_API_KEY: '',
      GEMINI_DEFAULT_MODEL: '',
      GEMINI_ALLOWED_MODELS: '',
      CUSTOM_OPENAI_API_KEY: '',
      CUSTOM_OPENAI_BASE_URL: '',
      CUSTOM_OPENAI_DEFAULT_MODEL: '',
      CUSTOM_OPENAI_ALLOWED_MODELS: '',
      CUSTOM_OPENAI_CAPABILITIES: '',
      QWEN_BASE_URL: '',
    });

    expect(environment.DEV_AUTH_TOKEN).toBeUndefined();
    expect(environment.GEMINI_API_KEY).toBeUndefined();
    expect(environment.CUSTOM_OPENAI_BASE_URL).toBeUndefined();
    expect(environment.CUSTOM_OPENAI_CAPABILITIES).toBe('json-object,cancellation,usage');
    expect(environment.QWEN_BASE_URL).toBe(
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    );
  });

  it('returns privacy-safe diagnostics for malformed environment values', () => {
    const result = safeParseApiEnvironment({ CUSTOM_OPENAI_BASE_URL: 'not-a-valid-url' });

    expect(result).toMatchObject({
      success: false,
      schemaName: 'apiEnvironmentSchema',
      issues: [
        {
          path: 'CUSTOM_OPENAI_BASE_URL',
          expected: 'url',
          receivedCategory: 'string',
          message: 'Invalid URL',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('not-a-valid-url');
  });

  it('classifies restricted and ordinary pages', () => {
    expect(classifyPageSupport('https://example.com').status).toBe('supported');
    expect(classifyPageSupport('chrome://settings').status).toBe('unsupported');
    expect(classifyPageSupport(undefined).status).toBe('unknown');
  });

  it('blocks sensitive pages in privacy mode and otherwise warns', () => {
    const settings = {
      domainExclusions: [],
      sensitivePageProtection: true,
      privacyMode: false,
    };
    expect(classifyPageSupport('https://bank.example/account', settings).status).toBe('warning');
    expect(
      classifyPageSupport('https://bank.example/account', { ...settings, privacyMode: true })
        .status,
    ).toBe('unsupported');
  });
});
