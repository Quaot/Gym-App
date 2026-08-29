import { barLayout } from '../lib/plates'
import type { PlateLoad } from '../lib/plates'
import type { Unit } from '../types'

/**
 * The bar as it will look when you have loaded it.
 *
 * You read a loaded bar by colour and by the size of the discs long before you
 * read any number, so this draws exactly that: the sleeve, the collar, and the
 * plates in the colours gyms actually use, biggest inboard. The arithmetic
 * lives in plates.ts; this only draws the answer.
 */
export const PlateBar = ({
  load, unit, bar,
}: { load: PlateLoad; unit: Unit; bar: number }) => {
  const plates = barLayout(load.perSide, unit)
  const H = 46
  const mid = H / 2
  const PLATE_W = 9
  const GAP = 2.5
  const SLEEVE = plates.length * (PLATE_W + GAP) + 14
  const SHAFT = 46
  const W = SLEEVE * 2 + SHAFT

  const sleeveEnd = (side: 'left' | 'right', i: number) =>
    side === 'left'
      ? SLEEVE - 14 - i * (PLATE_W + GAP) - PLATE_W
      : SLEEVE + SHAFT + 14 + i * (PLATE_W + GAP)

  return (
    <svg
      className="plate-bar"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={
        load.perSide.length === 0
          ? `Empty ${bar} ${unit} bar`
          : `${load.achieved} ${unit}: ${load.perSide.join(', ')} per side on a ${bar} ${unit} bar`
      }
    >
      {/* The bar itself, sleeves and shaft in one line. */}
      <rect x={0} y={mid - 3} width={W} height={6} rx={3} fill="var(--gray2)" />
      <rect x={SLEEVE - 4} y={mid - 5} width={4} height={10} rx={1.5} fill="var(--gray3)" />
      <rect x={SLEEVE + SHAFT} y={mid - 5} width={4} height={10} rx={1.5} fill="var(--gray3)" />

      {(['left', 'right'] as const).map((side) =>
        plates.map((p, i) => {
          const h = 12 + p.scale * (H - 14)
          return (
            <rect
              key={`${side}-${i}`}
              x={sleeveEnd(side, i)}
              y={mid - h / 2}
              width={PLATE_W}
              height={h}
              rx={2}
              fill={p.color}
            />
          )
        }),
      )}
    </svg>
  )
}
