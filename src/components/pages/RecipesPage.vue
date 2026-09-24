<script setup lang="ts">
// The cook's recipes: a list to scroll, one tap to open one, and a way to start a new one.
import { ref } from 'vue'
import { formatDuration } from '../../lib/format'
import { type Recipe, totalMs } from '../../lib/recipe'
import { newRecipe, state } from '../../store'
import FoodIcon from '../FoodIcon.vue'
import PageShell from './PageShell.vue'

const emit = defineEmits<{ back: []; open: [recipe: Recipe]; import: [] }>()

const describe = (r: Recipe) => {
  const bits = [`${r.steps.length} step${r.steps.length === 1 ? '' : 's'}`]
  if (r.steps.length) bits.push(formatDuration(totalMs(r)))
  if (r.serves) bits.push(`serves ${r.serves}`)
  return bits.join(' · ')
}
const firstFood = (r: Recipe) => r.steps.find((s) => s.kind === 'timer')?.name ?? ''

// A new one: its name, then straight to its page to give it servings, ingredients and steps.
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
  <PageShell title="Recipes" @back="emit('back')">
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
    <p v-else class="empty">Nothing here yet. A recipe is a chain of timers and instructions: build one below, import one with an AI's help, or keep one from a chain you're cooking.</p>

    <form v-if="naming" class="naming" @submit.prevent="create">
      <input ref="box" v-model="name" class="field" autocomplete="off" enterkeyhint="done" placeholder="Chicken curry" aria-label="Recipe name" maxlength="60" />
      <button type="submit" class="go" :disabled="!name.trim()">Create</button>
    </form>
    <button v-else class="new" @click="startNaming">+ New recipe</button>
    <button class="import" @click="emit('import')">Import a recipe</button>
  </PageShell>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.recipe {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 72px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 2px dashed var(--prep-line);
  background: color-mix(in srgb, var(--prep) 10%, var(--bg));
  text-align: left;
}

.recipe:active {
  transform: scale(0.98);
}

.icon {
  font-size: 1.8rem;
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
  font-size: 1.15rem;
}

.words small {
  color: var(--text-dim);
}

.empty {
  margin: 0;
  color: var(--text-dim);
}

.new,
.go {
  min-height: 56px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.15rem;
  font-weight: 800;
}

.new {
  margin-top: 6px;
}

.import {
  min-height: 48px;
  border-radius: var(--radius-sm);
  border: 2px solid color-mix(in srgb, var(--accent) 60%, var(--bg));
  color: var(--accent-text);
  font-weight: 750;
}

.import:active {
  transform: scale(0.98);
}

.naming {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin-top: 6px;
}

.go {
  min-width: 100px;
}

.go:disabled {
  background: var(--surface-2);
  color: var(--text-dim);
}
</style>
