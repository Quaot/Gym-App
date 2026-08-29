import type { DayTemplate, ExerciseTemplate, Program } from '../types'
import { uid } from './util'

const ex = (
  name: string,
  sets: number,
  repLow: number,
  repHigh: number,
  restSec: number,
  notes = '',
): ExerciseTemplate => ({ id: uid(), name, sets, repLow, repHigh, restSec, notes })

const day = (name: string, notes: string, exercises: ExerciseTemplate[]): DayTemplate => ({
  id: uid(),
  name,
  notes,
  exercises,
})

/*
 * ---------------------------------------------------------------------------
 * House style — keep every line below to these rules so the program reads the
 * same way on every screen.
 *
 * EXERCISE NAMES
 *   - Title Case, always singular: "Diamond Push-Up", not "Diamond Push Ups".
 *   - Order: modifier → equipment → movement.
 *     e.g. "Half-Kneeling Single-Arm Lat Pulldown", "Incline Barbell Bench Press".
 *   - Spell equipment out: Dumbbell, not DB. No digits: Single-Arm, not 1-Arm.
 *   - Hyphenate compound modifiers: Cross-Body, Bottom-Half, Stiff-Leg.
 *   - Anatomy is plural: Biceps, Triceps. Movements are not: Fly, Lateral Raise.
 *   - Barbell lifts that need no disambiguation stay bare: Squat, Deadlift.
 *
 * NOTES
 *   - Sentence case, full sentences, each ending in a period.
 *   - One idea per sentence, in this order: what to do → load → tempo or cue →
 *     app tip.
 *   - Per-set instructions use semicolons and the word "set":
 *     "Set 1 toes out; set 2 toes in; set 3 neutral."
 *   - Loads are "<n>% of your 1RM" or "<n>% of your working weight".
 *   - Multiplication is "×" with spaces around it: "20% × 10".
 *   - Times are "sec" and "min": "30 sec", "5-10 min".
 *   - Supersets name their partner exactly as the partner is named above.
 *     The first exercise says to go straight into the second; the second says
 *     it closes the pair and that the rest comes after it.
 *   - A set counted per limb says so: "10 reps per leg."
 *   - Leave the note empty when the name and the set/rep target say it all.
 *
 * DAY NOTES
 *   - Two lines, always the same two labels: "General:" then "Dynamic:".
 * ---------------------------------------------------------------------------
 */

const UPPER_WARMUP =
  'General: 5-10 min on the treadmill or Stairmaster.\n' +
  'Dynamic: arm circles × 10; cable external rotations × 10 per arm.'

const PUSH_2_WARMUP =
  'General: 5-10 min on the treadmill or Stairmaster.\n' +
  'Dynamic: general stretches.'

const LEG_WARMUP =
  'General: 5-10 min on the treadmill or Stairmaster.\n' +
  'Dynamic (about 2 min): front-to-back leg swings; side-to-side leg swings; ' +
  'side-lying twists; step-throughs.'

/**
 * The six-day push/pull/legs rotation, as programmed. Days run in order:
 * Push 1 → Pull 1 → Legs 1 → Push 2 → Pull 2 → Legs 2.
 *
 * Everything here is a starting point the app lets you edit: sets, rep ranges,
 * rest times and notes are all changeable per exercise. Where the programming
 * calls for something the tracker has no field for — supersets, feeder sets,
 * percentage ramps, timed holds — the instruction lives in the exercise note.
 */
