import { describe, expect, it } from 'vitest';
import { createMockProvider } from './index';

describe('mock provider shell', () => {
  it('returns deterministic visibly transformed text', async () => {
    const provider = createMockProvider();
    const response = await provider.translate(
      {
        requestId: 'req_test_mock123',
        targetLanguage: 'fa',
        mode: 'page',
        segments: [{ id: 'segment-1', text: 'Hello' }],
      },
      {},
    );

    expect(response.translations).toEqual([{ id: 'segment-1', translatedText: '[mock] Hello' }]);
  });
});
