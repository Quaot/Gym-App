import { navigate } from '../lib/router'
import { useStore } from '../store'
import { fmtDate, fmtDuration } from '../lib/util'
import { sessionSetCount } from '../lib/history'
import type { DayTemplate, Session } from '../types'

const lastSessionFor = (sessions: Session[], dayId: string) =>
  sessions.find((s) => s.dayId === dayId && s.finishedAt !== null) ?? null

/** Next day in the rotation after whatever was trained last. */
const suggestedDay = (days: DayTemplate[], sessions: Session[]): DayTemplate | null => {
  if (days.length === 0) return null
  const last = sessions.find((s) => s.finishedAt !== null)
  if (!last) return days[0]
  const i = days.findIndex((d) => d.id === last.dayId)
  return i < 0 ? days[0] : days[(i + 1) % days.length]
}

export const Home = () => {
  const { state, dispatch, activeSession } = useStore()
  const { days } = state.program
  const finished = state.sessions.filter((s) => s.finishedAt !== null)
  const suggestion = suggestedDay(days, finished)

  const start = (dayId: string) => {
    dispatch({ type: 'startSession', dayId })
    navigate('/session')
  }

  return (
    <>
      <header className="topbar">
        <h1>
          {state.program.name}
          <span className="sub">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </h1>
      </header>

      <main className="main">
        {activeSession && (
          <button className="card day-card" style={{ borderColor: 'var(--accent)' }} onClick={() => navigate('/session')}>
            <div style={{ flex: 1 }}>
              <div className="name">{activeSession.dayName} in progress</div>
              <div className="small muted">
                Started {fmtDate(activeSession.startedAt)} · {sessionSetCount(activeSession)} sets logged
              </div>
            </div>
            <span className="pill accent">Resume</span>
          </button>
        )}

        <div className="section-title">Start a workout</div>

        {days.length === 0 && (
          <div className="empty">
            No days yet.
            <div style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => navigate('/program')}>Build your program</button>
            </div>
          </div>
        )}

        {days.map((day) => {
          const last = lastSessionFor(finished, day.id)
          const isNext = !activeSession && suggestion?.id === day.id
          const empty = day.exercises.length === 0
          return (
            <div key={day.id} className="card day-card" style={isNext ? { borderColor: 'var(--accent)' } : undefined}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="name">{day.name}</span>
                  {isNext && <span className="pill accent">Up next</span>}
                </div>
                <div className="small muted">
                  {empty ? 'No exercises yet' : `${day.exercises.length} exercises`}
                  {last && ` · last ${fmtDate(last.finishedAt ?? last.startedAt)}`}
                </div>
              </div>
              {empty ? (
                <button className="btn sm ghost" onClick={() => navigate(`/program/${day.id}`)}>Set up</button>
              ) : (
                <button className={`btn sm${isNext ? ' primary' : ''}`} onClick={() => start(day.id)}>Start</button>
              )}
            </div>
          )
        })}

        {finished.length > 0 && (
          <>
            <div className="section-title">Recent</div>
            {finished.slice(0, 3).map((s) => (
              <button key={s.id} className="list-item" onClick={() => navigate(`/history/${s.id}`)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{s.dayName}</div>
                  <div className="small muted">
                    {fmtDate(s.finishedAt ?? s.startedAt)} · {sessionSetCount(s)} sets ·{' '}
                    {fmtDuration((s.finishedAt ?? s.startedAt) - s.startedAt)}
                  </div>
                </div>
                <span className="chev">›</span>
              </button>
            ))}
          </>
        )}
      </main>
    </>
  )
}
