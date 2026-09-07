import { defineConfig } from 'vite';

export default defineConfig({
  base: '/3JS_Foundation/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});