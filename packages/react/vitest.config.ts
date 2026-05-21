import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: { label: 'react', color: 'blue' },
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
