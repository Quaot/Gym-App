import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRoute, switchTab, back } from '../lib/router'
import { useAppSelector } from '../store/store'
import { EDGE, parallaxOffset, swipeCommits } from '../lib/gestures'
import { IconChart, IconClock, IconCog, IconDumbbell, IconHome } from '../components/icons'
import { RestBar } from './RestBar'
import { Home } from '../screens/Home'
import { SessionScreen } from '../screens/Session'
import { HistoryList, SessionDetail } from '../screens/History'
import { ProgramScreen, DayEditor } from '../screens/Program'
import { ProgressScreen, ExerciseDetail } from '../screens/Progress'
import { SettingsScreen } from '../screens/Settings'

const TABS = [
  { path: '/', label: 'Today', Icon: IconHome },
  { path: '/program', label: 'Program', Icon: IconDumbbell },
  { path: '/progress', label: 'Progress', Icon: IconChart },
  { path: '/history', label: 'History', Icon: IconClock },
  { path: '/settings', label: 'Settings', Icon: IconCog },
] as const

const TabBar = ({ active }: { active: string }) => (
  <nav className="tabbar">
    {TABS.map(({ path, label, Icon }) => (
      <button
        key={path}
        className={active === path ? 'active' : ''}
        onClick={() => switchTab(path)}
        aria-current={active === path ? 'page' : undefined}
      >
        <Icon />
        {label}
      </button>
    ))}
  </nav>
)

/** Tab roots sit at the root. Everything you drill into sits one level in. */
const depthOf = (segments: string[]): number =>
  segments[0] === 'session' ? 1 : segments.length > 1 ? 1 : 0

/**
 * A workout rises from the bottom the way a sheet does, since you enter it
 * from anywhere and leave it by finishing rather than by going back. The tabs
 * stay put: checking history mid workout is normal, and the rest bar carries
 * you back.
 */
const isModal = (segments: string[]): boolean => segments[0] === 'session'

/** Where back goes, and what shows underneath during an edge swipe. */
const parentOf = (segments: string[]): string[] =>
  segments[0] === 'session' ? [] : segments.slice(0, -1)

const pathOf = (segments: string[]) => `/${segments.join('/')}`

const screenFor = (segments: string[], hasActive: boolean): ReactNode => {
  const [head, param] = segments
  switch (head) {
    case undefined:
      return <Home />
    case 'session':
      return hasActive ? <SessionScreen /> : <Home />
    case 'history':
      return param ? <SessionDetail sessionId={param} /> : <HistoryList />
    case 'program':
      return param ? <DayEditor dayId={param} /> : <ProgramScreen />
    case 'progress':
      return param ? <ExerciseDetail exerciseId={param} /> : <ProgressScreen />
    case 'settings':
      return <SettingsScreen />
    default:
      return <Home />
  }
}

let serial = 0

