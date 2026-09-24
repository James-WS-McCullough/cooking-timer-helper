import { describe, expect, it } from 'vitest'
import { layout, totalMs } from './recipe'
import { IMPORT_PROMPT, parseRecipeJson } from './recipeImport'

const MIN = 60_000

const CURRY = {
  name: 'Chicken curry',
  serves: 4,
  ingredients: [{ name: 'Diced chicken', amount: 500, unit: 'g' }, { name: 'Onion', amount: 1 }, { name: 'Salt' }],
  steps: [
    { id: 'onions', type: 'instruction', text: 'Chop the [Onion] and fry until soft' },
    { id: 'fry', type: 'timer', name: 'Onions', minutes: 6 },
    { id: 'chicken', type: 'instruction', text: 'Add the [Diced chicken]' },
    { id: 'brown', type: 'timer', name: 'Chicken', minutes: 8, alert: { label: 'Stir', every: 2 } },
    { id: 'rice', type: 'timer', name: 'Rice', minutes: 12, after: ['chicken'] },
    { id: 'serve', type: 'instruction', text: 'Serve with the rice', after: ['brown', 'rice'] },
  ],
}

describe('parseRecipeJson', () => {
  it("reads the prompt's own example, links and all", () => {
    const { recipe, error } = parseRecipeJson(JSON.stringify(CURRY))
    expect(error).toBeUndefined()
    expect(recipe?.name).toBe('Chicken curry')
    expect(recipe?.serves).toBe(4)
    expect(recipe?.ingredients?.map((i) => [i.name, i.amount, i.unit])).toEqual([
      ['Diced chicken', 500, 'g'],
      ['Onion', 1, ''],
      ['Salt', null, ''],
    ])
    const steps = recipe?.steps ?? []
    expect(steps.map((s) => s.kind)).toEqual(['note', 'timer', 'note', 'timer', 'timer', 'note'])
    expect(steps[1]).toMatchObject({ name: 'Onions', durationMs: 6 * MIN, after: [steps[0]?.id] })
    expect(steps[3]).toMatchObject({ plan: { kind: 'every', everyMs: 2 * MIN, label: 'Stir', pause: false } })
    expect(steps[4]?.after).toEqual([steps[2]?.id]) // rice alongside the chicken
    expect(steps[5]?.after).toEqual([steps[3]?.id, steps[4]?.id]) // a join
    expect(layout(recipe!).map((r) => r.length)).toEqual([1, 1, 1, 2, 1])
    expect(totalMs(recipe!)).toBe(18 * MIN) // rice runs alongside the chicken
  })

  it('the prompt contains that example, so what it asks for is what is parsed', () => {
    const json = IMPORT_PROMPT.slice(IMPORT_PROMPT.indexOf('Format:') + 7, IMPORT_PROMPT.indexOf('Rules:'))
    expect(parseRecipeJson(json).recipe?.steps).toHaveLength(6)
  })

  it('forgives what an AI adds round the JSON: fences and a sentence', () => {
    const wrapped = `Here you go:\n\`\`\`json\n${JSON.stringify(CURRY)}\n\`\`\`\nEnjoy!`
    expect(parseRecipeJson(wrapped).recipe?.name).toBe('Chicken curry')
  })

  it('fills in what is left out: ids, types for instructions, a halfway alert, seconds', () => {
    const { recipe } = parseRecipeJson(
      JSON.stringify({
        name: 'eggs',
        steps: [
          { text: 'Boil the water' },
          { type: 'timer', name: 'Eggs', seconds: 390, alert: { label: 'Flip', halfway: true } },
        ],
      }),
    )
    expect(recipe?.steps[1]).toMatchObject({ durationMs: 390_000, plan: { kind: 'half', label: 'Flip', pause: true } })
    expect(recipe?.steps[1]?.after).toEqual([recipe?.steps[0]?.id])
    expect(recipe?.serves).toBeNull()
  })

  it('an instruction naming an [ingredient] not in the list adds it, amount to fill in', () => {
    const { recipe } = parseRecipeJson(
      JSON.stringify({ name: 'x', steps: [{ type: 'instruction', text: 'Add [Butter]' }] }),
    )
    expect(recipe?.ingredients).toMatchObject([{ name: 'Butter', amount: null }])
  })

  it('says plainly what is wrong, and where', () => {
    const bad = (obj: unknown) => parseRecipeJson(typeof obj === 'string' ? obj : JSON.stringify(obj)).error
    expect(bad('')).toBe('Paste the JSON first.')
    expect(bad('{ not json')).toMatch(/valid JSON/)
    expect(bad([])).toMatch(/one object/)
    expect(bad({ steps: [] })).toMatch(/"name"/)
    expect(bad({ name: 'x', steps: [] })).toMatch(/at least one step/)
    expect(bad({ name: 'x', steps: [{ type: 'timer', name: 'Rice' }] })).toBe('Step 1 is a timer but has no "minutes".')
    expect(bad({ name: 'x', steps: [{ type: 'soup' }] })).toMatch(/Step 1: "type"/)
    expect(bad({ name: 'x', steps: [{ type: 'instruction', text: 'a', after: ['nope'] }] })).toMatch(
      /no step has that id/,
    )
    expect(bad({ name: 'x', steps: [{ id: 'a', type: 'instruction', text: 'a', after: ['a'] }] })).toMatch(/before it/)
    expect(
      bad({
        name: 'x',
        steps: [
          { id: 'a', text: 'a' },
          { id: 'a', text: 'b' },
        ],
      }),
    ).toMatch(/Two steps/)
    expect(bad({ name: 'x', serves: 'lots', steps: [{ text: 'a' }] })).toMatch(/"serves"/)
    expect(bad({ name: 'x', ingredients: [{ amount: 3 }], steps: [{ text: 'a' }] })).toBe('Ingredient 1 has no "name".')
  })
})
