import { expect, test } from '@playwright/test'
import { card, clockNear, controlClock, MIN, pass, seed, sheet, startTimer } from './helpers'

// A chain of steps, built while cooking: veg 5 min → "move the veg to a bowl" → chicken 8 min.
// Done on each step brings up the next, in its place; the finished chain can be kept as a recipe.

/** The card's list-plus button: straight to "what comes next?" for a lone timer; the chain's graph once there is one. */
async function pressNext(page: import('@playwright/test').Page, card: string) {
  await page.getByRole('button', { name: new RegExp(`step(s)? after ${card}`) }).click()
  const graph = page.getByRole('dialog', { name: /This recipe|Stir fry/ })
  await expect(graph.or(sheet(page))).toBeVisible()
  if (await graph.isVisible()) await graph.getByRole('button', { name: '+ Add a step at the end' }).click()
}

async function addInstruction(page: import('@playwright/test').Page, after: string, text: string) {
  await pressNext(page, after)
  await expect(sheet(page).getByText(`After ${after}`)).toBeVisible()
  await sheet(page).getByRole('button', { name: 'An instruction' }).click()
  await sheet(page).getByRole('textbox', { name: 'The instruction' }).fill(text)
  await sheet(page).getByRole('button', { name: 'Add step' }).click()
  await leaveGraph(page)
}

