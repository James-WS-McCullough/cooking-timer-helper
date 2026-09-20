<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Direction } from './steps'

// The bottom sheet every step-by-step flow sits in: scrim, header (back, progress
// dots, close), the slide between steps, and an optional footer for a big button.
// It knows nothing about timers. Each step's content goes in the default slot.
const props = defineProps<{
  title: string
  steps: readonly string[]
  step: string
  direction: Direction
  canGoBack?: boolean
  badge?: string
  /** The lemon "for later" colour scheme. */
  prep?: boolean
  /** The step wants every pixel (searching): no header or title, and edge to edge if the visible area is short. */
  immersive?: boolean
}>()
const emit = defineEmits<{ close: []; back: []; submit: [] }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

// On phones the on-screen keyboard covers the bottom of the page without resizing
// it, which would bury most of the sheet. Track the area that's actually visible
// and fit the sheet to that instead.
//
// When what's left is short (a landscape tablet with the keyboard up leaves about
// 340px), the search switches to a compact layout: the sheet takes the whole
// visible area, edge to edge, and results flow in columns instead of one list.
const scrim = ref<HTMLElement>()
const shortView = ref(false)
const compact = computed(() => props.immersive && shortView.value)

function fitToVisibleArea() {
  const vv = window.visualViewport
  shortView.value = (vv?.height ?? window.innerHeight) < 520
  if (!vv || !scrim.value) return
  scrim.value.style.setProperty('--visible-height', `${vv.height}px`)
  scrim.value.style.setProperty('--visible-top', `${vv.offsetTop}px`)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.visualViewport?.addEventListener('resize', fitToVisibleArea)
  window.visualViewport?.addEventListener('scroll', fitToVisibleArea)
  fitToVisibleArea()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.visualViewport?.removeEventListener('resize', fitToVisibleArea)
  window.visualViewport?.removeEventListener('scroll', fitToVisibleArea)
})
</script>

<template>
  <div ref="scrim" class="scrim" @click.self="emit('close')">
    <form class="sheet" :class="{ prep, compact }" role="dialog" aria-modal="true" aria-labelledby="sheet-title" @submit.prevent="emit('submit')">
      <!-- While searching, every pixel goes to results: the header's back arrow moves into the step's search row -->
      <header v-show="!immersive" class="head">
        <button v-if="canGoBack" type="button" class="nav" aria-label="Back" @click="emit('back')">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <span v-else class="nav" />
        <div class="progress">
          <span v-if="badge" class="badge">{{ badge }}</span>
          <div class="dots" aria-hidden="true">
            <span v-for="s in steps" :key="s" :class="{ on: s === step }" />
          </div>
        </div>
        <button type="button" class="nav" aria-label="Close" @click="emit('close')">✕</button>
      </header>

      <Transition :name="direction" mode="out-in">
        <div :key="step" class="body">
          <h2 v-show="!immersive" id="sheet-title">{{ title }}</h2>
          <slot />
        </div>
      </Transition>

      <footer v-if="$slots.foot" class="foot">
        <slot name="foot" />
      </footer>
    </form>
  </div>
</template>

<!-- What the steps share (headings, switches, the big button…): they render in this
     sheet's slots, where its scoped styles can't reach, so those rules are plain CSS
     kept under `.sheet`. -->
<style src="./sheet.css"></style>

<style scoped>
.scrim {
  position: fixed;
  top: var(--visible-top, 0px);
  left: 0;
  right: 0;
  height: var(--visible-height, 100dvh);
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.55);
  animation: fade 0.15s ease-out;
}

/* Fixed height so the sheet doesn't jump around between steps. */
.sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  height: min(760px, calc(var(--visible-height, 100dvh) - env(safe-area-inset-top) - 12px));
  border-radius: 24px 24px 0 0;
  background: var(--surface);
  overflow: hidden;
  animation: rise 0.2s ease-out;
}

@media (min-width: 640px) {
  .scrim {
    align-items: center;
  }
  .sheet {
    border-radius: 24px;
    height: min(760px, calc(var(--visible-height, 100dvh) - 48px));
  }
}

/* Prep mode re-points the accent, so every highlight in the sheet turns lemon at once. */
.sheet.prep {
  --accent: var(--prep);
  --on-accent: var(--on-prep);
  --accent-text: var(--prep-text);
  border-top: 3px solid var(--prep);
}

.progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  padding: 3px 10px;
  border-radius: 10px;
  background: var(--prep);
  color: var(--on-prep);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 0;
}

.dots {
  display: flex;
  gap: 8px;
}

.dots span {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: var(--border);
  transition:
    width 0.2s,
    background 0.2s;
}

.dots span.on {
  width: 24px;
  background: var(--accent);
}

.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding: 4px 20px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

h2 {
  margin: 0 0 2px;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

/* Compact: a short visible area (keyboard up on a landscape tablet or phone).
   The sheet becomes the whole visible area. (What the step does with it is the step's business.) */
.sheet.compact {
  max-width: none;
  height: var(--visible-height, 100dvh);
  border-radius: 0;
  border-top: 0;
}

.sheet.compact .body {
  gap: 8px;
  padding-inline: max(20px, env(safe-area-inset-left)) max(20px, env(safe-area-inset-right));
}

.foot {
  padding: 12px 20px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
}

/* Steps slide in from the side you're heading towards. */
.fwd-enter-active,
.fwd-leave-active,
.back-enter-active,
.back-leave-active {
  transition:
    transform 0.12s ease,
    opacity 0.12s ease;
}

.fwd-enter-from,
.back-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.fwd-leave-to,
.back-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}

/* Small phones: tighten up so every step still fits without scrolling. */
@media (max-height: 700px) {
  .body {
    gap: 9px;
    padding-bottom: 12px;
  }
  h2 {
    font-size: 1.3rem;
  }
}

@keyframes fade {
  from {
    opacity: 0;
  }
}

@keyframes rise {
  from {
    transform: translateY(40px);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scrim,
  .sheet {
    animation: none;
  }
  .fwd-enter-active,
  .fwd-leave-active,
  .back-enter-active,
  .back-leave-active {
    transition: none;
  }
}
</style>
