import { describe, expect, it } from 'vitest'
import { pplProgram } from './presets'

const program = pplProgram()
const days = program.days
const allExercises = days.flatMap((d) => d.exercises.map((e) => ({ day: d.name, ...e })))

/** Words that legitimately end in "s" — everything else must be singular. */
const S_ALLOWED = new Set(['Press', 'Biceps', 'Triceps', 'Cross'])

describe('program shape', () => {
  it('runs the six days in rotation order', () => {
    expect(days.map((d) => d.name)).toEqual(['Push 1', 'Pull 1', 'Legs 1', 'Push 2', 'Pull 2', 'Legs 2'])
  })

  it('gives every day a warm-up with the same two labels', () => {
    for (const d of days) {
      expect(d.notes, d.name).toMatch(/^General: /)
      expect(d.notes, d.name).toMatch(/\nDynamic[ (:]/)
    }
  })

  it('gives every exercise a sane set, rep and rest target', () => {
    for (const e of allExercises) {
      expect(e.name.length, e.name).toBeGreaterThan(2)
      expect(e.sets, e.name).toBeGreaterThanOrEqual(1)
      expect(e.repLow, e.name).toBeGreaterThanOrEqual(1)
      expect(e.repHigh, e.name).toBeGreaterThanOrEqual(e.repLow)
      expect(e.restSec, e.name).toBeGreaterThanOrEqual(30)
      expect(e.restSec, e.name).toBeLessThanOrEqual(240)
    }
  })

  it('has no duplicate exercise name within a day', () => {
    for (const d of days) {
      const names = d.exercises.map((e) => e.name)
      expect(new Set(names).size, d.name).toBe(names.length)
    }
  })

  it('names the same movement identically across days', () => {
    // Catches "Lat Pulldown" in one day and "Lat Pull-Down" in another.
    const squashed = new Map<string, string>()
    for (const e of allExercises) {
      const key = e.name.toLowerCase().replace(/[^a-z]/g, '')
      const seen = squashed.get(key)
      if (seen) expect(e.name, `${e.name} vs ${seen}`).toBe(seen)
      else squashed.set(key, e.name)
    }
  })
})

describe('exercise name style', () => {
  it('capitalises every word and every hyphenated part', () => {
    for (const e of allExercises) {
      for (const part of e.name.split(/[\s-]/)) {
        expect(part, `${e.name}: "${part}"`).toMatch(/^[A-Z0-9]/)
      }
    }
  })

  it('keeps names singular', () => {
    for (const e of allExercises) {
      for (const word of e.name.split(/[\s-]/)) {
        if (word.endsWith('s') && !S_ALLOWED.has(word)) {
          throw new Error(`"${e.name}" should be singular: "${word}"`)
        }
      }
    }
  })

  it('spells equipment out and uses no digits for limb counts', () => {
    for (const e of allExercises) {
      expect(e.name, e.name).not.toMatch(/\bDB\b/)
      expect(e.name, e.name).not.toMatch(/\bBB\b/)
      expect(e.name, e.name).not.toMatch(/\b\d-Arm\b/)
      expect(e.name, e.name).not.toMatch(/\bFlye\b/)
    }
  })
})

describe('note style', () => {
  const noted = allExercises.filter((e) => e.notes)

  it('writes full sentences', () => {
    for (const e of noted) {
      expect(e.notes, e.name).toMatch(/^[A-Z0-9]/)
      expect(e.notes, e.name).toMatch(/\.$/)
      expect(e.notes, e.name).not.toMatch(/\s{2,}/)
    }
  })

  it('uses × for multiplication, never a bare x', () => {
    for (const e of noted) {
      expect(e.notes, e.name).not.toMatch(/\d\s*x\s*\d/i)
      // "20% × 10" — spaces on both sides.
      for (const m of e.notes.matchAll(/.{1}×.{1}/g)) {
        expect(m[0], e.name).toMatch(/^\s×\s$/)
      }
    }
  })

  it('writes times as sec and min', () => {
    for (const e of noted) {
      expect(e.notes, e.name).not.toMatch(/\b\d+\s*(seconds?|minutes?|s\b|m\b)/)
    }
  })

  it('points supersets at a partner named exactly as it appears in the day', () => {
    const partnerRe = /Superset with ([A-Z][^.]*?)\./
    let found = 0
    for (const d of days) {
      const names = new Set(d.exercises.map((e) => e.name))
      for (const e of d.exercises) {
        const m = e.notes.match(partnerRe)
        if (!m) continue
        found++
        expect(names, `${d.name}: "${m[1]}"`).toContain(m[1])
      }
    }
    expect(found).toBeGreaterThan(0)
  })

  it('has the second half of each superset close the pair', () => {
    for (const d of days) {
      for (const e of d.exercises) {
        const m = e.notes.match(/Superset with ([A-Z][^.]*?)\./)
        if (!m) continue
        const partner = d.exercises.find((x) => x.name === m[1])!
        expect(partner.notes, partner.name).toMatch(new RegExp(`Closes the ${e.name} superset\\.`))
        expect(partner.notes, partner.name).toMatch(/Rest after this one[.,]/)
      }
    }
  })

  it('states the unit on every timed hold', () => {
    for (const e of allExercises) {
      if (!/Stretch$/.test(e.name)) continue
      expect(e.notes, e.name).toMatch(/Log the hold in seconds: \d+ sec/)
    }
  })
})
