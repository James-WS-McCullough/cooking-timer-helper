// Speech to text, run by transformers.js (Apache-2.0) on the ONNX runtime, all inside this
// worker so the page stays smooth. Which model is models.ts's business (both are MIT). The
// runtime is served by Sizzle from /listen/ (see hostedAssets in vite.config.ts); the model
// downloads once from Hugging Face into the browser's cache.

import { type AutomaticSpeechRecognitionPipeline, env, pipeline } from '@huggingface/transformers'
import type { SpeechModel } from './models'
import type { FromWorker, ToWorker } from './transcriber'

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
let using: SpeechModel | undefined

// The mic's first model (Moonshine tiny) left 51 MB in the cache of anyone who tried it.
async function forgetOldModel(): Promise<void> {
  try {
    const cache = await caches.open('transformers-cache')
    for (const request of await cache.keys()) if (request.url.includes('moonshine-tiny')) await cache.delete(request)
  } catch {
    /* no Cache API here: nothing to tidy */
  }
}

function load(wanted: SpeechModel): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!model) void forgetOldModel()
  using = wanted
  const files = new Map<string, number>()
  model ??= pipeline('automatic-speech-recognition', wanted.id, {
    device: 'wasm',
    dtype: wanted.dtype,
    progress_callback: (p) => {
      if (p.status !== 'progress') return
      files.set(p.file, p.loaded)
      let loaded = 0
      for (const n of files.values()) loaded += n
      port.postMessage({ type: 'progress', done: Math.min(1, loaded / wanted.bytes) })
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
    if (data.type === 'load') {
      await load(data.model)
      return port.postMessage({ type: 'ready' })
    }
    if (!model || !using) throw new Error('transcribe before load')
    const asr = await model
    // The audio arrives already trimmed to the voice (trimSilence): Moonshine returns nothing
    // at all for a clip that opens with a second of silence.
    const out = await asr(data.audio, using.maxNewTokens ? { max_new_tokens: using.maxNewTokens } : {})
    const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text
    // Whisper describes what isn't speech: "[BLANK_AUDIO]", "(sizzling)". None of it is a timer.
    port.postMessage({ type: 'text', id: data.id, text: text.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').trim() })
  } catch (err) {
    port.postMessage({ type: 'error', id: data.type === 'transcribe' ? data.id : undefined, message: String(err) })
  }
}
