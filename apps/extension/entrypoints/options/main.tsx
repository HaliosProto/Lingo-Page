import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createRequestId, defaultSettings, developmentLanguages } from '@translation/shared-config';
import type {
  AppSettings,
  GlossaryEntry,
  HealthResponse,
  ProviderDefinition,
  TranslationPolicy,
} from '@translation/shared-types';
import { DEFAULT_TRANSLATION_POLICY } from '@translation/shared-types';
import { extensionResponseSchema, type ExtensionResponse } from '@translation/shared-validation';
import { createTranslationPolicyFingerprint } from '@translation/translation-core';
import { Button, EmptyState, FormField } from '@translation/ui';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import '../../src/ui/global.css';

async function sendMessage(message: unknown): Promise<ExtensionResponse> {
  return extensionResponseSchema.parse(await browser.runtime.sendMessage(message));
}

function Toggle(props: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{props.label}</strong>
        <small>{props.description}</small>
      </span>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  );
}

function OptionsApp() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [exclusions, setExclusions] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedPolicyChanged, setSavedPolicyChanged] = useState(false);
  const [loadedPolicyFingerprint, setLoadedPolicyFingerprint] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [testingProvider, setTestingProvider] = useState(false);

  useEffect(() => {
    void Promise.all([
      sendMessage({
        version: 1,
        requestId: createRequestId(),
        type: 'GET_SETTINGS',
        payload: {},
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
        type: 'GET_PROVIDERS',
        payload: {},
      }),
    ])
      .then(([settingsResponse, healthResponse, providersResponse]) => {
        if (settingsResponse.type === 'SETTINGS') {
          setSettings(settingsResponse.payload.settings);
          setExclusions(settingsResponse.payload.settings.domainExclusions.join('\n'));
          setLoadedPolicyFingerprint(
            createTranslationPolicyFingerprint(
              settingsResponse.payload.settings.translationPolicy ?? DEFAULT_TRANSLATION_POLICY,
            ),
          );
        }
        if (healthResponse.type === 'API_HEALTH') setHealth(healthResponse.payload.health);
        if (providersResponse.type === 'PROVIDERS')
          setProviders(providersResponse.payload.providers);
        if (healthResponse.type === 'MESSAGE_ERROR') setMessage(healthResponse.payload.message);
      })
      .catch(() => setMessage('Settings could not be loaded.'));
  }, []);

  useEffect(() => {
    if (settings.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    if (settings.reducedMotion) document.documentElement.dataset.reducedMotion = 'true';
    else delete document.documentElement.dataset.reducedMotion;
  }, [settings.reducedMotion]);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updatePolicy(policy: TranslationPolicy): void {
    update('translationPolicy', policy);
  }

  async function save(): Promise<void> {
    const invalidGlossary = settings.glossary.find(
      (entry) =>
        !entry.sourceTerm.trim() ||
        (!entry.preserve && !entry.preferredTranslation.trim()) ||
        (entry.scope === 'site' && !entry.siteOrigin),
    );
    if (invalidGlossary) {
      setMessage(
        'Complete each glossary term and add an HTTPS or HTTP site origin when site scope is selected.',
      );
      return;
    }
    const next: AppSettings = {
      ...settings,
      domainExclusions: exclusions
        .split(/[\n,]/u)
        .map((value) => value.trim())
        .filter(Boolean),
      glossaryVersion: settings.glossaryVersion + 1,
      persistentCache: settings.privacyMode ? false : settings.persistentCache,
    };
    const response = await sendMessage({
      version: 1,
      requestId: createRequestId(),
      type: 'UPDATE_SETTINGS',
      payload: { settings: next },
    });
    if (response.type === 'SETTINGS') {
      const nextPolicyFingerprint = createTranslationPolicyFingerprint(
        response.payload.settings.translationPolicy ?? DEFAULT_TRANSLATION_POLICY,
      );
      setSettings(response.payload.settings);
      setSaved(true);
      setSavedPolicyChanged(
        loadedPolicyFingerprint !== undefined && loadedPolicyFingerprint !== nextPolicyFingerprint,
      );
      setLoadedPolicyFingerprint(nextPolicyFingerprint);
      setMessage(undefined);
    } else if (response.type === 'MESSAGE_ERROR') setMessage(response.payload.message);
  }

  async function exportDiagnostics(): Promise<void> {
    const response = await sendMessage({
      version: 1,
      requestId: createRequestId(),
      type: 'EXPORT_DIAGNOSTICS',
      payload: {},
    });
    if (response.type !== 'DIAGNOSTICS') {
      setMessage(
        response.type === 'MESSAGE_ERROR' ? response.payload.message : 'Diagnostics unavailable.',
      );
      return;
    }
    const blob = new Blob([JSON.stringify(response.payload.report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'lingo-page-diagnostics.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage('Privacy-safe diagnostics downloaded. It contains no page text or URLs.');
  }

  async function testSelectedProvider(): Promise<void> {
    setTestingProvider(true);
    setMessage(undefined);
    try {
      const response = await sendMessage({
        version: 1,
        requestId: createRequestId(),
        type: 'TEST_PROVIDER',
        payload: { providerId: settings.providerId },
      });
      if (response.type === 'PROVIDER_TEST') {
        setMessage(`Connection test passed in ${response.payload.latencyMs} ms.`);
      } else if (response.type === 'MESSAGE_ERROR') setMessage(response.payload.message);
    } finally {
      setTestingProvider(false);
    }
  }

  function addGlossaryEntry(): void {
    const entry: GlossaryEntry = {
      id: `glossary_${crypto.randomUUID().replaceAll('-', '')}`,
      sourceTerm: '',
      preferredTranslation: '',
      preserve: false,
      caseSensitive: false,
      wholeWord: true,
      enabled: true,
    };
    update('glossary', [...settings.glossary, entry]);
  }

  function patchGlossary(id: string, patch: Partial<GlossaryEntry>): void {
    update(
      'glossary',
      settings.glossary.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  const selectableProviders = providers.filter(
    (provider) => provider.enabled && provider.configured,
  );
  const activeProvider = providers.find((provider) => provider.id === settings.providerId);
  const policy = settings.translationPolicy ?? DEFAULT_TRANSLATION_POLICY;

  return (
    <main className="settings-shell" dir="auto">
      <header className="settings-header">
        <p className="eyebrow">Lingo Page</p>
        <h1>Translation settings</h1>
        <p>Control what is translated, what stays local, and how page changes are handled.</p>
        <span className="version-pill">LOCAL · v{browser.runtime.getManifest().version}</span>
      </header>

      <section className="settings-card">
        <h2>Provider and model</h2>
        <p
          className={
            health?.translationEnabled && activeProvider?.enabled ? 'success-copy' : undefined
          }
        >
          {health?.translationEnabled && activeProvider?.enabled
            ? `${activeProvider.displayName} - local backend`
            : 'Backend or selected provider unavailable'}
        </p>
        <div className="two-column-fields">
          <label>
            Provider
            <select
              value={
                selectableProviders.some((provider) => provider.id === settings.providerId)
                  ? settings.providerId
                  : ''
              }
              onChange={(event) => {
                const provider = selectableProviders.find((item) => item.id === event.target.value);
                const modelId =
                  provider?.defaultModel ??
                  provider?.availableModels.find((model) => model.enabled)?.id;
                if (provider && modelId)
                  setSettings((current) => ({ ...current, providerId: provider.id, modelId }));
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
              disabled={!activeProvider}
              onChange={(event) => update('modelId', event.target.value)}
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
        </div>
        {activeProvider && (
          <p className="privacy-copy">
            <strong>Data recipient:</strong> {activeProvider.dataRecipient}.{' '}
            {activeProvider.privacyNotice}
          </p>
        )}
        <Button
          variant="secondary"
          disabled={!activeProvider?.enabled || testingProvider}
          onClick={() => void testSelectedProvider()}
        >
          {testingProvider ? 'Testing connection...' : 'Test selected provider'}
        </Button>
        <small>
          Only backend-enabled, allowlisted providers and models are selectable. Keys never enter
          the extension.
        </small>
      </section>

      <section className="settings-card">
        <h2>Languages and appearance</h2>
        <div className="two-column-fields">
          <label>
            Default source
            <select
              value={settings.sourceLanguage}
              onChange={(event) => update('sourceLanguage', event.target.value)}
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
            Default target
            <select
              value={settings.defaultTargetLanguage}
              onChange={(event) => update('defaultTargetLanguage', event.target.value)}
            >
              {developmentLanguages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Theme
            <select
              value={settings.theme}
              onChange={(event) => update('theme', event.target.value as AppSettings['theme'])}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
        <Toggle
          label="Reduced motion"
          description="Minimize interface animation."
          checked={settings.reducedMotion}
          onChange={(value) => update('reducedMotion', value)}
        />
      </section>

      <section className="settings-card">
        <h2>Privacy and page behavior</h2>
        <Toggle
          label="Privacy mode"
          description="Never persist translated text in extension storage."
          checked={settings.privacyMode}
          onChange={(value) => {
            update('privacyMode', value);
            if (value) update('persistentCache', false);
          }}
        />
        <Toggle
          label="Persistent cache"
          description="Reuse recent translations after the browser restarts (maximum 200 entries)."
          checked={settings.persistentCache}
          disabled={settings.privacyMode}
          onChange={(value) => update('persistentCache', value)}
        />
        <Toggle
          label="Sensitive-page protection"
          description="Warn before translating pages that look like banking, health, account, or message screens."
          checked={settings.sensitivePageProtection}
          onChange={(value) => update('sensitivePageProtection', value)}
        />
        <Toggle
          label="Translate dynamic content"
          description="Continue translating text added by single-page apps after the first pass."
          checked={settings.autoTranslateDynamicContent}
          onChange={(value) => update('autoTranslateDynamicContent', value)}
        />
        <Toggle
          label="Selected-text translation"
          description="Show “Translate selected text” in the right-click menu."
          checked={settings.selectedTextEnabled}
          onChange={(value) => update('selectedTextEnabled', value)}
        />
        <FormField label="Excluded domains" hint="One hostname per line. Subdomains are included.">
          <textarea
            value={exclusions}
            placeholder={'example.com\ninternal.example.org'}
            onChange={(event) => {
              setSaved(false);
              setExclusions(event.target.value);
            }}
          />
        </FormField>
      </section>

      <section className="settings-card">
        <div className="section-heading">
          <div>
            <h2>Translation preferences</h2>
            <p>Defaults are natural and meaning-preserving. Add a brief only when you need it.</p>
          </div>
          <span className="version-pill">Policy v{policy.schemaVersion}</span>
        </div>
        <FormField
          label="Translation brief"
          hint={`${policy.customInstructions.length}/2000 characters. Page text cannot override this brief or the output contract.`}
        >
          <textarea
            dir="auto"
            maxLength={2000}
            value={policy.customInstructions}
            placeholder="For example: Keep industrial safety terms concise and use formal Persian."
            onChange={(event) =>
              updatePolicy({ ...policy, customInstructions: event.target.value })
            }
          />
        </FormField>
        <div className="two-column-fields">
          <label>
            Translation style
            <select
              value={policy.behavior.naturalness}
              onChange={(event) =>
                updatePolicy({
                  ...policy,
                  behavior: {
                    ...policy.behavior,
                    naturalness: event.target.value as TranslationPolicy['behavior']['naturalness'],
                  },
                })
              }
            >
              <option value="natural">Natural</option>
              <option value="neutral">Balanced</option>
              <option value="literal">Closer to source</option>
            </select>
          </label>
          <label>
            Quality mode
            <select
              value={policy.quality.mode}
              onChange={(event) =>
                updatePolicy({
                  ...policy,
                  quality: {
                    ...policy.quality,
                    mode: event.target.value as TranslationPolicy['quality']['mode'],
                  },
                })
              }
            >
              <option value="fast">Fast</option>
              <option value="standard">Standard</option>
              <option value="enhanced">Enhanced</option>
            </select>
          </label>
        </div>
        <details className="preference-disclosure">
          <summary>Advanced language and review preferences</summary>
          <div className="two-column-fields preference-grid">
            <label>
              Tone
              <select
                value={policy.style.tone}
                onChange={(event) =>
                  updatePolicy({
                    ...policy,
                    style: {
                      ...policy.style,
                      tone: event.target.value as TranslationPolicy['style']['tone'],
                    },
                  })
                }
              >
                <option value="auto">Automatic</option>
                <option value="neutral">Neutral</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
              </select>
            </label>
            <label>
              Formality
              <select
                value={policy.style.formality}
                onChange={(event) =>
                  updatePolicy({
                    ...policy,
                    style: {
                      ...policy.style,
                      formality: event.target.value as TranslationPolicy['style']['formality'],
                    },
                  })
                }
              >
                <option value="auto">Automatic</option>
                <option value="default">Default</option>
                <option value="more">More formal</option>
                <option value="less">Less formal</option>
              </select>
            </label>
            <label>
              Content type
              <select
                value={policy.style.contentType}
                onChange={(event) =>
                  updatePolicy({
                    ...policy,
                    style: {
                      ...policy.style,
                      contentType: event.target.value as TranslationPolicy['style']['contentType'],
                    },
                  })
                }
              >
                <option value="auto">Automatic</option>
                <option value="general">General</option>
                <option value="technical-documentation">Technical documentation</option>
                <option value="news">News</option>
                <option value="marketing">Marketing</option>
                <option value="academic">Academic</option>
              </select>
            </label>
            <label>
              Audience
              <select
                value={policy.style.audience}
                onChange={(event) =>
                  updatePolicy({
                    ...policy,
                    style: {
                      ...policy.style,
                      audience: event.target.value as TranslationPolicy['style']['audience'],
                    },
                  })
                }
              >
                <option value="auto">Automatic</option>
                <option value="general">General</option>
                <option value="expert">Expert</option>
                <option value="children">Children</option>
              </select>
            </label>
            <label>
              Selective review
              <select
                value={policy.quality.selectiveReview}
                onChange={(event) =>
                  updatePolicy({
                    ...policy,
                    quality: {
                      ...policy.quality,
                      selectiveReview: event.target
                        .value as TranslationPolicy['quality']['selectiveReview'],
                    },
                  })
                }
              >
                <option value="automatic">Automatic for suspicious segments</option>
                <option value="off">Off</option>
                <option value="on-demand">On demand</option>
              </select>
            </label>
          </div>
          <p className="privacy-copy">
            Automatic review can make one additional provider request, only for suspicious segments.
            Clean batches are never sent twice.
          </p>
        </details>
      </section>

      <section className="settings-card">
        <div className="section-heading">
          <div>
            <h2>Personal glossary</h2>
            <p>Apply preferred terms or preserve names in translation requests.</p>
          </div>
          <Button variant="secondary" className="compact-button" onClick={addGlossaryEntry}>
            Add term
          </Button>
        </div>
        {settings.glossary.length === 0 && (
          <EmptyState className="empty-copy">No glossary terms yet.</EmptyState>
        )}
        {settings.glossary.map((entry) => (
          <div className="glossary-row" key={entry.id}>
            <input
              aria-label="Source term"
              dir="auto"
              placeholder="Source term"
              value={entry.sourceTerm}
              onChange={(event) => patchGlossary(entry.id, { sourceTerm: event.target.value })}
            />
            <input
              aria-label="Preferred translation"
              dir="auto"
              placeholder="Preferred translation"
              value={entry.preferredTranslation}
              disabled={entry.preserve}
              onChange={(event) =>
                patchGlossary(entry.id, { preferredTranslation: event.target.value })
              }
            />
            <label className="inline-check">
              <input
                type="checkbox"
                checked={entry.preserve}
                onChange={(event) => patchGlossary(entry.id, { preserve: event.target.checked })}
              />{' '}
              Preserve
            </label>
            <select
              aria-label="Glossary scope"
              value={entry.scope ?? 'global'}
              onChange={(event) =>
                patchGlossary(entry.id, {
                  scope: event.target.value as GlossaryEntry['scope'],
                  ...(event.target.value === 'site' ? {} : { siteOrigin: undefined }),
                })
              }
            >
              <option value="global">All sites</option>
              <option value="site">One site</option>
              <option value="session">Current session</option>
            </select>
            {entry.scope === 'site' && (
              <input
                aria-label="Site origin"
                placeholder="https://example.com"
                value={entry.siteOrigin ?? ''}
                onChange={(event) => patchGlossary(entry.id, { siteOrigin: event.target.value })}
              />
            )}
            <Button
              variant="link"
              className="danger-text"
              onClick={() =>
                update(
                  'glossary',
                  settings.glossary.filter((item) => item.id !== entry.id),
                )
              }
            >
              Remove
            </Button>
          </div>
        ))}
      </section>

      <div className="settings-actions">
        <Button variant="primary" onClick={() => void save()}>
          Save settings
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void sendMessage({
              version: 1,
              requestId: createRequestId(),
              type: 'CLEAR_LOCAL_DATA',
              payload: {},
            }).then(() => setMessage('Translation cache cleared.'))
          }
        >
          Clear translation cache
        </Button>
        <Button variant="tertiary" onClick={() => void exportDiagnostics()}>
          Download privacy-safe diagnostics
        </Button>
      </div>
      {saved && (
        <p className="success-copy" role="status">
          Settings saved.
          {savedPolicyChanged &&
            ' Existing page translations keep their original policy; translate again to apply these changes.'}
        </p>
      )}
      {message && (
        <p className="error-banner" role="status">
          {message}
        </p>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <OptionsApp />
    </ErrorBoundary>
  </StrictMode>,
);
