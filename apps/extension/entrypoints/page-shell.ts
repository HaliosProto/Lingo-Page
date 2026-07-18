import { browser } from 'wxt/browser';
import {
  batchSegments,
  createSegmentId,
  createTextFingerprint,
  isLikelyTranslatableText,
  normalizeText,
} from '@translation/translation-core';
import type {
  GlossaryEntry,
  ProviderId,
  TranslationChangeScanResult,
  TranslationFailure,
  TranslationChangeSummary,
  TranslationComparisonAttributes,
  TranslationComparisonElementTag,
  TranslationComparisonSnapshot,
  TranslationDisplayMode,
  TranslationProgress,
  TranslationSegment,
  TranslationSessionBundle,
  TranslationSessionLifecycle,
  TranslationSegmentStatus,
  TranslatedCopyApplicationStatus,
  TranslatedCopyApplicationSummary,
} from '@translation/shared-types';
import { CONTRACT_VERSION, TRANSLATION_SESSION_VERSION } from '@translation/shared-types';
import {
  contentRequestSchema,
  extensionResponseSchema,
  type ContentRequest,
  type ExtensionResponse,
} from '@translation/shared-validation';

type NodeRecord = {
  node: Text;
  element: Element;
  originalText: string;
  leadingWhitespace: string;
  trailingWhitespace: string;
  segment: TranslationSegment;
  sourceFingerprint: string;
  structuralFingerprint: string;
  status: TranslationSegmentStatus;
  translatedText?: string;
};

type Session = {
  id: string;
  providerId: ProviderId;
  modelId: string;
  sourceLanguage: string;
  targetLanguage: string;
  glossaryVersion: number;
  glossary: GlossaryEntry[];
  autoTranslateDynamicContent: boolean;
  navigationId: string;
  cancelled: boolean;
  cancellationEpoch: number;
  retryTimer?: ReturnType<typeof setTimeout>;
  rejectRetryWait?: () => void;
  createdAt: number;
  lastActivityAt: number;
  displayMode: TranslationDisplayMode;
  lifecycle: TranslationSessionLifecycle;
  changed: TranslationChangeSummary;
  changeScan?: TranslationChangeScanResult;
};

class TranslationFailureError extends Error {
  readonly failure: TranslationFailure;

  constructor(failure: TranslationFailure) {
    super(failure.reason);
    this.name = 'TranslationFailureError';
    this.failure = failure;
  }
}

type PageShellScope = typeof globalThis & { __LINGO_PAGE_SHELL__?: boolean };

const excludedSelector = [
  'script',
  'style',
  'noscript',
  'svg',
  'canvas',
  'code',
  'pre',
  'textarea',
  'input',
  'select',
  'option',
  '[contenteditable]:not([contenteditable="false"])',
  '[translate="no"]',
  '.notranslate',
  '[aria-hidden="true"]',
  '#lingo-page-selection-result',
].join(',');

const MAX_SESSION_SEGMENTS = 2_500;
const MAX_SESSION_BUNDLE_BYTES = 2_000_000;
const MAX_COMPARISON_SNAPSHOT_NODES = 15_000;
const MAX_COMPARISON_SNAPSHOT_DEPTH = 40;
const COPY_INITIAL_STABILITY_MS = 150;
const COPY_INITIAL_STABILITY_TIMEOUT_MS = 1_200;
const COPY_RECONCILIATION_WINDOW_MS = 1_600;
const comparisonElementTags = new Set<TranslationComparisonElementTag>([
  'main',
  'article',
  'section',
  'header',
  'footer',
  'nav',
  'aside',
  'div',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'figure',
  'figcaption',
  'blockquote',
  'hr',
  'br',
  'img',
  'a',
  'span',
  'strong',
  'em',
  'b',
  'i',
  'small',
  'sub',
  'sup',
  'time',
  'code',
  'kbd',
  'samp',
  'mark',
  'button',
]);
const comparisonExcludedSelector = [
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'textarea',
  'select',
  'option',
  'svg',
  'canvas',
  '[contenteditable]:not([contenteditable="false"])',
  '[aria-hidden="true"]',
  '#lingo-page-selection-result',
  '#lingo-page-copy-status',
].join(',');

function emptyChangeSummary(): TranslationChangeSummary {
  return {
    newSegments: 0,
    modifiedSegments: 0,
    removedSegments: 0,
    reorderedSegments: 0,
    uncertainSegments: 0,
  };
}

