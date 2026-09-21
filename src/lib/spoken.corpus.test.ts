import { describe, expect, it } from 'vitest'
import { FOODS } from '../data/foods'
import { tidyName } from './format'
import { parseSpoken } from './spoken'
import { CORPUS } from './spoken.corpus'

const FOOD_NAMES = new Set<string>(FOODS.map(([name]) => name))

describe('the corpus itself (shape)', () => {
  it('has no duplicate sentences', () => {
    const seen = new Set<string>()
    for (const [said] of CORPUS) {
      expect(seen.has(said.toLowerCase()), `duplicate: ${said}`).toBe(false)
      seen.add(said.toLowerCase())
    }
  })

  it.each(CORPUS)('%s', (said, name, minutes) => {
    expect(said.trim()).toBe(said)
    expect(minutes === null || (minutes > 0 && minutes <= 24 * 60)).toBe(true)
    // A name is either exactly a food-list entry, or the cook's own words: one capital, at the front.
    if (name && !FOOD_NAMES.has(name)) expect(name).toBe(tidyName(name.toLowerCase()))
  })
})

describe('parseSpoken understands the corpus', () => {
  it.each(CORPUS)('%s', (said, name, minutes, prep) => {
    const got = parseSpoken(said)
    expect([got.name, got.durationMs === null ? null : got.durationMs / 60_000, got.prep]).toEqual([
      name,
      minutes,
      prep,
    ])
  })
})

// Whatever the sentence round it, a food from the list must come out as itself: this is what
// catches a filler word that is also the start or end of a food ("Oven chips", "Boil water").
describe('every listed food survives every kind of sentence', () => {
  const FRAMES: [string, (food: string) => string][] = [
    ['bare', (f) => `${f} 10 minutes`],
    ['time in the middle', (f) => `Start a 10 minute ${f} timer`],
    ['polite', (f) => `Can you put the ${f} on for ten minutes please`],
    ['prep', (f) => `Prepare the ${f}, 10 minutes`],
    ['statement', (f) => `The ${f} needs another ten minutes`],
    ['reminder', (f) => `Remind me about the ${f} in ten minutes`],
    ['with a place', (f) => `${f} in the oven for 10 minutes`],
  ]
  it.each(FRAMES)('%s', (_, frame) => {
    const wrong = FOODS.map(([name]) => ({ name, got: parseSpoken(frame(name.toLowerCase())) }))
      .filter(({ name, got }) => got.name !== name || got.durationMs !== 600_000)
      .map(({ name, got }) => `${name} → ${got.name} (${got.durationMs})`)
    expect(wrong).toEqual([])
  })
})
