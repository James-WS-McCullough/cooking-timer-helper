# Sizzle

Cooking timers with flip/stir alerts, prepping and Sync Finish. Vue 3 + Vite + TypeScript, no backend, installable PWA, deployed to GitHub Pages on every push to `main`. The README explains each feature; this file is how to work on it.

## Commands

```sh
npm run dev          # local dev server
npm run check        # Biome lint+format check, vue-tsc, e2e type-check, unit tests. Run before saying "done".
npm run format       # apply Biome fixes
npm run test:e2e     # Playwright against the production build, headless Chrome, quiet. ~80s.
npm run test:e2e -- --ui            # watch/debug
E2E_VERBOSE=1 npm run test:e2e      # show page + test console output
npm run icons        # regenerate PWA icons from public/icon.svg
```

A push to `main` runs check → e2e → build → deploy; a red e2e run blocks the deploy. Don't push without being asked.

## Design rules (decided with the owner; don't relitigate them)

- **Fast to start, configure afterwards.** A timer is three taps: New timer → name → time. Optional things (alerts) live on the running card (the bell), not in the wizard. No edit flow, no −30s: cooking only ever needs *more* time (+30s, tap it repeatedly).
- **One decision per screen.** Flows are sequential screens where a tap moves forward by itself, never a scrolling form. Every step must fit without scrolling on an iPhone SE (375×667), and search must work with the keyboard up on a landscape iPad mini (~340px visible).
- **Shortest label that still says it.** One-word food names first ("Turkey" before "Roast turkey"); typed all-lowercase names get a capital.
- **Minimal chrome.** No header. The utilities (Sizzle's voice, theme, QR) are loose buttons on the empty start screen; while timers run they sit behind one quiet sliders icon in a slim strip that scrolls with the list (a pinned corner button would end up over a card's bell and ✕). Anything new of that kind goes in that sheet, not on the timer screen. Solve technical needs invisibly (the New timer beep is what unlocks audio).
- **Big, forgiving touch targets** (`--tap: 52px` minimum). Fingers are wet. Destructive actions take two deliberate taps and back out by themselves.
- **Nothing moves under a finger.** The card list only re-sorts after 3s without touches; removing/clearing animates neighbours rather than jumping.
- **Colour means state, consistently:** blue = primary/accent, amber = a flip/stir needs doing, green = finished, lemon (dashed) = prepped for later, violet = Sync Finish and its pre-timers, red = destructive. Tokens are in `src/style.css`; light mode is the `[data-theme='light']` block. Don't introduce a colour without a meaning.
- **Sounds:** Beep = button feedback (New/Prep/pause/play), Timer Start = something began counting or a pending card was confirmed, Timer Complete = once per finish, Notify = a new flip/due dish, then one shared reminder every 15s while anything is pending.
- Pause all / Resume all is the deliberate, simple answer to "the kitchen fell behind"; Sync Finish does not re-plan itself.
- Respect `prefers-reduced-motion` in every animation.

## Architecture

