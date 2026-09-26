// Sound effects, played through Web Audio: decoded once, then instant and
// mixable, which <audio> elements are not on phones. Mobile browsers only allow
// audio after a user gesture, so unlock() is wired to every tap; once the
// context is running, timers can sound on their own.

import { ref } from 'vue'

export type Sfx = 'beep' | 'start' | 'complete' | 'notify'

const FILES: Record<Sfx, string> = {
  beep: 'Beep.mp3',
  start: 'Timer Start.mp3',
  complete: 'Timer Complete.mp3',
  notify: 'Notify.mp3',
}

const VIBRATE: Partial<Record<Sfx, number[]>> = {
  complete: [150, 80, 150, 80, 300],
  notify: [200, 100, 200],
}

/** True once the browser has let us make noise. Drives the "tap to turn sound on" banner. */
export const soundReady = ref(false)

let ctx: AudioContext | null = null
const buffers = new Map<Sfx, Promise<AudioBuffer>>()

function context(): AudioContext | null {
  if (ctx) return ctx
  // Older Safari only has the prefixed constructor.
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  const created: AudioContext = new Ctor()
  created.onstatechange = () => {
    soundReady.value = created.state === 'running'
  }
  ctx = created
  return created
}

/** The app's one AudioContext (the robot's voice plays through it too), or null if audio isn't available. */
export const audioContext = context

function buffer(c: AudioContext, name: Sfx): Promise<AudioBuffer> {
  let loading = buffers.get(name)
  if (!loading) {
    loading = fetch(import.meta.env.BASE_URL + encodeURIComponent(FILES[name]))
      .then((res) => {
        if (!res.ok) throw new Error(`${FILES[name]}: ${res.status}`)
        return res.arrayBuffer()
      })
      .then((data) => c.decodeAudioData(data))
    // Don't cache a failure (e.g. offline before the first visit finished caching).
    loading.catch(() => buffers.delete(name))
    buffers.set(name, loading)
  }
  return loading
}

// iOS audio session. 'transient' mixes with whatever else is playing (a podcast keeps
// going), unlike 'playback', the music-app mode, which stops the cook's music and doesn't
// give it back. But 'transient' is silenced by the ring/silent switch. iOS won't let a page
// have both, so the cook chooses (Settings): alarms that cut in and always sound, or alarms
// over the music that need the phone not to be silenced. Cutting in is done a moment before
// anything is due, since switching at the alarm itself lost its first second to the cross-fade,
// and held while anything waits on the cook so the reminders and the voice come through too.
// The mic (src/lib/listen/) needs 'play-and-record' while it records.
type SessionType = 'transient' | 'playback' | 'play-and-record'
export const SOUNDING: SessionType = 'transient'
let sessionType: SessionType = SOUNDING
let alarmMode = false
let handBack: ReturnType<typeof setTimeout> | undefined
const HAND_BACK_AFTER_MS = 4000 // the last sound (and Sizzle's line after it) has finished by then

export type AlarmStyle = 'interrupt' | 'mix'
const STYLE_KEY = 'sizzle:alarms'
function savedStyle(): AlarmStyle {
  try {
    return localStorage.getItem(STYLE_KEY) === 'mix' ? 'mix' : 'interrupt'
  } catch {
    return 'interrupt'
  }
}
/** How alarms treat other audio: cut in (and always sound), or play over it (and obey the silent switch). */
export const alarmStyle = ref<AlarmStyle>(savedStyle())

export function setAlarmStyle(style: AlarmStyle): void {
  alarmStyle.value = style
  try {
    localStorage.setItem(STYLE_KEY, style)
  } catch {
    /* private mode: it just won't be remembered */
  }
  if (style === 'mix' && sessionType === 'playback') setAudioSession(SOUNDING)
  if (style === 'interrupt' && alarmMode && sessionType === SOUNDING) setAudioSession('playback')
}

function applySession(): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (session && session.type !== sessionType) {
    try {
      session.type = sessionType
    } catch {
      /* older Safari */
    }
  }
}

export function setAudioSession(type: SessionType): void {
  sessionType = type
  applySession()
}

/**
 * Something is (about to be) waiting on the cook, or nothing is. Called from every tick.
 * With alarms set to cut in, the session is taken ahead of the alarm and handed back once
 * the last sound has finished.
 */
export function setAlarmMode(on: boolean): void {
  if (on === alarmMode) return
  alarmMode = on
  clearTimeout(handBack)
  if (alarmStyle.value !== 'interrupt') return
  if (on) {
    if (sessionType === SOUNDING) setAudioSession('playback')
  } else {
    handBack = setTimeout(() => {
      if (sessionType === 'playback') setAudioSession(SOUNDING)
    }, HAND_BACK_AFTER_MS)
  }
}

/** Call from a user gesture. Safe (and cheap) to call on every tap. */
export function unlock(): void {
  const c = context()
  if (!c) return
  applySession()
  if (c.state !== 'running') {
    c.resume().then(
      () => (soundReady.value = c.state === 'running'),
      () => {},
    )
  } else {
    soundReady.value = true
  }
}

function vibrate(pattern: number[]): void {
  // Browsers reject (and log) vibration before the first tap.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return
  navigator.vibrate?.(pattern)
}

/**
 * Play a sound effect. Pass fromGesture for sounds triggered by a tap: those
 * may be the very tap that unlocks audio, so they wait for the context to start.
 * Timer-driven sounds are dropped while audio is locked, rather than queued to
 * blare out of context whenever the next tap happens.
 */
export async function play(name: Sfx, fromGesture = false): Promise<void> {
  const pattern = VIBRATE[name]
  if (pattern) vibrate(pattern)
  const c = context()
  if (!c) return
  try {
    if (c.state !== 'running') {
      // After an interruption (phone call, app switch) this is often enough to recover.
      const resuming = c.resume()
      if (!fromGesture) return void resuming.catch(() => {})
      await resuming
      if ((c.state as AudioContextState) !== 'running') return
    }
    const source = c.createBufferSource()
    source.buffer = await buffer(c, name)
    source.connect(c.destination)
    source.start()
  } catch {
    /* a missing sound must never break a timer */
  }
}

export function installAudio(): void {
  // Kept for the life of the page: iOS can suspend the context again later.
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true })
  window.addEventListener('keydown', unlock, { capture: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') {
      ctx.resume().catch(() => {})
    }
  })
  // Decode everything up front so the first alarm isn't late.
  const c = context()
  if (c) for (const name of Object.keys(FILES) as Sfx[]) buffer(c, name).catch(() => {})
}
