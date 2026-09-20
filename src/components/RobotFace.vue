<script setup lang="ts">
// Sizzle's announcer: a bright, clean, round-faced robot.
//  - Her mouth doesn't move: it's a line of segments that light from the centre
//    outwards with her voice, like a level meter (`level`, 0…1, smoothed by the caller).
//  - Her eyes are tall rounded screens with pupils that look around by themselves,
//    settle on you while she's speaking, blink, and breathe a slow glow.
//  - `off` powers her down: lights go grey, the glow and the idle life stop, and she dims.
// The shell is deliberately pale in both themes: she's an appliance, not part of the page.
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{ level: number; speaking: boolean; off?: boolean }>()

const id = useId()
const voice = computed(() => Math.min(1, props.level * 1.9))

// ---- mouth ----
// An odd number of segments so there's one in the middle. They sit on a very shallow
// smile (SAG = 0 makes it a dead straight line), each turned to follow the curve.
const SEGMENTS = 9
const SEG = { width: 6.6, height: 8, gap: 2.6 }
const MOUTH = { x: 100, y: 138 }
const SAG = 5
const REACH = (SEGMENTS - 1) / 2 // how many segments out from the centre the last one is

const segments = Array.from({ length: SEGMENTS }, (_, i) => {
  const out = i - REACH // …-2, -1, 0, 1, 2…
  const half = REACH * (SEG.width + SEG.gap)
  const x = out * (SEG.width + SEG.gap)
  const t = half ? x / half : 0
  return {
    distance: Math.abs(out),
    transform: `translate(${MOUTH.x + x} ${MOUTH.y + SAG * (1 - t * t)}) rotate(${(Math.atan((-2 * SAG * t) / half) * 180) / Math.PI})`,
  }
})

// Quiet lights only the middle; loud reaches the ends. Each segment fades in as the
// level passes it, rather than snapping, so the line seems to swell.
const SEGMENT_BOX = { x: -SEG.width / 2, y: -SEG.height / 2, width: SEG.width, height: SEG.height, rx: 2.4 }

const lit = computed(() =>
  segments.map((seg) => (props.off ? 0 : Math.max(0, Math.min(1, voice.value * (REACH + 1.4) - seg.distance)))),
)

// A light comes on at once but dies away: each segment brightens almost instantly and
// fades over a third of a second, so syllables leave a little afterglow instead of flickering.
const RISE_MS = 40
const FADE_MS = 340
const fading = ref(segments.map(() => true))
watch(lit, (now, before) => {
  fading.value = now.map((value, i) => value <= (before?.[i] ?? 0))
})
const glow = (i: number, strength = 1) => ({
  opacity: lit.value[i] * strength,
  transitionDuration: `${fading.value[i] ? FADE_MS : RISE_MS}ms`,
})

// ---- gaze ----
// A glance is an offset of the pupils inside the eyes, in SVG units. Idle, she
// looks about at an unhurried pace; speaking, she mostly holds your eye.
const gaze = ref({ x: 0, y: 0 })
const RANGE = { x: 5.5, y: 8 }
let glanceTimer: ReturnType<typeof setTimeout> | undefined
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function glance() {
  if (props.off) {
    gaze.value = { x: 0, y: 0 }
    return // powered down: no looking about until she's switched back on
  }
  if (props.speaking) {
    // Small, attentive movements around straight ahead.
    gaze.value = { x: (Math.random() - 0.5) * 2.4, y: (Math.random() - 0.5) * 2 + 0.5 }
  } else if (Math.random() < 0.3) {
    gaze.value = { x: 0, y: 0 } // back to centre fairly often, so she doesn't seem distracted
  } else {
    gaze.value = { x: (Math.random() * 2 - 1) * RANGE.x, y: (Math.random() * 2 - 1) * RANGE.y }
  }
  glanceTimer = setTimeout(glance, props.speaking ? 900 + Math.random() * 900 : 1400 + Math.random() * 2600)
}

// Starting to speak gets her attention immediately.
watch(
  () => [props.speaking, props.off],
  () => {
    if (still) return
    clearTimeout(glanceTimer)
    glance()
  },
)

onMounted(() => {
  if (!still) glanceTimer = setTimeout(glance, 1200)
})
onBeforeUnmount(() => clearTimeout(glanceTimer))

const pupils = computed(() => ({ transform: `translate(${gaze.value.x}px, ${gaze.value.y}px)` }))
</script>

