import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm()],
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    // These ship web workers and WASM files that Vite's prebundling breaks.
    // https://github.com/vitejs/vite/issues/11672#issuecomment-1415820673
    exclude: ['@journeyapps/wa-sqlite', '@powersync/web']
  }
});
