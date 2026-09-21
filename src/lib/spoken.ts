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
const PREP = new Set(['prep', 'prepare', 'prepared', 'prepped', 'prepping', 'preps', 'crep'])

// The sentence people wrap round the food: "can you start a timer for this pork", "remind me
// about the bread", "the laksa needs", "he wants his steak". Stripped from either end of the
// name only, so "Toad in the hole" and "Bacon and eggs" keep their middles, and never past
// the point where what's left is a food-list entry ("Oven chips" keeps its oven).
const EDGE_FILLER = new Set(
  [
    'a an and at for in of on the to with about when if so or by off up down out',
    'this that these those my our your his her their some it its',
    'i im ive id ill we were you he she they me us him them',
    'can could would will should shall may might must',
    'like need needs want wants take takes have has had get gets got give gives put putting do does',
    'let lets make create add tell remind know count time is are be been was go goes going went',
    'begin set start starting timer timers alarm countdown now then again',
    'please thanks thank cheers hey hi ok okay right sizzle er erm uh um',
  ]
    .join(' ')
    .split(' ')
    .concat(Object.keys(UNITS)),
)
// "The gazpacho needs chilling": once the food has been named, one of these ends it.
const AFTER_THE_FOOD = new Set('need needs want wants take takes is are has have had goes should will'.split(' '))

// "in the oven", "on the hob", "under the grill": where it's cooking isn't what it's called.
// Only with the preposition, so the list's "Oven chips" and "Air fryer" are safe.
const PLACED = new Set(['in', 'into', 'on', 'onto', 'under', 'for'])
const DETERMINERS = new Set(['the', 'a', 'an', 'my', 'our', 'this', 'that'])
const APPLIANCES = [
  'air fryer',
  'slow cooker',
  'pressure cooker',
  'frying pan',
  'oven',
  'hob',
  'stove',
  'grill',
  'pan',
  'pot',
  'wok',
  'fryer',
  'microwave',
  'steamer',
  'toaster',
  'barbecue',
  'bbq',
  'water',
].map((name) => name.split(' '))

// "about 20 minutes", "another ten minutes" / "20 minutes or so", "10 minutes more"
const BEFORE_A_TIME = new Set(
  'about around roughly approximately approx another maybe just nearly almost exactly say'.split(' '),
)
const AFTER_A_TIME = new Set('more extra longer ish'.split(' '))
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
  // "for the five minutes" is what "forty-five minutes" often comes back as
  if (word === 'for' && t[i + 1] === 'the') {
    const ones = /^[1-9]$/.test(t[i + 2] ?? '') ? Number(t[i + 2]) : SMALL.indexOf(t[i + 2] ?? '')
    if (ones >= 1 && ones <= 9 && (t[i + 3] ?? '') in UNITS) return { value: 40 + ones, next: i + 3 }
    if ((t[i + 2] ?? '') in UNITS) return { value: 40, next: i + 2 }
  }
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
    // "to our thirty" is "two hours thirty", but "for our turkey" is just a sentence.
    const guess = SOUNDS_LIKE[word]
    const unit = t[next]
    if (guess === undefined || unit === undefined || !(unit in UNITS)) return null
    return (unit === 'our' || unit === 'ours') && guess !== 2 ? null : { value: guess, next }
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

