<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { elapsedMs, NO_ALERTS, type AlertKind, type AlertPlan, type Timer } from '../lib/timer'
import { formatClock, formatDuration, parseDuration, tidyName } from '../lib/format'
import { removePreset, savePreset, setTimerPlan, startPreset, startTimer, state, upsertPreset, type Preset } from '../store'
import FoodIcon from './FoodIcon.vue'
import { FOODS } from '../data/foods'
import { searchFoods } from '../lib/foodSearch'
import { recentTimes } from '../lib/history'

// Two jobs, one sheet:
//  - making a timer (name → time). With `prep`, it's built now and started later, in its own colour.
//  - with `alertsFor`, editing the mid-way alerts of a timer that already exists (the bell on its card).
// Alerts are deliberately not part of making a timer: starting one should take two taps.
const props = defineProps<{ prep?: boolean; alertsFor?: Timer }>()
const emit = defineEmits<{ close: [] }>()

const MIN = 60_000
// Two groups rather than one wall of tiles: every minute up to ten (a complete run
// is quicker to scan than one with gaps), then the usual longer cooks on their own row.
const SHORTER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const LONGER = [12, 15, 20, 25, 30]
// Three rows of specific foods, then a row that covers most other things people time.
const NAMES = [
  ...['Potatoes', 'Sausages', 'Chicken', 'Fish'],
  ...['Pasta', 'Rice', 'Eggs', 'Veg'],
  ...['Meat', 'Sauce', 'Oven', 'Pan'],
  ...['Pizza', 'Bread', 'Bake', 'Tea'],
]
const INTERVALS = [1, 2, 3, 5]
const LABELS = ['Flip', 'Stir', 'Check', 'Baste']

// One decision per screen, and most taps move forward on their own.
type Step = 'name' | 'time' | 'alerts' | 'details'
const step = ref<Step>(props.alertsFor ? 'alerts' : 'name')
const direction = ref<'fwd' | 'back'>('fwd')

function go(next: Step) {
  direction.value = 'fwd'
  step.value = next
}

function back() {
  if (searching.value) return stopSearching()
  direction.value = 'back'
  step.value = step.value === 'details' ? 'alerts' : 'name'
}

const steps = computed<Step[]>(() => (props.alertsFor ? ['alerts', 'details'] : ['name', 'time']))

// ---- Name ----
const name = ref('')

function pickName(n: string) {
  name.value = n
  searching.value = false
  go('time')
}

// Focusing the name box turns the step into a search of the built-in food list.
// The box doubles as free text: anything typed can be used as the name as-is.
const searching = ref(false)
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

// ---- Alerts (only when opened from a card's bell) ----
const current = props.alertsFor?.plan ?? NO_ALERTS
const presetMinutes = [1, 2, 3, 5].includes(current.everyMs / MIN)
const kind = ref<AlertKind>(current.kind)
const label = ref(current.label)
const pickedEvery = ref<number | null>(current.kind !== 'every' ? 2 : presetMinutes ? current.everyMs / MIN : null)
const customEvery = ref(current.kind === 'every' && !presetMinutes ? String(current.everyMs / MIN) : '')
const everyMs = computed(() => (customEvery.value.trim() ? parseDuration(customEvery.value) : (pickedEvery.value ?? 0) * MIN || null))

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
const pastHalfway = computed(() => {
  const t = props.alertsFor
  return !!t && elapsedMs(t, state.now) >= t.durationMs / 2
})

function pickKind(k: AlertKind) {
  if (k === 'half' && pastHalfway.value) return
  kind.value = k
  if (!pauseTouched) pause.value = k === 'half'
  if (k === 'none') applyAlerts()
  else go('details')
}

function pickEvery(min: number) {
  pickedEvery.value = min
  customEvery.value = ''
}

const detailsProblem = computed(() => {
  if (kind.value !== 'every') return ''
  if (!everyMs.value) return 'Choose how often, e.g. 2 or 1:30'
  const total = props.alertsFor?.durationMs ?? Infinity
  return everyMs.value >= total ? `Needs to be shorter than the ${formatDuration(total)} timer` : ''
})

const plan = computed<AlertPlan>(() => ({
  kind: kind.value,
  everyMs: kind.value === 'every' ? (everyMs.value ?? 0) : 0,
  label: label.value,
  pause: kind.value !== 'none' && pause.value,
}))

function applyAlerts() {
  const t = props.alertsFor
  if (!t) return
  setTimerPlan(t.id, plan.value)
  if (keepAsPreset.value) upsertPreset(t.name, t.durationMs, plan.value)
  emit('close')
}

// ---- Time ----
// What this name was timed for last time(s): usually exactly what's wanted again.
const lastTimes = computed(() => recentTimes(state.history, name.value))
const customTime = ref('')
const customMs = computed(() => parseDuration(customTime.value))
const keepAsPreset = ref(false)

