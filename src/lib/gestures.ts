import { clamp } from './util'

/**
 * The rules a navigation gesture follows, kept apart from the DOM so they can
 * be reasoned about and tested on their own.
 */

/** Distance the large title travels before the compact title takes over. */
export const TITLE_HANDOFF = 34
/** Distance over which the handover happens. */
export const TITLE_FADE = 22

/** 0 while the large title still stands, 1 once the bar has taken the name. */
export const titleProgress = (scrollTop: number, large: boolean): number =>
  large ? clamp((scrollTop - TITLE_HANDOFF) / TITLE_FADE, 0, 1) : 1

/** Left strip that starts a back swipe. */
export const EDGE = 26
/** Past this share of the width, or this speed in px per ms, a swipe carries. */
export const SWIPE_FRACTION = 0.36
export const SWIPE_SPEED = 0.45
/** How far the screen underneath trails the one on top, as Apple does it. */
export const PARALLAX = 0.28

export const swipeCommits = (dx: number, width: number, speed: number): boolean =>
  dx > width * SWIPE_FRACTION || speed > SWIPE_SPEED

/** Where the screen behind sits while the top one is dragged dx to the right. */
export const parallaxOffset = (dx: number, width: number): number =>
  -PARALLAX * (width - clamp(dx, 0, width))

/** A sheet needs less travel than a screen, since it has less to lose. */
export const SHEET_FRACTION = 0.3
export const SHEET_SPEED = 0.5

export const sheetCommits = (dy: number, height: number, speed: number): boolean =>
  dy > height * SHEET_FRACTION || speed > SHEET_SPEED

/* ------------------------------------------------------------------ *
 * Tape input
 * ------------------------------------------------------------------ */

/** Pixels of travel per detent on the tape. */
export const PX_PER_STEP = 14
/** Per frame decay of a flick. */
export const FRICTION = 0.92
/** Below this speed a release is a drag, not a throw. */
export const MIN_FLICK = 0.35
/** Hard cap on how far a throw may carry, in detents. */
export const MAX_COAST_STEPS = 15
/** Share of overtravel that survives past the ends of the range. */
export const RUBBER = 0.3

/**
 * Where a throw lands, in pixels, computed at the moment of release rather
 * than a frame at a time. Committing the landing value straight away is what
 * stops a set being logged with the number the tape was leaving behind.
 */
export const coastLanding = (offsetPx: number, velocity: number): number => {
  if (Math.abs(velocity) < MIN_FLICK) return offsetPx
  let v = clamp(velocity * 10, -8, 8)
  let px = offsetPx
  let travelled = 0
  const cap = MAX_COAST_STEPS * PX_PER_STEP
  // The same decay the eye used to see, run to its end in one go.
  for (let i = 0; i < 600 && Math.abs(v) >= 0.4; i++) {
    v *= FRICTION
    if (travelled + Math.abs(v) > cap) break
    travelled += Math.abs(v)
    px += v
  }
  return px
}

/** Snaps to the loadable grid and holds the range. */
export const quantizeToStep = (v: number, step: number, min: number, max: number): number => {
  const snapped = Math.round(v / step) * step
  return clamp(Math.round(snapped * 1000) / 1000, min, max)
}

/** Speed in px per ms from a short ring of samples, positive as value rises. */
export const velocityFrom = (
  samples: { x: number; t: number }[],
  fallbackX: number,
): number => {
  const oldest = samples[0]
  if (!oldest) return 0
  const newest = samples[samples.length - 1] ?? { x: fallbackX, t: oldest.t + 1 }
  const dt = Math.max(1, newest.t - oldest.t)
  return (oldest.x - newest.x) / dt
}
