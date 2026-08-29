import { describe, expect, it } from 'vitest'
import { formatExerciseList, parseExerciseList } from './parse'

const parse = (text: string) => parseExerciseList(text, 120)

describe('parseExerciseList', () => {
  it('reads a numbered line with an em dash, a rep range and a rest time', () => {
    const [ex] = parse('1. Barbell Bench Press — 3x6-8 (rest 3 min)')
    expect(ex).toMatchObject({ name: 'Barbell Bench Press', sets: 3, repLow: 6, repHigh: 8, restSec: 180, notes: '' })
  })

  it('accepts spaced and unicode multiplication signs', () => {
    expect(parse('Incline Dumbbell Press 3 × 8-10')[0]).toMatchObject({ sets: 3, repLow: 8, repHigh: 10 })
    expect(parse('Cable Fly 2 sets x 12')[0]).toMatchObject({ sets: 2, repLow: 12, repHigh: 12 })
  })

  it('keeps a parenthetical that is not a rest time as the note', () => {
    const [ex] = parse('Cable Fly 2x12-15 (slow eccentric)')
    expect(ex).toMatchObject({ name: 'Cable Fly', notes: 'slow eccentric', restSec: 120 })
  })

  it('keeps the non-rest part of a mixed parenthetical', () => {
    const [ex] = parse('Squat 3x5 (belt on, rest 4 min)')
    expect(ex).toMatchObject({ notes: 'belt on', restSec: 240 })
  })

  it('falls back to 3x8-12 and the default rest when nothing is specified', () => {
    expect(parse('Overhead Press')[0]).toMatchObject({ name: 'Overhead Press', sets: 3, repLow: 8, repHigh: 12, restSec: 120 })
  })

  it('does not mistake a hyphenated exercise name for a rep range', () => {
    expect(parse('Cross-Body Cable Extension 3x10-12')[0].name).toBe('Cross-Body Cable Extension')
  })

  it('ignores blank lines and bullet characters', () => {
    expect(parse('\n• Lat Pulldown 3x10\n\n- Row 3x10\n')).toHaveLength(2)
  })

  it('treats an unlabelled duration among other words as a note, not rest', () => {
    const [ex] = parse('Plank 3x30 (30 sec hold)')
    expect(ex.restSec).toBe(120)
    expect(ex.notes).toBe('30 sec hold')
  })

  it('reads a bare duration parenthetical as the rest time', () => {
    expect(parse('Lateral Raise 3x15 (90s)')[0]).toMatchObject({ restSec: 90, notes: '' })
  })

  it('reads an unbracketed rest instruction on the line', () => {
    const [ex] = parse('Leg Press 3x10-12 rest 2 min')
    expect(ex).toMatchObject({ name: 'Leg Press', restSec: 120, sets: 3, repLow: 10, repHigh: 12 })
  })

  it('round-trips through formatExerciseList', () => {
    const text = 'Bench Press 3x6-8\nCable Fly 2x12-15 (slow eccentric)\nOverhead Press 3x8-12'
    expect(formatExerciseList(parse(text))).toBe(text)
  })
})
