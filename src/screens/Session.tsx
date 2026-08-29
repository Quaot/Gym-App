import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, Session, SessionExercise } from '../types'
import { useAppSelector, dispatch, getStore } from '../store/store'
import { act } from '../store/actions'
import { switchTab } from '../lib/router'
import { TapeInput } from '../components/TapeInput'
import { Sheet } from '../components/Sheet'
import { Screen, forgetScroll } from '../app/Screen'
import { IconCheck, IconTrash } from '../components/icons'
import { fmtClock, fmtWeight, uid } from '../lib/util'
import { prefillFor } from '../lib/prefill'
import { reconcileWarmups } from '../lib/warmups'
import { PLATES_KG, PLATES_LB, describePlates, platesFor } from '../lib/plates'
import { suggestionFor } from '../lib/suggest'
import { InfoPopover } from '../components/InfoPopover'
import {
  lastPerformance, recordsIn, sessionDoneSetCount, sessionVolume, workingSets,
} from '../lib/history'
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

  // What to hang on the bar, for the movements that use one.
  const equipment = catalog[exercise.exerciseId]?.equipment
  const plates = useMemo(
    () =>
      equipment === 'barbell' && weight !== null
        ? platesFor(weight, settings.barWeight, settings.unit === 'kg' ? PLATES_KG : PLATES_LB)
        : null,
    [equipment, weight, settings.barWeight, settings.unit],
  )

  if (!active) {
    return (
      <button
        className={`set-line${set.done ? ' done' : ''}${set.warmup ? ' warmup' : ''}`}
        onClick={onActivate}
        aria-label={`${set.warmup ? 'Warm-up set' : `Set ${displayOrdinal}`}${set.done ? ', done' : ''}: ${
          weight !== null ? `${fmtWeight(weight)} ${settings.unit} × ` : ''
        }${reps ?? ''} reps, tap to edit`}
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
  // The grid the tape snaps to is the one this movement actually loads on, so
  // a warm-up computed on the same grid can never read back as a different
  // number than it holds.
  const weightStep = catalog[exercise.exerciseId]?.increment ?? settings.weightStep
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

      {plates && (
        <div className="plates num" aria-label="Plates per side">
          <span className="label-3">{settings.barWeight} bar</span>
          {plates.perSide.length > 0 && <span className="plate-list">{describePlates(plates.perSide)}</span>}
          <span className="label-3">per side</span>
        </div>
      )}

      {!bodyweight && (
        <TapeInput
          label="Weight"
          suffix={settings.unit}
          value={set.weight}
          ghost={fill.weight ?? 0}
          min={0}
          max={500}
          step={weightStep}
          majorEvery={Math.max(1, Math.round(10 / weightStep))}
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
  const catalog = useAppSelector((s) => s.catalog)
  const settings = useAppSelector((s) => s.settings)
  const [menu, setMenu] = useState(false)
  const [confirmDeleteSet, setConfirmDeleteSet] = useState<string | null>(null)

  const last = useMemo(
    () => lastPerformance(sessions, exercise.exerciseId, session.id),
    [sessions, exercise.exerciseId, session.id],
  )

  // A record is worth knowing about the moment you set it.
  const record = useMemo(
    () => recordsIn({ sessions, catalog }, session).get(exercise.id) ?? null,
    [sessions, catalog, session, exercise.id],
  )

  /**
   * The ramp follows the weight you are about to lift. It comes from the first
   * working set, whether that is the coaching suggestion, last session, or a
   * weight you just dialled in yourself. That is what makes a warm-up appear
   * on a movement's very first session, when there is no history to build one
   * from at the moment the workout starts.
   */
  const increment = catalog[exercise.exerciseId]?.increment ?? settings.weightStep
  const plannedWeight = useMemo(() => {
    const firstWorking = exercise.sets.find((x) => !x.warmup)
    if (firstWorking?.weight != null) return firstWorking.weight
    const index = exercise.sets.findIndex((x) => !x.warmup)
    if (index < 0) return null
    return prefillFor(
      { sessions, settings, catalog },
      session,
      exercise,
      index,
    ).weight
  }, [exercise, session, sessions, settings, catalog])

  /**
   * Rows this screen generated, so an edit can be told from a regeneration.
   * The moment you change a warm-up by hand the ramp stops following the
   * working weight: it is yours now, and overwriting it would be rude.
   */
  const generated = useRef(new Map<string, { weight: number | null; reps: number | null }>())
  const rampIsYours = useRef(false)

  useEffect(() => {
    if (exercise.warmupPlan.length === 0 || rampIsYours.current) return

    for (const row of exercise.sets) {
      if (!row.warmup || row.done) continue
      const mine = generated.current.get(row.id)
      if (mine && (mine.weight !== row.weight || mine.reps !== row.reps)) {
        rampIsYours.current = true
        return
      }
    }

    const next = reconcileWarmups(
      exercise.sets, exercise.warmupPlan, plannedWeight, increment, uid,
    )
    // Record either way. Rows that already match the plan are generated rows
    // too, whether this screen built them or the workout did at its start.
    generated.current = new Map(
      next.filter((x) => x.warmup && !x.done).map((x) => [x.id, { weight: x.weight, reps: x.reps }]),
    )
    if (next === exercise.sets) return
    dispatch({ type: 'setSets', exId: exercise.id, sets: next })
  }, [exercise, plannedWeight, increment])

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
        {record && (
          <span className="pill record" title="Personal record">
            PR
          </span>
        )}
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
            <p className="t-footnote label-2">This set is logged. Deleting it cannot be undone</p>
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
 *  What the workout came to: the one moment worth pausing on.
 * ------------------------------------------------------------------ */
const Summary = ({ session }: { session: Session }) => {
  const sessions = useAppSelector((s) => s.sessions)
  const catalog = useAppSelector((s) => s.catalog)
  const unit = useAppSelector((s) => s.settings.unit)

  const sets = sessionDoneSetCount(session)
  const volume = Math.round(sessionVolume(session))
  const minutes = Math.round((Date.now() - session.startedAt) / 60000)
  const records = useMemo(
    () => [...recordsIn({ sessions, catalog }, session).entries()],
    [sessions, catalog, session],
  )

  return (
    <div className="summary">
      <div className="stat-row">
        <div className="stat">
          <div className="label">Time</div>
          <div className="value num">{minutes}<span className="unit">min</span></div>
        </div>
        <div className="stat">
          <div className="label">Sets</div>
          <div className="value num">{sets}</div>
        </div>
        <div className="stat">
          <div className="label">Volume</div>
          <div className="value num">
            {volume.toLocaleString()}<span className="unit">{unit}</span>
          </div>
        </div>
      </div>
      {records.length > 0 && (
        <div className="records">
          {records.map(([exId, r]) => {
            const name = session.exercises.find((e) => e.id === exId)?.name ?? 'Exercise'
            return (
              <div className="record-line" key={exId}>
                <span className="pill record">PR</span>
                <span className="grow">{name}</span>
                <span className="num">
                  {r.set.weight !== null
                    ? `${fmtWeight(r.set.weight)} ${unit} × ${r.set.reps}`
                    : `${r.set.reps} reps`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Header clock: isolated so only this ticks every second.
 * ------------------------------------------------------------------ */
const LiveDuration = ({
  startedAt, sets, planned,
}: { startedAt: number; sets: number; planned: number }) => {
  const now = useNow(1000)
  return (
    <span className="num">
      {fmtClock((now - startedAt) / 1000)} · {sets} of {planned} sets
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
  // With nothing typed the list is browsable rather than empty, since you do
  // not always know what a movement is called in here.
  const matches = (query ? names.filter((n) => n.toLowerCase().includes(query)) : names).slice(0, 8)

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
          This workout only, since the day's template stays as it is
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
  // Warm-ups count: they are sets you have to do to get through the workout.
  const planned = session.exercises.reduce((n, e) => n + e.sets.length, 0)

  return (
    <Screen
      id={`session/${session.id}`}
      title={session.dayName}
      subtitle={<LiveDuration startedAt={session.startedAt} sets={done} planned={planned} />}
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
                ? `Throws away ${done} logged ${done === 1 ? 'set' : 'sets'}`
                : 'Nothing is logged yet'}
            </p>
            <button className="btn-tinted destructive block"
              onClick={() => {
                forgetScroll(`session/${session.id}`)
                dispatch({ type: 'discardActiveSession' })
                switchTab('/')
              }}>
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
            <Summary session={session} />
            <p className="t-footnote label-2">
              {done > 0
                ? `Saves ${done} ${done === 1 ? 'set' : 'sets'} and drops the empty rows`
                : 'No sets logged yet'}
            </p>
            <button
              className="btn-filled block" disabled={done === 0}
              onClick={() => {
                forgetScroll(`session/${session.id}`)
                act.finishSession()
                switchTab('/')
              }}
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
