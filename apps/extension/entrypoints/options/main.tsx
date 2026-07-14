import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { t } from '../../src/i18n/messages';
import '../../src/ui/global.css';

const targetLanguageKey = 'preferredTargetLanguage';

function OptionsApp() {
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void browser.storage.local.get(targetLanguageKey).then((value) => {
      const stored = value[targetLanguageKey];
      if (typeof stored === 'string') setTargetLanguage(stored);
    });
  }, []);

  async function saveSettings() {
    await browser.storage.local.set({ [targetLanguageKey]: targetLanguage });
    setSaved(true);
  }

  return (
    <main className="settings-shell" dir="auto">
      <header className="settings-header">
        <p className="eyebrow">{t('productCategory')}</p>
        <h1>{t('settings')}</h1>
        <p>{t('settingsIntro')}</p>
      </header>

      <section className="settings-card" aria-labelledby="language-heading">
        <h2 id="language-heading">{t('languagePreferences')}</h2>
        <label className="select-label" htmlFor="target-language">
          {t('defaultTargetLanguage')}
        </label>
        <select
          id="target-language"
          value={targetLanguage}
          onChange={(event) => {
            setTargetLanguage(event.target.value);
            setSaved(false);
          }}
        >
          <option value="en">English</option>
          <option value="fa">Persian</option>
          <option value="ar">Arabic</option>
          <option value="de">German</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
        </select>
        <button
          className="primary-button settings-save"
          type="button"
          onClick={() => void saveSettings()}
        >
          {t('saveSettings')}
        </button>
        {saved && (
          <p className="success-copy" role="status">
            {t('settingsSaved')}
          </p>
        )}
      </section>

      <section className="settings-card" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">{t('privacyStatus')}</h2>
        <p>{t('privacyDescription')}</p>
      </section>
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
