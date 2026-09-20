<script setup lang="ts">
// Voice lab: Alba (Piper, in the browser), pitched for character, with the robot's
// face reacting to what she says. "Copy settings" gives the numbers the app would use.
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import RobotFace from '../../src/components/RobotFace.vue'
import { isDownloaded, speak } from '../../src/lib/voice/piper'
import { PRESETS, SIZZLE, tidySettings, VoiceBox, type VoiceSettings } from '../../src/lib/voice/voiceBox'

const STORE = 'sizzle:voice-lab'
const PHRASES = [
  'The spaghetti is ready.',
  'Flip the potatoes.',
  'Start the chicken.',
  'The rice is ready. The potatoes need flipping.',
  'Stir the sauce.',
  'Hello. I am Sizzle. I will tell you when things are done.',
]

function restore(): VoiceSettings {
  try {
    return tidySettings(JSON.parse(localStorage.getItem(STORE) ?? '{}'))
  } catch {
    return { ...SIZZLE }
  }
}

const settings = reactive<VoiceSettings>(restore())
const text = ref(PHRASES[0])
const loop = ref(false)
const status = ref('')
const downloading = ref<number | null>(null)
const busy = ref(false)
const speaking = ref(false)
const level = ref(0)
const copied = ref(false)

// ---- audio ----
let ctx: AudioContext | undefined
let box: VoiceBox | undefined
let current: AudioBuffer | undefined
const clips = new Map<string, AudioBuffer>() // Alba's raw takes; pitch is rendered from these, never re-synthesised

function audio() {
  if (!ctx || !box) {
    ctx = new AudioContext()
    box = new VoiceBox(ctx)
    box.onEnded = () => {
      speaking.value = false
      if (loop.value && current) setTimeout(() => loop.value && current && play(current), 450)
    }
    requestAnimationFrame(animate)
  }
  void ctx.resume()
  return { ctx, box }
}

watch(
  settings,
  () => {
    box?.apply(settings) // heard straight away if it's talking
    localStorage.setItem(STORE, JSON.stringify(settings))
  },
  { deep: true },
)

async function clipFor(phrase: string): Promise<AudioBuffer> {
  const cached = clips.get(phrase)
  if (cached) return cached
  const { ctx } = audio()
  if (!(await isDownloaded())) status.value = 'Downloading Alba (about 63 MB, once)…'
  const wav = await speak(phrase, (done) => {
    downloading.value = done < 1 ? done : null
  })
  downloading.value = null
  const clip = await ctx.decodeAudioData(await wav.arrayBuffer())
  clips.set(phrase, clip)
  return clip
}

function stop() {
  loop.value = false
  box?.stop()
  speaking.value = false
}

