import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../types'
import type { AppState } from '../types'
import { freshState, migrateBackup, migrateFrom } from './migrate'
import { readFileSync } from 'node:fs'

const fixture = (name: string) =>
  JSON.parse(readFileSync(`${__dirname}/../../test-fixtures/${name}`, 'utf8'))

/**
 * A backup as Settings wrote it before the dumbbell change: current shape,
 * version 5, every dumbbell still on a ten pound step.
 */
const v5Backup = (): Record<string, unknown> => {
  const base = freshState()
  const catalog = Object.fromEntries(
    Object.entries(base.catalog).map(([id, e]) => [
      id, { ...e, increment: e.equipment === 'dumbbell' ? 10 : e.increment },
    ]),
  )
  return { ...base, version: 5, catalog, activeSessionId: null, rest: null }
}

const dumbbells = (s: AppState) =>
  Object.values(s.catalog).filter((e) => e.equipment === 'dumbbell')

describe('migrateBackup: a file enters the chain where it stands', () => {
  it('moves a v5 backup off ten pound dumbbells, which import used to skip', () => {
    const out = migrateBackup(v5Backup())
    expect(out.version).toBe(SCHEMA_VERSION)
    expect(dumbbells(out).length).toBeGreaterThan(0)
    for (const e of dumbbells(out)) expect(e.increment, e.name).toBe(2.5)
  })

  it('reads a current backup as it is', () => {
    const now = { ...freshState(), activeSessionId: null, rest: null }
    const out = migrateBackup(JSON.parse(JSON.stringify(now)))
    expect(out.catalog).toEqual(now.catalog)
    expect(out.programs).toEqual(now.programs)
    expect(out.settings).toEqual(now.settings)
  })

  it('carries a v1 file the whole way, in the unit it was in', () => {
    const out = migrateBackup(fixture('v1-state.json'))
    expect(out.version).toBe(SCHEMA_VERSION)
    expect(out.settings.unit).toBe('kg')
    expect(dumbbells(out).length).toBeGreaterThan(0)
    for (const e of dumbbells(out)) expect(e.increment, e.name).toBe(1.25)
  })

  it('carries a v2 file the whole way, in the unit it was in', () => {
    const out = migrateBackup(fixture('v2-state.json'))
    expect(out.version).toBe(SCHEMA_VERSION)
    expect(out.settings.unit).toBe('kg')
    for (const e of dumbbells(out)) expect(e.increment, e.name).toBe(1.25)
  })

  it('tells the single-program v1 shape from a file with no version', () => {
    const v1 = fixture('v1-state.json')
    delete v1.version
    const out = migrateBackup(v1)
    expect(out.version).toBe(SCHEMA_VERSION)
    expect(out.programs.length).toBeGreaterThan(0)
    expect(out.sessions.length).toBe(fixture('v1-state.json').sessions.length)
  })

  it('takes the whole chain for a current shape with no version', () => {
    const file = v5Backup()
    delete file.version
    const out = migrateBackup(file)
    expect(out.version).toBe(SCHEMA_VERSION)
    for (const e of dumbbells(out)) expect(e.increment, e.name).toBe(2.5)
  })

  it('reads a file from the future as current rather than refusing it', () => {
    const out = migrateBackup({ ...v5Backup(), version: SCHEMA_VERSION + 3 })
    expect(out.version).toBe(SCHEMA_VERSION)
    expect(Object.keys(out.catalog).length).toBeGreaterThan(0)
  })

  it('survives hostile input', () => {
    for (const bad of [null, undefined, 'x', 7, [], { version: 'five' }, { version: NaN }]) {
      const out = migrateBackup(bad)
      expect(out.version).toBe(SCHEMA_VERSION)
      expect(Object.keys(out.catalog).length).toBeGreaterThan(0)
    }
  })
})

describe('migrateFrom: the one place the chain is spelled out', () => {
  it('has a step for every schema below the current one', () => {
    // A new SCHEMA_VERSION without a row in STEPS would throw here rather
    // than on a phone.
    for (let v = 1; v < SCHEMA_VERSION; v++) {
      expect(() => migrateFrom(v, v5Backup()), `from ${v}`).not.toThrow()
    }
  })

})
