import { describe, expect, it } from 'vitest'
import {
  addStepAfter,
  appendStep,
  completeStep,
  forkDelays,
  layout,
  msFrom,
  noteStep,
  type Recipe,
  removeStep,
  runFinished,
  runRecipe,
  saveAs,
  startRun,
  stepPosition,
  tails,
  timerStep,
  totalMs,
} from './recipe'
import { NO_ALERTS } from './timer'

const MIN = 60_000

/** veg 5 min → "move the veg to a bowl" → chicken 8 min */
function stirFry() {
  const veg = timerStep('Veg', 5 * MIN, NO_ALERTS)
  const run = startRun(veg)
  const bowl = noteStep('Move the veg to a bowl and cover')
  appendStep(run.recipe, bowl)
  const chicken = timerStep('Chicken', 8 * MIN, NO_ALERTS)
  appendStep(run.recipe, chicken)
  return { run, veg, bowl, chicken }
}

describe('a chain built while cooking', () => {
  it('starts with the first step up, and "+ Next step" appends after the end', () => {
    const { run, veg, bowl, chicken } = stirFry()
    expect(run.active).toEqual([veg.id])
    expect(bowl.after).toEqual([veg.id])
    expect(chicken.after).toEqual([bowl.id])
    expect(tails(run.recipe).map((s) => s.id)).toEqual([chicken.id])
  })

  it('Done on a step brings up the next, one at a time, until the run is over', () => {
    const { run, veg, bowl, chicken } = stirFry()
    expect(completeStep(run, veg.id)).toEqual([bowl])
    expect(run.active).toEqual([bowl.id])
    expect(runFinished(run)).toBe(false)
    expect(completeStep(run, bowl.id)).toEqual([chicken])
    expect(completeStep(run, chicken.id)).toEqual([])
    expect(runFinished(run)).toBe(true)
  })

  it('knows where a step is in the chain', () => {
    const { run, bowl } = stirFry()
    expect(stepPosition(run.recipe, bowl.id)).toEqual({ index: 2, total: 3 })
  })

  it('adds up the timers and ignores instructions', () => {
    expect(totalMs(stirFry().run.recipe)).toBe(13 * MIN)
  })

  it('Done twice on the same step is harmless', () => {
    const { run, veg } = stirFry()
    completeStep(run, veg.id)
    expect(completeStep(run, veg.id)).toEqual([])
    expect(run.done).toEqual([veg.id])
  })
})

describe('a saved recipe', () => {
  it('is a copy under a name, and runs from its first step with nothing done', () => {
    const { run } = stirFry()
    completeStep(run, run.recipe.steps[0]?.id ?? '')
    const recipe = saveAs(run, 'Stir fry')
    expect(recipe.name).toBe('Stir fry')
    expect(recipe.steps).toHaveLength(3)
    expect(recipe.id).not.toBe(run.recipe.id)

    const again = runRecipe(recipe)
    expect(again.done).toEqual([])
    expect(again.active).toEqual([recipe.steps[0]?.id])
    // the run has its own copies: cooking it can't touch the saved recipe
    again.recipe.steps[0]!.after.push('x')
    expect(recipe.steps[0]?.after).toEqual([])
  })
})

describe('forks and joins (the shape the graph view will edit)', () => {
  it('a step after two others waits for both, and both come up together after their shared predecessor', () => {
    const prep = noteStep('Peel and chop')
    const mash = timerStep('Mash', 20 * MIN, NO_ALERTS, [prep.id])
    const beef = timerStep('Beef', 15 * MIN, NO_ALERTS, [prep.id])
    const plate = noteStep('Plate up', [mash.id, beef.id])
    const recipe: Recipe = { id: 'r', name: 'Cottage pie', steps: [prep, mash, beef, plate] }
    const run = runRecipe(recipe)
    expect(run.active).toEqual([prep.id])
    expect(completeStep(run, prep.id).map((s) => s.id)).toEqual([mash.id, beef.id])
    expect(completeStep(run, beef.id)).toEqual([]) // mash still going
    expect(completeStep(run, mash.id).map((s) => s.id)).toEqual([plate.id])
    expect(totalMs(recipe)).toBe(20 * MIN) // the longest lane
    expect(tails(recipe).map((s) => s.id)).toEqual([plate.id])
  })
})

