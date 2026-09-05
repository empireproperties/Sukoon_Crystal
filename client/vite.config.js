import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        /* Three libraries that change far less often than the site does.
           Splitting them out means a copy edit ships a small storefront
           chunk instead of re-downloading React on every deploy, and it
           keeps recharts — which only the admin dashboard renders — out of
           the bundle a shopper pays for. */
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
    /* Bind to every interface, not just localhost, so the site can be opened
       from a phone on the same Wi-Fi. Without this Vite listens on ::1 only
       and anything other than this machine gets a refused connection. */
    host: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
