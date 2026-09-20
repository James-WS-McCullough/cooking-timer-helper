import { reactive, watch } from 'vue'
import {
  acknowledge,
  addTime,
  advance,
  createTimer,
  isPending,
  pause,
  resume,
  statusOf,
  uid,
  type AlertPlan,
  type Timer,
  type TimerEvent,
} from './lib/timer'
import { installAudio, play, soundReady } from './lib/audio'
import { installWakeLock, setWakeLock } from './lib/wakeLock'

export interface Preset {
  id: string
  name: string
  durationMs: number
  plan: AlertPlan
}

const STORAGE_KEY = 'sizzle:v1'

interface Saved {
  timers: Timer[]
  presets: Preset[]
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      return {
        timers: Array.isArray(data.timers) ? data.timers : [],
        presets: Array.isArray(data.presets) ? data.presets : [],
      }
    }
  } catch {
    /* private mode or corrupt data: start fresh */
  }
  return { timers: [], presets: [] }
}

export const state = reactive({
  ...load(),
  now: Date.now(),
  // Bumped each time the attention sound plays, so pending cards can shimmer along with it.
  pulse: 0,
})

// One shared reminder for everything waiting on the cook, however many cards that is.
const NOTIFY_EVERY_MS = 15_000
let nextNotifyAt = 0

function tick(): void {
  const now = Date.now()
  state.now = now

  let arrived: TimerEvent | null = null
  for (const t of state.timers) {
    const event = advance(t, now)
    if (event === 'finished' || (event && !arrived)) arrived = event
  }

  // A finish announces itself once; a new flip and every reminder after use Notify.
  const remind = !arrived && now >= nextNotifyAt && state.timers.some(isPending)
  if (arrived || remind) {
    void play(arrived === 'finished' ? 'complete' : 'notify')
    nextNotifyAt = now + NOTIFY_EVERY_MS
    state.pulse++
  }

  // Anything counting down or waiting on the cook keeps the screen awake.
  setWakeLock(state.timers.some((t) => statusOf(t) !== 'paused'))
}

export function startTimer(name: string, durationMs: number, plan: AlertPlan): void {
  state.timers.push(createTimer(name.trim(), durationMs, plan, Date.now()))
  void play('start', true)
  tick()
}

export function startPreset(preset: Preset): void {
  startTimer(preset.name, preset.durationMs, preset.plan)
}

export function savePreset(name: string, durationMs: number, plan: AlertPlan): void {
  state.presets.push({ id: uid(), name: name.trim(), durationMs, plan: { ...plan } })
}

export function removePreset(id: string): void {
  state.presets = state.presets.filter((p) => p.id !== id)
}

export function removeTimer(id: string): void {
  state.timers = state.timers.filter((t) => t.id !== id)
  tick()
}

function withTimer(id: string, fn: (t: Timer, now: number) => void): void {
  const t = state.timers.find((x) => x.id === id)
  if (!t) return
  fn(t, Date.now())
  tick()
}

/** "Done" on a flip. If the alert was holding the clock, it starts counting again. */
export const acknowledgeTimer = (id: string) =>
  withTimer(id, (t, now) => {
    const held = t.pausedBy === 'alert'
    acknowledge(t, now)
    if (held) void play('start', true)
  })

export const pauseTimer = (id: string) =>
  withTimer(id, (t, now) => {
    pause(t, now)
    void play('beep', true)
  })

export const resumeTimer = (id: string) =>
  withTimer(id, (t, now) => {
    resume(t, now)
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
    if (ready) nextNotifyAt = 0
  })

  watch(
    () => [state.timers, state.presets],
    () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ timers: state.timers, presets: state.presets }))
      } catch {
        /* storage full or unavailable */
      }
    },
    { deep: true },
  )

  tick()
  setInterval(tick, 250)
  // Intervals are throttled in the background; catch up the instant we're visible again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick()
  })
}
