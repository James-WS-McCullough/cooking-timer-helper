<script setup lang="ts">
import { ref } from 'vue'
// The few things that aren't about a timer: Sizzle's voice, light/dark, and the QR
// code. On the start screen they're loose buttons; once timers are running they
// live here, behind the gear.
import { alarmStyle, setAlarmStyle } from '../lib/audio'
import { useDialog } from '../lib/dialog'
import { theme, toggleTheme } from '../lib/theme'
import VoiceButton from './VoiceButton.vue'

const emit = defineEmits<{ close: []; qr: []; recipes: []; watch: [] }>()

const panel = ref<HTMLElement>()
useDialog(panel, () => emit('close'))
</script>

<template>
  <div class="scrim" @click.self="emit('close')">
    <div ref="panel" class="panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header>
        <h2 id="settings-title">Settings</h2>
        <button class="x" aria-label="Close" @click="emit('close')">✕</button>
      </header>

      <VoiceButton inline />

      <button class="row action" @click="toggleTheme">
        <span class="icon">
          <svg v-if="theme === 'dark'" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
          </svg>
        </span>
        <span class="label">
          <strong>{{ theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }}</strong>
          <small>Currently {{ theme }}</small>
        </span>
      </button>

      <!-- iOS can't both play over music and ignore the silent switch: the cook picks. -->
      <button
        class="row action"
        role="switch"
        :aria-checked="alarmStyle === 'mix'"
        aria-label="Alarms over music"
        @click="setAlarmStyle(alarmStyle === 'mix' ? 'interrupt' : 'mix')"
      >
        <span class="icon">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V6l11-2v12" />
            <circle cx="6.5" cy="18" r="2.5" />
            <circle cx="17.5" cy="16" r="2.5" />
          </svg>
        </span>
        <span class="label">
          <strong>Alarms over music</strong>
          <small>{{ alarmStyle === 'mix' ? 'On: music keeps playing. Silent switch silences alarms too.' : 'Off: alarms cut in and always sound.' }}</small>
        </span>
        <span class="knob" :class="{ on: alarmStyle === 'mix' }" aria-hidden="true" />
      </button>

      <button class="row action" @click="emit('watch')">
        <span class="icon">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="6" width="18" height="12" rx="2.5" />
            <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span class="label">
          <strong>Watch while you cook</strong>
          <small>A YouTube or Twitch link, with the timers beside it</small>
        </span>
      </button>

      <button class="row action" @click="emit('recipes')">
        <span class="icon">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
            <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20M9 7.5h7M9 11h5" />
          </svg>
        </span>
        <span class="label">
          <strong>Recipes</strong>
          <small>Chains of timers and instructions, kept</small>
        </span>
      </button>

      <button class="row action" @click="emit('qr')">
        <span class="icon">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
            <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
            <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
            <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" stroke-linecap="round" />
          </svg>
        </span>
        <span class="label">
          <strong>Open on another device</strong>
          <small>Show a QR code for Sizzle</small>
        </span>
      </button>

      <!-- Touch devices only (see the media query): a desktop tab keeps sounding in the background. -->
      <p class="note">Keep Sizzle open while you cook. Alarms can't sound once the screen locks.</p>
    </div>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 0.6);
  animation: fade 0.15s ease-out;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 380px;
  max-height: 100%;
  overflow-y: auto;
  padding: 12px 16px 16px;
  border-radius: 24px;
  background: var(--surface);
  animation: pop 0.25s cubic-bezier(0.3, 1.3, 0.5, 1);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 6px;
}

h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.x {
  width: 48px;
  height: 48px;
  margin-right: -8px;
  border-radius: 50%;
  color: var(--text-dim);
  font-size: 1.1rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 76px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  text-align: left;
}

.row.action:active {
  transform: scale(0.98);
}

.icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 68px; /* lines the labels up with the voice row's face */
  color: var(--text-dim);
}

.label {
  flex: 1;
  min-width: 0;
}

.label strong,
.label small {
  display: block;
}

.label small {
  color: var(--text-dim);
  font-size: 0.85rem;
}

/* A switch's state, drawn: a pill with a dot that slides. */
.knob {
  flex: none;
  position: relative;
  width: 46px;
  height: 28px;
  margin-left: auto;
  border-radius: 14px;
  background: var(--border);
  transition: background 0.15s ease;
}

.knob::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--surface);
  transition: transform 0.15s ease;
}

.knob.on {
  background: var(--accent);
}

.knob.on::after {
  transform: translateX(18px);
}

@media (prefers-reduced-motion: reduce) {
  .knob,
  .knob::after {
    transition: none;
  }
}

.note {
  display: none;
  margin: 6px 6px 0;
  color: var(--text-dim);
  font-size: 0.85rem;
  text-align: center;
  text-wrap: balance;
}

@media (pointer: coarse) {
  .note {
    display: block;
  }
}

@keyframes fade {
  from {
    opacity: 0;
  }
}

@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scrim,
  .panel {
    animation: none;
  }
}
</style>
