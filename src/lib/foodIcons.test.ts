import { describe, expect, it } from 'vitest'
import { foodIconFor } from './foodIcons'

describe('foodIconFor', () => {
  it('covers every name offered in the wizard', () => {
    const chips = {
      Potatoes: 'potato',
      Sausages: 'hot-dog',
      Chicken: 'poultry-leg',
      Fish: 'fish',
      Pasta: 'spaghetti',
      Rice: 'cooked-rice',
      Eggs: 'egg',
      Veg: 'broccoli',
      Meat: 'cut-of-meat',
      Sauce: 'pot-of-food',
      Oven: 'fire',
      Pan: 'cooking',
      Pizza: 'pizza',
      Bread: 'bread',
      Bake: 'shortcake',
      Tea: 'teacup-without-handle',
    }
    for (const [name, icon] of Object.entries(chips)) expect(foodIconFor(name), name).toBe(icon)
  })

  it('uses the icon the food list gives a name, whatever the keywords would say', () => {
    expect(foodIconFor('Garlic bread')).toBe('baguette-bread')
    expect(foodIconFor('  yorkshire PUDDINGS ')).toBe(foodIconFor('Yorkshire puddings'))
    expect(foodIconFor('Yorkshire puddings')).not.toBe('timer-clock')
  })

  it('understands typed names', () => {
    expect(foodIconFor('Wedges')).toBe('potato')
    expect(foodIconFor('salmon fillets')).toBe('fish')
    expect(foodIconFor('Roast lamb')).toBe('meat-on-bone')
    expect(foodIconFor('Something mysterious')).toBe('timer-clock')
    expect(foodIconFor('')).toBe('timer-clock')
  })

  it('prefers the specific food over a general word in the same name', () => {
    expect(foodIconFor('Sweet potato fries')).toBe('roasted-sweet-potato')
    expect(foodIconFor('Cheesy garlic bread')).toBe('bread') // not garlic
    expect(foodIconFor('Fried rice')).toBe('cooked-rice')
    expect(foodIconFor('Fish and chips')).toBe('fish')
    expect(foodIconFor('Eggplant parm')).toBe('eggplant')
    expect(foodIconFor('Hamburgers')).toBe('hamburger')
    expect(foodIconFor('Pancakes')).toBe('pancakes')
    expect(foodIconFor('Steak')).toBe('cut-of-meat') // not "tea"
    expect(foodIconFor('Baked potato')).toBe('potato') // not the Bake chip's cake
  })
})
