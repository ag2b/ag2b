import { defineConfig } from 'eslint/config';
import eslint from 'notmedia-eslint-config';

export default defineConfig({ ignores: ['coverage/**', 'dist/**'] }, eslint.configs.base, {
  files: [eslint.patterns.ALL_FILES],
  languageOptions: {
    parserOptions: {
      projectService: false,
      project: ['./tsconfig.json', './tsconfig.node.json'],
    },
  },
});
