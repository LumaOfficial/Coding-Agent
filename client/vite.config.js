import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      // The browser extension connects to the page's own origin; forward its
      // socket to the API so `wss://<app host>/browser/ws` works without CORS.
      '/browser/ws': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
