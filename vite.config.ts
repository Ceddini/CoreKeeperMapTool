/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
      },
    },
  },
  worker: {
    format: 'es',
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.ico', 'theme-init.js', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'Core Keeper Map Tool',
        short_name: 'CK Map Tool',
        description:
          'View your Core Keeper map with boss rings, biome areas, maze holes and a tile finder. Works offline; your map never leaves your device.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#110f0d',
        theme_color: '#181613',
        categories: ['games', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        file_handlers: [
          {
            action: '/',
            accept: { 'application/gzip': ['.gzip', '.gz'] },
          },
        ],
        launch_handler: { client_mode: 'focus-existing' },
      } as Record<string, unknown>,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp,svg,ico,json}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/privacy/],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // The example maps are large: cache them only once someone opens one.
            urlPattern: ({ url }) => url.pathname.startsWith('/example/'),
            handler: 'CacheFirst',
            options: { cacheName: 'example-maps', expiration: { maxEntries: 2 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
