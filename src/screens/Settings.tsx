import { useRef, useState, useSyncExternalStore } from 'react'
import { useAppSelector, dispatch, getStore } from '../store/store'
import { Sheet } from '../components/Sheet'
import { downloadFile } from '../lib/download'
import { decodeV2, freshState } from '../store/migrate'
import { isStorageHealthy, persistAll, subscribeStorageHealth } from '../store/persist'
import { fmtClock } from '../lib/util'
import type { Unit } from '../types'
import { SleepImportCard } from './SleepImport'
import { askForNotifications, notificationsSupported } from '../lib/notify'
import { Screen } from '../app/Screen'
import { navigate } from '../lib/router'
import { generateDemoData, DEMO_PREFIX } from '../lib/demo'
import { InfoPopover } from '../components/InfoPopover'

const useStorageHealthy = () =>
  useSyncExternalStore(subscribeStorageHealth, isStorageHealthy)

/** Alerts for a rest that runs out while you are looking at something else. */
const RestAlerts = () => {
  const [state, setState] = useState(
    notificationsSupported() ? Notification.permission : 'unsupported',
  )
  if (state === 'unsupported') return null
  if (state === 'granted') {
    return <span className="t-footnote label-2">Rest alerts are on</span>
  }
  if (state === 'denied') {
    return (
      <span className="t-footnote label-2">
        Rest alerts are blocked in your browser settings
      </span>
    )
  }
  return (
    <button
      className="btn-gray block"
      onClick={() => { void askForNotifications().then(setState) }}
    >
      Alert me when rest ends
    </button>
  )
}

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
      setMessage('Backup restored')
    } catch {
      setMessage("That file is not a Gym App backup")
    }
  }

  const bump = (patch: { defaultRestSec?: number; weightStep?: number }) =>
    dispatch({ type: 'setSettings', patch })

  return (
    <Screen
      id="settings"
      title="Settings"
      large
      blurb="Units, rest and your data. Start with How this works if anything in the app is unclear"
    >
        <div className="section-header">Help</div>
        <div className="group">
          <button className="row-item" onClick={() => navigate('/settings/guide')}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>How this works</div>
              <div className="t-footnote label-2">
                Every number the app fills in, and where it comes from
              </div>
            </div>
            <span className="chevron">›</span>
          </button>
        </div>

        {!healthy && (
          <div className="warning" role="alert">
            Storage is full and nothing is saving, so export a backup and free up space
          </div>
        )}

        <div className="section-header">Training</div>
        <div className="group stack" style={{ padding: 14 }}>
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
            <span className="t-footnote label-2">Weight step</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn-step" aria-label="Decrease weight step"
                onClick={() => bump({ weightStep: Math.max(0.25, settings.weightStep - 0.25) })}>−</button>
              <span className="num" style={{ minWidth: 48, textAlign: 'center', fontWeight: 700 }}>
                {settings.weightStep}
              </span>
              <button className="btn-step" aria-label="Increase weight step"
                onClick={() => bump({ weightStep: settings.weightStep + 0.25 })}>+</button>
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <InfoPopover content="Used to size jumps on pull-ups and dips, where the plates are only part of the load">
              <span className="t-footnote label-2">Bodyweight</span>
            </InfoPopover>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn-step" aria-label="Lower bodyweight"
                onClick={() => dispatch({ type: 'setSettings', patch: { bodyweight: Math.max(0, settings.bodyweight - 5) } })}>−</button>
              <span className="num" style={{ minWidth: 52, textAlign: 'center', fontWeight: 600 }}>
                {settings.bodyweight}
              </span>
              <button className="btn-step" aria-label="Raise bodyweight"
                onClick={() => dispatch({ type: 'setSettings', patch: { bodyweight: settings.bodyweight + 5 } })}>+</button>
            </div>
          </div>
        </div>

        <div className="section-header">Rest timer</div>
        <div className="group stack" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="t-footnote label-2">Default rest</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn-step" aria-label="Decrease default rest"
                onClick={() => bump({ defaultRestSec: Math.max(15, settings.defaultRestSec - 15) })}>−</button>
              <span className="num" style={{ minWidth: 52, textAlign: 'center', fontWeight: 700 }}>
                {fmtClock(settings.defaultRestSec)}
              </span>
              <button className="btn-step" aria-label="Increase default rest"
                onClick={() => bump({ defaultRestSec: settings.defaultRestSec + 15 })}>+</button>
            </div>
          </div>
          <label className="row switch-row">
            <span className="t-subhead">Start on set completion</span>
            <input type="checkbox" className="switch" checked={settings.autoStartTimer}
              onChange={(e) => dispatch({ type: 'setSettings', patch: { autoStartTimer: e.target.checked } })} />
          </label>
          <label className="row switch-row">
            <span className="t-subhead">Tick sounds</span>
            <input type="checkbox" className="switch" checked={settings.tickSound}
              onChange={(e) => dispatch({ type: 'setSettings', patch: { tickSound: e.target.checked } })} />
          </label>
          <RestAlerts />
        </div>

        <div className="section-header">Sleep</div>
        <SleepImportCard />

        <div className="section-header">Sample data</div>
        <div className="group stack" style={{ padding: 14 }}>
          <p className="t-caption label-3">
            Sixteen weeks of realistic workouts and sleep, for trying the app out
          </p>
          <button className="btn-gray block"
            onClick={() => {
              const state = getStore().getState()
              const { sessions, sleep } = generateDemoData(state)
              dispatch({ type: 'addSessions', sessions })
              dispatch({ type: 'upsertSleep', entries: sleep })
            }}>
            Add sample data
          </button>
          <button className="btn-tinted destructive block"
            onClick={() => dispatch({ type: 'removeTagged', prefix: DEMO_PREFIX })}>
            Remove sample data
          </button>
        </div>

        <div className="section-header">Your data</div>
        <div className="group stack" style={{ padding: 14 }}>
          <p className="t-caption label-3">
            Everything stays on this device, and clearing site data erases it
          </p>
          <button className="btn-gray block" onClick={exportBackup}>Export backup</button>
          <button className="btn-gray block" onClick={() => fileRef.current?.click()}>Import backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
          <button className="btn-tinted destructive block" onClick={() => setConfirmReset(true)}>
            Erase everything
          </button>
        </div>

        <p className="t-caption label-3" style={{ textAlign: 'center', margin: '20px 0' }}>
          Works offline
        </p>
      {message && (
        <Sheet title="Import" onClose={() => setMessage(null)}>
          <div className="stack">
            <p className="t-subhead">{message}</p>
            <button className="btn-filled block" onClick={() => setMessage(null)}>OK</button>
          </div>
        </Sheet>
      )}

      {confirmReset && (
        <Sheet title="Erase everything?" onClose={() => setConfirmReset(false)}>
          <div className="stack">
            <p className="t-footnote label-2">
              Deletes every workout, sleep entry and program edit on this device
            </p>
            <button className="btn-tinted destructive block"
              onClick={() => {
                const state = freshState()
                dispatch({ type: 'replaceState', state })
                persistAll(state)
                setConfirmReset(false)
              }}>
              Erase and start over
            </button>
            <button className="btn-gray block" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </Screen>
  )
}
