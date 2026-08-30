// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptic, hapticsEnabled, resetHaptics, setHapticsEnabled } from './haptics'

const withVibrate = (fn: (spy: ReturnType<typeof vi.fn>) => void) => {
  const spy = vi.fn()
  Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true })
  fn(spy)
}

const withoutVibrate = (fn: () => void) => {
  // happy-dom has no vibration API by default, but be explicit about it.
  Reflect.deleteProperty(navigator, 'vibrate')
  fn()
}

beforeEach(() => {
  resetHaptics()
  document.body.innerHTML = ''
})
afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
  resetHaptics()
})

describe('haptics on a device that can vibrate', () => {
  it('plays a pattern for the kind it was asked for', () => {
    withVibrate((spy) => {
      haptic('tick')
      expect(spy).toHaveBeenCalledWith(4)
    })
  })

  it('gives a completed set more than a wheel detent', () => {
    withVibrate((spy) => {
      haptic('tick')
      haptic('success')
      const [tick] = spy.mock.calls[0]
      const [success] = spy.mock.calls[1]
      const total = (p: number | number[]) => (Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p)
      expect(total(success)).toBeGreaterThan(total(tick))
    })
  })

  it('does nothing at all once you turn it off', () => {
    withVibrate((spy) => {
      setHapticsEnabled(false)
      expect(hapticsEnabled()).toBe(false)
      haptic('success')
      expect(spy).not.toHaveBeenCalled()
    })
  })

  it('never lets feedback throw into the caller', () => {
    withVibrate((spy) => {
      spy.mockImplementation(() => { throw new Error('no motor') })
      expect(() => haptic('alert')).not.toThrow()
    })
  })
})

describe('haptics on Safari, which has no vibration API', () => {
  it('falls back to clicking a switch, which is the only thing that ticks', () => {
    withoutVibrate(() => {
      haptic('success')
      const el = document.querySelector('input[type="checkbox"][switch]')
      expect(el, 'the hidden switch should have been built').not.toBeNull()
    })
  })

  it('builds that switch once and reuses it', () => {
    withoutVibrate(() => {
      haptic('tick')
      haptic('tick')
      haptic('success')
      expect(document.querySelectorAll('input[switch]')).toHaveLength(1)
    })
  })

  it('keeps the switch out of the page: no size, no focus, no pointer', () => {
    withoutVibrate(() => {
      haptic('tick')
      const el = document.querySelector<HTMLInputElement>('input[switch]')!
      expect(el.tabIndex).toBe(-1)
      expect(el.getAttribute('aria-hidden')).toBe('true')
      expect(el.style.pointerEvents).toBe('none')
    })
  })

  it('builds nothing when haptics are off', () => {
    withoutVibrate(() => {
      setHapticsEnabled(false)
      haptic('success')
      expect(document.querySelector('input[switch]')).toBeNull()
    })
  })
})
