import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hash router, small enough to read in one sitting.
 *
 * Three things it has to get right, all of which it used to get wrong:
 *   1. What sits underneath a back swipe is the entry you will actually land
 *      on, not a guess from the shape of the path.
 *   2. An open sheet owns exactly one history entry, however many sheets are
 *      stacked, so back closes the presentation and the stack stays level.
 *   3. Navigating out of a sheet closes it first, so its entry is never left
 *      orphaned in the middle of the stack.
 */

const read = (): string => window.location.hash.replace(/^#/, '') || '/'

const hashUrl = (path: string): string => {
  const url = new URL(window.location.href)
  url.hash = path
  return url.toString()
}

const ROUTE_EVENT = 'gym:route'
const emit = () => window.dispatchEvent(new Event(ROUTE_EVENT))

/* ------------------------------------------------------------------ *
 * The path stack. `back()` follows history, so the screen shown under a
 * swipe has to come from history too.
 * ------------------------------------------------------------------ */

let stack: string[] = [read()]

const trackPush = (path: string) => {
  stack = [...stack, path]
}

const trackReplace = (path: string) => {
  stack = [...stack.slice(0, -1), path]
}

/** Reconciles the stack after a pop, which may have skipped several entries. */
const trackPop = (path: string) => {
  const i = stack.lastIndexOf(path)
  stack = i >= 0 ? stack.slice(0, i + 1) : [path]
}

/** The entry back() will land on, or null at the root of the stack. */
export const previousPath = (): string | null =>
  stack.length > 1 ? stack[stack.length - 2] : null

/** Test seam: the stack as it stands. */
export const historyStack = (): string[] => [...stack]

/* ------------------------------------------------------------------ *
 * Sheets. The whole stack of them shares one history entry, so back
 * dismisses the presentation the way it does on iOS.
 * ------------------------------------------------------------------ */

interface OpenSheet {
  id: number
  close: () => void
}

let sheets: OpenSheet[] = []
let serial = 0
/** Sheets already torn off the stack by a pop, which must not pop again. */
let popCredits = 0
let pendingNav: { path: string; replace: boolean } | null = null
let pendingTimer = 0

const modalEntryLive = (): boolean =>
  Boolean((window.history.state as { modal?: boolean } | null)?.modal)

const openSheet = (sheet: OpenSheet) => {
  sheets = [...sheets, sheet]
  if (sheets.length === 1) window.history.pushState({ modal: true }, '')
}

const closeSheet = (id: number) => {
  sheets = sheets.filter((s) => s.id !== id)
  const popped = popCredits > 0
  if (popped) popCredits--
  if (sheets.length > 0) return
  // Back already removed the entry; otherwise ours is still the current one.
  if (!popped && modalEntryLive()) window.history.back()
  else runPendingNav()
}

/** Closes every open sheet, newest first. */
const dismissSheets = () => {
  for (const sheet of [...sheets].reverse()) sheet.close()
}

const runPendingNav = () => {
  const next = pendingNav
  if (!next) return
  pendingNav = null
  if (pendingTimer) {
    window.clearTimeout(pendingTimer)
    pendingTimer = 0
  }
  if (next.replace) replaceTo(next.path)
  else pushTo(next.path)
}

const pushTo = (path: string) => {
  window.history.pushState({}, '', hashUrl(path))
  trackPush(path)
  emit()
}

const replaceTo = (path: string) => {
  // State is cleared deliberately: a sheet's modal flag must never survive a
  // tab change, or the sheet would pop an entry that is no longer its own.
  window.history.replaceState(null, '', hashUrl(path))
  trackReplace(path)
  emit()
}

/** Waits for the sheets to close, then navigates. Never leaves an orphan. */
const afterSheets = (path: string, replace: boolean) => {
  pendingNav = { path, replace }
  dismissSheets()
  // A sheet that ignores its close callback must not strand the navigation.
  pendingTimer = window.setTimeout(runPendingNav, 400)
}

/**
 * Replaces the current entry, so back skips the screen you are leaving. Used
 * by the tabs, and by anything that deletes what the current screen shows.
 */
export const replaceRoute = (path: string) => {
  if (read() === path && sheets.length === 0) return
  if (sheets.length > 0) return afterSheets(path, true)
  replaceTo(path)
}

/** Tab switch: replaces the entry so back never walks through tabs. */
export const switchTab = replaceRoute

/** Drill in: pushes an entry so hardware back returns to the parent. */
export const navigate = (path: string) => {
  if (read() === path && sheets.length === 0) return
  if (sheets.length > 0) return afterSheets(path, false)
  pushTo(path)
}

export const back = () => window.history.back()

/* ------------------------------------------------------------------ *
 * One popstate listener for the whole app, installed once.
 * ------------------------------------------------------------------ */

let installed = false

const installPopHandler = () => {
  if (installed) return
  installed = true
  window.addEventListener('popstate', () => {
    if (!modalEntryLive() && sheets.length > 0) {
      // Back with a sheet up dismisses the presentation, not the screen.
      const open = [...sheets].reverse()
      popCredits = open.length
      for (const sheet of open) sheet.close()
      return
    }
    trackPop(read())
    runPendingNav()
    emit()
  })
  window.addEventListener('hashchange', () => {
    // A hash typed or restored by the browser, outside our own calls.
    if (stack[stack.length - 1] !== read()) trackPop(read())
    emit()
  })
}

/** Minimal hash router: keeps the browser and Android back button working
 *  without pulling in a routing library. */
export const useRoute = (): string[] => {
  const [path, setPath] = useState(read)
  const sync = useCallback(() => setPath(read()), [])

  useEffect(() => {
    installPopHandler()
    window.addEventListener(ROUTE_EVENT, sync)
    return () => window.removeEventListener(ROUTE_EVENT, sync)
  }, [sync])

  return path.split('/').filter(Boolean)
}

/**
 * Sheet integration. The sheet registers itself; the first one on screen
 * pushes the single modal entry, and the last one off consumes it.
 */
export const useSheetHistory = (onClose: () => void): (() => void) => {
  const [id] = useState(() => ++serial)

  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    installPopHandler()
    openSheet({ id, close: () => closeRef.current() })
    return () => closeSheet(id)
  }, [id])

  return onClose
}

/** Test seam: how many sheets the router believes are open. */
export const openSheetCount = (): number => sheets.length

/** Test seam: resets module state between cases. */
export const resetRouter = () => {
  stack = [read()]
  sheets = []
  pendingNav = null
  popCredits = 0
}
