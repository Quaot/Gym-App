import { useEffect, useRef, useState } from 'react'
import { useAppSelector, dispatch } from '../store/store'
import { aggregateSleep } from '../lib/sleep'
import type { SleepInterval } from '../lib/sleep'

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
      setProgress({ phase: 'error', message: 'The import crashed — is this a Health export?' })
      worker.terminate()
    }
    worker.postMessage({ file })
  }

  return (
    <div className="card tight stack">
      <p className="tiny faint">
        On your iPhone: Health app → your profile picture → <b>Export All Health Data</b>, then
        open the zip here. Your sleep history is extracted on-device — nothing is uploaded.
        {sleepCount > 0 && ` ${sleepCount} nights on record.`}
      </p>
      <button
        className="btn block"
        disabled={progress.phase === 'reading'}
        onClick={() => fileRef.current?.click()}
      >
        {progress.phase === 'reading'
          ? `Reading… ${progress.pct !== null ? `${progress.pct}%` : ''}`
          : 'Import Apple Health export'}
      </button>
      <input
        ref={fileRef} type="file" accept=".zip,.xml,application/zip,text/xml" hidden
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }}
      />
      {progress.phase === 'done' && (
        <p className="small" style={{ color: 'var(--accent)' }}>
          {progress.nights > 0
            ? `Imported ${progress.nights} nights of sleep.`
            : 'No sleep records found in that file.'}
        </p>
      )}
      {progress.phase === 'error' && (
        <p className="small" style={{ color: 'var(--danger)' }}>{progress.message}</p>
      )}
    </div>
  )
}
