import { describe, expect, it } from 'vitest'
import { describeIngredient, formatAmount, type Ingredient, mentioned, pieces, plainText, scaled } from './ingredients'

const chicken: Ingredient = { id: 'c', name: 'Diced chicken', amount: 300, unit: 'g' }
const eggs: Ingredient = { id: 'e', name: 'Eggs', amount: 2, unit: '' }
const salt: Ingredient = { id: 's', name: 'Salt', amount: null, unit: '' }
const list = [chicken, eggs, salt]

describe('ingredients', () => {
  it('finds the bracketed names in an instruction, once each, however capitalised', () => {
    expect(mentioned('Add [Diced chicken] and [salt], then more [diced chicken]')).toEqual(['Diced chicken', 'salt'])
    expect(mentioned('Stir to combine')).toEqual([])
  })

  it('scales sensibly: whole grams, half tablespoons, quarter eggs at most', () => {
    expect(scaled(300, 4, 2)).toBe(150)
    expect(scaled(300, 4, 3)).toBe(225)
    expect(scaled(400, 3, 4)).toBe(533)
    expect(scaled(15, 4, 3)).toBe(11.5)
    expect(scaled(2, 4, 3)).toBe(1.5)
    expect(scaled(1, 3, 1)).toBe(0.25)
    expect(scaled(2, 0, 3)).toBe(2) // no idea how many it's for: leave it
  })

  it('writes amounts the way a cook would', () => {
    expect(formatAmount(300, 'g')).toBe('300 g')
    expect(formatAmount(1.5, 'tbsp')).toBe('1½ tbsp')
    expect(formatAmount(0.5)).toBe('½')
    expect(formatAmount(2)).toBe('2')
    expect(formatAmount(2.333)).toBe('2.33')
  })

  it('describes an ingredient scaled to the servings, and one with no amount by name alone', () => {
    expect(describeIngredient(chicken, 4, 2)).toBe('150 g diced chicken')
    expect(describeIngredient(eggs, 4, 6)).toBe('3 eggs')
    expect(describeIngredient(salt, 4, 2)).toBe('salt')
    expect(describeIngredient(chicken, null, null)).toBe('300 g diced chicken')
  })

  it('splits an instruction into text and ingredient chips', () => {
    expect(pieces('Add [Diced chicken] and [salt].', list, 4, 2)).toEqual([
      { text: 'Add ' },
      { text: '150 g diced chicken', ingredient: chicken },
      { text: ' and ' },
      { text: 'salt', ingredient: salt },
      { text: '.' },
    ])
    expect(pieces('Add [butter]', list, 4, 4)).toEqual([{ text: 'Add ' }, { text: 'butter' }]) // not in the list yet
    expect(plainText('Add [Diced chicken].', list, 4, 2)).toBe('Add 150 g diced chicken.')
  })
})
