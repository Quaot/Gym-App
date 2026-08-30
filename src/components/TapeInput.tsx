import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { detentTick, unlockAudio } from '../lib/audio'
import {
  MIN_FLICK, PX_PER_STEP, RUBBER, coastLanding, quantizeToStep, velocityFrom,
} from '../lib/gestures'
import { haptic } from '../lib/haptics'

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

const STRIP_WINDOW = 80 // steps drawn either side of the committed value
/** How long the strip takes to glide to a thrown value it has already committed. */
const GLIDE_MS = 280

const defaultFormat = (v: number) => String(Math.round(v * 100) / 100)

/**
 * A horizontal tape: the tick strip scrolls under a fixed needle and the
 * value reads large above it. The gesture never touches React state. It
 * writes the strip transform and the readout text directly through refs
 * inside requestAnimationFrame, so no frame is ever dropped to a render.
 *
 * Rules that matter in a gym, with sweat on your hands:
 *   - Vertical movement cannot steal the drag, and a cancelled pointer keeps
 *     the number your finger reached rather than throwing it away.
 *   - A second finger is ignored, never destructive.
 *   - A throw commits its landing value at once and only the strip animates,
 *     so a set can never be logged with the number the tape was leaving.
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
  // The committed value as it stands right now. `settle` runs frames after the
  // render that scheduled it, so it must not close over a stale one.
  const valueRef = useRef(value)
  valueRef.current = value
  /** Offset to glide from once a thrown value has already been committed. */
  const glideFrom = useRef<number | null>(null)
  const typingCancelled = useRef(false)

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

  const quantize = (v: number) => quantizeToStep(v, step, min, max)
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

  const paint = (offsetPx: number, live = true) => {
    if (stripRef.current) stripRef.current.style.transform = transformFor(offsetPx)
    if (readoutRef.current) {
      // At rest the readout must read exactly what React rendered, or a value
      // off the current grid would show one number and commit another.
      readoutRef.current.textContent = live ? format(quantize(valueAt(offsetPx))) : format(shown)
    }
  }

  // Keep the DOM in sync whenever React renders (idle state only).
  useEffect(() => {
    if (!gesture.current && coastRaf.current === null && glideFrom.current === null) {
      paint(0, false)
    }
  })

  // A thrown value is committed at once; the strip then glides to it, so what
  // the eye follows and what the store holds can never disagree.
  useLayoutEffect(() => {
    const from = glideFrom.current
    const strip = stripRef.current
    if (from === null || !strip) return
    glideFrom.current = null
    strip.style.transition = 'none'
    strip.style.transform = transformFor(from)
    void strip.getBoundingClientRect()
    strip.style.transition = `transform ${GLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
    strip.style.transform = transformFor(0)
    const done = window.setTimeout(() => {
      strip.style.transition = ''
      paint(0, false)
    }, GLIDE_MS + 20)
    return () => window.clearTimeout(done)
  })

  /** Pins the screen while a finger is on the tape, so a slip cannot scroll. */
  const lockScroll = (on: boolean) => {
    document.body.toggleAttribute('data-tape-drag', on)
  }

  const stopCoast = () => {
    if (coastRaf.current !== null) {
      cancelAnimationFrame(coastRaf.current)
      coastRaf.current = null
    }
  }

  useEffect(
    () => () => {
      stopCoast()
      lockScroll(false)
      if (gesture.current?.raf) cancelAnimationFrame(gesture.current.raf)
    },
    [],
  )

  const clickDetent = (offsetPx: number, g: { lastDetent: number }) => {
    const v = quantize(valueAt(offsetPx))
    if (v !== g.lastDetent) {
      g.lastDetent = v
      haptic('tick')
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
    paint(0, false)
    if (final !== valueRef.current) commitRef.current(final)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    // A second finger must never take a live gesture away from the first.
    if (typing || gesture.current) return
    stopCoast()
    unlockAudio()
    lockScroll(true)
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

  /** Tears the gesture down, but only for the finger that owns it. */
  const endGesture = (pointerId: number): NonNullable<typeof gesture.current> | null => {
    const g = gesture.current
    if (!g || g.pointerId !== pointerId) return null
    gesture.current = null
    if (g.raf) cancelAnimationFrame(g.raf)
    lockScroll(false)
    return g
  }

  const release = (e: React.PointerEvent) => {
    const g = endGesture(e.pointerId)
    if (!g) return null
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    return g
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = release(e)
    if (!g) return
    const offsetPx = rubberize(g.startX - e.clientX)
    const velocity = velocityFrom(g.samples, e.clientX)

    if (Math.abs(velocity) < MIN_FLICK) {
      settle(offsetPx)
      return
    }

    // A throw lands where the friction says it lands, worked out here rather
    // than a frame at a time, and committed before anything else can read it.
    const landing = rubberize(coastLanding(offsetPx, velocity))
    const final = quantize(valueAt(landing))
    if (final !== valueRef.current) {
      // Offset of the release position relative to the value about to commit.
      glideFrom.current = offsetPx - ((final - shown) / step) * PX_PER_STEP
      if (tickSound) detentTick()
      haptic('tick')
      commitRef.current(final)
    } else {
      settle(landing)
    }
  }

  /**
   * The system took the pointer (a call, the app switcher, a slip the browser
   * read as something else). Keep the number the finger reached: losing a
   * weight you just dialled in is worse than any alternative.
   */
  const onPointerCancel = (e: React.PointerEvent) => {
    const g = endGesture(e.pointerId)
    if (!g) return
    stopCoast()
    settle(g.offsetPx)
  }

  /* -------------------------------------------------------------- *
   * Step buttons: the precise path, for when a drag is the wrong tool.
   * -------------------------------------------------------------- */
  const repeat = useRef<{ delay: number; tick: number }>({ delay: 0, tick: 0 })

  const nudge = (dir: 1 | -1) => {
    stopCoast()
    commitRef.current(quantize((valueRef.current ?? ghost) + dir * step))
  }

  const holdStart = (dir: 1 | -1) => (e: React.PointerEvent) => {
    e.preventDefault()
    unlockAudio()
    nudge(dir)
    if (tickSound) detentTick()
    repeat.current.delay = window.setTimeout(() => {
      repeat.current.tick = window.setInterval(() => {
        nudge(dir)
        if (tickSound) detentTick()
      }, 90)
    }, 400)
  }

  const holdEnd = () => {
    window.clearTimeout(repeat.current.delay)
    window.clearInterval(repeat.current.tick)
    repeat.current = { delay: 0, tick: 0 }
  }

  useEffect(() => holdEnd, [])

  const openTyping = () => {
    stopCoast()
    unlockAudio()
    setText(format(shown))
    setTyping(true)
  }

  const commitTyped = () => {
    setTyping(false)
    if (typingCancelled.current) {
      typingCancelled.current = false
      return
    }
    const trimmed = text.trim().replace(',', '.')
    if (trimmed === '') return
    const n = parseFloat(trimmed)
    // A typed number lands on the same grid a dragged one does.
    if (!Number.isNaN(n)) commitRef.current(quantize(n))
  }

  return (
    <div className={`tape${isGhost ? ' ghosted' : ''}`}>
      <span className="label">{label}</span>
      <div className="readout">
        {!typing && (
          <button
            className="tape-step"
            aria-label={`${label} down`}
            onPointerDown={holdStart(-1)}
            onPointerUp={holdEnd}
            onPointerLeave={holdEnd}
            onPointerCancel={holdEnd}
          >
            −
          </button>
        )}
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
              // Both paths end in a blur, which is the single commit point.
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                typingCancelled.current = true
                e.currentTarget.blur()
              }
            }}
          />
        ) : (
          <button
            ref={readoutRef}
            className="big num"
            aria-label={`${label}: ${format(shown)}${suffix ? ` ${suffix}` : ''}, tap to type`}
            onClick={openTyping}
          >
            {format(shown)}
          </button>
        )}
        {suffix && !typing && <span className="suffix">{suffix}</span>}
        {!typing && (
          <button
            className="tape-step"
            aria-label={`${label} up`}
            onPointerDown={holdStart(1)}
            onPointerUp={holdEnd}
            onPointerLeave={holdEnd}
            onPointerCancel={holdEnd}
          >
            +
          </button>
        )}
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
          height={64}
          style={{ transform: transformFor(0) }}
          aria-hidden
        >
          {ticks.map((t) => (
            <g key={t.i}>
              <line
                x1={t.x}
                x2={t.x}
                y1={t.major ? 14 : 25}
                y2={t.major ? 48 : 38}
                stroke={t.major ? 'var(--label-2)' : 'var(--gray3)'}
                strokeWidth={t.major ? 2 : 1.5}
                strokeLinecap="round"
              />
              {t.label !== null && (
                <text
                  x={t.x}
                  y={60}
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
