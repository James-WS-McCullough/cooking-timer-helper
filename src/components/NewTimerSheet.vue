<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AlertKind, AlertPlan } from '../lib/timer'
import { formatClock, formatDuration, parseDuration } from '../lib/format'
import { removePreset, savePreset, startPreset, startTimer, state, type Preset } from '../store'
import FoodIcon from './FoodIcon.vue'

const emit = defineEmits<{ close: [] }>()

const MIN = 60_000
const TIMES = [1, 2, 3, 4, 5, 8, 10, 15, 20, 25]
const NAMES = ['Potatoes', 'Sausages', 'Chicken', 'Fish', 'Pasta', 'Rice', 'Eggs', 'Veg', 'Meat', 'Sauce', 'Oven', 'Pan']
const INTERVALS = [1, 2, 3, 5]
const LABELS = ['Flip', 'Stir', 'Check', 'Baste']

// One decision per screen. Most taps move forward on their own, so a plain
// timer is: name → None → time, and it's running.
type Step = 'name' | 'alerts' | 'details' | 'time'
const step = ref<Step>('name')
const direction = ref<'fwd' | 'back'>('fwd')

function go(next: Step) {
  direction.value = 'fwd'
  step.value = next
}

function back() {
  direction.value = 'back'
  if (step.value === 'time') step.value = kind.value === 'none' ? 'alerts' : 'details'
  else if (step.value === 'details') step.value = 'alerts'
  else step.value = 'name'
}

const steps = computed<Step[]>(() =>
  kind.value === 'none' ? ['name', 'alerts', 'time'] : ['name', 'alerts', 'details', 'time'],
)

// ---- Name ----
const name = ref('')

function pickName(n: string) {
  name.value = n
  go('alerts')
}

// ---- Alerts ----
const kind = ref<AlertKind>('none')
const label = ref('Flip')
const pickedEvery = ref<number | null>(2)
const customEvery = ref('')
const everyMs = computed(() => (customEvery.value.trim() ? parseDuration(customEvery.value) : (pickedEvery.value ?? 0) * MIN || null))

// A single flip usually means the tray is out of the oven (hold the clock);
// repeated flips happen in a pan that's still on the heat (keep counting).
// Follow that default until the cook sets it by hand.
const pause = ref(false)
let pauseTouched = false
function togglePause() {
  pauseTouched = true
  pause.value = !pause.value
}

function pickKind(k: AlertKind) {
  kind.value = k
  if (!pauseTouched) pause.value = k === 'half'
  go(k === 'none' ? 'time' : 'details')
}

function pickEvery(min: number) {
  pickedEvery.value = min
  customEvery.value = ''
}

const detailsProblem = computed(() =>
  kind.value === 'every' && !everyMs.value ? 'Choose how often, e.g. 2 or 1:30' : '',
)

const plan = computed<AlertPlan>(() => ({
  kind: kind.value,
  everyMs: kind.value === 'every' ? (everyMs.value ?? 0) : 0,
  label: label.value,
  pause: kind.value !== 'none' && pause.value,
}))

// ---- Time ----
const customTime = ref('')
const customMs = computed(() => parseDuration(customTime.value))
const keepAsPreset = ref(false)

/** A repeating alert needs room to fire at least once. */
function tooShort(ms: number): boolean {
  return kind.value === 'every' && ms <= plan.value.everyMs
}

const timeProblem = computed(() => {
  if (!customTime.value.trim()) return ''
  if (customMs.value === null) return 'Enter minutes (12 or 1.5) or m:ss (1:30)'
  if (tooShort(customMs.value)) return `Needs to be longer than the ${formatDuration(plan.value.everyMs)} interval`
  return ''
})

const recap = computed(() => {
  const bits = [name.value.trim() || 'Timer']
  if (kind.value === 'half') bits.push(`${label.value} halfway`)
  if (kind.value === 'every') bits.push(`${label.value} every ${formatDuration(plan.value.everyMs)}`)
  if (plan.value.pause) bits.push('holds')
  return bits.join(' · ')
})