- `src/lib/timer.ts` is the engine: pure functions over plain objects, everything derived from wall-clock timestamps (never counted ticks), so sleep, backgrounding and reloads can't lose time. All timer behaviour goes here first, with a unit test in `timer.test.ts`. No DOM, no Vue.
- `src/store.ts` is the only stateful module: one reactive `state`, a 250ms `tick()` that advances timers, picks the sound and manages the wake lock, and thin actions that call the engine + play a sound. Persistence goes through `src/lib/storage.ts`.
- **Saved data is versioned** (`CURRENT_VERSION` in `storage.ts`). Changing the saved shape means bumping it and adding a migration step + test; parsing must never throw or drop a cook's presets.
- Components hold presentation only. `TimerCard.vue` renders one timer in any status; the sheets under `src/components/` are the wizard, the bell's alert editor, Sync Finish and the QR panel.
- The voice (`src/lib/voice/`): `index.ts` is the on/off state and the speaking queue, `chatter.ts` the rule for what gets said (urgent always and first; optional chat only after 20s of quiet; new kinds of line must pick a priority), `lines.ts` her dialogue (templates; its header has the rules a line must meet, and `phrases.test.ts` renders every line against awkward names), `phrases.ts` fills them in (pure, tested), `piper.ts` the lazy Piper loader (synthesis is strictly one sentence at a time: overlapping requests fail), `voiceBox.ts` + `wsola.ts` the pitch shift. Nothing in it may load before the cook enables the voice; the 33 MB runtime is copied into `dist/voice/` by `hostedAssets()` in `vite.config.ts`, never committed. Tests must never download the model (block `huggingface.co`).
- The mic (`src/lib/listen/` + `ListenSheet.vue`): `spoken.ts` (in `src/lib/`, pure) turns a transcript into name/time/prep and is where any new phrasing goes: add the sentence and what it should become to `spoken.corpus.ts` (240 of them; its header has the rules) or, for a mishearing, to `spoken.test.ts`, then fix the parser, never the expectation; `spoken.corpus.test.ts` also pushes every listed food through every sentence shape, which is what catches a new filler word that's also part of a food's name; `capture.ts` is the pure audio half (resample, end of speech, trim to the voice); `recorder.ts` the mic; `models.ts` says which speech model and why (Whisper base.en, chosen by measurement and confirmed by the owner on a phone; the numbers for the alternatives are in its header), `transcriber.worker.ts` runs it via transformers.js. A model's `tag` is what the device remembers having downloaded, so a new model is announced before it's fetched. Same rules as the voice: nothing loads before the cook asks, the runtime is self-hosted (`/listen/`, `hostedAssets` in `vite.config.ts`), tests never download the model. E2E swaps the worker for a stand-in with `page.context().route` (a page-level route doesn't see a worker's script). A spoken timer is always shown before it's started.
- Food data: `src/data/foods.ts` (searchable list), `src/lib/foodIcons.ts` (name → icon), `src/lib/foodSearch.ts` (ranking). Icons are Fluent Emoji via `unplugin-icons`; every icon name used must be imported in `FoodIcon.vue` (it's a type error otherwise).

## Gotchas that have already bitten

- **`<TransitionGroup>` finishes any in-flight move animation if it re-renders.** Don't drive its classes/props from reactive state during a move (see the `is-clearing` handling in `App.vue`).
- A leaving item in a `TransitionGroup` needs `position: absolute` to let neighbours glide, and must be pinned (`top/left/width`) in `@before-leave` or it jumps to the container's corner.
- Animations on a **pseudo-element of a transition's root** fire `animationend` on the root and end Vue's transition early. Use a real child element.
- `position: fixed` inside an element with a `transform` (including one mid-transition) is positioned relative to it, not the viewport.
- `position: sticky` offsets are measured from inside the scroller's padding.
- Anything that disappears on touch-down shifts the page before touch-up and the tap misses (the sound banner fades first, then folds).
- Mobile audio: only after a user gesture; iOS needs `navigator.audioSession.type = 'playback'` to ignore the mute switch; a home-screen web app cannot sound while locked or backgrounded, hence the wake lock.
- iOS keyboards don't resize the layout viewport: size sheets from `window.visualViewport`, not `dvh` or media queries.
- Biome can't see template usage in `.vue` files, so its unused-variable rules are off there; `vue-tsc` covers it.

## Licence

GPL-3.0-or-later (because the robot voice's phonemiser, eSpeak NG, is GPL). New dependencies that ship in the app must be GPL-compatible (MIT, BSD, Apache-2.0, LGPL and GPL are fine; "non-commercial" or "no redistribution" terms are not). Anything that ships GPL code needs a row in the README's component table with a link to its source. The ZapSplat sounds are the known exception and are documented as excluded.

## Testing

- Engine and pure helpers: Vitest, `src/**/*.test.ts`.
- Behaviour: Playwright in `e2e/`, against the built app, phone viewport, system Chrome. Use roles and accessible names, not CSS, wherever possible. Time is controlled with `controlClock` + `pass` from `e2e/helpers.ts`; the page clock keeps flowing (freezing it would freeze Vue's transitions), so assert readings with `clockNear('10:00')`, and assert "didn't move" by comparing a reading to itself.
- A new feature needs an engine test if it has logic and an e2e test if it has a flow.
- Throwaway scripts and screenshots go in the session scratchpad, never the repo.
