# Gym App

A phone-first workout tracker: log sets with one thumb on custom tape sliders,
see exactly what you lifted last time, watch a month or a year of progress, and
find out whether sleep actually moves your numbers.

Installable web app (PWA). Everything runs on your device and works with no
signal — nothing is uploaded, no accounts, nothing to pay for.

## Logging a workout

- **Tape inputs, not spinners.** Weight and reps are set on a ruler that scrolls
  under a needle: drag to adjust with a haptic tick per step, flick for big
  jumps (momentum + snap), tap the big numeral to type instead. The value the
  ghost shows is exactly what completing the set records.
- **One active set at a time.** Completed and pending sets collapse to single
  lines; tap any line to reopen it. Completing a set auto-advances to the next.
- **Last time, inline.** `Last (3d ago): 100×5, 102.5×5, 105×4` on every
  exercise. Untouched sets prefill from your previous set, or last session's
  matching working set — warm-ups only ever inherit from warm-ups.
- **Rest timer, everywhere.** Starts when you complete a set, floats above the
  tab bar on every screen, survives navigation *and* reloads (the deadline is
  wall-clock and persisted), chimes and vibrates when done, counts overtime.
- **Everything is timed.** Total duration ticks live in the header; every set is
  timestamped, so the app shows the *actual* rest you took before each set and
  splits each workout into lifting vs resting time.

## The splits

Two built-in programs, both editable, switchable under **Program → Splits**:

- **Push / Pull / Legs** — the 6-day rotation (Push 1/2, Pull 1/2, Legs 1/2).
- **PPL + Upper / Lower** — 5 days: Push → Pull → Legs → Upper → Lower.

Exercises live in one catalog shared by both splits, so a lift keeps a single
history and PR record no matter which split (or free-typed session) it was
logged in. The home screen tracks your rotation and marks what's up next.

Day editing supports pasting a whole list (`Bench Press 3x6-8 (rest 3 min)` —
one exercise per line; sets/reps, rests, and notes are parsed and round-trip
losslessly).

## Progress

- **Per-exercise trend** — estimated 1RM (Epley) for loaded lifts, best-set reps
  for bodyweight movements, with PR markers, tap-to-scrub, and M / 6M / Y / All
  ranges.
- **Weekly volume** bars and a **calendar heatmap** with per-month workout,
  gym-time and volume totals.
- **Sleep × performance** — each workout is scored against your trailing
  average *for that same day type*, then plotted against the previous night's
  sleep: scatter, fitted trend, Pearson r, and a plain-language readout
  ("after 8h+ of sleep you lift +7.2% vs typical").

## Sleep

- **Quick log**: a 5-second slider on the Progress tab (0–14h, 15-minute steps).
- **Apple Health import** (Settings → Sleep): Health app → profile picture →
  *Export All Health Data* → open the zip in the app. It's parsed on-device in
  a background worker (streaming — a multi-hundred-MB export never loads into
  memory), overlapping iPhone/Watch records are merged rather than
  double-counted, and manual entries win over imported ones for the same night.

## Your data

- Stored on-device in localStorage, written per-slice with debouncing and
  flushed the moment the app is backgrounded.
- **Export/import backup** (JSON) in Settings; exports are Safari-proof.
- Malformed or hand-edited data is repaired, not rejected: bad entries are
  dropped individually and the rest survive. If rendering ever crashes anyway,
  an error screen still offers *Download backup* and *Reset* — no white screen
  of death.
- v1 data (the previous release) migrates automatically on first launch.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit suite (150 tests: migration, reducer invariants,
                   #   prefill, timing, analytics, sleep merge, correlation,
                   #   parser round-trips, preset style rules)
npm run build      # production build into dist/
npm run preview    # serve the production build on :4173
node scripts/e2e.mjs   # 48-assertion Playwright suite against the preview:
                   #   v1 migration, poisoned storage, the full workout loop,
                   #   tape gestures, rest-timer persistence, paste round-trip,
                   #   split switching, charts, the real Health-zip import,
                   #   hardware-back behavior, and 320px layout
```

Architecture notes: a framework-free store (`useSyncExternalStore` + pure
reducer; all ids/timestamps injected by action creators), per-slice persistence,
decoder-validated state with v1→v2 migration, hand-rolled SVG charts, and a
Web Worker + fflate for the Health import. The only runtime dependencies are
React and fflate.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml` (unit tests gate the deploy). Enable it once
under **Settings → Pages → Source: GitHub Actions**; the app then lives at
`https://<owner>.github.io/Gym-App/`. Add it to your home screen from there.

The base path comes from `APP_BASE` (defaults to `/Gym-App/`);
`APP_BASE=/ npm run build` for a custom domain.
