import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
// Note: top-level await is supported natively by Vite 7's default build
// target, so no vite-plugin-top-level-await is needed.
export default defineConfig({
  plugins: [react(), wasm()],
  worker: {
    format: 'es',
    plugins: () => [wasm()]
  },
  optimizeDeps: {
    // Don't optimize these packages as they contain web workers and WASM files.
    // https://github.com/vitejs/vite/issues/11672#issuecomment-1415820673
    exclude: ['@journeyapps/wa-sqlite', '@powersync/web']
  }
});
