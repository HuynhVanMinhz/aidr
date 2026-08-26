import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/hubs': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
        // Avoid noisy proxy crashes when API is briefly restarting.
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.warn('[vite] hub/api proxy error:', err.message);
            if (res && 'writeHead' in res && typeof res.writeHead === 'function') {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ detail: 'API unavailable. Is AIDR.Api running on :5080?' }));
            }
          });
        },
      },
    },
  },
});
