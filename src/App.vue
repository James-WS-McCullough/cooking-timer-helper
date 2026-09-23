<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AlertSheet from './components/AlertSheet.vue'
import ChainSheet from './components/ChainSheet.vue'
import MicIcon from './components/MicIcon.vue'
import NewTimerSheet from './components/NewTimerSheet.vue'
import NextStepSheet from './components/NextStepSheet.vue'
import NoteCard from './components/NoteCard.vue'
import RecipeSheet from './components/RecipeSheet.vue'
import RecipesSheet from './components/RecipesSheet.vue'
import SaveRecipeSheet from './components/SaveRecipeSheet.vue'
import SettingsSheet from './components/SettingsSheet.vue'
import SizzleLogo from './components/SizzleLogo.vue'
import SyncSheet from './components/SyncSheet.vue'
import TimerCard from './components/TimerCard.vue'
import UpdateToast from './components/UpdateToast.vue'
import VoiceBubble from './components/VoiceBubble.vue'
import VoiceButton from './components/VoiceButton.vue'
import { announcement } from './lib/announce'
import { play, soundReady } from './lib/audio'
import { dialogOpen } from './lib/dialog'
import { isNote, type Recipe, type Step, tails } from './lib/recipe'
import { theme, toggleTheme } from './lib/theme'
import { anyPausedByAll, countingTimers, displayOrder, isPending, statusOf, syncable } from './lib/timer'
import {
  arrivals,
  chainEnd,
  justFinished,
  pauseEverything,
  resumeEverything,
  runOfCard,
  type StepTarget,
  state,
} from './store'

// Which wizard is open, if any: start a timer now, or prep one for later.
const sheet = ref<'start' | 'prep' | null>(null)

// The list: timers, and the instruction cards of recipes in progress.
const cards = computed(() => [...state.timers, ...state.notes])

// "+ Next step" on a card, or a branch in a recipe's graph: where it goes, then (for a timer
// step) the wizard with `after` set.
const nextFor = ref<StepTarget | null>(null)
const after = ref<StepTarget>()
function openNext(id: string) {
  void play('beep', true)
  const card = cards.value.find((c) => c.id === id)
  if (!card) return
  // Once there's a chain to see, the button shows it (and the graph is where steps are added and changed).
  const run = runOfCard(card)
  if (run && run.recipe.steps.length >= 2) chainOpen.value = run.id
  else nextFor.value = { kind: 'card', id, name: chainEnd(card) } // the sheet says what the new step follows
}

// The chain being cooked, as a graph. Like the recipe screen, it stays beneath the step sheets.
const chainOpen = ref<string | null>(null)
const openChain = computed(() => state.runs.find((r) => r.id === chainOpen.value))
const stepName = (step: Step) => (step.kind === 'timer' ? step.name : step.text)
// What the new step will follow, for the sheet's badge: the chosen node, or the chain's end.
const followsName = (recipe: Recipe, afterIds: string[]) => {
  const chosen = afterIds.map((id) => recipe.steps.find((s) => s.id === id)).filter((s): s is Step => !!s)
  return (chosen.length ? chosen : tails(recipe)).map(stepName).join(' and ')
}
function addToChain(afterIds: string[]) {
  const run = openChain.value
  if (run) nextFor.value = { kind: 'run', id: run.id, after: afterIds, name: followsName(run.recipe, afterIds) }
}

// Changing a step: an instruction goes straight to its words, a timer to the wizard at "How long?".
const editText = ref<string>()
function editStep(scope: 'recipe' | 'run', id: string, step: Step) {
  const target: StepTarget = { kind: 'edit', in: scope, id, stepId: step.id, name: stepName(step) }
  if (step.kind === 'note') {
    editText.value = step.text
    nextFor.value = target
  } else {
    after.value = target
    heardName.value = step.name
    sheet.value = 'start'
  }
}

