import { useCallback, useEffect, useState } from 'react'

const read = () => window.location.hash.replace(/^#/, '') || '/'

/** Tab switch: replaces the entry so back never walks through tabs. */
export const switchTab = (path: string) => {
  if (read() === path) return
  const url = new URL(window.location.href)
  url.hash = path
  window.history.replaceState(window.history.state, '', url)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** Drill-in: pushes an entry so hardware back returns to the parent. */
export const navigate = (path: string) => {
  if (read() !== path) window.location.hash = path
}

export const back = () => window.history.back()

/** Minimal hash router: keeps the browser/Android back button working
 *  without pulling in a routing library. */
export const useRoute = (): string[] => {
  const [path, setPath] = useState(read)
  const sync = useCallback(() => setPath(read()), [])

  useEffect(() => {
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [sync])

  return path.split('/').filter(Boolean)
}

/* ------------------------------------------------------------------ *
 * Sheet/back integration: each open sheet pushes a history entry, so
 * the hardware back gesture closes the sheet instead of leaving the
 * screen. Closing programmatically pops that entry to stay consistent.
 * ------------------------------------------------------------------ */

let sheetSerial = 0

export const useSheetHistory = (onClose: () => void): (() => void) => {
  const [token] = useState(() => `sheet-${++sheetSerial}`)

  useEffect(() => {
    window.history.pushState({ sheet: token }, '')
    let closedByPop = false
    const onPop = () => {
      closedByPop = true
      onClose()
    }
    window.addEventListener('popstate', onPop, { once: true })
    return () => {
      window.removeEventListener('popstate', onPop)
      // Unmounted by a programmatic close: consume our history entry.
      if (!closedByPop && window.history.state?.sheet === token) {
        window.history.back()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return onClose
}
