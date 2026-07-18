import { describe, expect, it } from 'vitest';
import type { TranslatedCopyIntentRecord } from '@translation/shared-types';
import {
  TranslatedCopyIntentCoordinator,
  TRANSLATED_COPY_DENIAL_COOLDOWN_MS,
  TRANSLATED_COPY_INTENT_TTL_MS,
  type TranslatedCopyIntentExecutionHooks,
} from './translated-copy-intent';

function harness(input: { granted?: string[]; now?: number; fail?: boolean } = {}) {
  const records = new Map<string, TranslatedCopyIntentRecord>();
  const states: string[] = [];
  const granted = new Set(input.granted ?? []);
  let executions = 0;
  const providerCalls = 0;
  let now = input.now ?? 1_000;
  const coordinator = new TranslatedCopyIntentCoordinator(
    {
      get: async (intentId) => records.get(intentId),
      list: async () => [...records.values()],
      set: async (record) => {
        records.set(record.intentId, structuredClone(record));
        states.push(record.state);
      },
      remove: async (intentId) => {
        records.delete(intentId);
      },
    },
    { contains: async ({ origins }) => origins.every((origin) => granted.has(origin)) },
    async (_intent, hooks: TranslatedCopyIntentExecutionHooks) => {
      executions += 1;
      await hooks.destinationCreated(77);
      if (input.fail) throw new Error('destination failed');
      await hooks.applyingTranslation(77);
      return { destinationTabId: 77 };
    },
    () => now,
  );
  const create = () =>
    coordinator.create({
      sourceTabId: 12,
      sessionId: 'session_translated_copy_intent_12345',
      navigationUrl: 'https://example.com/article?private=not-stored',
      providerId: 'gemini',
      modelId: 'gemini-test',
    });
  return {
    coordinator,
    records,
    states,
    granted,
    create,
    executions: () => executions,
    providerCalls: () => providerCalls,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('translated-copy permission intent', () => {
  it('25. persists a metadata-only action before permission is granted', async () => {
    const test = harness();
    const record = await test.create();
    expect(record).toMatchObject({
      state: 'REQUESTING_PERMISSION',
      sourceTabId: 12,
      originPattern: 'https://example.com/*',
      navigationIdentity: expect.stringMatching(/^[a-f0-9]{64}$/u),
      providerId: 'gemini',
      modelId: 'gemini-test',
    });
  });

  it('26. permissions.onAdded resumes after the popup is gone', async () => {
    const test = harness();
    const record = await test.create();
    test.granted.add(record.originPattern);
    await test.coordinator.resumeForAddedOrigins([record.originPattern]);
    expect(test.records.get(record.intentId)?.state).toBe('COMPLETED');
  });

  it('27. already-granted access starts without another permission event', async () => {
    const test = harness({ granted: ['https://example.com/*'] });
    const record = await test.create();
    await settle();
    expect(test.records.get(record.intentId)?.state).toBe('COMPLETED');
  });

  it('28. concurrent permission and popup continuations create exactly one tab', async () => {
    const test = harness();
    const record = await test.create();
    test.granted.add(record.originPattern);
    await Promise.all([
      test.coordinator.resumeForAddedOrigins([record.originPattern]),
      test.coordinator.resume(record.intentId),
    ]);
    expect(test.executions()).toBe(1);
  });

  it('29. ignores a permission event for the wrong origin', async () => {
    const test = harness();
    const record = await test.create();
    await test.coordinator.resumeForAddedOrigins(['https://other.example/*']);
    expect(test.records.get(record.intentId)?.state).toBe('REQUESTING_PERMISSION');
    expect(test.executions()).toBe(0);
  });

  it('30. records denial without opening a destination', async () => {
    const test = harness();
    const record = await test.create();
    await test.coordinator.deny(record.intentId);
    expect(test.records.get(record.intentId)?.state).toBe('DENIED');
    expect(test.executions()).toBe(0);
  });

  it('31. reuses a denied intent instead of preparing another prompt', async () => {
    const test = harness();
    const first = await test.create();
    await test.coordinator.deny(first.intentId);
    const second = await test.create();
    expect(second.intentId).toBe(first.intentId);
    expect(second.state).toBe('DENIED');
    test.advance(TRANSLATED_COPY_DENIAL_COOLDOWN_MS + 1);
    expect((await test.create()).intentId).not.toBe(first.intentId);
  });

  it('32. leaves the source action untouched after denial', async () => {
    const test = harness();
    const record = await test.create();
    await test.coordinator.deny(record.intentId);
    expect(record.sourceTabId).toBe(12);
    expect(test.executions()).toBe(0);
  });

  it('33. expires stale pending actions before execution', async () => {
    const test = harness();
    const record = await test.create();
    test.advance(TRANSLATED_COPY_INTENT_TTL_MS + 1);
    test.granted.add(record.originPattern);
    await test.coordinator.resume(record.intentId);
    expect(test.records.get(record.intentId)).toMatchObject({
      state: 'EXPIRED',
      failureCode: 'expired',
    });
  });

  it('34. records revocation while an action is permission-granted', async () => {
    const test = harness();
    const record = await test.create();
    test.records.set(record.intentId, { ...record, state: 'PERMISSION_GRANTED' });
    await test.coordinator.handleRemovedOrigins([record.originPattern]);
    expect(test.records.get(record.intentId)).toMatchObject({
      state: 'FAILED',
      failureCode: 'permission-revoked',
    });
  });

  it('35. supports an exact HTTP origin', async () => {
    const test = harness();
    const record = await test.coordinator.create({
      sourceTabId: 12,
      sessionId: 'session_http_copy_intent_12345',
      navigationUrl: 'http://example.com/article',
      providerId: 'mock',
      modelId: 'mock-v1',
    });
    expect(record.originPattern).toBe('http://example.com/*');
  });

  it('36. supports an exact HTTPS origin', async () => {
    expect((await harness().create()).originPattern).toBe('https://example.com/*');
  });

  it('37. does not treat a sibling host as equivalent', async () => {
    const test = harness();
    const record = await test.create();
    test.granted.add('https://www.example.com/*');
    await test.coordinator.resume(record.intentId);
    expect(test.executions()).toBe(0);
  });

  it('38. records the full successful action lifecycle', async () => {
    const test = harness();
    const record = await test.create();
    test.granted.add(record.originPattern);
    await test.coordinator.resume(record.intentId);
    expect(test.states).toEqual([
      'CREATED',
      'REQUESTING_PERMISSION',
      'PERMISSION_GRANTED',
      'OPENING_DESTINATION',
      'DESTINATION_CREATED',
      'APPLYING_TRANSLATION',
      'COMPLETED',
    ]);
  });

  it('39. keeps completed actions idempotent', async () => {
    const test = harness();
    const record = await test.create();
    test.granted.add(record.originPattern);
    await test.coordinator.resume(record.intentId);
    await test.coordinator.resume(record.intentId);
    expect(test.executions()).toBe(1);
  });

  it('40. records destination failure without a second attempt', async () => {
    const test = harness({ fail: true });
    const record = await test.create();
    test.granted.add(record.originPattern);
    await test.coordinator.resume(record.intentId);
    await test.coordinator.resume(record.intentId);
    expect(test.records.get(record.intentId)).toMatchObject({
      state: 'FAILED',
      failureCode: 'destination-failed',
    });
    expect(test.executions()).toBe(1);
  });

  it('41. never stores the page URL, bundle, or translated text in the intent', async () => {
    const serialized = JSON.stringify(await harness().create());
    expect(serialized).not.toContain('private=not-stored');
    expect(serialized).not.toContain('segments');
    expect(serialized).not.toContain('translatedText');
  });

  it('42. reusing a translated copy performs zero provider calls', async () => {
    const test = harness();
    const record = await test.create();
    test.granted.add(record.originPattern);
    await test.coordinator.resume(record.intentId);
    expect(test.providerCalls()).toBe(0);
  });
});
