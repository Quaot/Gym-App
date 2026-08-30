import type {
  DayTemplate, Equipment, Exercise, ExerciseTemplate, Program, Unit, WarmupStep,
} from '../types'
import { uid } from './util'
import { defaultIncrement, makeExercise, slugify } from './catalog'

/*
 * ---------------------------------------------------------------------------
 * House style. Keep every line below to these rules so the program reads the
 * same way on every screen.
 *
 * EXERCISE NAMES
 *   - Title Case, always singular: "Diamond Push-Up", not "Diamond Push Ups".
 *   - Order: modifier then equipment then movement.
 *   - Spell equipment out: Dumbbell, not DB. No digits: Single-Arm, not 1-Arm.
 *   - Hyphenate compound modifiers: Cross-Body, Bottom-Half, Stiff-Leg.
 *   - Anatomy is plural: Biceps, Triceps. Movements are not: Fly, Raise.
 *   - Barbell lifts that need no disambiguation stay bare: Squat, Deadlift.
 *
 * NOTES (Orwell's rules apply)
 *   - Sentence case, full sentences, each ending in a period.
 *   - Short and active. Cut every word that earns nothing.
 *   - No em dashes, en dashes, or spaced hyphens anywhere in prose.
 *     Intra-word hyphens (Pull-Up, warm-up) and numeric ranges (8-10) stand.
 *   - Per-set instructions use semicolons: "Set 1 toes out; set 2 toes in"
 *   - Loads are "<n>% of your working weight" or "<n>% of your 1RM".
 *   - Warm-up prescriptions are DATA (the warmups array), never prose.
 *
 * DAY NOTES
 *   - One short line for cardio, one for dynamic work, nothing else.
 * ---------------------------------------------------------------------------
 */

interface ExerciseMeta {
  equipment: Equipment
  warmups: WarmupStep[]
  /** How far past repHigh the range may extend before a jump is forced. */
  extend: number
}

/** Warm-up schemes, by role. */
/**
 * The one warm-up ramp, as percentages of the weight you are about to work
 * with. It is built only for the barbell lift that opens a day, which is
 * where a cold heavy first set can actually hurt you. Everything after it is
 * done on a body that is already warm, and everything on a machine or a cable
 * carries a fraction of the risk, so neither gets rows it would only have to
 * delete.
 */
const RAMP: WarmupStep[] = [
  { pct: 0.5, reps: 6 },
  { pct: 0.7, reps: 4 },
  { pct: 0.85, reps: 2 },
  { pct: 0.9, reps: 1 },
]
const NONE: WarmupStep[] = []

/** Every exercise mentioned by any preset, keyed by slug. Built as a side
 *  effect of declaring the days below, so it can never drift from them. */
const catalog: Record<string, Exercise> = {}
const metaBySlug: Record<string, ExerciseMeta> = {}

const ex = (
  name: string,
  sets: number,
  repLow: number,
  repHigh: number,
  restSec: number,
  meta: ExerciseMeta,
  notes = '',
): ExerciseTemplate => {
  const slug = slugify(name)
  metaBySlug[slug] ??= meta
  catalog[slug] ??= {
    ...makeExercise(name, slug),
    equipment: meta.equipment,
    increment: defaultIncrement(meta.equipment, presetUnit),
  }
  return {
    id: uid(),
    exerciseId: slug,
    sets,
    repLow,
    repHigh,
    repCap: repHigh + meta.extend,
    restSec,
    warmups: meta.warmups,
    notes,
  }
}

/** Compact meta constructors. */
/** Opens a day with a barbell: the only case that earns a ramp. */
const heavy = (equipment: Equipment): ExerciseMeta => ({ equipment, warmups: RAMP, extend: 2 })
const compound = (equipment: Equipment): ExerciseMeta => ({ equipment, warmups: NONE, extend: 2 })
const iso = (equipment: Equipment): ExerciseMeta => ({ equipment, warmups: NONE, extend: 5 })
const body = (): ExerciseMeta => ({ equipment: 'bodyweight', warmups: NONE, extend: 5 })

const day = (name: string, notes: string, exercises: ExerciseTemplate[]): DayTemplate => ({
  id: uid(),
  name,
  notes,
  exercises,
})

