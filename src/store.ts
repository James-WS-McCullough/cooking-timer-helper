import { reactive, ref, watch } from 'vue'
import { announce } from './lib/announce'
import { installAudio, play, setAlarmMode, soundReady } from './lib/audio'
import { formatDuration, tidyName } from './lib/format'
import { rememberTime } from './lib/history'
import { type Ingredient, plainText } from './lib/ingredients'
import {
  addStepAfter,
  appendStep,
  completeStep,
  isNote,
  type Note,
  noteStep,
  type Recipe,
  type Run,
  removeStep,
  runFinished,
  runRecipe,
  type Step,
  type StepRef,
  saveAs,
  startRun,
  stepById,
  tails,
  timerStep,
} from './lib/recipe'
import { type Preset, parseSaved, STORAGE_KEY, serialise } from './lib/storage'
import {
  type AlertPlan,
  acknowledge,
  addTime,
  advance,
  createTimer,
  isPending,
  msUntilNeeded,
  pause,
  pauseAll,
  resume,
  resumeAll,
  setPlan,
  statusOf,
  syncFinish,
  type Timer,
  type TimerEvent,
  uid,
} from './lib/timer'
import { rehearse, say } from './lib/voice'
import {
  alertPhrase,
  duePhrase,
  finishedPhrase,
  nextUpPhrase,
  startedPhrase,
  syncedPhrase,
  waitingPhrase,
} from './lib/voice/phrases'
import { installWakeLock, setWakeLock } from './lib/wakeLock'

export type { Note, Recipe, Step } from './lib/recipe'
export type { Preset } from './lib/storage'

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null // private mode, or storage blocked
  }
}

const saved = parseSaved(readStorage())

export const state = reactive({
  timers: saved.timers,
  notes: saved.notes, // instruction steps on screen
  runs: saved.runs, // recipes (or chains built as they're cooked) in progress
  recipes: saved.recipes,
  presets: saved.presets,
  history: saved.history,
  now: Date.now(),
  // Bumped each time the attention sound plays, so pending cards can shimmer along with it.
  pulse: 0,
})

// One shared reminder for everything waiting on the cook, however many cards that is.
const NOTIFY_EVERY_MS = 15_000
const ALARM_LEAD_MS = 5000
let nextNotifyAt = 0

// The robot speaks after the sound effect that announces the same thing, not over it,
// and repeats herself far less often than the chime does.
const SPEAK_AFTER_SFX_MS = 1900
const SPOKEN_REMINDER_EVERY = 4 // reminders, i.e. once a minute
let remindersSinceSpoken = 0

// She picks her lines at random, so a timer's big lines are chosen when it's created:
// that way they can be synthesised in advance and are instant when the moment comes.
type Moment = 'finished' | 'due'
const chosen = new Map<string, Partial<Record<Moment, string>>>()

function lineFor(t: Timer, moment: Moment): string {
  const lines = chosen.get(t.id) ?? {}
  lines[moment] ??= moment === 'finished' ? finishedPhrase(t) : duePhrase(t)
  chosen.set(t.id, lines)
  return lines[moment]
}

/** The timer's name as said to assistive tech: the card's own title. */
const titleOf = (t: Timer) => t.name || `${formatDuration(t.durationMs)} timer`

function tell(t: Timer, event: TimerEvent): void {
  if (event === 'finished') announce(`${titleOf(t)} is ready`, true)
  else if (event === 'due') announce(`Start ${titleOf(t)} now`, true)
  else announce(`${t.alerts.find((a) => a.state === 'firing')?.label ?? t.plan.label} ${titleOf(t)}`, true)
}

function announceByVoice(t: Timer, event: TimerEvent): void {
  if (event === 'alert') {
    say(alertPhrase(t, t.alerts.find((a) => a.state === 'firing')?.label ?? t.plan.label), SPEAK_AFTER_SFX_MS, 'urgent')
    return
  }
  say(lineFor(t, event), SPEAK_AFTER_SFX_MS, 'urgent')
  delete chosen.get(t.id)?.[event] // said; if it comes round again (+30s), she'll say something new
}

/**
 * Advance the world. The cards show whole seconds, so that's how often they're told the
 * time: the 250ms interval still catches alerts promptly, but eight cards re-laying out
 * four times a second was most of the app's idle cost. An action that has just changed a
 * timer passes `publish`, so its card reads the time the change was made against.
 */
