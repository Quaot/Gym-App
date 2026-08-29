/**
 * One shared AudioContext for the whole app. iOS only allows audio that was
 * unlocked inside a user gesture, so `unlock()` must be called from a tap
 * handler (completing a set, starting a rest) before `chime()` can sound.
 */

let ctx: AudioContext | null = null
let unlocked = false

const getCtx = (): AudioContext | null => {
  try {
    ctx ??= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    return ctx
  } catch {
    return null
  }
}

/** Call from inside a user-gesture handler. Safe to call repeatedly. */
export const unlockAudio = (): void => {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  if (!unlocked) {
    // Play a silent tick so iOS marks the context as user-activated.
    const buf = c.createBuffer(1, 1, 22050)
    const src = c.createBufferSource()
    src.buffer = buf
    src.connect(c.destination)
    try {
      src.start(0)
    } catch {
      /* already started contexts can throw; unlock still succeeded */
    }
    unlocked = true
  }
}

/** Hook point for actions.ts: unlock as part of starting a rest. */
export const startRestUnlockingAudio = (): void => unlockAudio()

const tone = (c: AudioContext, freq: number, at: number, dur: number, gainPeak: number) => {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  osc.connect(gain).connect(c.destination)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(gainPeak, at + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

/** End-of-rest chime: a rising double beep. */
export const chime = (): void => {
  const c = getCtx()
  if (!c || c.state !== 'running') return
  const at = c.currentTime
  tone(c, 880, at, 0.2, 0.25)
  tone(c, 1174.66, at + 0.22, 0.24, 0.25)
}

/** Sub-10ms detent click for the tape input. Quiet and short by design. */
export const detentTick = (): void => {
  const c = getCtx()
  if (!c || c.state !== 'running') return
  const at = c.currentTime
  tone(c, 1800, at, 0.03, 0.06)
}
