import type { FoodEntry } from '../data/foods'

const normalise = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // "sauté" finds "saute"
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim()

/**
 * Rank: the name starts with the query, then a later word in the name does,
 * then one of the extra search words does, then the query appears mid-word.
 * Every word typed has to match somewhere. Ties stay alphabetical.
 */
function score(entry: FoodEntry, words: string[]): number {
  const name = normalise(entry[0])
  const extra = normalise(entry[2] ?? '')
  let worst = 0
  for (const word of words) {
    let s: number
    if (name.startsWith(word)) s = 0
    else if (name.includes(' ' + word)) s = 1
    else if (extra.startsWith(word) || extra.includes(' ' + word)) s = 2
    else if (name.includes(word) || extra.includes(word)) s = 3
    else return -1
    worst = Math.max(worst, s)
  }
  return worst
}

/** An empty query returns the whole list, so focusing the box shows everything to browse. */
export function searchFoods<T extends FoodEntry>(foods: readonly T[], query: string): T[] {
  const words = normalise(query).split(' ').filter(Boolean)
  if (!words.length) return [...foods]
  return foods
    .map((entry, i) => ({ entry, i, s: score(entry, words) }))
    .filter((r) => r.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((r) => r.entry)
}
