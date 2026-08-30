import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { titleProgress } from '../lib/gestures'

/**
 * One screen of the app: a fixed bar over its own scroller.
 *
 * Scrolling lives here rather than on the page, which is what lets screens
 * slide over each other, keeps every tab where you left it, and collapses the
 * large title into the bar the way a native app does.
 */

/** Scroll offsets survive tab switches and drill ins for the session. */
const scrollMemory = new Map<string, number>()

export const rememberScroll = (id: string, top: number) => scrollMemory.set(id, top)

/** Room the fixed bars take at the bottom of a screen. */
const BAR_CLEARANCE = 118

/**
 * Brings an element fully into view above the tab bar and the rest bar, which
 * float over the scroller and would otherwise cover whatever sits under them.
 */
export const revealAboveBars = (el: HTMLElement | null) => {
  if (!el) return
  const scroller = el.closest('.scroller')
  if (!(scroller instanceof HTMLElement)) return
  const box = el.getBoundingClientRect()
  const view = scroller.getBoundingClientRect()
  const below = box.bottom - (view.bottom - BAR_CLEARANCE)
  const above = view.top - box.top
  if (below > 0) scroller.scrollBy({ top: below, behavior: 'smooth' })
  else if (above > 0) scroller.scrollBy({ top: -above, behavior: 'smooth' })
}
export const forgetScroll = (id: string) => scrollMemory.delete(id)

interface Props {
  /** Key for scroll memory. One per route. */
  id: string
  title: string
  subtitle?: ReactNode
  /** Large collapsing title, the way tab roots look. Details use the bar. */
  large?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  /** Centres the compact title even when only one side has buttons. */
  centerTitle?: boolean
  /** One line under the large title saying what this screen is for. */
  blurb?: string
  children: ReactNode
}

export const Screen = ({
  id, title, subtitle, large = false, leading, trailing, centerTitle = false, blurb, children,
}: Props) => {
  const scroller = useRef<HTMLDivElement | null>(null)
  const bar = useRef<HTMLElement | null>(null)
  const barTitle = useRef<HTMLDivElement | null>(null)
  const frame = useRef(0)

  // Paint the bar from the scroll offset through refs, never through state,
  // so a fast flick never waits on a render.
  const paint = (top: number) => {
    const b = bar.current
    const t = barTitle.current
    if (!b) return
    b.classList.toggle('scrolled', top > 1)
    if (t) {
      const p = titleProgress(top, large)
      t.style.opacity = String(p)
      t.style.transform = `translateY(${(1 - p) * 8}px)`
    }
  }

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const saved = scrollMemory.get(id) ?? 0
    if (saved > 0) el.scrollTop = saved
    paint(el.scrollTop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // The keyboard covers the bottom of the screen without changing the layout,
  // so a field near the fold has to lift itself above it.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || !/^(INPUT|TEXTAREA)$/.test(target.tagName)) return
      window.setTimeout(() => {
        const visible = window.visualViewport?.height ?? window.innerHeight
        const rect = target.getBoundingClientRect()
        const overlap = rect.bottom + 16 - visible
        if (overlap > 0) el.scrollBy({ top: overlap, behavior: 'smooth' })
      }, 320)
    }
    el.addEventListener('focusin', onFocus)
    return () => el.removeEventListener('focusin', onFocus)
  }, [])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const top = el.scrollTop
    scrollMemory.set(id, top)
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      paint(top)
    })
  }

  return (
    <div className="screen-inner" data-screen={id}>
      <header className={`navbar${large ? ' has-large' : ''}`} ref={bar}>
        <div className="nav-side">{leading}</div>
        <div
          className={`nav-title${centerTitle ? ' center' : ''}`}
          ref={barTitle}
          style={large ? { opacity: 0 } : undefined}
        >
          <span className="nav-name">{title}</span>
          {subtitle ? <span className="sub">{subtitle}</span> : null}
        </div>
        <div className="nav-side end">{trailing}</div>
      </header>

      <div className="scroller" ref={scroller} onScroll={onScroll}>
        {large ? (
          <div className="large-title">
            <h1>{title}</h1>
            {subtitle ? <div className="sub">{subtitle}</div> : null}
            {blurb ? <p className="blurb">{blurb}</p> : null}
          </div>
        ) : null}
        <main className="main">{children}</main>
      </div>
    </div>
  )
}
