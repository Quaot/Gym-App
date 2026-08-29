import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pplProgram, pplulProgram, presetCatalog } from './presets'
import { suggestProgression } from './progression'

const SRC = join(__dirname, '..')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full) ? [full] : []
  })

/** Source with comments removed, so prose rules only judge shipped text. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('house copy rules', () => {
  const files = walk(SRC)

  it('finds source files to lint', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('ships no em dash or en dash in any user-facing string', () => {
    // These characters never appear in JavaScript syntax, so what survives
    // comment stripping is copy. The one exception is a regex that has to
    // ACCEPT a dash the user pasted, which is input handling, not prose.
    // Prose never puts a dash inside a character class; a matcher always does.
    const readsDashesAsInput = (line: string) => /\[[^\]]*[—–][^\]]*\]/.test(line)

    for (const file of files) {
      const code = withoutComments(readFileSync(file, 'utf8'))
      const offenders = code
        .split('\n')
        .filter((line) => /[—–]/.test(line) && !readsDashesAsInput(line))
      expect(offenders, `${file}\n${offenders.join('\n')}`).toEqual([])
    }
  })

  it('keeps hyphens out of preset prose while numeric ranges keep theirs', () => {
    const catalog = presetCatalog('lb')
    const texts: string[] = []
    for (const program of [pplProgram(), pplulProgram()]) {
      for (const day of program.days) {
        texts.push(day.name, day.notes)
        for (const t of day.exercises) texts.push(t.notes, catalog[t.exerciseId].name)
      }
    }
    for (const text of texts) {
      expect(text, text).not.toMatch(/ - /)
      expect(text, text).not.toMatch(/[—–]/)
    }
    // A range like 8-10 is notation and stays.
    expect('Reps 8-10').toMatch(/\d-\d/)
  })

  it('writes every progression reason as one short active sentence', () => {
    const ex = {
      repLow: 6, repHigh: 10, repCap: 12, increment: 5, bodyweight: false, plannedSets: 3,
    }
    const histories = [
      [],
      [[{ id: 'a', weight: 185, reps: 8, done: true, warmup: false, completedAt: null }]],
      [[{ id: 'b', weight: 185, reps: 10, done: true, warmup: false, completedAt: null }]],
    ]
    for (const history of histories) {
      const { reason } = suggestProgression(history, ex)
      expect(reason, reason).not.toMatch(/[—–]/)
      expect(reason.length, reason).toBeLessThan(140)
      expect(reason.trim().endsWith('.'), reason).toBe(true)
    }
  })
})
