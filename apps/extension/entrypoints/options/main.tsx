import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createRequestId, defaultSettings, developmentLanguages } from '@translation/shared-config';
import type { AppSettings, GlossaryEntry, HealthResponse } from '@translation/shared-types';
import { extensionResponseSchema, type ExtensionResponse } from '@translation/shared-validation';
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
  const [message, setMessage] = useState<string>();
  const [health, setHealth] = useState<HealthResponse | null>(null);

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
    ])
      .then(([settingsResponse, healthResponse]) => {
        if (settingsResponse.type === 'SETTINGS') {
          setSettings(settingsResponse.payload.settings);
          setExclusions(settingsResponse.payload.settings.domainExclusions.join('\n'));
        }
        if (healthResponse.type === 'API_HEALTH') setHealth(healthResponse.payload.health);
        if (healthResponse.type === 'MESSAGE_ERROR') setMessage(healthResponse.payload.message);
      })
      .catch(() => setMessage('Settings could not be loaded.'));
  }, []);

  useEffect(() => {
    if (settings.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save(): Promise<void> {
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
      setSettings(response.payload.settings);
      setSaved(true);
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

  return (
    <main className="settings-shell" dir="auto">
      <header className="settings-header">
        <p className="eyebrow">Lingo Page</p>
        <h1>Translation settings</h1>
        <p>Control what is translated, what stays local, and how page changes are handled.</p>
        <span className="version-pill">LOCAL · v{browser.runtime.getManifest().version}</span>
      </header>

      <section className="settings-card">
        <h2>Local backend</h2>
        <p
          className={
            health?.translationEnabled && health.provider.configured ? 'success-copy' : undefined
          }
        >
          {health?.translationEnabled && health.provider.configured
            ? health.provider.name === 'mock'
              ? 'Mock mode - deterministic local output'
              : 'DeepL via local backend'
            : 'Backend unavailable'}
        </p>
        <small>Provider keys stay in the backend environment and never enter the extension.</small>
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
        <label>
          Excluded domains
          <textarea
            value={exclusions}
            placeholder={'example.com\ninternal.example.org'}
            onChange={(event) => {
              setSaved(false);
              setExclusions(event.target.value);
            }}
          />
          <small>One hostname per line. Subdomains are included.</small>
        </label>
      </section>

      <section className="settings-card">
        <div className="section-heading">
          <div>
            <h2>Personal glossary</h2>
            <p>Apply preferred terms or preserve names in translation requests.</p>
          </div>
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={addGlossaryEntry}
          >
            Add term
          </button>
        </div>
        {settings.glossary.length === 0 && <p className="empty-copy">No glossary terms yet.</p>}
        {settings.glossary.map((entry) => (
          <div className="glossary-row" key={entry.id}>
            <input
              aria-label="Source term"
              placeholder="Source term"
              value={entry.sourceTerm}
              onChange={(event) => patchGlossary(entry.id, { sourceTerm: event.target.value })}
            />
            <input
              aria-label="Preferred translation"
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
            <button
              className="text-button danger-text"
              type="button"
              onClick={() =>
                update(
                  'glossary',
                  settings.glossary.filter((item) => item.id !== entry.id),
                )
              }
            >
              Remove
            </button>
          </div>
        ))}
      </section>

      <div className="settings-actions">
        <button className="primary-button" type="button" onClick={() => void save()}>
          Save settings
        </button>
        <button
          className="secondary-button"
          type="button"
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
        </button>
        <button className="secondary-button" type="button" onClick={() => void exportDiagnostics()}>
          Download privacy-safe diagnostics
        </button>
      </div>
      {saved && (
        <p className="success-copy" role="status">
          Settings saved.
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
