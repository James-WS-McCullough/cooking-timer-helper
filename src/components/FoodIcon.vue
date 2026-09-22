<script setup lang="ts">
// A food's icon. The icons themselves (foodIconSet.ts) arrive in their own chunk the first
// time one is needed; until then this is a same-sized blank, so nothing shifts.
import { type Component, computed, shallowRef } from 'vue'
import { type FoodIconName, foodIconFor } from '../lib/foodIcons'

const icons = shallowRef<Record<FoodIconName, Component>>()
let loading: Promise<void> | undefined
function load(): void {
  loading ??= import('./foodIconSet').then((m) => {
    icons.value = m.ICONS
  })
  loading.catch(() => {
    loading = undefined // offline before it was ever cached: try again next time
  })
}
load()

// Either say which icon, or give the timer's name and let the matcher choose.
const props = defineProps<{ name?: string; icon?: FoodIconName }>()
const icon = computed(() => icons.value?.[props.icon ?? foodIconFor(props.name ?? '')])
</script>

<template>
  <component :is="icon" v-if="icon" class="food-icon" aria-hidden="true" />
  <span v-else class="food-icon" aria-hidden="true" />
</template>

<style scoped>
/* Sized by the parent's font-size, so it scales with whatever text it sits beside. */
.food-icon {
  flex: none;
  width: 1.4em;
  height: 1.4em;
}
</style>
