import { useState } from 'react'
import { useAppSelector, dispatch } from '../store/store'
import { navigate, replaceRoute } from '../lib/router'
import { Sheet } from '../components/Sheet'
import { Screen } from '../app/Screen'
import { BackButton } from '../app/BackButton'
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
    <Screen
      id="history"
      title="History"
      subtitle={`${finished.length} workouts logged`}
      large
      help={[
        'Every workout you have saved, newest first',
        'Open one to see each set exactly as you logged it, warm-ups included',
        'Nothing here can be changed, since it is a record of what happened',
      ]}
    >
        {finished.length === 0 && (
          <div className="empty">Nothing logged yet</div>
        )}
        <div className="group">
        {finished.map((s) => (
          <button key={s.id} className="row-item" onClick={() => navigate(`/history/${s.id}`)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>{s.dayName}</div>
              <div className="t-footnote label-2 num">
                {fmtDate(s.finishedAt ?? s.startedAt)} · {sessionSetCount(s)} sets ·{' '}
                {fmtDuration((s.finishedAt ?? s.startedAt) - s.startedAt)} ·{' '}
                {Math.round(sessionVolume(s)).toLocaleString()} {unit}
              </div>
            </div>
            <span className="chevron">›</span>
          </button>
        ))}
        </div>
    </Screen>
  )
}

export const SessionDetail = ({ sessionId }: { sessionId: string }) => {
  const session = useAppSelector((s) => s.sessions.find((x) => x.id === sessionId) ?? null)
  const unit = useAppSelector((s) => s.settings.unit)
  const [confirm, setConfirm] = useState(false)

  if (!session) {
    return (
      <Screen id="history/missing" title="Workout" leading={<BackButton />}>
        <div className="empty">This workout is gone</div>
      </Screen>
    )
  }

  const split = sessionTimeSplit(session)

  return (
    <Screen
      id={`history/${sessionId}`}
      title={session.dayName}
      subtitle={fmtDate(session.finishedAt ?? session.startedAt)}
      leading={<BackButton />}
    >
        <div className="stat-row" style={{ marginBottom: 12 }}>
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
              {split.avgRestMs !== null ? fmtClock(split.avgRestMs / 1000) : ''}
            </div>
          </div>
        </div>

        {session.exercises.map((e) => {
          const warm = warmupSets(e)
          const work = workingSets(e)
          return (
            <div key={e.id} className="group">
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
                    <span className="label-2" style={{ width: 24 }}>{i + 1}</span>
                    <span>{fmtSet(s.weight, s.reps, unit)}</span>
                    <span className="spacer" />
                    {rested !== null && (
                      <span className="t-caption label-3">rested {fmtClock(rested / 1000)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {session.notes && (
          <div className="group">
            <div className="t-caption label-3" style={{ fontWeight: 700 }}>NOTES</div>
            <div className="t-subhead" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{session.notes}</div>
          </div>
        )}

        <button className="btn-tinted destructive block" onClick={() => setConfirm(true)}>Delete this workout</button>
      {confirm && (
        <Sheet title="Delete workout?" onClose={() => setConfirm(false)}>
          <div className="stack">
            <p className="t-footnote label-2">This cannot be undone</p>
            <button className="btn-tinted destructive block"
              onClick={() => { dispatch({ type: 'deleteSession', sessionId }); replaceRoute('/history') }}>
              Delete
            </button>
            <button className="btn-gray block" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </Screen>
  )
}
