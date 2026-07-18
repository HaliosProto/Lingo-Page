import {
  createElement,
  StrictMode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createRequestId } from '@translation/shared-config';
import type { TranslationSessionBundle } from '@translation/shared-types';
import { extensionResponseSchema } from '@translation/shared-validation';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import {
  beginTranslatedCopySiteAccessRequest,
  TRANSLATED_COPY_ACCESS_DENIED,
  TRANSLATED_COPY_ACCESS_EXPLANATION,
} from '../../src/translated-copy-access';
import '../../src/ui/global.css';
import './style.css';

function safeSourceLabel(value: string): string {
  const url = new URL(value);
  return `${url.hostname}${url.pathname}`;
}

function directionForLanguage(language: string): 'auto' | 'ltr' | 'rtl' {
  if (language === 'auto') return 'auto';
  return /^(ar|fa|he|ur)(-|$)/u.test(language) ? 'rtl' : 'ltr';
}

function snapshotIsComplete(bundle: TranslationSessionBundle): boolean {
  const segmentIds = new Set(bundle.segments.map((segment) => segment.id));
  return bundle.comparisonSnapshot.nodes.every(
    (node) => node.kind !== 'text' || !node.segmentId || segmentIds.has(node.segmentId),
  );
}

function ComparisonDocument({
  bundle,
  translated,
}: {
  bundle: TranslationSessionBundle;
  translated: boolean;
}) {
  const segments = useMemo(
    () => new Map(bundle.segments.map((segment) => [segment.id, segment])),
    [bundle],
  );
  const children = useMemo(() => {
    const result = new Map<number, number[]>();
    bundle.comparisonSnapshot.nodes.forEach((node, index) => {
      if (node.parentIndex === undefined) return;
      result.set(node.parentIndex, [...(result.get(node.parentIndex) ?? []), index]);
    });
    return result;
  }, [bundle]);

  const renderNode = (index: number): ReactNode => {
    const node = bundle.comparisonSnapshot.nodes[index];
    if (!node) return null;
    if (node.kind === 'text') {
      const segment = node.segmentId ? segments.get(node.segmentId) : undefined;
      const value = segment
        ? translated
          ? (segment.translatedText ?? segment.originalText)
          : segment.originalText
        : (node.text ?? '');
      return (
        <span className="snapshot-text" dir="auto" key={`text-${index}`}>
          {value}
        </span>
      );
    }

    const attributes = node.attributes;
    const props: Record<string, unknown> = {
      key: `element-${index}`,
      className: `snapshot-${node.tag}`,
    };
    if (attributes?.dir) props.dir = attributes.dir;
    if (attributes?.lang) props.lang = attributes.lang;
    if (attributes?.title) props.title = attributes.title;
    if (attributes?.ariaLabel) props['aria-label'] = attributes.ariaLabel;
    if (node.tag === 'a' && attributes?.href) {
      props.href = attributes.href;
      props.target = '_blank';
      props.rel = 'noreferrer';
    }
    if (node.tag === 'img') {
      if (attributes?.src) props.src = attributes.src;
      props.alt = attributes?.alt ?? '';
      props.loading = 'lazy';
      props.referrerPolicy = 'no-referrer';
    }
    if (node.tag === 'button') {
      props.type = 'button';
      props.disabled = true;
      props['aria-disabled'] = 'true';
    }
    if (attributes?.rowSpan) props.rowSpan = attributes.rowSpan;
    if (attributes?.colSpan) props.colSpan = attributes.colSpan;
    if (node.tag === 'ol' && attributes?.listStart !== undefined) {
      props.start = attributes.listStart;
    }
    return createElement(
      node.tag,
      props,
      ...(children.get(index) ?? []).map((childIndex) => renderNode(childIndex)),
    );
  };

  return <div className="snapshot-document">{renderNode(bundle.comparisonSnapshot.rootIndex)}</div>;
}

