import { describe, expect, it } from 'vitest'
import { suggestProgression, DELOAD, REP_COST } from './progression'
import type { PastSets, ProgressionExercise } from './progression'
import type { LoggedSet } from '../types'

let n = 0
const set = (weight: number | null, reps: number): LoggedSet => ({
  id: `s${n++}`,
  weight,
  reps,
  done: true,
  warmup: false,
  completedAt: null,
})

/** A session of identical sets, the common case. */
const sess = (weight: number | null, reps: number[]): PastSets =>
  reps.map((r) => set(weight, r))

const bench: ProgressionExercise = {
  repLow: 6, repHigh: 10, repCap: 12, increment: 5, bodyweight: false, plannedSets: 3,
}
const lateralRaise: ProgressionExercise = {
  repLow: 10, repHigh: 15, repCap: 20, increment: 10, bodyweight: false, plannedSets: 3,
}
const pullUp: ProgressionExercise = {
  repLow: 5, repHigh: 10, repCap: 15, increment: 5, bodyweight: true, plannedSets: 3,
}

describe('first time', () => {
  it('asks for a baseline at the bottom of the range', () => {
    const { suggestion } = suggestProgression([], bench)
    expect(suggestion).toEqual({ kind: 'first', weight: null, targetReps: 6 })
  })

  it('ignores empty sessions', () => {
    expect(suggestProgression([[], []], bench).suggestion.kind).toBe('first')
  })
})

describe('rep progression, the weight holds', () => {
  it('adds a rep when the range is not topped', () => {
    const { suggestion } = suggestProgression([sess(185, [8, 8, 7])], bench)
    expect(suggestion).toMatchObject({ kind: 'reps', weight: 185, targetReps: 9 })
  })

  it('brings lagging sets up first', () => {
    const { suggestion, reason } = suggestProgression([sess(185, [10, 9, 7])], bench)
    expect(suggestion).toMatchObject({ kind: 'reps', weight: 185 })
    // Set 1 is already at the top, so per-set targets cap there.
    expect((suggestion as { perSetTargets: number[] }).perSetTargets).toEqual([10, 10, 8])
    expect(reason).toContain('set 2')
  })

  it('holds the weight after a miss rather than dropping it', () => {
    // 185 was reached last session at the bottom of the range: hold and climb.
    const { suggestion } = suggestProgression(
      [sess(185, [6, 6, 5]), sess(180, [10, 10, 10])],
      bench,
    )
    expect(suggestion).toMatchObject({ kind: 'reps', weight: 185, targetReps: 7 })
  })
})

describe('load jump, hand-computed', () => {
  it('takes a cheap jump and predicts the rep landing', () => {
    // 5 on 185 is 2.7%, under JUMP_HARD, so drop = round(0.027 / 0.03) = 1.
    const { suggestion, reason } = suggestProgression([sess(185, [10, 10, 10])], bench)
    expect(suggestion).toEqual({ kind: 'load', weight: 190, targetReps: 9 })
    expect(reason).toContain('3%')
  })

  it('sends you to the bottom of the range when the jump is over 7%', () => {
    // 5 on 65 is 7.7%: over JUMP_HARD but under JUMP_MAX.
    const light = { ...bench, increment: 5 }
    const { suggestion } = suggestProgression([sess(65, [10, 10, 10])], light)
    expect(suggestion).toEqual({ kind: 'load', weight: 70, targetReps: 6 })
  })

  it('the drop it predicts follows REP_COST', () => {
    // 10 on 200 is 5%: round(0.05 / 0.03) = 2 reps off the top.
    const wide = { ...bench, increment: 10 }
    const { suggestion } = suggestProgression([sess(200, [10, 10, 10])], wide)
    expect(Math.round(0.05 / REP_COST)).toBe(2)
    expect(suggestion).toEqual({ kind: 'load', weight: 210, targetReps: 8 })
  })
})

describe('isolation: the jump is refused, the range widens', () => {
  it('refuses a 10 lb jump on a 30 lb lateral raise and extends instead', () => {
    // 10 on 30 is 33%, far past JUMP_MAX.
    const { suggestion, reason } = suggestProgression([sess(30, [15, 15, 15])], lateralRaise)
    expect(suggestion).toEqual({ kind: 'extend', weight: 30, targetReps: 17, newRepHigh: 17 })
    expect(reason).toContain('33%')
  })

  it('takes the same jump once the weight is heavy enough to absorb it', () => {
    // 10 on 120 is 8.3%: inside JUMP_MAX, so the load moves.
    const heavyIso = { ...lateralRaise, increment: 10 }
    const { suggestion } = suggestProgression([sess(120, [15, 15, 15])], heavyIso)
    expect(suggestion).toMatchObject({ kind: 'load', weight: 130 })
  })

  it('adds a set once the range is exhausted and the jump is still too steep', () => {
    const maxed = { ...lateralRaise, repHigh: 20, repCap: 20 }
    const { suggestion } = suggestProgression([sess(30, [20, 20, 20])], maxed)
    expect(suggestion).toEqual({ kind: 'addSet', weight: 30, targetReps: 10, sets: 4 })
  })
})

