import { useEffect, useState } from 'react'

/**
 * A ticking clock for the few components that render elapsed/remaining time.
 * Re-syncs on visibilitychange so a sleeping phone snaps to the correct value
 * the moment the screen wakes. Only mount this in leaf components — each
 * mount is its own interval.
 */
export const useNow = (intervalMs = 1000): number => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [intervalMs])

  return now
}
