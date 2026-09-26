<script setup lang="ts">
// The video, with one small ✕. On a phone it sits at the top and the cards scroll under it;
// on a wide screen App.vue puts it beside them. Nothing is ever drawn over the picture.
import { computed } from 'vue'
import { describeWatchable, embedUrl } from '../lib/watch'
import { stopWatching, watching } from '../lib/watching'

const src = computed(() => (watching.value ? embedUrl(watching.value, window.location.hostname) : ''))
const label = computed(() => (watching.value ? describeWatchable(watching.value) : ''))
</script>

<template>
  <section v-if="watching" class="watch" :aria-label="`Watching: ${label}`">
    <div class="frame">
      <iframe
        :src="src"
        :title="label"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      />
    </div>
    <button class="stop" aria-label="Stop watching" @click="stopWatching">✕</button>
  </section>
</template>

<style scoped>
.watch {
  position: relative;
}

.frame {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius);
  background: #000;
}

iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

/* On the corner, mostly outside the picture, and inside the screen on a phone. */
.stop {
  position: absolute;
  top: -14px;
  right: -8px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 1rem;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
}

.stop:active {
  transform: scale(0.92);
}
</style>
