<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDuration, parseDuration } from '../lib/format'
import { type AlertKind, type AlertPlan, elapsedMs, NO_ALERTS, type Timer } from '../lib/timer'
import { setTimerPlan, state, upsertPreset } from '../store'
import FoodIcon from './FoodIcon.vue'
import AlertDetailsStep from './sheet/AlertDetailsStep.vue'
import AlertKindStep from './sheet/AlertKindStep.vue'
import SheetShell from './sheet/SheetShell.vue'
import { useSteps } from './sheet/steps'

// Editing the mid-way alerts of a timer that already exists (the bell on its card):
// which kind → its details. A prepped timer's sheet wears the prep colour, like its card.
const props = defineProps<{ timer: Timer }>()
const emit = defineEmits<{ close: [] }>()

const MIN = 60_000

// One decision per screen, and most taps move forward on their own.
const STEPS = ['alerts', 'details'] as const
const TITLES: Record<(typeof STEPS)[number], string> = {
  alerts: 'Alerts along the way?',
  details: 'Alert details',
}
const { step, direction, go, back } = useSteps(STEPS)

const current = props.timer.plan ?? NO_ALERTS
const presetMinutes = [1, 2, 3, 5].includes(current.everyMs / MIN)
const kind = ref<AlertKind>(current.kind)
const label = ref(current.label)
const pickedEvery = ref<number | null>(current.kind !== 'every' ? 2 : presetMinutes ? current.everyMs / MIN : null)
const customEvery = ref(current.kind === 'every' && !presetMinutes ? String(current.everyMs / MIN) : '')
const everyMs = computed(() =>
  customEvery.value.trim() ? parseDuration(customEvery.value) : (pickedEvery.value ?? 0) * MIN || null,
)
const keepAsPreset = ref(false)

// A single flip usually means the tray is out of the oven (hold the clock);
// repeated flips happen in a pan that's still on the heat (keep counting).
// Follow that default until the cook sets it by hand.
const pause = ref(current.pause)
let pauseTouched = current.kind !== 'none'
function togglePause() {
  pauseTouched = true
  pause.value = !pause.value
}

// A halfway alert on a timer that's already past halfway could never fire.
const pastHalfway = computed(() => elapsedMs(props.timer, state.now) >= props.timer.durationMs / 2)

function pickKind(k: AlertKind) {
  if (k === 'half' && pastHalfway.value) return
  kind.value = k
  if (!pauseTouched) pause.value = k === 'half'
  if (k === 'none') applyAlerts()
  else go('details')
}

const detailsProblem = computed(() => {
  if (kind.value !== 'every') return ''
  if (!everyMs.value) return 'Choose how often, e.g. 2 or 1:30'
  const total = props.timer.durationMs
  return everyMs.value >= total ? `Needs to be shorter than the ${formatDuration(total)} timer` : ''
})

const plan = computed<AlertPlan>(() => ({
  kind: kind.value,
  everyMs: kind.value === 'every' ? (everyMs.value ?? 0) : 0,
  label: label.value,
  pause: kind.value !== 'none' && pause.value,
}))

function applyAlerts() {
  const t = props.timer
  setTimerPlan(t.id, plan.value)
  if (keepAsPreset.value) upsertPreset(t.name, t.durationMs, plan.value)
  emit('close')
}

const subject = computed(() => `${props.timer.name || 'Timer'} · ${formatDuration(props.timer.durationMs)}`)

function onSubmit() {
  if (step.value === 'details' && !detailsProblem.value) applyAlerts()
}
</script>

<template>
  <SheetShell
    :title="TITLES[step]"
    :steps="STEPS"
    :step="step"
    :direction="direction"
    :can-go-back="step === 'details'"
    :prep="timer.prepped"
    @back="back"
    @close="emit('close')"
    @submit="onSubmit"
  >
    <p class="recap"><FoodIcon :name="timer.name" />{{ subject }}</p>

    <AlertKindStep v-if="step === 'alerts'" :kind="kind" :has-alerts="current.kind !== 'none'" :past-halfway="pastHalfway" @pick="pickKind" />
    <AlertDetailsStep
      v-else
      v-model:picked-every="pickedEvery"
      v-model:custom-every="customEvery"
      v-model:label="label"
      v-model:keep-as-preset="keepAsPreset"
      :kind="kind"
      :pause="pause"
      @toggle-pause="togglePause"
    />

    <template v-if="step === 'details'" #foot>
      <p v-if="detailsProblem" class="problem" role="alert">{{ detailsProblem }}</p>
      <button type="submit" class="next" :disabled="!!detailsProblem">Set alert</button>
    </template>
  </SheetShell>
</template>
