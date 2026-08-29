import type { Unit } from '../types'

/**
 * What to hang on the bar.
 *
 * The one calculation you actually do between sets, and the one you get wrong
 * when you are tired. Greedy from the heaviest plate down, which is optimal
 * for any real plate set because every plate divides the ones above it.
 */

/** Plate sets as they exist in a commercial gym, heaviest first. */
export const PLATES_LB = [45, 35, 25, 10, 5, 2.5]
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

export const defaultBar = (unit: Unit): number => (unit === 'kg' ? 20 : 45)

export interface PlateLoad {
  /** Plates for one side of the bar, heaviest first. */
  perSide: number[]
  /** What the plates and bar actually add up to. */
  achieved: number
  /** True when the target is not loadable from this plate set. */
  approximate: boolean
}

export const platesFor = (
  target: number,
  bar: number,
  plates: number[] = PLATES_LB,
): PlateLoad | null => {
  if (!Number.isFinite(target) || target < bar) return null
  let side = (target - bar) / 2
  const perSide: number[] = []
  for (const plate of plates) {
    while (side >= plate - 1e-9) {
      perSide.push(plate)
      side -= plate
    }
  }
  const achieved = bar + perSide.reduce((a, b) => a + b, 0) * 2
  return { perSide, achieved, approximate: Math.abs(achieved - target) > 1e-9 }
}

/** "45, 25, 5" with repeats collapsed to "45 × 2". */
export const describePlates = (perSide: number[]): string => {
  const out: string[] = []
  for (let i = 0; i < perSide.length; ) {
    let n = 1
    while (perSide[i + n] === perSide[i]) n++
    out.push(n > 1 ? `${perSide[i]} × ${n}` : String(perSide[i]))
    i += n
  }
  return out.join(', ')
}
