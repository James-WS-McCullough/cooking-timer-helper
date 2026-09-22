// Every food icon the app can show: Microsoft Fluent Emoji (flat), MIT. Imported one by
// one so only these ship, and all of them in one chunk that FoodIcon.vue loads on demand:
// they're a quarter of the app's code, and the start screen has no use for them.
// The import list covers every icon named in src/data/foods.ts and src/lib/foodIcons.ts.
import type { Component } from 'vue'
import Bacon from '~icons/fluent-emoji-flat/bacon'
import Bagel from '~icons/fluent-emoji-flat/bagel'
import BaguetteBread from '~icons/fluent-emoji-flat/baguette-bread'
import Beans from '~icons/fluent-emoji-flat/beans'
import BellPepper from '~icons/fluent-emoji-flat/bell-pepper'
import BirthdayCake from '~icons/fluent-emoji-flat/birthday-cake'
import BowlWithSpoon from '~icons/fluent-emoji-flat/bowl-with-spoon'
import Bread from '~icons/fluent-emoji-flat/bread'
import Broccoli from '~icons/fluent-emoji-flat/broccoli'
import Burrito from '~icons/fluent-emoji-flat/burrito'
import Butter from '~icons/fluent-emoji-flat/butter'
import Candy from '~icons/fluent-emoji-flat/candy'
import Carrot from '~icons/fluent-emoji-flat/carrot'
import CheeseWedge from '~icons/fluent-emoji-flat/cheese-wedge'
import Chestnut from '~icons/fluent-emoji-flat/chestnut'
import CookedRice from '~icons/fluent-emoji-flat/cooked-rice'
import Cookie from '~icons/fluent-emoji-flat/cookie'
import Cooking from '~icons/fluent-emoji-flat/cooking'
import Crab from '~icons/fluent-emoji-flat/crab'
import Croissant from '~icons/fluent-emoji-flat/croissant'
import Cucumber from '~icons/fluent-emoji-flat/cucumber'
import Cupcake from '~icons/fluent-emoji-flat/cupcake'
import CurryRice from '~icons/fluent-emoji-flat/curry-rice'
import Custard from '~icons/fluent-emoji-flat/custard'
import CutOfMeat from '~icons/fluent-emoji-flat/cut-of-meat'
import Doughnut from '~icons/fluent-emoji-flat/doughnut'
import Droplet from '~icons/fluent-emoji-flat/droplet'
import Dumpling from '~icons/fluent-emoji-flat/dumpling'
import EarOfCorn from '~icons/fluent-emoji-flat/ear-of-corn'
import Egg from '~icons/fluent-emoji-flat/egg'
import Eggplant from '~icons/fluent-emoji-flat/eggplant'
import Falafel from '~icons/fluent-emoji-flat/falafel'
import Fire from '~icons/fluent-emoji-flat/fire'
import Fish from '~icons/fluent-emoji-flat/fish'
import FishCakeWithSwirl from '~icons/fluent-emoji-flat/fish-cake-with-swirl'
import Flatbread from '~icons/fluent-emoji-flat/flatbread'
import Fondue from '~icons/fluent-emoji-flat/fondue'
import ForkAndKnifeWithPlate from '~icons/fluent-emoji-flat/fork-and-knife-with-plate'
import FrenchFries from '~icons/fluent-emoji-flat/french-fries'
import FriedShrimp from '~icons/fluent-emoji-flat/fried-shrimp'
import Garlic from '~icons/fluent-emoji-flat/garlic'
import GlassOfMilk from '~icons/fluent-emoji-flat/glass-of-milk'
import GreenSalad from '~icons/fluent-emoji-flat/green-salad'
import Hamburger from '~icons/fluent-emoji-flat/hamburger'
import HoneyPot from '~icons/fluent-emoji-flat/honey-pot'
import HotBeverage from '~icons/fluent-emoji-flat/hot-beverage'
import HotDog from '~icons/fluent-emoji-flat/hot-dog'
import HotPepper from '~icons/fluent-emoji-flat/hot-pepper'
import HotSprings from '~icons/fluent-emoji-flat/hot-springs'
import Ice from '~icons/fluent-emoji-flat/ice'
import Jar from '~icons/fluent-emoji-flat/jar'
import LeafyGreen from '~icons/fluent-emoji-flat/leafy-green'
import Lemon from '~icons/fluent-emoji-flat/lemon'
import Lobster from '~icons/fluent-emoji-flat/lobster'
import MeatOnBone from '~icons/fluent-emoji-flat/meat-on-bone'
import Mushroom from '~icons/fluent-emoji-flat/mushroom'
import Octopus from '~icons/fluent-emoji-flat/octopus'
import Onion from '~icons/fluent-emoji-flat/onion'
import Oyster from '~icons/fluent-emoji-flat/oyster'
import Pancakes from '~icons/fluent-emoji-flat/pancakes'
import PeaPod from '~icons/fluent-emoji-flat/pea-pod'
import Peanuts from '~icons/fluent-emoji-flat/peanuts'
import Pear from '~icons/fluent-emoji-flat/pear'
import Pie from '~icons/fluent-emoji-flat/pie'
import Pizza from '~icons/fluent-emoji-flat/pizza'
import Popcorn from '~icons/fluent-emoji-flat/popcorn'
import PotOfFood from '~icons/fluent-emoji-flat/pot-of-food'
import Potato from '~icons/fluent-emoji-flat/potato'
import PoultryLeg from '~icons/fluent-emoji-flat/poultry-leg'
import PouringLiquid from '~icons/fluent-emoji-flat/pouring-liquid'
import Pretzel from '~icons/fluent-emoji-flat/pretzel'
import RedApple from '~icons/fluent-emoji-flat/red-apple'
import RoastedSweetPotato from '~icons/fluent-emoji-flat/roasted-sweet-potato'
import Sandwich from '~icons/fluent-emoji-flat/sandwich'
import ShallowPanOfFood from '~icons/fluent-emoji-flat/shallow-pan-of-food'
import Shortcake from '~icons/fluent-emoji-flat/shortcake'
import Shrimp from '~icons/fluent-emoji-flat/shrimp'
import Snowflake from '~icons/fluent-emoji-flat/snowflake'
import Spaghetti from '~icons/fluent-emoji-flat/spaghetti'
import SteamingBowl from '~icons/fluent-emoji-flat/steaming-bowl'
import StuffedFlatbread from '~icons/fluent-emoji-flat/stuffed-flatbread'
import Sushi from '~icons/fluent-emoji-flat/sushi'
import Taco from '~icons/fluent-emoji-flat/taco'
import Tamale from '~icons/fluent-emoji-flat/tamale'
import TeacupWithoutHandle from '~icons/fluent-emoji-flat/teacup-without-handle'
import TimerClock from '~icons/fluent-emoji-flat/timer-clock'
import Tomato from '~icons/fluent-emoji-flat/tomato'
import Waffle from '~icons/fluent-emoji-flat/waffle'
import WineGlass from '~icons/fluent-emoji-flat/wine-glass'
import type { FoodIconName } from '../lib/foodIcons'

