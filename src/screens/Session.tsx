import { useMemo, useState } from 'react'
import type { AppState, Session, SessionExercise } from '../types'
import { useAppSelector, dispatch, getStore } from '../store/store'
import { act } from '../store/actions'
import { switchTab } from '../lib/router'
import { TapeInput } from '../components/TapeInput'
import { Sheet } from '../components/Sheet'
import { IconBack, IconCheck, IconTrash } from '../components/icons'
import { fmtClock, fmtWeight } from '../lib/util'
import { prefillFor } from '../lib/prefill'
import { lastPerformance, workingSets, sessionDoneSetCount } from '../lib/history'
import { restBefore } from '../lib/timing'
import { useNow } from '../lib/useNow'

const selectActive = (s: AppState): Session | null =>
  s.sessions.find((x) => x.id === s.activeSessionId) ?? null

/* ------------------------------------------------------------------ *
 *  One set row: collapsed line, or the expanded tape editor.
 * ------------------------------------------------------------------ */
const SetRow = ({
  session, exercise, index, active, onActivate, onDone,
}: {
  session: Session
  exercise: SessionExercise
  index: number
  active: boolean
  onActivate: () => void
  onDone: () => void
}) => {
  const settings = useAppSelector((s) => s.settings)
  const state = useAppSelector((s) => s)
  const set = exercise.sets[index]
  const fill = useMemo(
    () => prefillFor(state, session, exercise, index),
    [state, session, exercise, index],
  )

  const displayOrdinal = set.warmup
    ? 'W'
    : exercise.sets.slice(0, index).filter((s) => !s.warmup).length + 1
  const restedMs = set.done ? restBefore(session, set.id) : null

  const weight = set.weight ?? fill.weight
  const reps = set.reps ?? fill.reps
  const isGhost = set.weight === null && set.reps === null && !set.done

  if (!active) {
    return (
      <button
        className={`set-line${set.done ? ' done' : ''}${set.warmup ? ' warmup' : ''}`}
        onClick={onActivate}
        aria-label={`${set.warmup ? 'Warm-up set' : `Set ${displayOrdinal}`}${set.done ? ', done' : ''}: ${
          weight !== null ? `${fmtWeight(weight)} ${settings.unit} × ` : ''
        }${reps ?? '—'} reps. Tap to edit.`}
      >
        <span className="ord">{set.done ? <IconCheck /> : displayOrdinal}</span>
        <span className={`vals num${isGhost ? ' ghosted' : ''}`}>
          {weight !== null && (
            <>
              {fmtWeight(weight)}
              <span className="tiny muted"> {settings.unit}</span>
              <span className="x">×</span>
            </>
          )}
          {reps ?? '—'}
          {weight === null && <span className="tiny muted"> reps</span>}
        </span>
        <span className="spacer" />
        {restedMs !== null && (
          <span className="restnote num">rested {fmtClock(restedMs / 1000)}</span>
        )}
      </button>
    )
  }

  const bodyweight = state.catalog[exercise.exerciseId]?.bodyweight ?? false

  return (
    <div className="set-editor">
      <div className="row" style={{ marginBottom: 4 }}>
        <button
          className={`pill${set.warmup ? ' warm' : ''}`}
          onClick={() =>
            dispatch({ type: 'updateSet', exId: exercise.id, setId: set.id, patch: { warmup: !set.warmup } })
          }
        >
          {set.warmup ? 'Warm-up set' : `Set ${displayOrdinal}`}{set.warmup ? '' : ' · tap for warm-up'}
        </button>
        <span className="spacer" />
        {set.done && (
          <button
            className="btn sm ghost"
            onClick={() => dispatch({ type: 'uncompleteSet', exId: exercise.id, setId: set.id })}
          >
            Undo ✓
          </button>
        )}
      </div>

      {!bodyweight && (
        <TapeInput
          label="Weight"
          suffix={settings.unit}
          value={set.weight}
          ghost={fill.weight ?? 0}
          min={0}
          max={500}
          step={settings.weightStep}
          majorEvery={Math.max(1, Math.round(10 / settings.weightStep))}
          decimal
          tickSound={settings.tickSound}
          format={(v) => fmtWeight(v) || '0'}
          onCommit={(weight) =>
            dispatch({ type: 'updateSet', exId: exercise.id, setId: set.id, patch: { weight } })
          }
        />
      )}

      <TapeInput
        label="Reps"
        value={set.reps}
        ghost={fill.reps ?? exercise.repLow}
        min={0}
        max={100}
        step={1}
        majorEvery={5}
        tickSound={settings.tickSound}
        onCommit={(reps) =>
          dispatch({ type: 'updateSet', exId: exercise.id, setId: set.id, patch: { reps: Math.round(reps) } })
        }
      />

      {!set.done && (
        <button
          className="btn primary block complete"
          onClick={() => {
            if (act.completeSet(exercise.id, set.id)) onDone()
          }}
        >
          <IconCheck /> Complete set
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Exercise card
 * ------------------------------------------------------------------ */
const ExerciseCard = ({
  session, exercise, index, count, activeSetId, setActiveSetId,
}: {
  session: Session
  exercise: SessionExercise
  index: number
  count: number
  activeSetId: string | null
  setActiveSetId: (id: string | null) => void
}) => {
  const unit = useAppSelector((s) => s.settings.unit)
  const sessions = useAppSelector((s) => s.sessions)
  const [menu, setMenu] = useState(false)
  const [confirmDeleteSet, setConfirmDeleteSet] = useState<string | null>(null)

  const last = useMemo(
    () => lastPerformance(sessions, exercise.exerciseId, session.id),
    [sessions, exercise.exerciseId, session.id],
  )

  const target = exercise.repLow === exercise.repHigh
    ? `${exercise.sets.length} × ${exercise.repLow}`
    : `${exercise.sets.length} × ${exercise.repLow}-${exercise.repHigh}`

  const advance = (fromIndex: number) => {
    const next = exercise.sets.find((s, i) => i > fromIndex && !s.done)
    setActiveSetId(next?.id ?? null)
  }

  const removeLastSet = () => {
    const lastSet = exercise.sets[exercise.sets.length - 1]
    if (!lastSet) return
    if (lastSet.done) setConfirmDeleteSet(lastSet.id)
    else dispatch({ type: 'deleteSet', exId: exercise.id, setId: lastSet.id })
  }

  const daysAgoLabel = last
    ? Math.floor((Date.now() - (last.session.finishedAt ?? last.session.startedAt)) / 86400000)
    : null

  return (
    <section className="card ex-card">
      <div className="ex-head">
        <span className="ex-name">{exercise.name}</span>
        <span className="pill num">{target}</span>
        <button className="btn sm ghost" aria-label={`Options for ${exercise.name}`} onClick={() => setMenu(true)}>
          ⋯
        </button>
      </div>

      <div className="last-line">
        {last ? (
          <>
            Last{daysAgoLabel !== null && ` (${daysAgoLabel}d ago)`}:{' '}
            <b className="num">
              {workingSets(last.exercise)
                .map((s) => (s.weight !== null ? `${fmtWeight(s.weight)}×${s.reps}` : `${s.reps}`))
                .join(', ')}
            </b>
            {workingSets(last.exercise).some((s) => s.weight !== null) && (
              <span className="faint"> {unit}</span>
            )}
          </>
        ) : (
          <span className="faint">First time — set your baseline</span>
        )}
        {exercise.notes && <div className="tiny muted" style={{ marginTop: 4 }}>{exercise.notes}</div>}
      </div>

      {exercise.sets.map((set, i) =>
        activeSetId === set.id ? (
          <SetRow
            key={set.id}
            session={session}
            exercise={exercise}
            index={i}
            active
            onActivate={() => {}}
            onDone={() => advance(i)}
          />
        ) : (
          <SetRow
            key={set.id}
            session={session}
            exercise={exercise}
            index={i}
            active={false}
            onActivate={() => setActiveSetId(set.id)}
            onDone={() => {}}
          />
        ),
      )}

      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={() => act.addSet(exercise.id)}>+ Set</button>
        {exercise.sets.length > 1 && (
          <button className="btn sm ghost" onClick={removeLastSet}>− Set</button>
        )}
        <span className="spacer" />
        <span className="tiny faint num">
          {exercise.sets.filter((s) => s.done).length}/{exercise.sets.length} done
        </span>
      </div>

      {menu && (
        <Sheet title={exercise.name} onClose={() => setMenu(false)}>
          <div className="stack">
            <button className="btn block" disabled={index === 0}
              onClick={() => { dispatch({ type: 'moveSessionExercise', exId: exercise.id, delta: -1 }); setMenu(false) }}>
              Move up
            </button>
            <button className="btn block" disabled={index === count - 1}
              onClick={() => { dispatch({ type: 'moveSessionExercise', exId: exercise.id, delta: 1 }); setMenu(false) }}>
              Move down
            </button>
            <button className="btn block"
              onClick={() => { act.startRest(exercise.restSec, exercise.name); setMenu(false) }}>
              Start rest timer ({fmtClock(exercise.restSec)})
            </button>
            <button className="btn block danger"
              onClick={() => { dispatch({ type: 'removeSessionExercise', exId: exercise.id }); setMenu(false) }}>
              <IconTrash /> Remove from this workout
            </button>
          </div>
        </Sheet>
      )}

      {confirmDeleteSet && (
        <Sheet title="Delete a completed set?" onClose={() => setConfirmDeleteSet(null)}>
          <div className="stack">
            <p className="small muted">This set is already logged. Deleting it can't be undone.</p>
            <button className="btn danger block"
              onClick={() => {
                dispatch({ type: 'deleteSet', exId: exercise.id, setId: confirmDeleteSet })
                setConfirmDeleteSet(null)
              }}>
              Delete set
            </button>
            <button className="btn ghost block" onClick={() => setConfirmDeleteSet(null)}>Keep it</button>
          </div>
        </Sheet>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 *  Header clock: isolated so only this ticks every second.
 * ------------------------------------------------------------------ */
const LiveDuration = ({ startedAt, sets }: { startedAt: number; sets: number }) => {
  const now = useNow(1000)
  return (
    <span className="sub num">
      {fmtClock((now - startedAt) / 1000)} · {sets} {sets === 1 ? 'set' : 'sets'} done
    </span>
  )
}

const AddExerciseSheet = ({ onClose }: { onClose: () => void }) => {
  const catalog = useAppSelector((s) => s.catalog)
  const [name, setName] = useState('')
  const names = useMemo(
    () =>
      Object.values(catalog)
        .filter((e) => !e.archived)
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b)),
    [catalog],
  )
  const query = name.trim().toLowerCase()
  const matches = query
    ? names.filter((n) => n.toLowerCase().includes(query)).slice(0, 6)
    : []

  const add = (chosen: string) => {
    if (!chosen.trim()) return
    act.addSessionExercise(chosen.trim())
    onClose()
  }

  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <div className="stack">
        <input
          autoFocus value={name} placeholder="Search or type a new exercise"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(name) }}
        />
        {matches.map((m) => (
          <button key={m} className="list-item" onClick={() => add(m)}>
            <span style={{ flex: 1 }}>{m}</span>
            <span className="chev">＋</span>
          </button>
        ))}
        <p className="tiny faint">
          Added for this workout only — the day's template doesn't change.
          Picking an existing name keeps its history and records connected.
        </p>
        <button className="btn primary block" onClick={() => add(name)} disabled={!name.trim()}>
          Add{name.trim() ? ` "${name.trim()}"` : ''}
        </button>
      </div>
    </Sheet>
  )
}

export const SessionScreen = () => {
  const session = useAppSelector(selectActive)
  const [adding, setAdding] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [activeSetId, setActiveSetId] = useState<string | null>(() => {
    // Open on the first incomplete set of the first unfinished exercise.
    const s = selectActive(getStore().getState())
    return s?.exercises.flatMap((e) => e.sets).find((x) => !x.done)?.id ?? null
  })

  if (!session) return null
  const done = sessionDoneSetCount(session)

  return (
    <>
      <header className="topbar">
        <button className="btn sm ghost" aria-label="Back to Today" onClick={() => switchTab('/')}>
          <IconBack />
        </button>
        <h1>
          {session.dayName}
          <LiveDuration startedAt={session.startedAt} sets={done} />
        </h1>
        <button className="btn sm primary" onClick={() => setFinishing(true)}>Finish</button>
      </header>

      <main className="main">
        {session.dayNotes && (
          <div className="card tight">
            <div className="tiny faint" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Warm-up</div>
            <div className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{session.dayNotes}</div>
          </div>
        )}

        {session.exercises.map((e, i) => (
          <ExerciseCard
            key={e.id}
            session={session}
            exercise={e}
            index={i}
            count={session.exercises.length}
            activeSetId={activeSetId}
            setActiveSetId={setActiveSetId}
          />
        ))}

        <button className="btn block" onClick={() => setAdding(true)}>+ Add exercise</button>

        <div className="section-title">Workout notes</div>
        <textarea
          rows={3}
          defaultValue={session.notes}
          placeholder="How it felt, tweaks for next time…"
          onBlur={(e) => dispatch({ type: 'setSessionNotes', notes: e.target.value })}
        />
      </main>

      {adding && <AddExerciseSheet onClose={() => setAdding(false)} />}

      {finishing && (
        <Sheet title="Finish workout?" onClose={() => setFinishing(false)}>
          <div className="stack">
            <p className="small muted">
              {done > 0
                ? `${done} ${done === 1 ? 'set' : 'sets'} will be saved. Rows you didn't complete are dropped.`
                : "You haven't completed any sets yet — there's nothing to save."}
            </p>
            <button
              className="btn primary block" disabled={done === 0}
              onClick={() => { act.finishSession(); switchTab('/') }}
            >
              Save workout
            </button>
            <button
              className="btn block danger"
              onClick={() => { dispatch({ type: 'discardActiveSession' }); switchTab('/') }}
            >
              Discard workout
            </button>
            <button className="btn ghost block" onClick={() => setFinishing(false)}>Keep going</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
