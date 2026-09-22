<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FOODS } from '../../data/foods'
import { searchFoods } from '../../lib/foodSearch'
import { formatDuration, tidyName } from '../../lib/format'
import { type Recipe, totalMs } from '../../lib/recipe'
import { type Preset, removePreset, removeRecipe, state } from '../../store'
import FoodIcon from '../FoodIcon.vue'

// "What's cooking?": a search box, the presets, and a grid of the usual names.
// Picking a name or a preset is reported to the wizard; typing one is submitted
// with the form (Enter, the "Use …" row, or the wizard's Next button).
//
// The wizard holds this step's state, so it's all still there after a trip to the
// next screen and back.
defineProps<{ prep?: boolean }>()
const emit = defineEmits<{ pick: [name: string]; preset: [preset: Preset]; recipe: [recipe: Recipe] }>()

const name = defineModel<string>('name', { required: true })
// Focusing the name box turns the step into a search of the built-in food list.
// The box doubles as free text: anything typed can be used as the name as-is.
const searching = defineModel<boolean>('searching', { required: true })
const editingPresets = defineModel<boolean>('editingPresets', { required: true })

// Three rows of specific foods, then a row that covers most other things people time.
const NAMES = [
  ...['Potatoes', 'Sausages', 'Chicken', 'Fish'],
  ...['Pasta', 'Rice', 'Eggs', 'Veg'],
  ...['Meat', 'Sauce', 'Oven', 'Pan'],
  ...['Pizza', 'Bread', 'Bake', 'Tea'],
]

const searchBox = ref<HTMLInputElement>()
const results = computed(() => searchFoods(FOODS, name.value))

// Whatever's typed can be the name as-is. Offered as the first row unless the
// list already has exactly that, in which case the list's own row says it better.
const typed = computed(() => tidyName(name.value))
const offerTyped = computed(
  () => typed.value !== '' && !results.value.some(([food]) => food.toLowerCase() === typed.value.toLowerCase()),
)

function stopSearching() {
  searching.value = false
  name.value = ''
  searchBox.value?.blur()
}

// ---- Presets ----
function describe(p: Preset): string {
  const bits = [formatDuration(p.durationMs)]
  if (p.plan.kind === 'half') bits.push(`${p.plan.label} ½`)
  if (p.plan.kind === 'every') bits.push(`${p.plan.label} / ${formatDuration(p.plan.everyMs)}`)
  return bits.join(' · ')
}

function onPreset(p: Preset) {
  if (editingPresets.value) return
  emit('preset', p)
}

// ---- Recipes (prep only): a chain of steps, prepped in one tap ----
const describeRecipe = (r: Recipe) => `${r.steps.length} steps · ${formatDuration(totalMs(r))}`
function onRecipe(r: Recipe) {
  if (editingPresets.value) removeRecipe(r.id)
  else emit('recipe', r)
}

// A removed preset is lifted out of the row so its neighbours can slide into the
// gap; pin it where it was or it would jump to the start of the row first.
function pinPreset(el: Element) {
  const pill = el as HTMLElement
  pill.style.left = `${pill.offsetLeft}px`
  pill.style.top = `${pill.offsetTop}px`
  pill.style.width = `${pill.offsetWidth}px`
}

watch(
  () => state.presets.length,
  (n) => {
    if (n === 0) editingPresets.value = false
  },
)
</script>

