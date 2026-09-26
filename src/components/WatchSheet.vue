<script setup lang="ts">
// "Watch while you cook": paste a YouTube or Twitch link. The last one is offered back.
import { computed, onMounted, ref } from 'vue'
import { useDialog } from '../lib/dialog'
import { describeWatchable, parseWatchUrl } from '../lib/watch'
import { lastLink, watch } from '../lib/watching'

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement>()
useDialog(panel, () => emit('close'))

const link = ref('')
const box = ref<HTMLInputElement>()
onMounted(() => requestAnimationFrame(() => box.value?.focus()))

const parsed = computed(() => (link.value.trim() ? parseWatchUrl(link.value) : null))
const problem = computed(() =>
  link.value.trim() && !parsed.value ? 'Only YouTube and Twitch links can be shown here.' : '',
)
const last = computed(() => (lastLink.value ? parseWatchUrl(lastLink.value) : null))

function go(which: string) {
  if (watch(which)) emit('close')
}
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <form ref="panel" class="panel" role="dialog" aria-modal="true" aria-labelledby="watch-title" @submit.prevent="go(link)">
      <h2 id="watch-title">Watch while you cook</h2>
      <p class="small">Paste a YouTube or Twitch link. It plays inside Sizzle, so the alarms play over it.</p>
      <input
        ref="box"
        v-model="link"
        class="field"
        type="text"
        inputmode="url"
        autocomplete="off"
        autocapitalize="off"
        enterkeyhint="go"
        placeholder="https://www.youtube.com/watch?v=…"
        aria-label="Link"
        :aria-invalid="!!problem || undefined"
        :aria-describedby="problem ? 'watch-problem' : undefined"
      />
      <p v-if="problem" id="watch-problem" class="problem" role="alert">{{ problem }}</p>
      <button type="submit" class="main" :disabled="!parsed">Watch{{ parsed ? ` · ${describeWatchable(parsed)}` : '' }}</button>
      <button v-if="last && lastLink !== link.trim()" type="button" class="other" @click="go(lastLink)">Last time: {{ describeWatchable(last) }}</button>
      <button v-else type="button" class="other" @click="emit('close')">Not now</button>
    </form>
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
  gap: 10px;
  width: 100%;
  max-width: 360px;
  padding: 20px 24px;
  border-radius: 24px;
  background: var(--surface);
  animation: pop 0.25s cubic-bezier(0.3, 1.3, 0.5, 1);
}

h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.small {
  margin: 0 0 4px;
  font-size: 0.9rem;
  color: var(--text-dim);
}

.problem {
  margin: 0;
  font-weight: 600;
  color: var(--danger);
}

.main,
.other {
  width: 100%;
  border-radius: var(--radius-sm);
  font-weight: 800;
}

.main {
  min-height: 60px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.2rem;
}

.main:disabled {
  background: var(--surface-2);
  color: var(--text-dim);
}

.other {
  min-height: 48px;
  color: var(--text-dim);
  font-weight: 650;
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
