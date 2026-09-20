<script setup lang="ts">
// While she's announcing something over the timer list: her face and the words.
// (On the start screen her button is already there, so this stays away.)
import { voice } from '../lib/voice'
import RobotFace from './RobotFace.vue'
</script>

<template>
  <Transition name="bubble">
    <div v-if="voice.speaking" class="bubble" role="status">
      <RobotFace class="face" :level="voice.level" speaking />
      <span class="words">{{ voice.saying }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.bubble {
  position: fixed;
  top: calc(2px + env(safe-area-inset-top)); /* over the settings strip, not the first card */
  left: 50%;
  z-index: 35;
  display: flex;
  align-items: center;
  gap: 10px;
  width: max-content;
  max-width: calc(100vw - 24px);
  padding: 2px 16px 2px 6px;
  border-radius: 40px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.4);
  transform: translateX(-50%);
  pointer-events: none;
}

.face {
  flex: none;
  width: 46px;
}

.words {
  font-size: 1rem;
  font-weight: 700;
}

.bubble-enter-active,
.bubble-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.3, 1.3, 0.5, 1),
    opacity 0.25s ease;
}

.bubble-leave-active {
  transition-delay: 0.5s; /* linger a beat after the last word */
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translate(-50%, -16px);
}

@media (prefers-reduced-motion: reduce) {
  .bubble-enter-active,
  .bubble-leave-active {
    transition: opacity 0.2s ease;
  }
}
</style>