<template>
  <div class="search" :class="{ active: searching }">
    <button v-if="searching" type="button" class="nav" aria-label="Back to the name grid" @click="stopSearching">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <div class="search-box">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </svg>
      <input
        ref="searchBox"
        v-model="name"
        class="field"
        maxlength="40"
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="next"
        placeholder="Search foods or type a name"
        aria-label="Search foods or type a timer name"
        @focus="searching = true"
      />
      <button v-if="name" type="button" class="clear" aria-label="Clear" @click="((name = ''), searchBox?.focus())">✕</button>
    </div>
  </div>

  <template v-if="!searching">
    <Transition name="fold">
      <section v-if="prep && state.recipes.length" class="presets-section recipes-section">
        <div class="label-row">
          <h3>Recipes · prep in one tap</h3>
          <button v-if="!state.presets.length" type="button" class="link" :aria-pressed="editingPresets" @click="editingPresets = !editingPresets">
            {{ editingPresets ? 'Done' : 'Edit' }}
          </button>
        </div>
        <div class="presets" :class="{ editing: editingPresets }">
          <div v-for="r in state.recipes" :key="r.id" class="preset-wrap">
            <button
              type="button"
              class="preset recipe"
              :aria-label="editingPresets ? `Delete recipe ${r.name}` : `Prep ${r.name}: ${describeRecipe(r)}`"
              @click="onRecipe(r)"
            >
              <FoodIcon :name="r.steps.find((s) => s.kind === 'timer')?.name ?? ''" class="preset-icon" />
              <strong>{{ r.name }}</strong>
              <span>{{ editingPresets ? 'Tap to delete' : describeRecipe(r) }}</span>
            </button>
          </div>
        </div>
      </section>
    </Transition>
    <Transition name="fold">
      <section v-if="state.presets.length" class="presets-section">
        <div class="label-row">
          <h3>Presets · {{ prep ? 'prep' : 'start' }} in one tap</h3>
          <button type="button" class="link" :aria-pressed="editingPresets" @click="editingPresets = !editingPresets">
            {{ editingPresets ? 'Done' : 'Edit' }}
          </button>
        </div>
        <TransitionGroup name="preset" tag="div" class="presets" :class="{ editing: editingPresets }" @before-leave="pinPreset">
          <!-- --i staggers the ✕s so they pop in as a quick cascade along the row -->
          <div v-for="(p, i) in state.presets" :key="p.id" class="preset-wrap" :style="{ '--i': i }">
            <button type="button" class="preset" :disabled="editingPresets" @click="onPreset(p)">
              <FoodIcon :name="p.name" class="preset-icon" />
              <strong>{{ p.name || 'Timer' }}</strong>
              <span>{{ describe(p) }}</span>
            </button>
            <!-- In edit mode the whole pill is the delete target; the ✕ sits in its centre -->
            <Transition name="del">
              <button
                v-if="editingPresets"
                type="button"
                class="preset-del"
                :aria-label="`Delete preset ${p.name || 'Timer'}`"
                @click="removePreset(p.id)"
              >
                <span class="x">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" />
                  </svg>
                </span>
              </button>
            </Transition>
          </div>
        </TransitionGroup>
      </section>
    </Transition>

    <div class="names">
      <button v-for="n in NAMES" :key="n" type="button" class="chip" :aria-pressed="name === n" @click="emit('pick', n)">
        <FoodIcon :name="n" class="chip-icon" />
        {{ n }}
      </button>
    </div>
  </template>

  <ul v-else class="results">
    <!-- Replaces the Next button while searching, so it costs one row instead of a footer -->
    <li v-if="offerTyped">
      <button type="submit" class="result use">
        <span class="use-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span class="use-text">Use “{{ typed }}”</span>
      </button>
    </li>
    <li v-for="[food, icon] in results" :key="food">
      <button type="button" class="result" @click="emit('pick', food)">
        <FoodIcon :icon="icon" class="result-icon" />
        {{ food }}
      </button>
    </li>
    <li v-if="!results.length" class="no-results">Nothing in the list matches, but any name works.</li>
  </ul>
</template>

<style scoped>
.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.link {
  padding: 4px 8px;
  margin: -4px -8px;
  color: var(--accent-text);
  font-weight: 650;
}

.search {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  /* Opaque, and a little taller than itself, so results scroll away underneath it. */
  margin: -4px 0;
  padding: 4px 0;
  background: var(--surface);
  color: var(--text-dim);
}

.search.active {
  /* The header is hidden while searching, so this row is the top of the sheet. */
  margin-top: 0;
  padding-top: 12px;
}

.search > .nav {
  flex: none;
  margin-left: -12px;
}

.search-box {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.search-box > svg {
  position: absolute;
  left: 14px;
  pointer-events: none;
}

.search .field {
  padding-left: 46px;
  padding-right: 46px;
  color: var(--text);
}

.clear {
  position: absolute;
  right: 4px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.result {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: var(--tap);
  padding: 0 10px;
  border-radius: var(--radius-sm);
  font-size: 1.1rem;
  font-weight: 600;
  text-align: left;
}

.result:active {
  background: var(--surface-2);
}

@media (hover: hover) {
  .result:hover {
    background: var(--surface-2);
  }
}

.result-icon {
  font-size: 1.35rem;
}

.result.use {
  color: var(--accent-text);
}

.use-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.9rem; /* same footprint as a food icon, so the names line up */
  height: 1.9rem;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
}

.use-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Compact search: a short visible area (keyboard up on a landscape tablet or phone).
   The sheet becomes the whole visible area (SheetShell.vue) and results flow in columns. */
.sheet.compact .search.active {
  padding-top: calc(8px + env(safe-area-inset-top));
}

.sheet.compact .results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); /* wide enough for "Shortcrust pastry" on one line */
  gap: 2px 8px;
}

.sheet.compact .result {
  min-height: 46px;
  font-size: 1.05rem;
}

.no-results {
  padding: 16px 10px;
  color: var(--text-dim);
}

