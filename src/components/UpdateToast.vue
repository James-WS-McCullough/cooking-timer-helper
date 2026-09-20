<script setup lang="ts">
// "A new version is ready": shown instead of updating silently, so a deploy is
// visible and the reload happens when the cook chooses. Reloading is safe
// mid-cook: timers are wall-clock based and saved on the device.
import { useRegisterSW } from 'virtual:pwa-register/vue'

const HOUR = 60 * 60 * 1000

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, registration) {
    // A tablet left open on the counter would otherwise never look for updates.
    if (registration) setInterval(() => void registration.update(), HOUR)
  },
})
</script>

<template>
  <Transition name="toast">
    <div v-if="needRefresh" class="toast" role="status">
      <span>A new version of Sizzle is ready.</span>
      <button class="reload" @click="updateServiceWorker()">Reload</button>
      <button class="later" aria-label="Not now" @click="needRefresh = false">✕</button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top));
  left: 50%;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 10px;
  width: max-content;
  max-width: calc(100vw - 24px);
  padding: 8px 8px 8px 16px;
  border-radius: 28px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.4);
  font-weight: 600;
  transform: translateX(-50%);
}

.reload {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 20px;
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 800;
}

.later {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--text-dim);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.3, 1.3, 0.5, 1),
    opacity 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
