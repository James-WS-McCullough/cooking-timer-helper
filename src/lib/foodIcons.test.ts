import { describe, expect, it } from 'vitest'
import { foodIconFor } from './foodIcons'

describe('foodIconFor', () => {
  it('covers every name offered in the wizard', () => {
    const chips = { Potatoes: 'potato', Sausages: 'hot-dog', Chicken: 'chicken', Fish: 'fish', Pasta: 'pasta', Rice: 'rice', Eggs: 'egg', Veg: 'veg', Meat: 'meat', Sauce: 'pot', Oven: 'oven', Pan: 'pan' }
    for (const [name, icon] of Object.entries(chips)) expect(foodIconFor(name), name).toBe(icon)
  })

  it('understands typed names', () => {
    expect(foodIconFor('Wedges')).toBe('potato')
    expect(foodIconFor('salmon fillets')).toBe('fish')
    expect(foodIconFor('Roast lamb')).toBe('roast')
    expect(foodIconFor('Yorkshire puddings')).toBe('timer')
    expect(foodIconFor('')).toBe('timer')
  })

  it('prefers the specific food over a general word in the same name', () => {
    expect(foodIconFor('Sweet potato fries')).toBe('sweet-potato')
    expect(foodIconFor('Garlic bread')).toBe('bread')
    expect(foodIconFor('Fried rice')).toBe('rice')
    expect(foodIconFor('Fish and chips')).toBe('fish')
    expect(foodIconFor('Eggplant parm')).toBe('aubergine')
    expect(foodIconFor('Hamburgers')).toBe('burger')
    expect(foodIconFor('Pancakes')).toBe('pancakes')
    expect(foodIconFor('Steak')).toBe('meat') // not "tea"
  })
})
