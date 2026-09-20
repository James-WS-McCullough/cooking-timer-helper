<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TimerCard from './components/TimerCard.vue'
import TimerSheet from './components/TimerSheet.vue'
import SyncSheet from './components/SyncSheet.vue'
import SizzleLogo from './components/SizzleLogo.vue'
import { displayOrder, isPending, statusOf, syncable } from './lib/timer'
import { play, soundReady } from './lib/audio'
import { state } from './store'

// Which wizard is open, if any: start a timer now, or prep one for later.
const sheet = ref<'start' | 'prep' | null>(null)

// Rarely opened, and it brings a QR encoder with it: load it on demand.
const QrSheet = defineAsyncComponent(() => import('./components/QrSheet.vue'))
const qrOpen = ref(false)

// The beep doubles as the tap that lets the browser sound the alarm later.
// Prepping a meal: timers are set up and nothing has been started yet. The dock's
// big button always means "carry on with what I'm doing", so here it preps another
// and starting a live timer becomes the small, deliberate option. It stays
// available (kettle, par-boil…); it just shouldn't be what a thumb lands on.
const prepping = computed(() => state.timers.length > 0 && state.timers.every((t) => statusOf(t) === 'prepped'))

// Sync Finish is only worth offering once there's more than one dish to line up.
const canSync = computed(() => syncable(state.timers).length >= 2)
const syncOpen = ref(false)

function openSync() {
  void play('beep', true)
  syncOpen.value = true
}

// The bell on a card: edit that timer's mid-way alerts. Held by id, so the sheet
// simply goes away if the timer finishes or is removed while it's open.
const alertsForId = ref<string | null>(null)
const alertsFor = computed(() => {
  const t = state.timers.find((x) => x.id === alertsForId.value)
  return t && !isPending(t) ? t : undefined
})

// Forget the id once the sheet has gone, or it would pop back up by itself later
// (say, after the flip that interrupted it is confirmed).
watch(alertsFor, (t) => {
  if (!t) alertsForId.value = null
})

function openAlerts(id: string) {
  void play('beep', true)
  alertsForId.value = id
}

function openSheet(mode: 'start' | 'prep' = 'start') {
  void play('beep', true)
  sheet.value = mode
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

// A card that's leaving is lifted out of the grid (so its neighbours can glide
// up), which would normally make it jump to the grid's corner. Pin it where it was.
//
// The "is-clearing" class (which makes the neighbours wait a beat) is set on the
// DOM directly: going through reactive state would re-render the list, and a
// re-render makes TransitionGroup finish any glide in progress on the spot.
let clearing = 0
function pinInPlace(el: Element) {
  const card = el as HTMLElement
  card.style.top = `${card.offsetTop}px`
  card.style.left = `${card.offsetLeft}px`
  card.style.width = `${card.offsetWidth}px`
  clearing++
  card.parentElement?.classList.add('is-clearing')
}

function afterLeave() {
  if (--clearing <= 0) {
    clearing = 0
    document.querySelector('.grid')?.classList.remove('is-clearing')
  }
}

// After a reload the browser won't play anything until the first tap.
const needsSoundTap = computed(() => !soundReady.value && state.timers.length > 0)

function onKey(e: KeyboardEvent) {
  const typing = e.target instanceof HTMLInputElement
  if ((e.key === 'n' || e.key === 'p') && !typing && !sheet.value && !alertsFor.value && !syncOpen.value && !e.metaKey && !e.ctrlKey) {
    e.preventDefault()
    openSheet(e.key === 'p' ? 'prep' : 'start')
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app">
    <Transition name="banner">
      <button v-if="needsSoundTap" class="banner" @click="play('beep', true)">
        <strong>Tap to turn sound on</strong>
        <span>Your timers are still running, but the alarm is silent until you tap.</span>
      </button>
    </Transition>

    <main :class="{ 'with-sync': canSync }">
      <TransitionGroup
        name="cards"
        tag="div"
        class="grid"
        @pointerdown="holdOrder"
        @before-leave="pinInPlace"
        @after-leave="afterLeave"
      >
        <TimerCard v-for="t in ordered" :key="t.id" :timer="t" :now="state.now" :pulse="state.pulse" @alerts="openAlerts(t.id)" />
      </TransitionGroup>

      <!-- Nothing cooking: the way in is the whole screen -->
      <Transition name="welcome">
        <div v-if="!state.timers.length" class="welcome">
          <SizzleLogo class="logo" />
          <h1>Sizzle</h1>
          <button class="new" @click="openSheet('start')">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
            </svg>
            New timer
          </button>
          <button class="prep" @click="openSheet('prep')">Prep a timer</button>
          <p class="prep-note">Set timers up now, start each one when it's time.</p>
        </div>
      </Transition>
    </main>

    <Transition name="dock">
      <div v-if="state.timers.length" class="dock">
        <Transition name="sync">
          <button v-if="canSync" class="sync" @click="openSync">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 6h9M4 12h13M4 18h5" />
              <path d="M20 4v16" />
            </svg>
            Sync Finish
          </button>
        </Transition>
        <button class="new" :class="{ 'as-prep': prepping }" @click="openSheet(prepping ? 'prep' : 'start')">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          {{ prepping ? 'Prep another' : 'New timer' }}
        </button>
        <button v-if="prepping" class="prep as-new" aria-label="New timer that starts now" @click="openSheet('start')">New</button>
        <button v-else class="prep" aria-label="Prep a timer" @click="openSheet('prep')">Prep</button>
      </div>
    </Transition>

    <!-- Outside the start screen's own transition: a transformed parent would drag a fixed child around. -->
    <Transition name="welcome">
      <button v-if="!state.timers.length" class="qr-button" aria-label="Show a QR code to open Sizzle on another device" @click="qrOpen = true">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
          <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
          <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
          <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
          <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" stroke-linecap="round" />
        </svg>
      </button>
    </Transition>

    <SyncSheet v-if="syncOpen && canSync" @close="syncOpen = false" />
    <TimerSheet v-else-if="sheet" :prep="sheet === 'prep'" @close="sheet = null" />
    <TimerSheet v-else-if="alertsFor" :key="alertsFor.id" :alerts-for="alertsFor" @close="alertsForId = null" />
    <QrSheet v-if="qrOpen" @close="qrOpen = false" />
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
  display: flex;
  flex-direction: column;
  /* Leave room for the docked button. */
  padding-bottom: calc(110px + env(safe-area-inset-bottom));
}

main.with-sync {
  padding-bottom: calc(180px + env(safe-area-inset-bottom));
}

.grid {
  position: relative; /* anchor for cards pinned in place while they leave */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  gap: 12px;
  align-items: start;
}

.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.logo {
  width: 120px;
  height: 120px;
}

h1 {
  margin: 0 0 28px;
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.welcome .new {
  max-width: 320px;
}

/* Secondary everywhere it appears: outlined in the prep colour, never filled. */
.prep {
  min-height: 52px;
  padding: 0 26px;
  border-radius: 26px;
  border: 2px dashed var(--prep-line);
  background: color-mix(in srgb, var(--prep) 10%, var(--bg));
  color: var(--prep-text);
  font-size: 1.05rem;
  font-weight: 750;
}

.prep:active {
  transform: scale(0.97);
}

.welcome .prep {
  margin-top: 12px;
}

.prep-note {
  max-width: 260px;
  margin: 6px 0 0;
  font-size: 0.85rem;
  text-align: center;
  color: var(--text-dim);
}

/* Tucked in the corner of the start screen: hand the app to another device. */
.qr-button {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: calc(16px + env(safe-area-inset-bottom));
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-dim);
}

.qr-button:active {
  transform: scale(0.94);
}

.dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap; /* Sync Finish takes the row above New timer and Prep */
  justify-content: center;
  align-items: center;
  gap: 10px;
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

.dock .new {
  flex: 1;
}

/* Prepping: the two dock buttons trade looks as well as jobs. */
.new.as-prep {
  background: var(--prep);
  color: var(--on-prep);
}

.prep.as-new {
  border: 2px solid color-mix(in srgb, var(--accent) 70%, var(--bg));
  background: color-mix(in srgb, var(--accent) 12%, var(--bg));
  color: var(--accent-text);
}

.sync {
  flex: 0 0 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  max-width: 516px;
  min-height: 58px;
  border-radius: 29px;
  background: var(--sync);
  color: var(--on-sync);
  font-size: 1.2rem;
  font-weight: 800;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
  pointer-events: auto;
}

.sync:active {
  transform: scale(0.97);
}

.sync-enter-active,
.sync-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.3, 1.3, 0.5, 1),
    opacity 0.2s ease;
}