describe('acceptance of the last jump', () => {
  it('reverts when the new weight landed more than a rep short', () => {
    // Jumped 185 to 190, then only managed 4 against a floor of 6.
    const { suggestion, reason } = suggestProgression(
      [sess(190, [4, 4, 3]), sess(185, [10, 10, 10])],
      bench,
    )
    expect(suggestion).toEqual({ kind: 'revert', weight: 185, targetReps: 12, newRepHigh: 12 })
    expect(reason).toContain('185')
  })

  it('accepts a jump that landed within a rep of the floor', () => {
    const { suggestion } = suggestProgression(
      [sess(190, [5, 5, 5]), sess(185, [10, 10, 10])],
      bench,
    )
    expect(suggestion.kind).toBe('reps')
    expect(suggestion.weight).toBe(190)
  })
})

describe('stall', () => {
  it('offers a 10% deload after three flat sessions', () => {
    const flat = [sess(225, [8, 8, 8]), sess(225, [8, 8, 8]), sess(225, [8, 8, 8])]
    const { suggestion } = suggestProgression(flat, bench)
    // 225 * 0.9 = 202.5, rounded to the 5 lb grid = 205.
    expect(suggestion).toEqual({ kind: 'deload', weight: 205, targetReps: 10 })
    expect(Math.round(225 * (1 - DELOAD) / 5) * 5).toBe(205)
  })

  it('does not deload while reps are still climbing', () => {
    const climbing = [sess(225, [9, 9, 8]), sess(225, [8, 8, 8]), sess(225, [7, 7, 7])]
    expect(suggestProgression(climbing, bench).suggestion.kind).toBe('reps')
  })

  it('needs three sessions before calling a stall', () => {
    const two = [sess(225, [8, 8, 8]), sess(225, [8, 8, 8])]
    expect(suggestProgression(two, bench).suggestion.kind).toBe('reps')
  })
})

describe('bodyweight ladder', () => {
  it('climbs reps first', () => {
    const { suggestion } = suggestProgression([sess(null, [8, 7, 6])], pullUp)
    expect(suggestion).toMatchObject({ kind: 'reps', weight: 0, targetReps: 9 })
  })

  it('widens the range once every set tops out', () => {
    const { suggestion } = suggestProgression([sess(null, [10, 10, 10])], pullUp)
    expect(suggestion).toMatchObject({ kind: 'extend', newRepHigh: 12 })
  })

  it('adds a set once the range is exhausted', () => {
    const maxed = { ...pullUp, repHigh: 15, repCap: 15 }
    const { suggestion } = suggestProgression([sess(null, [15, 15, 15])], maxed)
    expect(suggestion).toMatchObject({ kind: 'addSet', sets: 4 })
  })

  it('treats added load like any other weight once a belt is on', () => {
    // 5 lb on a 175 lb lifter plus 45 lb of plates is 2%, a cheap jump.
    const weighted = { ...pullUp, repHigh: 8, repCap: 10, systemLoad: 175 }
    const { suggestion } = suggestProgression([sess(45, [8, 8, 8])], weighted)
    expect(suggestion.kind).toBe('load')
    expect(suggestion.weight).toBe(50)
  })
})

describe('robustness', () => {
  it('reads the working weight as the modal weight of the sets', () => {
    // A drop set at the end must not become the working weight.
    const { suggestion } = suggestProgression([[set(185, 8), set(185, 8), set(135, 15)]], bench)
    expect(suggestion).toMatchObject({ kind: 'reps', weight: 185 })
  })

  it('snaps a suggestion onto the increment grid from an off-grid weight', () => {
    // 187.5 plus 5 is 192.5, which no 5 lb gym can load.
    const { suggestion } = suggestProgression([sess(187.5, [10, 10, 10])], bench)
    expect(suggestion.weight).toBe(190)
  })

  it('never suggests a weight off the increment grid', () => {
    const cases: PastSets[][] = [
      [sess(187.5, [10, 10, 10])],
      [sess(225, [8, 8, 8]), sess(225, [8, 8, 8]), sess(225, [8, 8, 8])],
    ]
    for (const history of cases) {
      const w = suggestProgression(history, bench).suggestion.weight
      if (w !== null && w > 0) {
        expect(Math.abs(w / bench.increment - Math.round(w / bench.increment)), String(w))
          .toBeLessThan(1e-9)
      }
    }
  })

  it('always explains itself in one sentence without a dash', () => {
    const histories: PastSets[][] = [
      [],
      [sess(185, [8, 8, 7])],
      [sess(185, [10, 10, 10])],
      [sess(30, [15, 15, 15])],
      [sess(190, [4, 4, 3]), sess(185, [10, 10, 10])],
      [sess(225, [8, 8, 8]), sess(225, [8, 8, 8]), sess(225, [8, 8, 8])],
      [sess(null, [10, 10, 10])],
    ]
    for (const history of histories) {
      const { reason } = suggestProgression(history, history[0]?.[0]?.weight === null ? pullUp : bench)
      expect(reason.length, reason).toBeGreaterThan(10)
      expect(reason, reason).not.toMatch(/—|–| - /)
    }
  })
})