// Typed against FoodIconName, so using a new icon in foods.ts or foodIcons.ts
// without importing it here is a compile error rather than a blank space.
export const ICONS: Record<FoodIconName, Component> = {
  bacon: Bacon,
  bagel: Bagel,
  'baguette-bread': BaguetteBread,
  beans: Beans,
  'bell-pepper': BellPepper,
  'birthday-cake': BirthdayCake,
  'bowl-with-spoon': BowlWithSpoon,
  bread: Bread,
  broccoli: Broccoli,
  burrito: Burrito,
  butter: Butter,
  candy: Candy,
  carrot: Carrot,
  'cheese-wedge': CheeseWedge,
  chestnut: Chestnut,
  'cooked-rice': CookedRice,
  cookie: Cookie,
  cooking: Cooking,
  crab: Crab,
  croissant: Croissant,
  cucumber: Cucumber,
  cupcake: Cupcake,
  'curry-rice': CurryRice,
  custard: Custard,
  'cut-of-meat': CutOfMeat,
  doughnut: Doughnut,
  droplet: Droplet,
  dumpling: Dumpling,
  'ear-of-corn': EarOfCorn,
  egg: Egg,
  eggplant: Eggplant,
  falafel: Falafel,
  fire: Fire,
  fish: Fish,
  'fish-cake-with-swirl': FishCakeWithSwirl,
  flatbread: Flatbread,
  fondue: Fondue,
  'fork-and-knife-with-plate': ForkAndKnifeWithPlate,
  'french-fries': FrenchFries,
  'fried-shrimp': FriedShrimp,
  garlic: Garlic,
  'glass-of-milk': GlassOfMilk,
  'green-salad': GreenSalad,
  hamburger: Hamburger,
  'honey-pot': HoneyPot,
  'hot-beverage': HotBeverage,
  'hot-dog': HotDog,
  'hot-pepper': HotPepper,
  'hot-springs': HotSprings,
  ice: Ice,
  jar: Jar,
  'leafy-green': LeafyGreen,
  lemon: Lemon,
  lobster: Lobster,
  'meat-on-bone': MeatOnBone,
  mushroom: Mushroom,
  octopus: Octopus,
  onion: Onion,
  oyster: Oyster,
  pancakes: Pancakes,
  'pea-pod': PeaPod,
  peanuts: Peanuts,
  pear: Pear,
  pie: Pie,
  pizza: Pizza,
  popcorn: Popcorn,
  'pot-of-food': PotOfFood,
  potato: Potato,
  'poultry-leg': PoultryLeg,
  'pouring-liquid': PouringLiquid,
  pretzel: Pretzel,
  'red-apple': RedApple,
  'roasted-sweet-potato': RoastedSweetPotato,
  sandwich: Sandwich,
  'shallow-pan-of-food': ShallowPanOfFood,
  shortcake: Shortcake,
  shrimp: Shrimp,
  snowflake: Snowflake,
  spaghetti: Spaghetti,
  'steaming-bowl': SteamingBowl,
  'stuffed-flatbread': StuffedFlatbread,
  sushi: Sushi,
  taco: Taco,
  tamale: Tamale,
  'teacup-without-handle': TeacupWithoutHandle,
  'timer-clock': TimerClock,
  tomato: Tomato,
  waffle: Waffle,
  'wine-glass': WineGlass,
}
