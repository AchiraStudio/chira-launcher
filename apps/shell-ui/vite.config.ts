import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

// Fixed port: `src-tauri/tauri.conf.json` points `devUrl` here.
const DEV_PORT = 1420;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  clearScreen: false,
  server: { port: DEV_PORT, strictPort: true, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    sourcemap: false,
    // The target is an evergreen WebView2, so there is no legacy-browser fallback to ship.
    cssTarget: 'chrome120',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