// The recipes list, and a recipe's own screen (which stays open behind the step sheets while a branch is added).
const recipesOpen = ref(false)
function openRecipes() {
  void play('beep', true)
  settingsOpen.value = false
  recipesOpen.value = true
}
const recipeOpen = ref<string | null>(null)
const openRecipe = computed(() => state.recipes.find((r) => r.id === recipeOpen.value))
function branchRecipe(afterIds: string[]) {
  const recipe = openRecipe.value
  if (!recipe) return
  nextFor.value = { kind: 'recipe', id: recipe.id, after: afterIds, name: followsName(recipe, afterIds) }
}
function nextIsTimer() {
  after.value = nextFor.value ?? undefined
  nextFor.value = null
  heardName.value = undefined
  sheet.value = 'start'
}
function closeNext() {
  nextFor.value = null
  editText.value = undefined
}

// The mic: say a timer instead of tapping it in. If it hears a name but no time, the
// wizard opens at "How long?" with that name. Loaded on demand, like everything about it.
const ListenSheet = defineAsyncComponent(() => import('./components/ListenSheet.vue'))
const micOpen = ref(false)
const heardName = ref<string>()

function openMic() {
  void play('beep', true)
  micOpen.value = true
}

function askHowLong(name: string, prep: boolean) {
  micOpen.value = false
  heardName.value = name
  sheet.value = prep ? 'prep' : 'start'
}

// Rarely opened, and it brings a QR encoder with it: load it on demand.
const QrSheet = defineAsyncComponent(() => import('./components/QrSheet.vue'))
const qrOpen = ref(false)

// While timers run, the start screen's loose buttons (voice, theme, QR) live behind a gear instead.
const settingsOpen = ref(false)

// The beep doubles as the tap that lets the browser sound the alarm later.
// Prepping a meal: timers are set up and nothing has been started yet. The dock's
// big button always means "carry on with what I'm doing", so here it preps another
// and starting a live timer becomes the small, deliberate option. It stays
// available (kettle, par-boil…); it just shouldn't be what a thumb lands on.
const prepping = computed(
  () => state.timers.length > 0 && !state.notes.length && state.timers.every((t) => statusOf(t) === 'prepped'),
)

// Sync Finish is only worth offering once there's more than one dish to line up.
const canSync = computed(() => syncable(state.timers).length >= 2)
const syncOpen = ref(false)

function openSync() {
  void play('beep', true)
  syncOpen.value = true
}

// Pause all / Resume all: the blunt, legible answer to "the kitchen's fallen behind".
// Worth offering once there's more than one thing counting; once used, it stays
// until everything it stopped has been resumed.
const pausedAll = computed(() => anyPausedByAll(state.timers))
const showPauseAll = computed(() => pausedAll.value || countingTimers(state.timers) >= 2)

// The bell on a card: edit that timer's mid-way alerts. Held by id, so the sheet
// simply goes away if the timer finishes or is removed while it's open.
const alertsForId = ref<string | null>(null)
const alertsFor = computed(() => {
  const t = state.timers.find((x) => x.id === alertsForId.value)
  return t && !isPending(t) ? t : undefined
})

// Forget the id once the sheet has gone, or it would pop back up by itself later
// (say, after the flip that interrupted it is confirmed).
watch(alertsFor, (t) => {
  if (!t) alertsForId.value = null
})

function openAlerts(id: string) {
  void play('beep', true)
  alertsForId.value = id
}

function openSheet(mode: 'start' | 'prep' = 'start') {
  void play('beep', true)
  heardName.value = undefined
  after.value = undefined
  sheet.value = mode
}

// Cards are sorted by what needs you first, then soonest to finish, but never
// while you're using them: each touch on the list postpones re-sorting until the
// list has been left alone for a few seconds, so a card can't slide out from
// under a finger tapping +30s. Then everything glides to its new place.
const REORDER_AFTER_IDLE_MS = 3000
let idleAt = 0
const shownOrder = ref<string[]>([])

function holdOrder() {
  idleAt = Date.now() + REORDER_AFTER_IDLE_MS
}

watch(
  () => state.now,
  (now) => {
    if (now < idleAt) return
    const next = displayOrder(cards.value, now).map((c) => c.id)
    if (next.join() !== shownOrder.value.join()) shownOrder.value = next
  },
  { immediate: true },
)

// Timers added while the order is held simply join the end until the next re-sort.
const ordered = computed(() => {
  const place = new Map(shownOrder.value.map((id, i) => [id, i]))
  return [...cards.value].sort((a, b) => (place.get(a.id) ?? Infinity) - (place.get(b.id) ?? Infinity))
})

