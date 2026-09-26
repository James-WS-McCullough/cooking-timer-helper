// What's on while cooking (src/lib/watch.ts says what a link means). The last link is
// remembered so it's one tap to bring back, but it never plays until the cook presses play.

import { ref } from 'vue'
import { parseWatchUrl, type Watchable } from './watch'

const KEY = 'sizzle:watch'

function remembered(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

/** The link last shown, if any: offered again from Settings. */
export const lastLink = ref(remembered())
/** What's on screen now, if anything. */
export const watching = ref<Watchable | null>(null)

/** Show a link. Returns false (and shows nothing new) if it isn't one we can. */
export function watch(link: string): boolean {
  const w = parseWatchUrl(link)
  if (!w) return false
  watching.value = w
  lastLink.value = link.trim()
  try {
    localStorage.setItem(KEY, lastLink.value)
  } catch {
    /* private mode: it just won't be remembered */
  }
  return true
}

export function stopWatching(): void {
  watching.value = null
}
