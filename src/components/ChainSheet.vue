<script setup lang="ts">
// The chain being cooked, as a graph: what's done, what's up, what's still to come. Tap a
// step to change it, branch off it or take it out; add to the end; keep the lot as a recipe.
import { computed, ref } from 'vue'
import { useDialog } from '../lib/dialog'
import { formatDuration } from '../lib/format'
import { type Run, type Step, totalMs } from '../lib/recipe'
import { removeStepFrom } from '../store'
import RecipeGraph from './RecipeGraph.vue'
import SaveRecipeSheet from './SaveRecipeSheet.vue'

const props = defineProps<{ run: Run }>()
const emit = defineEmits<{ close: []; add: [after: string[]]; edit: [step: Step] }>()

const panel = ref<HTMLElement>()
useDialog(panel, () => emit('close'))

const title = computed(() => props.run.recipe.name || 'This recipe')
const saving = ref(false)
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div ref="panel" class="panel" role="dialog" aria-modal="true" aria-labelledby="chain-title">
      <header>
        <h2 id="chain-title">{{ title }}</h2>
        <button class="x" aria-label="Close" @click="emit('close')">✕</button>
      </header>
      <p class="meta">
        {{ run.done.length }} of {{ run.recipe.steps.length }} steps done · {{ formatDuration(totalMs(run.recipe)) }} in all
      </p>
      <RecipeGraph :recipe="run.recipe" :run="run" @add="emit('add', $event)" @edit="emit('edit', $event)" @remove="removeStepFrom('run', run.id, $event.id)" />
      <button v-if="!run.recipe.name" class="save" @click="saving = true">Keep as a recipe</button>
    </div>
    <SaveRecipeSheet v-if="saving" :run="run" @close="saving = false" />
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 15; /* beneath the step sheets (20), which open on top of it */
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
  max-width: 420px;
  max-height: 100%;
  overflow-y: auto;
  padding: 12px 18px 18px;
  border-radius: 24px;
  background: var(--surface);
  animation: pop 0.25s cubic-bezier(0.3, 1.3, 0.5, 1);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.x {
  width: 48px;
  height: 48px;
  margin-right: -10px;
  border-radius: 50%;
  color: var(--text-dim);
  font-size: 1.1rem;
}

.meta {
  margin: -8px 0 4px;
  color: var(--text-dim);
}

.save {
  min-height: 56px;
  margin-top: 8px;
  border-radius: 28px;
  border: 2px dashed var(--prep-line);
  background: color-mix(in srgb, var(--prep) 10%, var(--bg));
  color: var(--prep-text);
  font-size: 1.1rem;
  font-weight: 800;
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
