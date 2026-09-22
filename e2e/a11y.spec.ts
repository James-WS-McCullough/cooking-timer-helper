import { expect, type Locator, test } from '@playwright/test'
import { card, controlClock, MIN, pass, seed, sheet, startTimer } from './helpers'

// What a keyboard or screen-reader user gets: focus goes into a dialog, stays there, comes
// back out to the opener; the page behind is inert; and the things that matter are announced.

/** Unreachable by keyboard or assistive tech: it, or something above it, is inert. */
const blocked = (el: Locator) => el.evaluate((node) => node.closest('[inert]') !== null)

test('opening a sheet moves focus in, Tab wraps, Escape closes it and focus returns to the opener', async ({
  page,
}) => {
  await page.goto('/')
  const opener = page.getByRole('button', { name: 'New timer' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = sheet(page)
  await expect(dialog).toBeVisible()
  await expect(dialog).toBeFocused() // the dialog itself, so its title is read and no keyboard pops up
  expect(await blocked(opener)).toBe(true) // the page behind can't be reached
  await page.keyboard.press('Shift+Tab')
  expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true) // wrapped, still inside
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  expect(await blocked(opener)).toBe(false)
})

test('Escape closes only the topmost dialog', async ({ page }) => {
  await page.goto('/')
  await startTimer(page, 'Rice', 10)
  await page.getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.getByRole('switch', { name: /Sizzle's voice/ }).click()
  const intro = page.getByRole('dialog', { name: 'Hello!' })
  await expect(intro).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(intro).toBeHidden()
  await expect(settings).toBeVisible()
  await expect(settings.getByRole('switch', { name: /Sizzle's voice/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(settings).toBeHidden()
})

test('the remove confirm takes focus, backs out on Escape, and blocks the buttons under it', async ({ page }) => {
  await seed(page, { timers: [{ name: 'Rice', minutes: 10 }] })
  await page.goto('/')
  const remove = page.getByRole('button', { name: 'Remove Rice' })
  await remove.focus()
  await page.keyboard.press('Enter')
  const confirm = page.getByRole('alertdialog', { name: 'Remove Rice?' })
  await expect(confirm.getByRole('button', { name: 'Remove Rice' })).toBeFocused()
  expect(await blocked(card(page, 'Rice').getByRole('button', { name: '30 seconds more' }))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(confirm).toBeHidden()
  await expect(remove).toBeFocused()
  expect(await blocked(card(page, 'Rice').getByRole('button', { name: '30 seconds more' }))).toBe(false)
})

test('every card button names its dish, and the countdown is never read aloud', async ({ page }) => {
  await seed(page, {
    timers: [
      { name: 'Rice', minutes: 10 },
      { name: 'Pasta', minutes: 8 },
    ],
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '30 seconds more for Rice' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause Pasta' })).toBeVisible()
  await expect(card(page, 'Rice').getByRole('timer')).toHaveAttribute('aria-live', 'off')
})

test('a finished dish and a flip are announced to assistive tech; so are starting, pausing and sound', async ({
  page,
}) => {
  await controlClock(page)
  await page.goto('/')
  const polite = page.locator('.sr-only[role="status"]')
  const urgent = page.locator('.sr-only[role="alert"]')
  await startTimer(page, 'Eggs', 6)
  await expect(polite).toHaveText('Eggs, 6 min, started')
  await startTimer(page, 'Rice', 10)
  await page.getByRole('button', { name: 'Pause all' }).click()
  await expect(polite).toHaveText('All timers paused')
  await page.getByRole('button', { name: 'Resume all' }).click()
  await expect(polite).toHaveText('All timers resumed')
  await pass(page, 6 * MIN + 500)
  await expect(urgent).toHaveText('Eggs is ready')
  await card(page, 'Eggs ready').getByRole('button', { name: 'Done' }).click()
  await expect(card(page, 'Eggs')).toHaveCount(0)
})

test('a flip is announced, and "sound on" after a reload', async ({ page }) => {
  await controlClock(page)
  await seed(page, { timers: [{ name: 'Rice', minutes: 10 }] })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Tap to turn sound on' })).toBeVisible()
  await page.getByRole('button', { name: 'Tap to turn sound on' }).click()
  await expect(page.locator('.sr-only[role="status"]')).toHaveText('Sound on')
  await card(page, 'Rice')
    .getByRole('button', { name: /alert to Rice/ })
    .click()
  await sheet(page)
    .getByRole('button', { name: /Halfway/ })
    .click()
  await sheet(page).getByRole('button', { name: 'Set alert' }).click()
  await pass(page, 5 * MIN + 500)
  await expect(page.locator('.sr-only[role="alert"]')).toHaveText('Flip Rice')
})
