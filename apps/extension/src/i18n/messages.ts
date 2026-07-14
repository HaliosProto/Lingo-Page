import { browser } from 'wxt/browser';

const fallbackMessages = {
  productName: 'Lingo Page',
  productCategory: 'In-page translation',
  shellLabel: 'Shell',
  loading: 'Checking page…',
  supportedPage: 'Ready for this page',
  unsupportedPage: 'This page is not supported',
  unknownPage: 'Page status is unknown',
  noActiveTab: 'No active tab is available.',
  unexpectedError: 'Something unexpected happened.',
  checkingCurrentTab: 'Checking current tab',
  translationSettings: 'Translation settings',
  sourceLanguage: 'Source language',
  targetLanguage: 'Target language',
  detectedLanguagePlaceholder: 'Detection arrives in Milestone 2',
  targetLanguagePlaceholder: 'Choose a default in Settings',
  translatePage: 'Translate Page',
  milestoneTwoTooltip: 'Page translation becomes available in Milestone 2.',
  milestoneTwoMessage:
    'The shell is ready. Page translation is intentionally disabled until Milestone 2.',
  backendConnected: 'Backend connected',
  backendUnavailable: 'Backend unavailable',
  checking: 'Checking…',
  privacyStatus: 'Privacy-first shell',
  settings: 'Settings',
  settingsUnavailable: 'Settings could not be opened.',
  settingsIntro: 'Manage local preferences for the translation shell.',
  languagePreferences: 'Language preferences',
  defaultTargetLanguage: 'Default target language',
  saveSettings: 'Save settings',
  settingsSaved: 'Settings saved locally.',
  privacyDescription:
    'No page text is collected or sent in Milestone 1. Translation is not active yet.',
} as const;

export type MessageKey = keyof typeof fallbackMessages;

export function t(key: MessageKey): string {
  const localized = browser.i18n.getMessage(key);
  return localized || fallbackMessages[key];
}
