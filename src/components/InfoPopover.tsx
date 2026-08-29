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

/**
 * Detail on demand. The surface stays quiet and the explanation arrives on a
 * long press, or on hover where there is a pointer. Nothing about the layout
 * changes when it opens, so a card never jumps under your thumb.
 */
export const InfoPopover = ({ content, children, label }: Props) => {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moved = useRef(false)

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
    // Any tap elsewhere, or a scroll, dismisses it.
    window.addEventListener('pointerdown', close, { once: true })
    window.addEventListener('scroll', close, { once: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close)
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
        if (e.pointerType !== 'mouse') start(HOLD_MS)
      }}
      onPointerMove={() => {
        moved.current = true
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
