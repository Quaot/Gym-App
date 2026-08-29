import type { SleepInterval } from '../lib/sleep'

/**
 * Incremental scanner for Apple Health's export.xml. The file can run to
 * hundreds of MB, so it is fed chunk by chunk and never materialized: each
 * call returns the sleep records completed by this chunk and the unfinished
 * tail to prepend to the next one.
 */

const RECORD_RE = /<Record\b[^>]*type="HKCategoryTypeIdentifierSleepAnalysis"[^>]*\/>/g
const ATTR = (name: string, tag: string): string | null => {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return m ? m[1] : null
}

/** Apple exports dates like "2026-08-28 23:04:16 +0100". */
export const parseHealthDate = (raw: string): number | null => {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?$/)
  if (!m) {
    const t = Date.parse(raw)
    return Number.isNaN(t) ? null : t
  }
  const [, y, mo, d, h, mi, s, tz] = m
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : ''}`
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

export interface ScanState {
  tail: string
}

export const initialScanState = (): ScanState => ({ tail: '' })

export const scanChunk = (
  state: ScanState,
  chunk: string,
): { records: SleepInterval[]; state: ScanState } => {
  const text = state.tail + chunk
  const records: SleepInterval[] = []

  let lastEnd = 0
  RECORD_RE.lastIndex = 0
  for (let m = RECORD_RE.exec(text); m !== null; m = RECORD_RE.exec(text)) {
    const tag = m[0]
    lastEnd = m.index + tag.length
    const value = ATTR('value', tag)
    const startRaw = ATTR('startDate', tag)
    const endRaw = ATTR('endDate', tag)
    if (!value || !startRaw || !endRaw) continue
    const start = parseHealthDate(startRaw)
    const end = parseHealthDate(endRaw)
    if (start === null || end === null) continue
    records.push({
      start,
      end,
      value,
      sourceName: ATTR('sourceName', tag) ?? undefined,
    })
  }

  // Keep any possibly-unfinished trailing tag for the next chunk; cap the
  // tail so pathological input can't grow it without bound.
  const remaining = text.slice(lastEnd)
  const lastOpen = remaining.lastIndexOf('<')
  const tail = lastOpen >= 0 ? remaining.slice(lastOpen) : ''
  return { records, state: { tail: tail.length > 4096 ? '' : tail } }
}