function start(ms: number | null) {
  if (ms === null || tooShort(ms)) return
  if (keepAsPreset.value) savePreset(name.value, ms, plan.value)
  startTimer(name.value, ms, plan.value)
  emit('close')
}

// ---- Presets ----
const editingPresets = ref(false)

function describe(p: Preset): string {
  const bits = [formatDuration(p.durationMs)]
  if (p.plan.kind === 'half') bits.push(`${p.plan.label} ½`)
  if (p.plan.kind === 'every') bits.push(`${p.plan.label} / ${formatDuration(p.plan.everyMs)}`)
  return bits.join(' · ')
}

function onPreset(p: Preset) {
  if (editingPresets.value) return
  startPreset(p)
  emit('close')
}

watch(
  () => state.presets.length,
  (n) => {
    if (n === 0) editingPresets.value = false
  },
)

const TITLES: Record<Step, string> = {
  name: "What's cooking?",
  alerts: 'Alerts along the way?',
  details: 'Alert details',
  time: 'How long?',
}

function onSubmit() {
  if (step.value === 'name') go('alerts')
  else if (step.value === 'details' && !detailsProblem.value) go('time')
  else if (step.value === 'time' && !timeProblem.value) start(customMs.value)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <form class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" @submit.prevent="onSubmit">
      <header class="head">
        <button v-if="step !== 'name'" type="button" class="nav" aria-label="Back" @click="back">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <span v-else class="nav" />
        <div class="dots" aria-hidden="true">
          <span v-for="s in steps" :key="s" :class="{ on: s === step }" />
        </div>
        <button type="button" class="nav" aria-label="Close" @click="emit('close')">✕</button>
      </header>

      <Transition :name="direction" mode="out-in">
        <div :key="step" class="body">
          <h2 id="sheet-title">{{ TITLES[step] }}</h2>

          <!-- 1 · Name -->
          <template v-if="step === 'name'">
            <section v-if="state.presets.length">
              <div class="label-row">
                <h3>Presets · start in one tap</h3>
                <button type="button" class="link" @click="editingPresets = !editingPresets">
                  {{ editingPresets ? 'Finished' : 'Edit' }}
                </button>
              </div>
              <div class="presets">
                <div v-for="p in state.presets" :key="p.id" class="preset-wrap">
                  <button type="button" class="preset" :disabled="editingPresets" @click="onPreset(p)">
                    <FoodIcon :name="p.name" class="preset-icon" />
                    <strong>{{ p.name || 'Timer' }}</strong>
                    <span>{{ describe(p) }}</span>
                  </button>
                  <button
                    v-if="editingPresets"
                    type="button"
                    class="preset-del"
                    :aria-label="`Delete preset ${p.name}`"
                    @click="removePreset(p.id)"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </section>

            <div class="names">
              <button v-for="n in NAMES" :key="n" type="button" class="chip" :aria-pressed="name === n" @click="pickName(n)">
                <FoodIcon :name="n" class="chip-icon" />
                {{ n }}
              </button>
            </div>
            <input
              v-model="name"
              class="field"
              maxlength="40"
              autocomplete="off"
              enterkeyhint="next"
              placeholder="Or type a name"
              aria-label="Timer name"
            />
          </template>

          <!-- 2 · Alerts -->
          <template v-else-if="step === 'alerts'">
            <div class="options">
              <button type="button" class="option" :aria-pressed="kind === 'none'" @click="pickKind('none')">
                <strong>None</strong>
                <span>Just count down</span>
              </button>
              <button type="button" class="option" :aria-pressed="kind === 'half'" @click="pickKind('half')">
                <strong>Halfway</strong>
                <span>One alert at the midpoint, like flipping a tray in the oven</span>
              </button>
              <button type="button" class="option" :aria-pressed="kind === 'every'" @click="pickKind('every')">
                <strong>Every…</strong>
                <span>Repeats through the cook, like flipping every 2 minutes</span>
              </button>
            </div>
          </template>

          <!-- 3 · Alert details (skipped for None) -->
          <template v-else-if="step === 'details'">
            <section v-if="kind === 'every'">
              <h3>Every how many minutes</h3>
              <div class="every">
                <button
                  v-for="m in INTERVALS"
                  :key="m"
                  type="button"
                  class="chip big-num"
                  :aria-pressed="!customEvery && pickedEvery === m"
                  @click="pickEvery(m)"
                >
                  {{ m }}
                </button>
                <input
                  v-model="customEvery"
                  class="field every-field"
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="other"
                  aria-label="Custom interval in minutes"
                />
              </div>
            </section>

            <section>
              <h3>Remind me to</h3>
              <div class="labels">
                <button v-for="l in LABELS" :key="l" type="button" class="chip" :aria-pressed="label === l" @click="label = l">
                  {{ l }}
                </button>
              </div>
            </section>

            <button type="button" class="switch-row" role="switch" :aria-checked="pause" @click="togglePause">
              <span>
                <strong>Hold timer until I confirm</strong>
                <small>{{ pause ? 'Clock stops while the food is out' : 'Clock keeps running — food stays on the heat' }}</small>
              </span>
              <span class="switch" aria-hidden="true" />
            </button>
          </template>

          <!-- 4 · Time: tapping a number starts the timer -->
          <template v-else>
            <p class="recap"><FoodIcon :name="name" />{{ recap }}</p>
            <div class="times">
              <button
                v-for="m in TIMES"
                :key="m"
                type="button"
                class="chip big-num"
                :disabled="tooShort(m * MIN)"
                @click="start(m * MIN)"
              >
                {{ m }}
              </button>
            </div>
            <input
              v-model="customTime"
              class="field"
              :class="{ bad: timeProblem }"
              inputmode="decimal"
              autocomplete="off"
              enterkeyhint="go"
              placeholder="Other minutes: 12, 1.5 or 1:30"
              aria-label="Custom time in minutes"
            />
            <button type="button" class="switch-row" role="switch" :aria-checked="keepAsPreset" @click="keepAsPreset = !keepAsPreset">
              <span>
                <strong>Save as preset</strong>
                <small>Turn on before picking the time</small>
              </span>
              <span class="switch" aria-hidden="true" />
            </button>
          </template>
        </div>
      </Transition>

      <footer v-if="step === 'name'" class="foot">
        <button type="submit" class="next">{{ name.trim() ? 'Next' : 'Skip name' }}</button>
      </footer>
      <footer v-else-if="step === 'details'" class="foot">
        <p v-if="detailsProblem" class="problem" role="alert">{{ detailsProblem }}</p>
        <button type="submit" class="next" :disabled="!!detailsProblem">Next</button>
      </footer>
      <footer v-else-if="step === 'time' && customTime.trim()" class="foot">
        <p v-if="timeProblem" class="problem" role="alert">{{ timeProblem }}</p>
        <button type="submit" class="next tabular" :disabled="!!timeProblem">
          {{ customMs && !timeProblem ? `Start ${formatClock(customMs)}` : 'Start' }}
        </button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.55);
  animation: fade 0.15s ease-out;
}

