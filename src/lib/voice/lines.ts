// Sizzle's dialogue. One pool of lines per situation; she picks one at random
// (never the same twice running). Placeholders are filled in by phrases.ts:
//
//   {food}   the timer's name, lower-cased unless it has its own capitals   potatoes · roast chicken · Yorkshire puddings
//   {Food}   the same, capitalised for the start of a sentence             Potatoes
//   {is}     is / are        {it}  it / them        {those}  that / those  (agree with the name)
//   {time}   the timer's length as spoken                                  6 minutes · 1 hour 5 minutes · 30 seconds
//   {verb}   the alert word, lower-case: flip · stir · check · baste       {Verb}  capitalised
//   {name}   the name exactly as written (used for tasks: "Boil water")
//   {other}  a second waiting timer's name, as {food}
//
// Rules for a line: short enough to take in over a sizzling pan (about 9 words at
// most), grammatical for singular AND plural names, no claims she can't know
// ("smells good" is fine as banter; "golden brown" is not), nothing that needs a
// food-specific verb. Lines that say "cook" are skipped for drinks.
// "Waiting" lines must not say "ready": what's waiting may be a flip, not finished food.
// Alert lines must name the food: "give it a flip" is no help with three timers going.

export type LinePool =
  | 'greetFirst' // the very first time she's switched on
  | 'greet' // switched on again later
  | 'startedFood' // a named timer has just started counting             {food} {Food} {is} {it} {those} {time}
  | 'startedTask' // …named for a task or appliance, not a food           {name} {time}
  | 'startedUnnamed' //                                                   {time}
  | 'finishedFood' // a timer has finished                                {food} {Food} {is} {it} {those}
  | 'finishedTask' //                                                     {name}
  | 'finishedUnnamed'
  | 'alertFood' // a mid-way flip / stir / check / baste is due            {food} {Food} {is} {it} {those} {verb} {Verb}
  | 'alertTask' //                                                        {name} {verb} {Verb}
  | 'alertUnnamed' //                                                     {verb} {Verb}
  | 'dueFood' // Sync Finish: this dish should go on now                   {food} {Food} {is} {it} {those}
  | 'dueTask' //                                                          {name}
  | 'dueUnnamed'
  | 'nextUpFood' // a recipe's next timer step has come up, waiting for Start   {food} {Food} {is} {it} {those} {time}
  | 'nextUpTask' //                                                            {name} {time}
  | 'nextUpUnnamed' //                                                         {time}
  | 'synced' // Sync Up & Start was pressed                                {time} (when everything will be ready)
  | 'waitingOne' // the once-a-minute nudge: one thing pending             {food} {Food} {is} {it} {those}
  | 'waitingTwo' //                                                       {food} {Food} {other}
  | 'waitingMany' //                                                      {food} {Food} {other}
  | 'waitingUnnamed'

