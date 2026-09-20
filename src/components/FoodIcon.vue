<script setup lang="ts">
// Icons: Microsoft Fluent Emoji (flat), MIT. Imported one by one so only these ship.
import { computed, type Component } from 'vue'
import { foodIconFor, type FoodIconKey } from '../lib/foodIcons'
import SweetPotato from '~icons/fluent-emoji-flat/roasted-sweet-potato'
import Fries from '~icons/fluent-emoji-flat/french-fries'
import Cookie from '~icons/fluent-emoji-flat/cookie'
import Cake from '~icons/fluent-emoji-flat/shortcake'
import Pancakes from '~icons/fluent-emoji-flat/pancakes'
import Waffle from '~icons/fluent-emoji-flat/waffle'
import Croissant from '~icons/fluent-emoji-flat/croissant'
import Pie from '~icons/fluent-emoji-flat/pie'
import Pizza from '~icons/fluent-emoji-flat/pizza'
import Bread from '~icons/fluent-emoji-flat/bread'
import Burger from '~icons/fluent-emoji-flat/hamburger'
import HotDog from '~icons/fluent-emoji-flat/hot-dog'
import Bacon from '~icons/fluent-emoji-flat/bacon'
import Chicken from '~icons/fluent-emoji-flat/poultry-leg'
import Shrimp from '~icons/fluent-emoji-flat/shrimp'
import Fish from '~icons/fluent-emoji-flat/fish'
import Potato from '~icons/fluent-emoji-flat/potato'
import Noodles from '~icons/fluent-emoji-flat/steaming-bowl'
import Pasta from '~icons/fluent-emoji-flat/spaghetti'
import Rice from '~icons/fluent-emoji-flat/cooked-rice'
import Dumpling from '~icons/fluent-emoji-flat/dumpling'
import Taco from '~icons/fluent-emoji-flat/taco'
import Burrito from '~icons/fluent-emoji-flat/burrito'
import Aubergine from '~icons/fluent-emoji-flat/eggplant'
import Egg from '~icons/fluent-emoji-flat/egg'
import Corn from '~icons/fluent-emoji-flat/ear-of-corn'
import Carrot from '~icons/fluent-emoji-flat/carrot'
import Mushroom from '~icons/fluent-emoji-flat/mushroom'
import Onion from '~icons/fluent-emoji-flat/onion'
import Tomato from '~icons/fluent-emoji-flat/tomato'
import Pepper from '~icons/fluent-emoji-flat/bell-pepper'
import Garlic from '~icons/fluent-emoji-flat/garlic'
import Beans from '~icons/fluent-emoji-flat/beans'
import Veg from '~icons/fluent-emoji-flat/broccoli'
import Salad from '~icons/fluent-emoji-flat/green-salad'
import Cheese from '~icons/fluent-emoji-flat/cheese-wedge'
import Roast from '~icons/fluent-emoji-flat/meat-on-bone'
import Meat from '~icons/fluent-emoji-flat/cut-of-meat'
import Curry from '~icons/fluent-emoji-flat/curry-rice'
import Pot from '~icons/fluent-emoji-flat/pot-of-food'
import Tea from '~icons/fluent-emoji-flat/teacup-without-handle'
import Coffee from '~icons/fluent-emoji-flat/hot-beverage'
import Popcorn from '~icons/fluent-emoji-flat/popcorn'
import Nuts from '~icons/fluent-emoji-flat/peanuts'
import Oven from '~icons/fluent-emoji-flat/fire'
import Pan from '~icons/fluent-emoji-flat/cooking'
import TimerClock from '~icons/fluent-emoji-flat/timer-clock'

const ICONS: Record<FoodIconKey, Component> = {
  'sweet-potato': SweetPotato,
  fries: Fries,
  cookie: Cookie,
  cake: Cake,
  pancakes: Pancakes,
  waffle: Waffle,
  croissant: Croissant,
  pie: Pie,
  pizza: Pizza,
  bread: Bread,
  burger: Burger,
  'hot-dog': HotDog,
  bacon: Bacon,
  chicken: Chicken,
  shrimp: Shrimp,
  fish: Fish,
  potato: Potato,
  noodles: Noodles,
  pasta: Pasta,
  rice: Rice,
  dumpling: Dumpling,
  taco: Taco,
  burrito: Burrito,
  aubergine: Aubergine,
  egg: Egg,
  corn: Corn,
  carrot: Carrot,
  mushroom: Mushroom,
  onion: Onion,
  tomato: Tomato,
  pepper: Pepper,
  garlic: Garlic,
  beans: Beans,
  veg: Veg,
  salad: Salad,
  cheese: Cheese,
  roast: Roast,
  meat: Meat,
  curry: Curry,
  pot: Pot,
  tea: Tea,
  coffee: Coffee,
  popcorn: Popcorn,
  nuts: Nuts,
  oven: Oven,
  pan: Pan,
  timer: TimerClock,
}

const props = defineProps<{ name: string }>()
const icon = computed(() => ICONS[foodIconFor(props.name)])
</script>

<template>
  <component :is="icon" class="food-icon" aria-hidden="true" />
</template>

<style scoped>
/* Sized by the parent's font-size, so it scales with whatever text it sits beside. */
.food-icon {
  flex: none;
  width: 1.4em;
  height: 1.4em;
}
</style>
