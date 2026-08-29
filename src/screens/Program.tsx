import { useMemo, useState } from 'react'
import { useAppSelector, dispatch } from '../store/store'
import { act } from '../store/actions'
import { navigate, back } from '../lib/router'
import { Sheet } from '../components/Sheet'
import { IconBack, IconTrash } from '../components/icons'
import { formatExerciseList, parseExerciseList } from '../lib/parse'
import { fmtClock } from '../lib/util'
import { pplProgram, pplulProgram, presetCatalog } from '../lib/presets'
import { resolveExercise } from '../lib/catalog'
import { uid } from '../lib/util'
import type { ExerciseTemplate, Program, WarmupStep } from '../types'

export const ProgramScreen = () => {
  const programs = useAppSelector((s) => s.programs)
  const activeProgramId = useAppSelector((s) => s.activeProgramId)
  const program = programs.find((p) => p.id === activeProgramId) ?? programs[0]
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(program.name)
  const [managing, setManaging] = useState(false)

  return (
    <>
      <header className="topbar">
        <h1>
          Program
          <span className="sub">{program.name}</span>
        </h1>
        <button className="btn-plain" onClick={() => setManaging(true)}>Splits</button>
        <button className="btn-plain" onClick={() => { setName(program.name); setRenaming(true) }}>
          Rename
        </button>
      </header>

      <main className="main">
        {programs.length > 1 && (
          <div className="seg" role="tablist" aria-label="Programs">
            {programs.map((p) => (
              <button
                key={p.id}
                className={p.id === program.id ? 'on' : ''}
                role="tab"
                aria-selected={p.id === program.id}
                onClick={() => dispatch({ type: 'setActiveProgram', programId: p.id })}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="section-header">Days</div>
        {program.days.map((day, i) => (
          <div key={day.id} className="row-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="name">{day.name}</div>
              <div className="t-footnote label-2">
                {day.exercises.length === 0
                  ? 'Empty'
                  : `${day.exercises.length} exercises · ${day.exercises.reduce((n, e) => n + e.sets, 0)} sets`}
              </div>
            </div>
            <button className="btn-plain" aria-label={`Move ${day.name} up`} disabled={i === 0}
              onClick={() => dispatch({ type: 'moveDay', programId: program.id, dayId: day.id, delta: -1 })}>↑</button>
            <button className="btn-plain" aria-label={`Move ${day.name} down`} disabled={i === program.days.length - 1}
              onClick={() => dispatch({ type: 'moveDay', programId: program.id, dayId: day.id, delta: 1 })}>↓</button>
            <button className="btn-plain" onClick={() => navigate(`/program/${day.id}`)}>Edit</button>
          </div>
        ))}

        <button className="btn-gray block" onClick={() => act.addDay(program.id)}>+ Add day</button>

        <p className="t-caption label-3" style={{ marginTop: 16, padding: '0 4px' }}>
          Edits apply to future workouts. Saved workouts keep what you did.
        </p>
      </main>

      {renaming && (
        <Sheet title="Program name" onClose={() => setRenaming(false)}>
          <div className="stack">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn-filled block"
              onClick={() => {
                dispatch({ type: 'renameProgram', programId: program.id, name })
                setRenaming(false)
              }}>
              Save
            </button>
          </div>
        </Sheet>
      )}

      {managing && <SplitsSheet onClose={() => setManaging(false)} />}
    </>
  )
}

const SplitsSheet = ({ onClose }: { onClose: () => void }) => {
  const programs = useAppSelector((s) => s.programs)
  const activeProgramId = useAppSelector((s) => s.activeProgramId)
  const [confirmDelete, setConfirmDelete] = useState<Program | null>(null)

  const addPreset = (build: () => Program) => {
    act.addProgramFromPreset(() => ({ program: build(), catalog: presetCatalog() }))
    onClose()
  }

  return (
    <Sheet title="Your splits" onClose={onClose}>
      <div className="stack">
        {programs.map((p) => (
          <div key={p.id} className="row-item" style={{ marginBottom: 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 650 }}>{p.name}</div>
              <div className="t-caption label-2">{p.days.length} days{p.id === activeProgramId && ' · active'}</div>
            </div>
            {p.id !== activeProgramId && (
              <button className="btn-plain"
                onClick={() => { dispatch({ type: 'setActiveProgram', programId: p.id }); onClose() }}>
                Use
              </button>
            )}
            {programs.length > 1 && (
              <button className="btn-plain" aria-label={`Delete ${p.name}`}
                onClick={() => setConfirmDelete(p)}><IconTrash /></button>
            )}
          </div>
        ))}

        <div className="section-header" style={{ margin: '10px 4px 2px' }}>Add a built-in split</div>
        <button className="btn-gray block" onClick={() => addPreset(pplProgram)}>
          Push, Pull, Legs
        </button>
        <button className="btn-gray block" onClick={() => addPreset(pplulProgram)}>
          Push, Pull, Legs, Upper, Lower
        </button>
        <p className="t-caption label-3">
          Each split is a copy you can edit. History follows the exercise, not the split.
        </p>
      </div>

      {confirmDelete && (
        <Sheet title={`Delete "${confirmDelete.name}"?`} onClose={() => setConfirmDelete(null)}>
          <div className="stack">
            <p className="t-footnote label-2">Its days go. Logged workouts stay.</p>
            <button className="btn-tinted destructive block"
              onClick={() => { dispatch({ type: 'deleteProgram', programId: confirmDelete.id }); setConfirmDelete(null) }}>
              Delete split
            </button>
            <button className="btn-gray block" onClick={() => setConfirmDelete(null)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </Sheet>
  )
}

/* ------------------------------------------------------------------ *
 *  Day editor
 * ------------------------------------------------------------------ */
const TemplateEditor = ({
  programId, dayId, template, index, count,
}: {
  programId: string
  dayId: string
  template: ExerciseTemplate
  index: number
  count: number
}) => {
  const catalog = useAppSelector((s) => s.catalog)
  const name = catalog[template.exerciseId]?.name ?? 'Unknown exercise'
  const patch = (p: Partial<Omit<ExerciseTemplate, 'id'>>) =>
    dispatch({ type: 'updateTemplate', programId, dayId, templateId: template.id, patch: p })

  const stepRow = (
    label: string,
    value: number,
    set: (v: number) => void,
    step = 1,
    min = 1,
  ) => (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span className="t-footnote label-2">{label}</span>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn-plain" aria-label={`Decrease ${label}`}
          onClick={() => set(Math.max(min, value - step))}>−</button>
        <span className="num" style={{ minWidth: 44, textAlign: 'center', fontWeight: 700 }}>
          {label === 'Rest' ? fmtClock(value) : value}
        </span>
        <button className="btn-plain" aria-label={`Increase ${label}`}
          onClick={() => set(value + step)}>+</button>
      </div>
    </div>
  )

  return (
    <section className="group">
      <div className="ex-head" style={{ marginBottom: 8 }}>
        <span className="ex-name" style={{ fontSize: 16 }}>{name}</span>
        <button className="btn-plain" aria-label={`Move ${name} up`} disabled={index === 0}
          onClick={() => dispatch({ type: 'moveTemplate', programId, dayId, templateId: template.id, delta: -1 })}>↑</button>
        <button className="btn-plain" aria-label={`Move ${name} down`} disabled={index === count - 1}
          onClick={() => dispatch({ type: 'moveTemplate', programId, dayId, templateId: template.id, delta: 1 })}>↓</button>
        <button className="btn-plain danger" aria-label={`Delete ${name}`}
          onClick={() => dispatch({ type: 'deleteTemplate', programId, dayId, templateId: template.id })}>
          <IconTrash />
        </button>
      </div>

      <div className="stack" style={{ marginTop: 4 }}>
        {stepRow('Sets', template.sets, (v) => patch({ sets: v }))}
        {stepRow('Rep cap', template.repCap, (v) => patch({ repCap: Math.max(template.repHigh, v) }))}
        {stepRow('Reps from', template.repLow, (v) =>
          patch({ repLow: v, repHigh: Math.max(v, template.repHigh) }))}
        {stepRow('Reps to', template.repHigh, (v) =>
          patch({ repHigh: Math.max(template.repLow, v) }))}
        {stepRow('Rest', template.restSec, (v) => patch({ restSec: v }), 15, 0)}
        <input
          value={template.notes} placeholder="Cue"
          aria-label={`Note for ${name}`}
          onChange={(e) => patch({ notes: e.target.value })}
        />

        <WarmupEditor
          warmups={template.warmups}
          onChange={(warmups) => patch({ warmups })}
          name={name}
        />
      </div>
    </section>
  )
}

/** Warm-up steps, entered as a share of the working weight. */
const WarmupEditor = ({
  warmups, onChange, name,
}: {
  warmups: WarmupStep[]
  onChange: (w: WarmupStep[]) => void
  name: string
}) => {
  const patchStep = (i: number, p: Partial<WarmupStep>) =>
    onChange(warmups.map((w, j) => (j === i ? { ...w, ...p } : w)))

  return (
    <div className="warmup-editor">
      <div className="row">
        <span className="t-footnote label-2">Warm-up</span>
        <span className="spacer" />
        <button
          className="btn-plain t-footnote"
          onClick={() => onChange([...warmups, { pct: 0.5, reps: 8 }])}
        >
          Add step
        </button>
      </div>

      {warmups.length === 0 && (
        <div className="t-footnote label-3">None</div>
      )}

      {warmups.map((w, i) => (
        <div key={i} className="row warmup-row">
          <button className="btn-step" aria-label={`Lower percent of warm-up ${i + 1} for ${name}`}
            onClick={() => patchStep(i, { pct: Math.max(0.1, Math.round((w.pct - 0.05) * 100) / 100) })}>−</button>
          <span className="num warmup-pct">{Math.round(w.pct * 100)}%</span>
          <button className="btn-step" aria-label={`Raise percent of warm-up ${i + 1} for ${name}`}
            onClick={() => patchStep(i, { pct: Math.min(0.95, Math.round((w.pct + 0.05) * 100) / 100) })}>+</button>

          <span className="label-3">×</span>

          <button className="btn-step" aria-label={`Fewer reps in warm-up ${i + 1} for ${name}`}
            onClick={() => patchStep(i, { reps: Math.max(1, w.reps - 1) })}>−</button>
          <span className="num warmup-reps">{w.reps}</span>
          <button className="btn-step" aria-label={`More reps in warm-up ${i + 1} for ${name}`}
            onClick={() => patchStep(i, { reps: w.reps + 1 })}>+</button>

          <span className="spacer" />
          <button className="btn-plain danger t-footnote"
            aria-label={`Remove warm-up ${i + 1} for ${name}`}
            onClick={() => onChange(warmups.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
    </div>
  )
}

const PasteSheet = ({ programId, dayId, onClose }: { programId: string; dayId: string; onClose: () => void }) => {
  const state = useAppSelector((s) => s)
  const program = state.programs.find((p) => p.id === programId)
  const day = program?.days.find((d) => d.id === dayId)
  const defaultRest = state.settings.defaultRestSec
  const [text, setText] = useState(() =>
    day
      ? formatExerciseList(
          day.exercises.map((t) => ({
            name: state.catalog[t.exerciseId]?.name ?? 'Exercise',
            sets: t.sets, repLow: t.repLow, repHigh: t.repHigh,
            restSec: t.restSec, notes: t.notes,
          })),
          defaultRest,
        )
      : '',
  )
  const parsed = useMemo(() => parseExerciseList(text, defaultRest), [text, defaultRest])

  const apply = () => {
    const catalog = { ...state.catalog }
    const templates: ExerciseTemplate[] = parsed.map((p) => {
      const exercise = resolveExercise(catalog, p.name, state.settings.unit)
      if (!catalog[exercise.id]) {
        catalog[exercise.id] = exercise
        dispatch({ type: 'upsertCatalog', exercise })
      }
      return {
        id: uid(),
        exerciseId: exercise.id,
        sets: p.sets, repLow: p.repLow, repHigh: p.repHigh,
        repCap: p.repHigh + 5,
        restSec: p.restSec, warmups: [], notes: p.notes,
      }
    })
    dispatch({ type: 'setDayTemplates', programId, dayId, templates })
    onClose()
  }

  return (
    <Sheet title="Paste exercise list" onClose={onClose}>
      <div className="stack">
        <p className="t-footnote label-2">
          One exercise per line, like <code>Bench Press 3x6-8 (rest 3 min)</code>.
        </p>
        <textarea
          rows={10} autoFocus value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'Barbell Bench Press 3x6-8 (rest 3 min)\nIncline Dumbbell Press 3x8-10\nCable Fly 2x12-15'}
        />
        <div className="t-footnote label-2">
          {parsed.length} exercise{parsed.length === 1 ? '' : 's'} recognised
          {parsed.length > 0 &&
            `: ${parsed
              .map((e) => `${e.name} ${e.sets}×${e.repLow === e.repHigh ? e.repLow : `${e.repLow}-${e.repHigh}`}`)
              .join(' · ')}`}
        </div>
        <button className="btn-filled block" disabled={parsed.length === 0} onClick={apply}>
          Replace day with these {parsed.length}
        </button>
        <button className="btn-gray block" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  )
}

const AddTemplateSheet = ({ programId, dayId, onClose }: { programId: string; dayId: string; onClose: () => void }) => {
  const catalog = useAppSelector((s) => s.catalog)
  const [name, setName] = useState('')
  const names = useMemo(
    () => Object.values(catalog).filter((e) => !e.archived).map((e) => e.name).sort((a, b) => a.localeCompare(b)),
    [catalog],
  )
  const query = name.trim().toLowerCase()
  const matches = query ? names.filter((n) => n.toLowerCase().includes(query)).slice(0, 6) : []

  const add = (chosen: string) => {
    if (!chosen.trim()) return
    act.addTemplate(programId, dayId, chosen.trim())
    onClose()
  }

  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <div className="stack">
        <input autoFocus value={name} placeholder="Search or type a new exercise"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(name) }} />
        {matches.map((m) => (
          <button key={m} className="row-item" onClick={() => add(m)}>
            <span style={{ flex: 1 }}>{m}</span>
            <span className="chevron">＋</span>
          </button>
        ))}
        <button className="btn-filled block" onClick={() => add(name)} disabled={!name.trim()}>
          Add{name.trim() ? ` "${name.trim()}"` : ''}
        </button>
      </div>
    </Sheet>
  )
}

export const DayEditor = ({ dayId }: { dayId: string }) => {
  const programs = useAppSelector((s) => s.programs)
  const program = programs.find((p) => p.days.some((d) => d.id === dayId))
  const day = program?.days.find((d) => d.id === dayId)
  const [pasting, setPasting] = useState(false)
  const [addingEx, setAddingEx] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!program || !day) {
    return (
      <main className="main">
        <div className="empty">That day no longer exists.</div>
      </main>
    )
  }

  return (
    <>
      <header className="topbar">
        <button className="btn-plain" aria-label="Back" onClick={back}><IconBack /></button>
        <h1>Edit day</h1>
        <button className="btn-plain" onClick={() => setPasting(true)}>Paste list</button>
      </header>

      <main className="main">
        <label className="field card tight">
          <span>Day name</span>
          <input value={day.name}
            onChange={(e) => dispatch({ type: 'updateDay', programId: program.id, dayId, patch: { name: e.target.value } })} />
        </label>

        <label className="field card tight">
          <span>Warm-up / day notes</span>
          <textarea rows={3} value={day.notes} placeholder="Warm-up protocol, reminders…"
            onChange={(e) => dispatch({ type: 'updateDay', programId: program.id, dayId, patch: { notes: e.target.value } })} />
        </label>

        {day.exercises.length === 0 && (
          <div className="empty">
            Nothing here yet.
            <div style={{ marginTop: 12 }}>
              <button className="btn-filled" onClick={() => setPasting(true)}>Paste a workout list</button>
            </div>
          </div>
        )}

        {day.exercises.map((t, i) => (
          <TemplateEditor key={t.id} programId={program.id} dayId={dayId}
            template={t} index={i} count={day.exercises.length} />
        ))}

        <button className="btn-gray block" onClick={() => setAddingEx(true)}>+ Add exercise</button>
        <button className="btn-tinted destructive block" style={{ marginTop: 10 }} onClick={() => setConfirmDelete(true)}>
          Delete this day
        </button>
      </main>

      {pasting && <PasteSheet programId={program.id} dayId={dayId} onClose={() => setPasting(false)} />}
      {addingEx && <AddTemplateSheet programId={program.id} dayId={dayId} onClose={() => setAddingEx(false)} />}

      {confirmDelete && (
        <Sheet title={`Delete "${day.name}"?`} onClose={() => setConfirmDelete(false)}>
          <div className="stack">
            <p className="t-footnote label-2">Saved workouts stay in your history.</p>
            <button className="btn-tinted destructive block"
              onClick={() => { dispatch({ type: 'deleteDay', programId: program.id, dayId }); navigate('/program') }}>
              Delete day
            </button>
            <button className="btn-gray block" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