const timeProblem = computed(() =>
  customTime.value.trim() && customMs.value === null ? 'Enter minutes (45 or 1.5) or m:ss (1:30)' : '',
)

function start(ms: number | null) {
  if (ms === null) return
  if (keepAsPreset.value) savePreset(name.value, ms, NO_ALERTS)
  startTimer(name.value, ms, NO_ALERTS, props.prep)
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
  startPreset(p, props.prep)
  emit('close')
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

const TITLES: Record<Step, string> = {
  name: "What's cooking?",
  time: 'How long?',
  alerts: 'Alerts along the way?',
  details: 'Alert details',
}

const subject = computed(() => {
  const t = props.alertsFor
  return t ? `${t.name || 'Timer'} · ${formatDuration(t.durationMs)}` : name.value.trim() || 'Timer'
})

function onSubmit() {
  if (step.value === 'name') {
    searching.value = false
    name.value = tidyName(name.value) // so the next screen already shows it as it will appear
    go('time')
  } else if (step.value === 'details' && !detailsProblem.value) applyAlerts()
  else if (step.value === 'time' && !timeProblem.value) start(customMs.value)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

// On phones the on-screen keyboard covers the bottom of the page without resizing
// it, which would bury most of the sheet. Track the area that's actually visible
// and fit the sheet to that instead.
//
// When what's left is short (a landscape tablet with the keyboard up leaves about
// 340px), the search switches to a compact layout: the sheet takes the whole
// visible area, edge to edge, and results flow in columns instead of one list.
const scrim = ref<HTMLElement>()
const shortView = ref(false)
const compact = computed(() => searching.value && shortView.value)

function fitToVisibleArea() {
  const vv = window.visualViewport
  shortView.value = (vv?.height ?? window.innerHeight) < 520
  if (!vv || !scrim.value) return
  scrim.value.style.setProperty('--visible-height', `${vv.height}px`)
  scrim.value.style.setProperty('--visible-top', `${vv.offsetTop}px`)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.visualViewport?.addEventListener('resize', fitToVisibleArea)
  window.visualViewport?.addEventListener('scroll', fitToVisibleArea)
  fitToVisibleArea()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.visualViewport?.removeEventListener('resize', fitToVisibleArea)
  window.visualViewport?.removeEventListener('scroll', fitToVisibleArea)
})
</script>

<template>
  <div ref="scrim" class="scrim" @click.self="emit('close')">
    <form class="sheet" :class="{ prep: prep || alertsFor?.prepped, compact }" role="dialog" aria-modal="true" aria-labelledby="sheet-title" @submit.prevent="onSubmit">
      <!-- While searching, every pixel goes to results: the header's back arrow moves into the search row -->
      <header v-show="!searching" class="head">
        <button v-if="step === 'time' || step === 'details'" type="button" class="nav" aria-label="Back" @click="back">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <span v-else class="nav" />
        <div class="progress">
          <span v-if="prep" class="badge">Prep for later</span>
          <div class="dots" aria-hidden="true">
            <span v-for="s in steps" :key="s" :class="{ on: s === step }" />
          </div>
        </div>
        <button type="button" class="nav" aria-label="Close" @click="emit('close')">✕</button>
      </header>

      <Transition :name="direction" mode="out-in">
        <div :key="step" class="body">
          <h2 v-show="!searching" id="sheet-title">{{ TITLES[step] }}</h2>
          <p v-if="step !== 'name'" class="recap"><FoodIcon :name="alertsFor ? alertsFor.name : name" />{{ subject }}</p>

          <!-- 1 · Name -->
          <template v-if="step === 'name'">
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
                <button v-for="n in NAMES" :key="n" type="button" class="chip" :aria-pressed="name === n" @click="pickName(n)">
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
                <button type="button" class="result" @click="pickName(food)">
                  <FoodIcon :icon="icon" class="result-icon" />
                  {{ food }}
                </button>
              </li>
              <li v-if="!results.length" class="no-results">Nothing in the list matches, but any name works.</li>
            </ul>
          </template>

          <!-- Bell 1 · Which kind of alert -->
          <template v-else-if="step === 'alerts'">
            <div class="options">
              <button type="button" class="option" :aria-pressed="kind === 'none'" @click="pickKind('none')">
                <strong>None</strong>
                <span>{{ current.kind === 'none' ? 'Just count down' : 'Remove the alerts and just count down' }}</span>
              </button>
              <button type="button" class="option" :aria-pressed="kind === 'half'" :disabled="pastHalfway" @click="pickKind('half')">
                <strong>Halfway</strong>
                <span>{{ pastHalfway ? "This timer is already past halfway" : 'One alert at the midpoint, like flipping a tray in the oven' }}</span>
              </button>
              <button type="button" class="option" :aria-pressed="kind === 'every'" @click="pickKind('every')">
                <strong>Every…</strong>
                <span>Repeats through the cook, like flipping every 2 minutes</span>
              </button>
            </div>
          </template>

          <!-- Bell 2 · Alert details (skipped for None) -->
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

            <button type="button" class="switch-row" role="switch" :aria-checked="keepAsPreset" @click="keepAsPreset = !keepAsPreset">
              <span>
                <strong>Save as preset</strong>
                <small>Keeps this name, time and alert for a one-tap start</small>
              </span>
              <span class="switch" aria-hidden="true" />
            </button>
          </template>

          <!-- 2 · Time: tapping a number starts (or preps) the timer -->
          <template v-else>
            <section v-if="lastTimes.length">
              <h3>Last time</h3>
              <div class="last-times">
                <button v-for="ms in lastTimes" :key="ms" type="button" class="chip last-time tabular" @click="start(ms)">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 12a8 8 0 1 0 2.6-5.9" />
                    <path d="M4 4.5v4h4" />
                  </svg>
                  {{ formatDuration(ms) }}
                </button>
              </div>
            </section>

            <section>
              <h3>Shorter</h3>
              <div class="times">
                <button v-for="m in SHORTER" :key="m" type="button" class="chip big-num" @click="start(m * MIN)">{{ m }}</button>
              </div>
            </section>

            <section>
              <h3>Longer</h3>
              <div class="times longer">
                <button v-for="m in LONGER" :key="m" type="button" class="chip big-num" @click="start(m * MIN)">{{ m }}</button>
              </div>
            </section>
            <input
              v-model="customTime"
              class="field"
              :class="{ bad: timeProblem }"
              inputmode="decimal"
              autocomplete="off"
              enterkeyhint="go"
              placeholder="Other minutes: 45, 1.5 or 1:30"
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

      <footer v-if="step === 'name' && !searching" class="foot">
        <button type="submit" class="next">{{ name.trim() ? 'Next' : 'Skip name' }}</button>
      </footer>
      <footer v-else-if="step === 'details'" class="foot">
        <p v-if="detailsProblem" class="problem" role="alert">{{ detailsProblem }}</p>
        <button type="submit" class="next" :disabled="!!detailsProblem">Set alert</button>
      </footer>
      <footer v-else-if="step === 'time' && customTime.trim()" class="foot">
        <p v-if="timeProblem" class="problem" role="alert">{{ timeProblem }}</p>
        <button type="submit" class="next tabular" :disabled="!!timeProblem">
          {{ prep ? 'Prep' : 'Start' }}{{ customMs && !timeProblem ? ` ${formatClock(customMs)}` : '' }}
        </button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  top: var(--visible-top, 0px);
  left: 0;
  right: 0;
  height: var(--visible-height, 100dvh);
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
  height: min(760px, calc(var(--visible-height, 100dvh) - env(safe-area-inset-top) - 12px));
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
    height: min(760px, calc(var(--visible-height, 100dvh) - 48px));
  }
}

