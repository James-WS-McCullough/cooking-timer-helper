import { describe, expect, it } from 'vitest'
import { parseSpoken, soundOf } from './spoken'

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

  it('finds the food and the time inside a whole sentence, in either order', () => {
    expect(heard('Start a timer for this pork, for 20 minutes')).toEqual(['Pork', 20, false])
    expect(heard('Set a 20 minute timer for the pork')).toEqual(['Pork', 20, false])
    expect(heard('Can you time my chicken thighs for thirty five minutes please')).toEqual([
      'Chicken thighs',
      35,
      false,
    ])
    expect(heard('I need an hour and a half for the lamb')).toEqual(['Lamb', 90, false])
    expect(heard('Give the rice ten minutes')).toEqual(['Rice', 10, false])
    expect(heard('Put the potatoes on for 45 minutes')).toEqual(['Potatoes', 45, false])
    expect(heard('Prepare a timer for those roast potatoes, 45 minutes')).toEqual(['Roast potatoes', 45, true])
    expect(heard('toad in the hole 25 minutes')).toEqual(['Toad in the hole', 25, false]) // middles are kept
  })

  it("keeps a dish's own small words, and drops where it's cooking", () => {
    expect(heard('Pigs in blankets 25 minutes')).toEqual(['Pigs in blankets', 25, false])
    expect(heard('mac and cheese for 20')).toEqual(['Mac and cheese', 20, false])
    expect(heard('Devils on horseback, twelve minutes')).toEqual(['Devils on horseback', 12, false])
    expect(heard('Put the cheese on toast under the grill for 3 minutes')).toEqual(['Cheese on toast', 3, false])
    expect(heard('I want to prep my five spice chicken for the oven, 40 minutes')).toEqual([
      'Five spice chicken',
      40,
      true,
    ])
    expect(heard('two hour slow roast lamb shoulder timer')).toEqual(['Slow roast lamb shoulder', 120, false])
    expect(heard('rest the steak for 5 minutes')).toEqual(['Rest the steak', 5, false]) // a task is a fine name
  })

  it('takes a long, rambling request', () => {
    expect(
      heard(
        'Hey Sizzle, can you please set me a timer for, um, the roast chicken, for about an hour and twenty minutes, thanks',
      ),
    ).toEqual(['Roast chicken', 80, false])
    expect(heard('the pork wants another twenty')).toEqual(['Pork', 20, false])
    expect(heard('twenty more on the pork')).toEqual(['Pork', 20, false])
    expect(heard('stock needs to simmer for 3 hours')).toEqual(['Stock', 180, false])
    expect(heard('Set a timer for our turkey, three hours')).toEqual(['Turkey', 180, false]) // "for our" is not 4 hours
    expect(heard('give it ten minutes')).toEqual(['', 10, false])
    expect(heard('Set a timer')).toEqual(['', null, false])
  })

  it('copes with what a speech model really writes', () => {
    expect(heard('Turkey to our thirty.')).toEqual(['Turkey', 150, false]) // "two hours thirty"
    expect(heard('Past eight.')).toEqual(['Pasta', 8, false])
    expect(heard('rise 10')).toEqual(['Rice', 10, false])
    expect(heard('Boiled egg 6 minutes')).toEqual(['Boiled eggs', 6, false])
    expect(heard('An hour and a half-lamb')).toEqual(['Lamb', 90, false])
  })

  it('snaps a name to the food list when it sounds like one, from real transcripts', () => {
    expect(heard('Chicken ties thirty five minutes.')).toEqual(['Chicken thighs', 35, false])
    expect(heard('Rose potatoes for the five minutes.')).toEqual(['Roast potatoes', 45, false])
    expect(heard('Supe Fifteen minutes.')).toEqual(['Soup', 15, false])
    expect(heard('The dull wants 25 minutes.')).toEqual(['Dal', 25, false])
    expect(heard('Could you set a timer for the lasagna for the minutes?')).toEqual(['Lasagne', 40, false])
    expect(soundOf('chicken thighs')).toBe(soundOf('chicken ties'))
    expect(soundOf('beans')).not.toBe(soundOf('buns'))
  })

  it("keeps a cook's own name, only tidied", () => {
    expect(heard("grandma's pie 40")).toEqual(['Grandmas pie', 40, false])
    expect(heard('cheesy garlic bread fifteen')).toEqual(['Cheesy garlic bread', 15, false])
    // "Thyme" is always heard as "time", which at the front of a name is sentence, not food.
    expect(heard('Time and Garlic Bread Fifteen.')).toEqual(['Garlic bread', 15, false])
    expect(heard('bake 25')).toEqual(['Bake', 25, false]) // one letter from Cake, but not the same first letter
    expect(heard('peaking duck 90 minutes')).toEqual(['Peaking duck', 90, false]) // not on the list: left as heard
    expect(heard('Suit 15 minutes')).toEqual(['Suit', 15, false]) // too short and too different to call it Soup
    expect(heard('buns 10 minutes')).toEqual(['Buns', 10, false]) // doesn't sound like Beans
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
