import { expect, test } from '@playwright/test'
import { around, card, clockNear, controlClock, MIN, pass, recordSounds, seed, sheet } from './helpers'

test.beforeEach(async ({ page }) => {
  await controlClock(page)
  await seed(page, { timers: [{ name: 'Potatoes', minutes: 20 }] })
  await page.goto('/')
})

test('the bell adds a halfway flip that holds the clock until confirmed', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a flip or stir alert to Potatoes' }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Alerts along the way?' })).toBeVisible()
  await sheet(page)
    .getByRole('button', { name: /^Halfway/ })
    .click()
  await expect(sheet(page).getByRole('switch', { name: /Hold timer/ })).toBeChecked() // the oven default
  await sheet(page).getByRole('button', { name: 'Set alert' }).click()
  await expect(card(page, 'Potatoes')).toContainText(new RegExp(`Flip in ${around('10:00')}`))

  await pass(page, 10 * MIN)
  const flip = card(page, 'Flip Potatoes')
  await expect(flip).toBeVisible()
  await pass(page, 2 * MIN)
  await expect(flip).toContainText('10:00 left') // held at exactly halfway, not draining

  // Done quietens the alarm but keeps the clock held; Continue sets it going again.
  await flip.getByRole('button', { name: 'Done, Potatoes' }).click()
  const held = card(page, 'Potatoes')
  await expect(held).toContainText('Held after the flip')
  await pass(page, 2 * MIN)
  await expect(held.getByRole('timer')).toHaveText('10:00') // still held, and no longer nagging
  await held.getByRole('button', { name: 'Continue Potatoes' }).click()
  await pass(page, MIN)
  await expect(card(page, 'Potatoes').getByRole('timer')).toHaveText(clockNear('9:00'))
})

test('a repeating alert keeps counting, and must fit inside the timer', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a flip or stir alert to Potatoes' }).click()
  await sheet(page)
    .getByRole('button', { name: /^Every/ })
    .click()
  const custom = sheet(page).getByRole('textbox', { name: 'Custom interval in minutes' })
  await custom.fill('25')
  await expect(sheet(page).getByRole('alert')).toContainText('shorter than the 20 min timer')
  await expect(sheet(page).getByRole('button', { name: 'Set alert' })).toBeDisabled()

  await custom.fill('')
  await sheet(page).getByRole('button', { name: '5', exact: true }).click()
  await sheet(page).getByRole('button', { name: 'Stir', exact: true }).click()
  await sheet(page).getByRole('button', { name: 'Set alert' }).click()
  await expect(card(page, 'Potatoes')).toContainText(new RegExp(`Stir in ${around('5:00')}`))

  await pass(page, 5 * MIN + 30_000)
  await expect(card(page, 'Stir Potatoes')).toContainText(new RegExp(`${around('14:30')} left`)) // not held
  await card(page, 'Stir Potatoes').getByRole('button', { name: 'Done, Potatoes', exact: true }).click()
  await expect(card(page, 'Potatoes')).toContainText(new RegExp(`Stir in ${around('4:30')}`))
})

test('None removes the alerts again', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a flip or stir alert to Potatoes' }).click()
  await sheet(page)
    .getByRole('button', { name: /^Halfway/ })
    .click()
  await sheet(page).getByRole('button', { name: 'Set alert' }).click()
  await page.getByRole('button', { name: 'Change alerts for Potatoes' }).click()
  await sheet(page).getByRole('button', { name: /^None/ }).click()
  await expect(card(page, 'Potatoes')).toContainText('of 20 min')
  await expect(page.getByRole('button', { name: 'Add a flip or stir alert to Potatoes' })).toBeVisible()
})

test('once a holding flip is seen, the 15-second reminders stop', async ({ page }) => {
  // (recordSounds has to be installed before the page loads: a fresh page here.)
  const sounds = await recordSounds(page)
  await page.goto('/')
  await page.getByRole('button', { name: /Tap to turn sound on/ }).click()
  await page.getByRole('button', { name: 'Add a flip or stir alert to Potatoes' }).click()
  await sheet(page)
    .getByRole('button', { name: /^Halfway/ })
    .click()
  await sheet(page).getByRole('button', { name: 'Set alert' }).click()
  await expect(card(page, 'Potatoes')).toContainText(/Flip in/)
  await pass(page, 1000)
  await sounds() // the taps' beeps, drained
  await pass(page, 10 * MIN + 1000)
  expect(await sounds()).toEqual(['Notify'])
  await pass(page, 16_000)
  expect(await sounds()).toEqual(['Notify']) // the reminder
  await card(page, 'Flip Potatoes').getByRole('button', { name: 'Done, Potatoes' }).click()
  await sounds()
  await pass(page, 40_000)
  expect(await sounds()).toEqual([]) // seen: quiet, though still held
  await card(page, 'Potatoes').getByRole('button', { name: 'Continue Potatoes' }).click()
  expect(await sounds()).toEqual(['Timer Start'])
})
