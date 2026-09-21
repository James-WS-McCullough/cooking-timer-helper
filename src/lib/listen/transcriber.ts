// The page's side of the speech model: starts the worker (a lazy chunk of its own, so
// none of it loads until the mic is first used) and talks to it.

import { type SpeechModel, speechModel } from './models'

export type ToWorker = { type: 'load'; model: SpeechModel } | { type: 'transcribe'; id: number; audio: Float32Array }
export type FromWorker =
  | { type: 'progress'; done: number }
  | { type: 'ready' }
  | { type: 'text'; id: number; text: string }
  | { type: 'error'; id?: number; message: string }

export type Progress = (fractionDone: number) => void

let worker: Worker | undefined
let ready: Promise<void> | undefined
let onProgress: Progress | undefined
let lastId = 0
const waiting = new Map<number, { resolve: (text: string) => void; reject: (err: Error) => void }>()
let settleReady: { resolve: () => void; reject: (err: Error) => void } | undefined

function start(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./transcriber.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }: MessageEvent<FromWorker>) => {
    if (data.type === 'progress') onProgress?.(data.done)
    else if (data.type === 'ready') settleReady?.resolve()
    else if (data.type === 'text') waiting.get(data.id)?.resolve(data.text)
    else if (data.id === undefined) settleReady?.reject(new Error(data.message))
    else waiting.get(data.id)?.reject(new Error(data.message))
    if ('id' in data && data.id !== undefined) waiting.delete(data.id)
  }
  // The script itself failed (blocked, or the browser has no module workers).
  worker.onerror = (e) => {
    const err = new Error(e.message || 'speech worker failed')
    settleReady?.reject(err)
    for (const w of waiting.values()) w.reject(err)
    waiting.clear()
    worker?.terminate()
    worker = undefined
  }
  return worker
}

/** Get the model ready: downloads it if needed (reporting progress), then loads it into memory. */
export function prepare(progress?: Progress): Promise<void> {
  onProgress = progress
  ready ??= new Promise<void>((resolve, reject) => {
    settleReady = { resolve, reject }
    start().postMessage({ type: 'load', model: { ...speechModel } } satisfies ToWorker)
  })
  // A failed start (offline, blocked download) shouldn't be remembered forever.
  ready.catch(() => {
    ready = undefined
  })
  return ready
}

/**
 * Shut the worker down, and with it everything the model holds. Not tidiness: loaded and
 * run, the model takes the page past a gigabyte and none of it comes back while the worker
 * lives (a WebAssembly heap never shrinks), which is enough for iOS to kill the page. So it
 * lives for one utterance. Loading it again from the cache happens while the cook is talking.
 */
export function release(): void {
  const err = new Error('released')
  settleReady?.reject(err)
  for (const w of waiting.values()) w.reject(err)
  waiting.clear()
  settleReady = undefined
  ready = undefined
  worker?.terminate()
  worker = undefined
}

/** 16 kHz mono audio → what was said. */
export async function transcribe(audio: Float32Array): Promise<string> {
  await prepare(onProgress)
  const id = ++lastId
  return new Promise<string>((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    start().postMessage({ type: 'transcribe', id, audio } satisfies ToWorker, [audio.buffer])
  })
}
