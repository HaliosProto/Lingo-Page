import { describe, expect, it } from 'vitest';
import { classifyPageSupport, parseApiEnvironment } from './index';

describe('shared configuration', () => {
  it('applies safe development environment defaults', () => {
    const environment = parseApiEnvironment({});

    expect(environment.ENVIRONMENT).toBe('development');
    expect(environment.TRANSLATION_ENABLED).toBe(false);
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
});
