import { useEffect, useRef } from 'react'
import { useAppSelector, dispatch } from '../store/store'
import { useNow } from '../lib/useNow'
import { fmtClock } from '../lib/util'
import { chime } from '../lib/audio'
import { notifyRestOver } from '../lib/notify'
import { useWakeLock } from '../lib/wakeLock'
import { navigate, useRoute } from '../lib/router'
import { haptic } from '../lib/haptics'

/**
 * The global rest timer bar. Lives in the App shell, so it survives every
 * navigation; its deadline lives in the store (persisted synchronously), so
 * it survives reloads. During an active session with no rest running it shows
 * a quiet "back to workout" strip on other screens.
 */
export const RestBar = () => {
  const rest = useAppSelector((s) => s.rest)
  const activeSession = useAppSelector((s) =>
    s.sessions.find((x) => x.id === s.activeSessionId) ?? null,
  )
  const route = useRoute()
  // A clock that jumps five seconds at a time reads as broken, so it ticks
  // every second whenever one is on screen.
  const now = useNow(rest ? 250 : 1000)

  // A workout should never be interrupted by the screen going dark.
  useWakeLock(activeSession !== null)

  // Fire the chime exactly once per deadline, keyed by endsAt: +30s after
  // overtime moves the key and legitimately re-arms it (bug 12), while
  // re-renders and remounts do not re-fire it.
  const firedFor = useRef<number | null>(null)
  useEffect(() => {
    if (!rest) {
      firedFor.current = null
      return
    }
    if (now >= rest.endsAt && firedFor.current !== rest.endsAt) {
      firedFor.current = rest.endsAt
      chime()
      notifyRestOver(rest.exerciseName)
      haptic('alert')
    }
  }, [rest, now])

  const onSession = route[0] === 'session'

  if (rest) {
    const remaining = (rest.endsAt - now) / 1000
    const over = remaining <= 0
    const pct = over ? 0 : Math.min(1, remaining / rest.totalSec)
    return (
      <div className={`restbar glass${over ? ' over' : ''}`}>
        <div className="progress" style={{ width: `${pct * 100}%` }} />
        <span className="time num">{over ? `+${fmtClock(-remaining)}` : fmtClock(remaining)}</span>
        <span className="ctx">
          {over ? 'Rest is up' : rest.exerciseName || 'Resting'}
        </span>
        <span className="spacer" />
        <button className="btn-plain" onClick={() => dispatch({ type: 'extendRest', bySec: 30 })}>
          +30s
        </button>
        <button className="btn-plain" onClick={() => dispatch({ type: 'stopRest' })}>
          {over ? 'Done' : 'Skip'}
        </button>
      </div>
    )
  }

  // No rest running: on other screens, keep the live workout one tap away.
  if (activeSession && !onSession) {
    return (
      <div className="restbar glass">
        <span className="time num" style={{ fontSize: 18 }}>
          {fmtClock((now - activeSession.startedAt) / 1000)}
        </span>
        <span className="ctx">{activeSession.dayName} in progress</span>
        <span className="spacer" />
        <button className="btn-plain strong" onClick={() => navigate('/session')}>
          Back to workout
        </button>
      </div>
    )
  }

  return null
}
