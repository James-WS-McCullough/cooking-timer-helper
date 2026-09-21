// Moonshine (Useful Sensors, MIT): a small speech-to-text model made for short commands,
// run by transformers.js (Apache-2.0) on the ONNX runtime, all inside this worker so the
// page stays smooth. The runtime is served by Sizzle from /listen/ (see hostedAssets in
// vite.config.ts); the model (~51 MB) downloads once from Hugging Face into the browser's cache.

import { type AutomaticSpeechRecognitionPipeline, env, pipeline } from '@huggingface/transformers'
import type { FromWorker, ToWorker } from './moonshine'

const MODEL = 'onnx-community/moonshine-tiny-ONNX'
// The encoder loses too much accuracy when quantised; the decoder doesn't.
const DTYPE = { encoder_model: 'fp32', decoder_model_merged: 'q8' } as const
const EXPECTED_BYTES = 51_000_000

const port = self as unknown as {
  postMessage(message: FromWorker): void
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null
}

env.allowLocalModels = false
const hosted = new URL(`${import.meta.env.BASE_URL}listen/`, self.location.href).href
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = {
    mjs: `${hosted}ort-wasm-simd-threaded.mjs`,
    wasm: `${hosted}ort-wasm-simd-threaded.wasm`,
  }
}

let model: Promise<AutomaticSpeechRecognitionPipeline> | undefined

function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  const files = new Map<string, number>()
  model ??= pipeline('automatic-speech-recognition', MODEL, {
    device: 'wasm',
    dtype: DTYPE,
    progress_callback: (p) => {
      if (p.status !== 'progress') return
      files.set(p.file, p.loaded)
      let loaded = 0
      for (const n of files.values()) loaded += n
      port.postMessage({ type: 'progress', done: Math.min(1, loaded / EXPECTED_BYTES) })
    },
  })
  // A failed start (offline, blocked download) shouldn't be remembered forever.
  model.catch(() => {
    model = undefined
  })
  return model
}

port.onmessage = async ({ data }) => {
  try {
    const asr = await load()
    if (data.type === 'load') return port.postMessage({ type: 'ready' })
    // A token budget that doesn't depend on the clip's length: left to itself the model
    // cuts a short clip off mid-word ("An hour and a half l"). The audio arrives already
    // trimmed to the voice (trimSilence), which matters just as much.
    const out = await asr(data.audio, { max_new_tokens: 40 })
    const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text
    port.postMessage({ type: 'text', id: data.id, text: text.trim() })
  } catch (err) {
    port.postMessage({ type: 'error', id: data.type === 'transcribe' ? data.id : undefined, message: String(err) })
  }
}
