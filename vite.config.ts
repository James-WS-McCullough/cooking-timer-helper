import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// The robot voice's runtime: ONNX Runtime and the eSpeak NG phonemiser (GPL-3.0-or-later),
// about 33 MB of WebAssembly. They live in node_modules (versions pinned by the lockfile),
// are served at /voice/ in dev and copied to dist/voice/ in a build, so Sizzle hosts them
// itself (works offline, no third-party CDN) without any of it being committed to git.
const VOICE_FILES: Record<string, string> = {
  'ort-wasm-simd-threaded.mjs': 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm': 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
  'piper_phonemize.wasm': 'node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.wasm',
  'piper_phonemize.data': 'node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.data',
}
// The mic's speech model runs on transformers.js, which wants its own (newer) build of the
// same runtime. Served from /listen/ in the same way, and only fetched once the mic is used.
const ORT_FOR_LISTEN = 'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist'
const LISTEN_FILES: Record<string, string> = {
  'ort-wasm-simd-threaded.mjs': `${ORT_FOR_LISTEN}/ort-wasm-simd-threaded.mjs`,
  'ort-wasm-simd-threaded.wasm': `${ORT_FOR_LISTEN}/ort-wasm-simd-threaded.wasm`,
}
const HOSTED: Record<string, Record<string, string>> = { voice: VOICE_FILES, listen: LISTEN_FILES }
const VOICE_TYPES: Record<string, string> = {
  mjs: 'text/javascript',
  wasm: 'application/wasm',
  data: 'application/octet-stream',
}

function hostedAssets(): Plugin {
  let outDir = 'dist'
  return {
    name: 'sizzle-hosted-assets',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const [, dir, name] = /\/(voice|listen)\/([^/?]+)/.exec(req.url ?? '') ?? []
        const file = dir && name ? HOSTED[dir]?.[name] : undefined
        if (!file || !existsSync(file)) return next()
        res.setHeader('Content-Type', VOICE_TYPES[file.split('.').at(-1) ?? ''] ?? 'application/octet-stream')
        res.setHeader('Content-Length', statSync(file).size)
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      for (const [dir, files] of Object.entries(HOSTED)) {
        mkdirSync(resolve(outDir, dir), { recursive: true })
        for (const [name, from] of Object.entries(files)) copyFileSync(from, resolve(outDir, dir, name))
      }
      // The speech worker's bundle drags in every build of its runtime (41 MB) by URL reference.
      // It's pointed at /listen/ instead, so these copies would only bloat the deploy.
      const assets = resolve(outDir, 'assets')
      for (const name of existsSync(assets) ? readdirSync(assets) : []) {
        if (/^ort-wasm-.*\.wasm$/.test(name)) rmSync(resolve(assets, name))
      }
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    hostedAssets(),
    Icons({ compiler: 'vue3' }),
    VitePWA({
      // 'prompt': a new version waits for the cook to press Reload (src/components/UpdateToast.vue).
      registerType: 'prompt',
      // Sounds must work offline too.
      workbox: {
        globPatterns: ['**/*.{js,css,html,mp3}'],
        globIgnores: ['**/transcriber.worker-*.js'], // half a megabyte that only mic users need
        // The voice runtime (33 MB) is only fetched if the voice is turned on, and the mic's
        // (14 MB) if the mic is used; keep them after that.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/voice\/|\/listen\/|\/transcriber\.worker-/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'sizzle-voice-runtime', expiration: { maxEntries: 8 } },
          },
        ],
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Sizzle',
        short_name: 'Sizzle',
        description: 'Fast cooking timers with flip alerts',
        display: 'standalone',
        orientation: 'any',
        background_color: '#14110f',
        theme_color: '#14110f',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // The mic's speech worker imports transformers.js, which splits into chunks: that needs ES output.
  worker: { format: 'es' },
  // The voice lab's Piper package starts its own web worker; pre-bundling breaks the worker's URL.
  optimizeDeps: { exclude: ['@mintplex-labs/piper-tts-web'] },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'], // e2e/ belongs to Playwright
  },
})
