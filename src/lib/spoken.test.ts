import { describe, expect, it } from 'vitest'
import { parseSpoken } from './spoken'

const MIN = 60_000
const heard = (text: string) => {
  const { name, durationMs, prep } = parseSpoken(text)
  return [name, durationMs === null ? null : durationMs / MIN, prep]
}

describe('parseSpoken', () => {
  it('takes a number as minutes and the other words as the name', () => {
    expect(heard('Rice ten minutes.')).toEqual(['Rice', 10, false])
    expect(heard('pasta 8')).toEqual(['Pasta', 8, false])
    expect(heard('Chicken Thighs 35.')).toEqual(['Chicken thighs', 35, false])
    expect(heard('forty-five minutes roast potatoes')).toEqual(['Roast potatoes', 45, false])
    expect(heard('a hundred and twenty minutes brisket')).toEqual(['Brisket', 120, false])
  })

  it('understands hours, halves, quarters and seconds', () => {
    expect(heard('Turkey, two hours thirty.')).toEqual(['Turkey', 150, false])
    expect(heard('One hour twenty beef stew.')).toEqual(['Beef stew', 80, false])
    expect(heard('1 hour and 20 minutes beef stew')).toEqual(['Beef stew', 80, false])
    expect(heard('An hour and a half lamb.')).toEqual(['Lamb', 90, false])
    expect(heard('lamb two and a half hours')).toEqual(['Lamb', 150, false])
    expect(heard('half an hour bread')).toEqual(['Bread', 30, false])
    expect(heard('bread three quarters of an hour')).toEqual(['Bread', 45, false])
    expect(heard('Boiled eggs six and a half minutes.')).toEqual(['Boiled eggs', 6.5, false])
    expect(heard('Salmon ninety seconds.')).toEqual(['Salmon', 1.5, false])
    expect(heard('eggs 2 minutes 30 seconds')).toEqual(['Eggs', 2.5, false])
    expect(heard('stock 1.5 hours')).toEqual(['Stock', 90, false])
    expect(heard('gammon 1:30')).toEqual(['Gammon', 90, false])
  })

  it('preps instead of starting when asked, wherever the word falls', () => {
    expect(heard('Prep roast potatoes 45 minutes.')).toEqual(['Roast potatoes', 45, true])
    expect(heard('Prepare the gravy for twelve minutes.')).toEqual(['Gravy', 12, true])
    expect(heard('Crep roast potatoes, 45 minutes')).toEqual(['Roast potatoes', 45, true])
    expect(heard('carrots 20 minutes prep')).toEqual(['Carrots', 20, true])
    expect(heard('Start the rice for 10 minutes please')).toEqual(['Rice', 10, false])
  })

  it('copes with what a speech model really writes', () => {
    expect(heard('Turkey to our thirty.')).toEqual(['Turkey', 150, false]) // "two hours thirty"
    expect(heard('Past eight.')).toEqual(['Pasta', 8, false])
    expect(heard('rise 10')).toEqual(['Rice', 10, false])
    expect(heard('Boiled egg 6 minutes')).toEqual(['Boiled eggs', 6, false])
    expect(heard('An hour and a half-lamb')).toEqual(['Lamb', 90, false])
  })

  it("keeps a cook's own name, only tidied", () => {
    expect(heard("grandma's pie 40")).toEqual(['Grandmas pie', 40, false])
    expect(heard('Time and Garlic Bread Fifteen.')).toEqual(['Time and garlic bread', 15, false])
    expect(heard('bake 25')).toEqual(['Bake', 25, false]) // one letter from Cake, but not the same first letter
  })

  it('prefers the number that has a unit, else the last one', () => {
    expect(heard('5 spice chicken 20 minutes')).toEqual(['5 spice chicken', 20, false])
    expect(heard('5 spice chicken 20')).toEqual(['5 spice chicken', 20, false])
  })

  it('reports what it could not hear', () => {
    expect(heard('Sausages.')).toEqual(['Sausages', null, false])
    expect(heard('twelve minutes')).toEqual(['', 12, false])
    expect(heard('prep')).toEqual(['', null, true])
    expect(heard('')).toEqual(['', null, false])
    expect(heard('Um.')).toEqual(['', null, false])
    expect(heard('um, rice, er, 10')).toEqual(['Rice', 10, false])
    expect(heard('rice zero minutes')).toEqual(['Rice', null, false])
    expect(heard('rice 3000 minutes')).toEqual(['Rice', null, false]) // over a day
  })
})