export const LINES: Record<LinePool, readonly string[]> = {
  greetFirst: ["Hello. I'm Sizzle."],
  greet: [
    "I'm Sizzle. Let's get cooking.",
    'Ready to cook?',
    'Sizzle here. What are we making?',
    'Hello again. Ready when you are.',
    'Sizzle, at your service.',
    "Hello there. Kitchen's all yours.",
    "Right then, what's cooking today?",
    'Good to see you. Shall we?',
    "I'm on timer duty. Off we go.",
  ],
  startedFood: [
    'Okay, {time} for the {food}.',
    'Okay, {time} to cook your {food}!',
    'Start cooking {those} {food}. {time} to go.',
    '{Food}: {time} on the clock.',
    "{time} for the {food}. I'll keep watch.",
    'Give {those} {food} {time}.',
    'Right then, {food}. {time}, starting now.',
    "Timer's running on the {food}: {time}.",
    'Lovely. {time} for the {food}.',
    "Let's cook the {food}. {time}.",
    "I've got the {food}. {time} to go.",
    'Starting the {food}: {time} to go.',
  ],
  startedTask: [
    '{name}: {time}. Off we go.',
    '{name}: {time} on the clock.',
    'Right then: {name}, {time}.',
    '{name} for {time}. Here we go.',
    "{name}: {time}. I'll keep watch.",
    '{name}: {time}, starting now.',
  ],
  startedUnnamed: [
    'Starting your {time} timer.',
    '{time} on the clock.',
    'Timer set for {time}.',
    'Right, {time} starts now.',
    "{time}. I'll keep watch.",
    '{time}. Away we go.',
  ],
  finishedFood: [
    'The {food} {is} ready.',
    '{Food} {is} done.',
    "Time's up on the {food}.",
    'Ding! The {food} {is} ready.',
    'Lovely. The {food} {is} done.',
    "That's the {food} done.",
    '{Food} {is} good to go.',
    'Good news: the {food} {is} ready.',
    "{Food}: time's up.",
    'There we go, the {food} {is} ready.',
    'The {food} {is} ready. Smells good from here.',
    'All yours: the {food} {is} done.',
  ],
  finishedTask: [
    '{name}: done.',
    "Time's up on {name}.",
    '{name}, finished.',
    'All done: {name}.',
    "{name}: time's up.",
    'Finished: {name}.',
  ],
  finishedUnnamed: [
    'Your timer is ready.',
    "Time's up.",
    'Ding! All done.',
    "That one's done.",
    'All done there.',
    "Right, that's finished.",
  ],
  alertFood: [
    '{Verb} the {food}.',
    'Time to {verb} the {food}.',
    'The {food}: give {it} a {verb}.',
    '{Food} {is} due a {verb}.',
    'Quick {verb} for the {food}.',
    'Go on, {verb} the {food}.',
    '{Food} could use a {verb}.',
    "Don't forget to {verb} the {food}.",
    'Time to {verb} {those} {food}.',
    'Give the {food} a {verb}.',
  ],
  alertTask: ['{Verb} now: {name}.', 'Time to {verb}: {name}.', 'Quick {verb}: {name}.', '{name}: time to {verb}.'],
  alertUnnamed: [
    'Time to {verb}.',
    '{Verb} time.',
    'Quick {verb} needed.',
    "Don't forget to {verb}.",
    'Time for a {verb}.',
  ],
  dueFood: [
    'Start the {food} now.',
    '{Food} next. Start now.',
    'On with the {food} now.',
    'Time to start the {food}.',
    '{Food}: start now.',
    'Get the {food} going now.',
    'The {food} {is} up. Start {it} now.',
    '{Food} {is} up next. Start now.',
  ],
  dueTask: ['{name}: start now.', 'Time to start: {name}.', 'Start now: {name}.', 'On with {name} now.'],
  dueUnnamed: ['Time to start the next one.', 'Next one, now.', 'On to the next one.', 'Start the next one now.'],
  nextUpFood: [
    'Next up: {food}, {time}. Start {it} when you are ready.',
    'Then the {food}, {time}. Press start when {it} {is} on.',
    '{Food} next: {time}. Start {it} when you like.',
    'Next, {food} for {time}. Whenever you are ready.',
    'The {food} {is} next. {time}. Start when ready.',
  ],
  nextUpTask: [
    'Next up: {name}, {time}. Start when you are ready.',
    'Then {name}, {time}. Press start when you like.',
    '{name} next: {time}. Start when ready.',
  ],
  nextUpUnnamed: [
    'Next up: {time}. Start it when you are ready.',
    'Then a {time} timer. Press start when you like.',
    'Next timer: {time}. Start when ready.',
  ],
  synced: [
    "Synced. Everything's ready in {time}.",
    'All synced up. Ready in {time}.',
    "Synced. {time} until everything's ready.",
    'Synced. Everything lands in {time}.',
    'Right, everything finishes in {time}.',
    "Synced up. {time} to go. I'll call each one.",
  ],
  waitingOne: [
    'The {food} {is} still waiting.',
    '{Food} {is} waiting for you.',
    "Don't forget the {food}.",
    'The {food} {is} waiting, whenever you like.',
    'Still waiting on the {food}.',
    '{Food} {is} waiting patiently.',
    "Whenever you're ready, the {food} {is} waiting.",
  ],
  waitingTwo: [
    'The {food} and the {other} are both waiting.',
    '{Food} and {other} are still waiting.',
    "Don't forget the {food} and the {other}.",
    'The {food} and the {other}, whenever you like.',
    'Still waiting: the {food} and the {other}.',
  ],
  waitingMany: [
    'The {food}, the {other} and more are waiting.',
    "Don't forget the {food}, the {other} and the rest.",
    'Lots still waiting: the {food}, the {other} and more.',
    'Quite a few things are waiting for you.',
    'A few things need you, when you can.',
  ],
  waitingUnnamed: [
    "Something's still waiting for you.",
    "There's something waiting whenever you're ready.",
    "Don't forget about that timer.",
    'Something needs you, when you can.',
    "No rush, but something's waiting.",
  ],
}