function tick(publish = false): void {
  const now = Date.now()
  if (publish || Math.floor(now / 1000) !== Math.floor(state.now / 1000)) state.now = now

  let arrived: TimerEvent | null = null
  for (const t of state.timers) {
    const event = advance(t, now)
    if (event) {
      tell(t, event)
      announceByVoice(t, event)
    }
    if (event === 'finished' || (event && !arrived)) arrived = event
  }

  // A finish announces itself once; a new flip, a dish due to go on, and every reminder after use Notify.
  const remind = !arrived && now >= nextNotifyAt && state.timers.some(isPending)
  if (arrived || remind) {
    void play(arrived === 'finished' ? 'complete' : 'notify')
    nextNotifyAt = now + NOTIFY_EVERY_MS
    state.pulse++
    if (arrived) remindersSinceSpoken = 0
    else if (++remindersSinceSpoken >= SPOKEN_REMINDER_EVERY) {
      remindersSinceSpoken = 0
      const pending = state.timers.filter(isPending)
      announce(`Still waiting: ${pending.map(titleOf).join(', ')}`)
      say(waitingPhrase(pending.map((t) => t.name)), SPEAK_AFTER_SFX_MS)
    }
  }

  // Anything counting down or waiting on the cook keeps the screen awake.
  setWakeLock(state.timers.some((t) => !['paused', 'prepped'].includes(statusOf(t))))
  // A few seconds before anything is due, and for as long as anything waits, the alarm must
  // be able to get through the phone's silent switch (audio.ts).
  setAlarmMode(msUntilNeeded(state.timers, now) <= ALARM_LEAD_MS)
}

/** Add a timer. Prepped ones just wait in the list until their play button is pressed. */
export function startTimer(name: string, durationMs: number, plan: AlertPlan, prepped = false): void {
  const timer = createTimer(tidyName(name), durationMs, plan, Date.now(), prepped)
  state.timers.push(timer)
  rehearse(lineFor(timer, 'finished'))
  if (!prepped) say(startedPhrase(timer), SPEAK_AFTER_SFX_MS)
  rememberTime(state.history, name, durationMs)
  announce(`${titleOf(timer)}, ${formatDuration(durationMs)}, ${prepped ? 'prepped' : 'started'}`)
  void play(prepped ? 'beep' : 'start', true)
  tick(true)
}

export function startPreset(preset: Preset, prepped = false): void {
  startTimer(preset.name, preset.durationMs, preset.plan, prepped)
}

export function pauseEverything(): void {
  pauseAll(state.timers, Date.now())
  announce('All timers paused')
  void play('beep', true)
  tick(true)
}

export function resumeEverything(): void {
  resumeAll(state.timers, Date.now())
  announce('All timers resumed')
  void play('start', true)
  tick(true)
}

/** Sync Finish: longest prepped timer starts now, the rest get pre-timers so everything lands together. */
export function syncAndStart(): void {
  syncFinish(state.timers, Date.now())
  for (const t of state.timers) if (t.startAt != null) rehearse(lineFor(t, 'due'))
  say(
    syncedPhrase(Math.max(0, ...state.timers.filter((t) => !t.prepped || t.startAt != null).map((t) => t.durationMs))),
    SPEAK_AFTER_SFX_MS,
  )
  void play('start', true)
  tick(true)
}

export function savePreset(name: string, durationMs: number, plan: AlertPlan): void {
  state.presets.push({ id: uid(), name: tidyName(name), durationMs, plan: { ...plan } })
}

/** Save, or update the preset with the same name and time (e.g. after adding alerts from the bell). */
export function upsertPreset(name: string, durationMs: number, plan: AlertPlan): void {
  const key = tidyName(name).toLowerCase()
  const existing = state.presets.find((p) => p.name.toLowerCase() === key && p.durationMs === durationMs)
  if (existing) existing.plan = { ...plan }
  else savePreset(name, durationMs, plan)
}

export function removePreset(id: string): void {
  state.presets = state.presets.filter((p) => p.id !== id)
}

export function removeTimer(id: string): void {
  chosen.delete(id)
  state.timers = state.timers.filter((t) => t.id !== id)
  tick(true)
}