export const pplProgram = (): Program => ({
  id: uid(),
  name: 'Push / Pull / Legs',
  days: [
    day('Push 1', UPPER_WARMUP, [
      ex('Barbell Bench Press', 1, 3, 5, 210,
        'Ramp up in warm-up sets, then take one heavy top set of 3-5 reps.'),
      ex('Barbell Larsen Press', 2, 10, 10, 180,
        'Legs straight out on the floor. No leg drive.'),
      ex('Standing Arnold Press', 3, 8, 10, 150),
      ex('Press-Around', 2, 12, 15, 30,
        'Superset with Pec Stretch. Go straight into the stretch without resting.'),
      ex('Pec Stretch', 2, 30, 30, 90,
        'Closes the Press-Around superset. Log the hold in seconds: 30 sec. Rest after this one.'),
      ex('Cross-Body Cable Y-Raise', 3, 12, 15, 90),
      ex('Squeeze-Only Triceps Pressdown', 3, 8, 8, 30,
        'Contracted half of the range only. Superset with Stretch-Only Overhead Triceps ' +
        'Extension. Go straight into it without resting.'),
      ex('Stretch-Only Overhead Triceps Extension', 3, 8, 8, 90,
        'Stretched half of the range only. Closes the Squeeze-Only Triceps Pressdown superset. ' +
        'Rest after this one.'),
      ex('Cross-Body Triceps Extension', 2, 10, 12, 90),
    ]),

    day('Pull 1', UPPER_WARMUP, [
      ex('Lat Pulldown', 5, 10, 10, 150,
        'Sets 1-4 are feeders, one step apart: set 1 at RPE 4-5; set 2 at RPE 6-7; ' +
        'set 3 at RPE 7-8; set 4 at RPE 10. Set 5 goes to failure, then drop the weight 30% ' +
        'and go again. Tap a set number to mark the feeders as warm-ups.'),
      ex('Omni-Grip Chest-Supported Row', 3, 10, 12, 120,
        'Use a different grip on each set.'),
      ex('Bottom-Half Dumbbell Pullover', 2, 10, 12, 30,
        'Stretched half of the range only. Superset with Lat Stretch. Go straight into the ' +
        'stretch without resting.'),
      ex('Lat Stretch', 2, 30, 30, 30,
        'Closes the Bottom-Half Dumbbell Pullover superset. Log the hold in seconds: 30 sec ' +
        'per side. Rest after this one, then start the pair again.'),
      ex('Omni-Directional Cable Face Pull', 3, 12, 15, 90,
        'Change the cable height each set: set 1 low to high; set 2 straight on; ' +
        'set 3 high to low.'),
      ex('EZ-Bar Biceps Curl', 3, 6, 8, 120),
      ex('Bottom-Half Dumbbell Preacher Curl', 2, 10, 12, 90,
        'Stretched half of the range only.'),
    ]),

    day('Legs 1', LEG_WARMUP, [
      ex('Squat', 4, 2, 4, 210,
        'Ramp first: 20% × 10; 35% × 5; 55% × 3; 70% × 2; 80% × 1. ' +
        'Working sets are 2-4 reps at 85-90% of your 1RM.'),
      ex('Paused Squat', 2, 5, 5, 180,
        '75% of your working weight. Pause in the hole on every rep.'),
      ex('Romanian Deadlift', 3, 8, 10, 150),
      ex('Walking Lunge', 2, 10, 10, 120,
        '10 reps per leg. Keep the depth on the last steps — do not cut them short.'),
      ex('Seated Leg Curl', 3, 10, 12, 90,
        'Change foot position each set: set 1 toes out; set 2 toes in; set 3 neutral.'),
      ex('Leg Press Toe Press', 4, 10, 12, 90,
        'Change foot position each set: set 1 neutral; set 2 toes out; set 3 toes in; ' +
        'set 4 neutral.'),
      ex('Decline Plate Crunch', 3, 10, 12, 60),
    ]),

    day('Push 2', PUSH_2_WARMUP, [
      ex('Incline Barbell Bench Press', 3, 5, 15, 180,
        'Three warm-up sets first: 10 reps; 4 reps; 3 reps. Then set 1 moderate for 8; ' +
        'set 2 heavy for 5; set 3 light for 15.'),
      ex('Machine Shoulder Press', 3, 10, 12, 120),
      ex('Floor-Reset Skullcrusher', 3, 6, 8, 120,
        'Rest the bar on the floor between reps.'),
      ex('Bent-Over Cable Fly', 3, 10, 12, 90),
      ex('Machine Lateral Raise', 3, 20, 20, 90,
        'Reps 1-5 with a slow negative; reps 6-20 with constant tension.'),
      ex('Plate Front Raise', 2, 15, 20, 60,
        'Rotate the plate inwards at the top.'),
      ex('Diamond Push-Up', 1, 5, 30, 60,
        'AMRAP: one set to failure. The rep range is only a guide.'),
    ]),

    day('Pull 2', UPPER_WARMUP, [
      ex('Half-Kneeling Single-Arm Lat Pulldown', 3, 12, 15, 120,
        '12-15 reps per arm.'),
      ex('Pull-Up', 1, 5, 30, 150,
        'AMRAP: one set to failure. The rep range is only a guide.'),
      ex('Kroc Row', 3, 10, 12, 120,
        '10-12 reps per arm.'),
      ex('Cable Shrug-In', 3, 10, 12, 90),
      ex('Reverse Pec Deck', 3, 10, 12, 90),
      ex('Overhead Cable Biceps Curl', 3, 10, 12, 90),
    ]),

    day('Legs 2', LEG_WARMUP, [
      ex('Deadlift', 1, 5, 5, 240,
        'Ramp first: 30% × 8; 50% × 4; 75% × 2; 90% × 1. Then take one working set of 5 reps.'),
      ex('Stiff-Leg Deadlift', 2, 8, 8, 180,
        '50-60% of your Deadlift working weight.'),
      ex('Leg Press', 4, 10, 12, 150),
      ex('Glute-Ham Raise', 3, 8, 10, 120),
      ex('Slow-Eccentric Leg Extension', 3, 8, 10, 90,
        'Lower slowly on every rep.'),
      ex('Seated Calf Raise', 4, 15, 20, 90),
      ex('Roman Chair Leg Raise', 3, 10, 20, 60),
    ]),
  ],
})
