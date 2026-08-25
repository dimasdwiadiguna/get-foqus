import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Vite, not Next.js: FOQUS is fully authenticated so SSR buys nothing, while full control over
 * the service worker is what M5 stands on (BRIEF §3). The output is a static SPA; `api/` becomes
 * Vercel functions on its own.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // `vercel dev` serves the functions on 3000; plain `vite` still gets a working API.
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'FOQUS',
        short_name: 'FOQUS',
        description: 'Jembatan antara backlog dan kalender.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#EFF1EC',
        theme_color: '#16232B',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // API reads: fresh when online, mirrored when not (§8). Mutations never go
            // through the service worker — they go through the application outbox.
            urlPattern: /^\/api\/(?!auth\/).*/,
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'foqus-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
