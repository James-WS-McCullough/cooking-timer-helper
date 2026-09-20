// WSOLA (waveform-similarity overlap-add): stretches speech in time without
// changing its pitch. Frames are overlap-added at a fixed output spacing, and each
// one is taken from wherever, near its ideal position, the waveform best continues
// the previous frame. Lining frames up like that is what avoids the flutter and
// phasiness of simpler methods.
//
// Pitch shifting = stretch by the pitch ratio, then play back that much faster:
// the resampling moves the pitch and gives the original duration back.

const FRAME_SECONDS = 0.03 // about two to three pitch periods of a voice
const SEARCH_SECONDS = 0.012 // how far a frame may move to find a good join

/** `stretch` > 1 makes it longer (slower); < 1 shorter. Pitch is unchanged. */
export function wsola(input: Float32Array, stretch: number, sampleRate: number): Float32Array {
  if (Math.abs(stretch - 1) < 1e-4 || input.length === 0) return input.slice()

  const frame = 2 * Math.round((FRAME_SECONDS * sampleRate) / 2)
  const hopOut = frame / 2
  const hopIn = hopOut / stretch
  const search = Math.round(SEARCH_SECONDS * sampleRate)

  const window = new Float32Array(frame)
  for (let i = 0; i < frame; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / frame) // Hann: overlaps sum to 1

  const outLength = Math.ceil(input.length * stretch)
  const output = new Float32Array(outLength + frame)
  const at = (i: number) => (i >= 0 && i < input.length ? input[i] : 0)

  // Where the previous frame would carry on naturally; the next frame should look like this.
  let natural = 0
  for (let k = 0; k * hopOut < outLength; k++) {
    const ideal = Math.round(k * hopIn)
    let best = 0
    if (k > 0) {
      let bestScore = Number.NEGATIVE_INFINITY
      for (let delta = -search; delta <= search; delta++) {
        const start = ideal + delta
        let score = 0
        // Every other sample is plenty to find the alignment, and halves the work.
        for (let i = 0; i < frame; i += 2) score += at(start + i) * at(natural + i)
        if (score > bestScore) {
          bestScore = score
          best = delta
        }
      }
    }
    const chosen = ideal + best
    const out = k * hopOut
    for (let i = 0; i < frame; i++) output[out + i] += at(chosen + i) * window[i]
    natural = chosen + hopOut
  }
  return output.subarray(0, outLength)
}
