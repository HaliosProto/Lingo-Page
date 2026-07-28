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

export function recoveryRecordByteLength(record: TranslationRecoveryRecord): number {
  return new TextEncoder().encode(JSON.stringify(record)).byteLength;
}

export function evaluateRecoveryRecord(
  record: TranslationRecoveryRecord,
  input: { tabId: number; navigationIdentity: string; now?: number },
): RecoveryDecision {
  const now = input.now ?? Date.now();
  if (record.expiresAt <= now) return { state: 'expired', remove: true };
  if (record.sourceTabId !== input.tabId || record.frameId !== 0) {
    return { state: 'incompatible', remove: false };
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
