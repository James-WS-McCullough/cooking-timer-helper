// The speech models the mic can use, and which one this device is using.
//
// Measured on 55 spoken kitchen sentences (six synthesised accents; "right" = the timer came
// out with the right name, time and prep), clean / with extractor-fan noise, and seconds per
// clip in desktop Chrome, which runs them single-threaded:
//   Whisper base.en   44 / 41   3.3s    (Whisper always processes a 30s window)
//   Moonshine base    40 / 38   0.8s    (its cost follows the clip's length)
//   Whisper tiny.en   38 / 27           Moonshine tiny 34 / 25 (the mic's first model)
//   Whisper small.en  47 / 42   far too big (250 MB) and slow for a phone
//
// Whisper base is the default. While that's being judged on real phones, opening Sizzle once
// with ?mic=moonshine (or ?mic=whisper to go back) switches this device over.
// TODO: drop the loser, and the switch, once it's settled.

export interface SpeechModel {
  /** Remembered once downloaded, so the mic can tell whether to announce a download first. */
  tag: string
  id: string
  dtype: 'q8' | { encoder_model: 'fp32'; decoder_model_merged: 'q8' }
  /** Moonshine sizes its answer to the clip and cuts short ones off mid-word ("An hour and a half l"). */
  maxNewTokens?: number
  bytes: number
  /** Model plus the 14 MB runtime, as the introduction puts it. */
  download: string
}

const MODELS = {
  whisper: {
    tag: 'whisper-base.en',
    id: 'Xenova/whisper-base.en',
    dtype: 'q8',
    bytes: 77_000_000,
    download: 'about 90 MB',
  },
  moonshine: {
    tag: 'moonshine-base',
    id: 'onnx-community/moonshine-base-ONNX',
    // The encoder loses too much accuracy when quantised; the decoder doesn't.
    dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
    maxNewTokens: 40,
    bytes: 123_000_000,
    download: 'about 140 MB',
  },
} satisfies Record<string, SpeechModel>

const KEY = 'sizzle:mic-model'

function chosen(): keyof typeof MODELS {
  try {
    const asked = new URLSearchParams(location.search).get('mic')
    if (asked && asked in MODELS) localStorage.setItem(KEY, asked)
    const saved = localStorage.getItem(KEY)
    if (saved && saved in MODELS) return saved as keyof typeof MODELS
  } catch {
    /* private mode: the default */
  }
  return 'whisper'
}

export const speechModel: SpeechModel = MODELS[chosen()]
