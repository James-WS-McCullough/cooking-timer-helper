<script setup lang="ts">
// "+ Next step" on a card: what follows this one? An instruction is written here; a timer
// hands over to the ordinary wizard (App.vue opens it with `after` set). One decision per
// screen: kind, then (for an instruction) the words.
import { ref, watch } from 'vue'
import { addStep, type StepTarget } from '../store'
import SheetShell from './sheet/SheetShell.vue'
import { useSteps } from './sheet/steps'

// `initial`: changing an existing instruction; the sheet opens on its words.
const props = defineProps<{ target: StepTarget; initial?: string }>()
const emit = defineEmits<{ close: []; timer: [] }>()

const STEPS = ['kind', 'text'] as const
const TITLES: Record<(typeof STEPS)[number], string> = {
  kind: 'What comes next?',
  text: 'What should it say?',
}
const { step, direction, go, back } = useSteps(STEPS)
const editing = props.target.kind === 'edit'
if (editing) step.value = 'text'

const text = ref(props.initial ?? '')
const box = ref<HTMLInputElement>()
watch(
  step,
  (now) => {
    if (now === 'text') requestAnimationFrame(() => box.value?.focus())
  },
  { immediate: true },
)

function add() {
  if (!text.value.trim()) return
  addStep(props.target, { kind: 'note', text: text.value })
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
    :can-go-back="step === 'text' && !editing"
    :badge="editing ? 'Change step' : target.name ? `After ${target.name}` : 'New step'"
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
        <span>The next thing to cook, ready to start in its turn</span>
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
      <p class="hint">Short and doable in one go. It comes up {{ target.name ? `when ${target.name} is done` : 'in its turn' }}, and waits for you to press Done. Name ingredients in [brackets] and they join the recipe’s list.</p>
    </template>

    <template v-if="step === 'text'" #foot>
      <button type="submit" class="next" :disabled="!text.trim()">{{ editing ? 'Save' : 'Add step' }}</button>
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
