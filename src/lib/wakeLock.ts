import { useEffect } from 'react'

type Sentinel = { released: boolean; release: () => Promise<void> }
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<Sentinel> }
}

/**
 * Holds the screen awake while you train. iOS drops the lock whenever the tab
 * goes to the background, so it is taken again on the way back.
 */
export const useWakeLock = (active: boolean) => {
  useEffect(() => {
    const api = (navigator as WakeLockNavigator).wakeLock
    if (!active || !api) return

    let sentinel: Sentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        sentinel = await api.request('screen')
      } catch {
        // Denied or unsupported: the workout carries on regardless.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => undefined)
    }
  }, [active])
}
