import { describe, expect, it } from 'vitest'
import { pplProgram, pplulProgram, presetCatalog } from './presets'
import { isBodyweightSlug, slugify } from './catalog'

const catalog = presetCatalog()
const named = (p: ReturnType<typeof pplProgram>) =>
  p.days.map((d) => ({
    ...d,
    exercises: d.exercises.map((e) => ({ ...e, name: catalog[e.exerciseId].name })),
  }))
const program = pplProgram()
const pplul = pplulProgram()
// Style rules run over BOTH presets.
const days = [...named(program), ...named(pplul)]
const allExercises = days.flatMap((d) => d.exercises.map((e) => ({ day: d.name, ...e })))

/** Words that legitimately end in "s" — everything else must be singular. */
const S_ALLOWED = new Set(['Press', 'Biceps', 'Triceps', 'Cross'])

describe('program shape', () => {
  it('runs the six PPL days in rotation order', () => {
    expect(program.days.map((d) => d.name)).toEqual(['Push 1', 'Pull 1', 'Legs 1', 'Push 2', 'Pull 2', 'Legs 2'])
  })

  it('runs the five PPLUL days in Push→Pull→Legs→Upper→Lower order', () => {
    expect(pplul.days.map((d) => d.name)).toEqual(['Push', 'Pull', 'Legs', 'Upper', 'Lower'])
    expect(pplul.presetKey).toBe('pplul5')
  })

  it('gives every day a warm-up with the same two labels', () => {
    for (const d of days) {
      expect(d.notes, d.name).toMatch(/^Cardio: /)
      expect(d.notes, d.name).toMatch(/\nDynamic:/)
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
    const partnerRe = /Superset with ([A-Z][^.;]*?)[.;]/
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
        const m = e.notes.match(/Superset with ([A-Z][^.;]*?)[.;]/)
        if (!m) continue
        const partner = d.exercises.find((x) => x.name === m[1])!
        expect(partner.notes, partner.name).toMatch(new RegExp(`Closes the ${e.name} superset`))
        expect(partner.notes, partner.name).toMatch(/rest/i)
      }
    }
  })

  it('states the unit on every timed hold', () => {
    for (const e of allExercises) {
      if (!/Stretch$/.test(e.name)) continue
      expect(e.notes, e.name).toMatch(/Log the hold in seconds/)
    }
  })
})

describe('catalog integrity', () => {
  it('every template exerciseId in both presets resolves in presetCatalog', () => {
    for (const p of [program, pplul]) {
      for (const d of p.days) {
        for (const t of d.exercises) {
          expect(catalog[t.exerciseId], `${p.name} / ${d.name}`).toBeDefined()
        }
      }
    }
  })

  it('catalog ids are the slugs of their names', () => {
    for (const e of Object.values(catalog)) {
      expect(e.id).toBe(slugify(e.name))
    }
  })

  it('bodyweight flags are set on the bodyweight family', () => {
    expect(catalog[slugify('Pull-Up')].bodyweight).toBe(true)
    expect(catalog[slugify('Diamond Push-Up')].bodyweight).toBe(true)
    expect(catalog[slugify('Roman Chair Leg Raise')].bodyweight).toBe(true)
    expect(catalog[slugify('Barbell Bench Press')].bodyweight).toBe(false)
    for (const e of Object.values(catalog)) {
      expect(e.bodyweight, e.name).toBe(isBodyweightSlug(e.id))
    }
  })

  it('shared movements use the same slug across both splits (history continuity)', () => {
    const pplIds = new Set(program.days.flatMap((d) => d.exercises.map((t) => t.exerciseId)))
    const pplulIds = pplul.days.flatMap((d) => d.exercises.map((t) => t.exerciseId))
    const shared = pplulIds.filter((id) => pplIds.has(id))
    // The 5-day split is built from the 6-day movements: nearly all overlap.
    expect(shared.length).toBeGreaterThanOrEqual(20)
    expect(pplIds.has(slugify('Squat'))).toBe(true)
    expect(pplulIds).toContain(slugify('Squat'))
  })
})

describe('dash policy', () => {
  const BANNED = [/\u2014/, /\u2013/, / - /]
  it('keeps em dashes, en dashes, and spaced hyphens out of every preset string', () => {
    const texts: string[] = []
    for (const d of days) {
      texts.push(d.name, d.notes)
      for (const e of d.exercises) texts.push(e.name, e.notes)
    }
    for (const e of Object.values(catalog)) texts.push(e.name)
    for (const text of texts) {
      for (const re of BANNED) {
        expect(text, JSON.stringify(text)).not.toMatch(re)
      }
    }
  })
})

describe('v3 preset data', () => {
  it('gives every exercise an equipment class and a positive increment', () => {
    for (const e of Object.values(catalog)) {
      expect(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'], e.name).toContain(e.equipment)
      expect(e.increment, e.name).toBeGreaterThan(0)
    }
  })

  it('flags bodyweight equipment consistently with the bodyweight flag', () => {
    for (const e of Object.values(catalog)) {
      if (e.bodyweight) expect(e.equipment, e.name).toBe('bodyweight')
    }
  })

  it('arms the heavy compounds with a full warm-up ramp', () => {
    for (const p of [program, pplul]) {
      for (const d of p.days) {
        for (const t of d.exercises) {
          if (['squat', 'deadlift', 'barbell-bench-press', 'incline-barbell-bench-press'].includes(t.exerciseId)) {
            expect(t.warmups.length, t.exerciseId).toBeGreaterThanOrEqual(3)
            const last = t.warmups[t.warmups.length - 1]
            expect(last.pct, t.exerciseId).toBeGreaterThanOrEqual(0.75)
            const pcts = t.warmups.map((w) => w.pct)
            expect([...pcts].sort((a, b) => a - b), t.exerciseId).toEqual(pcts)
          }
        }
      }
    }
  })

  it('keeps warm-up prescriptions out of the notes', () => {
    for (const e of allExercises) {
      expect(e.notes, e.name).not.toMatch(/[Rr]amp|[Ff]eeder|[Ww]arm-up sets/)
    }
  })

  it('sets repCap at or above repHigh everywhere', () => {
    for (const e of allExercises) {
      expect(e.repCap, e.name).toBeGreaterThanOrEqual(e.repHigh)
    }
  })
})

