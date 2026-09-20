import { describe, expect, it } from 'vitest'
import { recentTimes, rememberTime, type TimeHistory } from './history'

const MIN = 60_000

describe('time history', () => {
  it('offers the most recent times for a name, newest first, without repeats', () => {
    const h: TimeHistory = {}
    rememberTime(h, 'Potatoes', 40 * MIN)
    rememberTime(h, 'Potatoes', 35 * MIN)
    rememberTime(h, 'potatoes ', 40 * MIN) // same food, used again: moves back to the front
    expect(recentTimes(h, 'Potatoes')).toEqual([40 * MIN, 35 * MIN])
  })

  it('keeps only the last three', () => {
    const h: TimeHistory = {}
    for (const m of [5, 6, 7, 8]) rememberTime(h, 'Eggs', m * MIN)
    expect(recentTimes(h, 'Eggs')).toEqual([8 * MIN, 7 * MIN, 6 * MIN])
  })

  it('keeps names apart and ignores unnamed timers', () => {
    const h: TimeHistory = {}
    rememberTime(h, 'Rice', 12 * MIN)
    rememberTime(h, '   ', 3 * MIN)
    expect(recentTimes(h, 'Pasta')).toEqual([])
    expect(recentTimes(h, '')).toEqual([])
    expect(Object.keys(h)).toEqual(['rice'])
  })
})
