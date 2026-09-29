import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';
import { readAppVersion } from './app-version.ts';

export default defineProject({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(readAppVersion()) },
  test: {
    name: 'desktop',
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