async function say(phrase = text.value) {
  const wanted = phrase.trim()
  if (!wanted || busy.value) return
  text.value = wanted
  busy.value = true
  if (!clips.has(wanted)) status.value = 'Alba is thinking…'
  try {
    const started = performance.now()
    const fresh = !clips.has(wanted)
    const clip = await clipFor(wanted)
    status.value = fresh
      ? `Synthesised in ${((performance.now() - started) / 1000).toFixed(1)}s · ${clip.duration.toFixed(1)}s of speech`
      : ''
    play(clip)
  } catch (error) {
    status.value = `Couldn't synthesise: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    busy.value = false
  }
}

function play(clip: AudioBuffer) {
  const { box } = audio()
  current = clip
  speaking.value = true
  box.play(clip, settings)
}

// Mouth: quick to open, slower to close, like a jaw.
function animate() {
  const now = box?.level() ?? 0
  level.value = now > level.value ? now : level.value * 0.88 + now * 0.12
  requestAnimationFrame(animate)
}

onBeforeUnmount(() => void ctx?.close())

// ---- settings ----
function usePreset(name: string) {
  Object.assign(settings, PRESETS[name])
}

const activePreset = computed(() =>
  Object.keys(PRESETS).find((name) => JSON.stringify(PRESETS[name]) === JSON.stringify(settings)),
)

async function copySettings() {
  await navigator.clipboard.writeText(JSON.stringify(settings, null, 2))
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

interface Slider {
  key: keyof VoiceSettings
  label: string
  min: number
  max: number
  step: number
  unit?: string
  hint?: string
}

const GROUPS: { title: string; sliders: Slider[] }[] = [
  {
    title: 'Voice',
    sliders: [
      {
        key: 'pitch',
        label: 'Pitch',
        min: -12,
        max: 12,
        step: 0.5,
        unit: ' st',
        hint: 'semitones; Sizzle is +3',
      },
      { key: 'speed', label: 'Speed', min: 0.6, max: 1.6, step: 0.01, unit: '×', hint: 'tempo only; pitch is held' },
    ],
  },
  {
    title: 'Output',
    sliders: [{ key: 'gain', label: 'Volume', min: 0.2, max: 2, step: 0.05, unit: '×' }],
  },
]
</script>

<template>
  <main class="lab">
    <section class="stage">
      <RobotFace :level="level" :speaking="speaking" />

      <form class="say" @submit.prevent="say()">
        <textarea v-model="text" class="field" rows="2" aria-label="What should the robot say?" @keydown.enter.exact.prevent="say()" />
        <div class="buttons">
          <button type="submit" class="primary" :disabled="busy">{{ busy ? '…' : 'Speak' }}</button>
          <button type="button" class="chip" :aria-pressed="loop" @click="loop = !loop">Loop</button>
          <button type="button" class="chip" @click="stop">Stop</button>
        </div>
      </form>

      <p v-if="downloading !== null" class="status">
        <progress :value="downloading" max="1" /> {{ Math.round(downloading * 100) }}%
      </p>
      <p class="status" role="status">{{ status }}</p>

      <div class="phrases">
        <button v-for="p in PHRASES" :key="p" type="button" class="chip phrase" @click="say(p)">{{ p }}</button>
      </div>
      <p class="note">Turn Loop on, press Speak, then move the sliders: changes are heard straight away, mid-phrase.</p>
    </section>

    <section class="controls">
      <div class="presets">
        <button v-for="(_, name) in PRESETS" :key="name" type="button" class="chip" :aria-pressed="activePreset === name" @click="usePreset(name)">
          {{ name }}
        </button>
      </div>

      <fieldset v-for="group in GROUPS" :key="group.title">
        <legend>{{ group.title }}</legend>
        <label v-for="s in group.sliders" :key="s.key" class="slider">
          <span class="name">{{ s.label }}</span>
          <input v-model.number="settings[s.key]" type="range" :min="s.min" :max="s.max" :step="s.step" />
          <output class="tabular">{{ settings[s.key] }}{{ s.unit }}</output>
          <small v-if="s.hint">{{ s.hint }}</small>
        </label>
      </fieldset>

      <div class="buttons">
        <button type="button" class="primary" @click="copySettings">{{ copied ? 'Copied ✓' : 'Copy settings' }}</button>
        <button type="button" class="chip" @click="usePreset('Sizzle')">Reset</button>
      </div>
      <p class="note">
        Voice: Alba (Piper <code>en_GB-alba-medium</code>, CC BY 4.0, CSTR University of Edinburgh). Pitch and speed use WSOLA
        time-stretching plus resampling, rendered once per phrase, so this costs nothing to run in the app.
      </p>
    </section>
  </main>
</template>

<style scoped>
.lab {
  display: grid;
  grid-template-columns: minmax(280px, 380px) minmax(320px, 1fr);
  gap: 28px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px 60px;
  align-items: start;
}

@media (max-width: 760px) {
  .lab {
    grid-template-columns: 1fr;
  }
}

.stage {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

@media (max-width: 760px) {
  .stage {
    position: static;
  }
}

.say {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

textarea.field {
  font: inherit;
  color: inherit;
  padding: 12px 16px;
  resize: vertical;
  line-height: 1.35;
}

.buttons {
  display: flex;
  gap: 8px;
}

.primary {
  flex: 1;
  min-height: var(--tap);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.15rem;
  font-weight: 800;
}

.primary:disabled {
  opacity: 0.5;
}

.status {
  min-height: 1.4em;
  margin: 0;
  color: var(--text-dim);
  font-size: 0.9rem;
  text-align: center;
}

progress {
  width: 160px;
  vertical-align: middle;
}

.phrases {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.phrase {
  min-height: 40px;
  padding: 0 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.note {
  margin: 0;
  color: var(--text-dim);
  font-size: 0.85rem;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.presets .chip {
  min-height: 44px;
  padding: 0 14px;
  font-size: 0.95rem;
}

fieldset {
  margin: 0;
  padding: 10px 16px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

legend {
  padding: 0 6px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.slider {
  display: grid;
  grid-template-columns: 96px 1fr 76px;
  align-items: center;
  column-gap: 12px;
  padding: 5px 0;
}

.slider .name {
  font-weight: 600;
}

.slider input {
  width: 100%;
  accent-color: var(--accent);
}

.slider output {
  text-align: right;
  color: var(--accent-text);
  font-weight: 700;
}

.slider small {
  grid-column: 2 / -1;
  color: var(--text-dim);
  font-size: 0.78rem;
}
</style>
