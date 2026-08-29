import { useRef, useState, useSyncExternalStore } from 'react'
import { useAppSelector, dispatch, getStore } from '../store/store'
import { Sheet } from '../components/Sheet'
import { downloadFile } from '../lib/download'
import { decodeV2, freshState } from '../store/migrate'
import { isStorageHealthy, persistAll, subscribeStorageHealth } from '../store/persist'
import { fmtClock } from '../lib/util'
import type { Unit } from '../types'
import { SleepImportCard } from './SleepImport'

const useStorageHealthy = () =>
  useSyncExternalStore(subscribeStorageHealth, isStorageHealthy)

export const SettingsScreen = () => {
  const settings = useAppSelector((s) => s.settings)
  const healthy = useStorageHealthy()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const exportBackup = () => {
    // Export a clean snapshot: no in-flight session pointer, so restoring on
    // another device doesn't resurrect a stale live workout.
    const state = { ...getStore().getState(), activeSessionId: null, rest: null }
    downloadFile(
      `gym-app-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(state, null, 2),
    )
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const state = decodeV2(JSON.parse(await file.text()))
      dispatch({ type: 'replaceState', state })
      persistAll(state)
      setMessage('Backup restored.')
    } catch {
      setMessage("That file couldn't be read as a Gym App backup.")
    }
  }

  const bump = (patch: { defaultRestSec?: number; weightStep?: number }) =>
    dispatch({ type: 'setSettings', patch })

  return (
    <>
      <header className="topbar"><h1>Settings</h1></header>

      <main className="main">
        {!healthy && (
          <div className="storage-warning" role="alert">
            Storage is full or blocked — changes are NOT being saved. Export a backup now, then
            free up space (or leave private browsing).
          </div>
        )}

        <div className="section-title">Training</div>
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

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small muted">Weight step (tape snap)</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm" aria-label="Decrease weight step"
                onClick={() => bump({ weightStep: Math.max(0.25, settings.weightStep - 0.25) })}>−</button>
              <span className="num" style={{ minWidth: 48, textAlign: 'center', fontWeight: 700 }}>
                {settings.weightStep}
              </span>
              <button className="btn sm" aria-label="Increase weight step"
                onClick={() => bump({ weightStep: settings.weightStep + 0.25 })}>+</button>
            </div>
          </div>

          <p className="tiny faint">
            Changing the unit relabels entries; it doesn't convert numbers you've already logged.
          </p>
        </div>

        <div className="section-title">Rest timer</div>
        <div className="card tight stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small muted">Default rest</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm" aria-label="Decrease default rest"
                onClick={() => bump({ defaultRestSec: Math.max(15, settings.defaultRestSec - 15) })}>−</button>
              <span className="num" style={{ minWidth: 52, textAlign: 'center', fontWeight: 700 }}>
                {fmtClock(settings.defaultRestSec)}
              </span>
              <button className="btn sm" aria-label="Increase default rest"
                onClick={() => bump({ defaultRestSec: settings.defaultRestSec + 15 })}>+</button>
            </div>
          </div>
          <label className="row">
            <input type="checkbox" style={{ width: 20, height: 20 }} checked={settings.autoStartTimer}
              onChange={(e) => dispatch({ type: 'setSettings', patch: { autoStartTimer: e.target.checked } })} />
            <span className="small">Start the timer when I complete a set</span>
          </label>
          <label className="row">
            <input type="checkbox" style={{ width: 20, height: 20 }} checked={settings.tickSound}
              onChange={(e) => dispatch({ type: 'setSettings', patch: { tickSound: e.target.checked } })} />
            <span className="small">Tick sounds on the tape input</span>
          </label>
        </div>

        <div className="section-title">Sleep</div>
        <SleepImportCard />

        <div className="section-title">Your data</div>
        <div className="card tight stack">
          <p className="tiny faint">
            Everything is stored on this device only — nothing is uploaded. Clearing the browser's
            site data erases it, so export a backup now and then.
          </p>
          <button className="btn block" onClick={exportBackup}>Export backup (.json)</button>
          <button className="btn block" onClick={() => fileRef.current?.click()}>Import backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
          <button className="btn block danger" onClick={() => setConfirmReset(true)}>
            Erase everything
          </button>
        </div>

        <p className="tiny faint" style={{ textAlign: 'center', margin: '20px 0' }}>
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
            <p className="small muted">
              Every logged workout, sleep entry and program edit on this device is deleted, and the
              app starts over with the built-in program.
            </p>
            <button className="btn danger block"
              onClick={() => {
                const state = freshState()
                dispatch({ type: 'replaceState', state })
                persistAll(state)
                setConfirmReset(false)
              }}>
              Erase and start over
            </button>
            <button className="btn ghost block" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
