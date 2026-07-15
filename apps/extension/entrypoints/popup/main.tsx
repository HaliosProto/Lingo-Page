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
  ProviderDefinition,
  TabStatus,
  TranslationFailure,
  TranslationProgress,
} from '@translation/shared-types';
import { extensionResponseSchema, type ExtensionResponse } from '@translation/shared-validation';
import {
  failurePresentation,
  progressLabel,
  safeFailureDiagnostics,
  type FailureActionId,
} from '../../src/translation-failures';
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

function diagnosticLabel(key: string): string {
  return (
    {
      errorCode: 'Error code',
      provider: 'Provider',
      httpStatus: 'HTTP status',
      requestId: 'Request ID',
      translatedSections: 'Translated sections',
      totalSections: 'Total sections',
      failedSections: 'Failed sections',
      queuedSections: 'Queued sections',
      failedBatches: 'Failed batches',
      retryAttempts: 'Retry attempts',
      retryAfterSeconds: 'Retry after (seconds)',
      automaticRetry: 'Automatic retry',
    }[key] ?? key
  );
}

function PopupApp() {
  const [tabId, setTabId] = useState<number>();
  const [tabStatus, setTabStatus] = useState<TabStatus | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [progress, setProgress] = useState<TranslationProgress>({
    status: 'idle',
    discoveredSegments: 0,
    translatedSegments: 0,
    failedSegments: 0,
  });
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);

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
    if (settings.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const activeTab = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
        if (activeTab?.id === undefined) throw new Error('No active browser tab is available.');
        const activeTabId = activeTab.id;
        setTabId(activeTabId);
        const [statusResponse, healthResponse, settingsResponse, providersResponse] =
          await Promise.all([
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
            sendMessage({
              version: 1,
              requestId: createRequestId(),
              type: 'GET_PROVIDERS',
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
        if (providersResponse.type === 'PROVIDERS')
          setProviders(providersResponse.payload.providers);
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
          providerId: settings.providerId,
          modelId: settings.modelId,
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

  async function continueTranslation(useSmallerBatches = false): Promise<void> {
    if (tabId === undefined || !progress.sessionId) return;
    setWorking(true);
    setError(undefined);
    try {
      const response = await sendMessage({
        version: 1,
        requestId: createRequestId(),
        type: 'CONTINUE_PAGE_TRANSLATION',
        payload: {
          tabId,
          sessionId: progress.sessionId,
          providerId: settings.providerId,
          modelId: settings.modelId,
          useSmallerBatches,
        },
      });
      if (response.type === 'TRANSLATION_PROGRESS') setProgress(response.payload.progress);
      if (response.type === 'MESSAGE_ERROR') setError(response.payload.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Translation could not continue.');
    } finally {
      setWorking(false);
    }
  }

  async function refreshBackend(): Promise<void> {
    setWorking(true);
    setError(undefined);
    try {
      const [healthResponse, providersResponse] = await Promise.all([
        sendMessage({
          version: 1,
          requestId: createRequestId(),
          type: 'GET_API_HEALTH',
          payload: {},
        }),
        sendMessage({
          version: 1,
          requestId: createRequestId(),
          type: 'GET_PROVIDERS',
          payload: {},
        }),
      ]);
      if (healthResponse.type === 'API_HEALTH') setHealth(healthResponse.payload.health);
      if (providersResponse.type === 'PROVIDERS') {
        setProviders(providersResponse.payload.providers);
      }
      if (healthResponse.type === 'MESSAGE_ERROR') setError(healthResponse.payload.message);
      if (providersResponse.type === 'MESSAGE_ERROR') setError(providersResponse.payload.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The local service is unavailable.');
    } finally {
      setWorking(false);
    }
  }

  function handleFailureAction(action: FailureActionId): void {
    setDiagnosticsCopied(false);
    switch (action) {
      case 'automatic-retry':
        return;
      case 'retry-failed':
      case 'continue':
      case 'retry-later':
        void continueTranslation();
        return;
      case 'continue-smaller':
        void continueTranslation(true);
        return;
      case 'retry-connection':
        void refreshBackend();
        return;
      case 'start-again':
        void startTranslation();
        return;
      case 'change-provider':
        document.querySelector<HTMLSelectElement>('[data-provider-select]')?.focus();
        return;
      case 'restore':
        void restorePage();
    }
  }

  async function copyDiagnostics(
    failure: TranslationFailure,
    providerName?: string,
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(safeFailureDiagnostics(failure, providerName), null, 2),
      );
      setDiagnosticsCopied(true);
    } catch {
      setDiagnosticsCopied(false);
    }
  }

  const supported =
    tabStatus?.support.status === 'supported' || tabStatus?.support.status === 'warning';
  const busy = ['discovering', 'translating', 'paused', 'retrying'].includes(progress.status);
  const selectableProviders = providers.filter(
    (provider) => provider.enabled && provider.configured,
  );
  const activeProvider = providers.find((provider) => provider.id === settings.providerId);
  const backendReady = Boolean(
    health?.translationEnabled &&
    activeProvider?.enabled &&
    activeProvider.configured &&
    activeProvider.availableModels.some((model) => model.id === settings.modelId && model.enabled),
  );
  const providerLabel = backendReady
    ? `${activeProvider?.displayName ?? settings.providerId} - local backend`
    : activeProvider?.status === 'unconfigured'
      ? `${activeProvider.displayName} is not configured`
      : 'Local service or selected provider unavailable';
  const percent = progress.discoveredSegments
    ? Math.round((progress.translatedSegments / progress.discoveredSegments) * 100)
    : 0;
  const failure = progress.failure;
  const failureProvider = failure?.metadata.providerId
    ? providers.find((provider) => provider.id === failure.metadata.providerId)
    : undefined;
  const failureDetails = failure
    ? failurePresentation(failure, failureProvider?.displayName)
    : undefined;
  const diagnosticEntries = failure
    ? Object.entries(safeFailureDiagnostics(failure, failureProvider?.displayName))
    : [];

  return (
    <main className="popup-shell" dir="auto">
      <header className="brand-row">
        <div>
          <p className="eyebrow">Private page translation</p>
          <h1>Lingo Page</h1>
        </div>
        <div className="header-actions">
          <span className="version-pill">LOCAL · v{browser.runtime.getManifest().version}</span>
          <button
            className="text-button"
            type="button"
            onClick={() => void browser.runtime.openOptionsPage()}
          >
            Settings
          </button>
        </div>
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
          Provider
          <select
            data-provider-select
            value={
              selectableProviders.some((provider) => provider.id === settings.providerId)
                ? settings.providerId
                : ''
            }
            disabled={busy}
            onChange={(event) => {
              const provider = selectableProviders.find((item) => item.id === event.target.value);
              const modelId =
                provider?.defaultModel ??
                provider?.availableModels.find((model) => model.enabled)?.id;
              if (provider && modelId)
                void updateSettings({ ...settings, providerId: provider.id, modelId });
            }}
          >
            {!selectableProviders.some((provider) => provider.id === settings.providerId) && (
              <option value="">Select a configured provider</option>
            )}
            {selectableProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Model
          <select
            value={settings.modelId}
            disabled={busy || !activeProvider}
            onChange={(event) => void updateSettings({ ...settings, modelId: event.target.value })}
          >
            {(activeProvider?.availableModels ?? [])
              .filter((model) => model.enabled)
              .map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
          </select>
        </label>
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
        <div className="progress-metrics" aria-label="Translation queue status">
          <span>{progress.translatedSegments} translated</span>
          <span>{progress.queuedSegments ?? 0} queued</span>
          <span>{progress.waitingSegments ?? 0} waiting</span>
          <span>{progress.retryingSegments ?? 0} retrying</span>
          <span>{progress.failedSegments} failed</span>
        </div>
      </section>

      {failure && failureDetails && (
        <section className="failure-panel" role="alert" aria-live="assertive">
          <p className="failure-message">{failureDetails.message}</p>
          {failureDetails.secondaryMessage && (
            <p className="failure-secondary">{failureDetails.secondaryMessage}</p>
          )}
          {failureDetails.actions.length > 0 && (
            <div className="failure-actions">
              {failureDetails.actions.map((action, index) => (
                <button
                  className={index === 0 ? 'primary-button compact-button' : 'secondary-button'}
                  type="button"
                  key={action.id}
                  disabled={working || busy}
                  onClick={() => handleFailureAction(action.id)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          <details className="technical-details">
            <summary>Technical details</summary>
            <dl>
              {diagnosticEntries.map(([label, value]) => (
                <div key={label}>
                  <dt>{diagnosticLabel(label)}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
            <button
              className="text-button"
              type="button"
              onClick={() => void copyDiagnostics(failure, failureProvider?.displayName)}
            >
              {diagnosticsCopied ? 'Diagnostics copied' : 'Copy diagnostics'}
            </button>
          </details>
        </section>
      )}

      {progress.notices?.map((notice) => {
        const noticeDetails = failurePresentation(notice);
        return (
          <section className="notice-panel" key={notice.reason} aria-live="polite">
            <p>{noticeDetails.message}</p>
            {noticeDetails.secondaryMessage && <p>{noticeDetails.secondaryMessage}</p>}
          </section>
        );
      })}

      {busy ? (
        <button
          className="secondary-button danger-button"
          type="button"
          onClick={() => void cancelTranslation()}
        >
          Cancel translation
        </button>
      ) : !failure ? (
        <button
          className="primary-button"
          type="button"
          disabled={!supported || !backendReady || working}
          onClick={() => void startTranslation()}
        >
          {working ? 'Starting…' : 'Translate page'}
        </button>
      ) : null}
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
        <span>{providerLabel}</span>
      </section>
      {activeProvider && <p className="privacy-copy">{activeProvider.privacyNotice}</p>}

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
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
