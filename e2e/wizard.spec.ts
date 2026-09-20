import { expect, test } from '@playwright/test'
import { card, sheet, startTimer } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('three taps start a named timer with its icon', async ({ page }) => {
  await startTimer(page, 'Potatoes', 20)
  const potatoes = card(page, 'Potatoes')
  await expect(potatoes).toBeVisible()
  await expect(potatoes.getByRole('timer')).toHaveText(/20:00|19:5\d/)
  await expect(potatoes.locator('svg.icon')).toBeVisible()
})

test('the back arrow on the time screen returns to the names', async ({ page }) => {
  await page.getByRole('button', { name: 'New timer' }).click()
  await sheet(page).getByRole('button', { name: 'Pasta', exact: true }).click()
  await expect(sheet(page).getByRole('heading', { name: 'How long?' })).toBeVisible()
  await sheet(page).getByRole('button', { name: 'Back', exact: true }).click()
  await expect(sheet(page).getByRole('heading', { name: "What's cooking?" })).toBeVisible()
})

test('focusing the search box as the name step slides away does not strand the time screen', async ({ page }) => {
  await page.getByRole('button', { name: 'New timer' }).click()
  await expect(sheet(page).getByRole('button', { name: 'Pasta', exact: true })).toBeVisible()
  // Pick a name, then focus the search box 30ms later: inside the 120ms the old step takes to slide out.
  // Done in the page so the timing is exact (a Playwright click only returns once the slide is over).
  const focused = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const chip = [...document.querySelectorAll<HTMLElement>('.names .chip')].find(
          (c) => c.textContent?.trim() === 'Pasta',
        )
        chip?.click()
        setTimeout(() => {
          const box = document.querySelector<HTMLInputElement>('.search input')
          box?.focus()
          resolve(document.activeElement === box && box !== null)
        }, 30)
      }),
  )
  expect(focused, 'the test must land its focus during the slide to mean anything').toBe(true)
  await expect(sheet(page).getByRole('heading', { name: 'How long?' })).toBeVisible()
  await expect(sheet(page).getByRole('button', { name: 'Back', exact: true })).toBeVisible()
  await expect(sheet(page).getByRole('button', { name: 'Close' })).toBeVisible()
})

test('a name typed in lowercase is offered, and used, capitalised', async ({ page }) => {
  await page.getByRole('button', { name: 'New timer' }).click()
  await sheet(page)
    .getByRole('textbox', { name: /Search foods/ })
    .fill('nanas stew')
  await sheet(page).getByRole('button', { name: 'Use “Nanas stew”' }).click()
  await expect(sheet(page).getByRole('heading', { name: 'How long?' })).toBeVisible()
  await sheet(page).getByRole('button', { name: '5', exact: true }).click()
  await expect(card(page, 'Nanas stew')).toBeVisible()
})

test('search puts the plain one-word food first', async ({ page }) => {
  await page.getByRole('button', { name: 'New timer' }).click()
  const search = sheet(page).getByRole('textbox', { name: /Search foods/ })
  const foods = sheet(page).locator('.result:not(.use)')
  await search.fill('turk')
  await expect(foods.first()).toHaveText('Turkey')
  await search.fill('wat')
  await expect(foods.first()).toHaveText('Water')
  // while searching there is no footer button: the list has the room
  await expect(sheet(page).getByRole('button', { name: 'Next' })).toBeHidden()
})

test('the time screen offers what this name was timed for last time', async ({ page }) => {
  await startTimer(page, 'Potatoes', 25)
  await page.getByRole('button', { name: 'New timer' }).click()
  await sheet(page).getByRole('button', { name: 'Potatoes', exact: true }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Last time' })).toBeVisible()
  await sheet(page).getByRole('button', { name: '25 min' }).click()
  await expect(card(page, 'Potatoes')).toHaveCount(2)

  await page.reload()
  await page.getByRole('button', { name: 'New timer' }).click()
  await sheet(page).getByRole('button', { name: 'Eggs', exact: true }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Last time' })).toBeHidden() // history is per name
})

test('a saved preset starts in one tap and can be deleted in edit mode', async ({ page }) => {
  await page.getByRole('button', { name: 'New timer' }).click()
  await sheet(page).getByRole('button', { name: 'Rice', exact: true }).click()
  await sheet(page)
    .getByRole('switch', { name: /Save as preset/ })
    .click()
  await sheet(page).getByRole('button', { name: '12', exact: true }).click()

  await page.getByRole('button', { name: 'New timer' }).click()
  await sheet(page)
    .getByRole('button', { name: /Rice\s*12 min/ })
    .click()
  await expect(card(page, 'Rice')).toHaveCount(2)

  await page.getByRole('button', { name: 'New timer' }).click()
  await sheet(page).getByRole('button', { name: 'Edit', exact: true }).click()
  await sheet(page).getByRole('button', { name: 'Delete preset Rice' }).click()
  await expect(sheet(page).getByText(/Presets ·/)).toBeHidden()
})
