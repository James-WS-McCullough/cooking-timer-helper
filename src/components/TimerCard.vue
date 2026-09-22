<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useDialog } from '../lib/dialog'
import { formatClock, formatDuration, formatSince } from '../lib/format'
import {
  elapsedMs,
  firingAlert,
  nextAlert,
  remainingMs,
  statusOf,
  type Timer,
  waitProgress,
  waitRemainingMs,
} from '../lib/timer'
import {
  acknowledgeTimer,
  completeTimer,
  extendTimer,
  pauseTimer,
  removeRun,
  removeTimer,
  resumeTimer,
  stepsAfter,
} from '../store'
import FoodIcon from './FoodIcon.vue'
import NextStepButton from './NextStepButton.vue'

const props = defineProps<{ timer: Timer; now: number; pulse: number }>()
const emit = defineEmits<{ alerts: []; next: [] }>()

// In a recipe: how many steps follow; ✕ then takes the whole chain with it.
const following = computed(() => stepsAfter(props.timer))
const inRecipe = computed(() => !!props.timer.step)
function remove() {
  if (props.timer.step) removeRun(props.timer.step.runId)
  else removeTimer(props.timer.id)
}

const hasAlerts = computed(() => props.timer.plan.kind !== 'none')

const MIN = 60_000
const MORE = 30_000 // the one "bit longer" step; tap it as many times as needed

const status = computed(() => statusOf(props.timer))
const pending = computed(() => ['alert', 'finished', 'due'].includes(status.value))
const remaining = computed(() => remainingMs(props.timer, props.now))
// A waiting (synced) card counts down to when the dish goes on, not the cook itself.
const waiting = computed(() => status.value === 'waiting')
const clock = computed(() => (waiting.value ? waitRemainingMs(props.timer, props.now) : remaining.value))
const progress = computed(() =>
  waiting.value ? waitProgress(props.timer, props.now) : elapsedMs(props.timer, props.now) / props.timer.durationMs,
)
const title = computed(() => props.timer.name || `${formatDuration(props.timer.durationMs)} timer`)

// What to do and to what, in one line: "Flip Potatoes", "Rice ready".
const headline = computed(() => {
  if (status.value === 'finished') return `${title.value} ready`
  if (status.value === 'due') return props.timer.name ? `Start ${props.timer.name}` : `Start · ${title.value}`
  const label = firingAlert(props.timer)?.label ?? ''
  return props.timer.name ? `${label} ${props.timer.name}` : `${label} · ${title.value}`
})

const hint = computed(() => {
  if (status.value === 'waiting')
    return props.timer.waitLeftMs != null ? 'Paused' : `then ${formatDuration(props.timer.durationMs)}`
  if (status.value === 'prepped') {
    const { kind, label, everyMs } = props.timer.plan
    if (kind === 'half') return `${label} halfway`
    if (kind === 'every') return `${label} every ${formatDuration(everyMs)}`
    return 'Ready to start'
  }
  if (status.value === 'paused') return 'Paused'
  const next = nextAlert(props.timer)
  if (!next) return `of ${formatDuration(props.timer.durationMs)}`
  return `${next.label} in ${formatClock(next.atMs - elapsedMs(props.timer, props.now))}`
})

const pendingNote = computed(() => {
  if (status.value === 'due') return `${formatDuration(props.timer.durationMs)} timer`
  if (props.timer.finishedAt !== null) return `${formatSince(props.now - props.timer.finishedAt)} ago`
  return `${formatClock(remaining.value)} left`
})

// Removing takes two taps so a stray touch can't kill a timer. The first dims the
// card like a small modal with a Remove button in its centre; a tap anywhere else
// (on the card or off it) backs out, and it backs out by itself if left alone, so a
// live Remove button is never sitting there waiting for an elbow.
const confirming = ref(false)
const card = ref<HTMLElement>()
const confirmBox = ref<HTMLElement>()
const confirmButton = ref<HTMLElement>()
// Keyboard and screen reader: focus lands on Remove, the rest of the card is inert meanwhile, Escape backs out.
useDialog(confirmBox, () => (confirming.value = false), { when: confirming, within: card, focus: 'first' })
let backOut: ReturnType<typeof setTimeout> | undefined

