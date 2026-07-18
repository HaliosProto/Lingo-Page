import { describe, expect, it } from 'vitest';
import { createDeterministicProviderOutput, type DeterministicProviderMode } from './index';

const base = {
  requestId: 'req_fake_provider_output_12345',
  sessionId: 'session_fake_provider_output_12345',
  segments: [
    { id: 'segment-1', text: 'One' },
    { id: 'segment-2', text: 'Two' },
    { id: 'segment-3', text: 'Three' },
  ],
};

describe('deterministic recovery provider outputs', () => {
  it.each<DeterministicProviderMode>([
    'complete',
    'valid-partial',
    'truncated-json',
    'missing-id',
    'duplicate-id',
    'unknown-id',
    'empty-translation',
    'changed-order',
    'single-stubborn-segment',
    'fail-above-batch-size',
    'first-n-records',
    'alternating-ids',
    'malformed-final-json',
  ])('produces the %s mode deterministically', (mode) => {
    const input = { ...base, mode, stubbornSegmentId: 'segment-2' };
    expect(createDeterministicProviderOutput(input)).toBe(createDeterministicProviderOutput(input));
  });

  it('keeps one configured segment unresolved in stubborn mode', () => {
    const output = JSON.parse(
      createDeterministicProviderOutput({
        ...base,
        mode: 'single-stubborn-segment',
        stubbornSegmentId: 'segment-2',
      }),
    ) as { translations: Array<{ id: string }> };
    expect(output.translations.map((translation) => translation.id)).toEqual([
      'segment-1',
      'segment-3',
    ]);
  });
});
