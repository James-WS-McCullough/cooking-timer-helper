<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatClock, parseDuration, tidyName } from '../lib/format'
import { NO_ALERTS } from '../lib/timer'
import { addNextStep, type Preset, type Recipe, savePreset, startPreset, startRecipe, startTimer } from '../store'
import NameStep from './sheet/NameStep.vue'
import SheetShell from './sheet/SheetShell.vue'
import { useSteps } from './sheet/steps'
import TimeStep from './sheet/TimeStep.vue'

// Making a timer (name → time). With `prep`, it's built now and started later, in its own colour.
// Alerts are deliberately not part of making a timer: starting one should take two taps.
// (They're added from the bell on a timer's card: AlertSheet.vue.)
// `heard`: a name that came from the mic without a time; the wizard opens at "How long?" for it.
// `after`: the timer is the next step of that card's recipe, not a timer of its own.
const props = defineProps<{ prep?: boolean; heard?: string; after?: { id: string; name: string } }>()
const emit = defineEmits<{ close: [] }>()

// One decision per screen, and most taps move forward on their own.
const STEPS = ['name', 'time'] as const
const TITLES: Record<(typeof STEPS)[number], string> = {
  name: "What's cooking?",
  time: 'How long?',
}
const { step, direction, go, back } = useSteps(STEPS)
if (props.heard) step.value = 'time'

// ---- Name ----
const name = ref(props.heard ?? '')
const searching = ref(false)
// The search box can still be focused while the name step slides away (a quick tap
// on it just after picking a chip). Search mode belongs to that step only, so drop
// it on arrival anywhere else; otherwise the next screen loses its header and title.
watch(step, (now) => {
  if (now !== 'name') searching.value = false
})
const editingPresets = ref(false)

function pickName(n: string) {
  name.value = n
  searching.value = false
  go('time')
}

function onPreset(p: Preset) {
  if (props.after) addNextStep(props.after.id, { kind: 'timer', name: p.name, durationMs: p.durationMs, plan: p.plan })
  else startPreset(p, props.prep)
  emit('close')
}

function onRecipe(r: Recipe) {
  startRecipe(r)
  emit('close')
}

// ---- Time ----
const customTime = ref('')
const customMs = computed(() => parseDuration(customTime.value))
const keepAsPreset = ref(false)

const timeProblem = computed(() =>
  customTime.value.trim() && customMs.value === null ? 'Enter minutes (45 or 1.5) or m:ss (1:30)' : '',
)

function start(ms: number | null) {
  if (ms === null) return
  if (keepAsPreset.value) savePreset(name.value, ms, NO_ALERTS)
  if (props.after) addNextStep(props.after.id, { kind: 'timer', name: name.value, durationMs: ms, plan: NO_ALERTS })
  else startTimer(name.value, ms, NO_ALERTS, props.prep)
  emit('close')
}

function onSubmit() {
  if (step.value === 'name') {
    searching.value = false
    name.value = tidyName(name.value) // so the next screen already shows it as it will appear
    go('time')
  } else if (!timeProblem.value) start(customMs.value)
}
</script>

<template>
  <SheetShell
    :title="TITLES[step]"
    :steps="STEPS"
    :step="step"
    :direction="direction"
    :can-go-back="step === 'time'"
    :badge="after ? `After ${after.name}` : prep ? 'Prep for later' : undefined"
    :prep="prep"
    :immersive="step === 'name' && searching"
    @back="back"
    @close="emit('close')"
    @submit="onSubmit"
  >
    <NameStep
      v-if="step === 'name'"
      v-model:name="name"
      v-model:searching="searching"
      v-model:editing-presets="editingPresets"
      :prep="prep"
      @pick="pickName"
      @preset="onPreset"
      @recipe="onRecipe"
    />
    <TimeStep v-else v-model:custom-time="customTime" v-model:keep-as-preset="keepAsPreset" :name="name" :invalid="!!timeProblem" @start="start" />

    <template v-if="step === 'name' && !searching" #foot>
      <button type="submit" class="next">{{ name.trim() ? 'Next' : 'Skip name' }}</button>
    </template>
    <template v-else-if="step === 'time' && customTime.trim()" #foot>
      <p v-if="timeProblem" id="time-problem" class="problem" role="alert">{{ timeProblem }}</p>
      <button type="submit" class="next tabular" :disabled="!!timeProblem">
        {{ after ? 'Add step' : prep ? 'Prep' : 'Start' }}{{ customMs && !timeProblem ? ` ${formatClock(customMs)}` : '' }}
      </button>
    </template>
  </SheetShell>
</template>
