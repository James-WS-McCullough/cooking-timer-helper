import { expect, type Page, test } from '@playwright/test'
import { clockNear } from './helpers'

// A pretend microphone (Chrome's built-in one, no permission prompt) and a pretend speech
// model: the real worker is swapped for one that "hears" whatever the test says, so
// nothing is downloaded and Hugging Face is never contacted.
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'],
})

const fetched: string[] = []

async function hears(page: Page, transcript: string | Error) {
  const reply =
    transcript instanceof Error
      ? `postMessage({ type: 'error', message: ${JSON.stringify(transcript.message)} })`
      : `data.type === 'load' ? postMessage({ type: 'ready' }) : postMessage({ type: 'text', id: data.id, text: ${JSON.stringify(transcript)} })`
  // On the context: a page-level route doesn't see a worker's own script.
  await page
    .context()
    .route(/transcriber\.worker-.*\.js/, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: `onmessage = ({ data }) => ${reply}` }),
    )
}

/** Tap the mic, get past its introduction if it's the first time, and say the line. */
async function say(page: Page) {
  await page.getByRole('button', { name: 'Say a timer' }).click()
  const sheet = page.getByRole('dialog')
  const intro = sheet.getByRole('button', { name: 'Turn on the mic' })
  await expect(intro.or(sheet.getByRole('status'))).toBeVisible() // the sheet is loaded on demand
  if (await intro.isVisible()) await intro.click()
  await expect(sheet.getByRole('status')).toHaveText('Listening…')
  await sheet.getByRole('button', { name: 'Done' }).click()
  return sheet
}

test.beforeEach(async ({ page }) => {
  fetched.length = 0
  await page.context().route(/huggingface\.co|hf\.co/, (route) => route.abort())
  page.on('request', (r) => {
    if (/huggingface|hf\.co|\/listen\/|transcriber\.worker/.test(r.url())) fetched.push(r.url())
  })
  await page.goto('/')
})

test('the mic introduces itself first, and downloads nothing until asked', async ({ page }) => {
  await page.getByRole('button', { name: 'Say a timer' }).click()
  const intro = page.getByRole('dialog', { name: 'Say it instead' })
  await expect(intro).toContainText('90 MB')
  await expect(intro).toContainText('never leaves this device')
  await intro.getByRole('button', { name: 'Not now' }).click()
  await expect(intro).toBeHidden()
  expect(fetched).toEqual([])
})

test('saying a food and a time offers that timer, and one tap starts it', async ({ page }) => {
  await hears(page, 'Rice ten minutes.')
  const sheet = await say(page)
  await expect(sheet.getByRole('heading', { name: 'Rice' })).toBeVisible()
  await expect(sheet).toContainText('I heard “Rice ten minutes.”')
  await sheet.getByRole('button', { name: 'Start 10:00' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.locator('.card')).toContainText('Rice')
  await expect(page.locator('.card')).toContainText(clockNear('10:00'))

  // Second time round the mic is in the dock, and there's no introduction.
  await page.getByRole('button', { name: 'Say a timer' }).click()
  await expect(sheet.getByRole('status')).toHaveText('Listening…')
  await sheet.getByRole('button', { name: 'Done' }).click()
  await sheet.getByRole('button', { name: 'Start 10:00' }).click()
  await expect(page.locator('.card')).toHaveCount(2)
})

test('"prep" makes it a prepped timer', async ({ page }) => {
  await hears(page, 'Prep roast potatoes 45 minutes.')
  const sheet = await say(page)
  await expect(sheet.getByRole('heading', { name: 'Roast potatoes' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Prep 45:00' }).click()
  const card = page.locator('.card')
  await expect(card).toContainText('Roast potatoes')
  await expect(card.getByRole('button', { name: /Start/ })).toBeVisible() // waiting for its play button
})

test('a name without a time carries on in the wizard at "How long?"', async ({ page }) => {
  await hears(page, 'Sausages.')
  await say(page)
  const wizard = page.getByRole('dialog', { name: 'How long?' })
  await expect(wizard).toContainText('Sausages')
  await wizard.getByRole('button', { name: '8', exact: true }).click()
  await expect(page.locator('.card')).toContainText('Sausages')
  await expect(page.locator('.card')).toContainText(clockNear('8:00'))
})

test("nothing usable: it says so and offers another go; the wrong guess isn't started", async ({ page }) => {
  await hears(page, 'Um.')
  const sheet = await say(page)
  await expect(sheet.getByRole('heading', { name: "Didn't catch that" })).toBeVisible()
  await expect(sheet).toContainText('I heard “Um.”')
  await sheet.getByRole('button', { name: 'Try again' }).click()
  await expect(sheet.getByRole('status')).toHaveText('Listening…')
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('.card')).toHaveCount(0)
})

test('a saved recipe by name preps the whole chain', async ({ page }) => {
  await page.addInitScript(() => {
    const step = {
      id: 's1',
      kind: 'timer',
      name: 'Veg',
      durationMs: 300_000,
      plan: { kind: 'none', everyMs: 0, label: 'Flip', pause: false },
      after: [],
    }
    const note = { id: 's2', kind: 'note', text: 'Serve', after: ['s1'] }
    localStorage.setItem(
      'sizzle:v1',
      JSON.stringify({
        version: 3,
        timers: [],
        notes: [],
        runs: [],
        presets: [],
        history: {},
        recipes: [{ id: 'r', name: 'Stir fry', steps: [step, note] }],
      }),
    )
  })
  await page.reload()
  await hears(page, 'Prep the stir fry.')
  const sheet = await say(page)
  await expect(sheet).toBeHidden()
  await expect(page.locator('.card')).toContainText('Veg')
  await expect(page.locator('.card')).toContainText('Ready to start')
})

test("if the speech model can't be loaded it says so", async ({ page }) => {
  await hears(page, new Error('offline'))
  await page.getByRole('button', { name: 'Say a timer' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Turn on the mic' }).click()
  await expect(sheet.getByRole('heading', { name: "Couldn't load the speech model" })).toBeVisible()
  await expect(page.locator('.card')).toHaveCount(0)
})
