import { defineConfig } from 'wxt';

const defaultApiBaseUrl = 'http://127.0.0.1:8787';

function getApiOrigin(): string {
  const configured = import.meta.env.WXT_API_BASE_URL ?? defaultApiBaseUrl;
  try {
    return new URL(configured).origin;
  } catch {
    return new URL(defaultApiBaseUrl).origin;
  }
}

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ mode }) => ({
    name: 'Lingo Page',
    version: '0.1.0',
    description: 'Translate eligible webpage text in place with privacy-first controls.',
    default_locale: 'en',
    permissions: ['activeTab', 'alarms', 'contextMenus', 'scripting', 'sessions', 'storage'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    host_permissions: [
      `${getApiOrigin()}/*`,
      ...(mode === 'e2e' ? ['http://127.0.0.1:4173/*'] : []),
    ],
    action: {
      default_title: 'Lingo Page',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+L' },
        description: 'Open Lingo Page for the current tab',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  }),
});