function dismissOnOutsideTap(e: Event) {
  if (!confirmButton.value?.contains(e.target as Node)) confirming.value = false
}

watch(confirming, (on) => {
  clearTimeout(backOut)
  if (on) {
    backOut = setTimeout(() => (confirming.value = false), 5000)
    document.addEventListener('pointerdown', dismissOnOutsideTap, true)
  } else {
    document.removeEventListener('pointerdown', dismissOnOutsideTap, true)
  }
})

onBeforeUnmount(() => {
  clearTimeout(backOut)
  document.removeEventListener('pointerdown', dismissOnOutsideTap, true)
})
</script>

<template>
  <article ref="card" class="card" :class="`is-${status}`" :aria-label="title">
    <!-- Needs the cook: headline, then one unmissable button -->
    <template v-if="pending">
      <!-- Re-created on every reminder sound, which replays its one-shot animation. -->
      <span :key="pulse" class="shimmer" aria-hidden="true" />
      <header class="top">
        <FoodIcon :name="timer.name" class="icon" />
        <h2 class="headline">{{ headline }}</h2>
        <span class="note tabular">{{ pendingNote }}</span>
      </header>

      <template v-if="status === 'finished'">
        <!-- Only seen while the card clears; a real element so its animation can't end the card's early. -->
        <span class="tick" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="44" height="44">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <div class="finish">
          <button class="big" :aria-label="`Done, ${title}`" @click="completeTimer(timer.id)">Done</button>
          <button class="ghost" :aria-label="`30 seconds more for ${title}`" @click="extendTimer(timer.id, MORE)">+30s</button>
        </div>
      </template>
      <!-- Synced dish: its pre-timer is up. The cook confirms it's on, and the real timer starts. -->
      <button v-else-if="status === 'due'" class="big" :aria-label="`Start ${title}`" @click="resumeTimer(timer.id)">Start</button>
      <button v-else class="big" :aria-label="`Done, ${title}${timer.pausedBy === 'alert' ? ', resume' : ''}`" @click="acknowledgeTimer(timer.id)">
        {{ timer.pausedBy === 'alert' ? 'Done · resume' : 'Done' }}
      </button>
    </template>

    <template v-else>
      <header class="top">
        <FoodIcon :name="timer.name" class="icon" />
        <h2 class="name">{{ title }}</h2>
        <button
          class="bell"
          :class="{ set: hasAlerts }"
          :aria-label="hasAlerts ? `Change alerts for ${title}` : `Add a flip or stir alert to ${title}`"
          @click="emit('alerts')"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :fill="hasAlerts ? 'currentColor' : 'none'">
            <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
            <path d="M10 19.5a2.2 2.2 0 0 0 4 0" fill="none" />
          </svg>
        </button>
        <NextStepButton :name="title" :following="following" @click="emit('next')" />
        <button class="remove" :aria-label="`Remove ${title}`" @click="confirming = true">✕</button>
      </header>

      <div class="main">
        <!-- Changes every second: must never be read aloud on its own. -->
        <div class="reading">
          <p class="clock tabular" :class="{ long: clock >= 60 * MIN }" role="timer" aria-live="off">
            <small v-if="waiting">Start in</small>
            {{ formatClock(clock) }}
          </p>
          <!-- Under the clock rather than beside the name: the header has three buttons already. -->
          <span class="note hint tabular">{{ hint }}</span>
        </div>
        <!-- Synced and waiting: it will ask when it's time, but it can go on early -->
        <button v-if="waiting" class="ctl early" :aria-label="`Start ${title} now`" @click="resumeTimer(timer.id)">Start now</button>
        <!-- Prepped: nothing to adjust yet, just the way to set it going -->
        <button v-else-if="status === 'prepped'" class="ctl go" :aria-label="`Start ${title}`" @click="resumeTimer(timer.id)">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" fill="currentColor" />
          </svg>
          Start
        </button>
        <span v-else class="actions">
          <button class="ctl more" :aria-label="`30 seconds more for ${title}`" @click="extendTimer(timer.id, MORE)">+30s</button>
          <button v-if="status === 'running'" class="ctl" :aria-label="`Pause ${title}`" @click="pauseTimer(timer.id)">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
              <rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
            </svg>
          </button>
          <button v-else class="ctl play" :aria-label="`Resume ${title}`" @click="resumeTimer(timer.id)">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" fill="currentColor" />
            </svg>
          </button>
        </span>
      </div>

      <!-- "Are you sure?", as a little modal over this card only -->
      <Transition name="confirm">
        <div v-if="confirming" ref="confirmBox" class="confirm" role="alertdialog" aria-modal="true" :aria-label="inRecipe ? `Remove ${title} and the steps with it?` : `Remove ${title}?`">
          <button ref="confirmButton" class="confirm-button" :aria-label="`Remove ${title}`" @click="remove">{{ inRecipe ? 'Remove all' : 'Remove' }}</button>
        </div>
      </Transition>

      <div class="bar" aria-hidden="true">
        <div class="fill" :style="{ width: `${progress * 100}%` }" />
        <span
          v-for="a in waiting ? [] : timer.alerts"
          :key="a.id"
          class="mark"
          :class="{ passed: a.state === 'done' }"
          :style="{ left: `${(a.atMs / timer.durationMs) * 100}%` }"
        />
      </div>
    </template>
  </article>
