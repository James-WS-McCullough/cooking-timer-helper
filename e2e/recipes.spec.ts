import { expect, test } from '@playwright/test'
import { card, clockNear, controlClock, MIN, pass, seed, sheet, startTimer } from './helpers'

// A chain of steps, built while cooking: veg 5 min → "move the veg to a bowl" → chicken 8 min.
// Done on each step brings up the next, in its place; the finished chain can be kept as a recipe.

async function addInstruction(page: import('@playwright/test').Page, after: string, text: string) {
  await page.getByRole('button', { name: new RegExp(`step(s)? after ${after}`) }).click()
  await expect(sheet(page).getByText(`After ${after}`)).toBeVisible()
  await sheet(page).getByRole('button', { name: 'An instruction' }).click()
  await sheet(page).getByRole('textbox', { name: 'The instruction' }).fill(text)
  await sheet(page).getByRole('button', { name: 'Add step' }).click()
  await expect(sheet(page)).toBeHidden()
}

async function addTimerStep(page: import('@playwright/test').Page, after: string, name: string, minutes: number) {
  await page.getByRole('button', { name: new RegExp(`step(s)? after ${after}`) }).click()
  await sheet(page).getByRole('button', { name: 'A timer' }).click()
  await expect(sheet(page).getByText(`After ${after}`)).toBeVisible() // the ordinary wizard, in "next step" mode
  await sheet(page).getByRole('button', { name, exact: true }).click()
  await sheet(page)
    .getByRole('button', { name: String(minutes), exact: true })
    .click()
  await expect(sheet(page)).toBeHidden()
}

test('steps follow one another, each in the place of the last, and the chain can be saved', async ({ page }) => {
  await controlClock(page)
  await page.goto('/')
  await startTimer(page, 'Veg', 5)
  await addInstruction(page, 'Veg', 'Move the veg to a bowl')
  await addTimerStep(page, 'Veg', 'Chicken', 8) // goes on the end of the chain, after the instruction
  const nextButton = card(page, 'Veg').getByRole('button', { name: /steps after Veg: 2 so far/ })
  await expect(nextButton).toBeVisible()
  await expect(page.locator('.card')).toHaveCount(1) // nothing else on screen yet

  await pass(page, 5 * MIN + 500)
  await card(page, 'Veg ready').getByRole('button', { name: 'Done, Veg' }).click()
  const note = page.getByRole('article', { name: 'Move the veg to a bowl' })
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
  await expect(sheet(page)).toBeHidden()
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
