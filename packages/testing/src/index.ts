export function createTestRequestId(suffix = 'fixture'): string {
  return `req_test_${suffix}`;
}

export function createJsonRequest(path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export type DeterministicProviderMode =
  | 'complete'
  | 'valid-partial'
  | 'truncated-json'
  | 'missing-id'
  | 'duplicate-id'
  | 'unknown-id'
  | 'empty-translation'
  | 'changed-order'
  | 'single-stubborn-segment'
  | 'fail-above-batch-size'
  | 'first-n-records'
  | 'alternating-ids'
  | 'malformed-final-json';

export function createDeterministicProviderOutput(input: {
  mode: DeterministicProviderMode;
  requestId: string;
  sessionId: string;
  segments: Array<{ id: string; text: string }>;
  stubbornSegmentId?: string;
  maxSuccessfulBatchSize?: number;
  returnedRecordCount?: number;
}): string {
  const translated = input.segments.map((segment) => ({
    id: segment.id,
    translatedText: `[test] ${segment.text}`,
  }));
  let translations = translated;
  switch (input.mode) {
    case 'complete':
      break;
    case 'valid-partial':
      translations = translated.slice(0, Math.max(1, Math.ceil(translated.length / 2)));
      break;
    case 'truncated-json': {
      const complete = createDeterministicProviderOutput({ ...input, mode: 'complete' });
      return complete.slice(0, Math.max(1, complete.length - 12));
    }
    case 'missing-id':
      translations = translated.slice(0, -1);
      break;
    case 'duplicate-id':
      translations = translated[0] ? [translated[0], translated[0], ...translated.slice(1)] : [];
      break;
    case 'unknown-id':
      translations = [...translated, { id: 'segment-unknown', translatedText: '[test] unknown' }];
      break;
    case 'empty-translation':
      translations = translated.map((translation, index) =>
        index === translated.length - 1 ? { ...translation, translatedText: '' } : translation,
      );
      break;
    case 'changed-order':
      translations = [...translated].reverse();
      break;
    case 'single-stubborn-segment':
      translations = translated.filter((translation) => translation.id !== input.stubbornSegmentId);
      break;
    case 'fail-above-batch-size':
      if (translated.length > (input.maxSuccessfulBatchSize ?? 25)) return '{"incomplete":';
      break;
    case 'first-n-records':
      translations = translated.slice(0, Math.max(0, input.returnedRecordCount ?? 1));
      break;
    case 'alternating-ids':
      translations = translated.filter((_translation, index) => index % 2 === 0);
      break;
    case 'malformed-final-json': {
      const complete = createDeterministicProviderOutput({ ...input, mode: 'complete' });
      return `${complete.slice(0, -2)},`;
    }
  }
  return JSON.stringify({
    requestId: input.requestId,
    sessionId: input.sessionId,
    translations,
  });
}
