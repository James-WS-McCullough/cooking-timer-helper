<script setup lang="ts">
// A saved recipe: how many it's for, what it needs, the steps as a graph, and one button
// to prep it. It's also where a recipe is shaped: tap a node to branch off it or remove it,
// tap an ingredient to give it an amount. The one screen in Sizzle that scrolls: a recipe is
// a document, not a decision.
import { computed, ref } from 'vue'
import { useDialog } from '../lib/dialog'
import { formatDuration } from '../lib/format'
import { describeIngredient, type Ingredient } from '../lib/ingredients'
import { type Recipe, type Step, totalMs } from '../lib/recipe'
import { uid } from '../lib/timer'
import { removeStepFrom, setRecipeServes, startRecipe } from '../store'
import IngredientSheet from './IngredientSheet.vue'
import RecipeGraph from './RecipeGraph.vue'

const props = defineProps<{ recipe: Recipe }>()
const emit = defineEmits<{ close: []; branch: [after: string[]]; edit: [step: Step] }>()

const panel = ref<HTMLElement>()
useDialog(panel, () => emit('close'))

// Servings this time: the recipe's own, until changed here.
const serves = ref<number | null>(props.recipe.serves ?? null)
const adjust = (by: number) => {
  serves.value = Math.max(1, (serves.value ?? 0) + by)
}
const ingredients = computed(() => props.recipe.ingredients ?? [])
const scaledFrom = computed(() => props.recipe.serves ?? null)

const editing = ref<Ingredient | null>(null)
const addIngredient = () => {
  editing.value = { id: uid(), name: '', amount: null, unit: '' }
}

function prep() {
  // If they set servings here and the recipe never had any, those become the recipe's.
  if (props.recipe.serves == null && serves.value != null) setRecipeServes(props.recipe.id, serves.value)
  startRecipe(props.recipe, serves.value)
  emit('close')
}
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div ref="panel" class="panel" role="dialog" aria-modal="true" aria-labelledby="recipe-title">
      <header>
        <h2 id="recipe-title">{{ recipe.name }}</h2>
        <button class="x" aria-label="Close" @click="emit('close')">✕</button>
      </header>
      <p class="meta">{{ recipe.steps.length }} steps · {{ formatDuration(totalMs(recipe)) }}</p>

      <div class="serves" role="group" aria-label="Serves">
        <button class="step-btn" aria-label="Fewer" :disabled="(serves ?? 1) <= 1" @click="adjust(-1)">−</button>
        <span class="serves-label">Serves <strong>{{ serves ?? '?' }}</strong></span>
        <button class="step-btn" aria-label="More" @click="adjust(1)">+</button>
      </div>

      <section>
        <h3>Ingredients</h3>
        <ul v-if="ingredients.length" class="ingredients">
          <li v-for="i in ingredients" :key="i.id">
            <button class="ingredient" :class="{ unset: i.amount === null }" @click="editing = { ...i }">
              {{ describeIngredient(i, scaledFrom, serves) }}
              <small v-if="i.amount === null">how much?</small>
            </button>
          </li>
        </ul>
        <p v-else class="hint">Write [Diced chicken] in an instruction and it appears here.</p>
        <button class="link" @click="addIngredient">+ Add an ingredient</button>
      </section>

      <section>
        <h3>Steps</h3>
        <RecipeGraph
          :recipe="recipe"
          @add="emit('branch', $event)"
          @edit="emit('edit', $event)"
          @remove="removeStepFrom('recipe', recipe.id, $event.id)"
        />
      </section>

      <button class="prep" @click="prep">Prep {{ recipe.name }}{{ serves ? ` for ${serves}` : '' }}</button>
    </div>

    <IngredientSheet v-if="editing" :recipe-id="recipe.id" :ingredient="editing" @close="editing = null" />
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 15; /* beneath the step sheets (20), which open on top of it while a branch is added */
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

h3 {
  margin: 8px 0 6px;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-dim);
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
  margin: -8px 0 0;
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
  min-width: 90px;
  text-align: center;
}

.step-btn {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--surface);
  font-size: 1.4rem;
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
  align-items: baseline;
  gap: 6px;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 20px;
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
  font-size: 0.9rem;
  color: var(--text-dim);
}

.link {
  align-self: flex-start;
  min-height: 40px;
  margin-top: 6px;
  padding: 0 4px;
  color: var(--accent-text);
  font-weight: 700;
}


.prep {
  min-height: 64px;
  margin-top: 8px;
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
