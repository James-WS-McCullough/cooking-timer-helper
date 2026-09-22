import { describe, expect, it } from 'vitest'
import {
  appendStep,
  completeStep,
  noteStep,
  type Recipe,
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
