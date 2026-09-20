import { expect, test } from '@playwright/test'
import { card, clockNear, controlClock, MIN, pass, recordSounds, seed } from './helpers'

test('+30s adds time; pause holds it; play carries on', async ({ page }) => {
  await controlClock(page)
  await seed(page, { timers: [{ name: 'Rice', minutes: 10 }] })
  await page.goto('/')
  const clock = card(page, 'Rice').getByRole('timer')
  await expect(clock).toHaveText(clockNear('10:00'))

  await card(page, 'Rice').getByRole('button', { name: '+30s' }).click()
  await expect(clock).toHaveText(clockNear('10:30'))
  await pass(page, MIN)
  await expect(clock).toHaveText(clockNear('9:30'))

  await card(page, 'Rice').getByRole('button', { name: 'Pause' }).click()
  const held = ((await clock.textContent()) ?? '').trim()
  await pass(page, MIN)
  await expect(clock).toHaveText(held) // exactly where it was

  await card(page, 'Rice').getByRole('button', { name: 'Resume' }).click()
  await pass(page, MIN / 2)
  await expect(clock).toHaveText(clockNear('9:00'))
})

test('timers survive a reload and keep counting', async ({ page }) => {
  await controlClock(page)
  await seed(page, { timers: [{ name: 'Pasta', minutes: 10 }] })
  await page.goto('/')
  await pass(page, 3 * MIN)
  await page.reload()
  await expect(card(page, 'Pasta').getByRole('timer')).toHaveText(clockNear('7:00'))
})

test('removing asks first, and a tap elsewhere backs out', async ({ page }) => {
  await seed(page, {
    timers: [
      { name: 'Rice', minutes: 10 },
      { name: 'Pasta', minutes: 8 },
    ],
  })
  await page.goto('/')
  const confirm = page.getByRole('alertdialog', { name: 'Remove Rice?' })

  await page.getByRole('button', { name: 'Remove Rice' }).click()
  await expect(confirm).toBeVisible()
  await page.mouse.click(200, 640) // empty page
  await expect(confirm).toBeHidden()
  await expect(card(page, 'Rice')).toBeVisible()

  await page.getByRole('button', { name: 'Remove Rice' }).click()
  await confirm.getByRole('button', { name: 'Remove' }).click()
  await expect(card(page, 'Rice')).toHaveCount(0)
  await expect(card(page, 'Pasta')).toBeVisible()
})

test('finishing: sounds once, reminds every 15s, and Done clears back to the start screen', async ({ page }) => {
  const sounds = await recordSounds(page)
  await controlClock(page)
  await seed(page, { timers: [{ name: 'Eggs', minutes: 1 }] })
  await page.goto('/')
  await page.getByRole('button', { name: /Tap to turn sound on/ }).click() // browsers need one tap before audio
  await sounds()

  await pass(page, MIN + 1000)
  await expect(card(page, 'Eggs ready')).toBeVisible()
  expect(await sounds()).toEqual(['Timer Complete'])
  await pass(page, 16_000)
  expect(await sounds()).toEqual(['Notify'])

  await card(page, 'Eggs ready').getByRole('button', { name: 'Done' }).click()
  await expect(card(page, 'Eggs')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Sizzle' })).toBeVisible()
  expect(await sounds()).toEqual(['Timer Start'])
})

test('Pause all stops everything together; Resume all restarts only what it stopped', async ({ page }) => {
  await controlClock(page)
  await seed(page, {
    timers: [
      { name: 'Rice', minutes: 10 },
      { name: 'Eggs', minutes: 6 },
      { name: 'Sauce', minutes: 20 },
    ],
  })
  await page.goto('/')
  await card(page, 'Sauce').getByRole('button', { name: 'Pause' }).click() // paused by hand
  await page.getByRole('button', { name: 'Pause all' }).click()
  await pass(page, 5 * MIN)
  await expect(card(page, 'Rice').getByRole('timer')).toHaveText(clockNear('10:00'))
  await expect(card(page, 'Eggs').getByRole('timer')).toHaveText(clockNear('6:00'))

  await page.getByRole('button', { name: 'Resume all' }).click()
  await pass(page, MIN)
  await expect(card(page, 'Rice').getByRole('timer')).toHaveText(clockNear('9:00'))
  await expect(card(page, 'Sauce').getByRole('timer')).toHaveText(clockNear('20:00')) // still paused: it wasn't Pause all's
  await expect(page.getByRole('button', { name: 'Pause all' })).toBeVisible()
})

test('Pause all is only offered once more than one thing is counting', async ({ page }) => {
  await seed(page, { timers: [{ name: 'Rice', minutes: 10 }] })
  await page.goto('/')
  await expect(card(page, 'Rice')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause all' })).toBeHidden()
})
