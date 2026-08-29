import { useState } from 'react'
import { useStore } from '../store'
import { navigate } from '../lib/router'
import { Sheet } from '../components/Sheet'
import { NumberField } from '../components/NumberField'
import { IconBack, IconTrash } from '../components/icons'
import { formatExerciseList, parseExerciseList } from '../lib/parse'
import { fmtClock } from '../lib/util'
import type { ExerciseTemplate } from '../types'

export const ProgramScreen = () => {
  const { state, dispatch } = useStore()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(state.program.name)

  return (
    <>
      <header className="topbar">
        <h1>
          Program
          <span className="sub">{state.program.name}</span>
        </h1>
        <button className="btn sm ghost" onClick={() => { setName(state.program.name); setRenaming(true) }}>Rename</button>
      </header>

      <main className="main">
        <div className="section-title">Days</div>
        {state.program.days.map((day, i) => (
          <div key={day.id} className="card day-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="name">{day.name}</div>
              <div className="small muted">
                {day.exercises.length === 0
                  ? 'Empty — tap to add exercises'
                  : `${day.exercises.length} exercises · ${day.exercises.reduce((n, e) => n + e.sets, 0)} sets`}
              </div>
            </div>
            <button className="btn sm ghost" aria-label={`Move ${day.name} up`} disabled={i === 0}
              onClick={() => dispatch({ type: 'moveDay', dayId: day.id, delta: -1 })}>↑</button>
            <button className="btn sm ghost" aria-label={`Move ${day.name} down`} disabled={i === state.program.days.length - 1}
              onClick={() => dispatch({ type: 'moveDay', dayId: day.id, delta: 1 })}>↓</button>
            <button className="btn sm" onClick={() => navigate(`/program/${day.id}`)}>Edit</button>
          </div>
        ))}

        <button className="btn block" onClick={() => dispatch({ type: 'addDay' })}>+ Add day</button>

        <p className="tiny muted" style={{ marginTop: 16, padding: '0 4px' }}>
          Editing a day only changes future workouts. Workouts you've already saved keep the exercises you actually did.
        </p>
      </main>

      {renaming && (
        <Sheet title="Program name" onClose={() => setRenaming(false)}>
          <div className="stack">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            <button
              className="btn primary block"
              onClick={() => {
                dispatch({ type: 'replaceState', state: { ...state, program: { ...state.program, name: name.trim() || state.program.name } } })
                setRenaming(false)
              }}
            >
              Save
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}

const ExerciseEditor = ({
  dayId, exercise, index, count,
}: {
  dayId: string
  exercise: ExerciseTemplate
  index: number
  count: number
}) => {
  const { dispatch } = useStore()
  const patch = (p: Partial<Omit<ExerciseTemplate, 'id'>>) =>
    dispatch({ type: 'updateExercise', dayId, exId: exercise.id, patch: p })

  return (
    <section className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <input
          value={exercise.name} placeholder="Exercise name"
          aria-label={`Name of exercise ${index + 1}`}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>

      <div className="grid-2">
        <label className="field">
          <span>Sets</span>
          <NumberField ariaLabel="Sets" value={exercise.sets} min={1}
            onChange={(v) => patch({ sets: Math.max(1, Math.round(v ?? 1)) })} />
        </label>
        <label className="field">
          <span>Rest</span>
          <NumberField ariaLabel="Rest seconds" value={exercise.restSec} min={0} step={15}
            onChange={(v) => patch({ restSec: Math.max(0, Math.round(v ?? 0)) })} />
        </label>
        <label className="field">
          <span>Reps from</span>
          <NumberField ariaLabel="Minimum reps" value={exercise.repLow} min={1}
            onChange={(v) => patch({ repLow: Math.max(1, Math.round(v ?? 1)) })} />
        </label>
        <label className="field">
          <span>Reps to</span>
          <NumberField ariaLabel="Maximum reps" value={exercise.repHigh} min={1}
            onChange={(v) => patch({ repHigh: Math.max(1, Math.round(v ?? 1)) })} />
        </label>
      </div>

      <input
        style={{ marginTop: 10 }} value={exercise.notes} placeholder="Cue or note (optional)"
        aria-label="Exercise note" onChange={(e) => patch({ notes: e.target.value })}
      />

      <div className="row" style={{ marginTop: 10 }}>
        <span className="tiny muted">Rest {fmtClock(exercise.restSec)}</span>
        <span className="spacer" />
        <button className="btn sm ghost" aria-label="Move up" disabled={index === 0}
          onClick={() => dispatch({ type: 'moveExercise', dayId, exId: exercise.id, delta: -1 })}>↑</button>
        <button className="btn sm ghost" aria-label="Move down" disabled={index === count - 1}
          onClick={() => dispatch({ type: 'moveExercise', dayId, exId: exercise.id, delta: 1 })}>↓</button>
        <button className="btn sm danger" aria-label="Delete exercise"
          onClick={() => dispatch({ type: 'deleteExercise', dayId, exId: exercise.id })}><IconTrash /></button>
      </div>
    </section>
  )
}

const PasteSheet = ({ dayId, onClose }: { dayId: string; onClose: () => void }) => {
  const { state, dispatch } = useStore()
  const day = state.program.days.find((d) => d.id === dayId)
  const [text, setText] = useState(day ? formatExerciseList(day.exercises) : '')
  const parsed = parseExerciseList(text, state.settings.defaultRestSec)

  return (
    <Sheet title="Paste exercise list" onClose={onClose}>
      <div className="stack">
        <p className="small muted">
          One exercise per line. Sets and reps are picked up from anything like <code>3x6-8</code>;
          a trailing <code>(...)</code> becomes a note, and a rest time inside it is used as the rest timer.
        </p>
        <textarea
          rows={10} autoFocus value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'Barbell Bench Press 3x6-8 (rest 3 min)\nIncline Dumbbell Press 3x8-10\nCable Fly 2x12-15'}
        />
        <div className="small muted">
          {parsed.length} exercise{parsed.length === 1 ? '' : 's'} recognised
          {parsed.length > 0 && `: ${parsed.map((e) => `${e.name} ${e.sets}×${e.repLow === e.repHigh ? e.repLow : `${e.repLow}-${e.repHigh}`}`).join(' · ')}`}
        </div>
        <button
          className="btn primary block" disabled={parsed.length === 0}
          onClick={() => { dispatch({ type: 'setDayExercises', dayId, exercises: parsed }); onClose() }}
        >
          Replace day with these {parsed.length}
        </button>
        <button className="btn ghost block" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  )
}

export const DayEditor = ({ dayId }: { dayId: string }) => {
  const { state, dispatch } = useStore()
  const day = state.program.days.find((d) => d.id === dayId)
  const [pasting, setPasting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!day) {
    return (
      <main className="main">
        <div className="empty">That day no longer exists.</div>
      </main>
    )
  }

  return (
    <>
      <header className="topbar">
        <button className="btn sm ghost" aria-label="Back" onClick={() => navigate('/program')}><IconBack /></button>
        <h1>Edit day</h1>
        <button className="btn sm" onClick={() => setPasting(true)}>Paste list</button>
      </header>

      <main className="main">
        <label className="field card tight">
          <span>Day name</span>
          <input value={day.name} onChange={(e) => dispatch({ type: 'updateDay', dayId, patch: { name: e.target.value } })} />
        </label>

        <label className="field card tight">
          <span>Warm-up / day notes</span>
          <textarea
            rows={3} value={day.notes} placeholder="Warm-up protocol, reminders…"
            onChange={(e) => dispatch({ type: 'updateDay', dayId, patch: { notes: e.target.value } })}
          />
        </label>

        {day.exercises.length === 0 && (
          <div className="empty">
            Nothing here yet.
            <div style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => setPasting(true)}>Paste a workout list</button>
            </div>
          </div>
        )}

        {day.exercises.map((ex, i) => (
          <ExerciseEditor key={ex.id} dayId={dayId} exercise={ex} index={i} count={day.exercises.length} />
        ))}

        <button className="btn block" onClick={() => dispatch({ type: 'addExercise', dayId })}>+ Add exercise</button>
        <button className="btn block danger" style={{ marginTop: 10 }} onClick={() => setConfirmDelete(true)}>
          Delete this day
        </button>
      </main>

      {pasting && <PasteSheet dayId={dayId} onClose={() => setPasting(false)} />}

      {confirmDelete && (
        <Sheet title={`Delete "${day.name}"?`} onClose={() => setConfirmDelete(false)}>
          <div className="stack">
            <p className="small muted">Saved workouts from this day are kept in your history.</p>
            <button className="btn danger block"
              onClick={() => { dispatch({ type: 'deleteDay', dayId }); navigate('/program') }}>Delete day</button>
            <button className="btn ghost block" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
