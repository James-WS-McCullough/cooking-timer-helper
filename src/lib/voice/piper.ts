// Alba, a Piper voice (en_GB, CC BY 4.0, University of Edinburgh CSTR), running
// entirely in the browser. Nothing here loads until the cook turns the voice on:
// the library is a lazy chunk, its runtime (ONNX + the eSpeak NG phonemiser, ~33 MB)
// is served by Sizzle itself from /voice/ (see voiceAssets in vite.config.ts), and
// the model (~63 MB) downloads once into the browser's private file system.

type Piper = typeof import('@mintplex-labs/piper-tts-web')
type Session = InstanceType<Piper['TtsSession']>

export const VOICE = 'en_GB-alba-medium'

export type Progress = (fractionDone: number) => void

const here = (path: string) => new URL(`${import.meta.env.BASE_URL}voice/${path}`, window.location.href).href

let library: Promise<Piper> | undefined
let session: Promise<Session> | undefined
let onProgress: Progress | undefined

const piper = () => {
  library ??= import('@mintplex-labs/piper-tts-web')
  return library
}

function alba(): Promise<Session> {
  session ??= piper().then((lib) =>
    lib.TtsSession.create({
      voiceId: VOICE,
      wasmPaths: {
        onnxWasm: here(''),
        piperData: here('piper_phonemize.data'),
        piperWasm: here('piper_phonemize.wasm'),
      },
      // Reports every file it fetches; only the model itself is big enough to be worth showing.
      progress: (p) => {
        if (p.url.endsWith('.onnx') && p.total > 0) onProgress?.(p.loaded / p.total)
      },
    }),
  )
  // A failed start (offline, blocked download) shouldn't be remembered forever.
  session.catch(() => {
    session = undefined
  })
  return session
}

export async function isDownloaded(): Promise<boolean> {
  return (await (await piper()).stored()).includes(VOICE)
}

/** Get Alba ready to speak: downloads the model if needed, then loads it into memory. */
export async function prepare(progress?: Progress): Promise<void> {
  onProgress = progress
  await alba()
}

// One sentence at a time. The engine has a single model session and reloads its
// phonemiser for every sentence; overlapping requests (a "started" line and a rehearsed
// "finished" line for the same new timer, say) fail with network errors. Queued, each
// takes about half a second.
let queue: Promise<unknown> = Promise.resolve()

/** Text → a WAV blob of Alba saying it. */
export function speak(text: string, progress?: Progress): Promise<Blob> {
  if (progress) onProgress = progress
  const turn = queue.then(async () => (await alba()).predict(text))
  queue = turn.catch(() => {}) // a failed sentence mustn't jam the ones behind it
  return turn
}
