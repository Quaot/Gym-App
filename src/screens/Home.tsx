import { useState } from 'react'
import { navigate } from '../lib/router'
import { useAppSelector, dispatch } from '../store/store'
import { act } from '../store/actions'
import { fmtDate, fmtDuration } from '../lib/util'
import { finishedSessions, sessionSetCount, sessionVolume } from '../lib/history'
import type { DayTemplate, Session } from '../types'
import { Sheet } from '../components/Sheet'
import { Screen } from '../app/Screen'
import { IconChevron, IconDumbbell, IconFlame } from '../components/icons'

/** Next day in the rotation after whatever was trained last. */
const suggestedDay = (days: DayTemplate[], finished: Session[]): DayTemplate | null => {
  if (days.length === 0) return null
  const last = finished[0]
  if (!last) return days[0]
  const i = days.findIndex((d) => d.id === last.dayId)
  return i < 0 ? days[0] : days[(i + 1) % days.length]
}

/** Consecutive days back from today with a finished workout. */
const streak = (finished: Session[]): number => {
  const days = new Set(
    finished.map((s) => new Date(s.finishedAt ?? s.startedAt).toDateString()),
  )
  let count = 0
  const cursor = new Date()
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1)
  while (days.has(cursor.toDateString())) {
    count++
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
}

const greeting = (): string => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export const Home = () => {
  const program = useAppSelector(
    (s) => s.programs.find((p) => p.id === s.activeProgramId) ?? s.programs[0],
  )
  const sessions = useAppSelector((s) => s.sessions)
  const activeSessionId = useAppSelector((s) => s.activeSessionId)
  const unit = useAppSelector((s) => s.settings.unit)
  const [orphan, setOrphan] = useState<string | null>(null)

  const finished = finishedSessions(sessions)
  const active = sessions.find((s) => s.id === activeSessionId) ?? null
  const orphans = sessions.filter((s) => s.finishedAt === null && s.id !== activeSessionId)
  const next = active ? null : suggestedDay(program.days, finished)
  const last = finished[0] ?? null
  const days = streak(finished)

  const start = (dayId: string) => {
    act.startSession(dayId)
    navigate('/session')
  }

  return (
    <Screen
      id="today"
      title={greeting()}
      subtitle={new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}
      large
    >
        {active && (
          <div className="group">
            <button className="metric" style={{ '--metric': 'var(--purple)' } as React.CSSProperties}
              onClick={() => navigate('/session')}>
              <div className="metric-head">
                <IconDumbbell />
                <span className="name">{active.dayName}</span>
                <span className="when">In progress</span>
              </div>
              <div className="value num">
                {sessionSetCount(active)}
                <span className="unit">sets logged</span>
              </div>
            </button>
          </div>
        )}

        {orphans.map((s) => (
          <div className="group" key={s.id}>
            <button className="metric" style={{ '--metric': 'var(--orange)' } as React.CSSProperties}
              onClick={() => setOrphan(s.id)}>
              <div className="metric-head">
                <IconDumbbell />
                <span className="name">{s.dayName}</span>
                <span className="when">{fmtDate(s.startedAt)}</span>
                <IconChevron />
              </div>
              <div className="value num">
                {sessionSetCount(s)}
                <span className="unit">sets, never finished</span>
              </div>
            </button>
          </div>
        ))}

        {next && (
          <>
            <div className="section-header tight">Up next</div>
            <div className="group">
              <button className="metric" onClick={() => start(next.id)}
                disabled={next.exercises.length === 0}>
                <div className="metric-head">
                  <IconDumbbell />
                  <span className="name">{next.name}</span>
                  <span className="when">
                    {next.exercises.length === 0 ? 'Empty' : `${next.exercises.length} exercises`}
                  </span>
                </div>
                <div className="value num">
                  {next.exercises.reduce((n, e) => n + e.sets, 0)}
                  <span className="unit">sets planned</span>
                </div>
              </button>
              {next.exercises.length === 0 ? (
                <button className="row-item" onClick={() => navigate(`/program/${next.id}`)}>
                  <span className="grow tint">Add exercises</span>
                  <IconChevron />
                </button>
              ) : (
                <div className="row-item" style={{ paddingTop: 4, paddingBottom: 14 }}>
                  <button className="btn-filled block" onClick={() => start(next.id)}>
                    Start
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {(days > 0 || last) && (
          <div className="group">
            {days > 0 && (
              <div className="metric" style={{ '--metric': 'var(--orange)' } as React.CSSProperties}>
                <div className="metric-head">
                  <IconFlame />
                  <span className="name">Streak</span>
                </div>
                <div className="value num">
                  {days}
                  <span className="unit">{days === 1 ? 'day' : 'days'}</span>
                </div>
              </div>
            )}
            {last && (
              <button className="metric" style={{ '--metric': 'var(--teal)' } as React.CSSProperties}
                onClick={() => navigate(`/history/${last.id}`)}>
                <div className="metric-head">
                  <IconDumbbell />
                  <span className="name">{last.dayName}</span>
                  <span className="when">{fmtDate(last.finishedAt ?? last.startedAt)}</span>
                  <IconChevron />
                </div>
                <div className="value num">
                  {Math.round(sessionVolume(last)).toLocaleString()}
                  <span className="unit">{unit} moved in {fmtDuration((last.finishedAt ?? last.startedAt) - last.startedAt)}</span>
                </div>
              </button>
            )}
          </div>
        )}

        <div className="section-header">{program.name}</div>
        <div className="group">
          {program.days.map((day) => {
            const done = finished.find((s) => s.dayId === day.id) ?? null
            return (
              <button key={day.id} className="row-item"
                onClick={() => (active ? navigate('/session') : start(day.id))}
                disabled={day.exercises.length === 0 && !active}>
                <span className="grow">
                  <span className="t-body">{day.name}</span>
                  <span className="t-footnote label-2" style={{ display: 'block' }}>
                    {day.exercises.length === 0
                      ? 'No exercises'
                      : done
                        ? `Last ${fmtDate(done.finishedAt ?? done.startedAt)}`
                        : 'Not trained yet'}
                  </span>
                </span>
                {next?.id === day.id && <span className="pill accent">Next</span>}
                <IconChevron />
              </button>
            )
          })}
        </div>
      {orphan && (
        <Sheet title="Unfinished workout" onClose={() => setOrphan(null)}>
          <div className="stack">
            <p className="t-subhead label-2">
              Resume it, or discard it
            </p>
            <button className="btn-filled block" disabled={active !== null}
              onClick={() => {
                dispatch({ type: 'resumeSession', sessionId: orphan })
                setOrphan(null)
                navigate('/session')
              }}>
              Resume
            </button>
            <button className="btn-tinted destructive block"
              onClick={() => {
                dispatch({ type: 'deleteSession', sessionId: orphan })
                setOrphan(null)
              }}>
              Discard
            </button>
          </div>
        </Sheet>
      )}
    </Screen>
  )
}
