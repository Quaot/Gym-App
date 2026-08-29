import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  /** The sentence to reveal. Kept short enough to read at a glance. */
  content: string
  children: ReactNode
  label?: string
}

const HOLD_MS = 500
const HOVER_MS = 300
/** Travel a press is allowed before it counts as a drag, in pixels. */
const SLOP = 8

/**
 * Detail on demand. The surface stays quiet and the explanation arrives on a
 * long press, or on hover where there is a pointer. Nothing about the layout
 * changes when it opens, so a card never jumps under your thumb.
 */
export const InfoPopover = ({ content, children, label }: Props) => {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moved = useRef(false)
  const origin = useRef<{ x: number; y: number } | null>(null)

  const clear = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  useEffect(() => clear, [])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    // Any tap elsewhere, or a scroll, dismisses it. Scrolling happens inside
    // the screen's own scroller, and a scroll event on a element other than
    // the document does not reach the window, so the listener has to capture.
    window.addEventListener('pointerdown', close, { once: true })
    window.addEventListener('scroll', close, { once: true, passive: true, capture: true })
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  const start = (delay: number) => {
    clear()
    moved.current = false
    timer.current = setTimeout(() => {
      if (!moved.current) {
        setOpen(true)
        navigator.vibrate?.(8)
      }
    }, delay)
  }

  return (
    <span
      className="info-wrap"
      onPointerDown={(e) => {
        origin.current = { x: e.clientX, y: e.clientY }
        if (e.pointerType !== 'mouse') start(HOLD_MS)
      }}
      onPointerMove={(e) => {
        // A press is never perfectly still. Only real travel counts as a drag.
        const from = origin.current
        if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > SLOP) {
          moved.current = true
        }
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => start(HOVER_MS)}
      onMouseLeave={() => {
        clear()
        setOpen(false)
      }}
    >
      {children}
      {open && (
        <span className="info-pop" role="status" aria-label={label}>
          {content}
        </span>
      )}
    </span>
  )
}