const UPPER_WARMUP =
  'Cardio: 5 to 10 min, treadmill or Stairmaster\n' +
  'Dynamic: arm circles × 10; cable external rotations × 10 per arm'

const PUSH_2_WARMUP =
  'Cardio: 5 to 10 min, treadmill or Stairmaster\n' +
  'Dynamic: general stretches'

const LEG_WARMUP =
  'Cardio: 5 to 10 min, treadmill or Stairmaster\n' +
  'Dynamic: leg swings both planes; side lying twists; step throughs'

/** The unit preset increments are minted in. Callers set it before building. */
let presetUnit: Unit = 'lb'
export const setPresetUnit = (unit: Unit): void => {
  presetUnit = unit
}

/**
 * The six day push/pull/legs rotation. Days run in order:
 * Push 1, Pull 1, Legs 1, Upper 1, Lower 1, Push 2, Pull 2, Legs 2, Upper 2,
 * Lower 2. Ten days, so each pattern gets one heavy exposure and one
 * hypertrophy exposure per cycle: Legs 1 squats heavy and Lower 2 squats for
 * reps, Legs 2 pulls heavy and Lower 1 hinges for reps, and the two Upper
 * days share no exercise with each other.
 *
 * Warm-up ramps live in each exercise's warmups array, so the app computes
 * the weights. Notes hold only what data cannot: cues and set variations.
 */