// A recipe's next step takes the place of the step just done: the card becomes the next
// one, rather than the next one turning up at the bottom.
watch(
  () => arrivals.value.length,
  (n) => {
    if (!n) return
    const order = [...shownOrder.value]
    for (const { id, inPlaceOf } of arrivals.value.splice(0)) {
      const at = order.indexOf(inPlaceOf)
      order.splice(at < 0 ? order.length : at + 1, 0, id)
    }
    shownOrder.value = order
    holdOrder()
  },
)

// A card that's leaving is lifted out of the grid (so its neighbours can glide
// up), which would normally make it jump to the grid's corner. Pin it where it was.
//
// The "is-clearing" class (which makes the neighbours wait a beat) is set on the
// DOM directly: going through reactive state would re-render the list, and a
// re-render makes TransitionGroup finish any glide in progress on the spot.
const grid = ref<{ $el: HTMLElement }>()
let clearing = 0
function pinInPlace(el: Element) {
  const card = el as HTMLElement
  card.style.top = `${card.offsetTop}px`
  card.style.left = `${card.offsetLeft}px`
  card.style.width = `${card.offsetWidth}px`
  clearing++
  grid.value?.$el.classList.add('is-clearing')
}

function afterLeave() {
  if (--clearing <= 0) {
    clearing = 0
    grid.value?.$el.classList.remove('is-clearing')
  }
}

// After a reload the browser won't play anything until the first tap.
const needsSoundTap = computed(() => !soundReady.value && cards.value.length > 0)

