import { describe, expect, it } from 'vitest'
import { EndOfSpeech, loudness, toSpeechRate, trimSilence } from './capture'

describe('toSpeechRate', () => {
  it('joins chunks and leaves 16 kHz audio alone', () => {
    const out = toSpeechRate([new Float32Array([0.1, 0.2]), new Float32Array([0.3])], 16_000)
    expect([...out].map((v) => v.toFixed(1))).toEqual(['0.1', '0.2', '0.3'])
  })

  it('downsamples 48 kHz three to one, averaging', () => {
    const out = toSpeechRate([new Float32Array([0, 0.3, 0.6, 1, 1, 1])], 48_000)
    expect(out.length).toBe(2)
    expect(out[0]).toBeCloseTo(0.3)
    expect(out[1]).toBeCloseTo(1)
  })

  it('keeps the duration at 44.1 kHz', () => {
    expect(toSpeechRate([new Float32Array(44_100)], 44_100).length).toBe(16_000)
  })
})

describe('EndOfSpeech', () => {
  const CHUNK_MS = 50
  const run = (levels: number[]) => {
    const end = new EndOfSpeech()
    let at = 0
    for (const level of levels) {
      at += CHUNK_MS
      const verdict = end.feed(level, CHUNK_MS)
      if (verdict !== 'listening') return { verdict, at }
    }
    return { verdict: 'listening', at }
  }
  const quiet = (ms: number, level = 0.002) => Array<number>(ms / CHUNK_MS).fill(level)
  const voice = (ms: number, level = 0.1) => Array<number>(ms / CHUNK_MS).fill(level)

  it('finishes a moment after the voice stops', () => {
    const { verdict, at } = run([...quiet(500), ...voice(1500), ...quiet(3000)])
    expect(verdict).toBe('finished')
    expect(at).toBe(500 + 1500 + 1100)
  })

  it('rides out the pause between "rice" and "ten minutes"', () => {
    expect(run([...quiet(500), ...voice(400), ...quiet(700), ...voice(800), ...quiet(900)]).verdict).toBe('listening')
  })

  it('gives up if nobody speaks', () => {
    expect(run(quiet(10_000))).toEqual({ verdict: 'silence', at: 6000 })
  })

  it('measures the room first, so an extractor fan is not a voice', () => {
    expect(run(quiet(7000, 0.03)).verdict).toBe('silence')
    expect(run([...quiet(500, 0.03), ...voice(1000, 0.15), ...quiet(2000, 0.03)]).verdict).toBe('finished')
  })

  it('never records for ever', () => {
    expect(run([...quiet(500), ...voice(20_000)])).toEqual({ verdict: 'finished', at: 12_000 })
  })
})

describe('trimSilence', () => {
  const RATE = 16_000
  const clip = (...parts: [seconds: number, level: number][]) =>
    Float32Array.from(
      parts.flatMap(([seconds, level]) => Array.from({ length: seconds * RATE }, (_, i) => (i % 2 ? level : -level))),
    )

  it('keeps the voice with 0.4s of quiet either side', () => {
    const out = trimSilence(clip([2, 0.001], [1.5, 0.2], [3, 0.001]))
    expect(out.length).toBe(2.3 * RATE)
    expect(loudness(out.subarray(0, 0.4 * RATE))).toBeLessThan(0.01)
    expect(loudness(out.subarray(0.4 * RATE, 1.9 * RATE))).toBeCloseTo(0.2)
  })

  it('pads with silence when the recording starts or ends on the voice', () => {
    const out = trimSilence(clip([1, 0.2]))
    expect(out.length).toBe(1.8 * RATE)
    expect(out[0]).toBe(0)
    expect(out[out.length - 1]).toBe(0)
  })

  it('keeps a pause in the middle, and ignores a room that is merely noisy', () => {
    const out = trimSilence(clip([1, 0.01], [0.5, 0.3], [0.8, 0.01], [0.5, 0.3], [2, 0.01]))
    expect(out.length).toBe(2.6 * RATE)
  })

  it('leaves a clip with no voice alone', () => {
    expect(trimSilence(new Float32Array(RATE)).length).toBe(RATE)
  })
})

describe('loudness', () => {
  it('is the root mean square', () => {
    expect(loudness(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5)
    expect(loudness(new Float32Array(0))).toBe(0)
  })
})