export const pplProgram = (): Program => ({
  id: uid(),
  name: 'Push / Pull / Legs',
  presetKey: 'ppl6',
  days: [
    day('Push 1', UPPER_WARMUP, [
      ex('Barbell Bench Press', 1, 3, 5, 210, heavy('barbell'),
        'One heavy top set'),
      ex('Barbell Larsen Press', 2, 10, 10, 180, compound('barbell'),
        'Legs straight on the floor; no leg drive'),
      ex('Standing Arnold Press', 3, 8, 10, 150, compound('dumbbell')),
      ex('Press-Around', 2, 12, 15, 30, iso('cable'),
        'Superset with Pec Stretch; move straight into the stretch'),
      ex('Pec Stretch', 2, 30, 30, 90, body(),
        'Log the hold in seconds; closes the Press-Around superset, so rest after this one'),
      ex('Cross-Body Cable Y-Raise', 3, 12, 15, 90, iso('cable')),
      ex('Squeeze-Only Triceps Pressdown', 3, 8, 8, 30, iso('cable'),
        'Contracted half only; superset with Stretch-Only Overhead Triceps Extension'),
      ex('Stretch-Only Overhead Triceps Extension', 3, 8, 8, 90, iso('cable'),
        'Stretched half only; closes the Squeeze-Only Triceps Pressdown superset, so rest after this one'),
      ex('Cross-Body Triceps Extension', 2, 10, 12, 90, iso('cable')),
    ]),

    day('Pull 1', UPPER_WARMUP, [
      ex('Lat Pulldown', 2, 10, 10, 150,
        { equipment: 'cable', warmups: [{ pct: 0.55, reps: 10 }, { pct: 0.7, reps: 10 }, { pct: 0.85, reps: 10 }], extend: 3 },
        'Set 1 at RPE 10; set 2 to failure, then drop the weight 30% and continue'),
      ex('Omni-Grip Chest-Supported Row', 3, 10, 12, 120, compound('machine'),
        'Change your grip each set'),
      ex('Bottom-Half Dumbbell Pullover', 2, 10, 12, 30, iso('dumbbell'),
        'Stretched half only; superset with Lat Stretch, so move straight into it'),
      ex('Lat Stretch', 2, 30, 30, 30, body(),
        'Log the hold in seconds, per side; closes the Bottom-Half Dumbbell Pullover superset, so rest, then repeat the pair'),
      ex('Omni-Directional Cable Face Pull', 3, 12, 15, 90, iso('cable'),
        'Set 1 low to high; set 2 straight on; set 3 high to low'),
      ex('EZ-Bar Biceps Curl', 3, 6, 8, 120, iso('barbell')),
      ex('Bottom-Half Dumbbell Preacher Curl', 2, 10, 12, 90, iso('dumbbell'),
        'Stretched half only'),
    ]),

    day('Legs 1', LEG_WARMUP, [
      ex('Squat', 4, 2, 4, 210, heavy('barbell'),
        'Work at 85 to 90% of your 1RM'),
      ex('Paused Squat', 2, 5, 5, 180, { equipment: 'barbell', warmups: NONE, extend: 2 },
        '75% of your working weight; pause in the hole every rep'),
      ex('Romanian Deadlift', 3, 8, 10, 150, compound('barbell')),
      ex('Walking Lunge', 2, 10, 10, 120, iso('dumbbell'),
        '10 reps per leg; keep full depth on every step'),
      ex('Seated Leg Curl', 3, 10, 12, 90, iso('machine'),
        'Set 1 toes out; set 2 toes in; set 3 neutral'),
      ex('Leg Press Toe Press', 4, 10, 12, 90, iso('machine'),
        'Feet neutral; out; in; neutral'),
      ex('Decline Plate Crunch', 3, 10, 12, 60, body()),
    ]),

    day('Upper 1', UPPER_WARMUP, [
      ex('Incline Barbell Bench Press', 3, 6, 8, 180, heavy('barbell'),
        'Stop one rep short of failure on every set'),
      ex('Omni-Grip Chest-Supported Row', 3, 10, 12, 120, compound('machine'),
        'Change your grip each set'),
      ex('Machine Shoulder Press', 3, 10, 12, 120, compound('machine')),
      ex('Half-Kneeling Single-Arm Lat Pulldown', 3, 12, 15, 120, compound('cable'),
        'Per arm'),
      ex('Machine Lateral Raise', 3, 15, 20, 90, iso('machine'),
        'Constant tension, no pause at the bottom'),
      ex('Cross-Body Triceps Extension', 3, 10, 12, 90, iso('cable')),
      ex('EZ-Bar Biceps Curl', 3, 8, 10, 120, iso('barbell')),
    ]),

    day('Lower 1', LEG_WARMUP, [
      ex('Romanian Deadlift', 4, 8, 10, 180, heavy('barbell'),
        'Push the hips back and stop where the stretch ends'),
      ex('Leg Press', 3, 15, 20, 120, compound('machine'),
        'Feet low on the platform'),
      ex('Seated Leg Curl', 4, 10, 12, 90, iso('machine'),
        'Pause a beat at full contraction'),
      ex('Walking Lunge', 2, 10, 10, 120, iso('dumbbell'),
        '10 reps per leg, full depth on every step'),
      ex('Leg Press Toe Press', 4, 12, 15, 90, iso('machine'),
        'Feet neutral every set'),
      ex('Decline Plate Crunch', 3, 12, 15, 60, body()),
    ]),

    day('Push 2', PUSH_2_WARMUP, [
      ex('Incline Barbell Bench Press', 3, 5, 15, 180, heavy('barbell'),
        'Set 1 moderate for 8; set 2 heavy for 5; set 3 light for 15'),
      ex('Machine Shoulder Press', 3, 10, 12, 120, compound('machine')),
      ex('Floor-Reset Skullcrusher', 3, 6, 8, 120, iso('barbell'),
        'Rest the bar on the floor between reps'),
      ex('Bent-Over Cable Fly', 3, 10, 12, 90, iso('cable')),
      ex('Machine Lateral Raise', 3, 20, 20, 90, iso('machine'),
        'Slow negatives for reps 1 to 5; constant tension after'),
      ex('Plate Front Raise', 2, 15, 20, 60, iso('dumbbell'),
        'Rotate the plate inward at the top'),
      ex('Diamond Push-Up', 1, 5, 30, 60, body(),
        'One set to failure'),
    ]),

    day('Pull 2', UPPER_WARMUP, [
      ex('Half-Kneeling Single-Arm Lat Pulldown', 3, 12, 15, 120, compound('cable'),
        'Per arm'),
      ex('Pull-Up', 1, 5, 30, 150, body(),
        'One set to failure'),
      ex('Kroc Row', 3, 10, 12, 120, compound('dumbbell'),
        'Per arm'),
      ex('Cable Shrug-In', 3, 10, 12, 90, iso('cable')),
      ex('Reverse Pec Deck', 3, 10, 12, 90, iso('machine')),
      ex('Overhead Cable Biceps Curl', 3, 10, 12, 90, iso('cable')),
    ]),

    day('Legs 2', LEG_WARMUP, [
      ex('Deadlift', 1, 5, 5, 240, heavy('barbell'),
        'One working set'),
      ex('Stiff-Leg Deadlift', 2, 8, 8, 180, { equipment: 'barbell', warmups: NONE, extend: 2 },
        '50 to 60% of your Deadlift working weight'),
      ex('Leg Press', 4, 10, 12, 150, compound('machine')),
      ex('Glute-Ham Raise', 3, 8, 10, 120, body()),
      ex('Slow-Eccentric Leg Extension', 3, 8, 10, 90, iso('machine'),
        'Lower slowly every rep'),
      ex('Seated Calf Raise', 4, 15, 20, 90, iso('machine')),
      ex('Roman Chair Leg Raise', 3, 10, 20, 60, body()),
    ]),

    day('Upper 2', UPPER_WARMUP, [
      ex('Barbell Larsen Press', 3, 8, 10, 180, heavy('barbell'),
        'Legs straight on the floor; no leg drive'),
      ex('Pull-Up', 3, 6, 10, 150, body(),
        'Hang weight from a belt once you clear 10 clean reps'),
      ex('Standing Arnold Press', 3, 8, 10, 150, compound('dumbbell')),
      ex('Kroc Row', 3, 10, 12, 120, compound('dumbbell'),
        'Per arm'),
      ex('Cross-Body Cable Y-Raise', 3, 12, 15, 90, iso('cable')),
      ex('Reverse Pec Deck', 3, 12, 15, 90, iso('machine')),
      ex('Floor-Reset Skullcrusher', 3, 6, 8, 120, iso('barbell'),
        'Rest the bar on the floor between reps'),
      ex('Overhead Cable Biceps Curl', 3, 10, 12, 90, iso('cable')),
    ]),

    day('Lower 2', LEG_WARMUP, [
      ex('Paused Squat', 3, 8, 10, 180, heavy('barbell'),
        'Pause in the hole and drive out with no bounce'),
      ex('Glute-Ham Raise', 3, 6, 10, 120, body(),
        'Drive the hips through at the top'),
      ex('Slow-Eccentric Leg Extension', 4, 10, 12, 90, iso('machine'),
        'Lower slowly every rep'),
      ex('Seated Leg Curl', 3, 15, 20, 90, iso('machine'),
        'Stop two reps short of failure'),
      ex('Seated Calf Raise', 4, 12, 15, 90, iso('machine'),
        'Pause at the bottom of every rep'),
      ex('Roman Chair Leg Raise', 3, 10, 20, 60, body()),
    ]),
  ],
})

