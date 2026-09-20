<script setup lang="ts">
import type { AlertKind } from '../../lib/timer'

// Bell 2 · Alert details (skipped for None)
defineProps<{ kind: AlertKind; pause: boolean }>()
// The hold switch reports a toggle rather than a value: the editor needs to know the cook set it by hand.
const emit = defineEmits<{ togglePause: [] }>()

// How often: one of the tiles, or whatever's typed in the box (which wins while it has anything in it).
const pickedEvery = defineModel<number | null>('pickedEvery', { required: true })
const customEvery = defineModel<string>('customEvery', { required: true })
const label = defineModel<string>('label', { required: true })
const keepAsPreset = defineModel<boolean>('keepAsPreset', { required: true })

const INTERVALS = [1, 2, 3, 5]
const LABELS = ['Flip', 'Stir', 'Check', 'Baste']

function pickEvery(min: number) {
  pickedEvery.value = min
  customEvery.value = ''
}
</script>

<template>
  <section v-if="kind === 'every'">
    <h3>Every how many minutes</h3>
    <div class="every">
      <button
        v-for="m in INTERVALS"
        :key="m"
        type="button"
        class="chip big-num"
        :aria-pressed="!customEvery && pickedEvery === m"
        @click="pickEvery(m)"
      >
        {{ m }}
      </button>
      <input
        v-model="customEvery"
        class="field every-field"
        inputmode="decimal"
        autocomplete="off"
        placeholder="other"
        aria-label="Custom interval in minutes"
      />
    </div>
  </section>

  <section>
    <h3>Remind me to</h3>
    <div class="labels">
      <button v-for="l in LABELS" :key="l" type="button" class="chip" :aria-pressed="label === l" @click="label = l">
        {{ l }}
      </button>
    </div>
  </section>

  <button type="button" class="switch-row" role="switch" :aria-checked="pause" @click="emit('togglePause')">
    <span>
      <strong>Hold timer until I confirm</strong>
      <small>{{ pause ? 'Clock stops while the food is out' : 'Clock keeps running — food stays on the heat' }}</small>
    </span>
    <span class="switch" aria-hidden="true" />
  </button>

  <button type="button" class="switch-row" role="switch" :aria-checked="keepAsPreset" @click="keepAsPreset = !keepAsPreset">
    <span>
      <strong>Save as preset</strong>
      <small>Keeps this name, time and alert for a one-tap start</small>
    </span>
    <span class="switch" aria-hidden="true" />
  </button>
</template>

<style scoped>
.every {
  display: grid;
  grid-template-columns: repeat(4, 1fr) 1.4fr;
  gap: 8px;
}

.every-field {
  min-height: 60px;
  padding: 0 8px;
  text-align: center;
}

.labels {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.labels .chip {
  padding: 0 4px;
}

/* Small phones: tighten up so every step still fits without scrolling. */
@media (max-height: 700px) {
  .every-field {
    min-height: 60px;
  }
}
</style>
