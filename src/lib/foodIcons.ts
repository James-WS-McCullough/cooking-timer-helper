// Picks an icon for whatever the cook called the timer. Names from the built-in
// food list carry their own icon; anything else is matched by keyword, so typed
// names work too ("Wedges" → potato). Icons are Fluent Emoji names.

import { FOODS } from '../data/foods'

export type FoodIconName = (typeof RULES)[number][0] | (typeof FOODS)[number][1] | typeof FALLBACK

const FALLBACK = 'timer-clock'
const LISTED = new Map<string, FoodIconName>(FOODS.map(([name, icon]) => [name.toLowerCase(), icon]))

// First match wins, so order matters: specific before general ("sweet potato"
// before "potato", "garlic bread" before "garlic"), and appliances last so
// "fried rice" is rice, not a pan. Patterns match from the start of a word.
const RULES = [
  ['shortcake', '^bak(?:e|ing)$'], // the "Bake" chip; "Baked potato" is still a potato
  ['roasted-sweet-potato', 'sweet potato|yam'],
  ['french-fries', 'fries|french fr'],
  ['cookie', 'cookie|biscuit|flapjack'],
  ['shortcake', 'cake|sponge|brownie|muffin|cupcake|crumble'],
  ['pancakes', 'pancake|crepe|crêpe'],
  ['waffle', 'waffle'],
  ['croissant', 'croissant|pastry|pastries'],
  ['pie', 'pie|quiche|tart|wellington'],
  ['pizza', 'pizza|calzone'],
  ['bread', 'bread|toast|loaf|bun|roll|bagel|naan|pitta|focaccia|crumpet'],
  ['hamburger', 'burger|hamburger|cheeseburger|patty|patties'],
  ['hot-dog', 'sausage|hot ?dog|banger|frank|chorizo|bratwurst|chipolata'],
  ['bacon', 'bacon|rasher|pancetta'],
  ['poultry-leg', 'chicken|turkey|wing|drumstick|thigh|duck|poultry|nugget|goujon|kiev'],
  ['shrimp', 'prawn|shrimp|scampi'],
  ['fish', 'fish|salmon|cod|tuna|haddock|trout|bass|mackerel|kipper|plaice|halibut|bream'],
  ['potato', 'potato|wedge|mash|roastie|spud|jacket|hash ?brown|chips|gnocchi|dauphinoise'],
  ['steaming-bowl', 'noodle|ramen|udon|pho|pad thai'],
  ['spaghetti', 'pasta|spaghetti|penne|linguine|macaroni|mac |lasagn|tagliatelle|fusilli|ravioli|tortellini|carbonara'],
  ['cooked-rice', 'rice|risotto|pilaf|pilau|paella|biryani'],
  ['dumpling', 'dumpling|gyoza|dim sum|bao'],
  ['taco', 'taco|nacho'],
  ['burrito', 'burrito|wrap|fajita|quesadilla|enchilada'],
  ['eggplant', 'aubergine|eggplant'],
  ['egg', 'egg|omelet|frittata'],
  ['ear-of-corn', 'corn'],
  ['carrot', 'carrot|parsnip|swede'],
  ['mushroom', 'mushroom'],
  ['onion', 'onion|shallot|leek'],
  ['tomato', 'tomato'],
  ['bell-pepper', 'pepper'],
  ['garlic', 'garlic'],
  ['beans', 'bean|lentil|chickpea|dal|dhal'],
  ['broccoli', 'veg|broccoli|green|sprout|cauliflower|asparagus|cabbage|kale|spinach|courgette|peas'],
  ['green-salad', 'salad'],
  ['cheese-wedge', 'cheese|halloumi|paneer|brie|camembert'],
  ['meat-on-bone', 'lamb|rib|roast|joint|gammon|ham|brisket|shank|leg of'],
  ['cut-of-meat', 'meat|steak|beef|pork|chop|mince|kebab|venison|fillet|sirloin|ribeye'],
  ['curry-rice', 'curry|korma|tikka|masala|madras|katsu'],
  ['pot-of-food', 'sauce|soup|stew|gravy|chill?i|casserole|stock|bolognese|ragu|broth|tagine|hotpot'],
  ['teacup-without-handle', 'tea'],
  ['hot-beverage', 'coffee|espresso'],
  ['popcorn', 'popcorn'],
  ['peanuts', 'nut'],
  ['fire', 'oven|grill|bbq|barbecue|bake|tray'],
  ['cooking', 'pan|fry|fried|saute|sauté|wok|skillet'],
] as const

const COMPILED = RULES.map(([icon, pattern]) => [icon, new RegExp(`\\b(?:${pattern})`, 'i')] as const)

export function foodIconFor(name: string): FoodIconName {
  const listed = LISTED.get(name.trim().toLowerCase())
  if (listed) return listed
  for (const [icon, re] of COMPILED) if (re.test(name)) return icon
  return FALLBACK
}
