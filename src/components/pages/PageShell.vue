<script setup lang="ts">
// A full screen in place of the timer list, with a back arrow: the recipe pages. Focus lands on
// the title on arrival, so a screen reader hears where it is; Back is also Escape.
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{ title: string }>()
const emit = defineEmits<{ back: [] }>()

const heading = ref<HTMLElement>()
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) emit('back')
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  heading.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <section class="page">
    <header class="page-head">
      <button class="back" aria-label="Back" @click="emit('back')">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <h1 ref="heading" tabindex="-1">{{ title }}</h1>
      <span class="spare"><slot name="head" /></span>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
}

.page-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -8px 0 4px -10px;
}

.back {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: var(--text-dim);
}

.back:active {
  transform: scale(0.92);
}

h1 {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  outline: none;
}

.spare {
  flex: none;
}
</style>
