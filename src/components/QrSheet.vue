<script setup lang="ts">
// Loaded on demand (see App.vue) so the QR encoder stays out of the main bundle.

import { encode } from 'uqr'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import SizzleLogo from './SizzleLogo.vue'

const emit = defineEmits<{ close: [] }>()

// Wherever this copy of the app is being served from, minus any query or hash.
const url = new URL(import.meta.env.BASE_URL, window.location.origin).href

const qr = computed(() => {
  const { data, size } = encode(url, { ecc: 'M', border: 2 })
  let path = ''
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y][x]) path += `M${x} ${y}h1v1h-1z`
  return { size, path }
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div class="panel" role="dialog" aria-modal="true" aria-label="Open Sizzle on another device">
      <SizzleLogo class="logo" />
      <h2>Sizzle</h2>
      <!-- Always dark on white, whatever the theme: that's what scanners read best. -->
      <svg class="qr" :viewBox="`0 0 ${qr.size} ${qr.size}`" shape-rendering="crispEdges" role="img" :aria-label="`QR code for ${url}`">
        <rect :width="qr.size" :height="qr.size" fill="#fff" />
        <path :d="qr.path" fill="#14110f" />
      </svg>
      <p class="hint">Scan with another device's camera to open Sizzle there.</p>
      <p class="url">{{ url.replace(/^https?:\/\//, '') }}</p>
      <button class="close" @click="emit('close')">Close</button>
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
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 340px;
  max-height: 100%;
  overflow-y: auto;
  padding: 24px 24px 20px;
  border-radius: 24px;
  background: var(--surface);
  text-align: center;
  animation: pop 0.25s cubic-bezier(0.3, 1.3, 0.5, 1);
}

.logo {
  width: 64px;
  height: 64px;
}

h2 {
  margin: 2px 0 16px;
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.qr {
  width: min(100%, 250px);
  border-radius: 14px;
}

.hint {
  margin: 16px 0 4px;
  font-weight: 600;
}

.url {
  margin: 0 0 18px;
  font-size: 0.85rem;
  color: var(--text-dim);
  overflow-wrap: anywhere;
}

.close {
  width: 100%;
  min-height: 56px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-size: 1.15rem;
  font-weight: 700;
}

.close:active {
  transform: scale(0.98);
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
  .panel {
    animation: none;
  }
}
</style>
