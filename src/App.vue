<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TimerCard from './components/TimerCard.vue'
import NewTimerSheet from './components/NewTimerSheet.vue'
import { displayOrder } from './lib/timer'
import { play, soundReady } from './lib/audio'
import { state } from './store'

const sheetOpen = ref(false)

// The beep doubles as the tap that lets the browser sound the alarm later.
function openSheet() {
  void play('beep', true)
  sheetOpen.value = true
}

// Cards are sorted by what needs you first, then soonest to finish, but never
// while you're using them: each touch on the list postpones re-sorting until the
// list has been left alone for a few seconds, so a card can't slide out from
// under a finger tapping +30s. Then everything glides to its new place.
const REORDER_AFTER_IDLE_MS = 3000
let idleAt = 0
const shownOrder = ref<string[]>([])

function holdOrder() {
  idleAt = Date.now() + REORDER_AFTER_IDLE_MS
}

watch(
  () => state.now,
  (now) => {
    if (now < idleAt) return
    const next = displayOrder(state.timers, now).map((t) => t.id)
    if (next.join() !== shownOrder.value.join()) shownOrder.value = next
  },
  { immediate: true },
)

// Timers added while the order is held simply join the end until the next re-sort.
const ordered = computed(() => {
  const place = new Map(shownOrder.value.map((id, i) => [id, i]))
  return [...state.timers].sort((a, b) => (place.get(a.id) ?? Infinity) - (place.get(b.id) ?? Infinity))
})

// After a reload the browser won't play anything until the first tap.
const needsSoundTap = computed(() => !soundReady.value && state.timers.length > 0)

function onKey(e: KeyboardEvent) {
  const typing = e.target instanceof HTMLInputElement
  if (e.key === 'n' && !typing && !sheetOpen.value && !e.metaKey && !e.ctrlKey) {
    e.preventDefault()
    openSheet()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app">
    <button v-if="needsSoundTap" class="banner" @click="play('beep', true)">
      <strong>Tap to turn sound on</strong>
      <span>Your timers are still running, but the alarm is silent until you tap.</span>
    </button>

    <main>
      <TransitionGroup v-if="ordered.length" name="cards" tag="div" class="grid" @pointerdown="holdOrder">
        <TimerCard v-for="t in ordered" :key="t.id" :timer="t" :now="state.now" :pulse="state.pulse" />
      </TransitionGroup>

      <div v-else class="empty">
        <p class="empty-title">Nothing cooking</p>
        <p>Start a timer for each thing on the go. Add a flip or stir reminder and it'll tell you when.</p>
      </div>
    </main>

    <div class="dock">
      <button class="new" @click="openSheet">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        New timer
      </button>
    </div>

    <NewTimerSheet v-if="sheetOpen" @close="sheetOpen = false" />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: 1200px;
  margin: 0 auto;
  padding: calc(14px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left));
}

.banner {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  margin-bottom: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: var(--danger);
  color: #fff;
  text-align: left;
}

.banner span {
  font-size: 0.9rem;
  opacity: 0.9;
}

main {
  flex: 1;
  /* Leave room for the docked button. */
  padding-bottom: calc(110px + env(safe-area-inset-bottom));
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  gap: 12px;
  align-items: start;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  max-width: 320px;
  margin: 28vh auto 0;
  text-align: center;
  color: var(--text-dim);
}

.empty p {
  margin: 0;
}

.empty-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
}

.dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  padding: 24px 16px calc(16px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, var(--bg) 55%, transparent);
  pointer-events: none;
}

.new {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  max-width: 420px;
  min-height: 64px;
  border-radius: 32px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.3rem;
  font-weight: 800;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
  pointer-events: auto;
}

.new:active {
  transform: scale(0.97);
}

.cards-move {
  transition: transform 0.55s cubic-bezier(0.3, 0.9, 0.3, 1);
}

.cards-enter-active,
.cards-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.2s ease;
}

.cards-enter-from,
.cards-leave-to {
  opacity: 0;
  transform: scale(0.94);
}

.cards-leave-active {
  position: absolute;
  visibility: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .cards-move,
  .cards-enter-active,
  .cards-leave-active {
    transition: none;
  }
}
</style>