/* Prep mode re-points the accent, so every highlight in the sheet turns lemon at once. */
.sheet.prep {
  --accent: var(--prep);
  --on-accent: var(--on-prep);
  --accent-text: var(--prep-text);
  border-top: 3px solid var(--prep);
}

.progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  padding: 3px 10px;
  border-radius: 10px;
  background: var(--prep);
  color: var(--on-prep);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
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
   The sheet becomes the whole visible area and results flow in columns. */
.sheet.compact {
  max-width: none;
  height: var(--visible-height, 100dvh);
  border-radius: 0;
  border-top: 0;
}

.sheet.compact .body {
  gap: 8px;
  padding-inline: max(20px, env(safe-area-inset-left)) max(20px, env(safe-area-inset-right));
}

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

.option:disabled {
  opacity: 0.4;
  cursor: default;
}

.option:not(:disabled):active {
  transform: scale(0.98);
}

.times {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.chip.big-num {
  min-height: 60px;
  padding: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

/* One tap to repeat last time: the widest, most obvious thing on the screen. */
.last-times {
  display: flex;
  gap: 8px;
}

.chip.last-time {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 60px;
  padding: 0 10px;
  background: color-mix(in srgb, var(--accent) 16%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 60%, var(--surface));
  color: var(--accent-text);
  font-size: 1.25rem;
  font-weight: 750;
  white-space: nowrap;
}

/* With two or three remembered times, the first is still "last time"; the rest step back. */
.chip.last-time:not(:first-child) {
  flex: 0 1 auto;
  padding: 0 16px;
  font-size: 1.05rem;
}

.chip.last-time:not(:first-child) svg {
  display: none;
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
  min-height: 60px;
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
  color: #fff;
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
    gap: 9px;
    padding-bottom: 12px;
  }
  h2 {
    font-size: 1.3rem;
  }
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
  .option {
    min-height: 80px;
  }
  .chip.big-num,
  .every-field {
    min-height: 60px;
  }
}

@keyframes fade-out {
  to {
    opacity: 0;
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
  .sheet,
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
  .fwd-enter-active,
  .fwd-leave-active,
  .back-enter-active,
  .back-leave-active {
    transition: none;
  }
}
</style>
