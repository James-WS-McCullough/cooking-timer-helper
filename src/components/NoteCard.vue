<script setup lang="ts">
// An instruction step of a recipe, as a card: the words, and one Done. It arrives where
// the step before it was, and its Done brings up whatever follows.
import { computed, ref } from 'vue'
import { useDialog } from '../lib/dialog'
import { type Note, stepPosition } from '../lib/recipe'
import { doneNote, removeRun, stepContext, stepsAfter } from '../store'
import NextStepButton from './NextStepButton.vue'

const props = defineProps<{ note: Note }>()
const emit = defineEmits<{ next: [] }>()

const context = computed(() => stepContext(props.note))
const where = computed(() => {
  const c = context.value
  if (!c) return ''
  const { index, total } = stepPosition(c.run.recipe, c.step.id)
  return c.run.recipe.name ? `${c.run.recipe.name} · step ${index} of ${total}` : `Step ${index} of ${total}`
})
const following = computed(() => stepsAfter(props.note))

// The same two-tap remove as a timer card, over this card only (TimerCard.vue explains).
const confirming = ref(false)
const card = ref<HTMLElement>()
const confirmBox = ref<HTMLElement>()
useDialog(confirmBox, () => (confirming.value = false), { when: confirming, within: card, focus: 'first' })
let backOut: ReturnType<typeof setTimeout> | undefined
function askRemove() {
  confirming.value = true
  clearTimeout(backOut)
  backOut = setTimeout(() => (confirming.value = false), 5000)
}
</script>

<template>
  <article ref="card" class="card is-note" :aria-label="note.text">
    <header class="top">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M3.5 6.2l1.2 1.2 2-2.2M3.5 12.2l1.2 1.2 2-2.2M3.5 18.2l1.2 1.2 2-2.2" />
        </svg>
      </span>
      <span class="where">{{ where }}</span>
      <NextStepButton :name="note.text" :following="following" @click="emit('next')" />
      <button class="remove" :aria-label="`Remove this recipe`" @click="askRemove">✕</button>
    </header>

    <h2 class="text">{{ note.text }}</h2>
    <button class="big" :aria-label="`Done: ${note.text}`" @click="doneNote(note.id)">Done</button>

    <Transition name="confirm">
      <div v-if="confirming" ref="confirmBox" class="confirm" role="alertdialog" aria-modal="true" aria-label="Remove this recipe and its steps?">
        <button class="confirm-button" @click="removeRun(note.step.runId)">Remove recipe</button>
      </div>
    </Transition>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 16px 14px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.top {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
}

.icon {
  display: grid;
  place-items: center;
  color: var(--accent-text);
}

.where {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-dim);
  font-size: 0.9rem;
  font-weight: 600;
}

.remove {
  flex: none;
  min-width: 44px;
  height: 44px;
  padding: 0 10px;
  margin: -4px -12px -4px -6px;
  border-radius: 10px;
  color: var(--text-dim);
  font-weight: 600;
}

.text {
  margin: 2px 0 8px;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.3;
  text-wrap: balance;
}

.big {
  width: 100%;
  min-height: 60px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.3rem;
  font-weight: 800;
}

.big:active {
  transform: scale(0.97);
}

.confirm {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  border: 3px solid var(--danger);
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(2px);
}

.confirm-button {
  min-width: 160px;
  min-height: 56px;
  padding: 0 28px;
  border-radius: 28px;
  background: var(--danger);
  color: var(--on-danger);
  font-size: 1.25rem;
  font-weight: 800;
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
}

.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.18s ease;
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .confirm-enter-active,
  .confirm-leave-active {
    transition: none;
  }
}
</style>
