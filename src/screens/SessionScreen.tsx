import { useMemo, useState } from 'react'
import type { LoggedSet, Session, SessionExercise } from '../types'
import { useStore } from '../store'
import { navigate } from '../lib/router'
import { NumberField } from '../components/NumberField'
import { Sheet } from '../components/Sheet'
import { RestBar, useRestTimer } from '../components/RestTimer'
import type { RestTimer } from '../components/RestTimer'
import { IconBack, IconCheck, IconTrash } from '../components/icons'
import { daysAgo, fmtDuration, fmtWeight } from '../lib/util'
import { knownExerciseNames, lastPerformance, sessionSetCount, workingSets } from '../lib/history'

/** What to put in an empty set when it's ticked off: carry the previous set of
 *  this exercise, else the matching set from last time. */
const prefillFor = (
  exercise: SessionExercise,
  index: number,
  last: SessionExercise | null,
): Partial<LoggedSet> => {
  const prev = [...exercise.sets.slice(0, index)].reverse().find((s) => s.weight !== null || s.reps !== null)
  if (prev) return { weight: prev.weight, reps: prev.reps }
  const lastSets = last ? workingSets(last) : []
  const match = lastSets[index] ?? lastSets[lastSets.length - 1]
  if (match) return { weight: match.weight, reps: match.reps }
  // Nothing to carry: assume the programmed reps so a tap still logs a set.
  return { reps: exercise.repLow }
}

const ExerciseCard = ({
  session, exercise, timer, index, count,
}: {
  session: Session
  exercise: SessionExercise
  timer: RestTimer
  index: number
  count: number
}) => {
  const { state, dispatch } = useStore()
  const { unit, weightStep, autoStartTimer } = state.settings
  const [menu, setMenu] = useState(false)

  const last = useMemo(
    () => lastPerformance(state.sessions, exercise.name, session.id),
    [state.sessions, exercise.name, session.id],
  )

  const target = exercise.repLow === exercise.repHigh
    ? `${exercise.sets.length} × ${exercise.repLow}`
    : `${exercise.sets.length} × ${exercise.repLow}-${exercise.repHigh}`

  const toggleDone = (set: LoggedSet, i: number) => {
    if (set.done) return dispatch({ type: 'updateSet', exId: exercise.id, setId: set.id, patch: { done: false } })
    const fill = set.weight === null && set.reps === null
      ? prefillFor(exercise, i, last?.exercise ?? null)
      : {}
    dispatch({ type: 'updateSet', exId: exercise.id, setId: set.id, patch: { ...fill, done: true } })
    if (autoStartTimer && !set.warmup) timer.start(exercise.restSec || state.settings.defaultRestSec)
    navigator.vibrate?.(15)
  }

  return (
    <section className="card">
      <div className="ex-head">
        <span className="ex-name">{exercise.name || 'Untitled exercise'}</span>
        <span className="pill">{target}</span>
        <button className="btn sm ghost" aria-label="Exercise options" onClick={() => setMenu(true)}>⋯</button>
      </div>

      <div className="last-line">
        {last ? (
          <>
            Last ({daysAgo(last.session.finishedAt ?? last.session.startedAt)}d ago):{' '}
            <b>
              {workingSets(last.exercise)
                .map((s) => `${fmtWeight(s.weight)}${unit}×${s.reps}`)
                .join(', ')}
            </b>
          </>
        ) : (
          <span className="muted">First time logging this one</span>
        )}
        {exercise.notes && <div className="tiny muted" style={{ marginTop: 4 }}>{exercise.notes}</div>}
      </div>

      <div className="set-head">
        <span>Set</span><span>Weight ({unit})</span><span>Reps</span><span />
      </div>

      {exercise.sets.map((set, i) => (
        <div key={set.id} className={`set-row${set.done ? ' done' : ''}${set.warmup ? ' warmup' : ''}`}>
          <button
            className="idx"
            title="Tap to mark as a warm-up set"
            onClick={() => dispatch({ type: 'updateSet', exId: exercise.id, setId: set.id, patch: { warmup: !set.warmup } })}
          >
            {set.warmup ? 'W' : exercise.sets.slice(0, i).filter((s) => !s.warmup).length + 1}
          </button>
          <NumberField
            ariaLabel={`Weight for set ${i + 1}`}
            value={set.weight}
            decimal
            step={weightStep}
            placeholder={String(prefillFor(exercise, i, last?.exercise ?? null).weight ?? '')}
            onChange={(weight) => dispatch({ type: 'updateSet', exId: exercise.id, setId: set.id, patch: { weight } })}
          />
          <NumberField
            ariaLabel={`Reps for set ${i + 1}`}
            value={set.reps}
            step={1}
            placeholder={String(exercise.repLow)}
            onChange={(reps) => dispatch({ type: 'updateSet', exId: exercise.id, setId: set.id, patch: { reps } })}
          />
          <button
            className={`check${set.done ? ' on' : ''}`}
            aria-label={set.done ? `Undo set ${i + 1}` : `Complete set ${i + 1}`}
            onClick={() => toggleDone(set, i)}
          >
            <IconCheck />
          </button>
        </div>
      ))}

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn sm" onClick={() => dispatch({ type: 'addSet', exId: exercise.id })}>+ Set</button>
        {exercise.sets.length > 1 && (
          <button
            className="btn sm ghost"
            onClick={() => dispatch({
              type: 'deleteSet',
              exId: exercise.id,
              setId: exercise.sets[exercise.sets.length - 1].id,
            })}
          >
            − Set
          </button>
        )}
        <span className="spacer" />
        <span className="tiny muted">{workingSets(exercise).length} done</span>
      </div>

      {menu && (
        <Sheet title={exercise.name || 'Exercise'} onClose={() => setMenu(false)}>
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
              onClick={() => { timer.start(exercise.restSec || state.settings.defaultRestSec); setMenu(false) }}>
              Start rest timer
            </button>
            <button className="btn block danger"
              onClick={() => { dispatch({ type: 'removeSessionExercise', exId: exercise.id }); setMenu(false) }}>
              <IconTrash /> Remove from this workout
            </button>
          </div>
        </Sheet>
      )}
    </section>
  )
}

