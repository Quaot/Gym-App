import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { navigate } from '../lib/router'
import { Sheet } from '../components/Sheet'
import { IconBack } from '../components/icons'
import { fmtDate, fmtDuration, fmtSet, fmtWeight } from '../lib/util'
import {
  bestSet, est1RM, exerciseHistory, knownExerciseNames, sessionSetCount,
  sessionVolume, workingSets,
} from '../lib/history'

export const HistoryList = () => {
  const { state } = useStore()
  const [exercise, setExercise] = useState<string | null>(null)
  const finished = state.sessions.filter((s) => s.finishedAt !== null)
  const names = useMemo(
    () => knownExerciseNames(state.sessions, state.program.days.flatMap((d) => d.exercises.map((e) => e.name))),
    [state.sessions, state.program.days],
  )

  return (
    <>
      <header className="topbar">
        <h1>
          History
          <span className="sub">{finished.length} workouts logged</span>
        </h1>
      </header>

      <main className="main">
        {names.length > 0 && (
          <>
            <div className="section-title">Look up an exercise</div>
            <select
              aria-label="Exercise progress"
              value=""
              onChange={(e) => e.target.value && setExercise(e.target.value)}
            >
              <option value="">Choose an exercise…</option>
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </>
        )}

        <div className="section-title">Workouts</div>
        {finished.length === 0 && <div className="empty">No finished workouts yet.</div>}
        {finished.map((s) => (
          <button key={s.id} className="list-item" onClick={() => navigate(`/history/${s.id}`)}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{s.dayName}</div>
              <div className="small muted">
                {fmtDate(s.finishedAt ?? s.startedAt)} · {sessionSetCount(s)} sets ·{' '}
                {fmtDuration((s.finishedAt ?? s.startedAt) - s.startedAt)} ·{' '}
                {Math.round(sessionVolume(s)).toLocaleString()} {state.settings.unit} volume
              </div>
            </div>
            <span className="chev">›</span>
          </button>
        ))}
      </main>

      {exercise && <ExerciseProgress name={exercise} onClose={() => setExercise(null)} />}
    </>
  )
}

const ExerciseProgress = ({ name, onClose }: { name: string; onClose: () => void }) => {
  const { state } = useStore()
  const { unit } = state.settings
  const history = exerciseHistory(state.sessions, name)
  const best = history.reduce<{ w: number; label: string } | null>((acc, h) => {
    const b = bestSet(h.exercise)
    if (!b) return acc
    const w = est1RM(b)
    return acc && acc.w >= w ? acc : { w, label: fmtSet(b.weight, b.reps, unit) }
  }, null)

  return (
    <Sheet title={name} onClose={onClose}>
      {best && (
        <div className="card tight">
          <div className="tiny muted">Best set</div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{best.label}</div>
          <div className="tiny muted">≈ {fmtWeight(Math.round(best.w * 10) / 10)} {unit} estimated 1RM</div>
        </div>
      )}
      {history.length === 0 && <p className="muted small">Nothing logged for this exercise yet.</p>}
      {history.map((h) => (
        <div key={h.exercise.id} className="card tight">
          <div className="row">
            <span className="small" style={{ fontWeight: 600 }}>{fmtDate(h.session.finishedAt ?? h.session.startedAt)}</span>
            <span className="spacer" />
            <span className="tiny muted">{h.session.dayName}</span>
          </div>
          <div className="small mono" style={{ marginTop: 4 }}>
            {workingSets(h.exercise).map((s) => `${fmtWeight(s.weight)}${unit}×${s.reps}`).join('  ·  ')}
          </div>
        </div>
      ))}
    </Sheet>
  )
}

export const SessionDetail = ({ sessionId }: { sessionId: string }) => {
  const { state, dispatch } = useStore()
  const [confirm, setConfirm] = useState(false)
  const session = state.sessions.find((s) => s.id === sessionId)
  const { unit } = state.settings

  if (!session) {
    return (
      <main className="main">
        <div className="empty">That workout is no longer here.</div>
      </main>
    )
  }

  return (
    <>
      <header className="topbar">
        <button className="btn sm ghost" aria-label="Back" onClick={() => navigate('/history')}><IconBack /></button>
        <h1>
          {session.dayName}
          <span className="sub">{fmtDate(session.finishedAt ?? session.startedAt)}</span>
        </h1>
      </header>

      <main className="main">
        <div className="card tight row wrap" style={{ gap: 14 }}>
          <div>
            <div className="tiny muted">Sets</div>
            <div style={{ fontWeight: 700 }}>{sessionSetCount(session)}</div>
          </div>
          <div>
            <div className="tiny muted">Volume</div>
            <div style={{ fontWeight: 700 }}>{Math.round(sessionVolume(session)).toLocaleString()} {unit}</div>
          </div>
          <div>
            <div className="tiny muted">Duration</div>
            <div style={{ fontWeight: 700 }}>{fmtDuration((session.finishedAt ?? session.startedAt) - session.startedAt)}</div>
          </div>
        </div>

        {session.exercises.map((e) => (
          <div key={e.id} className="card">
            <div className="ex-head"><span className="ex-name">{e.name}</span></div>
            {workingSets(e).map((s, i) => (
              <div key={s.id} className="row small mono" style={{ padding: '3px 0' }}>
                <span className="muted" style={{ width: 22 }}>{i + 1}</span>
                <span>{fmtSet(s.weight, s.reps, unit)}</span>
              </div>
            ))}
          </div>
        ))}

        {session.notes && (
          <div className="card">
            <div className="tiny muted">Notes</div>
            <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{session.notes}</div>
          </div>
        )}

        <button className="btn block danger" onClick={() => setConfirm(true)}>Delete this workout</button>
      </main>

      {confirm && (
        <Sheet title="Delete workout?" onClose={() => setConfirm(false)}>
          <div className="stack">
            <p className="small muted">This can't be undone.</p>
            <button className="btn danger block"
              onClick={() => { dispatch({ type: 'deleteSession', sessionId }); navigate('/history') }}>Delete</button>
            <button className="btn ghost block" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