/* Fixed height so the sheet doesn't jump around between steps. */
.sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  height: min(680px, calc(100dvh - env(safe-area-inset-top) - 12px));
  border-radius: 24px 24px 0 0;
  background: var(--surface);
  overflow: hidden;
  animation: rise 0.2s ease-out;
}

@media (min-width: 640px) {
  .scrim {
    align-items: center;
  }
  .sheet {
    border-radius: 24px;
    height: min(640px, calc(100dvh - 48px));
  }
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 0;
}

.nav {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: var(--text-dim);
  font-size: 1.1rem;
}

.dots {
  display: flex;
  gap: 8px;
}

.dots span {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: var(--border);
  transition:
    width 0.2s,
    background 0.2s;
}

.dots span.on {
  width: 24px;
  background: var(--accent);
}

.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding: 4px 20px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

h2 {
  margin: 0 0 2px;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

h3 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
}

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
  min-height: 84px;
  padding: 6px 4px;
}

.chip-icon {
  font-size: 1.5rem; /* icon is 1.4em of this */
}

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

.option[aria-pressed='true'] {
  border-color: var(--accent);
}

.option:active {
  transform: scale(0.98);
}

.times {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.chip.big-num {
  min-height: 72px;
  padding: 0;
  font-size: 1.6rem;
  font-weight: 700;
}

.chip:disabled {
  opacity: 0.3;
  cursor: default;
}

.recap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -8px 0 0;
  color: var(--text-dim);
  font-weight: 600;
}

