# Sizzle

**Live app: https://james-ws-mccullough.github.io/cooking-timer-helper/**

Fast cooking timers with flip/stir alerts. Vue 3 + Vite, installable as a home-screen web app, works offline, no backend.

```sh
npm install
npm run dev      # http://localhost:5173, also exposed on your LAN
npm test         # timer engine tests
npm run build    # type-check + production build into dist/
npm run icons    # regenerate PWA icons from public/icon.svg (settings in pwa-assets.config.ts)
```

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes to GitHub Pages at `https://<user>.github.io/<repo>/`. One-time setup: in the repo's *Settings → Pages*, set **Source** to **GitHub Actions** (not "Deploy from a branch": that publishes the unbuilt source, which renders as a blank page).

## On a phone

Serve `dist/` over **HTTPS** (any static host), open it, then *Share → Add to Home Screen*.
HTTPS is required for offline support and for keeping the screen awake; plain `http://` over LAN is fine for a quick look but won't have either.

- Sound unlocks on your first tap (the New timer beep does it). If the app is reopened with timers already running, a red banner asks for one tap.
- The screen stays on while anything is counting down. A home-screen web app cannot make sound once the phone is locked or the app is in the background, so leave it open on the counter.
- Timers are timestamp-based and saved on the device: closing, reloading or sleeping never loses time.

## Making a timer, and alerts

A timer takes three taps: *New timer* → a name (chip, search, or skip) → a time. Mid-way alerts are not part of that: tap the **bell** on a timer's card to add, change or remove them (halfway, or every N minutes; Flip/Stir/Check/Baste; optionally holding the clock until confirmed). The bell works on running and prepped timers, only future alert times fire, and the editor can save the result as a preset.

## Prepping

*Prep a timer* (start screen, or *Prep* in the dock) runs the same wizard but leaves the timer waiting in the list with a Start button, so a whole meal can be set up before anything goes on the heat. Prepped timers and the prep wizard use the lemon `--prep` colours; they queue below everything that's already cooking and survive a reload.

## Sync Finish

With two or more prepped timers, a violet *Sync Finish* button appears above *New timer*. It explains the plan and, on *Sync Up & Start!*, starts the longest timer straight away and gives each of the others a pre-timer (longest time minus its own), so everything finishes together. When a pre-timer runs out the card turns solid violet ("Start Chicken") and joins the shared 15-second reminder until *Start* is pressed, which begins its real timer; a waiting card can also be started early with *Start now*. The maths lives in `syncPlan` / `syncFinish` in `src/lib/timer.ts`.

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
- `src/store.ts` – reactive state, persistence, 250 ms tick
- `src/data/foods.ts` – the searchable food list
- `src/lib/foodIcons.ts`, `src/lib/foodSearch.ts` – name → icon matching and list search, both with tests
- `src/components/` – `TimerCard.vue`, `TimerSheet.vue` (the new-timer wizard and the bell's alert editor), `FoodIcon.vue`, `SyncSheet.vue`, `QrSheet.vue` (loaded on demand), `SizzleLogo.vue`
