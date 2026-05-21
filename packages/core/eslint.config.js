import eslint from '@notmedia/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig({ ignores: ['coverage/**'] }, eslint.configs.base, {
  files: [eslint.patterns.ALL_FILES],
  languageOptions: {
    parserOptions: {
      projectService: false,
      project: ['./tsconfig.json', './tsconfig.node.json'],
    },
  },
});