export const App = () => {
  const segments = useRoute()
  const hasActive = useAppSelector((s) => s.activeSessionId !== null)
  const path = pathOf(segments)
  const depth = depthOf(segments)
  const modal = isModal(segments)

  const stage = useRef<HTMLDivElement | null>(null)
  const [anim, setAnim] = useState<{ from: string[]; dir: 'push' | 'pop'; key: number } | null>(null)
  const [swiping, setSwiping] = useState(false)
  const skipNext = useRef(false)
  const drag = useRef({ active: false, startX: 0, lastX: 0, lastT: 0, width: 1, speed: 0 })

  // Decide the transition while rendering, so the incoming screen never paints
  // one frame at its resting place before it starts to move.
  const last = useRef({ path, depth, segments })
  if (last.current.path !== path) {
    const prev = last.current
    last.current = { path, depth, segments }
    if (skipNext.current) {
      skipNext.current = false
      setAnim(null)
    } else {
      const dir = depth > prev.depth ? 'push' : depth < prev.depth ? 'pop' : null
      setAnim(dir ? { from: prev.segments, dir, key: ++serial } : null)
    }
  }

  const parts = () => {
    const el = stage.current
    return {
      top: el?.querySelector<HTMLElement>('.screen.top') ?? null,
      under: el?.querySelector<HTMLElement>('.screen.under') ?? null,
    }
  }

  const place = (dx: number) => {
    const { top, under } = parts()
    const w = drag.current.width
    if (top) top.style.transform = `translate3d(${dx}px,0,0)`
    if (under) {
      under.style.transform = `translate3d(${parallaxOffset(dx, w)}px,0,0)`
      under.style.filter = `brightness(${0.72 + 0.28 * (dx / w)})`
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (depth === 0 || modal || anim || drag.current.active) return
    if (e.clientX > EDGE) return
    drag.current = {
      active: true,
      startX: e.clientX,
      lastX: e.clientX,
      lastT: e.timeStamp,
      width: stage.current?.clientWidth || window.innerWidth,
      speed: 0,
    }
    setSwiping(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d.active) return
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.speed = (e.clientX - d.lastX) / dt
    d.lastX = e.clientX
    d.lastT = e.timeStamp
    place(Math.max(0, Math.min(d.width, e.clientX - d.startX)))
  }

  const endDrag = (cancelled: boolean) => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    const dx = Math.max(0, Math.min(d.width, d.lastX - d.startX))
    const commit = !cancelled && swipeCommits(dx, d.width, d.speed)
    const { top, under } = parts()
    const settle = (el: HTMLElement | null, transform: string, brightness?: string) => {
      if (!el) return
      el.style.transition = 'transform 260ms cubic-bezier(0.32,0.72,0,1), filter 260ms linear'
      el.style.transform = transform
      if (brightness) el.style.filter = brightness
    }
    settle(top, commit ? `translate3d(${d.width}px,0,0)` : 'translate3d(0,0,0)')
    settle(
      under,
      commit ? 'translate3d(0,0,0)' : `translate3d(${parallaxOffset(0, d.width)}px,0,0)`,
      commit ? 'brightness(1)' : 'brightness(0.72)',
    )
    window.setTimeout(() => {
      for (const el of [top, under]) {
        if (!el) continue
        el.style.transition = ''
        el.style.transform = ''
        el.style.filter = ''
      }
      if (commit) {
        // The gesture already played the animation, so the route change itself
        // must not play it again.
        skipNext.current = true
        back()
      }
      setSwiping(false)
    }, 270)
  }

  const under = swiping ? parentOf(segments) : anim ? (anim.dir === 'push' ? anim.from : segments) : null
  const top = anim && !swiping && anim.dir === 'pop' ? anim.from : segments
  const underPath = under ? pathOf(under) : null
  const underSegments = under ?? []

  // A modal rises and falls; a push slides sideways.
  const style = anim
    ? (isModal(anim.dir === 'push' ? segments : anim.from) ? 'modal' : 'push')
    : 'push'
  const topClass = swiping
    ? 'screen top'
    : anim
      ? `screen top anim-${style}-${anim.dir}-${anim.dir === 'push' ? 'in' : 'out'}`
      : 'screen top'
  const underClass = swiping
    ? 'screen under swiping'
    : anim
      ? `screen under anim-${style}-${anim.dir}-${anim.dir === 'push' ? 'out' : 'in'}`
      : 'screen under'

  return (
    <div className={`app${modal ? ' modal' : ''}`}>
      <div
        className="stage"
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endDrag(false)}
        onPointerCancel={() => endDrag(true)}
      >
        {underPath !== null && (
          <div className={underClass} key={underPath}>
            {screenFor(underSegments, hasActive)}
          </div>
        )}
        <div
          className={topClass}
          key={anim && anim.dir === 'pop' && !swiping ? pathOf(anim.from) : path}
          onAnimationEnd={(e) => {
            // Sheets and popovers animate too; only the screen's own run counts.
            if (e.target === e.currentTarget) setAnim(null)
          }}
        >
          {screenFor(top, hasActive)}
        </div>
      </div>
      <RestBar />
      <TabBar active={`/${segments[0] ?? ''}`} />
    </div>
  )
}