/** Back to the cards: the graph, if that's where we came from, is still open behind the step sheet. */
async function leaveGraph(page: import('@playwright/test').Page) {
  const graph = page.getByRole('dialog', { name: /This recipe|Stir fry/ })
  await expect(page.getByRole('dialog', { name: /What comes next|How long|What's cooking/ })).toBeHidden()
  if (await graph.isVisible()) await graph.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function addTimerStep(
  page: import('@playwright/test').Page,
  after: string,
  name: string,
  minutes: number,
  follows = after,
) {
  await pressNext(page, after)
  await expect(sheet(page).getByText(`After ${follows}`)).toBeVisible() // names the chain's end, not the card
  await sheet(page).getByRole('button', { name: 'A timer' }).click()
  await expect(sheet(page).getByText(`After ${follows}`)).toBeVisible() // the ordinary wizard, in "next step" mode
  await sheet(page).getByRole('button', { name, exact: true }).click()
  await sheet(page)
    .getByRole('button', { name: String(minutes), exact: true })
    .click()
  await leaveGraph(page)
}

test('steps follow one another, each in the place of the last, and the chain can be saved', async ({ page }) => {
  await controlClock(page)
  await page.goto('/')
  await startTimer(page, 'Veg', 5)
  await addInstruction(page, 'Veg', 'Move the veg to a bowl')
  await addTimerStep(page, 'Veg', 'Chicken', 8, 'Move the veg to a bowl') // goes on the end of the chain, after the instruction
  const nextButton = card(page, 'Veg').getByRole('button', { name: /steps after Veg: 2 so far/ })
  await expect(nextButton).toBeVisible()
  await expect(page.locator('.card')).toHaveCount(1) // nothing else on screen yet

  // With a chain to see, the button shows it: a step can be changed there, and the lot kept as a recipe early.
  await nextButton.click()
  const graph = page.getByRole('dialog', { name: 'This recipe' })
  await expect(graph).toContainText('0 of 3 steps done')
  await graph.getByRole('button', { name: 'Move the veg to a bowl' }).click()
  await graph.getByRole('button', { name: 'Change this step' }).click()
  await expect(sheet(page).getByText('Change step')).toBeVisible()
  await sheet(page).getByRole('textbox', { name: 'The instruction' }).fill('Move the veg to a bowl and cover')
  await sheet(page).getByRole('button', { name: 'Save' }).click()
  await expect(graph.getByRole('button', { name: 'Move the veg to a bowl and cover' })).toBeVisible()
  await graph.getByRole('button', { name: 'Veg, 5 min, now' }).click()
  await expect(graph.getByRole('button', { name: 'Change this step' })).toBeHidden() // it's on screen: only add after
  await graph.getByRole('button', { name: 'Cancel' }).click()
  await graph.getByRole('button', { name: 'Close' }).click()

  await pass(page, 5 * MIN + 500)
  await card(page, 'Veg ready').getByRole('button', { name: 'Done, Veg' }).click()
  const note = page.getByRole('article', { name: 'Move the veg to a bowl and cover' })
  await expect(note).toBeVisible()
  await expect(note).toContainText('Step 2 of 3')
  await expect(page.locator('.card')).toHaveCount(1)
  await pass(page, 2 * MIN) // an instruction waits for its Done; nothing counts down
  await note.getByRole('button', { name: 'Done' }).click()

  const chicken = card(page, 'Chicken')
  await expect(chicken).toBeVisible()
  await expect(chicken.getByRole('timer')).toHaveText('8:00') // up, but not started
  await pass(page, MIN)
  await expect(chicken.getByRole('timer')).toHaveText('8:00')
  await chicken.getByRole('button', { name: 'Start Chicken' }).click()
  await pass(page, 8 * MIN + 500)
  await card(page, 'Chicken ready').getByRole('button', { name: 'Done, Chicken' }).click()

  // The chain is over: keep it?
  const save = page.getByRole('dialog', { name: 'Keep that as a recipe?' })
  await expect(save).toContainText('3 steps, 13 min')
  await save.getByRole('textbox', { name: 'Recipe name' }).fill('stir fry')
  await save.getByRole('button', { name: 'Save recipe' }).click()
  await expect(save).toBeHidden()
  await expect(page.locator('.card')).toHaveCount(0)

  // …and it's one tap on the Prep path, not on the quick path.
  await page.getByRole('button', { name: 'New timer' }).click()
  await expect(sheet(page).getByText('Recipes')).toBeHidden()
  await sheet(page).getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Prep a timer' }).click()
  await sheet(page).getByRole('button', { name: 'Prep Stir fry: 3 steps · 13 min' }).click()
  const recipe = page.getByRole('dialog', { name: 'Stir fry' })
  await expect(recipe).toContainText('3 steps · 13 min')
  await recipe.getByRole('button', { name: 'Prep Stir fry' }).click()
  await expect(recipe).toBeHidden()
  await expect(card(page, 'Veg')).toBeVisible()
  await expect(card(page, 'Veg')).toContainText('Ready to start')
  await expect(page.locator('.card')).toHaveCount(1)
  await page.reload()
  await expect(card(page, 'Veg')).toBeVisible() // a run survives a reload
})

test('a recipe step is not Sync Finish material, and ✕ removes the whole chain', async ({ page }) => {
  await page.goto('/')
  await startTimer(page, 'Rice', 10)
  await addInstruction(page, 'Rice', 'Fluff with a fork')
  await page.getByRole('button', { name: 'Prep a timer' }).click()
  await sheet(page).getByRole('button', { name: 'Potatoes', exact: true }).click()
  await sheet(page).getByRole('button', { name: '20', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sync Finish' })).toBeHidden() // one prepped plain timer isn't enough

  await page.getByRole('button', { name: 'Remove Rice' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Remove Rice and the steps with it?' })
  await confirm.getByRole('button', { name: 'Remove Rice' }).click()
  await expect(card(page, 'Rice')).toHaveCount(0)
  await expect(card(page, 'Potatoes')).toBeVisible()
})

test('the recipe screen: servings scale the ingredients, a branch forks the graph and lands together', async ({
  page,
}) => {
  await controlClock(page)
  await page.addInitScript(() => {
    const none = { kind: 'none', everyMs: 0, label: 'Flip', pause: false }
    const steps = [
      { id: 'chop', kind: 'note', text: 'Chop the [Onions]', after: [] },
      { id: 'mash', kind: 'timer', name: 'Mash', durationMs: 20 * 60_000, plan: none, after: ['chop'] },
      { id: 'serve', kind: 'note', text: 'Add [Butter] and serve', after: ['mash'] },
    ]
    const ingredients = [
      { id: 'i1', name: 'Onions', amount: 2, unit: '' },
      { id: 'i2', name: 'Butter', amount: 50, unit: 'g' },
    ]
    localStorage.setItem(
      'sizzle:v1',
      JSON.stringify({
        version: 3,
        timers: [],
        notes: [],
        runs: [],
        presets: [],
        history: {},
        recipes: [{ id: 'r', name: 'Mash', steps, ingredients, serves: 4 }],
      }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Prep a timer' }).click()
  await sheet(page)
    .getByRole('button', { name: /Prep Mash/ })
    .click()
  const recipe = page.getByRole('dialog', { name: 'Mash' })
  await expect(recipe).toContainText('Serves 4')
  await expect(recipe.getByRole('button', { name: '2 onions' })).toBeVisible()
  await recipe.getByRole('button', { name: 'Fewer' }).click()
  await recipe.getByRole('button', { name: 'Fewer' }).click()
  await expect(recipe).toContainText('Serves 2')
  await expect(recipe.getByRole('button', { name: '1 onions' })).toBeVisible()
  await expect(recipe.getByRole('button', { name: '25 g butter' })).toBeVisible()

  // Branch off "Chop": veg alongside the mash. The graph shows the fork.
  await recipe.getByRole('button', { name: /^Chop the Onions/ }).click()
  await recipe.getByRole('button', { name: 'Add a step after this' }).click()
  await expect(sheet(page).getByText('After Chop the [Onions]')).toBeVisible()
  await sheet(page).getByRole('button', { name: 'A timer' }).click()
  await sheet(page).getByRole('button', { name: 'Veg', exact: true }).click()
  await sheet(page).getByRole('button', { name: '4', exact: true }).click()
  await expect(recipe).toBeVisible() // back where we were
  await expect(recipe.getByRole('button', { name: 'Veg, 4 min' })).toBeVisible()

  await recipe.getByRole('button', { name: 'Prep Mash for 2' }).click()
  const chop = page.getByRole('article', { name: 'Chop the 1 onions' })
  await expect(chop).toBeVisible()
  await chop.getByRole('button', { name: 'Done' }).click()
  // Both branches come up; the short one waits so they land together (16 min of waiting).
  const mash = page.getByRole('article', { name: 'Mash', exact: true })
  const veg = page.getByRole('article', { name: 'Veg', exact: true })
  await expect(mash).toContainText('Ready to start')
  await expect(veg).toContainText('Start in')
  await expect(veg.getByRole('timer')).toHaveText(clockNear('16:00'))
})
