import { useRef, useState } from 'react'
import { useStore } from '../store'
import { Sheet } from '../components/Sheet'
import { NumberField } from '../components/NumberField'
import { exportJSON, importJSON } from '../lib/storage'
import { initialState } from '../lib/defaults'
import type { Unit } from '../types'

export const SettingsScreen = () => {
  const { state, dispatch } = useStore()
  const { settings } = state
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const download = () => {
    const blob = new Blob([exportJSON(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gym-app-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      dispatch({ type: 'replaceState', state: importJSON(await file.text()) })
      setMessage('Backup restored.')
    } catch {
      setMessage("That file couldn't be read as a Gym App backup.")
    }
  }

  return (
    <>
      <header className="topbar"><h1>Settings</h1></header>

      <main className="main">
        <div className="section-title">Units</div>
        <div className="card tight stack">
          <label className="field">
            <span>Weight unit</span>
            <select
              value={settings.unit}
              onChange={(e) => dispatch({ type: 'setSettings', patch: { unit: e.target.value as Unit } })}
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </select>
          </label>
          <label className="field">
            <span>Weight step for + / − buttons</span>
            <NumberField ariaLabel="Weight step" decimal value={settings.weightStep} step={0.5} min={0.5}
              onChange={(v) => dispatch({ type: 'setSettings', patch: { weightStep: v ?? 2.5 } })} />
          </label>
          <p className="tiny muted">Changing the unit relabels entries; it doesn't convert numbers you've already logged.</p>
        </div>

        <div className="section-title">Rest timer</div>
        <div className="card tight stack">
          <label className="field">
            <span>Default rest (seconds)</span>
            <NumberField ariaLabel="Default rest seconds" value={settings.defaultRestSec} step={15} min={0}
              onChange={(v) => dispatch({ type: 'setSettings', patch: { defaultRestSec: Math.round(v ?? 0) } })} />
          </label>
          <label className="row">
            <input type="checkbox" style={{ width: 20, height: 20 }} checked={settings.autoStartTimer}
              onChange={(e) => dispatch({ type: 'setSettings', patch: { autoStartTimer: e.target.checked } })} />
            <span className="small">Start the timer automatically when I tick off a set</span>
          </label>
        </div>

        <div className="section-title">Your data</div>
        <div className="card tight stack">
          <p className="tiny muted">
            Everything is stored on this device only — nothing is uploaded. Clearing your browser's site
            data will erase it, so export a backup now and then.
          </p>
          <button className="btn block" onClick={download}>Export backup (.json)</button>
          <button className="btn block" onClick={() => fileRef.current?.click()}>Import backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
          <button className="btn block danger" onClick={() => setConfirmReset(true)}>Erase everything</button>
        </div>

        <p className="tiny muted" style={{ textAlign: 'center', margin: '20px 0' }}>
          Gym App · works offline · add to your home screen
        </p>
      </main>

      {message && (
        <Sheet title="Import" onClose={() => setMessage(null)}>
          <div className="stack">
            <p className="small">{message}</p>
            <button className="btn primary block" onClick={() => setMessage(null)}>OK</button>
          </div>
        </Sheet>
      )}

      {confirmReset && (
        <Sheet title="Erase everything?" onClose={() => setConfirmReset(false)}>
          <div className="stack">
            <p className="small muted">Your program and every logged workout will be deleted from this device.</p>
            <button className="btn danger block"
              onClick={() => { dispatch({ type: 'replaceState', state: initialState() }); setConfirmReset(false) }}>
              Erase
            </button>
            <button className="btn ghost block" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
