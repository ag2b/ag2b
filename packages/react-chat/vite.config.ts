import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: './tsconfig.build.json' })],
  resolve: { tsconfigPaths: true },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@ag2b/core',
        '@ag2b/react',
        'react-markdown',
        'remark-gfm',
      ],
      output: {
        assetFileNames: (info) =>
          info.name?.endsWith('.css') ? 'styles.css' : 'assets/[name][extname]',
      },
    },
    sourcemap: true,
    minify: false,
  },
});
