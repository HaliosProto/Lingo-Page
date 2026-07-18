import type {
  ProviderId,
  TranslatedCopyIntentRecord,
  TranslatedCopyIntentState,
} from '@translation/shared-types';
import { translatedCopyIntentRecordSchema } from '@translation/shared-validation';
import { translatedCopyOriginPattern } from './translated-copy-access';

export type TranslatedCopyIntentStore = {
  get(intentId: string): Promise<TranslatedCopyIntentRecord | undefined>;
  list(): Promise<TranslatedCopyIntentRecord[]>;
  set(record: TranslatedCopyIntentRecord): Promise<void>;
  remove(intentId: string): Promise<void>;
};

export type TranslatedCopyIntentPermissions = {
  contains(permissions: { origins: string[] }): Promise<boolean>;
};

export type TranslatedCopyIntentExecutionHooks = {
  destinationCreated(tabId: number): Promise<void>;
  applyingTranslation(tabId: number): Promise<void>;
};

export type TranslatedCopyIntentExecutor = (
  intent: TranslatedCopyIntentRecord,
  hooks: TranslatedCopyIntentExecutionHooks,
) => Promise<{ destinationTabId: number }>;

const TERMINAL_STATES = new Set<TranslatedCopyIntentState>([
  'COMPLETED',
  'DENIED',
  'FAILED',
  'EXPIRED',
]);

export const TRANSLATED_COPY_INTENT_TTL_MS = 5 * 60_000;
export const TRANSLATED_COPY_DENIAL_COOLDOWN_MS = 60_000;

