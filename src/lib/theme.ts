// Light / dark. Follows the device until the cook picks one with the toggle on the
// start screen; after that their choice sticks (on this device).
// index.html sets the same attribute before first paint, so there's no flash.

import { ref } from 'vue'

export type Theme = 'light' | 'dark'

const KEY = 'sizzle:theme'
const BACKGROUND: Record<Theme, string> = { dark: '#14110f', light: '#f7f2ec' } // --bg, for the browser/status bar

const systemQuery = window.matchMedia?.('(prefers-color-scheme: light)')
const system = (): Theme => (systemQuery?.matches ? 'light' : 'dark')

function chosen(): Theme | null {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    return null
  }
}

export const theme = ref<Theme>(chosen() ?? system())

function apply(): void {
  document.documentElement.dataset.theme = theme.value
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BACKGROUND[theme.value])
}

export function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(KEY, theme.value)
  } catch {
    /* private mode: it just won't be remembered */
  }
  apply()
}

export function installTheme(): void {
  apply()
  systemQuery?.addEventListener('change', () => {
    if (chosen()) return
    theme.value = system()
    apply()
  })
}
