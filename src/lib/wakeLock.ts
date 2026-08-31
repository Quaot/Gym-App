import { useEffect } from 'react'
import { isNative } from './native'

type Sentinel = { released: boolean; release: () => Promise<void> }
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<Sentinel> }
}

// The module, not the plugin: a Capacitor plugin proxy answers `then` with a
// method call, so a promise resolving to one adopts it as a thenable and calls
// `KeepAwake.then()`. Reaching through the module keeps it out of that seat.
const keepAwake = () => import('@capacitor-community/keep-awake')

/**
 * Holds the screen awake while you train.
 *
 * The native shell asks iOS directly and the answer holds until it is given
 * back, so there is nothing to reacquire. In a browser the lock is dropped
 * whenever the tab goes to the background, so it is taken again on the way
 * back.
 */
export const useWakeLock = (active: boolean) => {
  useEffect(() => {
    if (!active) return

    if (isNative()) {
      void keepAwake().then(({ KeepAwake }) => KeepAwake.keepAwake()).catch(() => undefined)
      return () => {
        void keepAwake().then(({ KeepAwake }) => KeepAwake.allowSleep()).catch(() => undefined)
      }
    }

    const api = (navigator as WakeLockNavigator).wakeLock
    if (!api) return

    let sentinel: Sentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        const held = await api.request('screen')
        // The workout can end while the request is in flight; releasing it
        // here is the difference between a dark screen and a dead battery.
        if (cancelled) void held.release().catch(() => undefined)
        else sentinel = held
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
