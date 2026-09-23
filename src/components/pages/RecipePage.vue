<script setup lang="ts">
// One recipe: how many it's for, what it needs, and the way to its steps and to prepping it.
// Shaping the steps happens on its own page (StepsPage), so this one stays a short read.
import { computed, ref } from 'vue'
import { formatDuration } from '../../lib/format'
import { describeIngredient, type Ingredient } from '../../lib/ingredients'
import { type Recipe, totalMs } from '../../lib/recipe'
import { uid } from '../../lib/timer'
import { removeRecipe, setRecipeServes, startRecipe } from '../../store'
import IngredientSheet from '../IngredientSheet.vue'
import PageShell from './PageShell.vue'

const props = defineProps<{ recipe: Recipe }>()
const emit = defineEmits<{ back: []; steps: []; prepped: [] }>()

// Servings this time: the recipe's own, until changed here (held by App, so a trip to the
// steps page and back keeps it). A recipe that doesn't yet know how many it's for learns it
// from the stepper: that's what its amounts are for.
const serves = defineModel<number | null>('serves', { required: true })
const adjust = (by: number) => {
  const next = Math.max(1, (serves.value ?? 0) + by) // (a model ref reads stale until the parent has updated)
  serves.value = next
  if (props.recipe.serves == null || !props.recipe.ingredients?.length) setRecipeServes(props.recipe.id, next)
}
const ingredients = computed(() => props.recipe.ingredients ?? [])
const scaledFrom = computed(() => props.recipe.serves ?? null)

const editing = ref<Ingredient | null>(null)
const addIngredient = () => {
  editing.value = { id: uid(), name: '', amount: null, unit: '' }
}

const stepsLine = computed(() => {
  const n = props.recipe.steps.length
  return n ? `${n} step${n === 1 ? '' : 's'} · ${formatDuration(totalMs(props.recipe))}` : 'No steps yet'
})

function prep() {
  startRecipe(props.recipe, serves.value)
  emit('prepped')
}

// Deleting takes two taps and backs out by itself, like removing a timer.
const sure = ref(false)
let unsure: ReturnType<typeof setTimeout> | undefined
function del() {
  if (!sure.value) {
    sure.value = true
    unsure = setTimeout(() => (sure.value = false), 4000)
    return
  }
  clearTimeout(unsure)
  removeRecipe(props.recipe.id)
  emit('back')
}
</script>

<template>
  <PageShell :title="recipe.name" @back="emit('back')">
    <div class="serves" role="group" aria-label="Serves">
      <button class="step-btn" aria-label="Fewer" :disabled="(serves ?? 1) <= 1" @click="adjust(-1)">−</button>
      <span class="serves-label">Serves <strong>{{ serves ?? '?' }}</strong></span>
      <button class="step-btn" aria-label="More" @click="adjust(1)">+</button>
    </div>

    <section>
      <h2>Ingredients</h2>
      <ul v-if="ingredients.length" class="ingredients">
        <li v-for="i in ingredients" :key="i.id">
          <button class="ingredient" :class="{ unset: i.amount === null }" @click="editing = { ...i }">
            {{ describeIngredient(i, scaledFrom, serves) }}
            <small v-if="i.amount === null">how much?</small>
          </button>
        </li>
      </ul>
      <p v-else class="hint">Nothing yet. Add what it needs here, or name things in [brackets] in the steps.</p>
      <button class="link" @click="addIngredient">+ Add an ingredient</button>
    </section>

    <section>
      <h2>Steps</h2>
      <button class="steps" @click="emit('steps')">
        <span class="words">
          <strong>{{ stepsLine }}</strong>
          <small>{{ recipe.steps.length ? 'See and change them' : 'Add the first one' }}</small>
        </span>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </section>

    <button class="prep" :disabled="!recipe.steps.length" @click="prep">
      {{ recipe.steps.length ? `Prep ${recipe.name}${serves ? ` for ${serves}` : ''}` : 'Add a step to prep this' }}
    </button>
    <button class="delete" :class="{ sure }" @click="del">{{ sure ? 'Really delete it?' : 'Delete recipe' }}</button>

    <IngredientSheet v-if="editing" :recipe-id="recipe.id" :ingredient="editing" @close="editing = null" />
  </PageShell>
</template>

<style scoped>
h2 {
  margin: 8px 0 8px;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-dim);
}

.serves {
  display: flex;
  align-items: center;
  gap: 12px;
  align-self: flex-start;
  padding: 4px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.serves-label {
  min-width: 96px;
  text-align: center;
  font-size: 1.05rem;
}

.step-btn {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: var(--surface);
  font-size: 1.5rem;
  font-weight: 700;
}

.step-btn:disabled {
  opacity: 0.35;
}

.ingredients {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ingredient {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 22px;
  background: var(--surface-2);
  font-weight: 600;
}

.ingredient.unset {
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--text-dim);
}

.ingredient small {
  font-size: 0.75rem;
  font-weight: 500;
}

.hint {
  margin: 0;
  color: var(--text-dim);
}

.link {
  min-height: 44px;
  margin-top: 6px;
  padding: 0 4px;
  color: var(--accent-text);
  font-weight: 700;
}

.steps {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 72px;
  padding: 10px 14px 10px 18px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  text-align: left;
  color: var(--text-dim);
}

.steps:active {
  transform: scale(0.98);
}

.words {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.words strong {
  font-size: 1.1rem;
  color: var(--text);
}

.words small {
  font-size: 0.9rem;
}

.prep {
  min-height: 64px;
  margin-top: 10px;
  border-radius: 32px;
  border: 2px dashed var(--prep-line);
  background: var(--prep);
  color: var(--on-prep);
  font-size: 1.25rem;
  font-weight: 800;
}

.prep:active {
  transform: scale(0.98);
}

.prep:disabled {
  border-style: solid;
  border-color: var(--border);
  background: var(--surface-2);
  color: var(--text-dim);
}

.delete {
  min-height: 44px;
  color: var(--text-dim);
  font-weight: 650;
}

.delete.sure {
  color: var(--danger);
}
</style>
