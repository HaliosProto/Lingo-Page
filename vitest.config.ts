import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/src/**/*.{test,spec}.ts',
      'apps/**/src/**/*.{test,spec}.ts',
      'scripts/**/*.{test,spec}.mjs',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.wxt/**', '**/.output/**'],
    environment: 'node',
    restoreMocks: true,
    clearMocks: true,
  },
});
