import { useEffect, useRef, useState } from 'react'
import { useAppSelector, dispatch } from '../store/store'
import { aggregateSleep } from '../lib/sleep'
import type { SleepInterval } from '../lib/sleep'
import { plural } from '../lib/util'

type Progress =
  | { phase: 'idle' }
  | { phase: 'reading'; pct: number | null }
  | { phase: 'done'; nights: number }
  | { phase: 'error'; message: string }

/**
 * Apple Health import: Health app → profile picture → "Export All Health
 * Data" → share the zip here. Parsed in a Web Worker so a 500MB export
 * doesn't freeze the UI; only sleep records ever leave the worker.
 */
export const SleepImportCard = () => {
  const sleepCount = useAppSelector((s) => s.sleep.length)
  const fileRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const [progress, setProgress] = useState<Progress>({ phase: 'idle' })

  useEffect(() => () => workerRef.current?.terminate(), [])

  const onFile = (file: File | undefined) => {
    if (!file) return
    setProgress({ phase: 'reading', pct: null })
    workerRef.current?.terminate()
    const worker = new Worker(
      new URL('../workers/healthImport.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker
    worker.onmessage = (
      e: MessageEvent<
        | { kind: 'progress'; bytesRead: number; totalBytes: number }
        | { kind: 'done'; records: SleepInterval[] }
        | { kind: 'error'; message: string }
      >,
    ) => {
      const msg = e.data
      if (msg.kind === 'progress') {
        setProgress({
          phase: 'reading',
          pct: msg.totalBytes > 0 ? Math.round((msg.bytesRead / msg.totalBytes) * 100) : null,
        })
      } else if (msg.kind === 'done') {
        const entries = aggregateSleep(msg.records)
        if (entries.length > 0) dispatch({ type: 'upsertSleep', entries })
        setProgress({ phase: 'done', nights: entries.length })
        worker.terminate()
      } else {
        setProgress({ phase: 'error', message: msg.message })
        worker.terminate()
      }
    }
    worker.onerror = () => {
      setProgress({ phase: 'error', message: 'That file could not be read' })
      worker.terminate()
    }
    worker.postMessage({ file })
  }

  return (
    <div className="group stack" style={{ padding: 14 }}>
      <p className="t-caption label-3">
        {sleepCount > 0 ? `${plural(sleepCount, 'night')} on record` : 'No sleep on record yet'}
      </p>
      <button
        className="btn-gray block"
        disabled={progress.phase === 'reading'}
        onClick={() => fileRef.current?.click()}
      >
        {progress.phase === 'reading'
          ? `Reading… ${progress.pct !== null ? `${progress.pct}%` : ''}`
          : 'Import from Health'}
      </button>
      <input
        ref={fileRef} type="file" accept=".zip,.xml,application/zip,text/xml" hidden
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }}
      />
      {progress.phase === 'done' && (
        <p className="t-subhead" style={{ color: 'var(--accent)' }}>
          {progress.nights > 0
            ? `Imported ${plural(progress.nights, 'night')} of sleep`
            : 'No sleep records found in that file'}
        </p>
      )}
      {progress.phase === 'error' && (
        <p className="t-subhead" style={{ color: 'var(--danger)' }}>{progress.message}</p>
      )}
    </div>
  )
}
