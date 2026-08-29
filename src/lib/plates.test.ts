import { describe, expect, it } from 'vitest'
import { PLATES_KG, PLATES_LB, barLayout, describePlates, plateStyle, platesFor } from './plates'

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

describe('how the bar is drawn', () => {
  it('uses the colour code a lifter already reads', () => {
    expect(plateStyle(45, 'lb').color).toBe('#2b6cff')
    expect(plateStyle(25, 'kg').color).toBe('#ff453a')
    expect(plateStyle(20, 'kg').color).toBe('#2b6cff')
  })

  it('falls back to grey for a plate outside the set', () => {
    expect(plateStyle(3.75, 'lb').color).toBe('#8e8e93')
  })

  it('draws heavier plates bigger, and never draws one too small to see', () => {
    const heavy = plateStyle(45, 'lb').scale
    const mid = plateStyle(25, 'lb').scale
    const light = plateStyle(2.5, 'lb').scale
    expect(heavy).toBe(1)
    expect(mid).toBeLessThan(heavy)
    expect(light).toBeLessThan(mid)
    expect(light).toBeGreaterThanOrEqual(0.45)
  })

  it('lays a side out biggest first, so the drawing loads inboard out', () => {
    const load = platesFor(275, 45, PLATES_LB)!
    expect(barLayout(load.perSide, 'lb').map((p) => p.weight)).toEqual([45, 45, 25])
  })

  it('draws nothing on an empty bar', () => {
    expect(barLayout([], 'lb')).toEqual([])
  })
})
