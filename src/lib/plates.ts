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

export interface PlateStyle {
  /** The plate's denomination. */
  weight: number
  /** Height as a share of the biggest plate, for drawing. */
  scale: number
  /** Colour token, following the plate colours gyms actually use. */
  color: string
}

/**
 * How each plate is drawn. Competition plates are colour coded, and a lifter
 * reads a loaded bar by those colours long before reading any number, so the
 * drawing follows the same code: red 25 and blue 20 in kilos, blue 45 and
 * yellow 35 in pounds, and so on down to the small change.
 */
const STYLE_LB: Record<number, string> = {
  45: '#2b6cff',
  35: '#ffd60a',
  25: '#30d158',
  10: '#8e8e93',
  5: '#c7c7cc',
  2.5: '#636366',
}
const STYLE_KG: Record<number, string> = {
  25: '#ff453a',
  20: '#2b6cff',
  15: '#ffd60a',
  10: '#30d158',
  5: '#f2f2f7',
  2.5: '#ff375f',
  1.25: '#8e8e93',
}

export const plateStyle = (weight: number, unit: Unit): PlateStyle => {
  const table = unit === 'kg' ? STYLE_KG : STYLE_LB
  const biggest = unit === 'kg' ? 25 : 45
  const smallest = unit === 'kg' ? 1.25 : 2.5
  // Small plates are visibly smaller, but never so small they vanish.
  const span = biggest - smallest
  const scale = span > 0 ? 0.45 + 0.55 * ((weight - smallest) / span) : 1
  return {
    weight,
    scale: Math.min(1, Math.max(0.45, scale)),
    color: table[weight] ?? '#8e8e93',
  }
}

/** Everything a drawing of the loaded bar needs, given one side of plates. */
export const barLayout = (perSide: number[], unit: Unit): PlateStyle[] =>
  perSide.map((w) => plateStyle(w, unit))
