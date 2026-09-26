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

// iOS audio session. 'transient' is what a timer is: short sounds that mix with whatever
// else is playing (a podcast keeps going, ducked for the beep) rather than 'playback', which
// is the music-app mode and stopped the cook's music every time Sizzle came to the front. The
// mic (src/lib/listen/) needs 'play-and-record' for as long as it's recording, then goes back.
type SessionType = 'transient' | 'play-and-record'
export const SOUNDING: SessionType = 'transient'
let sessionType: SessionType = SOUNDING

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
