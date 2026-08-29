# Gym App

A phone-first workout tracker: log sets with one thumb on custom tape sliders,
see exactly what you lifted last time, watch a month or a year of progress, and
find out whether sleep actually moves your numbers.

Installable web app (PWA). Everything runs on your device and works with no
signal. Nothing is uploaded, no accounts, nothing to pay for.

## How it behaves as an app

Add it to your Home Screen and it opens without browser furniture, on its own
launch screen.

- **Screens, not pages.** Each screen owns its scrolling under a fixed bar.
  Drilling in slides the new screen over the old one; a swipe from the left
  edge drags it back with your thumb, and letting go early springs it home.
- **Large titles collapse** into the bar as you scroll, and every tab reopens
  exactly where you left it.
- **A workout rises from the bottom** the way a sheet does, since you enter it
  from anywhere and leave it by finishing.
- **Sheets drag away.** Pull one down past a third of its height, or flick it,
  and it goes. The keyboard lifts a sheet instead of burying it.
- **The screen stays awake** for the whole workout.
- **Rest alerts** reach you when you have looked away, once you turn them on in
  Settings. Notifications need the app on your Home Screen.
- **New York** carries the titles and every number; SF carries the rest.

## Logging a workout

- **Tape inputs.** Weight and reps sit on a ruler that scrolls under a needle.
  Drag it with a tick at every detent, flick it to travel, or tap the number to
  type. The gesture runs on animation frames and never touches React, so it
  tracks your thumb without skipping.
- **One set at a time.** Finished and pending sets collapse to single lines.
  Completing one collapses it, advances to the next, and starts the rest timer.
- **It tells you what to lift.** Every working set is pre-filled with what the
  progression engine suggests. Hold **Why** to read the reasoning.
- **Warm-ups build themselves** from the weight you are about to work with, on
  the loadable grid, and never above your working set.
- **Rest timer** floats over every screen, survives navigation and reloads,
  chimes, and counts overtime.
- **Cancel** sits in the workout itself, one confirmation away.

## How the suggestions work

Double progression, sized to the equipment in front of you.

Hold the weight and add reps until every working set reaches the top of the
range. Then the app measures what the smallest available jump costs as a share
of the load. On a 185 lb bench, 5 lb is under 3%, so it takes the jump and
expects you to land a rep lower. On a 30 lb lateral raise the smallest jump is
a third of the load, so it refuses and widens the rep range instead, until the
jump lands back inside the range.

That is why compound and isolation are not hard-coded. The deciding number is
the jump percentage, which also means a belt on a pull-up progresses like a
barbell lift once your bodyweight is counted.

It also holds the weight after a miss, reverts a jump that landed short, and
offers a 10% deload after three stuck sessions.

Rules and increments follow standard practice (NSCA load-increase guidance,
double progression as commonly taught, Epley for estimated maxes). Every branch
is covered by tests in `src/lib/progression.test.ts`.

## Your data

- Stored on-device in localStorage, written per-slice with debouncing and
  flushed the moment the app is backgrounded.
- **Export/import backup** (JSON) in Settings; exports are Safari-proof.
- Malformed or hand-edited data is repaired, not rejected: bad entries are
  dropped individually and the rest survive. If rendering ever crashes anyway,
  an error screen still offers *Download backup* and *Reset*.
- Data from earlier releases migrates automatically on first launch.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # 229 unit tests: migration chain, reducer invariants,
                   #   progression branches, warm-up generation, prefill,
                   #   timing, analytics, sleep merge, correlation, parser
                   #   round-trips, preset and copy rules, sample data,
                   #   navigation gestures, rest alerts
npm run build      # production build into dist/
npm run preview    # serve the production build on :4173
node scripts/e2e.mjs   # 84-assertion Playwright suite against the preview:
                   #   migration, poisoned storage, the workout loop, tape
                   #   gestures including fast drags, rest-timer persistence,
                   #   warm-up generation, cancel, sample data, charts, the
                   #   real Health zip import, back behaviour, dash-free copy,
                   #   screen transitions, edge-swipe back, scroll memory,
                   #   sheet dismissal, and 320px layout
```

Icons and launch screens are drawn by `node scripts/assets.mjs`, so the whole
set shares one palette.

Architecture notes: a framework-free store (`useSyncExternalStore` + pure
reducer; all ids/timestamps injected by action creators), per-slice persistence,
decoder-validated state with a v1 to v3 migration chain, hand-rolled SVG
charts, and a Web Worker plus fflate for the Health import. The only runtime
dependencies are React and fflate.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml` (unit tests gate the deploy). Enable it once
under **Settings, Pages, Source: GitHub Actions**. The app then lives at
`https://<owner>.github.io/Gym-App/`. Add it to your home screen from there.

The base path comes from `APP_BASE`, which defaults to `/Gym-App/`. Use
`APP_BASE=/ npm run build` for a custom domain.
