// Recipes: steps that follow one another. A step is a timer (as in timer.ts) or an
// instruction ("Add the diced chicken"); each says which steps it comes after. A run is a
// recipe being cooked: which steps are done, which are up. Pure, like the timer engine:
// the store materialises an active timer step as a real Timer and an active instruction as
// a note card, and calls back here when the cook presses Done on either.
//
// Today every chain is linear ("+ Next step" appends to the end), but the shape allows
// forks and joins, which is what the later graph view will edit.

import { findIngredient, type Ingredient, mentioned } from './ingredients'
import { type AlertPlan, uid } from './timer'

export interface TimerStep {
  id: string
  kind: 'timer'
  name: string
  durationMs: number
  plan: AlertPlan
  after: string[]
}

export interface NoteStep {
  id: string
  kind: 'note'
  text: string
  after: string[]
}

export type Step = TimerStep | NoteStep

export interface Recipe {
  id: string
  name: string // '' while it's only a chain being cooked, not yet saved
  steps: Step[]
  ingredients?: Ingredient[]
  serves?: number | null // how many the amounts are for; null when not said
}

/** A recipe in progress. `active` steps are on screen as cards; `done` ones are behind us. */
export interface Run {
  id: string
  recipe: Recipe
  done: string[]
  active: string[]
  serves?: number | null // how many this time; the ingredients scale from recipe.serves to this
}

/** Where a card belongs in a run, kept on the Timer or note it materialises. */
export interface StepRef {
  runId: string
  stepId: string
}

/** An instruction step on screen ("Add the diced chicken"), waiting for its Done. */
export interface Note {
  id: string
  text: string
  createdAt: number
  step: StepRef
}

export const isNote = (card: object): card is Note => 'text' in card && typeof card.text === 'string'

export const timerStep = (name: string, durationMs: number, plan: AlertPlan, after: string[] = []): TimerStep => ({
  id: uid(),
  kind: 'timer',
  name,
  durationMs,
  plan: { ...plan },
  after,
})

export const noteStep = (text: string, after: string[] = []): NoteStep => ({ id: uid(), kind: 'note', text, after })

/** A run that begins with one step already on the go (the running timer "+ Next step" was pressed on). */
export function startRun(first: Step): Run {
  return { id: uid(), recipe: { id: uid(), name: '', steps: [first] }, done: [], active: [first.id] }
}

/** A run of a saved recipe: its first steps are up, nothing is done. */
export function runRecipe(recipe: Recipe, serves: number | null = recipe.serves ?? null): Run {
  const run: Run = { id: uid(), recipe: copyOf(recipe), done: [], active: [], serves }
  run.active = readySteps(run).map((s) => s.id)
  return run
}

const successors = (recipe: Recipe, id: string) => recipe.steps.filter((s) => s.after.includes(id))

/** The steps with no successor: where "+ Next step" goes. A linear chain has exactly one. */
export function tails(recipe: Recipe): Step[] {
  return recipe.steps.filter((s) => successors(recipe, s.id).length === 0)
}

/** Append a step after the chain's end (after every open branch: with two, this joins them). */
export function appendStep(recipe: Recipe, step: Step): void {
  step.after = tails(recipe).map((s) => s.id)
  addStep(recipe, step)
}

/** Add a step after particular steps: a branch off a node in the graph. */
export function addStepAfter(recipe: Recipe, step: Step, after: string[]): void {
  step.after = after.filter((id) => stepById(recipe, id))
  addStep(recipe, step)
}

function addStep(recipe: Recipe, step: Step): void {
  recipe.steps.push(step)
  // An instruction that names [ingredients] puts them on the list, amounts to be filled in.
  if (step.kind === 'note') {
    recipe.ingredients ??= []
    for (const name of mentioned(step.text)) {
      if (!findIngredient(recipe.ingredients, name))
        recipe.ingredients.push({ id: uid(), name, amount: null, unit: '' })
    }
  }
}

/** Take a step out. What came after it now comes after what came before it, so the chain stays joined. */
export function removeStep(recipe: Recipe, id: string): void {
  const gone = stepById(recipe, id)
  if (!gone) return
  recipe.steps = recipe.steps.filter((s) => s.id !== id)
  for (const s of recipe.steps) {
    if (!s.after.includes(id)) continue
    s.after = [...new Set([...s.after.filter((a) => a !== id), ...gone.after])]
  }
}

/**
 * Where each step sits when drawn: its row (1 + the deepest predecessor's row, so a step
 * is always below everything it waits for) and the steps that share that row, ordered so
 * that each sits under its predecessors as far as possible, which keeps lines from crossing
 * when two branches each carry on.
 */
