import { useEffect, useMemo, useRef, useState } from 'react'
import { detentTick, unlockAudio } from '../lib/audio'

export interface TapeInputProps {
  /** Committed value. null renders the ghost. */
  value: number | null
  /** What an untouched control shows and would commit. */
  ghost: number
  /** Fired once per settled gesture or typed entry, never per frame. */
  onCommit: (v: number) => void
  min: number
  max: number
  step: number
  /** Tall labeled tick every N steps. */
  majorEvery: number
  label: string
  suffix?: string
  format?: (v: number) => string
  /** Sound the detent clicks; vibration always runs where supported. */
  tickSound?: boolean
  decimal?: boolean
}

const PX_PER_STEP = 14
const FRICTION = 0.92
const MIN_FLICK = 0.35 // px per ms
const MAX_COAST_PX = 15 * PX_PER_STEP
const RUBBER = 0.3
const STRIP_WINDOW = 80 // steps drawn either side of the committed value

const defaultFormat = (v: number) => String(Math.round(v * 100) / 100)

/**
 * A horizontal tape: the tick strip scrolls under a fixed needle and the
 * value reads large above it. The gesture never touches React state. It
 * writes the strip transform and the readout text directly through refs
 * inside requestAnimationFrame, so no frame is ever dropped to a render.
 * Position is continuous while the finger is down and snaps to a detent
 * only at release; a flick coasts a bounded distance; a cancelled pointer
 * (the browser claiming a scroll) restores the committed value.
 */
