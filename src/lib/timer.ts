// Pure timer engine. Everything is derived from wall-clock timestamps rather
// than counted ticks, so timers stay correct through sleep, backgrounding and reloads.

export type AlertKind = 'none' | 'half' | 'every'

export interface AlertPlan {
  kind: AlertKind
  everyMs: number // only used when kind === 'every'
  label: string // "Flip", "Stir"…
  pause: boolean // hold the countdown until the alert is acknowledged
}

export interface TimerAlert {
  id: string
  atMs: number // cooking time elapsed when this fires
  label: string
  pause: boolean
  state: 'pending' | 'firing' | 'done'
  firedAt: number | null // wall-clock moment it went off
}

export interface Timer {
  id: string
  name: string
  durationMs: number
  plan: AlertPlan
  alerts: TimerAlert[]
  elapsedMs: number // cooking time banked before the current run
  runningSince: number | null // wall-clock of the last resume; null while stopped
  pausedBy: 'user' | 'alert' | null
  finishedAt: number | null
  createdAt: number
  prepped?: boolean // set up in advance, waiting for its first press of play
  // Sync Finish: a prepped timer with a pre-timer in front of it. When the wall
  // clock reaches startAt the cook is told to put it on, and confirms with Start.
  syncedAt?: number | null
  startAt?: number | null
  due?: boolean // pre-timer has run out; waiting for that confirmation
}

export type TimerStatus = 'prepped' | 'waiting' | 'due' | 'running' | 'paused' | 'alert' | 'finished'

export const NO_ALERTS: AlertPlan = { kind: 'none', everyMs: 0, label: 'Flip', pause: false }