/**
 * The five day split: the three "day 1" variants, then an Upper day from the
 * Push 2 and Pull 2 compounds and a Lower day from Legs 2. Same catalog
 * slugs, so an exercise's history follows it between splits.
 */
export const pplulProgram = (): Program => ({
  id: uid(),
  name: 'PPL + Upper / Lower',
  presetKey: 'pplul5',
  days: [
    day('Push', UPPER_WARMUP, [
      ex('Barbell Bench Press', 1, 3, 5, 210, heavy('barbell'),
        'One heavy top set'),
      ex('Barbell Larsen Press', 2, 10, 10, 180, compound('barbell'),
        'Legs straight on the floor; no leg drive'),
      ex('Standing Arnold Press', 3, 8, 10, 150, compound('dumbbell')),
      ex('Cross-Body Cable Y-Raise', 3, 12, 15, 90, iso('cable')),
      ex('Squeeze-Only Triceps Pressdown', 3, 8, 8, 30, iso('cable'),
        'Contracted half only; superset with Stretch-Only Overhead Triceps Extension'),
      ex('Stretch-Only Overhead Triceps Extension', 3, 8, 8, 90, iso('cable'),
        'Stretched half only; closes the Squeeze-Only Triceps Pressdown superset, so rest after this one'),
    ]),

    day('Pull', UPPER_WARMUP, [
      ex('Lat Pulldown', 2, 10, 10, 150,
        { equipment: 'cable', warmups: [{ pct: 0.55, reps: 10 }, { pct: 0.7, reps: 10 }, { pct: 0.85, reps: 10 }], extend: 3 },
        'Set 1 at RPE 10; set 2 to failure, then drop the weight 30% and continue'),
      ex('Omni-Grip Chest-Supported Row', 3, 10, 12, 120, compound('machine'),
        'Change your grip each set'),
      ex('Omni-Directional Cable Face Pull', 3, 12, 15, 90, iso('cable'),
        'Set 1 low to high; set 2 straight on; set 3 high to low'),
      ex('EZ-Bar Biceps Curl', 3, 6, 8, 120, iso('barbell')),
      ex('Bottom-Half Dumbbell Preacher Curl', 2, 10, 12, 90, iso('dumbbell'),
        'Stretched half only'),
    ]),

    day('Legs', LEG_WARMUP, [
      ex('Squat', 4, 2, 4, 210, heavy('barbell'),
        'Work at 85 to 90% of your 1RM'),
      ex('Romanian Deadlift', 3, 8, 10, 150, compound('barbell')),
      ex('Walking Lunge', 2, 10, 10, 120, iso('dumbbell'),
        '10 reps per leg; keep full depth on every step'),
      ex('Seated Leg Curl', 3, 10, 12, 90, iso('machine'),
        'Set 1 toes out; set 2 toes in; set 3 neutral'),
      ex('Leg Press Toe Press', 4, 10, 12, 90, iso('machine'),
        'Feet neutral; out; in; neutral'),
      ex('Decline Plate Crunch', 3, 10, 12, 60, body()),
    ]),

    day('Upper', UPPER_WARMUP, [
      ex('Incline Barbell Bench Press', 3, 5, 15, 180, heavy('barbell'),
        'Set 1 moderate for 8; set 2 heavy for 5; set 3 light for 15'),
      ex('Kroc Row', 3, 10, 12, 120, compound('dumbbell'),
        'Per arm'),
      ex('Machine Shoulder Press', 3, 10, 12, 120, compound('machine')),
      ex('Half-Kneeling Single-Arm Lat Pulldown', 3, 12, 15, 120, compound('cable'),
        'Per arm'),
      ex('Reverse Pec Deck', 3, 10, 12, 90, iso('machine')),
      ex('Overhead Cable Biceps Curl', 3, 10, 12, 90, iso('cable')),
      ex('Floor-Reset Skullcrusher', 3, 6, 8, 120, iso('barbell'),
        'Rest the bar on the floor between reps'),
    ]),

    day('Lower', LEG_WARMUP, [
      ex('Deadlift', 1, 5, 5, 240, heavy('barbell'),
        'One working set'),
      ex('Stiff-Leg Deadlift', 2, 8, 8, 180, { equipment: 'barbell', warmups: NONE, extend: 2 },
        '50 to 60% of your Deadlift working weight'),
      ex('Leg Press', 4, 10, 12, 150, compound('machine')),
      ex('Glute-Ham Raise', 3, 8, 10, 120, body()),
      ex('Slow-Eccentric Leg Extension', 3, 8, 10, 90, iso('machine'),
        'Lower slowly every rep'),
      ex('Seated Calf Raise', 4, 15, 20, 90, iso('machine')),
      ex('Roman Chair Leg Raise', 3, 10, 20, 60, body()),
    ]),
  ],
})

/** Catalog entries for every preset exercise, minted in the given unit. */
export const presetCatalog = (unit: Unit = presetUnit): Record<string, Exercise> => {
  setPresetUnit(unit)
  // Populate via ex(); idempotent thanks to ??= above.
  pplProgram()
  pplulProgram()
  return Object.fromEntries(
    Object.entries(catalog).map(([k, v]) => [
      k,
      { ...v, increment: defaultIncrement(metaBySlug[k]?.equipment ?? 'machine', unit) },
    ]),
  )
}

/** Per-slug template metadata, for migrating older data onto v3 fields. */
export const presetTemplateMeta = (
  unit: Unit,
): Record<string, { equipment: Equipment; increment: number; warmups: WarmupStep[]; extend: number }> => {
  presetCatalog(unit)
  return Object.fromEntries(
    Object.entries(metaBySlug).map(([slug, meta]) => [
      slug,
      {
        equipment: meta.equipment,
        increment: defaultIncrement(meta.equipment, unit),
        warmups: meta.warmups,
        extend: meta.extend,
      },
    ]),
  )
}
