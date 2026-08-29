import { describe, expect, it } from 'vitest'
import { PLATES_KG, PLATES_LB, describePlates, platesFor } from './plates'

describe('platesFor', () => {
  it('loads a bench of 185 the way anyone would', () => {
    const load = platesFor(185, 45, PLATES_LB)!
    expect(load.perSide).toEqual([45, 25])
    expect(load.achieved).toBe(185)
    expect(load.approximate).toBe(false)
  })

  it('loads 225 as a plate a side', () => {
    expect(platesFor(225, 45, PLATES_LB)!.perSide).toEqual([45, 45])
  })

  it('gives the bar alone at bar weight', () => {
    const load = platesFor(45, 45, PLATES_LB)!
    expect(load.perSide).toEqual([])
    expect(load.achieved).toBe(45)
  })

  it('says nothing below the bar', () => {
    expect(platesFor(30, 45, PLATES_LB)).toBeNull()
  })

  it('flags a weight the plates cannot make', () => {
    const load = platesFor(100, 45, PLATES_LB)!
    // 27.5 a side: 25 and 2.5 leaves nothing over, so this one is exact.
    expect(load.approximate).toBe(false)
    const odd = platesFor(101, 45, PLATES_LB)!
    expect(odd.approximate).toBe(true)
    expect(odd.achieved).toBeLessThan(101)
  })

  it('works in kilos on a 20 kg bar', () => {
    const load = platesFor(100, 20, PLATES_KG)!
    expect(load.perSide).toEqual([25, 15])
    expect(load.achieved).toBe(100)
  })

  it('never returns a load heavier than asked for', () => {
    for (let w = 45; w <= 500; w += 2.5) {
      const load = platesFor(w, 45, PLATES_LB)
      if (load) expect(load.achieved).toBeLessThanOrEqual(w + 1e-9)
    }
  })
})

describe('describePlates', () => {
  it('collapses repeats', () => {
    expect(describePlates([45, 45, 25, 10, 10, 10])).toBe('45 × 2, 25, 10 × 3')
  })

  it('says nothing for an empty bar', () => {
    expect(describePlates([])).toBe('')
  })
})
