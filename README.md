# Sizzle

**Live app: https://james-ws-mccullough.github.io/cooking-timer-helper/**

Fast cooking timers with flip/stir alerts. Vue 3 + Vite, installable as a home-screen web app, works offline, no backend.

```sh
npm install
npm run dev      # http://localhost:5173, also exposed on your LAN
npm test         # timer engine tests
npm run build    # type-check + production build into dist/
npm run icons    # regenerate PWA icons from public/icon.svg
```

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes to GitHub Pages at `https://<user>.github.io/<repo>/`. One-time setup: in the repo's *Settings → Pages*, set **Source** to **GitHub Actions** (not "Deploy from a branch": that publishes the unbuilt source, which renders as a blank page).

## On a phone

Serve `dist/` over **HTTPS** (any static host), open it, then *Share → Add to Home Screen*.
HTTPS is required for offline support and for keeping the screen awake; plain `http://` over LAN is fine for a quick look but won't have either.

- Sound unlocks on your first tap (the New timer beep does it). If the app is reopened with timers already running, a red banner asks for one tap.
- The screen stays on while anything is counting down. A home-screen web app cannot make sound once the phone is locked or the app is in the background, so leave it open on the counter.
- Timers are timestamp-based and saved on the device: closing, reloading or sleeping never loses time.

## Sounds

The four files in `public/` can be swapped for any mp3 with the same name.

| File | Plays |
| --- | --- |
| `Beep.mp3` | New timer button; pausing or un-pausing a timer |
| `Timer Start.mp3` | A timer starts counting (end of the wizard, a preset, adding time to a finished timer), and pressing Done on any pending card |
| `Timer Complete.mp3` | Once, when a timer finishes |
| `Notify.mp3` | When a flip alert appears, then every 15 s while anything is waiting on you (one shared reminder, however many cards) |

Pending cards shimmer each time `Notify` or `Timer Complete` plays.

## Icons

Food icons are [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (flat style, MIT © Microsoft), pulled in through `unplugin-icons` so only the ones imported in `src/components/FoodIcon.vue` ship. `src/lib/foodIcons.ts` decides which icon a timer name gets, including typed names ("Wedges" → potato); add a keyword or a new rule there.

## Layout

- `src/lib/timer.ts` – pure timer engine (alerts, holding, attention events); `timer.test.ts` covers it
- `src/lib/audio.ts` – sound effects via Web Audio, mobile audio unlock
- `src/lib/wakeLock.ts` – screen wake lock
- `src/store.ts` – reactive state, persistence, 250 ms tick
- `src/lib/foodIcons.ts` – timer name → icon matching; `foodIcons.test.ts` covers it
- `src/components/` – `TimerCard.vue`, `NewTimerSheet.vue`, `FoodIcon.vue`
