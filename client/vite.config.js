import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'https://ops-center.onrender.com',
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.error(`[vite:proxy] ❌ ${req.method} ${req.url} failed: ${err.code}`);
          });
        },
      },
      '/socket.io': {
        target: 'https://ops-center.onrender.com',
        ws: true,
        changeOrigin: true,
        secure: true,
      },
      '/uploads': {
        target: 'https://ops-center.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});