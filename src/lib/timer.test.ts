import { describe, expect, it } from 'vitest'
import {
  acknowledge,
  addTime,
  advance,
  buildAlerts,
  createTimer,
  displayOrder,
  isPending,
  NO_ALERTS,
  pause,
  remainingMs,
  resume,
  setPlan,
  statusOf,
  syncable,
  syncFinish,
  syncPlan,
  waitProgress,
  type AlertPlan,
} from './timer'
import { formatClock, formatDuration, parseDuration } from './format'

const MIN = 60_000
const T0 = 1_000_000

const half = (pause: boolean): AlertPlan => ({ kind: 'half', everyMs: 0, label: 'Flip', pause })
const every = (min: number, pause = false): AlertPlan => ({ kind: 'every', everyMs: min * MIN, label: 'Flip', pause })

describe('buildAlerts', () => {
  it('puts a single alert at the halfway point', () => {
    expect(buildAlerts(40 * MIN, half(true)).map((a) => a.atMs)).toEqual([20 * MIN])
  })

  it('repeats every N minutes but never on the finish line', () => {
    expect(buildAlerts(6 * MIN, every(2)).map((a) => a.atMs)).toEqual([2 * MIN, 4 * MIN])
    expect(buildAlerts(5 * MIN, every(2)).map((a) => a.atMs)).toEqual([2 * MIN, 4 * MIN])
  })

  it('has none for a plain timer', () => {
    expect(buildAlerts(10 * MIN, NO_ALERTS)).toEqual([])
  })
})

describe('plain timer', () => {
  it('counts down and finishes at the exact moment, even if checked late', () => {
    const t = createTimer('Rice', 10 * MIN, NO_ALERTS, T0)
    expect(remainingMs(t, T0 + 4 * MIN)).toBe(6 * MIN)
    advance(t, T0 + 25 * MIN) // phone was asleep
    expect(statusOf(t)).toBe('finished')
    expect(t.finishedAt).toBe(T0 + 10 * MIN)
    expect(remainingMs(t, T0 + 25 * MIN)).toBe(0)
  })

  it('pauses and resumes without losing time', () => {
    const t = createTimer('', 10 * MIN, NO_ALERTS, T0)
    pause(t, T0 + 3 * MIN)
    expect(statusOf(t)).toBe('paused')
    expect(remainingMs(t, T0 + 8 * MIN)).toBe(7 * MIN)
    resume(t, T0 + 8 * MIN)
    advance(t, T0 + 15 * MIN)
    expect(t.finishedAt).toBe(T0 + 15 * MIN)
  })
})

describe('pausing flip alert (oven)', () => {
  it('holds the countdown at the flip point until acknowledged', () => {
    const t = createTimer('Potatoes', 40 * MIN, half(true), T0)
    advance(t, T0 + 21 * MIN)
    expect(statusOf(t)).toBe('alert')
    expect(t.pausedBy).toBe('alert')
    expect(t.alerts[0].firedAt).toBe(T0 + 20 * MIN)
    expect(remainingMs(t, T0 + 23 * MIN)).toBe(20 * MIN) // held, not draining

    acknowledge(t, T0 + 23 * MIN)
    expect(statusOf(t)).toBe('running')
    advance(t, T0 + 43 * MIN)
    expect(t.finishedAt).toBe(T0 + 43 * MIN)
  })
})

describe('non-pausing repeat alerts (pan)', () => {
  it('keeps the clock running while an alert is firing', () => {
    const t = createTimer('Fry', 6 * MIN, every(2), T0)
    advance(t, T0 + 2 * MIN + 5000)
    expect(statusOf(t)).toBe('alert')
    expect(remainingMs(t, T0 + 2 * MIN + 5000)).toBe(4 * MIN - 5000)
    acknowledge(t, T0 + 2 * MIN + 6000)
    expect(statusOf(t)).toBe('running')
  })

  it('collapses missed alerts into the latest one', () => {
    const t = createTimer('Fry', 6 * MIN, every(2), T0)
    advance(t, T0 + 5 * MIN)
    expect(t.alerts.map((a) => a.state)).toEqual(['done', 'firing'])
    expect(t.alerts[1].firedAt).toBe(T0 + 4 * MIN)
  })

  it('finishing clears an unacknowledged alert', () => {
    const t = createTimer('Fry', 6 * MIN, every(2), T0)
    advance(t, T0 + 7 * MIN)
    expect(statusOf(t)).toBe('finished')
    expect(t.alerts.every((a) => a.state === 'done')).toBe(true)
  })
})

