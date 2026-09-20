// Picks an icon for whatever the cook called the timer. Pure string matching,
// so it works for typed names too ("Wedges" → potato), not just the preset chips.

export type FoodIconKey = (typeof RULES)[number][0] | 'timer'

// First match wins, so order matters: specific before general ("sweet potato"
// before "potato", "garlic bread" before "garlic"), and appliances last so
// "fried rice" is rice, not a pan. Patterns match from the start of a word.
const RULES = [
  ['sweet-potato', 'sweet potato|yam'],
  ['fries', 'fries|french fr'],
  ['cookie', 'cookie|biscuit|flapjack'],
  ['cake', 'cake|sponge|brownie|muffin|cupcake|crumble'],
  ['pancakes', 'pancake|crepe|crêpe'],
  ['waffle', 'waffle'],
  ['croissant', 'croissant|pastry|pastries'],
  ['pie', 'pie|quiche|tart|wellington'],
  ['pizza', 'pizza|calzone'],
  ['bread', 'bread|toast|loaf|bun|roll|bagel|naan|pitta|focaccia|crumpet'],
  ['burger', 'burger|hamburger|cheeseburger|patty|patties'],
  ['hot-dog', 'sausage|hot ?dog|banger|frank|chorizo|bratwurst|chipolata'],
  ['bacon', 'bacon|rasher|pancetta'],
  ['chicken', 'chicken|turkey|wing|drumstick|thigh|duck|poultry|nugget|goujon|kiev'],
  ['shrimp', 'prawn|shrimp|scampi'],
  ['fish', 'fish|salmon|cod|tuna|haddock|trout|bass|mackerel|kipper|plaice|halibut|bream'],
  ['potato', 'potato|wedge|mash|roastie|spud|jacket|hash ?brown|chips|gnocchi|dauphinoise'],
  ['noodles', 'noodle|ramen|udon|pho|pad thai'],
  ['pasta', 'pasta|spaghetti|penne|linguine|macaroni|mac |lasagn|tagliatelle|fusilli|ravioli|tortellini|carbonara'],
  ['rice', 'rice|risotto|pilaf|pilau|paella|biryani'],
  ['dumpling', 'dumpling|gyoza|dim sum|bao'],
  ['taco', 'taco|nacho'],
  ['burrito', 'burrito|wrap|fajita|quesadilla|enchilada'],
  ['aubergine', 'aubergine|eggplant'],
  ['egg', 'egg|omelet|frittata'],
  ['corn', 'corn'],
  ['carrot', 'carrot|parsnip|swede'],
  ['mushroom', 'mushroom'],
  ['onion', 'onion|shallot|leek'],
  ['tomato', 'tomato'],
  ['pepper', 'pepper'],
  ['garlic', 'garlic'],
  ['beans', 'bean|lentil|chickpea|dal|dhal'],
  ['veg', 'veg|broccoli|green|sprout|cauliflower|asparagus|cabbage|kale|spinach|courgette|peas'],
  ['salad', 'salad'],
  ['cheese', 'cheese|halloumi|paneer|brie|camembert'],
  ['roast', 'lamb|rib|roast|joint|gammon|ham|brisket|shank|leg of'],
  ['meat', 'meat|steak|beef|pork|chop|mince|kebab|venison|fillet|sirloin|ribeye'],
  ['curry', 'curry|korma|tikka|masala|madras|katsu'],
  ['pot', 'sauce|soup|stew|gravy|chill?i|casserole|stock|bolognese|ragu|broth|tagine|hotpot'],
  ['tea', 'tea'],
  ['coffee', 'coffee|espresso'],
  ['popcorn', 'popcorn'],
  ['nuts', 'nut'],
  ['oven', 'oven|grill|bbq|barbecue|bake|tray'],
  ['pan', 'pan|fry|fried|saute|sauté|wok|skillet'],
] as const

const COMPILED = RULES.map(([key, pattern]) => [key, new RegExp(`\\b(?:${pattern})`, 'i')] as const)

export function foodIconFor(name: string): FoodIconKey {
  for (const [key, re] of COMPILED) if (re.test(name)) return key
  return 'timer'
}
