import { describe, expect, it } from 'vitest';
import type { TranslationRequest } from '@translation/shared-types';
import {
  applyGlossary,
  batchSegments,
  createCacheKey,
  deduplicateSegments,
  isLikelyTranslatableText,
  normalizeText,
  protectTokens,
  restoreTokens,
  validateTranslationResponse,
} from './index';

describe('translation core', () => {
  it('normalizes provider text while preserving exact edge whitespace', () => {
    expect(normalizeText('\n  Hello   world  ')).toEqual({
      normalized: 'Hello world',
      leadingWhitespace: '\n  ',
      trailingWhitespace: '  ',
    });
  });

  it('filters identifiers, numeric values, URLs, and blank strings', () => {
    expect(isLikelyTranslatableText('Readable sentence')).toBe(true);
    for (const value of ['', '  ', '123,456.00', 'https://example.com', 'CONSTANT_NAME']) {
      expect(isLikelyTranslatableText(value)).toBe(false);
    }
    expect(isLikelyTranslatableText('Text after a URL check')).toBe(true);
  });

  it('batches deterministically by count and characters', () => {
    const segments = ['one', 'two', 'three'].map((text, index) => ({ id: `s${index}`, text }));
    expect(batchSegments(segments, { maxSegments: 2, maxCharacters: 7 })).toEqual([
      segments.slice(0, 2),
      segments.slice(2),
    ]);
  });

  it('deduplicates equal text and context without losing duplicate IDs', () => {
    const result = deduplicateSegments([
      { id: 'one', text: 'Hello', context: 'p' },
      { id: 'two', text: 'Hello', context: 'p' },
      { id: 'three', text: 'Hello', context: 'button' },
    ]);
    expect(result.unique.map((segment) => segment.id)).toEqual(['one', 'three']);
    expect(result.duplicates.get('one')).toEqual(['two']);
  });

  it('protects and restores URLs, email addresses, and placeholders', () => {
    const protectedValue = protectTokens('Visit https://example.com for {{name}} at a@example.com');
    expect(protectedValue.text).not.toContain('https://example.com');
    expect(restoreTokens(protectedValue.text, protectedValue.tokens)).toBe(
      'Visit https://example.com for {{name}} at a@example.com',
    );
  });

  it('escapes page-authored strings that resemble internal placeholder tokens', () => {
    const original = 'Literal __LINGO_TOKEN_0__ plus {{name}}';
    const protectedValue = protectTokens(original);
    expect(protectedValue.text).not.toContain('__LINGO_TOKEN_0__');
    expect(restoreTokens(protectedValue.text, protectedValue.tokens)).toBe(original);
  });

  it('applies glossary preserve and preferred-translation rules', () => {
    const output = applyGlossary('Use Lingo and colour.', [
      {
        id: 'lingo',
        sourceTerm: 'Lingo',
        preferredTranslation: '',
        preserve: true,
        caseSensitive: true,
        wholeWord: true,
        enabled: true,
      },
      {
        id: 'colour',
        sourceTerm: 'colour',
        preferredTranslation: 'color',
        preserve: false,
        caseSensitive: false,
        wholeWord: true,
        enabled: true,
      },
    ]);
    expect(output).toBe('Use Lingo and color.');
  });

  it('rejects stale, missing, duplicate, and markup-injecting responses', () => {
    const request: TranslationRequest = {
      requestId: 'req_core_test_123',
      sessionId: 'session_core_test_123',
      targetLanguage: 'fa',
      mode: 'page',
      segments: [{ id: 'one', text: 'Hello' }],
    };
    expect(() =>
      validateTranslationResponse(request, {
        requestId: request.requestId,
        sessionId: 'session_stale_123',
        providerId: 'mock',
        modelId: 'mock-deterministic',
        translations: [{ id: 'one', translatedText: 'سلام' }],
      }),
    ).toThrow(/active request/u);
    expect(() =>
      validateTranslationResponse(request, {
        requestId: request.requestId,
        sessionId: request.sessionId,
        providerId: 'mock',
        modelId: 'mock-deterministic',
        translations: [],
      }),
    ).toThrow(/missing/u);
    expect(() =>
      validateTranslationResponse(request, {
        requestId: request.requestId,
        sessionId: request.sessionId,
        providerId: 'mock',
        modelId: 'mock-deterministic',
        translations: [{ id: 'one', translatedText: '<img src=x>' }],
      }),
    ).toThrow(/markup/u);
  });

  it('includes all translation-affecting inputs in cache identity', () => {
    const baseline = createCacheKey({ targetLanguage: 'fa', text: 'Hello', provider: 'mock' });
    expect(createCacheKey({ targetLanguage: 'de', text: 'Hello', provider: 'mock' })).not.toBe(
      baseline,
    );
    expect(createCacheKey({ targetLanguage: 'fa', text: 'Hello', provider: 'deepl' })).not.toBe(
      baseline,
    );
  });
});
