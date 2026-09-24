// Importing a recipe as JSON, usually written by an AI from the prompt below. The format is
// the one a person would design, not Sizzle's own: steps in order, linked by `after` only
// when they aren't simply next; minutes, not milliseconds. Parsing never throws: it hands
// back a recipe or one plain sentence saying what's wrong and where.

import { findIngredient, type Ingredient, mentioned } from './ingredients'
import type { Recipe, Step } from './recipe'
import { type AlertPlan, NO_ALERTS, uid } from './timer'

export const IMPORT_PROMPT = `Turn the recipe below into JSON for a cooking-timer app, and reply with the JSON only (no commentary, no code fences).

The app cooks a recipe as a chain of STEPS. A step is either an INSTRUCTION (something to do, shown on screen until the cook presses Done) or a TIMER (something that cooks for a set time). Steps come up one after another; a step can name the steps it comes "after" to run alongside another (two things cooking at once) or to wait for several to finish.

Format:
{
  "name": "Chicken curry",
  "serves": 4,
  "ingredients": [
    { "name": "Diced chicken", "amount": 500, "unit": "g" },
    { "name": "Onion", "amount": 1 },
    { "name": "Salt" }
  ],
  "steps": [
    { "id": "onions", "type": "instruction", "text": "Chop the [Onion] and fry until soft" },
    { "id": "fry", "type": "timer", "name": "Onions", "minutes": 6 },
    { "id": "chicken", "type": "instruction", "text": "Add the [Diced chicken]" },
    { "id": "brown", "type": "timer", "name": "Chicken", "minutes": 8, "alert": { "label": "Stir", "every": 2 } },
    { "id": "rice", "type": "timer", "name": "Rice", "minutes": 12, "after": ["chicken"] },
    { "id": "serve", "type": "instruction", "text": "Serve with the rice", "after": ["brown", "rice"] }
  ]
}

Rules:
- Every ingredient the recipe needs goes in "ingredients", with "amount" as a number and "unit" as a short word (g, ml, tbsp, tsp, cloves…); leave "amount" out for things like salt. Amounts are for the number in "serves".
- Instructions are short and doable in one go (under 12 words). Name an ingredient in [square brackets] exactly as it appears in "ingredients", and the app shows its amount.
- Every wait that has a length (fry 8 minutes, simmer 20, rest 5) is a TIMER with "minutes" (decimals allowed) and a short "name" (one or two words). Add "alert" only if the recipe says to stir or turn during it: { "label": "Stir", "every": 2 } (minutes) or { "label": "Flip", "halfway": true }.
- Steps are in cooking order. Leave "after" out when a step simply follows the previous one. Use "after" with one or more ids to start something alongside another step or to wait for several steps.
- Give each step a short unique "id".

Recipe:
`

export type Imported = { recipe: Recipe; error?: undefined } | { recipe?: undefined; error: string }

type Loose = Record<string, unknown>
const isRecord = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() && Number.isFinite(Number(v))
      ? Number(v)
      : null

/** The JSON out of whatever was pasted: code fences and chatter around it are ignored. */
function findJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = fenced?.[1] ?? text
  const from = body.indexOf('{')
  const to = body.lastIndexOf('}')
  return from >= 0 && to > from ? body.slice(from, to + 1) : body
}

function alertFrom(v: unknown, stepNo: number): AlertPlan | string {
  if (v == null) return NO_ALERTS
  if (!isRecord(v)) return `Step ${stepNo}: "alert" should be an object`
  const label = str(v.label) || 'Check'
  const every = num(v.every)
  if (every !== null) {
    if (every <= 0) return `Step ${stepNo}: "every" should be minutes, above 0`
    return { kind: 'every', everyMs: Math.round(every * 60_000), label, pause: v.pause === true }
  }
  if (v.halfway === true) return { kind: 'half', everyMs: 0, label, pause: v.pause !== false }
  return `Step ${stepNo}: an alert needs "every" (minutes) or "halfway": true`
}

