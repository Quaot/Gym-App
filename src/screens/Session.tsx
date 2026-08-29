import { useMemo, useState } from 'react'
import type { AppState, Session, SessionExercise } from '../types'
import { useAppSelector, dispatch, getStore } from '../store/store'
import { act } from '../store/actions'
import { switchTab } from '../lib/router'
import { TapeInput } from '../components/TapeInput'
import { Sheet } from '../components/Sheet'
import { Screen } from '../app/Screen'
import { IconCheck, IconTrash } from '../components/icons'
import { fmtClock, fmtWeight } from '../lib/util'
import { prefillFor } from '../lib/prefill'
import { suggestionFor } from '../lib/suggest'
import { InfoPopover } from '../components/InfoPopover'
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
  const sessions = useAppSelector((s) => s.sessions)
  const catalog = useAppSelector((s) => s.catalog)
  const set = exercise.sets[index]
  const fill = useMemo(
    () => prefillFor({ sessions, settings, catalog }, session, exercise, index),
    [sessions, settings, catalog, session, exercise, index],
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
        }${reps ?? ''} reps. Tap to edit.`}
      >
        <span className="ord">{set.done ? <IconCheck /> : displayOrdinal}</span>
        <span className={`vals num${isGhost ? ' ghosted' : ''}`}>
          {weight !== null && (
            <>
              {fmtWeight(weight)}
              <span className="t-caption label-2"> {settings.unit}</span>
              <span className="x">×</span>
            </>
          )}
          {reps ?? ''}
          {weight === null && <span className="t-caption label-2"> reps</span>}
        </span>
        <span className="spacer" />
        {restedMs !== null && (
          <span className="restnote num">rested {fmtClock(restedMs / 1000)}</span>
        )}
      </button>
    )
  }

  const bodyweight = catalog[exercise.exerciseId]?.bodyweight ?? false
  const { reason } = suggestionFor({ sessions, settings, catalog }, exercise, session.id)

  return (
    <div className="set-editor">
      <div className="row" style={{ marginBottom: 4 }}>
        <button
          className={`pill${set.warmup ? ' warm' : ''}`}
          onClick={() =>
            dispatch({ type: 'updateSet', exId: exercise.id, setId: set.id, patch: { warmup: !set.warmup } })
          }
        >
          {set.warmup ? 'Warm-up' : `Set ${displayOrdinal}`}
        </button>
        {!set.warmup && (
          <InfoPopover content={reason} label="Why this weight">
            <span className="pill">Why</span>
          </InfoPopover>
        )}
        <span className="spacer" />
        {set.done && (
          <button
            className="btn-plain"
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
          className="btn-filled block complete"
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
        <button className="btn-plain" aria-label={`Options for ${exercise.name}`} onClick={() => setMenu(true)}>
          ⋯
        </button>
      </div>

      <div className="last-line">
        {last ? (
          <>
            <b className="num">
              {workingSets(last.exercise)
                .map((s) => (s.weight !== null ? `${fmtWeight(s.weight)}×${s.reps}` : `${s.reps}`))
                .join('  ')}
            </b>
            {workingSets(last.exercise).some((s) => s.weight !== null) && ` ${unit}`}
            {daysAgoLabel !== null && `, ${daysAgoLabel}d ago`}
          </>
        ) : (
          <span className="label-3">No history yet</span>
        )}
        {exercise.notes && <div className="t-caption label-2" style={{ marginTop: 3 }}>{exercise.notes}</div>}
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
        <button className="btn-plain" onClick={() => act.addSet(exercise.id)}>+ Set</button>
        {exercise.sets.length > 1 && (
          <button className="btn-plain" onClick={removeLastSet}>− Set</button>
        )}
        <span className="spacer" />
        <span className="tiny faint num">
          {exercise.sets.filter((s) => s.done).length}/{exercise.sets.length} done
        </span>
      </div>

      {menu && (
        <Sheet title={exercise.name} onClose={() => setMenu(false)}>
          <div className="stack">
            <button className="btn-gray block" disabled={index === 0}
              onClick={() => { dispatch({ type: 'moveSessionExercise', exId: exercise.id, delta: -1 }); setMenu(false) }}>
              Move up
            </button>
            <button className="btn-gray block" disabled={index === count - 1}
              onClick={() => { dispatch({ type: 'moveSessionExercise', exId: exercise.id, delta: 1 }); setMenu(false) }}>
              Move down
            </button>
            <button className="btn-gray block"
              onClick={() => { act.startRest(exercise.restSec, exercise.name); setMenu(false) }}>
              Start rest timer ({fmtClock(exercise.restSec)})
            </button>
            <button className="btn-tinted destructive block"
              onClick={() => { dispatch({ type: 'removeSessionExercise', exId: exercise.id }); setMenu(false) }}>
              <IconTrash /> Remove from this workout
            </button>
          </div>
        </Sheet>
      )}

      {confirmDeleteSet && (
        <Sheet title="Delete a completed set?" onClose={() => setConfirmDeleteSet(null)}>
          <div className="stack">
            <p className="t-footnote label-2">This set is logged. Deleting it cannot be undone.</p>
            <button className="btn-tinted destructive block"
              onClick={() => {
                dispatch({ type: 'deleteSet', exId: exercise.id, setId: confirmDeleteSet })
                setConfirmDeleteSet(null)
              }}>
              Delete set
            </button>
            <button className="btn-gray block" onClick={() => setConfirmDeleteSet(null)}>Keep it</button>
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
    <span className="num">
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
          autoFocus value={name} placeholder="Search or add"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(name) }}
        />
        {matches.map((m) => (
          <button key={m} className="row-item" onClick={() => add(m)}>
            <span style={{ flex: 1 }}>{m}</span>
            <span className="chevron">＋</span>
          </button>
        ))}
        <p className="t-caption label-3">
          This workout only. The day's template stays as it is.
        </p>
        <button className="btn-filled block" onClick={() => add(name)} disabled={!name.trim()}>
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
  const [cancelling, setCancelling] = useState(false)
  const [activeSetId, setActiveSetId] = useState<string | null>(() => {
    // Open on the first incomplete set of the first unfinished exercise.
    const s = selectActive(getStore().getState())
    return s?.exercises.flatMap((e) => e.sets).find((x) => !x.done)?.id ?? null
  })

  if (!session) return null
  const done = sessionDoneSetCount(session)

  return (
    <Screen
      id="session"
      title={session.dayName}
      subtitle={<LiveDuration startedAt={session.startedAt} sets={done} />}
      centerTitle
      leading={<button className="btn-plain danger" onClick={() => setCancelling(true)}>Cancel</button>}
      trailing={<button className="btn-plain strong" onClick={() => setFinishing(true)}>Finish</button>}
    >
        {session.dayNotes && (
          <>
            <div className="section-header tight">Before you start</div>
            <div className="group">
              <div className="row-item" style={{ display: 'block' }}>
                <div className="t-subhead label-2" style={{ whiteSpace: 'pre-wrap' }}>
                  {session.dayNotes}
                </div>
              </div>
            </div>
          </>
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

        <button className="btn-gray block" onClick={() => setAdding(true)}>+ Add exercise</button>

        <div className="section-header">Workout notes</div>
        <textarea
          rows={3}
          defaultValue={session.notes}
          placeholder="Notes"
          onBlur={(e) => dispatch({ type: 'setSessionNotes', notes: e.target.value })}
        />
      {adding && <AddExerciseSheet onClose={() => setAdding(false)} />}

      {cancelling && (
        <Sheet title="Cancel this workout?" onClose={() => setCancelling(false)}>
          <div className="stack">
            <p className="t-footnote label-2">
              {done > 0
                ? `Throws away ${done} logged ${done === 1 ? 'set' : 'sets'}.`
                : 'Nothing is logged yet.'}
            </p>
            <button className="btn-tinted destructive block"
              onClick={() => { dispatch({ type: 'discardActiveSession' }); switchTab('/') }}>
              Cancel workout
            </button>
            <button className="btn-gray block" onClick={() => setCancelling(false)}>
              Keep going
            </button>
          </div>
        </Sheet>
      )}

      {finishing && (
        <Sheet title="Finish workout?" onClose={() => setFinishing(false)}>
          <div className="stack">
            <p className="t-footnote label-2">
              {done > 0
                ? `Saves ${done} ${done === 1 ? 'set' : 'sets'}. Empty rows are dropped.`
                : 'No sets logged yet.'}
            </p>
            <button
              className="btn-filled block" disabled={done === 0}
              onClick={() => { act.finishSession(); switchTab('/') }}
            >
              Save workout
            </button>
            <button className="btn-gray block" onClick={() => setFinishing(false)}>Keep going</button>
          </div>
        </Sheet>
      )}
    </Screen>
  )
}
