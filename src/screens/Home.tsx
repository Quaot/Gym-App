import { navigate } from '../lib/router'
import { useAppSelector } from '../store/store'
import { act } from '../store/actions'
import { dispatch } from '../store/store'
import { fmtDate, fmtDuration } from '../lib/util'
import { finishedSessions, sessionSetCount } from '../lib/history'
import type { DayTemplate, Session } from '../types'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'

/** Next day in the rotation after whatever was trained last. */
const suggestedDay = (days: DayTemplate[], finished: Session[]): DayTemplate | null => {
  if (days.length === 0) return null
  const last = finished[0]
  if (!last) return days[0]
  const i = days.findIndex((d) => d.id === last.dayId)
  return i < 0 ? days[0] : days[(i + 1) % days.length]
}

export const Home = () => {
  const program = useAppSelector((s) => s.programs.find((p) => p.id === s.activeProgramId) ?? s.programs[0])
  const sessions = useAppSelector((s) => s.sessions)
  const activeSessionId = useAppSelector((s) => s.activeSessionId)
  const [orphanSheet, setOrphanSheet] = useState<string | null>(null)

  const days = program.days
  const finished = finishedSessions(sessions)
  const active = sessions.find((s) => s.id === activeSessionId) ?? null
  // Unfinished but not active: crash leftovers or pre-v2 orphans.
  const orphans = sessions.filter((s) => s.finishedAt === null && s.id !== activeSessionId)
  const suggestion = active ? null : suggestedDay(days, finished)

  const start = (dayId: string) => {
    act.startSession(dayId)
    navigate('/session')
  }

  return (
    <>
      <header className="topbar">
        <h1>
          {program.name}
          <span className="sub">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </h1>
      </header>

      <main className="main">
        {active && (
          <button className="card day-card glow" onClick={() => navigate('/session')}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="name">{active.dayName} in progress</div>
              <div className="small muted">
                Started {fmtDate(active.startedAt)} · {sessionSetCount(active)} sets logged
              </div>
            </div>
            <span className="pill accent">Resume</span>
          </button>
        )}

        {orphans.map((s) => (
          <button key={s.id} className="card day-card" style={{ borderColor: 'var(--warm)' }}
            onClick={() => setOrphanSheet(s.id)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="name">Unfinished: {s.dayName}</div>
              <div className="small muted">
                {fmtDate(s.startedAt)} · {sessionSetCount(s)} sets logged, never finished
              </div>
            </div>
            <span className="pill warm">Recover</span>
          </button>
        ))}

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
          const last = finished.find((s) => s.dayId === day.id) ?? null
          const isNext = suggestion?.id === day.id
          const empty = day.exercises.length === 0
          return (
            <div key={day.id} className={`card day-card${isNext ? ' glow' : ''}`}>
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
              ) : active ? (
                <span className="pill">In session</span>
              ) : (
                <button className={`btn sm${isNext ? ' primary' : ''}`} onClick={() => start(day.id)}>
                  Start
                </button>
              )}
            </div>
          )
        })}

        {finished.length > 0 && (
          <>
            <div className="section-title">Recent</div>
            {finished.slice(0, 3).map((s) => (
              <button key={s.id} className="list-item" onClick={() => navigate(`/history/${s.id}`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 650 }}>{s.dayName}</div>
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

      {orphanSheet && (
        <Sheet title="Unfinished workout" onClose={() => setOrphanSheet(null)}>
          <div className="stack">
            <p className="small muted">
              This workout was never finished — probably interrupted. Resume it to keep logging,
              or discard it.
            </p>
            <button className="btn primary block" disabled={active !== null}
              onClick={() => {
                dispatch({ type: 'resumeSession', sessionId: orphanSheet })
                setOrphanSheet(null)
                navigate('/session')
              }}>
              {active ? 'Finish the current workout first' : 'Resume it'}
            </button>
            <button className="btn danger block"
              onClick={() => { dispatch({ type: 'deleteSession', sessionId: orphanSheet }); setOrphanSheet(null) }}>
              Discard it
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}