/** ✕ on a card that is a step: the whole chain goes, cards and all. */
export function removeRun(runId: string): void {
  state.runs = state.runs.filter((r) => r.id !== runId)
  state.timers = state.timers.filter((t) => t.step?.runId !== runId)
  state.notes = state.notes.filter((n) => n.step.runId !== runId)
  tick(true)
}

function withTimer(id: string, fn: (t: Timer, now: number) => void): void {
  const t = state.timers.find((x) => x.id === id)
  if (!t) return
  fn(t, Date.now())
  tick(true)
}

/** "Done" on a flip: back to cooking. If the alert was holding the clock, it starts counting again. */
export const acknowledgeTimer = (id: string) =>
  withTimer(id, (t, now) => {
    acknowledge(t, now)
    void play('start', true)
  })

/** "Done" on a finished timer. Same confirming sound as any other Done, then the card goes (and the next step comes, if there is one). */
export function completeTimer(id: string): void {
  void play('start', true)
  const step = state.timers.find((t) => t.id === id)?.step
  removeTimer(id)
  if (step) stepDone(step, id)
}

// ---- Recipes: chains of steps ----

const runById = (id: string) => state.runs.find((r) => r.id === id)
const recipeById = (id: string) => state.recipes.find((r) => r.id === id)

/** Cards just brought up by a step's Done, and the card each replaces, so the list can put them in its place. */
export const arrivals = ref<{ id: string; inPlaceOf: string }[]>([])

/** Put a step on screen: a timer step as a prepped timer (Start when ready), an instruction as a note. */
function bringUp(run: Run, step: Step, now: number, inPlaceOf: string): void {
  const ref: StepRef = { runId: run.id, stepId: step.id }
  if (step.kind === 'timer') {
    const timer = createTimer(step.name, step.durationMs, step.plan, now, true)
    timer.step = ref
    state.timers.push(timer)
    rehearse(lineFor(timer, 'finished'))
    arrivals.value.push({ id: timer.id, inPlaceOf })
    announce(`Next: ${titleOf(timer)}, ${formatDuration(step.durationMs)}. Start it when ready`)
    say(nextUpPhrase(timer), SPEAK_AFTER_SFX_MS)
  } else {
    const note: Note = { id: uid(), text: step.text, createdAt: now, step: ref }
    state.notes.push(note)
    arrivals.value.push({ id: note.id, inPlaceOf })
    const spoken = plainText(step.text, run.recipe.ingredients ?? [], run.recipe.serves ?? null, run.serves ?? null)
    announce(spoken)
    say(spoken, SPEAK_AFTER_SFX_MS, 'urgent')
  }
}

/** A step's card has had its Done: the run moves on. A run whose every step is done is over. */
function stepDone(ref: StepRef, cardId: string): void {
  const run = runById(ref.runId)
  if (!run) return
  const now = Date.now()
  const next = completeStep(run, ref.stepId)
  // Branches that come up together are all simply ready: the cook starts each when it suits
  // (the engine's forkDelays could line them up to finish together; the owner preferred not).
  for (const step of next) bringUp(run, step, now, cardId)
  if (runFinished(run)) {
    state.runs = state.runs.filter((r) => r !== run)
    if (!run.recipe.name && run.recipe.steps.length > 1) justFinished.value = run
  }
  tick(true)
}

/** A chain that has just been cooked end to end and has no name yet: the app offers to save it. */
export const justFinished = ref<Run | null>(null)

/** Done on an instruction card. */
export function doneNote(id: string): void {
  const note = state.notes.find((n) => n.id === id)
  if (!note) return
  void play('start', true)
  state.notes = state.notes.filter((n) => n !== note)
  stepDone(note.step, id)
}

/** The run a card belongs to, starting one around a lone timer if it isn't in one yet. */
function runFor(card: Timer | Note): Run {
  if (card.step) {
    const run = runById(card.step.runId)
    if (run) return run
  }
  const timer = card as Timer
  const first = timerStep(timer.name, timer.durationMs, timer.plan)
  const run = startRun(first)
  timer.step = { runId: run.id, stepId: first.id }
  if (statusOf(timer) === 'finished') completeStep(run, first.id) // its Done is still to come; nothing follows yet
  state.runs.push(run)
  return run
}

