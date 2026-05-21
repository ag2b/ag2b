import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: './tsconfig.build.json' })],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', '@ag2b/core', /^zod($|\/)/],
    },
    sourcemap: true,
    minify: false,
  },
});
