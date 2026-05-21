import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import eslint from 'notmedia-eslint-config';

const eslintConfig = defineConfig([
  eslint.configs.react,
  ...nextVitals,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '.source/**']),
]);

export default eslintConfig;
