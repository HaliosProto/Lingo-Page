import type {
  TranslationRecoveryRecord,
  TranslationRecoveryState,
  TranslationSegment,
} from '@translation/shared-types';

export const RECOVERY_RECORD_TTL_MS = 30 * 60_000;
export const MAX_RECOVERY_RECORD_BYTES = 2_000_000;
export const MAX_RECOVERY_RECORDS = 12;
export const MAX_MUTATION_BACKLOG = 256;
export const MAX_MUTATION_ROOTS_PER_SLICE = 48;
export const MUTATION_SLICE_BUDGET_MS = 8;
export const RECOVERY_CLAIM_TTL_MS = 15_000;
export const RECOVERY_STARTUP_CLAIM_WINDOW_MS = 30_000;
export const RECENTLY_CLOSED_RESTORE_SIGNAL_MS = 10_000;

export type RecoveryDecision =
  | { state: 'recover'; record: TranslationRecoveryRecord }
  | { state: 'paused'; record: TranslationRecoveryRecord }
  | {
      state: Exclude<TranslationRecoveryState, 'recovering' | 'recovered' | 'offline'>;
      remove: boolean;
    };

export async function recoveryNavigationIdentity(navigationUrl: string): Promise<string> {
  const parsed = new URL(navigationUrl);
  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parsed.href));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256Identity(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizedRecoveryOrigin(navigationUrl: string): string | undefined {
  try {
    const parsed = new URL(navigationUrl);
    return /^https?:$/u.test(parsed.protocol) ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

export async function recoveryOriginIdentity(navigationUrl: string): Promise<string> {
  const origin = normalizedRecoveryOrigin(navigationUrl);
  if (!origin) throw new Error('Only HTTP and HTTPS origins can use browser-restart recovery.');
  return await sha256Identity(origin);
}

export function recoveryPermissionRemovalMatches(
  removedPatterns: readonly string[],
  normalizedOrigin: string,
): boolean {
  const origin = normalizedRecoveryOrigin(normalizedOrigin);
  if (!origin) return true;
  const protocol = new URL(origin).protocol;
  return removedPatterns.some(
    (pattern) => pattern === `${origin}/*` || pattern === `${protocol}//*/*`,
  );
}

export async function recoveryTranslationIdentity(input: {
  sessionId: string;
  operationId: string;
  sourceLanguage: string;
  targetLanguage: string;
  providerId: string;
  modelId: string;
}): Promise<string> {
  return await sha256Identity(
    [
      input.sessionId,
      input.operationId,
      input.sourceLanguage,
      input.targetLanguage,
      input.providerId,
      input.modelId,
    ].join('\u001f'),
  );
}

export function recoveryRecordByteLength(record: TranslationRecoveryRecord): number {
  return new TextEncoder().encode(JSON.stringify(record)).byteLength;
}

export function evaluateRecoveryRecord(
  record: TranslationRecoveryRecord,
  input: {
    tabId: number;
    navigationIdentity: string;
    originIdentity?: string;
    browserInstanceId?: string;
    now?: number;
  },
): RecoveryDecision {
  const now = input.now ?? Date.now();
  if (record.expiresAt <= now) return { state: 'expired', remove: true };
  if (
    record.sourceTabId !== input.tabId ||
    record.claim.state !== 'owned' ||
    record.claim.ownerTabId !== input.tabId ||
    record.frameId !== 0
  ) {
    return { state: 'incompatible', remove: false };
  }
  if (
    input.browserInstanceId !== undefined &&
    record.claim.browserInstanceId !== input.browserInstanceId
  ) {
    return { state: 'incompatible', remove: false };
  }
  if (input.originIdentity !== undefined && record.originIdentity !== input.originIdentity) {
    return { state: 'stale', remove: true };
  }
  if (record.navigationIdentity !== input.navigationIdentity) {
    return { state: 'stale', remove: true };
  }
  if (record.lifecycle === 'ended' || record.lifecycle === 'invalidated') {
    return { state: 'incompatible', remove: true };
  }
  if (record.cancelled) return { state: 'paused', record };
  return { state: 'recover', record };
}

export type RecoveryRestoreSignal = 'browser-startup' | 'recently-closed';

export type RestoredRecoveryDecision =
  | { state: 'eligible'; record: TranslationRecoveryRecord }
  | {
      state:
        | 'expired'
        | 'terminal'
        | 'cancelled'
        | 'owned'
        | 'claiming'
        | 'wrong-frame'
        | 'wrong-origin'
        | 'wrong-navigation'
        | 'restart-disabled'
        | 'missing-restore-signal';
      remove: boolean;
    };

export function evaluateRestoredRecoveryRecord(
  record: TranslationRecoveryRecord,
  input: {
    navigationIdentity: string;
    originIdentity: string;
    restoreSignal?: RecoveryRestoreSignal;
    now?: number;
  },
): RestoredRecoveryDecision {
  const now = input.now ?? Date.now();
  if (record.expiresAt <= now) return { state: 'expired', remove: true };
  if (record.lifecycle === 'ended' || record.lifecycle === 'invalidated') {
    return { state: 'terminal', remove: true };
  }
  if (record.cancelled) return { state: 'cancelled', remove: true };
  if (!record.restartRecoveryEnabled) return { state: 'restart-disabled', remove: false };
  if (!input.restoreSignal) return { state: 'missing-restore-signal', remove: false };
  if (record.frameId !== 0) return { state: 'wrong-frame', remove: true };
  if (record.originIdentity !== input.originIdentity) {
    return { state: 'wrong-origin', remove: false };
  }
  if (record.navigationIdentity !== input.navigationIdentity) {
    return { state: 'wrong-navigation', remove: false };
  }
  if (record.claim.state === 'owned') return { state: 'owned', remove: false };
  if (record.claim.state === 'claiming' && (record.claim.claimExpiresAt ?? 0) > now) {
    return { state: 'claiming', remove: false };
  }
  return { state: 'eligible', record };
}

type ClaimStorage = {
  read(sessionId: string): Promise<TranslationRecoveryRecord | undefined>;
  write(record: TranslationRecoveryRecord): Promise<void>;
  remove(sessionId: string): Promise<void>;
};

export type RecoveryClaimResult =
  | { state: 'claimed'; record: TranslationRecoveryRecord; claimId: string }
  | {
      state: 'already-claimed' | 'ineligible' | 'lost-race' | 'missing' | 'removed';
    };

export class RecoveryClaimCoordinator {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly storage: ClaimStorage) {}

  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  async claim(input: {
    sessionId: string;
    tabId: number;
    browserInstanceId: string;
    navigationIdentity: string;
    originIdentity: string;
    restoreSignal: RecoveryRestoreSignal;
    claimId: string;
    now?: number;
  }): Promise<RecoveryClaimResult> {
    return await this.exclusive(async () => {
      const now = input.now ?? Date.now();
      const current = await this.storage.read(input.sessionId);
      if (!current) return { state: 'missing' };
      if (
        current.translationIdentity !==
        (await recoveryTranslationIdentity({
          sessionId: current.sessionId,
          operationId: current.operationId,
          sourceLanguage: current.sourceLanguage,
          targetLanguage: current.targetLanguage,
          providerId: current.providerId,
          modelId: current.modelId,
        }))
      ) {
        return { state: 'ineligible' };
      }
      if (
        current.claim.state === 'claiming' &&
        current.claim.ownerTabId === input.tabId &&
        current.claim.browserInstanceId === input.browserInstanceId &&
        current.claim.claimId
      ) {
        return { state: 'claimed', record: current, claimId: current.claim.claimId };
      }
      if (current.claim.state === 'owned' && current.claim.ownerTabId === input.tabId) {
        return { state: 'already-claimed' };
      }
      const decision = evaluateRestoredRecoveryRecord(current, {
        navigationIdentity: input.navigationIdentity,
        originIdentity: input.originIdentity,
        restoreSignal: input.restoreSignal,
        now,
      });
      if (decision.state !== 'eligible') {
        if (decision.remove) {
          await this.storage.remove(input.sessionId);
          return { state: 'removed' };
        }
        return { state: 'ineligible' };
      }
      const claiming = {
        ...decision.record,
        sourceTabId: input.tabId,
        navigationGeneration: decision.record.navigationGeneration + 1,
        updatedAt: now,
        claim: {
          state: 'claiming' as const,
          ownerTabId: input.tabId,
          browserInstanceId: input.browserInstanceId,
          claimId: input.claimId,
          claimStartedAt: now,
          claimExpiresAt: now + RECOVERY_CLAIM_TTL_MS,
          ...(decision.record.claim.reason ? { reason: decision.record.claim.reason } : {}),
          ...(decision.record.claim.detachedAt !== undefined
            ? { detachedAt: decision.record.claim.detachedAt }
            : {}),
        },
      };
      await this.storage.write(claiming);
      const stored = await this.storage.read(input.sessionId);
      if (
        !stored ||
        stored.claim.state !== 'claiming' ||
        stored.claim.claimId !== input.claimId ||
        stored.claim.ownerTabId !== input.tabId
      ) {
        return { state: 'lost-race' };
      }
      return { state: 'claimed', record: stored, claimId: input.claimId };
    });
  }

  async complete(input: {
    sessionId: string;
    tabId: number;
    browserInstanceId: string;
    claimId: string;
    now?: number;
  }): Promise<RecoveryClaimResult> {
    return await this.exclusive(async () => {
      const current = await this.storage.read(input.sessionId);
      if (!current) return { state: 'missing' };
      if (
        current.claim.state === 'owned' &&
        current.claim.ownerTabId === input.tabId &&
        current.claim.browserInstanceId === input.browserInstanceId
      ) {
        return { state: 'already-claimed' };
      }
      if (
        current.claim.state !== 'claiming' ||
        current.claim.claimId !== input.claimId ||
        current.claim.ownerTabId !== input.tabId
      ) {
        return { state: 'lost-race' };
      }
      const owned: TranslationRecoveryRecord = {
        ...current,
        sourceTabId: input.tabId,
        updatedAt: input.now ?? Date.now(),
        claim: {
          state: 'owned',
          ownerTabId: input.tabId,
          browserInstanceId: input.browserInstanceId,
        },
      };
      await this.storage.write(owned);
      return { state: 'claimed', record: owned, claimId: input.claimId };
    });
  }

  async release(input: {
    sessionId: string;
    tabId: number;
    browserInstanceId: string;
    reason: 'window-closing' | 'tab-closed' | 'browser-restart' | 'tab-replaced';
    now?: number;
  }): Promise<void> {
    await this.exclusive(async () => {
      const current = await this.storage.read(input.sessionId);
      if (!current || current.sourceTabId !== input.tabId) return;
      const now = input.now ?? Date.now();
      await this.storage.write({
        ...current,
        updatedAt: now,
        claim: {
          state: 'orphaned',
          browserInstanceId: input.browserInstanceId,
          reason: input.reason,
          detachedAt: now,
        },
      });
    });
  }
}

export function pruneRecoveryRecords(
  records: TranslationRecoveryRecord[],
  now = Date.now(),
): { retained: TranslationRecoveryRecord[]; removedSessionIds: string[] } {
  const valid = records
    .filter(
      (record) =>
        record.expiresAt > now &&
        record.lifecycle !== 'ended' &&
        record.lifecycle !== 'invalidated' &&
        recoveryRecordByteLength(record) <= MAX_RECOVERY_RECORD_BYTES,
    )
    .sort((left, right) => right.updatedAt - left.updatedAt);
  const retained = valid.slice(0, MAX_RECOVERY_RECORDS);
  const retainedIds = new Set(retained.map((record) => record.sessionId));
  return {
    retained,
    removedSessionIds: records
      .filter((record) => !retainedIds.has(record.sessionId))
      .map((record) => record.sessionId),
  };
}

type Attempt = {
  operationId: string;
  batchId: string;
  attemptId: string;
  generation: number;
  segmentIds: Set<string>;
  cancelled: boolean;
};

export class RequestIdempotencyLedger {
  private readonly active = new Map<string, Attempt>();
  private readonly completedSegmentIds = new Set<string>();

  begin(attempt: Omit<Attempt, 'segmentIds' | 'cancelled'> & { segmentIds: string[] }): boolean {
    const key = `${attempt.operationId}:${attempt.batchId}`;
    const existing = this.active.get(key);
    if (existing && !existing.cancelled) return false;
    this.active.set(key, {
      ...attempt,
      segmentIds: new Set(attempt.segmentIds),
      cancelled: false,
    });
    return true;
  }

  cancelOperation(operationId: string): void {
    for (const attempt of this.active.values()) {
      if (attempt.operationId === operationId) attempt.cancelled = true;
    }
  }

  acceptResponse(input: {
    operationId: string;
    batchId: string;
    attemptId: string;
    generation: number;
    translations: Array<{ id: string }>;
  }): string[] {
    const attempt = this.active.get(`${input.operationId}:${input.batchId}`);
    if (
      !attempt ||
      attempt.cancelled ||
      attempt.attemptId !== input.attemptId ||
      attempt.generation !== input.generation
    ) {
      return [];
    }
    const accepted = input.translations
      .map((translation) => translation.id)
      .filter((id) => attempt.segmentIds.has(id) && !this.completedSegmentIds.has(id));
    for (const id of accepted) this.completedSegmentIds.add(id);
    return accepted;
  }

  completed(): string[] {
    return [...this.completedSegmentIds];
  }
}

type QueuedRoot<T> = { root: T; generation: number };

export class MutationBackpressureQueue<T extends object> {
  private readonly queued = new Map<T, QueuedRoot<T>>();
  private dropped = 0;

  constructor(
    private generation: number,
    private readonly maximum = MAX_MUTATION_BACKLOG,
  ) {}

  enqueue(root: T, generation = this.generation): boolean {
    if (generation !== this.generation) {
      this.dropped += 1;
      return false;
    }
    if (this.queued.has(root)) return false;
    if (this.queued.size >= this.maximum) {
      this.dropped += 1;
      return false;
    }
    this.queued.set(root, { root, generation });
    return true;
  }

  advanceGeneration(generation: number): void {
    this.generation = generation;
    this.dropped += this.queued.size;
    this.queued.clear();
  }

  clear(): void {
    this.queued.clear();
  }

  drain(input?: { maximum?: number; budgetMs?: number; now?: () => number }): T[] {
    const maximum = input?.maximum ?? MAX_MUTATION_ROOTS_PER_SLICE;
    const budgetMs = input?.budgetMs ?? MUTATION_SLICE_BUDGET_MS;
    const now = input?.now ?? performance.now.bind(performance);
    const startedAt = now();
    const roots: T[] = [];
    for (const [root, queued] of this.queued) {
      if (roots.length >= maximum || (roots.length > 0 && now() - startedAt >= budgetMs)) {
        break;
      }
      this.queued.delete(root);
      if (queued.generation === this.generation) roots.push(root);
      else this.dropped += 1;
    }
    return roots;
  }

  stats(): { queued: number; dropped: number; generation: number } {
    return { queued: this.queued.size, dropped: this.dropped, generation: this.generation };
  }
}

export function unresolvedSegments(
  segments: TranslationSegment[],
  completedSegmentIds: Iterable<string>,
): TranslationSegment[] {
  const completed = new Set(completedSegmentIds);
  return segments.filter((segment) => !completed.has(segment.id));
}

export function retryDeadline(
  now: number,
  retryAfterSeconds: number | undefined,
  maximumSeconds = 300,
): number {
  const seconds = Math.min(maximumSeconds, Math.max(0, retryAfterSeconds ?? 5));
  return now + seconds * 1_000;
}

export function remainingRetryDelayMs(deadline: number, now = Date.now()): number {
  return Math.max(0, deadline - now);
}

export type NetworkRecoveryCategory =
  | 'offline'
  | 'backend-unavailable'
  | 'rate-limited'
  | 'provider-unavailable'
  | 'timeout'
  | 'invalid-response'
  | 'non-retryable';

export function classifyNetworkRecovery(input: {
  online: boolean;
  status?: number;
  timeout?: boolean;
  invalidResponse?: boolean;
}): NetworkRecoveryCategory {
  if (!input.online) return 'offline';
  if (input.timeout) return 'timeout';
  if (input.invalidResponse) return 'invalid-response';
  if (input.status === 429) return 'rate-limited';
  if (input.status && [500, 502, 503, 504].includes(input.status)) {
    return 'provider-unavailable';
  }
  if (input.status === undefined || input.status === 0) return 'backend-unavailable';
  return 'non-retryable';
}
