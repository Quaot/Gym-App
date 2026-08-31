/**
 * The artwork, in one place.
 *
 * The app icon, the favicon, the launch screens and the native shell's own
 * icon and launch image are all drawn from here, so the whole set shares one
 * palette: black ground, systemGreen mark. Nothing in this file rasterises
 * anything; that is the job of whichever script imports it.
 */

export const BG = '#000000'
export const MARK = '#30d158'

/** The dumbbell, drawn on a 100 unit square. */
export const mark = (scale = 1) => `
  <g fill="${MARK}" transform="translate(50 50) scale(${scale}) translate(-50 -50)">
    <rect x="4" y="34" width="10" height="32" rx="3"/>
    <rect x="16" y="26" width="12" height="48" rx="4"/>
    <rect x="30" y="43" width="40" height="14" rx="3"/>
    <rect x="72" y="26" width="12" height="48" rx="4"/>
    <rect x="86" y="34" width="10" height="32" rx="3"/>
  </g>`

export const iconSvg = (radius, scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${radius}" fill="${BG}"/>
  ${mark(scale)}
</svg>`

/** An icon at an exact pixel size, as a page that is nothing but the icon. */
export const iconHtml = (size, radius, scale) =>
  `<!doctype html><html><head><style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style></head><body>${iconSvg((radius / size) * 100, scale)}</body></html>`

/** The launch screen: the mark over the name, centred on the ground. */
export const splashHtml = (w, h) => `<!doctype html><html><head><style>
  html,body{margin:0;height:100%;background:${BG};}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(h * 0.03)}px;}
  svg{width:${Math.round(Math.min(w, h) * 0.22)}px;height:auto;}
  .name{font-family:ui-serif,'New York',Georgia,serif;font-weight:700;
    font-size:${Math.round(Math.min(w, h) * 0.062)}px;color:#fff;letter-spacing:-0.01em;}
</style></head><body><div class="wrap">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${mark(1)}</svg>
  <div class="name">Gym</div>
</div></body></html>`
