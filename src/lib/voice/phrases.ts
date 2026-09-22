// What the robot says: picks a line from lines.ts for the situation and fills it
// in. Pure (the randomness is injectable), so every line can be checked by tests
// for grammar against singular, plural, task-like and unnamed timers.

import type { Timer } from '../timer'
import { LINES, type LinePool } from './lines'

// Names that are things to do, or appliances, rather than something you'd call "the …s are ready".
const TASK =
  /^(boil|rest|preheat|defrost|simmer|drain|blanch|deep fry|reheat|reheating|proving|prove|marinade|marinate|steam|soak|chill|cool|ice bath)\b/i
// Drinks are food-like ("the tea is ready") but nobody cooks them.
const DRINK = /\b(tea|coffee|espresso|mulled wine|hot chocolate|cocoa|milk|water)\b/i
const SINGULAR_ENDINGS = /(ss|us|is)$/i // couscous, asparagus, hummus, octopus

export function isPlural(name: string): boolean {
  const last = name.trim().split(/\s+/).at(-1) ?? ''
  return /s$/i.test(last) && !SINGULAR_ENDINGS.test(last)
}

type Kind = 'Food' | 'Task' | 'Unnamed'
const kindOf = (name: string): Kind => (!name.trim() ? 'Unnamed' : TASK.test(name.trim()) ? 'Task' : 'Food')

// Names that start with a place or a person keep their capital mid-sentence.
const PROPER =
  /^(yorkshire|brussels|french|scotch|english|welsh|cornish|irish|swiss|danish|chinese|thai|indian|italian|greek|mexican|korean|cajun|victoria|cumberland|lincolnshire|bakewell|eton|chelsea)\b/i

/** "Potatoes" → "potatoes"; "Yorkshire puddings", "BBQ ribs", "Chicken Kiev" keep their capitals. */
function asFood(name: string): string {
  const n = name.trim()
  return PROPER.test(n) || /[A-Z]/.test(n.slice(1)) ? n : n.charAt(0).toLowerCase() + n.slice(1)
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** A length of time the way you'd say it: "6 minutes", "1 hour 5 minutes", "30 seconds". */
export function spokenDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const parts: [number, string][] = [
    [Math.floor(total / 3600), 'hour'],
    [Math.floor((total % 3600) / 60), 'minute'],
    [total % 60, 'second'],
  ]
  const said = parts.filter(([n]) => n > 0).map(([n, unit]) => `${n} ${unit}${n === 1 ? '' : 's'}`)
  return said.join(' ') || '0 seconds'
}

export type Random = () => number
const lastSaid = new Map<LinePool, string>()

/** A line from the pool, not the one she used last time (unless it's the only one that fits). */
function pick(pool: LinePool, random: Random, allow: (line: string) => boolean = () => true): string {
  const fitting = LINES[pool].filter(allow)
  const options = fitting.length ? fitting : LINES[pool]
  const fresh = options.filter((line) => line !== lastSaid.get(pool))
  const from = fresh.length ? fresh : options
  const line = from[Math.min(from.length - 1, Math.floor(random() * from.length))]
  lastSaid.set(pool, line)
  return line
}

interface Fill {
  name?: string
  other?: string
  verb?: string
  ms?: number
}

export function fill(template: string, { name = '', other = '', verb = '', ms = 0 }: Fill): string {
  const plural = isPlural(name)
  const values: Record<string, string> = {
    food: asFood(name),
    Food: capital(asFood(name)),
    name: name.trim(),
    other: asFood(other),
    is: plural ? 'are' : 'is',
    it: plural ? 'them' : 'it',
    those: plural ? 'those' : 'that',
    time: spokenDuration(ms),
    verb: verb.trim().toLowerCase(),
    Verb: capital(verb.trim().toLowerCase()),
  }
  return capital(template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole))
}

function line(
  stem: 'started' | 'finished' | 'alert' | 'due' | 'nextUp',
  timer: Timer,
  random: Random,
  extra: Fill = {},
): string {
  const name = timer.name
  const pool = `${stem}${kindOf(name)}` as LinePool
  const noCooking = DRINK.test(name) ? (l: string) => !/cook/i.test(l) : undefined
  return fill(pick(pool, random, noCooking), { name, ms: timer.durationMs, ...extra })
}

export const greeting = (first: boolean, random: Random = Math.random) => pick(first ? 'greetFirst' : 'greet', random)
export const startedPhrase = (timer: Timer, random: Random = Math.random) => line('started', timer, random)
export const finishedPhrase = (timer: Timer, random: Random = Math.random) => line('finished', timer, random)
export const duePhrase = (timer: Timer, random: Random = Math.random) => line('due', timer, random)
/** A recipe's next timer step is on screen, waiting for its Start. */
export const nextUpPhrase = (timer: Timer, random: Random = Math.random) => line('nextUp', timer, random)

/** A mid-way alert. The label is already an imperative (Flip, Stir, Check, Baste). */
export const alertPhrase = (timer: Timer, label: string, random: Random = Math.random) =>
  line('alert', timer, random, { verb: label || 'check' })

/** Sync Up & Start was pressed; `readyInMs` is the longest dish. */
export const syncedPhrase = (readyInMs: number, random: Random = Math.random) =>
  fill(pick('synced', random), { ms: readyInMs })

/** The occasional spoken nudge while things are still waiting on the cook. */
export function waitingPhrase(names: string[], random: Random = Math.random): string {
  const named = names.map((n) => n.trim()).filter((n) => n && kindOf(n) === 'Food')
  if (named.length === 0) return pick('waitingUnnamed', random)
  const pool: LinePool = named.length === 1 ? 'waitingOne' : named.length === 2 ? 'waitingTwo' : 'waitingMany'
  return fill(pick(pool, random), { name: named[0], other: named[1] })
}
