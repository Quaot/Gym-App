import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { haptic } from '../lib/haptics'

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
 * tap, on a long press, or on hover where there is a pointer. Nothing about
 * the layout changes when it opens, so a card never jumps under your thumb.
 *
 * A tap opens it as well as a hold, because a control that answers only to a
 * long press is a secret. The hold stays for anything large enough to press
 * without meaning to open it.
 */
/** Room a popover needs above its trigger before it has to open downward. */
const HEADROOM = 170
/** How long a popover ignores the scroll it may have been opened during. */
const ARM_MS = 250

export const InfoPopover = ({ content, children, label }: Props) => {
  const [open, setOpen] = useState(false)
  const [below, setBelow] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moved = useRef(false)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const wrap = useRef<HTMLSpanElement | null>(null)

  /**
   * Opens on whichever side has room. A trigger near the top of the screen
   * would otherwise put its explanation off the top of it, which is how the
   * set group headings used to read.
   */
  const reveal = () => {
    const box = wrap.current?.getBoundingClientRect()
    setBelow(box !== undefined && box.top < HEADROOM)
    setOpen(true)
  }

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
    //
    // Armed a beat late on purpose: a press that brought its own row into
    // view, or one made while the list still had momentum, would otherwise
    // be dismissed by the scroll it was already riding, and the explanation
    // you asked for would flash and vanish.
    const armed = window.setTimeout(() => {
      window.addEventListener('pointerdown', close, { once: true })
      window.addEventListener('scroll', close, { once: true, passive: true, capture: true })
    }, ARM_MS)
    return () => {
      window.clearTimeout(armed)
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  const start = (delay: number) => {
    clear()
    moved.current = false
    timer.current = setTimeout(() => {
      if (!moved.current) {
        reveal()
        haptic('select')
      }
    }, delay)
  }

  return (
    <span
      className="info-wrap"
      role="button"
      tabIndex={0}
      aria-label={label}
      ref={wrap}
      onClick={() => { if (!moved.current) reveal() }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (open) setOpen(false)
          else reveal()
        }
      }}
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
        <span className={`info-pop${below ? ' below' : ''}`} role="status" aria-label={label}>
          {content}
        </span>
      )}
    </span>
  )
}
