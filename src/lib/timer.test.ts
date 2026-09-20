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
  statusOf,
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
