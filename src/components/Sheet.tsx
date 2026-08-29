import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useSheetHistory } from '../lib/router'
import { sheetCommits } from '../lib/gestures'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Bottom sheet, rendered into the body so it clears the tab bar and the
 * screen transitions. You can drag it down to dismiss, back closes it, Escape
 * closes it, and the keyboard lifts it instead of burying it.
 */
export const Sheet = ({ title, onClose, children }: Props) => {
  const close = useSheetHistory(onClose)
  const closeRef = useRef(close)
  closeRef.current = close

  const sheet = useRef<HTMLDivElement | null>(null)
  const backdrop = useRef<HTMLDivElement | null>(null)
  const drag = useRef({
    active: false, pointerId: -1, startY: 0, lastY: 0, lastT: 0, height: 1, speed: 0,
  })
  const [lift, setLift] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The software keyboard shrinks the visual viewport rather than the layout
  // viewport, so the sheet has to move itself out of the way.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop
      setLift(hidden > 60 ? hidden : 0)
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    const el = sheet.current
    if (!el) return
    // Only from the grab area, only with the content at the top, and only one
    // finger, so a drag never fights with scrolling or with a second touch.
    if (el.scrollTop > 0 || drag.current.active) return
    const d = drag.current
    d.active = true
    d.pointerId = e.pointerId
    d.startY = e.clientY
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    d.height = el.offsetHeight || 1
    d.speed = 0
    el.style.transition = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = sheet.current
    if (!d.active || !el) return
    if (e.pointerId !== d.pointerId) return
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.speed = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    const dy = Math.max(0, e.clientY - d.startY)
    // Drag and keyboard lift compose through custom properties, so ending a
    // drag can never wipe the lift that keeps the sheet above the keyboard.
    el.style.setProperty('--drag', `${dy}px`)
    if (backdrop.current) {
      backdrop.current.style.opacity = String(Math.max(0.2, 1 - dy / d.height))
    }
  }

  const endDrag = (e?: React.PointerEvent) => {
    const d = drag.current
    const el = sheet.current
    if (!d.active || !el) return
    if (e && e.pointerId !== d.pointerId) return
    d.active = false
    const dy = Math.max(0, d.lastY - d.startY)
    const go = sheetCommits(dy, d.height, d.speed)
    el.style.transition = 'transform 280ms cubic-bezier(0.32,0.72,0,1)'
    el.style.setProperty('--drag', go ? `${d.height}px` : '0px')
    if (backdrop.current) {
      backdrop.current.style.transition = 'opacity 280ms linear'
      backdrop.current.style.opacity = go ? '0' : '1'
    }
    if (go) window.setTimeout(() => closeRef.current(), 220)
  }

  return createPortal(
    <div
      className="sheet-backdrop"
      ref={backdrop}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet-wrap" onClick={(e) => e.stopPropagation()}>
      <div
        className="sheet"
        ref={sheet}
        style={{ '--lift': `${lift}px` } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-drag"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e)}
          onPointerCancel={(e) => endDrag(e)}
        >
          <div className="grab" aria-hidden />
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="btn-plain" aria-label="Close" onClick={close}>
              ✕
            </button>
          </div>
        </div>
        {children}
      </div>
      </div>
    </div>,
    document.body,
  )
}
