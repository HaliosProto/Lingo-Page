import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import type { HealthResponse, TabStatus } from '@translation/shared-types';
import { extensionResponseSchema, type ExtensionResponse } from '@translation/shared-validation';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { t } from '../../src/i18n/messages';
import '../../src/ui/global.css';

function createRequestId(): string {
  return `req_popup_${crypto.randomUUID().replaceAll('-', '')}`;
}

function parseResponse(value: unknown): ExtensionResponse {
  return extensionResponseSchema.parse(value);
}

async function sendMessage(message: unknown): Promise<ExtensionResponse> {
  const response = await browser.runtime.sendMessage(message);
  return parseResponse(response);
}

function getSupportLabel(status: TabStatus | null): string {
  if (!status) return t('loading');
  if (status.support.status === 'supported') return t('supportedPage');
  if (status.support.reason === 'missing-url') return t('unknownPage');
  return t('unsupportedPage');
}

function PopupApp() {
  const [tabStatus, setTabStatus] = useState<TabStatus | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        const tabId = tab?.id;
        if (tabId === undefined) {
          throw new Error(t('noActiveTab'));
        }

        const [statusResponse, healthResponse] = await Promise.all([
          sendMessage({
            version: 1,
            requestId: createRequestId(),
            type: 'GET_TAB_STATUS',
            payload: { tabId },
          }),
          sendMessage({
            version: 1,
            requestId: createRequestId(),
            type: 'GET_API_HEALTH',
            payload: {},
          }),
        ]);

        if (!active) return;
        if (statusResponse.type === 'TAB_STATUS') {
          setTabStatus(statusResponse.payload);
        }
        if (healthResponse.type === 'API_HEALTH' && healthResponse.payload.health) {
          setHealth(healthResponse.payload.health);
        }
        if (healthResponse.type === 'MESSAGE_ERROR') {
          setError(healthResponse.payload.message);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : t('unexpectedError'));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function openOptions() {
    try {
      await sendMessage({
        version: 1,
        requestId: createRequestId(),
        type: 'OPEN_OPTIONS',
        payload: {},
      });
    } catch {
      setError(t('settingsUnavailable'));
    }
  }

  return (
    <main className="popup-shell" dir="auto">
      <header className="brand-row">
        <div>
          <p className="eyebrow">{t('productCategory')}</p>
          <h1>{t('productName')}</h1>
        </div>
        <span className="version-pill">{t('shellLabel')}</span>
      </header>

      <section className="status-panel" aria-live="polite">
        <div className="status-icon" aria-hidden="true">
          ↗
        </div>
        <div>
          <p className="status-title">{getSupportLabel(tabStatus)}</p>
          <p className="status-copy">
            {tabStatus?.url ? new URL(tabStatus.url).hostname : t('checkingCurrentTab')}
          </p>
        </div>
      </section>

      <section className="field-grid" aria-label={t('translationSettings')}>
        <div className="field-row">
          <span>{t('sourceLanguage')}</span>
          <strong>{t('detectedLanguagePlaceholder')}</strong>
        </div>
        <div className="field-row">
          <span>{t('targetLanguage')}</span>
          <strong>{t('targetLanguagePlaceholder')}</strong>
        </div>
      </section>

      <button className="primary-button" type="button" disabled title={t('milestoneTwoTooltip')}>
        {t('translatePage')}
      </button>
      <p className="help-copy">{t('milestoneTwoMessage')}</p>

      <section className="connection-row" aria-live="polite">
        <span className={`status-dot ${health ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
        <span>{health ? t('backendConnected') : t('backendUnavailable')}</span>
        {loading && <span className="loading-label">{t('checking')}</span>}
      </section>

      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      <footer className="footer-row">
        <span>{t('privacyStatus')}</span>
        <button className="text-button" type="button" onClick={() => void openOptions()}>
          {t('settings')}
        </button>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PopupApp />
    </ErrorBoundary>
  </StrictMode>,
);
