// What the cook said into the mic → a timer. "Rice ten minutes", "prep the lamb, an
// hour and a half", "turkey 2 hours 30". A number is minutes unless hours (or seconds)
// are mentioned; "prep"/"prepare" anywhere makes it a prepped timer; whatever words are
// left are the name, snapped to the food list when they're clearly one of its entries.
// Pure: the transcript comes from src/lib/listen/, which knows nothing about timers.

import { FOODS, type FoodEntry } from '../data/foods'
import { normalise } from './foodSearch'
import { tidyName } from './format'

export interface Spoken {
  /** '' if no name was heard. */
  name: string
  /** null if no time was heard. */
  durationMs: number | null
  prep: boolean
}

const SMALL = [
  'zero one two three four five six seven eight nine ten eleven twelve thirteen',
  'fourteen fifteen sixteen seventeen eighteen nineteen',
]
  .join(' ')
  .split(' ')
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
// Speech models write these for a number now and then. Only trusted right before a unit
// ("to hours"), so "prepare the gravy for twelve minutes" isn't 4 of anything.
const SOUNDS_LIKE: Record<string, number> = { to: 2, too: 2, for: 4, fore: 4, ate: 8, won: 1 }

const HOUR = 3_600_000
const MINUTE = 60_000
const SECOND = 1000
const UNITS: Record<string, number> = {
  hour: HOUR,
  hours: HOUR,
  hr: HOUR,
  hrs: HOUR,
  our: HOUR, // "to our thirty" is a real transcript of "two hours thirty"
  ours: HOUR,
  minute: MINUTE,
  minutes: MINUTE,
  min: MINUTE,
  mins: MINUTE,
  second: SECOND,
  seconds: SECOND,
  sec: SECOND,
  secs: SECOND,
}

// "crep" is what the speech model makes of a clipped "prep"; it isn't a word, so it's safe to take.
const PREP = new Set(['prep', 'prepare', 'prepared', 'prepping', 'preps', 'crep'])
// Not part of a name when they're left dangling at either end of it ("start the rice for").
const EDGE_FILLER = new Set(
  'a an and at begin er erm for in of on please set start the timer timers to uh um with'
    .split(' ')
    .concat(Object.keys(UNITS)),
)
const MAX_MS = 24 * HOUR

interface Read {
  value: number
  next: number
}

/** A number starting at token i: "45", "1.5", "forty five", "a hundred and twenty". */
function readNumber(t: string[], i: number): Read | null {
  const word = t[i]
  if (word === undefined) return null
  if (/^\d+(\.\d+)?$/.test(word)) return { value: Number(word), next: i + 1 }
  const tens = TENS.indexOf(word)
  if (tens >= 0) {
    const unit = SMALL.indexOf(t[i + 1] ?? '')
    return unit >= 1 && unit <= 9
      ? { value: (tens + 2) * 10 + unit, next: i + 2 }
      : { value: (tens + 2) * 10, next: i + 1 }
  }
  let value = SMALL.indexOf(word)
  let next = i + 1
  if (value < 0 && (word === 'a' || word === 'an') && t[next] === 'hundred') value = 1
  if (value < 0) {
    const guess = SOUNDS_LIKE[word]
    return guess !== undefined && t[next] !== undefined && t[next] in UNITS ? { value: guess, next } : null
  }
  if (t[next] === 'hundred') {
    value *= 100
    next++
    const rest = readNumber(t, t[next] === 'and' ? next + 1 : next)
    if (rest && rest.value < 100) return { value: value + rest.value, next: rest.next }
  }
  return { value, next }
}

interface Found {
  start: number
  end: number
  ms: number
  /** Said with a unit. A bare number is only a guess at the time ("5 spice chicken"). */
  sure: boolean
}

const isArticle = (word: string | undefined) => word === 'a' || word === 'an'
const unitAt = (t: string[], i: number): number | undefined => (t[i] !== undefined ? UNITS[t[i]] : undefined)

