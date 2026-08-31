/**
 * Draws the native shell's app icon and launch image into the Xcode asset
 * catalog, from the same artwork as everything else in `art.mjs`.
 *
 * Unlike `assets.mjs` this drives whatever Chrome the machine already has,
 * rather than Playwright, because it has to run on the Mac that opens Xcode
 * and that machine should not need a browser installed to build the app.
 * Run with: node scripts/ios-assets.mjs
 */
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { iconHtml, splashHtml } from './art.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const assets = join(root, 'native/ios/App/App/Assets.xcassets')

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]
const chrome = CANDIDATES.find((p) => p && existsSync(p))
if (!chrome) {
  console.error('No Chrome found. Install one, or set CHROME_PATH to it')
  process.exit(1)
}

const work = await mkdtemp(join(tmpdir(), 'gym-assets-'))

/**
 * One shot at an exact pixel size, straight out of headless Chrome.
 *
 * A branded Chrome writes the screenshot and then stays up talking to its
 * updater instead of exiting, so this waits for the file to appear and stop
 * growing and then ends the process itself, which is the same thing every
 * screenshot tool does under the covers.
 */
const shoot = async (html, size, out) => {
  const page = join(work, 'page.html')
  const shot = join(work, 'shot.png')
  await rm(shot, { force: true })
  await writeFile(page, html)
  const child = spawn(chrome, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    // The icon has to be opaque or iOS renders the transparency black anyway,
    // and the launch image is black ground by design.
    '--default-background-color=000000ff',
    `--screenshot=${shot}`,
    `--window-size=${size[0]},${size[1]}`,
    `--user-data-dir=${join(work, 'profile')}`,
    `file://${page}`,
  ], { stdio: 'ignore' })

  let last = -1
  for (let i = 0; i < 300; i++) {
    await delay(200)
    const bytes = await stat(shot).then((s) => s.size, () => -1)
    if (bytes > 0 && bytes === last) break
    last = bytes
  }
  child.kill('SIGKILL')
  if (last <= 0) throw new Error(`Chrome wrote nothing for ${out}`)

  const buf = await readFile(shot)
  await writeFile(out, buf)
  return buf.length
}

// The app icon. iOS rounds the corners itself, so this one is drawn square:
// a rounded icon inside the mask reads as a shrunken one.
const icon = join(assets, 'AppIcon.appiconset/AppIcon-512@2x.png')
console.log('AppIcon-512@2x.png', await shoot(iconHtml(1024, 0, 0.86), [1024, 1024], icon), 'bytes')

// The launch image. Capacitor's storyboard scales one square to fill every
// screen, so it is drawn square and the mark stays centred whatever it crops.
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  const out = join(assets, 'Splash.imageset', name)
  console.log(name, await shoot(splashHtml(2732, 2732), [2732, 2732], out), 'bytes')
}

await rm(work, { recursive: true, force: true })
