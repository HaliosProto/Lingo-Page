import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import {
  createRequestId,
  createSessionId,
  defaultSettings,
  developmentLanguages,
} from '@translation/shared-config';
import type {
  AppSettings,
  HealthResponse,
  TabStatus,
  TranslationProgress,
} from '@translation/shared-types';
import { extensionResponseSchema, type ExtensionResponse } from '@translation/shared-validation';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import '../../src/ui/global.css';

async function sendMessage(message: unknown): Promise<ExtensionResponse> {
  return extensionResponseSchema.parse(await browser.runtime.sendMessage(message));
}

function supportLabel(status: TabStatus | null): string {
  if (!status) return 'Checking this page…';
  if (status.support.status === 'supported') return 'Ready to translate';
  if (status.support.reason === 'sensitive-page')
    return 'Sensitive page — translate only if intended';
  if (status.support.reason === 'domain-excluded') return 'This domain is excluded';
  return 'This page cannot be translated';
}

function progressLabel(progress: TranslationProgress): string {
  if (progress.status === 'idle') return 'No active translation';
  if (progress.status === 'discovering') return 'Finding page text…';
  if (progress.status === 'translating') {
    return `Translated ${progress.translatedSegments} of ${progress.discoveredSegments}`;
  }
  if (progress.status === 'completed') {
    return `Translated ${progress.translatedSegments} text segments`;
  }
  if (progress.status === 'cancelled') return 'Translation cancelled';
  if (progress.status === 'partial') return 'Page partially translated';
  return progress.error ?? 'Translation failed';
}

