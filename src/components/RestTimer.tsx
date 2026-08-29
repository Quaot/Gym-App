import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtClock } from '../lib/util'

let audio: AudioContext | null = null

/** Short double beep at the end of rest. Created on a tap, so the browser
 *  lets it play; silently skipped if audio is unavailable. */
const chime = () => {
  try {
    audio ??= new (window.AudioContext || (window as any).webkitAudioContext)()
    void audio.resume()
    const at = audio.currentTime
    for (const [i, freq] of [880, 1180].entries()) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = freq
      osc.connect(gain).connect(audio.destination)
      gain.gain.setValueAtTime(0.0001, at + i * 0.22)
      gain.gain.exponentialRampToValueAtTime(0.25, at + i * 0.22 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + i * 0.22 + 0.2)
      osc.start(at + i * 0.22)
      osc.stop(at + i * 0.22 + 0.22)
    }
  } catch {
    // No audio in this context — the vibration and the visible timer remain.
  }
}

export interface RestTimer {
  /** Wall-clock ms when rest is up, or null when idle. */
  endsAt: number | null
  remaining: number
  start: (seconds: number) => void
  stop: () => void
  add: (seconds: number) => void
  total: number
}

export const useRestTimer = (): RestTimer => {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [, tick] = useState(0)
  const firedRef = useRef(false)

  // Deadline-based, so it stays correct while the screen is asleep.
  useEffect(() => {
    if (endsAt === null) return
    const id = window.setInterval(() => tick((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [endsAt])

  const remaining = endsAt === null ? 0 : (endsAt - Date.now()) / 1000

  useEffect(() => {
    if (endsAt === null || firedRef.current || remaining > 0) return
    firedRef.current = true
    chime()
    navigator.vibrate?.([200, 100, 200])
  }, [endsAt, remaining])

  const start = useCallback((seconds: number) => {
    firedRef.current = false
    setTotal(seconds)
    setEndsAt(Date.now() + seconds * 1000)
  }, [])

  const stop = useCallback(() => setEndsAt(null), [])

  const add = useCallback((seconds: number) => {
    setEndsAt((prev) => (prev === null ? null : prev + seconds * 1000))
    setTotal((t) => t + seconds)
    firedRef.current = false
  }, [])

  return { endsAt, remaining, start, stop, add, total }
}

export const RestBar = ({ timer }: { timer: RestTimer }) => {
  if (timer.endsAt === null) return null
  const over = timer.remaining <= 0
  const pct = timer.total > 0 ? Math.max(0, Math.min(1, timer.remaining / timer.total)) : 0

  return (
    <div className={`rest-bar${over ? ' overtime' : ''}`}>
      <div className="rest-progress" style={{ width: `${pct * 100}%` }} />
      <span className="time mono">
        {over ? `+${fmtClock(-timer.remaining)}` : fmtClock(timer.remaining)}
      </span>
      <span className="small muted">{over ? 'Rest is up' : 'Resting'}</span>
      <span className="spacer" />
      <button className="btn sm ghost" onClick={() => timer.add(30)}>+30s</button>
      <button className="btn sm" onClick={timer.stop}>Skip</button>
    </div>
  )
}
