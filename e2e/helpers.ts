import { expect, type Locator, type Page } from '@playwright/test'

declare global {
  interface Window {
    __played: number[] // durations of the sound effects the app has started (see recordSounds)
  }
}

export const MIN = 60_000

const NO_ALERTS = { kind: 'none', everyMs: 0, label: 'Flip', pause: false }

interface SeedTimer {
  name: string
  minutes: number
  prepped?: boolean
}

/** Put timers/presets in storage before the app loads. Timers start "now" (page clock). */
export async function seed(page: Page, data: { timers?: SeedTimer[]; presets?: { name: string; minutes: number }[] }) {
  await page.addInitScript(
    ({ data, NO_ALERTS, MIN }) => {
      if (localStorage.getItem('sizzle:v1')) return // keep what the test has done since (reloads)
      const now = Date.now()
      const timers = (data.timers ?? []).map((t, i) => ({
        id: `seed-${i}`,
        name: t.name,
        durationMs: t.minutes * MIN,
        plan: NO_ALERTS,
        alerts: [],
        elapsedMs: 0,
        runningSince: t.prepped ? null : now,
        pausedBy: t.prepped ? 'user' : null,
        finishedAt: null,
        createdAt: now + i,
        prepped: !!t.prepped,
      }))
      const presets = (data.presets ?? []).map((p, i) => ({
        id: `preset-${i}`,
        name: p.name,
        durationMs: p.minutes * MIN,
        plan: NO_ALERTS,
      }))
      localStorage.setItem('sizzle:v1', JSON.stringify({ timers, presets }))
    },
    { data, NO_ALERTS, MIN },
  )
}

/** Freeze "now" at a known moment and take control of time. Call before goto. */
export async function controlClock(page: Page, at = '2026-09-20T17:00:00') {
  await page.clock.install({ time: new Date(at) })
}

/**
 * A pattern for a clock reading that allows for the few real seconds a test spends
 * clicking: the page clock keeps flowing (freezing it would also freeze the app's
 * animations), so "10:00" may honestly read 9:57 by the time it's checked.
 */
export function around(clock: string, slackSeconds = 12): string {
  const parts = clock.split(':').map(Number)
  const total = parts.reduce((acc, n) => acc * 60 + n, 0)
  const fmt = (t: number) => {
    const h = Math.floor(t / 3600)
    const m = Math.floor((t % 3600) / 60)
    const ss = String(t % 60).padStart(2, '0')
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
  }
  const options = Array.from({ length: slackSeconds + 1 }, (_, i) => fmt(Math.max(0, total - i)))
  return `(?:${[...new Set(options)].join('|')})`
}

export const clockNear = (clock: string) => new RegExp(`(?<![\\d:])${around(clock)}(?!\\d)`)

/** Let `ms` of app time pass, firing every tick on the way (so alerts and reminders happen in order). */
export async function pass(page: Page, ms: number) {
  await page.clock.runFor(ms)
}

/** Records the sound effects the app actually plays, by name. Call before goto. */
export async function recordSounds(page: Page) {
  await page.addInitScript(() => {
    const played: number[] = []
    window.__played = played
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      played.push(Number(this.buffer?.duration.toFixed(2)))
      return start.apply(this, args)
    }
  })
  let names: Record<string, string> | undefined
  return async function sounds(): Promise<string[]> {
    names ??= await page.evaluate(async () => {
      const ctx = new OfflineAudioContext(1, 1, 44100)
      const out: Record<string, string> = {}
      for (const file of ['Beep', 'Timer Start', 'Timer Complete', 'Notify']) {
        const data = await (await fetch(`${document.baseURI}${encodeURIComponent(file)}.mp3`)).arrayBuffer()
        out[(await ctx.decodeAudioData(data)).duration.toFixed(2)] = file
      }
      return out
    })
    const known = names
    const durations = await page.evaluate(() => window.__played.splice(0))
    return durations.map((d) => known[d.toFixed(2)] ?? `unknown(${d})`)
  }
}

export const card = (page: Page, text: string | RegExp): Locator => page.locator('.card', { hasText: text })
export const sheet = (page: Page): Locator => page.getByRole('dialog')

/** New timer → name chip → time tile. The three-tap happy path. */
export async function startTimer(page: Page, name: string, minutes: number) {
  await page.getByRole('button', { name: 'New timer' }).click()
  await sheet(page).getByRole('button', { name, exact: true }).click()
  await sheet(page)
    .getByRole('button', { name: String(minutes), exact: true })
    .click()
  await expect(sheet(page)).toBeHidden()
}

/** Prep a timer from wherever the app currently offers it. */
export async function prepTimer(page: Page, name: string, minutes: number) {
  await page.getByRole('button', { name: /^Prep( a timer| another)?$/ }).click()
  await expect(sheet(page).getByText('Prep for later')).toBeVisible()
  await sheet(page).getByRole('button', { name, exact: true }).click()
  await sheet(page)
    .getByRole('button', { name: String(minutes), exact: true })
    .click()
  await expect(sheet(page)).toBeHidden()
}
