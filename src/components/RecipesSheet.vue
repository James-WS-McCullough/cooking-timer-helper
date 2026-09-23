<script setup lang="ts">
// The cook's recipes: a list to scroll, one tap to open one, and a way to start a new one.
import { ref } from 'vue'
import { useDialog } from '../lib/dialog'
import { formatDuration } from '../lib/format'
import { type Recipe, totalMs } from '../lib/recipe'
import { newRecipe, state } from '../store'
import FoodIcon from './FoodIcon.vue'

const emit = defineEmits<{ close: []; open: [recipe: Recipe] }>()

const panel = ref<HTMLElement>()
useDialog(panel, () => emit('close'))

const describe = (r: Recipe) => {
  const bits = [`${r.steps.length} step${r.steps.length === 1 ? '' : 's'}`]
  if (r.steps.length) bits.push(formatDuration(totalMs(r)))
  if (r.serves) bits.push(`serves ${r.serves}`)
  return bits.join(' · ')
}
const firstFood = (r: Recipe) => r.steps.find((s) => s.kind === 'timer')?.name ?? ''

// A new one: its name, then straight to its screen to give it servings, ingredients and steps.
const naming = ref(false)
const name = ref('')
const box = ref<HTMLInputElement>()
function startNaming() {
  naming.value = true
  requestAnimationFrame(() => box.value?.focus())
}
function create() {
  if (!name.value.trim()) return
  emit('open', newRecipe(name.value))
}
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div ref="panel" class="panel" role="dialog" aria-modal="true" aria-labelledby="recipes-title">
      <header>
        <h2 id="recipes-title">Recipes</h2>
        <button class="x" aria-label="Close" @click="emit('close')">✕</button>
      </header>

      <ul v-if="state.recipes.length" class="list">
        <li v-for="r in state.recipes" :key="r.id">
          <button class="recipe" :aria-label="`${r.name}: ${describe(r)}`" @click="emit('open', r)">
            <FoodIcon :name="firstFood(r)" class="icon" />
            <span class="words">
              <strong>{{ r.name }}</strong>
              <small>{{ describe(r) }}</small>
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="empty">Nothing here yet. A recipe is a chain of timers and instructions: build one below, or keep one from the graph of a chain you're cooking.</p>

      <form v-if="naming" class="naming" @submit.prevent="create">
        <input ref="box" v-model="name" class="field" autocomplete="off" enterkeyhint="done" placeholder="Chicken curry" aria-label="Recipe name" maxlength="60" />
        <button type="submit" class="go" :disabled="!name.trim()">Create</button>
      </form>
      <button v-else class="new" @click="startNaming">+ New recipe</button>
    </div>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 14; /* the recipe's own screen (15) and the step sheets (20) open over it */
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

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.recipe {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 64px;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: 2px dashed var(--prep-line);
  background: color-mix(in srgb, var(--prep) 10%, var(--bg));
  text-align: left;
}

.recipe:active {
  transform: scale(0.98);
}

.icon {
  font-size: 1.6rem;
}

.words {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.words strong,
.words small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.words strong {
  font-size: 1.1rem;
}

.words small {
  color: var(--text-dim);
}

.empty {
  margin: 0;
  color: var(--text-dim);
}

.new {
  min-height: 56px;
  margin-top: 6px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.15rem;
  font-weight: 800;
}

.naming {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin-top: 6px;
}

.go {
  min-width: 100px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 800;
}

.go:disabled {
  background: var(--surface-2);
  color: var(--text-dim);
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
