<script setup lang="ts">
defineProps<{ size?: number }>()
</script>

<template>
  <svg viewBox="0 0 24 24" :width="size ?? 26" :height="size ?? 26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </svg>
</template>