export function layout(recipe: Recipe): Step[][] {
  const row = new Map<string, number>()
  const rowOf = (id: string): number => {
    const known = row.get(id)
    if (known !== undefined) return known
    const step = stepById(recipe, id)
    const r = step && step.after.length ? 1 + Math.max(...step.after.map(rowOf)) : 0
    row.set(id, r)
    return r
  }
  const rows: Step[][] = []
  for (const step of recipe.steps) {
    const r = rowOf(step.id)
    rows[r] ??= []
    rows[r].push(step)
  }
  const placed = rows.filter(Boolean)
  // Each row after the first: sort by the average position of a step's predecessors above.
  const at = new Map<string, number>()
  for (const [r, row] of placed.entries()) {
    if (r > 0) {
      const centre = (s: Step) => {
        const above = s.after.map((id) => at.get(id)).filter((x): x is number => x !== undefined)
        return above.length ? above.reduce((a, b) => a + b, 0) / above.length : Number.POSITIVE_INFINITY
      }
      row.sort((a, b) => centre(a) - centre(b))
    }
    for (const [i, s] of row.entries()) at.set(s.id, i / Math.max(1, row.length - 1))
  }
  return placed
}

/** Cooking time from this step to the end of the recipe, along the longest path. */
export function msFrom(recipe: Recipe, id: string): number {
  const memo = new Map<string, number>()
  const from = (stepId: string): number => {
    const known = memo.get(stepId)
    if (known !== undefined) return known
    const step = stepById(recipe, stepId)
    if (!step) return 0
    const own = step.kind === 'timer' ? step.durationMs : 0
    const later = successors(recipe, stepId).map((s) => from(s.id))
    const total = own + (later.length ? Math.max(...later) : 0)
    memo.set(stepId, total)
    return total
  }
  return from(id)
}

/**
 * Steps that have come up together (a fork): how long each should wait before it goes on
 * so that every branch lands at once. The longest branch starts now; the others hold back.
 */
export function forkDelays(recipe: Recipe, ids: string[]): Map<string, number> {
  const remaining = new Map(ids.map((id) => [id, msFrom(recipe, id)]))
  const longest = Math.max(0, ...remaining.values())
  return new Map(ids.map((id) => [id, longest - (remaining.get(id) ?? 0)]))
}

export const stepById = (recipe: Recipe, id: string): Step | undefined => recipe.steps.find((s) => s.id === id)

/** Steps whose every predecessor is done, that aren't themselves done or already up. */
function readySteps(run: Run): Step[] {
  return run.recipe.steps.filter(
    (s) => !run.done.includes(s.id) && !run.active.includes(s.id) && s.after.every((id) => run.done.includes(id)),
  )
}

/** The cook pressed Done on a step. Returns the steps that come up because of it. */
export function completeStep(run: Run, stepId: string): Step[] {
  run.active = run.active.filter((id) => id !== stepId)
  if (!run.done.includes(stepId)) run.done.push(stepId)
  const next = readySteps(run)
  run.active.push(...next.map((s) => s.id))
  return next
}

/** Every step accounted for: the run is over. */
export const runFinished = (run: Run) => run.active.length === 0 && run.done.length === run.recipe.steps.length

/** Position for a card's context line: 1-based index of this step along the chain, and the total. */
export function stepPosition(recipe: Recipe, id: string): { index: number; total: number } {
  return { index: recipe.steps.findIndex((s) => s.id === id) + 1, total: recipe.steps.length }
}

/** How long the recipe takes end to end: its longest path of timer steps. Instructions take no time. */
export function totalMs(recipe: Recipe): number {
  const memo = new Map<string, number>()
  const upTo = (id: string): number => {
    const known = memo.get(id)
    if (known !== undefined) return known
    const step = stepById(recipe, id)
    if (!step) return 0
    const own = step.kind === 'timer' ? step.durationMs : 0
    const before = step.after.length ? Math.max(...step.after.map(upTo)) : 0
    const total = before + own
    memo.set(id, total)
    return total
  }
  return Math.max(0, ...recipe.steps.map((s) => upTo(s.id)))
}

const copyOf = (recipe: Recipe): Recipe => ({
  ...recipe,
  steps: recipe.steps.map((s) => ({ ...s, after: [...s.after] })),
  ingredients: recipe.ingredients?.map((i) => ({ ...i })),
})

/** A saved copy of a run's chain, under a name: what "Save as recipe" keeps. */
export function saveAs(run: Run, name: string): Recipe {
  return { ...copyOf(run.recipe), id: uid(), name }
}
