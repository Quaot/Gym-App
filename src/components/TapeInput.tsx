import { useEffect, useMemo, useRef, useState } from 'react'
import { detentTick, unlockAudio } from '../lib/audio'

export interface TapeInputProps {
  /** Committed value. null renders the ghost. */
  value: number | null
  /** What an untouched control shows and would commit. */
  ghost: number
  /** Fired once per settled gesture or typed entry — never per frame. */
  onCommit: (v: number) => void
  min: number
  max: number
  step: number
  /** Tall labeled tick every N steps. */
  majorEvery: number
  label: string
  suffix?: string
  format?: (v: number) => string
  /** Sound the detent clicks (vibration always runs where supported). */
  tickSound?: boolean
  decimal?: boolean
}

const PX_PER_STEP = 14
const FRICTION = 0.94
const MIN_FLICK = 0.25 // px/ms
const RUBBER = 0.3

const defaultFormat = (v: number) => String(Math.round(v * 100) / 100)

/**
 * A horizontal tape/ruler: the tick strip scrolls under a fixed needle, the
 * current value reads large above it. Drag sticks to the finger with a haptic
 * detent per step; a flick coasts with momentum and snaps to a detent;
 * dragging past the range rubber-bands. Tapping the numeral opens inline
 * typing. Fully controlled: no internal value survives the gesture.
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

  // Transient gesture offset in px (0 when idle). Rendered value derives
  // from `shown` + offset; nothing here outlives the gesture.
  const [offsetPx, setOffsetPx] = useState(0)
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')

  const drag = useRef<{
    pointerId: number
    startX: number
    lastX: number
    samples: { x: number; t: number }[]
    lastDetent: number
  } | null>(null)
  const anim = useRef<number | null>(null)
  const stripRef = useRef<SVGSVGElement | null>(null)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const quantize = (v: number) => {
    const snapped = Math.round(v / step) * step
    return clamp(Math.round(snapped * 1000) / 1000)
  }

  // Live value under the needle mid-gesture (left drag = increase).
  const liveValue = quantize(shown + offsetPx / PX_PER_STEP * step)

  const stopAnim = () => {
    if (anim.current !== null) {
      cancelAnimationFrame(anim.current)
      anim.current = null
    }
  }

  useEffect(() => stopAnim, [])

  const settle = (finalValue: number) => {
    setOffsetPx(0)
    commitRef.current(finalValue)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (typing) return
    stopAnim()
    unlockAudio()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      samples: [{ x: e.clientX, t: performance.now() }],
      lastDetent: liveValue,
    }
  }

  const rubberize = (raw: number): number => {
    const value = shown + (raw / PX_PER_STEP) * step
    if (value > max) {
      const overPx = ((value - max) / step) * PX_PER_STEP
      return raw - overPx * (1 - RUBBER)
    }
    if (value < min) {
      const underPx = ((min - value) / step) * PX_PER_STEP
      return raw + underPx * (1 - RUBBER)
    }
    return raw
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    // Drag left = tape moves left = value increases.
    const raw = d.startX - e.clientX
    const px = rubberize(raw)
    setOffsetPx(px)
    d.lastX = e.clientX
    const now = performance.now()
    d.samples.push({ x: e.clientX, t: now })
    while (d.samples.length > 6 || (d.samples.length > 2 && now - d.samples[0].t > 90)) {
      d.samples.shift()
    }
    const v = quantize(shown + (px / PX_PER_STEP) * step)
    if (v !== d.lastDetent) {
      d.lastDetent = v
      navigator.vibrate?.(4)
      if (tickSound) detentTick()
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    drag.current = null

    const now = performance.now()
    const oldest = d.samples[0]
    const dt = now - oldest.t
    const velocity = dt > 0 ? (oldest.x - d.lastX) / dt : 0 // px/ms, +ve = increasing

    const raw = d.startX - e.clientX
    let px = rubberize(raw)

    if (Math.abs(velocity) < MIN_FLICK) {
      settle(quantize(shown + (px / PX_PER_STEP) * step))
      return
    }

    // Momentum coast: decay velocity, keep clicking detents, snap at the end.
    let v = velocity * 16 // px per frame at ~60fps
    let lastDetent = quantize(shown + (px / PX_PER_STEP) * step)
    let tickBudget = 0
    const coast = () => {
      v *= FRICTION
      px = rubberize(px + v)
      const val = quantize(shown + (px / PX_PER_STEP) * step)
      setOffsetPx(px)
      if (val !== lastDetent) {
        lastDetent = val
        if (tickBudget++ % 2 === 0) {
          navigator.vibrate?.(3)
          if (tickSound) detentTick()
        }
      }
      const atEdge = val === min || val === max
      if (Math.abs(v) < 0.5 || (atEdge && Math.abs(v) < 6)) {
        settle(val)
        anim.current = null
        return
      }
      anim.current = requestAnimationFrame(coast)
    }
    anim.current = requestAnimationFrame(coast)
  }

  const openTyping = () => {
    stopAnim()
    unlockAudio()
    setText(format(shown))
    setTyping(true)
  }

  const commitTyped = () => {
    setTyping(false)
    const trimmed = text.trim().replace(',', '.')
    if (trimmed === '') return
    const n = parseFloat(trimmed)
    if (!Number.isNaN(n)) commitRef.current(clamp(n))
  }

  /* ------------------------------------------------------------ *
   * Tick strip: one SVG, translated. Regenerated only when the
   * visible window of ticks shifts.
   * ------------------------------------------------------------ */
  const stripWindow = 40 // steps drawn either side of the needle
  const centerStep = Math.round(liveValue / step)
  const anchor = Math.round(centerStep / majorEvery) * majorEvery

  const firstStep = anchor - stripWindow
  const ticks = useMemo(() => {
    const items: { i: number; major: boolean; label: string | null; x: number }[] = []
    for (let i = firstStep; i <= anchor + stripWindow; i++) {
      const v = i * step
      if (v < min - step / 2 || v > max + step / 2) continue
      const major = i % majorEvery === 0
      items.push({
        i,
        major,
        label: major ? format(Math.round(v * 100) / 100) : null,
        // Local strip coordinate: firstStep sits at x=0.
        x: (i - firstStep) * PX_PER_STEP,
      })
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstStep, anchor, min, max, step, majorEvery])

  // Translate the strip so the tick for the committed value sits under the
  // needle (container centre), then let the gesture offset carry it further.
  const stripShift = -((shown / step - firstStep) * PX_PER_STEP) - offsetPx

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
            className="big num"
            aria-label={`${label}: ${format(liveValue)}${suffix ? ` ${suffix}` : ''}. Tap to type.`}
            onClick={openTyping}
          >
            {format(liveValue)}
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
        aria-valuenow={liveValue}
        aria-valuetext={`${format(liveValue)}${suffix ? ` ${suffix}` : ''}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') settle(quantize(liveValue + step))
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') settle(quantize(liveValue - step))
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg
          ref={stripRef}
          className="strip"
          width={stripWindow * 2 * PX_PER_STEP}
          height={56}
          style={{ transform: `translate3d(${stripShift}px, 0, 0)` }}
          aria-hidden
        >
          {ticks.map((t) => (
            <g key={t.i}>
              <line
                x1={t.x}
                x2={t.x}
                y1={t.major ? 12 : 22}
                y2={t.major ? 44 : 34}
                stroke={t.major ? 'var(--muted)' : 'var(--border-strong)'}
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
                  fill="var(--faint)"
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