export function parseRecipeJson(text: string): Imported {
  if (!text.trim()) return { error: 'Paste the JSON first.' }
  let data: unknown
  try {
    data = JSON.parse(findJson(text))
  } catch {
    return { error: "That isn't valid JSON. Copy the whole reply, from the first { to the last }." }
  }
  if (!isRecord(data)) return { error: 'The JSON should be one object, starting with {.' }

  const name = str(data.name)
  if (!name) return { error: 'The recipe needs a "name".' }
  const serves = num(data.serves)
  if (data.serves != null && (serves === null || serves <= 0)) return { error: '"serves" should be a number above 0.' }

  const ingredients: Ingredient[] = []
  if (data.ingredients != null) {
    if (!Array.isArray(data.ingredients)) return { error: '"ingredients" should be a list.' }
    for (const [i, raw] of data.ingredients.entries()) {
      const item: Loose = isRecord(raw) ? raw : { name: raw }
      const iName = str(item.name)
      if (!iName) return { error: `Ingredient ${i + 1} has no "name".` }
      if (findIngredient(ingredients, iName)) continue
      const amount = num(item.amount)
      if (item.amount != null && (amount === null || amount <= 0))
        return { error: `Ingredient "${iName}": "amount" should be a number above 0.` }
      ingredients.push({ id: uid(), name: iName, amount, unit: str(item.unit) })
    }
  }

  if (!Array.isArray(data.steps) || !data.steps.length)
    return { error: 'The recipe needs at least one step in "steps".' }
  const steps: Step[] = []
  const idOf = new Map<string, string>() // the JSON's ids → ours
  const given: string[] = []
  for (const [i, raw] of data.steps.entries()) {
    const no = i + 1
    if (!isRecord(raw)) return { error: `Step ${no} should be an object.` }
    const key = str(raw.id) || String(no)
    if (idOf.has(key)) return { error: `Two steps have the id "${key}".` }
    const id = uid()
    idOf.set(key, id)
    given.push(key)
    const type = str(raw.type).toLowerCase()
    if (type === 'timer') {
      const minutes = num(raw.minutes) ?? (num(raw.seconds) !== null ? (num(raw.seconds) as number) / 60 : null)
      if (minutes === null || minutes <= 0) return { error: `Step ${no} is a timer but has no "minutes".` }
      if (minutes > 24 * 60) return { error: `Step ${no}: a timer can be at most 24 hours.` }
      const plan = alertFrom(raw.alert, no)
      if (typeof plan === 'string') return { error: plan }
      const tName = str(raw.name) || str(raw.text)
      steps.push({ id, kind: 'timer', name: tName, durationMs: Math.round(minutes * 60) * 1000, plan, after: [] })
    } else if (type === 'instruction' || type === 'note' || (!type && str(raw.text))) {
      const text = str(raw.text)
      if (!text) return { error: `Step ${no} is an instruction but has no "text".` }
      steps.push({ id, kind: 'note', text, after: [] })
      for (const mention of mentioned(text)) {
        if (!findIngredient(ingredients, mention))
          ingredients.push({ id: uid(), name: mention, amount: null, unit: '' })
      }
    } else {
      return { error: `Step ${no}: "type" should be "timer" or "instruction".` }
    }
  }

  // Links: `after` names other steps' ids; left out, a step follows the one before it.
  for (const [i, raw] of (data.steps as Loose[]).entries()) {
    const step = steps[i]
    if (!step) continue
    const after = raw.after
    if (after == null) {
      const prev = steps[i - 1]
      step.after = prev ? [prev.id] : []
      continue
    }
    const list = Array.isArray(after) ? after : [after]
    const ids: string[] = []
    for (const ref of list) {
      const key = typeof ref === 'number' ? String(ref) : str(ref)
      const target = idOf.get(key)
      if (!target) return { error: `Step ${i + 1} comes after "${key}", but no step has that id.` }
      if (target === step.id || given.indexOf(key) >= i)
        return { error: `Step ${i + 1} can only come after steps listed before it.` }
      if (!ids.includes(target)) ids.push(target)
    }
    step.after = ids
  }

  return { recipe: { id: uid(), name, steps, ingredients, serves } }
}
