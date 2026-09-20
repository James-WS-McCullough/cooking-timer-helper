import { describe, expect, it } from 'vitest'
import { searchFoods } from './foodSearch'
import { FOODS, type FoodEntry } from '../data/foods'

const LIST: FoodEntry[] = [
  ['Aubergine', 'eggplant', 'eggplant brinjal'],
  ['Boiled eggs', 'egg'],
  ['Eggs Benedict', 'egg'],
  ['Pancakes', 'pancakes', 'crepes'],
  ['Roast potatoes', 'potato', 'roasties'],
  ['Sautéed mushrooms', 'mushroom'],
  ['Sweet potato', 'roasted-sweet-potato', 'yam'],
]
const names = (q: string) => searchFoods(LIST, q).map((e) => e[0])

describe('searchFoods', () => {
  it('shows everything for an empty query', () => {
    expect(names('')).toHaveLength(LIST.length)
    expect(names('   ')).toHaveLength(LIST.length)
  })

  it('ranks name-start, then word-start, then extra words, then mid-word', () => {
    expect(names('egg')).toEqual(['Eggs Benedict', 'Boiled eggs', 'Aubergine'])
    expect(names('pot')).toEqual(['Roast potatoes', 'Sweet potato'])
    expect(names('cake')).toEqual(['Pancakes'])
  })

  it('finds entries by their other names', () => {
    expect(names('roasties')).toEqual(['Roast potatoes'])
    expect(names('yam')).toEqual(['Sweet potato'])
  })

  it('needs every typed word to match, in any order', () => {
    expect(names('potato roast')).toEqual(['Roast potatoes'])
    expect(names('potato boiled')).toEqual([])
  })

  it('ignores case, accents and punctuation', () => {
    expect(names('SAUTE')).toEqual(['Sautéed mushrooms'])
    expect(names("eggs, ben")).toEqual(['Eggs Benedict'])
  })
})

describe('FOODS', () => {
  it('is a big list with unique names', () => {
    expect(FOODS.length).toBeGreaterThan(150)
    const keys = FOODS.map((f) => f[0].toLowerCase())
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('offers the plain one-word name first', () => {
    for (const word of ['Turkey', 'Chicken', 'Eggs', 'Beef', 'Lamb', 'Pork', 'Fish', 'Pasta', 'Cake', 'Pie', 'Water']) {
      expect(searchFoods(FOODS, word)[0]?.[0], word).toBe(word)
    }
  })

  it('can find the everyday things', () => {
    for (const q of ['potato', 'chicken', 'egg', 'rice', 'pasta', 'pizza', 'bread', 'tea', 'oven']) {
      expect(searchFoods(FOODS, q).length, q).toBeGreaterThan(0)
    }
  })
})
