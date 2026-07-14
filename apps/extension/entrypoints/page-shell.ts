import { browser } from 'wxt/browser';
import {
  batchSegments,
  createSegmentId,
  isLikelyTranslatableText,
  normalizeText,
} from '@translation/translation-core';
import type {
  GlossaryEntry,
  TranslationProgress,
  TranslationSegment,
} from '@translation/shared-types';
import { CONTRACT_VERSION } from '@translation/shared-types';
import {
  contentRequestSchema,
  extensionResponseSchema,
  type ContentRequest,
  type ExtensionResponse,
} from '@translation/shared-validation';

type NodeRecord = {
  node: Text;
  originalText: string;
  leadingWhitespace: string;
  trailingWhitespace: string;
  segment: TranslationSegment;
  translatedText?: string;
};

type Session = {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  glossaryVersion: number;
  glossary: GlossaryEntry[];
  autoTranslateDynamicContent: boolean;
  navigationId: string;
  cancelled: boolean;
};

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
  '[contenteditable="true"]',
  '[translate="no"]',
  '.notranslate',
  '[aria-hidden="true"]',
  '#lingo-page-selection-result',
].join(',');

export default defineUnlistedScript(() => {
  const scope = globalThis as PageShellScope;
  if (scope.__LINGO_PAGE_SHELL__) return;
  Object.defineProperty(scope, '__LINGO_PAGE_SHELL__', { value: true });

  const recordsByNode = new Map<Text, NodeRecord>();
  const recordsById = new Map<string, NodeRecord>();
  const selfMutatedNodes = new WeakSet<Text>();
  let currentSession: Session | undefined;
  let observer: MutationObserver | undefined;
  let observerTimer: ReturnType<typeof setTimeout> | undefined;
  let nextOrdinal = 0;
  let progress: TranslationProgress = idleProgress();

  function idleProgress(): TranslationProgress {
    return {
      status: 'idle',
      discoveredSegments: 0,
      translatedSegments: 0,
      failedSegments: 0,
    };
  }

  function progressResponse(requestId: string): ExtensionResponse {
    return extensionResponseSchema.parse({
      version: CONTRACT_VERSION,
      requestId,
      type: 'TRANSLATION_PROGRESS',
      payload: { progress },
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
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function createRecord(node: Text): NodeRecord | undefined {
    if (recordsByNode.has(node)) return undefined;
    const parent = node.parentElement;
    if (!parent || parent.closest(excludedSelector) || !isVisible(parent)) return undefined;
    const originalText = node.nodeValue ?? '';
    if (!isLikelyTranslatableText(originalText)) return undefined;
    const { normalized, leadingWhitespace, trailingWhitespace } = normalizeText(originalText);
    if (!normalized) return undefined;
    const elementRole = parent.getAttribute('role') ?? parent.tagName.toLowerCase();
    const segment: TranslationSegment = {
      id: createSegmentId(normalized, nextOrdinal, elementRole),
      text: normalized,
      elementRole,
      surroundingText: (parent.textContent ?? '').replace(/\s+/gu, ' ').trim().slice(0, 500),
    };
    nextOrdinal += 1;
    const record = { node, originalText, leadingWhitespace, trailingWhitespace, segment };
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

  function stopObserver(): void {
    observer?.disconnect();
    observer = undefined;
    if (observerTimer !== undefined) clearTimeout(observerTimer);
    observerTimer = undefined;
  }

  function restorePage(): void {
    if (currentSession) currentSession.cancelled = true;
    stopObserver();
    for (const record of recordsByNode.values()) {
      if (!record.node.isConnected) continue;
      selfMutatedNodes.add(record.node);
      record.node.nodeValue = record.originalText;
    }
    recordsByNode.clear();
    recordsById.clear();
    currentSession = undefined;
    nextOrdinal = 0;
    progress = idleProgress();
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

  function assertActive(session: Session): void {
    if (session.cancelled || currentSession?.id !== session.id) throw new Error('CANCELLED');
    if (location.href !== session.navigationId) throw new Error('STALE_SESSION');
  }

  async function translateRecords(session: Session, records: NodeRecord[]): Promise<void> {
    const batches = batchSegments(
      records.map((record) => record.segment),
      { maxSegments: 50, maxCharacters: 10_000 },
    );
    progress = { ...progress, status: 'translating' };

    for (const segments of batches) {
      assertActive(session);
      const rawResponse = await browser.runtime.sendMessage(
        makeTranslationRequest(session, segments),
      );
      const response = extensionResponseSchema.parse(rawResponse);
      if (response.type === 'MESSAGE_ERROR') throw new Error(response.payload.code);
      if (response.type !== 'TRANSLATION_RESULT') throw new Error('INVALID_PROVIDER_RESPONSE');
      if (response.payload.response.sessionId !== session.id) throw new Error('STALE_SESSION');
      assertActive(session);

      for (const translation of response.payload.response.translations) {
        const record = recordsById.get(translation.id);
        if (!record || !record.node.isConnected) continue;
        selfMutatedNodes.add(record.node);
        record.translatedText = `${record.leadingWhitespace}${translation.translatedText}${record.trailingWhitespace}`;
        record.node.nodeValue = record.translatedText;
        progress = { ...progress, translatedSegments: progress.translatedSegments + 1 };
      }
      if (response.payload.response.detectedSourceLanguage) {
        progress = {
          ...progress,
          detectedSourceLanguage: response.payload.response.detectedSourceLanguage,
        };
      }
    }
  }

  async function translateDiscovered(session: Session, records: NodeRecord[]): Promise<void> {
    if (records.length === 0) return;
    progress = {
      ...progress,
      discoveredSegments: progress.discoveredSegments + records.length,
    };
    try {
      await translateRecords(session, records);
      assertActive(session);
      progress = { ...progress, status: 'completed' };
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'INTERNAL_ERROR';
      if (code === 'CANCELLED') {
        progress = { ...progress, status: 'cancelled', error: undefined };
        return;
      }
      const failed = records.filter((record) => record.translatedText === undefined).length;
      progress = {
        ...progress,
        status: progress.translatedSegments > 0 ? 'partial' : 'error',
        failedSegments: progress.failedSegments + failed,
        error:
          code === 'STALE_SESSION'
            ? 'The page navigated before translation completed.'
            : 'Some page text could not be translated.',
      };
    }
  }

  function scheduleDynamicTranslation(mutations: MutationRecord[]): void {
    const session = currentSession;
    if (!session || !session.autoTranslateDynamicContent || session.cancelled) return;
    let hasExternalChange = false;
    for (const mutation of mutations) {
      if (mutation.type !== 'characterData') {
        hasExternalChange = true;
        continue;
      }
      const node = mutation.target as Text;
      if (selfMutatedNodes.has(node)) {
        selfMutatedNodes.delete(node);
        continue;
      }
      const existing = recordsByNode.get(node);
      if (existing) {
        recordsByNode.delete(node);
        recordsById.delete(existing.segment.id);
      }
      hasExternalChange = true;
    }
    if (!hasExternalChange) return;
    if (observerTimer !== undefined) clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      observerTimer = undefined;
      if (currentSession?.id !== session.id || session.cancelled) return;
      void translateDiscovered(session, discover());
    }, 350);
  }

  function startObserver(session: Session): void {
    if (!session.autoTranslateDynamicContent || !document.body) return;
    observer = new MutationObserver(scheduleDynamicTranslation);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  async function startTranslation(payload: {
    sessionId: string;
    sourceLanguage: string;
    targetLanguage: string;
    glossaryVersion: number;
    glossary: GlossaryEntry[];
    autoTranslateDynamicContent: boolean;
  }): Promise<void> {
    restorePage();
    const session: Session = {
      id: payload.sessionId,
      sourceLanguage: payload.sourceLanguage,
      targetLanguage: payload.targetLanguage,
      glossaryVersion: payload.glossaryVersion,
      glossary: payload.glossary,
      autoTranslateDynamicContent: payload.autoTranslateDynamicContent,
      navigationId: location.href,
      cancelled: false,
    };
    currentSession = session;
    progress = {
      sessionId: session.id,
      status: 'discovering',
      discoveredSegments: 0,
      translatedSegments: 0,
      failedSegments: 0,
      targetLanguage: session.targetLanguage,
      navigationId: session.navigationId,
    };
    const records = discover();
    if (records.length === 0) progress = { ...progress, status: 'completed' };
    await translateDiscovered(session, records);
    if (currentSession?.id === session.id && !session.cancelled) startObserver(session);
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
      case 'CANCEL_PAGE_TRANSLATION':
        if (currentSession?.id === parsed.data.payload.sessionId) {
          currentSession.cancelled = true;
          stopObserver();
          progress = { ...progress, status: 'cancelled' };
        }
        return Promise.resolve(progressResponse(requestId));
      case 'RESTORE_PAGE':
        restorePage();
        return Promise.resolve(progressResponse(requestId));
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
});
