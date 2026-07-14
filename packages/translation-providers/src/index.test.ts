import { describe, expect, it, vi } from 'vitest';
import { createDeepLProvider, createMockProvider } from './index';

const request = {
  requestId: 'req_test_mock123',
  sessionId: 'session_test_mock123',
  targetLanguage: 'fa',
  mode: 'page' as const,
  segments: [{ id: 'segment-1', text: 'Hello https://example.com' }],
};

describe('mock provider', () => {
  it('returns deterministic visibly transformed text and preserves protected tokens', async () => {
    const response = await createMockProvider().translate(request, {});
    expect(response.sessionId).toBe(request.sessionId);
    expect(response.translations).toEqual([
      { id: 'segment-1', translatedText: '[fa] Hello https://example.com' },
    ]);
  });
});

describe('DeepL provider', () => {
  it('keeps the API key server-side and maps responses by segment order', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          translations: [{ detected_source_language: 'EN', text: 'سلام __LINGO_TOKEN_0__' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const response = await createDeepLProvider({ apiKey: 'secret:fx', fetchImpl }).translate(
      request,
      {},
    );
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init?.headers).toMatchObject({ Authorization: 'DeepL-Auth-Key secret:fx' });
    expect(String(init?.body)).not.toContain('https://example.com');
    expect(response.translations[0]?.translatedText).toBe('سلام https://example.com');
  });

  it('maps provider throttling without exposing the provider body', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret', { status: 429 }));
    const action = createDeepLProvider({ apiKey: 'key', fetchImpl }).translate(request, {});
    await expect(action).rejects.toMatchObject({
      code: 'rate-limited',
      retryable: true,
    });
  });
});
