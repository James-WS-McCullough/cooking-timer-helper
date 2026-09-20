import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The preset's defaults shrink the artwork and pad it with white, which puts a
// dark tile inside a white square on the home screen. public/icon.svg already
// has its own margins (the dial sits inside the maskable safe zone), so use it
// edge to edge, on the app's background colour.
const background = '#14110f'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
