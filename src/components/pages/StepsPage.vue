<script setup lang="ts">
// A recipe's steps as a graph, with room to work: the whole screen. For a saved recipe it's
// where the shape is built; for a chain being cooked it also shows progress, and offers to
// keep the chain as a recipe. Tap a step to change it, branch off it or take it out.
import { computed, ref } from 'vue'
import { formatDuration } from '../../lib/format'
import { type Recipe, type Run, type Step, totalMs } from '../../lib/recipe'
import { removeStepFrom, startRecipe } from '../../store'
import RecipeGraph from '../RecipeGraph.vue'
import SaveRecipeSheet from '../SaveRecipeSheet.vue'
import PageShell from './PageShell.vue'

const props = defineProps<{ recipe: Recipe; run?: Run; serves?: number | null }>()
const emit = defineEmits<{ back: []; add: [after: string[]]; edit: [step: Step]; prepped: [] }>()

const title = computed(() => props.recipe.name || 'This recipe')
const meta = computed(() => {
  const n = props.recipe.steps.length
  const total = n ? ` · ${formatDuration(totalMs(props.recipe))}` : ''
  return props.run ? `${props.run.done.length} of ${n} steps done${total}` : `${n} step${n === 1 ? '' : 's'}${total}`
})
const scope = computed(() => (props.run ? 'run' : 'recipe'))
const id = computed(() => props.run?.id ?? props.recipe.id)

const saving = ref(false)
function prep() {
  startRecipe(props.recipe, props.serves ?? props.recipe.serves ?? null)
  emit('prepped')
}
</script>

<template>
  <PageShell :title="title" @back="emit('back')">
    <p class="meta">{{ meta }}</p>
    <p v-if="!recipe.steps.length" class="hint">A step is a timer, or an instruction to follow. They come up one after another as each is done.</p>
    <RecipeGraph :recipe="recipe" :run="run" @add="emit('add', $event)" @edit="emit('edit', $event)" @remove="removeStepFrom(scope, id, $event.id)" />
    <button v-if="run && !recipe.name" class="save" @click="saving = true">Keep as a recipe</button>
    <button v-else-if="!run && recipe.steps.length" class="prep" @click="prep">Prep {{ recipe.name }}{{ serves ?? recipe.serves ? ` for ${serves ?? recipe.serves}` : '' }}</button>
    <SaveRecipeSheet v-if="saving && run" :run="run" @close="saving = false" />
  </PageShell>
</template>

<style scoped>
.meta {
  margin: -6px 0 0;
  color: var(--text-dim);
}

.hint {
  margin: 0;
  color: var(--text-dim);
}

.save,
.prep {
  min-height: 60px;
  margin-top: 12px;
  border-radius: 30px;
  border: 2px dashed var(--prep-line);
  font-size: 1.15rem;
  font-weight: 800;
}

.save {
  background: color-mix(in srgb, var(--prep) 10%, var(--bg));
  color: var(--prep-text);
}

.prep {
  background: var(--prep);
  color: var(--on-prep);
}

.save:active,
.prep:active {
  transform: scale(0.98);
}
</style>
