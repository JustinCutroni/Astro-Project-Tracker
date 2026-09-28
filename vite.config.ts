import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves project sites from /<repo-name>/, so the production
// build needs that base path. Dev server keeps using the root.
const repoName = 'AstroProjectTracker'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // `vite preview` also runs with command "serve", so branch on mode
  // (production for build/preview, development for `vite dev`) instead.
  base: mode === 'production' ? `/${repoName}/` : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Astro Project Tracker',
        short_name: 'AstroTracker',
        description:
          'Plan, log, and track astrophotography projects across sessions, locations, and equipment - online or off.',
        theme_color: '#15110c',
        background_color: '#15110c',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
}))
