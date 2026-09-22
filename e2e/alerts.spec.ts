import { expect, test } from '@playwright/test'
import { around, card, clockNear, controlClock, MIN, pass, seed, sheet } from './helpers'

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

  await flip.getByRole('button', { name: 'Done, Potatoes, resume' }).click()
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