describe('shape and ingredients (the graph view and the recipe screen)', () => {
  it('lays steps out in rows: each below everything it waits for', () => {
    const prep = noteStep('Peel and chop')
    const mash = timerStep('Mash', 20 * MIN, NO_ALERTS, [prep.id])
    const beef = timerStep('Beef', 15 * MIN, NO_ALERTS, [prep.id])
    const rest = noteStep('Rest the beef', [beef.id])
    const plate = noteStep('Plate up', [mash.id, rest.id])
    const recipe: Recipe = { id: 'r', name: '', steps: [prep, mash, beef, rest, plate] }
    expect(layout(recipe).map((row) => row.map((s) => s.id))).toEqual([
      [prep.id],
      [mash.id, beef.id],
      [rest.id],
      [plate.id],
    ])
  })

  it('orders a row so each step sits under its parent: two branches that carry on do not cross', () => {
    const chicken = timerStep('Chicken', 10 * MIN, NO_ALERTS)
    const trim = noteStep('Trim the broccoli', [chicken.id])
    const sauceIn = noteStep('Add sauce', [chicken.id])
    const sauce = timerStep('Sauce', 5 * MIN, NO_ALERTS, [sauceIn.id]) // added first, but belongs under "Add sauce"
    const veg = timerStep('Veg', 10 * MIN, NO_ALERTS, [trim.id])
    const recipe: Recipe = { id: 'r', name: '', steps: [chicken, trim, sauceIn, sauce, veg] }
    expect(layout(recipe).map((row) => row.map((s) => s.id))).toEqual([
      [chicken.id],
      [trim.id, sauceIn.id],
      [veg.id, sauce.id],
    ])
  })

  it('a branch off a node forks; "+ Next step" after that joins the open ends', () => {
    const veg = timerStep('Veg', 5 * MIN, NO_ALERTS)
    const run = startRun(veg)
    const rice = timerStep('Rice', 12 * MIN, NO_ALERTS)
    addStepAfter(run.recipe, rice, [veg.id])
    const sauce = timerStep('Sauce', 3 * MIN, NO_ALERTS)
    addStepAfter(run.recipe, sauce, [veg.id])
    expect(tails(run.recipe).map((s) => s.id)).toEqual([rice.id, sauce.id])
    const serve = noteStep('Serve')
    appendStep(run.recipe, serve)
    expect(serve.after).toEqual([rice.id, sauce.id])
    expect(totalMs(run.recipe)).toBe(17 * MIN)
  })

  it('at a fork, the branch with more cooking ahead starts first and the rest wait', () => {
    const prep = noteStep('Chop')
    const mash = timerStep('Mash', 20 * MIN, NO_ALERTS, [prep.id])
    const beef = timerStep('Beef', 15 * MIN, NO_ALERTS, [prep.id])
    const rest = timerStep('Rest', 5 * MIN, NO_ALERTS, [beef.id])
    const recipe: Recipe = { id: 'r', name: '', steps: [prep, mash, beef, rest] }
    expect(msFrom(recipe, beef.id)).toBe(20 * MIN) // beef then rest
    const delays = forkDelays(recipe, [mash.id, beef.id])
    expect(delays.get(mash.id)).toBe(0)
    expect(delays.get(beef.id)).toBe(0) // both lanes are 20 min
    const quick = timerStep('Peas', 4 * MIN, NO_ALERTS, [prep.id])
    recipe.steps.push(quick)
    expect(forkDelays(recipe, [mash.id, quick.id]).get(quick.id)).toBe(16 * MIN)
  })

  it('removing a step keeps the chain joined', () => {
    const { run, veg, bowl, chicken } = stirFry()
    removeStep(run.recipe, bowl.id)
    expect(run.recipe.steps.map((s) => s.id)).toEqual([veg.id, chicken.id])
    expect(chicken.after).toEqual([veg.id])
  })

  it('an instruction that names [ingredients] puts them on the list once, amounts to fill in', () => {
    const { run } = stirFry()
    appendStep(run.recipe, noteStep('Add [Diced chicken] and [Soy sauce]'))
    appendStep(run.recipe, noteStep('More [diced chicken]'))
    expect(run.recipe.ingredients?.map((i) => [i.name, i.amount])).toEqual([
      ['Diced chicken', null],
      ['Soy sauce', null],
    ])
    const saved = saveAs(run, 'Stir fry')
    expect(saved.ingredients).toHaveLength(2)
    expect(runRecipe(saved, 2).serves).toBe(2)
  })
})
