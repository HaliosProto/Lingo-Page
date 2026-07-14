import { browser } from 'wxt/browser';

const fallbackMessages = {
  productName: 'Lingo Page',
  unexpectedError: 'Something unexpected happened.',
} as const;

export type MessageKey = keyof typeof fallbackMessages;

export function t(key: MessageKey): string {
  return browser.i18n.getMessage(key) || fallbackMessages[key];
}
