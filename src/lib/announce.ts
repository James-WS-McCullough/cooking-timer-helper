// What a screen reader is told. Sizzle's voice is an optional 95 MB download and talks over
// a screen reader, so it can't be how a blind cook learns that the rice is done: that is
// this, a live region in App.vue fed by the store. Plain words, no personality.

import { nextTick, ref } from 'vue'

export const announcement = ref({ text: '', urgent: false })

/** Say it to assistive tech. Urgent (a dish is ready) interrupts; the rest waits its turn. */
export function announce(text: string, urgent = false): void {
  // A live region only speaks when its text changes: clear it first so the same news twice is still news.
  announcement.value = { text: '', urgent }
  void nextTick(() => {
    announcement.value = { text, urgent }
  })
}
