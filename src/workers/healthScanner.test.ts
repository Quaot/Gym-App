import { describe, expect, it } from 'vitest'
import { initialScanState, parseHealthDate, scanChunk } from './healthScanner'

// Apple's exact export format, verbatim shape.
const rec = (start: string, end: string, value = 'HKCategoryValueSleepAnalysisAsleepCore') =>
  ` <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" sourceVersion="11.0" device="&lt;&lt;HKDevice&gt;&gt;" unit="" creationDate="${end}" startDate="${start}" endDate="${end}" value="${value}"/>\n`

const noise =
  ' <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" startDate="2026-08-28 23:00:00 +0100" endDate="2026-08-28 23:00:00 +0100" value="62"/>\n' +
  ' <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30"/>\n'

describe('parseHealthDate', () => {
  it('parses Apple\'s "+0100" offset format', () => {
    expect(parseHealthDate('2026-08-28 23:04:16 +0100')).toBe(Date.parse('2026-08-28T23:04:16+01:00'))
  })
  it('parses without an offset and rejects garbage', () => {
    expect(parseHealthDate('2026-08-28 23:04:16')).not.toBeNull()
    expect(parseHealthDate('yesterday-ish')).toBeNull()
  })
})

describe('scanChunk', () => {
  const xml =
    '<?xml version="1.0"?><HealthData>\n' +
    noise +
    rec('2026-08-28 23:00:00 +0100', '2026-08-29 06:30:00 +0100') +
    rec('2026-08-29 23:10:00 +0100', '2026-08-30 07:00:00 +0100', 'HKCategoryValueSleepAnalysisInBed') +
    rec('2026-08-30 23:00:00 +0100', '2026-08-31 06:00:00 +0100') +
    '</HealthData>'

  it('finds exactly the 3 sleep records in a one-shot scan, ignoring non-sleep', () => {
    const { records } = scanChunk(initialScanState(), xml)
    expect(records).toHaveLength(3)
    expect(records[0].value).toContain('AsleepCore')
    expect(records[1].value).toContain('InBed')
    expect(records[0].sourceName).toBe('Apple Watch')
    expect(records[0].end - records[0].start).toBe(7.5 * 3600 * 1000)
  })

  it('parses identically when records are split across chunk boundaries', () => {
    // Split at every 7 bytes — brutal, every tag straddles many chunks.
    let state = initialScanState()
    const all: unknown[] = []
    for (let i = 0; i < xml.length; i += 7) {
      const out = scanChunk(state, xml.slice(i, i + 7))
      state = out.state
      all.push(...out.records)
    }
    const oneShot = scanChunk(initialScanState(), xml).records
    expect(all).toEqual(oneShot)
    expect(all).toHaveLength(3)
  })

  it('handles attribute-order variations', () => {
    const reordered =
      '<Record startDate="2026-08-28 23:00:00 +0100" value="HKCategoryValueSleepAnalysisAsleepDeep" ' +
      'endDate="2026-08-29 06:00:00 +0100" type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="iPhone"/>'
    const { records } = scanChunk(initialScanState(), reordered)
    expect(records).toHaveLength(1)
    expect(records[0].sourceName).toBe('iPhone')
  })

  it('skips malformed records without derailing the scan', () => {
    const bad =
      '<Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="???" endDate="2026-08-29 06:00:00 +0100" value="Asleep"/>' +
      rec('2026-08-29 23:00:00 +0100', '2026-08-30 06:00:00 +0100')
    const { records } = scanChunk(initialScanState(), bad)
    expect(records).toHaveLength(1)
  })
})
