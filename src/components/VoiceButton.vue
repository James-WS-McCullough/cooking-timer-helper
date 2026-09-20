<script setup lang="ts">
// Sizzle herself, as the voice on/off switch: floating on the start screen, or as a
// row inside Settings (`inline`) once timers are running. Off: grey and dim.
// On: lit, looking about, and she says hello. The very first tap introduces her (and
// says how big the download is) before anything is fetched; after that it's a plain toggle.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { setVoiceEnabled, voice, voiceIntroduced } from '../lib/voice'
import RobotFace from './RobotFace.vue'

defineProps<{ inline?: boolean }>()

const introOpen = ref(false)

const lit = computed(() => voice.enabled && voice.status !== 'error')
const caption = computed(() => {
  if (voice.status === 'loading') {
    return voice.downloading === null ? 'Waking up…' : `Downloading ${Math.round(voice.downloading * 100)}%`
  }
  if (voice.status === 'error') return "Couldn't load my voice"
  return voice.enabled ? 'Voice on' : 'Voice off'
})

function toggle() {
  if (voice.status === 'loading') return
  if (!voice.enabled && !voiceIntroduced()) introOpen.value = true
  else void setVoiceEnabled(!voice.enabled)
}

function enable() {
  introOpen.value = false
  void setVoiceEnabled(true)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') introOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="voice" :class="{ inline }">
    <!-- One switch: her face and the words beside it are all the same target. -->
    <button
      class="toggle"
      :class="{ on: lit, busy: voice.status === 'loading' }"
      role="switch"
      :aria-checked="voice.enabled"
      aria-label="Sizzle's voice: announce timers out loud"
      @click="toggle"
    >
      <span class="face"><RobotFace :level="voice.level" :speaking="voice.speaking" :off="!lit" /></span>
      <span v-if="inline" class="label">
        <strong>Sizzle's voice</strong>
        <small :class="{ bad: voice.status === 'error' }" role="status">{{ caption }}</small>
      </span>
      <span v-else class="caption" :class="{ bad: voice.status === 'error' }" role="status">{{ caption }}</span>
    </button>

    <!-- On <body>: inside Settings it would otherwise be trapped in that panel's stacking and animation. -->
    <Teleport to="body">
    <Transition name="intro">
      <div v-if="introOpen" class="scrim" @click.self="introOpen = false">
        <div class="panel" role="dialog" aria-modal="true" aria-labelledby="voice-intro-title">
          <RobotFace class="hello" :level="0" :speaking="false" />
          <h2 id="voice-intro-title">Hello!</h2>
          <p class="lead">I am Sizzle, and I can announce what timers are going off.</p>
          <p class="small">Turning me on downloads my voice once (about 95 MB), so Wi-Fi is best. After that I work offline.</p>
          <button class="enable" @click="enable">Enable voice</button>
          <button class="later" @click="introOpen = false">Not now</button>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Bottom-left of the start screen, opposite the theme and QR buttons. */
.voice {
  position: fixed;
  left: max(16px, env(safe-area-inset-left));
  bottom: calc(14px + env(safe-area-inset-bottom));
}

.toggle {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 0;
  border-radius: 24px;
  text-align: left;
}

.toggle:active {
  transform: scale(0.96);
}

.toggle.busy .face {
  animation: busy 1.1s ease-in-out infinite;
}

@keyframes busy {
  50% {
    transform: scale(0.96);
    opacity: 0.8;
  }
}

.face {
  flex: none;
  width: 84px;
  line-height: 0;
}

.caption {
  margin-bottom: 18px;
  padding: 4px 10px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 0.8rem;
  font-weight: 650;
  white-space: nowrap;
}

.caption.bad {
  color: var(--danger);
  border-color: var(--danger);
}

/* As a Settings row: in the flow, and the whole row is the switch. */
.voice.inline {
  position: static;
  width: 100%;
}

.inline .toggle {
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 76px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.inline .toggle:active {
  transform: scale(0.98);
}

.inline .face {
  width: 68px;
}

.label strong,
.label small {
  display: block;
}

.label small {
  color: var(--text-dim);
  font-size: 0.85rem;
}

.label small.bad {
  color: var(--danger);
}

.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 0.6);
}

.panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 340px;
  padding: 20px 24px;
  border-radius: 24px;
  background: var(--surface);
  text-align: center;
}

.hello {
  width: 130px;
}

h2 {
  margin: 4px 0 6px;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.lead {
  margin: 0 0 10px;
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.4;
}

.small {
  margin: 0 0 18px;
  font-size: 0.85rem;
  color: var(--text-dim);
}

.enable,
.later {
  width: 100%;
  border-radius: var(--radius-sm);
  font-weight: 800;
}

.enable {
  min-height: 60px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.3rem;
}

.later {
  min-height: 48px;
  margin-top: 6px;
  color: var(--text-dim);
  font-weight: 650;
}

.enable:active,
.later:active {
  transform: scale(0.98);
}

.intro-enter-active,
.intro-leave-active {
  transition: opacity 0.18s ease;
}

.intro-enter-active .panel {
  animation: pop 0.28s cubic-bezier(0.3, 1.3, 0.5, 1);
}

.intro-enter-from,
.intro-leave-to {
  opacity: 0;
}

@keyframes pop {
  from {
    transform: scale(0.9);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toggle.busy .face,
  .intro-enter-active .panel {
    animation: none;
  }
}
</style>