function onKey(e: KeyboardEvent) {
  const typing = e.target instanceof HTMLInputElement
  if ((e.key === 'n' || e.key === 'p') && !typing && !dialogOpen() && !e.metaKey && !e.ctrlKey) {
    e.preventDefault()
    openSheet(e.key === 'p' ? 'prep' : 'start')
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  // The food icons are half the app's code and the start screen has no use for them, so they're
  // their own chunk (FoodIcon.vue). Fetch it once the screen is up, before the first tap needs it.
  const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 300))
  idle(() => void import('./components/foodIconSet'))
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app">
    <!-- For screen readers: what just happened (a dish is ready, a flip is due, sound came on). -->
    <div class="sr-only" role="status" aria-live="polite">{{ announcement.urgent ? '' : announcement.text }}</div>
    <div class="sr-only" role="alert">{{ announcement.urgent ? announcement.text : '' }}</div>
    <UpdateToast />
    <VoiceBubble v-if="cards.length" />

    <!-- A slim strip above the list, scrolling with it: a gear pinned to the corner would end up
         sitting on whichever card's bell and ✕ scrolled underneath it. Sizzle's speech bubble
         drops into this strip too, instead of over the first card. -->
    <div v-if="cards.length" class="topbar">
      <h1 class="sr-only">Sizzle timers</h1>
      <button class="gear" aria-label="Settings" @click="settingsOpen = true">
        <!-- Sliders, not a cog: at this size a cog reads as the theme toggle's sun. -->
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
        >
          <path d="M4 6.5h4M13 6.5h7M4 12h10M19 12h1M4 17.5h2M11 17.5h9" />
          <circle cx="10.5" cy="6.5" r="2.3" />
          <circle cx="16.5" cy="12" r="2.3" />
          <circle cx="8.5" cy="17.5" r="2.3" />
        </svg>
      </button>
    </div>
    <Transition name="banner">
      <button v-if="needsSoundTap" class="banner" @click="play('beep', true)">
        <strong>Tap to turn sound on</strong>
        <span>Your timers are still running, but the alarm is silent until you tap.</span>
      </button>
    </Transition>

    <main :class="{ 'has-timers': cards.length > 0, 'with-sync': canSync }">
      <TransitionGroup
        ref="grid"
        name="cards"
        tag="div"
        class="grid"
        @pointerdown="holdOrder"
        @before-leave="pinInPlace"
        @after-leave="afterLeave"
      >
        <template v-for="c in ordered" :key="c.id">
          <NoteCard v-if="isNote(c)" :note="c" @next="openNext(c.id)" />
          <TimerCard v-else :timer="c" :now="state.now" :pulse="state.pulse" @alerts="openAlerts(c.id)" @next="openNext(c.id)" />
        </template>
      </TransitionGroup>

      <!-- Nothing cooking: the way in is the whole screen -->
      <Transition name="welcome">
        <div v-if="!cards.length" class="welcome">
          <SizzleLogo class="logo" />
          <h1>Sizzle</h1>
          <div class="start-row">
            <button class="new" @click="openSheet('start')">
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
              </svg>
              New timer
            </button>
            <button class="mic" aria-label="Say a timer" @click="openMic"><MicIcon /></button>
          </div>
          <button class="prep" @click="openSheet('prep')">Prep a timer</button>
          <p class="prep-note">Set timers up now, start each one when it's time.</p>
          <button class="recipes" @click="openRecipes">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
              <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20M9 7.5h7M9 11h5" />
            </svg>
            Recipes
          </button>
        </div>
      </Transition>
    </main>

    <Transition name="sync">
      <button
        v-if="showPauseAll"
        class="pause-all"
        :class="{ resume: pausedAll, 'above-sync': canSync }"
        @click="pausedAll ? resumeEverything() : pauseEverything()"
      >
        <svg v-if="pausedAll" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" fill="currentColor" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
          <rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
        </svg>
        {{ pausedAll ? 'Resume all' : 'Pause all' }}
      </button>
    </Transition>

    <Transition name="dock">
      <div v-if="cards.length" class="dock">
        <Transition name="sync">
          <button v-if="canSync" class="sync" @click="openSync">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 6h9M4 12h13M4 18h5" />
              <path d="M20 4v16" />
            </svg>
            Sync Finish
          </button>
        </Transition>
        <button class="new" :class="{ 'as-prep': prepping }" @click="openSheet(prepping ? 'prep' : 'start')">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          {{ prepping ? 'Prep another' : 'New timer' }}
        </button>
        <button v-if="prepping" class="prep as-new" aria-label="Quick timer that starts now" @click="openSheet('start')">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" />
          </svg>
          Quick
        </button>
        <button v-else class="prep" aria-label="Prep a timer" @click="openSheet('prep')">Prep</button>
        <button class="mic" aria-label="Say a timer" @click="openMic"><MicIcon /></button>
      </div>
    </Transition>

    <!-- Outside the start screen's own transition: a transformed parent would drag a fixed child around. -->
    <Transition name="welcome">
      <VoiceButton v-if="!cards.length" />
    </Transition>
    <Transition name="welcome">
      <button
        v-if="!cards.length"
        class="corner-button theme-button"
        :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      >
        <!-- Shows where a tap takes you: the sun while it's dark, the moon while it's light -->
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      </button>
    </Transition>
    <Transition name="welcome">
      <button v-if="!cards.length" class="corner-button qr-button" aria-label="Show a QR code to open Sizzle on another device" @click="qrOpen = true">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
          <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
          <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
          <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
          <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" stroke-linecap="round" />
        </svg>
      </button>
    </Transition>

    <SyncSheet v-if="syncOpen && canSync" @close="syncOpen = false" />
    <ListenSheet v-else-if="micOpen" @close="micOpen = false" @time="askHowLong" />
    <NextStepSheet v-else-if="nextFor" :target="nextFor" :initial="editText" @close="closeNext" @timer="nextIsTimer" />
    <NewTimerSheet
      v-else-if="sheet"
      :prep="sheet === 'prep'"
      :heard="heardName"
      :after="after"
      @close="sheet = null"
      @recipe="((sheet = null), (recipeOpen = $event.id))"
    />

    <AlertSheet v-else-if="alertsFor" :key="alertsFor.id" :timer="alertsFor" @close="alertsForId = null" />
    <SettingsSheet v-if="settingsOpen" @close="settingsOpen = false" @qr="((settingsOpen = false), (qrOpen = true))" @recipes="openRecipes" />
    <QrSheet v-if="qrOpen" @close="qrOpen = false" />
    <SaveRecipeSheet v-if="justFinished" :run="justFinished" @close="justFinished = null" />
    <RecipesSheet v-if="recipesOpen" @close="recipesOpen = false" @open="recipeOpen = $event.id" />
    <!-- Sits beneath the step sheets (its own z-index), so adding a branch doesn't lose the servings chosen. -->
    <RecipeSheet
      v-if="openRecipe"
      :recipe="openRecipe"
      @close="recipeOpen = null"
      @prepped="((recipeOpen = null), (recipesOpen = false))"
      @branch="branchRecipe"
      @edit="editStep('recipe', openRecipe.id, $event)"
    />
    <ChainSheet v-if="openChain" :run="openChain" @close="chainOpen = null" @add="addToChain" @edit="editStep('run', openChain.id, $event)" />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: 1200px;
  margin: 0 auto;
  padding: calc(14px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left));
}