/** Where a new step goes: on the end of a card's chain, or after given steps of a saved recipe (a branch). */
export type StepTarget =
  | { kind: 'card'; id: string; name: string }
  | { kind: 'recipe'; id: string; after: string[]; name: string }
  | { kind: 'run'; id: string; after: string[]; name: string }
  /** Not a new step: change this one (an upcoming step of a run, or any step of a saved recipe). */
  | { kind: 'edit'; in: 'recipe' | 'run'; id: string; stepId: string; name: string }
export type NewStep =
  | { kind: 'note'; text: string }
  | { kind: 'timer'; name: string; durationMs: number; plan: AlertPlan }

const makeStep = (step: NewStep) =>
  step.kind === 'note' ? noteStep(step.text.trim()) : timerStep(tidyName(step.name), step.durationMs, step.plan)

/** The recipe a target points at: a saved one, or the one a run is cooking. */
function recipeOf(target: { in?: 'recipe' | 'run'; kind?: string; id: string }): Recipe | undefined {
  const scope = target.in ?? target.kind
  return scope === 'run' ? runById(target.id)?.recipe : recipeById(target.id)
}

/** "+ Next step" on a card, a branch in a graph, or a change to a step. */
export function addStep(target: StepTarget, step: NewStep): void {
  if (target.kind === 'edit') {
    const recipe = recipeOf(target)
    const at = recipe?.steps.findIndex((s) => s.id === target.stepId) ?? -1
    const old = recipe?.steps[at]
    if (!recipe || !old) return
    const made = makeStep(step)
    recipe.steps[at] = { ...made, id: old.id, after: old.after }
    if (made.kind === 'note') addStepAfter(recipe, { ...made, id: 'scratch' }, []) // registers any new [ingredients]…
    recipe.steps = recipe.steps.filter((s) => s.id !== 'scratch') // …without keeping the scratch copy
  } else {
    const made = makeStep(step)
    if (target.kind === 'card') {
      const card = state.timers.find((t) => t.id === target.id) ?? state.notes.find((n) => n.id === target.id)
      if (!card) return
      appendStep(runFor(card).recipe, made)
    } else {
      const recipe = recipeOf(target)
      if (!recipe) return
      if (target.after.length) addStepAfter(recipe, made, target.after)
      else appendStep(recipe, made)
    }
  }
  if (step.kind === 'timer') rememberTime(state.history, step.name, step.durationMs)
  void play('beep', true)
  tick(true)
}

/** The ingredients a step being written can name: those of the recipe the target points into. */
export function ingredientsFor(target: StepTarget): Ingredient[] {
  if (target.kind === 'card') {
    const card = state.timers.find((t) => t.id === target.id) ?? state.notes.find((n) => n.id === target.id)
    return (card && runOfCard(card)?.recipe.ingredients) ?? []
  }
  return recipeOf(target)?.ingredients ?? []
}

/** Take a step out of a saved recipe, or an upcoming step out of a run. */
export function removeStepFrom(scope: 'recipe' | 'run', id: string, stepId: string): void {
  const recipe = recipeOf({ in: scope, id })
  if (!recipe) return
  const run = scope === 'run' ? runById(id) : undefined
  if (run && (run.done.includes(stepId) || run.active.includes(stepId))) return // on screen or behind us: leave it
  removeStep(recipe, stepId)
}

/** The run a card is cooking in, if any. */
export function runOfCard(card: Timer | Note): Run | undefined {
  return card.step ? runById(card.step.runId) : undefined
}

/** How many steps follow this card in its chain (0 when it isn't in one, or is the last). */
export function stepsAfter(card: Timer | Note): number {
  if (!card.step) return 0
  const run = runById(card.step.runId)
  if (!run) return 0
  const at = run.recipe.steps.findIndex((s) => s.id === card.step?.stepId)
  return at < 0 ? 0 : run.recipe.steps.length - 1 - at
}

/** What a new step would come after: the last step of the card's chain (the card itself if nothing follows yet). */
export function chainEnd(card: Timer | Note): string {
  const own = isNote(card) ? card.text : card.name || 'the timer'
  if (!card.step) return own
  const run = runById(card.step.runId)
  const last = run && tails(run.recipe)[0]
  if (!last) return own
  return last.kind === 'note' ? last.text : last.name || 'the timer'
}

/** The recipe a card is a step of, and where in it: for the card's context line. */
export function stepContext(card: Timer | Note): { run: Run; step: Step } | undefined {
  if (!card.step) return undefined
  const run = runById(card.step.runId)
  const step = run && stepById(run.recipe, card.step.stepId)
  return run && step ? { run, step } : undefined
}

