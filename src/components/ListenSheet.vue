<script setup lang="ts">
// The mic: say "rice, 10 minutes" and get that timer. One screen at a time: (the first
// time only) what it is and what it downloads, then listening, then what it heard with
// one big button to start it. A wrong guess costs a tap on "Try again", never a wrong timer.
// Heard a name but no time? The wizard takes over at "How long?".
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatClock } from '../lib/format'
import { finishListening, ListenError, listen, mic, micReady, stopListening } from '../lib/listen'
import { parseSpoken, type Spoken } from '../lib/spoken'
import { NO_ALERTS } from '../lib/timer'
import { startTimer } from '../store'
import FoodIcon from './FoodIcon.vue'
import MicIcon from './MicIcon.vue'

const emit = defineEmits<{ close: []; time: [name: string, prep: boolean] }>()

const view = ref<'intro' | 'busy' | 'result' | 'missed' | 'failed'>(micReady() ? 'busy' : 'intro')
const heard = ref('')
const result = ref<Spoken & { durationMs: number }>()
const failure = ref<'mic' | 'model'>('model')

const busyTitle = computed(() => {
  if (mic.phase === 'listening') return 'Listening…'
  if (mic.phase === 'thinking') return 'Working it out…'
  return mic.downloading === null ? 'Getting ready…' : `Downloading ${Math.round(mic.downloading * 100)}%`
})

async function hear() {
  view.value = 'busy'
  try {
    const text = await listen()
    if (text === null) return // called off
    heard.value = text
    const spoken = parseSpoken(text)
    if (spoken.durationMs !== null) {
      result.value = { ...spoken, durationMs: spoken.durationMs }
      view.value = 'result'
    } else if (spoken.name) emit('time', spoken.name, spoken.prep)
    else view.value = 'missed'
  } catch (err) {
    failure.value = err instanceof ListenError ? err.what : 'model'
    view.value = 'failed'
  }
}

function confirm() {
  if (!result.value) return
  startTimer(result.value.name, result.value.durationMs, NO_ALERTS, result.value.prep)
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  if (view.value === 'busy') void hear()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  stopListening()
})
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div class="panel" :class="{ prep: view === 'result' && result?.prep }" role="dialog" aria-modal="true" aria-labelledby="listen-title">
      <button class="x" aria-label="Close" @click="emit('close')">✕</button>

      <template v-if="view === 'intro'">
        <span class="disc"><MicIcon :size="44" /></span>
        <h2 id="listen-title">Say it instead</h2>
        <p class="lead">Tap the mic, then say the food and the time: “rice, 10 minutes”.</p>
        <p class="small">The first use downloads a speech model (about 65 MB), so Wi-Fi is best. After that it works offline, and what you say never leaves this device.</p>
        <button class="main" @click="hear">Turn on the mic</button>
        <button class="other" @click="emit('close')">Not now</button>
      </template>

      <template v-else-if="view === 'busy'">
        <span class="disc" :class="{ live: mic.phase === 'listening', waiting: mic.phase !== 'listening' }">
          <!-- A real element, not a pseudo: it grows with the cook's voice. -->
          <span class="ring" :style="{ transform: `scale(${1 + mic.level * 0.6})` }" />
          <MicIcon :size="44" />
        </span>
        <h2 id="listen-title" role="status">{{ busyTitle }}</h2>
        <template v-if="mic.phase === 'listening'">
          <p class="lead">“Rice, 10 minutes”</p>
          <p class="small">Start with “prepare” to set it up for later.</p>
          <button class="main" @click="finishListening">Done</button>
        </template>
      </template>

      <template v-else-if="view === 'result' && result">
        <FoodIcon class="food" :name="result.name" />
        <h2 id="listen-title">{{ result.name || 'Timer' }}</h2>
        <p class="clock tabular">{{ formatClock(result.durationMs) }}</p>
        <p class="small">I heard “{{ heard }}”</p>
        <button class="main" @click="confirm">{{ result.prep ? 'Prep' : 'Start' }} {{ formatClock(result.durationMs) }}</button>
        <button class="other" @click="hear">Try again</button>
      </template>

      <template v-else-if="view === 'missed'">
        <h2 id="listen-title">Didn't catch that</h2>
        <p class="lead">{{ heard ? `I heard “${heard}”` : "I couldn't hear anything." }}</p>
        <p class="small">Say the food and the time: “rice, 10 minutes”.</p>
        <button class="main" @click="hear">Try again</button>
      </template>

      <template v-else>
        <h2 id="listen-title">{{ failure === 'mic' ? "Can't use the microphone" : "Couldn't load the speech model" }}</h2>
        <p class="small" role="alert">
          {{ failure === 'mic' ? "Allow the microphone for Sizzle in your browser's settings, then try again." : 'It needs a connection the first time. Check yours, then try again.' }}
        </p>
        <button class="main" @click="hear">Try again</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 0.6);
  animation: fade 0.15s ease-out;
}

.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 340px;
  min-height: 300px;
  padding: 28px 24px 20px;
  border-radius: 24px;
  background: var(--surface);
  text-align: center;
  animation: pop 0.25s cubic-bezier(0.3, 1.3, 0.5, 1);
}

.x {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: var(--text-dim);
  font-size: 1.1rem;
}

.disc {
  position: relative;
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  margin: 8px 0 10px;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--accent-text);
}

.disc.live {
  background: var(--accent);
  color: var(--on-accent);
}

.disc svg {
  position: relative;
}

.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 35%, transparent);
  opacity: 0;
  transition: transform 0.08s linear;
}

.live .ring {
  opacity: 1;
}

.disc.waiting {
  animation: busy 1.1s ease-in-out infinite;
}

.food {
  width: 72px;
  height: 72px;
  margin-top: 4px;
}

h2 {
  margin: 4px 0 6px;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.clock {
  margin: -4px 0 6px;
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.lead {
  margin: 0 0 10px;
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.4;
}

.small {
  margin: 0 0 18px;
  font-size: 0.85rem;
  color: var(--text-dim);
  text-wrap: balance;
}

.main,
.other {
  width: 100%;
  border-radius: var(--radius-sm);
  font-weight: 800;
}

.main {
  min-height: 60px;
  margin-top: auto;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.3rem;
}

.prep .main {
  background: var(--prep);
  color: var(--on-prep);
}

.other {
  min-height: 48px;
  margin-top: 6px;
  color: var(--text-dim);
  font-weight: 650;
}

.main:active,
.other:active {
  transform: scale(0.98);
}

@keyframes busy {
  50% {
    transform: scale(0.94);
    opacity: 0.75;
  }
}

@keyframes fade {
  from {
    opacity: 0;
  }
}

@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scrim,
  .panel,
  .disc.waiting {
    animation: none;
  }
  .ring {
    transition: none;
  }
}
</style>
