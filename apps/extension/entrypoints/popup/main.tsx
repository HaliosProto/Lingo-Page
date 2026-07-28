import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
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
  Button,
  Disclosure,
  PermissionRequest,
  ProgressIndicator,
  SegmentedControl,
  StatusCard,
} from '@translation/ui';
import {
  failurePresentation,
  progressLabel,
  safeFailureDiagnostics,
  type FailureActionId,
} from '../../src/translation-failures';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import {
  beginTranslatedCopySiteAccessRequest,
  TRANSLATED_COPY_ACCESS_DENIED,
  TRANSLATED_COPY_ACCESS_EXPLANATION,
  translatedCopyOriginPattern,
  type TranslatedCopySiteAccess,
} from '../../src/translated-copy-access';
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
      failureCategory: 'Failure category',
      requestedCount: 'Requested records',
      returnedValidCount: 'Valid returned records',
      missingCount: 'Missing records',
      duplicateCount: 'Duplicate records',
      unknownCount: 'Unknown records',
      emptyCount: 'Empty records',
      parseFailure: 'Parse failure',
      finishReason: 'Provider finish reason',
      responseTruncated: 'Response truncated',
      splitDepth: 'Split depth',
      smallestAttemptedBatch: 'Smallest attempted batch',
      unresolvedCount: 'Unresolved records',
      inputCharacterCount: 'Input characters',
      estimatedInputTokens: 'Estimated input tokens',
      estimatedOutputTokens: 'Estimated output tokens',
      responseSize: 'Response bytes',
      batchSize: 'Batch size',
      retryHistory: 'Retry history',
    }[key] ?? key
  );
}

function sessionStateLabel(progress: TranslationProgress): string {
  if (progress.recoveryState === 'recovering') return 'Recovering';
  if (progress.recoveryState === 'recovered') return 'Recovered';
  if (progress.lifecycle === 'stale') return 'Changed';
  if (progress.lifecycle === 'complete') return 'Complete';
  if (progress.lifecycle === 'partial') return 'Partial';
  if (progress.lifecycle === 'invalidated') return 'Unavailable';
  if (progress.lifecycle === 'translating') return 'Translating';
  return progress.status === 'cancelled' ? 'Paused' : 'Active';
}

