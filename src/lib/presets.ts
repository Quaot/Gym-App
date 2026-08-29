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

const CARDIO_WARMUP = '5-10 min on the treadmill or Stairmaster.'
const ARM_WARMUP = `${CARDIO_WARMUP}\nDynamic: arm circles ×10, cable external rotations ×10.`
const LEG_WARMUP =
  `${CARDIO_WARMUP}\nDynamic (about 2 min): front-to-back leg swings, side-to-side leg swings, ` +
  'side-lying twists, step-throughs.'

/**
 * The six-day push/pull/legs rotation, as programmed. Days alternate
 * Push 1 → Pull 1 → Legs 1 → Push 2 → Pull 2 → Legs 2.
 *
 * Everything here is a starting point the app lets you edit: sets, rep ranges,
 * rest times and notes are all changeable per exercise. Where a workout calls
 * for something the tracker has no field for — supersets, feeder sets,
 * percentage ramps, timed holds — the instruction lives in the exercise note.
 */
export const pplProgram = (): Program => ({
  id: uid(),
  name: 'Push / Pull / Legs',
  days: [
    day('Push 1', ARM_WARMUP, [
      ex('Barbell Bench Press', 1, 3, 5, 210, 'Work up to one heavy top set.'),
      ex('Barbell Larsen Press', 2, 10, 10, 180, 'Legs up, no leg drive.'),
      ex('Standing Arnold Press', 3, 8, 10, 150),
      ex('Press-Around', 2, 12, 15, 30, 'Superset with the pec stretch below.'),
      ex('Pec Stretch', 2, 30, 30, 90, 'Log reps as seconds — 30 sec hold. Superset with press-arounds.'),
      ex('Cross-Body Cable Y-Raise', 3, 12, 15, 90),
      ex('Squeeze-Only Pressdown', 3, 8, 8, 30, 'Superset with the overhead extension below.'),
      ex('Stretch-Only Overhead Extension', 3, 8, 8, 90, 'Superset with the pressdown above.'),
      ex('Cross-Body Tricep Extension', 2, 10, 12, 90),
    ]),

    day('Pull 1', ARM_WARMUP, [
      ex('Lat Pulldown', 5, 10, 10, 150,
        'Feeder sets 1-4 at RPE 4-5, 6-7, 7-8, then 10. 5th set to failure + 30% drop set. ' +
        'Tap a set number to mark the feeders as warm-ups.'),
      ex('Omni-Grip Chest-Supported Row', 3, 10, 12, 120, 'Vary the grip each set.'),
      ex('Bottom-Half DB Pullover', 2, 10, 12, 30,
        'Superset: pullover → stretch right → stretch left, then rest 30 sec and start over.'),
      ex('Lat Static Stretch', 2, 30, 30, 30, 'Log reps as seconds — 30 sec each side.'),
      ex('Omni-Direction Face Pull-Up', 3, 12, 15, 90,
        'Set 1 low-to-high, set 2 mid-to-mid, set 3 high-to-low.'),
      ex('EZ-Bar Biceps Curl', 3, 6, 8, 120),
      ex('Bottom-Half DB Preacher Curl', 2, 10, 12, 90),
    ]),

    day('Legs 1', LEG_WARMUP, [
      ex('Squat', 4, 2, 4, 210,
        'Ramp first: 20% ×10, 35% ×5, 55% ×3, 70% ×2, 80% ×1. Working sets at 85-90% of 1RM.'),
      ex('Paused Squat', 2, 5, 5, 180, '75% of the working weight.'),
      ex('Romanian Deadlift', 3, 8, 10, 150),
      ex('Walking Lunges', 2, 10, 10, 120, 'Per leg. Do not cut the last steps short — keep the depth.'),
      ex('Seated Leg Curl', 3, 10, 12, 90, 'Set 1 toes out, set 2 toes in, set 3 neutral.'),
      ex('Leg Press Toe Press', 4, 10, 12, 90, 'Foot position: regular, out, in, regular.'),
      ex('Decline Plate Crunch', 3, 10, 12, 60),
    ]),

    day('Push 2', `${CARDIO_WARMUP}\nGeneral stretches.`, [
      ex('Incline Barbell Bench Press', 3, 5, 15, 180,
        'Set 1: 8 moderate. Set 2: 5 heavy. Set 3: 15 light. Three warm-up sets first (10, 4, 3).'),
      ex('Machine Shoulder Press', 3, 10, 12, 120),
      ex('Floor Reset Skullcrusher', 3, 6, 8, 120),
      ex('Bent-Over Cable Flye', 3, 10, 12, 90),
      ex('Machine Lat Raise', 3, 20, 20, 90, 'Reps 1-5 slow negative, reps 6-20 constant tension.'),
      ex('Plate Front Raise', 2, 15, 20, 60, 'Internal rotation at the top.'),
      ex('Diamond Push-Ups', 1, 5, 30, 60, 'AMRAP — go to failure.'),
    ]),

    day('Pull 2', ARM_WARMUP, [
      ex('1-Arm Half-Kneeling Lat Pulldown', 3, 12, 15, 120),
      ex('Pull-Up', 1, 5, 30, 150, 'AMRAP — as many reps as possible.'),
      ex('Kroc Row', 3, 10, 12, 120),
      ex('Cable Shrug-In', 3, 10, 12, 90),
      ex('Reverse Pec Deck', 3, 10, 12, 90),
      ex('Overhead Cable Biceps Curl', 3, 10, 12, 90),
    ]),

    day('Legs 2', LEG_WARMUP, [
      ex('Deadlift', 1, 5, 5, 240, 'Pyramid warm-up: 30% ×8, 50% ×4, 75% ×2, 90% ×1.'),
      ex('Stiff-Leg Deadlift', 2, 8, 8, 180, '50-60% of the deadlift working set.'),
      ex('Leg Press', 4, 10, 12, 150),
      ex('Glute-Ham Raise', 3, 8, 10, 120),
      ex('Slow-Eccentric Leg Extension', 3, 8, 10, 90),
      ex('Seated Calf Raise', 4, 15, 20, 90),
      ex('Roman Chair Leg Raise', 3, 10, 20, 60),
    ]),
  ],
})
