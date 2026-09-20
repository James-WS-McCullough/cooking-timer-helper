import { describe, expect, it } from 'vitest'
import { wsola } from './wsola'

const SR = 22050

function tone(hz: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR))
  for (let i = 0; i < out.length; i++) out[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / SR)
  return out
}

/** Frequency from upward zero crossings, ignoring the ends where frames fade in and out. */
function frequency(signal: Float32Array): number {
  const from = Math.round(0.1 * SR)
  const to = signal.length - from
  let crossings = 0
  for (let i = from + 1; i < to; i++) if (signal[i - 1] < 0 && signal[i] >= 0) crossings++
  return crossings / ((to - from) / SR)
}

const rms = (signal: Float32Array) => Math.sqrt(signal.reduce((sum, v) => sum + v * v, 0) / signal.length)

describe('wsola', () => {
  it.each([0.6, 0.8, 1.26, 1.5, 2])('stretches time by %s× and leaves pitch alone', (stretch) => {
    const input = tone(180, 1)
    const output = wsola(input, stretch, SR)
    expect(output.length).toBe(Math.ceil(input.length * stretch))
    expect(frequency(output)).toBeCloseTo(180, 0)
  })

  it('keeps the level steady (no flutter) and never produces junk', () => {
    const output = wsola(tone(220, 1), 1.41, SR)
    expect(output.every(Number.isFinite)).toBe(true)
    const middle = output.subarray(Math.round(0.1 * SR), output.length - Math.round(0.1 * SR))
    expect(rms(middle)).toBeCloseTo(0.5 / Math.SQRT2, 1)
    // Loudness measured in 20ms slices barely varies: the old delay-line shifter wobbled at 10Hz.
    const slice = Math.round(0.02 * SR)
    const levels: number[] = []
    for (let i = 0; i + slice <= middle.length; i += slice) levels.push(rms(middle.subarray(i, i + slice)))
    expect(Math.max(...levels) / Math.min(...levels)).toBeLessThan(1.15)
  })

  it('returns a copy when there is nothing to do', () => {
    const input = tone(200, 0.2)
    const output = wsola(input, 1, SR)
    expect(output).toEqual(input)
    expect(output).not.toBe(input)
  })
})
