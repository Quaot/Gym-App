import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Hand-rolled SVG charts, per the house dataviz rules: 2px lines with a ~10%
 * area wash, ≥8px markers ringed in the surface color, bars ≤24px with 4px
 * rounded data-ends (square at the baseline), hairline solid gridlines, all
 * text in text tokens (never the series color), and a scrub/hover layer.
 */

export const useWidth = <T extends HTMLElement>(): [React.MutableRefObject<T | null>, number] => {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(320)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

const niceTicks = (min: number, max: number, count = 3): number[] => {
  if (max <= min) return [min]
  const span = max - min
  const step = 10 ** Math.floor(Math.log10(span / count))
  const err = span / count / step
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1
  const s = step * mult
  const start = Math.ceil(min / s) * s
  const out: number[] = []
  for (let v = start; v <= max + 1e-9; v += s) out.push(Math.round(v * 100) / 100)
  return out
}

const SURFACE = 'var(--surface)'
const GRID = 'var(--border)'
const INK_MUTED = 'var(--faint)'

/* ------------------------------------------------------------------ *
 *  LineChart: single-series trend with area wash, PR markers, scrub.
 * ------------------------------------------------------------------ */
export interface LinePoint {
  t: number
  value: number
  emphasis?: boolean
  label?: string
}

export const LineChart = ({
  points, height = 180, color = 'var(--accent)', format = (v) => String(v),
  formatT = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
}: {
  points: LinePoint[]
  height?: number
  color?: string
  format?: (v: number) => string
  formatT?: (t: number) => string
}) => {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [scrub, setScrub] = useState<number | null>(null)

  if (points.length === 0) {
    return <div className="empty small">No data yet.</div>
  }

  const pad = { l: 34, r: 12, t: 14, b: 22 }
  const w = Math.max(120, width) - pad.l - pad.r
  const h = height - pad.t - pad.b
  const ts = points.map((p) => p.t)
  const vs = points.map((p) => p.value)
  const t0 = Math.min(...ts)
  const t1 = Math.max(...ts)
  const vMin = Math.min(...vs)
  const vMax = Math.max(...vs)
  const vPad = (vMax - vMin || vMax || 1) * 0.12
  const y0 = vMin - vPad
  const y1 = vMax + vPad
  const x = (t: number) => pad.l + (t1 === t0 ? w / 2 : ((t - t0) / (t1 - t0)) * w)
  const y = (v: number) => pad.t + h - ((v - y0) / (y1 - y0)) * h

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${path} L${x(points[points.length - 1].t).toFixed(1)},${(pad.t + h).toFixed(1)} L${x(points[0].t).toFixed(1)},${(pad.t + h).toFixed(1)} Z`

  const scrubbed = scrub === null ? null : points.reduce((best, p) =>
    Math.abs(x(p.t) - scrub) < Math.abs(x(best.t) - scrub) ? p : best,
  )

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setScrub(e.clientX - rect.left)
  }

  return (
    <div ref={ref}>
      <svg
        width="100%" height={height} viewBox={`0 0 ${Math.max(120, width)} ${height}`}
        role="img" aria-label={`Trend of ${points.length} sessions`}
        onPointerMove={onMove} onPointerLeave={() => setScrub(null)} onPointerDown={onMove}
        style={{ touchAction: 'pan-y' }}
      >
        {niceTicks(y0, y1).map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={pad.l + w} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill={INK_MUTED}>
              {format(v)}
            </text>
          </g>
        ))}

        <path d={area} fill={color} opacity={0.1} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => {
          const emphasized = p.emphasis || i === points.length - 1
          if (!emphasized) return null
          return (
            <circle
              key={i} cx={x(p.t)} cy={y(p.value)} r={4.5}
              fill={color} stroke={SURFACE} strokeWidth={2}
            />
          )
        })}

        {/* Endpoint direct label */}
        <text
          x={Math.min(x(points[points.length - 1].t) + 6, pad.l + w)}
          y={y(points[points.length - 1].value) - 8}
          fontSize={11} fontWeight={700} fill="var(--text)" textAnchor="end"
        >
          {format(points[points.length - 1].value)}
        </text>

        <text x={pad.l} y={height - 6} fontSize={10} fill={INK_MUTED}>{formatT(t0)}</text>
        <text x={pad.l + w} y={height - 6} fontSize={10} fill={INK_MUTED} textAnchor="end">{formatT(t1)}</text>

        {scrubbed && (
          <g>
            <line x1={x(scrubbed.t)} x2={x(scrubbed.t)} y1={pad.t} y2={pad.t + h} stroke={INK_MUTED} strokeWidth={1} />
            <circle cx={x(scrubbed.t)} cy={y(scrubbed.value)} r={5} fill={color} stroke={SURFACE} strokeWidth={2} />
          </g>
        )}
      </svg>
      <div className="row tiny" style={{ minHeight: 18, padding: '0 4px' }}>
        {scrubbed ? (
          <>
            <span className="label-2">{formatT(scrubbed.t)}</span>
            <span className="spacer" />
            <span className="num" style={{ fontWeight: 700 }}>{format(scrubbed.value)}</span>
            {scrubbed.label && <span className="label-2"> · {scrubbed.label}</span>}
          </>
        ) : (
          <span className="label-3">Touch to inspect</span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Bars: weekly magnitude, one hue, ≤24px, rounded data-end.
 * ------------------------------------------------------------------ */
export const Bars = ({
  values, labels, height = 140, color = 'var(--accent)', format = (v) => String(v),
}: {
  values: number[]
  labels: string[]
  height?: number
  color?: string
  format?: (v: number) => string
}) => {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [picked, setPicked] = useState<number | null>(null)
  const pad = { l: 4, r: 4, t: 16, b: 18 }
  const w = Math.max(120, width) - pad.l - pad.r
  const h = height - pad.t - pad.b
  const max = Math.max(1, ...values)
  const slot = w / values.length
  const barW = Math.min(24, Math.max(6, slot - 2)) // 2px surface gap minimum

  const peakIndex = values.indexOf(Math.max(...values))

  return (
    <div ref={ref}>
      <svg width="100%" height={height} viewBox={`0 0 ${Math.max(120, width)} ${height}`} role="img"
        aria-label={`Bar chart of ${values.length} periods`}>
        {values.map((v, i) => {
          const barH = Math.max(v > 0 ? 3 : 0, (v / max) * h)
          const bx = pad.l + i * slot + (slot - barW) / 2
          const by = pad.t + h - barH
          const r = Math.min(4, barW / 2, barH)
          const isPicked = picked === i
          return (
            <g key={i} onPointerDown={() => setPicked(isPicked ? null : i)} style={{ cursor: 'pointer' }}>
              {/* hit target bigger than the mark */}
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={h + pad.b} fill="transparent" />
              {barH > 0 && (
                <path
                  d={`M${bx},${by + r} Q${bx},${by} ${bx + r},${by} H${bx + barW - r} Q${bx + barW},${by} ${bx + barW},${by + r} V${pad.t + h} H${bx} Z`}
                  fill={color}
                  opacity={isPicked ? 1 : 0.82}
                />
              )}
              {(i === peakIndex || isPicked) && v > 0 && (
                <text x={bx + barW / 2} y={by - 5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="var(--text)">
                  {format(v)}
                </text>
              )}
            </g>
          )
        })}
        <line x1={pad.l} x2={pad.l + w} y1={pad.t + h} y2={pad.t + h} stroke={GRID} strokeWidth={1} />
        {labels.map((label, i) =>
          label ? (
            <text key={i} x={pad.l + i * slot + slot / 2} y={height - 5} textAnchor="middle" fontSize={9.5} fill={INK_MUTED}>
              {label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  CalendarHeatmap: one month, sequential single hue by working sets.
 * ------------------------------------------------------------------ */
export const CalendarHeatmap = ({
  days, monthTs,
}: {
  days: { day: number; sets: number }[]
  monthTs: number
}) => {
  const [ref, width] = useWidth<HTMLDivElement>()
  const cell = Math.min(44, Math.max(30, (Math.max(120, width) - 6 * 4) / 7))
  const gap = 4
  const base = new Date(monthTs)
  const firstDow = (new Date(base.getFullYear(), base.getMonth(), 1).getDay() + 6) % 7
  const max = Math.max(1, ...days.map((d) => d.sets))
  const rows = Math.ceil((firstDow + days.length) / 7)
  const today = new Date()
  const isThisMonth = today.getFullYear() === base.getFullYear() && today.getMonth() === base.getMonth()

  return (
    <div ref={ref}>
      <svg width="100%" height={rows * (cell + gap) + 14} viewBox={`0 0 ${7 * (cell + gap)} ${rows * (cell + gap) + 14}`}
        role="img" aria-label="Training calendar">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <text key={i} x={i * (cell + gap) + cell / 2} y={9} textAnchor="middle" fontSize={9} fill={INK_MUTED}>
            {d}
          </text>
        ))}
        {days.map(({ day, sets }) => {
          const idx = firstDow + day - 1
          const col = idx % 7
          const row = Math.floor(idx / 7)
          // Sequential: one hue, deeper with more sets.
          const alpha = sets === 0 ? 0 : 0.25 + 0.75 * (sets / max)
          const isToday = isThisMonth && day === today.getDate()
          return (
            <g key={day}>
              <rect
                className="heatmap-cell"
                x={col * (cell + gap)} y={14 + row * (cell + gap)}
                width={cell} height={cell}
                fill={sets === 0 ? 'var(--surface-2)' : `rgba(74, 222, 128, ${alpha.toFixed(2)})`}
                stroke={isToday ? 'var(--accent)' : 'none'} strokeWidth={isToday ? 1.5 : 0}
              />
              <text
                x={col * (cell + gap) + cell / 2} y={14 + row * (cell + gap) + cell / 2 + 3.5}
                textAnchor="middle" fontSize={10.5} fontWeight={sets > 0 ? 700 : 400}
                fill={sets > 0 && alpha > 0.6 ? 'var(--on-accent)' : 'var(--muted)'}
              >
                {day}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Scatter: sleep vs performance, with the fitted trend line.
 * ------------------------------------------------------------------ */
export const Scatter = ({
  points, fit, height = 190, color = 'var(--sleep)',
  formatX = (v) => String(v), formatY = (v) => String(v), xLabel, yLabel,
}: {
  points: { x: number; y: number; label?: string }[]
  fit?: { a: number; b: number } | null
  height?: number
  color?: string
  formatX?: (v: number) => string
  formatY?: (v: number) => string
  xLabel?: string
  yLabel?: string
}) => {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [picked, setPicked] = useState<number | null>(null)
  const pad = { l: 40, r: 12, t: 12, b: 26 }
  const w = Math.max(120, width) - pad.l - pad.r
  const h = height - pad.t - pad.b
  if (points.length === 0) return <div className="empty small">No data yet.</div>

  const xsv = points.map((p) => p.x)
  const ysv = points.map((p) => p.y)
  const x0 = Math.min(...xsv)
  const x1 = Math.max(...xsv)
  const yMin = Math.min(...ysv)
  const yMax = Math.max(...ysv)
  const xPad = (x1 - x0 || 1) * 0.08
  const yPad = (yMax - yMin || 1) * 0.15
  const X = (v: number) => pad.l + ((v - x0 + xPad) / (x1 - x0 + 2 * xPad)) * w
  const Y = (v: number) => pad.t + h - ((v - yMin + yPad) / (yMax - yMin + 2 * yPad)) * h

  const p = picked !== null ? points[picked] : null

  return (
    <div ref={ref}>
      <svg width="100%" height={height} viewBox={`0 0 ${Math.max(120, width)} ${height}`} role="img"
        aria-label={`Scatter of ${points.length} sessions`}>
        {niceTicks(yMin - yPad, yMax + yPad, 3).map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={pad.l + w} y1={Y(v)} y2={Y(v)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 6} y={Y(v) + 3.5} textAnchor="end" fontSize={10} fill={INK_MUTED}>{formatY(v)}</text>
          </g>
        ))}
        {fit && (
          <line
            x1={X(x0)} y1={Y(fit.a + fit.b * x0)}
            x2={X(x1)} y2={Y(fit.a + fit.b * x1)}
            stroke={color} strokeWidth={2} strokeDasharray="none" opacity={0.5}
          />
        )}
        {points.map((pt, i) => (
          <g key={i} onPointerDown={() => setPicked(picked === i ? null : i)} style={{ cursor: 'pointer' }}>
            <circle cx={X(pt.x)} cy={Y(pt.y)} r={12} fill="transparent" />
            <circle
              cx={X(pt.x)} cy={Y(pt.y)} r={picked === i ? 6 : 4.5}
              fill={color} stroke={SURFACE} strokeWidth={2}
            />
          </g>
        ))}
        <text x={pad.l + w / 2} y={height - 4} textAnchor="middle" fontSize={10} fill={INK_MUTED}>{xLabel}</text>
        <text x={12} y={pad.t + 2} fontSize={10} fill={INK_MUTED}>{yLabel}</text>
      </svg>
      <div className="row tiny" style={{ minHeight: 18, padding: '0 4px' }}>
        {p ? (
          <>
            <span className="label-2">{p.label}</span>
            <span className="spacer" />
            <span className="num" style={{ fontWeight: 700 }}>{formatX(p.x)} · {formatY(p.y)}</span>
          </>
        ) : (
          <span className="label-3">Tap to inspect</span>
        )}
      </div>
    </div>
  )
}