let seq = 0
export function uid(): string {
  return `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function alertTimes(durationMs: number, plan: AlertPlan): number[] {
  if (plan.kind === 'half') return [Math.round(durationMs / 2)]
  if (plan.kind === 'every' && plan.everyMs > 0) {
    const times: number[] = []
    for (let at = plan.everyMs; at < durationMs; at += plan.everyMs) times.push(at)
    return times
  }
  return []
}

export function buildAlerts(durationMs: number, plan: AlertPlan): TimerAlert[] {
  return alertTimes(durationMs, plan).map((atMs) => ({
    id: uid(),
    atMs,
    label: plan.label,
    pause: plan.pause,
    state: 'pending',
    firedAt: null,
  }))
}

/** A prepped timer is fully set up but doesn't start counting until resume() is called on it. */
export function createTimer(name: string, durationMs: number, plan: AlertPlan, now: number, prepped = false): Timer {
  return {
    id: uid(),
    name,
    durationMs,
    plan: { ...plan },
    alerts: buildAlerts(durationMs, plan),
    elapsedMs: 0,
    runningSince: prepped ? null : now,
    pausedBy: prepped ? 'user' : null,
    finishedAt: null,
    createdAt: now,
    prepped,
  }
}

export function elapsedMs(t: Timer, now: number): number {
  const live = t.runningSince === null ? 0 : Math.max(0, now - t.runningSince)
  return Math.min(t.durationMs, t.elapsedMs + live)
}

export function remainingMs(t: Timer, now: number): number {
  return t.durationMs - elapsedMs(t, now)
}

export function firingAlert(t: Timer): TimerAlert | undefined {
  return t.alerts.find((a) => a.state === 'firing')
}

export function nextAlert(t: Timer): TimerAlert | undefined {
  return t.alerts.find((a) => a.state === 'pending')
}

export function statusOf(t: Timer): TimerStatus {
  if (t.prepped) return t.startAt == null ? 'prepped' : t.due ? 'due' : 'waiting'
  if (t.finishedAt !== null) return 'finished'
  if (firingAlert(t)) return 'alert'
  if (t.runningSince === null) return 'paused'
  return 'running'
}

/** Something new that needs the cook: a mid-way alert fired, the timer finished, or it's time to put a synced dish on. */
export type TimerEvent = 'alert' | 'finished' | 'due'

/**
 * Bring a timer up to date with the clock: fire due alerts, finish if time is up.
 * Handles any amount of missed time in one call (e.g. after the phone slept).
 * Returns what newly needs attention, if anything; finishing outranks an alert.
 */
export function advance(t: Timer, now: number): TimerEvent | null {
  if (t.prepped) {
    if (t.startAt == null || t.due || now < t.startAt) return null
    t.due = true
    return 'due'
  }
  let event: TimerEvent | null = null
  while (t.runningSince !== null) {
    const elapsed = t.elapsedMs + (now - t.runningSince)
    const next = nextAlert(t)

    if (next && next.atMs <= elapsed && next.atMs < t.durationMs) {
      // A newer alert replaces any the cook never got to acknowledge.
      for (const a of t.alerts) if (a.state === 'firing') a.state = 'done'
      next.state = 'firing'
      next.firedAt = t.runningSince + (next.atMs - t.elapsedMs)
      if (next.pause) {
        t.elapsedMs = next.atMs
        t.runningSince = null
        t.pausedBy = 'alert'
      }
      event = 'alert'
      continue
    }

    if (elapsed >= t.durationMs) {
      t.finishedAt = t.runningSince + (t.durationMs - t.elapsedMs)
      t.elapsedMs = t.durationMs
      t.runningSince = null
      t.pausedBy = null
      for (const a of t.alerts) a.state = 'done'
      event = 'finished'
    }
    break
  }
  return event
}

/** Confirm the firing alert ("Flipped"). Resumes the countdown if the alert was holding it. */
export function acknowledge(t: Timer, now: number): void {
  for (const a of t.alerts) if (a.state === 'firing') a.state = 'done'
  if (t.pausedBy === 'alert') {
    t.pausedBy = null
    t.runningSince = now
  }
}

export function pause(t: Timer, now: number): void {
  if (t.runningSince === null) return
  t.elapsedMs = elapsedMs(t, now)
  t.runningSince = null
  t.pausedBy = 'user'
}

export function resume(t: Timer, now: number): void {
  if (t.finishedAt !== null || t.runningSince !== null) return
  t.prepped = false
  t.syncedAt = t.startAt = null
  t.due = false
  t.pausedBy = null
  t.runningSince = now
}

/** Add cooking time. A finished timer starts running again ("needs another minute"). */
export function addTime(t: Timer, ms: number, now: number): void {
  const before = elapsedMs(t, now)
  t.durationMs += ms
  if (t.finishedAt !== null) {
    t.finishedAt = null
    t.runningSince = now
  }
  // Repeating alerts keep repeating through the added time.
  if (t.plan.kind === 'every') {
    const known = new Set(t.alerts.map((a) => a.atMs))
    for (const fresh of buildAlerts(t.durationMs, t.plan)) {
      if (fresh.atMs > before && !known.has(fresh.atMs)) t.alerts.push(fresh)
    }
    t.alerts.sort((a, b) => a.atMs - b.atMs)
  }
}

/**
 * Change a timer's mid-way alerts at any point, including while it runs. Alert
 * times that have already gone by are kept as history (so the bar still shows
 * them) but won't fire; one that is firing right now stays until it's confirmed.
 */
export function setPlan(t: Timer, plan: AlertPlan, now: number): void {
  const elapsed = elapsedMs(t, now)
  const firing = t.alerts.filter((a) => a.state === 'firing')
  const fresh = buildAlerts(t.durationMs, plan).filter((a) => !firing.some((f) => f.atMs === a.atMs))
  for (const a of fresh) if (a.atMs <= elapsed) a.state = 'done'
  t.plan = { ...plan }
  t.alerts = [...firing, ...fresh].sort((a, b) => a.atMs - b.atMs)
}

/** Waiting on the cook: a flip to confirm, a finished timer to dismiss, or a synced dish to put on. */
export function isPending(t: Timer): boolean {
  const status = statusOf(t)
  return status === 'alert' || status === 'finished' || status === 'due'
}

// ---- Sync Finish ----

/** Prepped timers that haven't been given a start time yet: the ones Sync Finish works on. */
export function syncable(timers: Timer[]): Timer[] {
  return timers.filter((t) => statusOf(t) === 'prepped')
}

/**
 * To finish together, everything is timed backwards from the longest dish: it
 * goes on now, and each shorter one waits out the difference first.
 * Returned longest-first, i.e. in the order things go on.
 */
export function syncPlan(timers: Timer[]): { timer: Timer; delayMs: number }[] {
  const group = syncable(timers)
  const longest = Math.max(0, ...group.map((t) => t.durationMs))
  return group
    .map((timer) => ({ timer, delayMs: longest - timer.durationMs }))
    .sort((a, b) => a.delayMs - b.delayMs || a.timer.createdAt - b.timer.createdAt)
}

export function syncFinish(timers: Timer[], now: number): void {
  for (const { timer, delayMs } of syncPlan(timers)) {
    if (delayMs === 0) resume(timer, now)
    else {
      timer.syncedAt = now
      timer.startAt = now + delayMs
      timer.due = false
    }
  }
}

/** How far through its pre-timer a waiting timer is, 0–1. */
export function waitProgress(t: Timer, now: number): number {
  if (t.startAt == null || t.syncedAt == null || t.startAt <= t.syncedAt) return 1
  return Math.min(1, Math.max(0, (now - t.syncedAt) / (t.startAt - t.syncedAt)))
}

/**
 * Display order: whatever needs hands first, then whatever is ready soonest,
 * then synced timers by when they go on, then prepped timers in the order they were set up.
 * Running timers all drain at the same rate, so this only changes on real
 * events (time added, pause, an alert firing).
 */
export function displayOrder(timers: Timer[], now: number): Timer[] {
  const rank = (t: Timer) => ({ finished: 0, alert: 1, due: 1, running: 2, paused: 2, waiting: 3, prepped: 4 })[statusOf(t)]
  const left = (t: Timer) => (t.prepped ? (t.startAt ?? 0) : remainingMs(t, now))
  return [...timers].sort((a, b) => rank(a) - rank(b) || left(a) - left(b) || a.createdAt - b.createdAt)
}
