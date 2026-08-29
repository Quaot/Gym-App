import { describe, expect, it } from 'vitest'
import {
  parallaxOffset, sheetCommits, swipeCommits, titleProgress, TITLE_FADE, TITLE_HANDOFF,
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