.names {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

/* Four across needs a slightly smaller label; the icon does the recognising. */
.names .chip {
  font-size: 0.9rem;
}

@media (max-width: 359px) {
  .names {
    grid-template-columns: repeat(3, 1fr);
  }
}

.names .chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 78px;
  padding: 6px 4px;
}

.chip-icon {
  font-size: 1.5rem; /* icon is 1.4em of this */
}

.presets {
  position: relative; /* anchor for a pill pinned in place while it leaves */
  display: flex;
  gap: 8px;
  margin: 0 -20px;
  padding: 6px 20px; /* room for the pills to wiggle and the ✕ to overshoot without clipping */
  overflow-x: auto;
  scrollbar-width: none;
}

.presets::-webkit-scrollbar {
  display: none;
}

.preset-wrap {
  position: relative;
  flex: none;
}

.preset {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 10px;
  min-height: 60px;
  max-width: 240px;
  padding: 8px 16px 8px 12px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--accent);
  text-align: left;
}

.preset-icon {
  grid-row: span 2;
  font-size: 1.5rem;
}

.preset strong,
.preset span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset span {
  font-size: 0.85rem;
  color: var(--text-dim);
}

/* A recipe preps a set of steps: dashed, in the prep colour, like the Prep button. */
.preset.recipe {
  border: 2px dashed var(--prep-line);
  background: color-mix(in srgb, var(--prep) 10%, var(--bg));
}

.editing .preset.recipe {
  opacity: 1;
  animation: none;
  border-color: var(--danger);
  color: var(--danger);
}

/* Edit mode: pills keep their size (nothing jumps), fade back, and jiggle a little
   to say "these can go". The jiggle is on the pill, not its wrapper, so it never
   fights the wrapper's slide when a neighbour is removed. */
.preset {
  transition: opacity 0.2s ease;
}

.editing .preset {
  opacity: 0.4;
  animation: jiggle 0.3s ease-in-out infinite alternate;
  animation-delay: calc(var(--i) * -0.13s);
}

@keyframes jiggle {
  from {
    transform: rotate(-0.9deg);
  }
  to {
    transform: rotate(0.9deg);
  }
}

.preset-del {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
}

.preset-del .x {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--danger);
  color: var(--on-danger);
  box-shadow: 0 3px 10px rgb(0 0 0 / 0.35);
  transition: transform 0.1s ease;
}

.preset-del:active .x {
  transform: scale(0.88);
}

/* The ✕ pops in with a little overshoot, one pill after another, and ducks out quicker. */
.del-enter-active {
  transition:
    opacity 0.15s ease,
    transform 0.32s cubic-bezier(0.3, 1.7, 0.5, 1);
  transition-delay: calc(var(--i) * 45ms);
}

.del-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease-in;
  transition-delay: calc(var(--i) * 25ms);
}

.del-enter-from,
.del-leave-to {
  opacity: 0;
  transform: scale(0.2);
}

/* Removing one: it puffs up a touch and shrinks away while the rest slide over. */
.preset-leave-active {
  position: absolute;
  pointer-events: none;
  animation: preset-out 0.3s ease-in forwards;
}

@keyframes preset-out {
  30% {
    transform: scale(1.06);
  }
  100% {
    opacity: 0;
    transform: scale(0.4);
  }
}

.preset-move {
  transition: transform 0.38s cubic-bezier(0.3, 0.9, 0.3, 1) 0.18s; /* let the removed pill mostly go first */
}

/* Removing the last one folds the whole section away instead of snapping the grid up. */
.fold-leave-active {
  overflow: hidden;
  max-height: 120px;
  transition:
    opacity 0.25s ease,
    max-height 0.3s ease 0.2s,
    margin-bottom 0.3s ease 0.2s;
}

.fold-leave-to {
  opacity: 0;
  max-height: 0;
  margin-bottom: -16px; /* swallow the flex gap that would otherwise linger until the end */
}

/* Small phones: tighten up so every step still fits without scrolling. */
@media (max-height: 700px) {
  .names .chip {
    min-height: 56px;
    gap: 0;
  }
  .names {
    gap: 6px;
  }
  .preset {
    min-height: 48px;
    padding-block: 4px;
  }
  .chip-icon {
    font-size: 1.15rem;
  }
}

@keyframes fade-out {
  to {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .editing .preset {
    animation: none;
  }
  .preset-leave-active {
    animation: fade-out 0.15s ease forwards;
  }
  .del-enter-active,
  .del-leave-active,
  .preset-move,
  .fold-leave-active {
    transition-duration: 0.01s;
    transition-delay: 0s;
  }
}
</style>