export async function translatedCopyNavigationIdentity(navigationUrl: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(navigationUrl));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export class TranslatedCopyIntentCoordinator {
  private readonly active = new Set<string>();

  constructor(
    private readonly store: TranslatedCopyIntentStore,
    private readonly permissions: TranslatedCopyIntentPermissions,
    private readonly execute: TranslatedCopyIntentExecutor,
    private readonly now: () => number = Date.now,
  ) {}

  async create(input: {
    sourceTabId: number;
    sessionId: string;
    navigationUrl: string;
    providerId: ProviderId;
    modelId: string;
  }): Promise<TranslatedCopyIntentRecord> {
    const originPattern = translatedCopyOriginPattern(input.navigationUrl);
    if (!originPattern) throw new Error('Translated copies require an HTTP or HTTPS origin.');
    const records = await this.store.list();
    const hasPermission = await this.hasExactPermission(originPattern);
    const denied = records.find(
      (record) =>
        record.state === 'DENIED' &&
        record.originPattern === originPattern &&
        record.updatedAt + TRANSLATED_COPY_DENIAL_COOLDOWN_MS > this.now(),
    );
    if (denied && !hasPermission) return denied;
    const existing = records.find(
      (record) =>
        !TERMINAL_STATES.has(record.state) &&
        record.sourceTabId === input.sourceTabId &&
        record.sessionId === input.sessionId &&
        record.originPattern === originPattern,
    );
    if (existing) return existing;

    const createdAt = this.now();
    const created = translatedCopyIntentRecordSchema.parse({
      version: 1,
      intentId: `copyIntent_${crypto.randomUUID().replaceAll('-', '')}`,
      state: 'CREATED',
      sourceTabId: input.sourceTabId,
      sessionId: input.sessionId,
      originPattern,
      navigationIdentity: await translatedCopyNavigationIdentity(input.navigationUrl),
      providerId: input.providerId,
      modelId: input.modelId,
      createdAt,
      updatedAt: createdAt,
      expiresAt: createdAt + TRANSLATED_COPY_INTENT_TTL_MS,
    });
    await this.store.set(created);
    const record = await this.transition(created, 'REQUESTING_PERMISSION');
    if (hasPermission) void this.resume(record.intentId);
    return record;
  }

  async deny(intentId: string): Promise<TranslatedCopyIntentRecord | undefined> {
    if (this.active.has(intentId)) return await this.store.get(intentId);
    const record = await this.store.get(intentId);
    if (!record || TERMINAL_STATES.has(record.state)) return record;
    return await this.transition(record, 'DENIED');
  }

  async resume(intentId: string): Promise<TranslatedCopyIntentRecord | undefined> {
    if (this.active.has(intentId)) return await this.store.get(intentId);
    this.active.add(intentId);
    try {
      const record = await this.store.get(intentId);
      if (!record || TERMINAL_STATES.has(record.state)) return record;
      if (
        record.state === 'OPENING_DESTINATION' ||
        record.state === 'DESTINATION_CREATED' ||
        record.state === 'APPLYING_TRANSLATION'
      ) {
        return record;
      }
      if (record.expiresAt <= this.now()) {
        return await this.transition(record, 'EXPIRED', { failureCode: 'expired' });
      }
      if (!(await this.hasExactPermission(record.originPattern))) {
        return record.state === 'REQUESTING_PERMISSION'
          ? record
          : await this.transition(record, 'REQUESTING_PERMISSION');
      }

      let activeRecord = await this.transition(record, 'PERMISSION_GRANTED');
      activeRecord = await this.transition(activeRecord, 'OPENING_DESTINATION');
      try {
        const completed = await this.execute(activeRecord, {
          destinationCreated: async (tabId) => {
            activeRecord = await this.transition(activeRecord, 'DESTINATION_CREATED', {
              destinationTabId: tabId,
            });
          },
          applyingTranslation: async (tabId) => {
            activeRecord = await this.transition(activeRecord, 'APPLYING_TRANSLATION', {
              destinationTabId: tabId,
            });
          },
        });
        return await this.transition(activeRecord, 'COMPLETED', {
          destinationTabId: completed.destinationTabId,
        });
      } catch {
        return await this.transition(activeRecord, 'FAILED', {
          failureCode: 'destination-failed',
        });
      }
    } finally {
      this.active.delete(intentId);
    }
  }

  async resumeForAddedOrigins(origins: string[]): Promise<void> {
    const added = new Set(origins);
    const records = await this.store.list();
    await Promise.all(
      records
        .filter(
          (record) =>
            (record.state === 'CREATED' || record.state === 'REQUESTING_PERMISSION') &&
            added.has(record.originPattern),
        )
        .map((record) => this.resume(record.intentId)),
    );
  }

  async handleRemovedOrigins(origins: string[]): Promise<void> {
    const removed = new Set(origins);
    const records = await this.store.list();
    await Promise.all(
      records
        .filter(
          (record) => record.state === 'PERMISSION_GRANTED' && removed.has(record.originPattern),
        )
        .map((record) => this.transition(record, 'FAILED', { failureCode: 'permission-revoked' })),
    );
  }

  async deniedOrigins(): Promise<string[]> {
    const records = await this.store.list();
    const denied = [
      ...new Set(
        records
          .filter(
            (record) =>
              record.state === 'DENIED' &&
              record.updatedAt + TRANSLATED_COPY_DENIAL_COOLDOWN_MS > this.now(),
          )
          .map((record) => record.originPattern),
      ),
    ];
    const stillDenied = await Promise.all(
      denied.map(async (origin) => ({ origin, granted: await this.hasExactPermission(origin) })),
    );
    return stillDenied
      .filter((entry) => !entry.granted)
      .map((entry) => entry.origin)
      .slice(0, 200);
  }

  async cleanupAbandoned(): Promise<void> {
    const records = await this.store.list();
    for (const record of records) {
      if (!TERMINAL_STATES.has(record.state) && record.expiresAt <= this.now()) {
        await this.transition(record, 'EXPIRED', { failureCode: 'expired' });
        continue;
      }
      if (
        TERMINAL_STATES.has(record.state) &&
        record.updatedAt + TRANSLATED_COPY_INTENT_TTL_MS <= this.now()
      ) {
        await this.store.remove(record.intentId);
      }
    }
  }

  private async hasExactPermission(originPattern: string): Promise<boolean> {
    return await this.permissions.contains({ origins: [originPattern] });
  }

  private async transition(
    record: TranslatedCopyIntentRecord,
    state: TranslatedCopyIntentState,
    extra: Pick<TranslatedCopyIntentRecord, 'destinationTabId' | 'failureCode'> = {},
  ): Promise<TranslatedCopyIntentRecord> {
    const next = translatedCopyIntentRecordSchema.parse({
      ...record,
      ...extra,
      state,
      updatedAt: this.now(),
    });
    await this.store.set(next);
    return next;
  }
}