const isArticle = (word: string | undefined) => word === 'a' || word === 'an' || word === 'another'
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

  // "an hour", "2 hours", "six and a half minutes", "ninety seconds", "a couple of minutes", "35"
  let amount: number
  const couple = isArticle(t[i]) ? i + 1 : i
  const coupleOf = t[couple + 1] === 'of' ? couple + 2 : couple + 1
  if (t[couple] === 'couple' && unitAt(t, coupleOf)) {
    amount = 2
    j = coupleOf
  } else if (isArticle(t[i]) && unitAt(t, i + 1)) {
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
  if (AFTER_A_TIME.has(t[j] ?? '') && unitAt(t, j + 1)) j++ // "ten more minutes"
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
 * Roughly how a word sounds, so that what the speech model wrote can be compared with what
 * was probably said: "ties" and "thighs" are both "tes", "rose" is one sound short of "roast".
 * Consonants are kept (with the usual English spellings folded together), each run of vowels
 * becomes E if it starts with e/i/y and A otherwise, so "beans" and "buns" stay apart.
 */
export function soundOf(text: string): string {
  return text
    .split(' ')
    .map((word) =>
      word
        .replace(/igh/g, 'i')
        .replace(/gh|(?<=[^aeiouy])e$/g, '')
        .replace(/^kn/, 'n')
        .replace(/^wr/, 'r')
        .replace(/mb$/, 'm')
        .replace(/th/g, 't')
        .replace(/ph/g, 'f')
        .replace(/wh/g, 'w')
        .replace(/dg|g(?=[eiy])/g, 'j')
        .replace(/c(?=[eiy])|z/g, 's')
        .replace(/ck|c|q/g, 'k')
        .replace(/x/g, 'ks')
        .replace(/[eiy][aeiouy]*/g, 'E')
        .replace(/[aou][aeiouy]*/g, 'A')
        .replace(/(.)\1+/g, '$1'),
    )
    .join(' ')
}

/**
 * The food-list entry these words clearly mean, or undefined. In order: the exact name or its
 * singular/plural; one letter out ("past" → Pasta); sounding the same ("chicken ties" → Chicken
 * thighs) or one sound out ("rose potatoes" → Roast potatoes). The loose ones need the same
 * first letter and exactly one candidate: anything looser would rename a cook's own dish.
 */
function matchFood(spoken: string, foods: readonly FoodEntry[]): string | undefined {
  const listed = listedFood(spoken, foods)
  if (listed || spoken.length < 4) return listed
  const names = foods.map(([name]) => ({ name, key: normalise(name) })).filter((f) => f.key[0] === spoken[0])
  const only = (found: typeof names) => (found.length === 1 ? found[0]?.name : undefined)
  const sound = soundOf(spoken)
  return (
    only(names.filter((f) => oneLetterApart(f.key, spoken))) ??
    only(names.filter((f) => soundOf(f.key) === sound)) ??
    (sound.length >= 5 ? only(names.filter((f) => oneLetterApart(soundOf(f.key), sound))) : undefined)
  )
}

/** The entry with exactly this name, give or take a plural. */
function listedFood(spoken: string, foods: readonly FoodEntry[]): string | undefined {
  if (!spoken) return undefined
  const exact = foods.find(([name]) => normalise(name) === spoken)
  return (exact ?? foods.find(([name]) => singular(normalise(name)) === singular(spoken)))?.[0]
}

/** Without "in the oven", "on the hob", "under the grill". */
function dropPlaces(t: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < t.length; i++) {
    if (PLACED.has(t[i] ?? '')) {
      const at = DETERMINERS.has(t[i + 1] ?? '') ? i + 2 : i + 1
      const appliance = APPLIANCES.find((words) => words.every((w, k) => t[at + k] === w))
      if (appliance) {
        i = at + appliance.length - 1
        continue
      }
    }
    out.push(t[i] ?? '')
  }
  return out
}

/** What's left once the sentence round the food is taken away. Stops as soon as it's looking at a food-list entry. */
function foodWords(t: string[], foods: readonly FoodEntry[]): string {
  let from = 0
  let to = t.length
  const listed = () => listedFood(t.slice(from, to).join(' '), foods) !== undefined
  while (from < to && !listed() && EDGE_FILLER.has(t[to - 1] ?? '')) to--
  while (from < to && !listed() && EDGE_FILLER.has(t[from] ?? '')) from++
  // "gazpacho needs chilling": the food has been named; the rest is about it
  const verb = t.slice(from, to).findIndex((w, i) => i > 0 && AFTER_THE_FOOD.has(w))
  if (verb > 0 && !listed()) to = from + verb
  return t.slice(from, to).join(' ')
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
  if (found) {
    let { start, end } = found
    while (start > 0 && BEFORE_A_TIME.has(tokens[start - 1] ?? '')) start--
    if (tokens[end] === 'or' && tokens[end + 1] === 'so') end += 2
    while (AFTER_A_TIME.has(tokens[end] ?? '')) end++
    tokens.splice(start, end - start)
  }
  const ms = found ? Math.round(found.ms / 1000) * 1000 : 0

  const said = foodWords(dropPlaces(tokens), foods)
  return {
    name: matchFood(said, foods) ?? tidyName(said),
    durationMs: ms > 0 && ms <= MAX_MS ? ms : null,
    prep,
  }
}