const AddExerciseSheet = ({ onClose }: { onClose: () => void }) => {
  const { state, dispatch } = useStore()
  const [name, setName] = useState('')
  const names = useMemo(
    () => knownExerciseNames(state.sessions, state.program.days.flatMap((d) => d.exercises.map((e) => e.name))),
    [state.sessions, state.program.days],
  )

  const add = () => {
    if (!name.trim()) return
    dispatch({ type: 'addSessionExercise', name: name.trim() })
    onClose()
  }

  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <div className="stack">
        <input
          autoFocus list="known-exercises" value={name} placeholder="Exercise name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        />
        <datalist id="known-exercises">
          {names.map((n) => <option key={n} value={n} />)}
        </datalist>
        <p className="tiny muted">Added for this workout only — it won't change the day's template.</p>
        <button className="btn primary block" onClick={add} disabled={!name.trim()}>Add</button>
      </div>
    </Sheet>
  )
}

export const SessionScreen = ({ session }: { session: Session }) => {
  const { dispatch } = useStore()
  const timer = useRestTimer()
  const [adding, setAdding] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const done = sessionSetCount(session)

  return (
    <>
      <header className="topbar">
        <button className="btn sm ghost" aria-label="Back" onClick={() => navigate('/')}><IconBack /></button>
        <h1>
          {session.dayName}
          <span className="sub mono">
            {fmtDuration(Date.now() - session.startedAt)} · {done} {done === 1 ? 'set' : 'sets'}
          </span>
        </h1>
        <button className="btn sm primary" onClick={() => setFinishing(true)}>Finish</button>
      </header>

      <main className="main">
        {session.dayNotes && (
          <div className="card tight">
            <div className="tiny muted">Warm-up</div>
            <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{session.dayNotes}</div>
          </div>
        )}

        {session.exercises.map((e, i) => (
          <ExerciseCard
            key={e.id} session={session} exercise={e} timer={timer}
            index={i} count={session.exercises.length}
          />
        ))}

        <button className="btn block" onClick={() => setAdding(true)}>+ Add exercise</button>

        <div className="section-title">Workout notes</div>
        <textarea
          rows={3} value={session.notes} placeholder="How it felt, tweaks for next time…"
          onChange={(e) => dispatch({ type: 'setSessionNotes', notes: e.target.value })}
        />
      </main>

      {timer.endsAt !== null && <div style={{ height: 56 }} aria-hidden />}
      <RestBar timer={timer} />
      {adding && <AddExerciseSheet onClose={() => setAdding(false)} />}

      {finishing && (
        <Sheet title="Finish workout?" onClose={() => setFinishing(false)}>
          <div className="stack">
            <p className="small muted">
              {done > 0
                ? `${done} sets will be saved. Any set you didn't tick off is dropped.`
                : "You haven't ticked off any sets yet — there's nothing to save."}
            </p>
            <button
              className="btn primary block" disabled={done === 0}
              onClick={() => { dispatch({ type: 'finishSession' }); navigate('/') }}
            >
              Save workout
            </button>
            <button
              className="btn block danger"
              onClick={() => { dispatch({ type: 'discardSession' }); navigate('/') }}
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
