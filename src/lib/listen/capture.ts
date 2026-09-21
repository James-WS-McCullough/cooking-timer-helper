// The pure half of recording: turning what the mic delivers into what the speech
// model wants (16 kHz mono), and deciding when the cook has stopped talking.

export const SPEECH_RATE = 16_000

/** Join the mic's chunks and resample them to 16 kHz. Averages across each output sample, so downsampling doesn't alias. */
export function toSpeechRate(chunks: readonly Float32Array[], fromRate: number): Float32Array {
  const length = chunks.reduce((n, c) => n + c.length, 0)
  const input = new Float32Array(length)
  let at = 0
  for (const c of chunks) {
    input.set(c, at)
    at += c.length
  }
  if (fromRate === SPEECH_RATE) return input

  const step = fromRate / SPEECH_RATE
  const out = new Float32Array(Math.floor(length / step))
  for (let i = 0; i < out.length; i++) {
    const from = Math.floor(i * step)
    const to = Math.max(from + 1, Math.min(length, Math.floor((i + 1) * step)))
    let sum = 0
    for (let j = from; j < to; j++) sum += input[j] ?? 0
    out[i] = sum / (to - from)
  }
  return out
}

/** Loudness of a chunk, 0…1 (root mean square). */
export function loudness(chunk: Float32Array): number {
  let sum = 0
  for (const v of chunk) sum += v * v
  return chunk.length ? Math.sqrt(sum / chunk.length) : 0
}

const WINDOW = SPEECH_RATE / 50 // 20ms
const MARGIN = SPEECH_RATE * 0.4

/**
 * Cut 16 kHz audio down to the part with a voice in it, with 0.4s of quiet either side
 * (zeros, if the recording doesn't have that much). Not a nicety: the model returns
 * nothing at all for a clip that opens with a second of silence, and recordings do,
 * because the cook takes a breath after tapping the mic.
 */
export function trimSilence(audio: Float32Array): Float32Array {
  const levels: number[] = []
  for (let at = 0; at + WINDOW <= audio.length; at += WINDOW) levels.push(loudness(audio.subarray(at, at + WINDOW)))
  const threshold = Math.max(0.008, Math.max(0, ...levels) * 0.1)
  const first = levels.findIndex((l) => l > threshold)
  if (first < 0) return audio
  const from = first * WINDOW
  const to = (levels.findLastIndex((l) => l > threshold) + 1) * WINDOW
  const out = new Float32Array(to - from + 2 * MARGIN)
  const lead = Math.min(MARGIN, from)
  out.set(audio.subarray(from - lead, Math.min(audio.length, to + MARGIN)), MARGIN - lead)
  return out
}

export type Verdict = 'listening' | 'finished' | 'silence'

const SETTLE_MS = 250 // the room's own noise is measured over this
const QUIET_AFTER_SPEECH_MS = 1100 // a pause this long means they've finished
const GIVE_UP_MS = 6000 // nobody spoke
const LONGEST_MS = 12_000
const FLOOR = 0.012 // below this is quiet however silent the room was

/**
 * Feed it each chunk's loudness and how long the chunk was. It learns how noisy the
 * kitchen is, waits for a voice to rise above that, and says 'finished' once the voice
 * has been gone for a moment ('silence' if there never was one).
 */
export class EndOfSpeech {
  private elapsed = 0
  private room = 0
  private roomSamples = 0
  private spokeAt: number | null = null
  private lastLoudAt = 0

  get heardSpeech(): boolean {
    return this.spokeAt !== null
  }

  feed(level: number, ms: number): Verdict {
    this.elapsed += ms
    if (this.elapsed <= SETTLE_MS) {
      this.room += level
      this.roomSamples++
      return 'listening'
    }
    const threshold = Math.max(FLOOR, (this.room / Math.max(1, this.roomSamples)) * 2.5)
    if (level > threshold) {
      this.spokeAt ??= this.elapsed
      this.lastLoudAt = this.elapsed
    }
    if (this.spokeAt === null) return this.elapsed >= GIVE_UP_MS ? 'silence' : 'listening'
    if (this.elapsed - this.lastLoudAt >= QUIET_AFTER_SPEECH_MS || this.elapsed >= LONGEST_MS) return 'finished'
    return 'listening'
  }
}
