// Recipes: steps that follow one another. A step is a timer (as in timer.ts) or an
// instruction ("Add the diced chicken"); each says which steps it comes after. A run is a
// recipe being cooked: which steps are done, which are up. Pure, like the timer engine:
// the store materialises an active timer step as a real Timer and an active instruction as
// a note card, and calls back here when the cook presses Done on either.
//
// Today every chain is linear ("+ Next step" appends to the end), but the shape allows
// forks and joins, which is what the later graph view will edit.

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
}

/** A recipe in progress. `active` steps are on screen as cards; `done` ones are behind us. */
export interface Run {
  id: string
  recipe: Recipe
  done: string[]
  active: string[]
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
export function runRecipe(recipe: Recipe): Run {
  const run: Run = { id: uid(), recipe: copyOf(recipe), done: [], active: [] }
  run.active = readySteps(run).map((s) => s.id)
  return run
}

const successors = (recipe: Recipe, id: string) => recipe.steps.filter((s) => s.after.includes(id))

/** The steps with no successor: where "+ Next step" goes. A linear chain has exactly one. */
export function tails(recipe: Recipe): Step[] {
  return recipe.steps.filter((s) => successors(recipe, s.id).length === 0)
}

/** Append a step after the chain's end. */
export function appendStep(recipe: Recipe, step: Step): void {
  step.after = tails(recipe).map((s) => s.id)
  recipe.steps.push(step)
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
})

/** A saved copy of a run's chain, under a name: what "Save as recipe" keeps. */
export function saveAs(run: Run, name: string): Recipe {
  return { ...copyOf(run.recipe), id: uid(), name }
}
