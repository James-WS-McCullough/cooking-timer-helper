<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { formatDuration } from '../lib/format'
import { syncPlan } from '../lib/timer'
import { state, syncAndStart } from '../store'
import FoodIcon from './FoodIcon.vue'

const emit = defineEmits<{ close: [] }>()

const plan = computed(() => syncPlan(state.timers))

// The list is there to show the idea, not to be a schedule: past a few rows it
// would push the button off the screen. Every timer still gets synced.
const SHOWN = 4
const shown = computed(() => plan.value.slice(0, SHOWN))
const total = computed(() => Math.max(0, ...plan.value.map((p) => p.timer.durationMs)))

// "Ready at 18:42" is how a cook thinks; it keeps ticking forward while the sheet is open.
const readyAt = computed(() =>
  new Date(state.now + total.value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
)

function go() {
  syncAndStart()
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="sync-title">
      <header>
        <h2 id="sync-title">Sync Finish</h2>
        <button class="x" aria-label="Close" @click="emit('close')">✕</button>
      </header>

      <p class="lead">
        Want everything on the table at the same time? Sizzle starts your longest timer now, and gives the others a
        pre-timer that tells you when to put each one on, so they all finish together.
      </p>

      <ol class="plan">
        <li v-for="{ timer, delayMs } in shown" :key="timer.id">
          <FoodIcon :name="timer.name" class="icon" />
          <span class="what">
            <strong>{{ timer.name || 'Timer' }}</strong>
            <small>{{ formatDuration(timer.durationMs) }}</small>
          </span>
          <span class="when" :class="{ now: delayMs === 0 }">{{ delayMs === 0 ? 'Starts now' : `in ${formatDuration(delayMs)}` }}</span>
        </li>
        <li v-if="plan.length > SHOWN" class="more">...and so on.</li>
      </ol>

      <p class="foot-note">
        <strong class="ready-at">All ready at about {{ readyAt }}</strong> ({{ formatDuration(total) }} from now). When a pre-timer ends you'll be reminded until you press Start, so
        put the food on first.
      </p>

      <button class="go" @click="go">Sync Up &amp; Start!</button>
    </div>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.6);
  animation: fade 0.15s ease-out;
}

.panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: calc(100dvh - env(safe-area-inset-top) - 12px);
  overflow-y: auto;
  padding: 14px 20px calc(16px + env(safe-area-inset-bottom));
  border-radius: 24px 24px 0 0;
  border-top: 3px solid var(--sync);
  background: var(--surface);
  animation: rise 0.2s ease-out;
}

@media (min-width: 640px) {
  .scrim {
    align-items: center;
  }
  .panel {
    border-radius: 24px;
    padding-bottom: 20px;
  }
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--sync-text);
}

.x {
  width: 48px;
  height: 48px;
  margin-right: -10px;
  border-radius: 50%;
  color: var(--text-dim);
  font-size: 1.1rem;
}

.lead {
  margin: 4px 0 16px;
  line-height: 1.45;
}

.plan {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.plan li {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--sync) 11%, var(--surface));
}

.plan li.more {
  background: var(--surface-2);
  color: var(--text-dim);
  font-weight: 600;
}

.icon {
  font-size: 1.3rem;
}

.what {
  flex: 1;
  min-width: 0;
}

.what strong,
.what small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.what small {
  color: var(--text-dim);
}

.when {
  flex: none;
  font-weight: 700;
  color: var(--sync-text);
}

.when.now {
  padding: 3px 10px;
  border-radius: 10px;
  background: var(--sync);
  color: var(--on-sync);
}

.foot-note {
  margin: 14px 0 16px;
  font-size: 0.9rem;
  color: var(--text-dim);
}

/* Always reachable: if the panel has to scroll on a short screen, the button stays
   put and the explanation scrolls behind it. */
.ready-at {
  color: var(--text);
}

.go {
  position: sticky;
  bottom: 0; /* measured from inside the panel's padding, which already clears the safe area */
  flex: none;
  box-shadow: 0 40px 0 var(--surface); /* hides anything scrolling past underneath it */
  width: 100%;
  min-height: 68px;
  border-radius: var(--radius-sm);
  background: var(--sync);
  color: var(--on-sync);
  font-size: 1.45rem;
  font-weight: 800;
}

.go:active {
  transform: scale(0.98);
}

@media (max-height: 700px) {
  .lead {
    margin-bottom: 12px;
    font-size: 0.95rem;
    line-height: 1.4;
  }
  .plan li {
    min-height: 48px;
    padding-block: 3px;
  }
  .foot-note {
    margin: 10px 0 12px;
  }
  .go {
    min-height: 60px;
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
  .panel {
    animation: none;
  }
}
</style>
