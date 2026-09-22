<script setup lang="ts">
// The "+ Next step" button on a card, beside the bell: what follows this one. Lit once
// something does, like the bell once it has alerts.
defineProps<{ name: string; following: number }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    class="next-step"
    :class="{ set: following > 0 }"
    :aria-label="following ? `Next steps after ${name}: ${following} so far. Add another` : `Add a step after ${name}`"
    @click="$emit('click')"
  >
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 6h12M4 12h12M4 18h7" />
      <path d="M18 14v6M15 17h6" />
    </svg>
  </button>
</template>

<style scoped>
.next-step {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -4px -8px;
  border-radius: 10px;
  color: var(--text-dim);
}

.next-step.set {
  color: var(--accent-text);
}

.next-step:active {
  transform: scale(0.9);
}
</style>