/** A spoken duration starting exactly at token i, or null. */
function readDuration(t: string[], i: number): Found | null {
  // "half an hour", "a half hour", "quarter of an hour", "three quarters of an hour"
  let j = i
  let fraction = 0
  const count = readNumber(t, j)
  if (count && (t[count.next] === 'quarters' || t[count.next] === 'quarter')) {
    fraction = count.value / 4
    j = count.next + 1
  } else {
    if (isArticle(t[j])) j++
    if (t[j] === 'half') fraction = 0.5
    else if (t[j] === 'quarter') fraction = 0.25
    j++
  }
  if (fraction) {
    if (t[j] === 'of') j++
    if (isArticle(t[j])) j++
    const unit = unitAt(t, j)
    if (unit === HOUR) return { start: i, end: j + 1, ms: fraction * unit, sure: true }
  }

  // "an hour", "2 hours", "six and a half minutes", "ninety seconds", "35"
  let amount: number
  if (isArticle(t[i]) && unitAt(t, i + 1)) {
    amount = 1
    j = i + 1
  } else {
    const n = readNumber(t, i)
    if (!n) return null
    amount = n.value
    j = n.next
  }
  const andAHalf = (at: number) => t[at] === 'and' && t[at + 1] === 'a' && t[at + 2] === 'half'
  if (andAHalf(j)) {
    amount += 0.5
    j += 3
  }
  const unit = unitAt(t, j)
  if (!unit) return { start: i, end: j, ms: amount * MINUTE, sure: false }
  j++
  if (andAHalf(j)) {
    amount += 0.5
    j += 3
  }
  let ms = amount * unit

  // "two hours thirty", "1 hour and 20 minutes", "2 minutes 30 seconds"
  const k = t[j] === 'and' ? j + 1 : j
  const more = readNumber(t, k)
  if (more && more.value < 60 && !((t[k] ?? '') in SOUNDS_LIKE)) {
    const smaller = unitAt(t, more.next)
    if (smaller !== undefined && smaller < unit) {
      ms += more.value * smaller
      j = more.next + 1
    } else if (smaller === undefined && unit === HOUR) {
      ms += more.value * MINUTE
      j = more.next
    }
  }
  return { start: i, end: j, ms, sure: true }
}

/** The time in the sentence: the first one said with a unit, otherwise the last bare number. */
function findDuration(t: string[]): Found | null {
  let bare: Found | null = null
  for (let i = 0; i < t.length; i++) {
    const found = readDuration(t, i)
    if (!found) continue
    if (found.sure) return found
    bare = found
    i = found.end - 1
  }
  return bare
}

// "Eggs" and "egg", "potatoes" and "potato" are the same thing said aloud.
const singular = (text: string) =>
  text
    .split(' ')
    .map((w) => w.replace(/(?<=o)es$|s$/, ''))
    .join(' ')

/** True if the two differ by one letter added, dropped or swapped for another. */
function oneLetterApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const restA = a.length >= b.length ? i + 1 : i
  const restB = b.length >= a.length ? i + 1 : i
  return a.slice(restA) === b.slice(restB)
}

/**
 * The food-list entry these words clearly mean, or undefined. Deliberately strict: the
 * exact name, its singular/plural, or one letter out with the same first letter and only
 * one such candidate ("rise" → Rice). Anything looser would rename a cook's own dish.
 */
function matchFood(spoken: string, foods: readonly FoodEntry[]): string | undefined {
  const names = foods.map(([name]) => ({ name, key: normalise(name) }))
  const exact = names.find((f) => f.key === spoken) ?? names.find((f) => singular(f.key) === singular(spoken))
  if (exact) return exact.name
  if (spoken.length < 4) return undefined
  const near = names.filter((f) => f.key[0] === spoken[0] && oneLetterApart(f.key, spoken))
  return near.length === 1 ? near[0].name : undefined
}

export function parseSpoken(text: string, foods: readonly FoodEntry[] = FOODS): Spoken {
  let tokens: string[] =
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f'’]/g, '')
      .replace(/(\d):(\d\d)\b/g, '$1 hours $2') // a model may write "1:30" for "one thirty"
      .match(/\d+(?:\.\d+)?|[a-z]+/g) ?? []

  const prep = tokens.some((w) => PREP.has(w))
  tokens = tokens.filter((w) => !PREP.has(w))

  const found = findDuration(tokens)
  if (found) tokens.splice(found.start, found.end - found.start)
  const ms = found ? Math.round(found.ms / 1000) * 1000 : 0

  while (tokens.length && EDGE_FILLER.has(tokens[0])) tokens.shift()
  while (tokens.length && EDGE_FILLER.has(tokens[tokens.length - 1])) tokens.pop()
  const said = tokens.join(' ')

  return {
    name: matchFood(said, foods) ?? tidyName(said),
    durationMs: ms > 0 && ms <= MAX_MS ? ms : null,
    prep,
  }
}
