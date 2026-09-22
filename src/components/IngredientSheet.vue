<script setup lang="ts">
// One ingredient: what, how much, in what. Three fields on one screen is the whole of it.
import { onMounted, ref } from 'vue'
import { useDialog } from '../lib/dialog'
import type { Ingredient } from '../lib/ingredients'
import { removeIngredient, setIngredient } from '../store'

const props = defineProps<{ recipeId: string; ingredient: Ingredient }>()
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement>()
useDialog(panel, () => emit('close'))

const name = ref(props.ingredient.name)
const amount = ref(props.ingredient.amount === null ? '' : String(props.ingredient.amount))
const unit = ref(props.ingredient.unit)
const isNew = !props.ingredient.name

const first = ref<HTMLInputElement>()
onMounted(() => requestAnimationFrame(() => first.value?.focus()))

function save() {
  if (!name.value.trim()) return
  const n = Number(amount.value.replace(',', '.'))
  setIngredient(props.recipeId, {
    id: props.ingredient.id,
    name: name.value.trim(),
    amount: amount.value.trim() && Number.isFinite(n) && n > 0 ? n : null,
    unit: unit.value.trim(),
  })
  emit('close')
}

function remove() {
  removeIngredient(props.recipeId, props.ingredient.id)
  emit('close')
}
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <form ref="panel" class="panel" role="dialog" aria-modal="true" aria-labelledby="ingredient-title" @submit.prevent="save">
      <h2 id="ingredient-title">{{ isNew ? 'New ingredient' : ingredient.name }}</h2>
      <input v-if="isNew" ref="first" v-model="name" class="field" autocomplete="off" placeholder="Diced chicken" aria-label="Ingredient" maxlength="60" />
      <div class="row">
        <input
          :ref="isNew ? undefined : 'first'"
          v-model="amount"
          class="field"
          inputmode="decimal"
          autocomplete="off"
          placeholder="300"
          aria-label="Amount"
        />
        <input v-model="unit" class="field" autocomplete="off" placeholder="g, ml, tbsp…" aria-label="Unit" maxlength="12" />
      </div>
      <p class="hint">Leave the amount empty for “to taste”.</p>
      <button type="submit" class="main" :disabled="!name.trim()">Save</button>
      <button v-if="!isNew" type="button" class="other danger" @click="remove">Remove ingredient</button>
      <button v-else type="button" class="other" @click="emit('close')">Cancel</button>
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
}

h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 8px;
}

.hint {
  margin: 0 0 4px;
  font-size: 0.85rem;
  color: var(--text-dim);
}

.main,
.other {
  width: 100%;
  border-radius: var(--radius-sm);
  font-weight: 800;
}

.main {
  min-height: 56px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.2rem;
}

.main:disabled {
  background: var(--surface-2);
  color: var(--text-dim);
}

.other {
  min-height: 44px;
  color: var(--text-dim);
  font-weight: 650;
}

.other.danger {
  color: var(--danger);
}
</style>
