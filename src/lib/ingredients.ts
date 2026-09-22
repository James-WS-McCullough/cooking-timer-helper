// Ingredients: what a recipe needs, scaled to how many it's for. Instructions name them
// in square brackets ("Add [Diced chicken]"), which is how they get into the list; amounts
// are filled in on the recipe screen. Pure.

export interface Ingredient {
  id: string
  name: string
  amount: number | null // null: "some", "to taste"
  unit: string // '' for things counted: "2 eggs"
}

/** The ingredient names an instruction mentions, in order, once each. */
export function mentioned(text: string): string[] {
  const names: string[] = []
  for (const [, name] of text.matchAll(/\[([^\]]+)\]/g)) {
    const clean = (name ?? '').trim()
    if (clean && !names.some((n) => n.toLowerCase() === clean.toLowerCase())) names.push(clean)
  }
  return names
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const findIngredient = (list: readonly Ingredient[], name: string) => list.find((i) => sameName(i.name, name))

/** How much, scaled: 300 g for 4 becomes 150 g for 2. Kept tidy: no 133.33333 g. */
export function scaled(amount: number, from: number, to: number): number {
  if (from <= 0 || to <= 0) return amount
  const raw = (amount * to) / from
  if (raw >= 100) return Math.round(raw)
  if (raw >= 10) return Math.round(raw * 2) / 2
  return Math.round(raw * 4) / 4
}

const FRACTIONS: Record<string, string> = { '.25': '¼', '.5': '½', '.75': '¾' }

/** "300 g", "1½ tbsp", "2", "½": the number as a cook would write it. */
export function formatAmount(amount: number, unit = ''): string {
  const whole = Math.floor(amount)
  const rest = FRACTIONS[(amount - whole).toFixed(2).replace(/0$/, '').replace(/^0/, '')] ?? ''
  let n: string
  if (rest) n = whole ? `${whole}${rest}` : rest
  else n = String(Math.round(amount * 100) / 100)
  return unit ? `${n} ${unit}` : n
}

/** The line for the list or a chip: "300 g diced chicken", "2 eggs", "salt". */
export function describeIngredient(i: Ingredient, from: number | null, to: number | null): string {
  const name = i.name.charAt(0).toLowerCase() + i.name.slice(1)
  if (i.amount === null) return name
  const amount = from && to ? scaled(i.amount, from, to) : i.amount
  return `${formatAmount(amount, i.unit)} ${name}`
}

/** An instruction, with its bracketed ingredients replaced by their scaled lines, as text and chip pieces. */
export type Piece = { text: string; ingredient?: Ingredient }

export function pieces(text: string, list: readonly Ingredient[], from: number | null, to: number | null): Piece[] {
  const out: Piece[] = []
  let last = 0
  for (const m of text.matchAll(/\[([^\]]+)\]/g)) {
    const at = m.index ?? 0
    if (at > last) out.push({ text: text.slice(last, at) })
    const name = (m[1] ?? '').trim()
    const ingredient = findIngredient(list, name)
    out.push(ingredient ? { text: describeIngredient(ingredient, from, to), ingredient } : { text: name })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** The instruction as one plain line, for the voice and for assistive tech. */
export const plainText = (text: string, list: readonly Ingredient[], from: number | null, to: number | null) =>
  pieces(text, list, from, to)
    .map((p) => p.text)
    .join('')
