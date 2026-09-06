import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../types'
import type { AppState } from '../types'
import { freshState, migrateV1, migrateV2, migrateV3, migrateV4, migrateV5 } from './migrate'
import { readFileSync } from 'node:fs'

const v1 = JSON.parse(readFileSync(`${__dirname}/../../test-fixtures/v1-state.json`, 'utf8'))

/** A catalog as it sits on a phone that predates the dumbbell change. */
const storedV5 = (unit: 'lb' | 'kg' = 'lb'): AppState => {
  const base = freshState()
  return {
    ...base,
    settings: { ...base.settings, unit },
    catalog: Object.fromEntries(
      Object.entries(base.catalog).map(([id, e]) => [
        id, { ...e, increment: e.equipment === 'barbell' ? 5 : 10 },
      ]),
    ),
  }
}

const byEquipment = (s: AppState, kind: string) =>
  Object.values(s.catalog).filter((e) => e.equipment === kind)

describe('migrateV5: increments follow the equipment again', () => {
  it('drops every dumbbell to two and a half pounds', () => {
    const out = migrateV5(storedV5())
    const dumbbells = byEquipment(out, 'dumbbell')
    expect(dumbbells.length).toBeGreaterThan(0)
    for (const e of dumbbells) expect(e.increment, e.name).toBe(2.5)
  })

  it('leaves a barbell and a stack exactly where they were', () => {
    const out = migrateV5(storedV5())
    for (const e of byEquipment(out, 'barbell')) expect(e.increment, e.name).toBe(5)
    for (const e of byEquipment(out, 'machine')) expect(e.increment, e.name).toBe(10)
  })

  it('uses the unit you are actually in, not the one the decoder assumed', () => {
    const out = migrateV5(storedV5('kg'))
    for (const e of byEquipment(out, 'dumbbell')) expect(e.increment, e.name).toBe(1.25)
    for (const e of byEquipment(out, 'barbell')) expect(e.increment, e.name).toBe(2.5)
  })

  it('changes nothing the second time it runs', () => {
    const once = migrateV5(storedV5())
    expect(migrateV5(once).catalog).toEqual(once.catalog)
  })

  it('leaves a catalog that is already right untouched', () => {
    const clean = freshState()
    expect(migrateV5(clean).catalog).toEqual(clean.catalog)
  })

  it('never touches a logged set: history is not a preference', () => {
    const stored = storedV5()
    expect(migrateV5(stored).sessions).toEqual(stored.sessions)
    expect(migrateV5(stored).programs).toEqual(stored.programs)
  })

  it('carries a v1 blob the whole way to the current schema', () => {
    // The captured fixture is a kilo lifter, so this also proves the unit
    // survives four migrations and reaches the increment at the end of them.
    expect(v1.settings.unit).toBe('kg')
    const out = migrateV5(migrateV4(migrateV3(migrateV2(migrateV1(v1)))))
    expect(out.version).toBe(SCHEMA_VERSION)
    expect(out.settings.unit).toBe('kg')
    for (const e of byEquipment(out, 'dumbbell')) expect(e.increment, e.name).toBe(1.25)
  })

  it('survives hostile input', () => {
    for (const raw of [null, 42, [], {}, 'nope']) {
      const out = migrateV5(raw)
      expect(out.version).toBe(SCHEMA_VERSION)
      expect(Object.keys(out.catalog).length).toBeGreaterThan(0)
    }
  })
})
