import { describe, expect, it } from 'vitest'
import {
  MAX_COAST_STEPS, PX_PER_STEP, coastLanding, parallaxOffset, quantizeToStep, sheetCommits,
  swipeCommits, titleProgress, velocityFrom, TITLE_FADE, TITLE_HANDOFF,
} from './gestures'

describe('titleProgress', () => {
  it('keeps the bar empty while the large title is still up', () => {
    expect(titleProgress(0, true)).toBe(0)
    expect(titleProgress(TITLE_HANDOFF, true)).toBe(0)
  })

  it('hands over across the fade and then stays put', () => {
    expect(titleProgress(TITLE_HANDOFF + TITLE_FADE / 2, true)).toBeCloseTo(0.5)
    expect(titleProgress(TITLE_HANDOFF + TITLE_FADE, true)).toBe(1)
    expect(titleProgress(9000, true)).toBe(1)
  })

  it('shows the title from the first pixel on a screen without a large one', () => {
    expect(titleProgress(0, false)).toBe(1)
  })
})

describe('swipeCommits', () => {
  const W = 390

  it('refuses a short slow drag', () => {
    expect(swipeCommits(40, W, 0.1)).toBe(false)
  })

  it('accepts a drag past a third of the width', () => {
    expect(swipeCommits(W * 0.4, W, 0)).toBe(true)
  })

  it('accepts a short flick, since speed carries intent', () => {
    expect(swipeCommits(30, W, 1.2)).toBe(true)
  })
})

describe('parallaxOffset', () => {
  const W = 400

  it('holds the screen behind well off to the left at rest', () => {
    expect(parallaxOffset(0, W)).toBeCloseTo(-112)
  })

  it('brings it home exactly as the top screen leaves', () => {
    expect(parallaxOffset(W, W)).toBeCloseTo(0)
  })

  it('clamps, so an overshoot never pushes it past centre', () => {
    expect(parallaxOffset(W * 2, W)).toBeCloseTo(0)
    expect(parallaxOffset(-50, W)).toBeCloseTo(-112)
  })
})

describe('sheetCommits', () => {
  const H = 500

  it('lets a small nudge spring back', () => {
    expect(sheetCommits(60, H, 0.1)).toBe(false)
  })

  it('dismisses past a third of the height', () => {
    expect(sheetCommits(200, H, 0)).toBe(true)
  })

  it('dismisses on a fast flick down', () => {
    expect(sheetCommits(40, H, 0.9)).toBe(true)
  })
})

describe('coastLanding', () => {
  it('does not throw at all below the flick threshold', () => {
    expect(coastLanding(40, 0.2)).toBe(40)
    expect(coastLanding(-15, -0.3)).toBe(-15)
  })

  it('carries further the harder you throw', () => {
    const soft = coastLanding(0, 0.5)
    const hard = coastLanding(0, 2)
    expect(soft).toBeGreaterThan(0)
    expect(hard).toBeGreaterThan(soft)
  })

  it('is symmetric in both directions', () => {
    expect(coastLanding(0, -1.2)).toBeCloseTo(-coastLanding(0, 1.2), 6)
  })

  it('never carries past the cap, however hard you throw', () => {
    const cap = MAX_COAST_STEPS * PX_PER_STEP
    for (const v of [1, 5, 50, 500]) {
      expect(Math.abs(coastLanding(0, v))).toBeLessThanOrEqual(cap + 8)
    }
  })

  it('starts from where the finger left off', () => {
    expect(coastLanding(100, 1)).toBeCloseTo(100 + coastLanding(0, 1), 6)
  })
})

describe('quantizeToStep', () => {
  it('snaps to the nearest step', () => {
    expect(quantizeToStep(62.37, 2.5, 0, 500)).toBe(62.5)
    expect(quantizeToStep(61.2, 2.5, 0, 500)).toBe(60)
  })

  it('holds the range', () => {
    expect(quantizeToStep(-40, 5, 0, 500)).toBe(0)
    expect(quantizeToStep(9000, 5, 0, 500)).toBe(500)
  })

  it('leaves a value already on the grid alone', () => {
    expect(quantizeToStep(185, 5, 0, 500)).toBe(185)
    expect(quantizeToStep(61.25, 1.25, 0, 500)).toBe(61.25)
  })

  it('carries no floating point dust', () => {
    expect(quantizeToStep(0.1 + 0.2, 0.1, 0, 10)).toBe(0.3)
  })
})

describe('velocityFrom', () => {
  it('reads a rightward drag as a falling value', () => {
    // x rising means the tape moved right, which counts down.
    expect(velocityFrom([{ x: 0, t: 0 }, { x: 100, t: 100 }], 100)).toBeCloseTo(-1)
  })

  it('reads a leftward drag as a rising value', () => {
    expect(velocityFrom([{ x: 100, t: 0 }, { x: 0, t: 100 }], 0)).toBeCloseTo(1)
  })

  it('is zero with nothing to measure', () => {
    expect(velocityFrom([], 10)).toBe(0)
  })

  it('never divides by a zero interval', () => {
    expect(Number.isFinite(velocityFrom([{ x: 0, t: 5 }, { x: 40, t: 5 }], 40))).toBe(true)
  })
})
