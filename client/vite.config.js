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
        // The extension reconnects on its own; a client dropping mid-socket
        // (ECONNRESET/EPIPE) is normal and shouldn't be logged as an error.
        configure: (proxy) => {
          proxy.on('error', (error) => {
            if (['ECONNRESET', 'EPIPE'].includes(error.code)) return;
            console.error('[browser/ws proxy]', error.message);
          });
        },
      },
    },
  },
});