.sync-enter-from,
.sync-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}

.dock .prep {
  flex: none;
  min-height: 64px;
  border-radius: 32px;
  pointer-events: auto;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
}

.new:active {
  transform: scale(0.97);
}

.cards-move {
  transition: transform 0.55s cubic-bezier(0.3, 0.9, 0.3, 1);
}

/* Let a clearing card have its moment before the others close the gap. */
.is-clearing .cards-move {
  transition-delay: 0.42s;
}

.cards-enter-active {
  transition:
    transform 0.3s ease,
    opacity 0.2s ease;
}

.cards-enter-from {
  opacity: 0;
  transform: scale(0.94);
}

/* The leave animation itself belongs to the card (TimerCard.vue). */
.cards-leave-active {
  position: absolute;
  pointer-events: none;
}

/* Any tap turns sound on, including a tap aimed at a card. If the banner vanished
   on touch-down the page would jump before touch-up and that tap would miss, so
   it stays put while it fades and only then folds away. */
.banner-leave-active {
  overflow: hidden;
  max-height: 140px;
  transition:
    opacity 0.25s ease 0.15s,
    max-height 0.35s ease 0.45s,
    margin 0.35s ease 0.45s,
    padding 0.35s ease 0.45s;
}

.banner-leave-to {
  opacity: 0;
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* The start screen waits for the last card to finish leaving. */
.welcome-enter-active {
  transition:
    opacity 0.35s ease 0.6s,
    transform 0.45s cubic-bezier(0.3, 1.3, 0.5, 1) 0.6s;
}

.welcome-enter-from {
  opacity: 0;
  transform: scale(0.92);
}

.welcome-leave-active {
  display: none;
}

.dock-enter-active,
.dock-leave-active {
  transition:
    transform 0.35s cubic-bezier(0.3, 0.9, 0.3, 1),
    opacity 0.25s ease;
}

.dock-enter-from,
.dock-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .cards-move,
  .cards-enter-active,
  .welcome-enter-active,
  .dock-enter-active,
  .dock-leave-active,
  .sync-enter-active,
  .sync-leave-active {
    transition: none;
  }
}
</style>
