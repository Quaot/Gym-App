import type { ExerciseTemplate } from '../types'
import { uid } from './util'

/** Matches the "3x8-10" / "3 × 8" / "3 sets x 8" tail of a programmed line. */
const SETS_RE = /(\d+)\s*(?:sets?)?\s*[x×]\s*(\d+)\s*(?:[-–—]|\s*to\s*)?\s*(\d+)?/i
const UNIT = '(s|sec|secs|seconds|m|min|mins|minutes)'
/** "rest 3 min", "rest: 90s" — an explicit rest instruction anywhere in the text. */
const REST_LABELLED = new RegExp(`rest[:\\s]*(\\d+(?:\\.\\d+)?)\\s*${UNIT}?\\b`, 'i')
/** A parenthetical that is nothing but a duration, e.g. "(90s)" or "(3 min)". */
const REST_BARE = new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\s*$`, 'i')
const LEAD_RE = /^\s*(?:\d+[.)]|[-*•–—])\s*/

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

/**
 * Turns a pasted workout list into exercise templates, one per line.
 * Understands lines such as:
 *   "1. Barbell Bench Press — 3x6-8 (rest 3 min)"
 *   "Cable Fly 2 x 12-15 (slow eccentric)"
 *   "Overhead Press"            -> falls back to 3x8-12
 */
export const parseExerciseList = (
  text: string,
  defaultRestSec: number,
): ExerciseTemplate[] => {
  const out: ExerciseTemplate[] = []

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
    notes = tidy(fromNote.text)
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
      sets = Math.max(1, Math.min(20, parseInt(m[1], 10)))
      repLow = Math.max(1, parseInt(m[2], 10))
      repHigh = m[3] ? Math.max(repLow, parseInt(m[3], 10)) : repLow
      line = line.slice(0, m.index) + ' ' + line.slice((m.index ?? 0) + m[0].length)
    }

    const name = tidy(line)
    if (!name) continue

    out.push({ id: uid(), name, sets, repLow, repHigh, restSec, notes })
  }

  return out
}

/** Renders templates back into the same text format, for round-trip editing. */
export const formatExerciseList = (exercises: ExerciseTemplate[]): string =>
  exercises
    .map((e) => {
      const reps = e.repLow === e.repHigh ? `${e.repLow}` : `${e.repLow}-${e.repHigh}`
      const note = e.notes ? ` (${e.notes})` : ''
      return `${e.name} ${e.sets}x${reps}${note}`
    })
    .join('\n')
