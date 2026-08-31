import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Two targets out of one source.
 *
 * The web build is the PWA it has always been: served from
 * https://<user>.github.io/Gym-App/ in production, root in dev.
 *
 * The native build (`npm run build:ios`) is the same app served off the
 * shell's own scheme with the files already on the device. That needs a root
 * base path, and no service worker: the shell has nothing to cache and no
 * update to fetch, so `virtual:pwa-register` is aliased to a stub rather than
 * left to register a stale second copy of the app in front of the real one.
 */
const native = process.env.NATIVE === '1'
const base = native ? '/' : process.env.APP_BASE ?? '/Gym-App/'

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      output: {
        // The bridge and its plugins go in one chunk under a name the service
        // worker can recognise. A browser never loads it, so precaching it
        // would be pure weight on a first visit.
        manualChunks: (id) => (id.includes('@capacitor') ? 'native' : undefined),
      },
    },
  },
  resolve: native
    ? {
        alias: {
          'virtual:pwa-register': fileURLToPath(
            new URL('./src/lib/pwaRegisterStub.ts', import.meta.url),
          ),
        },
      }
    : {},
  plugins: [
    react(),
    ...(native
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon-180.png', 'favicon.svg'],
            manifest: {
              name: 'Gym App',
              short_name: 'Gym',
              description: 'Offline push/pull/legs set and rep tracker',
              theme_color: '#000000',
              background_color: '#000000',
              display: 'standalone',
              orientation: 'portrait',
              start_url: base,
              scope: base,
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
              // These stay out of the precache and off the first-load budget.
              // Launch screens are read once by iOS at startup, and the
              // native bridge is only ever loaded by the shell.
              globIgnores: ['**/splash/**', '**/assets/native-*.js'],
              navigateFallback: `${base}index.html`,
            },
          }),
        ]),
  ],
})
