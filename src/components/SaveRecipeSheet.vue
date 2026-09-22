<script setup lang="ts">
// A chain has just been cooked from end to end and has no name: keep it? One field, one
// button; "Not now" costs nothing. Recipes then sit at the top of the Prep path.
import { onMounted, ref } from 'vue'
import { useDialog } from '../lib/dialog'
import { formatDuration } from '../lib/format'
import { type Run, totalMs } from '../lib/recipe'
import { saveRecipe } from '../store'

const props = defineProps<{ run: Run }>()
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement>()
useDialog(panel, () => emit('close'))

const name = ref('')
const box = ref<HTMLInputElement>()
onMounted(() => requestAnimationFrame(() => box.value?.focus()))

function save() {
  if (!name.value.trim()) return
  saveRecipe(props.run, name.value)
  emit('close')
}
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <form ref="panel" class="panel" role="dialog" aria-modal="true" aria-labelledby="save-recipe-title" @submit.prevent="save">
      <h2 id="save-recipe-title">Keep that as a recipe?</h2>
      <p class="small">{{ run.recipe.steps.length }} steps, {{ formatDuration(totalMs(run.recipe)) }} of cooking. It’ll be one tap on the Prep screen.</p>
      <input ref="box" v-model="name" class="field" autocomplete="off" enterkeyhint="done" placeholder="Chicken curry" aria-label="Recipe name" maxlength="60" />
      <button type="submit" class="main" :disabled="!name.trim()">Save recipe</button>
      <button type="button" class="other" @click="emit('close')">Not now</button>
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
  max-width: 340px;
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

.main,
.other {
  width: 100%;
  border-radius: var(--radius-sm);
  font-weight: 800;
}

.main {
  min-height: 60px;
  background: var(--prep);
  color: var(--on-prep);
  font-size: 1.3rem;
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
