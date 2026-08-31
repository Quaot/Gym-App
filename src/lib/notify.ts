/**
 * Rest alerts. The chime covers the app while you are looking at it; this
 * covers the moment you are not.
 *
 * The two platforms need opposite shapes. In a browser nothing can run once
 * the page is out of sight, so the alert is *posted* at the moment the timer
 * reaches zero and only lands if the page happens to still be alive. In the
 * native shell JavaScript is frozen the instant the app is backgrounded, so
 * posting then would never happen at all; instead the alert is *scheduled*
 * for the deadline when rest starts, handed to iOS, and cancelled if you skip
 * ahead. That is the version that actually reaches you in your pocket.
 *
 * Every step here is best effort and nothing depends on it.
 */

import { isNative } from './native'

export type Permission = NotificationPermission | 'unsupported'

/** The one rest alert, reused, so a new one always replaces the last. */
const REST_ALERT_ID = 1001

/**
 * The plugin module, never the plugin itself.
 *
 * A Capacitor plugin is a Proxy that answers every property with a method
 * call, `then` included, so a promise that resolves *to* one is mistaken for
 * a thenable and adopted: the runtime calls `LocalNotifications.then()` and
 * the whole chain rejects with "not implemented on ios". Handing back the
 * module and reaching through it at the call site keeps the proxy out of
 * promise position.
 */
const plugin = () => import('@capacitor/local-notifications')

/**
 * iOS answers about permission asynchronously, but the settings screen asks
 * synchronously while it renders, so the last answer is kept here and
 * refreshed on the way in.
 */
let nativePermission: Permission = 'default'

const fromDisplay = (display: string): Permission =>
  display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default'

export const notificationsSupported = (): boolean =>
  isNative() || (typeof window !== 'undefined' && 'Notification' in window)

export const notificationPermission = (): Permission => {
  if (isNative()) return nativePermission
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

export const notificationsGranted = (): boolean =>
  notificationPermission() === 'granted'

/** Re-reads the system setting, which you can change outside the app. */
export const refreshNotificationPermission = async (): Promise<Permission> => {
  if (!isNative()) return notificationPermission()
  try {
    const { display } = await (await plugin()).LocalNotifications.checkPermissions()
    nativePermission = fromDisplay(display)
  } catch {
    nativePermission = 'denied'
  }
  return nativePermission
}

export const askForNotifications = async (): Promise<Permission> => {
  if (isNative()) {
    try {
      const { display } = await (await plugin()).LocalNotifications.requestPermissions()
      nativePermission = fromDisplay(display)
    } catch {
      nativePermission = 'denied'
    }
    return nativePermission
  }
  if (!notificationsSupported()) return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

const body = (exerciseName: string) =>
  exerciseName ? `Next set: ${exerciseName}` : 'Time for your next set'

/**
 * Hands the deadline to iOS up front. A no-op in a browser, which has no way
 * to be woken later and uses `notifyRestOver` instead.
 */
export const scheduleRestAlert = (endsAt: number, exerciseName: string): void => {
  if (!isNative() || !notificationsGranted()) return
  void plugin()
    .then(({ LocalNotifications }) =>
      LocalNotifications.schedule({
        notifications: [
          {
            id: REST_ALERT_ID,
            title: 'Rest is up',
            body: body(exerciseName),
            // Already past, on a deadline restored from a reload: iOS treats a
            // date behind it as due now, which is the right answer anyway.
            schedule: { at: new Date(endsAt), allowWhileIdle: true },
          },
        ],
      }),
    )
    .catch(() => undefined)
}

/** Skipping rest, or finishing it while you are watching, takes it back. */
export const cancelRestAlert = (): void => {
  if (!isNative()) return
  void plugin()
    .then(({ LocalNotifications }) =>
      LocalNotifications.cancel({ notifications: [{ id: REST_ALERT_ID }] }),
    )
    .catch(() => undefined)
}

/** Fires only when the app is out of sight, since on screen the chime wins. */
export const notifyRestOver = (exerciseName: string) => {
  // The native shell scheduled this one when rest started, and firing a second
  // copy here would be a duplicate banner.
  if (isNative()) return
  if (!notificationsGranted() || document.visibilityState === 'visible') return
  try {
    new Notification('Rest is up', { body: body(exerciseName), tag: 'rest', silent: false })
  } catch {
    // Some browsers only allow notifications through a service worker.
    void navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification('Rest is up', { body: body(exerciseName), tag: 'rest' }))
      .catch(() => undefined)
  }
}
