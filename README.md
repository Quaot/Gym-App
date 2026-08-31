# Gym App

A phone-first workout tracker: log sets with one thumb on custom tape sliders,
see exactly what you lifted last time, watch a month or a year of progress, and
find out whether sleep actually moves your numbers.

Installable web app (PWA), and an iPhone app built from the same source.
Everything runs on your device and works with no signal. Nothing is uploaded,
no accounts, nothing to pay for.

## How it behaves as an app

Add it to your Home Screen and it opens without browser furniture, on its own
launch screen.

- **Screens, not pages.** Each screen owns its scrolling under a fixed bar.
  Drilling in slides the new screen over the old one; a swipe from the left
  edge drags it back with your thumb, and letting go early springs it home
- **Large titles collapse** into the bar as you scroll, and every tab reopens
  exactly where you left it
- **A workout rises from the bottom** the way a sheet does, since you enter it
  from anywhere and leave it by finishing
- **Sheets drag away.** Pull one down past a third of its height, or flick it,
  and it goes. The keyboard lifts a sheet instead of burying it
- **The screen stays awake** for the whole workout
- **Rest alerts** reach you when you have looked away, once you turn them on in
  Settings. As a web app these need it on your Home Screen and only land while
  the page is still alive; the iPhone build hands the deadline to iOS instead,
  so the alert arrives whatever you are doing
- **New York** carries the titles and every number, and SF carries the rest
- **A colour per section**: Today blue, the workout purple, Program orange,
  Progress teal, History indigo, Settings graphite
- **Liquid glass** for the control layer: the tab bar is a floating capsule,
  and bars, buttons, sheets and the rest timer blur and brighten whatever
  passes beneath them, with a specular rim along the top edge. Content itself
  stays opaque, so nothing you read sits on glass
- **No copy closes with a period**, and no line splits one thought into two
  sentences. Both rules are enforced by tests, in the source and against the
  rendered screen

## The split

Ten days in rotation: Push 1, Pull 1, Legs 1, Upper 1, Lower 1, Push 2, Pull 2,
Legs 2, Upper 2, Lower 2. Each pattern gets one heavy exposure and one
hypertrophy exposure per cycle, and the two Upper days share no exercise. Today
suggests the next day in the rotation, and you can start any day you like.

A five day Push, Pull, Legs, Upper, Lower split is there too, under Splits on
the Program screen. History follows a movement between splits, since exercises
are identified by what they are rather than where they sit.

## Logging a workout

- **Tape inputs.** Weight and reps sit on a ruler that scrolls under a needle.
  Drag it, flick it, step it one detent at a time, or tap the number to type.
  The tape owns the gesture outright, so a diagonal thumb cannot hand it to the
  page, a second finger is ignored, and a cancelled pointer keeps the number
  your finger reached. A throw commits where it lands at the moment you let go,
  so a set can never be logged with the value the tape was leaving
- **One set at a time.** Finished and pending sets collapse to single lines.
  Completing one collapses it, advances to the next, and starts the rest timer
- **It tells you what to lift.** Every working set is pre-filled with what the
  progression engine suggests. Hold **Why** to read the reasoning
- **Warm-ups build themselves** from the weight you are about to work with, on
  the loadable grid, and never above your working set. Set a top set of 185 and
  the ramp appears under it; change it to 225 and the ramp moves with it. Edit
  a warm-up by hand and it stops following, because then it is yours
- **The bar, drawn**: every barbell set shows the loaded bar with the plates on
  it, in the colours gyms actually use, so you read it the way you read a rack
- **Plate math** under every barbell set: what to hang on each side
- **Where a lift is heading**: on the exercise screen, a line through the
  sessions you have logged reads off the date you reach the next round number.
  It stays quiet unless the trend is real, and shows its working on a tap
- **Records** are marked the moment you beat one, and again in the summary when
  you finish
- **Rest timer** floats over every screen, survives navigation and reloads,
  chimes, and counts overtime
- **Cancel** sits in the workout itself, one confirmation away

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
  flushed the moment the app is backgrounded
- **Export/import backup** (JSON) in Settings; exports are Safari-proof
- Malformed or hand-edited data is repaired, not rejected: bad entries are
  dropped individually and the rest survive. If rendering ever crashes anyway,
  an error screen still offers *Download backup* and *Reset*
- Data from earlier releases migrates automatically on first launch

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # 307 unit tests: migration chain, reducer invariants,
                   #   progression branches, warm-up generation, prefill,
                   #   timing, analytics, sleep merge, correlation, parser
                   #   round-trips, preset and copy rules, sample data,
                   #   navigation gestures, rest alerts
npm run build      # production build into dist/
npm run preview    # serve the production build on :4173
npm run ios:open   # build the iPhone app and open it in Xcode
node scripts/e2e.mjs   # 106-assertion Playwright suite against the preview:
                   #   migration, poisoned storage, the workout loop, tape
                   #   gestures including fast drags, rest-timer persistence,
                   #   warm-up generation, cancel, sample data, charts, the
                   #   real Health zip import, back behaviour, dash-free copy,
                   #   screen transitions, edge-swipe back, scroll memory,
                   #   sheet dismissal, and 320px layout
```

Icons and launch screens are drawn by `node scripts/assets.mjs`, so the whole
set shares one palette.

The iPhone app is the same source in a Capacitor shell, and everything it
needs lives under `native/`, described in [native/README.md](native/README.md).
Rest alerts, the screen staying awake and haptics each take a native path there
and the web path everywhere else; the browser build carries none of it, since
the bridge is loaded only on demand and kept out of the service worker's
precache.

Architecture notes: a framework-free store (`useSyncExternalStore` + pure
reducer; all ids/timestamps injected by action creators), per-slice persistence,
decoder-validated state with a v1 to v4 migration chain, hand-rolled SVG
charts, and a Web Worker plus fflate for the Health import. The only runtime
dependencies are React and fflate.

## Deploying

Two ways to end up with it on a Home Screen. As an app signed with your own
Apple developer account, which is [native/README.md](native/README.md), or as
the PWA below.

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml` (unit tests gate the deploy). Enable it once
under **Settings, Pages, Source: GitHub Actions**. The app then lives at
`https://<owner>.github.io/Gym-App/`. Add it to your home screen from there.

The base path comes from `APP_BASE`, which defaults to `/Gym-App/`. Use
`APP_BASE=/ npm run build` for a custom domain.
