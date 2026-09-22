import { reactive, watch } from 'vue'
import { announce } from './lib/announce'
import { installAudio, play, soundReady } from './lib/audio'
import { formatDuration, tidyName } from './lib/format'
import { rememberTime } from './lib/history'
import { type Preset, parseSaved, STORAGE_KEY, serialise } from './lib/storage'
import {
  type AlertPlan,
  acknowledge,
  addTime,
  advance,
  createTimer,
  isPending,
  pause,
  pauseAll,
  resume,
  resumeAll,
  setPlan,
  statusOf,
  syncFinish,
  type Timer,
  type TimerEvent,
  uid,
} from './lib/timer'
import { rehearse, say } from './lib/voice'
import { alertPhrase, duePhrase, finishedPhrase, startedPhrase, syncedPhrase, waitingPhrase } from './lib/voice/phrases'
import { installWakeLock, setWakeLock } from './lib/wakeLock'

export type { Preset } from './lib/storage'

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null // private mode, or storage blocked
  }
}

const saved = parseSaved(readStorage())

export const state = reactive({
  timers: saved.timers,
  presets: saved.presets,
  history: saved.history,
  now: Date.now(),
  // Bumped each time the attention sound plays, so pending cards can shimmer along with it.
  pulse: 0,
})

// One shared reminder for everything waiting on the cook, however many cards that is.
const NOTIFY_EVERY_MS = 15_000
let nextNotifyAt = 0

// The robot speaks after the sound effect that announces the same thing, not over it,
// and repeats herself far less often than the chime does.
const SPEAK_AFTER_SFX_MS = 1900
const SPOKEN_REMINDER_EVERY = 4 // reminders, i.e. once a minute
let remindersSinceSpoken = 0

// She picks her lines at random, so a timer's big lines are chosen when it's created:
// that way they can be synthesised in advance and are instant when the moment comes.
type Moment = 'finished' | 'due'
const chosen = new Map<string, Partial<Record<Moment, string>>>()

function lineFor(t: Timer, moment: Moment): string {
  const lines = chosen.get(t.id) ?? {}
  lines[moment] ??= moment === 'finished' ? finishedPhrase(t) : duePhrase(t)
  chosen.set(t.id, lines)
  return lines[moment]
}

/** The timer's name as said to assistive tech: the card's own title. */
const titleOf = (t: Timer) => t.name || `${formatDuration(t.durationMs)} timer`

function tell(t: Timer, event: TimerEvent): void {
  if (event === 'finished') announce(`${titleOf(t)} is ready`, true)
  else if (event === 'due') announce(`Start ${titleOf(t)} now`, true)
  else announce(`${t.alerts.find((a) => a.state === 'firing')?.label ?? t.plan.label} ${titleOf(t)}`, true)
}

function announceByVoice(t: Timer, event: TimerEvent): void {
  if (event === 'alert') {
    say(alertPhrase(t, t.alerts.find((a) => a.state === 'firing')?.label ?? t.plan.label), SPEAK_AFTER_SFX_MS, 'urgent')
    return
  }
  say(lineFor(t, event), SPEAK_AFTER_SFX_MS, 'urgent')
  delete chosen.get(t.id)?.[event] // said; if it comes round again (+30s), she'll say something new
}

/**
 * Advance the world. The cards show whole seconds, so that's how often they're told the
 * time: the 250ms interval still catches alerts promptly, but eight cards re-laying out
 * four times a second was most of the app's idle cost. An action that has just changed a
 * timer passes `publish`, so its card reads the time the change was made against.
 */
function tick(publish = false): void {
  const now = Date.now()
  if (publish || Math.floor(now / 1000) !== Math.floor(state.now / 1000)) state.now = now

  let arrived: TimerEvent | null = null
  for (const t of state.timers) {
    const event = advance(t, now)
    if (event) {
      tell(t, event)
      announceByVoice(t, event)
    }
    if (event === 'finished' || (event && !arrived)) arrived = event
  }

  // A finish announces itself once; a new flip, a dish due to go on, and every reminder after use Notify.
  const remind = !arrived && now >= nextNotifyAt && state.timers.some(isPending)
  if (arrived || remind) {
    void play(arrived === 'finished' ? 'complete' : 'notify')
    nextNotifyAt = now + NOTIFY_EVERY_MS
    state.pulse++
    if (arrived) remindersSinceSpoken = 0
    else if (++remindersSinceSpoken >= SPOKEN_REMINDER_EVERY) {
      remindersSinceSpoken = 0
      const pending = state.timers.filter(isPending)
      announce(`Still waiting: ${pending.map(titleOf).join(', ')}`)
      say(waitingPhrase(pending.map((t) => t.name)), SPEAK_AFTER_SFX_MS)
    }
  }

  // Anything counting down or waiting on the cook keeps the screen awake.
  setWakeLock(state.timers.some((t) => !['paused', 'prepped'].includes(statusOf(t))))
}

