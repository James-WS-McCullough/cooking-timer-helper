// The robot's voice box. Alba's own delivery is kept (smooth and calm); the only
// shaping is pitch, done properly: each clip is time-stretched with WSOLA
// (wsola.ts) and then played back faster or slower, which moves the pitch and
// lands on the wanted duration. It's rendered once per clip per setting (a few
// milliseconds), not live, which is what buys the quality: no flutter, no
// phasiness. Formants move with the pitch, so a little higher also sounds a
// little smaller, which is the character.
//
// Only a gain is live, so this costs nothing on a phone.

import { wsola } from './wsola'

export interface VoiceSettings {
  pitch: number // semitones, -12…+12
  speed: number // tempo; pitch is unaffected
  gain: number // output level
}

/** The chosen voice: Alba, three semitones up, otherwise untouched. */
export const SIZZLE: VoiceSettings = { pitch: 3, speed: 1, gain: 1 }

export const PRESETS: Record<string, VoiceSettings> = {
  Sizzle: SIZZLE,
  'Alba, untouched': { ...SIZZLE, pitch: 0 },
}

const SETTING_KEYS = Object.keys(SIZZLE) as (keyof VoiceSettings)[]

/** Keep only the settings that exist today (older saved copies had more). */
export function tidySettings(saved: Partial<Record<string, unknown>>): VoiceSettings {
  const out = { ...SIZZLE }
  for (const key of SETTING_KEYS) if (typeof saved[key] === 'number') out[key] = saved[key]
  return out
}

const FADE = 0.008 // seconds; the voice fades in and out over this so swaps never click

interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
}

export class VoiceBox {
  readonly analyser: AnalyserNode
  private readonly out: GainNode
  private readonly rendered = new Map<string, AudioBuffer>()
  private voice: Voice | undefined
  private clip: AudioBuffer | undefined
  private startedAt = 0 // context time the current phrase began, in heard seconds
  private settings: VoiceSettings = SIZZLE
  onEnded: (() => void) | undefined

  constructor(private readonly ctx: AudioContext) {
    this.out = ctx.createGain()
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.ratio.value = 12
    limiter.attack.value = 0.003
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 1024
    this.out.connect(limiter).connect(this.analyser).connect(ctx.destination)
  }

  /** The clip shifted by `semitones`, lasting clip.duration / speed. Cached per clip and setting. */
  private render(clip: AudioBuffer, semitones: number, speed: number): { buffer: AudioBuffer; rate: number } {
    const rate = 2 ** (semitones / 12)
    const stretch = rate / speed
    const key = `${clip.duration}:${clip.length}:${stretch.toFixed(4)}`
    let buffer = this.rendered.get(key)
    if (!buffer) {
      const data = wsola(clip.getChannelData(0), stretch, clip.sampleRate)
      buffer = this.ctx.createBuffer(1, Math.max(1, data.length), clip.sampleRate)
      buffer.getChannelData(0).set(data)
      if (this.rendered.size > 40) this.rendered.clear()
      this.rendered.set(key, buffer)
    }
    return { buffer, rate }
  }

  private start(fromHeardSeconds: number): void {
    const { clip, settings: s } = this
    if (!clip) return
    const when = this.ctx.currentTime + 0.02
    const { buffer, rate } = this.render(clip, s.pitch, s.speed)
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(1, when + FADE)
    source.connect(gain).connect(this.out)
    // Buffer time runs `rate` times faster than heard time.
    source.start(when, Math.min(buffer.duration, fromHeardSeconds * rate))
    this.startedAt = when - fromHeardSeconds
    this.voice = { source, gain }
    source.onended = () => {
      if (this.voice?.source !== source) return // replaced, not finished
      this.voice = undefined
      this.onEnded?.()
    }
  }

  private silence(): void {
    if (!this.voice) return
    const { source, gain } = this.voice
    const now = this.ctx.currentTime
    source.onended = null
    gain.gain.cancelScheduledValues(now)
    gain.gain.setTargetAtTime(0, now, FADE / 3)
    source.stop(now + FADE * 2)
    this.voice = undefined
  }

  play(clip: AudioBuffer, settings: VoiceSettings): void {
    this.silence()
    this.clip = clip
    this.apply(settings, false)
    this.start(0)
  }

  stop(): void {
    this.silence()
  }

  get playing(): boolean {
    return this.voice !== undefined
  }

  /**
   * New settings. Volume is live; a pitch or speed change re-renders the voice and
   * carries on from the same point in the phrase, so dragging a slider while it
   * talks (or loops) is heard straight away.
   */
  apply(settings: VoiceSettings, carryOn = true): void {
    const before = this.settings
    this.settings = { ...settings }
    this.out.gain.setTargetAtTime(settings.gain, this.ctx.currentTime, 0.02)
    if (!carryOn || !this.playing || !this.clip) return
    if (before.pitch === settings.pitch && before.speed === settings.speed) return
    const heard = Math.max(0, this.ctx.currentTime - this.startedAt)
    const fraction = Math.min(0.98, heard / (this.clip.duration / before.speed))
    this.silence()
    this.start(fraction * (this.clip.duration / settings.speed))
  }

  /** How loud the robot is right now, 0…1, for lighting the mouth. */
  level(): number {
    const data = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(data)
    let sum = 0
    for (const v of data) sum += v * v
    return Math.min(1, Math.sqrt(sum / data.length) * 4)
  }
}
