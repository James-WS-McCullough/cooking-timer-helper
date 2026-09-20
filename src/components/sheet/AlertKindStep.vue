<script setup lang="ts">
import type { AlertKind } from '../../lib/timer'

// Bell 1 · Which kind of alert
defineProps<{
  kind: AlertKind
  /** The timer has alerts as it stands, so None means taking them away. */
  hasAlerts: boolean
  /** A halfway alert on a timer that's already past halfway could never fire. */
  pastHalfway: boolean
}>()
const emit = defineEmits<{ pick: [kind: AlertKind] }>()
</script>

<template>
  <div class="options">
    <button type="button" class="option" :aria-pressed="kind === 'none'" @click="emit('pick', 'none')">
      <strong>None</strong>
      <span>{{ hasAlerts ? 'Remove the alerts and just count down' : 'Just count down' }}</span>
    </button>
    <button type="button" class="option" :aria-pressed="kind === 'half'" :disabled="pastHalfway" @click="emit('pick', 'half')">
      <strong>Halfway</strong>
      <span>{{ pastHalfway ? "This timer is already past halfway" : 'One alert at the midpoint, like flipping a tray in the oven' }}</span>
    </button>
    <button type="button" class="option" :aria-pressed="kind === 'every'" @click="emit('pick', 'every')">
      <strong>Every…</strong>
      <span>Repeats through the cook, like flipping every 2 minutes</span>
    </button>
  </div>
</template>

<style scoped>
.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-height: 92px;
  padding: 12px 18px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 2px solid transparent;
  text-align: left;
}

.option strong {
  font-size: 1.35rem;
}

.option span {
  color: var(--text-dim);
}

.option[aria-pressed='true'] {
  border-color: var(--accent);
}

.option:disabled {
  opacity: 0.4;
  cursor: default;
}

.option:not(:disabled):active {
  transform: scale(0.98);
}

/* Small phones: tighten up so every step still fits without scrolling. */
@media (max-height: 700px) {
  .option {
    min-height: 80px;
  }
}
</style>