function ComparisonApp() {
  const [bundle, setBundle] = useState<TranslationSessionBundle>();
  const [error, setError] = useState<string>();
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [splitPercent, setSplitPercent] = useState(50);
  const [swapped, setSwapped] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Synchronized scrolling is on.');
  const originalPane = useRef<HTMLDivElement>(null);
  const translationPane = useRef<HTMLDivElement>(null);
  const requestedSession = useRef(false);
  const syncing = useRef(false);
  const dragging = useRef(false);
  const deniedTranslatedCopyOrigins = useRef(new Set<string>());
  const lastScrolled = useRef<'original' | 'translation'>('original');
  const animationFrame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (requestedSession.current) return;
    requestedSession.current = true;
    const token = location.hash.slice(1);
    history.replaceState(null, '', location.pathname);
    if (!/^cmp_[a-f0-9]{32}$/u.test(token)) {
      setError('This comparison session is invalid or has expired.');
      return;
    }
    void browser.runtime
      .sendMessage({
        version: 1,
        requestId: createRequestId(),
        type: 'GET_COMPARISON_SESSION',
        payload: { token },
      })
      .then((raw) => extensionResponseSchema.parse(raw))
      .then((response) => {
        if (response.type === 'COMPARISON_SESSION' && snapshotIsComplete(response.payload.bundle)) {
          setBundle(response.payload.bundle);
        } else if (response.type === 'MESSAGE_ERROR') {
          setError(response.payload.message);
        } else {
          setError('This comparison session is unavailable.');
        }
      })
      .catch(() => setError('This comparison session is unavailable.'));
  }, []);

  useEffect(() => {
    void browser.runtime
      .sendMessage({
        version: 1,
        requestId: createRequestId(),
        type: 'GET_SETTINGS',
        payload: {},
      })
      .then((raw) => extensionResponseSchema.parse(raw))
      .then((response) => {
        if (response.type !== 'SETTINGS') return;
        const { theme, reducedMotion } = response.payload.settings;
        if (theme === 'system') delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = theme;
        if (reducedMotion) document.documentElement.dataset.reducedMotion = 'true';
        else delete document.documentElement.dataset.reducedMotion;
      })
      .catch(() => undefined);
  }, []);

  useEffect(
    () => () => {
      if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current);
    },
    [],
  );

  const translatedCount = useMemo(
    () => bundle?.segments.filter((segment) => segment.translatedText).length ?? 0,
    [bundle],
  );

  function alignPanes(source: HTMLDivElement, target: HTMLDivElement): void {
    const sourceRange = Math.max(1, source.scrollHeight - source.clientHeight);
    const targetRange = Math.max(0, target.scrollHeight - target.clientHeight);
    target.scrollTop = (source.scrollTop / sourceRange) * targetRange;
  }

  function synchronize(from: 'original' | 'translation'): void {
    lastScrolled.current = from;
    if (!syncEnabled || syncing.current) return;
    const source = from === 'original' ? originalPane.current : translationPane.current;
    const target = from === 'original' ? translationPane.current : originalPane.current;
    if (!source || !target) return;
    syncing.current = true;
    if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current);
    animationFrame.current = requestAnimationFrame(() => {
      alignPanes(source, target);
      animationFrame.current = requestAnimationFrame(() => {
        syncing.current = false;
        animationFrame.current = undefined;
      });
    });
  }

  function toggleSynchronization(): void {
    const next = !syncEnabled;
    setSyncEnabled(next);
    if (!next) {
      setStatusMessage('Synchronized scrolling is off. Each pane now scrolls independently.');
      return;
    }
    const source =
      lastScrolled.current === 'original' ? originalPane.current : translationPane.current;
    const target =
      lastScrolled.current === 'original' ? translationPane.current : originalPane.current;
    if (source && target) alignPanes(source, target);
    setStatusMessage('Synchronized scrolling is on. The panes were realigned.');
  }

  function updateDivider(clientX: number, container: HTMLElement): number {
    const bounds = container.getBoundingClientRect();
    const next = ((clientX - bounds.left) / bounds.width) * 100;
    const bounded = Math.min(75, Math.max(25, Math.round(next)));
    setSplitPercent(bounded);
    return bounded;
  }

  function onDividerPointerDown(event: PointerEvent<HTMLDivElement>): void {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateDivider(event.clientX, event.currentTarget.parentElement!);
  }

  function onDividerPointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!dragging.current) return;
    updateDivider(event.clientX, event.currentTarget.parentElement!);
  }

  function onDividerPointerUp(event: PointerEvent<HTMLDivElement>): void {
    dragging.current = false;
    const next = updateDivider(event.clientX, event.currentTarget.parentElement!);
    event.currentTarget.releasePointerCapture(event.pointerId);
    setStatusMessage(`Pane divider set to ${next}/${100 - next}.`);
  }

  function onDividerPointerCancel(event: PointerEvent<HTMLDivElement>): void {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onDividerKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    setSplitPercent((current) => {
      if (event.key === 'Home') return 50;
      return Math.min(75, Math.max(25, current + (event.key === 'ArrowLeft' ? -2 : 2)));
    });
    setStatusMessage(
      event.key === 'Home' ? 'Pane widths reset to 50/50.' : 'Pane divider adjusted with keyboard.',
    );
  }

  async function openTranslatedCopy(): Promise<void> {
    if (!bundle) return;
    const access = beginTranslatedCopySiteAccessRequest(
      bundle.navigationUrl,
      browser.permissions,
      deniedTranslatedCopyOrigins.current,
    );
    if (access.status === 'unsupported') {
      setStatusMessage('Translated copies are available only for HTTP or HTTPS pages.');
      return;
    }
    if (access.status === 'previously-denied') {
      setStatusMessage(TRANSLATED_COPY_ACCESS_DENIED);
      return;
    }
    const siteAccessRequest = access.request;
    setStatusMessage('Opening translated copy…');
    try {
      const siteAccess = await siteAccessRequest;
      if (!siteAccess.granted) {
        setStatusMessage(TRANSLATED_COPY_ACCESS_DENIED);
        return;
      }
      const response = extensionResponseSchema.parse(
        await browser.runtime.sendMessage({
          version: 1,
          requestId: createRequestId(),
          type: 'OPEN_TRANSLATED_COPY_FROM_BUNDLE',
          payload: { bundle },
        }),
      );
      if (response.type === 'TRANSLATED_COPY_OPENED') {
        setStatusMessage('Translated copy opened with the saved translation.');
      } else if (response.type === 'MESSAGE_ERROR') {
        setStatusMessage(response.payload.message);
      }
    } catch {
      setStatusMessage('The translated copy could not reuse this comparison session.');
    }
  }

  async function closeComparison(): Promise<void> {
    const tab = await browser.tabs.getCurrent();
    if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
  }

  if (error) {
    return (
      <main className="comparison-error" role="alert">
        <h1>Comparison unavailable</h1>
        <p>{error}</p>
      </main>
    );
  }
  if (!bundle) return <main className="comparison-loading">Loading comparison…</main>;

  const original = (
    <section className="comparison-pane-wrap" key="original">
      <h2 id="original-pane-label">Original</h2>
      <div
        id="original-pane"
        className="comparison-pane"
        ref={originalPane}
        role="region"
        aria-labelledby="original-pane-label"
        tabIndex={0}
        dir={directionForLanguage(bundle.sourceLanguage)}
        onScroll={() => synchronize('original')}
      >
        <ComparisonDocument bundle={bundle} translated={false} />
      </div>
    </section>
  );
  const translation = (
    <section className="comparison-pane-wrap" key="translation">
      <h2 id="translation-pane-label">Translation</h2>
      <div
        id="translation-pane"
        className="comparison-pane"
        ref={translationPane}
        role="region"
        aria-labelledby="translation-pane-label"
        tabIndex={0}
        dir={directionForLanguage(bundle.targetLanguage)}
        onScroll={() => synchronize('translation')}
      >
        <ComparisonDocument bundle={bundle} translated />
      </div>
    </section>
  );

  const paneStyle = {
    gridTemplateColumns: `${splitPercent}% 10px ${100 - splitPercent}%`,
  } as CSSProperties;

  return (
    <main className="comparison-shell">
      <a className="skip-link" href="#original-pane">
        Skip to original
      </a>
      <a className="skip-link skip-link-secondary" href="#translation-pane">
        Skip to translation
      </a>
      <header className="comparison-toolbar">
        <div className="comparison-identity">
          <p className="eyebrow">Full-page translation comparison</p>
          <h1 dir="auto">{bundle.pageTitle || 'Translated page'}</h1>
          <p className="comparison-source" dir="ltr">
            {safeSourceLabel(bundle.navigationUrl)}
          </p>
        </div>
        <div className="comparison-summary" aria-label="Translation summary">
          <span>
            {bundle.sourceLanguage.toUpperCase()} → {bundle.targetLanguage.toUpperCase()}
          </span>
          <span>
            {translatedCount} of {bundle.segments.length} translated
          </span>
          <span>{bundle.partial ? 'Partial session' : 'Complete session'}</span>
        </div>
        <div className="comparison-actions" aria-label="Comparison controls">
          <button type="button" aria-pressed={syncEnabled} onClick={toggleSynchronization}>
            {syncEnabled ? 'Scrolling linked' : 'Scrolling unlinked'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSwapped((current) => !current);
              setStatusMessage('Original and translation sides were swapped.');
            }}
          >
            Swap sides
          </button>
          <button
            type="button"
            onClick={() => {
              setSplitPercent(50);
              setStatusMessage('Pane widths reset to 50/50.');
            }}
          >
            Reset layout
          </button>
          <a href={bundle.navigationUrl} target="_blank" rel="noreferrer">
            Open source page
          </a>
          <span className="comparison-permission-note">{TRANSLATED_COPY_ACCESS_EXPLANATION}</span>
          <button type="button" onClick={() => void openTranslatedCopy()}>
            Open translated copy
          </button>
          <button type="button" onClick={() => void closeComparison()}>
            Close comparison
          </button>
        </div>
      </header>

      <p className="comparison-status" role="status" aria-live="polite">
        {statusMessage}
      </p>

      <div className="comparison-workspace" style={paneStyle}>
        {swapped ? translation : original}
        <div
          className="comparison-divider"
          role="separator"
          aria-label="Resize comparison panes"
          aria-orientation="vertical"
          aria-valuemin={25}
          aria-valuemax={75}
          aria-valuenow={splitPercent}
          tabIndex={0}
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
          onPointerUp={onDividerPointerUp}
          onPointerCancel={onDividerPointerCancel}
          onKeyDown={onDividerKeyDown}
        >
          <span aria-hidden="true" />
        </div>
        {swapped ? original : translation}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ComparisonApp />
    </ErrorBoundary>
  </StrictMode>,
);
