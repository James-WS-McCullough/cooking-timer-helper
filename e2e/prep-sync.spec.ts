import { expect, test } from '@playwright/test'
import { card, clockNear, controlClock, MIN, pass, prepTimer, seed, sheet } from './helpers'

test('a prepped timer waits; while prepping, the dock puts Prep first', async ({ page }) => {
  await controlClock(page)
  await page.goto('/')
  await prepTimer(page, 'Potatoes', 20)
  await expect(card(page, 'Potatoes')).toContainText('Ready to start')
  await pass(page, 5 * MIN)
  await expect(card(page, 'Potatoes').getByRole('timer')).toHaveText('20:00') // hasn't moved

  await expect(page.getByRole('button', { name: 'Prep another' })).toBeVisible()
  await page.getByRole('button', { name: 'Quick timer that starts now' }).click()
  await expect(sheet(page).getByText('Prep for later')).toBeHidden() // the ordinary wizard
  await sheet(page).getByRole('button', { name: 'Close' }).click()

  await card(page, 'Potatoes').getByRole('button', { name: 'Start' }).click()
  await pass(page, MIN)
  await expect(card(page, 'Potatoes').getByRole('timer')).toHaveText(clockNear('19:00'))
  await expect(page.getByRole('button', { name: 'New timer' })).toBeVisible() // prepping is over
})

test('Sync Finish: plan, ready-at time, pre-timers, and Start when one comes due', async ({ page }) => {
  await controlClock(page, '2026-09-20T17:00:00')
  await seed(page, {
    timers: [
      { name: 'Veg', minutes: 8, prepped: true },
      { name: 'Roast', minutes: 40, prepped: true },
      { name: 'Chicken', minutes: 25, prepped: true },
    ],
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Sync Finish' }).click()
  const plan = sheet(page).getByRole('listitem')
  await expect(plan).toHaveText([/Roast.*Starts now/s, /Chicken.*in 15 min/s, /Veg.*in 32 min/s])
  await expect(sheet(page)).toContainText(/All ready at about 5:40/)

  await sheet(page).getByRole('button', { name: 'Sync Up & Start!' }).click()
  await expect(card(page, 'Roast').getByRole('timer')).toHaveText(clockNear('40:00'))
  await expect(card(page, 'Chicken')).toContainText('Start in')
  await expect(page.getByRole('button', { name: 'Sync Finish' })).toBeHidden()

  await pass(page, 15 * MIN)
  const due = card(page, 'Start Chicken')
  await expect(due).toBeVisible()
  await pass(page, 2 * MIN) // nothing starts until the cook says it's on
  await due.getByRole('button', { name: 'Start Chicken', exact: true }).click()
  await expect(card(page, 'Chicken').getByRole('timer')).toHaveText(clockNear('25:00'))
})

test('the Sync Finish list shows four, then "...and so on", but syncs them all', async ({ page }) => {
  const names = ['Roast', 'Potatoes', 'Carrots', 'Stuffing', 'Peas', 'Gravy']
  await seed(page, { timers: names.map((name, i) => ({ name, minutes: 60 - i * 10, prepped: true })) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Sync Finish' }).click()
  await expect(sheet(page).getByRole('listitem')).toHaveCount(5)
  await expect(sheet(page).getByRole('listitem').last()).toHaveText('...and so on.')

  await sheet(page).getByRole('button', { name: 'Sync Up & Start!' }).click()
  await expect(page.locator('.card.is-waiting')).toHaveCount(5)
  await expect(page.locator('.card.is-running')).toHaveCount(1)
})

test('Pause all freezes pre-timers too, so a synced meal shifts as one', async ({ page }) => {
  await controlClock(page)
  await seed(page, {
    timers: [
      { name: 'Roast', minutes: 40, prepped: true },
      { name: 'Veg', minutes: 10, prepped: true },
    ],
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Sync Finish' }).click()
  await sheet(page).getByRole('button', { name: 'Sync Up & Start!' }).click()
  await pass(page, 10 * MIN)

  await page.getByRole('button', { name: 'Pause all' }).click()
  await pass(page, 15 * MIN)
  await expect(card(page, 'Veg').getByRole('timer')).toContainText(clockNear('20:00'))
  await expect(card(page, 'Roast').getByRole('timer')).toHaveText(clockNear('30:00'))

  await page.getByRole('button', { name: 'Resume all' }).click()
  await pass(page, 20 * MIN)
  await expect(card(page, 'Start Veg')).toBeVisible()
  await expect(card(page, 'Roast').getByRole('timer')).toHaveText(clockNear('10:00')) // Veg's 10 min lands with it
})
