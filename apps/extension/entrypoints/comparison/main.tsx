import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createRequestId } from '@translation/shared-config';
import type { TranslationSessionBundle } from '@translation/shared-types';
import { extensionResponseSchema } from '@translation/shared-validation';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import '../../src/ui/global.css';
import './style.css';

function safeSourceLabel(value: string): string {
  const url = new URL(value);
  return `${url.hostname}${url.pathname}`;
}

function ComparisonApp() {
  const [bundle, setBundle] = useState<TranslationSessionBundle>();
  const [error, setError] = useState<string>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState<string>();
  const segmentRefs = useRef<Array<HTMLElement | null>>([]);
  const requestedSession = useRef(false);

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
        if (response.type === 'COMPARISON_SESSION') setBundle(response.payload.bundle);
        else if (response.type === 'MESSAGE_ERROR') setError(response.payload.message);
        else setError('This comparison session is unavailable.');
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

  const translatedCount = useMemo(
    () => bundle?.segments.filter((segment) => segment.translatedText).length ?? 0,
    [bundle],
  );

  function move(delta: number): void {
    if (!bundle?.segments.length) return;
    const next = Math.min(bundle.segments.length - 1, Math.max(0, activeIndex + delta));
    setActiveIndex(next);
    segmentRefs.current[next]?.focus();
    segmentRefs.current[next]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function copy(id: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
    } catch {
      setCopied(undefined);
    }
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

  return (
    <main className="comparison-shell">
      <header className="comparison-header">
        <div>
          <p className="eyebrow">Translation comparison</p>
          <h1 dir="auto">{bundle.pageTitle || 'Translated page'}</h1>
          <p className="comparison-source" dir="ltr">
            {safeSourceLabel(bundle.navigationUrl)}
          </p>
        </div>
        <a className="secondary-link" href={bundle.navigationUrl} target="_blank" rel="noreferrer">
          Open source page
        </a>
      </header>

      <section className="comparison-summary" aria-label="Translation summary">
        <span>
          {bundle.sourceLanguage.toUpperCase()} → {bundle.targetLanguage.toUpperCase()}
        </span>
        <span>
          {translatedCount} of {bundle.segments.length} translated
        </span>
        <span>{bundle.partial ? 'Partial session' : 'Complete session'}</span>
      </section>

      <nav className="comparison-nav" aria-label="Segment navigation">
        <button type="button" onClick={() => move(-1)} disabled={activeIndex === 0}>
          Previous
        </button>
        <span>
          {activeIndex + 1} / {bundle.segments.length}
        </span>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={activeIndex >= bundle.segments.length - 1}
        >
          Next
        </button>
      </nav>

      <div className="comparison-list">
        {bundle.segments.map((segment, index) => (
          <article
            className="segment-pair"
            key={segment.id}
            tabIndex={0}
            ref={(node) => {
              segmentRefs.current[index] = node;
            }}
            onFocus={() => setActiveIndex(index)}
            aria-label={`Segment ${index + 1}: ${segment.status}`}
          >
            <section>
              <div className="segment-heading">
                <h2>Original</h2>
                <button
                  type="button"
                  onClick={() => void copy(`${segment.id}:original`, segment.originalText)}
                >
                  {copied === `${segment.id}:original` ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p dir="auto">{segment.originalText}</p>
            </section>
            <section>
              <div className="segment-heading">
                <h2>Translation</h2>
                {segment.translatedText && (
                  <button
                    type="button"
                    onClick={() => void copy(`${segment.id}:translation`, segment.translatedText!)}
                  >
                    {copied === `${segment.id}:translation` ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              <p dir="auto" className={segment.translatedText ? undefined : 'unavailable-copy'}>
                {segment.translatedText ?? `Not translated · ${segment.status}`}
              </p>
            </section>
          </article>
        ))}
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
