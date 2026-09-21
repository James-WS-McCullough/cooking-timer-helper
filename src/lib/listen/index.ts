// The mic button's state: one utterance at a time, recorded, then transcribed on this
// device. Like the voice, nothing heavy loads until the cook first asks for it.

import { reactive } from 'vue'
import { prepare, transcribe } from './moonshine'
import { type Recording, record } from './recorder'

const KEY = 'sizzle:mic'

type Phase = 'idle' | 'loading' | 'listening' | 'thinking'

export const mic = reactive({
  phase: 'idle' as Phase,
  level: 0, // loudness right now, 0…1
  downloading: null as number | null, // 0…1 while the model downloads (first time only)
})

/** Why a listen failed: the mic (refused, missing) or the model (couldn't be downloaded or run). */
export class ListenError extends Error {
  constructor(readonly what: 'mic' | 'model') {
    super(`listening failed: ${what}`)
  }
}

/** Has the model been downloaded before? Until then the mic introduces itself (and its size) first. */
export function micReady(): boolean {
  try {
    return localStorage.getItem(KEY) === 'ready'
  } catch {
    return false
  }
}

function rememberReady(): void {
  try {
    localStorage.setItem(KEY, 'ready')
  } catch {
    /* private mode: it'll introduce itself again next time */
  }
}

let model: Promise<void> | undefined
let recording: Recording | undefined
let run = 0 // each listen() is one run; calling it off moves the number on

function getModel(): Promise<void> {
  model ??= prepare((done) => {
    mic.downloading = done < 1 ? done : null
  }).then(() => {
    mic.downloading = null
    rememberReady()
  })
  model.catch(() => {
    model = undefined
    mic.downloading = null
  })
  return model
}

/**
 * Listen once. Resolves with what was said ('' if nobody spoke, null if it was called off).
 * The first time, the model is fetched before the mic opens, so nobody is left talking
 * to a download; after that it loads while they speak.
 */
export async function listen(): Promise<string | null> {
  if (mic.phase !== 'idle') return null
  const mine = ++run
  const calledOff = () => mine !== run
  try {
    const loading = getModel()
    loading.catch(() => {}) // awaited below (now or when transcribing); not an unhandled rejection meanwhile
    mic.phase = 'loading'
    if (!micReady()) {
      mic.downloading = 0
      await loading.catch(() => {
        throw new ListenError('model')
      })
      if (calledOff()) return null
    }

    // Only "Listening…" once the mic really is open, or the first word would be lost.
    const started = await record((level) => {
      mic.level = level
    }).catch(() => {
      throw new ListenError('mic')
    })
    if (calledOff()) {
      started.cancel()
      return null
    }
    recording = started
    mic.phase = 'listening'
    const audio = await started.heard
    if (calledOff()) return null
    if (!audio) return ''

    mic.phase = 'thinking'
    const text = await transcribe(audio).catch(() => {
      throw new ListenError('model')
    })
    return calledOff() ? null : text
  } finally {
    if (!calledOff()) reset()
  }
}

function reset(): void {
  recording = undefined
  mic.phase = 'idle'
  mic.level = 0
}

/** They've said it: stop recording and work out what it was. */
export function finishListening(): void {
  recording?.finish()
}

/** Never mind: whatever stage it's at, nothing comes of it. */
export function stopListening(): void {
  run++
  recording?.cancel()
  reset()
}