export default defineUnlistedScript(() => {
  const scope = globalThis as PageShellScope;
  if (scope.__LINGO_PAGE_SHELL__) return;
  Object.defineProperty(scope, '__LINGO_PAGE_SHELL__', { value: true });

  const recordsByNode = new Map<Text, NodeRecord>();
  const recordsById = new Map<string, NodeRecord>();
  const selfMutatedNodes = new WeakMap<Text, string>();
  let currentSession: Session | undefined;
  let observer: MutationObserver | undefined;
  let observerTimer: ReturnType<typeof setTimeout> | undefined;
  let nextOrdinal = 0;
  let progress: TranslationProgress = idleProgress();
  let translatedCopyBundle: TranslationSessionBundle | undefined;
  let translatedCopyToken: string | undefined;

  function idleProgress(): TranslationProgress {
    return {
      status: 'idle',
      discoveredSegments: 0,
      translatedSegments: 0,
      failedSegments: 0,
      queuedSegments: 0,
      waitingSegments: 0,
      retryingSegments: 0,
    };
  }

  function sessionProgress(): TranslationProgress {
    const session = currentSession;
    if (!session) return progress;
    return {
      ...progress,
      sessionId: session.id,
      displayMode: session.displayMode,
      lifecycle: session.lifecycle,
      changed: session.changed,
      ...(session.changeScan ? { changeScan: session.changeScan } : {}),
      pageDiverged: Object.values(session.changed).some((count) => count > 0),
    };
  }

  function progressResponse(requestId: string): ExtensionResponse {
    return extensionResponseSchema.parse({
      version: CONTRACT_VERSION,
      requestId,
      type: 'TRANSLATION_PROGRESS',
      payload: { progress: sessionProgress() },
    });
  }

  function errorResponse(requestId: string, message: string): ExtensionResponse {
    return extensionResponseSchema.parse({
      version: CONTRACT_VERSION,
      requestId,
      type: 'MESSAGE_ERROR',
      payload: { code: 'INVALID_MESSAGE', message, retryable: false },
    });
  }

  function isVisible(element: Element): boolean {
    let current: Element | null = element;
    while (current) {
      if (current.hasAttribute('hidden') || current.hasAttribute('inert')) return false;
      if (current.getAttribute('aria-hidden') === 'true') return false;
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      current = current.parentElement;
    }
    return true;
  }

  function structuralFingerprint(element: Element): string {
    const parts: string[] = [];
    const siblingContext = `prev:${element.previousElementSibling?.tagName.toLowerCase() ?? 'none'}|next:${element.nextElementSibling?.tagName.toLowerCase() ?? 'none'}`;
    let current: Element | null = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
      const role = current.getAttribute('role');
      parts.unshift(`${current.tagName.toLowerCase()}${role ? `:${role}` : ''}`);
      current = current.parentElement;
    }
    return createTextFingerprint(`${parts.join('>')}|${siblingContext}`);
  }

  function createRecord(node: Text): NodeRecord | undefined {
    if (recordsByNode.has(node)) return undefined;
    if (recordsByNode.size >= MAX_SESSION_SEGMENTS) return undefined;
    const parent = node.parentElement;
    if (
      !parent ||
      parent.closest(excludedSelector) ||
      parent.isContentEditable ||
      !isVisible(parent)
    )
      return undefined;
    const originalText = node.nodeValue ?? '';
    if (!isLikelyTranslatableText(originalText)) return undefined;
    const { normalized, leadingWhitespace, trailingWhitespace } = normalizeText(originalText);
    if (!normalized) return undefined;
    const elementRole = parent.getAttribute('role') ?? parent.tagName.toLowerCase();
    const sourceFingerprint = createTextFingerprint(normalized);
    const locationFingerprint = structuralFingerprint(parent);
    const segment: TranslationSegment = {
      id: createSegmentId(normalized, nextOrdinal, elementRole),
      text: normalized,
      elementRole,
      context: locationFingerprint,
    };
    nextOrdinal += 1;
    const record: NodeRecord = {
      node,
      element: parent,
      originalText,
      leadingWhitespace,
      trailingWhitespace,
      segment,
      sourceFingerprint,
      structuralFingerprint: locationFingerprint,
      status: 'pending',
    };
    recordsByNode.set(node, record);
    recordsById.set(segment.id, record);
    return record;
  }

  function discover(root: Node = document.body): NodeRecord[] {
    const discovered: NodeRecord[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const record = createRecord(node as Text);
      if (record) discovered.push(record);
      node = walker.nextNode();
    }
    return discovered;
  }

  function collectContentNotices(): TranslationFailure[] {
    const unsupportedCount = document.querySelectorAll(
      'iframe, canvas, img[alt]:not([alt=""])',
    ).length;
    const excludedCount = document.querySelectorAll(
      [
        'input[type="password"]',
        'input[autocomplete^="cc-"]',
        'textarea',
        '[contenteditable="true"]',
        '[translate="no"]',
        '.notranslate',
        'code',
        'pre',
        '[aria-hidden="true"]',
      ].join(','),
    ).length;
    return [
      ...(unsupportedCount > 0
        ? [
            {
              reason: 'UNSUPPORTED_CONTENT' as const,
              metadata: { unsupportedCount, automaticRetry: false },
            },
          ]
        : []),
      ...(excludedCount > 0
        ? [
            {
              reason: 'PRIVACY_EXCLUSION' as const,
              metadata: { excludedCount, automaticRetry: false },
            },
          ]
        : []),
    ];
  }

  function stopObserver(): void {
    observer?.disconnect();
    observer = undefined;
    if (observerTimer !== undefined) clearTimeout(observerTimer);
    observerTimer = undefined;
  }

  function cancelSession(session: Session): void {
    session.cancelled = true;
    session.cancellationEpoch += 1;
    if (session.retryTimer !== undefined) clearTimeout(session.retryTimer);
    session.retryTimer = undefined;
    session.rejectRetryWait?.();
    session.rejectRetryWait = undefined;
  }

  function writeRecord(record: NodeRecord, text: string): void {
    if (!record.node.isConnected || record.node.nodeValue === text) return;
    selfMutatedNodes.set(record.node, text);
    record.node.nodeValue = text;
  }

  function setDisplayMode(displayMode: 'original' | 'translated'): void {
    const session = currentSession;
    if (!session) return;
    if (displayMode === 'original') {
      for (const record of recordsByNode.values()) {
        if (record.status === 'removed') continue;
        writeRecord(record, record.originalText);
      }
      session.displayMode = 'original';
    } else {
      let untranslated = 0;
      for (const record of recordsByNode.values()) {
        if (record.status === 'removed') continue;
        if (record.translatedText && record.status === 'translated') {
          writeRecord(record, record.translatedText);
        } else {
          untranslated += 1;
          writeRecord(record, record.originalText);
        }
      }
      session.displayMode = untranslated > 0 ? 'mixed-partial' : 'translated';
    }
    session.lastActivityAt = Date.now();
  }

  function endSession(restoreOriginal = true): void {
    const session = currentSession;
    if (session) {
      cancelSession(session);
      session.lifecycle = 'ended';
    }
    stopObserver();
    if (restoreOriginal) {
      for (const record of recordsByNode.values()) {
        if (record.status !== 'removed') writeRecord(record, record.originalText);
      }
    }
    recordsByNode.clear();
    recordsById.clear();
    currentSession = undefined;
    nextOrdinal = 0;
    progress = idleProgress();
  }

  function restorePage(): void {
    if (currentSession) setDisplayMode('original');
  }

  function makeTranslationRequest(
    session: Session,
    segments: TranslationSegment[],
  ): ContentRequest extends never ? never : unknown {
    return {
      version: CONTRACT_VERSION,
      requestId: `req_content_${crypto.randomUUID().replaceAll('-', '')}`,
      type: 'TRANSLATE_SEGMENTS',
      payload: {
        request: {
          requestId: `req_batch_${crypto.randomUUID().replaceAll('-', '')}`,
          sessionId: session.id,
          providerId: session.providerId,
          modelId: session.modelId,
          ...(session.sourceLanguage === 'auto' ? {} : { sourceLanguage: session.sourceLanguage }),
          targetLanguage: session.targetLanguage,
          mode: 'page',
          segments,
          glossaryVersion: String(session.glossaryVersion),
          glossary: session.glossary,
        },
      },
    };
  }

  function assertActive(session: Session, cancellationEpoch: number): void {
    if (
      session.cancelled ||
      session.cancellationEpoch !== cancellationEpoch ||
      currentSession !== session
    ) {
      throw new TranslationFailureError({
        reason: 'CANCELLED',
        metadata: { providerId: session.providerId, automaticRetry: false },
      });
    }
    if (location.href !== session.navigationId) {
      throw new TranslationFailureError({
        reason: 'NAVIGATION_CHANGED',
        metadata: { providerId: session.providerId, automaticRetry: false },
      });
    }
  }

  function failureFromResponse(
    response: Extract<ExtensionResponse, { type: 'MESSAGE_ERROR' }>,
    session: Session,
  ): TranslationFailure {
    if (response.payload.failure) return response.payload.failure;
    const reason: TranslationFailure['reason'] =
      response.payload.code === 'CANCELLED'
        ? 'CANCELLED'
        : response.payload.code === 'STALE_SESSION'
          ? 'NAVIGATION_CHANGED'
          : response.payload.code === 'RATE_LIMITED'
            ? 'UPSTREAM_RATE_LIMIT'
            : response.payload.code === 'QUOTA_EXCEEDED'
              ? 'UPSTREAM_QUOTA_EXHAUSTED'
              : response.payload.code === 'REQUEST_TIMEOUT'
                ? 'PROVIDER_TIMEOUT'
                : response.payload.code === 'PROVIDER_AUTHENTICATION_FAILED'
                  ? 'AUTHENTICATION_FAILED'
                  : response.payload.code === 'PROVIDER_UNAVAILABLE'
                    ? 'PROVIDER_UNAVAILABLE'
                    : response.payload.code === 'INVALID_PROVIDER_RESPONSE'
                      ? 'INVALID_PROVIDER_RESPONSE'
                      : response.payload.code === 'BACKEND_UNAVAILABLE'
                        ? 'BACKEND_UNAVAILABLE'
                        : 'UNKNOWN';
    return {
      reason,
      metadata: {
        providerId: session.providerId,
        automaticRetry: response.payload.retryable && reason === 'UPSTREAM_RATE_LIMIT',
        retryAfterSeconds: response.payload.retryable ? 5 : undefined,
      },
    };
  }

  function failureWithProgress(
    failure: TranslationFailure,
    metadata: TranslationFailure['metadata'],
  ): TranslationFailure {
    return { reason: failure.reason, metadata: { ...failure.metadata, ...metadata } };
  }

  function waitForRetry(session: Session, seconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const rejectWait = () => {
        reject(
          new TranslationFailureError({
            reason: 'CANCELLED',
            metadata: { providerId: session.providerId, automaticRetry: false },
          }),
        );
      };
      session.rejectRetryWait = rejectWait;
      session.retryTimer = setTimeout(
        () => {
          session.retryTimer = undefined;
          session.rejectRetryWait = undefined;
          resolve();
        },
        Math.max(0, seconds) * 1_000,
      );
    });
  }

  async function translateRecords(
    session: Session,
    records: NodeRecord[],
    useSmallerBatches = false,
    cancellationEpoch = session.cancellationEpoch,
  ): Promise<void> {
    const batches = batchSegments(
      records.map((record) => record.segment),
      useSmallerBatches
        ? { maxSegments: 10, maxCharacters: 2_000 }
        : { maxSegments: 50, maxCharacters: 10_000 },
    );
    progress = {
      ...progress,
      status: 'translating',
      queuedSegments: records.length,
      waitingSegments: 0,
      retryingSegments: 0,
      failedSegments: 0,
      failure: undefined,
    };
    session.lifecycle = 'translating';
    session.lastActivityAt = Date.now();

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const segments = batches[batchIndex]!;
      let retryAttempt = 0;
      while (true) {
        try {
          assertActive(session, cancellationEpoch);
          const rawResponse = await browser.runtime.sendMessage(
            makeTranslationRequest(session, segments),
          );
          const response = extensionResponseSchema.parse(rawResponse);
          if (response.type === 'MESSAGE_ERROR') {
            throw new TranslationFailureError(failureFromResponse(response, session));
          }
          if (response.type !== 'TRANSLATION_RESULT') {
            throw new TranslationFailureError({
              reason: 'INVALID_PROVIDER_RESPONSE',
              metadata: { providerId: session.providerId, automaticRetry: false },
            });
          }
          if (response.payload.response.sessionId !== session.id) {
            throw new TranslationFailureError({
              reason: 'NAVIGATION_CHANGED',
              metadata: { providerId: session.providerId, automaticRetry: false },
            });
          }
          assertActive(session, cancellationEpoch);

          for (const translation of response.payload.response.translations) {
            const record = recordsById.get(translation.id);
            if (!record || !record.node.isConnected || record.translatedText !== undefined)
              continue;
            record.translatedText = `${record.leadingWhitespace}${translation.translatedText}${record.trailingWhitespace}`;
            record.status = 'translated';
            if (session.displayMode !== 'original') writeRecord(record, record.translatedText);
            progress = { ...progress, translatedSegments: progress.translatedSegments + 1 };
          }
          if (response.payload.response.detectedSourceLanguage) {
            progress = {
              ...progress,
              detectedSourceLanguage: response.payload.response.detectedSourceLanguage,
            };
          }
          progress = {
            ...progress,
            status: 'translating',
            queuedSegments: records.filter((record) => record.translatedText === undefined).length,
            waitingSegments: 0,
            retryingSegments: 0,
            failedSegments: 0,
            failure: undefined,
          };
          break;
        } catch (cause) {
          const failure =
            cause instanceof TranslationFailureError
              ? cause.failure
              : {
                  reason: 'UNKNOWN' as const,
                  metadata: { providerId: session.providerId, automaticRetry: false },
                };
          const failedSegments = segments.filter(
            (segment) => recordsById.get(segment.id)?.translatedText === undefined,
          ).length;
          for (const segment of segments) {
            const record = recordsById.get(segment.id);
            if (record && record.translatedText === undefined) record.status = 'failed';
          }
          const pendingSegments = records.filter(
            (record) => record.translatedText === undefined,
          ).length;
          const queuedSegments = Math.max(0, pendingSegments - failedSegments);
          const canRetryAutomatically =
            failure.metadata.automaticRetry === true &&
            (failure.reason === 'LOCAL_RATE_LIMIT' || failure.reason === 'UPSTREAM_RATE_LIMIT') &&
            retryAttempt < 1;
          if (canRetryAutomatically) {
            retryAttempt += 1;
            const retryAfterSeconds = failure.metadata.retryAfterSeconds ?? 5;
            const waitingFailure = failureWithProgress(failure, {
              providerId: session.providerId,
              translatedSegments: progress.translatedSegments,
              totalSegments: progress.discoveredSegments,
              failedSegments,
              queuedSegments,
              retryAttempt,
              retryAfterSeconds,
              automaticRetry: true,
              failedBatches: 1,
            });
            progress = {
              ...progress,
              status: 'paused',
              failedSegments,
              queuedSegments,
              waitingSegments: failedSegments,
              retryingSegments: 0,
              failure: waitingFailure,
            };
            await waitForRetry(session, retryAfterSeconds);
            assertActive(session, cancellationEpoch);
            progress = {
              ...progress,
              status: 'retrying',
              waitingSegments: 0,
              retryingSegments: failedSegments,
              failure: failureWithProgress(waitingFailure, { retryAfterSeconds: 0 }),
            };
            continue;
          }
          const causeReason = failure.reason === 'RETRY_EXHAUSTED' ? 'UNKNOWN' : failure.reason;
          const finalFailure: TranslationFailure =
            failure.metadata.automaticRetry && retryAttempt >= 1
              ? {
                  reason: 'RETRY_EXHAUSTED' as const,
                  metadata: {
                    ...failure.metadata,
                    providerId: session.providerId,
                    translatedSegments: progress.translatedSegments,
                    totalSegments: progress.discoveredSegments,
                    failedSegments,
                    queuedSegments,
                    retryAttempt,
                    automaticRetry: false,
                    failedBatches: 1,
                    causeReason,
                  },
                }
              : failureWithProgress(failure, {
                  providerId: session.providerId,
                  translatedSegments: progress.translatedSegments,
                  totalSegments: progress.discoveredSegments,
                  failedSegments,
                  queuedSegments,
                  retryAttempt,
                  automaticRetry: false,
                  failedBatches: 1,
                });
          throw new TranslationFailureError(finalFailure);
        }
      }
    }
  }

  function finishWithFailure(failure: TranslationFailure): void {
    const translatedSegments = progress.translatedSegments;
    const totalSegments = progress.discoveredSegments;
    const finalFailure = failureWithProgress(failure, {
      translatedSegments,
      totalSegments,
      failedSegments:
        failure.metadata.failedSegments ?? Math.max(0, totalSegments - translatedSegments),
      queuedSegments: failure.metadata.queuedSegments ?? 0,
      automaticRetry: false,
    });
    progress = {
      ...progress,
      status:
        finalFailure.reason === 'CANCELLED'
          ? 'cancelled'
          : translatedSegments > 0
            ? 'partial'
            : 'error',
      failedSegments: finalFailure.metadata.failedSegments ?? 0,
      queuedSegments: finalFailure.metadata.queuedSegments ?? 0,
      waitingSegments: 0,
      retryingSegments: 0,
      failure: finalFailure,
      error: undefined,
    };
    if (currentSession) {
      currentSession.lifecycle = translatedSegments > 0 ? 'partial' : 'active';
      if (currentSession.displayMode !== 'original') currentSession.displayMode = 'mixed-partial';
      currentSession.lastActivityAt = Date.now();
    }
  }

  async function translateDiscovered(session: Session, records: NodeRecord[]): Promise<void> {
    if (records.length === 0) return;
    const cancellationEpoch = session.cancellationEpoch;
    progress = {
      ...progress,
      discoveredSegments: progress.discoveredSegments + records.length,
    };
    try {
      await translateRecords(session, records, false, cancellationEpoch);
      assertActive(session, cancellationEpoch);
      progress = {
        ...progress,
        status: 'completed',
        failedSegments: 0,
        queuedSegments: 0,
        waitingSegments: 0,
        retryingSegments: 0,
        failure: undefined,
      };
      session.lifecycle = 'complete';
      if (session.displayMode !== 'original') session.displayMode = 'translated';
      session.lastActivityAt = Date.now();
    } catch (cause) {
      if (currentSession !== session || session.cancellationEpoch !== cancellationEpoch) return;
      finishWithFailure(
        cause instanceof TranslationFailureError
          ? cause.failure
          : { reason: 'UNKNOWN', metadata: { providerId: session.providerId } },
      );
    }
  }

  function scanForChanges(session: Session): TranslationChangeSummary {
    const summary = emptyChangeSummary();
    const seenFingerprints = new Map<string, number>();

    for (const record of recordsByNode.values()) {
      if (!record.node.isConnected) {
        const replacementNodes = [...record.element.childNodes].filter(
          (node): node is Text =>
            node.nodeType === Node.TEXT_NODE &&
            !recordsByNode.has(node as Text) &&
            isLikelyTranslatableText(node.nodeValue ?? ''),
        );
        if (record.element.isConnected && replacementNodes.length === 1) {
          const oldNode = record.node;
          const replacement = replacementNodes[0]!;
          const { normalized, leadingWhitespace, trailingWhitespace } = normalizeText(
            replacement.nodeValue ?? '',
          );
          recordsByNode.delete(oldNode);
          recordsById.delete(record.segment.id);
          record.node = replacement;
          record.originalText = replacement.nodeValue ?? '';
          record.leadingWhitespace = leadingWhitespace;
          record.trailingWhitespace = trailingWhitespace;
          record.sourceFingerprint = createTextFingerprint(normalized);
          record.structuralFingerprint = structuralFingerprint(record.element);
          record.segment = {
            id: createSegmentId(normalized, nextOrdinal, record.segment.elementRole),
            text: normalized,
            elementRole: record.segment.elementRole,
            context: record.structuralFingerprint,
          };
          nextOrdinal += 1;
          record.translatedText = undefined;
          record.status = 'changed';
          recordsByNode.set(replacement, record);
          recordsById.set(record.segment.id, record);
          summary.modifiedSegments += 1;
          continue;
        }
        if (record.status !== 'removed') record.status = 'removed';
        summary.removedSegments += 1;
        continue;
      }

      const nextStructuralFingerprint = record.node.parentElement
        ? structuralFingerprint(record.node.parentElement)
        : record.structuralFingerprint;
      if (
        nextStructuralFingerprint !== record.structuralFingerprint &&
        record.status === 'translated'
      ) {
        record.structuralFingerprint = nextStructuralFingerprint;
        summary.reorderedSegments += 1;
      }

      const expected =
        session.displayMode === 'original' || record.status !== 'translated'
          ? record.originalText
          : (record.translatedText ?? record.originalText);
      const currentText = record.node.nodeValue ?? '';
      if (currentText !== expected && !selfMutatedNodes.has(record.node)) {
        const { normalized, leadingWhitespace, trailingWhitespace } = normalizeText(currentText);
        if (!normalized || !isLikelyTranslatableText(normalized)) {
          record.status = 'removed';
          summary.removedSegments += 1;
          continue;
        }
        recordsById.delete(record.segment.id);
        record.originalText = currentText;
        record.leadingWhitespace = leadingWhitespace;
        record.trailingWhitespace = trailingWhitespace;
        record.sourceFingerprint = createTextFingerprint(normalized);
        record.segment = {
          id: createSegmentId(normalized, nextOrdinal, record.segment.elementRole),
          text: normalized,
          elementRole: record.segment.elementRole,
          context: nextStructuralFingerprint,
        };
        nextOrdinal += 1;
        record.translatedText = undefined;
        record.status = 'changed';
        recordsById.set(record.segment.id, record);
        summary.modifiedSegments += 1;
      }

      seenFingerprints.set(
        record.sourceFingerprint,
        (seenFingerprints.get(record.sourceFingerprint) ?? 0) + 1,
      );
    }

    const newRecords = discover();
    for (const record of newRecords) {
      const duplicateCount = seenFingerprints.get(record.sourceFingerprint) ?? 0;
      if (duplicateCount > 0) {
        record.status = 'uncertain';
        summary.uncertainSegments += 1;
      } else {
        summary.newSegments += 1;
      }
      seenFingerprints.set(record.sourceFingerprint, duplicateCount + 1);
    }

    session.changed = summary;
    session.changeScan = {
      status: Object.values(summary).some((count) => count > 0) ? 'changes-found' : 'no-changes',
      summary,
    };
    session.lastActivityAt = Date.now();
    if (Object.values(summary).some((count) => count > 0)) session.lifecycle = 'stale';
    return summary;
  }

  async function updateChangedSections(session: Session): Promise<void> {
    const scannedSummary = scanForChanges(session);
    for (const record of [...recordsByNode.values()]) {
      if (record.status !== 'removed') continue;
      recordsByNode.delete(record.node);
      recordsById.delete(record.segment.id);
    }
    const changed = [...recordsByNode.values()].filter(
      (record) =>
        record.node.isConnected &&
        (record.status === 'pending' || record.status === 'changed' || record.status === 'failed'),
    );
    if (changed.length === 0) {
      session.changed = {
        ...emptyChangeSummary(),
        uncertainSegments: session.changed.uncertainSegments,
      };
      session.lifecycle = progress.failedSegments > 0 ? 'partial' : 'complete';
      session.changeScan = {
        status: Object.values(scannedSummary).some((count) => count > 0) ? 'updated' : 'no-changes',
        summary: scannedSummary,
        ...(Object.values(scannedSummary).some((count) => count > 0) ? { updatedSegments: 0 } : {}),
      };
      return;
    }
    for (const record of changed) record.status = 'pending';
    const cancellationEpoch = session.cancellationEpoch;
    try {
      await translateRecords(session, changed, false, cancellationEpoch);
      assertActive(session, cancellationEpoch);
      session.changed = {
        ...emptyChangeSummary(),
        uncertainSegments: [...recordsByNode.values()].filter(
          (record) => record.status === 'uncertain',
        ).length,
      };
      session.lifecycle = session.changed.uncertainSegments > 0 ? 'partial' : 'complete';
      session.changeScan = {
        status: 'updated',
        summary: scannedSummary,
        updatedSegments: changed.length,
      };
      progress = {
        ...progress,
        status: session.lifecycle === 'complete' ? 'completed' : 'partial',
        discoveredSegments: [...recordsByNode.values()].filter(
          (record) => record.status !== 'removed',
        ).length,
        translatedSegments: [...recordsByNode.values()].filter(
          (record) => record.status === 'translated',
        ).length,
        failedSegments: 0,
        queuedSegments: session.changed.uncertainSegments,
        failure: undefined,
      };
    } catch (cause) {
      if (currentSession !== session || session.cancellationEpoch !== cancellationEpoch) return;
      finishWithFailure(
        cause instanceof TranslationFailureError
          ? cause.failure
          : { reason: 'UNKNOWN', metadata: { providerId: session.providerId } },
      );
    }
  }

  function scheduleDynamicTranslation(mutations: MutationRecord[]): void {
    const session = currentSession;
    if (!session || session.cancelled) return;
    const selfNodes = new Set<Text>();
    const hasExternalChange = mutations.some((mutation) => {
      if (mutation.type !== 'characterData') return true;
      const node = mutation.target as Text;
      if (selfMutatedNodes.get(node) !== (node.nodeValue ?? '')) return true;
      selfNodes.add(node);
      return false;
    });
    for (const node of selfNodes) selfMutatedNodes.delete(node);
    if (!hasExternalChange) return;
    if (observerTimer !== undefined) clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      observerTimer = undefined;
      if (currentSession?.id !== session.id || session.cancelled) return;
      scanForChanges(session);
      if (session.autoTranslateDynamicContent) void updateChangedSections(session);
    }, 350);
  }

  function startObserver(): void {
    if (!document.body) return;
    observer = new MutationObserver(scheduleDynamicTranslation);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  async function startTranslation(payload: {
    sessionId: string;
    providerId: ProviderId;
    modelId: string;
    sourceLanguage: string;
    targetLanguage: string;
    glossaryVersion: number;
    glossary: GlossaryEntry[];
    autoTranslateDynamicContent: boolean;
  }): Promise<void> {
    endSession(true);
    const now = Date.now();
    const session: Session = {
      id: payload.sessionId,
      providerId: payload.providerId,
      modelId: payload.modelId,
      sourceLanguage: payload.sourceLanguage,
      targetLanguage: payload.targetLanguage,
      glossaryVersion: payload.glossaryVersion,
      glossary: payload.glossary,
      autoTranslateDynamicContent: payload.autoTranslateDynamicContent,
      navigationId: location.href,
      cancelled: false,
      cancellationEpoch: 0,
      createdAt: now,
      lastActivityAt: now,
      displayMode: 'translated',
      lifecycle: 'translating',
      changed: emptyChangeSummary(),
    };
    currentSession = session;
    progress = {
      sessionId: session.id,
      status: 'discovering',
      discoveredSegments: 0,
      translatedSegments: 0,
      failedSegments: 0,
      queuedSegments: 0,
      waitingSegments: 0,
      retryingSegments: 0,
      targetLanguage: session.targetLanguage,
      notices: collectContentNotices(),
    };
    const records = discover();
    if (records.length === 0) progress = { ...progress, status: 'completed' };
    await translateDiscovered(session, records);
    if (currentSession?.id === session.id && !session.cancelled) startObserver();
  }

  async function continueTranslation(payload: {
    sessionId: string;
    providerId: ProviderId;
    modelId: string;
    useSmallerBatches: boolean;
  }): Promise<void> {
    const session = currentSession;
    if (!session || session.id !== payload.sessionId) {
      finishWithFailure({
        reason: 'UNKNOWN',
        metadata: { providerId: payload.providerId, automaticRetry: false },
      });
      return;
    }
    if (location.href !== session.navigationId) {
      finishWithFailure({
        reason: 'NAVIGATION_CHANGED',
        metadata: { providerId: session.providerId, automaticRetry: false },
      });
      return;
    }
    session.providerId = payload.providerId;
    session.modelId = payload.modelId;
    session.cancelled = false;
    session.lifecycle = 'translating';
    session.lastActivityAt = Date.now();
    stopObserver();
    const cancellationEpoch = session.cancellationEpoch;
    const pending = [...recordsByNode.values()].filter(
      (record) => record.node.isConnected && record.translatedText === undefined,
    );
    if (pending.length === 0) {
      progress = {
        ...progress,
        status: 'completed',
        failedSegments: 0,
        queuedSegments: 0,
        waitingSegments: 0,
        retryingSegments: 0,
        failure: undefined,
      };
      session.lifecycle = 'complete';
      if (session.displayMode !== 'original') session.displayMode = 'translated';
      session.lastActivityAt = Date.now();
      startObserver();
      return;
    }
    try {
      await translateRecords(session, pending, payload.useSmallerBatches, cancellationEpoch);
      assertActive(session, cancellationEpoch);
      progress = {
        ...progress,
        status: 'completed',
        failedSegments: 0,
        queuedSegments: 0,
        waitingSegments: 0,
        retryingSegments: 0,
        failure: undefined,
      };
      session.lifecycle = 'complete';
      if (session.displayMode !== 'original') session.displayMode = 'translated';
      session.lastActivityAt = Date.now();
      startObserver();
    } catch (cause) {
      if (currentSession !== session || session.cancellationEpoch !== cancellationEpoch) return;
      finishWithFailure(
        cause instanceof TranslationFailureError
          ? cause.failure
          : { reason: 'UNKNOWN', metadata: { providerId: session.providerId } },
      );
    }
  }

  function createPageFingerprint(records: NodeRecord[]): string {
    const pageUrl = new URL(location.href);
    const identity = `${pageUrl.origin}${pageUrl.pathname}\u0000${document.title}\u0000${records
      .slice(0, 24)
      .map((record) => record.sourceFingerprint)
      .join('|')}`;
    return createTextFingerprint(identity);
  }

  function safeComparisonUrl(value: string | null): string | undefined {
    if (!value) return undefined;
    try {
      const url = new URL(value, location.href);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        return undefined;
      }
      return url.href.slice(0, 4_096);
    } catch {
      return undefined;
    }
  }

  function comparisonAttributes(element: Element): TranslationComparisonAttributes | undefined {
    const attributes: TranslationComparisonAttributes = {};
    const href =
      element.tagName === 'A' ? safeComparisonUrl(element.getAttribute('href')) : undefined;
    const src =
      element.tagName === 'IMG' ? safeComparisonUrl(element.getAttribute('src')) : undefined;
    const alt = element.getAttribute('alt')?.slice(0, 500);
    const title = element.getAttribute('title')?.slice(0, 500);
    const role = element.getAttribute('role')?.slice(0, 100);
    const ariaLabel = element.getAttribute('aria-label')?.slice(0, 500);
    const lang = element.getAttribute('lang');
    const dir = element.getAttribute('dir');
    if (href) attributes.href = href;
    if (src) attributes.src = src;
    if (alt) attributes.alt = alt;
    if (title) attributes.title = title;
    if (role) attributes.role = role;
    if (ariaLabel) attributes.ariaLabel = ariaLabel;
    if (lang && /^[a-zA-Z0-9-]{1,35}$/u.test(lang)) attributes.lang = lang;
    if (dir === 'auto' || dir === 'ltr' || dir === 'rtl') attributes.dir = dir;
    if (element instanceof HTMLTableCellElement) {
      attributes.rowSpan = Math.min(100, Math.max(1, element.rowSpan));
      attributes.colSpan = Math.min(100, Math.max(1, element.colSpan));
    }
    if (element instanceof HTMLOListElement && element.hasAttribute('start')) {
      attributes.listStart = Math.min(10_000, Math.max(-10_000, element.start));
    }
    return Object.keys(attributes).length > 0 ? attributes : undefined;
  }

  function createComparisonSnapshot(): TranslationComparisonSnapshot {
    const nodes: TranslationComparisonSnapshot['nodes'] = [];
    const preferredRoot = document.querySelector('main, [role="main"], article') ?? document.body;
    if (!preferredRoot) {
      return { rootIndex: 0, nodes: [{ kind: 'element', tag: 'main' }] };
    }

    const appendNode = (node: Node, parentIndex: number | undefined, depth: number): void => {
      if (nodes.length >= MAX_COMPARISON_SNAPSHOT_NODES || depth > MAX_COMPARISON_SNAPSHOT_DEPTH) {
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        if (parentIndex === undefined) return;
        const textNode = node as Text;
        const record = recordsByNode.get(textNode);
        const text = textNode.nodeValue ?? '';
        if (!record && text.length === 0) return;
        nodes.push(
          record
            ? { kind: 'text', parentIndex, segmentId: record.segment.id }
            : {
                kind: 'text',
                parentIndex,
                text: (text.trim().length === 0 ? ' ' : text).slice(0, 2_200),
              },
        );
        return;
      }
      if (!(node instanceof Element)) return;
      if (node.matches(comparisonExcludedSelector) || !isVisible(node)) return;

      const rawTag = node.tagName.toLowerCase();
      const tag = comparisonElementTags.has(rawTag as TranslationComparisonElementTag)
        ? (rawTag as TranslationComparisonElementTag)
        : undefined;
      if (!tag) {
        for (const child of node.childNodes) appendNode(child, parentIndex, depth + 1);
        return;
      }

      const index = nodes.length;
      const attributes = comparisonAttributes(node);
      nodes.push({
        kind: 'element',
        ...(parentIndex === undefined ? {} : { parentIndex }),
        tag,
        ...(attributes ? { attributes } : {}),
      });
      for (const child of node.childNodes) appendNode(child, index, depth + 1);
    };

    const rootAttributes = comparisonAttributes(preferredRoot);
    nodes.push({
      kind: 'element',
      tag: 'main',
      ...(rootAttributes ? { attributes: rootAttributes } : {}),
    });
    for (const child of preferredRoot.childNodes) appendNode(child, 0, 1);
    return { rootIndex: 0, nodes };
  }

  function navigationCompatible(source: string, destination: string): boolean {
    try {
      const sourceUrl = new URL(source);
      const destinationUrl = new URL(destination);
      const protocolCompatible =
        sourceUrl.protocol === destinationUrl.protocol ||
        (sourceUrl.protocol === 'http:' && destinationUrl.protocol === 'https:');
      const portCompatible =
        sourceUrl.protocol === destinationUrl.protocol
          ? sourceUrl.port === destinationUrl.port
          : (!sourceUrl.port || sourceUrl.port === '80') &&
            (!destinationUrl.port || destinationUrl.port === '443');
      return protocolCompatible && portCompatible && sourceUrl.hostname === destinationUrl.hostname;
    } catch {
      return false;
    }
  }

  function exportSessionBundle(sessionId: string): TranslationSessionBundle | undefined {
    const session = currentSession;
    if (!session || session.id !== sessionId || location.href !== session.navigationId)
      return undefined;
    scanForChanges(session);
    const records = [...recordsByNode.values()].filter((record) => record.status !== 'removed');
    const bundle: TranslationSessionBundle = {
      version: TRANSLATION_SESSION_VERSION,
      sessionId: session.id,
      navigationUrl: session.navigationId,
      pageFingerprint: createPageFingerprint(records),
      pageTitle: document.title.slice(0, 500),
      sourceLanguage: session.sourceLanguage,
      targetLanguage: session.targetLanguage,
      providerId: session.providerId,
      modelId: session.modelId,
      createdAt: session.createdAt,
      lastActivityAt: Date.now(),
      displayMode: session.displayMode,
      lifecycle: session.lifecycle,
      partial: session.lifecycle !== 'complete',
      segments: records.map((record) => ({
        id: record.segment.id,
        sourceFingerprint: record.sourceFingerprint,
        structuralFingerprint: record.structuralFingerprint,
        originalText: record.originalText,
        sourceText: record.segment.text,
        ...(record.translatedText ? { translatedText: record.translatedText } : {}),
        ...(record.segment.elementRole ? { elementRole: record.segment.elementRole } : {}),
        status: record.status,
      })),
      comparisonSnapshot: createComparisonSnapshot(),
    };
    if (new TextEncoder().encode(JSON.stringify(bundle)).byteLength > MAX_SESSION_BUNDLE_BYTES) {
      return undefined;
    }
    return bundle;
  }

  function importSessionBundle(bundle: TranslationSessionBundle): {
    discoveredSegments: number;
    matchedSegments: number;
    unmatchedSegments: number;
    uncertainSegments: number;
  };
  function importSessionBundle(
    bundle: TranslationSessionBundle,
    observeDynamicContent?: boolean,
  ): {
    discoveredSegments: number;
    matchedSegments: number;
    unmatchedSegments: number;
    uncertainSegments: number;
  };
  function importSessionBundle(
    bundle: TranslationSessionBundle,
    observeDynamicContent = true,
  ): {
    discoveredSegments: number;
    matchedSegments: number;
    unmatchedSegments: number;
    uncertainSegments: number;
  } {
    if (!navigationCompatible(bundle.navigationUrl, location.href)) {
      throw new Error('The translated copy does not match the source navigation.');
    }
    endSession(true);
    const records = discover();
    if (createPageFingerprint(records) !== bundle.pageFingerprint) {
      for (const record of records) record.status = 'uncertain';
    }

    const sourceByFingerprint = new Map<string, TranslationSessionBundle['segments']>();
    for (const source of bundle.segments) {
      sourceByFingerprint.set(source.sourceFingerprint, [
        ...(sourceByFingerprint.get(source.sourceFingerprint) ?? []),
        source,
      ]);
    }
    const usedSourceIds = new Set<string>();
    let matchedSegments = 0;
    let uncertainSegments = 0;
    for (const record of records) {
      const candidates = (sourceByFingerprint.get(record.sourceFingerprint) ?? []).filter(
        (candidate) =>
          !usedSourceIds.has(candidate.id) &&
          candidate.translatedText &&
          (!candidate.elementRole || candidate.elementRole === record.segment.elementRole),
      );
      const structuralMatches = candidates.filter(
        (candidate) => candidate.structuralFingerprint === record.structuralFingerprint,
      );
      const source = candidates.length === 1 ? candidates[0] : structuralMatches[0];
      if (!source || (candidates.length > 1 && structuralMatches.length !== 1)) {
        record.status = candidates.length > 0 ? 'uncertain' : 'pending';
        if (record.status === 'uncertain') uncertainSegments += 1;
        continue;
      }
      usedSourceIds.add(source.id);
      record.translatedText = source.translatedText;
      record.status = 'translated';
      matchedSegments += 1;
    }

    const now = Date.now();
    const unmatchedSegments = records.length - matchedSegments - uncertainSegments;
    currentSession = {
      id: bundle.sessionId,
      providerId: bundle.providerId,
      modelId: bundle.modelId,
      sourceLanguage: bundle.sourceLanguage,
      targetLanguage: bundle.targetLanguage,
      glossaryVersion: 0,
      glossary: [],
      autoTranslateDynamicContent: false,
      navigationId: bundle.navigationUrl,
      cancelled: false,
      cancellationEpoch: 0,
      createdAt: now,
      lastActivityAt: now,
      displayMode:
        matchedSegments === 0
          ? 'original'
          : matchedSegments === records.length
            ? 'translated'
            : 'mixed-partial',
      lifecycle: unmatchedSegments + uncertainSegments === 0 ? 'complete' : 'partial',
      changed: {
        ...emptyChangeSummary(),
        newSegments: unmatchedSegments,
        uncertainSegments,
      },
    };
    const existingTranslatedCopy = progress.translatedCopy;
    progress = {
      sessionId: bundle.sessionId,
      status: unmatchedSegments + uncertainSegments === 0 ? 'completed' : 'partial',
      discoveredSegments: records.length,
      translatedSegments: matchedSegments,
      failedSegments: 0,
      queuedSegments: unmatchedSegments,
      waitingSegments: 0,
      retryingSegments: 0,
      targetLanguage: bundle.targetLanguage,
      ...(existingTranslatedCopy ? { translatedCopy: existingTranslatedCopy } : {}),
    };
    setDisplayMode(matchedSegments === 0 ? 'original' : 'translated');
    if (observeDynamicContent) startObserver();
    return {
      discoveredSegments: records.length,
      matchedSegments,
      unmatchedSegments,
      uncertainSegments,
    };
  }

  async function refreshTranslation(
    session: Session,
    scope: 'changed' | 'entire-page',
  ): Promise<void> {
    if (scope === 'changed') {
      await updateChangedSections(session);
      return;
    }
    const candidates = [...recordsByNode.values()].filter(
      (record) => record.node.isConnected && record.status !== 'removed',
    );
    const previous = candidates.map((record) => ({
      record,
      translatedText: record.translatedText,
      status: record.status,
    }));
    for (const record of candidates) {
      record.translatedText = undefined;
      record.status = 'pending';
    }
    progress = { ...progress, translatedSegments: 0 };
    try {
      await translateRecords(session, candidates);
      session.lifecycle = 'complete';
      session.changed = emptyChangeSummary();
      progress = {
        ...progress,
        status: 'completed',
        translatedSegments: candidates.length,
        failedSegments: 0,
        queuedSegments: 0,
        failure: undefined,
      };
    } catch (cause) {
      for (const item of previous) {
        item.record.translatedText = item.translatedText;
        item.record.status = item.status;
      }
      if (session.displayMode !== 'original') setDisplayMode('translated');
      finishWithFailure(
        cause instanceof TranslationFailureError
          ? cause.failure
          : { reason: 'UNKNOWN', metadata: { providerId: session.providerId } },
      );
    }
  }

  window.addEventListener('pagehide', () => {
    const session = currentSession;
    if (!session || !['discovering', 'translating', 'paused', 'retrying'].includes(progress.status))
      return;
    const failure: TranslationFailure = {
      reason: 'NAVIGATION_CHANGED',
      metadata: {
        providerId: session.providerId,
        translatedSegments: progress.translatedSegments,
        totalSegments: progress.discoveredSegments,
        failedSegments: progress.failedSegments,
        queuedSegments: Math.max(
          0,
          progress.discoveredSegments - progress.translatedSegments - progress.failedSegments,
        ),
        automaticRetry: false,
      },
    };
    cancelSession(session);
    session.lifecycle = 'invalidated';
    finishWithFailure(failure);
    void browser.runtime.sendMessage({
      version: CONTRACT_VERSION,
      requestId: `req_navigation_${crypto.randomUUID().replaceAll('-', '')}`,
      type: 'REPORT_TRANSLATION_PROGRESS',
      payload: { progress: sessionProgress() },
    });
  });

  function showTranslatedCopyStatus(
    tone: 'success' | 'warning',
    status: TranslatedCopyApplicationStatus,
    titleText: string,
    messageText: string,
    actions: Array<{ label: string; run: () => void }> = [],
  ): void {
    document.getElementById('lingo-page-copy-status')?.remove();
    const host = document.createElement('div');
    host.id = 'lingo-page-copy-status';
    host.dataset.copyStatus = status;
    host.dataset.actions = actions.map((action) => action.label).join('|');
    host.style.all = 'initial';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .status { position: fixed; z-index: 2147483647; inset: 16px 16px auto auto; width: min(380px, calc(100vw - 32px)); padding: 14px 16px; border: 1px solid ${tone === 'success' ? '#78b48a' : '#e1ad63'}; border-radius: 12px; background: #fff; color: #172033; box-shadow: 0 16px 42px rgba(20, 29, 48, .2); font: 14px/1.45 system-ui, sans-serif; }
      .top { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
      strong { display: block; margin-bottom: 4px; font-size: 14px; } p { margin: 0; color: #4b5568; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      button { border: 0; border-radius: 8px; padding: 6px 8px; background: #edf1ff; color: #2744a0; cursor: pointer; font: 600 12px system-ui, sans-serif; }
      @media (prefers-color-scheme: dark) { .status { background: #17212f; color: #f5f7fb; } p { color: #c3cad6; } button { background: #263653; color: #a9c2ff; } }
      @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; transition: none !important; } }
    `;
    const card = document.createElement('section');
    card.className = 'status';
    card.setAttribute('role', tone === 'success' ? 'status' : 'alert');
    const top = document.createElement('div');
    top.className = 'top';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = titleText;
    const message = document.createElement('p');
    message.textContent = messageText;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Dismiss';
    close.setAttribute('aria-label', 'Dismiss translated-copy status');
    close.addEventListener('click', () => host.remove());
    copy.append(title, message);
    if (actions.length > 0) {
      const actionRow = document.createElement('div');
      actionRow.className = 'actions';
      for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action.label;
        button.addEventListener('click', action.run);
        actionRow.append(button);
      }
      copy.append(actionRow);
    }
    top.append(copy, close);
    card.append(top);
    shadow.append(style, card);
    document.documentElement.append(host);
  }

  function translatedCopyProgress(
    status: TranslatedCopyApplicationStatus,
    summary?: Partial<TranslatedCopyApplicationSummary>,
  ): TranslatedCopyApplicationSummary {
    return {
      status,
      discoveredSegments: summary?.discoveredSegments ?? 0,
      matchedSegments: summary?.matchedSegments ?? 0,
      appliedSegments: summary?.appliedSegments ?? 0,
      unmatchedSegments: summary?.unmatchedSegments ?? 0,
      uncertainSegments: summary?.uncertainSegments ?? 0,
      changedSegments: summary?.changedSegments ?? 0,
      providerRequests: 0,
    };
  }

  async function waitForDocumentReady(): Promise<void> {
    if (document.readyState !== 'loading' && document.body) return;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, COPY_INITIAL_STABILITY_TIMEOUT_MS);
      const finish = () => {
        clearTimeout(timeout);
        resolve();
      };
      document.addEventListener('DOMContentLoaded', finish, { once: true });
    });
  }

  async function waitForDomQuiet(maximumMs: number): Promise<void> {
    if (!document.body) return;
    await new Promise<void>((resolve) => {
      let quietTimer: ReturnType<typeof setTimeout> | undefined;
      const deadline = setTimeout(finish, maximumMs);
      const observer = new MutationObserver(scheduleQuietFinish);
      function finish() {
        observer.disconnect();
        clearTimeout(deadline);
        if (quietTimer !== undefined) clearTimeout(quietTimer);
        resolve();
      }
      function scheduleQuietFinish() {
        if (quietTimer !== undefined) clearTimeout(quietTimer);
        quietTimer = setTimeout(finish, COPY_INITIAL_STABILITY_MS);
      }
      observer.observe(document.body!, { childList: true, characterData: true, subtree: true });
      scheduleQuietFinish();
    });
  }

  async function observeInitialDomChanges(): Promise<boolean> {
    if (!document.body) return false;
    return await new Promise<boolean>((resolve) => {
      let changed = false;
      const observer = new MutationObserver(() => {
        changed = true;
      });
      observer.observe(document.body!, { childList: true, characterData: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(changed);
      }, COPY_RECONCILIATION_WINDOW_MS);
    });
  }

  function applicationStatus(summary: {
    matchedSegments: number;
    unmatchedSegments: number;
    uncertainSegments: number;
  }): 'ready' | 'partial' | 'no-matches' {
    if (summary.matchedSegments === 0) return 'no-matches';
    return summary.unmatchedSegments + summary.uncertainSegments > 0 ? 'partial' : 'ready';
  }

  async function applyTranslatedCopyBundle(bundle: TranslationSessionBundle): Promise<
    TranslatedCopyApplicationSummary & {
      applicationStatus: 'ready' | 'partial' | 'no-matches';
      applicationStage: 'destination-ready';
    }
  > {
    await waitForDocumentReady();
    await waitForDomQuiet(COPY_INITIAL_STABILITY_TIMEOUT_MS);
    const initial = importSessionBundle(bundle, false);
    const changed = await observeInitialDomChanges();
    let final = initial;
    if (changed) {
      await waitForDomQuiet(COPY_INITIAL_STABILITY_TIMEOUT_MS);
      final = importSessionBundle(bundle, false);
    }
    startObserver();
    const status = applicationStatus(final);
    const summary = translatedCopyProgress(status, {
      ...final,
      appliedSegments: final.matchedSegments,
      changedSegments: changed ? final.discoveredSegments : 0,
    });
    progress = { ...progress, translatedCopy: summary };
    return {
      ...summary,
      applicationStatus: status,
      applicationStage: 'destination-ready',
    };
  }

  function translateImportedSections(): void {
    const session = currentSession;
    if (!session) return;
    void browser.runtime.sendMessage({
      version: CONTRACT_VERSION,
      requestId: `req_copy_translate_${crypto.randomUUID().replaceAll('-', '')}`,
      type: 'TRANSLATE_IMPORTED_SECTIONS',
      payload: { sessionId: session.id },
    });
  }

  function focusTranslatedCopySource(): void {
    if (!translatedCopyToken) return;
    void browser.runtime.sendMessage({
      version: CONTRACT_VERSION,
      requestId: `req_copy_source_${crypto.randomUUID().replaceAll('-', '')}`,
      type: 'FOCUS_TRANSLATED_COPY_SOURCE',
      payload: { token: translatedCopyToken },
    });
  }

  function renderTranslatedCopySummary(summary: TranslatedCopyApplicationSummary): void {
    const attachSummary = () => {
      const host = document.getElementById('lingo-page-copy-status');
      if (!host) return;
      host.dataset.matchedSegments = String(summary.matchedSegments);
      host.dataset.unmatchedSegments = String(summary.unmatchedSegments);
      host.dataset.uncertainSegments = String(summary.uncertainSegments);
      host.dataset.changedSegments = String(summary.changedSegments);
      host.dataset.providerRequests = '0';
    };
    const commonMessage = `${summary.matchedSegments} sections reused, ${summary.unmatchedSegments} unmatched, ${summary.uncertainSegments} uncertain, and 0 provider requests.`;
    if (summary.status === 'ready') {
      showTranslatedCopyStatus('success', 'ready', 'Translated copy ready', commonMessage);
      attachSummary();
      return;
    }
    if (summary.status === 'partial') {
      showTranslatedCopyStatus(
        'warning',
        'partial',
        'Translated copy partially applied',
        commonMessage,
        [{ label: 'Translate unmatched sections', run: translateImportedSections }],
      );
      attachSummary();
      return;
    }
    showTranslatedCopyStatus(
      'warning',
      'no-matches',
      'No safe cached matches',
      'The original page remains visible. No provider request was made.',
      [
        {
          label: 'Retry matching',
          run: () => {
            if (!translatedCopyBundle) return;
            showTranslatedCopyStatus(
              'warning',
              'applying',
              'Applying cached translation',
              'Waiting for the destination page to settle. No provider request will be made.',
            );
            void applyTranslatedCopyBundle(translatedCopyBundle)
              .then(renderTranslatedCopySummary)
              .catch(() => {
                progress = {
                  ...progress,
                  translatedCopy: translatedCopyProgress('import-failed'),
                };
                showTranslatedCopyStatus(
                  'warning',
                  'import-failed',
                  'Translation import failed',
                  'The cached translation could not be applied safely.',
                );
              });
          },
        },
        { label: 'Translate this page', run: translateImportedSections },
        { label: 'Return to source tab', run: focusTranslatedCopySource },
      ],
    );
    attachSummary();
  }

  async function claimTranslatedCopyHandoff(): Promise<void> {
    try {
      const response = extensionResponseSchema.parse(
        await browser.runtime.sendMessage({
          version: CONTRACT_VERSION,
          requestId: `req_copy_claim_${crypto.randomUUID().replaceAll('-', '')}`,
          type: 'GET_TRANSLATED_COPY_HANDOFF',
          payload: {},
        }),
      );
      if (response.type === 'TRANSLATED_COPY_HANDOFF_STATUS') {
        if (response.payload.status === 'failed') {
          const status = response.payload.message?.includes('expired')
            ? 'session-stale'
            : 'import-failed';
          progress = { ...progress, translatedCopy: translatedCopyProgress(status) };
          showTranslatedCopyStatus(
            'warning',
            status,
            'Translation reuse unavailable',
            response.payload.message ??
              'This tab remains open, but its saved translation could not be reused safely.',
          );
        }
        return;
      }
      if (response.type !== 'TRANSLATED_COPY_HANDOFF') return;
      try {
        translatedCopyBundle = response.payload.bundle;
        translatedCopyToken = response.payload.token;
        progress = {
          ...progress,
          status: 'discovering',
          targetLanguage: response.payload.bundle.targetLanguage,
          translatedCopy: translatedCopyProgress('applying'),
        };
        showTranslatedCopyStatus(
          'warning',
          'applying',
          'Applying cached translation',
          'Waiting for the destination page to settle. No provider request will be made.',
        );
        const summary = await applyTranslatedCopyBundle(response.payload.bundle);
        const acknowledgement = extensionResponseSchema.parse(
          await browser.runtime.sendMessage({
            version: CONTRACT_VERSION,
            requestId: `req_copy_ack_${crypto.randomUUID().replaceAll('-', '')}`,
            type: 'ACK_TRANSLATED_COPY_HANDOFF',
            payload: { token: response.payload.token, ...summary },
          }),
        );
        if (acknowledgement.type !== 'TRANSLATED_COPY_ACKNOWLEDGED') {
          throw new Error('The translated-copy acknowledgment was rejected.');
        }
        renderTranslatedCopySummary(summary);
      } catch {
        progress = {
          ...progress,
          status: currentSession ? progress.status : 'error',
          translatedCopy: translatedCopyProgress('import-failed'),
        };
        await browser.runtime
          .sendMessage({
            version: CONTRACT_VERSION,
            requestId: `req_copy_reject_${crypto.randomUUID().replaceAll('-', '')}`,
            type: 'REJECT_TRANSLATED_COPY_HANDOFF',
            payload: { token: response.payload.token },
          })
          .catch(() => undefined);
        showTranslatedCopyStatus(
          'warning',
          'import-failed',
          'Translation reuse unavailable',
          'This tab remains open, but the saved translation did not match this page safely.',
        );
      }
    } catch {
      // Ordinary pages have no translated-copy handoff. Startup remains silent for that case.
    }
  }

  function showSelectionResult(payload: {
    sourceText: string;
    translatedText: string;
    sourceLanguage?: string;
    targetLanguage: string;
  }): void {
    document.getElementById('lingo-page-selection-result')?.remove();
    const host = document.createElement('div');
    host.id = 'lingo-page-selection-result';
    host.style.all = 'initial';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .card { position: fixed; z-index: 2147483647; inset: auto 20px 20px auto; width: min(360px, calc(100vw - 40px)); padding: 16px; border: 1px solid #d7dce5; border-radius: 14px; background: #fff; color: #172033; box-shadow: 0 18px 48px rgba(20, 29, 48, .22); font: 14px/1.5 system-ui, sans-serif; }
      .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
      strong { font-size: 13px; } p { margin: 0 0 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
      .source { color: #667085; font-size: 12px; } .actions { display: flex; gap: 8px; justify-content: flex-end; }
      button { border: 0; border-radius: 8px; padding: 7px 10px; background: #edf1ff; color: #2744a0; cursor: pointer; font: 600 12px system-ui, sans-serif; }
      button.primary { background: #315bea; color: white; }
    `;
    const card = document.createElement('section');
    card.className = 'card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Selected text translation');
    const top = document.createElement('div');
    top.className = 'top';
    const title = document.createElement('strong');
    title.textContent = `Translation · ${payload.targetLanguage.toUpperCase()}`;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => host.remove());
    top.append(title, close);
    const source = document.createElement('p');
    source.className = 'source';
    source.textContent = payload.sourceText;
    const translated = document.createElement('p');
    translated.textContent = payload.translatedText;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'primary';
    copy.textContent = 'Copy translation';
    copy.addEventListener('click', () => {
      void navigator.clipboard
        .writeText(payload.translatedText)
        .then(() => {
          copy.textContent = 'Copied';
        })
        .catch(() => {
          copy.textContent = 'Copy unavailable';
        });
    });
    actions.append(copy);
    card.append(top, source, translated, actions);
    shadow.append(style, card);
    document.documentElement.append(host);
  }

  browser.runtime.onMessage.addListener((message: unknown) => {
    const parsed = contentRequestSchema.safeParse(message);
    if (!parsed.success) {
      return Promise.resolve(errorResponse('req_content_invalid', 'The page message was invalid.'));
    }
    const requestId = parsed.data.requestId;
    switch (parsed.data.type) {
      case 'PING_CONTENT_SCRIPT':
        return Promise.resolve(
          extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'CONTENT_PONG',
            payload: { ready: true, extensionVersion: browser.runtime.getManifest().version },
          }),
        );
      case 'START_PAGE_TRANSLATION':
        void startTranslation(parsed.data.payload);
        return Promise.resolve(progressResponse(requestId));
      case 'CONTINUE_PAGE_TRANSLATION':
        void continueTranslation(parsed.data.payload);
        return Promise.resolve(progressResponse(requestId));
      case 'CANCEL_PAGE_TRANSLATION':
        if (currentSession?.id === parsed.data.payload.sessionId) {
          cancelSession(currentSession);
          stopObserver();
          finishWithFailure({
            reason: 'CANCELLED',
            metadata: {
              providerId: currentSession.providerId,
              translatedSegments: progress.translatedSegments,
              totalSegments: progress.discoveredSegments,
              failedSegments: progress.failedSegments,
              queuedSegments: Math.max(
                0,
                progress.discoveredSegments - progress.translatedSegments,
              ),
              automaticRetry: false,
            },
          });
        }
        return Promise.resolve(progressResponse(requestId));
      case 'RESTORE_PAGE':
        restorePage();
        return Promise.resolve(progressResponse(requestId));
      case 'SET_PAGE_VIEW':
        if (currentSession?.id !== parsed.data.payload.sessionId) {
          return Promise.resolve(
            errorResponse(requestId, 'The translation session is unavailable.'),
          );
        }
        setDisplayMode(parsed.data.payload.displayMode);
        return Promise.resolve(progressResponse(requestId));
      case 'END_TRANSLATION_SESSION':
        if (currentSession?.id !== parsed.data.payload.sessionId) {
          return Promise.resolve(
            errorResponse(requestId, 'The translation session is unavailable.'),
          );
        }
        endSession(true);
        return Promise.resolve(progressResponse(requestId));
      case 'SCAN_PAGE_CHANGES':
        if (currentSession?.id !== parsed.data.payload.sessionId) {
          return Promise.resolve(
            errorResponse(requestId, 'The translation session is unavailable.'),
          );
        }
        scanForChanges(currentSession);
        return Promise.resolve(progressResponse(requestId));
      case 'UPDATE_CHANGED_SECTIONS':
        if (currentSession?.id !== parsed.data.payload.sessionId) {
          return Promise.resolve(
            errorResponse(requestId, 'The translation session is unavailable.'),
          );
        }
        return updateChangedSections(currentSession).then(() => progressResponse(requestId));
      case 'REFRESH_TRANSLATION':
        if (currentSession?.id !== parsed.data.payload.sessionId) {
          return Promise.resolve(
            errorResponse(requestId, 'The translation session is unavailable.'),
          );
        }
        return refreshTranslation(currentSession, parsed.data.payload.scope).then(() =>
          progressResponse(requestId),
        );
      case 'EXPORT_SESSION_BUNDLE': {
        const bundle = exportSessionBundle(parsed.data.payload.sessionId);
        if (!bundle) {
          return Promise.resolve(
            errorResponse(requestId, 'The translation session cannot be transferred safely.'),
          );
        }
        return Promise.resolve(
          extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'SESSION_BUNDLE',
            payload: { bundle },
          }),
        );
      }
      case 'IMPORT_SESSION_BUNDLE':
        try {
          importSessionBundle(parsed.data.payload.bundle);
          return Promise.resolve(progressResponse(requestId));
        } catch {
          endSession(true);
          return Promise.resolve(
            errorResponse(requestId, 'The translated copy did not match this page safely.'),
          );
        }
      case 'GET_TRANSLATION_PROGRESS':
        return Promise.resolve(progressResponse(requestId));
      case 'SHOW_SELECTION_RESULT':
        showSelectionResult(parsed.data.payload);
        return Promise.resolve(
          extensionResponseSchema.parse({
            version: CONTRACT_VERSION,
            requestId,
            type: 'CONTENT_PONG',
            payload: { ready: true, extensionVersion: browser.runtime.getManifest().version },
          }),
        );
    }
  });

  void claimTranslatedCopyHandoff();
});
