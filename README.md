# Sizzle

**Live app: https://james-ws-mccullough.github.io/cooking-timer-helper/**

Fast cooking timers with flip/stir alerts. Vue 3 + Vite, installable as a home-screen web app, works offline, no backend.

```sh
npm install
npm run dev      # http://localhost:5173, also exposed on your LAN
npm run check    # Biome lint + format check, type-checks, unit tests
npm run format   # apply Biome's fixes
npm run test:e2e # Playwright: the built app in headless Chrome, quiet unless something fails
npm run build    # type-check + production build into dist/
npm run icons    # regenerate PWA icons from public/icon.svg (settings in pwa-assets.config.ts)
```

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`: `npm run check`, then the Playwright suite, then the build, then a publish to GitHub Pages at `https://<user>.github.io/<repo>/`. A failing test stops the deploy (its traces are attached to the run). One-time setup: in the repo's *Settings → Pages*, set **Source** to **GitHub Actions** (not "Deploy from a branch": that publishes the unbuilt source, which renders as a blank page).

An installed copy doesn't update silently: when a new version has been deployed, the next time the app is opened it shows **"A new version of Sizzle is ready · Reload"**. Reloading is safe mid-cook, because timers are saved and wall-clock based. A copy left open (a tablet on the counter) checks hourly.

## Testing

- **Unit tests** (Vitest, `src/**/*.test.ts`) cover the timer engine, Sync Finish maths, Pause all, food search and icons, name tidying, spoken-timer parsing, mic audio handling (resampling, end of speech, trimming), time history and saved-data migrations.
- **End-to-end tests** (Playwright, `e2e/`) drive the production build at phone size in the Chrome that's already installed, so there is no browser download: the wizard, search, presets, the bell, finishing and its sounds, remove confirmation, prepping, Sync Finish, Pause all, theme and QR, and the mic (with Chrome's pretend microphone and a stand-in for the speech worker, so no model is downloaded). They're headless and print dots; add `-- --ui` to watch, or `E2E_VERBOSE=1` for console output. Kitchen time is fast-forwarded with Playwright's clock (`e2e/helpers.ts`).
- **Biome** lints and formats everything (`biome.json`); `.vscode/` points the editor at it for format-on-save.

## On a phone

Serve `dist/` over **HTTPS** (any static host), open it, then *Share → Add to Home Screen*.
HTTPS is required for offline support and for keeping the screen awake; plain `http://` over LAN is fine for a quick look but won't have either.

- Sound unlocks on your first tap (the New timer beep does it). If the app is reopened with timers already running, a red banner asks for one tap.
- The screen stays on while anything is counting down. A home-screen web app cannot make sound once the phone is locked or the app is in the background, so leave it open on the counter.
- Timers are timestamp-based and saved on the device: closing, reloading or sleeping never loses time.

## Settings while cooking

On the empty start screen, Sizzle's voice, the theme toggle and the QR code are loose buttons in the corners. Once timers are running they move behind a small sliders icon at the top right, in a slim strip that scrolls with the list (so it never sits on a card's bell or ✕). It opens a short sheet with the same three things.

## Light and dark

Sizzle follows the device's light/dark setting until the toggle on the start screen (next to the QR button) is used; after that the choice sticks on that device. The theme is a `data-theme` attribute on `<html>`, set before first paint by a small script in `index.html` and kept current by `src/lib/theme.ts`; the light palette is the `[data-theme='light']` block in `src/style.css`.

## Making a timer, and alerts

A timer takes three taps: *New timer* → a name (chip, search, or skip) → a time. The time screen is grouped so it can be read at a glance: the times last used for that name (remembered on the device, up to three), every minute from 1 to 10, then a row of longer cooks, with a box for anything else. Mid-way alerts are not part of that: tap the **bell** on a timer's card to add, change or remove them (halfway, or every N minutes; Flip/Stir/Check/Baste; optionally holding the clock until confirmed). The bell works on running and prepped timers, only future alert times fire, and the editor can save the result as a preset.

Searching is built for a keyboard being up: the sheet tracks the *visible* viewport, the header folds into the search row, and the typed text is offered as a **Use "…"** row instead of a footer button. When the visible area is short (under 520px, e.g. a landscape tablet or phone with the keyboard open) the sheet goes edge to edge and results flow in columns.

## Prepping

*Prep a timer* (start screen, or *Prep* in the dock) runs the same wizard but leaves the timer waiting in the list with a Start button, so a whole meal can be set up before anything goes on the heat. Prepped timers and the prep wizard use the lemon `--prep` colours; they queue below everything that's already cooking and survive a reload.

## Sync Finish

With two or more prepped timers, a violet *Sync Finish* button appears above *New timer*. It explains the plan and, on *Sync Up & Start!*, starts the longest timer straight away and gives each of the others a pre-timer (longest time minus its own), so everything finishes together. When a pre-timer runs out the card turns solid violet ("Start Chicken") and joins the shared 15-second reminder until *Start* is pressed, which begins its real timer; a waiting card can also be started early with *Start now*. The sheet also says when that will be ("All ready at about 18:42"). The maths lives in `syncPlan` / `syncFinish` in `src/lib/timer.ts`.