describe('addTime', () => {
  it('restarts a finished timer for the extra time', () => {
    const t = createTimer('', 5 * MIN, NO_ALERTS, T0)
    advance(t, T0 + 6 * MIN)
    addTime(t, MIN, T0 + 6 * MIN)
    expect(statusOf(t)).toBe('running')
    expect(remainingMs(t, T0 + 6 * MIN)).toBe(MIN)
    advance(t, T0 + 7 * MIN)
    expect(t.finishedAt).toBe(T0 + 7 * MIN)
  })

  it('extends repeating alerts into the added time', () => {
    const t = createTimer('Fry', 6 * MIN, every(2), T0)
    advance(t, T0 + 1 * MIN)
    addTime(t, 3 * MIN, T0 + 1 * MIN)
    expect(t.alerts.map((a) => a.atMs)).toEqual([2 * MIN, 4 * MIN, 6 * MIN, 8 * MIN])
  })
})

describe('events', () => {
  it('reports each new thing that needs the cook, once', () => {
    const t = createTimer('Fry', 6 * MIN, every(2), T0)
    expect(advance(t, T0 + MIN)).toBeNull()
    expect(isPending(t)).toBe(false)
    expect(advance(t, T0 + 2 * MIN)).toBe('alert')
    expect(isPending(t)).toBe(true)
    expect(advance(t, T0 + 2 * MIN + 500)).toBeNull()
    expect(advance(t, T0 + 4 * MIN)).toBe('alert')
    expect(advance(t, T0 + 6 * MIN)).toBe('finished')
    expect(advance(t, T0 + 7 * MIN)).toBeNull()
    expect(isPending(t)).toBe(true)
  })

  it('reports only the finish when an alert and the finish were both missed', () => {
    const t = createTimer('Fry', 6 * MIN, every(2), T0)
    expect(advance(t, T0 + 10 * MIN)).toBe('finished')
  })
})

describe('setPlan (the bell on a card)', () => {
  it('adds alerts to a timer that is already running; only future ones fire', () => {
    const t = createTimer('Fry', 10 * MIN, NO_ALERTS, T0)
    setPlan(t, every(3), T0 + 4 * MIN)
    expect(t.alerts.map((a) => [a.atMs / MIN, a.state])).toEqual([[3, 'done'], [6, 'pending'], [9, 'pending']])
    expect(advance(t, T0 + 5 * MIN)).toBeNull()
    expect(advance(t, T0 + 6 * MIN)).toBe('alert')
  })

  it('removes alerts', () => {
    const t = createTimer('Fry', 10 * MIN, every(3), T0)
    setPlan(t, NO_ALERTS, T0 + MIN)
    expect(t.alerts).toEqual([])
    expect(advance(t, T0 + 5 * MIN)).toBeNull()
  })

  it('keeps an alert that is firing, so a held clock can still be released', () => {
    const t = createTimer('Potatoes', 10 * MIN, half(true), T0)
    advance(t, T0 + 5 * MIN)
    setPlan(t, NO_ALERTS, T0 + 6 * MIN)
    expect(statusOf(t)).toBe('alert')
    acknowledge(t, T0 + 6 * MIN)
    expect(statusOf(t)).toBe('running')
  })

  it('works on a prepped timer before it starts', () => {
    const t = createTimer('Potatoes', 40 * MIN, NO_ALERTS, T0, true)
    setPlan(t, half(true), T0 + 30 * MIN)
    resume(t, T0 + 60 * MIN)
    expect(advance(t, T0 + 80 * MIN)).toBe('alert')
  })
})

describe('prepped timers', () => {
  it('wait at full time until started, however long that takes', () => {
    const t = createTimer('Potatoes', 40 * MIN, half(true), T0, true)
    expect(statusOf(t)).toBe('prepped')
    expect(advance(t, T0 + 90 * MIN)).toBeNull()
    expect(remainingMs(t, T0 + 90 * MIN)).toBe(40 * MIN)
    expect(isPending(t)).toBe(false)

    resume(t, T0 + 90 * MIN)
    expect(statusOf(t)).toBe('running')
    expect(advance(t, T0 + 111 * MIN)).toBe('alert')
    expect(t.alerts[0].firedAt).toBe(T0 + 110 * MIN)
  })

  it('queue below everything that is already cooking', () => {
    const prepA = createTimer('Prep A', 2 * MIN, NO_ALERTS, T0, true)
    const rice = createTimer('Rice', 10 * MIN, NO_ALERTS, T0 + 1)
    const prepB = createTimer('Prep B', 1 * MIN, NO_ALERTS, T0 + 2, true)
    expect(displayOrder([prepA, rice, prepB], T0 + MIN).map((t) => t.name)).toEqual(['Rice', 'Prep A', 'Prep B'])
  })
})

