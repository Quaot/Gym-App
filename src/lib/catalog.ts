import type { Equipment, Exercise, ID, Unit } from '../types'

/** Stable id for an exercise name: 'Barbell Bench Press' -> 'barbell-bench-press'.
 *  Used for preset ids and for adopting free-typed names into the catalog, so
 *  the same movement always lands on the same id. */
export const slugify = (name: string): ID =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'exercise'

/** Movements logged without external load — reps drive PRs and volume. */
const BODYWEIGHT_SLUGS = new Set([
  'pull-up',
  'chin-up',
  'push-up',
  'diamond-push-up',
  'dip',
  'roman-chair-leg-raise',
  'hanging-leg-raise',
  'plank',
  'glute-ham-raise',
])

export const isBodyweightSlug = (slug: ID) => BODYWEIGHT_SLUGS.has(slug)

const guessEquipment = (name: string, id: ID): Equipment => {
  if (isBodyweightSlug(id)) return 'bodyweight'
  const n = name.toLowerCase()
  if (n.includes('barbell') || n.includes('deadlift') || n.includes('squat')) return 'barbell'
  if (n.includes('dumbbell')) return 'dumbbell'
  if (n.includes('cable') || n.includes('pulldown') || n.includes('pressdown')) return 'cable'
  return 'machine'
}

export const defaultIncrement = (equipment: Equipment, unit: Unit): number => {
  if (unit === 'lb') return equipment === 'barbell' || equipment === 'bodyweight' ? 5 : 10
  return equipment === 'barbell' || equipment === 'bodyweight' ? 2.5 : 5
}

export const makeExercise = (
  name: string,
  id: ID = slugify(name),
  unit: Unit = 'lb',
): Exercise => {
  const equipment = guessEquipment(name, id)
  return {
    id,
    name: name.trim(),
    bodyweight: isBodyweightSlug(id),
    equipment,
    increment: defaultIncrement(equipment, unit),
    archived: false,
  }
}

/** Finds an exercise by exact name (case/space-insensitive) or creates it. */
export const resolveExercise = (
  catalog: Record<ID, Exercise>,
  name: string,
  unit: Unit = 'lb',
): Exercise => {
  const slug = slugify(name)
  if (catalog[slug]) return catalog[slug]
  const key = name.trim().toLowerCase()
  for (const e of Object.values(catalog)) {
    if (e.name.trim().toLowerCase() === key) return e
  }
  return makeExercise(name, slug, unit)
}
