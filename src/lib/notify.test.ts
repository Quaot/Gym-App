// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { notificationsGranted, notificationsSupported, notifyRestOver } from './notify'

interface Fake {
  title: string
  body?: string
}

const install = (permission: NotificationPermission, visibility: DocumentVisibilityState) => {
  const sent: Fake[] = []
  class FakeNotification {
    static permission = permission
    constructor(title: string, options?: NotificationOptions) {
      sent.push({ title, body: options?.body })
    }
  }
  vi.stubGlobal('Notification', FakeNotification)
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
  return sent
}

afterEach(() => vi.unstubAllGlobals())

describe('rest alerts', () => {
  it('reads the browser permission', () => {
    install('granted', 'hidden')
    expect(notificationsSupported()).toBe(true)
    expect(notificationsGranted()).toBe(true)
  })

  it('fires with the next exercise once the app is out of sight', () => {
    const sent = install('granted', 'hidden')
    notifyRestOver('Barbell Bench Press')
    expect(sent).toEqual([{ title: 'Rest is up', body: 'Next set: Barbell Bench Press' }])
  })

  it('stays quiet while you are looking at the app, since the chime has it', () => {
    const sent = install('granted', 'visible')
    notifyRestOver('Barbell Bench Press')
    expect(sent).toEqual([])
  })

  it('stays quiet without permission', () => {
    const sent = install('default', 'hidden')
    notifyRestOver('Barbell Bench Press')
    expect(sent).toEqual([])
    expect(notificationsGranted()).toBe(false)
  })

  it('says something useful when the exercise is unnamed', () => {
    const sent = install('granted', 'hidden')
    notifyRestOver('')
    expect(sent[0].body).toBe('Time for your next set')
  })
})