type SessionCommandType =
  | 'SET_PAGE_VIEW'
  | 'SCAN_PAGE_CHANGES'
  | 'UPDATE_CHANGED_SECTIONS'
  | 'REFRESH_TRANSLATION'
  | 'END_TRANSLATION_SESSION';

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
  const [activeSessionCommand, setActiveSessionCommand] = useState<SessionCommandType>();
  const [retrySessionCommand, setRetrySessionCommand] = useState<SessionCommandType>();
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const deniedTranslatedCopyOrigins = useRef(new Set<string>());

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
    if (settings.reducedMotion) document.documentElement.dataset.reducedMotion = 'true';
    else delete document.documentElement.dataset.reducedMotion;
  }, [settings.reducedMotion]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const activeTab = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
        if (activeTab?.id === undefined) throw new Error('No active browser tab is available.');
        const activeTabId = activeTab.id;
        setTabId(activeTabId);
        const [
          statusResponse,
          healthResponse,
          settingsResponse,
          providersResponse,
          deniedOriginsResponse,
        ] = await Promise.all([
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
          sendMessage({
            version: 1,
            requestId: createRequestId(),
            type: 'GET_TRANSLATED_COPY_DENIED_ORIGINS',
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
        if (deniedOriginsResponse.type === 'TRANSLATED_COPY_DENIED_ORIGINS') {
          deniedTranslatedCopyOrigins.current = new Set(deniedOriginsResponse.payload.origins);
        }
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

  async function runSessionCommand(
    type: SessionCommandType,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    if (tabId === undefined || !progress.sessionId) return;
    setWorking(true);
    setActiveSessionCommand(type);
    setRetrySessionCommand(undefined);
    setError(undefined);
    try {
      const response = await sendMessage({
        version: 1,
        requestId: createRequestId(),
        type,
        payload: { tabId, sessionId: progress.sessionId, ...extra },
      });
      if (response.type === 'TRANSLATION_PROGRESS') setProgress(response.payload.progress);
      if (response.type === 'MESSAGE_ERROR') {
        setError(response.payload.message);
        if (type === 'SCAN_PAGE_CHANGES' || type === 'UPDATE_CHANGED_SECTIONS') {
          setRetrySessionCommand(type);
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The session action could not finish.');
      if (type === 'SCAN_PAGE_CHANGES' || type === 'UPDATE_CHANGED_SECTIONS') {
        setRetrySessionCommand(type);
      }
    } finally {
      setWorking(false);
      setActiveSessionCommand(undefined);
    }
  }

  async function openSessionView(type: 'OPEN_TRANSLATED_COPY' | 'OPEN_COMPARISON_VIEW') {
    if (tabId === undefined || !progress.sessionId) return;
    let siteAccessRequest: Promise<TranslatedCopySiteAccess> | undefined;
    let intentRequest: Promise<ExtensionResponse> | undefined;
    if (type === 'OPEN_TRANSLATED_COPY') {
      const navigationUrl = tabStatus?.url ?? '';
      const originPattern = translatedCopyOriginPattern(navigationUrl);
      if (!originPattern) {
        setError('Translated copies are available only for HTTP or HTTPS pages.');
        return;
      }
      if (deniedTranslatedCopyOrigins.current.has(originPattern)) {
        setError(TRANSLATED_COPY_ACCESS_DENIED);
        return;
      }
      intentRequest = sendMessage({
        version: 1,
        requestId: createRequestId(),
        type: 'CREATE_TRANSLATED_COPY_INTENT',
        payload: {
          tabId,
          sessionId: progress.sessionId,
          navigationUrl,
          providerId: settings.providerId,
          modelId: settings.modelId,
        },
      });
      const access = beginTranslatedCopySiteAccessRequest(
        navigationUrl,
        browser.permissions,
        deniedTranslatedCopyOrigins.current,
      );
      if (access.status === 'unsupported') {
        setError('Translated copies are available only for HTTP or HTTPS pages.');
        return;
      }
      if (access.status === 'previously-denied') {
        setError(TRANSLATED_COPY_ACCESS_DENIED);
        return;
      }
      siteAccessRequest = access.request;
    }
    setWorking(true);
    setError(undefined);
    try {
      if (siteAccessRequest) {
        const siteAccess = await siteAccessRequest;
        const intentResponse = await intentRequest;
        if (intentResponse?.type === 'MESSAGE_ERROR') {
          setError(intentResponse.payload.message);
          return;
        }
        if (intentResponse?.type !== 'TRANSLATED_COPY_INTENT_STATUS') {
          setError('The translated-copy action could not be prepared.');
          return;
        }
        if (!siteAccess.granted) {
          await sendMessage({
            version: 1,
            requestId: createRequestId(),
            type: 'DENY_TRANSLATED_COPY_INTENT',
            payload: { intentId: intentResponse.payload.intentId },
          });
          setError(TRANSLATED_COPY_ACCESS_DENIED);
          return;
        }
        const response = await sendMessage({
          version: 1,
          requestId: createRequestId(),
          type: 'RESUME_TRANSLATED_COPY_INTENT',
          payload: { intentId: intentResponse.payload.intentId },
        });
        if (response.type === 'MESSAGE_ERROR') setError(response.payload.message);
        return;
      }
      const response = await sendMessage({
        version: 1,
        requestId: createRequestId(),
        type,
        payload: { tabId, sessionId: progress.sessionId },
      });
      if (response.type === 'MESSAGE_ERROR') setError(response.payload.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The new view could not be opened.');
    } finally {
      setWorking(false);
    }
  }

  function confirmEndSession(): void {
    if (
      !window.confirm('End this translation session? Stored page translations will be discarded.')
    ) {
      return;
    }
    void runSessionCommand('END_TRANSLATION_SESSION');
  }

  function confirmRefresh(): void {
    if (!window.confirm('Refresh the entire page translation? This may use provider quota.'))
      return;
    void runSessionCommand('REFRESH_TRANSLATION', { scope: 'entire-page' });
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
      case 'keep-partial':
        void runSessionCommand('SET_PAGE_VIEW', { displayMode: 'translated' });
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
  const hasSession = Boolean(progress.sessionId && progress.status !== 'idle');
  const activeView = progress.displayMode === 'original' ? 'original' : 'translated';
  const changeSummary = progress.changeScan?.summary ?? progress.changed;
  const translatedCopy = progress.translatedCopy;
  const changedCount = changeSummary
    ? changeSummary.newSegments +
      changeSummary.modifiedSegments +
      changeSummary.removedSegments +
      changeSummary.reorderedSegments +
      changeSummary.uncertainSegments
    : 0;
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
          <Button variant="link" onClick={() => void browser.runtime.openOptionsPage()}>
            Settings
          </Button>
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

      <ProgressIndicator
        className="progress-panel"
        aria-live="polite"
        label={progressLabel(progress)}
        value={percent}
        details={
          <div className="progress-metrics" aria-label="Translation queue status">
            <span>{progress.translatedSegments} translated</span>
            <span>{progress.queuedSegments ?? 0} queued</span>
            <span>{progress.waitingSegments ?? 0} waiting</span>
            <span>{progress.retryingSegments ?? 0} retrying</span>
            <span>{progress.failedSegments} failed</span>
            {progress.deferredSegments !== undefined && progress.deferredSegments > 0 && (
              <span>
                {progress.deferredSegments} deferred by the {progress.safetyLimit ?? 2_500}-section
                safety limit
              </span>
            )}
          </div>
        }
      />

      {progress.recoveryState && (
        <section
          className="session-panel"
          aria-live="polite"
          aria-label="Session recovery status"
          data-recovery-state={progress.recoveryState}
        >
          <div className="session-heading">
            <div>
              <strong>
                {progress.recoveryState === 'recovering'
                  ? 'Recovering session'
                  : progress.recoveryState === 'recovered'
                    ? 'Session recovered'
                    : progress.recoveryState === 'expired'
                      ? 'Session expired'
                      : progress.recoveryState === 'offline'
                        ? 'You are offline'
                        : progress.recoveryState === 'backend-unavailable'
                          ? 'Local service unavailable'
                          : 'Page changed'}
              </strong>
              <p dir="auto">
                {progress.recoveryMessage ??
                  'Completed translation work remains available where it can be matched safely.'}
              </p>
            </div>
          </div>
        </section>
      )}

      {translatedCopy && !hasSession && (
        <section
          className="session-panel"
          aria-label="Translated copy status"
          data-translated-copy-status={translatedCopy.status}
        >
          <div className="session-heading">
            <div>
              <strong>
                {translatedCopy.status === 'applying'
                  ? 'Applying cached translation'
                  : translatedCopy.status === 'session-stale'
                    ? 'Saved translation is stale'
                    : 'Translation import failed'}
              </strong>
              <p>No provider request was made automatically.</p>
            </div>
          </div>
        </section>
      )}

      {hasSession && (
        <section className="session-panel" aria-label="Translation session controls">
          <div className="session-heading">
            <div>
              <strong>Translation available</strong>
              <p>
                Showing the original keeps this translation. Switching views uses no provider
                request.
              </p>
            </div>
            <span className="session-state">{sessionStateLabel(progress)}</span>
          </div>
          <SegmentedControl className="segmented-control" label="Page view">
            <button
              type="button"
              aria-pressed={activeView === 'original'}
              disabled={working}
              onClick={() => void runSessionCommand('SET_PAGE_VIEW', { displayMode: 'original' })}
            >
              Original
            </button>
            <button
              type="button"
              aria-pressed={activeView === 'translated'}
              disabled={working}
              onClick={() => void runSessionCommand('SET_PAGE_VIEW', { displayMode: 'translated' })}
            >
              Translated
            </button>
          </SegmentedControl>
          {translatedCopy && (
            <div
              className="change-summary"
              role="status"
              aria-live="polite"
              data-translated-copy-status={translatedCopy.status}
            >
              <strong>
                {translatedCopy.status === 'applying'
                  ? 'Applying cached translation'
                  : translatedCopy.status === 'ready'
                    ? 'Translated copy ready'
                    : translatedCopy.status === 'partial'
                      ? 'Translated copy partially applied'
                      : translatedCopy.status === 'no-matches'
                        ? 'No safe cached matches'
                        : translatedCopy.status === 'session-stale'
                          ? 'Saved translation is stale'
                          : 'Translation import failed'}
              </strong>
              <span>
                {translatedCopy.matchedSegments} reused · {translatedCopy.unmatchedSegments}{' '}
                unmatched · {translatedCopy.uncertainSegments} uncertain ·{' '}
                {translatedCopy.providerRequests} provider requests
              </span>
              {(translatedCopy.status === 'partial' || translatedCopy.status === 'no-matches') && (
                <Button
                  variant="primary"
                  className="compact-button"
                  disabled={working || busy}
                  onClick={() => void continueTranslation()}
                >
                  {translatedCopy.status === 'partial'
                    ? 'Translate unmatched sections'
                    : 'Translate this page'}
                </Button>
              )}
            </div>
          )}
          {progress.changeScan && (
            <div className="change-summary" role="status" aria-live="polite">
              {progress.changeScan.status === 'no-changes' ? (
                <>
                  <strong>No page changes found.</strong>
                  <span>Your translation is up to date.</span>
                </>
              ) : progress.changeScan.status === 'updated' ? (
                <>
                  <strong>Changed sections updated.</strong>
                  <span>
                    {progress.changeScan.updatedSegments ?? 0} translated ·{' '}
                    {progress.changeScan.summary.removedSegments} removed ·{' '}
                    {progress.changeScan.summary.reorderedSegments} reordered ·{' '}
                    {progress.changeScan.summary.uncertainSegments} uncertain and left original
                  </span>
                </>
              ) : (
                <>
                  <strong>{changedCount} page changes found</strong>
                  <span>
                    {progress.changeScan.summary.newSegments} new ·{' '}
                    {progress.changeScan.summary.modifiedSegments} modified ·{' '}
                    {progress.changeScan.summary.removedSegments} removed ·{' '}
                    {progress.changeScan.summary.reorderedSegments} reordered ·{' '}
                    {progress.changeScan.summary.uncertainSegments} uncertain
                  </span>
                  <Button
                    variant="primary"
                    className="compact-button"
                    disabled={working || busy}
                    onClick={() => void runSessionCommand('UPDATE_CHANGED_SECTIONS')}
                  >
                    {activeSessionCommand === 'UPDATE_CHANGED_SECTIONS'
                      ? 'Updating…'
                      : 'Update changed sections'}
                  </Button>
                </>
              )}
            </div>
          )}
          <PermissionRequest
            className="session-permission"
            description={TRANSLATED_COPY_ACCESS_EXPLANATION}
          />
          <div className="session-actions">
            <Button
              variant="secondary"
              disabled={working}
              onClick={() => void openSessionView('OPEN_TRANSLATED_COPY')}
            >
              Open translated copy
            </Button>
            <Button
              variant="primary"
              disabled={working}
              onClick={() => void openSessionView('OPEN_COMPARISON_VIEW')}
            >
              Compare original and translation
            </Button>
            <Button
              variant="tertiary"
              disabled={working}
              onClick={() => void runSessionCommand('SCAN_PAGE_CHANGES')}
            >
              {activeSessionCommand === 'SCAN_PAGE_CHANGES'
                ? 'Checking…'
                : 'Check for new or changed content'}
            </Button>
          </div>
          <Disclosure className="advanced-actions" label="Advanced actions">
            <p>Refreshing may use provider quota. Ending discards this session only.</p>
            <div>
              <Button variant="tertiary" disabled={working || busy} onClick={confirmRefresh}>
                Refresh translation
              </Button>
              <Button variant="destructive" disabled={working} onClick={confirmEndSession}>
                End translation session
              </Button>
            </div>
          </Disclosure>
        </section>
      )}

      {failure && failureDetails && (
        <section
          className="failure-panel ui-status-card"
          data-tone="danger"
          role="alert"
          aria-live="assertive"
        >
          <p className="failure-message">{failureDetails.message}</p>
          {failureDetails.secondaryMessage && (
            <p className="failure-secondary">{failureDetails.secondaryMessage}</p>
          )}
          {failureDetails.actions.length > 0 && (
            <div className="failure-actions">
              {failureDetails.actions.map((action, index) => (
                <Button
                  variant={index === 0 ? 'primary' : 'secondary'}
                  className="compact-button"
                  key={action.id}
                  disabled={working || busy}
                  onClick={() => handleFailureAction(action.id)}
                >
                  {action.label}
                </Button>
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
            <Button
              variant="link"
              onClick={() => void copyDiagnostics(failure, failureProvider?.displayName)}
            >
              {diagnosticsCopied ? 'Diagnostics copied' : 'Copy diagnostics'}
            </Button>
          </details>
        </section>
      )}

      {progress.notices?.map((notice) => {
        const noticeDetails = failurePresentation(notice);
        return (
          <StatusCard
            className="notice-panel"
            key={notice.reason}
            tone="warning"
            title={noticeDetails.message}
            description={noticeDetails.secondaryMessage}
            aria-live="polite"
          />
        );
      })}

      {busy ? (
        <Button variant="destructive" fullWidth onClick={() => void cancelTranslation()}>
          Cancel translation
        </Button>
      ) : !failure && !hasSession ? (
        <Button
          variant="primary"
          fullWidth
          disabled={!supported || !backendReady || working}
          onClick={() => void startTranslation()}
        >
          {working ? 'Starting…' : 'Translate page'}
        </Button>
      ) : null}
      {!hasSession && progress.translatedSegments > 0 && (
        <Button variant="secondary" fullWidth onClick={() => void restorePage()}>
          Show original
        </Button>
      )}

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
          <Button
            variant="link"
            onClick={() =>
              retrySessionCommand
                ? void runSessionCommand(retrySessionCommand)
                : window.location.reload()
            }
          >
            Retry
          </Button>
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
