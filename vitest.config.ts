import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**'],
      exclude: ['**/__tests__/**', "**/coverage/**"],
      reporter: ['text', 'json', 'html'],
    },
    projects: ['packages/*', 'examples/*'],
    passWithNoTests: true,
  },
});
