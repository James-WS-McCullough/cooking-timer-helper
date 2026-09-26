import { expect, test } from '@playwright/test'
import { seed, startTimer } from './helpers'

// Something to watch while cooking. The embed itself is stubbed: no network, no video.
test.beforeEach(async ({ page }) => {
  await page
    .context()
    .route(/youtube-nocookie\.com|player\.twitch\.tv/, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>stub</title><p>video</p>' }),
    )
})

test('a YouTube link from Settings puts the video above the cards, with the cards still usable; ✕ takes it away', async ({
  page,
}) => {
  await page.goto('/')
  await startTimer(page, 'Rice', 10)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Watch while you cook/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Watch while you cook' })
  const link = sheet.getByRole('textbox', { name: 'Link' })
  await link.fill('https://vimeo.com/1')
  await expect(sheet.getByRole('alert')).toContainText('Only YouTube and Twitch')
  await link.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1s')
  await sheet.getByRole('button', { name: 'Watch · YouTube' }).click()
  await expect(sheet).toBeHidden()

  const video = page.getByRole('region', { name: 'Watching: YouTube' })
  await expect(video).toBeVisible()
  await expect(video.locator('iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0',
  )
  await page.getByRole('button', { name: '30 seconds more for Rice' }).click() // the cards are still there to use
  await video.getByRole('button', { name: 'Stop watching' }).click()
  await expect(video).toBeHidden()

  // The link is remembered, and offered back next time.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Watch while you cook/ }).click()
  await sheet.getByRole('button', { name: 'Last time: YouTube' }).click()
  await expect(page.getByRole('region', { name: 'Watching: YouTube' })).toBeVisible()
})

test('a Twitch channel from the start screen, and the site tells Twitch who is embedding', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Watch while you cook' }).click()
  await page.getByRole('dialog').getByRole('textbox', { name: 'Link' }).fill('twitch.tv/somestreamer')
  await page.getByRole('button', { name: 'Watch · Twitch · somestreamer' }).click()
  const video = page.getByRole('region', { name: 'Watching: Twitch · somestreamer' })
  await expect(video.locator('iframe')).toHaveAttribute(
    'src',
    /player\.twitch\.tv\/\?channel=somestreamer&parent=localhost&autoplay=false/,
  )
  await expect(page.getByRole('button', { name: 'New timer' })).toBeVisible() // the start screen carries on beneath
})

test('on a wide screen the video sits beside the cards, not over them', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 })
  await seed(page, { timers: [{ name: 'Rice', minutes: 10 }] })
  await page.addInitScript(() => localStorage.setItem('sizzle:watch', 'https://youtu.be/dQw4w9WgXcQ'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Watch while you cook/ }).click()
  await page.getByRole('button', { name: 'Last time: YouTube' }).click()
  const video = await page.getByRole('region', { name: /Watching/ }).boundingBox()
  const card = await page.locator('.card').first().boundingBox()
  expect(video && card && card.x >= video.x + video.width).toBe(true)
})
