import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/llm': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        rewrite: () => '/v1/chat/completions',
      },
    },
  },
});
