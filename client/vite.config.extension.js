import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Builds the full Orbit UI into extension/app, the page the Manifest V3
 * extension opens in a tab or the side panel. Relative asset URLs keep the
 * bundle loadable from a chrome-extension:// origin, and minification is off so
 * the package a store reviewer opens is readable source.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: path.resolve(root, '../extension/app'),
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    target: 'chrome116',
  },
});
