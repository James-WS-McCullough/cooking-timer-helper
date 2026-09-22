<script setup lang="ts">
// "+ Next step" on a card: what follows this one? An instruction is written here; a timer
// hands over to the ordinary wizard (App.vue opens it with `after` set). One decision per
// screen: kind, then (for an instruction) the words.
import { ref, watch } from 'vue'
import { addNextStep } from '../store'
import SheetShell from './sheet/SheetShell.vue'
import { useSteps } from './sheet/steps'

const props = defineProps<{ cardId: string; cardName: string }>()
const emit = defineEmits<{ close: []; timer: [] }>()

const STEPS = ['kind', 'text'] as const
const TITLES: Record<(typeof STEPS)[number], string> = {
  kind: 'What comes next?',
  text: 'What should it say?',
}
const { step, direction, go, back } = useSteps(STEPS)

const text = ref('')
const box = ref<HTMLInputElement>()
watch(step, (now) => {
  if (now === 'text') requestAnimationFrame(() => box.value?.focus())
})

function add() {
  if (!text.value.trim()) return
  addNextStep(props.cardId, { kind: 'note', text: text.value })
  emit('close')
}

function onSubmit() {
  if (step.value === 'text') add()
}
</script>

<template>
  <SheetShell
    :title="TITLES[step]"
    :steps="STEPS"
    :step="step"
    :direction="direction"
    :can-go-back="step === 'text'"
    :badge="`After ${cardName}`"
    @back="back"
    @close="emit('close')"
    @submit="onSubmit"
  >
    <div v-if="step === 'kind'" class="options">
      <button type="button" class="option" @click="go('text')">
        <strong>An instruction</strong>
        <span>Something to do first: “Add the diced chicken”</span>
      </button>
      <button type="button" class="option" @click="emit('timer')">
        <strong>A timer</strong>
        <span>The next thing to cook, ready to start when this one’s done</span>
      </button>
    </div>
    <template v-else>
      <input
        ref="box"
        v-model="text"
        class="field"
        autocomplete="off"
        enterkeyhint="done"
        placeholder="Add the diced chicken"
        aria-label="The instruction"
        maxlength="120"
      />
      <p class="hint">Short and doable in one go. It comes up when {{ cardName }} is done, and waits for you to press Done.</p>
    </template>

    <template v-if="step === 'text'" #foot>
      <button type="submit" class="next" :disabled="!text.trim()">Add step</button>
    </template>
  </SheetShell>
</template>

<style scoped>
.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-height: 92px;
  padding: 12px 18px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 2px solid transparent;
  text-align: left;
}

.option strong {
  font-size: 1.35rem;
}

.option span {
  color: var(--text-dim);
}

.option:active {
  transform: scale(0.98);
}

.hint {
  margin: 12px 4px 0;
  font-size: 0.9rem;
  color: var(--text-dim);
}

@media (max-height: 700px) {
  .option {
    min-height: 80px;
  }
}
</style>
