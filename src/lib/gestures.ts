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