.topbar {
  display: flex;
  justify-content: flex-end;
  height: 40px;
  margin: -8px -4px 6px 0;
}

.gear {
  display: grid;
  place-items: center;
  width: 44px;
  height: 40px;
  border-radius: 12px;
  color: var(--text-dim);
}

.gear:active {
  transform: scale(0.92);
}

.banner {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  margin-bottom: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: var(--danger);
  color: var(--on-danger);
  text-align: left;
}

.banner span {
  font-size: 0.9rem;
  opacity: 0.9;
}

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* Leave room for the docked button. */
  padding-bottom: calc(110px + env(safe-area-inset-bottom));
}

main.has-timers {
  padding-bottom: calc(170px + env(safe-area-inset-bottom)); /* dock, plus the Pause all button above it */
}

main.with-sync {
  padding-bottom: calc(240px + env(safe-area-inset-bottom));
}

.grid {
  position: relative; /* anchor for cards pinned in place while they leave */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  gap: 12px;
  align-items: start;
}

.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.logo {
  width: 120px;
  height: 120px;
}

h1 {
  margin: 0 0 28px;
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.start-row {
  display: flex;
  gap: 10px;
  width: 100%;
  max-width: 394px; /* New timer at its 320, plus the mic */
}

.welcome .new {
  max-width: 320px;
}

/* A third way to start a timer: round, and quieter than New timer. */
.mic {
  flex: none;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--accent) 70%, var(--bg));
  background: color-mix(in srgb, var(--accent) 12%, var(--bg));
  color: var(--accent-text);
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
  pointer-events: auto;
}

.mic:active {
  transform: scale(0.94);
}

/* Secondary everywhere it appears: outlined in the prep colour, never filled. */
.prep {
  min-height: 52px;
  padding: 0 26px;
  border-radius: 26px;
  border: 2px dashed var(--prep-line);
  background: color-mix(in srgb, var(--prep) 10%, var(--bg));
  color: var(--prep-text);
  font-size: 1.05rem;
  font-weight: 750;
}

.prep:active {
  transform: scale(0.97);
}

.welcome .prep {
  margin-top: 12px;
}

.prep-note {
  max-width: 260px;
  margin: 6px 0 0;
  font-size: 0.85rem;
  text-align: center;
  color: var(--text-dim);
}

/* Recipes: chains of steps, kept. Quieter than the two ways to start a timer. */
.recipes {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  margin-top: 22px;
  padding: 0 18px;
  border-radius: 24px;
  color: var(--text-dim);
  font-weight: 700;
}

.recipes:active {
  transform: scale(0.97);
}

/* Tucked in the corner of the start screen: light/dark, and hand the app to another device. */
.corner-button {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: calc(16px + env(safe-area-inset-bottom));
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-dim);
}

.corner-button:active {
  transform: scale(0.94);
}

.theme-button {
  right: calc(max(16px, env(safe-area-inset-right)) + 56px + 10px);
}

.dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap; /* Sync Finish takes the row above New timer and Prep */
  justify-content: center;
  align-items: center;
  gap: 10px;
  padding: 24px 16px calc(16px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, var(--bg) 55%, transparent);
  pointer-events: none;
}

.new {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  max-width: 420px;
  min-height: 64px;
  border-radius: 32px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.3rem;
  font-weight: 800;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
  pointer-events: auto;
}

.dock .new {
  flex: 1;
}

