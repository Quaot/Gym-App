# Gym App

A phone-first push/pull/legs tracker: log your sets and reps in the gym with one
thumb, see what you lifted last time, and beat it.

It is an installable web app (PWA). Everything runs on your device and works
with no signal — nothing is uploaded, there are no accounts, and there is
nothing to pay for.

## What it does

- **Log sets fast.** Big +/- steppers for weight and reps, one tap to tick a set
  off. An untouched set carries the previous set's numbers, so a straight-sets
  exercise is three taps.
- **Shows last time, inline.** Every exercise displays what you did in your last
  session (`Last (3d ago): 60kg×8, 60kg×8, 60kg×7`) so progressive overload
  needs no mental arithmetic.
- **Rest timer.** Starts automatically when you tick a set, counts overtime, and
  chimes/vibrates when rest is up. Per-exercise rest times.
- **Your own program.** Push / Pull / Legs by default, but days and exercises
  are yours to edit, reorder, and rename.
- **Paste a workout in.** Rather than typing a routine in field by field, paste
  the list (see below).
- **History and progress.** Per-workout summaries with volume and duration, plus
  per-exercise history and your best set with an estimated 1RM.
- **Warm-up sets.** Tap a set number to mark it a warm-up; it is excluded from
  personal bests and from what carries forward.
- **Backups.** Export/import your whole history as a JSON file.

## Setting up your program

Open **Program → Edit** on a day, then **Paste list**, and paste one exercise
per line:

```
1. Barbell Bench Press — 3x6-8 (rest 3 min)
2. Incline Dumbbell Press 3 x 8-10
Cable Fly 2x12-15 (slow eccentric)
Overhead Press
```

- Sets and reps come from anything shaped like `3x6-8`, `3 × 8`, or `2 sets x 12`.
- A trailing `(...)` becomes a note on the exercise.
- A rest time — `(rest 3 min)`, `(90s)` — sets that exercise's rest timer.
  A duration that isn't labelled "rest" and sits among other words (`30 sec
  hold`) is kept as a note instead.
- A line with no numbers falls back to 3×8-12 and the default rest.

Leading numbering and bullets are ignored, so you can paste a list straight out
of a video description or your notes. The sheet previews what it recognised
before you commit, and everything stays editable field by field afterwards.

## Using it on your phone

Open the deployed URL in your phone's browser and add it to your home screen
(iOS Safari: Share → Add to Home Screen; Android Chrome: menu → Install app).
It then launches full-screen and works offline.

Your data lives in that browser's storage on that one device. Clearing site data
erases it, so take an occasional backup from **Settings → Export backup**.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # parser unit tests
npm run build      # production build into dist/
npm run preview    # serve the production build
```

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. Enable it once under **Settings → Pages →
Source: GitHub Actions**; the app then lives at
`https://<owner>.github.io/Gym-App/`.

The build's base path comes from `APP_BASE` (defaults to `/Gym-App/`). Serving
from a different path or a custom domain means setting that variable, e.g.
`APP_BASE=/ npm run build`.