.every {
  display: grid;
  grid-template-columns: repeat(4, 1fr) 1.4fr;
  gap: 8px;
}

.every-field {
  min-height: 72px;
  padding: 0 8px;
  text-align: center;
}

.labels {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.labels .chip {
  padding: 0 4px;
}

.field.bad {
  border-color: var(--danger);
}

.presets {
  display: flex;
  gap: 8px;
  margin: 0 -20px;
  padding: 2px 20px;
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

.preset:disabled {
  opacity: 0.6;
  padding-right: 48px;
}

.preset-del {
  position: absolute;
  top: 50%;
  right: 8px;
  width: 36px;
  height: 36px;
  margin-top: -18px;
  border-radius: 50%;
  background: var(--danger);
  color: #fff;
  font-weight: 700;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 64px;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  text-align: left;
}

.switch-row strong,
.switch-row small {
  display: block;
}

.switch-row small {
  color: var(--text-dim);
  font-size: 0.85rem;
}

.switch {
  position: relative;
  flex: none;
  width: 52px;
  height: 32px;
  border-radius: 16px;
  background: var(--border);
  transition: background 0.15s;
}

.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
  transition: transform 0.15s;
}

[aria-checked='true'] .switch {
  background: var(--accent);
}

[aria-checked='true'] .switch::after {
  transform: translateX(20px);
}

.foot {
  padding: 12px 20px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
}

.problem {
  margin: 0 0 10px;
  text-align: center;
  font-weight: 600;
  color: var(--danger);
}

.next {
  width: 100%;
  min-height: 64px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.4rem;
  font-weight: 800;
}

.next:disabled {
  background: var(--surface-2);
  color: var(--text-dim);
  cursor: default;
}

.next:not(:disabled):active {
  transform: scale(0.98);
}

/* Steps slide in from the side you're heading towards. */
.fwd-enter-active,
.fwd-leave-active,
.back-enter-active,
.back-leave-active {
  transition:
    transform 0.12s ease,
    opacity 0.12s ease;
}

.fwd-enter-from,
.back-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.fwd-leave-to,
.back-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}

/* Small phones: tighten up so every step still fits without scrolling. */
@media (max-height: 700px) {
  .body {
    gap: 12px;
  }
  h2 {
    font-size: 1.4rem;
  }
  .names .chip {
    min-height: 64px;
    gap: 1px;
  }
  .chip-icon {
    font-size: 1.15rem;
  }
  .option {
    min-height: 80px;
  }
  .chip.big-num,
  .every-field {
    min-height: 60px;
  }
}

@keyframes fade {
  from {
    opacity: 0;
  }
}

@keyframes rise {
  from {
    transform: translateY(40px);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scrim,
  .sheet {
    animation: none;
  }
  .fwd-enter-active,
  .fwd-leave-active,
  .back-enter-active,
  .back-leave-active {
    transition: none;
  }
}
</style>
