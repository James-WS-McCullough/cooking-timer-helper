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
// Memory is the other half of it. Peak size of the page while an utterance is worked out, in
// desktop Chrome (it idles at ~185 MB; iOS kills a page somewhere past a gigabyte, which shows
// as a white flash and the app starting again):
//   Whisper base.en ~1.6 GB   Moonshine base ~1.1 GB   Whisper tiny ~1.1 GB   Moonshine tiny ~0.9 GB
// About 550 MB of that is the ONNX runtime whatever the model, and runtime settings (memory
// arena, prepacking, graph optimisation, threads) don't move it, so the worker is shut down
// after every utterance (release() in transcriber.ts) and the page falls back to ~450 MB.
//
// Whisper base.en it is: judged on a real phone, its accuracy was what mattered. (Moonshine
// base was the runner-up, four times quicker to answer; if speed ever matters more, that's the
// one to bring back, remembering it needs max_new_tokens fixed and the trimmed audio.)

export interface SpeechModel {
  /** Remembered once downloaded, so the mic can tell whether to announce a download first. */
  tag: string
  id: string
  dtype: 'q8'
  bytes: number
  /** Model plus the 14 MB runtime, as the introduction puts it. */
  download: string
}

export const speechModel: SpeechModel = {
  tag: 'whisper-base.en',
  id: 'Xenova/whisper-base.en',
  dtype: 'q8',
  bytes: 77_000_000,
  download: 'about 90 MB',
}
