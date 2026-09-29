import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { readAppVersion } from './app-version';

// Tauri expects a fixed dev port and must see Rust compiler errors, so Vite must not clear the terminal.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: { __APP_VERSION__: JSON.stringify(readAppVersion()) },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
});
