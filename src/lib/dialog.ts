// What every dialog owes a keyboard or screen-reader user, done once: focus moves into it
// when it opens (onto the panel itself, so its name is read and no keyboard pops up), Tab
// stays inside it, everything behind it is inert, Escape closes the topmost one only, and
// focus goes back where it came from when it closes. Vue-aware only at the edges.

import { onBeforeUnmount, onMounted, type Ref, watch } from 'vue'

interface Open {
  panel: HTMLElement
  close: () => void
  /** Where focus lands: the panel itself (its name is read, nothing pops up) or its first control. */
  focus: 'panel' | 'first'
  /** The dialog's world: nothing outside it is made inert. Defaults to the whole document. */
  within: HTMLElement | undefined
  opener: Element | null
  inerted: Element[]
}

const open: Open[] = []

/** Is any dialog up? (Global shortcuts should stay out of the way while one is.) */
export const dialogOpen = () => open.length > 0

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

function focusables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null && !el.closest('[inert]'),
  )
}

/** Make everything beside the panel's ancestor line inert, up to `within`. */
function fence(d: Open): void {
  const stop = d.within ?? document.body
  let node: HTMLElement | null = d.panel
  while (node && node !== stop) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    for (const sibling of parent.children) {
      if (sibling !== node && !sibling.hasAttribute('inert')) {
        sibling.setAttribute('inert', '')
        d.inerted.push(sibling)
      }
    }
    node = parent
  }
}

function unfence(d: Open): void {
  for (const el of d.inerted) el.removeAttribute('inert')
  d.inerted = []
}

function onKey(e: KeyboardEvent): void {
  const top = open[open.length - 1]
  if (!top) return
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    top.close()
    return
  }
  if (e.key !== 'Tab') return
  const items = focusables(top.panel)
  if (!items.length) {
    e.preventDefault()
    top.panel.focus()
    return
  }
  const first = items[0] as HTMLElement
  const last = items[items.length - 1] as HTMLElement
  const current = document.activeElement
  if (e.shiftKey && (current === first || current === top.panel)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && current === last) {
    e.preventDefault()
    first.focus()
  }
}

function show(d: Open): void {
  if (!open.length) window.addEventListener('keydown', onKey, true)
  open.push(d)
  fence(d)
  d.panel.tabIndex = -1
  const target = d.focus === 'first' ? (focusables(d.panel)[0] ?? d.panel) : d.panel
  target.focus({ preventScroll: true })
}

function hide(d: Open): void {
  const at = open.indexOf(d)
  if (at < 0) return
  open.splice(at, 1)
  unfence(d)
  if (!open.length) window.removeEventListener('keydown', onKey, true)
  // Back to the opener, unless something else has already taken focus (the next dialog, say).
  const now = document.activeElement
  const orphaned = !now || now === document.body || d.panel.contains(now)
  if (orphaned && d.opener instanceof HTMLElement && d.opener.isConnected && !d.opener.closest('[inert]')) {
    d.opener.focus({ preventScroll: true })
  }
}

/**
 * Give a dialog its behaviour. `panel` is the element with role="dialog". With `when`,
 * the dialog is only "up" while that's true (a dialog that is v-if'd in and out doesn't
 * need it). `within` limits what goes inert: a confirm that covers one card only.
 * `focus: 'first'` lands on the first control instead of the panel (a one-button confirm).
 */
export function useDialog(
  panel: Ref<HTMLElement | undefined>,
  close: () => void,
  options: { when?: Ref<boolean>; within?: Ref<HTMLElement | undefined>; focus?: 'panel' | 'first' } = {},
): void {
  let current: Open | undefined

  function up(): void {
    if (current || !panel.value) return
    current = {
      panel: panel.value,
      close,
      focus: options.focus ?? 'panel',
      within: options.within?.value,
      opener: document.activeElement,
      inerted: [],
    }
    show(current)
  }

  function down(): void {
    if (!current) return
    hide(current)
    current = undefined
  }

  onMounted(() => {
    if (options.when) {
      // After the render, so a panel brought in by the same change is there to focus.
      watch(options.when, (on) => (on ? up() : down()), { immediate: true, flush: 'post' })
    } else up()
  })
  onBeforeUnmount(down)
}
