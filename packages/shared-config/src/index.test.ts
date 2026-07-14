import { describe, expect, it } from 'vitest';
import { classifyPageSupport } from './index';
import { parseApiEnvironment } from './api';

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
