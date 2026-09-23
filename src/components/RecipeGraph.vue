<script setup lang="ts">
// A recipe as a picture: rows of steps, lines showing what waits for what, so a fork and
// a join are visible at a glance. With a run, done steps dim and the ones up now are lit.
// Tapping a node offers to add a branch after it, or remove it (the parent decides).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { formatDuration } from '../lib/format'
import { layout, type Recipe, type Run, type Step } from '../lib/recipe'
import FoodIcon from './FoodIcon.vue'

const props = defineProps<{ recipe: Recipe; run?: Run }>()
const emit = defineEmits<{ add: [after: string[]]; edit: [step: Step]; remove: [step: Step] }>()

const rows = computed(() => layout(props.recipe))
const stateOf = (s: Step) =>
  props.run?.done.includes(s.id) ? 'done' : props.run?.active.includes(s.id) ? 'up' : 'later'
const label = (s: Step) =>
  s.kind === 'timer' ? s.name || `${formatDuration(s.durationMs)} timer` : s.text.replace(/\[|\]/g, '')

// Tapping a node: a small menu under the graph. A step that's done or on screen can only
// have something added after it; an upcoming one can be changed or taken out.
const picked = ref<Step | null>(null)
const pickedState = computed(() => (picked.value ? stateOf(picked.value) : 'later'))
function choose(what: 'add' | 'edit' | 'remove') {
  const step = picked.value
  picked.value = null
  if (!step) return
  if (what === 'add') emit('add', [step.id])
  else if (what === 'edit') emit('edit', step)
  else emit('remove', step)
}

// Lines are drawn between the real boxes, measured after each render.
const box = ref<HTMLElement>()
const nodes = new Map<string, HTMLElement>()
const setNode = (id: string) => (el: unknown) => {
  if (el instanceof HTMLElement) nodes.set(id, el)
  else nodes.delete(id)
}
const lines = ref<string[]>([])
const size = ref({ w: 0, h: 0 })

function measure() {
  const root = box.value
  if (!root) return
  const origin = root.getBoundingClientRect()
  size.value = { w: root.clientWidth, h: root.clientHeight }
  const centre = (id: string) => {
    const r = nodes.get(id)?.getBoundingClientRect()
    return r ? { x: r.left - origin.left + r.width / 2, top: r.top - origin.top, bottom: r.bottom - origin.top } : null
  }
  const out: string[] = []
  for (const step of props.recipe.steps) {
    const to = centre(step.id)
    if (!to) continue
    for (const id of step.after) {
      const from = centre(id)
      if (!from) continue
      const mid = (from.bottom + to.top) / 2
      out.push(`M${from.x},${from.bottom} C${from.x},${mid} ${to.x},${mid} ${to.x},${to.top}`)
    }
  }
  lines.value = out
}

let watcher: ResizeObserver | undefined
onMounted(() => {
  measure()
  watcher = new ResizeObserver(measure)
  if (box.value) watcher.observe(box.value)
})
onBeforeUnmount(() => watcher?.disconnect())
watch(
  () => [
    props.recipe.steps.map((s) => `${s.id}:${s.after.join()}`).join('|'),
    props.run?.done.length,
    props.run?.active.length,
  ],
  () => void nextTick(measure),
)
</script>

<template>
  <div ref="box" class="graph">
    <svg class="lines" :width="size.w" :height="size.h" aria-hidden="true">
      <path v-for="(d, i) in lines" :key="i" :d="d" />
    </svg>
    <div v-for="(row, r) in rows" :key="r" class="row">
      <button
        v-for="s in row"
        :key="s.id"
        :ref="setNode(s.id)"
        type="button"
        class="node"
        :class="[stateOf(s), s.kind, { picked: picked?.id === s.id }]"
        :aria-pressed="picked?.id === s.id"
        :aria-label="`${label(s)}${s.kind === 'timer' ? `, ${formatDuration(s.durationMs)}` : ''}${stateOf(s) === 'done' ? ', done' : stateOf(s) === 'up' ? ', now' : ''}`"
        @click="picked = picked?.id === s.id ? null : s"
      >
        <span class="glyph">
          <FoodIcon v-if="s.kind === 'timer'" :name="s.name" />
          <svg v-else viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 6h11M9 12h11M9 18h11" />
            <path d="M3.5 6.2l1.2 1.2 2-2.2M3.5 12.2l1.2 1.2 2-2.2M3.5 18.2l1.2 1.2 2-2.2" />
          </svg>
        </span>
        <span class="text">{{ label(s) }}</span>
        <span v-if="s.kind === 'timer'" class="time tabular">{{ formatDuration(s.durationMs) }}</span>
      </button>
    </div>
    <div v-if="picked" class="node-menu" role="group" :aria-label="label(picked)">
      <button v-if="pickedState === 'later'" type="button" class="menu-btn" @click="choose('edit')">Change this step</button>
      <button type="button" class="menu-btn" @click="choose('add')">Add a step after this</button>
      <button v-if="pickedState === 'later'" type="button" class="menu-btn danger" @click="choose('remove')">Remove this step</button>
      <button type="button" class="menu-btn quiet" @click="picked = null">Cancel</button>
    </div>
    <button v-else type="button" class="link" @click="emit('add', [])">+ Add a step at the end</button>
  </div>
</template>

<style scoped>
.graph {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 4px 0;
}

.lines {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.lines path {
  fill: none;
  stroke: var(--border);
  stroke-width: 2.5;
}

.row {
  position: relative;
  display: flex;
  justify-content: center;
  gap: 10px;
}

.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100px;
  min-height: var(--tap);
  padding: 8px 6px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 2px solid transparent;
  text-align: center;
}

.node.picked {
  border-color: var(--text);
}

.node.up {
  border-color: var(--accent);
}

.node.done {
  opacity: 0.45;
}

.glyph {
  display: grid;
  place-items: center;
  height: 26px;
  font-size: 1.3rem;
  color: var(--accent-text);
}

.text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 0.85rem;
  font-weight: 650;
  line-height: 1.2;
}

.note .text {
  font-weight: 550;
}

.time {
  font-size: 0.8rem;
  color: var(--text-dim);
}

.node-menu {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.menu-btn {
  min-height: 48px;
  border-radius: 10px;
  background: var(--surface);
  font-weight: 700;
}

.menu-btn.danger {
  color: var(--danger);
}

.menu-btn.quiet {
  background: transparent;
  color: var(--text-dim);
  font-weight: 600;
}

.link {
  align-self: flex-start;
  min-height: 40px;
  padding: 0 4px;
  color: var(--accent-text);
  font-weight: 700;
}

/* Three across on a phone: narrower boxes, same rows. */
@media (max-width: 400px) {
  .node {
    width: 92px;
  }
}
</style>
