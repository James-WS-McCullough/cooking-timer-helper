<script setup lang="ts">
import { computed } from 'vue'
import { formatDuration } from '../../lib/format'
import { recentTimes } from '../../lib/history'
import { state } from '../../store'
import FoodIcon from '../FoodIcon.vue'

// "How long?": tapping a number starts (or preps) the timer, so it's reported
// straight away. A typed time is the exception: the wizard checks it and offers a
// button for it.
const props = defineProps<{ name: string; invalid?: boolean }>()
const emit = defineEmits<{ start: [ms: number] }>()

const customTime = defineModel<string>('customTime', { required: true })
const keepAsPreset = defineModel<boolean>('keepAsPreset', { required: true })

const MIN = 60_000
// Two groups rather than one wall of tiles: every minute up to ten (a complete run
// is quicker to scan than one with gaps), then the usual longer cooks on their own row.
const SHORTER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const LONGER = [12, 15, 20, 25, 30]

// What this name was timed for last time(s): usually exactly what's wanted again.
const lastTimes = computed(() => recentTimes(state.history, props.name))
</script>

<template>
  <p class="recap"><FoodIcon :name="name" />{{ name.trim() || 'Timer' }}</p>

  <section v-if="lastTimes.length">
    <h3>Last time</h3>
    <div class="last-times">
      <button v-for="ms in lastTimes" :key="ms" type="button" class="chip last-time tabular" @click="emit('start', ms)">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12a8 8 0 1 0 2.6-5.9" />
          <path d="M4 4.5v4h4" />
        </svg>
        {{ formatDuration(ms) }}
      </button>
    </div>
  </section>

  <section>
    <h3>Shorter</h3>
    <div class="times">
      <button v-for="m in SHORTER" :key="m" type="button" class="chip big-num" @click="emit('start', m * MIN)">{{ m }}</button>
    </div>
  </section>

  <section>
    <h3>Longer</h3>
    <div class="times longer">
      <button v-for="m in LONGER" :key="m" type="button" class="chip big-num" @click="emit('start', m * MIN)">{{ m }}</button>
    </div>
  </section>
  <input
    v-model="customTime"
    class="field"
    :class="{ bad: invalid }"
    :aria-invalid="invalid || undefined"
    :aria-describedby="invalid ? 'time-problem' : undefined"
    inputmode="decimal"
    autocomplete="off"
    enterkeyhint="go"
    placeholder="Other minutes: 45, 1.5 or 1:30"
    aria-label="Custom time in minutes"
  />
  <button type="button" class="switch-row" role="switch" :aria-checked="keepAsPreset" @click="keepAsPreset = !keepAsPreset">
    <span>
      <strong>Save as preset</strong>
      <small>Turn on before picking the time</small>
    </span>
    <span class="switch" aria-hidden="true" />
  </button>
</template>

<style scoped>
.times {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

/* One tap to repeat last time: the widest, most obvious thing on the screen. */
.last-times {
  display: flex;
  gap: 8px;
}

.chip.last-time {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 60px;
  padding: 0 10px;
  background: color-mix(in srgb, var(--accent) 16%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 60%, var(--surface));
  color: var(--accent-text);
  font-size: 1.25rem;
  font-weight: 750;
  white-space: nowrap;
}

/* With two or three remembered times, the first is still "last time"; the rest step back. */
.chip.last-time:not(:first-child) {
  flex: 0 1 auto;
  padding: 0 16px;
  font-size: 1.05rem;
}

.chip.last-time:not(:first-child) svg {
  display: none;
}

.field.bad {
  border-color: var(--danger);
}
</style>
