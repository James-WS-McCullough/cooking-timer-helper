import { expect, test } from '@playwright/test'
import { startTimer } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('the start screen offers New timer and Prep, and its corner buttons go once a timer exists', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Sizzle' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Prep a timer' })).toBeVisible()
  const qr = page.getByRole('button', { name: /QR code/ })
  await expect(qr).toBeVisible()
  await startTimer(page, 'Rice', 10)
  await expect(qr).toBeHidden()
  await expect(page.getByRole('button', { name: /Switch to (light|dark) mode/ })).toBeHidden()
  await expect(page.getByRole('switch', { name: /Sizzle's voice/ })).toBeHidden()
})

test('the robot introduces herself on the first tap, and downloads nothing until asked', async ({ page }) => {
  const fetched: string[] = []
  page.on('request', (r) => {
    if (/huggingface|hf\.co|\/voice\//.test(r.url())) fetched.push(r.url())
  })
  const voice = page.getByRole('switch', { name: /Sizzle's voice/ })
  await expect(voice).toHaveAttribute('aria-checked', 'false')
  await expect(page.locator('.voice .caption')).toHaveText('Voice off')
  await expect(page.locator('.voice svg.robot')).toHaveClass(/is-off/) // grey and dimmed

  await page.locator('.voice .caption').click() // the words beside her are part of the switch, not just her face
  const intro = page.getByRole('dialog', { name: 'Hello!' })
  await expect(intro).toContainText('I am Sizzle, and I can announce what timers are going off.')
  await expect(intro).toContainText('95 MB')
  await intro.getByRole('button', { name: 'Not now' }).click()
  await expect(intro).toBeHidden()
  await expect(voice).toHaveAttribute('aria-checked', 'false')
  expect(fetched).toEqual([])
})

test("if her voice can't be downloaded she says so and stays off", async ({ page }) => {
  await page.route(/huggingface\.co|hf\.co/, (route) => route.abort()) // also keeps the 63 MB model out of test runs
  const voice = page.getByRole('switch', { name: /Sizzle's voice/ })
  await voice.click()
  await page.getByRole('dialog', { name: 'Hello!' }).getByRole('button', { name: 'Enable voice' }).click()
  await expect(page.locator('.voice .caption')).toHaveText("Couldn't load my voice", { timeout: 30_000 })
  await expect(voice).toHaveAttribute('aria-checked', 'false')
  await expect(page.locator('.voice svg.robot')).toHaveClass(/is-off/)
})

test('while timers run, a gear opens the same utilities: voice, theme and QR', async ({ page }) => {
  const gear = page.getByRole('button', { name: 'Settings' })
  await expect(gear).toBeHidden() // the start screen has them as loose buttons instead
  await startTimer(page, 'Rice', 10)
  await startTimer(page, 'Pasta', 8)

  // It must never sit on a card's own buttons.
  const gearBox = await gear.boundingBox()
  const firstCard = await page.locator('.card').first().boundingBox()
  expect(gearBox && firstCard && gearBox.y + gearBox.height <= firstCard.y).toBe(true)

  await gear.click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await expect(settings.getByRole('switch', { name: /Sizzle's voice/ })).toHaveAttribute('aria-checked', 'false')
  await expect(settings.getByText(/Keep Sizzle open/)).toBeVisible() // a phone: it can't sound once locked

  await settings.getByRole('button', { name: /Switch to dark mode/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await settings.getByRole('button', { name: /Open on another device/ }).click()
  await expect(settings).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Open Sizzle on another device' })).toBeVisible()
})

test("the robot's introduction also works from Settings", async ({ page }) => {
  await startTimer(page, 'Rice', 10)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).getByText("Sizzle's voice").click() // anywhere on the row
  const intro = page.getByRole('dialog', { name: 'Hello!' })
  await expect(intro).toContainText('I am Sizzle')
  await intro.getByRole('button', { name: 'Not now' }).click()
  await expect(intro).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})

test('the theme toggle switches, and the choice survives a reload', async ({ page }) => {
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'light') // follows the (emulated) device at first
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
})

test('the QR button shows a code for this site under the logo', async ({ page }) => {
  await page.getByRole('button', { name: /QR code/ }).click()
  const panel = page.getByRole('dialog', { name: 'Open Sizzle on another device' })
  await expect(panel.getByRole('img', { name: /QR code for http:\/\/localhost/ })).toBeVisible()
  await panel.getByRole('button', { name: 'Close' }).click()
  await expect(panel).toBeHidden()
})

test.describe('with a mouse', () => {
  test.use({ isMobile: false, hasTouch: false })

  test("Settings doesn't ask a desktop to keep Sizzle open", async ({ page }) => {
    await startTimer(page, 'Rice', 10)
    await page.getByRole('button', { name: 'Settings' }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expect(settings.getByRole('button', { name: /Open on another device/ })).toBeVisible()
    await expect(settings.getByText(/Keep Sizzle open/)).toBeHidden()
  })
})

test('Settings: alarms cut in by default; "over music" is a switch that sticks', async ({ page }) => {
  await startTimer(page, 'Rice', 10)
  await page.getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const over = settings.getByRole('switch', { name: 'Alarms over music' })
  await expect(over).toHaveAttribute('aria-checked', 'false')
  await expect(settings).toContainText('alarms cut in and always sound')
  await over.click()
  await expect(over).toHaveAttribute('aria-checked', 'true')
  await expect(settings).toContainText('Silent switch silences alarms too')
  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('switch', { name: 'Alarms over music' })).toHaveAttribute('aria-checked', 'true')
})