Sync Finish doesn't re-plan itself if the kitchen falls behind. Instead, once two or more things are counting, a **Pause all** button floats above the dock: it stops every running timer and every pre-timer together, and **Resume all** restarts exactly those (a timer paused by hand stays paused), so a synced meal simply shifts as one block.

## Sounds

The four files in `public/` can be swapped for any mp3 with the same name.

| File | Plays |
| --- | --- |
| `Beep.mp3` | New timer / Prep buttons; pausing or un-pausing a timer; a timer being prepped |
| `Timer Start.mp3` | A timer starts counting (end of the wizard, a preset, Start on a prepped timer, adding time to a finished timer), and pressing Done on any pending card |
| `Timer Complete.mp3` | Once, when a timer finishes |
| `Notify.mp3` | When a flip alert appears or a synced dish is due to go on, then every 15 s while anything is waiting on you (one shared reminder, however many cards) |

Pending cards shimmer each time `Notify` or `Timer Complete` plays.

## Icons

Food icons are [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (flat style, MIT © Microsoft), pulled in through `unplugin-icons` so only the ones imported in `src/components/FoodIcon.vue` ship.

- `src/data/foods.ts` is the searchable list in the wizard: `[name, icon, extra search words?]`, British names first with other spellings as extra words. Add a line to add a food.
- `src/lib/foodIcons.ts` decides which icon a timer name gets: the list's icon if the name is in it, otherwise keyword rules so typed names work too ("Wedges" → potato).
- Using an icon that `FoodIcon.vue` doesn't import yet is a type error at build time; add the import and the map entry there.

## Layout

- `src/lib/timer.ts` – pure timer engine (alerts, holding, attention events); `timer.test.ts` covers it
- `src/lib/audio.ts` – sound effects via Web Audio, mobile audio unlock
- `src/lib/wakeLock.ts` – screen wake lock
- `src/store.ts` – reactive state, 250 ms tick, actions
- `src/lib/storage.ts` – what's saved on the device, versioned, with migrations (never drops a cook's presets)
- `src/lib/history.ts`, `src/lib/theme.ts` – last-used times per name; light/dark
- `src/data/foods.ts` – the searchable food list
- `src/lib/foodIcons.ts`, `src/lib/foodSearch.ts` – name → icon matching and list search, both with tests
- `src/components/` – `TimerCard.vue` (one timer, in any state); `NewTimerSheet.vue` (the name → time wizard) and `AlertSheet.vue` (the bell's alert editor), both built from `sheet/` (`SheetShell.vue` is the shared bottom sheet, one component per step, shared styles in `sheet.css`); `SyncSheet.vue`; `QrSheet.vue` and `ListenSheet.vue` (the mic; both loaded on demand); `UpdateToast.vue`; `FoodIcon.vue`; `SizzleLogo.vue`

## Sizzle's voice

Sizzle is also a character: a small round robot in a chef's hat, bottom-left of the start screen. She's the on/off switch for spoken announcements. Off, she's grey and dim; the first tap introduces her ("I am Sizzle, and I can announce what timers are going off") and says what enabling costs; after that she's a plain toggle, remembered on the device.

- **What she says:** she has a pool of lines for each situation and picks one at random, never the same twice running (`src/lib/voice/lines.ts`; about 120 lines). A timer starting: "Okay, 6 minutes to cook your potatoes!" or "Give those potatoes 6 minutes." Finishing: "Ding! The potatoes are ready." or "That's the rice done." A flip: "Go on, flip the potatoes." A Sync Finish dish due: "The chicken is up. Start it now." Roughly once a minute while things wait: "The rice is waiting patiently." The first time she's switched on she introduces herself properly ("Hello. I'm Sizzle."); after that it's "Ready to cook?" and the like. The lines are templates: `phrases.ts` makes the grammar agree with the name (is/are, it/them, that/those), lower-cases ordinary names, speaks times naturally ("1 hour 5 minutes"), treats names that are tasks ("Boil water: done.") or drinks (never "cook your tea") differently, and is unit-tested against every line. She speaks after the matching sound effect rather than over it, one sentence at a time. Lines that need the cook ("it's ready / flip it / start it") are always said and go first; optional chat (a timer starting, "synced", the waiting nudge) is only said if she has been quiet for 20 seconds, so adding five timers in a row gets one remark rather than five (`src/lib/voice/chatter.ts`). While she talks over the timer list, her face and the words appear at the top of the screen.
- **Her voice** is [Piper](https://github.com/rhasspy/piper)'s *Alba* (`en_GB-alba-medium`), synthesised **in the browser**, three semitones up and otherwise left as calm as she is. The pitch shift is WSOLA time-stretching plus resampling (`src/lib/voice/wsola.ts`, unit-tested), rendered once per phrase rather than live, so it has no flutter and costs nothing while playing. Lines are synthesised ahead of time (when a timer is created) so announcements are instant.
- **Her face** (`src/components/RobotFace.vue`): the mouth is a row of segments that light from the centre outwards with her voice, coming on at once and fading over a third of a second; her eyes look around, settle on you when she speaks, blink and breathe a slow glow. All of it stops under reduced motion except the mouth.
- **What enabling downloads (once, about 95 MB):** Alba's model (63 MB, from Hugging Face, kept in the browser's private storage) and the runtime (ONNX Runtime + the eSpeak NG phonemiser, 33 MB). The runtime is **hosted by Sizzle itself** at `/voice/`: `vite.config.ts` serves it from `node_modules` in dev and copies it into `dist/voice/` at build, so it's version-pinned by the lockfile, never committed, and cached by the service worker on first use. Nothing voice-related loads until she's turned on.
- `npm run lab` opens a dev-only playground (`lab/voice/`) for the voice and face: type anything, change pitch and speed while she loops.

## Saying a timer

The round mic button beside New timer (start screen and dock) makes a timer from speech: "rice, 10 minutes", "turkey, two hours thirty", "prepare the lamb, an hour and a half".

- **The rule** (`src/lib/spoken.ts`, pure; tested against real transcripts and a 240-sentence corpus of the ways people ask, `spoken.corpus.ts`, from "rice 10" to "Hey Sizzle, can you set me a timer for the roast chicken for about an hour and twenty minutes, thanks"; the sentence round the food, "in the oven" and the like are dropped): a number is minutes unless hours (or seconds) are said; "prep" or "prepare" anywhere makes it a prepped timer, otherwise it starts; the remaining words are the name, snapped to the food list only when they clearly are one of its entries (exact, singular/plural, one letter out: "rise" → Rice, or sounding like one: "chicken ties" → Chicken thighs), or sounding like one: "chicken ties" → Chicken thighs), otherwise kept as the cook's own name.
- **Nothing is started unseen.** The sheet shows what it understood ("Rice · 10:00", and the words it heard) with one big Start; a wrong guess costs a tap on Try again. A name with no time carries on in the wizard at "How long?"; nothing usable says so.
- **The speech model** is [Whisper](https://github.com/openai/whisper) base.en (MIT; the most accurate of five measured, see `src/lib/listen/models.ts`), run **on the device** by [transformers.js](https://github.com/huggingface/transformers.js) in a web worker: what the cook says never leaves the phone. `src/lib/listen/`: `recorder.ts` (mic → 16 kHz through an AudioWorklet; on iOS the audio session switches to play-and-record only while recording), `capture.ts` (resampling, end-of-speech detection that measures the room first, and trimming to the voice, all pure and tested), `models.ts` (which model, and the measurements behind it), `transcriber.worker.ts` + `transcriber.ts` (running it), `index.ts` (state).
- **What first use downloads (once, about 90 MB):** the model (77 MB, from Hugging Face, kept in the browser's cache) and its ONNX runtime (14 MB), hosted by Sizzle at `/listen/` the same way as the voice's. The mic says so before fetching anything, and nothing of it loads until then.

## Licence and credits

Sizzle — cooking timers with flip alerts, prepping and Sync Finish.
Copyright © 2026 James McCullough

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.

In short: use it, change it, share it, sell it; if you distribute your version, it has to be open under the same terms.

### Why GPL

Sizzle's robot voice turns text into phonemes with **[eSpeak NG](https://github.com/espeak-ng/espeak-ng)**, which is GPL-3.0-or-later. Shipping that inside the app makes the app a combined work, so the whole project is GPL. The pieces, and where their source lives:

| Component | Licence | Source |
| --- | --- | --- |
| eSpeak NG (phonemiser, compiled to WebAssembly; served from `/voice/piper_phonemize.*`) | GPL-3.0-or-later | https://github.com/espeak-ng/espeak-ng |
| piper-phonemize (wraps eSpeak NG for Piper) | MIT | https://github.com/rhasspy/piper-phonemize |
| WebAssembly build of the two above (`@diffusionstudio/piper-wasm@1.0.0`, the exact files shipped) | as above | https://www.npmjs.com/package/@diffusionstudio/piper-wasm/v/1.0.0 |
| Piper browser runtime (`@mintplex-labs/piper-tts-web`) | MIT | https://github.com/Mintplex-Labs/piper-tts-web |
| ONNX Runtime Web | MIT | https://github.com/microsoft/onnxruntime |
| transformers.js (runs the mic's speech model) | Apache-2.0 | https://github.com/huggingface/transformers.js |

### Not covered by the GPL, and used under their own terms

- **Alba**, the voice itself, is a Piper model trained on the University of Edinburgh CSTR *Alba* dataset: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit: CSTR, University of Edinburgh; model by the Piper project.
- **Whisper base.en**, the mic's speech-to-text model (downloaded on first use, not shipped in the repo): MIT, by OpenAI; ONNX conversion by Xenova / the transformers.js project.
- **Sound effects** (`public/*.mp3`) are from [ZapSplat](https://www.zapsplat.com), used under the project owner's paid ZapSplat account. That licence is personal to the account holder: the files are *not* GPL-licensed and may not be reused or redistributed from here. If you reuse this project, replace them with sounds you have the rights to (any four mp3s with the same names work).
- **Food icons** are [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) © Microsoft, MIT (GPL-compatible).
