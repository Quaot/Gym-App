/**
 * Builds the home screen icons and the iOS launch screens for the web app.
 *
 * The drawing itself lives in `art.mjs`, which the native shell's assets are
 * cut from too, so the whole set shares one palette: black ground, systemGreen
 * mark. Run with: node scripts/assets.mjs
 */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { iconSvg, splashHtml } from './art.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')

/** Every iPhone Apple still serves, portrait, as CSS size and pixel ratio. */
const DEVICES = [
  [320, 568, 2], [375, 667, 2], [390, 844, 3], [393, 852, 3], [402, 874, 3],
  [414, 896, 2], [414, 896, 3], [428, 926, 3], [430, 932, 3], [440, 956, 3],
  [375, 812, 3],
]

const EXEC = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath: EXEC })

/** One shot at an exact pixel size: CSS size times the device ratio. */
const shoot = async (html, width, height, ratio, out) => {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: ratio,
    colorScheme: 'dark',
  })
  const page = await ctx.newPage()
  await page.goto(`data:text/html,${encodeURIComponent(html)}`)
  const buf = await page.screenshot()
  await writeFile(out, buf)
  await ctx.close()
  return buf.length
}

// Icons. A CSS pixel per unit keeps the screenshot exact.
await writeFile(join(pub, 'favicon.svg'), `${iconSvg(20, 0.86)}\n`)
const icons = [
  ['icon-180.png', 180, 40, 0.86],
  ['icon-192.png', 192, 43, 0.86],
  ['icon-512.png', 512, 114, 0.86],
  // Maskable art has to survive a circular crop, so the mark sits smaller.
  ['icon-512-maskable.png', 512, 0, 0.62],
]
for (const [name, size, radius, scale] of icons) {
  const svg = iconSvg((radius / size) * 100, scale)
  const html = `<!doctype html><html><head><style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style></head><body>${svg}</body></html>`
  console.log(name, await shoot(html, size, size, 1, join(pub, name)), 'bytes')
}

// Launch screens, one per device size and pixel ratio.
await mkdir(join(pub, 'splash'), { recursive: true })
const links = []
for (const [w, h, ratio] of DEVICES) {
  const name = `splash/${w}x${h}@${ratio}.png`
  const bytes = await shoot(splashHtml(w, h), w, h, ratio, join(pub, name))
  links.push(
    `    <link rel="apple-touch-startup-image" href="${name}"\n` +
    `      media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)" />`,
  )
  console.log(name, bytes, 'bytes')
}
console.log('\nPaste into index.html:\n')
console.log(links.join('\n'))
await browser.close()
