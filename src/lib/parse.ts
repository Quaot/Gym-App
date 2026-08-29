/** An exercise line as parsed from pasted text — identity-free; callers map
 *  names onto the catalog. */
export interface ParsedExercise {
  name: string
  sets: number
  repLow: number
  repHigh: number
  restSec: number
  notes: string
}

/** Matches the "3x8-10" / "3 × 8" / "3 sets x 8" tail of a programmed line. */
const SETS_RE = /(\d+)\s*(sets?)?\s*[x×]\s*(\d+)\s*(?:[-–—]|\s*to\s*)?\s*(\d+)?/i
/** A set count above this without an explicit "sets" keyword reads as a
 *  weight — "100x5" is 100 kg for 5, not 100 sets of 5. */
const MAX_IMPLICIT_SETS = 12
const UNIT = '(s|sec|secs|seconds|m|min|mins|minutes)'
/** "rest 3 min", "rest: 90s" — an explicit rest instruction anywhere in the text. */
const REST_LABELLED = new RegExp(`rest[:\\s]*(\\d+(?:\\.\\d+)?)\\s*${UNIT}?\\b`, 'i')
/** A parenthetical that is nothing but a duration, e.g. "(90s)" or "(3 min)". */
const REST_BARE = new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\s*$`, 'i')
const LEAD_RE = /^\s*(?:\d+[.)]|[-*•–—]|\[[ x]?\])\s*/i

const toSeconds = (value: string, unit: string | undefined) => {
  const n = parseFloat(value)
  // A bare "rest 3" means minutes; anything else follows its unit.
  const minutes = unit ? /^m/i.test(unit) : n <= 10
  return Math.round(minutes ? n * 60 : n)
}

/**
 * Pulls a rest time out of a string, returning the text with it removed.
 * Deliberately conservative: a duration only counts as rest if it is labelled
 * "rest", or if it is the entire string — so "(30 sec hold)" stays a note.
 */
const extractRest = (text: string): { restSec: number | null; text: string } => {
  const bare = text.match(REST_BARE)
  if (bare) return { restSec: toSeconds(bare[1], bare[2]), text: '' }

  const m = text.match(REST_LABELLED)
  if (!m) return { restSec: null, text }
  const sec = toSeconds(m[1], m[2])
  if (sec < 5 || sec > 900) return { restSec: null, text }
  return { restSec: sec, text: text.replace(m[0], ' ') }
}

const tidy = (text: string) =>
  text.replace(/\s+/g, ' ').replace(/^[\s:;,._–—-]+/, '').replace(/[\s:;,._–—-]+$/, '').trim()

/** Note text keeps its punctuation — only stray separators are trimmed. */
const tidyNote = (text: string) =>
  text.replace(/\s+/g, ' ').replace(/^[\s:;,]+/, '').replace(/[\s:;,]+$/, '').trim()

/**
 * Turns a pasted workout list into exercises, one per line.
 * Understands lines such as:
 *   "1. Barbell Bench Press — 3x6-8 (rest 3 min)"
 *   "Cable Fly 2 x 12-15 (slow eccentric)"
 *   "Overhead Press"            -> falls back to 3x8-12
 */
export const parseExerciseList = (
  text: string,
  defaultRestSec: number,
): ParsedExercise[] => {
  const out: ParsedExercise[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.replace(LEAD_RE, '').trim()
    if (!line) continue

    let notes = ''
    // A trailing parenthetical becomes the exercise note.
    const paren = line.match(/\(([^)]*)\)\s*$/)
    if (paren) {
      notes = paren[1].trim()
      line = line.slice(0, paren.index).trim()
    }

    // A rest time can sit in the note or in the line itself; either way it
    // drives the timer rather than surviving as text.
    const fromNote = extractRest(notes)
    notes = tidyNote(fromNote.text)
    let restSec = fromNote.restSec
    if (restSec === null) {
      const fromLine = extractRest(line)
      if (fromLine.restSec !== null) {
        restSec = fromLine.restSec
        line = fromLine.text
      }
    }
    restSec ??= defaultRestSec

    let sets = 3
    let repLow = 8
    let repHigh = 12
    const m = line.match(SETS_RE)
    if (m) {
      const count = parseInt(m[1], 10)
      const explicitSets = m[2] !== undefined
      if (count > MAX_IMPLICIT_SETS && !explicitSets) {
        // Weight×reps notation ("100x5"): not a set count. Keep it visible as
        // a note instead of inventing 100 sets.
        notes = tidyNote(`${notes ? `${notes} ` : ''}${m[0].trim()}`)
        line = line.slice(0, m.index) + ' ' + line.slice((m.index ?? 0) + m[0].length)
      } else {
        sets = Math.max(1, Math.min(20, count))
        repLow = Math.max(1, parseInt(m[3], 10))
        repHigh = m[4] ? Math.max(repLow, parseInt(m[4], 10)) : repLow
        line = line.slice(0, m.index) + ' ' + line.slice((m.index ?? 0) + m[0].length)
      }
    }

    const name = tidy(line)
    if (!name) continue

    out.push({ name, sets, repLow, repHigh, restSec, notes })
  }

  return out
}

const fmtRest = (sec: number): string =>
  sec % 60 === 0 ? `rest ${sec / 60} min` : `rest ${sec}s`

/**
 * Renders exercises back into the same text format. Rest times that differ
 * from the default are emitted so the round-trip preserves them.
 */
export const formatExerciseList = (
  exercises: ParsedExercise[],
  defaultRestSec: number,
): string =>
  exercises
    .map((e) => {
      const reps = e.repLow === e.repHigh ? `${e.repLow}` : `${e.repLow}-${e.repHigh}`
      const parts: string[] = []
      if (e.notes) parts.push(e.notes)
      if (e.restSec !== defaultRestSec) parts.push(fmtRest(e.restSec))
      const tail = parts.length > 0 ? ` (${parts.join(', ')})` : ''
      return `${e.name} ${e.sets}x${reps}${tail}`
    })
    .join('\n')
