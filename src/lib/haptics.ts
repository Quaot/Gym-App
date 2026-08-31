/**
 * Haptics, on the three paths this app has.
 *
 * The native shell reaches the Taptic Engine properly, so each kind gets the
 * feel it was named for. Android and desktop Chrome expose the vibration API,
 * so a pattern in milliseconds is all it takes. Safari on iPhone exposes
 * nothing at all, and the one thing that does reach the Taptic Engine from a
 * page is the switch control Safari added in 17.4: toggling one plays the
 * system tick. So a hidden switch sits offscreen and gets clicked when there
 * is neither a native bridge nor a vibration API to use instead.
 *
 * Every path is best effort and silent. A device that gives no feedback is
 * the normal case, not an error, and nothing here may ever throw into a
 * caller that was only trying to acknowledge a tap.
 */

import { isNative } from './native'

export type Haptic =
  /** A detent on a wheel, or a value ticking past. The lightest thing there is. */
  | 'tick'
  /** Something was chosen: a row, a set opening, a sheet. */
  | 'select'
  /** Something completed and went well: a set logged, an exercise filled. */
  | 'success'
  /** A record, which is worth more than an ordinary completion. */
  | 'record'
  /** Something destructive or refused. */
  | 'warn'
  /** The rest timer reaching zero, felt through a pocket. */
  | 'alert'

const PATTERN: Record<Haptic, number | number[]> = {
  tick: 4,
  select: 8,
  success: [14, 40, 20],
  record: [18, 45, 18, 45, 30],
  warn: [24, 70, 24],
  alert: [180, 90, 180],
}

let enabled = true

/** The app mirrors the setting in here, so callers never read the store. */
export const setHapticsEnabled = (on: boolean): void => {
  enabled = on
}

export const hapticsEnabled = (): boolean => enabled

/* ------------------------------------------------------------------ *
 * The native path: the Taptic Engine, addressed by name.
 * ------------------------------------------------------------------ */

const bridge = () => import('@capacitor/haptics')

/**
 * Plays a kind through the native engine. Fired and forgotten: the import
 * resolves long before your thumb has left the screen on every call after the
 * first, and a rejection means one tap went unacknowledged.
 */
const nativeHaptic = (kind: Haptic): void => {
  void bridge()
    .then(({ Haptics, ImpactStyle, NotificationType }) => {
      switch (kind) {
        case 'tick':
          return Haptics.impact({ style: ImpactStyle.Light })
        case 'select':
          return Haptics.impact({ style: ImpactStyle.Medium })
        case 'success':
          return Haptics.notification({ type: NotificationType.Success })
        case 'record':
          // A record earns the weight of a success and a thump under it.
          return Haptics.impact({ style: ImpactStyle.Heavy }).then(() =>
            Haptics.notification({ type: NotificationType.Success }),
          )
        case 'warn':
          return Haptics.notification({ type: NotificationType.Warning })
        case 'alert':
          // Rest running out has to survive a pocket, which no tap does.
          return Haptics.vibrate({ duration: 300 })
      }
    })
    .catch(() => undefined)
}

/* ------------------------------------------------------------------ *
 * The iPhone path: a switch nobody sees, clicked for its tick.
 * ------------------------------------------------------------------ */

let toggle: HTMLInputElement | null = null

/**
 * Builds the hidden switch once. It has to be rendered rather than
 * `display: none`, or Safari treats the click as landing on nothing and no
 * tick is played, so it is parked offscreen and taken out of the tab order.
 */
const switchEl = (): HTMLInputElement | null => {
  if (toggle) return toggle
  if (typeof document === 'undefined') return null
  try {
    const el = document.createElement('input')
    el.type = 'checkbox'
    // The attribute is what makes Safari render it as a switch, and only a
    // switch carries the haptic. Elsewhere it is an ordinary checkbox.
    el.setAttribute('switch', '')
    el.setAttribute('aria-hidden', 'true')
    el.tabIndex = -1
    el.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none'
    document.body.appendChild(el)
    toggle = el
    return el
  } catch {
    return null
  }
}

/** True when this browser can vibrate, which is every path except Safari. */
const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

/**
 * Plays a haptic, or does nothing at all. Safe to call from any handler, on
 * any device, however often.
 */
export const haptic = (kind: Haptic = 'select'): void => {
  if (!enabled) return
  try {
    if (isNative()) {
      nativeHaptic(kind)
      return
    }
    if (canVibrate()) {
      navigator.vibrate(PATTERN[kind])
      return
    }
    // Safari has one tick and no patterns, so every kind feels the same.
    switchEl()?.click()
  } catch {
    /* feedback is never worth an exception */
  }
}

/** Test seam: forgets the hidden switch so a case can build its own. */
export const resetHaptics = (): void => {
  toggle?.remove()
  toggle = null
  enabled = true
}
