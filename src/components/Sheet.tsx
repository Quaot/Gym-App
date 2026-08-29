import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useSheetHistory } from '../lib/router'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Bottom sheet. Hardware/gesture back closes it (via a pushed history entry),
 * Escape closes it, and the page behind is scroll-locked with the
 * position:fixed technique — the only one iOS Safari honours.
 */
export const Sheet = ({ title, onClose, children }: Props) => {
  const close = useSheetHistory(onClose)
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)

    const scrollY = window.scrollY
    const { style } = document.body
    const prev = {
      position: style.position,
      top: style.top,
      width: style.width,
      overflow: style.overflow,
    }
    style.position = 'fixed'
    style.top = `-${scrollY}px`
    style.width = '100%'
    style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      style.position = prev.position
      style.top = prev.top
      style.width = prev.width
      style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [])

  return (
    <div
      className="sheet-backdrop"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" aria-hidden />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn sm ghost" aria-label="Close" onClick={close}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