/** Add a timer. Prepped ones just wait in the list until their play button is pressed. */
export function startTimer(name: string, durationMs: number, plan: AlertPlan, prepped = false): void {
  const timer = createTimer(tidyName(name), durationMs, plan, Date.now(), prepped)
  state.timers.push(timer)
  rehearse(lineFor(timer, 'finished'))
  if (!prepped) say(startedPhrase(timer), SPEAK_AFTER_SFX_MS)
  rememberTime(state.history, name, durationMs)
  announce(`${titleOf(timer)}, ${formatDuration(durationMs)}, ${prepped ? 'prepped' : 'started'}`)
  void play(prepped ? 'beep' : 'start', true)
  tick(true)
}

export function startPreset(preset: Preset, prepped = false): void {
  startTimer(preset.name, preset.durationMs, preset.plan, prepped)
}

export function pauseEverything(): void {
  pauseAll(state.timers, Date.now())
  announce('All timers paused')
  void play('beep', true)
  tick(true)
}

export function resumeEverything(): void {
  resumeAll(state.timers, Date.now())
  announce('All timers resumed')
  void play('start', true)
  tick(true)
}

/** Sync Finish: longest prepped timer starts now, the rest get pre-timers so everything lands together. */
export function syncAndStart(): void {
  syncFinish(state.timers, Date.now())
  for (const t of state.timers) if (t.startAt != null) rehearse(lineFor(t, 'due'))
  say(
    syncedPhrase(Math.max(0, ...state.timers.filter((t) => !t.prepped || t.startAt != null).map((t) => t.durationMs))),
    SPEAK_AFTER_SFX_MS,
  )
  void play('start', true)
  tick(true)
}

export function savePreset(name: string, durationMs: number, plan: AlertPlan): void {
  state.presets.push({ id: uid(), name: tidyName(name), durationMs, plan: { ...plan } })
}

/** Save, or update the preset with the same name and time (e.g. after adding alerts from the bell). */
export function upsertPreset(name: string, durationMs: number, plan: AlertPlan): void {
  const key = tidyName(name).toLowerCase()
  const existing = state.presets.find((p) => p.name.toLowerCase() === key && p.durationMs === durationMs)
  if (existing) existing.plan = { ...plan }
  else savePreset(name, durationMs, plan)
}

export function removePreset(id: string): void {
  state.presets = state.presets.filter((p) => p.id !== id)
}

export function removeTimer(id: string): void {
  chosen.delete(id)
  state.timers = state.timers.filter((t) => t.id !== id)
  tick(true)
}

function withTimer(id: string, fn: (t: Timer, now: number) => void): void {
  const t = state.timers.find((x) => x.id === id)
  if (!t) return
  fn(t, Date.now())
  tick(true)
}

/** "Done" on a flip: back to cooking. If the alert was holding the clock, it starts counting again. */
export const acknowledgeTimer = (id: string) =>
  withTimer(id, (t, now) => {
    acknowledge(t, now)
    void play('start', true)
  })

/** "Done" on a finished timer. Same confirming sound as any other Done, then the card goes. */
export function completeTimer(id: string): void {
  void play('start', true)
  removeTimer(id)
}

export const pauseTimer = (id: string) =>
  withTimer(id, (t, now) => {
    pause(t, now)
    void play('beep', true)
  })

/** Play button: un-pauses a timer, or sets a prepped one going for the first time. */
export const resumeTimer = (id: string) =>
  withTimer(id, (t, now) => {
    const firstStart = t.prepped
    resume(t, now)
    void play(firstStart ? 'start' : 'beep', true)
    if (firstStart) say(startedPhrase(t), SPEAK_AFTER_SFX_MS)
  })

export const setTimerPlan = (id: string, plan: AlertPlan) =>
  withTimer(id, (t, now) => {
    setPlan(t, plan, now)
    if (plan.kind !== 'none') rehearse(alertPhrase(t, plan.label))
    void play('beep', true)
  })

export const extendTimer = (id: string, ms: number) =>
  withTimer(id, (t, now) => {
    const wasFinished = t.finishedAt !== null
    addTime(t, ms, now)
    if (wasFinished) void play('start', true)
  })

export function installStore(): void {
  installAudio()
  installWakeLock()

  // Sound just came on (first tap after reopening the app): don't make anything
  // already pending wait out the rest of a silent 15 seconds.
  watch(soundReady, (ready) => {
    if (!ready) return
    nextNotifyAt = 0
    if (state.timers.length) announce('Sound on') // the red banner has just gone
  })

  watch(
    () => [state.timers, state.presets, state.history],
    () => {
      try {
        const { timers, presets, history } = state
        localStorage.setItem(STORAGE_KEY, serialise({ timers, presets, history }))
      } catch {
        /* storage full or unavailable */
      }
    },
    { deep: true },
  )

  tick(true)
  setInterval(tick, 250)
  // Intervals are throttled in the background; catch up the instant we're visible again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick(true)
  })
}