function PopupApp() {
  const [tabId, setTabId] = useState<number>();
  const [tabStatus, setTabStatus] = useState<TabStatus | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [progress, setProgress] = useState<TranslationProgress>({
    status: 'idle',
    discoveredSegments: 0,
    translatedSegments: 0,
    failedSegments: 0,
  });
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);

  const refreshProgress = useCallback(async (activeTabId: number) => {
    const response = await sendMessage({
      version: 1,
      requestId: createRequestId(),
      type: 'GET_TRANSLATION_PROGRESS',
      payload: { tabId: activeTabId },
    });
    if (response.type === 'TRANSLATION_PROGRESS') setProgress(response.payload.progress);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const activeTab = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
        if (activeTab?.id === undefined) throw new Error('No active browser tab is available.');
        const activeTabId = activeTab.id;
        setTabId(activeTabId);
        const [statusResponse, healthResponse, settingsResponse] = await Promise.all([
          sendMessage({
            version: 1,
            requestId: createRequestId(),
            type: 'GET_TAB_STATUS',
            payload: { tabId: activeTabId },
          }),
          sendMessage({
            version: 1,
            requestId: createRequestId(),
            type: 'GET_API_HEALTH',
            payload: {},
          }),
          sendMessage({
            version: 1,
            requestId: createRequestId(),
            type: 'GET_SETTINGS',
            payload: {},
          }),
        ]);
        if (!active) return;
        if (statusResponse.type === 'TAB_STATUS') {
          setTabStatus(statusResponse.payload);
          setProgress(statusResponse.payload.progress);
        }
        if (healthResponse.type === 'API_HEALTH') setHealth(healthResponse.payload.health);
        if (settingsResponse.type === 'SETTINGS') setSettings(settingsResponse.payload.settings);
        if (healthResponse.type === 'MESSAGE_ERROR') setError(healthResponse.payload.message);
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : 'The extension could not load.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (tabId === undefined) return;
    const timer = setInterval(() => void refreshProgress(tabId).catch(() => undefined), 500);
    return () => clearInterval(timer);
  }, [refreshProgress, tabId]);

  async function updateSettings(next: AppSettings): Promise<void> {
    setSettings(next);
    const response = await sendMessage({
      version: 1,
      requestId: createRequestId(),
      type: 'UPDATE_SETTINGS',
      payload: { settings: next },
    });
    if (response.type === 'SETTINGS') setSettings(response.payload.settings);
  }

  async function startTranslation(): Promise<void> {
    if (tabId === undefined) return;
    setWorking(true);
    setError(undefined);
    const sessionId = createSessionId();
    try {
      const response = await sendMessage({
        version: 1,
        requestId: createRequestId(),
        type: 'START_PAGE_TRANSLATION',
        payload: {
          tabId,
          sessionId,
          sourceLanguage: settings.sourceLanguage,
          targetLanguage: settings.defaultTargetLanguage,
          glossaryVersion: settings.glossaryVersion,
          glossary: settings.glossary,
          autoTranslateDynamicContent: settings.autoTranslateDynamicContent,
        },
      });
      if (response.type === 'TRANSLATION_PROGRESS') setProgress(response.payload.progress);
      if (response.type === 'MESSAGE_ERROR') setError(response.payload.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Translation could not start.');
    } finally {
      setWorking(false);
    }
  }

  async function cancelTranslation(): Promise<void> {
    if (tabId === undefined || !progress.sessionId) return;
    const response = await sendMessage({
      version: 1,
      requestId: createRequestId(),
      type: 'CANCEL_PAGE_TRANSLATION',
      payload: { tabId, sessionId: progress.sessionId },
    });
    if (response.type === 'TRANSLATION_PROGRESS') setProgress(response.payload.progress);
  }

  async function restorePage(): Promise<void> {
    if (tabId === undefined) return;
    const response = await sendMessage({
      version: 1,
      requestId: createRequestId(),
      type: 'RESTORE_PAGE',
      payload: { tabId },
    });
    if (response.type === 'TRANSLATION_PROGRESS') setProgress(response.payload.progress);
  }

  const supported =
    tabStatus?.support.status === 'supported' || tabStatus?.support.status === 'warning';
  const busy = progress.status === 'discovering' || progress.status === 'translating';
  const backendReady = health?.translationEnabled && health.provider.configured;
  const percent = progress.discoveredSegments
    ? Math.round((progress.translatedSegments / progress.discoveredSegments) * 100)
    : 0;

  return (
    <main className="popup-shell" dir="auto">
      <header className="brand-row">
        <div>
          <p className="eyebrow">Private page translation</p>
          <h1>Lingo Page</h1>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          Settings
        </button>
      </header>

      <section className="status-panel" aria-live="polite">
        <div className="status-icon" aria-hidden="true">
          ↗
        </div>
        <div>
          <p className="status-title">{supportLabel(tabStatus)}</p>
          <p className="status-copy">
            {tabStatus?.url?.startsWith('http') ? new URL(tabStatus.url).hostname : 'Current tab'}
          </p>
        </div>
      </section>

      <section className="language-grid" aria-label="Translation languages">
        <label>
          Source
          <select
            value={settings.sourceLanguage}
            disabled={busy}
            onChange={(event) =>
              void updateSettings({ ...settings, sourceLanguage: event.target.value })
            }
          >
            <option value="auto">Detect automatically</option>
            {developmentLanguages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target
          <select
            value={settings.defaultTargetLanguage}
            disabled={busy}
            onChange={(event) =>
              void updateSettings({ ...settings, defaultTargetLanguage: event.target.value })
            }
          >
            {developmentLanguages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="progress-panel" aria-live="polite">
        <div className="progress-copy">
          <strong>{progressLabel(progress)}</strong>
          <span>{percent}%</span>
        </div>
        <progress max="100" value={percent} />
      </section>

      {busy ? (
        <button
          className="secondary-button danger-button"
          type="button"
          onClick={() => void cancelTranslation()}
        >
          Cancel translation
        </button>
      ) : (
        <button
          className="primary-button"
          type="button"
          disabled={!supported || !backendReady || working}
          onClick={() => void startTranslation()}
        >
          {working ? 'Starting…' : 'Translate page'}
        </button>
      )}
      <button
        className="secondary-button"
        type="button"
        disabled={progress.translatedSegments === 0}
        onClick={() => void restorePage()}
      >
        Restore original page
      </button>

      <section className="connection-row" aria-live="polite">
        <span
          className={`status-dot ${backendReady ? 'is-online' : 'is-offline'}`}
          aria-hidden="true"
        />
        <span>
          {backendReady ? `Connected · ${health?.provider.name}` : 'Local service unavailable'}
        </span>
      </section>

      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <footer className="footer-row">
        <span>
          {settings.privacyMode ? 'Privacy mode on' : 'Page text sent only when requested'}
        </span>
        <span>v{browser.runtime.getManifest().version}</span>
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
