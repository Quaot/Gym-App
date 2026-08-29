import { useCallback, useEffect, useState } from 'react'

const read = () => window.location.hash.replace(/^#/, '') || '/'

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
    return () => window.removeEventListener('hashchange', sync)
  }, [sync])

  return path.split('/').filter(Boolean)
}
