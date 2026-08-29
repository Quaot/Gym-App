import { useState } from 'react'
import { useAppSelector, dispatch } from '../store/store'
import { navigate, back } from '../lib/router'
import { Sheet } from '../components/Sheet'
import { IconBack } from '../components/icons'
import { fmtClock, fmtDate, fmtDuration, fmtSet } from '../lib/util'
import {
  finishedSessions, sessionSetCount, sessionVolume, workingSets, warmupSets,
} from '../lib/history'
import { restBefore, sessionTimeSplit } from '../lib/timing'

export const HistoryList = () => {
  const sessions = useAppSelector((s) => s.sessions)
  const unit = useAppSelector((s) => s.settings.unit)
  const finished = finishedSessions(sessions)

  return (
    <>
      <header className="topbar">
        <h1>
          History
          <span className="sub">{finished.length} workouts logged</span>
        </h1>
      </header>

      <main className="main">
        {finished.length === 0 && (
          <div className="empty">No finished workouts yet — go lift something.</div>
        )}
        {finished.map((s) => (
          <button key={s.id} className="list-item" onClick={() => navigate(`/history/${s.id}`)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>{s.dayName}</div>
              <div className="small muted num">
                {fmtDate(s.finishedAt ?? s.startedAt)} · {sessionSetCount(s)} sets ·{' '}
                {fmtDuration((s.finishedAt ?? s.startedAt) - s.startedAt)} ·{' '}
                {Math.round(sessionVolume(s)).toLocaleString()} {unit}
              </div>
            </div>
            <span className="chev">›</span>
          </button>
        ))}
      </main>
    </>
  )
}

export const SessionDetail = ({ sessionId }: { sessionId: string }) => {
  const session = useAppSelector((s) => s.sessions.find((x) => x.id === sessionId) ?? null)
  const unit = useAppSelector((s) => s.settings.unit)
  const [confirm, setConfirm] = useState(false)

  if (!session) {
    return (
      <main className="main">
        <div className="empty">That workout is no longer here.</div>
      </main>
    )
  }

  const split = sessionTimeSplit(session)

  return (
    <>
      <header className="topbar">
        <button className="btn sm ghost" aria-label="Back" onClick={back}><IconBack /></button>
        <h1>
          {session.dayName}
          <span className="sub">{fmtDate(session.finishedAt ?? session.startedAt)}</span>
        </h1>
      </header>

      <main className="main">
        <div className="stat-grid" style={{ marginBottom: 12 }}>
          <div className="stat">
            <div className="label">Duration</div>
            <div className="value num">{fmtDuration(split.totalMs)}</div>
          </div>
          <div className="stat">
            <div className="label">Volume</div>
            <div className="value num">
              {Math.round(sessionVolume(session)).toLocaleString()}
              <span className="unit">{unit}</span>
            </div>
          </div>
          <div className="stat">
            <div className="label">Sets</div>
            <div className="value num">{sessionSetCount(session)}</div>
          </div>
          <div className="stat">
            <div className="label">Lifting</div>
            <div className="value num">{fmtDuration(split.workMs)}</div>
          </div>
          <div className="stat">
            <div className="label">Resting</div>
            <div className="value num">{fmtDuration(split.restMs)}</div>
          </div>
          <div className="stat">
            <div className="label">Avg rest</div>
            <div className="value num">
              {split.avgRestMs !== null ? fmtClock(split.avgRestMs / 1000) : '—'}
            </div>
          </div>
        </div>

        {session.exercises.map((e) => {
          const warm = warmupSets(e)
          const work = workingSets(e)
          return (
            <div key={e.id} className="card tight">
              <div className="ex-head"><span className="ex-name" style={{ fontSize: 16 }}>{e.name}</span></div>
              {warm.map((s) => (
                <div key={s.id} className="row small num" style={{ padding: '3px 0', color: 'var(--warm)' }}>
                  <span style={{ width: 24 }}>W</span>
                  <span>{fmtSet(s.weight, s.reps, unit)}</span>
                </div>
              ))}
              {work.map((s, i) => {
                const rested = restBefore(session, s.id)
                return (
                  <div key={s.id} className="row small num" style={{ padding: '3px 0' }}>
                    <span className="muted" style={{ width: 24 }}>{i + 1}</span>
                    <span>{fmtSet(s.weight, s.reps, unit)}</span>
                    <span className="spacer" />
                    {rested !== null && (
                      <span className="tiny faint">rested {fmtClock(rested / 1000)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {session.notes && (
          <div className="card tight">
            <div className="tiny faint" style={{ fontWeight: 700 }}>NOTES</div>
            <div className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{session.notes}</div>
          </div>
        )}

        <button className="btn block danger" onClick={() => setConfirm(true)}>Delete this workout</button>
      </main>

      {confirm && (
        <Sheet title="Delete workout?" onClose={() => setConfirm(false)}>
          <div className="stack">
            <p className="small muted">This can't be undone.</p>
            <button className="btn danger block"
              onClick={() => { dispatch({ type: 'deleteSession', sessionId }); navigate('/history') }}>
              Delete
            </button>
            <button className="btn ghost block" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
