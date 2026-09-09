import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves a project repo from a sub-path, so the bundle has to be
// built with a matching base. Override with VITE_BASE_PATH=/ when deploying to a
// <user>.github.io root repo or any other host.
const base = process.env.VITE_BASE_PATH ?? '/bp-tracker/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // The app registers the worker itself (lib/push.ts) so that registration
      // and push-subscription setup stay in one place.
      injectRegister: null,
      manifest: {
        name: 'מעקב לחץ דם',
        short_name: 'לחץ דם',
        description: 'מעקב יומי אחר לחץ דם',
        lang: 'he',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f9',
        theme_color: '#b3243b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
})
