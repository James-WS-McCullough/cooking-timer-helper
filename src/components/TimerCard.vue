<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { elapsedMs, firingAlert, nextAlert, remainingMs, statusOf, type Timer } from '../lib/timer'
import { formatClock, formatDuration, formatSince } from '../lib/format'
import { acknowledgeTimer, extendTimer, pauseTimer, removeTimer, resumeTimer } from '../store'

const props = defineProps<{ timer: Timer; now: number; pulse: number }>()

const MIN = 60_000

const status = computed(() => statusOf(props.timer))
const remaining = computed(() => remainingMs(props.timer, props.now))
const progress = computed(() => elapsedMs(props.timer, props.now) / props.timer.durationMs)
const title = computed(() => props.timer.name || `${formatDuration(props.timer.durationMs)} timer`)
const firing = computed(() => firingAlert(props.timer))

const upcoming = computed(() => {
  const next = nextAlert(props.timer)
  if (!next) return null
  const inMs = next.atMs - elapsedMs(props.timer, props.now)
  return `${next.label} in ${formatClock(inMs)}`
})

const overtime = computed(() =>
  props.timer.finishedAt === null ? '' : formatSince(props.now - props.timer.finishedAt),
)

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
    <!-- Re-created on every reminder sound, which replays its one-shot animation. -->
    <span v-if="status === 'alert' || status === 'finished'" :key="pulse" class="shimmer" aria-hidden="true" />
    <header class="top">
      <h2 class="name">{{ title }}</h2>
      <button
        v-if="status === 'running' || status === 'paused'"
        class="remove"
        :class="{ armed }"
        :aria-label="armed ? `Confirm remove ${title}` : `Remove ${title}`"
        @click="onRemove"
      >
        {{ armed ? 'Remove?' : '✕' }}
      </button>
      <span v-else-if="status === 'finished'" class="sub tabular">{{ overtime }} ago</span>
      <span v-else class="sub tabular">
        {{ formatClock(remaining) }} left<template v-if="timer.pausedBy === 'alert'"> · held</template>
      </span>
    </header>

    <!-- Finished: one unmissable button -->
    <template v-if="status === 'finished'">
      <p class="headline">Ready!</p>
      <button class="big" @click="removeTimer(timer.id)">Done</button>
      <div class="more">
        <button class="ghost" @click="extendTimer(timer.id, MIN / 2)">+30s</button>
        <button class="ghost" @click="extendTimer(timer.id, MIN)">+1 min</button>
        <button class="ghost" @click="extendTimer(timer.id, 3 * MIN)">+3 min</button>
      </div>
    </template>

    <!-- Mid-way alert: flip, stir… -->
    <template v-else-if="status === 'alert' && firing">
      <p class="headline">{{ firing.label }} now</p>
      <button class="big" @click="acknowledgeTimer(timer.id)">
        {{ timer.pausedBy === 'alert' ? 'Done · resume' : 'Done' }}
      </button>
    </template>

    <template v-else>
      <p class="clock tabular" role="timer">{{ formatClock(remaining) }}</p>

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

      <footer class="bottom">
        <span class="hint tabular">
          {{ status === 'paused' ? 'Paused' : (upcoming ?? `of ${formatDuration(timer.durationMs)}`) }}
        </span>
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
      </footer>
    </template>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px 18px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  min-height: 190px;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
}

.name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove {
  flex: none;
  min-width: 40px;
  height: 40px;
  padding: 0 10px;
  margin-right: -8px;
  border-radius: 10px;
  color: var(--text-dim);
  font-weight: 600;
}

.remove.armed {
  background: var(--danger);
  color: #fff;
  margin-right: 0;
}

.clock {
  margin: 0;
  font-size: clamp(3rem, 15vw, 4rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
}

.is-paused .clock {
  color: var(--text-dim);
}

.bar {
  position: relative;
  height: 8px;
  margin: 6px 0 2px;
  border-radius: 4px;
  background: var(--surface-2);
}

.fill {
  height: 100%;
  border-radius: 4px;
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
  height: 16px;
  margin-left: -2px;
  border-radius: 2px;
  background: var(--alert);
  box-shadow: 0 0 0 2px var(--surface);
}

.mark.passed {
  background: var(--text-dim);
}

.bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
}

.hint {
  color: var(--text-dim);
  font-weight: 550;
}

.actions {
  display: flex;
  gap: 8px;
}

.ctl {
  display: grid;
  place-items: center;
  min-width: var(--tap);
  height: 46px;
  padding: 0 10px;
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
  margin: 0;
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.01em;
}

.sub {
  flex: none;
  font-weight: 650;
  opacity: 0.8;
}

.big {
  margin-top: auto;
  width: 100%;
  min-height: 76px;
  border-radius: var(--radius-sm);
  background: currentColor;
  font-size: 1.6rem;
  font-weight: 800;
}

/* currentColor trick: the button is the card's text colour, its label the card's fill. */
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
  gap: 8px;
}

.ghost {
  flex: 1;
  min-height: 46px;
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
