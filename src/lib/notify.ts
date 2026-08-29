/**
 * Rest alerts. The chime covers the app while you are looking at it; this
 * covers the moment you are not. Safari only delivers these to an app you
 * added to the Home Screen, and only while it is still running, so every step
 * here is best effort and nothing depends on it.
 */

export const notificationsSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window

export const notificationsGranted = (): boolean =>
  notificationsSupported() && Notification.permission === 'granted'

export const askForNotifications = async (): Promise<NotificationPermission> => {
  if (!notificationsSupported()) return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/** Fires only when the app is out of sight, since on screen the chime wins. */
export const notifyRestOver = (exerciseName: string) => {
  if (!notificationsGranted() || document.visibilityState === 'visible') return
  const body = exerciseName ? `Next set: ${exerciseName}` : 'Time for your next set'
  try {
    new Notification('Rest is up', { body, tag: 'rest', silent: false })
  } catch {
    // Some browsers only allow notifications through a service worker.
    void navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification('Rest is up', { body, tag: 'rest' }))
      .catch(() => undefined)
  }
}
