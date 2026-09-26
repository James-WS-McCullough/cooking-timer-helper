// The mic: records one utterance through the app's AudioContext and hands back 16 kHz
// audio. It stops by itself when the cook stops talking (see EndOfSpeech), or when told to.

import { audioContext, SOUNDING, setAudioSession } from '../audio'
import { EndOfSpeech, loudness, toSpeechRate, trimSilence } from './capture'

export interface Recording {
  /** Stop now and use what's been said so far (the cook pressed Done: trust them over the silence detector). */
  finish(): void
  /** Stop and throw it away. */
  cancel(): void
  /** The audio, or null if nobody spoke (or it was cancelled). */
  heard: Promise<Float32Array | null>
}

// Runs on the audio thread: passes the mic's samples over in ~40ms pieces.
const TAP = `registerProcessor('sizzle-tap', class extends AudioWorkletProcessor {
  constructor() { super(); this.held = new Float32Array(2048); this.n = 0 }
  process(inputs) {
    const chunk = inputs[0] && inputs[0][0]
    if (!chunk) return true
    for (let i = 0; i < chunk.length; i++) {
      this.held[this.n++] = chunk[i]
      if (this.n === this.held.length) { this.port.postMessage(this.held.slice()); this.n = 0 }
    }
    return true
  }
})`
const tapped = new WeakSet<AudioContext>()

/** Ask for the mic and start recording. Rejects if there's no mic or the cook says no. */
export async function record(onLevel: (level: number) => void): Promise<Recording> {
  const ctx = audioContext()
  if (!ctx?.audioWorklet || !navigator.mediaDevices?.getUserMedia) throw new Error('no microphone support')

  setAudioSession('play-and-record')
  let stream: MediaStream
  try {
    // Echo cancellation keeps Sizzle's own alarms and voice out of it as far as the device can.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    if (ctx.state !== 'running') await ctx.resume()
    if (!tapped.has(ctx)) {
      const url = URL.createObjectURL(new Blob([TAP], { type: 'text/javascript' }))
      await ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url))
      tapped.add(ctx)
    }
  } catch (err) {
    setAudioSession(SOUNDING)
    throw err
  }

  const source = ctx.createMediaStreamSource(stream)
  const tap = new AudioWorkletNode(ctx, 'sizzle-tap', { numberOfOutputs: 1 })
  // A node only runs if it leads to the speakers; this lead is silent.
  const mute = ctx.createGain()
  mute.gain.value = 0
  source.connect(tap).connect(mute).connect(ctx.destination)

  const chunks: Float32Array[] = []
  const ending = new EndOfSpeech()
  let settle: (audio: Float32Array | null) => void = () => {}
  const heard = new Promise<Float32Array | null>((resolve) => {
    settle = resolve
  })

  let stopped = false
  function stop(keep: boolean) {
    if (stopped) return
    stopped = true
    tap.port.onmessage = null
    source.disconnect()
    tap.disconnect()
    mute.disconnect()
    for (const track of stream.getTracks()) track.stop()
    setAudioSession(SOUNDING)
    onLevel(0)
    settle(keep ? trimSilence(toSpeechRate(chunks, ctx?.sampleRate ?? 48_000)) : null)
  }

  tap.port.onmessage = (e: MessageEvent<Float32Array>) => {
    chunks.push(e.data)
    const level = loudness(e.data)
    onLevel(Math.min(1, level * 6))
    const verdict = ending.feed(level, (e.data.length / ctx.sampleRate) * 1000)
    if (verdict !== 'listening') stop(verdict === 'finished')
  }

  return { finish: () => stop(true), cancel: () => stop(false), heard }
}
