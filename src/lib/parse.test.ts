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
    expect(formatExerciseList(parse(text), 120)).toBe(text)
  })

  it('round-trips PRESERVING non-default rest times (bug 5)', () => {
    const text = 'Bench Press 3x6-8 (rest 3 min)\nLateral Raise 3x15 (rest 45s)\nRow 3x10'
    const once = parse(text)
    expect(once.map((e) => e.restSec)).toEqual([180, 45, 120])
    const again = parse(formatExerciseList(once, 120))
    expect(again).toEqual(once)
  })

  it('round-trips notes with sentence punctuation intact', () => {
    const note = 'Contracted half of the range only. Go straight into it without resting.'
    const [ex] = parse(`Pressdown 3x8 (${note})`)
    expect(ex.notes).toBe(note)
    expect(parse(formatExerciseList([ex], 120))[0]).toEqual(ex)
  })

  it('round-trips a note AND a custom rest together', () => {
    const [ex] = parse('Squat 3x5 (belt on, rest 4 min)')
    expect(ex).toMatchObject({ notes: 'belt on', restSec: 240 })
    const [back] = parse(formatExerciseList([ex], 120))
    expect(back).toEqual(ex)
  })

  it('reads weight×reps notation as a note, not 20 sets (bug 21)', () => {
    const [ex] = parse('Bench Press 100x5')
    expect(ex.sets).toBe(3)
    expect(ex.name).toBe('Bench Press')
    expect(ex.notes).toContain('100x5')
  })

  it('still honours an explicit large set count with the "sets" keyword', () => {
    expect(parse('Bench Press 15 sets x 5')[0]).toMatchObject({ sets: 15, repLow: 5 })
  })

  it('documents the bare-number rest heuristic: "rest 10" is 10 minutes', () => {
    expect(parse('Deadlift 1x5 (rest 10)')[0].restSec).toBe(600)
    expect(parse('Deadlift 1x5 (rest 90s)')[0].restSec).toBe(90)
  })

  it('property: 50 seeded random exercises survive format→parse→format', () => {
    // Deterministic LCG so a failure reproduces.
    let seed = 42
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647
    const names = ['Bench Press', 'Squat', 'Seated Row', 'Lat Pulldown', 'Curl', 'Leg Press']
    const rests = [45, 60, 90, 120, 150, 180, 240]
    const list = Array.from({ length: 50 }, () => {
      const repLow = 1 + Math.floor(rnd() * 12)
      return {
        name: names[Math.floor(rnd() * names.length)],
        sets: 1 + Math.floor(rnd() * 6),
        repLow,
        repHigh: repLow + Math.floor(rnd() * 8),
        restSec: rests[Math.floor(rnd() * rests.length)],
        notes: rnd() < 0.3 ? 'slow negative' : '',
      }
    })
    const text = formatExerciseList(list, 120)
    expect(parseExerciseList(text, 120)).toEqual(list)
    expect(formatExerciseList(parseExerciseList(text, 120), 120)).toBe(text)
  })
})