/* Phones: keep the dock's labels on one line beside the mic ("Prep another" is the long one). */
@media (max-width: 400px) {
  .dock {
    gap: 8px;
    padding-left: 12px;
    padding-right: 12px;
  }
  .dock .new {
    gap: 6px;
    font-size: 1.1rem;
    white-space: nowrap;
  }
  .dock .new svg {
    width: 22px;
    height: 22px;
  }
  .dock .prep {
    padding: 0 16px;
  }
  .dock .prep.as-new {
    padding: 0 16px 0 12px;
  }
}

/* Very narrow phones */
@media (max-width: 350px) {
  .dock .new {
    font-size: 1rem;
  }
  .dock .new.as-prep svg {
    display: none; /* "Prep another" needs the room more than its plus */
  }
  .dock .prep,
  .dock .prep.as-new {
    padding: 0 12px;
  }
  .dock .mic {
    width: 56px;
    height: 56px;
  }
}

/* Floats at the bottom right, just above the dock. */
.pause-all {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: calc(108px + env(safe-area-inset-bottom));
  z-index: 11;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 18px 0 14px;
  border-radius: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-weight: 750;
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.35);
}

.pause-all.above-sync {
  bottom: calc(176px + env(safe-area-inset-bottom));
}

.pause-all.resume {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}

.pause-all:active {
  transform: scale(0.95);
}

/* Prepping: the two dock buttons trade looks as well as jobs. */
.new.as-prep {
  background: var(--prep);
  color: var(--on-prep);
}

.prep.as-new {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 22px 0 18px;
  border: 2px solid color-mix(in srgb, var(--accent) 70%, var(--bg));
  background: color-mix(in srgb, var(--accent) 12%, var(--bg));
  color: var(--accent-text);
}

.sync {
  flex: 0 0 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  max-width: 516px;
  min-height: 58px;
  border-radius: 29px;
  background: var(--sync);
  color: var(--on-sync);
  font-size: 1.2rem;
  font-weight: 800;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
  pointer-events: auto;
}

.sync:active {
  transform: scale(0.97);
}

.sync-enter-active,
.sync-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.3, 1.3, 0.5, 1),
    opacity 0.2s ease;
}

.sync-enter-from,
.sync-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}

.dock .prep {
  flex: none;
  min-height: 64px;
  border-radius: 32px;
  pointer-events: auto;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
}

.new:active {
  transform: scale(0.97);
}

.cards-move {
  transition: transform 0.55s cubic-bezier(0.3, 0.9, 0.3, 1);
}

/* Let a clearing card have its moment before the others close the gap. */
.is-clearing .cards-move {
  transition-delay: 0.42s;
}

.cards-enter-active {
  transition:
    transform 0.3s ease,
    opacity 0.2s ease;
}

.cards-enter-from {
  opacity: 0;
  transform: scale(0.94);
}

/* The leave animation itself belongs to the card (TimerCard.vue). */
.cards-leave-active {
  position: absolute;
  pointer-events: none;
}

/* Any tap turns sound on, including a tap aimed at a card. If the banner vanished
   on touch-down the page would jump before touch-up and that tap would miss, so
   it stays put while it fades and only then folds away. */
.banner-leave-active {
  overflow: hidden;
  max-height: 140px;
  transition:
    opacity 0.25s ease 0.15s,
    max-height 0.35s ease 0.45s,
    margin 0.35s ease 0.45s,
    padding 0.35s ease 0.45s;
}

.banner-leave-to {
  opacity: 0;
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* The start screen waits for the last card to finish leaving. */
.welcome-enter-active {
  transition:
    opacity 0.35s ease 0.6s,
    transform 0.45s cubic-bezier(0.3, 1.3, 0.5, 1) 0.6s;
}

.welcome-enter-from {
  opacity: 0;
  transform: scale(0.92);
}

.welcome-leave-active {
  display: none;
}

.dock-enter-active,
.dock-leave-active {
  transition:
    transform 0.35s cubic-bezier(0.3, 0.9, 0.3, 1),
    opacity 0.25s ease;
}

.dock-enter-from,
.dock-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .cards-move,
  .cards-enter-active,
  .welcome-enter-active,
  .dock-enter-active,
  .dock-leave-active,
  .sync-enter-active,
  .sync-leave-active {
    transition: none;
  }
}
</style>