export const TapeInput = ({
  value,
  ghost,
  onCommit,
  min,
  max,
  step,
  majorEvery,
  label,
  suffix,
  format = defaultFormat,
  tickSound = true,
  decimal = false,
}: TapeInputProps) => {
  const shown = value ?? ghost
  const isGhost = value === null

  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')

  const stripRef = useRef<SVGSVGElement | null>(null)
  const readoutRef = useRef<HTMLButtonElement | null>(null)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  const gesture = useRef<{
    pointerId: number
    startX: number
    /** Signed px the tape moved from the committed position. */
    offsetPx: number
    lastDetent: number
    samples: { x: number; t: number }[]
    raf: number | null
    pendingX: number | null
  } | null>(null)
  const coastRaf = useRef<number | null>(null)

  const clampValue = (v: number) => Math.min(max, Math.max(min, v))
  const quantize = (v: number) => {
    const snapped = Math.round(v / step) * step
    return clampValue(Math.round(snapped * 1000) / 1000)
  }
  const valueAt = (offsetPx: number) => shown + (offsetPx / PX_PER_STEP) * step

  /* -------------------------------------------------------------- *
   * Idle geometry: React renders the strip once per committed value.
   * -------------------------------------------------------------- */
  const anchorStep = Math.round(shown / step)
  const firstStep = anchorStep - STRIP_WINDOW

  const ticks = useMemo(() => {
    const items: { i: number; major: boolean; label: string | null; x: number }[] = []
    for (let i = firstStep; i <= anchorStep + STRIP_WINDOW; i++) {
      const v = i * step
      if (v < min - step / 2 || v > max + step / 2) continue
      const major = i % majorEvery === 0
      items.push({
        i,
        major,
        label: major ? format(Math.round(v * 100) / 100) : null,
        x: (i - firstStep) * PX_PER_STEP,
      })
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstStep, anchorStep, min, max, step, majorEvery])

  /** Transform placing the tick for `shown + offsetPx` under the needle. */
  const transformFor = (offsetPx: number) =>
    `translate3d(${(-((shown / step - firstStep) * PX_PER_STEP) - offsetPx).toFixed(2)}px, 0, 0)`

  const paint = (offsetPx: number) => {
    if (stripRef.current) stripRef.current.style.transform = transformFor(offsetPx)
    if (readoutRef.current) {
      readoutRef.current.textContent = format(quantize(valueAt(offsetPx)))
    }
  }

  // Keep the DOM in sync whenever React renders (idle state only).
  useEffect(() => {
    if (!gesture.current && coastRaf.current === null) paint(0)
  })

  const stopCoast = () => {
    if (coastRaf.current !== null) {
      cancelAnimationFrame(coastRaf.current)
      coastRaf.current = null
    }
  }

  useEffect(
    () => () => {
      stopCoast()
      if (gesture.current?.raf) cancelAnimationFrame(gesture.current.raf)
    },
    [],
  )

  const clickDetent = (offsetPx: number, g: { lastDetent: number }) => {
    const v = quantize(valueAt(offsetPx))
    if (v !== g.lastDetent) {
      g.lastDetent = v
      navigator.vibrate?.(4)
      if (tickSound) detentTick()
    }
  }

  const rubberize = (raw: number): number => {
    const v = valueAt(raw)
    if (v > max) {
      const overPx = ((v - max) / step) * PX_PER_STEP
      return raw - overPx * (1 - RUBBER)
    }
    if (v < min) {
      const underPx = ((min - v) / step) * PX_PER_STEP
      return raw + underPx * (1 - RUBBER)
    }
    return raw
  }

  /** The single exit: snap, reset the DOM to the committed frame, commit. */
  const settle = (offsetPx: number) => {
    const final = quantize(valueAt(offsetPx))
    paint(0)
    if (final !== value) commitRef.current(final)
    else paint(0)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (typing) return
    stopCoast()
    unlockAudio()
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      offsetPx: 0,
      lastDetent: quantize(shown),
      samples: [{ x: e.clientX, t: performance.now() }],
      raf: null,
      pendingX: e.clientX,
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g || e.pointerId !== g.pointerId) return
    g.pendingX = e.clientX
    const now = performance.now()
    g.samples.push({ x: e.clientX, t: now })
    while (g.samples.length > 6 || (g.samples.length > 2 && now - g.samples[0].t > 90)) {
      g.samples.shift()
    }
    // One DOM write per frame, however many pointer events arrive.
    if (g.raf === null) {
      g.raf = requestAnimationFrame(() => {
        g.raf = null
        if (g.pendingX === null) return
        g.offsetPx = rubberize(g.startX - g.pendingX)
        paint(g.offsetPx)
        clickDetent(g.offsetPx, g)
      })
    }
  }

  const endGesture = (): NonNullable<typeof gesture.current> | null => {
    const g = gesture.current
    gesture.current = null
    if (g?.raf) cancelAnimationFrame(g.raf)
    return g ?? null
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = endGesture()
    if (!g || e.pointerId !== g.pointerId) return
    const offsetPx = rubberize(g.startX - e.clientX)

    const now = performance.now()
    const oldest = g.samples[0]
    const newest = g.samples[g.samples.length - 1]
    const dt = Math.max(1, (newest?.t ?? now) - oldest.t)
    const velocity = (oldest.x - (newest?.x ?? e.clientX)) / dt // px/ms, + = increase

    if (Math.abs(velocity) < MIN_FLICK) {
      settle(offsetPx)
      return
    }

    // Bounded coast: decay per frame, hard cap on total distance.
    let px = offsetPx
    let v = Math.max(-8, Math.min(8, velocity * 10)) // px per frame
    let travelled = 0
    const detentState = { lastDetent: quantize(valueAt(px)) }
    const coast = () => {
      v *= FRICTION
      const stepPx = Math.abs(v) > 0 ? v : 0
      if (travelled + Math.abs(stepPx) > MAX_COAST_PX) {
        settle(px)
        coastRaf.current = null
        return
      }
      travelled += Math.abs(stepPx)
      px = rubberize(px + stepPx)
      paint(px)
      clickDetent(px, detentState)
      const val = quantize(valueAt(px))
      const atEdge = val === min || val === max
      if (Math.abs(v) < 0.4 || (atEdge && Math.abs(v) < 4)) {
        settle(px)
        coastRaf.current = null
        return
      }
      coastRaf.current = requestAnimationFrame(coast)
    }
    coastRaf.current = requestAnimationFrame(coast)
  }

  /** The browser took the gesture (scroll): restore, never commit. */
  const onPointerCancel = (e: React.PointerEvent) => {
    const g = endGesture()
    if (!g || e.pointerId !== g.pointerId) return
    stopCoast()
    paint(0)
  }

  const openTyping = () => {
    stopCoast()
    unlockAudio()
    setText(format(shown))
    setTyping(true)
  }

  const commitTyped = () => {
    setTyping(false)
    const trimmed = text.trim().replace(',', '.')
    if (trimmed === '') return
    const n = parseFloat(trimmed)
    if (!Number.isNaN(n)) commitRef.current(clampValue(n))
  }

  return (
    <div className={`tape${isGhost ? ' ghosted' : ''}`}>
      <span className="label">{label}</span>
      <div className="readout">
        {typing ? (
          <input
            autoFocus
            inputMode={decimal ? 'decimal' : 'numeric'}
            aria-label={`${label}, type a value`}
            value={text}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitTyped}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTyped()
              if (e.key === 'Escape') setTyping(false)
            }}
          />
        ) : (
          <button
            ref={readoutRef}
            className="big num"
            aria-label={`${label}: ${format(shown)}${suffix ? ` ${suffix}` : ''}. Tap to type.`}
            onClick={openTyping}
          >
            {format(shown)}
          </button>
        )}
        {suffix && !typing && <span className="suffix">{suffix}</span>}
      </div>
      <div
        className="strip-wrap"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={shown}
        aria-valuetext={`${format(shown)}${suffix ? ` ${suffix}` : ''}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') commitRef.current(quantize(shown + step))
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') commitRef.current(quantize(shown - step))
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <svg
          ref={stripRef}
          className="strip"
          width={STRIP_WINDOW * 2 * PX_PER_STEP}
          height={56}
          style={{ transform: transformFor(0) }}
          aria-hidden
        >
          {ticks.map((t) => (
            <g key={t.i}>
              <line
                x1={t.x}
                x2={t.x}
                y1={t.major ? 12 : 22}
                y2={t.major ? 44 : 34}
                stroke={t.major ? 'var(--label-2)' : 'var(--gray3)'}
                strokeWidth={t.major ? 2 : 1.5}
                strokeLinecap="round"
              />
              {t.label !== null && (
                <text
                  x={t.x}
                  y={54}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--label-3)"
                >
                  {t.label}
                </text>
              )}
            </g>
          ))}
        </svg>
        <div className="needle" />
      </div>
    </div>
  )
}
