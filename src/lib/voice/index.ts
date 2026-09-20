// Sizzle's voice: on/off, getting Alba ready, and saying things one at a time.
// Everything heavy (the Piper library, its runtime, the model) loads only once the
// cook has turned the voice on.

import { reactive } from 'vue'
import { audioContext } from '../audio'
import { type Priority, shouldSay } from './chatter'
import { greeting } from './phrases'
import { isDownloaded, prepare, speak } from './piper'
import { SIZZLE, VoiceBox } from './voiceBox'

const KEY = 'sizzle:voice'

type Status = 'off' | 'loading' | 'ready' | 'error'

export const voice = reactive({
  enabled: readEnabled(),
  status: 'off' as Status,
  downloading: null as number | null, // 0…1 while the model downloads (first time only)
  speaking: false,
  saying: '', // the words, shown alongside her face
  level: 0, // loudness right now, 0…1, for her mouth
})

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

function remember(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* private mode: it just won't be remembered */
  }
}

let box: VoiceBox | undefined
const clips = new Map<string, Promise<AudioBuffer>>() // phrase → Alba's take of it
const queue: { phrase: string; urgent: boolean }[] = []
let lastSpokeAt = 0 // when she last started or finished a sentence

async function getReady(): Promise<void> {
  voice.status = 'loading'
  try {
    voice.downloading = (await isDownloaded()) ? null : 0
    await prepare((done) => {
      voice.downloading = done < 1 ? done : null
    })
    voice.downloading = null
    voice.status = 'ready'
  } catch {
    voice.downloading = null
    voice.status = 'error'
    throw new Error('voice unavailable')
  }
}

/** Has the cook ever made a choice about the voice? Until then, tapping her introduces her first. */
export function voiceIntroduced(): boolean {
  try {
    return localStorage.getItem(KEY) !== null
  } catch {
    return true
  }
}

/** Turn the voice on or off. Turning it on the first time downloads Alba (about 95 MB in all). */
export async function setVoiceEnabled(on: boolean): Promise<void> {
  if (!on) {
    voice.enabled = false
    voice.status = 'off'
    remember(false)
    queue.length = 0
    box?.stop()
    voice.speaking = false
    return
  }
  const firstTime = !voiceIntroduced()
  voice.enabled = true
  try {
    await getReady()
    remember(true)
    say(greeting(firstTime), 0, 'reply') // a proper introduction once; after that, whatever she feels like
  } catch {
    voice.enabled = false // status stays 'error' so the button can say why
  }
}

/** On launch: if the cook had the voice on, load Alba quietly (she's already on the device). */
export function installVoice(): void {
  if (!voice.enabled) return
  getReady().catch(() => {
    voice.enabled = false
  })
}

function clipFor(phrase: string): Promise<AudioBuffer> {
  let clip = clips.get(phrase)
  if (!clip) {
    clip = speak(phrase).then(async (wav) => {
      const ctx = audioContext()
      if (!ctx) throw new Error('no audio')
      return ctx.decodeAudioData(await wav.arrayBuffer())
    })
    clip.catch(() => clips.delete(phrase))
    if (clips.size > 60) clips.clear()
    clips.set(phrase, clip)
  }
  return clip
}

/** Synthesise ahead of time, so the announcement is instant when the moment comes. */
export function rehearse(phrase: string): void {
  if (voice.enabled && voice.status === 'ready') void clipFor(phrase).catch(() => {})
}

/**
 * Say something, after anything she's already saying. `afterMs` leaves room for a
 * sound effect that started at the same moment (the finish jingle, the notify chime).
 * Priority (see chatter.ts): 'urgent' lines go ahead of anything else queued, 'chat' is
 * dropped unless she's been quiet for a while, 'reply' is always said in turn.
 */
export function say(phrase: string, afterMs = 0, priority: Priority = 'chat'): void {
  if (!voice.enabled || voice.status !== 'ready') return
  if (queue.some((q) => q.phrase === phrase)) return
  if (!shouldSay(priority, { busy: queue.length > 0, quietForMs: Date.now() - lastSpokeAt })) return
  const urgent = priority === 'urgent'
  const item = { phrase, urgent }
  // Never ahead of position 0: that one may already be mid-sentence.
  const firstChat = queue.findIndex((q, i) => i > 0 && !q.urgent)
  if (urgent && firstChat > 0) queue.splice(firstChat, 0, item)
  else queue.push(item)
  void clipFor(phrase).catch(() => {}) // start synthesising now, whatever happens next
  if (queue.length === 1) setTimeout(next, afterMs)
}

async function next(): Promise<void> {
  const phrase = queue[0]?.phrase
  if (phrase === undefined) return
  const ctx = audioContext()
  const done = () => {
    lastSpokeAt = Date.now()
    voice.speaking = false
    queue.shift()
    if (queue.length) setTimeout(next, 350)
  }
  try {
    // Audio locked (no tap yet) or switched off meanwhile: stay silent rather than speak late.
    if (ctx?.state !== 'running' || !voice.enabled) return done()
    const clip = await clipFor(phrase)
    if (!voice.enabled) return done()
    if (!box) {
      box = new VoiceBox(ctx)
      box.onEnded = done
    }
    lastSpokeAt = Date.now()
    voice.saying = phrase
    voice.speaking = true
    box.play(clip, SIZZLE)
    requestAnimationFrame(follow)
  } catch {
    done()
  }
}

// Her mouth: quick to light, slower to fade (the segments add their own afterglow on top).
function follow(): void {
  const now = voice.speaking ? (box?.level() ?? 0) : 0
  voice.level = now > voice.level ? now : voice.level * 0.88 + now * 0.12
  if (voice.speaking || voice.level > 0.01) requestAnimationFrame(follow)
  else voice.level = 0
}