/** Keep a cooked chain (or the run of a recipe) under a name, for the Prep list. */
export function saveRecipe(run: Run, name: string): void {
  const recipe = saveAs(run, tidyName(name))
  state.recipes.push(recipe)
  run.recipe.name = recipe.name // the cards now say which recipe they're part of, and it isn't offered again at the end
  justFinished.value = null
  void play('beep', true)
}

/** A recipe started from scratch: a name, then its screen fills in the rest. */
export function newRecipe(name: string): Recipe {
  const recipe: Recipe = { id: uid(), name: tidyName(name), steps: [], ingredients: [], serves: null }
  state.recipes.push(recipe)
  void play('beep', true)
  return recipe
}

/** A recipe parsed from pasted JSON (recipeImport.ts): kept as it came. */
export function importRecipe(recipe: Recipe): Recipe {
  state.recipes.push(recipe)
  void play('beep', true)
  return recipe
}

export function removeRecipe(id: string): void {
  state.recipes = state.recipes.filter((r) => r.id !== id)
}

/** Prep a recipe: its first step(s) come up, the rest follow as each is done. */
export function startRecipe(recipe: Recipe, serves: number | null = recipe.serves ?? null): void {
  const run = runRecipe(recipe, serves)
  state.runs.push(run)
  const now = Date.now()
  const first = run.active.map((id) => stepById(run.recipe, id)).filter((s): s is Step => !!s)
  for (const step of first) bringUp(run, step, now, '')
  void play('beep', true)
  tick(true)
}

// ---- Editing a saved recipe (the recipe screen) ----

export function setRecipeServes(recipeId: string, serves: number | null): void {
  const recipe = recipeById(recipeId)
  if (recipe) recipe.serves = serves
}

export function setIngredient(recipeId: string, ingredient: Ingredient): void {
  const recipe = recipeById(recipeId)
  if (!recipe) return
  recipe.ingredients ??= []
  const at = recipe.ingredients.findIndex((i) => i.id === ingredient.id)
  if (at < 0) recipe.ingredients.push(ingredient)
  else recipe.ingredients[at] = ingredient
}

export function removeIngredient(recipeId: string, ingredientId: string): void {
  const recipe = recipeById(recipeId)
  if (recipe) recipe.ingredients = (recipe.ingredients ?? []).filter((i) => i.id !== ingredientId)
}

export const pauseTimer = (id: string) =>
  withTimer(id, (t, now) => {
    pause(t, now)
    void play('beep', true)
  })

/** Play button: un-pauses a timer, or sets a prepped one going for the first time. */
export const resumeTimer = (id: string) =>
  withTimer(id, (t, now) => {
    const firstStart = t.prepped
    resume(t, now)
    void play(firstStart ? 'start' : 'beep', true)
    if (firstStart) say(startedPhrase(t), SPEAK_AFTER_SFX_MS)
  })

export const setTimerPlan = (id: string, plan: AlertPlan) =>
  withTimer(id, (t, now) => {
    setPlan(t, plan, now)
    if (plan.kind !== 'none') rehearse(alertPhrase(t, plan.label))
    void play('beep', true)
  })

export const extendTimer = (id: string, ms: number) =>
  withTimer(id, (t, now) => {
    const wasFinished = t.finishedAt !== null
    addTime(t, ms, now)
    if (wasFinished) void play('start', true)
  })

export function installStore(): void {
  installAudio()
  installWakeLock()

  // Sound just came on (first tap after reopening the app): don't make anything
  // already pending wait out the rest of a silent 15 seconds.
  watch(soundReady, (ready) => {
    if (!ready) return
    nextNotifyAt = 0
    if (state.timers.length) announce('Sound on') // the red banner has just gone
  })

  watch(
    () => [state.timers, state.notes, state.runs, state.recipes, state.presets, state.history],
    () => {
      try {
        const { timers, notes, runs, recipes, presets, history } = state
        localStorage.setItem(STORAGE_KEY, serialise({ timers, notes, runs, recipes, presets, history }))
      } catch {
        /* storage full or unavailable */
      }
    },
    { deep: true },
  )

  tick(true)
  setInterval(tick, 250)
  // Intervals are throttled in the background; catch up the instant we're visible again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick(true)
  })
}