<template>
  <svg class="robot" :class="{ 'is-off': off }" viewBox="0 -34 200 234" role="img" aria-label="Sizzle's robot announcer">
    <defs>
      <filter :id="`${id}-soft`" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <!-- In drawing units, not relative to the shape: a thin curve has a tiny box, and the glow would be cropped to it. -->
      <filter :id="`${id}-wide`" filterUnits="userSpaceOnUse" x="20" y="90" width="160" height="110">
        <feGaussianBlur stdDeviation="8" />
      </filter>
      <linearGradient :id="`${id}-shell`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f0f3f7" />
        <stop offset="1" stop-color="#dbe3ed" />
      </linearGradient>
      <clipPath :id="`${id}-left`"><rect x="55" y="62" width="28" height="46" rx="14" /></clipPath>
      <clipPath :id="`${id}-right`"><rect x="117" y="62" width="28" height="46" rx="14" /></clipPath>
    </defs>

    <!-- ear pods -->
    <rect x="7" y="86" width="15" height="38" rx="7.5" class="trim" />
    <rect x="178" y="86" width="15" height="38" rx="7.5" class="trim" />

    <!-- shell -->
    <circle cx="100" cy="106" r="80" :fill="`url(#${id}-shell)`" class="shell" />

    <!-- A small chef's toque, worn at a jaunty angle. It's turned by the same 19° as the spot on her
         head it sits on, so it looks perched rather than stuck on. Outline first, then the white
         shapes again on top, which hides the outlines where the shapes overlap. -->
    <g transform="translate(124.5 35) rotate(19)" class="hat">
      <g class="hat-edge">
        <circle cx="-15" cy="-31" r="14" />
        <circle cx="0" cy="-39" r="17" />
        <circle cx="15" cy="-31" r="14" />
        <rect x="-21" y="-32" width="42" height="24" />
        <rect x="-23" y="-12" width="46" height="13" rx="3.5" />
      </g>
      <g class="hat-fill">
        <circle cx="-15" cy="-31" r="14" />
        <circle cx="0" cy="-39" r="17" />
        <circle cx="15" cy="-31" r="14" />
        <rect x="-21" y="-32" width="42" height="24" />
      </g>
      <path d="M-8 -14v-16M8 -14v-16" class="pleat" />
      <rect x="-23" y="-12" width="46" height="13" rx="3.5" class="hat-band" />
    </g>

    <!-- eyes: halo (breathing), screen, pupil; the whole group blinks -->
    <g class="eyes">
      <g class="breathe" :filter="`url(#${id}-soft)`">
        <rect x="55" y="62" width="28" height="46" rx="14" class="halo" />
        <rect x="117" y="62" width="28" height="46" rx="14" class="halo" />
      </g>
      <rect x="55" y="62" width="28" height="46" rx="14" class="lit" />
      <rect x="117" y="62" width="28" height="46" rx="14" class="lit" />
      <g :clip-path="`url(#${id}-left)`">
        <g class="pupil" :style="pupils">
          <rect x="62" y="74" width="14" height="22" rx="7" class="ink" />
          <circle cx="72" cy="79" r="2.6" class="glint" />
        </g>
      </g>
      <g :clip-path="`url(#${id}-right)`">
        <g class="pupil" :style="pupils">
          <rect x="124" y="74" width="14" height="22" rx="7" class="ink" />
          <circle cx="134" cy="79" r="2.6" class="glint" />
        </g>
      </g>
    </g>

    <!-- mouth: unlit segments, then the lit ones and their glow, brightest in the middle -->
    <g class="mouth">
      <rect v-for="(seg, i) in segments" :key="`off-${i}`" v-bind="SEGMENT_BOX" :transform="seg.transform" class="seg off" />
      <g :filter="`url(#${id}-wide)`">
        <rect
          v-for="(seg, i) in segments"
          :key="`halo-${i}`"
          v-bind="SEGMENT_BOX"
          :transform="seg.transform"
          class="seg on"
          :style="glow(i, 0.9)"
        />
      </g>
      <rect
        v-for="(seg, i) in segments"
        :key="`on-${i}`"
        v-bind="SEGMENT_BOX"
        :transform="seg.transform"
        class="seg on"
        :style="glow(i)"
      />
    </g>
  </svg>
</template>

<style scoped>
.robot {
  /* Her own palette, the same in light and dark: a white appliance with Sizzle-blue lights. */
  --shell-edge: #c6d2e0;
  --trim: #b7c5d5;
  --hat: #f3f5f8;
  --light: #38a1f2;
  --ink: #0d2740;

  width: 100%;
  max-width: 260px;
  height: auto;
  overflow: visible;
}

.shell {
  stroke: var(--shell-edge);
  stroke-width: 4;
}

.trim {
  fill: var(--trim);
}

.lit,
.halo {
  fill: var(--light);
}

.ink {
  fill: var(--ink);
}

.glint {
  fill: #fff;
  opacity: 0.9;
}

.seg.off {
  fill: var(--trim);
}

.seg.on {
  fill: var(--light);
  transition-property: opacity;
  transition-timing-function: ease-out;
}

/* Powered down: every light goes grey, the glow goes, and the whole of her dims. Powering up reverses it smoothly. */
.robot {
  transition: filter 0.45s ease;
}

.lit,
.halo {
  transition:
    fill 0.45s ease,
    opacity 0.45s ease;
}

.is-off {
  filter: brightness(0.62) saturate(0.7);
}

.is-off .lit {
  fill: #93a0af;
}

.is-off .halo {
  opacity: 0;
}

.is-off .glint {
  opacity: 0.35;
}

.is-off .breathe,
.is-off .eyes {
  animation: none;
}

.hat-edge {
  fill: var(--shell-edge);
  stroke: var(--shell-edge);
  stroke-width: 7;
  stroke-linejoin: round;
}

.hat-fill,
.hat-band {
  fill: var(--hat);
}

.hat-band {
  stroke: var(--shell-edge);
  stroke-width: 3.5;
}

.pleat {
  fill: none;
  stroke: var(--trim);
  stroke-width: 3;
  stroke-linecap: round;
}

/* Pupils glide to each new point of interest rather than snapping. */
.pupil {
  transition: transform 0.28s cubic-bezier(0.3, 0.9, 0.3, 1);
}

/* One idle cycle: the eye glow swells and fades, with a blink as it dips. */
.breathe {
  animation: breathe 5.6s ease-in-out infinite;
}

.eyes {
  transform-origin: 100px 85px;
  animation: blink 5.6s infinite;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 0.95;
  }
}

@keyframes blink {
  0%,
  94%,
  98%,
  100% {
    transform: scaleY(1);
  }
  96% {
    transform: scaleY(0.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  .breathe,
  .eyes {
    animation: none;
  }
  .breathe {
    opacity: 0.6;
  }
  .pupil {
    transition: none;
  }
}
</style>
