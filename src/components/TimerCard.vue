<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { elapsedMs, firingAlert, nextAlert, remainingMs, statusOf, type Timer } from '../lib/timer'
import { formatClock, formatDuration, formatSince } from '../lib/format'
import { acknowledgeTimer, extendTimer, pauseTimer, removeTimer, resumeTimer } from '../store'
import FoodIcon from './FoodIcon.vue'

const props = defineProps<{ timer: Timer; now: number; pulse: number }>()

const MIN = 60_000

const status = computed(() => statusOf(props.timer))
const pending = computed(() => status.value === 'alert' || status.value === 'finished')
const remaining = computed(() => remainingMs(props.timer, props.now))
const progress = computed(() => elapsedMs(props.timer, props.now) / props.timer.durationMs)
const title = computed(() => props.timer.name || `${formatDuration(props.timer.durationMs)} timer`)

// What to do and to what, in one line: "Flip Potatoes", "Rice ready".
const headline = computed(() => {
  if (status.value === 'finished') return `${title.value} ready`
  const label = firingAlert(props.timer)?.label ?? ''
  return props.timer.name ? `${label} ${props.timer.name}` : `${label} · ${title.value}`
})

const hint = computed(() => {
  if (status.value === 'paused') return 'Paused'
  const next = nextAlert(props.timer)
  if (!next) return `of ${formatDuration(props.timer.durationMs)}`
  return `${next.label} in ${formatClock(next.atMs - elapsedMs(props.timer, props.now))}`
})

const pendingNote = computed(() => {
  if (props.timer.finishedAt !== null) return `${formatSince(props.now - props.timer.finishedAt)} ago`
  return `${formatClock(remaining.value)} left`
})

// Two-tap delete: the first tap arms it for a few seconds, so a stray touch can't kill a timer.
const armed = ref(false)
let disarm: ReturnType<typeof setTimeout> | undefined
function onRemove() {
  if (armed.value) return removeTimer(props.timer.id)
  armed.value = true
  disarm = setTimeout(() => (armed.value = false), 3000)
}
onBeforeUnmount(() => clearTimeout(disarm))
</script>

<template>
  <article class="card" :class="`is-${status}`" :aria-label="title">
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
        <button class="big" @click="removeTimer(timer.id)">Done</button>
        <div class="more">
          <button class="ghost" @click="extendTimer(timer.id, MIN / 2)">+30s</button>
          <button class="ghost" @click="extendTimer(timer.id, MIN)">+1 min</button>
          <button class="ghost" @click="extendTimer(timer.id, 3 * MIN)">+3 min</button>
        </div>
      </template>
      <button v-else class="big" @click="acknowledgeTimer(timer.id)">
        {{ timer.pausedBy === 'alert' ? 'Done · resume' : 'Done' }}
      </button>
    </template>

    <template v-else>
      <header class="top">
        <FoodIcon :name="timer.name" class="icon" />
        <h2 class="name">{{ title }}</h2>
        <span class="note tabular">{{ hint }}</span>
        <button
          class="remove"
          :class="{ armed }"
          :aria-label="armed ? `Confirm remove ${title}` : `Remove ${title}`"
          @click="onRemove"
        >
          {{ armed ? 'Remove?' : '✕' }}
        </button>
      </header>

      <div class="main">
        <p class="clock tabular" :class="{ long: remaining >= 60 * MIN }" role="timer">{{ formatClock(remaining) }}</p>
        <span class="actions">
          <button class="ctl" @click="extendTimer(timer.id, MIN / 2)">+30s</button>
          <button class="ctl" @click="extendTimer(timer.id, MIN)">+1m</button>
          <button v-if="status === 'running'" class="ctl" aria-label="Pause" @click="pauseTimer(timer.id)">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
              <rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
            </svg>
          </button>
          <button v-else class="ctl play" aria-label="Resume" @click="resumeTimer(timer.id)">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" fill="currentColor" />
            </svg>
          </button>
        </span>
      </div>

      <div class="bar" aria-hidden="true">
        <div class="fill" :style="{ transform: `scaleX(${progress})` }" />
        <span
          v-for="a in timer.alerts"
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

.remove {
  flex: none;
  min-width: 40px;
  height: 36px;
  padding: 0 10px;
  margin: 0 -10px 0 -6px;
  border-radius: 10px;
  color: var(--text-dim);
  font-weight: 600;
}

.remove.armed {
  background: var(--danger);
  color: #fff;
  margin-right: 0;
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
  height: 6px;
  margin-top: 8px;
  border-radius: 3px;
  background: var(--surface-2);
}

.fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transform-origin: left;
  transition: transform 0.25s linear;
}

.is-paused .fill {
  background: var(--text-dim);
}

/* Where the flips happen along the way. */
.mark {
  position: absolute;
  top: -4px;
  width: 4px;
  height: 14px;
  margin-left: -2px;
  border-radius: 2px;
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

.more {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.ghost {
  flex: 1;
  min-height: 42px;
  border-radius: var(--radius-sm);
  border: 2px solid currentColor;
  font-weight: 700;
  opacity: 0.85;
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
  .shimmer::before {
    display: none;
  }
  .fill {
    transition: none;
  }
}
</style>
