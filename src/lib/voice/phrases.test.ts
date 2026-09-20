import { describe, expect, it } from 'vitest'
import { createTimer, NO_ALERTS } from '../timer'
import { LINES, type LinePool } from './lines'
import {
  alertPhrase,
  duePhrase,
  fill,
  finishedPhrase,
  greeting,
  isPlural,
  spokenDuration,
  startedPhrase,
  syncedPhrase,
  waitingPhrase,
} from './phrases'

const MIN = 60_000
const named = (name: string, minutes = 6) => createTimer(name, minutes * MIN, NO_ALERTS, 0)

/** Every value from 0 to just under 1, so every line in a pool gets picked at some point. */
function* everyChoice(steps = 40) {
  for (let i = 0; i < steps; i++) yield () => i / steps
}

describe('filling in a line', () => {
  it('knows is from are', () => {
    for (const plural of ['Potatoes', 'Eggs', 'Roast potatoes', 'Fish and chips', 'Yorkshire puddings', 'Peas'])
      expect(isPlural(plural), plural).toBe(true)
    for (const singular of ['Rice', 'Spaghetti', 'Couscous', 'Asparagus', 'Hummus', 'Roast chicken', 'Octopus'])
      expect(isPlural(singular), singular).toBe(false)
  })

  it('makes the words agree with the name', () => {
    const line = 'The {food} {is} ready. Give {it} a {verb}, then leave {those} {food}.'
    expect(fill(line, { name: 'Potatoes', verb: 'Flip' })).toBe(
      'The potatoes are ready. Give them a flip, then leave those potatoes.',
    )
    expect(fill(line, { name: 'Rice', verb: 'Stir' })).toBe('The rice is ready. Give it a stir, then leave that rice.')
  })

  it('lower-cases ordinary names but keeps proper ones', () => {
    expect(fill('the {food}', { name: 'Roast chicken' })).toBe('The roast chicken')
    expect(fill('the {food}', { name: 'Yorkshire puddings' })).toBe('The Yorkshire puddings')
    expect(fill('the {food}', { name: 'BBQ ribs' })).toBe('The BBQ ribs')
    expect(fill('{Food} next', { name: 'eggs' })).toBe('Eggs next')
  })

  it('says times the way a person would', () => {
    expect(spokenDuration(6 * MIN)).toBe('6 minutes')
    expect(spokenDuration(MIN)).toBe('1 minute')
    expect(spokenDuration(90_000)).toBe('1 minute 30 seconds')
    expect(spokenDuration(65 * MIN)).toBe('1 hour 5 minutes')
    expect(spokenDuration(30_000)).toBe('30 seconds')
  })
})

describe("Sizzle's lines", () => {
  it('never leaves a placeholder unfilled, whatever the timer is called', () => {
    for (const name of ['Potatoes', 'Rice', 'Tea', 'Boil water', 'Rest the meat', '', 'Yorkshire puddings']) {
      for (const random of everyChoice()) {
        const t = named(name)
        const said = [
          startedPhrase(t, random),
          finishedPhrase(t, random),
          duePhrase(t, random),
          alertPhrase(t, 'Baste', random),
          syncedPhrase(40 * MIN, random),
          waitingPhrase([name], random),
          waitingPhrase([name, 'Eggs'], random),
          waitingPhrase([name, 'Eggs', 'Veg'], random),
          greeting(false, random),
        ]
        for (const s of said)
          expect(s, `${name || '(unnamed)'} → ${s}`).not.toMatch(/[{}]|undefined|\s{2,}|^\s|\s[.,!?]/)
      }
    }
  })

  it('introduces herself properly the first time only', () => {
    expect(greeting(true)).toBe("Hello. I'm Sizzle.")
    expect(LINES.greet).not.toContain("Hello. I'm Sizzle.")
  })

  it("doesn't say the same thing twice running", () => {
    const pools = (Object.keys(LINES) as LinePool[]).filter((p) => LINES[p].length > 1)
    expect(pools).toContain('finishedFood')
    const t = named('Potatoes')
    for (let i = 0; i < 20; i++) expect(finishedPhrase(t, () => 0)).not.toBe(finishedPhrase(t, () => 0))
  })

  it('treats tasks and appliances as names, not as food', () => {
    for (const random of everyChoice()) {
      expect(finishedPhrase(named('Boil water'), random)).toContain('Boil water')
      expect(finishedPhrase(named('Boil water'), random)).not.toMatch(/the boil water|boil water (is|are)/i)
      expect(startedPhrase(named('Rest the meat'), random)).toContain('Rest the meat')
    }
  })

  it('never talks about cooking a drink', () => {
    for (const drink of ['Tea', 'Coffee', 'Mulled wine', 'Hot chocolate', 'Warm milk']) {
      for (const random of everyChoice()) expect(startedPhrase(named(drink), random), drink).not.toMatch(/cook/i)
    }
  })

  it('always names the food and the action for an alert, and the food for a finish', () => {
    for (const random of everyChoice()) {
      const flip = alertPhrase(named('Potatoes'), 'Flip', random)
      expect(flip.toLowerCase()).toContain('potatoes')
      expect(flip.toLowerCase()).toContain('flip')
      expect(finishedPhrase(named('Rice'), random).toLowerCase()).toContain('rice')
      expect(duePhrase(named('Chicken'), random).toLowerCase()).toContain('chicken')
      expect(startedPhrase(named('Eggs'), random)).toMatch(/eggs|6 minutes/i)
    }
  })

  it('keeps every line short enough to take in over a sizzling pan', () => {
    for (const [pool, lines] of Object.entries(LINES)) {
      for (const l of lines) {
        const words = fill(l, { name: 'Roast chicken', other: 'potatoes', verb: 'baste', ms: 6 * MIN }).split(
          /\s+/,
        ).length
        expect(words, `${pool}: ${l}`).toBeLessThanOrEqual(12)
      }
    }
  })
})