describe('Sync Finish', () => {
  const meal = () => [
    createTimer('Veg', 8 * MIN, NO_ALERTS, T0, true),
    createTimer('Roast', 40 * MIN, NO_ALERTS, T0 + 1, true),
    createTimer('Chicken', 25 * MIN, NO_ALERTS, T0 + 2, true),
  ]

  it('plans backwards from the longest dish', () => {
    expect(syncPlan(meal()).map((p) => [p.timer.name, p.delayMs / MIN])).toEqual([['Roast', 0], ['Chicken', 15], ['Veg', 32]])
  })

  it('starts the longest now and gives the rest a pre-timer', () => {
    const [veg, roast, chicken] = meal()
    syncFinish([veg, roast, chicken], T0)
    expect(statusOf(roast)).toBe('running')
    expect(statusOf(chicken)).toBe('waiting')
    expect(chicken.startAt).toBe(T0 + 15 * MIN)
    expect(waitProgress(veg, T0 + 16 * MIN)).toBe(0.5)
    expect(syncable([veg, roast, chicken])).toEqual([])
  })

  it('asks for the dish to go on when its pre-timer ends, once, and waits for Start', () => {
    const [veg, roast, chicken] = meal()
    syncFinish([veg, roast, chicken], T0)
    expect(advance(chicken, T0 + 14 * MIN)).toBeNull()
    expect(advance(chicken, T0 + 15 * MIN)).toBe('due')
    expect(advance(chicken, T0 + 16 * MIN)).toBeNull()
    expect(statusOf(chicken)).toBe('due')
    expect(isPending(chicken)).toBe(true)
    expect(remainingMs(chicken, T0 + 20 * MIN)).toBe(25 * MIN) // not cooking until confirmed

    resume(chicken, T0 + 16 * MIN)
    expect(statusOf(chicken)).toBe('running')
    advance(chicken, T0 + 41 * MIN)
    expect(chicken.finishedAt).toBe(T0 + 41 * MIN)
  })

  it('leaves running timers and already-synced ones alone, and lets a dish go on early', () => {
    const [veg, roast, chicken] = meal()
    const rice = createTimer('Rice', 60 * MIN, NO_ALERTS, T0)
    syncFinish([veg, roast, chicken, rice], T0)
    expect(veg.startAt).toBe(T0 + 32 * MIN) // measured against the roast, not the rice
    resume(veg, T0 + 5 * MIN)
    expect(statusOf(veg)).toBe('running')
    expect(veg.startAt).toBeNull()
  })

  it('orders: due with the other pending cards, waiting by start time, unsynced prep last', () => {
    const [veg, roast, chicken] = meal()
    syncFinish([veg, roast, chicken], T0)
    const later = createTimer('Gravy', 5 * MIN, NO_ALERTS, T0 + 3, true)
    const names = (now: number) => displayOrder([later, veg, roast, chicken], now).map((t) => t.name)
    expect(names(T0 + MIN)).toEqual(['Roast', 'Chicken', 'Veg', 'Gravy'])
    advance(chicken, T0 + 15 * MIN)
    expect(names(T0 + 15 * MIN)).toEqual(['Chicken', 'Roast', 'Veg', 'Gravy'])
  })
})

describe('displayOrder', () => {
  it('puts pending cards first, then soonest to finish', () => {
    const rice = createTimer('Rice', 10 * MIN, NO_ALERTS, T0)
    const eggs = createTimer('Eggs', 4 * MIN, NO_ALERTS, T0 + 1)
    const fry = createTimer('Fry', 20 * MIN, every(2), T0 + 2)
    const names = (now: number) => displayOrder([rice, eggs, fry], now).map((t) => t.name)
    expect(names(T0 + MIN)).toEqual(['Eggs', 'Rice', 'Fry'])

    advance(fry, T0 + 2 * MIN + 2)
    expect(names(T0 + 2 * MIN + 2)).toEqual(['Fry', 'Eggs', 'Rice'])

    acknowledge(fry, T0 + 2 * MIN + 2)
    addTime(eggs, 7 * MIN, T0 + 3 * MIN)
    expect(names(T0 + 3 * MIN)).toEqual(['Rice', 'Eggs', 'Fry'])
  })
})

describe('format', () => {
  it('formats clocks', () => {
    expect(formatClock(20 * MIN)).toBe('20:00')
    expect(formatClock(59_001)).toBe('1:00')
    expect(formatClock(65 * MIN)).toBe('1:05:00')
    expect(formatDuration(90_000)).toBe('1 min 30 s')
  })

  it('parses typed durations', () => {
    expect(parseDuration('12')).toBe(12 * MIN)
    expect(parseDuration('1.5')).toBe(90_000)
    expect(parseDuration('1:30')).toBe(90_000)
    expect(parseDuration('1:05:00')).toBe(65 * MIN)
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('0')).toBeNull()
    expect(parseDuration('')).toBeNull()
  })
})