</template>

<style scoped>
.card {
  container-type: inline-size;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 16px 14px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.top {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
}

.icon {
  font-size: 1.25rem;
  margin-right: -2px;
}

.name,
.headline {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name {
  font-size: 1.1rem;
  font-weight: 650;
}

.note {
  flex: none;
  color: var(--text-dim);
  font-weight: 600;
}

.reading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hint {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Mid-way alerts live here, not in the wizard. Amber once set, to match the dots on the bar. */
.bell {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -4px -8px;
  border-radius: 10px;
  color: var(--text-dim);
}

.bell.set {
  color: var(--alert);
}

.bell:active {
  transform: scale(0.9);
}

.remove {
  flex: none;
  min-width: 44px;
  height: 44px;
  padding: 0 10px;
  margin: -4px -12px -4px -6px;
  border-radius: 10px;
  color: var(--text-dim);
  font-weight: 600;
}

/* Covers the card (and its border), so everything under it is dimmed and untappable.
   Its own red border is drawn on top of the blur, so it stays crisp: that's what
   says which card is about to go. */
.confirm {
  position: absolute;
  inset: -2px;
  z-index: 2;
  display: grid;
  place-items: center;
  border: 3px solid var(--danger);
  border-radius: calc(var(--radius) + 2px);
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  -webkit-backdrop-filter: blur(1.5px);
  backdrop-filter: blur(1.5px);
}

.confirm-button {
  min-width: 160px;
  min-height: 56px;
  padding: 0 28px;
  border-radius: 28px;
  background: var(--danger);
  color: var(--on-danger);
  font-size: 1.25rem;
  font-weight: 800;
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
}

.confirm-button:active {
  transform: scale(0.95);
}

/* The dim fades; the button pops in over it and ducks out a little quicker. */
.confirm-enter-active {
  transition: opacity 0.18s ease;
}

.confirm-leave-active {
  transition: opacity 0.14s ease;
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

.confirm-enter-active .confirm-button {
  animation: confirm-pop 0.3s cubic-bezier(0.3, 1.6, 0.5, 1) both;
}

.confirm-leave-active .confirm-button {
  transition: transform 0.14s ease-in;
  transform: scale(0.85);
}

@keyframes confirm-pop {
  from {
    transform: scale(0.6);
  }
}

.main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.clock {
  margin: 0;
  font-size: 2.9rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
}

.clock.long {
  font-size: 2.2rem;
}

.is-paused .clock {
  color: var(--text-dim);
}

/* ---- Prepped: set up, not started. Lemon and dashed, so it reads as "not live yet"
   and can't be mistaken for the solid amber of a flip alert. ---- */
.is-prepped {
  background: color-mix(in srgb, var(--prep) 9%, var(--surface));
  border: 2px dashed var(--prep-line);
  padding: 9px 15px 13px; /* the border is 1px thicker; keep the card the same size */
}

.is-prepped .clock,
.is-prepped .note {
  color: var(--prep-text);
}

.is-prepped .bar {
  background: color-mix(in srgb, var(--prep) 22%, var(--surface));
}

.is-prepped .fill {
  display: none;
}

/* ---- Synced (Sync Finish): violet. Waiting is tinted with a countdown to when it
   goes on; due is the solid "put it on now" card. ---- */
.is-waiting {
  background: color-mix(in srgb, var(--sync) 11%, var(--surface));
  border-color: color-mix(in srgb, var(--sync) 55%, var(--surface));
}

.is-waiting .clock,
.is-waiting .note {
  color: var(--sync-text);
}

.clock small {
  display: block;
  margin-bottom: 3px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.is-waiting .clock {
  font-size: 2.3rem;
}

.is-waiting .bar {
  background: color-mix(in srgb, var(--sync) 22%, var(--surface));
}

.is-waiting .fill {
  background: var(--sync);
}

.ctl.early {
  padding: 0 16px;
  border: 2px solid color-mix(in srgb, var(--sync) 70%, var(--surface));
  background: none;
  color: var(--sync-text);
}

.is-due {
  background: var(--sync);
  border-color: var(--sync);
  color: var(--on-sync);
  --glow: var(--sync);
}

.is-due .big {
  background: var(--on-sync);
  color: var(--sync);
}

.ctl.go {
  display: flex;
  gap: 8px;
  padding: 0 20px 0 16px;
  background: var(--prep);
  color: var(--on-prep);
  font-size: 1.15rem;
  font-weight: 800;
}

.actions {
  display: flex;
  gap: 6px;
}

.ctl {
  display: grid;
  place-items: center;
  min-width: 50px;
  height: 48px;
  padding: 0 9px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-weight: 650;
}

.ctl.more {
  min-width: 72px;
}

.ctl.play {
  background: var(--accent);
  color: var(--on-accent);
}

.ctl:active,
.ghost:active,
.big:active {
  transform: scale(0.97);
}

.bar {
  position: relative;
  height: 12px;
  margin-top: 8px;
  border-radius: 6px;
  background: var(--surface-2);
}

/* Sized by width, not scaleX: scaling would squash the rounded end into a square one. */
.fill {
  height: 100%;
  min-width: 12px; /* never less than a full round cap */
  border-radius: 6px;
  background: var(--accent);
  transition: width 0.25s linear;
}

.is-paused .fill {
  background: var(--text-dim);
}

/* Where the flips happen along the way. */
.mark {
  position: absolute;
  top: 2px;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  background: var(--alert);
  box-shadow: 0 0 0 2px var(--surface);
}

.mark.passed {
  background: var(--text-dim);
}

/* The clock and its buttons share a row, so they give ground together when the
   card itself is narrow (small phone, or a tight column in the grid). */
@container (max-width: 345px) {
  .clock {
    font-size: 2.4rem;
  }
  .clock.long {
    font-size: 1.8rem;
  }
  .actions {
    gap: 5px;
  }
  .ctl {
    min-width: 44px;
    padding: 0 6px;
    font-size: 0.95rem;
  }
}

@container (max-width: 300px) {
  .clock {
    font-size: 2rem;
  }
  .clock.long {
    font-size: 1.45rem;
  }
  .headline {
    font-size: 1.3rem;
  }
}

/* ---- Needs attention: the whole card becomes the signal ---- */

.is-alert {
  background: var(--alert);
  border-color: var(--alert);
  color: var(--on-alert);
  --glow: var(--alert);
}

.is-finished {
  background: var(--done);
  border-color: var(--done);
  color: var(--on-done);
  --glow: var(--done);
}

.headline {
  font-size: 1.55rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.01em;
  /* The instruction matters more than staying on one line: wrap, don't cut off. */
  white-space: normal;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.is-alert .note,
.is-due .note,
.is-finished .note {
  color: inherit;
  opacity: 0.8;
}

/* The button is the card's text colour, its label the card's fill. */
.big {
  width: 100%;
  min-height: 64px;
  border-radius: var(--radius-sm);
  font-size: 1.5rem;
  font-weight: 800;
}

.is-alert .big {
  background: var(--on-alert);
  color: var(--alert);
}

.is-finished .big {
  background: var(--on-done);
  color: var(--done);
}

.finish {
  display: flex;
  gap: 8px;
}

.ghost {
  flex: none;
  min-width: 88px;
  font-size: 1.15rem;
  border-radius: var(--radius-sm);
  border: 2px solid currentColor;
  font-weight: 700;
  opacity: 0.85;
}

/* ---- Leaving ----
   Removed with ✕: a quick whisk away. Cleared with Done: the contents give way
   to a tick that pops, then the whole card lifts off. */
.card.cards-leave-active {
  animation: whisk 0.26s ease-in forwards;
}

@keyframes whisk {
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

.tick {
  position: absolute;
  inset: 0;
  display: none;
  place-items: center;
  color: var(--on-done);
}

.tick svg {
  box-sizing: content-box;
  padding: 12px;
  border-radius: 50%;
  background: var(--on-done);
  color: var(--done);
}

.card.is-finished.cards-leave-active {
  animation: lift-off 0.8s cubic-bezier(0.4, 0, 0.6, 1) forwards;
}

.card.is-finished.cards-leave-active > :not(.tick) {
  animation: give-way 0.1s ease-out forwards;
}

.card.is-finished.cards-leave-active .tick {
  display: grid;
}

.card.is-finished.cards-leave-active .tick svg {
  animation: pop 0.32s cubic-bezier(0.3, 1.6, 0.5, 1) both;
}

.card.is-finished.cards-leave-active .tick path {
  stroke-dasharray: 22;
  stroke-dashoffset: 22;
  animation: draw 0.16s ease-out 0.1s forwards;
}

@keyframes give-way {
  to {
    opacity: 0;
  }
}

@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes lift-off {
  0% {
    transform: scale(1);
  }
  14% {
    transform: scale(1.035);
  }
  28%,
  60% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-14px) scale(0.88);
  }
}

/* Plays once per reminder sound: the card flares and a band of light sweeps
   across it twice. It's an overlay so it never fights the grid's move animation. */
.shimmer {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  animation: flare 2.2s ease-out;
}

.shimmer::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 0.65) 50%, transparent 65%);
  transform: translateX(-100%);
  animation: sweep 1.1s ease-in-out 2;
}

@keyframes sweep {
  to {
    transform: translateX(100%);
  }
}

@keyframes flare {
  0%,
  50% {
    box-shadow:
      0 0 0 4px var(--glow),
      0 0 36px 6px var(--glow);
  }
  25%,
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .confirm-enter-active .confirm-button {
    animation: none;
  }
  .card.cards-leave-active,
  .card.is-finished.cards-leave-active {
    animation: give-way 0.2s ease-out forwards;
  }
  .card.is-finished.cards-leave-active .tick {
    display: none;
  }
  .shimmer,
  .shimmer::before {
    animation: none;
  }
  .shimmer::before {
    display: none;
  }
  .fill {
    transition: none;
  }
}
</style>
